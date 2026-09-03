import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CalculatorDef } from '../core/kit';
import { useSettings } from '../settings/SettingsContext';
import { evalExpression, type AngleMode, type Base, type PercentMode } from '../core/sci';
import { Decimal, type DecimalT } from '../core/decimal';

// Bespoke panel for the scientific calculator (§7). The display is a real
// <input> so keyboard entry and paste-parse come for free; the keypad inserts
// tokens at the caret. Live preview evaluates on every change.

interface Btn {
  t: string; // label
  aria: string;
  ins?: string; // text to insert at caret
  act?: 'eq' | 'clear' | 'back' | 'mc' | 'mr' | 'mplus' | 'mminus';
  alt?: Btn; // shown while 2nd is active
  cls?: string;
}

const b = (t: string, aria: string, ins: string, cls = 'fn', alt?: Btn): Btn => ({ t, aria, ins, cls, alt });

function fmtOut(value: DecimalT, base: Base): string {
  if (value.isNaN() || !value.isFinite()) return '';
  if (base !== 'DEC') {
    const bi = BigInt(value.trunc().toFixed(0));
    const radix = base === 'HEX' ? 16 : base === 'OCT' ? 8 : 2;
    const pre = base === 'HEX' ? '0x' : base === 'OCT' ? '0o' : '0b';
    const digits = (bi < 0n ? (-bi).toString(radix) : bi.toString(radix)).toUpperCase();
    return (bi < 0n ? '-' : '') + pre + digits;
  }
  return value.toSignificantDigits(12).toString();
}

