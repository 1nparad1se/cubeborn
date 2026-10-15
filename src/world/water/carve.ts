import { hash2 } from '../../core/Rng';
import { CELL, type Terrain } from '../../game/Terrain';
import { placeProp, type PlaceOpts } from '../props/place';
import type { PropInstance } from '../props/types';
import { SHORE_TILE, waterTile, type ShoreType, type WaterType } from '../textures/water';

/**
 * Water carving API for map authors (sheet «Водоёмы»): rivers, streams, lakes, swamps and sea
 * coasts with a shore type, a depth profile, a land transition and waterfalls, painted straight
 * into a Terrain as tile kinds (see textures/water.ts):
 *
 *   carveRiver(t, [[10, 40], [60, 52], [120, 44]], 5, { type: 'river', shore: 'grass' })
 *   carveStream(t, pts)                                   // 2-wide fast clear stream, pebble banks
 *   carveLake(t, 80, 80, 9, 6, { type: 'lake', shore: 'sand', transition: 'smooth' })
 *   carveSwamp(t, 40, 120, 10)                            // murky shallow pools with mud islands
 *   carveCoast(t, [[0, 30], [128, 40]], { shore: 'sand' })  // sea on the right of a→b
 *   carveWaterfall(t, [60, 20], [60, 30], { drop: 3, width: 3 })
 *   decorateWater(t, { lilies: 0.04, reeds: 0.06, rocks: 0.02 })
 *
 * Water cells become CELL.liquid with tile `water_<type>_<depth>`; shore cells become floor with a
 * shore tile. Carve BEFORE placing props / computing t.reach. Walls are never touched.
 */

export type Transition = 'smooth' | 'medium' | 'steep' | 'islands';

export interface WaterOpts {
  type?: WaterType;
  shore?: ShoreType;
  /** Shore band width in cells (default 1.5; 0 = none). */
  shoreWidth?: number;
  transition?: Transition;
  /** Deepest level in the middle, 1..5 (default by type). */
  depth?: number;
  /** Elevation of the water cells (default: keep each cell's elevation). */
  elev?: number;
  /** Edge raggedness in cells (default 0.8). */
  ragged?: number;
  seed?: number;
}

const DEF_DEPTH: Record<WaterType, number> = { river: 4, stream: 2, fast: 3, mountain: 3, lake: 5, lagoon: 3, sea: 5, swamp: 2 };
/** Cells of distance from the bank per depth level. */
const RAMP: Record<Transition, number> = { smooth: 2.2, medium: 1.3, steep: 0.6, islands: 1.3 };

/** Smooth tileable-free value noise in [0, 1). */
function vnoise(x: number, z: number, s: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const w = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s);
  const b = hash2(ix + 1, iz, s);
  const c = hash2(ix, iz + 1, s);
  const d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; side: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return { d: Math.hypot(px - ax - dx * u, pz - az - dz * u), side: Math.sign(dx * (pz - az) - dz * (px - ax)) };
}

