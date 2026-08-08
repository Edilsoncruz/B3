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

DROP TABLE IF EXISTS analyzed_stocks;

CREATE TABLE IF NOT EXISTS analyzed_stocks (
    id VARCHAR(100) PRIMARY KEY,
    ticker VARCHAR(10),
    company_name VARCHAR(255),
    sector VARCHAR(100),
    current_price DECIMAL(10, 2),
    entry_price DECIMAL(10, 2),
    target_price DECIMAL(10, 2),
    stop_loss DECIMAL(10, 2),
    success_probability DECIMAL(5, 2),
    strategy_score DECIMAL(5, 2),
    risk_reward_ratio DECIMAL(5, 2),
    action VARCHAR(20),
    analysis TEXT,
    stock_data JSONB,
    is_favorite BOOLEAN DEFAULT false,
    invested_amount DECIMAL(10, 2),
    shares_quantity INTEGER,
    average_price DECIMAL(10, 2),
    programmed_target DECIMAL(10, 2),
    programmed_stop DECIMAL(10, 2),
    investment_date DATE,
    operation_status VARCHAR(20) DEFAULT 'ABERTA',
    indication_status VARCHAR(20) DEFAULT 'ABERTA',
    closing_price DECIMAL(10, 2),
    closing_date TIMESTAMP WITH TIME ZONE,
    closing_reason VARCHAR(50),
    profit_loss DECIMAL(10, 2),
    profit_loss_percentage DECIMAL(5, 2),
    last_verification_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_analyzed_stocks_updated_at ON analyzed_stocks;
CREATE TRIGGER update_analyzed_stocks_updated_at
    BEFORE UPDATE ON analyzed_stocks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- RLS Policies para analyzed_stocks
ALTER TABLE analyzed_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON analyzed_stocks;
CREATE POLICY "Enable read access for all users" ON analyzed_stocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON analyzed_stocks;
CREATE POLICY "Enable insert for all users" ON analyzed_stocks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON analyzed_stocks;
CREATE POLICY "Enable delete for all users" ON analyzed_stocks FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable update for all users" ON analyzed_stocks;
CREATE POLICY "Enable update for all users" ON analyzed_stocks FOR UPDATE USING (true);
