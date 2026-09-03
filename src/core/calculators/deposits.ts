// India deposit & savings-scheme calculators (§6.2 IN).
// FD, RD, PPF, NPS, EPF, SSY. Money math in Decimal only; display via ctx.fmt.
import type { CalculatorDef, ResultView, ScheduleView, ChartSeries, Metric } from '../kit';
import { numval, strval, boolval, dmoney, metric } from '../kit';
import { fvAnnuity } from '../finance';

const TDS_NOTE =
  '10% TDS applies on interest above ₹40,000/yr (₹50,000 for senior citizens). Submit Form 15G/15H to waive if income is below the taxable limit.';

// Small shared builders — one renderer draws these, so we only assemble data.
const balanceChart = (labels: string[], points: number[], name: string): ChartSeries => ({
  labels,
  series: [{ name, tone: 'accent', points, area: true }],
});

const yearlySchedule = (columns: string[], rows: ScheduleView['rows'], interestCol: number): ScheduleView => ({
  columns,
  rows,
  toneCols: { [interestCol]: 'interest' },
});

// ─────────────────────────────── 1. Fixed Deposit ───────────────────────────────
const fd: CalculatorDef = {
  id: 'invest.fd',
  group: 'invest',
  title: 'Fixed Deposit (FD)',
  blurb: 'Maturity value and interest on a bank fixed deposit — cumulative or interest-payout.',
  keywords: ['fd', 'fixed deposit', 'term deposit', 'bank', 'maturity'],
  regions: ['IN'],
  inputs: [
    { key: 'principal', label: 'Deposit amount', kind: 'money', prefix: 'currency', default: '100000' },
    { key: 'annualRatePct', label: 'Interest rate', kind: 'percent', suffix: '% p.a.', default: '7' },
    { key: 'tenure', label: 'Tenure', kind: 'tenure', default: 60 },
    {
      key: 'compounding',
      label: 'Compounding',
      kind: 'select',
      default: 'quarterly',
      options: [
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'annual', label: 'Annual' },
        { value: 'cumulative', label: 'Cumulative (quarterly)' },
      ],
    },
    {
      key: 'payout',
      label: 'Interest handling',
      kind: 'segmented',
      default: 'cumulative',
      options: [
        { value: 'cumulative', label: 'Reinvest' },
        { value: 'payout', label: 'Payout' },
      ],
    },
    { key: 'tdsApplicable', label: 'Deduct TDS', kind: 'toggle', default: false, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const P = dmoney(values.principal, '100000');
    const ratePct = D(numval(values.annualRatePct, 7));
    const totalMonths = Math.max(1, Math.round(numval(values.tenure, 60)));
    const comp = strval(values.compounding, 'quarterly');
    const f = comp === 'monthly' ? 12 : comp === 'annual' ? 1 : 4; // quarterly & cumulative → 4
    const isPayout = strval(values.payout, 'cumulative') === 'payout';
    const t = D(totalMonths).div(12);
    const rf = ratePct.div(100).div(f); // per-period rate

    // Year-by-year schedule (handles arbitrary tenure via fractional-period exponent).
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    let bal = P;
    let rem = totalMonths;
    let y = 1;
    while (rem > 0) {
      const m = Math.min(12, rem);
      const opening = bal;
      let interest;
      if (isPayout) {
        interest = P.times(ratePct.div(100)).times(D(m).div(12)); // simple, paid out
      } else {
        bal = opening.times(rf.plus(1).pow(D(m).div(12).times(f)));
        interest = bal.minus(opening);
      }
      const shown = isPayout ? P : bal;
      rows.push({ label: String(y), cells: [fmt.money(opening), fmt.money(interest), fmt.money(shown)] });
      chartPts.push(Number(shown.toFixed(2)));
      rem -= m;
      y++;
    }

    const maturity = isPayout ? P : P.times(rf.plus(1).pow(t.times(f)));
    const totalInterest = isPayout ? P.times(ratePct.div(100)).times(t) : maturity.minus(P);
    const eay = isPayout ? ratePct : maturity.div(P).pow(D(1).div(t)).minus(1).times(100);
    const periodicPayout = P.times(ratePct.div(100)).div(f);
    const perLabel = f === 12 ? 'month' : f === 1 ? 'year' : 'quarter';

    const tdsOn = boolval(values.tdsApplicable, false);
    const excess = totalInterest.minus(40000);
    const tds = tdsOn && excess.gt(0) ? excess.times('0.10') : D(0);

    const secondary: Metric[] = [
      metric('Total interest', fmt.money(totalInterest), 'interest'),
      metric('Effective annual yield', fmt.pct(eay), 'accent'),
    ];
    if (isPayout) secondary.push(metric(`Interest / ${perLabel}`, fmt.money(periodicPayout), 'interest'));
    if (tds.gt(0)) secondary.push(metric('After TDS', fmt.money(maturity.minus(tds)), 'negative', `TDS ${fmt.money(tds)}`));

    return {
      primary: metric(isPayout ? 'Principal returned' : 'Maturity value', fmt.money(maturity), 'principal'),
      secondary,
      split: [
        { label: 'Principal', value: Number(P.toFixed(2)), tone: 'principal' },
        { label: 'Interest', value: Number(totalInterest.toFixed(2)), tone: 'interest' },
      ],
      schedule: yearlySchedule(['Year', 'Opening', 'Interest', isPayout ? 'Principal' : 'Balance'], rows, 2),
      chart: balanceChart(rows.map((r) => r.label), chartPts, isPayout ? 'Principal' : 'Balance'),
      formula: isPayout ? 'Interest/period = P·(r/f); principal returned at maturity' : 'A = P·(1 + r/f)^(f·t)',
      notes: [
        isPayout
          ? 'Interest is paid out each period; the principal is returned at maturity.'
          : 'Interest is reinvested (compounded) and paid with the principal at maturity.',
        TDS_NOTE,
      ],
      raw: {
        maturity: maturity.toFixed(2),
        principal: P.toFixed(2),
        interest: totalInterest.toFixed(2),
        effectiveYield: eay.toFixed(4),
        tds: tds.toFixed(2),
      },
    };
  },
};

