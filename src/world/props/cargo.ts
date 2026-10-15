import { Model, rr } from './kit';
import type { BuildCtx, PropDef } from './types';

/**
 * Sheet 7 «Ящики и грузы»: crates (plain, big, reinforced, produce, stone, broken), barrels,
 * sacks and sack piles, hay bales, cart, pallet, table with goods, plank stack and loose planks.
 * Sizes follow the sheet in blocks (16 px each).
 */

const CRATE_TEX = [
  { side: 'crate', top: 'crate_top', bottom: 'crate_plain' },
  { side: 'crate_dark', top: 'crate_top', bottom: 'crate_plain' },
  { side: 'crate_old', top: 'crate_old', bottom: 'crate_plain' },
];

/** A 1-block crate at (x, y, z) bottom centre, size s px, optional small yaw. */
export function crate(m: Model, x: number, y: number, z: number, s = 16, v = 0, yaw = 0) {
  m.cbox(x, y, z, s, s, s, CRATE_TEX[v % CRATE_TEX.length], { rot: yaw ? { y: yaw } : undefined });
}

export function barrel(m: Model, x: number, y: number, z: number, h = 16) {
  m.cbox(x, y, z, 13, h, 13, { side: 'barrel', end: 'barrel_top' }, { bevel: 0 });
  m.cbox(x, y + h * 0.3, z, 15, h * 0.4, 15, { side: 'barrel', end: 'barrel_top' }, { uv: [0, 5], bevel: 0 });
  for (const yy of [y + 2, y + h - 4]) m.cbox(x, yy, z, 14.2, 2, 14.2, 'metal', { bevel: 0 });
  m.cbox(x, y + h, z, 11, 0.6, 11, 'barrel_top', { bevel: 0 });
}

export function sack(m: Model, x: number, y: number, z: number, rnd: () => number, s = 1) {
  const t = rnd() < 0.5 ? 0xffffff : 0xe8dcc8;
  const yaw = (rnd() - 0.5) * 0.6;
  const rot = { y: yaw, pivot: [x, y, z] as [number, number, number] };
  m.cbox(x, y, z, 12 * s, 7 * s, 11 * s, 'sack', { tint: t, rot });
  m.cbox(x, y + 7 * s, z, 10 * s, 3 * s, 9 * s, 'sack', { tint: t, rot });
  m.cbox(x, y + 10 * s, z, 5 * s, 2 * s, 5 * s, 'rope', { rot });
  m.cbox(x, y + 12 * s, z, 6 * s, 2 * s, 6 * s, 'sack', { tint: t, rot });
}

/** A sack lying on its side (for piles). */
function sackLying(m: Model, x: number, y: number, z: number, rnd: () => number, yaw = 0) {
  const t = rnd() < 0.5 ? 0xffffff : 0xe0d4be;
  const rot = { y: yaw, pivot: [x, y, z] as [number, number, number] };
  m.cbox(x, y, z, 15, 8, 10, 'sack', { tint: t, rot });
  m.cbox(x - 1, y + 1, z, 2, 6.5, 10.5, 'rope', { rot });
}

function crateProp(ctx: BuildCtx): Model {
  const m = new Model();
  crate(m, 0, 0, 0, 16, ctx.variant, (ctx.rnd() - 0.5) * 0.25);
  return m;
}

function bigCrate(_ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 32, 16, 16, { side: 'crate_plain', top: 'plank', bottom: 'plank_dark' });
  // planks run lengthwise on the long faces: overlay three boards
  for (const y of [1.5, 6, 10.5]) m.box(-15, y, 7.6, 30, 4, 0.8, 'plank', { bevel: 0.6, uv: [y * 3, 0] });
  for (const y of [1.5, 6, 10.5]) m.box(-15, y, -8.4, 30, 4, 0.8, 'plank', { bevel: 0.6 });
  // iron straps
  for (const x of [-11, 11]) m.cbox(x, -0.2, 0, 3, 16.6, 16.8, 'metal_dark', { bevel: 0.5 });
  for (const x of [-16, 16]) m.cbox(x, -0.2, 0, 1.4, 16.6, 16.8, 'metal_dark', { bevel: 0 });
  return m;
}

function reinforcedCrate(_ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 16, 16, 16, { side: 'crate_iron', top: 'crate_iron_top', bottom: 'crate_plain' });
  m.cbox(0, 7, 0, 16.8, 2, 16.8, 'metal_dark', { bevel: 0.5 });
  return m;
}

