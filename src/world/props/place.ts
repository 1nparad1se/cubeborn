import { Rng, hash2 } from '../../core/Rng';
import { CELL, type Terrain } from '../../game/Terrain';
import { GROUND_TILES, roadBase, type RoadKind } from '../textures/groundTiles';
import { ROAD_EDGE_DECOR, ROAD_SURFACE_DECOR } from './roads';
import { PROPS } from './index';
import { PX, type BuildCtx, type PropDef, type PropInstance, type PropModel } from './types';

/**
 * Placement API for map generators (pure: runs in the headless tests too).
 *
 *   placeProp(t, 'lamp_post', 120.5, 130.5, { rot: 1 })
 *   placeAlong(t, 'palisade', [[10, 10], [20, 10], [20, 18]], { spacing: 1 })
 *   paintRoad(t, 'road_stone', [[100, 128], [140, 128]], 3)
 *   placeBridge(t, 'bridge_wood', [200, 90], [214, 90])
 *
 * Placement marks the footprint on the navigation grid (solid cells block walkers; deck cells
 * become walkable floor at the deck height), registers the prop's lights and stores the instance
 * in `t.props` for the renderer. Place props BEFORE computing `t.reach` so paths see them.
 */

export interface PlaceOpts {
  /** Quarter turns (0..3), counter-clockwise seen from above (three.js rotation.y). */
  rot?: number;
  variant?: number;
  /** Base height (world y). Default: the highest ground under the footprint. */
  y?: number;
  /** Instance seed (default: from the position, so the same spot always looks the same). */
  seed?: number;
  params?: Record<string, number>;
  /** Free yaw in radians for decoration (does not turn the footprint). */
  yaw?: number;
  scale?: number;
  /** Skip placement (return null) when a solid footprint cell is not free floor. */
  ifFree?: boolean;
  /** Do not touch the navigation grid (pure decoration). */
  noCollide?: boolean;
}

export function makeCtx(def: PropDef, inst: Pick<PropInstance, 'variant' | 'seed' | 'params'>): BuildCtx {
  const rng = new Rng(inst.seed);
  return { variant: Math.min(inst.variant, (def.variants ?? 1) - 1), seed: inst.seed, rnd: () => rng.next(), params: inst.params ?? {} };
}

export function buildModel(def: PropDef, inst: Pick<PropInstance, 'variant' | 'seed' | 'params'>): PropModel {
  return def.build(makeCtx(def, inst));
}

export function footprintSize(def: PropDef, params: Record<string, number> = {}): [number, number] {
  return typeof def.size === 'function' ? def.size(params) : def.size;
}

/** Yaw (radians) of an instance: quarter turns plus free yaw. */
export function instYaw(inst: Pick<PropInstance, 'rot' | 'yaw'>): number {
  return (inst.rot & 3) * (Math.PI / 2) + (inst.yaw ?? 0);
}

/** Local px point → world position for an instance. */
export function toWorld(inst: PropInstance, x: number, y: number, z: number): [number, number, number] {
  const a = instYaw(inst);
  const s = PX * (inst.scale ?? 1);
  const c = Math.cos(a);
  const n = Math.sin(a);
  return [inst.x + (x * c + z * n) * s, inst.y + y * s, inst.z + (-x * n + z * c) * s];
}

/** World cells of the footprint with their local (rotation 0) cell coordinates. */
export function footprintCells(def: PropDef, inst: PropInstance): { fx: number; fz: number; cx: number; cz: number }[] {
  const [sx, sz] = footprintSize(def, inst.params);
  const a = (inst.rot & 3) * (Math.PI / 2);
  const c = Math.round(Math.cos(a));
  const n = Math.round(Math.sin(a));
  const out: { fx: number; fz: number; cx: number; cz: number }[] = [];
  for (let fz = 0; fz < sz; fz++)
    for (let fx = 0; fx < sx; fx++) {
      const lx = fx + 0.5 - sx / 2;
      const lz = fz + 0.5 - sz / 2;
      out.push({ fx, fz, cx: Math.floor(inst.x + lx * c + lz * n), cz: Math.floor(inst.z - lx * n + lz * c) });
    }
  return out;
}

/** Top of a model in px. */
export function modelTop(m: PropModel): number {
  let top = 0;
  for (const p of m.parts) top = Math.max(top, p.y + p.h);
  return top;
}

