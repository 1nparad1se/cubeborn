import type { RigPart, V3 } from '../rig/shapes';
import { bowlTris, lumpTris, noise3, torusTris, wedgeTris, type CustomGeo, type ModelDef, type NodeDef } from './build';

/**
 * Weapon model library. Forward is +Z (direction of travel), up is +Y. Sizes are in voxels and
 * `vox` turns them into world units. Tiers: 1 base, 2 mid levels, 3 max level, 4 evolution.
 */

type P = Omit<RigPart, 'b'>;
const on = (b: string, ...ps: P[]): RigPart[] => ps.map((p) => ({ b, ...p }) as RigPart);

// palette
const GOLD = 0xe8c050;
const GOLD_D = 0xb88a2a;
const BONE = 0xd8d0b8;
const BONE_D = 0xb8ae92;
const INK = 0x1a1220;

// ------------------------------------------------------------------ Ember Orb: a cracked, glowing coal
function emberCore(seed: number, evo: boolean): (cx: number, cy: number, cz: number) => [number, number] {
  return (cx, cy, cz) => {
    const crack = Math.abs(noise3(cx * 0.34, cy * 0.34, cz * 0.34, seed + 7));
    const heat = noise3(cx * 0.5, cy * 0.5, cz * 0.5, seed);
    if (crack < (evo ? 0.2 : 0.13)) return [evo ? 0xfff0a0 : crack < 0.06 ? 0xffd060 : 0xff7a1a, 1];
    if (heat > (evo ? 0.35 : 0.5)) return [evo ? 0xffc040 : 0xff9a3a, 1];
    if (crack < 0.24) return [evo ? 0x8a3a10 : 0x5a2416, 0];
    const k = (noise3(cx * 1.2, cy * 1.2, cz * 1.2, seed + 3) + 1) / 2;
    return [evo ? (k > 0.5 ? 0x4a2a1a : 0x3a2016) : k > 0.5 ? 0x463631 : 0x2b211d, 0];
  };
}