function produceCrate(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 16, 12, 16, { side: 'crate', top: 'produce', bottom: 'crate_plain' });
  m.cbox(0, 12, 0, 14, 1.5, 14, 'produce', { bevel: 0 });
  const goods = ['cabbage', 'pumpkin', 'apple', 'cabbage', 'pumpkin'];
  for (let i = 0; i < 5; i++) {
    const g = goods[(i + ctx.variant) % goods.length];
    const s = g === 'apple' ? 3 : rr(r, 4.5, 6);
    m.cbox(rr(r, -4.5, 4.5), 12.5, rr(r, -4.5, 4.5), s, s * 0.85, s, g, { bevel: 0.5, noAO: true });
  }
  // carrots / green tops poking out
  for (let i = 0; i < 4; i++) m.cbox(rr(r, -5, 5), 13, rr(r, -5, 5), 2, rr(r, 3, 6), 2, 'leaves', { bevel: 0, noAO: true, anim: { kind: 'sway', amp: 0.01, speed: 2 } });
  return m;
}

function barrelProp(ctx: BuildCtx): Model {
  const m = new Model();
  barrel(m, 0, 0, 0, ctx.variant === 1 ? 20 : 16);
  return m;
}

function sackProp(ctx: BuildCtx): Model {
  const m = new Model();
  sack(m, 0, 0, 0, ctx.rnd);
  return m;
}

function sackPile(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  sackLying(m, -8, 0, -2, r, 0.1);
  sackLying(m, 8, 0, -1, r, -0.15);
  sackLying(m, 0, 0, 8, r, 0.05);
  sackLying(m, -2, 8, -1, r, -0.1);
  sackLying(m, 7, 8, 2, r, 0.2);
  if (ctx.variant === 1) sack(m, 14, 0, 9, r, 0.8);
  return m;
}

function hayBale(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  m.cbox(0, 0, 0, 16, 15, 16, { side: 'hay', end: 'hay_top' });
  for (const x of [-4, 4]) m.cbox(x, -0.1, 0, 1.4, 15.3, 16.4, 'rope', { bevel: 0 });
  // loose straws on top and at the foot
  for (let i = 0; i < 6; i++) m.cbox(rr(r, -6, 6), 15, rr(r, -6, 6), 1, rr(r, 1, 3), 1, 'hay_top', { bevel: 0, noAO: true });
  for (let i = 0; i < 4; i++) m.cbox(rr(r, -10, 10), 0, rr(r, 8, 10), 1, 1, 4, 'hay_top', { bevel: 0, rot: { y: r() * 3 } });
  return m;
}

function wheel(m: Model, x: number, y: number, z: number, r = 9) {
  // spoked wheel facing ±z: rim of four planks, two crossed spokes and a hub
  m.cbox(x, y - r, z, r * 2 - 4, 3, 2.5, 'plank_dark');
  m.cbox(x, y + r - 3, z, r * 2 - 4, 3, 2.5, 'plank_dark');
  m.box(x - r, y - r + 2, z - 1.25, 3, r * 2 - 4, 2.5, 'plank_dark');
  m.box(x + r - 3, y - r + 2, z - 1.25, 3, r * 2 - 4, 2.5, 'plank_dark');
  for (const a of [0.785, -0.785]) m.cbox(x, y - r + 2, z, 1.6, r * 2 - 4, 1.6, 'beam_dark', { rot: { z: a, pivot: [x, y, z] } });
  m.cbox(x, y - 2, z, 4, 4, 4, 'metal_dark');
}

function cart(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const L = 44;
  const W = 26;
  const by = 11;
  // bed and sides
  m.cbox(0, by, 0, L, 3, W, { top: 'plank', side: 'beam', bottom: 'plank_dark' });
  for (const s of [-1, 1]) {
    m.cbox(0, by + 3, s * (W / 2 - 1), L, 6, 2, 'plank', { uv: [s * 5, 0] });
    for (const x of [-L / 2 + 1, 0, L / 2 - 1]) m.cbox(x, by + 3, s * (W / 2 - 1), 2.5, 9, 2.5, 'beam_dark');
  }
  m.cbox(-L / 2 + 1, by + 3, 0, 2, 6, W, 'plank');
  // axle and wheels
  m.cbox(-6, 7, 0, 3, 3, W + 6, 'beam_dark');
  for (const s of [-1, 1]) wheel(m, -6, 9, s * (W / 2 + 3));
  // shafts toward +x, resting on the ground
  for (const s of [-1, 1]) m.box(L / 2 - 4, by - 1, s * 8 - 1.5, 26, 3, 3, 'beam_dark', { rot: { z: -0.38, pivot: [L / 2 - 4, by, s * 8] } });
  // load: crates, a barrel and a sack
  crate(m, -12, by + 3, -4, 14, 0, 0.1);
  crate(m, -12, by + 17, -3, 12, 1, -0.15);
  crate(m, 3, by + 3, 5, 13, 2, -0.2);
  barrel(m, 4, by + 3, -6, 14);
  sack(m, 15, by + 3, 4, r, 0.8);
  return m;
}

