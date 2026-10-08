import type { Clip } from '../clips';
import { REAPER_STANCE as S } from '../../../models/classRigs/reaper';
import { clipMaker, mirror, mix, type K, type Pose } from './agileKit';

/**
 * Reaper action clips, keyed by the anim names used in src/game/action/classes/reaper.ts.
 * Sharp and low, with a gliding menace: reverse-grip hammer stabs, outward backhand cuts, a
 * spinning dance and the phantom scythe sweeps. Poses are absolute (see agileKit).
 */
const clip = clipMaker(S);

// ---------------------------------------------------------------- reusable poses
const G: Pose = { ...S, rootPos: [0, 0, 0], root: [0, 0, 0] };
const LEGS: Pose = { legL: S.legL!, shinL: S.shinL!, footL: S.footL!, legR: S.legR!, shinR: S.shinR!, footR: S.footR! };
const LUNGE: Pose = { legL: [-48, -8, 10], shinL: [56, 0, 0], footL: [-8, 8, 0], legR: [28, 10, -10], shinR: [34, 0, 0], footR: [-22, -10, 0] };
const DEEP: Pose = { legL: [-58, -10, 16], shinL: [100, 0, 0], footL: [-42, 10, 0], legR: [-20, 12, -16], shinR: [92, 0, 0], footR: [-52, -12, 0] };
const GUARD_L: Pose = { armL: S.armL!, foreL: S.foreL!, handL: S.handL! };
const GUARD_R: Pose = { armR: S.armR!, foreR: S.foreR!, handR: S.handR! };

// reverse-grip hammer stab: fist raised, then driven down and forward (blade points down)
const raiseR: Pose = mix(GUARD_L, { armR: [-158, 0, -20], foreR: [-56, 0, 0], handR: [0, 0, 0], chest: [4, -20, 0], spine: [4, -6, 0], head: [-14, 14, 0] });
const stabR: Pose = mix(GUARD_L, { armR: [-72, 0, -6], foreR: [-22, 0, 0], handR: [10, 0, 0], chest: [26, 30, 0], spine: [10, 10, 0], head: [-26, -24, 0], rootPos: [0, -0.6, 0.8] });
const raiseL: Pose = mix(mirror(raiseR), GUARD_R, { chest: [4, 20, 0], spine: [4, 6, 0], head: [-14, -14, 0] });
const stabL: Pose = mix(mirror(stabR), GUARD_R, { chest: [26, -30, 0], spine: [10, -10, 0], head: [-26, 24, 0], rootPos: [0, -0.6, 0.8] });
// outward backhand cut with the right dagger
const backWindR: Pose = mix(GUARD_L, { armR: [-70, 0, 34], foreR: [-104, 0, 0], handR: [0, 0, 0], chest: [16, 36, 0], spine: [6, 12, 0], head: [-20, -28, 0] });
const backCutR: Pose = mix(GUARD_L, { armR: [-82, 0, -86], foreR: [-10, 0, 0], handR: [0, 0, 0], chest: [20, -34, 0], spine: [8, -12, 0], head: [-22, 26, 0], rootPos: [0, -0.4, 0.7] });
/** Both arms crossed before the chest, daggers in. */
const CROSSED: Pose = { armL: [-80, 0, -40], foreL: [-96, 0, 0], handL: [0, 0, 0], armR: [-80, 0, 40], foreR: [-96, 0, 0], handR: [0, 0, 0] };
/** Both arms wide, daggers out (spins, releases). */
const WIDE: Pose = { armL: [-76, 0, 88], foreL: [-10, 0, 0], handL: [0, 0, 0], armR: [-76, 0, -88], foreR: [-10, 0, 0], handR: [0, 0, 0] };
/** Daggers pointed forward along the forearms (a punching thrust). */
const thrustR: Pose = mix(GUARD_L, { armR: [-94, 0, -2], foreR: [-2, 0, 0], handR: [-62, 0, 0], chest: [22, 30, 0], spine: [8, 10, 0], head: [-24, -26, 0], rootPos: [0, -0.6, 1.2] });
const VANISH: Pose = mix(DEEP, CROSSED, { chest: [44, 0, 0], spine: [16, 0, 0], head: [-26, 0, 0], rootPos: [0, -2.6, 0] });
const TRAIL: Pose = { armL: [46, 0, 24], foreL: [-30, 0, 0], handL: [0, 0, 0], armR: [46, 0, -24], foreR: [-30, 0, 0], handR: [0, 0, 0] };

