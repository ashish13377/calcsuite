# 🧮 Returns & Time-Value Calculators

> 🧩 **Use in your app** — render any one with `<CalculatorPanel id="…" />`, or call the `finance` helpers directly.
>
> ```tsx
> import { CalculatorPanel, finance } from 'calcsuite-react';
> <CalculatorPanel id="returns.xirr" />
> // engine (no UI):
> finance.xirr([{ date: '2020-01-01', amount: '-10000' }, { date: '2021-01-01', amount: '12000' }])?.toFixed(4); // ≈ "0.2001"
> ```

These ten tools answer the two questions behind every investment: *how much will money grow?* and *what rate did I actually earn?* The **TVM solver** moves between present value, future value, payment, periods, and rate; **CAGR**, **XIRR**, **IRR**, and **MIRR** annualise a return (smooth, dated, periodic, and dual-rate respectively); **NPV** discounts a stream of cashflows to today; **Absolute return** gives the plain gain; **Payback** tells you when you break even; **Real return** strips out inflation; and the **Rule of 72** is the back-of-the-envelope doubling-time shortcut shown next to its exact logarithm. Every calculation runs in exact decimal arithmetic, so rounding never drifts.

> **💵 Sign convention (read once, applies everywhere):** money **out** of your pocket is **negative** (an investment, a deposit, a purchase); money **in** is **positive** (a redemption, a payout, a maturity). Get the signs wrong and rate solvers return `—` instead of a number.

---

## ⏳ Time value of money (TVM) (`returns.tvm`)

**💡 What it is** — The classic five-variable financial-calculator engine. Give it any four of {PV, PMT, FV, N, Rate} and it solves for the fifth.

**🎯 When to use**
- Project what a lump sum plus regular contributions grows to (solve **FV**).
- Find the deposit today that funds a future goal (solve **PV**).
- Size the monthly payment for a loan or SIP (solve **PMT**).
- Back out how many periods, or what rate, a plan implies (solve **N** or **Rate**).

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Solve for | The one unknown to compute | Select: `FV`, `PV`, `PMT`, `N`, `Rate` — default `FV` |
| Present value (PV) | Value today; a starting outflow is negative | Default `-100000` |
| Payment per period (PMT) | Cashflow each period; a deposit is negative | Default `-5000` |
| Future value (FV) | Target/ending value | Default `0` |
| Number of periods (N) | Total periods (not years unless compounding is annual) | Default `60` |
| Rate per year | Nominal annual rate, % | Default `10` — divided by periods/year internally |
| Compounding | Periods per year | Select: Annual (1), Semi-annual (2), Quarterly (4), Monthly (12) — default Monthly |
| Payment timing | When each PMT falls | Segmented: End (ordinary) / Begin (due) — default End |

**🧭 How to use**
1. Pick what to **Solve for** — that field's own value is ignored.
2. Fill the other four values, keeping the sign convention (outflows negative).
3. Set **Compounding** so it matches how often PMT occurs (monthly SIP → Monthly).
4. Choose **End** for ordinary annuities, **Begin** if payments land at the start of each period.
5. Read the answer.

**📊 Result** — **Primary:** the solved variable (FV/PV/PMT as money, N as a period count, Rate as % per year). The governing equation is shown as the formula.

**🔢 Example** — Solve **FV**, PV `-100000`, PMT `0`, N `10`, Rate `8`, Compounding **Annual**, End → grows to **≈ 215,892** ( 100,000 × 1.08¹⁰ ). Using the shipped defaults (PV `-100000`, PMT `-5000`, N `60`, Rate `10`, Monthly) gives FV **≈ 551,716**.

**📝 Notes & assumptions**
- Solves `PV·(1+i)^N + PMT·[((1+i)^N − 1)/i]·timing + FV = 0`, where `i = Rate ÷ 100 ÷ periods-per-year`.
- **N** and **Rate** are found by bisection: N is bracketed in 1…1200 periods; Rate is searched between −99.99% and +1000% per period. If your sign combination has no solution, **Rate** returns `—` with a warning to check the signs.
- "Begin (due)" multiplies the annuity factor by `(1+i)` — payments earn one extra period of interest.
- Rate is reported as **% per year** (per-period rate × periods-per-year), to 4 decimals.

