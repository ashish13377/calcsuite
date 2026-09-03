// ─────────────────────────────────────────────────────────────────────────
// Tax calculators (§6.4). India: GST, TDS, income tax (old vs new), capital
// gains, HRA exemption, advance-tax instalments. US: sales tax, federal income
// tax (2024), mortgage-interest deduction. Money math in Decimal only; every
// displayed number goes through ctx.fmt. Tax figures are estimates — see notes.
// ─────────────────────────────────────────────────────────────────────────
import type { CalculatorDef, ResultView, ScheduleRow, Metric } from '../kit';
import { numval, strval, boolval, dmoney, metric } from '../kit';
import { D, type DecimalT, type Numeric } from '../decimal';
import type { Formatter } from '../format';

const ESTIMATE = 'Estimate for planning only — not tax advice. Verify against current law and your own situation.';

// A progressive slab: tax income between the previous band's top and `to` at `rate` %.
interface Band {
  to: number; // upper bound; use Infinity for the top band
  rate: number; // percent
}

/** Progressive slab tax on `taxable` plus a slab-wise schedule breakdown. */
function slab(taxable: DecimalT, bands: Band[], fmt: Formatter): { tax: DecimalT; rows: ScheduleRow[] } {
  let tax = D(0);
  let prev = 0;
  const rows: ScheduleRow[] = [];
  for (const b of bands) {
    if (!taxable.gt(prev)) break;
    const top = Number.isFinite(b.to) ? D(b.to) : taxable;
    const upper = taxable.lt(top) ? taxable : top;
    const amt = upper.minus(prev);
    if (amt.gt(0)) {
      const t = amt.times(b.rate).div(100);
      tax = tax.plus(t);
      const range = `${fmt.money(prev)} – ${Number.isFinite(b.to) ? fmt.money(b.to) : 'above'}`;
      rows.push({ label: range, cells: [fmt.money(amt), `${b.rate}%`, fmt.money(t)] });
    }
    prev = Number.isFinite(b.to) ? b.to : prev;
  }
  return { tax, rows };
}

const slabTax = (taxable: DecimalT, bands: Band[]): DecimalT => slab(taxable, bands, DUMMY_FMT).tax;
// Formatter only used for row labels; slabTax ignores rows so a throwaway is fine.
const DUMMY_FMT = { money: (v: Numeric) => String(v) } as unknown as Formatter;

const clampMax = (v: DecimalT, max: number): DecimalT => (v.gt(max) ? D(max) : v);
const posMetric = (label: string, value: string): Metric => metric(label, value, 'positive');

