/**
 * Orquestrador do Pipeline Inteligente de Mercado (5 Etapas)
 * 
 * 1. Universo Inicial (~1.000 ativos da B3)
 * 2. Seleção Inteligente com critérios dinâmicos e parametrizáveis (Top 50)
 * 3. Atualização Inteligente e Verificação Individual no Supabase
 * 4. Gravação com integridade no Supabase
 * 5. Alimentação da Estratégia de IA exclusivamente via Supabase
 */

import { getCachedStock, getAllCachedStocks, setCachedStock, StockCache, isStockUpToDate } from '../lib/supabase';
import { applyDeterministicFilters, applyRecoveryPreFilter, B3_FULL_CATALOG, DEFAULT_SELECTION_PARAMS } from './universeSelector';
import { syncAssetsIncrementally, SyncProgressCallback, IncrementalSyncResult } from './incrementalSync';
import { getFundamentals, getStockQuote, getStockStats } from './bolsai';
import { AuditManager } from './auditManager';
import { applyGateBatch, loadGateParams, GateResult } from './gateBottomFishing';

export interface MarketCandidatesResult {
  candidates: StockCache[];
  /** Resultados do Gate Bottom Fishing para candidatos aprovados (Modo Descoberta) */
  gateResults?: Record<string, GateResult>;
  screenedResults?: ScreeningResult[];
  syncStats: {
    totalUniverseCount: number;
    selectedPoolSize: number;
    cacheHitCount: number;
    apiFetchCount: number;
    failedCount: number;
  };
}

export interface MarketScanOptions {
  poolSize?: number;
  specificTicker?: string;
  selectionParams?: Partial<SelectionParameters>;
  onProgress?: SyncProgressCallback;
  forceRefresh?: boolean;
  auditManager?: AuditManager;
  maxPrice?: number;
  /**
   * Dados de posição do usuário (Modo Posição).
   * Se presentes (quantidade + preço médio), o Gate Bottom Fishing é bypassado
   * e o R:R 1:2 não é obrigatório.
   * Critério correto: presença estrutural de dados de posição — NÃO cardinalidade de tickers.
   */
  positionData?: {
    ticker: string;
    quantity: number;
    averagePrice: number;
  };
}

/**
 * Executa o fluxo inteligente de seleção e atualização incremental.
 * Retorna os dados 100% consolidados no Supabase para a IA executar as estratégias.
 */
