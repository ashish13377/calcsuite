// Loan calculators (§6.1). Each is a pure schema + compute → ResultView of
// formatted strings. Money math stays in Decimal end-to-end; solve()/finance
// primitives are reused rather than reimplemented (§18, ladder rung 2).
import { Decimal, D, type DecimalT } from '../decimal';
import { periodic, pmt, pvAnnuity, bisectRate } from '../finance';
import { solve, REGIONS } from '../loan';
import {
  type CalculatorDef,
  type ResultView,
  type FieldSchema,
  type CalcCtx,
  type ScheduleGroup,
  numval,
  strval,
  boolval,
  dmoney,
  metric,
} from '../kit';

const round2 = (d: DecimalT) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** One simulated month: cells are the DATA columns after the leading label. */
interface MRow {
  month: number;
  cells: DecimalT[]; // [...summed cols..., balance]  (last col = balance, not summed)
}

/** Group month rows into per-year expandable summaries; balance col takes the
 *  last row's value, every other col is summed — mirrors loan.byYear. */
function yearGroups(rows: MRow[], ctx: CalcCtx): ScheduleGroup[] {
  const byYear = new Map<number, MRow[]>();
  for (const r of rows) {
    const y = Math.ceil(r.month / 12);
    const bucket = byYear.get(y);
    if (bucket) bucket.push(r);
    else byYear.set(y, [r]);
  }
  const groups: ScheduleGroup[] = [];
  for (const [y, rs] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const ncol = rs[0]!.cells.length;
    const sums: DecimalT[] = Array.from({ length: ncol }, () => D(0));
    for (const r of rs) r.cells.forEach((c, i) => (sums[i] = sums[i]!.plus(c)));
    sums[ncol - 1] = rs[rs.length - 1]!.cells[ncol - 1]!; // balance = closing
    groups.push({
      label: `Year ${y}`,
      summary: sums.map((c) => ctx.fmt.money(c)),
      rows: rs.map((r) => ({ label: `Month ${r.month}`, cells: r.cells.map((c) => ctx.fmt.money(c)) })),
    });
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. loan.compare — compare 2–5 loans by total outflow
// ─────────────────────────────────────────────────────────────────────────
const compareInputs: FieldSchema[] = [
  {
    key: 'count',
    label: 'How many loans',
    kind: 'select',
    default: '2',
    options: [2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
  },
];
for (let i = 1; i <= 5; i++) {
  const required = i <= 2;
  const show = required ? undefined : (v: any) => numval(v.count, 2) >= i;
  compareInputs.push(
    { key: `p${i}`, label: `Loan ${i} amount`, kind: 'money', prefix: 'currency', default: i <= 2 ? '2500000' : '', optional: !required, showIf: show },
    { key: `r${i}`, label: `Loan ${i} rate`, kind: 'percent', suffix: '%', default: i === 1 ? 9 : i === 2 ? 8.65 : '', optional: !required, showIf: show, labelByRegion: {} },
    { key: `t${i}`, label: `Loan ${i} tenure`, kind: 'tenure', default: 240, optional: !required, showIf: show, labelByRegion: { US: `Loan ${i} term` } },
  );
}

const loanCompare: CalculatorDef = {
  id: 'loan.compare',
  group: 'loans',
  title: 'Compare loans',
  blurb: 'Line up 2–5 loans and see which costs least over its full life.',
  keywords: ['compare', 'loan', 'cheapest', 'emi', 'best offer'],
  inputs: compareInputs,
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const count = Math.max(2, Math.min(5, numval(values.count, 2)));
    const loans: Array<{ i: number; payment: DecimalT; interest: DecimalT; total: DecimalT; rate: number }> = [];
    for (let i = 1; i <= count; i++) {
      const P = dmoney(values[`p${i}`]);
      const rate = numval(values[`r${i}`]);
      const n = numval(values[`t${i}`]);
      if (P.lte(0) || n < 1) continue;
      try {
        const res = solve({ region: ctx.region, principal: P.toString(), annualRatePct: String(rate), tenureMonths: n });
        loans.push({ i, payment: res.payment, interest: res.totalInterest, total: res.totalPayment, rate });
      } catch {
        /* skip an invalid slot rather than blow up the whole comparison */
      }
    }

    if (loans.length === 0) {
      return { primary: metric('No comparable loans', ctx.fmt.money(0)), warnings: ['Enter at least one valid loan (amount, rate, tenure).'] };
    }

    const byTotal = [...loans].sort((a, b) => a.total.cmp(b.total));
    const byRate = [...loans].sort((a, b) => a.rate - b.rate);
    const best = byTotal[0]!;
    const cheapRate = byRate[0]!;

    const raw: Record<string, number> = { cheapestByTotal: best.i, cheapestByRate: cheapRate.i };
    for (const l of loans) {
      raw[`emi${l.i}`] = l.payment.toNumber();
      raw[`interest${l.i}`] = l.interest.toNumber();
      raw[`total${l.i}`] = l.total.toNumber();
    }

    const notes = [
      'Cheapest by total outflow can differ from cheapest by headline rate — a lower rate over a longer tenure often pays more interest overall.',
    ];
    if (best.i !== cheapRate.i) {
      notes.push(`Here they differ: Loan ${cheapRate.i} has the lowest rate, but Loan ${best.i} has the lowest total outflow.`);
    }

    return {
      primary: metric(`Lowest total outflow — Loan ${best.i}`, ctx.fmt.money(best.total), 'positive'),
      secondary: loans.map((l) =>
        metric(`Loan ${l.i} ${R.paymentLabel}`, ctx.fmt.money(l.payment), l.i === best.i ? 'positive' : 'default', `total ${ctx.fmt.money(l.total)}`),
      ),
      schedule: {
        title: 'Side by side',
        columns: ['Loan', R.paymentLabel, 'Total interest', 'Total paid'],
        rows: loans.map((l) => ({
          label: `Loan ${l.i}`,
          cells: [ctx.fmt.money(l.payment), ctx.fmt.money(l.interest), ctx.fmt.money(l.total)],
        })),
        toneCols: { 2: 'interest' },
      },
      notes,
      raw,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 2. loan.prepay — lump-sum / recurring prepayment
// ─────────────────────────────────────────────────────────────────────────
const loanPrepay: CalculatorDef = {
  id: 'loan.prepay',
  group: 'loans',
  title: 'Prepayment impact',
  blurb: 'See interest saved and time cut by prepaying part of the loan.',
  keywords: ['prepay', 'part payment', 'foreclose', 'interest saved'],
  inputs: [
    { key: 'principal', label: 'Loan amount', kind: 'money', prefix: 'currency', default: '2500000' },
    { key: 'ratePct', label: 'Interest rate', kind: 'percent', suffix: '%', default: 8.65 },
    { key: 'tenureMonths', label: 'Tenure', kind: 'tenure', default: 240, labelByRegion: { US: 'Term' } },
    { key: 'prepayAmount', label: 'Prepayment amount', kind: 'money', prefix: 'currency', default: '500000' },
    { key: 'prepayStartMonth', label: 'Starting month', kind: 'int', default: 13, min: 1 },
    { key: 'recurring', label: 'Repeat every month', kind: 'toggle', default: false },
    {
      key: 'adjust',
      label: 'Keep',
      kind: 'segmented',
      default: 'reduceTenure',
      options: [
        { value: 'reduceTenure', label: 'Reduce tenure' },
        { value: 'reduceEmi', label: 'Reduce EMI' },
      ],
    },
    { key: 'penaltyPct', label: 'Prepayment penalty', kind: 'percent', suffix: '%', default: 0, optional: true, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const P = dmoney(values.principal);
    const rate = numval(values.ratePct);
    const n = numval(values.tenureMonths);
    const prepay = dmoney(values.prepayAmount);
    const startMonth = Math.max(1, numval(values.prepayStartMonth, 1));
    const recurring = boolval(values.recurring);
    const reduceEmi = strval(values.adjust, 'reduceTenure') === 'reduceEmi';
    const penaltyPct = D(numval(values.penaltyPct));
    const r = periodic(rate);

    const base = solve({ region: ctx.region, principal: P.toString(), annualRatePct: String(rate), tenureMonths: n });
    let emi = base.payment;
    const baseN = base.tenureMonths;
    const baseInterest = base.totalInterest;

    const rows: MRow[] = [];
    let bal = P;
    let totalInterest = D(0);
    let penaltyPaid = D(0);
    let m = 0;
    const cap = baseN + 12; // safety; prepayment only ever shortens
    while (bal.gt('0.005') && m < cap) {
      m++;
      const interest = round2(bal.times(r));
      let principalPaid = emi.minus(interest);
      if (principalPaid.gt(bal)) principalPaid = bal;
      bal = round2(bal.minus(principalPaid));
      totalInterest = totalInterest.plus(interest);

      let stepPrepay = D(0);
      if (bal.gt(0) && m >= startMonth && (recurring || m === startMonth)) {
        stepPrepay = prepay.gt(bal) ? bal : prepay;
        const penalty = round2(stepPrepay.times(penaltyPct).div(100));
        penaltyPaid = penaltyPaid.plus(penalty);
        bal = round2(bal.minus(stepPrepay));
        if (reduceEmi) {
          const remaining = baseN - m;
          emi = remaining > 0 && bal.gt(0) ? round2(pmt(bal, r, remaining)) : emi;
        }
      }
      rows.push({ month: m, cells: [round2(principalPaid), interest, round2(stepPrepay), bal] });
    }

    const newN = rows.length;
    const monthsSaved = baseN - newN;
    const interestSaved = round2(baseInterest.minus(totalInterest));
    const netBenefit = round2(interestSaved.minus(penaltyPaid));

    const notes: string[] = [];
    if (ctx.region === 'IN') {
      notes.push('RBI bars foreclosure/prepayment charges on floating-rate loans to individuals — penalty defaults to 0. Set it only for a fixed-rate loan.');
    }
    notes.push(reduceEmi ? 'EMI recomputed on the reduced balance; the original end date is kept.' : 'EMI kept the same; the loan simply finishes earlier.');

    // balance-over-time chart: base vs after prepayment
    const baseBal = base.schedule.map((row) => row.closingBalance.toNumber());
    const newBal = rows.map((row) => row.cells[row.cells.length - 1]!.toNumber());
    while (newBal.length < baseBal.length) newBal.push(0);

    return {
      primary: metric('Interest saved', ctx.fmt.money(interestSaved), 'positive'),
      secondary: [
        metric('Months saved', String(Math.max(0, monthsSaved)), monthsSaved > 0 ? 'positive' : 'default', `${Math.max(0, monthsSaved)} of ${baseN}`),
        metric(reduceEmi ? `New ${R.paymentLabel}` : `${R.paymentLabel} (unchanged)`, ctx.fmt.money(emi)),
        metric('Penalty paid', ctx.fmt.money(penaltyPaid), penaltyPaid.gt(0) ? 'negative' : 'default'),
        metric('Net benefit', ctx.fmt.money(netBenefit), netBenefit.gt(0) ? 'positive' : 'negative'),
      ],
      chart: {
        labels: baseBal.map((_, idx) => String(idx + 1)),
        series: [
          { name: 'Without prepay', tone: 'accent', points: baseBal, dash: true },
          { name: 'With prepay', tone: 'principal', points: newBal, area: true },
        ],
      },
      schedule: {
        title: 'New amortisation',
        columns: ['Month', 'Principal', 'Interest', 'Prepay', 'Balance'],
        groups: yearGroups(rows, ctx),
        toneCols: { 1: 'principal', 2: 'interest' },
      },
      notes,
      raw: {
        baseInterest: baseInterest.toNumber(),
        newInterest: round2(totalInterest).toNumber(),
        interestSaved: interestSaved.toNumber(),
        monthsSaved,
        penaltyPaid: penaltyPaid.toNumber(),
        netBenefit: netBenefit.toNumber(),
        newTenureMonths: newN,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 3. loan.transfer — balance transfer to a cheaper lender
// ─────────────────────────────────────────────────────────────────────────
const loanTransfer: CalculatorDef = {
  id: 'loan.transfer',
  group: 'loans',
  title: 'Balance transfer',
  blurb: 'Move the outstanding balance to a lower rate and find the breakeven.',
  keywords: ['balance transfer', 'refinance', 'switch lender', 'breakeven'],
  inputs: [
    { key: 'outstandingPrincipal', label: 'Outstanding balance', kind: 'money', prefix: 'currency', default: '2000000' },
    { key: 'oldRatePct', label: 'Current rate', kind: 'percent', suffix: '%', default: 9.5 },
    { key: 'remainingMonths', label: 'Remaining tenure', kind: 'tenure', default: 180, labelByRegion: { US: 'Remaining term' } },
    { key: 'newRatePct', label: 'New rate', kind: 'percent', suffix: '%', default: 8.5 },
    { key: 'transferFee', label: 'Transfer fee', kind: 'money', prefix: 'currency', default: '10000', optional: true, labelByRegion: { US: 'Closing costs' } },
    { key: 'transferFeePct', label: 'Transfer fee (% of balance)', kind: 'percent', suffix: '%', default: 0, optional: true, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const bal = dmoney(values.outstandingPrincipal);
    const oldRate = numval(values.oldRatePct);
    const newRate = numval(values.newRatePct);
    const nMonths = numval(values.remainingMonths);
    const fee = round2(dmoney(values.transferFee).plus(bal.times(D(numval(values.transferFeePct))).div(100)));

    const oldEmi = round2(pmt(bal, periodic(oldRate), nMonths));
    const newEmi = round2(pmt(bal, periodic(newRate), nMonths));
    const monthlySaving = round2(oldEmi.minus(newEmi));
    const totalSaving = round2(monthlySaving.times(nMonths).minus(fee));
    const breakeven = monthlySaving.gt(0) ? Math.ceil(fee.div(monthlySaving).toNumber()) : null;

    const warnings: string[] = [];
    if (monthlySaving.lte(0)) warnings.push('The new rate is not lower — a transfer would not save anything here.');
    else if (breakeven != null && breakeven > nMonths) warnings.push('Breakeven falls after the loan ends — the fee outweighs the saving.');

    return {
      primary: metric('Monthly saving', ctx.fmt.money(monthlySaving), monthlySaving.gt(0) ? 'positive' : 'negative'),
      primaryPer: '/month',
      secondary: [
        metric(`Current ${R.paymentLabel}`, ctx.fmt.money(oldEmi)),
        metric(`New ${R.paymentLabel}`, ctx.fmt.money(newEmi)),
        metric('Total saving (net of fee)', ctx.fmt.money(totalSaving), totalSaving.gt(0) ? 'positive' : 'negative'),
        metric('Breakeven', breakeven != null ? `Month ${breakeven}` : '—', 'default', breakeven != null ? `fee recovered by month ${breakeven}` : 'no saving'),
      ],
      schedule: {
        columns: ['', 'Rate', R.paymentLabel],
        rows: [
          { label: 'Current', cells: [ctx.fmt.pct(oldRate), ctx.fmt.money(oldEmi)] },
          { label: 'New', cells: [ctx.fmt.pct(newRate), ctx.fmt.money(newEmi)] },
        ],
      },
      notes: [`Fee applied: ${ctx.fmt.money(fee)} (${R.feeWord.toLowerCase()} + %). Breakeven is the month cumulative EMI saving first exceeds the fee.`],
      warnings,
      raw: {
        oldEmi: oldEmi.toNumber(),
        newEmi: newEmi.toNumber(),
        monthlySaving: monthlySaving.toNumber(),
        totalSaving: totalSaving.toNumber(),
        breakevenMonth: breakeven,
        fee: fee.toNumber(),
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 4. loan.eligibility — how much can you borrow (income based)
// ─────────────────────────────────────────────────────────────────────────
const loanEligibility: CalculatorDef = {
  id: 'loan.eligibility',
  group: 'loans',
  title: 'Loan eligibility',
  blurb: 'Turn income and existing obligations into a borrowing limit.',
  keywords: ['eligibility', 'affordability', 'foir', 'dti', 'how much can i borrow'],
  inputs: [
    // IN (FOIR)
    { key: 'monthlyIncome', label: 'Net monthly income', kind: 'money', prefix: 'currency', default: '150000', showIf: (_v, region) => region === 'IN' },
    { key: 'foirPct', label: 'FOIR', kind: 'percent', suffix: '%', default: 50, help: 'Share of income allowed to service all EMIs.', showIf: (_v, region) => region === 'IN' },
    { key: 'existingEmi', label: 'Existing EMIs', kind: 'money', prefix: 'currency', default: '0', optional: true, showIf: (_v, region) => region === 'IN' },
    // US (DTI)
    { key: 'grossMonthlyIncome', label: 'Gross monthly income', kind: 'money', prefix: 'currency', default: '8000', showIf: (_v, region) => region === 'US' },
    { key: 'frontEndDtiPct', label: 'Front-end DTI', kind: 'percent', suffix: '%', default: 28, showIf: (_v, region) => region === 'US' },
    { key: 'backEndDtiPct', label: 'Back-end DTI', kind: 'percent', suffix: '%', default: 36, showIf: (_v, region) => region === 'US' },
    { key: 'monthlyDebts', label: 'Other monthly debts', kind: 'money', prefix: 'currency', default: '0', optional: true, showIf: (_v, region) => region === 'US' },
    // shared
    { key: 'ratePct', label: 'Interest rate', kind: 'percent', suffix: '%', default: 8.65 },
    { key: 'tenureMonths', label: 'Tenure', kind: 'tenure', default: 240, labelByRegion: { US: 'Term' } },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const rate = numval(values.ratePct);
    const n = numval(values.tenureMonths);
    const r = periodic(rate);

    let eligibleEmi: DecimalT;
    const secondary: ResultView['secondary'] = [];

    if (ctx.region === 'US') {
      const income = dmoney(values.grossMonthlyIncome);
      const debts = dmoney(values.monthlyDebts);
      const frontCap = round2(income.times(D(numval(values.frontEndDtiPct, 28))).div(100));
      const backCap = round2(income.times(D(numval(values.backEndDtiPct, 36))).div(100).minus(debts));
      eligibleEmi = Decimal.min(frontCap, backCap);
      secondary.push(
        metric('Front-end cap (28%)', ctx.fmt.money(frontCap)),
        metric('Back-end cap (36% − debts)', ctx.fmt.money(backCap)),
        metric(`Eligible ${R.paymentLabel}`, ctx.fmt.money(Decimal.max(eligibleEmi, 0)), 'accent'),
      );
    } else {
      const income = dmoney(values.monthlyIncome);
      const existing = dmoney(values.existingEmi);
      const foir = D(numval(values.foirPct, 50));
      eligibleEmi = round2(income.times(foir).div(100).minus(existing));
      secondary.push(
        metric('EMI capacity (FOIR)', ctx.fmt.money(round2(income.times(foir).div(100)))),
        metric('Less existing EMIs', ctx.fmt.money(existing)),
        metric(`Eligible ${R.paymentLabel}`, ctx.fmt.money(Decimal.max(eligibleEmi, 0)), 'accent'),
      );
    }

    const warnings: string[] = [];
    let principal = D(0);
    if (eligibleEmi.gt(0)) {
      principal = round2(pvAnnuity(eligibleEmi, r, n));
    } else {
      warnings.push('Existing obligations already use up the allowed share of income — no additional loan capacity.');
    }

    return {
      primary: metric('Eligible loan amount', ctx.fmt.money(principal), 'positive'),
      secondary,
      formula: ctx.region === 'US' ? 'EMI = min(income·frontDTI, income·backDTI − debts); P = PV of that annuity' : 'EMI = income·FOIR − existingEMI; P = PV of that annuity',
      warnings,
      raw: {
        eligibleEmi: Decimal.max(eligibleEmi, 0).toNumber(),
        eligiblePrincipal: principal.toNumber(),
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 5. loan.stepEmi — step-up / step-down EMI
// ─────────────────────────────────────────────────────────────────────────
const loanStepEmi: CalculatorDef = {
  id: 'loan.stepEmi',
  group: 'loans',
  title: 'Step-up / step-down EMI',
  blurb: 'EMI that rises (or falls) each year — lower start, same payoff date.',
  keywords: ['step up', 'step down', 'graduated', 'growing emi'],
  inputs: [
    { key: 'principal', label: 'Loan amount', kind: 'money', prefix: 'currency', default: '2500000' },
    { key: 'ratePct', label: 'Interest rate', kind: 'percent', suffix: '%', default: 8.65 },
    { key: 'tenureMonths', label: 'Tenure', kind: 'tenure', default: 240, labelByRegion: { US: 'Term' } },
    { key: 'annualStepPct', label: 'Annual step', kind: 'percent', suffix: '%/yr', default: 5, help: 'Positive = step-up, negative = step-down.' },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const P = dmoney(values.principal);
    const rate = numval(values.ratePct);
    const n = numval(values.tenureMonths);
    const step = D(numval(values.annualStepPct)).div(100);
    const r = periodic(rate);

    const stepFactor = (m: number) => D(1).plus(step).pow(Math.floor((m - 1) / 12));
    // signed final balance if we pay `e·stepFactor` every month for the full term.
    // Monotonic decreasing in e → bracketed bisection finds the initial EMI that zeroes it.
    const finalBalance = (e: DecimalT): DecimalT => {
      let bal = P;
      for (let m = 1; m <= n; m++) bal = bal.plus(bal.times(r)).minus(e.times(stepFactor(m)));
      return bal;
    };
    const initEmi = round2(bisectRate((e) => finalBalance(e), 0, P.toNumber(), 200) ?? pmt(P, r, n));

    // real schedule with rounding + last-payment cap
    const rows: MRow[] = [];
    let bal = P;
    let totalInterest = D(0);
    let lastEmi = initEmi;
    for (let m = 1; m <= n && bal.gt('0.005'); m++) {
      const interest = round2(bal.times(r));
      let emi = round2(initEmi.times(stepFactor(m)));
      let principalPaid = emi.minus(interest);
      if (principalPaid.gt(bal)) {
        principalPaid = bal;
        emi = round2(bal.plus(interest));
      }
      bal = round2(bal.minus(principalPaid));
      totalInterest = totalInterest.plus(interest);
      lastEmi = emi;
      rows.push({ month: m, cells: [principalPaid, interest, emi, bal] });
    }

    const flat = solve({ region: ctx.region, principal: P.toString(), annualRatePct: String(rate), tenureMonths: n });
    const extraInterest = round2(totalInterest.minus(flat.totalInterest));

    return {
      primary: metric(`Starting ${R.paymentLabel}`, ctx.fmt.money(initEmi), 'accent'),
      primaryPer: '/month',
      secondary: [
        metric(`Final ${R.paymentLabel}`, ctx.fmt.money(lastEmi), 'default', `year ${Math.ceil(rows.length / 12)}`),
        metric('Total interest', ctx.fmt.money(round2(totalInterest)), 'interest'),
        metric(`Flat ${R.paymentLabel} (no step)`, ctx.fmt.money(flat.payment)),
        metric('vs flat interest', ctx.fmt.money(extraInterest), extraInterest.gt(0) ? 'negative' : 'positive'),
      ],
      schedule: {
        title: 'Amortisation',
        columns: ['Month', 'Principal', 'Interest', R.paymentLabel, 'Balance'],
        groups: yearGroups(rows, ctx),
        toneCols: { 1: 'principal', 2: 'interest' },
      },
      notes: [`EMI changes by ${ctx.fmt.pct(D(numval(values.annualStepPct)))} every 12 months. A step-up starts lower and pays a little more interest than a flat EMI; a step-down does the reverse.`],
      raw: {
        initialEmi: initEmi.toNumber(),
        finalEmi: lastEmi.toNumber(),
        totalInterest: round2(totalInterest).toNumber(),
        flatEmi: flat.payment.toNumber(),
        flatTotalInterest: flat.totalInterest.toNumber(),
        extraInterest: extraInterest.toNumber(),
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 6. loan.moratorium — EMI holiday
// ─────────────────────────────────────────────────────────────────────────
const loanMoratorium: CalculatorDef = {
  id: 'loan.moratorium',
  group: 'loans',
  title: 'Moratorium / EMI holiday',
  blurb: 'What a payment holiday really costs once interest is added back.',
  keywords: ['moratorium', 'emi holiday', 'deferment', 'forbearance'],
  inputs: [
    { key: 'principal', label: 'Loan amount', kind: 'money', prefix: 'currency', default: '2500000' },
    { key: 'ratePct', label: 'Interest rate', kind: 'percent', suffix: '%', default: 8.65 },
    { key: 'tenureMonths', label: 'Tenure', kind: 'tenure', default: 240, labelByRegion: { US: 'Term' } },
    { key: 'moratoriumMonths', label: 'Moratorium length', kind: 'int', suffix: 'months', default: 6, min: 1 },
    {
      key: 'type',
      label: 'During the holiday',
      kind: 'segmented',
      default: 'noPayment',
      options: [
        { value: 'noPayment', label: 'Pay nothing (interest capitalises)' },
        { value: 'interestOnly', label: 'Pay interest only' },
      ],
    },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const P = dmoney(values.principal);
    const rate = numval(values.ratePct);
    const n = numval(values.tenureMonths);
    const mora = Math.max(0, numval(values.moratoriumMonths));
    const interestOnly = strval(values.type, 'noPayment') === 'interestOnly';
    const r = periodic(rate);

    const base = solve({ region: ctx.region, principal: P.toString(), annualRatePct: String(rate), tenureMonths: n });

    const warnings: string[] = [];
    let remaining = n - mora;
    if (remaining < 1) {
      remaining = 1;
      warnings.push('Moratorium is as long as (or longer than) the tenure — capped so the loan still has one instalment left.');
    }

    // Balance the EMI is recomputed on, and interest actually paid during the holiday.
    const grownBalance = interestOnly ? P : round2(P.times(r.plus(1).pow(mora)));
    const interestDuringHoliday = interestOnly ? round2(P.times(r).times(mora)) : D(0);
    const newEmi = round2(pmt(grownBalance, r, remaining));

    const totalInterest = round2(interestDuringHoliday.plus(newEmi.times(remaining)).minus(P));
    const extraCost = round2(totalInterest.minus(base.totalInterest));

    return {
      primary: metric(`New ${R.paymentLabel} after holiday`, ctx.fmt.money(newEmi), 'accent'),
      primaryPer: '/month',
      secondary: [
        metric(`Original ${R.paymentLabel}`, ctx.fmt.money(base.payment)),
        interestOnly
          ? metric('Interest paid during holiday', ctx.fmt.money(interestDuringHoliday), 'interest')
          : metric('Balance after capitalising', ctx.fmt.money(grownBalance), 'interest', `up from ${ctx.fmt.money(P)}`),
        metric('Total interest', ctx.fmt.money(totalInterest), 'interest'),
        metric('Extra cost vs no holiday', ctx.fmt.money(extraCost), extraCost.gt(0) ? 'negative' : 'positive'),
      ],
      split: [
        { label: 'Principal', value: P.toNumber(), tone: 'principal' },
        { label: 'Interest', value: totalInterest.toNumber(), tone: 'interest' },
      ],
      formula: interestOnly ? 'Pay P·r during holiday; EMI on P over (n − holiday)' : 'Balance grows to P·(1+r)^holiday; EMI recomputed on it over (n − holiday)',
      notes: [
        interestOnly
          ? 'Interest-only: the balance is unchanged, so only the deferred principal stretches the cost.'
          : 'A payment holiday is not free — unpaid interest is added to the balance and then itself earns interest.',
      ],
      warnings,
      raw: {
        newEmi: newEmi.toNumber(),
        baseEmi: base.payment.toNumber(),
        grownBalance: grownBalance.toNumber(),
        totalInterest: totalInterest.toNumber(),
        baseTotalInterest: base.totalInterest.toNumber(),
        extraCost: extraCost.toNumber(),
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 7. loan.overdraft — flexi / OD facility
// ─────────────────────────────────────────────────────────────────────────
const loanOverdraft: CalculatorDef = {
  id: 'loan.overdraft',
  group: 'loans',
  title: 'Overdraft / flexi loan',
  blurb: 'Interest on the average balance you actually draw, not the full limit.',
  keywords: ['overdraft', 'flexi', 'od', 'cash credit', 'line of credit'],
  inputs: [
    { key: 'sanctionedLimit', label: 'Sanctioned limit', kind: 'money', prefix: 'currency', default: '1000000' },
    { key: 'avgUtilisationPct', label: 'Average utilisation', kind: 'percent', suffix: '%', default: 60 },
    { key: 'ratePct', label: 'Interest rate', kind: 'percent', suffix: '%', default: 10 },
    { key: 'months', label: 'Period', kind: 'int', suffix: 'months', default: 12, min: 1 },
  ],
  compute(values, ctx): ResultView {
    const limit = dmoney(values.sanctionedLimit);
    const util = D(numval(values.avgUtilisationPct)).div(100);
    const rate = numval(values.ratePct);
    const months = Math.max(1, numval(values.months));
    const r = periodic(rate);

    const avgBalance = round2(limit.times(util));
    const monthlyInterest = round2(avgBalance.times(r));
    const totalInterest = round2(monthlyInterest.times(months));

    return {
      primary: metric('Total interest', ctx.fmt.money(totalInterest), 'interest'),
      secondary: [
        metric('Average balance drawn', ctx.fmt.money(avgBalance)),
        metric('Interest / month', ctx.fmt.money(monthlyInterest), 'interest'),
        metric('Undrawn (no interest)', ctx.fmt.money(round2(limit.minus(avgBalance)))),
      ],
      formula: 'interest = limit × utilisation × monthly-rate, summed over the period',
      notes: ['Charged on the average daily (here, monthly) balance outstanding — you pay only for what you draw, so keeping utilisation low cuts the cost directly.'],
      raw: {
        avgBalance: avgBalance.toNumber(),
        monthlyInterest: monthlyInterest.toNumber(),
        totalInterest: totalInterest.toNumber(),
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 8. loan.refinance — US mortgage refinance
// ─────────────────────────────────────────────────────────────────────────
const loanRefinance: CalculatorDef = {
  id: 'loan.refinance',
  group: 'loans',
  title: 'Refinance',
  blurb: 'New payment, monthly saving and breakeven on refinancing your mortgage.',
  keywords: ['refinance', 'refi', 'mortgage', 'cash out', 'breakeven'],
  regions: ['US'],
  inputs: [
    { key: 'currentBalance', label: 'Current balance', kind: 'money', prefix: 'currency', default: '300000' },
    { key: 'currentRatePct', label: 'Current rate', kind: 'percent', suffix: '%', default: 7 },
    { key: 'remainingMonths', label: 'Remaining term', kind: 'tenure', default: 300 },
    { key: 'newRatePct', label: 'New rate', kind: 'percent', suffix: '%', default: 6 },
    { key: 'newTermMonths', label: 'New term', kind: 'tenure', default: 360 },
    { key: 'closingCosts', label: 'Closing costs', kind: 'money', prefix: 'currency', default: '6000' },
    { key: 'cashOut', label: 'Cash out', kind: 'money', prefix: 'currency', default: '0', optional: true },
    { key: 'rollClosingCosts', label: 'Roll closing costs into the loan', kind: 'toggle', default: false, optional: true },
  ],
  compute(values, ctx): ResultView {
    const R = REGIONS[ctx.region];
    const balance = dmoney(values.currentBalance);
    const curRate = numval(values.currentRatePct);
    const remMonths = numval(values.remainingMonths);
    const newRate = numval(values.newRatePct);
    const newTerm = numval(values.newTermMonths);
    const closing = dmoney(values.closingCosts);
    const cashOut = dmoney(values.cashOut);
    const roll = boolval(values.rollClosingCosts);

    const newPrincipal = round2(balance.plus(cashOut).plus(roll ? closing : D(0)));
    const oldPayment = round2(pmt(balance, periodic(curRate), remMonths));
    const newPayment = round2(pmt(newPrincipal, periodic(newRate), newTerm));
    const monthlySaving = round2(oldPayment.minus(newPayment));
    const breakeven = monthlySaving.gt(0) ? Math.ceil(closing.div(monthlySaving).toNumber()) : null;
    const lifetimeSaving = round2(oldPayment.times(remMonths).minus(newPayment.times(newTerm)).minus(roll ? D(0) : closing));

    const warnings: string[] = [];
    if (monthlySaving.lte(0)) warnings.push('The new payment is not lower — refinancing at these terms would not reduce the monthly outlay.');
    if (newTerm > remMonths) warnings.push('New term is longer than what remains — a lower payment can still mean more interest over the full life.');

    return {
      primary: metric('Monthly saving', ctx.fmt.money(monthlySaving), monthlySaving.gt(0) ? 'positive' : 'negative'),
      primaryPer: '/month',
      secondary: [
        metric(`Current ${R.paymentLabel}`, ctx.fmt.money(oldPayment)),
        metric(`New ${R.paymentLabel}`, ctx.fmt.money(newPayment), 'accent'),
        metric('Breakeven', breakeven != null ? `Month ${breakeven}` : '—', 'default', roll ? 'costs rolled into balance' : 'out-of-pocket recovery'),
        metric('Lifetime saving', ctx.fmt.money(lifetimeSaving), lifetimeSaving.gt(0) ? 'positive' : 'negative'),
      ],
      schedule: {
        columns: ['', 'Rate', 'Term', R.paymentLabel],
        rows: [
          { label: 'Current', cells: [ctx.fmt.pct(curRate), `${remMonths} mo`, ctx.fmt.money(oldPayment)] },
          { label: 'New', cells: [ctx.fmt.pct(newRate), `${newTerm} mo`, ctx.fmt.money(newPayment)] },
        ],
      },
      notes: [`New loan financed on ${ctx.fmt.money(newPrincipal)} (balance${cashOut.gt(0) ? ' + cash-out' : ''}${roll ? ' + rolled closing costs' : ''}). Breakeven = closing costs ÷ monthly saving.`],
      warnings,
      raw: {
        newPrincipal: newPrincipal.toNumber(),
        oldPayment: oldPayment.toNumber(),
        newPayment: newPayment.toNumber(),
        monthlySaving: monthlySaving.toNumber(),
        breakevenMonth: breakeven,
        lifetimeSaving: lifetimeSaving.toNumber(),
      },
    };
  },
};

export const loanCalculators: CalculatorDef[] = [
  loanCompare,
  loanPrepay,
  loanTransfer,
  loanEligibility,
  loanStepEmi,
  loanMoratorium,
  loanOverdraft,
  loanRefinance,
];
