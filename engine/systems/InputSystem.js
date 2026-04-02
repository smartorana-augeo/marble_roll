/**
 * Keyboard polling with edge detection for one-shot actions.
 */
export class InputSystem {
  constructor() {
    /** @type {Set<string>} */
    this._keys = new Set();
    /** @type {Set<string>} */
    this._prevKeys = new Set();
    /** @type {Set<string>} */
    this._edgeDown = new Set();

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this._keys.delete(e.code);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  /**
   * Call once per frame at the start of the pipeline.
   */
  poll() {
    this._edgeDown.clear();
    for (const code of this._keys) {
      if (!this._prevKeys.has(code)) this._edgeDown.add(code);
    }
    this._prevKeys = new Set(this._keys);
  }

  /**
   * @param {string} code
   */
  isDown(code) {
    return this._keys.has(code);
  }

  /**
   * @param {string} code
   */
  wasPressedEdge(code) {
    return this._edgeDown.has(code);
  }

  /**
   * Brake: left or right Shift held (no toggle — released when the key is released).
   * @returns {boolean}
   */
  isBrakeActive() {
    return this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
  }
}
