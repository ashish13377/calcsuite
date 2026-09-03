// Tiny nested-overlay counter so Escape closes the topmost layer (command palette)
// before the dialog itself. The command palette increments while mounted; the Dialog's
// Escape handler defers when the count is > 0.
let count = 0;
export const pushOverlay = () => {
  count += 1;
};
export const popOverlay = () => {
  count = Math.max(0, count - 1);
};
export const hasOverlay = () => count > 0;
