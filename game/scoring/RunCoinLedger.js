/**
 * Run-wide coin bank and per-level counters. Does not touch the scene.
 */
export class RunCoinLedger {
  constructor() {
    this._bankTotal = 0;
    this._levelTotal = 0;
    this._levelCollected = 0;
  }

  startNewRun() {
    this._bankTotal = 0;
    this._levelTotal = 0;
    this._levelCollected = 0;
  }

  /**
   * @param {number} levelTotal
   */
  beginLevel(levelTotal) {
    this._levelTotal = levelTotal;
    this._levelCollected = 0;
  }

  /**
   * @param {number} n
   */
  collect(n) {
    if (n > 0) this._levelCollected += n;
  }

  resetLevelProgress() {
    this._levelCollected = 0;
  }

  getBankTotal() {
    return this._bankTotal;
  }

  getLevelCollected() {
    return this._levelCollected;
  }

  getLevelTotal() {
    return this._levelTotal;
  }

  /** Banked completed levels plus coins collected so far on the current level. */
  getRunDisplayTotal() {
    return this._bankTotal + this._levelCollected;
  }

  /**
   * Banks the current level into the run total. Call once on level complete.
   * @returns {{ levelScore: number, runTotalAfter: number }}
   */
  bankForLevelComplete() {
    const levelScore = this._levelCollected;
    this._bankTotal += this._levelCollected;
    this._levelCollected = 0;
    this._levelTotal = 0;
    return { levelScore, runTotalAfter: this._bankTotal };
  }
}
