// ─────────────────────────────────────────────────────────────────────────
// Payload assembly (§8.2 builder + §9.3 default save shape). Framework-free.
// Numbers default to STRINGS — encoding a Decimal as a JSON number reintroduces
// exactly the float error this library exists to prevent.
// ─────────────────────────────────────────────────────────────────────────
import type {
  KeyCase,
  PayloadContext,
  PayloadEnvelope,
  PayloadField,
  PayloadSource,
  SaveContext,
} from './types';

// ── dot-path get/set ──
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: any = obj;
  for (const seg of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function setPath(obj: Record<string, any>, path: string, value: unknown): void {
  const segs = path.split('.');
  let cur: any = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]!;
    if (typeof cur[s] !== 'object' || cur[s] == null) cur[s] = {};
    cur = cur[s];
  }
  cur[segs[segs.length - 1]!] = value;
}

// ── keyCase ──
function segCase(seg: string, mode: KeyCase): string {
  if (mode === 'asIs') return seg;
  const words = seg
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return seg;
  if (mode === 'snake') return words.map((w) => w.toLowerCase()).join('_');
  if (mode === 'kebab') return words.map((w) => w.toLowerCase()).join('-');
  // camel
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

/** Apply keyCase to each dot-path segment (so 'meta.tenantId' cases both). */
export function caseKey(path: string, mode: KeyCase): string {
  return path
    .split('.')
    .map((s) => segCase(s, mode))
    .join('.');
}

// ── transforms ──
function applyTransform(v: unknown, t: NonNullable<PayloadField['transform']>): unknown {
  switch (t) {
    case 'toFixed2':
      return Number(v).toFixed(2);
    case 'toMinorUnits':
      return Math.round(Number(v) * 100);
    case 'upper':
      return String(v).toUpperCase();
    case 'lower':
      return String(v).toLowerCase();
    case 'trim':
      return String(v).trim();
    case 'none':
    default:
      return v;
  }
}

function toDate(v: unknown, dateFormat: string | undefined): unknown {
  const d = v instanceof Date ? v : new Date(v as any);
  if (Number.isNaN(d.getTime())) return String(v);
  // Only 'iso' is a real reformat; anything else keeps ISO (documented default).
  void dateFormat;
  return d.toISOString();
}

function coerce(v: unknown, type: PayloadField['type'], env: PayloadEnvelope): unknown {
  switch (type) {
    case 'number': {
      if (env.numberEncoding === 'number') {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      }
      return String(v); // float-safe default
    }
    case 'boolean':
      return typeof v === 'string' ? v.toLowerCase() === 'true' : Boolean(v);
    case 'date':
      return toDate(v, env.dateFormat);
    case 'json':
      return v;
    case 'string':
    default:
      return String(v);
  }
}

/** Recursively stringify numbers when numberEncoding='string' (for included sections). */
function encodeTree(v: unknown, numberEncoding: 'string' | 'number'): unknown {
  if (numberEncoding === 'number') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map((x) => encodeTree(x, numberEncoding));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = encodeTree(val, numberEncoding);
    return out;
  }
  return v;
}

function resolveSource(src: PayloadSource, ctx: PayloadContext): unknown {
  switch (src.kind) {
    case 'static':
      return src.value;
    case 'input':
      return getPath(ctx.inputs, src.path);
    case 'output':
      return getPath(ctx.outputs, src.path);
    case 'setting':
      return getPath(ctx.settings, src.path);
    case 'context':
      return getPath(ctx.context, src.path);
    case 'token':
      return ctx.tokens?.[src.name];
    case 'callback':
      return src.fn(ctx);
    default:
      return undefined;
  }
}

export interface BuildResult {
  body: Record<string, unknown>;
  warnings: string[];
}

/**
 * Assemble the outgoing body from PayloadField rows + envelope controls.
 * Returns the body directly (not wrapped in a result object) so callers and
 * tests can use it as-is; warnings are surfaced via console.warn.
 */