---

## 📈 CAGR (`returns.cagr`)

**💡 What it is** — The single smoothed annual growth rate that turns a beginning value into an ending value over a given number of years.

**🎯 When to use**
- Compare investments of different sizes and horizons on one annualised number.
- Annualise a multi-year lump-sum return (no interim cashflows).
- Sanity-check a fund's headline "X% CAGR" claim.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Initial value | Starting value of the investment | Money, default `100000` |
| Final value | Ending value | Money, default `200000` |
| Period | Number of years | Years, default `10` (treated as 1 if left 0) |

**🧭 How to use**
1. Enter the **Initial** and **Final** values.
2. Enter the holding **Period** in years.
3. Read the CAGR plus the total absolute return.

**📊 Result** — **Primary:** CAGR (% per year). **Secondary:** Absolute return (%) and Total gain (money).

**🔢 Example** — 100,000 → 200,000 over 10 years → CAGR **≈ 7.18%**, Absolute return **100%**, Total gain **100,000**.

**📝 Notes & assumptions**
- Formula: `CAGR = (Final / Initial)^(1/years) − 1`.
- Assumes a single lump sum with **no** deposits or withdrawals in between. For irregular contributions use **XIRR**; for periodic ones use **IRR**.

---

## 💰 Absolute return (`returns.absolute`)

**💡 What it is** — The plain total return on an investment, optionally annualised if you supply a holding period.

**🎯 When to use**
- Get the headline "how much did it gain?" percentage.
- See the rupee/dollar gain alongside the percentage.
- Optionally annualise a lump-sum holding.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Amount invested | Cost/principal | Money, default `100000` |
| Current value | Present/exit value | Money, default `150000` |
| Holding period | Years held | Years, **optional**, default `3` — annualises only when > 0 |

**🧭 How to use**
1. Enter **Amount invested** and **Current value**.
2. Optionally add a **Holding period** to get the annualised (CAGR) figure.
3. Read the results.

**📊 Result** — **Primary:** Absolute return (%). **Secondary:** Total gain (money, green if up / red if down) and, when period > 0, Annualised (CAGR) %.

**🔢 Example** — Invested 100,000, current 150,000, held 3 years → Absolute return **50%**, Total gain **50,000**, Annualised **≈ 14.47%**.

**📝 Notes & assumptions**
- Formula: `Absolute return = (Current − Invested) / Invested`.
- The annualised figure reuses the CAGR formula; leave the period blank/0 to skip it.

---

## 📅 XIRR (`returns.xirr`)

**💡 What it is** — The annualised return for **irregular, dated** cashflows — the right tool for a real portfolio or SIP where money went in and out on arbitrary dates.

**🎯 When to use**
- Mutual-fund or SIP returns with contributions on different dates.
- Any investment with lumpy, unevenly-timed inflows/outflows.
- When exact dates matter more than clean periods.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Cashflows | A list of **date + amount** rows | See below. Default rows: `2023-01-01 → -100000`, `2024-01-01 → -50000`, `2025-01-01 → 180000` |

*Reading the `Cashflows` input:* each row is one dated event — a `date` (ISO `YYYY-MM-DD`) and an `amount`. **Negative = money you put in** (investment/deposit), **positive = money you took out** (redemption/maturity). Rows with a blank date or blank amount are ignored. Order doesn't matter — flows are sorted by date internally.

**🧭 How to use**
1. Add a row for every contribution (negative) and every redemption (positive).
2. Include the final/current value as a positive amount on its date.
3. Read the XIRR.

**📊 Result** — **Primary:** XIRR (% per year).

**🔢 Example** — `-10000` on `2020-01-01` and `+12000` on `2021-01-01` → XIRR **≈ 20%**.

**📝 Notes & assumptions**
- Solves the rate where `Σ cashflow / (1+rate)^(days/365) = 0` (ACT/365 day count), via bracketed bisection between −99.99% and +10000%.
- Needs **at least two** flows **and** at least one **negative** and one **positive** — otherwise it returns `—` with a warning.

---

## 🔁 IRR (`returns.irr`)

**💡 What it is** — The internal rate of return for **periodic** (equally-spaced) cashflows — the discount rate that makes their NPV zero.

