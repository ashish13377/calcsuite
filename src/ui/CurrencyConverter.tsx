import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CURRENCIES,
  convert,
  inverseRate,
  formatCurrency,
  currencyDecimals,
  stalenessLabel,
  isStale,
} from '../core/currency';
import { fetchLiveRate, asOfMs } from '../core/liveRates';
import { D } from '../core/decimal';

// Currency converter (§6.5). ONLINE by default (fetches the current rate from a free,
// no-key provider); a toggle switches to OFFLINE (no network — manual entry + cached rates).
// Conversion is Decimal-exact. The mode choice is remembered on this device.

const STORE = 'calcsuite:fxrates';
const STORE_MODE = 'calcsuite:fxmode';
type Book = Record<string, { rate: string; at: number }>;
type Mode = 'online' | 'offline';

const readBook = (): Book => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
};
const writeBook = (b: Book) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(b));
  } catch {
    /* ignore quota */
  }
};
const readMode = (): Mode => {
  try {
    return localStorage.getItem(STORE_MODE) === 'offline' ? 'offline' : 'online';
  } catch {
    return 'online';
  }
};
const pairKey = (from: string, to: string) => `${from}_${to}`;

type Source = 'live' | 'manual' | 'saved' | 'none';
type Status = 'idle' | 'loading' | 'error';

