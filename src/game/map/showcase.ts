import { Rng, hash2 } from '../../core/Rng';
import type { MapDef } from '../../data/types';
import { CELL, Terrain } from '../Terrain';
// place before camps: camps.ts imports place.ts (see props/index.ts)
import { paintRoad, placeAlong, placeBridge, placeProp, type PlaceOpts } from '../../world/props/place';
import { placeCamp, type CampKind, type CampSize } from '../../world/props/camps';
import { PROPS } from '../../world/props/index';
import type { PropInstance } from '../../world/props/types';
import { carveLake, carveRiver, carveStream, carveSwamp, carveCoast, carveWaterfall, decorateWater, placeInWater } from '../../world/water/carve';
import { roadBase } from '../../world/textures/groundTiles';

/**
 * «Витрина мира» — a walkable showcase of the world prop library (src/world/props): every prop id
 * at least once, in locations composed like the example panels of the reference sheets. No
 * creatures. Districts (x right, z down; the camera looks from the south-east):
 *
 *   NW mountains: belts of cliffs, a stair path (all stair kinds), caves, a mine, crystals, a tarn
 *     on a shelf spilling into the river as the large waterfall
 *   N  ruins plateau: castle, temple, towers, statues, shrine, arches (ruined stone roads)
 *   NE forest lake (lake + sandy/grass shores) with a stream down to the river
 *   W  forest: every tree and plant
 *   C  village / trading post on the stone road hub, with cargo and every light
 *   E  sea coast: rocky cliffs in the north, beach, bay, piers and a lagoon in the south
 *   W  highland: the fast river falls (medium, small waterfalls) and runs east under every stone bridge
 *   SW swamp with a boardwalk, S the four camp kinds in three sizes
 * River 1 (calm) carries every wooden bridge; roads of all 7 kinds and their variants join it all.
 */

export const SHOWCASE_SIZE = 176;
const N = SHOWCASE_SIZE;
const RIM = 3;
const SEED = 6061;

/** Spawn: the village square. */
export const SHOWCASE_SPAWN = { x: 96.5, z: 90.5 };

// ---------------------------------------------------------------- layout constants
/** Calm river (wooden bridges): centre z by x. */
const R1 = { x0: 60, x1: 170, z: (x: number) => 66 + Math.sin(x / 13) * 2 };
/** Fast river (stone bridges): centre z by x; rises on the western highland. */
const R2 = { x0: 4, x1: 170, z: (x: number) => 110 + Math.sin(x / 17) * 2.5 };
/** Mountain shelf the tarn sits on (elev 5) and the cave face along its south edge. */
const SHELF = { x0: 24, x1: 57, z0: 50, z1: 61, h: 5 };
/** Stair corridor up the mountain (2 cells wide at x..x+1). */
const STAIR_X = 12;
/** Ruins plateau (elev 1). */
const RUINS = { x0: 68, x1: 120, z0: 8, z1: 54 };
/** Western highland of the fast river: elev 5 west of HI_X1, 2 up to HI_X2. */
const HI = { x1: 27, x2: 37, z0: 92, z1: 124 };

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

/** Stair path profile: z ranges of each flight (3 rows, climbing toward -z) and the levels. */
const FLIGHTS: { id: string; z: number; from: number; w: number }[] = [
  { id: 'mountain_stair', z: 60, from: 0, w: 2 }, // rows 60..62: 0 → 2
  { id: 'stone_stair', z: 50, from: 2, w: 2 }, // 50..52: 2 → 4
  { id: 'slope_steep', z: 40, from: 4, w: 2 }, // 40..42: 4 → 6
  { id: 'terraces', z: 30, from: 6, w: 3 }, // 30..32: 6 → 8
];
/** Corridor level at row z (the flat landings between flights). */
function corridorLevel(z: number): number {
  for (const f of FLIGHTS) if (z >= f.z && z <= f.z + 2) return f.from; // under the flight: its base
  if (z > 62) return 0;
  if (z > 52) return 2;
  if (z > 42) return 4;
  if (z > 32) return 6;
  return 8;
}

function heightmap(t: Terrain) {
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      let h = 0;
      // the mountain massif in the north-west corner: belts of 2-block cliffs
      const d = Math.hypot(x - 10, z - 10) * (1 + (noise(x / 7, z / 7, SEED + 1) - 0.5) * 0.28);
      if (d < 54) h = d < 20 ? 8 : d < 30 ? 6 : d < 41 ? 4 : 2;
      // the shelf with the tarn: a straight 5-block cave face on its south side
      if (x >= SHELF.x0 && x <= SHELF.x1 && z >= SHELF.z0 && z <= SHELF.z1) h = SHELF.h;
      // stair corridor (and its shoulders): the path's own landings
      if (x >= STAIR_X - 2 && x <= STAIR_X + 3 && z >= 22 && z <= 66) h = corridorLevel(z);
      // ruins plateau, one block up with a ragged rim
      const rag = Math.round((noise(x / 5, z / 5, SEED + 3) - 0.5) * 4);
      if (x >= RUINS.x0 + rag && x <= RUINS.x1 - rag && z >= RUINS.z0 && z <= RUINS.z1 + rag) h = Math.max(h, 1);
      // a low ridge behind the forest lake
      if (x > 118 && z < 13 + Math.round(noise(x / 6, 1, SEED + 5) * 3)) h = 3;
      // western highland of the fast river
      if (z >= HI.z0 && z <= HI.z1) {
        if (x < HI.x1) h = 5;
        else if (x < HI.x2) h = 2;
      }
      t.elev[z * N + x] = h;
    }
  // a ramp from the forest up onto the western highland (one block per cell)
  ramp(t, 16, 84, 16, 93);
  ramp(t, 31, 126, 31, 122);
}

/** A 3-cell wide path rising evenly from its low end (a) to its high end (b). */
function ramp(t: Terrain, ax: number, az: number, bx: number, bz: number) {
  const h0 = t.elev[az * N + ax];
  const h1 = t.elev[bz * N + bx];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  for (let z = Math.min(az, bz) - 2; z <= Math.max(az, bz) + 2; z++)
    for (let x = Math.min(ax, bx) - 2; x <= Math.max(ax, bx) + 2; x++) {
      const u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (len * len)));
      const dd = Math.hypot(x - ax - (bx - ax) * u, z - az - (bz - az) * u);
      if (dd > 1.6) continue;
      t.elev[z * N + x] = Math.round(h0 + (h1 - h0) * u);
    }
}

