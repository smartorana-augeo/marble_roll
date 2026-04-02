/**
 * Uploads interleaved [pos(3), normal(3), uv(2)] and optional index buffer; owns a VAO.
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {{
 *   positions: Float32Array,
 *   normals: Float32Array,
 *   uvs: Float32Array,
 *   indices?: Uint16Array | Uint32Array,
 * }} data
 */
export function createInterleavedMesh(gl, data) {
  const stride = 8 * 4;
  const n = data.positions.length / 3;
  const interleaved = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const o = i * 8;
    interleaved[o] = data.positions[i * 3];
    interleaved[o + 1] = data.positions[i * 3 + 1];
    interleaved[o + 2] = data.positions[i * 3 + 2];
    interleaved[o + 3] = data.normals[i * 3];
    interleaved[o + 4] = data.normals[i * 3 + 1];
    interleaved[o + 5] = data.normals[i * 3 + 2];
    interleaved[o + 6] = data.uvs[i * 2];
    interleaved[o + 7] = data.uvs[i * 2 + 1];
  }

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);

  /** @type {Uint16Array | Uint32Array | null} */
  let indexData = data.indices ?? null;
  /** @type {WebGLBuffer | null} */
  let ibo = null;
  let indexType = gl.UNSIGNED_SHORT;
  let indexCount = n;

  if (indexData) {
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const use32 = indexData.BYTES_PER_ELEMENT === 4;
    indexType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
    indexCount = indexData.length;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  if (ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    vao,
    vbo,
    ibo,
    indexType,
    indexCount,
    indexed: !!ibo,
    mode: gl.TRIANGLES,
    /** @param {WebGL2RenderingContext} g */
    dispose(g) {
      g.deleteVertexArray(vao);
      g.deleteBuffer(vbo);
      if (ibo) g.deleteBuffer(ibo);
    },
  };
}

/**
 * Positions only (lines).
 * @param {WebGL2RenderingContext} gl
 * @param {{ positions: Float32Array, indices: Uint16Array | Uint32Array }} data
 */
export function createLineMesh(gl, data) {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  const indexData = data.indices;
  const use32 = indexData.BYTES_PER_ELEMENT === 4;
  const indexType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    vao,
    vbo,
    ibo,
    indexType,
    indexCount: indexData.length,
    indexed: true,
    mode: gl.LINES,
    dispose(g) {
      g.deleteVertexArray(vao);
      g.deleteBuffer(vbo);
      g.deleteBuffer(ibo);
    },
  };
}
