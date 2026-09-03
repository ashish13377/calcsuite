import DecimalBase from 'decimal.js';

// Configured clone so a host app that also uses decimal.js is unaffected (§3.1).
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
  toExpPos: 60,
  toExpNeg: -60,
  modulo: DecimalBase.ROUND_DOWN,
});

export type DecimalT = InstanceType<typeof Decimal>;
export type Numeric = string | number | DecimalT;

export const D = (v: Numeric): DecimalT => new Decimal(v);

// Never compare Decimals with === (§3.3).
export const eq = (a: Numeric, b: Numeric) => D(a).eq(b);
export const gt = (a: Numeric, b: Numeric) => D(a).gt(b);
export const lt = (a: Numeric, b: Numeric) => D(a).lt(b);
export const isZeroish = (d: DecimalT, epsilon = '1e-9') => d.abs().lt(epsilon);
