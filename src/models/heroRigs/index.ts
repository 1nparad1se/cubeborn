import { DEFAULT_PROPS, type HeroRigDef, type Proportions } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { arms, head, legs, P, ring, shade, sym, torso } from './kit';

/**
 * Hero models built on the shared skeleton. Each hero has its own proportions, outfit,
 * gear and silhouette (helmet plume, witch hat, hood, skull staff, backpack, topknot,
 * storm collar, cog pack, halo) so it reads from the top-down camera in a crowd.
 */

const S = 0.085;

function props(o: Partial<Proportions>): Proportions {
  return { ...DEFAULT_PROPS, ...o };
}

// ---------------------------------------------------------------- Bram, the Stone Warden
function bram(): HeroRigDef {
  const pr = props({ thigh: 3.2, shin: 3.1, foot: 1.5, hipX: 1.6, spine: 1.4, shoulderX: 4.2, shoulderY: 3.9, neck: 4.5, depth: 4.0 });
  const steel = 0x8e9bb0;
  const steelL = 0xb4c0d0;
  const steelD = 0x5a6578;
  const chain = 0x6c7484;
  const blue = 0x3f6fb0;
  const gold = 0xd8b54a;
  const leather = 0x6a4a30;
  const red = 0xd8433a;
  const parts: RigPart[] = [
    ...legs(pr, { pants: steelD, boots: steel, thighW: 2.6, shinW: 2.35, knee: steelL, cuff: 1.9, toe: steelL }),
    ...torso(pr, { shirt: steel, pants: chain, belt: leather, buckle: gold, chestW: 6.4, flare: 1.24, chestD: 4.0, chestH: 4.3, waistW: 5.6 }),
    // breastplate: ridge, tabard, emblem, gold trim, gorget
    P('chest', [0, 2.6, 2.02], [1.0, 3.2, 0.5], steelL, { t: [0.6, 1] }),
    P('chest', [0, 0.9, 2.03], [3.6, 1.9, 0.3], blue),
    P('chest', [0, 1.1, 2.2], [1.3, 1.5, 0.35], gold, { s: 'gem' }),
    P('chest', [0, 4.15, 0], [7.9, 0.35, 4.25], gold, { flat: true }),
    P('chest', [0, 4.6, 0], [4.4, 1.1, 3.9], steelL, { s: 'cyl', n: 8 }),
    ...sym([P('legL', [0.25, -0.7, 0.3], [2.9, 1.9, 3.0], steel, { s: 'rbox', t: [1.12, 1.06], bv: [0.6, 0.3] }), P('legL', [0.3, -1.6, 0.35], [2.95, 0.3, 3.05], gold, { flat: true })]),
    // tabard flaps front and back
    P('skirtF', [0, -2.2, 0.5], [3.4, 4.4, 0.4], blue),
    P('skirtF', [0, -4.35, 0.52], [3.5, 0.4, 0.45], gold, { flat: true }),
    P('skirtB', [0, -2.3, -0.5], [3.8, 4.6, 0.4], blue),
    // pauldrons: three layered plates with a gold rim
    ...sym([
      P('armL', [0.45, 0.15, 0], [3.7, 1.5, 3.7], steel, { s: 'rbox', t: [0.78, 0.82], bv: [0.9, 0.6] }),
      P('armL', [0.75, -0.85, 0], [3.7, 0.9, 3.8], steelL, { s: 'rbox', bv: [0.9, 0.2] }),
      P('armL', [0.95, -1.6, 0], [3.3, 0.8, 3.4], steel, { s: 'rbox', bv: [0.8, 0.2] }),
      P('armL', [0.8, -0.42, 0], [3.8, 0.26, 3.85], gold, { flat: true }),
    ]),
    ...arms(pr, { sleeve: chain, skin: 0xd8a47a, fore: steel, glove: steelD, upperW: 2.15, foreW: 2.15, shoulder: steel, cuff: gold }),
    ...head({ skin: 0xd8a47a, noFace: true }),
    // great helm
    P('head', [0, 3.25, 0], [6.4, 5.8, 6.0], steel, { s: 'rbox', t: [0.92, 0.94], bv: [1.1, 0.9, 0.3] }),
    P('head', [0, 6.45, -0.1], [5.6, 0.8, 5.4], steel, { s: 'rbox', t: [0.78, 0.78], bv: [1.3, 0.35] }),
    P('head', [0, 3.5, 3.0], [4.6, 0.55, 0.2], 0x15181f, { flat: true }),
    ...sym([P('head', [1.05, 3.5, 3.07], [0.8, 0.32, 0.12], 0x9fdcff, { g: true })]),
    P('head', [0, 2.3, 3.05], [0.6, 2.2, 0.35], steelL),
    ...sym([P('head', [1.4, 1.9, 3.0], [0.35, 0.35, 0.15], 0x15181f, { flat: true }), P('head', [0.7, 1.5, 3.0], [0.35, 0.35, 0.15], 0x15181f, { flat: true })]),
    P('head', [0, 4.55, 0], [6.25, 0.35, 5.95], gold, { flat: true }),
    P('head', [0, 7.0, -0.2], [1.1, 0.6, 1.1], gold),
    // plume
    P('accA', [0, 0.95, -0.7], [1.1, 1.9, 4.4], red, { s: 'rbox', t: [0.8, 0.9], bv: [0.3, 0.6] }),
    P('accA', [0, 0.35, -3.3], [1.0, 1.6, 2.2], shade(red, 0.85), { sh: [0, -0.6] }),
    // rune blade
    P('handR', [0, -0.8, 0.4], [0.65, 2.2, 0.65], leather, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('handR', [0, -0.8, -0.9], [0.9, 0.9, 0.9], gold, { s: 'ball' }),
    P('handR', [0, -0.8, 1.7], [3.0, 0.55, 0.6], gold),
    P('handR', [0, -0.8, 5.2], [1.15, 6.6, 0.32], 0xd8e6f4, { r: [90, 0, 0], t: [0.25, 1] }),
    P('handR', [0, -0.8, 4.6], [0.3, 4.2, 0.38], 0x6ad8ff, { r: [90, 0, 0], g: true }),
    // tower shield on the left hand (faces forward when the forearm is raised)
    P('handL', [0, -1.7, 0.9], [4.9, 0.5, 3.9], steel),
    P('handL', [0, -1.7, -1.55], [3.5, 0.5, 2.0], steel),
    P('handL', [0, -1.7, -2.95], [1.9, 0.5, 1.0], steel),
    P('handL', [0, -2.0, 0.9], [4.2, 0.3, 3.3], blue),
    P('handL', [0, -2.0, -1.45], [2.9, 0.3, 1.7], blue),
    P('handL', [0, -2.2, 0.5], [1.5, 0.6, 1.9], gold, { s: 'gem' }),
    P('handL', [0, -2.15, 0.5], [0.4, 0.2, 4.6], gold, { flat: true }),
    P('handL', [0, -2.15, 0.9], [3.6, 0.2, 0.4], gold, { flat: true }),
  ];
  return {
    id: 'bram',
    scale: S,
    props: pr,
    parts,
    springs: { accA: { parent: 'head', at: [0, 7.0, -0.2], kind: 'bob', k: 0.8 } },
    tip: { bone: 'handR', p: [0, -0.8, 7.5] },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.48, stride: 30, knee: 45, armSwing: 14, elbow: 20, bounce: 0.55, lean: 6, sway: 5, twist: 6, heavy: 1, headBob: 2, armOut: 9, idle: 0.8 },
      stance: { armL: [-22, 0, -6], foreL: [-80, 0, 0], armR: [-10, 0, -6], foreR: [-38, 0, 0], handR: [30, 0, 0], legL: [-4, 0, 3], legR: [4, 0, -3] },
      stanceRun: 0.85,
      victory: 'salute',
    },
  };
}

