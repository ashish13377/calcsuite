import { Decimal, D, type DecimalT, type Numeric, isZeroish } from './decimal';

// ─────────────────────────── Region model (§4) ───────────────────────────
// Differences are DATA, never `if (region === 'IN')` scattered in the math (§18).

export type Region = 'IN' | 'US';
export type Basis = 'reducing_monthly' | 'flat';
export type SolveTarget = 'payment' | 'principal' | 'rate' | 'tenure';

export interface RegionProfile {
  region: Region;
  currency: 'INR' | 'USD';
  locale: string;
  paymentLabel: string; // 'EMI' | 'Monthly Payment'
  tenureWord: string; // 'Tenure' | 'Term'
  feeWord: string; // 'Processing fee' | 'Origination fee'
  grouping: 'indian' | 'western';
  defaultBasis: Basis;
  defaultRatePct: string;
  defaultTermMonths: number;
  maxRatePct: number;
}

export const REGIONS: Record<Region, RegionProfile> = {
  IN: {
    region: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    paymentLabel: 'EMI',
    tenureWord: 'Tenure',
    feeWord: 'Processing fee',
    grouping: 'indian',
    defaultBasis: 'reducing_monthly',
    defaultRatePct: '8.65',
    defaultTermMonths: 240,
    maxRatePct: 50,
  },
  US: {
    region: 'US',
    currency: 'USD',
    locale: 'en-US',
    paymentLabel: 'Monthly Payment',
    tenureWord: 'Term',
    feeWord: 'Origination fee',
    grouping: 'western',
    defaultBasis: 'reducing_monthly',
    defaultRatePct: '6.5',
    defaultTermMonths: 360,
    maxRatePct: 50,
  },
};

// ─────────────────────────── Errors (§5.4) ───────────────────────────

export type ErrorCode =
  | 'MISSING_SOLVE_TARGET'
  | 'MULTIPLE_SOLVE_TARGETS'
  | 'PAYMENT_BELOW_INTEREST'
  | 'RATE_OUT_OF_RANGE'
  | 'TENURE_OUT_OF_RANGE'
  | 'NEGATIVE_PRINCIPAL'
  | 'SOLVER_DID_NOT_CONVERGE';

export class FinCalcError extends Error {
  code: ErrorCode;
  field?: string;
  constructor(code: ErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'FinCalcError';
    this.code = code;
    this.field = field;
  }
}

// ─────────────────────────── Input / Output ───────────────────────────

export interface LoanInput {
  region: Region;
  basis?: Basis;
  // Exactly one of these four is omitted — that is the solve target.
  principal?: Numeric;
  annualRatePct?: Numeric;
  tenureMonths?: number;
  payment?: Numeric;
}

export interface AmortRow {
  month: number;
  openingBalance: DecimalT;
  payment: DecimalT;
  principal: DecimalT;
  interest: DecimalT;
  closingBalance: DecimalT;
  cumulativeInterest: DecimalT;
}

export interface YearSummary {
  year: number; // 1-based
  months: AmortRow[];
  principal: DecimalT;
  interest: DecimalT;
  payment: DecimalT;
  closingBalance: DecimalT;
}

export interface LoanResult {
  solvedFor: SolveTarget;
  basis: Basis;
  region: Region;
  principal: DecimalT;
  annualRatePct: DecimalT;
  tenureMonths: number;
  payment: DecimalT; // P&I
  totalInterest: DecimalT;
  totalPayment: DecimalT;
  schedule: AmortRow[];
  byYear: YearSummary[];
  chart: { balance: DecimalT[]; cumulativeInterest: DecimalT[] };
  /** Flat-rate loans only: the equivalent reducing-balance rate (§4.5). */
  equivalentReducingRatePct?: DecimalT;
  formula: string;
}

const MONEY = 2;
const round = (d: DecimalT) => d.toDecimalPlaces(MONEY, Decimal.ROUND_HALF_UP);

// periodic (monthly) rate from an annual percentage
const periodic = (annualRatePct: DecimalT) => annualRatePct.div(100).div(12);

// PMT = P·r·(1+r)^n / ((1+r)^n − 1);  r=0 → P/n  (§4.5)
function paymentFor(P: DecimalT, r: DecimalT, n: number): DecimalT {
  if (isZeroish(r)) return P.div(n);
  const g = r.plus(1).pow(n);
  return P.times(r).times(g).div(g.minus(1));
}

// P = PMT·((1+r)^n − 1)/(r·(1+r)^n);  r=0 → PMT·n
function principalFor(PMT: DecimalT, r: DecimalT, n: number): DecimalT {
  if (isZeroish(r)) return PMT.times(n);
  const g = r.plus(1).pow(n);
  return PMT.times(g.minus(1)).div(r.times(g));
}

