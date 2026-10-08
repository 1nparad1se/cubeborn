import type { Clip } from '../clips';
import { rangerRig } from '../../../models/classRigs/ranger';
import { clipMaker, crouch, LEGS0, mix, nudge, pivot, reactions, type Pose } from './rangedKit';

const ST = rangerRig().anim.stance;
const make = clipMaker(ST);
/** Pelvis height above the root (voxels): pivot for flips and rolls. */
const H = 9.2;

// bow poses (absolute): reach for the string, full draw at the cheek, release
const NOCK: Pose = { chest: [4, -40, 0], spine: [0, -8, 0], head: [0, 38, 0], armL: [0, -30, 74], foreL: [0, 0, 0], handL: [0, 90, 0], armR: [-34, 0, -52], foreR: [-104, 0, 0], handR: [0, 0, 0] };
const DRAW: Pose = { chest: [0, -56, 0], spine: [0, -12, 0], head: [2, 52, -4], armL: [0, -35, 90], foreL: [0, 0, 0], handL: [0, 90, 0], armR: [-10, 0, -88], foreR: [-136, 0, 0], handR: [0, 0, 0] };
const RELEASE: Pose = { chest: [0, -50, 0], spine: [0, -10, 0], head: [2, 48, -4], armL: [6, -35, 86], foreL: [2, 0, 0], handL: [0, 90, 0], armR: [6, 0, -116], foreR: [-79, 0, 0], handR: [0, 0, 0] };
/** Aimed at the sky: the whole draw leans back from the waist. */
const up = (p: Pose, k = 1): Pose => nudge(p, { spine: [-14 * k, 0, 0], chest: [-30 * k, 0, 0], head: [-18 * k, 0, 0] });
const arrow = (on: number, off: number) => [{ t: on, grp: 'arrow', on: true }, { t: off, grp: 'arrow', on: false }];