**🎯 When to use**
- Evaluate a project or bond with one cashflow per period.
- Compare a series of equal-interval flows to a hurdle rate.
- When periods are uniform (annual/monthly) so dates aren't needed.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Cashflows (comma-separated, period 0 first) | Numbers separated by commas or spaces, earliest first | Default `-100000, 30000, 40000, 50000, 40000` |

*Reading the comma-separated input:* type the flows in period order, `period 0` first (usually your initial **negative** outlay), then each period's inflow (positive) or outflow (negative). Separate with commas or spaces; non-numeric junk is dropped. Each entry sits one period after the last.

**🧭 How to use**
1. Put the initial investment as the first, negative number.
2. List each following period's net cashflow in order.
3. Read the IRR.

**📊 Result** — **Primary:** IRR (% per period — annual if your periods are years).

**🔢 Example** — `-100000, 30000, 40000, 50000, 40000` → IRR **≈ 20.5%**.

**📝 Notes & assumptions**
- Solves the rate where **NPV = 0** by bracketed bisection.
- Requires a **sign change** in the series (at least one negative and one positive); otherwise IRR is undefined and returns `—`.
- IRR can be unreliable when signs flip more than once — use **MIRR** for those.

---

## 🏷️ NPV (`returns.npv`)

**💡 What it is** — The net present value of a periodic cashflow stream discounted at a rate you choose.

**🎯 When to use**
- Decide whether a project creates value at your cost of capital.
- Compare mutually-exclusive projects on today's-money terms.
- Discount any known series of future flows.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Discount rate per period | Your hurdle / cost of capital, % | Percent, default `10` |
| Cashflows (comma-separated, period 0 first) | Flows earliest-first, period 0 not discounted | Default `-100000, 30000, 40000, 50000, 40000` |

*Reading the comma-separated input:* same rule as IRR — `period 0` first (your negative outlay), then each later period's flow. The first entry (t=0) is **not** discounted; each subsequent entry is discounted one more period.

**🧭 How to use**
1. Set the **Discount rate per period**.
2. Enter the cashflows, period 0 first.
3. Read the NPV and whether it is value-creating.

**📊 Result** — **Primary:** NPV (money, green if ≥ 0 / red if < 0). **Secondary:** "Value-creating (NPV ≥ 0)" or "Value-destroying (NPV < 0)".

**🔢 Example** — Rate `10`, `-100000, 30000, 40000, 50000, 40000` → NPV **≈ 25,219** → value-creating.

**📝 Notes & assumptions**
- Formula: `NPV = Σ CFₜ / (1+r)ᵗ`, with `t` starting at 0.
- The discount rate is **per period** — if flows are monthly, use a monthly rate.

---

## 🔀 MIRR (`returns.mirr`)

**💡 What it is** — Modified IRR: like IRR but with **separate** rates for financing outflows and reinvesting inflows, which fixes IRR's unrealistic "reinvest at IRR" assumption.

**🎯 When to use**
- Projects where surplus cash is reinvested at a rate different from the cost of capital.
- Cashflow streams with multiple sign changes where plain IRR misbehaves.
- When you want a single, more realistic annual rate.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Cashflows (comma-separated) | Flows in period order, period 0 first | Default `-100000, 30000, 40000, 50000, 40000` |
| Finance rate | Rate used to discount **negative** flows, % | Percent, default `10` |
| Reinvestment rate | Rate at which **positive** flows compound forward, % | Percent, default `12` |

*Reading the comma-separated input:* same period-order rule as IRR/NPV. Negatives are financed at the finance rate; positives are reinvested at the reinvestment rate.

**🧭 How to use**
1. Enter the cashflows (need both a negative and a positive).
2. Set the **Finance rate** (cost of your outflows) and **Reinvestment rate** (what inflows earn).
3. Read the MIRR.

**📊 Result** — **Primary:** MIRR (% per period).

**🔢 Example** — `-100000, 30000, 40000, 50000, 40000`, finance `10`, reinvest `12` → MIRR **≈ 17.1%**.

**📝 Notes & assumptions**
- Formula: `MIRR = (FV(inflows @ reinvest) / −PV(outflows @ finance))^(1/n) − 1`, where `n` = number of periods (entries − 1).
- Needs **both** positive and negative flows, or it returns `—`.

