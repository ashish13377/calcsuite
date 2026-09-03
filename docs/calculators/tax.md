# 🧾 Tax Calculators

> 🧩 **Use in your app** — render any one with `<CalculatorPanel id="…" />`, or run its `compute` programmatically.
>
> ```tsx
> import { CalculatorPanel, calculatorById, makeFormatter, DEFAULT_SETTINGS, D } from 'calcsuite-react';
> <CalculatorPanel id="tax.gst" />
> // engine (no UI):
> const def = calculatorById('tax.gst')!;
> def.compute({ amount: '1000', gstRatePct: '18', mode: 'add', split: 'intra' },
>   { settings: DEFAULT_SETTINGS, region: 'IN', fmt: makeFormatter(DEFAULT_SETTINGS), D }).raw; // { total: "1180", cgst: "90", … }
> ```

CalcSuite's tax calculators help you plan ahead: figure out GST on an invoice, how much TDS a bank will cut, whether the old or new income-tax regime is cheaper, what you'll owe on capital gains, how much HRA is exempt, when advance-tax instalments fall due, and — for the US — sales tax, federal income tax, and mortgage-interest savings. Indian calculators use FY 2024-25 (AY 2025-26) rules; US calculators use tax year 2024 brackets and standard deductions.

> ⚠️ **Everything here is an ESTIMATE for planning only — not tax filing advice.** Rates, slabs, thresholds and rules change, and your actual liability depends on your full situation. Always verify against current law and consult a qualified professional before filing or paying.

---

## 🧮 GST Calculator (`tax.gst`)

**💡 What it is** — Adds GST on top of a price or backs it out of a GST-inclusive price, then splits the tax into CGST + SGST (intra-state) or IGST (inter-state), with optional cess and reverse-charge handling.

**🎯 When to use**
- Preparing or checking a tax invoice.
- Finding the pre-GST base price hidden inside a quoted "inclusive" amount.
- Splitting GST correctly for an intra-state vs inter-state supply.
- Applying compensation cess (e.g. on select goods) or noting a reverse-charge (RCM) transaction.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Amount | The price to work from | Money, default ₹1,000 |
| GST rate | The applicable GST slab | Select: 0 / 5 / 12 / 18 / 28% — default 18% |
| Amount is | Whether GST should be added or removed | Segmented: **Exclusive (add GST)** / **Inclusive (remove GST)** — default add |
| Supply type | Intra-state or inter-state | Segmented: **Intra-state (CGST+SGST)** / **Inter-state (IGST)** — default intra |
| Cess | Extra compensation cess % on the base | Percent, default 0% (optional, advanced) |
| Reverse charge (RCM) | Flag that the recipient pays the GST | Toggle, default off (advanced) |

**🧭 How to use**
1. Enter the amount.
2. Pick the GST rate slab.
3. Choose whether the amount is exclusive (add GST) or inclusive (remove GST).
4. Select intra-state or inter-state supply.
5. Optionally set a cess % and/or turn on reverse charge, then read the result.

**📊 Result**
- **Primary:** Total payable (add mode) or Base pre-GST (remove mode).
- **Secondary:** Total / total GST, then CGST + SGST (intra) or IGST (inter), plus cess if any.
- A visual split of Base vs tax components (Base, CGST/SGST or IGST, Cess).

**🔢 Example** — ₹1,000, 18%, exclusive, intra-state → GST **₹180**, total **₹1,180**, with CGST **₹90** and SGST **₹90**. Switch to inclusive and the base backs out to ₹847.46.

**📝 Notes & assumptions**
- Add mode: `GST = amount × rate`, `total = amount + GST + cess`.
- Remove mode: `base = amount ÷ (1 + rate)`, `GST = amount − base`; cess is computed on the base.
- Intra-state splits GST equally into CGST and SGST; inter-state applies a single IGST.
- Reverse charge only annotates that the recipient remits the GST directly to the government — it does not change the amounts shown.
- Estimate for planning only, not tax advice.

---

## 🏦 TDS on Interest (`tax.tds`)

**💡 What it is** — Estimates the Tax Deducted at Source on your annual interest income (Section 194A), taking the 15G/15H waiver, senior-citizen threshold and the no-PAN penalty rate into account.

**🎯 When to use**
- Checking how much TDS a bank or post office will deduct on FD/savings interest.
- Seeing whether your interest stays under the deduction threshold.
- Confirming the effect of submitting Form 15G/15H, or of not having a PAN on file.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Annual interest income | Total interest for the year | Money, default ₹60,000 |
| Interest from | Source of the interest | Segmented: **Bank / post office** / **Other (company, etc.)** — default bank |
| Senior citizen (60+) | Whether you are 60 or older | Toggle, default off |
| Form 15G/15H submitted | Whether you filed the no-deduction declaration | Toggle, default off |
| PAN provided | Whether the payer has your PAN | Toggle, default on |

