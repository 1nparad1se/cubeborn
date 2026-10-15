import { Model, rr, stone } from './kit';
import type { Anim, BuildCtx, PropDef } from './types';
import { crown, flower, trunk, tuft } from './trees';
import '../textures/trees';
import '../textures/vegetation';

/**
 * Кусты и растительность (лист 4): bushes (low / mid / tall / berry / flowering / dry, growth
 * stages), grass heights, flowers in six colours, ferns and leaves, berries, mushrooms (incl.
 * glowing), dry and dead plants, stumps, fallen trees, swamp plants, biome sets, vines / ivy and
 * decorative combos. Sizes in px (16 px = 1 block); everything sways gently in the wind.
 */

type R = () => number;
const sway = (x: number, y: number, z: number, amp = 0.008, speed = 1.8): Anim => ({ kind: 'sway', pivot: [x, y, z], amp, speed });

// ---------------------------------------------------------------- pieces

/**
 * Leafy bush blob: a core box and jittered leaf cubes round its shell, dark at the bottom.
 * (x, z) centre, w width, h height (px).
 */
function bush(m: Model, x: number, z: number, w: number, h: number, r: R, tex = 'leaf_bush', dark = 'leaf_bush_dark', y = 0) {
  const from = m.mark;
  m.cbox(x, y, z, w * 0.75, h * 0.8, w * 0.75, dark, { uv: [r() * 16, 0] });
  const n = Math.round(6 + w / 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(r, -0.3, 0.3);
    const s = rr(r, w * 0.3, w * 0.45);
    const yy = y + rr(r, 0, h - s);
    const d = w * 0.5 - s * 0.5;
    m.cbox(x + Math.cos(a) * d, yy, z + Math.sin(a) * d, s, s, s, yy - y < h * 0.3 ? dark : tex, { uv: [r() * 16, r() * 16] });
  }
  // top
  for (let i = 0; i < 3; i++) {
    const s = rr(r, w * 0.35, w * 0.5);
    m.cbox(x + rr(r, -w * 0.15, w * 0.15), y + h - s * 0.8, z + rr(r, -w * 0.15, w * 0.15), s, s * 0.8, s, tex, { noAO: true, uv: [r() * 16, r() * 16] });
  }
  m.animate(from, sway(x, y, z, 0.006, 1.5));
}

/** Small cubes scattered over a bush's shell (berries, blossoms, fruit). */
function dots(m: Model, x: number, z: number, w: number, h: number, n: number, tex: string, s: number, r: R, glow = 0, y = 0) {
  const from = m.mark;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const yy = y + rr(r, h * 0.2, h * 0.95);
    const d = w * 0.5 + 0.3 - (yy - y > h * 0.8 ? w * 0.25 : 0);
    m.cbox(x + Math.cos(a) * d, yy, z + Math.sin(a) * d, s, s, s, tex, { bevel: 0, noAO: true, glow: glow || undefined });
  }
  m.animate(from, sway(x, y, z, 0.006, 1.5));
}

/** Blossom: 3x3 petals with a centre on a bush surface. */
function blossoms(m: Model, x: number, z: number, w: number, h: number, n: number, color: string, r: R) {
  const from = m.mark;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const yy = rr(r, h * 0.3, h + 0.5);
    const d = yy > h * 0.85 ? rr(r, 0, w * 0.3) : w * 0.5 + 0.3;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    m.cbox(px, yy, pz, 3.5, 1.2, 3.5, 'petal_' + color, { bevel: 0, noAO: true });
    m.cbox(px, yy + 1.2, pz, 1.2, 0.6, 1.2, 'petal_yellow', { bevel: 0, noAO: true });
  }
  m.animate(from, sway(x, 0, z, 0.006, 1.5));
}

/** Dry twig shrub: branching thin sticks fanning out of a root. */
function twigs(m: Model, x: number, z: number, h: number, r: R, tex = 'twig_dry', n = 7, y = 0) {
  const from = m.mark;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(r, -0.4, 0.4);
    const tilt = rr(r, 0.25, 0.75);
    const len = h * rr(r, 0.7, 1.1);
    const t = rr(r, 1, 1.6);
    // stick: along +y, tilted around x then turned around y
    m.cbox(x, y, z, t, len, t, tex, { bevel: 0, rot: { y: a, x: tilt, pivot: [x, y, z] } });
    // a side twig from the stick's middle
    const mid = len * rr(r, 0.4, 0.7);
    const mx = x + Math.sin(a) * Math.sin(tilt) * mid;
    const mz = z + Math.cos(a) * Math.sin(tilt) * mid;
    const my = y + Math.cos(tilt) * mid;
    m.cbox(mx, my, mz, 0.9, len * 0.45, 0.9, tex, { bevel: 0, rot: { y: a + rr(r, -1, 1), x: tilt + rr(r, 0.3, 0.7), pivot: [mx, my, mz] } });
  }
  m.animate(from, sway(x, y, z, 0.004, 1.6));
}

/** Frond: a flat leaf plane from the base, turned around y and tilted up (fern, broad leaf). */
function frond(m: Model, x: number, y: number, z: number, a: number, len: number, w: number, tilt: number, tex: string, tint?: number) {
  m.box(x - w / 2, y, z, w, 0.4, len, tex, { bevel: 0, tint, rot: { y: a, x: -tilt, pivot: [x, y, z] }, anim: sway(x, y, z, 0.01, 2) });
}

