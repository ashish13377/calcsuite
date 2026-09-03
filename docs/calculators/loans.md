# 🏦 Loan Calculators

> 🧩 **Use in your app** — render any one with `<CalculatorPanel id="…" />`, use `<FinCalcLauncher/>` for the whole suite, or call the engine directly. Amounts are `Decimal`.
>
> ```tsx
> import { CalculatorPanel, loan } from 'calcsuite-react';
> <CalculatorPanel id="loan.emi" />
> // engine (no UI):
> loan.solve({ region: 'IN', principal: '2500000', annualRatePct: '8.65', tenureMonths: 240 }).payment.toString(); // "21933.51"
> ```

This group turns a loan into numbers you can act on: what you'll pay each month, what it costs over its whole life, whether to prepay, switch lender or take a payment holiday, and how much you can borrow in the first place. Every calculator is region-aware. In 🇮🇳 **India** the monthly instalment is called the **EMI**, the loan length is the **Tenure**, and the upfront charge is a **Processing fee**; in 🇺🇸 the **US** the same things are the **Monthly Payment**, the **Term**, and the **Origination fee**. Defaults, currency symbols, and number grouping (Indian lakh/crore vs Western thousands) all follow the region you pick in Settings, and the math underneath is identical — only the labels and starting values change. Interest rates are capped at 0–50% p.a. and tenures must be a whole number of months (1 or more).

---

## 🎯 EMI / Loan Calculator (`loan.emi`)

**💡 What it is** — The flagship loan calculator. Enter any three of the four loan variables — amount, rate, term, payment — and it solves for the fourth, then builds the complete month-by-month amortisation schedule and cost breakdown.

**🎯 When to use**
- Work out the EMI / monthly payment on a new home, car, or personal loan.
- Find out how much you can borrow for a target monthly payment (solve for **Amount**).
- Back out the true interest rate a lender is charging (solve for **Rate**).
- See how long a loan will run if you fix the payment (solve for **Term**).

**🌍 Region** — Both 🇮🇳 / 🇺🇸 (labels and defaults follow your region setting).

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Solve for | Which quantity to calculate: **Payment**, **Amount**, **Rate**, or **Term** | Default **Payment**. On flat-rate basis only **Payment** and **Amount** are available. |
| Interest basis | **Reducing balance** or **Flat rate** | Default **Reducing balance** (both regions). |
| Loan amount | The principal borrowed | Default ₹25,00,000 (IN) / $300,000 (US). Ignored when solving for Amount. |
| Interest rate | Annual rate, % p.a. | Default 8.65% (IN) / 6.5% (US). Range 0–50%. Ignored when solving for Rate. |
| Tenure / Term | Loan length as **years + months** | Default 20 yr (IN, 240 mo) / 30 yr (US, 360 mo). Ignored when solving for Term. |
| EMI / Monthly Payment | The monthly instalment | Default ₹21,934 (IN) / $1,896 (US). Ignored when solving for Payment. |

**🧭 How to use**
1. Pick your **Solve for** target — that field turns into a read-only "solved" box.
2. Choose the **Interest basis** (reducing balance is normal for home/personal loans; flat rate is common for some vehicle/consumer loans in India).
3. Fill in the three remaining fields.
4. Read the answer in the hero figure; open the **Schedule**, **Chart**, or **Formula** tab below.
5. Use **Save** to keep the scenario, or **Export** to download it.

**📊 Result** — The primary number is the EMI / Monthly Payment (shown as `/month`). A split bar shows the principal-vs-interest share, and secondary metrics give **Principal**, **Total interest**, **Total payment**, and the **Tenure / Term**. Below that:
- **Schedule tab** — the full amortisation table (Opening · Payment · Principal · Interest · Balance), grouped by year with each year expandable to its months, plus a **Yearly / Monthly** view toggle.
- **Chart tab** — outstanding balance falling to zero alongside cumulative interest rising over the term.
- **Formula tab** — the exact formula and inputs used (shown when formulas are enabled in Settings).
- **Save / Export** — save the scenario for later, or export the result *including the entire schedule* to CSV / PDF / XLSX / JSON / print.

**🔢 Example** — 🇮🇳 Solve for **Payment**, reducing balance, amount ₹25,00,000, rate 8.65%, term 20 years → EMI ≈ **₹21,934/month**, total interest ≈ ₹27.6 lakh, total payment ≈ ₹52.6 lakh. (🇺🇸 $300,000 at 6.5% over 30 years → ≈ **$1,896/month**.)

