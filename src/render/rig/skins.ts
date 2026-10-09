import * as THREE from 'three';

/**
 * Pixel-art skins for hero rigs, Minecraft style: every textured box ("skin box") owns a
 * Minecraft-like UV region in a per-rig canvas atlas (top/bottom strip above the four side
 * faces), painted procedurally by a painter function, one texel per voxel, NearestFilter.
 *
 * Faces, as seen from outside the box (x grows to the right, y grows downward on every face):
 *  F front (+z), B back (-z), L the +x side (the character's left), R the -x side,
 *  T top (image top = back edge), D bottom (image top = front edge).
 */
export type FaceId = 'F' | 'B' | 'L' | 'R' | 'T' | 'D';

/** Colour as 0xRRGGBB, or -1 for a transparent texel (cut out with alphaTest). */
export type Px = number;
export const CLEAR = -1;

/** A painter fills the six faces of one skin box. */
export type Painter = (f: FaceId, g: Pix) => void;

export interface SkinBox {
  /** Debug name. */
  name: string;
  /** Size in texels (= voxels): width (x), height (y), depth (z). */
  w: number;
  h: number;
  d: number;
  paint: Painter;
}

export function skinBox(name: string, size: [number, number, number], paint: Painter): SkinBox {
  return { name, w: size[0], h: size[1], d: size[2], paint };
}

/**
 * Reference from a rig part to a skin box: the part is a horizontal slice (rows y0..y1 of the
 * side faces, counted from the top) of the box, optionally inflated (armour layers).
 */
export interface SkinRef {
  box: SkinBox;
  y0?: number;
  y1?: number;
  /** Grows the geometry on every side without changing the texture (overlay layers). */
  inf?: number;
  /** Voxels per texel (default 1). */
  px?: number;
}

// ---------------------------------------------------------------- colour helpers

