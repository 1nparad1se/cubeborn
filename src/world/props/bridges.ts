import '../textures/bridges';
import { Model, ivy, lantern, lanternH, stone } from './kit';
import { barrel, crate } from './cargo';
import type { BuildCtx, PropDef, TexSpec } from './types';

/**
 * Sheets 8 «Деревянные мосты» and 9 «Каменные мосты».
 *
 * Bridges are parametric: `params.length` = span in cells along local +x (placeBridge sets it),
 * width is fixed per type (2 cells = 3 sheet blocks, wide ones 3 cells). The walkable deck rises
 * in whole blocks: the end cells sit at the bank height (0), the inner cells one block higher and
 * arched ones step up to 2-3 blocks at the crown; each step gets a half-height stair block so the
 * jump reads as stairs. Broken bridges leave a deck gap (null) that stays water.
 * Below the bank level (y < 0) piers and arches continue down into the water.
 */

const C = 24; // px per map cell
const WOOD = { deck: 'br_deck', beam: 'br_beam', post: 'br_post' };
const WOOD_OLD = { deck: 'br_deck_old', beam: 'br_beam_old', post: 'br_post_old' };
const WOOD_RED = { deck: 'br_deck_red', beam: 'br_beam', post: 'br_post' };
type WoodTex = typeof WOOD;

const swing = (pivot: [number, number, number], amp = 0.08, speed = 1.7) => ({ kind: 'swing' as const, pivot, axis: [0, 0, 1] as [number, number, number], amp, speed });

// ---------------------------------------------------------------- profile

interface Shape {
  /** Minimum / default span in cells. */
  min: number;
  def: number;
  width: number;
  /** Highest rise in blocks (the crown), 1 = flat raised deck. */
  rise: (L: number) => number;
  broken?: boolean;
  /** Pier: the third row is water except for the end platform. */
  pier?: boolean;
}

const spanOf = (s: Shape, p: Record<string, number>) => Math.max(s.min, Math.round(p.length ?? s.def));

function riseAt(s: Shape, L: number, fx: number): number {
  if (L < 3) return 0;
  return Math.max(0, Math.min(fx, L - 1 - fx, s.rise(L)));
}

/** Deck gap cells of a broken bridge (middle cell, two for long spans). */
function isGap(s: Shape, L: number, fx: number): boolean {
  if (!s.broken || L < 4) return false;
  const mid = Math.floor(L / 2);
  return fx === mid || (L >= 8 && fx === mid - 1);
}

function deckFn(s: Shape) {
  return (fx: number, fz: number, ctx: BuildCtx): number | null => {
    const L = spanOf(s, ctx.params);
    if (isGap(s, L, fx)) return null;
    if (s.pier && fz === s.width - 1 && fx < L - 2) return null;
    return riseAt(s, L, fx);
  };
}

// ---------------------------------------------------------------- shared pieces

/** Square post with an end-grain cap. (x, z) centre. */
function bpost(m: Model, x: number, y: number, z: number, h: number, w: number, t: WoodTex = WOOD, cap = true) {
  m.cbox(x, y, z, w, h, w, { side: t.post, end: 'br_end' });
  if (cap) {
    m.cbox(x, y + h, z, w + 2, 2, w + 2, { side: t.beam, end: 'br_end' });
    m.cbox(x, y + h + 2, z, w - 2, 2, w - 2, { side: t.beam, end: 'br_end' });
  }
}

/** Stone pier column of stacked bluish blocks, from y0 up to y1. */
function pierCol(m: Model, x: number, y0: number, y1: number, z: number, rnd: () => number, w = 14) {
  let y = y0;
  while (y < y1) {
    const h = Math.min(y1 - y, 10 + Math.floor(rnd() * 4));
    const ww = w + (rnd() < 0.5 ? 0 : 1);
    m.cbox(x + (rnd() - 0.5) * 1.5, y, z + (rnd() - 0.5) * 1.5, ww, h, ww, rnd() < 0.35 ? 'br_pier_moss' : 'br_pier', { tint: rnd() < 0.5 ? 0xffffff : 0xe4e8ee });
    y += h;
  }
}

/** Iron strap wrapped round a beam end. */
function strap(m: Model, x: number, y: number, z: number, w: number, h: number, d: number) {
  m.box(x - 0.4, y - 0.4, z - 0.4, w + 0.8, h + 0.8, d + 0.8, 'br_iron', { bevel: 0 });
}

/** Lantern on top of a post (post top at y). */
function topLantern(m: Model, x: number, y: number, z: number) {
  m.cbox(x, y, z, 8, 2, 8, { side: 'br_beam', end: 'br_end' });
  m.add(lantern(x, y + 2, z, 'm', 'beam_dark'));
}

/** Hanging banner from an arm at (x, y) on the given side: cloth 10x22 waving. */
function banner(m: Model, x: number, y: number, z: number, len = 22) {
  m.cbox(x, y, z, 14, 2, 2, { side: 'br_beam', end: 'br_end' });
  m.box(x - 6, y - len, z - 0.5, 12, len, 1, 'br_banner', { bevel: 0, noAO: true, anim: { kind: 'flag', pivot: [x, y, z], axis: [0, 0, 1], amp: 0.05, speed: 2.2 } });
}