**📝 Notes & assumptions**
- Reducing-balance formula: `PMT = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1)`, where `r = annual rate ÷ 100 ÷ 12` and `n` = months. The inverse forms are used when solving for amount, term, or rate; rate is found by bisection over 0–50%.
- Flat-rate basis: `interest = P × rate × years`, `EMI = (P + interest) / n`. On flat rate you can only solve for payment or amount. The result also reports the **equivalent reducing-balance rate** — a flat rate always works out dearer than it looks, so compare loans on that figure.
- The **final instalment absorbs rounding drift** so the balance clears to exactly zero.
- If the payment is not larger than the first month's interest, the loan never reduces and you'll get an error asking for a higher payment.
- Figures are indicative; a lender's own calculation can differ due to rounding, day-count conventions, fees, and taxes.

---

## ⚖️ Compare Loans (`loan.compare`)

**💡 What it is** — Line up 2 to 5 loan offers side by side and see which one actually costs the least over its full life.

**🎯 When to use**
- Deciding between competing offers from different banks.
- Checking whether a lower headline rate really wins once tenure differs.
- Comparing a short expensive loan against a long cheaper one.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| How many loans | 2, 3, 4, or 5 | Default **2**. Rows 3–5 appear only as you raise this. |
| Loan _i_ amount | Principal of loan _i_ | Loans 1 & 2 default ₹25,00,000; loans 3–5 blank. |
| Loan _i_ rate | Annual rate of loan _i_, % | Loan 1 default 9%, loan 2 default 8.65%; rest blank. |
| Loan _i_ tenure / term | Length of loan _i_ | Default 240 months (20 yr). |

**🧭 How to use**
1. Set **How many loans** to compare.
2. Fill amount, rate, and tenure for each. Invalid or empty slots are simply skipped.
3. Read which loan wins on total outflow, and check the side-by-side table.

**📊 Result** — Primary: **lowest total outflow** and which loan number achieves it. Secondary: each loan's EMI / payment with its total paid. A **Side by side** table lists every loan's payment, total interest, and total paid. Notes flag the case where the cheapest *rate* and the cheapest *total* are different loans.

**🔢 Example** — Loan 1: ₹25,00,000 @ 9% / 20 yr → EMI ≈ ₹22,494, total paid ≈ ₹54.0 lakh. Loan 2: ₹25,00,000 @ 8.65% / 20 yr → EMI ≈ ₹21,934, total paid ≈ ₹52.6 lakh. Winner: **Loan 2** on total outflow.

**📝 Notes & assumptions**
- Each loan is priced with the standard reducing-balance engine, then ranked by total payment.
- Caveat surfaced by the app: *the cheapest by total outflow can differ from the cheapest by headline rate — a lower rate over a longer tenure often pays more interest overall.*

---

## 💸 Prepayment Impact (`loan.prepay`)

**💡 What it is** — Shows the interest saved and time cut when you throw a lump sum (or a recurring extra amount) at an existing loan.

**🎯 When to use**
- Deciding what a year-end bonus does to your home loan.
- Choosing between **reducing the tenure** and **reducing the EMI** after a part-payment.
- Weighing interest saved against a prepayment penalty on a fixed-rate loan.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Loan amount | Original principal | Default ₹25,00,000. |
| Interest rate | Annual rate, % | Default 8.65%. |
| Tenure / Term | Original loan length | Default 240 months. |
| Prepayment amount | Extra paid on top of the EMI | Default ₹5,00,000. |
| Starting month | Month the prepayment begins | Default 13 (min 1). |
| Repeat every month | Toggle: recurring vs one-off | Default **off** (single lump sum). |
| Keep | **Reduce tenure** or **Reduce EMI** | Default **Reduce tenure**. |
| Prepayment penalty | % charged on the prepaid amount | Default **0** (optional, advanced). |

**🧭 How to use**
1. Enter the loan details and the prepayment amount.
2. Set the starting month, and toggle **Repeat every month** for recurring extra payments.
3. Choose whether to shorten the loan (**Reduce tenure**) or lower the instalment (**Reduce EMI**).
4. Add a penalty only for a fixed-rate loan that charges one.

