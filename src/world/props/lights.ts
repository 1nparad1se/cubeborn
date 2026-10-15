import { Model, flame, ivy, lantern, lanternH, post, rr, stone, torch, FIRE_LIGHT } from './kit';
import type { BuildCtx, PropDef } from './types';

/**
 * Sheet 6 «Светильники»: campfire, lanterns (post, parapet, hanging, floor, mine, tree sconce),
 * wall torch, fire bowl, torch column, chandelier, magic crystal, glowing mushrooms, glowstone,
 * fireflies, standing torch. Flames flicker in the shader, fire/embers/smoke are GPU particles
 * and every source registers a light for the shared light pool (brighter at night).
 */

const swing = (pivot: [number, number, number], amp = 0.09, speed = 1.8, axis: [number, number, number] = [0, 0, 1]) => ({ kind: 'swing' as const, pivot, axis, amp, speed });

/** Chain of `n` links hanging down from (x, y, z). */
function chain(m: Model, x: number, y: number, z: number, len: number) {
  m.box(x - 1, y - len, z - 1, 2, len, 2, 'chain', { bevel: 0, noAO: true });
}

function campfire(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  // ash bed and ember glow inside the ring
  m.cbox(0, 0, 0, 30, 1, 30, 'ash', { bevel: 0 });
  m.cbox(0, 1, 0, 18, 1, 18, 'ember_bed', { glow: 1.4, flicker: 0.6, bevel: 0 });
  // ring of dark stones (two sizes, like the sheet)
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.2;
    const d = 17 + r() * 2;
    stone(m, Math.cos(a) * d, 0, Math.sin(a) * d, 7 + r() * 2.5, r, i % 3 === 0 ? 'cobble' : 'stone_smooth');
  }
  // crossed logs leaning into the middle
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cx = Math.cos(a) * 6;
    const cz = Math.sin(a) * 6;
    m.cbox(cx, 1, cz, 4, 4, 18, { side: 'bark', end: 'log_end' }, { rot: { y: -a + Math.PI / 2, x: 0.35, pivot: [cx, 3, cz] } });
  }
  m.cbox(0, 2, 0, 10, 3, 4, 'coal', { glow: 0.8, flicker: 0.5 });
  m.add(flame(0, 2, 0, 8, { smoke: true, lightK: 1.6 }));
  m.lights = [{ x: 0, y: 22, z: 0, color: FIRE_LIGHT, intensity: 1.9, radius: 10, flicker: 1, day: 0.45 }];
  return m;
}

function lampPost(ctx: BuildCtx): Model {
  const m = new Model();
  const H = 58;
  const px = -5;
  // stone foot, post, arm and diagonal brace
  m.cbox(px, 0, 0, 10, 4, 10, 'stone_smooth', { tint: 0x9a9a9a });
  post(m, px, 4, 0, H - 4, 6, 'beam_dark', false);
  m.cbox(px, H, 0, 8, 3, 8, { side: 'beam_dark', end: 'wood_end' });
  m.box(px - 3, H - 6, -2, 24, 4, 4, { side: 'beam_dark', end: 'wood_end' });
  m.box(px + 2, H - 20, -1.5, 3, 18, 3, 'beam_dark', { rot: { z: -0.7, pivot: [px + 3, H - 20, 0] } });
  // a metal hook and the lantern hanging from the arm end
  const hx = px + 17;
  m.box(hx - 1, H - 9, -1, 2, 3, 2, 'metal');
  const k = m.mark;
  chain(m, hx, H - 9, 0, 4);
  m.add(lantern(hx, H - 13 - lanternH('m'), 0, 'm'));
  m.animate(k, swing([hx, H - 7, 0], 0.08, 1.7));
  ivy(m, px - 3, 4, H - 10, 3, ctx.rnd, 'pz', 7);
  ivy(m, px + 3, 6, H - 18, 0, ctx.rnd, 'px', 4);
  return m;
}

function wallTorch(ctx: BuildCtx): Model {
  const m = new Model();
  const back = -10;
  if (ctx.variant === 1) {
    // a chunk of mossy wall to show the torch on
    m.box(-12, 0, back - 10, 24, 44, 10, 'stone_mossy');
    ivy(m, -10, 2, 30, back, ctx.rnd, 'pz', 5);
  }
  const y = 24;
  // iron backplate and holder arm
  m.box(-3, y - 2, back, 6, 9, 1.5, 'metal_dark');
  m.box(-1, y, back + 1, 2, 2, 5, 'metal');
  m.box(-2, y - 1, back + 5, 4, 4, 4, 'metal_dark');
  m.add(torch(0, y - 4, back + 7, 11, 0.32));
  return m;
}

