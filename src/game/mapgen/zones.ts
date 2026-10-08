import { CELL, replaceAll } from '../Terrain';
import { distToCenter, type GenCtx } from './common';

/**
 * Points of interest layered on top of every generated map: settlements, ruins, camps,
 * clearings, watchtowers, shrines and walled secret areas, joined to the start by roads.
 */

interface Theme {
  wall: string;
  wall2: string;
  roof: string | null;
  floor: string;
  road: string | null;
  clearing: string;
  light: number;
  decor: number[];
}

const THEMES: Record<string, Theme> = {
  forest: { wall: 'plank', wall2: 'stone', roof: 'leaves', floor: 'dirt', road: 'path', clearing: 'grass2', light: 0xffb060, decor: [0xe85a8a, 0xfff07a, 0x9a7aff] },
  city: { wall: 'brick', wall2: 'stone', roof: 'roof', floor: 'plaza', road: 'road', clearing: 'grass', light: 0xffc66a, decor: [0x5a8a3a, 0x6a9a44] },
  catacombs: { wall: 'wall', wall2: 'pillar', roof: null, floor: 'tile', road: null, clearing: 'floor', light: 0xff9a3a, decor: [0xd8d0b8, 0xc8c0a8] },
  volcano: { wall: 'basalt', wall2: 'obsidian', roof: null, floor: 'basalt', road: 'basalt', clearing: 'ash', light: 0xff7a2a, decor: [0x2a2428, 0xff6a1a] },
  tundra: { wall: 'plank', wall2: 'rock', roof: 'snow', floor: 'trail', road: 'trail', clearing: 'snow', light: 0xffc080, decor: [0xffffff, 0x8a9a7a] },
  ruins: { wall: 'sandstone', wall2: 'marble', roof: null, floor: 'marble', road: 'marble', clearing: 'sand', light: 0x9a7aff, decor: [0x5a8a4a, 0xb89a6a] },
};

export type PoiKind = 'village' | 'ruin' | 'camp' | 'clearing' | 'tower' | 'shrine' | 'secret';
export const SHRINE_TYPES = ['heal', 'fury', 'magnet', 'gold'] as const;

interface Poi {
  x: number;
  z: number;
  r: number;
  kind: PoiKind;
  /** Secret area entrance direction (unit vector toward the opening). */
  gx?: number;
  gz?: number;
}

const RADIUS: Record<PoiKind, number> = { village: 11, ruin: 9, camp: 6, clearing: 12, tower: 5, shrine: 3, secret: 5 };

