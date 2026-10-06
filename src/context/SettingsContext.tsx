import { createContext, useContext, useState, ReactNode } from 'react';

export interface AppSettings {
  recommendationCount: number;
  maxPrice: number | '';
  forceEqualInclusion: boolean;
  isBacktestMode: boolean;
  backtestDate: string;
  isSimulationEnabled: boolean;
  investmentAmount: number;
  isAuditMode: boolean;
  deepAnalysis: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  recommendationCount: 5,
  maxPrice: '',
  forceEqualInclusion: true,
  isBacktestMode: false,
  backtestDate: '2024-06-01',
  isSimulationEnabled: false,
  investmentAmount: 500,
  isAuditMode: false,
  deepAnalysis: false,
};

const STORAGE_KEY = 'smartmoney_app_settings_v1';

interface SettingsContextValue {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(load);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSettings({ ...DEFAULT_APP_SETTINGS });
  };

  return (
    <SettingsContext.Provider value={{ settings, set, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve ser usado dentro de <SettingsProvider>');
  return ctx;
}
