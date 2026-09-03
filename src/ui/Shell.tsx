import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { calculatorsForRegion, calculatorById, GROUPS } from '../core/registry';
import type { CalculatorDef, ResultView, Values } from '../core/kit';
import { CalculatorPanel } from './CalculatorPanel';
import { LoanEmiPanel } from './LoanEmiPanel';
import { SciCalculator } from './SciCalculator';
import { CurrencyConverter } from './CurrencyConverter';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { CommandPalette, type PaletteAction } from './CommandPalette';
import { GearIcon, SunIcon, MoonIcon, HistoryIcon, CalcIcon } from './icons';
import { IntegrationPanel } from './IntegrationPanel';
import { ExportMenu } from './ExportMenu';
import { useHistory, type HistoryItem } from './history';
import { SaveButton } from './SaveButton';

const customRegistry = { 'loan.emi': LoanEmiPanel, scientific: SciCalculator, currency: CurrencyConverter };

type View = 'calc' | 'settings' | 'history' | 'integration';

export function Shell({ onClose }: { onClose?: () => void }) {
  const { settings, setRegion, update, resolvedTheme } = useSettings();
  const region = settings.region;
  const calcs = useMemo(() => calculatorsForRegion(region), [region]);

  const [activeId, setActiveId] = useState('loan.emi');
  const [view, setView] = useState<View>('calc');
  const [seed, setSeed] = useState<Values | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { items, clear } = useHistory();

  // Deep link: ?fincalc=<id>&s=<base64 values>
  useEffect(() => {
    const parse = () => {
      const p = new URLSearchParams(location.hash.replace(/^#/, '') || location.search);
      const id = p.get('fincalc');
      if (id && calculatorById(id)) {
        setActiveId(id);
        setView('calc');
        const s = p.get('s');
        if (s) {
          try {
            setSeed(JSON.parse(atob(s)));
          } catch {
            /* ignore */
          }
        }
      }
    };
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, []);

  // ⌘K / Ctrl+K opens the palette. Handled inside the React tree (not on window) so it is
  // scoped to this shell instance and survives the dialog's keyboard isolation.
  const onShellKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setPaletteOpen(true);
    }
  };

  const pick = (id: string) => {
    setActiveId(id);
    setView('calc');
    setSeed(undefined);
    setPaletteOpen(false);
  };

  const def = calculatorById(activeId) ?? calcs[0]!;

  const actions: PaletteAction[] = [
    { id: 'settings', label: 'Open settings', run: () => { setView('settings'); setPaletteOpen(false); } },
    { id: 'history', label: 'Open history', run: () => { setView('history'); setPaletteOpen(false); } },
    { id: 'region', label: `Switch to ${region === 'IN' ? 'United States' : 'India'}`, run: () => { setRegion(region === 'IN' ? 'US' : 'IN'); setPaletteOpen(false); } },
    { id: 'theme', label: 'Toggle dark mode', run: () => { update({ ui: { theme: resolvedTheme === 'dark' ? 'light' : 'dark' } }); setPaletteOpen(false); } },
  ];
  if (settings.features.integrationPanel)
    actions.push({ id: 'integration', label: 'Open integration panel', run: () => { setView('integration'); setPaletteOpen(false); } });

  const restore = (it: HistoryItem) => {
    setActiveId(it.id);
    setSeed(it.values);
    setView('calc');
  };

  return (
    <div className="fc-shell" onKeyDown={onShellKey}>
      <header className="fc-topbar">
        <div className="brand fc-brand">
          <span className="fc-brand-mark" aria-hidden="true"><CalcIcon size={22} /></span>
          <div className="fc-brand-text">
            <strong>CalcSuite</strong>
            <a className="fc-brand-sub" href="https://acecbm.com" target="_blank" rel="noopener noreferrer">
              an AceCBM product ↗
            </a>
          </div>
        </div>
        <div className="fc-top-actions">
          <button className="icon-btn" onClick={() => setPaletteOpen(true)} aria-label="Search">⌘K Search</button>
          <div className="seg" role="group" aria-label="Region">
            <button aria-pressed={region === 'IN'} onClick={() => setRegion('IN')}>🇮🇳</button>
            <button aria-pressed={region === 'US'} onClick={() => setRegion('US')}>🇺🇸</button>
          </div>
          <button className="icon-btn icon-only" onClick={() => update({ ui: { theme: resolvedTheme === 'dark' ? 'light' : 'dark' } })} aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="icon-btn" aria-label="History" onClick={() => setView('history')}>
            <HistoryIcon /> History
          </button>
          <button className="icon-btn icon-only" aria-label="Settings" onClick={() => setView('settings')}>
            <GearIcon />
          </button>
          {onClose && <button className="icon-btn icon-only" aria-label="Close" onClick={onClose}>✕</button>}
        </div>
      </header>

      <div className="fc-body">
        <nav className="fc-rail" aria-label="Calculators">
          {GROUPS.map((g) => {
            const inGroup = calcs.filter((c) => c.group === g.id);
            if (inGroup.length === 0) return null;
            return (
              <div key={g.id} className="rail-group">
                <div className="rail-group-label">{g.label}</div>
                {inGroup.map((c) => (
                  <button
                    key={c.id}
                    className={`rail-item ${activeId === c.id && view === 'calc' ? 'active' : ''}`}
                    onClick={() => pick(c.id)}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <main className="fc-main">
          <div className="fc-anim-in" key={view === 'calc' ? `calc:${def.id}` : view}>
          {view === 'settings' && <SettingsPanel />}
          {view === 'history' && <HistoryPanel items={items} onRestore={restore} onClear={clear} />}
          {view === 'integration' && <IntegrationPanel />}
          {view === 'calc' && (
            <CalculatorPanel
              def={def}
              seed={seed}
              customRegistry={customRegistry}
              actions={(result, values) =>
                result ? (
                  <>
                    <SaveButton
                      item={{ id: def.id, title: `${def.title} — ${result.primary.value}`, primary: result.primary.value, values }}
                    />
                    <ExportMenu
                      payload={{
                        calculatorId: def.id,
                        title: def.title,
                        result,
                        values,
                        settingsSnapshot: settings,
                        meta: { computedAt: new Date().toISOString(), region, currency: settings.currency.code },
                      }}
                    />
                  </>
                ) : null
              }
            />
          )}
          </div>
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette calculators={calcs} actions={actions} onPick={pick} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}

export type { CalculatorDef };
