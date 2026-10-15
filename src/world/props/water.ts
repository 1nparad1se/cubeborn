import { Model, ivy, pick, rr } from './kit';
import { barrel, crate } from './cargo';
import type { BuildCtx, PropDef } from './types';
import '../textures/water';

/**
 * Sheet «Водоёмы»: things standing in or by the water — rocks in water, boulders, lily pads with
 * flowers, reeds/cattails, flooded logs, algae, piers and mooring posts, waterfalls (small / medium
 * / large / river spill) with mist, rapids foam, rocky-coast stacks, beach driftwood, islands.
 *
 * Origin y = 0 is the WATER SURFACE: submerged parts go below 0. Place them with
 * `placeInWater` (src/world/water/carve.ts), which sets y to the cell's water level and passes
 * `params.pool = 0`. Without that param a thin water plate («pool») is drawn under the prop so it
 * reads correctly on dry ground (the props viewer). The water itself (rivers, lakes, depth, shores,
 * waterfall faces) is terrain: see src/world/water/carve.ts and textures/water.ts.
 */

const CELLPX = 24;

/** Water depth shown by the preview plate (px). */
const POOL_DEPTH = 10;

/**
 * Preview water plate under the footprint (skipped in game: params.pool = 0). On dry ground the
 * submerged parts would vanish under the ground plane, so the plate is a POOL_DEPTH-thick water
 * slab standing on the ground and the whole model is lifted onto its top (see `pooled`).
 */
function pool(m: Model, ctx: BuildCtx, sx: number, sz: number, tex = 'wtr_river') {
  if (ctx.params.pool === 0) return;
  (m as Model & { _pool?: [number, number, string] })._pool = [sx, sz, tex];
}

/** Applies the preview pool recorded by `pool`: lifts everything and adds the water slab. */
function pooled(fn: (ctx: BuildCtx) => Model) {
  return (ctx: BuildCtx): Model => {
    const m = fn(ctx) as Model & { _pool?: [number, number, string] };
    const pl = m._pool;
    if (!pl) return m;
    const out = new Model().add(m, 0, POOL_DEPTH, 0);
    const w = pl[0] * CELLPX;
    const d = pl[1] * CELLPX;
    out.box(-w / 2, 0, -d / 2, w, POOL_DEPTH - 0.4, d, { top: pl[2], side: 'wtr_deep', bottom: 'wtr_deep' }, { bevel: 0, noAO: true });
    return out;
  };
}

/** Foam ring at the waterline round a w x d footprint centred on (x, z). */
function foamRing(m: Model, x: number, z: number, w: number, d: number, rnd: () => number) {
  const f = { bevel: 0, noAO: true, glow: 0.15 } as const;
  m.cbox(x, -0.2, z + d / 2 + 1, w + 3, 0.7, 2.5, 'wtr_foam', f);
  m.cbox(x + w / 2 + 1, -0.2, z, 2.5, 0.7, d + 1, 'wtr_foam', f);
  if (rnd() < 0.7) m.cbox(x - w / 2 - 1, -0.2, z, 2, 0.6, d * 0.7, 'wtr_foam', f);
  if (rnd() < 0.7) m.cbox(x, -0.2, z - d / 2 - 1, w * 0.7, 0.6, 2, 'wtr_foam', f);
}

/** A stone block (the sheet's square, slightly worn cubes) rising from `y0` below the water to `top`. */
function rockBlock(m: Model, x: number, z: number, s: number, top: number, rnd: () => number, mossy = true, y0 = -10) {
  const tint = pick(rnd, [0xffffff, 0xeae6f0, 0xd8d4de, 0xf4f0f8]);
  const rot = { y: (rnd() - 0.5) * 0.35 };
  m.cbox(x, y0, z, s, top - y0, s, { side: 'rock_wet', top: mossy && rnd() < 0.6 ? 'rock_wet_mossy' : 'rock_wet', bottom: 'rock_under' }, { tint, rot, bevel: 1.5 });
  // darker wet band just above the waterline
  m.cbox(x, -0.3, z, s + 0.4, 2, s + 0.4, 'rock_under', { rot, bevel: 0, tint: 0xc8d0d8 });
  if (mossy && rnd() < 0.5) m.cbox(x + (rnd() - 0.5) * s * 0.4, top, z + (rnd() - 0.5) * s * 0.4, s * 0.5, 1, s * 0.5, 'moss', { bevel: 0 });
}

