import type { Clip } from '../clips';
import { sorceressRig } from '../../../models/classRigs/sorceress';
import { clipMaker, crouch, LEGS0, mix, nudge, reactions, type Pose } from './rangedKit';

const ST = sorceressRig().anim.stance;
const make = clipMaker(ST);
const H = 9.2;

// The focus orb floats over the left palm; the wand runs along the right hand's z axis.
const FOCUS_PUSH: Pose = { armL: [-88, -4, 6], foreL: [-6, 0, 0], handL: [-10, 0, 0], chest: [2, -22, 0], head: [0, 16, 0] };
const FOCUS_BACK: Pose = { armL: [-20, 20, 30], foreL: [-80, 0, 0], handL: [0, 0, 0], chest: [-6, 22, 0], head: [-4, -14, 0] };
const WAND_POINT: Pose = { armR: [-88, 0, -4], foreR: [0, 0, 0], handR: [70, -10, 0], chest: [2, 22, 0], head: [0, -16, 0] };
const WAND_BACK: Pose = { armR: [-150, 0, -34], foreR: [-50, 0, 0], handR: [40, 0, 0], chest: [-8, -24, 0], head: [-4, 14, 0] };
const ARMS_UP: Pose = { armL: [-160, 0, 22], foreL: [-10, 0, 0], handL: [-20, 0, 0], armR: [-160, 0, -22], foreR: [-10, 0, 0], handR: [0, 0, 0], chest: [-12, 0, 0], head: [-24, 0, 0] };
const BOTH_FWD: Pose = { armL: [-86, 0, -8], foreL: [-4, 0, 0], handL: [-60, 0, 0], armR: [-86, 0, 8], foreR: [-4, 0, 0], handR: [40, 0, 0], chest: [8, 0, 0], head: [2, 0, 0] };
const HIP_GATHER: Pose = { armL: [-40, 0, -34], foreL: [-84, 0, 0], handL: [10, 0, 0], armR: [-10, 0, -6], foreR: [-76, 0, 0], handR: [20, 0, 0], chest: [-4, -32, 0], spine: [0, -8, 0], head: [-2, 26, 0] };
const SPREAD: Pose = { armL: [-40, 0, 80], foreL: [-6, 0, 0], handL: [-40, 0, 0], armR: [-40, 0, -80], foreR: [-6, 0, 0], handR: [0, 0, 0] };
const tremble = (p: Pose, s: number): Pose => nudge(p, { armL: [1.5 * s, 0, 1 * s], armR: [-1.5 * s, 0, -1 * s], chest: [0.6 * s, 0, 0] });