/** Hanging chain from (x, y, z) down `len` px. */
function chainDown(m: Model, x: number, y: number, z: number, len: number) {
  m.box(x - 1, y - len, z - 1, 2, len, 2, 'chain', { bevel: 0, noAO: true });
}

/** Chain between two points (a straight rotated link run). */
function chainSeg(m: Model, ax: number, ay: number, bx: number, by: number, z: number) {
  const len = Math.hypot(bx - ax, by - ay);
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const a = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
  m.box(cx - 1, cy - len / 2, z - 1, 2, len, 2, 'chain', { bevel: 0, noAO: true, rot: { z: a, pivot: [cx, cy, z] } });
}

/** Sagging chain from a to b. */
function chainSag(m: Model, ax: number, ay: number, bx: number, by: number, z: number, sag: number) {
  const n = 8;
  let px = ax;
  let py = ay;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t - sag * 4 * t * (1 - t);
    chainSeg(m, px, py, x, y, z);
    px = x;
    py = y;
  }
}

function hangLantern(m: Model, x: number, y: number, z: number, chain = 4) {
  const k = m.mark;
  chainDown(m, x, y, z, chain);
  m.add(lantern(x, y - chain - lanternH('s'), z, 's', 'beam_dark'));
  m.animate(k, swing([x, y, z]));
}

// ---------------------------------------------------------------- wooden bridges

interface WoodOpts {
  t?: WoodTex;
  posts?: 'lantern' | 'chain' | 'roof' | 'none';
  banner?: boolean;
  /** Cell range [f0, f1) to build (stone bridges reuse the wooden deck for their middle). */
  range?: [number, number];
  /** Every n cells a stone pier. */
  pierEvery?: number;
}

