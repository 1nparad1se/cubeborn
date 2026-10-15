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

/** The plateau in the north-east the river rises on; it spills over the cliff at `cliffZ`. */
export const HIGHLAND = { x0: 178, height: 5, cliffZ: 62 };

/** Where the river falls off the highland into the pool below (cell coordinates). */
export const WATERFALL = { x: Math.round(RIVER.centerX(HIGHLAND.cliffZ)), z: HIGHLAND.cliffZ };

/** Rounded terraced hills (`mesa`: one flat top ringed by cliffs). */
const HILLS: { x: number; z: number; r: number; h: number; mesa?: boolean }[] = [
  { x: 88, z: 152, r: 13, h: 4 },
  { x: 160, z: 166, r: 10, h: 3 },
  { x: 152, z: 96, r: 9, h: 3 },
  { x: 95, z: 96, r: 8, h: 5, mesa: true },
  { x: 66, z: 196, r: 15, h: 5 },
  { x: 166, z: 216, r: 11, h: 4 },
  { x: 118, z: 196, r: 7, h: 4, mesa: true },
];

/** Stair-step paths (from low end to high end): cut into slopes and cliffs, one block per step. */
const STAIRS: [number, number, number, number][] = [
  [86, 86, 61, 61], // meadow → the north-western snowfield plateau
  [125, 62, 125, 33], // meadow → the ledge under the northern peaks
  [166, 86, 184, 57], // meadow → the river highland
  [95, 114, 95, 101], // up the western mesa
  [118, 210, 118, 201], // up the southern mesa
];

/** A plateau of the western range: flat ground at `h` among the peaks. */
const PLATEAUS: { x: number; z: number; r: number; h: number }[] = [
  { x: 46, z: 48, r: 24, h: 6 },
  { x: 125, z: 24, r: 10, h: 6 },
];

/** Lakes lying on raised ground (centre, radius). */
const LAKES: { x: number; z: number; r: number }[] = [{ x: 38, z: 54, r: 5.2 }];

function smooth01(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return [Math.hypot(px - ax - dx * u, pz - az - dz * u), u];
}

/**
 * Block heights of the vale (whole blocks): a mountain range along the north and west edges
 * with 3-block cliffs, a snowfield plateau and a ledge among the peaks, the river highland in
 * the north-east, terraced hills and mesas in the meadow, low rolling bumps, stair paths up.
 * The spawn meadow and the river valley stay flat.
 */
