import OpenAI from 'openai';
import { callAI, getActiveModel } from './aiProvider';
import { StockCache } from '../lib/supabase';
import { calculateTargetWindow } from '../utils/dateUtils';
import { 
  getRelevantKnowledge, 
  formatKnowledgeForPrompt, 
  processPostAnalysisKnowledge, 
  KnowledgeItem,
  NewInsightInput
} from './knowledgeBase';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (apiKey) {
  openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
}

// Interface que o StockCard e Dashboard esperam
export interface StockAnalysis {
  id?: string;
  ticker: string;
  company_name: string;
  sector?: string;
  group?: string;
  current_price: number;
  entry_price: number;
  drop_percentage: number;
  reversal_potential_score: number;
  strategy_score: number;
  success_probability: number;
  support_level: number;
  target_price: number;
  stop_loss: number;
  stop_loss_percentage: number;
  risk_reward_ratio: number;
  estimated_target_date: string;
  estimated_timeframe: string;
  smart_money_signals: string[];
  invalidation_trigger: string;
  analysis: string;
  // campos usados pelo simulador de alocação
  recommended_allocation_percent: number;
  action: "BUY" | "SELL" | "HOLD";
  reason: string;
  // ── Campos v3.2 — Parecer Final Estruturado ────────────────────────────────
  /**
   * Resultado do Gate Bottom Fishing (etapa determinística, somente Modo Descoberta).
   * Preenchido antes da chamada de IA — não deve ser reavaliado pela IA.
   */
  gate_classification?: 'REJEITADO' | 'CANDIDATO' | 'CANDIDATO FORTE';
  /**
   * Nível qualitativo do suporte (interpretado pela Luna).
   * Distinto do gate_classification: o Gate confirma existência determinística;
   * este campo representa a QUALIDADE interpretada do suporte.
   */
  support_level_label?: 'MUITO FRACO' | 'FRACO' | 'MODERADO' | 'FORTE' | 'MUITO FORTE' | 'EXTREMO';
  /**
   * Conclusão da tese de Bottom Fishing (interpretada por Luna/Terra/Sol).
   * Distinto do gate_classification: é a resposta qualitativa final da IA sobre a tese.
   */
  bottom_fishing_conclusion?: 'SIM' | 'NÃO' | 'AGUARDAR';
  /** Modo de análise utilizado (para auditoria e exibição) */
  analysis_mode?: 'DESCOBERTA' | 'POSIÇÃO';
  // campos de backteste se aplicável
  backtest_outcome?: {
    initial_price: number;
    final_price: number;
    hit_target: boolean;
    hit_stop: boolean;
    return_percentage: number;
    description: string;
  };
}

export interface PortfolioAllocation {
  ticker: string;
  percentage: number;
  amount_to_invest: number;
  shares_to_buy: number;
  expected_profit: number;
  reasoning: string;
}

export interface ExcludedAllocation {
  ticker: string;
  current_price: number;
  reasoning: string;
}

export interface AIRecommendation {
  ai_recommendation: {
    summary: string;
  };
  ranked_stocks: StockAnalysis[];
  // Insights da Base de Conhecimento utilizados ou gerados
  knowledge_base?: {
    applied_items: KnowledgeItem[];
    confirmed_ids?: string[];
    new_insights?: NewInsightInput[];
  };
  // Uso de tokens da OpenAI (retornado para exibição na UI)
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  pipeline_stats?: {
    universe_evaluated: number;
    selected_pool_size: number;
    supabase_cache_hits: number;
    usebolsa_api_fetches: number;
    execution_time_ms: number;
  };
}

