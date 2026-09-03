import type { CalculatorDef } from '../kit';

// Registers the scientific calculator as a `custom: 'scientific'` panel (§7).
// compute() is a no-op stub — the bespoke SciCalculator UI owns everything.
export const sciCalculators: CalculatorDef[] = [
  {
    id: 'tools.scientific',
    group: 'tools',
    title: 'Scientific calculator',
    blurb: 'Full expression calculator with trig, logs, memory, and bases.',
    keywords: ['scientific', 'calculator', 'trig', 'log', 'math'],
    inputs: [],
    compute: () => ({ primary: { label: 'Scientific calculator', value: '' } }),
    custom: 'scientific',
  },
];
