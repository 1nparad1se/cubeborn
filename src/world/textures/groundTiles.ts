import { hash2 } from '../../core/Rng';
import { PAL, ramp, shade } from './atlas';

/**
 * Terrain surface kinds painted onto map tiles (roads and paths). A map uses one by setting a
 * cell's tile to the kind's name (`paintRoad` in src/world/props/place.ts does it along a
 * polyline). The ground renderer (render/Textures.makeGroundAtlas) asks `groundTile(name)` for
 * every tile name and, when one is registered here, paints the top rows with `paint` instead of
 * the generic family pattern; the minimap takes `colors[0]`. Edge transitions between different
 * tiles on the same level come from the ground shader's ragged pixel borders.
 *
 * Roads worker: refine painters / add variants here (variant 0..3 = the 4 atlas variants that the
 * shader mixes per half-block), or add new kinds (e.g. 'road_stone_ruined').
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

const H = (x: number, y: number, s: number) => hash2(x & 15, y & 15, s);

function cobbleTop(cols: readonly number[], mossy = 0): GroundTileDef['paint'] {
  return (x, y, v) => {
    const off = ((y >> 2) & 1) * 2;
    const lx = (x + off) & 3;
    const ly = y & 3;
    const id = H((x + off) >> 2, y >> 2, 71 + v);
    if (lx === 3 || ly === 3) return mossy && H(x, y, 9 + v) < mossy ? PAL.moss[2] : shade(cols[0], 1);
    let k = 0.92 + H(x, y, 3 + v) * 0.1;
    if (lx === 0 || ly === 0) k *= 1.12;
    return shade(cols[1 + Math.floor(id * (cols.length - 1))], k);
  };
}

export const GROUND_TILES: Record<string, GroundTileDef> = {
  road_stone: { colors: [0x847a88, 0x6e6674], paint: cobbleTop([0x3e3844, 0x6e6674, 0x847a88, 0x968c98], 0.25), soil: 'rock' },
  road_dirt: {
    colors: [0x8a5a34, 0x7a4e2e],
    paint: (x, y, v) => {
      const r = H(x, y, 21 + v);
      let c = ramp(PAL.dirt, 0.35 + H(x >> 1, y >> 1, 22 + v) * 0.65);
      if (r > 0.94) c = 0xb08060;
      if (r < 0.05) c = PAL.dirt[0];
      return shade(c, 0.95 + H(x, y, 23) * 0.06);
    },
    soil: 'dirt',
  },
  path_forest: {
    colors: [0x7a5232, 0x6a4a2c],
    paint: (x, y, v) => {
      const g = H(x >> 1, y >> 1, 31 + v);
      if (g > 0.86) return shade(0x5a8a3a, 0.9 + H(x, y, 32) * 0.2);
      if (H(x, y, 33 + v) > 0.97) return 0xd08ab0; // fallen petals
      return shade(ramp(PAL.dirt, 0.2 + g * 0.7), 0.94 + H(x, y, 34) * 0.08);
    },
    soil: 'dirt',
    foliage: 0.25,
  },
  road_sand: {
    colors: [0xe2c48e, 0xd4b07a],
    paint: (x, y, v) => {
      const r = H(x, y, 41 + v);
      const wave = (x + (y >> 1) + v) % 7 === 0 ? 0.92 : 1;
      return shade(ramp(PAL.sand, 0.45 + H(x >> 1, y, 42 + v) * 0.55), wave * (r > 0.95 ? 1.06 : 0.98));
    },
    soil: 'sandstone',
  },
  boardwalk: {
    colors: [0x8b5e3c, 0x6d4c3a],
    paint: (x, y, v) => {
      const row = y >> 2;
      if ((y & 3) === 3) return PAL.wood[0];
      const joint = Math.floor(hash2(row, v, 77) * 16);
      if (x === joint) return shade(PAL.wood[0], 1.2);
      const base = PAL.wood[1 + (Math.floor(hash2(row, x > joint ? 1 : 0, 51 + v) * 3) % 3)];
      if ((x === joint + 2 || x === joint - 2) && (y & 3) === 1) return PAL.metal[3]; // nails
      return shade(base, ((y & 3) === 0 ? 1.1 : 1) * (0.94 + H(x, y, 52) * 0.08));
    },
    soil: 'dirt',
  },
  path_mountain: { colors: [0x8e8690, 0x766e7a], paint: cobbleTop([0x3e3a44, 0x766e7a, 0x8e8690, 0xa8a0a8], 0.12), soil: 'rock' },
  path_swamp: {
    colors: [0x4e3e2a, 0x3e3020],
    paint: (x, y, v) => {
      const p = H(x >> 2, y >> 2, 61 + v);
      if (p > 0.85 && H(x, y, 62) > 0.3) return shade(0x2e4a40, 0.9 + H(x, y, 63) * 0.2); // puddle
      if (H(x, y, 64 + v) > 0.93) return PAL.moss[2];
      return shade(ramp(PAL.mud, 0.3 + H(x >> 1, y >> 1, 65 + v) * 0.7), 0.95 + H(x, y, 66) * 0.08);
    },
    soil: 'dirt',
  },
};

export function groundTile(name: string): GroundTileDef | undefined {
  return GROUND_TILES[name];
}

/** Road kinds understood by paintRoad (the tile names above). */
export type RoadKind = 'road_stone' | 'road_dirt' | 'path_forest' | 'road_sand' | 'boardwalk' | 'path_mountain' | 'path_swamp';
