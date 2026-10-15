import { Model, rr } from './kit';
import type { Anim, BuildCtx, PropDef } from './types';
import '../textures/trees';
import '../textures/vegetation';

/**
 * Деревья (лист 1): blocky MCD-style trees built from leaf blocks in layers (нижний / средний /
 * верхний слой листвы) over a bark trunk with root flares and low branches, grass and flowers at
 * the foot. Oak 7x7x7 blocks (green / yellow / autumn), birch, pine, big tree, oak with ivy and moss.
 * Helpers `crown`, `trunk`, `tuft` are exported for vegetation.ts (dead trees, snow pines, bushes).
 */

const B = 16;

export interface CrownLayer {
  /** Bottom of the layer (px). */
  y: number;
  /** Half width in blocks (n = 3 → 7 blocks across). */
  n: number;
  /** Height in blocks. */
  h?: number;
  /** Chance to drop an edge block (default 0.15). */
  gap?: number;
}

export const crownSway = (cx: number, y: number, cz: number, amp = 0.006): Anim => ({ kind: 'sway', pivot: [cx, y, cz], amp, speed: 1.1 });

/**
 * Layered leaf crown: per layer a solid core plus a ring of jittered leaf blocks (corners mostly
 * dropped) and a few half blocks poking out, so the silhouette is the sheet's stepped, jagged cube
 * cluster. `tex` = lit leaf tile, `dark` = shadow tile (used more on the lower layers).
 */
export function crown(m: Model, cx: number, cz: number, layers: CrownLayer[], tex: string, dark: string, rnd: () => number, b = B, sway = true) {
  const from = m.mark;
  const base = layers[0].y;
  layers.forEach((L, li) => {
    const n = L.n;
    const lh = (L.h ?? 1) * b;
    const lowK = 1 - li / Math.max(1, layers.length - 1); // 1 at the bottom
    const pickTex = () => (rnd() < 0.15 + 0.45 * lowK ? dark : tex);
    if (n === 0) {
      m.cbox(cx + rr(rnd, -2, 2), L.y, cz + rr(rnd, -2, 2), b + rr(rnd, -1, 2), lh, b + rr(rnd, -1, 2), pickTex(), { noAO: true, uv: [rnd() * 16, rnd() * 16] });
      return;
    }
    // core
    const cw = (2 * n - 1) * b;
    m.cbox(cx, L.y, cz, cw, lh, cw, li === 0 ? dark : tex, { noAO: true, uv: [li * 5, li * 3] });
    for (let gx = -n; gx <= n; gx++)
      for (let gz = -n; gz <= n; gz++) {
        if (Math.max(Math.abs(gx), Math.abs(gz)) !== n) continue;
        const corner = Math.abs(gx) === n && Math.abs(gz) === n;
        if (corner && rnd() < 0.8) continue;
        if (rnd() < (L.gap ?? 0.15)) continue;
        const s = b + rr(rnd, -3, 2);
        const hh = lh + rr(rnd, -4, 3);
        m.cbox(cx + gx * b + rr(rnd, -2, 2), L.y + rr(rnd, -3, 3), cz + gz * b + rr(rnd, -2, 2), s, hh, s, pickTex(), { noAO: true, uv: [rnd() * 16, rnd() * 16] });
      }
    // half blocks breaking the outline (the sheet's "corner leaf blocks")
    const k = 2 + n * 2;
    for (let i = 0; i < k; i++) {
      const a = rnd() * Math.PI * 2;
      const r = (n + 0.45) * b;
      const s = b * rr(rnd, 0.4, 0.6);
      m.cbox(cx + Math.cos(a) * r, L.y + rr(rnd, 0, lh - s), cz + Math.sin(a) * r, s, s, s, rnd() < 0.5 ? tex : dark, { noAO: true, uv: [rnd() * 16, rnd() * 16] });
    }
  });
  // bright top tufts
  const top = layers[layers.length - 1];
  for (let i = 0; i < 3; i++) {
    const s = b * rr(rnd, 0.45, 0.6);
    m.cbox(cx + rr(rnd, -top.n - 0.5, top.n + 0.5) * b * 0.6, top.y + (top.h ?? 1) * b - 2, cz + rr(rnd, -top.n - 0.5, top.n + 0.5) * b * 0.6, s, s, s, tex, { noAO: true });
  }
  if (sway) m.animate(from, crownSway(cx, base, cz));
}

