import type { Clip } from '../clips';
import { DEATHBLADE_STANCE as S } from '../../../models/classRigs/deathblade';
import { clipMaker, mirror, mix, type K, type Pose } from './agileKit';

/**
 * Deathblade action clips, keyed by the anim names used in src/game/action/classes/deathblade.ts.
 * Sharp and low: tiny anticipation, blades whip through on the hit time, crouched recoveries.
 * Poses are absolute (see agileKit). Blades sit in a forward grip on both hands.
 */
const clip = clipMaker(S);

// ---------------------------------------------------------------- reusable poses
const G: Pose = { ...S, rootPos: [0, 0, 0], root: [0, 0, 0] };
const LEGS: Pose = { legL: S.legL!, shinL: S.shinL!, footL: S.footL!, legR: S.legR!, shinR: S.shinR!, footR: S.footR! };
const LUNGE: Pose = { legL: [-50, -8, 10], shinL: [56, 0, 0], footL: [-6, 8, 0], legR: [30, 12, -10], shinR: [30, 0, 0], footR: [-20, -12, 0] };
const DEEP: Pose = { legL: [-56, -10, 16], shinL: [96, 0, 0], footL: [-40, 10, 0], legR: [-20, 12, -16], shinR: [90, 0, 0], footR: [-50, -12, 0] };

/** Blades trailing behind (dashes). */
const TRAIL: Pose = { armL: [44, 0, 30], foreL: [-30, 0, 0], handL: [20, 30, 0], armR: [44, 0, -30], foreR: [-30, 0, 0], handR: [20, -30, 0] };
/** Both arms flung wide, blades out (spins, finishers). */
const WIDE: Pose = { armL: [-84, 0, 84], foreL: [-10, 0, 0], handL: [0, 70, 0], armR: [-84, 0, -84], foreR: [-10, 0, 0], handR: [0, -70, 0] };
const GUARD_L: Pose = { armL: S.armL!, foreL: S.foreL!, handL: S.handL! };
const GUARD_R: Pose = { armR: S.armR!, foreR: S.foreR!, handR: S.handR! };

// right blade sweeps right-to-left, then the left blade back across
const windR: Pose = mix(GUARD_L, { armR: [-72, 0, -72], foreR: [-58, 0, 0], handR: [0, -60, 0], chest: [14, -36, 0], spine: [8, -12, 0], head: [-16, 26, 0] });
const slashR: Pose = mix(GUARD_L, { armR: [-82, 0, 22], foreR: [-18, 0, 0], handR: [0, 40, 0], chest: [16, 42, 0], spine: [8, 14, 0], head: [-16, -32, 0], rootPos: [0, -0.2, 0.8] });
const windL: Pose = mix(mirror(windR), GUARD_R, { chest: [14, 36, 0], spine: [8, 12, 0], head: [-16, -26, 0] });
const slashL: Pose = mix(mirror(slashR), GUARD_R, { chest: [16, -42, 0], spine: [8, -14, 0], head: [-16, 32, 0], rootPos: [0, -0.2, 0.8] });
// both blades: raised and crossed, then a falling X cut
const crossUp: Pose = { armL: [-150, 0, 34], foreL: [-40, 0, 0], handL: [-20, 0, 0], armR: [-150, 0, -34], foreR: [-40, 0, 0], handR: [-20, 0, 0], chest: [-8, 0, 0], spine: [-4, 0, 0], head: [-10, 0, 0] };
const crossDown: Pose = { armL: [-62, 0, -24], foreL: [-12, 0, 0], handL: [56, 0, 0], armR: [-62, 0, 24], foreR: [-12, 0, 0], handR: [56, 0, 0], chest: [26, 0, 0], spine: [10, 0, 0], head: [-22, 0, 0], rootPos: [0, -0.6, 0.9] };
/** Right blade driven straight forward (the wrist turns the blade along the arm). */
const thrustR: Pose = mix(GUARD_L, { armR: [-88, 0, -4], foreR: [-2, 0, 0], handR: [84, 0, 0], chest: [18, 34, 0], spine: [8, 12, 0], head: [-18, -30, 0], rootPos: [0, -0.4, 1.0] });
/** Low vanish crouch (blink / step behind). */
const VANISH: Pose = mix(DEEP, { armL: [30, 0, 20], foreL: [-60, 0, 0], handL: [20, 30, 0], armR: [30, 0, -20], foreR: [-60, 0, 0], handR: [20, -30, 0], chest: [40, 0, 0], spine: [14, 0, 0], head: [-30, 0, 0], rootPos: [0, -2.4, 0] });

