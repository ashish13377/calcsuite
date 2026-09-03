// ─────────────────────────────────────────────────────────────────────────
// Public API of the `calcsuite` package.
//
//   import { FinCalcProvider, FinCalcLauncher } from 'calcsuite-react';
//   import { loan, finance } from 'calcsuite-react';
//   import 'calcsuite-react/theme.css';   // design tokens + component styles
//
// Peer deps: react, react-dom. Runtime dep: decimal.js. Optional (lazy) for
// PDF/XLSX export: jspdf, xlsx.
// ─────────────────────────────────────────────────────────────────────────

// ── Provider & settings ──
export { SettingsProvider, SettingsProvider as FinCalcProvider, useSettings, useSettings as useFinCalc } from './settings/SettingsContext';
export { DEFAULT_SETTINGS, regionDefaults, POLICY_DEFAULT } from './settings/settings';
export type {
  Settings,
  Settings as FinCalcSettings,
  Region,
  RoundingPolicy,
  RoundingMode,
  DayCountConvention,
  Grouping,
} from './settings/settings';

// ── Launcher, dialog, shell ──
export { Launcher, Launcher as FinCalcLauncher } from './ui/Launcher';
export type { LauncherProps, LauncherApi } from './ui/Launcher';
export { Shell, Shell as FinCalcRoot } from './ui/Shell';
export { Dialog, Dialog as FinCalcDialog } from './ui/Dialog';
export { CommandPalette } from './ui/CommandPalette';

// ── Panels & components ──
export { CalculatorPanel } from './ui/CalculatorPanel';
export { LoanEmiPanel } from './ui/LoanEmiPanel';
export { SciCalculator } from './ui/SciCalculator';
export { CurrencyConverter } from './ui/CurrencyConverter';
export { SettingsPanel } from './ui/SettingsPanel';
export { HistoryPanel } from './ui/HistoryPanel';
export { ResultCard } from './ui/ResultCard';
export { ScheduleTable } from './ui/ScheduleTable';
export { Chart } from './ui/Chart';
export { Field } from './ui/fields';
export { SaveButton } from './ui/SaveButton';
export { ExportMenu } from './ui/ExportMenu';
export { IntegrationPanel } from './ui/IntegrationPanel';

// ── Hooks & history store ──
export { useHistory, saveHistory, clearHistory } from './ui/history';
export type { HistoryItem } from './ui/history';

// ── Registry & plugin API ──
export { registerCalculator, allCalculators, calculatorsForRegion, calculatorById, GROUPS } from './core/registry';

// ── Calculator contract ──
export { metric, numval, strval, boolval, dmoney } from './core/kit';
export type {
  CalculatorDef,
  FieldSchema,
  FieldKind,
  FieldValue,
  Values,
  ResultView,
  Metric,
  ScheduleView,
  ScheduleGroup,
  ScheduleRow,
  ChartSeries,
  CalcCtx,
  Group,
} from './core/kit';

// ── Core engines ──
import { solve, REGIONS } from './core/loan';
/** Loan / EMI engine. `loan.solve({ region, product?, principal, annualRatePct, tenureMonths })`. */
export const loan = { solve, REGIONS };
export { solve as solveLoan } from './core/loan';
export type { LoanInput, LoanResult, RegionProfile, Basis, SolveTarget, AmortRow, YearSummary } from './core/loan';
export { FinCalcError } from './core/loan';

export * as finance from './core/finance';
export * as currency from './core/currency';
export { fetchLiveRate } from './core/liveRates';

// ── Formatting & Decimal ──
export { makeFormatter } from './core/format';
export type { Formatter } from './core/format';
export { Decimal, D, eq, gt, lt, isZeroish } from './core/decimal';
export type { DecimalT, Numeric } from './core/decimal';

// ── Scientific expression engine (also usable to parse amount fields) ──
export { evalExpression, parse as parseExpression, evaluate as evaluateExpression } from './core/sci';

// ── Export ──
export { createExporter, EXPORT_FORMATS } from './export';
export type { ExportPayload, ExportFormat } from './export';

// ── Transport ──
export { createTransport, sanitizeFilename, buildFilename } from './transport/client';
export { buildPayload, buildSavePayload, DEFAULT_ENVELOPE } from './transport/payload';
export { createFxCache } from './transport/fx';
export type { TransportConfig, UploadConfig, PayloadField } from './transport/types';
