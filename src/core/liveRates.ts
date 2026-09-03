// Live FX rate fetch (§9.4). Uses open.er-api.com — free, no API key, CORS-enabled,
// 160+ currencies, daily updates. `fetchImpl` is injectable so tests never hit the network.
// The converter degrades gracefully to the offline rate book when this fails.

export interface LiveRateResult {
  rate: string; // 1 `from` = `rate` `to`
  asOf: string; // provider's last-update timestamp (UTC string), '' if unknown
  provider: string;
}

const ENDPOINT = (base: string) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;

export async function fetchLiveRate(
  from: string,
  to: string,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<LiveRateResult> {
  if (from === to) return { rate: '1', asOf: '', provider: 'identity' };
  const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!f) throw new Error('No fetch available in this environment');

  const res = await f(ENDPOINT(from), { signal: opts.signal });
  if (!res.ok) throw new Error(`Rate service returned HTTP ${res.status}`);
  const data: any = await res.json();
  if (data?.result && data.result !== 'success') throw new Error(data['error-type'] || 'Rate service error');
  const r = data?.rates?.[to];
  if (r == null) throw new Error(`No live rate for ${from} → ${to}`);
  return { rate: String(r), asOf: data.time_last_update_utc || '', provider: data.provider || 'open.er-api.com' };
}

/** Parse the provider's UTC timestamp to epoch ms; falls back to `nowMs`. */
export function asOfMs(asOf: string, nowMs: number): number {
  const t = Date.parse(asOf);
  return Number.isFinite(t) ? t : nowMs;
}
