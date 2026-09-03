// Shunting-yard parser: Token[] → AST (§7). Full precedence, right-assoc `^`,
// unary minus, prefix roots, postfix `!`/`%`, functions with N args, and
// auto-close of unbalanced '(' at end of input.
import type { Token } from './tokenizer';

export type Node =
  | { type: 'num'; value: string }
  | { type: 'const'; name: string }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: string; operand: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'postfix'; op: string; operand: Node } // 'fact'
  | { type: 'percent'; operand: Node }
  | { type: 'call'; name: string; args: Node[] };

interface OpInfo { prec: number; right?: boolean }

// Binary operator table (higher prec binds tighter).
const BIN: Record<string, OpInfo> = {
  or: { prec: 1 },
  xor: { prec: 2 },
  and: { prec: 3 },
  '<<': { prec: 4 }, '>>': { prec: 4 },
  '+': { prec: 5 }, '-': { prec: 5 },
  '*': { prec: 6 }, '/': { prec: 6 }, mod: { prec: 6 }, '%': { prec: 6 },
  '^': { prec: 8, right: true },
};

// Prefix unary precedence. Roots bind tightest so `√9+16` = 3+16.
const UNARY_PREC: Record<string, number> = { neg: 7, bnot: 7, sqrt: 10, cbrt: 10, qdrt: 10 };

type StackOp =
  | { k: 'bin'; op: string; prec: number; right: boolean }
  | { k: 'un'; op: string; prec: number }
  | { k: 'func'; name: string }
  | { k: 'lparen' };

const SENTINEL = Symbol('arg');
type OutItem = Node | typeof SENTINEL;

export function parse(tokens: Token[]): Node {
  const output: OutItem[] = [];
  const ops: StackOp[] = [];
  let expectOperand = true;

  const popNode = (): Node => {
    const n = output.pop();
    if (n === undefined || n === SENTINEL) throw new Error('Malformed expression');
    return n;
  };

  const applyOp = (o: StackOp) => {
    if (o.k === 'un') { output.push({ type: 'unary', op: o.op, operand: popNode() }); return; }
    if (o.k === 'bin') {
      const right = popNode();
      const left = popNode();
      output.push({ type: 'binary', op: o.op, left, right });
      return;
    }
    if (o.k === 'func') { closeCall(o.name); return; }
    // lparen popped without a matching ')' → auto-closed, drop it
  };

  const closeCall = (name: string) => {
    const args: Node[] = [];
    while (output.length && output[output.length - 1] !== SENTINEL) args.unshift(popNode());
    if (output.pop() !== SENTINEL) throw new Error(`Bad call to ${name}`);
    output.push({ type: 'call', name, args });
  };

  for (const tok of tokens) {
    switch (tok.type) {
      case 'num': output.push({ type: 'num', value: tok.value }); expectOperand = false; break;
      case 'const': output.push({ type: 'const', name: tok.value }); expectOperand = false; break;
      case 'var': output.push({ type: 'var', name: tok.value }); expectOperand = false; break;

      case 'func': ops.push({ k: 'func', name: tok.value }); expectOperand = true; break;

      case 'uop': {
        ops.push({ k: 'un', op: tok.value, prec: UNARY_PREC[tok.value] ?? 7 });
        expectOperand = true;
        break;
      }

      case 'op': {
        if (expectOperand) {
          // unary context
          if (tok.value === '-') ops.push({ k: 'un', op: 'neg', prec: UNARY_PREC.neg! });
          else if (tok.value === '+') { /* unary plus is a no-op */ }
          else throw new Error(`Unexpected operator: ${tok.value}`);
          expectOperand = true;
        } else {
          const info = BIN[tok.value];
          if (!info) throw new Error(`Unknown operator: ${tok.value}`);
          while (ops.length) {
            const top = ops[ops.length - 1]!;
            if (top.k === 'lparen' || top.k === 'func') break;
            const topPrec = top.prec;
            if (topPrec > info.prec || (topPrec === info.prec && !info.right)) applyOp(ops.pop()!);
            else break;
          }
          ops.push({ k: 'bin', op: tok.value, prec: info.prec, right: !!info.right });
          expectOperand = true;
        }
        break;
      }

      case 'postfix': {
        // factorial / percent bind tightest → wrap the current top operand
        const operand = popNode();
        if (tok.value === 'pct') output.push({ type: 'percent', operand });
        else output.push({ type: 'postfix', op: tok.value, operand });
        expectOperand = false;
        break;
      }

      case 'lparen': {
        if (ops.length && ops[ops.length - 1]!.k === 'func') output.push(SENTINEL);
        ops.push({ k: 'lparen' });
        expectOperand = true;
        break;
      }

      case 'comma': {
        while (ops.length && ops[ops.length - 1]!.k !== 'lparen') applyOp(ops.pop()!);
        if (!ops.length) throw new Error('Comma outside function call');
        expectOperand = true;
        break;
      }

      case 'rparen': {
        while (ops.length && ops[ops.length - 1]!.k !== 'lparen') applyOp(ops.pop()!);
        if (!ops.length) break; // unmatched ')' — ignore
        ops.pop(); // the lparen
        if (ops.length && ops[ops.length - 1]!.k === 'func') closeCall((ops.pop() as { name: string }).name);
        expectOperand = false;
        break;
      }
    }
  }

  // auto-close: drain remaining operators (skipping unmatched '(')
  while (ops.length) applyOp(ops.pop()!);

  if (output.length !== 1) throw new Error('Malformed expression');
  const root = output[0]!;
  if (root === SENTINEL) throw new Error('Malformed expression');
  return root;
}
