# ⚙️ Settings

Settings are a single object (`FinCalcSettings`). You supply them **three ways**:

1. **As a prop** on the provider (deep-partial — anything you omit uses the region default):

```tsx
<FinCalcProvider settings={{
  region: 'IN',
  numberFormat: { grouping: 'indian', decimalPlaces: 2 },
  ui: { theme: 'system', accent: '#078DEE', showFormulas: false },
}}>
```

2. **Programmatically** via the hook:

```tsx
const { settings, update, setRegion, reset, replace } = useFinCalc();
update({ ui: { theme: 'dark' } });     // deep-partial patch
setRegion('US');                        // resets currency/format/day-count to US defaults
```

3. **Let users edit** by rendering the bundled UI:

```tsx
import { SettingsPanel } from 'calcsuite-react';
<SettingsPanel />   // region · currency · number format · calculation · appearance · compliance · integration
```

> 💾 **Persistence** — the provider auto-saves the resolved settings to `localStorage` (`calcsuite:settings`) on every change and restores them on load. To disable, set `persistence.driver: 'none'`. Settings **Export/Import** (JSON) lives at the bottom of `<SettingsPanel/>`.

Every control updates **live** — the sample number at the top of the panel re-renders as you change things.

---

## 🌍 Region & currency

| Field | What it does |
|---|---|
| `region` `'IN' \| 'US'` | Switches currency, grouping, terminology (EMI↔Monthly Payment), day-count, and available calculators. |
| `currency.symbol` | Symbol shown with amounts (₹, $, €…). |
| `currency.symbolPosition` | `'prefix'` (₹100) or `'suffix'` (100₹). |
| `currency.code` | ISO 4217 (`INR`, `USD`…). |

> Switching region resets currency, number format, and day-count to that region's defaults but **keeps appearance** (theme, accent, font).

## 🔢 numberFormat

| Field | Options | Effect |
|---|---|---|
| `grouping` | `indian` 12,34,567 · `western` 1,234,567 · `european` · `swiss` · `plain` | Digit grouping. |
| `decimalPlaces` | 0–4 | Display precision. |
| `abbreviate` / `abbreviationScale` | on/off · `indian` (L/Cr) or `western` (K/M/B) | Compact large numbers (₹12.5 L / $1.2M). |
| `negativeFormat` | `minus` `-1,000` · `parentheses` `(1,000)` | Accounting style. |
| `percentPlaces` | 0–4 | Percent precision. |

## 🧮 rounding & dayCount

| Field | Options | Use when |
|---|---|---|
| `rounding.mode` | `HALF_UP`, `HALF_EVEN` (banker's), `HALF_DOWN`, `UP`, `DOWN`, `CEIL`, `FLOOR` | Match a specific bank/lender so figures line up to the paisa/cent. |
| `rounding.money` / `rate` / `period` | int | Decimal places for money / rates / period counts. |
| `dayCount` | `30/360`, `ACT/365`, `ACT/360`, `ACT/ACT`, `30E/360` | Match your institution's day-count (why FD/mortgage figures differ from naive ones). |

Presets: `POLICY_DEFAULT`, and India/US bank presets via `regionDefaults()`.

## 🎨 ui

| Field | Options | Notes |
|---|---|---|
| `theme` | `system` · `light` · `dark` · `highContrast` | Dark is a separate palette. |
| `accent` | hex (6 presets: 🟢🔵🟣🔷🟠⚪) | Recolours the **entire UI** live — buttons, active states, **focus rings**, **scrollbars**. Default 🔵 `#078DEE`. |
| `fontFamily` | `Inter Tight` · `Public Sans` · `System UI` · `Georgia` | UI typeface (numbers always tabular). |
| `density` | `comfortable` · `compact` | Field heights. |
| `showFormulas` | boolean (default **false**) | The "Formula" tab (exact expression with your numbers). |
| `showAssumptions` | boolean | The "Assumptions" tab. |
| `reducedMotion` | `system` · `always` · `never` | |

## 🛡️ compliance & 🔌 features

| Field | What it does |
|---|---|
| `compliance.showDisclaimer` | Toggles the "not financial advice" note under every result (default on). |
| `compliance.disclaimerText` | Override the copy. |
| `features.integrationPanel` | Reveals the backend [Integration panel](backend-integration.md) (default off). |

---

## 🧰 The full type

`FinCalcSettings` is exported for typing your config:

```ts
import type { FinCalcSettings } from 'calcsuite-react';
const settings: Partial<FinCalcSettings> = { region: 'US', ui: { accent: '#7635DC' } };
```
Defined in `src/settings/settings.ts`; formatting derives from it via `makeFormatter(settings)`.
