import { DEFAULT_PROPS, type HeroRigDef, type Proportions } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { arms, head, legs, P, shade, sym, torso } from '../heroRigs/kit';
import { bands } from './kitAgile';

/** Idle stance (also the base the steelfist action clips are authored against). */
export const STEELFIST_STANCE: PoseMap = {
  rootPos: [0, -0.7, 0],
  hips: [0, -14, 0],
  legL: [-22, -10, 5], shinL: [20, 0, 0], footL: [2, 10, 0],
  legR: [14, 14, -7], shinR: [22, 0, 0], footR: [-12, -14, 0],
  spine: [4, 4, 0], chest: [6, 18, 0], head: [-6, -14, 0],
  // lead (left) fist forward at chin height, rear fist guarding the jaw
  armL: [-58, -6, 16], foreL: [-64, 0, 0], handL: [18, 0, 0],
  armR: [-38, 8, -26], foreR: [-112, 0, 0], handR: [8, 0, 0],
};

/**
 * Steel Fist (Стальной кулак): a lean, broad-shouldered brawler. The hero feature is the pair of
 * oversized steel gauntlets with glowing chi cores; the rest is light: an open sleeveless vest,
 * a crimson sash with long tails, loose trousers wrapped at the shin and a headband with tails.
 */
export function steelfistRig(): HeroRigDef {
  const pr: Proportions = { ...DEFAULT_PROPS, thigh: 3.3, shin: 3.2, foot: 1.3, hipX: 1.55, spine: 1.4, shoulderX: 4.25, shoulderY: 3.7, upperArm: 2.9, foreArm: 2.8, neck: 4.2, depth: 3.4 };
  const skin = 0xd29a6c;
  const skinD = shade(skin, 0.86);
  const vest = 0x2c2f3a;
  const vestL = 0x3c4150;
  const pants = 0x3a3f4e;
  const crimson = 0xc0283a;
  const crimsonD = 0x861a2a;
  const wrap = 0xece2cc;
  const wrapD = 0xc8bca2;
  const steel = 0x9aa6b8;
  const steelL = 0xd0d8e4;
  const steelD = 0x5a6474;
  const gold = 0xe2b444;
  const chi = 0x56d4ff;
  const hair = 0x1c1a20;
  const shoe = 0x2a2422;

  // ---------------------------------------------------------------- gauntlet (left; mirrored)
  const gauntlet: RigPart[] = [
    // flared steel bracer over the lower forearm with a gold rim and a chi strip
    P('foreL', [0, -1.85, 0.02], [2.55, 1.95, 2.6], steel, { s: 'rbox', t: [0.8, 0.8], bv: [0.55, 0.3] }),
    P('foreL', [0, -2.78, 0.02], [2.7, 0.32, 2.75], gold, { s: 'rbox', bv: [0.6, 0.1], flat: true }),
    P('foreL', [0, -1.05, 0.02], [2.15, 0.25, 2.2], steelD, { flat: true }),
    P('foreL', [1.27, -1.9, 0.02], [0.16, 1.15, 0.55], chi, { g: true }),
    P('foreL', [0, -1.9, 1.29], [0.55, 1.15, 0.16], steelD, { flat: true }),
    // fist shell, knuckle plate, studs, thumb guard
    P('handL', [0, -0.9, 0.1], [2.25, 2.0, 2.35], steel, { s: 'rbox', bv: [0.55, 0.45, 0.3] }),
    P('handL', [0, -2.0, 0.1], [2.4, 0.6, 2.5], steelL, { s: 'rbox', bv: [0.5, 0.2, 0.2] }),
    ...[-0.78, -0.26, 0.26, 0.78].map((z) => P('handL', [0, -2.48, 0.1 + z], [0.62, 0.55, 0.48], steelD, { s: 'rbox', bv: [0.18, 0.15], r: [180, 0, 0], t: [0.6, 0.6] })),
    P('handL', [0, -1.72, 0.1], [2.45, 0.2, 2.55], gold, { flat: true }),
    P('handL', [-0.85, -0.7, 1.15], [0.85, 1.3, 0.85], steelD, { s: 'rbox', bv: [0.25, 0.25] }),
    // finger ridges on the palm side
    ...[-1.25, -1.65].map((y) => P('handL', [-1.13, y, 0.1], [0.1, 0.14, 2.0], steelD, { flat: true })),
    // chi core on the back of the fist: gold setting, glowing gem
    P('handL', [1.12, -0.95, 0.1], [0.4, 1.5, 1.5], gold, { s: 'rbox', bv: [0.4, 0.15] }),
    P('handL', [1.36, -0.95, 0.1], [0.5, 1.05, 1.05], chi, { s: 'gem', g: true }),
    P('handL', [1.33, -0.95, 0.1], [0.12, 1.75, 0.2], gold, { flat: true }),
  ];

  const parts: RigPart[] = [
    // ---------------------------------------------------------- legs: loose trousers, shin wraps, light shoes
    ...legs(pr, { pants, boots: shoe, sole: 0x1a1614, thighW: 2.9, shinW: 2.05, cuff: 2.2, cuffColor: wrap }),
    ...sym([
      P('legL', [0.05, -2.35, 0.05], [3.15, 1.9, 3.15], pants, { s: 'rbox', t: [1.04, 1.04], bv: [0.85, 0.4, 0.45] }),
      P('legL', [0.05, -1.6, 0.05], [3.0, 0.2, 3.0], shade(pants, 0.8), { flat: true }),
      ...bands('shinL', [-1.35, -1.85, -2.35], [2.5, 0.18, 2.55], wrapD),
      P('shinL', [0, -0.95, 0.05], [2.45, 0.35, 2.5], crimsonD, { flat: true }),
      // sandal straps over the shoe
      P('footL', [0, -0.55, 1.25], [2.3, 0.3, 0.45], wrapD, { flat: true }),
    ]),

    // ---------------------------------------------------------- torso: bare chest under an open vest
    ...torso(pr, { shirt: skin, pants, chestW: 5.6, flare: 1.32, chestD: 3.3, chestH: 4.1, waistW: 4.3 }),
    // abs on the spine block
    ...[0.15, 0.85].flatMap((y) => sym([P('spine', [0.55, y, 1.48], [0.95, 0.55, 0.2], skinD, { s: 'rbox', bv: [0.2, 0.15] })])),
    P('spine', [0, 0.5, 1.5], [0.12, 1.6, 0.2], shade(skin, 0.72), { flat: true }),
    // vest shell (sides and back) and the open front showing the pecs
    P('chest', [0, 2.05, -0.12], [5.95, 4.0, 3.45], vest, { s: 'rbox', t: [1.3, 1.05], bv: [0.8, 0.55] }),
    P('chest', [0, 2.35, 1.6], [2.2, 3.4, 0.6], skin, { t: [1.75, 1] }),
    ...sym([
      P('chest', [0.95, 2.95, 1.86], [1.75, 1.25, 0.32], skin, { s: 'rbox', bv: [0.35, 0.3, 0.2] }),
      // vest lapels with crimson trim
      P('chest', [1.62, 2.0, 1.72], [0.42, 4.0, 0.35], crimson, { r: [0, 0, -14], flat: true }),
      P('chest', [2.3, 2.1, 1.62], [1.0, 3.9, 0.3], vestL, { r: [0, 0, -12] }),
      // shoulder trim of the sleeveless vest
      P('chest', [2.95, 3.85, -0.1], [1.0, 0.35, 3.7], crimson, { flat: true }),
    ]),
    P('chest', [0, 2.95, 1.97], [0.12, 1.1, 0.12], shade(skin, 0.7), { flat: true }),
    // back emblem: a steel fist medallion stitched on the vest
    P('chest', [0, 2.4, -1.95], [1.6, 1.6, 0.25], crimson, { s: 'rbox', bv: [0.5, 0.1], r: [0, 0, 45] }),
    P('chest', [0, 2.4, -2.08], [0.9, 0.9, 0.2], steelL, { s: 'rbox', bv: [0.25, 0.1] }),
    // collar
    P('chest', [0, 4.05, -0.5], [3.4, 0.6, 2.4], vest, { s: 'rbox', bv: [0.6, 0.2] }),

    // ---------------------------------------------------------- sash: wide crimson band, knot, long tails
    P('hips', [0, 1.0, 0], [5.35, 1.15, 3.55], crimson, { s: 'rbox', bv: [0.8, 0.15, 0.15] }),
    P('hips', [0, 1.45, 0], [5.4, 0.18, 3.6], gold, { flat: true }),
    P('hips', [1.3, 1.0, 1.85], [1.3, 1.25, 0.6], crimsonD, { s: 'rbox', bv: [0.35, 0.3, 0.3] }),
    P('skirtF', [1.55, -0.95, 0.5], [0.8, 1.9, 0.3], crimson, { r: [0, 0, 14], t: [1.2, 1] }),
    P('skirtF', [0.9, -0.75, 0.55], [0.75, 1.5, 0.3], crimsonD, { r: [0, 0, -10], t: [1.2, 1] }),
    P('skirtB', [0.45, -2.1, -0.65], [0.95, 3.9, 0.28], crimson, { r: [0, 0, 5], t: [1.15, 1] }),
    P('skirtB', [-0.55, -1.8, -0.62], [0.9, 3.3, 0.28], crimsonD, { r: [0, 0, -6], t: [1.15, 1] }),
    P('skirtB', [0.62, -4.1, -0.65], [1.05, 0.3, 0.32], gold, { r: [0, 0, 5], flat: true }),
    P('skirtB', [-0.72, -3.5, -0.62], [1.0, 0.3, 0.32], gold, { r: [0, 0, -6], flat: true }),

    // ---------------------------------------------------------- arms: bare and muscular, bandaged forearms
    ...arms(pr, { sleeve: skin, skin, fore: wrap, glove: steel, upperW: 2.15, foreW: 2.0, shoulder: skin, shoulderSize: 2.65 }),
    ...sym([
      P('armL', [0.05, -1.5, 0.35], [1.9, 1.3, 1.5], skin, { s: 'rbox', bv: [0.45, 0.4, 0.3] }),
      P('armL', [0, -2.2, 0], [2.35, 0.45, 2.35], crimson, { flat: true }),
      P('armL', [0, -2.48, 0], [2.3, 0.14, 2.3], gold, { flat: true }),
      ...bands('foreL', [-0.35, -0.75], [2.12, 0.16, 2.12], wrapD),
      ...gauntlet,
    ]),

    // ---------------------------------------------------------- head: face, spiky swept hair, headband with tails
    ...head({ skin, eyes: 0x1c2430, brows: hair, size: [5.5, 5.2, 5.2], mouth: 0x7a4a3a }),
    P('head', [0, 0.85, 0.35], [3.6, 0.9, 4.3], shade(skin, 0.95), { s: 'rbox', bv: [0.6, 0.3] }),
    P('head', [1.85, 2.45, 2.66], [0.18, 1.2, 0.1], 0xa86a52, { r: [0, 0, -25], flat: true }),
    // hair cap and swept-back spikes
    P('head', [0, 5.4, -0.3], [5.85, 1.7, 5.5], hair, { s: 'rbox', bv: [1.0, 0.6] }),
    P('head', [0, 4.15, -2.4], [5.6, 2.2, 1.0], hair, { s: 'rbox', bv: [0.4, 0.3] }),
    ...sym([P('head', [2.62, 3.95, -0.6], [0.5, 1.9, 2.9], hair)]),
    ...[
      [0, 6.15, 1.2, 0, -50, 1.5],
      [0, 6.25, -0.4, 0, -62, 1.7],
      [-1.4, 5.95, 0.4, 14, -52, 1.3],
      [1.4, 5.95, 0.4, -14, -52, 1.3],
      [-1.5, 5.8, -1.4, 18, -70, 1.2],
      [1.5, 5.8, -1.4, -18, -70, 1.2],
      [0, 5.6, -2.5, 0, -95, 1.4],
    ].map(([x, y, z, rz, rx, s]) => P('head', [x, y, z], [s, 2.2, s * 0.85], hair, { s: 'cyl', n: 4, t: [0.08, 0.08], r: [rx, 0, rz] })),
    P('head', [0, 5.55, 2.35], [3.4, 0.9, 0.7], hair, { s: 'rbox', bv: [0.3, 0.3], r: [-10, 0, 0] }),
    // headband with a steel plate and two flowing tails
    P('head', [0, 4.4, -0.05], [5.85, 0.75, 5.5], wrap, { s: 'rbox', bv: [1.0, 0.15] }),
    P('head', [0, 4.42, 2.7], [1.5, 0.85, 0.2], steel, { s: 'rbox', bv: [0.25, 0.1] }),
    P('head', [0, 4.42, 2.82], [0.55, 0.45, 0.12], chi, { g: true }),
    P('head', [0, 4.4, -2.85], [1.0, 0.9, 0.5], wrapD, { s: 'rbox', bv: [0.3, 0.2] }),
    P('accC', [0.55, -1.7, -0.2], [0.85, 3.4, 0.2], wrap, { r: [0, 0, 9], t: [1.3, 1] }),
    P('accC', [-0.5, -1.4, -0.2], [0.8, 2.8, 0.2], wrapD, { r: [0, 0, -9], t: [1.3, 1] }),
  ];

  return {
    id: 'steelfist',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      accC: { parent: 'head', at: [0, 4.4, -3.05], kind: 'cape', k: 0.75, rest: 12 },
    },
    tip: { bone: 'handR', p: [0, -2.6, 0.1] },
    anim: {
      weapon: 'fists',
      gait: { cadence: 0.6, stride: 40, knee: 78, armSwing: 18, elbow: 70, bounce: 0.85, lean: 15, sway: 2, twist: 14, heavy: 0, headBob: 1.2, armOut: 6, idle: 1.25 },
      stance: STEELFIST_STANCE,
      stanceRun: 0.6,
      victory: 'flex',
    },
  };
}
