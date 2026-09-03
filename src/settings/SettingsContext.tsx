import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, regionDefaults, type Region, type Settings } from './settings';
import { makeFormatter, type Formatter } from '../core/format';
import { fontStack, accentByMain } from '../ui/themePresets';

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

function load(initial?: DeepPartial<Settings>): Settings {
  // Host-supplied `settings` set the defaults; the user's saved choice (localStorage) wins,
  // so the region/theme/etc. the user picks in-app persists across reloads.
  const base = initial ? deepMerge(DEFAULT_SETTINGS, initial) : DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(NS);
    if (raw) return deepMerge(base, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return base;
}

function persist(s: Settings) {
  try {
    if (s.persistence.driver === 'localStorage') localStorage.setItem(NS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function SettingsProvider({
  children,
  settings: initial,
}: {
  children: ReactNode;
  /** Default settings (deep-partial). The user's in-app choices still persist and win. */
  settings?: DeepPartial<Settings>;
}) {
  const [settings, setSettings] = useState<Settings>(() => load(initial));

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

  // Design-token root. Every `--fc-*` token is defined on `[data-fincalc-root]`, so without this
  // wrapper a host app (calcsuite-react consumer) renders the UI with all tokens undefined —
  // transparent surfaces, no borders. `display: contents` keeps the wrapper layout-neutral while
  // still providing tokens: custom-property inheritance and `[data-fincalc-root] .x` descendant
  // selectors are DOM-based, so they cross it. Scoped here (not on <html>) so we don't clobber the
  // host's own `data-theme`. Dialogs render inside this subtree (no internal portal), so they inherit.
  const rootStyle = useMemo<CSSProperties>(
    () => ({
      display: 'contents',
      ['--fc-accent' as any]: settings.ui.accent,
      // Each preset ships its own readable text colour for on-accent surfaces (buttons, active nav,
      // FAB). Without this, on-accent text falls back to white and low-contrasts on light accents.
      ['--fc-accent-ink' as any]: accentByMain(settings.ui.accent)?.ink ?? '#ffffff',
      ['--fc-font-ui' as any]: fontStack(settings.ui.fontFamily),
    }),
    [settings.ui.accent, settings.ui.fontFamily],
  );

  return (
    <Ctx.Provider value={value}>
      <div
        data-fincalc-root=""
        data-theme={resolvedTheme === 'highContrast' ? 'dark' : resolvedTheme}
        data-density={settings.ui.density}
        style={rootStyle}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings must be used within SettingsProvider');
  return c;
}
