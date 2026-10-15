import { hash2 } from '../../core/Rng';
import { GROUND_TILES, type GroundTileDef } from './groundTiles';
import { PAL, defineTex, mix, ramp, shade } from './atlas';

/**
 * Water sheet («Водоёмы») textures and palette.
 *
 * 1. Prop atlas tiles (defineTex): water surfaces per type, foam, falling water, lily pads and
 *    flowers, reeds and cattails, wet wood, wet / mossy stones, bottom tiles.
 * 2. Ground tile kinds registered into GROUND_TILES (no edit of groundTiles.ts: this module adds
 *    keys at import time). Liquid kinds are named `water_<type>_<depth 1..5>` so the existing ground
 *    shader treats them as animated water (/water/ → anim 1); shores and beds are land kinds.
 *    See src/world/water/carve.ts for the carving API that paints them.
 */

/** Palette 14 of the sheet («Цветовая палитра воды и окружения»). */
export const WATER_PAL = {
  sand: 0xf3d9a0, // прибрежный песок
  shallow: 0x7cc8de, // мелкая вода
  river: 0x2f86bd, // речная вода
  deep: 0x1a4f86, // глубокая вода
  sea: 0x1d4f9c, // морская вода
  cyan: 0x6ed8f6, // light highlight
  swamp: 0x1f5a34, // болотная вода
  foam: 0xeef2f4, // пена / волны
  plant: 0x6ea52c, // растения в воде
  plantDark: 0x557c2e,
  rockUnder: 0x5c6670, // камни под водой
};

export type WaterType = 'river' | 'stream' | 'lake' | 'swamp' | 'sea' | 'fast' | 'lagoon' | 'mountain';

/** Base ramps per water type, from shallow (index 0) to very deep (index 4). */
export const WATER_RAMPS: Record<WaterType, number[]> = {
  river: [0x6ec4d8, 0x46a6cc, 0x2f86bd, 0x22679f, 0x184a7c],
  stream: [0x7ccbdc, 0x58b2d0, 0x3c94c4, 0x2a74a8, 0x1e5486],
  fast: [0x8ad2e4, 0x5cb6d8, 0x3a96c8, 0x2a76aa, 0x1e5688],
  mountain: [0x8ad8e8, 0x5cc0dc, 0x3aa0cc, 0x2a7cb0, 0x1c5a8c],
  lake: [0x6cbcc8, 0x3e9cb8, 0x2a7aa6, 0x1e5c8a, 0x15426c],
  lagoon: [0x8ae0e0, 0x5ccad6, 0x3aaccc, 0x2a8ab4, 0x1e6896],
  sea: [0x74cce0, 0x3e9ed0, 0x2a74bc, 0x1d55a0, 0x143c7c],
  swamp: [0x4a7a48, 0x3a6a3e, 0x2e5a36, 0x22482c, 0x183822],
};

const H = (x: number, y: number, s: number) => hash2(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, s);

/**
 * Tileable Voronoi caustic network (the light polygon lines of the sheet's water): returns the
 * distance to the nearest cell border in pixels (0 = on a line).
 */
function caustic(x: number, y: number, seed: number, cells = 4): number {
  const s = 16 / cells;
  const gx = Math.floor(x / s);
  const gy = Math.floor(y / s);
  let d1 = 99;
  let d2 = 99;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i;
      const cy = gy + j;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const px = (cx + 0.2 + hash2(wx, wy, seed) * 0.6) * s;
      const py = (cy + 0.2 + hash2(wx, wy, seed + 1) * 0.6) * s;
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  return (d2 - d1) / 2;
}

