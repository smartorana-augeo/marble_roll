import { quatToMat4 } from './Quat.js';

/** Column-major 4×4, index `col * 4 + row` (OpenGL-style `uniformMatrix4fv` layout). */

export const Mat4 = {
  /** @param {Float32Array | number[]} out */
  identity(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
  },

  /** @param {Float32Array | number[]} out @param {Float32Array | number[]} a */
  copy(out, a) {
    for (let i = 0; i < 16; i++) out[i] = a[i];
  },

  /**
   * @param {Float32Array | number[]} out
   * @param {Float32Array | number[]} a
   * @param {Float32Array | number[]} b
   */
  multiply(out, a, b) {
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    let b0 = b[0];
    let b1 = b[1];
    let b2 = b[2];
    let b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  },

  /**
   * Vertical field of view in radians.
   * @param {Float32Array | number[]} out
   */
  perspective(out, fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    const nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;
  },

  /**
   * Right-handed look-at: -Z forward (camera looks down -Z in view space).
   * @param {Float32Array | number[]} out
   * @param {{ x: number, y: number, z: number }} eye
   * @param {{ x: number, y: number, z: number }} centre
   * @param {{ x: number, y: number, z: number }} up
   */
  lookAt(out, eye, centre, up) {
    let zx = eye.x - centre.x;
    let zy = eye.y - centre.y;
    let zz = eye.z - centre.z;
    let len = Math.hypot(zx, zy, zz);
    if (len < 1e-12) {
      Mat4.identity(out);
      return;
    }
    len = 1 / len;
    zx *= len;
    zy *= len;
    zz *= len;

    let xx = up.y * zz - up.z * zy;
    let xy = up.z * zx - up.x * zz;
    let xz = up.x * zy - up.y * zx;
    len = Math.hypot(xx, xy, xz);
    if (len < 1e-12) {
      xx = 1;
      xy = 0;
      xz = 0;
    } else {
      len = 1 / len;
      xx *= len;
      xy *= len;
      xz *= len;
    }

    let yx = zy * xz - zz * xy;
    let yy = zz * xx - zx * xz;
    let yz = zx * xy - zy * xx;

    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
    out[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
    out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
    out[15] = 1;
  },

  /**
   * Orthographic projection for shadow / light space.
   * @param {Float32Array | number[]} out
   */
  ortho(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
  },

  /**
   * @param {Float32Array | number[]} out
   * @param {{ x: number, y: number, z: number, w: number }} q
   * @param {number} tx
   * @param {number} ty
   * @param {number} tz
   */
  fromRotationTranslation(out, q, tx, ty, tz) {
    quatToMat4(out, q);
    out[12] = tx;
    out[13] = ty;
    out[14] = tz;
    out[15] = 1;
  },

  /**
   * @param {Float32Array | number[]} out3 9 elements column-major
   * @param {Float32Array | number[]} m4
   */
  normalMat3(out3, m4) {
    out3[0] = m4[0];
    out3[1] = m4[1];
    out3[2] = m4[2];
    out3[3] = m4[4];
    out3[4] = m4[5];
    out3[5] = m4[6];
    out3[6] = m4[8];
    out3[7] = m4[9];
    out3[8] = m4[10];
  },

  /**
   * Full 4×4 inverse (shadow matrices).
   * @param {Float32Array | number[]} out
   * @param {Float32Array | number[]} a
   * @returns {boolean}
   */
  invert(out, a) {
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < 1e-12) return false;
    det = 1 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
    out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
    out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  },

  /**
   * @param {Float32Array | number[]} out
   * @param {Float32Array | number[]} m
   */
  transpose(out, m) {
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] = m[r * 4 + c];
      }
    }
  },
};