// ─────────────────────────────── 2. Recurring Deposit ───────────────────────────
const rd: CalculatorDef = {
  id: 'invest.rd',
  group: 'invest',
  title: 'Recurring Deposit (RD)',
  blurb: 'Maturity of a monthly recurring deposit compounded quarterly.',
  keywords: ['rd', 'recurring deposit', 'monthly', 'sip', 'bank'],
  regions: ['IN'],
  inputs: [
    { key: 'monthlyDeposit', label: 'Monthly deposit', kind: 'money', prefix: 'currency', default: '5000' },
    { key: 'annualRatePct', label: 'Interest rate', kind: 'percent', suffix: '% p.a.', default: '7' },
    { key: 'tenureMonths', label: 'Tenure (months)', kind: 'int', suffix: 'months', default: 12, min: 3, step: 3 },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const pmt = dmoney(values.monthlyDeposit, '5000');
    const ratePct = D(numval(values.annualRatePct, 7));
    const N = Math.max(1, Math.round(numval(values.tenureMonths, 12)));
    const q = ratePct.div(100).div(4); // quarterly rate
    const warnings: string[] = [];
    if (N % 3 !== 0) warnings.push(`Banks require the RD tenure to be a multiple of 3 months; ${N} is not.`);

    // Each instalment m (1..N) compounds quarterly for its remaining life: (N−m+1) months → quarters.
    let maturity = D(0);
    for (let m = 1; m <= N; m++) {
      const quartersLeft = D(N - m + 1).div(3);
      maturity = maturity.plus(pmt.times(q.plus(1).pow(quartersLeft)));
    }
    const invested = pmt.times(N);
    const interest = maturity.minus(invested);

    // Yearly schedule: running invested / value at each year end.
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let yEnd = 12; ; yEnd += 12) {
      const upto = Math.min(yEnd, N);
      let val = D(0);
      for (let m = 1; m <= upto; m++) val = val.plus(pmt.times(q.plus(1).pow(D(upto - m + 1).div(3))));
      const inv = pmt.times(upto);
      rows.push({ label: String(yEnd / 12), cells: [fmt.money(inv), fmt.money(val.minus(inv)), fmt.money(val)] });
      chartPts.push(Number(val.toFixed(2)));
      if (upto >= N) break;
    }

    return {
      primary: metric('Maturity value', fmt.money(maturity), 'principal'),
      secondary: [
        metric('Total invested', fmt.money(invested), 'principal'),
        metric('Interest earned', fmt.money(interest), 'interest'),
      ],
      split: [
        { label: 'Invested', value: Number(invested.toFixed(2)), tone: 'principal' },
        { label: 'Interest', value: Number(interest.toFixed(2)), tone: 'interest' },
      ],
      schedule: yearlySchedule(['Year', 'Invested', 'Interest', 'Value'], rows, 2),
      chart: balanceChart(rows.map((r) => r.label), chartPts, 'Value'),
      formula: 'M = Σ deposit·(1 + r/4)^(quarters remaining)',
      notes: ['Interest is compounded quarterly, the standard for bank recurring deposits.', TDS_NOTE],
      warnings,
      raw: { maturity: maturity.toFixed(2), invested: invested.toFixed(2), interest: interest.toFixed(2) },
    };
  },
};

