import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { arms, head, legs, P, sym, torso } from '../heroRigs/kit';
import { held, hem, props, ringY, rivets } from './kitHeavy';

/**
 * Berserker: the biggest frame of the roster. Dark iron and leather, a fur mantle, a horned
 * half-helm over a wild mane and braided beard, bare scarred forearms with riveted bracers,
 * a belt of skulls and chain, a torn red tabard, and a notched greatsword longer than he is
 * tall with a glowing red rune channel, carried on the right shoulder.
 */
export function berserkerRig(): HeroRigDef {
  const pr = props({ thigh: 3.5, shin: 3.3, foot: 1.7, hipX: 1.95, spine: 1.6, shoulderX: 5.0, shoulderY: 4.1, upperArm: 3.2, foreArm: 3.0, neck: 4.6, depth: 4.8 });
  const iron = 0x4c515c;
  const ironD = 0x33363e;
  const ironL = 0x737985;
  const bronze = 0xa07a46;
  const leather = 0x5e3d27;
  const leatherD = 0x3c281a;
  const fur = 0x7a6450;
  const furL = 0x9c8669;
  const furD = 0x54432f;
  const skin = 0xc98a64;
  const skinD = 0xa86c4c;
  const scar = 0xe8b398;
  const hair = 0x5a2a16;
  const hairD = 0x3e1c10;
  const red = 0xa8232a;
  const redD = 0x6e161c;
  const bone = 0xe4dac2;
  const boneD = 0xb8ab90;
  const socket = 0x1c1414;
  const rune = 0xff3a24;
  const runeHot = 0xffb27a;
  const steel = 0x5c616c;
  const edge = 0xbcc4d0;

  /** A small skull: cranium, jaw, eye sockets. */
  const skull = (b: string, x: number, y: number, z: number, k = 1, ry = 0): RigPart[] => [
    P(b, [x, y, z], [1.4 * k, 1.3 * k, 1.1 * k], bone, { s: 'rbox', bv: [0.35 * k, 0.4 * k], r: [0, ry, 0] }),
    P(b, [x, y - 0.75 * k, z + 0.1 * k], [0.95 * k, 0.5 * k, 0.8 * k], boneD, { r: [0, ry, 0] }),
    ...[-1, 1].map((sx) => P(b, [x + sx * 0.33 * k * Math.cos((ry * Math.PI) / 180), y + 0.05 * k, z + 0.56 * k], [0.38 * k, 0.38 * k, 0.12], socket, { flat: true, r: [0, ry, 0] })),
  ];

  const parts: RigPart[] = [
    // ---------------------------------------------------------------- legs and boots
    ...legs(pr, { pants: leatherD, boots: iron, thighW: 3.1, shinW: 2.8, knee: ironL, cuff: 2.5, cuffColor: furD, toe: ironL }),
    ...sym([
      // armoured boot shell, toe cap and thick sole
      P('footL', [0, -pr.foot * 0.5 + 0.2, 0.15], [2.95, pr.foot + 0.5, 3.0], iron, { s: 'rbox', bv: [0.6, 0.2] }),
      P('footL', [0, -pr.foot + 0.6, 1.25], [2.95, 1.2, 3.6], ironD, { s: 'rbox', t: [0.95, 0.85], bv: [0.7, 0.4] }),
      P('footL', [0, -pr.foot + 0.15, 0.8], [3.1, 0.3, 4.6], 0x221a14, { flat: true }),
      ...rivets('footL', [[0.9, -pr.foot + 0.9, 2.9], [-0.9, -pr.foot + 0.9, 2.9]], bronze),
      // fur boot tops
      P('shinL', [0, -pr.shin + 2.35, 0.05], [3.3, 0.9, 3.3], fur, { s: 'rbox', bv: [0.6, 0.35, 0.2] }),
      // thigh guard: riveted plate over the front and outside of the thigh
      P('legL', [0.35, -1.05, 0.35], [3.35, 2.4, 3.4], iron, { s: 'rbox', t: [1.08, 1.04], bv: [0.6, 0.3] }),
      P('legL', [0.4, -2.3, 0.4], [3.4, 0.3, 3.45], bronze, { flat: true }),
      ...rivets('legL', [[1.0, -0.2, 2.1], [-0.5, -0.2, 2.1], [2.08, -0.4, 0.6]], bronze),
      // knee spike
      P('shinL', [0, -0.2, 1.65], [0.8, 1.3, 0.8], ironL, { s: 'cyl', n: 4, t: [0, 0], r: [80, 0, 0] }),
      // leather shin straps
      P('shinL', [0, -1.6, 0.05], [3.0, 0.4, 3.05], leather, { flat: true }),
    ]),

    // ---------------------------------------------------------------- torso
    ...torso(pr, { shirt: ironD, pants: leatherD, belt: leather, chestW: 7.6, flare: 1.22, chestD: 4.8, chestH: 4.8, waistW: 6.4 }),
    // breastplate: two pectoral plates, central ridge, lower plate, rivets
    ...sym([
      P('chest', [1.75, 2.95, 2.3], [3.2, 2.5, 0.7], iron, { s: 'rbox', t: [1.08, 1], bv: [0.5, 0.35, 0.2], r: [0, 8, 0] }),
      ...rivets('chest', [[0.6, 3.9, 2.72], [3.0, 3.9, 2.55], [3.1, 2.0, 2.55]], bronze),
    ]),
    P('chest', [0, 2.6, 2.5], [0.8, 3.4, 0.6], ironL, { t: [0.6, 1] }),
    P('chest', [0, 0.85, 2.35], [6.6, 1.3, 0.55], iron, { s: 'rbox', bv: [0.4, 0.25, 0.25] }),
    // studded leather bands over the belly
    ...[-0.1, 0.65, 1.4].map((y) => P('spine', [0, y, 2.1], [5.9, 0.55, 0.35], leather, { flat: true })),
    ...rivets('spine', [-2, -1, 0, 1, 2].map((x) => [x * 1.1, 0.65, 2.32] as [number, number, number]), bronze, 0.3),
    // bandolier across the chest with a skull clasp
    P('chest', [0.1, 2.2, 2.78], [0.95, 7.6, 0.35], leather, { r: [0, 0, -40] }),
    P('chest', [0.1, 2.2, -2.5], [0.95, 7.6, 0.35], leather, { r: [0, 0, 40] }),
    ...skull('chest', 0.05, 2.3, 3.05, 0.85),
    // back plate ridge and harness
    P('chest', [0, 2.4, -2.45], [5.2, 3.6, 0.4], iron, { s: 'rbox', bv: [0.6, 0.3] }),
    ...rivets('chest', [[-2.1, 3.8, -2.7], [2.1, 3.8, -2.7], [-2.1, 1.0, -2.7], [2.1, 1.0, -2.7]], bronze),

    // ---------------------------------------------------------------- fur mantle
    P('chest', [0, 4.55, -0.1], [9.6, 2.0, 6.0], fur, { s: 'rbox', t: [0.8, 0.86], bv: [1.5, 0.7, 0.3] }),
    P('chest', [0, 5.55, -2.2], [7.2, 2.0, 1.7], furD, { s: 'rbox', t: [0.85, 0.7], bv: [0.6, 0.5] }),
    ...ringY('chest', [0, 5.2, -0.2], 3.7, 14, [1.7, 1.2, 1.3], furL, { s: 'rbox', bv: [0.4, 0.4] }),
    ...ringY('chest', [0, 3.8, -0.1], 4.2, 16, [1.5, 1.1, 1.0], furD, { t: [1.2, 1.1] }, 0.5),

    // ---------------------------------------------------------------- belt: skulls, chain, pouch
    P('hips', [0, 1.05, 0], [7.4, 1.25, 4.75], leather, { s: 'rbox', bv: [0.6, 0.15, 0.15] }),
    P('hips', [0, 1.05, 2.42], [2.2, 1.6, 0.3], iron, { flat: true }),
    ...skull('hips', 0, 1.15, 2.7, 1.0),
    ...skull('hips', 2.55, 0.85, 2.2, 0.7, 25),
    ...skull('hips', -2.55, 0.85, 2.2, 0.7, -25),
    // chain looping over the left hip
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const u = i / 6;
      return P('hips', [1.4 + u * 2.4, 0.3 - Math.sin(u * Math.PI) * 1.1, 2.3 - u * 1.4], i % 2 ? [0.55, 0.3, 0.5] : [0.3, 0.55, 0.55], steel, { flat: true, r: [0, -30, 0] });
    }),
    // pouch and a hanging fang charm on the right hip
    P('hips', [-3.55, 0.55, 0.4], [1.0, 1.7, 2.0], leather, { s: 'rbox', bv: [0.3, 0.3, 0.2] }),
    P('hips', [-3.65, 1.05, 0.4], [1.05, 0.65, 2.1], leatherD),
    P('hips', [-3.7, 0.7, 0.4], [0.3, 0.3, 0.3], bronze, { flat: true }),

    // ---------------------------------------------------------------- torn red tabard
    P('skirtF', [0, -2.1, 1.2], [4.4, 4.0, 0.4], red, { t: [1.12, 1] }),
    ...hem('skirtF', 0, 4.4, -4.05, 1.2, [1.1, 0.4, 1.5, 0.7, 1.2, 0.5], red),
    P('skirtF', [0, -0.1, 1.25], [4.5, 0.5, 0.5], redD),
    P('skirtF', [0, -2.0, 1.45], [0.5, 2.6, 0.1], bone, { flat: true, r: [0, 0, 35] }),
    P('skirtF', [0, -2.0, 1.45], [0.5, 2.6, 0.1], bone, { flat: true, r: [0, 0, -35] }),
    P('skirtB', [0, -2.4, -1.2], [5.2, 4.6, 0.4], redD, { t: [1.1, 1] }),
    ...hem('skirtB', 0, 5.2, -4.65, -1.2, [0.8, 1.6, 0.6, 1.3, 0.4, 1.0, 1.5], redD),

    // ---------------------------------------------------------------- arms
    ...arms(pr, { sleeve: leather, skin, fore: skin, glove: leatherD, upperW: 2.75, foreW: 2.65, shoulder: ironD, shoulderSize: 3.1 }),
    ...sym([
      // bracers on the lower forearm, bare scarred skin above
      P('foreL', [0, -2.0, 0.02], [3.0, 1.9, 3.0], iron, { s: 'rbox', t: [0.93, 0.93], bv: [0.5, 0.2, 0.2] }),
      P('foreL', [0, -1.0, 0.02], [3.1, 0.32, 3.1], bronze, { flat: true }),
      ...rivets('foreL', [[0, -2.0, 1.55], [0.9, -2.4, 1.5], [-0.9, -2.4, 1.5], [1.55, -2.0, 0]], bronze),
      P('foreL', [0.35, -0.35, 1.35], [1.3, 0.22, 0.12], scar, { flat: true, r: [0, 0, 28] }),
      P('foreL', [-0.4, -0.65, 1.35], [0.9, 0.2, 0.12], scar, { flat: true, r: [0, 0, -18] }),
      P('foreL', [1.35, -0.5, 0.2], [0.12, 0.2, 1.2], scar, { flat: true, r: [24, 0, 0] }),
      // leather-wrapped fists
      P('handL', [0, -0.75, 0.1], [1.95, 1.75, 2.0], leatherD, { s: 'rbox', bv: [0.45, 0.2, 0.4] }),
      P('handL', [0, -0.2, 0.1], [2.05, 0.35, 2.1], leather, { flat: true }),
      // arm straps
      P('armL', [0, -2.3, 0], [2.95, 0.45, 3.0], leatherD, { flat: true }),
    ]),
    // left pauldron: heavy layered plates with two spikes
    P('armL', [0.55, 0.25, 0], [4.5, 1.9, 4.6], iron, { s: 'rbox', t: [0.74, 0.8], bv: [1.0, 0.6] }),
    P('armL', [0.85, -0.85, 0], [4.5, 0.95, 4.7], ironD, { s: 'rbox', bv: [0.9, 0.2] }),
    P('armL', [1.05, -1.65, 0], [4.0, 0.85, 4.2], iron, { s: 'rbox', bv: [0.8, 0.2] }),
    P('armL', [0.9, -0.38, 0], [4.6, 0.28, 4.75], bronze, { flat: true }),
    P('armL', [1.4, 1.75, 0.7], [1.0, 2.6, 1.0], ironL, { s: 'cyl', n: 4, t: [0, 0], r: [10, 0, -28] }),
    P('armL', [1.3, 1.45, -1.0], [0.9, 2.1, 0.9], ironL, { s: 'cyl', n: 4, t: [0, 0], r: [-12, 0, -24] }),
    ...rivets('armL', [[2.85, -0.85, 1.5], [2.85, -0.85, -1.5], [3.05, -1.65, 0]], bronze),
    // right pauldron: lower and fur-topped (the greatsword rests here)
    P('armR', [-0.5, 0.0, 0], [4.2, 1.6, 4.4], iron, { s: 'rbox', t: [0.78, 0.82], bv: [0.9, 0.5] }),
    P('armR', [-0.8, -0.95, 0], [4.2, 0.9, 4.5], ironD, { s: 'rbox', bv: [0.8, 0.2] }),
    P('armR', [-0.85, -0.5, 0], [4.3, 0.26, 4.55], bronze, { flat: true }),
    P('armR', [-0.3, 0.75, -0.2], [3.0, 0.9, 3.6], furL, { s: 'rbox', bv: [0.6, 0.4] }),

    // ---------------------------------------------------------------- head
    ...head({ skin, eyes: 0x241410, eyeWhite: 0xe6d8c4, brows: hairD, size: [6.0, 5.6, 5.6], noLower: true }),
    P('head', [0, 2.35, 3.0], [1.0, 1.3, 0.75], skinD, { t: [0.8, 0.7] }),
    // scar over the left eye and a red war-paint bar under the eyes
    P('head', [1.25, 3.05, 2.92], [0.3, 2.7, 0.12], scar, { flat: true, r: [0, 0, 18] }),
    ...sym([P('head', [1.35, 2.3, 2.87], [1.4, 0.35, 0.1], red, { flat: true })]),
    // beard, moustache and a bronze-ringed braid
    P('head', [0, 1.0, 1.95], [5.4, 2.6, 2.4], hair, { s: 'rbox', t: [0.92, 0.95], bv: [0.8, 0.3, 0.5] }),
    P('head', [0, 1.75, 2.95], [3.4, 0.65, 0.55], hairD, { r: [0, 0, 0] }),
    ...sym([P('head', [1.75, 1.2, 3.0], [0.55, 1.4, 0.5], hairD, { r: [0, 0, -10] })]),
    P('head', [0, -0.6, 2.4], [1.3, 1.9, 1.1], hair, { s: 'rbox', bv: [0.3, 0.2, 0.3] }),
    P('head', [0, -1.0, 2.4], [1.5, 0.45, 1.25], bronze, { flat: true }),
    P('head', [0, -1.7, 2.4], [0.9, 0.8, 0.8], hairD, { t: [0.5, 0.5] }),
    // wild hair spilling from under the helm
    ...sym([P('head', [2.95, 3.3, -0.9], [0.7, 2.8, 3.4], hair, { s: 'rbox', bv: [0.25, 0.4, 0.4] })]),
    // horned half-helm: cap, brow band, rivets, nose guard, crest
    P('head', [0, 5.35, -0.1], [6.6, 2.7, 6.2], ironD, { s: 'rbox', t: [0.9, 0.9], bv: [1.3, 1.1] }),
    P('head', [0, 4.15, -0.05], [6.6, 0.75, 6.25], iron, { s: 'rbox', bv: [1.2, 0.15, 0.15] }),
    ...rivets('head', [[-2.4, 4.15, 3.0], [2.4, 4.15, 3.0], [-0.8, 4.15, 3.12], [0.8, 4.15, 3.12], [3.25, 4.15, 0.6], [-3.25, 4.15, 0.6]], bronze, 0.32),
    P('head', [0, 3.45, 3.1], [0.75, 2.1, 0.4], iron, { t: [0.6, 1] }),
    P('head', [0, 6.45, -0.3], [0.8, 0.9, 5.2], ironL, { s: 'rbox', bv: [0.25, 0.3] }),
    ...sym([
      P('head', [3.3, 4.9, 0.2], [1.6, 1.6, 1.7], bone, { s: 'rbox', bv: [0.4, 0.3], r: [0, 0, -70] }),
      P('head', [4.55, 5.75, 0.15], [1.35, 1.9, 1.4], bone, { s: 'rbox', bv: [0.35, 0.2], r: [0, 0, -38] }),
      P('head', [4.15, 5.35, 0.15], [1.55, 0.35, 1.55], boneD, { flat: true, r: [0, 0, -50] }),
      P('head', [5.2, 7.2, 0.25], [1.05, 1.9, 1.1], bone, { s: 'rbox', bv: [0.3, 0.2], r: [6, 0, -12] }),
      P('head', [5.3, 8.65, 0.45], [0.85, 1.5, 0.9], boneD, { s: 'cyl', n: 6, t: [0, 0], r: [16, 0, -2] }),
    ]),
    // mane on a spring behind the helm
    P('accC', [0, -1.1, -0.2], [5.4, 3.8, 1.5], hair, { s: 'rbox', t: [1.15, 1], bv: [0.5, 0.3, 0.5] }),
    ...[-1.8, -0.6, 0.6, 1.8].map((x, i) => P('accC', [x, -3.4 - (i % 2) * 0.5, -0.3], [1.2, 1.6 + (i % 2) * 0.8, 1.1], i % 2 ? hairD : hair, { t: [0.4, 0.5] })),

    // ---------------------------------------------------------------- greatsword (right hand; +z along the blade, +y toward the edge)
    ...greatsword(),
  ];

  function greatsword(): RigPart[] {
    const w = held('gripR', [0, -0.8, 0.35]);
    const out: RigPart[] = [
      // two-hand grip with wraps and a skull-crushing pommel
      w([0, 0, -0.85], [0.85, 4.5, 0.85], leatherD, { s: 'cyl', n: 6, r: [90, 0, 0] }),
      ...[-2.4, -1.2, 0.2].map((z) => w([0, 0, z], [1.0, 0.3, 1.0], leather, { s: 'cyl', n: 6, r: [90, 0, 0] })),
      w([0, 0, -3.5], [1.5, 1.5, 1.4], ironD, { s: 'rbox', bv: [0.45, 0.4, 0.4], r: [90, 0, 0] }),
      w([0, 0, -4.35], [0.9, 0.9, 0.7], iron, { s: 'cyl', n: 4, t: [0.2, 0.2], r: [-90, 0, 0] }),
      ...[-1, 1].map((sx) => w([sx * 0.62, 0, -3.5], [0.25, 0.7, 0.7], rune, { g: true })),
      // crossguard: heavy, swept toward the blade, with a glowing heart gem
      w([0, 0, 1.6], [1.2, 6.2, 1.1], iron, { s: 'rbox', bv: [0.35, 0.3, 0.3] }),
      ...[-1, 1].map((sy) => w([0, sy * 3.25, 2.05], [1.05, 1.0, 1.8], ironD, { r: [sy * -25, 0, 0] })),
      ...[-1, 1].map((sx) => w([sx * 0.62, 0, 1.6], [0.25, 1.1, 0.9], rune, { g: true })),
      // ricasso
      w([0, 0, 3.0], [0.9, 2.8, 2.2], steel, { s: 'rbox', bv: [0.3, 0.2] }),
      ...[-1, 1].map((sy) => w([0, sy * 1.55, 3.3], [0.75, 0.6, 1.6], ironD)),
      // broad blade: dark core, bright notched edges, red rune channel
      w([0, 0, 13.6], [0.75, 3.4, 19.2], steel),
      w([0, 0, 24.9], [0.75, 3.2, 3.4], steel, { r: [90, 0, 0], t: [0.6, 0.06] }),
      w([0, 0, 13.6], [0.95, 0.75, 16.0], rune, { g: true }),
      w([0, 0, 13.6], [0.97, 0.3, 15.0], runeHot, { g: true }),
      ...[6.4, 9.6, 12.8, 16.0, 19.2].map((z, i) => w([0, (i % 2 ? 1 : -1) * 0.55, z], [0.99, 0.45, 0.9], rune, { g: true })),
    ];
    // edges in segments: the gaps read as notches in the steel
    const segs: [number, number][] = [[4.2, 9.0], [9.5, 15.2], [15.9, 18.6], [19.0, 23.6]];
    const segs2: [number, number][] = [[4.2, 7.4], [8.0, 13.0], [13.4, 20.4], [21.0, 23.6]];
    for (const [sy, list] of [[1, segs], [-1, segs2]] as const)
      for (const [a, b] of list) out.push(w([0, sy * 1.9, (a + b) / 2], [0.5, 0.65, b - a], edge));
    out.push(w([0, 0, 25.0], [0.5, 3.0, 4.4], edge, { r: [90, 0, 0], t: [0.6, 0.06] }));
    return out;
  }

  return {
    id: 'berserker',
    scale: 0.09,
    props: pr,
    parts,
    springs: {
      accC: { parent: 'head', at: [0, 3.6, -3.0], kind: 'bob', k: 0.8 },
    },
    tip: { bone: 'gripR', p: [0, -0.8, 0.35 + 24] },
    grip: { R: { rot: [-8, -15, -33] } },
    anim: {
      weapon: 'hammer',
      gait: { cadence: 0.42, stride: 30, knee: 42, armSwing: 6, elbow: -22, bounce: 0.6, lean: 7, sway: 5, twist: 5, heavy: 1, headBob: 2, armOut: 14, idle: 0.9 },
      stance: { chest: [-3, -6, 0], armR: [-57, -21, 15], foreR: [-37, 0, 0], handR: [-35, 9, -35], armL: [4, 0, 9], foreL: [-22, 0, 0], legL: [-3, 0, 5], legR: [3, 0, -5] },
      stanceRun: 1,
      victory: 'raise',
    },
  };
}

