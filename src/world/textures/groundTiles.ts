import { hash2 } from '../../core/Rng';
import { mix, shade } from './atlas';

/**
 * Terrain surface kinds painted onto map tiles (roads and paths, sheet 10 «Дороги»). A map uses one
 * by setting a cell's tile to the kind's name (`paintRoad` in src/world/props/place.ts does it along
 * a polyline). The ground renderer (render/Textures.makeGroundAtlas) asks `groundTile(name)` for
 * every tile name and, when one is registered here, paints the 4 top variants with `paint` instead
 * of the generic family pattern (the shader picks one of them per half-block and mirrors it at
 * random, so 4 distinct variants keep a long road from looking tiled); the minimap takes
 * `colors[0]`. Edge transitions between different tiles on the same level come from the ground
 * shader's ragged pixel borders; the variants also fray toward their own borders (grass, moss,
 * sand) so a road reads as worn into the ground.
 *
 * Base kinds: road_stone, road_dirt, path_forest, road_sand, boardwalk, path_mountain, path_swamp.
 * Sheet variants (`<base>_<variant>`, see ROAD_VARIANTS): ruined, overgrown, ruts, stones, drift,
 * slabs, scree, narrow, mud, puddles.
 */
export interface GroundTileDef {
  /** Dominant colours (minimap, soil fallback). */
  colors: number[];
  /** Pixel painter for top variant v (0..3), 16x16; returns 0xRRGGBB. */
  paint: (x: number, y: number, v: number) => number;
  /** Ground under the cliff rim: 'dirt' | 'rock' | 'sandstone'. */
  soil?: 'dirt' | 'rock' | 'sandstone';
  /** Grass/flower sprites per cell (0 = bare). */
  foliage?: number;
}

/** Sheet 10 palettes («Материалы и цвета», 16x16). */
export const ROAD_PAL = {
  stone: [0x3e3644, 0x6e6274, 0x8a7c8c, 0x9e90a2, 0xb0a4b2],
  dirt: [0x3e2418, 0x5a3420, 0x8a4e30, 0xa0583a, 0xb86a3e],
  grass: [0x2f5a1a, 0x3f7a24, 0x5aa02e, 0x8cc63e],
  sand: [0x6a4a2a, 0xc08448, 0xd09a58, 0xdca868, 0xe8b878],
  wood: [0x3e2214, 0x5a3420, 0x7a4a2a, 0xa0643a, 0xc07848],
  rock: [0x3a3a44, 0x6a6a74, 0x8a8a94, 0xa4a4ac, 0xc0c0c8],
  mud: [0x3a2a20, 0x4a3828, 0x5a4632, 0x6a5a2a, 0x5a7034],
  water: [0x10304a, 0x1a4a6a, 0x2a6a8a, 0x5aa0c0],
  moss: [0x2e4a24, 0x4a6a2a, 0x6a8a34],
  flower: [0xe070a0, 0xf0e070, 0xf0f0f0, 0xa070e0],
};

const H = (x: number, y: number, s: number) => hash2(x & 15, y & 15, s);
const pick = (c: readonly number[], t: number) => c[Math.max(0, Math.min(c.length - 1, Math.floor(t * c.length)))];
/** Smooth-ish value noise over the 16px tile (wraps), for clumps. */
function vn(x: number, y: number, s: number, cell = 4): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = (x % cell) / cell;
  const fy = (y % cell) / cell;
  const n = 16 / cell;
  const c = (a: number, b: number) => hash2(((a % n) + n) % n, ((b % n) + n) % n, s);
  const a = c(gx, gy) + (c(gx + 1, gy) - c(gx, gy)) * fx;
  const b = c(gx, gy + 1) + (c(gx + 1, gy + 1) - c(gx, gy + 1)) * fx;
  return a + (b - a) * fy;
}
/** Distance to the tile border 0..7.5 (variants fray toward it). */
const edgeD = (x: number, y: number) => Math.min(x, 15 - x, y, 15 - y);

/** Grass pixel with tufts, occasional flowers. */
function grassPx(x: number, y: number, v: number, flowers = 0.03): number {
  const r = H(x, y, 801 + v);
  if (r > 1 - flowers) return pick(ROAD_PAL.flower, H(x, y, 802 + v));
  const t = vn(x, y, 803 + v, 2) * 0.7 + r * 0.3;
  return shade(pick(ROAD_PAL.grass, 0.15 + t * 0.85), 0.94 + H(x, y, 804) * 0.1);
}

