import '../textures/camps';
import { Rng } from '../../core/Rng';
import type { Terrain } from '../../game/Terrain';
import { Model, flame, lantern, rr, stone, FIRE_LIGHT } from './kit';
import { barrel, crate, sack } from './cargo';
import { footprintSize, placeAlong, placeProp } from './place';
import type { BuildCtx, PropDef, TexSpec } from './types';

/**
 * Лагеря (лист 5): camp structures (tents, canopy, hut, watchtower, palisade, gate, stone tower,
 * campfire, platform, forge, storehouse, shed) and camp decor (banners, torch, cauldron tripod,
 * crates, barrels, sacks, cart, stakes, training dummy, cage, weapon rack, skull trophy, planks,
 * stones, ladder, table and chairs). Variants follow the four camp kinds of the sheet
 * (bandit red / orc hide and bone / forest green / abandoned torn and mossy).
 * `placeCamp` composes a whole camp of a kind and size from these props.
 */

type V3 = [number, number, number];
const CAT = 'camps' as const;

/** Tent canvas per variant: 0 bandit red, 1 light canvas, 2 forest green, 3 orc hide, 4 torn. */
const CANVAS = ['camp_canvas_red', 'camp_canvas_white', 'camp_canvas_green', 'camp_canvas_hide', 'camp_canvas_torn'];
/** Banner per variant: 0 bandit, 1 orc, 2 forest, 3 torn. */
const BANNERS = ['camp_banner_bandit', 'camp_banner_orc', 'camp_banner_forest', 'camp_banner_torn'];
const LOG: TexSpec = { side: 'camp_log', end: 'log_end' };
const BEAM: TexSpec = { side: 'beam', end: 'wood_end' };
const BEAM_D: TexSpec = { side: 'beam_dark', end: 'wood_end' };

// ---------------------------------------------------------------- helpers

/** A thin box from point a to point b (ropes, poles, braces, stakes). */
function line(m: Model, a: V3, b: V3, t: number, tex: TexSpec, o: { tint?: number; anim?: Model['parts'][number]['anim']; bevel?: number } = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const ax = Math.acos(Math.max(-1, Math.min(1, dy / len)));
  const ay = Math.atan2(dx, dz);
  return m.cbox(a[0], a[1], a[2], t, len, t, tex, { rot: { x: ax, y: ay, pivot: a }, ...o });
}

/**
 * Ridge roof / tent: ridge along z (length L) at height y0+H over cx, eaves half-width `half`
 * on both sides of x. Gables at both z ends (front one optionally with a dark doorway).
 */
function ridge(m: Model, cx: number, y0: number, cz: number, L: number, half: number, H: number, tex: TexSpec, o: { gable?: TexSpec | null; door?: boolean; th?: number; tint?: number; overhang?: number } = {}) {
  const th = o.th ?? 1.5;
  const S = Math.hypot(half, H) + (o.overhang ?? 0);
  const a = Math.atan2(H, half);
  const piv: V3 = [cx, y0 + H, cz];
  m.box(cx, y0 + H - th, cz - L / 2, S, th, L, tex, { rot: { z: -a, pivot: piv }, tint: o.tint });
  m.box(cx - S, y0 + H - th, cz - L / 2, S, th, L, tex, { rot: { z: a, pivot: piv }, tint: o.tint });
  if (o.gable !== null) {
    const g = o.gable ?? tex;
    for (const s of [-1, 1]) {
      const z = s > 0 ? cz + L / 2 - 2.5 : cz - L / 2 + 1;
      for (let yy = 0; yy < H - 1; yy += 2) {
        const w = 2 * half * (1 - (yy + 1) / H);
        if (w > 0.5) m.box(cx - w / 2, y0 + yy, z, w, 2, 1.5, g, { bevel: 0, tint: o.tint });
      }
    }
  }
  if (o.door) m.box(cx - half * 0.32, y0, cz + L / 2 - 2.2, half * 0.64, H * 0.62, 1, 'coal', { bevel: 0, tint: 0x404040 });
}

/** Sharpened stake standing at (x, z), height h, width w, with a stepped point. */
function stake(m: Model, x: number, y: number, z: number, h: number, w: number, tip: TexSpec = LOG, lean = 0, leanY = 0) {
  const rot = lean ? { x: lean, y: leanY, pivot: [x, y, z] as V3 } : undefined;
  m.cbox(x, y, z, w, h, w, LOG, { rot });
  m.cbox(x, y + h, z, w * 0.7, w * 0.6, w * 0.7, tip, { rot });
  m.cbox(x, y + h + w * 0.6, z, w * 0.4, w * 0.6, w * 0.4, tip, { rot });
  m.cbox(x, y + h + w * 1.2, z, w * 0.18, w * 0.4, w * 0.18, tip, { rot, bevel: 0 });
}

function skull(m: Model, x: number, y: number, z: number, s = 1, horns = false) {
  m.cbox(x, y, z, 6 * s, 6 * s, 6 * s, 'bone');
  m.box(x - 2.2 * s, y + 2.5 * s, z + 3 * s - 0.4, 1.6 * s, 1.6 * s, 0.6, 'coal', { bevel: 0 });
  m.box(x + 0.6 * s, y + 2.5 * s, z + 3 * s - 0.4, 1.6 * s, 1.6 * s, 0.6, 'coal', { bevel: 0 });
  m.cbox(x, y - 2 * s, z + 0.5 * s, 4 * s, 2 * s, 4 * s, 'bone');
  if (horns) for (const sx of [-1, 1]) line(m, [x + sx * 3 * s, y + 4 * s, z], [x + sx * 7 * s, y + 9 * s, z - 1], 1.6 * s, 'bone');
}

/** Hanging banner cloth (w x h px) from a crossbar at (x, top, z), facing +z. */
function bannerCloth(m: Model, x: number, top: number, z: number, w: number, h: number, v: number) {
  m.box(x - w / 2, top - h, z - 0.5, w, h, 1, BANNERS[v % BANNERS.length], { bevel: 0, anim: { kind: 'flag', pivot: [x, top, z], axis: [0, 0, 1], amp: 0.05, speed: 2.2 } });
}

function wheel(m: Model, x: number, y: number, z: number, r = 8) {
  m.cbox(x, y - r, z, r * 2 - 4, 3, 2.5, 'plank_dark');
  m.cbox(x, y + r - 3, z, r * 2 - 4, 3, 2.5, 'plank_dark');
  m.box(x - r, y - r + 2, z - 1.25, 3, r * 2 - 4, 2.5, 'plank_dark');
  m.box(x + r - 3, y - r + 2, z - 1.25, 3, r * 2 - 4, 2.5, 'plank_dark');
  for (const a of [0.785, -0.785]) m.cbox(x, y - r + 2, z, 1.6, r * 2 - 4, 1.6, 'beam_dark', { rot: { z: a, pivot: [x, y, z] } });
  m.cbox(x, y - 2, z, 4, 4, 4, 'metal_dark');
}

function campTorch(m: Model, x: number, y: number, z: number, h = 30) {
  m.cbox(x, y, z, 3, h, 3, { side: 'plank_v_dark', end: 'wood_end' });
  m.cbox(x, y + h, z, 5, 2, 5, 'metal_dark');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(x + sx * 2.5, y + h + 2, z + sz * 2.5, 1, 3, 1, 'metal_dark', { bevel: 0 });
  m.cbox(x, y + h + 2, z, 4, 3, 4, 'cloth_brown');
  m.add(flame(x, y + h + 5, z, 2.6, { smoke: false }));
}

