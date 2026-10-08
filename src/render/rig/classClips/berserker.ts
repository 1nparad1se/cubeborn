import type { Clip } from '../clips';
import { crouch, ev, k, lunge, makeClip, mix, plus, restPose, tremble, tuck, type KeyIn, type Pose } from './heavyKit';

/**
 * Berserker action clips: slow, heavy wind-ups and crushing two-handed greatsword swings.
 * Two-handed poses were solved so the left hand stays on the hilt below the right one.
 * Spins rotate the root a full turn, then snap back to 0 (same facing) so fades never unwind.
 */

const STANCE: Pose = { chest: [-3, -6, 0], armR: [-57, -21, 15], foreR: [-37, 0, 0], handR: [-35, 9, -35], armL: [4, 0, 9], foreL: [-22, 0, 0], legL: [-3, 0, 5], legR: [3, 0, -5] };
const REST = restPose(STANCE);

/** Key poses (arms solved against the sword's grip; see the model in models/classRigs/berserker.ts). */
const P = {
  guard: { chest: [4, -10, 0], spine: [2, -4, 0], head: [-2, 12, 0], armR: [-83, 32, 30], foreR: [-28, 0, 0], handR: [45, -29, 41], armL: [-56, -7, -52], foreL: [0, 0, 0], handL: [9, 9, -2] },
  windR: { chest: [-4, -45, 0], spine: [-2, -15, 0], head: [0, 40, 0], armR: [-70, 9, 28], foreR: [-5, 0, 0], handR: [-42, -56, 0], armL: [-102, -32, -51], foreL: [0, 0, 0], handL: [45, -14, 13] },
  sweepMid: { chest: [8, 10, 0], spine: [3, 5, 0], head: [-4, -10, 0], armR: [-52, -21, 40], foreR: [0, 0, 0], handR: [0, -4, 17], armL: [-66, -13, -39], foreL: [-12, 0, 0], handL: [45, -7, -45] },
  sweepL: { chest: [8, 45, 0], spine: [3, 16, 0], head: [-4, -38, 0], armR: [-47, -7, 31], foreR: [-48, 0, 0], handR: [35, -6, 40], armL: [-85, -23, -55], foreL: [-7, 0, 0], handL: [39, 22, -17] },
  windL: { chest: [-4, 50, 0], spine: [-2, 16, 0], head: [0, -42, 0], armR: [-98, 10, 39], foreR: [-1, 0, 0], handR: [45, 27, 37], armL: [-72, -4, -56], foreL: [-1, 0, 0], handL: [-10, 38, 6] },
  sweepR: { chest: [8, -40, 0], spine: [3, -14, 0], head: [-4, 34, 0], armR: [-45, 16, 20], foreR: [-38, 0, 0], handR: [10, -53, 45], armL: [-83, -24, -54], foreL: [0, 0, 0], handL: [45, 7, -19] },
  overhead: { chest: [-12, -6, 0], spine: [-5, 0, 0], head: [-8, 6, 0], armR: [-116, 7, 33], foreR: [-31, 0, 0], handR: [1, -10, 13], armL: [-126, -20, -41], foreL: [-4, 0, 0], handL: [13, -11, 1] },
  slam: { chest: [26, 0, 0], spine: [10, 0, 0], head: [-18, 0, 0], legL: [-30, 0, 6], shinL: [40, 0, 0], footL: [-10, 0, 0], legR: [22, 0, -6], shinR: [25, 0, 0], footR: [-8, 0, 0], rootPos: [0, -1.6, 0.8], armR: [-91, 20, 37], foreR: [-9, 0, 0], handR: [37, -48, 22], armL: [-78, -17, -45], foreL: [-9, 0, 0], handL: [42, 14, -30] },
  plunge: { chest: [20, 0, 0], spine: [8, 0, 0], head: [-14, 0, 0], legL: [-26, 0, 6], shinL: [36, 0, 0], footL: [-10, 0, 0], legR: [20, 0, -6], shinR: [22, 0, 0], footR: [-8, 0, 0], rootPos: [0, -1.4, 0.6], armR: [-56, 10, 29], foreR: [-28, 0, 0], handR: [36, -60, 41], armL: [-83, -16, -46], foreL: [0, 0, 0], handL: [45, 0, -45] },
  diagHigh: { chest: [-6, -35, 0], spine: [-2, -12, 0], head: [0, 30, 0], armR: [-85, 34, 22], foreR: [-57, 0, 0], handR: [1, -42, 36], armL: [-79, -25, -44], foreL: [-40, 0, 0], handL: [43, -13, -8] },
  diagLow: { chest: [14, 35, 0], spine: [5, 12, 0], head: [-8, -30, 0], rootPos: [0, -0.6, 0.5], armR: [-53, 4, 26], foreR: [-33, 0, 0], handR: [39, -38, 19], armL: [-82, -21, -52], foreL: [0, 0, 0], handL: [45, 12, -15] },
  diagHighL: { chest: [-6, 35, 0], spine: [-2, 12, 0], head: [0, -30, 0], armR: [-79, 33, 30], foreR: [-54, 0, 0], handR: [34, -9, 45], armL: [-72, -7, -53], foreL: [-3, 0, 0], handL: [-3, 2, -1] },
  diagLowR: { chest: [14, -35, 0], spine: [5, -12, 0], head: [-8, 30, 0], rootPos: [0, -0.6, 0.5], armR: [-59, -1, 38], foreR: [-46, 0, 0], handR: [44, -12, 12], armL: [-77, -11, -47], foreL: [-11, 0, 0], handL: [43, 8, -33] },
  spin: { chest: [6, -20, 0], spine: [2, -6, 0], head: [-4, 20, 0], legL: [-10, 0, 10], shinL: [18, 0, 0], legR: [-10, 0, -10], shinR: [18, 0, 0], rootPos: [0, -0.8, 0], armR: [-44, 22, 26], foreR: [-44, 0, 0], handR: [-12, -55, 10], armL: [-80, -22, -45], foreL: [0, 0, 0], handL: [45, -13, -45] },
  raise1h: { chest: [-12, 0, 0], spine: [-4, 0, 0], head: [-20, 0, 0], armL: [-30, 0, 70], foreL: [-100, 0, 0], handL: [0, 0, 0], armR: [-135, 11, 5], foreR: [0, 0, 0], handR: [45, 4, 45] },
  cry: { chest: [-16, 0, 0], spine: [-6, 0, 0], head: [-24, 0, 0], armL: [-20, 0, 60], foreL: [-95, 0, 0], handL: [0, 0, 0], legL: [-6, 0, 10], legR: [-6, 0, -10], shinL: [10, 0, 0], shinR: [10, 0, 0], rootPos: [0, -0.5, 0], armR: [-17, -5, -14], foreR: [0, 0, 0], handR: [45, 9, 45] },
  wide: { chest: [-14, 0, 0], spine: [-5, 0, 0], head: [-16, 0, 0], armL: [-30, 0, 85], foreL: [-20, 0, 0], handL: [0, 0, 0], rootPos: [0, 0.6, 0], armR: [-145, -46, -86], foreR: [0, 0, 0], handR: [45, 29, 45] },
} satisfies Record<string, Pose>;

