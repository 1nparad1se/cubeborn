import type { AnimStyle, PoseMap, WeaponStyle } from './animTypes';

export type Ease = 'lin' | 'in' | 'out' | 'io' | 'back';

export interface Key {
  /** Seconds from the clip start. */
  t: number;
  p: PoseMap;
  /** Easing used to arrive at this key. */
  e?: Ease;
}

/**
 * A keyframed action. Values are degrees (and voxels for rootPos). Relative clips add to the
 * hero's stance (so one sword swing works whatever the idle grip); absolute clips replace it.
 * Only keyed bones are touched, so legs keep walking under an upper-body attack.
 */
export interface Clip {
  name: string;
  dur: number;
  keys: Key[];
  abs?: boolean;
  /** Holds the last pose instead of fading out (death). */
  hold?: boolean;
  /** Loops from this time to the end once the intro has played (victory). */
  loopFrom?: number;
  fadeIn?: number;
  fadeOut?: number;
  /** Named moments for effects: 'impulse' (weapon release), 'charge', 'death', 'levelup', 'ability'. */
  events?: { t: number; ev: string }[];
  /** Visibility group toggles (arrow nocked, flask thrown...). */
  show?: { t: number; grp: string; on: boolean }[];
}

// ---------------------------------------------------------------- attacks (relative to stance)

const sword: Clip = {
  name: 'attack',
  dur: 0.62,
  keys: [
    { t: 0, p: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], rootPos: [0, 0, 0] } },
    // anticipation: twist away, blade drawn back high
    { t: 0.15, p: { chest: [-4, -38, 0], spine: [0, -12, 0], head: [0, 26, 0], armR: [-58, 0, -52], foreR: [-48, 0, 0], handR: [-30, -20, 0], armL: [-10, 0, 0], rootPos: [0, 0.2, -0.3] } },
    // strike: fast arc across the body with a lunge
    { t: 0.25, e: 'out', p: { chest: [6, 42, 0], spine: [2, 14, 0], head: [0, -30, 0], armR: [-72, 0, 30], foreR: [22, 0, 0], handR: [-10, 25, 0], armL: [4, 0, 0], rootPos: [0, -0.5, 1.3] } },
    // follow-through: the blade keeps travelling and the body overshoots
    { t: 0.36, p: { chest: [8, 56, 6], spine: [3, 18, 0], head: [0, -38, 0], armR: [-55, 0, 50], foreR: [10, 0, 0], handR: [0, 35, 0], armL: [6, 0, 0], rootPos: [0, -0.6, 1.0] } },
    { t: 0.62, p: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], rootPos: [0, 0, 0] } },
  ],
  events: [{ t: 0.23, ev: 'impulse' }],
};

const hammer: Clip = {
  name: 'attack',
  dur: 0.78,
  keys: [
    { t: 0, p: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], rootPos: [0, 0, 0] } },
    { t: 0.22, p: { chest: [-14, -10, 0], spine: [-6, 0, 0], head: [10, 0, 0], armR: [-150, 0, 4], foreR: [-22, 0, 0], handR: [-10, 0, 0], armL: [-34, 0, 8], rootPos: [0, 0.35, -0.4] } },
    { t: 0.33, e: 'out', p: { chest: [24, 6, 0], spine: [10, 0, 0], head: [-14, 0, 0], armR: [-60, 0, 0], foreR: [32, 0, 0], handR: [20, 0, 0], armL: [-10, 0, 14], rootPos: [0, -1.3, 0.9] } },
    { t: 0.44, p: { chest: [28, 6, 0], spine: [12, 0, 0], head: [-16, 0, 0], armR: [-52, 0, 0], foreR: [30, 0, 0], handR: [24, 0, 0], armL: [-8, 0, 16], rootPos: [0, -1.4, 0.9] } },
    { t: 0.78, p: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], rootPos: [0, 0, 0] } },
  ],
  events: [{ t: 0.33, ev: 'impulse' }],
};

