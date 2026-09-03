// ─────────────────────────────────────────────────────────────────────────
// Integration panel (§8.2) — the operable in-product surface for §9 transport.
// Renders the same TransportConfig type; config lives in local React state and
// NEVER persists a secret. Feature-gated by settings.features.integrationPanel.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { buildFilename, createTransport, redactHeaders } from '../transport/client';
import { buildPayload } from '../transport/payload';
import type {
  KeyCase,
  PayloadContext,
  PayloadEnvelope,
  PayloadField,
  PayloadSource,
  RetryConfig,
  TransportConfig,
  UploadConfig,
} from '../transport/types';

type AuthStrategy = 'none' | 'bearer' | 'apiKeyHeader' | 'basic' | 'cookie' | 'custom';
type EndpointName = keyof TransportConfig['endpoints'];

const ENDPOINT_NAMES: EndpointName[] = ['save', 'update', 'get', 'list', 'delete', 'upload', 'uploadUrl', 'rates', 'settings'];
const METHOD_OF: Record<EndpointName, string> = {
  save: 'POST',
  update: 'PUT',
  get: 'GET',
  list: 'GET',
  delete: 'DELETE',
  upload: 'POST',
  uploadUrl: 'GET',
  rates: 'GET',
  settings: 'GET',
};
const AUTH_NEEDS_TOKEN: AuthStrategy[] = ['bearer', 'apiKeyHeader', 'basic', 'custom'];

interface EndpointRow {
  path: string;
  method: string;
  enabled: boolean;
}
interface EditableConfig {
  baseUrl: string;
  auth: { strategy: AuthStrategy; headerName: string };
  timeoutMs: number;
  credentials: RequestCredentials;
  retry: RetryConfig;
  endpoints: Record<EndpointName, EndpointRow>;
  upload: UploadConfig;
}

const DEFAULT_UPLOAD: UploadConfig = {
  strategy: 'multipart',
  fieldName: 'file',
  maxBytes: 10 * 1024 * 1024,
  accept: ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png'],
  filenameTemplate: '{calculator}-{yyyy}{MM}{dd}-{hash8}.{ext}',
  checksum: 'none',
  chunked: { enabled: false, chunkBytes: 1024 * 1024 },
};

function defaultConfig(): EditableConfig {
  const endpoints = {} as Record<EndpointName, EndpointRow>;
  for (const n of ENDPOINT_NAMES) {
    endpoints[n] = { path: `/calculations${n === 'save' || n === 'list' ? '' : n === 'get' || n === 'update' || n === 'delete' ? '/:id' : '/' + n}`, method: METHOD_OF[n], enabled: n === 'save' || n === 'list' };
  }
  return {
    baseUrl: 'https://api.example.com/v1',
    auth: { strategy: 'bearer', headerName: 'Authorization' },
    timeoutMs: 15000,
    credentials: 'same-origin',
    retry: { attempts: 3, backoff: 'exponential', baseDelayMs: 300, retryOn: [408, 429, 500, 502, 503, 504], respectRetryAfter: true },
    endpoints,
    upload: DEFAULT_UPLOAD,
  };
}

const DEFAULT_ENVELOPE: PayloadEnvelope = {
  mode: 'flat',
  keyCase: 'asIs',
  dateFormat: 'iso',
  nullHandling: 'omit',
  numberEncoding: 'string',
  include: { inputs: true, outputs: true, schedule: false, settingsSnapshot: true, meta: true },
};

const DEFAULT_FIELDS: PayloadField[] = [
  { key: 'calculator', source: { kind: 'context', path: 'calculator' }, type: 'string', required: true, omitWhenEmpty: false },
  { key: 'principal', source: { kind: 'input', path: 'principal' }, type: 'number', required: true, omitWhenEmpty: false },
  { key: 'payment', source: { kind: 'output', path: 'payment' }, type: 'number', required: false, omitWhenEmpty: false },
  { key: 'currency', source: { kind: 'setting', path: 'currency.code' }, type: 'string', required: false, omitWhenEmpty: false },
];

