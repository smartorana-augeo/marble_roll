/**
 * Phase D: convert an ordered list of grid cells to a turtle spine (`F`, `+`, `−`).
 * Forward in the turtle matches **(sin(yaw), cos(yaw))** with yaw 0 → **+z**; grid **cy** maps to **z**.
 *
 * @param {{ cx: number, cy: number }[]} main
 * @param {number} angleRad  Turn per `+` / `−` (use **π/2** for grid cardinals).
 * @param {number} leadingFCount  Run-up `F` symbols after spawn plaza alignment.
 * @returns {string}
 */
export function mainPathToSpine(main, angleRad, leadingFCount) {
  const lead = Math.max(0, leadingFCount | 0);
  if (main.length < 2) {
    return 'F'.repeat(lead + 12);
  }

  /** @type {string[]} */
  const parts = [];
  if (lead > 0) parts.push('F'.repeat(lead));
  let currentYaw = 0;

  for (let i = 0; i < main.length - 1; i++) {
    const dcx = main[i + 1].cx - main[i].cx;
    const dcz = main[i + 1].cy - main[i].cy;
    if (dcx === 0 && dcz === 0) continue;

    const desired = Math.atan2(dcx, dcz);
    let delta = desired - currentYaw;
    delta = normalizeAngle(delta);

    const steps = Math.round(delta / angleRad);
    const n = Math.min(64, Math.abs(steps));
    if (n > 0) {
      const ch = steps >= 0 ? '+' : '-';
      parts.push(ch.repeat(n));
    }

    currentYaw = normalizeAngle(desired);
    parts.push('F');
  }

  return parts.join('');
}

/**
 * @param {number} a
 * @returns {number}
 */
function normalizeAngle(a) {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
