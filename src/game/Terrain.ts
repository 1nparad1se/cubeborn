import { WALLS } from '../config/walls';
import type { PropInstance } from '../world/props/types';
/** Replaces an array's contents in place (spread arguments overflow the stack on big maps). */
export function replaceAll<T>(arr: T[], items: T[]) {
  arr.length = items.length;
  for (let i = 0; i < items.length; i++) arr[i] = items[i];
}

/** Cell kinds on the navigation grid (1 cell = 1 world unit = 1 block). */
export const CELL = {
  floor: 0,
  solid: 1, // blocks walkers, flyers pass
  liquid: 2, // water/lava lake/void: blocks walkers, flyers pass
  hazard: 3, // walkable, damages the player
  ice: 4, // walkable, slippery
  wall: 5, // map border: blocks everything
} as const;

/** Height limits for walkers (world units): a step taken on foot, and a ledge caught mid-jump. */
export const STEP = {
  walk: 1.01,
  /** Added to the feet height while airborne: the 1.35 jump apex reaches two-block ledges. */
  air: 0.8,
};

/**
 * Continuous ground: walkers follow the sloped surface (see Terrain.buildSurface). A slope steeper
 * than `maxTan` (rise per unit run, ~40°) cannot be climbed; a sudden rise taller than `lip` is a
 * wall (cliff, rock face); a drop taller than `fall` is a fall.
 */
export const SLOPE = {
  maxTan: Math.tan((40 * Math.PI) / 180),
  lip: 0.45,
  fall: 0.6,
};

export interface Block {
  x: number;
  y: number;
  z: number;
  mat: string;
  /** Variant index into the material color list. */
  v: number;
  /** Optional size (defaults to a full block). */
  s?: number;
  glow?: boolean;
  /** Part of a natural rock pile: drawn as an irregular boulder, not a cube. */
  rock?: boolean;
}

/** A tree drawn as a rounded model; only its trunk cell collides. */
export interface TreeInst {
  x: number;
  z: number;
  h: number;
  kind: 'oak' | 'pine' | 'mushroom' | 'acacia' | 'palm' | 'cactus' | 'dead' | 'willow';
  leaf: string;
  trunk: string;
  v: number;
}

export interface Decor {
  x: number;
  z: number;
  y: number;
  size: number;
  color: number;
  /** Sways in the wind. */
  sway?: boolean;
  h?: number;
  glow?: boolean;
}

export interface TerrainLight {
  x: number;
  z: number;
  y: number;
  color: number;
  intensity: number;
  /** Reach in world units (default: the renderer's torch radius). */
  radius?: number;
  /** Flicker strength 0..1 (default 1, torch-like). */
  flicker?: number;
  /** Intensity multiplier by day (default 1). */
  day?: number;
}

export class Terrain {
  readonly cell: Uint8Array;
  readonly tile: Uint8Array;
  /** Column height used for block culling and visuals. */
  readonly height: Uint8Array;
  /**
   * Ground elevation in whole blocks (0 = the lowest floor). Every cell can be raised: walkers
   * step up and down one block at a time, jump up two, and fall off anything taller (see STEP).
   */
  readonly elev: Uint8Array | Uint16Array;
  /**
   * World position of cell (0, 0): streamed worlds keep a window of cells around the hero and move
   * it (see game/continent). Every coordinate method takes WORLD coordinates and subtracts this;
   * index-based methods (centerY(i), passable(i, j), ...) and the arrays are window-local.
   * Map builders run with the origin at 0, so their local cells are world cells.
   */
  ox = 0;
  oz = 0;
  /** Optional per-cell shade elevation for the ground shader (0..15 scale, snow/rock looks). */
  shadeElev: Uint8Array | null = null;
  /** Cells the hero can reach from the spawn on foot or with jumps (1), set by the generator. */
  reach: Uint8Array | null = null;
  readonly blocks: Block[] = [];
  readonly decor: Decor[] = [];
  readonly trees: TreeInst[] = [];
  readonly lights: TerrainLight[] = [];
  /** World props placed by the map (src/world/props): drawn by the prop renderer. */
  readonly props: PropInstance[] = [];
  /**
   * Cells covered by a walkable prop deck (bridge, boardwalk, stairs): the original ground
   * (cell kind and elevation) under it. `cell`/`elev` hold the walking surface; the renderer draws
   * the ground (water, chasm) from these originals.
   */
  readonly under = new Map<number, { cell: number; elev: number }>();
  /** Special markers used by events (rune circles etc). */
  readonly markers: { x: number; z: number; kind: string; sub?: string }[] = [];
  tileNames: string[] = [];
  /**
   * Sloped ground: four corner heights per cell (k = dx + 2 * dz from the cell's min corner),
   * null until buildSurface. Corners are shared with linked neighbours (no gaps); across a cliff
   * (elevation tiers two or more apart, or a shore) they differ and the renderer draws a rock face.
   */
  corner: Float32Array | null = null;
  /** Smoothed centre height per cell (the field the corners are made from). */
  surf: Float32Array | null = null;
  /** Walkable deck corners (bridges, stairs, platforms): the deck surface, set by placeProp. */
  readonly deckC = new Map<number, Float32Array>();

