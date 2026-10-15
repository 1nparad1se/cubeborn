import { MOB_SCALE, MobBuilder, type MobBone, type MobDef, type V3 } from './mobKit';

/**
 * Giant bat (Гигантская летучая мышь): a hovering cave bat with a big pale, skull-like square head,
 * glowing red eyes and a fanged little mouth, a furry dark plum body, clawed feet dangling below,
 * and enormous wings: dark purple finger bones fanning out from a hooked thumb, spanning a ragged
 * magenta-pink membrane mottled darker towards the scalloped trailing edge.
 */

const HD = 0xd8c4c8;
const HDL = 0xeadce0;
const HDD = 0xb4a0a8;
const FU = 0x4a2a44;
const FUL = 0x6a3e5e;
const FUD = 0x2e1a2c;
const BN = 0x5a2a5e;
const BNL = 0x7a3c7c;
const MEM = 0xd0408a;
const MEML = 0xe85aa0;
const MEMD = 0xa02c6c;
const MEMDD = 0x7a2256;
const CLAW = 0x2a1820;
const EYE = 0xff2a2a;

export function giantBat(): MobDef {
  const B = new MobBuilder();
  const fur = [FU, FUL, FUD, FU];
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 16, 0], r: [16, 0, 0] },
    { id: 'head', parent: 'body', at: [0, 4, 1.5], r: [-14, 0, 0] },
    { id: 'wingL', parent: 'body', at: [3.2, 3, 0], r: [0, 0, 14] },
    { id: 'wingR', parent: 'body', at: [-3.2, 3, 0], r: [0, 0, -14] },
    { id: 'feet', parent: 'body', at: [0, -6, -0.5] },
  ];
  // ---------------------------------------------------------------- body: furry plum torso
  B.b('body', -3.6, -6.5, -3, 3.6, 4, 3, FU);
  B.speck('body', [-3.6, -6.5, -3, 3.6, 4, 3], fur, 50, 3, { size: 1.2, out: 0.6 });
  B.fringe('body', -3.2, 3.2, -6.2, -3.2, 0.6, 3, fur, 5, 0.8);
  B.fringe('body', -3.2, 3.2, -6.2, 2.6, 0.6, 2.4, fur, 7, 0.8);
  B.b('body', -2.6, -4, 2.8, 2.6, 2.6, 3.5, FUL, { bv: 0.1 }); // lighter chest
  B.b('body', -2.8, -7.4, -3.4, 2.8, 3.4, -2.6, HDD, { bv: 0.1 }); // pale stripe down the back
  B.speck('body', [-2.8, -7.4, -3.4, 2.8, 3.4, -2.6], [HDD, HD, FUL], 12, 9, { size: 0.9, faces: 'b' });
  B.crystal('body', [0, -6, -1.5], [0, -10, -2.5], 2, [FUL, HDD, HD]); // tail tuft
  // ---------------------------------------------------------------- head: pale skull-like cube
  B.b('head', -4, -2, -3.2, 4, 6, 4.8, HD);
  B.speck('head', [-4, -2, -3.2, 4, 6, 4.8], [HD, HDL, HDD, HD], 40, 11, { size: 1.0 });
  B.b('head', -3.4, 2.2, 4.6, 3.4, 3.0, 5.0, HDD, { bv: 0 }); // brow line
  for (const k of [-1, 1]) {
    B.b('head', k * 0.8, 0.6, 4.6, k * 3.0, 2.2, 5.0, 0x5a0a0a, { bv: 0 });
    B.b('head', k * 1.1, 0.8, 4.8, k * 2.7, 2.0, 5.2, EYE, { g: true, bv: 0 });
    B.b('head', k * 2.0, 5.4, -0.6, k * 3.4, 7.4, 1.0, HDD, { bv: 0.1 }); // small ears
  }
  B.b('head', -0.5, -0.2, 4.7, 0.5, 0.8, 5.3, HDD, { bv: 0.05 }); // snout
  B.b('head', -1.8, -1.6, 4.7, 1.8, -0.6, 5.1, 0x2a1418, { bv: 0 }); // mouth
  for (const k of [-1, 1]) B.b('head', k * 0.6, -2.0, 4.8, k * 1.2, -0.8, 5.25, 0xfff4f0, { bv: 0 }); // fangs
  // ---------------------------------------------------------------- wings: bones fanning out, ragged membrane between
  for (const k of [1, -1]) {
    const id = k > 0 ? 'wingL' : 'wingR';
    const sh: V3 = [0, 0, 0];
    const el: V3 = [k * 9, 4, -1];
    const wr: V3 = [k * 17, 7, -2];
    B.seg(id, sh, el, 1.8, 1.8, BN, { bv: 0.12 });
    B.seg(id, el, wr, 1.6, 1.6, BNL, { bv: 0.12 });
    B.b(id, wr[0] - 1.2, wr[1] - 1.2, wr[2] - 1.2, wr[0] + 1.2, wr[1] + 1.2, wr[2] + 1.2, BN, { bv: 0.15 });
    B.crystal(id, wr, [wr[0] - k * 0.5, wr[1] + 3.6, wr[2] + 1.2], 1.2, [BNL, BN, MEML]); // hooked thumb
    const tips: V3[] = [
      [k * 30, 9, -3],
      [k * 27, -3, -3],
      [k * 20, -10, -2.5],
      [k * 11, -11, -1.5],
    ];
    // membrane: a grid of small blocks clipped to the wing outline (x outward, y up)
    const poly: [number, number][] = [
      [2, 0],
      [9, 4],
      [17, 7],
      [30, 9],
      [27.5, 1],
      [27, -3],
      [23, -5],
      [20, -10],
      [16, -8],
      [11, -11],
      [6, -7],
      [2, -6],
    ];
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    for (let x = 2; x < 30; x += 1.4) {
      for (let y = -11; y < 9.5; y += 1.4) {
        if (!inside(x + 0.7, y + 0.7)) continue;
        const edge = !inside(x + 0.7, y - 1.2) || !inside(x + 2.2, y + 0.7);
        const r = Math.sin(x * 12.9 + y * 78.2 + k) * 43758.5;
        const f = r - Math.floor(r);
        const c = edge ? (f < 0.5 ? MEMD : MEMDD) : f < 0.15 ? MEMD : f < 0.55 ? MEM : f < 0.85 ? MEML : MEMD;
        const z = -1.5 - (x / 30) * 1.4;
        B.b(id, k * x - (k < 0 ? 1.45 : 0), y, z - 0.25, k * x + (k > 0 ? 1.45 : 0), y + 1.45, z + 0.25, c, { bv: 0.04 });
      }
    }
    for (const t of tips) {
      B.seg(id, wr, t, 1.0, 1.0, BN, { bv: 0.08 });
      B.segSpeck(id, wr, t, 0.4, [BN, BNL], 4, t[0] + t[1], 0.7);
    }
    B.seg(id, el, [k * 6, -7, -1.5], 0.9, 0.9, BN, { bv: 0.08 });
  }
  // ---------------------------------------------------------------- dangling clawed feet
  for (const k of [-1, 1]) {
    B.b('feet', k * 1.6 - 0.8, -4, -0.8, k * 1.6 + 0.8, 0.5, 0.8, FUD, { bv: 0.1 });
    B.b('feet', k * 1.6 - 1.2, -5.2, -1.2, k * 1.6 + 1.2, -3.8, 1.4, FU, { bv: 0.1 });
    for (const t of [-0.8, 0, 0.8]) B.crystal('feet', [k * 1.6 + t, -5, 0.8], [k * 1.6 + t * 1.3, -7.6, 1.8], 0.6, [CLAW, CLAW, 0x5a4048]);
  }
  return {
    id: 'mob_giant_bat',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.4,
    idle: [
      { b: 'root', pos: [0, 0.9, 0], period: 0.9 },
      { b: 'wingL', rot: [0, 0, 16], period: 0.9 },
      { b: 'wingR', rot: [0, 0, -16], period: 0.9 },
      { b: 'head', rot: [2, 6, 0], period: 3.4 },
      { b: 'feet', rot: [6, 0, 0], period: 0.9, phase: 0.3 },
    ],
  };
}
