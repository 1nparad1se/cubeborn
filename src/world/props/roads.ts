import '../textures/roads';
import { ROAD_KINDS, ROAD_PAL, ROAD_VARIANTS, type RoadKind } from '../textures/groundTiles';
import { Model, pick, rr } from './kit';
import type { BuildCtx, PropDef } from './types';

/**
 * Sheet 10 «Дороги»: road surfaces live in textures/groundTiles.ts (painted with paintRoad); this
 * file holds the detail & decor props (section 11: grass, flowers, stones, leaves, mushrooms, ruts,
 * puddles, sand patches, footprints, moss), edge pieces (kerb stones, reeds, scree, sand drift),
 * boardwalk steps and bracketed boardwalk, and one sample slab per road kind (variant 0 = base,
 * 1.. = the sheet variants) so the surfaces can be checked in the prop viewer.
 * All decor is walk-through (solid: false) and flat or low; paintRoad scatters it along edges.
 */

const sway = (amp = 0.01) => ({ kind: 'sway' as const, amp, speed: 1.7 });

// ---------------------------------------------------------------- pieces

function tuft(m: Model, x: number, z: number, rnd: () => number, h = 7, n = 5, dry = false) {
  const from = m.mark;
  for (let i = 0; i < n; i++) {
    const bh = h * (0.55 + rnd() * 0.6);
    const col = dry ? pick(rnd, [0xb0a050, 0x9a8a40, 0xc8b060]) : pick(rnd, ROAD_PAL.grass.slice(1));
    m.cbox(x + rr(rnd, -2.5, 2.5), 0, z + rr(rnd, -2.5, 2.5), 1, bh, 1, 'road_grass', { tint: col | 0x202020, bevel: 0, rot: { x: rr(rnd, -0.35, 0.35), z: rr(rnd, -0.35, 0.35) } });
  }
  m.animate(from, { ...sway(0.012), pivot: [x, 0, z] });
}

function flower(m: Model, x: number, z: number, rnd: () => number, col: number) {
  const h = rr(rnd, 4, 7);
  const from = m.mark;
  m.cbox(x, 0, z, 0.8, h, 0.8, 'road_grass', { bevel: 0 });
  m.cbox(x + 1, 1, z, 2, 1, 1, 'road_grass', { bevel: 0 });
  m.cbox(x, h, z, 2.4, 1.6, 2.4, 'cloth_white', { tint: col, bevel: 0, noAO: true });
  m.cbox(x, h + 0.4, z, 1, 1.4, 1, 'cloth_white', { tint: 0xf0d040, bevel: 0, noAO: true });
  m.animate(from, { ...sway(0.01), pivot: [x, 0, z] });
}

function pebble(m: Model, x: number, z: number, s: number, rnd: () => number, tex = 'road_pebble', tint?: number) {
  m.cbox(x, 0, z, s * rr(rnd, 0.8, 1.25), s * rr(rnd, 0.45, 0.75), s * rr(rnd, 0.8, 1.2), tex, { tint, rot: { y: rr(rnd, -0.6, 0.6) } });
}

function mushroom(m: Model, x: number, z: number, rnd: () => number, s = 1, red = true) {
  const h = 4 * s * rr(rnd, 0.8, 1.2);
  m.cbox(x, 0, z, 1.6 * s, h, 1.6 * s, 'mushroom_stem');
  m.cbox(x, h, z, 5 * s, 1.6 * s, 5 * s, red ? 'cloth_red' : 'cloth_brown', { tint: red ? 0xffffff : 0xc89a70 });
  m.cbox(x, h + 1.6 * s, z, 3 * s, 1 * s, 3 * s, red ? 'cloth_red' : 'cloth_brown', { tint: red ? 0xffffff : 0xc89a70 });
  if (red) for (const [dx, dz] of [[-1.5, 1], [1.2, -0.8], [0.3, 1.8]]) m.cbox(x + dx * s, h + 1.5 * s, z + dz * s, 0.8, 0.4, 0.8, 'cloth_white', { bevel: 0, noAO: true });
}

/** A flat decal patch made of a few overlapping thin slabs (ragged outline). */
function patch(m: Model, x: number, z: number, w: number, d: number, tex: string, rnd: () => number, n = 4, y = 0.15, o: { tint?: number; glow?: number } = {}) {
  m.cbox(x, y, z, w * 0.8, 0.4, d * 0.8, tex, { bevel: 0, noAO: true, ...o });
  for (let i = 0; i < n; i++) m.cbox(x + rr(rnd, -w, w) * 0.3, y, z + rr(rnd, -d, d) * 0.3, w * rr(rnd, 0.35, 0.6), 0.4, d * rr(rnd, 0.35, 0.6), tex, { bevel: 0, noAO: true, ...o });
}

// ---------------------------------------------------------------- props