/** Base ground tiles: meadow grass, forest floor, rock and snow on the heights, dry grass east. */
function paintGround(t: Terrain) {
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      const i = z * N + x;
      if (Math.min(x, z, N - 1 - x, N - 1 - z) < RIM) {
        t.cell[i] = CELL.wall;
        t.tile[i] = t.tileId('grass');
        continue;
      }
      const e = t.elev[i];
      const v = noise(x / 9, z / 9, SEED + 7);
      let tile = v > 0.62 ? 'grass2' : 'grass';
      if (x < 70 && z < 66 && e >= 2) tile = e >= 8 ? 'snow' : e >= 6 ? (v > 0.5 ? 'rock' : 'grass2') : v > 0.66 ? 'rock' : 'grass';
      if (x < 56 && z > 66 && z < 92) tile = v > 0.55 ? 'moss' : 'grass2';
      t.setTile(x, z, tile, CELL.floor);
    }
}

// ---------------------------------------------------------------- placement helpers

class Placer {
  readonly rng = new Rng(SEED + 99);
  constructor(readonly t: Terrain) {}

  put(id: string, x: number, z: number, o: PlaceOpts = {}): PropInstance | null {
    return placeProp(this.t, id, x, z, o);
  }
  /** Decoration: never blocks walking. */
  deco(id: string, x: number, z: number, o: PlaceOpts = {}): PropInstance | null {
    return placeProp(this.t, id, x, z, { noCollide: true, yaw: (this.rng.next() - 0.5) * 1.2, variant: this.rng.int(0, (PROPS[id].variants ?? 1) - 1), ...o });
  }
  water(id: string, x: number, z: number, o: PlaceOpts = {}): PropInstance | null {
    return placeInWater(this.t, id, x, z, { variant: this.rng.int(0, (PROPS[id].variants ?? 1) - 1), ...o });
  }
  isRoad(cx: number, cz: number): boolean {
    const t = this.t;
    return t.inBounds(cx, cz) && roadBase(t.tileNames[t.tile[t.idx(cx, cz)]] ?? '') !== null;
  }
  /** Free land cell, not on a road, not next to water. */
  open(cx: number, cz: number, margin = 0): boolean {
    const t = this.t;
    for (let dz = -margin; dz <= margin; dz++)
      for (let dx = -margin; dx <= margin; dx++) {
        const x = cx + dx;
        const z = cz + dz;
        if (!t.isFree(x, z) || this.isRoad(x, z) || t.under.has(t.idx(x, z))) return false;
      }
    return true;
  }
  /**
   * Scatters props from a weighted list over a box: `solid` ones go only on open ground (and keep
   * a cell of space so paths stay open), the rest are decoration.
   */
  scatter(ids: string[], box: [number, number, number, number], count: number, o: { solid?: boolean; spacing?: number; ok?: (x: number, z: number) => boolean; tries?: number } = {}) {
    const [x0, z0, x1, z1] = box;
    const placed: [number, number][] = [];
    const sp = o.spacing ?? 1.5;
    let made = 0;
    for (let k = 0; k < (o.tries ?? count * 30) && made < count; k++) {
      const cx = this.rng.int(x0, x1);
      const cz = this.rng.int(z0, z1);
      if (!this.open(cx, cz, o.solid ? 1 : 0) || (o.ok && !o.ok(cx, cz))) continue;
      if (placed.some(([px, pz]) => (px - cx) ** 2 + (pz - cz) ** 2 < sp * sp)) continue;
      const id = ids[this.rng.int(0, ids.length - 1)];
      const [sx, sz] = typeof PROPS[id].size === 'function' ? [1, 1] : (PROPS[id].size as [number, number]);
      const x = cx + sx / 2;
      const z = cz + sz / 2;
      const p = o.solid
        ? this.put(id, x, z, { ifFree: true, variant: this.rng.int(0, (PROPS[id].variants ?? 1) - 1), yaw: (this.rng.next() - 0.5) * 0.5 })
        : this.deco(id, sx === 1 ? cx + 0.3 + this.rng.next() * 0.4 : x, sz === 1 ? cz + 0.3 + this.rng.next() * 0.4 : z);
      if (!p) continue;
      placed.push([cx, cz]);
      made++;
    }
    return made;
  }
}

// ---------------------------------------------------------------- districts

function water(t: Terrain) {
  // tarn on the mountain shelf and its stream to the cliff edge
  carveLake(t, 32, 55, 5, 3.2, { type: 'mountain', shore: 'rock', depth: 4, elev: SHELF.h, transition: 'steep', shoreWidth: 1 });
  carveRiver(t, [[34, 55], [44, 56], [52, 56]], 3, { type: 'mountain', shore: 'pebble', shoreWidth: 1, depth: 3, elev: SHELF.h, ragged: 0.3 });
  // the calm river from the foot of the large fall to the sea
  const r1: [number, number][] = [];
  for (let x = R1.x0; x <= R1.x1; x += 6) r1.push([x, R1.z(x)]);
  carveRiver(t, r1, 5, { type: 'river', shore: 'grass', depth: 4, transition: 'medium', ragged: 0.5 });
  // large waterfall: shelf (elev 5) → river head
  carveWaterfall(t, [53, 57], [63, 57], { size: 'large', drop: 5, width: 4, type: 'mountain' });
  carveRiver(t, [[61, 57], [62, 62], [64, R1.z(64)]], 4, { type: 'river', shore: 'clay', depth: 3, ragged: 0.3 });
  // the fast river: highland source → two falls → stone bridges → sea
  const r2: [number, number][] = [];
  for (let x = R2.x0; x <= R2.x1; x += 6) r2.push([x, R2.z(x)]);
  carveRiver(t, r2, 4, { type: 'fast', shore: 'pebble', depth: 3, transition: 'medium', ragged: 0.4 });
  carveWaterfall(t, [HI.x1 - 4, Math.round(R2.z(HI.x1))], [HI.x1 + 3, Math.round(R2.z(HI.x1))], { size: 'medium', width: 3, type: 'fast' });
  carveWaterfall(t, [HI.x2 - 3, Math.round(R2.z(HI.x2))], [HI.x2 + 3, Math.round(R2.z(HI.x2))], { size: 'small', width: 2, type: 'fast' });
  // forest lake and its stream down to the river
  carveLake(t, 137, 28, 13, 10, { type: 'lake', shore: 'sand', transition: 'smooth', depth: 5 });
  carveLake(t, 128, 34, 5, 4, { type: 'lake', shore: 'grass', transition: 'smooth', depth: 3, seed: 5 });
  carveStream(t, [[140, 38], [137, 48], [138, 58], [136, R1.z(136)]], 2);
  // forest brook into the fast river
  carveStream(t, [[44, 74], [48, 84], [46, 96], [50, 106]], 2, { shore: 'grass' });
  // the sea: sandy beach and a bay in the south, rocky cliffs in the north (re-shored below)
  carveCoast(t, [[156, 176], [153, 162], [147, 152], [150, 140], [156, 130], [154, 118], [158, 104], [161, 92], [157, 80], [161, 66], [167, 56], [176, 50]], { shore: 'sand', shoreWidth: 3, reach: 30 });
  for (let z = 4; z < 104; z++)
    for (let x = 153; x < N - RIM; x++) {
      const i = z * N + x;
      const nm = t.tileNames[t.tile[i]];
      if (nm === 'shore_sand' || nm === 'shore_sand_wet') {
        t.setTile(x, z, 'shore_rock');
        if (nm === 'shore_sand') t.elev[i] = Math.max(t.elev[i], 1 + (hash2(x, z, 3) > 0.6 ? 1 : 0));
      }
    }
  // lagoon behind a sand spit
  carveLake(t, 140, 166, 6.5, 5, { type: 'lagoon', shore: 'sand', transition: 'smooth', depth: 3 });
  // swamp in the south-west, plus a clay-banked pond
  carveSwamp(t, 25, 148, 15, { depth: 3 });
}

