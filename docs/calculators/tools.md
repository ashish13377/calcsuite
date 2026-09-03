# 🛠️ Tools & Utilities

> 🧩 **Use in your app** — the scientific calculator and currency converter are dedicated components; the rest render via `<CalculatorPanel id="…" />`.
>
> ```tsx
> import { SciCalculator, CurrencyConverter, CalculatorPanel, evalExpression } from 'calcsuite';
> <SciCalculator />
> <CurrencyConverter />
> <CalculatorPanel id="tools.units" />
> // the expression engine, standalone:
> evalExpression('2*(3+4)^2').value.toString(); // "98"
> ```

Beyond the money calculators, CalcSuite ships a set of everyday utilities: a full **scientific calculator**, a **currency converter** with live online rates and an offline fallback, a **unit converter** (including Indian land units), a **date / tenure calculator**, and a **number-to-words** speller. They live under the **Tools** group and work on any device — the currency converter is the only one that reaches the internet, and even that degrades gracefully when you are offline. This page documents exactly what each control does and shows worked examples.

---

## 🔬 Scientific Calculator (`tools.scientific`)

**💡 What it is** — A full expression calculator: you type or tap a whole expression (`sin(30) + √9`) and it evaluates live as you go. Arithmetic, powers, factorials and combinatorics run at 40-digit precision; trig and hyperbolic functions run at standard double precision.

**🎯 When to use**
- Any math heavier than a basic four-function calculator — trig, logs, powers, roots, factorials.
- Combinatorics and number theory: `nCr`, `nPr`, `gcd`, `lcm`, `mod`.
- Programmer math: convert and compute in HEX / OCT / BIN with bitwise operators.
- Quick "of / percent" adjustments like `1200 + 18%`.

