import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { held, props, ringY, rivets } from './kitHeavy';

/**
 * Paladin: knight of light in polished silver plate with gold trim, a white-and-gold tabard,
 * a blue cape, an open winged helm over a bearded face, gorget and layered pauldrons. A
 * holy longsword in the right hand and a tall kite shield with a radiant sun on the left.
 */
export function paladinRig(): HeroRigDef {
  const pr = props({ thigh: 3.4, shin: 3.3, foot: 1.5, hipX: 1.6, spine: 1.5, shoulderX: 4.3, shoulderY: 3.9, upperArm: 3.0, foreArm: 2.8, neck: 4.4, depth: 4.0 });
  const silver = 0xc2cad8;
  const silverL = 0xe4eaf2;
  const silverD = 0x8a94a8;
  const gold = 0xe2b448;
  const goldD = 0xa87e2a;
  const white = 0xf3f0e6;
  const blue = 0x2f5fb8;
  const blueD = 0x1f3f82;
  const skin = 0xe2b290;
  const beard = 0x8a5a32;
  const leather = 0x6a4a30;
  const glow = 0xfff0a0;
  const mail = 0x7c8494;

  const parts: RigPart[] = [
    // ---------------------------------------------------------------- legs: greaves, knee cops, sabatons
    ...legs(pr, { pants: mail, boots: silver, thighW: 2.55, shinW: 2.3, knee: gold, cuff: 2.0, cuffColor: silverL, toe: silverL }),
    ...sym([
      P('legL', [0.2, -1.0, 0.25], [2.95, 2.3, 2.95], silver, { s: 'rbox', t: [1.08, 1.04], bv: [0.6, 0.3] }),
      P('legL', [0.25, -2.2, 0.3], [3.0, 0.28, 3.0], gold, { flat: true }),
      P('shinL', [0, -1.5, 0.75], [1.9, 2.0, 1.3], silverL, { s: 'rbox', t: [0.8, 1], bv: [0.4, 0.3] }),
      P('shinL', [1.25, -0.15, 0.5], [0.3, 1.0, 1.0], gold, { s: 'gem' }),
      P('footL', [0, -pr.foot + 0.75, 1.2], [2.3, 0.3, 2.6], gold, { flat: true }),
    ]),

    // ---------------------------------------------------------------- torso: breastplate, tabard, gorget
    ...torso(pr, { shirt: silver, pants: mail, belt: leather, buckle: gold, chestW: 6.3, flare: 1.22, chestD: 4.0, chestH: 4.4, waistW: 5.5 }),
    P('chest', [0, 2.7, 2.0], [4.6, 3.4, 0.5], silverL, { s: 'rbox', t: [1.12, 1], bv: [0.8, 0.4] }),
    P('chest', [0, 2.8, 2.25], [0.6, 3.2, 0.4], silverL, { t: [0.5, 1] }),
    // white tabard over the chest with gold borders and a sun
    P('chest', [0, 1.3, 2.12], [3.6, 2.8, 0.25], white, { t: [1.25, 1] }),
    P('chest', [0, 2.7, 2.28], [4.5, 0.3, 0.1], gold, { flat: true }),
    ...sym([P('chest', [1.95, 1.3, 2.26], [0.3, 2.8, 0.1], gold, { flat: true, r: [0, 0, -12] })]),
    P('chest', [0, 1.4, 2.4], [1.2, 1.2, 0.3], gold, { s: 'gem' }),
    P('chest', [0, 1.4, 2.5], [0.55, 0.55, 0.2], glow, { s: 'gem', g: true }),
    ...[0, 45, 90, 135].map((a) => P('chest', [0, 1.4, 2.3], [0.25, 2.3, 0.12], gold, { r: [0, 0, a], flat: true })),
    // gold trim on the shoulder line and the gorget
    P('chest', [0, 4.25, 0], [7.6, 0.35, 4.2], gold, { flat: true }),
    P('chest', [0, 4.75, 0], [4.6, 1.2, 4.0], silverL, { s: 'cyl', n: 10 }),
    P('chest', [0, 5.3, 0], [4.2, 0.35, 3.7], gold, { s: 'cyl', n: 10 }),
    // back plate
    P('chest', [0, 2.6, -2.0], [4.8, 3.2, 0.4], silverD, { s: 'rbox', bv: [0.6, 0.3] }),
    // belt pouch and a scroll-sealed prayer tag
    P('hips', [-2.9, 0.6, 1.3], [1.1, 1.3, 1.0], leather, { s: 'rbox', bv: [0.3, 0.3] }),
    P('hips', [2.6, 0.4, 1.7], [0.9, 0.9, 0.3], 0xb02a2a, { s: 'cyl', n: 8, r: [90, 0, 0] }),
    P('hips', [2.6, -0.4, 1.75], [0.7, 1.2, 0.1], 0xf0e6c8, { flat: true }),
    // tabard flaps: white with gold borders, blue band
    P('skirtF', [0, -2.3, 0.75], [3.4, 4.6, 0.35], white, { t: [1.15, 1] }),
    P('skirtF', [0, -4.5, 0.8], [3.5, 0.35, 0.4], gold, { flat: true }),
    P('skirtF', [0, -3.6, 0.95], [3.4, 0.6, 0.1], blue, { flat: true }),
    P('skirtF', [0, -1.8, 0.95], [0.8, 0.8, 0.12], gold, { s: 'gem' }),
    P('skirtB', [0, -2.4, -0.75], [3.8, 4.8, 0.35], white, { t: [1.12, 1] }),
    P('skirtB', [0, -4.7, -0.8], [3.9, 0.35, 0.4], gold, { flat: true }),
    // faulds over the hips
    ...sym([P('hips', [2.3, -0.3, 0.2], [1.6, 1.4, 3.9], silver, { s: 'rbox', bv: [0.4, 0.3], r: [0, 0, 12] })]),

    // ---------------------------------------------------------------- arms and pauldrons
    ...arms(pr, { sleeve: mail, skin, fore: silver, glove: silverD, upperW: 2.2, foreW: 2.2, shoulder: silver, cuff: gold }),
    ...sym([
      P('armL', [0.5, 0.25, 0], [3.7, 1.6, 3.8], silver, { s: 'rbox', t: [0.76, 0.82], bv: [1.0, 0.6] }),
      P('armL', [0.75, -0.75, 0], [3.8, 0.85, 3.9], silverL, { s: 'rbox', bv: [0.9, 0.2] }),
      P('armL', [0.95, -1.5, 0], [3.4, 0.75, 3.5], silver, { s: 'rbox', bv: [0.8, 0.2] }),
      P('armL', [0.8, -0.32, 0], [3.9, 0.26, 4.0], gold, { flat: true }),
      P('armL', [1.0, -1.9, 0], [3.45, 0.2, 3.55], gold, { flat: true }),
      P('armL', [1.2, 1.05, 0], [0.5, 0.8, 2.6], gold, { s: 'rbox', bv: [0.2, 0.3] }),
      ...rivets('armL', [[2.6, -0.75, 1.3], [2.6, -0.75, -1.3]], gold, 0.3),
      P('foreL', [0, -0.9, 0.02], [2.5, 0.8, 2.5], silverL, { s: 'rbox', bv: [0.4, 0.2, 0.2] }),
      P('handL', [0, -0.75, 0.1], [1.7, 1.6, 1.8], silverD, { s: 'rbox', bv: [0.4, 0.2, 0.4] }),
      P('handL', [0, -0.15, 0.1], [1.8, 0.3, 1.9], gold, { flat: true }),
    ]),

    // ---------------------------------------------------------------- head: open winged helm, bearded face
    ...head({ skin, eyes: 0x2a4a8a, brows: beard, size: [5.6, 5.2, 5.2], noLower: true }),
    P('head', [0, 2.15, 2.75], [0.85, 1.05, 0.6], 0xcc9c7c, { t: [0.8, 0.7] }),
    P('head', [0, 0.95, 1.9], [4.6, 1.8, 1.7], beard, { s: 'rbox', t: [0.9, 0.9], bv: [0.6, 0.2, 0.4] }),
    P('head', [0, 1.6, 2.72], [2.6, 0.5, 0.4], beard),
    P('head', [0, 1.15, 2.78], [1.1, 0.25, 0.1], 0x8a4a3a, { flat: true }),
    // helm shell: crown, back and cheek guards; gold brow band with a sun gem; nasal
    P('head', [0, 5.25, -0.2], [6.2, 2.4, 5.9], silver, { s: 'rbox', t: [0.9, 0.9], bv: [1.3, 1.1] }),
    P('head', [0, 3.3, -1.6], [6.3, 3.6, 2.9], silver, { s: 'rbox', bv: [1.0, 0.3] }),
    ...sym([P('head', [2.95, 2.9, 0.7], [0.55, 3.2, 3.6], silverL, { s: 'rbox', t: [1, 0.8], bv: [0.2, 0.3] })]),
    P('head', [0, 4.35, 0], [6.35, 0.6, 5.95], gold, { s: 'rbox', bv: [1.1, 0.1, 0.1] }),
    P('head', [0, 4.4, 3.0], [0.9, 1.0, 0.35], gold, { s: 'gem' }),
    P('head', [0, 4.4, 3.15], [0.45, 0.5, 0.2], glow, { s: 'gem', g: true }),
    P('head', [0, 3.5, 2.95], [0.5, 1.6, 0.3], silverL, { t: [0.6, 1] }),
    P('head', [0, 6.5, -0.3], [0.6, 0.6, 5.0], gold, { s: 'rbox', bv: [0.2, 0.25] }),
    // swept wings: three feathers each side
    ...sym([
      P('head', [3.3, 5.1, -0.6], [0.5, 1.3, 2.0], gold, { s: 'rbox', bv: [0.2, 0.3] }),
      P('head', [3.6, 6.3, -1.4], [0.35, 1.0, 3.6], white, { r: [-28, 0, -14], t: [1, 0.6] }),
      P('head', [3.75, 5.6, -1.8], [0.35, 0.9, 3.4], silverL, { r: [-14, 0, -16], t: [1, 0.6] }),
      P('head', [3.8, 4.9, -1.9], [0.35, 0.8, 2.8], white, { r: [-2, 0, -18], t: [1, 0.6] }),
    ]),

    // ---------------------------------------------------------------- cape: blue with white lining and a gold hem
    P('capeA', [0, -2.1, -0.1], [6.4, 4.4, 0.45], blue, { t: [0.82, 1] }),
    P('capeA', [0, -2.1, 0.17], [6.0, 4.3, 0.12], white, { t: [0.82, 1], flat: true }),
    P('capeB', [0, -2.0, 0], [7.2, 4.2, 0.45], blue, { t: [0.9, 1] }),
    P('capeB', [0, -4.15, 0], [7.3, 0.4, 0.5], gold, { flat: true }),
    P('capeB', [0, -2.0, -0.26], [1.6, 1.6, 0.12], gold, { s: 'gem' }),
    P('capeA', [0, 0.3, -0.05], [6.8, 0.6, 0.7], blueD),
    ...sym([P('capeA', [2.9, 0.3, 0.2], [1.0, 1.0, 0.5], gold, { s: 'cyl', n: 8, r: [90, 0, 0] })]),

    // ---------------------------------------------------------------- longsword (right hand; +z along the blade, +y toward the edge)
    ...sword(),
    // ---------------------------------------------------------------- kite shield (left hand; faces away from the fist)
    ...shield(),
  ];

  function sword(): RigPart[] {
    const w = held('gripR', [0, -0.8, 0.35]);
    return [
      w([0, 0, -0.35], [0.62, 2.7, 0.62], leather, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      w([0, 0, -2.0], [0.95, 0.95, 0.95], gold, { s: 'gem' }),
      w([0, 0, 1.05], [0.75, 3.6, 0.6], gold, { s: 'rbox', bv: [0.2, 0.2] }),
      ...[-1, 1].map((sy) => w([0, sy * 1.9, 1.3], [0.6, 0.6, 0.9], goldD, { r: [sy * -30, 0, 0] })),
      w([0, 0, 1.1], [0.85, 0.7, 0.7], glow, { s: 'gem', g: true }),
      w([0, 0, 5.6], [0.4, 1.3, 8.4], silverL),
      w([0, 0, 10.5], [0.4, 1.5, 1.3], silverL, { r: [90, 0, 0], t: [0.6, 0.05] }),
      w([0, 0, 5.2], [0.46, 0.32, 6.4], glow, { g: true }),
    ];
  }

  function shield(): RigPart[] {
    const w = held('gripL', [0, -0.8, 0.35]);
    const y0 = -1.2;
    const rim = (z: number, wd: number, dz: number) => w([0, y0, z], [wd, 0.5, dz], gold);
    const face = (z: number, wd: number, dz: number, c: number) => w([0, y0 - 0.25, z], [wd, 0.4, dz], c);
    return [
      // gold rim (back layer) in kite steps
      rim(4.0, 4.8, 1.2), rim(1.6, 6.4, 3.8), rim(-1.3, 5.4, 2.2), rim(-3.1, 3.8, 1.6), rim(-4.5, 2.2, 1.4), rim(-5.5, 0.9, 0.8),
      // silver border and blue field
      face(3.95, 4.2, 0.9, silverL), face(1.6, 5.8, 3.5, silverL), face(-1.3, 4.8, 2.1, silverL), face(-3.1, 3.2, 1.5, silverL), face(-4.5, 1.6, 1.2, silverL),
      w([0, y0 - 0.4, 1.6], [4.8, 0.3, 4.4], blue),
      w([0, y0 - 0.4, -1.3], [3.8, 0.3, 1.8], blue),
      w([0, y0 - 0.4, -3.0], [2.2, 0.3, 1.4], blue),
      // radiant sun: rays, disc, glowing core
      ...[0, 30, 60, 90, 120, 150].map((a) => w([0, y0 - 0.6, 1.0], [0.3, 0.15, 5.0], gold, { r: [0, a, 0], flat: true })),
      w([0, y0 - 0.65, 1.0], [2.0, 0.4, 2.0], gold, { s: 'cyl', n: 8 }),
      w([0, y0 - 0.85, 1.0], [1.1, 0.3, 1.1], glow, { s: 'cyl', n: 8, g: true }),
      ...ringY('gripL', [0, -0.8 + y0 - 0.6, 0.35 + 1.0], 1.45, 8, [0.35, 0.18, 0.35], goldD),
      // boss studs on the rim
      ...[[2.7, 3.0], [-2.7, 3.0], [2.9, 0.2], [-2.9, 0.2], [0, -5.2]].map(([x, z]) => w([x, y0 - 0.35, z], [0.45, 0.3, 0.45], white, { flat: true })),
      // straps on the inside
      w([0, -0.2, 0.6], [0.8, 1.6, 2.6], leather),
    ];
  }

  return {
    id: 'paladin',
    scale: 0.085,
    props: pr,
    parts,
    tip: { bone: 'gripR', p: [0, -0.8, 0.35 + 10.5] },
    grip: { R: { rot: [-8, -28, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.46, stride: 28, knee: 40, armSwing: 8, elbow: 12, bounce: 0.4, lean: 5, sway: 3, twist: 5, heavy: 0.6, headBob: 1, armOut: 7, idle: 0.7 },
      stance: { armL: [-25, -14, -20], foreL: [-60, 0, 0], handL: [-3, -12, 21], armR: [-10, 0, -6], foreR: [-38, 0, 0], handR: [30, 0, 0], legL: [-4, 0, 3], legR: [4, 0, -3] },
      stanceRun: 0.85,
      victory: 'salute',
    },
  };
}
