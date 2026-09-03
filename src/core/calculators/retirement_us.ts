// ─────────────────────────────────────────────────────────────────────────
// US retirement calculators (§6.2): 401(k) with match, Roth vs Traditional IRA,
// and 529 college savings. Money math in Decimal only; display via ctx.fmt.
// ─────────────────────────────────────────────────────────────────────────
import type { CalculatorDef, ResultView, ScheduleRow } from '../kit';
import { numval, metric } from '../kit';
import { D } from '../decimal';
import { fvAnnuity, fvLump, periodic } from '../finance';

// ── 1. 401(k) with employer match ──────────────────────────────────────────
const k401: CalculatorDef = {
  id: 'invest.401k',
  group: 'invest',
  title: '401(k) with Employer Match',
  blurb: 'Project your 401(k) balance at retirement, including free employer matching.',
  keywords: ['401k', 'retirement', 'employer match', 'workplace', 'pension'],
  regions: ['US'],
  inputs: [
    { key: 'annualSalary', label: 'Annual salary', kind: 'money', prefix: 'currency', default: 80000 },
    { key: 'employeeContribPct', label: 'Your contribution', kind: 'percent', suffix: '%', default: 10, help: '% of salary you contribute' },
    { key: 'employerMatchPct', label: 'Employer match', kind: 'percent', suffix: '%', default: 50, help: '% of your contribution the employer matches' },
    { key: 'employerMatchLimitPct', label: 'Match limit', kind: 'percent', suffix: '%', default: 6, help: 'up to this % of salary' },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '%', default: 8 },
    { key: 'currentAge', label: 'Current age', kind: 'int', default: 30 },
    { key: 'retirementAge', label: 'Retirement age', kind: 'int', default: 65 },
    { key: 'annualRaisePct', label: 'Annual raise', kind: 'percent', suffix: '%', default: 3, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const salary0 = numval(values.annualSalary);
    const empPct = numval(values.employeeContribPct);
    const matchPct = numval(values.employerMatchPct);
    const matchLimit = numval(values.employerMatchLimitPct);
    const r = D(numval(values.expectedReturnPct)).div(100);
    const currentAge = numval(values.currentAge);
    const retireAge = numval(values.retirementAge);
    const raise = D(numval(values.annualRaisePct)).div(100);
    const years = Math.max(0, Math.round(retireAge - currentAge));

    let salary = D(salary0);
    let balance = D(0);
    let totalEmp = D(0);
    let totalMatch = D(0);
    let totalGrowth = D(0);
    const rows: ScheduleRow[] = [];

    // matched share of salary is capped at the employer's limit
    const matchedPct = Math.min(empPct, matchLimit);

    for (let y = 1; y <= years; y++) {
      const empContrib = salary.times(empPct).div(100);
      const empMatch = salary.times(matchedPct).div(100).times(D(matchPct).div(100));
      const contribTotal = empContrib.plus(empMatch);
      const afterContrib = balance.plus(contribTotal);
      const growth = afterContrib.times(r);
      balance = afterContrib.plus(growth);

      totalEmp = totalEmp.plus(empContrib);
      totalMatch = totalMatch.plus(empMatch);
      totalGrowth = totalGrowth.plus(growth);

      rows.push({
        label: String(y),
        cells: [fmt.money(contribTotal), fmt.money(growth), fmt.money(balance)],
      });
      salary = salary.times(raise.plus(1));
    }

    const warnings: string[] = [];
    if (years <= 0) warnings.push('Retirement age must be greater than current age.');
    if (empPct < matchLimit && matchLimit > 0)
      warnings.push(
        `You contribute ${fmt.pct(empPct)} but your employer matches up to ${fmt.pct(matchLimit)} of salary — raise your contribution to at least ${fmt.pct(matchLimit)} to capture the full match.`,
      );

    return {
      primary: metric('Balance at retirement', fmt.money(balance), 'accent', `at age ${retireAge}`),
      secondary: [
        metric('Your contributions', fmt.money(totalEmp), 'principal'),
        metric('Employer match', fmt.money(totalMatch), 'positive'),
        metric('Investment growth', fmt.money(totalGrowth), 'interest'),
      ],
      split: [
        { label: 'Your contributions', value: Number(totalEmp.toFixed(2)), tone: 'principal' },
        { label: 'Employer match', value: Number(totalMatch.toFixed(2)), tone: 'accent' },
        { label: 'Growth', value: Number(totalGrowth.toFixed(2)), tone: 'interest' },
      ],
      schedule: {
        title: 'Year-by-year',
        columns: ['Year', 'Contributions', 'Growth', 'Balance'],
        rows,
        toneCols: { 1: 'principal', 2: 'interest' },
      },
      formula: 'each year: balance = (balance + your contribution + employer match) × (1 + return); salary grows by the raise',
      notes: [
        `Your employer adds ${fmt.money(totalMatch)} in free matching contributions over ${years} year(s) — money you would otherwise leave on the table.`,
        'Assumes a level contribution rate and steady annual return; actual returns vary.',
      ],
      warnings: warnings.length ? warnings : undefined,
      raw: {
        finalBalance: balance.toFixed(2),
        totalEmployeeContrib: totalEmp.toFixed(2),
        totalEmployerMatch: totalMatch.toFixed(2),
        totalGrowth: totalGrowth.toFixed(2),
        years,
      },
    };
  },
};