// ---------------------------------------------------------------- Lyra, the Ash Sorceress
function lyra(): HeroRigDef {
  const pr = props({ thigh: 3.3, shin: 3.2, foot: 1.3, hipX: 1.3, spine: 1.6, shoulderX: 3.3, shoulderY: 3.5, upperArm: 2.8, foreArm: 2.6, neck: 4.0, depth: 3.2 });
  const red = 0xb8322a;
  const redD = 0x7a1f1c;
  const gold = 0xe0b050;
  const skin = 0xf2c9a0;
  const hair = 0xff7a2a;
  const hat = 0x3b2a52;
  const parts: RigPart[] = [
    ...legs(pr, { pants: redD, boots: 0x3a1a14, thighW: 2.0, shinW: 1.8, cuff: 0 }),
    ...torso(pr, { shirt: red, pants: red, belt: gold, chestW: 4.8, flare: 1.18, chestD: 3.2, chestH: 3.9, waistW: 4.1 }),
    P('chest', [0, 1.4, 1.62], [3.0, 2.6, 0.22], redD, { t: [1.25, 1] }),
    ...[0.6, 1.3, 2.0].map((y) => P('chest', [0, y, 1.76], [1.2, 0.18, 0.12], gold, { flat: true })),
    P('chest', [0, 3.95, 0], [4.7, 0.8, 3.4], gold, { t: [1.05, 1.05] }),
    P('chest', [0, 4.7, -1.3], [4.8, 1.8, 0.4], redD, { t: [1.25, 1], sh: [0, -0.35] }),
    P('chest', [0, 3.55, 0], [6.6, 0.9, 3.8], redD, { t: [0.84, 0.9] }),
    // robe: bell skirt and long front/back panels that follow the legs
    P('hips', [0, -1.9, 0], [6.4, 5.4, 4.8], red, { s: 'rbox', t: [0.74, 0.7], bv: [1.3, 0] }),
    P('hips', [0, -4.45, 0], [6.5, 0.35, 4.9], gold, { flat: true }),
    P('skirtF', [0, -3.4, 0.3], [3.8, 6.8, 0.5], red, { t: [0.7, 1] }),
    P('skirtF', [0, -3.4, 0.57], [0.55, 6.6, 0.1], gold, { flat: true }),
    P('skirtF', [0, -6.7, 0.3], [3.9, 0.35, 0.55], gold, { flat: true }),
    P('skirtB', [0, -3.5, -0.3], [4.6, 7.0, 0.5], redD, { t: [0.7, 1] }),
    ...arms(pr, { sleeve: red, skin, fore: red, upperW: 1.6, foreW: 1.5 }),
    ...sym([P('foreL', [0, -1.85, 0.05], [2.6, 2.3, 2.6], redD, { s: 'rbox', t: [0.62, 0.62], bv: [0.6, 0] }), P('foreL', [0, -2.95, 0.05], [2.65, 0.3, 2.65], gold, { flat: true })]),
    ...head({ skin, eyes: 0x5a2a0a, brows: 0xc8501a, size: [5.6, 5.2, 5.2], mouth: 0xc8605a }),
    ...sym([P('head', [1.75, 2.3, 2.62], [0.3, 0.3, 0.1], 0xd89070, { flat: true }), P('head', [2.05, 2.55, 2.62], [0.3, 0.3, 0.1], 0xd89070, { flat: true })]),
    // hair: bangs, side locks, back and a long tail
    P('head', [0, 5.35, 2.35], [5.8, 1.3, 0.9], hair, { s: 'rbox', bv: [0.4, 0.5, 0.3] }),
    ...sym([P('head', [2.72, 3.5, 0.4], [0.75, 4.4, 3.8], hair), P('head', [2.2, 4.8, 2.5], [1.4, 1.6, 0.7], hair)]),
    P('head', [0, 3.7, -2.35], [5.9, 5.2, 1.2], hair, { s: 'rbox', bv: [0.5, 0.8, 0.4] }),
    P('accC', [0, -2.2, -0.3], [3.6, 4.4, 1.3], hair, { s: 'rbox', t: [1.3, 1], bv: [0.5, 0.3, 0.4] }),
    P('accC', [0, -4.8, -0.4], [2.2, 1.4, 1.0], 0xffa04a),
    // witch hat: wide brim, band, bent cone and a bobbing tip with a star
    P('head', [0, 6.0, 0], [10.6, 0.55, 10.6], hat, { s: 'cyl', n: 10 }),
    P('head', [0, 6.6, 0], [5.7, 0.9, 5.7], 0xff8a2a, { s: 'cyl', n: 8 }),
    P('head', [0, 6.6, 2.85], [1.2, 1.0, 0.3], gold),
    P('head', [0, 8.5, -0.4], [5.4, 3.4, 5.4], hat, { s: 'cyl', n: 8, t: [0.55, 0.55], sh: [0, -0.8] }),
    P('accA', [0, 1.0, -0.6], [3.0, 2.2, 3.0], hat, { s: 'cyl', n: 8, t: [0.2, 0.2], sh: [0, -1.4] }),
    P('accA', [0, 2.3, -2.1], [0.8, 0.8, 0.8], 0xffd060, { s: 'gem', g: true }),
    // flame staff
    P('handR', [0, 1.5, 0.35], [0.6, 13.5, 0.6], 0x6a4a2a, { s: 'cyl', n: 6 }),
    P('handR', [0, 6.8, 0.35], [0.85, 0.8, 0.85], gold, { s: 'cyl', n: 6 }),
    ...sym([P('handR', [0.7, 8.6, 0.35], [0.4, 1.8, 0.4], gold, { r: [0, 0, -18] })]),
    P('handR', [0, 8.55, 1.0], [0.4, 1.8, 0.4], gold, { r: [18, 0, 0] }),
    P('handR', [0, 9.5, 0.35], [1.8, 2.6, 1.8], 0xff8a2a, { s: 'gem', g: true }),
    P('handR', [0, 9.5, 0.35], [0.9, 1.4, 0.9], 0xffe080, { s: 'gem', g: true }),
  ];
  return {
    id: 'lyra',
    scale: S,
    props: pr,
    parts,
    springs: {
      accA: { parent: 'head', at: [0, 10.1, -1.4], kind: 'bob', k: 0.7 },
      accC: { parent: 'head', at: [0, 2.6, -3.0], kind: 'bob', k: 0.8 },
    },
    tip: { bone: 'handR', p: [0, 9.5, 0.35] },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.5, stride: 22, knee: 34, armSwing: 10, elbow: 14, bounce: 0.25, lean: 4, sway: 3, twist: 7, heavy: 0, headBob: 1, armOut: 4, idle: 1 },
      stance: { armR: [-14, 0, -10], foreR: [-36, 0, 0], handR: [50, 0, 0], armL: [-12, 0, 6], foreL: [-48, 0, 0], handL: [0, 0, -15] },
      stanceRun: 0.6,
      victory: 'raise',
    },
  };
}