function grass(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const n = 2 + ctx.variant;
  for (let i = 0; i < n; i++) tuft(m, rr(r, -7, 7), rr(r, -7, 7), r, rr(r, 6, 10), 6, ctx.variant === 2 && i % 2 === 0);
  return m;
}

function flowers(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const cols = [[0xe070a0, 0xf0f0f0], [0xf0e070, 0xf0a030], [0xa070e0, 0xf0f0f0]][ctx.variant];
  tuft(m, 0, 0, r, 6, 6);
  for (let i = 0; i < 6; i++) flower(m, rr(r, -7, 7), rr(r, -7, 7), r, pick(r, cols));
  return m;
}

function stones(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const big = ctx.variant === 1;
  pebble(m, -2, 0, big ? 9 : 6, r, 'road_pebble');
  pebble(m, 4, 3, big ? 6 : 4, r, 'stone_mossy');
  for (let i = 0; i < 4; i++) pebble(m, rr(r, -8, 8), rr(r, -8, 8), rr(r, 2, 3.5), r, 'road_pebble');
  if (ctx.variant === 2) patch(m, 0, 0, 12, 10, 'road_moss', r, 3, 0.1);
  return m;
}

function leaves(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  patch(m, 0, 0, 18, 16, 'road_leaves', r, 5);
  for (let i = 0; i < 8; i++)
    m.cbox(rr(r, -9, 9), 0.5, rr(r, -9, 9), 3, 0.6, 2, 'road_leaves', { bevel: 0, noAO: true, rot: { y: rr(r, 0, 3), x: rr(r, -0.2, 0.2) } });
  if (ctx.variant === 1) tuft(m, 5, -5, r, 7, 5);
  return m;
}

function mushrooms(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const red = ctx.variant !== 1;
  mushroom(m, -2, 1, r, 1.3, red);
  mushroom(m, 3, -2, r, 0.9, red);
  mushroom(m, 1, 4, r, 0.7, red);
  tuft(m, -5, -4, r, 5, 4);
  return m;
}

function ruts(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  // two cart tracks along x (2 cells long), muddy grooves with lighter raised ridges
  for (const z of [-6, 6]) {
    m.cbox(0, 0.1, z, 46, 0.5, 3, 'road_dirt_dark', { bevel: 0, noAO: true });
    for (let x = -22; x < 22; x += rr(r, 5, 9)) m.cbox(x, 0.2, z + pick(r, [-2.2, 2.2]), rr(r, 3, 6), 0.8, 1.2, 'dirt', { bevel: 0 });
    if (ctx.variant === 1) patch(m, rr(r, -14, 14), z, 8, 4, 'road_puddle', r, 2, 0.35, { glow: 0.12 });
  }
  return m;
}

function puddle(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const mud = ctx.variant === 2;
  const s = ctx.variant === 1 ? 26 : 16;
  patch(m, 0, 0, s + 4, s, 'road_mud', r, 4, 0.05);
  patch(m, 0, 0, s, s * 0.8, mud ? 'road_puddle_mud' : 'road_puddle', r, 4, 0.3, { glow: mud ? 0 : 0.15 });
  if (ctx.variant === 1) for (let i = 0; i < 2; i++) m.cbox(rr(r, -6, 6), 0.5, rr(r, -5, 5), 3, 0.4, 3, 'leaves', { bevel: 0, noAO: true, anim: { kind: 'bob', amp: 0.01, speed: 1 } });
  return m;
}

function sandPatch(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  patch(m, 0, 0, 20, 16, 'road_sand_patch', r, 5, 0.1);
  if (ctx.variant === 1) {
    m.cbox(0, 0.3, 0, 12, 2, 8, 'road_sand_patch', { bevel: 0.5 });
    m.cbox(1, 2.3, 0, 7, 1.5, 5, 'road_sand_patch', { bevel: 0.5 });
  }
  for (let i = 0; i < 3; i++) pebble(m, rr(r, -8, 8), rr(r, -7, 7), 2, r, 'road_pebble', 0xe0c8a0);
  return m;
}

function footprints(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const tex = ['road_dirt_dark', 'road_mud', 'road_sand_patch'][ctx.variant];
  const tint = ctx.variant === 2 ? 0xb89068 : undefined;
  for (let i = 0; i < 5; i++) {
    const x = -16 + i * 8;
    const z = i % 2 ? 2.5 : -2.5;
    m.cbox(x, 0.15, z, 4, 0.4, 2.4, tex, { bevel: 0, noAO: true, tint });
    m.cbox(x + 3, 0.15, z, 1.6, 0.4, 2, tex, { bevel: 0, noAO: true, tint });
  }
  void r;
  return m;
}

