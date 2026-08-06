import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Activity, ShieldAlert, Target, BarChart3, ChevronDown, ChevronUp, Calculator, Sparkles, AlertCircle, ShieldOff, CheckCircle2, XCircle, Clock, History, ExternalLink } from "lucide-react";
import { useState } from "react";
import { StockAnalysis, PortfolioAllocation, ExcludedAllocation } from "../services/openai";

interface StockCardProps {
  stock: StockAnalysis;
  rank: number;
  simulationAmount?: number;
  allocation?: PortfolioAllocation;
  excludedAllocation?: ExcludedAllocation;
  isBacktestMode?: boolean;
  backtestDate?: string;
}

export function StockCard({ stock, rank, simulationAmount, allocation, excludedAllocation, isBacktestMode, backtestDate }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);

  const currentPrice = Number(stock.current_price || stock.entry_price || 0);
  const targetPrice = Number(stock.target_price || currentPrice);
  const entryPrice = Number(stock.entry_price || currentPrice);
  const dropPct = Number(stock.drop_percentage || 0);
  const strategyScore = Number(stock.strategy_score || stock.reversal_potential_score || 80);
  const successProb = Number(stock.success_probability || 85);
  const supportLevel = Number(stock.support_level || currentPrice * 0.9);
  const stopLoss = Number(stock.stop_loss || supportLevel * 0.96);
  const signals = Array.isArray(stock.smart_money_signals) ? stock.smart_money_signals : [];
  
  const fullInvestmentShares = simulationAmount && currentPrice > 0 ? Math.floor(simulationAmount / currentPrice) : 0;
  const fullInvestmentProfit = simulationAmount && currentPrice > 0 ? (targetPrice - currentPrice) * fullInvestmentShares : 0;
  const fullInvestmentROI = simulationAmount && simulationAmount > 0 ? (fullInvestmentProfit / simulationAmount) * 100 : 0;

  const ticker = (stock.ticker || "B3").toUpperCase();
  const tvSymbol = (ticker.match(/^[A-Z]{4}[0-9]$/) ? `BMFBOVESPA:${ticker}` : ticker);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="rounded-xl overflow-hidden transition-all duration-200 border bg-[#151619] border-[#2a2b2f] hover:border-[#3a3b3f]"
    >
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm border bg-[#1e1f23] text-[#8E9299] border-[#2a2b2f]">
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-mono tracking-tight text-white">{ticker}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#2a2b2f] text-[#8E9299]">
                {stock.company_name || ticker}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="font-mono font-semibold text-white">R$ {currentPrice.toFixed(2)}</span>
              <span className="flex items-center text-red-500 font-mono font-semibold">
                <TrendingDown className="w-3 h-3 mr-1" />
                {dropPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {/* Preço de Entrada */}
          <div className="flex flex-col items-end hidden lg:flex">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Entrada Sugerida</span>
            <span className="text-xs font-mono font-bold text-white">
              R$ {entryPrice.toFixed(2)}
            </span>
          </div>

          {/* Relação Risco x Retorno */}
          {stock.risk_reward_ratio && (
            <div className="flex flex-col items-end hidden md:flex">
              <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Risco x Retorno</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                1 : {Number(stock.risk_reward_ratio).toFixed(1)}
              </span>
            </div>
          )}

          {/* Probabilidade Estimada de Sucesso */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Probabilidade</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#2a2b2f] hidden sm:block">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${Math.min(100, Math.max(0, successProb))}%` }}
                />
              </div>
              <span className="text-purple-400 font-mono font-bold text-xs">
                {successProb}%
              </span>
            </div>
          </div>

          {/* Score da Estratégia Smart Money */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Score Estratégia</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#2a2b2f] hidden sm:block">
                <div 
                  className="h-full bg-emerald-500 rounded-full" 
                  style={{ width: `${Math.min(100, Math.max(0, strategyScore))}%` }}
                />
              </div>
              <span className="text-emerald-400 font-mono font-bold text-xs">
                {strategyScore}/100
              </span>
            </div>
          </div>
          
          <button className="text-[#8E9299] hover:text-white transition-colors ml-1">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Content that can be expanded */}
      <div className={`border-t p-5 print:block ${expanded ? 'block' : 'hidden'} border-[#2a2b2f] bg-[#0f1012]`}>
        {/* Backtest Result Banner */}
        {isBacktestMode && stock.backtest_outcome && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-5 rounded-xl border bg-gradient-to-r from-[#12141c] to-[#181a24] border-purple-500/30 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/40">
                  <History className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Resultado Real do Backteste (Gabarito Histórico)
                  </h4>
                  <p className="text-[10px] uppercase tracking-widest text-purple-300 font-mono">
                    Análise Simulada na Data: <strong className="text-white">{backtestDate || "Data Histórica"}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {stock.backtest_outcome.hit_stop ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Stop Loss Acionado (Estopado)
                  </span>
                ) : stock.backtest_outcome.hit_target ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Alvo Atingido no Prazo
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Expirada no Prazo (Sem Alvo/Stop na Vigência)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="md:col-span-2 space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8E9299] font-bold">O que aconteceu de fato após {backtestDate || "a data do backteste"}:</span>
                <p className="text-xs text-gray-200 leading-relaxed italic">
                  "{stock.backtest_outcome.description || "A IA simulou o estado de mercado na data selecionada sem acesso a eventos futuros."}"
                </p>
              </div>

              <div className="flex flex-col justify-center p-3 rounded-lg bg-[#0a0a0d] border border-purple-500/20 space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8E9299]">Preço Final / Retorno:</span>
                <div className="text-lg font-mono font-bold text-purple-300">
                  R$ {(stock.backtest_outcome.final_price || 0).toFixed(2)} ({stock.backtest_outcome.return_percentage > 0 ? '+' : ''}{stock.backtest_outcome.return_percentage.toFixed(1)}%)
                </div>
                <a 
                  href={`https://www.tradingview.com/symbols/${encodeURIComponent(tvSymbol)}/`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                >
                  <ExternalLink className="w-3 h-3" /> Ver Gráfico no TradingView
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Simulation Banner */}
        {simulationAmount && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 border bg-emerald-500/5 border-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Calculator className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Simulação de Investimento</h4>
                <p className="text-[10px] uppercase tracking-widest text-[#8E9299]">Baseado em R$ {simulationAmount.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center md:justify-end items-center">
              <div className="text-center px-4 border-r border-[#2a2b2f]">
                <span className="text-[10px] uppercase block mb-1 text-[#8E9299]">Se investir TUDO aqui</span>
                <span className="text-sm font-mono font-bold text-emerald-400">+R$ {fullInvestmentProfit.toFixed(2)} ({fullInvestmentROI.toFixed(1)}%)</span>
              </div>
              
              {allocation ? (
                <div className="text-center px-4 rounded-lg py-1 border bg-emerald-500/10 border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1 flex items-center gap-1 justify-center">
                    <Sparkles className="w-3 h-3" /> Incluída no Investimento
                  </span>
                  <span className="text-sm font-mono font-bold text-white">R$ {allocation.amount_to_invest.toFixed(2)} ({allocation.shares_to_buy} cotas)</span>
                </div>
              ) : excludedAllocation ? (
                <div className="text-center px-4 rounded-lg py-1 border max-w-xs bg-amber-500/10 border-amber-500/20">
                  <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1 flex items-center gap-1 justify-center">
                    <AlertCircle className="w-3 h-3 text-amber-500" /> Excluída da Alocação
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">R$ {currentPrice.toFixed(2)} / cota (Insuficiente)</span>
                </div>
              ) : (
                <div className="text-center px-4 opacity-50">
                  <span className="text-[10px] uppercase block mb-1 text-[#8E9299]">Alocação Sugerida</span>
                  <span className="text-sm font-mono font-bold text-white">R$ 0.00</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* TradingView Chart */}
            <div className="h-[300px] w-full rounded-lg overflow-hidden border relative border-[#2a2b2f]">
              <iframe
                key={tvSymbol}
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&wordwrap=1&matchtext=1&title=1&width=100%25&height=100%25`}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                allow="fullscreen"
              ></iframe>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold text-[#8E9299]">
                <Activity className="w-3.5 h-3.5" /> Análise do Smart Money
              </h4>
              <p className="text-sm leading-relaxed text-gray-300">
                {stock.analysis || "Análise técnica e de fluxo acumulativo."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold text-[#8E9299]">
                <BarChart3 className="w-3.5 h-3.5" /> Sinais Institucionais
              </h4>
              <div className="flex flex-wrap gap-2">
                {signals.length > 0 ? (
                  signals.map((signal, idx) => (
                    <span key={idx} className="text-xs px-2.5 py-1 rounded-md font-medium border bg-[#1e1f23] text-emerald-400 border-emerald-500/20">
                      {signal}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">Acumulação institucional identificada</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-[#151619] border-[#2a2b2f]">
              <h4 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5 font-semibold text-[#8E9299]">
                <ShieldAlert className="w-3.5 h-3.5" /> Zona de Defesa (Suporte)
              </h4>
              <div className="text-2xl font-mono text-white">
                R$ {supportLevel.toFixed(2)}
              </div>
              <p className="text-[10px] mt-1 text-[#8E9299]">Região de acumulação institucional</p>
            </div>

            {/* Stop Loss / Exit Trigger Card */}
            <div className="p-4 rounded-lg border bg-rose-500/5 border-rose-500/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-widest flex items-center gap-1.5 font-bold text-rose-500">
                  <ShieldOff className="w-3.5 h-3.5 text-rose-500" /> Stop Loss (Invalidação)
                </h4>
                {stock.risk_reward_ratio && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    R:R 1:{Number(stock.risk_reward_ratio).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-mono text-rose-500 font-bold">
                  R$ {stopLoss.toFixed(2)}
                </div>
                <div className="text-xs font-mono font-bold text-rose-500 flex items-center">
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                  -{currentPrice > 0 ? (((currentPrice - stopLoss) / currentPrice) * 100).toFixed(1) : "0.0"}%
                </div>
              </div>
              <div className="text-[11px] mt-2 pt-2 border-t leading-tight border-rose-500/20 text-rose-200/80">
                <strong className="block text-[10px] uppercase tracking-wider text-rose-500 mb-0.5">Gatilho de Saída:</strong>
                {stock.invalidation_trigger || "Fechamento diário abaixo do suporte histórico invalida a tese."}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-[#151619] border-[#2a2b2f]">
              <h4 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5 font-semibold text-[#8E9299]">
                <Target className="w-3.5 h-3.5" /> Alvo de Reversão
              </h4>
              <div className="text-2xl font-mono text-emerald-500 font-bold">
                R$ {targetPrice.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +{currentPrice > 0 ? (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2) : "0.00"}% upside
              </div>
              <div className="text-[10px] mt-2 pt-2 border-t flex flex-col gap-0.5 border-[#2a2b2f] text-[#8E9299]">
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-tighter">Tempo Estimado:</span>
                  <span className="text-emerald-400 font-bold font-mono">{stock.estimated_timeframe || stock.estimated_target_date || "1-2 meses"}</span>
                </div>
                {stock.estimated_target_date && stock.estimated_timeframe && (
                  <span className="text-[9px] text-[#8E9299] text-right">Previsão: {stock.estimated_target_date}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
