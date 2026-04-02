import { VisualSettings } from '../config/VisualSettings.js';

/**
 * Seeded PRNG (Mulberry32) for stable noise across reloads.
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Grey noise RGBA for roughness modulation.
 * @param {number} size
 * @param {number} seed
 * @param {number} [amplitude]
 * @returns {Uint8Array}
 */
export function createPixelNoiseRgba(size, seed = 0x3d437c29, amplitude = 12) {
  const data = new Uint8Array(size * size * 4);
  const rnd = mulberry32(seed);
  const mid = 128;
  const amp = Math.max(0, Math.min(127, amplitude));
  for (let i = 0; i < size * size; i++) {
    const delta = amp > 0 ? (rnd() - 0.5) * 2 * amp : 0;
    const v = Math.max(1, Math.min(254, Math.round(mid + delta)));
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  return data;
}

const WORLD_KEYS = ['static', 'plaza', 'path', 'pathWide', 'ramp', 'coin', 'marble'];

/**
 * One shared noise texture for platform marble/coin materials — cyber “pixel world” grain.
 * @param {Record<string, object>} materials
 * @param {import('../../engine/gfx/WorldRenderer.js').WorldRenderer} renderer
 * @returns {{ width: number, height: number, data: Uint8Array } | null}
 */
export function applyPixelWorldMapsToMaterials(materials, renderer) {
  const w = VisualSettings.world3d;
  if (!w.pixelNoiseEnabled) return null;
  const data = createPixelNoiseRgba(w.noiseTextureSize, 0x3d437c29, w.roughnessNoiseAmplitude);
  const tex = renderer.createDataTextureRgba(data, w.noiseTextureSize);
  for (const key of WORLD_KEYS) {
    const m = materials[key];
    if (!m || m.kind !== 'standard') continue;
    m.roughnessMap = tex;
    m.roughnessUvScale = [w.textureRepeat, w.textureRepeat];
  }
  return tex;
}
