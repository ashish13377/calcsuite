// Investment calculators (§6.3): SIP, step-up SIP, lump sum, SWP, goal planning.
// Money math in Decimal only; display via ctx.fmt. Returns default to settings.
import type { CalculatorDef, ResultView, ScheduleView, ChartSeries, Metric } from '../kit';
import { numval, strval, dmoney, metric } from '../kit';
import { periodic, fvAnnuity, fvLump, cagr } from '../finance';
import { DEFAULT_SETTINGS } from '../../settings/settings';

const SIP_DEFAULT_RETURN = DEFAULT_SETTINGS.defaults.sipReturnPercent; // '12'
const INFLATION_DEFAULT = DEFAULT_SETTINGS.defaults.inflationPercent; // '6'

// Shared builders — one renderer draws these, so we only assemble data.
const valueChart = (labels: string[], points: number[]): ChartSeries => ({
  labels,
  series: [{ name: 'Value', tone: 'accent', points, area: true }],
});

const investedGainsSchedule = (rows: ScheduleView['rows']): ScheduleView => ({
  columns: ['Year', 'Invested', 'Gains', 'Value'],
  rows,
  toneCols: { 1: 'principal', 2: 'interest' },
});

const investedGainsSplit = (invested: string, gains: string): ResultView['split'] => [
  { label: 'Invested', value: Number(invested), tone: 'principal' },
  { label: 'Gains', value: Number(gains), tone: 'interest' },
];

// ─────────────────────────────── 1. SIP ───────────────────────────
const sip: CalculatorDef = {
  id: 'invest.sip',
  group: 'invest',
  title: 'SIP Calculator',
  blurb: 'Future value of a monthly Systematic Investment Plan at an expected rate of return.',
  keywords: ['sip', 'systematic investment plan', 'mutual fund', 'monthly investment', 'future value'],
  inputs: [
    { key: 'monthlyAmount', label: 'Monthly investment', kind: 'money', prefix: 'currency', default: '10000' },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: SIP_DEFAULT_RETURN },
    { key: 'tenure', label: 'Investment period', kind: 'tenure', default: 120 },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const P = dmoney(values.monthlyAmount, '10000');
    const ret = numval(values.expectedReturnPct, Number(ctx.settings.defaults.sipReturnPercent));
    const months = Math.max(1, Math.round(numval(values.tenure, 120)));
    const i = periodic(ret, 12);

    const maturity = fvAnnuity(P, i, months, true); // annuity-due: invest at month start
    const invested = P.times(months);
    const gains = maturity.minus(invested);
    const absReturnPct = invested.isZero() ? D(0) : gains.div(invested).times(100);

    // Yearly schedule + value chart (value at each year-end, annuity-due).
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let yEnd = 12; ; yEnd += 12) {
      const upto = Math.min(yEnd, months);
      const val = fvAnnuity(P, i, upto, true);
      const inv = P.times(upto);
      rows.push({ label: String(Math.ceil(upto / 12)), cells: [fmt.money(inv), fmt.money(val.minus(inv)), fmt.money(val)] });
      chartPts.push(Number(val.toFixed(2)));
      if (upto >= months) break;
    }

    return {
      primary: metric('Total value', fmt.money(maturity), 'principal'),
      secondary: [
        metric('Total invested', fmt.money(invested), 'principal'),
        metric('Estimated gains', fmt.money(gains), 'interest'),
        metric('Absolute return', fmt.pct(absReturnPct), 'accent'),
      ],
      split: investedGainsSplit(invested.toFixed(2), gains.toFixed(2)),
      schedule: investedGainsSchedule(rows),
      chart: valueChart(rows.map((r) => r.label), chartPts),
      formula: 'FV = P·[((1+i)^n − 1) / i]·(1+i),  i = r/12 (invested at the start of each month)',
      notes: ['Returns are assumed constant; actual market returns vary year to year.'],
      raw: {
        maturity: maturity.toFixed(2),
        invested: invested.toFixed(2),
        gains: gains.toFixed(2),
        absoluteReturnPct: absReturnPct.toFixed(2),
      },
    };
  },
};