**📊 Result** — Primary: **interest saved**. Secondary: **months saved** (of the original tenure), the new/unchanged EMI, penalty paid, and the **net benefit** (interest saved minus penalty). A chart overlays the balance with-vs-without the prepayment, and a new amortisation schedule (Principal · Interest · Prepay · Balance) is shown grouped by year.

**🔢 Example** — ₹25,00,000 @ 8.65% / 20 yr, a one-off ₹5,00,000 in month 13, reduce tenure, 0% penalty → roughly **₹13 lakh interest saved** and about **7 years (≈84 months) cut** from the loan, net benefit ≈ interest saved (penalty ₹0).

**📝 Notes & assumptions**
- Reduce tenure: EMI stays the same, the loan simply finishes earlier. Reduce EMI: the instalment is recomputed on the reduced balance and the original end date is kept.
- 🇮🇳 **RBI note**: the RBI bars foreclosure/prepayment charges on floating-rate loans to individuals, so the penalty defaults to 0 — set it only for a fixed-rate loan.

---

## 🔁 Balance Transfer (`loan.transfer`)

**💡 What it is** — Moves the outstanding balance of a loan to a lower-rate lender and works out the monthly saving and the breakeven month once the transfer fee is counted.

**🎯 When to use**
- A rival bank offers a lower rate on your existing loan.
- Checking whether the transfer/closing fee is worth paying.
- Finding how many months it takes to recover that fee.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Outstanding balance | Amount still owed | Default ₹20,00,000. |
| Current rate | Your present rate, % | Default 9.5%. |
| Remaining tenure / term | Months left on the loan | Default 180 months. |
| New rate | Rate at the new lender, % | Default 8.5%. |
| Transfer fee / Closing costs | Flat fee to switch | Default ₹10,000 (optional). |
| Transfer fee (% of balance) | Fee as a % of balance | Default 0 (optional, advanced). Added to the flat fee. |

**🧭 How to use**
1. Enter the outstanding balance and remaining tenure.
2. Put in your current rate and the new lender's rate.
3. Add the transfer fee — a flat amount, a % of balance, or both.

**📊 Result** — Primary: **monthly saving**. Secondary: current payment, new payment, **total saving net of fee**, and the **breakeven** month (when cumulative EMI saving first exceeds the fee). Warnings fire if the new rate isn't actually lower, or if breakeven lands after the loan ends.

**🔢 Example** — Balance ₹20,00,000, current 9.5% / 180 mo, new 8.5%, fee ₹10,000 → current EMI ≈ ₹20,884, new EMI ≈ ₹19,693, **monthly saving ≈ ₹1,191**, total saving ≈ ₹2.04 lakh, **breakeven ≈ month 9**.

**📝 Notes & assumptions**
- Both payments are computed on the same balance and remaining tenure, so the saving is purely the rate difference. Fee = flat amount + (% × balance).
- Breakeven is the first month the accumulated saving overtakes the fee — if it never does, no transfer is worthwhile.

---

## 🧮 Loan Eligibility (`loan.eligibility`)

**💡 What it is** — Turns your income and existing obligations into a borrowing limit, using the FOIR method in India and the DTI (front-end / back-end) method in the US.

**🎯 When to use**
- Estimating how big a loan you can get before you apply.
- Seeing how existing EMIs / debts shrink your capacity.
- Sanity-checking a lender's sanctioned amount.

**🌍 Region** — Both 🇮🇳 / 🇺🇸 (the input set changes with region).

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| 🇮🇳 Net monthly income | Take-home monthly income | Default ₹1,50,000. IN only. |
| 🇮🇳 FOIR | % of income allowed to service all EMIs | Default 50%. IN only. |
| 🇮🇳 Existing EMIs | EMIs you already pay | Default ₹0 (optional). IN only. |
| 🇺🇸 Gross monthly income | Pre-tax monthly income | Default $8,000. US only. |
| 🇺🇸 Front-end DTI | Housing-only debt ratio, % | Default 28%. US only. |
| 🇺🇸 Back-end DTI | All-debt ratio, % | Default 36%. US only. |
| 🇺🇸 Other monthly debts | Existing non-housing debts | Default $0 (optional). US only. |
| Interest rate | Annual rate, % | Default 8.65% (shared). |
| Tenure / Term | Loan length | Default 240 months (shared). |

