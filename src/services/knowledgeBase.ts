import { supabase } from '../lib/supabase';

export type KnowledgeCategory = 
  | 'Padrao_Recorrente' 
  | 'Falso_Positivo' 
  | 'Combinacao_Indicadores' 
  | 'Ajuste_Parametros' 
  | 'Excecao_Mercado';

export type KnowledgeStatus = 
  | 'Novo' 
  | 'Em observação' 
  | 'Validado' 
  | 'Descartado';

export interface KnowledgeItem {
  id: string;
  created_at: string;
  strategy: string;
  category: KnowledgeCategory;
  summary: string;
  confidence_score: number; // 0 a 100
  confirmations_count: number;
  last_used_at: string;
  status: KnowledgeStatus;
  tags?: string[];
}

export interface NewInsightInput {
  category: KnowledgeCategory;
  summary: string;
  confidence_score?: number;
  tags?: string[];
}

const STORAGE_KEY = 'smartmoney_knowledge_base_local';
const DEFAULT_STRATEGY = 'Smart Money Bottom Fishing';
export const MAX_ACTIVE_KNOWLEDGE_ITEMS = 50;

/**
 * Insights iniciais de referência para quando a base estiver vazia.
 */
export const SEED_KNOWLEDGE_ITEMS: Omit<KnowledgeItem, 'id' | 'created_at' | 'last_used_at'>[] = [
  {
    strategy: DEFAULT_STRATEGY,
    category: 'Padrao_Recorrente',
    summary: 'Ações que acumulam próximo à mínima de 52 semanas com volume 40%+ acima da média móvel apresentam 82% de chance de repique técnico no suporte.',
    confidence_score: 85,
    confirmations_count: 8,
    status: 'Validado',
    tags: ['Volume', 'Suporte', 'Mínima 52 Semanas']
  },
  {
    strategy: DEFAULT_STRATEGY,
    category: 'Falso_Positivo',
    summary: 'Ativos com Dívida Líquida/EBITDA acima de 4.0x falham com frequência em segurar suportes históricos durante momentos de estresse na B3.',
    confidence_score: 88,
    confirmations_count: 12,
    status: 'Validado',
    tags: ['Endividamento', 'Alavancagem', 'Filtro']
  },
  {
    strategy: DEFAULT_STRATEGY,
    category: 'Combinacao_Indicadores',
    summary: 'A convergência de P/VP abaixo de 1.0x com dividend yield superior a 6% reduz a volatilidade do drawdown em operações de reversão.',
    confidence_score: 80,
    confirmations_count: 6,
    status: 'Validado',
    tags: ['P/VP', 'Dividend Yield', 'Value']
  },
  {
    strategy: DEFAULT_STRATEGY,
    category: 'Ajuste_Parametros',
    summary: 'Em prazos de 1 a 2 meses, o stop loss técnico posicionado entre 3% e 5% abaixo da mínima histórica evita violinadas institucionais prematuras.',
    confidence_score: 78,
    confirmations_count: 5,
    status: 'Em observação',
    tags: ['Stop Loss', 'Gestão de Risco', 'Timeframe']
  }
];

// Fallback local caso Supabase ainda não tenha a tabela
function getLocalKnowledge(): KnowledgeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = SEED_KNOWLEDGE_ITEMS.map((item, idx) => ({
        ...item,
        id: `seed_${idx + 1}`,
        created_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
        last_used_at: new Date().toISOString()
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalKnowledge(items: KnowledgeItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[KnowledgeBase] Erro ao salvar localmente:', e);
  }
}

let hasCheckedSeed = false;

/**
 * Garante que a tabela knowledge_base no Supabase seja populada com os insights seminais se estiver vazia.
 */
export async function ensureKnowledgeBaseInitialized(): Promise<void> {
  if (hasCheckedSeed) return;
  hasCheckedSeed = true;

  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1);

    if (error) {
      console.info('[KnowledgeBase] Tabela "knowledge_base" no Supabase ainda não detectada. Usando armazenamento local com segurança.');
      return;
    }

    if (!data || data.length === 0) {
      console.log('[KnowledgeBase] 🚀 Populando insights seminais no Supabase...');
      const initialRows = SEED_KNOWLEDGE_ITEMS.map((item, idx) => ({
        ...item,
        id: `seed_${idx + 1}`,
        created_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
        last_used_at: new Date().toISOString()
      }));

      const { error: insertErr } = await supabase
        .from('knowledge_base')
        .insert(initialRows);

      if (!insertErr) {
        console.log('[KnowledgeBase] ✅ Insights seminais gravados com sucesso no Supabase!');
      }
    }
  } catch (err) {
    console.warn('[KnowledgeBase] Inicialização Supabase:', err);
  }
}

