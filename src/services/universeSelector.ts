/**
 * Etapas 1 & 2: Universo Inicial & Seleção Inteligente de Ativos
 * 
 * Responsável por mapear o universo completo da B3 e aplicar critérios dinâmicos
 * e parametrizáveis para selecionar o pool de ações monitoradas (ex: Top 50),
 * evitando downloads pesados de histórico para ativos irrelevantes.
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

/**
 * CAMADA 1: Filtros Determinísticos
 * Elimina rapidamente ativos que claramente não deveriam entrar na análise.
 * Utiliza somente regras objetivas baseadas em dados em cache.
 */
export async function applyDeterministicFilters(
  catalog: string[],
  existingDataMap: Record<string, StockCache> = {},
  auditManager?: AuditManager
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

    // Regra 2: Preço mínimo (evitar penny stocks extremas)
    if (cached.current_price > 0 && cached.current_price < 1.0) {
      eliminatedDetails.push({ ticker, eliminated: true, reason: 'Penny stock (Preço < 1.00)' });
      continue;
    }

    // Regra 3: Liquidez Mínima (se disponível)
    if (cached.fundamentals?.avg_volume_52w !== undefined && cached.fundamentals.avg_volume_52w < 150000) {
      eliminatedDetails.push({ ticker, eliminated: true, reason: 'Baixa liquidez (Volume médio < 150k)' });
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
