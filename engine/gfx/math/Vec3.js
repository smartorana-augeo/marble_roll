/** Minimal 3-vector for camera and lighting (column vectors, row-major friendly ops). */

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 */
export function vec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/** @param {{ x: number, y: number, z: number }} o @param {number} x @param {number} y @param {number} z */
export function vec3Set(o, x, y, z) {
  o.x = x;
  o.y = y;
  o.z = z;
}

/** @param {{ x: number, y: number, z: number }} a @param {{ x: number, y: number, z: number }} b */
export function vec3Copy(a, b) {
  a.x = b.x;
  a.y = b.y;
  a.z = b.z;
}

/** @param {{ x: number, y: number, z: number }} o */
export function vec3LengthSq(o) {
  return o.x * o.x + o.y * o.y + o.z * o.z;
}

/** @param {{ x: number, y: number, z: number }} o */
export function vec3Length(o) {
  return Math.sqrt(vec3LengthSq(o));
}

/** @param {{ x: number, y: number, z: number }} o */
export function vec3Normalize(o) {
  const l = vec3Length(o);
  if (l < 1e-12) return;
  const il = 1 / l;
  o.x *= il;
  o.y *= il;
  o.z *= il;
}

/**
 * @param {{ x: number, y: number, z: number }} out
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
export function vec3Cross(out, a, b) {
  const ax = a.x;
  const ay = a.y;
  const az = a.z;
  const bx = b.x;
  const by = b.y;
  const bz = b.z;
  out.x = ay * bz - az * by;
  out.y = az * bx - ax * bz;
  out.z = ax * by - ay * bx;
}

/**
 * @param {{ x: number, y: number, z: number }} out
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
export function vec3Sub(out, a, b) {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
}

/**
 * @param {{ x: number, y: number, z: number }} out
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
export function vec3Add(out, a, b) {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
}

/**
 * @param {{ x: number, y: number, z: number }} o
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
export function vec3Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * @param {{ x: number, y: number, z: number }} out
 * @param {{ x: number, y: number, z: number }} a
 * @param {number} s
 */
export function vec3Scale(out, a, s) {
  out.x = a.x * s;
  out.y = a.y * s;
  out.z = a.z * s;
}
