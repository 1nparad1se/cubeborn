import type { MapDef } from '../data/types';
import type { RoofInst, TreeInst } from '../game/Terrain';
import { hash2 } from '../core/Rng';

/** Atlas tiles of the 16px block texture (see makeBlockAtlas). */
export const TILE = {
  smooth: 0, leaves: 1, bark: 2, planks: 3, cobble: 4, brick: 5, shingle: 6, logTop: 7, birch: 8,
  sandstone: 9, stoneBricks: 10, ice: 11, obsidian: 12, snow: 13, pillar: 14, basalt: 15,
} as const;
/** Tiles in the block atlas: 16 grey tinted ones plus 8 full-colour detail tiles (see game/world/build/VB XTILE). */
export const TILE_COUNT = 24;

/** Which pixel texture a terrain material uses. */
export function tileOf(mat: string): number {
  if (/leaves|pine|vine/.test(mat)) return TILE.leaves;
  if (/trunk|log/.test(mat)) return TILE.bark;
  if (/plank|coffin/.test(mat)) return TILE.planks;
  if (/brick/.test(mat)) return TILE.brick;
  if (/roof/.test(mat)) return TILE.shingle;
  if (/^wall/.test(mat)) return TILE.stoneBricks;
  if (/pillar|marble|bone/.test(mat)) return TILE.pillar;
  if (/sandstone/.test(mat)) return TILE.sandstone;
  if (/obsidian/.test(mat)) return TILE.obsidian;
  if (/basalt/.test(mat)) return TILE.basalt;
  if (/^ice/.test(mat)) return TILE.ice;
  if (/^snow/.test(mat)) return TILE.snow;
  if (/stone|rock|cobble/.test(mat)) return TILE.cobble;
  return TILE.smooth;
}

/** One voxel of a tree or roof: a box with its base at y. */
export interface Vox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  tile: number;
  glow?: boolean;
}

function shade(c: number, k: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
}

/** Blocky trees; leaf blocks buried inside the canopy on all six sides are dropped. */
export function treeVoxels(tr: TreeInst, map: MapDef, out: Vox[]) {
  const list: Vox[] = [];
  treeVoxelsRaw(tr, map, list);
  const cx = tr.x + 0.5;
  const cz = tr.z + 0.5;
  const key = (x: number, y: number, z: number) => ((y + 64) * 512 + (x + 256)) * 512 + (z + 256);
  const grid = (v: Vox) => [Math.round((v.x - cx) / v.sx), Math.round(v.y / v.sy), Math.round((v.z - cz) / v.sz)];
  const filled = new Set<number>();
  for (const v of list) if (v.sx === 0.5) filled.add(key(...(grid(v) as [number, number, number])));
  const snowy = tr.kind === 'pine' && !!map.palette.blocks.snow;
  for (const v of list) {
    if (v.sx === 0.5) {
      const [x, y, z] = grid(v);
      if (filled.has(key(x + 1, y, z)) && filled.has(key(x - 1, y, z)) && filled.has(key(x, y + 1, z)) && filled.has(key(x, y - 1, z)) && filled.has(key(x, y, z + 1)) && filled.has(key(x, y, z - 1))) continue;
      // snow settles on the exposed tops of spruce needles
      if (snowy && v.tile === TILE.leaves && !filled.has(key(x, y + 1, z)) && hash2(tr.x * 13 + x, tr.z * 7 + z, y) < 0.75) {
        out.push({ ...v, color: 0xeef3f8, tile: TILE.snow });
        continue;
      }
    }
    out.push(v);
  }
}

