/**
 * Deterministic PRNG for procedural modules (Mulberry32).
 * Same `levelIndex` + `salt` → same stream.
 *
 * @param {number} levelIndex
 * @param {string} salt
 * @returns {() => number} Function returning values in [0, 1).
 */
export function createProcgenRng(levelIndex, salt) {
  let seed = hashSeed(levelIndex, salt) >>> 0;
  return function rng() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} levelIndex
 * @param {string} salt
 * @returns {number} Non-zero 32-bit seed.
 */
function hashSeed(levelIndex, salt) {
  let h = (levelIndex * 1315423911) ^ (salt.length * 1103515245);
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 2654435761);
  }
  return h | 0 || 1;
}
