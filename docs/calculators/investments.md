# 📈 Investment Calculators

> 🧩 **Use in your app** — render any one with `<CalculatorPanel id="…" />`, or use the `finance` helpers directly.
>
> ```tsx
> import { CalculatorPanel, finance } from 'calcsuite';
> <CalculatorPanel id="invest.sip" />
> // engine (no UI): SIP future value (annuity-due)
> finance.fvAnnuity('10000', finance.periodic('12'), 120, true).toFixed(2);
> ```

CalcSuite's investment calculators cover the full arc of wealth building: everyday market investing with **SIP**, **step-up SIP**, **lump sum**, **SWP** and **goal planning** (available in every region); India's classic savings and retirement schemes — **FD**, **RD**, **PPF**, **NPS**, **EPF** and **SSY** 🇮🇳; and US retirement and education accounts — **401(k)**, **Roth vs Traditional IRA** and **529** 🇺🇸. Every calculator uses exact decimal money math, returns a headline figure plus supporting metrics, and (where it makes sense) a year-by-year schedule and growth chart. Amounts shown in your account currency (₹ or $) depending on region.

---

## 💸 SIP Calculator (`invest.sip`)

**💡 What it is** — Projects the future value of a monthly Systematic Investment Plan invested at a constant expected rate of return.

**🎯 When to use**
- Estimating what a regular monthly mutual-fund investment could grow into.
- Comparing how tenure or return assumptions change the outcome.
- Setting a realistic monthly contribution for a long-term plan.

**🌍 Region** — Both 🇮🇳 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Monthly investment | Amount you invest each month | Default 10,000 |
| Expected return | Assumed annual return | % p.a., default 12 |
| Investment period | Total months invested | Default 120 (10 years) |

**🧭 How to use**
1. Enter your monthly investment amount.
2. Set an expected annual return (12% is the default assumption).
3. Choose the investment period in months.
4. Read the total value and the invested-vs-gains split.

**📊 Result** — Primary: **Total value** at maturity. Secondary: total invested, estimated gains, absolute return %. Includes an invested/gains split, a year-by-year schedule (Year · Invested · Gains · Value) and a growth chart.

**🔢 Example** — 10,000/month at 12% for 120 months → invested 12,00,000, total value ≈ 23.2 lakh, gains ≈ 11.2 lakh.

**📝 Notes & assumptions** — `FV = P·[((1+i)^n − 1) / i]·(1+i)` with `i = r/12`. This is an **annuity-due**: each instalment is invested at the *start* of the month. Returns are assumed constant; real market returns vary year to year.

---

## 📈 Step-up SIP Calculator (`invest.stepupSip`)

**💡 What it is** — A SIP whose monthly amount rises by a fixed percentage every year, simulated month by month.

**🎯 When to use**
- Modelling a SIP you increase annually as your income grows.
- Seeing how yearly top-ups accelerate the final corpus versus a flat SIP.
- Planning a contribution that keeps pace with salary hikes.

**🌍 Region** — Both 🇮🇳 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Initial monthly investment | Starting monthly amount | Default 10,000 |
| Annual step-up | Yearly increase in the monthly amount | %, default 10 |
| Expected return | Assumed annual return | % p.a., default 12 |
| Investment period | Total months invested | Default 120 (10 years) |

**🧭 How to use**
1. Enter the starting monthly investment.
2. Set the annual step-up percentage (how much the amount rises each year).
3. Set the expected return and the investment period in months.
4. Review the total value and the final monthly amount reached.

**📊 Result** — Primary: **Total value**. Secondary: total invested, estimated gains, final monthly amount. Includes invested/gains split, yearly schedule and growth chart.

**🔢 Example** — 10,000/month, stepping up 10% a year, at 12% for 120 months → final monthly ≈ 23,579, total value ≈ 32–33 lakh (well above a flat SIP).

**📝 Notes & assumptions** — Simulated monthly: the instalment is contributed at the start of the month, then grows one month; the amount steps up on each yearly anniversary (every 12 months). Returns are assumed constant.

---

## 💰 Lump Sum Calculator (`invest.lumpsum`)