function treeVoxelsRaw(tr: TreeInst, map: MapDef, out: Vox[]) {
  const pal = map.palette.blocks;
  const r = (a: number) => hash2(tr.x, tr.z, a);
  const cx = tr.x + 0.5;
  const cz = tr.z + 0.5;
  const trunkCols = pal[tr.trunk] ?? [0x6e4c2c];
  const leafCols = pal[tr.leaf] ?? [0x3f8a30];
  const trunkC = trunkCols[tr.v % trunkCols.length];
  const leafC = leafCols[tr.v % leafCols.length];
  const put = (x: number, y: number, z: number, color: number, tile: number, sy = 1, s = 1) =>
    out.push({ x: cx + x, y, z: cz + z, sx: s, sy, sz: s, color, tile });
  if (tr.kind === 'mushroom') {
    // huge red mushroom: a pale stem and a cap with hanging sides and white spots
    const capC = leafCols[0];
    const stemC = leafCols[1 % leafCols.length];
    const H = tr.h + 3;
    for (let y = 0; y < H; y++) put(0, y, 0, shade(stemC, 0.92 + r(y) * 0.1), TILE.smooth);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        put(dx, H, dz, r(100 + dx * 7 + dz) < 0.2 ? 0xf2ece0 : shade(capC, 0.95 + r(200 + dx * 7 + dz) * 0.1), TILE.smooth);
      }
    for (let y = H - 2; y < H; y++)
      for (let dx = -3; dx <= 3; dx++)
        for (let dz = -3; dz <= 3; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== 3 || (Math.abs(dx) === 3 && Math.abs(dz) === 3)) continue;
          put(dx, y, dz, r(300 + dx * 7 + dz * 3 + y) < 0.15 ? 0xf2ece0 : shade(capC, 0.88 + r(400 + dx + dz * 5) * 0.1), TILE.smooth);
        }
    return;
  }
  // Blocky trees built from half-unit blocks (the ground block size): leaf-block canopies
  // over one-block trunks, kept moderate in size.
  const V = 0.5;
  const used = new Set<number>();
  const tv = (x: number, y: number, z: number, color: number, tile: number) => {
    const k = ((y + 64) * 256 + (x + 128)) * 256 + (z + 128);
    if (used.has(k)) return;
    used.add(k);
    out.push({ x: cx + x * V, y: y * V, z: cz + z * V, sx: V, sy: V, sz: V, color, tile });
  };
  const h3 = (x: number, y: number, z: number, a: number) => hash2(tr.x * 31 + x * 7 + z, tr.z * 17 + y * 13 + z * 3, a);
  const leaf = (x: number, y: number, z: number, base: number) => tv(x, y, z, shade(base, 0.9 + h3(x, y, z, 1) * 0.16), TILE.leaves);
  const wood = (x: number, y: number, z: number, base: number, tile: number = TILE.bark) => tv(x, y, z, shade(base, 0.92 + h3(x, y, z, 2) * 0.1), tile);
  /** One square leaf layer of radius r; corners are randomly trimmed. */
  const layer = (y: number, r: number, base: number, ox = 0, oz = 0, trim = 0.5) => {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const corner = Math.abs(dx) === r && Math.abs(dz) === r;
        if (corner && (r === 1 || h3(dx + ox, y, dz + oz, 3) < trim)) continue;
        leaf(ox + dx, y, oz + dz, base);
      }
  };
  /** Rounded leaf blob (ellipsoid with a ragged rim). */
  const blob = (ox: number, oy: number, oz: number, rx: number, ry: number, base: number) => {
    const R = Math.ceil(rx);
    const RY = Math.ceil(ry);
    for (let dy = -RY; dy <= RY; dy++)
      for (let dx = -R; dx <= R; dx++)
        for (let dz = -R; dz <= R; dz++) {
          const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
          if (d > 1 + (h3(dx + ox, dy + oy, dz + oz, 4) - 0.5) * 0.45) continue;
          leaf(ox + dx, oy + dy, oz + dz, base);
        }
  };
  if (tr.kind === 'pine') {
    // spruce: straight trunk with alternating wide and narrow needle layers up to a point
    const T = 7 + tr.h;
    for (let y = 0; y < T; y++) wood(0, y, 0, trunkC);
    for (let y = T; y >= 2; y--) {
      const k = T - y;
      // narrow, wide, narrow, wider... like a spruce silhouette
      const rad = k === 0 ? 0 : k % 2 === 1 ? Math.min(3, 1 + (k >> 2)) : Math.max(1, Math.min(3, (k >> 2)));
      if (rad === 0) leaf(0, y, 0, leafC);
      else layer(y, rad, leafC, 0, 0, 0.7);
    }
    leaf(0, T + 1, 0, leafC);
    return;
  }
  const variant = r(11);
  if (variant < 0.42) {
    // classic oak: 5x5 double layer, 3x3 cap and a plus-shaped top
    const T = 4 + (tr.h >> 1) + Math.floor(r(12) * 2);
    for (let y = 0; y < T; y++) wood(0, y, 0, trunkC);
    layer(T - 2, 2, leafC);
    layer(T - 1, 2, leafC);
    layer(T, 1, leafC);
    layer(T + 1, 1, leafC, 0, 0, 1);
  } else if (variant < 0.66) {
    // birch: white trunk, a slimmer and lighter canopy
    const birchLeaf = shade(leafC, 1.12);
    const T = 5 + Math.floor(r(13) * 3);
    for (let y = 0; y < T; y++) wood(0, y, 0, 0xf2efe6, TILE.birch);
    layer(T - 2, 2, birchLeaf, 0, 0, 0.75);
    layer(T - 1, 2, birchLeaf, 0, 0, 0.75);
    layer(T, 1, birchLeaf);
    layer(T + 1, 1, birchLeaf, 0, 0, 1);
  } else if (variant < 0.9) {
    // round oak: taller trunk with a side branch and a rounded leaf blob
    const T = 5 + (tr.h >> 1);
    for (let y = 0; y < T; y++) wood(0, y, 0, trunkC);
    const bx = r(14) < 0.5 ? -1 : 1;
    wood(bx, T - 2, 0, trunkC);
    blob(0, T + 1, 0, 3.2, 2.3, leafC);
    blob(bx * 2, T, r(15) < 0.5 ? 1 : -1, 1.8, 1.4, leafC);
  } else {
    // old oak: 2x2 trunk with roots and a wide, flat crown
    const T = 6 + (tr.h >> 1);
    for (let y = 0; y < T; y++) for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) wood(i, y, j, trunkC);
    for (const [dx, dz] of [[-1, 0], [2, 1], [0, 2], [1, -1]]) if (h3(dx, 0, dz, 7) < 0.6) wood(dx, 0, dz, trunkC);
    blob(0, T, 0, 4.2, 1.6, leafC);
    blob(1, T + 2, 1, 2.6, 1.2, leafC);
  }
}