function roads(t: Terrain) {
  const R = (k: string, pts: [number, number][], w: number, o: Parameters<typeof paintRoad>[4] = {}) => paintRoad(t, k, pts, w, o);
  // village square and the stone road hub
  R('road_stone', [[82, 90], [112, 90]], 5, { decor: 0.3 });
  R('road_stone', [[96, 84], [96, 100]], 4);
  R('road_stone_overgrown', [[112, 90], [126, 92], [138, 94]], 3);
  // north to the ruins: stone over the wide wooden bridge, ruined on the plateau
  R('road_stone', [[98, 84], [98, R1.z(98) + 4]], 3);
  R('road_stone', [[98, R1.z(98) - 4], [98, 56]], 3);
  R('road_stone_ruined', [[98, 56], [96, 44], [92, 30], [94, 16]], 3, { ruined: 0.4 });
  R('road_stone_ruined', [[96, 44], [110, 40], [114, 28]], 2);
  R('road_stone_overgrown', [[92, 30], [78, 26], [74, 16]], 2, { overgrown: 0.5 });
  // west into the forest (forest paths and their variants)
  R('path_forest', [[82, 90], [70, 88], [58, 86]], 3);
  R('path_forest_stones', [[58, 86], [46, 84]], 2);
  R('path_forest_narrow', [[46, 84], [32, 80], [20, 82], [16, 84]], 2);
  R('path_forest_overgrown', [[58, 86], [52, 74], [44, 70]], 2, { overgrown: 0.5 });
  R('path_forest', [[32, 80], [30, 70]], 2);
  // up the mountain: mountain paths (base, slabs, scree, narrow)
  R('path_mountain', [[30, 70], [22, 68], [STAIR_X + 1, 66]], 2);
  R('path_mountain_slabs', [[STAIR_X + 1, 58], [STAIR_X + 1, 53]], 2);
  R('path_mountain_scree', [[STAIR_X + 1, 48], [STAIR_X + 1, 43]], 2);
  R('path_mountain_narrow', [[STAIR_X + 1, 38], [STAIR_X + 1, 33]], 2);
  R('path_mountain', [[STAIR_X + 1, 28], [STAIR_X + 4, 20], [22, 16]], 2);
  R('path_mountain_slabs', [[30, 70], [40, 67], [52, 67]], 2);
  // east to the sea: sand road (base, drift, stones, slabs)
  R('road_sand', [[112, 92], [124, 100], [134, 104]], 3);
  R('road_sand_stones', [[134, 104], [140, 112]], 3);
  R('road_sand_drift', [[140, 118], [146, 126]], 3, { decor: 0.5 });
  R('road_sand_slabs', [[146, 126], [150, 132]], 3);
  // south to the camps: dirt roads (base, ruts, puddles, overgrown)
  R('road_dirt', [[86, 96], [86, R2.z(86) - 3]], 3);
  R('road_dirt', [[86, R2.z(86) + 3], [86, 124]], 3);
  R('road_dirt_ruts', [[58, 128], [86, 128], [130, 128]], 3);
  R('road_dirt_puddles', [[69, 128], [69, 172]], 2);
  R('road_dirt_overgrown', [[113, 128], [113, 172]], 2, { overgrown: 0.4 });
  R('road_dirt', [[91, 141], [91, 172]], 2);
  // to the swamp: swamp paths (base, overgrown, mud, puddles)
  R('path_swamp', [[58, 128], [46, 132], [42, 134]], 2);
  R('path_swamp_overgrown', [[42, 134], [40, 140]], 2);
  R('path_swamp_mud', [[16, 128], [8, 134]], 2);
  R('path_swamp_puddles', [[44, 160], [36, 168], [24, 170]], 2);
  // village lanes
  R('road_dirt', [[100, 96], [108, 104], [116, 104]], 2);
  R('road_dirt', [[80, 90], [76, 100], [74, 106]], 2);
}

/** Swamp boardwalk: a planked causeway through the pools (walkable), with brackets and steps. */
function boardwalk(t: Terrain, p: Placer) {
  const pts: [number, number][] = [[40, 141], [32, 145], [22, 147], [16, 154], [12, 162]];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[k + 1];
    const len = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
    for (let s = 0; s <= len; s++) {
      const x = ax + ((bx - ax) * s) / len;
      const z = az + ((bz - az) * s) / len;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const cx = Math.floor(x + dx - 0.5);
        const cz = Math.floor(z + dz - 0.5);
        if (!t.inBounds(cx, cz)) continue;
        const i = cx + cz * N;
        if (t.cell[i] === CELL.liquid) {
          t.elev[i] = 0;
          if (t.surf) t.surf[i] = 0;
        }
        // old and broken planks show up along the way
        const v = hash2(cx, cz, 61);
        t.setTile(cx, cz, v < 0.15 ? 'boardwalk_ruined' : v < 0.35 ? 'boardwalk_old' : 'boardwalk', CELL.floor);
      }
    }
  }
  // the planks are dry ground now: rejoin the surface around them
  t.recomputeCorners(8, 136, 46, 170);
  for (const [x, z] of [[30, 146], [20, 149], [14, 158]]) p.deco('road_boardwalk_bracketed', x, z, { yaw: 0, variant: (x + z) % 2 });
  p.put('road_boardwalk_steps', 42, 140.5, { rot: 2, variant: 1 });
  p.put('road_boardwalk_steps', 12, 165, { rot: 1 });
}