// ---------------------------------------------------------------- Kestrel, the Wasteland Huntress
function kestrel(): HeroRigDef {
  const pr = props({ thigh: 3.5, shin: 3.4, foot: 1.3, hipX: 1.35, spine: 1.5, shoulderX: 3.4, shoulderY: 3.6, upperArm: 2.9, foreArm: 2.7, neck: 4.1, depth: 3.2 });
  const green = 0x3d7a3a;
  const greenD = 0x2a5528;
  const leather = 0x7a5532;
  const leatherD = 0x4a3220;
  const skin = 0xd9ae84;
  const parts: RigPart[] = [
    ...legs(pr, { pants: 0x5a4a32, boots: leatherD, thighW: 2.1, shinW: 1.9, cuff: 2.3, cuffColor: 0x6a4a2a }),
    ...torso(pr, { shirt: green, pants: 0x5a4a32, belt: 0x6a4a2a, buckle: 0xc8a050, chestW: 5.0, flare: 1.2, chestD: 3.2 }),
    P('chest', [0, 1.9, 1.66], [3.0, 3.2, 0.25], leather, { t: [1.2, 1] }),
    P('chest', [0, 2.2, 0], [0.8, 6.0, 3.5], leatherD, { r: [0, 0, 35] }),
    P('hips', [1.9, 0.35, 1.3], [1.2, 1.3, 1.0], leather),
    P('hips', [0, -0.55, 0], [5.1, 1.7, 3.4], green, { t: [0.95, 0.95] }),
    P('chest', [0, 3.95, -0.2], [6.4, 1.0, 3.8], green, { s: 'rbox', t: [0.85, 0.9], bv: [0.9, 0.4] }),
    ...arms(pr, { sleeve: 0x2f6630, skin, fore: leather, glove: 0x5a3a20, upperW: 1.7, foreW: 1.75, cuff: 0xa87a48 }),
    ...head({ skin, eyes: 0x1a5a2a, brows: 0x5a3a1a, noLower: true }),
    // scarf mask, hood with rim and a drooping point
    P('head', [0, 1.45, 0.25], [5.4, 2.2, 5.5], greenD, { s: 'rbox', t: [1.06, 1.04], bv: [1.0, 0.3] }),
    P('head', [0, 3.65, -0.6], [6.6, 6.0, 5.4], green, { s: 'rbox', t: [0.86, 0.9], bv: [1.5, 1.8] }),
    P('head', [0, 5.75, 2.15], [5.0, 1.0, 1.4], green, { s: 'rbox', bv: [0.4, 0.4] }),
    ...sym([P('head', [2.95, 3.7, 2.0], [0.7, 4.6, 1.4], green)]),
    P('head', [0, 5.3, 2.45], [3.0, 0.6, 0.5], 0x5a3a1a),
    P('accC', [0, -0.6, -0.8], [3.0, 2.4, 2.2], green, { t: [0.3, 0.4], sh: [0, -0.6], r: [-30, 0, 0] }),
    // cloak in two segments with a ragged hem
    P('capeA', [0, -2.1, -0.1], [5.8, 4.4, 0.45], green, { t: [0.82, 1] }),
    P('capeB', [0, -1.7, 0], [6.6, 3.6, 0.45], greenD, { t: [0.9, 1] }),
    ...sym([P('capeB', [2.2, -3.7, 0], [1.6, 0.9, 0.4], greenD)]),
    P('capeB', [0, -3.8, 0], [1.8, 1.1, 0.4], greenD),
    // quiver with fletchings
    P('accB', [0, 0.3, -0.3], [1.8, 5.0, 1.8], leather, { s: 'cyl', n: 8, r: [0, 0, 22] }),
    P('accB', [-0.95, 2.6, -0.3], [2.0, 0.4, 2.0], leatherD, { s: 'cyl', n: 8, r: [0, 0, 22] }),
    P('accB', [-1.2, 3.5, -0.1], [0.5, 1.3, 0.22], 0xd84a3a, { r: [0, 0, 22] }),
    P('accB', [-0.8, 3.4, -0.6], [0.5, 1.2, 0.22], 0xf0e8d8, { r: [0, 30, 22] }),
    P('accB', [-1.5, 3.25, -0.6], [0.5, 1.1, 0.22], 0xd84a3a, { r: [0, -30, 22] }),
    // recurve longbow (along the hand's z axis: vertical at rest, vertical when aimed)
    P('handL', [0, -0.8, 0.2], [0.75, 0.75, 1.8], leatherD),
    P('handL', [0, -0.42, 3.1], [0.55, 4.6, 0.7], 0x8a6a3a, { r: [80, 0, 0], t: [0.6, 0.8] }),
    P('handL', [0, -0.42, -2.7], [0.55, 4.6, 0.7], 0x8a6a3a, { r: [-80, 0, 0], t: [0.6, 0.8] }),
    P('handL', [0, 0.15, 5.45], [0.45, 1.2, 0.5], 0x6a4a2a, { r: [55, 0, 0] }),
    P('handL', [0, 0.15, -5.05], [0.45, 1.2, 0.5], 0x6a4a2a, { r: [-55, 0, 0] }),
    P('handL', [0, 0.55, 0.2], [0.12, 0.12, 10.9], 0xeeeeee, { flat: true }),
    // nocked arrow, shown while drawing
    P('handL', [0, 0.4, 0.45], [0.18, 6.6, 0.18], 0xc8a070, { grp: 'arrow' }),
    P('handL', [0, -3.05, 0.45], [0.55, 0.9, 0.55], 0xc8d0dc, { s: 'cyl', n: 4, t: [0, 0], r: [180, 0, 0], grp: 'arrow' }),
    P('handL', [0, 3.3, 0.45], [0.7, 1.1, 0.12], 0xd84a3a, { grp: 'arrow' }),
  ];
  return {
    id: 'kestrel',
    scale: S,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [1.0, 1.8, -2.1], kind: 'bob', k: 1.2 },
      accC: { parent: 'head', at: [0, 5.5, -3.1], kind: 'bob', k: 0.8 },
    },
    tip: { bone: 'handL', p: [0, -3.5, 0.45] },
    hidden: ['arrow'],
    anim: {
      weapon: 'bow',
      gait: { cadence: 0.52, stride: 36, knee: 58, armSwing: 26, elbow: 30, bounce: 0.35, lean: 12, sway: 3, twist: 8, heavy: 0, headBob: 1, armOut: 2, idle: 0.9 },
      stance: { handL: [-90, 0, 0], armL: [-6, 0, 4], foreL: [-16, 0, 0], armR: [-4, 0, -2], foreR: [-24, 0, 0], chest: [4, 0, 0] },
      stanceRun: 0.9,
      victory: 'flex',
    },
  };
}