function pallet(m: Model, w: number, d: number) {
  for (const z of [-d / 2 + 2, 0, d / 2 - 2]) m.cbox(0, 0, z, w, 2, 3, 'beam_old');
  for (let x = -w / 2 + 2.5; x <= w / 2 - 2.5; x += 5) m.cbox(x, 2, 0, 4, 1.5, d, 'plank_light', { bevel: 0.5 });
}

function palletCrates(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  pallet(m, 34, 32);
  const y = 3.5;
  crate(m, -8, y, -7, 15, 0, 0.05);
  crate(m, 8, y, -7, 15, 1, -0.05);
  crate(m, -8, y, 8, 15, 2, 0);
  barrel(m, 8, y, 8, 15);
  crate(m, -1, y + 15, -4, 14, 0, 0.3);
  m.cbox(0, y + 7, 0, 35, 1.2, 33, 'rope', { bevel: 0 });
  if (r() < 0.6) sack(m, -6, y + 15, 9, r, 0.75);
  return m;
}

function tableGoods(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // table
  m.box(-20, 13, -10, 30, 3, 20, { top: 'plank', side: 'beam', bottom: 'plank_dark' });
  for (const [x, z] of [[-18, -8], [8, -8], [-18, 8], [8, 8]]) m.cbox(x, 0, z, 3, 13, 3, 'beam_dark');
  m.box(-18, 4, -8, 26, 2, 2, 'beam_dark');
  // white cloth hanging over one end
  m.box(-4, 15.6, -10.5, 14, 0.8, 21, 'cloth_white', { bevel: 0 });
  m.box(9.6, 6, -10.5, 0.8, 10, 21, 'cloth_white', { bevel: 0, anim: { kind: 'flag', pivot: [10, 16, 0], axis: [1, 0, 0], amp: 0.02, speed: 1.4 } });
  // goods on the table: bottles, a small crate, a cabbage
  for (let i = 0; i < 3; i++) {
    const x = -16 + i * 4;
    m.cbox(x, 16, rr(r, -5, 3), 2.5, 5, 2.5, 'bottle', { bevel: 0 });
    m.cbox(x, 21, 0, 1.2, 1.5, 1.2, 'beam_dark', { bevel: 0 });
  }
  crate(m, -10, 16, 4, 9, 0, 0.3);
  m.cbox(2, 16, -3, 4, 3.5, 4, 'cabbage');
  // crates and a barrel stacked by the table
  crate(m, 17, 0, -5, 15, 0, 0.08);
  crate(m, 17, 15, -4, 12, 1, -0.2);
  crate(m, 17, 0, 10, 13, 2, -0.1);
  barrel(m, -16, 0, 17, 14);
  return m;
}

function plankStack(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let layer = 0; layer < 5; layer++) {
    const y = layer * 2.6;
    const n = 4 - (layer === 4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const z = -7.5 + i * 5 + (layer & 1) * 1;
      m.box(-16 + rr(r, -1.5, 1.5), y, z, 32, 2.4, 4.5, { side: 'beam', end: 'wood_end' }, { bevel: 0.6, uv: [layer * 7 + i * 3, 0] });
    }
  }
  // spacer battens
  for (const x of [-10, 10]) m.cbox(x, -0.5, 0, 3, 1.2, 20, 'beam_dark');
  m.cbox(0, 13, 0, 1.2, 0.8, 21, 'rope', { bevel: 0 });
  return m;
}

