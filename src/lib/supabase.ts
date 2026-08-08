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

export async function saveAnalyzedStocks(stocks: any[]): Promise<boolean> {
  if (!supabaseUrl || stocks.length === 0) return false;
  
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');

  const rows = stocks.map(stock => {
    const tck = (stock.ticker || 'B3').toUpperCase();
    return {
      id: stock.id || `${tck}_${dateStr}`,
      ticker: tck,
      company_name: stock.company_name,
      sector: stock.sector,
      current_price: stock.current_price,
      entry_price: stock.entry_price,
      target_price: stock.target_price,
      stop_loss: stock.stop_loss,
      success_probability: stock.success_probability,
      strategy_score: stock.strategy_score || stock.reversal_potential_score,
      risk_reward_ratio: stock.risk_reward_ratio,
      action: stock.action,
      analysis: stock.analysis,
      stock_data: stock,
      updated_at: now.toISOString()
    };
  });

  const { error } = await supabase
    .from('analyzed_stocks')
    .insert(rows);

  if (error) {
    console.error('[Supabase] Erro ao salvar ações analisadas:', error.message);
    return false;
  }
  return true;
}

export async function toggleFavoriteStatus(ticker: string, isFavorite: boolean): Promise<boolean> {
  if (!supabaseUrl) return false;
  
  const { error } = await supabase
    .from('analyzed_stocks')
    .update({ is_favorite: isFavorite })
    .eq('ticker', ticker.toUpperCase());

  if (error) {
    console.error('[Supabase] Erro ao alterar favorito:', error.message);
    return false;
  }
  return true;
}

export async function getFavoriteTickers(): Promise<string[]> {
  if (!supabaseUrl) return [];

  const { data, error } = await supabase
    .from('analyzed_stocks')
    .select('ticker')
    .eq('is_favorite', true);

  if (error) {
    console.error('[Supabase] Erro ao buscar favoritos:', error.message);
    return [];
  }

  return (data || []).map((d: any) => d.ticker);
}

export interface OperationData {
  invested_amount: number;
  shares_quantity: number;
  average_price: number;
  programmed_target: number;
  programmed_stop: number;
  investment_date: string;
  operation_status: string;
}

export async function saveOperation(id: string, op: OperationData): Promise<boolean> {
  if (!supabaseUrl) return false;
  
  const { error } = await supabase
    .from('analyzed_stocks')
    .update({
      invested_amount: op.invested_amount,
      shares_quantity: op.shares_quantity,
      average_price: op.average_price,
      programmed_target: op.programmed_target,
      programmed_stop: op.programmed_stop,
      investment_date: op.investment_date,
      operation_status: op.operation_status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Erro ao salvar operação:', error.message);
    return false;
  }
  return true;
}

export interface CloseOperationData {
  closing_price: number;
  closing_date: string;
  closing_reason: string;
  profit_loss: number;
  profit_loss_percentage: number;
}

export async function closeOperation(id: string, closeData: CloseOperationData): Promise<boolean> {
  if (!supabaseUrl) return false;

  const { error } = await supabase
    .from('analyzed_stocks')
    .update({
      operation_status: closeData.closing_reason === 'Cancelar Operação' ? 'CANCELADO' : (closeData.closing_reason === 'Alvo Atingido' ? 'ALVO ATINGIDO' : 'STOP ATINGIDO'),
      closing_price: closeData.closing_price,
      closing_date: closeData.closing_date,
      closing_reason: closeData.closing_reason,
      profit_loss: closeData.profit_loss,
      profit_loss_percentage: closeData.profit_loss_percentage,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Erro ao encerrar operação:', error.message);
    return false;
  }
  return true;
}

export async function getHistoricalIndications(tickers: string[]) {
  if (!supabaseUrl || tickers.length === 0) return {};

  const { data, error } = await supabase
    .from('analyzed_stocks')
    .select('ticker, created_at, indication_status, entry_price, target_price')
    .in('ticker', tickers)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) {
    console.error('[Supabase] Erro ao buscar histórico de indicações:', error?.message);
    return {};
  }

  // Agrupar por ticker e pegar as últimas 3
  const history: Record<string, any[]> = {};
  for (const row of data) {
    if (!history[row.ticker]) {
      history[row.ticker] = [];
    }
    if (history[row.ticker].length < 3) {
      history[row.ticker].push({
        date: new Date(row.created_at).toLocaleDateString('pt-BR'),
        status: row.indication_status,
        entry: row.entry_price,
        target: row.target_price
      });
    }
  }

  return history;
}