**🌍 Region** — Both. Pure math, no regional formatting. (Number scale and currency don't apply here — the same expression engine that powers this panel can also resolve expressions typed into money amount fields, e.g. `1200*1.18`.)

**📥 Inputs / controls**

| Control | What it does |
|---|---|
| **Expression field** | A real text box — type with the keyboard, paste, or tap the keypad. Preview updates on every keystroke. |
| **Angle mode** `deg · rad · grad` | Unit for trig and inverse-trig arguments/results. |
| **Base** `DEC · HEX · OCT · BIN` | Number base for input and output. Non-DEC bases reveal extra keypad rows. |
| **2nd** | One-shot shift key — reveals the alternate function on each key (e.g. `sin` → `sin⁻¹`, `√` → `∛`), then reverts after one press. |
| **Number & operator keys** | Insert tokens at the cursor. |
| **M+ / M− / MR / MC** | Memory add / subtract / recall / clear. |
| **ans** | Inserts the previous answer. |
| **= (or Enter)** | Evaluate and commit. |
| **C / ⌫** | Clear all / backspace. |
| **History tape** | Recent results; tap one to reload its expression. **Clear** empties it. |

**🧭 How to use**
1. Pick **angle mode** (deg/rad/grad) and **base** (DEC for normal math).
2. Type or tap an expression. The line below shows a live `= result` (or an inline error).
3. Press **=** or **Enter** to commit — the result replaces the expression, is stored as `ans`, and is pushed onto the history tape.
4. Use **M+ / M−** to accumulate into memory (the **M** badge appears when memory isn't zero); recall with **MR**.
5. Tap any history row to reuse that expression.

**📊 Result** — A live preview under the input, plus the committed answer. In **DEC** results show up to **12 significant digits**. In **HEX / OCT / BIN** the result is shown as a whole number with a `0x` / `0o` / `0b` prefix (fractions are truncated).

**🔢 Examples**

| Expression | Setting | Result |
|---|---|---|
| `sin(30)` | deg | `0.5` |
| `√9 + 16` | — | `19` (roots bind tightest, so it's `3 + 16`, not `√25`) |
| `5!` and `nCr(49,6)` | — | `120` and `13983816` |
| `gcd(24,36)` and `lcm(4,6)` | — | `12` and `12` |
| `1200 + 18%` | percent = *of* | `1416` |
| `FF and 0F` | HEX | `0xF` (i.e. 255 AND 15 = 15) |

**Full operator / function reference**

- **Arithmetic**: `+ − × ÷` (also `-`, `*`, `/`), `^` power (right-associative), unary minus, brackets `()` `[]` `{}` (unbalanced `(` auto-closes; a stray `)` is ignored). Implicit multiplication is inserted automatically: `2(3+4)`, `2π`, `3sin(...)`.
- **Trigonometry** (respect angle mode): `sin cos tan` and inverses `asin acos atan` (2nd-shift, also `arcsin/arccos/arctan`).
- **Hyperbolic** (2nd-shift): `sinh cosh tanh`.
- **Logs / exponentials**: `ln`, `log` (base 10; aliases `lg`, `log10`), `log2`, `logx(x, base)` (or `log(x, base)`), `exp`/`eˣ`, `10ˣ`.
- **Powers / roots**: `x²` `x³`, `√`/`sqrt`, `∛`/`cbrt`, `∜`/`qdrt` (4th root), `root(x, n)` nth root, `pow(x, y)`.
- **Combinatorics / number theory**: `nCr(n,r)`, `nPr(n,r)`, factorial `n!` (postfix; non-negative integer, up to 20000), `gcd(a,b)`, `lcm(a,b)`, `mod` (also `a mod b`).
- **Rounding / misc**: `abs`, `floor`, `ceil`, `round`, `trunc`, `sign`, `1/x` (recip).
- **Constants**: `π` (`pi`), `e` (lowercase only — uppercase `E` is a variable / scientific-notation exponent), `φ` (`phi`, golden ratio).
- **Variables**: single letters `A`–`F`, memory `M`, and `ans`. `EE` inserts scientific-notation exponent (e.g. `1.5E3` = `1500`).
- **Bitwise** (shown in HEX/OCT/BIN): `AND` (`&`), `OR` (`|`), `XOR`, `NOT` (`~`, prefix), `<<`, `>>`. These truncate operands to integers first.
- **Percent** `%` — two behaviours:
  - **As a modulo operator** when another value directly follows it: `10 % 3` = `1`.
  - **As a trailing percentage** otherwise: `50%` = `0.5`. In sums, the *percent mode* setting decides the meaning — **"of"** (default): `200 + 10%` = `220` (adds 10% *of* 200); **"modulo"**: `%` is a literal ÷100, so `200 + 10%` = `200.1`.

**📝 Notes & assumptions**
- Trig, inverse-trig and hyperbolic functions use standard double precision (~15–16 significant digits). Everything else — `+ − × ÷ ^`, `!`, `nCr/nPr`, `gcd/lcm`, and bitwise — stays full 40-digit precision.
- Errors (e.g. `factorial needs a non-negative integer`, `root of negative`, domain errors) show inline in the preview and block committing until fixed.
- History keeps the most recent 50 entries.

---

## 💱 Currency Converter (`tools.currency`)

**💡 What it is** — Convert between 44 world currencies using **live** mid-market rates fetched on demand, with a fully **offline** mode that runs on your saved / manually-entered rates. Conversion math is exact; formatting follows each currency's ISO 4217 rules (symbol, decimal places, grouping).

**🎯 When to use**
- Quick real-world conversions with a current market rate (Live mode).
- Working with no signal — use a rate you saved earlier, or type your bank's rate (Offline mode).
- Checking the inverse rate, or a currency's correct decimal precision (e.g. JPY 0 dp, KWD 3 dp).

**🌍 Region** — Both. All 44 currencies are available regardless of app region; INR amounts are grouped Indian-style (lakh/crore, `en-IN`), everything else uses Western grouping.

**📥 Inputs / controls**

| Control | What it does |
|---|---|
| **🟢 Live / ✈ Offline** | Rate source. **Live** fetches the current rate; **Offline** never touches the network. Your choice is remembered on this device. |
| **Amount** | The value to convert (commas/spaces ignored; must be ≥ 0). |
| **From / To** | Source and target currency. |
| **⇄ Swap** | Swaps From and To. |
| **Exchange rate** | `1 From = ? To`. Auto-filled in Live mode; editable any time to override. |
| **↻ Refresh** | (Live only) Re-fetch the current rate. |
| **Saved rates** list | Your rate book — tap a pair to load it. |

**🧭 How to use**
1. Choose **🟢 Live** (default) or **✈ Offline**.
2. Enter an **Amount**, pick **From** and **To**.
3. In Live mode the rate loads automatically (tap **↻ Refresh** to update). In Offline mode a saved rate loads if you have one — otherwise type the rate yourself.
4. Read the converted value. Use **⇄** to flip the direction, or edit the rate to override.

**📊 Result** — The converted amount formatted in the target currency, plus:
- **Rate** — `1 From = X To` (6 dp).
- **Inverse** — `1 To = Y From` (6 dp).
- **Precision** — how many decimals the target currency uses.
- A **status line** showing the rate's origin: a green dot with `Live rate · updated <how long ago> · open.er-api.com`, `Manual rate (you entered this)`, or `✈ Offline · saved rate <age>`.

**🔢 Example** — Convert **100 USD → INR** at a live rate of `1 USD = 83.20 INR`: result **₹8,320.00**, with Inverse `1 INR = 0.012019 USD` and Precision `2 dp · INR`. Swapping shows **100 INR → USD**.

**📝 Notes & assumptions**
- **🟢 Live vs ✈ Offline** — Live fetches on every pair/refresh; Offline is fully self-contained (no requests) and relies on your rate book or a manual entry. The toggle is saved per device.
- **Live source** — rates come from **open.er-api.com** (free, no API key required, 160+ currencies, updated daily). Each successful fetch is **cached** into your rate book automatically.
- **Graceful fallback** — if a live fetch fails, the converter shows your last saved rate for that pair (marked "Offline — showing your last saved rate. Refresh when back online."), or asks you to enter one manually if nothing is saved.
- **Manual override** — typing in the rate field flags it as *Manual* and saves it to the rate book.
- **Same currency** — if From = To the rate is forced to `1` (with a notice).
- **📚 Rate book & staleness** — saved pairs are stored **on this device only** (up to 12 shown, newest first). Each shows the rate and a **staleness badge** ("just now", "5 minutes ago", "3 days ago", …); a rate older than **1 day** is flagged as stale. Tap any pair to load it.
- **Not financial advice** — these are mid-market rates. Your bank's rate includes a spread and fees, so it will differ. Verify before transacting.

---

## 📐 Unit Converter (`tools.units`)

**💡 What it is** — Convert values across five categories — length, area, weight, volume and temperature — including Indian land units (bigha, gunta, cent).

**🎯 When to use**
- Everyday metric ↔ imperial conversions (feet, miles, pounds, gallons).
- Indian land measurement (acre, hectare, bigha, gunta, cent).
- Temperature between Celsius, Fahrenheit and Kelvin.

**🌍 Region** — Both. Indian land units are included alongside the standard metric/imperial set.

**📥 Inputs / controls**

| Control | What it does |
|---|---|
| **Value** | The number to convert (default `1`). |
| **Category** | `Length · Area · Weight · Volume · Temperature`. |
| **From / To** | Units within the chosen category (the option lists change per category). |

Units available per category:
- **Length** — m, km, cm, mm, mi, yd, ft, in
- **Area** — sqm, sqft, sqyd, acre, hectare, **bigha, gunta, cent**
- **Weight** — kg, g, mg, lb, oz, tonne, quintal
- **Volume** — l, ml, m³, gallon (US), gallon (UK), cup, pint
- **Temperature** — °C, °F, K

**🧭 How to use**
1. Choose a **Category**.
2. Set **From** and **To** units.
3. Type the **Value** — the result updates instantly.

**📊 Result** — A single line, e.g. `1 Acre = 4046.8564 Square meters`, rounded to **4 decimal places**.

**🔢 Examples**
- `1 acre → sqm` = **4046.8564** m² (exact ratio 4046.8564224).
- `100 °C → °F` = **212** °F.
- `1 kg → lb` ≈ **2.2046** lb.

**📝 Notes & assumptions**
- Non-temperature conversions use fixed ratios to each category's base unit (`result = value × ratio[from] / ratio[to]`). Temperature converts via Celsius.
- **Bigha is not standardised** — its size varies by state. This tool uses a common **~1337.8 m²** value and shows a note whenever bigha is involved.
- Displayed to 4 dp; the underlying value is computed exactly.

---

## 📅 Date / Tenure Calculator (`tools.dateCalc`)

**💡 What it is** — Find the duration between two dates, or add/subtract days, weeks, months or years from a date.

**🎯 When to use**
- Loan/investment tenure or age in years-months-days.
- Counting total days, weeks, or **business days** (excluding weekends) between two dates.
- Finding a future/past date ("90 days from today", "6 months before").

**🌍 Region** — Both. All arithmetic is calendar-based (UTC) and region-independent.

**📥 Inputs / controls**

| Control | What it does |
|---|---|
| **Mode** | `Difference` (between two dates) or `Add / subtract` (shift one date). |
| **Start date** | The base date (empty = today). |
| **End date** | *(Difference mode)* the other date. |
| **Amount** | *(Add/subtract)* how many units to shift (default `30`). |
| **Unit** | *(Add/subtract)* `Days · Weeks · Months · Years`. |
| **Direction** | *(Add/subtract)* `Add` or `Subtract`. |

**🧭 How to use**
1. Pick a **Mode**.
2. **Difference** — set Start and End dates.
3. **Add / subtract** — set the Start date, an Amount, a Unit, and Add or Subtract.

**📊 Result**
- **Difference** — the **Duration** as years/months/days, plus **Total days**, **Weeks** (`X wk Y d`), and **Business days** (excludes Sat & Sun).
- **Add / subtract** — the **Result date** with its **weekday**, and a summary of the shift applied.

**🔢 Example** — Start **2026-01-01**, **Add 30 Days** → **2026-01-31 (Saturday)**. In Difference mode, **2025-01-01 → 2026-03-15** = **1 year 2 months 14 days** (439 total days; 62 wk 5 d).

**📝 Notes & assumptions**
- **Month/year shifts clamp the day**: adding 1 month to Jan 31 lands on the last valid day (e.g. Feb 28/29), not an overflow date.
- If the **End date is before the Start date** in Difference mode, the range is reversed automatically and a note is shown.
- **Business days** count each day *after* the start up to and including the end, skipping Saturdays and Sundays (no holiday calendar).

---

## 🔤 Number to Words (`tools.numToWords`)

**💡 What it is** — Spell out an amount in words — Indian (lakh/crore) or Western (million/billion) — with an optional cheque format.

**🎯 When to use**
- Writing amounts on cheques, invoices or legal documents.
- Confirming a large figure is what you think it is.
- Switching between Indian and Western number naming.

**🌍 Region** — Both. The **Scale** toggle chooses Indian vs Western grouping; in cheque format the currency name follows your app's currency setting (INR → Rupees/Paise, USD → Dollars/Cents, otherwise the ISO code / Cents).

**📥 Inputs / controls**

| Control | What it does |
|---|---|
| **Amount** | The number to spell (commas/spaces ignored; default `1234567`). Negatives allowed. |
| **Scale** | `Indian (lakh/crore)` or `Western (million)`. |
| **Cheque format** | Toggle — prefixes the currency name and appends "Only". |

**🧭 How to use**
1. Type the **Amount**.
2. Pick a **Scale**.
3. Turn on **Cheque format** if you want the currency-wrapped version.

**📊 Result** — **In words** (Title Case) plus **In figures** (the grouped number). Any fractional part becomes `… and NN Paise/Cents`.

**🔢 Examples**
- `1234567`, Indian → **"Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"**.
- `1234567`, Western → **"One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven"**.
- `1234567`, Indian + Cheque (INR) → **"Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only"**.

**📝 Notes & assumptions**
- Fractions round to two decimal places for the subunit (Paise/Cents).
- Negative amounts are prefixed with **"Minus"**.
- The currency name and subunit shown in cheque format come from the app's selected currency, not from the Scale toggle.