function parapetLantern(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 18, 18, 18, 'stone_mossy');
  m.cbox(0, 18, 0, 20, 3, 20, 'stone_smooth');
  ivy(m, -8, 0, 12, 9, ctx.rnd, 'pz', 4);
  ivy(m, 9, 0, 10, -6, ctx.rnd, 'px', 3);
  m.add(lantern(0, 21, 0, 'm'));
  return m;
}

function fireBowl(ctx: BuildCtx): Model {
  const m = new Model();
  // stepped stone base, pedestal and a wide iron-rimmed bowl
  m.cbox(0, 0, 0, 28, 5, 28, 'stone_mossy');
  m.cbox(0, 5, 0, 20, 5, 20, 'stone');
  m.cbox(0, 10, 0, 10, 14, 10, 'stone_smooth');
  m.cbox(0, 24, 0, 16, 3, 16, 'stone_smooth');
  m.cbox(0, 27, 0, 24, 6, 24, 'stone_smooth');
  m.cbox(0, 33, 0, 26, 2, 26, 'metal_dark');
  m.cbox(0, 33, 0, 20, 2.5, 20, 'coal', { glow: 1, flicker: 0.6 });
  m.add(flame(0, 34, 0, 6, { smoke: true, lightK: 1.3 }));
  ivy(m, -13, 0, 8, 13, ctx.rnd, 'pz', 3);
  return m;
}

function hangingLantern(ctx: BuildCtx): Model {
  const m = new Model();
  const H = 46;
  const px = -8;
  post(m, px, 0, 0, H, 6, 'beam_dark', false);
  m.box(px - 4, H, -3, 28, 5, 6, { side: 'beam_dark', end: 'wood_end' });
  m.box(px + 2, H - 14, -1.5, 3, 14, 3, 'beam_dark', { rot: { z: -0.75, pivot: [px + 3, H - 14, 0] } });
  m.cbox(px, 0, 0, 10, 3, 10, 'beam_dark');
  const hx = px + 18;
  const k = m.mark;
  chain(m, hx, H, 0, 10);
  m.add(lantern(hx, H - 10 - lanternH('m'), 0, 'm'));
  m.animate(k, swing([hx, H, 0], 0.1, 1.5));
  if (ctx.rnd() < 0.7) ivy(m, px - 3, 2, H - 8, 3, ctx.rnd, 'pz', 5);
  return m;
}

function floorLantern(_ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 12, 3, 12, 'stone_smooth', { tint: 0x9a9a9a });
  m.cbox(0, 3, 0, 6, 10, 6, { side: 'plank_v_dark', end: 'wood_end' });
  m.cbox(0, 13, 0, 10, 2, 10, 'beam_dark');
  m.add(lantern(0, 15, 0, 'm'));
  return m;
}

function torchColumn(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 20, 5, 20, 'stone_mossy');
  m.cbox(0, 5, 0, 14, 36, 14, 'stone');
  m.cbox(0, 41, 0, 18, 4, 18, 'stone_smooth');
  // iron brazier cup
  m.cbox(0, 45, 0, 8, 2, 8, 'metal_dark');
  m.cbox(0, 47, 0, 12, 4, 12, 'metal_dark');
  m.cbox(0, 50, 0, 9, 1.5, 9, 'coal', { glow: 1, flicker: 0.6 });
  m.add(flame(0, 51, 0, 4, { smoke: true }));
  ivy(m, -7, 5, 30, 7, ctx.rnd, 'pz', 6);
  return m;
}

function chandelier(_ctx: BuildCtx): Model {
  const m = new Model();
  const y = 40;
  chain(m, 0, 64, 0, 64 - y - 3);
  m.cbox(0, y, 0, 40, 3, 4, 'beam_dark');
  m.cbox(0, y, 0, 4, 3, 40, 'beam_dark');
  m.cbox(0, y - 2, 0, 8, 7, 8, 'metal_dark');
  for (const [x, z] of [[-18, 0], [18, 0], [0, -18], [0, 18]]) {
    m.cbox(x, y + 3, z, 5, 2, 5, 'metal');
    m.cbox(x, y + 5, z, 2.5, 5, 2.5, 'paper');
    m.add(flame(x, y + 10, z, 1.4, { embers: false, light: false }));
  }
  m.light(0, y + 8, 0, 0xffb860, 1.4, 8, 0.4);
  return m;
}