function fernClump(m: Model, x: number, z: number, s: number, r: R, tex = 'fern', y = 0) {
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) frond(m, x, y + 1, z, (i / n) * Math.PI * 2 + rr(r, -0.2, 0.2), s * rr(r, 0.8, 1.1), s * 0.4, rr(r, 0.45, 0.8), tex);
  for (let i = 0; i < 2; i++) frond(m, x, y + 1, z, r() * 6.3, s * 0.7, s * 0.35, 1.1, tex);
}

function grassPatch(m: Model, n: number, rad: number, size: number, tex: string, r: R, hK = 1) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * rad;
    const s = size * rr(r, 0.75, 1.15);
    tuft(m, Math.cos(a) * d, 0, Math.sin(a) * d, s, tex, r, s * hK);
  }
}

function mushroom(m: Model, x: number, z: number, s: number, cap: string, r: R, glow = 0, y = 0) {
  const g = glow ? { glow, noAO: true } : {};
  const lean = rr(r, -0.15, 0.15);
  const rot = { z: lean, pivot: [x, y, z] as [number, number, number] };
  m.cbox(x, y, z, s * 0.35, s * 0.9, s * 0.35, 'mushroom_stem', { bevel: 0, rot, ...(glow ? { glow: glow * 0.4 } : {}) });
  m.cbox(x, y + s * 0.85, z, s, s * 0.3, s, { side: cap, top: cap, bottom: 'gill' }, { rot, ...g });
  m.cbox(x, y + s * 1.15, z, s * 0.65, s * 0.22, s * 0.65, cap, { rot, ...g, bevel: 0.5 });
}

function lilyPad(m: Model, x: number, z: number, s: number, r: R, y = 0.6) {
  m.cbox(x, y, z, s, 0.5, s, 'lily_pad', { bevel: 0, rot: { y: r() * 6.3 }, anim: { kind: 'bob', amp: 0.02, speed: 1.2, phase: r() * 6 } });
}

function lilyFlower(m: Model, x: number, z: number, r: R, y = 1) {
  const anim: Anim = { kind: 'bob', amp: 0.02, speed: 1.2 };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.box(x - 1.5, y, z, 3, 0.6, 5, 'petal_pink', { bevel: 0, noAO: true, rot: { y: a, x: -0.6, pivot: [x, y, z] }, anim });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    m.box(x - 1, y + 0.5, z, 2, 0.6, 3.5, 'petal_pink', { bevel: 0, noAO: true, tint: 0xffd0f0, rot: { y: a, x: -1.0, pivot: [x, y, z] }, anim });
  }
  m.cbox(x, y + 0.5, z, 2, 2, 2, 'petal_yellow', { bevel: 0, noAO: true, anim });
}

function cattail(m: Model, x: number, z: number, h: number, r: R) {
  const an = sway(x, 0, z, 0.012, 1.4);
  m.cbox(x, 0, z, 1, h, 1, 'reed', { bevel: 0, anim: an });
  m.cbox(x, h * 0.72, z, 2.5, h * 0.2, 2.5, 'cattail', { bevel: 0.5, anim: an });
  m.cbox(x, h * 0.92, z, 0.6, h * 0.1, 0.6, 'reed', { bevel: 0, anim: an });
  for (let i = 0; i < 2; i++) frond(m, x, 0, z, r() * 6.3, h * 0.6, 1.5, 1.25, 'reed');
}

/** Hanging strand of a cut-out tile (ivy / vine leaves) from (x, top, z) down `len` px. */
function strand(m: Model, x: number, top: number, z: number, len: number, tex: string, w = 5, face: 'z' | 'x' = 'z') {
  const anim: Anim = { kind: 'swing', pivot: [x, top, z], axis: face === 'z' ? [1, 0, 0] : [0, 0, 1], amp: 0.05, speed: 1.2 };
  if (face === 'z') m.box(x - w / 2, top - len, z, w, len, 0.3, tex, { bevel: 0, anim, uv: [0, (x * 7) % 16] });
  else m.box(x, top - len, z - w / 2, 0.3, len, w, tex, { bevel: 0, anim, uv: [0, (z * 7) % 16] });
}

/** Wavy vine stem (liana): short offset segments. */
function liana(m: Model, x: number, top: number, z: number, len: number, r: R) {
  let ox = 0;
  const seg = 6;
  const anim: Anim = { kind: 'swing', pivot: [x, top, z], axis: [1, 0, 0], amp: 0.06, speed: 1.1 };
  for (let y = top; y > top - len; y -= seg) {
    ox += rr(r, -1, 1);
    ox = Math.max(-2, Math.min(2, ox));
    m.box(x + ox - 0.8, y - seg, z - 0.8, 1.6, seg + 0.5, 1.6, 'vine_stem', { bevel: 0, anim });
  }
}

function stoneBlock(m: Model, x: number, y: number, z: number, w: number, h: number, d: number, mossy = true) {
  m.cbox(x, y, z, w, h, d, mossy ? { side: 'stone_mossy', top: 'moss' } : 'stone');
}

// ---------------------------------------------------------------- 1. bushes + 2. growth stages

const BUSH_SIZES = { low: [22, 12], mid: [28, 20], tall: [30, 34] } as const;

function bushProp(kind: keyof typeof BUSH_SIZES) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const k = [1, 0.75, 0.6][ctx.variant % 3];
    const [w, h] = BUSH_SIZES[kind];
    bush(m, 0, 0, w * k, h * k, r);
    if (kind === 'tall') dots(m, 0, 0, w * k, h * k, 5, 'petal_white', 1.5, r);
    if (ctx.variant === 0) grassPatch(m, 3, w * 0.5, 7, 'grass_blades', r);
    return m;
  };
}

function berryBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  bush(m, 0, 0, 28 * k, 20 * k, r);
  dots(m, 0, 0, 28 * k, 20 * k, Math.round(18 * k), 'berry_red', 2.4, r);
  return m;
}

function floweringBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  bush(m, 0, 0, 28 * k, 20 * k, r);
  blossoms(m, 0, 0, 28 * k, 20 * k, Math.round(14 * k), ctx.variant === 1 ? 'white' : 'pink', r);
  return m;
}

function dryBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  twigs(m, 0, 0, 22 * k, r, 'twig_dry', 8);
  twigs(m, 0, 0, 14 * k, r, 'twig_dry', 5);
  return m;
}

function growthStage(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const st = ctx.variant; // 0..5 seedling → mature
  if (st === 0) {
    for (let i = 0; i < 3; i++) frond(m, 0, 0, 0, i * 2.1, 6, 3, 0.9, 'leaf_broad');
    m.cbox(0, 0, 0, 1, 5, 1, 'flower_stem', { bevel: 0 });
  } else {
    const k = 0.35 + st * 0.13;
    m.cbox(0, 0, 0, 2, 6 * k, 2, 'bark_oak');
    bush(m, 0, 0, 30 * k, 26 * k, r, 'leaf_bush', 'leaf_bush_dark', 3 * k);
    if (st >= 4) dots(m, 0, 0, 30 * k, 26 * k + 3 * k, st * 3, 'berry_red', 2, r, 0, 3 * k);
  }
  return m;
}

// ---------------------------------------------------------------- 3. grass

function grassProp(tex: string, n: number, rad: number, size: number, hK = 1, extra?: (m: Model, r: R) => void) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const k = [1, 0.7, 0.55][ctx.variant % 3];
    grassPatch(m, Math.max(2, Math.round(n * k)), rad * k, size, tex, ctx.rnd, hK);
    extra?.(m, ctx.rnd);
    return m;
  };
}

// ---------------------------------------------------------------- 4. flowers

function flowersProp(color: string) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const n = [6, 3, 2][ctx.variant % 3];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 7;
      flower(m, Math.cos(a) * d, 0, Math.sin(a) * d, color, rr(r, 5, 10), rr(r, 3.5, 5));
    }
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      frond(m, Math.cos(a) * 3, 0, Math.sin(a) * 3, a, 6, 2.5, 0.5, 'leaf_broad');
    }
    grassPatch(m, 2, 6, 6, 'grass_blades', r);
    return m;
  };
}

// ---------------------------------------------------------------- 5. ferns & leaves

function fernProp(ctx: BuildCtx): Model {
  const m = new Model();
  fernClump(m, 0, 0, [20, 14, 11][ctx.variant % 3], ctx.rnd);
  return m;
}

function broadLeaf(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  for (let i = 0; i < 6; i++) frond(m, 0, 1, 0, (i / 6) * 6.28 + rr(r, -0.2, 0.2), 16 * k, 9 * k, rr(r, 0.4, 0.9), 'leaf_broad');
  m.cbox(0, 0, 0, 2, 5 * k, 2, 'flower_stem', { bevel: 0 });
  return m;
}

function tropicLeaf(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  for (let i = 0; i < 7; i++) frond(m, 0, 1, 0, (i / 7) * 6.28 + rr(r, -0.2, 0.2), 22 * k, 12 * k, rr(r, 0.5, 1.0), 'leaf_tropic');
  return m;
}

function palmBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  const h = 12 * k;
  m.cbox(0, 0, 0, 5 * k, h, 5 * k, 'bark_pine');
  m.cbox(0, h, 0, 4 * k, 3 * k, 4 * k, 'bark_oak');
  for (let i = 0; i < 8; i++) frond(m, 0, h + 2 * k, 0, (i / 8) * 6.28 + rr(r, -0.2, 0.2), 26 * k, 7 * k, rr(r, 0.05, 0.35), 'fern', 0xd8ffc0);
  for (let i = 0; i < 4; i++) frond(m, 0, h + 2 * k, 0, r() * 6.3, 16 * k, 6 * k, 0.9, 'fern');
  return m;
}

function undergrowth(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  fernClump(m, -6, -2, 14, r);
  bush(m, 8, -4, 14, 9, r);
  for (let i = 0; i < 3; i++) frond(m, 4, 1, 8, r() * 6.3, 10, 6, 0.6, 'leaf_broad');
  flower(m, -2, 0, 9, 'white', 5, 3);
  flower(m, 10, 0, 6, 'pink', 6, 3);
  stone(m, -10, 0, 9, 6, r, 'stone_mossy');
  grassPatch(m, 3, 12, 7, 'grass_blades', r);
  return m;
}

// ---------------------------------------------------------------- 6. berries, mushrooms, fruit

function berriesProp(tex: string) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const k = [1, 0.7, 0.55][ctx.variant % 3];
    bush(m, 0, 0, 20 * k, 13 * k, r, 'leaf_bush', 'leaf_bush_dark');
    dots(m, 0, 0, 20 * k, 13 * k, Math.round(16 * k), tex, 2.5, r);
    for (let i = 0; i < 3; i++) frond(m, rr(r, -6, 6), 0, rr(r, -6, 6), r() * 6.3, 8 * k, 5 * k, 0.4, 'leaf_broad');
    return m;
  };
}