function heightmap(n: number, water: Float32Array, noTree: Uint8Array): Uint8Array {
  const H = new Uint8Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const ds = Math.hypot(x - SPAWN.x, z - SPAWN.z);
      const calm = smooth01((ds - 22) / 14) * smooth01((water[i] - 5) / 6);
      // low rolling bumps, one or two blocks
      const b = fbm(x / 21, z / 21, SEED + 21);
      let h = (b > 0.64 ? 2 : b > 0.52 ? 1 : 0) * (calm > 0.5 ? 1 : 0);
      // terraced hills
      for (const hl of HILLS) {
        const d = Math.hypot(x - hl.x, z - hl.z) * (1 + (noise(x / 5, z / 5, SEED + 31) - 0.5) * 0.35);
        if (d >= hl.r) continue;
        const v = hl.mesa ? hl.h : Math.ceil(hl.h * Math.min(1, ((hl.r - d) / hl.r) * 1.35));
        h = Math.max(h, v);
      }
      // the mountain range: north edge (west of the highland) and west edge, 3-block terraces
      const wN = 30 + noise(x / 19, 0.5, SEED + 41) * 14;
      const wW = 27 + noise(0.5, z / 19, SEED + 43) * 12;
      const fade = smooth01((HIGHLAND.x0 + 6 - x) / 10);
      const m = Math.max(smooth01(1 - (z - 2) / wN) * fade, smooth01(1 - (x - 2) / wW));
      if (m > 0) {
        const ridge = fbm(x / 13, z / 13, SEED + 47);
        const raw = m * (9 + ridge * 10) + m * m * 4;
        const mh = Math.min(15, Math.floor(raw / 3) * 3);
        h = Math.max(h, mh);
      }
      // plateaus among the peaks
      for (const pl of PLATEAUS) {
        const d = Math.hypot(x - pl.x, z - pl.z) * (1 + (noise(x / 6, z / 6, SEED + 53) - 0.5) * 0.3);
        if (d < pl.r) h = d < pl.r - 4 ? pl.h : Math.max(h, pl.h);
      }
      // the river highland: a flat plateau with a straight cliff where the river spills over
      const nearFall = Math.abs(x - WATERFALL.x) < 9;
      const edge = HIGHLAND.cliffZ + (nearFall ? 0 : Math.round((noise(x / 7, 3.5, SEED + 61) - 0.5) * 8));
      if (x >= HIGHLAND.x0 + Math.round((noise(2.5, z / 8, SEED + 63) - 0.5) * 6) && z < edge) h = Math.max(h, HIGHLAND.height);
      if (z < edge && x > HIGHLAND.x0 - 4 && water[i] < 6) h = HIGHLAND.height;
      // the spawn meadow stays flat
      if (ds < 22) h = 0;
      H[i] = h;
    }
  // stairs: a three-cell path rising evenly from its low end to its high end
  for (const [ax, az, bx, bz] of STAIRS) {
    const h0 = H[az * n + ax];
    const h1 = H[bz * n + bx];
    const x0 = Math.min(ax, bx) - 3;
    const x1 = Math.max(ax, bx) + 3;
    const z0 = Math.min(az, bz) - 3;
    const z1 = Math.max(az, bz) + 3;
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        const [d, u] = segDist(x + 0.5, z + 0.5, ax + 0.5, az + 0.5, bx + 0.5, bz + 0.5);
        if (d > 2.6) continue;
        noTree[z * n + x] = 1;
        if (d > 1.6) continue;
        H[z * n + x] = Math.round(h0 + (h1 - h0) * u);
      }
  }
  return H;
}

/** Cells reachable from the spawn on foot (steps of one block up or down). */
function reachable(t: Terrain): Uint8Array {
  const n = t.size;
  const seen = new Uint8Array(n * n);
  const q = new Int32Array(n * n);
  let qh = 0;
  let qt = 0;
  const s = Math.floor(SPAWN.z) * n + Math.floor(SPAWN.x);
  seen[s] = 1;
  q[qt++] = s;
  while (qh < qt) {
    const i = q[qh++];
    const x = i % n;
    const z = (i / n) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const j = nz * n + nx;
      if (seen[j] || t.blocksWalker(nx, nz) || Math.abs(t.elev[j] - t.elev[i]) > 1) continue;
      seen[j] = 1;
      q[qt++] = j;
    }
  }
  return seen;
}

/**
 * Builds Greenvale: grass hills and mountains, groves of trees and one small river. No randomness between
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
      const sp = Math.hypot(x + 0.5 - RIVER.centerX(RIVER.sourceZ), z + 0.5 - RIVER.sourceZ) - 4.4;
      // the plunge pool under the waterfall
      const pool = Math.hypot((x + 0.5 - WATERFALL.x) * 0.8, z + 0.5 - (WATERFALL.z + 3.5)) - 4;
      let w = Math.min(d, sp, pool);
      for (const lk of LAKES) w = Math.min(w, Math.hypot(x + 0.5 - lk.x, z + 0.5 - lk.z) - lk.r);
      water[z * n + x] = w;
    }
  const noTree = new Uint8Array(n * n);
  const H = heightmap(n, water, noTree);
  t.elev.set(H);

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
  t.reach = reachable(t);

  // trees: groves from noise plus lone trees, never closer than a few cells, with open lanes
  const placed: TreeInst[] = [];
  const minGap = (a: number) => (a > 0.62 ? 3.2 : 5.5);
  const ok = (x: number, z: number, gap: number) => {
    if (!t.isFree(x, z) || !t.isFree(x + 1, z) || !t.isFree(x, z + 1)) return false;
    if (water[z * n + x] < 4) return false;
    // no trees on stair paths or the bare rock and snow of the high peaks
    if (noTree[z * n + x] || noTree[z * n + x + 1] || t.elev[z * n + x] >= 8) return false;
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
