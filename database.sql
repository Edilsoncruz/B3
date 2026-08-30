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

-- --------------------------------------------------------
-- TABELAS DE AUDITORIA
-- --------------------------------------------------------

-- 1. Execução Principal (Audit Run)
CREATE TABLE IF NOT EXISTS audit_runs (
    audit_id VARCHAR(50) PRIMARY KEY,
    execution_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    strategy VARCHAR(100),
    strategy_version VARCHAR(50),
    analysis_mode VARCHAR(100),
    pool_size INTEGER,
    recommendation_count INTEGER,
    target_period_value INTEGER,
    target_period_unit VARCHAR(20),
    selection_params JSONB,
    total_execution_time_ms INTEGER,
    total_tokens INTEGER,
    total_prompt_tokens INTEGER,
    total_response_tokens INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on audit_runs" ON audit_runs FOR ALL USING (true) WITH CHECK (true);

-- 2. Eventos da Execução (Linha do Tempo)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) REFERENCES audit_runs(audit_id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    stage VARCHAR(100),
    event_type VARCHAR(50),
    ticker VARCHAR(10),
    description TEXT,
    duration_ms INTEGER,
    metadata JSONB
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on audit_events" ON audit_events FOR ALL USING (true) WITH CHECK (true);

-- 3. Avaliação de Ativos (Universo)
CREATE TABLE IF NOT EXISTS audit_asset_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) REFERENCES audit_runs(audit_id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    rank_position INTEGER,
    drop_score DECIMAL(5,2),
    volume_score DECIMAL(5,2),
    fundamentals_score DECIMAL(5,2),
    support_score DECIMAL(5,2),
    composite_score DECIMAL(5,2),
    status VARCHAR(20), -- 'SELECIONADA', 'NÃO SELECIONADA'
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE audit_asset_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on audit_asset_evaluations" ON audit_asset_evaluations FOR ALL USING (true) WITH CHECK (true);

-- 4. Sincronização de Dados
CREATE TABLE IF NOT EXISTS audit_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) REFERENCES audit_runs(audit_id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    sync_status VARCHAR(50), -- 'CACHE HIT', 'MISSING PERIOD', 'ERROR'
    last_available_date TIMESTAMP WITH TIME ZONE,
    target_date TIMESTAMP WITH TIME ZONE,
    missing_period_start TIMESTAMP WITH TIME ZONE,
    missing_period_end TIMESTAMP WITH TIME ZONE,
    records_found INTEGER,
    records_added INTEGER,
    source VARCHAR(50),
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE audit_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on audit_sync" ON audit_sync FOR ALL USING (true) WITH CHECK (true);

-- 5. Resultados Finais da IA
CREATE TABLE IF NOT EXISTS audit_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) REFERENCES audit_runs(audit_id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    final_rank INTEGER,
    analyzed_price DECIMAL(10,2),
    target_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    success_probability DECIMAL(5,2),
    strategy_score DECIMAL(5,2),
    risk_reward_ratio DECIMAL(5,2),
    estimated_timeframe VARCHAR(50),
    approved_criteria JSONB,
    rejected_criteria JSONB,
    analysis_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on audit_results" ON audit_results FOR ALL USING (true) WITH CHECK (true);


-- --------------------------------------------------------
-- TABELAS DO ASSISTENTE DA ANÁLISE
-- --------------------------------------------------------

-- Sessão de chat vinculada a uma indicação específica (1:1 com analyzed_stocks)
-- Garante isolamento: cada indicação tem seu próprio contexto de conversa.
CREATE TABLE IF NOT EXISTS indication_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indication_id VARCHAR(100) NOT NULL REFERENCES analyzed_stocks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(indication_id)
);

ALTER TABLE indication_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on indication_chats"
    ON indication_chats FOR ALL USING (true) WITH CHECK (true);

-- Mensagens do chat vinculadas ao chat de uma indicação
-- role: 'user' | 'assistant' | 'system'
-- message_type: 'text' | 'reanalysis' | 'question_analysis'
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES indication_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type VARCHAR(30) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users on chat_messages"
    ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Índice para acelerar a busca de mensagens por chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_indication_chats_indication_id ON indication_chats(indication_id);
