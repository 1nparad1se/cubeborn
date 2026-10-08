import { DEFAULT_PROPS, type HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart, V3 } from '../../render/rig/shapes';
import { arms, head, legs, P, shade, sym, torso } from '../heroRigs/kit';
import { curve, seg } from './kitRanged';

/**
 * Ranger: a light, agile hunter in layered teal and olive leathers. Peaked hood with a hawk
 * feather, shoulder mantle, rust scarf tail, quiver over the right shoulder, bracer on the bow
 * arm and a big recurve longbow in the left hand (limbs along the hand's z axis, string on +y).
 */
export function rangerRig(): HeroRigDef {
  const pr = { ...DEFAULT_PROPS, thigh: 3.5, shin: 3.4, foot: 1.3, hipX: 1.35, spine: 1.5, shoulderX: 3.45, shoulderY: 3.6, upperArm: 2.9, foreArm: 2.7, neck: 4.15, depth: 3.3 };
  const teal = 0x2c6a66;
  const tealD = 0x1d4744;
  const tealL = 0x4a9488;
  const oliveD = 0x434826;
  const leather = 0x8c5a32;
  const leatherD = 0x54361f;
  const leatherL = 0xb27d4a;
  const linen = 0xd9caa2;
  const bronze = 0xcc9c4c;
  const rust = 0xa8452a;
  const skin = 0xd4a27a;
  const hair = 0x4a2c1a;
  const wood = 0x7a4e2c;
  const woodL = 0xa8743e;

  // quiver axis: leans so the fletchings stick out over the right shoulder
  const qa = (24 * Math.PI) / 180;
  const q = (s: number, dx = 0, dz = 0): V3 => [-Math.sin(qa) * s + dx * Math.cos(qa), Math.cos(qa) * s + dx * Math.sin(qa), dz];

  // recurve limb profile in the bow plane: (y toward the string, z along the bow)
  const limb: [number, number][] = [[-0.95, 1.25], [-0.82, 2.9], [-0.42, 4.5], [0.12, 5.75], [0.5, 6.55], [0.2, 7.2], [-0.25, 7.55]];
  const bz = 0.3;
  const up = limb.map(([y, z]) => [0, y, bz + z] as V3);
  const dn = limb.map(([y, z]) => [0, y, bz - z] as V3);

  const parts: RigPart[] = [
    // ---- legs: olive breeches, soft wrapped boots, knee pads, thigh straps and a knife
    ...legs(pr, { pants: oliveD, boots: leatherD, thighW: 2.1, shinW: 1.9, cuff: 2.5, cuffColor: leather, knee: leatherL, sole: 0x2e1e12 }),
    ...sym([
      P('shinL', [0, -1.65, 0], [2.18, 0.28, 2.22], leatherD, { flat: true }),
      P('shinL', [0, -2.3, 0], [2.24, 0.24, 2.28], leatherD, { flat: true }),
      P('shinL', [0, -2.4, 1.15], [0.7, 1.7, 0.14], linen, { flat: true }),
      P('shinL', [0, -0.15, 0.95], [0.9, 0.5, 0.25], bronze, { flat: true }),
      P('footL', [0, -0.45, 1.85], [1.7, 0.5, 0.7], leather, { s: 'rbox', bv: [0.3, 0.2] }),
      P('legL', [0, -1.7, 0], [2.3, 0.32, 2.25], leatherD, { flat: true }),
    ]),
    P('legR', [-1.12, -1.85, 0.2], [0.45, 2.2, 0.75], leatherD, { s: 'rbox', bv: [0.15, 0.1] }),
    P('legR', [-1.18, -0.55, 0.2], [0.35, 0.7, 0.35], bronze),
    P('legR', [-1.18, 0.0, 0.2], [0.4, 0.5, 0.45], 0x3a281a),

    // ---- torso: teal jerkin, layered leather cuirass, belt with pouches
    ...torso(pr, { shirt: teal, pants: oliveD, belt: leatherD, buckle: bronze, chestW: 5.0, flare: 1.2, chestD: 3.3, chestH: 4.0, waistW: 4.3 }),
    P('chest', [0, 1.55, 1.58], [4.0, 3.1, 0.42], leather, { s: 'rbox', t: [1.12, 1], bv: [0.35, 0.2] }),
    P('chest', [0, 0.25, 1.82], [4.1, 0.28, 0.12], leatherD, { flat: true }),
    ...sym([P('chest', [0.75, 1.6, 1.82], [0.12, 2.6, 0.1], leatherL, { flat: true })]),
    P('chest', [0, 1.6, -1.55], [4.2, 3.2, 0.4], leather, { s: 'rbox', t: [1.12, 1], bv: [0.35, 0.2] }),
    P('spine', [0, 0.6, 0], [4.55, 1.3, 3.25], leatherD, { s: 'rbox', bv: [0.5, 0.1] }),
    ...[-1.2, 0, 1.2].map((x) => P('spine', [x, 0.6, 1.66], [0.9, 1.1, 0.12], leatherL, { flat: true })),
    // quiver strap across the chest and back
    seg('chest', [2.05, 3.85, 1.6], [-2.15, -0.1, 1.98], [0.62, 0.22], leatherD),
    seg('chest', [2.05, 3.85, -1.55], [-2.15, -0.1, -1.92], [0.62, 0.22], leatherD),
    P('chest', [0.85, 2.85, 1.98], [0.8, 0.8, 0.22], bronze, { s: 'gem' }),
    P('chest', [-0.75, 1.25, 2.12], [0.95, 1.05, 0.55], leatherL, { s: 'rbox', bv: [0.25, 0.2] }),
    P('chest', [-0.75, 1.55, 2.4], [0.95, 0.5, 0.1], leatherD, { flat: true }),
    // tunic hem below the belt and split tabard flaps
    P('hips', [0, -0.55, 0], [4.85, 1.6, 3.55], teal, { s: 'rbox', t: [0.96, 0.96], bv: [0.6, 0] }),
    P('hips', [0, -1.3, 0], [4.95, 0.22, 3.6], tealL, { flat: true }),
    P('skirtF', [0, -1.25, 0.42], [2.5, 2.7, 0.32], teal, { t: [0.82, 1] }),
    P('skirtF', [0, -2.55, 0.42], [2.6, 0.26, 0.36], bronze, { flat: true }),
    P('skirtF', [0, -1.1, 0.6], [0.7, 0.7, 0.1], tealL, { s: 'gem', flat: true }),
    P('skirtB', [0, -1.35, -0.42], [3.2, 2.9, 0.32], tealD, { t: [0.8, 1] }),
    P('skirtB', [0, -2.75, -0.42], [3.3, 0.26, 0.36], bronze, { flat: true }),
    // belt pouches, horn and a knife at the back
    ...sym([P('hips', [1.85, 0.55, 1.42], [1.15, 1.25, 0.85], leather, { s: 'rbox', bv: [0.25, 0.2, 0.1] }), P('hips', [1.85, 1.0, 1.88], [1.2, 0.45, 0.12], leatherD, { flat: true }), P('hips', [1.85, 0.85, 1.95], [0.3, 0.3, 0.1], bronze, { flat: true })]),
    P('hips', [-2.3, 0.45, -0.6], [0.8, 1.6, 0.8], linen, { s: 'cyl', n: 6, t: [0.55, 0.55], r: [0, 0, 70] }),
    P('hips', [-2.55, 0.25, -0.6], [0.95, 0.4, 0.95], bronze, { s: 'cyl', n: 6, r: [0, 0, 70] }),
    seg('hips', [-0.4, 1.0, -1.85], [1.9, 0.6, -1.85], [0.6, 0.4], leatherD),
    seg('hips', [-0.4, 1.0, -1.85], [-1.4, 1.2, -1.85], [0.35, 0.35], 0x3a281a),

    // ---- arms: teal sleeves, leather spaulder (draw arm), long bracer (bow arm), gloves
    ...arms(pr, { sleeve: teal, skin, fore: tealD, glove: leatherD, upperW: 1.7, foreW: 1.7, shoulder: tealD, shoulderSize: 2.2 }),
    P('foreL', [0, -1.35, 0.03], [2.05, 2.3, 2.05], leather, { s: 'rbox', t: [0.86, 0.88], bv: [0.45, 0.15] }),
    ...[-0.6, -1.95].map((y) => P('foreL', [0, y, 0.03], [2.12, 0.24, 2.12], bronze, { flat: true, t: [0.95, 0.95] })),
    P('foreL', [1.05, -1.3, 0.03], [0.18, 1.2, 1.0], leatherL, { flat: true }),
    P('foreL', [1.12, -1.3, 0.03], [0.14, 0.55, 0.55], bronze, { s: 'gem', flat: true }),
    P('foreR', [0, -1.9, 0.02], [1.95, 1.3, 1.95], leatherD, { s: 'rbox', t: [0.9, 0.9], bv: [0.4, 0.1] }),
    P('foreR', [0, -1.35, 0.02], [2.0, 0.22, 2.0], leatherL, { flat: true }),
    P('armR', [-0.35, 0.1, 0], [2.65, 0.9, 2.65], leather, { s: 'rbox', t: [0.78, 0.82], bv: [0.5, 0.35] }),
    P('armR', [-0.55, -0.62, 0], [2.45, 0.75, 2.5], leatherD, { s: 'rbox', t: [0.86, 0.9], bv: [0.4, 0.2] }),
    P('armR', [-0.65, -1.05, 0], [2.5, 0.18, 2.55], bronze, { flat: true }),
    ...sym([P('handL', [0, -0.25, 0.1], [1.6, 0.5, 1.72], leather, { flat: true })]),

    // ---- head: weathered face, short beard, scar
    ...head({ skin, eyes: 0x2a6a5a, brows: hair, size: [5.6, 5.3, 5.2], mouth: 0x8a4a3a, noEars: true }),
    P('head', [0, 0.95, 2.28], [3.4, 1.15, 0.5], hair, { s: 'rbox', bv: [0.3, 0.2, 0.3] }),
    P('head', [0, 0.65, 2.45], [1.6, 0.9, 0.5], hair, { t: [0.7, 0.8] }),
    ...sym([P('head', [1.95, 1.75, 2.45], [0.9, 1.6, 0.3], hair)]),
    P('head', [-1.75, 3.2, 2.66], [0.16, 1.5, 0.1], shade(skin, 0.72), { flat: true, r: [0, 0, 18] }),
    P('head', [0, 5.15, 2.3], [4.8, 0.75, 0.7], hair, { s: 'rbox', bv: [0.25, 0.2] }),
    // neck scarf
    P('chest', [0, 4.35, 0.15], [4.3, 1.15, 3.7], rust, { s: 'rbox', t: [0.9, 0.9], bv: [0.8, 0.3, 0.3] }),
    P('chest', [1.1, 4.05, 1.85], [1.0, 0.9, 0.6], shade(rust, 0.85), { s: 'rbox', bv: [0.25, 0.2] }),
    // peaked hood with a dark opening and the hawk feather
    P('head', [0, 3.95, -0.55], [6.5, 6.3, 5.6], teal, { s: 'rbox', t: [0.84, 0.88], bv: [1.5, 1.9] }),
    P('head', [0, 5.95, 2.15], [5.1, 1.0, 1.5], tealD, { s: 'rbox', bv: [0.4, 0.4] }),
    P('head', [0, 6.2, 2.75], [2.4, 0.65, 1.3], teal, { t: [0.25, 0.5], sh: [0, 0.35] }),
    ...sym([P('head', [2.9, 3.6, 1.75], [0.72, 4.5, 1.25], teal, { t: [1, 0.75] }), P('head', [2.62, 3.4, 2.5], [0.25, 4.0, 0.2], 0x16302e, { flat: true })]),
    P('head', [0, 5.38, 2.62], [4.8, 0.45, 0.12], 0x16302e, { flat: true }),
    P('head', [0, 4.45, -0.6], [6.6, 0.4, 5.7], leatherD, { s: 'rbox', t: [0.92, 0.93], bv: [1.5, 0.1] }),
    P('head', [3.15, 4.5, 0.2], [0.35, 0.8, 0.8], bronze, { flat: true }),
    ...curve('head', [[3.2, 4.5, 0.2], [3.5, 6.0, -1.3], [3.7, 7.3, -3.2], [3.75, 7.9, -4.9]], [0.14, 1.15], linen, { flat: true, taper: 0.7 }),
    seg('head', [3.25, 5.0, -0.3], [3.45, 5.9, -1.2], [0.18, 1.25], rust, { flat: true }),
    seg('head', [3.55, 6.75, -2.3], [3.62, 7.15, -2.9], [0.18, 1.2], rust, { flat: true }),
    seg('head', [3.7, 7.6, -4.0], [3.78, 7.95, -4.9], [0.2, 0.8], 0x2a1c14, { flat: true }),
    seg('head', [3.15, 4.2, 0.4], [3.75, 7.9, -4.9], [0.12, 0.12], leatherD, { flat: true }),
    P('accC', [0, -0.5, -0.7], [3.0, 2.6, 2.2], teal, { t: [0.3, 0.4], sh: [0, -0.7], r: [-34, 0, 0] }),
    // shoulder mantle with a leaf clasp
    P('chest', [0, 3.55, -0.1], [6.9, 1.7, 4.25], teal, { s: 'rbox', t: [0.72, 0.84], bv: [1.1, 0.5] }),
    P('chest', [0, 2.82, -0.1], [6.95, 0.24, 4.3], tealL, { flat: true }),
    ...sym([P('chest', [2.55, 2.4, 1.2], [1.4, 1.2, 0.3], teal, { t: [0.2, 1], r: [0, 25, 0] }), P('chest', [2.4, 2.4, -1.55], [1.5, 1.3, 0.3], teal, { t: [0.2, 1], r: [0, -25, 0] })]),
    P('chest', [0, 3.35, 2.1], [0.8, 1.2, 0.35], bronze, { s: 'gem', r: [0, 0, 45] }),
    // rust scarf tail (spring) trailing from the left of the neck
    P('capeA', [0, -1.5, 0], [1.35, 3.2, 0.32], rust, { t: [0.85, 1] }),
    P('capeB', [0, -1.3, 0], [1.25, 2.6, 0.3], shade(rust, 0.88), { t: [0.95, 1] }),
    ...[-0.4, 0, 0.4].map((x) => P('capeB', [x, -2.85, 0], [0.24, 0.7, 0.24], linen, { flat: true })),

    // ---- quiver over the right shoulder (bob spring)
    P('accB', q(0.9), [1.95, 5.6, 1.95], leather, { s: 'cyl', n: 8, r: [0, 0, 24] }),
    P('accB', q(-1.8), [2.05, 0.6, 2.05], leatherD, { s: 'cyl', n: 8, r: [0, 0, 24] }),
    P('accB', q(3.55), [2.25, 0.55, 2.25], leatherD, { s: 'cyl', n: 8, r: [0, 0, 24] }),
    P('accB', q(1.6), [2.05, 0.3, 2.05], bronze, { s: 'cyl', n: 8, r: [0, 0, 24], flat: true }),
    P('accB', q(0.5, 0, -1.0), [0.9, 2.2, 0.2], leatherL, { r: [0, 0, 24], flat: true }),
    P('accB', q(0.5, 0, -1.08), [0.4, 0.4, 0.12], bronze, { s: 'gem', flat: true }),
    ...([[-0.45, -0.25, rust], [0.35, -0.3, linen], [0, 0.4, rust], [-0.5, 0.45, teal], [0.5, 0.35, linen]] as [number, number, number][]).flatMap(([dx, dz, c], i) => [
      P('accB', q(4.1 + (i % 2) * 0.25, dx, dz), [0.2, 1.4, 0.2], woodL, { r: [0, 0, 24] }),
      P('accB', q(4.8 + (i % 2) * 0.25, dx, dz), [0.16, 1.1, 0.62], c, { r: [0, 0, 24], flat: true }),
      P('accB', q(4.8 + (i % 2) * 0.25, dx, dz), [0.62, 1.1, 0.16], c, { r: [0, 0, 24], flat: true }),
    ]),

    // ---- recurve longbow (gripL): wrapped grip, bronze-capped riser, curved limbs, string
    P('gripL', [0, -0.95, bz], [0.9, 1.0, 1.5], leatherD, { s: 'rbox', bv: [0.25, 0.15, 0.15] }),
    P('gripL', [0, -1.0, bz], [0.75, 0.85, 2.9], wood, { s: 'rbox', bv: [0.2, 0.15, 0.15] }),
    ...[-1, 1].map((k) => P('gripL', [0, -1.0, bz + k * 1.2], [0.92, 0.95, 0.3], bronze, { flat: true })),
    P('gripL', [0.48, -0.55, bz + 0.85], [0.18, 0.3, 0.6], leatherL, { flat: true }),
    ...curve('gripL', up, [0.62, 0.72], wood, { taper: 0.6 }),
    ...curve('gripL', dn, [0.62, 0.72], wood, { taper: 0.6 }),
    ...[up, dn].flatMap((pts) => [
      seg('gripL', pts[1], pts[2], [0.68, 0.3], woodL, { flat: true }),
      P('gripL', pts[4], [0.55, 0.5, 0.5], bronze),
      P('gripL', pts[6], [0.45, 0.45, 0.45], bronze, { s: 'gem' }),
    ]),
    P('gripL', [0, 0.5, bz], [0.1, 0.1, 13.1], linen, { flat: true }),
    // nocked arrow, shown while drawing
    P('gripL', [0.5, -0.3, bz + 0.45], [0.18, 7.4, 0.18], woodL, { grp: 'arrow' }),
    P('gripL', [0.5, -4.25, bz + 0.45], [0.55, 1.0, 0.55], 0xc8d4dc, { s: 'cyl', n: 4, t: [0, 0], r: [180, 0, 0], grp: 'arrow' }),
    P('gripL', [0.5, 2.6, bz + 0.45], [0.12, 1.2, 0.7], rust, { grp: 'arrow', flat: true }),
    P('gripL', [0.5, 2.6, bz + 0.45], [0.7, 1.2, 0.12], linen, { grp: 'arrow', flat: true }),
  ];

  return {
    id: 'ranger',
    scale: 0.085,
    props: pr,
    parts,
    springs: {
      capeA: { parent: 'chest', at: [1.5, 4.0, -1.85], kind: 'cape', k: 1.1 },
      capeB: { parent: 'capeA', at: [0, -3.0, 0], kind: 'cape', k: 1.0 },
      accB: { parent: 'chest', at: [-0.6, 1.3, -2.95], kind: 'bob', k: 1.8, rest: -6 },
      accC: { parent: 'head', at: [0, 5.4, -3.1], kind: 'bob', k: 0.9 },
    },
    tip: { bone: 'gripL', p: [0.5, -3.9, bz + 0.45] },
    hidden: ['arrow'],
    anim: {
      weapon: 'bow',
      gait: { cadence: 0.56, stride: 38, knee: 62, armSwing: 22, elbow: 30, bounce: 0.42, lean: 14, sway: 2, twist: 9, heavy: 0, headBob: 0.8, armOut: 3, idle: 0.9 },
      stance: { chest: [5, -6, 0], head: [-3, 6, 0], armL: [-12, 0, 7], foreL: [-22, 0, 0], handL: [-62, 0, 0], armR: [-6, 0, -4], foreR: [-28, 0, 0], handR: [0, 0, -6] },
      stanceRun: 0.85,
      victory: 'salute',
    },
  };
}