// n = ln(PMT/(PMT − P·r)) / ln(1+r) (§4.5). Throws when the loan never amortises.
function tenureFor(P: DecimalT, r: DecimalT, PMT: DecimalT): number {
  if (isZeroish(r)) return Math.ceil(P.div(PMT).toNumber());
  const interest0 = P.times(r);
  if (PMT.lte(interest0)) {
    throw new FinCalcError(
      'PAYMENT_BELOW_INTEREST',
      'The payment is not larger than the first month’s interest, so the loan never reduces.',
      'payment',
    );
  }
  const n = Decimal.ln(PMT.div(PMT.minus(interest0))).div(Decimal.ln(r.plus(1)));
  return Math.ceil(n.toNumber());
}

// Solve annual-rate% by bisection on [0, maxRatePct] — payment is monotonic in rate,
// so bisection always converges (§4.5, bisection fallback). Lazy and robust.
function rateFor(P: DecimalT, n: number, PMT: DecimalT, maxRatePct: number): DecimalT {
  if (PMT.times(n).lte(P)) {
    // payment can't even cover principal → rate would be negative
    throw new FinCalcError('RATE_OUT_OF_RANGE', 'Payment is too low to repay this amount.', 'payment');
  }
  let lo = D(0);
  let hi = D(maxRatePct);
  for (let i = 0; i < 200; i++) {
    const mid = lo.plus(hi).div(2);
    const pmt = paymentFor(P, periodic(mid), n);
    if (isZeroish(pmt.minus(PMT), '1e-8')) return mid;
    if (pmt.lt(PMT)) lo = mid;
    else hi = mid;
  }
  const mid = lo.plus(hi).div(2);
  if (mid.gte(maxRatePct - 0.0001)) {
    throw new FinCalcError('SOLVER_DID_NOT_CONVERGE', 'Could not find a rate within the allowed range.', 'rate');
  }
  return mid;
}

// Full amortisation schedule. Final row absorbs rounding drift (residual on last, §3.2).
function buildSchedule(P: DecimalT, r: DecimalT, n: number, PMT: DecimalT): AmortRow[] {
  const rows: AmortRow[] = [];
  let balance = P;
  let cumInterest = D(0);
  for (let m = 1; m <= n; m++) {
    const opening = balance;
    const interest = round(opening.times(r));
    let principal: DecimalT;
    let payment: DecimalT;
    if (m === n) {
      // last instalment clears the balance exactly
      principal = opening;
      payment = round(opening.plus(interest));
    } else {
      payment = PMT;
      principal = payment.minus(interest);
      if (principal.gt(opening)) {
        principal = opening;
        payment = round(opening.plus(interest));
      }
    }
    balance = opening.minus(principal);
    cumInterest = cumInterest.plus(interest);
    rows.push({
      month: m,
      openingBalance: round(opening),
      payment,
      principal: round(principal),
      interest,
      closingBalance: round(balance),
      cumulativeInterest: round(cumInterest),
    });
    if (balance.lte(0)) break;
  }
  return rows;
}

function groupByYear(rows: AmortRow[]): YearSummary[] {
  const years: YearSummary[] = [];
  for (const row of rows) {
    const y = Math.ceil(row.month / 12);
    let bucket = years[y - 1];
    if (!bucket) {
      bucket = { year: y, months: [], principal: D(0), interest: D(0), payment: D(0), closingBalance: D(0) };
      years[y - 1] = bucket;
    }
    bucket.months.push(row);
    bucket.principal = bucket.principal.plus(row.principal);
    bucket.interest = bucket.interest.plus(row.interest);
    bucket.payment = bucket.payment.plus(row.payment);
    bucket.closingBalance = row.closingBalance;
  }
  return years;
}

// ─────────────────────────── Public solve (§4.3) ───────────────────────────

