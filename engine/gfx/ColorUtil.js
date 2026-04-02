/**
 * @param {number} r 0..1
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, l: number }}
 */
export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) * 0.5;
  const d = max - min;
  if (d > 1e-8) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h, s, l };
}

/**
 * @param {number} h 0..1
 * @param {number} s 0..1
 * @param {number} l 0..1
 */
export function hslToRgb(h, s, l) {
  if (s < 1e-8) {
    return { r: l, g: l, b: l };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (h % 1 + 1) % 1;
  const tR = hk + 1 / 3;
  const tG = hk;
  const tB = hk - 1 / 3;
  const tc = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 0.5) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: tc(tR), g: tc(tG), b: tc(tB) };
}

/**
 * Mutates `rgb` length-3 array in linear 0..1 (HSL-style hue/sat/light offsets).
 * @param {number[]} rgb
 * @param {number} dh
 * @param {number} ds
 * @param {number} dl
 */
export function offsetHslRgb(rgb, dh, ds, dl) {
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const o = hslToRgb(h + dh, Math.min(1, Math.max(0, s + ds)), Math.min(1, Math.max(0, l + dl)));
  rgb[0] = o.r;
  rgb[1] = o.g;
  rgb[2] = o.b;
}