/** Mountains: the stair path, caves on the shelf face, the mine, crystals, rocks of every kind. */
function mountains(t: Terrain, p: Placer) {
  // the stair path: one flight of each kind, base at the landing below
  for (const f of FLIGHTS) p.put(f.id, STAIR_X + f.w / 2, f.z + 1.5, { y: f.from });
  // a gentle one-block slope and a danger path up top
  p.put('danger_path', 24, 18.5, { y: 8 });
  p.put('path_wide', 18.5, 22.5, { y: 8 });
  p.put('path_medium', 26, 13.5, { y: 8 });
  p.put('path_narrow', 30.5, 13.5, { y: 8, rot: 1 });
  p.put('rock_slab', STAIR_X + 0.5, 47.5, { y: 4 });
  p.put('rock_slab', STAIR_X + 1.5, 46.5, { y: 4 });
  // snow peak dressing
  p.put('biome_snow', 8, 14);
  p.put('biome_mountain', 30, 30);
  p.put('tree_pine', 7.5, 24.5);
  p.put('tree_pine', 20.5, 36.5);
  p.put('tree_pine', 38.5, 40.5);
  p.put('tree_pine', 6.5, 44.5);
  p.put('statue', 18.5, 10.5);
  p.put('fire_bowl', STAIR_X - 0.5, 28.5, { y: 8 });
  p.put('fire_bowl', STAIR_X + 3.5, 28.5, { y: 8 });
  // caves along the shelf's south face (fronts toward the camera)
  const face = SHELF.z1 + 1;
  p.put('cave_small', 27.5, face + 1);
  p.put('cave_medium', 33.5, face + 1.5);
  p.put('cave_large', 40, face + 1.5);
  p.put('cave_mine', 46.5, face + 1.5);
  p.put('cave_ruins', 52.5, face + 1.5);
  // the mine yard
  p.put('mine_rails', 46.5, face + 4.5, { variant: 0 });
  p.put('mine_rails', 46.5, face + 7.5, { variant: 1 });
  p.put('mine_support', 49.5, face + 4.5, { rot: 1 });
  p.put('mine_lantern', 44, face + 4.5);
  p.put('crate_stone', 43.5, face + 6.5, { variant: 1 });
  p.put('crystal_cluster', 37.5, face + 4.5, { variant: 0 });
  p.put('crystal_cluster', 42.5, face + 3.5, { variant: 1 });
  p.put('magic_crystal', 31.5, face + 3.5, { variant: 1 });
  p.put('glowstone', 36.5, face + 3.5);
  p.put('glowstone', 25.5, face + 3.5, { variant: 1 });
  p.put('stalagmites', 23, face + 3);
  p.put('cave_pool', 55.5, face + 4.5);
  p.put('temple_pillar', 50.5, face + 4.5);
  p.put('temple_pillar', 54.5, face + 6.5);
  // rocks of every shape on the slopes and at the foot of the cliffs
  const rocks = ['rock_low', 'rock_mid', 'rock_high', 'rock_sharp', 'rock_mossy', 'rock_tall'];
  rocks.forEach((id, k) => p.put(id, 5 + k * 3 + 0.0, 70 - (k % 2) * 2, { variant: k % 3, ifFree: true }));
  p.put('cliff', 58.5, 44, { variant: 0 });
  p.put('cliff', 62.5, 46, { variant: 1, rot: 1 });
  p.put('cliff', 34.5, 46, { variant: 2 });
  const blocks = ['rock_block', 'rock_corner', 'rock_step', 'rock_slope', 'rock_column', 'rock_arch', 'rock_joint', 'rock_cliff_block'];
  blocks.forEach((id, k) => p.put(id, 16.5 + (k % 4) * 3, 44.5 + Math.floor(k / 4) * 4, { variant: k, ifFree: true }));
  for (let v = 0; v < 10; v++) p.put('rock_block', 22.5 + (v % 5), 26.5 + Math.floor(v / 5), { variant: v, ifFree: true });
  for (let v = 0; v < 5; v++) p.put('rock_tall', 44 + v * 3, 34 + (v % 2) * 3, { variant: v, ifFree: true });
  p.scatter(['rock_low', 'rock_mid', 'rock_sharp', 'rock_mossy', 'tree_pine', 'tree_pine', 'bush_dry', 'grass_dry'], [4, 4, 66, 48], 60, { solid: true, spacing: 3 });
  p.scatter(['grass_low', 'grass_dry', 'road_scree', 'fern', 'biome_mountain'], [4, 4, 66, 64], 70, { spacing: 2 });
}

