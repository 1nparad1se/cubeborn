import { humanBones, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Shadow ghost (Теневой призрак): a floating hooded wraith of deep blue, its tall hood framing a
 * black void with two cyan eyes, ragged violet sleeves on outstretched arms ending in glowing cyan
 * claws, and a robe that frays downward into glowing cyan wisps, with motes of light drifting around.
 */

const BL = 0x3a4ec4;
const BLL = 0x4c64dc;
const BLD = 0x2a3690;
const BLDD = 0x161c48;
const VI = 0x6e48d0;
const VIL = 0x9058e4;
const CY = 0x58e4ff;
const CYL = 0xa0f4ff;
const CYD = 0x3aa8f0;
const VOID = 0x060814;

export function shadowGhost(): MobDef {
  const B = new MobBuilder();
  const blues = [BL, BLL, BLD];
  const G = { g: true };
  // ---------------------------------------------------------------- robe: blue at the waist fraying into glowing wisps
  B.b('hips', -4.2, -3, -2.8, 4.2, 3, 2.8, BL);
  B.speck('hips', [-4.2, -3, -2.8, 4.2, 3, 2.8], [...blues, VI], 18, 3, { size: 1.1 });
  const rows = [
    { y: -3, n: 9, len: 4, c: [BL, BLD, BLL, VI] },
    { y: -6.5, n: 8, len: 4.5, c: [CYD, BL, BLL] },
    { y: -10, n: 6, len: 5, c: [CYD, CY, CYD] },
  ];
  rows.forEach((r, j) => {
    const w = 4.0 - j * 0.9;
    const d = 2.6 - j * 0.5;
    const glow = j > 0;
    B.b('hips', -w, r.y - r.len * 0.7, -d, w, r.y + 0.3, d, j === 0 ? BLD : CYD, { g: glow });
    B.fringe('hips', -w, w, r.y, d - 0.4, 0.8, r.len, r.c, 5 + j, 1);
    B.fringe('hips', -w, w, r.y, -d - 0.4, 0.8, r.len, r.c, 9 + j, 1);
    B.fringe('hips', -d, d, r.y, w - 0.4, 0.8, r.len, r.c, 13 + j, 1, 'z');
    B.fringe('hips', -d, d, r.y, -w - 0.4, 0.8, r.len, r.c, 17 + j, 1, 'z');
  });
  // glowing tail tip
  B.b('hips', -1.4, -18.5, -1.0, 1.4, -13, 1.0, CY, G);
  B.b('hips', -0.8, -20.5, -0.6, 0.8, -18, 0.6, CYL, G);
  B.speck('hips', [-3.4, -16, -2.2, 3.4, -6, 2.2], [CY, CYL, CYD], 18, 21, { size: 0.8, g: true, faces: 'fblr' });
  // ---------------------------------------------------------------- chest
  B.b('chest', -4.4, -1, -2.8, 4.4, 7.4, 2.8, BL);
  B.speck('chest', [-4.4, -1, -2.8, 4.4, 7.4, 2.8], [...blues, VI, BLDD], 26, 23, { size: 1.1 });
  B.fringe('chest', -4.4, 4.4, 1.0, 2.5, 0.6, 3.5, [BL, BLD, VI], 25, 1);
  B.fringe('chest', -4.4, 4.4, 1.0, -3.1, 0.6, 4.5, [BL, BLD, BLL], 27, 1);
  B.b('chest', -5.4, 4.4, -3.4, 5.4, 7.8, 3.2, BLD); // hood mantle
  B.speck('chest', [-5.4, 4.4, -3.4, 5.4, 7.8, 3.2], [VI, VIL, BL], 16, 29, { size: 1.1 });
  // ---------------------------------------------------------------- tall hood with the void face
  B.b('head', -4, -0.8, -4, 4, 12.5, 4.2, BL);
  B.b('head', -3.4, 12.2, -3.4, 3.4, 13.6, 3.4, BLL);
  B.speck('head', [-4, -0.8, -4, 4, 13.6, 4.2], [...blues, BLL, VI], 40, 31, { size: 1.1, faces: 'tblr' });
  B.b('head', -2.8, -0.4, 3.8, 2.8, 9.8, 4.5, VOID, { bv: 0 });
  B.b('head', -2.2, -0.4, 3.6, 2.2, 3.2, 4.6, BLDD, { bv: 0 }); // faint chin in the dark
  B.b('head', -1.2, 1.6, 4.4, 1.2, 3.0, 4.7, 0x1a3a6a, { bv: 0 });
  for (const k of [-1, 1]) B.b('head', k * 0.6, 6.0, 4.3, k * 2.2, 7.2, 4.8, CY, { g: true, bv: 0 });
  // hood rim
  B.b('head', -4.3, -0.8, 3.9, -2.8, 12.2, 4.8, BLD, { bv: 0.1 });
  B.b('head', 2.8, -0.8, 3.9, 4.3, 12.2, 4.8, BLD, { bv: 0.1 });
  B.b('head', -4.3, 9.8, 3.9, 4.3, 12.4, 4.8, BLD, { bv: 0.1 });
  // ---------------------------------------------------------------- arms: ragged violet sleeves, glowing claws
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    B.b(arm, -2.0, -5.6, -2.0, 2.0, 1.6, 2.0, VI);
    B.speck(arm, [-2.0, -5.6, -2.0, 2.0, 1.6, 2.0], [VIL, BL, VI, BLL], 14, 33 + k, { size: 1.0, out: 0.5 });
    B.b(fore, -2.2, -4.6, -2.2, 2.2, 0.4, 2.2, BL);
    B.speck(fore, [-2.2, -4.6, -2.2, 2.2, 0.4, 2.2], [VI, BLL, CYD], 12, 35 + k, { size: 0.9, out: 0.4 });
    B.fringe(fore, -2.2, 2.2, -3.6, 2.0, 0.4, 2.4, [BL, VI, CYD], 37 + k, 0.8);
    B.fringe(fore, -2.2, 2.2, -3.6, -2.4, 0.4, 2.4, [BL, VI, CYD], 39 + k, 0.8);
    B.b(fore, -1.6, -7.0, -1.6, 1.6, -4.4, 1.6, CY, G);
    for (const x of [-1.1, 0, 1.1]) {
      B.b(fore, x - 0.35, -10.0, 0.6, x + 0.35, -6.8, 1.3, CYL, { g: true, bv: 0 });
      B.b(fore, x - 0.35, -10.6, 1.0, x + 0.35, -9.6, 2.1, CY, { g: true, bv: 0 });
    }
    B.b(fore, k * 1.2, -8.6, -0.6, k * 1.9, -6.6, 0.2, CYL, { g: true, bv: 0 }); // thumb
  }
  // drifting motes
  const motes: [number, number, number][] = [[-10, 12, 3], [9, 18, 2], [-8, 4, -2], [11, 6, 4], [-6, 22, -4], [7, 26, -1], [12, 14, -3], [-12, 17, 0], [4, 2, 6], [-3, 0, -6]];
  motes.forEach(([x, y, z], i) => B.b('motes', x - 0.4, y - 0.4, z - 0.4, x + 0.4, y + 0.4, z + 0.4, i % 2 ? CY : CYL, { g: true, bv: 0 }));

  const pose = {
    hips: [14, 0, 0] as [number, number, number],
    chest: [6, 0, 0] as [number, number, number],
    head: [-4, 0, 0] as [number, number, number],
    armL: [-48, 0, 24] as [number, number, number],
    foreL: [-26, 0, 0] as [number, number, number],
    armR: [-44, 0, -26] as [number, number, number],
    foreR: [-30, 0, 0] as [number, number, number],
  };
  const bones = humanBones(
    { hipY: 19, hipX: 2, thigh: 4, torso: 3, shoulderY: 6.2, shoulderX: 6.0, neck: 6.8, upperArm: 5.4 },
    pose,
    [{ id: 'motes', parent: 'root', at: [0, 0, 0] }],
  ).filter((b) => !b.id.startsWith('leg') && !b.id.startsWith('shin'));
  return {
    id: 'mob_shadow_ghost',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    idle: [
      { b: 'hips', pos: [0, 1.0, 0], period: 3 },
      { b: 'hips', rot: [0, 0, 2.5], period: 4.5 },
      { b: 'chest', rot: [-2, 0, 0], period: 3, phase: 0.2 },
      { b: 'head', rot: [2, 8, 0], period: 6 },
      { b: 'armL', rot: [5, 0, 4], period: 3, phase: 0.3 },
      { b: 'armR', rot: [5, 0, -4], period: 3, phase: 0.55 },
      { b: 'foreL', rot: [-6, 0, 0], period: 3, phase: 0.4 },
      { b: 'foreR', rot: [-6, 0, 0], period: 3, phase: 0.65 },
      { b: 'motes', pos: [0, 1.4, 0], period: 2.4 },
      { b: 'motes', rot: [0, 10, 0], period: 9 },
    ],
  };
}
