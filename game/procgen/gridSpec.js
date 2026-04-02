/**
 * Derives drunkard-grid parameters from `levelIndex` and `GameplaySettings.procgen.grid`.
 *
 * @param {number} levelIndex
 * @param {object} pg  `GameplaySettings.procgen`
 */
export function computeGridSpec(levelIndex, pg) {
  const g = pg.grid;
  const spanW = Math.max(0, g.widthMax - g.widthMin);
  const spanH = Math.max(0, g.heightMax - g.heightMin);
  const wBand = spanW > 0 ? (levelIndex * 17) % (spanW + 1) : 0;
  const hBand = spanH > 0 ? (levelIndex * 13) % (spanH + 1) : 0;
  const width = g.widthMin + wBand;
  const height = g.heightMin + hBand;
  const mainSteps =
    g.mainStepsBase + levelIndex * (g.mainStepsPerLevel ?? 0);

  return {
    width,
    height,
    mainSteps,
    pTurn: g.pTurn,
    pRoom: g.pRoom,
    roomPeriod: g.roomPeriod,
    pBranch: g.pBranch,
    roomHalfMin: g.roomHalfMin,
    roomHalfMax: g.roomHalfMax,
    roomUncarvedMinFraction: g.roomUncarvedMinFraction,
    branchStepsMax: g.branchStepsMax,
    edgeMargin: g.edgeMargin,
  };
}