/** Trunk with root flares and optional low branches reaching into the crown. */
export function trunk(m: Model, x: number, z: number, w: number, h: number, bark: string, rnd: () => number, opts: { roots?: number; branches?: number; top?: string } = {}) {
  m.cbox(x, 0, z, w, h, w, { side: bark, end: opts.top ?? 'trunk_top' });
  // a slightly wider, darker base
  m.cbox(x, 0, z, w + 2, Math.min(10, h * 0.25), w + 2, bark, { uv: [5, 0] });
  const roots = opts.roots ?? 4;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rr(rnd, -0.3, 0.3);
    const len = rr(rnd, 5, 9);
    const rw = w * rr(rnd, 0.3, 0.45);
    const d = w / 2 + len / 2 - 1;
    m.cbox(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, Math.abs(Math.cos(a)) > 0.7 ? len : rw, rr(rnd, 3, 6), Math.abs(Math.cos(a)) > 0.7 ? rw : len, bark, { rot: { y: rr(rnd, -0.2, 0.2) } });
  }
  const br = opts.branches ?? 2;
  for (let i = 0; i < br; i++) {
    const a = rnd() * Math.PI * 2;
    const y0 = h * rr(rnd, 0.55, 0.85);
    const len = w * rr(rnd, 0.9, 1.4);
    const bw = Math.max(3, w * 0.35);
    // a branch along +x rotated around y (heading) and tilted up around z
    m.box(x, y0, z - bw / 2, len, bw, bw, bark, { rot: { y: a, z: 0.7, pivot: [x, y0, z] } });
  }
}

/** Grass tuft: two crossed cut-out planes. (x, z) centre, s = size px. */
export function tuft(m: Model, x: number, y: number, z: number, s: number, tex = 'grass_blades', rnd?: () => number, h = s) {
  const a = rnd ? rnd() * 1.5 : 0;
  const anim: Anim = { kind: 'sway', pivot: [x, y, z], amp: 0.01, speed: 2.2 };
  m.cbox(x, y, z, s, h, 0.2, tex, { bevel: 0, rot: { y: a, pivot: [x, y, z] }, anim });
  m.cbox(x, y, z, s, h, 0.2, tex, { bevel: 0, rot: { y: a + Math.PI / 2, pivot: [x, y, z] }, anim });
}

/** Small flower: stem plus a petal head. */
export function flower(m: Model, x: number, y: number, z: number, color: string, h = 6, s = 4) {
  const anim: Anim = { kind: 'sway', pivot: [x, y, z], amp: 0.008, speed: 2.4 };
  m.cbox(x, y, z, 1, h, 1, 'flower_stem', { bevel: 0, anim });
  m.cbox(x, y + h, z, s, 1.5, s, 'petal_' + color, { bevel: 0, noAO: true, anim });
  m.cbox(x, y + h + 1.5, z, Math.max(1, s * 0.35), 0.8, Math.max(1, s * 0.35), 'petal_yellow', { bevel: 0, noAO: true, tint: 0xd08020, anim });
}

