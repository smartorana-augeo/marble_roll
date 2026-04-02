/**
 * Parallel L-system string expansion (e.g. Prusinkiewicz & Lindenmayer).
 * Each generation replaces every symbol according to `rules`; symbols with no rule pass through.
 *
 * Documentation: **PROCEDURAL_L_SYSTEM_LEVELS.md** (§3); **LEVEL_DESIGN_AND_PROCEDURE.md** (course length / iterations).
 *
 * @param {string} axiom
 * @param {Record<string, string>} rules
 * @param {number} iterations
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function expandLSystem(axiom, rules, iterations, options = {}) {
  const maxLength = options.maxLength ?? 200_000;
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      const repl = rules[c];
      next += repl !== undefined ? repl : c;
      if (next.length > maxLength) {
        return next.slice(0, maxLength);
      }
    }
    s = next;
  }
  return s;
}
