import { buildUnitBoxLines, buildUnitBoxTriangles, buildUnitCylinder, buildUnitSphere } from './GeometryTemplates.js';
import { Mat4 } from './math/Mat4.js';
import { quatToMat4, quatYawToMat4 } from './math/Quat.js';

/** Matches the largest `polygonOffsetFactor` on deck slabs in `MaterialPalette` (plaza = 3). */
const POLYGON_OFFSET_RANGE = 3;
/**
 * Separates co-planar platform tops (spawn plaza vs first path tiles) in NDC depth. `polygonOffsetFactor`
 * is lower for path segments ⇒ slightly nearer ⇒ stable draw order instead of shimmer.
 */
const OPAQUE_DEPTH_BIAS_PER_FACTOR = 3.2e-5;

/** Cached unit primitives (instanced via model matrix). */
const BOX = buildUnitBoxTriangles();
const BOX_LINES = buildUnitBoxLines();
const SPH_HI = buildUnitSphere(36, 48);
const SPH_MED = buildUnitSphere(20, 28);
/** Marble / goal: ~half the triangles of `sphereMed`; main mesh-complexity saving. */
const SPH_LOW = buildUnitSphere(14, 20);
const CYL_COIN = buildUnitCylinder(12);

/** @param {number} hex @param {number[]} out length ≥ 3 */
function hexToRgb01Into(hex, out) {
  out[0] = ((hex >> 16) & 255) / 255;
  out[1] = ((hex >> 8) & 255) / 255;
  out[2] = (hex & 255) / 255;
}


function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** Twice signed area (parallelogram) for triangle (a,b,c) in screen space (y-down). */
function triArea2(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * @param {{ x: number, y: number, z: number }} o
 */
function vec3NormalizeMut(o) {
  const l = Math.hypot(o.x, o.y, o.z);
  if (l < 1e-12) return false;
  const il = 1 / l;
  o.x *= il;
  o.y *= il;
  o.z *= il;
  return true;
}

/**
 * Gouraud-filled triangle with depth test (NDC z = clip.z / clip.w; smaller = nearer).
 * Colours are 0–255 per vertex.
 * @param {Float32Array} depthBuf
 * @param {Uint8ClampedArray} rgba
 */
function rasterizeTriangleGouraud(
  depthBuf,
  rgba,
  W,
  H,
  x0,
  y0,
  z0,
  r0,
  g0,
  b0,
  x1,
  y1,
  z1,
  r1,
  g1,
  b1,
  x2,
  y2,
  z2,
  r2,
  g2,
  b2,
) {
  const xmin = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const xmax = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const ymin = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const ymax = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (xmin > xmax || ymin > ymax) return;

  const t = triArea2(x0, y0, x1, y1, x2, y2);
  if (Math.abs(t) < 1e-10) return;

  for (let y = ymin; y <= ymax; y++) {
    for (let x = xmin; x <= xmax; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const wa = triArea2(px, py, x1, y1, x2, y2) / t;
      const wb = triArea2(px, py, x2, y2, x0, y0) / t;
      const wc = triArea2(px, py, x0, y0, x1, y1) / t;
      if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
      const z = wa * z0 + wb * z1 + wc * z2;
      const i = y * W + x;
      if (z >= depthBuf[i]) continue;
      depthBuf[i] = z;
      const o = i * 4;
      rgba[o] = Math.min(255, Math.max(0, Math.round(wa * r0 + wb * r1 + wc * r2)));
      rgba[o + 1] = Math.min(255, Math.max(0, Math.round(wa * g0 + wb * g1 + wc * g2)));
      rgba[o + 2] = Math.min(255, Math.max(0, Math.round(wa * b0 + wb * b1 + wc * b2)));
      rgba[o + 3] = 255;
    }
  }
}

/**
 * Constant-colour triangle with alpha over existing RGBA (no depth write). Matches canvas `globalAlpha` over opaque env.
 * @param {number} r @param {number} g @param {number} b 0–255
 * @param {number} a 0–1
 */
function rasterizeTriangleBlend(rgba, W, H, x0, y0, x1, y1, x2, y2, r, g, b, a) {
  if (a <= 0.001) return;
  const invA = 1 - a;
  const xmin = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const xmax = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const ymin = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const ymax = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (xmin > xmax || ymin > ymax) return;

  const t = triArea2(x0, y0, x1, y1, x2, y2);
  if (Math.abs(t) < 1e-10) return;

  for (let y = ymin; y <= ymax; y++) {
    for (let x = xmin; x <= xmax; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const wa = triArea2(px, py, x1, y1, x2, y2) / t;
      const wb = triArea2(px, py, x2, y2, x0, y0) / t;
      const wc = triArea2(px, py, x0, y0, x1, y1) / t;
      if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
      const i = y * W + x;
      const o = i * 4;
      rgba[o] = Math.min(255, Math.round(r * a + rgba[o] * invA));
      rgba[o + 1] = Math.min(255, Math.round(g * a + rgba[o + 1] * invA));
      rgba[o + 2] = Math.min(255, Math.round(b * a + rgba[o + 2] * invA));
      rgba[o + 3] = 255;
    }
  }
}

/**
 * Screen-space line with NDC depth test (same convention as triangles). `halfW` expands perpendicular coverage in pixels.
 * @param {number} halfW 0 = single pixel column, 1 = 3×3 brush
 */
function rasterizeLineDepth(depthBuf, rgba, W, H, x0, y0, z0, x1, y1, z1, r, g, b, halfW) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len * 1.5));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const z = z0 + (z1 - z0) * t;
    for (let oy = -halfW; oy <= halfW; oy++) {
      for (let ox = -halfW; ox <= halfW; ox++) {
        const px = Math.floor(x + ox + 0.5);
        const py = Math.floor(y + oy + 0.5);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const di = py * W + px;
        if (z >= depthBuf[di]) continue;
        depthBuf[di] = z;
        const o = di * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = 255;
      }
    }
  }
}

