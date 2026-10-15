import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/**
 * Summoner, a druid who calls nature spirits, built as a detailed block model (many small bevelled
 * blocks, no pixel skins): long centre-parted chestnut hair under an antler crown with leaves and
 * glowing tips, green leaf paint on the cheeks, a white robe with a teal gold-trimmed front panel and
 * a leaf brooch, a leaf sash, wide sleeves with teal and gold cuffs, a long split skirt over soft
 * boots, and a living-wood staff whose forked head cradles a glowing spirit crystal. Spirit wisps
 * orbit her on the accB spin bone.
 */

const SKIN = 0xeec2a0;
const SKIN_D = 0xd4a482;
const HAIR = 0x8a4a26;
const HAIR_L = 0xa25c32;
const HAIR_D = 0x6a3418;
const ROBE = 0xf0ece0;
const ROBE_L = 0xfcfaf2;
const ROBE_D = 0xcfc8b6;
const TEAL = 0x2a9a8a;
const TEAL_D = 0x1c6e64;
const TEAL_L = 0x5ad0b8;
const GOLD = 0xe8bc4a;
const GOLD_D = 0xb08a2a;
const LEAF = 0x5aa83a;
const LEAF_L = 0x7ac850;
const LEAF_D = 0x3a7a2a;
const WOOD = 0x7a5030;
const WOOD_L = 0xa0703e;
const WOOD_D = 0x4e321c;
const SPIRIT = 0x7affd8;
const ANTLER = 0xd8c8a4;
const ANTLER_D = 0xb0a280;
const BOOT = 0x8a6a46;
const BOOT_D = 0x6a4e30;

