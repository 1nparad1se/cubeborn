import { CONT, AREAS, BAYS, CAPES, CHASMS, LAKES, MARSHES, PASSES, RANGES, RIVERS, ROADS, SETTLEMENTS, type Climate, type RoadKind } from '../../../config/continent';
import { CONTINENT_MAP } from '../../../data/continentMap';
import { hash2 } from '../../../core/Rng';
import { CELL, Terrain, type BuildInst } from '../../Terrain';
import { collectBuild, placeInst, prefabSize, PREFABS } from '../build/prefabs';
import '../build/all';
import type { BuildSpot } from '../build/VB';
import { astar, chaikin, Field, fractal, polyBox, polyDist, resample } from './fields';

/**
 * Rasterises the hand-made continent plan (config/continent.ts) into the game terrain: coast,
 * climates, mountain ranges and passes, rivers and lakes, roads with bridges, then hands the
 * terrain to the place builders (settlements, camps, dungeons) and plants vegetation.
 * Deterministic: the same world on every launch.
 */

export const CLIM: Record<Climate, number> = { snow: 0, taiga: 1, green: 2, steppe: 3, desert: 4 };
export const W_SEA = 1;
export const W_RIVER = 2;
export const W_LAKE = 3;
export const W_POOL = 4;
export const W_CHASM = 5;
export const W_ICE = 6;
export const W_DRY = 7;

/** Coarse grid resolution of the area / level maps. */
export const GRID = 8;

export interface RoadRt {
  kind: RoadKind;
  pts: [number, number][];
  from: string;
  to: string;
}

/** Shared state of one generation pass. */
export class Gen {
  readonly n = CONT.size;
  readonly t: Terrain;
  readonly land: Uint8Array;
  readonly clim: Uint8Array;
  readonly water: Uint8Array;
  /** 1 = keep clear (no trees, hills), 2 = settled ground. */
  readonly prot: Uint8Array;
  /** Structure footprints. */
  readonly occ: Uint8Array;
  /** Road cells (1 trail, 2 road, 3 main). */
  readonly road: Uint8Array;
  /** Mountain range cells (raised by a range, not by small hills). */
  readonly mount: Uint8Array;
  readonly roads: RoadRt[] = [];
  readonly spots: BuildSpot[] = [];
  readonly seed = CONT.seed;
  readonly noise: { coast: Field; clim: Field; forest: Field; hills: Field; detail: Field; width: Field };
  log: string[] = [];

  constructor() {
    const n = this.n;
    this.t = new Terrain(n);
    for (const name of Object.keys(CONTINENT_MAP.palette.tiles)) this.t.tileId(name);
    for (const extra of ['void', 'fordwater', 'farm']) this.t.tileId(extra);
    const N = n * n;
    this.land = new Uint8Array(N);
    this.clim = new Uint8Array(N);
    this.water = new Uint8Array(N);
    this.prot = new Uint8Array(N);
    this.occ = new Uint8Array(N);
    this.road = new Uint8Array(N);
    this.mount = new Uint8Array(N);
    const s = this.seed;
    this.noise = {
      coast: new Field(n, 8, (x, z) => fractal(x / CONT.land.noiseScale, z / CONT.land.noiseScale, s + 1, 4)),
      clim: new Field(n, 16, (x, z) => fractal(x / 260, z / 260, s + 2, 3)),
      forest: new Field(n, 4, (x, z) => fractal(x / 70, z / 70, s + 3, 3)),
      hills: new Field(n, 4, (x, z) => fractal(x / 48, z / 48, s + 4, 3)),
      detail: new Field(n, 2, (x, z) => fractal(x / 9, z / 9, s + 5, 2)),
      width: new Field(n, 8, (x, z) => fractal(x / 60, z / 60, s + 6, 2)),
    };
  }