/**
 * @param {Float32Array | number[]} m
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ x: number, y: number, z: number, w: number }} out
 */
function mulMat4Vec4(m, x, y, z, out) {
  out.x = m[0] * x + m[4] * y + m[8] * z + m[12];
  out.y = m[1] * x + m[5] * y + m[9] * z + m[13];
  out.z = m[2] * x + m[6] * y + m[10] * z + m[14];
  out.w = m[3] * x + m[7] * y + m[11] * z + m[15];
}

/**
 * @param {Float32Array | number[]} m upper 3×3 column-major
 */
function mulMat3Vec3(m, x, y, z, out) {
  out.x = m[0] * x + m[4] * y + m[8] * z;
  out.y = m[1] * x + m[5] * y + m[9] * z;
  out.z = m[2] * x + m[6] * y + m[10] * z;
}

/**
 * @param {{ data: Uint8Array, width: number, height: number }} tex
 * @param {number} u
 * @param {number} v
 */
function sampleRoughnessTex(tex, u, v) {
  const w = tex.width;
  const h = tex.height;
  let iu = Math.floor(((u % 1) + 1) % 1 * w);
  let iv = Math.floor(((1 - v % 1 + 1) % 1) * h);
  if (iu >= w) iu = w - 1;
  if (iv >= h) iv = h - 1;
  const o = (iv * w + iu) * 4;
  return tex.data[o] / 255;
}

/**
 * @param {object} mat
 * @param {number} u
 * @param {number} v
 */
function effectiveRoughness(mat, u, v) {
  let r = typeof mat.roughness === 'number' ? mat.roughness : 0.85;
  const tex = mat.roughnessMap;
  if (tex && tex.data && Array.isArray(mat.roughnessUvScale)) {
    const su = u * mat.roughnessUvScale[0];
    const sv = v * mat.roughnessUvScale[1];
    const n = sampleRoughnessTex(tex, su, sv);
    r *= 0.78 + 0.44 * n;
  }
  return Math.max(0.06, Math.min(1, r));
}

/**
 * Fills once per frame — avoids per-vertex hex unpack in {@link shadeStandard} / {@link shadeHologram}.
 * @param {object} lighting
 * @param {{
 *   ambRgb: number[]
 *   ai: number
 *   sky: number[]
 *   gr: number[]
 *   hi: number
 *   dirRgb: number[]
 *   di: number
 *   lx: number
 *   ly: number
 *   lz: number
 *   fogRgb: number[]
 *   fogNear: number
 *   fogRange: number
 * }} s
 */
function fillLightingScratch(lighting, s) {
  const amb = lighting.ambient;
  const hem = lighting.hemisphere;
  const dir = lighting.directional;
  const fog = lighting.fog;
  hexToRgb01Into(amb.color, s.ambRgb);
  s.ai = amb.intensity;
  hexToRgb01Into(hem.skyColor, s.sky);
  hexToRgb01Into(hem.groundColor, s.gr);
  s.hi = hem.intensity;
  hexToRgb01Into(dir.color, s.dirRgb);
  s.di = dir.intensity;
  {
    const dx = dir.position[0];
    const dy = dir.position[1];
    const dz = dir.position[2];
    const l = Math.hypot(dx, dy, dz);
    if (l < 1e-12) {
      s.lx = 0;
      s.ly = 1;
      s.lz = 0;
    } else {
      const il = 1 / l;
      s.lx = dx * il;
      s.ly = dy * il;
      s.lz = dz * il;
    }
  }
  hexToRgb01Into(fog.color, s.fogRgb);
  s.fogNear = fog.near;
  s.fogRange = Math.max(1e-6, fog.far - fog.near);
}