---

## ⏱️ Payback period (`returns.payback`)

**💡 What it is** — How long a stream of inflows takes to recover an initial investment — with an optional discounted version.

**🎯 When to use**
- Quick liquidity/risk screen: how fast do I get my money back?
- Compare projects on speed of recovery.
- Add a discount rate for a more conservative, time-value-aware payback.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Initial investment | Up-front outlay, entered as a **positive** amount | Money, default `500000` |
| Annual inflows (comma-separated) | Each period's inflow, earliest-first | Default `120000, 150000, 150000, 180000` |
| Discount rate (for discounted payback) | % per period; 0 = simple payback | Percent, **optional/advanced**, default `0` |

*Reading the comma-separated input:* here the list is the **inflows only** (positive amounts), one per period. The initial investment is a separate field — do **not** include it in the list.

**🧭 How to use**
1. Enter the **Initial investment** (positive).
2. List the **Annual inflows** in order.
3. Optionally set a **Discount rate** for discounted payback.
4. Read the payback period.

**📊 Result** — **Primary:** Payback period in years (fractional), or "Not recovered". **Secondary:** "Simple (undiscounted)" or "Discounted @ X%".

**🔢 Example** — Investment `500000`, inflows `120000, 150000, 150000, 180000`, discount `0` → **≈ 3.44 years** (cumulative reaches 500,000 partway through the 4th year).

**📝 Notes & assumptions**
- Formula: the period when **cumulative inflow ≥ investment**, with the final year interpolated linearly.
- With a discount rate > 0 each inflow is discounted `CFₜ / (1+r)^(t+1)` before accumulating (discounted payback).
- If the inflows never cover the investment, it reports "Not recovered" and warns how many periods were tried.

---

## 🛡️ Real (inflation-adjusted) return (`returns.realReturn`)

**💡 What it is** — Your return after removing inflation — the growth in actual purchasing power, via the exact Fisher relation.

**🎯 When to use**
- See what a nominal return is really worth once prices rise.
- Compare returns across periods or countries with different inflation.
- Set realistic retirement/goal assumptions in today's money.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Nominal return | Stated/headline return, % | Percent, default `12` |
| Inflation | Expected/actual inflation, % | Percent, default `6` |

**🧭 How to use**
1. Enter the **Nominal return**.
2. Enter the **Inflation** rate.
3. Read the real return (and the quick approximation).

**📊 Result** — **Primary:** Real return (%, green if ≥ 0 / red if < 0). **Secondary:** the rough "nominal − inflation" approximation for comparison.

**🔢 Example** — Nominal `12`, Inflation `6` → Real **≈ 5.66%** (the naive 12 − 6 = 6% overstates it).

**📝 Notes & assumptions**
- Formula (Fisher): `Real = (1 + nominal) / (1 + inflation) − 1`.
- The `nominal − inflation` shortcut is shown only as a sanity check; it drifts high as rates rise.

---

## ✌️ Rule of 72 (`returns.rule72`)

**💡 What it is** — The mental-math shortcut for how many years money takes to double, shown side-by-side with the exact logarithmic answer.

**🎯 When to use**
- Estimate doubling time in your head from a return rate.
- Teach or sanity-check compounding intuition.
- See how far the "72" shortcut strays from the exact figure.

**🌍 Region** — Both.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Annual return | Expected annual return, % | Percent, default `8` — must be positive |

**🧭 How to use**
1. Enter your **Annual return**.
2. Read the shortcut estimate, the exact answer, and the gap between them.

**📊 Result** — **Primary:** Years to double (Rule of 72). **Secondary:** Exact (logarithm) and the Difference between the two.

**🔢 Example** — Return `8` → Rule of 72 = 72 / 8 = **9 years**; exact = ln 2 / ln 1.08 ≈ **9.01 years**; difference ≈ 0.01.

**📝 Notes & assumptions**
- Formulas: shortcut `years ≈ 72 / rate`; exact `years = ln 2 / ln(1 + r)`.
- Requires a **positive** return — 0 or negative returns never double and return `—`.
- The shortcut is most accurate near 8%; it drifts at very low or very high rates, which is exactly why the exact log is shown next to it.
