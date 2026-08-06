import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not found. Cache will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface StockCache {
  ticker: string;
  current_price: number;
  fundamentals: any;
  macro_data: any;
  price_history?: any;
  updated_at: string;
}

export async function getCachedStock(ticker: string): Promise<StockCache | null> {
  if (!supabaseUrl) {
    console.warn('[Supabase] VITE_SUPABASE_URL não configurada. Cache desabilitado.');
    return null;
  }

  const { data, error } = await supabase
    .from('stock_cache')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .maybeSingle(); // .maybeSingle() retorna null sem erro quando não encontra (evita 406)

  if (error) {
    console.error(`[Supabase] Erro ao buscar cache de ${ticker}:`, error.message);
    return null;
  }
  return data as StockCache | null;
}

export async function getMultipleCachedStocks(tickers: string[]): Promise<Record<string, StockCache>> {
  if (!supabaseUrl || tickers.length === 0) return {};

  const upperTickers = tickers.map(t => t.toUpperCase());
  const { data, error } = await supabase
    .from('stock_cache')
    .select('*')
    .in('ticker', upperTickers);

  if (error) {
    console.error('[Supabase] Erro ao buscar múltiplos caches:', error.message);
    return {};
  }

  const map: Record<string, StockCache> = {};
  if (data) {
    for (const item of data as StockCache[]) {
      map[item.ticker.toUpperCase()] = item;
    }
  }
  return map;
}

export async function setCachedStock(ticker: string, currentPrice: number, fundamentals: any, macroData: any, priceHistory?: any): Promise<void> {
  if (!supabaseUrl) {
    console.warn(`[Supabase] VITE_SUPABASE_URL não configurada. Cache NÃO será salvo para ${ticker}.`);
    return;
  }

  const { error } = await supabase
    .from('stock_cache')
    .upsert({
      ticker: ticker.toUpperCase(),
      current_price: currentPrice,
      fundamentals,
      macro_data: macroData,
      price_history: priceHistory ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'ticker' });

  if (error) {
    console.error(`[Supabase] Erro ao salvar cache de ${ticker}:`, error.message, error.details);
  } else {
    console.log(`[Supabase] ✅ Cache de ${ticker} salvo com sucesso.`);
  }
}

export async function getAllCachedStocks(): Promise<StockCache[]> {
  if (!supabaseUrl) {
    console.warn('[Supabase] VITE_SUPABASE_URL não configurada. Cache desabilitado.');
    return [];
  }

  const { data, error } = await supabase
    .from('stock_cache')
    .select('*')
    .order('ticker', { ascending: true });

  if (error) {
    console.error('[Supabase] Erro ao buscar todas as ações em cache:', error.message);
    return [];
  }

  return (data as StockCache[]) || [];
}

export async function countCachedStocks(): Promise<number> {
  if (!supabaseUrl) return 0;

  const { count, error } = await supabase
    .from('stock_cache')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[Supabase] Erro ao contar ações em cache:', error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Verifica se os dados de um ativo no Supabase estão atualizados.
 * Padrão: 12 horas ou atualizado no mesmo dia de pregão.
 */
export function isStockUpToDate(stock?: StockCache | null, maxAgeHours: number = 12): boolean {
  if (!stock || !stock.updated_at || !stock.current_price) {
    return false;
  }

  const updatedAt = new Date(stock.updated_at).getTime();
  const now = new Date().getTime();
  const diffHours = (now - updatedAt) / (1000 * 60 * 60);

  return diffHours < maxAgeHours;
}

/**
 * Salva múltiplos registros de uma vez no Supabase com integridade (Upsert em lote).
 */
export async function bulkUpsertStockCache(stocks: Partial<StockCache>[]): Promise<void> {
  if (!supabaseUrl || stocks.length === 0) return;

  const rows = stocks.map(s => ({
    ticker: s.ticker?.toUpperCase(),
    current_price: s.current_price || 0,
    fundamentals: s.fundamentals || {},
    macro_data: s.macro_data || {},
    price_history: s.price_history || null,
    updated_at: s.updated_at || new Date().toISOString()
  }));

  const { error } = await supabase
    .from('stock_cache')
    .upsert(rows, { onConflict: 'ticker' });

  if (error) {
    console.error('[Supabase] Erro no bulkUpsertStockCache:', error.message);
  } else {
    console.log(`[Supabase] ✅ ${rows.length} ações sincronizadas e gravadas em lote.`);
  }
}
