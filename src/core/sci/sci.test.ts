import { describe, it, expect } from 'vitest';
import { evalExpression } from './index';

const n = (s: string, opts?: Parameters<typeof evalExpression>[1]) => {
  const r = evalExpression(s, opts);
  expect(r.error, `${s} → ${r.error}`).toBeUndefined();
  return r.value.toNumber();
};

describe('scientific expression engine', () => {
  it('operator precedence', () => expect(n('2+3*4')).toBe(14));
  it('implicit multiplication', () => expect(n('2(3+4)')).toBe(14));
  it('power (right-assoc)', () => {
    expect(n('2^10')).toBe(1024);
    expect(n('2^3^2')).toBe(512); // 2^(3^2)
  });
  it('sin in degrees', () => expect(n('sin(30)', { angleMode: 'deg' })).toBeCloseTo(0.5, 10));
  it('factorial', () => expect(n('5!')).toBe(120));
  it('nCr', () => expect(n('nCr(5,2)')).toBe(10));
  it('gcd', () => expect(n('gcd(12,18)')).toBe(6));
  it('percent of-mode', () => expect(n('200+10%', { percentMode: 'of' })).toBe(220));
  it('log base 10', () => expect(n('log(1000)')).toBe(3));
  it('hex literal', () => expect(n('0xFF')).toBe(255));

  // extra coverage for the parser/evaluator corners
  it('unary minus + power', () => expect(n('-2^2')).toBe(-4));
  it('nested implicit + constants', () => expect(n('2pi', { angleMode: 'rad' })).toBeCloseTo(6.283185307, 6));
  it('auto-close parens', () => expect(n('sqrt(9')).toBe(3));
  it('grad mode sin', () => expect(n('sin(100)', { angleMode: 'grad' })).toBeCloseTo(1, 10));
  it('nPr / lcm / mod', () => {
    expect(n('nPr(5,2)')).toBe(20);
    expect(n('lcm(4,6)')).toBe(12);
    expect(n('mod(10,3)')).toBe(1);
    expect(n('10 % 3', { percentMode: 'modulo' })).toBe(1);
  });
  it('bitwise in hex base', () => {
    expect(n('0xF0 or 0x0F')).toBe(255);
    expect(n('0xFF and 0x0F')).toBe(15);
    expect(n('1 << 4')).toBe(16);
  });
  it('ans wiring', () => expect(n('ans*2', { ans: 21 })).toBe(42));
  it('reports errors instead of throwing', () => {
    const r = evalExpression('2+');
    expect(r.error).toBeDefined();
  });
});
