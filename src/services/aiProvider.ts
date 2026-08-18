/**
 * AI Provider Abstraction Layer
 *
 * Permite alternar entre OpenAI, DeepSeek e Kimi (Moonshot)
 * sem alterar os prompts ou a lógica de negócio.
 *
 * Chaves de API lidas exclusivamente das variáveis de ambiente (.env.local):
 *   VITE_OPENAI_API_KEY
 *   VITE_DEEPSEEK_API_KEY
 *   VITE_KIMI_API_KEY
 *
 * Preferência de provedor por camada (qual modelo usar) salva no localStorage:
 *   ai_provider_luna_terra: 'openai' | 'deepseek'
 *   ai_provider_sol:        'openai' | 'kimi'
 */

import OpenAI from 'openai';

export type LunaTerraProvider = 'openai' | 'deepseek';
export type SolProvider       = 'openai' | 'kimi';
export type AILayer           = 'luna' | 'terra' | 'sol';

export interface AIConfig {
  lunaTerraProvider: LunaTerraProvider;
  solProvider: SolProvider;
}

const STORAGE_KEYS = {
  lunaTerraProvider: 'ai_provider_luna_terra',
  solProvider:       'ai_provider_sol',
} as const;

// Modelos por provedor e camada
export const MODEL_MAP = {
  openai: {
    luna:  'gpt-5.6-luna',
    terra: 'gpt-5.6-terra',
    sol:   'gpt-5.6-sol',
  },
  deepseek: {
    luna:  'deepseek-v4-flash',
    terra: 'deepseek-v4-flash',
  },
  kimi: {
    sol: 'kimi-k3',
  },
} as const;

// Base URLs das APIs alternativas (ambas compatíveis com OpenAI SDK)
const BASE_URLS = {
  deepseek: 'https://api.deepseek.com',
  // O SDK da OpenAI exige uma URL absoluta (não aceita caminhos relativos puros).
  // Usamos window.location.origin para montar a URL completa do proxy Vite local.
  get kimi() { 
    return typeof window !== 'undefined' ? `${window.location.origin}/api/moonshot/v1` : 'https://api.moonshot.cn/v1'; 
  },
};

/** Lê a preferência de provedor do localStorage */
export function getAIConfig(): AIConfig {
  return {
    lunaTerraProvider: (localStorage.getItem(STORAGE_KEYS.lunaTerraProvider) as LunaTerraProvider) || 'deepseek',
    solProvider:       (localStorage.getItem(STORAGE_KEYS.solProvider)       as SolProvider)       || 'kimi',
  };
}

/** Salva a preferência de provedor no localStorage (sem chaves de API) */
export function saveAIConfig(config: Partial<AIConfig>) {
  if (config.lunaTerraProvider !== undefined)
    localStorage.setItem(STORAGE_KEYS.lunaTerraProvider, config.lunaTerraProvider);
  if (config.solProvider !== undefined)
    localStorage.setItem(STORAGE_KEYS.solProvider, config.solProvider);
}

/** Retorna o nome do modelo ativo para uma camada */
export function getActiveModel(layer: AILayer): string {
  const config = getAIConfig();
  if (layer === 'sol') {
    return config.solProvider === 'kimi' ? MODEL_MAP.kimi.sol : MODEL_MAP.openai.sol;
  }
  return config.lunaTerraProvider === 'deepseek'
    ? MODEL_MAP.deepseek[layer as 'luna' | 'terra']
    : MODEL_MAP.openai[layer];
}

/** Retorna as chaves de API a partir das variáveis de ambiente */
function getEnvKeys() {
  return {
    openai:   import.meta.env.VITE_OPENAI_API_KEY   || '',
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    kimi:     import.meta.env.VITE_KIMI_API_KEY     || '',
  };
}

