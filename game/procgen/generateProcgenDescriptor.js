/**
 * Procedural level descriptors from a **spine string** + turtle geometry (single main path).
 * Default spine: **Compton & Mateas–style** motif concatenation (`comptonRhythm.js`); optional
 * legacy **parallel L-system** via `GameplaySettings.procgen.useComptonRhythmLayer`.
 * After the turtle, a **connectivity audit** may append forward symbols and rebuild (capped).
 * Conceptual L-system reference: e.g. Hansmeyer — https://michael-hansmeyer.com/l-systems.html
 *
 * Pipeline: spine → budgets → preferRamps → level-map splices → turtle → (audit / repair) → …
 *
 * Documentation (under `marble_roll/gen/docs/`):
 * - **PROCEDURAL_L_SYSTEM_LEVELS.md** — normative pipeline and descriptor contract.
 * - **PROCEDURAL_DRUNKARD_GRID_SPEC.md** — grid drunkard-walk layout backend (`layoutBackend: 'gridDrunkard'`).
 * - **LEVEL_DESIGN_AND_PROCEDURE.md** — design methodology, skills, obstacles, agency (informs tuning).
 * - **THE_LADDER.md** — creative theme; future hazard ideas are evaluated against the level-design doc.
 */
import { expandLSystem } from './lSystemExpand.js';
import {
  GameplaySettings,
  procgenLSystemIterations,
  procgenTurtleStep,
} from '../config/GameplaySettings.js';
import { composeRhythmSpineString } from './comptonRhythm.js';
import { auditStaticPathGaps } from './connectivityAudit.js';
import {
  applyLevelMapSplices,
  countTurnSymbols,
  countVerticalMotionSymbols,
  ensureTurnBudget,
  ensureVerticalBudget,
  minTurnCountForLevel,
  minVerticalSymbolCountForLevel,
  preferRampsOverStepJumps,
} from './lSystemPostExpand.js';
import { turtleBuildPlatforms } from './lSystemTurtlePlatforms.js';
import { turtleBuildPlatforms2D } from './lSystemTurtlePlatforms2D.js';
import {
  applySegmentStyles,
  applyTrackOffset,
  computeKillPlaneY,
  computeTrackBaseY,
  placeObstacles,
  placeObstacles2D,
  widenPlatforms,
} from './postProcessProcgen.js';
import { buildSpineFromDrunkardGrid } from './gridSpinePipeline.js';

/** Marble radius matches PhysicsSystem default; pad is slightly wider than marble. */
const ZONE_RADIUS = 0.62;
const ZONE_SURFACE_Y = 0.04;

/**
 * Non-branching rule variants: one continuous **main forward path** (no `[` / `]`), winding like a
 * marble course via **`r`**, **`F`**, **`+`/`-`**, and optional **`^`** in the replacement.
 * @param {number} levelIndex
 * @returns {Record<string, string>}
 */
function spineRulesForLevel(levelIndex) {
  /**
   * Alternating **`+`** / **`-`** chunks so the plan view **weaves** left and right instead of
   * drifting in one direction (spiral). Each variant keeps **`r`** and **`F`** for length and ramps.
   */
  const variants = [
    { F: 'F+FrF-F+Fr' },
    { F: 'Fr-F+F+rF-F' },
    { F: 'F-F+rF+F+Fr' },
    { F: 'FF+rF-F+F' },
    { F: 'F+rF-F+FrF' },
    { F: 'Fr+F-FrF+F' },
    { F: 'F-F+FFr-F+F' },
    { F: 'F+Fr-F+F+rF' },
  ];
  return variants[levelIndex % variants.length];
}

/**
 * @param {number} levelIndex
 * @param {'3d'|'2d'} [mode='3d']  '2d' emits a Canvas 2D platform descriptor; '3d' (default) emits the standard 3D descriptor.
 * @returns {object} Level descriptor — shape depends on `mode`
 */
export function generateProcgenDescriptor(levelIndex, mode = '3d') {
  if (mode === '2d') return _generateProcgenDescriptor2D(levelIndex);
  return _generateProcgenDescriptor3D(levelIndex);
}

/**
 * 2D side-runner descriptor.
 * Pipeline: same spine + budget passes as 3D, but uses `turtleBuildPlatforms2D` and skips
 * 3D-specific post-processing (track offset, ramp orientation, kill-plane from 3D bounds).
 * **`layoutBackend: 'gridDrunkard'`** applies to **3D** only; 2D always uses the rhythm / L-system spine.
 * @param {number} levelIndex
 * @returns {{ id: string, displayName: string, platforms: object[], spawn: {x,y}, endX: number, killPlaneY: number }}
 */
