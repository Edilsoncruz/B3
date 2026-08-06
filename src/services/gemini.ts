import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// Using process.env.GEMINI_API_KEY injected by Vite define
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface AIRecommendation {
  ai_recommendation: {
    summary: string;
  };
  ranked_stocks: {
    ticker: string;
    current_price: number;
    support_level: number;
    target_price: number;
    stop_loss: number;
    risk_reward_ratio: number;
    reversal_potential_score: number;
    estimated_target_date: string;
    analysis: string;
  }[];
}

export async function analyzeMarket(
  market: string = "B3",
  specificTicker?: string,
  maxPrice?: number,
  maxStopLossPercent?: number,
  recommendationCount: number = 5,
  targetTimeframe: string = "3 a 6 meses",
  isBacktest: boolean = false,
  backtestDate?: string
): Promise<AIRecommendation> {
  try {
    const count = Math.min(recommendationCount, 5);
    const systemPrompt = `Você é um analista sênior financeiro especialista em Smart Money, Reversão de Tendência e Swing/Position Trading. Responda SOMENTE de acordo com o esquema JSON configurado. Não inclua texto adicional.`;

    const backtestPromptBlock = isBacktest
      ? `\nREGRAS CRÍTICAS DE BACKTESTE E SIMULAÇÃO HISTÓRICA:\n1. O usuário ativou o modo Máquina do Tempo. HOJE É ${backtestDate}.\n2. Você deve agir como se estivesse vivendo no exato dia ${backtestDate}.\n3. Desconsidere completamente qualquer evento, balanço, notícia ou variação de preço ocorrida após ${backtestDate}.\n4. A seleção de ativos deve ser baseada apenas no cenário técnico e fundamentalista visível até o fechamento do dia anterior a ${backtestDate}.\n5. Se usar cotações, tente fornecer a cotação exata ou aproximada do ativo na data ${backtestDate}.\n`
      : "";

    const userPrompt = `Atue como um analista sênior financeiro especialista em "Smart Money" (fluxo institucional), Reversão de Tendência (Bottom Fishing) e Swing/Position Trading.

OBRIGATÓRIO: Você DEVE analisar EXCLUSIVAMENTE o seguinte mercado/ativo: ${market}. 
${specificTicker ? `FOCO EXCLUSIVO: Analise especificamente o ativo "${specificTicker}". Ignore outros ativos.` : ""}
${maxPrice ? `FILTRO DE PREÇO: Considere apenas ativos com preço atual abaixo de $${maxPrice}.` : ""}
${maxStopLossPercent ? `FILTRO DE STOP LOSS MÁXIMO DO USUÁRIO: Considere apenas ativos com Stop Loss de no máximo ${maxStopLossPercent}%.` : ""}

═══════════════════ CONTEXTO DE MODO DE OPERAÇÃO E DATA ═══════════════════
${isBacktest ? `
[MODO BACKTESTE HISTÓRICO ATIVO]
- Data de entrada simulada na operação: ${backtestDate}.
- Você DEVE simular que HOJE é rigorosamente ${backtestDate}.
- MÍNIMA DE 52 SEMANAS: Calcule do período anterior a ${backtestDate} até ${backtestDate}.
- ELIMINAÇÃO ABSOLUTA DE LOOK-AHEAD BIAS NA SELEÇÃO: A escolha dos ativos em 'ranked_stocks' DEVE ser baseada EXCLUSIVAMENTE nos sinais gráficos e de fluxo institucional acumulados ATÉ a data ${backtestDate}.
- É ESTRITAMENTE PROIBIDO escolher um ativo para o ranking só porque você possui conhecimento de treinamento indicando que ele subiu após ${backtestDate}.
` : `
[MODO MERCADO EM TEMPO REAL]
- Data de referência: HOJE.
- Use a ferramenta Google Search para obter as cotações em tempo real, suporte recente e a mínima de 52 semanas atualizada dos ativos analisados.
`}

═══════════════════ DIRETRIZES RIGOROSAS DE ANTI-ALUCINAÇÃO ═══════════════════
1. VALIDAÇÃO REAL: ${isBacktest ? `Utilize seus dados históricos de treinamento estritamente limitados até a data ${backtestDate}.` : "Baseie TODAS as cotações (current_price), variações, alvos e indicadores estritamente em dados REAIS do mercado atual obtidos via Google Search."}
2. NUNCA PREENCHA DADOS AUSENTES COM SUPOSIÇÕES: Se não houver dados suficientes para um ticker, declare explicitamente no campo 'analysis': "Dados insuficientes para validação deste ativo" e atribua score adequado.
3. NÃO INVENTE COTAÇÕES: Todos os preços (current_price, support_level, stop_loss, target_price) DEVEM refletir fielmente o mercado real ${isBacktest ? `na data ${backtestDate}` : "hoje"}.

═══════════════════ CRITÉRIO DE SELEÇÃO (BOTTOM FISHING) ═══════════════════
1. O ativo DEVE estar negociando no EXTREMO FUNDO de 52 semanas ${isBacktest ? `relativo a ${backtestDate}` : "atual"}.
2. EXCLUA SUMARIAMENTE qualquer ativo que já tenha feito um "repique" (bounce) visível. O foco é comprar a "faca caindo" no momento exato em que bate no chão e o Smart Money começa a acumular.
3. Busque ativos com RSI diário/semanal em SOBREVENDA EXTREMA (abaixo de 30) e sinais claros de acumulação institucional.
4. O "reversal_potential_score" DEVE ser superior a 75. Ordene do score mais alto para o menor.
5. Prazo limite desejado para o alvo: ${targetTimeframe}. A data estimada do alvo ('estimated_target_date') deve estar perfeitamente alinhada a este prazo.

═══════════════════ REGRAS RÍGIDAS DE STOP LOSS E SWING/POSITION TRADE ═══════════════════
1. REGRA CRÍTICA DE STOP LOSS LARGO E ROBUSTO (SEM STOPS CURTOS DE ESTOPAGEM PREMATURA):
   - Para operações de Bottom Fishing e Reversão com horizonte de semanas ou meses (${targetTimeframe}), NUNCA defina stops curtos ou apertados (ex: 2% a 6%).
   - Ativos no fundo do mercado, small caps, microcaps possuem volatilidade histórica e diária altíssima (ATR elevado). Stops curtos de 5% a 9% causam "violinadas" institucionais antes de qualquer repique de alta.
   - O Stop Loss DEVE ser posicionado com folga técnica e estrutural adequada (tipicamente de 10% a 25%, ou 3.0x a 5.0x ATR abaixo do suporte relevante / fundo macro), permitindo que a tese de reversão se desenvolva com margem de segurança contra ruídos normais.
   - Ajuste o Alvo de Lucro (target_price) proporcionalmente para manter a Relação Risco x Retorno (R:R) em no mínimo 1:2.0.

${backtestPromptBlock}

Retorne os dados estritamente no formato JSON solicitado para ${specificTicker ? "1" : count} ações.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        tools: isBacktest ? undefined : [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ai_recommendation: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: "Resumo executivo do cenário de mercado e validação das escolhas selecionadas.",
                },
              },
              required: ["summary"],
            },
            ranked_stocks: {
              type: Type.ARRAY,
              description: "Lista de ações que passaram pelos critérios rigorosos, ordenadas pelo score.",
              items: {
                type: Type.OBJECT,
                properties: {
                  ticker: {
                    type: Type.STRING,
                    description: "Código de negociação do ativo (ex: PETR4, MGLU3)",
                  },
                  current_price: {
                    type: Type.NUMBER,
                    description: "Cotação atual EXATA do ativo",
                  },
                  support_level: {
                    type: Type.NUMBER,
                    description: "Nível de suporte crítico (fundo histórico/institucional)",
                  },
                  target_price: {
                    type: Type.NUMBER,
                    description: "Alvo projetado para o movimento de reversão",
                  },
                  stop_loss: {
                    type: Type.NUMBER,
                    description: "Nível de Stop Loss (deve ser largo o suficiente para evitar estopagem por ruído)",
                  },
                  risk_reward_ratio: {
                    type: Type.NUMBER,
                    description: "Relação risco x retorno (ex: se arrisca 1 para ganhar 3, o valor é 3.0)",
                  },
                  reversal_potential_score: {
                    type: Type.NUMBER,
                    description: "Score de 0 a 100 indicando a força do setup de reversão (deve ser > 75)",
                  },
                  estimated_target_date: {
                    type: Type.STRING,
                    description: "Data ou mês estimado para atingir o alvo",
                  },
                  analysis: {
                    type: Type.STRING,
                    description: "Justificativa detalhada técnica e de fluxo para a escolha",
                  },
                },
                required: [
                  "ticker",
                  "current_price",
                  "support_level",
                  "target_price",
                  "stop_loss",
                  "risk_reward_ratio",
                  "reversal_potential_score",
                  "estimated_target_date",
                  "analysis",
                ],
              },
            },
          },
          required: ["ai_recommendation", "ranked_stocks"],
        },
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Resposta vazia da IA.");
    }
    
    // Parse the JSON response
    const parsedData = JSON.parse(textResponse) as AIRecommendation;
    return parsedData;
  } catch (error) {
    console.error("Erro detalhado do Gemini:", error);
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("Chave de API inválida ou não configurada. Verifique o valor de GEMINI_API_KEY no arquivo .env.local.");
      }
      throw new Error(`Erro na Análise: ${error.message}`);
    }
    throw new Error("Ocorreu um erro inesperado ao conectar com a IA.");
  }
}
