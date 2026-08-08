import { supabase } from '../lib/supabase';
import { getStockQuote, getPriceHistory } from './bolsai';

export async function verifyOpenOperations(): Promise<{ total: number, updated: number, errors: number }> {
  const { data: openOps, error } = await supabase
    .from('analyzed_stocks')
    .select('*')
    .eq('indication_status', 'ABERTA');

  if (error) {
    console.error('[VerifyOps] Erro ao buscar indicações abertas:', error.message);
    throw new Error('Erro ao buscar indicações abertas: ' + error.message);
  }

  if (!openOps || openOps.length === 0) {
    return { total: 0, updated: 0, errors: 0 };
  }

  let updated = 0;
  let errors = 0;

  for (const op of openOps) {
    try {
      let newStatus = 'ABERTA';
      let hitDate = new Date().toISOString();
      let hasHit = false;

      // Data a partir da qual devemos verificar (limite de lookback)
      const lastCheck = new Date(op.last_verification_date || op.created_at);
      const daysDiff = Math.ceil((Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));
      
      // Busca a quantidade exata de dias úteis/corridos do gap (adicionando margem de +5 para fins de semana/feriados)
      const limit = Math.max(1, daysDiff + 5);

      // 1. Verificar histórico diário (OHLCV)
      try {
        const historyData = await getPriceHistory(op.ticker, limit);
        
        // Formato esperado do historyData depende da API, assumindo um array de candles { date, high, low, close }
        // Se a API retornar dentro de uma propriedade (ex: data ou results), ajuste de acordo.
        const candles = Array.isArray(historyData) ? historyData : (historyData.results || historyData.data || []);
        
        // Ordena cronologicamente (do mais antigo pro mais novo)
        const sortedCandles = [...candles].sort((a, b) => new Date(a.date || a.timestamp).getTime() - new Date(b.date || b.timestamp).getTime());

        for (const candle of sortedCandles) {
          const candleDate = new Date(candle.date || candle.timestamp);
          // Só olha candles do dia da última checagem em diante
          if (candleDate >= lastCheck) {
            const high = candle.high || candle.close;
            const low = candle.low || candle.close;
            
            // Verifica o stop primeiro (mais conservador)
            if (op.stop_loss && low <= op.stop_loss) {
              newStatus = 'PERDA';
              hitDate = candleDate.toISOString();
              hasHit = true;
              break; // Encerra a verificação desta operação
            }
            
            // Verifica o alvo
            if (op.target_price && high >= op.target_price) {
              newStatus = 'LUCRO';
              hitDate = candleDate.toISOString();
              hasHit = true;
              break; // Encerra a verificação
            }
          }
        }
      } catch (histErr) {
        console.warn(`[VerifyOps] Não foi possível buscar histórico para ${op.ticker}, usando apenas cotação atual.`, histErr);
      }

      // 2. Se não bateu no histórico (ou histórico falhou), verifica a cotação em tempo real de hoje
      if (!hasHit) {
        const quoteData = await getStockQuote(op.ticker);
        const currentPrice = quoteData.close || quoteData.price || quoteData.current_price;
        
        if (currentPrice) {
          if (op.stop_loss && currentPrice <= op.stop_loss) {
            newStatus = 'PERDA';
            hitDate = new Date().toISOString();
          } else if (op.target_price && currentPrice >= op.target_price) {
            newStatus = 'LUCRO';
            hitDate = new Date().toISOString();
          }
        }
      }

      // Se o status mudou ou se apenas fizemos uma checagem de rotina
      const { error: updateError } = await supabase
        .from('analyzed_stocks')
        .update({
          indication_status: newStatus,
          last_verification_date: hitDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', op.id);

      if (updateError) throw updateError;
      
      updated++;
    } catch (err: any) {
      console.error(`[VerifyOps] Erro ao verificar ${op.ticker}:`, err.message);
      errors++;
    }
  }

  return { total: openOps.length, updated, errors };
}
