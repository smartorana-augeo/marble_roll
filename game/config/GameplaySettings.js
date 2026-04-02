/**
 * Gameplay tuning: procedural geometry curves, difficulty-adjacent constants, and future
 * run-wide options. Import from procgen / systems — not from the HTML entry module.
 *
 * **`GameplaySettings.procgen`** is documented against:
 * - `gen/docs/PROCEDURAL_L_SYSTEM_LEVELS.md` — which constants feed the pipeline (iterations, widths, …).
 * - `gen/docs/LEVEL_DESIGN_AND_PROCEDURE.md` — §6 perceived challenge vs tunable dimensions.
 * - `gen/docs/THE_LADDER.md` — theme; rank-based difficulty is flavour until mechanics land.
 */

/**
 * @typedef {object} ProcgenGameplaySettings
 * @property {number} pathPlatformHalfXZFloor Late-level minimum half-extent on X/Z for path tiles (world units). Slightly under the legacy 1.2 norm.
 * @property {number} pathPlatformEarlyBonus Extra half-extent at low level indices; decays toward the floor.
 * @property {number} pathPlatformWidthDecayLevels Level index span over which early width bonus eases off (smoothstep).
 * @property {number} pathHalfXZSpanMin Deterministic per-tile span base (added to level base width).
 * @property {number} pathHalfXZSpanSteps Hash modulus for span steps.
 * @property {number} pathHalfXZSpanStep Width increment per span step.
 * @property {number} pathWideDelta Added to occasional tiles for a wider strip.
 * @property {number} pathWideCap Upper clamp for boosted wide tiles.
 * @property {number} pathWideOverBase Tiles wider than level base + this use `pathWide` material.
 * @property {number} plazaHalfXZ Spawn pad half-extent XZ (world units).
 * @property {number} lSystemIterationsLevel0 Expansion passes on rung 0 (string length grows exponentially — keep low).
 * @property {number} lSystemIterationsAfterLevel0 Passes from rung 1 until the first band step.
 * @property {number} lSystemIterationsEveryNLevels Add one pass every this many rungs (after 0).
 * @property {number} lSystemIterationsCap Upper bound on expansion passes.
 * @property {number} turtleStepBase World units per forward turtle step at rung 0.
 * @property {number} turtleStepPerLevel Extra step length per rung (small = gentler length growth).
 * @property {number} minTurnCountBase Minimum turn symbols before injection (floor for early rungs).
 * @property {number} minTurnCountLevelStride Add one to minimum every this many rungs.
 * @property {number} verticalStep Turtle rise per `^` / `v` / ramp `dy` (world units); see PROCEDURAL §3.3.
 * @property {number} jumpClearance Target vertical offset per splice site vs `verticalStep` (world units).
 * @property {number} platformHalfExtentXZ Turtle default half-width on X/Z before widen (world units).
 * @property {number} platformHalfExtentY Turtle default half-height on Y (world units).
 * @property {number} minVerticalSymbolLevelStride Divisor for §3.5 minimum `^`+`r` count before splices.
 * @property {number} minStaticCountForGap Minimum box count on path before a jump gap may be cut (exclusive: must be > this).
 * @property {number} connectivityMaxGapFactor Max horizontal centre–centre gap between consecutive path boxes vs turtle `step` (audit after turtle).
 * @property {number} comptonRhythmRepairMaxPasses When the audit fails, append forward symbols to the core and rebuild (capped).
 * @property {object} grid Drunkard-walk grid sizing and behaviour — see `gen/docs/PROCEDURAL_DRUNKARD_GRID_SPEC.md`.
 * @property {object} gridToSpine Emission: leading `F` run-up and **90°** turns for grid layouts.
 */