/** Verifica se as chaves necessárias para a configuração atual estão presentes */
export function validateAPIKeys(): { valid: boolean; missing: string[] } {
  const config  = getAIConfig();
  const keys    = getEnvKeys();
  const missing: string[] = [];

  if (config.lunaTerraProvider === 'deepseek' && !keys.deepseek)
    missing.push('VITE_DEEPSEEK_API_KEY');
  if (config.solProvider === 'kimi' && !keys.kimi)
    missing.push('VITE_KIMI_API_KEY');
  if ((config.lunaTerraProvider === 'openai' || config.solProvider === 'openai') && !keys.openai)
    missing.push('VITE_OPENAI_API_KEY');

  return { valid: missing.length === 0, missing };
}

/**
 * Executa uma chamada de IA para a camada especificada.
 * Roteia automaticamente para o provedor configurado,
 * lendo a chave de API exclusivamente das variáveis de ambiente.
 */
export async function callAI(
  layer: AILayer,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  responseFormat: 'json_object' | 'text' = 'json_object'
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const config = getAIConfig();
  const keys   = getEnvKeys();

  // Determina provedor para esta camada
  const isLunaTerra = layer === 'luna' || layer === 'terra';
  const provider    = isLunaTerra ? config.lunaTerraProvider : config.solProvider;

  let apiKey: string;
  let baseURL: string | undefined;
  const model = getActiveModel(layer);

  if (provider === 'openai') {
    apiKey  = keys.openai;
    baseURL = undefined;
  } else if (provider === 'deepseek') {
    apiKey  = keys.deepseek;
    baseURL = BASE_URLS.deepseek;
  } else {
    apiKey  = keys.kimi;
    baseURL = BASE_URLS.kimi;
  }

  if (!apiKey) {
    const varName = provider === 'openai' ? 'VITE_OPENAI_API_KEY'
                  : provider === 'deepseek' ? 'VITE_DEEPSEEK_API_KEY'
                  : 'VITE_KIMI_API_KEY';
    throw new Error(
      `Chave de API não encontrada para o provedor "${provider}" (camada ${layer.toUpperCase()}). Adicione ${varName} ao arquivo .env.local e reinicie o servidor.`
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });

  // Parâmetros extras para Kimi K3 (reasoning_effort)
  const extraParams: Record<string, unknown> = {};
  if (provider === 'kimi' && layer === 'sol') {
    extraParams.reasoning_effort = 'high';
  }

  const response = await (client.chat.completions.create as Function)({
    model,
    messages,
    response_format: { type: responseFormat },
    ...extraParams,
  });

  const content = (response as any).choices[0].message.content || '';
  const usage   = (response as any).usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  console.log(`[AI] Layer=${layer.toUpperCase()} | Provider=${provider} | Model=${model} | Tokens=${usage.total_tokens}`);

  return { content, usage };
}

/** Testa a conexão com um provedor usando a chave do .env */
export async function testProviderConnection(
  provider: 'openai' | 'deepseek' | 'kimi'
): Promise<{ ok: boolean; error?: string; model: string }> {
  const keys  = getEnvKeys();
  const apiKey = keys[provider];
  const baseURL = provider === 'deepseek' ? BASE_URLS.deepseek
               : provider === 'kimi'     ? BASE_URLS.kimi
               : undefined;

  const model = provider === 'deepseek' ? MODEL_MAP.deepseek.luna
              : provider === 'kimi'     ? MODEL_MAP.kimi.sol
              : MODEL_MAP.openai.luna;

  if (!apiKey) {
    const varName = provider === 'openai' ? 'VITE_OPENAI_API_KEY'
                  : provider === 'deepseek' ? 'VITE_DEEPSEEK_API_KEY'
                  : 'VITE_KIMI_API_KEY';
    return { ok: false, error: `${varName} não está definida no .env.local`, model };
  }

  try {
    const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    
    const reqOpts: any = {
      model,
      messages: [{ role: 'user', content: 'Responda apenas: ok' }]
    };

    if (provider === 'openai') {
      reqOpts.max_completion_tokens = 5;
    } else {
      reqOpts.max_tokens = 5;
    }

    await (client.chat.completions.create as Function)(reqOpts);
    return { ok: true, model };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Erro desconhecido', model };
  }
}

