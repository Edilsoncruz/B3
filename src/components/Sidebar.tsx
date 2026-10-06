import { useState } from 'react';
import {
  LayoutDashboard, TrendingUp, History, FileText, BrainCircuit, Settings,
  HelpCircle, LogOut, BarChart2, Activity
} from 'lucide-react';

type NavView = 'ANALISE' | 'HISTORICO' | 'UNIBOLSAI' | 'CONFIGURACAO';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  view: NavView;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',     label: 'Dashboard',        icon: LayoutDashboard, view: 'ANALISE' },
  { id: 'analise',       label: 'Análise Dinâmica', icon: TrendingUp,      view: 'ANALISE' },
  { id: 'indicadores',   label: 'Indicadores',      icon: Activity,        view: 'ANALISE' },
  { id: 'historico',     label: 'Histórico',        icon: History,         view: 'HISTORICO' },
  { id: 'relatorios',    label: 'Relatórios',       icon: FileText,        view: 'HISTORICO' },
  { id: 'ia-insights',   label: 'AI Insights',      icon: BrainCircuit,    view: 'UNIBOLSAI' },
  { id: 'configuracoes', label: 'Configurações',    icon: Settings,        view: 'CONFIGURACAO' },
];

interface SidebarProps {
  activeNavId: string;
  onSelect: (navId: string, view: NavView) => void;
}

export function Sidebar({ activeNavId, onSelect }: SidebarProps) {
  // Ocultando ou fixando como expandido de acordo com o design
  return (
    <aside className="w-[260px] shrink-0 h-full flex flex-col bg-[#071327] border-r border-[#1a2b4c] text-white">
      {/* Brand / Header */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-base tracking-tight text-white leading-tight">SmartMoney AI</span>
          <span className="text-xs text-slate-400 leading-tight mt-0.5">Terminal v2.4</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 flex flex-col gap-1.5 px-3 overflow-y-auto mt-4">
        {NAV_ITEMS.map(item => {
          const active = item.id === activeNavId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id, item.view)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                active
                  ? 'bg-[#101f3c] text-white border-l-4 border-emerald-500'
                  : 'text-slate-400 border-l-4 border-transparent hover:bg-[#0c1a33] hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* App highlight CTA or something similar to the image's bottom element */}
      <div className="px-6 flex flex-col items-center mb-6 mt-4">
         <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
            <BarChart2 className="w-8 h-8 text-white" />
         </div>
         <span className="font-bold text-white text-lg">SmartMoney AI</span>
      </div>

      {/* Rodapé */}
      <div className="px-3 pb-6 flex flex-col gap-1">
        <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-[#0c1a33] hover:text-white transition-colors">
          <HelpCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Suporte</span>
        </button>
        <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-[#0c1a33] hover:text-rose-400 transition-colors">
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