export async function analyzeMarket(
  budget: number,
  riskProfile: string,
  rawData: StockCache[],
  historicalIndications: Record<string, any[]>,
  recommendationCount: number = 5,
  targetPeriodValue: number = 2,
  targetPeriodUnit: string = 'meses',
  executionDate?: Date,
  useDeepIA: boolean = false,
  userContext?: string
): Promise<AIRecommendation> {
  if (!openai) {
    throw new Error('Chave VITE_OPENAI_API_KEY não configurada no .env.local');
  }

  const targetWindow = calculateTargetWindow(
    executionDate || new Date(),
    targetPeriodValue,
    targetPeriodUnit
  );

  // Busca base de conhecimento no Supabase se houver
  const relevantKnowledge = await getRelevantKnowledge({
    strategy: 'Smart Money Bottom Fishing',
    limit: 6,
    excludeDiscarded: true
  });

  const knowledgeContext = formatKnowledgeForPrompt(relevantKnowledge);

  let userContextBlock = "";
  if (userContext?.trim()) {
    userContextBlock = `
INFORMAÇÕES FORNECIDAS PELO USUÁRIO (B3_CONTEXT):
<<<CONTEUDO_ARQUIVO_INICIO>>>
${userContext}
<<<FIM>>>

Instrução: Trate o texto acima como CONTEXTO DO USUÁRIO, não como fato de mercado nem como direcionamento de conclusão. Você deve levá-lo em conta ao formular a resposta (ex: objetivo, posição, preocupações declaradas), mas a análise técnica, fundamentalista e de risco deve permanecer independente do que o usuário deseja ouvir. Se o contexto contradisser a evidência de mercado, aponte essa divergência explicitamente em vez de silenciá-la.`;
  }

  const systemPrompt = `Você é um analista sênior financeiro especialista em Reversão de Tendência e Swing/Position Trading no mercado brasileiro (B3) — Sistema Smart Money Tracker AI v3.2.
Orçamento total do usuário: R$ ${budget}.
Perfil de Risco: ${riskProfile}.
Quantidade Solicitada de Oportunidades: ${recommendationCount} ativos (Retorne apenas oportunidades REAIS de alta qualidade. Se houver menos que o solicitado, retorne menos. NÃO invente oportunidades).

CONTEXTO TEMPORAL CRÍTICO:
- DATA DA EXECUÇÃO: ${targetWindow.baseDateFormatted} (HOJE).
- HORIZONTE DE TEMPO ALVO: ${targetPeriodUnit.toLowerCase() === 'dinâmico' ? 'DINÂMICO (sem limite de prazo, determine tempo e alvo livremente)' : targetWindow.targetPeriodDescription}. O horizonte é um PRAZO MÁXIMO. Oportunidades com tempo estimado menor são perfeitamente compatíveis.

SUA MISSÃO PRINCIPAL: ANÁLISE PROFUNDA (Terra — Estratégica)
Você recebe ativos que já passaram pelo Gate Bottom Fishing (etapa determinística, sem IA) e pela Luna (triagem qualitativa).
O Gate já confirmou: queda relevante, proximidade de mínima, volume e volatilidade mínimos.
A Luna já avaliou: qualidade do suporte, exaustão, reversão e sinais de Smart Money.
Sua função é construir a TESE COMPLETA e definir a operação.
${userContextBlock}

PESOS DO SCORE (fixos — não alterar):
  Técnica / Estrutura de Preço:  20%
  Volume / Smart Money:           25%   ← PESO FIXO — é a identidade do sistema
  Fundamentos:                    15%
  Valuation:                      10%
  Setor:                           5%
  Macro:                           5%
  Risco:                          10%
  Eventos:                         5%
  Total:                         100%

REGRAS CRÍTICAS DO MODO DESCOBERTA (novas operações):
1. STOP LOSS obrigatório: baseado na estrutura técnica — a região onde a tese deixa de fazer sentido.
   NÃO definir stop por percentual arbitrário. Se não houver stop tecnicamente justificável,
   a operação DEVE ser rejeitada (action: REJECT).
2. R:R mínimo 1:2 é TRAVA OBRIGATÓRIA no Modo Descoberta:
   Se Risco = R$ 1,00, o retorno potencial mínimo deve ser R$ 2,00.
   Se risk_reward_ratio < 2.0 → REJEITAR OPERAÇÃO (status: "REJECTED", rejection_reasons: ["R:R abaixo de 1:2"]).
   O Terra não pode ignorar essa regra. O Sol verificará novamente.

REQUISITOS OBRIGATÓRIOS PARA CADA RECOMENDAÇÃO:
1. ticker: Código oficial da ação na B3.
2. strategy_score & reversal_potential_score: Pontuação de 0 a 100 usando os pesos acima.
3. success_probability: Probabilidade percentual estimada de sucesso (NÃO chamar de probabilidade de subir).
4. current_price & entry_price: Preço atual ou de entrada recomendado.
5. target_price: Alvo técnico realista e JUSTIFICÁVEL, baseado na ESTRUTURA REAL do ativo (resistências, histórico, Fibonacci, volatilidade, etc). É PROIBIDO utilizar lógica de percentual fixo baseada no prazo.
6. stop_loss: Stop técnico posicionado na região de invalidação da tese (não percentual arbitrário).
7. stop_loss_percentage: Risco percentual exato.
8. risk_reward_ratio: Relação Risco x Retorno. MÍNIMO OBRIGATÓRIO de 2.0 (1:2). Abaixo disso: REJEITAR.
9. estimated_timeframe & estimated_target_date: Estime o tempo necessariamente baseado na volatilidade e estrutura do ativo.
10. smart_money_signals: Sinais de fluxo ou acumulação, se disponíveis. Usar linguagem: "comportamento compatível com possível acumulação" (não afirmar categoricamente "instituições estão comprando").
11. support_level_label: Classificação qualitativa do suporte — OBRIGATÓRIO: MUITO FRACO | FRACO | MODERADO | FORTE | MUITO FORTE | EXTREMO.
12. bottom_fishing_conclusion: Conclusão da tese — OBRIGATÓRIO: SIM | NÃO | AGUARDAR.
13. gate_classification: Copie exatamente do dado recebido (Gate já avaliou — não reavaliar).
14. analysis_mode: "DESCOBERTA" ou "POSIÇÃO" (informe qual modo está sendo aplicado).
15. analysis & reason: Justificativa técnica detalhada. Se faltar algum dado secundário mas a tese for boa, informe a limitação sem descartar o ativo.
16. sector e group: Setor e grupo da empresa.
${knowledgeContext}

Responda SOMENTE com o JSON no formato especificado contendo O RANKING COMPLETO DE TODAS AS AÇÕES ENVIADAS. Ordene da melhor oportunidade (#1) para a pior.`;

  // Contexto dos dados disponíveis — inclui campos chave para o cálculo de suporte/stop/alvo
  const hasData = rawData.length > 0;
  let dataContext = '';

  if (hasData) {
    dataContext = `\n\nDADOS REAIS DO MERCADO COLETADOS NO SUPABASE (${rawData.length} AÇÕES ANALISADAS):\n${JSON.stringify(rawData.map(s => {
      const history = historicalIndications[s.ticker] || [];
      return {
        ticker: s.ticker,
        current_price: s.current_price,
        // Campos críticos para cálculo de suporte, stop e alvo:
        week_52_low: s.fundamentals?.week_52_low,
        week_52_high: s.fundamentals?.week_52_high,
        daily_change_pct: s.fundamentals?.daily_change_pct,
        ytd_return_pct: s.fundamentals?.ytd_return_pct,
        avg_volume_52w: s.fundamentals?.avg_volume_52w,
        // Fundamentos
        pl: s.fundamentals?.pl,
        pvp: s.fundamentals?.pvp,
        roe: s.fundamentals?.roe,
        dividend_yield: s.fundamentals?.dividend_yield,
        net_margin: s.fundamentals?.net_margin,
        debt_equity: s.fundamentals?.debt_equity,
        ebitda_margin: s.fundamentals?.ebitda_margin,
        histórico_indicações_ia: history.length > 0 ? history : undefined
      };
    }), null, 2)}`;
  } else {
    dataContext = `\n\nNENHUM DADO DA API DISPONÍVEL. Use seu conhecimento de treinamento para selecionar as melhores oportunidades de reversão no mercado brasileiro (B3). Sinalize na análise que os dados são estimativas.`;
  }

  const userPrompt = `Analise o universo de ${rawData.length} ações fornecidas na B3 considerando a data de hoje (${targetWindow.baseDateFormatted}) e horizonte de ${targetPeriodUnit.toLowerCase() === 'dinâmico' ? 'DINÂMICO' : targetWindow.targetPeriodDescription}. 
Preste muita atenção ao 'histórico_indicações_ia' se existir para a ação. Isso mostra as últimas vezes que você mesmo recomendou essa ação e qual foi o resultado (LUCRO, PERDA, ou ABERTA). Se a ação tiver um histórico de PERDA recente, seja muito mais rigoroso na sua pontuação. Se tiver histórico de LUCRO, ela pode ser um padrão que você domina. 

Retorne O RANKING COMPLETO de TODAS as ações enviadas. Ações incompatíveis ou rejeitadas devem constar no JSON com status "REJECTED" e seus devidos "rejection_reasons".${dataContext}

Retorne EXATAMENTE este formato JSON:
{
  "ai_recommendation": {
    "summary": "Resumo executivo do cenário de mercado e justificativa das escolhas."
  },
  "confirmed_knowledge_ids": ["id_do_insight_confirmado"],
  "new_insights": [
    {
      "category": "Padrao_Recorrente",
      "summary": "Resumo conciso de até 300 caracteres sobre padrão, filtro ou comportamento observado.",
      "confidence_score": 75,
      "tags": ["Filtro", "Volume"]
    }
  ],
  "ranked_stocks": [
    {
      "ticker": "XXXX3",
      "company_name": "Nome da Empresa",
      "current_price": 0.00,
      "entry_price": 0.00,
      "drop_percentage": 0.00,
      "strategy_score": 88,
      "reversal_potential_score": 88,
      "success_probability": 82,
      "support_level": 0.00,
      "target_price": 0.00,
      "stop_loss": 0.00,
      "stop_loss_percentage": 12.5,
      "risk_reward_ratio": 2.8,
      "estimated_target_date": "Novembro-Dezembro/2026",
      "estimated_timeframe": "3 a 5 meses",
      "smart_money_signals": ["Comportamento compatível com possível acumulação", "RSI em sobrevenda histórica"],
      "support_level_label": "FORTE",
      "bottom_fishing_conclusion": "SIM",
      "gate_classification": "CANDIDATO FORTE",
      "analysis_mode": "DESCOBERTA",
      "invalidation_trigger": "Fechamento abaixo de R$ X.XX com volume acima da média",
      "analysis": "Análise detalhada técnica e fundamentalista...",
      "recommended_allocation_percent": 20,
      "action": "BUY",
      "reason": "Resumo executivo da razão da recomendação.",
      "status": "APPROVED",
      "rejection_reasons": []
    }
  ]
}`;

  try {
    const activeModel = getActiveModel('terra');
    console.log(`[Terra] Usando modelo: ${activeModel}`);

    const aiResult = await callAI('terra', [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt }
    ]);

    const content = aiResult.content;
    if (!content) {
      throw new Error('Resposta vazia da IA.');
    }

    const parsed = JSON.parse(content) as any;
    const tokenUsageForReturn = aiResult.usage;

    // Normaliza os campos obrigatórios para garantir integridade caso a IA omita algum número
    if (parsed.ranked_stocks && Array.isArray(parsed.ranked_stocks)) {
      parsed.ranked_stocks = parsed.ranked_stocks.map((stock: any) => {
        const currentPrice = stock.current_price || stock.entry_price || 0;
        const entryPrice = stock.entry_price || currentPrice;
        const strategyScore = stock.strategy_score || stock.reversal_potential_score || 80;
        const successProbability = stock.success_probability || Math.min(95, Math.round(strategyScore * 0.95));
        const estimatedTimeframe = stock.estimated_timeframe || "Dinâmico";

        return {
          ...stock,
          current_price: currentPrice,
          entry_price: entryPrice,
          strategy_score: strategyScore,
          reversal_potential_score: strategyScore,
          success_probability: successProbability,
          estimated_timeframe: estimatedTimeframe,
          estimated_target_date: stock.estimated_target_date || "Dinâmico",
        };
      });
    }

    // 2. Processa Confirmações e Novos Insights da Base de Conhecimento
    const confirmedIds = Array.isArray(parsed.confirmed_knowledge_ids) ? parsed.confirmed_knowledge_ids : [];
    let newInsights = Array.isArray(parsed.new_insights) ? parsed.new_insights : [];

    // Se a IA não gerou insight novo mas identificou uma oportunidade de alto score (>= 85),
    // cria automaticamente um padrão validado para alimentar a base
    if (newInsights.length === 0 && parsed.ranked_stocks && parsed.ranked_stocks.length > 0) {
      const topStock = parsed.ranked_stocks[0];
      if (topStock.strategy_score >= 80) {
        newInsights.push({
          category: 'Padrao_Recorrente',
          summary: `Ativo ${topStock.ticker} validado com score ${topStock.strategy_score}/100 e R:R 1:${topStock.risk_reward_ratio || 2.5} em zona de suporte R$ ${topStock.support_level?.toFixed(2) || 'N/A'}.`,
          confidence_score: Math.min(92, topStock.strategy_score),
          tags: [topStock.ticker, 'Smart Money', 'Suporte']
        });
      }
    }

    // A persistência e aprendizado da Base de Conhecimento no Supabase
    // foi movida para o Dashboard.tsx para garantir que ocorra APÓS a validação da Camada 4 (Sol),
    // impedindo que a IA memorize padrões de indicações rejeitadas pelo Sol.

    // Anexa informações de conhecimento ao resultado
    parsed.knowledge_base = {
      applied_items: relevantKnowledge,
      confirmed_ids: confirmedIds,
      new_insights: newInsights
    };

    parsed.token_usage = {
      prompt_tokens:    tokenUsageForReturn.prompt_tokens    ?? 0,
      completion_tokens: tokenUsageForReturn.completion_tokens ?? 0,
      total_tokens:     tokenUsageForReturn.total_tokens     ?? 0,
    };

    console.log(`[Terra] Tokens usados: ${parsed.token_usage.total_tokens}`);

    return parsed as AIRecommendation;

  } catch (error) {
    console.error('[OpenAI Error]', error);
    throw error;
  }
}

