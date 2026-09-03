import { describe, it, expect } from 'vitest';
import { usRetirementCalculators } from './retirement_us';
import { makeFormatter } from '../format';
import { regionDefaults } from '../../settings/settings';
import { D } from '../decimal';

const ctx = {
  settings: regionDefaults('US'),
  region: 'US' as const,
  fmt: makeFormatter(regionDefaults('US')),
  D,
};

const byId = (id: string) => {
  const def = usRetirementCalculators.find((c) => c.id === id);
  if (!def) throw new Error(`missing calculator ${id}`);
  return def;
};

const num = (v: string | number | null | undefined) => Number(v);

describe('US retirement calculators', () => {
  it('exposes all three with US region', () => {
    expect(usRetirementCalculators.map((c) => c.id).sort()).toEqual(['invest.401k', 'invest.529', 'invest.iraCompare']);
    for (const c of usRetirementCalculators) expect(c.regions).toEqual(['US']);
  });

  it('401k: match totals exact, growth positive, balance monotonic', () => {
    const r = byId('invest.401k').compute(
      {
        annualSalary: 100000,
        employeeContribPct: 10,
        employerMatchPct: 50,
        employerMatchLimitPct: 6,
        expectedReturnPct: 8,
        currentAge: 30,
        retirementAge: 65,
        annualRaisePct: 0,
      },
      ctx,
    ).raw!;
    // 10% of 100k for 35 yrs
    expect(r.totalEmployeeContrib).toBe('350000.00');
    // match = min(10,6)% × salary × 50% = 3000/yr × 35
    expect(r.totalEmployerMatch).toBe('105000.00');
    expect(num(r.totalGrowth)).toBeGreaterThan(0);
    // balance ≈ fvAnnuity-due(13000, 8%, 35) ≈ 2.42M
    expect(num(r.finalBalance)).toBeGreaterThan(2_400_000);
    expect(num(r.finalBalance)).toBeLessThan(2_450_000);
    // identity: balance = contributions + match + growth
    expect(num(r.finalBalance)).toBeCloseTo(350000 + 105000 + num(r.totalGrowth), 0);
  });

  it('401k: schedule balances strictly increase', () => {
    const rv = byId('invest.401k').compute(
      { annualSalary: 80000, employeeContribPct: 8, expectedReturnPct: 7, currentAge: 25, retirementAge: 65 },
      ctx,
    );
    const balances = rv.schedule!.rows!.map((row) => Number(row.cells[2]!.replace(/[$,]/g, '')));
    for (let i = 1; i < balances.length; i++) expect(balances[i]!).toBeGreaterThan(balances[i - 1]!);
  });

  it('iraCompare: equal tax rates ≈ tie', () => {
    const r = byId('invest.iraCompare').compute(
      { annualContribution: 7000, currentAge: 30, retirementAge: 65, expectedReturnPct: 7, currentTaxRatePct: 24, retirementTaxRatePct: 24 },
      ctx,
    ).raw!;
    expect(num(r.rothFV)).toBeGreaterThan(0);
    expect(r.winner).toBe('tie');
    expect(Math.abs(num(r.gap))).toBeLessThan(1);
  });

  it('iraCompare: lower retirement rate favours Traditional; higher favours Roth', () => {
    const trad = byId('invest.iraCompare').compute(
      { annualContribution: 7000, currentAge: 30, retirementAge: 65, expectedReturnPct: 7, currentTaxRatePct: 32, retirementTaxRatePct: 15 },
      ctx,
    ).raw!;
    expect(trad.winner).toBe('Traditional IRA');
    expect(num(trad.tradTotal)).toBeGreaterThan(num(trad.rothFV));
    // tradFVAfterTax (taxed only) is below the gross Roth value
    expect(num(trad.tradFVAfterTax)).toBeLessThan(num(trad.rothFV));

    const roth = byId('invest.iraCompare').compute(
      { annualContribution: 7000, currentAge: 30, retirementAge: 65, expectedReturnPct: 7, currentTaxRatePct: 15, retirementTaxRatePct: 32 },
      ctx,
    ).raw!;
    expect(roth.winner).toBe('Roth IRA');
    expect(num(roth.rothFV)).toBeGreaterThan(num(roth.tradTotal));
  });

  it('529: projection positive, growth positive, shortfall vs 4-yr cost', () => {
    const r = byId('invest.529').compute(
      {
        currentSavings: 10000,
        monthlyContribution: 300,
        expectedReturnPct: 6,
        yearsUntilCollege: 18,
        currentAnnualCost: 30000,
        collegeCostInflationPct: 5,
      },
      ctx,
    ).raw!;
    // invested = 10000 + 300×216 = 74,800
    expect(r.invested).toBe('74800.00');
    expect(num(r.growth)).toBeGreaterThan(0);
    expect(num(r.projected)).toBeGreaterThan(num(r.invested));
    // ~145k projected
    expect(num(r.projected)).toBeGreaterThan(140_000);
    expect(num(r.projected)).toBeLessThan(150_000);
    // inflated 4-year cost ~311k → shortfall (gap negative)
    expect(num(r.fourYearCost)).toBeGreaterThan(300_000);
    expect(num(r.gap)).toBeLessThan(0);
  });

  it('529: omitting cost leaves cost/gap null', () => {
    const r = byId('invest.529').compute(
      { currentSavings: 0, monthlyContribution: 500, expectedReturnPct: 6, yearsUntilCollege: 10 },
      ctx,
    ).raw!;
    expect(r.fourYearCost).toBeNull();
    expect(r.gap).toBeNull();
    expect(num(r.projected)).toBeGreaterThan(60_000); // 500×120 invested + growth
  });
});