/** Water surface painter: base colour with darker cells and bright caustic lines. */
export function waterPaint(base: number, opts: { seed?: number; lines?: number; cells?: number; murky?: boolean; streak?: boolean } = {}) {
  const seed = opts.seed ?? 5;
  const lines = opts.lines ?? 1;
  return (x: number, y: number, v = 0): number => {
    const s = seed + v * 13;
    const e = caustic(x, y, s, opts.cells ?? 4);
    let c = shade(base, 0.9 + H(x >> 1, y >> 1, s + 7) * 0.12);
    if (opts.murky) {
      if (H(x, y, s + 3) > 0.9) c = shade(base, 1.25);
      if (H(x >> 2, y >> 2, s + 4) > 0.8) c = mix(c, 0x3a6a2a, 0.35);
      return e < 0.6 && lines > 0.3 ? mix(c, 0x6a9a5a, 0.35) : c;
    }
    if (opts.streak && (x + (y >> 2)) % 6 === 0 && H(x, y, s + 9) > 0.4) c = mix(c, WATER_PAL.foam, 0.45);
    if (e < 0.32) c = mix(c, WATER_PAL.foam, 0.6 * lines);
    else if (e < 0.75) c = mix(c, WATER_PAL.cyan, 0.25 * lines);
    return c;
  };
}

// ---------------------------------------------------------------- prop atlas tiles

const tex = (name: string, p: (x: number, y: number, v: number) => number) => defineTex(name, (x, y, _h, v) => p(x, y, v));

// 12. water textures per type
tex('wtr_river', waterPaint(WATER_RAMPS.river[2], { seed: 11 }));
tex('wtr_lake', waterPaint(WATER_RAMPS.lake[2], { seed: 21, lines: 0.7 }));
tex('wtr_shallow', waterPaint(WATER_PAL.shallow, { seed: 31 }));
tex('wtr_deep', waterPaint(WATER_RAMPS.sea[4], { seed: 41, lines: 0.45 }));
tex('wtr_sea', waterPaint(WATER_RAMPS.sea[1], { seed: 51, cells: 3 }));
tex('wtr_swamp', waterPaint(WATER_PAL.swamp, { seed: 61, murky: true }));
tex('wtr_fast', waterPaint(WATER_RAMPS.fast[1], { seed: 71, streak: true }));

// foam and falling water
defineTex('wtr_foam', (x, y, h) => {
  const r = h(1);
  if (r > 0.82) return 0xffffff;
  if (r < 0.18) return 0xb8dcea;
  return shade(WATER_PAL.foam, 0.94 + h(2) * 0.08);
});
defineTex('wtr_fall', (x, y, h) => {
  const lane = hash2(x, 0, 81);
  const streak = (y + Math.floor(lane * 16)) % 8;
  if (streak < 2 && lane > 0.3) return 0xf4fbff;
  const base = mix(0x4aa6d8, 0xb8e2f6, lane * 0.6);
  return shade(base, 0.92 + h(1) * 0.1);
});

// 11. decorative plants
defineTex('lily_pad', (x, y, h) => {
  const vein = x === 7 || x === 8 || x === y || x === 15 - y;
  if (vein) return 0x9ad04a;
  return shade(h(1) > 0.7 ? 0x5aa83a : 0x3e8a2e, 0.92 + h(2) * 0.1);
});
defineTex('lily_flower', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d < 2.2) return 0xffd84a;
  return shade(d < 5 ? 0xff9ac8 : 0xe86aa6, 0.94 + h(1) * 0.08);
});
defineTex('reed_stem', (x, y, h) => shade(x % 4 === 0 ? 0x4a7a26 : h(1) > 0.8 ? 0x8ab84a : 0x6a9a34, 0.94 + h(2) * 0.08));
defineTex('cattail', (x, y, h) => shade(h(1) > 0.85 ? 0x8a5a32 : 0x5e3a1e, 0.92 + h(2) * 0.1));
defineTex('algae', (x, y, h) => {
  const s = (x + ((y >> 2) & 1) * 2) % 4;
  return shade(s === 0 ? 0x2e5a24 : ramp([0x3e6a2a, 0x4f7a34, 0x6aa42c], h(1)), 0.92 + h(2) * 0.1);
});

