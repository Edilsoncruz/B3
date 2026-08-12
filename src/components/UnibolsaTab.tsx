import { useState } from 'react';
import { Loader2, Activity, Database, Download, TrendingDown, TrendingUp, Minus, Filter, BrainCircuit, Target } from 'lucide-react';
import { applyDeterministicFilters, B3_FULL_CATALOG } from '../services/universeSelector';
import { getStockQuote, getStockStats, getFundamentals } from '../services/bolsai';
import { triageMarket } from '../services/openai';
import { StockCache } from '../lib/supabase';

interface RawStockData {
  ticker: string;
  price: number | null;
  week52Low: number | null;
  week52High: number | null;
  volume: number | null;
  pl: number | null;
  pvp: number | null;
  status: 'Queda' | 'Estável' | 'Alta' | 'N/A';
  recovery: 'Sim' | 'Não' | 'N/A';
  layer1Filter: string; // "Aprovado" ou motivo da rejeição
  layer2Triage: string; // "Selecionado", "Eliminado: motivo", ou pendente
}

interface FunnelMetrics {
  totalUniverse: number;
  evaluatedLayer1: number;
  falling: string[];
  stable: string[];
  rising: string[];
  recovering: string[];
  eliminatedL1: { ticker: string; reason: string }[];
  eliminatedL2: { ticker: string; reason: string }[];
  finalSelection: string[];
}