// ---------------------------------------------------------------- painters

interface CobbleOpts {
  /** Chance of moss in the joints. */
  moss?: number;
  /** Fraction of stones missing (ruined): dirt/grass shows through. */
  missing?: number;
  /** Grass creeping over stones (overgrown) 0..1. */
  grass?: number;
  /** Stone size px (4 cobbles, 8 slabs). */
  size?: number;
  /** Crack density. */
  cracks?: number;
  /** Soil under missing stones. */
  under?: 'dirt' | 'grass' | 'scree';
}

/** Cobbles / slabs in staggered rows with light top-left edges, dark joints and per-stone tone. */
function cobble(cols: readonly number[], o: CobbleOpts = {}): GroundTileDef['paint'] {
  const s = o.size ?? 4;
  return (x, y, v) => {
    const row = Math.floor(y / s);
    const off = (row & 1) * (s >> 1) + Math.floor(hash2(row, v, 91) * 2);
    const sx = Math.floor((x + off) / s);
    const lx = (x + off) % s;
    const ly = y % s;
    const id = hash2(sx & 31, row, 71 + v);
    const id2 = hash2(sx & 31, row, 171 + v);
    const ed = edgeD(x, y);
    // overgrowth: grass clumps biased to the tile border
    if (o.grass && vn(x, y, 301 + v, 4) + (7 - ed) * 0.04 > 1.05 - o.grass) return grassPx(x, y, v, 0.05);
    if (o.missing && id2 < o.missing) {
      if (o.under === 'grass' || (o.under !== 'scree' && H(x, y, 302 + v) > 0.6)) return grassPx(x, y, v, 0.02);
      if (o.under === 'scree') return H(x, y, 303 + v) > 0.7 ? cols[2] : shade(ROAD_PAL.rock[0], 0.9 + H(x, y, 304) * 0.3);
      return shade(pick(ROAD_PAL.dirt, 0.15 + H(x, y, 305 + v) * 0.6), 0.95);
    }
    if (lx === s - 1 || ly === s - 1) {
      if (o.moss && H(x, y, 9 + v) < o.moss) return pick(ROAD_PAL.moss, H(x, y, 10));
      return shade(cols[0], 0.9 + H(x, y, 11) * 0.15);
    }
    let k = 0.93 + H(x, y, 3 + v) * 0.1;
    if (lx === 0 || ly === 0) k *= 1.13;
    if (lx === s - 2 || ly === s - 2) k *= 0.9;
    if (o.cracks && s > 4 && id > 1 - o.cracks && lx === ly && lx > 1 && lx < s - 3) return shade(cols[0], 1.1);
    if (o.moss && id < o.moss * 0.5 && H(x, y, 12 + v) > 0.55) return pick(ROAD_PAL.moss, H(x, y, 13));
    return shade(cols[1 + Math.floor(id * (cols.length - 1))], k);
  };
}

interface DirtOpts {
  ruts?: boolean;
  grass?: number;
  pebbles?: number;
  puddles?: number;
  pal?: readonly number[];
  flowers?: number;
  leaves?: number;
}

/** Packed earth: two-scale clumps, pebbles, optional cart ruts (along y), grass fringe, puddles. */
function dirt(o: DirtOpts = {}): GroundTileDef['paint'] {
  const pal = o.pal ?? ROAD_PAL.dirt;
  return (x, y, v) => {
    const ed = edgeD(x, y);
    if (o.grass && vn(x, y, 401 + v, 4) + (7 - ed) * 0.05 > 1.1 - o.grass) return grassPx(x, y, v, o.flowers ?? 0.04);
    if (o.puddles && vn(x, y, 402 + v, 4) > 1 - o.puddles) {
      const w = H(x, y, 403 + v);
      return w > 0.93 ? ROAD_PAL.water[3] : shade(ROAD_PAL.water[1 + (w > 0.6 ? 1 : 0)], 0.9);
    }
    if (o.leaves && H(x, y, 404 + v) > 1 - o.leaves) return [0xb0602a, 0xd08a30, 0x8a4a20, 0xc07040][Math.floor(H(x, y, 405) * 4)];
    if (o.ruts) {
      const c = (x + Math.floor(hash2(y >> 3, v, 406) * 2)) & 15;
      if (c === 3 || c === 4 || c === 11 || c === 12) return shade(pal[c === 3 || c === 11 ? 0 : 1], 0.95 + H(x, y, 407) * 0.1);
      if (c === 2 || c === 5 || c === 10 || c === 13) return shade(pal[pal.length - 1], 0.95);
    }
    const r = H(x, y, 21 + v);
    if (o.pebbles && r > 1 - o.pebbles) return H(x, y, 408) > 0.5 ? ROAD_PAL.stone[3] : ROAD_PAL.stone[1];
    const t = 0.25 + vn(x, y, 22 + v, 4) * 0.45 + vn(x, y, 23 + v, 2) * 0.3;
    let c = pick(pal, t);
    if (r < 0.02) c = pal[0];
    if (r > 0.985) c = mix(pal[pal.length - 1], 0xffffff, 0.15);
    return shade(c, 0.95 + H(x, y, 24) * 0.07);
  };
}

