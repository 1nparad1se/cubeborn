import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef, type V3 } from './mobKit';

/**
 * Northern berserker (Северный берсерк): a broad, stooped brute in layered brown leathers under a
 * huge shaggy collar of pale fur. A grey war-painted face with orange brows, burning orange eyes
 * and a gold-toothed snarl peers from a fur mane; iron-banded bracers and greaves, a wide belt with
 * a brass buckle, a ragged leather kilt, heavy boots, and a bearded hand axe with a worn haft.
 */

const LE = 0x7a4a2e;
const LEL = 0x9a6440;
const LED = 0x553222;
const LEDD = 0x3a2420;
const GRY = 0x4a4a54;
const GRYL = 0x66666e;
const FUR = 0xd8b88a;
const FURL = 0xecd4a8;
const FURD = 0xb08c60;
const SKIN = 0xc48a64;
const SKIND = 0x9a6648;
const OR = 0xe86a1e;
const GOLD = 0xd8a22c;
const IRON = 0x8a8c96;
const IRONL = 0xc0c2ca;
const HAFT = 0xa86a28;
const EYE = 0xff6a10;

export function northBerserker(): MobDef {
  const B = new MobBuilder();
  const lea = [LE, LEL, LED, LEDD, GRY];
  const fur = [FUR, FURL, FURD, FUR];
  // ---------------------------------------------------------------- hips: belt and ragged kilt
  B.b('hips', -5.4, -1, -3.6, 5.4, 4, 3.6, LED);
  B.b('hips', -5.8, 2.6, -4, 5.8, 4.6, 4, LEDD);
  B.speck('hips', [-5.8, 2.6, -4, 5.8, 4.6, 4], [LE, LED], 10, 3, { size: 0.9 });
  B.b('hips', -1.8, 2.2, 3.9, 1.8, 5.0, 4.6, GOLD, { bv: 0.08 });
  B.b('hips', -1.0, 2.9, 4.4, 1.0, 4.3, 4.8, LEDD, { bv: 0 });
  B.fringe('hips', -5.4, 5.4, 2.8, 3.6, 0.6, 6.5, [LE, LED, LEDD, LEL], 5, 1);
  B.fringe('hips', -5.6, 5.6, 2.8, -4.2, 0.6, 7.5, [LE, LED, FURD, LEL], 7, 1);
  B.fringe('hips', -3.6, 3.6, 2.8, 5.8, 0.6, 6.5, [LE, LED, LEL], 9, 1.2, 'z');
  B.fringe('hips', -3.6, 3.6, 2.8, -6.4, 0.6, 6.5, [LE, LED, LEL], 11, 1.2, 'z');
  // ---------------------------------------------------------------- chest: leathers, fur collar
  B.b('chest', -7, -0.6, -4.6, 7, 9.6, 4.6, LE);
  B.speck('chest', [-7, -0.6, -4.6, 7, 9.6, 4.6], lea, 70, 13, { size: 1.5 });
  B.b('chest', -3, 0, 4.4, 3, 6, 5.0, GRY, { bv: 0.1 }); // dark undershirt
  B.speck('chest', [-3, 0, 4.4, 3, 6, 5.0], [GRY, GRYL, LEDD], 8, 15, { size: 0.9, faces: 'f' });
  B.b('chest', -8.2, 7.6, -6.2, 8.2, 11.2, 4.0, FUR); // fur collar
  B.speck('chest', [-8.2, 7.6, -6.2, 8.2, 11.2, 4.0], fur, 140, 17, { size: 1.8, out: 1.1 });
  B.fringe('chest', -8, 8, 8.4, -6.6, 0.8, 7, fur, 19, 1.2); // fur down the back
  B.fringe('chest', -8, 8, 8.4, 4.6, 0.8, 3.5, fur, 21, 1.2);
  B.speck('chest', [-8, 1, -6.6, 8, 8.4, -5.8], [FUR, FURD, LE], 30, 23, { size: 1.5, out: 0.8, faces: 'b' });
  // strap across the back with an iron ring
  B.seg('chest', [-6, 1, -5], [6, 9.5, -5], 0.6, 1.6, LEDD, { bv: 0.05 });
  B.b('chest', -1.2, 4.2, -5.8, 1.2, 6.4, -4.8, IRON, { bv: 0.08 });
  // ---------------------------------------------------------------- head: grey painted face in a fur mane
  B.b('head', -4.4, -0.6, -3.6, 4.4, 8.6, 4.6, GRY);
  B.speck('head', [-4.4, -0.6, -3.6, 4.4, 8.6, 4.6], [GRY, GRYL, 0x3a3a44], 26, 25, { size: 1.1 });
  B.b('head', -3.2, 0, 4.4, 3.2, 3.6, 5.2, SKIN, { bv: 0.1 }); // muzzle
  B.speck('head', [-3.2, 0, 4.4, 3.2, 3.6, 5.2], [SKIN, SKIND], 6, 27, { size: 0.8, faces: 'f' });
  B.b('head', -4.2, 5.0, 4.5, 4.2, 6.4, 5.4, OR, { bv: 0.08 }); // war-paint brows
  for (const k of [-1, 1]) {
    B.b('head', k * 0.9, 3.6, 4.5, k * 3.2, 5.0, 4.9, 0x2a1810, { bv: 0 });
    B.b('head', k * 1.3, 3.8, 4.8, k * 2.8, 4.8, 5.1, EYE, { g: true, bv: 0 });
    B.b('head', k * 3.2, 3.4, 4.5, k * 4.2, 5.2, 5.0, OR, { bv: 0 });
  }
  B.b('head', -0.8, 2.4, 5.0, 0.8, 4.0, 5.9, SKIND, { bv: 0.12 }); // nose
  B.b('head', -2.4, 0.4, 5.0, 2.4, 1.8, 5.5, GOLD, { bv: 0.05 }); // gold teeth
  B.b('head', -2.4, 1.0, 5.3, 2.4, 1.2, 5.6, 0x6a4a10, { bv: 0 });
  B.b('head', -5.6, 6.4, -4.8, 5.6, 10.4, 4.0, FUR); // fur mane over the crown
  B.speck('head', [-5.6, 6.4, -4.8, 5.6, 10.4, 4.0], fur, 60, 29, { size: 1.5, out: 0.9 });
  B.b('head', -5.8, 0, -4.8, -4.2, 8, 3, FUR);
  B.b('head', 4.2, 0, -4.8, 5.8, 8, 3, FUR);
  B.speck('head', [-5.8, 0, -4.8, 5.8, 8, 3], fur, 50, 31, { size: 1.4, out: 0.8, faces: 'lrb' });
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -3.4, -7.4, -3.4, 3.4, 2, 3.4, LED);
    B.speck(arm, [-3.4, -7.4, -3.4, 3.4, 2, 3.4], lea, 22, 41 + k, { size: 1.3 });
    B.b(arm, -4.2, -1, -4.2, 4.2, 3.4, 4.2, FUR, { bv: 0.2 }); // fur shoulder
    B.speck(arm, [-4.2, -1, -4.2, 4.2, 3.4, 4.2], fur, 34, 43 + k, { size: 1.5, out: 0.9 });
    B.b(fore, -3.6, -7, -3.6, 3.6, 0.4, 3.6, LE); // bracer
    B.speck(fore, [-3.6, -7, -3.6, 3.6, 0.4, 3.6], lea, 18, 45 + k, { size: 1.2 });
    for (const y of [-1.4, -5.2]) B.b(fore, -3.9, y - 0.8, -3.9, 3.9, y + 0.8, 3.9, GRY, { bv: 0.08 });
    for (const y of [-1.4, -5.2]) B.b(fore, k * 3.8, y - 0.5, -0.5, k * 4.2, y + 0.5, 0.5, IRON, { bv: 0.05 });
    B.b(fore, -3.2, -11, -3.2, 3.2, -6.8, 3.2, SKIN); // big fist
    B.speck(fore, [-3.2, -11, -3.2, 3.2, -6.8, 3.2], [SKIN, SKIND, 0xd8a07a], 14, 47 + k, { size: 1 });
    for (let i = 0; i < 4; i++) B.b(fore, -2.8 + i * 1.5, -11.6, 2.2, -1.6 + i * 1.5, -9.6, 3.6, SKIND, { bv: 0.08 });
    B.b(leg, -3.4, -6.6, -3.4, 3.4, 0.8, 3.4, LED);
    B.speck(leg, [-3.4, -6.6, -3.4, 3.4, 0.8, 3.4], lea, 16, 51 + k, { size: 1.2 });
    B.b(shin, -3.3, -6, -3.3, 3.3, 0.4, 3.3, GRY);
    B.speck(shin, [-3.3, -6, -3.3, 3.3, 0.4, 3.3], [GRY, GRYL, LED], 14, 53 + k, { size: 1.1 });
    for (const y of [-1, -4]) B.b(shin, -3.6, y - 0.7, -3.6, 3.6, y + 0.7, 3.6, LE, { bv: 0.08 });
    B.b(shin, -3.8, -9, -3.8, 3.8, -6, 5, LEDD); // heavy boot
    B.speck(shin, [-3.8, -9, -3.8, 3.8, -6, 5], [LED, LEDD, GRY], 14, 55 + k, { size: 1.1, faces: 'tflr' });
    B.b(shin, -1, -8, 4.8, 1, -6.6, 5.4, GOLD, { bv: 0.05 });
  }
  // ---------------------------------------------------------------- bearded axe (fist of foreL, haft along +z)
  B.b('axe', -0.9, -0.9, -8, 0.9, 0.9, 13, HAFT);
  B.speck('axe', [-0.9, -0.9, -8, 0.9, 0.9, 13], [HAFT, 0x8a5220, 0xc08038], 16, 61, { size: 0.6, out: 0.2, faces: 'tdlr' });
  B.b('axe', -1.2, -1.2, 9, 1.2, 1.2, 12, LED, { bv: 0.08 }); // binding
  B.b('axe', -0.7, 0.8, 9, 0.7, 3, 13, IRON, { bv: 0.1 }); // back spike
  B.b('axe', -0.6, -2, 8.5, 0.6, -0.8, 13.5, IRON);
  B.b('axe', -0.6, -5, 6.5, 0.6, -2, 15.5, IRON); // blade
  B.b('axe', -0.6, -6.6, 5.2, 0.6, -4.8, 17, IRONL); // edge
  B.b('axe', -0.65, -7.4, 4.6, 0.65, -6.4, 9, IRONL, { bv: 0.06 });
  B.b('axe', -0.65, -7.4, 13.6, 0.65, -6.4, 17.6, IRONL, { bv: 0.06 });
  B.speck('axe', [-0.6, -6.6, 6, 0.6, -2, 16], [IRON, 0x6a6c76, IRONL], 10, 63, { size: 0.7, faces: 'lr' });

  const pose = {
    hips: [6, 0, 0] as V3,
    chest: [14, -6, 0] as V3,
    head: [-12, 6, 0] as V3,
    armR: [-20, 0, -20] as V3,
    foreR: [-30, 0, 0] as V3,
    armL: [-30, 0, 18] as V3,
    foreL: [-60, 0, 0] as V3,
    legL: [-18, 0, 12] as V3,
    shinL: [18, 0, -8] as V3,
    legR: [-12, 0, -12] as V3,
    shinR: [14, 0, 8] as V3,
  };
  return {
    id: 'mob_north_berserker',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 13.5, hipX: 3.6, thigh: 6.8, torso: 4, shoulderY: 7.6, shoulderX: 10.2, neck: 10.4, upperArm: 7.4 },
      pose,
      [{ id: 'axe', parent: 'foreL', at: [0, -9, 0], r: [0, 0, 0] }],
    ),
    parts: B.parts,
    idle: humanIdle(1.2, 3.0),
  };
}
