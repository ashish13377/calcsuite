// Decimal evaluator over the AST (§7). Arithmetic, powers, factorial and
// combinatorics stay in decimal.js (40-digit). Trig / inverse-trig / hyperbolic
// downcast to Number — see the `ponytail:` note below.
import { Decimal, D, type DecimalT } from '../decimal';
import type { Node } from './parser';
import type { Base } from './tokenizer';

export type AngleMode = 'deg' | 'rad' | 'grad';
export type PercentMode = 'of' | 'modulo';

export interface EvalOpts {
  angleMode?: AngleMode;
  percentMode?: PercentMode;
  ans?: DecimalT | string | number;
  memory?: DecimalT | string | number;
  vars?: Record<string, DecimalT | string | number>;
  base?: Base;
}

// High-precision constants (40 sig digits; more than decimal.js precision).
const PI = new Decimal('3.141592653589793238462643383279502884197');
const E = new Decimal('2.718281828459045235360287471352662497757');
const PHI = new Decimal('1.618033988749894848204586834365638117720');

// ponytail: trig ceiling — decimal.js has no trig, so sin/cos/tan, their
// inverses, and the hyperbolics run through JS doubles (~15-16 sig digits).
// Everything else (+ − × ÷ ^, !, nCr/nPr, gcd/lcm, bitwise) stays full-precision.
function toRad(x: number, mode: AngleMode): number {
  if (mode === 'deg') return (x * Math.PI) / 180;
  if (mode === 'grad') return (x * Math.PI) / 200;
  return x;
}
function fromRad(x: number, mode: AngleMode): number {
  if (mode === 'deg') return (x * 180) / Math.PI;
  if (mode === 'grad') return (x * 200) / Math.PI;
  return x;
}

function factorial(n: DecimalT): DecimalT {
  if (!n.isInteger() || n.isNegative()) throw new Error('factorial needs a non-negative integer');
  if (n.gt(20000)) throw new Error('factorial too large');
  let acc = D(1);
  for (let i = 2; i <= n.toNumber(); i++) acc = acc.times(i);
  return acc;
}

function nPr(n: DecimalT, r: DecimalT): DecimalT {
  if (!n.isInteger() || !r.isInteger() || r.isNegative() || r.gt(n)) throw new Error('nPr domain');
  let acc = D(1);
  for (let i = 0; i < r.toNumber(); i++) acc = acc.times(n.minus(i));
  return acc;
}
function nCr(n: DecimalT, r: DecimalT): DecimalT {
  if (!n.isInteger() || !r.isInteger() || r.isNegative() || r.gt(n)) throw new Error('nCr domain');
  const rr = Decimal.min(r, n.minus(r));
  let acc = D(1);
  for (let i = 1; i <= rr.toNumber(); i++) acc = acc.times(n.minus(rr).plus(i)).div(i);
  return acc.round();
}

function gcd(a: DecimalT, b: DecimalT): DecimalT {
  let x = a.abs().trunc();
  let y = b.abs().trunc();
  while (!y.isZero()) { const t = x.mod(y); x = y; y = t; }
  return x;
}

function nroot(x: DecimalT, n: DecimalT): DecimalT {
  // real n-th root; supports negative x for odd integer n
  if (x.isNegative()) {
    if (n.isInteger() && !n.mod(2).isZero()) return x.abs().pow(D(1).div(n)).neg();
    throw new Error('root of negative');
  }
  return x.pow(D(1).div(n));
}

const asBig = (x: DecimalT): bigint => BigInt(x.trunc().toFixed(0));

