import { describe, it, expect } from 'vitest';
import { loanCalculators } from './loans';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS, regionDefaults } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx } from '../kit';

const ctx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const usSettings = regionDefaults('US');
const ctxUS: CalcCtx = { settings: usSettings, region: 'US', fmt: makeFormatter(usSettings), D };

const byId = Object.fromEntries(loanCalculators.map((c) => [c.id, c]));
const run = (id: string, values: Record<string, any>, c = ctx) => byId[id]!.compute(values, c);

describe('loan calculators — ids', () => {
  it('exports all eight §6.1 defs', () => {
    expect(loanCalculators.map((c) => c.id).sort()).toEqual(
      ['loan.compare', 'loan.eligibility', 'loan.moratorium', 'loan.overdraft', 'loan.prepay', 'loan.refinance', 'loan.stepEmi', 'loan.transfer'].sort(),
    );
  });
});

describe('loan.compare', () => {
  it('picks the cheaper of two loans by total outflow', () => {
    const r = run('loan.compare', { count: '2', p1: '2500000', r1: 9, t1: 240, p2: '2500000', r2: 8.65, t2: 240 });
    expect(r.raw!.cheapestByTotal).toBe(2);
    expect(Number(r.raw!.total1)).toBeGreaterThan(Number(r.raw!.total2));
    expect(Number(r.raw!.emi2)).toBeGreaterThan(0);
  });
  it('flags when cheapest-by-rate differs from cheapest-by-total', () => {
    // Loan1 lower rate but 30y; Loan2 higher rate but 10y → Loan2 wins on total.
    const r = run('loan.compare', { count: '2', p1: '2500000', r1: 8, t1: 360, p2: '2500000', r2: 9, t2: 120 });
    expect(r.raw!.cheapestByRate).toBe(1);
    expect(r.raw!.cheapestByTotal).toBe(2);
    expect(r.notes!.some((n) => n.toLowerCase().includes('differ'))).toBe(true);
  });
});

describe('loan.prepay', () => {
  it('25L/8.65%/240 + 5L prepay at month 13 saves positive, sane interest and cuts months', () => {
    const r = run('loan.prepay', {
      principal: '2500000', ratePct: 8.65, tenureMonths: 240,
      prepayAmount: '500000', prepayStartMonth: 13, recurring: false, adjust: 'reduceTenure', penaltyPct: 0,
    });
    const saved = Number(r.raw!.interestSaved);
    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThan(Number(r.raw!.baseInterest)); // can't save more than exists
    expect(Number(r.raw!.monthsSaved)).toBeGreaterThan(0);
    expect(Number(r.raw!.newTenureMonths)).toBeLessThan(240);
  });
});

describe('loan.transfer', () => {
  it('breakeven is a positive integer and monthly saving is positive', () => {
    const r = run('loan.transfer', {
      outstandingPrincipal: '2000000', oldRatePct: 9.5, remainingMonths: 180, newRatePct: 8.5, transferFee: '10000', transferFeePct: 0,
    });
    expect(Number(r.raw!.monthlySaving)).toBeGreaterThan(0);
    const be = r.raw!.breakevenMonth as number;
    expect(Number.isInteger(be)).toBe(true);
    expect(be).toBeGreaterThan(0);
  });
});

describe('loan.eligibility', () => {
  it('IN FOIR: 150k income @ 50% FOIR ⇒ 75k EMI capacity and positive principal', () => {
    const r = run('loan.eligibility', { monthlyIncome: '150000', foirPct: 50, existingEmi: '0', ratePct: 8.65, tenureMonths: 240 });
    expect(Number(r.raw!.eligibleEmi)).toBeCloseTo(75000, 2);
    expect(Number(r.raw!.eligiblePrincipal)).toBeGreaterThan(0);
  });
  it('US DTI: caps EMI at min(front, back) = 2240', () => {
    const r = run('loan.eligibility', { grossMonthlyIncome: '8000', frontEndDtiPct: 28, backEndDtiPct: 36, monthlyDebts: '0', ratePct: 6.5, tenureMonths: 360 }, ctxUS);
    expect(Number(r.raw!.eligibleEmi)).toBeCloseTo(2240, 2);
  });
});

describe('loan.stepEmi', () => {
  it('step-up starts below the flat EMI and pays more total interest', () => {
    const r = run('loan.stepEmi', { principal: '2500000', ratePct: 8.65, tenureMonths: 240, annualStepPct: 5 });
    expect(Number(r.raw!.initialEmi)).toBeLessThan(Number(r.raw!.flatEmi));
    expect(Number(r.raw!.finalEmi)).toBeGreaterThan(Number(r.raw!.initialEmi));
    expect(Number(r.raw!.extraInterest)).toBeGreaterThan(0);
  });
  it('zero step reduces to the flat EMI', () => {
    const r = run('loan.stepEmi', { principal: '2500000', ratePct: 8.65, tenureMonths: 240, annualStepPct: 0 });
    expect(Number(r.raw!.initialEmi)).toBeCloseTo(Number(r.raw!.flatEmi), 0);
  });
});

describe('loan.moratorium', () => {
  it('no-payment holiday raises the EMI and total cost', () => {
    const r = run('loan.moratorium', { principal: '2500000', ratePct: 8.65, tenureMonths: 240, moratoriumMonths: 6, type: 'noPayment' });
    expect(Number(r.raw!.newEmi)).toBeGreaterThan(Number(r.raw!.baseEmi));
    expect(Number(r.raw!.grownBalance)).toBeGreaterThan(2500000);
    expect(Number(r.raw!.extraCost)).toBeGreaterThan(0);
  });
});

describe('loan.overdraft', () => {
  it('1M limit @ 60% util, 10% for 12 months ⇒ 60,000 interest', () => {
    const r = run('loan.overdraft', { sanctionedLimit: '1000000', avgUtilisationPct: 60, ratePct: 10, months: 12 });
    expect(Number(r.raw!.avgBalance)).toBeCloseTo(600000, 2);
    expect(Number(r.raw!.totalInterest)).toBeCloseTo(60000, 2);
  });
});

describe('loan.refinance', () => {
  it('lower rate yields positive monthly saving and a positive-integer breakeven', () => {
    const r = run('loan.refinance', {
      currentBalance: '300000', currentRatePct: 7, remainingMonths: 300, newRatePct: 6, newTermMonths: 360, closingCosts: '6000', cashOut: '0', rollClosingCosts: false,
    }, ctxUS);
    expect(Number(r.raw!.monthlySaving)).toBeGreaterThan(0);
    const be = r.raw!.breakevenMonth as number;
    expect(Number.isInteger(be)).toBe(true);
    expect(be).toBeGreaterThan(0);
  });
});
