/**
 * Etapas 1 & 2: Universo Inicial & Seleção Inteligente de Ativos — Smart Money Tracker AI v3.2
 *
 * FILTROS PRÉ-IA (Camada 1) — 100% determinísticos, sem chamada de IA.
 * Eliminam rapidamente ativos claramente inadequados antes de qualquer processamento.
 *
 * Critérios (doc 3.2, seção 65-68):
 *   - Preço mínimo (Anti-Mico): ≥ R$ 5,00
 *   - Liquidez: Volume Financeiro Médio (preço × avg_volume_52w) ≥ R$ 20.000.000
 *   - Todos os parâmetros são configuráveis
 *
 * Nota sobre o filtro de liquidez:
 *   O campo avg_volume_52w representa quantidade média de ações negociadas.
 *   Para obter volume financeiro: preço_atual × avg_volume_52w.
 *   O threshold de R$ 20M é aplicado sobre esse produto.
 *   Uma ação de R$ 3 negociando 150k ações/dia = R$ 450k/dia — muito abaixo do piso.
 *   Uma ação de R$ 50 negociando 500k ações/dia = R$ 25M/dia — acima do piso. ✓
 */

import { StockCache } from '../lib/supabase';
import { AuditManager } from './auditManager';

// Parâmetros configuráveis da Seleção Inteligente
export interface SelectionParameters {
  poolSize: number;                // Quantidade de ativos a selecionar (ex: 50)
  minDropPercentage: number;       // Queda mínima em relação à máxima de 52 sem. (ex: 10%)
  maxDropPercentage: number;       // Queda máxima para evitar empresas falimentares (ex: 85%)
  minLiquidityScore: number;       // Score mínimo de liquidez (0 a 100)
  dropWeight: number;              // Peso do fator queda/desconto (ex: 30)
  volumeWeight: number;            // Peso do fator volume/fluxo (ex: 25)
  fundamentalsWeight: number;      // Peso do fator fundamentalista (ex: 25)
  supportWeight: number;           // Peso da proximidade de suporte/mínimas (ex: 20)
}

export const DEFAULT_SELECTION_PARAMS: SelectionParameters = {
  poolSize: 50,
  minDropPercentage: 8,
  maxDropPercentage: 80,
  minLiquidityScore: 30,
  dropWeight: 30,
  volumeWeight: 25,
  fundamentalsWeight: 25,
  supportWeight: 20
};

/**
 * Catálogo Amplo do Mercado Brasileiro (B3)
 * Abrange mais de 400 dos principais ativos negociados em bolsa, cobrindo todos os setores
 * da economia: Petróleo, Mineração, Bancos, Elétricas, Saneamento, Varejo, Saúde,
 * Indústria, Agronegócio, Tecnologia, Telecom, Construção e Small Caps.
 */
