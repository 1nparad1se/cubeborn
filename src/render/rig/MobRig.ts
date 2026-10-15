import * as THREE from 'three';
import { addPart, GeoSink, type RigPart } from './shapes';
import { voxelizeParts } from './voxelize';
import { makeVoxelMaterial } from '../Materials';
import type { MobDef } from '../../models/mobs/mobKit';

const DEG = Math.PI / 180;

/** Voxelised parts per bone, built once per creature definition. */
const PARTS = new WeakMap<MobDef, Map<string, RigPart[]>>();

function mobParts(def: MobDef): Map<string, RigPart[]> {
  let byBone = PARTS.get(def);
  if (byBone) return byBone;
  byBone = new Map();
  for (const p of def.parts) {
    let list = byBone.get(p.b);
    if (!list) byBone.set(p.b, (list = []));
    list.push(p);
  }
  // rotated pieces (spider legs, weapons, wings) stay crisp blocks; the rest is voxelised
  for (const [b, list] of byBone) {
    const turned = list.filter((p) => p.r && (p.r[0] || p.r[1] || p.r[2]));
    byBone.set(b, [...voxelizeParts(b, list.filter((p) => !turned.includes(p)), null), ...turned]);
  }
  PARTS.set(def, byBone);
  return byBone;
}

/** A bestiary creature: one group per bone, one merged mesh per bone, and a looping idle. */
export class MobRig {
  readonly root = new THREE.Group();
  readonly bones = new Map<string, THREE.Group>();
  readonly material: THREE.MeshLambertMaterial;
  private rest = new Map<string, { p: THREE.Vector3; r: THREE.Euler }>();
  private geometries: THREE.BufferGeometry[] = [];

  constructor(readonly def: MobDef, texture: THREE.Texture | null, opts: { shadows?: boolean; rim?: number } = {}) {
    this.material = makeVoxelMaterial({ map: texture ?? undefined, rim: opts.rim ?? 0.35 });
    const s = def.scale;
    for (const b of def.bones) {
      const g = new THREE.Group();
      g.name = b.id;
      g.position.set(b.at[0] * s, b.at[1] * s, b.at[2] * s);
      if (b.r) g.rotation.set(b.r[0] * DEG, b.r[1] * DEG, b.r[2] * DEG);
      this.rest.set(b.id, { p: g.position.clone(), r: g.rotation.clone() });
      this.bones.set(b.id, g);
    }
    for (const b of def.bones) (b.parent ? this.bones.get(b.parent)! : this.root).add(this.bones.get(b.id)!);
    for (const [bone, parts] of mobParts(def)) {
      const sink = new GeoSink();
      for (const p of parts) addPart(sink, p, s);
      if (sink.empty) continue;
      const geo = sink.build();
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = !!opts.shadows;
      (this.bones.get(bone) ?? this.root).add(mesh);
    }
  }

  /** Poses the idle loop at time `t` (seconds). */
  update(t: number) {
    const s = this.def.scale;
    for (const [id, r] of this.rest) {
      const g = this.bones.get(id)!;
      g.position.copy(r.p);
      g.rotation.copy(r.r);
    }
    for (const m of this.def.idle) {
      const g = this.bones.get(m.b);
      if (!g) continue;
      const w = Math.sin((t / m.period + (m.phase ?? 0)) * Math.PI * 2);
      if (m.rot) {
        g.rotation.x += m.rot[0] * w * DEG;
        g.rotation.y += m.rot[1] * w * DEG;
        g.rotation.z += m.rot[2] * w * DEG;
      }
      if (m.pos) g.position.add(new THREE.Vector3(m.pos[0] * w * s, m.pos[1] * w * s, m.pos[2] * w * s));
    }
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