export function SciCalculator({ def }: { def: CalculatorDef }) {
  void def;
  const { settings } = useSettings();
  const percentMode: PercentMode = ((settings as unknown as { percentMode?: PercentMode }).percentMode) ?? 'of';

  const [expr, setExpr] = useState('');
  const [angleMode, setAngleMode] = useState<AngleMode>('deg');
  const [base, setBase] = useState<Base>('DEC');
  const [second, setSecond] = useState(false);
  const [memory, setMemory] = useState<DecimalT>(() => new Decimal(0));
  const [ans, setAns] = useState<DecimalT>(() => new Decimal(0));
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => evalExpression(expr, { angleMode, percentMode, base, ans, memory }),
    [expr, angleMode, percentMode, base, ans, memory],
  );
  const previewText = expr.trim() ? (preview.error ? '' : fmtOut(preview.value, base)) : '';

  const focusInput = (pos: number) => requestAnimationFrame(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  });

  const insert = (text: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    setExpr(expr.slice(0, start) + text + expr.slice(end));
    focusInput(start + text.length);
  };

  const backspace = () => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    if (start !== end) { setExpr(expr.slice(0, start) + expr.slice(end)); focusInput(start); return; }
    if (start === 0) return;
    setExpr(expr.slice(0, start - 1) + expr.slice(start));
    focusInput(start - 1);
  };

  const equals = () => {
    if (!expr.trim()) return;
    const r = evalExpression(expr, { angleMode, percentMode, base, ans, memory });
    if (r.error) return;
    const out = fmtOut(r.value, base);
    setHistory((h) => [{ expr, result: out }, ...h].slice(0, 50));
    setAns(r.value);
    setExpr(out);
    focusInput(out.length);
  };

  const doAct = (a: NonNullable<Btn['act']>) => {
    switch (a) {
      case 'eq': equals(); break;
      case 'clear': setExpr(''); focusInput(0); break;
      case 'back': backspace(); break;
      case 'mc': setMemory(new Decimal(0)); break;
      case 'mr': insert('M'); break;
      case 'mplus': if (!preview.error) setMemory((m) => m.plus(preview.value)); break;
      case 'mminus': if (!preview.error) setMemory((m) => m.minus(preview.value)); break;
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); equals(); }
  };

  const press = (btn: Btn) => {
    if (btn.act) doAct(btn.act);
    else if (btn.ins != null) insert(btn.ins);
    if (second) setSecond(false); // one-shot shift
  };

  // ── keypad rows ──
  const rows: Btn[][] = [
    [
      { t: '2nd', aria: 'second function', cls: second ? 'mode on' : 'mode', act: undefined, ins: undefined },
      b('sin', 'sine', 'sin(', 'fn', b('sin⁻¹', 'arcsine', 'asin(')),
      b('cos', 'cosine', 'cos(', 'fn', b('cos⁻¹', 'arccosine', 'acos(')),
      b('tan', 'tangent', 'tan(', 'fn', b('tan⁻¹', 'arctangent', 'atan(')),
      b('ln', 'natural log', 'ln(', 'fn', b('eˣ', 'e to the x', 'exp(')),
      b('log', 'log base 10', 'log(', 'fn', b('10ˣ', 'ten to the x', '10^')),
    ],
    [
      b('x²', 'square', '^2', 'fn', b('x³', 'cube', '^3')),
      b('√', 'square root', '√', 'fn', b('∛', 'cube root', '∛')),
      b('xʸ', 'power', '^', 'fn', b('ʸ√x', 'nth root', 'root(')),
      b('π', 'pi', 'π', 'fn', b('φ', 'golden ratio', 'phi')),
      b('e', 'euler number', 'e', 'fn', b('EE', 'exponent', 'E')),
      b('1/x', 'reciprocal', 'recip(', 'fn', b('|x|', 'absolute value', 'abs(')),
    ],
    [
      b('n!', 'factorial', '!', 'fn', b('sinh', 'hyperbolic sine', 'sinh(')),
      b('nCr', 'combinations', 'nCr(', 'fn', b('cosh', 'hyperbolic cosine', 'cosh(')),
      b('nPr', 'permutations', 'nPr(', 'fn', b('tanh', 'hyperbolic tangent', 'tanh(')),
      b('gcd', 'greatest common divisor', 'gcd(', 'fn', b('lcm', 'least common multiple', 'lcm(')),
      b('(', 'open paren', '(', 'fn'),
      b(')', 'close paren', ')', 'fn'),
    ],
    [
      { t: 'C', aria: 'clear', act: 'clear', cls: 'op' },
      { t: '⌫', aria: 'backspace', act: 'back', cls: 'op' },
      b('mod', 'modulo', ' mod ', 'op', b('round', 'round', 'round(')),
      b('%', 'percent', '%', 'op', b('floor', 'floor', 'floor(')),
      b('÷', 'divide', '÷', 'op', b('ceil', 'ceiling', 'ceil(')),
    ],
    [
      b('7', '7', '7', 'num'), b('8', '8', '8', 'num'), b('9', '9', '9', 'num'),
      b('×', 'multiply', '×', 'op'), b('!', 'factorial', '!', 'op', b('sign', 'sign', 'sign(')),
    ],
    [
      b('4', '4', '4', 'num'), b('5', '5', '5', 'num'), b('6', '6', '6', 'num'),
      b('−', 'minus', '−', 'op'), b('^', 'power', '^', 'op'),
    ],
    [
      b('1', '1', '1', 'num'), b('2', '2', '2', 'num'), b('3', '3', '3', 'num'),
      b('+', 'plus', '+', 'op'), b('.', 'decimal point', '.', 'num'),
    ],
    [
      b('0', '0', '0', 'num'), b('±', 'negate', '-', 'num'),
      { t: 'M+', aria: 'memory add', act: 'mplus', cls: 'op' },
      { t: 'M−', aria: 'memory subtract', act: 'mminus', cls: 'op' },
      { t: '=', aria: 'equals', act: 'eq', cls: 'accent' },
    ],
  ];

  // extra rows only meaningful outside DEC
  const bitRow: Btn[] = [
    b('AND', 'bitwise and', ' and ', 'op'), b('OR', 'bitwise or', ' or ', 'op'),
    b('XOR', 'bitwise xor', ' xor ', 'op'), b('NOT', 'bitwise not', 'not ', 'op'),
    b('<<', 'shift left', '<<', 'op'), b('>>', 'shift right', '>>', 'op'),
  ];
  const hexRow: Btn[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((h) => b(h, `hex ${h}`, h, 'num'));

  return (
    <section className="card sci">
      {/* toggles */}
      <div className="sci-toolbar">
        <div className="seg" role="group" aria-label="angle mode">
          {(['deg', 'rad', 'grad'] as AngleMode[]).map((m) => (
            <button key={m} type="button" aria-pressed={angleMode === m} onClick={() => setAngleMode(m)}>{m}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="number base">
          {(['DEC', 'HEX', 'OCT', 'BIN'] as Base[]).map((m) => (
            <button key={m} type="button" aria-pressed={base === m} onClick={() => setBase(m)}>{m}</button>
          ))}
        </div>
        {!memory.isZero() && <span className="sci-mem" aria-label="memory in use">M</span>}
      </div>

      {/* display */}
      <div className="sci-display">
        <input
          ref={inputRef}
          className="sci-expr num"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          placeholder="Type or tap an expression"
          aria-label="Expression"
        />
        <div className="sci-out num" aria-live="polite">
          {expr.trim() && preview.error ? <span className="sci-err">{preview.error}</span>
            : previewText ? <span>= {previewText}</span> : <span>&nbsp;</span>}
        </div>
      </div>

      {/* keypad */}
      <div className="sci-pad" role="group" aria-label="calculator keypad">
        {rows.map((row, ri) => (
          <div className="sci-row" key={ri}>
            {row.map((raw, ci) => {
              const btn = second && raw.alt ? raw.alt : raw;
              const isShift = raw.t === '2nd';
              return (
                <button
                  key={ci}
                  type="button"
                  className={`sci-key ${btn.cls ?? 'fn'}`}
                  aria-label={btn.aria}
                  aria-pressed={isShift ? second : undefined}
                  onClick={() => (isShift ? setSecond((s) => !s) : press(btn))}
                >
                  {btn.t}
                </button>
              );
            })}
          </div>
        ))}
        {base !== 'DEC' && (
          <>
            {base === 'HEX' && <div className="sci-row">{hexRow.map((btn, ci) => (
              <button key={ci} type="button" className={`sci-key ${btn.cls}`} aria-label={btn.aria} onClick={() => press(btn)}>{btn.t}</button>
            ))}</div>}
            <div className="sci-row">{bitRow.map((btn, ci) => (
              <button key={ci} type="button" className={`sci-key ${btn.cls}`} aria-label={btn.aria} onClick={() => press(btn)}>{btn.t}</button>
            ))}</div>
          </>
        )}
      </div>

      {/* memory + ans quick keys */}
      <div className="sci-row sci-memrow">
        <button type="button" className="sci-key op" aria-label="memory clear" onClick={() => doAct('mc')}>MC</button>
        <button type="button" className="sci-key op" aria-label="memory recall" onClick={() => doAct('mr')}>MR</button>
        <button type="button" className="sci-key fn" aria-label="insert previous answer" onClick={() => insert('ans')}>ans</button>
      </div>

      {/* history tape */}
      {history.length > 0 && (
        <div className="sci-tape">
          <div className="sci-tape-head">
            <span>History</span>
            <button type="button" className="icon-btn" onClick={() => setHistory([])} aria-label="clear history">Clear</button>
          </div>
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setExpr(h.expr); focusInput(h.expr.length); }} aria-label={`reuse ${h.expr} equals ${h.result}`}>
                  <span className="sci-tape-expr num">{h.expr}</span>
                  <span className="sci-tape-res num">= {h.result}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
