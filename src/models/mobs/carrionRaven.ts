import type { RigPart } from '../../render/rig/shapes';
import { MOB_SCALE, MobBuilder, type MobBone, type MobDef } from './mobKit';

/**
 * Carrion raven (Ворон-падальщик): a big hunched raven in slate and violet, wings half raised in a
 * threatening spread with long fingered feathers fading from violet to blue at the tips, a heavy
 * pale beak gaping over an orange maw, glowing magenta eyes, a long fanned tail, and scaly legs with
 * pale talons.
 */

const SL = 0x4e486c;
const SLL = 0x635d86;
const SLD = 0x3e3858;
const SLDD = 0x2a2440;
const VI = 0x6a3aa8;
const VIL = 0x8a50c8;
const VID = 0x4a2a7c;
const BLU = 0x3a54b8;
const BLUL = 0x4e6cd8;
const BEAK = 0x857aa2;
const BEAK_L = 0x9a90b8;
const MAW = 0xc85a2a;
const EYE = 0xff3cff;
const TAL = 0xd8bcc8;
const LEG = 0x3a3248;

function feather(b: string, x: number, y: number, ang: number, len: number, w: number, k: number, cIn: number, cOut: number, z = 0): RigPart[] {
  const a = (ang * Math.PI) / 180;
  const out: RigPart[] = [];
  for (let j = 0; j < 2; j++) {
    const t = j === 0 ? 0.3 : 0.78;
    const l = j === 0 ? len * 0.62 : len * 0.46;
    out.push({ b, s: 'rbox', bv: [0.18, 0.18, 0.18], p: [k * (x + Math.cos(a) * len * t), y + Math.sin(a) * len * t, z], d: [l, w, 0.9], c: j === 0 ? cIn : cOut, r: [0, 0, k * ang] });
  }
  return out;
}

