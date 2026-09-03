# Changelog

All notable changes to **CalcSuite** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.1.5] — 2026-09-04

### Changed
- **PDF & Excel export now work out of the box.** `jspdf` and `xlsx` are now regular **dependencies** (installed automatically with `calcsuite-react`) instead of optional peers. Install the library and export to PDF/XLSX just works — no extra packages, nothing for end users to add. The libraries are still loaded lazily via dynamic `import()`, so they're code-split into a separate chunk and only fetched the first time someone exports; they never touch initial bundle size or SSR. This supersedes 1.1.4: `webpackIgnore`/`turbopackIgnore` fixed the build but left the runtime import unresolvable in the browser, so export couldn't actually run.

## [1.1.4] — 2026-09-04

### Fixed
- **Build no longer fails without `jspdf` / `xlsx`.** The lazy PDF/XLSX exports carried only Vite's `/* @vite-ignore */`, which meant nothing to webpack/Turbopack — so a consumer's Next.js build tried to resolve the optional peers at bundle time and hard-failed (`Module not found: Can't resolve 'jspdf' / 'xlsx'`) even for apps that never export to those formats. The dynamic imports now also carry `/* webpackIgnore: true */` and `/* turbopackIgnore: true */`, so consumer bundlers leave them as native runtime `import()`s. Installing `calcsuite-react` alone is enough to build; PDF/XLSX still degrade gracefully at runtime with a friendly error until you add the optional peer.

## [1.1.3] — 2026-09-04

### Fixed
- **Readable text on accent surfaces.** Buttons, active nav, segmented toggles, the FAB and scientific keys now use each preset's own contrast colour (`--fc-accent-ink`) instead of a hardcoded white / dark-mode override — so the default Cyan (and Purple/Blue) accents no longer render near-black text on a mid-tone fill in dark mode.
- **"Solved" field contrast.** The computed-value field dropped its muddy accent-tinted fill (it was low-contrast on dark themes); the dashed accent border + "solved" note still mark it.

### Added
- **Brand mark.** The calculator glyph (the default launcher/FAB icon) now sits beside the **CalcSuite** title in the dialog header, with the title and "an AceCBM product" subtitle stacked.

## [1.1.2] — 2026-09-04

### Fixed
- **Unstyled UI when embedded.** `<FinCalcProvider>` now renders the design-token root (`data-fincalc-root` + resolved `data-theme` / `data-density` / accent / font) itself, via a layout-neutral `display: contents` wrapper. Previously that root was applied only by the demo app, so consumers of the package rendered the calculators with every `--fc-*` token undefined — transparent surfaces, no borders, no dialog panel. The wrapper is scoped (not on `<html>`), so it never collides with the host app's own `data-theme`.

## [1.1.1] — 2026-09-04

### Fixed
- **Dialog layers above host UI.** Raised the dialog / command-palette / toast z-index so CalcSuite renders above app chrome (e.g. MUI app bars & drawers) when embedded in another app.

### Changed
- **`<FinCalcProvider settings={…}>` now applies.** The provider accepts a deep-partial `settings` prop as *defaults* (region, currency, theme, …). The user's in-app choices still persist in `localStorage` and take precedence, so region stays user-driven.

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
