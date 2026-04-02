import { SceneMesh } from '../../engine/gfx/SceneMesh.js';

/** World-space pickup radius for overlap tests (matches enlarged neon coin mesh). */
export const COIN_PICKUP_RADIUS = 0.46;

/**
 * Instantiates coin meshes (shared primitive; one material).
 *
 * @param {SceneMesh[]} meshList
 * @param {Record<string, object>} materials
 * @param {{ id: string, position: number[] }[]} coins
 * @returns {{ entries: { id: string, mesh: SceneMesh }[] }}
 */
export function addCoinMeshes(meshList, materials, coins) {
  if (!coins?.length) {
    return { entries: [] };
  }

  const mat = materials.coin;
  const hologram = mat?.kind === 'hologram';

  /** @type {{ id: string, mesh: SceneMesh }[]} */
  const entries = [];

  for (const c of coins) {
    const mesh = new SceneMesh();
    mesh.primitive = 'cylinderCoin';
    mesh.materialKey = 'coin';
    mesh.position.x = c.position[0];
    mesh.position.y = c.position[1];
    mesh.position.z = c.position[2];
    mesh.scale.x = 0.4;
    mesh.scale.y = 0.14;
    mesh.scale.z = 0.4;
    mesh.castShadow = !hologram;
    mesh.receiveShadow = !hologram;
    meshList.push(mesh);
    entries.push({ id: c.id, mesh });
  }

  return { entries };
}