/** Minecraft stair roof: shingle steps rising to a ridge, plank gables and dark trim. */
export function roofVoxels(rf: RoofInst, map: MapDef, out: Vox[]) {
  const pal = map.palette.blocks;
  const cols = pal[rf.mat] ?? [0x8a4a3a];
  let rc = cols[0];
  let tile: number = TILE.shingle;
  if (rf.mat === 'leaves') {
    rc = 0xb08a54;
    tile = TILE.planks;
  }
  if (rf.mat === 'snow') rc = 0xeef3f8;
  const plankC = (pal.plank ?? [0xa87c4a])[0];
  const alongX = rf.w >= rf.d;
  const L = alongX ? rf.w : rf.d;
  const W = alongX ? rf.d : rf.w;
  // cells across the roof: -1 .. W (one block of overhang each side)
  const at = (a: number, c: number, y: number, color: number, t: number, sy = 1) => {
    const x = alongX ? rf.x + a : rf.x + c;
    const z = alongX ? rf.z + c : rf.z + a;
    out.push({ x: x + 0.5, y, z: z + 0.5, sx: 1, sy, sz: 1, color, tile: t });
  };
  const half = (W + 1) / 2;
  for (let i = 0; i <= Math.floor(half); i++) {
    const lo = -1 + i;
    const hi = W - i;
    const y = rf.y + i * 0.5;
    if (lo > hi) break;
    for (let a = -1; a <= L; a++) {
      const trim = a === -1 || a === L;
      const c = trim ? shade(rc, 0.62) : shade(rc, i % 2 ? 0.92 : 1);
      at(a, lo, y, c, tile, 0.5);
      if (hi !== lo) at(a, hi, y, c, tile, 0.5);
      // gables: fill between the two slopes at the house ends
      if ((a === 0 || a === L - 1) && hi - lo > 1)
        for (let k = lo + 1; k < hi; k++) at(a, k, y, shade(plankC, 0.95), TILE.planks, 0.5);
    }
  }
  // chimney
  if (L >= 4) {
    const top = rf.y + half * 0.5 + 1;
    for (let y = rf.y; y < top; y++) at(L - 2, W - 2, y, 0x8a8a90, TILE.brick);
  }
}