function stool(m: Model, x: number, z: number, h = 9) {
  m.cbox(x, h - 2, z, 9, 2, 9, { top: 'plank', side: 'beam' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(x + sx * 3, 0, z + sz * 3, 2, h - 2, 2, 'beam_dark');
}

function table(m: Model, x: number, z: number, w: number, d: number, h = 13, tex = 'plank') {
  m.cbox(x, h - 2, z, w, 2.5, d, { top: tex, side: 'beam' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(x + sx * (w / 2 - 2.5), 0, z + sz * (d / 2 - 2.5), 2.5, h - 2, 2.5, 'beam_dark');
}

function chair(m: Model, x: number, z: number, face: number) {
  stool(m, x, z, 9);
  // back rest on the side away from the table
  const bz = z - face * 4;
  m.cbox(x - 3.5, 9, bz, 2, 10, 2, 'beam_dark');
  m.cbox(x + 3.5, 9, bz, 2, 10, 2, 'beam_dark');
  m.cbox(x, 14, bz, 9, 3, 1.5, 'plank');
}

// ---------------------------------------------------------------- structures

function tentSmall(ctx: BuildCtx): Model {
  const m = new Model();
  const v = ctx.variant;
  const tex = CANVAS[v];
  ridge(m, 0, 0, 0, 34, 19, 27, tex, { door: true, overhang: 1 });
  // ridge pole sticking out front and back, with a little pennant
  m.cbox(0, 0, 16.5, 2.5, 30, 2.5, BEAM_D);
  m.cbox(0, 0, -16.5, 2.5, 30, 2.5, BEAM_D);
  m.box(-1, 26.5, -17.5, 2, 2, 35, BEAM_D, { noAO: true });
  // door flaps folded back
  m.box(-8, 0, 16.4, 4, 15, 1.2, tex, { rot: { y: 0.5, pivot: [-8, 0, 16.4] }, tint: 0xd0d0d0 });
  m.box(4, 0, 16.4, 4, 15, 1.2, tex, { rot: { y: -0.5, pivot: [8, 0, 16.4] }, tint: 0xd0d0d0 });
  // guy ropes and pegs
  for (const s of [-1, 1]) {
    line(m, [0, 28, s * 17.5], [0, 0, s * 23], 0.8, 'rope', { bevel: 0 });
    m.cbox(0, 0, s * 23, 2, 3, 2, BEAM_D);
    for (const zz of [-12, 12]) {
      line(m, [s * 15, 5, zz], [s * 22, 0, zz], 0.8, 'rope', { bevel: 0 });
      m.cbox(s * 22, 0, zz, 2, 3, 2, BEAM_D);
    }
  }
  if (v === 4) for (let i = 0; i < 3; i++) m.cbox(rr(ctx.rnd, -16, 16), 0, rr(ctx.rnd, 18, 22), 4, 1, 3, 'camp_canvas_torn', { bevel: 0, rot: { y: ctx.rnd() * 3 } });
  else sack(m, 14, 0, 19, ctx.rnd, 0.7);
  return m;
}

function tentLarge(ctx: BuildCtx): Model {
  const m = new Model();
  const v = ctx.variant;
  const tex = CANVAS[v];
  // low walls then a steep roof (wall tent)
  m.cbox(0, 0, 0, 56, 12, 50, tex, { tint: 0xe4e4e4 });
  ridge(m, 0, 12, 0, 54, 30, 26, tex, { overhang: 2 });
  m.box(-8, 0, 25.2, 16, 26, 1, 'coal', { bevel: 0, tint: 0x404040 });
  m.box(-11, 0, 25.5, 4, 26, 1.5, tex, { rot: { y: 0.6, pivot: [-8, 0, 25.5] } });
  m.box(7, 0, 25.5, 4, 26, 1.5, tex, { rot: { y: -0.6, pivot: [8, 0, 25.5] } });
  for (const z of [-26, 26]) m.cbox(0, 0, z, 3, 42, 3, BEAM_D);
  m.box(-1.5, 36.5, -28, 3, 3, 56, BEAM_D, { noAO: true });
  // wooden corner poles and ropes
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    m.cbox(sx * 29, 0, sz * 26, 2.5, 13, 2.5, BEAM_D);
    line(m, [sx * 29, 12, sz * 26], [sx * 36, 0, sz * 31], 0.8, 'rope', { bevel: 0 });
    m.cbox(sx * 36, 0, sz * 31, 2, 3, 2, BEAM_D);
  }
  if (v !== 4) {
    crate(m, 22, 0, 32, 10, 1, 0.3);
    barrel(m, -24, 0, 32, 12);
  }
  return m;
}

function canopy(ctx: BuildCtx): Model {
  const m = new Model();
  const v = ctx.variant;
  const tex = CANVAS[v];
  const H = 36;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    m.cbox(sx * 19, 0, sz * 19, 3.5, H + 2, 3.5, BEAM_D);
    line(m, [sx * 19, H, sz * 19], [sx * 27, 0, sz * 27], 0.8, 'rope', { bevel: 0 });
  }
  // sagging cloth: a flat centre and four tilted edges
  m.cbox(0, H, 0, 30, 1.5, 30, tex, { bevel: 0 });
  m.box(-21, H - 1, 14, 42, 1.5, 8, tex, { rot: { x: 0.35, pivot: [0, H, 14] }, bevel: 0 });
  m.box(-21, H - 1, -22, 42, 1.5, 8, tex, { rot: { x: -0.35, pivot: [0, H, -14] }, bevel: 0 });
  m.box(14, H - 1, -15, 8, 1.5, 30, tex, { rot: { z: -0.35, pivot: [14, H, 0] }, bevel: 0 });
  m.box(-22, H - 1, -15, 8, 1.5, 30, tex, { rot: { z: 0.35, pivot: [-14, H, 0] }, bevel: 0 });
  // fringe strips on the front and right edge, waving
  for (let i = 0; i < 6; i++) {
    m.box(-17 + i * 7, H - 9, 21.5, 4, 6, 0.8, tex, { bevel: 0, anim: { kind: 'flag', pivot: [-15 + i * 7, H - 3, 21.5], axis: [0, 0, 1], amp: 0.03, speed: 2.5 } });
    m.box(21.5, H - 9, -17 + i * 7, 0.8, 6, 4, tex, { bevel: 0, anim: { kind: 'flag', pivot: [21.5, H - 3, -15 + i * 7], axis: [1, 0, 0], amp: 0.03, speed: 2.5 } });
  }
  // a little table with goods underneath
  table(m, 0, 0, 22, 14, 12);
  crate(m, -4, 12, 0, 7, 0);
  m.cbox(5, 12, 1, 3, 5, 3, 'bottle', { bevel: 0 });
  return m;
}

/** Wooden hut / storehouse body. kind: 0 hut, 1 storehouse. */
function house(ctx: BuildCtx, store: boolean): Model {
  const m = new Model();
  const v = ctx.variant; // 0 wood, 1 thatch (forest), 2 old (abandoned)
  const wall = v === 2 ? 'plank_old' : 'plank_v';
  const W = store ? 60 : 52;
  const D = store ? 56 : 48;
  const Hh = store ? 32 : 28;
  // stone footing
  m.cbox(0, 0, 0, W + 4, 4, D + 4, 'cobble');
  m.cbox(0, 4, 0, W, Hh, D, { side: wall, top: 'plank_dark' });
  // corner logs
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(sx * (W / 2), 4, sz * (D / 2), 6, Hh + 1, 6, LOG);
  m.cbox(0, 4 + Hh - 3, D / 2 + 0.5, W + 2, 4, 3, BEAM_D);
  const roofTex = v === 1 ? 'camp_thatch' : v === 2 ? 'plank_old' : 'plank_dark';
  ridge(m, 0, 4 + Hh, 0, D + 10, W / 2 + 6, store ? 28 : 24, roofTex, { gable: wall, th: v === 1 ? 4 : 2.5, overhang: 2 });
  if (v === 2) m.cbox(10, 4 + Hh + 14, 6, 14, 3, 12, 'coal', { tint: 0x303030, bevel: 0 }); // hole in the roof
  // door
  if (store) {
    m.box(-12, 4, D / 2 + 0.2, 24, 24, 1.5, 'plank_dark');
    line(m, [-11, 5, D / 2 + 1.8], [11, 27, D / 2 + 1.8], 2, 'beam_dark');
    line(m, [11, 5, D / 2 + 1.8], [-11, 27, D / 2 + 1.8], 2, 'beam_dark');
    m.box(-0.5, 4, D / 2 + 1.5, 1, 24, 1, 'beam_dark');
    m.box(-14, 4, D / 2, 2, 26, 2.5, 'beam_dark');
    m.box(12, 4, D / 2, 2, 26, 2.5, 'beam_dark');
    crate(m, W / 2 + 6, 0, D / 2 + 4, 12, 0, 0.2);
    sack(m, -W / 2 - 4, 0, D / 2 + 6, ctx.rnd, 0.8);
    barrel(m, -W / 2 + 4, 0, D / 2 + 8, 14);
  } else {
    m.box(-7, 4, D / 2 + 0.2, 14, 20, 1.5, 'plank_dark');
    m.box(-9, 4, D / 2, 2, 22, 2.5, 'beam_dark');
    m.box(7, 4, D / 2, 2, 22, 2.5, 'beam_dark');
    m.box(-9, 24, D / 2, 18, 2, 2.5, 'beam_dark');
    m.cbox(4, 13, D / 2 + 1.7, 1.5, 1.5, 1, 'metal', { bevel: 0 });
    if (v !== 2) {
      m.add(lantern(14, 16, D / 2 + 4, 's', 'beam_dark'));
      m.box(12.5, 16, D / 2 + 0.5, 3, 2, 4, 'beam_dark');
    }
  }
  // window on the right side (warm glow at night) with shutters
  const lit = v !== 2;
  m.box(W / 2 + 0.2, 14, -8, 1, 10, 12, lit ? 'lantern_glass' : 'coal', { glow: lit ? 0.9 : 0, bevel: 0, tint: lit ? 0xffffff : 0x404040 });
  m.box(W / 2 + 0.5, 13, -10, 2, 12, 2, 'beam_dark');
  m.box(W / 2 + 0.5, 13, 4, 2, 12, 2, 'beam_dark');
  m.box(W / 2 + 0.5, 12, -10, 2, 2, 16, 'beam_dark');
  m.box(W / 2 + 0.5, 13, -9, 1.2, 1.5, 14, 'beam_dark');
  if (lit) m.light(W / 2 + 4, 18, -2, 0xffb050, 0.6, 5, 0.3, 0.1);
  if (v === 2) {
    m.box(W / 2 + 2, 0, 10, 3, 1.5, 22, 'plank_old', { rot: { y: 0.3 } });
    m.cbox(-W / 2 - 3, 0, 0, 4, 18, 18, 'leaves', { bevel: 0, tint: 0x9ac080, anim: { kind: 'sway', amp: 0.006, speed: 1.4 } });
  }
  return m;
}

function watchtower(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const P = 64; // platform height
  const L = 19;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(sx * L, 0, sz * L, 6, P + 26, 6, LOG);
  // braces: X on each visible side and the back, plus a mid ring
  for (const y0 of [6, 34]) {
    for (const s of [-1, 1]) {
      line(m, [-L, y0, s * L], [L, y0 + 26, s * L], 2.5, BEAM_D);
      line(m, [L, y0, s * L], [-L, y0 + 26, s * L], 2.5, BEAM_D);
      line(m, [s * L, y0, -L], [s * L, y0 + 26, L], 2.5, BEAM_D);
      line(m, [s * L, y0, L], [s * L, y0 + 26, -L], 2.5, BEAM_D);
    }
  }
  // platform and railing
  m.cbox(0, P, 0, 52, 4, 52, { top: 'plank', side: 'beam_dark', bottom: 'plank_dark' });
  for (const s of [-1, 1]) {
    m.cbox(0, P + 4, s * 24.5, 50, 10, 2.5, 'plank', { uv: [s * 4, 0] });
    m.cbox(s * 24.5, P + 4, 0, 2.5, 10, 50, 'plank');
  }
  m.cbox(0, P + 13, 24.5, 52, 2, 3, BEAM_D);
  m.cbox(24.5, P + 13, 0, 3, 2, 52, BEAM_D);
  // roof
  ridge(m, 0, P + 26, 0, 56, 30, 16, 'plank_dark', { gable: 'plank', th: 2.5 });
  // ladder on the front
  line(m, [-5, 0, L + 9], [-5, P + 4, L + 3], 2, BEAM);
  line(m, [5, 0, L + 9], [5, P + 4, L + 3], 2, BEAM);
  for (let y = 6; y < P; y += 8) m.cbox(0, y, L + 9 - (y / P) * 6, 10, 1.5, 1.5, 'beam_dark');
  // banner on a pole and a torch on the corner
  m.cbox(-24, P + 4, -24, 2.5, 46, 2.5, BEAM_D);
  bannerCloth(m, -24 + 8, P + 48, -24, 12, 22, ctx.variant);
  m.box(-24, P + 47, -24.5, 16, 2, 2, BEAM_D, { noAO: true });
  if (ctx.variant !== 3) {
    campTorch(m, 24, P + 4, 24, 14);
    m.light(0, P + 10, 0, FIRE_LIGHT, 0.6, 7, 0.8);
  }
  crate(m, -12, P + 4, -12, 10, 0, r() * 0.4);
  return m;
}

function palisade(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const v = ctx.variant; // 0 wood, 1 orc (taller, bone tips, skulls), 2 broken
  const tip: TexSpec = v === 1 ? 'bone' : LOG;
  const xs = [-8, 0, 8];
  for (let i = 0; i < 3; i++) {
    if (v === 2 && r() < 0.28) {
      // fallen stake lying in front
      m.box(xs[i] - 3.5, 0, 2, 7, 7, 30, LOG, { rot: { y: rr(r, -0.6, 0.6), pivot: [xs[i], 0, 2] } });
      m.cbox(xs[i], 0, -1, 7, rr(r, 6, 14), 7, LOG);
      continue;
    }
    const h = (v === 1 ? 46 : 38) + Math.floor(r() * 10);
    const lean = v === 2 ? rr(r, -0.25, 0.25) : rr(r, -0.04, 0.04);
    stake(m, xs[i], 0, 0, h, 8, tip, lean, 0);
  }
  // binding beams on the inside (-z) and rope wraps on the outside
  if (!(v === 2 && r() < 0.5)) m.box(-12, 12, -6, 24, 4, 3, BEAM_D, { uv: [Math.floor(r() * 8), 0] });
  m.box(-12, 28, -6, 24, 4, 3, BEAM_D);
  for (const y of [13, 29]) m.box(-12, y, 4, 24, 1.5, 0.8, 'rope', { bevel: 0 });
  if (v === 1 && r() < 0.35) skull(m, xs[Math.floor(r() * 3)], 30, 6, 1, r() < 0.5);
  if (v === 2) m.cbox(rr(r, -8, 8), 0, 5, 6, 8, 3, 'leaves', { bevel: 0, tint: 0x9ac080 });
  return m;
}

function gate(ctx: BuildCtx): Model {
  const m = new Model();
  const v = ctx.variant;
  const H = 64;
  for (const s of [-1, 1]) {
    stake(m, s * 30, 0, 0, H, 10, v === 1 ? 'bone' : LOG);
    stake(m, s * 21, 0, 0, H - 14, 7, v === 1 ? 'bone' : LOG);
    // angled struts
    line(m, [s * 30, 0, -12], [s * 30, 40, -4], 3, BEAM_D);
  }
  // lintel beams (the top one overhangs) with a carved sign plank
  m.box(-40, H - 8, -4, 80, 6, 7, BEAM_D, { noAO: true });
  m.box(-34, H - 18, -3.5, 68, 4, 6, BEAM_D, { noAO: true });
  m.box(-12, H - 2, 2, 24, 9, 2, 'plank', { noAO: true });
  if (v === 1) skull(m, 0, H + 8, 3, 1.3, true);
  // banners hanging from the lintel ends
  for (const s of [-1, 1]) bannerCloth(m, s * 34, H - 8, 5, 12, 30, v);
  // torches on both posts
  if (v !== 3) for (const s of [-1, 1]) {
    m.box(s * 30 - 1, 30, 5, 2, 2, 6, 'metal_dark');
    m.add(flame(s * 30, 34, 10, 2.4, { smoke: false }));
    m.cbox(s * 30, 30, 10, 3, 4, 3, 'cloth_brown');
  }
  return m;
}

function stoneTower(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const v = ctx.variant; // 0 intact, 1 ruined/mossy
  const S = 40;
  const H = v === 1 ? 60 : 76;
  m.cbox(0, 0, 0, S + 6, 6, S + 6, 'camp_brick', { tint: 0xd0d0d0 });
  m.cbox(0, 6, 0, S, H - 6, S, { side: 'camp_brick', top: 'cobble' });
  // corner quoins
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = 6; y < H; y += 12) m.cbox(sx * (S / 2 - 2), y, sz * (S / 2 - 2), 6, 6, 6, 'stone_grey');
  // crenellations (some broken on the ruin)
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      if (v === 1 && r() < 0.45) continue;
      const o = -15 + i * 10;
      m.cbox(o, H, s * (S / 2 - 3), 7, 7, 6, 'camp_brick');
      m.cbox(s * (S / 2 - 3), H, o, 6, 7, 7, 'camp_brick');
    }
  m.cbox(0, H - 4, 0, S + 4, 4, S + 4, 'stone_grey');
  // door and lit slit windows
  m.box(-6, 6, S / 2 - 0.5, 12, 18, 1.5, 'plank_dark');
  m.box(-8, 24, S / 2 - 0.4, 16, 3, 2, 'stone_grey');
  const lit = v === 0;
  for (const y of [34, 54]) {
    if (y > H - 10) continue;
    m.box(-2, y, S / 2 + 0.1, 4, 9, 0.8, lit ? 'lantern_glass' : 'coal', { glow: lit ? 1 : 0, bevel: 0 });
    m.box(S / 2 + 0.1, y - 6, -2, 0.8, 9, 4, lit ? 'lantern_glass' : 'coal', { glow: lit ? 1 : 0, bevel: 0 });
  }
  if (lit) {
    m.light(S / 2 + 4, 44, S / 2 + 4, 0xffb050, 0.5, 5, 0.3, 0.1);
    // wooden lookout roof and a banner on top
    for (const [sx, sz] of [[-1, -1], [1, 1]]) m.cbox(sx * 14, H, sz * 14, 3, 20, 3, BEAM_D);
    m.cbox(-12, H + 7, -12, 2.5, 36, 2.5, BEAM_D);
    bannerCloth(m, -4, H + 42, -12, 12, 20, 0);
    m.box(-12, H + 41, -12.5, 16, 2, 2, BEAM_D, { noAO: true });
    campTorch(m, 14, H, 14, 8);
  }
  // moss and ivy at the foot
  for (let i = 0; i < (v === 1 ? 10 : 5); i++) {
    const s = 3 + r() * 4;
    const side = r() < 0.5;
    m.box(side ? S / 2 - 1 : rr(r, -S / 2, S / 2 - s), rr(r, 4, v === 1 ? 40 : 18), side ? rr(r, -S / 2, S / 2 - s) : S / 2 - 1, side ? 2 : s, s, side ? s : 2, 'leaves', { bevel: 0, anim: { kind: 'sway', amp: 0.005, speed: 1.5 } });
  }
  if (v === 1) for (let i = 0; i < 5; i++) stone(m, rr(r, -28, 28), 0, rr(r, 22, 30), 6 + r() * 4, r, 'camp_brick');
  return m;
}

