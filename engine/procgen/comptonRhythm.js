/**
 * Compton & Mateas-style rhythm layer: concatenate authored motifs (short turtle symbol runs)
 * instead of growing a single axiom by parallel L-system rewriting.
 * Engine layer — no game-config imports; iteration count is passed by the caller.
 *
 * See `gen/docs/PROCGEN_COMPTON_MATEAS.md`.
 */

/**
 * Terminal turtle symbols only — each motif is a repeatable "beat" (repetition + rhythm).
 */
export const MOTIF_LIBRARY = [
  'F+FrF-F+Fr',
  'Fr-F+F+rF-F',
  'F-F+rF+F+Fr',
  'FF+rF-F+F',
  'F+rF-F+FrF',
  'Fr+F-FrF+F',
  'F-F+FFr-F+F',
  'F+Fr-F+F+rF',
];

/**
 * Deterministic "measures": each measure appends two motifs; count scales with the supplied
 * iteration count so course length stays comparable to the legacy pipeline.
 *
 * @param {number} levelIndex
 * @param {number} iterations  Precomputed L-system iteration depth (from game config)
 * @returns {string} Turtle symbol string (no L-system expansion).
 */
export function composeRhythmSpineString(levelIndex, iterations) {
  const measures = Math.max(1, iterations + 2);
  let out = '';
  for (let m = 0; m < measures; m++) {
    const h  = (levelIndex * 1315423911 + m * 1103515245) >>> 0;
    const h2 = (h ^ 0xdeadbeef) >>> 0;
    out += MOTIF_LIBRARY[h  % MOTIF_LIBRARY.length];
    out += MOTIF_LIBRARY[h2 % MOTIF_LIBRARY.length];
  }
  return out;
}