// ─────────────────────────────── 2. Step-up SIP ───────────────────────────
const stepupSip: CalculatorDef = {
  id: 'invest.stepupSip',
  group: 'invest',
  title: 'Step-up SIP Calculator',
  blurb: 'SIP whose monthly amount rises by a fixed percentage every year, simulated month by month.',
  keywords: ['step up sip', 'top up sip', 'increasing sip', 'annual increase', 'mutual fund'],
  inputs: [
    { key: 'monthlyAmount', label: 'Initial monthly investment', kind: 'money', prefix: 'currency', default: '10000' },
    { key: 'annualStepPct', label: 'Annual step-up', kind: 'percent', suffix: '%', default: '10' },
    { key: 'returnPct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: SIP_DEFAULT_RETURN },
    { key: 'tenure', label: 'Investment period', kind: 'tenure', default: 120 },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const start = dmoney(values.monthlyAmount, '10000');
    const step = D(numval(values.annualStepPct, 10)).div(100);
    const ret = numval(values.returnPct, Number(ctx.settings.defaults.sipReturnPercent));
    const months = Math.max(1, Math.round(numval(values.tenure, 120)));
    const i = periodic(ret, 12);

    // Simulate monthly: contribute at month start, then grow one month. Amount steps every 12 months.
    let bal = D(0);
    let invested = D(0);
    let pmt = start;
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let m = 1; m <= months; m++) {
      if (m > 1 && (m - 1) % 12 === 0) pmt = pmt.times(step.plus(1)); // raise at each anniversary
      bal = bal.plus(pmt).times(i.plus(1));
      invested = invested.plus(pmt);
      if (m % 12 === 0 || m === months) {
        rows.push({ label: String(Math.ceil(m / 12)), cells: [fmt.money(invested), fmt.money(bal.minus(invested)), fmt.money(bal)] });
        chartPts.push(Number(bal.toFixed(2)));
      }
    }
    const gains = bal.minus(invested);

    return {
      primary: metric('Total value', fmt.money(bal), 'principal'),
      secondary: [
        metric('Total invested', fmt.money(invested), 'principal'),
        metric('Estimated gains', fmt.money(gains), 'interest'),
        metric('Final monthly amount', fmt.money(pmt), 'accent'),
      ],
      split: investedGainsSplit(invested.toFixed(2), gains.toFixed(2)),
      schedule: investedGainsSchedule(rows),
      chart: valueChart(rows.map((r) => r.label), chartPts),
      formula: 'Monthly simulation; the SIP amount is increased by the step-up % every 12 months',
      notes: ['The monthly amount steps up on each yearly anniversary; returns are assumed constant.'],
      raw: { maturity: bal.toFixed(2), invested: invested.toFixed(2), gains: gains.toFixed(2), finalMonthly: pmt.toFixed(2) },
    };
  },
};

