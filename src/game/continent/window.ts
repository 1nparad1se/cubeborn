import { hash2 } from '../../core/Rng';
import { CELL, Terrain, type TreeInst } from '../Terrain';
import { placeBridge, placeProp } from '../../world/props/place';
import { PROPS } from '../../world/props';
import { MAT, SEA, SECTOR, WORLD, isWaterMat, type ContinentData, type WBuilding } from './data';

/**
 * A streamed window of the continent as an ordinary Terrain: WIN×WIN cells starting at world cell
 * (ox, oz). It is filled at the local origin (map-builder style: local cell = world − origin) and
 * then given its origin, so every coordinate method of the Terrain takes world coordinates while
 * the arrays, props, trees and blocks are window-local (the renderer offsets its group by the
 * origin). Heights are the real block heights Y of the frozen tiles (world y = Y).
 */
export const WIN = 512;

/** Ground tile name per tile material (fixed order: tile id = material). */
export const MAT_TILES = [
  'sand_deep', 'sand_shore', 'sand_beach', 'grass', 'grass_forest', 'moss_swamp', 'grass_hills', 'grass_conifer', 'grass_steppe', 'moss_taiga',
  'snow', 'snow_rock', 'ice_glacier', 'stone_waste', 'sand', 'rock_red', 'grass_oasis', 'rock_cliff', 'sand_salt', 'dirt',
  'water_river_3', 'water_lake_4', 'water_sea_4', 'water_swamp_2', 'dirt_road', 'dirt_path',
];

/** Building looks per village (wall, roof, trim materials) and their height. */
const STYLE: Record<string, { wall: string; roof: string; trim: string }> = {
  zelenodol: { wall: 'plank_light', roof: 'roof_red', trim: 'trunk' },
  snezhny: { wall: 'plank_dark', roof: 'snow_roof', trim: 'stone_wall' },
  peschany: { wall: 'sandstone', roof: 'sandstone_roof', trim: 'sandstone_dark' },
};

export interface WindowStats {
  props: number;
  trees: number;
  blocks: number;
  ms: number;
}

/** Builds the window at world origin (ox, oz); the atlases covering it must be loaded. */
export function buildWindow(d: ContinentData, ox: number, oz: number, o: { detail?: boolean } = {}): { t: Terrain; stats: WindowStats } {
  const t0 = performance.now();
  const n = WIN;
  const t = new Terrain(n, true);
  t.tileNames = MAT_TILES.slice();
  // heights and materials with a one-cell border (so vertex heights match across windows)
  const B = n + 2;
  const H = new Float32Array(B * B);
  const M = new Uint8Array(B * B);
  for (let z = 0; z < B; z++)
    for (let x = 0; x < B; x++) {
      const [y, m] = d.atlases.sample(ox + x - 1, oz + z - 1);
      H[z * B + x] = y;
      M[z * B + x] = m;
    }
  // water surface: every water cell takes the bank height reached first (multi-source BFS)
  const lev = new Float32Array(B * B).fill(NaN);
  const q = new Int32Array(B * B);
  let qh = 0;
  let qt = 0;
  for (let z = 0; z < B; z++)
    for (let x = 0; x < B; x++) {
      const i = z * B + x;
      if (!isWaterMat(M[i])) continue;
      if (M[i] === MAT.sea) {
        lev[i] = SEA;
        q[qt++] = i;
        continue;
      }
      let lo = Infinity;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = x + dx;
        const cz = z + dz;
        if (cx < 0 || cz < 0 || cx >= B || cz >= B) continue;
        const j = cz * B + cx;
        if (!isWaterMat(M[j])) lo = Math.min(lo, H[j]);
      }
      if (lo < Infinity) {
        lev[i] = Math.max(H[i] + 0.4, lo - 0.25);
        q[qt++] = i;
      }
    }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % B;
    const z = (i / B) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = x + dx;
      const cz = z + dz;
      if (cx < 0 || cz < 0 || cx >= B || cz >= B) continue;
      const j = cz * B + cx;
      if (!isWaterMat(M[j]) || !Number.isNaN(lev[j])) continue;
      lev[j] = Math.max(H[j] + 0.4, Math.min(lev[i], M[j] === MAT.sea ? SEA : lev[i]));
      q[qt++] = j;
    }
  }
  for (let i = 0; i < B * B; i++) if (isWaterMat(M[i]) && Number.isNaN(lev[i])) lev[i] = H[i] + 0.6;
  // cells
  const surf = new Float32Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const bi = (z + 1) * B + x + 1;
      const i = z * n + x;
      const m = M[bi];
      t.tile[i] = m < MAT_TILES.length ? m : 3;
      if (isWaterMat(m)) {
        t.cell[i] = CELL.liquid;
        // the renderer draws water at elev − 0.62
        t.elev[i] = Math.max(0, Math.floor(lev[bi] + 0.3));
        surf[i] = t.elev[i];
      } else {
        t.elev[i] = Math.max(0, Math.round(H[bi]));
        surf[i] = H[bi];
      }
    }
  t.surf = surf;
  // corners: each vertex is the mean of the dry cells around it (one sheet: no cliffs, the slope
  // limit decides what can be climbed); next to water the bank stays above the water line
  const C = new Float32Array(n * n * 4);
  const vH = new Float32Array((n + 1) * (n + 1));
  for (let vz = 0; vz <= n; vz++)
    for (let vx = 0; vx <= n; vx++) {
      let s = 0;
      let c = 0;
      let rs = 0;
      let rc = 0;
      let wl = -Infinity;
      for (let k = 0; k < 4; k++) {
        const bi = (vz + (k >> 1)) * B + vx + (k & 1);
        if (isWaterMat(M[bi])) wl = Math.max(wl, lev[bi] - 0.62 + 0.25);
        else {
          s += H[bi];
          c++;
          // road beds keep their own smooth grade (the rocky noise beside them does not lift them)
          if (M[bi] === MAT.road || M[bi] === MAT.path) {
            rs += H[bi];
            rc++;
          }
        }
      }
      if (rc) {
        s = rs;
        c = rc;
      }
      vH[vz * (n + 1) + vx] = c ? Math.max(s / c, wl) : wl;
    }
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      for (let k = 0; k < 4; k++) C[i * 4 + k] = vH[(z + (k >> 1)) * (n + 1) + x + (k & 1)];
    }
  t.corner = C;
  t.shadeElev = new Uint8Array(n * n);
  const stats: WindowStats = { props: 0, trees: 0, blocks: 0, ms: 0 };
  // world content in local coordinates
  const inWin = (wx: number, wz: number, pad = 0) => wx >= ox + pad && wz >= oz + pad && wx < ox + n - pad && wz < oz + n - pad;
  for (const v of d.world.villages) {
    if (Math.abs(v.at[0] - (ox + n / 2)) > n / 2 + v.padR || Math.abs(v.at[1] - (oz + n / 2)) > n / 2 + v.padR) continue;
    const st = STYLE[v.id] ?? STYLE.zelenodol;
    for (const b of v.buildings) if (inWin(b.at[0], b.at[1], 2)) stats.blocks += building(t, b, b.at[0] - ox, b.at[1] - oz, st, v.id);
  }
  bridges(d, t, ox, oz);
  if (o.detail !== false) detail(d, t, ox, oz, stats);
  t.ox = ox;
  t.oz = oz;
  stats.ms = performance.now() - t0;
  return { t, stats };
}

