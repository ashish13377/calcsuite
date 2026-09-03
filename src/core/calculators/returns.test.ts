import { describe, it, expect } from 'vitest';
import { returnsCalculators } from './returns';
import { makeFormatter } from '../format';
import { DEFAULT_SETTINGS } from '../../settings/settings';
import { D } from '../decimal';
import type { CalcCtx } from '../kit';

const ctx: CalcCtx = { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D };
const byId = (id: string) => returnsCalculators.find((c) => c.id === id)!;
const dflt = (id: string) => {
  const v: Record<string, any> = {};
  for (const f of byId(id).inputs) if (f.default !== undefined) v[f.key] = f.default;
  return v;
};

describe('returns calculators', () => {
  it('CAGR 100k→200k over 10y ≈ 7.18%', () => {
    const r = byId('returns.cagr').compute(dflt('returns.cagr'), ctx);
    expect(r.raw!.cagr as number).toBeCloseTo(7.177, 1);
  });

  it('XIRR of −100k,−50k,180k over 2 years is positive and sane', () => {
    const r = byId('returns.xirr').compute(dflt('returns.xirr'), ctx);
    expect(r.raw!.xirr as number).toBeGreaterThan(0);
    expect(r.raw!.xirr as number).toBeLessThan(100);
  });

  it('Rule of 72 @8% ≈ 9 years', () => {
    const r = byId('returns.rule72').compute({ ratePct: '8' }, ctx);
    expect(r.raw!.approx as number).toBeCloseTo(9, 1);
    expect(r.raw!.exact as number).toBeCloseTo(9.006, 1);
  });

  it('real return 12% nominal, 6% inflation ≈ 5.66%', () => {
    const r = byId('returns.realReturn').compute({ nominalPct: '12', inflationPct: '6' }, ctx);
    expect(r.raw!.real as number).toBeCloseTo(5.66, 1);
  });

  it('NPV of a profitable project is positive', () => {
    const r = byId('returns.npv').compute(dflt('returns.npv'), ctx);
    expect(r.raw!.npv as number).toBeGreaterThan(0);
  });

  it('IRR solves a standard project', () => {
    const r = byId('returns.irr').compute(dflt('returns.irr'), ctx);
    expect(r.raw!.irr as number).toBeGreaterThan(0);
  });

  it('TVM solves FV of a SIP-like stream', () => {
    const r = byId('returns.tvm').compute(dflt('returns.tvm'), ctx);
    expect(r.raw!.value as number).toBeGreaterThan(0);
  });

  it('payback recovers within the horizon', () => {
    const r = byId('returns.payback').compute(dflt('returns.payback'), ctx);
    expect(r.raw!.payback as number).toBeGreaterThan(0);
  });

  it('MIRR is between finance and reinvest sanity bounds', () => {
    const r = byId('returns.mirr').compute(dflt('returns.mirr'), ctx);
    expect(r.raw!.mirr as number).toBeGreaterThan(0);
  });

  it('absolute return 100k→150k = 50%', () => {
    const r = byId('returns.absolute').compute({ invested: '100000', current: '150000' }, ctx);
    expect(r.raw!.absolute as number).toBeCloseTo(50, 3);
  });
});
