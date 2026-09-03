// Utility calculators (§6.5): offline currency converter, unit converter,
// date calculator, and number-to-words. These are "tools" — mostly non-money,
// so primary.value is a plain string built here (not forced through the
// settings currency symbol). Money-ish math still goes through Decimal (ctx.D).
import type { CalculatorDef, ResultView, Metric } from '../kit';
import { numval, strval, boolval, metric } from '../kit';

// The currency converter is a dedicated OFFLINE panel — src/ui/CurrencyConverter.tsx,
// registered as a custom calculator in registry.ts (custom:'currency').

// ─────────────────────────────── 2. Units ───────────────────────────────
// Ratio of each unit to the category's base unit; result = value·ratio[from]/ratio[to].
const UNIT_TABLES: Record<string, Record<string, number>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  area: { sqm: 1, sqft: 0.092903, sqyd: 0.836127, acre: 4046.8564224, hectare: 10000, bigha: 1337.8, gunta: 101.17, cent: 40.4686 },
  weight: { kg: 1, g: 0.001, mg: 1e-6, lb: 0.45359237, oz: 0.0283495, tonne: 1000, quintal: 100 },
  volume: { l: 1, ml: 0.001, m3: 1000, gal_us: 3.785411784, gal_uk: 4.54609, cup: 0.24, pint: 0.473176 },
};
const UNIT_LABELS: Record<string, string> = {
  m: 'Meters (m)', km: 'Kilometers (km)', cm: 'Centimeters (cm)', mm: 'Millimeters (mm)', mi: 'Miles (mi)', yd: 'Yards (yd)', ft: 'Feet (ft)', in: 'Inches (in)',
  sqm: 'Square meters', sqft: 'Square feet', sqyd: 'Square yards', acre: 'Acre', hectare: 'Hectare', bigha: 'Bigha', gunta: 'Gunta', cent: 'Cent',
  kg: 'Kilogram (kg)', g: 'Gram (g)', mg: 'Milligram (mg)', lb: 'Pound (lb)', oz: 'Ounce (oz)', tonne: 'Tonne', quintal: 'Quintal',
  l: 'Liter (l)', ml: 'Milliliter (ml)', m3: 'Cubic meter (m³)', gal_us: 'Gallon (US)', gal_uk: 'Gallon (UK)', cup: 'Cup', pint: 'Pint',
  C: 'Celsius (°C)', F: 'Fahrenheit (°F)', K: 'Kelvin (K)',
};
const TEMP_UNITS = ['C', 'F', 'K'];
const opts = (keys: string[]) => keys.map((k) => ({ value: k, label: UNIT_LABELS[k] ?? k }));

// from/to selects are per-category (options are static per field), gated by showIf.
const unitSelects = (cat: keyof typeof UNIT_TABLES | 'temperature', keys: string[], defFrom: string, defTo: string) => [
  { key: `${cat}From`, label: 'From', kind: 'select' as const, default: defFrom, options: opts(keys), showIf: (v: any) => v.category === cat },
  { key: `${cat}To`, label: 'To', kind: 'select' as const, default: defTo, options: opts(keys), showIf: (v: any) => v.category === cat },
];

const units: CalculatorDef = {
  id: 'tools.units',
  group: 'tools',
  title: 'Unit Converter',
  blurb: 'Convert length, area, weight, volume and temperature — including Indian land units (bigha, gunta, cent).',
  keywords: ['unit', 'convert', 'length', 'area', 'weight', 'volume', 'temperature', 'bigha', 'acre'],
  inputs: [
    { key: 'value', label: 'Value', kind: 'number', default: '1' },
    {
      key: 'category', label: 'Category', kind: 'select', default: 'length',
      options: [
        { value: 'length', label: 'Length' },
        { value: 'area', label: 'Area' },
        { value: 'weight', label: 'Weight' },
        { value: 'volume', label: 'Volume' },
        { value: 'temperature', label: 'Temperature' },
      ],
    },
    ...unitSelects('length', Object.keys(UNIT_TABLES.length), 'm', 'ft'),
    ...unitSelects('area', Object.keys(UNIT_TABLES.area), 'acre', 'sqm'),
    ...unitSelects('weight', Object.keys(UNIT_TABLES.weight), 'kg', 'lb'),
    ...unitSelects('volume', Object.keys(UNIT_TABLES.volume), 'l', 'gal_us'),
    ...unitSelects('temperature', TEMP_UNITS, 'C', 'F'),
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const value = D(numval(values.value, 0));
    const category = strval(values.category, 'length');
    const from = strval(values[`${category}From`], '');
    const to = strval(values[`${category}To`], '');
    const notes: string[] = [];

    let result;
    if (category === 'temperature') {
      // via Celsius
      const toC = from === 'C' ? value : from === 'F' ? value.minus(32).times(5).div(9) : value.minus(273.15);
      result = to === 'C' ? toC : to === 'F' ? toC.times(9).div(5).plus(32) : toC.plus(273.15);
    } else {
      const table = UNIT_TABLES[category];
      result = value.times(table[from] ?? 1).div(table[to] ?? 1);
      if (from === 'bigha' || to === 'bigha') notes.push('Bigha is not standardised — its size varies by state; this uses a common ~1337.8 m² value.');
    }

    const fromLbl = UNIT_LABELS[from] ?? from;
    const toLbl = UNIT_LABELS[to] ?? to;
    return {
      primary: metric(`${value.toString()} ${fromLbl} =`, `${fmt.num(result, 4)} ${toLbl}`, 'accent'),
      notes,
      raw: { result: result.toFixed(6), from, to, category },
    };
  },
};