function brokenCrate(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // the remains of a crate: base, two walls (one snapped short), loose planks around
  m.cbox(0, 0, 0, 16, 2, 16, 'plank');
  m.box(-8, 2, -8, 16, 12, 2, 'crate');
  m.box(-8, 2, -6, 2, 7, 14, 'plank_v', { rot: { z: 0.1, pivot: [-8, 2, 0] } });
  for (let i = 0; i < 6; i++) {
    const x = rr(r, -16, 16);
    const z = rr(r, -14, 16);
    m.cbox(x, 0, z, 14, 1.6, 4, { side: 'beam', top: 'plank' }, { bevel: 0.5, rot: { y: r() * Math.PI, z: r() < 0.3 ? 0.25 : 0, pivot: [x, 0, z] } });
  }
  m.cbox(6, 0, 10, 5, 4, 5, 'crate_old', { rot: { y: 0.7 } });
  return m;
}

function loosePlanks(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 9; i++) {
    const x = rr(r, -14, 14);
    const z = rr(r, -8, 8);
    const len = rr(r, 14, 26);
    const lean = r() < 0.35;
    m.cbox(x, lean ? 0 : (i % 3) * 1.6, z, len, 1.8, 4, { side: 'beam_old', top: 'plank_old' }, { bevel: 0.5, rot: { y: r() * Math.PI, z: lean ? 0.3 : 0, pivot: [x, 0, z] } });
  }
  for (let i = 0; i < 3; i++) m.cbox(rr(r, -12, 12), 0, rr(r, -8, 8), 3, 2, 3, 'stone_smooth', { tint: 0x8a8a8a });
  return m;
}

function stoneCrate(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 16, 15, 16, ctx.variant === 1 ? 'stone_mossy' : 'stone_grey');
  m.cbox(0, 15, 0, 17, 2, 17, 'stone_smooth', { tint: 0xb8b8b8 });
  return m;
}

function crateStack(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  crate(m, -8, 0, -2, 16, 0, 0.05);
  crate(m, 9, 0, -3, 16, 1, -0.1);
  crate(m, 0, 16, -2, 15, 2, 0.15);
  crate(m, 2, 0, 12, 12, 0, 0.3);
  if (r() < 0.5) barrel(m, -10, 0, 12, 14);
  return m;
}

export const CARGO_PROPS: PropDef[] = [
  { id: 'crate', name: 'Деревянный ящик', category: 'cargo', size: [1, 1], variants: 3, solid: true, build: crateProp },
  { id: 'crate_big', name: 'Большой ящик', category: 'cargo', size: [2, 1], solid: true, build: bigCrate },
  { id: 'crate_reinforced', name: 'Усиленный ящик', category: 'cargo', size: [1, 1], solid: true, build: reinforcedCrate },
  { id: 'crate_produce', name: 'Ящик с продуктами', category: 'cargo', size: [1, 1], variants: 3, solid: true, build: produceCrate },
  { id: 'barrel', name: 'Бочка', category: 'cargo', size: [1, 1], variants: 2, solid: true, build: barrelProp },
  { id: 'sack', name: 'Мешок', category: 'cargo', size: [1, 1], solid: true, build: sackProp },
  { id: 'sack_pile', name: 'Связка мешков', category: 'cargo', size: [2, 1], variants: 2, solid: true, build: sackPile },
  { id: 'hay_bale', name: 'Тюк сена', category: 'cargo', size: [1, 1], solid: true, build: hayBale },
  { id: 'cart', name: 'Телега с ящиками', category: 'cargo', size: [3, 2], solid: true, height: 2, build: cart },
  { id: 'pallet_crates', name: 'Паллета с ящиками', category: 'cargo', size: [2, 2], solid: true, height: 2, build: palletCrates },
  { id: 'table_goods', name: 'Стол с ящиками', category: 'cargo', size: [2, 2], solid: true, build: tableGoods },
  { id: 'plank_stack', name: 'Стопка досок', category: 'cargo', size: [2, 1], solid: true, build: plankStack },
  { id: 'crate_broken', name: 'Разбитый ящик', category: 'cargo', size: [1, 1], solid: false, build: brokenCrate },
  { id: 'planks_loose', name: 'Пустые доски', category: 'cargo', size: [2, 1], solid: false, build: loosePlanks },
  { id: 'crate_stone', name: 'Каменный ящик', category: 'cargo', size: [1, 1], variants: 2, solid: true, build: stoneCrate },
  { id: 'crate_stack', name: 'Штабель ящиков', category: 'cargo', size: [2, 2], solid: true, height: 2, build: crateStack },
];