export function placeProp(t: Terrain, id: string, x: number, z: number, o: PlaceOpts = {}): PropInstance | null {
  const def = PROPS[id];
  if (!def) throw new Error(`unknown prop: ${id}`);
  const inst: PropInstance = {
    id,
    x,
    y: 0,
    z,
    rot: ((o.rot ?? 0) % 4 + 4) % 4,
    yaw: o.yaw,
    variant: o.variant ?? 0,
    seed: o.seed ?? Math.floor(hash2(Math.floor(x * 8), Math.floor(z * 8), 4242) * 2 ** 31),
    params: o.params,
    scale: o.scale,
  };
  const cells = footprintCells(def, inst).filter((c) => t.inBounds(c.cx, c.cz));
  const ctx = makeCtx(def, inst);
  const solidAt = (fx: number, fz: number) => (typeof def.solid === 'function' ? def.solid(fx, fz, ctx) : def.solid);
  if (o.ifFree && cells.some((c) => solidAt(c.fx, c.fz) && !t.isFree(c.cx, c.cz))) return null;
  let base = 0;
  for (const c of cells) base = Math.max(base, t.elev[t.idx(c.cx, c.cz)]);
  if (t.corner && o.y === undefined) base = surfaceBase(t, def, cells.map((c) => t.idx(c.cx, c.cz)), x, z, !!o.noCollide);
  inst.y = o.y ?? base;
  const model = def.build(ctx);
  let decked = false;
  if (!o.noCollide) {
    const hgt = Math.max(1, Math.ceil(def.height ?? modelTop(model) * PX * (inst.scale ?? 1)));
    for (const c of cells) {
      const i = t.idx(c.cx, c.cz);
      if (t.cell[i] === CELL.wall) continue;
      const dk = def.deck?.(c.fx, c.fz, ctx);
      if (dk !== undefined && dk !== null) {
        if (!t.under.has(i)) t.under.set(i, { cell: t.cell[i], elev: t.elev[i] });
        t.elev[i] = Math.max(0, Math.round(inst.y + dk));
        t.deckY.set(i, inst.y + dk);
        t.cell[i] = CELL.floor;
        decked = true;
      } else if (solidAt(c.fx, c.fz)) {
        t.cell[i] = CELL.solid;
        t.height[i] = Math.max(t.height[i], hgt);
      }
    }
  }
  if (decked) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const c of cells) {
      x0 = Math.min(x0, c.cx);
      z0 = Math.min(z0, c.cz);
      x1 = Math.max(x1, c.cx);
      z1 = Math.max(z1, c.cz);
    }
    t.rebuildDecks(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  }
  for (const l of model.lights ?? []) {
    const [wx, wy, wz] = toWorld(inst, l.x, l.y, l.z);
    t.lights.push({ x: wx, y: wy - t.groundY(wx, wz), z: wz, color: l.color, intensity: l.intensity, radius: l.radius, flicker: l.flicker ?? 0.6, day: l.day ?? 0.35 });
  }
  t.props.push(inst);
  return inst;
}

/**
 * Base height of a prop on the sloped ground. Plants, rocks, trees and small things sit on the
 * lowest corner under them (sunk slightly, never floating). Flat-based structures (camps, cargo,
 * buildings, ruins, decks) get a level pad: the ground under the footprint is flattened to the
 * mean height there and the slope around it meets the pad.
 */
function surfaceBase(t: Terrain, def: PropDef, cells: number[], x: number, z: number, deco: boolean): number {
  if (!cells.length) return t.groundY(x, z);
  const natural = deco || def.category === 'trees' || def.category === 'vegetation' || (def.tags ?? []).some((g) => g === 'rock' || g === 'tree' || g === 'grass');
  const land = cells.filter((i) => t.cell[i] !== CELL.liquid && !t.under.has(i));
  if (natural || cells.length < 2 || !land.length) {
    let lo = Infinity;
    for (const i of land.length ? land : cells) lo = Math.min(lo, t.minCorner(i));
    // a small thing sits right on the slope under its centre; bigger ones on the lowest corner
    return cells.length === 1 && land.length ? Math.min(t.groundY(x, z), lo + 0.15) - 0.03 : lo - 0.03;
  }
  let sum = 0;
  for (const i of land) sum += t.centerY(i);
  const h = sum / land.length;
  t.flattenPad(land, h);
  return h;
}