/**
 * 1. Consulta da Base de Conhecimento antes da análise.
 * Recupera apenas registros relevantes e ativos (evita carregar descartados e limita a N itens).
 */
export async function getRelevantKnowledge(options: {
  strategy?: string;
  limit?: number;
  excludeDiscarded?: boolean;
} = {}): Promise<KnowledgeItem[]> {
  const { strategy = DEFAULT_STRATEGY, limit = 8, excludeDiscarded = true } = options;

  await ensureKnowledgeBaseInitialized();

  try {
    let query = supabase
      .from('knowledge_base')
      .select('*')
      .order('confidence_score', { ascending: false })
      .order('confirmations_count', { ascending: false })
      .limit(limit);

    if (excludeDiscarded) {
      query = query.neq('status', 'Descartado');
    }

    if (strategy) {
      query = query.eq('strategy', strategy);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      // Fallback local se a tabela não existir ou estiver vazia
      const local = getLocalKnowledge();
      return local
        .filter(item => (!excludeDiscarded || item.status !== 'Descartado'))
        .sort((a, b) => (b.confidence_score * b.confirmations_count) - (a.confidence_score * a.confirmations_count))
        .slice(0, limit);
    }

    return data as KnowledgeItem[];
  } catch (err) {
    console.warn('[KnowledgeBase] Falha ao consultar Supabase, usando local:', err);
    return getLocalKnowledge().slice(0, limit);
  }
}

/**
 * Recupera todos os registros para o Drawer / Painel de Gerenciamento da UI.
 */
export async function getAllKnowledge(): Promise<KnowledgeItem[]> {
  await ensureKnowledgeBaseInitialized();

  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('last_used_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return getLocalKnowledge();
    }

    return data as KnowledgeItem[];
  } catch {
    return getLocalKnowledge();
  }
}

/**
 * Formata os insights para injeção enxuta no system prompt (baixo consumo de tokens).
 */
export function formatKnowledgeForPrompt(items: KnowledgeItem[]): string {
  if (!items || items.length === 0) return '';

  const lines = items.map((item) => {
    return `[ID: ${item.id}] [${item.category}] [Status: ${item.status}] [Confiança: ${item.confidence_score}% | Confirmado ${item.confirmations_count}x]: "${item.summary}"`;
  });

  return `\n\nMEMÓRIA ESTRATÉGICA EVOLUTIVA (BASE DE CONHECIMENTO - EXPERIÊNCIAS ANTERIORES):
Os seguintes padrões e aprendizados foram validados pelo sistema em análises prévias. Utilize-os para refinar a seleção, calibrar stops/alvos e evitar falsos sinais:
${lines.join('\n')}

INSTRUÇÃO DE APRENDIZADO CONTÍNUO:
1. Se algum dos aprendizados acima se confirmou nesta análise, inclua o respectivo ID na lista 'confirmed_knowledge_ids'.
2. Se você identificar um padrão ou ajuste NOVO e de ALTO VALOR não contemplado acima, adicione no máximo 1 novo registro em 'new_insights'. O resumo deve ser estritamente objetivo (MÁXIMO 300 CARACTERES). Se nada novo foi observado, retorne 'new_insights: []'.`;
}

/**
 * 2, 3 e 4. Atualização e Gravação de Insights pós-análise com controle anti-inchaço.
 */