function mushroomsSmall(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const cap = ctx.variant === 2 ? 'cap_brown' : 'cap_red';
  const n = [5, 3, 2][ctx.variant % 3];
  for (let i = 0; i < n; i++) mushroom(m, rr(r, -8, 8), rr(r, -8, 8), rr(r, 4, 7), cap, r);
  grassPatch(m, 2, 8, 6, 'grass_blades', r);
  return m;
}

function mushroomsBig(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const cap = ['cap_red', 'cap_red', 'cap_brown'][ctx.variant % 3];
  mushroom(m, -2, -2, 18, cap, r);
  mushroom(m, 9, 5, 10, cap, r);
  if (ctx.variant !== 1) mushroom(m, -9, 7, 7, cap, r);
  grassPatch(m, 3, 10, 7, 'grass_blades', r);
  return m;
}

function mushroomsGlow(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const big = ctx.variant !== 2;
  mushroom(m, -2, -2, big ? 14 : 8, 'cap_glow', r, 1.4);
  mushroom(m, 7, 5, 8, 'cap_glow', r, 1.4);
  mushroom(m, -8, 6, 6, 'cap_glow', r, 1.4);
  if (ctx.variant === 0) mushroom(m, 8, -7, 5, 'cap_glow', r, 1.4);
  m.light(0, 10, 0, 0x5a8aff, 0.8, 5, 0.1, 0.25);
  m.emit({ kind: 'motes', x: 0, y: 8, z: 0, count: 8, spread: 12, height: 26, size: 1.4, color: 0x8ab8ff, color2: 0xd0f0ff });
  return m;
}

function forestFruit(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.7, 0.55][ctx.variant % 3];
  bush(m, 0, 0, 22 * k, 16 * k, r);
  dots(m, 0, 0, 22 * k, 16 * k, Math.round(12 * k), 'fruit_orange', 3, r);
  dots(m, 0, 0, 22 * k, 16 * k, Math.round(5 * k), 'cap_brown', 2.5, r);
  return m;
}

// ---------------------------------------------------------------- 7. dry and dead

function deadTree(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.7, 0.5][ctx.variant % 3];
  const h = 44 * k;
  m.cbox(0, 0, 0, 8 * k + 2, h, 8 * k + 2, { side: 'dead_wood', end: 'dead_wood_end' });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28 + rr(r, -0.3, 0.3);
    m.cbox(Math.cos(a) * 6 * k, 0, Math.sin(a) * 6 * k, 5 * k, 3, 5 * k, 'dead_wood');
  }
  // gnarled branches: two levels
  const nb = 5;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.28 + rr(r, -0.4, 0.4);
    const y0 = h * rr(r, 0.5, 0.95);
    const len = rr(r, 14, 22) * k;
    const tilt = rr(r, 0.5, 0.9);
    const t = 3 * k + 0.8;
    m.cbox(0, y0, 0, t, len, t, 'dead_wood', { rot: { y: a, x: tilt, pivot: [0, y0, 0] } });
    const ex = Math.sin(a) * Math.sin(tilt) * len;
    const ez = Math.cos(a) * Math.sin(tilt) * len;
    const ey = y0 + Math.cos(tilt) * len;
    m.cbox(ex, ey - 1, ez, t * 0.6, len * 0.6, t * 0.6, 'dead_wood', { rot: { y: a + rr(r, -0.9, 0.9), x: tilt - 0.4, pivot: [ex, ey - 1, ez] } });
    m.cbox(ex, ey - 1, ez, t * 0.5, len * 0.5, t * 0.5, 'dead_wood', { rot: { y: a + rr(r, 1.2, 2), x: tilt + 0.3, pivot: [ex, ey - 1, ez] } });
  }
  m.cbox(0, h, 0, 4 * k + 1, 10 * k, 4 * k + 1, 'dead_wood', { rot: { z: 0.2, pivot: [0, h, 0] } });
  return m;
}

function stump(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const k = [1, 0.75, 0.6][ctx.variant % 3];
  const w = 18 * k;
  const h = 12 * k;
  m.cbox(0, 0, 0, w, h, w, { side: 'dead_wood', top: 'dead_wood_end', bottom: 'dead_wood' });
  // broken jagged rim
  for (let i = 0; i < 3; i++) m.cbox(rr(r, -w * 0.3, w * 0.3), h, rr(r, -w * 0.3, -w * 0.1), rr(r, 3, 6) * k, rr(r, 2, 6) * k, 3 * k, 'dead_wood');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28 + 0.4 + rr(r, -0.3, 0.3);
    const d = w / 2 + 2;
    m.cbox(Math.cos(a) * d, 0, Math.sin(a) * d, 6 * k, 4 * k, 6 * k, 'dead_wood', { rot: { y: a } });
  }
  m.box(-w / 2 - 0.2, 0, w / 2 - 0.1, w * 0.6, h * 0.5, 0.4, 'moss_tree', { bevel: 0 });
  if (ctx.variant === 0) mushroom(m, w / 2 + 2, w / 2 - 2, 5, 'cap_brown', r);
  grassPatch(m, 3, w * 0.8, 7, 'grass_blades', r);
  return m;
}