// ═══════════════════════════════ 1. GST (IN) ═══════════════════════════════
const gst: CalculatorDef = {
  id: 'tax.gst',
  group: 'tax',
  title: 'GST Calculator',
  blurb: 'Add or remove GST, split into CGST/SGST or IGST, with optional cess and reverse charge.',
  keywords: ['gst', 'cgst', 'sgst', 'igst', 'cess', 'tax', 'invoice', 'inclusive', 'exclusive'],
  regions: ['IN'],
  inputs: [
    { key: 'amount', label: 'Amount', kind: 'money', prefix: 'currency', default: '1000' },
    {
      key: 'gstRatePct',
      label: 'GST rate',
      kind: 'select',
      default: '18',
      options: [
        { value: '0', label: '0%' },
        { value: '5', label: '5%' },
        { value: '12', label: '12%' },
        { value: '18', label: '18%' },
        { value: '28', label: '28%' },
      ],
    },
    {
      key: 'mode',
      label: 'Amount is',
      kind: 'segmented',
      default: 'add',
      options: [
        { value: 'add', label: 'Exclusive (add GST)' },
        { value: 'remove', label: 'Inclusive (remove GST)' },
      ],
    },
    {
      key: 'split',
      label: 'Supply type',
      kind: 'segmented',
      default: 'intra',
      options: [
        { value: 'intra', label: 'Intra-state (CGST+SGST)' },
        { value: 'inter', label: 'Inter-state (IGST)' },
      ],
    },
    { key: 'cessPct', label: 'Cess', kind: 'percent', suffix: '%', default: '0', optional: true, advanced: true },
    { key: 'reverseCharge', label: 'Reverse charge (RCM)', kind: 'toggle', default: false, advanced: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const amount = dmoney(values.amount, '1000');
    const rate = D(numval(values.gstRatePct, 18)).div(100);
    const cessRate = D(numval(values.cessPct, 0)).div(100);
    const isRemove = strval(values.mode, 'add') === 'remove';
    const isInter = strval(values.split, 'intra') === 'inter';

    const base = isRemove ? amount.div(rate.plus(1)) : amount;
    const gstAmt = isRemove ? amount.minus(base) : amount.times(rate);
    const cessAmt = base.times(cessRate);
    const total = base.plus(gstAmt).plus(cessAmt);

    const cgst = isInter ? D(0) : gstAmt.div(2);
    const igst = isInter ? gstAmt : D(0);

    const split: ResultView['split'] = isInter
      ? [
          { label: 'Base', value: Number(base.toFixed(2)), tone: 'principal' },
          { label: 'IGST', value: Number(igst.toFixed(2)), tone: 'interest' },
        ]
      : [
          { label: 'Base', value: Number(base.toFixed(2)), tone: 'principal' },
          { label: 'CGST', value: Number(cgst.toFixed(2)), tone: 'interest' },
          { label: 'SGST', value: Number(cgst.toFixed(2)), tone: 'accent' },
        ];
    if (cessAmt.gt(0)) split.push({ label: 'Cess', value: Number(cessAmt.toFixed(2)), tone: 'accent' });

    const secondary: Metric[] = [
      metric(isRemove ? 'Total (inclusive)' : 'Total payable', fmt.money(total), 'principal'),
      metric('Total GST', fmt.money(gstAmt), 'interest'),
    ];
    if (isInter) secondary.push(metric('IGST', fmt.money(igst), 'interest'));
    else {
      secondary.push(metric('CGST', fmt.money(cgst), 'interest'));
      secondary.push(metric('SGST', fmt.money(cgst), 'accent'));
    }
    if (cessAmt.gt(0)) secondary.push(metric('Cess', fmt.money(cessAmt), 'accent'));

    const notes = [
      isRemove ? 'GST is backed out of a tax-inclusive amount: base = amount ÷ (1 + rate).' : 'GST is added on top of the base amount.',
      isInter ? 'Inter-state supply: a single IGST applies.' : 'Intra-state supply: GST splits equally into CGST and SGST.',
    ];
    if (boolval(values.reverseCharge, false))
      notes.push('Reverse charge (RCM): the recipient pays this GST directly to the government instead of the supplier.');

    return {
      primary: metric(isRemove ? 'Base (pre-GST)' : 'Total payable', fmt.money(isRemove ? base : total), 'accent'),
      secondary,
      split,
      formula: isRemove ? 'base = amount / (1 + rate);  GST = amount − base' : 'GST = amount × rate;  total = amount + GST + cess',
      notes,
      raw: {
        base: base.toFixed(2),
        gst: gstAmt.toFixed(2),
        cgst: cgst.toFixed(2),
        sgst: cgst.toFixed(2),
        igst: igst.toFixed(2),
        cess: cessAmt.toFixed(2),
        total: total.toFixed(2),
      },
    };
  },
};

// ═══════════════════════════════ 2. TDS on interest (IN) ═══════════════════
const tds: CalculatorDef = {
  id: 'tax.tds',
  group: 'tax',
  title: 'TDS on Interest',
  blurb: 'Tax deducted at source on bank/other interest income, with the 15G/15H waiver and no-PAN rate.',
  keywords: ['tds', 'interest', '15g', '15h', 'section 194a', 'pan', 'bank'],
  regions: ['IN'],
  inputs: [
    { key: 'annualInterest', label: 'Annual interest income', kind: 'money', prefix: 'currency', default: '60000' },
    {
      key: 'payerType',
      label: 'Interest from',
      kind: 'segmented',
      default: 'bank',
      options: [
        { value: 'bank', label: 'Bank / post office' },
        { value: 'other', label: 'Other (company, etc.)' },
      ],
    },
    { key: 'senior', label: 'Senior citizen (60+)', kind: 'toggle', default: false },
    { key: 'form15gh', label: 'Form 15G/15H submitted', kind: 'toggle', default: false },
    { key: 'panAvailable', label: 'PAN provided', kind: 'toggle', default: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const interest = dmoney(values.annualInterest, '60000');
    const isBank = strval(values.payerType, 'bank') === 'bank';
    const senior = boolval(values.senior, false);
    const form = boolval(values.form15gh, false);
    const hasPan = boolval(values.panAvailable, true);

    const threshold = isBank ? (senior ? 50000 : 40000) : 5000;
    const rate = hasPan ? D('0.10') : D('0.20');
    const belowThreshold = !interest.gt(threshold);
    const waived = belowThreshold || form;
    const tdsAmt = waived ? D(0) : interest.times(rate);
    const net = interest.minus(tdsAmt);
    const effective = interest.gt(0) ? tdsAmt.div(interest).times(100) : D(0);

    const notes = [
      `TDS threshold for this source is ${fmt.money(threshold)} per year${isBank ? ' (₹50,000 for senior citizens)' : ''}.`,
      hasPan ? 'Rate is 10% (Section 194A).' : 'No PAN on record: TDS is deducted at the higher 20% rate.',
      ESTIMATE,
    ];
    if (waived)
      notes.unshift(
        belowThreshold
          ? 'Interest is at or below the threshold, so no TDS is deducted.'
          : 'Form 15G/15H submitted: TDS is waived (valid only if total income is below the taxable limit).',
      );

    return {
      primary: metric('TDS deducted', fmt.money(tdsAmt), tdsAmt.gt(0) ? 'negative' : 'positive'),
      secondary: [
        posMetric('Net interest received', fmt.money(net)),
        metric('Effective TDS rate', fmt.pct(effective), 'accent'),
        metric('Applicable threshold', fmt.money(threshold), 'default'),
      ],
      formula: 'TDS = interest × rate, only if interest > threshold and no 15G/15H',
      notes,
      raw: { tds: tdsAmt.toFixed(2), net: net.toFixed(2), rate: rate.toFixed(2), threshold, effectiveRate: effective.toFixed(4) },
    };
  },
};

// ═══════════════════════════════ 3. Income tax IN: old vs new ══════════════
const OLD_BANDS: Record<string, Band[]> = {
  '<60': [{ to: 250000, rate: 0 }, { to: 500000, rate: 5 }, { to: 1000000, rate: 20 }, { to: Infinity, rate: 30 }],
  '60-80': [{ to: 300000, rate: 0 }, { to: 500000, rate: 5 }, { to: 1000000, rate: 20 }, { to: Infinity, rate: 30 }],
  '80+': [{ to: 500000, rate: 0 }, { to: 1000000, rate: 20 }, { to: Infinity, rate: 30 }],
};
const NEW_BANDS: Band[] = [
  { to: 300000, rate: 0 },
  { to: 700000, rate: 5 },
  { to: 1000000, rate: 10 },
  { to: 1200000, rate: 15 },
  { to: 1500000, rate: 20 },
  { to: Infinity, rate: 30 },
];

// Surcharge on high incomes with marginal relief. `taxOn` = base slab tax at a given income.
function surcharge(taxable: DecimalT, baseTax: DecimalT, taxOn: (amt: number) => DecimalT): DecimalT {
  const steps = [
    { threshold: 50000000, rate: 25, prev: 20 },
    { threshold: 20000000, rate: 20, prev: 15 },
    { threshold: 10000000, rate: 15, prev: 10 },
    { threshold: 5000000, rate: 10, prev: 0 },
  ];
  const step = steps.find((s) => taxable.gt(s.threshold));
  if (!step) return D(0);
  const sur = baseTax.times(step.rate).div(100);
  // Marginal relief: total tax must not exceed (tax+surcharge at threshold) + income above threshold.
  const taxAtT = taxOn(step.threshold);
  const totalAtT = taxAtT.plus(taxAtT.times(step.prev).div(100));
  const excess = taxable.minus(step.threshold);
  const relief = baseTax.plus(sur).minus(totalAtT.plus(excess));
  return relief.gt(0) ? sur.minus(relief) : sur;
}

function regimeTax(taxable: DecimalT, bands: Band[], rebateLimit: number, rebateMax: number, fmt: Formatter) {
  const { tax: base, rows } = slab(taxable, bands, fmt);
  const rebate = !taxable.gt(rebateLimit) ? (base.lt(rebateMax) ? base : D(rebateMax)) : D(0);
  const afterRebate = base.minus(rebate);
  const sur = surcharge(taxable, afterRebate, (amt) => slabTax(D(amt), bands));
  const cess = afterRebate.plus(sur).times('0.04');
  const total = afterRebate.plus(sur).plus(cess);
  return { taxable, base, rebate, surcharge: sur, cess, total, rows };
}

const incomeIN: CalculatorDef = {
  id: 'tax.incomeIN',
  group: 'tax',
  title: 'Income Tax (Old vs New)',
  blurb: 'Compare the old and new tax regimes for FY 2024-25 side by side and see which is cheaper.',
  keywords: ['income tax', 'old regime', 'new regime', '80c', 'slab', 'rebate', '87a', 'surcharge'],
  regions: ['IN'],
  inputs: [
    { key: 'grossIncome', label: 'Gross annual income', kind: 'money', prefix: 'currency', default: '1200000' },
    {
      key: 'age',
      label: 'Age',
      kind: 'segmented',
      default: '<60',
      options: [
        { value: '<60', label: '< 60' },
        { value: '60-80', label: '60–80' },
        { value: '80+', label: '80+' },
      ],
    },
    { key: 'ded80C', label: '80C deductions', kind: 'money', prefix: 'currency', default: '150000', help: 'PF, ELSS, LIC… (max ₹1.5L)', optional: true },
    { key: 'ded80D', label: '80D (health insurance)', kind: 'money', prefix: 'currency', default: '25000', optional: true },
    { key: 'hraExemption', label: 'HRA exemption', kind: 'money', prefix: 'currency', default: '0', optional: true },
    { key: 'homeLoanInterest', label: 'Home loan interest (24b)', kind: 'money', prefix: 'currency', default: '0', help: 'max ₹2L', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const gross = dmoney(values.grossIncome, '1200000');
    const age = strval(values.age, '<60');
    const ded80C = clampMax(dmoney(values.ded80C, '0'), 150000);
    const ded80D = dmoney(values.ded80D, '0');
    const hra = dmoney(values.hraExemption, '0');
    const homeLoan = clampMax(dmoney(values.homeLoanInterest, '0'), 200000);

    // OLD: standard deduction ₹50,000 + chapter VI-A deductions.
    const oldDeductions = D(50000).plus(ded80C).plus(ded80D).plus(hra).plus(homeLoan);
    const oldTaxableRaw = gross.minus(oldDeductions);
    const oldTaxable = oldTaxableRaw.gt(0) ? oldTaxableRaw : D(0);
    const old = regimeTax(oldTaxable, OLD_BANDS[age] ?? OLD_BANDS['<60'], 500000, 12500, fmt);

    // NEW: standard deduction ₹75,000, no other deductions, ≤₹7L rebate.
    const newTaxableRaw = gross.minus(75000);
    const newTaxable = newTaxableRaw.gt(0) ? newTaxableRaw : D(0);
    const nw = regimeTax(newTaxable, NEW_BANDS, 700000, 25000, fmt);

    const newCheaper = !nw.total.gt(old.total);
    const chosen = newCheaper ? nw : old;
    const savings = old.total.minus(nw.total).abs();

    return {
      primary: metric(
        `${newCheaper ? 'New' : 'Old'} regime is cheaper`,
        fmt.money(chosen.total),
        'positive',
        savings.gt(0) ? `saves ${fmt.money(savings)} vs the other regime` : 'both regimes cost the same',
      ),
      secondary: [
        metric('New regime tax', fmt.money(nw.total), newCheaper ? 'positive' : 'default', `taxable ${fmt.money(newTaxable)}`),
        metric('Old regime tax', fmt.money(old.total), newCheaper ? 'default' : 'positive', `taxable ${fmt.money(oldTaxable)}`),
      ],
      schedule: {
        title: `${newCheaper ? 'New' : 'Old'} regime — slab breakdown`,
        columns: ['Income slab', 'In slab', 'Rate', 'Tax'],
        rows: chosen.rows.length ? chosen.rows : [{ label: 'No taxable income', cells: ['—', '—', fmt.money(0)] }],
        toneCols: { 3: 'interest' },
      },
      formula: 'tax = Σ(slab × rate) − 87A rebate + surcharge − marginal relief + 4% cess',
      notes: [
        'FY 2024-25 (AY 2025-26). New regime: ₹75,000 standard deduction, no chapter VI-A; income up to ₹7L taxable is fully rebated (87A).',
        'Old regime: ₹50,000 standard deduction plus 80C/80D/HRA/home-loan; rebate applies up to ₹5L taxable.',
        `Chosen regime tax ${fmt.money(chosen.total)} = base ${fmt.money(chosen.base)}${chosen.rebate.gt(0) ? ` − rebate ${fmt.money(chosen.rebate)}` : ''}${chosen.surcharge.gt(0) ? ` + surcharge ${fmt.money(chosen.surcharge)}` : ''} + cess ${fmt.money(chosen.cess)}.`,
        ESTIMATE,
      ],
      raw: {
        cheaper: newCheaper ? 'new' : 'old',
        tax: chosen.total.toFixed(2),
        newTax: nw.total.toFixed(2),
        oldTax: old.total.toFixed(2),
        newTaxable: newTaxable.toFixed(2),
        oldTaxable: oldTaxable.toFixed(2),
        savings: savings.toFixed(2),
      },
    };
  },
};

// ═══════════════════════════════ 4. Capital gains (IN) ═════════════════════
const capitalGains: CalculatorDef = {
  id: 'tax.capitalGains',
  group: 'tax',
  title: 'Capital Gains Tax',
  blurb: 'Short- and long-term capital gains tax on equity, debt and property (post-July 2024 rates).',
  keywords: ['capital gains', 'ltcg', 'stcg', 'equity', 'debt', 'property', 'shares', 'mutual fund'],
  regions: ['IN'],
  inputs: [
    {
      key: 'assetType',
      label: 'Asset type',
      kind: 'select',
      default: 'equity',
      options: [
        { value: 'equity', label: 'Listed equity / equity MF' },
        { value: 'debt', label: 'Debt fund / bond' },
        { value: 'property', label: 'Property / land' },
      ],
    },
    { key: 'buyPrice', label: 'Purchase price', kind: 'money', prefix: 'currency', default: '100000' },
    { key: 'sellPrice', label: 'Sale price', kind: 'money', prefix: 'currency', default: '250000' },
    { key: 'holdingMonths', label: 'Holding period (months)', kind: 'int', suffix: 'months', default: 24, min: 0 },
    { key: 'improvementCost', label: 'Cost of improvement', kind: 'money', prefix: 'currency', default: '0', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const asset = strval(values.assetType, 'equity');
    const buy = dmoney(values.buyPrice, '100000');
    const sell = dmoney(values.sellPrice, '250000');
    const months = Math.max(0, Math.round(numval(values.holdingMonths, 24)));
    const improvement = dmoney(values.improvementCost, '0');
    const gain = sell.minus(buy).minus(improvement);

    const ltThreshold = asset === 'property' ? 24 : 12; // debt: no LT benefit post-Apr 2023
    const isLong = asset === 'debt' ? false : months > ltThreshold;

    let tax = D(0);
    let type: string;
    let slabTaxed = false;
    const notes: string[] = [];

    if (gain.lte(0)) {
      type = 'Capital loss';
      notes.push('No gain — this is a capital loss, which can be set off/carried forward per the rules.');
    } else if (asset === 'equity') {
      if (isLong) {
        type = 'LTCG (equity)';
        const taxable = gain.minus(125000);
        tax = taxable.gt(0) ? taxable.times('0.125') : D(0);
        notes.push('Listed equity held > 12 months: LTCG at 12.5% on gains above the ₹1.25L annual exemption.');
      } else {
        type = 'STCG (equity)';
        tax = gain.times('0.20');
        notes.push('Listed equity held ≤ 12 months: STCG at 20% (Section 111A, post-23 July 2024).');
      }
    } else if (asset === 'property') {
      if (isLong) {
        type = 'LTCG (property)';
        tax = gain.times('0.125');
        notes.push('Property held > 24 months: LTCG at 12.5% without indexation. Pre-23 July 2024 sales could instead use 20% with indexation.');
      } else {
        type = 'STCG (property)';
        slabTaxed = true;
        notes.push('Property held ≤ 24 months: the gain is added to income and taxed at your slab rate.');
      }
    } else {
      // debt
      type = 'Debt (slab)';
      slabTaxed = true;
      notes.push('Debt funds/bonds bought after 1 April 2023: the entire gain is taxed at your slab rate, regardless of holding period.');
    }
    notes.push('Surcharge and cess (where applicable) are not added here. ' + ESTIMATE);

    const primary = slabTaxed
      ? metric('Tax', 'At your slab rate', 'negative', `on a ${fmt.money(gain)} gain`)
      : metric('Capital gains tax', fmt.money(tax), tax.gt(0) ? 'negative' : 'positive');

    return {
      primary,
      secondary: [
        metric('Capital gain', fmt.money(gain), gain.gt(0) ? 'interest' : 'positive'),
        metric('Gain type', type, 'accent', `held ${months} month(s)`),
      ],
      formula: 'gain = sale − purchase − improvement;  tax per asset type & holding period',
      notes,
      raw: { gain: gain.toFixed(2), tax: slabTaxed ? null : tax.toFixed(2), type, isLong: isLong ? 1 : 0 },
    };
  },
};

// ═══════════════════════════════ 5. HRA exemption (IN) ═════════════════════
const hra: CalculatorDef = {
  id: 'tax.hra',
  group: 'tax',
  title: 'HRA Exemption',
  blurb: 'House Rent Allowance exemption under Section 10(13A) — the least of the three statutory limits.',
  keywords: ['hra', 'house rent allowance', '10(13a)', 'rent', 'exemption', 'salary'],
  regions: ['IN'],
  inputs: [
    { key: 'basicSalary', label: 'Basic salary (annual)', kind: 'money', prefix: 'currency', default: '600000' },
    { key: 'daReceived', label: 'DA (part of retirement)', kind: 'money', prefix: 'currency', default: '0', optional: true },
    { key: 'hraReceived', label: 'HRA received (annual)', kind: 'money', prefix: 'currency', default: '240000' },
    { key: 'rentPaid', label: 'Rent paid (annual)', kind: 'money', prefix: 'currency', default: '300000' },
    { key: 'metro', label: 'Metro city (Delhi/Mumbai/Kolkata/Chennai)', kind: 'toggle', default: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const basic = dmoney(values.basicSalary, '600000');
    const da = dmoney(values.daReceived, '0');
    const hraReceived = dmoney(values.hraReceived, '240000');
    const rent = dmoney(values.rentPaid, '300000');
    const metro = boolval(values.metro, true);
    const salary = basic.plus(da);

    const limitActual = hraReceived;
    const rentExcessRaw = rent.minus(salary.times('0.10'));
    const limitRent = rentExcessRaw.gt(0) ? rentExcessRaw : D(0);
    const limitPct = salary.times(metro ? '0.50' : '0.40');

    let exempt = limitActual;
    if (limitRent.lt(exempt)) exempt = limitRent;
    if (limitPct.lt(exempt)) exempt = limitPct;
    const taxable = hraReceived.minus(exempt);

    return {
      primary: posMetric('HRA exempt', fmt.money(exempt)),
      secondary: [
        metric('Taxable HRA', fmt.money(taxable), 'negative'),
        metric('HRA received', fmt.money(hraReceived), 'principal'),
        metric('Rent − 10% of salary', fmt.money(limitRent), 'default'),
        metric(`${metro ? '50%' : '40%'} of salary`, fmt.money(limitPct), 'default'),
      ],
      formula: 'exempt = min(HRA received, rent − 10% of salary, ' + (metro ? '50%' : '40%') + ' of salary)',
      notes: [
        'Exemption is the least of the three limits under Section 10(13A). Salary = basic + DA (that forms part of retirement benefits).',
        'HRA exemption only applies under the old regime. ' + ESTIMATE,
      ],
      raw: { exempt: exempt.toFixed(2), taxable: taxable.toFixed(2), limitRent: limitRent.toFixed(2), limitPct: limitPct.toFixed(2) },
    };
  },
};

// ═══════════════════════════════ 6. Advance tax (IN) ═══════════════════════
const advanceTax: CalculatorDef = {
  id: 'tax.advanceTax',
  group: 'tax',
  title: 'Advance Tax Instalments',
  blurb: 'The four advance-tax instalments (15% / 45% / 75% / 100%) and their due dates.',
  keywords: ['advance tax', 'instalment', 'due date', '234c', 'self assessment'],
  regions: ['IN'],
  inputs: [
    { key: 'totalTaxLiability', label: 'Total tax liability', kind: 'money', prefix: 'currency', default: '120000' },
    { key: 'tdsAlreadyPaid', label: 'TDS / TCS already paid', kind: 'money', prefix: 'currency', default: '20000', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const liability = dmoney(values.totalTaxLiability, '120000');
    const tdsPaid = dmoney(values.tdsAlreadyPaid, '0');
    const net = liability.minus(tdsPaid);
    const due = net.gt(0) ? net : D(0);

    const stages = [
      { date: '15 Jun', cum: 15 },
      { date: '15 Sep', cum: 45 },
      { date: '15 Dec', cum: 75 },
      { date: '15 Mar', cum: 100 },
    ];
    let prevCum = D(0);
    const rows: ScheduleRow[] = stages.map((s) => {
      const cumAmt = due.times(s.cum).div(100);
      const instal = cumAmt.minus(prevCum);
      prevCum = cumAmt;
      return { label: s.date, cells: [`${s.cum}%`, fmt.money(cumAmt), fmt.money(instal)] };
    });

    const warnings: string[] = [];
    if (due.lt(10000)) warnings.push('Advance tax is only required when net tax liability is ₹10,000 or more for the year.');

    return {
      primary: metric('Advance tax due', fmt.money(due), 'accent', `liability ${fmt.money(liability)} − TDS ${fmt.money(tdsPaid)}`),
      secondary: [metric('Total tax liability', fmt.money(liability), 'principal'), metric('Already paid (TDS/TCS)', fmt.money(tdsPaid), 'positive')],
      schedule: {
        title: 'Instalment schedule',
        columns: ['Due date', 'Cumulative %', 'Cumulative amount', 'Instalment'],
        rows,
        toneCols: { 3: 'interest' },
      },
      formula: 'each instalment = cumulative% × (liability − TDS) − amount already due',
      notes: [
        'Due dates: 15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%). Shortfalls attract interest under Section 234C.',
        ESTIMATE,
      ],
      warnings: warnings.length ? warnings : undefined,
      raw: { advanceTaxDue: due.toFixed(2), liability: liability.toFixed(2), tdsPaid: tdsPaid.toFixed(2) },
    };
  },
};

// ═══════════════════════════════ 7. Sales tax (US) ═════════════════════════
const salesTaxUS: CalculatorDef = {
  id: 'tax.salesTaxUS',
  group: 'tax',
  title: 'Sales Tax',
  blurb: 'US sales tax on a purchase, combining state and optional local rates.',
  keywords: ['sales tax', 'state tax', 'local tax', 'purchase', 'us'],
  regions: ['US'],
  inputs: [
    { key: 'amount', label: 'Purchase amount', kind: 'money', prefix: 'currency', default: '100' },
    { key: 'stateRatePct', label: 'State tax rate', kind: 'percent', suffix: '%', default: '6' },
    { key: 'localRatePct', label: 'Local / city tax rate', kind: 'percent', suffix: '%', default: '2', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const amount = dmoney(values.amount, '100');
    const stateRate = D(numval(values.stateRatePct, 6));
    const localRate = D(numval(values.localRatePct, 0));
    const combined = stateRate.plus(localRate);
    const taxAmt = amount.times(combined).div(100);
    const total = amount.plus(taxAmt);

    return {
      primary: metric('Total with tax', fmt.money(total), 'accent'),
      secondary: [
        metric('Sales tax', fmt.money(taxAmt), 'interest'),
        metric('Combined rate', fmt.pct(combined), 'default'),
        metric('Pre-tax amount', fmt.money(amount), 'principal'),
      ],
      split: [
        { label: 'Amount', value: Number(amount.toFixed(2)), tone: 'principal' },
        { label: 'Tax', value: Number(taxAmt.toFixed(2)), tone: 'interest' },
      ],
      formula: 'tax = amount × (state rate + local rate)',
      notes: ['Combined state + local rate applied to the purchase amount. ' + ESTIMATE],
      raw: { tax: taxAmt.toFixed(2), total: total.toFixed(2), combinedRate: combined.toFixed(4) },
    };
  },
};

// ═══════════════════════════════ 8. Federal income tax (US, 2024) ══════════
const US_BANDS_2024: Record<string, Band[]> = {
  single: [
    { to: 11600, rate: 10 },
    { to: 47150, rate: 12 },
    { to: 100525, rate: 22 },
    { to: 191950, rate: 24 },
    { to: 243725, rate: 32 },
    { to: 609350, rate: 35 },
    { to: Infinity, rate: 37 },
  ],
  marriedJoint: [
    { to: 23200, rate: 10 },
    { to: 94300, rate: 12 },
    { to: 201050, rate: 22 },
    { to: 383900, rate: 24 },
    { to: 487450, rate: 32 },
    { to: 731200, rate: 35 },
    { to: Infinity, rate: 37 },
  ],
  headOfHousehold: [
    { to: 16550, rate: 10 },
    { to: 63100, rate: 12 },
    { to: 100500, rate: 22 },
    { to: 191950, rate: 24 },
    { to: 243700, rate: 32 },
    { to: 609350, rate: 35 },
    { to: Infinity, rate: 37 },
  ],
};
const US_STD_DED_2024: Record<string, number> = { single: 14600, marriedJoint: 29200, headOfHousehold: 21900 };

const incomeUS: CalculatorDef = {
  id: 'tax.incomeUS',
  group: 'tax',
  title: 'Federal Income Tax',
  blurb: 'US federal income tax for tax year 2024 by filing status, standard or itemized deduction.',
  keywords: ['income tax', 'federal', 'irs', '2024', 'standard deduction', 'bracket', 'filing status'],
  regions: ['US'],
  inputs: [
    { key: 'grossIncome', label: 'Gross income', kind: 'money', prefix: 'currency', default: '60000' },
    {
      key: 'filingStatus',
      label: 'Filing status',
      kind: 'select',
      default: 'single',
      options: [
        { value: 'single', label: 'Single' },
        { value: 'marriedJoint', label: 'Married filing jointly' },
        { value: 'headOfHousehold', label: 'Head of household' },
      ],
    },
    {
      key: 'deductionMode',
      label: 'Deduction',
      kind: 'segmented',
      default: 'standard',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'itemized', label: 'Itemized' },
      ],
    },
    {
      key: 'itemizedAmount',
      label: 'Itemized deductions',
      kind: 'money',
      prefix: 'currency',
      default: '0',
      showIf: (v) => strval(v.deductionMode, 'standard') === 'itemized',
    },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const gross = dmoney(values.grossIncome, '60000');
    const status = strval(values.filingStatus, 'single');
    const bands = US_BANDS_2024[status] ?? US_BANDS_2024.single;
    const itemized = strval(values.deductionMode, 'standard') === 'itemized';
    const deduction = itemized ? dmoney(values.itemizedAmount, '0') : D(US_STD_DED_2024[status] ?? 14600);

    const taxableRaw = gross.minus(deduction);
    const taxable = taxableRaw.gt(0) ? taxableRaw : D(0);
    const { tax, rows } = slab(taxable, bands, fmt);
    const effective = gross.gt(0) ? tax.div(gross).times(100) : D(0);
    const marginalBand = bands.find((b) => taxable.lte(b.to)) ?? bands[bands.length - 1];
    const marginal = taxable.gt(0) ? marginalBand.rate : 0;
    const afterTax = gross.minus(tax);

    return {
      primary: metric('Federal income tax', fmt.money(tax), 'negative'),
      secondary: [
        metric('Taxable income', fmt.money(taxable), 'principal', `after ${fmt.money(deduction)} deduction`),
        metric('Effective rate', fmt.pct(effective), 'accent'),
        metric('Marginal rate', `${marginal}%`, 'default'),
        posMetric('After-tax income', fmt.money(afterTax)),
      ],
      schedule: {
        title: 'Bracket breakdown',
        columns: ['Bracket', 'In bracket', 'Rate', 'Tax'],
        rows: rows.length ? rows : [{ label: 'No taxable income', cells: ['—', '—', fmt.money(0)] }],
        toneCols: { 3: 'interest' },
      },
      formula: 'taxable = gross − deduction;  tax = Σ(bracket × rate)',
      notes: [
        'Tax year 2024 federal brackets and standard deduction.',
        'Excludes state income tax, FICA (Social Security + Medicare), credits and phase-outs. ' + ESTIMATE,
      ],
      raw: {
        tax: tax.toFixed(2),
        taxable: taxable.toFixed(2),
        deduction: deduction.toFixed(2),
        effectiveRate: effective.toFixed(4),
        marginalRate: marginal,
      },
    };
  },
};

// ═══════════════════════════════ 9. Mortgage interest deduction (US) ═══════
const mortgageDeductionUS: CalculatorDef = {
  id: 'tax.mortgageDeductionUS',
  group: 'tax',
  title: 'Mortgage Interest Deduction',
  blurb: 'Tax savings from deducting home mortgage interest, capped at the $750k acquisition-debt limit.',
  keywords: ['mortgage', 'interest', 'deduction', 'home', 'itemized', 'schedule a', '750k'],
  regions: ['US'],
  inputs: [
    { key: 'annualMortgageInterest', label: 'Annual mortgage interest', kind: 'money', prefix: 'currency', default: '18000' },
    { key: 'marginalTaxRatePct', label: 'Marginal tax rate', kind: 'percent', suffix: '%', default: '24' },
    { key: 'loanBalance', label: 'Loan balance', kind: 'money', prefix: 'currency', default: '0', help: 'interest on debt over $750k is not deductible', optional: true },
  ],
  compute(values, ctx): ResultView {
    const { fmt } = ctx;
    const interest = dmoney(values.annualMortgageInterest, '18000');
    const rate = D(numval(values.marginalTaxRatePct, 24)).div(100);
    const balance = dmoney(values.loanBalance, '0');
    const CAP = 750000;

    // Interest on debt above the $750k cap is not deductible.
    const deductible = balance.gt(CAP) ? interest.times(CAP).div(balance) : interest;
    const savings = deductible.times(rate);

    const notes = [
      'Tax savings assume you itemize and are already above the standard deduction — otherwise only the excess over the standard deduction yields a benefit.',
      'Acquisition-debt limit is $750,000 ($375,000 if married filing separately) for loans after 15 Dec 2017. ' + ESTIMATE,
    ];
    if (balance.gt(CAP)) notes.unshift(`Loan balance exceeds $750k: only ${fmt.pct(D(CAP).div(balance).times(100))} of the interest is deductible.`);

    return {
      primary: posMetric('Estimated tax savings', fmt.money(savings)),
      secondary: [
        metric('Deductible interest', fmt.money(deductible), 'principal'),
        metric('Marginal tax rate', fmt.pct(D(numval(values.marginalTaxRatePct, 24))), 'accent'),
      ],
      formula: 'savings = deductible interest × marginal rate  (interest capped to $750k of debt)',
      notes,
      raw: { savings: savings.toFixed(2), deductibleInterest: deductible.toFixed(2) },
    };
  },
};

export const taxCalculators: CalculatorDef[] = [
  gst,
  tds,
  incomeIN,
  capitalGains,
  hra,
  advanceTax,
  salesTaxUS,
  incomeUS,
  mortgageDeductionUS,
];