// ---------------------------------------------------------------- 11. decorative objects

function rockInWater(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 1, 1);
  if (ctx.variant === 0) {
    rockBlock(m, 0, 0, 14, 7, r);
    foamRing(m, 0, 0, 14, 14, r);
  } else if (ctx.variant === 1) {
    rockBlock(m, -2, 1, 14, 9, r);
    rockBlock(m, -1, 0, 10, 18, r);
    rockBlock(m, 6, 5, 7, 3, r, false);
    foamRing(m, 0, 1, 16, 15, r);
  } else {
    rockBlock(m, -5, -4, 9, 5, r);
    rockBlock(m, 5, -1, 8, 3, r, false);
    rockBlock(m, -1, 6, 7, 2, r, false);
    foamRing(m, 0, 0, 18, 16, r);
  }
  return m;
}

function boulder(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 2, 2);
  // a stack of big cubes like the sheet: two at the base, one or two on top
  rockBlock(m, -6, -4, 18, 16, r);
  rockBlock(m, 9, 4, 16, 10, r);
  rockBlock(m, -2, 8, 14, 7, r, false);
  rockBlock(m, -5, -3, 14, 30, r, true, 14);
  if (ctx.variant === 1) rockBlock(m, -4, -4, 10, 42, r, true, 28);
  else rockBlock(m, 8, 3, 10, 20, r, true, 8);
  foamRing(m, 1, 2, 34, 32, r);
  return m;
}

/** One lily pad: a flat disc with a notch, slightly turned, bobbing on the surface. */
function lilyPad(m: Model, x: number, z: number, s: number, rnd: () => number, flower: boolean) {
  const yaw = rnd() * Math.PI * 2;
  const rot = { y: yaw, pivot: [x, 0, z] as [number, number, number] };
  const from = m.mark;
  const tint = pick(rnd, [0xffffff, 0xe0f0d0, 0xc8e0b8]);
  // disc from three overlapping slabs; a missing wedge on +x
  m.cbox(x - s * 0.1, 0, z, s * 0.8, 0.8, s, 'lily_pad', { rot, tint, bevel: 0.5 });
  m.cbox(x, 0.05, z - s * 0.28, s, 0.8, s * 0.44, 'lily_pad', { rot, tint, bevel: 0.5 });
  m.cbox(x - s * 0.05, 0.02, z + s * 0.08, s * 0.9, 0.8, s * 0.36, 'lily_pad', { rot, tint, bevel: 0.5 });
  if (flower) {
    // water-lily: outer pink petals, inner light petals, yellow heart
    const fx = x - s * 0.15;
    for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) m.cbox(fx + dx, 0.8, z + dz, 3, 2, 3, 'lily_flower', { rot: { y: 0.785, pivot: [fx, 0, z] }, tint: 0xff9ac8, bevel: 0.4 });
    m.cbox(fx, 1.2, z, 4, 3, 4, 'lily_flower', { tint: 0xffc8e0, bevel: 0.4 });
    m.cbox(fx, 3.2, z, 2, 1.2, 2, 'gold', { tint: 0xffe070, bevel: 0, glow: 0.2 });
  }
  m.animate(from, { kind: 'bob', amp: 0.012, speed: 1.2 + rnd(), pivot: [x, 0, z] });
}

function lilies(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 1, 1, 'wtr_lake');
  const n = [3, 5, 4][ctx.variant];
  const flowers = [1, 2, 0][ctx.variant];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : rr(r, 5, 9);
    lilyPad(m, Math.cos(a) * d, Math.sin(a) * d, rr(r, 6, 9), r, i < flowers);
  }
  return m;
}