function campfireCamp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const dead = ctx.variant === 1;
  m.cbox(0, 0, 0, 30, 1, 30, 'ash', { bevel: 0 });
  if (!dead) m.cbox(0, 1, 0, 18, 1, 18, 'ember_bed', { glow: 1.4, flicker: 0.6, bevel: 0 });
  // double ring of grey blocky stones, like the sheet
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.15;
    stone(m, Math.cos(a) * 18, 0, Math.sin(a) * 18, 7 + r() * 3, r, i % 2 ? 'stone_grey' : 'stone_smooth');
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    stone(m, Math.cos(a) * 26, 0, Math.sin(a) * 26, 4 + r() * 2, r, 'cobble');
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cx = Math.cos(a) * 6;
    const cz = Math.sin(a) * 6;
    m.cbox(cx, 1, cz, 4, 4, 18, { side: 'bark', end: 'log_end' }, { rot: { y: -a + Math.PI / 2, x: 0.35, pivot: [cx, 3, cz] }, tint: dead ? 0x505050 : 0xffffff });
  }
  if (dead) {
    m.cbox(0, 1, 0, 10, 2, 6, 'coal');
    m.emit({ kind: 'smoke', x: 0, y: 6, z: 0, count: 3, spread: 3, height: 40, size: 4 });
  } else {
    m.cbox(0, 2, 0, 10, 3, 4, 'coal', { glow: 0.8, flicker: 0.5 });
    m.add(flame(0, 2, 0, 8, { smoke: true, lightK: 1.6 }));
    m.lights = [{ x: 0, y: 22, z: 0, color: FIRE_LIGHT, intensity: 1.9, radius: 10, flicker: 1, day: 0.45 }];
  }
  return m;
}