function fallenTree(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const len = [56, 40, 30][ctx.variant % 3];
  const d = 14;
  const logTex = { side: 'dead_wood', px: 'dead_wood_end', nx: 'dead_wood_end' };
  // the log lies along x; rotate the bark ridges by using the plank-like dead_wood on its sides
  m.box(-len / 2, 0, -d / 2, len, d, d, logTex, { rot: { y: 0.15 } });
  // a broken-off end piece
  if (ctx.variant === 0) m.box(len / 2 + 3, 0, -4, 14, 10, 10, logTex, { rot: { y: -0.4, pivot: [len / 2 + 3, 0, 0] } });
  // branch stubs
  for (let i = 0; i < 3; i++) {
    const x = rr(r, -len / 2 + 6, len / 2 - 6);
    m.cbox(x, d - 1, rr(r, -3, 3), 3, rr(r, 5, 9), 3, 'dead_wood', { rot: { z: rr(r, -0.6, 0.6), x: rr(r, -0.4, 0.4) } });
  }
  m.box(-len / 2 + 4, d - 0.2, -d / 2 + 1, len * 0.4, 0.6, d - 2, 'moss', { bevel: 0, rot: { y: 0.15, pivot: [0, 0, 0] } });
  m.box(-len / 2, 0, d / 2 + 0.1, len * 0.5, 6, 0.4, 'moss_tree', { bevel: 0, rot: { y: 0.15, pivot: [0, 0, 0] } });
  if (ctx.variant !== 2) mushroom(m, rr(r, -10, 10), d / 2 + 3, 4, 'cap_brown', r);
  grassPatch(m, 4, len * 0.5, 7, 'grass_blades_dry', r);
  return m;
}

// ---------------------------------------------------------------- 8. swamp

function cattailProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const n = [5, 3, 2][ctx.variant % 3];
  for (let i = 0; i < n; i++) cattail(m, rr(r, -7, 7), rr(r, -7, 7), rr(r, 20, 32), r);
  grassPatch(m, 2, 6, 10, 'grass_blades_swamp', r, 1.4);
  return m;
}

function reedsProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const n = [9, 5, 3][ctx.variant % 3];
  for (let i = 0; i < n; i++) {
    const x = rr(r, -8, 8);
    const z = rr(r, -8, 8);
    const h = rr(r, 18, 32);
    m.cbox(x, 0, z, 1.4, h, 1.4, 'reed', { bevel: 0, anim: sway(x, 0, z, 0.012, 1.5) });
  }
  grassPatch(m, 3, 7, 14, 'grass_blades_swamp', r, 1.6);
  return m;
}

function lilyPads(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const n = [4, 2, 1][ctx.variant % 3];
  for (let i = 0; i < n; i++) lilyPad(m, rr(r, -9, 9), rr(r, -9, 9), rr(r, 8, 12), r);
  return m;
}

function lilyFlowerProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  lilyPad(m, 0, 0, 13, r);
  lilyFlower(m, 0, 0, r, 1.1);
  if (ctx.variant !== 2) lilyPad(m, 10, -6, 9, r);
  if (ctx.variant === 0) lilyPad(m, -8, 8, 8, r);
  return m;
}

function algaeProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const n = [5, 3, 2][ctx.variant % 3];
  for (let i = 0; i < n; i++) {
    const x = rr(r, -8, 8);
    const z = rr(r, -8, 8);
    const h = rr(r, 10, 20);
    const a = r() * 3;
    const an: Anim = { kind: 'sway', pivot: [x, 0, z], amp: 0.02, speed: 0.9, phase: r() * 6 };
    m.cbox(x, 0, z, 8, h, 0.3, 'algae', { bevel: 0, rot: { y: a, pivot: [x, 0, z] }, anim: an });
    m.cbox(x, 0, z, 8, h, 0.3, 'algae', { bevel: 0, rot: { y: a + 1.57, pivot: [x, 0, z] }, anim: an });
  }
  return m;
}

// ---------------------------------------------------------------- 9. biomes

function biomeForest(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  bush(m, -4, -4, 24, 18, r);
  bush(m, 9, 4, 16, 11, r, 'leaf_bush_light', 'leaf_bush');
  fernClump(m, -9, 9, 12, r);
  grassPatch(m, 3, 14, 8, 'grass_blades', r);
  return m;
}

function biomeMountain(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  stoneBlock(m, -5, 0, -5, 16, 14, 14);
  stoneBlock(m, 7, 0, -6, 10, 22, 10);
  stone(m, 9, 0, 8, 7, r, 'stone_smooth');
  bush(m, -7, 8, 12, 9, r, 'leaf_bush_dark', 'leaf_bush_dark');
  grassPatch(m, 4, 13, 8, 'grass_blades_dry', r);
  return m;
}

function biomeValley(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  bush(m, -3, -3, 22, 15, r, 'leaf_bush_light', 'leaf_bush');
  blossoms(m, -3, -3, 22, 15, 8, 'pink', r);
  for (const [x, z, c] of [[8, 8, 'white'], [-9, 9, 'pink'], [11, -2, 'red'], [2, 11, 'yellow']] as const) flower(m, x, 0, z, c, rr(r, 4, 8), 3.5);
  grassPatch(m, 4, 14, 8, 'grass_blades_field', r);
  return m;
}

function cactus(m: Model, x: number, z: number, h: number, r: R) {
  m.cbox(x, 0, z, 7, h, 7, { side: 'cactus', end: 'leaf_bush_light' });
  const arms = [[-1, 0.4], [1, 0.6]];
  for (const [s, f] of arms) {
    if (r() < 0.2) continue;
    const y = h * f;
    m.cbox(x + s * 6, y, z, 5, 4, 5, 'cactus');
    m.cbox(x + s * 7, y + 2, z, 5, h * 0.3, 5, { side: 'cactus', end: 'leaf_bush_light' });
  }
  m.cbox(x, h, z, 3, 2, 3, 'petal_pink', { bevel: 0 });
}

