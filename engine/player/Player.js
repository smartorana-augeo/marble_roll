/**
 * 2D player entity for the side-scrolling game mode.
 * Coordinates: x = world horizontal, y = world vertical (canvas style — increases downward).
 * `y` is the bottom of the player (feet position).
 */
export class Player {
  /**
   * @param {number} x World centre X
   * @param {number} y World bottom Y (feet)
   * @param {number} [width=24]
   * @param {number} [height=36]
   */
  constructor(x, y, width = 24, height = 36) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = width;
    this.height = height;
    /** True when the player is standing on a platform surface. */
    this.grounded = false;
  }

  get left()   { return this.x - this.width / 2; }
  get right()  { return this.x + this.width / 2; }
  get top()    { return this.y - this.height; }
  get bottom() { return this.y; }
}