// ─────────────────────────────── 3. PPF ───────────────────────────
const ppf: CalculatorDef = {
  id: 'invest.ppf',
  group: 'invest',
  title: 'Public Provident Fund (PPF)',
  blurb: 'Tax-free maturity of a PPF account over its 15-year lock-in and 5-year extension blocks.',
  keywords: ['ppf', 'provident fund', 'tax free', '80c', 'savings'],
  regions: ['IN'],
  inputs: [
    { key: 'yearlyDeposit', label: 'Yearly deposit', kind: 'money', prefix: 'currency', default: '150000' },
    { key: 'annualRatePct', label: 'Interest rate', kind: 'percent', suffix: '% p.a.', default: '7.1' },
    {
      key: 'tenureYears',
      label: 'Tenure',
      kind: 'segmented',
      default: '15',
      options: [
        { value: '15', label: '15 yr' },
        { value: '20', label: '20 yr' },
        { value: '25', label: '25 yr' },
        { value: '30', label: '30 yr' },
      ],
    },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const deposit = dmoney(values.yearlyDeposit, '150000');
    const ratePct = D(numval(values.annualRatePct, 7.1));
    const years = Math.max(15, Math.round(numval(values.tenureYears, 15)));
    const r = ratePct.div(100);
    const warnings: string[] = [];
    if (deposit.gt(150000)) warnings.push('PPF deposits above ₹1,50,000 per year are not accepted (and earn no interest).');

    // Deposit before the 5th → earns full-year interest, so each year is annuity-due.
    let bal = D(0);
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let y = 1; y <= years; y++) {
      const opening = bal;
      const grown = opening.plus(deposit); // deposit added at start of year
      bal = grown.times(r.plus(1));
      rows.push({
        label: String(y),
        cells: [fmt.money(opening), fmt.money(deposit), fmt.money(bal.minus(grown)), fmt.money(bal)],
      });
      chartPts.push(Number(bal.toFixed(2)));
    }
    const invested = deposit.times(years);
    const interest = bal.minus(invested);

    return {
      primary: metric('Maturity value', fmt.money(bal), 'principal'),
      secondary: [
        metric('Total invested', fmt.money(invested), 'principal'),
        metric('Interest earned', fmt.money(interest), 'interest'),
      ],
      split: [
        { label: 'Invested', value: Number(invested.toFixed(2)), tone: 'principal' },
        { label: 'Interest', value: Number(interest.toFixed(2)), tone: 'interest' },
      ],
      schedule: yearlySchedule(['Year', 'Opening', 'Deposit', 'Interest', 'Balance'], rows, 3),
      chart: balanceChart(rows.map((row) => row.label), chartPts, 'Balance'),
      formula: 'Annual compounding; each deposit (before the 5th) earns a full year of interest',
      notes: [
        'Maximum deposit is ₹1,50,000 per financial year; the maturity amount and interest are fully tax-free.',
        '15-year lock-in, extendable in 5-year blocks (with or without further contributions).',
      ],
      warnings,
      raw: { maturity: bal.toFixed(2), invested: invested.toFixed(2), interest: interest.toFixed(2) },
    };
  },
};