const ZB = { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], foreL: [0, 0, 0], handL: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0] } as PoseMap;

const bow: Clip = {
  name: 'attack',
  dur: 0.78,
  keys: [
    { t: 0, p: ZB },
    // raise the bow and reach for the string
    { t: 0.12, p: { chest: [0, -40, 0], spine: [0, -8, 0], head: [0, 38, 0], armL: [6, -30, 70], foreL: [16, 0, 0], handL: [90, 90, 0], armR: [-30, 0, -50], foreR: [-80, 0, 0], handR: [0, 0, 0] } },
    // full draw, string at the cheek
    { t: 0.28, p: { chest: [-4, -56, 0], spine: [0, -12, 0], head: [2, 52, -4], armL: [6, -35, 86], foreL: [16, 0, 0], handL: [90, 90, 0], armR: [-6, 0, -88], foreR: [-112, 0, 0], handR: [0, 0, 0] } },
    // aim: a short, steady hold
    { t: 0.37, p: { chest: [-4, -57, 0], spine: [0, -12, 0], head: [2, 53, -4], armL: [6, -35, 86], foreL: [16, 0, 0], handL: [90, 90, 0], armR: [-6, 0, -91], foreR: [-117, 0, 0], handR: [0, 0, 0] } },
    // release: the drawing hand flies back, the bow kicks
    { t: 0.42, e: 'out', p: { chest: [-4, -50, 0], spine: [0, -10, 0], head: [2, 48, -4], armL: [12, -35, 82], foreL: [18, 0, 0], handL: [90, 90, 0], armR: [10, 0, -112], foreR: [-55, 0, 0], handR: [0, 0, 0] } },
    { t: 0.54, p: { chest: [-2, -46, 0], spine: [0, -9, 0], head: [2, 44, -4], armL: [8, -34, 80], foreL: [16, 0, 0], handL: [90, 90, 0], armR: [6, 0, -100], foreR: [-62, 0, 0], handR: [0, 0, 0] } },
    { t: 0.78, p: ZB },
  ],
  events: [{ t: 0.42, ev: 'impulse' }],
  show: [
    { t: 0.06, grp: 'arrow', on: true },
    { t: 0.42, grp: 'arrow', on: false },
  ],
};

const staff: Clip = {
  name: 'attack',
  dur: 0.72,
  keys: [
    { t: 0, p: { ...ZB, rootPos: [0, 0, 0] } },
    // gather: staff pulled back, the free hand draws energy in
    { t: 0.18, p: { chest: [-10, -15, 0], spine: [-4, 0, 0], head: [-8, 10, 0], armR: [20, 0, -10], foreR: [-20, 0, 0], handR: [-10, 0, 0], armL: [-50, 10, 10], foreL: [-20, 0, 0], handL: [-40, 0, 0], rootPos: [0, 0.2, -0.4] } },
    // cast: thrust the staff forward, the free hand sweeps aside
    { t: 0.3, e: 'out', p: { chest: [14, 20, 0], spine: [6, 0, 0], head: [6, -15, 0], armR: [-85, 0, 0], foreR: [30, 0, 0], handR: [-20, 0, 0], armL: [-40, 0, 32], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.5, 1.0] } },
    { t: 0.43, p: { chest: [18, 22, 0], spine: [7, 0, 0], head: [6, -16, 0], armR: [-95, 0, 0], foreR: [24, 0, 0], handR: [-30, 0, 0], armL: [-34, 0, 36], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.5, 0.8] } },
    { t: 0.72, p: { ...ZB, rootPos: [0, 0, 0] } },
  ],
  events: [
    { t: 0.06, ev: 'charge' },
    { t: 0.3, ev: 'impulse' },
  ],
};

