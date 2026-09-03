import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, regionDefaults, type Region, type Settings } from './settings';
import { makeFormatter, type Formatter } from '../core/format';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

interface SettingsCtx {
  settings: Settings;
  fmt: Formatter;
  update: (patch: DeepPartial<Settings>) => void;
  setRegion: (r: Region) => void;
  reset: () => void;
  replace: (s: Settings) => void;
  resolvedTheme: 'light' | 'dark' | 'highContrast';
}

const Ctx = createContext<SettingsCtx | null>(null);

const NS = 'calcsuite:settings';

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch == null) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k of Object.keys(patch)) {
    const pv = (patch as any)[k];
    const bv = (base as any)[k];
    out[k] = pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' ? deepMerge(bv, pv) : pv;
  }
  return out;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(NS);
    if (raw) return deepMerge(DEFAULT_SETTINGS, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function persist(s: Settings) {
  try {
    if (s.persistence.driver === 'localStorage') localStorage.setItem(NS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  const apply = useCallback((next: Settings) => {
    setSettings(next);
    persist(next);
  }, []);

  const update = useCallback((patch: DeepPartial<Settings>) => setSettings((s) => {
    const next = deepMerge(s, patch);
    persist(next);
    return next;
  }), []);

  const setRegion = useCallback((r: Region) => {
    // Region switch resets currency + number format + day-count to that region's defaults (§8.1),
    // preserving the user's UI/appearance choices.
    setSettings((s) => {
      const rd = regionDefaults(r);
      const next: Settings = { ...rd, ui: s.ui, compliance: s.compliance, persistence: s.persistence, features: s.features };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => apply(regionDefaults(settings.region)), [apply, settings.region]);
  const replace = useCallback((s: Settings) => apply(s), [apply]);

  const fmt = useMemo(() => makeFormatter(settings), [settings]);

  const resolvedTheme = useMemo<'light' | 'dark' | 'highContrast'>(() => {
    const t = settings.ui.theme;
    if (t === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return t;
  }, [settings.ui.theme]);

  const value = useMemo(
    () => ({ settings, fmt, update, setRegion, reset, replace, resolvedTheme }),
    [settings, fmt, update, setRegion, reset, replace, resolvedTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings must be used within SettingsProvider');
  return c;
}
