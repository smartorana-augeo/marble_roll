import * as THREE from 'three';

/**
 * Teal hologram with a soft blue atmospheric rim (reads as inner cyan light + cool surround).
 * {@link WorldNeonPulse} drives `userData.hologramUniforms`.
 */
export function createCoinHologramMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 1 },
    uHueShift: { value: 0 },
    uGlitch: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vViewDirW;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosW = worldPos.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDirW = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPulse;
      uniform float uHueShift;
      uniform float uGlitch;

      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vViewDirW;

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 view = normalize(vViewDirW);
        float ndv = clamp(dot(n, view), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 1.85);

        /** Cylinder caps (Y-up) read as flat faces; low |y| = curved rim — clearer coin read. */
        float ny = abs(n.y);
        float faceMask = pow(ny, 2.4);
        float rimMask = pow(1.0 - ny, 1.6);

        float scan = sin(vPosW.y * 11.0 + uTime * 0.55) * 0.5 + 0.5;
        float scanAmt = 0.045 * scan;

        /** Continuous interference — reads as unstable projection, not discrete pops. */
        float interf =
          sin(dot(vPosW.xz, vec2(13.0, 9.0)) + uTime * 0.62) *
          sin(dot(vPosW.xz, vec2(-7.0, 11.0)) - uTime * 0.48);
        float holoBeat = 0.5 + 0.5 * sin(vPosW.y * 7.0 + uTime * 0.38);
        float glitchAmt = 0.14 + 0.86 * (0.5 + 0.5 * uGlitch);
        vec3 interfRgb = vec3(interf * 0.04, interf * -0.025, interf * 0.032) * glitchAmt * holoBeat;

        vec3 tealCore = vec3(0.1, 0.72, 0.76);
        vec3 tealHot = vec3(0.22, 0.94, 0.9);
        vec3 blueAir = vec3(0.32, 0.52, 0.98);

        vec3 col = mix(tealCore, tealHot, fresnel * uPulse * 0.82);
        float grazing = pow(1.0 - ndv, 2.6);
        col = mix(col, blueAir, grazing * 0.42);
        col *= 1.0 + scanAmt;
        col += interfRgb;

        col += faceMask * vec3(0.06, 0.28, 0.32);
        col += rimMask * vec3(0.12, 0.48, 0.52);
        vec3 innerGlow = vec3(0.08, 0.55, 0.58) * (0.4 + 0.6 * fresnel) * uPulse;
        col += innerGlow * 0.52;
        col += vec3(0.06, 0.14, 0.22) * (1.0 - fresnel) * 0.35;

        float chr = sin(vPosW.x * 8.5 + uTime * 0.4);
        col.r += uHueShift * 0.09 + chr * uHueShift * 0.04;
        col.g += uHueShift * -0.055;
        col.b += uHueShift * 0.065 - chr * uHueShift * 0.035;
        col = clamp(col, 0.0, 1.0);

        float flick = 0.985 + 0.015 * sin(uTime * 1.4);
        col *= flick;

        float a = 0.46 + fresnel * 0.38 * uPulse;
        a += scanAmt * 0.09;
        a += abs(interf) * 0.018 * glitchAmt;
        a += faceMask * 0.08;
        a += rimMask * 0.06;
        a = clamp(a, 0.42, 0.92);

        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -0.8,
    polygonOffsetUnits: -1,
  });

  material.userData.hologramUniforms = uniforms;
  return material;
}