const summon: Clip = {
  name: 'attack',
  dur: 0.86,
  keys: [
    { t: 0, p: { ...ZB, rootPos: [0, 0, 0] } },
    { t: 0.26, p: { chest: [-22, 0, 0], spine: [-6, 0, 0], head: [-12, 0, 0], armR: [-120, 0, -20], foreR: [10, 0, 0], handR: [-30, 0, 0], armL: [-130, 0, 30], foreL: [30, 0, 0], handL: [-20, 0, 0], rootPos: [0, 0.45, 0] } },
    { t: 0.42, e: 'out', p: { chest: [12, 0, 0], spine: [4, 0, 0], head: [6, 0, 0], armR: [-60, 0, -10], foreR: [10, 0, 0], handR: [-10, 0, 0], armL: [-70, 0, 20], foreL: [20, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.6, 0.6] } },
    { t: 0.56, p: { chest: [14, 0, 0], spine: [4, 0, 0], head: [6, 0, 0], armR: [-56, 0, -10], foreR: [12, 0, 0], handR: [-10, 0, 0], armL: [-66, 0, 22], foreL: [22, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.6, 0.6] } },
    { t: 0.86, p: { ...ZB, rootPos: [0, 0, 0] } },
  ],
  events: [
    { t: 0.1, ev: 'charge' },
    { t: 0.42, ev: 'impulse' },
  ],
};

const rod: Clip = {
  name: 'attack',
  dur: 0.82,
  keys: [
    { t: 0, p: { ...ZB, rootPos: [0, 0, 0] } },
    // rod to the sky
    { t: 0.2, p: { chest: [-8, 0, 0], spine: [-3, 0, 0], head: [-16, 0, 0], armR: [-158, 0, 10], foreR: [30, 0, 0], handR: [-40, 0, 0], armL: [-20, 0, 30], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, 0.3, 0] } },
    { t: 0.3, p: { chest: [-9, 0, 0], spine: [-3, 0, 0], head: [-17, 0, 0], armR: [-162, 0, 12], foreR: [30, 0, 0], handR: [-40, 0, 0], armL: [-22, 0, 34], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, 0.35, 0] } },
    // bring the storm down on the target
    { t: 0.4, e: 'out', p: { chest: [10, -12, 0], spine: [4, 0, 0], head: [6, 10, 0], armR: [-80, 0, 0], foreR: [30, 0, 0], handR: [-60, 0, 0], armL: [10, 0, 40], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.4, 0.8] } },
    { t: 0.55, p: { chest: [12, -12, 0], spine: [4, 0, 0], head: [6, 10, 0], armR: [-75, 0, 0], foreR: [28, 0, 0], handR: [-56, 0, 0], armL: [8, 0, 36], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.4, 0.7] } },
    { t: 0.82, p: { ...ZB, rootPos: [0, 0, 0] } },
  ],
  events: [
    { t: 0.22, ev: 'charge' },
    { t: 0.4, ev: 'impulse' },
  ],
};

const thrw: Clip = {
  name: 'attack',
  dur: 0.66,
  keys: [
    { t: 0, p: { ...ZB, rootPos: [0, 0, 0] } },
    { t: 0.18, p: { chest: [-10, -30, 0], spine: [-4, -10, 0], head: [0, 25, 0], armR: [-150, 0, -30], foreR: [-60, 0, 0], handR: [0, 0, 0], armL: [-60, 0, 20], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, 0.2, -0.5] } },
    { t: 0.28, e: 'out', p: { chest: [14, 30, 0], spine: [6, 10, 0], head: [0, -25, 0], armR: [-70, 0, 0], foreR: [40, 0, 0], handR: [30, 0, 0], armL: [20, 0, 10], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.4, 0.9] } },
    { t: 0.4, p: { chest: [18, 36, 0], spine: [7, 12, 0], head: [0, -28, 0], armR: [-30, 0, 20], foreR: [30, 0, 0], handR: [20, 0, 0], armL: [24, 0, 10], foreL: [0, 0, 0], handL: [0, 0, 0], rootPos: [0, -0.4, 0.8] } },
    { t: 0.66, p: { ...ZB, rootPos: [0, 0, 0] } },
  ],
  events: [{ t: 0.27, ev: 'impulse' }],
  show: [
    { t: 0.27, grp: 'flask', on: false },
    { t: 0.55, grp: 'flask', on: true },
  ],
};

