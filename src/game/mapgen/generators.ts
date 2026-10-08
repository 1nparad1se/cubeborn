import type { MapDef } from '../../data/types';
import { Rng } from '../../core/Rng';
import { CELL, Terrain, replaceAll } from '../Terrain';
import { fbm } from './noise';
import { addZones } from './zones';
import { border, blobs, clearCenter, disk, distToCenter, fillTiles, path, pine, pond, rockCluster, scatterDecor, sealUnreachable, tree, type GenCtx } from './common';

type Gen = (g: GenCtx) => void;

// ------------------------------------------------------------------ Blightwood: infected forest
const forest: Gen = (g) => {
  const { t, rng } = g;
  fillTiles(g, (x, z) => (fbm(x / 9, z / 9, g.seed) > 0.62 ? 'grass2' : 'grass'));
  blobs(g, 14, 0.7, 3, (x, z) => t.setTile(x, z, 'dirt'));
  // winding dirt paths from the center to each edge
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.4, 0.4);
    path(g, g.c, g.c, g.c + Math.cos(a) * (t.size / 2 - 6), g.c + Math.sin(a) * (t.size / 2 - 6), 3, 'path');
  }
  // toxic bogs (hazard) and ponds
  blobs(g, 11, 0.74, 9, (x, z) => {
    if (distToCenter(g, x, z) > 14) t.setTile(x, z, 'bog', CELL.hazard);
  });
  for (let i = 0; i < 9 * g.k; i++) {
    const x = rng.int(12, t.size - 12);
    const z = rng.int(12, t.size - 12);
    if (distToCenter(g, x, z) < 18) continue;
    pond(g, x, z, rng.int(2, 5), 'water', CELL.liquid, 0x6b8a4a);
  }
  // trees: dense groves from noise
  for (let z = 4; z < t.size - 4; z += 2)
    for (let x = 4; x < t.size - 4; x += 2) {
      const dens = fbm(x / 16, z / 16, g.seed + 31);
      if (dens < 0.5 || !rng.chance((dens - 0.45) * 0.9)) continue;
      const tx = x + rng.int(0, 1);
      const tz = z + rng.int(0, 1);
      if (!t.areaFree(tx, tz, 1) || distToCenter(g, tx, tz) < 9) continue;
      tree(g, tx, tz, 'trunk', 'leaves', rng.int(3, 5), rng.chance(0.18) ? 3 : rng.int(0, 2));
      t.spots.push({ x: tx, z: tz });
    }
  // giant mushrooms
  for (let i = 0; i < 26 * g.k; i++) {
    const x = rng.int(6, t.size - 6);
    const z = rng.int(6, t.size - 6);
    if (!t.areaFree(x, z, 1) || distToCenter(g, x, z) < 10) continue;
    if (t.solidCell(x, z, 2)) t.trees.push({ x, z, h: rng.int(2, 3), kind: 'mushroom', leaf: 'mushroom', trunk: 'mushroom', v: 0 });
  }
  // abandoned wooden huts (narrow interiors)
  for (let i = 0; i < 7 * g.k; i++) {
    const x = rng.int(15, t.size - 22);
    const z = rng.int(15, t.size - 22);
    if (distToCenter(g, x + 3, z + 3) < 16) continue;
    const w = rng.int(5, 8);
    const d = rng.int(5, 7);
    for (let dz = 0; dz <= d; dz++)
      for (let dx = 0; dx <= w; dx++) {
        const edge = dx === 0 || dz === 0 || dx === w || dz === d;
        if (!edge) {
          t.setTile(x + dx, z + dz, 'path', CELL.floor);
          continue;
        }
        if ((dx === Math.floor(w / 2) && (dz === 0 || dz === d)) || rng.chance(0.15)) continue;
        t.column(x + dx, z + dz, rng.int(1, 3), 'plank');
      }
  }
  for (let i = 0; i < 60 * g.k; i++) {
    const x = rng.int(6, t.size - 6);
    const z = rng.int(6, t.size - 6);
    if (distToCenter(g, x, z) > 10) rockCluster(g, x, z, 'stone', rng.int(1, 4));
  }
  scatterDecor(g, 1600 * g.k, [0x6fb34a, 0x7cc455, 0x5a9a3a], { size: 0.12, h: 0.35, sway: true, onTile: ['grass', 'grass2'] });
  scatterDecor(g, 260 * g.k, [0xe85a8a, 0xfff07a, 0x9a7aff, 0xffffff], { size: 0.16, h: 0.22, sway: true, onTile: ['grass', 'grass2'] });
  scatterDecor(g, 160 * g.k, [0xc8483a, 0xb84aff, 0xe0d0b0], { size: 0.22, h: 0.25, onTile: ['grass', 'grass2', 'dirt'] });
  scatterDecor(g, 120 * g.k, [0x9aff6a], { size: 0.12, h: 0.12, glow: true, onTile: ['bog'] });
  border(g, 'stone', 3, 4);
  clearCenter(g, 7, 'grass');
};

