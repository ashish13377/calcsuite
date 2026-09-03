import { describe, it, expect } from 'vitest';
import { convert, inverseRate, formatCurrency, currencyDecimals, stalenessLabel, isStale, currencyByCode } from './currency';

describe('currency core (offline)', () => {
  it('converts exactly (Decimal, no float drift)', () => {
    expect(convert('100', '83').toString()).toBe('8300');
    expect(convert('0.1', '0.2').toString()).toBe('0.02'); // not 0.020000000000000004
  });

  it('inverse rate is 1/rate, 0 when rate is not positive', () => {
    expect(inverseRate('83').toDecimalPlaces(8).toString()).toBe('0.01204819');
    expect(inverseRate('0').toString()).toBe('0');
  });

  it('formats with correct ISO 4217 decimals', () => {
    expect(formatCurrency('1234.5', 'JPY')).not.toMatch(/\./); // JPY has 0 decimals
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(currencyDecimals('USD')).toBe(2);
    expect(formatCurrency('1234567', 'INR')).toContain('12,34,567'); // Indian grouping
  });

  it('staleness: fresh vs a week old', () => {
    const now = 1_000_000_000_000;
    expect(stalenessLabel(now - 10_000, now)).toBe('just now');
    expect(stalenessLabel(now - 7 * 86400000, now)).toBe('7 days ago');
    expect(isStale(now - 10_000, now)).toBe(false);
    expect(isStale(now - 2 * 86400000, now)).toBe(true);
  });

  it('has a real currency table', () => {
    expect(currencyByCode('USD')?.name).toBe('US Dollar');
    expect(currencyByCode('XYZ')).toBeUndefined();
  });
});
