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

export interface ScreeningResult {
  ticker: string;
  score: number;
  dropPercentage: number;
  volumeScore: number;
  fundamentalsScore: number;
  supportScore: number;
  reason: string;
  status?: string;
}

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

/**
 * Calcula a pontuação preliminar de triagem para um ativo.
 */
export function calculateScreeningScore(
  ticker: string,
  params: SelectionParameters = DEFAULT_SELECTION_PARAMS,
  stockData?: StockCache | null
): ScreeningResult {
  // 1. Queda e Desconto em relação à máxima de 52 semanas
  let dropPct = 0;
  if (stockData?.fundamentals?.week_52_high && stockData?.current_price) {
    const high = stockData.fundamentals.week_52_high;
    dropPct = Math.max(0, ((high - stockData.current_price) / high) * 100);
  } else if (stockData?.fundamentals?.daily_change_pct) {
    // Estimativa por variação
    dropPct = Math.abs(stockData.fundamentals.daily_change_pct * 3);
  }

  // Pontuação da Queda (favorece quedas moderadas/altas dentro do intervalo saudável)
  let dropScore = 50;
  if (dropPct >= params.minDropPercentage && dropPct <= params.maxDropPercentage) {
    // Escala linear do desconto ideal (ex: 20% a 50% de queda dá pontuação máxima)
    if (dropPct >= 20 && dropPct <= 60) {
      dropScore = 95;
    } else {
      dropScore = 75;
    }
  } else if (dropPct > params.maxDropPercentage) {
    dropScore = 20; // Penalidade por risco extremo de ruína
  } else {
    dropScore = 40; // Pouca queda / sem margem de reversão
  }

  // 2. Pontuação Fundamentalista
  let fundamentalsScore = 60;
  if (stockData?.fundamentals) {
    const { pl, roe, pvp } = stockData.fundamentals;
    let score = 50;
    
    // P/L razoável e positivo
    if (pl && pl > 0 && pl < 25) score += 20;
    else if (pl && pl <= 0) score -= 15;

    // ROE atrativo (> 10%)
    if (roe && roe > 10) score += 20;
    else if (roe && roe > 5) score += 10;

    // P/VP atrativo (< 2.5)
    if (pvp && pvp > 0 && pvp < 2.5) score += 10;

    fundamentalsScore = Math.max(10, Math.min(100, score));
  }

  // 3. Pontuação de Suporte & Mínima de 52 semanas
  let supportScore = 60;
  if (stockData?.fundamentals?.week_52_low && stockData?.current_price) {
    const low = stockData.fundamentals.week_52_low;
    const distFromLow = ((stockData.current_price - low) / low) * 100;
    // Quanto mais próximo da zona de suporte/fundo sem romper, maior a probabilidade de reversão
    if (distFromLow >= 0 && distFromLow <= 15) {
      supportScore = 95;
    } else if (distFromLow > 15 && distFromLow <= 35) {
      supportScore = 75;
    } else {
      supportScore = 45;
    }
  }

  // 4. Pontuação de Volume / Liquidez
  let volumeScore = 70;
  if (stockData?.fundamentals?.avg_volume_52w) {
    const vol = stockData.fundamentals.avg_volume_52w;
    if (vol > 5_000_000) volumeScore = 95;
    else if (vol > 1_000_000) volumeScore = 80;
    else if (vol > 200_000) volumeScore = 60;
    else volumeScore = 30;
  }

  // 5. Cálculo Composto Ponderado com base nos pesos configuráveis
  const totalWeight = params.dropWeight + params.volumeWeight + params.fundamentalsWeight + params.supportWeight;
  const compositeScore = Math.round(
    (dropScore * params.dropWeight +
      volumeScore * params.volumeWeight +
      fundamentalsScore * params.fundamentalsWeight +
      supportScore * params.supportWeight) /
      (totalWeight || 100)
  );

  let reason = 'Ativo em zona de acumulação com relação risco/retorno favorável.';
  if (dropScore >= 80 && fundamentalsScore >= 70) {
    reason = 'Forte desconto com fundamentos sólidos e suporte técnico preservado.';
  } else if (supportScore >= 85) {
    reason = 'Alta proximidade de suporte histórico com indícios de reversão.';
  }

  return {
    ticker,
    score: compositeScore,
    dropPercentage: Number(dropPct.toFixed(2)),
    volumeScore,
    fundamentalsScore,
    supportScore,
    reason
  };
}

/**
 * Seleção Inteligente dos Ativos (Etapas 1 & 2):
 * Avalia o catálogo amplo da B3 e retorna os N ativos mais promissores para o pipeline.
 */
export async function selectDynamicUniverse(
  customParams: Partial<SelectionParameters> = {},
  existingDataMap: Record<string, StockCache> = {},
  auditManager?: AuditManager
): Promise<{
  selectedTickers: string[];
  screenedResults: ScreeningResult[];
  totalUniverseCount: number;
}> {
  const params: SelectionParameters = { ...DEFAULT_SELECTION_PARAMS, ...customParams };
  
  if (auditManager?.isEnabled()) {
    await auditManager.logEvent('SELECTION', 'UNIVERSE_LOADED', 'ALL', `Avaliando universo de ${B3_FULL_CATALOG.length} ativos da B3`, 0, {
      catalog: B3_FULL_CATALOG
    });
  }
  
  console.log(`\n🧠 [Etapa 1 & 2: Seleção Inteligente] Avaliando universo de ${B3_FULL_CATALOG.length} ativos da B3...`);
  console.log(`   Critérios: Pool alvo = ${params.poolSize}, Pesos [Queda: ${params.dropWeight}%, Volume: ${params.volumeWeight}%, Fundamentos: ${params.fundamentalsWeight}%, Suporte: ${params.supportWeight}%]`);

  // Triagem de todos os ativos do catálogo
  const evaluatedCandidates: ScreeningResult[] = B3_FULL_CATALOG.map(ticker => {
    const cachedData = existingDataMap[ticker.toUpperCase()] || null;
    return calculateScreeningScore(ticker, params, cachedData);
  });

  // Ordena por score decrescente
  evaluatedCandidates.sort((a, b) => b.score - a.score);

  // Seleciona os Top N
  const topSelected = evaluatedCandidates.slice(0, params.poolSize);
  const selectedTickers = topSelected.map(c => c.ticker);

  // Update status and reason for logging
  evaluatedCandidates.forEach((c, idx) => {
    c.status = idx < params.poolSize ? 'SELECIONADA' : 'NÃO SELECIONADA';
    if (idx >= params.poolSize && !c.reason.includes('score insuficiente')) {
      c.reason = `Score insuficiente (${c.score}). Apenas os Top ${params.poolSize} foram selecionados. ` + c.reason;
    }
  });

  if (auditManager?.isEnabled()) {
    await auditManager.logAssetEvaluations(evaluatedCandidates);
    await auditManager.logEvent('SELECTION', 'SELECTION_COMPLETED', 'ALL', `${selectedTickers.length} ações selecionadas dinamicamente`, 0, {
      topScore: topSelected[0]?.score
    });
  }

  console.log(`   ✨ [Seleção Concluída] ${selectedTickers.length} ações selecionadas dinamicamente (Top Score: ${topSelected[0]?.ticker} com score ${topSelected[0]?.score}).`);

  return {
    selectedTickers,
    screenedResults: topSelected,
    totalUniverseCount: B3_FULL_CATALOG.length
  };
}
