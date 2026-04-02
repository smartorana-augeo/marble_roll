/**
 * Three.js scene lighting and fog — cooler than daylight, but fog/fill stay fairly neutral so
 * the world does not read as a heavy blue wash.
 * Imported by {@link setupSceneLighting}; adjust colours and intensities only here.
 */

const sceneLightingDefaults = Object.freeze({
  fog: Object.freeze({
    /** Desaturated distance haze — less chroma than a saturated “space blue” fog. */
    color: 0x3a4a5c,
    near: 24,
    far: 92,
  }),
  hemisphere: Object.freeze({
    skyColor: 0x5e5c6a,
    groundColor: 0x121e30,
    intensity: 0.52,
  }),
  /**
   * Omni fill so shadowed areas are not pitch black; keep intensity low to preserve contrast.
   * Set intensity to 0 to omit the light.
   */
  ambient: Object.freeze({
    color: 0x2a323f,
    intensity: 0.165,
  }),
  directional: Object.freeze({
    /** Near-white key — slight warmth so platforms are not cold-blue. */
    color: 0xfffaf6,
    intensity: 0.82,
    position: Object.freeze([20, 36, 16]),
    castShadow: true,
    shadow: Object.freeze({
      mapSize: 2048,
      radius: 2,
      cameraNear: 0.5,
      cameraFar: 120,
      cameraLeft: -40,
      cameraRight: 40,
      cameraTop: 40,
      cameraBottom: -40,
    }),
  }),
});

export const SceneLightingSettings = sceneLightingDefaults;

/**
 * @typedef {typeof SceneLightingSettings} SceneLightingSettingsShape
 */
