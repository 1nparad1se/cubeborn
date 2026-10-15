import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef, type V3 } from './mobKit';

/**
 * Desert raider (Пустынный налётчик): a crouching bandit wrapped in sun-faded crimson. A square red
 * hood with a grey headband leaves only a slit of white eyes above a ragged red face wrap; a tattered
 * red mantle hangs down the back, worn grey pauldrons sit on dark leather sleeves with sandy wraps,
 * a belt with a brass buckle and pouches holds a ragged red sash, and a curved bone-pale scimitar
 * with a brass guard is held ready.
 */

const RD = 0xb4242a;
const RDL = 0xd23a34;
const RDD = 0x7a1a22;
const RDDD = 0x561620;
const LE = 0x4a3436;
const LEL = 0x6a4a44;
const LED = 0x2e2228;
const SA = 0xd2a860;
const SAL = 0xe8c888;
const SAD = 0xa4783e;
const GR = 0x9a948e;
const GRL = 0xc4beb6;
const BR = 0x8a5a2a;
const GOLD = 0xc8962c;
const BONE = 0xead8bc;
const BONE_D = 0xc4b094;

export function desertRaider(): MobDef {
  const B = new MobBuilder();
  const red = [RD, RDL, RDD, RDDD];
  const lea = [LE, LEL, LED, SAD];
  // ---------------------------------------------------------------- hips: belt with pouches, red sash
  B.b('hips', -4, -1, -2.8, 4, 3.6, 2.8, LE);
  B.speck('hips', [-4, -1, -2.8, 4, 3.6, 2.8], lea, 12, 3, { size: 1 });
  B.b('hips', -4.3, 2.2, -3.1, 4.3, 3.8, 3.1, BR);
  B.b('hips', -1.3, 1.9, 3.0, 1.3, 4.1, 3.6, GOLD, { bv: 0.06 });
  B.b('hips', -0.6, 2.5, 3.5, 0.6, 3.5, 3.8, LED, { bv: 0 });
  for (const [x, z] of [[-3.4, -2], [3.4, -2], [-2, -3.4]] as [number, number][]) B.b('hips', x - 1, 0.8, z - 0.6, x + 1, 3.2, z + 0.9, SAD, { bv: 0.1 }); // pouches
  B.fringe('hips', -3.4, 3.4, 2.4, 2.9, 0.5, 7, red, 5, 0.9);
  B.fringe('hips', -4.2, 4.2, 2.4, -3.4, 0.5, 8, red, 7, 0.9);
  // ---------------------------------------------------------------- chest: leather vest, red mantle
  B.b('chest', -4.4, -0.4, -2.8, 4.4, 7, 2.8, LE);
  B.speck('chest', [-4.4, -0.4, -2.8, 4.4, 7, 2.8], lea, 30, 9, { size: 1.1 });
  B.b('chest', -5, 4.4, -3.4, 5, 7.6, 3.2, RD); // mantle over the shoulders
  B.speck('chest', [-5, 4.4, -3.4, 5, 7.6, 3.2], red, 30, 11, { size: 1.1, out: 0.5 });
  B.fringe('chest', -4.8, 4.8, 5.0, -3.8, 0.6, 12, red, 13, 0.8); // long tattered cape
  B.fringe('chest', -4.4, 4.4, 4.4, -4.3, 0.5, 9, [RDD, RDDD, RD], 15, 1.1);
  B.fringe('chest', -4.6, 4.6, 5.0, 3.0, 0.5, 3, red, 17, 0.9);
  // ---------------------------------------------------------------- head: square red hood, eye slit, face wrap
  B.b('head', -4.4, -0.4, -4, 4.4, 8.6, 4.4, RD);
  B.speck('head', [-4.4, -0.4, -4, 4.4, 8.6, 4.4], red, 54, 19, { size: 1.2 });
  B.b('head', -4.7, 5.8, -4.3, 4.7, 7.0, 4.7, GR, { bv: 0.06 }); // headband
  B.speck('head', [-4.7, 5.8, -4.3, 4.7, 7.0, 4.7], [GR, GRL, SAD], 10, 21, { size: 0.7 });
  B.b('head', -3.6, 4.0, 4.3, 3.6, 5.6, 4.6, 0x1a1214, { bv: 0 }); // eye slit
  for (const k of [-1, 1]) B.b('head', k * 1.0, 4.2, 4.5, k * 2.4, 5.4, 4.8, 0xffffff, { g: true, bv: 0 });
  B.b('head', -4.0, -0.4, 4.2, 4.0, 4.0, 5.0, RDD); // face wrap
  B.speck('head', [-4.0, -0.4, 4.2, 4.0, 4.0, 5.0], red, 16, 23, { size: 0.9, faces: 'f' });
  B.fringe('head', -4.0, 4.0, 0.2, 4.4, 0.6, 4, red, 25, 0.8); // ragged wrap hanging off the chin
  B.fringe('head', -4.6, 4.6, 6.0, -4.6, 0.6, 7, red, 27, 0.9); // hood tail
  for (const k of [-1, 1]) B.fringe('head', -4.4, 1.5, 5.8, k > 0 ? 4.4 : -5.0, 0.6, 7, red, 29 + k, 0.9, 'z');
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -2.2, -6.6, -2.2, 2.2, 1, 2.2, LE);
    B.speck(arm, [-2.2, -6.6, -2.2, 2.2, 1, 2.2], lea, 10, 31 + k, { size: 0.9 });
    B.b(arm, -3.0, -1.6, -3.0, 3.0, 2.4, 3.0, GR, { bv: 0.15 }); // worn pauldron
    B.speck(arm, [-3.0, -1.6, -3.0, 3.0, 2.4, 3.0], [GR, GRL, SAD, 0x7a746e], 14, 33 + k, { size: 0.9 });
    B.b(arm, -2.4, -5.4, -2.4, 2.4, -3.8, 2.4, SA, { bv: 0.06 }); // sand wrap
    B.b(fore, -2.3, -6.4, -2.3, 2.3, 0.4, 2.3, SA); // sand-coloured bracer
    B.speck(fore, [-2.3, -6.4, -2.3, 2.3, 0.4, 2.3], [SA, SAL, SAD, LE], 16, 35 + k, { size: 1 });
    B.b(fore, -2.5, -2.4, -2.5, 2.5, -1.0, 2.5, LE, { bv: 0.06 });
    B.b(fore, -2.1, -9.4, -2.1, 2.1, -6.0, 2.1, SAL); // wrapped fist
    B.speck(fore, [-2.1, -9.4, -2.1, 2.1, -6.0, 2.1], [SAL, SA, BONE], 8, 37 + k, { size: 0.8 });
    B.b(leg, -2.4, -6.2, -2.4, 2.4, 0.6, 2.4, LED);
    B.speck(leg, [-2.4, -6.2, -2.4, 2.4, 0.6, 2.4], lea, 12, 41 + k, { size: 1 });
    B.b(shin, -2.3, -5.6, -2.3, 2.3, 0.4, 2.3, LE);
    B.b(shin, -2.6, -1.0, -2.6, 2.6, 1.4, 2.8, SA, { bv: 0.1 }); // sandy knee wrap
    B.speck(shin, [-2.6, -5.6, -2.6, 2.6, 1.4, 2.8], [SA, SAD, LEL, LED], 14, 43 + k, { size: 1 });
    B.b(shin, -2.8, -8.4, -2.8, 2.8, -5.4, 3.8, LEL); // boot
    B.speck(shin, [-2.8, -8.4, -2.8, 2.8, -5.4, 3.8], [SAD, LEL, LE, GR], 12, 45 + k, { size: 1, faces: 'tflr' });
  }
  // ---------------------------------------------------------------- scimitar (fist of foreL, curving blade along +z then +y)
  B.b('blade', -0.7, -0.7, -3, 0.7, 0.7, 1.2, BR);
  B.b('blade', -0.9, -0.9, -3.8, 0.9, 0.9, -2.8, GOLD, { bv: 0.1 });
  B.b('blade', -2.8, -1.2, 1.0, 2.8, 1.2, 2.2, GOLD, { bv: 0.1 }); // guard
  const pts: V3[] = [];
  for (let i = 0; i <= 7; i++) {
    const a = (i / 7) * 1.25;
    pts.push([0, -9 * (1 - Math.cos(a)), 2 + 9 * Math.sin(a)]);
  }
  for (let i = 0; i < 7; i++) {
    const w = 2.6 - i * 0.28;
    B.seg('blade', pts[i], pts[i + 1], 0.9, w, i % 2 ? BONE_D : BONE, { bv: 0.06 });
  }
  B.crystal('blade', pts[7], [0, pts[7][1] - 3.2, pts[7][2] - 1.2], 1.2, [BONE, BONE_D, BONE]);

  const pose = {
    hips: [10, 0, 0] as V3,
    chest: [12, -8, 0] as V3,
    head: [-12, 10, 0] as V3,
    armR: [-20, 0, -26] as V3,
    foreR: [-40, 0, 0] as V3,
    armL: [-40, 0, 18] as V3,
    foreL: [-50, 0, 0] as V3,
    legL: [-26, 0, 18] as V3,
    shinL: [28, 0, -10] as V3,
    legR: [-18, 0, -18] as V3,
    shinR: [24, 0, 10] as V3,
  };
  return {
    id: 'mob_desert_raider',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 12.4, hipX: 2.6, thigh: 6.4, torso: 3.2, shoulderY: 5.8, shoulderX: 6.6, neck: 7.2, upperArm: 6.6 },
      pose,
      [{ id: 'blade', parent: 'foreL', at: [0, -7.8, 0], r: [0, 0, 180] }],
    ),
    parts: B.parts,
    idle: humanIdle(1.1, 2.6),
  };
}