/** Grass, flowers and a moss patch around a trunk (the sheet's tree base). */
function treeBase(m: Model, rnd: () => number, r: number, flowers = true) {
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r + rr(rnd, 1, 12);
    tuft(m, Math.cos(a) * d, 0, Math.sin(a) * d, rr(rnd, 6, 11), rnd() < 0.3 ? 'grass_blades_tall' : 'grass_blades', rnd);
  }
  if (flowers) {
    const cols = ['white', 'white', 'blue', 'purple', 'yellow'];
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2;
      const d = r + rr(rnd, 3, 14);
      flower(m, Math.cos(a) * d, 0, Math.sin(a) * d, cols[Math.floor(rnd() * cols.length)], rr(rnd, 3, 6), 3);
    }
  }
  m.cbox(rr(rnd, -4, 4), 0, rr(rnd, 4, 8), rr(rnd, 8, 14), 1, rr(rnd, 6, 10), 'moss', { bevel: 0 });
}

type Leaf = { tex: string; dark: string };
const LEAVES: Record<string, Leaf> = {
  green: { tex: 'leaf_oak', dark: 'leaf_oak_dark' },
  yellow: { tex: 'leaf_yellow', dark: 'leaf_yellow_dark' },
  autumn: { tex: 'leaf_autumn', dark: 'leaf_autumn_dark' },
  birch: { tex: 'leaf_birch', dark: 'leaf_birch_dark' },
};

/** Oak 7x7x7 blocks: trunk ~3 blocks, crown of 3 leaf layers + cap. Variant changes the shape. */
function oak(leaf: Leaf, ivyMoss = false) {
  return (ctx: BuildCtx): Model => {
    const m = new Model();
    const r = ctx.rnd;
    const v = ctx.variant;
    const th = [50, 46, 54][v % 3];
    trunk(m, 0, 0, 14, th + 10, 'bark_oak', r, { roots: 5, branches: 2 });
    const y0 = th;
    const layers: CrownLayer[] =
      v === 1
        ? [{ y: y0, n: 2, h: 1.1, gap: 0.2 }, { y: y0 + 18, n: 3, h: 1, gap: 0.3 }, { y: y0 + 34, n: 2 }, { y: y0 + 50, n: 1 }]
        : v === 2
          ? [{ y: y0, n: 2, h: 1.2 }, { y: y0 + 18, n: 3, h: 1.1, gap: 0.2 }, { y: y0 + 36, n: 2 }, { y: y0 + 52, n: 1 }]
          : [{ y: y0, n: 2, h: 1.1, gap: 0.1 }, { y: y0 + 17, n: 3, h: 1.1, gap: 0.25 }, { y: y0 + 34, n: 2, h: 1.1 }, { y: y0 + 51, n: 1 }];
    crown(m, 0, 0, layers, leaf.tex, leaf.dark, r);
    if (ivyMoss) {
      // ivy sheets climbing the visible trunk faces and moss on the roots
      m.box(-6, 2, 7.2, 12, th - 4, 0.3, 'ivy_leaf', { bevel: 0 });
      m.box(7.2, 6, -5, 0.3, th - 10, 10, 'ivy_leaf', { bevel: 0, uv: [5, 3] });
      m.box(-7.3, 0, -7.3, 14.6, 8, 14.6, 'moss_tree', { bevel: 0 });
      for (let i = 0; i < 4; i++) {
        const yy = rr(r, 6, th - 6);
        m.cbox(rr(r, -5, 5), yy, 7.5, 3, 3, 1.5, 'leaf_oak', { bevel: 0 });
      }
      // hanging ivy from the crown edge
      for (let i = 0; i < 3; i++) {
        const a = r() * Math.PI * 2;
        const x = Math.cos(a) * 40;
        const z = Math.sin(a) * 40;
        const len = rr(r, 12, 22);
        m.cbox(x, y0 - len + 4, z, 5, len, 0.3, 'ivy_leaf', { bevel: 0, anim: { kind: 'swing', pivot: [x, y0 + 4, z], amp: 0.06, speed: 1.3 } });
      }
    }
    treeBase(m, r, 9);
    return m;
  };
}

