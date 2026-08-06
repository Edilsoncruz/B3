import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, BookOpen, ShieldCheck, Eye, Sparkles, Trash2, 
  CheckCircle2, Plus, RefreshCw, Layers, Sliders, AlertTriangle, 
  TrendingUp, Database, Code
} from 'lucide-react';
import { 
  KnowledgeItem, 
  KnowledgeCategory, 
  KnowledgeStatus, 
  getAllKnowledge, 
  updateKnowledgeStatus, 
  deleteKnowledgeItem,
  processPostAnalysisKnowledge,
  MAX_ACTIVE_KNOWLEDGE_ITEMS
} from '../services/knowledgeBase';

interface KnowledgeBaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeBaseDrawer({ isOpen, onClose }: KnowledgeBaseDrawerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Novo Insight Manual Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<KnowledgeCategory>('Padrao_Recorrente');
  const [newSummary, setNewSummary] = useState('');
  const [newConfidence, setNewConfidence] = useState(80);
  const [newTags, setNewTags] = useState('');
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getAllKnowledge();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  const handleCreateManualInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) return;

    await processPostAnalysisKnowledge({
      newInsights: [{
        category: newCategory,
        summary: newSummary.trim().slice(0, 300),
        confidence_score: newConfidence,
        tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : []
      }]
    });

    setNewSummary('');
    setNewTags('');
    setShowAddForm(false);
    await fetchItems();
  };

  const handleStatusChange = async (id: string, currentStatus: KnowledgeStatus) => {
    const nextStatus: KnowledgeStatus = currentStatus === 'Descartado' ? 'Novo' : 'Descartado';
    await updateKnowledgeStatus(id, nextStatus);
    await fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja excluir permanentemente este insight da Base de Conhecimento?')) {
      await deleteKnowledgeItem(id);
      await fetchItems();
    }
  };

  const filteredItems = items.filter(item => {
    const matchesStatus = statusFilter === 'Todos' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const validatedCount = items.filter(i => i.status === 'Validado').length;
  const observationCount = items.filter(i => i.status === 'Em observação').length;
  const newCount = items.filter(i => i.status === 'Novo').length;

  const getCategoryLabel = (category: KnowledgeCategory) => {
    switch (category) {
      case 'Padrao_Recorrente': return 'Padrão Recorrente';
      case 'Falso_Positivo': return 'Filtro Falso Positivo';
      case 'Combinacao_Indicadores': return 'Combinação Indicadores';
      case 'Ajuste_Parametros': return 'Ajuste de Parâmetros';
      case 'Excecao_Mercado': return 'Exceção de Mercado';
      default: return category;
    }
  };

  const getCategoryIcon = (category: KnowledgeCategory) => {
    switch (category) {
      case 'Padrao_Recorrente': return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Falso_Positivo': return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'Combinacao_Indicadores': return <Layers className="w-3.5 h-3.5 text-blue-400" />;
      case 'Ajuste_Parametros': return <Sliders className="w-3.5 h-3.5 text-purple-400" />;
      case 'Excecao_Mercado': return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
      default: return <BookOpen className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: KnowledgeStatus) => {
    switch (status) {
      case 'Validado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Validado
          </span>
        );
      case 'Em observação':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Em observação
          </span>
        );
      case 'Novo':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Novo
          </span>
        );
      case 'Descartado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Descartado
          </span>
        );
    }
  };

  const sqlCodeSnippet = `-- Tabela de Base de Conhecimento Estratégica
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'Smart Money Bottom Fishing',
    category TEXT NOT NULL,
    summary VARCHAR(300) NOT NULL,
    confidence_score INTEGER DEFAULT 75,
    confirmations_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'Novo',
    tags TEXT[] DEFAULT '{}'::TEXT[]
);

-- Índices para buscas ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON public.knowledge_base (status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_confidence ON public.knowledge_base (confidence_score DESC);`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-2xl h-full bg-[#0a0b0d] border-l border-[#222328] shadow-2xl flex flex-col z-10 text-white"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#222328] bg-[#111216]/80 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Base de Conhecimento</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
                      {items.length} itens
                    </span>
                  </div>
                  <p className="text-xs text-[#8E9299]">Memória estratégica evolutiva da IA</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSqlGuide(!showSqlGuide)}
                  className="p-2 rounded-lg bg-[#1a1b20] hover:bg-[#25262c] text-[#8E9299] hover:text-white transition-colors"
                  title="Ver script SQL do Supabase"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  onClick={fetchItems}
                  className="p-2 rounded-lg bg-[#1a1b20] hover:bg-[#25262c] text-[#8E9299] hover:text-white transition-colors"
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-[#1a1b20] hover:bg-[#25262c] text-[#8E9299] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SQL Guide Dropdown */}
            {showSqlGuide && (
              <div className="p-4 bg-purple-950/30 border-b border-purple-500/20 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-purple-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Script SQL para criar a tabela no Supabase:
                  </span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(sqlCodeSnippet)}
                    className="text-[10px] px-2 py-0.5 bg-purple-500/30 rounded hover:bg-purple-500/50"
                  >
                    Copiar SQL
                  </button>
                </div>
                <pre className="p-3 bg-[#050505] rounded-lg overflow-x-auto text-[11px] text-gray-300 border border-[#2a2b2f]">
                  {sqlCodeSnippet}
                </pre>
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3 p-6 border-b border-[#222328] bg-[#0c0d10]">
              <div className="p-3 rounded-xl bg-[#15161a] border border-[#26272c]">
                <span className="text-[10px] uppercase text-[#8E9299] block mb-0.5">Validados (5+ conf.)</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{validatedCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#15161a] border border-[#26272c]">
                <span className="text-[10px] uppercase text-[#8E9299] block mb-0.5">Em Observação</span>
                <span className="text-xl font-bold font-mono text-blue-400">{observationCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#15161a] border border-[#26272c]">
                <span className="text-[10px] uppercase text-[#8E9299] block mb-0.5">Novos Insights</span>
                <span className="text-xl font-bold font-mono text-purple-400">{newCount}</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-[#222328] space-y-3 bg-[#0e0f13]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Status Tabs */}
                <div className="flex flex-wrap gap-1 bg-[#15161a] p-1 rounded-lg border border-[#26272c]">
                  {['Todos', 'Validado', 'Em observação', 'Novo', 'Descartado'].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        statusFilter === st 
                          ? 'bg-purple-600 text-white font-bold shadow' 
                          : 'text-[#8E9299] hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Add New Insight Button */}
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Insight
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Buscar insight, palavra ou tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#15161a] border border-[#26272c] text-white focus:outline-none focus:border-purple-500"
                />

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#15161a] border border-[#26272c] text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="Todos">Todas as Categorias</option>
                  <option value="Padrao_Recorrente">Padrão Recorrente</option>
                  <option value="Falso_Positivo">Filtro Falso Positivo</option>
                  <option value="Combinacao_Indicadores">Combinação Indicadores</option>
                  <option value="Ajuste_Parametros">Ajuste de Parâmetros</option>
                  <option value="Excecao_Mercado">Exceção de Mercado</option>
                </select>
              </div>
            </div>

            {/* Manual Add Form Drawer Section */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCreateManualInsight}
                  className="p-4 bg-[#14151a] border-b border-emerald-500/20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Registrar Novo Insight Manual
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setShowAddForm(false)} 
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#8E9299] uppercase block mb-1">Categoria</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as KnowledgeCategory)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#0a0b0d] border border-[#26272c] text-xs text-white"
                      >
                        <option value="Padrao_Recorrente">Padrão Recorrente</option>
                        <option value="Falso_Positivo">Filtro Falso Positivo</option>
                        <option value="Combinacao_Indicadores">Combinação Indicadores</option>
                        <option value="Ajuste_Parametros">Ajuste de Parâmetros</option>
                        <option value="Excecao_Mercado">Exceção de Mercado</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#8E9299] uppercase block mb-1">Grau de Confiança ({newConfidence}%)</label>
                      <input 
                        type="range"
                        min="50"
                        max="95"
                        value={newConfidence}
                        onChange={(e) => setNewConfidence(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8E9299] uppercase block mb-1">
                      Resumo Objetivo ({300 - newSummary.length} caracteres restantes)
                    </label>
                    <textarea
                      required
                      maxLength={300}
                      rows={2}
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      placeholder="Descreva o padrão ou filtro identificado de forma estritamente objetiva..."
                      className="w-full p-2 rounded bg-[#0a0b0d] border border-[#26272c] text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8E9299] uppercase block mb-1">Tags (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="ex: PETR4, RSI, Volume, Suporte"
                      className="w-full px-2.5 py-1.5 rounded bg-[#0a0b0d] border border-[#26272c] text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow cursor-pointer"
                  >
                    Salvar Insight na Base
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List of Knowledge Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="py-20 text-center text-[#8E9299] text-xs">
                  Carregando Base de Conhecimento...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-[#8E9299] mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-gray-400">Nenhum insight encontrado</p>
                  <p className="text-xs text-[#8E9299]">Ajuste os filtros ou adicione novos aprendizados.</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div 
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      item.status === 'Descartado' 
                        ? 'bg-[#101114]/40 border-[#202126] opacity-60' 
                        : 'bg-[#121317] border-[#222328] hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(item.status)}
                        <span className="text-[11px] font-semibold text-[#8E9299] flex items-center gap-1">
                          {getCategoryIcon(item.category)}
                          {getCategoryLabel(item.category)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                          {item.confirmations_count}x confirmado
                        </span>
                        
                        <button
                          onClick={() => handleStatusChange(item.id, item.status)}
                          className="text-[#8E9299] hover:text-amber-400 transition-colors p-1"
                          title={item.status === 'Descartado' ? 'Reativar Insight' : 'Descartar Insight'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-200 leading-relaxed my-2.5">
                      "{item.summary}"
                    </p>

                    {/* Confidence Meter */}
                    <div className="space-y-1 my-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#8E9299]">Grau de Confiança:</span>
                        <span className="text-emerald-400 font-bold">{item.confidence_score}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1f2026] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            item.confidence_score >= 80 ? 'bg-emerald-500' :
                            item.confidence_score >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${item.confidence_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#202126] text-[10px] text-[#8E9299]">
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-[#1c1d22] text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <span>Último uso: {new Date(item.last_used_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222328] bg-[#0c0d10] text-[11px] text-[#8E9299] flex items-center justify-between">
              <span>Memória Estratégica Inteligente</span>
              <span className="font-mono text-purple-400">Limite Ativo: {MAX_ACTIVE_KNOWLEDGE_ITEMS} itens</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
