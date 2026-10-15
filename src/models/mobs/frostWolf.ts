import { MOB_SCALE, MobBuilder, type MobBone, type MobDef, type V3 } from './mobKit';

/**
 * Frost wolf (Морозный волк): a big, low-headed wolf with a thick coat mottled white, lavender and
 * deep blue, a white ruff and muzzle, a dark blue mask with glowing blue eyes and a crystal on the
 * brow, a snarling red mouth with long white fangs, a ridge of glowing ice crystals along the spine,
 * crystal-tipped ears, and a bushy tail that turns into a fan of clear ice shards.
 */

const WH = 0xeef2fa;
const WHG = 0xc8d0ea;
const LV = 0x9a9ad8;
const LVL = 0xb8b8ea;
const BL = 0x4a52a8;
const BLD = 0x2e347a;
const CR = 0x8ad4ff;
const CRL = 0xc4ecff;
const CRD = 0x4a9ae8;
const EYE = 0x40c8ff;
const NOSE = 0x14141e;

export function frostWolf(): MobDef {
  const B = new MobBuilder();
  const coat = [WH, WHG, LV, LVL, BL, BLD, LV];
  const crys = [CR, CRL, CRD];
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 13, 0], r: [-4, 0, 0] },
    { id: 'head', parent: 'body', at: [0, 1, 10], r: [22, 0, 0] },
    { id: 'tail', parent: 'body', at: [0, 2, -11], r: [-20, 0, 0] },
  ];
  // ---------------------------------------------------------------- body: shaggy coat, crystal spine
  B.b('body', -4.6, -4, -11, 4.6, 4.4, 9, LV);
  B.b('body', -5.4, -5.4, 2, 5.4, 5.4, 10.5, LVL); // deep shoulders
  B.b('body', -4, -6.4, 3, 4, -2, 11, WH); // white chest
  B.b('body', -3.6, -5, -8, 3.6, -3.4, 3, WHG); // belly
  B.speck('body', [-5.4, -5.4, -11, 5.4, 5.4, 10.5], coat, 130, 3, { size: 1.6, out: 0.6, faces: 'tlrb' });
  B.speck('body', [-5.4, -2, -11, 5.4, 5.4, 10.5], [BL, BLD, LV], 40, 4, { size: 1.6, out: 0.7, faces: 't' });
  B.speck('body', [-4, -6.4, 3, 4, 0, 11], [WH, WHG, LVL], 24, 5, { size: 1.3, faces: 'flrd' });
  B.fringe('body', -9, 9, -4.6, 5.0, 0.7, 3, [WH, WHG, LVL], 7, 1.2, 'z');
  B.fringe('body', -9, 9, -4.6, -5.7, 0.7, 3, [WH, WHG, LVL], 9, 1.2, 'z');
  for (let i = 0; i < 9; i++) {
    const z = -9 + i * 2.2;
    const h = 3 + Math.sin((i / 8) * Math.PI) * 4 + (i % 2) * 1.2;
    const x = ((i * 5) % 3) - 1;
    B.crystal('body', [x, 4.6, z], [x * 1.6, 4.6 + h, z + 0.8], 2 + (i % 2) * 0.7, crys, true);
  }
  B.crystal('body', [4.5, 2, -2], [6.5, 4, -2], 1.4, crys, true);
  B.crystal('body', [-4.5, 1, 4], [-6.5, 3, 4], 1.4, crys, true);
  // ---------------------------------------------------------------- head
  B.b('head', -4.4, -3.2, -2, 4.4, 4, 5.4, BL);
  B.speck('head', [-4.4, -3.2, -2, 4.4, 4, 5.4], [BL, BLD, LV], 22, 11, { size: 1.1, faces: 'tlr' });
  B.b('head', -5.4, -4.4, -2, 5.4, 1.6, 3.6, WH); // white ruff
  B.speck('head', [-5.4, -4.4, -2, 5.4, 1.6, 3.6], [WH, WHG, LVL], 30, 13, { size: 1.2, out: 0.8, faces: 'lrdf' });
  B.b('head', -2.2, -2.2, 5, 2.2, 1.2, 11, WH); // muzzle
  B.b('head', -1.6, 1.0, 5.2, 1.6, 2.0, 9.6, BLD, { bv: 0.08 }); // dark bridge
  B.b('head', -1.5, -0.4, 10.6, 1.5, 1.4, 11.8, NOSE, { bv: 0.15 });
  B.b('head', -2, -4.2, 5, 2, -2.4, 10.2, WHG); // jaw
  B.b('head', -2.1, -2.8, 5.4, 2.1, -2.1, 10.6, 0x8a1a1e, { bv: 0 }); // red mouth
  for (const k of [-1, 1]) {
    B.b('head', k * 1.2, -3.8, 9.4, k * 1.9, -1.8, 10.0, 0xf8f8ff, { bv: 0 }); // long fangs
    B.b('head', k * 1.3, -2.8, 6.4, k * 1.8, -2.2, 6.8, 0xf8f8ff, { bv: 0 });
    B.b('head', k * 1.0, 1.4, 5.2, k * 3.4, 2.8, 5.7, EYE, { g: true, bv: 0 });
    B.b('head', k * 0.8, 2.8, 5.0, k * 3.8, 3.6, 5.8, BLD, { bv: 0 });
    // ears: blue outside, crystal tips
    B.b('head', k * 1.0, 3.6, -0.4, k * 4.0, 6.6, 2.0, BL, { bv: 0.12 });
    B.b('head', k * 1.5, 4.0, 1.8, k * 3.5, 6.2, 2.3, WH, { bv: 0.05 });
    B.crystal('head', [k * 2.5, 6.2, 0.8], [k * 2.8, 10.4, 0.4], 2.2, crys, true);
  }
  B.crystal('head', [0, 3.6, 3.6], [0, 5.6, 4.6], 1.2, crys, true); // brow crystal
  // ---------------------------------------------------------------- legs
  const legs: [string, number, number, boolean][] = [
    ['legFL', 3.4, 7.5, true],
    ['legFR', -3.4, 7.5, true],
    ['legBL', 3.4, -8.5, false],
    ['legBR', -3.4, -8.5, false],
  ];
  for (const [id, x, z, front] of legs) {
    const k = x > 0 ? 1 : -1;
    bones.push({ id, parent: 'body', at: [x, -3, z], r: front ? [-4, 0, k * 8] : [8, 0, k * 6] });
    B.b(id, -2.3, -5.2, -2.3, 2.3, 1, 2.3, front ? LVL : LV);
    B.speck(id, [-2.3, -5.2, -2.3, 2.3, 1, 2.3], coat, 10, z + x, { size: 1 });
    B.b(id, -1.8, -9.6, -1.8, 1.8, -4.6, 1.8, WH);
    B.speck(id, [-1.8, -9.6, -1.8, 1.8, -4.6, 1.8], [WH, WHG, LVL, CR], 8, z * 2 + x, { size: 0.8 });
    B.b(id, -2.2, -10.6, -2.2, 2.2, -9.2, 3.2, WH, { bv: 0.1 }); // big paw
    for (const t of [-1.2, 0, 1.2]) B.b(id, t - 0.35, -10.6, 3.0, t + 0.35, -9.6, 3.8, LV, { bv: 0 });
  }
  // ---------------------------------------------------------------- tail: fur turning into a fan of ice shards
  B.b('tail', -2.2, -2.2, -6, 2.2, 2.2, 0.5, LV);
  B.speck('tail', [-2.2, -2.2, -6, 2.2, 2.2, 0.5], coat, 14, 15, { size: 1 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.6;
    B.crystal('tail', [Math.sin(a) * 1.5, 0, -4], [Math.sin(a) * 7, Math.cos(a) * 5 - 2, -14 - (i % 2) * 2.5], 3.4 - (i % 2) * 0.8, crys, true);
  }
  return {
    id: 'mob_frost_wolf',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.8,
    idle: [
      { b: 'body', pos: [0, 0.3, 0], rot: [0.8, 0, 0], period: 1.8 },
      { b: 'head', rot: [3, 6, 0], period: 3.8 },
      { b: 'tail', rot: [0, 10, 0] as V3, period: 2.4 },
    ],
  };
}