/** A village building from blocks: solid footprint, walls with a door side and a gable roof. */
function building(t: Terrain, b: WBuilding, cx: number, cz: number, st: { wall: string; roof: string; trim: string }, village: string): number {
  const n = t.size;
  let [w, d] = b.size;
  if (b.rot % 2) [w, d] = [d, w];
  const x0 = Math.round(cx - w / 2);
  const z0 = Math.round(cz - d / 2);
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  if (x0 < 1 || z0 < 1 || x1 >= n - 1 || z1 >= n - 1) return 0;
  const open = b.type === 'pen' || b.type === 'well' || b.type === 'market';
  // level pad at the mean height
  const cells: number[] = [];
  let sum = 0;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * n + x;
    if (t.cell[i] === CELL.liquid) continue;
    cells.push(i);
    sum += t.centerY(i);
  }
  if (!cells.length) return 0;
  const base = sum / cells.length;
  t.flattenPad(cells, base);
  const y0 = Math.round(base);
  let count = 0;
  const put = (x: number, y: number, z: number, mat: string) => {
    t.addBlock(x, y, z, mat);
    count++;
  };
  if (open) {
    // fenced pen / well ring / market stalls: low posts only, walkable inside
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) continue;
      if (b.type === 'market' && (x + z) % 3) continue;
      const gate = b.type === 'pen' && (x === Math.round(cx) || z === Math.round(cz));
      if (gate) continue;
      put(x, y0, z, b.type === 'well' ? 'stone_wall' : st.trim);
      t.cell[z * n + x] = CELL.solid;
      t.height[z * n + x] = 1;
    }
    if (b.type === 'well') placeProp(t, 'shrine', cx, cz, { ifFree: true });
    return count;
  }
  const tall = b.type === 'watchtower' || b.type === 'guard_post' ? 6 : b.type === 'tavern' || b.type === 'mill' || b.type === 'barn' ? 4 : 3;
  // door: the middle of the side facing rot (0 +z, 1 +x, 2 −z, 3 −x)
  const door = (x: number, z: number) => {
    const r = b.rot & 3;
    const mx = Math.round((x0 + x1) / 2);
    const mz = Math.round((z0 + z1) / 2);
    if (r === 0) return z === z1 && Math.abs(x - mx) <= 0;
    if (r === 1) return x === x1 && Math.abs(z - mz) <= 0;
    if (r === 2) return z === z0 && Math.abs(x - mx) <= 0;
    return x === x0 && Math.abs(z - mz) <= 0;
  };
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * n + x;
    t.cell[i] = CELL.solid;
    t.height[i] = tall + 2;
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) continue;
    const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
    for (let y = 0; y < tall; y++) {
      if (door(x, z) && y < 2) {
        if (y === 0) put(x, y0, z, 'plank_door');
        continue;
      }
      const win = !corner && y === 1 && (x + z) % 3 === 0 && hash2(x, z, 77) > 0.3;
      put(x, y0 + y, z, corner ? st.trim : win ? 'glass_window' : st.wall);
    }
  }
  // gable roof along the longer side, one block overhang
  const alongX = w >= d;
  const span = alongX ? d : w;
  const half = Math.ceil((span + 2) / 2);
  for (let k = 0; k < half; k++) {
    const y = y0 + tall + k;
    if (alongX)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        put(x, y, z0 - 1 + k, st.roof);
        if (z1 + 1 - k !== z0 - 1 + k) put(x, y, z1 + 1 - k, st.roof);
      }
    else
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        put(x0 - 1 + k, y, z, st.roof);
        if (x1 + 1 - k !== x0 - 1 + k) put(x1 + 1 - k, y, z, st.roof);
      }
  }
  // chimney with a lantern glow on taverns and smithies
  if (b.type === 'tavern' || b.type === 'smithy') {
    for (let y = 0; y < half + 2; y++) put(x0 + 1, y0 + tall + y, z0 + 1, 'stone_wall');
    t.lights.push({ x: (b.rot & 1 ? x1 + 1.2 : cx) + 0.5, y: 2.2, z: (b.rot & 1 ? cz : z1 + 1.2) + 0.5, color: 0xffb860, intensity: 1.6, radius: 7, flicker: 0.5, day: 0.15 });
  }
  void village;
  return count;
}

