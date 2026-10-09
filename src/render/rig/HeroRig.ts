import * as THREE from 'three';
import { addPart, GeoSink, type RigPart, type V3 } from './shapes';
import { makeVoxelMaterial } from '../Materials';
import type { AnimStyle } from './animTypes';
import { buildSkinAtlas, type SkinAtlas, type SkinBox } from './skins';

/**
 * Skeleton shared by every hero. Limbs have three segments (upper/lower/hand or foot),
 * the torso two (spine + chest), and there are spring bones for capes, robe flaps and
 * accessories that the animator drives with simple physics.
 */
export const BONES = [
  'root', 'hips', 'spine', 'chest', 'head',
  'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR',
  'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR',
  'gripL', 'gripR',
  'capeA', 'capeB', 'skirtF', 'skirtB', 'accA', 'accB', 'accC',
] as const;
export type BoneId = (typeof BONES)[number];

/** Body measurements in voxels. R limbs are on -x (the character faces +z). */
export interface Proportions {
  thigh: number;
  shin: number;
  /** Ankle height. */
  foot: number;
  /** Half the distance between the hip joints. */
  hipX: number;
  spine: number;
  /** Height of the shoulder line above the chest bone. */
  shoulderY: number;
  shoulderX: number;
  upperArm: number;
  foreArm: number;
  /** Head joint height above the chest bone. */
  neck: number;
  /** Chest depth: capes hang from its back. */
  depth: number;
}

export const DEFAULT_PROPS: Proportions = {
  thigh: 3.3,
  shin: 3.2,
  foot: 1.4,
  hipX: 1.45,
  spine: 1.5,
  shoulderY: 3.7,
  shoulderX: 3.7,
  upperArm: 2.9,
  foreArm: 2.7,
  neck: 4.3,
  depth: 3.6,
};

/** Spring bone wiring: which bone it hangs from and where. */
export interface SpringDef {
  parent: BoneId;
  at: V3;
  /** 'cape' swings back when running, 'flap' follows the legs, 'bob' bounces (hair, packs, hats), 'spin' turns continuously. */
  kind: 'cape' | 'flap' | 'bob' | 'spin';
  /** Spin axis and speed (rad/s) for 'spin'. */
  axis?: 'y' | 'z';
  speed?: number;
  /** Stiffness / damping multipliers. */
  k?: number;
  /** Rest angle (deg) around x. */
  rest?: number;
}

export interface GripDef {
  /** Grip point in hand-bone space (voxels). Default: centre of the palm. */
  at?: V3;
  /** Rest rotation of the held item around the grip point (deg). */
  rot?: V3;
  /** Uniform scale of the held item. */
  scale?: number;
}

export const DEFAULT_GRIP: V3 = [0, -0.8, 0.35];

export function gripAt(def: HeroRigDef, side: 'L' | 'R'): V3 {
  return def.grip?.[side]?.at ?? DEFAULT_GRIP;
}

export interface HeroRigDef {
  id: string;
  /** World units per voxel. */
  scale: number;
  /**
   * World units per voxel for animated translations (rootPos / hipsPos in clips and gaits).
   * Lets a rig change its voxel resolution without retuning every clip. Default: `scale`.
   */
  posScale?: number;
  props: Proportions;
  parts: RigPart[];
  springs?: Partial<Record<BoneId, SpringDef>>;
  /**
   * Weapon attach points: one grip bone per hand, at the palm. Held items are authored on
   * 'gripR' / 'gripL' in hand-bone coordinates (as if on the hand) and pivot around the grip
   * point; `rot` is the item's rest orientation in the palm (deg), kept through every animation.
   */
  grip?: Partial<Record<'L' | 'R', GripDef>>;
  /** Where weapon effects start (staff tip, blade, fist). */
  tip: { bone: BoneId; p: V3 };
  /** Visibility groups hidden at rest. */
  hidden?: string[];
  anim: AnimStyle;
}

/** Rest translation of each bone relative to its parent. */
export function restLayout(def: HeroRigDef): Record<BoneId, { parent: BoneId | null; at: V3 }> {
  const P = def.props;
  const hipY = P.thigh + P.shin + P.foot;
  const L: Record<string, { parent: BoneId | null; at: V3 }> = {
    root: { parent: null, at: [0, 0, 0] },
    hips: { parent: 'root', at: [0, hipY, 0] },
    spine: { parent: 'hips', at: [0, 1.1, 0] },
    chest: { parent: 'spine', at: [0, P.spine, 0] },
    head: { parent: 'chest', at: [0, P.neck, 0] },
    armL: { parent: 'chest', at: [P.shoulderX, P.shoulderY, 0] },
    foreL: { parent: 'armL', at: [0, -P.upperArm, 0] },
    handL: { parent: 'foreL', at: [0, -P.foreArm, 0] },
    armR: { parent: 'chest', at: [-P.shoulderX, P.shoulderY, 0] },
    foreR: { parent: 'armR', at: [0, -P.upperArm, 0] },
    handR: { parent: 'foreR', at: [0, -P.foreArm, 0] },
    legL: { parent: 'hips', at: [P.hipX, 0, 0] },
    shinL: { parent: 'legL', at: [0, -P.thigh, 0] },
    footL: { parent: 'shinL', at: [0, -P.shin, 0] },
    legR: { parent: 'hips', at: [-P.hipX, 0, 0] },
    shinR: { parent: 'legR', at: [0, -P.thigh, 0] },
    footR: { parent: 'shinR', at: [0, -P.shin, 0] },
    gripL: { parent: 'handL', at: gripAt(def, 'L') },
    gripR: { parent: 'handR', at: gripAt(def, 'R') },
    capeA: { parent: 'chest', at: [0, P.shoulderY + 0.2, -P.depth / 2 - 0.3] },
    capeB: { parent: 'capeA', at: [0, -4.2, 0] },
    skirtF: { parent: 'hips', at: [0, 0.2, 1.2] },
    skirtB: { parent: 'hips', at: [0, 0.2, -1.2] },
    accA: { parent: 'head', at: [0, 6, 0] },
    accB: { parent: 'chest', at: [0, 2, -2] },
    accC: { parent: 'head', at: [0, 3, -3] },
  };
  for (const [id, s] of Object.entries(def.springs ?? {})) if (s) L[id] = { parent: s.parent, at: s.at };
  return L as Record<BoneId, { parent: BoneId | null; at: V3 }>;
}

