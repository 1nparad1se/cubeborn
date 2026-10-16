import { SLOPE, type Terrain } from '../Terrain';

/**
 * Click-to-move pathfinding: A* over terrain cells (8 directions, no corner cutting), then
 * string-pulled into a few straight legs so the hero walks smoothly around obstacles.
 */

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

let gScore = new Float32Array(0);
let came = new Int32Array(0);
let stamp = new Uint32Array(0);
let closed = new Uint32Array(0);
let gen = 0;

/** Binary min-heap keyed by f. */
class Heap {
  ids: number[] = [];
  fs: number[] = [];
  push(id: number, f: number) {
    const a = this.ids;
    const b = this.fs;
    let i = a.length;
    a.push(id);
    b.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (b[p] <= f) break;
      a[i] = a[p];
      b[i] = b[p];
      i = p;
    }
    a[i] = id;
    b[i] = f;
  }
  pop(): number {
    const a = this.ids;
    const b = this.fs;
    const top = a[0];
    const lastId = a.pop()!;
    const lastF = b.pop()!;
    const n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && b[r] < b[l] ? r : l;
        if (b[c] >= lastF) break;
        a[i] = a[c];
        b[i] = b[c];
        i = c;
      }
      a[i] = lastId;
      b[i] = lastF;
    }
    return top;
  }
  get size() {
    return this.ids.length;
  }
}

// Everything below works in window-local cells (t.ox / t.oz subtracted by the exported wrappers).
function walkable(t: Terrain, cx: number, cz: number): boolean {
  return !t.blocksLocal(cx, cz);
}

/**
 * Moving from cell `from` (index) into (cx, cz): walkable ground joins them (a slope no steeper
 * than the walking limit, no rock face), or the step drops off a ledge (falls are fine).
 */
function enter(t: Terrain, from: number, cx: number, cz: number): boolean {
  if (!walkable(t, cx, cz)) return false;
  const j = cz * t.size + cx;
  if (j === from) return true;
  const fx = from % t.size;
  const fz = (from / t.size) | 0;
  if (Math.abs(fx - cx) > 1 || Math.abs(fz - cz) > 1) return false;
  if (t.passable(from, j)) return true;
  return t.centerY(j) < t.centerY(from) - SLOPE.lip;
}

/** True when a body of radius r can walk straight from a to b. */
export function clearLine(t: Terrain, ax: number, az: number, bx: number, bz: number, r = 0.35): boolean {
  return clearLineL(t, ax - t.ox, az - t.oz, bx - t.ox, bz - t.oz, r);
}
function clearLineL(t: Terrain, ax: number, az: number, bx: number, bz: number, r = 0.35): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / 0.25));
  const nx = d > 0 ? -(bz - az) / d : 0;
  const nz = d > 0 ? (bx - ax) / d : 0;
  const n = t.size;
  // each side of the body tracks the cell it is in
  let ca = Math.floor(az + nz * r) * n + Math.floor(ax + nx * r);
  let cb = Math.floor(az - nz * r) * n + Math.floor(ax - nx * r);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = ax + (bx - ax) * u;
    const z = az + (bz - az) * u;
    const x1 = Math.floor(x + nx * r);
    const z1 = Math.floor(z + nz * r);
    const x2 = Math.floor(x - nx * r);
    const z2 = Math.floor(z - nz * r);
    if (!t.inLocal(x1, z1) || !t.inLocal(x2, z2)) return false;
    if (!enter(t, ca, x1, z1) || !enter(t, cb, x2, z2)) return false;
    ca = z1 * n + x1;
    cb = z2 * n + x2;
  }
  return true;
}

/** Nearest walkable cell centre to (x, z) within a few cells, or null. */
export function nearestWalkable(t: Terrain, x: number, z: number, maxR = 5): [number, number] | null {
  const r = nearestL(t, x - t.ox, z - t.oz, maxR);
  return r ? [r[0] + t.ox, r[1] + t.oz] : null;
}
function nearestL(t: Terrain, x: number, z: number, maxR = 5): [number, number] | null {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (walkable(t, cx, cz)) return [x, z];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (!walkable(t, cx + dx, cz + dz)) continue;
        const px = cx + dx + 0.5;
        const pz = cz + dz + 0.5;
        const d = (px - x) ** 2 + (pz - z) ** 2;
        if (d < bd) {
          bd = d;
          best = [px, pz];
        }
      }
    if (best) return best;
  }
  return null;
}

