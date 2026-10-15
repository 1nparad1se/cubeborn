import { Rng, hash2 } from '../../core/Rng';
import { CELL, type Terrain } from '../../game/Terrain';
import type { RoadKind } from '../textures/groundTiles';
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
  inst.y = o.y ?? base;
  const model = def.build(ctx);
  if (!o.noCollide) {
    const hgt = Math.max(1, Math.ceil(def.height ?? modelTop(model) * PX * (inst.scale ?? 1)));
    for (const c of cells) {
      const i = t.idx(c.cx, c.cz);
      if (t.cell[i] === CELL.wall) continue;
      const dk = def.deck?.(c.fx, c.fz, ctx);
      if (dk !== undefined && dk !== null) {
        if (!t.under.has(i)) t.under.set(i, { cell: t.cell[i], elev: t.elev[i] });
        t.elev[i] = Math.max(0, Math.round(inst.y + dk));
        t.cell[i] = CELL.floor;
      } else if (solidAt(c.fx, c.fz)) {
        t.cell[i] = CELL.solid;
        t.height[i] = Math.max(t.height[i], hgt);
      }
    }
  }
  for (const l of model.lights ?? []) {
    const [wx, wy, wz] = toWorld(inst, l.x, l.y, l.z);
    t.lights.push({ x: wx, y: wy - t.groundY(wx, wz), z: wz, color: l.color, intensity: l.intensity, radius: l.radius, flicker: l.flicker ?? 0.6, day: l.day ?? 0.35 });
  }
  t.props.push(inst);
  return inst;
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
 */
export function paintRoad(t: Terrain, kind: RoadKind | string, pts: [number, number][], width = 3, o: { ragged?: number; seed?: number; skip?: (cx: number, cz: number) => boolean } = {}): number {
  const ragged = o.ragged ?? 0.6;
  const r = width / 2 + ragged;
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
        const edge = width / 2 + (hash2(cx, cz, o.seed ?? 515) - 0.5) * 2 * ragged;
        if (d > edge) continue;
        if (t.tileNames[t.tile[i]] !== kind) n++;
        t.setTile(cx, cz, kind);
      }
    if (pts.length === 1) break;
  }
  return n;
}

/**
 * Places a parametric bridge from a to b (its local +x runs along the span): the prop receives
 * `params.length` (cells between the end points, rounded) and is centred between them.
 */
export function placeBridge(t: Terrain, id: string, a: [number, number], b: [number, number], o: PlaceOpts = {}): PropInstance | null {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.max(1, Math.round(Math.hypot(dx, dz)));
  return placeProp(t, id, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { ...o, rot: o.rot ?? rotFor(dx, dz), params: { length, ...o.params } });
}
