import * as THREE from 'three';

/**
 * Applies fog and lights from {@link ../config/SceneLightingSettings.js}.
 *
 * @param {THREE.Scene} scene
 * @param {import('../config/SceneLightingSettings.js').SceneLightingSettingsShape} config
 * @param {{ shadowMapSize?: number }} [perf] optional overrides (see `PerformanceSettings`)
 * @returns {{ hemisphere: THREE.HemisphereLight, directional: THREE.DirectionalLight, ambient: THREE.AmbientLight | null }}
 */
export function setupSceneLighting(scene, config, perf = {}) {
  const f = config.fog;
  scene.fog = new THREE.Fog(f.color, f.near, f.far);

  const h = config.hemisphere;
  const hemisphere = new THREE.HemisphereLight(h.skyColor, h.groundColor, h.intensity);
  scene.add(hemisphere);

  /** @type {THREE.AmbientLight | null} */
  let ambient = null;
  const a = config.ambient;
  if (a && a.intensity > 0) {
    ambient = new THREE.AmbientLight(a.color, a.intensity);
    scene.add(ambient);
  }

  const d = config.directional;
  const directional = new THREE.DirectionalLight(d.color, d.intensity);
  const [px, py, pz] = d.position;
  directional.position.set(px, py, pz);
  directional.castShadow = d.castShadow !== false;
  if (directional.castShadow && d.shadow) {
    const sc = d.shadow;
    const mapSize = typeof perf.shadowMapSize === 'number' ? perf.shadowMapSize : sc.mapSize;
    directional.shadow.mapSize.set(mapSize, mapSize);
    if (typeof sc.radius === 'number') {
      directional.shadow.radius = sc.radius;
    }
    directional.shadow.camera.near = sc.cameraNear;
    directional.shadow.camera.far = sc.cameraFar;
    directional.shadow.camera.left = sc.cameraLeft;
    directional.shadow.camera.right = sc.cameraRight;
    directional.shadow.camera.top = sc.cameraTop;
    directional.shadow.camera.bottom = sc.cameraBottom;
  }
  scene.add(directional);

  return { hemisphere, directional, ambient };
}