export const GameplaySettings = {
  /** Procedural level path width, presentation thresholds, and related tuning. */
  procgen: {
    pathPlatformHalfXZFloor: 1.08,
    /** At level 0, base half-width ≈ floor + bonus ≈ **2.1** (+ span) — ~2× prior early paths. */
    pathPlatformEarlyBonus: 1.02,
    pathPlatformWidthDecayLevels: 26,
    pathHalfXZSpanMin: 0.14,
    pathHalfXZSpanSteps: 6,
    pathHalfXZSpanStep: 0.05,
    pathWideDelta: 0.55,
    pathWideCap: 1.95,
    pathWideOverBase: 0.38,
    /** ~2× previous spawn pad half-extent for a roomier start. */
    plazaHalfXZ: 4.7,
    /** Rung 0: one rewrite keeps the tutorial course very short. */
    lSystemIterationsLevel0: 1,
    /** Rungs 1–3 use this; then one more pass every `lSystemIterationsEveryNLevels` rungs. */
    lSystemIterationsAfterLevel0: 2,
    lSystemIterationsEveryNLevels: 3,
    lSystemIterationsCap: 6,
    turtleStepBase: 2.05,
    turtleStepPerLevel: 0.04,
    minTurnCountBase: 3,
    minTurnCountLevelStride: 2,
    /** §3.5 / turtle — keep plausible vs jump impulse (mass ≈ 2). */
    verticalStep: 0.38,
    /** §3.7 splice depth — on the order of one marble jump vs `verticalStep`. */
    jumpClearance: 0.92,
    platformHalfExtentXZ: 1.05,
    platformHalfExtentY: 0.22,
    /** `max(1, 1 + floor(levelIndex / minVerticalSymbolLevelStride))` for `^`+`r` minimum before splices. */
    minVerticalSymbolLevelStride: 3,
    /** `placeObstacles`: require more than this many static boxes to insert a gap (see §5.6). */
    minStaticCountForGap: 5,
    /** Consecutive platform centres on XZ must stay within `step * connectivityMaxGapFactor`. */
    connectivityMaxGapFactor: 2.9,
    /** Append `F` runs to the core and rebuild until the audit passes or this cap is hit. */
    comptonRhythmRepairMaxPasses: 5,

    grid: {
      widthMin: 28,
      widthMax: 44,
      heightMin: 28,
      heightMax: 44,
      /** Probability of a 90° turn each main-walk step. */
      pTurn: 0.08,
      /** Probability of attempting a room carve after a corridor step (in addition to `roomPeriod`). */
      pRoom: 0.12,
      /** Attempt a room every this many steps (0 = period disabled). */
      roomPeriod: 6,
      /** After a room is placed, enqueue a branch seed with this probability. */
      pBranch: 0.55,
      /** Base corridor steps; scaled slightly with `levelIndex`. */
      mainStepsBase: 110,
      mainStepsPerLevel: 8,
      roomHalfMin: 2,
      roomHalfMax: 4,
      /** Minimum fraction of uncarved cells in a room rectangle for placement. */
      roomUncarvedMinFraction: 0.72,
      branchStepsMax: 28,
      /** Inbound margin so rooms stay away from the outer wall. */
      edgeMargin: 2,
    },

    gridToSpine: {
      /** Extra `F` symbols after initial yaw alignment (turtle already places a spawn plaza). */
      leadingFCount: 1,
      /** Use **π/2** rad per `+`/`−` so grid edges match cardinal moves. */
      useRightAngle: true,
    },
  },
};

/**
 * L-system rewrite depth; higher values multiply symbol count roughly like O(branching)^n.
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenLSystemIterations(levelIndex) {
  const p = GameplaySettings.procgen;
  if (levelIndex <= 0) return p.lSystemIterationsLevel0;
  const bands = Math.floor((levelIndex - 1) / p.lSystemIterationsEveryNLevels);
  return Math.min(p.lSystemIterationsAfterLevel0 + bands, p.lSystemIterationsCap);
}

/**
 * Turtle forward step (world units per `F` / ramp chord); grows slowly with rung.
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenTurtleStep(levelIndex) {
  const p = GameplaySettings.procgen;
  return p.turtleStepBase + levelIndex * p.turtleStepPerLevel;
}

/**
 * Minimum `+` / `-` count before deterministic turn injection (see lSystemPostExpand).
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenMinTurnCount(levelIndex) {
  const p = GameplaySettings.procgen;
  return p.minTurnCountBase + Math.floor(levelIndex / p.minTurnCountLevelStride);
}

/**
 * Minimum count of `^` plus `r` in the expanded string before splices (`ensureVerticalBudget`).
 * Matches PROCEDURAL_L_SYSTEM_LEVELS.md §3.5: `max(1, 1 + ⌊levelIndex / stride⌋)`.
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenMinVerticalSymbolCount(levelIndex) {
  const p = GameplaySettings.procgen;
  return Math.max(1, 1 + Math.floor(levelIndex / p.minVerticalSymbolLevelStride));
}

/**
 * Level-dependent path half-extent baseline (before per-tile span). Early levels are wider;
 * approaches {@link GameplaySettings.procgen.pathPlatformHalfXZFloor} as level index grows.
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenPathHalfXZBase(levelIndex) {
  const p = GameplaySettings.procgen;
  const t = Math.min(1, Math.max(0, levelIndex / p.pathPlatformWidthDecayLevels));
  const smooth = t * t * (3 - 2 * t);
  return p.pathPlatformHalfXZFloor + p.pathPlatformEarlyBonus * (1 - smooth);
}

/**
 * Minimum horizontal half-extent for path geometry on this rung (clamp for widen / ramps).
 * @param {number} levelIndex
 * @returns {number}
 */
export function procgenMinPlatformHalfXZ(levelIndex) {
  return procgenPathHalfXZBase(levelIndex);
}