**💡 What it is** — The maturity value of a single one-time investment compounded at your chosen frequency.

**🎯 When to use**
- Projecting a one-off investment (bonus, windfall, redeployed savings).
- Comparing compounding frequencies (annual vs monthly, etc.).
- Finding the effective CAGR of a lump-sum plan.

**🌍 Region** — Both 🇮🇳 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Investment amount | One-time amount invested | Default 100,000 |
| Expected return | Assumed annual return | % p.a., default 12 |
| Investment period | Number of years | Default 10 |
| Compounding | How often interest compounds | Annual / Semi-annual / Quarterly / Monthly; default Annual |

**🧭 How to use**
1. Enter the amount you invest today.
2. Set the expected annual return.
3. Choose the number of years and the compounding frequency.
4. Read the maturity value, gains and CAGR.

**📊 Result** — Primary: **Maturity value**. Secondary: total gains, invested amount, CAGR. Includes invested/gains split, yearly schedule and growth chart.

**🔢 Example** — 1,00,000 at 12% for 10 years, annual compounding → maturity ≈ 3,10,585, gains ≈ 2,10,585, CAGR 12%.

**📝 Notes & assumptions** — `A = P·(1 + r/f)^(f·t)`, where `f` is the periods-per-year of the chosen compounding. Returns are assumed constant across the whole period.

---

## 🏧 SWP Calculator (`invest.swp`)

**💡 What it is** — A Systematic Withdrawal Plan: how long a corpus lasts (or how much is left) under fixed monthly withdrawals while it keeps earning returns.

**🎯 When to use**
- Planning a monthly income drawdown from a retirement corpus.
- Checking whether a withdrawal rate is sustainable.
- Seeing when a corpus would be exhausted at a given withdrawal.

**🌍 Region** — Both 🇮🇳 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Total investment | Starting corpus | Default 5,000,000 |
| Monthly withdrawal | Amount taken out each month | Default 30,000 |
| Expected return | Assumed annual return on the corpus | % p.a., default 8 |
| Withdrawal period | Months to withdraw for | Optional; default 120. Leave blank to run until depletion (capped at 100 years) |

**🧭 How to use**
1. Enter the starting corpus and the monthly withdrawal.
2. Set the expected annual return.
3. Optionally set a withdrawal period; leave it blank to see how long the corpus survives.
4. Read either the final balance or the month the corpus runs out.

**📊 Result** — Primary: **Final balance** (if it survives) or **Corpus lasts N months** (if depleted). Secondary: total withdrawn, final balance, starting corpus. Includes a schedule (Year · Opening · Withdrawn · Growth · Balance) and a balance chart.

**🔢 Example** — 50,00,000 corpus, 30,000/month withdrawal, 8% return, 120 months → survives the period, final balance ≈ 56 lakh, total withdrawn 36,00,000.

**📝 Notes & assumptions** — Each month: `balance = balance·(1 + r/12) − withdrawal` (growth first, then the withdrawal). The last withdrawal may be partial when the corpus runs low. Returns are assumed constant — a market downturn early on shortens how long the corpus lasts.

---

## 🎯 Goal SIP Planner (`invest.goal`)

**💡 What it is** — The monthly SIP needed to reach an inflation-adjusted target, after accounting for savings you already have.

**🎯 When to use**
- Working backwards from a goal (house, education, retirement) to a monthly contribution.
- Adjusting for inflation so the target keeps its real value.
- Factoring in existing savings that will also grow.

**🌍 Region** — Both 🇮🇳 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Today's cost of goal | Current price of what you're saving for | Default 10,000,000 |
| Years to goal | Time horizon in years | Default 15 |
| Expected return | Assumed annual return on the SIP | % p.a., default 12 |
| Inflation | Annual inflation applied to the target | % p.a., default 6 |
| Existing savings | Amount already saved toward the goal | Optional; default 0 |

**🧭 How to use**
1. Enter today's cost of the goal and how many years away it is.
2. Set the expected return and an inflation rate.
3. Optionally enter existing savings already earmarked for this goal.
4. Read the required monthly SIP.