export async function getMarketCandidates(
  options: MarketScanOptions | number = 50,
  specificTickerArg?: string
): Promise<MarketCandidatesResult> {
  // Normaliza parâmetros para compatibilidade
  const opts: MarketScanOptions = typeof options === 'number'
    ? { poolSize: options, specificTicker: specificTickerArg }
    : options;

  const poolSize = opts.poolSize || 50;
  const specificTicker = opts.specificTicker?.trim()?.toUpperCase();

  console.log(`\n🚀 [Pipeline Inteligente] Iniciando fluxo de dados...`);
  console.log(`   Modo: ${specificTicker ? `Ticker Específico (${specificTicker})` : `Varredura Dinâmica (Top ${poolSize})`}`);

  // =========================================================================
  // MODO 1: Ticker Específico Solicitado pelo Usuário
  // =========================================================================
  if (specificTicker) {
    console.log(`🎯 [Etapa 3 & 4: Ticker Único] Verificando ${specificTicker} no Supabase...`);
    const cached = await getCachedStock(specificTicker);

    if (cached && isStockUpToDate(cached, opts.forceRefresh ? 0 : 12)) {
      console.log(`   ✅ [Supabase Hit] ${specificTicker} já atualizado no banco. Zero chamadas de API.`);
      return {
        candidates: [cached],
        syncStats: {
          totalUniverseCount: 1,
          selectedPoolSize: 1,
          cacheHitCount: 1,
          apiFetchCount: 0,
          failedCount: 0
        }
      };
    }

    console.log(`   🌐 [Usebolsa Fetch] Buscando dados frescos para ${specificTicker}...`);
    try {
      const [quote, stats, fundamentals] = await Promise.all([
        getStockQuote(specificTicker).catch(() => null),
        getStockStats(specificTicker).catch(() => null),
        getFundamentals(specificTicker).catch(() => null)
      ]);

      const currentPrice = quote?.close ?? stats?.close ?? cached?.current_price ?? 0;
      const enrichedFundamentals = {
        ...(cached?.fundamentals ?? {}),
        ...(fundamentals ?? {}),
        week_52_low: stats?.week_52_low ?? cached?.fundamentals?.week_52_low,
        week_52_high: stats?.week_52_high ?? cached?.fundamentals?.week_52_high,
        daily_change_pct: stats?.daily_change_pct ?? cached?.fundamentals?.daily_change_pct,
        ytd_return_pct: stats?.ytd_return_pct ?? cached?.fundamentals?.ytd_return_pct,
        avg_volume_52w: stats?.avg_volume_52w ?? cached?.fundamentals?.avg_volume_52w
      };

      const freshStock: StockCache = {
        ticker: specificTicker,
        current_price: currentPrice,
        fundamentals: enrichedFundamentals,
        macro_data: cached?.macro_data || {},
        price_history: cached?.price_history || null,
        updated_at: new Date().toISOString()
      };

      await setCachedStock(
        freshStock.ticker,
        freshStock.current_price,
        freshStock.fundamentals,
        freshStock.macro_data,
        freshStock.price_history
      );

      return {
        candidates: [freshStock],
        syncStats: {
          totalUniverseCount: 1,
          selectedPoolSize: 1,
          cacheHitCount: 0,
          apiFetchCount: 1,
          failedCount: 0
        }
      };
    } catch (err: any) {
      if (cached) {
        console.warn(`   🔄 [Fallback] Usando dados prévios do Supabase para ${specificTicker}.`);
        return {
          candidates: [cached],
          syncStats: {
            totalUniverseCount: 1,
            selectedPoolSize: 1,
            cacheHitCount: 1,
            apiFetchCount: 1,
            failedCount: 0
          }
        };
      }
      throw err;
    }
  }

  // =========================================================================
  // MODO 2: Varredura Geral Inteligente de Mercado
  // =========================================================================

  // Etapa A: Carrega dados pré-existentes do Supabase para o filtro L1
  const allCached = await getAllCachedStocks();
  const cachedMap: Record<string, StockCache> = {};
  for (const item of allCached) {
    cachedMap[item.ticker.toUpperCase()] = item;
  }

  // Etapa B: Camada 1 — Filtros Determinísticos (usa cache para eliminação rápida)
  const { eligibleTickers, eliminatedDetails } = await applyDeterministicFilters(
    B3_FULL_CATALOG,
    cachedMap,
    opts.auditManager,
    opts.maxPrice
  );

  // Etapa C: Sync Incremental dos elegíveis ANTES da Luna
  // Garante que a Luna e a Camada 1.5 sempre trabalhem com dados frescos.
  // O Supabase funciona como cache: se o dado for recente (<12h), ZERO chamadas à Unibolsa.
  // Se o Supabase estiver vazio ou desatualizado, busca os dados na Unibolsa e salva no banco.
  console.log(`\n🔄 [Sync Pré-Luna] Atualizando dados para ${eligibleTickers.length} elegíveis...`);
  if (opts.onProgress) {
    opts.onProgress({ current: 0, total: eligibleTickers.length, message: `Sincronizando ${eligibleTickers.length} ativos elegíveis (cache Supabase ou Unibolsa)...` });
  }

  const preLunaSync: IncrementalSyncResult = await syncAssetsIncrementally(
    eligibleTickers,
    opts.onProgress ? (p) => {
      opts.onProgress!({ ...p, message: `Sync pré-triagem: ${p.message}` });
    } : undefined,
    opts.forceRefresh ? 0 : 12,
    opts.auditManager
  );

  // Monta mapa de dados frescos a partir do sync
  const freshDataMap: Record<string, StockCache> = {};
  for (const stock of preLunaSync.consolidatedStocks) {
    freshDataMap[stock.ticker.toUpperCase()] = stock;
  }

  // Etapa D: Camada 1.5 — Pré-filtro QUEDA + RECUPERAÇÃO com dados frescos
  const { fallCandidates, excludedFromTriage, stats: preFilterStats } = applyRecoveryPreFilter(
    eligibleTickers,
    freshDataMap
  );

  // Segurança: se nenhuma candidata passou (ex: mercado todo em alta), usa todos os elegíveis
  let lunaInputTickers = fallCandidates.length > 0 ? fallCandidates : eligibleTickers;

  // Filtro de Preço Máximo sobre dados frescos
  if (opts.maxPrice) {
    const maxPriceLimit = opts.maxPrice;
    lunaInputTickers = lunaInputTickers.filter(ticker => {
      const price = freshDataMap[ticker]?.current_price;
      if (price && price > maxPriceLimit) {
        console.log(`  [Preço Máximo] ${ticker} eliminado: R$ ${price.toFixed(2)} > R$ ${maxPriceLimit}`);
        return false;
      }
      return true;
    });
    console.log(`  [Preço Máximo] Corte R$ ${maxPriceLimit}: ${lunaInputTickers.length} candidatas restantes.`);
  }

  // Determina o modo de análise:
  // Modo Posição = dados estruturais de posição (quantidade + preço médio) presentes.
  // Modo Descoberta = padrão (mais restritivo). Nunca inferir por cardinalidade de tickers.
  const isModoPositicao = !!(opts.positionData?.quantity && opts.positionData?.averagePrice);

  if (opts.auditManager?.isEnabled()) {
    await opts.auditManager.logEvent('LAYER_1_5', 'RECOVERY_PREFILTER_APPLIED', 'ALL',
      `Camada 1.5: ${eligibleTickers.length} elegíveis → ${preFilterStats.falling} em queda → ${preFilterStats.recovering} com recuperação → ${lunaInputTickers.length} candidatas para Gate${fallCandidates.length === 0 ? ' (fallback: mercado sem candidatas, enviando todos)' : ''}`,
      0,
      {
        totalEligible: eligibleTickers.length,
        freshDataCount: Object.keys(freshDataMap).length,
        falling: preFilterStats.falling,
        recovering: preFilterStats.recovering,
        stable: preFilterStats.stable,
        rising: preFilterStats.rising,
        noCacheData: preFilterStats.noCacheData,
        fallCandidates: lunaInputTickers,
        excluded: excludedFromTriage,
        usedFallback: fallCandidates.length === 0,
        preSyncStats: {
          cacheHits: preLunaSync.cacheHitCount,
          apiFetches: preLunaSync.apiFetchCount,
          failed: preLunaSync.failedCount
        }
      }
    );
  }

  // =========================================================================
  // Etapa D.5: GATE BOTTOM FISHING (determinístico, sem IA) — Modo Descoberta apenas
  // Doc 3.2 §10 — roda DEPOIS dos Filtros Pré-IA e ANTES da Luna.
  // Ativos REJEITADOS pelo Gate não chegam à Luna → zero custo de IA.
  // =========================================================================
  let gateResultsMap: Record<string, GateResult> = {};
  let lunaInputAfterGate = lunaInputTickers;

  if (!isModoPositicao) {
    // Modo Descoberta: Gate obrigatório
    const gateParams = loadGateParams();
    const gateInputStocks = lunaInputTickers
      .map(t => freshDataMap[t.toUpperCase()])
      .filter((s): s is StockCache => !!s);

    // Captura contagem antes do Gate para comparação before/after
    const preGateCount = gateInputStocks.length;

    const { passed, rejected, stats: gateStats } = applyGateBatch(gateInputStocks, gateParams);

    // Mapeia resultados do Gate por ticker (para passar à Luna no contexto)
    for (const { gateResult } of passed) {
      gateResultsMap[gateResult.ticker] = gateResult;
    }
    for (const { gateResult } of rejected) {
      gateResultsMap[gateResult.ticker] = gateResult;
    }

    lunaInputAfterGate = passed.map(p => p.stock.ticker);

    // Relatório before/after solicitado pelo usuário para validação do Gate
    console.log(`\n📊 [Gate — Comparação Before/After]`);
    console.log(`   Antes do Gate:  ${preGateCount} ativos`);
    console.log(`   Após Gate:      ${lunaInputAfterGate.length} ativos (${gateStats.rejeitados} rejeitados sem custo de IA)`);
    console.log(`   CANDIDATO FORTE: ${gateStats.candidatosFortes}`);
    console.log(`   CANDIDATO:       ${gateStats.candidatos}`);
    if (gateStats.rejeitados > 0) {
      const rejectedTickers = rejected.map(r => r.gateResult.ticker).slice(0, 20);
      console.log(`   Rejeitados (amostra): ${rejectedTickers.join(', ')}${rejected.length > 20 ? '...' : ''}`);
    }

    if (opts.auditManager?.isEnabled()) {
      await opts.auditManager.logEvent('GATE', 'GATE_APPLIED', 'ALL',
        `Gate Bottom Fishing: ${preGateCount} entradas → ${lunaInputAfterGate.length} passaram (${gateStats.rejeitados} rejeitados sem custo de IA)`,
        0,
        {
          params: gateParams,
          stats: gateStats,
          candidatosFortes: passed
            .filter(p => p.gateResult.classification === 'CANDIDATO FORTE')
            .map(p => ({ ticker: p.gateResult.ticker, drop: p.gateResult.gate_drop_pct, distance: p.gateResult.gate_distance_pct })),
          rejeitados: rejected
            .slice(0, 50)
            .map(r => ({ ticker: r.gateResult.ticker, reasons: r.gateResult.reasons }))
        }
      );
    }
  } else {
    // Modo Posição: Gate não se aplica (doc 3.2 §40)
    console.log(`\n🔵 [Gate] Modo Posição detectado — Gate bypassado. R:R 1:2 não obrigatório.`);
    if (opts.auditManager?.isEnabled()) {
      await opts.auditManager.logEvent('GATE', 'GATE_BYPASSED', 'ALL',
        'Gate Bottom Fishing bypassado — Modo Posição (dados de posição presentes)', 0,
        { positionData: opts.positionData }
      );
    }
  }

  // Etapa E: Camada 2 — Triagem Inteligente (Luna) com dados frescos
  // Luna recebe apenas ativos aprovados pelo Gate (ou todos no Modo Posição)
  if (opts.onProgress) {
    opts.onProgress({ current: 0, total: 100, message: `Triagem Inteligente (Luna): avaliando ${lunaInputAfterGate.length} candidatas aprovadas pelo Gate...` });
  }

  let selectedTickers: string[] = [];
  let screenedResults: any[] = [];

  try {
    const { triageMarket } = await import('./openai');
    // Passa gateResultsMap para que a Luna receba o contexto do Gate e não reduplique critérios
    const triageResponse = await triageMarket(lunaInputAfterGate, freshDataMap, gateResultsMap, isModoPositicao);

    const ranking = triageResponse.ranking || [];
    const eligibleFromTriage = ranking.filter(r => r.elegivel_para_analise_profunda !== false);
    selectedTickers = (eligibleFromTriage.length > 0 ? eligibleFromTriage : ranking).map(r => r.ticker);

    screenedResults = ranking;

    if (opts.auditManager?.isEnabled()) {
      await opts.auditManager.logEvent('LAYER_2', 'TRIAGE_COMPLETED', 'ALL',
        `Luna avaliou ${lunaInputTickers.length} candidatas e selecionou ${selectedTickers.length} para análise profunda (Terra)`,
        0,
        { ranking }
      );
      await opts.auditManager.logAssetEvaluations(ranking);
    }
  } catch (err: any) {
    console.error('Erro na Camada 2 (Luna):', err);
    if (opts.auditManager?.isEnabled()) {
      await opts.auditManager.logEvent('LAYER_2', 'TRIAGE_FAILED', 'ALL', `Erro no Luna: ${err.message}`, 1, {});
    }
    throw new Error('Falha na Camada 2 (Triagem Inteligente). ' + err.message);
  }

  // Etapa F: Monta o conjunto final de candidatas para a Terra
  // Os dados já estão frescos (sincronizados na Etapa C). Apenas extrai do freshDataMap.
  const finalCandidates: StockCache[] = selectedTickers
    .map(t => freshDataMap[t.toUpperCase()])
    .filter((s): s is StockCache => !!s);

  return {
    candidates: finalCandidates,
    gateResults: gateResultsMap,
    screenedResults,
    syncStats: {
      totalUniverseCount: B3_FULL_CATALOG.length,
      eligibleLayer1Count: eligibleTickers.length,
      fallingCount: preFilterStats.falling,
      recoveringCount: preFilterStats.recovering,
      lunaInputCount: lunaInputAfterGate.length,
      selectedPoolSize: selectedTickers.length,
      cacheHitCount: preLunaSync.cacheHitCount,
      apiFetchCount: preLunaSync.apiFetchCount,
      failedCount: preLunaSync.failedCount
    }
  };
}

