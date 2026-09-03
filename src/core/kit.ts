// ─────────────────────────────────────────────────────────────────────────
// Calculator kit — the shared contract for EVERY calculator (§11.5, §12).
// A calculator declares an input SCHEMA and a pure COMPUTE function that returns
// a ResultView of already-formatted display strings. One generic renderer draws
// the form and the result, so adding a calculator = one small module, no bespoke UI.
// ─────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { D, type DecimalT, type Numeric } from './decimal';
import type { Formatter } from './format';
import type { Settings, Region } from '../settings/settings';

export type Group = 'loans' | 'invest' | 'returns' | 'tax' | 'tools';

export type FieldKind =
  | 'money'
  | 'percent'
  | 'int'
  | 'number'
  | 'tenure' // paired years+months → value is total months (number)
  | 'years'
  | 'select'
  | 'segmented'
  | 'date'
  | 'toggle'
  | 'text'
  | 'cashflows'; // list of {date, amount} for XIRR

export type FieldValue = string | number | boolean | Array<{ date: string; amount: string }>;
export type Values = Record<string, FieldValue>;

export interface FieldSchema {
  key: string;
  label: string;
  kind: FieldKind;
  default?: FieldValue;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: 'currency' | string;
  help?: string;
  optional?: boolean;
  advanced?: boolean; // grouped into an "Advanced" accordion
  showIf?: (v: Values, region: Region) => boolean;
  /** Region-specific label override, e.g. 'EMI' vs 'Monthly payment'. */
  labelByRegion?: Partial<Record<Region, string>>;
}

export type MetricTone = 'default' | 'principal' | 'interest' | 'accent' | 'positive' | 'negative';

export interface Metric {
  label: string;
  value: string;
  tone?: MetricTone;
  sub?: string;
}

export interface ScheduleRow {
  label: string;
  cells: string[];
}

export interface ScheduleGroup {
  label: string;
  summary: string[]; // same length as columns-1
  rows: ScheduleRow[];
}

export interface ScheduleView {
  title?: string;
  columns: string[]; // includes the leading label column header
  groups?: ScheduleGroup[]; // expandable (loan years, sip years)
  rows?: ScheduleRow[]; // flat fallback
  /** column index → semantic tone for cell colouring */
  toneCols?: Record<number, 'principal' | 'interest'>;
}

export interface ChartSeries {
  labels?: string[];
  series: Array<{
    name: string;
    tone: 'principal' | 'interest' | 'accent';
    points: number[];
    area?: boolean;
    dash?: boolean;
  }>;
}

export interface ResultView {
  primary: Metric;
  primaryPer?: string; // e.g. '/month'
  secondary?: Metric[];
  split?: Array<{ label: string; value: number; tone: 'principal' | 'interest' | 'accent' }>;
  schedule?: ScheduleView;
  chart?: ChartSeries;
  formula?: string;
  formulaSubstituted?: string;
  notes?: string[]; // assumptions
  warnings?: string[];
  /** raw values for export/save; strings to stay float-safe */
  raw?: Record<string, string | number | null>;
}

export interface CalcCtx {
  settings: Settings;
  region: Region;
  fmt: Formatter;
  D: (v: Numeric) => DecimalT;
}

export interface CalculatorDef {
  id: string; // 'loan.emi', 'invest.sip', ...
  group: Group;
  title: string;
  blurb?: string;
  keywords?: string[]; // for the command palette
  regions?: Region[]; // gate by region; undefined = both
  icon?: ReactNode;
  inputs: FieldSchema[];
  compute: (values: Values, ctx: CalcCtx) => ResultView;
  /** Optional bespoke panel (scientific calculator, EMI solve-for chips, etc.). */
  custom?: string; // key resolved by the panel router
}

// ── small helpers shared by compute functions ──
export const numval = (v: FieldValue | undefined, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return fallback;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const strval = (v: FieldValue | undefined, fallback = ''): string => {
  if (v == null) return fallback;
  if (Array.isArray(v)) return fallback;
  return String(v);
};

export const boolval = (v: FieldValue | undefined, fallback = false): boolean =>
  v == null ? fallback : Boolean(v);

/** Decimal money value cleaned of grouping — never lose precision. */
export const dmoney = (v: FieldValue | undefined, fallback = '0'): DecimalT =>
  D(v == null || v === '' ? fallback : String(v).replace(/[, ]/g, ''));

export const metric = (label: string, value: string, tone: MetricTone = 'default', sub?: string): Metric => ({
  label,
  value,
  tone,
  sub,
});
