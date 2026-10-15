import type { RigPart, V3 } from '../../render/rig/shapes';
export type { V3 };
import { bc, bk, jr, type BlockOpts } from '../classRigs/blockKit';

/**
 * Creature models for the bestiary. Like the hero class models they are built from many small
 * flat-coloured bevelled blocks (blockKit), but on a free skeleton: each bone has a pivot relative
 * to its parent and an optional rest rotation, and parts are authored in their bone's local space.
 * `idle` lists gentle looping motions (breathing, bobbing, a floating ghost) for the menu preview.
 */

/** Voxel size shared with the hero models (a hero is about 32 voxels tall). */
export const MOB_SCALE = 0.057;

export interface MobBone {
  id: string;
  parent?: string;
  /** Pivot relative to the parent bone (voxels). */
  at: V3;
  /** Rest rotation (deg). */
  r?: V3;
}

/** One looping idle motion: a bone swings by `rot` (deg) and/or shifts by `pos` (voxels) on a sine. */
export interface MobIdle {
  b: string;
  rot?: V3;
  pos?: V3;
  /** Seconds per cycle. */
  period: number;
  /** Phase offset (fraction of a cycle). */
  phase?: number;
}

export interface MobDef {
  id: string;
  scale: number;
  bones: MobBone[];
  parts: RigPart[];
  idle: MobIdle[];
  /** Thumbnail / preview yaw (rad) for the 3/4 view. */
  yaw?: number;
}

/** Collects parts with mirrored helpers. */
export class MobBuilder {
  readonly parts: RigPart[] = [];

  add(...p: RigPart[]) {
    this.parts.push(...p);
  }

  /** Block from corner to corner on a bone. */
  b(bone: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, o?: BlockOpts) {
    this.parts.push(bk(bone, x0, y0, z0, x1, y1, z1, c, o));
  }

  /** The same block on both sides: `x0..x1` given for the +x side, mirrored to -x (bone names may differ). */
  m(boneL: string, boneR: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, o?: BlockOpts) {
    this.parts.push(bk(boneL, x0, y0, z0, x1, y1, z1, c, o));
    this.parts.push(bk(boneR, -x1, y0, z0, -x0, y1, z1, c, o));
  }

  /**
   * Scatters small blocks over the faces of a box (moss, fur tufts, rust, mottling). `faces` picks
   * the sides: t(op) f(ront) b(ack) l(eft +x) r(ight -x) d(own).
   */
  speck(bone: string, box: [number, number, number, number, number, number], colors: number[], n: number, seed: number, o: { size?: number; out?: number; faces?: string; g?: boolean; sizeY?: number } = {}) {
    const [x0, y0, z0, x1, y1, z1] = box;
    const faces = o.faces ?? 'tfblr';
    const s = o.size ?? 1;
    const sy = o.sizeY ?? s;
    const out = o.out ?? 0.3;
    for (let i = 0; i < n; i++) {
      const r1 = jr(seed * 13.7 + i * 1.31);
      const r2 = jr(seed * 7.3 + i * 2.17);
      const r3 = jr(seed * 3.1 + i * 0.73);
      const f = faces[Math.floor(r3 * faces.length) % faces.length];
      const c = colors[Math.floor(jr(seed + i * 5.9) * colors.length) % colors.length];
      const w = s * (0.6 + jr(i * 3.3 + seed) * 0.8);
      const h = sy * (0.6 + jr(i * 4.1 + seed) * 0.8);
      const lx = x0 + r1 * (x1 - x0);
      const ly = y0 + r2 * (y1 - y0);
      const lz = z0 + r2 * (z1 - z0);
      const lz2 = z0 + r1 * (z1 - z0);
      let p: [number, number, number, number, number, number];
      switch (f) {
        case 't':
          p = [lx - w / 2, y1 - 0.2, lz - w / 2, lx + w / 2, y1 + out, lz + w / 2];
          break;
        case 'd':
          p = [lx - w / 2, y0 - out, lz - w / 2, lx + w / 2, y0 + 0.2, lz + w / 2];
          break;
        case 'f':
          p = [lx - w / 2, ly - h / 2, z1 - 0.2, lx + w / 2, ly + h / 2, z1 + out];
          break;
        case 'b':
          p = [lx - w / 2, ly - h / 2, z0 - out, lx + w / 2, ly + h / 2, z0 + 0.2];
          break;
        case 'l':
          p = [x1 - 0.2, ly - h / 2, lz2 - w / 2, x1 + out, ly + h / 2, lz2 + w / 2];
          break;
        default:
          p = [x0 - out, ly - h / 2, lz2 - w / 2, x0 + 0.2, ly + h / 2, lz2 + w / 2];
      }
      this.parts.push(bk(bone, p[0], p[1], p[2], p[3], p[4], p[5], c, { bv: 0.06, g: o.g }));
    }
  }

