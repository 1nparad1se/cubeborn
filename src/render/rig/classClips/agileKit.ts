import type { Clip, Ease } from '../clips';
import type { Euler3, PoseMap } from '../animTypes';

/**
 * Clip authoring for the agile classes (Steel Fist, Deathblade, Reaper).
 *
 * Keys are written as ABSOLUTE poses (what the bones should read at that moment); the builder
 * turns them into the stance-relative values the Animator expects. A bone missing from a key
 * holds its value from the previous key (the stance before the first one); the string 'rest'
 * returns every bone to the stance. `rootPos` and `root` are offsets, never stance-relative.
 */
export type Pose = PoseMap;
export type K = [number, Pose | 'rest', Ease?];

export interface ClipOpts {
  /** Impact times: each fires an 'impulse' event. */
  hits?: number[];
  events?: { t: number; ev: string }[];
  full?: boolean;
  loopFrom?: number;
  hold?: boolean;
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
        const s = base(b);
        q[b] = OFFSET.has(b) ? [v[0], v[1], v[2]] : [v[0] - s[0], v[1] - s[1], v[2] - s[2]];
      }
      return { t, p: q as PoseMap, e };
    });
    const events = [...(o.hits ?? []).map((t) => ({ t, ev: 'impulse' })), ...(o.events ?? [])].sort((a, b) => a.t - b.t);
    const clip: Clip = { name, dur, keys: out };
    if (events.length) clip.events = events;
    if (o.full) clip.full = true;
    if (o.loopFrom !== undefined) clip.loopFrom = o.loopFrom;
    if (o.hold) clip.hold = true;
    if (o.fadeIn !== undefined) clip.fadeIn = o.fadeIn;
    if (o.fadeOut !== undefined) clip.fadeOut = o.fadeOut;
    return clip;
  };
}

/** Merges poses left to right (later bones win). */
export function mix(...ps: Pose[]): Pose {
  return Object.assign({}, ...ps);
}

/** Small tremble offsets added to a pose (charge wind-ups). */
export function shake(p: Pose, amt: number, bones: string[]): Pose {
  const q: Record<string, Euler3> = { ...(p as Record<string, Euler3>) };
  for (const b of bones) {
    const v = q[b];
    if (v) q[b] = [v[0] + amt, v[1] - amt * 0.5, v[2] + amt * 0.7];
  }
  return q as Pose;
}

/**
 * Backflip (or front flip) around the hips: root pitch keys with the root offset that keeps
 * the hips on a hop arc instead of swinging the body through the floor. dir -1 = backflip.
 */
export function flipKeys(t0: number, t1: number, dir: 1 | -1, hipY: number, hop: number, extra: (u: number) => Pose = () => ({})): K[] {
  const keys: K[] = [];
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = dir * 360 * u;
    const r = (a * Math.PI) / 180;
    // hips rotate to (0, hipY cos a, hipY sin a); offset puts them back on the arc
    const h = Math.sin(u * Math.PI) * hop;
    const y = hipY - hipY * Math.cos(r) + h;
    const z = -hipY * Math.sin(r);
    keys.push([t0 + (t1 - t0) * u, { root: [a, 0, 0], rootPos: [0, i === n ? 0 : y, i === n ? 0 : z], ...extra(u) }, 'lin']);
  }
  // a full turn equals no turn: snap back so later keys and the fade-out do not unwind it
  keys.push([t1 + 0.001, { root: [0, 0, 0] }, 'lin']);
  return keys;
}

const SWAP: Record<string, string> = {
  armL: 'armR', foreL: 'foreR', handL: 'handR', legL: 'legR', shinL: 'shinR', footL: 'footR', gripL: 'gripR',
  armR: 'armL', foreR: 'foreL', handR: 'handL', legR: 'legL', shinR: 'shinL', footR: 'footL', gripR: 'gripL',
};

/** Left/right mirror of a pose (swap limbs, negate yaw and roll, flip the sideways offset). */
export function mirror(p: Pose): Pose {
  const q: Record<string, Euler3> = {};
  for (const [b, v] of Object.entries(p as Record<string, Euler3>)) {
    if (b === 'rootPos') q[b] = [-v[0], v[1], v[2]];
    else q[SWAP[b] ?? b] = [v[0], -v[1], -v[2]];
  }
  return q as Pose;
}