export function carrionRaven(): MobDef {
  const B = new MobBuilder();
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 13, 0], r: [24, 0, 0] },
    { id: 'head', parent: 'body', at: [0, 7.2, 5.8], r: [-16, 0, 0] },
    { id: 'tail', parent: 'body', at: [0, -4.5, -6], r: [-52, 0, 0] },
    { id: 'wingL', parent: 'body', at: [5.2, 4.6, 0.5], r: [0, -24, 30] },
    { id: 'wingR', parent: 'body', at: [-5.2, 4.6, 0.5], r: [0, 24, -30] },
  ];
  const body = [SL, SLL, SLD, VID];
  // ---------------------------------------------------------------- body
  B.b('body', -5.51, -5.8, -6.52, 5.51, 7.25, 6.52, SL);
  B.b('body', -4.64, -7.25, -5.08, 4.64, -4.93, 5.08, SLD);
  B.b('body', -4.35, -4.35, 6.09, 4.35, 6.38, 7.83, SLL); // breast
  B.speck('body', [-5.51, -7.25, -6.52, 5.51, 7.25, 7.83], body, 40, 3, { size: 1.0 });
  B.fringe('body', -5.2, 5.2, -4.4, 6.7, 0.8, 4, [SL, SLD, VID], 5, 0.9);
  // ---------------------------------------------------------------- head and beak
  B.b('head', -4.35, -1.45, -3.77, 4.35, 6.67, 4.93, SLL);
  B.b('head', -3.77, 5.22, -4.35, 3.77, 7.54, 4.06, SL, { bv: 0.15 });
  B.speck('head', [-4.35, -1.45, -3.77, 4.35, 7.54, 4.93], [SL, SLL, SLD], 14, 7, { size: 0.9 });
  B.b('head', -4.06, 1.45, 3.77, 4.06, 5.22, 5.22, VI, { bv: 0.1 }); // violet mask
  for (const k of [-1, 1]) B.b('head', k * 0.9, 1.8, 3.3, k * 2.3, 2.8, 3.8, EYE, { g: true, bv: 0 });
  // upper beak: long and tapering, slightly down-curved
  B.b('head', -2.17, 0.0, 4.64, 2.17, 2.9, 9.57, BEAK);
  B.b('head', -1.59, -0.29, 9.28, 1.59, 2.32, 13.05, BEAK_L);
  B.b('head', -1.01, -1.16, 12.76, 1.01, 1.45, 15.08, BEAK, { bv: 0.15 });
  B.b('head', -0.58, -2.03, 14.5, 0.58, 0.29, 15.66, SLD, { bv: 0.1 });
  B.b('head', -1.89, -1.74, 4.93, 1.89, -0.14, 8.7, MAW, { bv: 0 }); // gaping maw
  B.b('head', -1.74, -3.19, 4.64, 1.74, -1.45, 10.15, BEAK, { bv: 0.12 }); // lower beak
  // ---------------------------------------------------------------- wings: leading edge plus fingered feathers
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const w = 'wing' + s;
    B.b(w, k * 0, -1.6, -1.8, k * 11, 1.8, 2.0, SLD);
    B.b(w, k * 10.6, -1.0, -1.5, k * 17, 1.5, 1.5, VID);
    B.speck(w, [k > 0 ? 0 : -9, -1.4, -1.6, k > 0 ? 9 : 0, 1.6, 1.8], [SL, VID, SLDD], 10, 9 + k, { size: 0.9 });
    // coverts
    for (let j = 0; j < 6; j++) B.add(...feather(w, 0.8 + j * 1.9, -0.6, -78 + j * 4, 7.5 + j * 0.4, 1.8, k, j % 2 ? VID : SLD, VI, -0.3));
    // primaries / secondaries fanning out and down, violet to blue
    for (let j = 0; j < 9; j++) {
      const x = 4 + j * 1.5;
      const ang = -70 + j * 9;
      const len = 10 + j * 1.1;
      B.add(...feather(w, x, 0, ang, len, 2.7, k, j % 2 ? VI : VIL, j % 2 ? BLU : BLUL, 0.3 - (j % 2) * 0.6));
    }
  }
  // ---------------------------------------------------------------- tail fan
  for (let j = 0; j < 7; j++) {
    const a = -30 + j * 10;
    const len = 17 - Math.abs(j - 3) * 1.2;
    const rad = (a * Math.PI) / 180;
    B.add({ b: 'tail', s: 'rbox', bv: [0.18, 0.18, 0.18], p: [Math.sin(rad) * len * 0.3, 0, -len * 0.3], d: [1.6, 0.9, len * 0.62], c: j % 2 ? VID : SLD, r: [0, a, 0] });
    B.add({ b: 'tail', s: 'rbox', bv: [0.18, 0.18, 0.18], p: [Math.sin(rad) * len * 0.78, -0.2, -len * 0.78], d: [1.7, 0.9, len * 0.46], c: j % 2 ? BLU : VI, r: [0, a, 0] });
  }
  // ---------------------------------------------------------------- legs and talons (on the root, standing)
  for (const k of [-1, 1]) {
    B.b('root', k * 1.2, 2.0, -0.6, k * 2.8, 9.0, 0.9, LEG);
    B.b('root', k * 0.9, 7.0, -1.0, k * 3.0, 9.6, 1.2, SLD, { bv: 0.1 });
    for (const t of [-1.2, 0, 1.2]) {
      B.b('root', k * 1.9 + t - 0.45, 0.6, 0.4, k * 1.9 + t + 0.45, 2.4, 3.2, LEG, { bv: 0.1 });
      B.b('root', k * 1.9 + t - 0.45, 0, 3.0, k * 1.9 + t + 0.45, 1.6, 4.0, TAL, { bv: 0.1 });
    }
    B.b('root', k * 1.9 - 0.45, 0, -2.6, k * 1.9 + 0.45, 1.6, -0.6, TAL, { bv: 0.1 });
  }

  return {
    id: 'mob_carrion_raven',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.5,
    idle: [
      { b: 'body', rot: [2, 0, 0], period: 2.0 },
      { b: 'head', rot: [4, 14, 0], period: 2.9 },
      { b: 'wingL', rot: [0, 0, 7], period: 2.0, phase: 0.1 },
      { b: 'wingR', rot: [0, 0, -7], period: 2.0, phase: 0.1 },
      { b: 'tail', rot: [3, 6, 0], period: 2.6 },
    ],
  };
}
