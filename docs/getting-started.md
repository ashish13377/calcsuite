# 🧭 Installation & Quickstart

## 📦 Install

```bash
npm install calcsuite-react
# yarn add calcsuite-react
# pnpm add calcsuite-react
```

That's all — **`decimal.js` is a dependency and installs automatically**. `react` and `react-dom` are peer deps you already have (18.3+ / 19).

**Optional**, only if you use PDF/XLSX export (lazy-loaded on first use):

```bash
npm install jspdf xlsx      # yarn add jspdf xlsx
```

Import the stylesheet once (design tokens + component styles):

```ts
import 'calcsuite-react/theme.css';
```

---

## ⚡ Quickstart — the launcher (recommended)

The fastest integration is **one provider + one launcher**: a floating calculator button that opens the entire calculator suite in a focus-trapped dialog.

```tsx
import { FinCalcProvider, FinCalcLauncher } from 'calcsuite-react';
import 'calcsuite-react/theme.css';

export default function App() {
  return (
    <FinCalcProvider settings={{ region: 'IN' }}>
      <YourApp />
      <FinCalcLauncher variant="fab" position="bottom-right" />
    </FinCalcProvider>
  );
}
```

That's it — you get every calculator, settings, history, export, search palette (`⌘K`), and keyboard support. While the dialog is open it **traps focus and blocks your app's own keyboard shortcuts** so nothing leaks through.

---

## 🎨 Customize the launcher

The launcher trigger is **fully customizable** — any icon, any button, or render your own UI entirely.

```tsx
// Default FAB (built-in calculator icon), accent-coloured (follows settings.ui.accent)
<FinCalcLauncher />

// Any icon inside the FAB — emoji, SVG, <img>, or a component
<FinCalcLauncher icon={<MyCalcIcon />} />
<FinCalcLauncher icon="💰" position="bottom-left" className="my-fab" style={{ background: '#111' }} />

// Inline button in your own toolbar
<FinCalcLauncher variant="inline" label="Open calculators" icon={<CalcIcon />} />

// Bring your OWN trigger — any button/element/UI (headless)
<FinCalcLauncher trigger={({ toggle, open }) => (
  <MyButton onClick={toggle}>{open ? 'Close' : 'Calculators'}</MyButton>
)} />

// …or as a function child
<FinCalcLauncher>
  {({ openDialog }) => <a onClick={openDialog}>Calculators</a>}
</FinCalcLauncher>

// Controlled — drive it from your own state / menu / route
<FinCalcLauncher open={isOpen} onOpenChange={setIsOpen} variant="headless" />
```

| Prop | Type | Purpose |
|---|---|---|
| `variant` | `'fab' \| 'inline' \| 'headless'` | Floating button, in-flow button, or your own trigger |
| `icon` | `ReactNode` | Any icon/content for the built-in button |
| `trigger` / fn-child | `(api) => ReactNode` | Render your own trigger; `api = { open, toggle, openDialog, close }` |
| `position` | corner | FAB placement |
| `hotkey` | `string \| null` | Toggle hotkey (default `mod+shift+k`); `null` disables |
| `open` / `onOpenChange` | controlled | Drive open/close yourself |
| `className` / `style` | — | Style the built-in button |
| `dialogSize` / `dialogTitle` | — | Dialog sizing / title |

> The dialog, focus trap, and shortcut isolation are identical no matter which trigger you use. Want no launcher at all? Render `<FinCalcRoot/>` (the shell) directly, or embed individual calculators ↓.

---

## 🧩 Embed a single calculator

Don't want the whole suite? Render just one calculator inline with `CalculatorPanel` and its id:

```tsx
import { FinCalcProvider, CalculatorPanel } from 'calcsuite-react';
import 'calcsuite-react/theme.css';

<FinCalcProvider settings={{ region: 'IN' }}>
  <CalculatorPanel id="loan.emi" />       {/* or "invest.sip", "tax.gst", … */}
</FinCalcProvider>
```

Bespoke panels are exported directly too:

```tsx
import { LoanEmiPanel, SciCalculator, CurrencyConverter } from 'calcsuite-react';
```

> 🆔 Calculator ids: `loan.emi`, `loan.compare`, `invest.sip`, `invest.fd`, `returns.xirr`, `tax.gst`, `tools.scientific`, `tools.currency`, … Full list in the [calculator docs](README.md#-calculators-what-each-does-when--how-to-use).

---

## 🧮 Use the engine (no UI)

Every calculation is a pure function — call it from a server, a script, or your own UI:

```ts
import { loan, finance, currency } from 'calcsuite-react';

// EMI: solve for the payment
const r = loan.solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 });
r.payment.toString();        // "21933.51"  (a Decimal)
r.schedule;                  // full amortisation rows
r.totalInterest.toString();  // "…"

// Solve for a different variable — just omit it:
loan.solve({ region: 'IN', principal: '2500000', payment: '21934', tenureMonths: 240 }); // → annualRatePct

// Time-value helpers
finance.fvAnnuity('10000', finance.periodic('12'), 120, true);  // SIP future value (Decimal)
finance.xirr([{ date: '2020-01-01', amount: '-10000' }, { date: '2021-01-01', amount: '12000' }]);

// Currency
currency.convert('100', '83').toString();   // "8300"
```

All numeric returns are **`Decimal`** (from `decimal.js`) — call `.toString()`/`.toFixed(2)` for display, or use the `makeFormatter(settings)` helper for locale-aware money strings.

---

## 🎛️ Compose your own layout

Prefer to build your own chrome? The pieces are all exported — `FinCalcRoot` (the shell), `CalculatorPanel`, `SettingsPanel`, `HistoryPanel`, `CommandPalette`, `ExportMenu` — and the hooks `useFinCalc()` / `useHistory()`. See the [API reference](api-reference.md).

---

## 🌍 Regions

Set `region: 'IN' | 'US'` on the provider (or let users toggle it). It switches currency, digit grouping, terminology (EMI ↔ Monthly Payment), day-count defaults, and which calculators are available. Region differences are **data**, so the same component produces correct, differently-scoped results for each market.

**Next:** [🧩 API reference](api-reference.md) · [⚙️ Settings](settings.md) · [✨ Features](features.md)
