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
  // Trees from the owner's reference sheet, built from half-size blocks so they read as
  // detailed Minecraft builds while staying small on screen.
  const V = 0.5;
  const used = new Set<number>();
  const tv = (x: number, y: number, z: number, color: number, tile: number) => {
    const k = ((y + 64) * 256 + (x + 128)) * 256 + (z + 128);
    if (used.has(k)) return;
    used.add(k);
    out.push({ x: cx + (x - 0.5) * V, y: y * V, z: cz + (z - 0.5) * V, sx: V, sy: V, sz: V, color, tile });
  };
  const h3 = (x: number, y: number, z: number, a: number) => hash2(tr.x * 31 + x * 7 + z, tr.z * 17 + y * 13 + z * 3, a);
  const leaf = (x: number, y: number, z: number, base: number) => tv(x, y, z, shade(base, 0.86 + h3(x, y, z, 1) * 0.2), TILE.leaves);
  const wood = (x: number, y: number, z: number, base: number) => tv(x, y, z, shade(base, 0.9 + h3(x, y, z, 2) * 0.14), TILE.bark);
  /** A flat, ragged leaf pad: the signature canopy shape of the reference trees. */
  const pad = (px: number, py: number, pz: number, rad: number, thick: number, base: number, sparse = 0) => {
    for (let l = 0; l < thick; l++) {
      const rr = rad - l * 1.2;
      const n = Math.ceil(rr);
      for (let dx = -n; dx <= n; dx++)
        for (let dz = -n; dz <= n; dz++) {
          const d = Math.hypot(dx, dz) / Math.max(0.5, rr);
          if (d > 1.05 - h3(px + dx, py + l, pz + dz, 3) * 0.3) continue;
          if (sparse && h3(px + dx, py + l, pz + dz, 4) < sparse) continue;
          leaf(px + dx, py + l, pz + dz, base);
          // leaves hanging off the rim
          if (l === 0 && d > 0.6) {
            if (h3(px + dx, py, pz + dz, 5) < 0.28) leaf(px + dx, py - 1, pz + dz, base);
            if (h3(px + dx, py, pz + dz, 6) < 0.08) leaf(px + dx, py - 2, pz + dz, base);
          }
        }
    }
  };
  const trunk2 = (x: number, y: number, z: number, base: number, w = 2) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) wood(x + i - (w > 2 ? 1 : 0), y, z + j - (w > 2 ? 1 : 0), base);
  };
  const roots = (base: number, w: number) => {
    for (const [dx, dz] of [[-1, 0], [w, 0], [0, -1], [0, w], [w, 1], [-1, 1]]) if (h3(dx, 0, dz, 7) < 0.6) wood(dx, 0, dz, base);
  };
  if (tr.kind === 'pine') {
    // spruce: straight trunk, square-ish pads shrinking to a spike
    const T = 10 + tr.h * 2;
    for (let y = 0; y < T; y++) trunk2(0, y, 0, trunkC);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const y = 3 + Math.round((i * (T - 3)) / tiers);
      pad(0, y, 0, 4.6 - i * 0.8, 2, leafC);
    }
    for (let y = T; y < T + 3; y++) leaf(0, y, 0, leafC);
    if (pal.snow) for (let i = 0; i < 14; i++) tv(Math.round((r(30 + i) - 0.5) * 6), 4 + Math.round(r(50 + i) * (T - 3)), Math.round((r(70 + i) - 0.5) * 6), 0xeef3f8, TILE.leaves);
    return;
  }
  const variant = Math.floor(r(11) * 6);
  if (variant === 0) {
    // twisted oak: a trunk that zig-zags up into one wide flat crown
    const T = 9 + tr.h;
    let x = 0;
    roots(trunkC, 2);
    for (let y = 0; y < T; y++) {
      if (y > 2 && y % 3 === 0) x += y % 6 === 0 ? -1 : 1;
      trunk2(x, y, 0, trunkC);
    }
    pad(x, T, 0, 5.5, 2, leafC);
    pad(x - 3, T + 1, 2, 2.6, 2, leafC);
    pad(x + 3, T + 1, -2, 2.6, 2, leafC);
  } else if (variant === 1) {
    // birch: white spotted trunk forking into a Y with airy clumps
    const bark = (x: number, y: number, z: number) => tv(x, y, z, h3(x, y, z, 8) < 0.22 ? 0x2e2a28 : shade(0xe8e4da, 0.94 + h3(x, y, z, 9) * 0.08), TILE.smooth);
    const T = 5 + tr.h;
    for (let y = 0; y < T; y++) bark(0, y, 0);
    const tips: [number, number][] = [[-3, 0], [3, 1], [0, -3]];
    for (const [ex, ez] of tips) {
      for (let k = 1; k <= 3; k++) bark(Math.round((ex * k) / 3), T + k, Math.round((ez * k) / 3));
      pad(ex, T + 4, ez, 2.8, 2, leafC, 0.15);
    }
    pad(0, T + 6, 0, 3.4, 2, leafC, 0.15);
  } else if (variant === 2) {
    // tiered: a tall trunk with leaf pads stacked on short side branches
    const T = 13 + tr.h;
    for (let y = 0; y < T; y++) trunk2(0, y, 0, trunkC);
    roots(trunkC, 2);
    const tiers: [number, number, number][] = [[5, -3, 0], [9, 3, 1]];
    for (const [y, bx, bz] of tiers) {
      for (let k = 1; k <= Math.abs(bx); k++) wood(Math.sign(bx) * k + (bx > 0 ? 1 : 0), y, bz, trunkC);
      pad(bx + (bx > 0 ? 1 : 0), y + 1, bz, 3.4, 2, leafC);
    }
    pad(0, T, 0, 4.6, 2, leafC);
  } else if (variant === 3) {
    // gnarled dark oak: thick grey trunk splitting into crooked limbs
    const dark = 0x4c4c56;
    const T = 7 + tr.h;
    roots(dark, 2);
    for (let y = 0; y < T; y++) trunk2(0, y, 0, dark, y < 3 ? 3 : 2);
    const limbs: [number, number][] = [[-5, 1], [5, -1], [1, 4]];
    for (const [ex, ez] of limbs) {
      let y = T - 2;
      for (let k = 1; k <= 5; k++) {
        const x = Math.round((ex * k) / 5);
        const z = Math.round((ez * k) / 5);
        wood(x, y, z, dark);
        wood(x, y + 1, z, dark);
        if (k % 2 === 0) y++;
      }
      pad(ex, y + 2, ez, 3.2, 2, leafC);
    }
    pad(0, T + 2, 0, 4.4, 2, leafC);
  } else {
    // round oak: thick trunk with roots, a dome crown and a red shelf mushroom
    const T = 6 + tr.h;
    roots(trunkC, 3);
    for (let y = 0; y < T; y++) trunk2(0, y, 0, trunkC, 3);
    if (variant === 5) tv(2, 3, 0, 0xc8322c, TILE.smooth);
    const R = 5.4;
    const Ry = 3.6;
    const cy = T + 2;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -6; dx <= 6; dx++)
        for (let dz = -6; dz <= 6; dz++) {
          const d = (dx * dx + dz * dz) / (R * R) + (dy * dy) / (Ry * Ry);
          if (d > 1 - (h3(dx, dy, dz, 10) - 0.4) * 0.3 || d < 0.45) continue;
          leaf(dx, cy + dy, dz, leafC);
        }
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