// ─────────────────────────────── 3. Lump sum ───────────────────────────
const COMP_FREQ: Record<string, number> = { annual: 1, semiannual: 2, quarterly: 4, monthly: 12 };
const lumpsum: CalculatorDef = {
  id: 'invest.lumpsum',
  group: 'invest',
  title: 'Lump Sum Calculator',
  blurb: 'Maturity value of a one-time investment compounded at a chosen frequency.',
  keywords: ['lump sum', 'lumpsum', 'one time investment', 'compound interest', 'maturity'],
  inputs: [
    { key: 'principal', label: 'Investment amount', kind: 'money', prefix: 'currency', default: '100000' },
    { key: 'ratePct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: SIP_DEFAULT_RETURN },
    { key: 'years', label: 'Investment period', kind: 'years', suffix: 'years', default: 10 },
    {
      key: 'compounding',
      label: 'Compounding',
      kind: 'select',
      default: 'annual',
      options: [
        { value: 'annual', label: 'Annual' },
        { value: 'semiannual', label: 'Semi-annual' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const P = dmoney(values.principal, '100000');
    const ratePct = D(numval(values.ratePct, Number(ctx.settings.defaults.sipReturnPercent)));
    const years = Math.max(1, Math.round(numval(values.years, 10)));
    const f = COMP_FREQ[strval(values.compounding, 'annual')] ?? 1;
    const rf = ratePct.div(100).div(f); // per-period rate

    const maturity = P.times(rf.plus(1).pow(f * years)); // A = P(1+r/f)^(f·t)
    const gains = maturity.minus(P);
    const growth = P.isZero() ? D(0) : cagr(P, maturity, years); // effective CAGR fraction

    // Yearly schedule + value chart.
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let y = 1; y <= years; y++) {
      const val = P.times(rf.plus(1).pow(f * y));
      rows.push({ label: String(y), cells: [fmt.money(P), fmt.money(val.minus(P)), fmt.money(val)] });
      chartPts.push(Number(val.toFixed(2)));
    }

    return {
      primary: metric('Maturity value', fmt.money(maturity), 'principal'),
      secondary: [
        metric('Total gains', fmt.money(gains), 'interest'),
        metric('Invested', fmt.money(P), 'principal'),
        metric('CAGR', fmt.pct(growth.times(100)), 'accent'),
      ],
      split: investedGainsSplit(P.toFixed(2), gains.toFixed(2)),
      schedule: investedGainsSchedule(rows),
      chart: valueChart(rows.map((r) => r.label), chartPts),
      formula: 'A = P·(1 + r/f)^(f·t)',
      notes: ['Returns are assumed constant across the whole period.'],
      raw: { maturity: maturity.toFixed(2), invested: P.toFixed(2), gains: gains.toFixed(2), cagr: growth.times(100).toFixed(4) },
    };
  },
};

// ─────────────────────────────── 4. SWP ───────────────────────────
const SWP_CAP_MONTHS = 1200; // ponytail: 100-year cap when no tenure given; raise if anyone plans past 100yr
const swp: CalculatorDef = {
  id: 'invest.swp',
  group: 'invest',
  title: 'SWP Calculator',
  blurb: 'Systematic Withdrawal Plan: how a corpus lasts under fixed monthly withdrawals with growth.',
  keywords: ['swp', 'systematic withdrawal plan', 'withdrawal', 'retirement income', 'drawdown'],
  inputs: [
    { key: 'corpus', label: 'Total investment', kind: 'money', prefix: 'currency', default: '5000000' },
    { key: 'withdrawalPerMonth', label: 'Monthly withdrawal', kind: 'money', prefix: 'currency', default: '30000' },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: '8' },
    { key: 'tenureMonths', label: 'Withdrawal period', kind: 'tenure', default: 120, optional: true },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const corpus = dmoney(values.corpus, '5000000');
    const w = dmoney(values.withdrawalPerMonth, '30000');
    const ret = numval(values.expectedReturnPct, 8);
    const i = periodic(ret, 12);
    const givenTenure = numval(values.tenureMonths, 0);
    const horizon = givenTenure > 0 ? Math.round(givenTenure) : SWP_CAP_MONTHS;

    // balance grows one month, then the withdrawal is taken.
    let bal = corpus;
    let withdrawn = D(0);
    let depletedMonth = 0;
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    let opening = corpus;
    let yearWithdrawn = D(0);
    for (let m = 1; m <= horizon; m++) {
      bal = bal.times(i.plus(1));
      const take = bal.lt(w) ? bal.gt(0) ? bal : D(0) : w; // last withdrawal may be partial
      bal = bal.minus(take);
      withdrawn = withdrawn.plus(take);
      yearWithdrawn = yearWithdrawn.plus(take);
      if (depletedMonth === 0 && bal.lte('0.005')) depletedMonth = m;
      if (m % 12 === 0 || m === horizon || (depletedMonth && depletedMonth === m)) {
        const growth = bal.minus(opening).plus(yearWithdrawn);
        rows.push({ label: String(Math.ceil(m / 12)), cells: [fmt.money(opening), fmt.money(yearWithdrawn), fmt.money(growth), fmt.money(bal)] });
        chartPts.push(Number(bal.toFixed(2)));
        opening = bal;
        yearWithdrawn = D(0);
      }
      if (depletedMonth) break;
    }
    const finalBalance = bal;
    const depleted = depletedMonth > 0;

    const primary = depleted
      ? metric('Corpus lasts', `${depletedMonth} months`, 'negative', `≈ ${(depletedMonth / 12).toFixed(1)} years`)
      : metric('Final balance', fmt.money(finalBalance), 'principal');

    return {
      primary,
      secondary: [
        metric('Total withdrawn', fmt.money(withdrawn), 'interest'),
        metric('Final balance', fmt.money(finalBalance), depleted ? 'negative' : 'principal'),
        metric('Starting corpus', fmt.money(corpus), 'principal'),
      ],
      schedule: {
        columns: ['Year', 'Opening', 'Withdrawn', 'Growth', 'Balance'],
        rows,
        toneCols: { 2: 'interest', 3: 'principal' },
      },
      chart: valueChart(rows.map((r) => r.label), chartPts),
      formula: 'Each month: balance = balance·(1 + r/12) − withdrawal',
      notes: [
        depleted
          ? `The corpus is exhausted in month ${depletedMonth}; the final withdrawal may be partial.`
          : 'The corpus survives the whole withdrawal period; the remaining balance is shown.',
        'Returns are assumed constant; a market downturn early on shortens how long the corpus lasts.',
      ],
      raw: {
        finalBalance: finalBalance.toFixed(2),
        totalWithdrawn: withdrawn.toFixed(2),
        depletionMonth: depleted ? depletedMonth : null,
      },
    };
  },
};

// ─────────────────────────────── 5. Goal planning ───────────────────────────
const goal: CalculatorDef = {
  id: 'invest.goal',
  group: 'invest',
  title: 'Goal SIP Planner',
  blurb: 'Monthly SIP needed to reach an inflation-adjusted target, accounting for existing savings.',
  keywords: ['goal', 'target', 'financial goal', 'required sip', 'inflation', 'planning'],
  inputs: [
    { key: 'targetCorpus', label: "Today's cost of goal", kind: 'money', prefix: 'currency', default: '10000000' },
    { key: 'years', label: 'Years to goal', kind: 'years', suffix: 'years', default: 15 },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: SIP_DEFAULT_RETURN },
    { key: 'inflationPct', label: 'Inflation', kind: 'percent', suffix: '% p.a.', default: INFLATION_DEFAULT },
    { key: 'existingSavings', label: 'Existing savings', kind: 'money', prefix: 'currency', default: '0', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const target = dmoney(values.targetCorpus, '10000000');
    const years = Math.max(1, Math.round(numval(values.years, 15)));
    const ret = numval(values.expectedReturnPct, Number(ctx.settings.defaults.sipReturnPercent));
    const infl = D(numval(values.inflationPct, Number(ctx.settings.defaults.inflationPercent))).div(100);
    const existing = dmoney(values.existingSavings, '0');
    const months = years * 12;
    const i = periodic(ret, 12);

    const inflatedTarget = target.times(infl.plus(1).pow(years)); // future cost of the goal
    const grownExisting = fvLump(existing, i, months); // existing savings compound over the horizon
    const fvNeeded = inflatedTarget.minus(grownExisting);

    const factor = fvAnnuity(1, i, months, true); // FV per ₹1 of monthly SIP (annuity-due)
    const requiredMonthly = fvNeeded.gt(0) ? fvNeeded.div(factor) : D(0);
    const invested = requiredMonthly.times(months);
    const gains = fvNeeded.gt(0) ? fvNeeded.minus(invested) : D(0);

    const notes = [
      `Target grows with ${fmt.pct(infl.times(100))} inflation to ${fmt.money(inflatedTarget)} in ${years} years.`,
    ];
    if (existing.gt(0)) notes.push(`Existing savings grow to ${fmt.money(grownExisting)}, reducing what the SIP must fund.`);
    const warnings: string[] = [];
    if (fvNeeded.lte(0)) warnings.push('Your existing savings alone are projected to meet the inflation-adjusted goal — no SIP needed.');

    return {
      primary: metric('Required monthly SIP', fmt.money(requiredMonthly), 'principal'),
      primaryPer: '/month',
      secondary: [
        metric('Inflation-adjusted target', fmt.money(inflatedTarget), 'accent'),
        metric('You will invest', fmt.money(invested), 'principal'),
        metric('Growth on SIP', fmt.money(gains), 'interest'),
      ],
      formula: 'inflatedTarget = target·(1+infl)^yrs;  SIP = (inflatedTarget − existing·(1+i)^n) / annuity-due factor',
      notes,
      warnings,
      raw: {
        requiredMonthly: requiredMonthly.toFixed(2),
        inflatedTarget: inflatedTarget.toFixed(2),
        invested: invested.toFixed(2),
        futureValueOfExisting: grownExisting.toFixed(2),
      },
    };
  },
};

export const investmentCalculators: CalculatorDef[] = [sip, stepupSip, lumpsum, swp, goal];
