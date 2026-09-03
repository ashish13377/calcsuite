# 📚 CalcSuite — Library Documentation

**CalcSuite** is a **React library** (npm package `calcsuite-react`) that drops a complete, decimal-exact financial calculator suite into *your* app — ~55 calculators for **🇮🇳 India (₹)** and **🇺🇸 United States ($)**, a scientific calculator, live currency conversion, export, and a keyboard-first launcher/dialog. All money math runs on `decimal.js` (no floating-point in any money path).

> 🧩 **Part of AceCBM — Ace Cloud Business Management**, the unified platform for billing, inventory, finance, and specialized industry workflows (*tailored globally, customized for your local regulation*). CalcSuite is its embeddable financial-calculator module — usable standalone or inside AceCBM.
>
> 📦 **This is a package, not an application.** You install it, wrap your app in a provider, and render its components — or call its pure engine functions directly. There is a demo app in the repo for local development, but the product is the library.

```tsx
import { FinCalcProvider, FinCalcLauncher } from 'calcsuite-react';
import 'calcsuite-react/theme.css';

export default function App() {
  return (
    <FinCalcProvider settings={{ region: 'IN' }}>
      <YourApp />
      <FinCalcLauncher />   {/* floating calculator button → full dialog */}
    </FinCalcProvider>
  );
}
```

> ⚠️ **Not financial advice.** Every figure is indicative, for planning only.

---

## 🚀 Start here

| Doc | What's inside |
|---|---|
| [🧭 Installation & quickstart](getting-started.md) | Install, peer deps, provider, launcher, embedding a single calculator, calling the engine |
| [🧩 API reference](api-reference.md) | Every export — provider, components, hooks, core namespaces (`loan`, `finance`, `currency`), types |
| [⚙️ Settings](settings.md) | The `FinCalcSettings` object you pass to the provider, and the `<SettingsPanel/>` |
| [✨ Features](features.md) | Export, Save/History, live currency, deep-linking, regions — and the components/hooks behind them |
| [⌨️ Keyboard](keyboard.md) | Shortcuts, focus trap, host-shortcut isolation |

## 🧮 Calculators (what each does, when & how to use)

| Group | Doc | Calculators |
|---|---|---|
| 🏦 Loans | [loans.md](calculators/loans.md) | EMI/Loan, Compare, Prepayment, Balance transfer, Eligibility, Step-up EMI, Moratorium, Overdraft, Refinance |
| 📈 Investments | [investments.md](calculators/investments.md) | SIP, Step-up SIP, Lumpsum, SWP, Goal, FD, RD, PPF, NPS, EPF, SSY, 401(k), IRA, 529 |
| 🧮 Returns | [returns.md](calculators/returns.md) | TVM, CAGR, Absolute, XIRR, IRR, NPV, MIRR, Payback, Real return, Rule of 72 |
| 🧾 Tax | [tax.md](calculators/tax.md) | GST, TDS, Income tax (IN & US), Capital gains, HRA, Advance tax, Sales tax, Mortgage deduction |
| 🛠️ Tools | [tools.md](calculators/tools.md) | Scientific calculator, Currency converter, Unit converter, Date/tenure, Number to words |

## 🧑‍💻 Extending & integrating

| Doc | What's inside |
|---|---|
| [🏗️ Extending the library](developer.md) | Architecture, the calculator contract, add a calculator, the **plugin API** |
| [🔌 Backend integration](backend-integration.md) | The `transport` prop, save/upload payloads, the integration panel, FX provider |

---

## 📦 What you get

| Layer | Import from `calcsuite-react` | Use it for |
|---|---|---|
| 🎛️ **Provider** | `FinCalcProvider`, `useFinCalc` | App-wide settings, region, formatting |
| 🚀 **Launcher/Dialog** | `FinCalcLauncher`, `FinCalcDialog`, `FinCalcRoot` | The one-button "everything inside" surface |
| 🧩 **Components** | `CalculatorPanel`, `SciCalculator`, `CurrencyConverter`, `SettingsPanel`, `HistoryPanel`, … | Drop a single calculator or panel anywhere |
| 🪝 **Hooks** | `useFinCalc`, `useHistory` | Read/write settings and saved calculations |
| 🧮 **Engine** | `loan`, `finance`, `currency`, `evalExpression` | Pure functions — compute without any UI |
| 🗂️ **Registry/Plugins** | `registerCalculator`, `calculatorById` | Add your own calculators |
| 📤 **Export / 🔌 Transport** | `createExporter`, `createTransport` | Serialize results; sync to your backend |

## 🔒 Principles

- 🎯 **Decimal-exact** — `decimal.js` everywhere; never a `Number` in a compounding loop.
- 📴 **Offline-first** — works with no network; live rates and sync are optional.
- 🌍 **Region as data** — India vs US differences live in profiles, not scattered `if`s.
- ♿ **Accessible** — full keyboard operation, focus rings, `aria-live`, real `<table>` schedules.
- 🔁 **Reproducible & SSR-safe** — same inputs ⇒ same output; no `window` at module scope.