// A representative computed result so the live previews have something to bind to.
const SAMPLE_RESULT = {
  inputs: { principal: 2500000, annualRate: '8.65', tenureMonths: 240 },
  outputs: { payment: '21996.42', totalInterest: '2779140.80', totalPayment: '5279140.80', apr: null as null | string },
  calculator: 'loan.emi',
  inputsHash: 'sha256:9f2c1a44e0',
};

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function authHeaderFor(strategy: AuthStrategy, headerName: string, token: string): Record<string, string> {
  switch (strategy) {
    case 'bearer':
      return { Authorization: `Bearer ${token}` };
    case 'basic':
      return { Authorization: `Basic ${token}` };
    case 'apiKeyHeader':
    case 'custom':
      return { [headerName || 'X-API-Key']: token };
    case 'cookie':
    case 'none':
    default:
      return {};
  }
}

function resolveUrl(baseUrl: string, path: string): string {
  if (!path) return baseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

const TABS = ['Connection', 'Endpoints', 'Upload', 'Payload', 'Test', 'cURL', 'Queue'] as const;
type Tab = (typeof TABS)[number];

export interface IntegrationPanelProps {
  /** Config the host passed as a prop — any field it set renders read-only. */
  hostConfig?: Partial<TransportConfig>;
  /** Host token resolver. When present the token row is read-only, never an input. */
  getToken?: () => string | Promise<string>;
}

export function IntegrationPanel({ hostConfig, getToken }: IntegrationPanelProps = {}) {
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>('Connection');
  const [cfg, setCfg] = useState<EditableConfig>(defaultConfig);
  const [envelope, setEnvelope] = useState<PayloadEnvelope>(DEFAULT_ENVELOPE);
  const [fields, setFields] = useState<PayloadField[]>(DEFAULT_FIELDS);

  if (!settings.features.integrationPanel) {
    return (
      <section className="card" data-part="integration-panel">
        <div className="panel-head">
          <h2>Integration</h2>
          <p>The integration panel is disabled. Enable <code>features.integrationPanel</code> to configure transport.</p>
        </div>
      </section>
    );
  }

  const hostLocked = (k: keyof TransportConfig): boolean => hostConfig != null && hostConfig[k] !== undefined;
  const patch = (p: Partial<EditableConfig>) => setCfg((c) => ({ ...c, ...p }));

  // Sample payload context for live previews.
  const sampleCtx: PayloadContext = {
    inputs: SAMPLE_RESULT.inputs,
    outputs: SAMPLE_RESULT.outputs,
    settings: settings as unknown as Record<string, unknown>,
    context: { calculator: SAMPLE_RESULT.calculator, region: settings.region, inputsHash: SAMPLE_RESULT.inputsHash, computedAt: '2026-09-03T13:27:04.512Z' },
    tokens: {},
  };

  return (
    <section className="card" data-part="integration-panel">
      <div className="panel-head">
        <h2>Integration</h2>
        <p>Point the library at your backend without a code change. Nothing here stores a secret.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Integration settings">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab}>
        {tab === 'Connection' && (
          <ConnectionBlock cfg={cfg} patch={patch} hostLocked={hostLocked} getToken={getToken} />
        )}
        {tab === 'Endpoints' && <EndpointsBlock cfg={cfg} setCfg={setCfg} locked={hostLocked('endpoints')} />}
        {tab === 'Upload' && (
          <UploadBlock
            upload={cfg.upload}
            baseUrl={cfg.baseUrl}
            uploadUri={resolveUrl(cfg.baseUrl, cfg.endpoints.upload.path)}
            onChange={(u) => patch({ upload: u })}
            locked={hostLocked('upload')}
          />
        )}
        {tab === 'Payload' && (
          <PayloadBlock
            fields={fields}
            setFields={setFields}
            envelope={envelope}
            setEnvelope={setEnvelope}
            ctx={sampleCtx}
          />
        )}
        {tab === 'Test' && <TestBlock cfg={cfg} getToken={getToken} />}
        {tab === 'cURL' && <CurlBlock cfg={cfg} />}
        {tab === 'Queue' && <QueueBlock cfg={cfg} getToken={getToken} />}
      </div>

      <ConfigIO cfg={cfg} setCfg={setCfg} />
    </section>
  );
}

// ── locked-field wrapper ──
function Locked({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div style={{ opacity: on ? 0.7 : 1 }}>
      {children}
      {on && <div className="int-note">Set by your organisation — read-only.</div>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  readOnly,
  affix,
  help,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  affix?: string;
  help?: string;
}) {
  return (
    <label className="field">
      <span className="lbl">
        {label}
        {help && <span className="help" title={help}> ⓘ</span>}
      </span>
      <div className="input-wrap">
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-label={label}
          style={{ textAlign: 'left' }}
        />
        {affix && <span className="affix">{affix}</span>}
      </div>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[] | Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      <div className="input-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

// ── 1. Connection ──
function ConnectionBlock({
  cfg,
  patch,
  hostLocked,
  getToken,
}: {
  cfg: EditableConfig;
  patch: (p: Partial<EditableConfig>) => void;
  hostLocked: (k: keyof TransportConfig) => boolean;
  getToken?: () => string | Promise<string>;
}) {
  const needsToken = AUTH_NEEDS_TOKEN.includes(cfg.auth.strategy);
  return (
    <div className="grid two">
      <Locked on={hostLocked('baseUrl')}>
        <TextField label="Base URL" value={cfg.baseUrl} onChange={(v) => patch({ baseUrl: v })} help="Absolute origin + base path" />
      </Locked>

      <SelectField
        label="Auth strategy"
        value={cfg.auth.strategy}
        options={['none', 'bearer', 'apiKeyHeader', 'basic', 'cookie', 'custom'] as AuthStrategy[]}
        onChange={(v) => patch({ auth: { ...cfg.auth, strategy: v } })}
      />

      {(cfg.auth.strategy === 'apiKeyHeader' || cfg.auth.strategy === 'custom') && (
        <TextField label="Header name" value={cfg.auth.headerName} onChange={(v) => patch({ auth: { ...cfg.auth, headerName: v } })} />
      )}

      {/* Token is NEVER an input. */}
      {needsToken && (
        <div className="field span2">
          <span className="lbl">Token</span>
          {getToken ? (
            <div className="input-wrap" style={{ background: 'var(--fc-accent-weak)' }}>
              <input value="•••••••••• supplied by host application" readOnly aria-label="token supplied by host" style={{ textAlign: 'left' }} />
            </div>
          ) : (
            <div className="notice">
              No <code>getToken</code> supplied by the host — endpoints that require auth are disabled. The panel never
              accepts a token as input.
            </div>
          )}
        </div>
      )}

      <Locked on={hostLocked('timeoutMs')}>
        <TextField label="Timeout" type="number" value={String(cfg.timeoutMs)} onChange={(v) => patch({ timeoutMs: Number(v) || 0 })} affix="ms" />
      </Locked>

      <Locked on={hostLocked('credentials')}>
        <SelectField
          label="Credentials"
          value={cfg.credentials}
          options={['omit', 'same-origin', 'include'] as RequestCredentials[]}
          onChange={(v) => patch({ credentials: v })}
        />
      </Locked>

      <Locked on={hostLocked('retry')}>
        <TextField label="Retry attempts" type="number" value={String(cfg.retry.attempts)} onChange={(v) => patch({ retry: { ...cfg.retry, attempts: Number(v) || 1 } })} />
      </Locked>

      <SelectField
        label="Backoff"
        value={cfg.retry.backoff}
        options={['fixed', 'exponential'] as Array<'fixed' | 'exponential'>}
        onChange={(v) => patch({ retry: { ...cfg.retry, backoff: v } })}
      />

      <TextField label="Base delay" type="number" value={String(cfg.retry.baseDelayMs)} onChange={(v) => patch({ retry: { ...cfg.retry, baseDelayMs: Number(v) || 0 } })} affix="ms" />

      <TextField
        label="Retry on (status codes)"
        value={cfg.retry.retryOn.join(', ')}
        onChange={(v) => patch({ retry: { ...cfg.retry, retryOn: v.split(',').map((s) => Number(s.trim())).filter(Number.isFinite) } })}
        help="Comma-separated HTTP status codes"
      />
    </div>
  );
}

// ── 2. Endpoints ──
function EndpointsBlock({ cfg, setCfg, locked }: { cfg: EditableConfig; setCfg: (f: (c: EditableConfig) => EditableConfig) => void; locked: boolean }) {
  const set = (n: EndpointName, row: Partial<EndpointRow>) =>
    setCfg((c) => ({ ...c, endpoints: { ...c.endpoints, [n]: { ...c.endpoints[n], ...row } } }));
  return (
    <Locked on={locked}>
      <div className="int-table-wrap">
        <table className="int-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Path</th>
              <th>On</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINT_NAMES.map((n) => {
              const row = cfg.endpoints[n];
              return (
                <tr key={n}>
                  <td><strong>{n}</strong></td>
                  <td>
                    <select value={row.method} onChange={(e) => set(n, { method: e.target.value })} aria-label={`${n} method`}>
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={row.path} onChange={(e) => set(n, { path: e.target.value })} aria-label={`${n} path`} className="int-cell-input" />
                    <div className="int-note mono">{resolveUrl(cfg.baseUrl, row.path)}</div>
                  </td>
                  <td>
                    <input type="checkbox" checked={row.enabled} onChange={(e) => set(n, { enabled: e.target.checked })} aria-label={`${n} enabled`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Locked>
  );
}

// ── 3. Upload ──
function UploadBlock({ upload, baseUrl, uploadUri, onChange, locked }: { upload: UploadConfig; baseUrl: string; uploadUri: string; onChange: (u: UploadConfig) => void; locked: boolean }) {
  const set = (p: Partial<UploadConfig>) => onChange({ ...upload, ...p });
  const filename = useMemo(
    () => buildFilename(upload.filenameTemplate, { calculator: 'loan.emi', kind: 'pdf', inputsHash: SAMPLE_RESULT.inputsHash, filename: 'x.pdf' }),
    [upload.filenameTemplate],
  );
  return (
    <Locked on={locked}>
      <div className="grid two">
        <TextField label="Upload URI" value={uploadUri} readOnly help="Resolved from baseUrl + the 'upload' endpoint path (edit it under Endpoints)" />
        <SelectField label="Strategy" value={upload.strategy} options={['multipart', 'presigned', 'base64Json'] as UploadConfig['strategy'][]} onChange={(v) => set({ strategy: v })} />
        <TextField label="Field name" value={upload.fieldName} onChange={(v) => set({ fieldName: v })} />
        <TextField label="Max bytes" type="number" value={String(upload.maxBytes)} onChange={(v) => set({ maxBytes: Number(v) || 0 })} affix={humanBytes(upload.maxBytes)} />

        <div className="field span2">
          <TextField label="Filename template" value={upload.filenameTemplate} onChange={(v) => set({ filenameTemplate: v })} help="{calculator} {yyyy} {MM} {dd} {hash8} {ext}" />
          <div className="int-note mono">→ {filename}</div>
        </div>

        <TextField label="Accepted MIME types" value={upload.accept.join(', ')} onChange={(v) => set({ accept: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
        <SelectField label="Checksum" value={upload.checksum ?? 'none'} options={['none', 'sha256'] as Array<'none' | 'sha256'>} onChange={(v) => set({ checksum: v })} />

        <label className="field toggle-field span2">
          <span className="lbl">Chunked upload (large PDFs)</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(upload.chunked?.enabled)}
            className={`toggle ${upload.chunked?.enabled ? 'on' : ''}`}
            onClick={() => set({ chunked: { enabled: !upload.chunked?.enabled, chunkBytes: upload.chunked?.chunkBytes ?? 1024 * 1024 } })}
            aria-label="chunked upload"
          >
            <span className="knob" />
          </button>
        </label>
        {upload.chunked?.enabled && (
          <TextField label="Chunk size" type="number" value={String(upload.chunked.chunkBytes)} onChange={(v) => set({ chunked: { enabled: true, chunkBytes: Number(v) || 1 } })} affix={humanBytes(upload.chunked.chunkBytes)} />
        )}

        {upload.strategy === 'presigned' && (
          <div className="span2 int-subform">
            <div className="int-note"><strong>Presigned sub-form</strong> — GET the <code>uploadUrl</code> endpoint, PUT the blob to the returned URL, then notify <code>save</code>. Auth headers are never sent to the presigned host.</div>
            <div className="int-note mono">uploadUrl → {resolveUrl(baseUrl, 'uploadUrl')}</div>
          </div>
        )}
      </div>
    </Locked>
  );
}

// ── 4. Payload builder ──
const SOURCE_KINDS: PayloadSource['kind'][] = ['static', 'input', 'output', 'setting', 'context', 'token', 'callback'];

function sourceLabel(s: PayloadSource): string {
  if (s.kind === 'static') return String(s.value);
  if (s.kind === 'token') return s.name;
  if (s.kind === 'callback') return 'fn()';
  return s.path;
}

function setSourceValue(s: PayloadSource, v: string): PayloadSource {
  if (s.kind === 'static') return { kind: 'static', value: v };
  if (s.kind === 'token') return { kind: 'token', name: v };
  if (s.kind === 'callback') return s;
  return { kind: s.kind, path: v } as PayloadSource;
}

function changeKind(kind: PayloadSource['kind']): PayloadSource {
  switch (kind) {
    case 'static':
      return { kind: 'static', value: '' };
    case 'token':
      return { kind: 'token', name: 'tenantId' };
    case 'callback':
      return { kind: 'callback', fn: () => null };
    default:
      return { kind, path: '' } as PayloadSource;
  }
}

function PayloadBlock({
  fields,
  setFields,
  envelope,
  setEnvelope,
  ctx,
}: {
  fields: PayloadField[];
  setFields: (f: PayloadField[]) => void;
  envelope: PayloadEnvelope;
  setEnvelope: (e: PayloadEnvelope) => void;
  ctx: PayloadContext;
}) {
  const preview = useMemo(() => {
    try {
      return JSON.stringify(buildPayload(fields, envelope, ctx), null, 2);
    } catch (e) {
      return `// ${e instanceof Error ? e.message : 'preview failed'}`;
    }
  }, [fields, envelope, ctx]);

  const setField = (i: number, p: Partial<PayloadField>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    setFields(next);
  };
  const setInc = (k: keyof PayloadEnvelope['include'], v: boolean) => setEnvelope({ ...envelope, include: { ...envelope.include, [k]: v } });

  return (
    <div className="int-cols">
      <div>
        {/* envelope controls */}
        <div className="grid two">
          <SelectField label="Envelope" value={envelope.mode} options={['flat', 'wrapped'] as Array<'flat' | 'wrapped'>} onChange={(v) => setEnvelope({ ...envelope, mode: v })} />
          {envelope.mode === 'wrapped' && <TextField label="Wrapper key" value={envelope.wrapperKey ?? 'data'} onChange={(v) => setEnvelope({ ...envelope, wrapperKey: v })} />}
          <SelectField label="Key case" value={envelope.keyCase} options={['asIs', 'camel', 'snake', 'kebab'] as KeyCase[]} onChange={(v) => setEnvelope({ ...envelope, keyCase: v })} />
          <SelectField label="Null handling" value={envelope.nullHandling} options={['omit', 'null'] as Array<'omit' | 'null'>} onChange={(v) => setEnvelope({ ...envelope, nullHandling: v })} />
          <SelectField label="Number encoding" value={envelope.numberEncoding} options={['string', 'number'] as Array<'string' | 'number'>} onChange={(v) => setEnvelope({ ...envelope, numberEncoding: v })} />
        </div>

        {envelope.numberEncoding === 'number' && (
          <div className="error" role="alert" style={{ marginTop: 10 }}>
            Encoding a Decimal as a JSON number reintroduces the float error this library exists to prevent. Prefer
            <strong> string</strong>.
          </div>
        )}

        <div className="int-includes">
          {(['inputs', 'outputs', 'schedule', 'settingsSnapshot', 'meta'] as Array<keyof PayloadEnvelope['include']>).map((k) => (
            <label key={k} className="int-chk">
              <input type="checkbox" checked={envelope.include[k]} onChange={(e) => setInc(k, e.target.checked)} /> {k}
              {k === 'schedule' && <span className="int-note"> (large)</span>}
            </label>
          ))}
        </div>

        {/* field table */}
        <div className="int-table-wrap" style={{ marginTop: 12 }}>
          <table className="int-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Source</th>
                <th>Value / path</th>
                <th>Type</th>
                <th>Transform</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i}>
                  <td><input value={f.key} onChange={(e) => setField(i, { key: e.target.value })} aria-label="key" className="int-cell-input" /></td>
                  <td>
                    <select value={f.source.kind} onChange={(e) => setField(i, { source: changeKind(e.target.value as PayloadSource['kind']) })} aria-label="source kind">
                      {SOURCE_KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={sourceLabel(f.source)}
                      disabled={f.source.kind === 'callback'}
                      onChange={(e) => setField(i, { source: setSourceValue(f.source, e.target.value) })}
                      aria-label="source value"
                      className="int-cell-input"
                    />
                  </td>
                  <td>
                    <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as PayloadField['type'] })} aria-label="type">
                      {['string', 'number', 'boolean', 'date', 'json'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={f.transform ?? 'none'} onChange={(e) => setField(i, { transform: e.target.value as PayloadField['transform'] })} aria-label="transform">
                      {['none', 'toFixed2', 'toMinorUnits', 'upper', 'lower', 'trim'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="int-rowbtns">
                    <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="move up">↑</button>
                    <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="move down">↓</button>
                    <button type="button" className="icon-btn" onClick={() => setFields(fields.filter((_, j) => j !== i))} aria-label="remove row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="icon-btn"
          style={{ marginTop: 10 }}
          onClick={() => setFields([...fields, { key: 'newKey', source: { kind: 'static', value: '' }, type: 'string', required: false, omitWhenEmpty: true }])}
        >
          + Add field
        </button>
      </div>

      {/* live JSON preview */}
      <div>
        <span className="lbl">Live preview (against a sample computed result)</span>
        <pre className="int-preview" aria-label="payload preview">{preview}</pre>
      </div>
    </div>
  );
}

// ── build a real TransportConfig from the editable state ──
function toTransportConfig(cfg: EditableConfig, getToken?: () => string | Promise<string>): TransportConfig {
  const endpoints: TransportConfig['endpoints'] = {};
  for (const n of ENDPOINT_NAMES) {
    const row = cfg.endpoints[n];
    if (row.enabled && row.path) endpoints[n] = row.path;
  }
  return {
    baseUrl: cfg.baseUrl,
    endpoints,
    credentials: cfg.credentials,
    timeoutMs: cfg.timeoutMs,
    retry: cfg.retry,
    upload: cfg.upload,
    offlineQueue: { enabled: true, storage: 'memory', maxItems: 200, flushOn: 'manual' },
    getAuth: getToken ? async () => authHeaderFor(cfg.auth.strategy, cfg.auth.headerName, await getToken()) : undefined,
  };
}

// ── 5. Test connection ──
function TestBlock({ cfg, getToken }: { cfg: EditableConfig; getToken?: () => string | Promise<string> }) {
  const [state, setState] = useState<{ loading: boolean; ok?: boolean; status?: number; ms?: number; headers?: Record<string, string>; body?: string; error?: string; sent?: { url: string; method: string; headers: Record<string, string> } }>({ loading: false });
  const [endpoint, setEndpoint] = useState<EndpointName>('save');

  const run = async () => {
    setState({ loading: true });
    const row = cfg.endpoints[endpoint];
    const url = resolveUrl(cfg.baseUrl, row.path).replace(/:id\b/, 'sample-id');
    const headers: Record<string, string> = { 'content-type': 'application/json', 'X-FinCalc-Test': '1' };
    if (getToken) Object.assign(headers, authHeaderFor(cfg.auth.strategy, cfg.auth.headerName, await getToken()));
    const started = performance.now();
    try {
      const res = await fetch(url, { method: row.method, headers, credentials: cfg.credentials });
      const body = await res.text();
      const hdrs: Record<string, string> = {};
      res.headers.forEach((v, k) => (hdrs[k] = v));
      setState({ loading: false, ok: res.ok, status: res.status, ms: Math.round(performance.now() - started), headers: hdrs, body: pretty(body), sent: { url, method: row.method, headers: redactHeaders(headers) } });
    } catch (e) {
      setState({ loading: false, ok: false, ms: Math.round(performance.now() - started), error: e instanceof Error ? e.message : 'request failed', sent: { url, method: row.method, headers: redactHeaders(headers) } });
    }
  };

  return (
    <div>
      <div className="grid two">
        <SelectField label="Endpoint" value={endpoint} options={ENDPOINT_NAMES} onChange={setEndpoint} />
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="icon-btn" onClick={run} disabled={state.loading}>
            {state.loading ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
      <div aria-live="polite">
        {state.status != null && (
          <div className="int-note">
            <strong className={state.ok ? 'pos-txt' : 'neg-txt'}>{state.status}</strong> in {state.ms} ms
          </div>
        )}
        {state.error && <div className="error" role="alert" style={{ marginTop: 8 }}>{state.error}</div>}
        {state.headers && (
          <>
            <span className="lbl" style={{ marginTop: 8 }}>Response headers</span>
            <pre className="int-preview">{JSON.stringify(state.headers, null, 2)}</pre>
          </>
        )}
        {state.body && (
          <>
            <span className="lbl">Response body</span>
            <pre className="int-preview">{state.body}</pre>
          </>
        )}
        {state.ok === false && state.sent && (
          <>
            <span className="lbl">Request sent (auth redacted)</span>
            <pre className="int-preview">{`${state.sent.method} ${state.sent.url}\n${JSON.stringify(state.sent.headers, null, 2)}`}</pre>
          </>
        )}
      </div>
    </div>
  );
}

// ── 6. Copy as cURL ──
function CurlBlock({ cfg }: { cfg: EditableConfig }) {
  const [includeAuth, setIncludeAuth] = useState(false);
  const [endpoint, setEndpoint] = useState<EndpointName>('save');
  const row = cfg.endpoints[endpoint];
  const url = resolveUrl(cfg.baseUrl, row.path).replace(/:id\b/, 'sample-id');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (AUTH_NEEDS_TOKEN.includes(cfg.auth.strategy)) headers[cfg.auth.strategy === 'apiKeyHeader' || cfg.auth.strategy === 'custom' ? cfg.auth.headerName || 'X-API-Key' : 'Authorization'] = includeAuth ? '<token>' : '***';
  const parts = [`curl -X ${row.method} '${url}'`];
  for (const [k, v] of Object.entries(headers)) parts.push(`  -H '${k}: ${v}'`);
  if (['POST', 'PUT', 'PATCH'].includes(row.method)) parts.push(`  -d '{"example":"body"}'`);
  const curl = parts.join(' \\\n');
  return (
    <div>
      <div className="grid two">
        <SelectField label="Endpoint" value={endpoint} options={ENDPOINT_NAMES} onChange={setEndpoint} />
        <label className="field toggle-field">
          <span className="lbl">Include auth (unsafe)</span>
          <button type="button" role="switch" aria-checked={includeAuth} className={`toggle ${includeAuth ? 'on' : ''}`} onClick={() => setIncludeAuth((v) => !v)} aria-label="include auth">
            <span className="knob" />
          </button>
        </label>
      </div>
      <pre className="int-preview">{curl}</pre>
      <button type="button" className="icon-btn" onClick={() => navigator.clipboard?.writeText(curl)}>Copy</button>
    </div>
  );
}

// ── 7. Queue inspector ──
function QueueBlock({ cfg, getToken }: { cfg: EditableConfig; getToken?: () => string | Promise<string> }) {
  const transport = useMemo(() => createTransport(toTransportConfig(cfg, getToken)), [cfg, getToken]);
  const [items, setItems] = useState(() => transport.queue.list());
  const [msg, setMsg] = useState('');
  const refresh = () => setItems(transport.queue.list());
  return (
    <div>
      <div className="actions-row" style={{ marginTop: 0 }}>
        <button type="button" className="icon-btn" onClick={refresh}>Refresh</button>
        <button type="button" className="icon-btn" onClick={async () => { const r = await transport.queue.flush(); setMsg(`Flushed ${r.flushed}, ${r.failed} failed`); refresh(); }}>Flush</button>
        <button type="button" className="icon-btn" onClick={() => { transport.queue.clear(); refresh(); }}>Clear</button>
      </div>
      {msg && <div className="int-note">{msg}</div>}
      {items.length === 0 ? (
        <div className="int-note" style={{ marginTop: 12 }}>No pending items. Mutations queue here automatically when the network is unavailable.</div>
      ) : (
        <div className="int-table-wrap" style={{ marginTop: 12 }}>
          <table className="int-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>URL</th>
                <th>Retries</th>
                <th>Last error</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.method}</td>
                  <td className="mono">{it.url}</td>
                  <td>{it.retryCount}</td>
                  <td className="neg-txt">{it.lastError ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Import / export whole config as JSON (no secrets — functions are dropped by JSON) ──
function ConfigIO({ cfg, setCfg }: { cfg: EditableConfig; setCfg: (f: (c: EditableConfig) => EditableConfig) => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const doExport = () => {
    setText(JSON.stringify(cfg, null, 2));
    setNote('Exported. Callbacks and any secret fields are never included.');
  };
  const doImport = () => {
    try {
      const parsed = JSON.parse(text);
      // Refuse to import secrets: no token / apiKey / getAuth persisted through the panel.
      for (const bad of ['token', 'apiKey', 'getAuth', 'authorization']) {
        if (bad in parsed) {
          delete parsed[bad];
          setNote(`Refused to import "${bad}" — the panel never persists a secret.`);
        }
      }
      setCfg(() => ({ ...defaultConfig(), ...parsed }));
      if (!note) setNote('Imported.');
    } catch {
      setNote('Invalid JSON.');
    }
  };
  return (
    <div className="accordion" style={{ marginTop: 20 }}>
      <span className="lbl">Import / export config (JSON)</span>
      <textarea className="int-preview" style={{ width: '100%', minHeight: 100 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="config JSON" />
      <div className="actions-row" style={{ marginTop: 8 }}>
        <button type="button" className="icon-btn" onClick={doExport}>Export</button>
        <button type="button" className="icon-btn" onClick={doImport}>Import</button>
      </div>
      {note && <div className="int-note">{note}</div>}
    </div>
  );
}

function pretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
