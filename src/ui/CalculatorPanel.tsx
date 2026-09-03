import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { D } from '../core/decimal';
import type { CalcCtx, CalculatorDef, FieldSchema, ResultView, Values, FieldValue } from '../core/kit';
import { useSettings } from '../settings/SettingsContext';
import { calculatorById } from '../core/registry';
import { Field, labelFor } from './fields';
import { ResultCard } from './ResultCard';
import { ScheduleTable } from './ScheduleTable';
import { Chart } from './Chart';
import { LoanEmiPanel } from './LoanEmiPanel';
import { SciCalculator } from './SciCalculator';
import { CurrencyConverter } from './CurrencyConverter';

const EMPTY_DEF: CalculatorDef = {
  id: '',
  group: 'tools',
  title: '',
  inputs: [],
  compute: () => ({ primary: { label: '', value: '' } }),
};

// Built-in bespoke panels, resolved by a def's `custom` key.
const BUILTIN_CUSTOM: Record<string, ComponentType<{ def: CalculatorDef }>> = {
  'loan.emi': LoanEmiPanel,
  scientific: SciCalculator,
  currency: CurrencyConverter,
};

function initialValues(def: CalculatorDef, seed?: Values): Values {
  const v: Values = {};
  for (const f of def.inputs) if (f.default !== undefined) v[f.key] = f.default;
  return seed ? { ...v, ...seed } : v;
}

export function CalculatorPanel({
  def: defProp,
  id,
  seed,
  customRegistry,
  onResult,
  actions,
}: {
  /** A calculator definition, or use `id` to resolve a registered one. */
  def?: CalculatorDef;
  /** Registered calculator id, e.g. "loan.emi", "invest.sip". Resolved via the registry. */
  id?: string;
  seed?: Values;
  customRegistry?: Record<string, ComponentType<{ def: CalculatorDef }>>;
  onResult?: (r: ResultView | null, values: Values) => void;
  actions?: (r: ResultView | null, values: Values) => React.ReactNode;
}) {
  const resolved = defProp ?? (id ? calculatorById(id) : undefined);
  const def = resolved ?? EMPTY_DEF;
  const customComponents: Record<string, ComponentType<{ def: CalculatorDef }>> = { ...BUILTIN_CUSTOM, ...customRegistry };
  const { settings, fmt } = useSettings();
  const [values, setValues] = useState<Values>(() => initialValues(def, seed));
  const [tab, setTab] = useState<'schedule' | 'chart' | 'formula' | 'assumptions'>('schedule');
  const [advOpen, setAdvOpen] = useState(false);

  // Re-seed when the calculator (or restored seed) changes.
  useEffect(() => setValues(initialValues(def, seed)), [def.id, seed]);

  const region = settings.region;
  const set = (key: string, val: FieldValue) => setValues((s) => ({ ...s, [key]: val }));

  const visible = def.inputs.filter((f) => (f.showIf ? f.showIf(values, region) : true));
  const basic = visible.filter((f) => !f.advanced);
  const advanced = visible.filter((f) => f.advanced);

  const { result, error } = useMemo(() => {
    const ctx: CalcCtx = { settings, region, fmt, D };
    try {
      return { result: def.compute(values, ctx), error: null as string | null };
    } catch (e) {
      return { result: null as ResultView | null, error: e instanceof Error ? e.message : 'Could not calculate.' };
    }
  }, [def, values, settings, region, fmt]);

  useEffect(() => onResult?.(result, values), [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resolved) {
    return (
      <div className="error" role="alert">
        Unknown calculator{id ? `: ${id}` : ''}.
      </div>
    );
  }

  // Custom bespoke panel (EMI, scientific, currency, or a host-supplied one).
  if (def.custom && customComponents[def.custom]) {
    const Custom = customComponents[def.custom]!;
    return (
      <div data-part="calculator" data-calculator={def.id}>
        <PanelHead def={def} region={region} />
        <Custom def={def} />
      </div>
    );
  }

  const hasTabs = Boolean(result && (result.schedule || result.chart || result.formula || result.notes?.length));

  return (
    <div data-part="calculator" data-calculator={def.id}>
      <PanelHead def={def} region={region} />

      <section className="card">
        <div className="grid two">
          {basic.map((f) => (
            <FieldSlot key={f.key} f={f} values={values} set={set} />
          ))}
        </div>

        {advanced.length > 0 && (
          <div className={`accordion ${advOpen ? 'open' : ''}`}>
            <button type="button" className="accordion-head" aria-expanded={advOpen} onClick={() => setAdvOpen((o) => !o)}>
              <span className="caret">{advOpen ? '▾' : '▸'}</span> Advanced options
            </button>
            {advOpen && (
              <div className="grid two" style={{ marginTop: 12 }}>
                {advanced.map((f) => (
                  <FieldSlot key={f.key} f={f} values={values} set={set} />
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
      </section>

      {result && !error && (
        <section className="card">
          <ResultCard view={result} />

          {result.warnings?.map((w, i) => (
            <div key={i} className="notice">
              {w}
            </div>
          ))}

          {actions && <div className="actions-row">{actions(result, values)}</div>}

          {hasTabs && (
            <>
              <div className="tabs" role="tablist" style={{ marginTop: 20 }}>
                {result.schedule && (
                  <button role="tab" aria-selected={tab === 'schedule'} onClick={() => setTab('schedule')}>
                    Schedule
                  </button>
                )}
                {result.chart && (
                  <button role="tab" aria-selected={tab === 'chart'} onClick={() => setTab('chart')}>
                    Chart
                  </button>
                )}
                {result.formula && (
                  <button role="tab" aria-selected={tab === 'formula'} onClick={() => setTab('formula')}>
                    Formula
                  </button>
                )}
                {(result.notes?.length ?? 0) > 0 && settings.ui.showAssumptions && (
                  <button role="tab" aria-selected={tab === 'assumptions'} onClick={() => setTab('assumptions')}>
                    Assumptions
                  </button>
                )}
              </div>

              <div className="tab-anim" key={tab}>
                {tab === 'schedule' && result.schedule && <ScheduleTable schedule={result.schedule} />}
                {tab === 'chart' && result.chart && <Chart chart={result.chart} />}
                {tab === 'formula' && result.formula && settings.ui.showFormulas && (
                  <div className="formula">
                    <code>{result.formula}</code>
                    {result.formulaSubstituted && <code style={{ marginTop: 8 }}>{result.formulaSubstituted}</code>}
                  </div>
                )}
                {tab === 'assumptions' && (
                  <div className="assumptions">
                    {result.notes?.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {settings.compliance.showDisclaimer && (
            <p className="disclaimer">
              {settings.compliance.disclaimerText ??
                'Indicative figures for planning only. Your lender’s or provider’s calculation may differ due to rounding, day-count conventions, fees, and taxes. This is not financial advice.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function PanelHead({ def, region }: { def: CalculatorDef; region: 'IN' | 'US' }) {
  void region;
  return (
    <div className="panel-head">
      <h2>{def.title}</h2>
      {def.blurb && <p>{def.blurb}</p>}
    </div>
  );
}

function FieldSlot({ f, values, set }: { f: FieldSchema; values: Values; set: (k: string, v: FieldValue) => void }) {
  void labelFor; // used inside Field
  const span = f.kind === 'cashflows' || f.kind === 'segmented' ? 'span2' : '';
  return (
    <div className={span}>
      <Field f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} values={values} />
    </div>
  );
}
