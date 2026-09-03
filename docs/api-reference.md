# 🧩 API Reference

Everything importable from `calcsuite`. Types ship with the package (`calcsuite` is written in TypeScript).

```ts
import { FinCalcProvider, loan, useFinCalc /* … */ } from 'calcsuite';
import 'calcsuite/theme.css';
```

---

## 🎛️ Provider & settings

| Export | Type | Purpose |
|---|---|---|
| `FinCalcProvider` | Component | App-wide settings/region/formatting context. Wrap your app in it. `<FinCalcProvider settings={Partial<FinCalcSettings>}>`. Alias of `SettingsProvider`. |
| `useFinCalc()` | Hook | `{ settings, fmt, update, setRegion, reset, replace, resolvedTheme }`. Alias of `useSettings`. |
| `DEFAULT_SETTINGS` | object | The full default settings. |
| `regionDefaults(region)` | fn | Defaults for `'IN'` or `'US'`. |
| `POLICY_DEFAULT` | object | Default rounding policy. |
| `FinCalcSettings` (`Settings`), `Region`, `RoundingPolicy`, `RoundingMode`, `DayCountConvention`, `Grouping` | types | |

See [Settings](settings.md) for the full object.

---

## 🚀 Launcher, dialog, shell

| Export | Props (key ones) | Purpose |
|---|---|---|
| `FinCalcLauncher` | `variant: 'fab'\|'inline'\|'headless'`, `icon`, `trigger`/fn-child `(api)=>ReactNode`, `position`, `hotkey`, `open`/`onOpenChange`, `className`/`style`, `dialogSize`/`dialogTitle`, `label` | Opens the suite in a dialog. **Fully customizable trigger** — any icon, any button, or render your own. Types `LauncherProps`, `LauncherApi`. |
| `FinCalcDialog` | `open`, `onClose`, `title`, `size` | Accessible modal (focus trap + host-shortcut isolation) — reuse it for your own content. |
| `FinCalcRoot` | `onClose?` | The full shell: rail + panel + top bar + command palette. Alias of `Shell`. |
| `CommandPalette` | `calculators`, `actions`, `onPick`, `onClose` | The `⌘K` fuzzy search overlay. |

---

## 🧩 Calculator components

| Export | Props | Purpose |
|---|---|---|
| `CalculatorPanel` | `id` **or** `def`, `seed?`, `customRegistry?`, `onResult?`, `actions?` | Renders any calculator from its schema: form + live result + Schedule/Chart/Formula tabs. |
| `LoanEmiPanel` | — | The flagship EMI/Loan panel (solve-for-any + full amortisation table + export). |
| `SciCalculator` | — | The scientific calculator keypad. |
| `CurrencyConverter` | — | Live/offline currency converter. |
| `SettingsPanel` | — | The full settings UI (region, currency, number format, accent, font, …). |
| `HistoryPanel` | `items`, `onRestore`, `onClear` | Saved-calculations list. |
| `ExportMenu` | `payload` | Export dropdown (CSV/PDF/XLSX/JSON/print/share/…). |
| `IntegrationPanel` | — | Backend integration UI (gated by `features.integrationPanel`). |
| `ResultCard`, `ScheduleTable`, `Chart`, `Field`, `SaveButton` | see types | Low-level building blocks. |

---

## 🪝 Hooks & history store

| Export | Signature | Purpose |
|---|---|---|
| `useFinCalc()` | → context | Settings & formatting. |
| `useHistory()` | → `{ items, save, clear }` | Reactive saved-calculations list (shared store, persisted). |
| `saveHistory(item)` / `clearHistory()` | fns | Imperative history writes (usable outside React). |
| `HistoryItem` | type | `{ id, title, primary, values, at }`. |

---

## 🗂️ Registry & plugin API

| Export | Signature | Purpose |
|---|---|---|
| `registerCalculator(def)` | `(CalculatorDef) => void` | Add your own calculator (gets form, export, history, theming for free). |
| `allCalculators()` | → `CalculatorDef[]` | Built-ins + plugins. |
| `calculatorsForRegion(region)` | → `CalculatorDef[]` | Filtered by region. |
| `calculatorById(id)` | → `CalculatorDef \| undefined` | Look up one. |
| `GROUPS` | array | `[{ id, label }]` for `loans/invest/returns/tax/tools`. |

See [Extending the library](developer.md).

---

## 🧮 Engine (pure functions)

### `loan`
```ts
loan.solve(input: LoanInput): LoanResult   // solve payment | principal | rate | tenure (omit the target)
loan.REGIONS                               // region profiles
```
`LoanResult` includes `payment`, `principal`, `annualRatePct`, `totalInterest`, `totalPayment`, `schedule` (rows), `byYear`, `chart`, `equivalentReducingRatePct?`, `formula` — all `Decimal`.

### `finance` (namespace)
`periodic`, `fvAnnuity`, `fvLump`, `pvAnnuity`, `pvLump`, `pmt`, `nper`, `bisectRate`, `npv`, `irr`, `xnpv`, `xirr`, `cagr` — all Decimal-based.

### `currency` (namespace)
`CURRENCIES`, `convert`, `inverseRate`, `formatCurrency`, `currencyDecimals`, `stalenessLabel`, `isStale`, `currencyByCode`. Plus `fetchLiveRate(from, to, { fetchImpl?, signal? })` for live rates.

### Expression engine
`evalExpression(input, opts?)` → `{ value: Decimal, error? }`, plus `parseExpression` / `evaluateExpression`. Powers the scientific calculator and can parse expressions in your own inputs (`"45000*12"` → `540000`).

### Formatting & Decimal
`makeFormatter(settings)` → `{ money, num, pct, compact, moneyParts, round }`. `Decimal`, `D`, `eq`, `gt`, `lt`, `isZeroish`. Types `DecimalT`, `Numeric`.

---

## 📤 Export

```ts
import { createExporter } from 'calcsuite';
const exporter = createExporter();
await exporter.export('pdf', payload);   // 'csv'|'tsv'|'json'|'url'|'clipboard'|'markdown'|'print'|'ics'|'pdf'|'xlsx'|'png'|'qr'
```
`EXPORT_FORMATS`, types `ExportPayload`, `ExportFormat`. See [Features → Export](features.md#-export).

---

## 🔌 Transport

```ts
import { createTransport } from 'calcsuite';
const transport = createTransport(config);  // save/update/get/list/delete/upload/getRates/queue
```
Also `buildPayload`, `buildSavePayload`, `DEFAULT_ENVELOPE`, `createFxCache`, `sanitizeFilename`, `buildFilename`. Types `TransportConfig`, `UploadConfig`, `PayloadField`. See [Backend integration](backend-integration.md).

---

## 📐 The calculator contract (types)

```ts
CalculatorDef   // { id, group, title, blurb?, keywords?, regions?, inputs, compute, custom? }
FieldSchema     // one input field
Values          // Record<string, FieldValue>
ResultView      // { primary, secondary?, split?, schedule?, chart?, formula?, notes?, warnings?, raw? }
CalcCtx         // { settings, region, fmt, D } passed to compute()
Metric, ScheduleView, ChartSeries, Group, FieldKind
```
Helpers: `metric`, `numval`, `strval`, `boolval`, `dmoney`. Full walkthrough in [Extending the library](developer.md).