function moss(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  patch(m, 0, 0, 18, 16, 'road_moss', r, 5, 0.1);
  for (let i = 0; i < 4; i++) m.cbox(rr(r, -7, 7), 0.4, rr(r, -7, 7), rr(r, 3, 6), 1.2, rr(r, 3, 6), 'road_moss', { bevel: 0.4 });
  if (ctx.variant === 1) pebble(m, 2, 1, 7, r, 'stone_mossy');
  return m;
}

/** Edge kerb (переход на камень/скалы): a row of rough blocks along x, 2 cells. */
function kerb(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const rocks = ctx.variant === 1;
  for (let x = -20; x < 22; ) {
    const w = rr(r, 6, 10);
    const h = rocks ? rr(r, 4, 11) : rr(r, 2.5, 4);
    if (ctx.variant !== 2 || r() > 0.3) m.box(x, 0, -4 + rr(r, -1, 1), w - 0.5, h, rocks ? rr(r, 7, 10) : 7, rocks ? pick(r, ['stone', 'stone_mossy', 'stone_cracked']) : 'road_pebble');
    x += w;
  }
  if (ctx.variant === 2) tuft(m, 6, 4, r, 6, 5);
  return m;
}

/** Swamp edge reeds and cattails (переход на воду). */
function reeds(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const from = m.mark;
  for (let i = 0; i < 9; i++) {
    const x = rr(r, -9, 9);
    const z = rr(r, -9, 9);
    const h = rr(r, 10, 18);
    m.cbox(x, 0, z, 1, h, 1, 'road_grass', { tint: 0x8aa050, bevel: 0 });
    if (i % 3 === 0) m.cbox(x, h - 4, z, 1.8, 4, 1.8, 'cloth_brown', { tint: 0x8a5a30, bevel: 0 });
  }
  m.animate(from, sway(0.02));
  if (ctx.variant === 1) patch(m, 0, 0, 16, 14, 'road_puddle', r, 3, 0.2, { glow: 0.12 });
  return m;
}

/** Scree spill (осыпь) at a mountain path edge. */
function scree(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 14; i++) {
    const d = r();
    pebble(m, rr(r, -10, 10), rr(r, -10, 10) * (1 - d * 0.4), 2 + (1 - d) * 4, r, pick(r, ['stone', 'stone_dark', 'road_pebble']));
  }
  if (ctx.variant === 1) pebble(m, -3, -3, 11, r, 'stone_cracked');
  return m;
}

/** Sand drift heaped over a road edge (песчаные наносы). */
function sandDrift(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  const L = 40;
  m.cbox(0, 0, 0, L, 2, 18, 'road_sand_patch', { bevel: 0.5 });
  m.cbox(rr(r, -4, 4), 2, -1, L * 0.7, 2, 12, 'road_sand_patch', { bevel: 0.5 });
  m.cbox(rr(r, -4, 4), 4, -2, L * 0.4, 1.5, 7, 'road_sand_patch', { bevel: 0.5 });
  if (ctx.variant === 1) pebble(m, 12, 6, 6, r, 'sandstone');
  tuft(m, -14, 6, r, 6, 4, true);
  return m;
}

/** Boardwalk stairs (ступени): 3 steps rising toward -x, 2 cells long, 2 wide. */
function steps(ctx: BuildCtx) {
  const m = new Model();
  const W = 44;
  for (let i = 0; i < 3; i++) {
    const x0 = 24 - (i + 1) * 16;
    const top = (i + 1) * 8;
    m.box(x0 - (i === 2 ? 8 : 0), 0, -W / 2, 16 + (i === 2 ? 8 : 0), top, W, { side: 'plank_v', top: 'plank' }, { uv: [i * 5, 0] });
    m.box(x0 + 14, 0, -W / 2 - 2, 3, top + 2, 3, 'beam_dark');
    m.box(x0 + 14, 0, W / 2 - 1, 3, top + 2, 3, 'beam_dark');
  }
  if (ctx.variant === 1) for (const z of [-W / 2 - 2, W / 2 - 1]) m.box(-24, 26, z, 48, 2, 3, 'beam_dark', { rot: { z: -0.32, pivot: [0, 18, z] } });
  return m;
}

/** Boardwalk segment with posts and iron brackets (с креплениями), 2x2 cells, walkable. */
function bracketed(ctx: BuildCtx) {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 48, 6, 46, { side: 'plank_v_dark', top: 'plank' });
  for (const z of [-20, 0, 20]) m.box(-24, 0.2, z - 2, 48, 6.2, 1, 'beam_dark', { bevel: 0 });
  for (const [x, z] of [[-22, -24], [22, -24], [-22, 22], [22, 22], [0, 22]]) {
    m.cbox(x, -2, z + 1, 4, 14 + (r() > 0.5 ? 2 : 0), 4, { side: 'beam_dark', end: 'wood_end' });
    m.cbox(x, 3, z + 1, 5, 2, 5, 'metal_dark', { bevel: 0.5 });
    m.cbox(x, 9, z + 1, 5, 1.5, 5, 'metal_dark', { bevel: 0.5 });
  }
  if (ctx.variant === 1) for (const x of [-12, 10]) m.cbox(x, 5.8, rr(r, -14, 14), 3, 0.5, 3, 'metal', { bevel: 0 });
  return m;
}

