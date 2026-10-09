import { CELL, replaceAll } from '../Terrain';
import { fbm } from './noise';
import type { GenCtx } from './common';

/**
 * Raised ground in the style of blocky dungeon crawlers: grass-topped plateaus with several
 * height tiers, stepped terraces and tall cliffs around the map edge.
 *
 * Gameplay stays on the y=0 floor: every raised cell becomes an obstacle (low ledges are
 * solid; cliffs are at least 2 units tall so they stop shots, flyers still cross them). Roads, points
 * of interest, the start area and water banks are protected, plateaus never cut off a
 * marker, and pockets of floor enclosed by cliffs are filled up to the surrounding level.
 */

export interface ElevCfg {
  /** Share of the interior raised into plateaus (0 = none). */
  coverage: number;
  /** Highest plateau tier (world units). */
  maxTier: number;
  /** Height of the cliff band at the map edge; 0 keeps the generator's own border wall. */
  borderH: number;
  /** Noise scale of the plateau shapes (cells). */
  scale: number;
  /** Tiles that must never be raised (roads, plazas...). */
  keepTiles: string[];
  /** Tile drawn on top of a raised cell, given its current tile (null keeps it). */
  top: (tile: string, x: number, z: number) => string | null;
  /** Chance of a tree on a raised cell (forest plateaus). */
  trees?: number;
}

export const ELEV: Record<string, ElevCfg> = {
  forest: {
    coverage: 0.2, maxTier: 3, borderH: 5, scale: 30, keepTiles: ['path'], trees: 0.012,
    top: (tl) => (/grass/.test(tl) ? null : 'grass'),
  },
  tundra: {
    coverage: 0.18, maxTier: 3, borderH: 5, scale: 30, keepTiles: ['trail'],
    top: (tl) => (/snow|rock/.test(tl) ? null : 'snow'),
  },
  volcano: {
    coverage: 0.15, maxTier: 3, borderH: 5, scale: 26, keepTiles: [],
    top: (tl) => (/basalt|ash|scorch/.test(tl) ? null : 'basalt'),
  },
  ruins: {
    coverage: 0.13, maxTier: 2, borderH: 4, scale: 28, keepTiles: ['marble', 'rune'],
    top: (tl) => (/sand|moss/.test(tl) ? null : 'sand'),
  },
  city: { coverage: 0, maxTier: 0, borderH: 0, scale: 30, keepTiles: [], top: () => null },
  catacombs: { coverage: 0, maxTier: 0, borderH: 0, scale: 30, keepTiles: [], top: () => null },
};

/** Protection radius around map markers (cells). */
const MARKER_R: Record<string, number> = { village: 14, ruin: 12, camp: 9, clearing: 14, tower: 8, shrine: 6, secret: 8, rune: 6 };