**🧭 How to use**
1. Enter your annual interest income.
2. Choose the source (bank/post office vs other payer).
3. Toggle senior citizen, Form 15G/15H and PAN as they apply.
4. Read the TDS deducted and net interest.

**📊 Result**
- **Primary:** TDS deducted.
- **Secondary:** Net interest received, effective TDS rate, and the applicable threshold.

**🔢 Example** — ₹60,000 bank interest, non-senior, PAN on file, no 15G/15H → threshold ₹40,000, so TDS = 60,000 × 10% = **₹6,000**; net interest **₹54,000**; effective rate 10%.

**📝 Notes & assumptions**
- Thresholds: bank / post office ₹40,000 (₹50,000 for senior citizens); other payers ₹5,000.
- Rate is 10% with PAN, 20% without PAN.
- No TDS if interest is at or below the threshold, or if a valid Form 15G/15H is submitted (valid only when total income is below the taxable limit).
- Formula: `TDS = interest × rate`, only when interest exceeds the threshold and no 15G/15H applies.
- Estimate for planning only, not tax advice.

---

## 📑 Income Tax — Old vs New (`tax.incomeIN`)

**💡 What it is** — Computes your FY 2024-25 income tax under both the old and new regimes side by side (with slabs, 87A rebate, surcharge with marginal relief and 4% cess) and tells you which is cheaper.

**🎯 When to use**
- Deciding between the old and new regime for the year.
- Estimating your tax after 80C/80D/HRA/home-loan deductions.
- Seeing the slab-wise breakdown of the winning regime.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Gross annual income | Total income before deductions | Money, default ₹12,00,000 |
| Age | Age band (affects old-regime slabs) | Segmented: **< 60** / **60–80** / **80+** — default < 60 |
| 80C deductions | PF, ELSS, LIC, etc. | Money, default ₹1,50,000, capped at ₹1.5L (optional, old regime) |
| 80D (health insurance) | Medical insurance premium | Money, default ₹25,000 (optional, old regime) |
| HRA exemption | Exempt HRA amount | Money, default ₹0 (optional, old regime) |
| Home loan interest (24b) | Self-occupied home-loan interest | Money, default ₹0, capped at ₹2L (optional, old regime) |

**🧭 How to use**
1. Enter gross annual income and select your age band.
2. Fill in the deductions you can claim (they only affect the old regime).
3. Read which regime is cheaper and the tax under each.
4. Review the slab-by-slab schedule of the chosen regime.

**📊 Result**
- **Primary:** Which regime is cheaper, its tax, and the savings vs the other.
- **Secondary:** New-regime tax and old-regime tax, each with the taxable income used.
- **Schedule:** Slab breakdown of the cheaper regime — Income slab | In slab | Rate | Tax.

**🔢 Example** — Gross ₹7,00,000, age < 60, new regime → taxable = 7,00,000 − 75,000 = ₹6,25,000; slab tax ₹16,250 is fully wiped out by the Section 87A rebate (taxable ≤ ₹7L), so tax = **₹0**.

**📝 Notes & assumptions**
- FY 2024-25 (AY 2025-26).
- **New regime:** ₹75,000 standard deduction, no chapter VI-A deductions; income up to ₹7L taxable is fully rebated (87A, up to ₹25,000). Slabs: 0% to ₹3L, 5% ₹3–7L, 10% ₹7–10L, 15% ₹10–12L, 20% ₹12–15L, 30% above ₹15L.
- **Old regime:** ₹50,000 standard deduction plus 80C (≤₹1.5L) / 80D / HRA / home-loan interest (≤₹2L); 87A rebate (up to ₹12,500) applies up to ₹5L taxable. Slabs vary by age band.
- Surcharge applies above ₹50L with marginal relief; 4% health & education cess is added on top.
- Estimate for planning only, not tax advice.

---

## 📈 Capital Gains Tax (`tax.capitalGains`)

**💡 What it is** — Works out short- or long-term capital gains tax on listed equity, debt funds/bonds and property using the post-23 July 2024 rules.

**🎯 When to use**
- Estimating tax before selling shares, mutual funds, bonds or property.
- Checking whether a holding qualifies as long-term.
- Seeing the effect of the ₹1.25L LTCG exemption on equity.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Asset type | What you sold | Select: **Listed equity / equity MF** / **Debt fund / bond** / **Property / land** — default equity |
| Purchase price | What you paid | Money, default ₹1,00,000 |
| Sale price | What you sold for | Money, default ₹2,50,000 |
| Holding period (months) | How long you held it | Integer months, default 24 (min 0) |
| Cost of improvement | Capital improvements (property) | Money, default ₹0 (optional) |

