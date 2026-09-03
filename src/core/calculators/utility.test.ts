import { describe, it, expect } from 'vitest';
import { utilityCalculators } from './utility';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx, Values } from '../kit';

const ctx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const run = (id: string, values: Values) => {
  const calc = utilityCalculators.find((c) => c.id === id);
  if (!calc) throw new Error(`no calculator ${id}`);
  return calc.compute(values, ctx);
};
const raw = (r: ReturnType<typeof run>, k: string) => Number(r.raw![k]);

describe('utility calculators', () => {
  it('units: 1 acre → 4046.86 sqm (±0.1)', () => {
    const r = run('tools.units', { value: '1', category: 'area', areaFrom: 'acre', areaTo: 'sqm' });
    expect(Math.abs(raw(r, 'result') - 4046.86)).toBeLessThanOrEqual(0.1);
  });

  it('units: 100 °C → 212 °F', () => {
    const r = run('tools.units', { value: '100', category: 'temperature', temperatureFrom: 'C', temperatureTo: 'F' });
    expect(raw(r, 'result')).toBeCloseTo(212, 6);
  });

  it('units: 1 km → 1000 m', () => {
    const r = run('tools.units', { value: '1', category: 'length', lengthFrom: 'km', lengthTo: 'm' });
    expect(raw(r, 'result')).toBeCloseTo(1000, 6);
  });

  it('dateCalc difference: Jan 1 → Jan 31 = 30 days', () => {
    const r = run('tools.dateCalc', { mode: 'difference', startDate: '2024-01-01', endDate: '2024-01-31' });
    expect(raw(r, 'totalDays')).toBe(30);
    expect(raw(r, 'businessDays')).toBeGreaterThan(0);
  });

  it('dateCalc add: Jan 1 + 1 month = Feb 1', () => {
    const r = run('tools.dateCalc', { mode: 'addSubtract', startDate: '2024-01-01', count: 1, unit: 'months', direction: 'add' });
    expect(r.raw!.resultDate).toBe('2024-02-01');
  });

  it('numToWords: 1234567 indian golden phrase', () => {
    const r = run('tools.numToWords', { amount: '1234567', scale: 'indian', cheque: false });
    expect(r.primary.value).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    expect(r.raw!.words).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
  });

  it('numToWords: western + cheque format with paise', () => {
    const r = run('tools.numToWords', { amount: '1234567.56', scale: 'western', cheque: true });
    expect(r.primary.value).toContain('One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven');
    expect(r.primary.value).toContain('Fifty Six Paise');
    expect(r.primary.value.startsWith('Rupees')).toBe(true);
    expect(r.primary.value.endsWith('Only')).toBe(true);
    expect(raw(r, 'fraction')).toBe(56);
  });

  it('every calculator is in the tools group', () => {
    for (const c of utilityCalculators) expect(c.group).toBe('tools');
  });
});