function platform(ctx: BuildCtx): Model {
  const m = new Model();
  const Y = 24; // deck height = 1 world unit
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(sx * 20, 0, sz * 20, 5, Y + (sz < 0 || sx < 0 ? 18 : 0), 5, LOG);
  for (const s of [-1, 1]) line(m, [-20, 2, s * 20], [20, Y - 3, s * 20], 2.5, BEAM_D);
  m.cbox(0, Y - 4, 0, 48, 4, 48, { top: 'plank', side: 'beam_dark', bottom: 'plank_dark' });
  // back railings
  m.cbox(0, Y + 12, -20, 44, 3, 2.5, BEAM_D);
  m.cbox(-20, Y + 12, 0, 2.5, 3, 44, BEAM_D);
  m.cbox(-20, Y + 6, 0, 1.5, 1.5, 44, 'rope', { bevel: 0 });
  // steps on the front right
  for (let i = 0; i < 3; i++) m.box(8, i * 7, 24 + (2 - i) * 6, 14, 3, 6, { top: 'plank', side: 'beam' });
  for (const x of [9, 21]) line(m, [x, 0, 42], [x, Y - 2, 24], 2, BEAM_D);
  if (ctx.variant === 0) {
    crate(m, -12, Y, -12, 12, 0, 0.2);
    barrel(m, 4, Y, -14, 14);
  }
  return m;
}

