import type { RigPart, V3 } from '../rig/shapes';
import { lumpTris, noise3, torusTris, wedgeTris, type ModelDef } from './build';

/**
 * Models for the rest of the arsenal (v2.4): thrown and shot projectiles, summoned spirits, bombs,
 * rune mines and the spectral weapons that appear when a melee or aura weapon strikes. Same
 * conventions as models.ts: forward +Z, up +Y, sizes in voxels; tiers 1 base, 2 middle, 3 max,
 * 4 evolution (parts with grp 't3' appear from tier 3, 'u4' hide at the evolution).
 */

type P = Omit<RigPart, 'b'>;
const on = (b: string, ...ps: P[]): RigPart[] => ps.map((p) => ({ b, ...p }) as RigPart);
const ring = (n: number, f: (a: number, i: number) => P): P[] => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));

const GOLD = 0xe8c050;
const GOLD_D = 0xb88a2a;
const STEEL = 0xc8d2e0;
const STEEL_D = 0x7a8698;
const IRON = 0x3a3e48;
const LEATHER = 0x5a3626;

// ------------------------------------------------------------------ Twin Daggers / Thousand Edges
export const DAGGER: ModelDef = {
  vox: 0.04,
  rim: 0.45,
  glassOpacity: 0.35,
  nodes: [{ n: 'dagger' }, { n: 'ghostL', parent: 'dagger', at: [3.2, 0, -1], rot: [0, 0, 0], tier: 4 }, { n: 'ghostR', parent: 'dagger', at: [-3.2, 0, -1], tier: 4 }],
  parts: [
    ...on(
      'dagger',
      // blade: a long tapered wedge pointing forward, with a fuller and bright edges
      { s: 'box', p: [0, 0, 6.6], d: [2.6, 11, 0.5], t: [0.08, 1], r: [90, 0, 0], c: STEEL },
      { s: 'box', p: [0, 0.3, 5.6], d: [0.6, 7.5, 0.2], t: [0.3, 1], r: [90, 0, 0], c: 0x8a9ab8, flat: true },
      { s: 'box', p: [1.05, 0, 5.4], d: [0.25, 8.6, 0.55], t: [0.3, 1], r: [90, 0, -6.5], c: 0xf4f8ff, flat: true },
      { s: 'box', p: [-1.05, 0, 5.4], d: [0.25, 8.6, 0.55], t: [0.3, 1], r: [90, 0, 6.5], c: 0xf4f8ff, flat: true },
      // runes etched along the blade (middle tiers), glowing edge (max)
      { s: 'box', p: [0, 0.32, 4.2], d: [0.5, 0.2, 0.9], c: 0x8ad8ff, g: true, flat: true, grp: 't2' },
      { s: 'box', p: [0, 0.32, 6.0], d: [0.45, 0.2, 0.8], c: 0x8ad8ff, g: true, flat: true, grp: 't2' },
      { s: 'box', p: [0, 0.32, 7.6], d: [0.35, 0.2, 0.7], c: 0x8ad8ff, g: true, flat: true, grp: 't2' },
      { s: 'box', p: [1.2, 0, 5.2], d: [0.2, 8.4, 0.3], t: [0.3, 1], r: [90, 0, -6.5], c: 0xbfe8ff, g: true, flat: true, grp: 't3' },
      { s: 'box', p: [-1.2, 0, 5.2], d: [0.2, 8.4, 0.3], t: [0.3, 1], r: [90, 0, 6.5], c: 0xbfe8ff, g: true, flat: true, grp: 't3' },
      // crossguard with curled ends
      { s: 'rbox', p: [0, 0, 0.8], d: [5.4, 1, 1.1], c: GOLD, bv: [0.3, 0.3, 0.3] },
      { s: 'gem', p: [2.9, 0, 1.2], d: [1, 1, 1], c: GOLD_D },
      { s: 'gem', p: [-2.9, 0, 1.2], d: [1, 1, 1], c: GOLD_D },
      { s: 'gem', p: [0, 0.6, 0.8], d: [0.9, 0.9, 0.9], c: 0x8ad8ff, g: true },
      // leather grip and pommel
      { s: 'cyl', p: [0, 0, -1.5], d: [1.1, 3.4, 1.1], r: [90, 0, 0], c: LEATHER, n: 8 },
      { s: 'cyl', p: [0, 0, -0.6], d: [1.3, 0.4, 1.3], r: [90, 0, 0], c: 0x7a4a32, n: 8 },
      { s: 'cyl', p: [0, 0, -2.3], d: [1.3, 0.4, 1.3], r: [90, 0, 0], c: 0x7a4a32, n: 8 },
      { s: 'gem', p: [0, 0, -3.8], d: [1.6, 1.6, 1.8], c: GOLD },
    ),
    // evolution: two spectral blades flank the dagger
    ...['ghostL', 'ghostR'].flatMap((n) => on(n, { s: 'box', p: [0, 0, 4], d: [1.8, 8, 0.35], t: [0.08, 1], r: [90, 0, 0], c: 0xbfe0ff, grp: 'glass' }, { s: 'gem', p: [0, 0, -0.4], d: [0.8, 0.8, 0.8], c: 0xbfe0ff, g: true })),
  ],
  halos: [
    { name: 'glow', node: 'dagger', at: [0, 0, 5], size: 9, color: 0xbfe0ff, opacity: 0.25 },
    { name: 'flash', node: 'dagger', at: [0, 0, 9], size: 26, color: 0xffffff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Arcane Staff / Archmage Scepter: a caged arcane orb
export const ARCANE: ModelDef = {
  vox: 0.04,
  rim: 0.3,
  glassOpacity: 0.22,
  nodes: [{ n: 'core' }, { n: 'shell' }, { n: 'ringA', rot: [65, 0, 0] }, { n: 'ringB', rot: [-30, 0, 60], tier: 2 }, { n: 'runes', tier: 3 }, { n: 'r0', parent: 'runes', at: [6.2, 0, 0] }, { n: 'r1', parent: 'runes', at: [-3.1, 0, 5.4] }, { n: 'r2', parent: 'runes', at: [-3.1, 0, -5.4] }, { n: 'crown', tier: 4 }],
  parts: [
    ...on('core', { s: 'gem', p: [0, 0, 0], d: [3.4, 3.4, 3.4], c: 0xffffff, g: true }, { s: 'gem', p: [0, 0, 0], d: [4.6, 1.6, 1.6], r: [0, 0, 45], c: 0xe0c8ff, g: true }, { s: 'gem', p: [0, 0, 0], d: [1.6, 4.6, 1.6], r: [45, 0, 0], c: 0xd0b0ff, g: true }),
    ...on('shell', { s: 'ball', p: [0, 0, 0], d: [8.4, 8.4, 8.4], c: 0xb98cff, grp: 'glass' }),
    ...['r0', 'r1', 'r2'].flatMap((n) => on(n, { s: 'rbox', p: [0, 0, 0], d: [1.2, 1.8, 0.4], c: 0xd8b8ff, g: true, bv: [0.2, 0.2, 0.2] })),
    ...ring(6, (a) => ({ s: 'gem', p: [Math.sin(a) * 4.6, 3.6, Math.cos(a) * 4.6], d: [0.8, 2, 0.8], c: 0xffe8a0, g: true })).map((p) => ({ b: 'crown', ...p }) as RigPart),
  ],
  custom: [
    { node: 'ringA', tris: torusTris(5.4, 0.35, 22, 3), paint: (cx) => [cx > 0 ? 0xd8b8ff : 0xb98cff, 1] },
    { node: 'ringB', tris: torusTris(6.2, 0.3, 22, 3), paint: () => [0x9a7aff, 1] },
    { node: 'crown', tris: torusTris(4.6, 0.4, 18, 3, [0, 2.6, 0]), paint: () => [GOLD, 0] },
  ],
  halos: [
    { name: 'glow', node: 'core', at: [0, 0, 0], size: 22, color: 0xb98cff, opacity: 0.85 },
    { name: 'flash', node: 'core', at: [0, 0, 0], size: 40, color: 0xe8d8ff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Frost Shards / Absolute Zero: a jagged icicle cluster
export const ICESHARD: ModelDef = {
  vox: 0.04,
  rim: 0.6,
  glassOpacity: 0.45,
  nodes: [{ n: 'shard' }, { n: 'frost', tier: 3 }, { n: 'halo', tier: 4 }],
  parts: [
    ...on(
      'shard',
      { s: 'gem', p: [0, 0, 2.5], d: [2.6, 2.6, 12], c: 0xdff8ff, grp: 'glass' },
      { s: 'gem', p: [0, 0, 2.5], d: [1.2, 1.2, 9], c: 0xbff0ff, g: true },
      { s: 'gem', p: [1.4, 0.6, -0.6], d: [1.3, 1.3, 5.4], r: [0, 22, 10], c: 0xc8f0ff, grp: 'glass' },
      { s: 'gem', p: [-1.3, -0.5, -0.2], d: [1.2, 1.2, 5], r: [0, -24, -8], c: 0xc8f0ff, grp: 'glass' },
      { s: 'gem', p: [0.2, 1.4, -1.2], d: [1, 1, 4.2], r: [-26, 0, 0], c: 0xe8fbff, grp: 'glass' },
      { s: 'gem', p: [0, 0, 7.8], d: [0.8, 0.8, 2], c: 0xffffff, g: true },
    ),
    ...on('frost', ...ring(5, (a) => ({ s: 'gem', p: [Math.sin(a) * 2, Math.cos(a) * 2, -2.6], d: [0.6, 0.6, 2.4], r: [Math.cos(a) * 30, -Math.sin(a) * 30, 0], c: 0xffffff, g: true }))),
  ],
  custom: [{ node: 'halo', tris: torusTris(4, 0.3, 18, 3, [0, 0, -1], [90, 0, 0]), paint: () => [0x9af0ff, 1] }],
  halos: [
    { name: 'glow', node: 'shard', at: [0, 0, 2], size: 18, color: 0x8fe9ff, opacity: 0.55 },
    { name: 'flash', node: 'shard', at: [0, 0, 6], size: 34, color: 0xe8fbff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Longbow / Skypiercer: a fletched broadhead arrow
export const ARROW: ModelDef = {
  vox: 0.04,
  rim: 0.35,
  nodes: [{ n: 'arrow' }, { n: 'wind', tier: 4 }],
  parts: [
    ...on(
      'arrow',
      { s: 'cyl', p: [0, 0, 0], d: [0.7, 17, 0.7], r: [90, 0, 0], c: 0xb88a5a, n: 6 },
      { s: 'cyl', p: [0, 0, 6.6], d: [0.95, 1.2, 0.95], r: [90, 0, 0], c: 0x5a3a2a, n: 6 },
      // broadhead
      { s: 'box', p: [0, 0, 9.4], d: [2.6, 4, 0.45], t: [0.05, 1], r: [90, 0, 0], c: STEEL },
      { s: 'box', p: [0, 0, 9.4], d: [0.45, 4, 2.6], t: [1, 0.05], r: [90, 0, 0], c: STEEL_D },
      { s: 'box', p: [0, 0, 9.6], d: [1.2, 3.2, 0.5], t: [0.05, 1], r: [90, 0, 0], c: 0xffd890, g: true, grp: 't3' },
      // fletching: three vanes and a nock
      ...[0, 120, 240].map((a): P => ({ s: 'box', p: [Math.sin((a * Math.PI) / 180) * 0.8, Math.cos((a * Math.PI) / 180) * 0.8, -6.4], d: [0.2, 1.6, 4], t: [1, 0.5], r: [0, 0, -a], c: a === 0 ? 0xd84a3a : 0xf0e8d8 })),
      { s: 'cyl', p: [0, 0, -8.6], d: [0.9, 0.8, 0.9], r: [90, 0, 0], c: 0x3a2a20, n: 6 },
      { s: 'cyl', p: [0, 0, -3.6], d: [0.9, 0.5, 0.9], r: [90, 0, 0], c: GOLD, n: 6, grp: 't2' },
    ),
  ],
  custom: [0, 1, 2].map((i) => ({ node: 'wind', tris: torusTris(1.8 + i * 0.4, 0.18, 14, 3, [0, 0, 4 - i * 4], [90, 0, 0]), paint: (): [number, number] => [0xc8f5ff, 1] })),
  halos: [
    { name: 'glow', node: 'arrow', at: [0, 0, 9], size: 7, color: 0xffe0a0, opacity: 0.3 },
    { name: 'flash', node: 'arrow', at: [0, 0, 10], size: 26, color: 0xffffff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Bolt Thrower / Siege Engine: an iron siege bolt
export const HEAVYBOLT: ModelDef = {
  vox: 0.045,
  rim: 0.3,
  nodes: [{ n: 'bolt' }, { n: 'fins', parent: 'bolt', at: [0, 0, -5.5] }, { n: 'flame', tier: 4 }],
  parts: [
    ...on(
      'bolt',
      { s: 'cyl', p: [0, 0, 0], d: [1.6, 14, 1.6], r: [90, 0, 0], c: 0x6a4a32, n: 8 },
      { s: 'cyl', p: [0, 0, 3.6], d: [2, 1, 2], r: [90, 0, 0], c: IRON, n: 8 },
      { s: 'cyl', p: [0, 0, -1], d: [2, 1, 2], r: [90, 0, 0], c: IRON, n: 8 },
      // heavy square head
      { s: 'box', p: [0, 0, 8.4], d: [3.2, 4.4, 3.2], t: [0.05, 0.05], r: [90, 0, 0], c: 0x8a92a0 },
      { s: 'rbox', p: [0, 0, 6.2], d: [2.4, 1, 2.4], c: IRON, bv: [0.3, 0.3, 0.3] },
      { s: 'box', p: [0, 0, 8.6], d: [1.4, 3.2, 1.4], t: [0.05, 0.05], r: [90, 0, 0], c: 0xffa040, g: true, grp: 't3' },
      // rivets
      ...ring(4, (a) => ({ s: 'gem', p: [Math.sin(a) * 1.05, Math.cos(a) * 1.05, 3.6], d: [0.5, 0.5, 0.5], c: GOLD })),
    ),
    ...on('fins', ...[45, 135, 225, 315].map((a): P => ({ s: 'box', p: [Math.sin((a * Math.PI) / 180) * 1.5, Math.cos((a * Math.PI) / 180) * 1.5, 0], d: [0.3, 2.4, 4], t: [1, 0.4], r: [0, 0, -a], c: 0x9aa2b0 }))),
  ],
  custom: [{ node: 'flame', tris: lumpTris(2, 0.4, 41, 1, [0, 0, -8]), paint: () => [0xff8a2a, 1] }],
  halos: [
    { name: 'glow', node: 'bolt', at: [0, 0, 8], size: 10, color: 0xffb060, opacity: 0.25 },
    { name: 'flash', node: 'bolt', at: [0, 0, 10], size: 34, color: 0xffe0b0, opacity: 0 },
    { name: 'fire', node: 'flame', at: [0, 0, -8], size: 18, color: 0xff7a2a, opacity: 0.6, tier: 4 },
  ],
};

// ------------------------------------------------------------------ Moon Glaive / Eclipse Glaive: a crescent blade ring
export const GLAIVE: ModelDef = {
  vox: 0.045,
  rim: 0.5,
  glassOpacity: 0.35,
  nodes: [{ n: 'glaive' }, { n: 'eclipse', tier: 4 }],
  parts: [
    ...on(
      'glaive',
      { s: 'cyl', p: [0, 0, 0], d: [3.4, 1.2, 3.4], c: GOLD, n: 10 },
      { s: 'gem', p: [0, 0.6, 0], d: [1.8, 1.4, 1.8], c: 0xd8e8ff, g: true },
      // spokes from the hub to the rim
      ...ring(3, (a) => ({ s: 'rbox', p: [Math.sin(a) * 4, 0, Math.cos(a) * 4], d: [0.9, 0.7, 5], r: [0, (a * 180) / Math.PI, 0], c: 0x9aa8c0, bv: [0.2, 0.2, 0.2] })),
    ),
    ...on('eclipse', { s: 'cyl', p: [0, 0.2, 0], d: [5.6, 0.6, 5.6], c: 0x1a1430, n: 16 }),
  ],
  custom: [
    // three crescent blades around the rim, each a curved wedge with a bright edge
    ...[0, 120, 240].flatMap((a) => [
      { node: 'glaive', tris: wedgeTris(5.6, 8.6, a, a + 95, 0.7, 8).map((v, i) => (i % 3 === 1 ? v : v)), paint: (): [number, number] => [0xd8e2f0, 0] },
      { node: 'glaive', tris: wedgeTris(8.2, 9.2, a + 4, a + 92, 0.4, 8), paint: (): [number, number] => [0xf4f8ff, 1] },
    ]).map((c) => ({ ...c, tris: rotXZ(c.tris) })),
    { node: 'glaive', tris: torusTris(5.4, 0.45, 26, 3), paint: () => [0x9aa8c0, 0] },
    { node: 'eclipse', tris: torusTris(3.4, 0.5, 22, 3, [0, 0.4, 0]), paint: () => [0xffd860, 1] },
  ],
  halos: [
    { name: 'glow', node: 'glaive', at: [0, 0, 0], size: 30, color: 0xe8f0ff, opacity: 0.25 },
    { name: 'corona', node: 'eclipse', at: [0, 0.5, 0], size: 26, color: 0xffc860, opacity: 0.55, tier: 4 },
    { name: 'flash', node: 'glaive', at: [0, 0, 0], size: 40, color: 0xffffff, opacity: 0 },
  ],
};
/** Turns XY-plane triangles (wedges are authored upright) to lie flat in XZ. */
function rotXZ(t: number[]): number[] {
  const o = t.slice();
  for (let i = 0; i < o.length; i += 3) {
    const y = o[i + 1];
    const z = o[i + 2];
    o[i + 1] = -z;
    o[i + 2] = y;
  }
  return o;
}

// ------------------------------------------------------------------ Whirling Saws / Maelstrom Saws: a toothed saw disc
export const SAW: ModelDef = {
  vox: 0.045,
  rim: 0.45,
  nodes: [{ n: 'saw' }, { n: 'saw2', tier: 4, rot: [0, 15, 0] }],
  parts: [
    ...on(
      'saw',
      { s: 'cyl', p: [0, 0, 0], d: [12, 0.6, 12], c: STEEL, n: 18 },
      { s: 'cyl', p: [0, 0.2, 0], d: [9, 0.4, 9], c: 0xa8b4c4, n: 18 },
      { s: 'cyl', p: [0, 0.5, 0], d: [3.6, 1.2, 3.6], c: GOLD, n: 10 },
      { s: 'cyl', p: [0, 0.9, 0], d: [1.6, 0.8, 1.6], c: IRON, n: 6 },
      // teeth
      ...ring(16, (a) => ({ s: 'box', p: [Math.sin(a) * 6.4, 0, Math.cos(a) * 6.4], d: [1.6, 0.5, 1.6], t: [0.1, 1], r: [90, (a * 180) / Math.PI + 20, 0], c: 0xe8eef8 })),
      // cut-outs and bolts
      ...ring(4, (a) => ({ s: 'cyl', p: [Math.sin(a) * 3, 0.35, Math.cos(a) * 3], d: [1.4, 0.5, 1.4], c: 0x5a6272, n: 6 })),
      ...ring(6, (a) => ({ s: 'gem', p: [Math.sin(a) * 1.4, 1.1, Math.cos(a) * 1.4], d: [0.45, 0.45, 0.45], c: GOLD_D })),
      // glowing rim (max)
      ...ring(16, (a) => ({ s: 'box', p: [Math.sin(a) * 6.5, 0, Math.cos(a) * 6.5], d: [0.6, 0.6, 0.6], c: 0xffe0a0, g: true, grp: 't3' })),
    ),
    ...on('saw2', { s: 'cyl', p: [0, -0.8, 0], d: [10, 0.4, 10], c: 0xa83a3a, n: 16 }, ...ring(12, (a) => ({ s: 'box', p: [Math.sin(a) * 5.4, -0.8, Math.cos(a) * 5.4], d: [1.4, 0.4, 1.4], t: [0.1, 1], r: [90, (a * 180) / Math.PI - 20, 0], c: 0xff6a5a }))),
  ],
  halos: [
    { name: 'glow', node: 'saw', at: [0, 0, 0], size: 18, color: 0xd0d6e0, opacity: 0.15 },
    { name: 'flash', node: 'saw', at: [0, 0, 0], size: 30, color: 0xfff0c0, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Guardian Wisps / Spirit Choir: a little spirit flame
export const WISP: ModelDef = {
  vox: 0.04,
  rim: 0.2,
  glassOpacity: 0.4,
  nodes: [{ n: 'body' }, { n: 'flame', parent: 'body' }, { n: 'tail', parent: 'body', at: [0, -1, -3] }, { n: 'halo', parent: 'body', at: [0, 6.5, 0], tier: 4 }, { n: 'motes', parent: 'body', tier: 2 }],
  parts: [
    ...on('body', { s: 'ball', p: [0, 0, 0], d: [6, 6.4, 6], c: 0x9dffd6, grp: 'glass' }, { s: 'ball', p: [0, 0, 0], d: [3.8, 4, 3.8], c: 0xe8fff4, g: true }, { s: 'box', p: [1.2, 0.6, 2.7], d: [0.9, 1.4, 0.4], c: 0x103828, flat: true }, { s: 'box', p: [-1.2, 0.6, 2.7], d: [0.9, 1.4, 0.4], c: 0x103828, flat: true }),
    ...on('flame', { s: 'gem', p: [0, 3.6, -0.4], d: [2.4, 4.4, 2.4], c: 0x9dffd6, g: true }, { s: 'gem', p: [1.4, 2.6, -0.6], d: [1.2, 2.6, 1.2], r: [0, 0, -25], c: 0x7af0c0, g: true }, { s: 'gem', p: [-1.4, 2.6, -0.6], d: [1.2, 2.6, 1.2], r: [0, 0, 25], c: 0x7af0c0, g: true }),
    ...on('tail', { s: 'gem', p: [0, 0, 0], d: [2, 1.6, 4], c: 0x7af0c0, grp: 'glass' }, { s: 'gem', p: [0, -0.3, -2.6], d: [1, 0.9, 2.4], c: 0x5ad8a8, grp: 'glass' }),
    ...on('motes', ...ring(3, (a) => ({ s: 'gem', p: [Math.sin(a) * 5, 0, Math.cos(a) * 5], d: [0.8, 0.8, 0.8], c: 0xe8fff4, g: true }))),
  ],
  custom: [{ node: 'halo', tris: torusTris(2.6, 0.35, 16, 3), paint: () => [0xfff0a0, 1] }],
  halos: [
    { name: 'glow', node: 'body', at: [0, 0, 0], size: 24, color: 0x9dffd6, opacity: 0.7 },
    { name: 'flash', node: 'body', at: [0, 0, 2], size: 30, color: 0xe8fff4, opacity: 0 },
  ],
};

/** Guardian Wisp's shot: a small bright spirit spark. */
export const WISPSHOT: ModelDef = {
  vox: 0.04,
  rim: 0.2,
  nodes: [{ n: 'core' }],
  parts: on('core', { s: 'gem', p: [0, 0, 0], d: [2, 2, 3.6], c: 0xe8fff4, g: true }, { s: 'gem', p: [0, 0, -1.2], d: [1.2, 1.2, 3], c: 0x9dffd6, g: true }),
  halos: [
    { name: 'glow', node: 'core', at: [0, 0, 0], size: 14, color: 0x9dffd6, opacity: 0.8 },
    { name: 'flash', node: 'core', at: [0, 0, 0], size: 22, color: 0xffffff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Powder Keg / Cluster Barrage: an iron bomb with a lit fuse
export const BOMB: ModelDef = {
  vox: 0.045,
  rim: 0.3,
  nodes: [{ n: 'bomb' }, { n: 'fuse', parent: 'bomb', at: [0, 5.6, 0] }, { n: 'spark', parent: 'fuse', at: [0.9, 2.6, 0] }],
  parts: [
    ...on(
      'bomb',
      { s: 'ball', p: [0, 0, 0], d: [10, 10, 10], c: 0x2e3038 },
      { s: 'cyl', p: [0, 4.6, 0], d: [3.4, 1.4, 3.4], c: 0x6a6e78, n: 10 },
      { s: 'cyl', p: [0, 5.3, 0], d: [2.4, 0.6, 2.4], c: 0x8a8e98, n: 10 },
      // riveted band and a painted mark
      ...ring(10, (a) => ({ s: 'gem', p: [Math.sin(a) * 5.1, 0, Math.cos(a) * 5.1], d: [0.7, 0.7, 0.7], c: 0x8a8e98 })),
      { s: 'box', p: [0, 1.4, 4.9], d: [2.4, 2.4, 0.3], r: [-15, 0, 45], c: 0xe8d8a0, flat: true, grp: 't2' },
      { s: 'box', p: [0, 1.4, 4.95], d: [1.2, 1.2, 0.3], r: [-15, 0, 45], c: 0xd84a3a, flat: true, grp: 't3' },
      // evolution: red cluster-bomb stripes
      { s: 'box', p: [0, 2.6, 4.2], d: [7.6, 0.8, 0.4], r: [-30, 0, 0], c: 0xff5a3a, flat: true, grp: 't4' },
      { s: 'box', p: [0, -2.6, 4.2], d: [7.6, 0.8, 0.4], r: [30, 0, 0], c: 0xff5a3a, flat: true, grp: 't4' },
    ),
    ...on('fuse', { s: 'cyl', p: [0, 0.8, 0], d: [0.6, 1.8, 0.6], c: 0xc8a878, n: 5 }, { s: 'cyl', p: [0.5, 2, 0], d: [0.55, 1.4, 0.55], r: [0, 0, -35], c: 0xb89868, n: 5 }),
    ...on('spark', { s: 'gem', p: [0, 0, 0], d: [1.3, 1.3, 1.3], c: 0xffe070, g: true }),
  ],
  halos: [
    { name: 'spark', node: 'spark', at: [0, 0, 0], size: 12, color: 0xffb040, opacity: 0.9 },
    { name: 'flash', node: 'bomb', at: [0, 0, 0], size: 80, color: 0xffd8a0, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Rune Traps / Minefield: a carved rune mine
export const MINE: ModelDef = {
  vox: 0.05,
  rim: 0.25,
  nodes: [{ n: 'mine' }, { n: 'rune', parent: 'mine', at: [0, 1.2, 0] }, { n: 'spikes', parent: 'mine' }, { n: 'ring', parent: 'mine', tier: 3 }],
  parts: [
    ...on(
      'mine',
      { s: 'cyl', p: [0, 0.3, 0], d: [9, 1.2, 9], c: 0x5a5868, n: 12 },
      { s: 'cyl', p: [0, 0.9, 0], d: [7.4, 0.6, 7.4], c: 0x6e6c7e, n: 12 },
      { s: 'cyl', p: [0, 1.2, 0], d: [4.4, 0.4, 4.4], c: 0x2a2632, n: 12 },
    ),
    // the rune: a glowing star-glyph that blinks when armed
    ...on('rune', { s: 'box', p: [0, 0.2, 0], d: [0.6, 0.3, 3.6], c: 0xff5470, g: true, flat: true }, { s: 'box', p: [0, 0.2, 0], d: [0.6, 0.3, 3.6], r: [0, 60, 0], c: 0xff5470, g: true, flat: true }, { s: 'box', p: [0, 0.2, 0], d: [0.6, 0.3, 3.6], r: [0, -60, 0], c: 0xff5470, g: true, flat: true }, { s: 'gem', p: [0, 0.6, 0], d: [1.2, 1, 1.2], c: 0xffc0c8, g: true }),
    ...on('spikes', ...ring(6, (a) => ({ s: 'cyl', p: [Math.sin(a) * 4.2, 1.4, Math.cos(a) * 4.2], d: [0.9, 2.2, 0.9], t: [0.1, 0.1], c: 0x9aa0b0, n: 5 })), ...ring(6, (a) => ({ s: 'gem', p: [Math.sin(a + 0.52) * 3.2, 1.3, Math.cos(a + 0.52) * 3.2], d: [0.5, 0.4, 0.5], c: 0xff8a9a, g: true }))),
  ],
  custom: [
    { node: 'mine', tris: torusTris(3.2, 0.25, 22, 3, [0, 1.35, 0]), paint: () => [0xff5470, 1] },
    { node: 'ring', tris: torusTris(5.6, 0.3, 26, 3, [0, 0.4, 0]), paint: () => [0xff8a9a, 1] },
  ],
  halos: [
    { name: 'glow', node: 'rune', at: [0, 1, 0], size: 16, color: 0xff5470, opacity: 0.5 },
    { name: 'flash', node: 'mine', at: [0, 2, 0], size: 70, color: 0xffb0b8, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Rune Blade / Soulreaver: a spectral longsword
export const RUNEBLADE: ModelDef = {
  vox: 0.05,
  rim: 0.55,
  glassOpacity: 0.35,
  nodes: [{ n: 'sword' }, { n: 'soul', parent: 'sword', tier: 4 }, { n: 'tip', parent: 'sword', at: [0, 0, 19] }],
  parts: [
    ...on(
      'sword',
      { s: 'box', p: [0, 0, 11], d: [2.6, 19, 0.6], t: [0.12, 1], r: [90, 0, 0], c: 0xd8e8f8 },
      { s: 'box', p: [0, 0.35, 9.6], d: [0.7, 14, 0.2], t: [0.3, 1], r: [90, 0, 0], c: 0x8aa8c8, flat: true },
      ...[4.5, 7.2, 9.9, 12.6].map((z, i): P => ({ s: 'box', p: [0, 0.4, z], d: [0.9 - i * 0.1, 0.2, 1.1], c: 0x8ad8ff, g: true, flat: true, grp: i < 2 ? '' : 't2' })),
      { s: 'box', p: [1.15, 0, 9], d: [0.25, 15, 0.5], t: [0.3, 1], r: [90, 0, -4.2], c: 0x9fd8ff, g: true, flat: true, grp: 't3' },
      { s: 'box', p: [-1.15, 0, 9], d: [0.25, 15, 0.5], t: [0.3, 1], r: [90, 0, 4.2], c: 0x9fd8ff, g: true, flat: true, grp: 't3' },
      { s: 'rbox', p: [0, 0, 1.2], d: [7, 1.2, 1.4], c: GOLD, bv: [0.4, 0.3, 0.3] },
      { s: 'gem', p: [3.8, 0, 1.6], d: [1.4, 1.4, 1.4], c: GOLD_D },
      { s: 'gem', p: [-3.8, 0, 1.6], d: [1.4, 1.4, 1.4], c: GOLD_D },
      { s: 'gem', p: [0, 0.8, 1.2], d: [1.3, 1.3, 1.3], c: 0x8ad8ff, g: true },
      { s: 'cyl', p: [0, 0, -1.8], d: [1.3, 4.6, 1.3], r: [90, 0, 0], c: LEATHER, n: 8 },
      { s: 'gem', p: [0, 0, -4.6], d: [2, 2, 2.2], c: GOLD },
    ),
    ...on('soul', { s: 'box', p: [0, 0, 11], d: [4.6, 20, 0.4], t: [0.1, 1], r: [90, 0, 0], c: 0x9a6aff, grp: 'glass' }, { s: 'ball', p: [0, 0, -4.6], d: [2.8, 2.8, 2.8], c: 0xd8c8ff, g: true }),
  ],
  halos: [
    { name: 'glow', node: 'sword', at: [0, 0, 10], size: 26, color: 0x9fd8ff, opacity: 0.25 },
    { name: 'flash', node: 'sword', at: [0, 0, 14], size: 40, color: 0xffffff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Spirit Fists / Hundred Palms: a spirit gauntlet
export const FIST: ModelDef = {
  vox: 0.05,
  rim: 0.6,
  glassOpacity: 0.45,
  nodes: [{ n: 'fist' }, { n: 'cuff', parent: 'fist' }, { n: 'aura', parent: 'fist', tier: 3 }],
  parts: [
    ...on(
      'fist',
      // palm and knuckles (curled fingers face forward)
      { s: 'rbox', p: [0, 0, 1], d: [5.2, 4.2, 4], c: 0xffc66b, bv: [1, 0.8, 0.8], grp: 'glass' },
      ...[-1.9, -0.65, 0.65, 1.9].map((x): P => ({ s: 'rbox', p: [x, 0.9, 3.4], d: [1.2, 1.6, 1.8], c: 0xffd890, bv: [0.4, 0.4, 0.4], grp: 'glass' })),
      ...[-1.9, -0.65, 0.65, 1.9].map((x): P => ({ s: 'rbox', p: [x, -0.4, 3.6], d: [1.1, 1.4, 1.2], c: 0xffd890, bv: [0.3, 0.3, 0.3], grp: 'glass' })),
      { s: 'rbox', p: [2.9, -0.6, 1.8], d: [1.2, 1.4, 2.6], r: [0, -25, 0], c: 0xffd890, bv: [0.3, 0.3, 0.3], grp: 'glass' },
      { s: 'gem', p: [0, 0.4, 1], d: [2, 2, 2], c: 0xfff0c0, g: true },
    ),
    ...on('cuff', { s: 'cyl', p: [0, 0, -2], d: [4.8, 2.4, 4.8], r: [90, 0, 0], c: GOLD, n: 10 }, { s: 'cyl', p: [0, 0, -3.4], d: [4.2, 0.8, 4.2], r: [90, 0, 0], c: GOLD_D, n: 10 }, { s: 'gem', p: [0, 2.3, -2], d: [1.2, 1.2, 1.2], c: 0xff5a3a, g: true }),
  ],
  custom: [{ node: 'aura', tris: torusTris(3.8, 0.3, 18, 3, [0, 0, 0.4], [90, 0, 0]), paint: () => [0xffe0a0, 1] }],
  halos: [
    { name: 'glow', node: 'fist', at: [0, 0, 1], size: 20, color: 0xffc66b, opacity: 0.5 },
    { name: 'flash', node: 'fist', at: [0, 0, 4], size: 36, color: 0xfff0c0, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Sky Lance / Dragon Lance: a winged spear
export const LANCE: ModelDef = {
  vox: 0.05,
  rim: 0.45,
  nodes: [{ n: 'lance' }, { n: 'tassel', parent: 'lance', at: [0, -0.8, 8] }, { n: 'dragon', parent: 'lance', tier: 4 }, { n: 'tip', parent: 'lance', at: [0, 0, 19] }],
  parts: [
    ...on(
      'lance',
      { s: 'cyl', p: [0, 0, -2], d: [1, 26, 1], r: [90, 0, 0], c: 0xd9e6ff, n: 8 },
      { s: 'cyl', p: [0, 0, -14.6], d: [1.6, 1.4, 1.6], r: [90, 0, 0], c: GOLD, n: 8 },
      ...[-6, -3, 0, 3].map((z): P => ({ s: 'cyl', p: [0, 0, z], d: [1.3, 0.6, 1.3], r: [90, 0, 0], c: 0x5a6a9a, n: 8 })),
      { s: 'cyl', p: [0, 0, 11], d: [1.8, 1.6, 1.8], r: [90, 0, 0], c: GOLD, n: 8 },
      // leaf blade and side wings
      { s: 'box', p: [0, 0, 15.6], d: [3.2, 8, 0.7], t: [0.06, 1], r: [90, 0, 0], c: 0xe8f0ff },
      { s: 'box', p: [0, 0, 15.2], d: [0.7, 6, 0.3], t: [0.2, 1], r: [90, 0, 0], c: 0xa8c0f0, g: true, flat: true, grp: 't2' },
      { s: 'box', p: [2.2, 0, 12], d: [2.4, 0.5, 1.4], r: [0, -35, 0], c: GOLD_D },
      { s: 'box', p: [-2.2, 0, 12], d: [2.4, 0.5, 1.4], r: [0, 35, 0], c: GOLD_D },
      { s: 'box', p: [0, 0, 15.8], d: [1.8, 7, 0.5], t: [0.06, 1], r: [90, 0, 0], c: 0xbfe0ff, g: true, grp: 't3' },
    ),
    ...on('tassel', { s: 'box', p: [0, -1.4, 0], d: [0.8, 2.8, 0.8], c: 0xd84a3a }, { s: 'box', p: [0, -2.9, 0], d: [1.2, 0.8, 1.2], c: 0xe85a4a }),
    // evolution: a dragon head grips the blade
    ...on('dragon', { s: 'rbox', p: [0, 0.4, 10.4], d: [3, 2.6, 3.6], c: 0xc83a2a, bv: [0.6, 0.6, 0.4] }, { s: 'box', p: [0, -0.2, 12.6], d: [2.2, 1.2, 2], t: [0.6, 1], c: 0xd84a3a }, { s: 'gem', p: [1.1, 1.4, 11.6], d: [0.7, 0.7, 0.7], c: 0xffe070, g: true }, { s: 'gem', p: [-1.1, 1.4, 11.6], d: [0.7, 0.7, 0.7], c: 0xffe070, g: true }, { s: 'cyl', p: [1, 2.4, 9.4], d: [0.6, 2.6, 0.6], r: [-60, 0, 0], t: [0.1, 0.1], c: GOLD, n: 5 }, { s: 'cyl', p: [-1, 2.4, 9.4], d: [0.6, 2.6, 0.6], r: [-60, 0, 0], t: [0.1, 0.1], c: GOLD, n: 5 }),
  ],
  halos: [
    { name: 'glow', node: 'lance', at: [0, 0, 15], size: 14, color: 0xd9e6ff, opacity: 0.3 },
    { name: 'flash', node: 'lance', at: [0, 0, 19], size: 40, color: 0xffffff, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Prism Ray / Rainbow Lattice: a floating prism
export const PRISM: ModelDef = {
  vox: 0.05,
  rim: 0.7,
  glassOpacity: 0.4,
  nodes: [{ n: 'prism' }, { n: 'cage', tier: 2 }, { n: 'sats', tier: 4 }, { n: 's0', parent: 'sats', at: [6, 0, 0] }, { n: 's1', parent: 'sats', at: [-3, 0, 5.2] }, { n: 's2', parent: 'sats', at: [-3, 0, -5.2] }],
  parts: [
    ...on('prism', { s: 'cyl', p: [0, 0, 0], d: [6, 8, 6], c: 0xffd8f0, n: 3, grp: 'glass' }, { s: 'cyl', p: [0, 0, 0], d: [2.6, 6.4, 2.6], c: 0xff6bd6, n: 3, g: true }, { s: 'gem', p: [0, 4.6, 0], d: [1.4, 1.6, 1.4], c: 0xffffff, g: true }, { s: 'gem', p: [0, -4.6, 0], d: [1.4, 1.6, 1.4], c: 0xffffff, g: true }),
    ...on('cage', ...ring(3, (a) => ({ s: 'rbox', p: [Math.sin(a + 0.52) * 3.6, 0, Math.cos(a + 0.52) * 3.6], d: [0.6, 9, 0.6], c: GOLD, bv: [0.2, 0.2, 0.2] }))),
    ...['s0', 's1', 's2'].flatMap((n, i) => on(n, { s: 'cyl', p: [0, 0, 0], d: [2.4, 3.4, 2.4], c: [0xff6b6b, 0x6bff9a, 0x6bb4ff][i], n: 3, g: true })),
  ],
  custom: [
    { node: 'cage', tris: torusTris(4, 0.35, 18, 3, [0, 4.4, 0]), paint: () => [GOLD, 0] },
    { node: 'cage', tris: torusTris(4, 0.35, 18, 3, [0, -4.4, 0]), paint: () => [GOLD, 0] },
  ],
  halos: [
    { name: 'glow', node: 'prism', at: [0, 0, 0], size: 22, color: 0xff6bd6, opacity: 0.6 },
    { name: 'flash', node: 'prism', at: [0, 0, 0], size: 44, color: 0xffe0f8, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Sanctified Halo / Sanctum: a holy ring with rays
export const HALO: ModelDef = {
  vox: 0.05,
  rim: 0.4,
  nodes: [{ n: 'halo' }, { n: 'rays', parent: 'halo', tier: 2 }, { n: 'wings', parent: 'halo', tier: 4 }],
  parts: [
    ...on('rays', ...ring(12, (a, i) => ({ s: 'gem', p: [Math.sin(a) * 7.2, 0, Math.cos(a) * 7.2], d: [0.7, 0.7, i % 2 ? 1.6 : 2.6], r: [0, (a * 180) / Math.PI, 0], c: 0xfff4c0, g: true }))),
    ...on('wings', ...[-1, 1].flatMap((s) => [0, 1, 2].map((k): P => ({ s: 'box', p: [s * (7 + k * 1.6), 0.4 + k * 0.6, -0.6], d: [3.6, 0.4, 1.4 + k * 0.3], r: [0, s * (20 - k * 12), s * (12 + k * 10)], c: 0xfffaf0 })))),
  ],
  custom: [
    { node: 'halo', tris: torusTris(5.6, 0.7, 32, 5), paint: (cx, _y, cz) => [noise3(cx, 0, cz, 3) > 0.2 ? 0xfff4c0 : GOLD, 1] },
    { node: 'halo', tris: torusTris(4.6, 0.25, 28, 3), paint: () => [0xffe8a0, 1] },
    { node: 'wings', tris: torusTris(6.6, 0.3, 30, 3, [0, 0.5, 0]), paint: () => [0xffffff, 1] },
  ],
  halos: [
    { name: 'glow', node: 'halo', at: [0, 0, 0], size: 30, color: 0xfff1a8, opacity: 0.45 },
    { name: 'flash', node: 'halo', at: [0, 0, 0], size: 60, color: 0xfff8d8, opacity: 0 },
  ],
};

// ------------------------------------------------------------------ Pulse Heart / Resonance: a beating crystal heart
export const HEART: ModelDef = {
  vox: 0.05,
  rim: 0.5,
  glassOpacity: 0.4,
  nodes: [{ n: 'heart' }, { n: 'core', parent: 'heart' }, { n: 'bands', parent: 'heart', tier: 3 }, { n: 'rings', tier: 4 }],
  parts: [
    ...on(
      'heart',
      { s: 'ball', p: [1.6, 1.2, 0], d: [4.6, 4.6, 4], c: 0x7affc3, grp: 'glass' },
      { s: 'ball', p: [-1.6, 1.2, 0], d: [4.6, 4.6, 4], c: 0x7affc3, grp: 'glass' },
      { s: 'box', p: [0, -1.4, 0], d: [5, 5, 3.6], r: [0, 0, 45], c: 0x7affc3, grp: 'glass' },
      // gold veins
      { s: 'cyl', p: [0, 3.2, 0], d: [1, 2, 1], c: GOLD, n: 6 },
      { s: 'cyl', p: [1.4, 3.6, 0.4], d: [0.8, 1.8, 0.8], r: [0, 0, -30], c: GOLD, n: 6 },
    ),
    ...on('core', { s: 'ball', p: [1, 0.8, 0], d: [2.6, 2.6, 2.4], c: 0xd8fff0, g: true }, { s: 'ball', p: [-1, 0.8, 0], d: [2.6, 2.6, 2.4], c: 0xd8fff0, g: true }, { s: 'gem', p: [0, -0.8, 0], d: [2.2, 2.6, 2], c: 0xd8fff0, g: true }),
  ],
  custom: [
    { node: 'bands', tris: torusTris(4.4, 0.25, 22, 3, [0, 0, 0], [90, 0, 0]), paint: () => [GOLD, 0] },
    { node: 'rings', tris: torusTris(6.4, 0.3, 28, 3, [0, 0, 0], [70, 0, 0]), paint: () => [0x7affc3, 1] },
    { node: 'rings', tris: torusTris(7.2, 0.25, 28, 3, [0, 0, 0], [-60, 30, 0]), paint: () => [0xb8ffe0, 1] },
  ],
  halos: [
    { name: 'glow', node: 'core', at: [0, 0.4, 0], size: 26, color: 0x7affc3, opacity: 0.6 },
    { name: 'flash', node: 'heart', at: [0, 0, 0], size: 60, color: 0xd8fff0, opacity: 0 },
  ],
};

export const MODELS2: Record<string, ModelDef> = {
  dagger: DAGGER,
  arcane: ARCANE,
  iceshard: ICESHARD,
  arrow: ARROW,
  heavybolt: HEAVYBOLT,
  glaive: GLAIVE,
  saw: SAW,
  wisp: WISP,
  wispshot: WISPSHOT,
  bomb: BOMB,
  mine: MINE,
  runeblade: RUNEBLADE,
  fist: FIST,
  lance: LANCE,
  prism: PRISM,
  halo: HALO,
  heart: HEART,
};
export type { V3 };
