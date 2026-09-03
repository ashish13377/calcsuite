import { describe, it, expect } from 'vitest';
import { solve } from './loan';
import { D } from './decimal';

describe('loan engine', () => {
  it('matches the standard EMI (25L @ 8.65% for 240 mo = ₹21,933.51, ₹877.34/lakh)', () => {
    const r = solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 });
    expect(r.solvedFor).toBe('payment');
    expect(Number(r.payment.toFixed(2))).toBeCloseTo(21933.51, 1);
  });

  it('schedule invariants: final balance is 0 and principal sums to loan', () => {
    const r = solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 });
    const last = r.schedule[r.schedule.length - 1]!;
    expect(last.closingBalance.toNumber()).toBe(0);
    const sumPrincipal = r.schedule.reduce((s, row) => s.plus(row.principal), D(0));
    // within a rupee of the financed principal (rounding residual)
    expect(sumPrincipal.minus(r.principal).abs().toNumber()).toBeLessThanOrEqual(1);
    // total = principal + interest
    expect(r.totalPayment.minus(r.principal.plus(r.totalInterest)).abs().toNumber()).toBeLessThanOrEqual(1);
  });

  it('round-trips: solve payment, then feed it back to recover the rate', () => {
    const a = solve({ region: 'IN', principal: '1000000', annualRatePct: '10', tenureMonths: 120 });
    const b = solve({ region: 'IN', principal: '1000000', payment: a.payment.toString(), tenureMonths: 120 });
    expect(Number(b.annualRatePct.toFixed(2))).toBeCloseTo(10, 1);
  });

  it('r = 0 amortises linearly', () => {
    const r = solve({ region: 'US', principal: '1200', annualRatePct: '0', tenureMonths: 12 });
    expect(r.payment.toNumber()).toBe(100);
    expect(r.totalInterest.toNumber()).toBe(0);
  });

  it('flat-rate surfaces a higher equivalent reducing rate', () => {
    const r = solve({ region: 'IN', basis: 'flat', principal: '500000', annualRatePct: '10', tenureMonths: 60 });
    expect(r.equivalentReducingRatePct!.toNumber()).toBeGreaterThan(17);
  });

  it('throws when payment cannot cover interest', () => {
    expect(() => solve({ region: 'IN', principal: '1000000', payment: '100', annualRatePct: '10' })).toThrow();
  });
});
