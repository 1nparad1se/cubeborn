import type { Clip } from '../clips';
import { crouch, ev, forwardRoll, k, lunge, makeClip, mix, plus, restPose, type KeyIn, type Pose } from './heavyKit';

/**
 * Paladin action clips: crisp knightly sword cuts, shield bashes and holy gestures. The shield
 * arm keeps its raised guard unless a pose moves it; sword poses were solved against the grip.
 */

const STANCE: Pose = { armL: [-25, -14, -20], foreL: [-60, 0, 0], handL: [-3, -12, 21], armR: [-10, 0, -6], foreR: [-38, 0, 0], handR: [30, 0, 0], legL: [-4, 0, 3], legR: [4, 0, -3] };
const REST = restPose(STANCE);

/** Key poses (sword arm or shield arm solved against the grips; see models/classRigs/paladin.ts). */
const P = {
  swordHigh: { chest: [-6, -30, 0], spine: [-2, -10, 0], head: [0, 26, 0], armR: [-74, 9, 16], foreR: [-73, 0, 0], handR: [29, -3, 34] },
  slashLow: { chest: [10, 32, 0], spine: [4, 10, 0], head: [-6, -26, 0], armR: [-49, -39, 20], foreR: [0, 0, 0], handR: [45, 24, 45] },
  backHigh: { chest: [-6, 30, 0], spine: [-2, 10, 0], head: [0, -26, 0], armR: [-87, 12, 27], foreR: [-51, 0, 0], handR: [45, 44, 45] },
  slashLowR: { chest: [10, -32, 0], spine: [4, -10, 0], head: [-6, 26, 0], armR: [-51, -29, 27], foreR: [0, 0, 0], handR: [45, 12, 45] },
  thrustBack: { chest: [-4, -35, 0], spine: [-2, -12, 0], head: [0, 30, 0], armR: [-14, 43, -44], foreR: [-68, 0, 0], handR: [45, 39, 45] },
  thrust: { chest: [12, 25, 0], spine: [4, 8, 0], head: [-8, -22, 0], armR: [-101, -44, -13], foreR: [0, 0, 0], handR: [45, 21, 45] },
  point: { chest: [0, 15, 0], spine: [0, 5, 0], head: [-4, -12, 0], armR: [-84, -73, 11], foreR: [0, 0, 0], handR: [45, 32, 45] },
  skyward: { chest: [-12, 0, 0], spine: [-4, 0, 0], head: [-18, 0, 0], armR: [-135, -13, 6], foreR: [0, 0, 0], handR: [45, 23, 45] },
  salute: { chest: [-4, 0, 0], head: [-2, 0, 0], armR: [-59, 7, 27], foreR: [-48, 0, 0], handR: [20, 34, 22] },
  plant: { chest: [22, 0, 0], spine: [8, 0, 0], head: [-14, 0, 0], armR: [-1, -53, 60], foreR: [0, 0, 0], handR: [45, -3, 45] },
  bash: { chest: [10, 20, 0], spine: [4, 8, 0], head: [-6, -16, 0], armL: [-62, 19, -47], foreL: [0, 0, 0], handL: [-18, -35, 5] },
  shieldHigh: { chest: [4, 10, 0], spine: [2, 4, 0], head: [-2, -6, 0], armL: [-74, 14, -46], foreL: [-7, 0, 0], handL: [16, -16, 32] },
  shieldBrace: { chest: [8, 6, 0], spine: [3, 2, 0], head: [-4, -4, 0], armL: [-64, 4, -40], foreL: [-6, 0, 0], handL: [-22, -24, 23] },
} satisfies Record<string, Pose>;

const clip = (name: string, dur: number, keys: KeyIn[], o: Parameters<typeof makeClip>[4] = {}): Clip => makeClip(REST, name, dur, keys, o);
const R = REST;

/** Sword cut: wind-up, strike at `hit`, short follow-through, recover. */
function cut(name: string, dur: number, hit: number, wind: Pose, end: Pose, legs: Pose = lunge(0.4, 0.6)): Clip {
  return clip(name, dur, [k(0, R), k(hit * 0.5, wind, 'io'), k(hit, mix(end, legs), 'out'), k(hit + (dur - hit) * 0.4, mix(end, legs)), k(dur, R)], { events: [ev(hit)] });
}

const shieldSword = (shield: Pose, sword: Pose): Pose => mix(sword, { armL: shield.armL!, foreL: shield.foreL!, handL: shield.handL! });

