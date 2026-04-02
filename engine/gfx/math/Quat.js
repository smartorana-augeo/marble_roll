/**
 * Unit quaternion (x,y,z,w). Right-handed, same multiplication convention as common GL libs.
 */

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @param {number} [w]
 */
export function quat(x = 0, y = 0, z = 0, w = 1) {
  return { x, y, z, w };
}

/** @param {{ x: number, y: number, z: number, w: number }} q */
export function quatNormalize(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w);
  if (l < 1e-12) return;
  const il = 1 / l;
  q.x *= il;
  q.y *= il;
  q.z *= il;
  q.w *= il;
}

/**
 * YXZ intrinsic order (common for yaw/pitch/roll rigs).
 * @param {{ x: number, y: number, z: number, w: number }} out
 * @param {number} pitchRad
 * @param {number} yawRad
 * @param {number} rollRad
 */
export function quatFromEulerYXZ(out, pitchRad, yawRad, rollRad) {
  const c1 = Math.cos(yawRad * 0.5);
  const c2 = Math.cos(pitchRad * 0.5);
  const c3 = Math.cos(rollRad * 0.5);
  const s1 = Math.sin(yawRad * 0.5);
  const s2 = Math.sin(pitchRad * 0.5);
  const s3 = Math.sin(rollRad * 0.5);
  out.x = s1 * c2 * c3 + c1 * s2 * s3;
  out.y = c1 * s2 * c3 - s1 * c2 * s3;
  out.z = c1 * c2 * s3 + s1 * s2 * c3;
  out.w = c1 * c2 * c3 - s1 * s2 * s3;
}

/**
 * @param {{ x: number, y: number, z: number, w: number }} out
 * @param {{ x: number, y: number, z: number, w: number }} a
 * @param {{ x: number, y: number, z: number, w: number }} b
 */
export function quatMultiply(out, a, b) {
  const ax = a.x;
  const ay = a.y;
  const az = a.z;
  const aw = a.w;
  const bx = b.x;
  const by = b.y;
  const bz = b.z;
  const bw = b.w;
  out.x = aw * bx + ax * bw + ay * bz - az * by;
  out.y = aw * by - ax * bz + ay * bw + az * bx;
  out.z = aw * bz + ax * by - ay * bx + az * bw;
  out.w = aw * bw - ax * bx - ay * by - az * bz;
}

/**
 * @param {Float32Array | number[]} out 16 elements column-major
 * @param {{ x: number, y: number, z: number, w: number }} q
 */
export function quatToMat4(out, q) {
  const x = q.x;
  const y = q.y;
  const z = q.z;
  const w = q.w;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  out[0] = 1 - (yy + zz);
  out[1] = xy + wz;
  out[2] = xz - wy;
  out[3] = 0;
  out[4] = xy - wz;
  out[5] = 1 - (xx + zz);
  out[6] = yz + wx;
  out[7] = 0;
  out[8] = xz + wy;
  out[9] = yz - wx;
  out[10] = 1 - (xx + yy);
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
}

/** Right-handed Y-up rotation about +Y (column-major 4×4). */
export function quatYawToMat4(out, yawRad) {
  const c = Math.cos(yawRad);
  const s = Math.sin(yawRad);
  out[0] = c;
  out[1] = 0;
  out[2] = -s;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = s;
  out[9] = 0;
  out[10] = c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
}
