import { useEffect, useMemo, useRef, useState } from 'react';
import { createExporter, EXPORT_FORMATS, type ExportPayload, type ExportFormat } from '../export';

// Export button + accessible dropdown (§10). Quick actions for "Copy link" and
// "Print"; the menu lists every format. Success/notes and the friendly error for
// unavailable lazy formats surface in a transient toast.
type Toast = { msg: string; kind: 'ok' | 'warn' | 'error' } | null;

export function ExportMenu({ payload }: { payload: ExportPayload }) {
  const exporter = useMemo(() => createExporter(), []);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close on outside click / Escape; focus first item when opened.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function run(format: ExportFormat) {
    setOpen(false);
    try {
      const res = await exporter.export(format, payload);
      setToast({ msg: res.note ?? `${format.toUpperCase()} ready.`, kind: res.note ? 'warn' : 'ok' });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Export failed.', kind: 'error' });
    }
  }

  const focusItem = (i: number) => {
    const items = itemRefs.current.filter(Boolean);
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent, i: number) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusItem(i + 1); break;
      case 'ArrowUp': e.preventDefault(); focusItem(i - 1); break;
      case 'Home': e.preventDefault(); focusItem(0); break;
      case 'End': e.preventDefault(); focusItem(itemRefs.current.filter(Boolean).length - 1); break;
      case 'Escape': e.preventDefault(); setOpen(false); btnRef.current?.focus(); break;
    }
  };

  return (
    <div className="menu">
      <div style={{ display: 'inline-flex', gap: 8 }}>
        <button type="button" className="icon-btn" onClick={() => run('url')}>Copy link</button>
        <button type="button" className="icon-btn" onClick={() => run('print')}>Print</button>
        <button
          ref={btnRef}
          type="button"
          className="icon-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        >
          Export ▾
        </button>
      </div>

      {open && (
        <div ref={menuRef} className="menu-list" role="menu" aria-label="Export as">
          {EXPORT_FORMATS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              ref={(el) => { itemRefs.current[i] = el; }}
              onClick={() => run(f.id)}
              onKeyDown={(e) => onMenuKey(e, i)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {toast && (
        <div className={`export-toast ${toast.kind}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