export const B3_FULL_CATALOG: string[] = [
  // --- PETRÓLEO, GÁS & BIOCOMBUSTÍVEIS ---
  'PETR4', 'PETR3', 'PRIO3', 'VBBR3', 'CSAN3', 'UGPA3', 'RECV3', 'RRRP3', 'ENAT3', 'RPMG3', 'OPCT3',

  // --- MINERAÇÃO, SIDERURGIA & METALURGIA ---
  'VALE3', 'GGBR4', 'GGBR3', 'CSNA3', 'USIM5', 'USIM3', 'GOAU4', 'GOAU3', 'CBAV3', 'FESA4', 'BRAP4', 'BRAP3',

  // --- BANCOS & SERVIÇOS FINANCEIROS ---
  'ITUB4', 'ITUB3', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'SANB4', 'SANB3', 'B3SA3', 'BPAC11', 'ITSA4', 'ITSA3',
  'BRSR6', 'ABCB4', 'BNBR3', 'CXSE3', 'BBSE3', 'PSSA3', 'SULA11', 'WIZC3', 'CIEL3', 'BIDI11', 'MODL3',

  // --- ENERGIA ELÉTRICA & SANEAMENTO ---
  'ELET3', 'ELET6', 'CPLE6', 'CPLE3', 'EQTL3', 'CMIG4', 'CMIG3', 'CPFE3', 'SBSP3', 'EGIE3', 'TAEE11', 'TAEE4', 'TAEE3',
  'ENEV3', 'NEOE3', 'ALUP11', 'TRPL4', 'TRPL3', 'CESP6', 'ENGI11', 'AESB3', 'MEGA3', 'AMBP3', 'SAPR11', 'SAPR4', 'CSMG3',

  // --- PAPEL, CELULOSE & AGRO ---
  'SUZB3', 'KLBN11', 'KLBN4', 'SMTO3', 'SLCE3', 'AGRO3', 'TTEN3', 'RAIZ4', 'JALL3', 'SOJA3',

  // --- CONSUMO NÃO CÍCLICO & ALIMENTOS ---
  'ABEV3', 'JBSS3', 'BRFS3', 'BEEF3', 'MRFG3', 'MDNE3', 'CAML3', 'MDIA3', 'ASAI3', 'CRFB3', 'GMAT3', 'PCAR3',

  // --- VAREJO & CONSUMO CÍCLICO ---
  'LREN3', 'MGLU3', 'VIIA3', 'BHIA3', 'ARZZ3', 'SOMA3', 'ALPA4', 'PETZ3', 'CEAB3', 'VULC3', 'GRND3', 'GUAR3', 'ESPA3',
  'AMAR3', 'LJQQ3', 'SBFG3', 'TFCO4', 'HBSA3',

  // --- SAÚDE & DIAGNÓSTICOS ---
  'RADL3', 'RDOR3', 'HAPV3', 'FLRY3', 'PARD3', 'ONCO3', 'VVEO3', 'MATD3', 'ODPV3', 'BLAU3', 'PNVL3', 'DMVF3', 'QUAL3',

  // --- INDÚSTRIA, BENS DE CAPITAL & LOGÍSTICA ---
  'WEGE3', 'RENT3', 'EMBR3', 'CCRO3', 'RAIL3', 'ECOR3', 'STBP3', 'TUPY3', 'SHUL4', 'LEVE3', 'FRAS3', 'MYPK3',
  'RAPT4', 'POMO4', 'TGMA3', 'LOGN3', 'JSLG3', 'SIMH3', 'VAMO3', 'AZUL4', 'GOLL4', 'CVCB3',

  // --- TECNOLOGIA, SOFTWARE & TELECOM ---
  'TIMS3', 'VIVT3', 'TOTS3', 'INTB3', 'LWSA3', 'POSI3', 'CASH3', 'MLAS3', 'BMOB3', 'DESK3', 'FIQE3', 'BRIT3', 'IFCM3',

  // --- CONSTRUÇÃO, IMOBILIÁRIO & SHOPPINGS ---
  'MULT3', 'CYRE3', 'EZTC3', 'MRVE3', 'DIRR3', 'CURY3', 'PLPL3', 'TEND3', 'JHSF3', 'LAVV3', 'TRIS3', 'EVEN3', 'HBOR3',
  'ALOS3', 'IGTI11', 'LOGG3', 'SYNE3', 'SCAR3', 'GFSA3',

  // --- EDUCAÇÃO ---
  'COGN3', 'YDUQ3', 'ANIM3', 'SEER3', 'CSED3',

  // --- QUÍMICOS, MATERIAIS & DIVERSOS ---
  'UNIP6', 'BRKM5', 'DXCO3', 'WIZC3', 'VITT3', 'AURE3', 'SHOW3', 'MOVI3', 'KEPL3', 'SEQL3', 'PORT3', 'LAND3'
];

export interface FilterResult {
  ticker: string;
  eliminated: boolean;
  reason?: string;
}

export interface FallCandidateResult {
  /** Tickers que passaram pelo critério QUEDA + RECUPERAÇÃO — vão para a Luna */
  fallCandidates: string[];
  /** Tickers elegíveis (L1) que foram descartados da triagem IA por não apresentarem o padrão */
  excludedFromTriage: FilterResult[];
  /** Estatísticas para auditoria */
  stats: {
    totalEligible: number;
    falling: number;
    recovering: number;
    stable: number;
    rising: number;
    noCacheData: number;
  };
}