/** Spin keys around a bone's yaw (root for full-body spins, spine to keep the legs running). */
function spin(bone: 'root' | 'spine', t0: number, t1: number, turns: number, pose: Pose = {}, base = 0): K[] {
  const n = Math.max(2, Math.round(turns * 3));
  const keys: K[] = [];
  for (let i = 1; i <= n; i++) keys.push([t0 + ((t1 - t0) * i) / n, { ...pose, [bone]: [0, base - (360 * turns * i) / n, 0] }, 'lin']);
  keys.push([t1 + 0.001, { [bone]: [0, base, 0] }, 'lin']);
  return keys;
}

// ---------------------------------------------------------------- the library
export const DEATHBLADE_CLIPS: Record<string, Clip> = {
  db_basic1: clip('db_basic1', 0.3, [
    [0, mix(G, windR)],
    [0.12, mix(slashR, LUNGE), 'out'],
    [0.2, mix(slashR, LUNGE, { armR: [-78, 0, 34], chest: [16, 50, 0] })],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  db_basic2: clip('db_basic2', 0.3, [
    [0, mix(G, windL)],
    [0.12, mix(slashL, LUNGE), 'out'],
    [0.2, mix(slashL, LUNGE, { armL: [-78, 0, -34], chest: [16, -50, 0] })],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  db_basic3: clip('db_basic3', 0.42, [
    [0, G],
    [0.1, mix(crossUp, LEGS, { rootPos: [0, 0.3, 0] })],
    [0.18, mix(crossDown, LUNGE), 'out'],
    [0.3, mix(crossDown, LUNGE, { chest: [30, 0, 0] })],
    [0.42, 'rest'],
  ], { hits: [0.18] }),

  db_dodge: clip('db_dodge', 0.36, [
    [0, G],
    [0.05, mix(TRAIL, LUNGE, { chest: [44, 0, 0], spine: [14, 0, 0], head: [-34, 0, 0], rootPos: [0, -1.8, 0.6] }), 'out'],
    [0.2, mix(TRAIL, LUNGE, { chest: [46, 0, 0], spine: [14, 0, 0], head: [-36, 0, 0], rootPos: [0, -1.8, 0.8] })],
    [0.36, 'rest'],
  ], { full: true }),

  // Cross Harvest: backhand, forehand, then a full spin cut
  db_q1: clip('db_q1', 0.28, [
    [0, mix(G, windL)],
    [0.12, mix(slashL, LUNGE), 'out'],
    [0.18, mix(slashL, LUNGE)],
    [0.28, 'rest'],
  ], { hits: [0.12] }),
  db_q2: clip('db_q2', 0.28, [
    [0, mix(G, windR)],
    [0.12, mix(slashR, LUNGE), 'out'],
    [0.18, mix(slashR, LUNGE)],
    [0.28, 'rest'],
  ], { hits: [0.12] }),
  db_q3: clip('db_q3', 0.45, [
    [0, mix(G, DEEP, { root: [0, 30, 0], chest: [24, 30, 0], rootPos: [0, -1.0, 0] })],
    [0.06, mix(WIDE, DEEP, { chest: [20, 0, 0], spine: [6, 0, 0], head: [-20, 0, 0], root: [0, 0, 0], rootPos: [0, -1.4, 0] })],
    ...spin('root', 0.06, 0.3, 1, mix(WIDE, DEEP, { rootPos: [0, -1.4, 0] })),
    [0.45, 'rest'],
  ], { hits: [0.2], full: true }),

  // Flash Step: vanish, reappear behind with a stab in the back
  db_w: clip('db_w', 0.42, [
    [0, G],
    [0.05, VANISH, 'out'],
    [0.08, VANISH],
    [0.14, mix(thrustR, LUNGE), 'out'],
    [0.26, mix(thrustR, LUNGE)],
    [0.42, 'rest'],
  ], { hits: [0.14], full: true }),

  // Steel Spin: a spinning dash with both blades out
  db_e: clip('db_e', 0.5, [
    [0, mix(G, WIDE, LUNGE, { chest: [20, 0, 0], spine: [6, 0, 0], head: [-20, 0, 0], rootPos: [0, -0.8, 0] })],
    ...spin('root', 0.03, 0.35, 3, mix(WIDE, LUNGE, { chest: [20, 0, 0], rootPos: [0, -0.8, 0.4] })),
    [0.42, mix(G, slashR, LUNGE)],
    [0.5, 'rest'],
  ], { full: true }),

  // Cross Cut: falling X cut, then a rising X cut
  db_r: clip('db_r', 0.6, [
    [0, mix(G, crossUp)],
    [0.16, mix(crossDown, LUNGE), 'out'],
    [0.22, mix(crossDown, LUNGE, { armL: [-30, 0, -20], armR: [-30, 0, 20], chest: [34, 0, 0] })],
    [0.32, mix(LUNGE, { armL: [-160, 0, 60], foreL: [-10, 0, 0], handL: [0, 0, 0], armR: [-160, 0, -60], foreR: [-10, 0, 0], handR: [0, 0, 0], chest: [-14, 0, 0], spine: [-6, 0, 0], head: [-20, 0, 0], rootPos: [0, 0.6, 0.9] }), 'out'],
    [0.44, mix(LUNGE, { armL: [-150, 0, 70], armR: [-150, 0, -70], chest: [-10, 0, 0], rootPos: [0, 0.4, 0.8] })],
    [0.6, 'rest'],
  ], { hits: [0.16, 0.32] }),

  // Blade Storm: upper body whirls (legs keep running), the loop replays seamlessly
  db_a_in: clip('db_a_in', 0.1, [
    [0, G],
    [0.1, mix(WIDE, { chest: [14, 0, 0], spine: [0, 0, 0], head: [-14, 0, 0] })],
  ]),
  db_a_loop: clip('db_a_loop', 0.18, [
    [0, mix(WIDE, { chest: [14, 0, 0], spine: [0, 0, 0], head: [-14, 0, 0] })],
    ...spin('spine', 0, 0.179, 1, WIDE),
  ], { hits: [0.06], fadeIn: 0.001, fadeOut: 0.06 }),
  db_a_out: clip('db_a_out', 0.35, [
    [0, mix(WIDE, { chest: [14, 0, 0], spine: [0, 0, 0], head: [-14, 0, 0] })],
    ...spin('spine', 0, 0.12, 1, mix(WIDE, { chest: [18, 0, 0] }), 0),
    [0.2, mix(WIDE, { armL: [-70, 0, 96], armR: [-70, 0, -96], chest: [20, 0, 0], head: [-18, 0, 0] })],
    [0.35, 'rest'],
  ], { hits: [0.12], fadeIn: 0.001 }),

  // Dagger Fan: hop back and flick five daggers from both hands
  db_s: clip('db_s', 0.45, [
    [0, mix(G, { armL: [-40, 0, -40], foreL: [-120, 0, 0], armR: [-40, 0, 40], foreR: [-120, 0, 0], chest: [10, 0, 0] })],
    [0.14, { armL: [-92, 0, 40], foreL: [0, 0, 0], handL: [0, 0, 0], armR: [-92, 0, -40], foreR: [0, 0, 0], handR: [0, 0, 0], chest: [-6, 0, 0], spine: [-2, 0, 0], head: [-10, 0, 0], legL: [-30, 0, 6], shinL: [40, 0, 0], legR: [-10, 0, -6], shinR: [60, 0, 0], footL: [10, 0, 0], footR: [10, 0, 0], rootPos: [0, 0.8, -0.4] }, 'out'],
    [0.24, { rootPos: [0, 0.4, -0.4] }],
    [0.32, mix(G, DEEP, { rootPos: [0, -1.0, -0.2] }), 'in'],
    [0.45, 'rest'],
  ], { hits: [0.14], full: true }),

  // Execution: step behind, raise both blades, plunge them down
  db_d: clip('db_d', 0.7, [
    [0, G],
    [0.05, VANISH, 'out'],
    [0.08, VANISH],
    [0.2, mix(crossUp, LUNGE, { armL: [-170, 0, 16], armR: [-170, 0, -16], handL: [70, 0, 0], handR: [70, 0, 0], chest: [-12, 0, 0], rootPos: [0, 0.4, 0.2] })],
    [0.3, mix(DEEP, { armL: [-62, 0, -10], foreL: [-6, 0, 0], handL: [80, 0, 0], armR: [-62, 0, 10], foreR: [-6, 0, 0], handR: [80, 0, 0], chest: [44, 0, 0], spine: [14, 0, 0], head: [-32, 0, 0], rootPos: [0, -2.0, 0.9] }), 'in'],
    [0.5, mix(DEEP, { armL: [-58, 0, -10], armR: [-58, 0, 10], chest: [40, 0, 0], rootPos: [0, -1.9, 0.9] })],
    [0.7, 'rest'],
  ], { hits: [0.3], full: true }),

  // Phantom Rush: three dashes with the blades trailing; the last cuts out to both sides
  db_f1: clip('db_f1', 0.32, [
    [0, G],
    [0.03, mix(TRAIL, LUNGE, { chest: [42, 10, 0], spine: [14, 0, 0], head: [-34, -8, 0], rootPos: [0, -1.6, 0.8] }), 'out'],
    [0.18, mix(TRAIL, LUNGE, { chest: [42, 10, 0], spine: [14, 0, 0], head: [-34, -8, 0], rootPos: [0, -1.6, 0.9] })],
    [0.32, 'rest'],
  ], { full: true }),
  db_f2: clip('db_f2', 0.32, [
    [0, G],
    [0.03, mix(mirror(mix(TRAIL, LUNGE)), { chest: [42, -10, 0], spine: [14, 0, 0], head: [-34, 8, 0], rootPos: [0, -1.6, 0.8] }), 'out'],
    [0.18, mix(mirror(mix(TRAIL, LUNGE)), { chest: [42, -10, 0], spine: [14, 0, 0], head: [-34, 8, 0], rootPos: [0, -1.6, 0.9] })],
    [0.32, 'rest'],
  ], { full: true }),
  db_f3: clip('db_f3', 0.5, [
    [0, G],
    [0.03, mix(TRAIL, LUNGE, { chest: [42, 0, 0], spine: [14, 0, 0], head: [-34, 0, 0], rootPos: [0, -1.6, 0.8] }), 'out'],
    [0.16, mix(LUNGE, { armL: [-40, 0, -40], foreL: [-110, 0, 0], armR: [-40, 0, 40], foreR: [-110, 0, 0], chest: [30, 0, 0], spine: [10, 0, 0], head: [-26, 0, 0], rootPos: [0, -1.4, 0.9] })],
    [0.22, mix(DEEP, WIDE, { chest: [16, 0, 0], spine: [6, 0, 0], head: [-18, 0, 0], rootPos: [0, -1.6, 0.9] }), 'out'],
    [0.36, mix(DEEP, WIDE, { chest: [18, 0, 0], rootPos: [0, -1.5, 0.9] })],
    [0.5, 'rest'],
  ], { hits: [0.22], full: true }),

  // Thousand Cuts: vanish in a burst, a spin cut, a blur of slashes, the final X cut
  db_ult: clip('db_ult', 2.0, [
    [0, G],
    [0.1, VANISH, 'out'],
    [0.18, mix(VANISH, { armL: [-60, 0, -40], foreL: [-100, 0, 0], armR: [-60, 0, 40], foreR: [-100, 0, 0] })],
    [0.24, mix(WIDE, DEEP, { chest: [20, 0, 0], spine: [6, 0, 0], head: [-20, 0, 0], rootPos: [0, -1.4, 0] }), 'out'],
    ...spin('root', 0.24, 0.36, 1, mix(WIDE, DEEP)),
    ...[0.46, 0.56, 0.66, 0.76, 0.86, 0.96, 1.06, 1.16].map((t, i): K => [t, mix(i % 2 ? slashL : slashR, i % 2 ? LUNGE : mirror(LUNGE), { root: [0, (i % 4) * 90 - 135, 0], rootPos: [((i % 3) - 1) * 0.8, -0.6, 0.6] }), 'out']),
    [1.24, mix(crossUp, LEGS, { root: [0, 0, 0], rootPos: [0, 0.6, 0] })],
    [1.35, mix(crossDown, DEEP, { rootPos: [0, -1.6, 1.0] }), 'out'],
    [1.7, mix(crossDown, DEEP, { chest: [32, 0, 0], rootPos: [0, -1.6, 1.0] })],
    [2.0, 'rest'],
  ], { hits: [0.3, 1.35], full: true }),

  // Surge: a long dash with blades trailing, then a flash of the blades flung wide
  db_identity: clip('db_identity', 0.6, [
    [0, mix(G, DEEP, { rootPos: [0, -1.4, 0] })],
    [0.05, mix(TRAIL, LUNGE, { chest: [46, 0, 0], spine: [14, 0, 0], head: [-36, 0, 0], rootPos: [0, -1.8, 0.8] }), 'out'],
    [0.28, mix(TRAIL, LUNGE, { chest: [46, 0, 0], spine: [14, 0, 0], head: [-36, 0, 0], rootPos: [0, -1.8, 0.9] })],
    [0.36, mix(WIDE, LEGS, { armL: [-40, 0, 110], armR: [-40, 0, -110], chest: [-14, 0, 0], spine: [-4, 0, 0], head: [-18, 0, 0], rootPos: [0, 0.2, 0.4] }), 'back'],
    [0.6, 'rest'],
  ], { hits: [0.3], full: true }),

  // ------------------------------------------------------------ reactions, victory, death
  db_stagger: clip('db_stagger', 1.0, [
    [0, { chest: [16, 0, 8], head: [20, 10, 10], armL: [-10, 0, 22], foreL: [-30, 0, 0], armR: [-10, 0, -22], foreR: [-30, 0, 0], rootPos: [0, -0.3, 0] }],
    [0.25, { chest: [18, -8, -8], head: [22, -14, -12], rootPos: [-0.3, -0.4, 0] }],
    [0.5, { chest: [14, 0, 6], head: [18, 10, 8], rootPos: [0, -0.3, 0] }],
    [0.75, { chest: [18, 8, 8], head: [22, 14, 12], rootPos: [0.3, -0.4, 0] }],
    [1.0, { chest: [16, 0, 8], head: [20, 10, 10], rootPos: [0, -0.3, 0] }],
  ], { loopFrom: 0 }),
  db_heavyhit: clip('db_heavyhit', 0.5, [
    [0, G],
    [0.08, { chest: [-30, -12, 0], spine: [-10, 0, 0], head: [-26, 0, 0], armL: [-50, 0, 60], foreL: [-20, 0, 0], armR: [-50, 0, -60], foreR: [-20, 0, 0], legL: [-24, 0, 6], shinL: [20, 0, 0], legR: [20, 0, -6], shinR: [30, 0, 0], rootPos: [0, -0.2, -1.5] }, 'out'],
    [0.26, mix(DEEP, GUARD_L, GUARD_R, { chest: [24, 0, 0], spine: [8, 0, 0], head: [-10, 0, 0], rootPos: [0, -2.0, -1.6] })],
    [0.5, 'rest'],
  ], { full: true }),
  db_victory: clip('db_victory', 1.6, [
    [0, G],
    // a flourish: both blades spun out, then sheathed crossed behind the back
    [0.3, mix(WIDE, LEGS, { chest: [0, 0, 0], head: [-8, 0, 0], rootPos: [0, -0.4, 0] })],
    [0.65, { legL: [-6, -10, 6], shinL: [8, 0, 0], footL: [0, 10, 0], legR: [4, 10, -4], shinR: [6, 0, 0], footR: [0, -10, 0], hips: [0, 0, 0], armL: [30, 0, 10], foreL: [-40, 0, 0], handL: [0, 0, 0], armR: [-150, 0, -20], foreR: [-30, 0, 0], handR: [-30, 0, 0], chest: [-6, -10, 0], spine: [-2, 0, 0], head: [-10, 16, 0], rootPos: [0, 0, 0] }, 'back'],
    [1.1, { armR: [-154, 0, -16], chest: [-8, -12, 0], head: [-12, 18, 0] }],
    [1.6, { armR: [-150, 0, -20], chest: [-6, -10, 0], head: [-10, 16, 0] }],
  ], { loopFrom: 0.65, full: true }),
  db_death: clip('db_death', 1.2, [
    [0, G],
    [0.15, { chest: [-26, -20, 0], spine: [-8, 0, 0], head: [-24, 0, 0], armL: [-40, 0, 50], foreL: [-20, 0, 0], armR: [-40, 0, -50], foreR: [-20, 0, 0], rootPos: [0, -0.4, -0.5] }, 'out'],
    // to the knees, then folding forward onto the ground
    [0.5, { legL: [-90, 0, 6], shinL: [150, 0, 0], footL: [-60, 0, 0], legR: [-90, 0, -6], shinR: [150, 0, 0], footR: [-60, 0, 0], chest: [20, 0, 0], spine: [8, 0, 0], head: [10, 0, 0], armL: [10, 0, 20], foreL: [-20, 0, 0], armR: [10, 0, -20], foreR: [-20, 0, 0], rootPos: [0, -4.4, 0] }, 'in'],
    [0.9, { legL: [-4, 0, 6], shinL: [10, 0, 0], footL: [30, 0, 0], legR: [-4, 0, -6], shinR: [16, 0, 0], footR: [30, 0, 0], chest: [6, 0, 0], spine: [2, 0, 0], head: [-20, 30, 0], armL: [-150, 0, 30], foreL: [-20, 0, 0], armR: [-60, 0, -50], foreR: [-40, 0, 0], root: [84, 0, 0], rootPos: [0, 1.4, -1.0] }, 'in'],
    [1.02, { root: [80, 0, 0], rootPos: [0, 1.7, -1.0] }],
    [1.2, { root: [84, 0, 0], rootPos: [0, 1.4, -1.0] }],
  ], { hold: true, full: true }),
};