  idx(x: number, z: number) {
    return z * this.n + x;
  }
  inb(x: number, z: number) {
    return x >= 0 && z >= 0 && x < this.n && z < this.n;
  }
  h(x: number, z: number, k: number) {
    return hash2(x, z, this.seed + k);
  }
  climAt(x: number, z: number): number {
    const xi = Math.max(0, Math.min(this.n - 1, Math.round(x)));
    const zi = Math.max(0, Math.min(this.n - 1, Math.round(z)));
    return this.clim[this.idx(xi, zi)];
  }
  setTile(i: number, name: string) {
    this.t.tile[i] = this.t.tileId(name);
  }
  /** Flat walkable ground at a cell (clears hills, keeps the tile unless given). */
  flatten(i: number, tile?: string) {
    const t = this.t;
    t.elev[i] = 0;
    t.height[i] = 0;
    if (t.cell[i] !== CELL.liquid && t.cell[i] !== CELL.wall) t.cell[i] = CELL.floor;
    if (tile) this.setTile(i, tile);
  }
  /** Base ground tile for a climate at a cell. */
  ground(x: number, z: number): string {
    const c = this.clim[this.idx(x, z)];
    const d = this.noise.detail.at(x, z);
    const f = this.noise.forest.at(x, z);
    switch (c) {
      case 0:
        return d > 0.62 ? 'snow2' : 'snow';
      case 1:
        return d > 0.66 ? 'snow2' : f > 0.56 ? 'forest' : d < 0.34 ? 'tundra' : 'grass';
      case 3:
        return d > 0.64 ? 'drydirt' : d < 0.3 ? 'grass' : 'dry';
      case 4:
        return d > 0.66 ? 'dune' : 'sand';
      default:
        return f > 0.6 ? 'forest' : d > 0.68 ? 'meadow' : d < 0.32 ? 'grass2' : 'grass';
    }
  }
}

export function generateContinent(): Gen {
  const g = new Gen();
  const T0 = performance.now();
  const step = (name: string) => g.log.push(`${name} ${Math.round(performance.now() - T0)}ms`);
  coast(g);
  step('coast');
  climate(g);
  step('climate');
  mountains(g);
  step('mountains');
  waters(g);
  step('water');
  reserve(g);
  step('reserve');
  roads(g);
  step('roads');
  hills(g);
  step('hills');
  return g;
}

// ------------------------------------------------------------------ coast
function coast(g: Gen) {
  const { n, t } = g;
  const L = CONT.land;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      let e = Math.hypot((x - L.cx) / L.rx, (z - L.cz) / L.rz);
      e += (g.noise.coast.at(x, z) - 0.5) * 2 * L.noise;
      for (const b of BAYS) {
        const d = Math.hypot(x - b.x, z - b.z) / b.r;
        if (d < 1.6) e += Math.max(0, 1 - d) * 0.9 + Math.max(0, 1.6 - d) * 0.04;
      }
      for (const c of CAPES) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1) e -= Math.min(1, (1 - d) * 1.6) * 0.45;
      }
      const edge = Math.min(x, z, n - 1 - x, n - 1 - z);
      if (edge < 40) e = Math.max(e, 1.05);
      if (e < 1) {
        g.land[i] = 1;
        t.cell[i] = CELL.floor;
      } else {
        g.water[i] = W_SEA;
        t.cell[i] = CELL.liquid;
        g.setTile(i, 'sea');
      }
    }
  // remove tiny islands and lakes of sea inside the land
  floodKeepLargest(g);
}

function floodKeepLargest(g: Gen) {
  const { n, t } = g;
  const N = n * n;
  const comp = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let best = -1;
  let bestSize = 0;
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (!g.land[s] || comp[s] >= 0) continue;
    let h = 0;
    let tl = 0;
    q[tl++] = s;
    comp[s] = id;
    while (h < tl) {
      const i = q[h++];
      const x = i % n;
      const z = (i / n) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, z > 0 ? i - n : -1, z < n - 1 ? i + n : -1]) {
        if (j < 0 || !g.land[j] || comp[j] >= 0) continue;
        comp[j] = id;
        q[tl++] = j;
      }
    }
    if (tl > bestSize) {
      bestSize = tl;
      best = id;
    }
    id++;
  }
  for (let i = 0; i < N; i++)
    if (g.land[i] && comp[i] !== best) {
      g.land[i] = 0;
      g.water[i] = W_SEA;
      t.cell[i] = CELL.liquid;
      g.setTile(i, 'sea');
    }
}