export function UnibolsaTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RawStockData[]>([]);
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });

  const calculateStatus = (price: number | null, high: number | null, low: number | null) => {
    if (!price || !high || !low) return { status: 'N/A' as const, recovery: 'N/A' as const };
    
    const dropFromHigh = ((high - price) / high) * 100;
    const riseFromLow = ((price - low) / low) * 100;

    let status: 'Queda' | 'Estável' | 'Alta' = 'Estável';
    if (dropFromHigh > 15) status = 'Queda';
    else if (price > high * 0.95) status = 'Alta';

    let recovery: 'Sim' | 'Não' = 'Não';
    // Considera "Sinal de recuperação" se caiu forte (>15%) mas já subiu pelo menos 5% do fundo
    if (status === 'Queda' && riseFromLow > 5) {
      recovery = 'Sim';
    }

    return { status, recovery };
  };

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setData([]);
    setMetrics(null);

    try {
      setProgress({ current: 0, total: B3_FULL_CATALOG.length, stage: 'Aplicando Filtros Determinísticos (Camada 1)...' });
      
      // 1. Aplica filtros da camada 1
      const { eligibleTickers, eliminatedDetails } = await applyDeterministicFilters(B3_FULL_CATALOG, {}, undefined, undefined);
      
      const newMetrics: FunnelMetrics = {
        totalUniverse: B3_FULL_CATALOG.length,
        evaluatedLayer1: eligibleTickers.length,
        falling: [],
        stable: [],
        rising: [],
        recovering: [],
        eliminatedL1: eliminatedDetails.map(e => ({ ticker: e.ticker, reason: e.reason || 'Filtro Base' })),
        eliminatedL2: [],
        finalSelection: []
      };

      const results: RawStockData[] = [];

      // Removida adição prévia das eliminadas. Iremos puxar dados vivos para TODOS (incluindo eliminadas).

      // 2. Busca dados vivos na API para TODOS os ativos do catálogo
      const chunkSize = 10;
      for (let i = 0; i < B3_FULL_CATALOG.length; i += chunkSize) {
        setProgress({ current: i, total: B3_FULL_CATALOG.length, stage: 'Buscando dados ao vivo (API Unibolsa)...' });
        const chunk = B3_FULL_CATALOG.slice(i, i + chunkSize);
        
        const chunkPromises = chunk.map(async (ticker) => {
          try {
            const [quote, stats, fundamentals] = await Promise.all([
              getStockQuote(ticker).catch(() => null),
              getStockStats(ticker).catch(() => null),
              getFundamentals(ticker).catch(() => null)
            ]);
            
            const price = quote?.close ?? stats?.close ?? null;
            const week52Low = stats?.week_52_low ?? fundamentals?.week_52_low ?? null;
            const week52High = stats?.week_52_high ?? fundamentals?.week_52_high ?? null;
            
            const { status, recovery } = calculateStatus(price, week52High, week52Low);
            
            if (status === 'Queda') newMetrics.falling.push(ticker);
            else if (status === 'Estável') newMetrics.stable.push(ticker);
            else if (status === 'Alta') newMetrics.rising.push(ticker);
            
            if (recovery === 'Sim') newMetrics.recovering.push(ticker);

            const layer1Filter = eliminatedDetails.find(e => e.ticker === ticker)
              ? `Eliminado: ${eliminatedDetails.find(e => e.ticker === ticker)?.reason}`
              : 'Aprovado';

            return {
              ticker,
              price,
              week52Low,
              week52High,
              volume: stats?.avg_volume_52w ?? fundamentals?.avg_volume_52w ?? null,
              pl: fundamentals?.pl ?? null,
              pvp: fundamentals?.pvp ?? null,
              status,
              recovery,
              layer1Filter,
              layer2Triage: 'N/A (Desativado)'
            };
          } catch (e) {
            return {
              ticker, price: null, week52Low: null, week52High: null, volume: null, pl: null, pvp: null,
              status: 'N/A' as const, recovery: 'N/A' as const, layer1Filter: eliminatedDetails.find(e => e.ticker === ticker) ? 'Eliminado' : 'Aprovado', layer2Triage: 'N/A'
            };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit protection
      }

      setMetrics(newMetrics);
      setData(results.sort((a,b) => a.ticker.localeCompare(b.ticker)));
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0, stage: '' });
    }
  };

  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = ["Ticker", "Preço", "Status", "Recuperação", "Mínima 52s", "Máxima 52s", "Volume Médio", "Filtro Camada 1"];
    const rows = data.map(d => [
      d.ticker, 
      d.price || '',
      d.status,
      d.recovery,
      d.week52Low || '', 
      d.week52High || '', 
      d.volume || '', 
      `"${d.layer1Filter}"`
    ].join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "funil_smartmoney_completo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-6 bg-[#151619] border-[#2a2b2f] shadow-xl">
          <Activity className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">Diagnóstico do Pipeline (Funil RAW)</h2>
        <p className="max-w-2xl mb-8 leading-relaxed text-sm text-[#8E9299]">
          Executa toda a lógica do sistema (Camada 1 e Camada 2) ao vivo, classificando Queda e Recuperação matematicamente, e mostrando <strong>exatamente o que foi eliminado e o porquê.</strong>
        </p>

        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Rodar Diagnóstico Completo
        </button>
        
        {loading && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="text-sm text-purple-300 font-bold bg-purple-900/30 px-4 py-1.5 rounded-full border border-purple-500/30">
              {progress.stage}
            </span>
            {progress.total > 1 && (
              <p className="text-xs text-purple-400 font-mono">Processado {progress.current} de {progress.total}</p>
            )}
          </div>
        )}
        
        {error && <p className="text-red-400 mt-4 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">{error}</p>}
      </div>

      {metrics && (
        <div className="mt-8 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#151619] border border-[#2a2b2f] rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">1. Universo B3 (Total)</span>
            <span className="text-3xl font-mono text-white">{metrics.totalUniverse}</span>
          </div>
          <div className="bg-[#151619] border border-[#2a2b2f] rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">2. Eliminadas na L1</span>
            <span className="text-3xl font-mono text-rose-500">{metrics.eliminatedL1.length}</span>
            <span className="text-[9px] text-gray-500 mt-1">Penny Stocks / S. Liquidez</span>
          </div>
          <div className="bg-[#151619] border border-[#2a2b2f] rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">3. Ativos Elegíveis (L1)</span>
            <span className="text-3xl font-mono text-blue-400">{metrics.evaluatedLayer1}</span>
          </div>
          <div className="bg-[#151619] border border-blue-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <BrainCircuit className="w-4 h-4 text-blue-400 mb-2" />
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">4. Sinais Recuperação</span>
            <span className="text-xl font-mono text-blue-400">{metrics.recovering.length}</span>
          </div>

          <div className="bg-[#151619] border border-red-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <TrendingDown className="w-4 h-4 text-red-400 mb-2" />
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">5. Em Queda (&gt;15%)</span>
            <span className="text-xl font-mono text-red-400">{metrics.falling.length}</span>
          </div>
          <div className="bg-[#151619] border border-[#2a2b2f] rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <Minus className="w-4 h-4 text-gray-400 mb-2" />
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">6. Estáveis</span>
            <span className="text-xl font-mono text-gray-300">{metrics.stable.length}</span>
          </div>
          <div className="bg-[#151619] border border-emerald-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-4 h-4 text-emerald-400 mb-2" />
            <span className="text-[10px] uppercase text-gray-400 font-bold mb-1">7. Em Alta (Próx. Máx)</span>
            <span className="text-xl font-mono text-emerald-400">{metrics.rising.length}</span>
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-400" />
              Detalhamento por Ativo ({data.length})
            </h3>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151619] border border-[#2a2b2f] rounded-lg text-xs hover:text-emerald-400 hover:border-emerald-500 transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV Completo
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#2a2b2f] bg-[#0a0a0a]">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#151619] text-[10px] uppercase text-gray-400 border-b border-[#2a2b2f] whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status Mercado</th>
                  <th className="px-4 py-3">Recuperação?</th>
                  <th className="px-4 py-3 max-w-[200px]">1ª Etapa (Filtros Determinísticos)</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {data.map(d => (
                  <tr key={d.ticker} className="border-b border-[#2a2b2f] hover:bg-[#151619]">
                    <td className="px-4 py-3 font-mono font-bold text-white">{d.ticker}</td>
                    <td className="px-4 py-3 font-mono">{d.price ? `R$ ${d.price.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        d.status === 'Queda' ? 'bg-red-500/20 text-red-400' :
                        d.status === 'Alta' ? 'bg-emerald-500/20 text-emerald-400' : 
                        d.status === 'Estável' ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.recovery === 'Sim' ? <span className="text-blue-400 font-bold text-[10px] px-2 py-1 bg-blue-500/20 rounded-full">SIM</span> : <span className="text-gray-500">-</span>}
                    </td>
                    <td className={`px-4 py-3 truncate max-w-[200px] ${d.layer1Filter === 'Aprovado' ? 'text-emerald-500' : 'text-rose-400'}`} title={d.layer1Filter}>
                      {d.layer1Filter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