/** Ruins plateau: castle, temple, towers, statues, shrine, arches, overgrowth. */
function ruins(t: Terrain, p: Placer) {
  p.put('castle', 86.5, 15.5);
  p.put('temple', 112.5, 21.5);
  p.put('ruin_tower', 78, 36);
  p.put('round_tower', 116, 46);
  p.put('overgrown_ruins', 104.5, 34.5);
  p.put('ruin_wall', 80.5, 44.5);
  p.put('ruin_wall', 74.5, 22.5, { rot: 1 });
  p.put('ruin_columns', 103, 46.5);
  p.put('ruin_columns', 108, 46.5);
  p.put('ruin_arch', 98.5, 51.5);
  p.put('ruin_platform', 88, 38, { y: 1 });
  p.put('ruin_stairs', 88, 40, { y: 0, rot: 0 });
  p.put('slope_gentle', 104, 53.5, { y: 0 });
  p.put('obelisk', 92.5, 24.5);
  p.put('obelisk', 100.5, 24.5);
  p.put('statue', 94.5, 20.5);
  p.put('statue_broken', 84.5, 30.5);
  p.put('statue_broken', 110.5, 30.5);
  p.put('shrine', 96.5, 36.5);
  p.put('fire_bowl', 94.5, 38.5);
  p.put('fire_bowl', 98.5, 38.5);
  p.put('torch_column', 108.5, 17.5);
  p.put('torch_column', 116.5, 17.5);
  p.put('torch_column', 82.5, 20.5);
  p.put('wall_torch', 90.5, 20.5, { variant: 1 });
  p.put('temple_pillar', 106.5, 26.5);
  p.put('temple_pillar', 118.5, 26.5);
  // greenery reclaiming the stones
  p.deco('ivy_wall', 80.5, 45.6, { yaw: 0, variant: 0 });
  p.deco('ivy_hanging', 98.5, 52.4, { yaw: 0 });
  p.deco('vines', 74.9, 22.5, { yaw: Math.PI / 2 });
  p.deco('vines_leafy', 103, 47.2, { yaw: 0 });
  p.deco('vines_flowering', 108, 47.2, { yaw: 0 });
  p.put('combo_steps_bush', 72, 48);
  p.put('combo_flower_stone', 90, 48);
  p.put('combo_grass_stone', 114, 38);
  p.put('tree_oak_ivy', 76.5, 30.5, { variant: 0 });
  p.put('tree_oak_ivy', 118.5, 36.5, { variant: 1 });
  p.put('tree_oak_ivy', 70.5, 40.5, { variant: 2 });
  p.scatter(['bush_low', 'bush_mid', 'flowers_white', 'flowers_purple', 'grass_tall', 'road_moss', 'fern'], [68, 8, 120, 54], 90, { spacing: 1.8 });
  p.scatter(['rock_low', 'bush_tall', 'tree_oak', 'tree_birch'], [68, 8, 120, 54], 14, { solid: true, spacing: 5 });
}

/** The forest: every tree kind (and variant) and every plant, around the paths. */
function forest(t: Terrain, p: Placer) {
  const box: [number, number, number, number] = [4, 72, 58, 104];
  const trees = ['tree_oak', 'tree_oak', 'tree_oak', 'tree_oak', 'tree_birch', 'tree_pine', 'tree_oak_yellow', 'tree_oak_autumn', 'tree_birch', 'tree_pine', 'tree_oak_ivy'];
  // a named grove of each kind near the path so all variants are seen together
  const grove: [string, number][] = [['tree_oak', 0], ['tree_oak', 1], ['tree_oak', 2], ['tree_oak_yellow', 0], ['tree_oak_yellow', 1], ['tree_oak_yellow', 2], ['tree_oak_autumn', 0], ['tree_oak_autumn', 1], ['tree_oak_autumn', 2], ['tree_birch', 0], ['tree_pine', 0], ['tree_oak_ivy', 0]];
  grove.forEach(([id, v], k) => p.put(id, 24.5 + (k % 6) * 4 + (k >= 6 ? 2 : 0), 76.5 + Math.floor(k / 6) * 9, { variant: v, ifFree: true }));
  p.put('tree_big', 38, 92);
  p.put('tree_big', 10, 96);
  p.put('tree_sconce', 39.5, 89.5);
  p.put('tree_sconce', 25.5, 85.5, { variant: 1 });
  p.scatter(trees, box, 48, { solid: true, spacing: 4.5 });
  p.scatter(['bush_low', 'bush_mid', 'bush_tall', 'bush_berry', 'bush_flower', 'undergrowth', 'stump', 'fallen_tree', 'mushrooms_big'], box, 40, { solid: true, spacing: 2.5 });
  p.scatter(['fern', 'leaf_broad', 'grass_low', 'grass_mid', 'grass_tall', 'mushrooms_small', 'mushrooms_glow', 'berries_red', 'berries_blue', 'forest_fruit', 'bush_growth', 'flowers_white', 'flowers_blue', 'glow_mushrooms', 'biome_forest'], box, 220, { spacing: 1.2 });
  for (let v = 0; v < 6; v++) p.deco('bush_growth', 20.5 + v, 90.5, { variant: v });
  p.put('fireflies', 30.5, 88.5);
  p.put('fireflies', 14.5, 76.5);
  p.put('fireflies', 46.5, 92.5);
  p.put('glow_mushrooms', 34.5, 95.5);
  p.put('dead_tree', 52.5, 98.5);
  p.put('fallen_tree', 22, 100.5, { variant: 1 });
  // a forest camp clearing on the highland above the falls
  p.put('campfire', 12, 104);
  p.put('standing_torch', 8.5, 101.5);
  p.put('camp_tent_small', 18, 101, { variant: 2 });
}

