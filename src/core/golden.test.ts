import { describe, it, expect } from 'vitest';
import { solve } from './loan';
import { fvAnnuity, xirr } from './finance';
import { D } from './decimal';

// §14 golden-value regression — reference figures from published bank/official calculators.
// Tolerance: ≤ ₹1 / ≤ $0.01 on totals; exact on per-lakh instalments where the source is exact.

const emiPerLakh = (annualPct: string, months: number) =>
  solve({ region: 'IN', principal: '100000', annualRatePct: annualPct, tenureMonths: months }).payment.toNumber();

describe('golden values — India loans', () => {
  // Standard EMI per ₹1 lakh, cross-checked against SBI/HDFC/ICICI published EMI charts.
  it('8.50% / 20y → ₹867.82 per lakh', () => expect(emiPerLakh('8.5', 240)).toBeCloseTo(867.82, 1));
  it('9.00% / 30y → ₹804.62 per lakh', () => expect(emiPerLakh('9', 360)).toBeCloseTo(804.62, 1));
  it('7.00% / 15y → ₹898.83 per lakh', () => expect(emiPerLakh('7', 180)).toBeCloseTo(898.83, 1));

  it('25L @ 8.65% / 20y = ₹21,933.51 (₹877.34/lakh)', () => {
    const r = solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 });
    expect(r.payment.toNumber()).toBeCloseTo(21933.51, 1);
  });
});

describe('golden values — US mortgage', () => {
  // $300,000 @ 6.5% / 30y → $1,896.20 monthly P&I (Freddie Mac / bankrate references).
  it('$300k @ 6.5% / 30y → $1,896.20', () => {
    const r = solve({ region: 'US', principal: '300000', annualRatePct: '6.5', tenureMonths: 360 });
    expect(r.payment.toNumber()).toBeCloseTo(1896.2, 1);
  });
});

describe('golden values — investments', () => {
  // SIP ₹10,000/mo @12% for 10y (annuity-due) → ≈ ₹23,23,391.
  it('SIP 10k/mo @12% 120mo ≈ ₹23.23 L', () => {
    const fv = fvAnnuity('10000', D('12').div(1200), 120, true).toNumber();
    expect(fv).toBeGreaterThan(2_310_000);
    expect(fv).toBeLessThan(2_335_000);
  });

  // XIRR cross-checked against Excel/Sheets: -10000 (2020-01-01), +12000 (2021-01-01) ≈ 20%.
  it('XIRR one-year 20% gain ≈ 20%', () => {
    const r = xirr([
      { date: '2020-01-01', amount: '-10000' },
      { date: '2021-01-01', amount: '12000' },
    ])!;
    expect(r.times(100).toNumber()).toBeCloseTo(20, 0);
  });
});
