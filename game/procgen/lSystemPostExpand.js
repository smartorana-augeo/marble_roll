/**
 * Deterministic post-expansion constraints on the L-system string.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (§§3.4–3.7); **LEVEL_DESIGN_AND_PROCEDURE.md**
 * (challenge, splices, affordances); **THE_LADDER.md** (theme — vertical / office motifs align with splices).
 */

import { procgenMinTurnCount, procgenMinVerticalSymbolCount } from '../config/GameplaySettings.js';

/**
 * @param {string} s
 * @returns {number}
 */
export function countTurnSymbols(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '+' || c === '-') n += 1;
  }
  return n;
}

/**
 * @param {string} s
 * @returns {number}
 */
export function countVerticalSymbols(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '^' || c === 'r') n += 1;
  }
  return n;
}

/**
 * Counts **`^`**, **`r`**, and **`v`** in the final string (includes splice-injected descent).
 * @param {string} s
 * @returns {number}
 */
export function countVerticalMotionSymbols(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '^' || c === 'r' || c === 'v') n += 1;
  }
  return n;
}

/**
 * @param {number} levelIndex
 * @returns {number}
 */
export function minTurnCountForLevel(levelIndex) {
  return procgenMinTurnCount(levelIndex);
}

/**
 * Minimum `^` + `r` symbols before splices (PROCEDURAL §3.5); delegated to GameplaySettings.
 * @param {number} levelIndex
 * @returns {number}
 */
export function minVerticalSymbolCountForLevel(levelIndex) {
  return procgenMinVerticalSymbolCount(levelIndex);
}

/**
 * Until the turn budget is met, appends **`+F-`** / **`-F+`** blocks (deterministic alternation).
 * Each block adds **two** turn symbols **and** forward motion so the tail **weaves** instead of
 * spinning in place (bare **`+`/`-`** only changed yaw at the end of the string).
 * @param {string} expanded
 * @param {number} levelIndex
 * @returns {string}
 */
export function ensureTurnBudget(expanded, levelIndex) {
  const min = minTurnCountForLevel(levelIndex);
  let s = expanded;
  if (countTurnSymbols(s) >= min) return s;
  const h = (levelIndex * 1315423911 + s.length) >>> 0;
  let guard = 0;
  while (countTurnSymbols(s) < min && guard < 8000) {
    s += (h + guard) % 2 === 0 ? '+F-' : '-F+';
    guard += 1;
  }
  return s;
}

/**
 * Appends **`r`** (ramp = rise + forward) so vertical budget is met with a sloped segment.
 * @param {string} expanded
 * @param {number} levelIndex
 * @returns {string}
 */
export function ensureVerticalBudget(expanded, levelIndex) {
  const min = minVerticalSymbolCountForLevel(levelIndex);
  let s = expanded;
  let n = countVerticalSymbols(s);
  if (n >= min) return s;
  const need = min - n;
  return s + 'r'.repeat(need);
}

/**
 * Prefer sloped **`r`** over **`^F`** (step + flat tile); rate from **`pg.stepUpRampConversionShare`**.
 * @param {string} expanded
 * @param {number} levelIndex
 * @param {{ stepUpRampConversionShare?: number } | null | undefined} [pg]  `GameplaySettings.procgen`; omit for legacy ≈2/3 ramp bias.
 * @returns {string}
 */
export function preferRampsOverStepJumps(expanded, levelIndex, pg) {
  const legacyRampShare = 2 / 3;
  const share = Math.min(
    1,
    Math.max(
      0,
      pg?.stepUpRampConversionShare ?? legacyRampShare,
    ),
  );
  /** @type {string[]} */
  const parts = [];
  const n = expanded.length;
  for (let i = 0; i < n; ) {
    if (expanded[i] === '^' && i + 1 < n && expanded[i + 1] === 'F') {
      const u =
        (((levelIndex * 1315423911 + i * 17 + n) >>> 0) % 1_000_001) /
        1_000_001;
      if (u < share) {
        parts.push('r');
        i += 2;
        continue;
      }
    }
    parts.push(expanded[i]);
    i += 1;
  }
  return parts.join('');
}

/**
 * After the **main spine** string is fixed, **splices** raise or lower everything **after** each
 * gap by roughly one jump’s vertical clearance (see `gen/docs/PROCEDURAL_L_SYSTEM_LEVELS.md`).
 * **Never runs for `levelIndex === 0`.**
 *
 * @param {string} expanded
 * @param {number} levelIndex
 * @param {number} verticalStep turtle rise per `^` / `v` / ramp dy
 * @param {number} jumpClearance target vertical offset per splice (world units)
 * @returns {string}
 */
export function applyLevelMapSplices(expanded, levelIndex, verticalStep, jumpClearance) {
  if (levelIndex < 1 || expanded.length < 24) return expanded;

  const stepsPerSplice = Math.max(
    2,
    Math.min(8, Math.round(jumpClearance / Math.max(verticalStep, 1e-6))),
  );

  /** @type {number[]} */
  const candidates = [];
  for (let i = 0; i < expanded.length; i++) {
    const c = expanded[i];
    if (c === 'F' || c === 'r') {
      const pos = i + 1;
      if (pos >= expanded.length * 0.12 && pos <= expanded.length * 0.88) {
        candidates.push(pos);
      }
    }
  }

  const maxSplices = Math.min(levelIndex, 10, Math.max(0, Math.floor(candidates.length / 2)));
  if (maxSplices < 1 || candidates.length === 0) return expanded;

  const positions = pickSplicePositions(candidates, maxSplices, levelIndex, expanded.length);
  if (positions.length === 0) return expanded;

  let s = expanded;
  for (let p = positions.length - 1; p >= 0; p--) {
    const pos = positions[p];
    const up = ((levelIndex * 1315423911 + pos * 17 + p * 31) >>> 0) % 2 === 0;
    const insert = up ? '^'.repeat(stepsPerSplice) : 'v'.repeat(stepsPerSplice);
    s = s.slice(0, pos) + insert + s.slice(pos);
  }
  return s;
}

/**
 * @param {number[]} candidates
 * @param {number} numSplices
 * @param {number} levelIndex
 * @param {number} strLen
 * @returns {number[]} ascending indices where each splice is inserted (substring before index)
 */
function pickSplicePositions(candidates, numSplices, levelIndex, strLen) {
  const uniq = [...new Set(candidates)].sort((a, b) => a - b);
  if (uniq.length === 0 || numSplices < 1) return [];

  const minDist = Math.max(14, Math.floor(strLen / (numSplices * 3 + 2)));
  const h = (levelIndex * 1315423911 + strLen) >>> 0;
  const order = [...uniq]
    .map((p, i) => ({ p, k: (h + i * 1103515245) >>> 0 }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.p);

  /** @type {number[]} */
  const picked = [];
  for (const p of order) {
    if (picked.length >= numSplices) break;
    if (picked.every((q) => Math.abs(p - q) >= minDist)) picked.push(p);
  }
  return picked.sort((a, b) => a - b);
}
