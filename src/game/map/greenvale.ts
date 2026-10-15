import { Rng, hash2 } from '../../core/Rng';
import type { MapDef } from '../../data/types';
import { CELL, Terrain, type TreeInst } from '../Terrain';

/** Fixed seed: the world is the same on every launch. */
const SEED = 250250;
/** Impassable rim (no blocks: the edge forest hides it). */
const RIM = 3;

/** Smooth value noise in 0..1 (deterministic). */
function noise(x: number, z: number, s: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi, s);
  const b = hash2(xi + 1, zi, s);
  const c = hash2(xi, zi + 1, s);
  const d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number, s: number): number {
  return noise(x, z, s) * 0.6 + noise(x * 2.1, z * 2.1, s + 7) * 0.3 + noise(x * 4.3, z * 4.3, s + 13) * 0.1;
}

/** The river's course: centre line and half-width by row (it rises in a pool in the north-east). */
export const RIVER = {
  sourceZ: 34,
  centerX(z: number): number {
    return 206 + Math.sin(z / 23) * 9 + Math.sin(z / 9 + 1) * 3.5;
  },
  halfWidth(z: number): number {
    // narrow near the spring, widening downstream
    const grow = Math.min(1, (z - this.sourceZ) / 40);
    return 1.4 + grow * (1.4 + Math.sin(z / 31) * 0.6);
  },
};

/** Spawn point of every new character: the middle of the meadow. */
export const SPAWN = { x: 125.5, z: 128.5 };

/**
 * Builds Greenvale: flat grass, groves of trees and one small river. No randomness between
 * launches (fixed seed), so positions saved in a character always point at the same ground.
 */
export function buildGreenvale(map: MapDef): Terrain {
  const n = map.size;
  const t = new Terrain(n);
  const rng = new Rng(SEED);
  for (const name of Object.keys(map.palette.tiles)) t.tileId(name);

  // distance (in cells) from every cell to the water, for banks and to keep trees off the shore
  const water = new Float32Array(n * n).fill(99);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      let d = 99;
      if (z >= RIVER.sourceZ) d = Math.abs(x + 0.5 - RIVER.centerX(z)) - RIVER.halfWidth(z);
      // the spring: a small round pool the river flows out of
      const sp = Math.hypot(x + 0.5 - RIVER.centerX(RIVER.sourceZ), z + 0.5 - RIVER.sourceZ) - 3.4;
      water[z * n + x] = Math.min(d, sp);
    }

  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const rim = Math.min(x, z, n - 1 - x, n - 1 - z) < RIM;
      if (rim) {
        t.cell[i] = CELL.wall;
        t.tile[i] = t.tileId('grass');
        continue;
      }
      const w = water[i];
      if (w <= 0) t.setTile(x, z, 'water', CELL.liquid);
      else if (w <= 1.2) t.setTile(x, z, 'sand');
      else if (w <= 2.6 + hash2(x, z, 5) * 0.8) t.setTile(x, z, 'bank');
      else t.setTile(x, z, fbm(x / 11, z / 11, SEED) > 0.62 ? 'grass2' : 'grass');
    }

  // trees: groves from noise plus lone trees, never closer than a few cells, with open lanes
  const placed: TreeInst[] = [];
  const minGap = (a: number) => (a > 0.62 ? 3.2 : 5.5);
  const ok = (x: number, z: number, gap: number) => {
    if (!t.isFree(x, z) || !t.isFree(x + 1, z) || !t.isFree(x, z + 1)) return false;
    if (water[z * n + x] < 4) return false;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 14) return false;
    for (const p of placed) if ((p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap) return false;
    return true;
  };
  for (let k = 0; k < 9000 && placed.length < 520; k++) {
    const x = rng.int(RIM + 2, n - RIM - 3);
    const z = rng.int(RIM + 2, n - RIM - 3);
    const grove = fbm(x / 26, z / 26, SEED + 3);
    // thick edge forest frames the vale; inside, groves are loose and clearings stay open
    const edge = Math.min(x, z, n - 1 - x, n - 1 - z) < 12;
    const chance = edge ? 0.9 : grove > 0.62 ? 0.55 : grove > 0.48 ? 0.12 : 0.03;
    if (!rng.chance(chance)) continue;
    if (!ok(x, z, edge ? 3 : minGap(grove))) continue;
    const nearWater = water[z * n + x] < 9;
    const kind: TreeInst['kind'] = nearWater && rng.chance(0.45) ? 'willow' : rng.chance(0.14) ? 'pine' : 'oak';
    const tr: TreeInst = { x, z, h: rng.int(2, 5), kind, leaf: kind === 'pine' ? 'pine' : 'leaves', trunk: 'trunk', v: rng.int(0, 3) };
    if (t.solidCell(x, z, tr.h)) placed.push(tr);
  }
  for (const tr of placed) t.trees.push(tr);
  return t;
}

/** A small grass clearing for the menu backdrop (the campfire stands in the middle). */
export function buildMenuGround(map: MapDef): Terrain {
  const n = 72;
  const t = new Terrain(n);
  const rng = new Rng(SEED + 1);
  for (const name of Object.keys(map.palette.tiles)) t.tileId(name);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) t.setTile(x, z, fbm(x / 11, z / 11, SEED) > 0.62 ? 'grass2' : 'grass');
  // a ring of trees around the clearing
  for (let k = 0; k < 400 && t.trees.length < 60; k++) {
    const x = rng.int(2, n - 3);
    const z = rng.int(2, n - 3);
    const d = Math.hypot(x - n / 2, z - n / 2);
    if (d < 11 || !t.isFree(x, z) || t.trees.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 12)) continue;
    const kind: TreeInst['kind'] = rng.chance(0.15) ? 'pine' : 'oak';
    const tr: TreeInst = { x, z, h: rng.int(2, 5), kind, leaf: kind === 'pine' ? 'pine' : 'leaves', trunk: 'trunk', v: rng.int(0, 3) };
    if (t.solidCell(x, z, tr.h)) t.trees.push(tr);
  }
  return t;
}