// ---------------------------------------------------------------- Morwen, the Bonekeeper
function morwen(): HeroRigDef {
  const pr = props({ thigh: 3.5, shin: 3.4, foot: 1.3, hipX: 1.3, spine: 1.6, shoulderX: 3.5, shoulderY: 3.7, upperArm: 3.0, foreArm: 2.9, neck: 4.2, depth: 3.4 });
  const robe = 0x3a2452;
  const robeD = 0x24163a;
  const black = 0x1c1424;
  const bone = 0xe6dfc8;
  const pale = 0xbfc8c0;
  const glow = 0x6affc8;
  const parts: RigPart[] = [
    ...legs(pr, { pants: black, boots: black, thighW: 1.9, shinW: 1.7, cuff: 0 }),
    ...torso(pr, { shirt: robe, pants: robeD, belt: black, buckle: bone, chestW: 5.0, flare: 1.15, chestD: 3.4, waistW: 4.2 }),
    ...[1.3, 2.1, 2.9].map((y, i) => P('chest', [0, y, 1.78], [3.4 - i * 0.2, 0.38, 0.3], bone, { flat: true })),
    P('chest', [0, 2.1, 1.86], [0.5, 2.6, 0.3], bone),
    P('hips', [0, -2.2, 0], [6.2, 6.0, 5.0], robe, { s: 'rbox', t: [0.72, 0.68], bv: [1.3, 0] }),
    ...sym([P('hips', [2.2, -5.4, 1.2], [1.4, 0.9, 1.2], robeD), P('hips', [2.6, -5.5, -1.0], [1.2, 1.1, 1.4], robeD)]),
    P('hips', [0, -5.6, -2.0], [2.0, 1.0, 0.8], robeD),
    P('skirtF', [0, -3.6, 0.3], [3.6, 7.2, 0.5], robeD, { t: [0.75, 1] }),
    P('skirtF', [0.6, -7.4, 0.3], [1.4, 0.8, 0.5], robeD),
    P('skirtB', [0, -3.6, -0.3], [4.6, 7.4, 0.5], robe, { t: [0.7, 1] }),
    P('skirtB', [-0.9, -7.5, -0.3], [1.6, 0.9, 0.5], robe),
    ...arms(pr, { sleeve: robe, skin: pale, fore: robe, upperW: 1.65, foreW: 1.6 }),
    ...sym([P('foreL', [0, -2.15, 0], [2.4, 1.9, 2.4], robeD, { t: [0.7, 0.7] })]),
    // skull pauldron (left) and bone spikes (right)
    P('armL', [0.6, 0.45, 0], [2.6, 2.4, 2.6], bone, { s: 'ball' }),
    ...[-0.45, 0.45].map((z) => P('armL', [1.75, 0.55, z], [0.3, 0.6, 0.55], 0x1a1420, { flat: true })),
    P('armL', [1.4, -0.45, 0], [0.9, 0.6, 1.8], bone),
    ...[0, 0.9, -0.9].map((z, i) => P('armR', [-0.7 - i * 0.1, 0.9, z], [0.7, 2.2 - i * 0.4, 0.7], bone, { s: 'cyl', n: 5, t: [0.05, 0.05], r: [z * 18, 0, 25] })),
    P('armR', [-0.4, -0.2, 0], [2.6, 0.9, 2.6], black, { t: [0.85, 0.85] }),
    // mantle and high collar
    P('chest', [0, 3.95, -0.3], [6.0, 1.4, 4.0], black, { s: 'rbox', t: [0.8, 0.9], bv: [1.0, 0.5] }),
    P('chest', [0, 5.1, -1.6], [5.4, 2.4, 0.5], black, { t: [1.3, 1], sh: [0, -0.5] }),
    ...head({ skin: pale, eyes: glow, glowEyes: true, size: [5.4, 5.4, 5.0], mouth: 0x3a2a3a, nose: 0xaab4ac }),
    ...sym([P('head', [1.65, 1.9, 2.52], [0.25, 1.1, 0.12], 0x8a948c, { flat: true })]),
    // deep hood
    P('head', [0, 3.75, -0.5], [6.4, 6.2, 5.6], robeD, { s: 'rbox', t: [0.8, 0.84], bv: [1.5, 2.0] }),
    P('head', [0, 5.8, 2.05], [4.6, 1.1, 1.3], robeD, { s: 'rbox', bv: [0.4, 0.4] }),
    ...sym([P('head', [2.85, 3.8, 1.85], [0.7, 4.8, 1.3], robeD)]),
    P('head', [0, 4.75, 2.55], [5.2, 0.9, 0.2], 0x15101c, { flat: true }),
    P('accC', [0, -0.4, -1.0], [2.6, 3.2, 2.4], robeD, { t: [0.3, 0.3], sh: [0, -1.2], r: [-45, 0, 0] }),
    // skull staff
    P('handR', [0, 2.0, 0.35], [0.6, 15, 0.6], 0x2a2230, { s: 'cyl', n: 6 }),
    ...[3.5, 5.0, 6.5].map((y) => P('handR', [0, y, 0.35], [0.85, 0.4, 0.85], bone, { s: 'cyl', n: 6 })),
    P('handR', [0, 10.6, 0.35], [2.6, 2.5, 2.6], bone, { s: 'ball' }),
    ...sym([P('handR', [0.55, 10.8, 1.55], [0.55, 0.55, 0.2], glow, { g: true })]),
    ...sym([P('handR', [1.25, 11.5, 0.0], [0.6, 1.9, 0.6], bone, { s: 'cyl', n: 5, t: [0.1, 0.1], r: [0, 0, -38] })]),
    P('handR', [0, 9.6, 0.75], [1.8, 0.7, 1.6], bone),
    P('handR', [0, 12.5, 0.35], [1.0, 1.5, 1.0], glow, { s: 'gem', g: true }),
    // spirit wisps orbiting the necromancer
    P('accB', [5.6, 1.6, 0], [0.9, 1.3, 0.9], glow, { s: 'gem', g: true }),
    P('accB', [-5.6, 0.4, 0], [0.8, 1.1, 0.8], 0x9affdc, { s: 'gem', g: true }),
  ];
  return {
    id: 'morwen',
    scale: S,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [0, 1.5, 0], kind: 'spin', axis: 'y', speed: 1.3 },
      accC: { parent: 'head', at: [0, 5.6, -3.0], kind: 'bob', k: 0.7 },
    },
    tip: { bone: 'handR', p: [0, 12.5, 0.35] },
    anim: {
      weapon: 'summon',
      gait: { cadence: 0.45, stride: 20, knee: 30, armSwing: 6, elbow: 10, bounce: 0.12, lean: 8, sway: 2, twist: 4, heavy: 0, headBob: 0.5, armOut: 10, idle: 1.1 },
      stance: { chest: [10, 0, 0], head: [-8, 0, 3], armR: [-12, 0, -8], foreR: [-30, 0, 0], handR: [42, 0, 0], armL: [-20, 0, 10], foreL: [-48, 0, 0], handL: [10, 0, -10] },
      stanceRun: 0.8,
      victory: 'raise',
    },
  };
}

