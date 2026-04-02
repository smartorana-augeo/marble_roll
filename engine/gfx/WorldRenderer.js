import { compileProgram } from './webgl/compileProgram.js';
import { createInterleavedMesh, createLineMesh } from './GpuMesh.js';
import {
  buildUnitBoxTriangles,
  buildUnitBoxLines,
  buildUnitSphere,
  buildUnitCylinder,
} from './GeometryTemplates.js';
import { Mat4 } from './math/Mat4.js';
import { quatToMat4, quatYawToMat4 } from './math/Quat.js';
import * as Shaders from './ShaderSources.js';

const BIAS_MAT = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);

/**
 * @param {number} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb01(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export class WorldRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} lighting same shape as `SceneLightingSettings` (fog, hemisphere, ambient, directional).
   */
  constructor(canvas, lighting) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 is required for the built-in renderer.');
    }
    /** @type {WebGL2RenderingContext} */
    this.gl = gl;
    this._lighting = lighting;
    this._dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);

    this._stdProg = compileProgram(gl, Shaders.STD_VERT, Shaders.STD_FRAG);
    this._depthProg = compileProgram(gl, Shaders.DEPTH_VERT, Shaders.DEPTH_FRAG);
    this._lineProg = compileProgram(gl, Shaders.LINE_VERT, Shaders.LINE_FRAG);
    this._holoProg = compileProgram(gl, Shaders.HOLO_VERT, Shaders.HOLO_FRAG);

    /** @type {Record<string, ReturnType<typeof createInterleavedMesh> | ReturnType<typeof createLineMesh> & { mode?: number }>} */
    this._geom = {
      box: createInterleavedMesh(gl, buildUnitBoxTriangles()),
      boxWire: createLineMesh(gl, buildUnitBoxLines()),
      sphereHi: createInterleavedMesh(gl, buildUnitSphere(32, 40)),
      sphereMed: createInterleavedMesh(gl, buildUnitSphere(18, 24)),
      cylinderCoin: createInterleavedMesh(gl, buildUnitCylinder(28)),
    };
    const sm = lighting.directional.shadow;
    const mapSize = sm?.mapSize ?? 2048;
    this._shadowSize = mapSize;
    this._shadowFb = gl.createFramebuffer();
    this._shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, mapSize, mapSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._proj = new Float32Array(16);
    this._view = new Float32Array(16);
    this._vp = new Float32Array(16);
    this._model = new Float32Array(16);
    this._normal = new Float32Array(9);
    this._scaleMat = new Float32Array(16);
    this._rotMat = new Float32Array(16);
    this._tmpMat = new Float32Array(16);
    this._ryMat = new Float32Array(16);
    this._lightVpBias = new Float32Array(16);
    this._mvp = new Float32Array(16);

    this._width = 1;
    this._height = 1;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  /**
   * @param {number} w
   * @param {number} h
   */
  setSize(w, h) {
    const gl = this.gl;
    const W = Math.max(1, Math.floor(w * this._dpr));
    const H = Math.max(1, Math.floor(h * this._dpr));
    this._width = W;
    this._height = H;
    gl.viewport(0, 0, W, H);
  }

  /**
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   */
  setClearColor(r, g, b, a) {
    this.gl.clearColor(r, g, b, a);
  }

  /** @param {number} dprCap */
  setDevicePixelRatioCap(dprCap) {
    this._dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, dprCap);
  }

  /**
   * @param {{
   *   fovDeg: number,
   *   aspect: number,
   *   near: number,
   *   far: number,
   *   eye: { x: number, y: number, z: number },
   *   target: { x: number, y: number, z: number },
   * }} cam
   * @param {import('./SceneMesh.js').SceneMesh[]} meshes
   * @param {Record<string, object>} materials
   */
  render(cam, meshes, materials) {
    const gl = this.gl;
    const up = { x: 0, y: 1, z: 0 };
    Mat4.perspective(this._proj, (cam.fovDeg * Math.PI) / 180, cam.aspect, cam.near, cam.far);
    Mat4.lookAt(this._view, cam.eye, cam.target, up);
    Mat4.multiply(this._vp, this._proj, this._view);

    const lp = this._lighting.directional.position;
    const lightEye = { x: lp[0], y: lp[1], z: lp[2] };
    const lightTarget = { x: 0, y: 0, z: 0 };
    const lightView = new Float32Array(16);
    Mat4.lookAt(lightView, lightEye, lightTarget, up);
    const sc = this._lighting.directional.shadow;
    const lightProj = new Float32Array(16);
    Mat4.ortho(
      lightProj,
      sc.cameraLeft,
      sc.cameraRight,
      sc.cameraBottom,
      sc.cameraTop,
      sc.cameraNear,
      sc.cameraFar,
    );
    const lightPv = new Float32Array(16);
    Mat4.multiply(lightPv, lightProj, lightView);
    Mat4.multiply(this._lightVpBias, BIAS_MAT, lightPv);

    const castShadow = this._lighting.directional.castShadow !== false;

    if (castShadow) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFb);
      gl.viewport(0, 0, this._shadowSize, this._shadowSize);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this._depthProg);
      const ulv = gl.getUniformLocation(this._depthProg, 'uLightVp');
      gl.uniformMatrix4fv(ulv, false, lightPv);
      const umod = gl.getUniformLocation(this._depthProg, 'uModel');
      for (const m of meshes) {
        if (!m.visible || !m.castShadow) continue;
        const mat = materials[m.materialKey];
        if (!mat || mat.kind === 'hologram') continue;
        if (mat.transparent && mat.opacity < 0.99) continue;
        this._composeModel(m);
        gl.uniformMatrix4fv(umod, false, this._model);
        this._drawMeshDepth(m);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this._width, this._height);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);

    const opaque = [];
    const transparent = [];
    for (const m of meshes) {
      if (!m.visible) continue;
      const mat = materials[m.materialKey];
      if (!mat) continue;
      if (mat.kind === 'hologram' || (mat.transparent && mat.opacity < 0.99)) {
        transparent.push(m);
      } else {
        opaque.push(m);
      }
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    for (const m of opaque) {
      const mat = materials[m.materialKey];
      if (mat.wireframe || m.primitive === 'boxWire') {
        this._drawLinePass(m, mat, cam);
      } else if (mat.kind === 'standard') {
        this._drawStandardPass(m, mat, cam, castShadow);
      }
    }

    transparent.sort((a, b) => {
      const ax = a.position.x - cam.eye.x;
      const ay = a.position.y - cam.eye.y;
      const az = a.position.z - cam.eye.z;
      const bx = b.position.x - cam.eye.x;
      const by = b.position.y - cam.eye.y;
      const bz = b.position.z - cam.eye.z;
      return bx * bx + by * by + bz * bz - (ax * ax + ay * ay + az * az);
    });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const m of transparent) {
      const mat = materials[m.materialKey];
      if (mat.kind === 'hologram') {
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        this._drawHologramPass(m, mat, cam);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
      } else {
        gl.depthMask(mat.depthWrite !== false);
        this._drawStandardPass(m, mat, cam, castShadow);
      }
    }
    gl.disable(gl.BLEND);
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} m
   */
  _drawMeshDepth(m) {
    const gl = this.gl;
    const g = this._geom[m.primitive];
    if (!g || m.primitive === 'boxWire') return;
    gl.bindVertexArray(g.vao);
    const mode = g.mode ?? gl.TRIANGLES;
    if (g.indexed) {
      gl.drawElements(mode, g.indexCount, g.indexType, 0);
    } else {
      gl.drawArrays(mode, 0, g.indexCount);
    }
    gl.bindVertexArray(null);
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} m
   * @param {object} mat
   * @param {object} cam
   * @param {boolean} shadowOn
   */
  _drawStandardPass(m, mat, cam, shadowOn) {
    const gl = this.gl;
    const prog = this._stdProg;
    gl.useProgram(prog);
    this._composeModel(m);
    Mat4.normalMat3(this._normal, this._model);

    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uModel'), false, this._model);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, this._view);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProjection'), false, this._proj);
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'uNormalMat'), false, this._normal);
    gl.uniform3f(gl.getUniformLocation(prog, 'uCameraPos'), cam.eye.x, cam.eye.y, cam.eye.z);

    const bc = mat.baseColor;
    gl.uniform3f(gl.getUniformLocation(prog, 'uBaseColor'), bc[0], bc[1], bc[2]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uRoughness'), mat.roughness);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMetalness'), mat.metalness);
    const em = mat.emissive;
    gl.uniform3f(gl.getUniformLocation(prog, 'uEmissive'), em[0], em[1], em[2]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uEmissiveIntensity'), mat.emissiveIntensity);

    const amb = this._lighting.ambient;
    const ambRgb = amb ? hexToRgb01(amb.color) : [0, 0, 0];
    gl.uniform3f(gl.getUniformLocation(prog, 'uAmbientRgb'), ambRgb[0], ambRgb[1], ambRgb[2]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAmbientIntensity'), amb?.intensity ?? 0);

    const hemi = this._lighting.hemisphere;
    const sky = hexToRgb01(hemi.skyColor);
    const gr = hexToRgb01(hemi.groundColor);
    gl.uniform3f(gl.getUniformLocation(prog, 'uHemiSky'), sky[0], sky[1], sky[2]);
    gl.uniform3f(gl.getUniformLocation(prog, 'uHemiGround'), gr[0], gr[1], gr[2]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uHemiIntensity'), hemi.intensity);

    const lp = this._lighting.directional.position;
    const llen = Math.hypot(lp[0], lp[1], lp[2]) || 1;
    gl.uniform3f(gl.getUniformLocation(prog, 'uLightDir'), lp[0] / llen, lp[1] / llen, lp[2] / llen);
    const lc = hexToRgb01(this._lighting.directional.color);
    gl.uniform3f(gl.getUniformLocation(prog, 'uLightColor'), lc[0], lc[1], lc[2]);

    const fog = this._lighting.fog;
    const fc = hexToRgb01(fog.color);
    gl.uniform3f(gl.getUniformLocation(prog, 'uFogColor'), fc[0], fc[1], fc[2]);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFogNear'), fog.near);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFogFar'), fog.far);

    const hasRm = mat.roughnessMap ? 1 : 0;
    gl.uniform1i(gl.getUniformLocation(prog, 'uHasRoughnessMap'), hasRm);
    if (mat.roughnessMap) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mat.roughnessMap);
      gl.uniform1i(gl.getUniformLocation(prog, 'uRoughnessMap'), 0);
      const rep = mat.roughnessUvScale ?? [1, 1];
      gl.uniform2f(gl.getUniformLocation(prog, 'uRoughnessUvScale'), rep[0], rep[1]);
    } else {
      gl.uniform2f(gl.getUniformLocation(prog, 'uRoughnessUvScale'), 1, 1);
    }

    gl.uniform1i(gl.getUniformLocation(prog, 'uReceiveShadow'), m.receiveShadow ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uShadowEnabled'), shadowOn ? 1 : 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uLightVp'), false, this._lightVpBias);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uShadowMap'), 1);

    gl.uniform1f(gl.getUniformLocation(prog, 'uOpacity'), mat.opacity ?? 1);

    if (mat.polygonOffset) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(mat.polygonOffsetFactor ?? 0, mat.polygonOffsetUnits ?? 0);
    }

    const g = this._geom[m.primitive];
    if (!g || m.primitive === 'boxWire') return;
    gl.bindVertexArray(g.vao);
    const mode = g.mode ?? gl.TRIANGLES;
    if (g.indexed) {
      gl.drawElements(mode, g.indexCount, g.indexType, 0);
    } else {
      gl.drawArrays(mode, 0, g.indexCount);
    }
    gl.bindVertexArray(null);

    if (mat.polygonOffset) {
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} m
   * @param {object} mat
   * @param {object} cam
   */
  _drawLinePass(m, mat, cam) {
    const gl = this.gl;
    this._composeModel(m);
    Mat4.multiply(this._mvp, this._vp, this._model);

    gl.useProgram(this._lineProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this._lineProg, 'uMvp'), false, this._mvp);
    const em = mat.emissive;
    gl.uniform3f(gl.getUniformLocation(this._lineProg, 'uColor'), em[0] * mat.emissiveIntensity, em[1] * mat.emissiveIntensity, em[2] * mat.emissiveIntensity);
    gl.uniform1f(gl.getUniformLocation(this._lineProg, 'uOpacity'), mat.opacity ?? 1);

    const g = this._geom.boxWire;
    gl.bindVertexArray(g.vao);
    gl.drawElements(g.mode ?? gl.LINES, g.indexCount, g.indexType, 0);
    gl.bindVertexArray(null);
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} m
   * @param {object} mat
   * @param {object} cam
   */
  _drawHologramPass(m, mat, cam) {
    const gl = this.gl;
    const prog = this._holoProg;
    const u = mat.uniforms;
    gl.useProgram(prog);
    this._composeModel(m);
    Mat4.normalMat3(this._normal, this._model);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uModel'), false, this._model);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, this._view);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProjection'), false, this._proj);
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'uNormalMat'), false, this._normal);
    gl.uniform3f(gl.getUniformLocation(prog, 'uCameraPos'), cam.eye.x, cam.eye.y, cam.eye.z);
    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), u.uTime);
    gl.uniform1f(gl.getUniformLocation(prog, 'uPulse'), u.uPulse);
    gl.uniform1f(gl.getUniformLocation(prog, 'uHueShift'), u.uHueShift);
    gl.uniform1f(gl.getUniformLocation(prog, 'uGlitch'), u.uGlitch);

    const g = this._geom[m.primitive];
    if (!g) return;
    gl.bindVertexArray(g.vao);
    const mode = g.mode ?? gl.TRIANGLES;
    if (g.indexed) {
      gl.drawElements(mode, g.indexCount, g.indexType, 0);
    } else {
      gl.drawArrays(mode, 0, g.indexCount);
    }
    gl.bindVertexArray(null);
  }

  /**
   * @param {Uint8Array} data
   * @param {number} size
   * @param {number} repeatU
   * @param {number} repeatV
   */
  createDataTextureRgba(data, size, repeatU, repeatV) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /**
   * @param {import('./SceneMesh.js').SceneMesh} m
   */
  _composeModel(m) {
    Mat4.identity(this._scaleMat);
    this._scaleMat[0] = m.scale.x;
    this._scaleMat[5] = m.scale.y;
    this._scaleMat[10] = m.scale.z;
    this._scaleMat[15] = 1;
    quatToMat4(this._rotMat, m.quaternion);
    quatYawToMat4(this._ryMat, m.eulerY);
    Mat4.multiply(this._tmpMat, this._rotMat, this._ryMat);
    Mat4.multiply(this._model, this._tmpMat, this._scaleMat);
    this._model[12] = m.position.x;
    this._model[13] = m.position.y;
    this._model[14] = m.position.z;
    this._model[15] = 1;
  }

  dispose() {
    const gl = this.gl;
    for (const g of Object.values(this._geom)) {
      g.dispose(gl);
    }
    gl.deleteFramebuffer(this._shadowFb);
    gl.deleteTexture(this._shadowTex);
    gl.deleteProgram(this._stdProg);
    gl.deleteProgram(this._depthProg);
    gl.deleteProgram(this._lineProg);
    gl.deleteProgram(this._holoProg);
  }
}