**🧭 How to use**
1. Enter your income (net for IN, gross for US).
2. Set the ratio(s) — FOIR for India, front- and back-end DTI for the US.
3. Enter existing EMIs / debts, then the intended rate and tenure.

**📊 Result** — Primary: **eligible loan amount**. Secondary (IN): EMI capacity from FOIR, less existing EMIs, giving the eligible EMI. Secondary (US): front-end cap (28%), back-end cap (36% − debts), and the binding eligible payment (the smaller of the two). A warning appears if existing obligations already use up the allowed share.

**🔢 Example** — 🇮🇳 income ₹1,50,000, FOIR 50%, no existing EMIs, 8.65% / 20 yr → eligible EMI ₹75,000, **eligible loan ≈ ₹85.5 lakh**. 🇺🇸 gross $8,000, 28% / 36%, no debts, 8.65% / 20 yr → binding payment $2,240, **eligible loan ≈ $255,000**.

**📝 Notes & assumptions**
- 🇮🇳 FOIR: `eligible EMI = income × FOIR − existing EMIs`; loan amount = present value of that EMI as an annuity.
- 🇺🇸 DTI: `eligible payment = min(income × front-end%, income × back-end% − debts)`; loan amount = present value of that annuity.

---

## 📈 Step-up / Step-down EMI (`loan.stepEmi`)

**💡 What it is** — An EMI that rises (step-up) or falls (step-down) by a fixed percentage each year, keeping the same payoff date. A step-up starts lower — handy when you expect your income to grow.

**🎯 When to use**
- Young borrowers who want a lower starting instalment that grows with salary.
- Retirees who prefer a higher instalment now and lower later (step-down).
- Seeing the extra (or reduced) interest a changing EMI implies versus a flat one.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Loan amount | Principal borrowed | Default ₹25,00,000. |
| Interest rate | Annual rate, % | Default 8.65%. |
| Tenure / Term | Loan length | Default 240 months. |
| Annual step | Yearly change in EMI, %/yr | Default 5%. Positive = step-up, negative = step-down. |

**🧭 How to use**
1. Enter loan amount, rate, and tenure.
2. Set the **Annual step** — positive to grow the EMI each year, negative to shrink it.

**📊 Result** — Primary: the **starting EMI / payment**. Secondary: the **final EMI** (and the year it reaches), total interest, the flat EMI for the same loan (no step), and the interest difference versus that flat EMI. A year-grouped amortisation schedule (Principal · Interest · EMI · Balance) is included.

**🔢 Example** — ₹25,00,000 @ 8.65% / 20 yr with a 5%/yr step-up starts **below** the flat ₹21,934 EMI and climbs each year to finish well above it, paying a little more total interest than a flat EMI. (A step-down does the reverse — higher start, slightly less interest.)

**📝 Notes & assumptions**
- The EMI multiplies by `(1 + step)` every 12 months; the starting EMI is found by bisection so the full term still clears the balance.
- A step-up starts lower and pays a bit more interest than a flat EMI; a step-down starts higher and pays a bit less.

---

## 🏖️ Moratorium / EMI Holiday (`loan.moratorium`)

**💡 What it is** — Shows what a payment holiday really costs once the deferred interest is added back onto the loan.