// ---------------------------------------------------------------- Fizzwick, the Mad Alchemist
function fizz(): HeroRigDef {
  const pr = props({ thigh: 2.4, shin: 2.3, foot: 1.25, hipX: 1.45, spine: 1.2, shoulderX: 3.6, shoulderY: 3.3, upperArm: 2.4, foreArm: 2.3, neck: 3.8, depth: 3.8 });
  const coat = 0x5f8a3a;
  const brown = 0x5a3a24;
  const leather = 0x4a2e1a;
  const brass = 0xc89a3a;
  const skin = 0xe8c098;
  const white = 0xf0f0f0;
  const apron = 0xd8cfb0;
  const parts: RigPart[] = [
    ...legs(pr, { pants: brown, boots: 0x3a2416, thighW: 2.4, shinW: 2.2, cuff: 1.4, toe: leather }),
    ...torso(pr, { shirt: coat, pants: brown, belt: leather, buckle: brass, chestW: 5.8, flare: 1.12, chestD: 3.8, chestH: 3.6, waistW: 5.6 }),
    P('spine', [0, 0.7, 0.45], [5.3, 2.3, 3.5], coat, { s: 'rbox', t: [1.02, 1.0], bv: [1.0, 0.5, 0.6] }),
    P('chest', [0, 1.4, 1.95], [3.8, 3.0, 0.25], apron),
    P('skirtF', [0, -1.8, 0.6], [4.0, 4.0, 0.3], apron, { t: [0.9, 1] }),
    P('skirtF', [0.8, -2.4, 0.78], [0.8, 0.8, 0.1], 0x8ac040, { flat: true }),
    P('skirtF', [-0.9, -1.2, 0.78], [0.6, 0.5, 0.1], 0xc070a0, { flat: true }),
    P('skirtB', [0, -1.6, -0.5], [5.4, 3.4, 0.5], coat, { t: [0.85, 1] }),
    P('chest', [0, 1.8, 0], [0.7, 5.6, 4.1], leather, { r: [0, 0, -35] }),
    P('chest', [-0.5, 2.25, 2.15], [0.55, 0.9, 0.55], 0x9cff4f, { s: 'cyl', n: 6, g: true }),
    P('chest', [0.6, 1.5, 2.15], [0.55, 0.9, 0.55], 0xff5aa0, { s: 'cyl', n: 6, g: true }),
    P('chest', [-1.5, 3.0, 2.1], [0.55, 0.9, 0.55], 0x5ad0ff, { s: 'cyl', n: 6, g: true }),
    ...sym([P('hips', [2.5, 0.3, 1.0], [1.3, 1.4, 1.1], leather), P('chest', [1.7, 2.2, 0], [0.8, 4.2, 3.95], leather)]),
    ...arms(pr, { sleeve: coat, skin, fore: coat, glove: 0x8a6a3a, upperW: 1.8, foreW: 1.9, cuff: leather }),
    ...head({ skin, eyes: 0x1a1a1a, brows: white, size: [6.4, 5.8, 5.8], noLower: true }),
    P('head', [0, 2.35, 3.15], [1.4, 1.5, 1.0], 0xe0a888, { t: [0.75, 0.7] }),
    P('head', [0, 1.6, 3.0], [3.2, 0.75, 0.55], white, { t: [0.7, 1] }),
    ...sym([P('head', [1.4, 1.45, 3.0], [0.9, 1.0, 0.5], white, { r: [0, 0, 25] })]),
    // goggles pushed up on the forehead
    P('head', [0, 4.75, 0], [6.7, 0.8, 6.3], leather),
    ...sym([
      P('head', [1.3, 4.85, 3.15], [1.7, 0.7, 1.7], brass, { s: 'cyl', n: 8, r: [90, 0, 0] }),
      P('head', [1.3, 4.85, 3.5], [1.15, 0.2, 1.15], 0x8affd0, { s: 'cyl', n: 8, r: [90, 0, 0], g: true }),
    ]),
    // wild white hair
    ...sym([P('head', [3.4, 4.0, -0.5], [1.3, 2.4, 3.2], white, { r: [0, 0, -25] }), P('head', [2.8, 5.8, -1.2], [1.4, 1.6, 2.0], white, { r: [0, 0, -40] })]),
    P('head', [0.9, 6.75, -0.6], [1.6, 1.4, 1.6], white, { r: [0, 0, 15] }),
    P('head', [-1.0, 6.65, 0.3], [1.4, 1.3, 1.4], white, { r: [10, 0, -10] }),
    P('head', [0, 4.4, -2.85], [5.2, 3.4, 1.0], white, { s: 'rbox', bv: [0.4, 0.6] }),
    // backpack lab
    P('accB', [0, 0.2, -1.6], [5.2, 5.4, 3.2], 0x7a5a3a, { s: 'rbox', bv: [0.8, 0.6] }),
    P('accB', [0, 0.2, -3.25], [3.8, 3.4, 0.2], 0x6a4a2a, { flat: true }),
    P('accB', [0, 3.1, -1.6], [5.0, 0.4, 2.6], brass),
    P('accB', [-1.6, 4.1, -1.2], [1.0, 1.6, 1.0], 0x9cff4f, { s: 'cyl', n: 6, g: true }),
    P('accB', [0, 4.4, -1.7], [1.1, 2.2, 1.1], 0xff5aa0, { s: 'cyl', n: 6, t: [0.5, 0.5], g: true }),
    P('accB', [1.6, 4.0, -2.0], [0.9, 1.4, 0.9], 0x5ad0ff, { s: 'cyl', n: 6, g: true }),
    ...[-1.6, 0, 1.6].map((x, i) => P('accB', [x, [5.0, 5.6, 4.8][i], [-1.2, -1.7, -2.0][i]], [0.5, 0.4, 0.5], 0x8a5a2a)),
    P('accB', [2.85, 0.5, -1.6], [0.6, 4.2, 0.6], 0xb06a3a, { s: 'cyl', n: 6 }),
    P('accB', [-2.0, 4.1, -2.7], [0.9, 2.4, 0.9], 0x4a4a52, { s: 'cyl', n: 6 }),
    P('accB', [0, -2.7, -1.6], [1.7, 5.8, 1.7], 0xb89a6a, { s: 'cyl', n: 8, r: [0, 0, 90] }),
    // flask in hand, hidden for a moment after a throw
    P('handR', [0, -1.95, 0.4], [1.4, 1.5, 1.4], 0x9cff4f, { s: 'cyl', n: 8, g: true, grp: 'flask' }),
    P('handR', [0, -1.0, 0.4], [0.6, 0.7, 0.6], 0xc8f0e0, { s: 'cyl', n: 6, grp: 'flask' }),
    P('handR', [0, -2.75, 0.4], [1.0, 0.25, 1.0], 0x5aa02a, { s: 'cyl', n: 8, grp: 'flask', flat: true }),
  ];
  return {
    id: 'fizz',
    scale: S,
    props: pr,
    parts,
    springs: { accB: { parent: 'chest', at: [0, 1.8, -2.1], kind: 'bob', k: 0.9 } },
    tip: { bone: 'handR', p: [0, -1.95, 0.4] },
    anim: {
      weapon: 'throw',
      gait: { cadence: 0.72, stride: 26, knee: 40, armSwing: 18, elbow: 24, bounce: 0.6, lean: 5, sway: 9, twist: 5, heavy: 0.2, headBob: 3, armOut: 8, idle: 1.2 },
      stance: { chest: [-4, 0, 0], armR: [-12, 0, -6], foreR: [-52, 0, 0], armL: [4, 0, 10], foreL: [-22, 0, 0] },
      stanceRun: 0.6,
      victory: 'cheer',
    },
  };
}