function forge(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // lean-to roof on posts over the hearth
  for (const [x, z, h] of [[-22, -20, 40], [22, -20, 40], [-22, 18, 30], [22, 18, 30]] as const) m.cbox(x, 0, z, 4, h, 4, BEAM_D);
  m.box(-26, 38, -24, 52, 2.5, 48, { top: 'plank_dark', side: 'beam_dark', bottom: 'plank_dark' }, { rot: { x: 0.22, pivot: [0, 38, -20] } });
  // stone hearth with glowing coals and a chimney hood
  m.cbox(-10, 0, -12, 22, 14, 16, { side: 'stone_grey', top: 'cobble' });
  m.cbox(-10, 14, -12, 16, 1, 10, 'ember_bed', { glow: 1.6, flicker: 0.7, bevel: 0 });
  m.cbox(-10, 15, -12, 8, 2, 4, 'coal', { glow: 0.9, flicker: 0.6 });
  m.cbox(-10, 26, -15, 18, 6, 12, 'stone_grey');
  m.cbox(-10, 32, -16, 8, 10, 8, 'stone_grey');
  m.emit({ kind: 'sparks', x: -10, y: 16, z: -12, count: 8, spread: 5, height: 14, size: 1.2 });
  m.emit({ kind: 'smoke', x: -10, y: 42, z: -16, count: 4, spread: 2, height: 30, size: 4 });
  m.light(-10, 20, -8, 0xff7a20, 1.3, 8, 0.8, 0.3);
  // bellows
  m.box(2, 6, -18, 8, 5, 12, 'leather', { rot: { z: 0.2 } });
  // anvil on a stump
  m.cbox(10, 0, 8, 10, 8, 10, { side: 'bark', end: 'log_end' });
  m.cbox(10, 8, 8, 6, 3, 5, 'metal_dark');
  m.cbox(10, 11, 8, 14, 4, 6, 'metal');
  m.box(17, 12, 6.5, 4, 2, 3, 'metal');
  m.box(6, 15, 7, 8, 1.5, 2, 'beam_dark', { rot: { y: 0.4 } });
  m.cbox(4, 15, 8, 3, 3, 3, 'metal_dark');
  // repair table with tools and a quench barrel
  table(m, -14, 12, 18, 10, 12);
  m.box(-20, 12, 10, 10, 1, 2, 'metal', { bevel: 0 });
  m.box(-12, 12, 13, 2, 1, 6, 'metal', { bevel: 0 });
  barrel(m, 18, 0, -8, 13);
  m.cbox(18, 13.2, -8, 10, 0.5, 10, 'crystal_cyan', { tint: 0x406080, bevel: 0 });
  // tool rack on the back post
  for (let i = 0; i < 3; i++) m.box(20 - i * 5, 14, -21, 1.5, 14, 1.5, 'beam', { rot: { z: rr(r, -0.1, 0.1) } });
  return m;
}

function shed(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (const [x, z, h] of [[-22, -20, 40], [22, -20, 40], [-22, 20, 28], [22, 20, 28]] as const) m.cbox(x, 0, z, 4.5, h, 4.5, LOG);
  m.box(-26, 38, -24, 52, 3, 50, { top: 'plank_dark', side: 'beam_dark', bottom: 'plank_dark' }, { rot: { x: 0.25, pivot: [0, 40, -22] } });
  // back and left plank walls
  m.box(-22, 0, -22, 44, 38, 2.5, 'plank_v');
  m.box(-24, 0, -20, 2.5, 30, 40, 'plank_v', { uv: [5, 0] });
  // goods: crates, barrel, firewood, bench
  crate(m, -12, 0, -12, 16, 0, r() * 0.2);
  crate(m, -12, 16, -13, 12, 1, r() * 0.3);
  crate(m, 6, 0, -14, 14, 2, r() * 0.2);
  barrel(m, 14, 0, 6, 15);
  for (let i = 0; i < 6; i++) m.box(-20, (i % 3) * 4, -2 + Math.floor(i / 3) * 5, 14, 4, 4, { side: 'bark', end: 'log_end' }, { bevel: 0.5 });
  m.cbox(-4, 6, 14, 24, 2, 6, 'plank');
  for (const x of [-14, 6]) m.cbox(x, 0, 14, 2, 6, 5, 'beam_dark');
  m.add(lantern(0, 22, 8, 's', 'beam_dark'));
  m.box(-1, 37 - 2, 7, 2, 0.1, 2, 'chain');
  line(m, [0, 29, 8], [0, 40, 8], 1, 'chain', { bevel: 0 });
  return m;
}

// ---------------------------------------------------------------- decor

function bannerProp(ctx: BuildCtx): Model {
  const m = new Model();
  const v = ctx.variant;
  m.cbox(0, 0, 0, 6, 2, 6, 'dirt', { bevel: 0 });
  m.cbox(0, 0, 0, 3, 52, 3, BEAM_D);
  m.box(-10, 46, -1, 20, 2.5, 2.5, BEAM_D, { noAO: true });
  m.cbox(0, 52, 0, 4, 3, 4, v === 1 ? 'bone' : 'metal');
  bannerCloth(m, 0, 46, 2, 16, 34, v);
  if (v === 1) skull(m, 0, 56, 0, 0.8, true);
  return m;
}

function torchProp(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 7, 3, 7, 'stone_grey');
  campTorch(m, 0, 3, 0, 26 + Math.floor(ctx.rnd() * 6));
  return m;
}

function cauldron(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const top: V3 = [0, 40, 0];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    line(m, [Math.cos(a) * 18, 0, Math.sin(a) * 18], top, 2.5, BEAM_D);
  }
  m.cbox(0, 39, 0, 4, 4, 4, 'rope');
  line(m, [0, 20, 0], [0, 40, 0], 1, 'chain', { bevel: 0 });
  // pot
  m.cbox(0, 8, 0, 12, 10, 12, 'metal_dark', { bevel: 0.5 });
  m.cbox(0, 10, 0, 14, 6, 14, 'metal_dark', { bevel: 0.5 });
  m.cbox(0, 18, 0, 11, 1.5, 11, 'metal_dark');
  m.cbox(0, 18.5, 0, 9, 1, 9, 'crystal_cyan', { tint: 0x6a8a3a, glow: 0.3, bevel: 0 });
  m.emit({ kind: 'smoke', x: 0, y: 20, z: 0, count: 4, spread: 3, height: 26, size: 3, color: 0xdddddd });
  // small fire under it with a few stones
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    stone(m, Math.cos(a) * 10, 0, Math.sin(a) * 10, 4 + r() * 2, r, 'stone_smooth');
  }
  m.cbox(0, 0, 0, 10, 2, 4, { side: 'bark', end: 'log_end' }, { rot: { y: 0.6 } });
  m.add(flame(0, 1, 0, 4, { smoke: false, lightK: 0.8 }));
  return m;
}

function cratesProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  crate(m, -8, 0, -6, 16, 0, r() * 0.15);
  crate(m, 9, 0, -6, 16, 1, r() * 0.15);
  crate(m, -7, 16, -6, 14, 2, r() * 0.3);
  crate(m, 2, 0, 10, 12, 0, r() * 0.4);
  return m;
}

function barrelsProp(ctx: BuildCtx): Model {
  const m = new Model();
  barrel(m, -8, 0, -6, 18);
  barrel(m, 8, 0, -4, 16);
  barrel(m, 0, 0, 10, 14);
  if (ctx.variant === 1) {
    // one barrel lying on its side
    m.box(-22, 0, 4, 16, 13, 13, { side: 'barrel', px: 'barrel_top', nx: 'barrel_top' }, { rot: { y: 0.3 } });
  }
  return m;
}

function sacksProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  sack(m, -6, 0, -4, r);
  sack(m, 7, 0, -2, r, 0.85);
  sack(m, 0, 0, 9, r, 0.75);
  if (ctx.variant === 1) for (let i = 0; i < 6; i++) m.cbox(rr(r, -6, 8), 0, rr(r, 12, 16), 2, 1, 2, 'produce', { bevel: 0 });
  return m;
}

function cartProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const broken = ctx.variant === 1;
  const by = 10;
  m.cbox(0, by, 0, 34, 3, 22, { top: 'plank', side: 'beam', bottom: 'plank_dark' }, broken ? { rot: { z: 0.18 } } : {});
  for (const s of [-1, 1]) m.cbox(0, by + 3, s * 10, 34, 6, 2, 'plank', broken ? { rot: { z: 0.18 } } : {});
  m.cbox(-16, by + 3, 0, 2, 6, 22, 'plank');
  m.cbox(0, 6, 0, 3, 3, 30, 'beam_dark');
  wheel(m, 0, 9, 15);
  if (broken) m.box(-6, 0, -22, 16, 3, 3, 'plank_dark', { rot: { y: 0.4 } });
  else wheel(m, 0, 9, -15);
  for (const s of [-1, 1]) m.box(16, by, s * 8 - 1.5, 22, 3, 3, 'beam_dark', { rot: { z: -0.4, pivot: [16, by + 1, s * 8] } });
  if (!broken) {
    crate(m, -8, by + 3, -2, 11, 1, 0.2);
    sack(m, 6, by + 3, 2, r, 0.7);
  } else {
    m.box(-4, 0, 14, 14, 2, 3, 'plank', { rot: { y: 1.1 } });
  }
  return m;
}

function stakesProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // anti-charge stakes leaning outward (+z) from a cross log
  m.box(-20, 2, -4, 40, 5, 5, LOG);
  for (let i = 0; i < 5; i++) {
    const x = -16 + i * 8 + rr(r, -1, 1);
    stake(m, x, 0, -2, 24 + r() * 8, 4, ctx.variant === 1 ? 'bone' : LOG, 0.28 + rr(r, -0.06, 0.06), rr(r, -0.1, 0.1));
  }
  return m;
}

function dummy(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 10, 3, 10, BEAM_D);
  m.cbox(0, 0, 0, 3, 38, 3, BEAM_D);
  m.cbox(0, 28, 0, 22, 3, 3, BEAM_D);
  // straw-stuffed sack body and head, rope belt, a sword cut
  m.cbox(0, 12, 0, 12, 16, 8, 'sack', { tint: 0xf0e0c0 });
  m.cbox(0, 18, 0, 12.5, 2, 8.5, 'rope', { bevel: 0 });
  m.cbox(0, 31, 0, 9, 9, 8, 'sack', { tint: 0xe8d8b8 });
  m.cbox(0, 34, 4.1, 5, 1, 0.5, 'coal', { bevel: 0 });
  for (const s of [-1, 1]) m.cbox(s * 11, 26, 0, 3, 6, 3, 'hay', { bevel: 0 });
  m.cbox(0, 40, 0, 3, 2, 3, 'hay', { bevel: 0 });
  if (ctx.variant === 1) m.box(4, 12, 4, 1, 14, 1, 'metal', { rot: { z: 0.6 } });
  return m;
}

function cage(ctx: BuildCtx): Model {
  const m = new Model();
  const S = 30;
  const H = 34;
  m.cbox(0, 0, 0, S + 4, 4, S + 4, { top: 'plank_dark', side: 'beam_dark' });
  for (const s of [-1, 1]) {
    m.cbox(0, H, s * (S / 2), S + 4, 3, 4, BEAM_D);
    m.cbox(s * (S / 2), H, 0, 4, 3, S + 4, BEAM_D);
  }
  for (let i = 1; i < 6; i++) m.cbox(-S / 2 + (i * S) / 6, H + 0.5, 0, 1.6, 1.6, S, 'metal_dark', { bevel: 0 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.cbox(sx * (S / 2), 0, sz * (S / 2), 4, H + 3, 4, BEAM_D);
  // bars on all four sides
  for (let i = 1; i < 6; i++) {
    const o = -S / 2 + (i * S) / 6;
    for (const s of [-1, 1]) {
      m.cbox(o, 4, s * (S / 2), 1.6, H - 4, 1.6, 'metal_dark', { bevel: 0 });
      m.cbox(s * (S / 2), 4, o, 1.6, H - 4, 1.6, 'metal_dark', { bevel: 0 });
    }
  }
  for (const s of [-1, 1]) {
    m.cbox(0, H / 2, s * (S / 2), S, 1.6, 1.6, 'metal_dark', { bevel: 0 });
    m.cbox(s * (S / 2), H / 2, 0, 1.6, 1.6, S, 'metal_dark', { bevel: 0 });
  }
  m.cbox(4, H / 2 - 3, S / 2 + 1, 4, 5, 1.5, 'metal', { bevel: 0 });
  // straw floor, bones and a small lantern glowing inside (the sheet's warm glow)
  m.cbox(0, 4, 0, S - 4, 1, S - 4, 'hay_top', { bevel: 0 });
  if (ctx.variant === 1) skull(m, -5, 7, -4, 0.8);
  else m.add(lantern(-6, 5, -6, 's', 'beam_dark'));
  m.cbox(6, 5, 2, 8, 1.5, 2, 'bone', { rot: { y: 0.7 } });
  m.cbox(0, H + 3, 0, 4, 3, 4, 'metal_dark');
  return m;
}

function weaponRack(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (const s of [-1, 1]) {
    m.cbox(s * 18, 0, 0, 4, 30, 4, BEAM_D);
    m.cbox(s * 18, 0, 0, 8, 2, 10, 'beam_dark');
  }
  m.cbox(0, 22, 0, 40, 3, 4, BEAM_D);
  m.cbox(0, 6, 3, 40, 3, 2, BEAM_D);
  // swords, spears and an axe leaning on the bar
  for (let i = 0; i < 5; i++) {
    const x = -13 + i * 6.5;
    const kind = i % 3;
    const rot = { x: -0.15, z: rr(r, -0.05, 0.05), pivot: [x, 0, 6] as V3 };
    if (kind === 0) {
      m.box(x - 0.8, 7, 5, 1.6, 22, 1, 'metal', { rot, bevel: 0 });
      m.box(x - 3, 6, 4.5, 6, 1.5, 2, 'metal_dark', { rot });
      m.box(x - 0.8, 1, 5, 1.6, 5, 1.6, 'leather', { rot });
    } else if (kind === 1) {
      m.box(x - 0.7, 1, 5, 1.4, 34, 1.4, 'beam', { rot });
      m.box(x - 1.5, 35, 4.8, 3, 6, 1, 'metal', { rot, bevel: 0 });
    } else {
      m.box(x - 0.8, 1, 5, 1.6, 28, 1.6, 'beam', { rot });
      m.box(x - 0.5, 23, 4.5, 6, 7, 1.5, 'metal', { rot });
    }
  }
  if (ctx.variant === 1) m.box(14, 1, 6, 10, 10, 2, 'metal_dark', { rot: { x: -0.3 } }); // shield
  return m;
}

function skullTrophy(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 7, 2, 7, 'dirt', { bevel: 0 });
  m.cbox(0, 0, 0, 3, 36, 3, BEAM_D, { rot: { z: rr(r, -0.06, 0.06) } });
  // crossed bones / sticks with hanging trinkets
  line(m, [-12, 24, 1], [12, 30, 1], 2.4, 'bone');
  line(m, [-10, 30, 2], [11, 23, 2], 2.4, BEAM_D);
  skull(m, 0, 37, 0, 1.2, true);
  for (const x of [-9, 8]) {
    line(m, [x, 27, 2], [x, 19, 2], 0.7, 'rope', { bevel: 0, anim: { kind: 'swing', pivot: [x, 27, 2], axis: [0, 0, 1], amp: 0.12, speed: 1.6 } });
    m.cbox(x, 16, 2, 3, 3, 3, 'bone', { anim: { kind: 'swing', pivot: [x, 27, 2], axis: [0, 0, 1], amp: 0.12, speed: 1.6 } });
  }
  if (ctx.variant === 1) for (let i = 0; i < 3; i++) skull(m, rr(r, -10, 10), 2, rr(r, 6, 10), 0.7);
  return m;
}

function planksProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 6; i++) {
    const tex = pickTex(r, ['plank', 'plank_dark', 'plank_old']);
    m.cbox(rr(r, -12, 12), i < 3 ? 0 : 2, rr(r, -8, 8), 6, 2, rr(r, 24, 34), { top: tex, side: 'beam' }, { rot: { y: r() * Math.PI, x: rr(r, -0.06, 0.06) } });
  }
  if (ctx.variant === 1) for (let i = 0; i < 3; i++) m.cbox(rr(r, -14, 14), 0, rr(r, -10, 10), 1, 1, 1, 'metal', { bevel: 0 });
  return m;
}