// ------------------------------------------------------------------ Gloamhaven: abandoned city
const city: Gen = (g) => {
  const { t, rng } = g;
  fillTiles(g, () => 'cobble');
  const block = 18;
  const road = 4;
  // canal across the city with bridges
  const canalZ = g.c + rng.int(18, 30) * (rng.chance(0.5) ? 1 : -1);
  for (let x = 0; x < t.size; x++)
    for (let dz = -2; dz <= 2; dz++) t.setTile(x, canalZ + dz, 'water', CELL.liquid);
  for (let bx = 0; bx < t.size; bx += block)
    for (let dx = 0; dx < road; dx++)
      for (let dz = -2; dz <= 2; dz++) t.setTile(bx + dx, canalZ + dz, 'road', CELL.floor);
  // street grid and building lots
  for (let by = 0; by < t.size; by += block)
    for (let bx = 0; bx < t.size; bx += block) {
      for (let z = by; z < by + block; z++)
        for (let x = bx; x < bx + block; x++) {
          if (x - bx < road || z - by < road) t.setTile(x, z, 'road');
        }
      const lx = bx + road;
      const lz = by + road;
      const lw = block - road;
      if (Math.abs(lz + lw / 2 - canalZ) < lw / 2 + 3) continue;
      const cxm = lx + lw / 2;
      const czm = lz + lw / 2;
      if (distToCenter(g, cxm, czm) < 14) {
        // central plaza with fountain
        for (let z = lz; z < lz + lw; z++) for (let x = lx; x < lx + lw; x++) t.setTile(x, z, 'plaza');
        continue;
      }
      const kind = rng.next();
      if (kind < 0.18) {
        // small park
        for (let z = lz; z < lz + lw; z++) for (let x = lx; x < lx + lw; x++) t.setTile(x, z, 'grass');
        for (let i = 0; i < 3; i++) {
          const x = rng.int(lx + 2, lx + lw - 3);
          const z = rng.int(lz + 2, lz + lw - 3);
          if (t.areaFree(x, z, 1)) tree(g, x, z, 'plank', 'roof', 3, 0);
        }
        continue;
      }
      if (kind < 0.3) {
        // plaza
        for (let z = lz; z < lz + lw; z++) for (let x = lx; x < lx + lw; x++) t.setTile(x, z, 'plaza');
        continue;
      }
      // 1-4 buildings per lot with alleys between
      const split = rng.chance(0.6);
      const parts = split ? [[lx + 1, lz + 1, lw / 2 - 2, lw - 2], [lx + lw / 2 + 1, lz + 1, lw / 2 - 2, lw - 2]] : [[lx + 1, lz + 1, lw - 2, lw - 2]];
      for (const [x0, z0, w, d] of parts) {
        const h = rng.int(3, 6);
        const ruined = rng.chance(0.3);
        for (let z = Math.floor(z0); z < z0 + d; z++)
          for (let x = Math.floor(x0); x < x0 + w; x++) {
            const edge = x === Math.floor(x0) || z === Math.floor(z0) || x >= x0 + w - 1 || z >= z0 + d - 1;
            if (ruined) {
              if (edge && rng.chance(0.75)) t.column(x, z, rng.int(1, h), rng.chance(0.3) ? 'stone' : 'brick');
              else t.setTile(x, z, 'dirt');
              continue;
            }
            t.column(x, z, h, edge ? 'brick' : 'roof', edge ? -1 : rng.int(0, 1));
          }
        if (!ruined) for (let z = Math.floor(z0); z < z0 + d; z++) for (let x = Math.floor(x0); x < x0 + w; x++) t.addBlock(x, h, z, 'roof');
      }
    }
  // street lamps
  for (let by = 0; by < t.size; by += block)
    for (let bx = 0; bx < t.size; bx += block) {
      const x = bx + road;
      const z = by + road;
      if (!t.isFree(x, z)) continue;
      t.column(x, z, 2, 'stone', 0);
      t.addBlock(x, 2, z, 'lamp', 0, true);
      t.lights.push({ x: x + 0.5, z: z + 0.5, y: 2.5, color: 0xffc66a, intensity: 1.6 });
    }
  // fountain at center
  disk(g, g.c, g.c, 3.2, 'plaza');
  scatterDecor(g, 400 * g.k, [0x4a4a52, 0x5a5048, 0x6a6a72], { size: 0.25, h: 0.12, onTile: ['road', 'cobble'] });
  scatterDecor(g, 300 * g.k, [0x5a8a3a, 0x6a9a44], { size: 0.12, h: 0.3, sway: true, onTile: ['grass', 'cobble'] });
  border(g, 'brick', 3, 6);
  clearCenter(g, 6, 'plaza');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.round(g.c + Math.cos(a) * 4);
    const z = Math.round(g.c + Math.sin(a) * 4);
    t.addBlock(x, 0, z, 'stone', 1, false, 0.5);
  }
  t.addBlock(g.c, 0, g.c, 'lamp', 0, true, 0.7);
  t.lights.push({ x: g.c + 0.5, z: g.c + 0.5, y: 1.5, color: 0x9ad8ff, intensity: 1.4 });
};