**📊 Result** — Primary: **Required monthly SIP** (per month). Secondary: inflation-adjusted target, total you will invest, growth on the SIP. Notes show the inflated target and how existing savings reduce the requirement.

**🔢 Example** — Goal cost 1,00,00,000 in 15 years, 12% return, 6% inflation, no existing savings → inflation-adjusted target ≈ 2.40 crore, required SIP ≈ 47,500/month.

**📝 Notes & assumptions** — `inflatedTarget = target·(1+infl)^yrs`, then `SIP = (inflatedTarget − existing·(1+i)^n) / annuity-due factor`. Existing savings compound over the full horizon and reduce what the SIP must fund. If those savings alone already meet the inflated goal, the planner warns that no SIP is needed.

---

## 🏦 Fixed Deposit — FD (`invest.fd`)

**💡 What it is** — The maturity value and interest on a bank fixed deposit, either cumulative (reinvested) or interest-payout.

**🎯 When to use**
- Estimating returns on a term deposit at a bank.
- Comparing reinvest vs payout, or different compounding frequencies.
- Checking the effective annual yield and any TDS impact.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Deposit amount | Principal deposited | Default 100,000 |
| Interest rate | Bank's quoted rate | % p.a., default 7 |
| Tenure | Deposit term in months | Default 60 (5 years) |
| Compounding | Compounding frequency | Quarterly / Monthly / Annual / Cumulative (quarterly); default Quarterly |
| Interest handling | Reinvest (cumulative) or Payout | Default Reinvest |
| Deduct TDS | Apply 10% TDS on interest above ₹40,000 | Advanced toggle; default off |

**🧭 How to use**
1. Enter the deposit amount, rate and tenure in months.
2. Pick the compounding frequency.
3. Choose whether interest is reinvested or paid out.
4. Optionally enable TDS deduction to see the net figure.

**📊 Result** — Primary: **Maturity value** (or **Principal returned** in payout mode). Secondary: total interest, effective annual yield, interest per period (payout mode), after-TDS value (if TDS on). Includes principal/interest split, yearly schedule and balance chart.

**🔢 Example** — 1,00,000 at 7% for 60 months, quarterly cumulative → maturity ≈ 1,41,478, interest ≈ 41,478, effective yield ≈ 7.19%.

**📝 Notes & assumptions** — Cumulative: `A = P·(1 + r/f)^(f·t)`; payout: `interest/period = P·(r/f)` with principal returned at maturity. **TDS:** 10% applies on interest above ₹40,000/yr (₹50,000 for senior citizens); submit Form 15G/15H to waive if your income is below the taxable limit.

---

## 🔁 Recurring Deposit — RD (`invest.rd`)

**💡 What it is** — The maturity of a monthly recurring deposit, compounded quarterly as banks do.

**🎯 When to use**
- Planning a fixed monthly deposit into a bank RD.
- Estimating the interest earned over the term.
- Comparing RD outcomes across rates or tenures.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Monthly deposit | Amount deposited each month | Default 5,000 |
| Interest rate | Bank's quoted rate | % p.a., default 7 |
| Tenure (months) | Total months | Default 12; minimum 3, in steps of 3 |

**🧭 How to use**
1. Enter the monthly deposit and interest rate.
2. Set the tenure in months (a multiple of 3).
3. Read the maturity value and interest earned.

**📊 Result** — Primary: **Maturity value**. Secondary: total invested, interest earned. Includes invested/interest split, yearly schedule and value chart.

**🔢 Example** — 5,000/month at 7% for 12 months → invested 60,000, maturity ≈ 62,000, interest ≈ 2,000.

**📝 Notes & assumptions** — `M = Σ deposit·(1 + r/4)^(quarters remaining)` — each instalment compounds quarterly for its remaining life. Banks require the tenure to be a **multiple of 3 months**; a non-multiple triggers a warning. Standard TDS note applies to the interest.

---

## 🛡️ Public Provident Fund — PPF (`invest.ppf`)

**💡 What it is** — The tax-free maturity of a PPF account over its 15-year lock-in and 5-year extension blocks.

