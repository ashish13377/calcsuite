# Changelog

All notable changes to **CalcSuite** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-09-04

### Added
- **Upload / server API config in Settings.** The Integration Panel — connection URL, auth strategy, endpoints, upload strategy (multipart / presigned / base64Json) with filename template, a payload builder with live JSON preview, test-connection, copy-as-cURL, and a queue inspector — is now embedded under **Settings → File upload & server API**. Users can point exports (PDF/CSV/…) and saved calculations directly at their own server with no code. No secret is ever stored by the app.

## [1.0.0] — 2026-09-04

Initial release. The financial-calculator module of **AceCBM (Ace Cloud Business Management)**.

### Added
- **~55 calculators** across Loans, Investments, Returns, Tax, and Tools for 🇮🇳 India (₹) and 🇺🇸 United States ($).
- **Decimal-exact engine** on `decimal.js` — no floating-point in any money path.
- **Region model** (IN/US) as data: currency, grouping (lakh/crore vs western), terminology, day-count defaults.
- **Scientific calculator** — tokenizer → shunting-yard → AST → Decimal evaluator; trig (deg/rad/grad), logs, memory, base modes.
- **Currency converter** — live rates (no API key) with an offline toggle and a local rate book.
- **Export** — CSV/TSV, JSON, share URL, clipboard, print, Markdown, ICS; lazy PDF/XLSX/PNG.
- **Transport** — save/upload/list, retry, idempotency, offline queue, FX provider, and an integration panel.
- **UI** — launcher (fully customizable trigger), focus-trapped dialog with host-shortcut isolation, command palette (⌘K), settings, history, spring animations.
- **Full public API** — `FinCalcProvider`, `FinCalcLauncher`, `CalculatorPanel`, hooks, engine namespaces (`loan`, `finance`, `currency`), registry/plugin API, and TypeScript types.
- Theme tokens with accent presets, fonts, light/dark/high-contrast, and accent-driven focus rings and scrollbars.

### Notes
- ESM build with full `.d.ts` types.
- Peer deps: `react`, `react-dom` (18.3+ / 19). Optional peers for PDF/XLSX: `jspdf`, `xlsx`.
- Not financial advice — figures are indicative, for planning only.
