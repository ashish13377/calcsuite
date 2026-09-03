import { describe, it, expect } from 'vitest';
import { investmentCalculators } from './investments';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx, Values } from '../kit';

const ctx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const run = (id: string, values: Values) => {
  const calc = investmentCalculators.find((c) => c.id === id);
  if (!calc) throw new Error(`no calculator ${id}`);
  return calc.compute(values, ctx);
};
const raw = (r: ReturnType<typeof run>, k: string) => Number(r.raw![k]);

describe('investment calculators', () => {
  it('SIP ₹10,000/mo @12% for 120 months → maturity ≈ ₹23.2 lakh (golden)', () => {
    const r = run('invest.sip', { monthlyAmount: '10000', expectedReturnPct: '12', tenure: 120 });
    expect(raw(r, 'maturity')).toBeGreaterThan(2.28e6);
    expect(raw(r, 'maturity')).toBeLessThan(2.35e6);
    expect(raw(r, 'invested')).toBeCloseTo(1200000, 0); // 10000 × 120
    expect(raw(r, 'gains')).toBeGreaterThan(0);
  });

  it('Step-up SIP beats a flat SIP of the same starting amount', () => {
    const flat = run('invest.sip', { monthlyAmount: '10000', expectedReturnPct: '12', tenure: 120 });
    const step = run('invest.stepupSip', { monthlyAmount: '10000', annualStepPct: '10', returnPct: '12', tenure: 120 });
    expect(raw(step, 'maturity')).toBeGreaterThan(raw(flat, 'maturity'));
    expect(raw(step, 'invested')).toBeGreaterThan(raw(flat, 'invested'));
  });

  it('Lump sum ₹1,00,000 @12% annual for 10 yrs ≈ ₹3.11 lakh', () => {
    const r = run('invest.lumpsum', { principal: '100000', ratePct: '12', years: 10, compounding: 'annual' });
    expect(raw(r, 'maturity')).toBeCloseTo(310585, -2); // 100000·1.12^10
    expect(raw(r, 'cagr')).toBeCloseTo(12, 1);
  });

  it('SWP: a corpus that outpaces withdrawals survives and keeps a balance', () => {
    const r = run('invest.swp', { corpus: '5000000', withdrawalPerMonth: '20000', expectedReturnPct: '8', tenureMonths: 120 });
    expect(raw(r, 'finalBalance')).toBeGreaterThan(0);
    expect(raw(r, 'totalWithdrawn')).toBeCloseTo(2400000, 0); // 20000 × 120
    expect(r.raw!.depletionMonth).toBeNull();
  });

  it('SWP: over-withdrawing depletes the corpus and reports the month', () => {
    const r = run('invest.swp', { corpus: '1000000', withdrawalPerMonth: '50000', expectedReturnPct: '8' });
    expect(r.raw!.depletionMonth).not.toBeNull();
    expect(Number(r.raw!.depletionMonth)).toBeGreaterThan(0);
  });

  it('Goal: required SIP funds the inflation-adjusted target', () => {
    const r = run('invest.goal', { targetCorpus: '10000000', years: 15, expectedReturnPct: '12', inflationPct: '6', existingSavings: '0' });
    expect(raw(r, 'requiredMonthly')).toBeGreaterThan(0);
    expect(raw(r, 'inflatedTarget')).toBeGreaterThan(10000000); // inflated above today's cost
  });

  it('every calculator is in the invest group', () => {
    for (const c of investmentCalculators) expect(c.group).toBe('invest');
  });
});