// wet wood (flooded logs, pier posts below the waterline)
defineTex('bark_wet', (x, y, h) => {
  const c = ramp([0x2a1c14, 0x3e2a1e, 0x4e3628, 0x5e4430], h(x, 1) * 0.6 + h(1) * 0.4);
  if (y > 11 && h(3) > 0.55) return shade(PAL.moss[1], 0.9 + h(4) * 0.2);
  return shade(c, x % 3 === 0 ? 0.85 : 1);
});
defineTex('log_end_wet', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 7) return 0x2e2016;
  return shade(Math.floor(d) % 2 ? 0x8a6a48 : 0x6e5236, 0.94 + h(1) * 0.08);
});

// stones in and by the water
const rockBlock = (cols: number[], moss: number) => (x: number, y: number, h: (a: number, b?: number) => number) => {
  const off = ((y >> 3) & 1) * 4;
  const lx = (x + off) & 7;
  const ly = y & 7;
  if (lx === 7 || ly === 7) return cols[0];
  if (moss && y < 3 + h(x, 9) * 3 && h(x, 5) < moss) return ramp(PAL.moss, h(x, 6));
  let k = 0.93 + h(1) * 0.1;
  if (lx === 0 || ly === 0) k *= 1.12;
  return shade(cols[1 + Math.floor(h((x + off) >> 3, y >> 3) * (cols.length - 1))], k);
};
const ROCK = [0x3a3644, 0x5e5866, 0x766e7a, 0x8e8690, 0xa49ca8];
defineTex('rock_wet', rockBlock(ROCK, 0));
defineTex('rock_wet_mossy', rockBlock(ROCK, 0.7));
defineTex('rock_under', rockBlock([0x30404c, 0x4a5a66, 0x5c6670, 0x6c7a84], 0));

// 13. shore and bottom textures
const sandP = (x: number, y: number, v: number) => {
  const r = H(x, y, 101 + v);
  let c = ramp([0xdcbc80, 0xe8cc92, 0xf3d9a0, 0xf8e4b4], H(x >> 1, y, 102 + v));
  if (r > 0.96) c = 0xb8945a;
  return shade(c, 0.97 + H(x, y, 103) * 0.05);
};
const mudP = (x: number, y: number, v: number) => {
  const r = H(x, y, 111 + v);
  let c = ramp([0x5a3420, 0x7a4a2c, 0x8e5a36, 0x9e6a42], H(x >> 1, y >> 1, 112 + v));
  if (r > 0.95) c = 0xb07a50;
  return shade(c, 0.95 + H(x, y, 113) * 0.08);
};
const stonesP = (x: number, y: number, v: number) => {
  const e = caustic(x, y, 121 + v, 4);
  if (e < 0.6) return 0x3a3442;
  return shade(ramp([0x6a6270, 0x7e7684, 0x948c98], H(x >> 2, y >> 2, 122 + v)), 0.92 + H(x, y, 123) * 0.12 + (e > 2 ? 0.06 : 0));
};
const pebbleP = (x: number, y: number, v: number) => {
  const e = caustic(x, y, 131 + v, 6);
  if (e < 0.5) return 0x6a6070;
  return shade(ramp([0x8e8490, 0xa49aa4, 0xbab0b8, 0x9a8a80], H(x >> 1, y >> 1, 132 + v)), 0.94 + H(x, y, 133) * 0.1);
};
const algaeP = (x: number, y: number, v: number) => {
  const b = H(x >> 1, y >> 1, 141 + v);
  if (b > 0.6) return shade(b > 0.85 ? 0x6aa42c : 0x3e7a2a, 0.92 + H(x, y, 142) * 0.12);
  return shade(0x1e4a2a, 0.9 + H(x, y, 143) * 0.15);
};
const grassP = (x: number, y: number, v: number) => {
  const r = H(x, y, 151 + v);
  return shade(r > 0.85 ? 0x7ab44a : r > 0.35 ? 0x5a9a3a : 0x4a8432, 0.94 + H(x, y, 152) * 0.1);
};
const rockP = (x: number, y: number, v: number) => rockBlock(ROCK, 0.25)(x, y, (a, b = 0) => hash2(a * 31 + x * 3 + 7 + v, b * 17 + y * 5 + 3, 161));
const deepShadowP = waterPaint(0x0e2a48, { seed: 171, lines: 0.25 });

