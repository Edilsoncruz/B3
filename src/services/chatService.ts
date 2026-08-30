/**
 * chatService.ts
 *
 * Serviço responsável pelo Assistente da Análise.
 * - Cada indicação possui seu próprio chat isolado (indication_id = stock.id)
 * - Histórico persistido no Supabase (indication_chats + chat_messages)
 * - Chama callAI('luna') para respostas contextuais
 */

import { supabase } from '../lib/supabase';
import { callAI } from './aiProvider';
import { StockAnalysis } from './openai';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: string;
  chat_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type?: 'text' | 'reanalysis' | 'question_analysis';
  created_at?: string;
}

export interface ReanalysisResult {
  original_target: number;
  new_target: number;
  original_stop: number;
  new_stop: number;
  original_probability: number;
  new_probability: number;
  original_timeframe: string;
  new_timeframe: string;
  rationale: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o chat_id para a indicação.
 * Cria a sessão se ainda não existir.
 */
export async function getOrCreateChat(indicationId: string): Promise<string | null> {
  if (!indicationId) return null;

  // Tenta buscar existente
  const { data: existing, error: selectErr } = await supabase
    .from('indication_chats')
    .select('id')
    .eq('indication_id', indicationId)
    .maybeSingle();

  if (selectErr) {
    console.error('[ChatService] Erro ao buscar chat:', selectErr.message);
    return null;
  }

  if (existing?.id) return existing.id;

  // Cria novo
  const { data: created, error: insertErr } = await supabase
    .from('indication_chats')
    .insert({ indication_id: indicationId })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[ChatService] Erro ao criar chat:', insertErr.message);
    return null;
  }

  return created?.id ?? null;
}

/**
 * Carrega o histórico de mensagens de um chat.
 * Exclui mensagens do sistema (usadas apenas internamente para contexto da IA).
 */
export async function loadChatHistory(chatId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .neq('role', 'system')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ChatService] Erro ao carregar histórico:', error.message);
    return [];
  }

  return (data || []) as ChatMessage[];
}

/**
 * Persiste uma mensagem no Supabase.
 */
