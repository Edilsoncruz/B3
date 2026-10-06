import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ArrowRightCircle, ShieldAlert, Target, Info } from "lucide-react";
import { StockAnalysis } from "../services/openai";
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

interface StockListItemProps {
  stock: StockAnalysis;
  rank: number;
}

export function StockListItem({ stock, rank }: StockListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const info = SECTOR_MAP[stock.ticker] || { sector: "Mercado Financeiro", group: "Diversos" };

  // Calculate generic score based on priority (if missing)
  const score = stock.strategy_score || stock.reversal_potential_score || 70;
  const probability = stock.success_probability || 85;

  const getScoreColor = (val: number) => {
    if (val >= 80) return "text-emerald-600 stroke-emerald-500";
    if (val >= 60) return "text-amber-500 stroke-amber-500";
    return "text-rose-500 stroke-rose-500";
  };

  const scoreColor = getScoreColor(score);
  const probColor = probability >= 75 ? "bg-emerald-500" : probability >= 60 ? "bg-amber-500" : "bg-rose-500";

  // Circular progress math
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="border-b border-gray-100 last:border-0 bg-white hover:bg-slate-50/50 transition-colors">
      <div 
        className="flex items-center p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Rank */}
        <div className="w-10 text-lg font-bold text-gray-700">
          #{rank}
        </div>

        {/* Asset */}
        <div className="flex items-center gap-3 w-[250px] shrink-0">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shadow-sm">
             <span className="font-bold text-slate-500 text-sm">{stock.ticker.substring(0, 2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 leading-tight">{stock.company_name || stock.ticker}</span>
            <span className="text-xs text-gray-500 mt-0.5">{info.sector}</span>
          </div>
        </div>

        {/* Entrada Sugerida */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <ArrowRightCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Entrada:</span>
            <span className="font-bold text-gray-900">R$ {(stock.entry_price || stock.current_price).toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* Stop Sugerido */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Stop:</span>
            <span className="font-bold text-rose-600">R$ {stock.stop_loss?.toFixed(2).replace('.', ',') || "N/A"}</span>
          </div>
        </div>

        {/* Alvo Sugerido */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Alvo:</span>
            <span className="font-bold text-emerald-600">R$ {stock.target_price.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* Probabilidade */}
        <div className="flex flex-col w-[120px] shrink-0">
          <span className="text-[10px] text-gray-800 font-bold mb-1">Probabilidade</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">{probability}%</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
               <div className={`h-full rounded-full ${probColor}`} style={{ width: `${probability}%` }} />
            </div>
          </div>
        </div>

        {/* Score IA */}
        <div className="flex flex-col items-center justify-center w-[100px] shrink-0 relative">
          <svg width="50" height="50" className="-rotate-90">
             <circle cx="25" cy="25" r={radius} fill="transparent" stroke="#e5e7eb" strokeWidth="4" />
             <circle 
               cx="25" cy="25" r={radius} 
               fill="transparent" 
               strokeWidth="4" 
               strokeDasharray={circumference}
               strokeDashoffset={strokeDashoffset}
               className={scoreColor.split(' ')[1]}
               strokeLinecap="round"
             />
          </svg>
          <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-sm ${scoreColor.split(' ')[0]}`}>
            {score}
          </span>
          <div className="flex w-[40px] justify-between mt-0.5">
            <span className="text-[8px] text-gray-400 font-mono">0</span>
            <span className="text-[8px] text-gray-400 font-mono">100</span>
          </div>
        </div>

        {/* Expand Toggle */}
        <div className="w-10 flex justify-end">
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 bg-slate-50"
          >
            <div className="p-6 text-sm text-gray-700">
               <div className="flex items-start gap-4 mb-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                 <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="font-bold text-blue-900 mb-1">Racional da Inteligência Artificial</h4>
                   <p className="text-blue-800/80 leading-relaxed whitespace-pre-wrap">{stock.analysis}</p>
                 </div>
               </div>
               
               <AnalysisAssistant 
                 stock={stock}
                 isSimulationEnabled={false} 
                 investmentAmount={500} 
                 currentDate={new Date()} 
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