export const EMBER: ModelDef = {
  vox: 0.05,
  rim: 0.25,
  nodes: [
    { n: 'core', until: 4 },
    { n: 'coreEvo', tier: 4 },
    { n: 'chunks', tier: 2 },
    { n: 'c0', parent: 'chunks', at: [7.5, 1, 0] },
    { n: 'c1', parent: 'chunks', at: [-4, -2, 6.5] },
    { n: 'c2', parent: 'chunks', at: [-3.5, 2.5, -6.5] },
    { n: 'band', tier: 3, rot: [24, 0, 12] },
    { n: 'flare', tier: 4 },
  ],
  parts: [
    ...[0, 72, 144, 216, 288].flatMap((a, i) =>
      on('flare', { s: 'gem', p: [Math.sin((a * Math.PI) / 180) * 8.5, (i % 2 ? 2 : -2), Math.cos((a * Math.PI) / 180) * 8.5], d: [1.6, 1.6, 4.6], r: [0, a, 0], c: 0xffe070, g: true }),
    ),
  ],
  custom: [
    { node: 'core', tris: lumpTris(6, 0.22, 3, 3), paint: emberCore(3, false) },
    { node: 'coreEvo', tris: lumpTris(6.6, 0.18, 5, 3), paint: emberCore(5, true) },
    { node: 'c0', tris: lumpTris(1.5, 0.3, 11, 0), paint: emberCore(11, false) },
    { node: 'c1', tris: lumpTris(1.2, 0.3, 12, 0), paint: emberCore(12, false) },
    { node: 'c2', tris: lumpTris(1.3, 0.3, 13, 0), paint: emberCore(13, false) },
    { node: 'band', tris: torusTris(7.6, 0.45, 20, 4), paint: (cx) => [cx > 0 ? 0xffb040 : 0xff6a1a, 1] },
  ],
  halos: [
    { name: 'glow', node: 'core', at: [0, 0, 0], size: 24, color: 0xff7a24, opacity: 0.85 },
    { name: 'hot', node: 'core', at: [0, 0, 0], size: 10, color: 0xffd8a0, opacity: 0.7 },
    { name: 'sun', node: 'flare', at: [0, 0, 0], size: 34, color: 0xffd040, opacity: 0.7, tier: 4 },
    { name: 'flash', node: 'core', at: [0, 0, 0], size: 40, color: 0xffc070, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Venom Flask: glass, liquid, cork
const bubbles: NodeDef[] = [0, 1, 2, 3, 4].map((i) => ({ n: 'bub' + i, parent: 'liquid', at: [((i * 37) % 7) - 3, -3, ((i * 53) % 7) - 3] as V3 }));
export const FLASK: ModelDef = {
  vox: 0.045,
  rim: 0.3,
  glassOpacity: 0.32,
  nodes: [
    { n: 'flask' },
    { n: 'liquid' },
    ...bubbles,
    { n: 'tag', parent: 'flask', at: [2.6, 8.6, 1.2], rot: [0, 0, -18] },
    { n: 'cage', parent: 'flask', tier: 2 },
    { n: 'runes', parent: 'flask', tier: 3 },
    { n: 'bloom', parent: 'flask', tier: 4 },
  ],
  parts: [
    ...on(
      'flask',
      { s: 'ball', p: [0, 0, 0], d: [12.4, 12, 12.4], c: 0xd8ffe0, grp: 'glass' },
      { s: 'cyl', p: [0, 7.6, 0], d: [4.6, 5, 4.6], c: 0xd8ffe0, n: 10, grp: 'glass' },
      { s: 'cyl', p: [0, 10.3, 0], d: [5.6, 1.1, 5.6], c: 0xc8f0d0, n: 10, grp: 'glass' },
      { s: 'cyl', p: [0, 11.6, 0], d: [3.8, 3, 3.8], t: [0.82, 0.82], c: 0x9a6a3a, n: 8 },
      { s: 'cyl', p: [0, 13.3, 0], d: [3.4, 0.8, 3.4], c: 0x7a4a24, n: 8 },
      { s: 'ball', p: [0, 13.9, 0], d: [2.6, 1.4, 2.6], c: 0x7a2a9a },
      // the shine on the glass: a bright streak and a dot
      { s: 'rbox', p: [-3.3, 2.4, 4.1], d: [0.9, 3.6, 0.4], r: [0, -40, 22], c: 0xffffff, g: true },
      { s: 'ball', p: [-1.6, 4.4, 4.8], d: [0.9, 0.9, 0.5], c: 0xffffff, g: true },
    ),
    ...on(
      'tag',
      { s: 'rbox', p: [0, -2.2, 0], d: [3.2, 3.8, 0.4], c: 0xe8dcb8 },
      { s: 'rbox', p: [0, -1.8, 0.25], d: [1.6, 1.4, 0.2], c: 0x3a2a3a, flat: true },
      { s: 'rbox', p: [0, -3.1, 0.25], d: [1.2, 0.5, 0.2], c: 0x3a2a3a, flat: true },
      { s: 'box', p: [0, 0, 0], d: [0.4, 0.8, 0.4], c: 0xd8c89a },
    ),
    ...on('cage', { s: 'rbox', p: [0, -6.4, 0], d: [5, 1, 5], c: GOLD_D }),
    ...[0, 90, 180, 270].flatMap((a) =>
      on('runes', { s: 'rbox', p: [Math.sin((a * Math.PI) / 180) * 6.5, 0, Math.cos((a * Math.PI) / 180) * 6.5], d: [1.2, 1.6, 0.5], r: [0, a, 0], c: 0xb8ff6a, g: true }),
    ),
    ...[0, 72, 144, 216, 288].flatMap((a) =>
      on('bloom', { s: 'gem', p: [Math.sin((a * Math.PI) / 180) * 3.6, 9.2, Math.cos((a * Math.PI) / 180) * 3.6], d: [2.2, 1, 4.4], r: [-30, a, 0], c: 0xd4ff3d }),
    ),
    ...bubbles.map((b, i) => ({ b: b.n, s: 'ball', p: [0, 0, 0], d: [0.9 + (i % 3) * 0.35, 0.9 + (i % 3) * 0.35, 0.9 + (i % 3) * 0.35], c: 0xe8ffc0, g: true }) as RigPart),
  ],
  custom: [
    // liquid: darker deep, bright surface
    { node: 'liquid', tris: bowlTris(5.4, 0.18, 14), paint: (_x, y) => (y > 0.85 ? [0xc8ff7a, 1] : y > -1 ? [0x8ae83a, 1] : y > -3.5 ? [0x5ab824, 1] : [0x3a8a18, 1]) },
    { node: 'flask', tris: torusTris(2.6, 0.45, 12, 4, [0, 8.8, 0]), paint: () => [0xd8c89a, 0] },
    { node: 'cage', tris: torusTris(6.35, 0.45, 20, 4, [0, 0, 0]), paint: () => [GOLD, 0] },
    { node: 'cage', tris: torusTris(6.35, 0.45, 20, 4, [0, 0, 0], [90, 0, 0]), paint: () => [GOLD, 0] },
    { node: 'cage', tris: torusTris(6.35, 0.45, 20, 4, [0, 0, 0], [90, 90, 0]), paint: () => [GOLD_D, 0] },
  ],
  halos: [
    { name: 'glow', node: 'flask', at: [0, 0, 0], size: 16, color: 0x8aff4a, opacity: 0.2 },
    { name: 'flash', node: 'flask', at: [0, 0, 0], size: 36, color: 0xc8ff8a, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Poison puddle (Venom Flask ground pool)
export const PUDDLE: ModelDef = {
  vox: 0.1,
  nodes: [{ n: 'pool' }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ n: 'pb' + i, parent: 'pool' }))],
  parts: [0, 1, 2, 3, 4, 5].map((i) => ({ b: 'pb' + i, s: 'ball', p: [0, 0, 0], d: [1.4, 1, 1.4], c: 0xd8ff8a, g: true }) as RigPart),
  custom: [
    {
      node: 'pool',
      tris: lumpTris(10, 0.12, 21, 2).map((v, i) => (i % 3 === 1 ? Math.max(-0.2, v * 0.03) : v)),
      paint: (cx, _y, cz) => {
        const r = Math.hypot(cx, cz);
        return r > 9 ? [0x1a3a0c, 0] : r > 6.5 ? [0x285a12, 0] : noise3(cx * 0.4, 0, cz * 0.4, 4) > 0.3 ? [0x6ab82e, 1] : [0x346a18, 0];
      },
    },
  ],
  halos: [{ name: 'glow', node: 'pool', at: [0, 1, 0], size: 18, color: 0x7aff3a, opacity: 0.12 }],
};

// ------------------------------------------------------------------ Cyclone Fan (held) and its cyclone
const SLATS = 7;
const SLAT_STEP = 25;
const slatNodes: NodeDef[] = Array.from({ length: SLATS }, (_, i) => ({ n: 's' + i, parent: 'fan' }));
export const FAN: ModelDef = {
  vox: 0.05,
  rim: 0.35,
  nodes: [{ n: 'fan' }, { n: 'tassel', parent: 'fan', at: [0, -6.4, 0] }, ...slatNodes, { n: 'eye', parent: 'fan', tier: 4 }],
  parts: [
    ...on(
      'fan',
      { s: 'cyl', p: [0, -3, 0], d: [1.7, 5.4, 1.7], c: 0x6a3a2a, n: 8 },
      { s: 'cyl', p: [0, -5.9, 0], d: [2.1, 0.9, 2.1], c: GOLD, n: 8 },
      { s: 'ball', p: [0, 0, 0.6], d: [2.2, 2.2, 1.2], c: GOLD },
    ),
    ...on(
      'tassel',
      { s: 'box', p: [0, -1, 0], d: [0.4, 2, 0.4], c: 0xd84a4a },
      { s: 'cyl', p: [0, -2.9, 0], d: [1.4, 2.2, 1.4], t: [0.4, 0.4], c: 0xd84a4a, n: 6 },
    ),
    ...on('eye', { s: 'gem', p: [0, 0, 1.2], d: [3, 3, 1.8], c: 0x6ae0ff, g: true }),
    ...slatNodes.flatMap((s, i) => [
      { b: s.n, s: 'rbox', p: [0, 6.6, 0.3], d: [0.8, 13.2, 0.5], c: i % 2 ? 0xe8dcc0 : 0xd8c8a8 } as RigPart,
      { b: s.n, s: 'gem', p: [0, 13.4, 0.3], d: [1, 1.6, 0.6], c: GOLD } as RigPart,
    ]),
    // wind runes on the membrane (mid tiers)
    ...slatNodes.slice(0, SLATS - 1).map((s, i) => ({ b: s.n, s: 'rbox', p: [Math.sin(((SLAT_STEP / 2) * Math.PI) / 180) * 8.5, Math.cos(((SLAT_STEP / 2) * Math.PI) / 180) * 8.5, 0.35], d: [1.4, 0.5, 0.2], r: [0, 0, -SLAT_STEP / 2 + (i % 2 ? 40 : -40)], c: 0x9af0ff, g: true, grp: 't2' }) as RigPart),
  ],
  custom: slatNodes.slice(0, SLATS - 1).flatMap((s, i): CustomGeo[] => [
    { node: s.n, tris: wedgeTris(3.2, 12.2, 0, SLAT_STEP, 0.25), paint: (cx, cy) => (Math.hypot(cx, cy) > 11.2 ? [0x7ac8e8, 0] : [i % 2 ? 0xd8f4ff : 0xb8e8f8, 0]) },
    { node: s.n, tris: wedgeTris(12.2, 12.9, 0, SLAT_STEP, 0.4, 2), paint: () => [GOLD, 0] },
  ]),
  halos: [{ name: 'pivot', node: 'fan', at: [0, 0, 1], size: 10, color: 0x9af0ff, opacity: 0.6 }],
};

const leafNodes: NodeDef[] = Array.from({ length: 9 }, (_, i) => ({ n: 'lf' + i, tier: i < 5 ? 1 : i < 7 ? 2 : 3 }));
export const CYCLONE: ModelDef = {
  vox: 0.06,
  rim: 0.35,
  glassOpacity: 0.3,
  // the funnel itself is a shader whirlwind (vortex.ts); the model carries the debris, runes and eye
  nodes: [...leafNodes, { n: 'core' }, { n: 'base' }, { n: 'runes', tier: 3 }, { n: 'eye', tier: 4, at: [0, 38, 0] }],
  parts: [
    ...on('eye', { s: 'gem', p: [0, 0, 0], d: [4.4, 5.4, 4.4], c: 0x6ae0ff, g: true }, { s: 'gem', p: [0, 0, 0], d: [2, 2.6, 2], c: 0xffffff, g: true }),
    ...leafNodes.map((l, i) => ({ b: l.n, s: i % 3 === 2 ? 'gem' : 'rbox', p: [0, 0, 0], d: i % 3 === 2 ? [1.2, 1, 1.2] : [1.8, 0.3, 1.1], c: [0x6aa040, 0xa8c050, 0x8a6a3a][i % 3] }) as RigPart),
  ],
  custom: [{ node: 'runes', tris: torusTris(9.5, 0.35, 28, 3, [0, 0.4, 0]), paint: () => [0x9af0ff, 1] }],
  halos: [
    { name: 'dust', node: 'base', at: [0, 1, 0], size: 30, color: 0xd8c8a8, opacity: 0.3 },
    { name: 'inner', node: 'core', at: [0, 16, 0], size: 20, color: 0xc8f4ff, opacity: 0.2 },
    { name: 'eye', node: 'eye', at: [0, 0, 0], size: 18, color: 0x6ae0ff, opacity: 0.8, tier: 4 },
  ],
};

// ------------------------------------------------------------------ Storm Rod: caged storm crystal on a staff
const prong = (a: number): RigPart[] => {
  const s = Math.sin((a * Math.PI) / 180);
  const c = Math.cos((a * Math.PI) / 180);
  return [
    { b: 'head', s: 'rbox', p: [s * 2.4, 1.8, c * 2.4], d: [0.9, 4, 0.9], r: [c * 22, 0, -s * 22], c: GOLD },
    { b: 'head', s: 'rbox', p: [s * 2.6, 5.4, c * 2.6], d: [0.8, 3.6, 0.8], r: [-c * 30, 0, s * 30], c: GOLD },
    { b: 'head', s: 'gem', p: [s * 1.6, 7.3, c * 1.6], d: [0.9, 1.4, 0.9], c: 0xffe890, g: true },
  ];
};
export const ROD: ModelDef = {
  vox: 0.05,
  rim: 0.45,
  nodes: [
    { n: 'rod' },
    { n: 'head', parent: 'rod', at: [0, 8.6, 0] },
    { n: 'core', parent: 'head', at: [0, 4, 0] },
    { n: 'orbit', parent: 'head', at: [0, 4, 0], tier: 2 },
    { n: 'sh0', parent: 'orbit', at: [4.6, 0, 0] },
    { n: 'sh1', parent: 'orbit', at: [-2.3, 1, 4] },
    { n: 'sh2', parent: 'orbit', at: [-2.3, -1, -4] },
    { n: 'ring', parent: 'head', at: [0, 4, 0], tier: 3 },
    { n: 'crown', parent: 'head', tier: 4 },
  ],
  parts: [
    ...on(
      'rod',
      { s: 'cyl', p: [0, 0, 0], d: [1.5, 16, 1.5], c: 0x34405e, n: 8 },
      { s: 'cyl', p: [0, 7.8, 0], d: [2.6, 1.4, 2.6], c: GOLD, n: 8 },
      { s: 'cyl', p: [0, -7.6, 0], d: [2.3, 1.2, 2.3], c: GOLD, n: 8 },
      { s: 'cyl', p: [0, -9.9, 0], d: [1.8, 3.2, 1.8], t: [0.05, 0.05], r: [180, 0, 0], c: GOLD_D, n: 6 },
      { s: 'ball', p: [0, -8.6, 0], d: [1.4, 1.4, 1.4], c: 0x8ad8ff, g: true },
      // engraved lightning line down the shaft
      { s: 'box', p: [0, 3, 0.72], d: [0.3, 3, 0.2], r: [0, 0, 18], c: 0x8ad8ff, g: true, flat: true },
      { s: 'box', p: [0, 0.4, 0.72], d: [0.3, 2.6, 0.2], r: [0, 0, -18], c: 0x8ad8ff, g: true, flat: true },
    ),
    ...prong(45),
    ...prong(135),
    ...prong(225),
    ...prong(315),
    ...on('core', { s: 'gem', p: [0, 0, 0], d: [3.4, 5.2, 3.4], c: 0xbfeaff, g: true }, { s: 'gem', p: [0, 0, 0], d: [1.6, 2.6, 1.6], c: 0xffffff, g: true }),
    ...['sh0', 'sh1', 'sh2'].map((n) => ({ b: n, s: 'gem', p: [0, 0, 0], d: [0.9, 1.8, 0.9], c: 0x9ae0ff, g: true }) as RigPart),
    ...[0, 72, 144, 216, 288].map((a) => ({ b: 'crown', s: 'cyl', p: [Math.sin((a * Math.PI) / 180) * 3.2, 8.4, Math.cos((a * Math.PI) / 180) * 3.2], d: [1, 2.6, 1], t: [0.05, 0.05], c: 0xffe070, n: 5 }) as RigPart),
  ],
  custom: [
    { node: 'rod', tris: torusTris(0.95, 0.4, 10, 4, [0, -3.2, 0]), paint: () => [0x6a4a2a, 0] },
    { node: 'rod', tris: torusTris(0.95, 0.4, 10, 4, [0, -4.4, 0]), paint: () => [0x7a5a32, 0] },
    { node: 'rod', tris: torusTris(0.95, 0.4, 10, 4, [0, -5.6, 0]), paint: () => [0x6a4a2a, 0] },
    { node: 'head', tris: torusTris(2.4, 0.55, 12, 4, [0, 0.3, 0]), paint: () => [GOLD, 0] },
    { node: 'ring', tris: torusTris(4.8, 0.3, 24, 3), paint: () => [0x9ae0ff, 1] },
    { node: 'crown', tris: torusTris(3.2, 0.5, 14, 4, [0, 7.2, 0]), paint: () => [GOLD, 0] },
  ],
  halos: [
    { name: 'core', node: 'core', at: [0, 0, 0], size: 16, color: 0x8ad0ff, opacity: 0.9 },
    { name: 'flash', node: 'core', at: [0, 0, 0], size: 50, color: 0xd8f0ff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Tempest Crown storm cloud
export const STORMCLOUD: ModelDef = {
  vox: 0.07,
  rim: 0.2,
  nodes: [{ n: 'cloud' }, { n: 'puffs', parent: 'cloud' }, { n: 'bolt', parent: 'cloud' }],
  parts: [],
  custom: [
    ...([
      [0, 0, 0, 5.5],
      [5, -0.5, 1.5, 4],
      [-5, -0.3, -1, 4.4],
      [1.5, 1.6, -3, 3.6],
      [-2, 1.2, 3.4, 3.4],
      [7.5, -1.2, -2, 2.6],
    ] as [number, number, number, number][]).map(([x, y, z, r], i): CustomGeo => ({
      node: 'puffs',
      tris: lumpTris(r, 0.18, 30 + i, 1, [x, y, z]),
      paint: (_cx, cy) => (cy > y + r * 0.35 ? [0x9aa4c8, 0] : cy > y - r * 0.2 ? [0x6a7096, 0] : [0x464a68, 0]),
    })),
    { node: 'bolt', tris: lumpTris(1.6, 0.4, 41, 0, [1, -2.6, 0.5]), paint: () => [0xfff27a, 1] },
  ],
  halos: [{ name: 'inner', node: 'cloud', at: [0, -1.5, 0], size: 24, color: 0x9ad0ff, opacity: 0.4 }],
};

// ------------------------------------------------------------------ Starfall Tome: an opening spellbook
const LEATHER = 0x3a2a6a;
const LEATHER_E = 0x5a1a22;
const cornerGuards = (b: string, x0: number, y: number): RigPart[] =>
  [
    [x0 + 5.4, 7.4],
    [x0 + 5.4, -7.4],
    [x0 - 5.4, 7.4],
    [x0 - 5.4, -7.4],
  ].map(([x, z]) => ({ b, s: 'rbox', p: [x, y, z], d: [2, 0.5, 2], c: GOLD }) as RigPart);
const inkLines = (b: string, x0: number, y: number, glow: boolean): RigPart[] => {
  const out: RigPart[] = [];
  for (let r = 0; r < 6; r++) {
    const z = -5.6 + r * 2.2;
    const w = 6 + ((r * 5) % 3);
    out.push({ b, s: 'box', p: [x0, y, z], d: [w, 0.12, 0.45], c: 0x5a4a5a, flat: true });
  }
  if (glow) out.push({ b, s: 'gem', p: [x0, y + 0.1, 0], d: [2.6, 0.2, 2.6], c: 0xffd860, g: true });
  return out;
};
const pageNodes: NodeDef[] = [0, 1, 2].map((i) => ({ n: 'pg' + i, parent: 'book', at: [0, 1.8, 0] as V3 }));
const starNodes: NodeDef[] = Array.from({ length: 7 }, (_, i) => ({ n: 'st' + i, parent: 'orb', tier: i < 3 ? 1 : i < 5 ? 2 : 3 }));
export const TOME: ModelDef = {
  vox: 0.045,
  rim: 0.35,
  nodes: [
    { n: 'book' },
    { n: 'R', parent: 'book' },
    { n: 'L', parent: 'book', at: [0, 1.8, 0], rot: [0, 0, -180] },
    ...pageNodes,
    { n: 'ribbon', parent: 'R', at: [0.6, 1.2, -8] },
    { n: 'orb' },
    ...starNodes,
  ],
  parts: [
    // right half: cover, page block, ink, clasp
    ...on('R', { s: 'rbox', p: [6.3, -0.45, 0], d: [12.6, 0.9, 16.4], c: LEATHER, bv: [0.6, 0.3, 0.3] }, { s: 'rbox', p: [6, 0.9, 0], d: [11.6, 1.8, 15], c: 0xf0e6c8, bv: [0.3, 0.2] }),
    ...cornerGuards('R', 6.3, -0.95),
    ...on('R', { s: 'gem', p: [6.3, -1.05, 0], d: [3.4, 0.6, 3.4], c: 0xffd860, g: true }),
    ...inkLines('R', 6, 1.82, true),
    ...on('R', { s: 'rbox', p: [12.8, 0.8, 0], d: [0.8, 2.6, 2.4], c: GOLD }),
    // left half (folded over when closed)
    ...on('L', { s: 'rbox', p: [-6.3, -2.25, 0], d: [12.6, 0.9, 16.4], c: LEATHER, bv: [0.6, 0.3, 0.3] }, { s: 'rbox', p: [-6, -0.9, 0], d: [11.6, 1.8, 15], c: 0xf0e6c8, bv: [0.3, 0.2] }),
    ...cornerGuards('L', -6.3, -2.75),
    ...on('L', { s: 'gem', p: [-6.3, -2.85, 0], d: [3.4, 0.6, 3.4], c: 0xffd860, g: true }),
    ...inkLines('L', -6, 0.02, true),
    // evolution: crimson leather over the covers
    ...on('R', { s: 'rbox', p: [6.3, -0.47, 0], d: [12.7, 0.94, 16.5], c: LEATHER_E, bv: [0.6, 0.3, 0.3], grp: 't4' }),
    ...on('L', { s: 'rbox', p: [-6.3, -2.23, 0], d: [12.7, 0.94, 16.5], c: LEATHER_E, bv: [0.6, 0.3, 0.3], grp: 't4' }),
    // spine
    ...on('book', { s: 'cyl', p: [0, 0.9, 0], d: [2.4, 16.6, 2.6], r: [90, 0, 0], c: 0x2a1e4e, n: 8 }, { s: 'cyl', p: [0, 0.9, 7.6], d: [2.8, 0.8, 2.8], r: [90, 0, 0], c: GOLD, n: 8 }, { s: 'cyl', p: [0, 0.9, -7.6], d: [2.8, 0.8, 2.8], r: [90, 0, 0], c: GOLD, n: 8 }),
    ...pageNodes.map((p, i) => ({ b: p.n, s: 'box', p: [5.8, 0.1, 0], d: [11.2, 0.15, 14.6], c: i % 2 ? 0xfaf2dc : 0xf0e6c8 }) as RigPart),
    ...pageNodes.flatMap((p) => inkLines(p.n, 5.8, 0.2, false)),
    ...on('ribbon', { s: 'box', p: [0, -2.4, 0], d: [0.9, 4.8, 0.2], c: 0xc8283a }),
    ...starNodes.map((s) => ({ b: s.n, s: 'gem', p: [0, 0, 0], d: [1.4, 1.4, 1.4], c: 0xfff0a0, g: true }) as RigPart),
  ],
  halos: [
    { name: 'core', node: 'book', at: [0, 5, 0], size: 22, color: 0xffd870, opacity: 0 },
    { name: 'emblem', node: 'book', at: [0, 4, 0], size: 14, color: 0xb070ff, opacity: 0.3 },
  ],
};

// ------------------------------------------------------------------ Falling star (Starfall Tome meteors)
const starPoints = (b: string, r: number, c: number, grp?: string): RigPart[] =>
  [0, 72, 144, 216, 288].map((a) => ({ b, s: 'gem', p: [Math.sin((a * Math.PI) / 180) * r, Math.cos((a * Math.PI) / 180) * r, 0], d: [2.2, r * 1.3, 1.6], r: [0, 0, -a], c, g: true, grp }) as RigPart);
export const STAR: ModelDef = {
  vox: 0.055,
  nodes: [{ n: 'star', until: 4 }, { n: 'rock', tier: 4 }],
  parts: [
    ...on('star', { s: 'gem', p: [0, 0, 0], d: [4, 4, 2.6], c: 0xffffff, g: true }),
    ...starPoints('star', 3.4, 0xffe070),
    ...starPoints('star', 2.2, 0xfff8d0),
  ],
  custom: [{ node: 'rock', tris: lumpTris(4.4, 0.25, 51, 1), paint: emberCore(51, true) }],
  halos: [
    { name: 'glow', node: 'star', at: [0, 0, 0], size: 26, color: 0xffd860, opacity: 0.9 },
    { name: 'fire', node: 'rock', at: [0, 0, 0], size: 30, color: 0xff7a2a, opacity: 0.9, tier: 4 },
  ],
};

// ------------------------------------------------------------------ Chain Spark: layered energy orb
export const SPARK: ModelDef = {
  vox: 0.04,
  rim: 0.2,
  glassOpacity: 0.18,
  nodes: [{ n: 'core' }, { n: 'ring0', rot: [70, 0, 0] }, { n: 'ring1', rot: [0, 0, 70] }, { n: 'ring2', rot: [35, 45, 0], tier: 2 }, { n: 'ring3', rot: [-40, 20, 60], tier: 4 }, { n: 'shell' }],
  parts: [
    ...on('core', { s: 'gem', p: [0, 0, 0], d: [3.4, 3.4, 3.4], c: 0xffffff, g: true }, { s: 'gem', p: [0, 0, 0], d: [4.2, 2, 2], r: [0, 45, 0], c: 0xbff4ff, g: true }),
    ...on('shell', { s: 'ball', p: [0, 0, 0], d: [9.6, 9.6, 9.6], c: 0x9ae8ff, grp: 'glass' }),
  ],
  custom: [
    { node: 'ring0', tris: torusTris(4.6, 0.32, 20, 3), paint: () => [0x9ae8ff, 1] },
    { node: 'ring1', tris: torusTris(5.2, 0.28, 20, 3), paint: () => [0x7ad8ff, 1] },
    { node: 'ring2', tris: torusTris(5.8, 0.25, 22, 3), paint: () => [0xd8f8ff, 1] },
    { node: 'ring3', tris: torusTris(6.4, 0.25, 22, 3), paint: () => [0xd8b0ff, 1] },
  ],
  halos: [
    { name: 'glow', node: 'core', at: [0, 0, 0], size: 22, color: 0x7ad8ff, opacity: 0.9 },
    { name: 'flash', node: 'core', at: [0, 0, 0], size: 44, color: 0xe8f8ff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Bone Familiar: flying skull with a spine tail
const teeth = (b: string, y: number, z: number, n: number, w: number): RigPart[] =>
  Array.from({ length: n }, (_, i) => ({ b, s: 'box', p: [-w / 2 + (w * (i + 0.5)) / n, y, z], d: [0.75, 1, 0.6], c: 0xf8f4e8 }) as RigPart);
const vert: NodeDef[] = [0, 1, 2, 3].map((i) => ({ n: 'v' + i, parent: i ? 'v' + (i - 1) : 'skull', at: (i ? [0, 0, -2.1] : [0, 1.6, -4.2]) as V3 }));
function familiar(eye: number): ModelDef {
  return {
    vox: 0.05,
    rim: 0.18,
    glassOpacity: 0.5,
    nodes: [
      { n: 'skull' },
      { n: 'jaw', parent: 'skull', at: [0, 1.9, 1.2] },
      ...vert,
      { n: 'horns', parent: 'skull', tier: 2 },
      { n: 'wingL', parent: 'skull', at: [3.6, 4.6, -2.4], tier: 3 },
      { n: 'wingR', parent: 'skull', at: [-3.6, 4.6, -2.4], tier: 3 },
      { n: 'crown', parent: 'skull', tier: 4 },
    ],
    parts: [
      ...on(
        'skull',
        { s: 'ball', p: [0, 5.2, -0.6], d: [8.4, 7.6, 9], c: BONE },
        { s: 'rbox', p: [0, 3.4, 3.4], d: [6.8, 4.4, 2.6], c: BONE, bv: [1.2, 0.6, 0.6] },
        { s: 'rbox', p: [0, 5.6, 3.9], d: [7.6, 1.3, 1.8], c: BONE_D, bv: [0.5, 0.4] },
        { s: 'rbox', p: [1.8, 4.3, 4.45], d: [2.3, 2.1, 0.9], c: INK, flat: true },
        { s: 'rbox', p: [-1.8, 4.3, 4.45], d: [2.3, 2.1, 0.9], c: INK, flat: true },
        { s: 'gem', p: [1.8, 4.3, 4.75], d: [1.2, 1.5, 0.9], c: eye, g: true },
        { s: 'gem', p: [-1.8, 4.3, 4.75], d: [1.2, 1.5, 0.9], c: eye, g: true },
        { s: 'gem', p: [0, 2.9, 4.6], d: [1.2, 1.7, 0.8], c: 0x2a2030, flat: true },
        { s: 'rbox', p: [3.5, 3.1, 2.8], d: [1.4, 1.4, 2.6], c: BONE_D },
        { s: 'rbox', p: [-3.5, 3.1, 2.8], d: [1.4, 1.4, 2.6], c: BONE_D },
        // cracks
        { s: 'box', p: [1.6, 7.6, 2.2], d: [0.25, 1.8, 0.3], r: [20, 0, 25], c: 0x8a8070, flat: true },
      ),
      ...teeth('skull', 1.35, 4.35, 6, 4.6),
      ...on('jaw', { s: 'rbox', p: [0, -0.8, 2.3], d: [5.8, 1.5, 4.6], c: BONE_D, bv: [1, 0.3, 0.3] }),
      ...teeth('jaw', 0.25, 4.2, 5, 4),
      ...vert.flatMap((v, i) => [
        { b: v.n, s: 'rbox', p: [0, 0, -1], d: [2.4 - i * 0.35, 1.5 - i * 0.15, 1.6], c: i % 2 ? BONE_D : BONE } as RigPart,
        { b: v.n, s: 'gem', p: [0, 1, -1], d: [0.5, 1.2, 0.6], c: BONE_D } as RigPart,
      ]),
      ...on('horns', { s: 'cyl', p: [2.9, 8.3, -0.4], d: [1.5, 4, 1.5], t: [0.15, 0.15], r: [-15, 0, -32], c: 0xcfc6ac, n: 6 }, { s: 'cyl', p: [-2.9, 8.3, -0.4], d: [1.5, 4, 1.5], t: [0.15, 0.15], r: [-15, 0, 32], c: 0xcfc6ac, n: 6 }),
      ...(['wingL', 'wingR'] as const).flatMap((w) => {
        const sx = w === 'wingL' ? 1 : -1;
        return [0, 1, 2].map((k) => ({ b: w, s: 'rbox', p: [sx * (2.4 + k * 0.4), 1.4 - k * 1.5, -0.6 - k * 0.6], d: [5, 0.6, 0.6], r: [0, sx * (12 + k * 14), sx * (28 - k * 22)], c: BONE_D }) as RigPart);
      }),
      ...on('crown', { s: 'cyl', p: [0, 8.8, -0.6], d: [6.4, 1.2, 6.8], c: GOLD, n: 10 }),
      ...[0, 72, 144, 216, 288].map((a) => ({ b: 'crown', s: 'cyl', p: [Math.sin((a * Math.PI) / 180) * 2.9, 10.4, Math.cos((a * Math.PI) / 180) * 3.1 - 0.6], d: [1.1, 2.4, 1.1], t: [0.1, 0.1], c: 0xffe070, n: 5 }) as RigPart),
      ...on('crown', { s: 'gem', p: [0, 9, 2.7], d: [1.4, 1.6, 0.8], c: eye, g: true }),
    ],
    custom: (['wingL', 'wingR'] as const).map((w): CustomGeo => {
      const sx = w === 'wingL' ? 1 : -1;
      const tris = wedgeTris(1, 6.4, 50, 150, 0.2, 3);
      // the wedge lies in XY; tilt it back and mirror for the right wing
      for (let i = 0; i < tris.length; i += 3) {
        const x = tris[i];
        const y = tris[i + 1];
        tris[i] = sx * x;
        tris[i + 1] = y * 0.7;
        tris[i + 2] = -Math.abs(x) * 0.35;
      }
      return { node: w, tris, paint: () => [0x5a2a7a, 0], glass: true };
    }),
    halos: [
      { name: 'eyeL', node: 'skull', at: [1.8, 4.3, 5.2], size: 5, color: eye, opacity: 0.9 },
      { name: 'eyeR', node: 'skull', at: [-1.8, 4.3, 5.2], size: 5, color: eye, opacity: 0.9 },
      { name: 'aura', node: 'skull', at: [0, 3, -5], size: 16, color: 0x8a40d0, opacity: 0.3 },
    ],
  };
}
export const FAMILIAR = familiar(0x9dff6a);
export const FAMILIAR_LORD = familiar(0x9a8aff);

/** Target posts for the viewer's attack and hit demos. */
export const DUMMY: ModelDef = {
  vox: 0.06,
  nodes: [{ n: 'post' }, { n: 'head', parent: 'post', at: [0, 15, 0] }],
  parts: [
    ...on('post', { s: 'cyl', p: [0, 0.6, 0], d: [7, 1.2, 7], c: 0x4a4e5a, n: 10 }, { s: 'cyl', p: [0, 6.5, 0], d: [1.6, 11, 1.6], c: 0x7a5a3a, n: 6 }, { s: 'rbox', p: [0, 9.5, 0], d: [7, 1.2, 1.2], c: 0x7a5a3a }),
    ...on('head', { s: 'rbox', p: [0, 0, 0], d: [5, 5.6, 4.4], c: 0xc8a878, bv: [1.4, 1, 1] }, { s: 'rbox', p: [0, 0.2, 2.25], d: [2.6, 2.6, 0.3], c: 0xc83a3a, flat: true }, { s: 'rbox', p: [0, 0.2, 2.4], d: [1, 1, 0.3], c: 0xf0e0c0, flat: true }),
  ],
};

export const MODELS: Record<string, ModelDef> = {
  ember: EMBER,
  flask: FLASK,
  puddle: PUDDLE,
  fan: FAN,
  cyclone: CYCLONE,
  rod: ROD,
  stormcloud: STORMCLOUD,
  tome: TOME,
  star: STAR,
  spark: SPARK,
  familiar: FAMILIAR,
  familiar_lord: FAMILIAR_LORD,
  dummy: DUMMY,
};
