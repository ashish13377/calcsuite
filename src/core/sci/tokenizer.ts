// Tokenizer for the scientific-calculator expression language (§7).
// Emits a flat token stream that the shunting-yard parser turns into an AST.
// Handles decimals, 0x/0o/0b literals, base-mode bare literals (HEX/OCT/BIN),
// unicode operators, prefix roots, factorial/percent postfix, keyword bitwise
// ops, and inserts explicit `*` tokens for implicit multiplication (2(3+4), 2π).

export type Base = 'DEC' | 'HEX' | 'OCT' | 'BIN';

export type TokenType =
  | 'num' //   numeric literal, `value` is a plain decimal string
  | 'func' //  function name (canonical lowercase), followed by '('
  | 'const' // PI | E | PHI
  | 'var' //   A..F | ans | M
  | 'op' //    binary operator: + - * / ^ mod << >> and or xor
  | 'uop' //   prefix unary: sqrt cbrt qdrt bnot
  | 'postfix' //  fact (!) | pct (%)
  | 'lparen'
  | 'rparen'
  | 'comma';

export interface Token {
  type: TokenType;
  value: string;
  implicit?: boolean; // marks an inserted implicit-multiplication '*'
}

// Canonical function names the evaluator understands. Keyword operators
// (mod/and/or/xor/not) are NOT here — they tokenize as op/uop.
const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'ln', 'log', 'log2', 'logx', 'exp', 'tenpow', 'epow',
  'sqrt', 'cbrt', 'qdrt', 'root', 'pow',
  'ncr', 'npr', 'gcd', 'lcm', 'mod',
  'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
  'fact', 'sq', 'cube', 'recip',
]);

// aliases → canonical
const FUNC_ALIAS: Record<string, string> = {
  arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  lg: 'log', log10: 'log', ncr: 'ncr', npr: 'npr',
};

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isHex = (c: string) => isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

const VALUE_START = new Set<TokenType>(['num', 'const', 'var', 'func', 'lparen', 'uop']);
const VALUE_END = new Set<TokenType>(['num', 'const', 'var', 'rparen', 'postfix']);

function baseDigits(base: Base): (c: string) => boolean {
  if (base === 'HEX') return isHex;
  if (base === 'OCT') return (c) => c >= '0' && c <= '7';
  if (base === 'BIN') return (c) => c === '0' || c === '1';
  return isDigit;
}

/** Classify a bare identifier into func / const / var, applying case rules. */
function classifyIdent(raw: string): Token {
  const lower = raw.toLowerCase();
  const canon = FUNC_ALIAS[lower] ?? lower;
  if (FUNCTIONS.has(canon)) return { type: 'func', value: canon };
  // keyword operators
  if (lower === 'mod') return { type: 'op', value: 'mod' };
  if (lower === 'and') return { type: 'op', value: 'and' };
  if (lower === 'or') return { type: 'op', value: 'or' };
  if (lower === 'xor') return { type: 'op', value: 'xor' };
  if (lower === 'not') return { type: 'uop', value: 'bnot' };
  // constants
  if (lower === 'pi') return { type: 'const', value: 'PI' };
  if (lower === 'phi') return { type: 'const', value: 'PHI' };
  if (raw === 'e') return { type: 'const', value: 'E' }; // lowercase only; uppercase E is a var
  if (lower === 'ans') return { type: 'var', value: 'ans' };
  // single-letter variables A..F (case-insensitive), memory M
  if (raw.length === 1) {
    const u = raw.toUpperCase();
    if (u >= 'A' && u <= 'F') return { type: 'var', value: u };
    if (u === 'M') return { type: 'var', value: 'M' };
  }
  throw new Error(`Unknown name: ${raw}`);
}

