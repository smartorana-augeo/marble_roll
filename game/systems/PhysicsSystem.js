import { Body, RaycastResult, SAPBroadphase, Sphere, Vec3, World } from 'cannon-es';

const FIXED_HZ = 60;
const FIXED_TIMESTEP = 1 / FIXED_HZ;
/** Allow enough substeps when frames hitch (e.g. tab focus); low values leave time unsimulated → jitter. */
const MAX_SUB_STEPS = 10;

export class PhysicsSystem {
  constructor() {
    this.world = new World({
      gravity: new Vec3(0, -28, 0),
    });
    /** Sweep-and-prune scales better than naive O(n²) when many static boxes overlap the broadphase. */
    this.world.broadphase = new SAPBroadphase(this.world);
    /** Default 10; slightly fewer iterations per step lowers CPU with many contacts; marble stays stable. */
    this.world.solver.iterations = 8;
    /** @type {import('cannon-es').Body | null} */
    this.marbleBody = null;
    /** Marble collision radius (world units); must match visual mesh. */
    this.marbleRadius = 0.5;

    this._groundRayResult = new RaycastResult();
    this._rayFrom = new Vec3();
    this._rayTo = new Vec3();
    this._jumpImpulse = new Vec3();
  }

  /**
   * Short ray under the marble: grounded if we hit static geometry within reach (not the marble).
   * @returns {boolean}
   */
  isMarbleOnGround() {
    const body = this.marbleBody;
    if (!body) return false;
    const p = body.position;
    const r = this.marbleRadius;
    this._groundRayResult.reset();
    this._rayFrom.set(p.x, p.y - r - 0.06, p.z);
    this._rayTo.set(p.x, p.y - r - 2.2, p.z);
    const hit = this.world.raycastClosest(this._rayFrom, this._rayTo, {}, this._groundRayResult);
    if (!hit || !this._groundRayResult.hasHit) return false;
    if (this._groundRayResult.body === body) return false;
    return this._groundRayResult.distance >= 0 && this._groundRayResult.distance < 0.55;
  }

  /**
   * @param {number} impulseY
   * @returns {boolean} true if a jump was applied
   */
  applyMarbleJump(impulseY) {
    const body = this.marbleBody;
    if (!body || !this.isMarbleOnGround()) return false;
    this._jumpImpulse.set(0, impulseY, 0);
    body.applyImpulse(this._jumpImpulse);
    return true;
  }

  /**
   * @param {[number, number, number]} spawn
   * @returns {import('cannon-es').Body}
   */
  createMarble(spawn) {
    this.removeMarble();
    const shape = new Sphere(this.marbleRadius);
    const body = new Body({
      mass: 2,
      linearDamping: 0.065,
      angularDamping: 0.09,
      material: undefined,
      /** Player sphere should never sleep — avoids sluggish re-acceleration after braking. */
      allowSleep: false,
    });
    body.addShape(shape);
    body.position.set(spawn[0], spawn[1], spawn[2]);
    this.world.addBody(body);
    this.marbleBody = body;
    return body;
  }

  removeMarble() {
    if (this.marbleBody) {
      this.world.removeBody(this.marbleBody);
      this.marbleBody = null;
    }
  }

  /**
   * @param {[number, number, number]} spawn
   */
  resetMarble(spawn) {
    const b = this.marbleBody;
    if (!b) return;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.position.set(spawn[0], spawn[1], spawn[2]);
    b.quaternion.set(0, 0, 0, 1);
    /**
     * While `marbleDead`, `world.step` is not called — interpolation state stays at the fall pose.
     * Without syncing, `interpolatedPosition` can lerp between old previous and new spawn for several
     * frames (visible jitter). Match cannon-es `World.step` end-state for this body.
     */
    b.previousPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion);
    b.interpolatedPosition.copy(b.position);
    b.interpolatedQuaternion.copy(b.quaternion);
    /** Avoid fractional interpolation phase carrying across a long pause without `step`. */
    this.world.accumulator = 0;
  }

  /**
   * @param {number} deltaSeconds
   */
  step(deltaSeconds) {
    this.world.step(FIXED_TIMESTEP, deltaSeconds, MAX_SUB_STEPS);
  }
}