export function CurrencyConverter() {
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('INR');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [source, setSource] = useState<Source>('none');
  const [asOf, setAsOf] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<Mode>(() => readMode());
  const [book, setBook] = useState<Book>(() => readBook());
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const saveToBook = (r: string, at: number) => {
    setBook((prev) => {
      const next = { ...prev, [pairKey(from, to)]: { rate: r, at } };
      writeBook(next);
      return next;
    });
  };

  // Fetch the current live rate; fall back to the offline rate book on failure.
  const loadLive = (f: string, t: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (f === t) {
      setRate('1');
      setSource('live');
      setAsOf('');
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    fetchLiveRate(f, t, { signal: ctrl.signal })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setRate(res.rate);
        setSource('live');
        setAsOf(res.asOf);
        setStatus('idle');
        saveToBook(res.rate, asOfMs(res.asOf, Date.now()));
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        const hit = readBook()[pairKey(f, t)];
        if (hit) {
          setRate(hit.rate);
          setSource('saved');
          setStatus('error');
          setErrorMsg('Offline — showing your last saved rate. Refresh when back online.');
        } else {
          setSource('none');
          setStatus('error');
          setErrorMsg(`Couldn’t fetch a live rate (${err instanceof Error ? err.message : 'offline'}). Enter one manually.`);
        }
      });
  };

  // Offline mode: never touch the network — use a saved rate or wait for manual entry.
  const loadOffline = (f: string, t: string) => {
    abortRef.current?.abort();
    setStatus('idle');
    setErrorMsg('');
    if (f === t) {
      setRate('1');
      setSource('saved');
      return;
    }
    const hit = readBook()[pairKey(f, t)];
    if (hit) {
      setRate(hit.rate);
      setSource('saved');
    } else {
      setRate('');
      setSource('none');
    }
  };

  // React to pair or mode changes.
  useEffect(() => {
    if (mode === 'online') loadLive(from, to);
    else loadOffline(from, to);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, mode]);

  const changeMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(STORE_MODE, m);
    } catch {
      /* ignore */
    }
  };

  const clean = (s: string) => s.replace(/[, ]/g, '').trim();
  const amountNum = clean(amount);
  const rateNum = clean(rate);
  const hasAmount = amountNum !== '' && Number(amountNum) >= 0 && Number.isFinite(Number(amountNum));
  const hasRate = rateNum !== '' && Number(rateNum) > 0 && Number.isFinite(Number(rateNum));

  const converted = useMemo(
    () => (hasAmount && hasRate ? convert(amountNum, rateNum) : null),
    [hasAmount, hasRate, amountNum, rateNum],
  );
  const inverse = hasRate ? inverseRate(rateNum) : null;

  const onManualRate = (v: string) => {
    setRate(v);
    setSource('manual');
    setStatus('idle');
    setErrorMsg('');
    if (hasRate || v.trim() !== '') saveToBook(clean(v), Date.now());
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const asOfLabel = asOf ? stalenessLabel(asOfMs(asOf, now), now) : 'just now';
  const savedAt = book[pairKey(from, to)]?.at;

  const opt = (c: { code: string; name: string }) => (
    <option key={c.code} value={c.code}>
      {c.code} — {c.name}
    </option>
  );

  const savedList = Object.entries(book).sort((a, b) => b[1].at - a[1].at);

  const statusNode = () => {
    if (status === 'error') return <span>⚠ {errorMsg}</span>;
    if (source === 'manual') return <span>Manual rate (you entered this)</span>;
    if (mode === 'online') {
      if (status === 'loading') return <span>Fetching live rate…</span>;
      if (source === 'live')
        return (
          <span>
            <span className="cc-live-dot" /> Live rate · updated {asOfLabel} · open.er-api.com
          </span>
        );
      return null;
    }
    // offline
    if (source === 'saved' && savedAt) return <span>✈ Offline · saved rate {stalenessLabel(savedAt, now)}</span>;
    return <span>✈ Offline · enter a rate manually</span>;
  };

  return (
    <div data-part="calculator" data-calculator="tools.currency">
      <section className="card">
        <div className="cc-modebar">
          <div className="seg" role="group" aria-label="Rate source">
            <button aria-pressed={mode === 'online'} onClick={() => changeMode('online')}>
              🟢 Live
            </button>
            <button aria-pressed={mode === 'offline'} onClick={() => changeMode('offline')}>
              ✈ Offline
            </button>
          </div>
        </div>

        <div className="cc-row">
          <label className="field cc-amount">
            <span className="lbl">Amount</span>
            <div className="input-wrap">
              <input
                className="num"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount to convert"
              />
            </div>
          </label>
          <label className="field cc-cur">
            <span className="lbl">From</span>
            <div className="input-wrap">
              <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From currency">
                {CURRENCIES.map(opt)}
              </select>
            </div>
          </label>

          <button type="button" className="cc-swap" onClick={swap} aria-label="Swap currencies" title="Swap">
            ⇄
          </button>

          <label className="field cc-cur">
            <span className="lbl">To</span>
            <div className="input-wrap">
              <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To currency">
                {CURRENCIES.map(opt)}
              </select>
            </div>
          </label>
        </div>

        <label className="field" style={{ marginTop: 16 }}>
          <span className="lbl">
            Exchange rate — 1 {from} = ? {to}
          </span>
          <div className="cc-rate">
            <div className="input-wrap">
              <input
                className="num"
                inputMode="decimal"
                placeholder={status === 'loading' ? 'fetching…' : `rate for ${from}→${to}`}
                value={rate}
                onChange={(e) => onManualRate(e.target.value)}
                aria-label="Exchange rate"
              />
            </div>
            {mode === 'online' && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => loadLive(from, to)}
                disabled={status === 'loading'}
                aria-label="Refresh live rate"
              >
                {status === 'loading' ? '…' : '↻ Refresh'}
              </button>
            )}
          </div>

          <div className={`cc-status ${status === 'error' ? 'cc-stale' : ''}`} aria-live="polite">
            {statusNode()}
          </div>
          {from === to && <div className="notice">“From” and “To” are the same currency — the rate is 1.</div>}
        </label>
      </section>

      <section className="card">
        {converted ? (
          <div className="result" aria-live="polite">
            <div className="label">{formatCurrency(amountNum, from)} =</div>
            <div className="value num accent-txt">{formatCurrency(converted, to)}</div>
            <div className="secondary">
              <div className="kv">
                <div className="k">Rate</div>
                <div className="v num">
                  1 {from} = {D(rateNum).toDecimalPlaces(6).toString()} {to}
                </div>
              </div>
              {inverse && (
                <div className="kv">
                  <div className="k">Inverse</div>
                  <div className="v num">
                    1 {to} = {inverse.toDecimalPlaces(6).toString()} {from}
                  </div>
                </div>
              )}
              <div className="kv">
                <div className="k">Precision</div>
                <div className="v num">
                  {currencyDecimals(to)} dp · {to}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty">
            {!hasAmount ? 'Enter an amount to convert.' : 'Waiting for a rate — refresh or enter one manually.'}
          </div>
        )}

        <p className="disclaimer">
          {mode === 'online'
            ? 'Live mid-market rates from a public feed, cached offline. Your bank’s rate includes a spread and fees, so it will differ. Not financial advice.'
            : 'Offline mode — no live feed. Rates are your saved or manually-entered values. Verify before transacting. Not financial advice.'}
        </p>
      </section>

      {savedList.length > 0 && (
        <section className="card">
          <div className="panel-head" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>Saved rates {mode === 'offline' ? '(used offline)' : '(offline cache)'}</h2>
            <p>Tap a pair to load it. Stored on this device only.</p>
          </div>
          <ul className="cc-book">
            {savedList.slice(0, 12).map(([key, v]) => {
              const [f, t] = key.split('_');
              return (
                <li key={key}>
                  <button
                    className="cc-book-item"
                    onClick={() => {
                      setFrom(f!);
                      setTo(t!);
                    }}
                  >
                    <span className="cc-book-pair">
                      {f} → {t}
                    </span>
                    <span className="num">{v.rate}</span>
                    <span className={`cc-book-when ${isStale(v.at, now) ? 'cc-stale' : ''}`}>{stalenessLabel(v.at, now)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