/**
 * Path from (sx, sz) to (tx, tz) as a flat [x0, z0, x1, z1, ...] list of waypoints (start
 * excluded). Empty when the goal is unreachable within the search budget; then the closest
 * explored cell is used so the hero still walks toward the click.
 */
export function findPath(t: Terrain, sx: number, sz: number, tx: number, tz: number, budget = 6000): number[] {
  const out = findPathL(t, sx - t.ox, sz - t.oz, tx - t.ox, tz - t.oz, budget);
  for (let i = 0; i < out.length; i += 2) {
    out[i] += t.ox;
    out[i + 1] += t.oz;
  }
  return out;
}
function findPathL(t: Terrain, sx: number, sz: number, tx: number, tz: number, budget: number): number[] {
  const goal = nearestL(t, tx, tz);
  if (!goal) return [];
  [tx, tz] = goal;
  if (clearLineL(t, sx, sz, tx, tz)) return [tx, tz];
  const n = t.size * t.size;
  if (gScore.length !== n) {
    gScore = new Float32Array(n);
    came = new Int32Array(n);
    stamp = new Uint32Array(n);
    closed = new Uint32Array(n);
    gen = 0;
  }
  gen++;
  const size = t.size;
  const s = Math.floor(sz) * size + Math.floor(sx);
  const gcx = Math.floor(tx);
  const gcz = Math.floor(tz);
  const g = gcz * size + gcx;
  const h = (id: number) => {
    const dx = Math.abs((id % size) - gcx);
    const dz = Math.abs(((id / size) | 0) - gcz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const open = new Heap();
  stamp[s] = gen;
  gScore[s] = 0;
  came[s] = -1;
  open.push(s, h(s));
  let best = s;
  let bestH = h(s);
  let found = false;
  let iter = 0;
  while (open.size && iter++ < budget) {
    const cur = open.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === g) {
      found = true;
      break;
    }
    const ch = h(cur);
    if (ch < bestH) {
      bestH = ch;
      best = cur;
    }
    const cx = cur % size;
    const cz = (cur / size) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k];
      const nz = cz + DZ[k];
      const here = cur;
      if (!enter(t, here, nx, nz)) continue;
      // no squeezing diagonally past a corner
      if (k >= 4 && (!enter(t, here, cx + DX[k], cz) || !enter(t, here, cx, cz + DZ[k]))) continue;
      const id = nz * size + nx;
      if (closed[id] === gen) continue;
      const ng = gScore[cur] + COST[k];
      if (stamp[id] === gen && ng >= gScore[id]) continue;
      stamp[id] = gen;
      gScore[id] = ng;
      came[id] = cur;
      open.push(id, ng + h(id));
    }
  }
  const end = found ? g : best;
  const cells: number[] = [];
  for (let c = end; c !== -1 && c !== s; c = came[c]) cells.push(c);
  cells.reverse();
  const pts: number[] = [];
  for (const c of cells) pts.push((c % size) + 0.5, ((c / size) | 0) + 0.5);
  if (found) {
    pts[pts.length - 2] = tx;
    pts[pts.length - 1] = tz;
  }
  // string pulling: skip waypoints while the straight line stays clear
  const out: number[] = [];
  let ax = sx;
  let az = sz;
  let i = 0;
  while (i < pts.length / 2) {
    let j = pts.length / 2 - 1;
    while (j > i && !clearLineL(t, ax, az, pts[j * 2], pts[j * 2 + 1])) j--;
    out.push(pts[j * 2], pts[j * 2 + 1]);
    ax = pts[j * 2];
    az = pts[j * 2 + 1];
    i = j + 1;
  }
  return out;
}