/** Reed / cattail clump; `tall` scales the stems. */
function reedClump(m: Model, x: number, z: number, rnd: () => number, n: number, tall = 1, cattails = 0.5) {
  for (let i = 0; i < n; i++) {
    const sx = x + rr(rnd, -6, 6);
    const sz = z + rr(rnd, -6, 6);
    const h = rr(rnd, 18, 34) * tall;
    const from = m.mark;
    const tilt = { x: rr(rnd, -0.12, 0.12), z: rr(rnd, -0.12, 0.12), pivot: [sx, -6, sz] as [number, number, number] };
    m.cbox(sx, -6, sz, 1.4, h + 6, 1.4, 'reed_stem', { rot: tilt, bevel: 0 });
    if (rnd() < cattails) {
      m.cbox(sx, h - 9, sz, 2.6, 7, 2.6, 'cattail', { rot: tilt, bevel: 0.4 });
      m.cbox(sx, h - 2, sz, 0.8, 3, 0.8, 'reed_stem', { rot: tilt, bevel: 0 });
    } else {
      // a leaf blade bending out
      m.cbox(sx + 1, h * 0.4, sz, 1, h * 0.55, 2, 'reed_stem', { rot: { z: -0.35, x: tilt.x, pivot: [sx, h * 0.4, sz] }, bevel: 0, tint: 0xd0f0a0 });
    }
    m.animate(from, { kind: 'sway', pivot: [sx, 0, sz], amp: 0.02 + h * 0.0006, speed: 1.4 + rnd() * 0.6 });
  }
  // low leafy base
  for (let i = 0; i < 3; i++) m.cbox(x + rr(rnd, -4, 4), -1, z + rr(rnd, -4, 4), 3, 5, 3, 'reed_stem', { bevel: 0, tint: 0xb8e090 });
}

function reeds(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 1, 1, 'wtr_lake');
  reedClump(m, 0, 0, r, [8, 12, 6][ctx.variant], [1, 1.25, 0.8][ctx.variant], [0.5, 0.7, 0.2][ctx.variant]);
  return m;
}

function algae(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 1, 1, 'wtr_shallow');
  for (let i = 0; i < 6 + ctx.variant * 2; i++) {
    const x = rr(r, -8, 8);
    const z = rr(r, -8, 8);
    const h = rr(r, 6, 14);
    const from = m.mark;
    m.cbox(x, -10, z, 2, h, 2, 'algae', { bevel: 0, tint: pick(r, [0xffffff, 0xc8e0b0]) });
    // tips just breaking the surface
    m.cbox(x + 0.5, -10 + h, z, 1.5, rr(r, 1, 4), 1.5, 'algae', { bevel: 0, tint: 0xd8f0a0 });
    m.animate(from, { kind: 'sway', pivot: [x, -10, z], amp: 0.03, speed: 0.9 + r() });
  }
  return m;
}

/** A log of length `len` px along local x, centred on (x, y, z); `sink` tilts one end under water. */
function log(m: Model, x: number, y: number, z: number, len: number, yaw: number, sink: number, rnd: () => number, s = 6) {
  const rot = { y: yaw, z: sink, pivot: [x, y + s / 2, z] as [number, number, number] };
  m.box(x - len / 2, y, z - s / 2, len, s, s, { side: 'bark_wet', px: 'log_end_wet', nx: 'log_end_wet' }, { rot, bevel: 0.8 });
  // moss strip on top and a broken branch stub
  m.box(x - len * 0.3, y + s, z - s / 4, len * rr(rnd, 0.3, 0.5), 0.8, s / 2, 'moss', { rot, bevel: 0 });
  m.box(x + rr(rnd, -len / 3, len / 3), y + s - 1, z + s / 2 - 1, 2, 2, 5, 'bark_wet', { rot, bevel: 0.4 });
}

function floodedLogs(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 2, 2, 'wtr_swamp');
  const from = m.mark;
  if (ctx.variant === 0) {
    log(m, 0, -3, -4, 44, 0.35, 0.08, r);
    log(m, 2, -1, 6, 38, -0.5, -0.12, r);
    log(m, -8, -4, 2, 22, 1.4, 0.15, r, 5);
  } else {
    // a fallen trunk with a raised root plate and a snapped plank across
    log(m, 0, -3, 0, 46, 0.2, 0.1, r, 7);
    m.cbox(-22, -6, -4, 6, 14, 14, { side: 'bark_wet', end: 'log_end_wet' }, { rot: { y: 0.2 }, bevel: 1 });
    log(m, 6, -2, 8, 28, -0.9, -0.06, r, 4);
  }
  m.animate(from, { kind: 'bob', amp: 0.01, speed: 0.7 });
  return m;
}

// ---------------------------------------------------------------- piers and posts