/** Grip-bone parts are authored in hand space; shift them so they pivot on the grip point. */
function toGripSpace(def: HeroRigDef, part: RigPart): RigPart {
  if (part.b !== 'gripL' && part.b !== 'gripR') return part;
  const g = gripAt(def, part.b === 'gripL' ? 'L' : 'R');
  return { ...part, p: [part.p[0] - g[0], part.p[1] - g[1], part.p[2] - g[2]] };
}

/** Skin atlases are built once per rig definition and shared by every instance. */
const ATLASES = new WeakMap<HeroRigDef, SkinAtlas | null>();

/** The pixel-skin atlas of a rig (null when the rig has no skinned parts). */
export function rigAtlas(def: HeroRigDef): SkinAtlas | null {
  let a = ATLASES.get(def);
  if (a === undefined) {
    const boxes: SkinBox[] = [];
    for (const p of def.parts) if (p.sk) boxes.push(p.sk.box);
    a = boxes.length && typeof document !== 'undefined' ? buildSkinAtlas(boxes) : null;
    ATLASES.set(def, a);
  }
  return a;
}

/**
 * A hero model built from a rig definition: one THREE.Group per bone, one merged mesh
 * per bone (plus one per visibility group), a shared material with hit flash and rim light.
 */
export class HeroRig {
  readonly root = new THREE.Group();
  readonly bones = {} as Record<BoneId, THREE.Group>;
  readonly rest = {} as Record<BoneId, THREE.Vector3>;
  /** Constant rest rotations (deg) added to the animated pose: the grip orientations. */
  readonly restRot: Partial<Record<BoneId, V3>> = {};
  readonly groups = new Map<string, THREE.Mesh[]>();
  readonly tip = new THREE.Object3D();
  readonly flash = { value: 0 };
  readonly material: THREE.MeshLambertMaterial;
  private geometries: THREE.BufferGeometry[] = [];
  private meshes: THREE.Mesh[] = [];

  constructor(readonly def: HeroRigDef, texture: THREE.Texture | null, opts: { shadows?: boolean; rim?: number; silhouette?: boolean } = {}) {
    const atlas = rigAtlas(def);
    this.material = opts.silhouette
      ? (new THREE.MeshBasicMaterial({ color: 0x14121c }) as unknown as THREE.MeshLambertMaterial)
      : makeVoxelMaterial({ map: (atlas ? atlas.texture : texture) ?? undefined, flashUniform: this.flash, rim: opts.rim ?? 0.35 });
    // pixel skins cut out their transparent texels (ragged hems, hood edges, fur)
    if (atlas && !opts.silhouette) this.material.alphaTest = 0.5;
    const layout = restLayout(def);
    const s = def.scale;
    for (const id of BONES) {
      const g = new THREE.Group();
      g.name = id;
      const l = layout[id];
      g.position.set(l.at[0] * s, l.at[1] * s, l.at[2] * s);
      this.rest[id] = g.position.clone();
      this.bones[id] = g;
    }
    for (const id of BONES) {
      const parent = layout[id].parent;
      (parent ? this.bones[parent] : this.root).add(this.bones[id]);
    }
    // parts grouped by bone and visibility group
    const sinks = new Map<string, GeoSink>();
    for (const side of ['L', 'R'] as const) {
      const rot = def.grip?.[side]?.rot;
      if (rot) this.restRot[('grip' + side) as BoneId] = rot;
      const gs = def.grip?.[side]?.scale;
      if (gs) this.bones[('grip' + side) as BoneId].scale.setScalar(gs);
    }
    for (const part0 of def.parts) {
      const part = toGripSpace(def, part0);
      const key = part.b + '|' + (part.grp ?? '');
      let sink = sinks.get(key);
      if (!sink) sinks.set(key, (sink = new GeoSink()));
      addPart(sink, part, s, atlas);
    }
    for (const [key, sink] of sinks) {
      if (sink.empty) continue;
      const [bone, grp] = key.split('|');
      const geo = sink.build();
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = !!opts.shadows;
      mesh.receiveShadow = false;
      this.meshes.push(mesh);
      (this.bones[bone as BoneId] ?? this.root).add(mesh);
      if (grp) {
        let list = this.groups.get(grp);
        if (!list) this.groups.set(grp, (list = []));
        list.push(mesh);
      }
    }
    for (const grp of def.hidden ?? []) this.show(grp, false);
    const tp = toGripSpace(def, { b: def.tip.bone, p: def.tip.p } as RigPart).p;
    this.tip.position.set(tp[0] * s, tp[1] * s, tp[2] * s);
    this.bones[def.tip.bone].add(this.tip);
  }

  show(grp: string, on: boolean) {
    for (const m of this.groups.get(grp) ?? []) m.visible = on;
  }

  set castShadow(v: boolean) {
    for (const m of this.meshes) m.castShadow = v;
  }

  /** Model height in world units (rest pose). */
  get height(): number {
    const box = new THREE.Box3().setFromObject(this.root);
    return box.max.y - box.min.y;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