function biomeDesert(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 34, 0.6, 30, 'sand', { bevel: 0 });
  cactus(m, -3, -4, 26, r);
  if (ctx.variant !== 2) cactus(m, 10, 6, 14, r);
  twigs(m, -10, 8, 10, r, 'twig_dry', 5);
  grassPatch(m, 3, 13, 8, 'grass_blades_desert', r);
  stone(m, 11, 0, -8, 5, r, 'sandstone');
  return m;
}

function biomeSnow(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 34, 1.2, 30, 'snow', { bevel: 0.5 });
  for (let i = 0; i < 4; i++) m.cbox(rr(r, -14, 14), 1, rr(r, -12, 12), rr(r, 4, 9), rr(r, 1, 3), rr(r, 4, 8), 'snow', { bevel: 0.5 });
  // a small snow-covered pine
  trunk(m, 8, -6, 4, 12, 'bark_pine', r, { roots: 0, branches: 0 });
  crown(m, 8, -6, [{ y: 8, n: 1, h: 0.8, gap: 0.3 }, { y: 18, n: 1, h: 0.7, gap: 0.5 }, { y: 27, n: 0, h: 0.9 }], 'leaf_snowy', 'leaf_snowy', r, 9);
  // a bare snowy shrub
  twigs(m, -8, 4, 18, r, 'dead_wood', 7, 1);
  for (let i = 0; i < 5; i++) m.cbox(-8 + rr(r, -5, 5), rr(r, 6, 14), 4 + rr(r, -5, 5), 2, 1, 2, 'snow', { bevel: 0, noAO: true });
  return m;
}

// ---------------------------------------------------------------- 10. vines & ivy

function ivyWall(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // a ruined stone wall piece: blocks of 16
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 2; x++) if (!(y === 2 && x === 1 && ctx.variant !== 0)) m.box(-16 + x * 16, y * 16, -6, 16, 16, 12, y === 0 ? 'stone_mossy' : 'stone', { uv: [x * 5, y * 3] });
  // ivy sheets on the front and the side
  m.box(-15, 4, 6.1, 14, 42, 0.3, 'ivy_leaf', { bevel: 0 });
  m.box(-3, 10, 6.15, 12, 36, 0.3, 'ivy_leaf', { bevel: 0, uv: [6, 2] });
  m.box(16.1, 2, -5, 0.3, 30, 10, 'ivy_leaf', { bevel: 0 });
  for (let i = 0; i < 8; i++) m.cbox(rr(r, -14, 12), rr(r, 4, 44), 6.6, rr(r, 2, 4), rr(r, 2, 4), 1.5, 'leaf_oak', { bevel: 0 });
  strand(m, -8, 48, 6.3, 18, 'ivy_leaf', 5);
  return m;
}

/** Hanging plants from a mossy stone lintel (~4 blocks up). */
function hanging(kind: 'ivy' | 'liana' | 'leafy' | 'flower') {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const top = 60;
    m.cbox(0, top, 0, 34, 8, 12, { side: 'stone_mossy', top: 'moss' }, { noAO: true });
    m.cbox(0, top + 7.5, 0, 30, 1, 10, 'moss', { bevel: 0, noAO: true });
    const n = [5, 4, 3][ctx.variant % 3];
    for (let i = 0; i < n; i++) {
      const x = -14 + (i + 0.5) * (28 / n) + rr(r, -1.5, 1.5);
      const len = rr(r, 26, 52);
      if (kind === 'ivy') {
        strand(m, x, top, 6.3, len, 'ivy_leaf', 6);
        m.cbox(x, top - len, 6.5, 3, 3, 1.5, 'leaf_oak', { bevel: 0, noAO: true });
      } else {
        liana(m, x, top, 6.5, len, r);
        if (kind !== 'liana') strand(m, x, top, 6.8, len * 0.9, 'vine_leaves', 6);
        if (kind === 'flower') for (let j = 0; j < 3; j++) {
          const yy = top - rr(r, 6, len * 0.9);
          m.cbox(x + rr(r, -2, 2), yy, 7.2, 3.5, 3.5, 1, ['petal_pink', 'petal_white', 'petal_pink'][j], { bevel: 0, noAO: true, anim: { kind: 'swing', pivot: [x, top, 6.5], axis: [1, 0, 0], amp: 0.05, speed: 1.2 } });
        }
      }
    }
    return m;
  };
}

// ---------------------------------------------------------------- 11. decorative combos

function comboFlowerStone(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  stoneBlock(m, 4, 0, -4, 18, 14, 16);
  stone(m, -10, 0, -6, 8, r, 'stone_smooth');
  bush(m, -6, 6, 20, 13, r);
  blossoms(m, -6, 6, 20, 13, 10, 'pink', r);
  flower(m, 10, 0, 9, 'white', 5, 3);
  grassPatch(m, 3, 14, 7, 'grass_blades', r);
  return m;
}

function comboGrassStone(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  stoneBlock(m, -2, 0, -3, 18, 16, 18);
  stoneBlock(m, 8, 0, 8, 10, 8, 10, false);
  grassPatch(m, 8, 16, 11, 'grass_blades_tall', r);
  return m;
}

function comboFenceBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (const x of [-16, 16]) m.cbox(x, 0, -6, 4, 22, 4, { side: 'plank_v_dark', end: 'wood_end' });
  for (const y of [7, 15]) m.box(-18, y, -7, 36, 3, 2, 'plank_dark');
  bush(m, -4, 2, 22, 16, r);
  bush(m, 10, 4, 14, 10, r, 'leaf_bush_light', 'leaf_bush');
  grassPatch(m, 4, 16, 8, 'grass_blades', r);
  return m;
}

function comboWaterPlants(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 4, 36, 0.8, 22, 'water_still', { bevel: 0, glow: 0.1 });
  for (const x of [-17, 17]) m.cbox(x, 0, 4, 4, 2, 24, 'stone_mossy');
  for (let i = 0; i < 4; i++) cattail(m, rr(r, -14, -4), rr(r, -10, -6), rr(r, 18, 28), r);
  lilyPad(m, 4, 6, 9, r, 1);
  lilyPad(m, -6, 10, 7, r, 1);
  lilyFlower(m, 4, 6, r, 1.5);
  grassPatch(m, 4, 8, 10, 'grass_blades_swamp', r, 1.3);
  return m;
}

function comboStepsBush(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 3; i++) m.box(-4 + i * 0, i * 8, -14 + i * 9, 24, 8, 28 - i * 9, i === 0 ? 'stone_mossy' : 'stone', { uv: [i * 4, 0] });
  bush(m, -12, 6, 16, 14, r);
  bush(m, -12, -8, 14, 18, r, 'leaf_bush_dark', 'leaf_bush_dark');
  grassPatch(m, 3, 10, 7, 'grass_blades', r);
  flower(m, 22, 0, 10, 'white', 4, 3);
  return m;
}

// ---------------------------------------------------------------- registry

const V = 'vegetation' as const;
const s1: [number, number] = [1, 1];

