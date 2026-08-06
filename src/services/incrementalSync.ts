/**
 * Etapas 3 & 4: Atualização Inteligente e Gravação no Supabase
 * 
 * Verifica individualmente cada ativo selecionado:
 * - Se já estiver atualizado no Supabase: ZERO chamadas à Usebolsa.
 * - Se faltarem dados ou for um ativo novo: faz o download pontual e grava no Supabase.
 */

import { getMultipleCachedStocks, setCachedStock, isStockUpToDate, StockCache } from '../lib/supabase';
import { getFundamentals, getStockQuote, getStockStats } from './bolsai';

export interface AssetSyncStatus {
  ticker: string;
  isUpToDate: boolean;
  needsFetch: boolean;
  lastUpdated: string | null;
  source: 'SUPABASE_CACHE' | 'USEBOLSA_INCREMENTAL' | 'FALLBACK';
}

export interface SyncProgressCallback {
  (progress: {
    current: number;
    total: number;
    currentTicker: string;
    status: 'CACHE_HIT' | 'FETCHING' | 'SYNCED' | 'ERROR';
    message: string;
  }): void;
}

export interface IncrementalSyncResult {
  consolidatedStocks: StockCache[];
  totalChecked: number;
  cacheHitCount: number;
  apiFetchCount: number;
  failedCount: number;
  statuses: AssetSyncStatus[];
}

/**
 * Busca dados na Usebolsa e consolida com enriquecimento de dados técnicos.
 */
async function fetchAndEnrichStockFromUsebolsa(ticker: string, existingCache?: StockCache | null): Promise<StockCache> {
  console.log(`  🌐 [Usebolsa API] Baixando dados incrementais para ${ticker}...`);

  const [quote, stats, fundamentals] = await Promise.all([
    getStockQuote(ticker).catch(e => {
      console.warn(`    ⚠️ getStockQuote(${ticker}) falhou: ${e.message}`);
      return null;
    }),
    getStockStats(ticker).catch(e => {
      console.warn(`    ⚠️ getStockStats(${ticker}) falhou: ${e.message}`);
      return null;
    }),
    getFundamentals(ticker).catch(e => {
      console.warn(`    ⚠️ getFundamentals(${ticker}) falhou: ${e.message}`);
      return null;
    })
  ]);

  const currentPrice = quote?.close ?? stats?.close ?? existingCache?.current_price ?? 0;

  if (!currentPrice && !fundamentals) {
    if (existingCache) {
      console.warn(`    🔄 [Fallback] Usando dados pré-existentes do Supabase para ${ticker}.`);
      return existingCache;
    }
    throw new Error(`Dados indisponíveis na Usebolsa para o ticker ${ticker}`);
  }

  const enrichedFundamentals = {
    ...(existingCache?.fundamentals ?? {}),
    ...(fundamentals ?? {}),
    week_52_low: stats?.week_52_low ?? existingCache?.fundamentals?.week_52_low,
    week_52_high: stats?.week_52_high ?? existingCache?.fundamentals?.week_52_high,
    daily_change_pct: stats?.daily_change_pct ?? existingCache?.fundamentals?.daily_change_pct,
    ytd_return_pct: stats?.ytd_return_pct ?? existingCache?.fundamentals?.ytd_return_pct,
    avg_volume_52w: stats?.avg_volume_52w ?? existingCache?.fundamentals?.avg_volume_52w,
  };

  const newStockData: StockCache = {
    ticker: ticker.toUpperCase(),
    current_price: currentPrice,
    fundamentals: enrichedFundamentals,
    macro_data: existingCache?.macro_data || {},
    price_history: existingCache?.price_history || null,
    updated_at: new Date().toISOString()
  };

  // Grava imediatamente no Supabase (Etapa 4)
  await setCachedStock(
    newStockData.ticker,
    newStockData.current_price,
    newStockData.fundamentals,
    newStockData.macro_data,
    newStockData.price_history
  );

  return newStockData;
}

