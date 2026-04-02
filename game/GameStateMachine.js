/**
 * Tracks high-level game flow states (see gen/specs/SPEC.md §4).
 */
export class GameStateMachine {
  constructor() {
    /** @type {'menu' | 'playing' | 'levelComplete' | 'marbleDead' | 'runGameOver'} */
    this.state = 'menu';
  }

  /**
   * @param {'menu' | 'playing' | 'levelComplete' | 'marbleDead' | 'runGameOver'} next
   */
  setState(next) {
    this.state = next;
  }

  /**
   * @param {'menu' | 'playing' | 'levelComplete' | 'marbleDead' | 'runGameOver'} s
   */
  is(s) {
    return this.state === s;
  }
}