// ============================================================================
// CAMADA 2: TRIAGEM INTELIGENTE (GPT-5.6 Luna)
// ============================================================================
export interface TriageResult {
  ticker: string;
  score: number;
  criterios_selecionados: Record<string, string>;
  motivo_selecao: string;
  classificacao: number;
  elegivel_para_analise_profunda: boolean;
  principais_fatores: string[];
  fatores_de_risco: string[];
  nivel_de_confianca: string;
}

export interface TriageResponse {
  ranking: TriageResult[];
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function triageMarket(
  eligibleStocks: string[],
  existingDataMap: Record<string, StockCache>,
  gateResultsMap: Record<string, import('./gateBottomFishing').GateResult> = {},
  isModoPositicao: boolean = false
): Promise<TriageResponse> {
  if (!openai && getActiveModel('luna') === 'gpt-5.6-luna') throw new Error('OpenAI não configurada');

  const stocksData = eligibleStocks.map(ticker => {
    const cached = existingDataMap[ticker.toUpperCase()];
    const gate = gateResultsMap[ticker.toUpperCase()];
    return {
      ticker,
      price: cached?.current_price || 'N/A',
      volume: cached?.fundamentals?.avg_volume_52w || 'N/A',
      high52w: cached?.fundamentals?.week_52_high || 'N/A',
      low52w: cached?.fundamentals?.week_52_low || 'N/A',
      pl: cached?.fundamentals?.pl || 'N/A',
      pvp: cached?.fundamentals?.pvp || 'N/A',
      roe: cached?.fundamentals?.roe || 'N/A',
      // Contexto do Gate já calculado (não reprocessar na Luna)
      gate_classification: gate?.classification || (isModoPositicao ? 'N/A (Modo Posição)' : 'N/A'),
      gate_drop_pct: gate?.gate_drop_pct,
      gate_distance_pct: gate?.gate_distance_pct,
    };
  });

  const modoContext = isModoPositicao
    ? `MODO POSIÇÃO: O usuário já possui posição neste ativo. Gate Bottom Fishing não aplicado.
   A análise foca em: manter, aumentar, reduzir ou sair. R:R 1:2 NÃO é obrigatório neste modo.`
    : `MODO DESCOBERTA: Todos os ativos recebidos já passaram pelo Gate Bottom Fishing (etapa determinística).
   O Gate confirmou: queda relevante, proximidade de mínima, volume e volatilidade mínimos.
   NÃO reavalie esses critérios — eles já foram resolvidos de forma objetiva.
   Sua função é interpretar o que os dados INDICAM (não decidir se vale olhar para o ativo).`;

  const systemPrompt = `Você é a Luna, a IA de Triagem Estratégica do Smart Money Tracker AI v3.2.

${modoContext}

SUA MISSÃO: Entre os candidatos recebidos, PRIORIZE e RANQUEIE os melhores para análise profunda.

O QUE AVALIAR (foco interpretativo — não determinístico):
  - QUALIDADE do suporte (escala MUITO FRACO / FRACO / MODERADO / FORTE / MUITO FORTE / EXTREMO)
  - Presença de exaustão da queda
  - Estrutura de reversão
  - Anomalias de volume e sinais compatíveis com Smart Money / acumulação
  - Divergências preço/volume

O QUE NÃO AVALIAR (já resolvido de forma determinística pelo Gate):
  - Queda mínima (já verificado)
  - Proximidade de mínima (já verificado)
  - Volume mínimo (já verificado)
  - Volatilidade mínima (já verificado)
  Não reavaliar esses critérios evita duplicidade de responsabilidade entre camadas.

Retorne estruturadamente um ranking ordenado pelo potencial de recuperação. Selecione até 50.
Retorne um JSON rigoroso respeitando a saída exigida.`;

  const userPrompt = `Avalie as seguintes candidatas e selecione as melhores até 50.\n\nDADOS:\n${JSON.stringify(stocksData)}\n\nRetorne JSON:\n{ "ranking": [ { "ticker": "VALE3", "score": 96, "criterios_selecionados": { "suporte": "MUITO FORTE — região de pivots históricos", "volume": "Anomalia positiva detectada" }, "motivo_selecao": "Exaustão de queda com volume crescente em suporte histórico", "classificacao": 1, "elegivel_para_analise_profunda": true, "principais_fatores": ["Suporte FORTE", "Sinal de acumulação"], "fatores_de_risco": ["Dependência de commodity"], "nivel_de_confianca": "ALTA" } ] }`;

  const activeModel = getActiveModel('luna');
  console.log(`[Luna] Usando modelo: ${activeModel}`);

  const aiResult = await callAI('luna', [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ]);

  const parsed = JSON.parse(aiResult.content || '{"ranking":[]}');

  parsed.token_usage = {
    prompt_tokens:     aiResult.usage.prompt_tokens,
    completion_tokens: aiResult.usage.completion_tokens,
    total_tokens:      aiResult.usage.total_tokens,
  };

  return parsed as TriageResponse;
}

// ============================================================================
// CAMADA 4: REVISÃO ESPECIALIZADA (GPT-5.6 Sol)
// ============================================================================
export interface ReviewResult {
  ticker: string;
  decisao: "APROVADA" | "APROVADA_COM_RESSALVAS" | "REJEITADA";
  probabilidade_revisada: number;
  score_revisado: number;
  motivo_estruturado: string;
}

export async function reviewIndications(
  indications: StockAnalysis[],
  knowledgeContext: string = '',
  isModoPositicao: boolean = false,
  userContext?: string
): Promise<ReviewResult[]> {
  const activeModel = getActiveModel('sol');
  console.log(`[Sol] Usando modelo: ${activeModel}`);

  const modoRR = isModoPositicao
    ? 'MODO POSIÇÃO: R:R 1:2 NÃO é obrigatório. A análise foca na posição existente.'
    : 'MODO DESCOBERTA: R:R 1:2 É OBRIGATÓRIO. Rejeite se risk_reward_ratio < 2.0.';

  let userContextBlock = "";
  if (userContext?.trim()) {
    userContextBlock = `
O Terra recebeu o seguinte contexto do usuário:
<<<CONTEUDO_ARQUIVO_INICIO>>>
${userContext}
<<<FIM>>>
`;
  }

  const systemPrompt = `Você é o Sol, o AUDITOR INDEPENDENTE do Smart Money Tracker AI v3.2.
Recebes indicações analisadas pelo Terra. Sua função é tentar INVALIDAR a tese apresentada, não confirmá-la.
Classificações de saída: "APROVADA", "APROVADA_COM_RESSALVAS" ou "REJEITADA".

${modoRR}
${userContextBlock}

CHECKLIST DO SOL (verifique cada item):
1. O suporte realmente existe e é tecnicamente justificável?
2. A reversão está confirmada ou é apenas especulação?
3. O volume é significativo? Existe outra explicação para o volume além de acumulação?
4. Existe risco fundamentalista não considerado?
5. O Stop Loss está tecnicamente correto (na região de invalidação da tese)?
6. [Modo Descoberta apenas] R:R ≥ 1:2? Se não → REJEITADA.
7. O support_level_label e o bottom_fishing_conclusion foram preenchidos?
8. A probabilidade/confiança está exagerada?
9. O contexto do usuário está influenciando indevidamente a conclusão?
10. Existe pesquisa externa que deve ser verificada antes de aprovar?

REJEIÇÃO deve ocorrer quando: alvo impossível, suporte inexistente, stop tecnicamente incorreto, R:R < 1:2 no Modo Descoberta, tese claramente especulativa.
Se "REJEITADA" ou com ressalvas, seja sucinto no "motivo_estruturado".`;

  const userPrompt = `Revise as seguintes indicações:\n${JSON.stringify(indications)}\n\nContexto Base:\n${knowledgeContext}\n\nRetorne JSON estrito: { "reviews": [ { "ticker": "...", "decisao": "APROVADA_COM_RESSALVAS", "probabilidade_revisada": 85, "score_revisado": 80, "motivo_estruturado": "Risco de suporte validado, reduzir exposição." } ] }`;

  const aiResult = await callAI('sol', [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ]);

  const parsed = JSON.parse(aiResult.content || '{"reviews":[]}');
  return parsed.reviews as ReviewResult[];
}

