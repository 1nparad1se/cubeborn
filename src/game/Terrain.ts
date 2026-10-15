import { WALLS } from '../config/walls';
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
  readonly elev: Uint8Array;
  /** Cells the hero can reach from the spawn on foot or with jumps (1), set by the generator. */
  reach: Uint8Array | null = null;
  readonly blocks: Block[] = [];
  readonly decor: Decor[] = [];
  readonly trees: TreeInst[] = [];
  readonly lights: TerrainLight[] = [];
  /** Special markers used by events (rune circles etc). */
  readonly markers: { x: number; z: number; kind: string; sub?: string }[] = [];
  tileNames: string[] = [];

  constructor(readonly size: number) {
    this.cell = new Uint8Array(size * size);
    this.tile = new Uint8Array(size * size);
    this.height = new Uint8Array(size * size);
    this.elev = new Uint8Array(size * size);
  }

  /** Ground elevation of the cell under (x, z), 0 outside the map. */
  elevAt(x: number, z: number): number {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    return this.inBounds(cx, cz) ? this.elev[cz * this.size + cx] : 0;
  }

  /** Ground height (world y) under (x, z): the top of the cell's column. */
  groundY(x: number, z: number): number {
    return this.elevAt(x, z);
  }

  /** Whether a walker standing at height `feet` may move into cell (cx, cz). */
  canEnter(cx: number, cz: number, feet: number, airborne = false): boolean {
    if (this.blocksWalker(cx, cz)) return false;
    return this.elev[cz * this.size + cx] <= feet + (airborne ? STEP.air : STEP.walk);
  }

  /** Ground creatures and paths: neighbouring cells at most one block apart, both ways. */
  stepOk(ax: number, az: number, bx: number, bz: number): boolean {
    if (!this.inBounds(ax, az) || !this.inBounds(bx, bz)) return false;
    return Math.abs(this.elev[az * this.size + ax] - this.elev[bz * this.size + bx]) <= 1;
  }

  idx(cx: number, cz: number): number {
    return cz * this.size + cx;
  }
  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.size && cz < this.size;
  }
  cellAt(x: number, z: number): number {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!this.inBounds(cx, cz)) return CELL.wall;
    return this.cell[cz * this.size + cx];
  }
  blocksWalker(cx: number, cz: number): boolean {
    if (!this.inBounds(cx, cz)) return true;
    const c = this.cell[cz * this.size + cx];
    return c === CELL.solid || c === CELL.liquid || c === CELL.wall;
  }
  blocksFlyer(cx: number, cz: number): boolean {
    if (!this.inBounds(cx, cz)) return true;
    return this.cell[cz * this.size + cx] === CELL.wall;
  }
  /** Cells that stop shots and sight lines (see WALLS): the border and tall solid obstacles. */
  blocksShot(cx: number, cz: number, y = Infinity): boolean {
    if (!this.inBounds(cx, cz)) return true;
    const i = cz * this.size + cx;
    // terrain rising above the shot's height (a hill or cliff face) stops it
    if (this.elev[i] > y) return true;
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
      if (this.blocksShot(cx, cz, y)) return t;
      if (end) return 1;
    }
    return 1;
  }

  /** True when nothing blocks a shot between the points; the target's own cell is ignored. */
  los(x0: number, z0: number, x1: number, z1: number): boolean {
    // sight runs at chest height above the higher of the two ends
    const y = Math.max(this.elevAt(x0, z0), this.elevAt(x1, z1)) + 1.5;
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
