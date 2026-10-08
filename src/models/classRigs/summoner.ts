import { DEFAULT_PROPS, type HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart, V3 } from '../../render/rig/shapes';
import { arms, head, legs, P, ring, sym, torso } from '../heroRigs/kit';
import { curve, leaf, motes, seg, softFace, symX } from './kitRanged';

/**
 * Summoner: a nature-spirit caller in layered white and teal robes trimmed with gold. Antler
 * crown with leaves and glowing tips, long chestnut hair on a spring, a floor-length skirt with
 * flowing front/back panels, sash ribbons, and a living-wood staff whose forked head cradles a
 * spirit crystal. Spirit wisps orbit her on the accB spin bone.
 */
export function summonerRig(): HeroRigDef {
  const pr = { ...DEFAULT_PROPS, thigh: 3.4, shin: 3.3, foot: 1.2, hipX: 1.25, spine: 1.6, shoulderX: 3.15, shoulderY: 3.4, upperArm: 2.8, foreArm: 2.6, neck: 4.0, depth: 3.0 };
  const white = 0xeef0e6;
  const cream = 0xd6d8c4;
  const teal = 0x23847c;
  const tealD = 0x165a56;
  const tealL = 0x4cb4a4;
  const gold = 0xe2b452;
  const goldD = 0xa87c30;
  const skin = 0xf0caa6;
  const hair = 0x7a3c24;
  const hairL = 0x9c5232;
  const antler = 0xe6d8b8;
  const wood = 0x6a4a2c;
  const woodL = 0x8c6a40;
  const leafG = 0x5cba62;
  const leafD = 0x3a8a48;
  const spirit = 0x8affe0;
  const spirit2 = 0xc8fff0;

  // antler: main beam and tines on the left (mirrored)
  const beam: V3[] = [[1.9, 5.5, 0.1], [2.75, 6.9, -0.25], [3.2, 8.4, -0.55], [3.05, 9.8, -0.6], [2.6, 10.9, -0.4]];
  const staffHead = 10.6;

  const parts: RigPart[] = [
    // ---- legs (mostly under the skirt): pale leggings and soft gold-laced slippers
    ...legs(pr, { pants: cream, boots: tealD, thighW: 1.9, shinW: 1.7, cuff: 0.9, cuffColor: gold, sole: 0x2a3a34 }),

    // ---- torso: white blouse, teal corset with gold lacing, gem brooch
    ...torso(pr, { shirt: white, pants: teal, belt: gold, chestW: 4.5, flare: 1.15, chestD: 3.0, chestH: 3.8, waistW: 3.7 }),
    P('spine', [0, 0.65, 0], [3.95, 1.9, 2.95], teal, { s: 'rbox', t: [1.06, 1.05], bv: [0.6, 0] }),
    P('chest', [0, 0.9, 0], [4.4, 1.9, 3.1], teal, { s: 'rbox', t: [1.08, 1.04], bv: [0.7, 0.2] }),
    P('chest', [0, 1.75, 1.45], [2.4, 0.25, 0.3], gold, { flat: true }),
    ...[0.3, 0.9, 1.5].map((y) => P('chest', [0, y - 0.6, 1.6], [0.9, 0.16, 0.14], gold, { flat: true })),
    P('spine', [0, 0.5, 1.55], [0.2, 1.6, 0.12], gold, { flat: true }),
    P('chest', [0, 2.7, 1.6], [1.0, 1.25, 0.4], spirit, { s: 'gem', g: true }),
    ...sym([seg('chest', [0.45, 3.5, 1.62], [0.7, 2.1, 1.62], [0.3, 0.14], gold, { flat: true })]),
    ...sym([seg('chest', [0.7, 2.1, 1.62], [1.4, 1.85, 1.62], [0.3, 0.14], gold, { flat: true })]),
    // layered shawl over the shoulders: teal mantle, gold edge, leaf pauldrons
    P('chest', [0, 3.5, -0.15], [6.3, 1.25, 3.7], teal, { s: 'rbox', t: [0.74, 0.86], bv: [1.0, 0.45] }),
    P('chest', [0, 2.9, -0.15], [6.35, 0.22, 3.75], gold, { flat: true }),
    P('chest', [0, 4.05, -0.45], [3.6, 1.3, 2.9], white, { s: 'rbox', t: [0.95, 0.95], bv: [0.6, 0.3] }),
    P('chest', [0, 4.75, -1.15], [3.6, 1.4, 0.4], white, { t: [1.2, 1], sh: [0, -0.3] }),
    P('chest', [0, 5.42, -1.33], [4.3, 0.18, 0.45], gold, { flat: true }),
    ...sym([
      P('armL', [0.45, 0.25, 0], [2.0, 0.55, 2.6], leafG, { s: 'gem', r: [0, 0, -28] }),
      P('armL', [0.75, -0.25, 0.1], [1.8, 0.5, 2.2], leafD, { s: 'gem', r: [0, 0, -40] }),
      P('armL', [0.2, 0.55, 0], [1.2, 0.5, 1.6], gold, { s: 'gem', r: [0, 0, -20] }),
    ]),

    // ---- long robe: bell skirt with layered hem, front and back panels that follow the legs
    P('hips', [0, -2.25, 0], [5.4, 6.2, 4.3], white, { s: 'rbox', t: [0.68, 0.68], bv: [1.3, 0] }),
    P('hips', [0, -5.2, 0], [5.5, 0.32, 4.4], gold, { flat: true }),
    P('hips', [0, -1.0, 0], [4.9, 3.5, 3.9], teal, { s: 'rbox', t: [0.78, 0.78], bv: [1.1, 0] }),
    P('hips', [0, -2.72, 0], [4.95, 0.22, 3.95], gold, { flat: true }),
    ...ring('hips', [0, -3.0, 0], 2.25, 8, [1.0, 0.7, 0.3], teal, { s: 'gem', flat: true }),
    P('hips', [0, 1.05, 1.62], [1.2, 1.0, 0.3], gold, { s: 'rbox', bv: [0.3, 0.2] }),
    P('hips', [0, 1.05, 1.82], [0.55, 0.65, 0.2], spirit, { s: 'gem', g: true }),
    P('skirtF', [0, -3.75, 0.22], [2.6, 7.3, 0.36], white, { t: [0.75, 1] }),
    P('skirtF', [0, -3.75, 0.44], [0.9, 7.1, 0.1], teal, { flat: true, t: [0.7, 1] }),
    ...[-1.6, -3.6, -5.6].flatMap((y) => leaf('skirtF', [0, y, 0.52], 0.95, [0, 0, 0], gold)),
    P('skirtF', [0, -7.35, 0.22], [2.7, 0.3, 0.42], gold, { flat: true }),
    P('skirtB', [0, -3.9, -0.25], [3.9, 7.6, 0.4], teal, { t: [0.72, 1] }),
    P('skirtB', [0, -7.6, -0.25], [4.0, 0.3, 0.46], gold, { flat: true }),
    ...sym([P('skirtB', [1.1, -7.95, -0.25], [1.2, 0.6, 0.38], teal, { t: [1, 1] })]),
    // sash ribbons at the back (cape springs)
    P('hips', [0, 1.1, -1.75], [1.6, 0.9, 0.6], gold, { s: 'gem', r: [0, 0, 90] }),
    ...sym([P('hips', [0.85, 1.1, -1.7], [1.1, 0.8, 0.4], tealL, { s: 'gem', r: [0, 0, 90] })]),
    seg('capeA', [0.3, 0, 0], [0.9, -4.4, 0], [0.75, 0.16], tealL, { flat: true }),
    seg('capeA', [-0.3, 0, 0], [-0.8, -3.9, 0], [0.75, 0.16], gold, { flat: true }),
    P('capeB', [0.15, -1.2, 0], [0.7, 2.4, 0.16], tealL, { flat: true }),

    // ---- arms: white sleeves, wide teal-lined bell cuffs, gold armlets and bracelets
    ...arms(pr, { sleeve: white, skin, fore: white, upperW: 1.5, foreW: 1.45, shoulderSize: 2.0 }),
    ...sym([
      P('armL', [0, -1.7, 0], [1.68, 0.3, 1.7], gold, { flat: true }),
      P('foreL', [0, -1.9, 0.05], [2.55, 2.0, 2.55], white, { s: 'rbox', t: [0.6, 0.6], bv: [0.5, 0] }),
      P('foreL', [0, -2.95, 0.05], [2.6, 0.24, 2.6], gold, { flat: true }),
      P('foreL', [0, -2.9, 0.05], [2.2, 0.2, 2.2], tealD, { flat: true }),
      P('handL', [0, -0.15, 0.05], [1.5, 0.28, 1.65], gold, { flat: true }),
    ]),

    // ---- head: soft face, glowing spirit mark, long chestnut hair
    ...head({ skin, eyes: 0x1f8a70, brows: hair, size: [5.4, 5.2, 5.1], mouth: 0xc06a62, noEars: true }),
    ...softFace(skin, 0x3a1c14, 0xc8665e, 5.1),
    P('head', [0, 4.15, 2.6], [0.5, 0.75, 0.12], spirit, { s: 'gem', g: true }),
    ...sym([P('head', [2.25, 2.6, 2.58], [0.32, 0.32, 0.1], tealL, { flat: true })]),
    P('head', [0.6, 5.3, 2.3], [4.4, 1.15, 0.85], hair, { s: 'rbox', bv: [0.35, 0.4, 0.3], r: [0, 0, -8] }),
    P('head', [-1.7, 4.8, 2.4], [1.4, 1.3, 0.7], hairL, { r: [0, 0, 20] }),
    ...sym([
      P('head', [2.65, 3.4, 0.6], [0.75, 4.6, 3.6], hair, { s: 'rbox', bv: [0.3, 0.2, 0.3] }),
      P('head', [2.45, 0.1, 1.55], [0.85, 4.2, 1.0], hair, { s: 'rbox', t: [0.8, 1], bv: [0.3, 0.2, 0.3] }),
      P('head', [2.45, -1.95, 1.6], [0.6, 0.8, 0.8], gold, { s: 'cyl', n: 6 }),
      P('head', [2.45, -2.75, 1.6], [0.55, 1.0, 0.8], hair, { t: [0.4, 0.6] }),
    ]),
    P('head', [0, 3.6, -2.25], [5.6, 5.2, 1.3], hair, { s: 'rbox', bv: [0.5, 0.8, 0.4] }),
    P('head', [0, 5.95, -0.3], [5.5, 0.9, 5.0], hair, { s: 'rbox', bv: [1.2, 0.4] }),
    P('accC', [0, -2.6, -0.2], [4.6, 5.6, 1.25], hair, { s: 'rbox', t: [1.2, 1], bv: [0.5, 0.3, 0.4] }),
    P('accC', [0, -5.8, -0.25], [3.6, 1.6, 1.1], hair, { s: 'rbox', t: [1.3, 1], bv: [0.4, 0.2, 0.5] }),
    P('accC', [0, -7.0, -0.25], [2.0, 1.2, 0.9], hairL, { t: [1.8, 1.2] }),
    P('accC', [0, -4.7, -0.25], [2.4, 0.4, 1.4], gold, { flat: true }),
    ...[-1.2, 0, 1.2].map((x) => P('accC', [x, -3.0, -0.92], [0.18, 4.2, 0.1], hairL, { flat: true })),
    // antler crown: gold circlet, forehead gem, living antlers with leaves and spirit tips
    P('head', [0, 5.25, -0.15], [5.7, 0.5, 5.4], gold, { s: 'cyl', n: 10 }),
    P('head', [0, 5.55, 2.6], [0.9, 1.1, 0.4], spirit, { s: 'gem', g: true }),
    P('head', [0, 5.55, 2.5], [1.5, 1.4, 0.3], goldD, { s: 'gem' }),
    ...sym([
      ...curve('head', beam, [0.75, 0.75], antler, { taper: 0.55 }),
      ...curve('head', [beam[1], [3.9, 7.7, 0.4], [4.5, 8.6, 0.9]], [0.5, 0.5], antler, { taper: 0.7 }),
      ...curve('head', [beam[2], [4.3, 9.4, -1.2], [4.7, 10.3, -1.5]], [0.45, 0.45], antler, { taper: 0.7 }),
      ...curve('head', [beam[3], [2.0, 10.5, -1.4], [1.55, 11.0, -2.0]], [0.4, 0.4], antler, { taper: 0.7 }),
      P('head', [4.55, 8.7, 0.95], [0.45, 0.7, 0.45], spirit, { s: 'gem', g: true }),
      P('head', [4.75, 10.4, -1.55], [0.45, 0.7, 0.45], spirit, { s: 'gem', g: true }),
      P('head', [2.55, 11.05, -0.4], [0.55, 0.85, 0.55], spirit, { s: 'gem', g: true }),
      ...leaf('head', [2.4, 6.6, 0.7], 1.4, [20, 0, -50], leafG),
      ...leaf('head', [2.9, 6.3, -0.9], 1.2, [-20, 0, -70], leafD),
      ...leaf('head', [3.6, 7.6, -0.3], 1.0, [0, 30, -20], leafG),
    ]),

    // ---- living-wood staff (gripR): twisted shaft, gold bands, forked head cradling a spirit crystal
    ...curve('gripR', [[0, -9.1, 0.35], [0.1, -5.5, 0.4], [-0.1, -2.0, 0.3], [0.05, 1.5, 0.4], [-0.05, 5.0, 0.32], [0, 8.2, 0.35]], [0.62, 0.62], wood, { s: 'cyl', n: 6 }),
    P('gripR', [0, -9.2, 0.35], [0.75, 0.6, 0.75], goldD, { s: 'cyl', n: 6, t: [0.5, 0.5], r: [180, 0, 0] }),
    ...curve('gripR', [[0.3, -4.0, 0.35], [-0.3, -2.4, 0.6], [0.3, -0.8, 0.1], [-0.3, 0.8, 0.6], [0.3, 2.4, 0.1]], [0.18, 0.18], woodL, { flat: true }),
    ...[-6.5, 3.0, 7.6].map((y) => P('gripR', [0, y, 0.35], [0.9, 0.35, 0.9], gold, { s: 'cyl', n: 6 })),
    ...symX([
      ...curve('gripR', [[0.2, 8.0, 0.35], [1.3, 9.0, 0.35], [1.55, 10.6, 0.35], [1.0, 12.0, 0.35], [0.2, 12.5, 0.35]], [0.5, 0.5], wood, { taper: 0.6 }),
      ...curve('gripR', [[1.3, 9.0, 0.35], [2.2, 9.9, 0.35], [2.5, 11.0, 0.35]], [0.32, 0.32], antler, { taper: 0.7 }),
      P('gripR', [2.5, 11.2, 0.35], [0.35, 0.55, 0.35], spirit, { s: 'gem', g: true }),
      ...leaf('gripR', [0.95, 8.3, 0.85], 1.3, [20, 0, -60], leafG),
      ...leaf('gripR', [0.8, 8.1, -0.2], 1.1, [-20, 0, -80], leafD),
    ]),
    P('gripR', [0, staffHead, 0.35], [1.7, 2.6, 1.7], spirit, { s: 'gem', g: true }),
    P('gripR', [0, staffHead, 0.35], [0.9, 1.5, 0.9], 0xffffff, { s: 'gem', g: true }),
    ...ring('gripR', [0, staffHead, 0.35], 1.25, 4, [0.3, 0.3, 0.3], spirit2, { s: 'gem', g: true }),
    seg('gripR', [-0.6, 7.8, 0.35], [-0.9, 5.9, 0.6], [0.12, 0.12], gold, { flat: true }),
    P('gripR', [-0.9, 5.6, 0.6], [0.5, 0.75, 0.5], tealL, { s: 'gem', g: true }),
    P('gripR', [-0.9, 5.0, 0.6], [0.35, 0.6, 0.2], gold, { flat: true }),

    // ---- spirit wisps and motes orbiting her (spin bone)
    P('accB', [5.4, 1.2, 0.8], [1.1, 1.6, 1.1], spirit, { s: 'gem', g: true }),
    P('accB', [-4.6, -1.2, -3.0], [0.9, 1.3, 0.9], spirit2, { s: 'gem', g: true }),
    P('accB', [-1.4, 3.6, 5.0], [0.8, 1.2, 0.8], tealL, { s: 'gem', g: true }),
    ...motes('accB', 5.8, 7, -0.5, 0.42, [spirit, spirit2, 0xb8ffb0, leafG]),
  ];

  return {
    id: 'summoner',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [0, 0.8, 0], kind: 'spin', axis: 'y', speed: 1.1 },
      accC: { parent: 'head', at: [0, 2.6, -2.75], kind: 'bob', k: 0.8 },
      capeA: { parent: 'hips', at: [0, 1.0, -2.0], kind: 'cape', k: 1.2, rest: 4 },
      capeB: { parent: 'capeA', at: [0.85, -4.2, 0], kind: 'cape', k: 1.0 },
    },
    tip: { bone: 'gripR', p: [0, staffHead, 0.35] },
    grip: { R: { rot: [8, 0, 18] } },
    anim: {
      weapon: 'summon',
      gait: { cadence: 0.48, stride: 20, knee: 28, armSwing: 6, elbow: 10, bounce: 0.08, lean: 5, sway: 3, twist: 4, heavy: 0, headBob: 0.3, armOut: 8, idle: 1.0 },
      stance: { chest: [-2, 0, 0], head: [2, 0, -3], armR: [-8, 0, -14], foreR: [-30, 0, 0], handR: [38, 0, 0], armL: [-16, 0, 14], foreL: [-42, 0, 0], handL: [-6, -20, -14] },
      stanceRun: 0.85,
      victory: 'raise',
    },
  };
}
