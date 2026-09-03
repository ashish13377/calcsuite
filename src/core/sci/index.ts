// Public API for the scientific expression engine (§7).
// `evalExpression` is the one-call entry reused by money input fields in
// expression mode: type "1200*1.18" into an amount and it resolves.
import { Decimal, type DecimalT } from '../decimal';
import { tokenize, type Base } from './tokenizer';
import { parse } from './parser';
import { evaluate, type AngleMode, type PercentMode } from './evaluator';

export { tokenize } from './tokenizer';
export { parse } from './parser';
export { evaluate } from './evaluator';
export type { Node } from './parser';
export type { Token, Base } from './tokenizer';
export type { AngleMode, PercentMode, EvalOpts } from './evaluator';

export interface EvalExprOpts {
  angleMode?: AngleMode;
  percentMode?: PercentMode;
  ans?: DecimalT | string | number;
  memory?: DecimalT | string | number;
  vars?: Record<string, DecimalT | string | number>;
  base?: Base;
}

export interface EvalResult {
  value: DecimalT;
  error?: string;
}

export function evalExpression(input: string, opts: EvalExprOpts = {}): EvalResult {
  if (input == null || input.trim() === '') return { value: new Decimal(0) };
  try {
    const tokens = tokenize(input, { base: opts.base });
    const ast = parse(tokens);
    const value = evaluate(ast, opts);
    if (value.isNaN()) return { value, error: 'Not a number' };
    return { value };
  } catch (e) {
    return { value: new Decimal(NaN), error: e instanceof Error ? e.message : String(e) };
  }
}