export async function saveMessage(
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  messageType: ChatMessage['message_type'] = 'text'
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      chat_id: chatId,
      role,
      content,
      message_type: messageType,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[ChatService] Erro ao salvar mensagem:', error.message);
    return null;
  }

  return data as ChatMessage;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildSystemPrompt(stock: StockAnalysis, analysisDate: string): string {
  const signals = Array.isArray(stock.smart_money_signals)
    ? stock.smart_money_signals.join('\n    - ')
    : 'Não disponível';

  return `Você é o ASSISTENTE DA ANÁLISE do sistema Smart Money Tracker — um especialista em análise técnica e fundamentalista do mercado de ações brasileiro (B3).

Sua função exclusiva é responder perguntas sobre a INDICAÇÃO ESPECÍFICA detalhada abaixo. Você não deve discutir outras indicações, nem misturar dados de análises diferentes.

═══════════════════════════════════════════════
  DADOS DA INDICAÇÃO ORIGINAL (imutáveis)
═══════════════════════════════════════════════
  Ação:              ${stock.ticker} — ${stock.company_name || stock.ticker}
  Setor:             ${stock.sector || 'N/D'}
  Data/hora análise: ${analysisDate}
  Preço analisado:   R$ ${Number(stock.current_price || stock.entry_price || 0).toFixed(2)}
  Entrada sugerida:  R$ ${Number(stock.entry_price || 0).toFixed(2)}
  Alvo original:     R$ ${Number(stock.target_price || 0).toFixed(2)}
  Stop original:     R$ ${Number(stock.stop_loss || 0).toFixed(2)}
  Probabilidade:     ${stock.success_probability || 0}%
  Score:             ${stock.strategy_score || stock.reversal_potential_score || 0}/100
  Risco x Retorno:   1:${Number(stock.risk_reward_ratio || 0).toFixed(1)}
  Tempo estimado:    ${stock.estimated_timeframe || 'N/D'}
  Data prevista:     ${stock.estimated_target_date || 'N/D'}
  Queda do topo:     ${Number(stock.drop_percentage || 0).toFixed(2)}%

  Sinais Smart Money:
    - ${signals}

  Justificativa original da análise:
  ${stock.analysis || 'Não disponível'}

  Trigger de Invalidação:
  ${stock.invalidation_trigger || 'Não especificado'}

═══════════════════════════════════════════════
  REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. Responda APENAS sobre esta indicação específica.
2. Nunca altere os dados originais da indicação acima.
3. Se realizar reanálise, deixe EXPLICITAMENTE CLARO que são dados de uma NOVA ANÁLISE — nunca apresente dados atuais como se fossem da análise original.
4. Seja direto, técnico e objetivo. Use terminologia de mercado.
5. Responda em português brasileiro.
6. Quando solicitado, apresente pontos favoráveis E contrários com honestidade — o objetivo é testar a robustez da indicação, não apenas confirmá-la.
7. Uma reanálise não altera automaticamente a indicação original — apenas apresenta cenários alternativos para avaliação do usuário.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envia uma mensagem livre do usuário e retorna a resposta da IA.
 * Persiste user + assistant no Supabase.
 */
export async function sendChatMessage(
  chatId: string,
  stock: StockAnalysis,
  analysisDate: string,
  history: ChatMessage[],
  userMessage: string
): Promise<ChatMessage> {
  // Monta contexto para a IA (sem persistir o system no histórico)
  const systemPrompt = buildSystemPrompt(stock, analysisDate);

  // Histórico visível para a IA (últimas 20 mensagens para economizar tokens)
  const aiHistory = history.slice(-20).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...aiHistory,
    { role: 'user', content: userMessage },
  ];

  // Persiste mensagem do usuário
  await saveMessage(chatId, 'user', userMessage, 'text');

  // Chama IA
  const { content } = await callAI('luna', messages, 'text');

  // Persiste resposta do assistente
  const saved = await saveMessage(chatId, 'assistant', content, 'text');

  return saved ?? {
    role: 'assistant',
    content,
    message_type: 'text',
    created_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionar Análise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modo "Questionar Análise": a IA busca ativamente argumentos contrários
 * à própria indicação para testar sua robustez.
 */
export async function questionAnalysis(
  chatId: string,
  stock: StockAnalysis,
  analysisDate: string,
  history: ChatMessage[]
): Promise<ChatMessage> {
  const systemPrompt = buildSystemPrompt(stock, analysisDate);

  const questionPrompt = `🔎 QUESTIONAR ANÁLISE

Sua tarefa agora é atuar como um analista CÉTICO e independente. Você deve tentar encontrar argumentos CONTRÁRIOS à indicação de ${stock.ticker}.

Estruture sua resposta exatamente assim:

**✅ PONTOS FAVORÁVEIS**
(Liste os argumentos que sustentam a indicação)

**⚠️ PONTOS CONTRÁRIOS**
(Liste argumentos que CONTRADIZEM ou enfraquecem a indicação — seja honesto e rigoroso)

**🚨 RISCOS PRINCIPAIS**
(Liste os principais riscos específicos desta operação)

**❌ FATORES QUE INVALIDARIAM A TESE**
(O que, se acontecer, tornaria a indicação inválida?)

**📊 CONCLUSÃO**
(Avalie a robustez da indicação de forma neutra: ela resiste ao escrutínio? Há pontos de atenção críticos?)

Seja honesto e crítico. O objetivo NÃO é confirmar a indicação, mas testá-la.`;

  const aiHistory = history.slice(-10).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...aiHistory,
    { role: 'user', content: questionPrompt },
  ];

  await saveMessage(chatId, 'user', '🔎 Questionar Análise', 'question_analysis');

  const { content } = await callAI('luna', messages, 'text');

  const saved = await saveMessage(chatId, 'assistant', content, 'question_analysis');

  return saved ?? {
    role: 'assistant',
    content,
    message_type: 'question_analysis',
    created_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reanálise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solicita uma reanálise com novo período ou parâmetros.
 * A resposta é claramente marcada como REANÁLISE — não altera a indicação original.
 */
export async function reanalyzeIndication(
  chatId: string,
  stock: StockAnalysis,
  analysisDate: string,
  history: ChatMessage[],
  reanalysisRequest: string
): Promise<ChatMessage> {
  const systemPrompt = buildSystemPrompt(stock, analysisDate);

  const entryPrice = Number(stock.entry_price || stock.current_price || 0);
  const originalTarget = Number(stock.target_price || 0);
  const originalStop = Number(stock.stop_loss || 0);
  const originalProb = Number(stock.success_probability || 0);
  const originalTimeframe = stock.estimated_timeframe || 'N/D';

  const reanalysisPrompt = `🔄 REANÁLISE SOLICITADA

Solicitação do usuário: "${reanalysisRequest}"

Com base nos dados da indicação original de ${stock.ticker} e na solicitação acima, realize uma REANÁLISE.

IMPORTANTE: Deixe EXPLÍCITO que estes são dados de uma NOVA ANÁLISE — não confundir com os dados originais.

Estruture sua resposta exatamente assim:

**📊 REANÁLISE — ${stock.ticker}**
*Dados originais utilizados como referência. Esta reanálise NÃO altera a indicação original.*

**Comparativo:**

| Parâmetro         | Original                | Reanálise               |
|-------------------|-------------------------|-------------------------|
| Alvo              | R$ ${originalTarget.toFixed(2)} | R$ [NOVO_ALVO] |
| Stop              | R$ ${originalStop.toFixed(2)} | R$ [NOVO_STOP] |
| Probabilidade     | ${originalProb}% | [NOVA_PROB]% |
| Prazo             | ${originalTimeframe} | [NOVO_PRAZO] |

**📝 Motivo das Alterações:**
(Explique tecnicamente por que os parâmetros mudaram com base na solicitação)

**⚠️ Observação:**
Esta reanálise é apenas um cenário alternativo para avaliação. A indicação original permanece inalterada. Para aplicar esta reanálise, use a ação "Aplicar Reanálise" (funcionalidade futura).

Forneça valores numéricos realistas e justificados para os campos [NOVO_ALVO], [NOVO_STOP], [NOVA_PROB] e [NOVO_PRAZO].
Preço de entrada de referência: R$ ${entryPrice.toFixed(2)}`;

  const aiHistory = history.slice(-10).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...aiHistory,
    { role: 'user', content: reanalysisPrompt },
  ];

  await saveMessage(chatId, 'user', `🔄 Reanálise: ${reanalysisRequest}`, 'reanalysis');

  const { content } = await callAI('luna', messages, 'text');

  const saved = await saveMessage(chatId, 'assistant', content, 'reanalysis');

  return saved ?? {
    role: 'assistant',
    content,
    message_type: 'reanalysis',
    created_at: new Date().toISOString(),
  };
}