**🎯 When to use**
- A lender offers (or you're forced into) a few months without payments.
- Comparing "pay nothing" against "pay interest only" during the break.
- Seeing the new EMI and the extra lifetime cost the holiday creates.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Loan amount | Principal borrowed | Default ₹25,00,000. |
| Interest rate | Annual rate, % | Default 8.65%. |
| Tenure / Term | Loan length | Default 240 months. |
| Moratorium length | Number of holiday months | Default 6 (min 1). |
| During the holiday | **Pay nothing (interest capitalises)** or **Pay interest only** | Default **Pay nothing**. |

**🧭 How to use**
1. Enter the loan details.
2. Set how many months the holiday lasts.
3. Choose whether you pay nothing (interest gets added to the balance) or cover interest only.

**📊 Result** — Primary: the **new EMI after the holiday**. Secondary: original EMI, plus either the balance after capitalising (pay-nothing) or interest paid during the holiday (interest-only), the total interest, and the **extra cost versus no holiday**. A principal-vs-interest split is shown.

**🔢 Example** — ₹25,00,000 @ 8.65% / 20 yr, 6-month holiday, pay nothing → balance grows to ≈ ₹26.1 lakh, new EMI ≈ **₹23,130** (up from ₹21,934), extra cost ≈ **₹1.48 lakh** versus taking no holiday.

**📝 Notes & assumptions**
- Pay nothing: balance grows to `P·(1+r)^holiday`, then the EMI is recomputed on it over the remaining months — *unpaid interest is added to the balance and then itself earns interest*, so a holiday is not free.
- Interest-only: you pay `P·r` each holiday month; the balance is unchanged, so only the deferred principal stretches the cost.
- If the moratorium is as long as (or longer than) the tenure, it's capped so at least one instalment remains.

---

## 💳 Overdraft / Flexi Loan (`loan.overdraft`)

**💡 What it is** — Costs an overdraft / flexi (cash-credit, line-of-credit) facility where interest is charged only on the balance you actually draw, not the full sanctioned limit.

**🎯 When to use**
- Estimating the annual interest on an OD / flexi loan.
- Seeing how average utilisation drives the cost.
- Comparing an OD facility against a term loan.

**🌍 Region** — Both 🇮🇳 / 🇺🇸.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Sanctioned limit | Total credit line approved | Default ₹10,00,000. |
| Average utilisation | % of the limit you draw on average | Default 60%. |
| Interest rate | Annual rate, % | Default 10%. |
| Period | Number of months | Default 12 (min 1). |

**🧭 How to use**
1. Enter the sanctioned limit and your expected average utilisation.
2. Add the rate and the period in months.

**📊 Result** — Primary: **total interest** over the period. Secondary: average balance drawn, interest per month, and the undrawn amount (which costs nothing).

**🔢 Example** — Limit ₹10,00,000, 60% average utilisation, 10% p.a., 12 months → average balance ₹6,00,000, interest ₹5,000/month, **total interest ₹60,000**; ₹4,00,000 undrawn at no cost.

**📝 Notes & assumptions**
- `interest = limit × utilisation × monthly rate`, summed over the period.
- Charged on the average balance outstanding — you pay only for what you draw, so keeping utilisation low cuts the cost directly.

---

## 🇺🇸 Refinance (`loan.refinance`)

**💡 What it is** — Works out the new payment, monthly saving, breakeven, and lifetime saving when refinancing a mortgage, including optional cash-out and rolled-in closing costs.

**🎯 When to use**
- Rates have dropped and you're thinking of refinancing your mortgage.
- Deciding whether to pay closing costs out of pocket or roll them into the loan.
- Checking whether a lower monthly payment actually saves money over the full life.

**🌍 Region** — 🇺🇸 US only.

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Current balance | Amount still owed | Default $300,000. |
| Current rate | Present rate, % | Default 7%. |
| Remaining term | Months left on the current loan | Default 300 months. |
| New rate | Rate on the new loan, % | Default 6%. |
| New term | Length of the new loan | Default 360 months. |
| Closing costs | Cost to refinance | Default $6,000. |
| Cash out | Extra cash taken against equity | Default $0 (optional). Added to the new principal. |
| Roll closing costs into the loan | Toggle | Default **off** (optional). If on, closing costs are financed. |

**🧭 How to use**
1. Enter the current balance, rate, and remaining term.
2. Enter the new rate and new term.
3. Add closing costs; optionally take cash out or roll the costs into the loan.

**📊 Result** — Primary: **monthly saving**. Secondary: current payment, new payment, **breakeven** month, and **lifetime saving** across the full life of both loans. Warnings fire if the new payment isn't lower, or if the new term is longer than what remains (a lower payment can still mean more total interest).

**🔢 Example** — Balance $300,000, current 7% / 300 mo, new 6% / 360 mo, $6,000 closing, no cash-out, not rolled → current payment ≈ $2,120, new payment ≈ $1,799, **monthly saving ≈ $321**, **breakeven ≈ month 19** — but because the term stretches from 300 to 360 months, **lifetime saving ≈ −$17,640** (you pay more overall), and the "term is longer" warning fires.

**📝 Notes & assumptions**
- New principal = current balance + cash-out + (rolled closing costs, if chosen). Both payments use the standard reducing-balance formula.
- `breakeven = closing costs ÷ monthly saving`. A lower monthly payment over a longer term can still cost more across the full life — always check the lifetime saving, not just the monthly figure.
