import type { Clip } from '../clips';
import { STEELFIST_STANCE as S } from '../../../models/classRigs/steelfist';
import { clipMaker, flipKeys, mix, shake, type Pose } from './agileKit';

/**
 * Steel Fist action clips, keyed by the anim names used in src/game/action/classes/steelfist.ts.
 * Snappy: short anticipation, impact exactly on the hit time, quick snap back to the guard.
 * Poses are absolute (see agileKit); the left fist leads, the right is the power hand.
 */
const clip = clipMaker(S);

// ---------------------------------------------------------------- reusable poses
const G: Pose = { ...S, rootPos: [0, 0, 0], root: [0, 0, 0] };
/** Legs planted in a lunge (left foot forward), weight on the front leg. */
const LUNGE: Pose = { legL: [-38, -6, 6], shinL: [30, 0, 0], footL: [8, 6, 0], legR: [26, 12, -8], shinR: [12, 0, 0], footR: [-18, -12, 0] };
const LOW: Pose = { legL: [-46, -8, 10], shinL: [64, 0, 0], footL: [-16, 8, 0], legR: [-10, 10, -10], shinR: [60, 0, 0], footR: [-40, -10, 0] };
const LEGS: Pose = { legL: S.legL!, shinL: S.shinL!, footL: S.footL!, legR: S.legR!, shinR: S.shinR!, footR: S.footR! };

const GUARD_L: Pose = { armL: [-50, -6, 22], foreL: [-108, 0, 0], handL: [8, 0, 0] };
const GUARD_R: Pose = { armR: [-38, 8, -26], foreR: [-112, 0, 0], handR: [8, 0, 0] };
const JAB_L: Pose = { armL: [-92, 0, 4], foreL: [-4, 0, 0], handL: [-6, 0, 0] };
const CROSS_R: Pose = { armR: [-92, 0, -4], foreR: [-4, 0, 0], handR: [-6, 0, 0] };
/** Chambered right fist pulled back to the hip. */
const CHAMBER_R: Pose = { armR: [24, 0, -22], foreR: [-118, 0, 0], handR: [10, 0, 0] };
const CHAMBER_L: Pose = { armL: [24, 0, 22], foreL: [-118, 0, 0], handL: [10, 0, 0] };

const jab: Pose = mix(GUARD_R, JAB_L, { chest: [8, -14, 0], spine: [4, -6, 0], head: [-6, 8, 0], rootPos: [0, -0.1, 0.7] });
const cross: Pose = mix(GUARD_L, CROSS_R, { chest: [10, 44, 0], spine: [6, 16, 0], head: [-8, -42, 0], rootPos: [0, -0.2, 0.9] });
const hookL: Pose = mix(GUARD_R, { armL: [-84, 30, 66], foreL: [-84, 0, 0], handL: [0, 0, 0], chest: [8, -40, 0], spine: [4, -16, 0], head: [-6, 28, 0], rootPos: [0, -0.2, 0.6] });
const hookWind: Pose = mix(GUARD_R, { armL: [-50, 10, 60], foreL: [-90, 0, 0], chest: [4, 30, 0], spine: [2, 10, 0], head: [-6, -24, 0] });
const elbowR: Pose = mix(GUARD_L, { armR: [-84, -6, -88], foreR: [-150, 0, 0], handR: [0, 0, 0], chest: [10, 58, 0], spine: [6, 20, 0], head: [-8, -44, 0], rootPos: [0, -0.2, 1.0] });
const uppercutR: Pose = mix(GUARD_L, { armR: [-128, 0, -14], foreR: [-74, 0, 0], handR: [-10, 0, 0], chest: [-14, 34, 0], spine: [-6, 12, 0], head: [-18, -24, 0], rootPos: [0, 0.9, 0.8] });
const bodyJab: Pose = mix(GUARD_R, { armL: [-70, 0, 4], foreL: [-4, 0, 0], handL: [-6, 0, 0], chest: [22, -14, 0], spine: [8, -6, 0], head: [-18, 10, 0], rootPos: [0, -1.0, 0.7] }, LOW);
const bodyCross: Pose = mix(GUARD_L, { armR: [-72, 0, -4], foreR: [-4, 0, 0], handR: [-6, 0, 0], chest: [24, 40, 0], spine: [8, 14, 0], head: [-20, -36, 0], rootPos: [0, -1.1, 0.8] }, LOW);
const palmL: Pose = mix(CHAMBER_R, { armL: [-90, 0, 8], foreL: [-2, 0, 0], handL: [-70, 0, 0], chest: [10, -30, 0], spine: [4, -10, 0], head: [-8, 24, 0], rootPos: [0, -0.4, 0.9] }, LUNGE);
const dazed: Pose = { chest: [12, 0, 8], spine: [4, 0, 4], head: [18, 12, 10], armL: [-10, 0, 18], foreL: [-30, 0, 0], handL: [10, 0, 0], armR: [-6, 0, -14], foreR: [-24, 0, 0], handR: [10, 0, 0] };