// ── 2. Roth vs Traditional IRA ──────────────────────────────────────────────
const iraCompare: CalculatorDef = {
  id: 'invest.iraCompare',
  group: 'invest',
  title: 'Roth vs Traditional IRA',
  blurb: 'Compare after-tax retirement value of a Roth versus a Traditional IRA.',
  keywords: ['ira', 'roth', 'traditional', 'retirement', 'tax'],
  regions: ['US'],
  inputs: [
    {
      key: 'annualContribution',
      label: 'Annual contribution',
      kind: 'money',
      prefix: 'currency',
      default: 7000,
      help: '2024/2025 cap is $7,000 ($8,000 if age 50+)',
    },
    { key: 'currentAge', label: 'Current age', kind: 'int', default: 30 },
    { key: 'retirementAge', label: 'Retirement age', kind: 'int', default: 65 },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '%', default: 7 },
    { key: 'currentTaxRatePct', label: 'Tax rate today', kind: 'percent', suffix: '%', default: 24 },
    { key: 'retirementTaxRatePct', label: 'Tax rate in retirement', kind: 'percent', suffix: '%', default: 22 },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const contribution = D(numval(values.annualContribution));
    const currentAge = numval(values.currentAge);
    const retireAge = numval(values.retirementAge);
    const r = D(numval(values.expectedReturnPct)).div(100);
    const curRate = D(numval(values.currentTaxRatePct)).div(100);
    const retRate = D(numval(values.retirementTaxRatePct)).div(100);
    const n = Math.max(0, Math.round(retireAge - currentAge));

    // Same gross contribution invested in each account.
    const grossFV = fvAnnuity(contribution, r, n);
    // Roth: after-tax dollars in, tax-free out.
    const rothFV = grossFV;
    // Traditional: pre-tax in, taxed at withdrawal.
    const tradFVAfterTax = grossFV.times(D(1).minus(retRate));
    // The tax you don't pay now (contribution × current rate), reinvested at the same return.
    const taxSavingsFV = fvAnnuity(contribution.times(curRate), r, n);
    const tradTotal = tradFVAfterTax.plus(taxSavingsFV);

    const rothWins = rothFV.gte(tradTotal);
    const winner = rothWins ? 'Roth IRA' : 'Traditional IRA';
    const gap = rothFV.minus(tradTotal).abs();
    const tie = gap.lt(1);

    return {
      primary: metric(
        'Better choice',
        tie ? 'Roughly equal' : winner,
        tie ? 'default' : 'positive',
        tie ? 'both end up about the same after tax' : `${fmt.money(gap)} more after tax`,
      ),
      secondary: [
        metric('Roth after-tax value', fmt.money(rothFV), rothWins && !tie ? 'positive' : 'default'),
        metric('Traditional after-tax value', fmt.money(tradTotal), !rothWins && !tie ? 'positive' : 'default', 'includes reinvested tax savings'),
        metric('Gross balance (either account)', fmt.money(grossFV), 'accent'),
      ],
      formula: 'Roth after-tax = FV;  Traditional after-tax = FV × (1 − retirement rate) + reinvested tax savings',
      notes: [
        'Assumes the annual tax savings from Traditional contributions are also invested and grow at the same return.',
        'Under that assumption the account with the lower tax rate at its taxed moment wins: Traditional when your tax rate today is higher than in retirement, Roth when your retirement rate is higher (equal rates ≈ tie).',
        `Today's rate ${fmt.pct(D(numval(values.currentTaxRatePct)))} vs retirement ${fmt.pct(D(numval(values.retirementTaxRatePct)))}.`,
      ],
      warnings: n <= 0 ? ['Retirement age must be greater than current age.'] : undefined,
      raw: {
        rothFV: rothFV.toFixed(2),
        tradFVAfterTax: tradFVAfterTax.toFixed(2),
        tradTotal: tradTotal.toFixed(2),
        taxSavingsFV: taxSavingsFV.toFixed(2),
        grossFV: grossFV.toFixed(2),
        winner: tie ? 'tie' : winner,
        gap: gap.toFixed(2),
      },
    };
  },
};

