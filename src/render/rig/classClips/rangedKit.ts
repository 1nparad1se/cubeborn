import type { Clip, Ease } from '../clips';
import type { Euler3, PoseMap } from '../animTypes';

/**
 * Clip authoring for the ranged classes (Ranger, Summoner, Sorceress).
 *
 * Keys are ABSOLUTE poses; the builder converts them to the stance-relative values the Animator
 * expects. A bone missing from a key holds its previous value (the stance before the first key);
 * 'rest' returns every bone to the stance. `root` / `rootPos` are offsets, never stance-relative.
 */
export type Pose = PoseMap;
export type K = [number, Pose | 'rest', Ease?];

export interface ClipOpts {
  /** Release / impact times: each fires an 'impulse' event. */
  hits?: number[];
  events?: { t: number; ev: string }[];
  show?: { t: number; grp: string; on: boolean }[];
  full?: boolean;
  loopFrom?: number;
  hold?: boolean;
  abs?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

const OFFSET = new Set(['rootPos', 'root']);

export function clipMaker(stance: PoseMap) {
  const base = (b: string): Euler3 => (OFFSET.has(b) ? [0, 0, 0] : ((stance as Record<string, Euler3>)[b] ?? [0, 0, 0]));
  return (name: string, dur: number, keys: K[], o: ClipOpts = {}): Clip => {
    const bones = new Set<string>();
    for (const [, p] of keys) if (p !== 'rest') for (const b of Object.keys(p)) bones.add(b);
    const cur: Record<string, Euler3> = {};
    for (const b of bones) cur[b] = base(b);
    const out = keys.map(([t, p, e]) => {
      const q: Record<string, Euler3> = {};
      for (const b of bones) {
        const v = p === 'rest' ? base(b) : ((p as Record<string, Euler3>)[b] ?? cur[b]);
        cur[b] = v;
        const s = o.abs ? [0, 0, 0] : base(b);
        q[b] = OFFSET.has(b) ? [v[0], v[1], v[2]] : [v[0] - s[0], v[1] - s[1], v[2] - s[2]];
      }
      return { t, p: q as PoseMap, e };
    });
    const events = [...(o.hits ?? []).map((t) => ({ t, ev: 'impulse' })), ...(o.events ?? [])].sort((a, b) => a.t - b.t);
    const clip: Clip = { name, dur, keys: out, fadeIn: o.fadeIn ?? 0.06, fadeOut: o.fadeOut ?? 0.12 };
    if (events.length) clip.events = events;
    if (o.show) clip.show = [...o.show].sort((a, b) => a.t - b.t);
    if (o.full) clip.full = true;
    if (o.abs) clip.abs = true;
    if (o.loopFrom !== undefined) clip.loopFrom = o.loopFrom;
    if (o.hold) clip.hold = true;
    return clip;
  };
}

/** Merges poses left to right (later bones win). */
export function mix(...ps: Pose[]): Pose {
  return Object.assign({}, ...ps);
}

/** Adds an offset to every listed bone of a pose (small trembles, recoils). */
export function nudge(p: Pose, d: Pose): Pose {
  const o: Record<string, Euler3> = { ...(p as Record<string, Euler3>) };
  for (const [b, v] of Object.entries(d as Record<string, Euler3>)) {
    const a = o[b] ?? [0, 0, 0];
    o[b] = [a[0] + v[0], a[1] + v[1], a[2] + v[2]];
  }
  return o as Pose;
}

/**
 * Whole-body rotation around the pelvis instead of the feet: root pitch `deg` (negative = back
 * flip, positive = forward roll) with `rootPos` compensating so the pelvis sits at (cy, cz)
 * relative to its rest height `h` (voxels).
 */
export function pivot(deg: number, h: number, cy = 0, cz = 0): Pose {
  const a = (deg * Math.PI) / 180;
  return { root: [deg, 0, 0], rootPos: [0, h + cy - h * Math.cos(a), cz - h * Math.sin(a)] };
}

export const LEGS0: Pose = { legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0] };

