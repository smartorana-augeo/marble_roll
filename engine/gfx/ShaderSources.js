/** GLSL ES 3.00 sources — kept in one module for simple bundling without a preprocessor. */

export const STD_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMat;
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec4 wp = uModel * vec4(aPosition, 1.0);
  vWorldPos = wp.xyz;
  vNormal = uNormalMat * aNormal;
  vUv = aUv;
  gl_Position = uProjection * uView * wp;
}
`;

export const STD_FRAG = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
uniform vec3 uCameraPos;
uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uMetalness;
uniform vec3 uEmissive;
uniform float uEmissiveIntensity;
uniform vec3 uAmbientRgb;
uniform float uAmbientIntensity;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform float uHemiIntensity;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform sampler2D uRoughnessMap;
uniform int uHasRoughnessMap;
uniform vec2 uRoughnessUvScale;
uniform sampler2D uShadowMap;
uniform mat4 uLightVp;
uniform int uReceiveShadow;
uniform int uShadowEnabled;
uniform float uOpacity;
out vec4 fragColor;

float shadowPcf(vec3 worldPos) {
  vec4 ls = uLightVp * vec4(worldPos, 1.0);
  vec3 ndc = ls.xyz / ls.w;
  if (abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0 || ndc.z < 0.0 || ndc.z > 1.0) return 1.0;
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float z = ndc.z * 0.5 + 0.5;
  float texel = 1.0 / 2048.0;
  float s = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 suv = uv + vec2(float(x), float(y)) * texel;
      float d = texture(uShadowMap, suv).r;
      s += z - 0.0025 > d ? 0.0 : 1.0;
    }
  }
  return s / 9.0;
}

vec3 gamma(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 vdir = normalize(uCameraPos - vWorldPos);
  float rough = uRoughness;
  if (uHasRoughnessMap > 0) {
    float t = texture(uRoughnessMap, vUv * uRoughUvScale).r;
    rough = clamp(rough * t, 0.04, 1.0);
  }
  float ndl = max(dot(n, uLightDir), 0.0);
  float sh = 1.0;
  if (uShadowEnabled > 0 && uReceiveShadow > 0) {
    sh = shadowPcf(vWorldPos);
  }
  vec3 diff = uBaseColor * (0.2 + 0.8 * ndl * sh);
  vec3 h = normalize(uLightDir + vdir);
  float specPow = mix(8.0, 128.0, 1.0 - rough);
  float ndh = max(dot(n, h), 0.0);
  float spec = pow(ndh, specPow) * (0.04 + (1.0 - rough) * 0.6) * uMetalness;
  vec3 hemi = mix(uHemiGround, uHemiSky, n.y * 0.5 + 0.5) * uHemiIntensity;
  vec3 amb = uAmbientRgb * uAmbientIntensity;
  vec3 lit = diff * uLightColor + vec3(spec) * uLightColor + amb + hemi;
  vec3 em = uEmissive * uEmissiveIntensity;
  vec3 lin = lit + em;
  float dist = length(uCameraPos - vWorldPos);
  float f = clamp((uFogFar - dist) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  lin = mix(uFogColor, lin, f);
  fragColor = vec4(gamma(lin), uOpacity);
}
`;

export const DEPTH_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uLightVp;
uniform mat4 uModel;
void main() {
  gl_Position = uLightVp * uModel * vec4(aPosition, 1.0);
}
`;

export const DEPTH_FRAG = `#version 300 es
precision highp float;
void main() {}
`;

export const LINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uMvp;
void main() {
  gl_Position = uMvp * vec4(aPosition, 1.0);
}
`;

export const LINE_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 fragColor;
void main() {
  fragColor = vec4(uColor, uOpacity);
}
`;

export const HOLO_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMat;
uniform vec3 uCameraPos;
out vec3 vNormalW;
out vec3 vPosW;
out vec3 vViewDirW;
void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(uNormalMat * aNormal);
  vViewDirW = normalize(uCameraPos - worldPos.xyz);
  gl_Position = uProjection * uView * worldPos;
}
`;

export const HOLO_FRAG = `#version 300 es
precision highp float;
in vec3 vNormalW;
in vec3 vPosW;
in vec3 vViewDirW;
uniform float uTime;
uniform float uPulse;
uniform float uHueShift;
uniform float uGlitch;
out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 view = normalize(vViewDirW);
  float ndv = clamp(dot(n, view), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 1.85);
  float ny = abs(n.y);
  float faceMask = pow(ny, 2.4);
  float rimMask = pow(1.0 - ny, 1.6);
  float scan = sin(vPosW.y * 11.0 + uTime * 0.55) * 0.5 + 0.5;
  float scanAmt = 0.045 * scan;
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
  fragColor = vec4(col, a);
}
`;