/**
 * @param {object} mat
 * @param {{ x: number, y: number, z: number }} n world unit normal
 * @param {number} wx
 * @param {number} wy
 * @param {number} wz
 * @param {{ x: number, y: number, z: number }} eye
 * @param {Parameters<typeof fillLightingScratch>[1]} s
 * @param {number[]} outRgb length 3, reused — written in place
 * @param {number} [u]
 * @param {number} [v]
 * @param {number} [fogDistOverride] distance to eye for fog only (use triangle centroid during Gouraud so large flats are not over-fogged at corners)
 */
function shadeStandard(mat, n, wx, wy, wz, eye, s, outRgb, u = 0.5, v = 0.5, fogDistOverride) {
  const bc = mat.baseColor;
  const em = mat.emissive;
  const ei = typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1;
  const ambRgb = s.ambRgb;
  const ai = s.ai;
  const sky = s.sky;
  const gr = s.gr;
  const ny = n.y * 0.5 + 0.5;
  const hx = gr[0] * (1 - ny) + sky[0] * ny;
  const hy = gr[1] * (1 - ny) + sky[1] * ny;
  const hz = gr[2] * (1 - ny) + sky[2] * ny;
  const hi = s.hi;
  const dirRgb = s.dirRgb;
  const di = s.di;
  const ndl = Math.max(0, n.x * s.lx + n.y * s.ly + n.z * s.lz);
  const rough = effectiveRoughness(mat, u, v);
  /** High roughness was crushing diffuse on CPU; floor keeps magenta / purple paths visible. */
  const diffAtt = Math.max(0.58, 0.38 + 0.62 * (1 - rough * 0.72));

  let r = bc[0] * (ambRgb[0] * ai + hx * hi * 0.52 + dirRgb[0] * di * ndl * diffAtt) + em[0] * ei;
  let g = bc[1] * (ambRgb[1] * ai + hy * hi * 0.52 + dirRgb[1] * di * ndl * diffAtt) + em[1] * ei;
  let b = bc[2] * (ambRgb[2] * ai + hz * hi * 0.52 + dirRgb[2] * di * ndl * diffAtt) + em[2] * ei;

  const dist =
    typeof fogDistOverride === 'number' && Number.isFinite(fogDistOverride)
      ? fogDistOverride
      : Math.hypot(wx - eye.x, wy - eye.y, wz - eye.z);
  let t = (dist - s.fogNear) / s.fogRange;
  t = clamp01(t);
  const fogRgb = s.fogRgb;
  r = r * (1 - t) + fogRgb[0] * t;
  g = g * (1 - t) + fogRgb[1] * t;
  b = b * (1 - t) + fogRgb[2] * t;

  outRgb[0] = clamp01(r);
  outRgb[1] = clamp01(g);
  outRgb[2] = clamp01(b);
}

/**
 * @param {object} mat
 * @param {{ x: number, y: number, z: number }} n
 * @param {number} wx
 * @param {number} wy
 * @param {number} wz
 * @param {{ x: number, y: number, z: number }} eye
 * @param {Parameters<typeof fillLightingScratch>[1]} s
 * @param {number[]} outRgb length 3, reused — written in place
 * @param {number} [fogDistOverride]
 */
function shadeHologram(mat, n, wx, wy, wz, eye, s, outRgb, fogDistOverride) {
  const u = mat.uniforms || {};
  const pulse = typeof u.uPulse === 'number' ? u.uPulse : 1;
  const hue = typeof u.uHueShift === 'number' ? u.uHueShift : 0;
  const br = 0.12 + hue * 0.08;
  const bg = 0.82;
  const bb = 0.92;
  let r = br * pulse;
  let g = bg * pulse * 0.95;
  let b = bb * pulse;
  const dist =
    typeof fogDistOverride === 'number' && Number.isFinite(fogDistOverride)
      ? fogDistOverride
      : Math.hypot(wx - eye.x, wy - eye.y, wz - eye.z);
  let t = (dist - s.fogNear) / s.fogRange;
  t = clamp01(t);
  const fogRgb = s.fogRgb;
  r = r * (1 - t) + fogRgb[0] * t;
  g = g * (1 - t) + fogRgb[1] * t;
  b = b * (1 - t) + fogRgb[2] * t;
  const ndl = Math.max(0.2, 0.45 + 0.55 * n.y);
  r *= ndl;
  g *= ndl;
  b *= ndl;
  outRgb[0] = clamp01(r);
  outRgb[1] = clamp01(g);
  outRgb[2] = clamp01(b);
}

