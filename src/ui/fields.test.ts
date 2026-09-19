import { describe, it, expect } from 'vitest';
import { cleanNum } from './fields';

describe('cleanNum — numeric input sanitiser', () => {
  it('strips letters and symbols (the reported bug)', () => {
    expect(cleanNum('12a3')).toBe('123');
    expect(cleanNum('abc')).toBe('');
    expect(cleanNum('₹1,000')).toBe('1000');
    expect(cleanNum('10px')).toBe('10');
  });

  it('keeps a single decimal point, drops extras', () => {
    expect(cleanNum('2.5')).toBe('2.5');
    expect(cleanNum('2.')).toBe('2.'); // partial, still editable
    expect(cleanNum('2.5.3')).toBe('2.53');
    expect(cleanNum('3.14159')).toBe('3.14159');
  });

  it('allows only a single leading minus', () => {
    expect(cleanNum('-5')).toBe('-5');
    expect(cleanNum('1-2')).toBe('12'); // minus not leading → dropped
    expect(cleanNum('--5')).toBe('-5');
  });

  it('integer mode rejects the decimal point', () => {
    expect(cleanNum('12.5', false)).toBe('125');
    expect(cleanNum('20yr', false)).toBe('20');
    expect(cleanNum('', false)).toBe('');
  });
});