export const PALADIN_CLIPS: Record<string, Clip> = {
  pl_basic1: cut('pl_basic1', 0.45, 0.2, P.swordHigh, P.slashLow),
  pl_basic2: cut('pl_basic2', 0.45, 0.2, P.backHigh, P.slashLowR),
  pl_basic3: clip('pl_basic3', 0.6, [k(0, R), k(0.14, plus(P.shieldBrace, { chest: [-8, -16, 0], armL: [20, 0, 0] }, R), 'io'), k(0.28, mix(P.bash, lunge(0.8, 1)), 'out'), k(0.42, mix(P.bash, lunge(0.6, 0.8))), k(0.6, R)], { events: [ev(0.28)] }),
  pl_dodge: clip('pl_dodge', 0.5, forwardRoll(R, 0.5, { arms: { armR: [-30, 0, -45], foreR: [-20, 0, 0], handR: [0, 0, 0] } }), { full: true }),
  pl_q1: cut('pl_q1', 0.4, 0.18, P.swordHigh, P.slashLow),
  pl_q2: cut('pl_q2', 0.4, 0.18, P.backHigh, P.slashLowR),
  pl_q3: clip('pl_q3', 0.6, [k(0, R), k(0.16, mix(P.thrustBack, crouch(0.2)), 'io'), k(0.3, mix(P.thrust, lunge(0.9, 1.2)), 'out'), k(0.42, mix(P.thrust, lunge(0.8, 1.0))), k(0.6, R)], { events: [ev(0.3)] }),
  pl_w: clip('pl_w', 0.5, [k(0, R), k(0.05, mix(P.shieldBrace, lunge(0.6, 0.6)), 'io'), k(0.22, mix(P.bash, lunge(1, 1.3)), 'out'), k(0.32, mix(P.bash, lunge(0.8, 1))), k(0.5, R)], { full: true, events: [ev(0.22)] }),
  pl_e_in: clip('pl_e_in', 0.15, [k(0, R), k(0.15, mix(P.shieldHigh, crouch(0.25)), 'out')], { events: [ev(0.05, 'charge')] }),
  pl_e_loop: clip('pl_e_loop', 0.3, [k(0, P.shieldHigh), k(0.15, plus(P.shieldHigh, { chest: [1.5, 2, 0], armL: [-2, 0, 0] }, R)), k(0.3, P.shieldHigh)], { fadeIn: 0.04 }),
  pl_e_out: clip('pl_e_out', 0.45, [k(0, P.shieldHigh), k(0.2, mix(P.bash, lunge(0.8, 1)), 'out'), k(0.3, mix(P.bash, lunge(0.6, 0.8))), k(0.45, R)], { events: [ev(0.2)] }),
  pl_r: clip('pl_r', 0.55, [k(0, R), k(0.12, P.swordHigh, 'io'), k(0.25, mix(P.point, lunge(0.3, 0.4)), 'out'), k(0.4, mix(P.point, lunge(0.3, 0.4))), k(0.55, R)], { events: [ev(0.25)] }),
  pl_a: clip('pl_a', 0.7, [
    k(0, R),
    k(0.05, mix(P.shieldBrace, lunge(1, 1.2)), 'out'),
    k(0.36, shieldSword(P.shieldBrace, mix(P.swordHigh, lunge(0.8, 1)))),
    k(0.45, shieldSword(P.shieldBrace, mix(P.slashLow, lunge(0.9, 1.2))), 'out'),
    k(0.56, shieldSword(P.shieldBrace, mix(P.slashLow, lunge(0.7, 1)))),
    k(0.7, R),
  ], { full: true, events: [ev(0.45)] }),
  pl_s: clip('pl_s', 0.6, [k(0, R), k(0.15, P.salute, 'io'), k(0.3, mix(P.skyward, { rootPos: [0, 0.4, 0] }), 'back'), k(0.45, P.skyward), k(0.6, R)], { events: [ev(0.3)] }),
  pl_d: clip('pl_d', 0.75, [k(0, R), k(0.18, plus(mix(P.shieldBrace, crouch(0.3)), { armL: [16, 0, 0] }, R), 'io'), k(0.35, mix(P.shieldHigh, lunge(0.6, 0.8)), 'out'), k(0.56, mix(P.shieldHigh, lunge(0.5, 0.7))), k(0.75, R)], { events: [ev(0.35)] }),
  pl_f: clip('pl_f', 0.65, [k(0, R), k(0.15, P.skyward, 'io'), k(0.3, mix(P.plant, crouch(0.55)), 'out'), k(0.5, mix(P.plant, crouch(0.5))), k(0.65, R)], { events: [ev(0.3)] }),
  pl_ult: clip('pl_ult', 2.2, [
    k(0, R),
    k(0.12, mix(P.salute, crouch(0.5))),
    k(0.2, mix(P.skyward, { rootPos: [0, 2.5, 0] }), 'out'),
    k(0.45, mix(P.skyward, { rootPos: [0, 4.5, 0], legL: [-10, 0, 4], legR: [6, 0, -4], shinL: [30, 0, 0], shinR: [20, 0, 0] })),
    k(1.25, mix(P.skyward, { rootPos: [0, 5.0, 0], legL: [-12, 0, 4], legR: [6, 0, -4], shinL: [34, 0, 0], shinR: [22, 0, 0] })),
    k(1.4, mix(P.plant, crouch(0.7)), 'in'),
    k(1.9, mix(P.plant, crouch(0.6))),
    k(2.2, R),
  ], { full: true, events: [ev(0.2, 'charge'), ev(0.4), ev(1.4)] }),
  pl_identity: clip('pl_identity', 0.6, [k(0, R), k(0.14, mix(P.salute, crouch(0.3))), k(0.3, shieldSword(P.shieldHigh, P.skyward), 'back'), k(0.45, shieldSword(P.shieldHigh, P.skyward)), k(0.6, R)], { events: [ev(0.3)] }),
  pl_stagger: clip('pl_stagger', 1.0, [
    k(0, plus(R, { chest: [12, 0, 8], spine: [5, 0, 0], head: [16, 14, 10], armL: [25, 0, 6], foreL: [30, 0, 0], foreR: [16, 0, 0], rootPos: [0, -0.4, 0] }, R)),
    k(0.5, plus(R, { chest: [10, 0, -8], spine: [4, 0, 0], head: [12, -14, -10], armL: [20, 0, 2], foreL: [26, 0, 0], foreR: [10, 0, 0], rootPos: [0, -0.6, 0] }, R)),
    k(1.0, plus(R, { chest: [12, 0, 8], spine: [5, 0, 0], head: [16, 14, 10], armL: [25, 0, 6], foreL: [30, 0, 0], foreR: [16, 0, 0], rootPos: [0, -0.4, 0] }, R)),
  ], { loopFrom: 0 }),
  pl_heavyhit: clip('pl_heavyhit', 0.5, [k(0, R), k(0.08, plus(R, { chest: [-22, -8, 0], spine: [-8, 0, 0], head: [-20, 0, 0], armR: [-20, 0, -30], armL: [10, 0, 0], rootPos: [0, 0.3, -1.3] }, R), 'out'), k(0.25, plus(R, { chest: [-8, -3, 0], spine: [-3, 0, 0], head: [-8, 0, 0], rootPos: [0, -0.3, -0.9] }, R)), k(0.5, R)]),
  pl_victory: clip('pl_victory', 1.6, [k(0, R), k(0.5, P.salute, 'back'), k(1.05, plus(P.salute, { chest: [-2, 0, 0], head: [-3, 0, 0], rootPos: [0, 0.15, 0] }, R)), k(1.6, P.salute)], { loopFrom: 0.5, events: [ev(0.5)] }),
  pl_death: clip('pl_death', 1.2, [
    k(0, R),
    k(0.12, plus(R, { chest: [-20, 0, 6], spine: [-8, 0, 0], head: [-18, 0, 0], armR: [-20, 0, -30], rootPos: [0, 0.2, -0.8] }, R), 'out'),
    k(0.45, mix(plus(R, { chest: [20, 0, -6], spine: [8, 0, 0], head: [10, 0, 0], armR: [20, 0, -10], armL: [20, 0, 0] }, R), { legL: [-70, 0, 4], legR: [-10, 0, -4], shinL: [100, 0, 0], shinR: [80, 0, 0], footL: [-30, 0, 0], footR: [20, 0, 0], rootPos: [0, -2.6, 0] })),
    k(0.9, mix(plus(R, { chest: [-6, 0, 0], head: [-10, 30, 0], armL: [-20, 0, 70], armR: [-30, 0, -60] }, R), { root: [-84, 0, 0], legL: [-30, 0, 4], legR: [-10, 0, -6], shinL: [40, 0, 0], shinR: [10, 0, 0], rootPos: [0, 2.0, -1.2] }), 'in'),
    k(1.2, mix(plus(R, { chest: [-4, 0, 0], head: [-8, 34, 0], armL: [-16, 0, 76], armR: [-26, 0, -66] }, R), { root: [-87, 0, 0], legL: [-26, 0, 4], legR: [-8, 0, -6], shinL: [36, 0, 0], shinR: [8, 0, 0], rootPos: [0, 1.9, -1.2] }), 'out'),
  ], { hold: true, full: true, fadeIn: 0.05, events: [ev(0.9, 'death')] }),
};

// the shared clip names map to the class versions (the weapon grip needs class-specific arm poses)
PALADIN_CLIPS.victory = { ...PALADIN_CLIPS.pl_victory, name: 'victory' };
PALADIN_CLIPS.death = { ...PALADIN_CLIPS.pl_death, name: 'death' };