function _generateProcgenDescriptor2D(levelIndex) {
  const rules = spineRulesForLevel(levelIndex);
  const iterations = procgenLSystemIterations(levelIndex);
  const pg = GameplaySettings.procgen;
  const pg2 = GameplaySettings.procgen2d;

  let core = pg.useComptonRhythmLayer
    ? composeRhythmSpineString(levelIndex)
    : expandLSystem('F', rules, iterations, { maxLength: pg.legacyLSystemMaxLength });

  let e = core;
  e = ensureTurnBudget(e, levelIndex);
  e = ensureVerticalBudget(e, levelIndex);
  e = preferRampsOverStepJumps(e, levelIndex);

  const built = turtleBuildPlatforms2D(e, {
    tileW: pg2.tileW,
    tileH: pg2.tileH,
    gapW: pg2.gapW,
    verticalStep: pg2.verticalStep,
    baselineY: pg2.baselineY,
  });

  const platforms = placeObstacles2D(built.platforms, levelIndex);
  const killPlaneY = pg2.baselineY + pg2.killPlanePadding;

  return {
    id: `procgen2d_${levelIndex}`,
    displayName: String(levelIndex + 1),
    platforms,
    spawn: built.spawn,
    endX: built.endX,
    killPlaneY,
  };
}

/**
 * Original 3D descriptor (unchanged logic, extracted to named function).
 * @param {number} levelIndex
 * @returns {object}
 */
function _generateProcgenDescriptor3D(levelIndex) {
  const rules = spineRulesForLevel(levelIndex);
  const iterations = procgenLSystemIterations(levelIndex);
  /** Wider turn angle so left/right segments read clearly in plan view (≈38–58°). */
  const angleDeg = 38 + (levelIndex % 6) * 4;
  let angleRad = (angleDeg * Math.PI) / 180;
  const step = procgenTurtleStep(levelIndex);
  const pg = GameplaySettings.procgen;
  /** Rise per `^`; from `GameplaySettings.procgen.verticalStep` (PROCEDURAL §3.3). */
  const verticalStep = pg.verticalStep;
  /** Splice vertical budget; from `GameplaySettings.procgen.jumpClearance` (§3.7). */
  const jumpClearance = pg.jumpClearance;

  const useGrid = pg.layoutBackend === 'gridDrunkard';
  /** @type {ReturnType<typeof buildSpineFromDrunkardGrid> | null} */
  let gridBundle = null;

  let core;
  if (useGrid) {
    gridBundle = buildSpineFromDrunkardGrid(levelIndex, pg);
    core = gridBundle.spine;
    angleRad = gridBundle.angleRad;
  } else {
    core = pg.useComptonRhythmLayer
      ? composeRhythmSpineString(levelIndex)
      : expandLSystem('F', rules, iterations, { maxLength: pg.legacyLSystemMaxLength });
  }

  const maxRepair = pg.comptonRhythmRepairMaxPasses;
  let repairPasses = 0;
  /** @type {string} */
  let expanded;
  /** @type {string} */
  let beforeSplices;
  /** @type {ReturnType<typeof turtleBuildPlatforms>} */
  let built;
  let lastAudit = { ok: true, maxGapXZ: 0, failIndex: -1 };

  const skipHeavy = useGrid && pg.gridSkipHeavyPostExpand !== false;

  while (true) {
    let e = core;
    if (skipHeavy) {
      e = preferRampsOverStepJumps(e, levelIndex);
    } else {
      e = ensureTurnBudget(e, levelIndex);
      e = ensureVerticalBudget(e, levelIndex);
      e = preferRampsOverStepJumps(e, levelIndex);
    }
    beforeSplices = e;
    e = skipHeavy ? e : applyLevelMapSplices(e, levelIndex, verticalStep, jumpClearance);
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
      angleDeg: useGrid ? (angleRad * 180) / Math.PI : angleDeg,
      step,
      verticalStep,
      jumpClearance,
      mainPathSpine: true,
      layoutBackend: useGrid ? 'gridDrunkard' : 'legacyRhythm',
      grid: useGrid && gridBundle
        ? {
            width: gridBundle.layout.width,
            height: gridBundle.layout.height,
            roomsPlaced: gridBundle.layout.meta.roomsPlaced,
            branchCarveSteps: gridBundle.layout.meta.branchCarveSteps,
            mainSteps: gridBundle.spec.mainSteps,
            gridAttempts: gridBundle.gridAttempts,
            pathCells: gridBundle.plan.main.length,
            maxDist: gridBundle.plan.maxDist,
            goalCell: gridBundle.plan.goalCell,
            skipHeavyPostExpand: skipHeavy,
          }
        : undefined,
      comptonRhythm: useGrid ? false : pg.useComptonRhythmLayer,
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
