/**
 * Loads diffuse maps for road presentation (PROCEDURAL §5.8).
 * Engine layer — asset URLs are passed by the caller; no game-config imports.
 *
 * @param {{ straightUrl: string, plazaUrl: string }} urls
 * @returns {Promise<{ straight: import('three').Texture, plaza: import('three').Texture }>}
 */
import * as THREE from 'three';

export function loadRoadTextures({ straightUrl, plazaUrl }) {
  const loader = new THREE.TextureLoader();

  const loadOne = (url) =>
    new Promise((resolve, reject) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = 8;
          resolve(tex);
        },
        undefined,
        reject,
      );
    });

  return Promise.all([
    loadOne(straightUrl),
    loadOne(plazaUrl),
  ]).then(([straight, plaza]) => ({ straight, plaza }));
}