/** Village / trading post: cargo, every light, market stalls and sheds around the square. */
function village(t: Terrain, p: Placer) {
  // market stalls along the square
  p.put('camp_canopy', 86, 84, { variant: 0 });
  p.put('camp_canopy', 106, 84, { variant: 1 });
  p.put('table_goods', 90, 85);
  p.put('table_goods', 102, 85);
  p.put('crate_produce', 88.5, 86.5, { variant: 0 });
  p.put('crate_produce', 92.5, 86.5, { variant: 1 });
  p.put('crate_produce', 104.5, 86.5, { variant: 2 });
  p.put('cart', 110.5, 86);
  p.put('hay_bale', 113.5, 85.5);
  p.put('hay_bale', 114.5, 86.5);
  // warehouse yard
  p.put('camp_storehouse', 120.5, 82.5, { variant: 0 });
  p.put('pallet_crates', 116, 80);
  p.put('crate_stack', 124, 87);
  p.put('crate_big', 118, 87.5);
  p.put('crate_reinforced', 121.5, 87.5);
  p.put('crate', 122.5, 79.5, { variant: 0 });
  p.put('crate', 123.5, 79.5, { variant: 1 });
  p.put('crate', 124.5, 80.5, { variant: 2 });
  p.put('barrel', 116.5, 84.5, { variant: 0 });
  p.put('barrel', 117.5, 84.5, { variant: 1 });
  p.put('sack', 125.5, 83.5);
  p.put('sack_pile', 126, 85.5, { variant: 1 });
  p.put('plank_stack', 79, 79.5);
  p.put('planks_loose', 82, 80.5);
  p.put('crate_broken', 77.5, 81.5);
  p.put('crate_stone', 80.5, 82.5, { variant: 0 });
  // houses: hut, shed, forge
  p.put('camp_hut', 78.5, 97.5, { variant: 1 });
  p.put('camp_shed', 108, 100);
  p.put('camp_forge', 113, 97);
  p.put('camp_hut', 120.5, 99.5, { variant: 0 });
  p.put('combo_fence_bush', 116, 103.5);
  p.put('combo_fence_bush', 102, 103.5);
  // lights: posts along the square, lanterns at the stalls, a fire in the middle
  for (const x of [84.5, 92.5, 100.5, 108.5]) {
    p.put('lamp_post', x, 93.5, { rot: 2 });
    p.put('lamp_post', x + 2, 86.5);
  }
  p.put('campfire', 96, 96);
  p.put('hanging_lantern', 88.5, 83.5);
  p.put('hanging_lantern', 104.5, 83.5, { rot: 2 });
  p.put('floor_lantern', 90.5, 87.5);
  p.put('floor_lantern', 101.5, 87.5);
  p.put('chandelier', 86, 84, { noCollide: true, y: 1.3 });
  p.put('parapet_lantern', 97.5, 82.5);
  p.put('parapet_lantern', 99.5, 82.5);
  p.put('wall_torch', 78.5, 95.5, { rot: 0 });
  p.put('standing_torch', 111.5, 95.5);
  p.put('fire_pit', 72, 92);
  p.put('magic_crystal', 94.5, 99.5, { variant: 0 });
  // gardens and greenery around the houses
  p.put('tree_oak', 74.5, 85.5, { variant: 2 });
  p.put('tree_birch', 126.5, 95.5);
  p.put('tree_oak_yellow', 72.5, 102.5, { variant: 1 });
  p.put('biome_valley', 104, 108);
  p.scatter(['flowers_red', 'flowers_yellow', 'flowers_pink', 'grass_field', 'bush_flower', 'grass_low'], [66, 74, 132, 106], 120, { spacing: 1.4 });
  p.scatter(['tree_oak', 'tree_birch', 'bush_tall', 'bush_berry', 'bush_mid'], [66, 74, 132, 106], 22, { solid: true, spacing: 4 });
  placeAlong(t, 'camp_palisade', [[100, 105], [118, 105]], { variant: 0, ifFree: true, spacing: 1 });
}

/** The calm river's wooden bridges and the bridge-builder's yard at the broken one. */
function riverBridges(t: Terrain, p: Placer) {
  const span = (x: number, half: number): [[number, number], [number, number]] => [[x, Math.round(R1.z(x) - half)], [x, Math.round(R1.z(x) + half)]];
  const wood: [string, number, number][] = [
    ['bridge_wood_broken', 70, 5],
    ['bridge_wood_chained', 80, 5],
    ['bridge_wood_straight', 89, 4],
    ['bridge_wood_wide', 97, 5],
    ['bridge_wood_arched', 108, 5],
    ['bridge_wood_roofed', 118, 5],
    ['bridge_wood', 128, 5],
    ['bridge_wood_long', 146, 6],
  ];
  for (const [id, x, h] of wood) {
    const [a, b] = span(x, h);
    placeBridge(t, id, a, b);
  }
  // paths up to each bridge
  for (const [, x, h] of wood) {
    paintRoad(t, 'road_dirt', [[x + 1, R1.z(x) + h], [x + 1, R1.z(x) + h + 6]], 2, { decor: 0.2 });
    paintRoad(t, 'path_forest', [[x + 1, R1.z(x) - h], [x + 1, R1.z(x) - h - 5]], 2, { decor: 0.2 });
  }
  // the builder's yard by the broken bridge: bridge kit pieces lying ready
  const yard: string[] = ['bridge_el_post', 'bridge_el_post_lantern', 'bridge_el_post_banner', 'bridge_el_railing', 'bridge_el_corner', 'bridge_el_plank', 'bridge_el_beam', 'bridge_el_brace', 'bridge_el_pier_water', 'bridge_el_pier_ground', 'bridge_el_chain', 'bridge_el_lantern', 'bridge_el_banner'];
  yard.forEach((id, k) => {
    const x = 64.5 + (k % 5) * 2.5;
    const z = 74.5 + Math.floor(k / 5) * 2.5;
    p.put(id, x, z, { ifFree: true }) ?? p.deco(id, x, z, { yaw: 0 });
  });
  p.put('plank_stack', 76, 76.5);
  // river dressing
  decorateWater(t, { box: [60, 56, 170, 76], lilies: 0.03, reeds: 0.05, rocks: 0.02 });
  p.water('water_rapids', 62.5, 63.5);
}

/** The fast river: stone bridges, a mason's yard, the falls' props and rapids. */
function fastRiver(t: Terrain, p: Placer) {
  const span = (x: number, half: number): [[number, number], [number, number]] => [[x, Math.round(R2.z(x) - half)], [x, Math.round(R2.z(x) + half)]];
  const stone: [string, number, number][] = [
    ['bridge_stone_broken', 44, 5],
    ['bridge_stone_straight', 57, 4],
    ['bridge_stone', 72, 4],
    ['bridge_stone_wide', 85, 4],
    ['bridge_stone_arched', 98, 5],
    ['bridge_stone_wood', 112, 5],
    ['bridge_stone_long', 132, 6],
  ];
  for (const [id, x, h] of stone) {
    const [a, b] = span(x, h);
    placeBridge(t, id, a, b);
  }
  // mason's yard: every stone block of the bridge kit
  const yard = ['bridge_sb_block', 'bridge_sb_chip', 'bridge_sb_corner', 'bridge_sb_slab', 'bridge_sb_parapet', 'bridge_sb_support', 'bridge_sb_arch', 'bridge_sb_moss', 'bridge_sb_crack', 'bridge_sb_step', 'bridge_sb_column', 'bridge_sb_deco', 'bridge_sb_lantern_pillar'];
  yard.forEach((id, k) => {
    const x = 64.5 + (k % 5) * 1.5;
    const z = 104.5 - Math.floor(k / 5) * 1.5;
    p.put(id, x, z, { ifFree: true }) ?? p.deco(id, x, z, { yaw: 0 });
  });
  for (let k = 0; k < 3; k++) p.water('water_rapids', 60 + k * 18.5, R2.z(60 + k * 18) + 0.5, { variant: k % 2 });
  decorateWater(t, { box: [38, 100, 160, 120], rocks: 0.05, boulders: 0.01, reeds: 0.01, lilies: 0 });
  // free-standing waterfall props: set dressing on the highland cliffs
  p.put('waterfall_small', 6, 92.5);
  p.put('waterfall_medium', 24.5, 126.5, { rot: 2 });
  p.water('waterfall_mist', HI.x1 + 1.5, R2.z(HI.x1) + 0.5);
}