// ------------------------------------------------------------------ Ossuary Depths: catacombs
const catacombs: Gen = (g) => {
  const { t, rng } = g;
  const n = t.size;
  fillTiles(g, (x, z) => (fbm(x / 6, z / 6, g.seed) > 0.6 ? 'tile' : 'floor'));
  const solid = new Uint8Array(n * n).fill(1);
  const rooms: { x: number; z: number; w: number; d: number }[] = [];
  rooms.push({ x: g.c - 9, z: g.c - 9, w: 18, d: 18 });
  for (let i = 0; i < 70 * g.k && rooms.length < 26 * g.k; i++) {
    const w = rng.int(9, 18);
    const d = rng.int(9, 18);
    const x = rng.int(5, n - w - 5);
    const z = rng.int(5, n - d - 5);
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && z < r.z + r.d + 3 && z + d + 3 > r.z)) continue;
    rooms.push({ x, z, w, d });
  }
  const carve = (x: number, z: number) => {
    if (x > 3 && z > 3 && x < n - 4 && z < n - 4) solid[z * n + x] = 0;
  };
  for (const r of rooms) for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) carve(x, z);
  // connect rooms: each to nearest previous, plus extra loops
  const corridor = (a: (typeof rooms)[0], b: (typeof rooms)[0], wdt: number) => {
    const ax = Math.floor(a.x + a.w / 2);
    const az = Math.floor(a.z + a.d / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const bz = Math.floor(b.z + b.d / 2);
    const xf = rng.chance(0.5);
    const hx = (z: number, x0: number, x1: number) => {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < wdt; k++) carve(x, z + k);
    };
    const vz = (x: number, z0: number, z1: number) => {
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let k = 0; k < wdt; k++) carve(x + k, z);
    };
    if (xf) {
      hx(az, ax, bx);
      vz(bx, az, bz);
    } else {
      vz(ax, az, bz);
      hx(bz, ax, bx);
    }
  };
  for (let i = 1; i < rooms.length; i++) {
    let best = 0;
    let bd = 1e9;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].z - rooms[j].z);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    corridor(rooms[i], rooms[best], rng.int(3, 4));
  }
  for (let i = 0; i < 10 * g.k; i++) corridor(rng.pick(rooms), rng.pick(rooms), 3);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      if (!solid[z * n + x]) continue;
      // only build walls adjacent to open space; deep rock stays invisible solid
      let nearOpen = false;
      for (let dz = -1; dz <= 1 && !nearOpen; dz++) for (let dx = -1; dx <= 1; dx++) if (z + dz >= 0 && x + dx >= 0 && z + dz < n && x + dx < n && !solid[(z + dz) * n + x + dx]) nearOpen = true;
      if (nearOpen) t.column(x, z, 3, 'wall');
      else {
        t.setCell(x, z, CELL.solid);
        t.addBlock(x, 2, z, 'wall', 0);
      }
    }
  // room features
  for (const r of rooms.slice(1)) {
    const f = rng.next();
    if (f < 0.35) {
      // pillars grid
      for (let z = r.z + 3; z < r.z + r.d - 3; z += 4) for (let x = r.x + 3; x < r.x + r.w - 3; x += 4) t.column(x, z, 3, 'pillar');
    } else if (f < 0.55) {
      // lava pit (hazard)
      const cx = r.x + r.w / 2;
      const cz = r.z + r.d / 2;
      disk(g, cx, cz, Math.min(r.w, r.d) / 2 - 3, 'lava', CELL.hazard);
      t.lights.push({ x: cx, z: cz, y: 1, color: 0xff6a1a, intensity: 2 });
    } else if (f < 0.75) {
      // crypt with coffins
      for (let i = 0; i < 4; i++) {
        const x = rng.int(r.x + 2, r.x + r.w - 4);
        const z = rng.int(r.z + 2, r.z + r.d - 3);
        if (t.isFree(x, z) && t.isFree(x + 1, z)) {
          t.column(x, z, 1, 'coffin');
          t.column(x + 1, z, 1, 'coffin');
        }
      }
    } else {
      for (let i = 0; i < 6; i++) t.setTile(rng.int(r.x, r.x + r.w - 1), rng.int(r.z, r.z + r.d - 1), 'moss');
      rockCluster(g, Math.floor(r.x + r.w / 2), Math.floor(r.z + r.d / 2), 'bone', 4);
    }
    // wall torches at room corners
    for (const [x, z] of [[r.x, r.z], [r.x + r.w - 1, r.z + r.d - 1], [r.x + r.w - 1, r.z], [r.x, r.z + r.d - 1]] as [number, number][]) {
      if (!rng.chance(0.6)) continue;
      t.addBlock(x, 1.3, z, 'torch', 0, true, 0.35);
      t.lights.push({ x: x + 0.5, z: z + 0.5, y: 1.6, color: 0xff9a3a, intensity: 1.8 });
    }
  }
  scatterDecor(g, 500 * g.k, [0xd8d0b8, 0xc8c0a8, 0xe8e0c8], { size: 0.2, h: 0.12, onTile: ['floor', 'tile'] });
  scatterDecor(g, 120 * g.k, [0x5aff9a], { size: 0.1, h: 0.1, glow: true, onTile: ['moss'] });
  border(g, 'wall', 3, 3);
  clearCenter(g, 6, 'tile');
  sealUnreachable(g);
};

