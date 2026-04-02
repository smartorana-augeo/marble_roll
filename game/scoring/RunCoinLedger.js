/**
 * Run-wide coin bank and per-level counters. Does not touch the scene.
 */
export class RunCoinLedger {
  constructor() {
    this._bankTotal = 0;
    this._levelTotal = 0;
    this._levelCollected = 0;
    /**
     * Coins picked up on this level across all lives / restarts (HUD uses {@link _levelCollected} for the
     * current attempt only).
     */
    this._pickupsThisLevelAllAttempts = 0;
    /** Sum of coin counts for each level loaded this run (used for run-end %). */
    this._runPossibleTotal = 0;
  }

  startNewRun() {
    this._bankTotal = 0;
    this._levelTotal = 0;
    this._levelCollected = 0;
    this._pickupsThisLevelAllAttempts = 0;
    this._runPossibleTotal = 0;
  }

  /**
   * @param {number} levelTotal
   */
  beginLevel(levelTotal) {
    const n = Math.max(0, Math.floor(Number(levelTotal)) || 0);
    this._runPossibleTotal += n;
    this._levelTotal = n;
    this._levelCollected = 0;
    this._pickupsThisLevelAllAttempts = 0;
  }

  /**
   * @param {number} n
   */
  collect(n) {
    if (n > 0) {
      this._levelCollected += n;
      this._pickupsThisLevelAllAttempts += n;
    }
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

  /** Banked coins from completed levels only. */
  getRunDisplayTotal() {
    return this._bankTotal;
  }

  /** Banked coins plus coins collected in the current (final) attempt. Used for game-over display. */
  getRunGameOverTotal() {
    return this._bankTotal + this._levelCollected;
  }

  /** Sum of maximum coins on every level started this run (current level included). */
  getRunPossibleTotal() {
    return this._runPossibleTotal;
  }

  /**
   * Banks the current level into the run total. Call once on level complete.
   * @returns {{ levelScore: number, runTotalAfter: number }}
   */
  bankForLevelComplete() {
    const levelScore = this._pickupsThisLevelAllAttempts;
    this._bankTotal += this._pickupsThisLevelAllAttempts;
    this._levelCollected = 0;
    this._pickupsThisLevelAllAttempts = 0;
    this._levelTotal = 0;
    return { levelScore, runTotalAfter: this._bankTotal };
  }
}
