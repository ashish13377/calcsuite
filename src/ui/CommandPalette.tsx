import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalculatorDef } from '../core/kit';
import { pushOverlay, popOverlay } from './overlayStack';

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Item {
  key: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

function score(q: string, text: string): number {
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i >= 0) return 100 - i;
  // subsequence fallback
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) if (t[ti] === q[qi]) qi++;
  return qi === q.length ? 10 : -1;
}

export function CommandPalette({
  calculators,
  actions,
  onPick,
  onClose,
}: {
  calculators: CalculatorDef[];
  actions: PaletteAction[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Register as the topmost overlay so Escape closes the palette (not the whole dialog).
  useEffect(() => {
    pushOverlay();
    return () => popOverlay();
  }, []);

  const items: Item[] = useMemo(() => {
    const calc: Item[] = calculators.map((c) => ({
      key: `calc:${c.id}`,
      label: c.title,
      group: c.group,
      hint: c.blurb,
      run: () => onPick(c.id),
    }));
    const act: Item[] = actions.map((a) => ({ key: `act:${a.id}`, label: a.label, group: 'action', hint: a.hint, run: a.run }));
    const all = [...calc, ...act];
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all
      .map((it) => ({ it, s: Math.max(score(query, it.label), score(query, `${it.group} ${calculators.find((c) => c.title === it.label)?.keywords?.join(' ') ?? ''}`)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);
  }, [q, calculators, actions, onPick]);

  useEffect(() => setActive(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search calculators and actions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          aria-label="Search"
        />
        <ul className="palette-list" role="listbox">
          {items.length === 0 && <li className="palette-empty">No matches</li>}
          {items.map((it, i) => (
            <li
              key={it.key}
              role="option"
              aria-selected={i === active}
              className={`palette-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => it.run()}
            >
              <span className="palette-label">{it.label}</span>
              <span className="palette-group">{it.group}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