function woodBridge(ctx: BuildCtx, s: Shape, o: WoodOpts = {}): Model {
  const m = new Model();
  const r = ctx.rnd;
  const t = o.t ?? WOOD;
  const L = spanOf(s, ctx.params);
  const W = s.width;
  const hw = (W * C) / 2;
  const X0 = (-L * C) / 2;
  const [f0, f1] = o.range ?? [0, L];
  const walkHw = s.pier ? hw - C / 2 : hw; // pier walkway is 2 cells wide (local z -hw .. hw - C)
  const zc = s.pier ? -C / 2 : 0;
  const top = (fx: number) => riseAt(s, L, fx) * C + 2;
  const every = o.pierEvery ?? 3;
  for (let fx = f0; fx < f1; fx++) {
    const x0 = X0 + fx * C;
    const y = top(fx);
    const isPlat = s.pier && fx >= L - 2;
    const zl = isPlat ? -hw : zc - walkHw;
    const zr = isPlat ? hw : zc + walkHw;
    if (isGap(s, L, fx)) {
      // broken gap: a dangling plank and a stub of a stringer
      m.box(x0, y - 7, zl + 2, 7, 5, 5, t.beam, { rot: { z: -0.5, pivot: [x0, y - 4, zl] } });
      m.box(x0 + 1, y - 18, zr - 10, 5, 3, 9, t.deck, { rot: { z: 1.1, x: 0.2, pivot: [x0 + 1, y - 2, zr - 6] } });
      continue;
    }
    // deck planks across the bridge
    for (let k = 0; k < 4; k++) {
      if (s.broken && r() < 0.18) continue;
      const loose = s.broken && r() < 0.15;
      m.box(x0 + k * 6 + 0.3, y - 3 + (r() < 0.25 ? 0.5 : 0), zl, 5.4, 3, zr - zl, { top: t.beam, side: t.beam, end: 'br_end' }, { uv: [0, Math.floor(r() * 4) * 4], tint: r() < 0.3 ? 0xe8e0d8 : 0xffffff, rot: loose ? { y: (r() - 0.5) * 0.25 } : undefined });
    }
    // stair half-steps up to a higher neighbour
    for (const [nb, sx] of [[fx + 1, x0 + 12], [fx - 1, x0]] as const) {
      if (nb >= 0 && nb < L && riseAt(s, L, nb) > riseAt(s, L, fx) && !isGap(s, L, nb)) {
        m.box(sx, y, zl, 12, 12, zr - zl, { top: t.deck, side: t.beam }, {});
        m.box(sx + (sx === x0 ? 0 : 0), y + 11, zl - 0.5, 12, 1.5, zr - zl + 1, 'br_beam', { bevel: 0 });
      }
    }
    // stringers and a cross beam
    for (const z of [zl + 1, zr - 7]) m.box(x0, y - 9, z, C, 6, 6, { side: t.beam, end: 'br_end' });
    m.box(x0 + 9, y - 12, zl - 2, 6, 4, zr - zl + 4, { side: t.beam, end: 'br_end' });
    strap(m, x0 + 11, y - 12, zl - 2, 2, 4, 2);
    strap(m, x0 + 11, y - 12, zr, 2, 4, 2);
    // supports: stone piers with wooden posts and diagonal braces
    if (fx === 0 || fx === L - 1 || fx % every === 0) {
      for (const z of [zl + 4, zr - 4]) {
        const pTop = Math.min(y - 20, 4);
        pierCol(m, x0 + 12, -48, pTop, z, r);
        if (y - 12 > pTop) bpost(m, x0 + 12, pTop, z, y - 12 - pTop, 6, t, false);
        if (y > 14) {
          for (const d of [-1, 1]) m.box(x0 + 12 + d * 6 - 1.5, pTop + 2, z - 1.5, 3, 16, 3, t.beam, { rot: { z: d * -0.7, pivot: [x0 + 12, pTop + 2, z] } });
        }
        ivy(m, x0 + 12, -10, pTop, z + 7, r, 'pz', 3);
      }
    }
    // railings: a post at every cell joint, top rail and a middle rail
    const railH = 18;
    for (const z of s.pier && !isPlat ? [zl + 2, zr - 2] : [zl + 2, zr - 2]) {
      if (s.broken && r() < 0.3) continue;
      if (o.posts === 'roof') continue;
      m.box(x0, y + railH - 3, z - 1.5, C, 3, 3, { side: t.beam, end: 'br_end' });
      m.box(x0, y + 8, z - 1, C, 2.5, 2, { side: t.beam, end: 'br_end' });
      // short diagonal rail brace
      m.box(x0 + 4, y + 2, z - 1, 2, 14, 2, t.beam, { rot: { z: -0.9, pivot: [x0 + 5, y + 9, z] } });
      bpost(m, x0 + 2, y - 2, z, railH + 1, 4, t, fx === f0);
    }
    if (s.pier && isPlat && fx === L - 2) {
      // walkway side rail ends where the platform starts
    }
  }
  // end corner posts with lanterns and a banner
  const ends: [number, number][] = [];
  if (f0 === 0) ends.push([X0 + 3, 0]);
  if (f1 === L) ends.push([-X0 - 3, L - 1]);
  for (const [ex, fx] of ends) {
    const y = top(fx);
    const isPlat = s.pier && fx >= L - 2;
    const zs = isPlat ? [-hw + 3, hw - 3] : [zc - walkHw + 3, zc + walkHw - 3];
    for (const z of zs) {
      if (o.posts === 'chain') {
        bpost(m, ex, y - 2, z, 54, 8, t);
        m.box(ex - 1, y + 46, z - 1, 2, 4, 2, 'metal');
      } else if (o.posts === 'roof') {
        // the roof frame has its own posts
      } else if (o.posts !== 'none' && (z > 0 || (o.banner && fx === 0))) {
        bpost(m, ex, y - 2, z, 30, 6, t, false);
        if (z > 0) topLantern(m, ex, y + 28, z);
        else {
          bpost(m, ex, y + 28, z, 16, 6, t);
          banner(m, ex, y + 40, z + 4);
        }
      } else bpost(m, ex, y - 2, z, 24, 6, t);
      ivy(m, ex, y, y + 16, z + 3, r, 'pz', 2);
    }
  }
  if (o.posts === 'chain' && f0 === 0 && f1 === L) {
    const ya = top(0) + 48;
    const yb = top(L - 1) + 48;
    for (const z of [zc - walkHw + 3, zc + walkHw - 3]) {
      chainSag(m, X0 + 3, ya, -X0 - 3, yb, z, 26 + L);
      // hangers down to the rail
      for (let fx = 2; fx < L - 1; fx += 2) {
        const x = X0 + fx * C + 2;
        const tt = (x - X0 - 3) / (-2 * X0 - 6);
        const cy = ya + (yb - ya) * tt - (26 + L) * 4 * tt * (1 - tt);
        const ry = top(fx) + 18;
        if (cy > ry + 1) chainDown(m, x, cy, z, cy - ry);
      }
    }
    // crossbars with hanging lanterns over the ends
    for (const [ex, fx] of ends) {
      const y = top(fx) + 44;
      m.box(ex - 2, y, -hw, 4, 4, 2 * hw, { side: t.beam, end: 'br_end' });
      hangLantern(m, ex, y, zc, 6);
    }
    banner(m, X0 + 3, top(0) + 38, zc + walkHw + 2);
  }
  if (o.posts === 'roof') {
    // roof frame: posts every 2 cells, side beams, a gabled plank roof and a hanging lantern
    const ph = 32;
    for (let fx = 0; fx <= L; fx += 2) {
      const fxc = Math.min(fx, L - 1);
      const x = Math.min(X0 + fx * C + 3, -X0 - 3);
      const y = top(fxc);
      for (const z of [-hw + 3, hw - 3]) {
        bpost(m, x, y - 2, z, ph, 6, t, false);
        m.box(x - 1.5, y + ph - 18, z - 1.5, 3, 16, 3, t.beam, { rot: { z: 0.75, pivot: [x, y + ph - 2, z] } });
        m.box(x - 1.5, y + ph - 18, z - 1.5, 3, 16, 3, t.beam, { rot: { z: -0.75, pivot: [x, y + ph - 2, z] } });
        if (fx === 0 || fx >= L - 1) {
          m.box(x - 3, y + 1, z - 1, 2, 16, 2, t.beam);
        }
      }
      m.box(x - 2, y + 10, -hw + 3, 3, 2, 2 * hw - 6, t.beam);
    }
    const yr = top(Math.floor(L / 2)) + ph;
    for (const z of [-hw + 3, hw - 3]) m.box(X0, yr - 2, z - 3, L * C, 5, 6, { side: t.beam, end: 'br_end' });
    for (const sd of [-1, 1]) {
      const zc2 = sd * (hw / 2 + 1);
      m.box(X0 - 6, yr + 8, zc2 - hw / 2 - 6, L * C + 12, 3, hw + 12, { top: t.deck, side: t.beam, bottom: t.deck }, { rot: { x: sd * 0.5, pivot: [0, yr + 9, zc2] } });
    }
    m.box(X0 - 7, yr + 16, -3, L * C + 14, 5, 6, { side: t.beam, end: 'br_end' });
    for (let fx = 1; fx < L; fx += 3) hangLantern(m, X0 + fx * C + 12, yr + 3, 0, 5);
  }
  return m;
}