/** Quarter turn whose local +x axis points along (dx, dz). */
export function rotFor(dx: number, dz: number): number {
  const a = Math.atan2(-dz, dx);
  return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
}

/**
 * Places a prop repeatedly along a polyline (fences, palisades, rows of torches): one every
 * `spacing` cells, each turned so its local +x follows the line.
 */
export function placeAlong(t: Terrain, id: string, pts: [number, number][], o: PlaceOpts & { spacing?: number } = {}): PropInstance[] {
  const out: PropInstance[] = [];
  const step = o.spacing ?? 1;
  let carry = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (!len) continue;
    const rot = o.rot ?? rotFor(bx - ax, bz - az);
    if (carry > len) {
      carry -= len;
      continue;
    }
    for (let d = carry; d <= len + 1e-6; d += step) {
      const u = d / len;
      const p = placeProp(t, id, ax + (bx - ax) * u, az + (bz - az) * u, { ...o, rot, seed: o.seed !== undefined ? o.seed + out.length : undefined });
      if (p) out.push(p);
      carry = d + step - len;
    }
  }
  return out;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - ax - dx * u, pz - az - dz * u);
}

/**
 * Paints a road surface (a terrain tile kind, see textures/groundTiles.ts) along a polyline:
 * every land cell whose centre lies within width/2 of the line, with a ragged edge. Returns the
 * cells painted. Water, walls and deck cells are left alone.
 * - `ruined` / `overgrown` (0..1): share of cells (in clumps) switched to the kind's sheet variant
 *   (`<kind>_ruined`, `<kind>_overgrown`, or the closest one it has), overgrown also frays the edge.
 * - `decor` (default 0.35, 0 = off): density of detail props scattered along the edges (grass,
 *   stones, flowers, reeds... per kind, see ROAD_EDGE_DECOR) and, sparser, on the surface.
 */
export function paintRoad(
  t: Terrain,
  kind: RoadKind | string,
  pts: [number, number][],
  width = 3,
  o: { ragged?: number; seed?: number; skip?: (cx: number, cz: number) => boolean; ruined?: number; overgrown?: number; decor?: number } = {},
): number {
  const ragged = o.ragged ?? 0.6;
  const r = width / 2 + ragged;
  const seed = o.seed ?? 515;
  const base = roadBase(kind);
  const alt = (want: string[]): string | null => {
    if (!base) return null;
    for (const w of want) if (GROUND_TILES[`${base}_${w}`]) return `${base}_${w}`;
    return null;
  };
  const ruinTile = alt(['ruined', 'puddles', 'stones', 'scree', 'mud', 'drift']);
  const growTile = alt(['overgrown', 'narrow', 'old', 'stones']);
  const painted = new Map<number, [number, number]>();
  let n = 0;
  for (let k = 0; k + 1 < pts.length || (pts.length === 1 && k === 0); k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[Math.min(k + 1, pts.length - 1)];
    for (let cz = Math.floor(Math.min(az, bz) - r); cz <= Math.ceil(Math.max(az, bz) + r); cz++)
      for (let cx = Math.floor(Math.min(ax, bx) - r); cx <= Math.ceil(Math.max(ax, bx) + r); cx++) {
        if (!t.inBounds(cx, cz)) continue;
        const i = t.idx(cx, cz);
        const c = t.cell[i];
        if (c === CELL.liquid || c === CELL.wall || t.under.has(i)) continue;
        if (o.skip?.(cx, cz)) continue;
        const d = segDist(cx + 0.5, cz + 0.5, ax, az, bx, bz);
        let edge = width / 2 + (hash2(cx, cz, seed) - 0.5) * 2 * ragged;
        if (o.overgrown) edge -= o.overgrown * hash2(cx, cz, seed + 7) * 0.8;
        if (d > edge) continue;
        let tile = kind;
        const clump = (s: number) => hash2(cx >> 1, cz >> 1, seed + s) * 0.6 + hash2(cx, cz, seed + s + 1) * 0.4;
        if (o.overgrown && growTile && clump(11) < o.overgrown) tile = growTile;
        else if (o.ruined && ruinTile && clump(21) < o.ruined) tile = ruinTile;
        if (t.tileNames[t.tile[i]] !== tile) n++;
        t.setTile(cx, cz, tile);
        painted.set(i, [bx - ax, bz - az]);
      }
    if (pts.length === 1) break;
  }
  const dens = o.decor ?? 0.35;
  if (base && dens > 0) scatterRoadDecor(t, base, painted, dens, seed);
  return n;
}

