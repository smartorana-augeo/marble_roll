/**
 * Physics systems for both 3D (cannon-es) and 2D (AABB) game modes.
 * Engine layer — imports only external libraries and engine-internal modules.
 * Gravity for 2D is passed by the caller; no game-config imports.
 */
import { Body, RaycastResult, Sphere, Vec3, World } from 'cannon-es';
import { Player } from '../player/Player.js';

const FIXED_HZ = 60;
const FIXED_TIMESTEP = 1 / FIXED_HZ;

export class PhysicsSystem {
  constructor() {
    this.world = new World({
      gravity: new Vec3(0, -28, 0),
    });
    /** @type {import('cannon-es').Body | null} */
    this.marbleBody = null;
    /** Marble collision radius (world units); must match visual mesh. */
    this.marbleRadius = 0.5;

    this._groundRayResult = new RaycastResult();
    this._rayFrom = new Vec3();
    this._rayTo = new Vec3();
    this._jumpImpulse = new Vec3();

    /** @type {Player | null} */
    this._player2d = null;
  }

  // ─── 3D marble physics ────────────────────────────────────────────────────

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
      linearDamping: 0.08,
      angularDamping: 0.12,
      material: undefined,
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
    if (!this.marbleBody) return;
    this.marbleBody.velocity.set(0, 0, 0);
    this.marbleBody.angularVelocity.set(0, 0, 0);
    this.marbleBody.position.set(spawn[0], spawn[1], spawn[2]);
    this.marbleBody.quaternion.set(0, 0, 0, 1);
  }

  /**
   * @param {number} deltaSeconds
   */
  step(deltaSeconds) {
    this.world.step(FIXED_TIMESTEP, deltaSeconds, 3);
  }

  // ─── 2D side-runner physics ───────────────────────────────────────────────

  /** @type {Player | null} */
  get player() { return this._player2d; }

  /**
   * Create (or replace) the 2D player entity.
   * @param {number} x
   * @param {number} y  Bottom (feet) Y in world / canvas coordinates
   * @param {number} [width=24]
   * @param {number} [height=36]
   * @returns {Player}
   */
  createPlayer(x, y, width = 24, height = 36) {
    this._player2d = new Player(x, y, width, height);
    return this._player2d;
  }

  /**
   * Teleport the player to a spawn position and zero their velocity.
   * @param {number} x
   * @param {number} y
   */
  resetPlayer(x, y) {
    if (!this._player2d) return;
    this._player2d.x = x;
    this._player2d.y = y;
    this._player2d.vx = 0;
    this._player2d.vy = 0;
    this._player2d.grounded = false;
  }

  removePlayer() {
    this._player2d = null;
  }

  /**
   * Apply an upward jump impulse if the player is currently grounded.
   * @param {number} force  Initial vy to set (negative = upward in canvas coords)
   */
  applyJump(force) {
    if (!this._player2d?.grounded) return;
    this._player2d.vy = force;
    this._player2d.grounded = false;
  }

  /**
   * Advance 2D physics one frame: gravity, movement, AABB platform collisions.
   * @param {number} dt        Seconds
   * @param {Array<{x:number,y:number,w:number,h:number,collision?:boolean}>} platforms
   * @param {number} gravity   Acceleration in world px / s² (positive = downward)
   */
  step2D(dt, platforms, gravity) {
    const p = this._player2d;
    if (!p) return;

    p.vy += gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.grounded = false;

    for (const plat of platforms) {
      if (plat.collision === false) continue;
      this._resolveAABB(p, plat);
    }
  }

  /**
   * Resolve overlap between player and an axis-aligned platform rect.
   * @param {Player} player
   * @param {{x:number,y:number,w:number,h:number}} plat
   */
  _resolveAABB(player, plat) {
    const pr = player.right;
    const pl = player.left;
    const pt = player.top;
    const pb = player.bottom;

    const platR = plat.x + plat.w;
    const platT = plat.y;
    const platB = plat.y + plat.h;

    if (pr <= plat.x || pl >= platR || pb <= platT || pt >= platB) return;

    const overlapBottom = pb - platT;
    const overlapTop    = platB - pt;
    const overlapRight  = pr - plat.x;
    const overlapLeft   = platR - pl;

    const min = Math.min(overlapBottom, overlapTop, overlapRight, overlapLeft);

    if (min === overlapBottom && player.vy >= 0) {
      player.y = platT;
      player.vy = 0;
      player.grounded = true;
    } else if (min === overlapTop && player.vy < 0) {
      player.y = platB + player.height;
      player.vy = 0;
    } else if (min === overlapRight) {
      player.x = plat.x - player.width / 2;
      player.vx = 0;
    } else if (min === overlapLeft) {
      player.x = platR + player.width / 2;
      player.vx = 0;
    }
  }
}
