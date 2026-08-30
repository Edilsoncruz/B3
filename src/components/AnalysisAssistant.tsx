/**
 * AnalysisAssistant.tsx
 *
 * Chatbot contextual integrado ao StockCard expandido.
 * Cada indicação possui contexto e histórico isolados (por stock.id).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, BrainCircuit, Loader2, Search, RefreshCw,
  MessageSquare, ChevronDown, ChevronUp, Sparkles, AlertTriangle, X
} from 'lucide-react';
import { StockAnalysis } from '../services/openai';
import {
  ChatMessage,
  getOrCreateChat,
  loadChatHistory,
  sendChatMessage,
  questionAnalysis,
  reanalyzeIndication,
} from '../services/chatService';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface AnalysisAssistantProps {
  stock: StockAnalysis;
  analysisDate: string;
}

const QUICK_SUGGESTIONS = [
  'Por que esse alvo foi definido?',
  'Justifique o prazo estimado',
  'Quais são os principais riscos?',
  'Mostre um cenário conservador',
  'Mostre um cenário otimista',
  'Por que essa ação foi aprovada?',
  'O que invalidaria essa indicação?',
  'Qual resistência sustenta o alvo?',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formata timestamp para HH:MM */
function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Converte markdown simples em JSX (bold, listas, tabelas) */
function renderMarkdown(text: string): string {
  return text
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble Component
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const isReanalysis = msg.message_type === 'reanalysis';
  const isQuestioning = msg.message_type === 'question_analysis';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mt-1">
          <BrainCircuit className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[85%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Badge de tipo */}
        {isReanalysis && !isUser && (
          <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" /> Reanálise
          </span>
        )}
        {isQuestioning && !isUser && (
          <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <Search className="w-2.5 h-2.5" /> Questionando Análise
          </span>
        )}

        {/* Bubble */}
        <div
          className={`px-3 py-2.5 rounded-xl text-[12px] leading-relaxed ${
            isUser
              ? 'bg-blue-600/90 text-white rounded-tr-sm'
              : isReanalysis
              ? 'bg-amber-500/10 border border-amber-500/20 text-gray-200 rounded-tl-sm'
              : isQuestioning
              ? 'bg-rose-500/10 border border-rose-500/20 text-gray-200 rounded-tl-sm'
              : 'bg-[#1a1b1f] border border-[#2a2b2f] text-gray-200 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <div
              className="assistant-message"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
        </div>

        {/* Timestamp */}
        {msg.created_at && (
          <span className="text-[9px] text-gray-600">{formatTime(msg.created_at)}</span>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center mt-1">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing Indicator
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
        <BrainCircuit className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-3 py-2.5 rounded-xl rounded-tl-sm bg-[#1a1b1f] border border-[#2a2b2f] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reanalysis Modal (mini input de período)
// ─────────────────────────────────────────────────────────────────────────────

interface ReanalysisModalProps {
  onConfirm: (request: string) => void;
  onCancel: () => void;
}

function ReanalysisModal({ onConfirm, onCancel }: ReanalysisModalProps) {
  const [value, setValue] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-x-0 bottom-20 mx-3 bg-[#13141a] border border-amber-500/30 rounded-xl p-4 z-10 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest">
          <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">Descreva a reanálise desejada:</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['Considere 1 mês', 'Considere 2 meses', 'Considere 3 meses', 'Cenário mais conservador', 'Com stop mais largo'].map(s => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className={`text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-colors ${
              value === s
                ? 'bg-amber-500/30 border-amber-500/50 text-amber-300'
                : 'border-[#2a2b2f] text-gray-400 hover:border-amber-500/30 hover:text-amber-400 bg-[#1a1b1f]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ex: Reavalie considerando 2 meses..."
        className="w-full px-3 py-2 bg-[#0d0e11] border border-[#2a2b2f] rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 mb-3"
        onKeyDown={e => e.key === 'Enter' && value.trim() && onConfirm(value.trim())}
        autoFocus
      />
      <button
        onClick={() => value.trim() && onConfirm(value.trim())}
        disabled={!value.trim()}
        className="w-full py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold uppercase tracking-widest hover:bg-amber-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Solicitar Reanálise
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AnalysisAssistant({ stock, analysisDate }: AnalysisAssistantProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showReanalysisModal, setShowReanalysisModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const indicationId = stock.id;

  // Scroll para o final quando chegar mensagem nova
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Inicializa o chat ao montar
  useEffect(() => {
    if (!indicationId) {
      setInitError('Esta indicação não possui um ID único. Salve a análise primeiro.');
      setIsInitializing(false);
      return;
    }

    async function init() {
      setIsInitializing(true);
      setInitError(null);
      try {
        const id = await getOrCreateChat(indicationId!);
        if (!id) {
          setInitError('Não foi possível inicializar o chat. Verifique as tabelas no Supabase.');
          return;
        }
        setChatId(id);
        const history = await loadChatHistory(id);
        setMessages(history);
      } catch (err: any) {
        setInitError(err.message || 'Erro ao inicializar o chat.');
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [indicationId]);

  // ── Enviar mensagem livre ────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !chatId || isLoading) return;

    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);

    // Adiciona mensagem do usuário otimisticamente
    const optimisticUser: ChatMessage = {
      role: 'user',
      content: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const response = await sendChatMessage(chatId, stock, analysisDate, messages, text);
      // Remove o otimista e adiciona o persistido (com ID real)
      setMessages(prev => [...prev.slice(0, -1), optimisticUser, response]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        optimisticUser,
        {
          role: 'assistant',
          content: `⚠️ Erro ao processar sua pergunta: ${err.message}. Verifique as configurações de IA.`,
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, chatId, isLoading, stock, analysisDate, messages]);

  // ── Questionar Análise ───────────────────────────────────────────────────

  const handleQuestionAnalysis = useCallback(async () => {
    if (!chatId || isLoading) return;
    setShowSuggestions(false);
    setIsLoading(true);

    const optimisticUser: ChatMessage = {
      role: 'user',
      content: '🔎 Questionar Análise',
      message_type: 'question_analysis',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const response = await questionAnalysis(chatId, stock, analysisDate, messages);
      setMessages(prev => [...prev.slice(0, -1), optimisticUser, response]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        optimisticUser,
        {
          role: 'assistant',
          content: `⚠️ Erro: ${err.message}`,
          message_type: 'question_analysis',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, isLoading, stock, analysisDate, messages]);

  // ── Reanálise ────────────────────────────────────────────────────────────

  const handleReanalysis = useCallback(async (request: string) => {
    if (!chatId || isLoading) return;
    setShowReanalysisModal(false);
    setShowSuggestions(false);
    setIsLoading(true);

    const optimisticUser: ChatMessage = {
      role: 'user',
      content: `🔄 Reanálise: ${request}`,
      message_type: 'reanalysis',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const response = await reanalyzeIndication(chatId, stock, analysisDate, messages, request);
      setMessages(prev => [...prev.slice(0, -1), optimisticUser, response]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        optimisticUser,
        {
          role: 'assistant',
          content: `⚠️ Erro: ${err.message}`,
          message_type: 'reanalysis',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, isLoading, stock, analysisDate, messages]);

  // ── Key handler textarea ─────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Corta o ID para exibição
  const shortId = indicationId
    ? indicationId.slice(0, 14) + (indicationId.length > 14 ? '…' : '')
    : 'sem ID';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full rounded-xl border border-violet-500/20 bg-[#0c0d11] overflow-hidden relative"
         style={{ minHeight: '560px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2128] bg-gradient-to-r from-violet-500/5 to-blue-500/5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-white uppercase tracking-widest leading-none">
              🧠 Assistente da Análise
            </div>
            <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
              {stock.ticker} · #{shortId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Contextual</span>
        </div>
      </div>

      {/* ── Inicializando ──────────────────────────────────────────────────── */}
      {isInitializing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-xs text-gray-500">Carregando histórico da indicação...</p>
        </div>
      )}

      {/* ── Erro de inicialização ──────────────────────────────────────────── */}
      {!isInitializing && initError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <div className="text-center">
            <p className="text-xs font-semibold text-amber-400 mb-1">Assistente não disponível</p>
            <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">{initError}</p>
          </div>
          <div className="text-[10px] text-gray-600 bg-[#13141a] border border-[#1f2128] rounded-lg p-3 font-mono w-full">
            <p className="text-gray-400 mb-1 font-sans text-[10px]">Execute no Supabase SQL Editor:</p>
            <p>CREATE TABLE indication_chats (...);</p>
            <p>CREATE TABLE chat_messages (...);</p>
            <p className="text-gray-600 mt-1 font-sans">Ver database.sql para o script completo.</p>
          </div>
        </div>
      )}

      {/* ── Chat Area ─────────────────────────────────────────────────────── */}
      {!isInitializing && !initError && (
        <>
          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scroll-smooth">

            {/* Mensagem de boas-vindas */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center flex-1 gap-4 py-6 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-1">Assistente da Análise</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed max-w-[220px]">
                    Faça perguntas sobre a indicação de <strong className="text-violet-400">{stock.ticker}</strong>. Cada conversa é isolada a esta análise específica.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Histórico de mensagens */}
            {messages.map((msg, idx) => (
              <MessageBubble key={msg.id ?? idx} msg={msg} />
            ))}

            {/* Typing indicator */}
            {isLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Sugestões Rápidas ─────────────────────────────────────────── */}
          <AnimatePresence>
            {showSuggestions && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pb-2 border-t border-[#1a1b1f] flex-shrink-0"
              >
                <div className="flex items-center justify-between py-2">
                  <span className="text-[9px] text-gray-600 uppercase tracking-widest">Sugestões</span>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      disabled={isLoading}
                      className="text-[10px] px-2 py-1 rounded-md bg-[#1a1b1f] border border-[#2a2b2f] text-gray-400 hover:border-violet-500/40 hover:text-violet-300 hover:bg-violet-500/5 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Ações Especiais ───────────────────────────────────────────── */}
          <div className="px-3 py-2 border-t border-[#1a1b1f] flex gap-2 flex-shrink-0">
            <button
              onClick={handleQuestionAnalysis}
              disabled={isLoading || !chatId}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors text-[10px] font-semibold uppercase tracking-widest cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Search className="w-3 h-3" /> Questionar Análise
            </button>
            <button
              onClick={() => setShowReanalysisModal(true)}
              disabled={isLoading || !chatId}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-[10px] font-semibold uppercase tracking-widest cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3 h-3" /> Reavaliar Alvo
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setShowSuggestions(v => !v)}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#1a1b1f] border border-[#2a2b2f] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                title="Sugestões rápidas"
              >
                {showSuggestions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Sugestões quando há histórico */}
          <AnimatePresence>
            {showSuggestions && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pb-2 flex-shrink-0"
              >
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      disabled={isLoading}
                      className="text-[10px] px-2 py-1 rounded-md bg-[#1a1b1f] border border-[#2a2b2f] text-gray-400 hover:border-violet-500/40 hover:text-violet-300 hover:bg-violet-500/5 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input Area ────────────────────────────────────────────────── */}
          <div className="px-3 pb-3 flex-shrink-0 relative">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Faça uma pergunta sobre esta indicação..."
                rows={1}
                disabled={isLoading || !chatId}
                className="flex-1 px-3 py-2.5 bg-[#13141a] border border-[#2a2b2f] rounded-xl text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none transition-colors disabled:opacity-50"
                style={{ maxHeight: '80px' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading || !chatId}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
            <p className="text-[9px] text-gray-700 mt-1.5 text-center">
              Enter para enviar · Shift+Enter para nova linha · Contexto isolado desta indicação
            </p>
          </div>

          {/* ── Reanalysis Modal ──────────────────────────────────────────── */}
          <AnimatePresence>
            {showReanalysisModal && (
              <ReanalysisModal
                onConfirm={handleReanalysis}
                onCancel={() => setShowReanalysisModal(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
