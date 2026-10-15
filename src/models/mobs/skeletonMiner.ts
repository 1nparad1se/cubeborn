import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Skeleton miner (Скелет-шахтер): a lanky skeleton with chunky feet, a dented miner's helmet with
 * an iron band and a glowing lamp, a leather backpack with brass buckles and a rolled blanket on top,
 * a belt with a buckle round the pelvis, and a big curved pickaxe.
 */

const BN = 0xe0d4c0;
const BL = 0xf0e6d4;
const BD = 0xb8a88e;
const BDD = 0x8a7a64;
const HOLE = 0x1e1814;
const HEL = 0xbcae96;
const HEL_D = 0x968872;
const RUST = 0xc0862e;
const IRON = 0x66626c;
const IRON_D = 0x47444c;
const LAMP = 0xffd23a;
const PACK = 0x6a3a20;
const PACK_L = 0x84502c;
const PACK_D = 0x4a2814;
const BRASS = 0xc89a3a;
const ROLL = 0xc8b4b4;
const ROLL_D = 0xa08c8e;
const PICK = 0xc8bcc6;
const PICK_L = 0xddd2da;
const PICK_D = 0x9a8c98;
const HANDLE = 0x9a5e24;
const HANDLE_D = 0x6e4018;

export function skeletonMiner(): MobDef {
  const B = new MobBuilder();
  const bone = [BN, BL, BD];
  // ---------------------------------------------------------------- pelvis and belt
  B.b('hips', -3.2, -0.6, -1.6, 3.2, 1.8, 1.6, BN);
  B.b('hips', -3.6, 1.6, -2.0, 3.6, 2.6, 2.0, PACK_D); // belt
  B.b('hips', -0.9, 1.3, 1.8, 0.9, 2.9, 2.3, BRASS, { bv: 0.08 });
  B.b('hips', -0.4, 1.7, 2.1, 0.4, 2.5, 2.45, PACK_D, { bv: 0 });
  B.b('hips', -0.8, 2.4, -0.8, 0.8, 4.2, 0.8, BD); // spine
  // ---------------------------------------------------------------- ribcage
  B.b('chest', -0.8, -1, -1.6, 0.8, 7, -0.2, BD); // spine
  for (let i = 0; i < 4; i++) {
    const y = 0.6 + i * 1.5;
    const w = 3.0 + Math.min(i, 2) * 0.4;
    B.b('chest', -w, y, -1.8, w, y + 1.0, 1.8, i % 2 ? BN : BL, { bv: 0.15 });
    B.b('chest', -w + 0.6, y + 0.1, 1.5, w - 0.6, y + 0.9, 2.1, BD, { bv: 0 });
  }
  B.b('chest', -0.7, 0.4, 1.6, 0.7, 6.6, 2.3, BL, { bv: 0.1 }); // sternum
  B.b('chest', -4.6, 6.4, -1.6, 4.6, 7.6, 1.6, BN); // collarbones
  B.b('chest', -0.7, 7.4, -0.7, 0.7, 8.4, 0.7, BD); // neck
  // backpack with straps and a rolled blanket
  B.b('chest', -4.2, -1.5, -6.8, 4.2, 7.5, -2.2, PACK);
  B.speck('chest', [-4.2, -1.5, -6.8, 4.2, 7.5, -2.2], [PACK_L, PACK_D, PACK], 18, 3, { size: 1.1, faces: 'blrt' });
  B.b('chest', -4.4, -1.8, -7.2, 4.4, 1.6, -2.0, PACK_D); // bottom pocket
  B.b('chest', -3.0, 1.8, -7.3, 3.0, 5.6, -6.6, PACK_L, { bv: 0.1 }); // flap
  for (const x of [-2.4, 2.4]) {
    B.b('chest', x - 0.6, -1.2, -7.5, x + 0.6, 7.6, -6.7, PACK_D, { bv: 0.05 }); // straps
    B.b('chest', x - 0.8, 1.4, -7.8, x + 0.8, 2.6, -7.2, BRASS, { bv: 0.05 });
    B.b('chest', x - 0.6, 6.6, -2.4, x + 0.6, 7.8, 1.9, PACK_D, { bv: 0.05 }); // shoulder straps
    B.b('chest', x - 0.6, 0, 1.6, x + 0.6, 7.6, 2.3, PACK_D, { bv: 0.05 });
  }
  B.b('chest', -4.8, 7.4, -6.6, 4.8, 10.4, -3.0, ROLL, { bv: 0.4 }); // blanket roll
  for (const x of [-4.9, 4.9]) B.b('chest', x - 0.1, 8.0, -6.0, x + 0.1, 9.8, -3.6, ROLL_D, { bv: 0 });
  B.b('chest', -2.0, 7.2, -6.8, -1.2, 10.6, -2.8, PACK_D, { bv: 0 });
  B.b('chest', 1.2, 7.2, -6.8, 2.0, 10.6, -2.8, PACK_D, { bv: 0 });
  // ---------------------------------------------------------------- skull
  B.b('head', -3.8, 1.8, -3.6, 3.8, 8.6, 3.8, BN);
  B.speck('head', [-3.8, 1.8, -3.6, 3.8, 8.6, 3.8], [BL, BD], 14, 7, { size: 0.9, faces: 'lrb' });
  for (const k of [-1, 1]) B.b('head', k * 0.7, 4.3, 3.7, k * 3.1, 6.8, 4.25, HOLE, { bv: 0 }); // eye sockets
  B.b('head', -0.6, 3.2, 3.7, 0.6, 4.2, 4.25, HOLE, { bv: 0 }); // nose
  B.b('head', -3.0, 0.2, -2.6, 3.0, 2.2, 3.6, BD); // jaw
  for (let i = 0; i < 6; i++) B.b('head', -2.7 + i * 0.95, 1.6, 3.7, -2.0 + i * 0.95, 3.0, 4.2, BL, { bv: 0 }); // teeth
  B.b('head', -2.8, 2.15, 3.75, 2.8, 2.5, 4.1, HOLE, { bv: 0 });
  // helmet
  B.b('head', -4.4, 7.4, -4.2, 4.4, 11.4, 4.4, HEL);
  B.b('head', -4.8, 7.0, -4.6, 4.8, 8.6, 4.8, IRON); // band
  B.b('head', -4.0, 11.2, -3.6, 4.0, 12.0, 3.8, HEL_D, { bv: 0.15 });
  B.speck('head', [-4.4, 7.4, -4.2, 4.4, 12, 4.4], [RUST, HEL_D, RUST, IRON_D], 22, 9, { size: 1, faces: 'tlrbf' });
  for (const x of [-3.6, -1.2, 1.2, 3.6]) B.b('head', x - 0.25, 7.6, 4.7, x + 0.25, 8.1, 5.0, IRON_D, { bv: 0 }); // rivets
  B.b('head', -1.8, 8.0, 4.4, 1.8, 11.4, 5.6, IRON_D, { bv: 0.15 }); // lamp housing
  B.b('head', -1.4, 8.4, 5.4, 1.4, 11.0, 6.0, LAMP, { g: true, bv: 0.1 });
  B.b('head', -0.8, 9.0, 5.9, 0.8, 10.4, 6.2, 0xfff4b0, { g: true, bv: 0 });
  // ---------------------------------------------------------------- limbs: thin bones, knobby joints, chunky feet
  for (const s of ['L', 'R']) {
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -1.4, -1.2, -1.4, 1.4, 1.2, 1.4, BL); // shoulder knob
    B.b(arm, -0.8, -5.6, -0.8, 0.8, 0, 0.8, BN);
    B.b(arm, -1.1, -6.4, -1.1, 1.1, -5.2, 1.1, BD);
    B.b(fore, -0.75, -5.0, -0.75, 0.75, 0, 0.75, BN);
    B.b(fore, -1.3, -7.6, -1.3, 1.3, -5.0, 1.3, BL); // hand
    for (const x of [-0.8, 0, 0.8]) B.b(fore, x - 0.3, -8.8, 0.2, x + 0.3, -7.4, 0.9, BD, { bv: 0 });
    B.b(leg, -1.4, -1.0, -1.4, 1.4, 0.8, 1.4, BL);
    B.b(leg, -0.9, -6.4, -0.9, 0.9, 0, 0.9, BN);
    B.b(leg, -1.3, -7.2, -1.3, 1.3, -5.8, 1.3, BL); // knee
    B.b(shin, -0.85, -4.6, -0.85, 0.85, 0, 0.85, BN);
    B.b(shin, -2.2, -6.6, -2.2, 2.2, -3.8, 2.8, BD); // chunky foot
    B.speck(shin, [-2.2, -6.6, -2.2, 2.2, -3.8, 2.8], [BDD, BN, BD, 0x6a5e52], 12, s === 'L' ? 11 : 13, { size: 0.9, faces: 'tflrb' });
    void bone;
  }
  // ---------------------------------------------------------------- pickaxe (own bone in the left fist, handle along +y)
  B.b('pick', -0.7, -4, -0.7, 0.7, 14, 0.7, HANDLE);
  for (const y of [-3, 1, 5, 9]) B.b('pick', -0.85, y, -0.85, 0.85, y + 0.6, 0.85, HANDLE_D, { bv: 0 });
  B.b('pick', -1.2, 11.6, -1.2, 1.2, 14.6, 1.2, IRON, { bv: 0.15 }); // collar
  // curved head: a crescent of blocks through the collar
  const arc: [number, number][] = [[-9, 9.5], [-7.5, 11.6], [-5.5, 13.0], [-3.2, 14.0], [-1, 14.4], [1, 14.4], [3.2, 14.0], [5.5, 13.0], [7.5, 11.6], [9, 9.5]];
  arc.forEach(([z, y], i) => {
    const t = Math.abs(i - 4.5) / 4.5;
    const h = 2.6 - t * 1.2;
    B.b('pick', -0.9, y - h / 2, z - 1.3, 0.9, y + h / 2, z + 1.3, i % 3 === 0 ? PICK_D : i % 2 ? PICK : PICK_L, { bv: 0.12 });
  });
  B.b('pick', -0.6, 7.6, 9.4, 0.6, 9.2, 10.4, PICK_L, { bv: 0.1 });
  B.b('pick', -0.6, 7.6, -10.4, 0.6, 9.2, -9.4, PICK_L, { bv: 0.1 });

  const pose = {
    chest: [8, -10, 0] as [number, number, number],
    head: [-4, 14, 4] as [number, number, number],
    armL: [-30, 0, 18] as [number, number, number],
    foreL: [-42, 0, 0] as [number, number, number],
    armR: [-6, 0, -24] as [number, number, number],
    foreR: [-28, 0, 0] as [number, number, number],
    legL: [-10, 0, 10] as [number, number, number],
    shinL: [10, 0, -8] as [number, number, number],
    legR: [8, 0, -10] as [number, number, number],
    shinR: [6, 0, 8] as [number, number, number],
  };
  return {
    id: 'mob_skeleton_miner',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 13, hipX: 2.2, thigh: 6.6, torso: 3.6, shoulderY: 6.6, shoulderX: 5.4, neck: 8, upperArm: 6 },
      pose,
      [{ id: 'pick', parent: 'foreL', at: [0, -6.4, 0], r: [105, 0, -12] }],
    ),
    parts: B.parts,
    idle: humanIdle(1, 3),
  };
}
