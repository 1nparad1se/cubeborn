import { hash2 } from '../../../core/Rng';

/** Geometry and field helpers for the continent generator. */

/** Distance from (x, z) to the polyline and the parameter t (0..1 along its length) of the nearest point. */
export function polyDist(pts: [number, number][], x: number, z: number): { d: number; t: number } {
  let best = Infinity;
  let bestT = 0;
  let acc = 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const dx = bx - ax;
    const dz = bz - az;
    const L2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const px = ax + dx * u;
    const pz = az + dz * u;
    const d = Math.hypot(x - px, z - pz);
    const L = Math.sqrt(L2);
    if (d < best) {
      best = d;
      bestT = (acc + u * L) / (total || 1);
    }
    acc += L;
  }
  return { d: best, t: bestT };
}

/** Bounding box of a polyline grown by m. */
export function polyBox(pts: [number, number][], m: number): [number, number, number, number] {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return [Math.floor(x0 - m), Math.floor(z0 - m), Math.ceil(x1 + m), Math.ceil(z1 + m)];
}

/** Resamples a polyline into points about `step` apart, with a small fixed-seed meander. */
export function resample(pts: [number, number][], step: number, wiggle = 0, seed = 1): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / step));
    const nx = -(bz - az) / (L || 1);
    const nz = (bx - ax) / (L || 1);
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const w = wiggle ? (vnoise1((out.length + 1) * 0.18, seed) - 0.5) * 2 * wiggle * Math.sin(Math.PI * Math.min(1, Math.min(u, 1 - u) * 4 + (i > 1 && i < pts.length - 1 ? 1 : 0))) : 0;
      out.push([ax + (bx - ax) * u + nx * w, az + (bz - az) * u + nz * w]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function vnoise1(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return hash2(i, 0, seed) * (1 - s) + hash2(i + 1, 0, seed) * s;
}

/**
 * Coarse value-noise field (one sample per `res` cells, bilinear in between) — much cheaper than
 * per-cell fractal noise on a 2048² world.
 */
export class Field {
  readonly n: number;
  readonly v: Float32Array;
  constructor(readonly size: number, readonly res: number, fn: (x: number, z: number) => number) {
    this.n = Math.ceil(size / res) + 2;
    this.v = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) this.v[j * this.n + i] = fn(i * res, j * res);
  }
  at(x: number, z: number): number {
    const fx = x / this.res;
    const fz = z / this.res;
    const i = Math.max(0, Math.min(this.n - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.n - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i));
    const w = Math.min(1, Math.max(0, fz - j));
    const n = this.n;
    const a = this.v[j * n + i];
    const b = this.v[j * n + i + 1];
    const c = this.v[(j + 1) * n + i];
    const d = this.v[(j + 1) * n + i + 1];
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
}

/** Value noise with several octaves (used to fill coarse fields). */
export function fractal(x: number, z: number, seed: number, oct = 3): number {
  let s = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    s += vn(x * f, z * f, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

function vn(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** Binary min-heap of node indices keyed by a float priority. */
export class Heap {
  private idx: Int32Array;
  private pri: Float32Array;
  size = 0;
  constructor(cap: number) {
    this.idx = new Int32Array(cap);
    this.pri = new Float32Array(cap);
  }
  push(i: number, p: number) {
    if (this.size >= this.idx.length) {
      const ni = new Int32Array(this.idx.length * 2);
      const np = new Float32Array(this.idx.length * 2);
      ni.set(this.idx);
      np.set(this.pri);
      this.idx = ni;
      this.pri = np;
    }
    let k = this.size++;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.idx[k] = this.idx[parent];
      this.pri[k] = this.pri[parent];
      k = parent;
    }
    this.idx[k] = i;
    this.pri[k] = p;
  }
  pop(): number {
    const top = this.idx[0];
    const li = this.idx[--this.size];
    const lp = this.pri[this.size];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lp) break;
      this.idx[k] = this.idx[c];
      this.pri[k] = this.pri[c];
      k = c;
    }
    this.idx[k] = li;
    this.pri[k] = lp;
    return top;
  }
}

/**
 * A* on a coarse grid of side n with per-node costs (Infinity = blocked); 8-neighbour moves.
 * Returns node indices from start to goal, or null.
 */
export function astar(n: number, cost: Float32Array, start: number, goal: number): number[] | null {
  const g = new Float32Array(n * n).fill(Infinity);
  const from = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const heap = new Heap(4096);
  const gx = goal % n;
  const gz = (goal / n) | 0;
  const hfn = (i: number) => {
    const dx = Math.abs((i % n) - gx);
    const dz = Math.abs(((i / n) | 0) - gz);
    return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * 1;
  };
  g[start] = 0;
  heap.push(start, hfn(start));
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
  while (heap.size) {
    const i = heap.pop();
    if (i === goal) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % n;
    const z = (i / n) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k];
      const nz = z + DZ[k];
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const j = nz * n + nx;
      if (closed[j]) continue;
      const c = cost[j];
      if (!Number.isFinite(c)) continue;
      // no diagonal corner cutting through blocked nodes
      if (k >= 4 && (!Number.isFinite(cost[z * n + nx]) || !Number.isFinite(cost[nz * n + x]))) continue;
      const ng = g[i] + c * (k >= 4 ? 1.414 : 1);
      if (ng < g[j]) {
        g[j] = ng;
        from[j] = i;
        heap.push(j, ng + hfn(j));
      }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path: number[] = [];
  for (let i = goal; i >= 0; i = from[i]) {
    path.push(i);
    if (i === start) break;
  }
  return path.reverse();
}

/** Chaikin smoothing of a polyline (keeps the end points). */
export function chaikin(pts: [number, number][], iters = 2): [number, number][] {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    if (p.length < 3) return p;
    const out: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}
