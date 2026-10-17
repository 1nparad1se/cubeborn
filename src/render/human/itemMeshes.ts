import * as THREE from 'three';
import { SPR_BOW, SPR_BOW_DRAWN, SPR_SPEAR, SPR_STAFF1H, SPR_STAFF2H, SPR_SWORD, SPR_SWORD2H, SPR_XBOW, SPR_XBOW_EMPTY, shieldFace, type Sprite } from './sprites';
import type { WeaponKind } from '../../rpg/items';
import { PX } from './skinAtlas';

/** World size of one item pixel (held items are drawn finer than the body, like Minecraft). */
export const ITEM_PX = 0.035;

const col = new THREE.Color();

/**
 * Extrudes a sprite into a one-pixel-thick block model (flat Minecraft item). The pixel at
 * (gx, gy) — the grip — ends up at the origin; sprite x → +X, sprite up → +Y, thickness along Z.
 */
export function extrudeSprite(s: Sprite, gx: number, gy: number, px = ITEM_PX, depth = 1): THREE.BufferGeometry {
  const { n } = s;
  const pos: number[] = [];
  const nor: number[] = [];
  const cols: number[] = [];
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && !!s.px[y * n + x];
  const quad = (a: number[], b: number[], c: number[], d: number[], nn: number[], shade: number) => {
    for (const v of [a, b, c, a, c, d]) {
      pos.push(v[0], v[1], v[2]);
      nor.push(nn[0], nn[1], nn[2]);
      cols.push(col.r * shade, col.g * shade, col.b * shade);
    }
  };
  const hz = (depth * px) / 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const c = s.px[y * n + x];
      if (!c) continue;
      col.set(c).convertSRGBToLinear();
      const x0 = (x - gx - 0.5) * px;
      const x1 = x0 + px;
      const y1 = (gy - y + 0.5) * px;
      const y0 = y1 - px;
      quad([x0, y0, hz], [x1, y0, hz], [x1, y1, hz], [x0, y1, hz], [0, 0, 1], 1);
      quad([x1, y0, -hz], [x0, y0, -hz], [x0, y1, -hz], [x1, y1, -hz], [0, 0, -1], 0.92);
      if (!filled(x + 1, y)) quad([x1, y0, hz], [x1, y0, -hz], [x1, y1, -hz], [x1, y1, hz], [1, 0, 0], 0.8);
      if (!filled(x - 1, y)) quad([x0, y0, -hz], [x0, y0, hz], [x0, y1, hz], [x0, y1, -hz], [-1, 0, 0], 0.8);
      if (!filled(x, y - 1)) quad([x0, y1, hz], [x1, y1, hz], [x1, y1, -hz], [x0, y1, -hz], [0, 1, 0], 1.05);
      if (!filled(x, y + 1)) quad([x0, y0, -hz], [x1, y0, -hz], [x1, y0, hz], [x0, y0, hz], [0, -1, 0], 0.7);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeBoundingSphere();
  return g;
}