const pickTex = (r: () => number, a: string[]) => a[Math.floor(r() * a.length) % a.length];

function stonesProp(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // blocky grey stone pile (cubes, a few stacked)
  const spots: [number, number, number, number][] = [[-8, 0, -6, 13], [7, 0, -7, 12], [-2, 0, 8, 11], [10, 0, 7, 9], [-12, 0, 8, 8], [0, 12, -6, 10], [-6, 11, 2, 7]];
  for (const [x, y, z, s] of spots) m.cbox(x + rr(r, -1, 1), y, z, s, s * 0.9, s, pickTex(r, ['stone_grey', 'stone_smooth', 'cobble']), { rot: { y: rr(r, -0.25, 0.25) }, tint: r() < 0.5 ? 0xffffff : 0xd0d0d0 });
  if (ctx.variant === 1) m.cbox(-8, 13, -6, 10, 2, 10, 'moss', { bevel: 0 });
  return m;
}

function ladderProp(ctx: BuildCtx): Model {
  const m = new Model();
  const H = 48;
  for (const s of [-1, 1]) line(m, [s * 6, 0, 6], [s * 6, H, -4], 2.5, BEAM);
  for (let y = 5; y < H - 2; y += 7) m.cbox(0, y, 6 - (y / H) * 10, 14, 1.8, 1.8, 'beam_dark');
  if (ctx.variant === 1) m.box(-7, 1, 8, 3, 2, 18, 'beam', { rot: { y: 0.8 } });
  return m;
}

function tableChairs(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  table(m, 0, 0, 30, 18, 14);
  chair(m, -8, 14, 1);
  chair(m, 8, -14, -1);
  m.cbox(-6, 14, 2, 3, 4, 3, 'bottle', { bevel: 0 });
  m.cbox(5, 14, -2, 5, 1, 4, 'paper', { bevel: 0, rot: { y: r() } });
  m.cbox(9, 14, 3, 4, 3, 4, 'beam', { bevel: 0 });
  return m;
}

function tableLantern(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  table(m, 0, -2, 34, 22, 15, 'plank_dark');
  stool(m, 18, 14, 10);
  m.add(lantern(-14, 0, 16, 's', 'beam_dark'));
  m.cbox(8, 15, -4, 6, 4, 6, 'beam', { bevel: 0 });
  m.cbox(-6, 15, 0, 3, 5, 3, 'bottle', { bevel: 0 });
  m.cbox(-1, 15, -6, 8, 1, 6, 'paper', { bevel: 0, rot: { y: r() * 0.6 } });
  return m;
}

// ---------------------------------------------------------------- registry