  constructor(readonly size: number, tall = false) {
    this.cell = new Uint8Array(size * size);
    this.tile = new Uint8Array(size * size);
    this.height = new Uint8Array(size * size);
    this.elev = tall ? new Uint16Array(size * size) : new Uint8Array(size * size);
  }

  /** Window-local cell tests (no origin shift). */
  inLocal(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.size && cz < this.size;
  }
  blocksLocal(cx: number, cz: number): boolean {
    if (!this.inLocal(cx, cz)) return true;
    const c = this.cell[cz * this.size + cx];
    return c === CELL.solid || c === CELL.liquid || c === CELL.wall;
  }

  /** Ground elevation of the cell under (x, z), 0 outside the map. */
  elevAt(x: number, z: number): number {
    const cx = Math.floor(x - this.ox);
    const cz = Math.floor(z - this.oz);
    return this.inLocal(cx, cz) ? this.elev[cz * this.size + cx] : 0;
  }

  /** The four walking-surface corners of cell i (deck if any, else ground), or null before buildSurface. */
  private cornersOf(i: number): Float32Array | null {
    const d = this.deckC.get(i);
    if (d) return d;
    return this.corner ? this.corner.subarray(i * 4, i * 4 + 4) : null;
  }

  /** Ground height (world y) under (x, z): the sloped surface (bilinear in the cell's corners). */
  groundY(x: number, z: number): number {
    return this.groundL(x - this.ox, z - this.oz);
  }
  private groundL(x: number, z: number): number {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!this.inLocal(cx, cz)) return 0;
    const i = cz * this.size + cx;
    const c = this.cornersOf(i);
    if (!c) return this.elev[i];
    const fx = x - cx;
    const fz = z - cz;
    const a = c[0] + (c[1] - c[0]) * fx;
    const b = c[2] + (c[3] - c[2]) * fx;
    return a + (b - a) * fz;
  }

  /** Surface gradient (dy/dx, dy/dz) at (x, z). */
  slopeAt(x: number, z: number): [number, number] {
    return this.slopeL(x - this.ox, z - this.oz);
  }
  private slopeL(x: number, z: number): [number, number] {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!this.inLocal(cx, cz)) return [0, 0];
    const c = this.cornersOf(cz * this.size + cx);
    if (!c) return [0, 0];
    const fx = x - cx;
    const fz = z - cz;
    return [(c[1] - c[0]) * (1 - fz) + (c[3] - c[2]) * fz, (c[2] - c[0]) * (1 - fx) + (c[3] - c[1]) * fx];
  }

  /** Height of the walking surface at the centre of cell i. */
  centerY(i: number): number {
    const c = this.cornersOf(i);
    return c ? (c[0] + c[1] + c[2] + c[3]) * 0.25 : this.elev[i];
  }

  /** Lowest / highest corner of cell i (props sit on the lowest, shots stop at the highest). */
  minCorner(i: number): number {
    const c = this.cornersOf(i);
    return c ? Math.min(c[0], c[1], c[2], c[3]) : this.elev[i];
  }
  maxCorner(i: number): number {
    const c = this.cornersOf(i);
    return c ? Math.max(c[0], c[1], c[2], c[3]) : this.elev[i];
  }

  /**
   * Whether a walker with feet at `feet` may move from (x0, z0) to (x1, z1) (a short step): the
   * cell is walkable, a rise is no taller than SLOPE.lip and the slope there no steeper than
   * SLOPE.maxTan; while airborne, anything up to STEP.air above the feet. Drops are always allowed.
   */
  canWalk(x0: number, z0: number, x1: number, z1: number, feet: number, airborne = false): boolean {
    x0 -= this.ox;
    x1 -= this.ox;
    z0 -= this.oz;
    z1 -= this.oz;
    const cx = Math.floor(x1);
    const cz = Math.floor(z1);
    if (this.blocksLocal(cx, cz)) return false;
    const g = this.groundL(x1, z1);
    if (airborne) return g <= feet + STEP.air;
    const rise = g - feet;
    if (rise <= 0.02) return true;
    if (rise > SLOPE.lip) return false;
    if (this.deckC.has(cz * this.size + cx)) return true;
    // climbing: the slope at the new spot must be walkable
    const [gx, gz] = this.slopeL(x1, z1);
    const dx = x1 - x0;
    const dz = z1 - z0;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return true;
    // steepest gradient decides; moving across a slope (no rise along the way) stays allowed
    const along = (gx * dx + gz * dz) / l;
    return along <= 0.02 || Math.hypot(gx, gz) <= SLOPE.maxTan;
  }

  /** Whether a walker standing at height `feet` may move into cell (cx, cz) (cell-level check). */
  canEnter(cx: number, cz: number, feet: number, airborne = false): boolean {
    cx -= this.ox;
    cz -= this.oz;
    if (this.blocksLocal(cx, cz)) return false;
    return this.centerY(cz * this.size + cx) <= feet + (airborne ? STEP.air : SLOPE.lip + SLOPE.maxTan * 0.5);
  }

  /**
   * Neighbouring cells i and j (side or diagonal) joined by walkable ground both ways: neither
   * blocks walkers, no rock face between them, and the slope between their centres is walkable.
   */
  passable(i: number, j: number): boolean {
    const n = this.size;
    const ax = i % n;
    const az = (i / n) | 0;
    const bx = j % n;
    const bz = (j / n) | 0;
    if (this.blocksLocal(ax, az) || this.blocksLocal(bx, bz)) return false;
    const dx = bx - ax;
    const dz = bz - az;
    const ha = this.centerY(i);
    const hb = this.centerY(j);
    const dist = dx && dz ? Math.SQRT2 : 1;
    const deck = this.deckC.has(i) || this.deckC.has(j);
    if (Math.abs(ha - hb) > (deck ? 1.05 : SLOPE.maxTan * dist + 0.04)) return false;
    const ca = this.cornersOf(i);
    const cb = this.cornersOf(j);
    if (!ca || !cb) return Math.abs(this.elev[i] - this.elev[j]) <= 1;
    // the shared edge (or corner) must meet without a step
    const k = (x: number, z: number) => x + 2 * z;
    if (dx && dz) {
      const vx = dx > 0 ? 1 : 0;
      const vz = dz > 0 ? 1 : 0;
      return Math.abs(ca[k(vx, vz)] - cb[k(1 - vx, 1 - vz)]) <= SLOPE.lip;
    }
    if (dx) {
      const ea = dx > 0 ? 1 : 0;
      const eb = 1 - ea;
      return Math.abs(ca[k(ea, 0)] + ca[k(ea, 1)] - cb[k(eb, 0)] - cb[k(eb, 1)]) * 0.5 <= SLOPE.lip;
    }
    const ea = dz > 0 ? 1 : 0;
    const eb = 1 - ea;
    return Math.abs(ca[k(0, ea)] + ca[k(1, ea)] - cb[k(0, eb)] - cb[k(1, eb)]) * 0.5 <= SLOPE.lip;
  }

  /** Ground creatures and paths: neighbouring cells joined by walkable ground (see passable). */
  stepOk(ax: number, az: number, bx: number, bz: number): boolean {
    ax -= this.ox;
    bx -= this.ox;
    az -= this.oz;
    bz -= this.oz;
    if (!this.inLocal(ax, az) || !this.inLocal(bx, bz)) return false;
    if (ax === bx && az === bz) return true;
    if (Math.abs(ax - bx) > 1 || Math.abs(az - bz) > 1) return false;
    return this.passable(az * this.size + ax, bz * this.size + bx);
  }

  /** Cells reachable on foot from (sx, sz) over walkable ground (both ways), for t.reach. */
  computeReach(sx: number, sz: number): Uint8Array {
    const n = this.size;
    const seen = new Uint8Array(n * n);
    const q = new Int32Array(n * n);
    let qh = 0;
    let qt = 0;
    const s = Math.floor(sz - this.oz) * n + Math.floor(sx - this.ox);
    seen[s] = 1;
    q[qt++] = s;
    while (qh < qt) {
      const i = q[qh++];
      const x = i % n;
      const z = (i / n) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const j = nz * n + nx;
        if (seen[j] || !this.passable(i, j) || !this.passable(j, i)) continue;
        seen[j] = 1;
        q[qt++] = j;
      }
    }
    return seen;
  }

  /** Ground cell kind and tier (the original ground under a deck). */
  private groundKind(i: number): number {
    return this.under.get(i)?.cell ?? this.cell[i];
  }
  private groundElev(i: number): number {
    return this.under.get(i)?.elev ?? this.elev[i];
  }
  /** Two cells whose ground joins smoothly: both dry, elevation tiers at most one apart. */
  linked(i: number, j: number): boolean {
    if (this.groundKind(i) === CELL.liquid || this.groundKind(j) === CELL.liquid) return false;
    return Math.abs(this.groundElev(i) - this.groundElev(j)) <= 1;
  }

  /**
   * Turns the block tiers in `elev` into a continuous sloped surface: the heights are smoothed
   * over linked cells only (tiers one block apart melt into slopes, taller steps stay cliffs and
   * water keeps its flat bed), then each cell corner takes the mean of the linked cells around it.
   * `relief` (optional, per cell) adds gentle undulation before smoothing. Call once the
   * elevations and water are final and BEFORE placing props.
   */
  buildSurface(o: { iters?: number; relief?: Float32Array } = {}) {
    const n = this.size;
    let s = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) s[i] = this.groundElev(i) + (o.relief && this.groundKind(i) !== CELL.liquid ? o.relief[i] : 0);
    // neighbour links (8 directions) computed once
    const links = new Uint8Array(n * n);
    const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        let m = 0;
        D8.forEach(([dx, dz], k) => {
          const cx = x + dx;
          const cz = z + dz;
          if (cx >= 0 && cz >= 0 && cx < n && cz < n && this.linked(i, cz * n + cx)) m |= 1 << k;
        });
        links[i] = m;
      }
    let t2 = new Float32Array(n * n);
    const iters = o.iters ?? 7;
    for (let it = 0; it < iters; it++) {
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          const i = z * n + x;
          const m = links[i];
          let sum = s[i] * 2;
          let w = 2;
          if (m)
            for (let k = 0; k < 8; k++)
              if (m & (1 << k)) {
                const ww = k < 4 ? 1 : 0.7;
                sum += s[(z + D8[k][1]) * n + x + D8[k][0]] * ww;
                w += ww;
              }
          t2[i] = sum / w;
        }
      [s, t2] = [t2, s];
    }
    // water stays flat at its own level; its banks never dip below the water
    for (let i = 0; i < n * n; i++) if (this.groundKind(i) === CELL.liquid) s[i] = this.groundElev(i);
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if (this.groundKind(i) === CELL.liquid) continue;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const cx = x + dx;
            const cz = z + dz;
            if (cx < 0 || cz < 0 || cx >= n || cz >= n) continue;
            const j = cz * n + cx;
            if (this.groundKind(j) === CELL.liquid) s[i] = Math.max(s[i], this.groundElev(j) - 0.3);
          }
      }
    this.surf = s;
    this.corner = new Float32Array(n * n * 4);
    this.recomputeCorners(0, 0, n - 1, n - 1);
  }

  /** Recomputes the corners of cells x0..x1, z0..z1 from `surf` (after cells changed kind). */
  recomputeCorners(x0: number, z0: number, x1: number, z1: number) {
    const s = this.surf;
    const C = this.corner;
    if (!s || !C) return;
    const n = this.size;
    const ids = [0, 0, 0, 0];
    const par = [0, 1, 2, 3];
    const find = (a: number): number => (par[a] === a ? a : (par[a] = find(par[a])));
    for (let vz = Math.max(0, z0); vz <= Math.min(n, z1 + 1); vz++)
      for (let vx = Math.max(0, x0); vx <= Math.min(n, x1 + 1); vx++) {
        // the cells around the vertex: 0 (-,-), 1 (+,-), 2 (-,+), 3 (+,+); their corner k = 3 - slot
        for (let k = 0; k < 4; k++) {
          const cx = vx - 1 + (k & 1);
          const cz = vz - 1 + (k >> 1);
          ids[k] = cx >= 0 && cz >= 0 && cx < n && cz < n ? cz * n + cx : -1;
          par[k] = k;
        }
        for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2]]) {
          if (ids[a] < 0 || ids[b] < 0 || !this.linked(ids[a], ids[b])) continue;
          par[find(a)] = find(b);
        }
        for (let k = 0; k < 4; k++) {
          if (ids[k] < 0) continue;
          const r = find(k);
          let sum = 0;
          let cnt = 0;
          for (let j = 0; j < 4; j++)
            if (ids[j] >= 0 && find(j) === r) {
              sum += s[ids[j]];
              cnt++;
            }
          C[ids[k] * 4 + (3 - k)] = sum / cnt;
        }
      }
  }

  /**
   * Sets the surface at vertex (vx, vz) to h for every cell around it that shares the vertex with
   * cell `ref` (the same smooth sheet), keeping the ground continuous. Used to flatten pads.
   */
  setVertex(vx: number, vz: number, h: number, ref: number) {
    const C = this.corner;
    if (!C) return;
    const n = this.size;
    const rx = ref % n;
    const rz = (ref / n) | 0;
    const old = C[ref * 4 + (vx - rx) + 2 * (vz - rz)];
    for (let k = 0; k < 4; k++) {
      const cx = vx - 1 + (k & 1);
      const cz = vz - 1 + (k >> 1);
      if (cx < 0 || cz < 0 || cx >= n || cz >= n) continue;
      const i = cz * n + cx;
      const ci = i * 4 + (3 - k);
      if (Math.abs(C[ci] - old) < 1e-4) C[ci] = h;
    }
  }

  /** Flattens the ground under cells (a building, camp or bridge footprint) to height h. */
  flattenPad(cells: number[], h: number) {
    if (!this.corner) return;
    const n = this.size;
    for (const i of cells) {
      const x = i % n;
      const z = (i / n) | 0;
      if (this.groundKind(i) === CELL.liquid) continue;
      for (let k = 0; k < 4; k++) this.setVertex(x + (k & 1), z + (k >> 1), h, i);
      if (this.surf) this.surf[i] = h;
    }
  }

  /**
   * Walking surface of deck cells (bridges, stairs, platforms) near (x0..x1, z0..z1): each corner
   * meets the bank ground where the deck touches it, otherwise the mean of the decks around it, so
   * stairs read as ramps and bridges join their banks without a step. `deckY` holds deck heights.
   */
  readonly deckY = new Map<number, number>();
  rebuildDecks(x0: number, z0: number, x1: number, z1: number) {
    const n = this.size;
    for (let cz = Math.max(0, z0); cz <= Math.min(n - 1, z1); cz++)
      for (let cx = Math.max(0, x0); cx <= Math.min(n - 1, x1); cx++) {
        const i = cz * n + cx;
        const h = this.deckY.get(i);
        if (h === undefined) continue;
        const out = new Float32Array(4);
        for (let k = 0; k < 4; k++) {
          const vx = cx + (k & 1);
          const vz = cz + (k >> 1);
          let land = 0;
          let ln = 0;
          let dk = 0;
          let dn = 0;
          for (let j = 0; j < 4; j++) {
            const ax = vx - 1 + (j & 1);
            const az = vz - 1 + (j >> 1);
            if (ax < 0 || az < 0 || ax >= n || az >= n) continue;
            const a = az * n + ax;
            const dh = this.deckY.get(a);
            if (dh !== undefined) {
              if (Math.abs(dh - h) <= 1.05) {
                dk += dh;
                dn++;
              }
              continue;
            }
            if (this.blocksLocal(ax, az) || !this.corner) continue;
            const g = this.corner[a * 4 + (3 - j)];
            if (Math.abs(g - h) <= 0.75) {
              land += g;
              ln++;
            }
          }
          out[k] = ln ? land / ln : dn ? dk / dn : h;
        }
        this.deckC.set(i, out);
      }
  }

  idx(cx: number, cz: number): number {
    return (cz - this.oz) * this.size + cx - this.ox;
  }
  inBounds(cx: number, cz: number): boolean {
    return this.inLocal(cx - this.ox, cz - this.oz);
  }
  cellAt(x: number, z: number): number {
    const cx = Math.floor(x - this.ox);
    const cz = Math.floor(z - this.oz);
    if (!this.inLocal(cx, cz)) return CELL.wall;
    return this.cell[cz * this.size + cx];
  }
  blocksWalker(cx: number, cz: number): boolean {
    return this.blocksLocal(cx - this.ox, cz - this.oz);
  }
  blocksFlyer(cx: number, cz: number): boolean {
    cx -= this.ox;
    cz -= this.oz;
    if (!this.inLocal(cx, cz)) return true;
    return this.cell[cz * this.size + cx] === CELL.wall;
  }
  /** Cells that stop shots and sight lines (see WALLS): the border and tall solid obstacles. */
  blocksShot(cx: number, cz: number, y = Infinity): boolean {
    return this.shotL(cx - this.ox, cz - this.oz, y);
  }
  private shotL(cx: number, cz: number, y: number): boolean {
    if (!this.inLocal(cx, cz)) return true;
    const i = cz * this.size + cx;
    // terrain rising above the shot's height (a hill or cliff face) stops it
    if ((this.corner ? this.maxCorner(i) : this.elev[i]) > y) return true;
    const c = this.cell[i];
    if (c === CELL.wall) return true;
    if (c !== CELL.solid) return false;
    const h = this.height[i];
    return h === 0 || h >= WALLS.minHeight;
  }

  /**
   * Walks the grid from (x0,z0) to (x1,z1) and returns the fraction of the segment travelled
   * before entering the first shot-blocking cell (1 = clear). The start cell never blocks, so
   * shooters standing or hovering in an obstacle cell can still fire out of it.
   */
  shotRay(x0: number, z0: number, x1: number, z1: number, ignoreEnd = false, y = Infinity): number {
    x0 -= this.ox;
    x1 -= this.ox;
    z0 -= this.oz;
    z1 -= this.oz;
    let cx = Math.floor(x0);
    let cz = Math.floor(z0);
    const ex = Math.floor(x1);
    const ez = Math.floor(z1);
    if (cx === ex && cz === ez) return 1;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity;
    let tmz = dz !== 0 ? (dz > 0 ? cz + 1 - z0 : z0 - cz) * tdz : Infinity;
    for (let n = 0; n < 512; n++) {
      let t: number;
      if (tmx < tmz) {
        t = tmx;
        tmx += tdx;
        cx += stepX;
      } else {
        t = tmz;
        tmz += tdz;
        cz += stepZ;
      }
      if (t > 1) return 1;
      const end = cx === ex && cz === ez;
      if (end && ignoreEnd) return 1;
      if (this.shotL(cx, cz, y)) return t;
      if (end) return 1;
    }
    return 1;
  }

  /** True when nothing blocks a shot between the points; the target's own cell is ignored. */
  los(x0: number, z0: number, x1: number, z1: number): boolean {
    // sight runs at chest height above the higher of the two ends
    const y = Math.max(this.groundY(x0, z0), this.groundY(x1, z1)) + 1.5;
    return this.shotRay(x0, z0, x1, z1, true, y) >= 1;
  }

  walkableAt(x: number, z: number): boolean {
    return !this.blocksWalker(Math.floor(x), Math.floor(z));
  }

  tileId(name: string): number {
    let i = this.tileNames.indexOf(name);
    if (i < 0) {
      i = this.tileNames.length;
      this.tileNames.push(name);
    }
    return i;
  }
  setTile(cx: number, cz: number, name: string, cell?: number) {
    if (!this.inBounds(cx, cz)) return;
    const i = this.idx(cx, cz);
    if (this.cell[i] === CELL.wall) return;
    this.tile[i] = this.tileId(name);
    if (cell !== undefined) this.cell[i] = cell;
  }
  setCell(cx: number, cz: number, cell: number) {
    if (!this.inBounds(cx, cz)) return;
    const i = this.idx(cx, cz);
    if (this.cell[i] === CELL.wall) return;
    this.cell[i] = cell;
  }

  /** Raises a solid column of blocks. */
  column(cx: number, cz: number, h: number, mat: string, v = -1, cell: number = CELL.solid, glow = false) {
    if (!this.inBounds(cx, cz)) return;
    const i = this.idx(cx, cz);
    if (this.cell[i] === CELL.wall && cell !== CELL.wall) return;
    this.cell[i] = cell;
    this.height[i] = Math.max(this.height[i], h);
    for (let y = 0; y < h; y++) this.blocks.push({ x: cx, y, z: cz, mat, v: v < 0 ? (cx * 7 + cz * 13 + y * 3) & 7 : v, glow });
  }

  /** Marks a solid cell of the given height without drawing blocks (trees draw their own model). */
  solidCell(cx: number, cz: number, h: number) {
    if (!this.inBounds(cx, cz)) return false;
    const i = this.idx(cx, cz);
    if (this.cell[i] === CELL.wall) return false;
    this.cell[i] = CELL.solid;
    this.height[i] = Math.max(this.height[i], h);
    return true;
  }

  /** Adds a non-colliding block (canopy, roofs overhang, ornaments). */
  addBlock(x: number, y: number, z: number, mat: string, v = -1, glow = false, s?: number) {
    this.blocks.push({ x, y, z, mat, v: v < 0 ? ((x * 5 + z * 11 + y * 7) | 0) & 7 : v, glow, s });
  }

  isFree(cx: number, cz: number): boolean {
    return this.inBounds(cx, cz) && this.cell[this.idx(cx, cz)] === CELL.floor;
  }

  areaFree(cx: number, cz: number, r: number): boolean {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) if (!this.isFree(x, z)) return false;
    return true;
  }

  /**
   * Removes blocks hidden on all four sides by taller neighbours (keeps tops).
   * Dramatically lowers instance counts for buildings and catacomb walls.
   */
  cullHidden() {
    const occupied = new Set<number>();
    const key = (x: number, y: number, z: number) => (y * this.size + z) * this.size + x;
    for (const b of this.blocks) if (!b.s) occupied.add(key(b.x, b.y, b.z));
    const out: Block[] = [];
    for (const b of this.blocks) {
      if (b.s || b.glow) {
        out.push(b);
        continue;
      }
      const top = !occupied.has(key(b.x, b.y + 1, b.z));
      const hidden =
        !top &&
        occupied.has(key(b.x + 1, b.y, b.z)) &&
        occupied.has(key(b.x - 1, b.y, b.z)) &&
        occupied.has(key(b.x, b.y, b.z + 1)) &&
        occupied.has(key(b.x, b.y, b.z - 1));
      // blocks facing away from the camera (camera looks toward -z) are rarely seen
      if (!hidden) out.push(b);
    }
    replaceAll(this.blocks, out);
  }
}