const pierLen = (p: Record<string, number>) => Math.max(2, Math.round(p.length ?? 4));

/**
 * Pier (причал): planked deck on posts, 2 cells wide, `params.length` cells long along +z (the
 * first cell sits on the shore). Deck at the base level, walkable. Variant 1 adds cargo at the end.
 */
function pier(ctx: BuildCtx): Model {
  const m = new Model();
  const L = pierLen(ctx.params) * CELLPX;
  const W = 2 * CELLPX;
  const z0 = -L / 2;
  // stringers and deck planks across the pier (each 4 px, small gaps, a few missing / darker)
  m.box(-W / 2 + 4, -4, z0, 4, 4, L, 'beam_dark');
  m.box(W / 2 - 8, -4, z0, 4, 4, L, 'beam_dark');
  for (let z = z0; z < z0 + L - 0.1; z += 5) {
    const old = ctx.rnd() < 0.15;
    m.box(-W / 2, 0, z + 0.3, W, 2, 4.4, old ? 'plank_old' : 'plank', { uv: [ctx.rnd() * 16, 0], bevel: 0.6, tint: old ? 0xd8d0c8 : 0xffffff });
  }
  // posts every 2 cells and at the end, standing in the water with wet bases
  for (let z = z0 + 3; z <= z0 + L - 3 + 0.1; z += CELLPX * 2) {
    for (const x of [-W / 2 - 1, W / 2 - 4]) {
      m.box(x, -40, z - 2.5, 5, 46, 5, { side: 'plank_v_dark', end: 'wood_end' });
      m.box(x - 0.2, -40, z - 2.7, 5.4, 34, 5.4, 'bark_wet', { bevel: 0 });
    }
  }
  const ze = z0 + L - 3;
  for (const x of [-W / 2 - 1, W / 2 - 4]) {
    m.box(x, -40, ze - 2.5, 5, 50, 5, { side: 'plank_v_dark', end: 'wood_end' });
    m.box(x - 0.6, 4, ze - 3.1, 6.2, 3, 6.2, 'rope', { bevel: 0 });
  }
  // a low side rail on one side
  m.box(-W / 2 - 0.5, 3, z0 + CELLPX, 3, 2, L - CELLPX - 3, 'beam');
  if (ctx.variant === 1) {
    barrel(m, 8, 0, ze - 9, 14);
    crate(m, -8, 0, ze - 10, 13, 0, 0.2);
    m.cbox(-8, 13, ze - 10, 7, 2, 7, 'rope', { bevel: 0 });
  }
  return m;
}

function mooringPost(ctx: BuildCtx): Model {
  const m = new Model();
  pool(m, ctx, 1, 1);
  m.cbox(0, -30, 0, 6, 44, 6, { side: 'plank_v_dark', end: 'wood_end' });
  m.cbox(0, -30, 0, 6.4, 30, 6.4, 'bark_wet', { bevel: 0 });
  m.cbox(0, 6, 0, 7, 3, 7, 'rope', { bevel: 0 });
  if (ctx.variant === 1) m.cbox(5, 0, 2, 4, 1, 10, 'rope', { rot: { x: 0.3 }, bevel: 0 });
  foamRing(m, 0, 0, 6, 6, ctx.rnd);
  return m;
}

// ---------------------------------------------------------------- 4. waterfalls

interface FallSpec {
  w: number; // water width in px
  h: number; // drop height in px
  cells: [number, number];
}
const FALLS: Record<string, FallSpec> = {
  small: { w: 32, h: 48, cells: [4, 3] },
  medium: { w: 48, h: 80, cells: [5, 3] },
  large: { w: 64, h: 112, cells: [6, 4] },
  spill: { w: 88, h: 32, cells: [6, 3] },
};

/**
 * A free-standing waterfall prop: a cliff of mossy stone blocks with a sheet of falling water in a
 * notch, a river lip on top, foam and spray at the foot. For waterfalls carved into the terrain use
 * carveWaterfall (the ground shader draws those); this prop is for set dressing / cliff faces.
 */