// ---------------------------------------------------------------- Shen, the Wind Monk
function shen(): HeroRigDef {
  const pr = props({ thigh: 3.4, shin: 3.3, foot: 1.3, hipX: 1.6, spine: 1.5, shoulderX: 3.7, shoulderY: 3.7, upperArm: 3.0, foreArm: 2.8, neck: 4.2, depth: 3.4 });
  const gi = 0xf0a63a;
  const giD = 0xc87a24;
  const skin = 0xe0a878;
  const sash = 0x3a5aa8;
  const wrap = 0xeee6d6;
  const parts: RigPart[] = [
    ...legs(pr, { pants: 0xe89a32, boots: skin, sole: 0x6a4a2a, thighW: 2.9, shinW: 2.1, cuff: 2.0, cuffColor: wrap }),
    ...sym([P('legL', [0, -2.4, 0], [3.1, 1.8, 3.1], 0xe89a32, { s: 'rbox', t: [1.05, 1.05], bv: [0.8, 0.4, 0.4] })]),
    ...torso(pr, { shirt: gi, pants: 0xe89a32, belt: sash, chestW: 5.6, flare: 1.25, chestD: 3.4 }),
    P('chest', [0, 3.3, 1.72], [1.8, 1.6, 0.22], skin, { t: [1.6, 1] }),
    P('chest', [0.45, 2.3, 1.76], [1.0, 4.3, 0.25], giD, { r: [0, 0, -28] }),
    P('chest', [-0.6, 2.1, 1.78], [0.9, 3.8, 0.25], giD, { r: [0, 0, 30] }),
    P('hips', [2.35, 1.0, 0.9], [1.2, 1.1, 1.2], sash),
    P('skirtB', [0.8, -2.0, -0.3], [1.0, 3.8, 0.35], sash, { r: [0, 0, 8] }),
    P('skirtB', [-0.4, -1.7, -0.3], [1.0, 3.2, 0.35], sash, { r: [0, 0, -8] }),
    P('skirtF', [0.9, -1.1, 0.45], [1.0, 2.6, 0.35], sash, { r: [0, 0, 6] }),
    ...ring('chest', [0, 3.95, 0.15], 2.25, 12, [0.6, 0.6, 0.6], 0x7a4a2a),
    P('chest', [0, 2.6, 1.95], [0.9, 0.9, 0.5], 0x7a4a2a, { s: 'ball' }),
    ...arms(pr, { sleeve: skin, skin, fore: wrap, glove: wrap, upperW: 1.95, foreW: 1.85, shoulder: skin }),
    ...sym([0.6, 1.4, 2.2].map((y) => P('foreL', [0, -y, 0], [1.95, 0.16, 2.0], 0xc8c0b0, { flat: true }))),
    P('armR', [-0.1, -0.7, 0], [2.5, 2.3, 2.5], gi, { s: 'rbox', t: [0.9, 0.9], bv: [0.6, 0.5] }),
    P('armR', [-0.1, -1.85, 0], [2.6, 0.3, 2.6], giD, { flat: true }),
    ...head({ skin, eyes: 0x2a1a0a, brows: 0x1a1a1a, size: [5.6, 5.3, 5.3] }),
    P('head', [0, 4.35, 0], [5.9, 0.7, 5.5], sash),
    P('head', [0, 5.3, 2.68], [0.5, 0.5, 0.12], 0x3a5aa8, { flat: true }),
    P('accC', [0.6, -1.6, -0.2], [0.8, 3.2, 0.25], sash, { r: [0, 0, 10] }),
    P('accC', [-0.5, -1.4, -0.2], [0.8, 2.8, 0.25], sash, { r: [0, 0, -8] }),
    P('accA', [0, 0.5, 0], [1.4, 1.0, 1.4], 0x1a1a1a),
    P('accA', [0, 1.3, -0.3], [0.9, 1.4, 0.9], 0x1a1a1a, { t: [0.6, 0.6] }),
    P('accA', [0, 0.15, 0], [1.6, 0.3, 1.6], 0xe0b448, { flat: true }),
  ];
  return {
    id: 'shen',
    scale: S,
    props: pr,
    parts,
    springs: {
      accA: { parent: 'head', at: [0, 6.0, -0.8], kind: 'bob', k: 1.1 },
      accC: { parent: 'head', at: [0, 4.35, -2.8], kind: 'cape', k: 0.8, rest: 10 },
    },
    tip: { bone: 'handR', p: [0, -0.9, 0.4] },
    anim: {
      weapon: 'fists',
      gait: { cadence: 0.55, stride: 40, knee: 70, armSwing: 30, elbow: 70, bounce: 0.5, lean: 14, sway: 2, twist: 12, heavy: 0, headBob: 1, armOut: 3, idle: 1 },
      stance: {
        rootPos: [0, -0.7, 0],
        legL: [-20, -8, 4], shinL: [18, 0, 0], footL: [2, 8, 0],
        legR: [14, 12, -6], shinR: [22, 0, 0], footR: [-14, -12, 0],
        chest: [6, 18, 0], head: [-4, -18, 0], hips: [0, -10, 0],
        armL: [-52, 0, 14], foreL: [-92, 0, 0],
        armR: [-34, 0, -16], foreR: [-112, 0, 0],
      },
      stanceRun: 0.45,
      victory: 'salute',
    },
  };
}

// ---------------------------------------------------------------- Vex, the Stormcaller
function vex(): HeroRigDef {
  const pr = props({ thigh: 3.5, shin: 3.4, foot: 1.35, hipX: 1.4, spine: 1.6, shoulderX: 3.6, shoulderY: 3.8, upperArm: 3.0, foreArm: 2.8, neck: 4.2, depth: 3.4 });
  const coat = 0x243460;
  const coatD = 0x161f3d;
  const cyan = 0x4ad0ff;
  const hair = 0xd8f4ff;
  const silver = 0xc0c8d8;
  const parts: RigPart[] = [
    ...legs(pr, { pants: 0x1a2440, boots: 0x101420, thighW: 2.1, shinW: 1.95, cuff: 2.7, cuffColor: 0x2a3450, toe: silver }),
    ...torso(pr, { shirt: coat, pants: 0x1a2440, belt: 0x101420, buckle: cyan, chestW: 5.4, flare: 1.24, chestD: 3.4 }),
    P('chest', [0, 1.9, 1.72], [1.4, 3.6, 0.22], 0x101420),
    ...sym([P('chest', [1.15, 2.5, 1.76], [0.9, 3.2, 0.25], 0x3a4a80, { r: [0, 0, 8] }), P('chest', [1.95, 1.7, 1.75], [0.25, 2.4, 0.22], cyan, { g: true })]),
    P('hips', [0, -1.2, 0], [5.6, 3.0, 3.8], coat, { s: 'rbox', t: [0.9, 0.9], bv: [1.0, 0] }),
    P('skirtF', [0, -2.2, 0.45], [5.0, 3.4, 0.4], coat, { t: [0.95, 1] }),
    P('skirtF', [0, -2.6, 0.67], [0.9, 3.4, 0.1], 0x101420, { flat: true }),
    P('skirtB', [0, -3.4, -0.3], [5.4, 6.6, 0.45], coat, { t: [0.8, 1] }),
    P('skirtB', [0, -4.4, -0.55], [0.3, 4.4, 0.1], coatD, { flat: true }),
    P('skirtB', [0, -6.6, -0.3], [5.5, 0.3, 0.5], cyan, { g: true }),
    // storm collar and studded mantle
    P('chest', [0, 4.75, -0.6], [5.8, 2.6, 2.8], coat, { s: 'rbox', t: [1.15, 1.2], bv: [0.8, 0.2] }),
    P('chest', [0, 6.0, -0.6], [6.6, 0.25, 3.3], cyan, { g: true }),
    P('chest', [0, 3.85, 0], [7.0, 0.9, 3.8], coatD, { s: 'rbox', t: [0.85, 0.9], bv: [1.0, 0.3] }),
    ...sym([P('chest', [3.0, 4.3, 0.8], [0.5, 0.5, 0.5], silver)]),
    ...arms(pr, { sleeve: coat, skin: 0xe8c8a8, fore: coat, glove: 0x101420, upperW: 1.75, foreW: 1.7 }),
    ...sym([P('foreL', [0, -2.4, 0.02], [1.9, 0.45, 1.95], cyan, { g: true })]),
    ...head({ skin: 0xe8c8a8, eyes: 0x7ae4ff, glowEyes: true, brows: hair, size: [5.6, 5.3, 5.3] }),
    P('head', [-1.6, 2.2, 2.74], [0.25, 1.2, 0.12], cyan, { g: true, r: [0, 0, 25] }),
    // swept, glowing hair
    P('head', [0, 6.1, -0.4], [5.8, 1.0, 5.4], hair, { s: 'rbox', bv: [1.0, 0.45] }),
    P('head', [0, 5.55, 2.35], [5.6, 1.0, 0.8], hair, { sh: [0, 0.3] }),
    ...sym([P('head', [2.85, 4.1, 0.8], [0.5, 2.2, 2.2], hair)]),
    P('accA', [0, 0.6, -1.4], [1.5, 2.0, 3.0], hair, { t: [0.2, 0.4], sh: [0, -1.4], r: [-30, 0, 0] }),
    ...sym([P('accA', [1.6, 0.4, -1.0], [1.2, 1.7, 2.6], hair, { t: [0.2, 0.4], sh: [0.4, -1.2], r: [-25, 0, -20] })]),
    P('accA', [0, 1.95, -3.05], [0.6, 0.6, 0.6], cyan, { s: 'gem', g: true }),
    // lightning rod
    P('handR', [0, 1.8, 0.35], [0.55, 13.5, 0.55], silver, { s: 'cyl', n: 6 }),
    ...[5.8, 6.6, 7.4].map((y) => P('handR', [0, y, 0.35], [0.95, 0.35, 0.95], 0xc8803a, { s: 'cyl', n: 6 })),
    ...sym([P('handR', [0.55, 9.0, 0.35], [0.35, 2.1, 0.35], silver, { r: [0, 0, -15] })]),
    P('handR', [0, 10.3, 0.35], [1.2, 2.0, 1.2], 0xfff27a, { s: 'gem', g: true }),
    P('handR', [0.95, 10.9, 0.35], [0.4, 0.6, 0.4], cyan, { s: 'gem', g: true }),
    P('handR', [-0.8, 9.9, 0.6], [0.35, 0.5, 0.35], cyan, { s: 'gem', g: true }),
  ];
  return {
    id: 'vex',
    scale: S,
    props: pr,
    parts,
    springs: { accA: { parent: 'head', at: [0, 6.2, -0.5], kind: 'bob', k: 1.0 } },
    tip: { bone: 'handR', p: [0, 10.3, 0.35] },
    anim: {
      weapon: 'rod',
      gait: { cadence: 0.47, stride: 32, knee: 46, armSwing: 16, elbow: 18, bounce: 0.3, lean: 9, sway: 3, twist: 10, heavy: 0, headBob: 1, armOut: 5, idle: 0.9 },
      stance: { chest: [-3, 0, 0], armR: [-10, 0, -8], foreR: [-30, 0, 0], handR: [40, 0, 0], armL: [4, 0, 12], foreL: [-18, 0, 0], handL: [0, 0, 10] },
      stanceRun: 0.7,
      victory: 'raise',
    },
  };
}

