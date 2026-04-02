/**
 * Post-processing stages for procedural levels: widen, segment styles, obstacles, track offset, kill plane.
 * Engine layer — no game-config imports. All tuning values are passed by callers.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (§5, obstacles); **LEVEL_DESIGN_AND_PROCEDURE.md**
 * (§4 reference obstacles, §6 challenge knobs).
 */

/**
 * Enforce a minimum half-extent on platform tiles.
 * @param {object[]} staticEntries
 * @param {number}   minXZ  Precomputed minimum half-extent (from game config)
 * @returns {object[]}
 */
export function widenPlatforms(staticEntries, minXZ) {
  return staticEntries.map((e) => {
    if (e.type !== 'box') return e;
    const [hx, hy, hz] = e.halfExtents;
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
 * Deterministic path width and material tags (plaza / path / pathWide).
 *
 * @param {object[]} staticEntries
 * @param {number}   levelIndex
 * @param {{
 *   plazaHalfXZ:   number,
 *   baseHalfXZ:    number,
 *   wideThreshold: number,
 *   wideDelta:     number,
 *   wideCap:       number,
 *   spanMin:       number,
 *   spanSteps:     number,
 *   spanStep:      number,
 * }} styleConfig  All values precomputed from game config for this level
 * @returns {object[]}
 */
export function applySegmentStyles(staticEntries, levelIndex, styleConfig) {
  const { plazaHalfXZ, baseHalfXZ, wideThreshold, wideDelta, wideCap, spanMin, spanSteps, spanStep } = styleConfig;

  return staticEntries.map((e, i) => {
    if (e.type !== 'box') return e;
    const [, hy] = e.halfExtents;

    if (e.materialKey === 'ramp') {
      const w = _pathHalfXZ(levelIndex, i, baseHalfXZ, spanMin, spanSteps, spanStep);
      return { ...e, halfExtents: [Math.max(baseHalfXZ, w), hy, e.halfExtents[2]] };
    }

    if (i === 0) {
      return { ...e, halfExtents: [plazaHalfXZ, hy, plazaHalfXZ], materialKey: 'plaza' };
    }

    const w = _pathHalfXZ(levelIndex, i, baseHalfXZ, spanMin, spanSteps, spanStep);
    const h2 = (levelIndex * 7919 + i * 13) >>> 0;
    const wide = h2 % 9 === 0 ? Math.min(wideCap, w + wideDelta) : w;
    const key = wide > wideThreshold ? 'pathWide' : 'path';
    return { ...e, halfExtents: [wide, hy, wide], materialKey: key };
  });
}

/**
 * @param {number} levelIndex
 * @param {number} pathIndex
 * @param {number} baseHalfXZ
 * @param {number} spanMin
 * @param {number} spanSteps
 * @param {number} spanStep
 * @returns {number}
 */
function _pathHalfXZ(levelIndex, pathIndex, baseHalfXZ, spanMin, spanSteps, spanStep) {
  const h = (levelIndex * 1103515245 + pathIndex * 12345) >>> 0;
  const span = spanMin + (h % spanSteps) * spanStep;
  return baseHalfXZ + span;
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
 * @param {[number, number, number]} spawnBase
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
      position: [startZone.position[0], startZone.position[1] + trackBaseY, startZone.position[2]],
    },
    end: {
      radius: endZone.radius,
      position: [endZone.position[0], endZone.position[1] + trackBaseY, endZone.position[2]],
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
 * Lowest underside of solid tiles; used for kill plane calculation.
 * @param {object[]} staticEntries
 * @returns {number}
 */
export function computeKillPlaneY(staticEntries) {
  let minY = Infinity;
  for (const e of staticEntries) {
    if (e.type !== 'box') continue;
    const hy = e.halfExtents[1];
    const bottom = e.position[1] - hy;
    minY = Math.min(minY, bottom);
  }
  return Number.isFinite(minY) ? minY - 4 : -20;
}

/**
 * Inserts 1–2 obstacles into a 3D static-entry array: optional jump gap then a lattice tile.
 * @param {object[]} staticEntries
 * @param {number}   levelIndex
 * @param {number}   expandedLength
 * @param {number}   minStaticCountForGap  Minimum box count before a gap may be cut
 * @returns {{ static: object[], meta: { latticeIndex: number, gapIndex: number, obstacleCount: number } }}
 */
export function placeObstacles(staticEntries, levelIndex, expandedLength, minStaticCountForGap) {
  let arr = staticEntries.map((e) => ({ ...e }));
  const n = arr.length;
  const meta = { latticeIndex: -1, gapIndex: -1, obstacleCount: 0 };

  if (n < 2) return { static: arr, meta };

  if (n === 2) {
    arr = arr.map((e, i) => i === 1 ? { ...e, collision: false, lattice: true } : e);
    meta.latticeIndex = 1;
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
    arr = arr.map((e, i) => i === 1 ? { ...e, collision: false, lattice: true } : e);
    meta.latticeIndex = 1;
    meta.obstacleCount += 1;
    return { static: arr, meta };
  }

  if (iMax2 >= iMin2) {
    const h2 = (hash >> 11) >>> 0;
    const latticeIdx = iMin2 + (h2 % (iMax2 - iMin2 + 1));
    arr = arr.map((e, i) => i === latticeIdx ? { ...e, collision: false, lattice: true } : e);
    meta.latticeIndex = latticeIdx;
    meta.obstacleCount += 1;
  }

  return { static: arr, meta };
}