function waterfall(kind: keyof typeof FALLS) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const { w, h, cells } = FALLS[kind];
    const W = cells[0] * CELLPX;
    const D = cells[1] * CELLPX;
    pool(m, ctx, cells[0], cells[1]);
    const back = -D / 2;
    const cliffD = 22;
    const front = back + cliffD;
    // cliff columns of 16 px blocks either side of the notch, ragged heights
    for (let x = -W / 2; x < W / 2 - 0.1; x += 16) {
      const inNotch = x + 16 > -w / 2 + 0.1 && x < w / 2 - 0.1;
      const top = inNotch ? h : h + Math.round(rr(r, -1, 2)) * 16;
      for (let y = -8; y < top; y += 16) {
        const bh = Math.min(16, top - y);
        const tint = pick(r, [0xffffff, 0xe6e2ec, 0xd0ccd6]);
        m.box(x, y, back, 16, bh, cliffD - (inNotch ? 8 : 0), { side: y > top - 20 ? 'rock_wet_mossy' : 'rock_wet', top: 'rock_wet_mossy' }, { tint, bevel: 1.5 });
      }
      // stepping blocks jutting out in front of the cliff at the sides
      if (!inNotch && r() < 0.7) m.box(x + rr(r, 0, 4), -8, front, 12, 8 + Math.round(rr(r, 0, 2)) * 8, rr(r, 8, 16), 'rock_wet', { bevel: 1.5 });
      if (!inNotch) ivy(m, x + 8, h * 0.3, h, front + 0.5, r, 'pz', 4);
    }
    // grass / bushes on the cliff top
    for (let x = -W / 2 + 4; x < W / 2; x += rr(r, 8, 14)) if (r() < 0.6) m.cbox(x, h + 14, back + rr(r, 4, 16), rr(r, 6, 10), rr(r, 4, 8), rr(r, 6, 10), 'leaves', { anim: { kind: 'sway', amp: 0.008, speed: 1.3 } });
    // river lip on top of the notch and the falling sheet (several slabs at slightly different
    // depths so the streaks read as lanes; streak animation is in the texture + drips)
    m.box(-w / 2, h - 3, back, w, 3, cliffD - 6, { top: 'wtr_fast', side: 'wtr_fall' }, { bevel: 0, glow: 0.25, noAO: true });
    const zf = front - 7;
    const lanes = Math.max(2, Math.round(w / 12));
    for (let i = 0; i < lanes; i++) {
      const lw = w / lanes;
      const dz = (i % 2) * 1.2 + rr(r, 0, 0.8);
      m.box(-w / 2 + i * lw, -1, zf + dz, lw + 0.2, h, 3, 'wtr_fall', { uv: [i * 5, r() * 16], bevel: 0, glow: 0.12, noAO: true });
    }
    // a curl at the lip
    m.box(-w / 2, h - 5, zf - 0.5, w, 5, 5, 'wtr_foam', { bevel: 0, glow: 0.3, noAO: true });
    // churning foam at the foot, a little higher in the middle
    const foot = zf + 8;
    m.cbox(0, -1, foot, w + 10, 2.5, 14, 'wtr_foam', { bevel: 0, glow: 0.25, noAO: true });
    for (let i = 0; i < 5; i++) m.cbox(rr(r, -w / 2, w / 2), 0, foot + rr(r, -4, 10), rr(r, 4, 9), rr(r, 1.5, 4), rr(r, 4, 9), 'wtr_foam', { bevel: 0, glow: 0.3, noAO: true, anim: { kind: 'bob', amp: 0.03, speed: 4 + r() * 3 } });
    // a couple of rocks at the foot
    for (let i = 0; i < 2 + (kind === 'large' ? 2 : 0); i++) rockBlock(m, rr(r, -W / 2 + 8, W / 2 - 8) * (i % 2 ? 1 : -1), foot + rr(r, 4, D / 2 - foot - 4), rr(r, 7, 12), rr(r, 3, 8), r);
    // spray and falling drops
    m.emit({ kind: 'mist', x: 0, y: 2, z: foot, count: Math.round(6 + w / 6), spread: w * 0.6, height: 12 + h * 0.25, size: 6 + w / 16 });
    m.emit({ kind: 'drips', x: 0, y: h, z: zf + 3, count: Math.round(w / 4), spread: w / 2, height: h, size: 1.6, color: 0xeaf6ff });
    return m;
  };
}