**🎯 When to use**
- Projecting a long-term, government-backed, tax-free corpus.
- Planning yearly 80C contributions.
- Seeing the effect of extending beyond 15 years.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Yearly deposit | Amount deposited each year | Default 150,000 (the annual cap) |
| Interest rate | Government-declared PPF rate | % p.a., default 7.1 |
| Tenure | Total years | Segmented: 15 / 20 / 25 / 30; default 15 |

**🧭 How to use**
1. Enter the yearly deposit (up to ₹1,50,000).
2. Set the interest rate.
3. Pick the tenure block (15, 20, 25 or 30 years).
4. Read the tax-free maturity value.

**📊 Result** — Primary: **Maturity value**. Secondary: total invested, interest earned. Includes invested/interest split, yearly schedule (Year · Opening · Deposit · Interest · Balance) and balance chart.

**🔢 Example** — 1,50,000/year at 7.1% for 15 years → invested 22.5 lakh, maturity ≈ 40.68 lakh, interest ≈ 18.2 lakh.

**📝 Notes & assumptions** — Annual compounding; each deposit (made before the 5th of the month) earns a full year of interest, so the year behaves as an **annuity-due**. Maximum deposit is **₹1,50,000 per financial year** — more is not accepted and earns no interest (the calculator warns). Maturity and interest are fully **tax-free**; the 15-year lock-in is extendable in **5-year blocks**.

---

## 🧓 National Pension System — NPS (`invest.nps`)

**💡 What it is** — Projects the retirement corpus, the tax-free lump sum, and an estimated monthly pension from regular NPS contributions.

**🎯 When to use**
- Estimating a retirement corpus from monthly NPS contributions.
- Splitting the corpus into a lump sum plus an annuity for pension.
- Gauging the monthly pension at an assumed annuity rate.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Monthly contribution | Amount contributed each month | Default 5,000 |
| Expected return | Assumed pre-retirement return | % p.a., default 10 |
| Current age | Your age now | Years, default 30 (18–65) |
| Retirement age | Age at retirement | Years, default 60 (60–75) |
| Annuity return | Assumed annuity rate at retirement | % p.a., default 6 |
| Annuity share | % of corpus used to buy an annuity | %, default 40 (minimum 40, max 100) |

**🧭 How to use**
1. Enter your monthly contribution and expected return.
2. Set your current and retirement ages.
3. Set the annuity return and the share of the corpus going to the annuity.
4. Read the corpus, tax-free lump sum and estimated monthly pension.

**📊 Result** — Primary: **Corpus at retirement**. Secondary: tax-free lump sum (with % of corpus), monthly pension (with the annuity amount it comes from), total invested. Includes an invested/returns split.

**🔢 Example** — 5,000/month at 10% from age 30 to 60, 40% annuity at 6% → corpus ≈ 1.13 crore, lump sum ≈ 67.8 lakh, monthly pension ≈ 22,600.

**📝 Notes & assumptions** — `Corpus = FV of the monthly contributions; pension = corpus·annuity% · (annuity rate / 12)`. At least **40% of the corpus must buy an annuity** — entering less is bumped up to 40% with a warning; the rest can be withdrawn tax-free. The pension is an estimate based on a level annuity at the assumed rate.

---

## 🧾 Employees' Provident Fund — EPF (`invest.epf`)

**💡 What it is** — Projects your EPF corpus at retirement from employee plus employer contributions, growing with annual salary hikes.

**🎯 When to use**
- Estimating the EPF balance you'll retire with.
- Seeing how salary growth compounds the corpus.
- Splitting the total into contributions vs interest.

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Basic monthly salary | Your basic pay (EPF is on basic) | Default 25,000 |
| Employee contribution | Your share of basic | %, default 12 |
| Employer contribution | Employer's share of basic | %, default 12 |
| EPF interest rate | Declared EPF rate | % p.a., default 8.25 |
| Current age | Your age now | Years, default 30 (18–58) |
| Retirement age | Age at retirement | Years, default 58 (40–70) |
| Annual salary hike | Yearly increase in basic pay | %, default 5 |