export function addZones(g: GenCtx, generator: string) {
  const { t, rng } = g;
  const n = t.size;
  const th = THEMES[generator] ?? THEMES.forest;
  const k = (n * n) / (160 * 160);
  const caves = generator === 'catacombs';
  const walkable = (x: number, z: number) => {
    if (!t.inBounds(x, z)) return false;
    const c = t.cell[t.idx(x, z)];
    return c === CELL.floor || c === CELL.hazard || c === CELL.ice;
  };

  // ---- placement
  const pois: Poi[] = [];
  const place = (kind: PoiKind, minCenter: number, spacing: number, tries = 60): Poi | null => {
    const r = RADIUS[kind];
    for (let i = 0; i < tries; i++) {
      const x = rng.int(14 + r, n - 15 - r);
      const z = rng.int(14 + r, n - 15 - r);
      if (distToCenter(g, x, z) < minCenter) continue;
      if (pois.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + spacing)) continue;
      // in the catacombs points of interest sit inside existing rooms
      if (caves && kind !== 'secret' && !walkable(x, z)) continue;
      const p: Poi = { x, z, r, kind };
      pois.push(p);
      return p;
    }
    return null;
  };
  const big: PoiKind[] = caves ? ['ruin', 'tower'] : ['village', 'ruin', 'camp', 'clearing', 'tower'];
  const nBig = Math.round((caves ? 3 : 4.2) * k);
  for (let i = 0; i < nBig; i++) place(big[i % big.length], 32, caves ? 10 : 16);
  const nShrine = 3 + Math.round(1.1 * k);
  for (let i = 0; i < nShrine; i++) place('shrine', 26, 12);
  const nSecret = 2 + Math.floor(k / 2);
  for (let i = 0; i < nSecret; i++) place('secret', 45, 12, 120);

  // ---- clearing mask (areas whose old obstacles are removed)
  const mask = new Uint8Array(n * n);
  const roadMask = new Uint8Array(n * n);
  const markDisk = (cx: number, cz: number, r: number, m = mask) => {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!t.inBounds(x, z) || (x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        if (t.cell[t.idx(x, z)] === CELL.wall) continue;
        m[t.idx(x, z)] = 1;
      }
  };
  for (const p of pois) {
    if (p.kind === 'secret') {
      // square room plus a tunnel from its entrance to the nearest open ground
      for (let z = p.z - p.r; z <= p.z + p.r; z++) for (let x = p.x - p.r; x <= p.x + p.r; x++) if (t.cell[t.idx(x, z)] !== CELL.wall) mask[t.idx(x, z)] = 1;
      const a = Math.atan2(g.c - p.z, g.c - p.x);
      const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      dirs.sort((d1, d2) => Math.abs(Math.atan2(d1[1], d1[0]) - a) - Math.abs(Math.atan2(d2[1], d2[0]) - a));
      const [dx, dz] = dirs[0];
      p.gx = dx;
      p.gz = dz;
      let x = p.x + dx * (p.r + 1);
      let z = p.z + dz * (p.r + 1);
      for (let s = 0; s < 40 && t.inBounds(x, z); s++) {
        if (t.cell[t.idx(x, z)] === CELL.wall) break;
        mask[t.idx(x, z)] = 1;
        if (s > 1 && walkable(x, z) && walkable(x + dx, z + dz)) break;
        x += dx;
        z += dz;
      }
      continue;
    }
    markDisk(p.x, p.z, p.r);
  }
  // roads: each point joins the nearest point already on the network (starting from the center)
  if (th.road) {
    const net: { x: number; z: number }[] = [{ x: g.c, z: g.c }];
    const todo = pois.filter((p) => p.kind !== 'secret');
    while (todo.length) {
      let bi = 0;
      let bj = 0;
      let bd = Infinity;
      for (let i = 0; i < todo.length; i++)
        for (let j = 0; j < net.length; j++) {
          const d = Math.hypot(todo[i].x - net[j].x, todo[i].z - net[j].z);
          if (d < bd) {
            bd = d;
            bi = i;
            bj = j;
          }
        }
      const p = todo.splice(bi, 1)[0];
      const q = net[bj];
      let x = q.x;
      let z = q.z;
      let guard = 0;
      while (Math.hypot(p.x - x, p.z - z) > 1.5 && guard++ < 2000) {
        const ang = Math.atan2(p.z - z, p.x - x) + (rng.next() - 0.5) * 0.6;
        x += Math.cos(ang);
        z += Math.sin(ang);
        markDisk(x, z, 1.6, roadMask);
      }
      net.push({ x: p.x, z: p.z });
    }
    for (let i = 0; i < n * n; i++) if (roadMask[i]) mask[i] = 1;
  }

  // ---- remove old obstacles inside the mask
  const keepB = t.blocks.filter((b) => {
    const x = Math.floor(b.x);
    const z = Math.floor(b.z);
    return !t.inBounds(x, z) || !mask[t.idx(x, z)] || t.cell[t.idx(x, z)] === CELL.wall;
  });
  replaceAll(t.blocks, keepB);
  const keepD = t.decor.filter((d) => {
    const x = Math.floor(d.x);
    const z = Math.floor(d.z);
    return !t.inBounds(x, z) || !mask[t.idx(x, z)];
  });
  replaceAll(t.decor, keepD);
  for (let i = 0; i < n * n; i++) {
    if (!mask[i] || t.cell[i] === CELL.wall) continue;
    t.cell[i] = CELL.floor;
    t.height[i] = 0;
    if (roadMask[i] && th.road) t.tile[i] = t.tileId(th.road);
  }
  replaceAll(t.spots, t.spots.filter((s) => !mask[t.idx(Math.floor(s.x), Math.floor(s.z))]));

  // ---- build the points of interest
  for (const p of pois) {
    switch (p.kind) {
      case 'village':
        village(g, p, th);
        break;
      case 'ruin':
        ruin(g, p, th);
        break;
      case 'camp':
        camp(g, p, th);
        break;
      case 'clearing':
        clearing(g, p, th);
        break;
      case 'tower':
        tower(g, p, th);
        break;
      case 'shrine':
        shrine(g, p, th);
        break;
      case 'secret':
        secret(g, p, th);
        break;
    }
  }
}