/** Spray only: mist and foam where a carved waterfall lands (placed by carveWaterfall). */
function waterfallMist(ctx: BuildCtx): Model {
  const m = new Model();
  const w = (ctx.params.width ?? 3) * CELLPX;
  const drop = (ctx.params.drop ?? 3) * CELLPX;
  m.emit({ kind: 'mist', x: 0, y: 2, z: 0, count: Math.round(6 + w / 6), spread: w * 0.6, height: 12 + drop * 0.3, size: 6 + w / 16 });
  for (let i = 0; i < 4; i++) m.cbox(rr(ctx.rnd, -w / 3, w / 3), 0, rr(ctx.rnd, -6, 6), rr(ctx.rnd, 4, 9), 2, rr(ctx.rnd, 4, 9), 'wtr_foam', { bevel: 0, glow: 0.3, noAO: true, anim: { kind: 'bob', amp: 0.03, speed: 5 } });
  return m;
}

// ---------------------------------------------------------------- 3 / 6 / 8. rivers, coast, transitions

/** Rapids (быстрая / горная река): white streaks and foam around low rocks, along local x. */
function rapids(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 2, 1, 'wtr_fast');
  for (let i = 0; i < 9; i++) {
    const z = rr(r, -10, 10);
    m.cbox(rr(r, -18, 18), 0, z, rr(r, 8, 18), 0.8, rr(r, 1.5, 3), 'wtr_foam', { bevel: 0, glow: 0.2, noAO: true, anim: { kind: 'bob', amp: 0.01, speed: 3 + r() * 2 } });
  }
  for (let i = 0; i < 2 + ctx.variant; i++) rockBlock(m, rr(r, -16, 16), rr(r, -7, 7), rr(r, 6, 10), rr(r, 2, 6), r, false);
  return m;
}

/** Rocky coast stack (скалистое побережье): tall weathered blocks with surf. */
function coastRocks(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 2, 2, 'wtr_sea');
  const cols: [number, number, number, number][] = ctx.variant === 0
    ? [[-8, -8, 18, 54], [9, -6, 16, 38], [-6, 9, 16, 22], [10, 10, 12, 10]]
    : [[-6, -6, 20, 36], [10, 2, 14, 24], [-9, 10, 12, 12]];
  for (const [x, z, s, top] of cols) {
    rockBlock(m, x, z, s, Math.min(top, 16), r, false);
    for (let y = 16; y < top; y += 16) rockBlock(m, x + rr(r, -1, 1), z + rr(r, -1, 1), s - 2, Math.min(top, y + 16), r, y + 16 >= top, y);
  }
  // grass tuft on the highest block
  m.cbox(-8, cols[0][3], -8, 10, 3, 10, 'grass_top', { bevel: 0 });
  foamRing(m, 0, 0, 40, 40, r);
  m.emit({ kind: 'mist', x: 4, y: 1, z: 18, count: 4, spread: 18, height: 8, size: 5 });
  return m;
}

/** Bleached driftwood on a beach (песчаный пляж), crossed with a plank. */
function driftwood(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const rot = { y: 0.25 };
  m.cbox(0, 0, 0, 40, 5, 5, { side: 'beam_old', end: 'wood_end' }, { rot, tint: 0xe8e0d0 });
  m.cbox(6, 2, 3, 6, 3, 3, 'beam_old', { rot: { y: 1.2 }, tint: 0xe8e0d0 });
  if (ctx.variant === 1) m.cbox(-4, 0, 2, 5, 3, 30, 'plank_old', { rot: { y: -0.5 }, tint: 0xf0e8dc });
  for (let i = 0; i < 3; i++) m.cbox(rr(r, -16, 16), 0, rr(r, -8, 8), 3, 1.5, 3, 'stone_smooth', { tint: 0xd8d0c8 });
  return m;
}

/** Small island (переход «с островами»): a grassy block with reeds poking out of the water. */
function island(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pool(m, ctx, 2, 2, 'wtr_shallow');
  const top = ctx.variant === 1 ? 10 : 4;
  m.cbox(0, -10, 0, 26, top + 10, 22, { side: 'dirt', top: 'grass_top', bottom: 'mud' }, { bevel: 1.5 });
  m.cbox(-6, top, -3, 12, 2, 10, 'grass_top', { bevel: 0.5 });
  m.cbox(8, -10, 8, 10, 10, 8, { side: 'mud', top: 'grass_top' });
  const rm = new Model();
  reedClump(rm, -4, -2, r, 5, 0.9, 0.5);
  m.add(rm, 0, top + 6, 0);
  foamRing(m, 0, 0, 26, 22, r);
  return m;
}