export function elevate(g: GenCtx, generator: string, cleared: Uint8Array | null) {
  const cfg = ELEV[generator];
  if (!cfg || (!cfg.coverage && !cfg.borderH)) return;
  const { t } = g;
  const n = t.size;
  const N = n * n;
  const BW = 3; // border wall thickness written by border()

  // ---- distance (4-neighbour steps) from protected cells
  const keep = new Set(cfg.keepTiles.map((nm) => t.tileNames.indexOf(nm)).filter((i) => i >= 0));
  const dist = new Uint8Array(N).fill(255);
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  const protect = (i: number) => {
    if (dist[i] === 0) return;
    dist[i] = 0;
    q[qt++] = i;
  };
  const protectDisk = (cx: number, cz: number, r: number) => {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (t.inBounds(x, z) && (x - cx) ** 2 + (z - cz) ** 2 <= r * r) protect(z * n + x);
  };
  for (let i = 0; i < N; i++) {
    const c = t.cell[i];
    if (c === CELL.liquid || keep.has(t.tile[i]) || (cleared && cleared[i])) protect(i);
  }
  protectDisk(g.c, g.c, 17);
  for (const m of t.markers) protectDisk(m.x, m.z, MARKER_R[m.sub ?? m.kind] ?? MARKER_R[m.kind] ?? 8);
  while (qh < qt) {
    const i = q[qh++];
    const d = dist[i];
    if (d >= 16) continue;
    const x = i % n;
    const z = (i / n) | 0;
    if (x > 0 && dist[i - 1] > d + 1) (dist[i - 1] = d + 1), (q[qt++] = i - 1);
    if (x < n - 1 && dist[i + 1] > d + 1) (dist[i + 1] = d + 1), (q[qt++] = i + 1);
    if (z > 0 && dist[i - n] > d + 1) (dist[i - n] = d + 1), (q[qt++] = i - n);
    if (z < n - 1 && dist[i + n] > d + 1) (dist[i + n] = d + 1), (q[qt++] = i + n);
  }
  /** Highest tier allowed at this distance from protected ground: terraces step down to roads. */
  const cap = (d: number) => (d < 2 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d <= 6 ? 3 : 4);

  // ---- plateau field
  const e = new Uint8Array(N);
  const field = new Float32Array(N);
  const vals: number[] = [];
  for (let z = BW; z < n - BW; z++)
    for (let x = BW; x < n - BW; x++) {
      const i = z * n + x;
      const v = fbm(x / cfg.scale, z / cfg.scale, g.seed + 101) * 0.72 + fbm(x / (cfg.scale * 0.3), z / (cfg.scale * 0.3), g.seed + 131) * 0.28;
      field[i] = v;
      if (dist[i] >= 2) vals.push(v);
    }
  if (cfg.coverage > 0 && vals.length) {
    vals.sort((a, b) => a - b);
    const interior = (n - 2 * BW) ** 2;
    const want = Math.min(vals.length - 1, Math.floor(interior * cfg.coverage));
    const thr = vals[vals.length - 1 - want];
    const step = 0.045;
    for (let i = 0; i < N; i++) {
      const v = field[i];
      if (v <= thr || dist[i] < 2) continue;
      e[i] = Math.min(cfg.maxTier, 1 + Math.floor((v - thr) / step), cap(dist[i]));
    }
  }

  // ---- ragged cliff band along the map edge, stepping down toward the play area
  if (cfg.borderH) {
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const d = Math.min(x, z, n - 1 - x, n - 1 - z);
        if (d < BW) {
          e[i] = cfg.borderH;
          continue;
        }
        const band = 2 + fbm(x / 7, z / 7, g.seed + 151) * 9;
        const k = d - BW;
        if (k >= band) continue;
        const tier = Math.max(1, cfg.borderH - 1 - Math.floor((k / band) * (cfg.borderH - 1)));
        e[i] = Math.max(e[i], Math.min(tier, cap(dist[i])));
      }
  }

  // ---- erode one-cell spikes and thin spurs so every cliff reads as a solid mass
  for (let pass = 0; pass < 3; pass++) {
    for (let z = BW; z < n - BW; z++)
      for (let x = BW; x < n - BW; x++) {
        const i = z * n + x;
        const h = e[i];
        if (!h) continue;
        let c = 0;
        if (e[i - 1] >= h) c++;
        if (e[i + 1] >= h) c++;
        if (e[i - n] >= h) c++;
        if (e[i + n] >= h) c++;
        const thin = (e[i - 1] < h && e[i + 1] < h) || (e[i - n] < h && e[i + n] < h);
        if (c < 2 || thin) e[i] = h - 1;
      }
  }
  // never raise liquids (their banks) or the map border on maps that keep their own walls
  for (let i = 0; i < N; i++) if (t.cell[i] === CELL.liquid) e[i] = 0;

  // ---- keep every marker reachable: carve a ramp-free valley back to open ground
  const reach = () => {
    const seen = new Uint8Array(N);
    let h = 0;
    let tl = 0;
    const s = g.c * n + g.c;
    seen[s] = 1;
    q[tl++] = s;
    while (h < tl) {
      const i = q[h++];
      const x = i % n;
      const z = (i / n) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, z > 0 ? i - n : -1, z < n - 1 ? i + n : -1];
      for (const j of nb) {
        if (j < 0 || seen[j] || e[j]) continue;
        const c = t.cell[j];
        if (c === CELL.solid || c === CELL.liquid || c === CELL.wall) continue;
        seen[j] = 1;
        q[tl++] = j;
      }
    }
    return seen;
  };
  let seen = reach();
  for (const m of t.markers) {
    const mi = Math.floor(m.z) * n + Math.floor(m.x);
    if (seen[mi] || !walk(t.cell[mi])) continue;
    let x = m.x;
    let z = m.z;
    for (let s = 0; s < n; s++) {
      const a = Math.atan2(g.c - z, g.c - x);
      x += Math.cos(a);
      z += Math.sin(a);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (t.inBounds(Math.round(x) + dx, Math.round(z) + dz)) e[(Math.round(z) + dz) * n + Math.round(x) + dx] = 0;
      if (seen[Math.round(z) * n + Math.round(x)]) break;
    }
    seen = reach();
  }
  // pockets of floor walled in by cliffs become part of the plateau around them
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (let z = 1; z < n - 1; z++)
      for (let x = 1; x < n - 1; x++) {
        const i = z * n + x;
        if (seen[i] || e[i] || !walk(t.cell[i])) continue;
        let lo = 0;
        for (const j of [i - 1, i + 1, i - n, i + n]) if (e[j] && (!lo || e[j] < lo)) lo = e[j];
        if (lo) {
          e[i] = lo;
          changed = true;
        }
      }
    if (!changed) break;
  }

  // ---- apply
  const lift = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    if (!e[i]) continue;
    const x = i % n;
    const z = (i / n) | 0;
    // tiers rise as one tall first cliff (2 units) and then one-unit steps; the edge band keeps its height
    const edge = Math.min(x, z, n - 1 - x, n - 1 - z) < BW;
    const h = edge ? e[i] : Math.min(cfg.borderH || 4, e[i] + 1);
    e[i] = h;
    t.elev[i] = h;
    lift.set(i, h);
    // solid, not wall: walkers path around, shots stop at the cliff, flyers still cross
    if (t.cell[i] !== CELL.wall) t.cell[i] = CELL.solid;
    t.height[i] = Math.max(t.height[i], h);
    const tl = t.tileNames[t.tile[i]] ?? '';
    const top = cfg.top(tl, x, z);
    if (top) t.tile[i] = t.tileId(top);
  }
  // the generator's border wall is replaced by the cliff band
  const keepB = t.blocks.filter((b) => {
    const x = Math.floor(b.x);
    const z = Math.floor(b.z);
    if (!t.inBounds(x, z)) return false;
    const i = z * n + x;
    if (cfg.borderH && Math.min(x, z, n - 1 - x, n - 1 - z) < BW) return false;
    const h = lift.get(i);
    if (h) b.y += h;
    return true;
  });
  replaceAll(t.blocks, keepB);
  for (const d of t.decor) {
    const h = t.elevAt(d.x, d.z);
    if (h) d.y += h;
  }
  for (const l of t.lights) l.y += t.elevAt(l.x, l.z);
  replaceAll(t.spots, t.spots.filter((s) => !t.elev[s.z * n + s.x]));
  if (cfg.trees) {
    for (let i = 0; i < N; i++) {
      const x = i % n;
      const z = (i / n) | 0;
      if (!e[i] || Math.min(x, z, n - 1 - x, n - 1 - z) < BW + 2) continue;
      if (g.rng.next() > cfg.trees) continue;
      // trees stand back from the cliff edge
      if (e[i - 1] < e[i] || e[i + 1] < e[i] || e[i - n] < e[i] || e[i + n] < e[i]) continue;
      if (t.trees.some((tr) => Math.abs(tr.x - x) < 3 && Math.abs(tr.z - z) < 3)) continue;
      t.trees.push({ x, z, h: g.rng.int(3, 5), kind: 'oak', leaf: 'leaves', trunk: 'trunk', v: g.rng.int(0, 2) });
    }
  }
}

function walk(c: number) {
  return c === CELL.floor || c === CELL.hazard || c === CELL.ice;
}
