# ✨ Features

Cross-cutting capabilities and the exports behind them.

---

## 💾 Save & History

Saved calculations live in a **shared, persisted store**. Read/write it with the hook, or render the panel.

```tsx
import { useHistory, HistoryPanel } from 'calcsuite-react';

const { items, save, clear } = useHistory();
save({ id: 'loan.emi', title: 'Home 25L @ 8.65%', primary: '₹21,933.51', values });

// or drop in the UI:
<HistoryPanel items={items} onRestore={(it) => /* load it.id with it.values */} onClear={clear} />
```

- Also available imperatively (outside React): `saveHistory(item)` / `clearHistory()`.
- Stored in `localStorage` (≤100 items). Syncs live across every panel and browser tab.
- The bundled panels show a **Save** button that flashes **Saved ✓**.

---

## 📤 Export

Any result serialises via `createExporter()` or the `<ExportMenu>` component — **including the full schedule**.

```tsx
import { createExporter, ExportMenu } from 'calcsuite-react';

const exporter = createExporter();
await exporter.export('csv', payload);   // downloads

// or the dropdown UI:
<ExportMenu payload={{ calculatorId, title, result, values, settingsSnapshot, meta }} />
```

| Format | Best for | Notes |
|---|---|---|
| 📄 CSV / TSV | Spreadsheets | Injection-safe; full schedule |
| 📊 XLSX | Excel | Lazy — needs optional `xlsx` |
| 📕 PDF | Sharing a quote | Lazy — needs optional `jspdf` |
| 🧾 JSON | Backups / re-import | Round-trippable, versioned |
| 🔗 Share link | Sending a scenario | Inputs in the URL hash — no server |
| 📋 Clipboard | Pasting into docs/chat | Rich table + plain text |
| 🖨️ Print · 📝 Markdown · 📅 ICS · 🖼️ PNG · 🔳 QR | | |

Heavy formats download as separate chunks only when first used.

---

## 💱 Live currency (online + offline)

The `<CurrencyConverter/>` fetches **live rates** (via `fetchLiveRate`, a free no-key feed) with a **✈ Offline** toggle for manual/cached rates. Full details in [Tools → Currency converter](calculators/tools.md).

```tsx
import { CurrencyConverter, currency, fetchLiveRate } from 'calcsuite-react';
await fetchLiveRate('USD', 'INR');          // { rate, asOf, provider }
currency.convert('100', '83').toString();   // "8300"  (Decimal-exact)
```

---

## 🔗 Deep-linking

`<FinCalcRoot>`/`<FinCalcLauncher>` read the URL hash on mount and on `hashchange`:

```
#fincalc=loan.emi
#fincalc=invest.sip&s=<base64 inputs>
```

- **When to use** — bookmarks, docs, and support pages that land users on the right calculator.
- **Share** links (Export → Share) encode the *inputs* too, so the scenario reopens exactly. Parse them yourself with the export module's `parseShareUrl`.

---

## 🌍 Regions (India ↔ US)

One component, two markets. Set `region` on the provider or call `setRegion()`. It changes currency, grouping, terminology, day-count defaults, and the available calculator list. Region differences are **data** (region profiles), so results are correct and differently-scoped from the same UI.

---

## ⚖️ Disclaimer & assumptions

- Every result shows a **"not financial advice"** disclaimer by default (toggle via `compliance.showDisclaimer`).
- The **Assumptions** tab lists what was assumed (rounding, basis, "flat-rate basis", "PMI dropped at month 87").
- The **Formula** tab (enable `ui.showFormulas`) shows the exact expression with your numbers.

---

## ♿ Accessibility

- **Full keyboard operation** — see [Keyboard](keyboard.md).
- **Focus rings** in your accent colour; **focus trap** in `<FinCalcDialog>`; focus restored on close.
- **`aria-live`** result regions; real `<table>` schedules with headers/captions.
- Principal/interest distinguished by **colour *and* pattern/label**.
- Respects **`prefers-reduced-motion`**. SSR-safe (no `window` at module scope).