/**
 * CAMADA 1: Filtros Determinísticos
 * Elimina rapidamente ativos que claramente não deveriam entrar na análise.
 * Utiliza somente regras objetivas baseadas em dados em cache.
 */
export async function applyDeterministicFilters(
  catalog: string[],
  existingDataMap: Record<string, StockCache> = {},
  auditManager?: AuditManager,
  maxPrice?: number
): Promise<{
  eligibleTickers: string[];
  eliminatedDetails: FilterResult[];
}> {
  const eligibleTickers: string[] = [];
  const eliminatedDetails: FilterResult[] = [];

  for (const ticker of catalog) {
    const cached = existingDataMap[ticker.toUpperCase()];
    
    // Regra 1: Requer dados em cache ou é considerado elegível (para L2/L3 decidirem/baixarem)
    // Se a estratégia obriga ter dados, podemos eliminar. Vamos manter elegível se não tiver cache
    // para não ignorar ativos novos. Mas se tiver cache, filtramos.
    if (!cached) {
      eligibleTickers.push(ticker);
      continue;
    }

    // Regra 2: Preço mínimo Anti-Mico (doc 3.2 §65.1 — referência inicial R$ 5,00)
    // Reduz ativos excessivamente baratos que geralmente indicam alta especulação ou
    // deterioração estrutural da empresa.
    const MIN_PRICE = 5.0;
    if (cached.current_price > 0 && cached.current_price < MIN_PRICE) {
      eliminatedDetails.push({ ticker, eliminated: true, reason: `Anti-Mico: preço R$ ${cached.current_price.toFixed(2)} < R$ ${MIN_PRICE.toFixed(2)}` });
      continue;
    }

    // Regra 3: Liquidez Mínima — Volume Financeiro Médio ≥ R$ 20.000.000 (doc 3.2 §66)
    // Calcula volume financeiro como: preço_atual × avg_volume_52w (qtd de ações)
    // IMPORTANTE: avg_volume_52w está em quantidade de ações, não em R$.
    // Uma ação de R$ 3 negociando 150k ações/dia = R$ 450k/dia → REJEITADA corretamente.
    // Uma ação de R$ 200 negociando 150k ações/dia = R$ 30M/dia → APROVADA corretamente.
    const MIN_VOLUME_FINANCIAL = 20_000_000; // R$ 20 milhões
    if (cached.fundamentals?.avg_volume_52w !== undefined && cached.current_price > 0) {
      const volumeFinancial = cached.fundamentals.avg_volume_52w * cached.current_price;
      if (volumeFinancial < MIN_VOLUME_FINANCIAL) {
        eliminatedDetails.push({
          ticker,
          eliminated: true,
          reason: `Liquidez insuficiente: vol. financeiro R$ ${(volumeFinancial / 1_000_000).toFixed(1)}M < R$ ${(MIN_VOLUME_FINANCIAL / 1_000_000).toFixed(0)}M`
        });
        continue;
      }
    } else if (cached.fundamentals?.avg_volume_52w !== undefined && cached.fundamentals.avg_volume_52w < 1000) {
      // Fallback: sem preço disponível mas volume extremamente baixo (< 1000 ações/dia)
      eliminatedDetails.push({ ticker, eliminated: true, reason: 'Liquidez insuficiente (volume extremamente baixo)' });
      continue;
    }

    // Regra 4: Preço máximo
    if (maxPrice !== undefined && cached.current_price > maxPrice) {
      eliminatedDetails.push({ ticker, eliminated: true, reason: `Preço acima do limite (${cached.current_price} > ${maxPrice})` });
      continue;
    }

    eligibleTickers.push(ticker);
  }

  if (auditManager?.isEnabled()) {
    await auditManager.logEvent('LAYER_1', 'FILTERS_APPLIED', 'ALL', `Filtros aplicados. Elegíveis: ${eligibleTickers.length}. Eliminados: ${eliminatedDetails.length}`, 0, {
      total: catalog.length,
      eliminated: eliminatedDetails
    });
  }

  return { eligibleTickers, eliminatedDetails };
}