// ── 3. 529 college savings ──────────────────────────────────────────────────
const plan529: CalculatorDef = {
  id: 'invest.529',
  group: 'invest',
  title: '529 College Savings',
  blurb: 'Project a 529 plan balance and compare it to the future cost of college.',
  keywords: ['529', 'college', 'education', 'savings', 'tuition'],
  regions: ['US'],
  inputs: [
    { key: 'currentSavings', label: 'Current savings', kind: 'money', prefix: 'currency', default: 5000 },
    { key: 'monthlyContribution', label: 'Monthly contribution', kind: 'money', prefix: 'currency', default: 300 },
    { key: 'expectedReturnPct', label: 'Expected return', kind: 'percent', suffix: '%', default: 6 },
    { key: 'yearsUntilCollege', label: 'Years until college', kind: 'int', default: 18 },
    { key: 'currentAnnualCost', label: "Today's annual college cost", kind: 'money', prefix: 'currency', optional: true },
    { key: 'collegeCostInflationPct', label: 'College cost inflation', kind: 'percent', suffix: '%', default: 5, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const currentSavings = D(numval(values.currentSavings));
    const monthly = D(numval(values.monthlyContribution));
    const yrs = Math.max(0, Math.round(numval(values.yearsUntilCollege)));
    const months = yrs * 12;
    const mr = periodic(numval(values.expectedReturnPct), 12);

    const fvSavings = fvLump(currentSavings, mr, months);
    const fvContrib = fvAnnuity(monthly, mr, months);
    const projected = fvSavings.plus(fvContrib);
    const invested = currentSavings.plus(monthly.times(months));
    const growth = projected.minus(invested);

    const secondary = [
      metric('Total invested', fmt.money(invested), 'principal'),
      metric('Investment growth', fmt.money(growth), 'interest'),
    ];
    const raw: Record<string, string | number | null> = {
      projected: projected.toFixed(2),
      invested: invested.toFixed(2),
      growth: growth.toFixed(2),
      fourYearCost: null,
      gap: null,
    };
    const notes = ['Contributions and current balance grow monthly at the expected return.'];

    const costStr = values.currentAnnualCost;
    if (costStr != null && costStr !== '') {
      const currentCost = D(numval(values.currentAnnualCost));
      const infl = D(numval(values.collegeCostInflationPct)).div(100);
      // Four consecutive years of college starting when savings mature.
      let fourYearCost = D(0);
      for (let i = 0; i < 4; i++) {
        fourYearCost = fourYearCost.plus(fvLump(currentCost, infl, yrs + i));
      }
      const gap = projected.minus(fourYearCost); // positive = surplus, negative = shortfall
      const surplus = gap.gte(0);
      secondary.push(metric('4-year college cost', fmt.money(fourYearCost), 'default', 'inflation-adjusted'));
      secondary.push(
        metric(
          surplus ? 'Projected surplus' : 'Funding shortfall',
          fmt.money(gap.abs()),
          surplus ? 'positive' : 'negative',
        ),
      );
      raw.fourYearCost = fourYearCost.toFixed(2);
      raw.gap = gap.toFixed(2);
      notes.push(
        `Assumes 4 years of college at ${fmt.pct(D(numval(values.collegeCostInflationPct)))} annual cost inflation, starting in ${yrs} year(s).`,
      );
    }

    return {
      primary: metric('Projected savings', fmt.money(projected), 'accent', `in ${yrs} year(s)`),
      secondary,
      split: [
        { label: 'Invested', value: Number(invested.toFixed(2)), tone: 'principal' },
        { label: 'Growth', value: Number(growth.toFixed(2)), tone: 'interest' },
      ],
      formula: 'FV = currentSavings × (1+r)^n + monthly × ((1+r)^n − 1) / r   (r monthly, n months)',
      notes,
      warnings: yrs <= 0 ? ['Enter at least 1 year until college.'] : undefined,
      raw,
    };
  },
};

export const usRetirementCalculators: CalculatorDef[] = [k401, iraCompare, plan529];