export function solve(input: LoanInput): LoanResult {
  const profile = REGIONS[input.region];
  const basis = input.basis ?? profile.defaultBasis;

  // Keyed by SolveTarget (semantic names), not the input field names — the switch below
  // matches on these, so 'rate'/'tenure' must be the keys, not 'annualRatePct'/'tenureMonths'.
  const given: Record<SolveTarget, boolean> = {
    payment: input.payment != null,
    principal: input.principal != null,
    rate: input.annualRatePct != null,
    tenure: input.tenureMonths != null,
  };
  const missing = (Object.keys(given) as SolveTarget[]).filter((k) => !given[k]);
  if (missing.length === 0) throw new FinCalcError('MULTIPLE_SOLVE_TARGETS', 'Leave exactly one field blank to solve for it.');
  if (missing.length > 1)
    throw new FinCalcError('MISSING_SOLVE_TARGET', 'Fill three of the four fields; the fourth is calculated.');
  const solvedFor = missing[0]!;

  // Normalise the three provided values.
  let P = input.principal != null ? D(input.principal) : D(0);
  let ratePct = input.annualRatePct != null ? D(input.annualRatePct) : D(0);
  let n = input.tenureMonths ?? 0;
  let PMT = input.payment != null ? D(input.payment) : D(0);

  if (input.principal != null && P.lt(0)) throw new FinCalcError('NEGATIVE_PRINCIPAL', 'Amount cannot be negative.', 'principal');
  if (input.annualRatePct != null && (ratePct.lt(0) || ratePct.gt(profile.maxRatePct)))
    throw new FinCalcError('RATE_OUT_OF_RANGE', `Enter a rate between 0 and ${profile.maxRatePct}.`, 'annualRatePct');
  if (input.tenureMonths != null && (n < 1 || !Number.isInteger(n)))
    throw new FinCalcError('TENURE_OUT_OF_RANGE', 'Enter a whole number of months, 1 or more.', 'tenureMonths');

  let equivalentReducingRatePct: DecimalT | undefined;
  let formula: string;

  if (basis === 'flat') {
    // Flat rate: interest on the original principal for the whole term (§4.5, IN).
    // Solve-for is limited to payment/principal/tenure here; rate is derived directly.
    const years = D(n).div(12);
    if (solvedFor === 'payment') {
      const totalInterest = P.times(ratePct).div(100).times(years);
      PMT = round(P.plus(totalInterest).div(n));
    } else if (solvedFor === 'principal') {
      // PMT = (P + P·rate·years)/n  →  P = PMT·n / (1 + rate·years)
      P = PMT.times(n).div(D(1).plus(ratePct.div(100).times(years)));
    } else if (solvedFor === 'tenure') {
      throw new FinCalcError('MISSING_SOLVE_TARGET', 'Flat-rate loans need an explicit tenure.', 'tenureMonths');
    } else {
      throw new FinCalcError('MISSING_SOLVE_TARGET', 'Flat-rate loans need an explicit rate.', 'annualRatePct');
    }
    // Show the equivalent reducing-balance rate — a real user service (§4.5).
    equivalentReducingRatePct = rateFor(P, n, PMT, profile.maxRatePct);
    formula = 'Flat: interest = P × rate × years;  EMI = (P + interest) / n';
  } else {
    const r = () => periodic(ratePct);
    switch (solvedFor) {
      case 'payment':
        PMT = round(paymentFor(P, r(), n));
        formula = 'PMT = P·r·(1+r)^n / ((1+r)^n − 1)';
        break;
      case 'principal':
        P = principalFor(PMT, r(), n);
        formula = 'P = PMT·((1+r)^n − 1) / (r·(1+r)^n)';
        break;
      case 'tenure':
        n = tenureFor(P, r(), PMT);
        formula = 'n = ln(PMT / (PMT − P·r)) / ln(1 + r)';
        break;
      case 'rate':
        ratePct = rateFor(P, n, PMT, profile.maxRatePct);
        formula = 'solve r: PMT = P·r·(1+r)^n / ((1+r)^n − 1)';
        break;
    }
  }

  // Recompute the exact instalment used to drive the schedule (reducing basis).
  const rMonthly = periodic(ratePct);
  const drivingPMT = basis === 'flat' ? PMT : round(paymentFor(P, rMonthly, n));
  const schedule = buildSchedule(P, rMonthly, n, drivingPMT);
  n = schedule.length; // tenure solve may land a month early/late; trust the schedule

  const totalInterest = schedule.reduce((s, row) => s.plus(row.interest), D(0));
  const totalPayment = schedule.reduce((s, row) => s.plus(row.payment), D(0));

  return {
    solvedFor,
    basis,
    region: input.region,
    principal: round(P),
    annualRatePct: ratePct.toDecimalPlaces(6, Decimal.ROUND_HALF_UP),
    tenureMonths: n,
    payment: drivingPMT,
    totalInterest: round(totalInterest),
    totalPayment: round(totalPayment),
    schedule,
    byYear: groupByYear(schedule),
    chart: {
      balance: schedule.map((row) => row.closingBalance),
      cumulativeInterest: schedule.map((row) => row.cumulativeInterest),
    },
    equivalentReducingRatePct: equivalentReducingRatePct?.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    formula,
  };
}