  /** A w x h block running from point a to point b (voxels), turned to follow the segment (legs, branches, poles). */
  seg(bone: string, a: V3, b: V3, w: number, h: number, c: number, o: BlockOpts = {}) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const yaw = (Math.atan2(-dz, dx) * 180) / Math.PI;
    const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    this.parts.push(bc(bone, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, len, h, w, c, { ...o, r: [0, yaw, pitch] }));
  }

  /** A pointed crystal / spike / horn from base to tip: three stacked segments narrowing to the tip. */
  crystal(bone: string, base: V3, tip: V3, w: number, colors: number[], g = false) {
    const at = (t: number): V3 => [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t];
    const steps: [number, number, number][] = [
      [0, 0.55, 1],
      [0.45, 0.85, 0.66],
      [0.78, 1, 0.34],
    ];
    steps.forEach(([t0, t1, k], i) => this.seg(bone, at(t0), at(t1), w * k, w * k, colors[i % colors.length], { bv: 0.06, g }));
  }

  /** Small knobbly blocks scattered along the segment a..b (bark, moss, ice on a limb). */
  segSpeck(bone: string, a: V3, b: V3, rad: number, colors: number[], n: number, seed: number, size = 1, g = false) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const ox = (jr(seed + i * 1.7) - 0.5) * 2 * rad;
      const oy = (jr(seed * 2.1 + i * 2.3) - 0.5) * 2 * rad;
      const oz = (jr(seed * 3.7 + i * 0.9) - 0.5) * 2 * rad;
      const s = size * (0.6 + jr(seed + i * 4.4) * 0.7);
      const c = colors[Math.floor(jr(seed * 5.3 + i * 3.1) * colors.length) % colors.length];
      this.parts.push(bc(bone, a[0] + (b[0] - a[0]) * t + ox, a[1] + (b[1] - a[1]) * t + oy, a[2] + (b[2] - a[2]) * t + oz, s, s, s, c, { bv: 0.06, g }));
    }
  }

  /** Ragged strips hanging from y0 (rags, moss beards, fur fringes) along x from xa to xb at depth z..z+t. */
  fringe(bone: string, xa: number, xb: number, y0: number, z: number, t: number, len: number, colors: number[], seed: number, w = 1, along: 'x' | 'z' = 'x') {
    const n = Math.max(1, Math.round(Math.abs(xb - xa) / w));
    const step = (xb - xa) / n;
    for (let i = 0; i < n; i++) {
      const a = xa + i * step;
      const l = len * (0.45 + jr(seed * 5.1 + i * 1.7) * 0.75);
      const c = colors[Math.floor(jr(seed * 2.3 + i * 3.9) * colors.length) % colors.length];
      if (along === 'x') this.parts.push(bk(bone, Math.min(a, a + step), y0 - l, z, Math.max(a, a + step), y0, z + t, c, { bv: 0.06 }));
      else this.parts.push(bk(bone, z, y0 - l, Math.min(a, a + step), z + t, y0, Math.max(a, a + step), c, { bv: 0.06 }));
    }
  }
}

/** Light / mid / dark shades of one material. */
export type Shades = [number, number, number];

/** Humanoid skeleton measurements (voxels). Limbs hang down from their pivots in local space. */
export interface HumanDims {
  /** Hip joint height. */
  hipY: number;
  hipX: number;
  thigh: number;
  /** Chest pivot above the hips. */
  torso: number;
  /** Shoulder pivot above the chest pivot. */
  shoulderY: number;
  shoulderX: number;
  /** Head pivot above the chest pivot. */
  neck: number;
  upperArm: number;
}

/**
 * Bones root / hips / chest / head, armL+foreL, armR+foreR, legL+shinL, legR+shinR. L limbs are on
 * +x (the creature faces +z). `pose` sets rest rotations (deg) per bone.
 */
export function humanBones(d: HumanDims, pose: Partial<Record<string, V3>> = {}, extra: MobBone[] = []): MobBone[] {
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'hips', parent: 'root', at: [0, d.hipY, 0] },
    { id: 'chest', parent: 'hips', at: [0, d.torso, 0] },
    { id: 'head', parent: 'chest', at: [0, d.neck, 0] },
  ];
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    bones.push(
      { id: 'arm' + s, parent: 'chest', at: [k * d.shoulderX, d.shoulderY, 0] },
      { id: 'fore' + s, parent: 'arm' + s, at: [0, -d.upperArm, 0] },
      { id: 'leg' + s, parent: 'hips', at: [k * d.hipX, 0, 0] },
      { id: 'shin' + s, parent: 'leg' + s, at: [0, -d.thigh, 0] },
    );
  }
  bones.push(...extra);
  for (const b of bones) if (pose[b.id]) b.r = pose[b.id];
  return bones;
}

/** Breathing, a slow look around and a little arm sway. */
export function humanIdle(k = 1, period = 3.2): MobIdle[] {
  return [
    { b: 'hips', pos: [0, -0.15 * k, 0], period },
    { b: 'chest', rot: [-1.6 * k, 0, 0], period },
    { b: 'head', rot: [1.2 * k, 7 * k, 0], period: period * 2.3, phase: 0.1 },
    { b: 'armL', rot: [1.5 * k, 0, 1.5 * k], period, phase: 0.15 },
    { b: 'armR', rot: [1.5 * k, 0, -1.5 * k], period, phase: 0.15 },
    { b: 'foreL', rot: [-2 * k, 0, 0], period, phase: 0.25 },
    { b: 'foreR', rot: [-2 * k, 0, 0], period, phase: 0.25 },
  ];
}
