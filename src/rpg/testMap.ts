import { hash2 } from '../core/Rng';
import type { MapDef } from '../data/types';
import { CELL, Terrain } from '../game/Terrain';
import { paintRoad, placeProp } from '../world/props/place';

/**
 * «Тренировочная поляна»: the fixed 100 × 100 test map. A flat open meadow (block-step ground,
 * no slopes) with the spawn point, exactly three training dummies, a few 1-block obstacles near
 * the edges for jumping and decor (trees, rocks, bushes, lamps) only along the border.
 */
export const TEST_MAP: MapDef = {
  id: 'training',
  name: { ru: 'Тренировочная поляна', en: 'Training Meadow' },
  desc: { ru: 'Поле 100 × 100 с тремя манекенами.', en: '100 × 100 field with three dummies.' },
  size: 100,
  generator: 'meadow',
  noMobs: true,
  palette: {
    sky: 0x9fd2ec, fog: 0xa8d0c8, fogNear: 34, fogFar: 72, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass2: [0x78b44c, 0x7eb952],
    },
    blocks: { trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0x6aa63e], birch: [0xe8e4d8, 0xd8d2c4], pine: [0x2f6a3a, 0x36743f] },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};

/** Where every character appears (and returns to on load), facing the dummies (north, -z). */
export const SPAWN = { x: 50, z: 60 };

export interface DummySpot {
  id: string;
  name: string;
  x: number;
  z: number;
}

/**
 * Exactly three dummies: a close pair (1.4 blocks apart, for the spear sweep hitting two at once)
 * and a lone one seven blocks to the east (single-target tests).
 */
export const DUMMIES: DummySpot[] = [
  { id: 'dummy_a', name: 'Манекен А', x: 47.3, z: 50 },
  { id: 'dummy_b', name: 'Манекен Б', x: 48.7, z: 50 },
  { id: 'dummy_c', name: 'Манекен В', x: 56, z: 50 },
];

/** Impassable border band (cells), where the decor stands. */
export const RIM = 4;

/** 1-block obstacles (cell rectangles x0, z0, x1, z1 inclusive), all near the edges. */
export const OBSTACLES: [number, number, number, number][] = [
  [10, 30, 12, 30],
  [86, 68, 87, 69],
  [20, 84, 20, 84],
  [70, 12, 72, 12],
];

export function buildTestMap(): Terrain {
  const n = TEST_MAP.size;
  const t = new Terrain(n);
  for (const name of Object.keys(TEST_MAP.palette.tiles)) t.tileId(name);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      t.tile[i] = t.tileId(hash2(x >> 2, z >> 2, 77) > 0.7 ? 'grass2' : 'grass');
      if (Math.min(x, z, n - 1 - x, n - 1 - z) < RIM) t.cell[i] = CELL.wall;
    }
  // a sandy yard under the dummies and a path to it from the spawn
  paintRoad(t, 'road_sand', [[44, 50], [60, 50]], 4, { decor: 0, ragged: 0.4, seed: 7 });
  paintRoad(t, 'road_sand', [[50, 52], [50, 61]], 2, { decor: 0, ragged: 0.3, seed: 8 });
  // 1-block steps to jump onto (block-step ground: no slopes anywhere)
  for (const [x0, z0, x1, z1] of OBSTACLES) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) t.elev[z * n + x] = 1;
  placeBorderDecor(t);
  return t;
}

/** Trees, rocks, bushes and a few lamps inside the impassable border band only. */
function placeBorderDecor(t: Terrain) {
  const n = t.size;
  const trees = ['tree_oak', 'tree_oak', 'tree_birch', 'tree_pine', 'tree_oak_yellow'];
  const small = ['bush_low', 'bush_mid', 'rock_low', 'rock_mossy', 'flowers_white', 'flowers_yellow', 'fern', 'grass_tall'];
  let k = 0;
  for (let p = 2; p < n - 2; p += 5) {
    for (const [x, z] of [[p, 1.5], [p, n - 1.5], [1.5, p], [n - 1.5, p]] as [number, number][]) {
      k++;
      const r = hash2(Math.floor(x), Math.floor(z), 31);
      placeProp(t, trees[Math.floor(r * trees.length)], x + 0.5, z + 0.5, { variant: k % 3, yaw: (r - 0.5) * 0.8, noCollide: true });
      const sx = x === 1.5 ? 3.3 : x === n - 1.5 ? n - 3.3 : x + 2.5;
      const sz = z === 1.5 ? 3.3 : z === n - 1.5 ? n - 3.3 : z + 2.5;
      placeProp(t, small[Math.floor(hash2(k, 3, 41) * small.length)], sx, sz, { variant: k % 3, yaw: r * 6.28, noCollide: true });
    }
  }
  // lamps at the four corners of the open field (inside the border band)
  for (const [x, z] of [[3.5, 3.5], [n - 3.5, 3.5], [3.5, n - 3.5], [n - 3.5, n - 3.5]] as [number, number][]) placeProp(t, 'lamp_post', x, z, { noCollide: true });
}
