import { useState } from 'react';
import type { FieldSchema, Values, FieldValue } from '../core/kit';
import { useSettings } from '../settings/SettingsContext';
import type { Region } from '../settings/settings';

// Renders one FieldSchema to a controlled input. The generic form is built from these.

export function labelFor(f: FieldSchema, region: Region): string {
  return f.labelByRegion?.[region] ?? f.label;
}

export function Field({
  f,
  value,
  onChange,
  values,
}: {
  f: FieldSchema;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
  values: Values;
}) {
  const { settings } = useSettings();
  const region = settings.region;
  const label = labelFor(f, region);
  const curSym = settings.currency.symbol;

  const str = value == null ? '' : String(value);

  switch (f.kind) {
    case 'money':
    case 'number':
    case 'percent':
    case 'int':
      return (
        <label className="field">
          <span className="lbl">
            {label}
            {f.help && <span className="help" title={f.help}> ⓘ</span>}
          </span>
          <div className="input-wrap">
            {(f.prefix === 'currency' || f.kind === 'money') && <span className="affix">{curSym}</span>}
            {f.prefix && f.prefix !== 'currency' && <span className="affix">{f.prefix}</span>}
            <input
              className="num"
              inputMode={f.kind === 'int' ? 'numeric' : 'decimal'}
              value={str}
              placeholder={f.optional ? 'optional' : ''}
              onChange={(e) => onChange(e.target.value)}
              aria-label={label}
            />
            {f.suffix && <span className="affix">{f.suffix}</span>}
            {f.kind === 'percent' && !f.suffix && <span className="affix">%</span>}
          </div>
        </label>
      );

    case 'years':
      return (
        <label className="field">
          <span className="lbl">{label}</span>
          <div className="input-wrap">
            <input className="num" inputMode="numeric" value={str} onChange={(e) => onChange(e.target.value)} aria-label={label} />
            <span className="affix">yr</span>
          </div>
        </label>
      );

    case 'tenure':
      return <TenureField f={f} label={label} months={Number(value) || 0} onChange={onChange} />;

    case 'select':
      return (
        <label className="field">
          <span className="lbl">{label}</span>
          <div className="input-wrap">
            <select value={str} onChange={(e) => onChange(e.target.value)} aria-label={label}>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      );

    case 'segmented':
      return (
        <div className="field">
          <span className="lbl">{label}</span>
          <div className="seg" role="group" aria-label={label}>
            {f.options?.map((o) => (
              <button key={o.value} type="button" aria-pressed={str === o.value} onClick={() => onChange(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <label className="field toggle-field">
          <span className="lbl">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            className={`toggle ${value ? 'on' : ''}`}
            onClick={() => onChange(!value)}
            aria-label={label}
          >
            <span className="knob" />
          </button>
        </label>
      );

    case 'date':
      return (
        <label className="field">
          <span className="lbl">{label}</span>
          <div className="input-wrap">
            <input type="date" value={str} onChange={(e) => onChange(e.target.value)} aria-label={label} />
          </div>
        </label>
      );

    case 'text':
      return (
        <label className="field">
          <span className="lbl">{label}</span>
          <div className="input-wrap">
            <input value={str} placeholder={f.help} onChange={(e) => onChange(e.target.value)} aria-label={label} />
          </div>
        </label>
      );

    case 'cashflows':
      return <CashflowsField f={f} label={label} value={(value as any) ?? []} onChange={onChange} />;

    default:
      return null;
  }
}

function TenureField({
  f,
  label,
  months,
  onChange,
}: {
  f: FieldSchema;
  label: string;
  months: number;
  onChange: (v: FieldValue) => void;
}) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const set = (yy: number, mm: number) => onChange(yy * 12 + mm);
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="tenure-pair">
        <div className="input-wrap">
          <input
            className="num"
            inputMode="numeric"
            value={String(y)}
            onChange={(e) => set(parseInt(e.target.value || '0', 10) || 0, m)}
            aria-label={`${label} years`}
          />
          <span className="affix">yr</span>
        </div>
        <div className="input-wrap">
          <input
            className="num"
            inputMode="numeric"
            value={String(m)}
            onChange={(e) => set(y, parseInt(e.target.value || '0', 10) || 0)}
            aria-label={`${label} months`}
          />
          <span className="affix">mo</span>
        </div>
      </div>
      {f.suffix && <div className="solved-note">{f.suffix}</div>}
    </div>
  );
}

function CashflowsField({
  label,
  value,
  onChange,
}: {
  f: FieldSchema;
  label: string;
  value: Array<{ date: string; amount: string }>;
  onChange: (v: FieldValue) => void;
}) {
  const [rows, setRows] = useState<Array<{ date: string; amount: string }>>(
    value.length ? value : [{ date: '', amount: '' }],
  );
  const push = (next: Array<{ date: string; amount: string }>) => {
    setRows(next);
    onChange(next);
  };
  return (
    <div className="field cashflows">
      <span className="lbl">{label} — negative = invested, positive = received</span>
      {rows.map((r, i) => (
        <div className="tenure-pair" key={i} style={{ marginBottom: 6 }}>
          <div className="input-wrap">
            <input type="date" value={r.date} onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label="date" />
          </div>
          <div className="input-wrap">
            <input className="num" inputMode="decimal" value={r.amount} placeholder="amount" onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} aria-label="amount" />
          </div>
          <button type="button" className="icon-btn" onClick={() => push(rows.filter((_, j) => j !== i))} aria-label="remove row">
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="icon-btn" onClick={() => push([...rows, { date: '', amount: '' }])}>
        + Add cashflow
      </button>
    </div>
  );
}
