/**
 * Post-processing stages for procedural levels: widen, segment styles, obstacles, track offset, kill plane.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (§5, obstacles); **LEVEL_DESIGN_AND_PROCEDURE.md**
 * (§4 reference obstacles, §6 challenge knobs, §8 agency vs width); **THE_LADDER.md** (flavour hazards — roadmap).
 */
import {
  GameplaySettings,
  procgenMinPlatformHalfXZ,
  procgenPathHalfXZBase,
  procgenTurtleStep,
} from '../config/GameplaySettings.js';

const { minStaticCountForGap } = GameplaySettings.procgen;

/** Wide starting pad (world units, half-extent XZ). */
export const PLAZA_HALF_XZ = GameplaySettings.procgen.plazaHalfXZ;

/**
 * @param {object[]} staticEntries
 * @param {number} levelIndex
 * @returns {object[]}
 */
export function widenPlatforms(staticEntries, levelIndex) {
  const minXZ = procgenMinPlatformHalfXZ(levelIndex);
  return staticEntries.map((e) => {
    if (e.type !== 'box') return e;
    const [hx, hy, hz] = e.halfExtents;
    /** Ramps use local Z along the slope; only widen cross-path half-extent (X). */
    if (e.materialKey === 'ramp') {
      const nhx = Math.max(minXZ, hx);
      if (nhx === hx) return e;
      return { ...e, halfExtents: [nhx, hy, hz] };
    }
    const nhx = Math.max(minXZ, hx);
    const nhz = Math.max(minXZ, hz);
    if (nhx === hx && nhz === hz) return e;
    return { ...e, halfExtents: [nhx, hy, nhz] };
  });
}

/**
 * Deterministic path width and material tags (plaza / path / pathWide) for a floating-course look.
 * @param {object[]} staticEntries
 * @param {number} levelIndex
 * @returns {object[]}
 */
export function applySegmentStyles(staticEntries, levelIndex) {
  const p = GameplaySettings.procgen;
  const minXZ = procgenMinPlatformHalfXZ(levelIndex);
  const wideThreshold = procgenPathHalfXZBase(levelIndex) + p.pathWideOverBase;

  return staticEntries.map((e, i) => {
    if (e.type !== 'box') return e;
    const [hx, hy, hz] = e.halfExtents;

    if (e.materialKey === 'ramp') {
      const w = pathHalfXZ(levelIndex, i);
      const wx = clampPathHalfXZToTurtleStep(Math.max(minXZ, w), levelIndex);
      return { ...e, halfExtents: [wx, hy, hz] };
    }

    if (i === 0) {
      return {
        ...e,
        halfExtents: [PLAZA_HALF_XZ, hy, PLAZA_HALF_XZ],
        materialKey: 'plaza',
      };
    }

    const w = pathHalfXZ(levelIndex, i);
    const h2 = (levelIndex * 7919 + i * 13) >>> 0;
    const wide =
      h2 % 9 === 0 ? Math.min(p.pathWideCap, w + p.pathWideDelta) : w;
    const wideGrounded = Math.max(minXZ, wide);
    const wideClamped = clampPathHalfXZToTurtleStep(wideGrounded, levelIndex);
    const key = wide > wideThreshold ? 'pathWide' : 'path';
    return {
      ...e,
      halfExtents: [wideClamped, hy, wideClamped],
      materialKey: key,
    };
  });
}

/**
 * @param {number} levelIndex
 * @param {number} pathIndex
 * @returns {number}
 */
function pathHalfXZ(levelIndex, pathIndex) {
  const p = GameplaySettings.procgen;
  const base = procgenPathHalfXZBase(levelIndex);
  const h = (levelIndex * 1103515245 + pathIndex * 12345) >>> 0;
  const span = p.pathHalfXZSpanMin + (h % p.pathHalfXZSpanSteps) * p.pathHalfXZSpanStep;
  return base + span;
}

/**
 * Caps horizontal half-extent so consecutive slabs (centre spacing ≈ turtle step along straights) do not
 * stay narrower than the step — `factor === 0.5` makes edges flush; lower values leave a hairline gap.
 */
function clampPathHalfXZToTurtleStep(halfXZ, levelIndex) {
  const step = procgenTurtleStep(levelIndex);
  const f = GameplaySettings.procgen.pathHalfXZClampStepFactor ?? 0.5;
  return Math.min(halfXZ, step * f);
}

/**
 * Deterministic vertical shift for the whole rung (world units).
 * @param {number} levelIndex
 * @returns {number}
 */
export function computeTrackBaseY(levelIndex) {
  return (levelIndex % 5) * 0.35 - 0.7;
}