/** Bridges of the routes: a deck prop between the banks of each bridge leg inside the window. */
function bridges(d: ContinentData, t: Terrain, ox: number, oz: number) {
  const n = t.size;
  for (const r of d.feat.routes)
    for (const leg of r.legs) {
      if (leg.mode !== 'bridge' || leg.pts.length < 2) continue;
      const a = leg.pts[0];
      const b = leg.pts[leg.pts.length - 1];
      const ax = Math.floor(a[0] - ox);
      const az = Math.floor(a[1] - oz);
      const bx = Math.floor(b[0] - ox);
      const bz = Math.floor(b[1] - oz);
      if (Math.min(ax, bx) < 2 || Math.min(az, bz) < 2 || Math.max(ax, bx) >= n - 2 || Math.max(az, bz) >= n - 2) continue;
      const len = Math.hypot(bx - ax, bz - az);
      const id = len > 60 ? 'bridge_stone_long' : len > 14 ? 'bridge_wood_long' : 'bridge_wood';
      // a diagonal span is laid as an L of two straight bridges
      if (Math.abs(bx - ax) > 3 && Math.abs(bz - az) > 3) {
        const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
        const mid: [number, number] = alongX ? [bx, az] : [ax, bz];
        placeBridge(t, id, [ax, az], mid, { variant: 0 });
        placeBridge(t, id, mid, [bx, bz], { variant: 0 });
      } else placeBridge(t, id, [ax, az], [bx, bz], { variant: 0 });
    }
}

/** Detail instances (vegetation, rocks, road dressing, camp props) of the sectors under the window. */
function detail(d: ContinentData, t: Terrain, ox: number, oz: number, stats: WindowStats) {
  const n = t.size;
  const s0x = Math.floor(ox / SECTOR);
  const s0z = Math.floor(oz / SECTOR);
  const s1x = Math.floor((ox + n - 1) / SECTOR);
  const s1z = Math.floor((oz + n - 1) / SECTOR);
  for (let sz = s0z; sz <= s1z; sz++)
    for (let sx = s0x; sx <= s1x; sx++)
      d.forSector(sx, sz, (wx, wz, kind, rot, variant, scale) => {
        if (wx < ox || wz < oz || wx >= ox + n || wz >= oz + n || wx >= WORLD || wz >= WORLD) return;
        const x = wx - ox;
        const z = wz - oz;
        const i = z * n + x;
        if (t.cell[i] !== CELL.floor && !(t.cell[i] === CELL.liquid && kind >= 39 && kind <= 42)) return;
        const k = d.kinds[kind];
        if (!k) return;
        if (k.type === 'tree' && k.tree) {
          const tr: TreeInst = { x, z, h: Math.max(3, Math.round(k.tree.h * scale)), kind: k.tree.kind as TreeInst['kind'], leaf: k.tree.leaf, trunk: k.tree.trunk, v: variant };
          if (t.solidCell(x, z, tr.h)) {
            t.trees.push(tr);
            stats.trees++;
          }
          return;
        }
        const id = k.prop ?? k.id;
        const def = PROPS[id];
        if (!def) return;
        const vmax = def.variants ?? 1;
        const small = def.category === 'vegetation' || /^(flowers|grass|fern|mushrooms|reeds|cattail|water_reeds|algae|lily)/.test(id);
        const p = placeProp(t, id, x + 0.5, z + 0.5, { rot, variant: variant % vmax, scale: def.category === 'camps' || def.category === 'stone' && /cave|ruin|temple|castle|tower|statue|obelisk/.test(id) ? undefined : scale, ifFree: true, noCollide: small });
        if (p) stats.props++;
      });
}
