/**
 * Procedural level descriptors: **drunkard grid** spine → turtle geometry (single main path).
 * After the turtle, a **connectivity audit** may append forward symbols and rebuild (capped).
 *
 * Documentation (under `marble_roll/gen/docs/`):
 * - **PROCEDURAL_L_SYSTEM_LEVELS.md** — turtle alphabet, descriptor contract.
 * - **PROCEDURAL_DRUNKARD_GRID_SPEC.md** — grid layout pipeline.
 * - **LEVEL_DESIGN_AND_PROCEDURE.md** — design methodology, affordances.
 * - **THE_LADDER.md** — creative theme.
 */
import {
  GameplaySettings,
  procgenLSystemIterations,
  procgenTurtleStep,
} from '../config/GameplaySettings.js';
import { auditStaticPathGaps } from './connectivityAudit.js';
import {
  countTurnSymbols,
  countVerticalMotionSymbols,
  minTurnCountForLevel,
  minVerticalSymbolCountForLevel,
  preferRampsOverStepJumps,
} from './lSystemPostExpand.js';
import { turtleBuildPlatforms } from './lSystemTurtlePlatforms.js';
import {
  applySegmentStyles,
  applyTrackOffset,
  computeKillPlaneY,
  computeTrackBaseY,
  placeObstacles,
  widenPlatforms,
} from './postProcessProcgen.js';
import { buildSpineFromDrunkardGrid } from './gridSpinePipeline.js';

/** Marble radius matches PhysicsSystem default; pad is slightly wider than marble. */
const ZONE_RADIUS = 0.62;
const ZONE_SURFACE_Y = 0.04;

/**
 * @param {number} levelIndex
 * @returns {object} Level descriptor for `LevelLoader.build`
 */
export function generateProcgenDescriptor(levelIndex) {
  const iterations = procgenLSystemIterations(levelIndex);
  const step = procgenTurtleStep(levelIndex);
  const pg = GameplaySettings.procgen;
  const verticalStep = pg.verticalStep;
  const jumpClearance = pg.jumpClearance;

  const gridBundle = buildSpineFromDrunkardGrid(levelIndex, pg);
  let core = gridBundle.spine;
  const angleRad = gridBundle.angleRad;

  const maxRepair = pg.comptonRhythmRepairMaxPasses;
  let repairPasses = 0;
  /** @type {string} */
  let expanded;
  /** @type {string} */
  let beforeSplices;
  /** @type {ReturnType<typeof turtleBuildPlatforms>} */
  let built;
  let lastAudit = { ok: true, maxGapXZ: 0, failIndex: -1 };

  while (true) {
    let e = preferRampsOverStepJumps(core, levelIndex);
    beforeSplices = e;
    built = turtleBuildPlatforms(e, {
      step,
      angleRad,
      verticalStep,
      platformHalfExtentXZ: pg.platformHalfExtentXZ,
      platformHalfExtentY: pg.platformHalfExtentY,
      zoneRadius: ZONE_RADIUS,
      zoneSurfaceY: ZONE_SURFACE_Y,
    });
    lastAudit = auditStaticPathGaps(built.static, step, pg.connectivityMaxGapFactor);
    if (lastAudit.ok || repairPasses >= maxRepair) {
      expanded = e;
      break;
    }
    core += 'F'.repeat(2 + repairPasses);
    repairPasses++;
  }

  const stepsPerSplice = Math.max(
    2,
    Math.min(8, Math.round(jumpClearance / Math.max(verticalStep, 1e-6))),
  );
  const spliceInsertChars = expanded.length - beforeSplices.length;
  const spliceSiteCount =
    levelIndex > 0 && stepsPerSplice > 0
      ? Math.round(spliceInsertChars / stepsPerSplice)
      : 0;

  let staticEntries = widenPlatforms(built.static, levelIndex);
  staticEntries = applySegmentStyles(staticEntries, levelIndex);
  const obstacleResult = placeObstacles(staticEntries, levelIndex, beforeSplices.length);
  staticEntries = obstacleResult.static;

  const trackBaseY = computeTrackBaseY(levelIndex);
  const marbleLift = 0.55;
  const offset = applyTrackOffset(
    staticEntries,
    built.startZone,
    built.endZone,
    [0, marbleLift, 0],
    trackBaseY,
  );

  const killPlaneY = computeKillPlaneY(offset.static);

  const displayName = String(levelIndex + 1);

  return {
    id: `procgen_${levelIndex}`,
    displayName,
    spawn: offset.spawn,
    static: offset.static,
    zones: offset.zones,
    killPlaneY,
    trackBaseY,
    procgenMeta: {
      iterations,
      angleDeg: (angleRad * 180) / Math.PI,
      step,
      verticalStep,
      jumpClearance,
      mainPathSpine: true,
      grid: {
        width: gridBundle.layout.width,
        height: gridBundle.layout.height,
        roomsPlaced: gridBundle.layout.meta.roomsPlaced,
        branchCarveSteps: gridBundle.layout.meta.branchCarveSteps,
        mainSteps: gridBundle.spec.mainSteps,
        gridAttempts: gridBundle.gridAttempts,
        pathCells: gridBundle.plan.main.length,
        maxDist: gridBundle.plan.maxDist,
        goalCell: gridBundle.plan.goalCell,
      },
      rhythmRepairPasses: repairPasses,
      connectivityOk: lastAudit.ok,
      maxGapXZ: lastAudit.maxGapXZ,
      connectivityMaxGapFactor: pg.connectivityMaxGapFactor,
      expandedLength: expanded.length,
      expandedLengthBeforeSplices: beforeSplices.length,
      spliceSiteCount,
      spliceVerticalStepsPerSite: levelIndex > 0 ? stepsPerSplice : 0,
      turnSymbolCount: countTurnSymbols(expanded),
      minTurnCount: minTurnCountForLevel(levelIndex),
      verticalSymbolCount: countVerticalMotionSymbols(expanded),
      minVerticalSymbolCount: minVerticalSymbolCountForLevel(levelIndex),
      obstacleSeeds: {
        latticeIndex: obstacleResult.meta.latticeIndex,
        gapIndex: obstacleResult.meta.gapIndex,
        obstacleCount: obstacleResult.meta.obstacleCount,
      },
    },
  };
}
