/**
 * 2D player entity for the side-scrolling game mode.
 * Coordinates: x = world horizontal, y = world vertical (canvas style — increases downward).
 * `y` is the bottom of the player (feet position).
 */
export class Player {
  /**
   * @param {number} x World centre X
   * @param {number} y World bottom Y (feet)
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 24;
    this.height = 36;
    /** True when the player is standing on a platform surface. */
    this.grounded = false;
  }

  get left()   { return this.x - this.width / 2; }
  get right()  { return this.x + this.width / 2; }
  get top()    { return this.y - this.height; }
  get bottom() { return this.y; }
}