const lob: Clip = {
  name: 'attack',
  dur: 0.72,
  keys: [
    { t: 0, p: { ...ZB, rootPos: [0, 0, 0] } },
    { t: 0.2, p: { chest: [6, 20, 0], spine: [2, 6, 0], head: [0, -15, 0], armL: [55, 0, 0], foreL: [40, 0, 0], handL: [0, 0, 0], armR: [10, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], rootPos: [0, -0.6, -0.3] } },
    { t: 0.32, e: 'out', p: { chest: [-6, -20, 0], spine: [-2, -6, 0], head: [-6, 15, 0], armL: [-120, 0, 0], foreL: [30, 0, 0], handL: [-20, 0, 0], armR: [-10, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], rootPos: [0, 0.3, 0.6] } },
    { t: 0.45, p: { chest: [-8, -22, 0], spine: [-2, -6, 0], head: [-6, 16, 0], armL: [-140, 0, 6], foreL: [26, 0, 0], handL: [-20, 0, 0], armR: [-10, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], rootPos: [0, 0.2, 0.5] } },
    { t: 0.72, p: { ...ZB, rootPos: [0, 0, 0] } },
  ],
  events: [{ t: 0.31, ev: 'impulse' }],
  show: [
    { t: 0.31, grp: 'bomb', on: false },
    { t: 0.6, grp: 'bomb', on: true },
  ],
};

const fists: Clip = {
  name: 'attack',
  dur: 0.5,
  keys: [
    { t: 0, p: { ...ZB, hips: [0, 0, 0], rootPos: [0, 0, 0] } },
    { t: 0.06, p: { chest: [0, -15, 0], spine: [0, -4, 0], head: [0, 12, 0], armR: [20, 0, 0], foreR: [-10, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], foreL: [0, 0, 0], handL: [0, 0, 0], hips: [0, -4, 0], rootPos: [0, 0, 0] } },
    // right jab
    { t: 0.13, e: 'out', p: { chest: [0, 30, 0], spine: [0, 8, 0], head: [0, -25, 0], armR: [-60, 0, 14], foreR: [100, 0, 0], handR: [0, 0, 0], armL: [6, 0, 0], foreL: [-6, 0, 0], handL: [0, 0, 0], hips: [0, 10, 0], rootPos: [0, -0.2, 0.8] } },
    { t: 0.21, p: { chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0], armL: [0, 0, 0], foreL: [0, 0, 0], handL: [0, 0, 0], hips: [0, 0, 0], rootPos: [0, 0, 0.4] } },
    // left cross
    { t: 0.29, e: 'out', p: { chest: [0, -36, 0], spine: [0, -9, 0], head: [0, 30, 0], armR: [8, 0, 0], foreR: [-6, 0, 0], handR: [0, 0, 0], armL: [-45, 0, -14], foreL: [85, 0, 0], handL: [0, 0, 0], hips: [0, -12, 0], rootPos: [0, -0.2, 1.0] } },
    { t: 0.36, p: { chest: [0, -38, 0], spine: [0, -9, 0], head: [0, 31, 0], armR: [8, 0, 0], foreR: [-6, 0, 0], handR: [0, 0, 0], armL: [-44, 0, -14], foreL: [82, 0, 0], handL: [0, 0, 0], hips: [0, -12, 0], rootPos: [0, -0.2, 0.9] } },
    { t: 0.5, p: { ...ZB, hips: [0, 0, 0], rootPos: [0, 0, 0] } },
  ],
  events: [
    { t: 0.13, ev: 'impulse' },
    { t: 0.29, ev: 'impulse' },
  ],
};

const ATTACKS: Record<WeaponStyle, Clip> = { sword, hammer, bow, staff, summon, rod, throw: thrw, lob, fists };

