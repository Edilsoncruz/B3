import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, CheckCircle2, XCircle, Loader2, Zap, Brain, ShieldCheck,
  Layers, Info, FileText, AlertTriangle
} from 'lucide-react';
import {
  getAIConfig, saveAIConfig, testProviderConnection, validateAPIKeys,
  getActiveModel, AIConfig, LunaTerraProvider, SolProvider
} from '../services/aiProvider';
import { loadGateParams, saveGateParams, GateParams } from '../services/gateBottomFishing';

interface TestStatus {
  openai?: 'idle' | 'testing' | 'ok' | 'error';
  deepseek?: 'idle' | 'testing' | 'ok' | 'error';
  kimi?: 'idle' | 'testing' | 'ok' | 'error';
}

interface TestError {
  openai?: string;
  deepseek?: string;
  kimi?: string;
}

export function ConfigTab() {
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [gateParams, setGateParams] = useState<GateParams>(loadGateParams());
  const [testStatus, setTestStatus] = useState<TestStatus>({});
  const [testErrors, setTestErrors] = useState<TestError>({});
  const [saved, setSaved] = useState(false);

  const envStatus = {
    openai:   !!import.meta.env.VITE_OPENAI_API_KEY,
    deepseek: !!import.meta.env.VITE_DEEPSEEK_API_KEY,
    kimi:     !!import.meta.env.VITE_KIMI_API_KEY,
  };

  useEffect(() => {
    // Limpa chaves antigas da implementação anterior (que guardava API keys no localStorage)
    localStorage.removeItem('ai_deepseek_api_key');
    localStorage.removeItem('ai_kimi_api_key');
    setConfig(getAIConfig());
  }, []);


  const handleSave = () => {
    saveAIConfig(config);
    saveGateParams(gateParams);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async (provider: 'openai' | 'deepseek' | 'kimi') => {
    setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
    setTestErrors(prev => ({ ...prev, [provider]: undefined }));
    const result = await testProviderConnection(provider);
    setTestStatus(prev => ({ ...prev, [provider]: result.ok ? 'ok' : 'error' }));
    if (!result.ok) setTestErrors(prev => ({ ...prev, [provider]: result.error }));
  };

  const { missing } = validateAPIKeys();
  const activeModels = {
    luna:  getActiveModel('luna'),
    terra: getActiveModel('terra'),
    sol:   getActiveModel('sol'),
  };

  return (
    <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Settings size={22} color="white" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>
            Configuração de Provedores de IA
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Escolha qual modelo será usado em cada etapa da análise
          </p>
        </div>
      </div>

      {/* Aviso de chave faltando */}
      {missing.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '24px'
        }}>
          <AlertTriangle size={16} color="#eab308" style={{ marginTop: '1px', flexShrink: 0 }} />
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#fde047' }}>
              Variáveis de ambiente não definidas
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#a3a300', lineHeight: '1.6' }}>
              Adicione as seguintes chaves ao <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '4px' }}>.env.local</code> e reinicie o servidor:
            </p>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {missing.map(k => (
                <code key={k} style={{
                  fontSize: '12px', padding: '2px 10px', borderRadius: '5px',
                  background: 'rgba(234,179,8,0.15)', color: '#fde047', border: '1px solid rgba(234,179,8,0.2)'
                }}>{k}</code>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modelos Ativos */}
      <div style={{
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '14px', padding: '18px 20px', marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Layers size={15} color="#818cf8" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Modelos Ativos
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'Luna (Triagem)', icon: <Zap size={14} />, model: activeModels.luna, color: '#f59e0b' },
            { label: 'Terra (Análise)', icon: <Brain size={14} />, model: activeModels.terra, color: '#10b981' },
            { label: 'Sol (Revisão)', icon: <ShieldCheck size={14} />, model: activeModels.sol, color: '#f97316' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(15,23,42,0.6)', borderRadius: '10px', padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.07)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: item.color, marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
                {item.icon} {item.label}
              </div>
              <code style={{ fontSize: '12px', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '5px' }}>
                {item.model}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Status das chaves no .env */}
      <div style={{
        background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <FileText size={16} color="#94a3b8" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>Status do .env.local</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { key: 'VITE_OPENAI_API_KEY',   label: 'OpenAI',   defined: envStatus.openai,   provider: 'openai' as const },
            { key: 'VITE_DEEPSEEK_API_KEY', label: 'DeepSeek', defined: envStatus.deepseek, provider: 'deepseek' as const },
            { key: 'VITE_KIMI_API_KEY',     label: 'Kimi',     defined: envStatus.kimi,     provider: 'kimi' as const },
          ].map(item => (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: '10px',
              background: item.defined ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border: `1px solid ${item.defined ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.defined
                  ? <CheckCircle2 size={15} color="#10b981" />
                  : <XCircle size={15} color="#ef4444" />
                }
                <div>
                  <code style={{ fontSize: '12px', color: item.defined ? '#6ee7b7' : '#fca5a5' }}>{item.key}</code>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                    {item.defined ? '✓ definida' : '✗ não definida'}
                  </span>
                </div>
              </div>
              {item.defined && (
                <button
                  onClick={() => handleTest(item.provider)}
                  disabled={testStatus[item.provider] === 'testing'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                    cursor: testStatus[item.provider] === 'testing' ? 'not-allowed' : 'pointer',
                    fontSize: '12px', fontWeight: 500
                  }}
                >
                  {testStatus[item.provider] === 'testing' && <Loader2 size={12} className="animate-spin" />}
                  {testStatus[item.provider] === 'ok'      && <CheckCircle2 size={12} color="#10b981" />}
                  {testStatus[item.provider] === 'error'   && <XCircle size={12} color="#ef4444" />}
                  {!testStatus[item.provider]              && null}
                  Testar
                </button>
              )}
            </div>
          ))}
        </div>
        {Object.entries(testErrors).map(([p, err]) => err ? (
          <p key={p} style={{ margin: '8px 0 0', fontSize: '12px', color: '#ef4444' }}>
            ✗ {p}: {err}
          </p>
        ) : null)}
      </div>

      {/* Seção: Luna + Terra */}
      <SectionCard title="Luna & Terra" subtitle="Triagem inteligente e análise profunda" icon={<Brain size={18} color="#f59e0b" />}>
        <ProviderSelector
          value={config.lunaTerraProvider}
          onChange={v => setConfig(prev => ({ ...prev, lunaTerraProvider: v as LunaTerraProvider }))}
          options={[
            { value: 'openai',   label: 'OpenAI',           sub: 'gpt-5.6-luna / gpt-5.6-terra', badge: 'Padrão',      envOk: envStatus.openai },
            { value: 'deepseek', label: 'DeepSeek V4 Flash', sub: 'deepseek-v4-flash',            badge: 'Alternativa', envOk: envStatus.deepseek },
          ]}
        />
      </SectionCard>

      {/* Seção: Sol */}
      <SectionCard title="Sol" subtitle="Revisão e validação (raciocínio pesado)" icon={<ShieldCheck size={18} color="#f97316" />}>
        <ProviderSelector
          value={config.solProvider}
          onChange={v => setConfig(prev => ({ ...prev, solProvider: v as SolProvider }))}
          options={[
            { value: 'openai', label: 'OpenAI',  sub: 'gpt-5.6-sol',                          badge: 'Padrão',      envOk: envStatus.openai },
            { value: 'kimi',   label: 'Kimi K3', sub: 'kimi-k3 · reasoning_effort=high',      badge: 'Alternativa', envOk: envStatus.kimi },
          ]}
        />
        {config.solProvider === 'kimi' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: '8px', padding: '10px 12px', marginTop: '14px'
          }}>
            <Info size={14} color="#f97316" style={{ marginTop: '1px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#fdba74', lineHeight: '1.5' }}>
              Kimi K3 usa <code>reasoning_effort=high</code> automaticamente — tokens de raciocínio são cobrados à parte.
            </span>
          </div>
        )}
      </SectionCard>

      {/* Seção: Gate Bottom Fishing */}
      <SectionCard title="Gate Bottom Fishing" subtitle="Parâmetros determinísticos (Filtro Pré-IA)" icon={<ShieldCheck size={18} color="#10b981" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Queda Mínima (%)</label>
            <input 
              type="number" 
              value={gateParams.GATE_DROP_PERCENT}
              onChange={e => setGateParams(prev => ({ ...prev, GATE_DROP_PERCENT: Number(e.target.value) }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Distância Mínima (%)</label>
            <input 
              type="number" 
              value={gateParams.GATE_MIN_DISTANCE}
              onChange={e => setGateParams(prev => ({ ...prev, GATE_MIN_DISTANCE: Number(e.target.value) }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Volume Min (R$)</label>
            <input 
              type="number" 
              value={gateParams.GATE_MIN_VOLUME}
              onChange={e => setGateParams(prev => ({ ...prev, GATE_MIN_VOLUME: Number(e.target.value) }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>ATR Min (%)</label>
            <input 
              type="number" 
              value={gateParams.GATE_MIN_ATR}
              onChange={e => setGateParams(prev => ({ ...prev, GATE_MIN_ATR: Number(e.target.value) }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

        </div>
      </SectionCard>

      {/* Botão Salvar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: saved ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontWeight: 600, fontSize: '14px', transition: 'background 0.3s'
          }}
        >
          <AnimatePresence mode="wait">
            {saved
              ? <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> Salvo!
                </motion.span>
              : <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={16} /> Salvar Preferências
                </motion.span>
            }
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Info */}
      <div style={{
        marginTop: '24px', display: 'flex', alignItems: 'flex-start', gap: '8px',
        background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: '10px', padding: '12px 14px'
      }}>
        <Info size={14} color="#64748b" style={{ marginTop: '1px', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
          As chaves de API ficam <strong style={{ color: '#94a3b8' }}>apenas no arquivo <code>.env.local</code></strong> e nunca são enviadas ao Supabase.
          Após editar o <code>.env.local</code>, reinicie o servidor (<code>npm run dev</code>) para que as novas chaves sejam carregadas.
          A preferência de provedor (qual modelo usar) é salva no navegador.
        </span>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '22px', marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px',
          background: 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProviderSelector({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub: string; badge: string; envOk: boolean }[];
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <motion.div
            key={opt.value}
            onClick={() => onChange(opt.value)}
            whileHover={{ scale: 1.01 }}
            style={{
              flex: 1, minWidth: '200px', cursor: 'pointer', padding: '14px 16px',
              borderRadius: '12px', border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
              background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
              opacity: !opt.envOk && !selected ? 0.55 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: `2px solid ${selected ? '#6366f1' : '#475569'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: selected ? '#c7d2fe' : '#94a3b8' }}>
                    {opt.label}
                  </span>
                </div>
                <code style={{ fontSize: '11px', color: '#64748b' }}>{opt.sub}</code>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                  background: selected ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                  color: selected ? '#a5b4fc' : '#64748b'
                }}>
                  {opt.badge}
                </span>
                {opt.envOk
                  ? <CheckCircle2 size={13} color="#10b981" />
                  : <XCircle size={13} color="#64748b" />
                }
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
