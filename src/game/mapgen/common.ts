import type { Rng } from '../../core/Rng';
import { CELL, Terrain, replaceAll } from '../Terrain';
import { fbm } from './noise';

export interface GenCtx {
  t: Terrain;
  rng: Rng;
  seed: number;
  c: number; // center coordinate
  /** Area factor relative to the original 160x160 maps; scales feature counts. */
  k: number;
}

/** Tall cliff wall around the map edge. */
export function border(g: GenCtx, mat: string, thickness = 3, h = 4) {
  const { t } = g;
  const n = t.size;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const d = Math.min(x, z, n - 1 - x, n - 1 - z);
      if (d < thickness) {
        const i = t.idx(x, z);
        t.cell[i] = CELL.wall;
        t.height[i] = h;
        // Only the inner face is visible; outer rows get one top block.
        if (d === thickness - 1) for (let y = 0; y < h; y++) t.blocks.push({ x, y, z, mat, v: (x + z + y) & 7 });
        else t.blocks.push({ x, y: h - 1, z, mat, v: (x * 3 + z) & 7 });
      }
    }
}

export function fillTiles(g: GenCtx, pick: (x: number, z: number) => string) {
  const { t } = g;
  for (let z = 0; z < t.size; z++) for (let x = 0; x < t.size; x++) t.setTile(x, z, pick(x, z));
}

/** Calls fn for cells where noise exceeds threshold (organic blobs). */
export function blobs(g: GenCtx, scale: number, threshold: number, seedOff: number, fn: (x: number, z: number, v: number) => void) {
  const { t } = g;
  for (let z = 0; z < t.size; z++)
    for (let x = 0; x < t.size; x++) {
      const v = fbm(x / scale, z / scale, g.seed + seedOff);
      if (v > threshold) fn(x, z, v);
    }
}

export function distToCenter(g: GenCtx, x: number, z: number) {
  return Math.hypot(x - g.c, z - g.c);
}

/** Random walk path of given width, painting tiles and clearing obstacles. */
export function path(g: GenCtx, x0: number, z0: number, x1: number, z1: number, width: number, tile: string, wobble = 0.35) {
  let x = x0;
  let z = z0;
  let guard = 0;
  while (Math.hypot(x1 - x, z1 - z) > 1 && guard++ < 4000) {
    const ang = Math.atan2(z1 - z, x1 - x) + (g.rng.next() - 0.5) * wobble * 2;
    x += Math.cos(ang);
    z += Math.sin(ang);
    const r = width / 2;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const cx = Math.round(x + dx);
        const cz = Math.round(z + dz);
        if (g.t.inBounds(cx, cz) && g.t.cell[g.t.idx(cx, cz)] !== CELL.wall) g.t.setTile(cx, cz, tile, CELL.floor);
      }
  }
}

/** Fills circle with tile/cell. */
export function disk(g: GenCtx, cx: number, cz: number, r: number, tile: string | null, cell?: number) {
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
      if (!g.t.inBounds(x, z)) continue;
      if (tile) g.t.setTile(x, z, tile, cell);
      else if (cell !== undefined) g.t.setCell(x, z, cell);
    }
}

/** Blocky tree: trunk column (solid) and a cuboid canopy. */
export function tree(g: GenCtx, x: number, z: number, trunkMat: string, leafMat: string, h: number, leafV = -1) {
  const { t } = g;
  if (leafMat === 'leaves') {
    // real trees get a rounded model; huts made with this helper stay blocky
    if (t.solidCell(x, z, h)) t.trees.push({ x, z, h, kind: 'oak', leaf: leafMat, trunk: trunkMat, v: leafV < 0 ? g.rng.int(0, 2) : leafV });
    return;
  }
  t.column(x, z, h, trunkMat);
  const r = h >= 4 ? 2 : 1;
  for (let y = h - 1; y <= h + 1; y++) {
    const rr = y === h + 1 ? r - 1 : r;
    for (let dz = -rr; dz <= rr; dz++)
      for (let dx = -rr; dx <= rr; dx++) {
        if (Math.abs(dx) === rr && Math.abs(dz) === rr && g.rng.chance(0.6)) continue;
        if (dx === 0 && dz === 0 && y < h) continue;
        t.addBlock(x + dx, y, z + dz, leafMat, leafV < 0 ? -1 : leafV);
      }
  }
}

