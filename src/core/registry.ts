import type { CalculatorDef, Group } from './kit';
import { loanCalculators } from './calculators/loans';
import { investmentCalculators } from './calculators/investments';
import { depositCalculators } from './calculators/deposits';
import { usRetirementCalculators } from './calculators/retirement_us';
import { returnsCalculators } from './calculators/returns';
import { taxCalculators } from './calculators/tax';
import { utilityCalculators } from './calculators/utility';
import { sciCalculators } from './calculators/scientific';
import type { Region } from '../settings/settings';

// loan.emi is a bespoke panel (solve-for-any + full amortisation table).
const loanEmi: CalculatorDef = {
  id: 'loan.emi',
  group: 'loans',
  title: 'EMI / Loan',
  blurb: 'Solve for payment, amount, rate, or term — with a full amortisation schedule.',
  keywords: ['emi', 'loan', 'mortgage', 'amortisation', 'home loan', 'car loan', 'monthly payment'],
  inputs: [],
  compute: () => ({ primary: { label: '', value: '' } }),
  custom: 'loan.emi',
};

// Offline currency converter is a bespoke panel (rate book, swap, staleness).
const currencyConverter: CalculatorDef = {
  id: 'tools.currency',
  group: 'tools',
  title: 'Currency converter',
  blurb: 'Live exchange rates, with an automatic offline fallback and manual override.',
  keywords: ['currency', 'forex', 'exchange rate', 'convert', 'fx', 'live', 'online', 'usd', 'inr', 'eur'],
  inputs: [],
  compute: () => ({ primary: { label: '', value: '' } }),
  custom: 'currency',
};

const BUILTIN: CalculatorDef[] = [
  loanEmi,
  currencyConverter,
  ...loanCalculators,
  ...investmentCalculators,
  ...depositCalculators,
  ...usRetirementCalculators,
  ...returnsCalculators,
  ...taxCalculators,
  ...utilityCalculators,
  ...sciCalculators,
];

// ── Plugin API (§12): third parties register calculators that get the whole UI for free.
const plugins: CalculatorDef[] = [];
export function registerCalculator(def: CalculatorDef): void {
  if (!plugins.some((p) => p.id === def.id)) plugins.push(def);
}

export function allCalculators(): CalculatorDef[] {
  return [...BUILTIN, ...plugins];
}

export function calculatorsForRegion(region: Region): CalculatorDef[] {
  return allCalculators().filter((c) => !c.regions || c.regions.includes(region));
}

export function calculatorById(id: string): CalculatorDef | undefined {
  return allCalculators().find((c) => c.id === id);
}

export const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'loans', label: 'Loans' },
  { id: 'invest', label: 'Invest' },
  { id: 'returns', label: 'Returns' },
  { id: 'tax', label: 'Tax' },
  { id: 'tools', label: 'Tools' },
];
