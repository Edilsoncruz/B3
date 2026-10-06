import { useState } from 'react';
import {
  LayoutGrid, Award, RefreshCw, Plus, TrendingUp, Coins, PieChart, Wallet,
  ChevronDown, Brain, Target, Crosshair, Shield, ArrowUpRight, BarChart3, Zap
} from 'lucide-react';
import { AIRecommendation, StockAnalysis, PortfolioAllocation } from '../services/openai';
import { calculatePortfolioDistribution } from '../utils/portfolio';

const brl = (n: number | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR') + '%';

const LOGO_COLORS = ['#e11d48', '#7c3aed', '#2563eb', '#ea580c', '#16a34a', '#0891b2', '#db2777', '#d97706'];

export interface AnalysisResultProps {
  data: AIRecommendation;
  market: string;
  isSimulationEnabled: boolean;
  investmentAmount: number;
  forceEqualInclusion: boolean;
  lastAuditId: string | null;
  isAuditMode: boolean;
  reportRef: React.RefObject<HTMLDivElement | null>;
  onNewAnalysis: () => void;
  onRerunSimulation: () => void;
  onExportCSV: () => void;
  onExportHTML: () => void;
  onGenerateAuditPDF: () => void;
}

export function AnalysisResult(props: AnalysisResultProps) {
  const [tab, setTab] = useState<'resultado' | 'indicadores'>('indicadores');

  const approved = props.data.ranked_stocks.filter((s: StockAnalysis) => (s as any).status !== 'REJECTED');
  const sim = calculatePortfolioDistribution(approved, props.investmentAmount, { forceEqualInclusion: props.forceEqualInclusion });

  return (
    <div ref={props.reportRef} className="flex-1 flex flex-col min-h-0 w-full bg-surface">
      <ResultHeader />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-8 py-3 border-b border-outline-variant shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <TabButton active={tab === 'resultado'} onClick={() => setTab('resultado')} icon={<LayoutGrid className="w-4 h-4" />} label="Resultado Simulador" badge={sim.allocations.length + ' Ativos'} />
          <TabButton active={tab === 'indicadores'} onClick={() => setTab('indicadores')} icon={<Award className="w-4 h-4" />} label="Indicadores" badge={approved.length + ' oportunidades'} />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={props.onRerunSimulation} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-[14px] font-medium">
            <RefreshCw className="w-4 h-4" /> Refazer Simulação
          </button>
          <button onClick={props.onNewAnalysis} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold">
            <Plus className="w-4 h-4" /> Nova Análise
          </button>
        </div>
      </div>

      {tab === 'resultado' ? (
        <SimulatorPanel data={props.data} stocks={approved} sim={sim} />
      ) : (
        <IndicationsPanel
          stocks={approved}
          onExportCSV={props.onExportCSV}
          onExportHTML={props.onExportHTML}
        />
      )}
    </div>
  );
}

function ResultHeader() {
  return (
    <div className="flex items-center gap-3 px-8 py-4 border-b border-outline-variant shrink-0 bg-white">
      <h1 className="text-xl font-bold text-on-surface">Analisar</h1>
      <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
        <BarChart3 className="w-5 h-5" />
      </div>
      <div className="relative ml-2 max-w-xl flex-1">
        <Shield className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          placeholder="Buscar ativos (esc: PETR4, VALE3...)"
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-[15px] focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-[14px] font-semibold ' +
        (active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container')
      }
    >
      {icon}
      {label}
      <span className={'text-[12px] font-mono px-2 py-0.5 rounded ' + (active ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant')}>{badge}</span>
    </button>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">{children}</div>;
}

/* ── Painel Indicadores (tabela compacta) ─────────────────────────────────── */

function IndicationsPanel({ stocks, onExportCSV, onExportHTML }: {
  stocks: StockAnalysis[]; onExportCSV: () => void; onExportHTML: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <TabPanel>
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Top Oportunidades Selecionadas pela IA</h2>
          <p className="text-[15px] text-on-surface-variant mt-1">
            Base de <span className="font-semibold text-on-surface">12 ações monitoradas</span> · Ranqueadas as{' '}
            <span className="font-semibold text-on-surface">{stocks.length} melhores</span> oportunidades com assimetria favorável
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] font-medium text-on-surface bg-surface-container rounded-lg px-3 py-1.5 border border-outline-variant">{stocks.length} ativos</span>
          <button onClick={onExportCSV} className="text-[14px] font-medium text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-lg px-3 py-1.5">CSV</button>
          <button onClick={onExportHTML} className="text-[14px] font-medium text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-lg px-3 py-1.5">HTML</button>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-[2fr_repeat(3,1.1fr)_1.2fr_0.9fr_auto] gap-4 items-center px-6 py-3 bg-surface-container-low border-b border-outline-variant text-[13px] font-semibold text-on-surface-variant">
          <div>Asset</div>
          <div>Entrada Sugerida</div>
          <div>Stop Sugerido</div>
          <div>Alvo Sugerido</div>
          <div>Probabilidade</div>
          <div className="text-center">Score IA</div>
          <div />
        </div>

        {stocks.length === 0 ? (
          <div className="px-6 py-10 text-center text-on-surface-variant">Nenhuma oportunidade aprovada nesta varredura.</div>
        ) : (
          stocks.map((s, i) => (
            <Row
              key={s.ticker}
              stock={s}
              rank={i + 1}
              expanded={expanded === s.ticker}
              onToggle={() => setExpanded(expanded === s.ticker ? null : s.ticker)}
            />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoCard color="purple" icon={<Brain className="w-5 h-5" />} title="IA Propretária" text="Algoritmos avançados analisam padrões e oportunidades com padrões institucional." />
        <InfoCard color="green" icon={<Shield className="w-5 h-5" />} title="Gestão de Risco" text="Risco a Retorno calculada automaticamente para cada oportunidade." />
        <InfoCard color="purple" icon={<BarChart3 className="w-5 h-5" />} title="Probabilidade" text="Probabilidade de sucesso baseada em histórica e contexto de mercado." />
        <InfoCard color="orange" icon={<Zap className="w-5 h-5" />} title="Tempo Real" text="Probabilidade de sucesso calculada com a história de mercado." />
      </div>
    </TabPanel>
  );
}

function InfoCard({ color, icon, title, text }: { color: 'purple' | 'green' | 'orange'; icon: React.ReactNode; title: string; text: string }) {
  const colors = {
    purple: 'bg-purple-500/10 text-purple-600 border-purple-200',
    green: 'bg-green-500/10 text-green-600 border-green-200',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-200',
  };
  return (
    <div className="rounded-xl border border-outline-variant bg-white p-4">
      <div className={'w-10 h-10 rounded-lg flex items-center justify-center mb-2 border ' + colors[color]}>{icon}</div>
      <div className="font-semibold text-on-surface text-[15px]">{title}</div>
      <p className="text-[14px] text-on-surface-variant mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function Row({ stock, rank, expanded, onToggle }: {
  stock: StockAnalysis; rank: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="border-b border-outline-variant last:border-0">
      <div onClick={onToggle} className="grid grid-cols-[2fr_repeat(3,1.1fr)_1.2fr_0.9fr_auto] gap-4 items-center px-6 py-4 cursor-pointer hover:bg-surface-container-low transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-on-surface-variant w-7 shrink-0">#{rank}</span>
          <LogoBox ticker={stock.ticker} index={rank - 1} />
          <div className="min-w-0">
            <div className="font-semibold text-on-surface text-[15px] truncate">{stock.company_name}</div>
            <div className="text-[13px] text-on-surface-variant truncate">{stock.sector || stock.group || 'B3'}</div>
          </div>
        </div>
        <Cell icon={<ArrowUpRight className="w-4 h-4 text-primary" />} label="Entrada" value={stock.entry_price} />
        <Cell icon={<Shield className="w-4 h-4 text-error" />} label="Stop" value={stock.stop_loss} />
        <Cell icon={<Crosshair className="w-4 h-4 text-primary" />} label="Alvo" value={stock.target_price} />
        <ProbBar value={stock.success_probability} />
        <ScoreGauge value={stock.strategy_score} />
        <ChevronDown className={'w-5 h-5 text-on-surface-variant transition-transform ' + (expanded ? 'rotate-180' : '')} />
      </div>
      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-5 pt-1 bg-surface-container-low/40">
          <div className="space-y-3">
            <div className="text-[15px] font-semibold text-on-surface">Análise da IA</div>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">{stock.analysis}</p>
          </div>
          <div className="space-y-3">
            <div className="text-[15px] font-semibold text-on-surface">Sinais Smart Money</div>
            <ul className="space-y-1.5">
              {stock.smart_money_signals.map((sig, i) => (
                <li key={i} className="text-[14px] text-on-surface-variant flex gap-2">
                  <span className="font-mono text-primary">{i + 1}.</span>
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {stock.gate_classification && <span className="text-[13px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">Gate: {stock.gate_classification}</span>}
              {stock.support_level_label && <span className="text-[13px] font-mono text-on-surface bg-surface-container rounded px-2 py-0.5 border border-outline-variant">Suporte: {stock.support_level_label}</span>}
              {stock.bottom_fishing_conclusion && <span className="text-[13px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">Bottom Fishing: {stock.bottom_fishing_conclusion}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogoBox({ ticker, index }: { ticker: string; index: number }) {
  const color = LOGO_COLORS[index % LOGO_COLORS.length];
  return (
    <span
      className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-[13px] shrink-0"
      style={{ background: color }}
    >
      {ticker.length > 5 ? ticker.slice(0, 5) : ticker}
    </span>
  );
}

function Cell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <div className="text-[12px] text-on-surface-variant">{label}</div>
        <div className="font-semibold text-on-surface text-[15px]">R$ {brl(value)}</div>
      </div>
    </div>
  );
}

function ProbBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="text-[12px] text-on-surface-variant mb-1.5">Probabilidade</div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: v + '%' }} />
        </div>
        <span className="text-[14px] font-semibold text-on-surface">{v}%</span>
      </div>
    </div>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-14 h-14">
          <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 28 28)" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[15px] font-bold text-on-surface">{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-[11px] text-on-surface-variant">/100</span>
    </div>
  );
}

/* ── Painel Resultado Simulador ───────────────────────────────────────────── */

function SimulatorPanel({ data, stocks, sim }: { data: AIRecommendation; stocks: StockAnalysis[]; sim: ReturnType<typeof calculatePortfolioDistribution> }) {
  const capitalBase = sim.totalInvested + sim.remainingCash;
  const investedPct = capitalBase > 0 ? (sim.totalInvested / capitalBase) * 100 : 0;
  const cashPct = capitalBase > 0 ? (sim.remainingCash / capitalBase) * 100 : 0;

  return (
    <TabPanel>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-on-surface">Simulador de Alocação</h2>
              <span className="text-[12px] font-mono uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">Distribuição em Tempo Real</span>
            </div>
            <p className="text-[15px] text-on-surface-variant mt-0.5">
              Otimização probabilística baseada em volume institucional e assimetria Risco:Retorno
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[13px] text-on-surface-variant block">Total Alocado:</span>
          <span className="text-xl font-bold font-mono text-on-surface">R$ {brl(sim.totalInvested)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp className="w-4 h-4 text-primary" />} label="RETORNO EST." value={'+' + pct(sim.totalExpectedReturnPercentage)} valueClass="text-primary" sub="Horizonte sugerido: 30 dias" />
        <StatCard icon={<Coins className="w-4 h-4 text-primary" />} label="LUCRO ESTIMADO" value={'+R$ ' + brl(sim.totalExpectedProfit)} valueClass="text-primary" sub="Projeção conservadora ponderada" />
        <StatCard icon={<PieChart className="w-4 h-4 text-primary" />} label="INVESTIDO" chip={pct(investedPct)} value={'R$ ' + brl(sim.totalInvested)} sub={'Distribuído em ' + sim.allocations.length + ' posições'} />
        <StatCard icon={<Wallet className="w-4 h-4 text-primary" />} label="CAIXA RESTANTE" chip={pct(cashPct)} value={'R$ ' + brl(sim.remainingCash)} sub="Reserva técnica de liquidez" />
      </div>

      <div className="rounded-xl border border-outline-variant bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-[16px] font-bold text-on-surface">Composição de Portfolio Simulado</h3>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          {sim.allocations.map((a, i) => (
            <div key={a.ticker} style={{ width: a.percentage + '%', background: LOGO_COLORS[i % LOGO_COLORS.length] }} />
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            {sim.allocations.map((a, i) => (
              <span key={a.ticker} className="flex items-center gap-1.5 text-[14px] text-on-surface">
                <span className="w-3 h-3 rounded-sm" style={{ background: LOGO_COLORS[i % LOGO_COLORS.length] }} />
                <span className="font-mono font-bold">{a.ticker}</span>
                <span className="text-on-surface-variant">({pct(a.percentage)} · R$ {brl(a.amount_to_invest)})</span>
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[14px] text-on-surface-variant">
            <span className="w-3 h-3 rounded-sm bg-surface-container-high" />
            Caixa Livre ({pct(cashPct)} · R$ {brl(sim.remainingCash)})
          </span>
        </div>
        <div className="text-[14px] text-on-surface-variant">Capital Base: <span className="font-mono text-on-surface">R$ {brl(capitalBase)}</span></div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-[16px] font-bold text-on-surface">Ações Incluídas no Investimento ({sim.allocations.length} de {stocks.length})</h3>
          </div>
          <span className="text-[14px] text-on-surface-variant">Total Alocado: <span className="font-mono text-on-surface font-bold">R$ {brl(sim.totalInvested)}</span></span>
        </div>

        {sim.allocations.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sim.allocations.map((a, i) => {
              const stock = stocks.find(s => s.ticker === a.ticker);
              if (!stock) return null;
              return <AllocationCard key={a.ticker} alloc={a} stock={stock} accent={LOGO_COLORS[i % LOGO_COLORS.length]} />;
            })}
          </div>
        ) : (
          <p className="text-[15px] text-on-surface-variant">Capital insuficiente para alocar em pelo menos 1 cota de qualquer ativo recomendado.</p>
        )}

        {sim.excludedAllocations.length > 0 && (
          <div className="border-t border-outline-variant/50 pt-3">
            <p className="text-[14px] text-on-surface-variant mb-2 font-semibold">Ações Excluídas ({sim.excludedAllocations.length} de {stocks.length})</p>
            <div className="space-y-1.5">
              {sim.excludedAllocations.map(ex => (
                <div key={ex.ticker} className="text-[14px] text-on-surface-variant">
                  <span className="font-mono text-on-surface">{ex.ticker}</span> — {ex.reasoning}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.ai_recommendation?.summary && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-[16px] font-bold text-on-surface">Resumo Executivo da IA</h3>
            </div>
            <span className="text-[13px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">Conclusão: Alocação Otimizada</span>
          </div>
          <p className="text-[15px] text-on-surface-variant leading-relaxed">{data.ai_recommendation.summary}</p>
        </div>
      )}
    </TabPanel>
  );
}

function StatCard({ icon, label, value, valueClass, sub, chip }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string; sub: string; chip?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</span>
        {chip ? (
          <span className="text-[12px] font-mono text-on-surface-variant bg-surface-container rounded px-1.5 py-0.5">{chip}</span>
        ) : (
          <span>{icon}</span>
        )}
      </div>
      <div className={'text-2xl font-bold font-mono ' + (valueClass ?? 'text-on-surface')}>{value}</div>
      <div className="text-[13px] text-on-surface-variant mt-1">{sub}</div>
    </div>
  );
}

function AllocationCard({ alloc, stock, accent }: { alloc: PortfolioAllocation; stock: StockAnalysis; accent: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-on-surface font-mono text-[14px] font-bold border border-outline-variant">
            <span className="w-2 h-2 rounded-sm" style={{ background: accent }} />
            {alloc.ticker}
          </span>
          <span className="text-[13px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">{pct(alloc.percentage)}</span>
        </div>
        <div className="text-right">
          <span className="text-[15px] font-bold font-mono text-on-surface">R$ {brl(alloc.amount_to_invest)}</span>
          <span className="text-[13px] text-on-surface-variant ml-1">{alloc.shares_to_buy} cota(s)</span>
        </div>
      </div>
      <div className="text-[15px] text-on-surface font-medium">{stock.company_name}</div>
      <div className="text-[14px] text-on-surface-variant">{alloc.reasoning}</div>
      <div className="grid grid-cols-3 gap-2 border-t border-outline-variant/50 pt-3">
        <MiniStat label="Cotação" value={'R$ ' + brl(stock.entry_price)} />
        <MiniStat label="ALVO MÉDIO" value={'R$ ' + brl(stock.target_price)} />
        <MiniStat label="LUCRO PROJ." value={'+R$ ' + brl(alloc.expected_profit)} accent />
      </div>
      <div className="text-[14px] text-on-surface-variant flex items-center gap-2 flex-wrap">
        Tese Tática:
        <span className="text-on-surface">{stock.bottom_fishing_conclusion === 'SIM' ? 'Bottom Fishing' : 'Alocação Ativa'}</span>
        {stock.risk_reward_ratio > 0 && <span className="text-on-surface-variant">· R:R 1:{stock.risk_reward_ratio}</span>}
        {stock.support_level_label && <span className="text-on-surface-variant">· Suporte {stock.support_level_label}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-container-low border border-outline-variant/60 px-2 py-1.5">
      <div className="text-[12px] font-mono uppercase text-on-surface-variant">{label}</div>
      <div className={'text-[14px] font-mono font-bold ' + (accent ? 'text-primary' : 'text-on-surface')}>{value}</div>
    </div>
  );
}
