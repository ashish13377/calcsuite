# 🔌 Backend Integration

CalcSuite works **100% offline** with no backend. When you *do* want to save calculations, upload exports, or sync FX rates to your own server, you inject a **transport** — nothing is baked in, and **no credentials are ever stored** by the app.

> 🔐 Auth is always a callback (`getAuth`) you supply. The app never keeps a token, key, or secret in its state or `localStorage`.

---

## 🧭 Two ways to configure

1. **In code** — build a transport with `createTransport(config)` and drive save/upload/list yourself, or pass a `transport` in your provider settings so the bundled Save/Export wire to it automatically:

```tsx
import { createTransport } from 'calcsuite-react';

const transport = createTransport({
  baseUrl: 'https://api.example.com/fincalc',
  endpoints: { save: '/calculations', list: '/calculations', upload: '/files' },
  getAuth: async () => ({ Authorization: `Bearer ${await getToken()}` }), // 🔐 callback, never stored
});
await transport.save(payload);
```

2. **In the UI** — enable the **Integration panel** ([Settings → Integration](settings.md#-features)) to point the app at an endpoint without a code change. It renders the same config type, with a live JSON preview, **Test connection**, and **Copy as cURL**.

---

## ⚙️ Transport config (shape)

```ts
interface TransportConfig {
  baseUrl: string;
  endpoints: {
    save?, update?, get?, list?, delete?,   // calculations
    upload?, uploadUrl?,                     // files (multipart or presigned)
    rates?, settings?,                       // FX + server-side settings
  };
  getAuth?: () => Promise<Record<string,string>> | Record<string,string>; // 🔐 token callback
  fetch?: typeof fetch;                      // use your interceptors/tracing
  headers?, credentials?, timeoutMs?;
  retry?: { attempts, backoff, baseDelayMs, retryOn, respectRetryAfter };
  idempotency?: { enabled, headerName, keyFrom: 'inputsHash' | 'uuid' };  // no duplicate rows on retry
  offlineQueue?: { enabled, storage, maxItems, flushOn };                 // survives being offline
  upload: UploadConfig;
}
```

Defaults are sensible: 15s timeout, 3 retries with backoff on `[408,429,500,502,503,504]`, idempotency on, offline queue on when persistence is on.

---

## 📮 Payloads your backend receives

All numbers are sent as **strings** to stay float-safe.

### `POST {save}`
```jsonc
{
  "schemaVersion": 1,
  "clientId": "fincalc-web",
  "calculator": "loan.emi",
  "region": "IN",
  "currency": "INR",
  "title": "Home loan 25L @ 8.65%",
  "inputs":  { "principal": "2500000", "annualRate": "8.65", "tenureMonths": 240 },
  "settingsSnapshot": { "rounding": { … }, "dayCount": "30/360", "numberFormat": { … } },
  "outputs": { "payment": "21933.51", "totalInterest": "…", "totalPayment": "…" },
  "meta": { "inputsHash": "sha256:…", "computedAt": "…", "formula": "…" }
}
```
**Response:** `{ "id": "calc_…", "createdAt": "…", "url": "…" }` (extra fields ignored).

### `GET {list}?cursor=&limit=&calculator=&from=&to=&q=`
→ `{ items: SavedCalculation[], nextCursor: string | null }`

### `POST {upload}` (multipart)
Parts: `file` (the blob) + `metadata` (JSON: `{ calculationId?, calculator, kind, inputsHash, checksum? }`).

### `GET {uploadUrl}?filename=&contentType=&bytes=` (presigned)
→ `{ url, method: 'PUT', headers, publicUrl?, expiresAt }`. The app PUTs the blob to that URL (**no auth headers sent to the presigned host**), then calls `save`/`update` with the reference.

### `GET {rates}?base=USD&symbols=INR,EUR`
→ `{ base, timestamp, rates: { "INR": "89.4124" } }` (rates as strings).

---

## 🖥️ The Integration panel (§8.2)

Enable it in Settings. Seven blocks:

1. **🔗 Connection** — base URL, auth strategy (`none | bearer | apiKeyHeader | basic | cookie | custom`), timeout, retry. The token is **never entered here** — when your host supplies `getAuth`, it shows a read-only "supplied by host application" row.
2. **📍 Endpoints** — one row per endpoint with a resolved full-URL preview.
3. **📎 Upload** — URI, strategy (`multipart | presigned | base64Json`), field name, `filenameTemplate` with a **live rendered filename**, accepted MIME types, max bytes, checksum, chunking.
4. **🧱 Payload builder** — an editable table of fields (static / input / output / setting / context / token / callback) with transforms and envelope controls, and a **live JSON preview** against your last result. ⚠️ It warns if you switch `numberEncoding` to `number` (that reintroduces float error).
5. **🧪 Test connection** — fires a real request with `X-FinCalc-Test: 1`; shows status, round-trip ms, headers, and body. On failure it shows the exact request (auth redacted) for debugging.
6. **📋 Copy as cURL** — reproduces the last request (auth redacted by default; explicit "include auth" toggle).
7. **📥 Queue inspector** — pending offline items with retry count and last error; manual flush/clear.

Rules: no field ever persists a secret; host-set config renders read-only ("set by your organisation"); import/export the whole config as JSON to promote across environments.

---

## 💱 FX rate provider

The currency converter's live rates come from a free public feed by default. To use your own source, supply an `FxRateProvider` (or point the `rates` endpoint at your server). Rates are cached with a TTL and show a **staleness badge**. Never hardcode an API key — the provider is host-supplied.

---

## 🔒 Security checklist

- ✅ No secrets in app state, storage, or logs.
- ✅ Error surfaces redact everything except `code`/`status` by default.
- ✅ CSV export is injection-safe (cells starting with `= + - @` are quoted).
- ✅ `filenameTemplate` output is sanitised (no path separators/leading dots).
- ✅ No `eval` (the expression parser is a real parser); no `dangerouslySetInnerHTML`.
- ⚠️ **Re-validate `accept` and `maxBytes` on the server** — client validation is a convenience, not a guarantee.