// ---------------------------------------------------------------- Tink, the Gearwright
function tink(): HeroRigDef {
  const pr = props({ thigh: 2.5, shin: 2.4, foot: 1.25, hipX: 1.4, spine: 1.2, shoulderX: 3.5, shoulderY: 3.3, upperArm: 2.5, foreArm: 2.4, neck: 3.7, depth: 3.4 });
  const jacket = 0x9a5a2a;
  const overalls = 0x3e4a58;
  const brass = 0xc8a040;
  const metal = 0x8a8a96;
  const skin = 0xd09870;
  const cap = 0x6a4a2a;
  const parts: RigPart[] = [
    ...legs(pr, { pants: overalls, boots: 0x2a2a2a, thighW: 2.2, shinW: 2.0, cuff: 1.5, cuffColor: 0x4a3a2a, toe: 0x6a6a74 }),
    ...torso(pr, { shirt: jacket, pants: overalls, belt: 0x5a3a20, buckle: brass, chestW: 5.3, flare: 1.16, chestD: 3.4, chestH: 3.6 }),
    P('chest', [0, 1.3, 1.72], [3.6, 2.6, 0.25], overalls),
    ...sym([P('chest', [1.4, 2.8, 1.75], [0.7, 2.4, 0.25], overalls), P('chest', [1.4, 2.2, 1.9], [0.5, 0.5, 0.2], brass)]),
    P('hips', [-2.6, 0.0, 0.6], [0.5, 2.6, 0.5], metal, { r: [0, 0, 12] }),
    P('hips', [-2.85, 1.3, 0.6], [1.2, 0.6, 0.5], metal),
    P('hips', [2.6, -0.2, 0.4], [0.5, 2.4, 0.5], 0x8a6a3a),
    P('hips', [2.6, 1.0, 0.4], [1.6, 0.8, 0.8], 0x5a5a64),
    P('hips', [0, 0.2, -1.8], [2.2, 1.3, 0.9], 0x5a3a20),
    ...arms(pr, { sleeve: jacket, skin, fore: skin, glove: 0x3a3a3a, upperW: 1.7, foreW: 1.6, cuff: jacket }),
    // brass power gauntlet on the right arm
    P('armR', [-0.4, 0.1, 0], [2.9, 1.6, 2.9], brass, { s: 'rbox', t: [0.8, 0.85], bv: [0.7, 0.5] }),
    P('foreR', [0, -1.35, 0.1], [2.8, 3.0, 2.8], brass, { s: 'rbox', t: [1.15, 1.1], bv: [0.6, 0.2] }),
    P('foreR', [-1.45, -1.2, 0.1], [0.9, 0.3, 0.9], 0xff9a2a, { s: 'cyl', n: 8, r: [0, 0, 90], g: true }),
    ...[-0.4, -2.2].map((y) => P('foreR', [0, y, 0.1], [3.0, 0.3, 3.0], 0x8a6a2a, { flat: true })),
    P('handR', [0, -0.95, 0.2], [2.6, 2.2, 2.6], metal, { s: 'rbox', bv: [0.6, 0.3, 0.5] }),
    P('handR', [0, -1.3, 1.45], [2.6, 0.9, 0.4], brass),
    ...head({ skin, eyes: 0x1a1a1a, brows: 0x5a3a1a, size: [5.8, 5.4, 5.4] }),
    P('head', [0, 5.05, -0.2], [6.1, 2.4, 5.8], cap, { s: 'rbox', t: [0.9, 0.92], bv: [1.3, 1.1] }),
    ...sym([P('head', [3.0, 2.85, 0.2], [0.6, 2.4, 2.4], cap)]),
    P('head', [0, 3.85, -2.9], [4.6, 1.4, 0.6], 0x5a3a1a),
    P('head', [0, 3.0, 0], [6.25, 0.7, 5.85], 0x2a2a2a),
    ...sym([
      P('head', [1.3, 3.0, 2.95], [2.0, 0.7, 2.0], brass, { s: 'cyl', n: 8, r: [90, 0, 0] }),
      P('head', [1.3, 3.0, 3.32], [1.4, 0.2, 1.4], 0xffb03a, { s: 'cyl', n: 8, r: [90, 0, 0], g: true }),
    ]),
    // gear pack with exhausts and a spinning cog
    P('accB', [0, 0, -1.3], [4.6, 4.6, 2.4], 0x6a6a74, { s: 'rbox', bv: [0.7, 0.6] }),
    ...sym([P('accB', [1.6, 3.0, -1.6], [0.8, 2.4, 0.8], 0x3a3a42, { s: 'cyl', n: 6 })]),
    P('accB', [0, 1.2, -2.55], [2.0, 0.6, 0.2], 0xff9a2a, { g: true }),
    P('accC', [0, 0, 0], [3.6, 0.6, 3.6], brass, { s: 'cyl', n: 12, r: [90, 0, 0] }),
    P('accC', [0, 0, -0.1], [1.2, 0.9, 1.2], metal, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return P('accC', [Math.sin(a) * 2.05, Math.cos(a) * 2.05, 0], [0.8, 0.8, 0.6], brass, { r: [0, 0, (-a * 180) / Math.PI] });
    }),
    // bomb in the left hand
    P('handL', [0, -1.85, 0.4], [1.9, 1.9, 1.9], 0x2a2a2e, { s: 'ball', grp: 'bomb' }),
    P('handL', [0, -0.85, 0.4], [0.7, 0.4, 0.7], brass, { grp: 'bomb' }),
    P('handL', [0.2, -0.45, 0.4], [0.4, 0.4, 0.4], 0xffa030, { s: 'gem', g: true, grp: 'bomb' }),
  ];
  return {
    id: 'tink',
    scale: S,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [0, 1.9, -2.0], kind: 'bob', k: 1.0 },
      accC: { parent: 'chest', at: [0, 2.2, -4.7], kind: 'spin', axis: 'z', speed: 2.2 },
    },
    tip: { bone: 'handL', p: [0, -1.85, 0.4] },
    anim: {
      weapon: 'lob',
      gait: { cadence: 0.75, stride: 28, knee: 44, armSwing: 20, elbow: 30, bounce: 0.5, lean: 8, sway: 5, twist: 6, heavy: 0.3, headBob: 2, armOut: 6, idle: 1.2 },
      stance: { chest: [6, 0, 0], armL: [-10, 0, 4], foreL: [-46, 0, 0], armR: [-4, 0, -10], foreR: [-22, 0, 0] },
      stanceRun: 0.6,
      victory: 'flex',
    },
  };
}