// ------------------------------------------------------------------ Emberwaste: volcanic lands
const volcano: Gen = (g) => {
  const { t, rng } = g;
  fillTiles(g, (x, z) => {
    const v = fbm(x / 10, z / 10, g.seed);
    return v > 0.66 ? 'basalt' : v < 0.3 ? 'scorch' : 'ash';
  });
  // lava rivers: ridged noise bands
  for (let z = 0; z < t.size; z++)
    for (let x = 0; x < t.size; x++) {
      const v = fbm(x / 22, z / 22, g.seed + 5);
      const band = Math.abs(v - 0.5);
      if (distToCenter(g, x, z) < 14) continue;
      if (band < 0.02) t.setTile(x, z, 'lava', CELL.liquid);
      else if (band < 0.04) t.setTile(x, z, 'lava', CELL.hazard);
    }
  // basalt bridges across rivers
  for (let i = 0; i < 40 * g.k; i++) {
    const x = rng.int(8, t.size - 8);
    const z = rng.int(8, t.size - 8);
    if (t.tile[t.idx(x, z)] !== t.tileId('lava')) continue;
    const horiz = rng.chance(0.5);
    for (let k = -5; k <= 5; k++) for (let w = 0; w < 3; w++) t.setTile(horiz ? x + k : x + w, horiz ? z + w : z + k, 'basalt', CELL.floor);
  }
  // lava lakes
  for (let i = 0; i < 7 * g.k; i++) {
    const x = rng.int(15, t.size - 15);
    const z = rng.int(15, t.size - 15);
    if (distToCenter(g, x, z) < 22) continue;
    pond(g, x, z, rng.int(3, 6), 'lava', CELL.liquid);
    t.lights.push({ x, z, y: 1, color: 0xff5a0a, intensity: 2.2 });
  }
  // sulfur vents
  blobs(g, 8, 0.78, 11, (x, z) => {
    if (t.isFree(x, z)) t.setTile(x, z, 'sulfur');
  });
  // obsidian spires and basalt boulders
  for (let i = 0; i < 160 * g.k; i++) {
    const x = rng.int(6, t.size - 6);
    const z = rng.int(6, t.size - 6);
    if (!t.areaFree(x, z, 1) || distToCenter(g, x, z) < 9) continue;
    if (rng.chance(0.45)) {
      const h = rng.int(3, 6);
      t.column(x, z, h, 'obsidian');
      if (rng.chance(0.5)) t.column(x + 1, z, h - rng.int(1, 2), 'obsidian');
      if (rng.chance(0.3)) {
        t.addBlock(x, h, z, 'crystal', 0, true, 0.6);
        t.lights.push({ x: x + 0.5, z: z + 0.5, y: h + 0.5, color: 0xff8a3a, intensity: 1.2 });
      }
    } else rockCluster(g, x, z, 'basalt', rng.int(2, 5));
  }
  // giant bones of ancient beasts
  for (let i = 0; i < 6 * g.k; i++) {
    const x = rng.int(20, t.size - 20);
    const z = rng.int(20, t.size - 20);
    if (distToCenter(g, x, z) < 20) continue;
    for (let k = 0; k < 7; k++) {
      if (t.isFree(x + k * 2, z)) t.column(x + k * 2, z, 2 + (k % 2), 'bone');
      if (t.isFree(x + k * 2, z + 4)) t.column(x + k * 2, z + 4, 2 + (k % 2), 'bone');
    }
  }
  scatterDecor(g, 400 * g.k, [0xff6a1a, 0xffaa3a], { size: 0.1, h: 0.1, glow: true, onTile: ['scorch', 'ash'] });
  scatterDecor(g, 500 * g.k, [0x2a2428, 0x3a3236], { size: 0.25, h: 0.15, onTile: ['ash', 'basalt'] });
  border(g, 'obsidian', 3, 5);
  clearCenter(g, 7, 'basalt');
};

