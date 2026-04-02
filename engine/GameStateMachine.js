/**
 * Tracks high-level game flow states (see gen/specs/SPEC.md §4).
 */
export class GameStateMachine {
  constructor() {
    /** @type {'menu' | 'playing' | 'levelComplete' | 'marbleDead'} */
    this.state = 'menu';
  }

  /**
   * @param {'menu' | 'playing' | 'levelComplete' | 'marbleDead'} next
   */
  setState(next) {
    this.state = next;
  }

  /**
   * @param {'menu' | 'playing' | 'levelComplete' | 'marbleDead'} s
   */
  is(s) {
    return this.state === s;
  }
}