const clip = (name: string, dur: number, keys: KeyIn[], o: Parameters<typeof makeClip>[4] = {}): Clip => makeClip(REST, name, dur, keys, o);
const R = REST;
const root = (y: number): Pose => ({ root: [0, y, 0] });
const shoulderCharge: Pose = { chest: [26, -34, 0], spine: [10, -10, 0], head: [-22, 30, 0], armL: [-46, 0, -24], foreL: [-100, 0, 0] };

/** A sweep: wind-up, strike at `hit`, follow-through, recover. */
function sweep(name: string, dur: number, hit: number, wind: Pose, mid: Pose, end: Pose, legs: Pose = lunge(0.6)): Clip {
  return clip(name, dur, [
    k(0, R),
    k(hit * 0.55, mix(wind, crouch(0.25)), 'io'),
    k(hit, mix(mid, legs), 'out'),
    k(hit + (dur - hit) * 0.3, mix(end, legs)),
    k(dur, R),
  ], { events: [ev(hit)] });
}

/** A full spin with the blade out: root turns 0..360 then snaps back to 0. */
function spinKeys(t0: number, t1: number, hitT: number, hitA = 250): KeyIn[] {
  return [k(t0, mix(P.spin, root(0))), k(hitT, mix(P.spin, root(hitA)), 'in'), k(t1, mix(P.spin, root(360)), 'out'), k(t1 + 0.0005, mix(P.spin, root(0)), 'lin')];
}