// ------------------------------------------------------------------ Frostveil: ice waste
const tundra: Gen = (g) => {
  const { t, rng } = g;
  fillTiles(g, (x, z) => (fbm(x / 8, z / 8, g.seed) > 0.6 ? 'snow2' : 'snow'));
  // frozen lakes (slippery) with open water holes
  blobs(g, 18, 0.62, 4, (x, z, v) => {
    if (distToCenter(g, x, z) < 10) return;
    if (v > 0.78) t.setTile(x, z, 'water', CELL.liquid);
    else t.setTile(x, z, 'ice', CELL.ice);
  });
  // rocky ridges
  blobs(g, 9, 0.76, 13, (x, z) => {
    if (distToCenter(g, x, z) > 12 && t.isFree(x, z)) t.setTile(x, z, 'rock');
  });
  for (let z = 4; z < t.size - 4; z += 3)
    for (let x = 4; x < t.size - 4; x += 3) {
      const dens = fbm(x / 14, z / 14, g.seed + 21);
      if (dens < 0.52 || !rng.chance(0.55)) continue;
      const tx = x + rng.int(0, 1);
      const tz = z + rng.int(0, 1);
      if (!t.areaFree(tx, tz, 1) || distToCenter(g, tx, tz) < 9) continue;
      pine(g, tx, tz, rng.int(4, 6));
      t.spots.push({ x: tx, z: tz });
    }
  // ice crystal formations
  for (let i = 0; i < 40 * g.k; i++) {
    const x = rng.int(6, t.size - 6);
    const z = rng.int(6, t.size - 6);
    if (!t.areaFree(x, z, 1) || distToCenter(g, x, z) < 10) continue;
    t.column(x, z, rng.int(2, 4), 'ice', -1, CELL.solid, false);
    if (rng.chance(0.6)) t.column(x + rng.int(-1, 1), z + 1, rng.int(1, 2), 'ice');
    t.lights.push({ x: x + 0.5, z: z + 0.5, y: 1.5, color: 0x8ad8ff, intensity: 0.8 });
  }
  // snowdrifts (low walls creating passages)
  for (let i = 0; i < 30 * g.k; i++) {
    let x = rng.int(8, t.size - 8);
    let z = rng.int(8, t.size - 8);
    const dir = rng.chance(0.5);
    for (let k = 0; k < rng.int(5, 12); k++) {
      if (t.isFree(x, z) && distToCenter(g, x, z) > 9) t.column(x, z, 1, 'snow');
      if (dir) x++;
      else z++;
      if (rng.chance(0.3)) dir ? (z += rng.int(-1, 1)) : (x += rng.int(-1, 1));
    }
  }
  for (let i = 0; i < 50 * g.k; i++) rockCluster(g, rng.int(6, t.size - 6), rng.int(6, t.size - 6), 'rock', rng.int(1, 4));
  scatterDecor(g, 500 * g.k, [0xffffff, 0xe8f0ff], { size: 0.22, h: 0.12, onTile: ['snow', 'snow2'] });
  scatterDecor(g, 200 * g.k, [0x8a9a7a, 0x7a8a6a], { size: 0.1, h: 0.25, sway: true, onTile: ['snow2', 'rock'] });
  border(g, 'ice', 3, 4);
  clearCenter(g, 7, 'snow');
};

