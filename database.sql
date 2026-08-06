-- Script de Inicialização Supabase
-- Cria a tabela de cache para as ações financeiras

CREATE TABLE IF NOT EXISTS stock_cache (
    ticker VARCHAR(10) PRIMARY KEY,
    current_price DECIMAL(10, 2),
    fundamentals JSONB,
    macro_data JSONB,
    price_history JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Função para atualizar o 'updated_at' automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger na tabela
DROP TRIGGER IF EXISTS set_timestamp ON stock_cache;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON stock_cache
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Habilitar Políticas de RLS (Row Level Security)
-- Como a chave é anon_key e o dashboard é público (ou apenas do usuário admin local), podemos permitir acesso livre ao cache
ALTER TABLE stock_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stock_cache;
CREATE POLICY "Enable read access for all users" ON stock_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON stock_cache;
CREATE POLICY "Enable insert for all users" ON stock_cache FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON stock_cache;
CREATE POLICY "Enable update for all users" ON stock_cache FOR UPDATE USING (true);
