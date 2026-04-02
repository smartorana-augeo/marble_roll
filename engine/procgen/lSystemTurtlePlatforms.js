/**
 * Interprets an L-system string as a 2.5D turtle: `F`/`G` lay flat tiles, `r` lays a sloped ramp
 * (rise + forward), `^` / `v` adjust deck height, `j` forward gap (no tile), `+` / `-` turn, `[` / `]` branch.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (§4–5); **LEVEL_DESIGN_AND_PROCEDURE.md** (§3 affordances, §7 traversal).
 */
import { buildRampBox } from './rampOrientation.js';

/**
 * @param {string} str
 * @param {{
 *   step: number,
 *   angleRad: number,
 *   verticalStep: number,
 *   platformHalfExtentXZ: number,
 *   platformHalfExtentY: number,
 *   zoneRadius: number,
 *   zoneSurfaceY: number,
 * }} params
 */
export function turtleBuildPlatforms(str, params) {
  const {
    step,
    angleRad,
    verticalStep,
    platformHalfExtentXZ: hw,
    platformHalfExtentY: hy,
    zoneRadius,
    zoneSurfaceY,
  } = params;

  let x = 0;
  let z = 0;
  let yaw = 0;
  let y = -hy;
  const baselineY = -hy;
  /** @type {{ x: number, z: number, yaw: number, y: number }[]} */
  const stack = [];

  /** @type {object[]} */
  const staticEntries = [];

  staticEntries.push({
    type: 'box',
    halfExtents: [hw, hy, hw],
    position: [0, -hy, 0],
    quaternion: [0, 0, 0, 1],
    materialKey: 'plaza',
  });

  let minY = -2 * hy;
  let maxX = hw;
  let minX = -hw;
  let maxZ = hw;
  let minZ = -hw;

  const trackBounds = (px, pz, halfW = hw) => {
    minX = Math.min(minX, px - halfW);
    maxX = Math.max(maxX, px + halfW);
    minZ = Math.min(minZ, pz - halfW);
    maxZ = Math.max(maxZ, pz + halfW);
  };

  trackBounds(0, 0);

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    switch (c) {
      case 'j': {
        x += step * Math.sin(yaw);
        z += step * Math.cos(yaw);
        trackBounds(x, z);
        break;
      }
      case 'F':
      case 'G':
        x += step * Math.sin(yaw);
        z += step * Math.cos(yaw);
        staticEntries.push({
          type: 'box',
          halfExtents: [hw, hy, hw],
          position: [x, y, z],
          quaternion: [0, 0, 0, 1],
          materialKey: 'path',
        });
        minY = Math.min(minY, y - hy);
        trackBounds(x, z);
        break;
      case 'r': {
        const dx = step * Math.sin(yaw);
        const dz = step * Math.cos(yaw);
        const dy = verticalStep;
        const ramp = buildRampBox({ hw, hy, x, y, z, dx, dy, dz, yaw });
        staticEntries.push({
          type: 'box',
          halfExtents: ramp.halfExtents,
          position: ramp.position,
          quaternion: ramp.quaternion,
          materialKey: 'ramp',
        });
        minY = Math.min(minY, ramp.minYBottom);
        x += dx;
        z += dz;
        y += dy;
        trackBounds(x, z, Math.max(hw, ramp.halfExtents[2]));
        break;
      }
      case '^':
        y += verticalStep;
        break;
      case 'v':
        y = Math.max(baselineY, y - verticalStep);
        break;
      case '+':
        yaw += angleRad;
        break;
      case '-':
        yaw -= angleRad;
        break;
      case '[':
        stack.push({ x, z, yaw, y });
        break;
      case ']': {
        const p = stack.pop();
        if (p) { x = p.x; z = p.z; yaw = p.yaw; y = p.y; }
        break;
      }
      default:
        break;
    }
  }

  const startZone = { position: [0, zoneSurfaceY, 0], radius: zoneRadius };
  const endSurfaceY = y + hy;
  const endZone = { position: [x, endSurfaceY, z], radius: zoneRadius };

  return {
    static: staticEntries,
    startZone,
    endZone,
    lastPosition: [x, z],
    bounds: { minX, maxX, minZ, maxZ, minY },
  };
}
