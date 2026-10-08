import type { Clip } from '../clips';
import { summonerRig } from '../../../models/classRigs/summoner';
import { clipMaker, crouch, LEGS0, mix, nudge, reactions, type Pose } from './rangedKit';

const ST = summonerRig().anim.stance;
const make = clipMaker(ST);
const H = 8.9;

// The staff runs along the hand's y axis: it stays upright while armR + foreR + handR pitch ≈ 0.
const STAFF_HIGH: Pose = { armR: [-100, 0, -45], foreR: [-10, 0, 0], handR: [110, 0, -20] };
const STAFF_MID: Pose = { armR: [-62, 0, -14], foreR: [-34, 0, 0], handR: [96, 0, 0] };
const STAFF_SLAM: Pose = { armR: [-40, 0, -12], foreR: [-36, 0, 0], handR: [70, 0, 0] };
const STAFF_FWD: Pose = { armR: [-72, 0, -8], foreR: [-20, 0, 0], handR: [140, 0, 0] };
// free (left) hand gestures
const PUSH_L: Pose = { armL: [-88, -8, 10], foreL: [-4, 0, 0], handL: [-70, -20, 0] };
const GATHER: Pose = { armL: [-46, 0, -12], foreL: [-74, 0, 0], handL: [-10, 0, 0], chest: [-8, 0, 0], head: [-6, 0, 0] };
const WIDE: Pose = { armL: [-56, 0, 72], foreL: [-10, 0, 0], handL: [-30, 0, 0] };
const POINT_L: Pose = { armL: [-88, -6, 6], foreL: [0, 0, 0], handL: [-8, 0, 0], chest: [0, -20, 0], head: [-2, 16, 0] };
const SKY: Pose = { armL: [-150, 0, 34], foreL: [-12, 0, 0], handL: [-20, 0, 0], chest: [-12, 0, 0], head: [-20, 0, 0] };

