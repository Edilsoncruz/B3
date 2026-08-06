// Proxy do Vite: o browser chama /api/bolsai/... e o Vite encaminha para https://api.usebolsai.com/...
// Base URL conforme documentação oficial: https://api.usebolsai.com/api/v1
const BOLSAI_BASE = '/api/bolsai/api/v1';
const API_KEY = import.meta.env.VITE_BOLSAI_API_KEY;

async function fetchBolsai(endpoint: string, params: Record<string, string> = {}) {
  if (!API_KEY) {
    throw new Error('Chave VITE_BOLSAI_API_KEY não configurada no .env.local');
  }

  // URLSearchParams compatível com paths relativos (proxy Vite)
  const queryString = Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : '';

  const fullUrl = `${BOLSAI_BASE}${endpoint}${queryString}`;
  console.log(`[Bolsai] Requisição: ${fullUrl}`);

  const response = await fetch(fullUrl, {
    headers: {
      // Header correto conforme documentação: X-API-Key (não Authorization: Bearer)
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`[Bolsai 401] Chave X-API-Key inválida ou expirada. Verifique VITE_BOLSAI_API_KEY.`);
    }
    if (response.status === 429) {
      throw new Error('[Bolsai 429] Limite de requisições atingido (200/dia no plano Free).');
    }
    const body = await response.text().catch(() => response.statusText);
    // Evita logar HTML gigante no erro
    const shortBody = body.startsWith('<!DOCTYPE') ? '[HTML - endpoint inválido]' : body.slice(0, 200);
    throw new Error(`Erro Usebolsai [${response.status}]: ${shortBody}`);
  }

  return response.json();
}

/**
 * Cotação mais recente do ticker: open, high, low, close, volume
 * Endpoint: GET /stocks/{ticker}/quote
 */
export async function getStockQuote(ticker: string) {
  return fetchBolsai(`/stocks/${ticker}/quote`);
}

/**
 * Estatísticas de preço: máxima/mínima de 52 semanas, retorno YTD, variação diária
 * Endpoint: GET /stocks/{ticker}/stats
 */
export async function getStockStats(ticker: string) {
  return fetchBolsai(`/stocks/${ticker}/stats`);
}

/**
 * Histórico de preços OHLCV ajustado (usado para análise de suportes/mínimas de 52 semanas)
 * Endpoint: GET /stocks/{ticker}/history  [PRO]
 */
export async function getPriceHistory(ticker: string, limit: number = 252) {
  return fetchBolsai(`/stocks/${ticker}/history`, { limit: limit.toString() });
}

/**
 * Fundamentos completos (P/L, ROE, margens, dívida, etc.)
 * Endpoint: GET /fundamentals/{ticker}
 */
export async function getFundamentals(ticker: string) {
  return fetchBolsai(`/fundamentals/${ticker}`);
}

/**
 * Screener de ações com filtros fundamentalistas.
 * Usa sufixos _gt (maior que) e _lt (menor que). Requer plano Pro.
 * Endpoint: GET /screener
 * Exemplo: { pl_lt: '15', roe_gt: '10', limit: '20' }
 */
export async function screenStocks(params: Record<string, string> = {}) {
  return fetchBolsai('/screener', params);
}

/**
 * Macro: lista séries e estatísticas (Selic, IPCA, CDI) — requer plano Pro
 * Endpoint: GET /macro/stats
 */
export async function getMacroIndicator(indicator: string) {
  return fetchBolsai(`/macro/${indicator}`);
}