// ---------------------------------------------------------------- full body (absolute)

const death: Clip = {
  name: 'death',
  dur: 1.1,
  abs: true,
  hold: true,
  fadeIn: 0.05,
  keys: [
    { t: 0, p: { root: [0, 0, 0], rootPos: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0], legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], hips: [0, 0, 0] } },
    // the killing blow: thrown back, arms flung out
    { t: 0.1, e: 'out', p: { root: [0, 0, 0], rootPos: [0, 0.7, -0.7], chest: [-28, 0, 8], spine: [-10, 0, 0], head: [-24, 10, 0], armL: [-40, 0, 55], armR: [-40, 0, -55], foreL: [-30, 0, 0], foreR: [-30, 0, 0], legL: [-20, 0, 0], legR: [12, 0, 0], shinL: [20, 0, 0], shinR: [10, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], hips: [0, 0, 0] } },
    // stagger, knees giving way
    { t: 0.32, p: { root: [-12, 0, 0], rootPos: [0, -0.8, -1.2], chest: [10, 0, -10], spine: [6, 0, 0], head: [16, -10, 0], armL: [-20, 0, 34], armR: [-10, 0, -30], foreL: [-20, 0, 0], foreR: [-40, 0, 0], legL: [-40, 0, 0], legR: [20, 0, 0], shinL: [60, 0, 0], shinR: [40, 0, 0], footL: [-10, 0, 0], footR: [0, 0, 0], hips: [0, 10, 0] } },
    // fall onto the back
    { t: 0.66, e: 'in', p: { root: [-86, 0, 0], rootPos: [0, 1.9, -1.2], chest: [-6, 0, 0], spine: [0, 0, 0], head: [-10, 34, 0], armL: [-20, 0, 80], armR: [-30, 0, -70], foreL: [-10, 0, 0], foreR: [-40, 0, 0], legL: [-30, 0, 4], legR: [-10, 0, -6], shinL: [50, 0, 0], shinR: [10, 0, 0], footL: [-10, 0, 0], footR: [0, 0, 0], hips: [0, 0, 0] } },
    // small bounce and settle
    { t: 0.8, e: 'out', p: { root: [-80, 0, 0], rootPos: [0, 2.3, -1.2], chest: [-10, 0, 0], spine: [-2, 0, 0], head: [-14, 30, 0], armL: [-30, 0, 70], armR: [-36, 0, -64], foreL: [-14, 0, 0], foreR: [-46, 0, 0], legL: [-36, 0, 4], legR: [-16, 0, -6], shinL: [58, 0, 0], shinR: [16, 0, 0], footL: [-10, 0, 0], footR: [0, 0, 0], hips: [0, 0, 0] } },
    { t: 1.1, p: { root: [-87, 0, 0], rootPos: [0, 1.9, -1.2], chest: [-4, 0, 0], spine: [0, 0, 0], head: [-8, 38, 0], armL: [-16, 0, 84], armR: [-26, 0, -74], foreL: [-8, 0, 0], foreR: [-36, 0, 0], legL: [-28, 0, 4], legR: [-8, 0, -6], shinL: [48, 0, 0], shinR: [8, 0, 0], footL: [-10, 0, 0], footR: [0, 0, 0], hips: [0, 0, 0] } },
  ],
  events: [{ t: 0.66, ev: 'death' }],
};

const LEGS0 = { legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0] } as PoseMap;