function spin(bone: 'root' | 'spine', t0: number, t1: number, turns: number, pose: Pose = {}): K[] {
  const n = Math.max(2, Math.round(turns * 3));
  const keys: K[] = [];
  for (let i = 1; i <= n; i++) keys.push([t0 + ((t1 - t0) * i) / n, { ...pose, [bone]: [0, -(360 * turns * i) / n, 0] }, 'lin']);
  keys.push([t1 + 0.001, { [bone]: [0, 0, 0] }, 'lin']);
  return keys;
}

// ---------------------------------------------------------------- the library
export const REAPER_CLIPS: Record<string, Clip> = {
  rp_basic1: clip('rp_basic1', 0.3, [
    [0, mix(G, raiseR)],
    [0.12, mix(stabR, LUNGE), 'out'],
    [0.2, mix(stabR, LUNGE)],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  rp_basic2: clip('rp_basic2', 0.3, [
    [0, mix(G, raiseL)],
    [0.12, mix(stabL, mirror(LUNGE)), 'out'],
    [0.2, mix(stabL, mirror(LUNGE))],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  // crossed daggers torn outward, leaving the dark trail
  rp_basic3: clip('rp_basic3', 0.42, [
    [0, G],
    [0.1, mix(CROSSED, DEEP, { chest: [30, 0, 0], spine: [10, 0, 0], head: [-26, 0, 0], rootPos: [0, -1.4, 0] })],
    [0.18, mix(WIDE, LUNGE, { chest: [10, 0, 0], spine: [4, 0, 0], head: [-18, 0, 0], rootPos: [0, -0.6, 0.8] }), 'out'],
    [0.3, mix(WIDE, LUNGE, { armL: [-60, 0, 100], armR: [-60, 0, -100], chest: [12, 0, 0], rootPos: [0, -0.6, 0.8] })],
    [0.42, 'rest'],
  ], { hits: [0.18] }),

  rp_dodge: clip('rp_dodge', 0.34, [
    [0, G],
    [0.04, mix(TRAIL, LUNGE, { chest: [46, 0, 0], spine: [16, 0, 0], head: [-36, 0, 0], rootPos: [0, -2.0, 0.6] }), 'out'],
    [0.18, mix(TRAIL, LUNGE, { chest: [46, 0, 0], spine: [16, 0, 0], head: [-36, 0, 0], rootPos: [0, -2.0, 0.8] })],
    [0.34, 'rest'],
  ], { full: true }),

  // Grim Slash: backhand cut, then a dashing thrust through
  rp_q1: clip('rp_q1', 0.3, [
    [0, mix(G, backWindR)],
    [0.12, mix(backCutR, LUNGE), 'out'],
    [0.2, mix(backCutR, LUNGE, { armR: [-74, 0, -100] })],
    [0.3, 'rest'],
  ], { hits: [0.12] }),
  rp_q2: clip('rp_q2', 0.42, [
    [0, mix(G, { armR: [20, 0, -20], foreR: [-120, 0, 0], handR: [-40, 0, 0], chest: [20, -24, 0], rootPos: [0, -1.0, -0.2] })],
    [0.04, mix(G, DEEP, { armR: [24, 0, -20], foreR: [-124, 0, 0], handR: [-50, 0, 0], chest: [30, -28, 0], spine: [12, -8, 0], head: [-26, 20, 0], rootPos: [0, -1.6, 0.2] })],
    [0.16, mix(thrustR, LUNGE, { armL: [30, 0, 30], foreL: [-60, 0, 0] }), 'out'],
    [0.28, mix(thrustR, LUNGE, { armL: [30, 0, 30], foreL: [-60, 0, 0], rootPos: [0, -0.6, 1.1] })],
    [0.42, 'rest'],
  ], { hits: [0.16], full: true }),

  // Shadow Step: drop into the shadow, blink, rise at the target
  rp_w: clip('rp_w', 0.35, [
    [0, G],
    [0.04, VANISH, 'out'],
    [0.08, VANISH],
    [0.2, mix(G, DEEP, { chest: [24, 0, 0], rootPos: [0, -1.4, 0] })],
    [0.35, 'rest'],
  ], { full: true }),

  // Toxic Mist: crouch and spread the arms as the cloud blooms
  rp_e: clip('rp_e', 0.45, [
    [0, G],
    [0.1, mix(CROSSED, DEEP, { chest: [30, 0, 0], head: [-14, 0, 0], rootPos: [0, -1.8, 0] })],
    [0.18, mix(DEEP, { armL: [-26, 0, 76], foreL: [-20, 0, 0], handL: [0, 0, 0], armR: [-26, 0, -76], foreR: [-20, 0, 0], handR: [0, 0, 0], chest: [22, 0, 0], spine: [8, 0, 0], head: [-20, 0, 0], rootPos: [0, -1.8, 0] }), 'out'],
    [0.32, mix(DEEP, { armL: [-20, 0, 70], armR: [-20, 0, -70], chest: [26, 0, 0], rootPos: [0, -1.9, 0] })],
    [0.45, 'rest'],
  ], { hits: [0.18], full: true }),

  // Ambush: vanish, reappear behind, both daggers hammered down into the back
  rp_r: clip('rp_r', 0.6, [
    [0, G],
    [0.05, VANISH, 'out'],
    [0.13, VANISH],
    [0.18, mix(LUNGE, { armL: [-160, 0, 20], foreL: [-50, 0, 0], handL: [0, 0, 0], armR: [-160, 0, -20], foreR: [-50, 0, 0], handR: [0, 0, 0], chest: [-6, 0, 0], spine: [0, 0, 0], head: [-18, 0, 0], rootPos: [0, 0.4, 0.4] }), 'out'],
    [0.24, mix(DEEP, { armL: [-70, 0, -8], foreL: [-20, 0, 0], armR: [-70, 0, 8], foreR: [-20, 0, 0], chest: [42, 0, 0], spine: [14, 0, 0], head: [-30, 0, 0], rootPos: [0, -1.8, 0.9] }), 'in'],
    [0.42, mix(DEEP, { armL: [-66, 0, -8], armR: [-66, 0, 8], chest: [40, 0, 0], rootPos: [0, -1.8, 0.9] })],
    [0.6, 'rest'],
  ], { hits: [0.24], full: true }),

  // Death Dance: spinning through four cuts while gliding forward
  rp_a: clip('rp_a', 0.75, [
    [0, mix(G, CROSSED, DEEP, { chest: [24, 0, 0], rootPos: [0, -1.2, 0] })],
    [0.05, mix(WIDE, LUNGE, { chest: [14, 0, 0], spine: [4, 0, 0], head: [-18, 0, 0], rootPos: [0, -0.8, 0.3] })],
    ...spin('root', 0.05, 0.62, 4, mix(WIDE, LUNGE, { rootPos: [0, -0.8, 0.4] })),
    [0.75, 'rest'],
  ], { hits: [0.1, 0.23, 0.36, 0.49], full: true }),

  // Dark Scythe: a huge two-handed sweep across the front (the phantom scythe follows the hands)
  rp_s: clip('rp_s', 0.6, [
    [0, G],
    [0.16, mix(DEEP, { armL: [-90, 0, -20], foreL: [-30, 0, 0], handL: [0, 0, 0], armR: [-80, 0, 50], foreR: [-30, 0, 0], handR: [0, 0, 0], chest: [20, 64, 0], spine: [8, 22, 0], head: [-20, -40, 0], rootPos: [0, -1.4, -0.2] })],
    [0.28, mix(LUNGE, { armL: [-80, 0, 60], foreL: [-20, 0, 0], armR: [-90, 0, -20], foreR: [-30, 0, 0], chest: [22, -60, 0], spine: [8, -20, 0], head: [-20, 40, 0], rootPos: [0, -0.8, 0.9] }), 'out'],
    [0.42, mix(LUNGE, { armL: [-70, 0, 80], armR: [-80, 0, 10], chest: [20, -70, 0], spine: [8, -24, 0], rootPos: [0, -0.8, 0.9] })],
    [0.6, 'rest'],
  ], { hits: [0.28] }),

  // Phantom Blades: both hands flick open, releasing three seeking blades
  rp_d: clip('rp_d', 0.4, [
    [0, mix(G, CROSSED, { chest: [20, 0, 0], rootPos: [0, -0.6, 0] })],
    [0.14, mix(LEGS, { armL: [-100, 0, 30], foreL: [-4, 0, 0], handL: [-50, 0, 0], armR: [-100, 0, -30], foreR: [-4, 0, 0], handR: [-50, 0, 0], chest: [4, 0, 0], spine: [2, 0, 0], head: [-14, 0, 0], rootPos: [0, -0.4, 0.4] }), 'out'],
    [0.26, { armL: [-96, 0, 34], armR: [-96, 0, -34] }],
    [0.4, 'rest'],
  ], { hits: [0.14] }),

  // Vanish: leap back wrapped in the cloak
  rp_f: clip('rp_f', 0.4, [
    [0, mix(G, VANISH)],
    [0.12, { ...TRAIL, armR: [-100, 0, 30], foreR: [-100, 0, 0], legL: [-40, 0, 6], shinL: [70, 0, 0], footL: [10, 0, 0], legR: [-20, 0, -6], shinR: [90, 0, 0], footR: [10, 0, 0], chest: [-8, 0, 0], spine: [-4, 0, 0], head: [-6, 0, 0], rootPos: [0, 2.4, -0.4] }, 'out'],
    [0.24, mix(DEEP, CROSSED, { chest: [30, 0, 0], head: [-24, 0, 0], rootPos: [0, -1.8, -0.2] }), 'in'],
    [0.4, 'rest'],
  ], { hits: [0.02], full: true }),

  // Soul Harvest: summon the giant scythe overhead, sweep, reap around, slam it down
  rp_ult: clip('rp_ult', 2.1, [
    [0, G],
    [0.25, mix(LEGS, { armL: [-172, 0, 10], foreL: [-20, 0, 0], handL: [0, 0, 0], armR: [-172, 0, -10], foreR: [-20, 0, 0], handR: [0, 0, 0], chest: [-14, 50, 0], spine: [-6, 16, 0], head: [-24, -20, 0], rootPos: [0, 0.4, 0] })],
    [0.35, mix(LUNGE, { armL: [-90, 0, 50], foreL: [-10, 0, 0], armR: [-90, 0, -10], foreR: [-20, 0, 0], chest: [22, -60, 0], spine: [8, -20, 0], head: [-20, 30, 0], rootPos: [0, -0.8, 0.8] }), 'out'],
    [0.5, mix(WIDE, DEEP, { chest: [18, 0, 0], spine: [6, 0, 0], head: [-20, 0, 0], rootPos: [0, -1.4, 0.8] })],
    ...spin('root', 0.5, 1.2, 2, mix(WIDE, DEEP, { rootPos: [0, -1.4, 0.8] })),
    [1.38, mix(LEGS, { armL: [-176, 0, 6], foreL: [-10, 0, 0], armR: [-176, 0, -6], foreR: [-10, 0, 0], chest: [-16, 0, 0], spine: [-6, 0, 0], head: [-24, 0, 0], rootPos: [0, 0.6, 0.6] })],
    [1.5, mix(DEEP, { armL: [-60, 0, -10], foreL: [-10, 0, 0], armR: [-60, 0, 10], foreR: [-10, 0, 0], chest: [46, 0, 0], spine: [16, 0, 0], head: [-32, 0, 0], rootPos: [0, -2.2, 1.0] }), 'in'],
    [1.8, mix(DEEP, { armL: [-56, 0, -10], armR: [-56, 0, 10], chest: [42, 0, 0], rootPos: [0, -2.1, 1.0] })],
    [2.1, 'rest'],
  ], { hits: [0.35, 1.5], full: true }),

  // Persona: a sinister flourish, then the shadow takes it
  rp_identity: clip('rp_identity', 0.4, [
    [0, G],
    [0.1, mix(CROSSED, DEEP, { chest: [36, 0, 0], spine: [12, 0, 0], head: [-10, 0, 0], rootPos: [0, -2.0, 0] }), 'out'],
    [0.22, mix(WIDE, LEGS, { armL: [-40, 0, 96], armR: [-40, 0, -96], chest: [-10, 0, 0], head: [-16, 0, 0], rootPos: [0, 0, 0] }), 'back'],
    [0.4, 'rest'],
  ], { hits: [0.1], full: true }),

  // ------------------------------------------------------------ reactions, victory, death
  rp_stagger: clip('rp_stagger', 1.0, [
    [0, { chest: [20, 0, 8], head: [16, 10, 10], armL: [-6, 0, 18], foreL: [-24, 0, 0], armR: [-6, 0, -18], foreR: [-24, 0, 0], rootPos: [0, -0.4, 0] }],
    [0.25, { chest: [22, -8, -8], head: [18, -14, -12], rootPos: [-0.3, -0.5, 0] }],
    [0.5, { chest: [18, 0, 6], head: [14, 10, 8], rootPos: [0, -0.4, 0] }],
    [0.75, { chest: [22, 8, 8], head: [18, 14, 12], rootPos: [0.3, -0.5, 0] }],
    [1.0, { chest: [20, 0, 8], head: [16, 10, 10], rootPos: [0, -0.4, 0] }],
  ], { loopFrom: 0 }),
  rp_heavyhit: clip('rp_heavyhit', 0.5, [
    [0, G],
    [0.08, { chest: [-24, -10, 0], spine: [-10, 0, 0], head: [-24, 0, 0], armL: [-50, 0, 56], foreL: [-20, 0, 0], armR: [-50, 0, -56], foreR: [-20, 0, 0], legL: [-24, 0, 6], shinL: [20, 0, 0], legR: [20, 0, -6], shinR: [30, 0, 0], rootPos: [0, -0.2, -1.5] }, 'out'],
    [0.26, mix(DEEP, GUARD_L, GUARD_R, { chest: [30, 0, 0], spine: [10, 0, 0], head: [-14, 0, 0], rootPos: [0, -2.0, -1.6] })],
    [0.5, 'rest'],
  ], { full: true }),
  rp_victory: clip('rp_victory', 1.6, [
    [0, G],
    // a slow mocking bow: one dagger hand across the chest, the other held out low
    [0.6, { legL: [-14, -10, 4], shinL: [16, 0, 0], footL: [-2, 10, 0], legR: [12, 10, -4], shinR: [10, 0, 0], footR: [-6, -10, 0], hips: [0, 0, 0], armR: [-70, 0, 40], foreR: [-100, 0, 0], handR: [0, 0, 0], armL: [-20, 0, 60], foreL: [-10, 0, 0], handL: [0, 0, 0], chest: [30, 0, 0], spine: [10, 0, 0], head: [8, 0, 0], rootPos: [0, -0.4, 0] }],
    [1.0, { chest: [10, 0, 0], spine: [4, 0, 0], head: [-18, 10, 0], armL: [-24, 0, 64], rootPos: [0, -0.2, 0] }],
    [1.3, { chest: [12, 0, 0], head: [-20, 14, 0] }],
    [1.6, { chest: [10, 0, 0], head: [-18, 10, 0] }],
  ], { loopFrom: 1.0, full: true }),
  rp_death: clip('rp_death', 1.2, [
    [0, G],
    [0.15, { chest: [-20, 16, 0], spine: [-6, 0, 0], head: [-26, 0, 0], armL: [-40, 0, 40], foreL: [-20, 0, 0], armR: [-40, 0, -40], foreR: [-20, 0, 0], rootPos: [0, -0.4, -0.4] }, 'out'],
    [0.5, { legL: [-90, 0, 6], shinL: [150, 0, 0], footL: [-60, 0, 0], legR: [-90, 0, -6], shinR: [150, 0, 0], footR: [-60, 0, 0], chest: [24, 0, 0], spine: [8, 0, 0], head: [20, 0, 0], armL: [10, 0, 16], foreL: [-20, 0, 0], armR: [10, 0, -16], foreR: [-20, 0, 0], rootPos: [0, -4.3, 0] }, 'in'],
    [0.9, { legL: [-4, 0, 6], shinL: [10, 0, 0], footL: [30, 0, 0], legR: [-4, 0, -6], shinR: [16, 0, 0], footR: [30, 0, 0], chest: [6, 0, 0], spine: [2, 0, 0], head: [-20, -30, 0], armL: [-60, 0, 50], foreL: [-40, 0, 0], armR: [-150, 0, -30], foreR: [-20, 0, 0], root: [84, 0, 0], rootPos: [0, 1.4, -1.0] }, 'in'],
    [1.02, { root: [80, 0, 0], rootPos: [0, 1.7, -1.0] }],
    [1.2, { root: [84, 0, 0], rootPos: [0, 1.4, -1.0] }],
  ], { hold: true, full: true }),
};