// ------------------------------------------------------------------ climate and base ground
function climate(g: Gen) {
  const { n } = g;
  const C = CONT.climate;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const tz = z + (g.noise.clim.at(x, z) - 0.5) * 2 * C.wobble;
      g.clim[i] = tz < C.snow ? 0 : tz < C.taiga ? 1 : tz < C.steppe ? 2 : tz < C.desert ? 3 : 4;
    }
  // marshes are green whatever the band
  for (const m of MARSHES)
    for (let z = m.z - m.r; z <= m.z + m.r; z++)
      for (let x = m.x - m.r; x <= m.x + m.r; x++) if (g.inb(x, z) && Math.hypot(x - m.x, z - m.z) < m.r) g.clim[z * n + x] = 2;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (!g.land[i]) continue;
      g.setTile(i, g.ground(x, z));
    }
  // beaches and rocky shores
  const shore = distField(g, (i) => g.water[i] === W_SEA, 6);
  for (let i = 0; i < n * n; i++) {
    if (!g.land[i] || shore[i] > 4) continue;
    const c = g.clim[i];
    const x = i % n;
    const z = (i / n) | 0;
    if (c === 0) g.setTile(i, shore[i] <= 2 ? 'gravel' : g.ground(x, z));
    else if (c === 1) g.setTile(i, shore[i] <= 2 ? 'gravel' : 'tundra');
    else if (shore[i] <= 3 - (g.h(x, z, 9) < 0.5 ? 1 : 0)) g.setTile(i, 'beach');
  }
  // marsh ground with pools
  for (const m of MARSHES)
    for (let z = m.z - m.r; z <= m.z + m.r; z++)
      for (let x = m.x - m.r; x <= m.x + m.r; x++) {
        if (!g.inb(x, z)) continue;
        const i = z * n + x;
        if (!g.land[i]) continue;
        const d = Math.hypot(x - m.x, z - m.z) / m.r;
        const v = g.noise.hills.at(x * 1.7, z * 1.7) - d * 0.35;
        if (d > 1) continue;
        if (v > 0.52) {
          g.water[i] = W_POOL;
          g.t.cell[i] = CELL.liquid;
          g.setTile(i, 'water');
        } else if (v > 0.3) g.setTile(i, 'bog');
      }
}

/** Multi-source BFS distance (4-neighbour steps, capped) from cells where src() is true. */
export function distField(g: Gen, src: (i: number) => boolean, cap: number): Uint8Array {
  const { n } = g;
  const N = n * n;
  const d = new Uint8Array(N).fill(255);
  const q = new Int32Array(N);
  let h = 0;
  let tl = 0;
  for (let i = 0; i < N; i++)
    if (src(i)) {
      d[i] = 0;
      q[tl++] = i;
    }
  while (h < tl) {
    const i = q[h++];
    const nd = d[i] + 1;
    if (nd > cap) continue;
    const x = i % n;
    if (x > 0 && d[i - 1] > nd) (d[i - 1] = nd), (q[tl++] = i - 1);
    if (x < n - 1 && d[i + 1] > nd) (d[i + 1] = nd), (q[tl++] = i + 1);
    if (i >= n && d[i - n] > nd) (d[i - n] = nd), (q[tl++] = i - n);
    if (i < N - n && d[i + n] > nd) (d[i + n] = nd), (q[tl++] = i + n);
  }
  return d;
}

// ------------------------------------------------------------------ mountains
function mountTop(c: number, tier: number, x: number, z: number, g: Gen): string {
  const d = g.h(x, z, 31);
  if (c === 0) return tier >= 3 || d < 0.3 ? 'snow' : 'rock';
  if (c === 1) return tier >= 4 ? 'snow' : tier >= 2 ? 'rock' : d < 0.5 ? 'snow2' : 'rock';
  if (c === 4) return tier >= 2 ? 'canyon' : 'redsand';
  if (c === 3) return tier >= 3 ? 'rock' : 'dry';
  return tier >= 3 ? 'rock' : 'grass';
}

function raise(g: Gen, i: number, tier: number, top: string) {
  const t = g.t;
  if (!g.land[i] || tier <= 0) return;
  if (tier <= t.elev[i]) return;
  t.elev[i] = tier;
  t.cell[i] = CELL.solid;
  t.height[i] = Math.max(t.height[i], tier);
  g.setTile(i, top);
}

