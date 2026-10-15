import { MOB_SCALE, MobBuilder, type MobBone, type MobDef } from './mobKit';

/**
 * Jackal (Шакал): a lean, low-slung desert canine in a snarling crouch: tawny fur mottled with
 * light and dark tufts, a ridge of dark spiky hackles down the back, a cream chest, belly and
 * muzzle, tall pointed ears, glowing red eyes, a black nose over bared teeth, slim cream legs with
 * dark claws, and a bushy tail darkening to the tip.
 */

const T = 0xb0844e;
const TL = 0xcaa068;
const TD = 0x8a6236;
const DK = 0x5a3c22;
const DKK = 0x3e2816;
const CR = 0xe6d2a8;
const CRL = 0xf2e4c4;
const CRD = 0xc8b088;
const NOSE = 0x1e1612;
const EYE = 0xff2a1a;

export function jackal(): MobDef {
  const B = new MobBuilder();
  const fur = [T, TL, TD, T];
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 11.5, 0] },
    { id: 'head', parent: 'body', at: [0, 1.5, 7.5], r: [14, 0, 0] },
    { id: 'tail', parent: 'body', at: [0, 1.2, -9.5], r: [-38, 0, 0] },
  ];
  // ---------------------------------------------------------------- body
  B.b('body', -3.4, -3.2, -9.5, 3.4, 3.4, 7, T);
  B.b('body', -3.8, -4.4, 1.5, 3.8, 3.8, 8.5, TL); // deep chest / shoulders
  B.b('body', -2.8, -4.8, 2, 2.8, -1, 8.8, CR); // cream chest
  B.b('body', -2.6, -4.0, -7, 2.6, -2.6, 2, CRD); // belly
  B.b('body', -3.6, -3.4, -10, 3.6, 2.6, -6, TD); // haunches
  B.speck('body', [-3.8, -4.4, -10, 3.8, 3.8, 8.8], fur, 70, 3, { size: 1.2, faces: 'lrt' });
  B.speck('body', [-3.8, -4.8, 2, 3.8, 0, 8.8], [CR, CRL, CRD], 16, 5, { size: 1.0, faces: 'flr' });
  B.speck('body', [-3.6, -2, -10, 3.6, 3.4, -6], [DK, TD, T], 14, 7, { size: 1.1, faces: 'blr' });
  // dark hackles: spiky ridge along the back, taller over the shoulders
  for (let i = 0; i < 18; i++) {
    const z = -9 + i * 1.0;
    const h = 1.6 + 1.3 * Math.sin((i / 17) * Math.PI * 0.9 + 0.3) * 2.6 + ((i * 7) % 3) * 0.4;
    const x = ((i * 5) % 3) - 1;
    B.b('body', x - 1.4, 3.0, z - 0.6, x + 1.4, 3.0 + h, z + 0.6, i % 2 ? DK : DKK, { bv: 0.1 });
    if (i % 2 === 0) for (const k of [-1, 1]) B.b('body', k * 1.6 - 0.9, 2.2, z - 0.5, k * 1.6 + 0.9, 2.4 + h * 0.6, z + 0.5, i % 4 ? TD : DK, { bv: 0.08 });
  }
  // ---------------------------------------------------------------- head
  B.b('head', -3.9, -3.0, -2, 3.9, 3.6, 5, T);
  B.speck('head', [-3.9, -3.0, -2, 3.9, 3.6, 5], fur, 22, 9, { size: 1.0, faces: 'tlr' });
  B.b('head', -4.5, -3.8, -1.5, 4.5, 0.8, 3.6, CR); // cheek ruff
  B.speck('head', [-4.5, -3.8, -1.5, 4.5, 0.8, 3.6], [CR, CRL, TL], 12, 10, { size: 0.9, faces: 'lrd' });
  B.b('head', -1.9, -2.4, 4.6, 1.9, 0.8, 10.4, TL); // muzzle
  B.b('head', -1.8, -1.2, 4.6, 1.8, 0.9, 10.2, CRL, { bv: 0.1 });
  B.b('head', -1.3, -0.2, 9.8, 1.3, 1.2, 11.0, NOSE, { bv: 0.15 });
  B.b('head', -1.7, -3.6, 4.6, 1.7, -2.3, 9.6, CR); // lower jaw
  B.b('head', -1.75, -2.6, 5.2, 1.75, -2.1, 9.8, 0x3a1210, { bv: 0 }); // open mouth
  for (let i = 0; i < 4; i++) for (const k of [-1, 1]) B.b('head', k * 1.2 - 0.25, -2.6, 5.8 + i * 1.1, k * 1.2 + 0.25, -1.8, 6.2 + i * 1.1, 0xf6f0e0, { bv: 0 });
  B.b('head', -0.2, -2.9, 9.0, 0.2, -2.0, 9.4, 0xf6f0e0, { bv: 0 });
  for (const k of [-1, 1]) {
    B.b('head', k * 1.1, 1.0, 4.8, k * 2.7, 2.1, 5.3, EYE, { g: true, bv: 0 });
    B.b('head', k * 0.9, 2.1, 4.6, k * 2.9, 2.8, 5.3, DK, { bv: 0 }); // brow
    // tall ears
    B.b('head', k * 0.8, 3.2, -0.6, k * 3.8, 6.8, 2.2, T, { bv: 0.15 });
    B.b('head', k * 1.2, 6.6, -0.3, k * 3.4, 9.0, 1.9, TD, { bv: 0.12 });
    B.b('head', k * 1.7, 8.8, 0.1, k * 2.9, 10.4, 1.4, DK, { bv: 0.08 });
    B.b('head', k * 1.4, 3.8, 2.0, k * 3.2, 8.0, 2.5, CRL, { bv: 0.05 }); // inner ear
  }
  // ---------------------------------------------------------------- legs
  const legs: [string, number, number, number][] = [
    ['legFL', 2.4, 5.5, 1],
    ['legFR', -2.4, 5.5, 1],
    ['legBL', 2.4, -7.5, 0],
    ['legBR', -2.4, -7.5, 0],
  ];
  for (const [id, x, z, front] of legs) {
    const k = x > 0 ? 1 : -1;
    bones.push({ id, parent: 'body', at: [x, -2.5, z], r: front ? [-6, 0, k * 10] : [8, 0, k * 6] });
    B.b(id, -1.8, -4.6, -1.9, 1.8, 0.8, 1.9, front ? TL : TD);
    B.speck(id, [-1.5, -4.6, -1.6, 1.5, 0.8, 1.6], fur, 6, z + x, { size: 0.8 });
    B.b(id, -1.35, -8.4, -1.35, 1.35, -4.2, 1.35, CR);
    B.b(id, -1.6, -9.2, -1.4, 1.6, -7.8, 2.2, CRD, { bv: 0.1 }); // paw
    for (const t of [-0.8, 0, 0.8]) B.b(id, t - 0.25, -9.2, 1.8, t + 0.25, -8.5, 2.4, DKK, { bv: 0 });
  }
  // ---------------------------------------------------------------- bushy tail
  B.b('tail', -1.8, -1.8, -6, 1.8, 1.8, 0.5, TD);
  B.b('tail', -2.5, -2.5, -12, 2.5, 2.2, -5, DK);
  B.b('tail', -1.9, -2.0, -15, 1.9, 1.6, -11.5, DKK);
  B.speck('tail', [-2.2, -2.2, -13, 2.2, 2.0, 0.5], [T, TD, DK, DKK], 20, 13, { size: 1, faces: 'tlrd' });

  return {
    id: 'mob_jackal',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.8,
    idle: [
      { b: 'body', pos: [0, 0.25, 0], rot: [0.8, 0, 0], period: 1.6 },
      { b: 'head', rot: [3, 8, 0], period: 3.6 },
      { b: 'tail', rot: [0, 10, 0], period: 2.2 },
    ],
  };
}
