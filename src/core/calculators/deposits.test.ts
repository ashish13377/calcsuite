import { describe, it, expect } from 'vitest';
import { depositCalculators } from './deposits';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx, Values } from '../kit';

const ctx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const run = (id: string, values: Values) => {
  const calc = depositCalculators.find((c) => c.id === id);
  if (!calc) throw new Error(`no calculator ${id}`);
  return calc.compute(values, ctx);
};
const raw = (r: ReturnType<typeof run>, k: string) => Number(r.raw![k]);

describe('deposit calculators', () => {
  it('FD ₹1,00,000 @7% quarterly for 5 years ≈ ₹1,41,478', () => {
    const r = run('invest.fd', { principal: '100000', annualRatePct: '7', tenure: 60, compounding: 'quarterly', payout: 'cumulative' });
    expect(Math.abs(raw(r, 'maturity') - 141478)).toBeLessThanOrEqual(50);
  });

  it('FD payout mode returns the principal and pays simple interest', () => {
    const r = run('invest.fd', { principal: '100000', annualRatePct: '7', tenure: 60, payout: 'payout' });
    expect(raw(r, 'maturity')).toBeCloseTo(100000, 0); // principal returned
    expect(raw(r, 'interest')).toBeCloseTo(35000, 0); // 100000·7%·5
  });

  it('RD warns when tenure is not a multiple of 3 and beats the amount invested', () => {
    const r = run('invest.rd', { monthlyDeposit: '5000', annualRatePct: '7', tenureMonths: 13 });
    expect(r.warnings?.length).toBeGreaterThan(0);
    expect(raw(r, 'maturity')).toBeGreaterThan(raw(r, 'invested'));
  });

  it('PPF ₹1,50,000/yr @7.1% for 15 yrs ≈ ₹40.68 lakh', () => {
    const r = run('invest.ppf', { yearlyDeposit: '150000', annualRatePct: '7.1', tenureYears: '15' });
    expect(Math.abs(raw(r, 'maturity') - 4068000)).toBeLessThanOrEqual(20000);
  });

  it('NPS builds a corpus, splits off ≥40% to an annuity and pays a pension', () => {
    const r = run('invest.nps', { monthlyContribution: '5000', annualReturnPct: '10', currentAge: 30, retirementAge: 60, annuityPurchasePct: '40' });
    expect(raw(r, 'corpus')).toBeGreaterThan(raw(r, 'invested'));
    expect(raw(r, 'lumpSum')).toBeCloseTo(raw(r, 'corpus') * 0.6, -1);
    expect(raw(r, 'monthlyPension')).toBeGreaterThan(0);
  });

  it('NPS clamps annuity share to the 40% minimum and warns', () => {
    const r = run('invest.nps', { monthlyContribution: '5000', currentAge: 30, retirementAge: 60, annuityPurchasePct: '20' });
    expect(r.warnings?.length).toBeGreaterThan(0);
    expect(raw(r, 'lumpSum')).toBeCloseTo(raw(r, 'corpus') * 0.6, -1);
  });

  it('EPF corpus exceeds total contributions', () => {
    const r = run('invest.epf', { basicMonthlySalary: '25000', currentAge: 30, retirementAge: 58 });
    expect(raw(r, 'corpus')).toBeGreaterThan(raw(r, 'contributions'));
  });

  it('SSY: 15 yrs of deposits, maturity value beats the amount invested', () => {
    const r = run('invest.ssy', { yearlyDeposit: '150000', annualRatePct: '8.2', girlAge: 5 });
    expect(raw(r, 'invested')).toBeCloseTo(2250000, 0); // 15 × 1.5L
    expect(raw(r, 'maturity')).toBeGreaterThan(raw(r, 'invested'));
  });

  it('every calculator is IN-region and in the invest group', () => {
    for (const c of depositCalculators) {
      expect(c.regions).toEqual(['IN']);
      expect(c.group).toBe('invest');
    }
  });
});