// ─────────────────────────────── 4. NPS ───────────────────────────
const nps: CalculatorDef = {
  id: 'invest.nps',
  group: 'invest',
  title: 'National Pension System (NPS)',
  blurb: 'Retirement corpus, lump sum and estimated monthly pension from monthly NPS contributions.',
  keywords: ['nps', 'pension', 'retirement', 'annuity', 'tier 1'],
  regions: ['IN'],
  inputs: [
    { key: 'monthlyContribution', label: 'Monthly contribution', kind: 'money', prefix: 'currency', default: '5000' },
    { key: 'annualReturnPct', label: 'Expected return', kind: 'percent', suffix: '% p.a.', default: '10' },
    { key: 'currentAge', label: 'Current age', kind: 'int', suffix: 'yrs', default: 30, min: 18, max: 65 },
    { key: 'retirementAge', label: 'Retirement age', kind: 'int', suffix: 'yrs', default: 60, min: 60, max: 75 },
    { key: 'annuityReturnPct', label: 'Annuity return', kind: 'percent', suffix: '% p.a.', default: '6' },
    { key: 'annuityPurchasePct', label: 'Annuity share', kind: 'percent', suffix: '%', default: '40', min: 40, max: 100 },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const pmt = dmoney(values.monthlyContribution, '5000');
    const ret = D(numval(values.annualReturnPct, 10));
    const currentAge = Math.round(numval(values.currentAge, 30));
    const retireAge = Math.round(numval(values.retirementAge, 60));
    const annuityRet = D(numval(values.annuityReturnPct, 6));
    const rawAnnuityPct = numval(values.annuityPurchasePct, 40);
    const warnings: string[] = [];
    if (rawAnnuityPct < 40) warnings.push('NPS rules require at least 40% of the corpus to be used to buy an annuity; using 40%.');
    const annuityPct = D(Math.max(40, rawAnnuityPct)).div(100);

    const months = Math.max(1, (retireAge - currentAge) * 12);
    const mRate = ret.div(100).div(12);
    const corpus = fvAnnuity(pmt, mRate, months);
    const invested = pmt.times(months);
    const gains = corpus.minus(invested);
    const annuityCorpus = corpus.times(annuityPct);
    const lumpSum = corpus.minus(annuityCorpus);
    const monthlyPension = annuityCorpus.times(annuityRet.div(100).div(12));

    return {
      primary: metric('Corpus at retirement', fmt.money(corpus), 'principal'),
      secondary: [
        metric('Tax-free lump sum', fmt.money(lumpSum), 'accent', `${fmt.pct(D(100).minus(annuityPct.times(100)))} of corpus`),
        metric('Monthly pension', fmt.money(monthlyPension), 'positive', `from ${fmt.money(annuityCorpus)} annuity`),
        metric('Total invested', fmt.money(invested), 'principal'),
      ],
      split: [
        { label: 'Invested', value: Number(invested.toFixed(2)), tone: 'principal' },
        { label: 'Returns', value: Number(gains.toFixed(2)), tone: 'interest' },
      ],
      formula: 'Corpus = FV of monthly annuity; pension = corpus·annuity% · (annuity rate / 12)',
      notes: [
        'At least 40% of the corpus must be used to buy an annuity; the rest can be withdrawn tax-free.',
        'The monthly pension is an estimate based on a level annuity at the assumed annuity return.',
      ],
      warnings,
      raw: {
        corpus: corpus.toFixed(2),
        invested: invested.toFixed(2),
        lumpSum: lumpSum.toFixed(2),
        monthlyPension: monthlyPension.toFixed(2),
      },
    };
  },
};

