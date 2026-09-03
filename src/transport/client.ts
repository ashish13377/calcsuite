// ─────────────────────────────────────────────────────────────────────────
// Transport client (§9). Framework-free. Uses config.fetch ?? fetch. Auth is a
// callback merged into headers at send time — tokens are NEVER stored. Timeout,
// retry+backoff, idempotency, offline queue, and the three upload strategies.
// ─────────────────────────────────────────────────────────────────────────
import {
  TransportError,
  type Attachment,
  type IdempotencyConfig,
  type OfflineQueueConfig,
  type RequestCtx,
  type ResponseCtx,
  type RetryConfig,
  type TransportConfig,
  type UploadMeta,
} from './types';

const AUTH_HEADER_HINTS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'api-key'];

const DEFAULT_RETRY: RetryConfig = {
  attempts: 3,
  backoff: 'exponential',
  baseDelayMs: 300,
  retryOn: [408, 429, 500, 502, 503, 504],
  respectRetryAfter: true,
};

const DEFAULT_IDEMPOTENCY: IdempotencyConfig = {
  enabled: true,
  headerName: 'Idempotency-Key',
  keyFrom: 'inputsHash',
};

const DEFAULT_QUEUE: OfflineQueueConfig = {
  enabled: true,
  storage: 'memory',
  maxItems: 200,
  flushOn: 'manual',
};

// ── small platform helpers (feature-detected so Node tests run) ──
const hasLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
};

