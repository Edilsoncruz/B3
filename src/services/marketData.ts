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
import { selectDynamicUniverse, SelectionParameters, DEFAULT_SELECTION_PARAMS, ScreeningResult } from './universeSelector';
import { syncAssetsIncrementally, SyncProgressCallback, IncrementalSyncResult } from './incrementalSync';
import { getFundamentals, getStockQuote, getStockStats } from './bolsai';

export interface MarketCandidatesResult {
  candidates: StockCache[];
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
  // MODO 2: Varredura Geral Inteligente de Mercado (5 Etapas)
  // =========================================================================

  // 1. Carrega dados pré-existentes do Supabase para otimização do screening
  const allCached = await getAllCachedStocks();
  const cachedMap: Record<string, StockCache> = {};
  for (const item of allCached) {
    cachedMap[item.ticker.toUpperCase()] = item;
  }

  // 2. Etapas 1 & 2: Seleção Inteligente de Ativos a partir do catálogo amplo
  const customParams = {
    ...DEFAULT_SELECTION_PARAMS,
    poolSize,
    ...(opts.selectionParams || {})
  };

  const { selectedTickers, screenedResults, totalUniverseCount } = await selectDynamicUniverse(
    customParams,
    cachedMap
  );

  // 3. Etapas 3 & 4: Atualização Incremental e Gravação no Supabase
  const syncResult: IncrementalSyncResult = await syncAssetsIncrementally(
    selectedTickers,
    opts.onProgress,
    opts.forceRefresh ? 0 : 12
  );

  return {
    candidates: syncResult.consolidatedStocks,
    screenedResults,
    syncStats: {
      totalUniverseCount,
      selectedPoolSize: selectedTickers.length,
      cacheHitCount: syncResult.cacheHitCount,
      apiFetchCount: syncResult.apiFetchCount,
      failedCount: syncResult.failedCount
    }
  };
}
