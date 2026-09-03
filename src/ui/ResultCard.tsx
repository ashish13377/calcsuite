import { useSettings } from '../settings/SettingsContext';
import type { Metric, ResultView } from '../core/kit';

const toneClass: Record<string, string> = {
  principal: 'pr-txt',
  interest: 'in-txt',
  accent: 'accent-txt',
  positive: 'pos-txt',
  negative: 'neg-txt',
  default: '',
};

export function ResultCard({ view }: { view: ResultView }) {
  const { settings } = useSettings();
  const sym = settings.currency.symbol;
  // Split the primary value into leading currency symbol (optically smaller) + digits.
  const pv = view.primary.value;
  const hasSym = pv.startsWith(sym);
  const digits = hasSym ? pv.slice(sym.length).trim() : pv;
  // Word/text results (e.g. number-to-words) shouldn't use the giant money-hero size.
  const isText = /[A-Za-z]{3,}/.test(pv);

  return (
    <div className="result" aria-live="polite">
      <div className="label">{view.primary.label}</div>
      <div className={`value num ${isText ? 'value-text' : ''} ${toneClass[view.primary.tone ?? 'default']}`}>
        {hasSym && <span className="cur">{sym}</span>}
        {digits}
        {view.primaryPer && <span className="per"> {view.primaryPer}</span>}
      </div>
      {view.primary.sub && <div className="per">{view.primary.sub}</div>}

      {view.split && view.split.length > 0 && <SplitBar split={view.split} />}

      {view.secondary && view.secondary.length > 0 && (
        <div className="secondary">
          {view.secondary.map((m, i) => (
            <MetricKV key={i} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricKV({ m }: { m: Metric }) {
  return (
    <div className="kv">
      <div className="k">{m.label}</div>
      <div className={`v num ${toneClass[m.tone ?? 'default']}`}>{m.value}</div>
      {m.sub && <div className="k">{m.sub}</div>}
    </div>
  );
}

function SplitBar({ split }: { split: NonNullable<ResultView['split']> }) {
  const total = split.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const pct = split.map((x) => Math.round((Math.max(0, x.value) / total) * 100));
  return (
    <>
      <div className="splitbar" role="img" aria-label={split.map((x, i) => `${x.label} ${pct[i]}%`).join(', ')}>
        {split.map((x, i) => (
          <div key={i} className={x.tone} style={{ width: `${pct[i]}%` }} />
        ))}
      </div>
      <div className="split-legend">
        {split.map((x, i) => (
          <span key={i}>
            <span className={`dot ${x.tone === 'principal' ? 'pr' : x.tone === 'interest' ? 'in' : 'ac'}`} />
            {x.label} {pct[i]}%
          </span>
        ))}
      </div>
    </>
  );
}
