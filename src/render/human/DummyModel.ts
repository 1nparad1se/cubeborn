import * as THREE from 'three';
import { PX, SkinAtlas, shade, type Paint } from './skinAtlas';

const STRAW = ['#d8b85a', '#cca94c', '#e4c86c'];
const ROPE = '#8a6a3a';
const WOOD = ['#8a5e30', '#7a5228', '#966838'];
const STONE = ['#8e8e94', '#82828a', '#9a9aa0'];
const SACK = ['#c8b48a', '#bca87e', '#d4c096'];

const straw: Paint = (f, x, y) => {
  if (f === 'top' || f === 'bottom') return shade(STRAW, x, y, 3);
  if (y === 2 || y === 7) return ROPE;
  return shade(STRAW, x, y, f.length);
};
const wood: Paint = (f, x, y) => shade(WOOD, x, y, f.length + 5);
const stone: Paint = (f, x, y, w, h) => (f === 'top' && (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#6e6e74' : shade(STONE, x, y, f.length + 9));
const sack: Paint = (f, x, y) => {
  if (f === 'front') {
    // stitched cross eyes and a mouth line
    if (y === 2 && (x === 1 || x === 3) ) return '#3a2a1e';
    if (y === 3 && x === 2) return '#3a2a1e';
    if (y === 2 && (x === 4 || x === 6)) return '#3a2a1e';
    if (y === 3 && x === 5) return '#3a2a1e';
    if (y === 5 && x >= 2 && x <= 4) return '#6a5030';
  }
  if (f === 'top' && (x === 3 || y === 3)) return ROPE;
  return shade(SACK, x, y, f.length + 13);
};

/** Cubic training dummy: stone base, wooden post and crossbar, straw body with rope bands, sack head. */
export class DummyModel {
  readonly root = new THREE.Group();
  /** Tilts from the base on hits. */
  readonly pivot = new THREE.Group();
  private atlas = new SkinAtlas(64);
  private mat: THREE.MeshLambertMaterial;
  private geos: THREE.BufferGeometry[] = [];

  constructor(shadows = true) {
    this.mat = this.atlas.material();
    this.root.add(this.pivot);
    const box = (w: number, h: number, d: number, p: Paint, y: number, x = 0) => {
      const g = this.atlas.box(w, h, d, p);
      this.geos.push(g);
      const m = new THREE.Mesh(g, this.mat);
      m.position.set(x * PX, (y + h / 2) * PX, 0);
      m.castShadow = shadows;
      m.receiveShadow = true;
      return m;
    };
    this.root.add(box(12, 2, 12, stone, 0));
    this.pivot.add(box(2, 11, 2, wood, 2));
    this.pivot.add(box(8, 10, 6, straw, 12));
    this.pivot.add(box(18, 2, 2, wood, 18));
    this.pivot.add(box(7, 7, 7, sack, 22));
    this.pivot.position.y = 2 * PX;
    for (const c of this.pivot.children) c.position.y -= 2 * PX;
  }

  /** Hit wobble: `k` 0..1 fading, (dx, dz) the push direction. */
  wobble(k: number, dx: number, dz: number, time: number) {
    const a = Math.sin(k * Math.PI * 4 + time * 0) * k * 0.22;
    this.pivot.rotation.set(dz * a, 0, -dx * a);
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mat.dispose();
    this.atlas.dispose();
  }
}