/**
 * @param {object[]} staticEntries
 * @param {{ position: number[], radius: number }} startZone
 * @param {{ position: number[], radius: number }} endZone
 * @param {[number, number, number]} spawnBase marble centre before vertical shift
 * @param {number} trackBaseY
 */
export function applyTrackOffset(staticEntries, startZone, endZone, spawnBase, trackBaseY) {
  const st = staticEntries.map((e) => {
    if (e.type !== 'box') return e;
    const p = /** @type {[number, number, number]} */ (e.position.slice());
    p[1] += trackBaseY;
    return { ...e, position: p };
  });

  const zones = {
    start: {
      radius: startZone.radius,
      position: [
        startZone.position[0],
        startZone.position[1] + trackBaseY,
        startZone.position[2],
      ],
    },
    end: {
      radius: endZone.radius,
      position: [
        endZone.position[0],
        endZone.position[1] + trackBaseY,
        endZone.position[2],
      ],
    },
  };

  const spawn = /** @type {[number, number, number]} */ ([
    spawnBase[0],
    spawnBase[1] + trackBaseY,
    spawnBase[2],
  ]);

  return { static: st, zones, spawn };
}

/**
 * Lowest underside of solid (colliding) tiles; lattice-only tiles still contribute mesh minY for fog.
 * @param {object[]} staticEntries
 * @returns {number}
 */
export function computeKillPlaneY(staticEntries) {
  let minY = Infinity;
  for (const e of staticEntries) {
    if (e.type !== 'box') continue;
    const hy = e.halfExtents[1];
    /** Axis-aligned slabs: world min Y is centre minus local half height. Ramps use local Z along the slope — see `buildRampBox` (`minYBottom = midY - hy - L/2`). */
    const bottom =
      e.materialKey === 'ramp'
        ? e.position[1] - hy - e.halfExtents[2]
        : e.position[1] - hy;
    minY = Math.min(minY, bottom);
  }
  return Number.isFinite(minY) ? minY - 4 : -20;
}

/**
 * Inserts 1–2 obstacles: optional jump gap (remove one tile), then a lattice tile (no collider).
 * PROCEDURAL §5.6: at least one and at most two sites; deterministic from `levelIndex` and spine length.
 * @param {object[]} staticEntries
 * @param {number} levelIndex
 * @param {number} expandedLength
 * @returns {{ static: object[], meta: { latticeIndex: number, gapIndex: number, obstacleCount: number } }}
 */
export function placeObstacles(staticEntries, levelIndex, expandedLength) {
  let arr = staticEntries.map((e) => ({ ...e }));
  const n = arr.length;
  /** @type {{ latticeIndex: number, gapIndex: number, obstacleCount: number }} */
  const meta = { latticeIndex: -1, gapIndex: -1, obstacleCount: 0 };

  if (n < 2) {
    return { static: arr, meta };
  }

  /** Two tiles only (e.g. degenerate string): lattice the path segment — §5.6 minimum one obstacle. */
  if (n === 2) {
    const latticeIdx = 1;
    arr = arr.map((e, i) =>
      i === latticeIdx ? { ...e, collision: false, lattice: true } : e,
    );
    meta.latticeIndex = latticeIdx;
    meta.obstacleCount = 1;
    return { static: arr, meta };
  }

  const hash = (levelIndex * 7919 + expandedLength * 31) >>> 0;
  const iMin = 1;
  const iMax = n - 2;

  const wantGap = n > minStaticCountForGap;
  if (wantGap) {
    const gapIdx = iMin + (hash % (iMax - iMin + 1));
    arr.splice(gapIdx, 1);
    meta.gapIndex = gapIdx;
    meta.obstacleCount += 1;
  }

  const n2 = arr.length;
  const iMin2 = 1;
  const iMax2 = n2 - 2;

  if (n2 === 2) {
    const latticeIdx = 1;
    arr = arr.map((e, i) =>
      i === latticeIdx ? { ...e, collision: false, lattice: true } : e,
    );
    meta.latticeIndex = latticeIdx;
    meta.obstacleCount += 1;
    return { static: arr, meta };
  }

  if (iMax2 >= iMin2) {
    const h2 = (hash >> 11) >>> 0;
    const latticeIdx = iMin2 + (h2 % (iMax2 - iMin2 + 1));
    arr = arr.map((e, i) =>
      i === latticeIdx ? { ...e, collision: false, lattice: true } : e,
    );
    meta.latticeIndex = latticeIdx;
    meta.obstacleCount += 1;
  }

  return { static: arr, meta };
}