**🧭 How to use**
1. Enter your basic monthly salary and the contribution percentages.
2. Set the EPF interest rate.
3. Set current age, retirement age and the annual salary hike.
4. Read the projected corpus at retirement.

**📊 Result** — Primary: **EPF corpus at retirement**. Secondary: total contributions, interest earned. Includes contributions/interest split, yearly schedule (Year · Opening · Contribution · Interest · Balance) and balance chart.

**🔢 Example** — Basic 25,000, 12% + 12%, 8.25% rate, age 30 to 58, 5% annual hike → corpus ≈ 1.7 crore (approx).

**📝 Notes & assumptions** — Each year the opening balance compounds monthly and the year's deposits form a monthly annuity; salary grows by the hike each year. **Simplification:** the full 12% employer share is credited to EPF here. In reality 8.33% (up to a wage ceiling) goes to the EPS pension scheme and only 3.67% to EPF, so a real EPF-only balance is lower. The EPF rate is declared yearly; this projection assumes it stays constant.

---

## 👧 Sukanya Samriddhi Yojana — SSY (`invest.ssy`)

**💡 What it is** — The maturity value of the girl-child savings scheme: 15 years of deposits that keep compounding until the account matures at 21 years.

**🎯 When to use**
- Planning a tax-free corpus for a girl child's education or marriage.
- Estimating maturity given a yearly deposit and her current age.
- Confirming eligibility (account opened before age 10).

**🌍 Region** — 🇮🇳

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Yearly deposit | Amount deposited each year | Default 150,000; range ₹250–₹1,50,000 |
| Interest rate | Government-declared SSY rate | % p.a., default 8.2 |
| Girl's current age | Age at account opening | Years, default 5 (0–10) |

**🧭 How to use**
1. Enter the yearly deposit (₹250 to ₹1,50,000).
2. Set the interest rate.
3. Enter the girl's current age (must be under 10 to open).
4. Read the maturity value and the age at which it's paid.

