import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, Monitor, XCircle, Check, Search, RefreshCw
} from 'lucide-react';

interface TelemetryRow {
  id: number;
  state: 'ok' | 'process' | 'wait';
  ticker: string;
  detail: string;
  badge: { label: string; tone: 'green' | 'gray' };
}

// Pool ilustrativo do feed de triagem (mesmo estilo do anexo).
const POOL: Omit<TelemetryRow, 'id'>[] = [
  { state: 'ok',      ticker: 'PETR4', detail: 'Vol. Institucional +4.2σ',              badge: { label: 'Triagem Aprovada', tone: 'green' } },
  { state: 'ok',      ticker: 'VALE3', detail: 'Delta agressão comprador > R$ 85M',    badge: { label: 'Triagem Aprovada', tone: 'green' } },
  { state: 'process', ticker: 'BBAS3', detail: 'Avaliando fluxo de blocos & VWAP',     badge: { label: 'Processando...',   tone: 'gray' } },
  { state: 'wait',    ticker: 'ITUB4', detail: 'Aguardando liquidação de livro de ofertas', badge: { label: 'Fila de espera', tone: 'gray' } },
  { state: 'ok',      ticker: 'WEGE3', detail: 'Compra institucional detectada',       badge: { label: 'Triagem Aprovada', tone: 'green' } },
  { state: 'ok',      ticker: 'BBDC4', detail: 'Volume anômalo 3.1σ',                  badge: { label: 'Triagem Aprovada', tone: 'green' } },
  { state: 'process', ticker: 'ABEV3', detail: 'Atualizando dados de fluxo',           badge: { label: 'Processando...',   tone: 'gray' } },
  { state: 'wait',    ticker: 'PETR3', detail: 'Aguardando janela de liquidez',        badge: { label: 'Fila de espera', tone: 'gray' } },
  { state: 'ok',      ticker: 'ITSA4', detail: 'Compra líquida agressora',             badge: { label: 'Triagem Aprovada', tone: 'green' } },
  { state: 'process', ticker: 'GGBR4', detail: 'Verificando sustentação de volume',    badge: { label: 'Processando...',   tone: 'gray' } },
];

const STEP_TITLES: Record<number, string> = {
  1: 'Triagem & Filtros Quantitativos',
  2: 'Supabase Sync',
  3: 'IA + Conhecimento',
};