const levelup: Clip = {
  name: 'levelup',
  dur: 1.0,
  abs: true,
  keys: [
    { t: 0, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] } },
    // crouch
    { t: 0.16, p: { legL: [-28, 0, 0], legR: [-28, 0, 0], shinL: [50, 0, 0], shinR: [50, 0, 0], footL: [-22, 0, 0], footR: [-22, 0, 0], rootPos: [0, -1.3, 0], chest: [16, 0, 0], head: [6, 0, 0], armL: [24, 0, 12], armR: [24, 0, -12], foreL: [-20, 0, 0], foreR: [-20, 0, 0] } },
    // leap with arms thrown up
    { t: 0.36, e: 'out', p: { legL: [8, 0, 0], legR: [-12, 0, 0], shinL: [22, 0, 0], shinR: [36, 0, 0], footL: [20, 0, 0], footR: [10, 0, 0], rootPos: [0, 2.8, 0], chest: [-12, 0, 0], head: [-16, 0, 0], armL: [-10, 0, 160], armR: [-10, 0, -160], foreL: [-10, 0, 0], foreR: [-10, 0, 0] } },
    // land
    { t: 0.56, e: 'in', p: { legL: [-24, 0, 0], legR: [-24, 0, 0], shinL: [44, 0, 0], shinR: [44, 0, 0], footL: [-20, 0, 0], footR: [-20, 0, 0], rootPos: [0, -1.0, 0], chest: [10, 0, 0], head: [2, 0, 0], armL: [-20, 0, 130], armR: [-20, 0, -130], foreL: [-30, 0, 0], foreR: [-30, 0, 0] } },
    { t: 0.74, p: { legL: [-6, 0, 0], legR: [-6, 0, 0], shinL: [12, 0, 0], shinR: [12, 0, 0], footL: [-6, 0, 0], footR: [-6, 0, 0], rootPos: [0, -0.2, 0], chest: [-4, 0, 0], head: [-6, 0, 0], armL: [-30, 0, 100], armR: [-30, 0, -100], foreL: [-60, 0, 0], foreR: [-60, 0, 0] } },
    { t: 1.0, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] } },
  ],
  events: [{ t: 0.34, ev: 'levelup' }],
};

const ability: Clip = {
  name: 'ability',
  dur: 1.1,
  abs: true,
  keys: [
    { t: 0, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] } },
    // gather power, arms crossed in front
    { t: 0.26, p: { legL: [-16, 0, 6], legR: [-16, 0, -6], shinL: [32, 0, 0], shinR: [32, 0, 0], footL: [-16, 0, 0], footR: [-16, 0, 0], rootPos: [0, -1.0, 0], chest: [22, 0, 0], spine: [8, 0, 0], head: [10, 0, 0], armL: [-62, 0, -34], armR: [-62, 0, 34], foreL: [-72, 0, 0], foreR: [-72, 0, 0] } },
    // release: arms flung wide, chest open to the sky
    { t: 0.42, e: 'back', p: { legL: [4, 0, 10], legR: [4, 0, -10], shinL: [4, 0, 0], shinR: [4, 0, 0], footL: [-4, 0, 0], footR: [-4, 0, 0], rootPos: [0, 0.8, 0], chest: [-18, 0, 0], spine: [-6, 0, 0], head: [-18, 0, 0], armL: [-40, 0, 96], armR: [-40, 0, -96], foreL: [10, 0, 0], foreR: [10, 0, 0] } },
    { t: 0.76, p: { legL: [2, 0, 9], legR: [2, 0, -9], shinL: [6, 0, 0], shinR: [6, 0, 0], footL: [-4, 0, 0], footR: [-4, 0, 0], rootPos: [0, 0.5, 0], chest: [-14, 0, 0], spine: [-5, 0, 0], head: [-14, 0, 0], armL: [-36, 0, 90], armR: [-36, 0, -90], foreL: [6, 0, 0], foreR: [6, 0, 0] } },
    { t: 1.1, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] } },
  ],
  events: [
    { t: 0.05, ev: 'charge' },
    { t: 0.42, ev: 'ability' },
  ],
};

