import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';
import { GOB, GOBLIN_DIMS, goblinBody } from './forestGoblin';

/**
 * Goblin archer (Гоблин-лучник): the forest goblin under a brown hood and ragged cloak, with a
 * belted chest strap, a wooden quiver of fletched arrows on the back and a long recurve bow drawn
 * with an arrow nocked.
 */

const WOOD = 0x8a4e22;
const WOOD_L = 0xa8662c;
const WOOD_D = 0x5e3416;
const WRAP = 0xe0c8a0;
const STRING = 0xd8cfb8;
const FLETCH = 0xeee6d4;
const TIP = 0xc8c8cc;
const BRASS = 0xc89a3a;

export function goblinArcher(): MobDef {
  const B = new MobBuilder();
  goblinBody(B, { hood: true });
  const { BR, BRD, BRL } = GOB;
  // cloak over the shoulders and back, ragged hem
  B.b('chest', -4.6, 3.6, -3.2, 4.6, 6.6, 2.9, BR);
  B.fringe('chest', -4.6, 4.6, 3.8, -3.3, 0.5, 6.5, [BR, BRD, BRL], 23);
  B.fringe('chest', -4.6, 4.6, 3.8, 2.6, 0.5, 2.5, [BR, BRD], 29);
  B.speck('chest', [-4.6, 3.6, -3.2, 4.6, 6.6, 2.9], [BRD, BRL], 14, 31, { size: 1 });
  // chest strap from the right shoulder to the left hip with a brass ring
  for (let i = 0; i < 6; i++) {
    const x = -3 + i * 1.2;
    const y = 5.6 - i * 1.0;
    B.b('chest', x - 0.7, y - 0.55, 2.2, x + 0.7, y + 0.55, 2.75, i % 2 ? WOOD_D : 0x6a3c1c, { bv: 0.08 });
    B.b('chest', -x - 0.7, y - 0.55, -3.5, -x + 0.7, y + 0.55, -3.0, WOOD_D, { bv: 0.08 });
  }
  B.b('chest', -0.9, 2.6, 2.6, 0.9, 4.2, 3.0, BRASS, { bv: 0.08 });
  B.b('chest', -0.4, 3.0, 2.8, 0.4, 3.8, 3.1, WOOD_D, { bv: 0 });
  B.b('hips', -1.3, 1.9, 2.25, 1.3, 3.4, 2.7, BRASS, { bv: 0.08 }); // belt buckle
  B.b('hips', -0.7, 2.3, 2.5, 0.7, 3.0, 2.85, WOOD_D, { bv: 0 });

  // quiver on the back, tilted, arrows sticking out over the right shoulder
  B.b('quiver', -1.8, -6, -1.6, 1.8, 6, 1.6, WOOD);
  for (const y of [-4.5, 3.8]) B.b('quiver', -2.0, y, -1.8, 2.0, y + 1.0, 1.8, WOOD_D, { bv: 0.1 });
  B.b('quiver', -0.9, -0.5, -2.0, 0.9, 1.3, -1.7, BRASS, { bv: 0.05 });
  B.b('quiver', 0.6, -5.6, -1.9, 1.4, 5.6, -1.6, WOOD_L, { bv: 0 });
  for (let i = 0; i < 5; i++) {
    const x = -1.0 + (i % 3) * 1.0;
    const z = -0.7 + Math.floor(i / 3) * 1.2;
    const h = 8.5 + (i % 2) * 1.2;
    B.b('quiver', x - 0.2, 5.5, z - 0.2, x + 0.2, h, z + 0.2, WOOD_D, { bv: 0 });
    B.b('quiver', x - 0.55, h - 2.2, z - 0.15, x + 0.55, h + 0.2, z + 0.15, FLETCH, { bv: 0 });
  }

  // long recurve bow in the left fist (vertical in the hand's frame: along local z after the arm is raised)
  const bow: [number, number, number][] = [
    [0, 0, 0], [1, 0.3, 0], [2, 0.8, 0], [3, 1.6, 0], [4, 2.3, 0], [5, 2.8, 0], [6, 3.0, 0], [7, 2.8, 0], [8, 2.2, 0], [9, 1.3, 0], [10, 1.4, 0],
  ];
  for (const sgn of [1, -1]) {
    bow.forEach(([i, dy], j) => {
      const z = sgn * i * 1.15;
      const c = j === 3 ? WRAP : j > 8 ? WOOD_D : j % 2 ? WOOD : WOOD_L;
      B.b('foreL', -0.7, -5.4 + dy, z - 0.7, 0.7, -4.1 + dy, z + 0.7, c, { bv: 0.1 });
    });
  }
  B.b('foreL', -0.9, -5.8, -1.1, 0.9, -3.8, 1.1, WOOD_D, { bv: 0.1 }); // grip wrap
  // string pulled back toward the right hand (thin rotated bars) and the arrow along it
  const nock = [0, -4.7 + 9.5, 0];
  for (const sgn of [1, -1]) {
    const ex = [0, -4.75 + 1.4, sgn * 11.6];
    const len = Math.hypot(nock[1] - ex[1], nock[2] - ex[2]);
    const ang = (Math.atan2(nock[2] - ex[2], nock[1] - ex[1]) * 180) / Math.PI;
    B.add({ b: 'foreL', s: 'box', p: [0, (nock[1] + ex[1]) / 2, (nock[2] + ex[2]) / 2], d: [0.25, len, 0.25], c: STRING, r: [ang, 0, 0], flat: true });
  }
  B.add({ b: 'foreL', s: 'box', p: [0, nock[1] - 6, 0], d: [0.35, 13, 0.35], c: WOOD_L, r: [0.0001, 0, 0], flat: true });
  B.add({ b: 'foreL', s: 'box', p: [0, nock[1] - 13, 0], d: [0.9, 1.4, 0.9], c: TIP, r: [0.0001, 0, 45], flat: true });
  B.add({ b: 'foreL', s: 'box', p: [0, nock[1] - 0.8, 0], d: [1.2, 1.6, 0.2], c: FLETCH, r: [0.0001, 0, 0], flat: true });

  const pose = {
    hips: [4, -10, 0] as [number, number, number],
    chest: [4, -14, 0] as [number, number, number],
    head: [-2, 22, 0] as [number, number, number],
    armL: [-84, 18, 6] as [number, number, number],
    foreL: [-4, 0, 0] as [number, number, number],
    armR: [0, -35, -82] as [number, number, number],
    foreR: [-150, 0, 0] as [number, number, number],
    legL: [-24, 0, 16] as [number, number, number],
    shinL: [26, 0, -10] as [number, number, number],
    legR: [12, 0, -14] as [number, number, number],
    shinR: [10, 0, 8] as [number, number, number],
  };
  return {
    id: 'mob_goblin_archer',
    scale: MOB_SCALE,
    bones: humanBones(GOBLIN_DIMS, pose, [{ id: 'quiver', parent: 'chest', at: [-1.2, 3.6, -4.6], r: [-8, 0, -24] }]),
    parts: B.parts,
    idle: humanIdle(0.8, 2.8),
  };
}
