/** Cell kinds on the navigation grid (1 cell = 1 world unit = 1 block). */
export const CELL = {
  floor: 0,
  solid: 1, // blocks walkers, flyers pass
  liquid: 2, // water/lava lake/void: blocks walkers, flyers pass
  hazard: 3, // walkable, damages the player
  ice: 4, // walkable, slippery
  wall: 5, // map border: blocks everything
} as const;

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
  readonly blocks: Block[] = [];
  readonly decor: Decor[] = [];
  readonly lights: TerrainLight[] = [];
  /** Special markers used by events (rune circles etc). */
  readonly markers: { x: number; z: number; kind: string }[] = [];
  tileNames: string[] = [];

  constructor(readonly size: number) {
    this.cell = new Uint8Array(size * size);
    this.tile = new Uint8Array(size * size);
    this.height = new Uint8Array(size * size);
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
    this.blocks.length = 0;
    this.blocks.push(...out);
  }
}