const swing = (t: number, base: Pose, a: number) => tremble(base, a, t * 9, R);

export const BERSERKER_CLIPS: Record<string, Clip> = {
  bz_basic1: sweep('bz_basic1', 0.62, 0.3, P.windR, P.sweepMid, P.sweepL),
  bz_basic2: sweep('bz_basic2', 0.62, 0.3, P.windL, P.sweepMid, P.sweepR, lunge(0.5)),
  bz_basic3: clip('bz_basic3', 0.9, [k(0, R), k(0.3, mix(P.overhead, crouch(0.2)), 'io'), k(0.45, P.slam, 'out'), k(0.62, P.slam), k(0.9, R)], { events: [ev(0.45)] }),
  bz_dodge: clip('bz_dodge', 0.55, [k(0, R), k(0.06, mix(shoulderCharge, lunge(1, 1.2)), 'out'), k(0.32, mix(shoulderCharge, lunge(0.9, 1.0))), k(0.55, R)], { full: true }),
  bz_q1: sweep('bz_q1', 0.55, 0.28, P.windR, P.sweepMid, P.sweepL, lunge(0.8)),
  bz_q2: clip('bz_q2', 0.75, [k(0, R), k(0.1, mix(P.spin, root(0))), ...spinKeys(0.12, 0.45, 0.36, 290).slice(1), k(0.75, R)], { full: true, events: [ev(0.36)] }),
  bz_w: clip('bz_w', 1.0, [
    k(0, R),
    k(0.1, mix(P.guard, crouch(0.8)), 'io'),
    k(0.32, mix(P.overhead, tuck(1, 5.5)), 'out'),
    k(0.5, mix(P.overhead, tuck(0.5, 2.6)), 'in'),
    k(0.55, P.slam, 'in'),
    k(0.78, P.slam),
    k(1.0, R),
  ], { full: true, events: [ev(0.1, 'charge'), ev(0.55)] }),
  bz_e_in: clip('bz_e_in', 0.2, [k(0, R), k(0.2, mix(P.spin, root(0)), 'out')], { full: true }),
  bz_e_loop: clip('bz_e_loop', 0.3, [k(0, mix(P.spin, root(0))), k(0.1, mix(P.spin, root(120)), 'lin'), k(0.2, mix(P.spin, root(240)), 'lin'), k(0.3, mix(P.spin, root(360)), 'lin')], { full: true, fadeIn: 0.001, events: [ev(0.1)] }),
  bz_e_out: clip('bz_e_out', 0.5, [...spinKeys(0, 0.28, 0.2, 260), k(0.5, R)], { full: true, fadeIn: 0.001, events: [ev(0.2)] }),
  bz_r_charge: clip('bz_r_charge', 0.85, [
    k(0, R),
    k(0.25, mix(P.overhead, crouch(0.3)), 'out'),
    k(0.4, mix(swing(1, P.overhead, 2.5), crouch(0.33))),
    k(0.55, mix(swing(2, P.overhead, 2.5), crouch(0.3))),
    k(0.7, mix(swing(3, P.overhead, 2.5), crouch(0.34))),
    k(0.85, mix(P.overhead, crouch(0.3))),
  ], { loopFrom: 0.25, events: [ev(0.05, 'charge')] }),
  bz_r: clip('bz_r', 0.8, [k(0, mix(P.overhead, crouch(0.3))), k(0.18, mix(plus(P.overhead, { chest: [-6, 0, 0], armR: [-8, 0, 0], armL: [-8, 0, 0] }, R), crouch(0.15)), 'io'), k(0.32, P.slam, 'out'), k(0.56, P.slam), k(0.8, R)], { events: [ev(0.32)] }),
  bz_a: clip('bz_a', 0.55, [k(0, R), k(0.05, mix(shoulderCharge, lunge(1, 1.3)), 'out'), k(0.35, mix(shoulderCharge, lunge(0.9, 1.1))), k(0.55, R)], { full: true }),
  bz_s: clip('bz_s', 0.7, [k(0, R), k(0.15, mix(plus(P.cry, { chest: [30, 0, 0], head: [30, 0, 0], armL: [0, 0, -40] }, R), crouch(0.4))), k(0.3, P.cry, 'back'), k(0.5, plus(P.cry, { chest: [-2, 0, 0], head: [-4, 0, 0] }, R)), k(0.7, R)], { events: [ev(0.3)] }),
  bz_d1: clip('bz_d1', 0.45, [k(0, R), k(0.11, P.diagHigh, 'io'), k(0.22, mix(P.diagLow, lunge(0.5)), 'out'), k(0.32, mix(P.diagLow, lunge(0.5))), k(0.45, R)], { events: [ev(0.22)] }),
  bz_d2: clip('bz_d2', 0.45, [k(0, R), k(0.11, P.diagHighL, 'io'), k(0.22, mix(P.diagLowR, lunge(0.5)), 'out'), k(0.32, mix(P.diagLowR, lunge(0.5))), k(0.45, R)], { events: [ev(0.22)] }),
  bz_d3: clip('bz_d3', 0.85, [k(0, R), k(0.26, mix(P.overhead, crouch(0.2)), 'io'), k(0.42, P.plunge, 'out'), k(0.66, P.plunge), k(0.85, R)], { events: [ev(0.42)] }),
  bz_f: sweep('bz_f', 0.6, 0.28, P.windR, P.sweepMid, P.sweepL, lunge(0.9)),
  bz_ult: clip('bz_ult', 2.0, [
    k(0, R),
    k(0.1, mix(P.guard, crouch(0.9)), 'io'),
    k(0.36, mix(P.overhead, tuck(1, 7)), 'out'),
    k(0.56, mix(P.overhead, tuck(0.5, 3)), 'in'),
    k(0.6, mix(P.guard, crouch(0.7)), 'in'),
    k(0.67, mix(P.windL, crouch(0.4))),
    k(0.75, mix(P.sweepR, lunge(0.7)), 'out'),
    k(0.86, mix(P.spin, root(0))),
    k(1.1, mix(P.spin, root(300)), 'in'),
    k(1.18, mix(P.spin, root(360)), 'out'),
    k(1.1805, mix(P.spin, root(0)), 'lin'),
    k(1.32, mix(P.overhead, crouch(0.2)), 'io'),
    k(1.45, P.slam, 'out'),
    k(1.8, P.slam),
    k(2.0, R),
  ], { full: true, events: [ev(0.1, 'charge'), ev(0.75), ev(1.1), ev(1.45)] }),
  bz_identity: clip('bz_identity', 0.6, [k(0, R), k(0.12, mix(P.guard, crouch(0.6)), 'io'), k(0.25, P.wide, 'back'), k(0.45, plus(P.wide, { chest: [-2, 0, 0] }, R)), k(0.6, R)], { full: true, events: [ev(0.25)] }),
  bz_stagger: clip('bz_stagger', 1.0, [
    k(0, plus(R, { chest: [14, 0, 8], spine: [6, 0, 0], head: [18, 16, 10], armL: [10, 0, -4], foreR: [10, 0, 0], rootPos: [0, -0.5, 0] }, R)),
    k(0.5, plus(R, { chest: [12, 0, -8], spine: [5, 0, 0], head: [14, -16, -10], armL: [6, 0, 4], foreR: [6, 0, 0], rootPos: [0, -0.7, 0] }, R)),
    k(1.0, plus(R, { chest: [14, 0, 8], spine: [6, 0, 0], head: [18, 16, 10], armL: [10, 0, -4], foreR: [10, 0, 0], rootPos: [0, -0.5, 0] }, R)),
  ], { loopFrom: 0 }),
  bz_heavyhit: clip('bz_heavyhit', 0.5, [k(0, R), k(0.08, plus(R, { chest: [-24, 10, 0], spine: [-10, 0, 0], head: [-22, 0, 0], armL: [-30, 0, 40], rootPos: [0, 0.3, -1.4] }, R), 'out'), k(0.25, plus(R, { chest: [-10, 4, 0], spine: [-4, 0, 0], head: [-8, 0, 0], armL: [-10, 0, 20], rootPos: [0, -0.4, -1.0] }, R)), k(0.5, R)]),
  bz_victory: clip('bz_victory', 1.6, [k(0, R), k(0.6, P.raise1h, 'back'), k(1.1, plus(P.raise1h, { chest: [-3, 0, 0], head: [-4, 0, 0], foreL: [-10, 0, 0], rootPos: [0, -0.3, 0] }, R)), k(1.6, P.raise1h)], { loopFrom: 0.6, events: [ev(0.6)] }),
  bz_death: clip('bz_death', 1.2, [
    k(0, R),
    k(0.12, plus(R, { chest: [-22, 0, 6], spine: [-8, 0, 0], head: [-20, 0, 0], armL: [-30, 0, 40], rootPos: [0, 0.2, -0.8] }, R), 'out'),
    k(0.5, mix(plus(R, { chest: [24, 0, -6], spine: [10, 0, 0], head: [10, 0, 0], armL: [10, 0, 10], armR: [30, 0, 0] }, R), { legL: [-80, 0, 6], legR: [-80, 0, -6], shinL: [110, 0, 0], shinR: [110, 0, 0], footL: [-30, 0, 0], footR: [-30, 0, 0], rootPos: [0, -3.2, 0] })),
    k(0.9, mix(plus(R, { chest: [10, 0, 0], head: [-10, 20, 0], armL: [-150, 0, 20], armR: [-120, 0, -20] }, R), { root: [82, 0, 0], legL: [-10, 0, 6], legR: [-6, 0, -6], shinL: [20, 0, 0], shinR: [10, 0, 0], rootPos: [0, 2.4, 1.0] }), 'in'),
    k(1.2, mix(plus(R, { chest: [8, 0, 0], head: [-14, 24, 0], armL: [-155, 0, 24], armR: [-125, 0, -22] }, R), { root: [86, 0, 0], legL: [-8, 0, 6], legR: [-4, 0, -6], shinL: [16, 0, 0], shinR: [8, 0, 0], rootPos: [0, 2.3, 1.0] }), 'out'),
  ], { hold: true, full: true, fadeIn: 0.05, events: [ev(0.9, 'death')] }),
};

// the shared clip names map to the class versions (the weapon grip needs class-specific arm poses)
BERSERKER_CLIPS.victory = { ...BERSERKER_CLIPS.bz_victory, name: 'victory' };
BERSERKER_CLIPS.death = { ...BERSERKER_CLIPS.bz_death, name: 'death' };
