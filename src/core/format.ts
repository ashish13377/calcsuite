import { Decimal, D, type DecimalT, type Numeric } from './decimal';
import type { Settings, RoundingMode } from '../settings/settings';

// Display formatting, settings-driven. Decimal stays the source of truth; Intl is used
// only to render (§11.8). Indian (12,34,567) vs Western (1,234,567) grouping, currency
// symbol placement, abbreviation (lakh/crore vs K/M/B), all from Settings.

const ROUND: Record<RoundingMode, number> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  HALF_DOWN: Decimal.ROUND_HALF_DOWN,
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
  CEIL: Decimal.ROUND_CEIL,
  FLOOR: Decimal.ROUND_FLOOR,
};

export interface Formatter {
  settings: Settings;
  money(v: Numeric, places?: number): string;
  moneyParts(v: Numeric, places?: number): { symbol: string; digits: string };
  num(v: Numeric, places?: number): string;
  pct(v: Numeric, places?: number): string;
  compact(v: Numeric): string;
  round(v: Numeric, places?: number): DecimalT;
}

function groupLocale(s: Settings): string {
  switch (s.numberFormat.grouping) {
    case 'indian':
      return 'en-IN';
    case 'european':
      return 'de-DE';
    case 'swiss':
      return 'de-CH';
    case 'western':
      return 'en-US';
    default:
      return 'en-US';
  }
}

export function makeFormatter(s: Settings): Formatter {
  const rmode = ROUND[s.rounding.mode] as any;
  const round = (v: Numeric, places = s.numberFormat.decimalPlaces) => D(v).toDecimalPlaces(places, rmode);

  const groupNumber = (abs: number, places: number): string => {
    if (s.numberFormat.grouping === 'plain') return abs.toFixed(places);
    let out = new Intl.NumberFormat(groupLocale(s), {
      minimumFractionDigits: s.numberFormat.trimTrailingZeros ? 0 : places,
      maximumFractionDigits: places,
    }).format(abs);
    return out;
  };

  const wrapNeg = (neg: boolean, body: string): string =>
    neg ? (s.numberFormat.negativeFormat === 'parentheses' ? `(${body})` : `-${body}`) : body;

  const symbolize = (body: string): string => {
    const { symbol, symbolPosition, spaceAfterSymbol } = s.currency;
    const sp = spaceAfterSymbol ? ' ' : '';
    return symbolPosition === 'prefix' ? `${symbol}${sp}${body}` : `${body}${sp}${symbol}`;
  };

  const compact = (v: Numeric): string => {
    const d = round(v, s.numberFormat.decimalPlaces);
    const abs = d.abs();
    const neg = d.isNegative();
    const n = abs.toNumber();
    let body: string;
    if (s.numberFormat.abbreviationScale === 'indian') {
      if (n >= 1e7) body = `${(n / 1e7).toFixed(2)} Cr`;
      else if (n >= 1e5) body = `${(n / 1e5).toFixed(2)} L`;
      else if (n >= 1e3) body = `${(n / 1e3).toFixed(2)} K`;
      else body = n.toFixed(0);
    } else {
      if (n >= 1e9) body = `${(n / 1e9).toFixed(2)}B`;
      else if (n >= 1e6) body = `${(n / 1e6).toFixed(2)}M`;
      else if (n >= 1e3) body = `${(n / 1e3).toFixed(1)}K`;
      else body = n.toFixed(0);
    }
    return wrapNeg(neg, symbolize(body));
  };

  const money = (v: Numeric, places = s.numberFormat.decimalPlaces): string => {
    const d = round(v, places);
    if (s.numberFormat.abbreviate && d.abs().gte(s.numberFormat.abbreviateThreshold)) return compact(v);
    const neg = d.isNegative();
    const body = groupNumber(Math.abs(Number(d.toFixed(places))), places);
    return wrapNeg(neg, symbolize(body));
  };

  const moneyParts = (v: Numeric, places = s.numberFormat.decimalPlaces): { symbol: string; digits: string } => {
    const d = round(v, places);
    const neg = d.isNegative();
    const digits = wrapNeg(neg, groupNumber(Math.abs(Number(d.toFixed(places))), places));
    return { symbol: s.currency.symbol, digits };
  };

  const num = (v: Numeric, places = s.numberFormat.decimalPlaces): string => {
    const d = round(v, places);
    const neg = d.isNegative();
    return wrapNeg(neg, groupNumber(Math.abs(Number(d.toFixed(places))), places));
  };

  const pct = (v: Numeric, places = s.numberFormat.percentPlaces): string => `${num(v, places)}%`;

  return { settings: s, money, moneyParts, num, pct, compact, round };
}

export function tenureText(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} yr`);
  if (m) parts.push(`${m} mo`);
  return parts.join(' ') || '0 mo';
}