/** Desert sand: diagonal ripple bands, warm speckles, optional drifts, stones and grass. */
function sand(o: { drift?: boolean; stones?: number; grass?: number; slabs?: boolean } = {}): GroundTileDef['paint'] {
  const P = ROAD_PAL.sand;
  return (x, y, v) => {
    const ed = edgeD(x, y);
    if (o.grass && vn(x, y, 501 + v, 4) + (7 - ed) * 0.04 > 1.18 - o.grass) return shade(mix(ROAD_PAL.grass[2], 0xc0a050, 0.35), 0.9 + H(x, y, 502) * 0.2);
    if (o.stones && vn(x, y, 503 + v, 4) > 1 - o.stones) {
      const e = vn(x + 1, y + 1, 503 + v, 4) > 1 - o.stones;
      return shade(e ? ROAD_PAL.rock[2] : ROAD_PAL.rock[1], 0.95 + H(x, y, 504) * 0.1);
    }
    if (o.slabs) {
      const sx = (x + ((y >> 3) & 1) * 4) & 7;
      const sy = y & 7;
      if ((sx === 7 || sy === 7) && H(x, y, 505 + v) > 0.25) return P[1];
      if (sx === 0 || sy === 0) return shade(P[4], 1.05);
    }
    const band = (x + y * 2 + v * 3 + Math.floor(vn(x, y, 506 + v, 8) * 4)) % (o.drift ? 5 : 7);
    let c = pick(P, 0.45 + vn(x, y, 42 + v, 4) * 0.55);
    if (band === 0) c = shade(c, 0.9);
    if (band === 1 && o.drift) c = shade(P[4], 1.06);
    const r = H(x, y, 41 + v);
    if (r > 0.96) c = shade(c, 1.08);
    if (r < 0.025) c = P[0];
    return c;
  };
}

/** Boardwalk planks across the tile (4 px boards), nail heads, joints; ruined = missing/broken boards. */
function boards(o: { ruined?: number; moss?: number; pal?: readonly number[] } = {}): GroundTileDef['paint'] {
  const P = o.pal ?? ROAD_PAL.wood;
  return (x, y, v) => {
    const row = y >> 2;
    const ry = y & 3;
    const joint = Math.floor(hash2(row, v, 77) * 16);
    const side = x > joint ? 1 : 0;
    if (o.ruined) {
      const gone = hash2(row, side, 78 + v) < o.ruined;
      if (gone) return ry === 0 ? shade(P[0], 0.7) : shade(0x140c08, 0.9 + H(x, y, 79) * 0.3); // gap into the dark
      if (hash2(row, side + 4, 80 + v) < o.ruined && H(x, y, 81) > 0.7 && ry === 1) return P[0]; // split board
    }
    if (ry === 3) return P[0];
    if (x === joint) return shade(P[0], 1.2);
    if (o.moss && vn(x, y, 82 + v, 4) > 1 - o.moss) return pick(ROAD_PAL.moss, H(x, y, 83));
    const base = P[2 + (Math.floor(hash2(row, side, 51 + v) * 3) % 3)];
    if ((x === (joint + 2) % 16 || x === (joint + 14) % 16) && ry === 1) return 0x8a8a90; // nails
    let k = (ry === 0 ? 1.1 : 1) * (0.94 + H(x, y, 52) * 0.08);
    if (hash2(x >> 2, row * 7 + ry, 13 + v) > 0.84) k *= 0.88; // grain
    return shade(base, k);
  };
}

