/**
 * Uniform grid rebuilt every frame with a counting sort. Zero allocations per frame;
 * queries iterate a flat index array. Items are referenced by integer index.
 */
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  private cellStart: Int32Array;
  private cellCount: Int32Array;
  private items: Int32Array;
  private itemCell: Int32Array;
  private n = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    const cells = this.cols * this.rows;
    this.cellStart = new Int32Array(cells + 1);
    this.cellCount = new Int32Array(cells);
    this.items = new Int32Array(capacity);
    this.itemCell = new Int32Array(capacity);
  }

  private ensure(cap: number) {
    if (cap <= this.items.length) return;
    const n = Math.max(cap, this.items.length * 2);
    this.items = new Int32Array(n);
    this.itemCell = new Int32Array(n);
  }

  cellOf(x: number, z: number): number {
    let cx = Math.floor(x / this.cellSize);
    let cz = Math.floor(z / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cz < 0) cz = 0;
    else if (cz >= this.rows) cz = this.rows - 1;
    return cz * this.cols + cx;
  }

  /** xs/zs indexed by item id; active[i] false items are skipped. */
  rebuild(count: number, xs: ArrayLike<number>, zs: ArrayLike<number>, active: (i: number) => boolean) {
    this.ensure(count);
    this.cellCount.fill(0);
    const cellOfItem = this.itemCell;
    for (let i = 0; i < count; i++) {
      if (!active(i)) {
        cellOfItem[i] = -1;
        continue;
      }
      const c = this.cellOf(xs[i], zs[i]);
      cellOfItem[i] = c;
      this.cellCount[c]++;
    }
    const cells = this.cellCount.length;
    let acc = 0;
    for (let c = 0; c < cells; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
    }
    this.cellStart[cells] = acc;
    this.n = acc;
    // reuse cellCount as write cursor
    for (let c = 0; c < cells; c++) this.cellCount[c] = this.cellStart[c];
    for (let i = 0; i < count; i++) {
      const c = cellOfItem[i];
      if (c < 0) continue;
      this.items[this.cellCount[c]++] = i;
    }
  }

  get size() {
    return this.n;
  }

  /** Calls fn for each item in cells overlapping the circle. Return true from fn to stop early. */
  query(x: number, z: number, r: number, fn: (i: number) => boolean | void): void {
    const cs = this.cellSize;
    let x0 = Math.floor((x - r) / cs);
    let x1 = Math.floor((x + r) / cs);
    let z0 = Math.floor((z - r) / cs);
    let z1 = Math.floor((z + r) / cs);
    if (x0 < 0) x0 = 0;
    if (z0 < 0) z0 = 0;
    if (x1 >= this.cols) x1 = this.cols - 1;
    if (z1 >= this.rows) z1 = this.rows - 1;
    for (let cz = z0; cz <= z1; cz++) {
      const row = cz * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const c = row + cx;
        const end = this.cellStart[c + 1];
        for (let k = this.cellStart[c]; k < end; k++) {
          if (fn(this.items[k])) return;
        }
      }
    }
  }
}
