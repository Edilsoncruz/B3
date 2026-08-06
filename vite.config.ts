import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Suporte ao prefixo VITE_ (padrão Vite) e sem prefixo (legado)
      'process.env.OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.BOLSAI_API_KEY': JSON.stringify(env.VITE_BOLSAI_API_KEY || env.BOLSAI_API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
      proxy: {
        // Proxy para a API da Usebolsai — resolve o bloqueio de CORS no browser
        // O browser chama /api/bolsai/api/v1/... e o Vite encaminha para https://api.usebolsai.com/api/v1/...
        '/api/bolsai': {
          target: 'https://api.usebolsai.com',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/bolsai/, ''),
          secure: true,
        }
      }
    },
  };
});
