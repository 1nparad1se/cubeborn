import type { Clip } from '../clips';
import { crouch, ev, k, lunge, lungeR, makeClip, mix, plus, restPose, tremble, tuck, type KeyIn, type Pose } from './heavyKit';

/**
 * Templar action clips: controlled, precise halberd work — long two-handed thrusts, wide
 * sweeps that carry into a turn to strike behind, butt strikes, and seal-casting gestures
 * (pointing the halberd, striking the butt into the ground). Two-handed poses keep the
 * left hand on the haft; turning strikes spin the root and snap back to 0 at the end.
 */

const STANCE: Pose = { armR: [-30, 18, 8], foreR: [-20, 0, 0], handR: [-12, 17, -5], armL: [-63, 14, -40], foreL: [-20, 0, 0], handL: [4, 1, -6] };
const REST = restPose(STANCE);

/** Key poses (arms solved against the halberd's grip; see models/classRigs/templar.ts). */
const P = {
  thrustBack: { chest: [-4, -30, 0], spine: [-2, -10, 0], head: [0, 26, 0], armR: [60, -19, 13], foreR: [-116, 0, 0], handR: [45, 60, -45], armL: [-34, 33, -38], foreL: [-2, 0, 0], handL: [7, 24, -12] },
  thrust: { chest: [10, 12, 0], spine: [4, 4, 0], head: [-6, -10, 0], armR: [60, 4, 44], foreR: [-107, 0, 0], handR: [24, 40, -45], armL: [-67, -6, -60], foreL: [-1, 0, 0], handL: [18, 32, -11] },
  sweepWind: { chest: [-4, -45, 0], spine: [-2, -15, 0], head: [0, 40, 0], armR: [-36, 6, 45], foreR: [-28, 0, 0], handR: [-15, -47, 18], armL: [19, 40, 12], foreL: [-76, 0, 0], handL: [-41, -58, 45] },
  sweepMid: { chest: [8, 10, 0], spine: [3, 4, 0], head: [-4, -8, 0], armR: [-56, -30, 44], foreR: [-3, 0, 0], handR: [45, -21, 45], armL: [-48, -73, 33], foreL: [-75, 0, 0], handL: [-45, -9, -44] },
  sweepL: { chest: [8, 45, 0], spine: [3, 15, 0], head: [-4, -38, 0], armR: [-37, -28, 36], foreR: [-9, 0, 0], handR: [45, 9, 45], armL: [50, -42, -17], foreL: [-77, 0, 0], handL: [9, -2, 16] },
  buttStrike: { chest: [-8, -25, 0], spine: [-3, -8, 0], head: [0, 40, 0], armR: [-17, 28, 9], foreR: [-51, 0, 0], handR: [45, 17, 29], armL: [-48, 16, -29], foreL: [0, 0, 0], handL: [4, 24, -2] },
  overhead: { chest: [-10, 0, 0], spine: [-4, 0, 0], head: [-8, 0, 0], armR: [-81, 22, 26], foreR: [-62, 0, 0], handR: [33, 10, -16], armL: [-125, -14, -32], foreL: [-39, 0, 0], handL: [29, 25, -14] },
  chop: { chest: [22, 0, 0], spine: [8, 0, 0], head: [-14, 0, 0], armR: [-45, 7, 59], foreR: [-33, 0, 0], handR: [34, -17, -39], armL: [-86, 16, -19], foreL: [0, 0, 0], handL: [45, -1, -45] },
  raise: { chest: [-10, 0, 0], spine: [-4, 0, 0], head: [-16, 0, 0], armL: [-20, 0, 50], foreL: [-40, 0, 0], handL: [0, 0, 0], armR: [-126, 17, -9], foreR: [0, 0, 0], handR: [45, 2, 45] },
  aim: { chest: [0, 10, 0], spine: [0, 4, 0], head: [-4, -8, 0], armL: [-85, 0, -8], foreL: [-10, 0, 0], handL: [-50, 0, 0], armR: [-68, 13, -20], foreR: [0, 0, 0], handR: [45, 2, 45] },
  plant: { chest: [6, 0, 0], spine: [2, 0, 0], head: [-4, 0, 0], armR: [-23, 16, 8], foreR: [-46, 0, 0], handR: [-20, 8, 4], armL: [-85, 7, -56], foreL: [-2, 0, 0], handL: [0, -13, -5] },
} satisfies Record<string, Pose>;

const clip = (name: string, dur: number, keys: KeyIn[], o: Parameters<typeof makeClip>[4] = {}): Clip => makeClip(REST, name, dur, keys, o);
const R = REST;
const root = (y: number): Pose => ({ root: [0, y, 0] });

/** Two-handed thrust: draw back, extend at `hit`, recover. */
function thrust(name: string, dur: number, hit: number, legs: Pose = lunge(0.6, 0.9)): Clip {
  return clip(name, dur, [k(0, R), k(hit * 0.5, P.thrustBack, 'io'), k(hit, mix(P.thrust, legs), 'out'), k(hit + (dur - hit) * 0.4, mix(P.thrust, legs)), k(dur, R)], { events: [ev(hit)] });
}

