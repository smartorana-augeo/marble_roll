import { GameplaySettings } from '../config/GameplaySettings.js';
import { createProcgenRng } from './procgenRng.js';

/**
 * @param {number} ex
 * @param {number} ez
 * @param {number} endR
 * @param {number} x
 * @param {number} z
 */
function outsideEndZone(ex, ez, endR, x, z) {
  return Math.hypot(x - ex, z - ez) >= endR;
}

/**
 * Places collectible coins on solid path tiles, some raised for jump collects,
 * and some centred in horizontal gap jumps (between consecutive deck slabs).
 *
 * @param {object[]} staticEntries
 * @param {{ position: number[], radius: number }} endZone
 * @param {number} levelIndex
 * @param {number} turtleStep  Forward step used by the turtle (world units).
 * @returns {{ id: string, position: [number, number, number] }[]}
 */
export function placeCoinsOnPath(staticEntries, endZone, levelIndex, turtleStep) {
  const cfg = GameplaySettings.procgen.coins;
  const rng = createProcgenRng(levelIndex, 'coins_v1');
  const rngGap = createProcgenRng(levelIndex, 'coins_gaps_v1');

  const ex = endZone.position[0];
  const ez = endZone.position[2];
  const endR = endZone.radius + cfg.endZoneMargin;

  const gapMinD = turtleStep * cfg.gapMinDistFactor;
  const gapMaxD = turtleStep * cfg.gapMaxDistFactor;
  const gapDyMax = cfg.gapMaxDeckDeltaY ?? 0.32;

  /** @type {{ mx: number, mz: number, y: number }[]} */
  const gapSites = [];
  for (let i = 0; i < staticEntries.length - 1; i++) {
    const a = staticEntries[i];
    const b = staticEntries[i + 1];
    if (a.type !== 'box' || b.type !== 'box') continue;
    if (a.collision === false || b.collision === false) continue;

    const d = Math.hypot(
      b.position[0] - a.position[0],
      b.position[2] - a.position[2],
    );
    if (d < gapMinD || d > gapMaxD) continue;

    const dy = Math.abs(b.position[1] - a.position[1]);
    if (dy > gapDyMax) continue;

    const mx = (a.position[0] + b.position[0]) / 2;
    const mz = (a.position[2] + b.position[2]) / 2;
    if (!outsideEndZone(ex, ez, endR, mx, mz)) continue;

    const topA = a.position[1] + a.halfExtents[1];
    const topB = b.position[1] + b.halfExtents[1];
    const y = Math.max(topA, topB) + cfg.hoverY + (cfg.gapHoverBonus ?? 0);
    gapSites.push({ mx, mz, y });
  }

  /** @type {{ index: number, entry: object }[]} */
  const eligible = [];

  for (let i = 0; i < staticEntries.length; i++) {
    const e = staticEntries[i];
    if (e.type !== 'box') continue;
    if (e.collision === false) continue;
    if (i === 0) continue;

    const n = staticEntries.length;
    if (i >= n - cfg.tailSkip) continue;

    const [px, , pz] = e.position;
    if (!outsideEndZone(ex, ez, endR, px, pz)) continue;

    eligible.push({ index: i, entry: e });
  }

  const maxGapCoins = Math.min(
    cfg.gapCoinMax ?? 0,
    gapSites.length,
  );

  for (let i = gapSites.length - 1; i > 0; i--) {
    const j = Math.floor(rngGap() * (i + 1));
    const t = gapSites[i];
    gapSites[i] = gapSites[j];
    gapSites[j] = t;
  }
  const gapPicked = gapSites.slice(0, maxGapCoins);

  const slotsAfterGaps = Math.max(0, cfg.maxCount - gapPicked.length);
  const raw = Math.floor(eligible.length * cfg.density);
  let target = Math.max(
    cfg.minCount - gapPicked.length,
    Math.min(cfg.maxCount - gapPicked.length, raw),
  );
  target = Math.max(0, Math.min(target, slotsAfterGaps, eligible.length));

  let total = target + gapPicked.length;
  if (total < cfg.minCount && eligible.length > 0) {
    const need = cfg.minCount - total;
    const canAddPlatform = Math.min(need, eligible.length - target, cfg.maxCount - gapPicked.length - target);
    target += Math.max(0, canAddPlatform);
    total = target + gapPicked.length;
  }

  if (eligible.length === 0 && gapPicked.length === 0) return [];

  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = eligible[i];
    eligible[i] = eligible[j];
    eligible[j] = t;
  }

  const picked = eligible.slice(0, target).sort((a, b) => a.index - b.index);

  const raisedChance = cfg.raisedCoinChance ?? 0;
  const rMin = cfg.raisedMinY ?? 0.4;
  const rMax = cfg.raisedMaxY ?? 0.9;

  /** @type {{ id: string, position: [number, number, number] }[]} */
  const out = [];

  let k = 0;
  for (const item of picked) {
    const e = item.entry;
    const hy = e.halfExtents[1];
    const [px, py, pz] = e.position;
    let y = py + hy + cfg.hoverY;
    if (raisedChance > 0 && rng() < raisedChance) {
      y += rMin + rng() * Math.max(1e-6, rMax - rMin);
    }
    out.push({
      id: `coin_${levelIndex}_p${item.index}_${k}`,
      position: [px, y, pz],
    });
    k++;
  }

  for (let g = 0; g < gapPicked.length; g++) {
    const s = gapPicked[g];
    out.push({
      id: `coin_${levelIndex}_g${g}`,
      position: [s.mx, s.y, s.mz],
    });
  }

  return out;
}
