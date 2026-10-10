import * as THREE from 'three';
import type { VoxelModel } from '../data/types';
import { buildVoxelGeometry, hasTag, partClusters, partPivot, TAGS } from './VoxelGeometry';
import { makeVoxelMaterial } from './Materials';
import { getSkinMaterial, skinOf } from './creatureSkins';

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
 * Pixel-skinned creature models use their own skin atlas (the texture argument is then
 * ignored) and every separate limb of a tag (e.g. diagonal leg pairs) swings at its own joint.
 */
export class ArticulatedModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly parts: Partial<Record<string, THREE.Object3D>> = {};
  /** Every joint of a tag (several for split limbs); pose() drives them all. */
  protected joints: Partial<Record<string, THREE.Object3D[]>> = {};
  readonly flash = { value: 0 };
  private material: THREE.MeshLambertMaterial;
  private geometries: THREE.BufferGeometry[] = [];
  private skinned: boolean;
  protected heavy: number;
  /** Model height in world units at scale 1. */
  readonly top: number;

  constructor(model: VoxelModel, texture: THREE.Texture, castShadow = true) {
    const skin = skinOf(model);
    this.skinned = !!skin;
    this.material = (skin && getSkinMaterial(model, { flashUniform: this.flash, rim: 0.16 })) || makeVoxelMaterial({ map: texture, flashUniform: this.flash });
    this.root.add(this.body);
    const s = model.scale;
    // big creatures move with heavier, slower limbs
    let top = 0;
    for (const b of model.boxes) top = Math.max(top, (b[1] + b[4]) * s);
    this.heavy = Math.min(1, Math.max(0, (top - 2) / 3));
    this.top = top;
    const core = buildVoxelGeometry(model, { tag: '', skin: this.skinned });
    this.geometries.push(core);
    const coreMesh = new THREE.Mesh(core, this.material);
    coreMesh.castShadow = castShadow;
    this.body.add(coreMesh);
    for (const tag of TAGS) {
      if (!hasTag(model, tag)) continue;
      const groups = this.skinned ? partClusters(model, tag) : [null];
      const list: THREE.Object3D[] = [];
      for (const grp of groups) {
        const pv = grp ? partPivot(model, tag, grp) : partPivot(model, tag);
        const g = buildVoxelGeometry(model, { tag, pivot: pv, skin: this.skinned, only: grp ?? undefined });
        this.geometries.push(g);
        const pivot = new THREE.Group();
        pivot.position.set(pv[0] * s, pv[1] * s, pv[2] * s);
        const mesh = new THREE.Mesh(g, this.material);
        mesh.castShadow = castShadow;
        pivot.add(mesh);
        this.body.add(pivot);
        list.push(pivot);
      }
      this.parts[tag] = list[0];
      this.joints[tag] = list;
    }
  }

  pose(p: PoseInput) {
    const amp = this.skinned ? 0.55 - this.heavy * 0.15 : 0.7;
    const sw = Math.sin(p.walk) * amp * p.moving;
    const J = this.joints;
    const each = (tag: string, fn: (o: THREE.Object3D) => void) => {
      const l = J[tag];
      if (l) for (const o of l) fn(o);
    };
    each('legL', (o) => (o.rotation.x = sw));
    each('legR', (o) => (o.rotation.x = -sw));
    const castLift = p.cast * 2.4;
    each('armL', (o) => {
      o.rotation.x = -sw * 0.8 - castLift;
      o.rotation.z = -p.cast * 0.4;
    });
    each('armR', (o) => {
      o.rotation.x = sw * 0.8 - castLift - p.attack * 1.6;
      o.rotation.z = p.cast * 0.4;
    });
    const flap = Math.sin(p.time * (this.skinned ? 6 : 9)) * 0.55;
    each('wingL', (o) => (o.rotation.z = flap + 0.1));
    each('wingR', (o) => (o.rotation.z = -flap - 0.1));
    each('head', (o) => (o.rotation.x = Math.sin(p.time * 1.8) * 0.04 - p.cast * 0.15));
    each('tail', (o) => (o.rotation.y = Math.sin(p.time * 4) * 0.4));
    each('jaw', (o) => (o.rotation.x = Math.max(0, Math.sin(p.time * 3)) * 0.3 + p.cast * 0.5));
    // idle breathing + step bob; skinned mobs waddle side to side like blocky dungeon mobs
    this.body.position.y = Math.abs(Math.sin(p.walk)) * (this.skinned ? 0.1 + this.heavy * 0.08 : 0.06) * p.moving;
    this.body.rotation.z = this.skinned ? Math.sin(p.walk) * 0.05 * p.moving : 0;
    this.body.scale.y = 1 + Math.sin(p.time * 2.2) * (this.skinned ? 0.02 : 0.015) * (1 - p.moving);
    this.flash.value = p.flash;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    // skinned materials own a flash uniform per model instance; the atlas texture stays cached
    this.material.dispose();
  }
}
