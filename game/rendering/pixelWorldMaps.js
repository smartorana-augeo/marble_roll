import * as THREE from 'three';
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
 * Grey noise clustered around mid (128) so `roughnessMap` only gently modulates materials.
 * @param {number} size
 * @param {number} seed
 * @param {number} [amplitude] max deviation from 128 per channel (0 = flat, 127 ≈ full-range noise)
 * @returns {THREE.DataTexture}
 */
export function createPixelNoiseTexture(size, seed = 0x3d437c29, amplitude = 12) {
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
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const WORLD_KEYS = [
  'static',
  'plaza',
  'path',
  'pathWide',
  'ramp',
  'coin',
  'marble',
];

/**
 * One shared noise texture for platform marble/coin materials — cyber “pixel world” grain.
 * @param {Record<string, THREE.MeshStandardMaterial>} materials
 * @returns {THREE.DataTexture | null}
 */
export function applyPixelWorldMapsToMaterials(materials) {
  const w = VisualSettings.world3d;
  if (!w.pixelNoiseEnabled) return null;
  const tex = createPixelNoiseTexture(w.noiseTextureSize, 0x3d437c29, w.roughnessNoiseAmplitude);
  tex.repeat.set(w.textureRepeat, w.textureRepeat);
  tex.needsUpdate = true;
  for (const key of WORLD_KEYS) {
    const m = materials[key];
    if (!m || !(m instanceof THREE.MeshStandardMaterial)) continue;
    m.roughnessMap = tex;
    m.needsUpdate = true;
  }
  return tex;
}