export function summonerRig(): HeroRigDef {
  const pr = mcProps(true);
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: face, leaf paint
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.4, 3.6, SKIN));
  add(bk('head', -1.3, -1.2, -1.3, 1.3, 0.6, 1.3, SKIN_D));
  add(bk('head', -0.45, 2.4, 3.5, 0.45, 3.4, 3.9, SKIN_D, { bv: 0.08 }));
  add(bk('head', -0.9, 1.3, 3.55, 0.9, 1.75, 3.8, 0xc06a62, { bv: 0 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.9, 3.5, 3.45, k * 2.7, 4.6, 3.75, 0xf6f4ee, { bv: 0 }));
    add(bk('head', k * 0.9, 3.5, 3.6, k * 1.8, 4.6, 3.85, 0x2a9a6a, { bv: 0 }));
    add(bk('head', k * 0.8, 4.8, 3.45, k * 2.7, 5.2, 3.8, HAIR_D, { bv: 0 }));
    add(bk('head', k * 2.0, 2.4, 3.5, k * 2.7, 3.1, 3.8, LEAF, { bv: 0 })); // leaf paint
    add(bk('head', k * 2.4, 2.0, 3.5, k * 2.9, 2.5, 3.8, LEAF_D, { bv: 0 }));
  }
  // long centre-parted hair
  add(bk('head', -4.0, 5.8, -4.0, 4.0, 8.4, 4.0, HAIR));
  add(bk('head', -4.0, -0.6, -4.2, 4.0, 6.4, -2.4, HAIR));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.25, 5.6, 3.3, k * 4.1, 7.0, 4.2, k > 0 ? HAIR_L : HAIR, { bv: 0.15, r: [0, 0, k * -6] }));
    add(bk('head', k * 3.2, -1.2, -4.0, k * 4.2, 6.4, 3.2, HAIR, { bv: 0.15 }));
    add(bk('head', k * 2.8, -2.6, 2.2, k * 4.0, 5.4, 3.9, HAIR_L, { bv: 0.15 })); // locks framing the face
    add(bk('head', k * 3.0, -3.4, 2.4, k * 3.8, -2.2, 3.6, HAIR_D, { bv: 0.12 }));
  }
  add(bk('head', -0.2, 6.4, 3.5, 0.2, 8.4, 4.2, HAIR_D, { bv: 0 })); // parting
  // long hair down the back (accC bob)
  for (let i = 0; i < 8; i++) {
    const x = -4 + i;
    const len = 8.4 + jr(i + 5) * 1.4;
    add(bk('accC', x, -len, -0.5, x + 1, 0.6, 0.5, i % 3 === 1 ? HAIR_D : i % 2 ? HAIR : HAIR_L, { bv: 0.1 }));
  }
  add(bk('accC', -1.0, -6.6, -0.75, 1.0, -5.8, 0.6, LEAF_D, { bv: 0.08 })); // leaf tie

  // antler crown: leafy band, branching tines, glowing tips
  add(bk('head', -4.3, 7.6, -4.3, 4.3, 8.4, 4.3, LEAF_D, { bv: 0.12 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.sin(a) * 4.3;
    const z = Math.cos(a) * 4.3;
    add(bk('head', x - 0.7, 7.9, z - 0.7, x + 0.7, 8.7, z + 0.7, i % 2 ? LEAF : LEAF_L, { bv: 0.15, r: [0, (a * 180) / Math.PI + 45, 0] }));
  }
  for (const k of [-1, 1]) {
    add(bk('head', k * 2.6, 8.2, -0.6, k * 3.4, 11.0, 0.4, ANTLER, { r: [0, 0, -k * 18] }));
    add(bk('head', k * 3.2, 10.4, -0.5, k * 4.0, 13.2, 0.5, ANTLER, { r: [0, 0, -k * 40] }));
    add(bk('head', k * 3.2, 10.2, -2.8, k * 4.0, 11.0, -0.2, ANTLER_D, { r: [30, 0, -k * 18] }));
    add(bk('head', k * 2.0, 11.0, -0.4, k * 2.8, 12.6, 0.4, ANTLER_D, { r: [0, 0, k * 10] }));
    add(bk('head', k * 4.8, 12.2, -0.1, k * 5.6, 13.0, 0.7, SPIRIT, { g: true, bv: 0.1 }));
    add(bk('head', k * 3.2, 10.8, -3.3, k * 4.0, 11.6, -2.5, SPIRIT, { g: true, bv: 0.1 }));
    add(bk('head', k * 2.0, 12.4, -0.4, k * 2.8, 13.2, 0.4, SPIRIT, { g: true, bv: 0.1 }));
  }
  add(bk('head', -0.9, 8.0, 3.8, 0.9, 9.0, 4.8, LEAF_L, { bv: 0.15 }));
  add(bk('head', -0.4, 8.2, 4.6, 0.4, 8.8, 5.0, SPIRIT, { g: true, bv: 0 }));

  // ---------------------------------------------------------------- chest: robe, teal panel, gold trim, brooch, hair on the shoulders
  add(bk('chest', -3.9, 0, -2.0, 3.9, 8.0, 2.0, ROBE));
  add(bk('chest', -1.6, 0, 1.9, 1.6, 6.4, 2.4, TEAL, { bv: 0.1 }));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 1.5, 0, 2.0, k * 2.1, 6.6, 2.55, GOLD, { bv: 0.06 }));
    add(bk('chest', k * 0.3, 6.0, 1.9, k * 2.6, 8.0, 2.45, ROBE_L, { bv: 0.15, r: [0, 0, k * -20] })); // collar
    add(bk('chest', k * 2.6, 3.0, 1.8, k * 4.0, 8.2, 2.7, HAIR, { bv: 0.12 })); // hair over the shoulders
    add(bk('chest', k * 2.8, 2.2, 1.9, k * 3.8, 3.2, 2.6, HAIR_D, { bv: 0.1 }));
    add(bk('chest', k * 3.5, 0.2, -2.2, k * 4.1, 7.6, 2.2, ROBE_D, { bv: 0.1 }));
  }
  add(bk('chest', -0.9, 6.0, 1.95, 0.9, 7.8, 2.3, SKIN, { bv: 0.06 })); // neckline
  add(bk('chest', -1.0, 3.6, 2.3, 1.0, 5.4, 2.8, LEAF, { bv: 0.15 })); // leaf brooch
  add(bk('chest', 0.0, 4.4, 2.6, 1.0, 5.4, 2.95, LEAF_D, { bv: 0 }));
  add(bk('chest', -0.3, 4.2, 2.7, 0.3, 4.8, 3.0, GOLD, { bv: 0 }));
  // leaf sash at the waist
  add(bk('chest', -4.2, -0.2, -2.3, 4.2, 1.0, 2.3, LEAF_D, { bv: 0.1 }));
  for (let i = 0; i < 8; i += 2) add(bk('chest', -4 + i, -0.2, 2.2, -3 + i, 1.0, 2.5, LEAF, { bv: 0.06 }), bk('chest', -4 + i, -0.2, -2.5, -3 + i, 1.0, -2.2, LEAF, { bv: 0.06 }));
  add(bk('chest', -0.8, -0.3, 2.4, 0.8, 1.1, 2.75, GOLD, { bv: 0.08 }));
  add(bk('spine', -3.7, 0.9, -1.9, 3.7, 3.9, 1.9, ROBE));
  add(bk('spine', -1.6, 0.9, 1.8, 1.6, 3.9, 2.3, TEAL, { bv: 0.08 }));
  for (const k of [-1, 1]) add(bk('spine', k * 1.5, 0.9, 1.85, k * 2.1, 3.9, 2.45, GOLD, { bv: 0.05 }));

  // ---------------------------------------------------------------- hips and the long split skirt
  add(bk('hips', -4.0, -0.6, -2.1, 4.0, 3.0, 2.1, ROBE_D));
  for (const k of [-1, 1]) {
    add(bk('hips', k * 4.1, -6.0, -2.5, k * 4.6, 2.0, 2.5, ROBE, { bv: 0.12 }));
    add(bk('hips', k * 4.15, -6.0, -2.55, k * 4.7, -5.3, 2.55, GOLD, { bv: 0.06 }));
    add(bk('hips', k * 4.15, -5.3, -2.55, k * 4.7, -4.7, 2.55, TEAL_D, { bv: 0.05 }));
  }
  for (const [bone, front] of [['skirtF', true], ['skirtB', false]] as const) {
    const z0 = front ? 0 : -0.5;
    const z1 = front ? 0.5 : 0;
    add(bk(bone, -4.5, -9.0, z0, 4.5, 0.2, z1, ROBE, { bv: 0.1 }));
    add(bk(bone, -4.6, -9.0, z0 - 0.05, 4.6, -8.2, z1 + 0.05, GOLD, { bv: 0.06 }));
    add(bk(bone, -4.6, -8.2, z0 - 0.05, 4.6, -7.6, z1 + 0.05, TEAL_D, { bv: 0.05 }));
    const fz0 = front ? z1 - 0.1 : z0 - 0.15;
    const fz1 = front ? z1 + 0.15 : z0 + 0.1;
    if (front) {
      add(bk(bone, -2.0, -7.6, fz0, 2.0, 0.2, fz1, TEAL, { bv: 0.06 }));
      for (const k of [-1, 1]) add(bk(bone, k * 1.9, -7.6, fz0, k * 2.5, 0.2, fz1 + 0.1, GOLD, { bv: 0.05 }));
      for (const [x, y, c] of [[0, -2.5, LEAF], [0, -5.5, LEAF], [-1, -4.4, LEAF_D], [1, -1.6, LEAF_D]] as const) add(bk(bone, x - 0.45, y - 0.45, fz1 - 0.05, x + 0.45, y + 0.45, fz1 + 0.12, c, { bv: 0 }));
    } else {
      for (let i = 0; i < 3; i++) add(bk(bone, -3 + i * 2.4, -7.6, fz0, -2.6 + i * 2.4, 0.2, fz1, ROBE_D, { bv: 0 })); // folds
    }
  }

  // ---------------------------------------------------------------- limbs, mirrored (slim arms: 3 wide)
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    // robe sleeve with a teal leaf mark
    add(bk(arm, -1.6, -5.0, -1.6, 1.6, 2.0, 1.6, ROBE));
    add(bk(arm, -1.8, 0.4, -1.8, 1.8, 2.3, 1.8, ROBE_L, { bv: 0.25 }));
    add(bk(arm, k * 1.55, -1.6, -0.4, k * 1.8, -0.6, 0.4, TEAL_L, { bv: 0 }));
    add(bk(arm, -1.7, -5.0, -1.7, 1.7, -4.4, 1.7, ROBE_D, { bv: 0.06 }));
    // wide flared sleeve, teal band, gold cuff
    add(bk(fore, -1.6, -3.0, -1.6, 1.6, 1.0, 1.6, ROBE));
    add(bk(fore, -2.1, -2.4, -2.3, 2.1, 0.2, 2.1, ROBE, { bv: 0.2 }));
    add(bk(fore, -2.2, -2.9, -2.4, 2.2, -1.9, 2.2, TEAL, { bv: 0.1 }));
    add(bk(fore, -2.25, -3.3, -2.45, 2.25, -2.8, 2.25, GOLD, { bv: 0.08 }));
    add(bk(fore, -2.15, -1.9, -2.6, 2.15, 0.0, -2.0, ROBE_D, { bv: 0.15 })); // hanging sleeve
    // bare hand
    add(bk(hand, -1.4, -2.0, -1.4, 1.4, 1.0, 1.4, SKIN));
    add(bk(hand, -1.2, -2.15, 0.9, 1.2, -1.0, 1.6, SKIN_D, { bv: 0.1 }));
    add(bk(hand, -1.5, 0.3, -1.5, 1.5, 0.9, 1.5, GOLD_D, { bv: 0.06 })); // bracelet
    // legs (mostly under the skirt) and soft boots with a leaf cuff
    add(bk(leg, -1.9, -6.0, -1.9, 1.9, 0.2, 1.9, ROBE_D));
    add(bk(shin, -1.85, -1.0, -1.85, 1.85, 1.0, 1.85, ROBE_D));
    add(bk(shin, -2.0, -5.0, -2.0, 2.0, -0.6, 2.0, BOOT));
    add(bk(shin, -2.2, -1.0, -2.2, 2.2, -0.3, 2.2, LEAF_D, { bv: 0.1 }));
    for (let i = 0; i < 4; i++) add(bk(shin, -2.0 + i, -0.6, -2.3, -1.0 + i, 0.4 + (i % 2) * 0.4, -2.0, LEAF, { bv: 0.05 }), bk(shin, -2.0 + i, -0.6, 2.0, -1.0 + i, 0.4 + ((i + 1) % 2) * 0.4, 2.3, LEAF, { bv: 0.05 }));
    add(bk(shin, -0.25, -4.4, 1.9, 0.25, -1.4, 2.15, BOOT_D, { bv: 0 }));
    add(bk(foot, -2.0, -1.0, -2.2, 2.0, 0.5, 3.0, BOOT));
    add(bk(foot, -1.6, -0.6, 2.4, 1.6, 0.3, 3.5, BOOT_D, { bv: 0.2 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, -0.7, 3.3, WOOD_D, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- spirit wisps on the spin bone
  for (const [x, y, z, sz] of [[7.5, 2, 1, 2], [-6, -1, -4, 2], [-2, 5, 7, 1], [3, -3, -7, 1]] as const) {
    add(bk('accB', x - sz / 2, y - sz / 2, z - sz / 2, x + sz / 2, y + sz / 2, z + sz / 2, sz > 1 ? SPIRIT : TEAL_L, { g: true, bv: 0.15 }));
    if (sz > 1) add(bk('accB', x - 0.4, y + 0.2, z - 0.4, x + 0.4, y + 1.4, z + 0.4, 0xe8fff8, { g: true, bv: 0.1 }));
  }

  // ---------------------------------------------------------------- living-wood staff along the hand's y axis
  const rows = [
    '.l.....',
    'lw..s..',
    '.w.sCs.',
    '.ww.s.w',
    '..w.s.w',
    '..wwwww',
    '...ww..',
    '...wL..',
    '...ww..',
    '...Gw..',
    '...wG..',
    '...ww..',
    '...ww..',
    '...wL..',
    '...ww..',
    '...ww..',
    '...bb..',
    '...bb..',
    '...bb..',
    '...ww..',
    '...ww..',
    '...wL..',
    '...ww..',
    '...ww..',
    '...ww..',
    '...ww..',
    '...wL..',
    '...ww..',
    '...ww..',
    '...GG..',
    '....G..',
  ];
  add(...pixelItem(rows, { w: WOOD, L: WOOD_L, b: WOOD_D, G: GOLD, l: LEAF, s: SPIRIT, C: 0xffffff }, { b: 'gripR', at: GRIP, pivot: [3.5, 17], px: 0.95, th: 0.95, u: '+z', v: '+y', glow: 'sC', thick: { s: 1.6, C: 2 } }));

  return {
    id: 'summoner',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      accB: { parent: 'chest', at: [0, 1, 0], kind: 'spin', axis: 'y', speed: 1.1 },
      accC: { parent: 'head', at: [0, 3.5, -4.6], kind: 'bob', k: 0.8 },
      skirtF: { parent: 'hips', at: [0, 1.6, 1.6], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 1.6, -1.6], kind: 'flap' },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1] + 15 * 0.95, GRIP[2] + 0.5 * 0.95] },
    grip: { R: { at: GRIP, rot: [8, 0, 18] }, L: { at: GRIP } },
    anim: {
      weapon: 'summon',
      gait: { cadence: 0.48, stride: 24, knee: 28, armSwing: 6, elbow: 10, bounce: 0.2, lean: 5, sway: 3, twist: 4, heavy: 0, headBob: 0.3, armOut: 8, idle: 1.0 },
      stance: { chest: [-2, 0, 0], head: [2, 0, 0], armR: [-8, 0, -14], foreR: [-30, 0, 0], handR: [38, 0, 0], armL: [-16, 0, 14], foreL: [-42, 0, 0], handL: [-6, -20, -14] },
      stanceRun: 0.85,
      victory: 'raise',
    },
  };
}
