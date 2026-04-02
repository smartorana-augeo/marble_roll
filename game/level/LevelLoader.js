import { Body, Box, Vec3 } from 'cannon-es';
import { SceneMesh } from '../../engine/gfx/SceneMesh.js';
import { addCoinMeshes } from './CoinVisuals.js';

/**
 * Builds static level geometry for cannon-es and the built-in renderer; supports teardown.
 */
export class LevelLoader {
  constructor() {
    /** @type {import('cannon-es').Body[]} */
    this._staticBodies = [];
    /** @type {SceneMesh | null} */
    this._goalMarker = null;
    /** @type {SceneMesh[]} */
    this._zoneMeshes = [];
  }

  /**
   * @param {import('cannon-es').World} world
   * @param {SceneMesh[]} meshList
   */
  clear(world, meshList) {
    for (const b of this._staticBodies) {
      world.removeBody(b);
    }
    for (let i = meshList.length - 1; i >= 0; i--) {
      const m = meshList[i];
      if (m.materialKey === 'marble') continue;
      meshList.splice(i, 1);
    }
    this._goalMarker = null;
    this._zoneMeshes = [];
    this._staticBodies = [];
  }

  /**
   * @param {import('cannon-es').World} world
   * @param {SceneMesh[]} meshList
   * @param {Record<string, object>} materials
   * @param {object} descriptor
   */
  build(world, meshList, materials, descriptor) {
    const qDefault = [0, 0, 0, 1];
    for (const entry of descriptor.static) {
      if (entry.type !== 'box') continue;
      const [hx, hy, hz] = entry.halfExtents;
      const solid = entry.collision !== false;

      if (solid) {
        const shape = new Box(new Vec3(hx, hy, hz));
        const body = new Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(entry.position[0], entry.position[1], entry.position[2]);
        const q = entry.quaternion ?? qDefault;
        body.quaternion.set(q[0], q[1], q[2], q[3]);
        world.addBody(body);
        this._staticBodies.push(body);
      }

      const isLattice = entry.lattice === true;
      const mesh = new SceneMesh();
      mesh.primitive = isLattice ? 'boxWire' : 'box';
      mesh.materialKey = isLattice
        ? 'lattice'
        : LevelLoader._meshMaterialForBox(materials, entry, hx, hz);
      mesh.position.x = entry.position[0];
      mesh.position.y = entry.position[1];
      mesh.position.z = entry.position[2];
      const q = entry.quaternion ?? qDefault;
      mesh.quaternion.x = q[0];
      mesh.quaternion.y = q[1];
      mesh.quaternion.z = q[2];
      mesh.quaternion.w = q[3];
      mesh.scale.x = hx;
      mesh.scale.y = hy;
      mesh.scale.z = hz;
      mesh.receiveShadow = true;
      mesh.castShadow = !isLattice;
      meshList.push(mesh);
    }

    const hasZones = descriptor.zones && descriptor.zones.start && descriptor.zones.end;
    /** @type {{ position: { x: number, y: number, z: number }, radius: number } | null} */
    let goal = null;

    if (hasZones) {
      const zs = descriptor.zones.start;
      const ze = descriptor.zones.end;
      this._addZoneDisc(meshList, zs, 'zoneStart');
      this._addZoneDisc(meshList, ze, 'zoneEnd');

      goal = {
        position: { x: ze.position[0], y: ze.position[1], z: ze.position[2] },
        radius: ze.radius,
      };
    } else if (descriptor.goal) {
      const g = descriptor.goal;
      const gm = new SceneMesh();
      gm.primitive = 'sphereLow';
      gm.materialKey = 'goal';
      gm.position.x = g.position[0];
      gm.position.y = g.position[1];
      gm.position.z = g.position[2];
      const r = g.radius;
      gm.scale.x = r;
      gm.scale.y = r;
      gm.scale.z = r;
      gm.castShadow = false;
      gm.receiveShadow = true;
      meshList.push(gm);
      this._goalMarker = gm;
      goal = {
        position: { x: g.position[0], y: g.position[1], z: g.position[2] },
        radius: g.radius,
      };
    }

    const coinList = Array.isArray(descriptor.coins) ? descriptor.coins : [];
    const coinBundle = addCoinMeshes(meshList, materials, coinList);

    return {
      spawn: descriptor.spawn,
      goal,
      zones: hasZones ? descriptor.zones : null,
      coinEntries: coinBundle.entries,
    };
  }

  /**
   * @param {Record<string, object>} materials
   * @param {object} entry
   */
  static _meshMaterialForBox(materials, entry, _hx, _hz) {
    return LevelLoader._materialForSegment(materials, entry);
  }

  /**
   * @param {Record<string, object>} materials
   * @param {object} entry
   * @returns {string}
   */
  static _materialForSegment(materials, entry) {
    const k = entry.materialKey;
    if (k === 'plaza' && materials.plaza) return 'plaza';
    if (k === 'path' && materials.path) return 'path';
    if (k === 'pathWide' && materials.pathWide) return 'pathWide';
    if (k === 'ramp' && materials.ramp) return 'ramp';
    return 'static';
  }

  /**
   * @param {SceneMesh[]} meshList
   * @param {{ position: number[], radius: number }} zone
   * @param {'zoneStart' | 'zoneEnd'} matKey
   */
  _addZoneDisc(meshList, zone, matKey) {
    const r = zone.radius;
    const h = 0.07;
    /** Slight lift so the disc base is not coplanar with the deck top (avoids shimmer with the plaza slab). */
    const aboveDeck = 0.02;
    const mesh = new SceneMesh();
    mesh.primitive = 'cylinderCoin';
    mesh.materialKey = matKey;
    mesh.position.x = zone.position[0];
    mesh.position.y = zone.position[1] + h / 2 + aboveDeck;
    mesh.position.z = zone.position[2];
    mesh.scale.x = r;
    mesh.scale.y = h;
    mesh.scale.z = r;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    meshList.push(mesh);
    this._zoneMeshes.push(mesh);
  }
}