function birch(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  trunk(m, 0, 0, 10, 62, 'bark_birch', r, { roots: 3, branches: 2 });
  crown(m, 0, 0, [{ y: 46, n: 2, h: 1.1, gap: 0.2 }, { y: 62, n: 2, gap: 0.3 }, { y: 77, n: 1 }, { y: 92, n: 0, h: 0.8 }], LEAVES.birch.tex, LEAVES.birch.dark, r, 15);
  treeBase(m, r, 7);
  return m;
}

/** Pine: narrow stacked tiers of dark needle blocks, tall (≈7 blocks), straight trunk. */
function pine(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  trunk(m, 0, 0, 10, 40, 'bark_pine', r, { roots: 4, branches: 0 });
  const b = 14;
  crown(
    m,
    0,
    0,
    [
      { y: 20, n: 2, h: 0.7, gap: 0.35 },
      { y: 36, n: 2, h: 0.6, gap: 0.55 },
      { y: 46, n: 1, h: 0.8, gap: 0.1 },
      { y: 60, n: 1, h: 0.7, gap: 0.4 },
      { y: 72, n: 0, h: 1 },
      { y: 86, n: 0, h: 0.8 },
    ],
    'leaf_pine',
    'leaf_pine',
    r,
    b,
  );
  m.cbox(0, 96, 0, 5, 7, 5, 'leaf_pine', { noAO: true, anim: crownSway(0, 22, 0) });
  treeBase(m, r, 7, false);
  return m;
}

/** Big tree: 2-block trunk with heavy roots, crown ~9 blocks wide and ~10 tall. */
function bigTree(ctx: BuildCtx): Model {
  const m = new Model();
  const r = ctx.rnd;
  trunk(m, 0, 0, 26, 70, 'bark_oak', r, { roots: 7, branches: 3 });
  crown(
    m,
    0,
    0,
    [
      { y: 60, n: 4, h: 1.2, gap: 0.25 },
      { y: 80, n: 4, h: 1.1, gap: 0.3 },
      { y: 98, n: 3, h: 1.1 },
      { y: 116, n: 2 },
      { y: 132, n: 1, h: 0.9 },
    ],
    'leaf_oak',
    'leaf_oak_dark',
    r,
  );
  // moss and ivy on the old bark
  m.box(-10, 0, 13.3, 20, 10, 0.3, 'moss_tree', { bevel: 0 });
  m.box(-4, 8, 13.4, 9, 40, 0.3, 'ivy_leaf', { bevel: 0 });
  treeBase(m, r, 16);
  return m;
}

export const TREE_PROPS: PropDef[] = [
  { id: 'tree_oak', name: 'Дуб (зелёный)', category: 'trees', size: [1, 1], solid: true, variants: 3, tags: ['forest', 'tree'], build: oak(LEAVES.green) },
  { id: 'tree_oak_yellow', name: 'Дуб (жёлтый)', category: 'trees', size: [1, 1], solid: true, variants: 3, tags: ['forest', 'tree', 'autumn'], build: oak(LEAVES.yellow) },
  { id: 'tree_oak_autumn', name: 'Дуб (осенний)', category: 'trees', size: [1, 1], solid: true, variants: 3, tags: ['forest', 'tree', 'autumn'], build: oak(LEAVES.autumn) },
  { id: 'tree_birch', name: 'Берёза', category: 'trees', size: [1, 1], solid: true, tags: ['forest', 'tree'], build: birch },
  { id: 'tree_pine', name: 'Сосна', category: 'trees', size: [1, 1], solid: true, tags: ['forest', 'mountain', 'tree'], build: pine },
  { id: 'tree_big', name: 'Большое дерево', category: 'trees', size: [2, 2], solid: true, tags: ['forest', 'tree'], build: bigTree },
  { id: 'tree_oak_ivy', name: 'Дуб с плющом и мхом', category: 'trees', size: [1, 1], solid: true, variants: 3, tags: ['forest', 'tree', 'ruins'], build: oak(LEAVES.green, true) },
];