/** Surface sample: 3x3 half-block tiles of a road kind (variant 0 base, then sheet variants). */
function sample(kind: RoadKind) {
  return (ctx: BuildCtx) => {
    const m = new Model();
    const name = ctx.variant === 0 ? kind : `${kind}_${ROAD_VARIANTS[kind][ctx.variant - 1]}`;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const v = Math.floor(ctx.rnd() * 4);
        m.box(-24 + i * 16, 0, -24 + j * 16, 16, 2, 16, { top: `gt_${name}_${v}`, side: kind === 'boardwalk' ? 'plank_dark' : kind.includes('sand') ? 'sandstone' : 'dirt' }, { bevel: 0 });
      }
    return m;
  };
}

const deco = (id: string, name: string, build: (c: BuildCtx) => Model, variants = 1, size: [number, number] = [1, 1]): PropDef => ({
  id,
  name,
  category: 'roads',
  size,
  solid: false,
  variants,
  tags: ['road', 'decal'],
  build,
});

const SAMPLE_NAMES: Record<RoadKind, string> = {
  road_stone: 'Каменная дорога',
  road_dirt: 'Грунтовая дорога',
  path_forest: 'Лесная тропинка',
  road_sand: 'Песчаная дорога',
  boardwalk: 'Деревянный настил',
  path_mountain: 'Горная тропа',
  path_swamp: 'Болотная тропа',
};

export const ROAD_PROPS: PropDef[] = [
  deco('road_grass', 'Трава (пучки)', grass, 3),
  deco('road_flowers', 'Цветы', flowers, 3),
  deco('road_stones', 'Камни', stones, 3),
  deco('road_leaves', 'Листва', leaves, 2),
  deco('road_mushrooms', 'Грибы', mushrooms, 2),
  deco('road_ruts', 'Колея', ruts, 2, [2, 1]),
  deco('road_puddle', 'Лужа', puddle, 3),
  deco('road_sand_patch', 'Пески', sandPatch, 2),
  deco('road_footprints', 'Следы', footprints, 3, [2, 1]),
  deco('road_moss', 'Мох', moss, 2),
  deco('road_reeds', 'Камыш у края', reeds, 2),
  deco('road_scree', 'Осыпь', scree, 2),
  { ...deco('road_kerb', 'Бордюр / край', kerb, 3, [2, 1]), tags: ['road', 'edge'] },
  { ...deco('road_sand_drift', 'Песчаный нанос', sandDrift, 2, [2, 1]), tags: ['road', 'edge'] },
  { id: 'road_boardwalk_steps', name: 'Настил: ступени', category: 'roads', size: [2, 2], solid: false, variants: 2, tags: ['road', 'boardwalk'], deck: (fx) => (fx === 0 ? 1 : null), build: steps },
  { id: 'road_boardwalk_bracketed', name: 'Настил с креплениями', category: 'roads', size: [2, 2], solid: false, variants: 2, tags: ['road', 'boardwalk'], build: bracketed },
  ...ROAD_KINDS.map((k) => deco(`road_sample_${k}`, SAMPLE_NAMES[k], sample(k), 1 + ROAD_VARIANTS[k].length, [2, 2])),
];

/** Decor ids paintRoad scatters along the edges of each road kind. */
export const ROAD_EDGE_DECOR: Record<RoadKind, string[]> = {
  road_stone: ['road_grass', 'road_stones', 'road_moss', 'road_flowers'],
  road_dirt: ['road_grass', 'road_stones', 'road_flowers', 'road_puddle'],
  path_forest: ['road_grass', 'road_flowers', 'road_leaves', 'road_mushrooms', 'road_moss'],
  road_sand: ['road_sand_patch', 'road_stones', 'road_grass'],
  boardwalk: ['road_grass', 'road_moss', 'road_reeds'],
  path_mountain: ['road_scree', 'road_stones', 'road_moss', 'road_grass'],
  path_swamp: ['road_reeds', 'road_puddle', 'road_moss', 'road_mushrooms'],
};
/** Decor dropped on the road surface itself (sparser). */
export const ROAD_SURFACE_DECOR: Record<RoadKind, string[]> = {
  road_stone: ['road_stones'],
  road_dirt: ['road_footprints', 'road_ruts', 'road_puddle'],
  path_forest: ['road_leaves', 'road_footprints'],
  road_sand: ['road_footprints', 'road_sand_patch'],
  boardwalk: [],
  path_mountain: ['road_stones'],
  path_swamp: ['road_puddle', 'road_footprints'],
};