function mountains(g: Gen) {
  const { n } = g;
  // extra cliff right behind Ironpeak: the city is cut into the rock
  const ranges = [...RANGES, { id: 'ironcliff', name: { ru: '', en: '' }, w: 13, h: 5, climate: 'snow' as Climate, pts: [[975, 302], [1050, 296], [1130, 304]] as [number, number][] }];
  for (const r of ranges) {
    const [x0, z0, x1, z1] = polyBox(r.pts, r.w * 1.5);
    for (let z = Math.max(0, z0); z <= Math.min(n - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) {
        const i = z * n + x;
        if (!g.land[i]) continue;
        const { d, t } = polyDist(r.pts, x, z);
        // taper the ends, vary the width
        const taper = Math.min(1, t * 6, (1 - t) * 6) * 0.45 + 0.55;
        const w = r.w * taper * (0.7 + 0.6 * g.noise.width.at(x, z));
        if (d >= w) continue;
        const k = 1 - d / w;
        const tier = Math.max(1, Math.min(7, Math.ceil(k * r.h * 1.35 + (g.noise.detail.at(x, z) - 0.5) * 1.2)));
        raise(g, i, tier, mountTop(g.clim[i], tier, x, z, g));
        g.mount[i] = 1;
      }
  }
  // passes: flat corridors through the ranges
  for (const p of PASSES) {
    const pts = resample(p.pts, 2);
    for (const [px, pz] of pts) stamp(g, px, pz, p.w / 2 + 0.5, (i, x, z) => {
      if (!g.land[i]) return;
      g.mount[i] = 0;
      const c = g.clim[i];
      g.flatten(i, c === 0 ? 'gravel' : c === 1 ? 'gravel' : c === 4 ? 'canyon' : c === 3 ? 'drydirt' : 'dirt');
      if (c === 4 && g.h(x, z, 41) < 0.4) g.setTile(i, 'redsand');
    });
  }
  // chasms
  for (const ch of CHASMS) {
    const pts = resample(resample(ch.pts, 1.5, 3, g.seed + 7), 0.7);
    for (const [px, pz] of pts)
      stamp(g, px, pz, ch.w / 2, (i) => {
        if (!g.land[i]) return;
        g.t.elev[i] = 0;
        g.t.cell[i] = CELL.liquid;
        g.water[i] = W_CHASM;
        g.setTile(i, 'void');
      });
  }
}

/** Calls fn for every cell of a disk. */
export function stamp(g: Gen, cx: number, cz: number, r: number, fn: (i: number, x: number, z: number) => void) {
  const n = g.n;
  const rr = r * r;
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || z < 0 || x >= n || z >= n) continue;
      if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 > rr) continue;
      fn(z * n + x, x, z);
    }
}

// ------------------------------------------------------------------ rivers and lakes
function waters(g: Gen) {
  const t = g.t;
  for (const rv of RIVERS) {
    const pts = resample(resample(rv.pts, 1.5, 9, g.seed + rv.id.length * 13), 0.7);
    const N = pts.length;
    pts.forEach(([px, pz], k) => {
      const w = rv.w0 + (rv.w1 - rv.w0) * (k / (N - 1));
      const r = w / 2 + (g.noise.width.at(px * 3, pz * 3) - 0.5) * 1.2;
      stamp(g, px, pz, Math.max(1.2, r), (i) => {
        if (g.water[i] === W_SEA || g.water[i] === W_CHASM) return;
        g.mount[i] = 0;
        t.elev[i] = 0;
        t.height[i] = 0;
        if (rv.frozen) {
          g.water[i] = W_ICE;
          t.cell[i] = CELL.ice;
          g.setTile(i, 'ice');
        } else if (rv.dry) {
          g.water[i] = W_DRY;
          t.cell[i] = CELL.floor;
          g.setTile(i, 'drydirt');
        } else {
          g.water[i] = W_RIVER;
          t.cell[i] = CELL.liquid;
          g.setTile(i, 'water');
        }
      });
      // banks
      if (!rv.dry)
        stamp(g, px, pz, Math.max(1.2, r) + 1.6, (i, x, z) => {
          if (g.water[i] || !g.land[i] || t.elev[i]) return;
          const c = g.clim[i];
          if (c === 4) g.setTile(i, 'oasis');
          else if (c >= 1 && c <= 3 && g.h(x, z, 51) < 0.55) g.setTile(i, c === 3 ? 'grass' : 'dirt');
        });
    });
  }
  for (const l of LAKES) {
    const R = l.r + 3;
    for (let z = l.z - R; z <= l.z + R; z++)
      for (let x = l.x - R; x <= l.x + R; x++) {
        if (!g.inb(x, z)) continue;
        const i = z * g.n + x;
        if (!g.land[i]) continue;
        const d = Math.hypot(x - l.x, z - l.z) + (g.noise.detail.at(x * 0.6, z * 0.6) - 0.5) * 5;
        if (d < l.r) {
          g.mount[i] = 0;
          t.elev[i] = 0;
          t.height[i] = 0;
          if (l.frozen) {
            g.water[i] = W_ICE;
            t.cell[i] = CELL.ice;
            g.setTile(i, 'ice');
          } else {
            g.water[i] = W_LAKE;
            t.cell[i] = CELL.liquid;
            g.setTile(i, l.bog && d > l.r - 4 ? 'bog' : 'water');
            if (l.bog && d > l.r - 4) t.cell[i] = CELL.floor;
          }
        } else if (d < l.r + 2 && !t.elev[i] && !g.water[i]) {
          const c = g.clim[i];
          g.setTile(i, c === 4 ? 'oasis' : c === 0 ? 'gravel' : 'beach');
        }
      }
  }
}