export const CAMP_PROPS: PropDef[] = [
  { id: 'camp_tent_small', name: 'Палатка (малая)', category: CAT, size: [2, 2], variants: 5, solid: true, tags: ['camp', 'tent'], build: tentSmall },
  { id: 'camp_tent_large', name: 'Палатка (большая)', category: CAT, size: [3, 3], variants: 5, solid: true, tags: ['camp', 'tent'], build: tentLarge },
  { id: 'camp_canopy', name: 'Навес', category: CAT, size: [2, 2], variants: 5, solid: (fx, fz) => fx === 0 && fz === 0, tags: ['camp'], build: canopy },
  { id: 'camp_hut', name: 'Деревянная хижина', category: CAT, size: [3, 3], variants: 3, solid: true, tags: ['camp', 'building'], build: (c) => house(c, false) },
  { id: 'camp_watchtower', name: 'Дозорная вышка', category: CAT, size: [2, 2], variants: 4, solid: true, height: 4, tags: ['camp', 'tower'], build: watchtower },
  { id: 'camp_palisade', name: 'Частокол', category: CAT, size: [1, 1], variants: 3, solid: true, height: 2, tags: ['camp', 'wall'], build: palisade },
  { id: 'camp_gate', name: 'Ворота', category: CAT, size: [3, 1], variants: 4, solid: (fx) => fx !== 1, height: 3, tags: ['camp', 'wall'], build: gate },
  { id: 'camp_stone_tower', name: 'Башня', category: CAT, size: [2, 2], variants: 2, solid: true, height: 4, tags: ['camp', 'tower'], build: stoneTower },
  { id: 'camp_campfire', name: 'Кострище', category: CAT, size: [2, 2], variants: 2, solid: true, height: 1, tags: ['camp', 'fire'], build: campfireCamp },
  { id: 'camp_platform', name: 'Площадка', category: CAT, size: [2, 2], variants: 2, solid: false, deck: () => 1, tags: ['camp'], build: platform },
  { id: 'camp_forge', name: 'Кузница / рем. стол', category: CAT, size: [2, 2], solid: true, tags: ['camp', 'fire'], build: forge },
  { id: 'camp_storehouse', name: 'Склад / амбар', category: CAT, size: [3, 3], variants: 3, solid: true, tags: ['camp', 'building'], build: (c) => house(c, true) },
  { id: 'camp_shed', name: 'Сарай с припасами', category: CAT, size: [2, 2], solid: true, tags: ['camp', 'building'], build: shed },
  { id: 'camp_banner', name: 'Флаг / баннер', category: CAT, size: [1, 1], variants: 4, solid: true, tags: ['camp'], build: bannerProp },
  { id: 'camp_torch', name: 'Факел', category: CAT, size: [1, 1], solid: true, tags: ['camp', 'fire'], build: torchProp },
  { id: 'camp_cauldron', name: 'Тренога для котла', category: CAT, size: [2, 2], solid: true, height: 1, tags: ['camp', 'fire'], build: cauldron },
  { id: 'camp_crates', name: 'Ящики', category: CAT, size: [2, 2], solid: true, tags: ['camp'], build: cratesProp },
  { id: 'camp_barrels', name: 'Бочки', category: CAT, size: [2, 2], variants: 2, solid: true, tags: ['camp'], build: barrelsProp },
  { id: 'camp_sacks', name: 'Мешки', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp'], build: sacksProp },
  { id: 'camp_cart', name: 'Телега', category: CAT, size: [2, 2], variants: 2, solid: true, tags: ['camp'], build: cartProp },
  { id: 'camp_stakes', name: 'Деревянные колья', category: CAT, size: [2, 1], variants: 2, solid: true, tags: ['camp', 'wall'], build: stakesProp },
  { id: 'camp_dummy', name: 'Манекен для тренировок', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp'], build: dummy },
  { id: 'camp_cage', name: 'Клетка', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp', 'orc'], build: cage },
  { id: 'camp_weapon_rack', name: 'Стойка с оружием', category: CAT, size: [2, 1], variants: 2, solid: true, tags: ['camp'], build: weaponRack },
  { id: 'camp_skull_trophy', name: 'Черепа / трофеи', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp', 'orc'], build: skullTrophy },
  { id: 'camp_planks', name: 'Разбросанные доски', category: CAT, size: [2, 2], variants: 2, solid: false, tags: ['camp', 'debris'], build: planksProp },
  { id: 'camp_stones', name: 'Камни', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp'], build: stonesProp },
  { id: 'camp_ladder', name: 'Лестница', category: CAT, size: [1, 1], variants: 2, solid: true, tags: ['camp'], build: ladderProp },
  { id: 'camp_table_chairs', name: 'Стул / стол', category: CAT, size: [2, 2], solid: true, tags: ['camp'], build: tableChairs },
  { id: 'camp_table_lantern', name: 'Стол с фонарём', category: CAT, size: [2, 2], solid: true, tags: ['camp'], build: tableLantern },
];

// ---------------------------------------------------------------- whole camps

export type CampKind = 'bandit' | 'orc' | 'forest' | 'abandoned';
export type CampSize = 'small' | 'medium' | 'large';

const TENT_V: Record<CampKind, number> = { bandit: 0, orc: 3, forest: 2, abandoned: 4 };
const BANNER_V: Record<CampKind, number> = { bandit: 0, orc: 1, forest: 2, abandoned: 3 };
const PAL_V: Record<CampKind, number> = { bandit: 0, orc: 1, forest: 0, abandoned: 2 };
const HUT_V: Record<CampKind, number> = { bandit: 0, orc: 0, forest: 1, abandoned: 2 };

/**
 * Composes a whole camp around (x, z) from the props above: a palisade ring (with a gate on the
 * +z side for medium/large, partial for small, gappy for abandoned), a central campfire, tents,
 * banners and torches, plus kind- and size-dependent buildings and decor. Props that do not fit
 * (blocked cells) are skipped. Call before computing `t.reach`.
 */
export function placeCamp(t: Terrain, kind: CampKind, size: CampSize, x: number, z: number, seed = 1) {
  const rng = new Rng(seed);
  const rnd = () => rng.next();
  const h = size === 'small' ? 4 : size === 'medium' ? 6 : 8;
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const dead = kind === 'abandoned';
  const put = (id: string, dx: number, dz: number, o: { rot?: number; variant?: number } = {}) => {
    const [sx, sz] = footprintSize(CAMP_PROPS.find((d) => d.id === id)!);
    const r = o.rot ?? 0;
    const ex = r % 2 ? sz : sx;
    const ez = r % 2 ? sx : sz;
    return placeProp(t, id, cx + dx + (ex % 2 ? 0.5 : 0), cz + dz + (ez % 2 ? 0.5 : 0), { rot: r, variant: o.variant, seed: seed * 7919 + Math.floor(rnd() * 1e6), ifFree: true });
  };

  // palisade
  const L = cx - h + 0.5;
  const R = cx + h + 0.5;
  const T = cz - h + 0.5;
  const B = cz + h + 0.5;
  const pv = PAL_V[kind];
  const runs: [number, number][][] = size === 'small'
    ? [[[L, B - 2], [L, T], [R - 1, T]]]
    : [[[cx - 1.5, B], [L, B], [L, T], [R, T], [R, B], [cx + 2.5, B]]];
  for (const run of runs) {
    if (!dead) placeAlong(t, 'camp_palisade', run, { variant: pv, spacing: 1, ifFree: true });
    else
      for (let k = 0; k + 1 < run.length; k++) {
        // abandoned: broken runs with gaps
        const [ax, az] = run[k];
        const [bx, bz] = run[k + 1];
        const n = Math.round(Math.hypot(bx - ax, bz - az));
        let i = 0;
        while (i < n) {
          const len = 1 + Math.floor(rnd() * 4);
          const j = Math.min(n, i + len);
          placeAlong(t, 'camp_palisade', [[ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n], [ax + ((bx - ax) * (j - 1)) / n, az + ((bz - az) * (j - 1)) / n]], { variant: pv, spacing: 1, ifFree: true, rot: undefined });
          i = j + 1 + Math.floor(rnd() * 2);
        }
      }
  }
  if (size !== 'small') put('camp_gate', 0, h, { variant: BANNER_V[kind] });

  // heart of the camp
  put('camp_campfire', 0, 0, { variant: dead ? 1 : 0 });
  const tentV = TENT_V[kind];
  put('camp_tent_small', -h + 2, -h + 2, { variant: tentV });
  if (size === 'small') {
    put('camp_banner', -h + 1, 1, { variant: BANNER_V[kind] });
    put(dead ? 'camp_planks' : 'camp_crates', 2, -h + 2);
    put('camp_sacks', h - 2, 1);
    if (!dead) put('camp_torch', 2, 2);
    put('camp_stones', -2, 2);
  } else {
    put(size === 'large' ? 'camp_tent_large' : 'camp_tent_small', 0, -h + 2, { variant: tentV });
    put('camp_banner', -2, h - 1, { variant: BANNER_V[kind] });
    put('camp_banner', 2, h - 1, { variant: BANNER_V[kind] });
    if (!dead) for (const [dx, dz] of [[-h + 1, h - 1], [h - 1, h - 1]]) put('camp_torch', dx, dz);
    put('camp_watchtower', h - 2, -h + 2, { variant: BANNER_V[kind] });
    put(kind === 'forest' ? 'camp_canopy' : 'camp_cauldron', -h + 2, 2, { variant: TENT_V[kind] === 3 ? 1 : TENT_V[kind] });
    put('camp_crates', h - 2, 1);
    put('camp_barrels', h - 2, 3, { variant: dead ? 1 : 0 });
    put('camp_table_chairs', 3, 2);
    put('camp_sacks', -3, -1, { variant: kind === 'forest' ? 1 : 0 });
    put(dead ? 'camp_planks' : 'camp_cart', -h + 2, h - 3, { variant: dead ? 1 : 0 });
  }
  if (size === 'large') {
    put('camp_stone_tower', -h + 2, -h + 5, { variant: dead ? 1 : 0 });
    put(kind === 'forest' ? 'camp_hut' : 'camp_storehouse', h - 3, -h + 6, { variant: HUT_V[kind] });
    put('camp_forge', 3, -3);
    put('camp_platform', -3, 4, { variant: dead ? 1 : 0 });
    put('camp_shed', h - 3, h - 5);
    put('camp_weapon_rack', 0, 3);
    put('camp_dummy', 5, 4, { variant: dead ? 1 : 0 });
    put('camp_table_lantern', -4, -3);
    put('camp_ladder', h - 1, -h + 4);
  }
  // kind flavour
  if (kind === 'orc') {
    put('camp_skull_trophy', -1, h - 2, { variant: 1 });
    put('camp_skull_trophy', 2, -2);
    put('camp_cage', -h + 1, -1);
    for (const dx of [-h + 1, h - 3]) put('camp_stakes', dx, h + 2, { variant: 1 });
  }
  if (kind === 'bandit') {
    put('camp_cage', h - 1, -2);
    put('camp_weapon_rack', -2, -2);
    put('camp_stakes', -h + 2, h + 2);
  }
  if (kind === 'forest') {
    put('camp_planks', 2, -3);
    put('camp_stones', -1, -3);
  }
  if (dead) {
    for (let i = 0; i < 3; i++) put(rnd() < 0.5 ? 'camp_planks' : 'camp_stones', Math.floor(rr(rnd, -h + 2, h - 2)), Math.floor(rr(rnd, -h + 2, h - 2)), { variant: 1 });
    put('camp_ladder', 2, 3, { variant: 1 });
  }
}
