/**
 * gateBottomFishing.ts — Smart Money Tracker AI v3.2
 *
 * CAMADA DETERMINÍSTICA — 100% sem chamada de IA.
 *
 * O Gate responde uma pergunta objetiva:
 *   "Vale a pena gastar processamento de IA neste ativo?"
 *
 * Isso é deliberadamente diferente da pergunta que a Luna responde:
 *   "O que os dados desse candidato indicam?"
 *
 * Critérios do Gate (todos objetivos, nenhum exige interpretação):
 *   1. Queda relevante nos últimos N pregões             (GATE_DROP_PERCENT / GATE_DROP_PERIOD)
 *   2. Proximidade da mínima de 252 pregões              (GATE_MIN_DISTANCE)
 *      ↳ Este critério serve também como proxy determinístico de "existência de região de suporte":
 *        se o ativo está perto da mínima histórica, existe uma referência de preço identificável.
 *        A QUALIDADE desse suporte (quão forte ele é) permanece com a Luna.
 *   3. Volume financeiro médio adequado                   (GATE_MIN_VOLUME em R$)
 *   4. Volatilidade mínima (ATR%)                         (GATE_MIN_ATR)
 *
 * Classificação de saída:
 *   CANDIDATO FORTE  — todos os 4 critérios atendidos E (queda ≥ 20% OU distância ≤ 5%)
 *   CANDIDATO        — todos os 4 critérios atendidos (dentro dos thresholds mínimos)
 *   REJEITADO        — pelo menos um critério não atendido
 *
 * Nota sobre CANDIDATO vs CANDIDATO FORTE:
 *   A doc 3.2 define os critérios mínimos mas não especifica o corte entre as duas
 *   classificações positivas. A decisão de design adotada aqui é: confluência de
 *   critérios atendidos com folga confortável indica configuração mais robusta,
 *   resultando em CANDIDATO FORTE. O corte escolhido — queda ≥ 20% OU distância ≤ 5%
 *   — representa confluência clara de pressão e proximidade de suporte histórico.
 *
 * Parâmetros configuráveis:
 *   Todos os thresholds são parâmetros externos (não hardcoded na lógica de IA),
 *   permitindo ajuste via ConfigTab e testes via backtest sem alterar prompts.
 *   Defaults alinhados com a tabela da seção 10.2 da documentação.
 */

import { StockCache } from '../lib/supabase';

// ─── Parâmetros ────────────────────────────────────────────────────────────────

export interface GateParams {
  /** Queda mínima (%) para qualificar como candidato. Default: 15 */
  GATE_DROP_PERCENT: number;
  /**
   * Período da queda em pregões, mapeado para: usamos ytd_return_pct ou
   * drop_from_high como proxy, já que não temos série diária granular.
   * Valor mantido como referência de configuração. Default: 60
   */
  GATE_DROP_PERIOD: number;
  /**
   * Distância máxima (%) acima da mínima de 252 pregões para ser candidato.
   * Também serve como critério determinístico de "suporte identificável":
   * estar perto da mínima histórica = existe referência de preço. Default: 10
   */
  GATE_MIN_DISTANCE: number;
  /** Volume financeiro médio mínimo (R$). Default: 20_000_000 */
  GATE_MIN_VOLUME: number;
  /** ATR mínimo (%). Calculado como proxy via volatilidade disponível. Default: 3 */
  GATE_MIN_ATR: number;
  /** Lookback para mínima histórica em pregões. Default: 252 */
  GATE_LOOKBACK_LOW: number;
}

export const DEFAULT_GATE_PARAMS: GateParams = {
  GATE_DROP_PERCENT:  15,
  GATE_DROP_PERIOD:   60,
  GATE_MIN_DISTANCE:  10,
  GATE_MIN_VOLUME:    20_000_000,
  GATE_MIN_ATR:       3,
  GATE_LOOKBACK_LOW:  252,
};

export const GATE_PARAMS_STORAGE_KEY = 'gate_bottom_fishing_params';

/** Lê parâmetros do Gate do localStorage (com fallback para defaults). */
export function loadGateParams(): GateParams {
  try {
    const raw = localStorage.getItem(GATE_PARAMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GateParams>;
      return { ...DEFAULT_GATE_PARAMS, ...parsed };
    }
  } catch {
    // silently fall through
  }
  return { ...DEFAULT_GATE_PARAMS };
}

/** Persiste parâmetros do Gate no localStorage. */
export function saveGateParams(params: GateParams): void {
  localStorage.setItem(GATE_PARAMS_STORAGE_KEY, JSON.stringify(params));
}

