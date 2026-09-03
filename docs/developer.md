# 🏗️ Developer Guide

How CalcSuite is built, and how to extend it.

---

## 📁 Layout

```
src/
├── core/
│   ├── decimal.ts       ⚙️ configured Decimal + eq/gt/lt/isZeroish
│   ├── finance.ts       💰 annuity / TVM / XIRR / IRR / NPV / MIRR / CAGR (Decimal)
│   ├── format.ts        🔢 settings-driven Formatter (grouping, currency, abbreviate)
│   ├── kit.ts           📜 the calculator contract (CalculatorDef / FieldSchema / ResultView)
│   ├── loan.ts          🏦 EMI engine (solve any of payment/amount/rate/term, amortisation)
│   ├── currency.ts      💱 currency data + Decimal conversion + Intl formatting
│   ├── liveRates.ts     🌐 live FX fetch (injectable, testable)
│   ├── registry.ts      🗂️ assembles all calculators + plugin API + region gating
│   └── calculators/     🧮 loans, investments, deposits, retirement_us, returns, tax, utility, scientific
├── settings/            🎛️ FinCalcSettings + context + persistence
├── export/              📤 CSV/JSON/URL/clipboard/print/ICS/markdown (+ lazy PDF/XLSX/PNG)
├── transport/           🔌 save/upload/list, retry, idempotency, offline queue, FX provider
└── ui/                  🖼️ Shell, Launcher, Dialog, CommandPalette, panels, fields, ResultCard, tables
```

---

## 🧠 Core idea: schema-driven calculators

A calculator is **data + a pure function** — not a bespoke UI. It declares an input **schema** and a `compute()` that returns a **ResultView** of already-formatted strings. One generic renderer (`ui/CalculatorPanel.tsx`) draws the form, runs `compute` live, and renders the hero result + Schedule/Chart/Formula/Assumptions tabs.

```ts
export interface CalculatorDef {
  id: string;              // 'invest.sip'
  group: 'loans' | 'invest' | 'returns' | 'tax' | 'tools';
  title: string;
  blurb?: string;
  keywords?: string[];     // for the command palette
  regions?: ('IN' | 'US')[]; // omit = both
  inputs: FieldSchema[];
  compute: (values: Values, ctx: CalcCtx) => ResultView;
  custom?: string;         // opt out of the generic form (see below)
}
```

### 🧾 `ResultView` (what compute returns)
```ts
{
  primary: { label, value, tone? },     // the hero number (already formatted)
  primaryPer?: '/month',
  secondary?: Metric[],                 // quiet supporting figures
  split?: [{ label, value, tone }],     // the principal/interest bar
  schedule?: ScheduleView,              // year-grouped or flat rows
  chart?: ChartSeries,                  // inline SVG series
  formula?, formulaSubstituted?,        // ➗ tab
  notes?, warnings?,                    // assumptions / non-fatal warnings
  raw?: Record<string, string|number|null>, // machine values for export/tests
}
```

### 🎛️ `CalcCtx` (what compute receives)
```ts
{ settings, region, fmt, D }
// fmt.money(x) / fmt.num(x, places) / fmt.pct(x)  — never format money yourself
// D(x) — Decimal factory; ALL money math in Decimal, never JS +-*/
```

---

## ➕ Add a calculator in 3 steps

1. **Write the module** — `src/core/calculators/mygroup.ts`:

```ts
import type { CalculatorDef } from '../kit';
import { dmoney, numval, metric } from '../kit';

export const myCalculators: CalculatorDef[] = [{
  id: 'invest.myThing',
  group: 'invest',
  title: 'My Thing',
  blurb: 'What it does.',
  keywords: ['my', 'thing'],
  inputs: [
    { key: 'amount', label: 'Amount', kind: 'money', default: '100000' },
    { key: 'ratePct', label: 'Rate', kind: 'percent', default: '8', suffix: '% p.a.' },
    { key: 'years', label: 'Years', kind: 'years', default: '10' },
  ],
  compute(v, ctx) {
    const fv = dmoney(v.amount).times(ctx.D(1).plus(ctx.D(numval(v.ratePct)).div(100)).pow(numval(v.years)));
    return {
      primary: metric('Future value', ctx.fmt.money(fv), 'accent'),
      secondary: [metric('Invested', ctx.fmt.money(dmoney(v.amount)))],
      formula: 'FV = P·(1+r)^n',
      raw: { fv: fv.toString() },
    };
  },
}];
```

2. **Register it** — add to `src/core/registry.ts`:
```ts
import { myCalculators } from './calculators/mygroup';
const BUILTIN = [ /* … */, ...myCalculators ];
```

3. **Test it** — `src/core/calculators/mygroup.test.ts` asserting on `result.raw` values against a known figure. Run `npx vitest run`.

That's it — the form, live compute, result card, tabs, export, save, history, i18n terminology, and region gating are all automatic. ✅

### 🎚️ Field kinds
`money` · `percent` · `int` · `number` · `tenure` (years+months → total months) · `years` · `select` · `segmented` · `date` · `toggle` · `text` · `cashflows`. Options: `default`, `suffix`, `options`, `optional`, `advanced` (collapses into "Advanced"), `showIf(values, region)` (progressive disclosure), `labelByRegion` (e.g. EMI vs Monthly Payment).

---

## 🎨 Custom panels

For calculators that need bespoke UX (solve-for-any, a keypad, live fetch), set `custom: 'key'` on the def and map the component in `ui/Shell.tsx`'s `customRegistry`. Examples: `loan.emi` → `LoanEmiPanel`, `tools.scientific` → `SciCalculator`, `tools.currency` → `CurrencyConverter`. The registry still supplies the title/blurb, so **don't render your own panel header**.

---

## 🧩 Plugin API

Consumers register calculators at runtime — no fork needed — and they get the whole UI (form, validation, export, history, theming) for free:

```ts
import { registerCalculator } from 'calcsuite';
registerCalculator(myCalculatorDef); // same CalculatorDef shape; then render <CalculatorPanel id="my.id" />
```

(Contributors adding a *built-in* calculator instead add it to `src/core/registry.ts` per the 3 steps above.)

Region-gate with `regions`, and the plugin's numbers stay consistent because it uses the same `CalcCtx` (configured Decimal, formatter, region).

---

## 🔢 Money rules (non-negotiable)

- ❌ **Never** a JS `Number` in a money path. Use `ctx.D(...)` / `decimal.js`.
- ✅ Read inputs with `dmoney(v.k)` (Decimal, comma-safe), `numval(v.k)` (number for counts/rates), `boolval`, `strval`.
- ✅ Format **only** through `ctx.fmt` so region/rounding settings apply.
- ✅ Put machine-readable numbers in `raw` for export and tests.

---

## 🧪 Testing

- **Golden values** (`src/core/golden.test.ts`) — figures cross-checked against published bank/official calculators (per-lakh EMI, FD, SIP, XIRR…).
- **Per-calculator** tests assert on `raw`.
- **UI smoke** (`src/App.smoke.test.tsx`) — mounts the whole shell.
- **Dialog** (`src/ui/Dialog.test.tsx`) — focus trap + shortcut isolation.

```bash
npm test          # everything
npx vitest run src/core/calculators/loans.test.ts   # one file
```