function paint(g: GenCtx, cx: number, cz: number, r: number, tile: string) {
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r || !g.t.isFree(x, z)) continue;
      g.t.setTile(x, z, tile);
    }
}

function decorRing(g: GenCtx, p: Poi, colors: number[], count: number, size = 0.16) {
  const { t, rng } = g;
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(1, p.r);
    const x = p.x + Math.cos(a) * d;
    const z = p.z + Math.sin(a) * d;
    if (!t.isFree(Math.floor(x), Math.floor(z))) continue;
    t.decor.push({ x, z, y: 0, size: size * rng.range(0.7, 1.3), h: size * 1.4, color: rng.pick(colors), sway: true });
  }
}

/** A few small houses around a square with a campfire. */
function village(g: GenCtx, p: Poi, th: Theme) {
  const { t, rng } = g;
  paint(g, p.x, p.z, p.r, th.floor);
  const huts = rng.int(2, 3);
  for (let i = 0; i < huts; i++) {
    const a = (i / huts) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const hx = Math.round(p.x + Math.cos(a) * 6.5) - 2;
    const hz = Math.round(p.z + Math.sin(a) * 6.5) - 2;
    const w = 4;
    // the door faces the square
    const door = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'w' : 'e') : Math.sin(a) > 0 ? 'n' : 's';
    for (let dz = 0; dz <= w; dz++)
      for (let dx = 0; dx <= w; dx++) {
        const edge = dx === 0 || dz === 0 || dx === w || dz === w;
        if (!edge) continue;
        const isDoor = (door === 'w' && dx === 0 && dz === 2) || (door === 'e' && dx === w && dz === 2) || (door === 'n' && dz === 0 && dx === 2) || (door === 's' && dz === w && dx === 2);
        if (isDoor) continue;
        t.column(hx + dx, hz + dz, 2, th.wall);
      }
    if (th.roof) t.roofs.push({ x: hx, z: hz, w: w + 1, d: w + 1, y: 2, mat: th.roof });
  }
  t.addBlock(p.x, 0, p.z, th.wall2, 0, false, 0.6);
  t.lights.push({ x: p.x + 0.5, z: p.z + 0.5, y: 1.2, color: th.light, intensity: 1.8 });
  decorRing(g, p, th.decor, 30);
  t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'poi', sub: 'village' });
}

/** Broken walls of an old building with pillars inside. */
function ruin(g: GenCtx, p: Poi, th: Theme) {
  const { t, rng } = g;
  const w = rng.int(10, 14);
  const d = rng.int(8, 12);
  const x0 = p.x - Math.floor(w / 2);
  const z0 = p.z - Math.floor(d / 2);
  for (let z = z0; z <= z0 + d; z++)
    for (let x = x0; x <= x0 + w; x++) {
      const edge = x === x0 || z === z0 || x === x0 + w || z === z0 + d;
      if (edge && !rng.chance(0.35)) t.column(x, z, rng.int(1, 3), th.wall2);
      else if (!edge && rng.chance(0.08)) t.setTile(x, z, th.floor);
    }
  for (let z = z0 + 3; z < z0 + d - 2; z += 4) for (let x = x0 + 3; x < x0 + w - 2; x += 4) if (t.isFree(x, z) && rng.chance(0.7)) t.column(x, z, rng.int(2, 4), th.wall2);
  decorRing(g, p, th.decor, 16, 0.2);
  t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'poi', sub: 'ruin' });
}