/** Forest lake: sandy beach, grass shores, the large waterfall prop off the ridge, the spill. */
function lake(t: Terrain, p: Placer) {
  p.put('waterfall_large', 137, 15);
  p.put('waterfall_spill', 152, 15.5);
  decorateWater(t, { box: [120, 14, 160, 42], lilies: 0.06, reeds: 0.08, rocks: 0.01, algae: 0.04 });
  p.water('water_island', 145, 28);
  p.water('water_lilies', 133.5, 33.5);
  p.water('water_algae', 136.5, 23.5);
  p.water('boulder_water', 150, 33);
  p.water('rock_in_water', 139.5, 39.5);
  p.put('shore_stones', 127.5, 26.5);
  p.put('shore_stones', 156.5, 30.5, { variant: 1 });
  p.put('water_pier', 142, 41.5, { rot: 2, params: { length: 5 } });
  p.put('floor_lantern', 140.5, 44.5);
  p.put('mooring_post', 144.5, 36.5);
  p.scatter(['tree_oak', 'tree_birch', 'tree_birch', 'tree_pine', 'bush_berry'], [120, 12, 168, 52], 30, { solid: true, spacing: 4 });
  p.scatter(['flowers_blue', 'flowers_white', 'grass_mid', 'reeds', 'cattail'], [120, 12, 168, 52], 50, { spacing: 1.5 });
}

/** Sea coast: rocky cliffs, beach, bay, piers, lagoon. */
function coast(t: Terrain, p: Placer) {
  // rocky north coast
  for (const [x, z, v] of [[160, 72, 0], [163, 86, 1], [159, 98, 0], [166, 62, 1]]) p.water('coast_rocks', x, z, { variant: v });
  p.scatter(['rock_sharp', 'rock_mid', 'rock_high'], [146, 56, 164, 102], 14, { solid: true, spacing: 4 });
  p.put('round_tower', 152, 84);
  p.put('wall_torch', 152.5, 85.5);
  // beach and bay
  placeBridge(t, 'bridge_wood_pier', [151, 136], [161, 136]);
  p.put('water_pier', 152.5 + 3, 147, { rot: 1, params: { length: 7 }, variant: 1 });
  p.water('mooring_post', 162.5, 138.5);
  p.water('mooring_post', 158.5, 149.5, { variant: 1 });
  for (const [x, z] of [[146, 122], [150, 158], [148, 132]]) p.deco('water_driftwood', x, z);
  p.deco('water_driftwood', 145, 146, { variant: 1 });
  p.put('biome_desert', 146, 116, { variant: 0 });
  p.put('biome_desert', 140, 154, { variant: 1 });
  p.put('biome_desert', 150, 170, { variant: 2 });
  p.put('road_sample_road_sand', 146, 130, { variant: 3 });
  // lagoon: tropical greenery
  p.scatter(['palm_bush', 'leaf_tropical', 'palm_bush', 'grass_dry', 'bush_dry'], [130, 156, 152, 174], 30, { spacing: 1.6 });
  p.scatter(['palm_bush'], [130, 156, 152, 174], 6, { solid: true, spacing: 3 });
  decorateWater(t, { box: [132, 158, 150, 174], lilies: 0.05, reeds: 0.04, algae: 0.06, rocks: 0.02 });
  p.put('fire_bowl', 148.5, 142.5);
  p.put('cart', 140.5, 128);
  p.put('sack_pile', 143, 130.5);
}

/** Swamp: boardwalk, cattails, reeds, lilies, dead trees, flooded logs, islands. */
function swamp(t: Terrain, p: Placer) {
  boardwalk(t, p);
  decorateWater(t, { box: [4, 128, 60, 172], lilies: 0.06, reeds: 0.06, logs: 0.03, algae: 0.05, rocks: 0 });
  const wet = (x: number, z: number) => t.inBounds(x, z) && t.cell[t.idx(x, z)] === CELL.liquid;
  let made = 0;
  for (let k = 0; k < 4000 && made < 140; k++) {
    const x = p.rng.int(4, 58);
    const z = p.rng.int(128, 172);
    if (!wet(x, z)) continue;
    const id = ['cattail', 'reeds', 'lily_pads', 'lily_flower', 'algae', 'lily_pads'][p.rng.int(0, 5)];
    if (p.water(id, x + 0.5, z + 0.5)) made++;
  }
  p.water('water_island', 20, 140);
  p.water('flooded_logs', 30, 156);
  p.put('combo_water_plants', 44, 152);
  p.scatter(['dead_tree', 'dead_tree', 'tree_pine', 'stump', 'mushrooms_big'], [4, 126, 60, 172], 24, { solid: true, spacing: 3.5 });
  p.scatter(['cattail', 'reeds', 'grass_tall', 'mushrooms_small', 'road_reeds', 'fern'], [4, 126, 60, 172], 70, { spacing: 1.3 });
  p.put('floor_lantern', 39.5, 138.5);
  p.put('hanging_lantern', 17.5, 151.5);
  p.put('fireflies', 26.5, 152.5);
  p.put('fireflies', 14.5, 140.5);
}

/** The four camp kinds in three sizes, with forest around them. */
function camps(t: Terrain, p: Placer) {
  const kinds: CampKind[] = ['bandit', 'orc', 'forest', 'abandoned'];
  const sizes: [CampSize, number][] = [['small', 135], ['medium', 147], ['large', 162]];
  kinds.forEach((k, i) => sizes.forEach(([s, z], j) => placeCamp(t, k, s, 58 + i * 22 + (j === 1 ? 1 : 0), z, 100 + i * 10 + j)));
  // camp extras not every layout uses
  p.put('camp_stakes', 57, 129.5, { variant: 0 });
  p.put('camp_stakes', 80, 129.5, { variant: 1 });
  p.put('camp_cage', 84.5, 131.5, { variant: 0 });
  p.put('camp_cage', 86.5, 131.5, { variant: 1 });
  p.put('camp_skull_trophy', 78.5, 131.5, { variant: 1 });
  p.put('camp_skull_trophy', 76.5, 131.5);
  p.put('camp_weapon_rack', 62, 131.5, { variant: 1 });
  p.put('camp_dummy', 65.5, 131.5);
  p.put('camp_ladder', 103.5, 131.5, { variant: 1 });
  p.put('camp_stones', 106.5, 131.5, { variant: 1 });
  p.put('camp_barrels', 128, 132, { variant: 1 });
  p.put('camp_tent_small', 131, 141, { variant: 1 });
  p.put('camp_tent_large', 132.5, 151.5, { variant: 1 });
  p.put('camp_storehouse', 131.5, 170.5, { variant: 2, ifFree: true });
  p.put('camp_banner', 134.5, 135.5, { variant: 2 });
  p.scatter(['tree_oak', 'tree_pine', 'tree_birch', 'tree_oak_autumn', 'bush_tall', 'rock_mid'], [52, 124, 134, 172], 40, { solid: true, spacing: 3 });
  p.scatter(['grass_dry', 'grass_low', 'flowers_yellow', 'road_stones', 'bush_low'], [52, 124, 134, 172], 60, { spacing: 1.5 });
}