// ------------------------------------------------------------------ reserve settled ground
function reserve(g: Gen) {
  const t = g.t;
  for (const s of SETTLEMENTS) {
    const m = 8;
    for (let z = s.z - s.hd - m; z <= s.z + s.hd + m; z++)
      for (let x = s.x - s.hw - m; x <= s.x + s.hw + m; x++) {
        if (!g.inb(x, z)) continue;
        const i = z * g.n + x;
        if (!g.land[i]) continue;
        const inner = Math.abs(x - s.x) <= s.hw && Math.abs(z - s.z) <= s.hd;
        g.prot[i] = inner ? 2 : Math.max(g.prot[i], 1);
        if (g.water[i] === W_RIVER || g.water[i] === W_LAKE || g.water[i] === W_POOL) continue;
        if (t.elev[i] || inner) {
          g.mount[i] = 0;
          g.flatten(i);
          if (t.elev[i] === 0 && /rock|snow$|canyon/.test(t.tileNames[t.tile[i]]) && !inner) g.setTile(i, g.ground(x, z));
        }
      }
  }
}

// ------------------------------------------------------------------ roads
const RC = 4; // road A* resolution

function roads(g: Gen) {
  const n = g.n;
  const cn = Math.ceil(n / RC);
  const cost = new Float32Array(cn * cn);
  const t = g.t;
  const baseCost = () => {
    for (let cz = 0; cz < cn; cz++)
      for (let cx = 0; cx < cn; cx++) {
        const x = Math.min(n - 1, cx * RC + 2);
        const z = Math.min(n - 1, cz * RC + 2);
        let c = 1;
        let blocked = false;
        let wet = 0;
        // look at the whole coarse cell so roads never clip a cliff or a lake
        for (let dz = 0; dz < RC; dz++)
          for (let dx = 0; dx < RC; dx++) {
            const xx = cx * RC + dx;
            const zz = cz * RC + dz;
            if (xx >= n || zz >= n) {
              blocked = true;
              continue;
            }
            const i = zz * n + xx;
            const w = g.water[i];
            if (!g.land[i] || w === W_SEA || w === W_LAKE || w === W_POOL) blocked = true;
            else if (t.elev[i] > 0) blocked = true;
            else if (w === W_RIVER || w === W_CHASM) wet = Math.max(wet, w === W_CHASM ? 2 : 10);
          }
        if (blocked) c = Infinity;
        else {
          c += wet;
          const i = z * n + x;
          if (g.road[i]) c = 0.35;
          else {
            const f = g.noise.forest.at(x, z);
            if (f > 0.6) c += 0.6;
            if (g.clim[i] === 4) c += 0.25;
            if (/bog/.test(t.tileNames[t.tile[i]])) c += 2;
          }
        }
        cost[cz * cn + cx] = c;
      }
  };
  const centre = (id: string): [number, number] | null => {
    const s = SETTLEMENTS.find((x) => x.id === id);
    if (s) return [s.x, s.z];
    const camp = CAMP_POS[id];
    return camp ?? null;
  };
  const toNode = (x: number, z: number) => {
    // nearest passable coarse node
    const cx0 = Math.floor(x / RC);
    const cz0 = Math.floor(z / RC);
    for (let r = 0; r < 12; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = cx0 + dx;
          const cz = cz0 + dz;
          if (cx < 0 || cz < 0 || cx >= cn || cz >= cn) continue;
          if (Number.isFinite(cost[cz * cn + cx])) return cz * cn + cx;
        }
    return cz0 * cn + cx0;
  };
  // main roads first so the others merge into them
  const order = [...ROADS].sort((a, b) => rank(b.kind) - rank(a.kind));
  for (const rd of order) {
    baseCost();
    const a = centre(rd.from);
    const b = centre(rd.to);
    if (!a || !b) {
      g.log.push(`road ${rd.from}-${rd.to}: missing end`);
      continue;
    }
    const way: [number, number][] = [a, ...(rd.via ?? []), b];
    const nodes: number[] = [];
    let ok = true;
    for (let k = 1; k < way.length; k++) {
      const s = toNode(way[k - 1][0], way[k - 1][1]);
      const e = toNode(way[k][0], way[k][1]);
      const path = astar(cn, cost, s, e);
      if (!path) {
        g.log.push(`road ${rd.from}-${rd.to}: no path at leg ${k}`);
        ok = false;
        break;
      }
      for (const p of k > 1 ? path.slice(1) : path) nodes.push(p);
    }
    if (!ok) continue;
    let pts: [number, number][] = nodes.map((i) => [(i % cn) * RC + RC / 2, Math.floor(i / cn) * RC + RC / 2]);
    pts = chaikin(simplify(pts), 3);
    g.roads.push({ kind: rd.kind, pts, from: rd.from, to: rd.to });
    paintRoad(g, pts, rd.kind, rd.name?.en === 'Old Royal Road');
  }
  bridges(g);
}

