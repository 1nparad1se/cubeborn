import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Swamp witch (Ведьма топей): a hunched crone in a long mud-brown robe dripping with swamp moss,
 * a deep hood edged with a pale ragged trim, a green face with one green and one amber glowing eye,
 * green clawed hands, a bundle of sticks strapped to her back, glass potions at the belt, and a
 * crooked staff topped with a glowing green orb.
 */

const R = 0x5e3a26;
const RL = 0x7a4e32;
const RD = 0x3e2618;
const RDD = 0x2c1a10;
const MOSS = 0x7a9a2c;
const MOSS_L = 0x9cbc3c;
const MOSS_D = 0x56702a;
const TRIM = 0xd8ccc8;
const TRIM_D = 0xa89c9e;
const SKIN = 0x9aac5a;
const SKIN_D = 0x6e7e3a;
const STICK = 0x6e4222;
const STICK_D = 0x4a2c16;
const GLOW = 0x7cff3a;
const GLOW_L = 0xc4ff6a;
const BOTTLE = 0x3ca83a;

export function swampWitch(): MobDef {
  const B = new MobBuilder();
  const robe = [R, RL, RD, RDD];
  const moss = [MOSS, MOSS_L, MOSS_D];
  // ---------------------------------------------------------------- robe skirt widening to the ground (hips bone, ground at y -11)
  for (let i = 0; i < 8; i++) {
    const y1 = 1.5 - i * 1.5;
    const y0 = y1 - 1.7;
    const w = 3.8 + i * 0.5;
    const d = 3.0 + i * 0.42;
    B.b('hips', -w, y0, -d, w, y1, d, i % 3 === 1 ? RD : R, { bv: 0.1 });
  }
  B.speck('hips', [-7.4, -10.5, -6, 7.4, 1.5, 6], robe, 40, 3, { size: 1.3 });
  B.speck('hips', [-7.4, -10.5, -6, 7.4, 1.5, 6], moss, 34, 5, { size: 0.9, sizeY: 2.6, out: 0.5, faces: 'fblr' });
  B.fringe('hips', -7.4, 7.4, -9, 6.0, 0.6, 3.5, [R, RD, MOSS_D, RDD], 7, 1.1);
  B.fringe('hips', -7.4, 7.4, -9, -6.6, 0.6, 3.5, [R, RD, MOSS, RDD], 9, 1.1);
  B.fringe('hips', -6, 6, -9, 7.0, 0.6, 3.5, [R, RD, MOSS_D], 11, 1.1, 'z');
  B.fringe('hips', -6, 6, -9, -7.6, 0.6, 3.5, [R, RD, MOSS_D], 13, 1.1, 'z');
  // rope belt, potions, bone charm
  B.b('hips', -4.2, 0.6, -3.4, 4.2, 1.6, 3.4, STICK_D);
  for (const [x, z, c] of [[3.6, 2.2, BOTTLE], [-3.4, 2.4, 0x58c048]] as [number, number, number][]) {
    B.b('hips', x - 0.9, -2.8, z - 0.7, x + 0.9, -0.4, z + 0.7, c, { g: true, bv: 0.1 });
    B.b('hips', x - 0.45, -0.5, z - 0.4, x + 0.45, 0.6, z + 0.4, TRIM_D, { bv: 0.05 });
    B.b('hips', x - 0.5, 0.5, z - 0.45, x + 0.5, 0.9, z + 0.45, STICK, { bv: 0 });
  }
  B.b('hips', 3.9, -4.2, -2.2, 4.6, -0.6, -1.4, TRIM, { bv: 0.05 }); // bone charm
  B.b('hips', 3.6, -1.6, -2.3, 4.9, -1.0, -1.3, TRIM, { bv: 0.05 });
  // green feet peeking out
  for (const x of [-2.2, 2.2]) {
    B.b('hips', x - 1.4, -11, 2.5, x + 1.4, -9.6, 6.6, SKIN_D, { bv: 0.15 });
    for (const t of [-0.8, 0, 0.8]) B.b('hips', x + t - 0.3, -11, 6.0, x + t + 0.3, -10.0, 6.9, SKIN, { bv: 0 });
  }
  // ---------------------------------------------------------------- chest: robe body, moss shawl
  B.b('chest', -4.2, -1, -3.2, 4.2, 6.8, 3.2, R);
  B.speck('chest', [-4.2, -1, -3.2, 4.2, 6.8, 3.2], robe, 16, 15, { size: 1.1 });
  B.b('chest', -5.2, 4.2, -3.8, 5.2, 7.4, 3.6, MOSS_D); // shawl
  B.speck('chest', [-5.2, 4.2, -3.8, 5.2, 7.4, 3.6], [...moss, R], 30, 17, { size: 1.1, out: 0.5 });
  B.fringe('chest', -5.2, 5.2, 4.6, 3.4, 0.5, 4, [MOSS, MOSS_D, R, MOSS_L], 19, 0.9);
  B.fringe('chest', -5.2, 5.2, 4.6, -4.0, 0.5, 5, [MOSS, MOSS_D, R], 21, 0.9);
  // bundle of sticks strapped on the back
  for (let i = 0; i < 5; i++) {
    const x = -2.4 + i * 1.2;
    const h0 = -4 + (i % 2) * 0.8;
    const h1 = 13 + ((i * 7) % 4);
    B.b('chest', x - 0.55, h0, -5.6, x + 0.55, h1, -4.4, i % 2 ? STICK : STICK_D, { bv: 0.1 });
  }
  for (const y of [1.0, 6.0]) B.b('chest', -3.4, y, -6.0, 3.4, y + 1.0, -3.6, RDD, { bv: 0.1 });
  B.b('chest', -4.6, 5.8, -3.8, 4.6, 6.6, 3.2, RDD, { bv: 0.05 }); // strap over the shoulders
  // ---------------------------------------------------------------- head: deep hood with pale trim, green face
  B.b('head', -3.6, -0.4, -2.6, 3.6, 6.6, 3.8, SKIN_D);
  B.b('head', -3.2, 0.2, 3.6, 3.2, 6.2, 4.0, 0x3a3a1e, { bv: 0 }); // face in shadow
  B.b('head', -2.6, 0.4, 3.9, 2.6, 4.4, 4.3, SKIN, { bv: 0.1 });
  B.b('head', -0.6, 2.0, 4.2, 0.6, 3.8, 5.0, SKIN, { bv: 0.15 }); // hooked nose
  B.b('head', -0.4, 1.6, 4.8, 0.4, 2.4, 5.3, SKIN_D, { bv: 0 });
  B.b('head', -1.8, 0.8, 4.2, 1.8, 1.4, 4.5, 0x2a2a14, { bv: 0 }); // mouth
  B.b('head', 0.9, 3.9, 4.0, 2.5, 5.0, 4.5, GLOW, { g: true, bv: 0 }); // green eye
  B.b('head', -2.5, 3.9, 4.0, -0.9, 5.0, 4.5, 0xffa02a, { g: true, bv: 0 }); // amber eye
  B.b('head', -5, 3.6, -5.2, 5, 10.4, 4.6, R); // hood
  B.b('head', -5, -1.4, -5.2, -3.8, 6, 4.6, R);
  B.b('head', 3.8, -1.4, -5.2, 5, 6, 4.6, R);
  B.b('head', -3.6, 9.6, -6, 3.6, 12.2, 1.4, RL); // peak
  B.b('head', -2.2, 11.6, -6.6, 2.2, 13.2, -2.6, R, { bv: 0.2 });
  B.speck('head', [-5, -1.4, -6, 5, 12.2, 4.6], robe, 36, 23, { size: 1.2, faces: 'tblr' });
  B.speck('head', [-5, 4, -6, 5, 12.2, 4.6], moss, 16, 25, { size: 1, sizeY: 2, faces: 'tblr' });
  // pale ragged trim around the face opening
  for (let i = 0; i < 10; i++) {
    const x = -4.6 + i;
    const y = 8.6 + (i % 3) * 0.3;
    B.b('head', x, y, 4.2, x + 1.05, y + 1.6, 5.2, i % 2 ? TRIM : TRIM_D, { bv: 0.1 });
  }
  for (const k of [-1, 1]) {
    for (let j = 0; j < 7; j++) B.b('head', k * 4.0, -1.2 + j * 1.4, 4.2, k * 5.4, -0.2 + j * 1.4, 5.2 - (j % 2) * 0.4, j % 2 ? TRIM : TRIM_D, { bv: 0.1 });
    B.b('head', k * 4.6, -2.6, 3.4, k * 6.8, -0.4, 5.0, TRIM, { bv: 0.15 }); // trim flap on the shoulder
  }
  // ---------------------------------------------------------------- arms: wide sleeves, green hands
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    B.b(arm, -1.8, -5.2, -1.8, 1.8, 1.2, 1.8, R);
    B.speck(arm, [-1.8, -5.2, -1.8, 1.8, 1.2, 1.8], [...moss, RD], 8, 27 + k, { size: 0.9, sizeY: 1.8 });
    B.b(fore, -2.3, -4.4, -2.3, 2.3, 0.4, 2.3, RL);
    B.fringe(fore, -2.3, 2.3, -3.6, 2.2, 0.4, 2.6, [R, RD, MOSS_D], 29 + k, 0.9);
    B.fringe(fore, -2.3, 2.3, -3.6, -2.6, 0.4, 2.6, [R, RD, MOSS], 31 + k, 0.9);
    B.b(fore, -1.5, -7.0, -1.5, 1.5, -4.0, 1.5, SKIN);
    for (const x of [-1.0, 0, 1.0]) B.b(fore, x - 0.35, -8.4, 0.2, x + 0.35, -6.8, 1.2, SKIN_D, { bv: 0 }); // claws
  }
  // ---------------------------------------------------------------- staff with the glowing orb
  B.b('staff', -0.8, -18.4, -0.8, 0.8, 12, 0.8, STICK);
  B.speck('staff', [-0.8, -18.4, -0.8, 0.8, 12, 0.8], [STICK_D, 0x8a5a30], 14, 33, { size: 0.5, sizeY: 2, out: 0.2 });
  B.b('staff', -1.2, 7, -1.2, 1.2, 8.6, 1.2, 0x5a4a58, { bv: 0.1 }); // binding
  B.b('staff', -1.0, 11, -1.0, 1.0, 13.5, 1.0, 0xc8b89a, { bv: 0.1 }); // pale bone cap
  B.b('staff', -1.8, 13.2, -1.8, 1.8, 16.8, 1.8, GLOW, { g: true });
  B.b('staff', -1.2, 13.6, -2.1, 1.2, 16.4, 2.1, GLOW_L, { g: true, bv: 0.1 });
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    const r = 3 + (i % 3) * 0.9;
    const y = 13 + ((i * 1.7) % 6);
    B.b('staff', Math.cos(a) * r - 0.3, y, Math.sin(a) * r - 0.3, Math.cos(a) * r + 0.3, y + 0.6, Math.sin(a) * r + 0.3, i % 2 ? GLOW : GLOW_L, { g: true, bv: 0 });
  }
  for (const [x, y0] of [[0.6, 11.0], [-0.8, 10.2]]) B.b('staff', x - 0.3, y0, 1.2, x + 0.3, 13.4, 1.8, GLOW, { g: true, bv: 0 }); // drips

  const pose = {
    chest: [22, -8, 0] as [number, number, number],
    head: [-14, 10, 0] as [number, number, number],
    armR: [-55, 0, -12] as [number, number, number],
    foreR: [-30, 0, 0] as [number, number, number],
    armL: [-20, 0, 26] as [number, number, number],
    foreL: [-50, 0, 0] as [number, number, number],
  };
  return {
    id: 'mob_swamp_witch',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 11, hipX: 2, thigh: 5, torso: 2.6, shoulderY: 5.6, shoulderX: 5.6, neck: 7.2, upperArm: 5 },
      pose,
      [{ id: 'staff', parent: 'hips', at: [8.3, 7.4, 7.2], r: [4, 0, -5] }],
    ),
    parts: B.parts,
    idle: [...humanIdle(1, 3.4), { b: 'staff', rot: [0, 6, 0], period: 4 }],
  };
}