// ---------------------------------------------------------------- Aurelia, the Dawn Paladin
function aurelia(): HeroRigDef {
  const pr = props({ thigh: 3.4, shin: 3.3, foot: 1.4, hipX: 1.45, spine: 1.5, shoulderX: 3.8, shoulderY: 3.8, upperArm: 2.9, foreArm: 2.7, neck: 4.3, depth: 3.6 });
  const white = 0xeeeef4;
  const whiteD = 0xc8ccd8;
  const gold = 0xe0b448;
  const blue = 0x4a7ad0;
  const skin = 0xf0d0b0;
  const hair = 0xfff0a0;
  const halo = 0xfff4b0;
  const parts: RigPart[] = [
    ...legs(pr, { pants: whiteD, boots: white, knee: gold, cuff: 1.9, cuffColor: gold, toe: gold, thighW: 2.3, shinW: 2.1 }),
    ...torso(pr, { shirt: white, pants: 0xb8bcc8, belt: gold, buckle: 0x4a9aff, chestW: 5.6, flare: 1.2, chestD: 3.6 }),
    P('chest', [0, 2.3, 1.95], [1.9, 1.9, 0.4], gold, { s: 'gem' }),
    P('chest', [0, 2.3, 2.1], [0.8, 0.8, 0.25], halo, { s: 'gem', g: true }),
    ...[0, 90, 45, 135].map((a) => P('chest', [0, 2.3, 1.88], [0.3, 3.0, 0.2], gold, { r: [0, 0, a], flat: true })),
    P('chest', [0, 4.1, 0], [6.8, 0.35, 3.9], gold, { flat: true }),
    P('skirtF', [0, -2.2, 0.5], [3.0, 4.4, 0.35], blue),
    P('skirtF', [0, -4.35, 0.52], [3.1, 0.35, 0.4], gold, { flat: true }),
    ...sym([P('legL', [0.2, -0.5, 0.2], [2.8, 1.9, 2.9], white, { s: 'rbox', t: [0.92, 0.95], bv: [0.6, 0.3] }), P('legL', [0.25, -1.4, 0.25], [2.85, 0.28, 2.95], gold, { flat: true })]),
    ...arms(pr, { sleeve: 0xb8bcc8, skin, fore: white, glove: 0xd8d8e0, upperW: 1.9, foreW: 1.9, cuff: gold }),
    ...sym([
      P('armL', [0.5, 0.15, 0], [3.2, 2.4, 3.2], white, { s: 'ball' }),
      P('armL', [0.55, -0.45, 0], [3.35, 0.35, 3.35], gold, { s: 'cyl', n: 10 }),
      P('armL', [1.7, 0.7, 0], [0.4, 1.7, 1.8], gold, { r: [0, 0, -20] }),
    ]),
    ...head({ skin, eyes: 0x2a4a8a, brows: 0xd8c070, size: [5.6, 5.2, 5.2], mouth: 0xd07070 }),
    P('head', [0, 6.05, -0.2], [5.9, 1.0, 5.5], hair, { s: 'rbox', bv: [1.0, 0.45] }),
    P('head', [0, 3.6, -2.4], [5.8, 5.0, 1.0], hair, { s: 'rbox', bv: [0.4, 0.6, 0.3] }),
    ...sym([P('head', [2.75, 3.6, 0.3], [0.6, 4.0, 3.8], hair), P('head', [1.4, 5.45, 2.4], [2.8, 1.0, 0.8], hair, { r: [0, 0, -8] })]),
    P('head', [0, 5.2, 0], [6.3, 0.5, 5.85], gold, { flat: true }),
    P('head', [0, 5.25, 2.98], [0.9, 1.0, 0.4], 0x4a9aff, { s: 'gem', g: true }),
    ...sym([P('head', [3.2, 5.7, -0.4], [0.4, 1.7, 2.2], gold, { r: [0, 0, -20], sh: [0, -0.6] })]),
    P('accC', [0, -1.5, -0.2], [1.4, 3.0, 1.2], hair),
    P('accC', [0, -3.3, -0.2], [1.1, 0.8, 1.0], gold),
    P('accC', [0, -4.3, -0.2], [1.4, 1.4, 1.0], hair, { t: [0.5, 0.5] }),
    ...ring('accA', [0, 0, 0], 3.0, 10, [1.8, 0.4, 0.6], halo, { g: true }),
    // cape
    P('capeA', [0, -2.1, -0.1], [6.2, 4.4, 0.45], 0xf8f8ff, { t: [0.85, 1] }),
    P('capeB', [0, -1.9, 0], [7.0, 4.0, 0.45], 0xf8f8ff, { t: [0.9, 1] }),
    P('capeB', [0, -3.95, 0], [7.1, 0.35, 0.5], gold, { flat: true }),
    P('capeA', [0, -2.1, 0.2], [5.2, 4.2, 0.2], blue, { t: [0.85, 1], flat: true }),
    // holy mace
    P('handR', [0, -0.8, 1.8], [0.6, 5.0, 0.6], 0x8a6a3a, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('handR', [0, -0.8, -0.8], [0.9, 0.9, 0.9], gold, { s: 'ball' }),
    P('handR', [0, -0.8, 4.0], [1.0, 0.4, 1.0], halo, { s: 'cyl', n: 8, r: [90, 0, 0], g: true }),
    P('handR', [0, -0.8, 5.0], [2.0, 2.0, 2.2], gold),
    ...sym([P('handR', [1.15, -0.8, 5.0], [0.4, 1.6, 1.8], 0xf0d070)]),
    P('handR', [0, 0.35, 5.0], [1.6, 0.4, 1.8], 0xf0d070),
    P('handR', [0, -0.8, 6.5], [0.8, 1.0, 0.8], gold, { s: 'cyl', n: 6, t: [0, 0], r: [90, 0, 0] }),
  ];
  return {
    id: 'aurelia',
    scale: S,
    props: pr,
    parts,
    springs: {
      accA: { parent: 'head', at: [0, 8.2, -0.6], kind: 'bob', k: 0.5 },
      accC: { parent: 'head', at: [0, 3.0, -2.9], kind: 'bob', k: 0.9 },
    },
    tip: { bone: 'handR', p: [0, -0.8, 5.2] },
    anim: {
      weapon: 'hammer',
      gait: { cadence: 0.47, stride: 30, knee: 44, armSwing: 12, elbow: 16, bounce: 0.35, lean: 5, sway: 3, twist: 6, heavy: 0.5, headBob: 1, armOut: 5, idle: 0.8 },
      stance: { chest: [-4, 0, 0], armR: [-8, 0, -6], foreR: [-46, 0, 0], handR: [25, 0, 0], armL: [-5, 0, 6], foreL: [-20, 0, 0] },
      stanceRun: 0.8,
      victory: 'salute',
    },
  };
}

export const HERO_RIGS: Record<string, HeroRigDef> = Object.fromEntries([bram(), lyra(), kestrel(), morwen(), fizz(), shen(), vex(), tink(), aurelia()].map((d) => [d.id, d]));

export function heroRig(id: string): HeroRigDef | undefined {
  return HERO_RIGS[id];
}
