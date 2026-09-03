import type { CalculatorDef, ResultView } from '../kit';
import { metric, numval, strval } from '../kit';
import { Decimal, D, isZeroish, type DecimalT } from '../decimal';
import { cagr, npv, irr, xirr, type DatedFlow } from '../finance';

// §6.3 Returns & time value. All money math in Decimal.

const perYearOf = (c: string) => (c === 'annual' ? 1 : c === 'semiannual' ? 2 : c === 'quarterly' ? 4 : 12);
const parseSeries = (s: string): number[] =>
  strval(s)
    .split(/[, ]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

// ── TVM 5-variable solver ──
const tvm: CalculatorDef = {
  id: 'returns.tvm',
  group: 'returns',
  title: 'Time value of money (TVM)',
  blurb: 'Solve for present value, future value, payment, periods, or rate.',
  keywords: ['tvm', 'present value', 'future value', 'annuity', 'pv', 'fv'],
  inputs: [
    { key: 'solveFor', label: 'Solve for', kind: 'select', default: 'FV', options: [
      { value: 'FV', label: 'Future value' }, { value: 'PV', label: 'Present value' },
      { value: 'PMT', label: 'Payment' }, { value: 'N', label: 'Periods' }, { value: 'Rate', label: 'Rate' } ] },
    { key: 'pv', label: 'Present value (PV)', kind: 'number', default: '-100000' },
    { key: 'pmt', label: 'Payment per period (PMT)', kind: 'number', default: '-5000' },
    { key: 'fv', label: 'Future value (FV)', kind: 'number', default: '0' },
    { key: 'n', label: 'Number of periods (N)', kind: 'number', default: '60' },
    { key: 'ratePct', label: 'Rate per year', kind: 'percent', default: '10' },
    { key: 'compounding', label: 'Compounding', kind: 'select', default: 'monthly', options: [
      { value: 'annual', label: 'Annual' }, { value: 'semiannual', label: 'Semi-annual' },
      { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' } ] },
    { key: 'timing', label: 'Payment timing', kind: 'segmented', default: 'end', options: [
      { value: 'end', label: 'End (ordinary)' }, { value: 'begin', label: 'Begin (due)' } ] },
  ],
  compute(v): ResultView {
    const solveFor = strval(v.solveFor, 'FV');
    const f = perYearOf(strval(v.compounding, 'monthly'));
    const i = D(numval(v.ratePct)).div(100).div(f);
    const n = numval(v.n);
    const due = strval(v.timing) === 'begin';
    const PV = D(numval(v.pv));
    const PMT = D(numval(v.pmt));
    const FV = D(numval(v.fv));
    const factor = (rate: DecimalT, periods: number) =>
      isZeroish(rate) ? D(periods) : rate.plus(1).pow(periods).minus(1).div(rate).times(due ? rate.plus(1) : 1);
    const compound = (rate: DecimalT, periods: number) => rate.plus(1).pow(periods);

    let label = 'Future value';
    let val = D(0);
    let formula = 'PV·(1+i)^n + PMT·[((1+i)^n − 1)/i]·timing + FV = 0';
    if (solveFor === 'FV') {
      val = PV.times(compound(i, n)).plus(PMT.times(factor(i, n))).neg();
      label = 'Future value';
    } else if (solveFor === 'PV') {
      val = FV.plus(PMT.times(factor(i, n))).neg().div(compound(i, n));
      label = 'Present value';
    } else if (solveFor === 'PMT') {
      val = PV.times(compound(i, n)).plus(FV).neg().div(factor(i, n));
      label = 'Payment per period';
    } else if (solveFor === 'N') {
      // bisection on n
      const g = (periods: number) => PV.times(compound(i, periods)).plus(PMT.times(factor(i, periods))).plus(FV);
      let lo = 1, hi = 1200;
      for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        const fm = g(mid).toNumber();
        if (Math.abs(fm) < 1e-6) { lo = hi = mid; break; }
        if (g(lo).toNumber() * fm < 0) hi = mid; else lo = mid;
      }
      val = D((lo + hi) / 2);
      label = 'Number of periods';
      return { primary: metric(label, val.toDecimalPlaces(2).toString()), formula, raw: { value: val.toNumber() } };
    } else {
      // Rate: bisection on i
      const g = (rate: DecimalT) => PV.times(compound(rate, n)).plus(PMT.times(factor(rate, n))).plus(FV);
      let lo = D(-0.9999), hi = D(10);
      if (g(lo).times(g(hi)).gt(0)) return { primary: metric('Rate', '—'), warnings: ['No rate solves these values — check the signs (money in negative, money out positive).'], formula };
      for (let k = 0; k < 200; k++) {
        const mid = lo.plus(hi).div(2);
        if (isZeroish(g(mid), '1e-10')) { lo = hi = mid; break; }
        if (g(lo).times(g(mid)).lt(0)) hi = mid; else lo = mid;
      }
      const perRate = lo.plus(hi).div(2);
      const annual = perRate.times(f).times(100);
      return { primary: metric('Rate per year', `${annual.toDecimalPlaces(4)}%`, 'accent'), formula, raw: { value: annual.toNumber() } };
    }
    return { primary: metric(label, val.toDecimalPlaces(2).toString(), 'accent'), formula, raw: { value: val.toNumber() } };
  },
};

const cagrCalc: CalculatorDef = {
  id: 'returns.cagr',
  group: 'returns',
  title: 'CAGR',
  blurb: 'Compound annual growth rate between two values.',
  keywords: ['cagr', 'growth rate', 'annualised'],
  inputs: [
    { key: 'begin', label: 'Initial value', kind: 'money', default: '100000' },
    { key: 'end', label: 'Final value', kind: 'money', default: '200000' },
    { key: 'years', label: 'Period', kind: 'years', default: '10' },
  ],
  compute(v, ctx): ResultView {
    const begin = ctx.D(numval(v.begin));
    const end = ctx.D(numval(v.end));
    const years = numval(v.years) || 1;
    const c = cagr(begin, end, years).times(100);
    const abs = end.minus(begin).div(begin).times(100);
    return {
      primary: metric('CAGR', `${ctx.fmt.num(c, 2)}%`, 'accent'),
      secondary: [
        metric('Absolute return', `${ctx.fmt.num(abs, 2)}%`),
        metric('Total gain', ctx.fmt.money(end.minus(begin)), 'positive'),
      ],
      formula: 'CAGR = (End / Begin)^(1/years) − 1',
      raw: { cagr: c.toNumber(), absolute: abs.toNumber() },
    };
  },
};

const absoluteReturn: CalculatorDef = {
  id: 'returns.absolute',
  group: 'returns',
  title: 'Absolute return',
  blurb: 'Simple and annualised return on an investment.',
  keywords: ['absolute return', 'total return', 'gain'],
  inputs: [
    { key: 'invested', label: 'Amount invested', kind: 'money', default: '100000' },
    { key: 'current', label: 'Current value', kind: 'money', default: '150000' },
    { key: 'years', label: 'Holding period', kind: 'years', default: '3', optional: true },
  ],
  compute(v, ctx): ResultView {
    const inv = ctx.D(numval(v.invested));
    const cur = ctx.D(numval(v.current));
    const abs = cur.minus(inv).div(inv).times(100);
    const years = numval(v.years);
    const sec = [metric('Total gain', ctx.fmt.money(cur.minus(inv)), cur.gte(inv) ? 'positive' : 'negative')];
    if (years > 0) sec.push(metric('Annualised (CAGR)', `${ctx.fmt.num(cagr(inv, cur, years).times(100), 2)}%`));
    return {
      primary: metric('Absolute return', `${ctx.fmt.num(abs, 2)}%`, 'accent'),
      secondary: sec,
      formula: 'Absolute return = (Current − Invested) / Invested',
      raw: { absolute: abs.toNumber() },
    };
  },
};

const xirrCalc: CalculatorDef = {
  id: 'returns.xirr',
  group: 'returns',
  title: 'XIRR',
  blurb: 'Annualised return for irregular, dated cashflows.',
  keywords: ['xirr', 'irregular cashflows', 'mutual fund return'],
  inputs: [
    { key: 'flows', label: 'Cashflows', kind: 'cashflows', default: [
      { date: '2023-01-01', amount: '-100000' }, { date: '2024-01-01', amount: '-50000' }, { date: '2025-01-01', amount: '180000' } ] as any },
  ],
  compute(v, ctx): ResultView {
    const raw = (v.flows as Array<{ date: string; amount: string }>) ?? [];
    const flows: DatedFlow[] = raw.filter((r) => r.date && r.amount !== '').map((r) => ({ date: r.date, amount: r.amount }));
    if (flows.length < 2) return { primary: metric('XIRR', '—'), warnings: ['Enter at least two dated cashflows.'] };
    const r = xirr(flows);
    if (!r) return { primary: metric('XIRR', '—'), warnings: ['Need at least one negative and one positive cashflow.'] };
    const pct = r.times(100);
    return {
      primary: metric('XIRR', `${ctx.fmt.num(pct, 2)}%`, 'accent'),
      formula: 'XIRR: rate where Σ cashflow / (1+rate)^(days/365) = 0',
      raw: { xirr: pct.toNumber() },
    };
  },
};

const irrCalc: CalculatorDef = {
  id: 'returns.irr',
  group: 'returns',
  title: 'IRR',
  blurb: 'Internal rate of return for periodic cashflows.',
  keywords: ['irr', 'internal rate of return'],
  inputs: [{ key: 'series', label: 'Cashflows (comma-separated, period 0 first)', kind: 'text', default: '-100000, 30000, 40000, 50000, 40000', help: '-100000, 30000, ...' }],
  compute(v, ctx): ResultView {
    const s = parseSeries(strval(v.series));
    if (s.length < 2) return { primary: metric('IRR', '—'), warnings: ['Enter at least two cashflows.'] };
    const r = irr(s);
    if (!r) return { primary: metric('IRR', '—'), warnings: ['No sign change — IRR is undefined for these flows.'] };
    return { primary: metric('IRR', `${ctx.fmt.num(r.times(100), 2)}%`, 'accent'), formula: 'IRR: rate where NPV = 0', raw: { irr: r.times(100).toNumber() } };
  },
};

const npvCalc: CalculatorDef = {
  id: 'returns.npv',
  group: 'returns',
  title: 'NPV',
  blurb: 'Net present value of periodic cashflows at a discount rate.',
  keywords: ['npv', 'net present value', 'discount'],
  inputs: [
    { key: 'ratePct', label: 'Discount rate per period', kind: 'percent', default: '10' },
    { key: 'series', label: 'Cashflows (comma-separated, period 0 first)', kind: 'text', default: '-100000, 30000, 40000, 50000, 40000' },
  ],
  compute(v, ctx): ResultView {
    const s = parseSeries(strval(v.series));
    const n = npv(D(numval(v.ratePct)).div(100), s);
    return {
      primary: metric('NPV', ctx.fmt.money(n), n.gte(0) ? 'positive' : 'negative'),
      secondary: [metric(n.gte(0) ? 'Value-creating' : 'Value-destroying', n.gte(0) ? 'NPV ≥ 0' : 'NPV < 0')],
      formula: 'NPV = Σ CFₜ / (1+r)ᵗ',
      raw: { npv: n.toNumber() },
    };
  },
};

const mirrCalc: CalculatorDef = {
  id: 'returns.mirr',
  group: 'returns',
  title: 'MIRR',
  blurb: 'Modified IRR with separate finance and reinvestment rates.',
  keywords: ['mirr', 'modified irr'],
  inputs: [
    { key: 'series', label: 'Cashflows (comma-separated)', kind: 'text', default: '-100000, 30000, 40000, 50000, 40000' },
    { key: 'financePct', label: 'Finance rate', kind: 'percent', default: '10' },
    { key: 'reinvestPct', label: 'Reinvestment rate', kind: 'percent', default: '12' },
  ],
  compute(v, ctx): ResultView {
    const s = parseSeries(strval(v.series));
    const n = s.length - 1;
    if (n < 1) return { primary: metric('MIRR', '—'), warnings: ['Enter at least two cashflows.'] };
    const fr = D(numval(v.financePct)).div(100);
    const rr = D(numval(v.reinvestPct)).div(100);
    let fvPos = D(0);
    let pvNeg = D(0);
    s.forEach((cf, t) => {
      if (cf > 0) fvPos = fvPos.plus(D(cf).times(rr.plus(1).pow(n - t)));
      else if (cf < 0) pvNeg = pvNeg.plus(D(cf).div(fr.plus(1).pow(t)));
    });
    if (pvNeg.isZero() || fvPos.isZero()) return { primary: metric('MIRR', '—'), warnings: ['Need both positive and negative cashflows.'] };
    const mirr = fvPos.div(pvNeg.neg()).pow(D(1).div(n)).minus(1).times(100);
    return { primary: metric('MIRR', `${ctx.fmt.num(mirr, 2)}%`, 'accent'), formula: 'MIRR = (FV(inflows@reinvest) / −PV(outflows@finance))^(1/n) − 1', raw: { mirr: mirr.toNumber() } };
  },
};

const payback: CalculatorDef = {
  id: 'returns.payback',
  group: 'returns',
  title: 'Payback period',
  blurb: 'Time to recover an initial investment.',
  keywords: ['payback', 'break even'],
  inputs: [
    { key: 'investment', label: 'Initial investment', kind: 'money', default: '500000' },
    { key: 'series', label: 'Annual inflows (comma-separated)', kind: 'text', default: '120000, 150000, 150000, 180000' },
    { key: 'discountPct', label: 'Discount rate (for discounted payback)', kind: 'percent', default: '0', optional: true, advanced: true },
  ],
  compute(v, ctx): ResultView {
    const inv = ctx.D(numval(v.investment));
    const flows = parseSeries(strval(v.series));
    const rate = D(numval(v.discountPct)).div(100);
    const disc = rate.gt(0);
    let cum = D(0);
    let years = 0;
    let payYear: number | null = null;
    for (let t = 0; t < flows.length; t++) {
      const cf = disc ? D(flows[t]!).div(rate.plus(1).pow(t + 1)) : D(flows[t]!);
      const before = cum;
      cum = cum.plus(cf);
      if (payYear === null && cum.gte(inv)) {
        const remain = inv.minus(before).div(cf);
        payYear = t + remain.toNumber();
      }
      years = t + 1;
    }
    if (payYear === null)
      return { primary: metric('Payback period', 'Not recovered'), warnings: [`Investment is not recovered within ${years} periods.`], raw: { payback: null } };
    return {
      primary: metric('Payback period', `${payYear.toFixed(2)} years`, 'accent'),
      secondary: [metric(disc ? 'Discounted' : 'Simple', disc ? `@ ${ctx.fmt.num(rate.times(100), 1)}%` : 'undiscounted')],
      formula: 'Payback = period when cumulative inflow ≥ investment',
      raw: { payback: payYear },
    };
  },
};

const realReturn: CalculatorDef = {
  id: 'returns.realReturn',
  group: 'returns',
  title: 'Real (inflation-adjusted) return',
  blurb: 'Return after removing the effect of inflation.',
  keywords: ['real return', 'inflation adjusted', 'fisher'],
  inputs: [
    { key: 'nominalPct', label: 'Nominal return', kind: 'percent', default: '12' },
    { key: 'inflationPct', label: 'Inflation', kind: 'percent', default: '6' },
  ],
  compute(v, ctx): ResultView {
    const nom = D(numval(v.nominalPct)).div(100);
    const inf = D(numval(v.inflationPct)).div(100);
    const real = nom.plus(1).div(inf.plus(1)).minus(1).times(100);
    return {
      primary: metric('Real return', `${ctx.fmt.num(real, 2)}%`, real.gte(0) ? 'positive' : 'negative'),
      secondary: [metric('Approx (nominal − inflation)', `${ctx.fmt.num(nom.minus(inf).times(100), 2)}%`)],
      formula: 'Real = (1 + nominal) / (1 + inflation) − 1',
      raw: { real: real.toNumber() },
    };
  },
};

const rule72: CalculatorDef = {
  id: 'returns.rule72',
  group: 'returns',
  title: 'Rule of 72',
  blurb: 'How long money takes to double — the shortcut and the exact answer.',
  keywords: ['rule of 72', 'doubling time'],
  inputs: [{ key: 'ratePct', label: 'Annual return', kind: 'percent', default: '8' }],
  compute(v, ctx): ResultView {
    const rate = numval(v.ratePct);
    if (rate <= 0) return { primary: metric('Years to double', '—'), warnings: ['Enter a positive return.'] };
    const approx = D(72).div(rate);
    const exact = Decimal.ln(2).div(Decimal.ln(D(rate).div(100).plus(1)));
    return {
      primary: metric('Years to double (Rule of 72)', ctx.fmt.num(approx, 2), 'accent'),
      secondary: [
        metric('Exact (logarithm)', ctx.fmt.num(exact, 2)),
        metric('Difference', ctx.fmt.num(approx.minus(exact).abs(), 2)),
      ],
      formula: 'Rule of 72: years ≈ 72 / rate;  exact = ln 2 / ln(1 + r)',
      raw: { approx: approx.toNumber(), exact: exact.toNumber() },
    };
  },
};

export const returnsCalculators: CalculatorDef[] = [
  tvm,
  cagrCalc,
  absoluteReturn,
  xirrCalc,
  irrCalc,
  npvCalc,
  mirrCalc,
  payback,
  realReturn,
  rule72,
];
