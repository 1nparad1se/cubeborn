import { MOB_SCALE, MobBuilder, type MobBone, type MobDef } from './mobKit';

/**
 * Wild boar (Дикий кабан): a hulking, shaggy red-brown boar: a massive hunched back covered in
 * overlapping slabs of coarse fur, a bristly ridge, a heavy head with glowing red eyes under a dark
 * brow, a flat snout with deep nostrils, big ivory tusks curling up, short thick legs on dark hooves,
 * and a little tufted tail.
 */

const F = 0x7e4028;
const FL = 0x9a5432;
const FD = 0x5e2e1c;
const FDD = 0x40200f;
const SN = 0x4c2818;
const SNL = 0x6a3a22;
const TUSK = 0xeadcb8;
const TUSK_D = 0xc8b48c;
const HOOF = 0x26262c;
const HOOF_L = 0x6a6a72;
const EYE = 0xff2416;

export function wildBoar(): MobDef {
  const B = new MobBuilder();
  const fur = [F, FL, FD, F, FDD];
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 12, 0] },
    { id: 'head', parent: 'body', at: [0, 0, 8], r: [10, 0, 0] },
    { id: 'tail', parent: 'body', at: [0, 3, -12.4], r: [-14, 0, 0] },
  ];
  // ---------------------------------------------------------------- body: hunched, shaggy slabs
  B.b('body', -7, -5.5, -11, 7, 6, 8, F);
  B.b('body', -6, 5.6, -8, 6, 9, 6, FL); // hump
  B.b('body', -4, 8.6, -5, 4, 10.4, 4, F);
  B.speck('body', [-7, -5.5, -11, 7, 10.4, 8], fur, 60, 3, { size: 1.6 });
  // overlapping fur slabs down the flanks, ragged hems
  for (let i = 0; i < 4; i++) {
    const z0 = -10.5 + i * 4.6;
    for (const k of [-1, 1]) {
      const top = 7.5 - Math.abs(i - 1.5) * 0.8;
      B.b('body', k * 7.0, -2 + (i % 2) * 0.8, z0, k * 8.4, top, z0 + 4.4, i % 2 ? FL : F, { bv: 0.2 });
      B.fringe('body', z0, z0 + 4.4, -1.6 + (i % 2) * 0.8, k > 0 ? 7.0 : -8.4, 1.4, 4.5, [F, FD, FL, FDD], 5 + i + k, 1.1, 'z');
    }
  }
  // slabs on the back and over the shoulders
  for (let i = 0; i < 4; i++) {
    const z0 = -9 + i * 4;
    B.b('body', -5.5 + (i % 2), 8.6, z0, 5.5 - (i % 2), 10.0, z0 + 3.6, i % 2 ? FD : FL, { bv: 0.2 });
  }
  B.b('body', -7.5, 2, 4, 7.5, 8.5, 9.5, FD); // shoulder mane
  B.speck('body', [-7.5, 2, 4, 7.5, 8.5, 9.5], fur, 20, 7, { size: 1.4, faces: 'tflr' });
  B.fringe('body', -7, 7, -4, 7.4, 1.2, 3, [F, FD], 9, 1.2); // chest fringe
  B.fringe('body', -7, 7, -4, -11.4, 1.2, 3.5, [F, FD, FL], 11, 1.2); // rump fringe
  // bristle ridge
  for (let i = 0; i < 8; i++) B.b('body', -0.8, 10.0, -6 + i * 1.4, 0.8, 11.2 + ((i * 3) % 2) * 0.8, -5 + i * 1.4, FDD, { bv: 0.1 });
  // ---------------------------------------------------------------- head
  B.b('head', -5, -5.5, -1, 5, 4, 6.4, F);
  B.speck('head', [-5, -5.5, -1, 5, 4, 6.4], fur, 20, 13, { size: 1.2, faces: 'tlrf' });
  B.b('head', -4.6, 1.4, 6.0, 4.6, 2.8, 6.9, FDD, { bv: 0.1 }); // brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.4, -0.4, 6.1, k * 3.6, 1.2, 6.6, 0x3a0a08, { bv: 0 });
    B.b('head', k * 1.7, -0.1, 6.3, k * 3.3, 1.0, 6.8, EYE, { g: true, bv: 0 });
    B.b('head', k * 3.4, 3.4, -0.6, k * 5.4, 6.4, 1.6, FD, { bv: 0.15 }); // ear
    B.b('head', k * 3.8, 5.6, -0.2, k * 5.0, 7.4, 1.2, FDD, { bv: 0.1 });
  }
  B.b('head', -3.4, -5.2, 6.2, 3.4, -0.4, 11, SN); // snout
  B.b('head', -3.0, -4.6, 10.8, 3.0, -0.8, 11.6, SNL, { bv: 0.1 }); // snout plate
  for (const k of [-1, 1]) B.b('head', k * 0.6, -3.6, 11.4, k * 2.2, -1.6, 11.8, 0x140a06, { bv: 0 }); // nostrils
  B.b('head', -2.6, -6.2, 5.4, 2.6, -4.8, 9.6, FD); // jaw
  // tusks: up-curling, plus a small lower pair
  for (const k of [-1, 1]) {
    B.b('head', k * 3.0, -4.6, 7.6, k * 4.6, -2.8, 9.4, TUSK_D, { bv: 0.15 });
    B.b('head', k * 3.4, -3.2, 7.8, k * 4.8, 3.2, 9.2, TUSK, { bv: 0.15 });
    B.b('head', k * 3.6, 2.8, 7.4, k * 4.6, 4.6, 8.6, TUSK, { bv: 0.12 });
    B.b('head', k * 4.4, -4.4, 7.8, k * 7.4, -2.8, 9.2, TUSK, { bv: 0.15 }); // outward tusk
    B.b('head', k * 6.8, -3.8, 7.9, k * 7.8, -1.2, 9.0, TUSK_D, { bv: 0.1 });
  }
  // ---------------------------------------------------------------- legs and hooves
  const legs: [string, number, number][] = [
    ['legFL', 4.4, 4.5],
    ['legFR', -4.4, 4.5],
    ['legBL', 4.4, -8],
    ['legBR', -4.4, -8],
  ];
  for (const [id, x, z] of legs) {
    bones.push({ id, parent: 'body', at: [x, -5, z] });
    B.b(id, -2.0, -6.0, -2.0, 2.0, 1.0, 2.0, FD);
    B.speck(id, [-2.0, -4, -2.0, 2.0, 1.0, 2.0], [F, FDD], 6, x + z, { size: 1 });
    B.b(id, -2.3, -7.0, -2.2, 2.3, -5.2, 2.6, HOOF);
    B.b(id, -2.35, -7.0, 2.0, 2.35, -6.4, 2.75, HOOF_L, { bv: 0.05 });
    B.b(id, -0.2, -7.0, 1.0, 0.2, -5.4, 2.8, 0x111114, { bv: 0 }); // cleft
  }
  // ---------------------------------------------------------------- tail with a tuft
  B.b('tail', -0.7, -4, -1.2, 0.7, 0.5, 0.2, FD);
  B.b('tail', -1.6, -2.4, -1.4, 1.6, -1.2, 0.4, FD, { bv: 0.1 });
  B.b('tail', -1.1, -7, -1.4, 1.1, -3.6, 0.4, FDD, { bv: 0.15 });

  return {
    id: 'mob_wild_boar',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.7,
    idle: [
      { b: 'body', pos: [0, 0.3, 0], rot: [0.6, 0, 0], period: 2.4 },
      { b: 'head', rot: [4, 6, 0], period: 3.1 },
      { b: 'tail', rot: [0, 0, 14], period: 1.1 },
    ],
  };
}