/** Swamp mud: dark wet earth, glossy patches, puddles with lilies, moss, reeds at the edge. */
function swamp(o: { puddles?: number; grass?: number; mud?: boolean } = {}): GroundTileDef['paint'] {
  const P = ROAD_PAL.mud;
  return (x, y, v) => {
    const ed = edgeD(x, y);
    if (o.grass && vn(x, y, 601 + v, 4) + (7 - ed) * 0.05 > 1.1 - o.grass) return shade(mix(ROAD_PAL.grass[1], P[4], 0.4), 0.85 + H(x, y, 602) * 0.3);
    const pd = vn(x, y, 61 + v, 4);
    if (pd > 1 - (o.puddles ?? 0.1)) {
      const lily = vn(x, y, 603 + v, 2) > 0.82;
      if (lily) return H(x, y, 604) > 0.9 ? 0xe0a0c0 : shade(0x4a8a3a, 0.9 + H(x, y, 605) * 0.2);
      return H(x, y, 606 + v) > 0.94 ? 0x5a8aa0 : shade(pd > 1.08 - (o.puddles ?? 0.1) ? 0x1a3a40 : 0x2a4a44, 0.95);
    }
    if (vn(x, y, 64 + v, 2) > 0.8 || H(x, y, 64 + v) > 0.95) return pick(ROAD_PAL.moss, H(x, y, 65));
    const t = 0.2 + vn(x, y, 66 + v, 4) * 0.5 + H(x, y, 67) * 0.2;
    let c = pick(o.mud ? P.slice(0, 3) : P.slice(0, 4), t);
    if (o.mud && H(x, y, 68 + v) > 0.9) c = shade(c, 1.35); // wet shine
    return shade(c, 0.95 + H(x, y, 69) * 0.08);
  };
}

/** Mountain scree: angular pebbles of three greys on dark grit. */
function scree(): GroundTileDef['paint'] {
  const R = ROAD_PAL.rock;
  return (x, y, v) => {
    const n = vn(x, y, 701 + v, 2);
    if (n > 0.55) return shade(R[2 + (H(x >> 1, y >> 1, 702 + v) > 0.5 ? 1 : 0)], H(x, y - 1, 703) > 0.5 ? 1.1 : 0.95);
    if (H(x, y, 704 + v) > 0.97) return ROAD_PAL.moss[1];
    return shade(R[n > 0.4 ? 1 : 0], 0.9 + H(x, y, 705) * 0.15);
  };
}

const S = ROAD_PAL.stone;
const M = [ROAD_PAL.rock[0], ROAD_PAL.rock[1], ROAD_PAL.rock[2], ROAD_PAL.stone[3], ROAD_PAL.rock[3]];