export const VEGETATION_PROPS: PropDef[] = [
  // 1. bushes
  { id: 'bush_low', name: 'Низкий куст', category: V, size: s1, solid: false, variants: 3, tags: ['forest'], build: bushProp('low') },
  { id: 'bush_mid', name: 'Средний куст', category: V, size: s1, solid: true, variants: 3, tags: ['forest'], build: bushProp('mid') },
  { id: 'bush_tall', name: 'Высокий куст', category: V, size: s1, solid: true, variants: 3, tags: ['forest'], build: bushProp('tall') },
  { id: 'bush_berry', name: 'Ягодный куст', category: V, size: s1, solid: true, variants: 3, tags: ['forest'], build: berryBush },
  { id: 'bush_flower', name: 'Цветущий куст', category: V, size: s1, solid: true, variants: 3, tags: ['forest', 'valley'], build: floweringBush },
  { id: 'bush_dry', name: 'Сухой куст', category: V, size: s1, solid: false, variants: 3, tags: ['dry', 'desert'], build: dryBush },
  // 2. growth stages
  { id: 'bush_growth', name: 'Стадии роста куста', category: V, size: s1, solid: false, variants: 6, tags: ['forest'], build: growthStage },
  // 3. grass
  { id: 'grass_low', name: 'Низкая трава', category: V, size: s1, solid: false, variants: 3, tags: ['grass'], build: grassProp('grass_blades', 6, 9, 7, 0.8) },
  { id: 'grass_mid', name: 'Средняя трава', category: V, size: s1, solid: false, variants: 3, tags: ['grass'], build: grassProp('grass_blades', 6, 9, 12, 1.1) },
  { id: 'grass_tall', name: 'Высокая трава', category: V, size: s1, solid: false, variants: 3, tags: ['grass'], build: grassProp('grass_blades_tall', 6, 9, 14, 1.6) },
  { id: 'grass_dry', name: 'Сухая трава', category: V, size: s1, solid: false, variants: 3, tags: ['grass', 'dry'], build: grassProp('grass_blades_dry', 6, 9, 12, 1.1, (m, r) => twigs(m, 0, 0, 10, r, 'twig_dry', 4)) },
  {
    id: 'grass_field', name: 'Полевая трава', category: V, size: s1, solid: false, variants: 3, tags: ['grass', 'valley'],
    build: grassProp('grass_blades_field', 6, 9, 12, 1.2, (m, r) => {
      for (let i = 0; i < 3; i++) flower(m, rr(r, -8, 8), 0, rr(r, -8, 8), i === 1 ? 'purple' : 'white', rr(r, 7, 11), 2.5);
    }),
  },
  // 4. flowers
  ...(['white', 'yellow', 'red', 'blue', 'purple', 'pink'] as const).map((c, i): PropDef => ({
    id: 'flowers_' + c,
    name: ['Белые', 'Жёлтые', 'Красные', 'Синие', 'Фиолетовые', 'Розовые'][i] + ' цветы',
    category: V,
    size: s1,
    solid: false,
    variants: 3,
    tags: ['flowers'],
    build: flowersProp(c),
  })),
  // 5. ferns and leaves
  { id: 'fern', name: 'Папоротник', category: V, size: s1, solid: false, variants: 3, tags: ['forest'], build: fernProp },
  { id: 'leaf_broad', name: 'Широкий лист', category: V, size: s1, solid: false, variants: 3, tags: ['forest'], build: broadLeaf },
  { id: 'leaf_tropical', name: 'Тропический лист', category: V, size: s1, solid: false, variants: 3, tags: ['jungle'], build: tropicLeaf },
  { id: 'palm_bush', name: 'Пальмовый куст', category: V, size: s1, solid: true, variants: 3, tags: ['jungle'], build: palmBush },
  { id: 'undergrowth', name: 'Подлесок', category: V, size: [2, 2], solid: false, tags: ['forest'], build: undergrowth },
  // 6. berries, mushrooms, fruit
  { id: 'berries_red', name: 'Красные ягоды', category: V, size: s1, solid: false, variants: 3, tags: ['forest', 'pickup'], build: berriesProp('berry_red') },
  { id: 'berries_blue', name: 'Синие ягоды', category: V, size: s1, solid: false, variants: 3, tags: ['forest', 'pickup'], build: berriesProp('berry_blue') },
  { id: 'mushrooms_small', name: 'Грибы (маленькие)', category: V, size: s1, solid: false, variants: 3, tags: ['forest'], build: mushroomsSmall },
  { id: 'mushrooms_big', name: 'Грибы (большие)', category: V, size: s1, solid: true, variants: 3, tags: ['forest'], build: mushroomsBig },
  { id: 'mushrooms_glow', name: 'Светящиеся грибы', category: V, size: s1, solid: false, variants: 3, tags: ['forest', 'night', 'cave'], build: mushroomsGlow },
  { id: 'forest_fruit', name: 'Лесные плоды', category: V, size: s1, solid: false, variants: 3, tags: ['forest', 'pickup'], build: forestFruit },
  // 7. dry and dead
  { id: 'dead_tree', name: 'Мёртвое дерево', category: V, size: s1, solid: true, variants: 3, tags: ['dry', 'swamp', 'graveyard'], build: deadTree },
  { id: 'stump', name: 'Пень', category: V, size: s1, solid: true, variants: 3, tags: ['forest'], build: stump },
  { id: 'fallen_tree', name: 'Поваленное дерево', category: V, size: [3, 1], solid: true, variants: 3, tags: ['forest'], build: fallenTree },
  // 8. swamp
  { id: 'cattail', name: 'Камыш', category: V, size: s1, solid: false, variants: 3, tags: ['swamp', 'water'], build: cattailProp },
  { id: 'reeds', name: 'Тростник', category: V, size: s1, solid: false, variants: 3, tags: ['swamp', 'water'], build: reedsProp },
  { id: 'lily_pads', name: 'Лилия (листья)', category: V, size: s1, solid: false, variants: 3, tags: ['swamp', 'water'], build: lilyPads },
  { id: 'lily_flower', name: 'Лилия (цветок)', category: V, size: s1, solid: false, variants: 3, tags: ['swamp', 'water'], build: lilyFlowerProp },
  { id: 'algae', name: 'Водоросли', category: V, size: s1, solid: false, variants: 3, tags: ['swamp', 'water'], build: algaeProp },
  // 9. biomes
  { id: 'biome_forest', name: 'Растительность: лес', category: V, size: [2, 2], solid: false, tags: ['forest'], build: biomeForest },
  { id: 'biome_mountain', name: 'Растительность: горы', category: V, size: [2, 2], solid: true, tags: ['mountain'], build: biomeMountain },
  { id: 'biome_valley', name: 'Растительность: долина', category: V, size: [2, 2], solid: false, tags: ['valley'], build: biomeValley },
  { id: 'biome_desert', name: 'Растительность: пустыня', category: V, size: [2, 2], solid: true, variants: 3, tags: ['desert'], build: biomeDesert },
  { id: 'biome_snow', name: 'Растительность: снежный регион', category: V, size: [2, 2], solid: true, tags: ['snow'], build: biomeSnow },
  // 10. vines
  { id: 'ivy_wall', name: 'Плющ на стене', category: V, size: [2, 1], solid: true, variants: 2, tags: ['ruins'], build: ivyWall },
  { id: 'ivy_hanging', name: 'Плющ свисающий', category: V, size: [2, 1], solid: false, variants: 3, tags: ['ruins'], build: hanging('ivy') },
  { id: 'vines', name: 'Лианы', category: V, size: [2, 1], solid: false, variants: 3, tags: ['jungle', 'ruins'], build: hanging('liana') },
  { id: 'vines_leafy', name: 'Лианы с листьями', category: V, size: [2, 1], solid: false, variants: 3, tags: ['jungle', 'ruins'], build: hanging('leafy') },
  { id: 'vines_flowering', name: 'Цветущие лианы', category: V, size: [2, 1], solid: false, variants: 3, tags: ['jungle', 'ruins'], build: hanging('flower') },
  // 11. combos
  { id: 'combo_flower_stone', name: 'Цветущий куст у камня', category: V, size: [2, 2], solid: true, tags: ['forest', 'ruins'], build: comboFlowerStone },
  { id: 'combo_grass_stone', name: 'Трава у камня', category: V, size: [2, 2], solid: true, tags: ['forest', 'ruins'], build: comboGrassStone },
  { id: 'combo_fence_bush', name: 'Куст у забора', category: V, size: [2, 1], solid: true, tags: ['village'], build: comboFenceBush },
  { id: 'combo_water_plants', name: 'Растения у воды', category: V, size: [2, 2], solid: false, tags: ['water', 'swamp'], build: comboWaterPlants },
  { id: 'combo_steps_bush', name: 'Куст у ступеней', category: V, size: [2, 2], solid: true, tags: ['ruins'], build: comboStepsBush },
];
