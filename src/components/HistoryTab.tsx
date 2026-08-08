import React, { useState, useEffect } from 'react';
import { getIndicationsHistoryWithFilters, HistoryFilters } from '../lib/supabase';
import { HistoryCard } from './HistoryCard';
import { Loader2, Search, Filter, X, ArrowUpDown } from 'lucide-react';

export function HistoryTab() {
  const [loading, setLoading] = useState(false);
  const [indications, setIndications] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [page, setPage] = useState(1);
  const limit = 20;

  const [filters, setFilters] = useState<HistoryFilters>({});
  const [localSearch, setLocalSearch] = useState('');
  
  const [orderBy, setOrderBy] = useState('created_at');
  const [ascending, setAscending] = useState(false);

  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, count } = await getIndicationsHistoryWithFilters(filters, page, limit, orderBy, ascending);
    setIndications(data || []);
    setTotalCount(count);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [filters, page, orderBy, ascending]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, ticker: localSearch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({});
    setLocalSearch('');
    setOrderBy('created_at');
    setAscending(false);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      
      {/* Top Header / Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0a0b0d] p-4 rounded-2xl border border-[#2a2b2f]">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-white">Histórico de Indicações</h2>
          <span className="text-xs text-gray-500 font-mono">
            {loading ? 'Carregando...' : `${indications.length} de ${totalCount} indicações`}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar ação..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full bg-[#15161a] border border-[#2a2b2f] rounded-full py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </form>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full border transition-colors ${showFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#15161a] border-[#2a2b2f] text-gray-400 hover:text-white'}`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters Area */}
      {showFilters && (
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Filtros Avançados</h3>
            <button onClick={handleClearFilters} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-gray-500">Status da Operação</label>
              <select 
                value={filters.statusOperation || ''} 
                onChange={(e) => {
                  setFilters({ ...filters, statusOperation: e.target.value || undefined });
                  setPage(1);
                }}
                className="bg-[#15161a] border border-[#2a2b2f] rounded text-xs text-white p-2"
              >
                <option value="">Todas</option>
                <option value="SEM OPERAÇÃO">Sem Operação</option>
                <option value="ABERTA">Aberta</option>
                <option value="ALVO ATINGIDO">Alvo Atingido</option>
                <option value="STOP ATINGIDO">Stop Atingido</option>
                <option value="CANCELADO">Cancelada</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-gray-500">Score Mínimo</label>
              <input 
                type="number" 
                value={filters.minScore || ''}
                onChange={(e) => {
                  setFilters({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined });
                  setPage(1);
                }}
                className="bg-[#15161a] border border-[#2a2b2f] rounded text-xs text-white p-2"
                placeholder="Ex: 80"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-gray-500">Probabilidade Mínima</label>
              <input 
                type="number" 
                value={filters.minProbability || ''}
                onChange={(e) => {
                  setFilters({ ...filters, minProbability: e.target.value ? Number(e.target.value) : undefined });
                  setPage(1);
                }}
                className="bg-[#15161a] border border-[#2a2b2f] rounded text-xs text-white p-2"
                placeholder="Ex: 70"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-gray-500">Ordenação</label>
              <div className="flex items-center gap-2">
                <select 
                  value={orderBy} 
                  onChange={(e) => setOrderBy(e.target.value)}
                  className="bg-[#15161a] border border-[#2a2b2f] rounded text-xs text-white p-2 flex-1"
                >
                  <option value="created_at">Data</option>
                  <option value="strategy_score">Score</option>
                  <option value="success_probability">Probabilidade</option>
                  <option value="ticker">Ação</option>
                </select>
                <button 
                  onClick={() => setAscending(!ascending)}
                  className="p-2 bg-[#15161a] border border-[#2a2b2f] rounded text-gray-400 hover:text-white"
                  title={ascending ? "Crescente" : "Decrescente"}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-4 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        )}
        
        {!loading && indications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2a2b2f] rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-[#15161a] flex items-center justify-center mb-4 text-gray-600">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Nenhuma indicação encontrada.</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-4">
              {Object.keys(filters).length > 0 
                ? 'Tente alterar ou remover alguns filtros.' 
                : 'As indicações realizadas pelo sistema aparecerão aqui.'}
            </p>
            {Object.keys(filters).length > 0 && (
              <button onClick={handleClearFilters} className="text-xs px-4 py-2 bg-white text-black font-bold rounded-full">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          indications.map((ind) => (
            <HistoryCard key={ind.id} indication={ind} />
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalCount > limit && (
        <div className="flex items-center justify-center gap-4 pt-6 pb-12">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#15161a] border border-[#2a2b2f] rounded-lg text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs font-mono text-gray-500">
            Página {page} de {Math.ceil(totalCount / limit)}
          </span>
          <button 
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(totalCount / limit)}
            className="px-4 py-2 bg-[#15161a] border border-[#2a2b2f] rounded-lg text-sm disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
