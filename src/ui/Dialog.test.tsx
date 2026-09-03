// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Dialog } from './Dialog';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

const mounted: Array<{ root: Root; container: HTMLElement }> = [];
afterEach(() => {
  // Unmount every dialog so its document-level listeners are removed (only one dialog is
  // ever open at a time in the app).
  while (mounted.length) {
    const { root, container } = mounted.pop()!;
    act(() => root.unmount());
    container.remove();
  }
});

function mount(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui as any);
  });
  mounted.push({ root, container });
  return { container, root };
}

const key = (target: EventTarget, k: string, opts: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
  });

describe('Dialog keyboard isolation (§11.7)', () => {
  it('blocks host window shortcuts for keys pressed INSIDE the dialog', () => {
    const winSpy = vi.fn();
    window.addEventListener('keydown', winSpy);
    mount(<Dialog open onClose={() => {}}><input aria-label="a1" /></Dialog>);
    const input = document.querySelector('input[aria-label="a1"]')!;
    key(input, 'g');
    expect(winSpy).not.toHaveBeenCalled();
    window.removeEventListener('keydown', winSpy);
  });

  it('blocks host window shortcuts for keys pressed OUTSIDE the dialog', () => {
    const winSpy = vi.fn();
    window.addEventListener('keydown', winSpy);
    mount(<Dialog open onClose={() => {}}><input aria-label="a2" /></Dialog>);
    key(document.body, 'g');
    expect(winSpy).not.toHaveBeenCalled();
    window.removeEventListener('keydown', winSpy);
  });

  it('still delivers keydown to React handlers inside the dialog (palette nav works)', () => {
    const innerSpy = vi.fn();
    mount(<Dialog open onClose={() => {}}><input aria-label="a3" onKeyDown={innerSpy} /></Dialog>);
    const input = document.querySelector('input[aria-label="a3"]')!;
    key(input, 'ArrowDown');
    expect(innerSpy).toHaveBeenCalled();
  });

  it('Escape triggers onClose', () => {
    const onClose = vi.fn();
    mount(<Dialog open onClose={onClose}><input aria-label="a4" /></Dialog>);
    key(document, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
