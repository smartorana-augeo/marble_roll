/**
 * Inserts two kinds of jump challenges before some forward tiles:
 * - **Gap jumps:** `j` only — advance one step with no tile (horizontal gap, same deck height).
 * - **Height jumps:** `^` or `v` only — next tile is one step forward at a higher or lower deck (no horizontal gap).
 *
 * Gap jumps require **`minFlatRunwayTilesBeforeGap`** consecutive **`F`** or **`G`** already emitted (same heading),
 * so the marble has straight deck to build speed.
 *
 * @param {string} spine
 * @param {number} levelIndex
 * @param {object} pg  `GameplaySettings.procgen`
 * @returns {{
 *   spine: string,
 *   jumpSplitCount: number,
 *   gapJumpCount: number,
 *   heightJumpCount: number,
 * }}
 */

export function injectJumpSplitsInSpine(spine, levelIndex, pg) {
  const j = pg.gridJumps ?? {};
  const firstSplitF = j.firstSplitF ?? 8;
  const spacingMin = j.spacingMin ?? 4;
  const spacingBase = j.spacingBase ?? 22;
  const spacingLevelCap = j.spacingLevelCap ?? 18;
  const spacingPerLevel = j.spacingPerLevel ?? 1;
  const maxSplitsCap = j.maxSplitsCap ?? 28;
  const maxSplitsBase = j.maxSplitsBase ?? 4;
  const maxSplitsPerLevel = j.maxSplitsPerLevel ?? 0.85;
  const gapSplitShare = Math.min(1, Math.max(0, j.gapSplitShare ?? 0.5));

  const spacing = Math.max(
    spacingMin,
    spacingBase - Math.min(levelIndex, spacingLevelCap) * spacingPerLevel,
  );
  const maxSplits = Math.min(
    maxSplitsCap,
    maxSplitsBase + Math.floor(levelIndex * maxSplitsPerLevel),
  );

  const maxGapSplits = Math.min(
    maxSplits,
    Math.max(0, Math.round(maxSplits * gapSplitShare)),
  );
  const maxHeightSplits = Math.max(0, maxSplits - maxGapSplits);
  const minRunway = Math.max(1, Math.floor(j.minFlatRunwayTilesBeforeGap ?? 2));

  let totalF = 0;
  for (let i = 0; i < spine.length; i++) {
    if (spine[i] === 'F') totalF++;
  }
  if (totalF < firstSplitF + 4) {
    return {
      spine,
      jumpSplitCount: 0,
      gapJumpCount: 0,
      heightJumpCount: 0,
    };
  }

  /** @type {string[]} */
  const parts = [];
  /** Trailing consecutive `F`/`G` count at end of built prefix (for gap runway). */
  let runway = 0;
  const push = (s) => {
    parts.push(s);
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      runway = ch === 'F' || ch === 'G' ? runway + 1 : 0;
    }
  };

  let fCount = 0;
  let gapSplits = 0;
  let heightSplits = 0;
  let lastSplitF = -9999;

  for (let i = 0; i < spine.length; i++) {
    const c = spine[i];
    if (c !== 'F') {
      push(c);
      continue;
    }
    fCount++;
    const nearEnd = fCount > totalF - 5;
    const gapOk = gapSplits < maxGapSplits;
    const heightOk = heightSplits < maxHeightSplits;
    const can =
      !nearEnd &&
      fCount >= firstSplitF &&
      fCount - lastSplitF >= spacing &&
      (gapOk || heightOk);

    if (can) {
      const h =
        (levelIndex * 1315423911 + fCount * 1103515245 + spine.length) >>> 0;
      const up = (h >> 3) % 2 === 0;

      let useGap;
      if (!heightOk) useGap = true;
      else if (!gapOk) useGap = false;
      else useGap = (h >> 5) % 2 === 0;

      const runwayOk = runway >= minRunway;

      /** @type {boolean} */
      let applied = false;
      if (useGap && runwayOk) {
        push('j');
        gapSplits++;
        applied = true;
      } else if (useGap && !runwayOk && heightOk) {
        push(up ? '^' : 'v');
        heightSplits++;
        applied = true;
      } else if (!useGap) {
        push(up ? '^' : 'v');
        heightSplits++;
        applied = true;
      }

      if (applied) {
        lastSplitF = fCount;
      }
    }
    push(c);
  }

  const jumpSplitCount = gapSplits + heightSplits;
  return {
    spine: parts.join(''),
    jumpSplitCount,
    gapJumpCount: gapSplits,
    heightJumpCount: heightSplits,
  };
}
