/**
 * Double-tap guard for play/pause toggles — an accidental second tap within
 * the window is ignored so a double-click reliably STARTS instead of
 * start-then-instant-pause (which looks like "the button does nothing").
 */
export function guardToggle(windowMs = 350): () => boolean {
  let last = -Infinity;
  return () => {
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    if (now - last < windowMs) return false;
    last = now;
    return true;
  };
}