export function tokenize(input: string, opts: { base?: Base } = {}): Token[] {
  const base = opts.base ?? 'DEC';
  const src = input;
  const raw: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;
    if (isSpace(c)) { i++; continue; }

    // ── numbers (0x/0o/0b prefix always honoured, then base-mode, then decimal) ──
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      // prefixed literal
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X' || src[i + 1] === 'o' ||
        src[i + 1] === 'O' || src[i + 1] === 'b' || src[i + 1] === 'B')) {
        const p = src[i + 1]!.toLowerCase();
        let j = i + 2;
        const ok = p === 'x' ? isHex : p === 'o' ? (x: string) => x >= '0' && x <= '7' : (x: string) => x === '0' || x === '1';
        const start = j;
        while (j < src.length && ok(src[j]!)) j++;
        if (j === start) throw new Error(`Malformed 0${p} literal`);
        raw.push({ type: 'num', value: BigInt(`0${p}${src.slice(start, j)}`).toString() });
        i = j;
        continue;
      }
      if (base !== 'DEC') {
        const ok = baseDigits(base);
        let j = i;
        while (j < src.length && ok(src[j]!)) j++;
        const digits = src.slice(i, j);
        const prefix = base === 'HEX' ? '0x' : base === 'OCT' ? '0o' : '0b';
        raw.push({ type: 'num', value: BigInt(prefix + digits).toString() });
        i = j;
        continue;
      }
      // decimal with optional fraction + exponent
      let j = i;
      while (j < src.length && isDigit(src[j]!)) j++;
      if (src[j] === '.') { j++; while (j < src.length && isDigit(src[j]!)) j++; }
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1;
        if (src[k] === '+' || src[k] === '-') k++;
        if (isDigit(src[k] ?? '')) { k++; while (k < src.length && isDigit(src[k]!)) k++; j = k; }
      }
      raw.push({ type: 'num', value: src.slice(i, j) });
      i = j;
      continue;
    }

    // ── identifiers (functions / constants / variables / keyword ops) ──
    if (isAlpha(c) || c === '_') {
      let j = i;
      while (j < src.length && (isAlpha(src[j]!) || isDigit(src[j]!) || src[j] === '_')) j++;
      raw.push(classifyIdent(src.slice(i, j)));
      i = j;
      continue;
    }

    // ── operators & symbols ──
    const two = src.slice(i, i + 2);
    if (two === '<<' || two === '>>') { raw.push({ type: 'op', value: two }); i += 2; continue; }

    switch (c) {
      case '+': case '-': raw.push({ type: 'op', value: c }); i++; break;
      case '−': raw.push({ type: 'op', value: '-' }); i++; break; // − minus sign
      case '*': case '×': raw.push({ type: 'op', value: '*' }); i++; break; // ×
      case '/': case '÷': case '∕': raw.push({ type: 'op', value: '/' }); i++; break; // ÷ ∕
      case '^': raw.push({ type: 'op', value: '^' }); i++; break;
      case '%': raw.push({ type: 'op', value: '%raw' }); i++; break; // resolved below
      case '(': case '[': case '{': raw.push({ type: 'lparen', value: '(' }); i++; break;
      case ')': case ']': case '}': raw.push({ type: 'rparen', value: ')' }); i++; break;
      case ',': raw.push({ type: 'comma', value: ',' }); i++; break;
      case '!': raw.push({ type: 'postfix', value: 'fact' }); i++; break;
      case '√': raw.push({ type: 'uop', value: 'sqrt' }); i++; break; // √
      case '∛': raw.push({ type: 'uop', value: 'cbrt' }); i++; break; // ∛
      case '∜': raw.push({ type: 'uop', value: 'qdrt' }); i++; break; // ∜
      case 'π': raw.push({ type: 'const', value: 'PI' }); i++; break; // π
      case 'Φ': case 'φ': raw.push({ type: 'const', value: 'PHI' }); i++; break; // Φ φ
      case '&': raw.push({ type: 'op', value: 'and' }); i++; break;
      case '|': raw.push({ type: 'op', value: 'or' }); i++; break;
      default:
        throw new Error(`Unexpected character: ${c}`);
    }
  }

  // ── resolve %: binary modulo if an operand follows, else postfix percent ──
  const pct: Token[] = raw.map((t, idx) => {
    if (t.value !== '%raw') return t;
    const next = raw[idx + 1];
    if (next && VALUE_START.has(next.type)) return { type: 'op', value: 'mod' };
    return { type: 'postfix', value: 'pct' };
  });

  // ── insert implicit-multiplication tokens (value-end followed by value-start) ──
  const out: Token[] = [];
  for (let k = 0; k < pct.length; k++) {
    const t = pct[k]!;
    const prev = out[out.length - 1];
    if (prev && VALUE_END.has(prev.type) && VALUE_START.has(t.type)) {
      out.push({ type: 'op', value: '*', implicit: true });
    }
    out.push(t);
  }
  return out;
}
