import * as THREE from 'three';
import type { VoxelModel } from '../data/types';
import { buildVoxelGeometry, hasTag, partPivot, TAGS } from './VoxelGeometry';
import { makeVoxelMaterial } from './Materials';

export interface PoseInput {
  /** Walk cycle phase. */
  walk: number;
  /** 0..1 how much the walk animation applies. */
  moving: number;
  /** 0..1 arm attack swing. */
  attack: number;
  /** 0..1 casting (arms raised). */
  cast: number;
  time: number;
  flash: number;
}

/**
 * Voxel model split into tagged parts parented at their pivots so limbs, wings,
 * heads and jaws can rotate. Used for the hero, bosses and showcase screens.
 */
export class ArticulatedModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly parts: Partial<Record<string, THREE.Object3D>> = {};
  readonly flash = { value: 0 };
  private material: THREE.MeshLambertMaterial;
  private geometries: THREE.BufferGeometry[] = [];

  constructor(model: VoxelModel, texture: THREE.Texture, castShadow = true) {
    this.material = makeVoxelMaterial({ map: texture, flashUniform: this.flash });
    this.root.add(this.body);
    const s = model.scale;
    const core = buildVoxelGeometry(model, { tag: '' });
    this.geometries.push(core);
    const coreMesh = new THREE.Mesh(core, this.material);
    coreMesh.castShadow = castShadow;
    this.body.add(coreMesh);
    for (const tag of TAGS) {
      if (!hasTag(model, tag)) continue;
      const pv = partPivot(model, tag);
      const g = buildVoxelGeometry(model, { tag, pivot: pv });
      this.geometries.push(g);
      const pivot = new THREE.Group();
      pivot.position.set(pv[0] * s, pv[1] * s, pv[2] * s);
      const mesh = new THREE.Mesh(g, this.material);
      mesh.castShadow = castShadow;
      pivot.add(mesh);
      this.body.add(pivot);
      this.parts[tag] = pivot;
    }
  }

  pose(p: PoseInput) {
    const sw = Math.sin(p.walk) * 0.7 * p.moving;
    const P = this.parts;
    if (P.legL) P.legL.rotation.x = sw;
    if (P.legR) P.legR.rotation.x = -sw;
    const castLift = p.cast * 2.4;
    if (P.armL) {
      P.armL.rotation.x = -sw * 0.8 - castLift;
      P.armL.rotation.z = -p.cast * 0.4;
    }
    if (P.armR) {
      P.armR.rotation.x = sw * 0.8 - castLift - p.attack * 1.6;
      P.armR.rotation.z = p.cast * 0.4;
    }
    const flap = Math.sin(p.time * 9) * 0.55;
    if (P.wingL) P.wingL.rotation.z = flap + 0.1;
    if (P.wingR) P.wingR.rotation.z = -flap - 0.1;
    if (P.head) P.head.rotation.x = Math.sin(p.time * 1.8) * 0.04 - p.cast * 0.15;
    if (P.tail) P.tail.rotation.y = Math.sin(p.time * 4) * 0.4;
    if (P.jaw) P.jaw.rotation.x = Math.max(0, Math.sin(p.time * 3)) * 0.3 + p.cast * 0.5;
    // idle breathing + step bob
    this.body.position.y = Math.abs(Math.sin(p.walk)) * 0.06 * p.moving;
    this.body.scale.y = 1 + Math.sin(p.time * 2.2) * 0.015 * (1 - p.moving);
    this.flash.value = p.flash;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