**🧭 How to use**
1. Choose the asset type.
2. Enter purchase and sale prices (and any improvement cost).
3. Enter the holding period in months.
4. Read the gain, its short/long classification, and the tax.

**📊 Result**
- **Primary:** Capital gains tax — or "At your slab rate" for slab-taxed cases (debt, or short-term property).
- **Secondary:** Capital gain amount and the gain type (with holding months).

**🔢 Example** — Listed equity, buy ₹1,00,000, sell ₹2,50,000, held 24 months → gain ₹1,50,000; long-term, so taxable = 1,50,000 − 1,25,000 = ₹25,000 at 12.5% = **₹3,125**.

**📝 Notes & assumptions**
- **Listed equity:** LT if held > 12 months → 12.5% on gains above the ₹1.25L annual exemption; else STCG at 20% (Section 111A).
- **Property:** LT if held > 24 months → 12.5% without indexation (pre-23 July 2024 sales could instead use 20% with indexation); else STCG added to income and taxed at your slab rate.
- **Debt funds/bonds** (bought after 1 April 2023): the whole gain is taxed at your slab rate regardless of holding period.
- `gain = sale − purchase − improvement`. A gain of zero or less is treated as a capital loss (set off / carry forward per the rules).
- Surcharge and cess are **not** added here.
- Estimate for planning only, not tax advice.

---

## 🏠 HRA Exemption (`tax.hra`)

**💡 What it is** — Calculates your House Rent Allowance exemption under Section 10(13A) as the least of the three statutory limits, and the taxable balance.

**🎯 When to use**
- Working out how much of your HRA is tax-free (old regime).
- Comparing the three HRA limits to see which one caps you.
- Planning rent vs salary structure.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Basic salary (annual) | Annual basic pay | Money, default ₹6,00,000 |
| DA (part of retirement) | Dearness allowance forming part of retirement benefits | Money, default ₹0 (optional) |
| HRA received (annual) | HRA actually received | Money, default ₹2,40,000 |
| Rent paid (annual) | Rent you paid | Money, default ₹3,00,000 |
| Metro city | Delhi / Mumbai / Kolkata / Chennai | Toggle, default on |

**🧭 How to use**
1. Enter annual basic salary (and DA if it counts toward retirement benefits).
2. Enter HRA received and rent paid.
3. Toggle metro city on/off.
4. Read the exempt HRA and the three limits behind it.

**📊 Result**
- **Primary:** HRA exempt.
- **Secondary:** Taxable HRA, HRA received, "Rent − 10% of salary", and "50%/40% of salary".

**🔢 Example** — Basic ₹6,00,000, no DA, HRA received ₹2,40,000, rent ₹1,80,000, metro → limits are actual HRA ₹2,40,000, rent − 10% of salary = 1,80,000 − 60,000 = ₹1,20,000, and 50% of salary = ₹3,00,000. Least = **₹1,20,000 exempt**, taxable HRA ₹1,20,000.

**📝 Notes & assumptions**
- Exemption = **least of** (HRA received, rent − 10% of salary, 50% of salary for metro / 40% for non-metro).
- Salary = basic + DA (only the DA that forms part of retirement benefits).
- HRA exemption applies **only under the old regime**.
- Estimate for planning only, not tax advice.

---

## 🗓️ Advance Tax Instalments (`tax.advanceTax`)

**💡 What it is** — Splits your net tax liability into the four advance-tax instalments (15% / 45% / 75% / 100% cumulative) with their due dates.

**🎯 When to use**
- Planning advance-tax payments through the year.
- Checking how much is due by each quarterly deadline.
- Netting off TDS/TCS already paid to find what's left.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Total tax liability | Your estimated tax for the year | Money, default ₹1,20,000 |
| TDS / TCS already paid | Tax already deducted/collected | Money, default ₹20,000 (optional) |

**🧭 How to use**
1. Enter your total estimated tax liability.
2. Enter any TDS/TCS already paid.
3. Read the advance tax due and the instalment schedule.

**📊 Result**
- **Primary:** Advance tax due (liability − TDS).
- **Secondary:** Total tax liability and amount already paid.
- **Schedule:** Due date | Cumulative % | Cumulative amount | Instalment.

**🔢 Example** — Liability ₹1,20,000, TDS ₹20,000 → due ₹1,00,000, payable as **₹15,000 by 15 Jun**, ₹30,000 by 15 Sep, ₹30,000 by 15 Dec, ₹25,000 by 15 Mar.

**📝 Notes & assumptions**
- Due dates: 15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%) — each instalment is cumulative % of (liability − TDS) minus what was already due.
- Advance tax is only required when net liability is ₹10,000 or more for the year (a warning appears below that).
- Shortfalls attract interest under Section 234C.
- Estimate for planning only, not tax advice.

