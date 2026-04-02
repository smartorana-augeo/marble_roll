import { Body, Box, Vec3 } from 'cannon-es';
import * as THREE from 'three';

/** Straight / plaza meshes in the road pack are authored at roughly this span (world units). */
const ROAD_TEXTURE_TILE_UNITS = 12;

/**
 * Builds static level geometry for cannon-es and Three.js; supports teardown.
 * Supports optional `zones` (flat disc markers) instead of a single spherical goal.
 *
 * Procedural descriptors from `generateProcgenDescriptor` — `marble_roll/gen/docs/PROCEDURAL_L_SYSTEM_LEVELS.md`.
 * Design intent: `marble_roll/gen/docs/LEVEL_DESIGN_AND_PROCEDURE.md`. Theme: `marble_roll/gen/docs/THE_LADDER.md`.
 */
export class LevelLoader {
  constructor() {
    /** @type {import('cannon-es').Body[]} */
    this._staticBodies = [];
    /** @type {THREE.Mesh[]} */
    this._meshes = [];
    /** @type {THREE.Mesh | null} */
    this._goalMarker = null;
    /** @type {THREE.Mesh[]} */
    this._zoneMeshes = [];
  }

  /**
   * @param {import('cannon-es').World} world
   * @param {THREE.Scene} scene
   */
  clear(world, scene) {
    for (const b of this._staticBodies) {
      world.removeBody(b);
    }
    for (const m of this._meshes) {
      scene.remove(m);
      m.geometry?.dispose();
      LevelLoader._disposeMeshMaterials(m.material);
    }
    for (const m of this._zoneMeshes) {
      scene.remove(m);
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose?.());
      else m.material?.dispose?.();
    }
    if (this._goalMarker) {
      scene.remove(this._goalMarker);
      this._goalMarker.geometry?.dispose();
      if (Array.isArray(this._goalMarker.material)) {
        this._goalMarker.material.forEach((mat) => mat.dispose?.());
      } else this._goalMarker.material?.dispose?.();
      this._goalMarker = null;
    }
    this._staticBodies = [];
    this._meshes = [];
    this._zoneMeshes = [];
  }

  /**
   * @param {import('cannon-es').World} world
   * @param {THREE.Scene} scene
   * @param {{ static: THREE.MeshStandardMaterial, goal: THREE.MeshStandardMaterial, zoneStart?: THREE.MeshStandardMaterial, zoneEnd?: THREE.MeshStandardMaterial, lattice?: THREE.MeshStandardMaterial, roadStraight?: THREE.Texture, roadPlaza?: THREE.Texture }} materials
   * @param {object} descriptor
   */
  build(world, scene, materials, descriptor) {
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

      const geo = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
      const isLattice = entry.lattice === true;
      const mat = isLattice
        ? (materials.lattice ?? materials.static)
        : LevelLoader._meshMaterialForBox(materials, entry, hx, hz);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(entry.position[0], entry.position[1], entry.position[2]);
      const q = entry.quaternion ?? qDefault;
      mesh.quaternion.set(q[0], q[1], q[2], q[3]);
      mesh.receiveShadow = true;
      mesh.castShadow = !isLattice;
      scene.add(mesh);
      this._meshes.push(mesh);
    }

    const hasZones = descriptor.zones && descriptor.zones.start && descriptor.zones.end;
    /** @type {{ position: THREE.Vector3, radius: number } | null} */
    let goal = null;

    if (hasZones) {
      const zs = descriptor.zones.start;
      const ze = descriptor.zones.end;
      const matS = materials.zoneStart ?? materials.goal;
      const matE = materials.zoneEnd ?? materials.goal;

      this._addZoneDisc(scene, zs, matS, 'start');
      this._addZoneDisc(scene, ze, matE, 'end');

      goal = {
        position: new THREE.Vector3(ze.position[0], ze.position[1], ze.position[2]),
        radius: ze.radius,
      };
    } else if (descriptor.goal) {
      const g = descriptor.goal;
      const goalGeo = new THREE.SphereGeometry(g.radius, 24, 18);
      const goalMat = materials.goal;
      this._goalMarker = new THREE.Mesh(goalGeo, goalMat);
      this._goalMarker.position.set(g.position[0], g.position[1], g.position[2]);
      scene.add(this._goalMarker);
      goal = {
        position: new THREE.Vector3(g.position[0], g.position[1], g.position[2]),
        radius: g.radius,
      };
    }

    return {
      spawn: descriptor.spawn,
      goal,
      zones: hasZones ? descriptor.zones : null,
    };
  }

  /**
   * @param {THREE.Material | THREE.Material[]} material
   */
  static _disposeMeshMaterials(material) {
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      if (!mat) continue;
      const m = /** @type {THREE.MeshStandardMaterial} */ (mat);
      if (m.map) m.map.dispose();
      m.dispose?.();
    }
  }

  /**
   * @param {{ static: THREE.MeshStandardMaterial, plaza?: THREE.MeshStandardMaterial, path?: THREE.MeshStandardMaterial, pathWide?: THREE.MeshStandardMaterial, ramp?: THREE.MeshStandardMaterial, lattice?: THREE.MeshStandardMaterial, roadStraight?: THREE.Texture, roadPlaza?: THREE.Texture }} materials
   * @param {object} entry
   * @param {number} hx
   * @param {number} hz
   * @returns {THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]}
   */
  static _meshMaterialForBox(materials, entry, hx, hz) {
    const road = LevelLoader._roadFaceMaterialsIfAvailable(materials, entry, hx, hz);
    if (road) return road;
    return LevelLoader._materialForSegment(materials, entry);
  }

  /**
   * Six materials: +X, -X, +Y (walkable top), -Y, +Z, -Z (Three.js box face order).
   * @param {{ roadStraight?: THREE.Texture, roadPlaza?: THREE.Texture }} materials
   * @param {object} entry
   * @param {number} hx
   * @param {number} hz
   * @returns {THREE.MeshStandardMaterial[] | null}
   */
  static _roadFaceMaterialsIfAvailable(materials, entry, hx, hz) {
    const texBase = materials.roadStraight;
    if (!texBase) return null;

    const k = entry.materialKey;
    const plazaTex = materials.roadPlaza ?? texBase;
    const source = k === 'plaza' ? plazaTex : texBase;
    const topMap = source.clone();
    topMap.repeat.set((2 * hx) / ROAD_TEXTURE_TILE_UNITS, (2 * hz) / ROAD_TEXTURE_TILE_UNITS);
    topMap.offset.set(0, 0);
    topMap.needsUpdate = true;

    const top = new THREE.MeshStandardMaterial({
      map: topMap,
      roughness: 0.78,
      metalness: 0.05,
    });
    if (k === 'ramp') {
      top.color.setHex(0xb8e8d0);
    }

    const sideColour =
      k === 'plaza' ? 0x2a2620 : k === 'ramp' ? 0x1e2a24 : 0x222222;
    const side = new THREE.MeshStandardMaterial({
      color: sideColour,
      roughness: 0.88,
      metalness: 0.04,
    });

    return [side, side, top, side, side, side];
  }

  /**
   * @param {{ static: THREE.MeshStandardMaterial, plaza?: THREE.MeshStandardMaterial, path?: THREE.MeshStandardMaterial, pathWide?: THREE.MeshStandardMaterial, ramp?: THREE.MeshStandardMaterial, lattice?: THREE.MeshStandardMaterial }} materials
   * @param {object} entry
   * @returns {THREE.MeshStandardMaterial}
   */
  static _materialForSegment(materials, entry) {
    const k = entry.materialKey;
    if (k === 'plaza' && materials.plaza) return materials.plaza;
    if (k === 'path' && materials.path) return materials.path;
    if (k === 'pathWide' && materials.pathWide) return materials.pathWide;
    if (k === 'ramp' && materials.ramp) return materials.ramp;
    return materials.static;
  }

  /**
   * @param {THREE.Scene} scene
   * @param {{ position: number[], radius: number }} zone
   * @param {THREE.MeshStandardMaterial} mat
   * @param {string} _role
   */
  _addZoneDisc(scene, zone, mat, _role) {
    const r = zone.radius;
    const h = 0.07;
    const geo = new THREE.CylinderGeometry(r, r, h, 40);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(zone.position[0], zone.position[1] + h / 2, zone.position[2]);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    this._zoneMeshes.push(mesh);
  }
}