// ─── Tipos de saída ────────────────────────────────────────────────────────────

export type GateClassification = 'REJEITADO' | 'CANDIDATO' | 'CANDIDATO FORTE';

export interface GateCriterionResult {
  name: string;
  passed: boolean;
  value: string;
  threshold: string;
}

export interface GateResult {
  ticker: string;
  classification: GateClassification;
  /** Critérios individuais para auditoria e log */
  criteria: GateCriterionResult[];
  /** Queda calculada em relação à máxima de 52 semanas (%) */
  gate_drop_pct: number;
  /** Distância acima da mínima de 52 semanas (%) */
  gate_distance_pct: number;
  /** Volume financeiro estimado (preço × volume médio) em R$ */
  gate_volume_financial: number;
  /** ATR estimado disponível (%) */
  gate_atr_pct: number;
  /** Motivos formatados para exibição */
  reasons: string[];
}

// ─── Função principal ──────────────────────────────────────────────────────────

/**
 * Executa o Gate Bottom Fishing para um único ativo.
 *
 * Regra de Modo:
 *   O Gate só se aplica ao Modo Descoberta.
 *   Modo Posição = dados de posição (quantidade + preço_médio) presentes → Gate ignorado.
 *   O chamador é responsável por detectar o modo antes de invocar esta função.
 *
 * Dados utilizados (todos vindos do cache Supabase — zero chamadas de API):
 *   current_price        — preço atual
 *   fundamentals.week_52_high  — máxima de 52 semanas (proxy para queda)
 *   fundamentals.week_52_low   — mínima de 52 semanas (proxy para distância e suporte)
 *   fundamentals.avg_volume_52w — volume médio (em unidades de ações)
 *   current_price × avg_volume_52w → volume financeiro estimado em R$
 *
 * Limitações conhecidas (documentadas):
 *   - Não há série OHLCV diária disponível via StockCache, então usamos
 *     week_52_high/low como referência para queda e distância.
 *     O cálculo de ATR preciso exige série diária; usamos a volatilidade implícita
 *     (range entre high e low de 52 semanas em relação ao preço atual) como proxy.
 *   - Volume financeiro = preço_atual × avg_volume_52w. Se avg_volume_52w for em
 *     quantidade de ações, a conversão é direta. Se já for financeiro, o produto
 *     superestimaria — o campo no Supabase deve ser validado pelo operador.
 */