// ---------------------------------------------------------------- stone bridges

interface StoneOpts {
  /** Support every n cells (long multi-arch bridges). */
  support?: number;
  /** Middle cells built as a wooden deck between stone end towers. */
  wood?: boolean;
  moss?: number;
}

function stoneBridge(ctx: BuildCtx, s: Shape, o: StoneOpts = {}): Model {
  const m = new Model();
  const r = ctx.rnd;
  const L = spanOf(s, ctx.params);
  const W = s.width;
  const hw = (W * C) / 2;
  const X0 = (-L * C) / 2;
  const top = (fx: number) => riseAt(s, L, fx) * C + 2;
  const moss = o.moss ?? 0.3;
  const isStone = (fx: number) => !o.wood || fx < 2 || fx >= L - 2;
  const isSupport = (fx: number) => fx === 0 || fx === L - 1 || (o.support ? fx % o.support === 0 : false) || (o.wood && (fx === 1 || fx === L - 2));
  const bodyTex = (): TexSpec => {
    const v = r();
    const side = v < moss ? 'br_stone_moss' : v < moss + 0.12 ? 'br_stone_crack' : v < moss + 0.2 ? 'br_stone_chip' : 'br_stone';
    return { side, top: 'br_road', bottom: 'br_stone' };
  };
  // arch soffit height for a half column (12 px), by its opening span
  const openings: [number, number][] = [];
  for (let fx = 0; fx < L; ) {
    if (isSupport(fx) || !isStone(fx)) {
      fx++;
      continue;
    }
    let b = fx;
    while (b + 1 < L && !isSupport(b + 1) && isStone(b + 1)) b++;
    openings.push([fx, b]);
    fx = b + 1;
  }
  const soffit = (fx: number, half: number): number | null => {
    for (const [a, b] of openings) {
      if (fx < a || fx > b) continue;
      const n = (b - a + 1) * 2;
      const i = (fx - a) * 2 + half;
      const u = ((i + 0.5) / n) * 2 - 1;
      let minTop = 999;
      for (let k = a; k <= b; k++) minTop = Math.min(minTop, top(k));
      const H = Math.max(6, minTop - 12);
      return Math.round(-6 + (H + 6) * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    return null;
  };
  for (let fx = 0; fx < L; fx++) {
    const x0 = X0 + fx * C;
    const y = top(fx);
    if (isGap(s, L, fx)) {
      // rubble in the gap
      for (let i = 0; i < 4; i++) stone(m, x0 + 4 + r() * 16, -6 + r() * 4, (r() - 0.5) * (2 * hw - 10), 8 + r() * 6, r, 'br_stone');
      continue;
    }
    if (!isStone(fx)) continue;
    const brokenEdge = s.broken && (isGap(s, L, fx - 1) || isGap(s, L, fx + 1));
    for (const half of [0, 1]) {
      const sx = x0 + half * 12;
      const so = soffit(fx, half);
      const y0 = so ?? -48;
      m.box(sx, y0, -hw, 12, y - y0, 2 * hw, bodyTex(), { uv: [half * 12, 0] });
      if (so !== null) {
        // voussoir ring proud of both faces and a dark soffit shadow
        for (const z of [-hw - 1.5, hw - 0.5]) m.box(sx, so, z, 12, 6, 2, 'br_arch', { tint: 0xd8d8d8 });
      }
    }
    // jagged broken end: loose blocks on top
    if (brokenEdge) {
      const dir = isGap(s, L, fx + 1) ? 1 : -1;
      for (let i = 0; i < 4; i++) m.cbox(x0 + 12 + dir * (6 + r() * 6), y + r() * 6 - 4, (r() - 0.5) * (2 * hw - 12), 9, 6 + r() * 6, 9, 'br_stone_chip', { rot: { y: r() - 0.5, z: (r() - 0.5) * 0.4 } });
    }
    // buttress / cutwater on supports
    if (isSupport(fx)) {
      for (const sd of [-1, 1]) {
        const z = sd * (hw + 4);
        m.cbox(x0 + 12, -48, z, 18, Math.max(8, Math.min(y - 8, 14)) + 48, 8, { side: r() < 0.5 ? 'br_stone_moss' : 'br_stone', end: 'br_stone_top' });
        m.cbox(x0 + 12, Math.max(8, Math.min(y - 8, 14)), z - sd * 1, 14, 4, 6, { side: 'br_stone', end: 'br_stone_top' });
      }
    }
    // cornice band under the parapet
    for (const z of [-hw - 1, hw - 1]) m.box(x0, y - 5, z, C, 4, 2, 'br_stone_top', { tint: 0xe8e8e8 });
    // stair half-steps
    for (const [nb, sx] of [[fx + 1, x0 + 12], [fx - 1, x0]] as const) {
      if (nb >= 0 && nb < L && riseAt(s, L, nb) > riseAt(s, L, fx) && isStone(nb) && !isGap(s, L, nb)) m.box(sx, y, -hw + 6, 12, 12, 2 * hw - 12, { side: 'br_stone', top: 'br_road' });
    }
    // parapets of blocks with alternating caps
    for (const z of [-hw + 3, hw - 3]) {
      if (brokenEdge && r() < 0.5) continue;
      m.cbox(x0 + 12, y, z, C, 9, 6, { side: r() < moss ? 'br_stone_moss' : 'br_stone', end: 'br_stone_top' });
      for (let k = 0; k < 3; k++) if ((k + fx) % 2 === 0) m.cbox(x0 + 4 + k * 8, y + 9, z, 7, 3, 7, { side: 'br_stone', end: 'br_stone_top' }, { tint: r() < 0.5 ? 0xffffff : 0xdedede });
    }
    // ivy hanging off the faces
    if (r() < 0.7) ivy(m, x0 + 4 + r() * 16, -8, y - 4, hw, r, 'pz', 4);
    if (r() < 0.4) ivy(m, x0 + 4 + r() * 16, -8, y - 4, -hw, r, 'nz', 3);
  }
  // lantern pillars: four corners, plus the crown pair on arched bridges
  const pil = [0, L - 1];
  if (s.rise(L) >= 2 && L >= 5 && !s.broken && !o.wood) pil.push(Math.floor(L / 2));
  if (o.wood) pil.push(1, L - 2);
  for (const fx of pil) {
    if (isGap(s, L, fx)) continue;
    const x = fx === 0 ? X0 + 7 : fx === L - 1 ? -X0 - 7 : X0 + fx * C + 12;
    const y = top(fx);
    for (const z of [-hw + 4, hw - 4]) {
      m.cbox(x, y, z, 12, 18, 12, { side: r() < 0.4 ? 'br_stone_moss' : 'br_stone', end: 'br_stone_top' });
      m.cbox(x, y + 18, z, 14, 3, 14, { side: 'br_stone', end: 'br_stone_top' });
      m.add(lantern(x, y + 21, z, 'm', 'beam_dark'));
    }
  }
  if (o.wood) m.add(woodBridge(ctx, s, { t: WOOD_RED, posts: 'none', range: [2, L - 2], pierEvery: 2 }));
  return m;
}

// ---------------------------------------------------------------- single elements

function el(id: string, name: string, size: [number, number], build: (ctx: BuildCtx) => Model, o: Partial<PropDef> = {}): PropDef {
  return { id, name, category: 'bridges', size, solid: true, build, ...o };
}

const elements: PropDef[] = [
  el('bridge_el_post', 'Деревянный столб', [1, 1], (ctx) => {
    const m = new Model();
    bpost(m, 0, 0, 0, 30, 8, ctx.variant ? WOOD_OLD : WOOD);
    strap(m, -4, 20, -4, 8, 2, 8);
    return m;
  }, { variants: 2 }),
  el('bridge_el_post_lantern', 'Столб с фонарём', [1, 1], () => {
    const m = new Model();
    m.cbox(0, 0, 0, 12, 6, 12, 'br_pier');
    bpost(m, 0, 6, 0, 28, 6, WOOD, false);
    topLantern(m, 0, 34, 0);
    return m;
  }),
  el('bridge_el_post_banner', 'Столб с баннером', [1, 1], () => {
    const m = new Model();
    bpost(m, 0, 0, -2, 48, 6, WOOD);
    banner(m, 0, 42, 2, 26);
    return m;
  }),
  el('bridge_el_railing', 'Ограждение', [2, 1], (ctx) => {
    const m = new Model();
    for (const x of [-20, 0, 20]) bpost(m, x, 0, 0, 20, 4, WOOD, x !== 0);
    m.box(-22, 16, -1.5, 44, 3, 3, { side: 'br_beam', end: 'br_end' });
    m.box(-22, 8, -1, 44, 2.5, 2, { side: 'br_beam', end: 'br_end' });
    for (const x of [-16, 4]) m.box(x, 2, -1, 2, 14, 2, 'br_beam', { rot: { z: -0.9, pivot: [x + 1, 9, 0] } });
    void ctx;
    return m;
  }, { solid: false }),
  el('bridge_el_corner', 'Соединение углов', [1, 1], () => {
    const m = new Model();
    bpost(m, -6, 0, -6, 24, 7, WOOD);
    m.box(-9, 14, -8, 20, 4, 4, { side: 'br_beam', end: 'br_end' });
    m.box(-8, 14, -9, 4, 4, 20, { side: 'br_beam', end: 'br_end' });
    m.box(-9, 6, -8, 20, 3, 3, { side: 'br_beam', end: 'br_end' });
    m.box(-8, 6, -9, 3, 3, 20, { side: 'br_beam', end: 'br_end' });
    strap(m, -10, 13, -10, 8, 1.5, 8);
    return m;
  }),
  el('bridge_el_plank', 'Доска покрытия', [2, 1], () => {
    const m = new Model();
    m.box(-22, 0, -6, 44, 4, 12, { top: 'br_deck', side: 'br_beam', end: 'br_end' });
    m.box(-18, 4, -7, 2, 0.8, 14, 'br_iron', { bevel: 0 });
    m.box(14, 4, -7, 2, 0.8, 14, 'br_iron', { bevel: 0 });
    return m;
  }, { solid: false }),
  el('bridge_el_beam', 'Несущая балка', [2, 1], () => {
    const m = new Model();
    m.box(-22, 0, -5, 44, 9, 10, { side: 'br_beam', end: 'br_end' });
    strap(m, -16, 0, -5, 2, 9, 10);
    strap(m, 14, 0, -5, 2, 9, 10);
    return m;
  }),
  el('bridge_el_brace', 'Диагональный упор', [1, 1], () => {
    const m = new Model();
    bpost(m, -7, 0, 0, 26, 5, WOOD, false);
    m.box(-9, 26, -2.5, 20, 5, 5, { side: 'br_beam', end: 'br_end' });
    m.box(-2, 6, -1.5, 3, 24, 3, 'br_beam', { rot: { z: -0.7, pivot: [-6, 8, 0] } });
    strap(m, -9.5, 24, -3, 5, 2, 6);
    return m;
  }),
  el('bridge_el_pier_water', 'Опора в воде', [1, 1], (ctx) => {
    const m = new Model();
    pierCol(m, 0, -12, 34, 0, ctx.rnd, 14);
    ivy(m, 0, -4, 20, 7, ctx.rnd, 'pz', 4);
    // lily pads / ripples round the foot
    for (let i = 0; i < 3; i++) m.cbox(-12 + ctx.rnd() * 24, 0.2, 10 + ctx.rnd() * 4, 5, 0.6, 5, 'moss', { bevel: 0 });
    return m;
  }),
  el('bridge_el_pier_ground', 'Опора на земле', [1, 1], (ctx) => {
    const m = new Model();
    m.cbox(0, 0, 0, 18, 6, 18, 'br_pier_moss');
    pierCol(m, 0, 6, 30, 0, ctx.rnd, 14);
    ivy(m, -6, 2, 20, 9, ctx.rnd, 'pz', 3);
    return m;
  }),
  el('bridge_el_chain', 'Цепь', [1, 1], () => {
    const m = new Model();
    bpost(m, -8, 0, 0, 44, 6, WOOD);
    m.box(-8, 38, -2, 16, 4, 4, { side: 'br_beam', end: 'br_end' });
    m.box(4, 34, -2.5, 2, 4, 5, 'br_iron');
    const k = m.mark;
    chainDown(m, 5, 34, 0, 30);
    m.cbox(5, 2, 0, 5, 3, 5, 'br_iron');
    m.animate(k, swing([5, 34, 0], 0.05, 1.2));
    return m;
  }, { solid: false }),
  el('bridge_el_lantern', 'Фонарь', [1, 1], () => {
    const m = new Model();
    m.cbox(0, 0, 0, 12, 4, 12, 'br_pier');
    m.add(lantern(0, 4, 0, 'm', 'beam_dark'));
    return m;
  }, { solid: false }),
  el('bridge_el_banner', 'Баннер', [1, 1], () => {
    const m = new Model();
    m.box(-1, 0, -1, 2, 44, 2, 'br_beam');
    m.cbox(0, 44, 0, 4, 3, 4, 'gold');
    banner(m, 0, 40, 2, 30);
    return m;
  }, { solid: false }),
];

/** Stone sheet «Основные блоки»: 1-block cubes and pieces. */
function sblock(id: string, name: string, f: (m: Model, r: () => number) => void, solid = true): PropDef {
  return el(id, name, [1, 1], (ctx) => {
    const m = new Model();
    f(m, ctx.rnd);
    return m;
  }, { solid });
}
const S = (side: string, end = 'br_stone_top'): TexSpec => ({ side, end });
const stoneBlocks: PropDef[] = [
  sblock('bridge_sb_block', 'Каменный блок', (m) => void m.cbox(0, 0, 0, 16, 16, 16, S('br_stone', 'br_stone'))),
  sblock('bridge_sb_chip', 'Блок скола', (m, r) => {
    m.cbox(0, 0, 0, 16, 12, 16, S('br_stone_chip', 'br_stone_chip'));
    m.cbox(-3, 12, -3, 10, 3 + r() * 2, 10, S('br_stone_chip', 'br_stone_chip'));
    m.cbox(5, 12, 4, 5, 2, 6, S('br_stone_chip', 'br_stone_chip'));
  }),
  sblock('bridge_sb_corner', 'Угловой блок', (m) => {
    m.cbox(0, 0, 0, 16, 16, 16, S('br_stone'));
    m.box(-9, 0, -9, 4, 18, 4, S('br_stone'));
    m.box(-9, 14, -9, 18, 4, 4, S('br_stone'));
    m.box(-9, 14, -9, 4, 4, 18, S('br_stone'));
  }),
  sblock('bridge_sb_slab', 'Плита', (m) => void m.cbox(0, 0, 0, 16, 6, 16, { side: 'br_stone', top: 'br_road', bottom: 'br_stone' }), false),
  sblock('bridge_sb_parapet', 'Парапет', (m) => {
    m.cbox(0, 0, 0, 20, 10, 8, S('br_stone'));
    m.cbox(-6, 10, 0, 7, 4, 9, S('br_stone'));
    m.cbox(6, 10, 0, 7, 4, 9, S('br_stone'));
  }),
  sblock('bridge_sb_support', 'Опорный блок', (m, r) => {
    m.cbox(0, 0, 0, 18, 22, 16, S('br_stone_moss'));
    m.cbox(0, 22, 0, 20, 4, 18, S('br_stone'));
    ivy(m, -4, 2, 18, 8, r, 'pz', 3);
  }),
  sblock('bridge_sb_arch', 'Арочный блок', (m) => {
    m.box(-8, 0, -6, 6, 24, 12, S('br_stone'));
    m.box(-4, 18, -6, 12, 6, 12, S('br_arch'));
    m.box(-4, 14, -6, 5, 4, 12, S('br_arch'));
  }),
  sblock('bridge_sb_moss', 'Блок с мхом', (m, r) => {
    m.cbox(0, 0, 0, 16, 16, 16, { side: 'br_stone_moss', top: 'moss', bottom: 'br_stone' });
    ivy(m, 0, 2, 14, 8, r, 'pz', 3);
  }),
  sblock('bridge_sb_crack', 'Блок с трещиной', (m) => {
    m.cbox(-1, 0, 0, 14, 16, 16, S('br_stone_crack'));
    m.cbox(7, 0, 2, 4, 11, 12, S('br_stone_crack'), { rot: { z: -0.12, pivot: [7, 0, 0] } });
  }),
  sblock('bridge_sb_step', 'Ступень', (m) => {
    m.box(-8, 0, -8, 16, 8, 16, { side: 'br_stone', top: 'br_road' });
    m.box(-8, 8, -8, 16, 8, 8, { side: 'br_stone', top: 'br_road' });
  }),
  sblock('bridge_sb_column', 'Колонна', (m) => {
    m.cbox(0, 0, 0, 14, 4, 14, S('br_stone'));
    m.cbox(0, 4, 0, 10, 26, 10, S('br_stone'));
    m.cbox(0, 30, 0, 14, 4, 14, S('br_stone'));
  }),
  sblock('bridge_sb_deco', 'Декоративный блок', (m, r) => {
    m.cbox(0, 0, 0, 16, 14, 16, S('br_stone_moss'));
    m.cbox(0, 14, 0, 12, 2, 12, S('br_stone'));
    m.cbox(0, 16, 0, 6, 4, 6, S('br_stone'));
    ivy(m, 0, 2, 12, 8, r, 'pz', 2);
  }),
  sblock('bridge_sb_lantern_pillar', 'Фонарь на парапете', (m) => {
    m.cbox(0, 0, 0, 14, 22, 14, S('br_stone'));
    m.cbox(0, 22, 0, 16, 3, 16, S('br_stone'));
    m.add(lantern(0, 25, 0, 'm', 'beam_dark'));
  }),
];

// ---------------------------------------------------------------- bridge defs

function bridge(id: string, name: string, s: Shape, build: (ctx: BuildCtx, s: Shape) => Model, tags: string[] = []): PropDef {
  return {
    id,
    name,
    category: 'bridges',
    size: (p) => [spanOf(s, p), s.width],
    solid: false,
    deck: deckFn(s),
    tags: ['bridge', ...tags],
    build: (ctx) => build(ctx, s),
  };
}

const flat1 = () => 1;
const arch = (max: number) => (L: number) => Math.min(max, Math.floor((L - 1) / 2));

export const BRIDGE_PROPS: PropDef[] = [
  bridge('bridge_wood', 'Деревянный мост', { min: 3, def: 5, width: 2, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'lantern', banner: true }), ['wood']),
  bridge('bridge_wood_straight', 'Прямой мост', { min: 2, def: 5, width: 2, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'lantern' }), ['wood']),
  bridge('bridge_wood_arched', 'Арочный мост', { min: 3, def: 6, width: 2, rise: arch(2) }, (c, s) => woodBridge(c, s, { posts: 'lantern', pierEvery: 2 }), ['wood']),
  bridge('bridge_wood_wide', 'Широкий мост', { min: 3, def: 5, width: 3, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'lantern', banner: true }), ['wood']),
  bridge('bridge_wood_long', 'Длинный мост', { min: 8, def: 10, width: 2, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'lantern', pierEvery: 3 }), ['wood']),
  bridge('bridge_wood_roofed', 'Мост с навесом', { min: 3, def: 5, width: 2, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'roof' }), ['wood']),
  bridge('bridge_wood_chained', 'Мост с цепями', { min: 4, def: 6, width: 2, rise: flat1 }, (c, s) => woodBridge(c, s, { posts: 'chain' }), ['wood']),
  bridge('bridge_wood_broken', 'Разрушенный мост', { min: 4, def: 6, width: 2, rise: flat1, broken: true }, (c, s) => woodBridge(c, s, { t: WOOD_OLD, posts: 'lantern' }), ['wood', 'ruin']),
  bridge('bridge_wood_pier', 'Мост к пирсу', { min: 4, def: 6, width: 3, rise: flat1, pier: true }, (c, s) => pier(c, s), ['wood', 'dock']),
  bridge('bridge_stone', 'Каменный мост', { min: 3, def: 5, width: 2, rise: arch(2) }, (c, s) => stoneBridge(c, s), ['stone']),
  bridge('bridge_stone_straight', 'Каменный прямой мост', { min: 3, def: 5, width: 2, rise: flat1 }, (c, s) => stoneBridge(c, s, { support: 3 }), ['stone']),
  bridge('bridge_stone_arched', 'Арочный каменный мост', { min: 5, def: 7, width: 2, rise: arch(3) }, (c, s) => stoneBridge(c, s, { moss: 0.4 }), ['stone']),
  bridge('bridge_stone_long', 'Длинный каменный мост', { min: 9, def: 13, width: 2, rise: flat1 }, (c, s) => stoneBridge(c, s, { support: 4 }), ['stone']),
  bridge('bridge_stone_wide', 'Широкий каменный мост', { min: 3, def: 5, width: 3, rise: arch(2) }, (c, s) => stoneBridge(c, s), ['stone']),
  bridge('bridge_stone_broken', 'Разрушенный каменный мост', { min: 5, def: 7, width: 2, rise: flat1, broken: true }, (c, s) => stoneBridge(c, s, { moss: 0.55 }), ['stone', 'ruin']),
  bridge('bridge_stone_wood', 'Мост с деревянными элементами', { min: 6, def: 8, width: 2, rise: flat1 }, (c, s) => stoneBridge(c, s, { wood: true }), ['stone', 'wood']),
  ...elements,
  ...stoneBlocks,
];