/** Pebbles and a flat stone at the waterline (каменная кромка). */
function shoreStones(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 5 + ctx.variant * 2; i++) {
    const s = rr(r, 3, 7);
    m.cbox(rr(r, -9, 9), -1, rr(r, -9, 9), s, rr(r, 2, 4), s * rr(r, 0.7, 1.2), 'rock_wet', { tint: pick(r, [0xffffff, 0xd8d4de, 0xc0bcc8]), rot: { y: r() }, bevel: 0.8 });
  }
  return m;
}

const W = (p: Omit<PropDef, 'category'>): PropDef => ({ ...p, category: 'water' });

export const WATER_PROPS: PropDef[] = [
  W({ id: 'rock_in_water', name: 'Камни в воде', size: [1, 1], solid: false, variants: 3, tags: ['water', 'river'], build: pooled(rockInWater) }),
  W({ id: 'boulder_water', name: 'Валуны', size: [2, 2], solid: false, variants: 2, tags: ['water'], build: pooled(boulder) }),
  W({ id: 'water_lilies', name: 'Кувшинки', size: [1, 1], solid: false, variants: 3, tags: ['water', 'lake', 'swamp'], build: pooled(lilies) }),
  W({ id: 'water_reeds', name: 'Тростник', size: [1, 1], solid: false, variants: 3, tags: ['water', 'shore', 'swamp'], build: pooled(reeds) }),
  W({ id: 'water_algae', name: 'Водоросли', size: [1, 1], solid: false, variants: 2, tags: ['water'], build: pooled(algae) }),
  W({ id: 'flooded_logs', name: 'Затопленные брёвна', size: [2, 2], solid: false, variants: 2, tags: ['water', 'swamp'], build: pooled(floodedLogs) }),
  W({
    id: 'water_pier',
    name: 'Причал',
    size: (p) => [2, pierLen(p)],
    solid: false,
    variants: 2,
    tags: ['water', 'coast', 'walkable'],
    deck: () => 0,
    build: pier,
  }),
  W({ id: 'mooring_post', name: 'Швартовая тумба', size: [1, 1], solid: false, variants: 2, tags: ['water', 'coast'], build: pooled(mooringPost) }),
  W({ id: 'waterfall_small', name: 'Водопад малый', size: FALLS.small.cells, solid: true, tags: ['water', 'waterfall'], build: pooled(waterfall('small')) }),
  W({ id: 'waterfall_medium', name: 'Водопад средний', size: FALLS.medium.cells, solid: true, tags: ['water', 'waterfall'], build: pooled(waterfall('medium')) }),
  W({ id: 'waterfall_large', name: 'Водопад большой', size: FALLS.large.cells, solid: true, tags: ['water', 'waterfall'], build: pooled(waterfall('large')) }),
  W({ id: 'waterfall_spill', name: 'Слив водопада', size: FALLS.spill.cells, solid: true, tags: ['water', 'waterfall', 'river'], build: pooled(waterfall('spill')) }),
  W({ id: 'waterfall_mist', name: 'Брызги водопада', size: [1, 1], solid: false, tags: ['water', 'waterfall'], build: pooled(waterfallMist) }),
  W({ id: 'water_rapids', name: 'Пороги', size: [2, 1], solid: false, variants: 2, tags: ['water', 'river'], build: pooled(rapids) }),
  W({ id: 'coast_rocks', name: 'Скалистое побережье', size: [2, 2], solid: false, variants: 2, tags: ['water', 'coast'], build: pooled(coastRocks) }),
  W({ id: 'water_driftwood', name: 'Плавник на пляже', size: [2, 1], solid: false, variants: 2, tags: ['coast', 'beach'], build: pooled(driftwood) }),
  W({ id: 'water_island', name: 'Островок', size: [2, 2], solid: false, variants: 2, tags: ['water', 'swamp'], build: pooled(island) }),
  W({ id: 'shore_stones', name: 'Береговая галька', size: [1, 1], solid: false, variants: 2, tags: ['shore'], build: pooled(shoreStones) }),
];
