import * as THREE from 'three';
import type { RigPart, V3 } from './shapes';

const tmp = new THREE.Color();

/**
 * Voxel sculpting for creature models: shapes are filled into a fine grid (per bone), then only
 * the exposed faces are emitted, each vertex darkened by ambient occlusion from its neighbours and
 * each voxel given a slight colour variation. The result reads as a dense, soft-lit voxel figure
 * rather than a few large boxes.
 */

type ColorFn = (x: number, y: number, z: number) => number;
type Col = number | ColorFn;

function hash(i: number, j: number, k: number): number {
  const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

const FACES: { n: V3; c: V3[] }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

export class Vox {
  readonly cells = new Map<string, { c: number; g: number }>();

  /** `res`: voxel edge in bone units. */
  constructor(
    readonly bone: string,
    readonly res = 0.7,
  ) {}

  private key(i: number, j: number, k: number) {
    return i + ',' + j + ',' + k;
  }

  private put(i: number, j: number, k: number, c: number, g = 0) {
    this.cells.set(this.key(i, j, k), { c, g });
  }

  has(i: number, j: number, k: number) {
    return this.cells.has(this.key(i, j, k));
  }

  /** Fills every voxel whose centre passes `inside`, painted by `col`. */
  fill(min: V3, max: V3, inside: (x: number, y: number, z: number) => boolean, col: Col, o: { g?: number; carve?: boolean } = {}) {
    const r = this.res;
    for (let i = Math.floor(min[0] / r); i <= Math.ceil(max[0] / r); i++)
      for (let j = Math.floor(min[1] / r); j <= Math.ceil(max[1] / r); j++)
        for (let k = Math.floor(min[2] / r); k <= Math.ceil(max[2] / r); k++) {
          const x = (i + 0.5) * r;
          const y = (j + 0.5) * r;
          const z = (k + 0.5) * r;
          if (!inside(x, y, z)) continue;
          if (o.carve) this.cells.delete(this.key(i, j, k));
          else this.put(i, j, k, typeof col === 'number' ? col : col(x, y, z), o.g ?? 0);
        }
    return this;
  }

  box(a: V3, b: V3, col: Col, o: { g?: number; carve?: boolean } = {}) {
    const min: V3 = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
    const max: V3 = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
    return this.fill(min, max, (x, y, z) => x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2], col, o);
  }

  /** Ellipsoid with centre c and radii r (p > 2 squares it off: 2 = round, 4 = rounded box). */
  blob(c: V3, r: V3, col: Col, o: { g?: number; carve?: boolean; p?: number } = {}) {
    const p = o.p ?? 2;
    return this.fill([c[0] - r[0], c[1] - r[1], c[2] - r[2]], [c[0] + r[0], c[1] + r[1], c[2] + r[2]], (x, y, z) => Math.abs((x - c[0]) / r[0]) ** p + Math.abs((y - c[1]) / r[1]) ** p + Math.abs((z - c[2]) / r[2]) ** p <= 1, col, o);
  }

  /** Vertical rounded column (limbs): radii rx, rz, from y0 to y1, with a taper at the top. */
  col(c: [number, number], y0: number, y1: number, rx: number, rz: number, col: Col, o: { taper?: number; p?: number; g?: number } = {}) {
    const p = o.p ?? 2.6;
    const t = o.taper ?? 1;
    return this.fill([c[0] - rx * Math.max(1, t), Math.min(y0, y1), c[1] - rz * Math.max(1, t)], [c[0] + rx * Math.max(1, t), Math.max(y0, y1), c[1] + rz * Math.max(1, t)], (x, y, z) => {
      const u = (y - Math.min(y0, y1)) / Math.abs(y1 - y0);
      const s = 1 + (t - 1) * u;
      return Math.abs((x - c[0]) / (rx * s)) ** p + Math.abs((z - c[1]) / (rz * s)) ** p <= 1;
    }, col, o);
  }

  /** Builds the part: exposed faces only, per-vertex AO, per-voxel shade jitter. */
  part(o: { jitter?: number } = {}): RigPart {
    const r = this.res;
    const jit = o.jitter ?? 0.07;
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const glow: number[] = [];
    for (const [key, cell] of this.cells) {
      const [i, j, k] = key.split(',').map(Number);
      const m0 = 1 - jit + hash(i, j, k) * jit * 2;
      tmp.setHex(cell.c);
      const cr = tmp.r;
      const cg = tmp.g;
      const cb = tmp.b;
      for (const f of FACES) {
        const [nx, ny, nz] = f.n;
        if (this.has(i + nx, j + ny, k + nz)) continue;
        const face = f.c.map((c) => {
          // ambient occlusion: the two edge neighbours and the corner neighbour in front of this vertex
          const dx = c[0] ? 1 : -1;
          const dy = c[1] ? 1 : -1;
          const dz = c[2] ? 1 : -1;
          const ax: V3 = nx ? [0, dy, 0] : [dx, 0, 0];
          const bx: V3 = nz ? [0, dy, 0] : ny ? [0, 0, dz] : [0, 0, dz];
          const s1 = this.has(i + nx + ax[0], j + ny + ax[1], k + nz + ax[2]) ? 1 : 0;
          const s2 = this.has(i + nx + bx[0], j + ny + bx[1], k + nz + bx[2]) ? 1 : 0;
          const cc = this.has(i + nx + ax[0] + bx[0], j + ny + ax[1] + bx[1], k + nz + ax[2] + bx[2]) ? 1 : 0;
          const occ = s1 && s2 ? 3 : s1 + s2 + cc;
          const top = ny > 0 ? 1.06 : ny < 0 ? 0.72 : 1;
          return { p: [(i + c[0]) * r, (j + c[1]) * r, (k + c[2]) * r], m: m0 * top * (1 - occ * 0.14) };
        });
        for (const q of [0, 1, 2, 0, 2, 3]) {
          const v = face[q];
          pos.push(v.p[0], v.p[1], v.p[2]);
          nor.push(nx, ny, nz);
          const m = cell.g ? 1 : v.m;
          col.push(Math.min(1, cr * m), Math.min(1, cg * m), Math.min(1, cb * m));
          glow.push(cell.g);
        }
      }
    }
    return { b: this.bone, p: [0, 0, 0], d: [1, 1, 1], c: 0xffffff, raw: { pos, nor, col, glow } };
  }
}
