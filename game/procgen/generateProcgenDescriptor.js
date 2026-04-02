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
import { injectJumpSplitsInSpine } from './injectJumpSplitsInSpine.js';
import { placeCoinsOnPath } from './placeCoins.js';

/** Marble radius matches PhysicsSystem default; pad is slightly wider than marble. */
const ZONE_RADIUS = 0.62;
const ZONE_SURFACE_Y = 0.04;

/**
 * Weights for {@link generateProcgenDescriptor} `onProgress.fraction` (sum = 1).
 * Tunable without changing GameApplication’s global bar mapping.
 */
const PG_W_GRID = 0.15;
const PG_W_INJECT = 0.1;
const PG_W_TURTLE = 0.5;
const PG_W_POST = 0.2;
const PG_W_COINS = 0.05;

const PHASE_LABELS = {
  grid: 'Laying out course…',
  inject: 'Placing jumps…',
  turtle: 'Building path geometry…',
  post: 'Styling track…',
  coins: 'Placing collectibles…',
};

/**
 * @typedef {object} GenerateProcgenProgressInfo
 * @property {string} phase
 * @property {number} fraction Overall procgen completion 0–1.
 * @property {string} label Human-readable line for the load screen.
 */

/**
 * @typedef {object} GenerateProcgenOptions
 * @property {(info: GenerateProcgenProgressInfo) => void} [onProgress]
 * @property {() => Promise<void>} [yieldForUi]
 */

/**
 * @param {GenerateProcgenOptions | undefined} options
 * @param {string} phase
 * @param {number} fraction
 */
async function emitProcgenProgress(options, phase, fraction) {
  options?.onProgress?.({
    phase,
    fraction,
    label: PHASE_LABELS[phase] ?? phase,
  });
  if (options?.yieldForUi) await options.yieldForUi();
}

/**
 * @param {number} levelIndex
 * @param {GenerateProcgenOptions} [options]
 * @returns {Promise<object>} Level descriptor for `LevelLoader.build`
 */
export async function generateProcgenDescriptor(levelIndex, options = undefined) {
  // Yield before any heavy sync work so the load screen can paint and show phase text.
  await emitProcgenProgress(options, 'grid', 0);

  const iterations = procgenLSystemIterations(levelIndex);
  const step = procgenTurtleStep(levelIndex);
  const pg = GameplaySettings.procgen;
  const verticalStep = pg.verticalStep;
  const jumpClearance = pg.jumpClearance;

  const gridBundle = buildSpineFromDrunkardGrid(levelIndex, pg);
  await emitProcgenProgress(options, 'grid', PG_W_GRID);

  let core = gridBundle.spine;
  const injected = injectJumpSplitsInSpine(core, levelIndex, pg);
  core = injected.spine;
  const angleRad = gridBundle.angleRad;
  await emitProcgenProgress(options, 'inject', PG_W_GRID + PG_W_INJECT);

  const maxRepair = pg.comptonRhythmRepairMaxPasses;
  let repairPasses = 0;
  /** @type {string} */
  let expanded;
  /** @type {string} */
  let beforeSplices;
  /** @type {ReturnType<typeof turtleBuildPlatforms>} */
  let built;
  let lastAudit = { ok: true, maxGapXZ: 0, failIndex: -1 };

  const maxTurtleIters = maxRepair + 1;
  let turtleIter = 0;

  const tTurtle0 = performance.now();
  while (true) {
    let e = preferRampsOverStepJumps(core, levelIndex, pg);
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
    turtleIter += 1;
    const turtleFrac =
      PG_W_GRID +
      PG_W_INJECT +
      PG_W_TURTLE * (turtleIter / maxTurtleIters);
    await emitProcgenProgress(
      options,
      'turtle',
      Math.min(turtleFrac, PG_W_GRID + PG_W_INJECT + PG_W_TURTLE),
    );
    if (lastAudit.ok || repairPasses >= maxRepair) {
      expanded = e;
      break;
    }
    core += 'F'.repeat(2 + repairPasses);
    repairPasses++;
  }
  await emitProcgenProgress(
    options,
    'turtle',
    PG_W_GRID + PG_W_INJECT + PG_W_TURTLE,
  );

  const stepsPerSplice = Math.max(
    2,
    Math.min(8, Math.round(jumpClearance / Math.max(verticalStep, 1e-6))),
  );
  const spliceInsertChars = expanded.length - beforeSplices.length;
  const spliceSiteCount =
    levelIndex > 0 && stepsPerSplice > 0
      ? Math.round(spliceInsertChars / stepsPerSplice)
      : 0;

  const tPost0 = performance.now();
  await emitProcgenProgress(
    options,
    'post',
    PG_W_GRID + PG_W_INJECT + PG_W_TURTLE + PG_W_POST * 0.45,
  );

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
  await emitProcgenProgress(
    options,
    'post',
    PG_W_GRID + PG_W_INJECT + PG_W_TURTLE + PG_W_POST,
  );

  const coins = placeCoinsOnPath(offset.static, offset.zones.end, levelIndex, step);
  await emitProcgenProgress(options, 'coins', 1);

  const displayName = String(levelIndex + 1);

  return {
    id: `procgen_${levelIndex}`,
    displayName,
    spawn: offset.spawn,
    static: offset.static,
    zones: offset.zones,
    coins,
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
        jumpSplits: injected.jumpSplitCount,
        gapJumps: injected.gapJumpCount,
        heightJumps: injected.heightJumpCount,
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