/** Bridge to a pier: a 2-cell walkway ending in a 3-cell platform, a moored boat and cargo. */
function pier(ctx: BuildCtx, s: Shape): Model {
  const m = woodBridge(ctx, s, { posts: 'lantern' });
  const r = ctx.rnd;
  const L = spanOf(s, ctx.params);
  const hw = (s.width * C) / 2;
  const X1 = (L * C) / 2;
  const y = C + 2;
  // mooring posts along the platform edge with rope
  for (const x of [X1 - 40, X1 - 12]) {
    pierCol(m, x, -48, 4, hw - 2, r, 10);
    bpost(m, x, 4, hw - 2, y + 4, 5, WOOD);
    m.box(x - 3, y + 2, hw - 5, 6, 2, 6, 'rope', { bevel: 0 });
  }
  barrel(m, X1 - 16, y, -hw + 12);
  crate(m, X1 - 34, y, -hw + 12, 14, 0, 0.2);
  crate(m, X1 - 34, y + 14, -hw + 12, 11, 1, -0.3);
  // rowing boat moored in the water row
  const bx = X1 - 3 * C - 10;
  const bz = hw - 12;
  const by = -6;
  const k = m.mark;
  m.cbox(bx, by, bz, 36, 4, 12, { side: 'br_beam', top: 'br_deck', bottom: 'br_beam' });
  for (const sd of [-1, 1]) m.cbox(bx, by + 3, bz + sd * 6, 34, 6, 2, { side: 'br_beam', end: 'br_end' });
  for (const sd of [-1, 1]) m.cbox(bx + sd * 18, by + 3, bz, 3, 6, 10, { side: 'br_beam', end: 'br_end' });
  m.cbox(bx, by + 4, bz, 4, 2, 10, 'br_beam');
  m.box(bx - 4, by + 7, bz - 9, 2, 2, 16, 'br_beam', { rot: { y: 0.4 } });
  m.animate(k, { kind: 'bob', amp: 0.03, speed: 1.3 });
  m.box(bx + 14, by + 7, bz - 2, 2, 1, (hw - 2) - bz, 'rope', { bevel: 0 });
  return m;
}