export const TEMPLAR_CLIPS: Record<string, Clip> = {
  tp_basic1: thrust('tp_basic1', 0.42, 0.18),
  tp_basic2: thrust('tp_basic2', 0.42, 0.18, lungeR(0.6, 0.9)),
  tp_basic3: clip('tp_basic3', 0.6, [k(0, R), k(0.14, P.sweepWind, 'io'), k(0.28, mix(P.sweepMid, lunge(0.5)), 'out'), k(0.38, mix(P.sweepL, lunge(0.5))), k(0.6, R)], { events: [ev(0.28)] }),
  tp_dodge: clip('tp_dodge', 0.45, [k(0, R), k(0.05, mix(P.thrustBack, lunge(1, 1.0), { chest: [24, -20, 0], spine: [10, -6, 0] }), 'out'), k(0.26, mix(P.thrustBack, lunge(0.9, 0.9), { chest: [20, -20, 0], spine: [8, -6, 0] })), k(0.45, R)], { full: true }),
  tp_q1: thrust('tp_q1', 0.42, 0.18, lunge(0.8, 1.1)),
  tp_q2: clip('tp_q2', 0.55, [k(0, R), k(0.1, mix(P.thrust, crouch(0.2))), k(0.24, mix(P.buttStrike, lungeR(0.6, -0.8)), 'out'), k(0.36, mix(P.buttStrike, lungeR(0.5, -0.6))), k(0.55, R)], { events: [ev(0.24)] }),
  tp_w: clip('tp_w', 0.45, [k(0, R), k(0.1, plus(P.aim, { armL: [30, 0, 0], chest: [-4, -10, 0] }, R), 'io'), k(0.2, P.aim, 'out'), k(0.32, P.aim), k(0.45, R)], { events: [ev(0.2)] }),
  tp_e: clip('tp_e', 0.6, [k(0, R), k(0.14, mix(P.raise, crouch(0.15)), 'io'), k(0.28, mix(P.plant, crouch(0.5)), 'out'), k(0.42, mix(P.plant, crouch(0.45))), k(0.6, R)], { events: [ev(0.28)] }),
  tp_r1: clip('tp_r1', 0.45, [k(0, R), k(0.1, P.thrustBack, 'io'), k(0.2, mix(P.thrust, lunge(0.8, 1.2)), 'out'), k(0.3, mix(P.thrust, lunge(0.6, 0.9))), k(0.45, R)], { events: [ev(0.2)] }),
  tp_r2: clip('tp_r2', 0.5, [k(0, R), k(0.04, mix(P.overhead, crouch(0.7)), 'out'), k(0.09, mix(P.overhead, crouch(0.6))), k(0.16, mix(P.chop, lunge(0.8, 1)), 'out'), k(0.3, mix(P.chop, lunge(0.7, 0.9))), k(0.5, R)], { full: true, events: [ev(0.04, 'charge'), ev(0.16)] }),
  tp_a: clip('tp_a', 0.7, [
    k(0, mix(R, root(0))),
    k(0.1, mix(P.sweepWind, root(0)), 'io'),
    k(0.2, mix(P.sweepMid, lunge(0.4), root(0)), 'out'),
    k(0.28, mix(P.sweepL, root(20))),
    k(0.36, mix(P.sweepWind, root(110))),
    k(0.45, mix(P.sweepMid, lunge(0.5), root(200)), 'out'),
    k(0.55, mix(P.sweepL, root(240))),
    k(0.695, mix(R, root(360))),
    k(0.7, mix(R, root(0)), 'lin'),
  ], { full: true, events: [ev(0.2), ev(0.45)] }),
  tp_s: clip('tp_s', 0.5, [k(0, R), k(0.1, mix(P.plant, { rootPos: [0, 0.6, 0] }), 'io'), k(0.22, mix(P.plant, crouch(0.45)), 'out'), k(0.36, mix(P.plant, crouch(0.4))), k(0.5, R)], { events: [ev(0.22)] }),
  tp_d: clip('tp_d', 0.55, [k(0, R), k(0.12, plus(P.aim, { chest: [-4, -12, 0], armL: [30, 0, 0] }, R), 'io'), k(0.25, mix(P.aim, lunge(0.3, 0.4)), 'out'), k(0.4, plus(P.aim, { chest: [-10, -10, 0], armL: [30, 0, 0], foreL: [-60, 0, 0], rootPos: [0, 0, -0.5] }, R)), k(0.55, R)], { events: [ev(0.25)] }),
  tp_f: clip('tp_f', 0.85, [
    k(0, R),
    k(0.08, mix(P.overhead, crouch(0.8)), 'io'),
    k(0.28, mix(P.overhead, tuck(1, 5)), 'out'),
    k(0.44, mix(P.overhead, tuck(0.4, 2)), 'in'),
    k(0.5, mix(P.chop, lunge(0.8, 0.6)), 'in'),
    k(0.68, mix(P.chop, lunge(0.7, 0.6))),
    k(0.85, R),
  ], { full: true, events: [ev(0.08, 'charge'), ev(0.5)] }),
  tp_ult: clip('tp_ult', 2.0, [
    k(0, R),
    k(0.2, mix(P.raise, { rootPos: [0, 1.0, 0] }), 'back'),
    k(0.55, mix(P.overhead, crouch(0.2)), 'io'),
    k(0.7, mix(P.chop, lunge(0.8, 0.8)), 'out'),
    k(0.92, mix(P.chop, lunge(0.7, 0.7))),
    k(1.2, mix(P.raise, { rootPos: [0, 1.6, 0], legL: [-14, 0, 4], shinL: [30, 0, 0] }), 'io'),
    k(1.36, mix(P.overhead, { rootPos: [0, 1.0, 0] })),
    k(1.5, mix(P.plant, crouch(0.7)), 'out'),
    k(1.8, mix(P.plant, crouch(0.6))),
    k(2.0, R),
  ], { full: true, events: [ev(0.2, 'charge'), ev(0.7), ev(1.5)] }),
  tp_identity: clip('tp_identity', 0.6, [k(0, R), k(0.12, mix(P.plant, crouch(0.35)), 'io'), k(0.25, P.raise, 'back'), k(0.45, tremble(P.raise, 1.5, 1, R)), k(0.6, R)], { events: [ev(0.25)] }),
  tp_stagger: clip('tp_stagger', 1.0, [
    k(0, plus(R, { chest: [12, 0, 8], spine: [5, 0, 0], head: [16, 14, 10], armL: [20, 0, 10], foreR: [10, 0, 0], rootPos: [0, -0.4, 0] }, R)),
    k(0.5, plus(R, { chest: [10, 0, -8], spine: [4, 0, 0], head: [12, -14, -10], armL: [16, 0, 4], foreR: [6, 0, 0], rootPos: [0, -0.6, 0] }, R)),
    k(1.0, plus(R, { chest: [12, 0, 8], spine: [5, 0, 0], head: [16, 14, 10], armL: [20, 0, 10], foreR: [10, 0, 0], rootPos: [0, -0.4, 0] }, R)),
  ], { loopFrom: 0 }),
  tp_heavyhit: clip('tp_heavyhit', 0.5, [k(0, R), k(0.08, plus(R, { chest: [-22, 8, 0], spine: [-8, 0, 0], head: [-20, 0, 0], armL: [20, 0, 20], rootPos: [0, 0.3, -1.3] }, R), 'out'), k(0.25, plus(R, { chest: [-8, 3, 0], spine: [-3, 0, 0], head: [-8, 0, 0], rootPos: [0, -0.3, -0.9] }, R)), k(0.5, R)]),
  tp_victory: clip('tp_victory', 1.6, [k(0, R), k(0.6, P.raise, 'back'), k(1.1, plus(P.raise, { chest: [-2, 0, 3], head: [-3, 0, -4], armL: [-6, 0, 6], rootPos: [0, 0.2, 0] }, R)), k(1.6, P.raise)], { loopFrom: 0.6, events: [ev(0.6)] }),
  tp_death: clip('tp_death', 1.2, [
    k(0, R),
    k(0.12, plus(R, { chest: [-20, 0, 6], spine: [-8, 0, 0], head: [-18, 0, 0], armL: [-10, 0, 40], rootPos: [0, 0.2, -0.8] }, R), 'out'),
    k(0.5, mix(plus(R, { chest: [24, 0, -8], spine: [10, 0, 0], head: [14, 0, 0], armL: [30, 0, 10] }, R), { legL: [-80, 0, 6], legR: [-80, 0, -6], shinL: [115, 0, 0], shinR: [115, 0, 0], footL: [-30, 0, 0], footR: [-30, 0, 0], rootPos: [0, -3.0, 0] })),
    k(0.9, mix(plus(R, { chest: [-6, 0, 0], head: [-10, -30, 0], armL: [-20, 0, 80], armR: [10, 0, -40] }, R), { root: [-84, 0, 0], legL: [-30, 0, 4], legR: [-12, 0, -6], shinL: [44, 0, 0], shinR: [14, 0, 0], rootPos: [0, 1.7, -1.2] }), 'in'),
    k(1.2, mix(plus(R, { chest: [-4, 0, 0], head: [-8, -34, 0], armL: [-16, 0, 84], armR: [12, 0, -44] }, R), { root: [-87, 0, 0], legL: [-26, 0, 4], legR: [-10, 0, -6], shinL: [40, 0, 0], shinR: [10, 0, 0], rootPos: [0, 1.6, -1.2] }), 'out'),
  ], { hold: true, full: true, fadeIn: 0.05, events: [ev(0.9, 'death')] }),
};

// the shared clip names map to the class versions (the weapon grip needs class-specific arm poses)
TEMPLAR_CLIPS.victory = { ...TEMPLAR_CLIPS.tp_victory, name: 'victory' };
TEMPLAR_CLIPS.death = { ...TEMPLAR_CLIPS.tp_death, name: 'death' };
