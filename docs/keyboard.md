# ⌨️ Keyboard & Shortcuts

CalcSuite's components are keyboard-first — every control is reachable and operable without a mouse. These shortcuts are active wherever you render `<FinCalcLauncher/>`, `<FinCalcRoot/>`, or `<FinCalcDialog/>`.

## 🔑 Global shortcuts

| Shortcut | Action |
|---|---|
| **`⌘K` / `Ctrl+K`** | Open the **command palette** (search calculators *and* actions) 🔍 |
| **`⌘⇧K` / `Ctrl+Shift+K`** | Toggle the **launcher dialog** open/closed 🪟 |
| **`Esc`** | Close the command palette; if none open, close the dialog |
| **`Tab` / `Shift+Tab`** | Move focus (trapped inside the dialog while it's open) |
| **`↑ / ↓`** | Move through command-palette results |
| **`Enter`** | Run the highlighted palette result / activate a control |

## 🔍 Command palette (`⌘K`)

Type to fuzzy-match:
- **Calculators** — "sip", "emi", "gst", "xirr"…
- **Actions** — "open settings", "open history", "switch to United States", "toggle dark mode", "open integration panel".

Then `↑`/`↓` to choose and `Enter` to run. `Esc` closes it.

## 🪟 Dialog focus behaviour

When the launcher dialog is open:
- ✅ **Focus is trapped** inside — `Tab` cycles through the dialog only, and returns to the start at the end.
- ✅ **Focus is restored** to the button that opened it when you close.
- 🛡️ **All host-page keyboard shortcuts are blocked** — anything you type stays inside CalcSuite and never triggers the surrounding website's shortcuts.
- ⎋ `Esc` closes it (a nested command palette gets `Esc` first).

## 🧮 In a calculator

- **`Tab`** between fields; type numbers directly.
- **Solve-for chips** are buttons — arrow/Tab to them, `Enter`/`Space` to pick.
- **Segmented controls & toggles** are real buttons/switches — fully keyboard-operable.
- **Schedule** — the year rows are buttons; `Enter` expands/collapses months.

## 🔬 Scientific calculator

- Full **keyboard entry** — type expressions directly (`2*(3+4)^2`).
- **Paste** an expression to parse it.
- Function/constant keys have `aria-label`s for screen readers.
- See [Tools → Scientific calculator](calculators/tools.md) for the full key map.

## 👁️ Focus ring

The keyboard focus ring is always drawn in your **accent colour** (change it in [Settings → Appearance](settings.md#-appearance)). It's visible on every interactive element and survives theming.
