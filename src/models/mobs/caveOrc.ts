import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef, type V3 } from './mobKit';

/**
 * Cave orc (Пещерный орк): a massive hunched orc with olive-yellow skin, a square head with
 * glowing red eyes, a heavy brow and jutting tusks, draped in ragged blood-red cloth over slabs of
 * purple-grey stone armour bound with leather and studded with ember-orange rivets and bone spikes,
 * stone vambraces and greaves, red leg wraps, and a huge stone-headed hammer resting on its shoulder.
 */

const SK = 0xb8b45a;
const SKL = 0xd0cc78;
const SKD = 0x8a8a40;
const SKDD = 0x6a6a34;
const RD = 0xb42a2a;
const RDL = 0xd23c34;
const RDD = 0x7a1c22;
const ST = 0x6a5a66;
const STL = 0x8a7a86;
const STD = 0x4a3e4a;
const LE = 0x8a4e26;
const LED = 0x5a3220;
const EMB = 0xf06a1a;
const BONE = 0xe8d8b8;
const WOOD = 0x8a5a2a;
const EYE = 0xff3020;

export function caveOrc(): MobDef {
  const B = new MobBuilder();
  const skin = [SK, SKL, SKD, SKDD];
  const red = [RD, RDL, RDD, RDD];
  const stone = [ST, STL, STD, ST];
  /** A stone armour slab with rivets. */
  const slab = (bone: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, seed: number) => {
    B.b(bone, x0, y0, z0, x1, y1, z1, ST);
    B.speck(bone, [x0, y0, z0, x1, y1, z1], stone, Math.round(Math.abs((x1 - x0) * (y1 - y0)) / 4) + 6, seed, { size: 1.1 });
    B.speck(bone, [x0, y0, z0, x1, y1, z1], [EMB], 3, seed + 1, { size: 0.6, out: 0.2 });
  };
  // ---------------------------------------------------------------- hips: leather belt, red loin rags
  B.b('hips', -6, -1.4, -4, 6, 4.4, 4, SKD);
  B.b('hips', -6.4, 2.6, -4.4, 6.4, 4.8, 4.4, LE);
  B.speck('hips', [-6.4, 2.6, -4.4, 6.4, 4.8, 4.4], [LE, LED, 0xa86a34], 12, 3, { size: 1 });
  slab('hips', -1.8, 1.8, 4.2, 1.8, 5.4, 5.0, 5);
  B.fringe('hips', -5, 5, 2.8, 4.2, 0.6, 9, red, 7, 1);
  B.fringe('hips', -5.6, 5.6, 2.8, -4.8, 0.6, 10, red, 9, 1);
  // ---------------------------------------------------------------- chest: huge hunched torso under red cloth and stone
  B.b('chest', -8, -1, -5, 8, 11, 5, SK);
  B.speck('chest', [-8, -1, -5, 8, 11, 5], skin, 40, 11, { size: 1.6 });
  B.b('chest', -8.8, 6, -6.4, 8.8, 13, 5.4, RD); // red mantle
  B.speck('chest', [-8.8, 6, -6.4, 8.8, 13, 5.4], red, 70, 13, { size: 1.5, out: 0.6 });
  B.fringe('chest', -7, 7, 6.6, -6.8, 0.6, 9, red, 15, 0.9); // rags down the back
  B.fringe('chest', -7, 7, 6.6, 5.2, 0.6, 7, [RD, RDD, EMB, RDL], 17, 0.9); // rags down the chest
  slab('chest', -3, 2, -7.4, 3, 8, -6.2, 19); // stone plate on the back
  B.b('chest', -9, 0, -5.4, 9, 1.4, 5.4, LE, { bv: 0.06 });
  // bone spikes along the shoulders
  for (const [x, z] of [[-4, -2], [0, -3], [4, -2], [-2, 1], [2, 1]] as [number, number][]) B.crystal('chest', [x, 12.6, z], [x * 1.1, 15.6, z - 0.5], 1.6, [BONE, BONE, 0xc8b898]);
  // ---------------------------------------------------------------- head
  B.b('head', -4.6, -1.4, -2, 4.6, 7.6, 7.2, SK);
  B.speck('head', [-4.6, -1.4, -2, 4.6, 7.6, 7.2], skin, 40, 21, { size: 1.2 });
  B.b('head', -4.8, 4.0, 7.0, 4.8, 5.6, 7.9, SKD, { bv: 0.1 }); // heavy brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.0, 2.6, 7.0, k * 3.6, 4.0, 7.4, 0x3a1010, { bv: 0 });
    B.b('head', k * 1.4, 2.8, 7.3, k * 3.2, 3.8, 7.6, EYE, { g: true, bv: 0 });
    B.b('head', k * 4.4, 3.0, 1.4, k * 6.6, 5.6, 3.4, SK, { bv: 0.12 }); // ears
    B.b('head', k * 6.4, 4.2, 1.8, k * 7.6, 6.4, 3.0, SKD, { bv: 0.1 });
  }
  B.b('head', -1.2, 1.0, 7.0, 1.2, 3.0, 8.4, SKD, { bv: 0.15 }); // nose
  B.b('head', -4.4, -3.6, 1, 4.4, 0.4, 8.2, SKL); // jaw
  B.b('head', -3.4, -1.6, 8.0, 3.4, 0.0, 8.4, 0x2a1210, { bv: 0 }); // mouth
  for (const k of [-1, 1]) B.b('head', k * 2.2, -1.8, 7.8, k * 3.4, 1.4, 8.6, BONE, { bv: 0.1 }); // tusks
  B.speck('head', [-4.4, -3.6, 1, 4.4, 0.4, 8.2], skin, 12, 23, { size: 1 });
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -3.6, -9, -3.6, 3.6, 2, 3.6, SK);
    B.speck(arm, [-3.6, -9, -3.6, 3.6, 2, 3.6], skin, 18, 31 + k, { size: 1.3 });
    slab(arm, -4.6, -2, -4.6, 4.6, 4, 4.6, 33 + k); // stone pauldron
    B.b(arm, -4.8, -2.6, -4.8, 4.8, -1.6, 4.8, LE, { bv: 0.06 });
    B.crystal(arm, [k * 1, 4, 0], [k * 1.6, 7, -0.6], 1.6, [BONE, BONE, 0xc8b898]);
    B.fringe(arm, -4.6, 4.6, -1.8, 4.4, 0.5, 3.5, red, 35 + k, 0.9);
    B.b(fore, -3.6, -9, -3.6, 3.6, 0.4, 3.6, SK);
    B.speck(fore, [-3.6, -9, -3.6, 3.6, 0.4, 3.6], skin, 14, 37 + k, { size: 1.2 });
    B.b(fore, -3.9, -2.6, -3.9, 3.9, -1.2, 3.9, RD, { bv: 0.06 });
    slab(fore, -4.4, -8.6, -4.4, 4.4, -3.2, 4.4, 39 + k); // stone vambrace
    B.b(fore, -3.4, -13, -3.4, 3.4, -8.6, 3.4, SKD); // fist
    B.speck(fore, [-3.4, -13, -3.4, 3.4, -8.6, 3.4], skin, 10, 41 + k, { size: 1 });
    B.b(leg, -3.8, -7, -3.8, 3.8, 0.8, 3.8, SKD);
    B.speck(leg, [-3.8, -7, -3.8, 3.8, 0.8, 3.8], skin, 14, 43 + k, { size: 1.3 });
    B.b(shin, -3.6, -6, -3.6, 3.6, 0.4, 3.6, SK);
    B.speck(shin, [-3.6, -6, -3.6, 3.6, 0.4, 3.6], skin, 12, 45 + k, { size: 1.2 });
    B.b(shin, -3.9, -3.4, -3.9, 3.9, -1.6, 3.9, RDD, { bv: 0.06 }); // red leg wrap
    B.speck(shin, [-3.9, -3.4, -3.9, 3.9, -1.6, 3.9], red, 6, 47 + k, { size: 0.8 });
    slab(shin, -4.2, -9, -4.2, 4.2, -5.6, 5.6, 49 + k); // stone boot
  }
  // ---------------------------------------------------------------- stone hammer over the right shoulder (fist of foreR, haft along +z)
  B.b('hammer', -1.1, -1.1, -6, 1.1, 1.1, 14, WOOD);
  B.speck('hammer', [-1.1, -1.1, -6, 1.1, 1.1, 14], [WOOD, LED, 0xa87038], 14, 51, { size: 0.7, out: 0.2, faces: 'tdlr' });
  B.b('hammer', -1.4, -1.4, 8, 1.4, 1.4, 10, LE, { bv: 0.06 });
  slab('hammer', -4.6, -4, 12, 4.6, 4, 22, 53); // head block
  B.b('hammer', -5, -4.4, 11.6, 5, 4.4, 12.6, STD, { bv: 0.1 });
  B.b('hammer', -5, -4.4, 21.4, 5, 4.4, 22.4, STD, { bv: 0.1 });

  const pose = {
    hips: [8, 0, 0] as V3,
    chest: [26, 0, 0] as V3,
    head: [-28, 0, 0] as V3,
    armR: [-80, 0, -30] as V3,
    foreR: [-150, 0, 0] as V3,
    armL: [-24, 0, 18] as V3,
    foreL: [-30, 0, 0] as V3,
    legL: [-20, 0, 16] as V3,
    shinL: [22, 0, -12] as V3,
    legR: [-14, 0, -16] as V3,
    shinR: [18, 0, 12] as V3,
  };
  return {
    id: 'mob_cave_orc',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 14, hipX: 4, thigh: 7, torso: 4.6, shoulderY: 9.6, shoulderX: 11, neck: 10.2, upperArm: 9 },
      pose,
      [{ id: 'hammer', parent: 'foreR', at: [0, -11, 0], r: [140, 0, 0] }],
    ),
    parts: B.parts,
    idle: humanIdle(1.2, 3.4),
  };
}
