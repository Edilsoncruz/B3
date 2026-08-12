import OpenAI from 'openai';
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
  useDeepIA: boolean = false
): Promise<AIRecommendation> {
  if (!openai) {
    throw new Error('Chave VITE_OPENAI_API_KEY não configurada no .env.local');
  }

  const targetWindow = calculateTargetWindow(
    executionDate || new Date(),
    targetPeriodValue,
    targetPeriodUnit
  );

  // 1. Consulta prévia da Base de Conhecimento no Supabase
  const relevantKnowledge = await getRelevantKnowledge({
    strategy: 'Smart Money Bottom Fishing',
    limit: 6,
    excludeDiscarded: true
  });

  const knowledgeContext = formatKnowledgeForPrompt(relevantKnowledge);

  const systemPrompt = `Você é um analista sênior financeiro especialista em Reversão de Tendência e Swing/Position Trading no mercado brasileiro (B3).
Orçamento total do usuário: R$ ${budget}.
Perfil de Risco: ${riskProfile}.
Quantidade Solicitada de Oportunidades: ${recommendationCount} ativos (Retorne apenas oportunidades REAIS de alta qualidade. Se houver menos que o solicitado, retorne menos. NÃO invente oportunidades).

CONTEXTO TEMPORAL CRÍTICO:
- DATA DA EXECUÇÃO: ${targetWindow.baseDateFormatted} (HOJE).
- HORIZONTE DE TEMPO ALVO: ${targetPeriodUnit.toLowerCase() === 'dinâmico' ? 'DINÂMICO (sem limite de prazo, determine tempo e alvo livremente)' : targetWindow.targetPeriodDescription}. O horizonte é um PRAZO MÁXIMO. Oportunidades com tempo estimado menor são perfeitamente compatíveis.

SUA MISSÃO PRINCIPAL: APROFUNDAR A ANÁLISE (Deep AI)
Seu foco é encontrar as melhores combinações de: QUEDA RELEVANTE + SINAIS DE RECUPERAÇÃO + POTENCIAL DE ALVO.
Avalie o conjunto de evidências. Indicadores secundários (Volume, Smart Money, etc.) são apoio, não filtros eliminatórios obrigatórios. Não exija que todos sejam positivos simultaneamente.

REQUISITOS OBRIGATÓRIOS PARA CADA RECOMENDAÇÃO:
1. ticker: Código oficial da ação na B3.
2. strategy_score & reversal_potential_score: Pontuação de 0 a 100 baseada na força dos sinais de reversão.
3. success_probability: Probabilidade percentual estimada de sucesso.
4. current_price & entry_price: Preço atual ou de entrada recomendado.
5. target_price: Alvo técnico realista e JUSTIFICÁVEL, baseado na ESTRUTURA REAL do ativo (resistências, histórico, Fibonacci, volatilidade, etc). É PROIBIDO utilizar lógica de percentual fixo baseada no prazo. O alvo deve refletir a realidade do gráfico.
6. stop_loss: Stop técnico posicionado logo abaixo da estrutura de suporte.
7. stop_loss_percentage: Risco percentual exato.
8. risk_reward_ratio: Relação Risco x Retorno. Mínimo sugerido de 1:2.
9. estimated_timeframe & estimated_target_date: Estime o tempo necessário de forma realista baseado na volatilidade e estrutura do ativo. Se ultrapassar o HORIZONTE DE TEMPO ALVO do usuário, a oportunidade é incompatível e deve ser REJEITADA.
10. smart_money_signals: Sinais de fluxo ou acumulação, se disponíveis.
11. analysis & reason: Justificativa técnica detalhando a identificação da queda, a evidência de recuperação e a lógica do alvo estrutural. Se faltar algum dado secundário mas a tese for boa, informe a limitação sem descartar o ativo.
12. sector e group: Setor e grupo da empresa.
13. VALIDAÇÃO: Avalie rigorosamente. Ações reprovadas ou incompatíveis NÃO DEVEM SER OMITIDAS. Preencha o status adequadamente.
- "status": "APPROVED" ou "REJECTED".
- "rejection_reasons": Array de strings com o motivo (ex: ["Tempo estimado supera horizonte máximo", "Sem evidências de recuperação"]).
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
    "summary": "Resumo executivo do cenário de mercado e justificativa das escolhas (foco na determinação dos alvos e tempo estimado)."
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
      "smart_money_signals": ["Acumulação institucional detectada", "RSI em sobrevenda histórica"],
      "invalidation_trigger": "Fechamento abaixo de R$ X.XX com volume acima da média",
      "analysis": "Análise detalhada técnica e fundamentalista explicando por que este alvo foi escolhido e evidências utilizadas para estimar o tempo...",
      "recommended_allocation_percent": 20,
      "action": "BUY",
      "reason": "Resumo executivo da razão da recomendação.",
      "status": "APPROVED",
      "rejection_reasons": []
    }
  ]
}`;

  try {
    const modelToUse = 'gpt-5.6-terra';

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Resposta vazia da OpenAI.');
    }

    const parsed = JSON.parse(content) as any;

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

    // Adiciona uso de tokens ao resultado para exibição na UI
    parsed.token_usage = {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    console.log(`[OpenAI] Tokens usados: ${parsed.token_usage.total_tokens} (prompt: ${parsed.token_usage.prompt_tokens} + resposta: ${parsed.token_usage.completion_tokens})`);

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
  existingDataMap: Record<string, StockCache>
): Promise<TriageResponse> {
  if (!openai) throw new Error('OpenAI não configurada');

  const stocksData = eligibleStocks.map(ticker => {
    const cached = existingDataMap[ticker.toUpperCase()];
    return {
      ticker,
      price: cached?.current_price || 'N/A',
      volume: cached?.fundamentals?.avg_volume_52w || 'N/A',
      high52w: cached?.fundamentals?.week_52_high || 'N/A',
      low52w: cached?.fundamentals?.week_52_low || 'N/A',
      pl: cached?.fundamentals?.pl || 'N/A',
      pvp: cached?.fundamentals?.pvp || 'N/A',
      roe: cached?.fundamentals?.roe || 'N/A'
    };
  });

  const systemPrompt = `Você é a Luna, uma IA de triagem estratégica (Camada 2).

CONTEXTO IMPORTANTE: Você recebe exclusivamente ações que já passaram por um pré-filtro matemático (Camada 1.5) e confirmam os dois critérios centrais da estratégia:
  1. Sofreram QUEDA RELEVANTE em relação à máxima de 52 semanas.
  2. Apresentam SINAL INICIAL DE RECUPERAÇÃO desde a mínima de 52 semanas.

SUA MISSÃO: Entre essas candidatas, PRIORIZE e RANQUEIE as melhores para análise profunda. Selecione até 50.

COMO DIFERENCIAR:
  - Use volume, P/L, P/VP, ROE, distância da mínima e outros indicadores para PRIORIZAR candidatas entre si.
  - NÃO use esses indicadores para ELIMINAR ações antes da análise profunda. Ausência de um dado secundário não é critério de rejeição.
  - Prefira ações com maior queda + recuperação mais forte + fundamentos razoáveis.
  - Dê "elegivel_para_analise_profunda: true" para todas as que se destacam no conjunto.

Retorne estruturadamente um ranking ordenado pelo potencial de recuperação. Registre no "motivo_selecao" o que diferenciou cada ação.
Retorne um JSON rigoroso respeitando a saída exigida.`;

  const userPrompt = `Avalie as seguintes candidatas (QUEDA+RECUPERAÇÃO confirmadas) e selecione as melhores até 50.\n\nDADOS:\n${JSON.stringify(stocksData)}\n\nRetorne JSON:\n{ "ranking": [ { "ticker": "VALE3", "score": 96, "criterios_selecionados": { "suporte": "Alta importância", "volume": "Média importância" }, "motivo_selecao": "Queda de 35% com repique forte de 12% do fundo + volume crescente", "classificacao": 1, "elegivel_para_analise_profunda": true, "principais_fatores": ["X"], "fatores_de_risco": ["Y"], "nivel_de_confianca": "ALTA" } ] }`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{"ranking":[]}');
  
  parsed.token_usage = {
    prompt_tokens: response.usage?.prompt_tokens ?? 0,
    completion_tokens: response.usage?.completion_tokens ?? 0,
    total_tokens: response.usage?.total_tokens ?? 0,
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
  knowledgeContext: string = ''
): Promise<ReviewResult[]> {
  if (!openai) throw new Error('OpenAI não configurada');

  const systemPrompt = `Você é a IA Sol, uma REVISORA INDEPENDENTE (Layer 4).
Receberá indicações analisadas por outro modelo. Sua função é auditar a tese apresentada.
Você deve avaliar a combinação de Queda, Recuperação e Potencial de Alvo Estrutural.
Classificações: "APROVADA", "APROVADA_COM_RESSALVAS" ou "REJEITADA".
A REJEIÇÃO DEVE OCORRER SOMENTE QUANDO EXISTIR MOTIVO TÉCNICO RELEVANTE PARA INVALIDAR A TESE (ex: alvo impossível, suporte inexistente). Não exija que todos os critérios técnicos sejam satisfeitos simultaneamente. Não atue como uma barreira rígida desnecessária.
Se "REJEITADA" ou com ressalvas, seja sucinto no "motivo_estruturado".`;

  const userPrompt = `Revise as seguintes indicações:\n${JSON.stringify(indications)}\n\nContexto Base:\n${knowledgeContext}\n\nRetorne JSON estrito: { "reviews": [ { "ticker": "...", "decisao": "APROVADA_COM_RESSALVAS", "probabilidade_revisada": 85, "score_revisado": 80, "motivo_estruturado": "Risco de suporte validado, reduzir exposição." } ] }`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5.6-sol',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{"reviews":[]}');
  return parsed.reviews as ReviewResult[];
}

