import { COIN_PICKUP_RADIUS } from '../level/CoinVisuals.js';

/**
 * Per-level coin pickup tests and optional idle spin on uncollected coins.
 */
export class CoinPickupRuntime {
  constructor() {
    /** @type {{ id: string, mesh: import('../../engine/gfx/SceneMesh.js').SceneMesh, collected: boolean }[]} */
    this._entries = [];
  }

  /**
   * @param {{ id: string, mesh: import('../../engine/gfx/SceneMesh.js').SceneMesh }[]} coinEntries
   */
  load(coinEntries) {
    this._entries = coinEntries.map((e) => ({
      id: e.id,
      mesh: e.mesh,
      collected: false,
    }));
  }

  clear() {
    this._entries = [];
  }

  resetLevel() {
    for (const e of this._entries) {
      e.collected = false;
      e.mesh.visible = true;
    }
  }

  /**
   * @param {import('cannon-es').Vec3} marblePos
   * @param {number} marbleRadius
   * @param {number} deltaSeconds
   * @returns {number} Newly collected count this frame.
   */
  update(marblePos, marbleRadius, deltaSeconds) {
    const rr = marbleRadius + COIN_PICKUP_RADIUS;
    const r2 = rr * rr;
    let picked = 0;

    for (const e of this._entries) {
      if (e.collected) continue;

      const m = e.mesh.position;
      const dx = marblePos.x - m.x;
      const dy = marblePos.y - m.y;
      const dz = marblePos.z - m.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        e.collected = true;
        e.mesh.visible = false;
        picked++;
      } else {
        e.mesh.eulerY += deltaSeconds * 2.4;
      }
    }

    return picked;
  }
}