export class WorldRenderer {
  /**
   * @param {HTMLCanvasElement | null} canvas
   * @param {object} sceneLighting frozen defaults from SceneLightingSettings
   */
  constructor(canvas, sceneLighting) {
    this._canvas = canvas;
    /** Favour write throughput — frame is built in an `ImageData` buffer, not read from the GPU bitmap. */
    this._ctx = canvas
      ? canvas.getContext('2d', { alpha: true, willReadFrequently: false })
      : null;
    this._lighting = sceneLighting;
    this._dprCap = 2;
    /** Multiplier on CSS×DPR backing size (see `setInternalResolutionScale`). */
    this._internalResScale = 1;
    this._dpr = 1;
    this._clear = { r: 0, g: 0, b: 0, a: 0 };
    /** Cached `fillStyle` when clear alpha > 0 — avoids allocating a new string every frame. */
    this._clearFillStyle = '';
    this._proj = new Float32Array(16);
    this._view = new Float32Array(16);
    this._vp = new Float32Array(16);
    this._model = new Float32Array(16);
    this._mvp = new Float32Array(16);
    this._rot = new Float32Array(16);
    this._ry = new Float32Array(16);
    this._tmpMat = new Float32Array(16);
    this._scaleMat = new Float32Array(16);
    this._normRot = new Float32Array(16);
    this._clip = { x: 0, y: 0, z: 0, w: 1 };
    this._p = { x: 0, y: 0, z: 0, w: 1 };
    this._nw = { x: 0, y: 1, z: 0 };
    this._vn0 = { x: 0, y: 0, z: 0 };
    this._vn1 = { x: 0, y: 0, z: 0 };
    this._vn2 = { x: 0, y: 0, z: 0 };
    /** @type {Float32Array | null} */
    this._depthBuf = null;
    /** @type {ImageData | null} */
    this._frameImageData = null;
    this._frameW = 0;
    this._frameH = 0;
    /** @type {object[]} Reused each frame to collect marble triangles (avoids `opaque.filter` allocation). */
    this._marbleTris = [];
    /** Batch arrays — cleared each frame; avoid `[]` per render. */
    this._opaqueList = [];
    this._linesList = [];
    this._transparentList = [];
    this._envMeshesBuf = [];
    this._marbleMeshesBuf = [];
    /** Grow-once pools for triangle/line records (see `_acquireOpaqueTri`, etc.). */
    this._opaqueTriPool = [];
    this._lineSegPool = [];
    this._transparentTriPool = [];
    /** Reused by {@link shadeStandard} / {@link shadeHologram} (no per-vertex array allocation). */
    this._shadeRgb0 = [0, 0, 0];
    this._shadeRgb1 = [0, 0, 0];
    this._shadeRgb2 = [0, 0, 0];
    /** Passed to {@link Mat4.lookAt} — avoid allocating `{x,y,z}` each frame. */
    this._camUp = { x: 0, y: 1, z: 0 };
    /** Per-frame lighting unpack (see {@link fillLightingScratch}). */
    this._lightScratch = {
      ambRgb: [0, 0, 0],
      ai: 0,
      sky: [0, 0, 0],
      gr: [0, 0, 0],
      hi: 0,
      dirRgb: [0, 0, 0],
      di: 0,
      lx: 0,
      ly: 0,
      lz: 0,
      fogRgb: [0, 0, 0],
      fogNear: 0,
      fogRange: 1,
    };
  }

  /**
   * @param {Uint8Array} data length width*width*4
   * @param {number} size
   * @returns {{ width: number, height: number, data: Uint8Array }}
   */
  createDataTextureRgba(data, size) {
    return { width: size, height: size, data: new Uint8Array(data) };
  }

  /** @param {number} cap */
  setDevicePixelRatioCap(cap) {
    this._dprCap = Math.max(1, cap);
  }

  /**
   * Renders to a smaller bitmap (factor of full CSS×DPR size); CPU cost scales with pixel count.
   * @param {number} scale 0.35–1
   */
  setInternalResolutionScale(scale) {
    const s = Number(scale);
    this._internalResScale =
      Number.isFinite(s) && s > 0 ? Math.max(0.35, Math.min(1, s)) : 1;
  }

  /** @param {number} r @param {number} g @param {number} b @param {number} a */
  setClearColor(r, g, b, a) {
    this._clear = { r, g, b, a };
    this._clearFillStyle =
      a > 0.001
        ? `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`
        : '';
  }

