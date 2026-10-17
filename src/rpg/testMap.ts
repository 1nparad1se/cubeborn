import { hash2 } from '../core/Rng';
import type { MapDef } from '../data/types';
import { CELL, Terrain } from '../game/Terrain';

/**
 * «Тренировочная поляна»: the fixed 100 × 100 test map. A flat open meadow (block-step ground,
 * no slopes) with the spawn point, exactly three training dummies and a few 1-block terrain
 * obstacles near the edges for jumping.
 */
export const TEST_MAP: MapDef = {
  id: 'training',
  name: { ru: 'Тренировочная поляна', en: 'Training Meadow' },
  desc: { ru: 'Поле 100 × 100 с тремя манекенами.', en: '100 × 100 field with three dummies.' },
  size: 100,
  generator: 'meadow',
  palette: {
    sky: 0x9fd2ec, fog: 0xa8d0c8, fogNear: 34, fogFar: 72, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass2: [0x78b44c, 0x7eb952],
    },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};

/** Where every character appears (and returns to on load), facing the dummies (north, -z). */
export const SPAWN = { x: 50, z: 60 };

interface DummySpot {
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

/** Impassable border band (cells). */
const RIM = 4;

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
  // 1-block steps to jump onto (block-step ground: no slopes anywhere)
  for (const [x0, z0, x1, z1] of OBSTACLES) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) t.elev[z * n + x] = 1;
  return t;
}
