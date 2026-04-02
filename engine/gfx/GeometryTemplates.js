/**
 * CPU-side mesh data for unit primitives (scaled per instance via model matrix).
 * Positions/normals/uvs; Y-up, right-handed.
 */

/**
 * @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint16Array | Uint32Array }}
 */
export function buildUnitBoxTriangles() {
  const verts = [
    // +Z
    [-1, -1, 1, 0, 0, 1, 0, 0],
    [1, -1, 1, 0, 0, 1, 1, 0],
    [1, 1, 1, 0, 0, 1, 1, 1],
    [-1, 1, 1, 0, 0, 1, 0, 1],
    // -Z
    [1, -1, -1, 0, 0, -1, 0, 0],
    [-1, -1, -1, 0, 0, -1, 1, 0],
    [-1, 1, -1, 0, 0, -1, 1, 1],
    [1, 1, -1, 0, 0, -1, 0, 1],
    // +X
    [1, -1, 1, 1, 0, 0, 0, 0],
    [1, -1, -1, 1, 0, 0, 1, 0],
    [1, 1, -1, 1, 0, 0, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 1],
    // -X
    [-1, -1, -1, -1, 0, 0, 0, 0],
    [-1, -1, 1, -1, 0, 0, 1, 0],
    [-1, 1, 1, -1, 0, 0, 1, 1],
    [-1, 1, -1, -1, 0, 0, 0, 1],
    // +Y
    [-1, 1, 1, 0, 1, 0, 0, 0],
    [-1, 1, -1, 0, 1, 0, 1, 0],
    [1, 1, -1, 0, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 0, 0, 1],
    // -Y
    [-1, -1, -1, 0, -1, 0, 0, 0],
    [-1, -1, 1, 0, -1, 0, 1, 0],
    [1, -1, 1, 0, -1, 0, 1, 1],
    [1, -1, -1, 0, -1, 0, 0, 1],
  ];
  const pos = new Float32Array(24 * 3);
  const nor = new Float32Array(24 * 3);
  const uvs = new Float32Array(24 * 2);
  for (let i = 0; i < 24; i++) {
    pos[i * 3] = verts[i][0];
    pos[i * 3 + 1] = verts[i][1];
    pos[i * 3 + 2] = verts[i][2];
    nor[i * 3] = verts[i][3];
    nor[i * 3 + 1] = verts[i][4];
    nor[i * 3 + 2] = verts[i][5];
    uvs[i * 2] = verts[i][6];
    uvs[i * 2 + 1] = verts[i][7];
  }
  /**
   * Triangle winding must match outward normals for back-face culling in `WorldRenderer`
   * (face normal = cross(v1-v0, v2-v0)). +Y / −Y quads were inverted: deck tops culled from above.
   */
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
    16, 18, 17, 16, 19, 18, 21, 20, 22, 20, 23, 21,
  ]);
  return { positions: pos, normals: nor, uvs, indices };
}

/**
 * @returns {{ positions: Float32Array, indices: Uint16Array }}
 */
export function buildUnitBoxLines() {
  const c = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const pos = new Float32Array(8 * 3);
  for (let i = 0; i < 8; i++) {
    pos[i * 3] = c[i][0];
    pos[i * 3 + 1] = c[i][1];
    pos[i * 3 + 2] = c[i][2];
  }
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  return { positions: pos, indices: new Uint16Array(e) };
}

/**
 * @param {number} latBands
 * @param {number} lonSegments
 */
export function buildUnitSphere(latBands = 24, lonSegments = 32) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegments;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const x = sp * st;
      const y = ct;
      const z = cp * st;
      pos.push(x, y, z);
      nor.push(x, y, z);
      uv.push(lon / lonSegments, lat / latBands);
    }
  }
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const first = lat * (lonSegments + 1) + lon;
      const second = first + lonSegments + 1;
      idx.push(first, second, first + 1);
      idx.push(second, second + 1, first + 1);
    }
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uv),
    indices: idx.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}

/**
 * Cylinder along Y, radius 1, height 1 (y from -0.5 to 0.5), centre origin.
 * @param {number} radialSeg
 */
export function buildUnitCylinder(radialSeg = 24) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const base = 0;
  for (let i = 0; i <= radialSeg; i++) {
    const u = i / radialSeg;
    const a = u * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    pos.push(x, -0.5, z);
    nor.push(x, 0, z);
    uv.push(u, 0);
  }
  for (let i = 0; i <= radialSeg; i++) {
    const u = i / radialSeg;
    const a = u * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    pos.push(x, 0.5, z);
    nor.push(x, 0, z);
    uv.push(u, 1);
  }
  for (let i = 0; i < radialSeg; i++) {
    const i0 = base + i;
    const i1 = base + i + 1;
    const i2 = base + i + radialSeg + 1;
    const i3 = base + i + radialSeg + 2;
    idx.push(i0, i2, i1);
    idx.push(i1, i2, i3);
  }
  let o = pos.length / 3;
  const topCentre = o;
  pos.push(0, 0.5, 0);
  nor.push(0, 1, 0);
  uv.push(0.5, 0.5);
  o += 1;
  for (let i = 0; i <= radialSeg; i++) {
    const u = i / radialSeg;
    const a = u * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    pos.push(x, 0.5, z);
    nor.push(0, 1, 0);
    uv.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
  }
  for (let i = 0; i < radialSeg; i++) {
    idx.push(topCentre, topCentre + 1 + i, topCentre + 2 + i);
  }
  const botCentre = pos.length / 3;
  pos.push(0, -0.5, 0);
  nor.push(0, -1, 0);
  uv.push(0.5, 0.5);
  for (let i = 0; i <= radialSeg; i++) {
    const u = i / radialSeg;
    const a = u * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    pos.push(x, -0.5, z);
    nor.push(0, -1, 0);
    uv.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
  }
  for (let i = 0; i < radialSeg; i++) {
    idx.push(botCentre, botCentre + 2 + i, botCentre + 1 + i);
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uv),
    indices: idx.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}