/** Knees bent into a crouch of depth k (0..1); pair with rootPos y ≈ -2.2·k. */
export function crouch(k: number, split = 0): Pose {
  return {
    legL: [-40 * k - split, 0, 4 * k],
    legR: [-40 * k + split, 0, -4 * k],
    shinL: [70 * k, 0, 0],
    shinR: [70 * k, 0, 0],
    footL: [-30 * k + split, 0, 0],
    footR: [-30 * k - split, 0, 0],
  };
}

/** Shared reaction clips: dazed stagger loop, heavy knockback flinch and a collapse. */
export function reactions(make: ReturnType<typeof clipMaker>, p: string, h: number): Record<string, Clip> {
  const daze = (s: number): Pose => ({ chest: [10, 8 * s, 7 * s], spine: [4, 0, 4 * s], head: [16, -14 * s, -10 * s], armL: [8, 0, 14], foreL: [-24, 0, 0], armR: [8, 0, -14], foreR: [-24, 0, 0], rootPos: [0.5 * s, -0.5, 0] });
  return {
    [`${p}_stagger`]: make(`${p}_stagger`, 1.0, [[0, daze(1)], [0.5, daze(-1)], [1.0, daze(1)]], { loopFrom: 0, fadeIn: 0.12 }),
    [`${p}_heavyhit`]: make(`${p}_heavyhit`, 0.5, [
      [0, 'rest'],
      [0.08, { chest: [-28, 6, 0], spine: [-10, 0, 0], head: [-26, 8, 0], armL: [-30, 0, 50], armR: [-30, 0, -50], foreL: [-30, 0, 0], foreR: [-30, 0, 0], rootPos: [0, 0.3, -1.4] }, 'out'],
      [0.24, { chest: [14, 0, 0], spine: [6, 0, 0], head: [10, 0, 0], armL: [0, 0, 20], armR: [0, 0, -20], foreL: [-40, 0, 0], foreR: [-40, 0, 0], rootPos: [0, -0.6, -1.0] }],
      [0.5, 'rest'],
    ], { fadeIn: 0.03 }),
    [`${p}_death`]: make(`${p}_death`, 1.2, [
      [0, { ...LEGS0, hips: [0, 0, 0], root: [0, 0, 0], rootPos: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] }],
      [0.12, { root: [0, 0, 0], rootPos: [0, 0.5, -0.6], chest: [-26, 10, 0], spine: [-10, 0, 0], head: [-26, 12, 0], armL: [-40, 0, 50], armR: [-40, 0, -50], foreL: [-30, 0, 0], foreR: [-30, 0, 0], legL: [-16, 0, 0], legR: [10, 0, 0], shinL: [16, 0, 0], shinR: [10, 0, 0] }, 'out'],
      // knees give way
      [0.42, { root: [0, 0, 0], rootPos: [0, -2.6, -0.6], chest: [24, 0, -8], spine: [10, 0, 0], head: [20, -10, 0], armL: [-10, 0, 20], armR: [-20, 0, -24], foreL: [-30, 0, 0], foreR: [-40, 0, 0], legL: [-60, 0, 6], legR: [-50, 0, -6], shinL: [110, 0, 0], shinR: [100, 0, 0], footL: [-40, 0, 0], footR: [-40, 0, 0] }, 'in'],
      // topple onto the side and back
      [0.78, { root: [-80, 0, 12], rootPos: [0, 1.4 - h * 0.12, -1.6], chest: [-6, 0, 10], spine: [0, 0, 0], head: [-10, 34, 0], armL: [-20, 0, 80], armR: [-30, 0, -70], foreL: [-10, 0, 0], foreR: [-40, 0, 0], legL: [-30, 0, 4], legR: [-10, 0, -6], shinL: [50, 0, 0], shinR: [14, 0, 0], footL: [-10, 0, 0], footR: [0, 0, 0] }, 'in'],
      [0.92, { root: [-76, 0, 10], rootPos: [0, 1.8 - h * 0.12, -1.6], chest: [-10, 0, 8], head: [-14, 30, 0] }, 'out'],
      [1.2, { root: [-82, 0, 12], rootPos: [0, 1.4 - h * 0.12, -1.6], chest: [-4, 0, 10], head: [-8, 38, 0] }],
    ], { abs: true, hold: true, fadeIn: 0.05, events: [{ t: 0.78, ev: 'death' }] }),
  };
}
