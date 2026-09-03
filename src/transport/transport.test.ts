import { describe, it, expect, vi } from 'vitest';
import { createTransport, sanitizeFilename } from './client';
import { buildPayload } from './payload';
import type { PayloadContext, PayloadEnvelope, PayloadField, TransportConfig, UploadConfig } from './types';

const UPLOAD: UploadConfig = {
  strategy: 'multipart',
  fieldName: 'file',
  maxBytes: 10 * 1024 * 1024,
  accept: [],
  filenameTemplate: '{calculator}-{yyyy}{MM}{dd}-{hash8}.{ext}',
};

function baseConfig(fetchImpl: typeof fetch, over: Partial<TransportConfig> = {}): TransportConfig {
  return {
    baseUrl: 'https://api.test',
    endpoints: { save: '/calc', uploadUrl: '/presign' },
    fetch: fetchImpl,
    upload: UPLOAD,
    retry: { attempts: 3, backoff: 'fixed', baseDelayMs: 0, retryOn: [503], respectRetryAfter: false },
    offlineQueue: { enabled: false, storage: 'memory', maxItems: 10, flushOn: 'manual' },
    ...over,
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('retry', () => {
  it('retries on 503 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: 'busy' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'calc_1' }));
    const t = createTransport(baseConfig(fetchMock as unknown as typeof fetch));

    const res = await t.save({ meta: { inputsHash: 'sha256:abc' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ id: 'calc_1' });
  });
});

describe('idempotency', () => {
  it('sends a stable Idempotency-Key for the same inputsHash', async () => {
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const h = init.headers as Record<string, string>;
      seen.push(h['Idempotency-Key']!);
      return jsonResponse(200, { id: 'x' });
    });
    const t = createTransport(baseConfig(fetchMock as unknown as typeof fetch));

    const body = { meta: { inputsHash: 'sha256:deadbeef' } };
    await t.save(body);
    await t.save(body);

    expect(seen[0]).toBe('sha256:deadbeef');
    expect(seen[0]).toBe(seen[1]); // stable across calls
  });
});

describe('buildPayload', () => {
  const ctx: PayloadContext = {
    inputs: { principal: 2500000, annualRate: '8.65' },
    outputs: { totalInterest: 2779140.8 },
    settings: { currency: { code: 'INR' } },
    context: { calculator: 'loan.emi', region: 'IN' },
    tokens: {},
  };
  const env = (over: Partial<PayloadEnvelope> = {}): PayloadEnvelope => ({
    mode: 'flat',
    keyCase: 'asIs',
    nullHandling: 'omit',
    numberEncoding: 'string',
    include: { inputs: false, outputs: false, schedule: false, settingsSnapshot: false, meta: false },
    ...over,
  });

  const fields: PayloadField[] = [
    { key: 'principal', source: { kind: 'input', path: 'principal' }, type: 'number', required: true, omitWhenEmpty: false },
    {
      key: 'totalInterest',
      source: { kind: 'output', path: 'totalInterest' },
      type: 'number',
      required: false,
      omitWhenEmpty: false,
    },
  ];

  it('emits numbers as strings by default', () => {
    const body = buildPayload(fields, env(), ctx) as Record<string, unknown>;
    expect(body.principal).toBe('2500000');
    expect(body.totalInterest).toBe('2779140.8');
    expect(typeof body.principal).toBe('string');
  });

  it('respects keyCase (snake)', () => {
    const body = buildPayload(fields, env({ keyCase: 'snake' }), ctx) as Record<string, unknown>;
    expect(body.total_interest).toBe('2779140.8');
    expect(body.totalInterest).toBeUndefined();
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators and leading dots', () => {
    const out = sanitizeFilename('../../etc/pas\\swd.pdf');
    expect(out).not.toMatch(/[\\/]/);
    expect(out.startsWith('.')).toBe(false);
  });
});

describe('presigned upload', () => {
  it('calls uploadUrl then PUTs the blob', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: (init.method || 'GET').toUpperCase() });
      if (url.includes('/presign')) {
        return jsonResponse(200, { url: 'https://s3.test/put-here', method: 'PUT', publicUrl: 'https://cdn.test/f.pdf' });
      }
      return new Response(null, { status: 200 }); // the PUT
    });

    const t = createTransport(
      baseConfig(fetchMock as unknown as typeof fetch, {
        endpoints: { uploadUrl: '/presign' }, // no save endpoint → returns attachment
        upload: { ...UPLOAD, strategy: 'presigned' },
      }),
    );

    const blob = new Blob(['hello'], { type: 'application/pdf' });
    const att = (await t.upload(blob, {
      calculator: 'loan.emi',
      kind: 'pdf',
      inputsHash: 'sha256:9f2c1a44',
      contentType: 'application/pdf',
    })) as { url: string | null };

    expect(calls[0]!.url).toContain('/presign');
    expect(calls[0]!.method).toBe('GET');
    expect(calls[1]!.url).toBe('https://s3.test/put-here');
    expect(calls[1]!.method).toBe('PUT');
    expect(att.url).toBe('https://cdn.test/f.pdf');
  });
});