// ─────────────────────────────── 3. Date calculator ───────────────────────────────
const MS_DAY = 86400000;
const parseUTC = (s: string): Date => {
  if (!s) { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const daysInMonth1 = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
const iso = (d: Date) => d.toISOString().slice(0, 10);

const dateCalc: CalculatorDef = {
  id: 'tools.dateCalc',
  group: 'tools',
  title: 'Date Calculator',
  blurb: 'Find the duration between two dates, or add/subtract days, weeks, months or years from a date.',
  keywords: ['date', 'days between', 'duration', 'add days', 'business days', 'workdays'],
  inputs: [
    {
      key: 'mode', label: 'Mode', kind: 'segmented', default: 'difference',
      options: [
        { value: 'difference', label: 'Difference' },
        { value: 'addSubtract', label: 'Add / subtract' },
      ],
    },
    { key: 'startDate', label: 'Start date', kind: 'date' },
    { key: 'endDate', label: 'End date', kind: 'date', showIf: (v) => v.mode !== 'addSubtract' },
    { key: 'count', label: 'Amount', kind: 'int', default: 30, showIf: (v) => v.mode === 'addSubtract' },
    {
      key: 'unit', label: 'Unit', kind: 'select', default: 'days', showIf: (v) => v.mode === 'addSubtract',
      options: [
        { value: 'days', label: 'Days' },
        { value: 'weeks', label: 'Weeks' },
        { value: 'months', label: 'Months' },
        { value: 'years', label: 'Years' },
      ],
    },
    {
      key: 'direction', label: 'Direction', kind: 'segmented', default: 'add', showIf: (v) => v.mode === 'addSubtract',
      options: [
        { value: 'add', label: 'Add' },
        { value: 'subtract', label: 'Subtract' },
      ],
    },
  ],
  compute(values): ResultView {
    const mode = strval(values.mode, 'difference');

    if (mode === 'addSubtract') {
      const start = parseUTC(strval(values.startDate, ''));
      const count = Math.round(numval(values.count, 0));
      const unit = strval(values.unit, 'days');
      const sign = strval(values.direction, 'add') === 'subtract' ? -1 : 1;
      const n = sign * count;
      let out: Date;
      if (unit === 'days' || unit === 'weeks') {
        out = new Date(start.getTime() + n * (unit === 'weeks' ? 7 : 1) * MS_DAY);
      } else if (unit === 'months') {
        const total = start.getUTCMonth() + n;
        const y = start.getUTCFullYear() + Math.floor(total / 12);
        const m0 = ((total % 12) + 12) % 12;
        const day = Math.min(start.getUTCDate(), daysInMonth1(y, m0 + 1));
        out = new Date(Date.UTC(y, m0, day));
      } else {
        const y = start.getUTCFullYear() + n;
        const day = Math.min(start.getUTCDate(), daysInMonth1(y, start.getUTCMonth() + 1));
        out = new Date(Date.UTC(y, start.getUTCMonth(), day));
      }
      const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][out.getUTCDay()];
      return {
        primary: metric('Result date', iso(out), 'accent', weekday),
        secondary: [metric('From', iso(start)), metric('Shift', `${sign < 0 ? '−' : '+'}${count} ${unit}`)],
        raw: { resultDate: iso(out), weekday, from: iso(start) },
      };
    }

    // difference
    let start = parseUTC(strval(values.startDate, ''));
    let end = parseUTC(strval(values.endDate, ''));
    let reversed = false;
    if (end.getTime() < start.getTime()) { [start, end] = [end, start]; reversed = true; }

    // calendar y/m/d breakdown with borrow
    let y = end.getUTCFullYear() - start.getUTCFullYear();
    let m = end.getUTCMonth() - start.getUTCMonth();
    let d = end.getUTCDate() - start.getUTCDate();
    if (d < 0) { m -= 1; d += daysInMonth1(end.getUTCFullYear(), end.getUTCMonth()); } // days in month before end
    if (m < 0) { y -= 1; m += 12; }

    const totalDays = Math.round((end.getTime() - start.getTime()) / MS_DAY);
    let business = 0;
    for (let t = start.getTime() + MS_DAY; t <= end.getTime(); t += MS_DAY) {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) business++;
    }

    const parts: string[] = [];
    if (y) parts.push(`${y} year${y > 1 ? 's' : ''}`);
    if (m) parts.push(`${m} month${m > 1 ? 's' : ''}`);
    if (d || !parts.length) parts.push(`${d} day${d !== 1 ? 's' : ''}`);

    return {
      primary: metric('Duration', parts.join(' '), 'accent'),
      secondary: [
        metric('Total days', String(totalDays)),
        metric('Weeks', `${Math.floor(totalDays / 7)} wk ${totalDays % 7} d`),
        metric('Business days', String(business), 'accent', 'excludes Sat & Sun'),
      ],
      notes: reversed ? ['End date was before the start date; the range was reversed.'] : undefined,
      raw: { years: y, months: m, days: d, totalDays, weeks: Number((totalDays / 7).toFixed(2)), businessDays: business },
    };
  },
};

