// ─────────────────────────────────────────────────────────────────────────
// FX rates (§9.4). Wraps a host-supplied FxRateProvider with a TTL cache,
// lastUpdated, and a staleness flag. Works offline: on provider failure it
// returns the cached (or injected) rates and marks them stale. Never hardcodes
// an API key — the provider is host-supplied. Framework-free.
// ─────────────────────────────────────────────────────────────────────────
import type { FxRateProvider } from './types';

export interface RateSnapshot {
  base: string;
  timestamp: string; // provider's timestamp
  rates: Record<string, string>; // as STRINGS, float-safe
  lastUpdated: number; // epoch ms this cache entry was fetched
  stale: boolean; // older than ttl, or served from fallback
}

export interface FxCacheOptions {
  ttlMs?: number; // default 1h
  /** Injected/offline seed: base → rates. Used when the provider can't be reached. */
  seed?: Record<string, Record<string, string>>;
  now?: () => number; // injectable clock for tests
}

const HOUR = 60 * 60 * 1000;
const keyOf = (base: string, symbols: string[]) => `${base}|${[...symbols].sort().join(',')}`;

export function createFxCache(provider: FxRateProvider | undefined, options: FxCacheOptions = {}) {
  const ttlMs = options.ttlMs ?? HOUR;
  const now = options.now ?? Date.now;
  const cache = new Map<string, RateSnapshot>();
  let lastUpdated: number | null = null;

  function seedSnapshot(base: string): RateSnapshot | undefined {
    const rates = options.seed?.[base];
    if (!rates) return undefined;
    return { base, timestamp: new Date(0).toISOString(), rates, lastUpdated: 0, stale: true };
  }

  function isFresh(snap: RateSnapshot): boolean {
    return now() - snap.lastUpdated < ttlMs;
  }

  async function getRates(base: string, symbols: string[]): Promise<RateSnapshot> {
    const k = keyOf(base, symbols);
    const cached = cache.get(k);
    if (cached && isFresh(cached)) return { ...cached, stale: false };

    if (provider) {
      try {
        const res = await provider.getRates(base, symbols);
        const snap: RateSnapshot = {
          base,
          timestamp: res.timestamp,
          rates: res.rates,
          lastUpdated: now(),
          stale: false,
        };
        cache.set(k, snap);
        lastUpdated = snap.lastUpdated;
        return snap;
      } catch {
        /* fall through to cached / seed — stay usable offline */
      }
    }

    if (cached) return { ...cached, stale: true }; // expired but better than nothing
    const seed = seedSnapshot(base);
    if (seed) {
      cache.set(k, seed);
      return seed;
    }
    throw new Error('No FX rates available (no provider, cache, or seed)');
  }

  return {
    getRates,
    /** Non-throwing peek at whatever is cached, if anything. */
    peek: (base: string, symbols: string[]): RateSnapshot | undefined => cache.get(keyOf(base, symbols)),
    get lastUpdated(): Date | null {
      return lastUpdated == null ? null : new Date(lastUpdated);
    },
    isStale(base: string, symbols: string[]): boolean {
      const snap = cache.get(keyOf(base, symbols));
      return !snap || !isFresh(snap);
    },
    clear: () => cache.clear(),
  };
}

export type FxCache = ReturnType<typeof createFxCache>;