export function pine(g: GenCtx, x: number, z: number, h: number) {
  const { t } = g;
  if (t.solidCell(x, z, 2)) t.trees.push({ x, z, h, kind: 'pine', leaf: 'pine', trunk: 'trunk', v: g.rng.int(0, 1) });
}

export function rockCluster(_g: GenCtx, _x: number, _z: number, _mat: string, _size: number) {
  // rock piles were removed at the owner's request
}

/** Water/lava pond with optional bank decoration. */
export function pond(g: GenCtx, x: number, z: number, r: number, tile: string, cell: number, bankColor?: number) {
  for (let dz = -r - 1; dz <= r + 1; dz++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dz) + (g.rng.next() - 0.5) * 0.9;
      const cx = x + dx;
      const cz = z + dz;
      if (!g.t.inBounds(cx, cz) || g.t.cell[g.t.idx(cx, cz)] === CELL.wall) continue;
      if (d < r) g.t.setTile(cx, cz, tile, cell);
      else if (d < r + 1 && bankColor !== undefined && g.rng.chance(0.35) && g.t.isFree(cx, cz))
        g.t.decor.push({ x: cx + 0.5, z: cz + 0.5, y: 0, size: 0.5, h: 0.25, color: bankColor });
    }
}

/** Scatter small decorative voxels (flowers, grass, pebbles). */
export function scatterDecor(g: GenCtx, count: number, colors: number[], opts: { size?: number; h?: number; sway?: boolean; glow?: boolean; onTile?: string[] } = {}) {
  const { t, rng } = g;
  const tiles = opts.onTile?.map((n) => t.tileId(n));
  for (let i = 0; i < count; i++) {
    const x = rng.range(4, t.size - 4);
    const z = rng.range(4, t.size - 4);
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!t.isFree(cx, cz)) continue;
    if (tiles && !tiles.includes(t.tile[t.idx(cx, cz)])) continue;
    const size = (opts.size ?? 0.18) * rng.range(0.7, 1.3);
    t.decor.push({ x, z, y: 0, size, h: (opts.h ?? size) * rng.range(0.8, 1.6), color: rng.pick(colors), sway: opts.sway, glow: opts.glow });
  }
}

/** Ensures the spawn area is open. */
export function clearCenter(g: GenCtx, r: number, tile: string) {
  const { t } = g;
  for (let z = g.c - r; z <= g.c + r; z++)
    for (let x = g.c - r; x <= g.c + r; x++) {
      if (Math.hypot(x - g.c, z - g.c) > r) continue;
      const i = t.idx(x, z);
      t.cell[i] = CELL.floor;
      t.height[i] = 0;
      t.setTile(x, z, tile);
    }
  // drop blocks inside the cleared radius
  const keep = t.blocks.filter((b) => Math.hypot(b.x - g.c, b.z - g.c) > r + 0.5 || b.y > 6);
  replaceAll(t.blocks, keep);
  const keepD = t.decor.filter((d) => Math.hypot(d.x - g.c, d.z - g.c) > r);
  replaceAll(t.decor, keepD);
}

/** Flood fill from center; converts unreachable floor pockets into solid to avoid trapped spawns. */
export function sealUnreachable(g: GenCtx) {
  const { t } = g;
  const n = t.size;
  const seen = new Uint8Array(n * n);
  const q = new Int32Array(n * n);
  let h = 0;
  let tl = 0;
  const s = t.idx(g.c, g.c);
  q[tl++] = s;
  seen[s] = 1;
  while (h < tl) {
    const i = q[h++];
    const x = i % n;
    const z = (i / n) | 0;
    const nb = [i - 1, i + 1, i - n, i + n];
    const ok = [x > 0, x < n - 1, z > 0, z < n - 1];
    for (let k = 0; k < 4; k++) {
      if (!ok[k]) continue;
      const j = nb[k];
      if (seen[j]) continue;
      const c = t.cell[j];
      if (c === CELL.solid || c === CELL.liquid || c === CELL.wall) continue;
      seen[j] = 1;
      q[tl++] = j;
    }
  }
  for (let i = 0; i < n * n; i++) {
    const c = t.cell[i];
    if (!seen[i] && (c === CELL.floor || c === CELL.hazard || c === CELL.ice)) t.cell[i] = CELL.solid;
  }
}
