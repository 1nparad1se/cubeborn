import type { BoneId } from '../HeroRig';
import type { Euler3, PoseMap } from '../animTypes';
import type { Clip, Ease, Key } from '../clips';

/**
 * Clip authoring helpers for the heavy classes (Berserker, Paladin, Templar). Clips are
 * absolute: every key is a full pose; bones a key leaves out are filled from the class rest
 * pose (its stance), so keys blend cleanly and the clip ends where locomotion takes over.
 */

export type Pose = PoseMap;

/** Merges poses left to right (later bones win). */
export function mix(...ps: Pose[]): Pose {
  return Object.assign({}, ...ps);
}

/** Adds offsets to a pose (missing bones count as rest). */
export function plus(base: Pose, add: Pose, rest: Pose = {}): Pose {
  const out: Pose = { ...base };
  for (const [b, v] of Object.entries(add) as [BoneId | 'rootPos', Euler3][]) {
    const o = base[b] ?? rest[b] ?? [0, 0, 0];
    out[b] = [o[0] + v[0], o[1] + v[1], o[2] + v[2]];
  }
  return out;
}

export interface KeyIn {
  t: number;
  p: Pose;
  e?: Ease;
}

export const k = (t: number, p: Pose, e?: Ease): KeyIn => ({ t, p, e });

export interface ClipOpts {
  loopFrom?: number;
  hold?: boolean;
  full?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  events?: { t: number; ev: string }[];
  show?: { t: number; grp: string; on: boolean }[];
}

/** Builds an absolute clip whose keys all share the same bone set (missing bones = rest). */
export function makeClip(rest: Pose, name: string, dur: number, keys: KeyIn[], o: ClipOpts = {}): Clip {
  const bones = new Set<string>();
  for (const key of keys) for (const b of Object.keys(key.p)) bones.add(b);
  const full: Key[] = keys.map((key) => {
    const p: Pose = {};
    for (const b of bones) {
      const v = (key.p as Record<string, Euler3>)[b] ?? (rest as Record<string, Euler3>)[b] ?? [0, 0, 0];
      (p as Record<string, Euler3>)[b] = [v[0], v[1], v[2]];
    }
    return { t: key.t, p, e: key.e };
  });
  return { name, dur, keys: full, abs: true, ...o };
}

/** Rest pose of a class: its stance plus zeroed torso / legs / root. */
export function restPose(stance: Pose): Pose {
  const z: Euler3 = [0, 0, 0];
  return mix({ chest: z, spine: z, head: z, hips: z, root: z, rootPos: z, armL: z, foreL: z, handL: z, armR: z, foreR: z, handR: z, legL: z, legR: z, shinL: z, shinR: z, footL: z, footR: z }, stance);
}

/** Legs: crouch (0..1), lunge with the left foot forward (0..1), airborne tuck (0..1). */
export function crouch(a: number, drop = 1.6): Pose {
  return { legL: [-30 * a, 0, 4], legR: [-30 * a, 0, -4], shinL: [56 * a, 0, 0], shinR: [56 * a, 0, 0], footL: [-24 * a, 0, 0], footR: [-24 * a, 0, 0], rootPos: [0, -drop * a, 0] };
}
export function lunge(a: number, z = 0.8): Pose {
  return { legL: [-32 * a, 0, 6], shinL: [40 * a, 0, 0], footL: [-8 * a, 0, 0], legR: [24 * a, 0, -6], shinR: [22 * a, 0, 0], footR: [-14 * a, 0, 0], rootPos: [0, -1.4 * a, z * a] };
}
export function lungeR(a: number, z = 0.8): Pose {
  return { legR: [-32 * a, 0, -6], shinR: [40 * a, 0, 0], footR: [-8 * a, 0, 0], legL: [24 * a, 0, 6], shinL: [22 * a, 0, 0], footL: [-14 * a, 0, 0], rootPos: [0, -1.4 * a, z * a] };
}
export function tuck(a: number, h: number): Pose {
  return { legL: [-50 * a, 0, 6], legR: [-24 * a, 0, -6], shinL: [80 * a, 0, 0], shinR: [50 * a, 0, 0], footL: [-20 * a, 0, 0], footR: [-14 * a, 0, 0], rootPos: [0, h, 0] };
}

/** Small tremble offsets for charge / channel loops. */
export function tremble(base: Pose, amp: number, phase: number, rest: Pose = {}): Pose {
  const s = Math.sin(phase * 2.7) * amp;
  const c = Math.cos(phase * 3.3) * amp;
  return plus(base, { chest: [s, c * 0.6, 0], armR: [c, 0, s * 0.5], armL: [s, 0, c * 0.5], head: [c * 0.5, s, 0] }, rest);
}

export const ev = (t: number, e = 'impulse') => ({ t, ev: e });

/**
 * Minecraft Dungeons forward roll: a quick tuck, one somersault around the tucked body's centre
 * (root turns a full circle in 45° steps while `rootPos` keeps the pivot `c` voxels above the
 * ground), then a pop back up into the rest pose. `arms` keeps the weapon tucked in.
 */
export function forwardRoll(rest: Pose, dur: number, o: { c?: number; drop?: number; start?: number; spin?: number; arms?: Pose } = {}): KeyIn[] {
  const c = o.c ?? 6.2;
  const drop = o.drop ?? 1.0;
  const start = o.start ?? 0.05;
  const spin = o.spin ?? dur * 0.58;
  const tuckPose = mix(crouch(1.15, 0), { chest: [58, 0, 0], spine: [26, 0, 0], head: [34, 0, 0], legL: [-70, 0, 6], legR: [-62, 0, -6], shinL: [100, 0, 0], shinR: [96, 0, 0] }, o.arms ?? {});
  const keys: KeyIn[] = [k(0, rest), k(start, mix(tuckPose, { root: [0, 0, 0], rootPos: [0, -drop, 0.4] }), 'in')];
  const n = 8;
  for (let i = 1; i <= n; i++) {
    const a = ((i * 360) / n) * (Math.PI / 180);
    keys.push(k(start + (i * spin) / n, mix(tuckPose, { root: [(i * 360) / n, 0, 0], rootPos: [0, c - c * Math.cos(a) - drop, -c * Math.sin(a)] }), 'lin'));
  }
  keys.push(k(start + spin + 0.0005, mix(tuckPose, { root: [0, 0, 0], rootPos: [0, -drop, 0] }), 'lin'));
  keys.push(k(start + spin + (dur - start - spin) * 0.45, mix(crouch(0.45), { chest: [14, 0, 0], head: [-6, 0, 0], root: [0, 0, 0] }), 'out'));
  keys.push(k(dur, rest, 'io'));
  return keys;
}