// ─────────────────────────────── 5. EPF ───────────────────────────
const epf: CalculatorDef = {
  id: 'invest.epf',
  group: 'invest',
  title: 'Employees’ Provident Fund (EPF)',
  blurb: 'Projected EPF corpus at retirement from employee + employer contributions with salary growth.',
  keywords: ['epf', 'pf', 'provident fund', 'retirement', 'salary'],
  regions: ['IN'],
  inputs: [
    { key: 'basicMonthlySalary', label: 'Basic monthly salary', kind: 'money', prefix: 'currency', default: '25000' },
    { key: 'employeeContribPct', label: 'Employee contribution', kind: 'percent', suffix: '%', default: '12' },
    { key: 'employerContribPct', label: 'Employer contribution', kind: 'percent', suffix: '%', default: '12' },
    { key: 'annualRatePct', label: 'EPF interest rate', kind: 'percent', suffix: '% p.a.', default: '8.25' },
    { key: 'currentAge', label: 'Current age', kind: 'int', suffix: 'yrs', default: 30, min: 18, max: 58 },
    { key: 'retirementAge', label: 'Retirement age', kind: 'int', suffix: 'yrs', default: 58, min: 40, max: 70 },
    { key: 'annualSalaryHikePct', label: 'Annual salary hike', kind: 'percent', suffix: '%', default: '5' },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    let basic = dmoney(values.basicMonthlySalary, '25000');
    const empPct = D(numval(values.employeeContribPct, 12));
    const emprPct = D(numval(values.employerContribPct, 12));
    const ratePct = D(numval(values.annualRatePct, 8.25));
    const currentAge = Math.round(numval(values.currentAge, 30));
    const retireAge = Math.round(numval(values.retirementAge, 58));
    const hike = D(numval(values.annualSalaryHikePct, 5)).div(100);
    const mRate = ratePct.div(100).div(12);
    const totalYears = Math.max(1, retireAge - currentAge);

    let bal = D(0);
    let contributions = D(0);
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let y = 1; y <= totalYears; y++) {
      const opening = bal;
      const monthlyContrib = basic.times(empPct.plus(emprPct)).div(100);
      const yearContrib = monthlyContrib.times(12);
      // Opening balance compounds monthly; the year's deposits form a monthly annuity.
      bal = opening.times(mRate.plus(1).pow(12)).plus(fvAnnuity(monthlyContrib, mRate, 12));
      const interest = bal.minus(opening).minus(yearContrib);
      contributions = contributions.plus(yearContrib);
      rows.push({ label: String(y), cells: [fmt.money(opening), fmt.money(yearContrib), fmt.money(interest), fmt.money(bal)] });
      chartPts.push(Number(bal.toFixed(2)));
      basic = basic.times(hike.plus(1)); // next year's salary
    }
    const interestTotal = bal.minus(contributions);

    return {
      primary: metric('EPF corpus at retirement', fmt.money(bal), 'principal'),
      secondary: [
        metric('Total contributions', fmt.money(contributions), 'principal'),
        metric('Interest earned', fmt.money(interestTotal), 'interest'),
      ],
      split: [
        { label: 'Contributions', value: Number(contributions.toFixed(2)), tone: 'principal' },
        { label: 'Interest', value: Number(interestTotal.toFixed(2)), tone: 'interest' },
      ],
      schedule: yearlySchedule(['Year', 'Opening', 'Contribution', 'Interest', 'Balance'], rows, 3),
      chart: balanceChart(rows.map((row) => row.label), chartPts, 'Balance'),
      formula: 'Yearly: balance·(1+r)^12 + FV of 12 monthly contributions; salary grows each year',
      notes: [
        'Simplified: the full 12% employer share is credited to EPF. In reality 8.33% (up to a wage ceiling) goes to the EPS pension scheme and only 3.67% to EPF.',
        'The EPF interest rate is declared yearly; this projection assumes it stays constant.',
      ],
      raw: { corpus: bal.toFixed(2), contributions: contributions.toFixed(2), interest: interestTotal.toFixed(2) },
    };
  },
};

