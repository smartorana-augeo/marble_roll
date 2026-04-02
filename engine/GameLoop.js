/**
 * Single requestAnimationFrame driver; invokes the frame pipeline callback with delta time.
 */
export class GameLoop {
  constructor(onFrame) {
    /** @type {(deltaSeconds: number) => void} */
    this._onFrame = onFrame;
    this._running = false;
    this._rafId = 0;
    this._lastTs = 0;
    this._boundTick = this._tick.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(this._boundTick);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  /**
   * @param {number} ts
   */
  _tick(ts) {
    if (!this._running) return;
    const now = typeof performance !== 'undefined' ? performance.now() : ts;
    const deltaMs = Math.min(100, Math.max(0.5, now - this._lastTs));
    this._lastTs = now;
    const deltaSeconds = deltaMs / 1000;
    this._onFrame(deltaSeconds);
    this._rafId = requestAnimationFrame(this._boundTick);
  }
}
