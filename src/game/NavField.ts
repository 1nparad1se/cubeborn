import type { Terrain } from './Terrain';

/**
 * BFS flow field toward the player over walkable cells. Recomputed a few times a second,
 * bounded by a radius around the player. Walkers read a direction per cell.
 */
export class NavField {
  readonly dirX: Float32Array;
  readonly dirZ: Float32Array;
  private dist: Uint16Array;
  private queue: Int32Array;
  private stamp: Uint16Array;
  private curStamp = 0;
  private n: number;
  private timer = 0;

  constructor(private terrain: Terrain, private radius = 48) {
    this.n = terrain.size;
    const cells = this.n * this.n;
    this.dirX = new Float32Array(cells);
    this.dirZ = new Float32Array(cells);
    this.dist = new Uint16Array(cells);
    this.queue = new Int32Array(cells);
    this.stamp = new Uint16Array(cells);
  }

  update(dt: number, px: number, pz: number, force = false) {
    this.timer -= dt;
    if (this.timer > 0 && !force) return;
    this.timer = 0.2;
    this.compute(Math.floor(px), Math.floor(pz));
  }

  /** Whether the cell has valid flow data this generation. */
  has(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= this.n || cz >= this.n) return false;
    return this.stamp[cz * this.n + cx] === this.curStamp;
  }

  private compute(sx: number, sz: number) {
    const n = this.n;
    const t = this.terrain;
    this.curStamp = (this.curStamp + 1) & 0xffff || 1;
    const st = this.curStamp;
    const stamp = this.stamp;
    const dist = this.dist;
    const q = this.queue;
    if (sx < 0 || sz < 0 || sx >= n || sz >= n) return;
    let head = 0;
    let tail = 0;
    const s = sz * n + sx;
    stamp[s] = st;
    dist[s] = 0;
    q[tail++] = s;
    const r = this.radius;
    while (head < tail) {
      const i = q[head++];
      const d = dist[i];
      if (d >= r) continue;
      const x = i % n;
      const z = (i - x) / n;
      // 4-neighbour expansion
      if (x > 0) this.visit(i - 1, x - 1, z, d, st, t, q, tail) && tail++;
      if (x < n - 1) this.visit(i + 1, x + 1, z, d, st, t, q, tail) && tail++;
      if (z > 0) this.visit(i - n, x, z - 1, d, st, t, q, tail) && tail++;
      if (z < n - 1) this.visit(i + n, x, z + 1, d, st, t, q, tail) && tail++;
    }
    // directions: steepest descent among 8 neighbours (diagonals only if both sides open)
    for (let k = 0; k < tail; k++) {
      const i = q[k];
      const x = i % n;
      const z = (i - x) / n;
      let best = dist[i];
      let bx = 0;
      let bz = 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const j = nz * n + nx;
          if (stamp[j] !== st) continue;
          if (dx && dz && (stamp[z * n + nx] !== st || stamp[nz * n + x] !== st)) continue;
          const dd = dist[j] + (dx && dz ? 0.4 : 0);
          if (dd < best) {
            best = dd;
            bx = dx;
            bz = dz;
          }
        }
      const len = Math.hypot(bx, bz) || 1;
      this.dirX[i] = bx / len;
      this.dirZ[i] = bz / len;
    }
  }

  private visit(j: number, x: number, z: number, d: number, st: number, t: Terrain, q: Int32Array, tail: number): boolean {
    if (this.stamp[j] === st) return false;
    if (t.blocksWalker(x, z)) return false;
    this.stamp[j] = st;
    this.dist[j] = d + 1;
    q[tail] = j;
    return true;
  }
}