/**
 * Executa a sincronização inteligente em lote dos ativos selecionados (Etapas 3 & 4).
 * 
 * Regra estrita de economia de API:
 * - Se o registro no Supabase foi atualizado nas últimas 12 horas:
 *   -> NÃO realiza nenhuma requisição para a Usebolsa (Zero consumo de cota).
 * - Apenas ativos ausentes ou desatualizados disparam download.
 */
export async function syncAssetsIncrementally(
  tickers: string[],
  onProgress?: SyncProgressCallback,
  maxCacheAgeHours: number = 12
): Promise<IncrementalSyncResult> {
  const total = tickers.length;
  console.log(`\n⚡ [Etapas 3 & 4: Atualização Incremental Supabase] Iniciando verificação individual para ${total} ativos...`);

  // 1. Consulta o estado atual de todos os ativos no Supabase de uma única vez
  const cachedMap = await getMultipleCachedStocks(tickers);

  const consolidatedStocks: StockCache[] = [];
  const statuses: AssetSyncStatus[] = [];
  let cacheHitCount = 0;
  let apiFetchCount = 0;
  let failedCount = 0;

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i].toUpperCase();
    const cachedItem = cachedMap[ticker];
    const isUpToDate = isStockUpToDate(cachedItem, maxCacheAgeHours);

    if (isUpToDate && cachedItem) {
      // ✅ CASO A: Ativo totalmente atualizado no Supabase -> 0 chamadas de API!
      cacheHitCount++;
      consolidatedStocks.push(cachedItem);
      statuses.push({
        ticker,
        isUpToDate: true,
        needsFetch: false,
        lastUpdated: cachedItem.updated_at,
        source: 'SUPABASE_CACHE'
      });

      console.log(`  📦 [Supabase Cache HIT] ${ticker} já atualizado (${cachedItem.updated_at}). ZERO chamadas de API.`);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentTicker: ticker,
          status: 'CACHE_HIT',
          message: `${ticker}: atualizado no Supabase (0 requisições)`
        });
      }
    } else {
      // ⚠️ CASO B: Ativo novo ou desatualizado -> download incremental pontual
      apiFetchCount++;
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentTicker: ticker,
          status: 'FETCHING',
          message: `${ticker}: baixando dados ausentes da Usebolsa...`
        });
      }

      try {
        const freshData = await fetchAndEnrichStockFromUsebolsa(ticker, cachedItem);
        consolidatedStocks.push(freshData);
        statuses.push({
          ticker,
          isUpToDate: true,
          needsFetch: true,
          lastUpdated: freshData.updated_at,
          source: 'USEBOLSA_INCREMENTAL'
        });

        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            currentTicker: ticker,
            status: 'SYNCED',
            message: `${ticker}: sincronizado e salvo no Supabase com sucesso!`
          });
        }
      } catch (err: any) {
        failedCount++;
        console.error(`  ❌ [Falha ao atualizar ${ticker}]:`, err.message);

        if (cachedItem) {
          // Fallback seguro: usa o dado anterior que já existia no banco
          consolidatedStocks.push(cachedItem);
          statuses.push({
            ticker,
            isUpToDate: false,
            needsFetch: true,
            lastUpdated: cachedItem.updated_at,
            source: 'FALLBACK'
          });
        }

        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            currentTicker: ticker,
            status: 'ERROR',
            message: `${ticker}: erro ao baixar (${err.message}).`
          });
        }
      }
    }
  }

  console.log(`\n📊 [Resultado da Sincronização Incremental]`);
  console.log(`   Total analisado: ${total}`);
  console.log(`   Cache HIT (0 API calls): ${cacheHitCount}`);
  console.log(`   Usebolsa Fetches: ${apiFetchCount}`);
  console.log(`   Falhas: ${failedCount}`);

  return {
    consolidatedStocks,
    totalChecked: total,
    cacheHitCount,
    apiFetchCount,
    failedCount,
    statuses
  };
}
