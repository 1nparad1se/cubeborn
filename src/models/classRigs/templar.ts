import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { held, hem, props, ringZ } from './kitHeavy';

/**
 * Templar: a holy battle-maiden who rules the field with seals. Angular ivory plate over a
 * dark under-suit, deep crimson cloth panels with gold geometric hems, swept pauldrons, a
 * winged gold circlet over dark hair with a long braid, a slowly turning rune seal floating
 * behind her back, and a sacred halberd (crescent blade, top spike, back hook, glowing runes)
 * held diagonally in both hands.
 */
export function templarRig(): HeroRigDef {
  const pr = props({ thigh: 3.5, shin: 3.4, foot: 1.3, hipX: 1.35, spine: 1.6, shoulderX: 3.5, shoulderY: 3.6, upperArm: 2.9, foreArm: 2.7, neck: 4.2, depth: 3.3 });
  const ivory = 0xeee6d2;
  const ivoryD = 0xcabfa6;
  const crimson = 0xa01e30;
  const crimsonD = 0x6a1220;
  const gold = 0xd8a838;
  const goldD = 0x9a7424;
  const under = 0x3a3542;
  const skin = 0xf0caa8;
  const hair = 0x2c1a20;
  const hairL = 0x4a2a32;
  const holy = 0xffd27a;
  const seal = 0xff6a5a;
  const haftC = 0x5a2a2a;

  const parts: RigPart[] = [
    // ---------------------------------------------------------------- legs: angular greaves and sabatons
    ...legs(pr, { pants: under, boots: ivory, thighW: 2.15, shinW: 1.95, knee: gold, cuff: 2.6, cuffColor: ivory, toe: gold }),
    ...sym([
      P('legL', [0.35, -1.2, 0.2], [1.2, 2.6, 2.6], ivory, { s: 'rbox', t: [1.2, 1.0], bv: [0.3, 0.3], r: [0, 0, 6] }),
      P('legL', [0.45, -2.55, 0.2], [1.3, 0.25, 2.65], gold, { flat: true, r: [0, 0, 6] }),
      P('shinL', [0, -1.0, 1.0], [1.5, 1.3, 0.5], ivoryD, { t: [0.5, 1] }),
      P('shinL', [0, -pr.shin + 2.55, 0.05], [2.45, 0.25, 2.5], gold, { flat: true }),
      P('shinL', [0, 0.15, 0.95], [0.9, 0.9, 0.5], gold, { s: 'gem' }),
    ]),

    // ---------------------------------------------------------------- torso: V breastplate, crimson inset, high collar
    ...torso(pr, { shirt: under, pants: under, belt: gold, chestW: 5.0, flare: 1.24, chestD: 3.3, chestH: 4.0, waistW: 4.0 }),
    P('chest', [0, 2.4, 1.55], [4.6, 3.6, 0.5], ivory, { s: 'rbox', t: [1.18, 1], bv: [0.5, 0.4] }),
    P('chest', [0, 1.0, 1.65], [2.4, 1.6, 0.5], ivory, { t: [1.9, 1], r: [180, 0, 0] }),
    P('chest', [0, 2.2, 1.85], [1.6, 2.4, 0.2], crimson, { t: [2.0, 1], r: [180, 0, 0], flat: true }),
    ...sym([P('chest', [1.15, 2.4, 1.92], [0.22, 2.9, 0.12], gold, { flat: true, r: [0, 0, -18] })]),
    P('chest', [0, 3.75, 1.9], [4.4, 0.25, 0.15], gold, { flat: true }),
    P('chest', [0, 2.7, 1.98], [0.8, 0.8, 0.25], holy, { s: 'gem', g: true }),
    // angular standing collar
    P('chest', [0, 4.35, -0.3], [4.6, 1.3, 3.2], ivory, { s: 'rbox', t: [1.1, 1.1], bv: [0.5, 0.2] }),
    P('chest', [0, 4.9, -1.35], [4.4, 1.4, 0.4], crimson, { t: [1.2, 1], sh: [0, -0.3] }),
    P('chest', [0, 4.95, -0.3], [4.8, 0.25, 3.4], gold, { flat: true }),
    // back plate
    P('chest', [0, 2.4, -1.55], [4.2, 3.2, 0.4], ivoryD, { s: 'rbox', bv: [0.5, 0.3] }),
    P('chest', [0, 2.4, -1.78], [0.5, 2.6, 0.12], gold, { flat: true }),
    // waist: gold belt with a seal medallion, hanging chains
    P('hips', [0, 1.05, 1.62], [1.4, 1.4, 0.3], gold, { s: 'cyl', n: 8, r: [90, 0, 0] }),
    P('hips', [0, 1.05, 1.8], [0.7, 0.7, 0.2], seal, { s: 'gem', g: true }),
    ...sym([P('hips', [2.2, 0.85, 0.2], [0.9, 1.6, 3.2], ivory, { s: 'rbox', bv: [0.25, 0.25], r: [0, 0, 10] })]),

    // ---------------------------------------------------------------- crimson cloth panels
    P('skirtF', [0, -2.6, 0.45], [2.9, 5.2, 0.3], crimson, { t: [1.2, 1] }),
    P('skirtF', [0, -4.8, 0.62], [2.9, 0.3, 0.1], gold, { flat: true }),
    P('skirtF', [0, -4.3, 0.62], [2.9, 0.15, 0.1], goldD, { flat: true }),
    P('skirtF', [0, -2.2, 0.64], [0.9, 0.9, 0.12], gold, { s: 'gem' }),
    P('skirtF', [0, -3.3, 0.64], [0.2, 1.6, 0.1], gold, { flat: true }),
    ...hem('skirtF', 0, 2.9, -5.2, 0.45, [0.6, 1.0, 0.6], crimsonD, 0.28),
    P('skirtB', [0, -2.9, -0.45], [3.8, 5.8, 0.3], crimson, { t: [1.15, 1] }),
    P('skirtB', [0, -5.5, -0.6], [3.8, 0.3, 0.1], gold, { flat: true }),
    P('skirtB', [0, -5.0, -0.6], [3.8, 0.15, 0.1], goldD, { flat: true }),
    ...hem('skirtB', 0, 3.8, -5.8, -0.45, [0.6, 1.0, 1.3, 1.0, 0.6], crimsonD, 0.28),

    // ---------------------------------------------------------------- arms: swept pauldrons, angular vambraces
    ...arms(pr, { sleeve: under, skin, fore: ivory, glove: ivoryD, upperW: 1.75, foreW: 1.8, shoulder: ivory, shoulderSize: 2.4 }),
    ...sym([
      P('armL', [0.55, 0.3, 0], [2.9, 1.0, 3.2], ivory, { s: 'rbox', t: [0.7, 0.85], bv: [0.6, 0.3], r: [0, 0, -14] }),
      P('armL', [0.85, -0.45, 0], [3.0, 0.7, 3.3], crimson, { s: 'rbox', bv: [0.6, 0.15], r: [0, 0, -14] }),
      P('armL', [1.05, -1.05, 0], [2.7, 0.6, 3.0], ivory, { s: 'rbox', bv: [0.5, 0.15], r: [0, 0, -14] }),
      P('armL', [0.9, -0.12, 0], [3.0, 0.18, 3.35], gold, { flat: true, r: [0, 0, -14] }),
      // swept tip rising from the pauldron
      P('armL', [1.75, 1.2, -0.3], [0.4, 1.8, 1.6], gold, { r: [0, 0, -30], t: [1, 0.3] }),
      P('foreL', [0.7, -1.3, 0.02], [0.6, 2.0, 1.5], ivoryD, { t: [1, 0.4], r: [0, 0, -8] }),
      P('foreL', [0, -0.7, 0.02], [2.05, 0.25, 2.1], gold, { flat: true }),
      P('foreL', [0, -2.35, 0.02], [2.1, 0.25, 2.15], gold, { flat: true }),
    ]),

    // ---------------------------------------------------------------- head: face, dark hair, braid, winged circlet
    ...head({ skin, eyes: 0x6a2a1a, brows: hair, size: [5.3, 5.0, 5.0], mouth: 0xb0404a }),
    ...sym([P('head', [1.8, 3.45, 2.55], [0.5, 0.2, 0.12], 0x2a1a1a, { flat: true, r: [0, 0, 10] })]),
    P('head', [0, 5.65, 0], [5.6, 1.1, 5.3], hair, { s: 'rbox', bv: [0.9, 0.45] }),
    P('head', [0, 3.4, -2.3], [5.5, 5.2, 1.0], hair, { s: 'rbox', bv: [0.4, 0.6, 0.3] }),
    ...sym([
      P('head', [2.55, 3.4, 0.3], [0.55, 4.6, 3.6], hair),
      P('head', [1.5, 5.15, 2.3], [2.6, 0.9, 0.7], hair, { r: [0, 0, -10] }),
      P('head', [2.6, 1.5, 1.5], [0.5, 1.6, 0.9], hairL),
    ]),
    // circlet with a crimson gem and tall angular wings
    P('head', [0, 4.95, 0], [5.75, 0.45, 5.45], gold, { flat: true }),
    P('head', [0, 5.0, 2.75], [1.0, 1.2, 0.35], gold, { s: 'gem' }),
    P('head', [0, 5.0, 2.9], [0.5, 0.7, 0.2], seal, { s: 'gem', g: true }),
    ...sym([
      P('head', [2.95, 5.1, 0.6], [0.4, 1.0, 1.2], gold),
      P('head', [3.15, 6.2, -0.2], [0.35, 2.2, 1.1], ivory, { r: [-25, 0, -18], t: [1, 0.5] }),
      P('head', [3.25, 6.9, -0.9], [0.3, 2.6, 0.9], ivory, { r: [-42, 0, -20], t: [1, 0.4] }),
      P('head', [3.3, 7.3, -1.8], [0.3, 2.6, 0.8], gold, { r: [-58, 0, -22], t: [1, 0.35] }),
    ]),
    // braid on a spring: segments with gold rings and a crimson ribbon
    ...[0, 1, 2, 3].map((i) => P('accC', [0, -0.7 - i * 1.25, -0.1], [1.25 - i * 0.08, 1.2, 1.1 - i * 0.05], i % 2 ? hairL : hair, { s: 'rbox', bv: [0.3, 0.25, 0.25] })),
    P('accC', [0, -2.6, -0.1], [1.35, 0.3, 1.2], gold, { flat: true }),
    P('accC', [0, -5.5, -0.1], [1.0, 0.4, 0.9], gold, { flat: true }),
    P('accC', [0, -6.4, -0.1], [1.0, 1.4, 0.8], hair, { t: [0.4, 0.5], r: [180, 0, 0] }),
    P('accC', [0.4, -6.0, 0.2], [0.35, 1.6, 0.1], crimson, { r: [0, 0, 12] }),

    // ---------------------------------------------------------------- rune seal floating behind the back (spins)
    ...ringZ('accB', [0, 0, 0], 3.7, 16, [1.4, 0.35, 0.25], holy, { g: true }),
    ...ringZ('accB', [0, 0, 0], 2.5, 12, [0.9, 0.3, 0.2], seal, { g: true }, 0.5),
    ...ringZ('accB', [0, 0, 0], 3.1, 8, [0.3, 0.9, 0.2], holy, { g: true }, 0.25),
    ...[0, 60, 120].map((a) => P('accB', [0, 0, 0], [0.22, 4.6, 0.15], gold, { r: [0, 0, a], g: true })),
    P('accB', [0, 0, 0], [1.0, 1.0, 0.3], seal, { s: 'gem', g: true }),

    // ---------------------------------------------------------------- halberd (right hand; +z along the haft toward the head, +y toward the blade)
    ...halberd(),
  ];

  function halberd(): RigPart[] {
    const w = held('gripR', [0, -0.8, 0.35]);
    return [
      // haft with gold bands and crimson grips
      w([0, 0, 5.0], [0.62, 24.0, 0.62], haftC, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      ...[-6.2, -2.0, 2.2, 10.5, 14.2].map((z) => w([0, 0, z], [0.85, 0.35, 0.85], gold, { s: 'cyl', n: 6, r: [90, 0, 0] })),
      w([0, 0, 0], [0.75, 2.6, 0.75], crimson, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      w([0, 0, 7.0], [0.75, 3.4, 0.75], crimson, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      // butt spike
      w([0, 0, -7.4], [0.9, 0.8, 0.9], gold, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      w([0, 0, -8.6], [0.7, 1.8, 0.7], goldD, { s: 'cyl', n: 4, t: [0, 0], r: [-90, 0, 0] }),
      // socket with langets
      w([0, 0, 16.2], [1.1, 2.0, 1.1], gold, { s: 'cyl', n: 8, r: [90, 0, 0] }),
      w([0, 0, 15.0], [1.3, 0.4, 1.3], goldD, { s: 'cyl', n: 8, r: [90, 0, 0] }),
      // crescent blade: body, hooked horns, bright edge, glowing runes
      w([0, 1.9, 18.6], [0.4, 2.6, 4.8], ivory),
      w([0, 3.15, 21.2], [0.35, 1.2, 1.9], ivory, { r: [-38, 0, 0] }),
      w([0, 3.15, 16.0], [0.35, 1.2, 1.9], ivory, { r: [38, 0, 0] }),
      w([0, 3.45, 18.6], [0.3, 0.55, 4.4], 0xfffaf0),
      w([0, 3.85, 21.8], [0.28, 0.5, 1.4], 0xfffaf0, { r: [-38, 0, 0] }),
      w([0, 3.85, 15.4], [0.28, 0.5, 1.4], 0xfffaf0, { r: [38, 0, 0] }),
      w([0, 1.9, 18.6], [0.46, 0.4, 3.2], holy, { g: true }),
      ...[17.3, 18.6, 19.9].map((z) => w([0, 2.6, z], [0.48, 0.5, 0.3], holy, { g: true })),
      // back hook
      w([0, -1.4, 18.4], [0.4, 2.0, 1.1], gold, { t: [1, 0.15], r: [180, 0, 0] }),
      // top spike
      w([0, 0, 21.5], [0.7, 4.6, 1.2], ivory, { r: [90, 0, 0], t: [0.2, 0.15] }),
      w([0, 0, 20.4], [0.75, 1.6, 0.4], holy, { g: true }),
      // crimson streamers under the head
      w([0, -0.5, 14.3], [0.15, 1.2, 0.5], crimson),
      w([0.0, -0.9, 13.7], [0.15, 0.5, 1.6], crimsonD),
    ];
  }

  return {
    id: 'templar',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [0, 2.6, -4.6], kind: 'spin', axis: 'z', speed: 0.7 },
      accC: { parent: 'head', at: [0, 3.0, -2.95], kind: 'bob', k: 0.9 },
    },
    tip: { bone: 'gripR', p: [0, -0.8 + 1.9, 0.35 + 18.6] },
    grip: { R: { rot: [-8, -2, -23] } },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.47, stride: 26, knee: 38, armSwing: 4, elbow: -18, bounce: 0.3, lean: 5, sway: 3, twist: 4, heavy: 0.3, headBob: 1, armOut: 3, idle: 0.7 },
      stance: { armR: [-30, 18, 8], foreR: [-20, 0, 0], handR: [-12, 17, -5], armL: [-63, 14, -40], foreL: [-20, 0, 0], handL: [4, 1, -6] },
      stanceRun: 1,
      victory: 'raise',
    },
  };
}