**📊 Result** — Primary: **Maturity value** (with the girl's age at maturity). Secondary: total invested, interest earned. Includes invested/interest split, yearly schedule (Year · Opening · Deposit · Interest · Balance) and balance chart.

**🔢 Example** — 1,50,000/year at 8.2%, girl aged 5 → deposits for 15 years, matures 21 years after opening (at age 26); invested 22.5 lakh, maturity ≈ 71.9 lakh.

**📝 Notes & assumptions** — Annual compounding; **deposits are made for the first 15 years**, then interest keeps compounding until the account **matures 21 years after opening**. Deposit range is **₹250 to ₹1,50,000 per year** (out-of-range amounts and opening after age 10 trigger warnings). Maturity is fully tax-free (EEE).

---

## 🇺🇸 401(k) with Employer Match (`invest.401k`)

**💡 What it is** — Projects your 401(k) balance at retirement, including free employer matching contributions.

**🎯 When to use**
- Projecting workplace retirement savings to retirement age.
- Checking you contribute enough to capture the full employer match.
- Seeing how much of the balance is your money vs employer match vs growth.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Annual salary | Your gross annual salary | Default 80,000 |
| Your contribution | % of salary you contribute | %, default 10 |
| Employer match | % of your contribution the employer matches | %, default 50 |
| Match limit | Employer matches up to this % of salary | %, default 6 |
| Expected return | Assumed annual return | %, default 8 |
| Current age | Your age now | Default 30 |
| Retirement age | Age at retirement | Default 65 |
| Annual raise | Yearly salary increase | Advanced; %, default 3 |

**🧭 How to use**
1. Enter your salary and the % you contribute.
2. Set the employer match rate and the match limit.
3. Set expected return, current age and retirement age.
4. Optionally set an annual raise. Read the balance at retirement.

**📊 Result** — Primary: **Balance at retirement** (with retirement age). Secondary: your contributions, employer match, investment growth. Includes a three-way split (contributions / match / growth) and a year-by-year schedule.

**🔢 Example** — $80,000 salary, 10% contribution, 50% match up to 6%, 8% return, age 30 to 65, 3% raises → balance well over $2 million, with substantial free employer match.

**📝 Notes & assumptions** — Each year: `balance = (balance + your contribution + employer match) × (1 + return)`, and salary grows by the raise. The **matched share of salary is capped at the employer's limit** (e.g. even if you put in 10%, only up to 6% is matched). If you contribute *below* the match limit, the calculator warns you're leaving free money on the table. Assumes a level contribution rate and steady return.

---

## ⚖️ Roth vs Traditional IRA (`invest.iraCompare`)

**💡 What it is** — Compares the after-tax retirement value of a Roth IRA versus a Traditional IRA for the same contribution.

**🎯 When to use**
- Deciding between Roth (after-tax in, tax-free out) and Traditional (pre-tax in, taxed out).
- Testing how today's vs future tax rates tip the decision.
- Seeing the after-tax gap between the two.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Annual contribution | Amount contributed each year | Default 7,000 (2024/2025 cap is $7,000; $8,000 if age 50+) |
| Current age | Your age now | Default 30 |
| Retirement age | Age at retirement | Default 65 |
| Expected return | Assumed annual return | %, default 7 |
| Tax rate today | Your marginal rate now | %, default 24 |
| Tax rate in retirement | Expected rate at withdrawal | %, default 22 |

**🧭 How to use**
1. Enter your annual contribution and current/retirement ages.
2. Set the expected return.
3. Enter your tax rate today and your expected rate in retirement.
4. Read which account wins and by how much.

**📊 Result** — Primary: **Better choice** (Roth IRA / Traditional IRA / Roughly equal) with the after-tax gap. Secondary: Roth after-tax value, Traditional after-tax value (including reinvested tax savings), gross balance either account would reach.

**🔢 Example** — $7,000/year, age 30 to 65, 7% return, 24% tax today vs 22% in retirement → Traditional wins (since today's rate is higher), by roughly $19,000 after tax.

**📝 Notes & assumptions** — `Roth after-tax = FV; Traditional after-tax = FV × (1 − retirement rate) + reinvested tax savings`. **Key assumption:** the annual tax savings from Traditional contributions are also invested and grow at the same return. Under that assumption the account with the **lower tax rate at its taxed moment wins** — Traditional when today's rate is higher than in retirement, Roth when the retirement rate is higher, and roughly a tie when they're equal.

---

## 🎓 529 College Savings (`invest.529`)

**💡 What it is** — Projects a 529 plan balance and, optionally, compares it to the inflation-adjusted future cost of college.

**🎯 When to use**
- Projecting education savings from a starting balance plus monthly contributions.
- Checking whether you're on track for four years of college costs.
- Sizing the surplus or shortfall against tuition inflation.

**🌍 Region** — 🇺🇸

**📥 Inputs**

| Field | What to enter | Notes / default |
|---|---|---|
| Current savings | Balance already saved | Default 5,000 |
| Monthly contribution | Amount added each month | Default 300 |
| Expected return | Assumed annual return | %, default 6 |
| Years until college | Years until funds are needed | Default 18 |
| Today's annual college cost | Current one-year cost | Optional — enables the cost comparison |
| College cost inflation | Annual tuition inflation | Advanced; %, default 5 |

**🧭 How to use**
1. Enter current savings and your monthly contribution.
2. Set the expected return and years until college.
3. Optionally enter today's annual college cost to compare against your projection.
4. Read the projected savings and any surplus or shortfall.

**📊 Result** — Primary: **Projected savings** (in N years). Secondary: total invested, investment growth, and — if a college cost is entered — the inflation-adjusted **4-year college cost** plus a **projected surplus** or **funding shortfall**. Includes an invested/growth split.

**🔢 Example** — $5,000 saved, $300/month, 6% return, 18 years → projected ≈ $130,900, invested $69,800, growth ≈ $61,100.

**📝 Notes & assumptions** — `FV = currentSavings × (1+r)^n + monthly × ((1+r)^n − 1) / r` with `r` monthly and `n` in months. When a college cost is provided, it assumes **four consecutive years** of college starting when the savings mature, each year inflated at the college-cost inflation rate. A positive gap is a surplus; a negative gap is a shortfall.