/** Detail props along the edge (just outside the road) and sparsely on the surface. */
function scatterRoadDecor(t: Terrain, base: RoadKind, painted: Map<number, [number, number]>, dens: number, seed: number) {
  const edgeIds = ROAD_EDGE_DECOR[base];
  const surfIds = ROAD_SURFACE_DECOR[base];
  const used = new Set<number>();
  for (const [i, dir] of painted) {
    const cx = i % t.size;
    const cz = Math.floor(i / t.size);
    const h = (s: number) => hash2(cx, cz, seed + s);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!t.inBounds(nx, nz)) continue;
      const j = t.idx(nx, nz);
      if (painted.has(j) || used.has(j) || t.cell[j] !== CELL.floor || t.under.has(j)) continue;
      if (hash2(nx, nz, seed + 31) > dens * 0.5) continue;
      used.add(j);
      const id = edgeIds[Math.floor(hash2(nx, nz, seed + 32) * edgeIds.length)];
      const def = PROPS[id];
      // sit on the seam, leaning a little onto the road
      placeProp(t, id, nx + 0.5 - dx * 0.35, nz + 0.5 - dz * 0.35, { noCollide: true, yaw: h(33) * 6.283, variant: Math.floor(hash2(nx, nz, seed + 34) * (def?.variants ?? 1)), scale: 0.8 + h(35) * 0.35 });
    }
    if (surfIds.length && !used.has(i) && h(41) < dens * 0.08) {
      used.add(i);
      const id = surfIds[Math.floor(h(42) * surfIds.length)];
      placeProp(t, id, cx + 0.5, cz + 0.5, { noCollide: true, rot: rotFor(dir[0], dir[1]), variant: Math.floor(h(43) * (PROPS[id]?.variants ?? 1)) });
    }
  }
}

/**
 * Places a parametric bridge between two end cells a and b (integer cell coordinates, both
 * inclusive: put them on the banks so the bridge ends rest on land). The span is snapped to the
 * dominant axis (local +x runs from a to b), `params.length` = cells from a to b inclusive, and
 * the footprint covers the cell rows a-line .. a-line + width - 1 across the span (whatever the
 * direction, so the deck cells always match the drawn model). The base height defaults to the
 * higher bank (the end cells), not the water. Note the local z side of asymmetric bridges (the
 * pier's water row) turns with the direction.
 */
export function placeBridge(t: Terrain, id: string, a: [number, number], b: [number, number], o: PlaceOpts = {}): PropInstance | null {
  const def = PROPS[id];
  if (!def) throw new Error(`unknown prop: ${id}`);
  const ax = Math.floor(a[0]);
  const az = Math.floor(a[1]);
  const bx = Math.floor(b[0]);
  const bz = Math.floor(b[1]);
  const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
  const length = (alongX ? Math.abs(bx - ax) : Math.abs(bz - az)) + 1;
  const params = { length, ...o.params };
  const [, w] = footprintSize(def, params);
  // centre along the span: middle of the inclusive cell run; across: the a-line, snapped to the grid
  const mid = (u: number, v: number) => (Math.min(u, v) + Math.max(u, v) + 1) / 2;
  const across = (c: number) => c + w / 2; // the a-line is the first row across, the rest follow on +x/+z
  const x = alongX ? mid(ax, bx) : across(ax);
  const z = alongX ? across(az) : mid(az, bz);
  const rot = o.rot ?? (alongX ? (bx >= ax ? 0 : 2) : bz >= az ? 3 : 1);
  let y = o.y;
  if (y === undefined) {
    y = 0;
    for (const [cx, cz] of [[ax, az], alongX ? [bx, az] : [ax, bz]]) if (t.inBounds(cx, cz)) {
        const i = t.idx(cx, cz);
        // on sloped ground: the bank's surface height (decks join it without a step)
        y = Math.max(y, t.corner && t.cell[i] !== CELL.liquid && !t.under.has(i) ? t.centerY(i) : t.under.get(i)?.elev ?? t.elev[i]);
      }
  }
  return placeProp(t, id, x, z, { ...o, rot, y, params });
}