function uuid(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

/** Sanitise a filename: no path separators, no leading dots, no control chars. */
export function sanitizeFilename(name: string): string {
  let out = String(name)
    .replace(/[\\/]+/g, '-') // path separators
    .replace(/[\x00-\x1f\x7f]+/g, '') // control chars
    .replace(/[<>:"|?*]+/g, '') // reserved
    .replace(/^\.+/, ''); // leading dots (., .., .hidden)
  out = out.trim();
  return out || 'file';
}

/** Fill a filenameTemplate then sanitise the result. */
export function buildFilename(template: string, meta: UploadMeta): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ext = (meta.filename?.split('.').pop() || meta.kind || 'bin').toLowerCase();
  const hash8 = (meta.inputsHash || '').replace(/^sha256:/, '').slice(0, 8) || '00000000';
  const filled = template
    .replace(/\{calculator\}/g, meta.calculator || 'calc')
    .replace(/\{yyyy\}/g, String(now.getFullYear()))
    .replace(/\{MM\}/g, pad(now.getMonth() + 1))
    .replace(/\{dd\}/g, pad(now.getDate()))
    .replace(/\{hash8\}/g, hash8)
    .replace(/\{ext\}/g, ext)
    .replace(/\{kind\}/g, meta.kind || 'file');
  return sanitizeFilename(filled);
}

/** Mask auth-ish header values so nothing secret reaches a log or error. */
export function redactHeaders(headers: Record<string, string>, extraKeys: string[] = []): Record<string, string> {
  const redact = new Set([...AUTH_HEADER_HINTS, ...extraKeys.map((k) => k.toLowerCase())]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k] = redact.has(k.toLowerCase()) ? '***' : v;
  return out;
}

// ── offline queue ──
export interface QueueItem {
  id: string;
  endpoint: string;
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>; // NON-auth only; auth is re-resolved at flush
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

class OfflineQueue {
  private items: QueueItem[] = [];
  private key: string;
  constructor(
    private cfg: OfflineQueueConfig,
    namespace: string,
  ) {
    this.key = `${namespace}:transport:queue`;
    this.load();
  }
  private load() {
    if (this.cfg.storage === 'localStorage' && hasLocalStorage()) {
      try {
        this.items = JSON.parse(localStorage.getItem(this.key) || '[]');
      } catch {
        this.items = [];
      }
    }
  }
  private save() {
    if (this.cfg.storage === 'localStorage' && hasLocalStorage()) {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.items));
      } catch {
        /* quota / private mode — stay in memory */
      }
    }
  }
  list(): QueueItem[] {
    return [...this.items];
  }
  size(): number {
    return this.items.length;
  }
  enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>): QueueItem {
    const full: QueueItem = { ...item, id: uuid(), createdAt: new Date().toISOString(), retryCount: 0 };
    this.items.push(full);
    while (this.items.length > this.cfg.maxItems) this.items.shift(); // drop oldest
    this.save();
    return full;
  }
  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
    this.save();
  }
  clear() {
    this.items = [];
    this.save();
  }
  async flush(sender: (item: QueueItem) => Promise<void>): Promise<{ flushed: number; failed: number }> {
    let flushed = 0;
    let failed = 0;
    for (const item of [...this.items]) {
      try {
        await sender(item);
        this.remove(item.id);
        flushed++;
      } catch (e) {
        item.retryCount++;
        item.lastError = e instanceof Error ? e.message : String(e);
        failed++;
      }
    }
    this.save();
    return { flushed, failed };
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CallOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined | null>;
  pathParam?: string; // replaces :id
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface QueuedResult {
  queued: true;
  id: string;
}

export type Transport = ReturnType<typeof createTransport>;

export function createTransport(config: TransportConfig) {
  const doFetch: typeof fetch = config.fetch ?? (globalThis.fetch as typeof fetch);
  const retry = { ...DEFAULT_RETRY, ...config.retry };
  const idem = { ...DEFAULT_IDEMPOTENCY, ...config.idempotency };
  const queueCfg = { ...DEFAULT_QUEUE, ...config.offlineQueue };
  const timeoutMs = config.timeoutMs ?? 15000;
  const credentials = config.credentials ?? 'same-origin';
  const queue = new OfflineQueue(queueCfg, 'calcsuite');

  function endpointUrl(endpoint: keyof TransportConfig['endpoints'], pathParam?: string): string {
    const path = config.endpoints[endpoint];
    if (!path) throw new TransportError(`Endpoint "${endpoint}" is not configured`, { code: 'no_endpoint' });
    let full = /^https?:\/\//i.test(path) ? path : joinUrl(config.baseUrl, path);
    if (pathParam != null) full = full.replace(/:id\b/, encodeURIComponent(pathParam));
    return full;
  }

  function staticHeaders(): Record<string, string> {
    const h = typeof config.headers === 'function' ? config.headers() : config.headers;
    return { ...(h ?? {}) };
  }

  async function authHeaders(): Promise<{ headers: Record<string, string>; keys: string[] }> {
    if (!config.getAuth) return { headers: {}, keys: [] };
    const a = await config.getAuth();
    return { headers: { ...a }, keys: Object.keys(a) };
  }

  function idempotencyKey(endpoint: string, body: unknown, override?: string): string | undefined {
    if (!idem.enabled || override) return override;
    if (!MUTATING.has(methodFor(endpoint))) return undefined;
    if (idem.keyFrom === 'inputsHash') {
      const h = extractInputsHash(body);
      if (h) return h; // stable for identical inputs → dedupes retries
    }
    return uuid();
  }

  /** One HTTP attempt with timeout; throws on network error / abort. */
  async function attemptFetch(url: string, init: RequestInit, extSignal?: AbortSignal): Promise<Response> {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    if (extSignal) extSignal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      return await doFetch(url, { ...init, signal: ac.signal });
    } finally {
      clearTimeout(timer);
      if (extSignal) extSignal.removeEventListener('abort', onAbort);
    }
  }

  function backoffMs(attempt: number, res?: Response): number {
    if (retry.respectRetryAfter && res) {
      const ra = res.headers.get('retry-after');
      if (ra) {
        const secs = Number(ra);
        if (Number.isFinite(secs)) return secs * 1000;
        const when = Date.parse(ra);
        if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
      }
    }
    return retry.backoff === 'exponential' ? retry.baseDelayMs * 2 ** (attempt - 1) : retry.baseDelayMs;
  }

  /** Core request with retry loop, hooks, transforms and offline fallback. */
  async function request<T = unknown>(
    endpoint: keyof TransportConfig['endpoints'],
    opts: CallOptions & { body?: unknown } = {},
  ): Promise<T | QueuedResult> {
    const method = methodFor(endpoint);
    const url = withQuery(endpointUrl(endpoint, opts.pathParam), opts.query);
    const idemKey = idempotencyKey(endpoint, opts.body, opts.idempotencyKey);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= Math.max(1, retry.attempts); attempt++) {
      const auth = await authHeaders();
      const merged: Record<string, string> = {
        'content-type': 'application/json',
        ...staticHeaders(),
        ...(opts.headers ?? {}),
        ...auth.headers,
      };
      if (idemKey) merged[idem.headerName] = idemKey;

      const safeHeaders = redactHeaders(merged, auth.keys);
      let body = opts.body;
      const reqCtx: RequestCtx = { endpoint: String(endpoint), method, url, headers: safeHeaders, body, attempt };
      if (config.transformRequest && body !== undefined) body = config.transformRequest(body, reqCtx);
      config.onRequest?.(reqCtx);

      const started = now();
      try {
        const res = await attemptFetch(
          url,
          {
            method,
            credentials,
            headers: merged,
            body: body === undefined ? undefined : JSON.stringify(body),
          },
          opts.signal,
        );

        if (!res.ok && retry.retryOn.includes(res.status) && attempt < retry.attempts) {
          await sleep(backoffMs(attempt, res));
          continue;
        }

        const data = await parseBody(res);
        const resCtx: ResponseCtx = {
          ...reqCtx,
          status: res.status,
          ok: res.ok,
          durationMs: now() - started,
          data,
        };
        config.onResponse?.(resCtx);

        if (!res.ok) {
          const err = new TransportError(`Request failed with ${res.status}`, {
            code: 'http_error',
            status: res.status,
            request: reqCtx,
          });
          config.onError?.(err, reqCtx);
          throw err;
        }
        return (config.transformResponse ? config.transformResponse(data, reqCtx) : data) as T;
      } catch (e) {
        lastErr = e;
        if (e instanceof TransportError && e.code === 'http_error') throw e; // non-retryable HTTP handled above
        // network error / timeout / abort
        if (attempt < retry.attempts) {
          await sleep(backoffMs(attempt));
          continue;
        }
        // exhausted: queue mutating requests offline, else surface a redacted error
        if (queueCfg.enabled && MUTATING.has(method)) {
          const item = queue.enqueue({
            endpoint: String(endpoint),
            method,
            url,
            body: opts.body,
            headers: { ...(opts.headers ?? {}) }, // never the auth headers
          });
          return { queued: true, id: item.id };
        }
        const err =
          e instanceof TransportError
            ? e
            : new TransportError('Network request failed', { code: 'network_error', request: reqCtx });
        config.onError?.(err, reqCtx);
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new TransportError('Request failed', { code: 'transport_error' });
  }

  // ── upload strategies ──
  async function upload(file: Blob, meta: UploadMeta, opts: CallOptions = {}): Promise<unknown> {
    const u = config.upload;
    validateUpload(file, meta, u.accept, u.maxBytes);
    const filename = meta.filename ?? buildFilename(u.filenameTemplate, meta);
    const full: UploadMeta = { ...meta, filename, bytes: file.size, contentType: meta.contentType ?? blobType(file) };

    if (u.beforeUpload) {
      const ok = await u.beforeUpload(file, full);
      if (!ok) throw new TransportError('Upload cancelled by host', { code: 'upload_cancelled' });
    }

    if (u.strategy === 'presigned') return uploadPresigned(file, full, opts);
    if (u.strategy === 'base64Json') return uploadBase64(file, full, opts);
    return uploadMultipart(file, full, opts);
  }

  async function commonHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const auth = await authHeaders();
    return { ...staticHeaders(), ...(extra ?? {}), ...auth.headers };
  }

  async function uploadMultipart(file: Blob, meta: UploadMeta, opts: CallOptions): Promise<unknown> {
    if (typeof FormData === 'undefined') throw new TransportError('FormData unavailable', { code: 'no_formdata' });
    const u = config.upload;
    const fd = new FormData();
    fd.append(u.fieldName || 'file', file, meta.filename);
    fd.append(
      'metadata',
      JSON.stringify({
        calculationId: meta.calculationId,
        calculator: meta.calculator,
        kind: meta.kind,
        inputsHash: meta.inputsHash,
        checksum: meta.checksum,
      }),
    );
    const extra = typeof u.extraFields === 'function' ? u.extraFields() : u.extraFields;
    for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);

    const headers = await commonHeaders(opts.headers);
    if (u.checksum === 'sha256' && meta.checksum) headers['x-checksum-sha256'] = meta.checksum;
    const res = await attemptFetch(
      endpointUrl('upload'),
      { method: 'POST', credentials, headers, body: fd },
      opts.signal,
    );
    return uploadResult(res);
  }

  async function uploadBase64(file: Blob, meta: UploadMeta, opts: CallOptions): Promise<unknown> {
    const data = await blobToBase64(file);
    return request('upload', {
      ...opts,
      body: {
        filename: meta.filename,
        contentType: meta.contentType,
        bytes: meta.bytes,
        checksum: meta.checksum,
        metadata: { calculator: meta.calculator, kind: meta.kind, inputsHash: meta.inputsHash },
        data,
      },
    });
  }

  async function uploadPresigned(file: Blob, meta: UploadMeta, opts: CallOptions): Promise<Attachment | unknown> {
    // 1. GET presigned URL — auth allowed to our own host
    const presign = (await request<{ url: string; method?: string; headers?: Record<string, string>; publicUrl?: string }>(
      'uploadUrl',
      { query: { filename: meta.filename, contentType: meta.contentType, bytes: meta.bytes } },
    )) as { url: string; method?: string; headers?: Record<string, string>; publicUrl?: string } | { queued: true };

    if ('queued' in presign) throw new TransportError('Cannot presign while offline', { code: 'offline' });
    if (!presign.url) throw new TransportError('Presign response missing url', { code: 'bad_presign' });

    // 2. PUT the blob straight to storage — NEVER our auth headers to a 3rd-party host
    const putRes = await attemptFetch(
      presign.url,
      { method: presign.method || 'PUT', headers: presign.headers ?? {}, body: file },
      opts.signal,
    );
    if (!putRes.ok) throw new TransportError(`Presigned PUT failed (${putRes.status})`, { code: 'upload_failed', status: putRes.status });

    // 3. notify save with the reference (only if a save endpoint exists)
    const attachment: Attachment = {
      id: '',
      kind: meta.kind,
      filename: meta.filename ?? 'file',
      bytes: meta.bytes ?? file.size,
      url: presign.publicUrl ?? null,
    };
    if (config.endpoints.save) {
      const saved = await request('save', {
        ...opts,
        body: {
          calculator: meta.calculator,
          inputsHash: meta.inputsHash,
          attachments: [attachment],
        },
      });
      return saved;
    }
    return attachment;
  }

  // ── public surface ──
  return {
    save: <T = unknown>(body: unknown, opts?: CallOptions) => request<T>('save', { ...opts, body }),
    update: <T = unknown>(id: string, body: unknown, opts?: CallOptions) =>
      request<T>('update', { ...opts, body, pathParam: id }),
    get: <T = unknown>(id: string, opts?: CallOptions) => request<T>('get', { ...opts, pathParam: id }),
    list: <T = unknown>(query?: CallOptions['query'], opts?: CallOptions) => request<T>('list', { ...opts, query }),
    delete: <T = unknown>(id: string, opts?: CallOptions) => request<T>('delete', { ...opts, pathParam: id }),
    upload,
    getRates: async (base: string, symbols: string[], opts?: CallOptions) =>
      request<{ base: string; timestamp: string; rates: Record<string, string> }>('rates', {
        ...opts,
        query: { base, symbols: symbols.join(',') },
      }),
    /** Offline queue inspector — flush re-sends with freshly-resolved auth. */
    queue: {
      list: () => queue.list(),
      size: () => queue.size(),
      clear: () => queue.clear(),
      remove: (id: string) => queue.remove(id),
      flush: () =>
        queue.flush(async (item) => {
          const auth = await authHeaders();
          const res = await attemptFetch(item.url, {
            method: item.method,
            credentials,
            headers: { 'content-type': 'application/json', ...item.headers, ...auth.headers },
            body: item.body === undefined ? undefined : JSON.stringify(item.body),
          });
          if (!res.ok) throw new TransportError(`Flush failed (${res.status})`, { code: 'http_error', status: res.status });
        }),
    },
  };
}