// ---------------------------------------------------------------- the library
export const STEELFIST_CLIPS: Record<string, Clip> = {
  // basic chain: jab, hook, elbow, snap kick
  sf_basic1: clip('sf_basic1', 0.26, [
    [0, mix(G, { chest: [6, 26, 0], armL: [-46, -6, 18], foreL: [-110, 0, 0] })],
    [0.1, mix(jab, LUNGE), 'out'],
    [0.16, mix(jab, LUNGE)],
    [0.26, 'rest'],
  ], { hits: [0.1] }),
  sf_basic2: clip('sf_basic2', 0.26, [
    [0, mix(G, hookWind)],
    [0.1, mix(hookL, LUNGE), 'out'],
    [0.16, mix(hookL, { chest: [8, -48, 0] })],
    [0.26, 'rest'],
  ], { hits: [0.1] }),
  sf_basic3: clip('sf_basic3', 0.3, [
    [0, mix(G, { chest: [4, -16, 0], spine: [2, -6, 0], armR: [-60, 0, -60], foreR: [-140, 0, 0] })],
    [0.12, mix(elbowR, LUNGE), 'out'],
    [0.2, mix(elbowR, { chest: [10, 66, 0] })],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  sf_basic4: clip('sf_basic4', 0.42, [
    [0, G],
    // chamber the right knee
    [0.1, mix(GUARD_L, GUARD_R, { legR: [-80, 10, -6], shinR: [110, 0, 0], footR: [20, 0, 0], legL: [-8, -6, 4], shinL: [16, 0, 0], footL: [-6, 0, 0], chest: [-6, 30, 0], spine: [-4, 10, 0], rootPos: [0, 0.2, 0] })],
    // snap kick: leg straight out at chest height, body leaning back
    [0.2, mix(GUARD_L, { armR: [10, 0, -40], foreR: [-60, 0, 0], legR: [-100, 18, -10], shinR: [6, 0, 0], footR: [34, 0, 0], legL: [-4, -6, 4], shinL: [10, 0, 0], footL: [-4, 0, 0], chest: [-18, 34, 0], spine: [-8, 12, 0], head: [10, -30, 0], rootPos: [0, 0.3, 0.6] }), 'out'],
    [0.28, mix(GUARD_L, { legR: [-70, 14, -8], shinR: [70, 0, 0], footR: [10, 0, 0], chest: [-10, 28, 0], rootPos: [0, 0.2, 0.5] })],
    [0.42, 'rest'],
  ], { hits: [0.2], full: true }),

  // slip step: ducking dash, low and forward
  sf_dodge: clip('sf_dodge', 0.4, [
    [0, G],
    [0.06, mix(GUARD_L, GUARD_R, LOW, { chest: [36, -10, 0], spine: [14, 0, 0], head: [-30, 8, 0], rootPos: [0, -1.6, 0.4] }), 'out'],
    [0.22, mix(GUARD_L, GUARD_R, { legL: [-50, -8, 10], shinL: [50, 0, 0], footL: [-6, 8, 0], legR: [30, 10, -10], shinR: [40, 0, 0], footR: [-20, -10, 0], chest: [32, 10, 0], spine: [12, 0, 0], head: [-28, 0, 0], rootPos: [0, -1.4, 0.6] })],
    [0.4, 'rest'],
  ], { full: true }),

  // Dragon Uppercut: body jab, body cross, rising uppercut with a step
  sf_q1: clip('sf_q1', 0.25, [
    [0, mix(G, { chest: [14, 20, 0], rootPos: [0, -0.5, 0] })],
    [0.1, bodyJab, 'out'],
    [0.16, bodyJab],
    [0.25, 'rest'],
  ], { hits: [0.1] }),
  sf_q2: clip('sf_q2', 0.25, [
    [0, mix(G, { chest: [14, -10, 0], rootPos: [0, -0.5, 0] })],
    [0.1, bodyCross, 'out'],
    [0.16, bodyCross],
    [0.25, 'rest'],
  ], { hits: [0.1] }),
  sf_q3: clip('sf_q3', 0.45, [
    [0, G],
    [0.05, mix(GUARD_L, { armR: [10, 0, -20], foreR: [-120, 0, 0] }, LOW, { chest: [28, 10, 0], spine: [10, 4, 0], head: [-24, -6, 0], rootPos: [0, -1.6, 0.2] }), 'out'],
    [0.18, mix(uppercutR, { legL: [-20, -6, 6], shinL: [10, 0, 0], footL: [10, 6, 0], legR: [16, 10, -6], shinR: [30, 0, 0], footR: [30, -10, 0] }), 'out'],
    [0.3, mix(uppercutR, { armR: [-140, 0, -10], rootPos: [0, 1.1, 0.8] })],
    [0.45, 'rest'],
  ], { hits: [0.18], full: true }),

  // Dragon Dash: a flying straight right held through the whole dash
  sf_w: clip('sf_w', 0.4, [
    [0, mix(G, CHAMBER_R, { chest: [14, -20, 0], rootPos: [0, -0.6, 0] })],
    [0.04, mix(cross, LUNGE, { chest: [26, 40, 0], spine: [10, 14, 0], head: [-26, -40, 0], legR: [40, 12, -8], shinR: [30, 0, 0], rootPos: [0, -0.6, 1.0] }), 'out'],
    [0.23, mix(cross, LUNGE, { chest: [26, 44, 0], spine: [10, 16, 0], head: [-26, -42, 0], legR: [44, 12, -8], shinR: [34, 0, 0], rootPos: [0, -0.6, 1.0] })],
    [0.4, 'rest'],
  ], { full: true }),

  // Rising Knee: leap, left knee driven up into the target, land
  sf_e: clip('sf_e', 0.55, [
    [0, G],
    [0.05, mix(GUARD_L, GUARD_R, LOW, { chest: [24, 0, 0], rootPos: [0, -1.5, 0] })],
    [0.2, mix(CHAMBER_L, GUARD_R, { legL: [-60, 0, 0], shinL: [100, 0, 0], footL: [20, 0, 0], legR: [20, 0, 0], shinR: [60, 0, 0], footR: [20, 0, 0], chest: [10, 0, 0], head: [-14, 0, 0], rootPos: [0, 3.2, 0.4] }), 'out'],
    // knee strike at the top of the arc (just before landing)
    [0.33, mix(GUARD_R, { armL: [30, 0, 40], foreL: [-90, 0, 0], legL: [-112, 0, 0], shinL: [140, 0, 0], footL: [30, 0, 0], legR: [16, 0, 0], shinR: [30, 0, 0], footR: [0, 0, 0], chest: [-12, 0, 0], spine: [-4, 0, 0], head: [-6, 0, 0], rootPos: [0, 1.4, 1.0] }), 'out'],
    [0.42, mix(GUARD_L, GUARD_R, LOW, { chest: [18, 0, 0], rootPos: [0, -1.4, 0.6] }), 'in'],
    [0.55, 'rest'],
  ], { hits: [0.33], full: true }),

  // Crushing Fist: hold-to-charge wind-up, then a piercing straight right
  sf_r_charge: clip('sf_r_charge', 0.6, [
    [0, mix(G, CHAMBER_R, LUNGE, { armL: [-80, 0, 30], foreL: [-30, 0, 0], handL: [-60, 0, 0], chest: [10, -46, 0], spine: [6, -16, 0], head: [-8, 40, 0], rootPos: [0, -1.0, -0.3] })],
    [0.2, shake(mix(G, CHAMBER_R, LUNGE, { armL: [-80, 0, 30], foreL: [-30, 0, 0], handL: [-60, 0, 0], chest: [12, -50, 0], spine: [6, -18, 0], head: [-8, 42, 0], rootPos: [0, -1.1, -0.35] }), 2, ['armR', 'foreR', 'chest'])],
    [0.4, shake(mix(G, CHAMBER_R, LUNGE, { armL: [-80, 0, 30], foreL: [-30, 0, 0], handL: [-60, 0, 0], chest: [12, -50, 0], spine: [6, -18, 0], head: [-8, 42, 0], rootPos: [0, -1.1, -0.35] }), -2, ['armR', 'foreR', 'chest'])],
    [0.6, shake(mix(G, CHAMBER_R, LUNGE, { armL: [-80, 0, 30], foreL: [-30, 0, 0], handL: [-60, 0, 0], chest: [12, -50, 0], spine: [6, -18, 0], head: [-8, 42, 0], rootPos: [0, -1.1, -0.35] }), 2, ['armR', 'foreR', 'chest'])],
  ], { loopFrom: 0.2 }),
  sf_r: clip('sf_r', 0.55, [
    [0, mix(G, CHAMBER_R, LUNGE, { armL: [-80, 0, 30], foreL: [-30, 0, 0], chest: [12, -50, 0], spine: [6, -18, 0], head: [-8, 42, 0], rootPos: [0, -1.1, -0.35] })],
    [0.2, mix(cross, CHAMBER_L, LUNGE, { chest: [18, 52, 0], spine: [8, 18, 0], head: [-16, -48, 0], legL: [-48, -6, 6], shinL: [40, 0, 0], legR: [36, 12, -8], rootPos: [0, -0.8, 1.6] }), 'out'],
    [0.34, mix(cross, CHAMBER_L, LUNGE, { chest: [16, 50, 0], spine: [8, 18, 0], head: [-16, -46, 0], rootPos: [0, -0.8, 1.5] })],
    [0.55, 'rest'],
  ], { hits: [0.2] }),

  // Hundred Fists: lean in, alternating straights (loop replays seamlessly), finishing cross
  sf_a_in: clip('sf_a_in', 0.1, [
    [0, G],
    [0.1, mix(GUARD_L, GUARD_R, LUNGE, { chest: [16, 0, 0], spine: [6, 0, 0], head: [-14, 0, 0], rootPos: [0, -0.6, 0.3] })],
  ]),
  sf_a_loop: clip('sf_a_loop', 0.12, [
    [0, mix(LUNGE, { armL: [-72, 0, 10], foreL: [-60, 0, 0], handL: [0, 0, 0], armR: [-72, 0, -10], foreR: [-60, 0, 0], handR: [0, 0, 0], chest: [16, 0, 0], spine: [6, 0, 0], head: [-14, 0, 0], rootPos: [0, -0.6, 0.3] })],
    [0.04, mix(LUNGE, JAB_L, { armR: [-50, 0, -20], foreR: [-120, 0, 0], chest: [16, -18, 0], spine: [6, -6, 0], head: [-14, 10, 0], rootPos: [0, -0.6, 0.45] }), 'out'],
    [0.08, mix(LUNGE, CROSS_R, { armL: [-50, 0, 20], foreL: [-120, 0, 0], chest: [16, 22, 0], spine: [6, 8, 0], head: [-14, -14, 0], rootPos: [0, -0.6, 0.45] }), 'out'],
    [0.12, mix(LUNGE, { armL: [-72, 0, 10], foreL: [-60, 0, 0], handL: [0, 0, 0], armR: [-72, 0, -10], foreR: [-60, 0, 0], handR: [0, 0, 0], chest: [16, 0, 0], spine: [6, 0, 0], head: [-14, 0, 0], rootPos: [0, -0.6, 0.3] })],
  ], { hits: [0.04], fadeIn: 0.03, fadeOut: 0.05 }),
  sf_a_out: clip('sf_a_out', 0.4, [
    [0, mix(LUNGE, CHAMBER_R, JAB_L, { chest: [12, -30, 0], spine: [4, -10, 0], head: [-10, 24, 0], rootPos: [0, -0.7, 0.2] })],
    [0.16, mix(cross, CHAMBER_L, LUNGE, { chest: [16, 50, 0], rootPos: [0, -0.7, 1.2] }), 'out'],
    [0.26, mix(cross, CHAMBER_L, LUNGE, { chest: [14, 48, 0], rootPos: [0, -0.7, 1.1] })],
    [0.4, 'rest'],
  ], { hits: [0.16], fadeIn: 0.03 }),

  // Hurricane Kick: two spinning kicks (hits from 0.15), then a backflip away (0.42-0.6)
  sf_s: clip('sf_s', 0.65, [
    [0, mix(G, LOW, { chest: [16, 30, 0], rootPos: [0, -1.0, 0] })],
    [0.08, mix(G, { root: [0, -90, 0], armL: [-20, 0, 80], foreL: [-30, 0, 0], armR: [-20, 0, -80], foreR: [-30, 0, 0], legR: [-70, 0, -40], shinR: [20, 0, 0], footR: [20, 0, 0], legL: [-10, 0, 0], shinL: [20, 0, 0], footL: [0, 0, 0], chest: [-10, 0, 0], spine: [-4, 0, 0], head: [0, 0, 0], rootPos: [0, 1.4, 0] }), 'in'],
    [0.15, { root: [0, -270, 0], legR: [-84, 0, -60], shinR: [6, 0, 0], rootPos: [0, 2.0, 0] }, 'lin'],
    [0.27, { root: [0, -450, 0], legR: [-84, 0, -60], shinR: [6, 0, 0], rootPos: [0, 2.2, 0] }, 'lin'],
    [0.38, { root: [0, -630, 0], legR: [-60, 0, -40], shinR: [30, 0, 0], rootPos: [0, 1.4, 0] }, 'lin'],
    [0.42, { root: [0, -720, 0], legR: [-20, 0, 0], shinR: [60, 0, 0], legL: [-20, 0, 0], shinL: [60, 0, 0], armL: [-150, 0, 20], foreL: [-10, 0, 0], armR: [-150, 0, -20], foreR: [-10, 0, 0], chest: [-14, 0, 0], head: [-20, 0, 0], rootPos: [0, 0.6, 0] }, 'out'],
    [0.421, { root: [0, 0, 0] }, 'lin'],
    ...flipKeys(0.421, 0.6, -1, 9, 8, (u) => ({ legL: [-90 * Math.sin(u * Math.PI), 0, 0], shinL: [120 * Math.sin(u * Math.PI), 0, 0], legR: [-90 * Math.sin(u * Math.PI), 0, 0], shinR: [120 * Math.sin(u * Math.PI), 0, 0] })),
    [0.65, mix(G, LOW, { rootPos: [0, -1.0, 0] })],
  ], { hits: [0.15, 0.27], full: true }),

  // Shock Palm: open left palm thrust that releases the spirit orb
  sf_d: clip('sf_d', 0.45, [
    [0, mix(G, CHAMBER_L, GUARD_R, { chest: [6, 30, 0], spine: [2, 10, 0], head: [-6, -24, 0], rootPos: [0, -0.4, -0.2] })],
    [0.16, palmL, 'out'],
    [0.28, palmL],
    [0.45, 'rest'],
  ], { hits: [0.16] }),

  // Meteor Drop: crouch, high leap with both fists overhead, fist-first fall, crouched impact
  sf_f: clip('sf_f', 0.85, [
    [0, G],
    [0.08, mix(LOW, { armL: [30, 0, 20], foreL: [-40, 0, 0], armR: [30, 0, -20], foreR: [-40, 0, 0], chest: [26, 0, 0], head: [-16, 0, 0], rootPos: [0, -1.8, 0] })],
    [0.3, { legL: [-50, 0, 0], shinL: [90, 0, 0], footL: [20, 0, 0], legR: [-30, 0, 0], shinR: [80, 0, 0], footR: [20, 0, 0], armL: [-170, 0, 10], foreL: [-30, 0, 0], handL: [0, 0, 0], armR: [-170, 0, -10], foreR: [-30, 0, 0], handR: [0, 0, 0], chest: [-16, 0, 0], spine: [-6, 0, 0], head: [-18, 0, 0], rootPos: [0, 6.0, 0] }, 'out'],
    [0.45, { armR: [-200, 0, -10], foreR: [-20, 0, 0], armL: [-150, 0, 30], chest: [-20, 0, 0], legL: [-30, 0, 0], shinL: [60, 0, 0], legR: [-10, 0, 0], shinR: [40, 0, 0], rootPos: [0, 4.6, 0.3] }],
    // fist into the ground
    [0.55, mix(LOW, { armR: [-60, 0, -8], foreR: [-4, 0, 0], handR: [-10, 0, 0], armL: [-10, 0, 60], foreL: [-30, 0, 0], handL: [0, 0, 0], legL: [-60, -8, 14], shinL: [90, 0, 0], legR: [10, 10, -12], shinR: [100, 0, 0], footR: [-50, 0, 0], chest: [44, 10, 0], spine: [12, 0, 0], head: [-30, 0, 0], rootPos: [0, -2.6, 0.6] }), 'in'],
    [0.7, mix(LOW, { armR: [-66, 0, -8], foreR: [-8, 0, 0], armL: [-10, 0, 60], chest: [40, 10, 0], head: [-26, 0, 0], rootPos: [0, -2.4, 0.6] })],
    [0.85, 'rest'],
  ], { hits: [0.55], full: true }),

  // Thousand Dragon Steps: five vanishing strikes from behind, then a two-handed spirit blast
  sf_ult: clip('sf_ult', 2.0, [
    [0, G],
    ...[0.05, 0.3, 0.55, 0.8, 1.05].flatMap((t, i): [number, Pose, ('out' | 'in')?][] => {
      const strikes = [
        mix(cross, LUNGE),
        mix(hookL, LUNGE),
        mix(uppercutR, { legL: [-20, -6, 6], shinL: [10, 0, 0], legR: [16, 10, -6], shinR: [30, 0, 0] }),
        mix(jab, LUNGE, { armR: [-92, 0, -4], foreR: [-4, 0, 0] }),
        mix(elbowR, LUNGE),
      ];
      return [
        [t, mix(GUARD_L, GUARD_R, LOW, { root: [0, 0, 0], chest: [30, 0, 0], spine: [10, 0, 0], head: [-26, 0, 0], rootPos: [0, -2.0, -0.2] }), 'in'],
        [t + 0.07, strikes[i], 'out'],
        [t + 0.17, mix(strikes[i], { rootPos: [0, -0.3, 0.6] })],
      ];
    }),
    // gather the spirit at the hip, then a double palm blast
    [1.3, mix(LOW, { armL: [20, 0, 30], foreL: [-110, 0, 0], handL: [-40, 0, 0], armR: [20, 0, -30], foreR: [-110, 0, 0], handR: [-40, 0, 0], chest: [10, 40, 0], spine: [6, 14, 0], head: [-10, -30, 0], rootPos: [0, -1.6, -0.3] })],
    [1.5, mix(LUNGE, { armL: [-88, 0, -6], foreL: [-4, 0, 0], handL: [-70, 0, 0], armR: [-88, 0, 6], foreR: [-4, 0, 0], handR: [-70, 0, 0], chest: [14, 0, 0], spine: [6, 0, 0], head: [-12, 0, 0], rootPos: [0, -0.8, 1.2] }), 'out'],
    [1.75, mix(LUNGE, { armL: [-84, 0, -4], foreL: [-6, 0, 0], handL: [-66, 0, 0], armR: [-84, 0, 4], foreR: [-6, 0, 0], handR: [-66, 0, 0], chest: [12, 0, 0], spine: [6, 0, 0], head: [-10, 0, 0], rootPos: [0, -0.8, 1.1] })],
    [2.0, 'rest'],
  ], { hits: [0.12, 0.37, 0.62, 0.87, 1.12, 1.5], full: true }),

  // Spirit Awakening: fists crossed, then the spirit bursts out with arms flung wide
  sf_identity: clip('sf_identity', 0.5, [
    [0, G],
    [0.12, mix(LOW, { armL: [-70, 0, -40], foreL: [-90, 0, 0], armR: [-70, 0, 40], foreR: [-90, 0, 0], chest: [26, 0, 0], spine: [10, 0, 0], head: [10, 0, 0], rootPos: [0, -1.6, 0] })],
    [0.2, { legL: [-6, -6, 12], shinL: [10, 0, 0], footL: [-4, 0, 0], legR: [-6, 6, -12], shinR: [10, 0, 0], footR: [-4, 0, 0], armL: [-30, 0, 100], foreL: [-20, 0, 0], handL: [0, 0, 0], armR: [-30, 0, -100], foreR: [-20, 0, 0], handR: [0, 0, 0], chest: [-20, 0, 0], spine: [-8, 0, 0], head: [-22, 0, 0], rootPos: [0, 0.6, 0] }, 'back'],
    [0.36, { armL: [-34, 0, 92], armR: [-34, 0, -92], chest: [-16, 0, 0], head: [-18, 0, 0], rootPos: [0, 0.4, 0] }],
    [0.5, 'rest'],
  ], { hits: [0.2], full: true }),

  // ------------------------------------------------------------ reactions, victory, death
  sf_stagger: clip('sf_stagger', 1.0, [
    [0, mix(dazed, { rootPos: [0, -0.4, 0] })],
    [0.25, { chest: [14, -6, -8], spine: [4, 0, -4], head: [20, -14, -12], rootPos: [-0.3, -0.5, 0] }],
    [0.5, { chest: [10, 0, 6], spine: [4, 0, 3], head: [16, 10, 8], rootPos: [0, -0.4, 0] }],
    [0.75, { chest: [14, 6, 8], spine: [4, 0, 4], head: [20, 14, 12], rootPos: [0.3, -0.5, 0] }],
    [1.0, mix(dazed, { rootPos: [0, -0.4, 0] })],
  ], { loopFrom: 0 }),
  sf_heavyhit: clip('sf_heavyhit', 0.5, [
    [0, G],
    [0.08, { chest: [-30, -10, 0], spine: [-12, 0, 0], head: [-28, 0, 0], armL: [-60, 0, 50], foreL: [-30, 0, 0], armR: [-60, 0, -50], foreR: [-30, 0, 0], legL: [-30, 0, 0], shinL: [20, 0, 0], legR: [20, 0, 0], shinR: [30, 0, 0], rootPos: [0, -0.4, -1.4] }, 'out'],
    [0.25, { chest: [16, 0, 0], spine: [6, 0, 0], head: [6, 0, 0], armL: [-20, 0, 30], foreL: [-60, 0, 0], armR: [-20, 0, -30], foreR: [-60, 0, 0], ...LOW, rootPos: [0, -1.4, -1.6] }],
    [0.5, 'rest'],
  ], { full: true }),
  sf_victory: clip('sf_victory', 1.6, [
    [0, G],
    // palm over fist salute, then the right fist thrust to the sky
    [0.4, { ...LEGS, legL: [-4, 0, 6], shinL: [6, 0, 0], legR: [-4, 0, -6], shinR: [6, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], armL: [-62, -20, -24], foreL: [-62, 0, 0], handL: [0, 0, 0], armR: [-62, 20, 24], foreR: [-62, 0, 0], handR: [0, 0, 0], chest: [8, 0, 0], spine: [0, 0, 0], head: [6, 0, 0], hips: [0, 0, 0] }],
    [0.8, { armR: [-170, 0, -8], foreR: [-6, 0, 0], armL: [20, 0, 30], foreL: [-110, 0, 0], chest: [-10, 0, 0], head: [-16, 10, 0], rootPos: [0, 0.4, 0] }, 'back'],
    [1.2, { armR: [-172, 0, -6], chest: [-12, 0, 0], head: [-18, 12, 0], rootPos: [0, 0.2, 0] }],
    [1.6, { armR: [-170, 0, -8], chest: [-10, 0, 0], head: [-16, 10, 0], rootPos: [0, 0.4, 0] }],
  ], { loopFrom: 0.8, full: true }),
  sf_death: clip('sf_death', 1.2, [
    [0, G],
    [0.15, { chest: [-24, 20, 0], spine: [-8, 0, 0], head: [-26, 0, 0], armL: [-40, 0, 40], foreL: [-30, 0, 0], armR: [-30, 0, -40], foreR: [-30, 0, 0], rootPos: [0, 0, -0.6] }, 'out'],
    [0.45, { ...LOW, chest: [26, 0, 0], spine: [10, 0, 0], head: [16, 0, 0], armL: [0, 0, 16], foreL: [-20, 0, 0], armR: [0, 0, -16], foreR: [-20, 0, 0], rootPos: [0, -1.8, -0.6] }],
    [0.85, { root: [-86, 0, 0], legL: [-10, 0, 8], shinL: [14, 0, 0], footL: [10, 0, 0], legR: [-4, 0, -8], shinR: [10, 0, 0], footR: [10, 0, 0], chest: [-6, 0, 0], spine: [0, 0, 0], head: [-10, 30, 0], armL: [-20, 0, 70], foreL: [-10, 0, 0], armR: [-30, 0, -80], foreR: [-20, 0, 0], rootPos: [0, 1.9, -0.4] }, 'in'],
    [1.0, { root: [-82, 0, 0], rootPos: [0, 2.2, -0.4] }],
    [1.2, { root: [-86, 0, 0], rootPos: [0, 1.9, -0.4] }],
  ], { hold: true, full: true }),
};