export function shade(c: number, k: number): number {
  if (c < 0) return c;
  const r = Math.max(0, Math.min(255, Math.round(((c >> 16) & 255) * k)));
  const g = Math.max(0, Math.min(255, Math.round(((c >> 8) & 255) * k)));
  const b = Math.max(0, Math.min(255, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Stable hash noise in [0, 1). */
export function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- painting surface

/** One face of a skin box inside the atlas pixel buffer. */
export class Pix {
  constructor(
    readonly w: number,
    readonly h: number,
    private buf: Uint8ClampedArray,
    private stride: number,
    private ox: number,
    private oy: number,
    /** Seed for noise, distinct per face. */
    readonly seed: number,
  ) {}

  set(x: number, y: number, c: Px): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = ((this.oy + y) * this.stride + this.ox + x) * 4;
    if (c < 0) {
      this.buf[i + 3] = 0;
      return this;
    }
    this.buf[i] = (c >> 16) & 255;
    this.buf[i + 1] = (c >> 8) & 255;
    this.buf[i + 2] = c & 255;
    this.buf[i + 3] = 255;
    return this;
  }

  get(x: number, y: number): Px {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR;
    const i = ((this.oy + y) * this.stride + this.ox + x) * 4;
    if (this.buf[i + 3] === 0) return CLEAR;
    return (this.buf[i] << 16) | (this.buf[i + 1] << 8) | this.buf[i + 2];
  }

  /** Fills a rectangle (clipped); negative x/y count from the right/bottom edge. */
  rect(x: number, y: number, w: number, h: number, c: Px) {
    if (x < 0) x += this.w;
    if (y < 0) y += this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  /** Whole face in one colour with a soft pixel noise (`amt` = brightness variation). */
  fill(c: Px, amt = 0.07, salt = 0) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, this.n(c, x, y, amt, salt));
    return this;
  }

  /** Noisy rectangle. */
  nrect(x: number, y: number, w: number, h: number, c: Px, amt = 0.07, salt = 0) {
    if (x < 0) x += this.w;
    if (y < 0) y += this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, this.n(c, x + i, y + j, amt, salt));
    return this;
  }

  /** Colour varied by the face noise at (x, y). */
  n(c: Px, x: number, y: number, amt = 0.07, salt = 0): Px {
    if (c < 0 || amt <= 0) return c;
    const r = hash(x, y, this.seed + salt * 7919);
    // three-step dither like hand painted Minecraft textures
    const k = r < 0.22 ? 1 - amt : r > 0.8 ? 1 + amt * 0.8 : 1;
    return shade(c, k);
  }

  hline(y: number, c: Px, x0 = 0, x1 = this.w) {
    if (y < 0) y += this.h;
    for (let x = x0; x < x1; x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, c: Px, y0 = 0, y1 = this.h) {
    if (x < 0) x += this.w;
    for (let y = y0; y < y1; y++) this.set(x, y, c);
    return this;
  }

  /** One-texel frame around the face. */
  border(c: Px, sides = 'tblr') {
    if (sides.includes('t')) this.hline(0, c);
    if (sides.includes('b')) this.hline(this.h - 1, c);
    if (sides.includes('l')) this.vline(0, c);
    if (sides.includes('r')) this.vline(this.w - 1, c);
    return this;
  }

  /** Darkens (k < 1) or lightens existing texels in a rectangle. */
  tint(x: number, y: number, w: number, h: number, k: number) {
    if (x < 0) x += this.w;
    if (y < 0) y += this.h;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const c = this.get(x + i, y + j);
        if (c >= 0) this.set(x + i, y + j, shade(c, k));
      }
    return this;
  }

  /** Draws rows of characters with a palette ('.' / ' ' = leave as is, '_' = transparent). */
  pattern(x: number, y: number, rows: string[], pal: Record<string, Px>) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        if (ch === '_') this.set(x + i, y + j, CLEAR);
        else if (pal[ch] !== undefined) this.set(x + i, y + j, pal[ch]);
      }
    });
    return this;
  }

  /** Mirrors the left half onto the right half (symmetric fronts). */
  mirrorX() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < Math.floor(this.w / 2); x++) this.set(this.w - 1 - x, y, this.get(x, y));
    return this;
  }

  /** Bottom-darkening gradient (a painted ambient occlusion feel). */
  shadeV(top = 1.06, bottom = 0.82) {
    for (let y = 0; y < this.h; y++) {
      const k = top + ((bottom - top) * y) / Math.max(1, this.h - 1);
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c >= 0) this.set(x, y, shade(c, k));
      }
    }
    return this;
  }
}

// ---------------------------------------------------------------- atlas

export interface AtlasRect {
  x: number;
  y: number;
}

export interface SkinAtlas {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  rects: Map<SkinBox, AtlasRect>;
  /** UV of a pure white texel (untextured parts are tinted by their vertex colour). */
  white: [number, number];
}

/** Region size of a box in the atlas: Minecraft layout plus one texel of padding. */
function regionSize(b: SkinBox): [number, number] {
  return [2 * (b.w + b.d) + 1, b.d + b.h + 1];
}

/**
 * Packs and paints every skin box into one canvas texture (shelf packing, 256 texels wide).
 * The canvas is kept on the texture so a later re-upload works after context loss.
 */
