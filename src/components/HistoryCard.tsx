import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ArrowLeft, Leaf, Target, ShieldOff, TrendingUp, Calendar, 
  ChevronDown, CheckCircle2, Star, Share2, Copy, Clock,
  TrendingDown, ShieldAlert, Loader2
} from "lucide-react";
import { toPng } from 'html-to-image';
import { supabase, toggleFavoriteStatus, saveOperation, closeOperation } from '../lib/supabase';

export function HistoryCard({ indication }: { indication: any }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Parse data
  const ticker = indication.ticker || "B3";
  const currentPrice = Number(indication.current_price) || 0;
  const entryPrice = Number(indication.entry_price) || currentPrice;
  const targetPrice = Number(indication.target_price) || 0;
  const stopLoss = Number(indication.stop_loss) || 0;
  const successProb = Number(indication.success_probability) || 0;
  const strategyScore = Number(indication.strategy_score) || 0;
  const dropPct = indication.stock_data?.drop_percentage || 0;
  const signals = indication.stock_data?.smart_money_signals || [];
  
  const [isFavorite, setIsFavorite] = useState(indication.is_favorite || false);
  const [isFavoriting, setIsFavoriting] = useState(false);

  // States para Operações
  const defaultInvested = indication.invested_amount || 1000;
  const defaultShares = indication.shares_quantity || Math.floor(defaultInvested / entryPrice);
  const defaultDateStr = indication.investment_date || indication.created_at.split('T')[0];

  const [opAvgPrice, setOpAvgPrice] = useState(Number(indication.average_price) || entryPrice);
  const [opShares, setOpShares] = useState(Number(indication.shares_quantity) || defaultShares);
  const [opTarget, setOpTarget] = useState(Number(indication.programmed_target) || targetPrice);
  const [opStop, setOpStop] = useState(Number(indication.programmed_stop) || stopLoss);
  const [opDate, setOpDate] = useState(defaultDateStr);
  
  const [opStatus, setOpStatus] = useState(indication.operation_status || '');
  const [opProfitLoss, setOpProfitLoss] = useState<number | null>(Number(indication.profit_loss) || null);
  const [opProfitLossPct, setOpProfitLossPct] = useState<number | null>(Number(indication.profit_loss_percentage) || null);
  
  const [isClosingMenuOpen, setIsClosingMenuOpen] = useState(false);
  const [isSavingOp, setIsSavingOp] = useState(false);
  const [isClosingOp, setIsClosingOp] = useState(false);

  const calculatedInvested = opShares * opAvgPrice;

  // Real-time PnL se estiver aberta
  useEffect(() => {
    if (opStatus === 'ABERTA') {
      const pnl = (currentPrice - opAvgPrice) * opShares;
      const pnlPct = ((currentPrice / opAvgPrice) - 1) * 100;
      setOpProfitLoss(pnl);
      setOpProfitLossPct(pnlPct);
    }
  }, [currentPrice, opAvgPrice, opShares, opStatus]);

  const toggleFavorite = async () => {
    setIsFavoriting(true);
    const newStatus = !isFavorite;
    const success = await toggleFavoriteStatus(ticker, newStatus);
    if (success) setIsFavorite(newStatus);
    setIsFavoriting(false);
  };

  const handleCaptureImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setIsCapturing(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0A0B0E',
        pixelRatio: 2,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return blob;
    } catch (err) {
      console.error("Erro ao gerar imagem", err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownload = async () => {
    const blob = await handleCaptureImage();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker}-historico.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNewOperation = async () => {
    if (!indication.id) return;
    setIsSavingOp(true);
    const opData = {
      invested_amount: calculatedInvested,
      shares_quantity: opShares,
      average_price: opAvgPrice,
      programmed_target: opTarget,
      programmed_stop: opStop,
      investment_date: opDate,
      operation_status: opStatus || 'ABERTA'
    };
    const success = await saveOperation(indication.id, opData);
    if (success) {
      setOpStatus(opData.operation_status);
      alert("Operação salva com sucesso no histórico!");
    } else {
      alert("Erro ao salvar operação.");
    }
    setIsSavingOp(false);
  };

  const handleCloseOperation = async (reason: string) => {
    if (!indication.id) return;
    setIsClosingOp(true);
    let closingPrice = currentPrice;
    if (reason === 'Alvo Atingido') closingPrice = opTarget;
    if (reason === 'Stop Atingido') closingPrice = opStop;
    
    const finalPnl = (closingPrice - opAvgPrice) * opShares;
    const finalPnlPct = ((closingPrice / opAvgPrice) - 1) * 100;
    
    const closeData = {
      closing_price: closingPrice,
      closing_date: new Date().toISOString(),
      closing_reason: reason,
      profit_loss: finalPnl,
      profit_loss_percentage: finalPnlPct
    };

    const success = await closeOperation(indication.id, closeData);
    if (success) {
      setOpStatus(reason === 'Cancelar Operação' ? 'CANCELADO' : (reason === 'Alvo Atingido' ? 'ALVO ATINGIDO' : 'STOP ATINGIDO'));
      setOpProfitLoss(finalPnl);
      setOpProfitLossPct(finalPnlPct);
      setIsClosingMenuOpen(false);
    }
    setIsClosingOp(false);
  };

  const analysisDateStr = new Date(indication.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  if (expanded) {
    return (
      <motion.div 
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl overflow-hidden border border-[#2a2b2f] bg-[#0A0B0E] mb-6 shadow-2xl relative"
      >
        {isCapturing && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="ml-3 text-sm font-medium text-emerald-400">Gerando imagem...</span>
          </div>
        )}
        {/* TOP HEADER */}
        <div className="p-4 md:p-6 border-b border-[#1f2128] flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button 
              onClick={() => setExpanded(false)}
              className="mt-1 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1f2128] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-bold font-mono tracking-tight text-white">{ticker}</h2>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-gray-300 font-medium">{indication.company_name || ticker}</span>
                    <Leaf className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>Grupo: <strong className="text-blue-400 font-medium">{indication.stock_data?.group || "B3"}</strong></span>
                    <span>Setor: <strong className="text-purple-400 font-medium">{indication.sector || "Ações"}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-bold font-mono text-white">R$ {currentPrice.toFixed(2)}</span>
                <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">Preço Atual</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 xl:gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Risco x Retorno</span>
              <span className="text-lg font-mono font-bold text-emerald-400">1 : {Number(indication.risk_reward_ratio || 2.5).toFixed(1)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Probabilidade</span>
              <span className="text-lg font-mono font-bold text-purple-400">{successProb}%</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Score Estratégia</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-[#1f2128] overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${strategyScore}%` }} />
                </div>
                <span className="text-lg font-mono font-bold text-emerald-400">{strategyScore}<span className="text-xs text-emerald-400/50">/100</span></span>
              </div>
            </div>
            <div className="h-10 w-px bg-[#1f2128] hidden sm:block" />
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleFavorite} 
                disabled={isFavoriting} 
                className={`flex flex-col items-center gap-1 transition-colors group cursor-pointer disabled:opacity-50 ${isFavorite ? 'text-amber-500' : 'text-gray-400 hover:text-amber-400'}`}
              >
                <Star className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-amber-500 text-amber-500' : 'fill-transparent group-hover:fill-amber-500/20'}`} />
                <span className="text-[9px] uppercase tracking-wider">{isFavoriting ? 'Salvando' : (isFavorite ? 'Favorito' : 'Favoritar')}</span>
              </button>
              <button onClick={handleDownload} disabled={isCapturing} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                <Copy className="w-5 h-5" />
                <span className="text-[9px] uppercase tracking-wider">Baixar</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6 pb-2">
          {/* Entrada */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Entrada Sugerida</span>
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-4 flex items-center justify-center">
              R$ {entryPrice.toFixed(2)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="p-4 rounded-xl border border-rose-500/30 bg-[#1a0e10] relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <ShieldOff className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-widest leading-none">Stop Loss</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center mt-3">
              <div className="text-2xl font-mono font-bold text-white">R$ {stopLoss.toFixed(2)}</div>
            </div>
          </div>

          {/* Alvo */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Alvo Programado</span>
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-4 flex items-center justify-center">
              R$ {targetPrice.toFixed(2)}
            </div>
          </div>

          {/* Tempo Estimado */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest">Tempo Estimado</span>
            </div>
            <div className="flex flex-col items-center justify-center mt-2 text-center">
              <div className="text-lg font-mono font-bold text-white">{indication.stock_data?.estimated_timeframe || "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 md:p-6 pt-2">
          {/* Left Column (Chart + Analysis) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="h-[400px] w-full rounded-xl overflow-hidden border border-[#1f2128] bg-[#0c0d11]">
              <iframe
                key={ticker}
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent("BMFBOVESPA:" + ticker)}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&wordwrap=1&matchtext=1&title=1&width=100%25&height=100%25`}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                allow="fullscreen"
              ></iframe>
            </div>

            {/* Analysis Block */}
            <div className="rounded-xl border border-[#1f2128] bg-[#0c0d11] p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-widest">
              <Clock className="w-4 h-4" /> Análise Histórica
            </div>
            <div className="flex flex-col gap-2">
              {signals.map((signal: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium">
                  <Leaf className="w-3 h-3" /> {signal}
                </div>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-gray-300">
              {indication.analysis}
            </p>
          </div>
        </div>

          {/* Operations Block */}
          <div className="rounded-xl border border-[#1f2128] bg-[#0c0d11] p-5 flex flex-col gap-4 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-semibold text-xs uppercase tracking-widest">Operação</span>
              <button 
                onClick={handleNewOperation}
                disabled={isSavingOp}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] transition-colors border cursor-pointer disabled:opacity-50 font-semibold uppercase tracking-widest ${
                  !opStatus || opStatus === 'SEM OPERAÇÃO'
                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30 hover:text-emerald-400' 
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 hover:text-orange-300'
                }`}
              >
                {isSavingOp ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</>
                ) : (
                  <>{!opStatus || opStatus === 'SEM OPERAÇÃO' ? 'Registrar Operação' : 'Atualizar Operação'}</>
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Preço Médio</span>
                <input
                  type="number"
                  value={opAvgPrice}
                  onChange={(e) => setOpAvgPrice(Number(e.target.value))}
                  className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Qtd. de Cotas</span>
                <input
                  type="number"
                  value={opShares}
                  onChange={(e) => setOpShares(Number(e.target.value))}
                  className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Valor Investido (R$)</span>
                <div className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-gray-400">
                  {calculatedInvested.toFixed(2)}
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Alvo Programado</span>
                <input
                  type="number"
                  value={opTarget}
                  onChange={(e) => setOpTarget(Number(e.target.value))}
                  className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Stop Programado</span>
                <input
                  type="number"
                  value={opStop}
                  onChange={(e) => setOpStop(Number(e.target.value))}
                  className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-1">Data Investimento</span>
                <input
                  type="date"
                  value={opDate}
                  onChange={(e) => setOpDate(e.target.value)}
                  className="p-2 bg-[#15161a] border border-[#1f2128] rounded font-mono text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 pt-4 border-t border-[#1f2128] gap-4">
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 mb-1">Status da Operação</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest w-max ${
                    opStatus === 'ABERTA' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                    opStatus === 'ALVO ATINGIDO' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                    opStatus === 'STOP ATINGIDO' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                    opStatus === 'CANCELADO' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                    'bg-[#1f2128] text-gray-500 border border-[#2a2b2f]'
                  }`}>
                    {opStatus || 'SEM OPERAÇÃO'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 mb-1">Lucro / Prejuízo</span>
                  <span className={`text-xs font-mono font-bold ${
                    (opProfitLoss || 0) > 0 ? 'text-emerald-500' :
                    (opProfitLoss || 0) < 0 ? 'text-rose-500' :
                    'text-gray-400'
                  }`}>
                    {(opProfitLoss || 0) > 0 ? '+' : ''}R$ {(opProfitLoss || 0).toFixed(2)} ({(opProfitLossPct || 0) > 0 ? '+' : ''}{(opProfitLossPct || 0).toFixed(2)}%)
                  </span>
                </div>
              </div>
              
              {opStatus === 'ABERTA' && (
                <div className="relative w-full sm:w-auto">
                  <button 
                    onClick={() => setIsClosingMenuOpen(!isClosingMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500/20 transition-colors text-[11px] font-semibold w-full justify-center cursor-pointer"
                  >
                    {isClosingOp ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Encerrar Operação'} <ChevronDown className="w-3 h-3" />
                  </button>
                  {isClosingMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#15161a] border border-[#1f2128] rounded-xl shadow-xl overflow-hidden z-10 flex flex-col">
                      <button onClick={() => handleCloseOperation('Alvo Atingido')} className="text-left px-4 py-2.5 text-xs font-semibold text-blue-400 hover:bg-[#1f2128] transition-colors">🎯 Alvo Atingido</button>
                      <button onClick={() => handleCloseOperation('Stop Atingido')} className="text-left px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-[#1f2128] transition-colors">🛡️ Stop Atingido</button>
                      <button onClick={() => handleCloseOperation('Cancelar Operação')} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:bg-[#1f2128] transition-colors">⚪ Cancelar Operação</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-[#08090b] border-t border-[#1f2128] flex flex-wrap items-center justify-between gap-4 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Registrada em: {analysisDateStr}
          </div>
        </div>

      </motion.div>
    );
  }

  // Collapsed View
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl overflow-hidden transition-all duration-200 border bg-[#151619] hover:border-[#3a3b3f] border-[#2a2b2f]`}
    >
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-mono tracking-tight text-white">{ticker}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#2a2b2f] text-[#8E9299]">
                {indication.company_name || ticker}
              </span>
              {opStatus === 'ABERTA' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ● Aberta
                </span>
              )}
              {opStatus === 'ALVO ATINGIDO' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  ✓ Alvo Atingido
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="font-mono font-semibold text-white">R$ {entryPrice.toFixed(2)}</span>
              <span className="text-[10px] text-gray-500">{analysisDateStr}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Probabilidade</span>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400 font-mono font-bold text-sm">
                {successProb}%
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Score</span>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {strategyScore}
              </span>
            </div>
          </div>
          <button className="text-[#8E9299] hover:text-white transition-colors ml-1">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