// ── endpoint → method map ──
function methodFor(endpoint: string): string {
  switch (endpoint) {
    case 'save':
    case 'upload':
      return 'POST';
    case 'update':
      return 'PUT';
    case 'delete':
      return 'DELETE';
    default:
      return 'GET'; // get, list, rates, uploadUrl, settings
  }
}

// ── misc helpers ──
function now(): number {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function withQuery(url: string, query?: CallOptions['query']): string {
  if (!query) return url;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  if (!parts.length) return url;
  return url + (url.includes('?') ? '&' : '?') + parts.join('&');
}

function extractInputsHash(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as any;
  const h = b?.meta?.inputsHash ?? b?.inputsHash;
  return typeof h === 'string' && h ? h : undefined;
}

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) return await res.json();
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}

async function uploadResult(res: Response): Promise<unknown> {
  if (!res.ok) throw new TransportError(`Upload failed (${res.status})`, { code: 'upload_failed', status: res.status });
  return parseBody(res);
}

function blobType(file: Blob): string {
  return (file as any).type || 'application/octet-stream';
}

function validateUpload(file: Blob, meta: UploadMeta, accept: string[], maxBytes: number): void {
  if (file.size > maxBytes) {
    throw new TransportError(`File exceeds ${maxBytes} bytes`, { code: 'too_large' });
  }
  const type = meta.contentType ?? blobType(file);
  if (accept.length && type && !accept.includes(type)) {
    throw new TransportError(`Content type ${type} not accepted`, { code: 'bad_type' });
  }
}

async function blobToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    return btoa(bin);
  }
  // Node fallback
  const B: any = (globalThis as any).Buffer;
  if (B) return B.from(bytes).toString('base64');
  throw new TransportError('No base64 encoder available', { code: 'no_base64' });
}
