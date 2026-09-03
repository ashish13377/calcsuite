import { D, type DecimalT, type Numeric } from './decimal';

// Offline currency converter core (§6.5). Pure and framework-free so it is unit-testable
// in Node. Conversion is Decimal-exact; formatting uses the platform's Intl currency data
// (correct symbol, decimal digits, and grouping per ISO 4217 — JPY 0dp, KWD 3dp, etc.).

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
}

// Curated ISO 4217 set — the currencies people actually convert between.
export const CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
];

export const currencyByCode = (code: string): CurrencyMeta | undefined =>
  CURRENCIES.find((c) => c.code === code);

const localeFor = (code: string): string => (code === 'INR' ? 'en-IN' : 'en-US');

/** amount × rate, exact. */
export const convert = (amount: Numeric, rate: Numeric): DecimalT => D(amount).times(rate);

/** 1 unit of target buys this many of source. 0 when the rate is not positive. */
export const inverseRate = (rate: Numeric): DecimalT => {
  const r = D(rate);
  return r.gt(0) ? D(1).div(r) : D(0);
};

/** Format a Decimal amount as its currency, using ISO 4217 decimals + symbol. */
export function formatCurrency(amount: Numeric, code: string): string {
  const d = D(amount);
  try {
    return new Intl.NumberFormat(localeFor(code), { style: 'currency', currency: code }).format(
      Number(d.toFixed(4)),
    );
  } catch {
    // Unknown/unsupported ISO code — fall back to plain grouping + code.
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(Number(d.toFixed(4)))} ${code}`;
  }
}

/** How many fraction digits the currency uses (JPY 0, KWD 3, most 2). */
export function currencyDecimals(code: string): number {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Human "how stale" label for an offline saved rate. */
export function stalenessLabel(atMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/** A saved offline rate is "stale" once it is older than a day. */
export const isStale = (atMs: number, nowMs: number): boolean => nowMs - atMs > 86400000;
