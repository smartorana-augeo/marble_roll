/**
 * Teal hologram coin — uniforms are driven by {@link ./worldNeonPulse.js}.
 *
 * @returns {{ kind: 'hologram', uniforms: { uTime: number, uPulse: number, uHueShift: number, uGlitch: number } }}
 */
export function createCoinHologramMaterial() {
  return {
    kind: 'hologram',
    uniforms: {
      uTime: 0,
      uPulse: 1,
      uHueShift: 0,
      uGlitch: 0,
    },
  };
}