export const SUMMONER_CLIPS: Record<string, Clip> = {
  // spirit bolt pushed from the open palm, the staff lifted a little
  sm_basic: make('sm_basic', 0.45, [
    [0, 'rest'],
    [0.12, mix(GATHER, STAFF_MID, { chest: [-6, 14, 0] })],
    [0.2, mix(PUSH_L, STAFF_MID, { chest: [4, -22, 0], head: [0, 16, 0] }), 'out'],
    [0.3, mix(nudge(PUSH_L, { armL: [6, 0, 0] }), STAFF_MID, { chest: [4, -20, 0], head: [0, 14, 0] })],
    [0.45, 'rest'],
  ], { hits: [0.2] }),

  // a graceful twirl along the dash
  sm_dodge: make('sm_dodge', 0.45, [
    [0, { root: [0, 0, 0], rootPos: [0, 0, 0], ...LEGS0, armL: ST.armL!, foreL: ST.foreL! }],
    [0.08, { root: [0, -90, 0], rootPos: [0, 0.6, 0], legL: [-20, 0, 10], legR: [10, 0, -6], shinL: [40, 0, 0], shinR: [10, 0, 0], armL: [-30, 0, 70], foreL: [-10, 0, 0] }],
    [0.18, { root: [0, -200, 0], rootPos: [0, 0.9, 0], legL: [-30, 0, 12], legR: [6, 0, -8], shinL: [56, 0, 0], shinR: [16, 0, 0] }, 'lin'],
    [0.28, { root: [0, -330, 0], rootPos: [0, 0.4, 0], legL: [-10, 0, 6], legR: [0, 0, -4], shinL: [20, 0, 0], shinR: [8, 0, 0], armL: [-40, 0, 50] }, 'out'],
    [0.32, { root: [0, -360, 0], rootPos: [0, 0, 0] }],
    [0.321, { root: [0, 0, 0] }],
    [0.45, { root: [0, 0, 0], rootPos: [0, 0, 0], ...LEGS0, armL: ST.armL!, foreL: ST.foreL! }],
  ], { full: true, fadeIn: 0.03, fadeOut: 0.1 }),

  // Wolf Pack: draw the spirits in, then fling both arms wide
  sm_q: make('sm_q', 0.55, [
    [0, 'rest'],
    [0.16, mix(GATHER, STAFF_MID, { rootPos: [0, -0.3, 0] })],
    [0.3, mix(WIDE, STAFF_HIGH, { chest: [-10, 0, 0], head: [-12, 0, 0], rootPos: [0, 0.3, 0] }), 'out'],
    [0.4, mix(WIDE, STAFF_HIGH, { chest: [-8, 0, 0], head: [-10, 0, 0], rootPos: [0, 0.2, 0] })],
    [0.55, 'rest'],
  ], { hits: [0.3] }),

  // Stone Golem: staff hoisted high, slammed into the ground
  sm_w: make('sm_w', 0.7, [
    [0, 'rest'],
    [0.24, mix(STAFF_HIGH, SKY, { rootPos: [0, 0.5, 0] })],
    [0.4, mix(STAFF_SLAM, { armL: [-30, 0, 40], foreL: [-30, 0, 0], handL: [-60, 0, 0], chest: [22, 0, 0], spine: [8, 0, 0], head: [-10, 0, 0], rootPos: [0, -1.0, 0.4] }), 'in'],
    [0.52, mix(STAFF_SLAM, { chest: [20, 0, 0], spine: [7, 0, 0], rootPos: [0, -0.9, 0.4] })],
    [0.7, 'rest'],
  ], { hits: [0.4] }),

  // Wisp Swarm: both palms raised, the staff crystal held up
  sm_e: make('sm_e', 0.5, [
    [0, 'rest'],
    [0.14, mix(GATHER, STAFF_MID)],
    [0.25, mix(SKY, STAFF_HIGH, { rootPos: [0, 0.4, 0] }), 'out'],
    [0.36, mix(nudge(SKY, { armL: [8, 0, 6] }), STAFF_HIGH, { rootPos: [0, 0.3, 0] })],
    [0.5, 'rest'],
  ], { hits: [0.25] }),

  // Soul Orb: a heavier two-step push
  sm_r: make('sm_r', 0.5, [
    [0, 'rest'],
    [0.12, mix(GATHER, STAFF_MID, { chest: [-8, 24, 0], head: [-4, -10, 0], rootPos: [0, 0, -0.3] })],
    [0.2, mix(PUSH_L, STAFF_MID, { chest: [8, -28, 0], head: [0, 20, 0], rootPos: [0, -0.3, 0.6] }), 'out'],
    [0.32, mix(PUSH_L, STAFF_MID, { chest: [6, -24, 0], head: [0, 18, 0], rootPos: [0, -0.2, 0.4] })],
    [0.5, 'rest'],
  ], { hits: [0.2] }),

  // Frost Bloom: staff struck down, the free hand spreads frost over the ground
  sm_a: make('sm_a', 0.5, [
    [0, 'rest'],
    [0.12, mix(STAFF_MID, { armL: [-70, 0, 20], foreL: [-30, 0, 0], handL: [-20, 0, 0], chest: [-6, 0, 0], rootPos: [0, 0.3, 0] })],
    [0.22, mix(STAFF_SLAM, { armL: [-50, 0, 40], foreL: [-10, 0, 0], handL: [-70, 0, 0], chest: [18, 0, 0], head: [10, 0, 0], rootPos: [0, -0.7, 0] }), 'in'],
    [0.32, mix(STAFF_SLAM, { chest: [16, 0, 0], rootPos: [0, -0.6, 0] })],
    [0.5, 'rest'],
  ], { hits: [0.22] }),

  // Frenzy: staff raised, a rallying call
  sm_s: make('sm_s', 0.5, [
    [0, 'rest'],
    [0.2, mix(STAFF_HIGH, WIDE, { chest: [-12, 0, 0], head: [-18, 0, 0], rootPos: [0, 0.4, 0] }), 'back'],
    [0.32, mix(STAFF_HIGH, WIDE, { chest: [-10, 0, 0], head: [-14, 0, 0], rootPos: [0, 0.3, 0] })],
    [0.5, 'rest'],
  ], { hits: [0.2] }),

  // Thorn Vines: a low sweep of the free hand across the ground
  sm_d: make('sm_d', 0.55, [
    [0, 'rest'],
    [0.12, mix(STAFF_MID, { armL: [-40, 30, -20], foreL: [-60, 0, 0], handL: [-10, 0, 0], chest: [10, 24, 0], head: [6, -10, 0] })],
    [0.24, mix(STAFF_MID, { armL: [-50, -20, 70], foreL: [-6, 0, 0], handL: [-50, 0, 0], chest: [22, -20, 0], spine: [8, 0, 0], head: [-8, 12, 0], rootPos: [0, -0.8, 0.3] }), 'out'],
    [0.36, mix(STAFF_MID, { armL: [-46, -24, 74], chest: [20, -22, 0], rootPos: [0, -0.7, 0.3] })],
    [0.55, 'rest'],
  ], { hits: [0.24] }),

  // Sky Serpent: arms spiral up from low to high
  sm_f: make('sm_f', 0.65, [
    [0, 'rest'],
    [0.16, mix(STAFF_SLAM, { armL: [-20, 0, -10], foreL: [-60, 0, 0], handL: [20, 0, 0], chest: [16, -20, 0], head: [10, 10, 0], rootPos: [0, -0.5, 0] })],
    [0.35, mix(STAFF_HIGH, SKY, { chest: [-16, 16, 0], head: [-26, -6, 0], rootPos: [0, 0.6, 0] }), 'out'],
    [0.48, mix(STAFF_HIGH, SKY, { chest: [-14, 12, 0], head: [-22, -4, 0], rootPos: [0, 0.5, 0] })],
    [0.65, 'rest'],
  ], { hits: [0.35] }),

  // Flame Drake: kneel and gather, rise levitating with the staff high, sweep it forward
  sm_ult: make('sm_ult', 1.8, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST, spine: [0, 0, 0] }],
    [0.2, mix(crouch(0.5), GATHER, STAFF_MID, { rootPos: [0, -1.1, 0], chest: [16, 0, 0], head: [14, 0, 0] })],
    [0.6, mix(STAFF_HIGH, SKY, { legL: [-8, 0, 4], legR: [6, 0, -4], shinL: [30, 0, 0], shinR: [24, 0, 0], footL: [30, 0, 0], footR: [30, 0, 0], chest: [-18, 0, 0], spine: [-6, 0, 0], head: [-28, 0, 0], rootPos: [0, 2.2, 0] }), 'back'],
    [0.8, mix(STAFF_FWD, WIDE, { chest: [10, 0, 0], spine: [4, 0, 0], head: [0, 0, 0], rootPos: [0, 2.0, 0.6] }), 'out'],
    [1.1, mix(STAFF_FWD, PUSH_L, { chest: [12, -10, 0], head: [0, 10, 0], rootPos: [0, 1.8, 0.6] })],
    [1.4, mix(STAFF_MID, WIDE, { chest: [0, 0, 0], rootPos: [0, 1.0, 0.3] })],
    [1.8, { ...LEGS0, rootPos: [0, 0, 0], ...ST, spine: [0, 0, 0] }],
  ], { full: true, hits: [0.6], events: [{ t: 0.2, ev: 'ability' }, { t: 0.8, ev: 'impulse' }, { t: 1.1, ev: 'impulse' }] }),

  // Ancient: staff slammed down, then a commanding point
  sm_identity: make('sm_identity', 0.6, [
    [0, 'rest'],
    [0.16, mix(STAFF_HIGH, GATHER, { rootPos: [0, 0.4, 0] })],
    [0.3, mix(STAFF_SLAM, POINT_L, { chest: [14, -20, 0], rootPos: [0, -0.7, 0.3] }), 'in'],
    [0.42, mix(STAFF_SLAM, POINT_L, { chest: [12, -18, 0], rootPos: [0, -0.5, 0.3] })],
    [0.6, 'rest'],
  ], { hits: [0.3] }),

  // Command: a quick pointing gesture (works while walking)
  sm_command: make('sm_command', 0.35, [
    [0, 'rest'],
    [0.1, POINT_L, 'out'],
    [0.2, nudge(POINT_L, { armL: [4, 0, 0] })],
    [0.35, 'rest'],
  ], { hits: [0.1], fadeIn: 0.03 }),

  ...reactions(make, 'sm', H),

  // victory: lifted on the spirits, staff high and the free arm open
  sm_victory: make('sm_victory', 1.6, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
    [0.5, mix(STAFF_HIGH, WIDE, { legL: [-4, 0, 4], legR: [4, 0, -4], shinL: [16, 0, 0], shinR: [10, 0, 0], footL: [24, 0, 0], footR: [24, 0, 0], chest: [-10, 0, 0], head: [-16, 6, 0], rootPos: [0, 1.0, 0] }), 'back'],
    [1.05, mix(STAFF_HIGH, nudge(WIDE, { armL: [-6, 0, 6] }), { chest: [-12, 0, 2], head: [-18, 8, 0], rootPos: [0, 1.4, 0] })],
    [1.6, mix(STAFF_HIGH, WIDE, { chest: [-10, 0, 0], head: [-16, 6, 0], rootPos: [0, 1.0, 0] })],
  ], { full: true, loopFrom: 0.5, hits: [0.5] }),
};