export function buildPayload(
  fields: PayloadField[],
  envelope: PayloadEnvelope,
  ctx: PayloadContext,
): Record<string, unknown> {
  const inner: Record<string, unknown> = {};

  for (const f of fields) {
    let raw = resolveSource(f.source, ctx);
    const empty = raw === '' || raw == null;
    if (f.omitWhenEmpty && empty) continue;
    const key = caseKey(f.key, envelope.keyCase);
    if (empty) {
      if (envelope.nullHandling === 'omit') continue;
      setPath(inner, key, null);
      continue;
    }
    if (f.transform && f.transform !== 'none') raw = applyTransform(raw, f.transform);
    setPath(inner, key, coerce(raw, f.type, envelope));
  }

  // include-toggles append whole standard sections
  const inc = envelope.include;
  const put = (name: string, val: unknown) => {
    if (val !== undefined) inner[caseKey(name, envelope.keyCase)] = encodeTree(val, envelope.numberEncoding);
  };
  if (inc?.inputs) put('inputs', ctx.inputs);
  if (inc?.outputs) put('outputs', ctx.outputs);
  if (inc?.schedule) put('schedule', ctx.schedule);
  if (inc?.settingsSnapshot) put('settingsSnapshot', ctx.settings);
  if (inc?.meta) put('meta', ctx.context);

  if (envelope.numberEncoding === 'number') {
    console.warn('[fincalc] numberEncoding="number" reintroduces float error; prefer "string".');
  }

  return envelope.mode === 'wrapped' && envelope.wrapperKey ? { [envelope.wrapperKey]: inner } : inner;
}

/** True when this envelope will emit unsafe JS-number values. */
export function hasNumberEncodingRisk(env: PayloadEnvelope): boolean {
  return env.numberEncoding === 'number';
}

export const DEFAULT_ENVELOPE: PayloadEnvelope = {
  mode: 'flat',
  keyCase: 'asIs',
  dateFormat: 'iso',
  nullHandling: 'omit',
  numberEncoding: 'string',
  include: { inputs: true, outputs: true, schedule: false, settingsSnapshot: true, meta: true },
};

// ── §9.3 default save payload — the documented shape, numbers as STRINGS ──
/** Convert any numeric leaf to a string; leave everything else untouched. */
function stringifyNumbers<T>(v: T): T {
  return encodeTree(v, 'string') as T;
}

/**
 * Build the exact `POST {save}` body from §9.3. All numbers become strings so
 * a Decimal never round-trips through a JSON float.
 */
export function buildSavePayload(ctx: SaveContext): Record<string, unknown> {
  const s = ctx.settings;
  return {
    schemaVersion: 1,
    clientId: ctx.clientId ?? 'fincalc-web',
    coreVersion: ctx.coreVersion ?? '0.0.0',
    calculator: ctx.calculator,
    region: ctx.region,
    currency: s.currency.code,
    locale: ctx.locale ?? s.locale,
    ...(ctx.title ? { title: ctx.title } : {}),
    ...(ctx.tags && ctx.tags.length ? { tags: ctx.tags } : {}),
    inputs: stringifyNumbers(ctx.inputs),
    settingsSnapshot: {
      rounding: {
        money: s.rounding.money,
        rate: s.rounding.rate,
        mode: s.rounding.mode,
        roundEachPeriod: s.rounding.roundEachPeriod,
        instalment: s.rounding.instalment,
        residualAbsorption: s.rounding.residualAbsorption,
      },
      dayCount: s.dayCount,
      numberFormat: { grouping: s.numberFormat.grouping, decimalPlaces: s.numberFormat.decimalPlaces },
    },
    outputs: stringifyNumbers(ctx.outputs),
    meta: {
      inputsHash: ctx.inputsHash,
      computedAt: ctx.computedAt ?? new Date().toISOString(),
      formula: ctx.formula ?? '',
      assumptions: ctx.assumptions ?? [],
      warnings: ctx.warnings ?? [],
    },
    ...(ctx.attachments && ctx.attachments.length ? { attachments: ctx.attachments } : {}),
    client: { tz: ctx.clientTz ?? guessTz(), platform: 'web' },
  };
}

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