/** Camp sites roads may lead to (trails to faction strongholds). */
const CAMP_POS: Record<string, [number, number]> = { fangcamp: [1870, 800] };

function rank(k: RoadKind) {
  return k === 'main' ? 3 : k === 'road' ? 2 : 1;
}

function simplify(pts: [number, number][]): [number, number][] {
  // drop collinear grid steps so smoothing makes long curves
  if (pts.length < 3) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = out[out.length - 1];
    const [bx, bz] = pts[i];
    const [cx, cz] = pts[i + 1];
    const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(cross) > 1e-6 || i % 6 === 0) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function roadTile(c: number, kind: RoadKind): string {
  if (c === 4) return 'sandroad';
  if (c === 0) return 'trail';
  if (kind === 'main' && c !== 3) return 'road';
  return 'path';
}

function paintRoad(g: Gen, pts: [number, number][], kind: RoadKind, worn: boolean) {
  const t = g.t;
  const w = kind === 'main' ? 4.6 : kind === 'road' ? 3.4 : 2.4;
  const lvl = rank(kind);
  const dense = resample(pts, 0.8);
  const isWet = (x: number, z: number) => {
    const v = g.water[Math.floor(z) * g.n + Math.floor(x)];
    return v === W_RIVER || v === W_CHASM;
  };
  // a road only bridges where its centre line crosses the water in a short run; a long wet run
  // means it follows the river, and then it keeps to the banks
  const wet = dense.map(([x, z]) => isWet(x, z));
  const cross = new Uint8Array(dense.length);
  for (let k = 0; k < dense.length; ) {
    if (!wet[k]) {
      k++;
      continue;
    }
    let e = k;
    while (e < dense.length && wet[e]) e++;
    if (e - k <= 16) cross.fill(1, k, e);
    if (typeof process !== 'undefined' && process.env?.ROADDBG) console.log('wet run', kind, Math.round(dense[k][0]), Math.round(dense[k][1]), e - k);
    k = e;
  }
  for (let k = 0; k < dense.length; k++) {
    const [px, pz] = dense[k];
    const crossing = cross[k] === 1;
    stamp(g, px, pz, w / 2, (i, x, z) => {
      if (!g.land[i]) return;
      const wv = g.water[i];
      if (wv === W_SEA || wv === W_LAKE) return;
      if (wv === W_RIVER || wv === W_CHASM) {
        if (crossing) g.road[i] = Math.max(g.road[i], lvl);
        return;
      }
      if (t.elev[i]) return;
      if (g.road[i] >= lvl && g.road[i] !== 0) return;
      g.road[i] = Math.max(g.road[i], lvl);
      if (wv === W_ICE || wv === W_DRY) return;
      g.prot[i] = Math.max(g.prot[i], 1);
      const c = g.clim[i];
      let tile = roadTile(c, kind);
      // edges of dirt roads fray into the grass
      const edge = Math.hypot(x + 0.5 - px, z + 0.5 - pz) > w / 2 - 0.9;
      if (edge && kind !== 'main' && g.h(x, z, 61) < 0.35) return;
      if (worn && g.h(x >> 1, z >> 1, 62) < 0.3) tile = c === 4 ? 'sand' : c === 3 ? 'drydirt' : 'path';
      g.flatten(i, tile);
    });
  }
}

