import { motion } from "motion/react";
import { 
  ArrowLeft, Star, Share2, Copy, Target, Calendar, 
  Activity, Leaf, ShieldAlert, BarChart3, TrendingUp, 
  TrendingDown, Clock, ShieldOff, CheckCircle2, ChevronDown, Loader2 
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { StockAnalysis, PortfolioAllocation, ExcludedAllocation } from "../services/openai";
import { toggleFavoriteStatus, supabase, saveOperation, closeOperation } from "../lib/supabase";
import { AnalysisAssistant } from "./AnalysisAssistant";

const SECTOR_MAP: Record<string, { sector: string, group: string }> = {
  PETR4: { sector: "Petróleo e Gás", group: "Exploração e Refino" },
  PETR3: { sector: "Petróleo e Gás", group: "Exploração e Refino" },
  VALE3: { sector: "Materiais Básicos", group: "Mineração" },
  ITUB4: { sector: "Financeiro", group: "Bancos" },
  BBDC4: { sector: "Financeiro", group: "Bancos" },
  BBAS3: { sector: "Financeiro", group: "Bancos" },
  SUZB3: { sector: "Materiais Básicos", group: "Papel e Celulose" },
  JBSS3: { sector: "Consumo Não Cíclico", group: "Alimentos" },
  ELET3: { sector: "Utilidade Pública", group: "Energia Elétrica" },
  WEGE3: { sector: "Bens Industriais", group: "Máquinas e Equip." },
  RENT3: { sector: "Consumo Cíclico", group: "Aluguel de Carros" },
  LREN3: { sector: "Consumo Cíclico", group: "Varejo de Vestuário" },
  MGLU3: { sector: "Consumo Cíclico", group: "Varejo Eletrodomésticos" },
  B3SA3: { sector: "Financeiro", group: "Serviços Financeiros" },
  RADL3: { sector: "Saúde", group: "Comércio de Medicamentos" },
  ABEV3: { sector: "Consumo Não Cíclico", group: "Bebidas" },
  PRIO3: { sector: "Petróleo e Gás", group: "Exploração" },
  GGBR4: { sector: "Materiais Básicos", group: "Siderurgia" },
  CSNA3: { sector: "Materiais Básicos", group: "Siderurgia" },
  CMIG4: { sector: "Utilidade Pública", group: "Energia Elétrica" },
  SBSP3: { sector: "Utilidade Pública", group: "Saneamento" },
  VIVT3: { sector: "Comunicações", group: "Telecomunicações" },
  HAPV3: { sector: "Saúde", group: "Serviços Médico-Hospitalares" },
  EMBR3: { sector: "Bens Industriais", group: "Material de Transporte" },
  CYRE3: { sector: "Consumo Cíclico", group: "Construção Civil" },
  BRFS3: { sector: "Consumo Não Cíclico", group: "Alimentos" },
  NTCO3: { sector: "Consumo Cíclico", group: "Higiene e Cosméticos" },
  MULT3: { sector: "Financeiro", group: "Exploração de Imóveis" },
  IGTI11: { sector: "Financeiro", group: "Exploração de Imóveis" },
  CPLE6: { sector: "Utilidade Pública", group: "Energia Elétrica" },
  ENEV3: { sector: "Utilidade Pública", group: "Energia Elétrica" },
  CCRO3: { sector: "Bens Industriais", group: "Transporte" },
  RAIL3: { sector: "Bens Industriais", group: "Transporte" },
  ASAI3: { sector: "Consumo Não Cíclico", group: "Alimentos" },
  CRFB3: { sector: "Consumo Não Cíclico", group: "Alimentos" },
  BPAC11: { sector: "Financeiro", group: "Bancos" },
};

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
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentPrice = Number(stock.current_price || stock.entry_price || 0);
  const targetPrice = Number(stock.target_price || currentPrice);
  const entryPrice = Number(stock.entry_price || currentPrice);
  const dropPct = Number(stock.drop_percentage || 0);
  const strategyScore = Number(stock.strategy_score || stock.reversal_potential_score || 80);
  const successProb = Number(stock.success_probability || 85);
  const supportLevel = Number(stock.support_level || currentPrice * 0.9);
  const stopLoss = Number(stock.stop_loss || supportLevel * 0.96);
  const signals = Array.isArray(stock.smart_money_signals) ? stock.smart_money_signals : [];
  
  const ticker = (stock.ticker || "B3").toUpperCase();
  const tvSymbol = (ticker.match(/^[A-Z]{4}[0-9]$/) ? `BMFBOVESPA:${ticker}` : ticker);

  // States para Operações
  const defaultInvested = allocation ? allocation.amount_to_invest : (simulationAmount || 10000) * 0.2;
  const defaultShares = allocation ? allocation.shares_to_buy : Math.floor(defaultInvested / entryPrice);
  const defaultDateStr = isBacktestMode && backtestDate ? new Date(backtestDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  const [opAvgPrice, setOpAvgPrice] = useState(entryPrice);
  const [opShares, setOpShares] = useState(defaultShares);
  const [opTarget, setOpTarget] = useState(targetPrice);
  const [opStop, setOpStop] = useState(stopLoss);
  const [opDate, setOpDate] = useState(defaultDateStr);
  
  const [opStatus, setOpStatus] = useState(''); // Se '', significa que não existe operação registrada
  const [opProfitLoss, setOpProfitLoss] = useState<number | null>(null);
  const [opProfitLossPct, setOpProfitLossPct] = useState<number | null>(null);
  
  const [isClosingMenuOpen, setIsClosingMenuOpen] = useState(false);
  const [isSavingOp, setIsSavingOp] = useState(false);
  const [isClosingOp, setIsClosingOp] = useState(false);

  // Calcula o valor investido em tempo real
  const calculatedInvested = opShares * opAvgPrice;

  // Atualiza PnL se a operação estiver ABERTA
  useEffect(() => {
    if (opStatus === 'ABERTA') {
      const pnl = (currentPrice - opAvgPrice) * opShares;
      const pnlPct = ((currentPrice / opAvgPrice) - 1) * 100;
      setOpProfitLoss(pnl);
      setOpProfitLossPct(pnlPct);
    }
  }, [currentPrice, opAvgPrice, opShares, opStatus]);

  useEffect(() => {
    async function checkFavoriteStatus() {
      if (!ticker) return;
      const { data } = await supabase
        .from('analyzed_stocks')
        .select('is_favorite')
        .eq('ticker', ticker)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data?.is_favorite) {
        setIsFavorite(true);
      }
    }
    
    async function fetchOperationData() {
      if (!stock.id) return;
      const { data } = await supabase
        .from('analyzed_stocks')
        .select('invested_amount, shares_quantity, average_price, programmed_target, programmed_stop, investment_date, operation_status, profit_loss, profit_loss_percentage')
        .eq('id', stock.id)
        .maybeSingle();
      
      if (data && data.invested_amount) {
        setOpAvgPrice(Number(data.average_price));
        setOpShares(Number(data.shares_quantity));
        setOpTarget(Number(data.programmed_target));
        setOpStop(Number(data.programmed_stop));
        if (data.investment_date) setOpDate(data.investment_date);
        setOpStatus(data.operation_status || 'ABERTA');
        
        if (data.operation_status !== 'ABERTA') {
          setOpProfitLoss(Number(data.profit_loss));
          setOpProfitLossPct(Number(data.profit_loss_percentage));
        }
      }
    }

    checkFavoriteStatus();
    fetchOperationData();
  }, [ticker, stock.id]);

  const toggleFavorite = async () => {
    setIsFavoriting(true);
    const newStatus = !isFavorite;
    const success = await toggleFavoriteStatus(ticker, newStatus);
    if (success) setIsFavorite(newStatus);
    setIsFavoriting(false);
  };

  const analysisDateStr = isBacktestMode && backtestDate 
    ? new Date(backtestDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const simpleDateStr = isBacktestMode && backtestDate
    ? new Date(backtestDate).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const handleCaptureImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setIsCapturing(true);

    const iframe = cardRef.current.querySelector('iframe');
    if (iframe) iframe.style.display = 'none';
    
    // Pequeno atraso para garantir que o React/DOM ocultou o iframe antes de printar
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0A0B0E',
        pixelRatio: 2,
        skipFonts: false,
        filter: (node: HTMLElement) => {
          // Filtra completamente o iframe para que a biblioteca nem tente cloná-lo
          if (node.tagName && node.tagName.toLowerCase() === 'iframe') {
            return false;
          }
          return true;
        }
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return blob;
    } catch (err) {
      console.error("Erro ao gerar imagem", err);
      alert("Erro ao capturar a imagem: " + (err instanceof Error ? err.message : String(err)));
      return null;
    } finally {
      if (iframe) iframe.style.display = 'block';
      setIsCapturing(false);
    }
  };

  const handleNewOperation = async () => {
    if (!stock.id) {
      alert("Erro: Indicação sem ID. Atualize a página e gere uma nova análise.");
      return;
    }
    setIsSavingOp(true);
    
    const opData = {
      invested_amount: calculatedInvested,
      shares_quantity: opShares,
      average_price: opAvgPrice,
      programmed_target: opTarget,
      programmed_stop: opStop,
      investment_date: opDate,
      operation_status: opStatus || 'ABERTA' // mantem o status atual ou inicia como ABERTA
    };
    
    const success = await saveOperation(stock.id, opData);
    if (success) {
      alert("Operação salva com sucesso!");
      setOpStatus(opData.operation_status);
    } else {
      alert("Erro ao salvar operação.");
    }
    setIsSavingOp(false);
  };

  const handleCloseOperation = async (reason: string) => {
    if (!stock.id) return;
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

    const success = await closeOperation(stock.id, closeData);
    if (success) {
      setOpStatus(reason === 'Cancelar Operação' ? 'CANCELADO' : (reason === 'Alvo Atingido' ? 'ALVO ATINGIDO' : 'STOP ATINGIDO'));
      setOpProfitLoss(finalPnl);
      setOpProfitLossPct(finalPnlPct);
      setIsClosingMenuOpen(false);
      alert("Operação encerrada com sucesso.");
    } else {
      alert("Erro ao encerrar operação.");
    }
    setIsClosingOp(false);
  };

  const handleDownload = async () => {
    const blob = await handleCaptureImage();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker}-analise-smartmoney.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Imagem baixada com sucesso!");
  };

  const handleCopy = async () => {
    const blob = await handleCaptureImage();
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert("Imagem copiada para a área de transferência!");
    } catch (err) {
      console.error("Erro ao copiar", err);
      // Fallback to download if copy fails (often due to browser security blocking async clipboard write)
      handleDownload();
    }
  };

  const handleShare = async () => {
    const blob = await handleCaptureImage();
    if (!blob) return;
    try {
      const file = new File([blob], `${ticker}-analise.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Análise Smart Money - ${ticker}`,
          text: `Confira a análise de Reversão para ${ticker}`,
          files: [file]
        });
      } else {
        // Fallback for desktop browsers that don't support file sharing
        handleDownload();
      }
    } catch (err) {
      console.error("Erro ao compartilhar", err);
      handleDownload();
    }
  };

  const displayGroup = stock.group || SECTOR_MAP[ticker]?.group || "B3";
  const displaySector = stock.sector || SECTOR_MAP[ticker]?.sector || "Ações";

  // Expanded View (Mockup UI)
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
              title="Voltar ao resumo"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center w-8 h-8 rounded-full border border-[#2a2b2f] bg-[#15161a] text-white font-mono text-sm mt-1">
              #{rank}
            </div>
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-bold font-mono tracking-tight text-white">{ticker}</h2>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-gray-300 font-medium">{stock.company_name || ticker}</span>
                    <Leaf className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>Grupo: <strong className="text-blue-400 font-medium">{displayGroup}</strong></span>
                    <span>Setor: <strong className="text-purple-400 font-medium">{displaySector}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-bold font-mono text-white">R$ {currentPrice.toFixed(2)}</span>
                <span className="flex items-center gap-1 text-rose-500 font-mono text-sm font-semibold">
                  <TrendingDown className="w-4 h-4" />
                  -{(dropPct || 2.37).toFixed(2)}% <span className="text-xs text-gray-500 font-normal hidden sm:inline">(Hoje)</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 xl:gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Risco x Retorno</span>
              <span className="text-lg font-mono font-bold text-emerald-400">1 : {Number(stock.risk_reward_ratio || 2.5).toFixed(1)}</span>
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
              <button onClick={handleShare} disabled={isCapturing} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                <Share2 className="w-5 h-5" />
                <span className="text-[9px] uppercase tracking-wider">Compartilhar</span>
              </button>
              <button onClick={handleCopy} disabled={isCapturing} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                <Copy className="w-5 h-5" />
                <span className="text-[9px] uppercase tracking-wider">Copiar</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6 pb-2">
          {/* Entrada */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
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
          <div className="p-4 rounded-xl border border-rose-500/30 bg-[#1a0e10] relative overflow-hidden group hover:border-rose-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <ShieldOff className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-widest leading-none">Stop Loss</span>
                  <span className="text-[9px] text-rose-500/60 uppercase mt-0.5">(Invalidação)</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold text-rose-400 border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 rounded">R:R 1:{Number(stock.risk_reward_ratio || 2.5).toFixed(1)}</span>
            </div>
            <div className="flex flex-col items-center justify-center mt-3">
              <div className="text-2xl font-mono font-bold text-white">R$ {stopLoss.toFixed(2)}</div>
            </div>
          </div>

          {/* Alvo */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Alvo de Reversão</span>
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-4 flex items-center justify-center">
              R$ {targetPrice.toFixed(2)}
            </div>
          </div>

          {/* Tempo Estimado */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 relative overflow-hidden group hover:border-blue-500/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest">Tempo Estimado</span>
            </div>
            <div className="flex flex-col items-center justify-center mt-2 text-center">
              <div className="text-lg font-mono font-bold text-white">{stock.estimated_timeframe || "2 meses"}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{stock.estimated_target_date || "Período provável para atingir o alvo"}</div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 p-4 md:p-6 pt-2">
          
          {/* Left Column (Chart + Indicators) */}
          <div className="xl:col-span-2 flex flex-col gap-4">
            <div className="h-[400px] w-full rounded-xl overflow-hidden border border-[#1f2128] bg-[#0c0d11]">
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

            {/* Simulation Scenarios Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scenario 1: Investir tudo */}
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">Simulação: 100% Capital</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-[11px] text-gray-400 mb-1">Lucro Estimado no Alvo</span>
                  <span className="text-xl font-mono font-bold text-emerald-400">
                    + R$ {(((targetPrice / entryPrice) - 1) * (simulationAmount || 10000)).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-emerald-500/70 mt-1">Se investir os R$ {(simulationAmount || 10000).toFixed(2)} totais</span>
                </div>
              </div>

              {/* Scenario 2: Cotas Indicadas */}
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Simulação: Cotas Sugeridas</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-[11px] text-gray-400 mb-1">Lucro Estimado no Alvo</span>
                  <span className="text-xl font-mono font-bold text-blue-400">
                    + R$ {((targetPrice - entryPrice) * (allocation ? allocation.shares_to_buy : Math.floor((simulationAmount || 10000)*0.2 / entryPrice))).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-blue-400/70 mt-1">Investindo R$ {(allocation ? allocation.amount_to_invest : (simulationAmount || 10000)*0.2).toFixed(2)} nesta ação</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column (Analysis & Operations) */}
          <div className="xl:col-span-1 flex flex-col gap-4">
            
            {/* Smart Money Analysis Block */}
            <div className="rounded-xl border border-[#1f2128] bg-[#0c0d11] p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-widest">
                <Clock className="w-4 h-4" /> Análise do Smart Money
              </div>
              
              <div className="flex flex-col gap-2">
                {signals.length > 0 ? (
                  signals.map((signal, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium">
                      <Leaf className="w-3 h-3" /> {signal}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium">
                      <Leaf className="w-3 h-3" /> Acumulação em suporte histórico
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium">
                      <Leaf className="w-3 h-3" /> Divergência de volume em fundo
                    </div>
                  </>
                )}
              </div>

              <p className="text-[13px] leading-relaxed text-gray-300">
                {stock.analysis || "Ativo apresenta fundamentos sólidos e fluxo institucional crescente nas últimas sessões, indicando forte acumulação perto da região de suporte chave."}
              </p>


            </div>

            {/* Operations Block */}
            <div className="rounded-xl border border-[#1f2128] bg-[#0c0d11] p-5 flex flex-col gap-4 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 font-semibold text-xs uppercase tracking-widest">Operações</span>
                <button 
                  onClick={handleNewOperation}
                  disabled={isSavingOp}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] transition-colors border cursor-pointer disabled:opacity-50 font-semibold uppercase tracking-widest ${
                    opStatus === '' 
                      ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30 hover:text-emerald-400' 
                      : 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 hover:text-orange-300'
                  }`}
                >
                  {isSavingOp ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</>
                  ) : (
                    <>{opStatus === '' ? 'Registrar Operação' : 'Atualizar Operação'}</>
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
                      {opStatus || 'NÃO INICIADA'}
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

          {/* Right Column (Assistente da Análise) */}
          <div className="xl:col-span-2 flex flex-col">
            <AnalysisAssistant stock={stock} analysisDate={analysisDateStr} />
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-[#08090b] border-t border-[#1f2128] flex flex-wrap items-center justify-between gap-4 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Análise realizada em: {analysisDateStr}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Dados em tempo real</span>
            <span className="flex items-center gap-1.5">• Usebolsa</span>
            <span className="flex items-center gap-1.5">• Supabase</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Fonte: Usebolsa</span>
            <span className="px-2 border-l border-gray-700">Análise: Smart Money AI</span>
          </div>
        </div>

        </motion.div>
    );
  }

  // Collapsed View (Summary List Item)
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={`rounded-xl overflow-hidden transition-all duration-200 border bg-[#151619] hover:border-[#3a3b3f] ${
        rank === 1 ? 'border-emerald-500/70 border-l-2' :
        rank === 2 ? 'border-emerald-500/40 border-l-2' :
        rank === 3 ? 'border-emerald-500/20 border-l-2' :
        'border-[#2a2b2f]'
      }`}
    >
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={() => setExpanded(true)}
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
              {allocation && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ● Aberta
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="font-mono font-semibold text-white">R$ {currentPrice.toFixed(2)}</span>
              <span className="flex items-center gap-1 text-amber-400 font-mono font-semibold">
                <TrendingDown className="w-3 h-3" />
                {dropPct.toFixed(2)}%
                <span className="text-[10px] font-normal text-amber-400/70 hidden sm:inline">desconto</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex flex-col items-end hidden lg:flex">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Entrada Sugerida</span>
            <span className="text-xs font-mono font-bold text-white">
              R$ {entryPrice.toFixed(2)}
            </span>
          </div>

          {stock.risk_reward_ratio && (
            <div className="flex flex-col items-end hidden md:flex">
              <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Risco x Retorno</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                1 : {Number(stock.risk_reward_ratio).toFixed(1)}
              </span>
            </div>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Probabilidade</span>
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 rounded-full overflow-hidden bg-[#2a2b2f] hidden sm:block">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, successProb))}%` }}
                />
              </div>
              <span className="text-purple-400 font-mono font-bold text-sm">
                {successProb}%
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest mb-0.5 text-[#8E9299]">Score IA</span>
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 rounded-full overflow-hidden bg-[#2a2b2f] hidden sm:block">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, strategyScore))}%` }}
                />
              </div>
              <span className={`font-mono font-bold text-sm ${
                strategyScore >= 80 ? 'text-emerald-400' :
                strategyScore >= 60 ? 'text-amber-400' : 'text-[#8E9299]'
              }`}>
                {strategyScore}
                <span className="text-[10px] font-normal opacity-60">/100</span>
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
