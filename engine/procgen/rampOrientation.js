/**
 * Ramp box orientation helper for turtle-emitted segments.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (ramp geometry); **LEVEL_DESIGN_AND_PROCEDURE.md** (ramp + jump situations).
 */
import { quatFromEulerYXZ } from '../gfx/math/Quat.js';

/**
 * Builds a sloped box aligned with a horizontal step (dx, dz) and rise dy.
 * Local box: halfExtents [hw, hy, L/2] with local +Z along the slope direction.
 *
 * @param {{
 *   hw: number,
 *   hy: number,
 *   x: number,
 *   y: number,
 *   z: number,
 *   dx: number,
 *   dy: number,
 *   dz: number,
 *   yaw: number,
 * }} p
 * @returns {{
 *   position: [number, number, number],
 *   halfExtents: [number, number, number],
 *   quaternion: [number, number, number, number],
 *   minYBottom: number,
 * }}
 */
export function buildRampBox(p) {
  const { hw, hy, x, y, z, dx, dy, dz, yaw } = p;
  const hLen = Math.hypot(dx, dz);
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const midX = x + dx * 0.5;
  const midY = y + dy * 0.5;
  const midZ = z + dz * 0.5;
  const pitch = -Math.atan2(dy, hLen);
  const q = { x: 0, y: 0, z: 0, w: 1 };
  quatFromEulerYXZ(q, pitch, yaw, 0);
  /** Conservative underside for kill plane (slightly below true OBB minimum). */
  const minYBottom = midY - hy - L * 0.5;
  return {
    position: [midX, midY, midZ],
    halfExtents: [hw, hy, L * 0.5],
    quaternion: [q.x, q.y, q.z, q.w],
    minYBottom,
  };
}