function polyDist(px: number, pz: number, pts: [number, number][]): { d: number; side: number } {
  let best = { d: Infinity, side: 0 };
  for (let k = 0; k + 1 < pts.length; k++) {
    const r = segDist(px, pz, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    if (r.d < best.d) best = r;
  }
  if (pts.length === 1) best = { d: Math.hypot(px - pts[0][0], pz - pts[0][1]), side: 1 };
  return best;
}

/**
 * Generic carver: `sd(x, z)` = signed distance in cells to the bank (negative inside the water).
 * Paints water with a depth profile, then the shore band, applying the transition.
 */
export function carveWater(t: Terrain, box: [number, number, number, number], sd: (x: number, z: number) => number, o: WaterOpts = {}): number {
  const type = o.type ?? 'river';
  const shore = o.shore ?? 'grass';
  const sw = o.shoreWidth ?? 1.5;
  const tr = o.transition ?? 'medium';
  const maxD = o.depth ?? DEF_DEPTH[type];
  const rag = o.ragged ?? 0.8;
  const seed = o.seed ?? 911;
  let n = 0;
  const [x0, z0, x1, z1] = box;
  for (let cz = Math.floor(z0 - sw - 2); cz <= Math.ceil(z1 + sw + 2); cz++)
    for (let cx = Math.floor(x0 - sw - 2); cx <= Math.ceil(x1 + sw + 2); cx++) {
      if (!t.inBounds(cx, cz)) continue;
      const i = t.idx(cx, cz);
      if (t.cell[i] === CELL.wall) continue;
      const d = sd(cx + 0.5, cz + 0.5) + (vnoise(cx * 0.35, cz * 0.35, seed) - 0.5) * 2 * rag;
      if (d < 0) {
        let lvl = Math.min(maxD, 1 + Math.floor(-d / RAMP[tr]));
        // islands: little shore / reed patches poking out of the shallows and mid water
        if (tr === 'islands' && lvl <= 3 && vnoise(cx * 0.6, cz * 0.6, seed + 5) > 0.72) {
          t.setTile(cx, cz, SHORE_TILE[shore], CELL.floor);
          continue;
        }
        if (tr === 'steep') lvl = Math.max(lvl, Math.min(maxD, 3));
        t.setTile(cx, cz, waterTile(type, lvl), CELL.liquid);
        if (o.elev !== undefined) t.elev[i] = o.elev;
        t.height[i] = 0;
        n++;
      } else if (d < sw && t.cell[i] !== CELL.liquid) {
        // wet sand right at the waterline on beaches
        const name = shore === 'sand' && d < 0.6 ? 'shore_sand_wet' : SHORE_TILE[shore];
        t.setTile(cx, cz, name);
        if (tr === 'steep' && shore === 'rock') {
          // rocky cliffs: the bank rises one or two blocks right at the water
          const up = d < sw * 0.5 ? 2 : 1;
          t.elev[i] = Math.max(t.elev[i], (o.elev ?? t.elev[i]) + up);
        }
      }
    }
  return n;
}

/** River (calm / fast / mountain / wide = type + width) along a polyline. */
export function carveRiver(t: Terrain, pts: [number, number][], width = 5, o: WaterOpts = {}): number {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const r = width / 2;
  const seed = o.seed ?? 913;
  // the width breathes a little along the course
  const sd = (x: number, z: number) => polyDist(x, z, pts).d - r * (0.85 + vnoise(x * 0.08, z * 0.08, seed + 3) * 0.3);
  return carveWater(t, [Math.min(...xs) - r, Math.min(...zs) - r, Math.max(...xs) + r, Math.max(...zs) + r], sd, { type: 'river', ...o });
}

/** Narrow fast stream (ручей). */
export function carveStream(t: Terrain, pts: [number, number][], width = 2, o: WaterOpts = {}): number {
  return carveRiver(t, pts, width, { type: 'stream', shore: 'pebble', shoreWidth: 1, ragged: 0.4, ...o });
}

/** Lake (forest / mountain / lagoon via type + shore) as a noisy ellipse. */
export function carveLake(t: Terrain, cx: number, cz: number, rx: number, rz = rx, o: WaterOpts = {}): number {
  const seed = o.seed ?? 917;
  const sd = (x: number, z: number) => {
    const a = Math.atan2(z - cz, x - cx);
    const wob = 1 + (vnoise(Math.cos(a) * 2 + 9, Math.sin(a) * 2 + 9, seed) - 0.5) * 0.35;
    const k = Math.hypot((x - cx) / rx, (z - cz) / rz);
    return (k - wob) * Math.min(rx, rz);
  };
  return carveWater(t, [cx - rx * 1.2, cz - rz * 1.2, cx + rx * 1.2, cz + rz * 1.2], sd, { type: 'lake', ...o });
}

/** Swamp: shallow murky pools broken by mud islands. */
export function carveSwamp(t: Terrain, cx: number, cz: number, r: number, o: WaterOpts = {}): number {
  const seed = o.seed ?? 919;
  const sd = (x: number, z: number) => Math.hypot(x - cx, z - cz) - r + (vnoise(x * 0.25, z * 0.25, seed + 1) - 0.5) * r * 0.8;
  return carveWater(t, [cx - r * 1.4, cz - r * 1.4, cx + r * 1.4, cz + r * 1.4], sd, { type: 'swamp', shore: 'mud', transition: 'islands', ragged: 1.2, ...o });
}

/**
 * Sea coast: everything on the RIGHT of the shoreline a→b→… (seen from above, +x right, +z down)
 * out to `reach` cells becomes sea; bays come from the polyline shape.
 */
export function carveCoast(t: Terrain, pts: [number, number][], o: WaterOpts & { reach?: number } = {}): number {
  const reach = o.reach ?? t.size;
  const sd = (x: number, z: number) => {
    const { d, side } = polyDist(x, z, pts);
    return side > 0 ? -d : d;
  };
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return carveWater(t, [Math.min(...xs) - reach, Math.min(...zs) - reach, Math.max(...xs) + reach, Math.max(...zs) + reach], sd, { type: 'sea', shore: 'sand', shoreWidth: 3, transition: 'smooth', ...o });
}

export type FallSize = 'small' | 'medium' | 'large';
const FALL: Record<FallSize, { drop: number; width: number }> = { small: { drop: 2, width: 2 }, medium: { drop: 3, width: 3 }, large: { drop: 5, width: 4 } };

/**
 * Waterfall: water flowing from `top` toward `bottom` (cells) drops `drop` blocks at the midpoint.
 * The upper part is raised to elev + drop with rock banks, so the ground shader draws the falling
 * lanes on the step face and churning foam at its foot (both already exist in WorldRenderer);
 * the waterfall_mist prop adds spray. Returns the props placed.
 */
export function carveWaterfall(t: Terrain, top: [number, number], bottom: [number, number], o: { size?: FallSize; drop?: number; width?: number; type?: WaterType; base?: number } = {}): PropInstance[] {
  const s = FALL[o.size ?? 'medium'];
  const drop = o.drop ?? s.drop;
  const w = o.width ?? s.width;
  const type = o.type ?? 'mountain';
  const dx = bottom[0] - top[0];
  const dz = bottom[1] - top[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const mx = (top[0] + bottom[0]) / 2;
  const mz = (top[1] + bottom[1]) / 2;
  const base = o.base ?? t.elevAt(bottom[0], bottom[1]);
  const r = len / 2 + w + 3;
  for (let cz = Math.floor(mz - r); cz <= Math.ceil(mz + r); cz++)
    for (let cx = Math.floor(mx - r); cx <= Math.ceil(mx + r); cx++) {
      if (!t.inBounds(cx, cz)) continue;
      const i = t.idx(cx, cz);
      if (t.cell[i] === CELL.wall) continue;
      const px = cx + 0.5 - mx;
      const pz = cz + 0.5 - mz;
      const along = px * ux + pz * uz;
      const across = Math.abs(-px * uz + pz * ux);
      if (Math.abs(along) > len / 2 + 0.5) continue;
      const upper = along < 0;
      if (across <= w / 2) {
        const lvl = upper ? 2 : across < w / 2 - 1 ? 4 : 3;
        t.setTile(cx, cz, waterTile(type, lvl), CELL.liquid);
        t.elev[i] = upper ? base + drop : base;
        t.height[i] = 0;
      } else if (across <= w / 2 + 2.5) {
        // rock cheeks framing the fall; the upper bank sits on the raised shelf
        t.setTile(cx, cz, SHORE_TILE.rock, CELL.floor);
        t.elev[i] = Math.max(t.elev[i], upper ? base + drop + (across > w / 2 + 1.5 ? 1 : 0) : base + (across < w / 2 + 1 ? 0 : 1));
      }
    }
  const out: PropInstance[] = [];
  const foot = placeInWater(t, 'waterfall_mist', mx + ux * 1.2, mz + uz * 1.2, { params: { width: w, drop } });
  if (foot) out.push(foot);
  return out;
}

/** World y of the water surface of a liquid cell (matches WorldRenderer.liquidLevel for water). */
export const WATER_SURFACE = -0.62;

/**
 * Places a water prop (rocks, lilies, reeds, flooded logs, mist) sitting on the water surface of
 * the cell under it, without its preview pool plate and without marking cells solid (liquid cells
 * already block walkers, and solid would turn the water cell into land for the renderer).
 */
export function placeInWater(t: Terrain, id: string, x: number, z: number, o: PlaceOpts = {}): PropInstance | null {
  const y = t.elevAt(x, z) + WATER_SURFACE;
  return placeProp(t, id, x, z, { noCollide: true, ...o, y: o.y ?? y, params: { pool: 0, ...o.params } });
}

/**
 * Scatters water props over the liquid cells of a box (default the whole map): lilies and reeds on
 * calm shallow water, rocks and boulders in rivers, algae, flooded logs in swamps. Densities are
 * per cell. Reeds and lilies prefer cells next to a shore.
 */
export function decorateWater(t: Terrain, o: { box?: [number, number, number, number]; lilies?: number; reeds?: number; rocks?: number; boulders?: number; logs?: number; algae?: number; seed?: number } = {}): PropInstance[] {
  const [x0, z0, x1, z1] = o.box ?? [0, 0, t.size - 1, t.size - 1];
  const seed = o.seed ?? 4711;
  const out: PropInstance[] = [];
  const nearLand = (cx: number, cz: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => t.inBounds(cx + a, cz + b) && t.cell[t.idx(cx + a, cz + b)] !== CELL.liquid);
  for (let cz = z0; cz <= z1; cz++)
    for (let cx = x0; cx <= x1; cx++) {
      if (!t.inBounds(cx, cz)) continue;
      const i = t.idx(cx, cz);
      if (t.cell[i] !== CELL.liquid) continue;
      const name = t.tileNames[t.tile[i]] ?? '';
      const m = /^water_(\w+)_(\d)$/.exec(name);
      if (!m) continue;
      const type = m[1];
      const lvl = Number(m[2]);
      const calm = type === 'lake' || type === 'swamp' || type === 'lagoon' || type === 'river';
      const shoreCell = nearLand(cx, cz);
      const r = hash2(cx, cz, seed);
      const r2 = hash2(cx, cz, seed + 1);
      const x = cx + 0.2 + r2 * 0.6;
      const z = cz + 0.2 + hash2(cx, cz, seed + 2) * 0.6;
      const v = Math.floor(hash2(cx, cz, seed + 3) * 3);
      let id: string | null = null;
      let acc = 0;
      const want = (d: number | undefined, ok: boolean, pid: string) => {
        if (id || !ok || !d) return;
        acc += d;
        if (r < acc) id = pid;
      };
      want((o.reeds ?? 0.05) * (shoreCell ? 3 : 0.3), calm && lvl <= 2, 'water_reeds');
      want((o.lilies ?? 0.04) * (shoreCell ? 1.5 : 1), calm && lvl <= 3 && type !== 'river', 'water_lilies');
      want(o.rocks ?? 0.02, type !== 'swamp', 'rock_in_water');
      want(o.boulders ?? 0.006, lvl <= 3 && type !== 'swamp', 'boulder_water');
      want(o.logs ?? (type === 'swamp' ? 0.02 : 0.003), lvl <= 3, 'flooded_logs');
      want(o.algae ?? 0.03, lvl <= 3, 'water_algae');
      if (!id) continue;
      const p = placeInWater(t, id, x, z, { variant: v, yaw: (r2 - 0.5) * 1.2 });
      if (p) out.push(p);
    }
  return out;
}
