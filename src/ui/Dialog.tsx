import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { hasOverlay } from './overlayStack';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Modal dialog with a real focus trap and shortcut isolation (§11.7):
//  • focus moves in on open, is trapped (Tab/Shift+Tab cycle), and restores on close
//  • Escape closes
//  • while open, ALL host/global keyboard shortcuts are blocked:
//      – keys pressed with focus outside the dialog are cancelled (capture phase)
//      – keys pressed inside the dialog are handled by the dialog but stopped from
//        bubbling to window/document, so the host page's listeners never see them
export function Dialog({
  open,
  onClose,
  children,
  title,
  size = 'xl',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'md' | 'lg' | 'xl' | 'full';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<Element | null>(null);

  const focusables = useCallback((): HTMLElement[] => {
    const el = ref.current;
    if (!el) return [];
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => !n.hasAttribute('disabled') && n.getAttribute('aria-hidden') !== 'true',
    );
  }, []);

  // Keep the dialog mounted through the exit animation, then unmount.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      setClosing(true);
      const t = setTimeout(() => {
        setRender(false);
        setClosing(false);
      }, 210);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialogEl = ref.current;
    restoreTo.current = document.activeElement;

    // Move focus into the dialog.
    const first = focusables()[0] ?? dialogEl;
    first?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Capture-phase guard on document: runs before any host handler. Handles Escape and
    // the focus trap, and cancels any key event whose target is outside the dialog.
    const onCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let a nested overlay (command palette) consume Escape first.
        if (hasOverlay()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      const inside = !!dialogEl && dialogEl.contains(e.target as Node);
      if (!inside) {
        // focus escaped (or a global key while nothing in the dialog is focused) — block it
        e.preventDefault();
        e.stopImmediatePropagation();
        first?.focus();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = items[0]!;
        const lastEl = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && active === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', onCapture, true);
    document.addEventListener('keyup', onCapture, true);

    return () => {
      document.removeEventListener('keydown', onCapture, true);
      document.removeEventListener('keyup', onCapture, true);
      document.body.style.overflow = prevOverflow;
      (restoreTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, focusables]);

  // Stop in-dialog key events reaching the host's window/document listeners. This runs
  // LAST in the dialog's React bubble order (so the palette/inputs handle keys first),
  // and React's stopPropagation also stops the underlying native event — blocking host
  // shortcuts while keeping the dialog fully keyboard-operable.
  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  if (!render) return null;

  // Rendered inline (not portaled) so React delivers events to the dialog's own handlers;
  // the fixed-position backdrop still covers the viewport. Keyboard isolation is handled
  // by the effect above.
  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={onClose} onKeyDown={stopKeys} onKeyUp={stopKeys} onKeyPress={stopKeys}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'CalcSuite'}
        className={`dialog surface-${size} ${closing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