function mineLantern(ctx: BuildCtx): Model {
  const m = new Model();
  // a mine support frame: two rough posts, a cap beam and a lantern hanging in the middle
  for (const x of [-20, 20]) {
    m.cbox(x, 0, 0, 7, 50, 7, { side: 'bark', end: 'log_end' });
    m.cbox(x, 0, 0, 10, 4, 10, 'stone_smooth', { tint: 0x8a8a8a });
  }
  m.cbox(0, 50, 0, 52, 7, 8, 'beam_old');
  for (const s of [-1, 1]) m.box(s * 17 - 1.5, 38, -1.5, 3, 14, 3, 'beam_old', { rot: { z: s * 0.8, pivot: [s * 17, 45, 0] } });
  const k = m.mark;
  chain(m, 0, 50, 0, 6);
  m.add(lantern(0, 44 - lanternH('s'), 0, 's', 'metal_dark'));
  m.animate(k, swing([0, 50, 0], 0.07, 1.3));
  if (ctx.rnd() < 0.5) stone(m, 10, 0, 6, 6, ctx.rnd, 'cobble');
  return m;
}

function magicCrystal(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  for (let i = 0; i < 5; i++) stone(m, rr(r, -8, 8), 0, rr(r, -8, 8), 8 + r() * 3, r, 'stone');
  const blue = ctx.variant === 1 ? 'crystal_cyan' : 'crystal';
  const spikes: [number, number, number, number, number][] = [
    [0, 0, 6, 30, 0],
    [-6, 3, 4, 18, -0.35],
    [6, -2, 4, 20, 0.3],
    [2, 7, 3, 13, 0.4],
    [-4, -6, 3, 14, -0.3],
  ];
  for (const [x, z, w, h, lean] of spikes) {
    m.cbox(x, 3, z, w, h, w, blue, { glow: 1.5, bevel: 1, rot: { z: lean, x: lean * 0.5, pivot: [x, 3, z] } });
    m.cbox(x, 3 + h, z, w * 0.5, w * 0.8, w * 0.5, blue, { glow: 2, bevel: 0, rot: { z: lean, x: lean * 0.5, pivot: [x, 3, z] } });
  }
  const col = ctx.variant === 1 ? 0x00e5ff : 0x3b82ff;
  m.emit({ kind: 'motes', x: 0, y: 6, z: 0, count: 10, spread: 14, height: 40, size: 1.4, color: ctx.variant === 1 ? 0x9ffcff : 0x9cc4ff, color2: col });
  m.light(0, 20, 0, col, 1.3, 7, 0.08, 0.6);
  return m;
}

function treeSconce(ctx: BuildCtx): Model {
  const m = new Model();
  const back = -8;
  if (ctx.variant === 1) {
    // a trunk to hang it on: bark column with root flares and a leafy top
    m.box(-9, 0, back - 16, 18, 57, 16, { side: 'bark', end: 'log_end' });
    m.box(-12, 0, back - 18, 6, 6, 8, 'bark');
    m.box(7, 0, back - 10, 7, 5, 6, 'bark');
    m.box(-14, 56, back - 22, 28, 8, 26, 'leaves', { bevel: 0 });
    ivy(m, -8, 4, 50, back, ctx.rnd, 'pz', 6);
  }
  const y = 30;
  m.box(-3, y - 4, back, 6, 10, 2, 'beam_dark');
  m.box(-1.5, y + 3, back + 2, 3, 3, 12, 'beam_dark');
  m.box(-1.5, y - 3, back + 2, 3, 3, 3, 'beam_dark', { rot: { x: -0.8, pivot: [0, y - 3, back + 2] } });
  const hx = back + 12;
  const k = m.mark;
  chain(m, 0, y + 3, hx, 3);
  m.add(lantern(0, y - lanternH('s'), hx, 's'));
  m.animate(k, swing([0, y + 3, hx], 0.08, 1.6, [1, 0, 0]));
  return m;
}

function glowMushrooms(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const big = i === 0;
    const x = big ? 0 : rr(r, -9, 9);
    const z = big ? 0 : rr(r, -9, 9);
    const h = big ? 12 : rr(r, 4, 9);
    const w = big ? 3 : 2;
    const cap = big ? 11 : rr(r, 5, 8);
    m.cbox(x, 0, z, w, h, w, 'mushroom_stem', { glow: 0.3 });
    m.cbox(x, h, z, cap, big ? 4 : 3, cap, { side: 'mushroom_glow', top: 'mushroom_glow', bottom: 'mushroom_stem' }, { glow: 1.4, flicker: 0.1 });
    m.cbox(x, h + (big ? 4 : 3), z, cap - 4, 2, cap - 4, 'mushroom_glow', { glow: 1.6 });
  }
  m.emit({ kind: 'motes', x: 0, y: 4, z: 0, count: 6, spread: 10, height: 26, size: 1.2, color: 0xa8f8ff, color2: 0x3b82ff });
  m.light(0, 10, 0, 0x2ad8ff, 0.8, 4.5, 0.1, 0.4);
  return m;
}

