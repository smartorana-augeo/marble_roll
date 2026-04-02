/**
 * Orchestrates grid layout → main path → spine string for `generateProcgenDescriptor`.
 */
import { buildDrunkardGrid } from './drunkardGrid.js';
import { buildRoutePlan } from './gridTopology.js';
import { computeGridSpec } from './gridSpec.js';
import { mainPathToSpine } from './gridToSpine.js';
import { createProcgenRng } from './procgenRng.js';

/**
 * @param {number} levelIndex
 * @param {object} pg  `GameplaySettings.procgen`
 * @returns {{
 *   spine: string,
 *   layout: object,
 *   plan: object,
 *   spec: object,
 *   angleRad: number,
 *   gridAttempts: number,
 * }}
 */
export function buildSpineFromDrunkardGrid(levelIndex, pg) {
  const gt = pg.gridToSpine ?? {};
  const angleRad = gt.useRightAngle !== false ? Math.PI / 2 : ((38 + (levelIndex % 6) * 4) * Math.PI) / 180;
  const leadingFCount = gt.leadingFCount ?? 0;

  let spec = computeGridSpec(levelIndex, pg);
  let layout;
  let plan;
  let attempt = 0;
  const maxAttempts = Math.max(1, Math.floor(pg.grid?.maxBuildAttempts ?? 4));

  for (; attempt < maxAttempts; attempt++) {
    const rng = createProcgenRng(levelIndex, `drunkardGrid_${attempt}`);
    layout = buildDrunkardGrid(spec, rng);
    plan = buildRoutePlan(layout);
    if (plan.main.length >= 2) break;
    spec = { ...spec, mainSteps: Math.floor(spec.mainSteps * 1.2) + 20 };
  }

  const spine = mainPathToSpine(plan.main, angleRad, leadingFCount);

  return {
    spine,
    layout,
    plan,
    spec,
    angleRad,
    gridAttempts: attempt + 1,
  };
}
