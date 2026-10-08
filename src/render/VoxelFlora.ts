import type { MapDef } from '../data/types';
import type { RoofInst, TreeInst } from '../game/Terrain';
import { hash2 } from '../core/Rng';

/** Atlas tiles of the Minecraft-style block texture (see makeBlockAtlas). */
export const TILE = { smooth: 0, leaves: 1, bark: 2, planks: 3, cobble: 4, brick: 5, shingle: 6, logTop: 7 } as const;
export const TILE_COUNT = 8;

/** Which pixel texture a terrain material uses. */
export function tileOf(mat: string): number {
  if (/leaves|pine|vine/.test(mat)) return TILE.leaves;
  if (/trunk|log/.test(mat)) return TILE.bark;
  if (/plank|coffin/.test(mat)) return TILE.planks;
  if (/brick/.test(mat)) return TILE.brick;
  if (/roof/.test(mat)) return TILE.shingle;
  if (/stone|rock|basalt|^wall|pillar|obsidian|cobble/.test(mat)) return TILE.cobble;
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
}

function shade(c: number, k: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
}

/** Big, hand-built-looking Minecraft trees made of unit blocks. */
export function treeVoxels(tr: TreeInst, map: MapDef, out: Vox[]) {
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
  if (tr.kind === 'pine') {
    // spruce: tall trunk, layered rings that shrink and widen again like the Minecraft ones
    const H = tr.h + 2;
    for (let y = 0; y < H; y++) put(0, y, 0, trunkC, TILE.bark);
    const snow = !!pal.snow;
    let rad = 0;
    for (let y = H + 1; y >= 2; y--) {
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (!dx && !dz && y < H) continue;
          if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
          const top = snow && (y === H + 1 || r(500 + y * 13 + dx * 3 + dz) < 0.1);
          put(dx, y, dz, top ? 0xeef3f8 : shade(leafC, 0.9 + r(600 + y * 7 + dx + dz * 5) * 0.16), TILE.leaves);
        }
      rad = rad >= 2 ? 1 : rad + 1;
    }
    return;
  }
  // broadleaf: thick trunk with a root flare, branches and a wide lumpy crown
  const big = tr.h >= 4;
  const H = tr.h + (big ? 2 : 1);
  const tw = big ? 2 : 1;
  const ox = big ? -0.5 : 0;
  for (let y = 0; y < H; y++)
    for (let i = 0; i < tw; i++)
      for (let j = 0; j < tw; j++) put(ox + i, y, ox + j, shade(trunkC, 0.94 + r(y + i * 3 + j * 5) * 0.1), TILE.bark);
  // roots: half-height logs spreading at the base
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (r(700 + dx * 3 + dz) < 0.35) continue;
    const off = big ? 1.5 : 1;
    put(dx * off, 0, dz * off, shade(trunkC, 0.85), TILE.bark, 0.5);
  }
  // branches climbing diagonally out of the trunk
  const branches = big ? 3 : 2;
  const crowns: [number, number, number][] = [[0, H + 1, 0]];
  for (let b = 0; b < branches; b++) {
    const a = r(800 + b) * Math.PI * 2 + (b / branches) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let px = 0;
    let pz = 0;
    let py = H - 2 - (b % 2);
    const len = big ? 2 : 1;
    for (let k = 1; k <= len; k++) {
      px = Math.round(dx * k);
      pz = Math.round(dz * k);
      put(px, py, pz, shade(trunkC, 0.9), TILE.bark);
      if (k % 2 === 0) py++;
    }
    crowns.push([px, py + 1, pz]);
  }
  // crown: overlapping leafy ellipsoids around the trunk top and branch tips
  const seen = new Set<string>();
  const R = big ? 2.6 : 1.9;
  crowns.forEach(([bx, by, bz], ci) => {
    const rx = ci === 0 ? R : R * 0.72;
    const ry = ci === 0 ? R * 0.7 : R * 0.55;
    const n = Math.ceil(rx);
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++)
      for (let dx = -n; dx <= n; dx++)
        for (let dz = -n; dz <= n; dz++) {
          const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
          const x = bx + dx;
          const y = by + dy;
          const z = bz + dz;
          if (y < 2) continue;
          if (d > 1 - (hash2(tr.x * 7 + x, tr.z * 5 + z, 900 + y) - 0.3) * 0.35) continue;
          if (d < 0.35) continue; // hollow inside: never seen, saves blocks
          const k = `${x},${y},${z}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const tint = 0.84 + (dy / Math.max(1, ry)) * 0.1 + hash2(x, z * 3 + y, 950) * 0.12;
          put(x, y, z, shade(leafC, tint), TILE.leaves);
        }
  });
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
