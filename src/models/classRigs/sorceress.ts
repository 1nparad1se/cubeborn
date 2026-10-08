import { DEFAULT_PROPS, type HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart, V3 } from '../../render/rig/shapes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { curve, seg, softFace } from './kitRanged';

/**
 * Sorceress: an elemental battle-mage in midnight and violet robes with glowing arcane runes
 * and gold. High flared collar, asymmetrical crystal pauldron on the right shoulder, crystal
 * belt, long silver hair under a horned crystal circlet, glowing eyes. Her focus, a floating
 * arcane orb ringed by shards, hovers above the raised left palm on the accB spin bone; a
 * short crystal wand rests in the right hand.
 */
export function sorceressRig(): HeroRigDef {
  const pr = { ...DEFAULT_PROPS, thigh: 3.5, shin: 3.4, foot: 1.2, hipX: 1.25, spine: 1.6, shoulderX: 3.15, shoulderY: 3.4, upperArm: 2.8, foreArm: 2.6, neck: 4.0, depth: 3.0 };
  const violet = 0x5a2f8e;
  const violetD = 0x341c58;
  const night = 0x1c2052;
  const nightD = 0x121434;
  const gold = 0xe8bc4e;
  const goldD = 0xa8802e;
  const rune = 0xc07aff;
  const rune2 = 0x7ad8ff;
  const skin = 0xf0d2ba;
  const hair = 0xdcd8f0;
  const hairD = 0xb4acd8;
  const crystal = 0xb68cff;

  // collar wing profile (left; mirrored)
  const runes = (b: string, pts: V3[], s = 0.32): RigPart[] => pts.map((p, i) => P(b, p, [s, s * (i % 2 ? 1.6 : 1), 0.1], i % 3 === 2 ? rune2 : rune, { g: true, s: i % 2 ? 'box' : 'gem' }));

  const parts: RigPart[] = [
    // ---- legs: dark leggings, thigh-high boots with gold knee guards
    ...legs(pr, { pants: nightD, boots: night, thighW: 1.9, shinW: 1.75, cuff: 3.2, cuffColor: night, knee: gold, toe: violetD, sole: 0x0c0c20 }),
    ...sym([
      P('shinL', [0, -0.05, 0.92], [0.6, 0.6, 0.2], rune, { s: 'gem', g: true }),
      P('legL', [0, -2.9, 0], [2.2, 0.4, 2.15], violet, { flat: true }),
      P('shinL', [0, -1.6, 0.95], [0.16, 1.6, 0.1], gold, { flat: true }),
    ]),

    // ---- torso: midnight bodice with violet overlay, gold crystal belt
    ...torso(pr, { shirt: night, pants: violetD, chestW: 4.5, flare: 1.16, chestD: 3.0, chestH: 3.8, waistW: 3.7 }),
    P('chest', [0, 1.3, 1.45], [3.2, 2.6, 0.3], violet, { t: [1.2, 1] }),
    P('chest', [0, 2.4, 1.62], [1.1, 1.2, 0.3], rune, { s: 'gem', g: true }),
    P('chest', [0, 2.4, 1.55], [1.8, 1.8, 0.2], gold, { s: 'gem' }),
    ...sym([seg('chest', [0.35, 0.1, 1.62], [1.6, 2.9, 1.66], [0.22, 0.12], gold, { flat: true })]),
    P('spine', [0, 0.6, 0], [4.0, 1.85, 3.0], violetD, { s: 'rbox', t: [1.05, 1.04], bv: [0.6, 0] }),
    P('spine', [0, 0.1, 0], [4.1, 0.45, 3.1], gold, { flat: true }),
    P('hips', [0, 1.05, 0], [4.4, 0.8, 3.0], goldD, { s: 'rbox', bv: [0.5, 0.1] }),
    P('hips', [0, 1.05, 1.5], [1.3, 1.1, 0.4], gold, { s: 'rbox', bv: [0.3, 0.2] }),
    P('hips', [0, 1.05, 1.75], [0.7, 0.9, 0.35], rune, { s: 'gem', g: true }),
    ...sym([P('hips', [1.5, 1.0, 1.35], [0.45, 0.7, 0.4], rune2, { s: 'gem', g: true }), P('hips', [2.15, 0.95, 0.4], [0.45, 0.7, 0.45], rune, { s: 'gem', g: true }), P('hips', [2.25, 0.2, 0.3], [0.5, 1.3, 0.5], crystal, { s: 'gem', g: true, r: [0, 0, 8] })]),
    // battle robe: open-front coat skirt with long side panels and a back tail
    P('hips', [0, -0.35, -0.2], [4.4, 1.9, 3.1], violet, { s: 'rbox', t: [0.95, 0.95], bv: [0.6, 0] }),
    ...sym([
      P('hips', [1.85, -2.6, -0.15], [1.2, 5.6, 3.0], violet, { t: [0.75, 0.9], sh: [-0.25, 0] }),
      P('hips', [2.0, -5.45, -0.15], [1.35, 0.25, 3.1], gold, { flat: true }),
      P('hips', [2.48, -2.6, -0.15], [0.1, 4.6, 0.3], rune, { g: true, flat: true }),
    ]),
    P('skirtF', [0, -1.15, 0.35], [2.3, 2.4, 0.3], violetD, { t: [0.85, 1] }),
    P('skirtF', [0, -2.4, 0.35], [2.0, 0.6, 0.32], violetD, { t: [1.2, 1] }),
    P('skirtF', [0, -2.7, 0.35], [1.1, 0.7, 0.3], gold, { s: 'gem', flat: true }),
    P('skirtF', [0, -1.3, 0.55], [0.5, 0.7, 0.1], rune, { s: 'gem', g: true }),
    P('skirtB', [0, -4.0, -0.35], [4.2, 7.8, 0.4], violet, { t: [0.72, 1] }),
    P('skirtB', [0, -4.0, -0.58], [3.6, 7.4, 0.1], night, { t: [0.7, 1], flat: true }),
    ...runes('skirtB', [[0, -2.0, -0.66], [0, -3.4, -0.66], [0, -4.8, -0.66], [0, -6.2, -0.66]], 0.5),
    P('skirtB', [0, -7.9, -0.35], [4.3, 0.3, 0.46], gold, { flat: true }),
    ...sym([P('skirtB', [1.4, -8.3, -0.35], [1.4, 0.7, 0.4], violet, { t: [0.3, 1], r: [180, 0, 0] })]),

    // ---- arms: fitted midnight sleeves, gold bracers with runes, flared cuffs
    ...arms(pr, { sleeve: night, skin, fore: violetD, upperW: 1.5, foreW: 1.5, shoulderSize: 1.9 }),
    ...sym([
      P('foreL', [0, -1.5, 0.03], [1.8, 1.8, 1.8], gold, { s: 'rbox', t: [0.88, 0.88], bv: [0.4, 0.15] }),
      P('foreL', [0.92, -1.5, 0.03], [0.1, 0.9, 0.5], rune, { g: true, flat: true }),
      P('foreL', [0, -2.5, 0.03], [2.3, 0.6, 2.3], violet, { s: 'rbox', t: [0.75, 0.75], bv: [0.5, 0] }),
      P('armL', [0, -1.6, 0], [1.62, 0.28, 1.62], gold, { flat: true }),
    ]),
    // left shoulder: a light violet cap
    P('armL', [0.2, 0.0, 0], [2.2, 1.0, 2.3], violet, { s: 'rbox', t: [0.75, 0.8], bv: [0.5, 0.35] }),
    P('armL', [0.3, -0.45, 0], [2.3, 0.2, 2.4], gold, { flat: true }),
    // right shoulder: tiered pauldron with crystal spikes
    P('armR', [-0.4, 0.35, 0], [3.2, 1.2, 3.2], violetD, { s: 'rbox', t: [0.65, 0.75], bv: [0.8, 0.5] }),
    P('armR', [-0.7, -0.35, 0], [3.0, 0.9, 3.0], violet, { s: 'rbox', t: [0.8, 0.85], bv: [0.6, 0.3] }),
    P('armR', [-0.85, -0.85, 0], [3.05, 0.22, 3.05], gold, { flat: true }),
    P('armR', [-0.6, 0.9, 0], [2.2, 0.3, 2.2], gold, { s: 'cyl', n: 8 }),
    P('armR', [-1.75, 0.2, 0], [0.2, 0.8, 0.8], rune, { s: 'gem', g: true }),
    P('armR', [-0.9, 1.9, 0], [0.8, 2.2, 0.8], crystal, { s: 'gem', g: true, r: [0, 0, 22] }),
    P('armR', [-1.7, 1.4, 0.7], [0.55, 1.5, 0.55], rune2, { s: 'gem', g: true, r: [20, 0, 40] }),
    P('armR', [-1.6, 1.3, -0.8], [0.55, 1.4, 0.55], crystal, { s: 'gem', g: true, r: [-20, 0, 45] }),

    // ---- high flared collar behind the head
    P('chest', [0, 3.85, -0.3], [4.6, 0.9, 3.2], violetD, { s: 'rbox', t: [0.9, 0.9], bv: [0.6, 0.3] }),
    ...sym([
      P('chest', [1.9, 5.6, -1.2], [2.4, 4.0, 0.35], violet, { t: [1.6, 1], sh: [1.1, -0.5], r: [0, -28, 0] }),
      P('chest', [1.95, 5.6, -1.0], [2.0, 3.5, 0.1], night, { t: [1.6, 1], sh: [1.0, -0.45], r: [0, -28, 0], flat: true }),
      seg('chest', [0.75, 3.7, -0.75], [3.85, 7.6, -1.75], [0.24, 0.3], gold, { flat: true }),
      P('chest', [2.2, 5.9, -0.85], [0.45, 0.7, 0.1], rune, { s: 'gem', g: true, r: [0, -20, 0] }),
    ]),
    P('chest', [0, 5.0, -1.55], [1.4, 2.6, 0.35], violet),

    // ---- head: glowing eyes, silver hair, horned crystal circlet
    ...head({ skin, eyes: 0xd8a0ff, glowEyes: true, size: [5.4, 5.2, 5.1], mouth: 0xa85a6a, noEars: true }),
    ...softFace(skin, 0x2a1838, 0x9a4a66, 5.1).filter((p) => p.p[1] < 3),
    ...sym([P('head', [1.55, 3.55, 2.62], [1.3, 0.25, 0.1], 0x2a1838, { flat: true, r: [0, 0, -14] })]),
    P('head', [0, 3.95, 2.6], [0.32, 0.6, 0.1], rune, { s: 'gem', g: true }),
    P('head', [-0.5, 5.3, 2.32], [4.6, 1.2, 0.85], hair, { s: 'rbox', bv: [0.35, 0.4, 0.3], r: [0, 0, 6] }),
    P('head', [1.85, 4.7, 2.45], [1.3, 1.6, 0.6], hair, { r: [0, 0, -18] }),
    ...sym([
      P('head', [2.65, 3.3, 0.5], [0.75, 4.8, 3.8], hair, { s: 'rbox', bv: [0.3, 0.2, 0.3] }),
      P('head', [2.4, -0.4, 1.5], [0.9, 5.0, 1.0], hair, { s: 'rbox', t: [0.75, 1], bv: [0.3, 0.2, 0.3] }),
      P('head', [2.4, -2.1, 1.55], [0.75, 0.4, 0.95], gold, { flat: true }),
      P('head', [2.4, -3.2, 1.55], [0.6, 1.2, 0.8], hairD, { t: [0.3, 0.5] }),
    ]),
    P('head', [0, 3.6, -2.25], [5.6, 5.2, 1.3], hair, { s: 'rbox', bv: [0.5, 0.8, 0.4] }),
    P('head', [0, 5.95, -0.3], [5.5, 0.9, 5.0], hair, { s: 'rbox', bv: [1.2, 0.4] }),
    P('accC', [0, -3.0, -0.1], [4.2, 6.4, 1.0], hair, { s: 'rbox', t: [1.15, 1], bv: [0.5, 0.3, 0.4] }),
    P('accC', [0, -6.9, -0.2], [3.4, 1.8, 1.0], hairD, { t: [1.4, 1] }),
    ...[-1.3, 0, 1.3].map((x) => P('accC', [x, -3.4, -0.85], [0.16, 5.4, 0.1], hairD, { flat: true })),
    P('accC', [0, -1.0, -0.82], [1.6, 0.5, 0.2], gold, { flat: true }),
    P('accC', [0, -1.0, -0.95], [0.5, 0.6, 0.15], rune, { s: 'gem', g: true }),
    // circlet: gold band, a central diamond and two swept-back crystal horns
    P('head', [0, 5.15, 0.05], [5.65, 0.42, 5.3], gold, { s: 'cyl', n: 10, r: [-6, 0, 0] }),
    P('head', [0, 5.6, 2.75], [1.2, 1.8, 0.4], goldD, { s: 'gem' }),
    P('head', [0, 5.65, 2.9], [0.75, 1.4, 0.35], rune, { s: 'gem', g: true }),
    ...sym([
      ...curve('head', [[2.4, 5.3, 1.4], [3.1, 6.6, 0.4], [3.4, 8.2, -1.2], [3.2, 9.4, -2.6]], [0.5, 0.5], goldD, { taper: 0.5 }),
      P('head', [3.25, 7.6, -0.6], [0.7, 2.2, 0.7], crystal, { s: 'gem', g: true, r: [-35, 0, -10] }),
      P('head', [3.25, 9.6, -2.8], [0.45, 1.0, 0.45], rune, { s: 'gem', g: true, r: [-45, 0, 0] }),
    ]),

    // ---- short crystal wand (gripR): dark shaft, gold collar, glowing tip
    P('gripR', [0, -0.8, 0.35], [0.45, 1.6, 0.45], night, { s: 'cyl', n: 6 }),
    P('gripR', [0, -0.8, 2.1], [0.4, 3.6, 0.4], violetD, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('gripR', [0, -0.8, -0.1], [0.65, 0.65, 0.5], gold, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('gripR', [0, -0.8, 3.8], [0.7, 0.4, 0.7], gold, { s: 'cyl', n: 6, r: [90, 0, 0] }),
    P('gripR', [0, -0.8, 4.7], [0.6, 0.6, 1.3], rune2, { s: 'gem', g: true }),

    // ---- floating focus above the left palm (spin bone): core, shell, orbiting shards
    P('accB', [0, 0, 0], [2.1, 2.1, 2.1], 0xe4c4ff, { s: 'ball', g: true }),
    P('accB', [0, 0, 0], [0.8, 3.0, 0.8], rune, { s: 'gem', g: true }),
    P('accB', [0, 0, 0], [3.0, 0.8, 0.8], rune2, { s: 'gem', g: true }),
    ...[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return P('accB', [Math.sin(a) * 2.5, Math.cos(a) * 2.5, 0.2 * (i % 2 ? 1 : -1)], [0.45, 0.9, 0.45], i % 2 ? rune2 : crystal, { s: 'gem', g: true, r: [0, 0, (-a * 180) / Math.PI] });
    }),
    ...[0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      return P('accB', [Math.sin(a) * 1.7, Math.cos(a) * 1.7, 1.1], [0.22, 0.22, 0.22], 0xffffff, { s: 'gem', g: true });
    }),
  ];

  return {
    id: 'sorceress',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'handL', at: [0, -1.2, 3.0], kind: 'spin', axis: 'z', speed: 2.2 },
      accC: { parent: 'head', at: [0, 2.6, -2.75], kind: 'bob', k: 1.5 },
    },
    tip: { bone: 'accB', p: [0, 0, 0] },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.5, stride: 24, knee: 32, armSwing: 8, elbow: 12, bounce: 0.15, lean: 4, sway: 4, twist: 6, heavy: 0, headBob: 0.4, armOut: 5, idle: 1.1 },
      stance: { chest: [-3, 8, 0], head: [-2, -6, 0], armL: [-34, -10, 14], foreL: [-60, 0, 0], handL: [0, 0, 0], armR: [-4, 0, -10], foreR: [-18, 0, 0], handR: [30, -25, 0] },
      stanceRun: 0.7,
      victory: 'raise',
    },
  };
}