  /** @param {number} cssW @param {number} cssH */
  setSize(cssW, cssH) {
    const canvas = this._canvas;
    if (!canvas) return;
    let cw = Number(cssW);
    let ch = Number(cssH);
    if (!Number.isFinite(cw) || cw < 1) cw = 1;
    if (!Number.isFinite(ch) || ch < 1) ch = 1;

    let dpr = Math.min(this._dprCap, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (!Number.isFinite(dpr) || dpr < 1) dpr = 1;
    this._dpr = dpr;

    const scale = Number.isFinite(this._internalResScale) && this._internalResScale > 0 ? this._internalResScale : 1;
    const factor = dpr * Math.max(0.35, Math.min(1, scale));
    const w = Math.max(1, Math.round(cw * factor));
    const h = Math.max(1, Math.round(ch * factor));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
  }

  /**
   * @param {object} cam
   * @param {import('./SceneMesh.js').SceneMesh[]} meshes
   * @param {Record<string, object>} materials
   */
  render(cam, meshes, materials) {
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!ctx || !canvas) return;

    let W = canvas.width;
    let H = canvas.height;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W < 1 || H < 1) {
      const iw = typeof window !== 'undefined' ? window.innerWidth : 1;
      const ih = typeof window !== 'undefined' ? window.innerHeight : 1;
      this.setSize(Number.isFinite(iw) && iw >= 1 ? iw : 1, Number.isFinite(ih) && ih >= 1 ? ih : 1);
      W = canvas.width;
      H = canvas.height;
    }
    if (!Number.isFinite(W) || !Number.isFinite(H) || W < 1 || H < 1) return;
    const lighting = this._lighting;
    const eye = cam.eye;
    fillLightingScratch(lighting, this._lightScratch);
    const lightS = this._lightScratch;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const c = this._clear;
    if (c.a > 0.001) {
      ctx.fillStyle = this._clearFillStyle;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    const fovRad = (cam.fovDeg * Math.PI) / 180;
    Mat4.perspective(this._proj, fovRad, cam.aspect, cam.near, cam.far);
    Mat4.lookAt(this._view, cam.eye, cam.target, this._camUp);
    Mat4.multiply(this._vp, this._proj, this._view);

    const opaque = this._opaqueList;
    const lines = this._linesList;
    const transparent = this._transparentList;
    opaque.length = 0;
    lines.length = 0;
    transparent.length = 0;

    const envMeshes = this._envMeshesBuf;
    const marbleMeshes = this._marbleMeshesBuf;
    envMeshes.length = 0;
    marbleMeshes.length = 0;
    for (const m of meshes) {
      if (m.materialKey === 'marble') marbleMeshes.push(m);
      else envMeshes.push(m);
    }

    for (let gi = 0; gi < envMeshes.length; gi++) {
      this._emitMeshGeometry(envMeshes[gi], materials, eye, lightS, W, H);
    }
    for (let gi = 0; gi < marbleMeshes.length; gi++) {
      this._emitMeshGeometry(marbleMeshes[gi], materials, eye, lightS, W, H);
    }

    if (transparent.length > 1) {
      transparent.sort((a, b) => b.depth - a.depth);
    }

    const dpr = this._dpr;
    /** Thicker lattice lines on high effective pixel density (retina × full internal scale). */
    const lineHalfW = dpr * this._internalResScale >= 1.85 ? 1 : 0;

    const np = W * H;
    if (!this._depthBuf || this._depthBuf.length !== np || this._frameW !== W || this._frameH !== H) {
      this._depthBuf = new Float32Array(np);
      this._frameImageData = ctx.createImageData(W, H);
      this._frameW = W;
      this._frameH = H;
    }
    const depthBuf = this._depthBuf;
    const frameImg = /** @type {ImageData} */ (this._frameImageData);
    const rgba = frameImg.data;
    depthBuf.fill(Infinity);
    rgba.fill(0);

    for (const t of opaque) {
      if (t.isMarble) continue;
      rasterizeTriangleGouraud(
        depthBuf,
        rgba,
        W,
        H,
        t.sx0,
        t.sy0,
        t.dz0,
        t.r0,
        t.g0,
        t.b0,
        t.sx1,
        t.sy1,
        t.dz1,
        t.r1,
        t.g1,
        t.b1,
        t.sx2,
        t.sy2,
        t.dz2,
        t.r2,
        t.g2,
        t.b2,
      );
    }

    for (const ln of lines) {
      rasterizeLineDepth(
        depthBuf,
        rgba,
        W,
        H,
        ln.sx0,
        ln.sy0,
        ln.dz0,
        ln.sx1,
        ln.sy1,
        ln.dz1,
        ln.r,
        ln.g,
        ln.b,
        lineHalfW,
      );
    }

    for (const t of transparent) {
      rasterizeTriangleBlend(
        rgba,
        W,
        H,
        t.sx0,
        t.sy0,
        t.sx1,
        t.sy1,
        t.sx2,
        t.sy2,
        t.r,
        t.g,
        t.b,
        t.a,
      );
    }

    const marbleTris = this._marbleTris;
    marbleTris.length = 0;
    for (let i = 0; i < opaque.length; i++) {
      const t = opaque[i];
      if (t.isMarble) marbleTris.push(t);
    }
    if (marbleTris.length) {
      for (const t of marbleTris) {
        rasterizeTriangleGouraud(
          depthBuf,
          rgba,
          W,
          H,
          t.sx0,
          t.sy0,
          t.dz0,
          t.r0,
          t.g0,
          t.b0,
          t.sx1,
          t.sy1,
          t.dz1,
          t.r1,
          t.g1,
          t.b1,
          t.sx2,
          t.sy2,
          t.dz2,
          t.r2,
          t.g2,
          t.b2,
        );
      }
    }

    ctx.putImageData(frameImg, 0, 0);
    ctx.globalAlpha = 1;
  }