export const SORCERESS_CLIPS: Record<string, Clip> = {
  // arcane bolt flung from the focus hand (upper body only)
  so_basic: make('so_basic', 0.4, [
    [0, 'rest'],
    [0.1, FOCUS_BACK],
    [0.16, FOCUS_PUSH, 'out'],
    [0.26, nudge(FOCUS_PUSH, { armL: [6, 0, 0], chest: [0, 4, 0] })],
    [0.4, 'rest'],
  ], { hits: [0.16], fadeIn: 0.04 }),

  // blink dodge: fold into a flash, reappear poised
  so_dodge: make('so_dodge', 0.3, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
    [0.03, mix(crouch(0.5), { armL: [-60, 0, -30], foreL: [-90, 0, 0], armR: [-60, 0, 30], foreR: [-90, 0, 0], chest: [24, 0, 0], head: [16, 0, 0], rootPos: [0, -1.2, 0] }), 'out'],
    [0.12, mix(LEGS0, SPREAD, { chest: [-10, 0, 0], head: [-8, 0, 0], rootPos: [0, 0.4, 0] }), 'out'],
    [0.3, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
  ], { full: true, fadeIn: 0.02, fadeOut: 0.08 }),

  // Fireball: overhand throw from the wand hand
  so_q: make('so_q', 0.42, [
    [0, 'rest'],
    [0.11, mix(WAND_BACK, { rootPos: [0, 0.2, -0.3] })],
    [0.18, mix(WAND_POINT, { chest: [10, 28, 0], rootPos: [0, -0.3, 0.5] }), 'out'],
    [0.28, mix(nudge(WAND_POINT, { armR: [10, 0, 0] }), { chest: [8, 26, 0], rootPos: [0, -0.2, 0.4] })],
    [0.42, 'rest'],
  ], { hits: [0.18] }),

  // Blink: burst at the start point, vanish, flash in
  so_w: make('so_w', 0.3, [
    [0, mix(SPREAD, { chest: [-8, 0, 0], rootPos: [0, 0.2, 0] })],
    [0.05, mix(crouch(0.5), { armL: [-60, 0, -30], foreL: [-90, 0, 0], armR: [-60, 0, 30], foreR: [-90, 0, 0], chest: [24, 0, 0], head: [16, 0, 0], rootPos: [0, -1.2, 0] }), 'out'],
    [0.14, mix(LEGS0, SPREAD, { chest: [-10, 0, 0], head: [-8, 0, 0], rootPos: [0, 0.3, 0] }), 'out'],
    [0.3, { ...LEGS0, rootPos: [0, 0, 0], ...ST, spine: [0, 0, 0] }],
  ], { full: true, hits: [0], fadeIn: 0.02, fadeOut: 0.08 }),

  // Frost Lance: both hands draw back to the side, then hurl forward
  so_e: make('so_e', 0.5, [
    [0, 'rest'],
    [0.14, mix(HIP_GATHER, { rootPos: [0, -0.2, -0.3] })],
    [0.22, mix(BOTH_FWD, { chest: [10, 10, 0], spine: [4, 4, 0], rootPos: [0, -0.4, 0.6] }), 'out'],
    [0.34, mix(BOTH_FWD, { chest: [8, 8, 0], spine: [3, 3, 0], rootPos: [0, -0.3, 0.4] })],
    [0.5, 'rest'],
  ], { hits: [0.22] }),

  // Meteor: channel with both arms to the sky, then drag it down
  so_r_cast: make('so_r_cast', 0.9, [
    [0, 'rest'],
    [0.3, mix(ARMS_UP, { rootPos: [0, 0.5, 0] }), 'back'],
    [0.6, mix(tremble(ARMS_UP, 1), { rootPos: [0, 0.6, 0] })],
    [0.9, mix(ARMS_UP, { rootPos: [0, 0.5, 0] })],
  ], { loopFrom: 0.3, events: [{ t: 0.05, ev: 'charge' }] }),
  so_r: make('so_r', 0.6, [
    [0, mix(ARMS_UP, { rootPos: [0, 0.5, 0] })],
    [0.1, mix(BOTH_FWD, { chest: [24, 0, 0], spine: [8, 0, 0], head: [8, 0, 0], handL: [-80, 0, 0], rootPos: [0, -0.8, 0.4] }), 'in'],
    [0.26, mix(BOTH_FWD, { chest: [20, 0, 0], spine: [6, 0, 0], rootPos: [0, -0.6, 0.3] })],
    [0.6, 'rest'],
  ], { hits: [0.1], fadeIn: 0.03 }),

  // Chain Lightning: a snapping wand point
  so_a: make('so_a', 0.4, [
    [0, 'rest'],
    [0.1, mix(nudge(WAND_POINT, { armR: [30, 0, -30], foreR: [-50, 0, 0] }), { chest: [-4, -10, 0] })],
    [0.16, WAND_POINT, 'out'],
    [0.26, nudge(WAND_POINT, { armR: [6, 0, 0], handR: [-10, 0, 0] })],
    [0.4, 'rest'],
  ], { hits: [0.16] }),

  // Frost Nova: arms crossed, then thrown down and out in a crouch
  so_s: make('so_s', 0.45, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
    [0.12, { armL: [-70, 0, -40], foreL: [-90, 0, 0], armR: [-70, 0, 40], foreR: [-90, 0, 0], chest: [-6, 0, 0], head: [-4, 0, 0], rootPos: [0, 0.3, 0] }],
    [0.2, mix(crouch(0.55), { armL: [-20, 0, 60], foreL: [-4, 0, 0], handL: [-60, 0, 0], armR: [-20, 0, -60], foreR: [-4, 0, 0], handR: [20, 0, 0], chest: [22, 0, 0], head: [14, 0, 0], rootPos: [0, -1.3, 0] }), 'out'],
    [0.3, mix(crouch(0.5), { chest: [20, 0, 0], rootPos: [0, -1.2, 0] })],
    [0.45, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
  ], { full: true, hits: [0.2] }),

  // Thunderstorm: focus raised to the clouds, then released
  so_d_cast: make('so_d_cast', 0.8, [
    [0, 'rest'],
    [0.25, { armL: [-165, -10, 10], foreL: [-6, 0, 0], handL: [-10, 0, 0], armR: [-50, 0, -40], foreR: [-20, 0, 0], chest: [-14, 0, 0], head: [-26, 0, 0], rootPos: [0, 0.4, 0] }, 'back'],
    [0.52, { armL: [-168, -10, 12], armR: [-54, 0, -44], chest: [-15, 0, 1], rootPos: [0, 0.5, 0] }],
    [0.8, { armL: [-165, -10, 10], armR: [-50, 0, -40], chest: [-14, 0, 0], rootPos: [0, 0.4, 0] }],
  ], { loopFrom: 0.25, events: [{ t: 0.05, ev: 'charge' }] }),
  so_d: make('so_d', 0.45, [
    [0, { armL: [-165, -10, 10], foreL: [-6, 0, 0], handL: [-10, 0, 0], armR: [-50, 0, -40], foreR: [-20, 0, 0], chest: [-14, 0, 0], head: [-26, 0, 0], rootPos: [0, 0.4, 0] }],
    [0.1, { armL: [-120, -10, 40], foreL: [0, 0, 0], armR: [-80, 0, -60], chest: [-6, 0, 0], head: [-14, 0, 0], rootPos: [0, 0.6, 0] }, 'out'],
    [0.22, { armL: [-116, -10, 44], armR: [-76, 0, -62], chest: [-5, 0, 0], rootPos: [0, 0.5, 0] }],
    [0.45, 'rest'],
  ], { hits: [0.1], fadeIn: 0.03 }),

  // Arcane Burst: energy gathered at the hip, trembling, then a two-handed blast
  so_f_charge: make('so_f_charge', 0.6, [
    [0, 'rest'],
    [0.2, mix(HIP_GATHER, { rootPos: [0, -0.3, -0.2] })],
    [0.3, mix(tremble(HIP_GATHER, 1), { rootPos: [0, -0.35, -0.2] })],
    [0.4, mix(tremble(HIP_GATHER, -1), { rootPos: [0, -0.3, -0.2] })],
    [0.5, mix(tremble(HIP_GATHER, 1), { rootPos: [0, -0.35, -0.2] })],
    [0.6, mix(HIP_GATHER, { rootPos: [0, -0.3, -0.2] })],
  ], { loopFrom: 0.2, events: [{ t: 0.05, ev: 'charge' }] }),
  so_f: make('so_f', 0.5, [
    [0, mix(HIP_GATHER, { rootPos: [0, -0.3, -0.2] })],
    [0.12, mix(BOTH_FWD, { chest: [12, 8, 0], spine: [4, 6, 0], head: [4, 0, 0], handL: [-80, 0, 0], rootPos: [0, -0.5, 0.7] }), 'out'],
    [0.26, mix(BOTH_FWD, { chest: [8, 6, 0], spine: [3, 4, 0], rootPos: [0, -0.4, 0.4] })],
    [0.5, 'rest'],
  ], { hits: [0.12], fadeIn: 0.02 }),

  // Starfall: levitating channel with arms spread to the sky, then a sweeping release
  so_ult_cast: make('so_ult_cast', 1.0, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST, spine: [0, 0, 0] }],
    [0.4, mix(SPREAD, { armL: [-120, 0, 60], armR: [-120, 0, -60], legL: [-6, 0, 4], legR: [4, 0, -4], shinL: [20, 0, 0], shinR: [12, 0, 0], footL: [30, 0, 0], footR: [30, 0, 0], chest: [-16, 0, 0], spine: [-6, 0, 0], head: [-28, 0, 0], rootPos: [0, 2.2, 0] }), 'back'],
    [0.7, { armL: [-124, 0, 62], armR: [-124, 0, -62], chest: [-17, 0, 1], rootPos: [0, 2.6, 0] }],
    [1.0, { armL: [-120, 0, 60], armR: [-120, 0, -60], chest: [-16, 0, 0], rootPos: [0, 2.2, 0] }],
  ], { full: true, loopFrom: 0.4, events: [{ t: 0.05, ev: 'charge' }] }),
  so_ult: make('so_ult', 1.6, [
    [0, mix(SPREAD, { armL: [-120, 0, 60], armR: [-120, 0, -60], legL: [-6, 0, 4], legR: [4, 0, -4], shinL: [20, 0, 0], shinR: [12, 0, 0], footL: [30, 0, 0], footR: [30, 0, 0], chest: [-16, 0, 0], spine: [-6, 0, 0], head: [-28, 0, 0], rootPos: [0, 2.2, 0] })],
    [0.1, mix(BOTH_FWD, { handL: [-80, 0, 0], chest: [22, 0, 0], spine: [8, 0, 0], head: [6, 0, 0], rootPos: [0, 1.6, 0.6] }), 'out'],
    [0.6, mix(SPREAD, { chest: [-6, 0, 0], spine: [0, 0, 0], head: [-8, 0, 0], rootPos: [0, 1.4, 0.3] })],
    [1.1, mix(SPREAD, { chest: [-4, 0, 0], head: [-6, 0, 0], rootPos: [0, 0.6, 0] })],
    [1.6, { ...LEGS0, rootPos: [0, 0, 0], ...ST, spine: [0, 0, 0] }],
  ], { full: true, hits: [0.1], fadeIn: 0.03 }),

  // Rupture: power erupts, arms thrown open
  so_identity: make('so_identity', 0.45, [
    [0, 'rest'],
    [0.08, { armL: [-60, 0, -30], foreL: [-100, 0, 0], armR: [-60, 0, 30], foreR: [-100, 0, 0], chest: [16, 0, 0], head: [12, 0, 0], rootPos: [0, -0.5, 0] }],
    [0.15, mix(SPREAD, { armL: [-60, 0, 90], armR: [-60, 0, -90], chest: [-18, 0, 0], head: [-18, 0, 0], rootPos: [0, 0.5, 0] }), 'back'],
    [0.3, mix(SPREAD, { chest: [-12, 0, 0], head: [-12, 0, 0], rootPos: [0, 0.3, 0] })],
    [0.45, 'rest'],
  ], { hits: [0.15] }),

  ...reactions(make, 'so', H),

  // victory: hovering, the focus held high, the wand arm sweeping out
  so_victory: make('so_victory', 1.6, [
    [0, { ...LEGS0, rootPos: [0, 0, 0], ...ST }],
    [0.5, { armL: [-160, -10, 16], foreL: [-10, 0, 0], handL: [-10, 0, 0], armR: [-30, 0, -60], foreR: [-10, 0, 0], handR: [20, 0, 0], legL: [-6, 0, 4], legR: [6, 0, -4], shinL: [24, 0, 0], shinR: [10, 0, 0], footL: [30, 0, 0], footR: [24, 0, 0], chest: [-10, 6, 0], head: [-20, -8, 0], rootPos: [0, 1.4, 0] }, 'back'],
    [1.05, { armL: [-164, -10, 18], armR: [-32, 0, -64], chest: [-12, 6, 2], head: [-22, -8, 0], rootPos: [0, 1.8, 0] }],
    [1.6, { armL: [-160, -10, 16], armR: [-30, 0, -60], chest: [-10, 6, 0], head: [-20, -8, 0], rootPos: [0, 1.4, 0] }],
  ], { full: true, loopFrom: 0.5, hits: [0.5] }),
};
