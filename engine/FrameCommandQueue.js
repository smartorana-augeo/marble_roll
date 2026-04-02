/**
 * FIFO command queue drained once per frame (with bounded passes if handlers enqueue follow-ups).
 */
export class FrameCommandQueue {
  constructor() {
    /** @type {{ type: string, payload?: object }[]} */
    this._queue = [];
    /** @type {Map<string, (payload?: object) => void>} */
    this._handlers = new Map();
  }

  /**
   * @param {string} type
   * @param {(payload?: object) => void} handler
   */
  register(type, handler) {
    this._handlers.set(type, handler);
  }

  /**
   * @param {{ type: string, payload?: object }} command
   */
  enqueue(command) {
    this._queue.push(command);
  }

  /**
   * @param {number} maxPasses
   */
  drain(maxPasses = 16) {
    let passes = 0;
    while (this._queue.length > 0 && passes < maxPasses) {
      const batch = this._queue.splice(0, this._queue.length);
      for (const { type, payload } of batch) {
        const handler = this._handlers.get(type);
        if (handler) handler(payload);
      }
      passes += 1;
    }
  }
}
