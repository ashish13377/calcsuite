import { describe, it, expect } from 'vitest';
import { taxCalculators } from './tax';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS, regionDefaults } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx, Values } from '../kit';

const US = regionDefaults('US');
const inCtx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const usCtx: CalcCtx = { settings: US, region: 'US', fmt: makeFormatter(US), D };

const run = (id: string, values: Values, ctx: CalcCtx) => {
  const calc = taxCalculators.find((c) => c.id === id);
  if (!calc) throw new Error(`no calculator ${id}`);
  return calc.compute(values, ctx);
};
const raw = (r: ReturnType<typeof run>, k: string) => Number(r.raw![k]);

describe('tax calculators', () => {
  it('GST add 18% on ₹1000 → total 1180, CGST 90 (golden)', () => {
    const r = run('tax.gst', { amount: '1000', gstRatePct: '18', mode: 'add', split: 'intra' }, inCtx);
    expect(raw(r, 'total')).toBeCloseTo(1180, 2);
    expect(raw(r, 'cgst')).toBeCloseTo(90, 2);
    expect(raw(r, 'gst')).toBeCloseTo(180, 2);
  });

  it('GST remove (inclusive) 18% on ₹1180 → base 1000, IGST 180', () => {
    const r = run('tax.gst', { amount: '1180', gstRatePct: '18', mode: 'remove', split: 'inter' }, inCtx);
    expect(raw(r, 'base')).toBeCloseTo(1000, 2);
    expect(raw(r, 'igst')).toBeCloseTo(180, 2);
  });

  it('TDS: bank interest ₹60,000 → 10% = ₹6,000; below threshold or 15G → 0', () => {
    const r = run('tax.tds', { annualInterest: '60000', payerType: 'bank', panAvailable: true }, inCtx);
    expect(raw(r, 'tds')).toBeCloseTo(6000, 2);
    const waived = run('tax.tds', { annualInterest: '60000', payerType: 'bank', form15gh: true }, inCtx);
    expect(raw(waived, 'tds')).toBe(0);
    const under = run('tax.tds', { annualInterest: '30000', payerType: 'bank' }, inCtx);
    expect(raw(under, 'tds')).toBe(0);
    const noPan = run('tax.tds', { annualInterest: '60000', payerType: 'bank', panAvailable: false }, inCtx);
    expect(raw(noPan, 'tds')).toBeCloseTo(12000, 2); // 20%
  });

  it('Income IN new regime gross ₹7,00,000 → tax 0 (golden, 87A rebate)', () => {
    const r = run('tax.incomeIN', { grossIncome: '700000', age: '<60', ded80C: '0', ded80D: '0' }, inCtx);
    expect(raw(r, 'newTax')).toBe(0);
    expect(raw(r, 'tax')).toBe(0);
    expect(r.raw!.cheaper).toBe('new');
  });

  it('Income IN old regime picks up 80C etc.; higher income taxed', () => {
    const r = run('tax.incomeIN', { grossIncome: '2000000', age: '<60', ded80C: '150000', ded80D: '25000' }, inCtx);
    expect(raw(r, 'oldTax')).toBeGreaterThan(0);
    expect(raw(r, 'newTax')).toBeGreaterThan(0);
    expect(raw(r, 'tax')).toBe(Math.min(raw(r, 'oldTax'), raw(r, 'newTax')));
  });

  it('Capital gains: equity LTCG 12.5% over ₹1.25L exemption', () => {
    // gain 400000, exempt 125000 → 275000 × 12.5% = 34375
    const r = run('tax.capitalGains', { assetType: 'equity', buyPrice: '100000', sellPrice: '500000', holdingMonths: 24 }, inCtx);
    expect(raw(r, 'gain')).toBeCloseTo(400000, 2);
    expect(raw(r, 'tax')).toBeCloseTo(34375, 2);
  });

  it('Capital gains: equity STCG 20%', () => {
    const r = run('tax.capitalGains', { assetType: 'equity', buyPrice: '100000', sellPrice: '200000', holdingMonths: 6 }, inCtx);
    expect(raw(r, 'tax')).toBeCloseTo(20000, 2); // 100000 × 20%
  });

  it('HRA exemption = least of the three limits', () => {
    // salary 600000, HRA 240000, rent 300000, metro. rent−10% = 240000; 50% = 300000; HRA 240000 → min 240000
    const r = run('tax.hra', { basicSalary: '600000', hraReceived: '240000', rentPaid: '300000', metro: true }, inCtx);
    expect(raw(r, 'exempt')).toBeCloseTo(240000, 2);
    expect(raw(r, 'taxable')).toBeCloseTo(0, 2);
  });

  it('Advance tax: due = liability − TDS, 4 instalments 15/45/75/100%', () => {
    const r = run('tax.advanceTax', { totalTaxLiability: '120000', tdsAlreadyPaid: '20000' }, inCtx);
    expect(raw(r, 'advanceTaxDue')).toBeCloseTo(100000, 2);
    expect(r.schedule!.rows!.length).toBe(4);
    // first instalment 15% of 100000 = 15000
    expect(r.schedule!.rows![0].cells[2]).toBe(inCtx.fmt.money(15000));
  });

  it('US sales tax: $100 at 6% state + 2% local → $108, tax $8 (US ctx)', () => {
    const r = run('tax.salesTaxUS', { amount: '100', stateRatePct: '6', localRatePct: '2' }, usCtx);
    expect(raw(r, 'total')).toBeCloseTo(108, 2);
    expect(raw(r, 'tax')).toBeCloseTo(8, 2);
  });

  it('US income single std-deduction on $60,000 → taxable 45,400, tax ≈ 5216 (golden)', () => {
    const r = run('tax.incomeUS', { grossIncome: '60000', filingStatus: 'single', deductionMode: 'standard' }, usCtx);
    expect(raw(r, 'taxable')).toBeCloseTo(45400, 2);
    // 1160 (10% of 11600) + 12% of (45400−11600) = 1160 + 4056 = 5216
    expect(Math.abs(raw(r, 'tax') - 5216)).toBeLessThanOrEqual(5);
  });

  it('US mortgage deduction: interest × marginal rate; caps at $750k debt', () => {
    const r = run('tax.mortgageDeductionUS', { annualMortgageInterest: '18000', marginalTaxRatePct: '24' }, usCtx);
    expect(raw(r, 'savings')).toBeCloseTo(4320, 2); // 18000 × 24%
    const capped = run('tax.mortgageDeductionUS', { annualMortgageInterest: '20000', marginalTaxRatePct: '24', loanBalance: '1500000' }, usCtx);
    expect(raw(capped, 'deductibleInterest')).toBeCloseTo(10000, 2); // 20000 × 750k/1.5M
  });

  it('regions are tagged IN or US and all are in the tax group', () => {
    for (const c of taxCalculators) {
      expect(c.group).toBe('tax');
      expect(c.regions === undefined || c.regions.length === 1).toBe(true);
    }
    expect(taxCalculators.map((c) => c.id).sort()).toEqual(
      [
        'tax.advanceTax',
        'tax.capitalGains',
        'tax.gst',
        'tax.hra',
        'tax.incomeIN',
        'tax.incomeUS',
        'tax.mortgageDeductionUS',
        'tax.salesTaxUS',
        'tax.tds',
      ].sort(),
    );
  });
});