  _acquireOpaqueTri() {
    const list = this._opaqueList;
    const i = list.length;
    let o = this._opaqueTriPool[i];
    if (!o) {
      o = {
        sx0: 0,
        sy0: 0,
        sx1: 0,
        sy1: 0,
        sx2: 0,
        sy2: 0,
        dz0: 0,
        dz1: 0,
        dz2: 0,
        r0: 0,
        g0: 0,
        b0: 0,
        r1: 0,
        g1: 0,
        b1: 0,
        r2: 0,
        g2: 0,
        b2: 0,
        a: 1,
        depth: 0,
        isMarble: false,
      };
      this._opaqueTriPool[i] = o;
    }
    list.push(o);
    return o;
  }

  _acquireLineSeg() {
    const list = this._linesList;
    const i = list.length;
    let o = this._lineSegPool[i];
    if (!o) {
      o = { sx0: 0, sy0: 0, sx1: 0, sy1: 0, dz0: 0, dz1: 0, r: 0, g: 0, b: 0, a: 1 };
      this._lineSegPool[i] = o;
    }
    list.push(o);
    return o;
  }

  _acquireTransparentTri() {
    const list = this._transparentList;
    const i = list.length;
    let o = this._transparentTriPool[i];
    if (!o) {
      o = { sx0: 0, sy0: 0, sx1: 0, sy1: 0, sx2: 0, sy2: 0, r: 0, g: 0, b: 0, a: 1, depth: 0 };
      this._transparentTriPool[i] = o;
    }
    list.push(o);
    return o;
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} mesh
   * @param {Record<string, object>} materials
   * @param {{ x: number, y: number, z: number }} eye
   * @param {Parameters<typeof fillLightingScratch>[1]} lightS
   * @param {number} W
   * @param {number} H
   */
  _emitMeshGeometry(mesh, materials, eye, lightS, W, H) {
    const s0 = this._shadeRgb0;
    const s1 = this._shadeRgb1;
    const s2 = this._shadeRgb2;
    if (!mesh.visible) return;
    const mat = materials[mesh.materialKey] ?? materials.static;
    if (!mat) return;

    const prim = mesh.primitive;
    if (mat.wireframe || prim === 'boxWire') {
      this._composeModel(mesh);
      Mat4.multiply(this._mvp, this._vp, this._model);
      const geo = BOX_LINES;
      const pos = geo.positions;
      const idx = geo.indices;
      for (let e = 0; e < idx.length; e += 2) {
        const ia = idx[e] * 3;
        const ib = idx[e + 1] * 3;
        this._emitLine(
          pos[ia],
          pos[ia + 1],
          pos[ia + 2],
          pos[ib],
          pos[ib + 1],
          pos[ib + 2],
          mat,
          eye,
          W,
          H,
        );
      }
      return;
    }

    let geo;
    if (prim === 'box') geo = BOX;
    else if (prim === 'sphereHi') geo = SPH_HI;
    else if (prim === 'sphereMed') geo = SPH_MED;
    else if (prim === 'sphereLow') geo = SPH_LOW;
    else if (prim === 'cylinderCoin') geo = CYL_COIN;
    else return;

    const idx = geo.indices;
    const pos = geo.positions;
    const nor = geo.normals;
    const uvs = geo.uvs;

    this._composeModel(mesh);
    Mat4.multiply(this._mvp, this._vp, this._model);
    Mat4.multiply(this._normRot, this._rot, this._ry);

    const isTrans = !!mat.transparent;
    const opacity = typeof mat.opacity === 'number' ? mat.opacity : 1;

    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3;
      const i1 = idx[t + 1] * 3;
      const i2 = idx[t + 2] * 3;

      const vi0 = idx[t];
      const vi1 = idx[t + 1];
      const vi2 = idx[t + 2];
      let uAvg = 0.5;
      let vAvg = 0.5;
      if (uvs) {
        uAvg = (uvs[vi0 * 2] + uvs[vi1 * 2] + uvs[vi2 * 2]) / 3;
        vAvg = (uvs[vi0 * 2 + 1] + uvs[vi1 * 2 + 1] + uvs[vi2 * 2 + 1]) / 3;
      }

      mulMat4Vec4(this._mvp, pos[i0], pos[i0 + 1], pos[i0 + 2], this._clip);
      const c0x = this._clip.x;
      const c0y = this._clip.y;
      const c0z = this._clip.z;
      const c0w = this._clip.w;
      mulMat4Vec4(this._mvp, pos[i1], pos[i1 + 1], pos[i1 + 2], this._p);
      const c1x = this._p.x;
      const c1y = this._p.y;
      const c1z = this._p.z;
      const c1w = this._p.w;
      mulMat4Vec4(this._mvp, pos[i2], pos[i2 + 1], pos[i2 + 2], this._p);
      const c2x = this._p.x;
      const c2y = this._p.y;
      const c2z = this._p.z;
      const c2w = this._p.w;

      if (c0w <= 0 || c1w <= 0 || c2w <= 0) continue;

      mulMat4Vec4(this._model, pos[i0], pos[i0 + 1], pos[i0 + 2], this._clip);
      const w00 = this._clip.x;
      const w01 = this._clip.y;
      const w02 = this._clip.z;
      mulMat4Vec4(this._model, pos[i1], pos[i1 + 1], pos[i1 + 2], this._p);
      const w10 = this._p.x;
      const w11 = this._p.y;
      const w12 = this._p.z;
      mulMat4Vec4(this._model, pos[i2], pos[i2 + 1], pos[i2 + 2], this._p);
      const w20 = this._p.x;
      const w21 = this._p.y;
      const w22 = this._p.z;

      const ndc0x = c0x / c0w;
      const ndc0y = c0y / c0w;
      const ndc1x = c1x / c1w;
      const ndc1y = c1y / c1w;
      const ndc2x = c2x / c2w;
      const ndc2y = c2y / c2w;

      const sx0 = (ndc0x * 0.5 + 0.5) * W;
      const sy0 = (0.5 - ndc0y * 0.5) * H;
      const sx1 = (ndc1x * 0.5 + 0.5) * W;
      const sy1 = (0.5 - ndc1y * 0.5) * H;
      const sx2 = (ndc2x * 0.5 + 0.5) * W;
      const sy2 = (0.5 - ndc2y * 0.5) * H;

      const cx = (w00 + w10 + w20) / 3;
      const cy = (w01 + w11 + w21) / 3;
      const cz = (w02 + w12 + w22) / 3;
      const depth = Math.hypot(cx - eye.x, cy - eye.y, cz - eye.z);

      if (isTrans) {
        mulMat3Vec3(this._normRot, nor[i0], nor[i0 + 1], nor[i0 + 2], this._vn0);
        vec3NormalizeMut(this._vn0);
        if (mat.kind === 'hologram') {
          shadeHologram(mat, this._vn0, cx, cy, cz, eye, lightS, s0);
        } else {
          shadeStandard(mat, this._vn0, cx, cy, cz, eye, lightS, s0, uAvg, vAvg);
        }
        const tr = this._acquireTransparentTri();
        tr.sx0 = sx0;
        tr.sy0 = sy0;
        tr.sx1 = sx1;
        tr.sy1 = sy1;
        tr.sx2 = sx2;
        tr.sy2 = sy2;
        tr.r = Math.round(s0[0] * 255);
        tr.g = Math.round(s0[1] * 255);
        tr.b = Math.round(s0[2] * 255);
        tr.a = opacity;
        tr.depth = depth;
        continue;
      }

      const ax = w10 - w00;
      const ay = w11 - w01;
      const az = w12 - w02;
      const bx = w20 - w00;
      const by = w21 - w01;
      const bz = w22 - w02;
      let fnx = ay * bz - az * by;
      let fny = az * bx - ax * bz;
      let fnz = ax * by - ay * bx;
      const fl = Math.hypot(fnx, fny, fnz);
      if (fl < 1e-12) continue;
      const ilf = 1 / fl;
      fnx *= ilf;
      fny *= ilf;
      fnz *= ilf;
      const vx = eye.x - cx;
      const vy = eye.y - cy;
      const vz = eye.z - cz;
      if (fnx * vx + fny * vy + fnz * vz <= 1e-5) continue;

      let dz0 = c0z / c0w;
      let dz1 = c1z / c1w;
      let dz2 = c2z / c2w;
      const po = mat.polygonOffsetFactor;
      if (typeof po === 'number') {
        const db = (POLYGON_OFFSET_RANGE - po) * OPAQUE_DEPTH_BIAS_PER_FACTOR;
        dz0 -= db;
        dz1 -= db;
        dz2 -= db;
      }

      mulMat3Vec3(this._normRot, nor[i0], nor[i0 + 1], nor[i0 + 2], this._vn0);
      mulMat3Vec3(this._normRot, nor[i1], nor[i1 + 1], nor[i1 + 2], this._vn1);
      mulMat3Vec3(this._normRot, nor[i2], nor[i2 + 1], nor[i2 + 2], this._vn2);
      vec3NormalizeMut(this._vn0);
      vec3NormalizeMut(this._vn1);
      vec3NormalizeMut(this._vn2);

      const u0 = uvs ? uvs[vi0 * 2] : 0.5;
      const v0 = uvs ? uvs[vi0 * 2 + 1] : 0.5;
      const u1 = uvs ? uvs[vi1 * 2] : 0.5;
      const v1 = uvs ? uvs[vi1 * 2 + 1] : 0.5;
      const u2 = uvs ? uvs[vi2 * 2] : 0.5;
      const v2 = uvs ? uvs[vi2 * 2 + 1] : 0.5;

      if (mat.kind === 'hologram') {
        shadeHologram(mat, this._vn0, w00, w01, w02, eye, lightS, s0, depth);
        shadeHologram(mat, this._vn1, w10, w11, w12, eye, lightS, s1, depth);
        shadeHologram(mat, this._vn2, w20, w21, w22, eye, lightS, s2, depth);
      } else {
        shadeStandard(mat, this._vn0, w00, w01, w02, eye, lightS, s0, u0, v0, depth);
        shadeStandard(mat, this._vn1, w10, w11, w12, eye, lightS, s1, u1, v1, depth);
        shadeStandard(mat, this._vn2, w20, w21, w22, eye, lightS, s2, u2, v2, depth);
      }

      const tri = this._acquireOpaqueTri();
      tri.sx0 = sx0;
      tri.sy0 = sy0;
      tri.sx1 = sx1;
      tri.sy1 = sy1;
      tri.sx2 = sx2;
      tri.sy2 = sy2;
      tri.dz0 = dz0;
      tri.dz1 = dz1;
      tri.dz2 = dz2;
      tri.r0 = Math.round(s0[0] * 255);
      tri.g0 = Math.round(s0[1] * 255);
      tri.b0 = Math.round(s0[2] * 255);
      tri.r1 = Math.round(s1[0] * 255);
      tri.g1 = Math.round(s1[1] * 255);
      tri.b1 = Math.round(s1[2] * 255);
      tri.r2 = Math.round(s2[0] * 255);
      tri.g2 = Math.round(s2[1] * 255);
      tri.b2 = Math.round(s2[2] * 255);
      tri.a = opacity;
      tri.depth = depth;
      tri.isMarble = mesh.materialKey === 'marble';
    }
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} mesh
   */
  _composeModel(mesh) {
    const sx = mesh.scale.x;
    const sy = mesh.scale.y;
    const sz = mesh.scale.z;
    quatToMat4(this._rot, mesh.quaternion);
    quatYawToMat4(this._ry, mesh.eulerY);
    Mat4.multiply(this._tmpMat, this._rot, this._ry);
    Mat4.identity(this._scaleMat);
    this._scaleMat[0] = sx;
    this._scaleMat[5] = sy;
    this._scaleMat[10] = sz;
    Mat4.multiply(this._model, this._tmpMat, this._scaleMat);
    this._model[12] = mesh.position.x;
    this._model[13] = mesh.position.y;
    this._model[14] = mesh.position.z;
    this._model[15] = 1;
  }

  /**
   * @param {number} ax
   * @param {number} ay
   * @param {number} az
   * @param {number} bx
   * @param {number} by
   * @param {number} bz
   * @param {object} mat
   * @param {{ x: number, y: number, z: number }} eye
   * @param {number} W
   * @param {number} H
   */
  _emitLine(ax, ay, az, bx, by, bz, mat, eye, W, H) {
    mulMat4Vec4(this._mvp, ax, ay, az, this._clip);
    if (this._clip.w <= 0) return;
    const dz0 = this._clip.z / this._clip.w;
    mulMat4Vec4(this._mvp, bx, by, bz, this._p);
    if (this._p.w <= 0) return;
    const dz1 = this._p.z / this._p.w;

    const ndcAx = this._clip.x / this._clip.w;
    const ndcAy = this._clip.y / this._clip.w;
    const ndcBx = this._p.x / this._p.w;
    const ndcBy = this._p.y / this._p.w;

    const sx0 = (ndcAx * 0.5 + 0.5) * W;
    const sy0 = (0.5 - ndcAy * 0.5) * H;
    const sx1 = (ndcBx * 0.5 + 0.5) * W;
    const sy1 = (0.5 - ndcBy * 0.5) * H;

    const bc = mat.baseColor;
    const em = mat.emissive;
    const ei = typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1;
    const r = clamp01(bc[0] * 0.42 + em[0] * ei * 1.35);
    const g = clamp01(bc[1] * 0.42 + em[1] * ei * 1.35);
    const b = clamp01(bc[2] * 0.42 + em[2] * ei * 1.35);

    const ln = this._acquireLineSeg();
    ln.sx0 = sx0;
    ln.sy0 = sy0;
    ln.sx1 = sx1;
    ln.sy1 = sy1;
    ln.dz0 = dz0;
    ln.dz1 = dz1;
    ln.r = Math.round(r * 255);
    ln.g = Math.round(g * 255);
    ln.b = Math.round(b * 255);
    ln.a = typeof mat.opacity === 'number' ? mat.opacity : 1;
  }
}
