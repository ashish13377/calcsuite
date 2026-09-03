# CalcSuite

[![CI](https://github.com/ashish13377/calcsuite/actions/workflows/ci.yml/badge.svg)](https://github.com/ashish13377/calcsuite/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/calcsuite-react.svg)](https://www.npmjs.com/package/calcsuite-react)
[![license: MIT](https://img.shields.io/npm/l/calcsuite-react.svg)](LICENSE)

**Decimal-exact, offline-first financial calculator library for React** — ~55 calculators for **🇮🇳 India (₹)** and **🇺🇸 United States ($)**, a scientific calculator, live currency conversion, export, and a keyboard-first launcher/dialog. All money math runs on `decimal.js` — no floating-point in any money path.

> 🧩 **Part of AceCBM — Ace Cloud Business Management**, the unified platform for billing, inventory, finance, and specialized industry workflows (*tailored globally, customized for your local regulation*). CalcSuite is its embeddable financial-calculator module — usable standalone or inside AceCBM.
>
> 📦 A **package**, not an app. Install it, wrap your app in a provider, render its components — or call its pure engine functions.

## Install

```bash
npm install calcsuite-react       # yarn add calcsuite-react · pnpm add calcsuite-react
```

`decimal.js` installs automatically; `react`/`react-dom` are peer deps (18.3+ / 19). Optional PDF/XLSX export: `npm install jspdf xlsx`.

## Quickstart

```tsx
import { FinCalcProvider, FinCalcLauncher } from 'calcsuite-react';
import 'calcsuite-react/theme.css';

export default function App() {
  return (
    <FinCalcProvider settings={{ region: 'IN' }}>
      <YourApp />
      <FinCalcLauncher />        {/* floating calculator button → the whole suite */}
    </FinCalcProvider>
  );
}
```

Embed a single calculator:

```tsx
import { CalculatorPanel } from 'calcsuite-react';
<CalculatorPanel id="loan.emi" />   // or "invest.sip", "tax.gst", "tools.scientific", …
```

Use the engine with no UI:

```ts
import { loan, finance } from 'calcsuite-react';
loan.solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 }).payment.toString(); // "21933.51"
finance.xirr([{ date: '2020-01-01', amount: '-10000' }, { date: '2021-01-01', amount: '12000' }]); // ≈ 0.20
```

## 📚 Documentation

Full docs in **[`docs/`](docs/README.md)** — [installation](docs/getting-started.md) · [API reference](docs/api-reference.md) · [settings](docs/settings.md) · [features](docs/features.md) · [keyboard](docs/keyboard.md) · per-calculator guides ([loans](docs/calculators/loans.md) · [investments](docs/calculators/investments.md) · [returns](docs/calculators/returns.md) · [tax](docs/calculators/tax.md) · [tools](docs/calculators/tools.md)) · [extending](docs/developer.md) · [backend integration](docs/backend-integration.md).

## What's inside

- 🏦 **Loans** — EMI/Monthly-Payment (solve any variable, full amortisation table), Compare, Prepayment, Balance transfer, Eligibility, Step-up, Moratorium, Overdraft, Refinance
- 📈 **Investments** — SIP, Step-up SIP, Lumpsum, SWP, Goal, FD, RD, PPF, NPS, EPF, SSY, 401(k), IRA, 529
- 🧮 **Returns** — TVM, CAGR, XIRR, IRR, NPV, MIRR, Payback, Real return, Rule of 72
- 🧾 **Tax** — GST, TDS, Income tax (IN old/new & US), Capital gains, HRA, Advance tax, Sales tax, Mortgage deduction
- 🛠️ **Tools** — Scientific calculator, Currency converter (live+offline), Unit converter, Date/tenure, Number to words

## Principles

- 🎯 **Decimal-exact** — `decimal.js` everywhere; deterministic and reproducible.
- 📴 **Offline-first** — works with no network; live rates and backend sync are optional.
- 🌍 **Region as data** — India vs US differences live in profiles, not scattered `if`s.
- ♿ **Accessible** — full keyboard operation, focus rings, `aria-live`, real `<table>` schedules (WCAG 2.2 AA target).
- 🔒 **No stored secrets** — auth is a host callback; SSR-safe (no `window` at module scope).

## Develop

```bash
npm run dev          # run the demo app (local development)
npm test             # test suite (engine, golden values, UI)
npm run build        # build the library → dist/ (ESM + .d.ts)
npm run demo:build   # build the demo app
```

## About AceCBM

**CalcSuite** is developed as part of **AceCBM — Ace Cloud Business Management**: *one platform for end-to-end business operations.* AceCBM empowers businesses with a unified ecosystem for **billing, inventory, finance, and specialized industry workflows** — tailored globally and customized for your local regulation. CalcSuite provides the finance/calculation building blocks and is published for reuse in any React app.

## License

MIT · **Not financial advice** — figures are indicative, for planning only.
