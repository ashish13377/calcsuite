// Full FinCalcSettings (§8), trimmed to what the React build wires end-to-end.
// Region drives defaults; every field is overridable and persisted.

export type Region = 'IN' | 'US';
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'HALF_DOWN' | 'UP' | 'DOWN' | 'CEIL' | 'FLOOR';
export type DayCountConvention = '30/360' | 'ACT/365' | 'ACT/360' | 'ACT/ACT' | '30E/360';
export type Grouping = 'indian' | 'western' | 'european' | 'swiss' | 'plain';

export interface RoundingPolicy {
  money: number;
  rate: number;
  period: number;
  mode: RoundingMode;
  roundEachPeriod: boolean;
  instalment: 'none' | 'ceilToUnit' | 'roundToUnit';
  residualAbsorption: 'first' | 'last' | 'spread';
}

export interface Settings {
  region: Region;
  locale: string;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'prefix' | 'suffix';
    spaceAfterSymbol: boolean;
  };
  numberFormat: {
    grouping: Grouping;
    decimalPlaces: 0 | 1 | 2 | 3 | 4;
    trimTrailingZeros: boolean;
    abbreviate: boolean;
    abbreviationScale: 'indian' | 'western';
    abbreviateThreshold: number;
    negativeFormat: 'minus' | 'parentheses';
    percentPlaces: 0 | 1 | 2 | 3 | 4;
  };
  rounding: RoundingPolicy;
  dayCount: DayCountConvention;
  fiscalYearStart: { month: number; day: number };
  ui: {
    theme: 'light' | 'dark' | 'system' | 'highContrast';
    accent: string;
    fontFamily: string;
    density: 'comfortable' | 'compact';
    radius: 'sharp' | 'soft' | 'round';
    showFormulas: boolean;
    showAssumptions: boolean;
    reducedMotion: 'system' | 'always' | 'never';
  };
  defaults: {
    tenureUnit: 'years' | 'months' | 'both';
    rateType: 'fixed' | 'floating';
    maxRatePercent: number;
    sipReturnPercent: string;
    inflationPercent: string;
  };
  compliance: {
    showDisclaimer: boolean;
    disclaimerText?: string;
  };
  persistence: {
    driver: 'none' | 'localStorage';
    namespace: string;
    historyLimit: number;
  };
  features: {
    integrationPanel: boolean;
    beta: boolean;
  };
}

export const POLICY_DEFAULT: RoundingPolicy = {
  money: 2,
  rate: 6,
  period: 4,
  mode: 'HALF_UP',
  roundEachPeriod: false,
  instalment: 'none',
  residualAbsorption: 'last',
};

const BASE: Omit<Settings, 'region' | 'locale' | 'currency' | 'numberFormat' | 'dayCount' | 'fiscalYearStart' | 'defaults'> = {
  rounding: POLICY_DEFAULT,
  ui: {
    theme: 'system',
    accent: '#078DEE', // Cyan preset
    fontFamily: 'Inter Tight',
    density: 'comfortable',
    radius: 'soft',
    showFormulas: false,
    showAssumptions: true,
    reducedMotion: 'system',
  },
  compliance: { showDisclaimer: true },
  persistence: { driver: 'localStorage', namespace: 'calcsuite', historyLimit: 100 },
  features: { integrationPanel: false, beta: false },
};

export function regionDefaults(region: Region): Settings {
  if (region === 'US') {
    return {
      ...BASE,
      region: 'US',
      locale: 'en-US',
      currency: { code: 'USD', symbol: '$', symbolPosition: 'prefix', spaceAfterSymbol: false },
      numberFormat: {
        grouping: 'western',
        decimalPlaces: 2,
        trimTrailingZeros: false,
        abbreviate: false,
        abbreviationScale: 'western',
        abbreviateThreshold: 100000,
        negativeFormat: 'minus',
        percentPlaces: 2,
      },
      dayCount: 'ACT/365',
      fiscalYearStart: { month: 1, day: 1 },
      defaults: { tenureUnit: 'years', rateType: 'fixed', maxRatePercent: 50, sipReturnPercent: '8', inflationPercent: '3' },
    };
  }
  return {
    ...BASE,
    region: 'IN',
    locale: 'en-IN',
    currency: { code: 'INR', symbol: '₹', symbolPosition: 'prefix', spaceAfterSymbol: false },
    numberFormat: {
      grouping: 'indian',
      decimalPlaces: 2,
      trimTrailingZeros: false,
      abbreviate: false,
      abbreviationScale: 'indian',
      abbreviateThreshold: 100000,
      negativeFormat: 'minus',
      percentPlaces: 2,
    },
    dayCount: '30/360',
    fiscalYearStart: { month: 4, day: 1 },
    defaults: { tenureUnit: 'both', rateType: 'floating', maxRatePercent: 50, sipReturnPercent: '12', inflationPercent: '6' },
  };
}

export const DEFAULT_SETTINGS = regionDefaults('IN');
