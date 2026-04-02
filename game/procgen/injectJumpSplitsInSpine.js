/**
 * Inserts forward **gaps** (`j` — advance one step without a tile) and small **deck shifts** (`^` / `v`)
 * before some forward tiles so the course gains jumpable breaks. More frequent on higher `levelIndex`.
 *
 * @param {string} spine
 * @param {number} levelIndex
 * @param {object} pg  `GameplaySettings.procgen`
 * @returns {{ spine: string, jumpSplitCount: number }}
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

  const spacing = Math.max(
    spacingMin,
    spacingBase - Math.min(levelIndex, spacingLevelCap) * spacingPerLevel,
  );
  const maxSplits = Math.min(
    maxSplitsCap,
    maxSplitsBase + Math.floor(levelIndex * maxSplitsPerLevel),
  );

  let totalF = 0;
  for (let i = 0; i < spine.length; i++) {
    if (spine[i] === 'F') totalF++;
  }
  if (totalF < firstSplitF + 4) {
    return { spine, jumpSplitCount: 0 };
  }

  let out = '';
  let fCount = 0;
  let splits = 0;
  let lastSplitF = -9999;

  for (let i = 0; i < spine.length; i++) {
    const c = spine[i];
    if (c !== 'F') {
      out += c;
      continue;
    }
    fCount++;
    const nearEnd = fCount > totalF - 5;
    const can =
      !nearEnd &&
      fCount >= firstSplitF &&
      fCount - lastSplitF >= spacing &&
      splits < maxSplits;

    if (can) {
      const h = (levelIndex * 1315423911 + fCount * 1103515245 + spine.length) >>> 0;
      const up = (h >> 3) % 2 === 0;
      out += up ? '^j' : 'vj';
      lastSplitF = fCount;
      splits++;
    }
    out += c;
  }

  return { spine: out, jumpSplitCount: splits };
}