function camp(g: GenCtx, p: Poi, th: Theme) {
  const { t, rng } = g;
  paint(g, p.x, p.z, 4, th.floor);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng.next();
    const x = Math.round(p.x + Math.cos(a) * 3.5);
    const z = Math.round(p.z + Math.sin(a) * 3.5);
    if (!t.isFree(x, z) || !t.isFree(x + 1, z)) continue;
    t.column(x, z, 1, th.wall);
    t.column(x + 1, z, 1, th.wall);
    t.addBlock(x, 1, z, th.roof ?? th.wall2, 0, false, 0.8);
  }
  t.addBlock(p.x, 0, p.z, th.wall2, 0, true, 0.35);
  t.lights.push({ x: p.x + 0.5, z: p.z + 0.5, y: 0.8, color: th.light, intensity: 2 });
  t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'poi', sub: 'camp' });
}

/** Wide open ground: room to kite large crowds. */
function clearing(g: GenCtx, p: Poi, th: Theme) {
  paint(g, p.x, p.z, p.r - 1, th.clearing);
  decorRing(g, p, th.decor, 50);
  g.t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'poi', sub: 'clearing' });
}

function tower(g: GenCtx, p: Poi, th: Theme) {
  const { t } = g;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) t.column(p.x + dx, p.z + dz, 6, th.wall2);
  t.addBlock(p.x, 6, p.z, th.wall2, 0, true, 0.5);
  t.lights.push({ x: p.x + 0.5, z: p.z + 0.5, y: 6.5, color: th.light, intensity: 1.6 });
  paint(g, p.x, p.z, 4, th.floor);
  t.markers.push({ x: p.x + 2.5, z: p.z + 0.5, kind: 'poi', sub: 'tower' });
}

const SHRINE_COLOR: Record<string, number> = { heal: 0x6aff9a, fury: 0xff5a5a, magnet: 0x8ad8ff, gold: 0xffd23d };

/** One-use altar that grants a blessing when touched. */
function shrine(g: GenCtx, p: Poi, th: Theme) {
  const { t, rng } = g;
  const type = rng.pick([...SHRINE_TYPES]);
  paint(g, p.x, p.z, 2.5, th.floor);
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as [number, number][]) t.column(p.x + dx, p.z + dz, 2, th.wall2);
  t.addBlock(p.x, 0, p.z, 'shrine', SHRINE_TYPES.indexOf(type), true, 0.55);
  t.lights.push({ x: p.x + 0.5, z: p.z + 0.5, y: 1, color: SHRINE_COLOR[type], intensity: 1.5 });
  t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'shrine', sub: type });
}

/** Walled, roofed room with a single narrow entrance and a chest inside. */
function secret(g: GenCtx, p: Poi, th: Theme) {
  const { t } = g;
  const r = p.r;
  for (let z = p.z - r; z <= p.z + r; z++)
    for (let x = p.x - r; x <= p.x + r; x++) {
      const edge = Math.abs(x - p.x) === r || Math.abs(z - p.z) === r;
      if (!edge) continue;
      const gap = (p.gx !== 0 && x === p.x + (p.gx ?? 0) * r && z === p.z) || (p.gz !== 0 && z === p.z + (p.gz ?? 0) * r && x === p.x);
      if (gap) continue;
      t.column(x, z, 3, th.wall);
    }
  // canopy over the room hides it until the player walks in
  t.roofs.push({ x: p.x - r, z: p.z - r, w: 2 * r + 1, d: 2 * r + 1, y: 3, mat: th.roof ?? th.wall });
  paint(g, p.x, p.z, r - 1, th.floor);
  t.lights.push({ x: p.x + 0.5, z: p.z + 0.5, y: 1, color: 0xffd23d, intensity: 1.2 });
  t.markers.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'secret' });
}