function glowstone(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 16, 16, 16, 'glowstone', { glow: 1.6, flicker: 0.05 });
  if (ctx.variant === 1) m.cbox(10, 0, 6, 8, 8, 8, 'glowstone', { glow: 1.6, rot: { y: 0.4 } });
  m.light(0, 10, 0, 0xffc860, 1.2, 6, 0.05, 0.5);
  return m;
}

function fireflies(_ctx: BuildCtx): Model {
  const m = new Model();
  m.emit({ kind: 'fireflies', x: 0, y: 6, z: 0, count: 12, spread: 36, height: 44, size: 1.6 });
  return m;
}

function standingTorch(ctx: BuildCtx): Model {
  const m = new Model();
  m.cbox(0, 0, 0, 6, 2, 6, 'dirt', { bevel: 0 });
  m.cbox(0, 0, 0, 3, 30, 3, { side: 'plank_v_dark', end: 'wood_end' });
  m.cbox(0, 30, 0, 5, 3, 5, 'metal_dark');
  m.cbox(0, 33, 0, 4, 4, 4, 'cloth_brown');
  m.add(flame(0, 37, 0, 2.6, { smoke: ctx.rnd() < 0.5 }));
  return m;
}

export const LIGHT_PROPS: PropDef[] = [
  { id: 'campfire', name: 'Костёр', category: 'lights', size: [2, 2], solid: true, height: 1, tags: ['fire', 'camp'], build: campfire },
  { id: 'lamp_post', name: 'Фонарь на столбе', category: 'lights', size: [1, 1], solid: true, tags: ['lantern', 'road'], build: lampPost },
  {
    id: 'wall_torch',
    name: 'Факел на стене',
    category: 'lights',
    size: [1, 1],
    variants: 2,
    solid: (_x, _z, c) => c.variant === 1,
    tags: ['fire', 'wall'],
    build: wallTorch,
  },
  { id: 'parapet_lantern', name: 'Фонарь на парапете', category: 'lights', size: [1, 1], solid: true, tags: ['lantern', 'bridge'], build: parapetLantern },
  { id: 'fire_bowl', name: 'Чаша с огнём', category: 'lights', size: [1, 1], solid: true, tags: ['fire', 'shrine'], build: fireBowl },
  { id: 'hanging_lantern', name: 'Подвесной фонарь', category: 'lights', size: [1, 1], solid: true, tags: ['lantern'], build: hangingLantern },
  { id: 'floor_lantern', name: 'Напольный фонарь', category: 'lights', size: [1, 1], solid: true, tags: ['lantern'], build: floorLantern },
  { id: 'torch_column', name: 'Колонна с факелом', category: 'lights', size: [1, 1], solid: true, tags: ['fire', 'ruins'], build: torchColumn },
  { id: 'chandelier', name: 'Подвесная люстра', category: 'lights', size: [2, 2], solid: false, tags: ['indoor'], build: chandelier },
  { id: 'mine_lantern', name: 'Шахтный фонарь', category: 'lights', size: [2, 1], solid: false, tags: ['lantern', 'mine'], build: mineLantern },
  { id: 'magic_crystal', name: 'Магический кристалл', category: 'lights', size: [1, 1], variants: 2, solid: true, tags: ['magic', 'cave'], build: magicCrystal },
  {
    id: 'tree_sconce',
    name: 'Бра на дереве',
    category: 'lights',
    size: [1, 1],
    variants: 2,
    solid: (_x, _z, c) => c.variant === 1,
    tags: ['lantern', 'forest'],
    build: treeSconce,
  },
  { id: 'glow_mushrooms', name: 'Светящиеся грибы', category: 'lights', size: [1, 1], solid: false, tags: ['magic', 'cave', 'forest'], build: glowMushrooms },
  { id: 'glowstone', name: 'Светящийся камень', category: 'lights', size: [1, 1], variants: 2, solid: true, tags: ['cave'], build: glowstone },
  { id: 'fireflies', name: 'Светлячки', category: 'lights', size: [1, 1], solid: false, tags: ['night', 'forest'], build: fireflies },
  { id: 'standing_torch', name: 'Факел на шесте', category: 'lights', size: [1, 1], solid: true, tags: ['fire', 'camp'], build: standingTorch },
];