// ─────────────────────────────── 6. Sukanya Samriddhi ───────────────────────────
const ssy: CalculatorDef = {
  id: 'invest.ssy',
  group: 'invest',
  title: 'Sukanya Samriddhi Yojana (SSY)',
  blurb: 'Maturity value of the girl-child savings scheme: 15 years of deposits, maturing at 21 years.',
  keywords: ['ssy', 'sukanya samriddhi', 'girl child', 'savings', '80c'],
  regions: ['IN'],
  inputs: [
    { key: 'yearlyDeposit', label: 'Yearly deposit', kind: 'money', prefix: 'currency', default: '150000', min: 250, max: 150000 },
    { key: 'annualRatePct', label: 'Interest rate', kind: 'percent', suffix: '% p.a.', default: '8.2' },
    { key: 'girlAge', label: 'Girl’s current age', kind: 'int', suffix: 'yrs', default: 5, min: 0, max: 10 },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const deposit = dmoney(values.yearlyDeposit, '150000');
    const ratePct = D(numval(values.annualRatePct, 8.2));
    const girlAge = Math.round(numval(values.girlAge, 5));
    const r = ratePct.div(100);
    const DEPOSIT_YEARS = 15;
    const MATURITY_YEARS = 21;
    const warnings: string[] = [];
    if (deposit.lt(250)) warnings.push('The minimum SSY deposit is ₹250 per year.');
    if (deposit.gt(150000)) warnings.push('The maximum SSY deposit is ₹1,50,000 per year.');
    if (girlAge > 10) warnings.push('An SSY account can only be opened before the girl turns 10.');

    // Deposits for the first 15 years (annuity-due), then interest compounds until year 21.
    let bal = D(0);
    const rows: NonNullable<ScheduleView['rows']> = [];
    const chartPts: number[] = [];
    for (let y = 1; y <= MATURITY_YEARS; y++) {
      const opening = bal;
      const dep = y <= DEPOSIT_YEARS ? deposit : D(0);
      const grown = opening.plus(dep);
      bal = grown.times(r.plus(1));
      rows.push({ label: String(y), cells: [fmt.money(opening), fmt.money(dep), fmt.money(bal.minus(grown)), fmt.money(bal)] });
      chartPts.push(Number(bal.toFixed(2)));
    }
    const invested = deposit.times(DEPOSIT_YEARS);
    const interest = bal.minus(invested);

    return {
      primary: metric('Maturity value', fmt.money(bal), 'principal', `at age ${girlAge + MATURITY_YEARS}`),
      secondary: [
        metric('Total invested', fmt.money(invested), 'principal'),
        metric('Interest earned', fmt.money(interest), 'interest'),
      ],
      split: [
        { label: 'Invested', value: Number(invested.toFixed(2)), tone: 'principal' },
        { label: 'Interest', value: Number(interest.toFixed(2)), tone: 'interest' },
      ],
      schedule: yearlySchedule(['Year', 'Opening', 'Deposit', 'Interest', 'Balance'], rows, 3),
      chart: balanceChart(rows.map((row) => row.label), chartPts, 'Balance'),
      formula: 'Annual compounding; deposits for 15 years, maturity 21 years from opening',
      notes: [
        'Deposits are made for the first 15 years; the account matures 21 years after opening.',
        'Deposit range is ₹250 to ₹1,50,000 per year; maturity is fully tax-free (EEE).',
      ],
      warnings,
      raw: { maturity: bal.toFixed(2), invested: invested.toFixed(2), interest: interest.toFixed(2) },
    };
  },
};

export const depositCalculators: CalculatorDef[] = [fd, rd, ppf, nps, epf, ssy];