function victory(kind: AnimStyle['victory']): Clip {
  const base = { ...LEGS0, rootPos: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0] } as PoseMap;
  switch (kind) {
    case 'salute':
      // weapon raised before the face, then a proud steady stance
      return {
        name: 'victory', dur: 2.6, abs: true, loopFrom: 0.8,
        keys: [
          { t: 0, p: base },
          { t: 0.45, p: { ...LEGS0, rootPos: [0, 0.2, 0], chest: [-8, 0, 0], head: [-4, 0, 0], armL: [-10, 0, 14], foreL: [-30, 0, 0], armR: [-78, 0, 24], foreR: [-74, 0, 0], handR: [-30, 0, 0] } },
          { t: 0.8, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-6, 0, 0], head: [-4, 0, 0], armL: [-10, 0, 12], foreL: [-30, 0, 0], armR: [-74, 0, 22], foreR: [-76, 0, 0], handR: [-28, 0, 0] } },
          { t: 1.7, p: { ...LEGS0, rootPos: [0, 0.15, 0], chest: [-9, 0, 0], head: [-7, 0, 0], armL: [-10, 0, 14], foreL: [-30, 0, 0], armR: [-76, 0, 24], foreR: [-78, 0, 0], handR: [-30, 0, 0] } },
          { t: 2.6, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-6, 0, 0], head: [-4, 0, 0], armL: [-10, 0, 12], foreL: [-30, 0, 0], armR: [-74, 0, 22], foreR: [-76, 0, 0], handR: [-28, 0, 0] } },
        ],
        events: [{ t: 0.45, ev: 'impulse' }],
      };
    case 'raise':
      // staff lifted high, swaying with the power
      return {
        name: 'victory', dur: 2.4, abs: true, loopFrom: 0.6,
        keys: [
          { t: 0, p: base },
          { t: 0.6, e: 'back', p: { ...LEGS0, rootPos: [0, 0.4, 0], chest: [-10, 0, 0], head: [-14, 0, 0], armR: [-165, 0, 0], foreR: [20, 0, 0], handR: [-30, 0, 0], armL: [-40, 0, 40], foreL: [-20, 0, 0] } },
          { t: 1.5, p: { ...LEGS0, rootPos: [0, 0.7, 0], chest: [-12, 0, 4], head: [-16, 0, -4], armR: [-170, 0, 6], foreR: [20, 0, 0], handR: [-30, 0, 0], armL: [-46, 0, 48], foreL: [-24, 0, 0] } },
          { t: 2.4, p: { ...LEGS0, rootPos: [0, 0.4, 0], chest: [-10, 0, 0], head: [-14, 0, 0], armR: [-165, 0, 0], foreR: [20, 0, 0], handR: [-30, 0, 0], armL: [-40, 0, 40], foreL: [-20, 0, 0] } },
        ],
        events: [{ t: 0.6, ev: 'impulse' }],
      };
    case 'flex':
      // hand on hip, the other arm flexed, a little bounce
      return {
        name: 'victory', dur: 1.6, abs: true, loopFrom: 0.5,
        keys: [
          { t: 0, p: base },
          { t: 0.5, e: 'back', p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-6, 0, 0], head: [-6, 10, 0], armR: [-10, 0, -82], foreR: [-125, 0, 0], armL: [10, 0, 42], foreL: [-100, 0, 0] } },
          { t: 1.05, p: { ...LEGS0, legL: [-6, 0, 0], legR: [-6, 0, 0], shinL: [12, 0, 0], shinR: [12, 0, 0], rootPos: [0, -0.4, 0], chest: [-3, 0, 0], head: [-3, 14, 0], armR: [-14, 0, -86], foreR: [-130, 0, 0], armL: [10, 0, 44], foreL: [-100, 0, 0] } },
          { t: 1.6, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-6, 0, 0], head: [-6, 10, 0], armR: [-10, 0, -82], foreR: [-125, 0, 0], armL: [10, 0, 42], foreL: [-100, 0, 0] } },
        ],
      };
    default:
      // cheer: jump and pump both fists
      return {
        name: 'victory', dur: 1.4, abs: true, loopFrom: 0.4,
        keys: [
          { t: 0, p: base },
          { t: 0.4, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-8, 0, 0], head: [-10, 0, 0], armR: [-20, 0, -150], foreR: [-30, 0, 0], armL: [-20, 0, 150], foreL: [-30, 0, 0] } },
          { t: 0.75, e: 'out', p: { legL: [10, 0, 0], legR: [-14, 0, 0], shinL: [24, 0, 0], shinR: [40, 0, 0], footL: [16, 0, 0], footR: [10, 0, 0], rootPos: [0, 2.2, 0], chest: [-12, 0, 0], head: [-14, 0, 0], armR: [-10, 0, -170], foreR: [-10, 0, 0], armL: [-10, 0, 170], foreL: [-10, 0, 0] } },
          { t: 1.05, e: 'in', p: { legL: [-20, 0, 0], legR: [-20, 0, 0], shinL: [40, 0, 0], shinR: [40, 0, 0], footL: [-20, 0, 0], footR: [-20, 0, 0], rootPos: [0, -0.8, 0], chest: [8, 0, 0], head: [-4, 0, 0], armR: [-20, 0, -130], foreR: [-60, 0, 0], armL: [-20, 0, 130], foreL: [-60, 0, 0] } },
          { t: 1.4, p: { ...LEGS0, rootPos: [0, 0, 0], chest: [-8, 0, 0], head: [-10, 0, 0], armR: [-20, 0, -150], foreR: [-30, 0, 0], armL: [-20, 0, 150], foreL: [-30, 0, 0] } },
        ],
      };
  }
}