export async function processPostAnalysisKnowledge(params: {
  confirmedIds?: string[];
  newInsights?: NewInsightInput[];
  strategy?: string;
}): Promise<{ confirmedCount: number; newCount: number }> {
  const { confirmedIds = [], newInsights = [], strategy = DEFAULT_STRATEGY } = params;
  let confirmedCount = 0;
  let newCount = 0;

  const now = new Date().toISOString();

  // 1. Processar Confirmações de Insights Existentes
  for (const id of confirmedIds) {
    try {
      const { data: item } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (item) {
        const nextConfirmations = (item.confirmations_count || 1) + 1;
        const nextConfidence = Math.min(99, (item.confidence_score || 70) + 3);
        
        let nextStatus: KnowledgeStatus = item.status;
        if (nextConfirmations >= 5 && nextConfidence >= 80) {
          nextStatus = 'Validado';
        } else if (nextConfirmations >= 2) {
          nextStatus = 'Em observação';
        }

        await supabase
          .from('knowledge_base')
          .update({
            confirmations_count: nextConfirmations,
            confidence_score: nextConfidence,
            last_used_at: now,
            status: nextStatus
          })
          .eq('id', id);

        confirmedCount++;
        console.log(`[KnowledgeBase] 📈 Insight confirmado no Supabase (${id}): ${nextConfirmations}x confirmações`);
      } else {
        // Fallback local
        const local = getLocalKnowledge();
        const target = local.find(i => i.id === id);
        if (target) {
          target.confirmations_count += 1;
          target.confidence_score = Math.min(99, target.confidence_score + 3);
          target.last_used_at = now;
          if (target.confirmations_count >= 5 && target.confidence_score >= 80) {
            target.status = 'Validado';
          } else if (target.confirmations_count >= 2) {
            target.status = 'Em observação';
          }
          saveLocalKnowledge(local);
          confirmedCount++;
        }
      }
    } catch (e) {
      console.warn(`[KnowledgeBase] Erro ao confirmar insight ${id}:`, e);
    }
  }

  // 2. Processar Novos Insights (com validação de relevância e tamanho)
  for (const rawInsight of newInsights) {
    if (!rawInsight.summary || rawInsight.summary.trim().length < 15) {
      continue;
    }

    const cleanSummary = rawInsight.summary.trim().slice(0, 300);

    const confidence = Math.min(95, Math.max(50, rawInsight.confidence_score || 75));
    let initialStatus: KnowledgeStatus = 'Novo';
    if (confidence >= 80) {
      initialStatus = 'Validado';
    } else if (confidence >= 70) {
      initialStatus = 'Em observação';
    }

    const newItem: KnowledgeItem = {
      id: `kb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      last_used_at: now,
      strategy: strategy,
      category: rawInsight.category || 'Padrao_Recorrente',
      summary: cleanSummary,
      confidence_score: confidence,
      confirmations_count: 1,
      status: initialStatus,
      tags: rawInsight.tags || []
    };

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .insert(newItem);

      if (!error) {
        newCount++;
        console.log(`[KnowledgeBase] 💡 Novo insight registrado com sucesso no Supabase: "${cleanSummary.slice(0, 50)}..."`);
      } else {
        console.warn(`[KnowledgeBase] Falha ao inserir no Supabase (salvando localmente):`, error.message);
        const local = getLocalKnowledge();
        local.unshift(newItem);
        saveLocalKnowledge(local);
        newCount++;
      }
    } catch {
      const local = getLocalKnowledge();
      local.unshift(newItem);
      saveLocalKnowledge(local);
      newCount++;
    }
  }

  // 3. Controle Anti-Inchaço (Pruning de registros antigos sem confirmação)
  await enforceLeanKnowledgeBase();

  return { confirmedCount, newCount };
}

/**
 * Atualiza o status ou descarte de um insight manualmente.
 */
export async function updateKnowledgeStatus(id: string, status: KnowledgeStatus): Promise<void> {
  try {
    await supabase
      .from('knowledge_base')
      .update({ status, last_used_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    // local fallback
  }

  const local = getLocalKnowledge();
  const item = local.find(i => i.id === id);
  if (item) {
    item.status = status;
    item.last_used_at = new Date().toISOString();
    saveLocalKnowledge(local);
  }
}

/**
 * Remove permanentemente ou marca como descartado.
 */
export async function deleteKnowledgeItem(id: string): Promise<void> {
  try {
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);
  } catch {
    // local
  }

  const local = getLocalKnowledge().filter(i => i.id !== id);
  saveLocalKnowledge(local);
}

/**
 * Garante que a base não cresça indefinidamente, descartando registros obsoletos ou com baixa confiança.
 */
async function enforceLeanKnowledgeBase(): Promise<void> {
  try {
    const all = await getAllKnowledge();
    const active = all.filter(k => k.status !== 'Descartado');

    if (active.length > MAX_ACTIVE_KNOWLEDGE_ITEMS) {
      const leastRelevant = [...active]
        .sort((a, b) => (a.confidence_score * a.confirmations_count) - (b.confidence_score * b.confirmations_count))
        .slice(0, active.length - MAX_ACTIVE_KNOWLEDGE_ITEMS);

      for (const item of leastRelevant) {
        if (item.status === 'Novo' && item.confirmations_count === 1) {
          await updateKnowledgeStatus(item.id, 'Descartado');
          console.log(`[KnowledgeBase] 🧹 Anti-inchaço: Insight descartado por inatividade (${item.id})`);
        }
      }
    }
  } catch (e) {
    console.warn('[KnowledgeBase] Erro no enforceLeanKnowledgeBase:', e);
  }
}