export const GROUND_TILES: Record<string, GroundTileDef> = {
  // 1. base kinds
  road_stone: { colors: [0x8a7c8c, 0x6e6274], paint: cobble(S, { moss: 0.22 }), soil: 'rock' },
  road_dirt: { colors: [0x8a4e30, 0x5a3420], paint: dirt({ pebbles: 0.012 }), soil: 'dirt' },
  path_forest: { colors: [0x6a4428, 0x5a3420], paint: dirt({ grass: 0.18, leaves: 0.05, flowers: 0.06, pal: [0x3e2418, 0x5a3420, 0x6a4428, 0x7a4e2e, 0x8a5a34] }), soil: 'dirt', foliage: 0.25 },
  road_sand: { colors: [0xe0b070, 0xd09a58], paint: sand(), soil: 'sandstone' },
  boardwalk: { colors: [0xa0643a, 0x7a4a2a], paint: boards(), soil: 'dirt' },
  path_mountain: { colors: [0x8a8a94, 0x6a6a74], paint: cobble(M, { moss: 0.15, size: 5 }), soil: 'rock' },
  path_swamp: { colors: [0x3a2a20, 0x4a3a2a], paint: swamp(), soil: 'dirt' },

  // 2. stone road variants
  road_stone_ruined: { colors: [0x7a6e7c, 0x5a3420], paint: cobble(S, { moss: 0.3, missing: 0.28 }), soil: 'rock' },
  road_stone_overgrown: { colors: [0x6a7a5a, 0x8a7c8c], paint: cobble(S, { moss: 0.45, grass: 0.35, missing: 0.1, under: 'grass' }), soil: 'rock', foliage: 0.3 },
  // 3. dirt road variants
  road_dirt_ruts: { colors: [0x7a4428, 0x5a3420], paint: dirt({ ruts: true, pebbles: 0.02 }), soil: 'dirt' },
  road_dirt_overgrown: { colors: [0x6a6a34, 0x8a4e30], paint: dirt({ grass: 0.38, pebbles: 0.02, flowers: 0.06 }), soil: 'dirt', foliage: 0.3 },
  road_dirt_puddles: { colors: [0x7a4428, 0x1a4a6a], paint: dirt({ ruts: true, puddles: 0.16 }), soil: 'dirt' },
  // 4. forest paths
  path_forest_narrow: { colors: [0x5a6a30, 0x6a4428], paint: dirt({ grass: 0.42, leaves: 0.04, flowers: 0.08, pal: [0x3e2418, 0x5a3420, 0x6a4428, 0x7a4e2e] }), soil: 'dirt', foliage: 0.35 },
  path_forest_stones: { colors: [0x6a4428, 0x8a7c8c], paint: cobble(S, { grass: 0.3, missing: 0.45, moss: 0.4, size: 5 }), soil: 'dirt', foliage: 0.25 },
  path_forest_overgrown: { colors: [0x3f7a24, 0x6a4428], paint: dirt({ grass: 0.6, leaves: 0.05, flowers: 0.1 }), soil: 'dirt', foliage: 0.45 },
  // 5. sand roads
  road_sand_drift: { colors: [0xe8b878, 0xf0c890], paint: sand({ drift: true }), soil: 'sandstone' },
  road_sand_stones: { colors: [0xd09a58, 0x6a6a74], paint: sand({ stones: 0.18, grass: 0.1 }), soil: 'sandstone' },
  road_sand_slabs: { colors: [0xe0b070, 0xf0c890], paint: sand({ slabs: true }), soil: 'sandstone' },
  // 6. boardwalks
  boardwalk_ruined: { colors: [0x7a4a2a, 0x140c08], paint: boards({ ruined: 0.22, moss: 0.08 }), soil: 'dirt' },
  boardwalk_old: { colors: [0x6a5440, 0x4a3a2a], paint: boards({ moss: 0.15, pal: [0x2e241a, 0x4a3a2a, 0x5a4634, 0x6b5440, 0x8c7a62] }), soil: 'dirt' },
  // 7. mountain paths
  path_mountain_slabs: { colors: [0x8a8a94, 0x6a6a74], paint: cobble(M, { size: 8, cracks: 0.5, moss: 0.08 }), soil: 'rock' },
  path_mountain_scree: { colors: [0x6a6a74, 0x3a3a44], paint: scree(), soil: 'rock' },
  path_mountain_narrow: { colors: [0x7a8070, 0x8a8a94], paint: cobble(M, { grass: 0.3, missing: 0.2, under: 'scree', moss: 0.2 }), soil: 'rock' },
  // 8. swamp paths
  path_swamp_overgrown: { colors: [0x3e5a2a, 0x3a2a20], paint: swamp({ grass: 0.4, puddles: 0.08 }), soil: 'dirt', foliage: 0.35 },
  path_swamp_mud: { colors: [0x2a1e16, 0x3a2a20], paint: swamp({ mud: true, puddles: 0.06 }), soil: 'dirt' },
  path_swamp_puddles: { colors: [0x2a4a44, 0x3a2a20], paint: swamp({ puddles: 0.32 }), soil: 'dirt' },
};

export function groundTile(name: string): GroundTileDef | undefined {
  return GROUND_TILES[name];
}

/** Road kinds understood by paintRoad (the base tile names above). */
export type RoadKind = 'road_stone' | 'road_dirt' | 'path_forest' | 'road_sand' | 'boardwalk' | 'path_mountain' | 'path_swamp';

export const ROAD_KINDS: RoadKind[] = ['road_stone', 'road_dirt', 'path_forest', 'road_sand', 'boardwalk', 'path_mountain', 'path_swamp'];

/** Sheet variants available per base kind (tile name = `${kind}_${variant}`). */
export const ROAD_VARIANTS: Record<RoadKind, string[]> = {
  road_stone: ['ruined', 'overgrown'],
  road_dirt: ['ruts', 'overgrown', 'puddles'],
  path_forest: ['narrow', 'stones', 'overgrown'],
  road_sand: ['drift', 'stones', 'slabs'],
  boardwalk: ['ruined', 'old'],
  path_mountain: ['slabs', 'scree', 'narrow'],
  path_swamp: ['overgrown', 'mud', 'puddles'],
};

/** Base kind of a road tile name (e.g. 'road_stone_ruined' → 'road_stone'), or null. */
export function roadBase(name: string): RoadKind | null {
  for (const k of ROAD_KINDS) if (name === k || name.startsWith(k + '_')) return k;
  return null;
}