---

## 🛒 Sales Tax (`tax.salesTaxUS`)

**💡 What it is** — Adds US sales tax to a purchase by combining the state rate with an optional local/city rate.

**🎯 When to use**
- Estimating the checkout total for a purchase.
- Combining state and local sales-tax rates.
- Backing into how much of a total is tax.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Purchase amount | Pre-tax price | Money, default $100 |
| State tax rate | State sales-tax % | Percent, default 6% |
| Local / city tax rate | Local sales-tax % | Percent, default 2% (optional) |

**🧭 How to use**
1. Enter the pre-tax purchase amount.
2. Enter the state rate and, if any, the local rate.
3. Read the total with tax.

**📊 Result**
- **Primary:** Total with tax.
- **Secondary:** Sales tax, combined rate, and pre-tax amount, plus an Amount vs Tax split.

**🔢 Example** — $100 at 6% state + 2% local (8% combined) → sales tax **$8**, total **$108**.

**📝 Notes & assumptions**
- `tax = amount × (state rate + local rate)`.
- Rates vary widely by state and locality — enter the ones that apply to you.
- Estimate for planning only, not tax advice.

---

## 🇺🇸 Federal Income Tax (`tax.incomeUS`)

**💡 What it is** — Estimates 2024 US federal income tax by filing status, using the standard or an itemized deduction, with a bracket-by-bracket breakdown.

**🎯 When to use**
- Estimating your federal tax bill for tax year 2024.
- Comparing filing statuses or standard vs itemized deductions.
- Seeing your effective and marginal rates and after-tax income.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Gross income | Total income before deductions | Money, default $60,000 |
| Filing status | Your filing status | Select: **Single** / **Married filing jointly** / **Head of household** — default single |
| Deduction | Standard or itemized | Segmented: **Standard** / **Itemized** — default standard |
| Itemized deductions | Total itemized amount | Money, default $0 (shown only when Itemized is selected) |

**🧭 How to use**
1. Enter gross income and pick your filing status.
2. Choose standard or itemized; if itemized, enter the amount.
3. Read the tax, taxable income, and rates, then the bracket breakdown.

**📊 Result**
- **Primary:** Federal income tax.
- **Secondary:** Taxable income (after deduction), effective rate, marginal rate, and after-tax income.
- **Schedule:** Bracket | In bracket | Rate | Tax.

**🔢 Example** — Single, $60,000, standard deduction → taxable = 60,000 − 14,600 = **$45,400**; tax = 10% on the first $11,600 ($1,160) + 12% on the remaining $33,800 ($4,056) = **$5,216** (effective ~8.7%, marginal 12%).

**📝 Notes & assumptions**
- Tax year 2024 brackets and standard deductions ($14,600 single / $29,200 married-joint / $21,900 head-of-household).
- 2024 bracket rates: 10 / 12 / 22 / 24 / 32 / 35 / 37% over status-specific thresholds.
- **Excludes** state income tax, FICA (Social Security + Medicare), credits, and phase-outs.
- Estimate for planning only, not tax advice.

---

## 🏡 Mortgage Interest Deduction (`tax.mortgageDeductionUS`)

**💡 What it is** — Estimates the tax savings from deducting home-mortgage interest, applying the $750k acquisition-debt cap.

**🎯 When to use**
- Estimating the tax benefit of your mortgage interest.
- Seeing how the $750k debt cap trims a large loan's deductible interest.
- Comparing the benefit at different marginal tax rates.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Annual mortgage interest | Interest paid for the year | Money, default $18,000 |
| Marginal tax rate | Your top federal rate | Percent, default 24% |
| Loan balance | Outstanding principal | Money, default $0 — interest on debt over $750k is not deductible (optional) |

**🧭 How to use**
1. Enter your annual mortgage interest.
2. Enter your marginal tax rate.
3. Optionally enter the loan balance so the $750k cap can be applied.
4. Read the estimated tax savings.

**📊 Result**
- **Primary:** Estimated tax savings.
- **Secondary:** Deductible interest and marginal tax rate.

**🔢 Example** — $18,000 interest at a 24% marginal rate, loan under the cap → savings = 18,000 × 24% = **$4,320**. With a $1,000,000 balance and $30,000 interest, only 75% ($22,500) is deductible → savings $5,400.

**📝 Notes & assumptions**
- Acquisition-debt limit is $750,000 ($375,000 if married filing separately) for loans after 15 Dec 2017; interest on debt above the cap is scaled down proportionally: `deductible = interest × 750,000 ÷ balance`.
- `savings = deductible interest × marginal rate`.
- Assumes you itemize and are already above the standard deduction — otherwise only the excess over the standard deduction yields a benefit.
- Estimate for planning only, not tax advice.