export function buildSkinAtlas(boxes: SkinBox[]): SkinAtlas {
  const W = 256;
  const uniq = [...new Set(boxes)].sort((a, b) => regionSize(b)[1] - regionSize(a)[1]);
  const rects = new Map<SkinBox, AtlasRect>();
  // white block at the origin
  let x = 4;
  let y = 0;
  let rowH = 4;
  for (const b of uniq) {
    const [rw, rh] = regionSize(b);
    if (x + rw > W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    rects.set(b, { x, y });
    x += rw;
    rowH = Math.max(rowH, rh);
  }
  const H = Math.max(16, Math.ceil((y + rowH) / 16) * 16);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const buf = img.data;
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const k = (j * W + i) * 4;
      buf[k] = buf[k + 1] = buf[k + 2] = buf[k + 3] = 255;
    }
  let seed = 11;
  for (const b of uniq) {
    const r = rects.get(b)!;
    const faces: [FaceId, number, number, number, number][] = [
      ['T', r.x + b.d, r.y, b.w, b.d],
      ['D', r.x + b.d + b.w, r.y, b.w, b.d],
      ['R', r.x, r.y + b.d, b.d, b.h],
      ['F', r.x + b.d, r.y + b.d, b.w, b.h],
      ['L', r.x + b.d + b.w, r.y + b.d, b.d, b.h],
      ['B', r.x + 2 * b.d + b.w, r.y + b.d, b.w, b.h],
    ];
    for (const [f, fx, fy, fw, fh] of faces) {
      if (fw <= 0 || fh <= 0) continue;
      b.paint(f, new Pix(fw, fh, buf, W, fx, fy, (seed += 101)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, width: W, height: H, rects, white: [2 / W, 2 / H] };
}

// ---------------------------------------------------------------- geometry

type C3 = [number, number, number];

/**
 * Corners (top-left, top-right, bottom-right, bottom-left as seen from outside) of each face of a
 * box with half sizes (hx, hy, hz), and the face's texel rectangle inside the box region.
 */
function faceQuads(hx: number, hy: number, hz: number, b: SkinBox, y0: number, y1: number): { f: FaceId; c: C3[]; r: [number, number, number, number] }[] {
  const { w, d } = b;
  const hs = y1 - y0;
  return [
    { f: 'F', c: [[-hx, hy, hz], [hx, hy, hz], [hx, -hy, hz], [-hx, -hy, hz]], r: [d, d + y0, w, hs] },
    { f: 'B', c: [[hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, -hz], [hx, -hy, -hz]], r: [2 * d + w, d + y0, w, hs] },
    { f: 'L', c: [[hx, hy, hz], [hx, hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]], r: [d + w, d + y0, d, hs] },
    { f: 'R', c: [[-hx, hy, -hz], [-hx, hy, hz], [-hx, -hy, hz], [-hx, -hy, -hz]], r: [0, d + y0, d, hs] },
    { f: 'T', c: [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]], r: [d, 0, w, d] },
    { f: 'D', c: [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]], r: [d + w, 0, w, d] },
  ];
}

export interface SkinQuad {
  /** Corners TL, TR, BR, BL in part space (before the part rotation / translation). */
  c: C3[];
  /** UVs of the four corners. */
  uv: [number, number][];
}

/** Textured quads of a skin part (box slice) of half sizes (hx, hy, hz). */
export function skinQuads(ref: SkinRef, atlas: SkinAtlas, hx: number, hy: number, hz: number): SkinQuad[] {
  const b = ref.box;
  const rect = atlas.rects.get(b);
  if (!rect) return [];
  const y0 = ref.y0 ?? 0;
  const y1 = ref.y1 ?? b.h;
  // a hair inside the texel edges so nearest sampling never picks the neighbour region
  const e = 0.02;
  return faceQuads(hx, hy, hz, b, y0, y1).map((q) => {
    const [rx, ry, rw, rh] = q.r;
    const u0 = (rect.x + rx + e) / atlas.width;
    const u1 = (rect.x + rx + rw - e) / atlas.width;
    const v0 = (rect.y + ry + e) / atlas.height;
    const v1 = (rect.y + ry + rh - e) / atlas.height;
    return { c: q.c, uv: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] };
  });
}

/** Slice size in voxels of a skin ref (before inflation). */
export function skinSize(ref: SkinRef): C3 {
  const px = ref.px ?? 1;
  const b = ref.box;
  return [b.w * px, ((ref.y1 ?? b.h) - (ref.y0 ?? 0)) * px, b.d * px];
}
