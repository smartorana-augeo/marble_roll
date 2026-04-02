/**
 * Drawable instance: transform + primitive kind + material key. Game code mutates fields; the renderer reads them each frame.
 */
export class SceneMesh {
  constructor() {
    this.position = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    /** Non-uniform scale applied before rotation (unit primitives). */
    this.scale = { x: 1, y: 1, z: 1 };
    /** Extra yaw (rad) for coin spin on top of quaternion. */
    this.eulerY = 0;
    this.visible = true;
    this.castShadow = true;
    this.receiveShadow = true;
    /**
     * `box` | `boxWire` | `sphereHi` | `sphereMed` | `sphereLow` | `cylinderCoin`
     * @type {string}
     */
    this.primitive = 'box';
    /**
     * Key into the renderer material palette.
     * @type {string}
     */
    this.materialKey = 'static';
  }
}
