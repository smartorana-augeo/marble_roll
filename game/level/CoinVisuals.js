import * as THREE from 'three';

/** World-space pickup radius for overlap tests (matches enlarged neon coin mesh). */
export const COIN_PICKUP_RADIUS = 0.46;

/**
 * Instantiates coin meshes (shared geometry). Caller owns disposal via {@link releaseCoinMeshes}.
 *
 * @param {THREE.Scene} scene
 * @param {{ coin: THREE.MeshStandardMaterial | THREE.ShaderMaterial }} materials
 * @param {{ id: string, position: number[] }[]} coins
 * @returns {{ entries: { id: string, mesh: THREE.Mesh }[], geometry: THREE.BufferGeometry | null }}
 */
export function addCoinMeshes(scene, materials, coins) {
  if (!coins?.length) {
    return { entries: [], geometry: null };
  }

  const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.14, 32);
  const mat = materials.coin;
  /** @type {{ id: string, mesh: THREE.Mesh }[]} */
  const entries = [];
  const hologram = Boolean(mat.userData?.hologramUniforms);

  for (const c of coins) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(c.position[0], c.position[1], c.position[2]);
    mesh.castShadow = !hologram;
    mesh.receiveShadow = !hologram;
    scene.add(mesh);
    entries.push({ id: c.id, mesh });
  }

  return { entries, geometry };
}