export const RANGER_CLIPS: Record<string, Clip> = {
  // quick snap shot (upper body only: works while walking or back-pedalling)
  rg_basic: make('rg_basic', 0.38, [
    [0, 'rest'],
    [0.07, mix(DRAW, { chest: [0, -52, 0] }), 'out'],
    [0.14, RELEASE, 'out'],
    [0.22, nudge(RELEASE, { armR: [4, 0, -6] })],
    [0.38, 'rest'],
  ], { hits: [0.14], show: arrow(0.0, 0.14), fadeIn: 0.04 }),

  // tumble roll along the dash
  rg_dodge: make('rg_dodge', 0.45, [
    [0, { ...pivot(0, H), ...LEGS0, chest: [0, 0, 0], head: [0, 0, 0], armL: [-12, 0, 7], armR: [-6, 0, -4] }],
    [0.06, { ...pivot(30, H, -2.2, 0.8), ...crouch(0.8), chest: [30, 0, 0], head: [20, 0, 0], armL: [-60, 0, 20], armR: [-60, 0, -20] }],
    [0.16, { ...pivot(150, H, -4.2, 1.6), ...crouch(1.2), chest: [40, 0, 0], head: [30, 0, 0] }],
    [0.26, { ...pivot(290, H, -3.6, 2.2), ...crouch(1.0) }],
    [0.32, { ...pivot(350, H, -1.8, 2.4), ...crouch(0.6), chest: [12, 0, 0], head: [6, 0, 0], armL: [-30, 0, 20], armR: [-20, 0, -20] }],
    [0.321, { ...pivot(-10, H, -1.8, 2.4) }],
    [0.45, { ...pivot(0, H), ...LEGS0, chest: [5, -6, 0], head: [-3, 6, 0], armL: [-12, 0, 7], armR: [-6, 0, -4] }],
  ], { full: true, fadeIn: 0.03, fadeOut: 0.1 }),

  // Piercing Arrow: held full draw, trembling, then a powerful release
  rg_q_charge: make('rg_q_charge', 0.6, [
    [0, 'rest'],
    [0.16, NOCK],
    [0.3, nudge(DRAW, { armR: [0, 0, -4], foreR: [-6, 0, 0], chest: [-2, -4, 0] })],
    [0.38, nudge(DRAW, { armR: [1, 0, -5], foreR: [-7, 0, 0], chest: [-2, -4, 0], armL: [0.8, 0, 0] })],
    [0.46, nudge(DRAW, { armR: [-1, 0, -4], foreR: [-5, 0, 0], chest: [-2, -4, 0], armL: [-0.8, 0, 0] })],
    [0.54, nudge(DRAW, { armR: [1, 0, -5], foreR: [-7, 0, 0], chest: [-2, -4, 0], armL: [0.6, 0, 0] })],
    [0.6, nudge(DRAW, { armR: [0, 0, -4], foreR: [-6, 0, 0], chest: [-2, -4, 0] })],
  ], { loopFrom: 0.3, show: arrow(0.02, 99) }),
  rg_q: make('rg_q', 0.45, [
    [0, nudge(DRAW, { armR: [0, 0, -4], foreR: [-6, 0, 0], chest: [-2, -4, 0] })],
    [0.12, mix(nudge(RELEASE, { armR: [10, 0, -10], chest: [-4, 6, 0] }), { rootPos: [0, 0, -0.7] }), 'out'],
    [0.26, mix(RELEASE, { rootPos: [0, 0, -0.4] })],
    [0.45, 'rest'],
  ], { hits: [0.12], show: arrow(0, 0.12), fadeIn: 0.02 }),

  // Recoil Shot: back flip, firing at the top of the arc
  rg_w: make('rg_w', 0.55, [
    [0, { ...pivot(0, H), ...LEGS0, ...ST }],
    [0.04, { ...pivot(0, H, -1.2, 0), ...crouch(0.55), ...NOCK }],
    [0.12, { ...pivot(-30, H, 2.0, -0.5), legL: [-20, 0, 4], legR: [-10, 0, -4], shinL: [40, 0, 0], shinR: [30, 0, 0], footL: [20, 0, 0], footR: [20, 0, 0], ...DRAW }, 'out'],
    [0.18, { ...pivot(-75, H, 3.4, -1.1), ...crouch(0.9), ...RELEASE }, 'lin'],
    [0.28, { ...pivot(-230, H, 2.8, -1.8), ...crouch(1.1), chest: [30, -20, 0], head: [20, 20, 0], armL: [-40, 0, 40], armR: [-40, 0, -40], foreR: [-60, 0, 0] }, 'lin'],
    [0.34, { ...pivot(-340, H, -0.4, -2.0), ...crouch(0.7), chest: [20, -6, 0], armL: [-30, 0, 30], armR: [-20, 0, -40] }, 'out'],
    [0.341, { ...pivot(20, H, -0.4, -2.0) }],
    [0.42, { ...pivot(6, H, -1.4, -2.0), ...crouch(0.6), chest: [16, -6, 0], head: [0, 6, 0] }],
    [0.55, { ...pivot(0, H), ...LEGS0, ...ST }],
  ], { full: true, hits: [0.18], show: arrow(0.03, 0.18), fadeIn: 0.03, fadeOut: 0.1 }),

  // Arrow Rain: a high arc shot into the sky
  rg_e: make('rg_e', 0.55, [
    [0, 'rest'],
    [0.1, up(NOCK, 0.6)],
    [0.2, up(DRAW, 1.1)],
    [0.25, up(RELEASE, 1.15), 'out'],
    [0.36, up(RELEASE, 1.0)],
    [0.55, 'rest'],
  ], { hits: [0.25], show: arrow(0.02, 0.25) }),

  // Blast Arrow: deep stance, heavy draw, recoil
  rg_r: make('rg_r', 0.5, [
    [0, 'rest'],
    [0.08, mix(NOCK, { rootPos: [0, -0.4, 0] })],
    [0.17, mix(nudge(DRAW, { chest: [4, -6, 0], foreR: [-6, 0, 0] }), { rootPos: [0, -0.7, 0] })],
    [0.2, mix(nudge(RELEASE, { chest: [-8, 10, 0], armL: [-14, 0, 0] }), { rootPos: [0, -0.5, -1.0] }), 'out'],
    [0.32, mix(RELEASE, { rootPos: [0, -0.3, -0.7] })],
    [0.5, { ...ST, rootPos: [0, 0, 0] }],
  ], { hits: [0.2], show: arrow(0.03, 0.2) }),

  // Bear Trap: drop to a knee and set the trap with the free hand
  rg_a: make('rg_a', 0.45, [
    [0, { ...ST, ...LEGS0, rootPos: [0, 0, 0] }],
    [0.12, { legL: [-56, 0, 6], shinL: [62, 0, 0], footL: [-6, 0, 0], legR: [18, 0, -4], shinR: [96, 0, 0], footR: [-24, 0, 0], rootPos: [0, -2.4, 0], chest: [30, 10, 0], spine: [10, 0, 0], head: [10, -6, 0], armR: [-56, 0, -14], foreR: [-30, 0, 0], handR: [20, 0, 0] }],
    [0.2, { rootPos: [0, -2.7, 0], chest: [36, 12, 0], armR: [-36, 0, -10], foreR: [-14, 0, 0], handR: [40, 0, 0] }, 'out'],
    [0.3, { rootPos: [0, -2.5, 0], chest: [30, 8, 0], armR: [-44, 0, -16], foreR: [-30, 0, 0] }],
    [0.45, { ...ST, ...LEGS0, spine: [0, 0, 0], rootPos: [0, 0, 0] }],
  ], { full: true, hits: [0.2] }),

  // Arrow Fan: bow canted flat, the shot sweeps across
  rg_s: make('rg_s', 0.45, [
    [0, 'rest'],
    [0.09, nudge(DRAW, { chest: [0, -18, 0], handL: [0, 0, -60], armL: [0, 0, -14] })],
    [0.16, nudge(RELEASE, { chest: [0, 18, 0], handL: [0, 0, -60], armL: [0, 0, -14] }), 'out'],
    [0.24, nudge(RELEASE, { chest: [0, 26, 0], handL: [0, 0, -60], armL: [0, 0, -14] })],
    [0.45, 'rest'],
  ], { hits: [0.16], show: arrow(0.01, 0.16) }),

  // Barrage: rapid repeated shots while walking
  rg_d_in: make('rg_d_in', 0.12, [[0, 'rest'], [0.12, DRAW]], { show: arrow(0.02, 99) }),
  rg_d_loop: make('rg_d_loop', 0.13, [
    [0, DRAW],
    [0.05, nudge(RELEASE, { foreR: [20, 0, 0] }), 'out'],
    [0.09, NOCK],
    [0.13, DRAW],
  ], { hits: [0.05], show: [{ t: 0, grp: 'arrow', on: true }, { t: 0.05, grp: 'arrow', on: false }, { t: 0.09, grp: 'arrow', on: true }], fadeIn: 0.02, fadeOut: 0.05 }),
  rg_d_out: make('rg_d_out', 0.3, [[0, RELEASE], [0.3, 'rest']], { fadeIn: 0.03 }),

  // Hunter's Mark: a precise marked shot with a flourish
  rg_f: make('rg_f', 0.45, [
    [0, 'rest'],
    [0.1, nudge(DRAW, { head: [4, 4, 0], foreR: [-4, 0, 0] })],
    [0.16, RELEASE, 'out'],
    [0.28, nudge(RELEASE, { armR: [-30, 0, 20], foreR: [-30, 0, 0] })],
    [0.45, 'rest'],
  ], { hits: [0.16], show: arrow(0.02, 0.16) }),

  // Sky Volley: leap high and rain a volley down, land in a crouch
  rg_ult: make('rg_ult', 1.8, [
    [0, { ...ST, ...LEGS0, rootPos: [0, 0, 0] }],
    [0.2, { ...crouch(0.8), rootPos: [0, -1.8, 0], chest: [24, 0, 0], head: [10, 0, 0], armL: [20, 0, 20], armR: [20, 0, -20], foreL: [-20, 0, 0], foreR: [-20, 0, 0] }],
    [0.42, { ...up(DRAW, 1.0), legL: [-30, 0, 8], legR: [-60, 0, -6], shinL: [70, 0, 0], shinR: [100, 0, 0], footL: [10, 0, 0], footR: [10, 0, 0], rootPos: [0, 7, 0] }, 'out'],
    [0.5, { ...up(RELEASE, 1.0), rootPos: [0, 7.6, 0] }, 'out'],
    [0.66, { ...up(DRAW, 0.8), rootPos: [0, 7.4, 0] }],
    [0.74, { ...up(RELEASE, 0.8), rootPos: [0, 6.6, 0] }, 'out'],
    [0.9, { ...up(DRAW, 0.6), rootPos: [0, 5, 0] }],
    [0.98, { ...up(RELEASE, 0.6), legL: [-20, 0, 6], legR: [-30, 0, -6], shinL: [30, 0, 0], shinR: [40, 0, 0], rootPos: [0, 3, 0] }, 'out'],
    [1.2, { ...crouch(0.9), rootPos: [0, -2.0, 0], ...RELEASE, chest: [20, -40, 0], head: [0, 40, 0] }, 'in'],
    [1.45, { ...crouch(0.6), rootPos: [0, -1.3, 0], ...NOCK, chest: [12, -30, 0] }],
    [1.8, { ...ST, ...LEGS0, spine: [0, 0, 0], rootPos: [0, 0, 0] }],
  ], {
    full: true,
    hits: [0.5],
    events: [{ t: 0.3, ev: 'ability' }, { t: 0.74, ev: 'impulse' }, { t: 0.98, ev: 'impulse' }],
    show: [{ t: 0.3, grp: 'arrow', on: true }, { t: 0.5, grp: 'arrow', on: false }, { t: 0.58, grp: 'arrow', on: true }, { t: 0.74, grp: 'arrow', on: false }, { t: 0.82, grp: 'arrow', on: true }, { t: 0.98, grp: 'arrow', on: false }],
  }),

  // Hawk: a whistle with the free hand raised, the bow arm offered as a perch
  rg_identity: make('rg_identity', 0.5, [
    [0, 'rest'],
    [0.12, { armR: [-120, 0, -30], foreR: [-80, 0, 0], handR: [0, 0, 0], head: [-14, 10, 0], chest: [-4, 6, 0] }],
    [0.2, { armR: [-160, 0, -14], foreR: [-10, 0, 0], head: [-24, 0, 0], chest: [-8, 0, 0], armL: [-60, 0, 50], foreL: [-30, 0, 0] }, 'out'],
    [0.34, { armR: [-150, 0, -16], foreR: [-14, 0, 0], head: [-20, -6, 0], chest: [-6, 0, 0], armL: [-58, 0, 50], foreL: [-30, 0, 0] }],
    [0.5, 'rest'],
  ], { hits: [0.2] }),

  ...reactions(make, 'rg', H),

  // victory: bow raised high, a hand on the heart
  rg_victory: make('rg_victory', 1.6, [
    [0, 'rest'],
    [0.45, { chest: [-8, 0, 0], head: [-14, -10, 0], armL: [-10, 0, 150], foreL: [-10, 0, 0], handL: [0, 90, 0], armR: [-20, 0, 30], foreR: [-120, 0, 0], handR: [0, 0, 0], rootPos: [0, 0.3, 0] }, 'back'],
    [1.0, { chest: [-10, 0, 0], head: [-16, -12, 0], armL: [-10, 0, 154], rootPos: [0, 0.45, 0] }],
    [1.6, { chest: [-8, 0, 0], head: [-14, -10, 0], armL: [-10, 0, 150], rootPos: [0, 0.3, 0] }],
  ], { loopFrom: 0.45, hits: [0.45] }),
};
