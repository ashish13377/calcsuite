import { Fragment, useMemo, useState } from 'react';
import { solve, REGIONS, FinCalcError, type SolveTarget, type Basis, type LoanResult } from '../core/loan';
import { useSettings } from '../settings/SettingsContext';
import { tenureText } from '../core/format';
import { ExportMenu } from './ExportMenu';
import { SaveButton } from './SaveButton';
import type { ResultView, ScheduleView, Values } from '../core/kit';

// loan.emi — the flagship calculator: solve for any of payment/amount/rate/tenure,
// full amortisation (tenure) table year-grouped & expandable to months, plus a chart.
// Registered with custom:'loan.emi'.

const SOLVE_LABELS: Record<SolveTarget, string> = { payment: 'Payment', principal: 'Amount', rate: 'Rate', tenure: 'Term' };

export function LoanEmiPanel() {
  const { settings, fmt } = useSettings();
  const region = settings.region;
  const profile = REGIONS[region];

  const [solveFor, setSolveFor] = useState<SolveTarget>('payment');
  const [basis, setBasis] = useState<Basis>(profile.defaultBasis);
  const [amount, setAmount] = useState(region === 'IN' ? '2500000' : '300000');
  const [rate, setRate] = useState(profile.defaultRatePct);
  const [years, setYears] = useState(String(Math.floor(profile.defaultTermMonths / 12)));
  const [months, setMonths] = useState(String(profile.defaultTermMonths % 12));
  const [payment, setPayment] = useState(region === 'IN' ? '21934' : '1896');
  const [tab, setTab] = useState<'schedule' | 'chart' | 'formula'>('schedule');

  const solveOptions: SolveTarget[] = basis === 'flat' ? ['payment', 'principal'] : ['payment', 'principal', 'rate', 'tenure'];
  const tenureMonths = (parseInt(years || '0', 10) || 0) * 12 + (parseInt(months || '0', 10) || 0);
  const clean = (s: string) => s.replace(/[, ]/g, '').trim();

  const { result, error } = useMemo(() => {
    try {
      const r = solve({
        region,
        basis,
        principal: solveFor === 'principal' ? undefined : clean(amount) || undefined,
        annualRatePct: solveFor === 'rate' ? undefined : clean(rate) || undefined,
        tenureMonths: solveFor === 'tenure' ? undefined : tenureMonths || undefined,
        payment: solveFor === 'payment' ? undefined : clean(payment) || undefined,
      });
      return { result: r, error: null as string | null };
    } catch (e) {
      return { result: null as LoanResult | null, error: e instanceof FinCalcError ? e.message : 'Could not calculate.' };
    }
  }, [region, basis, solveFor, amount, rate, years, months, payment, tenureMonths]);

  const isSolved = (t: SolveTarget) => solveFor === t;
  const solvedDisplay: Record<SolveTarget, string> = {
    payment: result ? fmt.money(result.payment) : '—',
    principal: result ? fmt.money(result.principal) : '—',
    rate: result ? `${fmt.num(result.annualRatePct, 3)} %` : '—',
    tenure: result ? tenureText(result.tenureMonths) : '—',
  };
  const hero = result ? fmt.moneyParts(result.payment) : { symbol: '', digits: '—' };
  const cur = settings.currency.symbol;

  const loanValues: Values = {
    region,
    basis,
    principal: clean(amount),
    annualRatePct: clean(rate),
    tenureMonths: String(tenureMonths),
    payment: clean(payment),
    solveFor,
  };

  // Map the rich LoanResult to a ResultView so the shared export adapters (CSV/PDF/XLSX/
  // JSON/print/…) can serialise it, including the full amortisation schedule.
  const buildView = (r: LoanResult): ResultView => {
    const schedule: ScheduleView = {
      columns: ['Period', 'Opening', 'Payment', 'Principal', 'Interest', 'Balance'],
      groups: r.byYear.map((y) => ({
        label: `Year ${y.year}`,
        summary: [
          fmt.money(y.months[0]!.openingBalance),
          fmt.money(y.payment),
          fmt.money(y.principal),
          fmt.money(y.interest),
          fmt.money(y.closingBalance),
        ],
        rows: y.months.map((m) => ({
          label: `Month ${m.month}`,
          cells: [
            fmt.money(m.openingBalance),
            fmt.money(m.payment),
            fmt.money(m.principal),
            fmt.money(m.interest),
            fmt.money(m.closingBalance),
          ],
        })),
      })),
      toneCols: { 3: 'principal', 4: 'interest' },
    };
    return {
      primary: { label: profile.paymentLabel, value: fmt.money(r.payment) },
      primaryPer: '/month',
      secondary: [
        { label: 'Principal', value: fmt.money(r.principal) },
        { label: 'Total interest', value: fmt.money(r.totalInterest), tone: 'interest' },
        { label: 'Total payment', value: fmt.money(r.totalPayment) },
        { label: profile.tenureWord, value: tenureText(r.tenureMonths) },
      ],
      schedule,
      formula: r.formula,
      raw: {
        payment: r.payment.toString(),
        principal: r.principal.toString(),
        totalInterest: r.totalInterest.toString(),
        totalPayment: r.totalPayment.toString(),
        tenureMonths: r.tenureMonths,
      },
    };
  };

  return (
    <div data-part="calculator" data-calculator="loan.emi">
      <section className="card">
        <div className="solve-row">
          <span className="lbl">Solve for</span>
          <div className="seg" role="group" aria-label="Solve for">
            {solveOptions.map((t) => (
              <button key={t} aria-pressed={solveFor === t} onClick={() => setSolveFor(t)}>
                {SOLVE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 'calc(var(--fc-space) * 2)' }}>
          <span className="lbl">Interest basis</span>
          <div className="seg" role="group" aria-label="Interest basis">
            <button aria-pressed={basis === 'reducing_monthly'} onClick={() => setBasis('reducing_monthly')}>
              Reducing balance
            </button>
            <button
              aria-pressed={basis === 'flat'}
              onClick={() => {
                setBasis('flat');
                if (solveFor === 'rate' || solveFor === 'tenure') setSolveFor('payment');
              }}
            >
              Flat rate
            </button>
          </div>
        </div>

        <div className="grid two">
          <SolvableField label="Loan amount" solved={isSolved('principal')} solvedText={solvedDisplay.principal} affix={cur}>
            <input className="num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Loan amount" />
          </SolvableField>

          <SolvableField label="Interest rate" solved={isSolved('rate')} solvedText={solvedDisplay.rate} suffix="% p.a.">
            <input className="num" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Interest rate" />
          </SolvableField>

          <div className="field">
            <span className="lbl">{profile.tenureWord}</span>
            {isSolved('tenure') ? (
              <>
                <div className="input-wrap solved">
                  <input readOnly className="num" value={solvedDisplay.tenure} aria-label="Term (solved)" />
                </div>
                <div className="solved-note">solved</div>
              </>
            ) : (
              <div className="tenure-pair">
                <div className="input-wrap">
                  <input className="num" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} aria-label="Years" />
                  <span className="affix">yr</span>
                </div>
                <div className="input-wrap">
                  <input className="num" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} aria-label="Months" />
                  <span className="affix">mo</span>
                </div>
              </div>
            )}
          </div>

          <SolvableField label={profile.paymentLabel} solved={isSolved('payment')} solvedText={solvedDisplay.payment} affix={cur}>
            <input className="num" inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} aria-label={profile.paymentLabel} />
          </SolvableField>
        </div>

        {error && (
          <div className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
      </section>

      {result && !error && (
        <>
          <section className="card">
            <div className="result" aria-live="polite">
              <div className="label">
                {profile.paymentLabel}
                {basis === 'flat' ? ' · flat rate' : ''}
              </div>
              <div className="value num">
                <span className="cur">{hero.symbol}</span>
                {hero.digits}
                <span className="per"> /month</span>
              </div>
            </div>

            <SplitBar result={result} />

            <div className="secondary">
              <div className="kv"><div className="k">Principal</div><div className="v num">{fmt.money(result.principal)}</div></div>
              <div className="kv"><div className="k">Total interest</div><div className="v num in-txt">{fmt.money(result.totalInterest)}</div></div>
              <div className="kv"><div className="k">Total payment</div><div className="v num">{fmt.money(result.totalPayment)}</div></div>
              <div className="kv"><div className="k">{profile.tenureWord}</div><div className="v num">{tenureText(result.tenureMonths)}</div></div>
            </div>

            <div className="actions-row">
              <SaveButton
                item={{ id: 'loan.emi', title: `Loan — ${fmt.money(result.payment)}/mo`, primary: fmt.money(result.payment), values: loanValues }}
              />
              <ExportMenu
                payload={{
                  calculatorId: 'loan.emi',
                  title: `${profile.paymentLabel} / Loan`,
                  result: buildView(result),
                  values: loanValues,
                  settingsSnapshot: settings,
                  meta: { computedAt: new Date().toISOString(), region, currency: settings.currency.code },
                }}
              />
            </div>

            {result.equivalentReducingRatePct && (
              <div className="notice">
                A flat rate of {fmt.num(result.annualRatePct, 2)}% is roughly a{' '}
                <strong>{fmt.num(result.equivalentReducingRatePct, 2)}% reducing-balance rate</strong> — the loan’s true cost. Compare on this figure.
              </div>
            )}
          </section>

          <section className="card">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'schedule'} onClick={() => setTab('schedule')}>Schedule</button>
              <button role="tab" aria-selected={tab === 'chart'} onClick={() => setTab('chart')}>Chart</button>
              {settings.ui.showFormulas && (
                <button role="tab" aria-selected={tab === 'formula'} onClick={() => setTab('formula')}>Formula</button>
              )}
            </div>

            <div className="tab-anim" key={tab}>
              {tab === 'schedule' && <AmortTable result={result} />}
              {tab === 'chart' && <LoanChart result={result} />}
              {tab === 'formula' && settings.ui.showFormulas && (
                <div className="formula">
                  <code>{result.formula}</code>
                  <div className="assumptions">
                    <div>r = {fmt.num(result.annualRatePct, 4)}% ÷ 12,&nbsp; n = {result.tenureMonths} months,&nbsp; P = {fmt.money(result.principal)}</div>
                    <div>Basis: {result.basis === 'flat' ? 'flat' : 'reducing balance'}. Final instalment absorbs rounding drift.</div>
                  </div>
                </div>
              )}
            </div>

            {settings.compliance.showDisclaimer && (
              <p className="disclaimer">
                {settings.compliance.disclaimerText ??
                  'Indicative figures for planning only. Your lender’s calculation may differ due to rounding, day-count conventions, fees, and taxes. This is not financial advice.'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SolvableField({
  label,
  solved,
  solvedText,
  affix,
  suffix,
  children,
}: {
  label: string;
  solved: boolean;
  solvedText: string;
  affix?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      {solved ? (
        <>
          <div className="input-wrap solved">
            <input readOnly className="num" value={solvedText} aria-label={`${label} (solved)`} />
          </div>
          <div className="solved-note">solved</div>
        </>
      ) : (
        <div className="input-wrap">
          {affix && <span className="affix">{affix}</span>}
          {children}
          {suffix && <span className="affix">{suffix}</span>}
        </div>
      )}
    </label>
  );
}

function SplitBar({ result }: { result: LoanResult }) {
  const { fmt } = useSettings();
  const p = Number(result.principal.toFixed(2));
  const i = Number(result.totalInterest.toFixed(2));
  const total = p + i || 1;
  const pPct = Math.round((p / total) * 100);
  return (
    <>
      <div className="splitbar" role="img" aria-label={`Principal ${pPct}%, interest ${100 - pPct}%`}>
        <div className="pr" style={{ width: `${pPct}%` }} />
        <div className="in" style={{ width: `${100 - pPct}%` }} />
      </div>
      <div className="split-legend">
        <span><span className="dot pr" />Principal {pPct}% · {fmt.money(result.principal)}</span>
        <span><span className="dot in" />Interest {100 - pPct}% · {fmt.money(result.totalInterest)}</span>
      </div>
    </>
  );
}

function AmortTable({ result }: { result: LoanResult }) {
  const { fmt } = useSettings();
  const [view, setView] = useState<'yearly' | 'monthly'>('yearly');
  const [open, setOpen] = useState<Set<number>>(new Set([1]));
  const toggle = (y: number) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(y) ? n.delete(y) : n.add(y);
      return n;
    });
  const m = fmt.money;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div className="seg" role="group" aria-label="Schedule view">
          <button aria-pressed={view === 'yearly'} onClick={() => setView('yearly')}>Yearly</button>
          <button aria-pressed={view === 'monthly'} onClick={() => setView('monthly')}>Monthly</button>
        </div>
      </div>
      <div className="sched-wrap">
        <table className="sched">
          <caption>Amortisation schedule — {result.tenureMonths} months. Tap a year to expand its months.</caption>
          <thead>
            <tr>
              <th scope="col">{view === 'yearly' ? 'Year' : 'Month'}</th>
              <th scope="col">Opening</th>
              <th scope="col">Payment</th>
              <th scope="col">Principal</th>
              <th scope="col">Interest</th>
              <th scope="col">Balance</th>
            </tr>
          </thead>
          <tbody>
            {view === 'monthly'
              ? result.schedule.map((row) => (
                  <tr key={row.month} className="month-row">
                    <th scope="row" style={{ fontWeight: 400 }}>{row.month}</th>
                    <td>{m(row.openingBalance)}</td>
                    <td>{m(row.payment)}</td>
                    <td className="pr-txt">{m(row.principal)}</td>
                    <td className="in-txt">{m(row.interest)}</td>
                    <td>{m(row.closingBalance)}</td>
                  </tr>
                ))
              : result.byYear.map((y) => {
                  const isOpen = open.has(y.year);
                  return (
                    <Fragment key={y.year}>
                      <tr className="year-row" onClick={() => toggle(y.year)} aria-expanded={isOpen}>
                        <th scope="row"><span className="caret">{isOpen ? '▾' : '▸'}</span> Year {y.year}</th>
                        <td>{m(y.months[0]!.openingBalance)}</td>
                        <td>{m(y.payment)}</td>
                        <td className="pr-txt">{m(y.principal)}</td>
                        <td className="in-txt">{m(y.interest)}</td>
                        <td>{m(y.closingBalance)}</td>
                      </tr>
                      {isOpen &&
                        y.months.map((row) => (
                          <tr key={row.month} className="month-row">
                            <th scope="row" style={{ fontWeight: 400, paddingLeft: 28 }}>Mo {row.month}</th>
                            <td>{m(row.openingBalance)}</td>
                            <td>{m(row.payment)}</td>
                            <td className="pr-txt">{m(row.principal)}</td>
                            <td className="in-txt">{m(row.interest)}</td>
                            <td>{m(row.closingBalance)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoanChart({ result }: { result: LoanResult }) {
  const { fmt } = useSettings();
  const balance = result.chart.balance.map((d) => d.toNumber());
  const cumInt = result.chart.cumulativeInterest.map((d) => d.toNumber());
  const n = balance.length;
  const W = 720, H = 260, padL = 8, padR = 8, padT = 12, padB = 22;
  const start = result.principal.toNumber();
  const yMax = Math.max(start, cumInt[cumInt.length - 1] ?? 0) || 1;
  const x = (i: number) => padL + (i / Math.max(n - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const balArea = `M${x(0)},${y(start)} ${balance.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Balance and cumulative interest over the term">
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="var(--fc-line)" />
        <path className="chart-area" d={balArea} fill="var(--fc-principal)" opacity={0.12} />
        <path className="chart-line" d={line(balance)} fill="none" stroke="var(--fc-principal)" strokeWidth={2} />
        <path className="chart-area" d={line(cumInt)} fill="none" stroke="var(--fc-interest)" strokeWidth={2} strokeDasharray="5 4" />
      </svg>
      <div className="chart-legend">
        <span><span className="dot pr" /> Outstanding balance → {fmt.money(result.chart.balance[n - 1]!)}</span>
        <span><span className="dot in" /> Cumulative interest → {fmt.money(result.totalInterest)}</span>
      </div>
    </div>
  );
}
