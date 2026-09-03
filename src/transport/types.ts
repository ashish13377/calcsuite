// ─────────────────────────────────────────────────────────────────────────
// Transport types (§9.1 / §9.2 / §8.2). Injected, never baked in — the app
// works fully with transport undefined. Framework-free: no React here.
// ─────────────────────────────────────────────────────────────────────────
import type { Region, Settings } from '../settings/settings';

export type ISODate = string;

// ── §9.1 Config ──
export interface TransportConfig {
  baseUrl: string;

  endpoints: {
    save?: string; // POST   persist a calculation
    update?: string; // PUT    /:id
    get?: string; // GET    /:id
    list?: string; // GET    history, paginated
    delete?: string; // DELETE /:id
    upload?: string; // POST   multipart file upload
    uploadUrl?: string; // GET    request a presigned URL
    rates?: string; // GET    FX rates
    settings?: string; // GET/PUT server-side settings sync
  };

  /** Auth is a callback so tokens are never stored by FinCalc. */
  getAuth?: () => Promise<Record<string, string>> | Record<string, string>;

  /** Host-supplied fetch so their interceptors, tracing and proxies apply. */
  fetch?: typeof fetch;

  headers?: Record<string, string> | (() => Record<string, string>);
  credentials?: RequestCredentials; // default 'same-origin'
  timeoutMs?: number; // default 15000

  retry?: RetryConfig;
  idempotency?: IdempotencyConfig;
  offlineQueue?: OfflineQueueConfig;

  upload: UploadConfig; // §9.2

  transformRequest?: (body: unknown, ctx: RequestCtx) => unknown;
  transformResponse?: (raw: unknown, ctx: RequestCtx) => unknown;
  onRequest?: (ctx: RequestCtx) => void;
  onResponse?: (ctx: ResponseCtx) => void;
  onError?: (err: TransportError, ctx: RequestCtx) => void;
  onProgress?: (p: { loaded: number; total: number; pct: number }) => void;
}

export interface RetryConfig {
  attempts: number; // default 3
  backoff: 'fixed' | 'exponential';
  baseDelayMs: number; // default 300
  retryOn: number[]; // default [408,429,500,502,503,504]
  respectRetryAfter: boolean; // default true
}

export interface IdempotencyConfig {
  enabled: boolean; // default true
  headerName: string; // default 'Idempotency-Key'
  keyFrom: 'inputsHash' | 'uuid';
}

export interface OfflineQueueConfig {
  enabled: boolean; // default true when persistence is on
  storage: 'memory' | 'localStorage' | 'indexedDB';
  maxItems: number; // default 200
  flushOn: 'reconnect' | 'manual' | 'interval';
  intervalMs?: number;
}

// ── §9.2 Upload ──
export interface UploadConfig {
  strategy: 'multipart' | 'presigned' | 'base64Json';
  fieldName: string; // default 'file'
  extraFields?: Record<string, string> | (() => Record<string, string>);
  maxBytes: number; // default 10 * 1024 * 1024
  accept: string[];
  filenameTemplate: string; // default '{calculator}-{yyyy}{MM}{dd}-{hash8}.{ext}'
  chunked?: { enabled: boolean; chunkBytes: number };
  checksum?: 'none' | 'sha256'; // sent as x-checksum-sha256
  beforeUpload?: (file: Blob, meta: UploadMeta) => Promise<boolean> | boolean;
}

export interface UploadMeta {
  calculationId?: string;
  calculator: string;
  kind: string; // 'pdf' | 'csv' | 'png' | ...
  inputsHash: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  checksum?: string;
}

export interface Attachment {
  id: string;
  kind: string;
  filename: string;
  bytes: number;
  url: string | null;
}

// ── Request / response context passed to hooks ──
export interface RequestCtx {
  endpoint: string; // logical name: 'save', 'upload', ...
  method: string;
  url: string;
  /** Headers with auth already redacted — safe to log. */
  headers: Record<string, string>;
  body?: unknown;
  attempt: number;
}

export interface ResponseCtx extends RequestCtx {
  status: number;
  ok: boolean;
  durationMs: number;
  data: unknown;
}

// ── Error surface (§9.5: redact everything except code/status) ──
export class TransportError extends Error {
  code: string;
  status: number;
  /** The request that failed, auth redacted. */
  request?: RequestCtx;
  constructor(message: string, opts: { code: string; status?: number; request?: RequestCtx } = { code: 'transport_error' }) {
    super(message);
    this.name = 'TransportError';
    this.code = opts.code;
    this.status = opts.status ?? 0;
    this.request = opts.request;
  }
}

// ── §9.4 FX rate provider (host-supplied; never hardcode a key) ──
export interface FxRateProvider {
  getRates(base: string, symbols: string[]): Promise<{ timestamp: string; rates: Record<string, string> }>;
  getHistorical?(
    base: string,
    symbols: string[],
    date: ISODate,
  ): Promise<{ timestamp: string; rates: Record<string, string> }>;
}

// ── §8.2 Payload builder ──
export type PayloadSource =
  | { kind: 'static'; value: string | number | boolean | null }
  | { kind: 'input'; path: string }
  | { kind: 'output'; path: string }
  | { kind: 'setting'; path: string }
  | { kind: 'context'; path: string }
  | { kind: 'token'; name: string }
  | { kind: 'callback'; fn: (ctx: PayloadContext) => unknown };

export interface PayloadField {
  key: string; // outgoing key; dot-path allowed → 'meta.tenantId'
  source: PayloadSource;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  required: boolean;
  transform?: 'none' | 'toFixed2' | 'toMinorUnits' | 'upper' | 'lower' | 'trim';
  omitWhenEmpty: boolean;
}

export type KeyCase = 'asIs' | 'camel' | 'snake' | 'kebab';

export interface PayloadEnvelope {
  mode: 'flat' | 'wrapped';
  wrapperKey?: string;
  keyCase: KeyCase;
  dateFormat?: string; // 'iso' (default) or a token string
  nullHandling: 'omit' | 'null';
  numberEncoding: 'string' | 'number'; // default 'string'
  include: {
    inputs: boolean;
    outputs: boolean;
    schedule: boolean; // default off — it is large
    settingsSnapshot: boolean;
    meta: boolean;
  };
}

/** Everything the payload builder can read from. */
export interface PayloadContext {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  settings: Record<string, unknown>;
  context: Record<string, unknown>; // calculator, region, computedAt, inputsHash, ...
  tokens: Record<string, string>;
  schedule?: unknown;
}

/** Input to the default §9.3 save-payload builder. */
export interface SaveContext {
  calculator: string;
  region: Region;
  settings: Settings;
  inputs: Record<string, unknown>;
  outputs: Record<string, string | number | null>;
  inputsHash: string;
  title?: string;
  tags?: string[];
  computedAt?: string;
  formula?: string;
  assumptions?: string[];
  warnings?: string[];
  attachments?: Attachment[];
  coreVersion?: string;
  clientId?: string;
  locale?: string;
  clientTz?: string;
}
