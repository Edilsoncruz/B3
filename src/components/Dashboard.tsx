import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, Loader2, BarChart2, AlertCircle, RefreshCw, Download, 
  ChevronDown, BrainCircuit, Code, CheckCircle2, XCircle, ShieldCheck, 
  History, Zap, Database, SlidersHorizontal, ArrowRight, Activity, TrendingDown,
  BookOpen, Sparkles, PieChart, Info, Calculator
} from "lucide-react";
import { analyzeMarket, AIRecommendation } from '../services/openai';
import { getMarketCandidates, MarketCandidatesResult } from '../services/marketData';
import { StockCard } from "./StockCard";
import { calculatePortfolioDistribution } from "../utils/portfolio";
import { DEFAULT_SELECTION_PARAMS, SelectionParameters } from "../services/universeSelector";
import { KnowledgeBaseDrawer } from "./KnowledgeBaseDrawer";
import { saveAnalyzedStocks, getHistoricalIndications } from "../lib/supabase";
import { verifyOpenOperations } from "../services/operationsManager";
import { AuditManager } from "../services/auditManager";
import { generateAuditPDF } from "../utils/AuditPDFGenerator";
import { HistoryTab } from "./HistoryTab";

export function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIRecommendation | null>(null);
  const [recommendationCount, setRecommendationCount] = useState(5);
  const [scannedCount, setScannedCount] = useState(0);
  const [specificTicker, setSpecificTicker] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState(500);
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(false);
  const [forceEqualInclusion, setForceEqualInclusion] = useState(true);
  const [deepAnalysis, setDeepAnalysis] = useState(false);
  const [isBacktestMode, setIsBacktestMode] = useState(false);
  const [backtestDate, setBacktestDate] = useState("2024-06-01");
  const [targetPeriodValue, setTargetPeriodValue] = useState(2);
  const [targetPeriodUnit, setTargetPeriodUnit] = useState("meses");
  
  // Controle de Parâmetros de Seleção (Etapa 2)
  const [showFilters, setShowFilters] = useState(false);
  const [poolSize, setPoolSize] = useState(50);
  const [selectionParams, setSelectionParams] = useState<SelectionParameters>(DEFAULT_SELECTION_PARAMS);

  // Audit Mode
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [lastAuditId, setLastAuditId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'ANALISE' | 'HISTORICO'>('ANALISE');

  // Controle do Drawer da Base de Conhecimento
  const [isKnowledgeDrawerOpen, setIsKnowledgeDrawerOpen] = useState(false);
  const [isVerifyingOps, setIsVerifyingOps] = useState(false);

  const handleVerifyOps = async () => {
    setIsVerifyingOps(true);
    try {
      const res = await verifyOpenOperations();
      alert(`Verificação concluída: ${res.updated} indicações atualizadas de um total de ${res.total} abertas. (Erros: ${res.errors})`);
    } catch (err: any) {
      alert("Erro ao verificar indicações: " + err.message);
    } finally {
      setIsVerifyingOps(false);
    }
  };

  // Status de Progresso do Pipeline em Tempo Real
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [pipelineStats, setPipelineStats] = useState<{
    universeCount: number;
    poolSize: number;
    cacheHits: number;
    apiFetches: number;
    executionTimeMs: number;
  } | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const market = specificTicker.trim() ? `B3 (${specificTicker.trim()})` : "B3";

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setPipelineStats(null);
    const startTime = performance.now();

    try {
      const auditManager = new AuditManager(isAuditMode);
      setLastAuditId(isAuditMode ? auditManager.getAuditId() : null);

      if (auditManager.isEnabled()) {
        await auditManager.startRun({
          strategy: 'Smart Money Bottom Fishing',
          strategyVersion: '1.0',
          analysisMode: specificTicker.trim() ? 'Ticker Específico' : 'Varredura Dinâmica',
          poolSize: specificTicker.trim() ? 1 : poolSize,
          recommendationCount,
          targetPeriodValue,
          targetPeriodUnit,
          selectionParams
        });
      }

      // ETAPA 1 & 2: Universo Inicial & Seleção Inteligente
      setCurrentStep(1);
      setProgressMsg("Etapa 1 & 2: Mapeando universo amplo da B3 e executando Seleção Inteligente...");

      const candidatesResult: MarketCandidatesResult = await getMarketCandidates({
        poolSize: specificTicker.trim() ? 1 : poolSize,
        specificTicker: specificTicker.trim() || undefined,
        selectionParams: {
          ...selectionParams,
          poolSize: specificTicker.trim() ? 1 : poolSize
        },
        auditManager,
        onProgress: (p) => {
          setCurrentStep(3);
          setProgressMsg(`Etapa 3 & 4: Verificando Supabase (${p.current}/${p.total}) - ${p.message}`);
        }
      });

      const candidates = candidatesResult.candidates;
      setScannedCount(candidates.length);

      // ETAPA 3: Execução da Análise Profunda (Terra)
      setCurrentStep(3);
      setProgressMsg(`Etapa 3: Consultando Base de Conhecimento e executando Análise Profunda (Terra) sobre ${candidates.length} ativos...`);

      const riskStr = deepAnalysis ? "Agressivo (Bottom Fishing Profundo)" : "Moderado (Value Investing)";
      const execDate = isBacktestMode ? new Date(backtestDate) : new Date();

      const candidateTickers = candidates.map(c => c.ticker);
      const historicalIndications = await getHistoricalIndications(candidateTickers);

      const result = await analyzeMarket(
        investmentAmount,
        riskStr,
        candidates,
        historicalIndications,
        recommendationCount,
        targetPeriodValue,
        targetPeriodUnit,
        execDate,
        deepAnalysis
      );

      // ETAPA 4: Revisão Especializada (Sol) - Apenas se Análise Profunda = ON
      if (!deepAnalysis && result && result.ranked_stocks) {
         // Fluxo normal: pega apenas as N primeiras do ranking gerado pelo Terra
         result.ranked_stocks = result.ranked_stocks.slice(0, recommendationCount);
      } else if (deepAnalysis && result && result.ranked_stocks) {
        setCurrentStep(4);
        const { reviewIndications } = await import('../services/openai');
        
        const allStocks = result.ranked_stocks;
        const maxEvaluations = recommendationCount * 2;
        let evaluatedCount = 0;
        let currentIndex = 0;
        let aprovadas: any[] = [];
        let rejeitadasLog: any[] = [];
        let ressalvasCount = 0;

        while (aprovadas.length < recommendationCount && evaluatedCount < maxEvaluations && currentIndex < allStocks.length) {
           const faltam = recommendationCount - aprovadas.length;
           // Lote exato do que falta aprovar, limitado pelo que ainda podemos avaliar
           const maxNesteLote = Math.min(faltam, maxEvaluations - evaluatedCount);
           const lote = allStocks.slice(currentIndex, currentIndex + maxNesteLote);
           
           if (lote.length === 0) break;
           
           setProgressMsg(`Etapa 4: Sol avaliando candidatas ${currentIndex + 1} a ${currentIndex + lote.length}...`);
           
           try {
             const reviews = await reviewIndications(lote, "Contexto Estratégia B3");
             evaluatedCount += lote.length;
             currentIndex += lote.length;

             reviews.forEach(review => {
               const stock = lote.find(s => s.ticker === review.ticker);
               if (!stock) return;

               if (review.decisao === "REJEITADA") {
                 rejeitadasLog.push({
                   ticker: review.ticker,
                   motivo: review.motivo_estruturado,
                   scoreTerra: stock.strategy_score,
                   probTerra: stock.success_probability
                 });
               } else {
                 // APROVADA ou APROVADA_COM_RESSALVAS
                 stock.success_probability = review.probabilidade_revisada || stock.success_probability;
                 stock.strategy_score = review.score_revisado || stock.strategy_score;
                 stock.reversal_potential_score = review.score_revisado || stock.reversal_potential_score;
                 
                 let prefix = review.decisao === "APROVADA_COM_RESSALVAS" 
                               ? `[APROVADA COM RESSALVAS]\n${review.motivo_estruturado}\n\n---\n` 
                               : `[APROVADA PELO SOL]\n\n---\n`;
                 
                 stock.analysis = prefix + stock.analysis;
                 if (review.decisao === "APROVADA_COM_RESSALVAS") ressalvasCount++;
                 
                 aprovadas.push(stock);
               }
             });
           } catch (err: any) {
              console.error("Erro na Revisão Sol (Lote):", err);
              alert("Falha na revisão profunda (Sol). O sistema continuará com o resultado original da Análise Terra para as vagas restantes.");
              const faltamAg = recommendationCount - aprovadas.length;
              aprovadas.push(...allStocks.slice(currentIndex, currentIndex + faltamAg));
              break;
           }
        }

        if (auditManager.isEnabled()) {
           await auditManager.logEvent('LAYER_4', 'REVIEW_COMPLETED', 'ALL', 'Revisão Sol concluída', 0, { 
             solicitadas: recommendationCount,
             avaliadas: evaluatedCount,
             aprovadas: aprovadas.length,
             ressalvas: ressalvasCount,
             rejeitadas: rejeitadasLog
           });
        }

        result.ranked_stocks = aprovadas;
      }

      // Sincronização da Base de Conhecimento (Executada APÓS o Sol para não registrar insights de ações rejeitadas)
      if (result && result.knowledge_base) {
         try {
           const { processPostAnalysisKnowledge } = await import('../services/knowledgeBase');
           
           const validTickers = result.ranked_stocks.map(s => s.ticker);
           const validInsights = (result.knowledge_base.new_insights || []).filter((insight: any) => {
             // O Terra inclui o Ticker na primeira tag do insight
             const mentionsTicker = insight.tags.find((t: string) => t === t.toUpperCase() && t.length >= 4 && t.length <= 6 && !["VOLUME", "FILTRO"].includes(t));
             if (mentionsTicker && !validTickers.includes(mentionsTicker)) {
                return false; // Rejeitado pelo Sol, então descartamos o insight
             }
             return true;
           });

           const syncResult = await processPostAnalysisKnowledge({
             confirmedIds: result.knowledge_base.confirmed_ids || [],
             newInsights: validInsights,
             strategy: 'Smart Money Bottom Fishing'
           });
           console.log(`[KnowledgeBase] 🧠 Sincronização Supabase concluída: ${syncResult.confirmedCount} confirmações, ${syncResult.newCount} novos registros salvos.`);
         } catch (err) {
           console.warn('[KnowledgeBase] Erro ao sincronizar aprendizado:', err);
         }
      }

      const endTime = performance.now();
      setPipelineStats({
        universeCount: candidatesResult.syncStats.totalUniverseCount,
        poolSize: candidatesResult.syncStats.selectedPoolSize,
        cacheHits: candidatesResult.syncStats.cacheHitCount,
        apiFetches: candidatesResult.syncStats.apiFetchCount,
        executionTimeMs: Math.round(endTime - startTime)
      });

      // Generate ID for each analyzed stock to link operations precisely
      if (result && result.ranked_stocks) {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-');
        result.ranked_stocks = result.ranked_stocks.map(stock => {
          const tck = (stock.ticker || 'B3').toUpperCase();
          return {
            ...stock,
            id: `${tck}_${dateStr}`
          };
        });

        saveAnalyzedStocks(result.ranked_stocks).catch(err => {
          console.error("Failed to save analyzed stocks:", err);
        });

        if (auditManager.isEnabled()) {
          await auditManager.logResults(result.ranked_stocks);
          await auditManager.finishRun({
            totalExecutionTimeMs: Math.round(endTime - startTime),
            totalTokens: result.token_usage?.total_tokens || 0,
            promptTokens: result.token_usage?.prompt_tokens || 0,
            responseTokens: result.token_usage?.completion_tokens || 0
          });
        }
      }

      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao conectar com a IA ou base de dados. Tente novamente.");
    } finally {
      setLoading(false);
      setCurrentStep(0);
      setProgressMsg("");
    }
  };

  const exportToCSV = () => {
    if (!data || !data.ranked_stocks) return;

    const headers = [
      "Ticker",
      "Empresa",
      "Preço Entrada ($)",
      "Preço Atual ($)",
      "Queda (%)",
      "Score Estratégia",
      "Probabilidade Sucesso (%)",
      "Tempo Estimado",
      "Nível Suporte ($)",
      "Stop Loss ($)",
      "Risco Stop (%)",
      "Relação Risco/Retorno",
      "Gatilho de Saída",
      "Preço Alvo ($)",
      "Sinais Smart Money",
      "Análise"
    ];

    const csvRows = [
      headers.join(","),
      ...data.ranked_stocks.map(stock => {
        return [
          stock.ticker,
          `"${stock.company_name}"`,
          stock.entry_price || stock.current_price,
          stock.current_price,
          stock.drop_percentage,
          stock.strategy_score || stock.reversal_potential_score,
          stock.success_probability || 85,
          `"${stock.estimated_timeframe || stock.estimated_target_date}"`,
          stock.support_level,
          stock.stop_loss || (stock.support_level * 0.96).toFixed(2),
          stock.stop_loss_percentage || (((stock.current_price - (stock.stop_loss || stock.support_level * 0.96)) / stock.current_price) * 100).toFixed(2),
          stock.risk_reward_ratio ? `1:${stock.risk_reward_ratio}` : "N/A",
          `"${(stock.invalidation_trigger || '').replace(/"/g, '""')}"`,
          stock.target_price,
          `"${stock.smart_money_signals.join("; ")}"`,
          `"${stock.analysis.replace(/"/g, '""')}"`
        ].join(",");
      })
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smartmoney_${market.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToHTML = () => {
    if (!reportRef.current) return;
    
    const reportHtml = reportRef.current.innerHTML;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório SmartMoney Tracker - ${market}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { background-color: #050505; color: white; font-family: ui-sans-serif, system-ui, sans-serif; padding: 2rem; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        </style>
      </head>
      <body>
        <div class="max-w-6xl mx-auto">
          ${reportHtml}
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartmoney_${market.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-emerald-500/30 bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1b1f] bg-[#0a0a0a]/80 sticky top-0 z-50 print:hidden backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SmartMoney Tracker AI</h1>
              <p className="text-[10px] uppercase tracking-widest font-mono text-[#8E9299]">Fluxo Inteligente em 5 Etapas</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Verificar Indicações */}
            <button 
              onClick={handleVerifyOps}
              disabled={isVerifyingOps}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/20 transition-colors disabled:opacity-50"
            >
              {isVerifyingOps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Verificar Indicações
            </button>
            
            {/* Grupo 1: Busca e configurações */}
            {/* Specific Ticker */}
            <div className="relative hidden lg:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9299]" />
              <input 
                type="text"
                value={specificTicker}
                onChange={(e) => setSpecificTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (ex: PETR4)"
                className="rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none w-36 transition-all border bg-[#151619] border-[#2a2b2f] text-white focus:border-emerald-500/50"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
            </div>

            {/* Qtd Recomendações */}
            <div className="relative hidden md:block">
              <input 
                type="number"
                min="1"
                max="20"
                value={recommendationCount}
                onChange={(e) => setRecommendationCount(parseInt(e.target.value) || 5)}
                className="rounded-full py-1.5 px-3 text-sm focus:outline-none w-14 transition-all border bg-[#151619] border-[#2a2b2f] text-white focus:border-emerald-500/50 text-center"
              />
              <span className="absolute -top-4 left-1 text-[8px] uppercase tracking-widest text-[#8E9299]">Qtd Rec.</span>
            </div>

            {/* Target Period */}
            <div className="relative hidden md:flex items-center">
              <input 
                type="number"
                min="1"
                max="365"
                value={targetPeriodValue}
                onChange={(e) => setTargetPeriodValue(parseInt(e.target.value) || 2)}
                className="rounded-l-full py-1.5 pl-3 pr-1 text-sm focus:outline-none w-12 transition-all border-y border-l border-r-0 bg-[#151619] border-[#2a2b2f] text-white focus:border-emerald-500/50 text-center"
              />
              <select
                value={targetPeriodUnit}
                onChange={(e) => setTargetPeriodUnit(e.target.value)}
                className="appearance-none rounded-r-full py-1.5 pl-1 pr-5 text-sm focus:outline-none w-20 transition-all border-y border-r border-l-0 cursor-pointer bg-[#151619] border-[#2a2b2f] text-white focus:border-emerald-500/50"
              >
                <option value="dias">Dias</option>
                <option value="semanas">Semanas</option>
                <option value="meses">Meses</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8E9299]" />
              <span className="absolute -top-4 left-1 text-[8px] uppercase tracking-widest whitespace-nowrap text-[#8E9299]">Tempo Alvo</span>
            </div>

            {/* Separador visual */}
            <div className="hidden md:block w-px h-5 bg-[#2a2b2f]" />

            {/* Grupo 2: Modos especiais agrupados — M07 */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-[#2a2b2f] bg-[#0d0d0f]">
              {/* Base de Conhecimento — M01: apenas um botão (duplicata removida) */}
              <button
                onClick={() => setIsKnowledgeDrawerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer"
                title="Acessar Memória Estratégica da Base de Conhecimento"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden lg:inline">Base de Conhecimento</span>
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  showFilters 
                    ? "bg-blue-600 text-white font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
                title="Ajustar pesos e critérios da Seleção Inteligente"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Critérios</span>
              </button>

              <button
                onClick={() => setIsSimulationEnabled(!isSimulationEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isSimulationEnabled 
                    ? "bg-emerald-500 text-black font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Simulador</span>
              </button>

              <button
                onClick={() => setIsBacktestMode(!isBacktestMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isBacktestMode 
                    ? "bg-amber-500 text-black font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Backteste</span>
              </button>

              <button
                onClick={() => setIsBacktestMode(!isBacktestMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isBacktestMode 
                    ? "bg-amber-500 text-black font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Backteste</span>
              </button>

              <button
                onClick={() => setIsAuditMode(!isAuditMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isAuditMode 
                    ? "bg-rose-600 text-white font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
                title="Modo Auditoria: Grava logs detalhados de toda a execução para análise posterior."
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Auditoria</span>
              </button>

              <button
                onClick={() => setDeepAnalysis(!deepAnalysis)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  deepAnalysis 
                    ? "bg-purple-600 text-white font-bold" 
                    : "text-[#8E9299] hover:text-white hover:bg-[#1e1f23]"
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Análise Profunda</span>
              </button>
            </div>

            {/* Grupo 3: Ação principal */}
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/5 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analisar
            </button>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-6 mt-4">
          <button
            onClick={() => setActiveTab('ANALISE')}
            className={`pb-2 border-b-2 font-semibold text-sm transition-colors cursor-pointer ${activeTab === 'ANALISE' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-[#8E9299] hover:text-white'}`}
          >
            Análise Dinâmica
          </button>
          <button
            onClick={() => setActiveTab('HISTORICO')}
            className={`pb-2 border-b-2 font-semibold text-sm transition-colors cursor-pointer ${activeTab === 'HISTORICO' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8E9299] hover:text-white'}`}
          >
            Histórico
          </button>
        </div>
      </header>

      {/* Drawer da Base de Conhecimento */}
      <KnowledgeBaseDrawer 
        isOpen={isKnowledgeDrawerOpen} 
        onClose={() => setIsKnowledgeDrawerOpen(false)} 
      />

      {/* Critérios de Seleção Inteligente Bar */}
      <AnimatePresence>
        {activeTab === 'ANALISE' && showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b overflow-hidden print:hidden border-blue-500/20 bg-blue-500/5 text-white"
          >
            <div className="max-w-6xl mx-auto px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                    Etapa 2: Parâmetros & Pesos da Seleção Inteligente
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">Universo: ~1.000 ativos da B3</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2b2f]">
                  <label className="text-[10px] uppercase text-[#8E9299] block mb-1">Pool Monitorado</label>
                  <input 
                    type="number" 
                    min="10" 
                    max="100" 
                    value={poolSize} 
                    onChange={(e) => setPoolSize(parseInt(e.target.value) || 50)}
                    className="w-full bg-transparent font-mono font-bold text-sm text-white focus:outline-none"
                  />
                  <span className="text-[9px] text-[#8E9299]">ativos selecionados</span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2b2f]">
                  <label className="text-[10px] uppercase text-[#8E9299] block mb-1">Peso Queda (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={selectionParams.dropWeight} 
                    onChange={(e) => setSelectionParams({ ...selectionParams, dropWeight: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent font-mono font-bold text-sm text-emerald-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-[#8E9299]">desconto 52 sem.</span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2b2f]">
                  <label className="text-[10px] uppercase text-[#8E9299] block mb-1">Peso Volume (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={selectionParams.volumeWeight} 
                    onChange={(e) => setSelectionParams({ ...selectionParams, volumeWeight: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent font-mono font-bold text-sm text-blue-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-[#8E9299]">fluxo institucional</span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2b2f]">
                  <label className="text-[10px] uppercase text-[#8E9299] block mb-1">Peso Fundamentos (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={selectionParams.fundamentalsWeight} 
                    onChange={(e) => setSelectionParams({ ...selectionParams, fundamentalsWeight: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent font-mono font-bold text-sm text-purple-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-[#8E9299]">P/L, ROE, P/VP</span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2b2f]">
                  <label className="text-[10px] uppercase text-[#8E9299] block mb-1">Peso Suporte (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={selectionParams.supportWeight} 
                    onChange={(e) => setSelectionParams({ ...selectionParams, supportWeight: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent font-mono font-bold text-sm text-amber-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-[#8E9299]">proximidade mínimas</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulator Settings Bar */}
      {activeTab === 'ANALISE' && isSimulationEnabled && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-b overflow-hidden print:hidden border-emerald-500/10 bg-emerald-500/5 text-white"
        >
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">Valor para Investir:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-emerald-400">R$</span>
                  <input 
                    type="number" 
                    value={investmentAmount} 
                    onChange={(e) => setInvestmentAmount(parseFloat(e.target.value) || 0)}
                    className="rounded-lg py-1 pl-8 pr-3 text-sm font-mono font-bold focus:outline-none w-32 transition-all border bg-[#0a0a0a] border-emerald-500/30 text-white focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="h-4 w-px hidden sm:block bg-emerald-500/20" />
              <label className="flex items-center gap-2 cursor-pointer border px-3 py-1 rounded-lg transition-all bg-[#0a0a0a]/80 border-emerald-500/30 hover:border-emerald-500/60">
                <input 
                  type="checkbox" 
                  checked={forceEqualInclusion} 
                  onChange={(e) => setForceEqualInclusion(e.target.checked)}
                  className="rounded border-emerald-500/50 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-emerald-400">Garantir 1 cota por ativo antes de distribuir saldo</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-400 font-bold">Simulação Ativa</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Backtest Settings Bar */}
      {activeTab === 'ANALISE' && isBacktestMode && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-b overflow-hidden print:hidden border-amber-500/20 bg-amber-500/5 text-white"
        >
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-bold text-amber-400">Data Histórica do Backteste:</span>
                <input 
                  type="date" 
                  value={backtestDate} 
                  onChange={(e) => setBacktestDate(e.target.value)}
                  className="rounded-lg py-1 px-3 text-sm font-mono font-bold focus:outline-none transition-all border bg-[#0a0a0a] border-amber-500/30 text-white focus:border-amber-500 cursor-pointer"
                />
              </div>
              <div className="h-4 w-px hidden sm:block bg-amber-500/20" />
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Modo Backteste:</strong> A IA analisará o mercado como se fosse <strong className="text-white">{backtestDate || "a data selecionada"}</strong>.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      {activeTab === 'HISTORICO' ? (
        <HistoryTab />
      ) : (
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Empty State */}
        {!data && !loading && !error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center print:hidden"
          >
            <div className="w-20 h-20 rounded-2xl border flex items-center justify-center mb-6 bg-[#151619] border-[#2a2b2f] shadow-xl">
              <Database className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Fluxo Inteligente com Memória Estratégica</h2>
            <p className="max-w-lg mb-8 leading-relaxed text-sm text-[#8E9299]">
              Triagem inteligente em catálogo amplo da B3 (~1.000 ativos), sincronização incremental de dados no Supabase e IA com Base de Conhecimento evolutiva.
            </p>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8 text-left">
              <div className="p-4 rounded-xl border bg-[#151619] border-[#2a2b2f]">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase mb-1">
                  <span>1. Seleção Inteligente</span>
                </div>
                <p className="text-[11px] text-gray-400">Triagem dinâmica por queda, volume e fundamentos sem baixar histórico desnecessário.</p>
              </div>

              <div className="p-4 rounded-xl border bg-[#151619] border-[#2a2b2f]">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase mb-1">
                  <span>2. Sync Supabase</span>
                </div>
                <p className="text-[11px] text-gray-400">Checagem individual: zero requisições para ativos já atualizados.</p>
              </div>

              <div className="p-4 rounded-xl border bg-[#151619] border-[#2a2b2f]">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase mb-1">
                  <span>3. IA & Base de Conhecimento</span>
                </div>
                <p className="text-[11px] text-gray-400">Aplicação de padrões históricos e aprendizado contínuo de novos insights.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Search className="w-4 h-4" />
                Iniciar Varredura Inteligente (Top {poolSize} Ações)
              </button>

              {lastAuditId && isAuditMode && !loading && !error && (
                <button
                  onClick={() => generateAuditPDF(lastAuditId)}
                  className="flex items-center gap-2 px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer mt-2"
                >
                  <Download className="w-4 h-4" />
                  Gerar Relatório de Auditoria PDF
                </button>
              )}

              <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                <span className="text-xs text-[#8E9299] mr-1">Atalhos rápidos:</span>
                {["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3", "RENT3"].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setSpecificTicker(t);
                    }}
                    className="px-3 py-1 rounded-full bg-[#151619] border border-[#2a2b2f] text-xs font-mono text-[#8E9299] hover:text-emerald-400 hover:border-emerald-500/40 transition-all cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State with Real-Time Stages */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 max-w-xl mx-auto text-center">
            <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
              <Loader2 className="w-14 h-14 text-emerald-500 animate-spin" />
            </div>
            
            <h2 className="text-lg font-bold mb-2 text-white">
              Executando Pipeline Inteligente
            </h2>
            <p className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 max-w-md">
              {progressMsg || "Processando dados do mercado..."}
            </p>

            {/* Visual Step Progress */}
            <div className="flex items-center gap-2 mt-8 text-xs">
              <div className={`px-3 py-1 rounded-full border ${currentStep >= 1 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold' : 'border-[#2a2b2f] text-[#8E9299]'}`}>
                1. Triagem
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#8E9299]" />
              <div className={`px-3 py-1 rounded-full border ${currentStep >= 3 ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold' : 'border-[#2a2b2f] text-[#8E9299]'}`}>
                2. Supabase Sync
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#8E9299]" />
              <div className={`px-3 py-1 rounded-full border ${currentStep >= 5 ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold' : 'border-[#2a2b2f] text-[#8E9299]'}`}>
                3. IA + Conhecimento
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-4 max-w-2xl mx-auto"
          >
            <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium mb-1">Erro no Processamento</h3>
              <p className="text-red-400/80 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {data && !loading && (() => {
          const simulationResult = isSimulationEnabled && data.ranked_stocks
            ? calculatePortfolioDistribution(data.ranked_stocks, investmentAmount, { forceEqualInclusion })
            : null;

          return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
            ref={reportRef}
          >

            {/* AI Recommendation Summary */}
            {lastAuditId && isAuditMode && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => generateAuditPDF(lastAuditId)}
                  className="flex items-center gap-2 px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Gerar Relatório de Auditoria PDF
                </button>
              </div>
            )}

            {isSimulationEnabled && data.ai_recommendation && simulationResult && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-6 bg-gradient-to-br from-[#0a0b0d] to-[#151619] border-emerald-500/20"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <PieChart className="w-32 h-32 text-emerald-500" />
                </div>
                
                <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                  <div className="lg:w-1/3 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Sparkles className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Simulador de Alocação</h2>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">Distribuição em Tempo Real</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border bg-[#050505] border-[#2a2b2f]">
                        <span className="text-[10px] uppercase tracking-widest block mb-1 text-[#8E9299]">Retorno Est.</span>
                        <span className="text-lg font-mono font-bold text-emerald-400">+{simulationResult.totalExpectedReturnPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="p-3 rounded-xl border bg-[#050505] border-[#2a2b2f]">
                        <span className="text-[10px] uppercase tracking-widest block mb-1 text-[#8E9299]">Lucro Estimado</span>
                        <span className="text-lg font-mono font-bold text-emerald-400">+R$ {simulationResult.totalExpectedProfit.toFixed(2)}</span>
                      </div>
                      <div className="p-3 rounded-xl border bg-[#050505] border-[#2a2b2f]">
                        <span className="text-[10px] uppercase tracking-widest block mb-1 text-[#8E9299]">Investido</span>
                        <span className="text-lg font-mono font-bold text-white">R$ {simulationResult.totalInvested.toFixed(2)}</span>
                      </div>
                      <div className="p-3 rounded-xl border bg-[#050505] border-[#2a2b2f]">
                        <span className="text-[10px] uppercase tracking-widest block mb-1 text-[#8E9299]">Caixa Restante</span>
                        <span className="text-lg font-mono font-bold text-[#8E9299]">R$ {simulationResult.remainingCash.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl space-y-2 border bg-emerald-500/5 border-emerald-500/10">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Resumo Executivo da IA</span>
                      </div>
                      <p className="text-xs leading-relaxed italic text-gray-300">
                        "{data.ai_recommendation.summary}"
                      </p>
                    </div>
                  </div>

                  <div className="lg:w-2/3 space-y-6">
                    {data.ranked_stocks.length === 0 ? (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm text-center col-span-full">
                        Nenhuma oportunidade foi encontrada pela IA com os filtros atuais.
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h3 className="text-xs uppercase tracking-widest flex items-center gap-2 font-bold text-[#8E9299]">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 
                              Ações Incluídas no Investimento ({simulationResult.allocations.length} de {data.ranked_stocks.length})
                            </h3>
                            <span className="text-xs font-mono text-emerald-400 font-bold">
                              Total Alocado: R$ {simulationResult.totalInvested.toFixed(2)}
                            </span>
                          </div>

                          {simulationResult.allocations.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {simulationResult.allocations.map((alloc, idx) => (
                                <div key={idx} className="p-3.5 rounded-xl border transition-colors bg-[#050505]/70 border-emerald-500/30 hover:border-emerald-500/60">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base font-bold font-mono text-white">{alloc.ticker}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">{alloc.percentage}%</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-mono font-bold text-emerald-400">R$ {alloc.amount_to_invest.toFixed(2)}</div>
                                      <div className="text-[10px] text-[#8E9299]">{alloc.shares_to_buy} cota(s)</div>
                                    </div>
                                  </div>
                                  <div className="text-[11px] leading-tight mb-2 text-gray-300">
                                    {alloc.reasoning}
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-[#2a2b2f]">
                                    <span className="text-[10px] uppercase text-[#8E9299]">Lucro Projetado</span>
                                    <span className="text-xs font-mono font-bold text-emerald-400">+R$ {alloc.expected_profit.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs text-center">
                              Nenhuma ação pôde ser comprada com R$ {investmentAmount.toFixed(2)}. O valor das cotas individuais é superior ao capital informado.
                            </div>
                          )}
                        </div>

                        {/* Excluded Actions Section */}
                        {simulationResult.excludedAllocations.length > 0 && (
                          <div className="pt-4 border-t border-[#2a2b2f]">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <h3 className="text-xs uppercase tracking-widest text-amber-500 font-bold flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-amber-500" /> 
                                Ações Excluídas do Investimento ({simulationResult.excludedAllocations.length} de {data.ranked_stocks.length})
                              </h3>
                              <span className="text-[10px] font-mono text-amber-400">
                                Limitação: Saldo insuficiente para 1 cota
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {simulationResult.excludedAllocations.map((ex, idx) => (
                                <div key={idx} className="p-3 rounded-xl border bg-[#050505]/40 border-amber-500/20">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold font-mono text-amber-400">{ex.ticker}</span>
                                    <span className="text-xs font-mono text-gray-300">Preço: <strong className="text-white">R$ {ex.current_price.toFixed(2)}</strong></span>
                                  </div>
                                  <p className="text-[11px] leading-tight text-gray-400">
                                    {ex.reasoning}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* M03 — Ranked Stocks primeiro: informação mais valiosa aparece imediatamente */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    Top Oportunidades Selecionadas pela IA
                  </h2>
                  {scannedCount > 0 && (
                    <p className="text-xs text-[#8E9299] mt-0.5">
                      Base de <strong className="text-emerald-400 font-mono">{scannedCount} ações</strong> monitoradas &bull; Ranqueadas as <strong className="text-white font-mono">{data.ranked_stocks.length} melhores</strong> oportunidades
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 print:hidden">
                  {/* Token Usage Badge */}
                  {data.token_usage && data.token_usage.total_tokens > 0 && (
                    <div 
                      className="flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-mono bg-purple-500/10 border-purple-500/30 text-purple-300"
                      title={`Tokens Entrada: ${data.token_usage.prompt_tokens} | Saída: ${data.token_usage.completion_tokens}`}
                    >
                      <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400/20" />
                      <span>{data.token_usage.total_tokens.toLocaleString()} tokens</span>
                    </div>
                  )}

                  <span className="text-xs px-3 py-1 border rounded-full font-mono bg-[#151619] border-[#2a2b2f] text-[#8E9299]">
                    {data.ranked_stocks.length} ativos
                  </span>

                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 text-xs px-3 py-1 border rounded-full text-emerald-400 transition-colors bg-[#151619] border-[#2a2b2f] hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={exportToHTML}
                    className="flex items-center gap-2 text-xs px-3 py-1 border rounded-full text-blue-400 transition-colors bg-[#151619] border-[#2a2b2f] hover:bg-blue-500/10 cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5" />
                    HTML
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {data.ranked_stocks.map((stock, index) => (
                  <StockCard 
                    key={stock.ticker} 
                    stock={stock} 
                    rank={index + 1} 
                    simulationAmount={isSimulationEnabled ? investmentAmount : undefined}
                    allocation={simulationResult ? simulationResult.allocations.find(a => a.ticker === stock.ticker) : undefined}
                    excludedAllocation={simulationResult ? simulationResult.excludedAllocations.find(e => e.ticker === stock.ticker) : undefined}
                    isBacktestMode={isBacktestMode}
                    backtestDate={backtestDate}
                  />
                ))}
              </div>
            </section>

            {/* M03/M04 — Pipeline Stats e Memória Estratégica movidos para baixo do ranking */}
            <div className="border-t border-[#1a1b1f] pt-6 space-y-4">
              {/* M04 — Pipeline Stats condensado em uma linha de metadados */}
              {pipelineStats && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-[#8E9299]">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Pipeline concluído</span>
                  </div>
                  <span>·</span>
                  <span>{pipelineStats.universeCount} ativos avaliados</span>
                  <span>·</span>
                  <span className="text-emerald-400">{pipelineStats.poolSize} selecionados</span>
                  <span>·</span>
                  <span className="text-purple-400">{pipelineStats.executionTimeMs}ms</span>
                  {pipelineStats.apiFetches > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-400">{pipelineStats.apiFetches} downloads</span>
                    </>
                  )}
                </div>
              )}

              {/* Memória Estratégica Aplicada — após o ranking */}
              {data.knowledge_base?.applied_items && data.knowledge_base.applied_items.length > 0 && (
                <div className="p-4 rounded-xl border bg-[#111216] border-purple-500/20 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-300 font-bold">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      <span>Memória Estratégica Aplicada pela IA ({data.knowledge_base.applied_items.length} padrões consultados)</span>
                    </div>

                    <button
                      onClick={() => setIsKnowledgeDrawerOpen(true)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
                    >
                      Gerenciar Base de Conhecimento
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {data.knowledge_base.applied_items.slice(0, 4).map(item => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-[#0c0d10] border border-[#222328] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-semibold">{item.category.replace('_', ' ')}</span>
                          <span className="text-purple-300 font-mono font-bold">{item.confidence_score}% confiança</span>
                        </div>
                        <p className="text-gray-300 text-[11px] leading-tight">
                          "{item.summary}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </motion.div>
          );
        })()}
      </main>
      )}
    </div>
  );
}
