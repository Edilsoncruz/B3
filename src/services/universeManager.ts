/**
 * Gestor do Universo de Ações Monitoradas (SmartMoney Tracker Pro)
 * 
 * Esta arquitetura foi projetada para suportar a seleção DINÂMICA das ~50 ações monitoradas,
 * permitindo que a lista evolua automaticamente sem depender de uma lista estática.
 * 
 * Fontes e Critérios para a Seleção Dinâmica (Plano Pro):
 * 1. Análise da IA sobre dados da Usebolsa / Screener amplo de mercado.
 * 2. Análise de liquidez, volume financeiro médio (ADTV), volatilidade e participação no IBOV / IBrX-100.
 * 3. Rastreamento de fluxo institucional e interesse do mercado (Smart Money / Bottom Fishing).
 * 4. Atualização periódica automática da base de dados do Supabase.
 */

import { getAllCachedStocks, setCachedStock, StockCache } from '../lib/supabase';
import { getFundamentals, getStockQuote, getStockStats } from './bolsai';

// Universo base inicial de referência da B3 (diversificado por todos os setores)
export const DEFAULT_B3_UNIVERSE: string[] = [
  // Petróleo, Gás & Energia
  'PETR4', 'PRIO3', 'VBBR3', 'CSAN3', 'UGPA3',
  // Mineração, Siderurgia & Materiais Básicos
  'VALE3', 'GGBR4', 'CSNA3', 'USIM5', 'GOAU4',
  // Setor Financeiro & Bancos
  'ITUB4', 'BBDC4', 'BBAS3', 'SANB11', 'B3SA3', 'BPAC11', 'ITSA4',
  // Elétricas & Saneamento
  'ELET3', 'CPLE6', 'EQTL3', 'CMIG4', 'CPFE3', 'SBSP3', 'EGIE3', 'TAEE11', 'ENEV3',
  // Papel, Celulose & Agronegócio
  'SUZB3', 'KLBN11', 'SMTO3',
  // Consumo & Alimentos
  'ABEV3', 'JBSS3', 'BRFS3', 'BEEF3', 'MRFG3',
  // Varejo, Saúde & Farmacêutico
  'RADL3', 'LREN3', 'ASAI3', 'CRFB3', 'RDOR3', 'HAPV3', 'MGLU3',
  // Indústria, Logística & Infraestrutura
  'WEGE3', 'RENT3', 'EMBR3', 'CCRO3', 'RAIL3', 'AZUL4',
  // Telecomunicações, Tecnologia & Imobiliário
  'TIMS3', 'VIVT3', 'TOTS3', 'MULT3', 'CYRE3', 'COGN3'
];

export interface DynamicUniverseStrategy {
  strategyName: 'TOP_LIQUIDITY_IBOV' | 'AI_SMART_MONEY_RADAR' | 'VALUE_REVERSAL_SCAN' | 'SECTOR_BALANCED';
  targetSize: number;
  minLiquidityDaily?: number;
  sectors?: string[];
}

/**
 * Obtém a lista atual de tickers do universo monitorado.
 * Prioriza ações já registradas no Supabase; se o banco estiver vazio, usa a lista padrão.
 */
export async function getActiveMonitoredTickers(): Promise<string[]> {
  try {
    const cached = await getAllCachedStocks();
    if (cached.length > 0) {
      return cached.map(c => c.ticker);
    }
  } catch (err) {
    console.warn('[UniverseManager] Falha ao ler tickers do Supabase. Usando universo padrão.');
  }
  return DEFAULT_B3_UNIVERSE;
}

/**
 * Pipeline de Atualização Dinâmica do Universo (Plano Pro / Background Worker)
 * 
 * Permite que um processo automatizado ou a IA recalcule a lista de ações monitoradas
 * e sincronize seus dados fundamentalistas e de cotação com o Supabase.
 */
export async function syncUniverseDataToSupabase(tickers: string[]): Promise<{
  successCount: number;
  failedCount: number;
  errors: Record<string, string>;
}> {
  let successCount = 0;
  let failedCount = 0;
  const errors: Record<string, string> = {};

  console.log(`\n🔄 [UniverseManager] Sincronizando ${tickers.length} ações com o Supabase...`);

  for (const ticker of tickers) {
    try {
      const [quote, stats, fundamentals] = await Promise.all([
        getStockQuote(ticker).catch(() => null),
        getStockStats(ticker).catch(() => null),
        getFundamentals(ticker).catch(() => null)
      ]);

      const currentPrice = quote?.close ?? stats?.close ?? 0;
      if (!currentPrice && !fundamentals) {
        throw new Error(`Sem cotação ou fundamentos retornados para ${ticker}`);
      }

      const enrichedFundamentals = {
        ...(fundamentals ?? {}),
        week_52_low: stats?.week_52_low,
        week_52_high: stats?.week_52_high,
        daily_change_pct: stats?.daily_change_pct,
        ytd_return_pct: stats?.ytd_return_pct,
        avg_volume_52w: stats?.avg_volume_52w
      };

      await setCachedStock(ticker, currentPrice, enrichedFundamentals, {});
      successCount++;
      console.log(`  ✅ [UniverseManager] ${ticker} sincronizado.`);
    } catch (e: any) {
      failedCount++;
      errors[ticker] = e.message;
      console.warn(`  ⚠️ [UniverseManager] Falha ao sincronizar ${ticker}: ${e.message}`);
    }
  }

  console.log(`🏁 [UniverseManager] Sincronização concluída: ${successCount} sucessos, ${failedCount} falhas.`);
  return { successCount, failedCount, errors };
}
