import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Shell } from './Shell';
import { CalcIcon } from './icons';

// Default trigger icon — the shared calculator glyph (same one shown beside the brand).
// Override entirely via the `icon` (or `trigger`) prop.
const DefaultIcon = ({ size = 22 }: { size?: number }) => <CalcIcon size={size} />;

/** Handed to a custom `trigger` / function-child so you can open the dialog from any UI. */
export interface LauncherApi {
  open: boolean;
  openDialog: () => void;
  close: () => void;
  toggle: () => void;
}

export interface LauncherProps {
  /** 'fab' floating button · 'inline' in-flow button · 'headless' you render the trigger. */
  variant?: 'fab' | 'inline' | 'headless';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  hotkey?: string | null; // e.g. 'mod+shift+k'; null disables
  defaultOpen?: boolean;
  /** Controlled open state (pair with `onOpenChange`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  /** Any icon/content for the built-in button — an emoji, an <svg>, an <img>, a component. */
  icon?: ReactNode;
  /** Passthrough styling for the built-in button. */
  className?: string;
  style?: CSSProperties;
  /**
   * Render your OWN trigger (any button/element/UI). Receives `{ open, toggle, openDialog, close }`.
   * When provided — or with `variant="headless"` and a function child — the built-in button is not rendered.
   */
  trigger?: (api: LauncherApi) => ReactNode;
  children?: ReactNode | ((api: LauncherApi) => ReactNode);
  /** Dialog sizing / title. */
  dialogSize?: 'md' | 'lg' | 'xl' | 'full';
  dialogTitle?: string;
}

// §11.1 launcher: one trigger, one dialog, everything inside — with full trigger customization.
export function Launcher({
  variant = 'fab',
  position = 'bottom-right',
  hotkey = 'mod+shift+k',
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  label = 'Open CalcSuite calculators',
  icon,
  className,
  style,
  trigger,
  children,
  dialogSize = 'full',
  dialogTitle = 'CalcSuite',
}: LauncherProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? (openProp as boolean) : uncontrolled;
  const setOpen = (v: boolean) => {
    if (!isControlled) setUncontrolled(v);
    onOpenChange?.(v);
  };
  const api: LauncherApi = {
    open,
    openDialog: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
  };

  useEffect(() => {
    if (!hotkey) return;
    const wantMod = hotkey.includes('mod');
    const wantShift = hotkey.includes('shift');
    const key = hotkey.split('+').pop();
    const onKey = (e: KeyboardEvent) => {
      if ((!wantMod || e.metaKey || e.ctrlKey) && (!wantShift || e.shiftKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkey, open, isControlled]);

  const custom = trigger ?? (typeof children === 'function' ? (children as (api: LauncherApi) => ReactNode) : undefined);
  const headless = variant === 'headless' || !!custom;

  return (
    <>
      {headless ? (
        custom?.(api)
      ) : variant === 'fab' ? (
        <button className={`fc-fab pos-${position} ${className ?? ''}`.trim()} style={style} aria-label={label} onClick={api.openDialog}>
          {icon ?? <DefaultIcon size={24} />}
        </button>
      ) : (
        <button className={`icon-btn ${className ?? ''}`.trim()} style={style} aria-label={label} onClick={api.openDialog}>
          <span aria-hidden style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}>
            {icon ?? <DefaultIcon size={16} />}
          </span>
          {label}
        </button>
      )}

      <Dialog open={open} onClose={api.close} title={dialogTitle} size={dialogSize}>
        <Shell onClose={api.close} />
      </Dialog>
    </>
  );
}
