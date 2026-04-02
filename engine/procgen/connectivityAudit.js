/**
 * Connectivity audit: consecutive platform centres along the turtle path must not exceed a
 * horizontal gap derived from `step` (Compton & Mateas — fragile platform feasibility).
 */

/**
 * @param {object[]} staticEntries Turtle emission order (includes plaza, ramps, path tiles).
 * @param {number} step Turtle forward step (world units).
 * @param {number} maxGapFactor Max centre–centre distance on XZ is `step * maxGapFactor`.
 * @returns {{ ok: boolean, maxGapXZ: number, failIndex: number }}
 */
export function auditStaticPathGaps(staticEntries, step, maxGapFactor) {
  const maxD = step * maxGapFactor;
  let maxGapXZ = 0;
  for (let i = 0; i < staticEntries.length - 1; i++) {
    const a = staticEntries[i];
    const b = staticEntries[i + 1];
    if (a.type !== 'box' || b.type !== 'box') continue;
    const dx = b.position[0] - a.position[0];
    const dz = b.position[2] - a.position[2];
    const d = Math.hypot(dx, dz);
    if (d > maxGapXZ) maxGapXZ = d;
    if (d > maxD) {
      return { ok: false, maxGapXZ, failIndex: i };
    }
  }
  return { ok: true, maxGapXZ, failIndex: -1 };
}
