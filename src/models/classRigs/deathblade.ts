import { DEFAULT_PROPS, type HeroRigDef, type Proportions } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { bands, bladeTip, curvedBlade, tatters, type BladeOpts } from './kitAgile';

/** Idle stance (also the base the deathblade action clips are authored against). */
export const DEATHBLADE_STANCE: PoseMap = {
  rootPos: [0, -1.3, 0],
  hips: [0, -8, 0],
  legL: [-34, -10, 12], shinL: [50, 0, 0], footL: [-14, 10, 0],
  legR: [2, 12, -12], shinR: [38, 0, 0], footR: [-28, -12, 0],
  spine: [8, 0, 0], chest: [14, 12, 0], head: [-16, -8, 0],
  armL: [-38, 0, 34], foreL: [-48, 0, 0], handL: [10, 16, 0],
  armR: [-16, 0, -42], foreR: [-36, 0, 0], handR: [16, -38, 0],
};

/**
 * Deathblade (Клинок смерти): a slim, fast swordswoman with a curved blade in each hand.
 * Dark leather with crimson and silver, a high silver ponytail, a half-face mask, one heavy
 * layered pauldron on the left shoulder, thigh straps and a short tattered tail at the waist.
 */
export function deathbladeRig(): HeroRigDef {
  const pr: Proportions = { ...DEFAULT_PROPS, thigh: 3.6, shin: 3.5, foot: 1.2, hipX: 1.3, spine: 1.6, shoulderX: 3.35, shoulderY: 3.5, upperArm: 2.9, foreArm: 2.7, neck: 4.1, depth: 3.0 };
  const leather = 0x2c2832;
  const leatherD = 0x1b1820;
  const leatherL = 0x463f4e;
  const crimson = 0xc41e38;
  const crimsonD = 0x7c1426;
  const silver = 0xcfd5df;
  const silverD = 0x8a92a2;
  const skin = 0xf0c6a6;
  const hair = 0xe8e4ee;
  const hairD = 0xb8b2c4;
  const glow = 0xff3450;
  const steel = 0xdde3ec;

  // ---------------------------------------------------------------- twin curved blades (left authored, mirrored)
  const blade: BladeOpts = { b: 'gripL', at: [0, -0.8, 1.6], dir: 1, len: 6.6, curve: 30, w: 1.05, th: 0.24, seg: 6, steel, edge: glow, spine: 0x5e6474 };
  const sword: RigPart[] = [
    P('gripL', [0, -0.8, 0.3], [0.55, 2.5, 0.55], leatherD, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    ...[-0.35, 0.25, 0.85].map((z) => P('gripL', [0, -0.8, z], [0.62, 0.14, 0.62], crimsonD, { s: 'cyl', n: 6, r: [90, 0, 0], flat: true })),
    P('gripL', [0, -0.8, -1.05], [0.75, 0.75, 0.75], silver, { s: 'gem' }),
    P('gripL', [0, -0.8, -1.05], [0.4, 0.4, 0.4], glow, { s: 'gem', g: true }),
    // swept crescent guard
    P('gripL', [0, -0.8, 1.45], [0.6, 1.0, 0.45], silver, { s: 'rbox', bv: [0.15, 0.15] }),
    P('gripL', [0, -1.55, 1.3], [0.45, 0.9, 0.35], silverD, { r: [-35, 0, 0], t: [0.6, 0.6] }),
    P('gripL', [0, -0.05, 1.3], [0.45, 0.9, 0.35], silverD, { r: [35, 0, 0], t: [0.6, 0.6] }),
    P('gripL', [0.18, -0.8, 1.45], [0.12, 0.4, 0.3], glow, { g: true }),
    P('gripL', [-0.18, -0.8, 1.45], [0.12, 0.4, 0.3], glow, { g: true }),
    ...curvedBlade(blade),
  ];
  const tipL = bladeTip(blade);

  const parts: RigPart[] = [
    // ---------------------------------------------------------- legs: leggings, tall boots, knee guards, thigh straps
    ...legs(pr, { pants: leather, boots: leatherD, sole: 0x0e0c10, thighW: 2.1, shinW: 1.8, cuff: 2.7, cuffColor: leatherL, knee: silver, toe: silverD }),
    ...sym([
      ...bands('legL', [-0.9, -2.2], [2.25, 0.3, 2.2], crimson, { r: [0, 0, 0] }),
      P('legL', [1.05, -1.55, 0.1], [0.45, 1.7, 0.95], leatherL, { s: 'rbox', bv: [0.15, 0.15] }),
      P('legL', [1.15, -0.55, 0.1], [0.3, 0.5, 0.3], silver, { s: 'cyl', n: 6 }),
      P('shinL', [0, -0.45, -0.05], [2.15, 0.4, 2.15], leatherD, { flat: true }),
      P('shinL', [0, -1.6, -1.0], [0.4, 0.25, 0.3], silver, { flat: true }),
      P('shinL', [0, -2.3, -1.0], [0.4, 0.25, 0.3], silver, { flat: true }),
    ]),

    // ---------------------------------------------------------- torso: fitted jerkin, crimson corset, cross strap
    ...torso(pr, { shirt: leather, pants: leather, belt: leatherD, buckle: silver, chestW: 4.4, flare: 1.2, chestD: 2.9, chestH: 3.8, waistW: 3.5 }),
    P('spine', [0, 0.55, 1.33], [2.6, 1.9, 0.25], crimson, { t: [1.12, 1] }),
    ...[0.1, 0.55, 1.0].map((y) => P('spine', [0, y, 1.48], [1.1, 0.12, 0.12], silver, { flat: true })),
    P('chest', [0, 0.55, 1.42], [3.0, 1.2, 0.3], crimson, { t: [1.1, 1] }),
    ...sym([P('chest', [0.85, 2.25, 1.45], [1.6, 1.4, 0.5], leather, { s: 'rbox', bv: [0.45, 0.4, 0.3] })]),
    P('chest', [0, 2.2, 1.68], [0.14, 1.2, 0.14], leatherD, { flat: true }),
    P('chest', [0.2, 1.9, 0], [0.55, 5.0, 3.15], crimsonD, { r: [0, 0, -38] }),
    P('chest', [-0.55, 2.8, 1.62], [0.5, 0.5, 0.2], silver, { s: 'rbox', bv: [0.12, 0.1] }),
    // high collar
    P('chest', [0, 3.95, -0.1], [2.8, 1.2, 2.5], leatherD, { s: 'cyl', n: 8, t: [0.92, 0.92] }),
    P('chest', [0, 4.5, -0.1], [2.95, 0.22, 2.65], silver, { s: 'cyl', n: 8, flat: true }),
    // belt: twin slung hip belts with a pouch
    P('hips', [0, 0.55, 0], [4.25, 0.45, 3.05], crimsonD, { r: [0, 0, 8], flat: true }),
    P('hips', [-1.75, 0.4, 0.6], [0.95, 1.1, 0.8], leatherL, { s: 'rbox', bv: [0.25, 0.2] }),
    P('hips', [-1.75, 0.65, 1.02], [0.5, 0.3, 0.1], silver, { flat: true }),
    // short tattered tail at the back of the waist
    P('capeA', [0, -1.05, 0], [3.3, 2.3, 0.3], crimsonD, { t: [0.82, 1] }),
    P('capeA', [0, -0.05, 0.05], [3.0, 0.35, 0.36], silver, { flat: true }),
    P('capeB', [0, -0.75, 0], [3.6, 1.6, 0.28], crimson, { t: [0.94, 1] }),
    ...tatters('capeB', -1.5, 0, 3.6, 5, 1.6, 0.26, crimson),
    P('capeB', [0, -0.75, 0.02], [3.6, 0.2, 0.3], leatherD, { flat: true }),

    // ---------------------------------------------------------- arms: bare shoulders, leather bracers, fingerless gloves
    ...arms(pr, { sleeve: skin, skin, fore: leatherL, glove: leatherD, upperW: 1.55, foreW: 1.6, shoulder: skin, shoulderSize: 1.9, cuff: silver }),
    ...sym([
      P('foreL', [0.82, -1.35, 0], [0.25, 1.9, 1.15], silver, { s: 'rbox', bv: [0.08, 0.2] }),
      P('foreL', [0.92, -1.35, 0], [0.12, 1.2, 0.2], glow, { g: true }),
      ...bands('foreL', [-0.35], [1.75, 0.2, 1.8], crimsonD),
    ]),
    // left: layered silver pauldron with a crimson trim and a swept spike
    P('armL', [0.45, 0.15, 0], [2.9, 1.35, 3.0], silver, { s: 'rbox', t: [0.62, 0.8], bv: [0.6, 0.45], r: [0, 0, -16] }),
    P('armL', [0.75, -0.65, 0], [2.7, 0.9, 2.85], silverD, { s: 'rbox', t: [0.85, 0.9], bv: [0.5, 0.3], r: [0, 0, -22] }),
    P('armL', [0.95, -1.25, 0], [2.4, 0.7, 2.6], silver, { s: 'rbox', t: [0.85, 0.9], bv: [0.45, 0.25], r: [0, 0, -26] }),
    P('armL', [0.95, -1.62, 0], [2.42, 0.18, 2.62], crimson, { r: [0, 0, -26], flat: true }),
    P('armL', [0.9, 1.0, -0.4], [0.7, 2.0, 0.7], silver, { s: 'cyl', n: 4, t: [0.06, 0.06], r: [-30, 0, -30] }),
    P('armL', [-0.5, 0.6, 0], [0.4, 0.3, 3.0], leatherD, { flat: true }),
    // right: a crimson arm band and a strap over the shoulder
    P('armR', [0, -1.6, 0], [1.85, 0.4, 1.85], crimson, { flat: true }),
    P('armR', [0, -1.95, 0], [1.8, 0.15, 1.8], silver, { flat: true }),

    // ---------------------------------------------------------- head: half mask, silver hair, high ponytail
    ...head({ skin, eyes: 0x9a1630, brows: hairD, size: [5.3, 5.1, 5.0], noLower: true }),
    // half mask over the nose and mouth with a silver ridge
    P('head', [0, 1.55, 0.3], [5.15, 2.25, 4.95], leatherD, { s: 'rbox', t: [1.04, 1.04], bv: [1.0, 0.3, 0.5] }),
    P('head', [0, 2.0, 2.78], [3.4, 0.2, 0.12], silver, { flat: true }),
    P('head', [0, 1.55, 2.8], [0.2, 1.0, 0.12], crimson, { flat: true }),
    ...sym([P('head', [1.6, 1.35, 2.74], [0.9, 0.12, 0.12], leatherL, { r: [0, 0, -12], flat: true })]),
    // eyeliner flicks
    ...sym([P('head', [2.0, 3.4, 2.56], [0.6, 0.14, 0.1], 0x1a1018, { r: [0, 0, 22], flat: true })]),
    // hair cap, swept fringe over the right eye, side locks
    P('head', [0, 5.3, -0.3], [5.65, 1.8, 5.45], hair, { s: 'rbox', bv: [1.1, 0.7] }),
    P('head', [0, 3.6, -2.35], [5.3, 3.0, 1.0], hair, { s: 'rbox', bv: [0.4, 0.3] }),
    P('head', [-0.9, 4.7, 2.42], [3.4, 1.1, 0.6], hair, { s: 'rbox', bv: [0.3, 0.3], r: [0, 0, -14] }),
    P('head', [-1.75, 4.0, 2.5], [1.2, 1.4, 0.5], hairD, { r: [0, 0, -10], t: [0.6, 1] }),
    P('head', [1.4, 4.95, 2.35], [2.0, 0.7, 0.6], hair, { r: [0, 0, 10] }),
    ...sym([P('head', [2.6, 2.95, 1.0], [0.55, 3.0, 1.2], hair, { t: [1, 1], r: [0, 0, 4] })]),
        P('accA', [0, 0.2, -0.2], [1.7, 1.3, 1.7], hair, { s: 'rbox', bv: [0.45, 0.35] }),
    P('accA', [0, 0.35, -0.2], [1.9, 0.5, 1.9], crimson, { s: 'cyl', n: 6, flat: true }),
    P('accA', [0, 0.35, -0.2], [0.45, 0.45, 2.2], silver, { flat: true }),
    P('accA', [0, 0.0, -1.2], [1.9, 1.5, 1.9], hair, { s: 'rbox', bv: [0.5, 0.4], r: [-70, 0, 0] }),
    P('accA', [0, -1.25, -2.0], [1.9, 2.4, 1.75], hair, { s: 'rbox', t: [1.05, 1.0], bv: [0.5, 0.3], r: [30, 0, 0] }),
    P('accA', [0, -3.35, -2.5], [1.75, 2.4, 1.6], hair, { s: 'rbox', t: [1.1, 1.05], bv: [0.45, 0.2], r: [12, 0, 0] }),
    P('accA', [0, -5.55, -2.62], [1.6, 2.4, 1.4], hairD, { s: 'rbox', t: [0.3, 0.35], bv: [0.35, 0.2], r: [-176, 0, 0] }),
    P('accA', [0, -4.45, -2.6], [1.85, 0.35, 1.65], crimson, { flat: true, r: [6, 0, 0] }),
    P('accA', [0, -4.45, -2.6], [0.5, 0.4, 1.85], silver, { flat: true, r: [6, 0, 0] }),

    // ---------------------------------------------------------- the blades
    ...sym(sword),
  ];

  return {
    id: 'deathblade',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      accA: { parent: 'head', at: [0, 5.85, -2.1], kind: 'bob', k: 0.85, rest: -14 },
      capeA: { parent: 'hips', at: [0, 1.05, -1.62], kind: 'cape', k: 1.0 },
      capeB: { parent: 'capeA', at: [0, -2.25, 0], kind: 'cape', k: 0.9 },
    },
    tip: { bone: 'gripR', p: [-tipL[0], tipL[1], tipL[2]] },
    grip: { L: { rot: [-20, 0, 0] }, R: { rot: [-20, 0, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.62, stride: 38, knee: 72, armSwing: 14, elbow: 40, bounce: 0.4, lean: 20, sway: 2, twist: 10, heavy: 0, headBob: 0.6, armOut: 14, idle: 1.0 },
      stance: DEATHBLADE_STANCE,
      stanceRun: 0.45,
      victory: 'cheer',
    },
  };
}
