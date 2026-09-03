import { Decimal, D, type DecimalT, type Numeric, isZeroish } from './decimal';

// Decimal-based time-value-of-money primitives shared across calculators.
// Never introduce a JS Number into a compounding loop (§1.1).

export const periodic = (annualPct: Numeric, perYear = 12): DecimalT => D(annualPct).div(100).div(perYear);

/** Future value of a level annuity of PMT per period at rate r for n periods. */
export function fvAnnuity(PMT: Numeric, r: Numeric, n: number, due = false): DecimalT {
  const rate = D(r);
  const p = D(PMT);
  if (isZeroish(rate)) return p.times(n);
  const g = rate.plus(1).pow(n);
  let fv = p.times(g.minus(1)).div(rate);
  if (due) fv = fv.times(rate.plus(1));
  return fv;
}

/** Future value of a single lump sum. */
export function fvLump(PV: Numeric, r: Numeric, n: number): DecimalT {
  return D(PV).times(D(r).plus(1).pow(n));
}

/** Present value of a level annuity. */
export function pvAnnuity(PMT: Numeric, r: Numeric, n: number, due = false): DecimalT {
  const rate = D(r);
  const p = D(PMT);
  if (isZeroish(rate)) return p.times(n);
  const g = rate.plus(1).pow(n);
  let pv = p.times(D(1).minus(g.pow(-1))).div(rate);
  if (due) pv = pv.times(rate.plus(1));
  return pv;
}

/** Present value of a single future amount. */
export function pvLump(FV: Numeric, r: Numeric, n: number): DecimalT {
  return D(FV).div(D(r).plus(1).pow(n));
}

/** Level payment that amortises PV to FV over n periods. */
export function pmt(PV: Numeric, r: Numeric, n: number, FV: Numeric = 0, due = false): DecimalT {
  const rate = D(r);
  if (isZeroish(rate)) return D(PV).plus(FV).div(n);
  const g = rate.plus(1).pow(n);
  let p = D(PV).times(g).plus(FV).times(rate).div(g.minus(1));
  if (due) p = p.div(rate.plus(1));
  return p;
}

/** Number of periods to amortise PV at PMT and rate r. */
export function nper(PV: Numeric, PMT: Numeric, r: Numeric): DecimalT {
  const rate = D(r);
  const pv = D(PV);
  const p = D(PMT);
  if (isZeroish(rate)) return pv.div(p);
  // n = ln(PMT / (PMT − PV·r)) / ln(1+r)
  return Decimal.ln(p.div(p.minus(pv.times(rate)))).div(Decimal.ln(rate.plus(1)));
}

/** Generic monotonic-in-rate bisection: find rate in [lo,hi] where f(rate)=0. */
export function bisectRate(f: (r: DecimalT) => DecimalT, lo = -0.9999, hi = 100, iters = 200): DecimalT | null {
  let a = D(lo);
  let b = D(hi);
  let fa = f(a);
  let fb = f(b);
  if (fa.times(fb).gt(0)) return null; // no sign change → no bracketed root
  for (let i = 0; i < iters; i++) {
    const mid = a.plus(b).div(2);
    const fm = f(mid);
    if (isZeroish(fm, '1e-10')) return mid;
    if (fa.times(fm).lt(0)) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return a.plus(b).div(2);
}

/** NPV of periodic cashflows (cf[0] at t=0). */
export function npv(rate: Numeric, cashflows: Numeric[]): DecimalT {
  const r = D(rate);
  let acc = D(0);
  for (let t = 0; t < cashflows.length; t++) {
    acc = acc.plus(D(cashflows[t]!).div(r.plus(1).pow(t)));
  }
  return acc;
}

/** IRR of periodic cashflows via bracketed bisection. Returns a fraction (0.1 = 10%). */
export function irr(cashflows: Numeric[]): DecimalT | null {
  return bisectRate((r) => npv(r, cashflows));
}

export interface DatedFlow {
  date: string; // ISO yyyy-mm-dd
  amount: Numeric;
}

const dayDiff = (a: string, b: string): number => {
  const ms = Date.parse(b) - Date.parse(a);
  return ms / 86400000;
};

/** XNPV: net present value of irregular dated cashflows, ACT/365. */
export function xnpv(rate: Numeric, flows: DatedFlow[]): DecimalT {
  const r = D(rate);
  const t0 = flows[0]!.date;
  let acc = D(0);
  for (const f of flows) {
    const years = D(dayDiff(t0, f.date)).div(365);
    acc = acc.plus(D(f.amount).div(r.plus(1).pow(years)));
  }
  return acc;
}

/** XIRR: annualised return of irregular dated cashflows. Fraction (0.12 = 12%). */
export function xirr(flows: DatedFlow[]): DecimalT | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return bisectRate((r) => xnpv(r, sorted), -0.9999, 100);
}

/** CAGR from begin/end value over years. Fraction. */
export function cagr(begin: Numeric, end: Numeric, years: Numeric): DecimalT {
  return D(end).div(begin).pow(D(1).div(years)).minus(1);
}