// ─────────────────────────────── 4. Number to words ───────────────────────────────
const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const threeDigits = (n: number): string => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const p: string[] = [];
  if (h) p.push(ONES[h] + ' Hundred');
  if (r) p.push(twoDigits(r));
  return p.join(' ');
};
const westernWords = (n: number): string => {
  if (n === 0) return 'Zero';
  const scale = ['', ' Thousand', ' Million', ' Billion', ' Trillion'];
  const p: string[] = [];
  let i = 0;
  while (n > 0 && i < scale.length) {
    const chunk = n % 1000;
    if (chunk) p.unshift(threeDigits(chunk) + scale[i]);
    n = Math.floor(n / 1000);
    i++;
  }
  return p.length ? p.join(' ') : 'Zero';
};
const indianWords = (n: number): string => {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor(n / 1e5) % 100;
  const thou = Math.floor(n / 1e3) % 100;
  const hun = n % 1000;
  const p: string[] = [];
  if (crore) p.push((crore <= 999 ? threeDigits(crore) : westernWords(crore)) + ' Crore');
  if (lakh) p.push(twoDigits(lakh) + ' Lakh');
  if (thou) p.push(twoDigits(thou) + ' Thousand');
  if (hun) p.push(threeDigits(hun));
  return p.join(' ');
};

const numToWords: CalculatorDef = {
  id: 'tools.numToWords',
  group: 'tools',
  title: 'Number to Words',
  blurb: 'Spell out an amount in words — Indian (lakh/crore) or Western (million/billion), with a cheque format.',
  keywords: ['number to words', 'amount in words', 'spell', 'cheque', 'rupees', 'lakh', 'crore'],
  inputs: [
    { key: 'amount', label: 'Amount', kind: 'number', default: '1234567' },
    {
      key: 'scale', label: 'Scale', kind: 'segmented', default: 'indian',
      options: [
        { value: 'indian', label: 'Indian (lakh/crore)' },
        { value: 'western', label: 'Western (million)' },
      ],
    },
    { key: 'cheque', label: 'Cheque format', kind: 'toggle', default: false, help: 'Prefix the currency name and suffix "Only".' },
  ],
  compute(values, ctx): ResultView {
    const { D, fmt } = ctx;
    const scale = strval(values.scale, 'indian');
    const cheque = boolval(values.cheque, false);
    const amount = D(strval(values.amount, '0').replace(/[, ]/g, '') || '0');
    const neg = amount.isNegative();
    const abs = amount.abs();
    const intPart = abs.floor();
    const frac = Number(abs.minus(intPart).times(100).toDecimalPlaces(0).toString());
    const intNum = Number(intPart.toString());

    const code = ctx.settings.currency.code;
    const currencyName = code === 'INR' ? 'Rupees' : code === 'USD' ? 'Dollars' : code;
    const subunit = code === 'INR' ? 'Paise' : 'Cents';

    let words = scale === 'western' ? westernWords(intNum) : indianWords(intNum);
    if (frac > 0) words += ` and ${twoDigits(frac)} ${subunit}`;
    if (cheque) words = `${currencyName} ${words} Only`;
    if (neg) words = `Minus ${words}`;

    return {
      primary: metric('In words', words, 'accent'),
      secondary: [metric('In figures', fmt.num(amount, frac > 0 ? 2 : 0))],
      notes: ['Words are Title Case with the chosen number scale; the cheque format adds the currency name and "Only".'],
      raw: { words, integer: intNum, fraction: frac },
    };
  },
};

export const utilityCalculators: CalculatorDef[] = [units, dateCalc, numToWords];