let itemMat: THREE.MeshLambertMaterial | null = null;
export function itemMaterial(): THREE.MeshLambertMaterial {
  return (itemMat ??= new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/** Grip pixel of each diagonal sprite (where the hand closes). */
const DIAG: Record<string, { s: Sprite; g: [number, number] }> = {
  sword1h: { s: SPR_SWORD, g: [3, 12] },
  sword2h: { s: SPR_SWORD2H, g: [4, 19] },
  spear: { s: SPR_SPEAR, g: [10, 19] },
  staff1h: { s: SPR_STAFF1H, g: [3, 12] },
  staff2h: { s: SPR_STAFF2H, g: [7, 18] },
};

function meshOf(geo: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geo, itemMaterial());
  m.castShadow = true;
  return m;
}

/**
 * Held weapon model. The returned group has the grip at its origin with the business end along
 * +Y and the flat side facing ±X (so it can be laid into a hand). Bows and crossbows carry two
 * states each (bow: rest/drawn, crossbow: loaded/empty) switched with `setState`.
 */
export interface WeaponModel {
  root: THREE.Group;
  setState(k: 'rest' | 'drawn' | 'loaded' | 'empty'): void;
  dispose(): void;
}

export function weaponModel(kind: WeaponKind): WeaponModel {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry) => {
    geos.push(geo);
    const m = meshOf(geo);
    root.add(m);
    return m;
  };
  let setState: WeaponModel['setState'] = () => {};
  const d = DIAG[kind];
  if (d) {
    // diagonal sprite: turn the bottom-left → top-right diagonal onto +Y, flat side to ±X
    const m = add(extrudeSprite(d.s, d.g[0], d.g[1]));
    m.rotation.order = 'YZX';
    m.rotation.set(0, Math.PI / 2, Math.PI / 4);
  } else if (kind === 'bow') {
    // vertical bow: grip at the middle of the limb; forward (the arrow tip) is -X in the sprite
    const rest = add(extrudeSprite(SPR_BOW, 6, 10));
    const drawn = add(extrudeSprite(SPR_BOW_DRAWN, 6, 10));
    for (const m of [rest, drawn]) m.rotation.set(0, Math.PI / 2, 0);
    drawn.visible = false;
    setState = (k) => {
      rest.visible = k !== 'drawn';
      drawn.visible = k === 'drawn';
    };
  } else if (kind === 'crossbow') {
    const loaded = add(extrudeSprite(SPR_XBOW, 12, 11, ITEM_PX, 3));
    const empty = add(extrudeSprite(SPR_XBOW_EMPTY, 12, 11, ITEM_PX, 3));
    for (const m of [loaded, empty]) m.rotation.set(0, Math.PI / 2, 0);
    empty.visible = false;
    setState = (k) => {
      loaded.visible = k !== 'empty';
      empty.visible = k === 'empty';
    };
  }
  return {
    root,
    setState,
    dispose: () => geos.forEach((g) => g.dispose()),
  };
}

/** The shield: a 10 × 12 × 1 px board (body pixels) with the plank face on the front and back. */
export function shieldModel(): { root: THREE.Group; dispose(): void } {
  const W = 10;
  const H = 12;
  const s: Sprite = { n: 12, px: [] };
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) s.px.push(x < W ? shieldFace(x, y, W, H) : '');
  const geo = extrudeSprite(s, (W - 1) / 2, (H - 1) / 2, PX, 1.2);
  const root = new THREE.Group();
  const m = meshOf(geo);
  root.add(m);
  return { root, dispose: () => geo.dispose() };
}

// ---------------------------------------------------------------- projectiles

/** Arrow / bolt model pointing along +Z (shaft, iron tip, fletching). */
export function arrowModel(bolt: boolean): THREE.BufferGeometry {
  const n = 16;
  const px: string[] = new Array(n * n).fill('');
  const y = 8;
  const len = bolt ? 11 : 14;
  const x0 = Math.round((n - len) / 2);
  for (let x = x0; x < x0 + len; x++) px[y * n + x] = x >= x0 + len - 2 ? '#d8dce4' : bolt ? '#5a3e22' : '#a8763e';
  const fl = bolt ? '#4070c0' : '#e8e4e0';
  px[(y - 1) * n + x0] = fl;
  px[(y + 1) * n + x0] = fl;
  px[(y - 1) * n + x0 + 1] = fl;
  px[(y + 1) * n + x0 + 1] = fl;
  px[(y - 1) * n + x0 + len - 2] = '#9a9ea8';
  px[(y + 1) * n + x0 + len - 2] = '#9a9ea8';
  const g = extrudeSprite({ n, px }, n / 2, y, 0.04);
  // sprite +X → +Z, and a second copy turned 90° so the arrow reads from every side
  const a = g.clone().rotateY(-Math.PI / 2);
  const b = g.clone().rotateY(-Math.PI / 2).rotateZ(Math.PI / 2);
  g.dispose();
  const merged = mergeGeos([a, b]);
  a.dispose();
  b.dispose();
  return merged;
}

export function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const cols: number[] = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.getAttribute('position').array as Float32Array));
    nor.push(...(ng.getAttribute('normal').array as Float32Array));
    const c = ng.getAttribute('color');
    if (c) cols.push(...(c.array as Float32Array));
    else for (let i = 0; i < ng.getAttribute('position').count; i++) cols.push(1, 1, 1);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  out.computeBoundingSphere();
  return out;
}