/** Road decals and surface samples at junctions (each road kind's sheet variants). */
function roadSamples(t: Terrain, p: Placer) {
  const at: [string, number, number, number][] = [
    ['road_sample_road_stone', 81, 95, 2],
    ['road_sample_road_dirt', 88, 121, 3],
    ['road_sample_path_forest', 56, 89, 2],
    ['road_sample_boardwalk', 44, 143, 1],
    ['road_sample_path_mountain', STAIR_X + 4, 65, 1],
    ['road_sample_path_swamp', 47, 136, 3],
  ];
  for (const [id, x, z, v] of at) p.deco(id, x, z, { variant: v, yaw: 0 });
  const decals: [string, number, number][] = [
    ['road_grass', 84, 98], ['road_flowers', 82, 99], ['road_stones', 97, 102], ['road_leaves', 50, 86], ['road_mushrooms', 40, 82],
    ['road_ruts', 86, 116], ['road_puddle', 70, 140], ['road_sand_patch', 128, 101], ['road_footprints', 120, 98], ['road_moss', 94, 46],
    ['road_reeds', 40, 135], ['road_scree', STAIR_X + 1, 44], ['road_kerb', 92, 87], ['road_sand_drift', 138, 108],
  ];
  for (const [id, x, z] of decals) p.deco(id, x + 0.5, z + 0.5, { yaw: 0 });
}

/**
 * Rolling hills between the districts: broad swells several blocks high over the forest and the
 * open country, fading to nothing at the water and at the flat working areas of the districts
 * (village, camps, swamp, ruins, the mountain massif and highland with their fixed-height props,
 * the coast).
 */
function rollingHills(t: Terrain): Float32Array {
  const out = new Float32Array(N * N);
  // distance to the nearest water cell (BFS, capped)
  const wd = new Float32Array(N * N).fill(99);
  const q: number[] = [];
  for (let i = 0; i < N * N; i++)
    if (t.cell[i] === CELL.liquid) {
      wd[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (wd[i] >= 20) continue;
    const x = i % N;
    const z = (i / N) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = x + dx;
      const cz = z + dz;
      if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
      const j = cz * N + cx;
      if (wd[j] > wd[i] + 1) {
        wd[j] = wd[i] + 1;
        q.push(j);
      }
    }
  }
  const s01 = (v: number) => {
    const k = Math.max(0, Math.min(1, v));
    return k * k * (3 - 2 * k);
  };
  /** 0 inside a box (plus margin), 1 beyond margin + fade. */
  const box = (x: number, z: number, x0: number, z0: number, x1: number, z1: number, fade = 10) => {
    const dx = Math.max(x0 - x, 0, x - x1);
    const dz = Math.max(z0 - z, 0, z - z1);
    return s01(Math.hypot(dx, dz) / fade);
  };
  const disc = (x: number, z: number, cx: number, cz: number, r: number, fade = 12) => s01((Math.hypot(x - cx, z - cz) - r) / fade);
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      const i = z * N + x;
      let m = s01((wd[i] - 2) / 12);
      m = Math.min(m, disc(x, z, 10, 10, 56, 8)); // mountain massif
      m = Math.min(m, box(x, z, SHELF.x0 - 2, SHELF.z0 - 4, SHELF.x1 + 6, SHELF.z1 + 2));
      m = Math.min(m, box(x, z, RUINS.x0 - 2, RUINS.z0, RUINS.x1 + 2, RUINS.z1 + 2, 8));
      m = Math.min(m, box(x, z, 0, HI.z0 - 3, HI.x2 + 4, HI.z1 + 3));
      m = Math.min(m, disc(x, z, SHOWCASE_SPAWN.x, SHOWCASE_SPAWN.z, 20)); // village
      m = Math.min(m, box(x, z, 56, 122, 134, 176)); // camps
      m = Math.min(m, disc(x, z, 25, 150, 18)); // swamp
      m = Math.min(m, box(x, z, 145, 0, N, N, 8)); // coast
      if (m <= 0) continue;
      const broad = noise(x / 30, z / 30, SEED + 71);
      const ridge = 1 - Math.abs(noise(x / 21, z / 21, SEED + 73) * 2 - 1);
      out[i] = (Math.max(0, broad - 0.25) * 7 + ridge * ridge * 2.5) * m;
    }
  return out;
}

/** Builds «Витрина мира». Deterministic: the same on every launch. */
export function buildShowcase(map: MapDef): Terrain {
  const t = new Terrain(N);
  for (const name of Object.keys(map.palette.tiles)) t.tileId(name);
  heightmap(t);
  paintGround(t);
  water(t);
  t.buildSurface({ relief: rollingHills(t), iters: 6 });
  roads(t);
  const p = new Placer(t);
  riverBridges(t, p);
  fastRiver(t, p);
  mountains(t, p);
  ruins(t, p);
  village(t, p);
  camps(t, p);
  swamp(t, p);
  lake(t, p);
  coast(t, p);
  forest(t, p);
  roadSamples(t, p);
  // a fence along the village gardens and a palisade sample by the yard
  placeAlong(t, 'camp_palisade', [[64, 79], [64, 84]], { variant: 1, ifFree: true });
  t.reach = t.computeReach(SHOWCASE_SPAWN.x, SHOWCASE_SPAWN.z);
  return t;
}

/** Prop ids of the registry that the showcase does not place (should be empty). */
export function unusedPropIds(t: Terrain): string[] {
  const used = new Set(t.props.map((p) => p.id));
  return Object.keys(PROPS).filter((id) => !used.has(id));
}