/** Road crossings of rivers and chasms become bridges (fords on trails). */
function bridges(g: Gen) {
  const { n, t } = g;
  const seen = new Uint8Array(n * n);
  const q: number[] = [];
  const made: [number, number][] = [];
  for (let s = 0; s < n * n; s++) {
    if (seen[s] || !g.road[s] || (g.water[s] !== W_RIVER && g.water[s] !== W_CHASM)) continue;
    // component of road-over-water cells
    const comp: number[] = [];
    q.length = 0;
    q.push(s);
    seen[s] = 1;
    let lvl = 0;
    while (q.length) {
      const i = q.pop()!;
      comp.push(i);
      lvl = Math.max(lvl, g.road[i]);
      const x = i % n;
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n]) {
        if (j < 0 || j >= n * n || seen[j] || !g.road[j]) continue;
        if (g.water[j] !== W_RIVER && g.water[j] !== W_CHASM) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    let x0 = n;
    let z0 = n;
    let x1 = 0;
    let z1 = 0;
    for (const i of comp) {
      const x = i % n;
      const z = (i / n) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    const chasm = comp.some((i) => g.water[i] === W_CHASM);
    // a road grazing a river bend again and again: keep one bridge, drop the rest
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (made.some(([bx, bz]) => Math.hypot(bx - cx, bz - cz) < 16)) {
      for (const i of comp) g.road[i] = 0;
      continue;
    }
    made.push([cx, cz]);
    if (lvl === 1 && !chasm) {
      // trails ford the river on stepping stones
      for (const i of comp) {
        t.cell[i] = CELL.floor;
        g.setTile(i, 'fordwater');
      }
      continue;
    }
    // orientation: the road runs along the longer side of the crossing's box... unless the
    // river runs that way: test which axis has water on both banks
    const spanX = x1 - x0 + 1;
    const spanZ = z1 - z0 + 1;
    const alongZ = crossAxisZ(g, x0, z0, x1, z1, spanX, spanZ);
    const width = Math.max(4, Math.min(7, alongZ ? spanX : spanZ));
    // extend the bridge onto the banks
    let a0 = alongZ ? z0 : x0;
    let a1 = alongZ ? z1 : x1;
    a0 -= 2;
    a1 += 2;
    const len = a1 - a0 + 1;
    const mid = alongZ ? Math.round((x0 + x1) / 2) : Math.round((z0 + z1) / 2);
    const kind = lvl >= 3 ? 'bridge_stone' : chasm ? 'bridge_wood' : lvl === 2 ? (g.h(x0, z0, 77) < 0.5 ? 'bridge_wood' : 'bridge_stone') : 'bridge_wood';
    if (!PREFABS[kind]) {
      for (const i of comp) t.cell[i] = CELL.floor;
      continue;
    }
    const bx = alongZ ? mid - Math.floor(width / 2) : a0;
    const bz = alongZ ? a0 : mid - Math.floor(width / 2);
    const inst = placeInst(kind, bx, bz, alongZ ? 0 : 1, 9000 + s, [len, width]);
    addBuild(g, inst, { clearUnder: true });
    // the deck is walkable over the water
    for (let a = a0; a <= a1; a++)
      for (let c = 0; c < width; c++) {
        const x = alongZ ? bx + c : a;
        const z = alongZ ? a : bz + c;
        if (!g.inb(x, z)) continue;
        const i = z * n + x;
        if (g.water[i] === W_RIVER || g.water[i] === W_CHASM) {
          t.cell[i] = CELL.floor;
          g.road[i] = Math.max(g.road[i], lvl);
        }
      }
  }
}

function crossAxisZ(g: Gen, x0: number, z0: number, x1: number, z1: number, spanX: number, spanZ: number): boolean {
  // if water continues beyond the box on the left/right (x), the river flows along x → the road crosses along z
  const n = g.n;
  let wx = 0;
  let wz = 0;
  const isW = (x: number, z: number) => g.inb(x, z) && (g.water[z * n + x] === W_RIVER || g.water[z * n + x] === W_CHASM);
  for (let z = z0; z <= z1; z++) {
    if (isW(x0 - 3, z)) wx++;
    if (isW(x1 + 3, z)) wx++;
  }
  for (let x = x0; x <= x1; x++) {
    if (isW(x, z0 - 3)) wz++;
    if (isW(x, z1 + 3)) wz++;
  }
  if (wx === wz) return spanZ >= spanX;
  return wx > wz;
}

// ------------------------------------------------------------------ structures
/**
 * Places a structure: stamps its solid cells, lights and spots, marks its footprint occupied.
 * Returns the collected builder (spots) or null when the prefab is unknown.
 */
export function addBuild(g: Gen, inst: BuildInst, o: { clearUnder?: boolean; flatten?: boolean } = {}) {
  const t = g.t;
  const n = g.n;
  if (o.flatten !== false)
    for (let z = inst.z; z < inst.z + inst.d; z++)
      for (let x = inst.x; x < inst.x + inst.w; x++) {
        if (!g.inb(x, z)) continue;
        const i = z * n + x;
        if (t.elev[i]) {
          t.elev[i] = 0;
          t.height[i] = 0;
          if (t.cell[i] === CELL.solid) t.cell[i] = CELL.floor;
        }
      }
  const b = collectBuild(inst, t);
  if (!b) {
    g.log.push(`missing prefab ${inst.kind}`);
    return null;
  }
  t.builds.push(inst);
  for (let z = inst.z; z < inst.z + inst.d; z++)
    for (let x = inst.x; x < inst.x + inst.w; x++) if (g.inb(x, z)) {
      g.occ[z * n + x] = 1;
      g.prot[z * n + x] = Math.max(g.prot[z * n + x], 1);
    }
  for (const k of b.solid) {
    if (k < 0 || k >= n * n) continue;
    if (t.cell[k] === CELL.liquid && !o.clearUnder) continue;
    t.cell[k] = CELL.solid;
    t.height[k] = Math.max(t.height[k], Math.min(255, Math.ceil(b.top)));
  }
  for (const l of b.lights) t.lights.push(l);
  for (const s of b.spots) g.spots.push(s);
  return b;
}

/** True when a w × d footprint at (x, z) is free land (no water, structures, roads unless allowed). */
export function fits(g: Gen, x: number, z: number, w: number, d: number, o: { roads?: boolean; prot?: number; water?: boolean; elev?: boolean } = {}): boolean {
  const n = g.n;
  for (let zz = z; zz < z + d; zz++)
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || zz < 0 || xx >= n || zz >= n) return false;
      const i = zz * n + xx;
      if (!g.land[i] || g.occ[i]) return false;
      if (g.water[i] && !(o.water && g.water[i] !== W_SEA)) {
        if (!(g.water[i] === W_DRY)) return false;
      }
      if (!o.roads && g.road[i]) return false;
      if (o.prot !== undefined && g.prot[i] > o.prot) return false;
      if (!o.elev && g.t.elev[i]) return false;
    }
  return true;
}

