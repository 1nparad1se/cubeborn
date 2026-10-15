import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Swamp drowned (Болотный утопленник): a hunched, long-armed goblinoid risen from the bog. Its
 * mottled teal, green and blue skin is streaked with lime slime that drips from the head, fists and
 * shoulders; it has a huge square head with stubby pointed ears, glowing yellow eyes under a heavy
 * brow and a toothy grin, a sodden blue shawl and rags with rusty buckles, a rotten leather belt,
 * and a rusty trident with bone-pale prongs.
 */

const T = 0x3f9a7c;
const TL = 0x5cb88e;
const TD = 0x2c7468;
const GR = 0x6aa848;
const BL = 0x2d5a9a;
const BLD = 0x1f3a78;
const BLL = 0x3c74b4;
const SL = 0xa4d02c;
const SLL = 0xc4e440;
const SLD = 0x6c9a22;
const DRIP = 0x5ad0b4;
const RU = 0x8a4a1e;
const RUL = 0xa86228;
const RUD = 0x5a3016;
const WOOD = 0x4a3a30;
const WOOD_D = 0x2e2420;
const BONE = 0xd8c8b4;
const BONE_D = 0xb0a08c;
const EYE = 0xffcc1a;

export function swampDrowned(): MobDef {
  const B = new MobBuilder();
  const skin = [T, TL, TD, GR, BL, TL];
  const slime = [SL, SLL, SLD, DRIP];
  const rag = [BL, BLD, BLL, BLD];
  // ---------------------------------------------------------------- hips: belt and dripping rags
  B.b('hips', -4.2, -0.8, -2.6, 4.2, 3.4, 2.6, TD);
  B.b('hips', -4.5, 2.2, -2.9, 4.5, 3.8, 2.9, RUD);
  B.speck('hips', [-4.5, 2.2, -2.9, 4.5, 3.8, 2.9], [RU, RUL, RUD], 10, 3, { size: 0.9 });
  B.b('hips', -1.0, 2.0, 2.8, 1.0, 4.0, 3.3, BLD, { bv: 0.08 }); // buckle plate
  B.fringe('hips', -3.8, 3.8, 2.6, 2.6, 0.45, 5.0, [BL, BLD, RUD, TD], 3, 0.9);
  B.fringe('hips', -4.2, 4.2, 2.6, -3.1, 0.45, 6.0, [BL, BLD, SLD, RUD], 5, 0.9);
  // ---------------------------------------------------------------- chest: mottled torso, blue shawl
  B.b('chest', -4.6, -0.4, -2.8, 4.6, 7.2, 2.8, T);
  B.speck('chest', [-4.6, -0.4, -2.8, 4.6, 7.2, 2.8], skin, 26, 7, { size: 1.1 });
  B.b('chest', -2.6, 0.4, 2.7, 2.6, 4.6, 3.2, RUD, { bv: 0.1 }); // leather patch
  B.speck('chest', [-2.6, 0.4, 2.7, 2.6, 4.6, 3.2], [RU, RUL], 6, 8, { size: 0.8, faces: 'f' });
  B.b('chest', -5.4, 4.6, -3.4, 5.4, 7.8, 3.3, BL); // shawl
  B.speck('chest', [-5.4, 4.6, -3.4, 5.4, 7.8, 3.3], [...rag, RU], 30, 9, { size: 1.1 });
  B.fringe('chest', -5.4, 5.4, 5.0, 3.2, 0.5, 3.6, [BL, BLD, BLL, RU], 11, 0.9);
  B.fringe('chest', -5.0, 5.0, 5.4, -3.7, 0.5, 8.0, [BL, BLD, BLL, BLD, SLD], 13, 0.9); // long back cape
  B.fringe('chest', -3.0, 3.0, 5.0, -3.9, 0.4, 9.0, [SL, SLD, DRIP], 15, 1.6); // slime streams down the back
  for (const [x, z] of [[-4.6, 2.9], [4.4, 2.9], [3.8, -3.5]] as [number, number][]) {
    B.b('chest', x - 0.6, 5.6, z - 0.4, x + 0.6, 6.8, z + 0.4, 0x9a9488, { bv: 0.1 }); // rusty rivets
  }
  // shoulder straps
  B.b('chest', 2.8, 0.4, 2.9, 4.0, 5.0, 3.3, RU, { bv: 0.05 });
  // ---------------------------------------------------------------- head: big mottled cube
  B.b('head', -5, 0, -4.6, 5, 10, 5, T);
  B.speck('head', [-5, 0, -4.6, 5, 10, 5], skin, 110, 17, { size: 1.6 });
  B.speck('head', [-5, 0, -4.6, 5, 10, 5], [BL, BLD], 14, 18, { size: 1.2, faces: 'tblr' });
  B.speck('head', [-5, 7, -4.6, 5, 10, 5], slime, 22, 19, { size: 1.1, faces: 't', out: 0.4 });
  // slime dripping off the crown
  for (let i = 0; i < 9; i++) {
    const x = -4.4 + i * 1.1;
    const l = 1.2 + ((i * 7) % 5) * 0.7;
    B.b('head', x, 10 - l, i % 2 ? 4.95 : -4.95 - 0.4, x + 0.8, 10.2, i % 2 ? 5.35 : -4.55, i % 3 ? SL : SLD, { bv: 0.05 });
  }
  B.b('head', -4.6, 5.6, 4.9, 4.6, 6.6, 5.6, TD, { bv: 0.08 }); // heavy brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.0, 4.0, 4.9, k * 3.8, 5.6, 5.3, 0x6a5a10, { bv: 0 });
    B.b('head', k * 1.4, 4.2, 5.2, k * 3.4, 5.4, 5.5, EYE, { g: true, bv: 0 });
    B.b('head', k * 3.0, 5.2, 5.2, k * 3.8, 6.2, 5.6, TD, { bv: 0 }); // angry slant
  }
  B.b('head', -1.0, 2.8, 4.9, 1.0, 4.4, 6.0, TL, { bv: 0.15 }); // nose
  B.b('head', -3.0, 1.0, 4.9, 3.0, 2.6, 5.3, 0x1e2a24, { bv: 0 }); // grin
  for (let i = 0; i < 5; i++) B.b('head', -2.6 + i * 1.2, 1.9, 5.1, -1.9 + i * 1.2, 2.6, 5.45, BONE, { bv: 0 });
  for (const k of [-1, 1]) B.b('head', k * 1.4, 0.8, 5.0, k * 2.2, 1.8, 5.45, BONE, { bv: 0 });
  B.b('head', -4.6, -0.6, -3.6, 4.6, 0.8, 5.0, TD); // jaw
  // stubby ears out to the sides, tilted up
  for (const k of [-1, 1]) {
    B.b('head', k * 4.8, 4.4, -1, k * 7.0, 8.0, 1.6, T, { bv: 0.12 });
    B.b('head', k * 6.8, 5.6, -0.6, k * 8.6, 8.6, 1.2, TL, { bv: 0.1 });
    B.b('head', k * 8.4, 7.0, -0.2, k * 9.6, 9.2, 0.8, TD, { bv: 0.08 });
    B.b('head', k * 5.0, 5.0, 1.5, k * 7.6, 7.4, 1.8, GR, { bv: 0 });
  }
  // ---------------------------------------------------------------- limbs: long arms, slime-dripping fists
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -2.1, -7, -2.1, 2.1, 1.6, 2.1, T);
    B.speck(arm, [-2.1, -7, -2.1, 2.1, 1.6, 2.1], skin, 12, 21 + k, { size: 1 });
    B.b(arm, -2.8, -1.4, -2.8, 2.8, 2.4, 2.8, BL, { bv: 0.15 }); // shawl over the shoulder
    B.speck(arm, [-2.8, -1.4, -2.8, 2.8, 2.4, 2.8], [...rag, RU, RUL], 12, 23 + k, { size: 0.9 });
    B.fringe(arm, -2.8, 2.8, -1.2, 2.6, 0.4, 2.6, [BL, BLD, SLD], 25 + k, 0.8);
    B.fringe(arm, -2.8, 2.8, -1.2, k * 2.6 - (k < 0 ? 0.4 : 0), 0.4, 2.8, [BL, BLD, SL], 27 + k, 0.8, 'z');
    B.b(arm, -2.3, -5, -2.3, 2.3, -3.6, 2.3, RUD, { bv: 0.06 }); // rotten arm wrap
    B.speck(arm, [-2.3, -5, -2.3, 2.3, -3.6, 2.3], [RU, RUL], 6, 29 + k, { size: 0.7 });
    B.b(fore, -2.0, -6.4, -2.0, 2.0, 0.4, 2.0, TL);
    B.speck(fore, [-2.0, -6.4, -2.0, 2.0, 0.4, 2.0], [...skin, SL], 14, 31 + k, { size: 1 });
    B.b(fore, -2.3, -3.0, -2.3, 2.3, -1.6, 2.3, RU, { bv: 0.06 });
    B.b(fore, -2.5, -10, -2.5, 2.5, -6.0, 2.5, T); // big fist
    B.speck(fore, [-2.5, -10, -2.5, 2.5, -6.0, 2.5], [...skin, SL, SLL], 18, 33 + k, { size: 1.1 });
    for (let i = 0; i < 4; i++) B.b(fore, -2.1 + i * 1.1, -10.6, 1.6, -1.3 + i * 1.1, -9.2, 2.6, TD, { bv: 0.08 }); // knuckles
    // slime drips hanging from the fist
    for (let i = 0; i < 6; i++) {
      const x = -2.2 + (i % 3) * 1.6;
      const z = i < 3 ? 2.0 : -2.2;
      const l = 1.5 + ((i * 5 + (k > 0 ? 1 : 3)) % 4) * 0.8;
      B.b(fore, x, -10 - l, z, x + 0.7, -9.6, z + 0.5, i % 2 ? DRIP : SL, { bv: 0.05 });
    }
    B.b(leg, -2.3, -6, -2.3, 2.3, 0.6, 2.3, T);
    B.speck(leg, [-2.3, -6, -2.3, 2.3, 0.6, 2.3], [...skin, RUD], 12, 41 + k, { size: 1 });
    B.b(shin, -2.2, -5.4, -2.2, 2.2, 0.4, 2.2, TL);
    B.speck(shin, [-2.2, -5.4, -2.2, 2.2, 0.4, 2.2], [...skin, RU, RUD], 12, 43 + k, { size: 1 });
    B.b(shin, -2.4, -2.4, -2.4, 2.4, -1.2, 2.4, RUD, { bv: 0.08 }); // leg wrap
    B.b(shin, -2.6, -7.0, -2.6, 2.6, -5.2, 3.6, T); // broad bare foot
    B.speck(shin, [-2.6, -7.0, -2.6, 2.6, -5.2, 3.6], [TL, TD, GR, SL], 8, 45 + k, { size: 0.9, faces: 'tfl' });
    for (const x of [-1.6, 0, 1.6]) B.b(shin, x - 0.55, -7.0, 3.4, x + 0.55, -5.8, 4.2, TD, { bv: 0.06 });
  }
  // ---------------------------------------------------------------- rusty trident (fist of foreL, pole along +z)
  B.b('trident', -0.8, -0.8, -16, 0.8, 0.8, 9, WOOD);
  B.speck('trident', [-0.8, -0.8, -16, 0.8, 0.8, 9], [WOOD_D, RUD, WOOD, RU], 22, 51, { size: 0.7, out: 0.2, faces: 'tdlr' });
  B.b('trident', -1.0, -1.0, -16.8, 1.0, 1.0, -15.4, BONE_D, { bv: 0.1 }); // butt cap
  B.b('trident', -1.2, -1.2, 8.4, 1.2, 1.2, 10.4, 0x3a4a5a, { bv: 0.1 }); // iron collar
  B.b('trident', -4.2, -0.8, 10.0, 4.2, 0.8, 11.6, 0x3a4a5a, { bv: 0.1 }); // crossbar
  for (const x of [-3.4, 0, 3.4]) {
    const len = x === 0 ? 5.6 : 4.6;
    B.b('trident', x - 0.75, -0.75, 11.4, x + 0.75, 0.75, 11.4 + len, BONE);
    B.b('trident', x - 0.55, -0.55, 11.4 + len - 0.2, x + 0.55, 0.55, 11.4 + len + 1.0, BONE_D, { bv: 0.08 });
    B.b('trident', x - 0.9, -0.9, 12.4, x + 0.9, 0.9, 13.4, BONE_D, { bv: 0.06 });
  }

  const pose = {
    hips: [10, 0, 0] as [number, number, number],
    chest: [14, -4, 0] as [number, number, number],
    head: [-16, 6, 0] as [number, number, number],
    armR: [-16, 0, -20] as [number, number, number],
    foreR: [-30, 0, 0] as [number, number, number],
    armL: [-6, 0, 18] as [number, number, number],
    foreL: [-30, 0, 0] as [number, number, number],
    legL: [-20, 0, 12] as [number, number, number],
    shinL: [20, 0, -8] as [number, number, number],
    legR: [-16, 0, -12] as [number, number, number],
    shinR: [18, 0, 8] as [number, number, number],
  };
  return {
    id: 'mob_swamp_drowned',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 12.2, hipX: 2.4, thigh: 6.2, torso: 3.2, shoulderY: 5.8, shoulderX: 6.6, neck: 7.0, upperArm: 7.2 },
      pose,
      [{ id: 'trident', parent: 'foreL', at: [0, -8, 0], r: [-38, 0, -14] }],
    ),
    parts: B.parts,
    idle: [...humanIdle(1.2, 3.4), { b: 'trident', rot: [2, 0, 0], period: 3.4, phase: 0.3 }],
  };
}