export function evaluate(ast: Node, opts: EvalOpts = {}): DecimalT {
  const angleMode = opts.angleMode ?? 'deg';
  const percentMode = opts.percentMode ?? 'of';

  const varLookup = (name: string): DecimalT => {
    if (name === 'ans') return D(opts.ans ?? 0);
    if (name === 'M') return D(opts.memory ?? 0);
    const v = opts.vars?.[name];
    return v == null ? D(0) : D(v);
  };

  const trig = (name: string, x: DecimalT): DecimalT => {
    const v = x.toNumber();
    let r: number;
    switch (name) {
      case 'sin': r = Math.sin(toRad(v, angleMode)); break;
      case 'cos': r = Math.cos(toRad(v, angleMode)); break;
      case 'tan': r = Math.tan(toRad(v, angleMode)); break;
      case 'asin': r = fromRad(Math.asin(v), angleMode); break;
      case 'acos': r = fromRad(Math.acos(v), angleMode); break;
      case 'atan': r = fromRad(Math.atan(v), angleMode); break;
      case 'sinh': r = Math.sinh(v); break;
      case 'cosh': r = Math.cosh(v); break;
      case 'tanh': r = Math.tanh(v); break;
      default: throw new Error(`unknown trig ${name}`);
    }
    if (!Number.isFinite(r)) throw new Error(`${name} out of domain`);
    return D(r);
  };

  const call = (name: string, a: DecimalT[]): DecimalT => {
    const x = a[0];
    const need = (k: number) => { if (a.length < k || a.some((v) => v == null)) throw new Error(`${name} needs ${k} args`); };
    switch (name) {
      case 'sin': case 'cos': case 'tan': case 'asin': case 'acos': case 'atan':
      case 'sinh': case 'cosh': case 'tanh': need(1); return trig(name, x!);
      case 'sqrt': need(1); return x!.sqrt();
      case 'cbrt': need(1); return nroot(x!, D(3));
      case 'qdrt': need(1); return nroot(x!, D(4));
      case 'root': need(2); return nroot(x!, a[1]!);
      case 'pow': need(2); return x!.pow(a[1]!);
      case 'ln': need(1); return x!.ln();
      case 'log': need(1); return a.length > 1 ? x!.log(a[1]!) : x!.log(10);
      case 'logx': need(2); return x!.log(a[1]!);
      case 'log2': need(1); return x!.log(2);
      case 'exp': case 'epow': need(1); return x!.exp();
      case 'tenpow': need(1); return D(10).pow(x!);
      case 'ncr': need(2); return nCr(x!, a[1]!);
      case 'npr': need(2); return nPr(x!, a[1]!);
      case 'gcd': need(2); return gcd(x!, a[1]!);
      case 'lcm': need(2); { const g = gcd(x!, a[1]!); return g.isZero() ? D(0) : x!.times(a[1]!).abs().div(g); }
      case 'mod': need(2); return x!.mod(a[1]!);
      case 'abs': need(1); return x!.abs();
      case 'floor': need(1); return x!.floor();
      case 'ceil': need(1); return x!.ceil();
      case 'round': need(1); return x!.round();
      case 'trunc': need(1); return x!.trunc();
      case 'sign': need(1); return D(x!.isZero() ? 0 : x!.isNegative() ? -1 : 1);
      case 'fact': need(1); return factorial(x!);
      case 'sq': need(1); return x!.pow(2);
      case 'cube': need(1); return x!.pow(3);
      case 'recip': need(1); return D(1).div(x!);
      default: throw new Error(`Unknown function: ${name}`);
    }
  };

  const bin = (op: string, l: DecimalT, r: DecimalT): DecimalT => {
    switch (op) {
      case '+': return l.plus(r);
      case '-': return l.minus(r);
      case '*': return l.times(r);
      case '/': return l.div(r);
      case '^': return l.pow(r);
      case 'mod': return l.mod(r);
      case '<<': return D((asBig(l) << asBig(r)).toString());
      case '>>': return D((asBig(l) >> asBig(r)).toString());
      case 'and': return D((asBig(l) & asBig(r)).toString());
      case 'or': return D((asBig(l) | asBig(r)).toString());
      case 'xor': return D((asBig(l) ^ asBig(r)).toString());
      default: throw new Error(`Unknown operator: ${op}`);
    }
  };

  const ev = (n: Node): DecimalT => {
    switch (n.type) {
      case 'num': return D(n.value);
      case 'const': return n.name === 'PI' ? PI : n.name === 'E' ? E : PHI;
      case 'var': return varLookup(n.name);
      case 'percent': return ev(n.operand).div(100);
      case 'unary': {
        if (n.op === 'neg') return ev(n.operand).neg();
        if (n.op === 'bnot') return D((~asBig(ev(n.operand))).toString());
        return call(n.op, [ev(n.operand)]); // sqrt/cbrt/qdrt prefix
      }
      case 'postfix': return factorial(ev(n.operand)); // 'fact'
      case 'call': return call(n.name, n.args.map(ev));
      case 'binary': {
        // percent-of semantics: a ± b% adjusts a by that fraction of a
        if (n.right.type === 'percent' && percentMode === 'of') {
          const a = ev(n.left);
          const p = ev(n.right.operand).div(100);
          if (n.op === '+') return a.plus(a.times(p));
          if (n.op === '-') return a.minus(a.times(p));
          if (n.op === '*') return a.times(p);
          if (n.op === '/') return a.div(p);
          return bin(n.op, a, p);
        }
        return bin(n.op, ev(n.left), ev(n.right));
      }
      default: throw new Error('Unknown node');
    }
  };

  return ev(ast);
}