export { prefabSize };

// ------------------------------------------------------------------ small hills and mesas
function hills(g: Gen) {
  const { n, t } = g;
  const near = distField(g, (i) => g.prot[i] > 0 || g.road[i] > 0 || (g.water[i] > 0 && g.water[i] !== W_SEA) || g.occ[i] > 0, 7);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (!g.land[i] || t.elev[i] || g.water[i] || near[i] < 6) continue;
      const c = g.clim[i];
      const v = g.noise.hills.at(x, z);
      const thr = c === 4 ? 0.66 : c === 0 ? 0.7 : c === 3 ? 0.72 : 0.71;
      if (v < thr) continue;
      const k = (v - thr) / (1 - thr);
      const maxT = c === 4 ? 4 : c === 0 ? 3 : 2;
      const tier = Math.max(1, Math.min(maxT, Math.ceil(k * maxT * 1.6)));
      const top = c === 4 ? (tier > 1 ? 'canyon' : 'redsand') : c === 0 ? (tier > 1 ? 'snow' : 'snow2') : c === 1 ? 'tundra' : c === 3 ? 'dry' : 'grass';
      raise(g, i, tier, top);
    }
}

/** Area index (into AREAS) of a world point: the area whose (distance / radius) is smallest. */
export function areaIndexAt(x: number, z: number): number {
  let best = 0;
  let bv = Infinity;
  for (let k = 0; k < AREAS.length; k++) {
    const a = AREAS[k];
    const v = Math.hypot(x - a.x, z - a.z) / a.r;
    if (v < bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}
