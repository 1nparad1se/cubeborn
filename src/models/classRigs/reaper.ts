import { DEFAULT_PROPS, type HeroRigDef, type Proportions } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { bands, bladeTip, curvedBlade, tatters, type BladeOpts } from './kitAgile';

/** Idle stance (also the base the reaper action clips are authored against). */
export const REAPER_STANCE: PoseMap = {
  rootPos: [0, -1.0, 0],
  legL: [-26, -6, 7], shinL: [38, 0, 0], footL: [-12, 6, 0],
  legR: [-2, 8, -7], shinR: [30, 0, 0], footR: [-26, -8, 0],
  spine: [10, 0, 0], chest: [13, 6, 0], head: [-20, -4, 0],
  armL: [-22, 0, 24], foreL: [-42, 0, 0], handL: [0, 0, 0],
  armR: [-30, 0, -22], foreR: [-50, 0, 0], handR: [0, 0, 0],
};

/**
 * Reaper (Жнец): a shadow assassin wrapped in dark cloth under a deep hood, a white porcelain
 * mask with glowing violet eye slits, a long tattered cloak with violet runes and a small
 * curved dagger in each hand, held in a reverse grip.
 */
export function reaperRig(): HeroRigDef {
  const pr: Proportions = { ...DEFAULT_PROPS, thigh: 3.5, shin: 3.4, foot: 1.2, hipX: 1.35, spine: 1.6, shoulderX: 3.5, shoulderY: 3.6, upperArm: 3.0, foreArm: 2.8, neck: 4.1, depth: 3.2 };
  const cloak = 0x2a2634;
  const cloakD = 0x1a1722;
  const cloakL = 0x3a3448;
  const wrap = 0x3c3848;
  const wrapD = 0x2a2634;
  const wrapL = 0x55506a;
  const leather = 0x2e2626;
  const mask = 0xf0ebe2;
  const maskD = 0xc4bcb6;
  const violet = 0xb866ff;
  const violetD = 0x5a2c8c;
  const shadow = 0x0b0910;
  const steel = 0xb4b0c8;

  // ---------------------------------------------------------------- reverse-grip daggers (left authored, mirrored)
  const blade: BladeOpts = { b: 'gripL', at: [0, -0.8, -0.95], dir: -1, len: 3.7, curve: 40, w: 0.9, th: 0.22, seg: 4, steel, edge: violet, spine: 0x4a4660 };
  const dagger: RigPart[] = [
    P('gripL', [0, -0.8, 0.25], [0.5, 2.0, 0.5], leather, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('gripL', [0, -0.8, 1.35], [0.62, 0.62, 0.62], wrapL, { s: 'gem' }),
    P('gripL', [0, -0.8, 1.55], [0.38, 0.38, 0.38], violet, { s: 'gem', g: true }),
    P('gripL', [0, -0.8, -0.8], [0.5, 1.5, 0.35], wrapL, { s: 'rbox', bv: [0.12, 0.12] }),
    P('gripL', [0, -1.6, -0.62], [0.36, 0.65, 0.28], wrapL, { r: [40, 0, 0], t: [0.5, 0.6] }),
    ...curvedBlade(blade),
  ];
  const tipL = bladeTip(blade);

  const parts: RigPart[] = [
    // ---------------------------------------------------------- legs: wrapped trousers, soft boots
    ...legs(pr, { pants: wrapD, boots: leather, sole: 0x120e10, thighW: 2.05, shinW: 1.75, cuff: 2.6, cuffColor: wrap }),
    ...sym([
      ...[-0.85, -1.4, -1.95].map((y, i) => P('shinL', [0, y, 0.05], [2.25, 0.2, 2.3], wrapL, { r: [0, 0, i % 2 ? 10 : -10], flat: true })),
      ...[-1.0, -2.0].map((y) => P('legL', [0, y, 0], [2.25, 0.2, 2.2], wrap, { r: [0, 0, -8], flat: true })),
      P('footL', [0, -0.6, 2.2], [1.2, 0.5, 0.8], leather, { t: [0.4, 0.6] }),
    ]),

    // ---------------------------------------------------------- torso: wrapped tunic, harness, violet clasp
    ...torso(pr, { shirt: wrap, pants: wrapD, belt: leather, chestW: 4.8, flare: 1.2, chestD: 3.1, chestH: 3.9, waistW: 3.9 }),
    ...[0.6, 1.5, 2.4].map((y, i) => P('chest', [0, y, 0], [5.4 - i * 0.1, 0.35, 3.35], wrapL, { r: [0, 0, 14], flat: true })),
    ...sym([P('chest', [0.9, 2.3, 1.62], [0.45, 4.6, 0.3], leather, { r: [0, 0, -24] })]),
    P('chest', [0, 2.15, 1.82], [1.1, 1.1, 0.4], wrapL, { s: 'rbox', bv: [0.3, 0.15], r: [0, 0, 45] }),
    P('chest', [0, 2.15, 2.0], [0.65, 0.65, 0.4], violet, { s: 'gem', g: true }),
    // belt with a violet rune buckle and a hanging front sash
    P('hips', [0, 1.05, 1.62], [1.0, 0.9, 0.3], wrapL, { s: 'rbox', bv: [0.2, 0.1] }),
    P('hips', [0, 1.05, 1.8], [0.5, 0.5, 0.2], violet, { s: 'gem', g: true }),
    P('hips', [-1.6, 0.6, 1.0], [0.9, 1.0, 0.8], leather, { s: 'rbox', bv: [0.25, 0.2] }),
    P('skirtF', [0, -1.55, 0.45], [2.3, 3.1, 0.25], cloakD, { t: [1.2, 1] }),
    ...tatters('skirtF', -3.05, 0.45, 2.3, 3, 1.0, 0.24, cloakD),
    P('skirtF', [0, -2.0, 0.6], [0.3, 1.4, 0.1], violetD, { flat: true }),
    P('skirtB', [0, -1.4, -0.4], [3.4, 2.8, 0.25], cloakD, { t: [1.15, 1] }),
    ...tatters('skirtB', -2.75, -0.4, 3.4, 4, 1.0, 0.24, cloakD),

    // ---------------------------------------------------------- mantle and long tattered cloak
    P('chest', [0, 3.85, -0.35], [6.3, 1.5, 4.0], cloak, { s: 'rbox', t: [0.78, 0.86], bv: [1.0, 0.55] }),
    ...sym([
      P('chest', [2.75, 3.3, -0.2], [1.8, 1.6, 3.6], cloak, { s: 'rbox', t: [0.7, 0.9], bv: [0.5, 0.4], r: [0, 0, -18] }),
      ...[-0.75, 0, 0.75].map((z, i) => P('armL', [1.12, -1.0 - (i === 1 ? 0.35 : 0), z], [0.28, 1.6 + (i === 1 ? 0.6 : 0), 0.8], cloakD, { t: [1, 0.5], r: [180, 0, 6] })),
    ]),
    P('chest', [0, 3.35, 1.62], [2.4, 0.35, 0.3], violetD, { flat: true }),
    P('capeA', [0, -2.1, -0.1], [5.6, 4.6, 0.42], cloak, { t: [0.8, 1] }),
    P('capeA', [0, -0.25, 0.05], [4.6, 0.6, 0.6], cloakL, { s: 'rbox', bv: [0.2, 0.2] }),
    P('capeB', [0, -1.75, 0], [6.6, 3.6, 0.4], cloakD, { t: [0.86, 1] }),
    ...tatters('capeB', -3.5, 0, 6.6, 7, 3.4, 0.38, cloakD),
    // violet runes stitched into the cloak
    P('capeB', [0, -1.6, -0.24], [0.9, 0.9, 0.12], violet, { g: true, r: [0, 0, 45] }),
    P('capeB', [0, -1.6, -0.26], [0.4, 0.4, 0.12], cloakD, { flat: true, r: [0, 0, 45] }),
    ...sym([
      P('capeB', [1.5, -1.6, -0.24], [0.16, 1.0, 0.12], violet, { g: true }),
      P('capeB', [2.3, -2.05, -0.24], [0.16, 0.8, 0.12], violet, { g: true, r: [0, 0, 30] }),
      P('capeA', [1.9, -3.3, -0.36], [0.16, 0.9, 0.12], violetD, { flat: true, r: [0, 0, -20] }),
    ]),
    P('capeB', [0, -3.2, -0.24], [5.4, 0.16, 0.12], violetD, { flat: true }),
    // smoke curling off the hem
    ...[[-2.35, -6.3, 0.6], [0.0, -6.6, 0.6], [2.35, -6.0, 0.55]].map(([x, y, l]) => P('capeB', [x, y, -0.05], [0.7, l, 0.42], violetD, { flat: true })),

    // ---------------------------------------------------------- arms: wrapped sleeves, bracers with runes, gloves
    ...arms(pr, { sleeve: wrap, skin: wrapD, fore: wrapD, glove: leather, upperW: 1.6, foreW: 1.65, shoulder: cloak, shoulderSize: 2.1 }),
    ...sym([
      ...bands('armL', [-1.2, -1.8, -2.4], [1.85, 0.18, 1.85], wrapL),
      P('foreL', [0, -1.55, 0], [2.0, 1.9, 2.0], leather, { s: 'rbox', t: [0.86, 0.86], bv: [0.45, 0.2] }),
      P('foreL', [1.0, -1.55, 0], [0.12, 1.1, 0.3], violet, { g: true }),
      P('foreL', [0, -0.45, 0], [1.85, 0.2, 1.85], wrapL, { flat: true, r: [0, 0, 10] }),
    ]),

    // ---------------------------------------------------------- head: porcelain mask in a deep hood
    ...head({ skin: shadow, noFace: true, noEars: true, size: [5.0, 5.1, 4.2] }),
    P('head', [0, 3.35, 2.1], [4.1, 3.6, 0.8], mask, { s: 'rbox', t: [0.92, 1], bv: [1.0, 0.8, 0.2] }),
    P('head', [0, 1.25, 2.05], [3.5, 1.4, 0.7], mask, { s: 'rbox', r: [0, 0, 180], t: [0.5, 0.8], bv: [0.4, 0.1] }),
    ...sym([P('head', [1.4, 2.25, 2.4], [1.1, 0.7, 0.3], maskD, { s: 'rbox', bv: [0.25, 0.15], r: [0, 0, 18] })]),
    P('head', [0, 3.0, 2.55], [0.6, 1.5, 0.3], maskD, { t: [0.4, 1] }),
    P('head', [0, 4.75, 2.5], [3.2, 0.4, 0.2], maskD, { flat: true }),
    ...sym([
      P('head', [1.05, 3.55, 2.5], [1.65, 0.75, 0.12], shadow, { r: [0, 0, -14], flat: true }),
      P('head', [1.05, 3.55, 2.55], [1.3, 0.3, 0.12], violet, { r: [0, 0, -14], g: true }),
      P('head', [1.0, 2.6, 2.5], [0.14, 1.0, 0.1], violetD, { flat: true, r: [0, 0, 6] }),
    ]),
    ...[-0.5, 0, 0.5].map((x) => P('head', [x, 1.3, 2.42], [0.12, 0.6, 0.1], 0x5a5060, { flat: true })),
    P('head', [0, 4.3, 2.52], [0.45, 0.45, 0.14], violet, { g: true, s: 'gem' }),
    // deep hood: shell, brim casting a shadow, side flaps, inner darkness
    P('head', [0, 3.6, -0.6], [6.7, 6.4, 5.8], cloak, { s: 'rbox', t: [0.62, 0.72], bv: [2.0, 2.4] }),
    P('head', [0, 6.9, 1.2], [2.8, 1.5, 3.0], cloak, { t: [0.12, 0.25], sh: [0, 1.1] }),
    P('head', [0, 6.05, 2.3], [4.2, 1.3, 1.9], cloak, { s: 'rbox', t: [0.6, 1], bv: [0.45, 0.45], r: [12, 0, 0] }),
    P('head', [0, 5.55, 3.2], [3.9, 0.22, 0.25], violetD, { flat: true, r: [12, 0, 0] }),
    ...sym([P('head', [2.7, 3.0, 2.0], [0.8, 4.6, 1.9], cloak, { t: [0.7, 0.8], r: [0, -8, -9] })]),
    P('head', [0, 5.35, 2.3], [4.7, 0.6, 0.3], shadow, { flat: true }),
    ...sym([P('head', [2.35, 3.4, 2.3], [0.55, 4.6, 0.3], shadow, { flat: true })]),
    P('head', [0, 0.35, 1.0], [5.6, 1.2, 3.6], cloak, { s: 'rbox', bv: [0.9, 0.3] }),
    P('head', [0, 3.2, -3.55], [3.4, 3.4, 1.4], cloak, { s: 'rbox', t: [0.5, 0.6], sh: [0, 0.4], bv: [0.5, 0.4] }),

    // ---------------------------------------------------------- the daggers
    ...sym(dagger),
  ];

  return {
    id: 'reaper',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      // 'bob' keeps the long cloak trailing low instead of flying flat at a run
      capeA: { parent: 'chest', at: [0, pr.shoulderY + 0.3, -pr.depth / 2 - 0.45], kind: 'bob', k: 0.8, rest: -16 },
      capeB: { parent: 'capeA', at: [0, -4.3, 0], kind: 'bob', k: 0.6, rest: 8 },
    },
    tip: { bone: 'gripR', p: [-tipL[0], tipL[1], tipL[2]] },
    grip: { L: { rot: [-30, 0, 0] }, R: { rot: [-30, 0, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.5, stride: 30, knee: 42, armSwing: 8, elbow: 26, bounce: 0.12, lean: 10, sway: 1, twist: 5, heavy: 0, headBob: 0.2, armOut: 12, idle: 0.8 },
      stance: REAPER_STANCE,
      stanceRun: 0.75,
      victory: 'raise',
    },
  };
}
