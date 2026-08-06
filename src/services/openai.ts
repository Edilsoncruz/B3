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
  ticker: string;
  company_name: string;
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
  recommendationCount: number = 5,
  targetPeriodValue: number = 2,
  targetPeriodUnit: string = 'meses',
  executionDate?: Date
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

  const systemPrompt = `Você é um analista sênior financeiro especialista em Smart Money, Reversão de Tendência (Bottom Fishing) e Swing/Position Trading no mercado brasileiro (B3).
Orçamento total do usuário: R$ ${budget}.
Perfil de Risco: ${riskProfile}.
Quantidade de Recomendações Solicitadas: ${recommendationCount} ativos.

CONTEXTO TEMPORAL CRÍTICO:
- DATA DA EXECUÇÃO DA ANÁLISE: ${targetWindow.baseDateFormatted} (HOJE).
- HORIZONTE DE TEMPO ALVO SOLICITADO PELO USUÁRIO: ${targetWindow.targetPeriodDescription}.

SUA MISSÃO PRINCIPAL:
Analisar o universo consolidado de ${rawData.length} ações da B3 armazenadas no Supabase e executar com rigor a estratégia Smart Money:
"Identificar os ${recommendationCount} ativos que apresentam a maior probabilidade estatística de reversão de tendência, acumulação institucional e atingimento do preço-alvo dentro de ${targetPeriodValue} ${targetPeriodUnit} (até ${targetWindow.targetMonthYear})."

REQUISITOS OBRIGATÓRIOS PARA CADA RECOMENDAÇÃO:
1. ticker: Código oficial da ação na B3 (ex: PETR4, VALE3).
2. strategy_score & reversal_potential_score: Pontuação de 0 a 100 baseada na força dos sinais de reversão e fluxo (deve ser >= 65).
3. success_probability: Probabilidade percentual estimada de sucesso da operação (ex: 75% a 92%).
4. current_price & entry_price: Preço exato do ativo informado na base (ou preço de entrada recomendado).
5. target_price: Alvo técnico realista para o horizonte estipulado (${targetWindow.targetPeriodDescription}), geralmente entre 15% e 40% acima do entry_price.
6. stop_loss: Stop Loss técnico posicionado logo abaixo do suporte (geralmente entre 8% e 18% abaixo do entry_price).
7. stop_loss_percentage: Risco percentual exato: ((entry_price - stop_loss) / entry_price) * 100.
8. risk_reward_ratio: Relação Risco x Retorno: (target_price - entry_price) / (entry_price - stop_loss). Mínimo de 1:2.
9. estimated_target_date & estimated_timeframe: Tempo estimado calculado a partir de hoje (${targetWindow.baseDateFormatted}) para o alvo, ex: '${targetWindow.targetPeriodDescription}'.
10. smart_money_signals: Lista com 2 a 4 gatilhos de fluxo institucional (ex: 'Acumulação em suporte histórico', 'Divergência de volume em fundo').
11. analysis & reason: Justificativa técnica e fundamentalista concisa da recomendação.
${knowledgeContext}

Responda SOMENTE com o JSON no formato especificado contendo exatamente ${recommendationCount} ativos em 'ranked_stocks'.`;

  // Contexto dos dados disponíveis — inclui campos chave para o cálculo de suporte/stop/alvo
  const hasData = rawData.length > 0;
  let dataContext = '';

  if (hasData) {
    dataContext = `\n\nDADOS REAIS DO MERCADO COLETADOS NO SUPABASE (${rawData.length} AÇÕES ANALISADAS):\n${JSON.stringify(rawData.map(s => ({
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
    })), null, 2)}`;
  } else {
    dataContext = `\n\nNENHUM DADO DA API DISPONÍVEL. Use seu conhecimento de treinamento para selecionar as melhores oportunidades de reversão no mercado brasileiro (B3). Sinalize na análise que os dados são estimativas.`;
  }

  const userPrompt = `Analise o universo de ${rawData.length} ações fornecidas na B3 considerando a data de hoje (${targetWindow.baseDateFormatted}) e horizonte de ${targetWindow.targetPeriodDescription}. Retorne as TOP ${recommendationCount} melhores oportunidades de reversão de tendência (Bottom Fishing / Smart Money).${dataContext}

Retorne EXATAMENTE este formato JSON:
{
  "ai_recommendation": {
    "summary": "Resumo executivo do cenário de mercado e justificativa das escolhas para o horizonte de ${targetWindow.targetPeriodDescription}."
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
      "estimated_target_date": "${targetWindow.targetMonthYear}",
      "estimated_timeframe": "${targetWindow.targetPeriodDescription}",
      "smart_money_signals": ["Acumulação institucional detectada", "RSI em sobrevenda histórica"],
      "invalidation_trigger": "Fechamento abaixo de R$ X.XX com volume acima da média",
      "analysis": "Análise detalhada técnica e fundamentalista...",
      "recommended_allocation_percent": 20,
      "action": "BUY",
      "reason": "Resumo executivo da razão da recomendação."
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
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
        const estimatedTimeframe = stock.estimated_timeframe || targetWindow.targetPeriodDescription;

        return {
          ...stock,
          current_price: currentPrice,
          entry_price: entryPrice,
          strategy_score: strategyScore,
          reversal_potential_score: strategyScore,
          success_probability: successProbability,
          estimated_timeframe: estimatedTimeframe,
          estimated_target_date: stock.estimated_target_date || targetWindow.targetMonthYear,
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

    // Executa a persistência e aprendizado da Base de Conhecimento no Supabase
    try {
      const syncResult = await processPostAnalysisKnowledge({
        confirmedIds,
        newInsights,
        strategy: 'Smart Money Bottom Fishing'
      });
      console.log(`[KnowledgeBase] 🧠 Sincronização Supabase concluída: ${syncResult.confirmedCount} confirmações, ${syncResult.newCount} novos registros salvos.`);
    } catch (err) {
      console.warn('[KnowledgeBase] Erro ao sincronizar aprendizado com o Supabase:', err);
    }

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
