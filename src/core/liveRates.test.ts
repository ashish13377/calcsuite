import { describe, it, expect } from 'vitest';
import { fetchLiveRate, asOfMs } from './liveRates';

const okFetch = (rates: Record<string, number>): typeof fetch =>
  (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', provider: 'test', time_last_update_utc: 'Thu, 03 Sep 2026 00:00:00 +0000', rates }),
    }) as any) as unknown as typeof fetch;

describe('live rates (injected fetch — no network)', () => {
  it('returns the requested pair rate', async () => {
    const r = await fetchLiveRate('USD', 'INR', { fetchImpl: okFetch({ INR: 94.89 }) });
    expect(r.rate).toBe('94.89');
    expect(r.asOf).toContain('2026');
  });

  it('identity pair short-circuits to 1 without fetching', async () => {
    const r = await fetchLiveRate('USD', 'USD', {});
    expect(r.rate).toBe('1');
  });

  it('throws a clear error on HTTP failure', async () => {
    const bad = (async () => ({ ok: false, status: 503 }) as any) as unknown as typeof fetch;
    await expect(fetchLiveRate('USD', 'INR', { fetchImpl: bad })).rejects.toThrow(/503/);
  });

  it('throws when the pair is unavailable', async () => {
    await expect(fetchLiveRate('USD', 'XYZ', { fetchImpl: okFetch({ INR: 94 }) })).rejects.toThrow(/No live rate/);
  });

  it('asOfMs parses a valid timestamp, falls back otherwise', () => {
    expect(asOfMs('Thu, 03 Sep 2026 00:00:00 +0000', 123)).toBe(Date.parse('Thu, 03 Sep 2026 00:00:00 +0000'));
    expect(asOfMs('not-a-date', 123)).toBe(123);
  });
});
