/**
 * Resolves after the next animation frame so the browser can paint (progress bar, overlay).
 * @returns {Promise<void>}
 */
export function yieldToPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
