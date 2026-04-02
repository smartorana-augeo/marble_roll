/**
 * Scene lighting and fog for the built-in renderer — cooler than daylight, but fog/fill stay fairly neutral so
 * the world does not read as a heavy blue wash.
 * Consumed by `engine/gfx/WorldRenderer.js`; adjust colours and intensities only here.
 */

const sceneLightingDefaults = Object.freeze({
  fog: Object.freeze({
    /** Muted purple-grey haze — pushed back so mid-field platforms stay readable. */
    color: 0x443a4c,
    near: 58,
    far: 240,
  }),
  hemisphere: Object.freeze({
    skyColor: 0x686072,
    groundColor: 0x221e28,
    intensity: 0.58,
  }),
  /**
   * Omni fill so shadowed areas are not pitch black; keep intensity low to preserve contrast.
   * Set intensity to 0 to omit the light.
   */
  ambient: Object.freeze({
    color: 0x403a44,
    intensity: 0.32,
  }),
  directional: Object.freeze({
    /** Near-white key — slight warmth so platforms are not cold-blue. */
    color: 0xfffaf6,
    intensity: 0.95,
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