tex('bed_sand', sandP);
tex('bed_mud', mudP);
tex('bed_stones', stonesP);
tex('bed_pebble', pebbleP);
tex('bed_algae', algaeP);
tex('bed_deep', deepShadowP);

// ---------------------------------------------------------------- ground tile kinds

/** Tile name of a water cell of a type at a depth level 1 (very shallow) .. 5 (very deep). */
export function waterTile(type: WaterType, depth: number): string {
  return `water_${type}_${Math.max(1, Math.min(5, Math.round(depth)))}`;
}

/**
 * Depth looks (sheet section 2): levels 1-2 show the bottom through the water (bottom pattern mixed
 * in), 3 is the plain type colour, 4-5 darken toward navy with fainter caustics.
 */
function waterTileDef(type: WaterType, depth: number): GroundTileDef {
  const base = WATER_RAMPS[type][depth - 1];
  const surf = waterPaint(base, { seed: 200 + depth * 7, lines: depth >= 4 ? 0.45 : 1, murky: type === 'swamp', streak: type === 'fast' || type === 'mountain', cells: type === 'sea' ? 3 : 4 });
  const bottom = type === 'swamp' ? algaeP : type === 'sea' || type === 'lagoon' ? sandP : type === 'mountain' || type === 'fast' ? pebbleP : stonesP;
  const show = depth === 1 ? 0.45 : depth === 2 ? 0.22 : 0;
  return {
    colors: [base, WATER_RAMPS[type][Math.min(4, depth)]],
    paint: (x, y, v) => {
      const c = surf(x, y, v);
      return show ? mix(c, mix(bottom(x, y, v), base, 0.35), show) : c;
    },
    soil: 'rock',
  };
}

const TYPES = Object.keys(WATER_RAMPS) as WaterType[];
for (const ty of TYPES) for (let d = 1; d <= 5; d++) GROUND_TILES[waterTile(ty, d)] = waterTileDef(ty, d);

/** Shore kinds (sheet section 7) and exposed beds (section 13), as walkable land tiles. */
export type ShoreType = 'sand' | 'grass' | 'clay' | 'rock' | 'mud' | 'pebble';
export const SHORE_TILE: Record<ShoreType, string> = {
  sand: 'shore_sand',
  grass: 'shore_grass',
  clay: 'shore_clay_dirt',
  rock: 'shore_rock',
  mud: 'shore_mud_dirt',
  pebble: 'shore_pebble_rock',
};

const wetEdge = (p: (x: number, y: number, v: number) => number, k = 0.9) => (x: number, y: number, v: number) => shade(p(x, y, v), k + H(x, y, 181) * 0.04);
GROUND_TILES.shore_sand = { colors: [WATER_PAL.sand, 0xe8cc92], paint: sandP, soil: 'sandstone', foliage: 0.04 };
GROUND_TILES.shore_sand_wet = { colors: [0xd8b880, 0xc8a870], paint: wetEdge(sandP, 0.86), soil: 'sandstone' };
GROUND_TILES.shore_grass = { colors: [0x5a9a3a, 0x4a8432], paint: grassP, soil: 'dirt', foliage: 0.8 };
GROUND_TILES.shore_clay_dirt = { colors: [0x8e5a36, 0x7a4a2c], paint: mudP, soil: 'dirt', foliage: 0.1 };
GROUND_TILES.shore_rock = { colors: [0x766e7a, 0x5e5866], paint: rockP, soil: 'rock' };
GROUND_TILES.shore_mud_dirt = { colors: [0x4e3e2a, 0x3e3020], paint: (x, y, v) => mix(mudP(x, y, v), algaeP(x, y, v), H(x >> 2, y >> 2, 191 + v) > 0.7 ? 0.5 : 0.15), soil: 'dirt', foliage: 0.3 };
GROUND_TILES.shore_pebble_rock = { colors: [0xa49aa4, 0x8e8490], paint: pebbleP, soil: 'rock' };
