import { describe, it, expect } from 'vitest';
import {
  toCsv, toJson, importJson, toMarkdown, toIcs,
  buildShareHash, parseShareUrl, sanitizeFilename, buildFilename,
} from './index';
import type { ExportPayload } from './index';

// Minimal payload (cast where the full Settings shape isn't needed for pure fns).
const payload = {
  calculatorId: 'loan.emi',
  title: 'Home Loan EMI',
  result: {
    primary: { label: 'EMI', value: '₹12,345.00' },
    secondary: [{ label: 'Total interest', value: '₹1,00,000' }],
    schedule: {
      columns: ['Period', 'Payment', 'Note'],
      rows: [
        { label: '1', cells: ['1,000', '=1+2'] }, // formula-injection cell
        { label: '2', cells: ['1,000', 'ok'] },
      ],
    },
    raw: { emi: '12345' },
  },
  values: { principal: '1000000', rate: '8.5', months: 240, floating: true, note: 'hi' },
  settingsSnapshot: { numberFormat: { grouping: 'indian' } },
  meta: { computedAt: '2026-09-03T00:00:00.000Z', region: 'IN', currency: 'INR' },
} as unknown as ExportPayload;

describe('export pure functions', () => {
  it('CSV is injection-safe (=1+2 → \'=1+2)', () => {
    const csv = toCsv(payload);
    expect(csv).toContain("'=1+2");
    expect(csv).not.toContain(',=1+2'); // the raw formula must never sit at a cell start
  });

  it('JSON round-trips through importJson', () => {
    const back = importJson(toJson(payload));
    expect(back.calculatorId).toBe('loan.emi');
    expect(back.values).toEqual(payload.values);
  });

  it('parseShareUrl(buildShareHash(...)) round-trips', () => {
    const parsed = parseShareUrl(buildShareHash(payload.calculatorId, payload.values));
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe('loan.emi');
    expect(parsed!.values).toEqual(payload.values);
  });

  it('parseShareUrl rejects junk', () => {
    expect(parseShareUrl('')).toBeNull();
    expect(parseShareUrl('#nope=1')).toBeNull();
  });

  it('Markdown contains the title', () => {
    expect(toMarkdown(payload)).toContain('Home Loan EMI');
  });

  it('ICS is a valid minimal VCALENDAR', () => {
    const ics = toIcs(payload);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('sanitizeFilename drops path separators and leading dots', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFilename('...hidden')).not.toMatch(/^\./);
    expect(buildFilename(payload, 'csv')).toMatch(/^loan\.emi-\d{8}\.csv$/);
  });
});