/** Shen's victory: palm-over-fist bow. */
const monkBow: Clip = {
  name: 'victory', dur: 2.4, abs: true, loopFrom: 1.4,
  keys: [
    { t: 0, p: { ...LEGS0, rootPos: [0, 0, 0], hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], foreL: [0, 0, 0], foreR: [0, 0, 0] } },
    { t: 0.4, p: { ...LEGS0, rootPos: [0, 0, 0], hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [-62, -20, -24], armR: [-62, 20, 24], foreL: [-62, 0, 0], foreR: [-62, 0, 0] } },
    { t: 0.9, p: { ...LEGS0, rootPos: [0, -0.3, -0.3], hips: [0, 0, 0], chest: [30, 0, 0], head: [14, 0, 0], armL: [-58, -20, -24], armR: [-58, 20, 24], foreL: [-66, 0, 0], foreR: [-66, 0, 0] } },
    { t: 1.4, p: { ...LEGS0, rootPos: [0, 0, 0], hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [-62, -20, -24], armR: [-62, 20, 24], foreL: [-62, 0, 0], foreR: [-62, 0, 0] } },
    { t: 1.9, p: { ...LEGS0, rootPos: [0, 0.1, 0], hips: [0, 0, 0], chest: [-3, 0, 0], head: [-3, 0, 0], armL: [-62, -20, -24], armR: [-62, 20, 24], foreL: [-62, 0, 0], foreR: [-62, 0, 0] } },
    { t: 2.4, p: { ...LEGS0, rootPos: [0, 0, 0], hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [-62, -20, -24], armR: [-62, 20, 24], foreL: [-62, 0, 0], foreR: [-62, 0, 0] } },
  ],
};

/** The action clips a hero can play, chosen by its weapon and victory style. */
export function clipsFor(style: AnimStyle, heroId: string): Record<'attack' | 'death' | 'levelup' | 'ability' | 'victory', Clip> {
  return {
    attack: ATTACKS[style.weapon],
    death,
    levelup,
    ability,
    victory: heroId === 'shen' ? monkBow : victory(style.victory),
  };
}

export function ease(e: Ease | undefined, u: number): number {
  switch (e) {
    case 'lin':
      return u;
    case 'in':
      return u * u * u;
    case 'out':
      return 1 - (1 - u) ** 3;
    case 'back': {
      const c = 1.7;
      const v = u - 1;
      return 1 + (c + 1) * v * v * v + c * v * v;
    }
    default:
      return u * u * (3 - 2 * u);
  }
}