export function AnalyzingScreen({
  currentStep,
  progressMsg,
  onCancel,
}: {
  currentStep: number;
  progressMsg: string;
  onCancel: () => void;
}) {
  // Mapeia o progresso real (currentStep + mensagem) para o indicador de 3 etapas do anexo.
  const step = computeStep(currentStep, progressMsg);

  const [telemetry, setTelemetry] = useState<TelemetryRow[]>(() =>
    POOL.slice(0, 4).map((r, i) => ({ ...r, id: i }))
  );
  const [rate, setRate] = useState(1240);
  const nextId = useRef(4);
  const cursor = useRef(4);
  const listRef = useRef<HTMLDivElement>(null);
  const telegramOn = useRef(true);

  // Simula o fluxo ao vivo da telemetria enquanto o pipeline roda.
  useEffect(() => {
    telegramOn.current = true;

    const rowTimer = setInterval(() => {
      if (cursor.current < POOL.length) {
        const next = POOL[cursor.current];
        setTelemetry(prev => {
          const rows = [...prev, { ...next, id: nextId.current++ }];
          return rows.length > 9 ? rows.slice(rows.length - 9) : rows;
        });
        cursor.current++;
      }
    }, 700);

    const rateTimer = setInterval(() => {
      setRate(r => Math.max(900, Math.min(1800, r + Math.floor(Math.random() * 180) - 80)));
    }, 900);

    return () => {
      telegramOn.current = false;
      clearInterval(rowTimer);
      clearInterval(rateTimer);
    };
  }, []);

  // Mantém o console sempre mostrando a linha mais recente.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [telemetry]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header da análise */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0">
        <h1 className="text-lg font-bold text-on-surface">Analisar</h1>
        <span className="text-[13px] font-mono text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-0.5">Terminal B3</span>
        <span className="flex items-center gap-2 text-[14px] text-on-surface border border-outline-variant rounded-full px-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Status: Executando Etapa {step} / 3
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative hidden md:block w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              placeholder="Ticker (ex: PETR4, VALE...)"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <button className="flex items-center gap-1.5 text-[14px] font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg px-2.5 py-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Sincronizado
          </button>
        </div>
      </div>

      {/* Conteúdo central */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10 overflow-y-auto">
        {/* Ícone animado */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full bg-primary/20 blur-2xl" />
          <div className="absolute w-24 h-24 rounded-full border border-primary/20" />
          <div className="relative w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center analyzing-glow">
            <ArrowDown className="w-8 h-8 text-primary" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Executando Análise Inteligente</h2>
          <p className="text-[15px] text-on-surface-variant mt-1.5">Módulo de Varredura Institucional de Fluxo em Tempo Real</p>
        </div>

        {/* Box de status da etapa */}
        <div className="w-full max-w-3xl rounded-xl border border-primary/30 bg-primary/5 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[13px] font-mono uppercase tracking-widest text-primary">
                Etapa {step} de 3: {STEP_TITLES[step]}
              </span>
            </div>
            <span className="text-[13px] font-mono text-on-surface-variant">Taxa: {rate.toLocaleString('pt-BR')} msg/s</span>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {progressMsg || 'Consultando base B3 e executando varredura quantitativa em tempo real sobre ativos elegíveis...'}
          </p>
        </div>

        {/* Etapas do pipeline */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <StepChip n={1} label="Triagem & Filtros" state={step > 1 ? 'done' : step === 1 ? 'active' : 'idle'} />
          <ArrowRight className="w-4 h-4 text-on-surface-variant" />
          <StepChip n={2} label="Supabase Sync" state={step > 2 ? 'done' : step === 2 ? 'active' : 'idle'} />
          <ArrowRight className="w-4 h-4 text-on-surface-variant" />
          <StepChip n={3} label="IA + Conhecimento" state={step > 3 ? 'done' : step === 3 ? 'active' : 'idle'} />
        </div>

        {/* Telemetry Console */}
        <div className="w-full max-w-3xl rounded-xl border border-outline-variant/70 bg-surface-container-low/70 backdrop-blur overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              <span className="text-[15px] font-semibold text-on-surface">Telemetry Console — Pipeline Live Stream</span>
            </div>
            <span className="text-[13px] font-mono text-primary tracking-widest">ONLINE</span>
          </div>
          <div ref={listRef} className="px-4 py-3 space-y-2.5 max-h-56 overflow-y-auto">
            {telemetry.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <span className={'font-mono text-[14px] w-9 shrink-0 ' + stateColor(r.state)}>{stateLabel(r.state)}</span>
                <span className="font-mono text-[14px] text-on-surface font-bold w-16 shrink-0">{r.ticker}</span>
                <span className={'text-[14px] flex-1 truncate ' + (r.state === 'wait' ? 'text-on-surface-variant' : 'text-on-surface')}>{r.detail}</span>
                <span className={badgeCls(r.badge.tone)}>{r.badge.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancelar */}
        <div className="w-full max-w-3xl flex justify-end">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors text-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            Cancelar Análise
          </button>
        </div>
      </div>
    </div>
  );
}

function computeStep(currentStep: number, msg: string): number {
  const m = (msg || '').toLowerCase();
  if (
    m.includes('sol') || m.includes('revis') || m.includes('análise profunda') ||
    m.includes('conhecimento') || m.includes('consultando base') || m.includes('layers') ||
    m.includes('profunda')
  )
    return 3;
  if (m.includes('supabase') || m.includes('verificando') || m.includes('sync')) return 2;
  if (currentStep >= 5) return 3;
  return 1;
}

function StepChip({ n, label, state }: { n: number; label: string; state: 'active' | 'done' | 'idle' }) {
  const activeCls = 'border-primary/50 bg-primary/10 text-primary';
  const doneCls = 'border-primary/30 bg-primary/5 text-primary';
  const idleCls = 'border-outline-variant bg-surface-container-low text-on-surface-variant';
  return (
    <div className={'flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[14px] font-semibold ' + (state === 'active' ? activeCls : state === 'done' ? doneCls : idleCls)}>
      <span className="font-mono">{n}.</span>
      <span>{label}</span>
      {state === 'done' && <Check className="w-3.5 h-3.5" />}
    </div>
  );
}

function stateLabel(state: TelemetryRow['state']) {
  return state === 'ok' ? '[OK]' : state === 'process' ? '[●]' : '[--]';
}

function stateColor(state: TelemetryRow['state']) {
  return state === 'ok' ? 'text-primary' : state === 'process' ? 'text-warning' : 'text-on-surface-variant';
}

function badgeCls(tone: 'green' | 'gray') {
  return tone === 'green'
    ? 'text-[13px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 whitespace-nowrap'
    : 'text-[13px] font-mono px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant whitespace-nowrap';
}