// ------------------------------------------------------------------ Aetherfall: ancient ruins
const ruins: Gen = (g) => {
  const { t, rng } = g;
  fillTiles(g, (x, z) => (fbm(x / 10, z / 10, g.seed) > 0.62 ? 'moss' : 'sand'));
  // marble plazas
  for (let i = 0; i < 14 * g.k; i++) {
    const x = rng.int(15, t.size - 15);
    const z = rng.int(15, t.size - 15);
    const r = rng.int(5, 9);
    disk(g, x, z, r, 'marble');
    // pillar ring
    const k = rng.int(6, 10);
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * (r - 1));
      const pz = Math.round(z + Math.sin(a) * (r - 1));
      if (distToCenter(g, px, pz) < 9 || !t.isFree(px, pz)) continue;
      const broken = rng.chance(0.35);
      const h = broken ? rng.int(1, 2) : rng.int(3, 5);
      t.column(px, pz, h, 'marble');
      if (!broken) t.addBlock(px, h, pz, 'gold', 0);
      if (rng.chance(0.3)) t.addBlock(px, h - 1, pz, 'vine', 0, false, 1.05);
    }
  }
  // rune circles: glowing tiles used by arcane surge event
  for (let i = 0; i < 10 * g.k; i++) {
    const x = rng.int(15, t.size - 15);
    const z = rng.int(15, t.size - 15);
    if (distToCenter(g, x, z) < 12) continue;
    for (let a = 0; a < 32; a++) {
      const cx = Math.round(x + Math.cos((a / 32) * Math.PI * 2) * 3);
      const cz = Math.round(z + Math.sin((a / 32) * Math.PI * 2) * 3);
      if (t.isFree(cx, cz)) t.setTile(cx, cz, 'rune');
    }
    t.setTile(x, z, 'rune');
    t.markers.push({ x: x + 0.5, z: z + 0.5, kind: 'rune' });
    t.lights.push({ x: x + 0.5, z: z + 0.5, y: 1, color: 0x8a6aff, intensity: 1.2 });
  }
  // void chasms (impassable for walkers)
  blobs(g, 16, 0.75, 7, (x, z) => {
    if (distToCenter(g, x, z) > 16 && t.isFree(x, z)) t.setTile(x, z, 'void', CELL.liquid);
  });
  // broken walls with gaps (corridors)
  for (let i = 0; i < 45 * g.k; i++) {
    let x = rng.int(8, t.size - 8);
    let z = rng.int(8, t.size - 8);
    const horiz = rng.chance(0.5);
    const len = rng.int(6, 16);
    for (let k = 0; k < len; k++) {
      if (t.isFree(x, z) && distToCenter(g, x, z) > 10 && !rng.chance(0.15)) t.column(x, z, rng.int(1, 3), 'sandstone');
      if (horiz) x++;
      else z++;
    }
  }
  // crystal clusters & golden statues
  for (let i = 0; i < 30 * g.k; i++) {
    const x = rng.int(6, t.size - 6);
    const z = rng.int(6, t.size - 6);
    if (!t.areaFree(x, z, 1) || distToCenter(g, x, z) < 10) continue;
    if (rng.chance(0.6)) {
      t.column(x, z, rng.int(1, 3), 'crystal', 0, CELL.solid, true);
      t.lights.push({ x: x + 0.5, z: z + 0.5, y: 1.5, color: 0x9a7aff, intensity: 1 });
    } else {
      t.column(x, z, 1, 'marble');
      t.column(x, z, 3, 'gold');
    }
  }
  scatterDecor(g, 500 * g.k, [0x5a8a4a, 0x6a9a54], { size: 0.12, h: 0.3, sway: true, onTile: ['moss', 'sand'] });
  scatterDecor(g, 200 * g.k, [0xb89a6a, 0xd8c8a8], { size: 0.25, h: 0.15, onTile: ['sand', 'marble'] });
  scatterDecor(g, 150 * g.k, [0xb89aff], { size: 0.08, h: 0.08, glow: true, onTile: ['rune', 'void'] });
  border(g, 'sandstone', 3, 4);
  clearCenter(g, 7, 'marble');
};

const GENERATORS: Record<string, Gen> = { forest, city, catacombs, volcano, tundra, ruins };

/** Builds the terrain for a map. Each run uses a new seed so layouts vary. */
export function generateTerrain(map: MapDef, seed: number, opts: { zones?: boolean } = {}): Terrain {
  const t = new Terrain(map.size);
  const g: GenCtx = { t, rng: new Rng(seed), seed: seed % 100000, c: Math.floor(map.size / 2), k: (map.size * map.size) / (160 * 160) };
  // register palette tiles first so ids are stable
  for (const name of Object.keys(map.palette.tiles)) t.tileId(name);
  const gen = GENERATORS[map.generator] ?? forest;
  gen(g);
  if (opts.zones !== false) {
    addZones(g, map.generator);
    sealUnreachable(g);
    // drop markers that ended up walled off
    const keep = t.markers.filter((m) => t.walkableAt(m.x, m.z) || m.kind === 'rune');
    replaceAll(t.markers, keep);
  }
  t.cullHidden();
  return t;
}