/**
 * CAMADA 1.5: Pré-Filtro Estratégico — QUEDA + RECUPERAÇÃO
 *
 * Filtra matematicamente os ativos elegíveis (pós Camada 1) para identificar
 * apenas aqueles que atendem ao critério central da estratégia:
 *   1. Sofreram queda relevante em relação à máxima de 52 semanas (≥ minDropFromHigh%)
 *   2. Apresentam sinal inicial de recuperação desde a mínima de 52 semanas (≥ minRiseFromLow%)
 *
 * Ações sem dados em cache passam direto para não perder oportunidades novas.
 * Volume, fundamentos e outros indicadores NÃO são critérios de eliminação aqui —
 * eles serão usados pela Luna para PRIORIZAR entre as candidatas.
 */
export function applyRecoveryPreFilter(
  eligibleTickers: string[],
  dataMap: Record<string, StockCache>,
  minDropFromHigh: number = 10,   // % mínimo de queda da máxima de 52s
  minRiseFromLow: number = 3      // % mínimo de repique da mínima de 52s
): FallCandidateResult {
  const fallCandidates: string[] = [];
  const excludedFromTriage: FilterResult[] = [];

  const stats = { totalEligible: eligibleTickers.length, falling: 0, recovering: 0, stable: 0, rising: 0, noCacheData: 0 };

  for (const ticker of eligibleTickers) {
    const cached = dataMap[ticker.toUpperCase()];

    // Sem dados em cache → passa direto (precaução: não descartar ativos novos)
    if (!cached || !cached.current_price || !cached.fundamentals?.week_52_high || !cached.fundamentals?.week_52_low) {
      fallCandidates.push(ticker);
      stats.noCacheData++;
      continue;
    }

    const price = cached.current_price;
    const high52w = cached.fundamentals.week_52_high;
    const low52w = cached.fundamentals.week_52_low;

    // Calcular distâncias percentuais
    const dropFromHigh = high52w > 0 ? ((high52w - price) / high52w) * 100 : 0;
    const riseFromLow  = low52w  > 0 ? ((price - low52w)  / low52w)  * 100 : 0;

    const isFalling   = dropFromHigh >= minDropFromHigh;
    const isRecovering = riseFromLow >= minRiseFromLow;

    if (!isFalling) {
      // Ação em alta ou estável — não é candidata da estratégia
      if (dropFromHigh < 5) {
        stats.rising++;
        excludedFromTriage.push({ ticker, eliminated: true, reason: `Em alta / próxima da máxima (queda de apenas ${dropFromHigh.toFixed(1)}% da máxima de 52s)` });
      } else {
        stats.stable++;
        excludedFromTriage.push({ ticker, eliminated: true, reason: `Queda insuficiente (${dropFromHigh.toFixed(1)}% — mínimo exigido: ${minDropFromHigh}%)` });
      }
      continue;
    }

    stats.falling++;

    if (!isRecovering) {
      // Em queda mas sem sinal de repique ainda — excluída desta rodada
      stats.stable++;
      excludedFromTriage.push({ ticker, eliminated: true, reason: `Em queda (${dropFromHigh.toFixed(1)}%) mas sem sinal de recuperação (repique de ${riseFromLow.toFixed(1)}% — mínimo: ${minRiseFromLow}%)` });
      continue;
    }

    // ✅ QUEDA + RECUPERAÇÃO — candidata para a Luna
    stats.recovering++;
    fallCandidates.push(ticker);
  }

  console.log(`\n🔍 [Camada 1.5] Pré-filtro QUEDA+RECUPERAÇÃO:`);
  console.log(`   Elegíveis recebidos: ${stats.totalEligible}`);
  console.log(`   Em queda: ${stats.falling} | Com recuperação: ${stats.recovering} | Estáveis/Alta: ${stats.stable + stats.rising} | Sem cache: ${stats.noCacheData}`);
  console.log(`   → Candidatas para Luna: ${fallCandidates.length}`);

  return { fallCandidates, excludedFromTriage, stats };
}