export function applyGate(
  stock: StockCache,
  params: GateParams = DEFAULT_GATE_PARAMS
): GateResult {
  const ticker = stock.ticker.toUpperCase();
  const price = stock.current_price || 0;
  const fund = stock.fundamentals || {};

  const high52w = fund.week_52_high as number | undefined;
  const low52w  = fund.week_52_low  as number | undefined;
  const avgVol  = fund.avg_volume_52w as number | undefined;

  // ── Cálculos brutos ────────────────────────────────────────────────────────

  // Queda: de onde o ativo está em relação à máxima de 52 semanas
  const dropPct = (high52w && high52w > 0 && price > 0)
    ? ((high52w - price) / high52w) * 100
    : 0;

  // Distância da mínima: quanto o ativo subiu acima da mínima histórica
  const distancePct = (low52w && low52w > 0 && price > 0)
    ? ((price - low52w) / low52w) * 100
    : 999; // sem dado = não consegue confirmar proximidade = falha

  // Volume financeiro estimado (R$ por pregão)
  // avg_volume_52w está em quantidade de ações → multiplicar pelo preço atual
  const volumeFinancial = (avgVol && avgVol > 0 && price > 0)
    ? avgVol * price
    : 0;

  // ATR proxy: range de 52 semanas como % do preço atual (estimativa conservadora)
  // Range de 52s / preço_atual → dividido por 252 pregões × sqrt(252) para anualizar de volta para daily
  // Simplificação: usamos (high52w - low52w) / price / sqrt(252) como ATR diário %
  const atrPct = (high52w && low52w && price > 0 && high52w > low52w)
    ? ((high52w - low52w) / price / Math.sqrt(params.GATE_LOOKBACK_LOW)) * 100
    : 0;

  // ── Avaliação de critérios ─────────────────────────────────────────────────

  const criteria: GateCriterionResult[] = [
    {
      name: 'Queda relevante',
      passed: dropPct >= params.GATE_DROP_PERCENT,
      value: dropPct > 0 ? `${dropPct.toFixed(1)}%` : 'DADO NÃO DISPONÍVEL',
      threshold: `≥ ${params.GATE_DROP_PERCENT}%`,
    },
    {
      name: 'Proximidade da mínima (suporte identificável)',
      // Observação: este critério também serve como confirmação determinística de
      // que existe uma região de preço identificável (a mínima histórica).
      // A QUALIDADE do suporte nessa região é avaliada pela Luna.
      passed: distancePct <= params.GATE_MIN_DISTANCE,
      value: distancePct < 999 ? `${distancePct.toFixed(1)}% acima da mínima` : 'DADO NÃO DISPONÍVEL',
      threshold: `≤ ${params.GATE_MIN_DISTANCE}% acima da mínima de ${params.GATE_LOOKBACK_LOW}p`,
    },
    {
      name: 'Volume financeiro',
      passed: volumeFinancial >= params.GATE_MIN_VOLUME,
      value: volumeFinancial > 0
        ? `R$ ${(volumeFinancial / 1_000_000).toFixed(1)}M`
        : 'DADO NÃO DISPONÍVEL',
      threshold: `≥ R$ ${(params.GATE_MIN_VOLUME / 1_000_000).toFixed(0)}M`,
    },
    {
      name: 'Volatilidade (ATR proxy)',
      passed: atrPct >= params.GATE_MIN_ATR,
      value: atrPct > 0 ? `${atrPct.toFixed(2)}%` : 'DADO NÃO DISPONÍVEL',
      threshold: `≥ ${params.GATE_MIN_ATR}%`,
    },
  ];

  const allPassed = criteria.every(c => c.passed);

  // ── Classificação ──────────────────────────────────────────────────────────

  let classification: GateClassification;

  if (!allPassed) {
    classification = 'REJEITADO';
  } else if (dropPct >= 20 || distancePct <= 5) {
    // Confluência forte: queda expressiva OU muito próximo da mínima histórica
    classification = 'CANDIDATO FORTE';
  } else {
    classification = 'CANDIDATO';
  }

  // ── Montagem de reasons para log/exibição ─────────────────────────────────

  const reasons: string[] = criteria.map(c =>
    `${c.passed ? '✓' : '✗'} ${c.name}: ${c.value} (threshold: ${c.threshold})`
  );

  return {
    ticker,
    classification,
    criteria,
    gate_drop_pct: dropPct,
    gate_distance_pct: distancePct < 999 ? distancePct : -1,
    gate_volume_financial: volumeFinancial,
    gate_atr_pct: atrPct,
    reasons,
  };
}

/**
 * Aplica o Gate para um lote de ativos.
 * Retorna o resultado completo para todos — inclui REJEITADOS (para auditoria).
 */
export function applyGateBatch(
  stocks: StockCache[],
  params: GateParams = DEFAULT_GATE_PARAMS
): {
  passed: { stock: StockCache; gateResult: GateResult }[];
  rejected: { stock: StockCache; gateResult: GateResult }[];
  stats: {
    total: number;
    candidatos: number;
    candidatosFortes: number;
    rejeitados: number;
  };
} {
  const passed: { stock: StockCache; gateResult: GateResult }[] = [];
  const rejected: { stock: StockCache; gateResult: GateResult }[] = [];

  for (const stock of stocks) {
    const result = applyGate(stock, params);
    if (result.classification === 'REJEITADO') {
      rejected.push({ stock, gateResult: result });
    } else {
      passed.push({ stock, gateResult: result });
    }
  }

  const candidatosFortes = passed.filter(p => p.gateResult.classification === 'CANDIDATO FORTE').length;

  console.log(`\n🚦 [Gate Bottom Fishing v3.2] Resultado:`);
  console.log(`   Total avaliados:    ${stocks.length}`);
  console.log(`   CANDIDATO FORTE:    ${candidatosFortes}`);
  console.log(`   CANDIDATO:          ${passed.length - candidatosFortes}`);
  console.log(`   REJEITADO:          ${rejected.length}`);
  console.log(`   → Avançam para Luna: ${passed.length} (${rejected.length} sem custo de IA)`);

  return {
    passed,
    rejected,
    stats: {
      total: stocks.length,
      candidatos: passed.length - candidatosFortes,
      candidatosFortes,
      rejeitados: rejected.length,
    },
  };
}

/**
 * Formata o resultado do Gate para inclusão no contexto da Luna e do AuditManager.
 */
export function formatGateResultForContext(result: GateResult): string {
  return [
    `Gate Bottom Fishing: ${result.classification}`,
    ...result.reasons,
  ].join('\n');
}
