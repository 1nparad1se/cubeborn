import * as THREE from 'three';
import type { VoxBox, VoxelModel } from '../data/types';

/**
 * Pixel-art skins for creatures (enemies, bosses, summons), in the style of blocky
 * dungeon-crawler mobs: every box face gets its own hand-made-looking pixel texture
 * (fur, cloth, bone, stone with cracks, metal plates, magma veins...) and the head's
 * front face gets a painted pixel face (eyes, brows, mouth, teeth).
 *
 * Models are authored in "pixel units" (16 per world unit at scale 1/16) and the atlas
 * uses one texel per unit, so pixel size stays consistent across mobs like in the
 * reference games. Glow is stored in the texture alpha (alpha 0 = fully emissive) so
 * eyes, veins and runes light up inside a single texture.
 *
 * The atlas is built lazily per model (WeakMap cache) and shared by all instances of it.
 */

export type SkinMat =
  | 'plain' | 'skin' | 'cloth' | 'fur' | 'bone' | 'stone' | 'metal' | 'copper' | 'wood' | 'bark'
  | 'leaf' | 'chitin' | 'slime' | 'crystal' | 'ice' | 'magma' | 'glow' | 'gold' | 'mush' | 'ghost'
  | 'void' | 'scale' | 'snow' | 'leather';

export type FaceStyle =
  | 'zombie' | 'skull' | 'illager' | 'hood' | 'beast' | 'snout' | 'slime' | 'golem' | 'ghost'
  | 'cyclops' | 'spider' | 'insect' | 'visor' | 'imp' | 'cute' | 'bat' | 'treant' | 'none';

export type Decal =
  | 'ribs' | 'vest' | 'core' | 'rune' | 'belly' | 'shell' | 'stripe' | 'buttons' | 'gem' | 'plate'
  | 'cross' | 'spots' | 'trim' | 'gear' | 'planks' | 'eyespot' | 'mouth' | 'rag' | 'bands' | 'claws';

export interface FaceSpec {
  style: FaceStyle;
  /** Eye colour (bright saturated colours glow). */
  eye?: number;
  /** Secondary colour: hood interior, snout, teeth, socket... */
  alt?: number;
  /** Shift the eye row (pixels, + = down). */
  dy?: number;
  /** Force eye glow on/off (default: glow when the colour is bright). */
  glow?: boolean;
}

export interface BoxPaint {
  mat?: SkinMat;
  /** Horizontal colour bands on the side faces, from the box bottom: [height in units, colour, material]. */
  bands?: [number, number, SkinMat?][];
  /** Hair/hood/cap: top face + top rows of the side faces (+ most of the back). */
  hair?: { color: number; rows: number; mat?: SkinMat; back?: boolean };
  face?: FaceSpec;
  front?: Decal;
  back?: Decal;
  side?: Decal;
  top?: Decal;
  /** Colour of decals / veins / runes. */
  accent?: number;
  /** Extra emissive amount for the whole box (0..1). */
  glow?: number;
  seed?: number;
}

/** Per-model animation amplitudes for the shader-driven walk cycle. */
export interface Gait {
  /** Leg swing (rad). */
  leg: number;
  /** Arm swing (rad). */
  arm: number;
  /** Wing flap (rad). */
  wing: number;
  /** Tail sway (rad). */
  tail: number;
  /** Step bounce (world units). */
  bob: number;
  /** Side-to-side waddle (rad). */
  roll: number;
  /** Squash and stretch hop (slimes), 0..0.4. */
  hop: number;
  /** Jaw opening (rad). */
  jaw: number;
  /** Head nod (rad). */
  head: number;
}

export interface SkinSpec {
  /** Paint per box (same index as model.boxes). */
  paints: (BoxPaint | undefined)[];
  gait?: Partial<Gait>;
  /** Pivot overrides per tag (model units). */
  pivots?: Record<string, [number, number, number]>;
  /** Texels per model unit (default 1). */
  px?: number;
}

export type SkinnedModel = VoxelModel & { skin: SkinSpec };

export function skinOf(m: VoxelModel | undefined): SkinSpec | undefined {
  return (m as Partial<SkinnedModel> | undefined)?.skin;
}

export const DEFAULT_GAIT: Gait = { leg: 0.62, arm: 0.5, wing: 0.75, tail: 0.35, bob: 0.05, roll: 0.06, hop: 0, jaw: 0.35, head: 0.05 };

// ---------------------------------------------------------------- colour helpers

const R = (c: number) => (c >> 16) & 255;
const G = (c: number) => (c >> 8) & 255;
const B = (c: number) => c & 255;
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const rgb = (r: number, g: number, b: number) => (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);
export function shade(c: number, k: number): number {
  return rgb(R(c) * k, G(c) * k, B(c) * k);
}
export function mix(a: number, b: number, t: number): number {
  return rgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
}
/** Very bright saturated colours are emissive (same rule as the voxel geometry). */
export function isGlowColor(c: number): boolean {
  const max = Math.max(R(c), G(c), B(c));
  const min = Math.min(R(c), G(c), B(c));
  return max > 235 && max - min > 100;
}

function hash(x: number, y: number, s: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
/** Smooth value noise in [0,1]. */
function noise(x: number, y: number, s: number, scale: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ---------------------------------------------------------------- face images

/** RGBA face image, y = 0 is the TOP row. Alpha encodes glow (255 = none, 0 = full). */
class Img {
  readonly d: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint8Array(w * h * 4);
  }
  set(x: number, y: number, c: number, glow = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = R(c);
    this.d[i + 1] = G(c);
    this.d[i + 2] = B(c);
    this.d[i + 3] = 255 - Math.round(Math.max(0, Math.min(1, glow)) * 255);
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const i = (y * this.w + x) * 4;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  glowAt(x: number, y: number): number {
    return 1 - this.d[(y * this.w + x) * 4 + 3] / 255;
  }
  mul(x: number, y: number, k: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.set(x, y, shade(this.get(x, y), k), this.glowAt(x, y));
  }
  rect(x0: number, y0: number, w: number, h: number, c: number, glow = 0) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, glow);
  }
}

// face indices: 0 +x, 1 -x, 2 +y (top), 3 -y (bottom), 4 +z (front), 5 -z (back)
const FRONT = 4;
const BACK = 5;
const TOP = 2;
const BOTTOM = 3;

/** Face size in model units for box b and face f. */
export function faceDims(b: VoxBox, f: number): [number, number] {
  const w = b[3];
  const h = b[4];
  const d = b[5];
  if (f === 0 || f === 1) return [d, h];
  if (f === 2 || f === 3) return [w, d];
  return [w, h];
}

// ---------------------------------------------------------------- materials

function matPixel(mat: SkinMat, c: number, x: number, y: number, W: number, H: number, f: number, s: number, accent: number): [number, number] {
  const h1 = hash(x, y, s);
  const side = f !== TOP && f !== BOTTOM;
  switch (mat) {
    case 'plain':
      return [shade(c, 0.97 + h1 * 0.06), 0];
    case 'skin': {
      let k = 0.95 + hash(x >> 1, y >> 1, s + 3) * 0.08;
      if (h1 > 0.9) k *= 0.92;
      return [shade(c, k), 0];
    }
    case 'cloth':
    case 'leather': {
      let k = 0.93 + h1 * 0.08;
      if (side && (x + (s | 0)) % 4 === 0) k *= 0.93;
      if (mat === 'cloth' && (x + y) & 1) k *= 0.98;
      if (mat === 'leather' && h1 > 0.93) k *= 1.12;
      return [shade(c, k), 0];
    }
    case 'fur': {
      const off = Math.floor(hash(x, 0, s) * 4);
      let k = 0.86 + hash(x, (y + off) >> 1, s + 1) * 0.2;
      if (h1 > 0.94) k *= 1.1;
      return [shade(c, k), 0];
    }
    case 'bone': {
      let k = 0.95 + hash(x >> 1, y >> 1, s) * 0.08;
      if (h1 > 0.93) k = 0.8;
      return [shade(c, k), 0];
    }
    case 'stone':
    case 'snow': {
      let k = 0.86 + hash(x >> 1, y >> 1, s) * 0.16 + (h1 - 0.5) * 0.06;
      if (mat === 'stone' && Math.abs(noise(x, y, s, 3.2) - 0.5) < 0.045) k = 0.66;
      if (mat === 'snow') k = 0.94 + (k - 0.86) * 0.4;
      const col = mat === 'snow' && h1 > 0.9 ? mix(c, 0xb8d8ff, 0.4) : c;
      return [shade(col, k), 0];
    }
    case 'metal':
    case 'copper':
    case 'gold': {
      let k = 0.97 + (h1 - 0.5) * 0.06;
      if (mat !== 'gold') {
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) k *= 0.78;
        else if (y === 1) k *= 1.12;
        if (W >= 5 && H >= 5 && (x === 1 || x === W - 2) && (y === 1 || y === H - 2)) k = 1.3;
        k *= 1 - (y / Math.max(1, H)) * 0.1;
      } else if ((x - y + 64) % 5 === 0) k *= 1.2;
      let col = c;
      if (mat === 'copper' && noise(x, y, s, 2.6) > 0.6) col = mix(c, 0x4fae8e, 0.75);
      return [shade(col, k), 0];
    }
    case 'wood': {
      let k = 0.9 + hash(x >> 2, y, s) * 0.12;
      if (side ? y % 4 === 3 : x % 4 === 3) k = 0.72;
      if (side && x === ((y >> 2) * 5 + (s | 0)) % Math.max(2, W)) k *= 0.8;
      return [shade(c, k), 0];
    }
    case 'bark': {
      const wob = Math.floor(hash(0, y >> 1, s) * 2);
      let k = 0.85 + hash(x, y >> 2, s) * 0.2;
      if (hash(x + wob, 0, s + 5) > 0.72) k *= 0.72;
      return [shade(c, k), 0];
    }
    case 'leaf': {
      let k = 0.84 + h1 * 0.26;
      let col = c;
      if (hash(x, y, s + 9) > 0.9) k = 0.55;
      else if (h1 > 0.95) col = mix(c, 0xf0f070, 0.3);
      return [shade(col, k), 0];
    }
    case 'chitin': {
      let k = 0.94 + h1 * 0.08;
      if (side && y % 3 === 0) k *= 0.8;
      if (x === 1) k *= 1.15;
      return [shade(c, k), 0];
    }
    case 'scale': {
      const cy = y >> 1;
      const cx = (x + (cy & 1)) >> 1;
      let k = 0.88 + hash(cx, cy, s) * 0.16;
      if ((y & 1) === 0 && ((x + (cy & 1)) & 1) === 0) k *= 1.1;
      return [shade(c, k), 0];
    }
    case 'slime': {
      let k = 1.02 + (h1 - 0.5) * 0.06;
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e === 0) k = 0.82;
      else if (e === 2 && W > 6 && H > 6) k = 0.92;
      return [shade(c, k), 0];
    }
    case 'crystal':
    case 'ice': {
      let k = 0.96 + h1 * 0.08;
      if ((x + y + (s | 0)) % 6 === 0) k = 1.25;
      if (x === 0 || y === 0) k *= 1.08;
      return [shade(c, k), mat === 'crystal' ? 0.25 : 0.06];
    }
    case 'magma': {
      // dark crust with glowing veins (contour lines of a noise field)
      const v = Math.abs(noise(x, y, s, 3.4) - 0.5);
      const rock = shade(c, 0.86 + hash(x >> 1, y >> 1, s) * 0.18);
      if (v < 0.05) return [mix(accent, 0xffffff, h1 > 0.7 ? 0.25 : 0), 1];
      if (v < 0.09) return [mix(rock, accent, 0.45), 0.35];
      return [rock, 0];
    }
    case 'glow': {
      const cx = Math.abs(x - (W - 1) / 2) / Math.max(1, W / 2);
      const cy = Math.abs(y - (H - 1) / 2) / Math.max(1, H / 2);
      const k = 0.9 + h1 * 0.1 + (1 - Math.max(cx, cy)) * 0.15;
      return [shade(c, k), 1];
    }
    case 'mush': {
      const sx = Math.floor(x / 3);
      const sy = Math.floor(y / 3);
      if (hash(sx, sy, s) > 0.62 && x % 3 < 2 && y % 3 < 2) return [shade(accent || 0xf2ecdc, 0.96 + h1 * 0.06), 0];
      return [shade(c, 0.94 + h1 * 0.08), 0];
    }
    case 'ghost': {
      const k = (side ? 1.1 - (y / Math.max(1, H)) * 0.28 : 1.05) + (h1 > 0.9 ? 0.1 : 0);
      return [shade(c, k), 0.28];
    }
    case 'void': {
      if (h1 > 0.965) return [accent || 0xd0a0ff, 1];
      return [shade(c, 0.9 + hash(x >> 1, y >> 1, s) * 0.16), 0];
    }
  }
  return [c, 0];
}

const SIDE_BEVEL: Partial<Record<SkinMat, boolean>> = { glow: false, slime: false, ghost: false };

// ---------------------------------------------------------------- decals

const RUNES = [
  [0b01110, 0b00100, 0b11111, 0b00100, 0b01010],
  [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  [0b00100, 0b01110, 0b10101, 0b00100, 0b00100],
  [0b11011, 0b01010, 0b01110, 0b01010, 0b11011],
  [0b01010, 0b11111, 0b01010, 0b11111, 0b01010],
];

function decal(img: Img, kind: Decal, accent: number, s: number, f: number) {
  const W = img.w;
  const H = img.h;
  const glowA = isGlowColor(accent) ? 1 : 0;
  switch (kind) {
    case 'ribs': {
      const dark = 0x262019;
      const top = Math.max(1, Math.floor(H * 0.08));
      const end = Math.floor(H * 0.72);
      for (let y = top; y < end; y++) {
        if ((y - top) % 2 === 1) for (let x = 1; x < W - 1; x++) if (Math.abs(x - (W - 1) / 2) > 0.6 || f !== FRONT) img.set(x, y, dark);
      }
      for (let y = end; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (Math.abs(x - (W - 1) / 2) > 0.6 && y < H - 2) img.set(x, y, dark);
      break;
    }
    case 'vest': {
      const cx = Math.floor(W / 2);
      for (let y = 0; y < H; y++) {
        img.set(cx - 1, y, accent, glowA);
        img.set(cx, y, accent, glowA);
      }
      break;
    }
    case 'stripe':
      for (let y = 0; y < H; y++) for (let x = Math.floor(W / 2) - 1; x <= Math.floor(W / 2); x++) img.set(x, y, shade(accent, 0.95 + hash(x, y, s) * 0.08), glowA);
      break;
    case 'core': {
      const sz = Math.max(2, Math.round(Math.min(W, H) * 0.42));
      const x0 = Math.floor((W - sz) / 2);
      const y0 = Math.floor((H - sz) / 2) - (H > 8 ? 1 : 0);
      img.rect(x0 - 1, y0 - 1, sz + 2, sz + 2, shade(img.get(x0, y0), 0.45));
      for (let y = 0; y < sz; y++)
        for (let x = 0; x < sz; x++) {
          const e = Math.min(x, y, sz - 1 - x, sz - 1 - y);
          img.set(x0 + x, y0 + y, e === 0 ? shade(accent, 0.8) : mix(accent, 0xffffff, e > 1 ? 0.45 : 0.15), 1);
        }
      break;
    }
    case 'gem': {
      const x0 = Math.floor(W / 2) - 1;
      const y0 = Math.floor(H / 2) - 1;
      img.rect(x0, y0, 2, 2, accent, 1);
      img.set(x0, y0, mix(accent, 0xffffff, 0.5), 1);
      break;
    }
    case 'rune': {
      const r = RUNES[Math.floor(hash(s, f, 3) * RUNES.length)];
      const x0 = Math.floor((W - 5) / 2);
      const y0 = Math.floor((H - 5) / 2);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (r[y] & (1 << (4 - x))) img.set(x0 + x, y0 + y, accent, 1);
      break;
    }
    case 'belly': {
      const x0 = Math.max(1, Math.floor(W * 0.2));
      for (let y = Math.floor(H * 0.35); y < H; y++) for (let x = x0; x < W - x0; x++) img.set(x, y, shade(accent, 0.95 + hash(x, y, s) * 0.08));
      break;
    }
    case 'shell': {
      const cx = Math.floor(W / 2);
      for (let y = 0; y < H; y++) {
        img.set(cx - 1, y, shade(img.get(cx - 1, y), 0.6));
        img.set(cx, y, shade(img.get(cx, y), 0.75));
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 1 || x === W - 2) && y > 0 && y < H - 1) img.mul(x, y, 1.18);
      break;
    }
    case 'buttons':
      for (let y = 2; y < H - 1; y += 3) img.set(Math.floor(W / 2), y, accent, glowA);
      break;
    case 'plate': {
      const m = Math.max(1, Math.floor(Math.min(W, H) * 0.18));
      for (let y = m; y < H - m; y++)
        for (let x = m; x < W - m; x++) {
          const e = x === m || y === m || x === W - m - 1 || y === H - m - 1;
          img.set(x, y, e ? shade(accent, 0.7) : shade(accent, 0.96 + hash(x, y, s) * 0.08), e ? 0 : glowA * 0.5);
        }
      break;
    }
    case 'cross': {
      const cx = Math.floor(W / 2);
      const cy = Math.floor(H * 0.35);
      for (let i = -2; i <= 2; i++) {
        img.set(cx, cy + i, accent, glowA);
        img.set(cx - 1, cy + i, accent, glowA);
      }
      for (let i = -2; i <= 1; i++) img.set(cx + i, cy - 1, accent, glowA);
      break;
    }
    case 'spots': {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (hash(x >> 1, y >> 1, s + 11) > 0.82 && ((x + y) & 1) === 0) img.set(x, y, accent, glowA);
        }
      break;
    }
    case 'trim': {
      for (let x = 0; x < W; x++) img.set(x, H - 1, accent, glowA);
      if (f === FRONT) for (let y = 0; y < H; y++) img.set(Math.floor(W / 2), y, accent, glowA);
      break;
    }
    case 'bands':
      for (let y = 1; y < H; y += 3) for (let x = 0; x < W; x++) img.set(x, y, shade(accent, 0.9 + hash(x, y, s) * 0.1), glowA);
      break;
    case 'gear': {
      const cx = (W - 1) / 2;
      const cy = (H - 1) / 2;
      const r = Math.min(W, H) * 0.36;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - cx, y - cy);
          const a = Math.atan2(y - cy, x - cx);
          const tooth = Math.cos(a * 8) > 0.3 ? 1.2 : 0;
          if (d < 1.2) img.set(x, y, shade(accent, 0.5));
          else if (d < r + tooth) img.set(x, y, shade(accent, d < r - 1 ? 0.95 : 0.8));
        }
      break;
    }
    case 'planks': {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const e = x === 0 || y === 0 || x === W - 1 || y === H - 1;
          const diag = Math.abs(x - y * (W / H)) < 1.0;
          if (e || diag) img.set(x, y, shade(accent, 0.92 + hash(x, y, s) * 0.1));
        }
      break;
    }
    case 'eyespot': {
      const cx = (W - 1) / 2;
      const cy = (H - 1) / 2;
      const r = Math.min(W, H) * 0.32;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d < r * 0.45) img.set(x, y, 0x1a1420);
          else if (d < r) img.set(x, y, accent, glowA);
        }
      break;
    }
    case 'mouth': {
      const w = Math.max(2, Math.floor(W * 0.4));
      const x0 = Math.floor((W - w) / 2);
      const y0 = Math.floor(H * 0.55);
      img.rect(x0, y0, w, Math.max(2, Math.floor(H * 0.2)), 0x1a0f0a);
      if (accent) img.rect(x0 + 1, y0 + 1, w - 2, Math.max(1, Math.floor(H * 0.2) - 2), accent, glowA);
      break;
    }
    case 'rag':
      for (let x = 0; x < W; x++) {
        const cut = Math.floor(hash(x, 7, s) * 3);
        for (let y = H - cut; y < H; y++) img.set(x, y, shade(img.get(x, Math.max(0, H - 4)), 0.55));
      }
      break;
    case 'claws':
      for (let x = 0; x < W; x += 2) img.set(x, H - 1, accent || 0xe8e0c8);
      break;
  }
}

// ---------------------------------------------------------------- faces

function paintFace(img: Img, fs: FaceSpec, skin: number) {
  const W = img.w;
  const H = img.h;
  if (W < 3 || H < 3 || fs.style === 'none') return;
  const eye = fs.eye ?? 0x1a1a1a;
  const eg = fs.glow ?? isGlowColor(eye) ? 1 : 0;
  const ew = W >= 12 ? 3 : W >= 6 ? 2 : 1;
  const c = W / 2;
  const lIn = Math.floor(c - 0.5); // first gap column
  const L0 = Math.max(0, lIn - ew);
  const rIn = W % 2 === 0 ? Math.ceil(c) + 1 : Math.ceil(c);
  const Rx0 = Math.min(W - ew, rIn);
  let ey = Math.floor(H * 0.5) + (fs.dy ?? 0);
  const dark = shade(skin, 0.32);
  const black = 0x14110f;
  const eyeL = (outer: number, inner: number, y: number) => {
    for (let i = 0; i < ew; i++) {
      const isInner = i === ew - 1;
      img.set(L0 + i, y, isInner ? inner : outer, isInner ? eg : 0);
      img.set(Rx0 + ew - 1 - i, y, isInner ? inner : outer, isInner ? eg : 0);
    }
  };
  switch (fs.style) {
    case 'zombie': {
      for (let i = 0; i < ew; i++) {
        img.mul(L0 + i, ey - 1, 0.84);
        img.mul(Rx0 + i, ey - 1, 0.84);
      }
      eyeL(dark, eye, ey);
      for (let x = lIn; x < Rx0; x++) img.mul(x, ey + 1, 0.78);
      for (let x = L0 + ew - 1; x <= Rx0; x++) if (ey + 2 < H) img.set(x, ey + 2, shade(skin, 0.42));
      break;
    }
    case 'skull': {
      for (let y = ey - 1; y <= ey; y++)
        for (let i = 0; i < ew; i++) {
          img.set(L0 + i, y, black);
          img.set(Rx0 + i, y, black);
        }
      if (fs.eye !== undefined) {
        img.set(L0 + ew - 1, ey, eye, eg);
        img.set(Rx0, ey, eye, eg);
      }
      for (let x = lIn; x < Rx0; x++) img.set(x, ey + 1, black);
      if (ey + 2 < H) for (let x = 1; x < W - 1; x++) img.set(x, ey + 2, x % 2 ? black : shade(skin, 0.75));
      if (ey + 3 < H - 0) for (let x = 2; x < W - 2; x++) img.set(x, ey + 3, x % 2 ? shade(skin, 0.6) : black);
      break;
    }
    case 'illager': {
      ey -= 1;
      for (let x = L0; x < Rx0 + ew; x++) img.set(x, ey - 1, shade(fs.alt ?? 0x2a2420, 1));
      eyeL(0xe8e4d8, eye, ey);
      // the nose is geometry; a grim mouth under it
      if (ey + 4 < H) for (let x = lIn; x < Rx0; x++) img.set(x, ey + 4, shade(skin, 0.45));
      break;
    }
    case 'hood': {
      const inner = fs.alt ?? 0x16121a;
      for (let y = 2; y < H; y++)
        for (let x = 1; x < W - 1; x++) {
          const edge = y === 2 || x === 1 || x === W - 2;
          img.set(x, y, edge ? shade(inner, 1.6) : shade(inner, 0.9 + hash(x, y, 5) * 0.15));
        }
      ey = Math.max(3, ey);
      img.set(L0 + ew - 1, ey, eye, eg);
      img.set(Rx0, ey, eye, eg);
      if (W >= 10) {
        img.set(L0 + ew - 2, ey, shade(eye, 0.7), eg * 0.6);
        img.set(Rx0 + 1, ey, shade(eye, 0.7), eg * 0.6);
      }
      break;
    }
    case 'beast': {
      ey = Math.floor(H * 0.38) + (fs.dy ?? 0);
      const lx = W >= 6 ? 1 : 0;
      img.set(lx, ey, eye, eg);
      img.set(W - 1 - lx, ey, eye, eg);
      if (W >= 8) {
        img.set(lx + 1, ey, dark);
        img.set(W - 2 - lx, ey, dark);
      }
      img.set(lx, ey - 1, shade(skin, 0.7));
      img.set(W - 1 - lx, ey - 1, shade(skin, 0.7));
      break;
    }
    case 'snout': {
      const cx = Math.floor(W / 2);
      img.set(cx - 1, 0, black);
      img.set(cx, 0, black);
      if (W >= 5) {
        img.set(cx - 2, 1, shade(skin, 0.7));
        img.set(cx + 1, 1, shade(skin, 0.7));
      }
      for (let x = 0; x < W; x++) img.set(x, H - 1, shade(skin, 0.45));
      if (fs.alt !== undefined) {
        img.set(0, H - 2, fs.alt);
        img.set(W - 1, H - 2, fs.alt);
      }
      break;
    }
    case 'slime': {
      const y0 = Math.floor(H * 0.28) + (fs.dy ?? 0);
      const sw = W >= 10 ? 2 : 1;
      const lx = Math.max(1, Math.floor(W * 0.18));
      const rx = W - lx - sw;
      for (let y = y0; y < y0 + 2; y++)
        for (let i = 0; i < sw; i++) {
          img.set(lx + i, y, shade(eye, 0.55), eg * 0.5);
          img.set(rx + i, y, shade(eye, 0.55), eg * 0.5);
        }
      img.set(lx, y0, eye, eg);
      img.set(rx + sw - 1, y0, eye, eg);
      const my = Math.floor(H * 0.68);
      img.set(Math.floor(W / 2), my, shade(eye, 0.4), eg * 0.4);
      if (W >= 8) img.set(Math.floor(W / 2) + 1, my, shade(eye, 0.4), eg * 0.4);
      break;
    }
    case 'golem':
    case 'treant': {
      for (let x = 1; x < W - 1; x++) img.set(x, ey - 1, shade(skin, 0.5));
      for (let i = 0; i < ew; i++) {
        img.set(L0 + i, ey, eye, eg);
        img.set(Rx0 + i, ey, eye, eg);
      }
      img.set(L0 - 1, ey, shade(skin, 0.4));
      img.set(Rx0 + ew, ey, shade(skin, 0.4));
      if (fs.style === 'treant') {
        // hollow glowing mouth
        const my = Math.min(H - 2, ey + 3);
        for (let x = lIn - 1; x <= Rx0; x++) img.set(x, my, shade(skin, 0.25));
        for (let x = lIn; x < Rx0; x++) img.set(x, my + 1, eye, eg * 0.6);
      } else if (ey + 3 < H) for (let x = lIn; x < Rx0; x++) img.set(x, ey + 3, shade(skin, 0.45));
      break;
    }
    case 'ghost': {
      for (let y = ey - 2; y <= ey; y++)
        for (let i = 0; i < ew; i++) {
          img.set(L0 + i, y, black);
          img.set(Rx0 + i, y, black);
        }
      img.set(L0 + ew - 1, ey - 1, eye, eg);
      img.set(Rx0, ey - 1, eye, eg);
      if (ey + 3 < H) img.rect(lIn, ey + 2, Math.max(1, Rx0 - lIn), 2, black);
      break;
    }
    case 'cyclops': {
      const sz = Math.max(3, Math.round(Math.min(W, H) * 0.6));
      const x0 = Math.floor((W - sz) / 2);
      const y0 = Math.floor((H - sz) / 2);
      for (let y = 0; y < sz; y++)
        for (let x = 0; x < sz; x++) {
          const e = Math.min(x, y, sz - 1 - x, sz - 1 - y);
          const col = e === 0 ? shade(skin, 0.4) : e === 1 ? 0xeee8f4 : eye;
          img.set(x0 + x, y0 + y, col, e >= 2 ? eg : 0);
        }
      const p = Math.floor(sz / 2);
      img.rect(x0 + p - (sz > 6 ? 1 : 0), y0 + p - (sz > 6 ? 1 : 0), sz > 6 ? 2 : 1, sz > 6 ? 2 : 1, 0x0a0410);
      break;
    }
    case 'spider': {
      ey = Math.floor(H * 0.42) + (fs.dy ?? 0);
      for (let y = ey; y < ey + 2; y++)
        for (let i = 0; i < ew; i++) {
          img.set(L0 + i, y, eye, eg);
          img.set(Rx0 + i, y, eye, eg);
        }
      img.set(L0 - 1, ey - 1, eye, eg);
      img.set(Rx0 + ew, ey - 1, eye, eg);
      img.set(lIn, ey - 2, eye, eg);
      img.set(Rx0 - 1, ey - 2, eye, eg);
      for (let x = lIn; x < Rx0; x++) img.set(x, H - 2, black);
      break;
    }
    case 'insect': {
      const sz = Math.max(2, Math.floor(W * 0.28));
      const y0 = Math.max(0, Math.floor(H * 0.2));
      for (let y = 0; y < sz; y++)
        for (let x = 0; x < sz; x++) {
          const chk = (x + y) & 1 ? 1 : 0.75;
          img.set(x, y0 + y, shade(eye, chk), eg);
          img.set(W - 1 - x, y0 + y, shade(eye, chk), eg);
        }
      for (let x = lIn; x < Rx0; x++) img.set(x, H - 1, black);
      break;
    }
    case 'visor': {
      for (let x = 0; x < W; x++) {
        img.set(x, ey - 1, black);
        img.set(x, ey + 1, black);
      }
      for (let x = 1; x < W - 1; x++) img.set(x, ey, (x + 1) % 3 === 0 ? shade(eye, 0.7) : eye, eg);
      break;
    }
    case 'imp': {
      eyeL(eye, eye, ey);
      img.set(L0 + ew - 1, ey - 1, black);
      img.set(Rx0, ey - 1, black);
      img.set(L0, ey - 2, black);
      img.set(Rx0 + ew - 1, ey - 2, black);
      if (ey + 2 < H)
        for (let x = L0; x < Rx0 + ew; x++) {
          img.set(x, ey + 2, black);
          if (ey + 3 < H && x > L0 && x < Rx0 + ew - 1) img.set(x, ey + 3, x % 2 ? 0xf0ead8 : black);
        }
      break;
    }
    case 'cute': {
      const lx = L0 + ew - 1;
      const rx = Rx0;
      img.set(lx, ey - 1, 0xffffff);
      img.set(rx, ey - 1, 0xffffff);
      img.set(lx, ey, eye, eg);
      img.set(rx, ey, eye, eg);
      if (fs.alt !== undefined) {
        img.set(lx - 1, ey + 1, fs.alt);
        img.set(rx + 1, ey + 1, fs.alt);
      }
      if (ey + 2 < H) {
        img.set(Math.floor(W / 2) - (W % 2 ? 0 : 1), ey + 2, black);
        if (W % 2 === 0) img.set(Math.floor(W / 2), ey + 2, black);
      }
      break;
    }
    case 'bat': {
      ey = Math.floor(H * 0.4);
      img.set(L0 + ew - 1, ey, eye, eg);
      img.set(Rx0, ey, eye, eg);
      const cx = Math.floor(W / 2);
      img.set(cx - 2, H - 2, 0xf0f0e8);
      img.set(cx + 1, H - 2, 0xf0f0e8);
      for (let x = cx - 2; x <= cx + 1; x++) img.set(x, H - 3, black);
      break;
    }
  }
}

// ---------------------------------------------------------------- painting a box face

function paintBoxFace(b: VoxBox, idx: number, f: number, p: BoxPaint | undefined, pw: number, ph: number, px: number): Img {
  const img = new Img(pw, ph);
  const base = b[6];
  const autoGlow = isGlowColor(base);
  const mat0: SkinMat = p?.mat ?? (autoGlow ? 'glow' : 'plain');
  const seed = (p?.seed ?? idx * 7.13) + f * 1.91;
  const accent = p?.accent ?? 0xff5a1a;
  const side = f !== TOP && f !== BOTTOM;
  const bands = p?.bands;
  for (let y = 0; y < ph; y++) {
    // band lookup in model units from the box bottom
    let col = base;
    let mat = mat0;
    if (bands) {
      const u = side ? (ph - 1 - y + 0.5) / px : f === BOTTOM ? 0 : b[4];
      let acc = 0;
      for (const [hh, bc, bm] of bands) {
        if (u < acc + hh) {
          col = bc;
          mat = bm ?? mat0;
          break;
        }
        acc += hh;
      }
    }
    for (let x = 0; x < pw; x++) {
      const [c, g] = matPixel(mat, col, x, y, pw, ph, f, seed, accent);
      img.set(x, y, c, Math.max(g, p?.glow ?? 0));
    }
  }
  // hair / hood
  const hair = p?.hair;
  if (hair) {
    const rows = Math.round(hair.rows * px);
    for (let y = 0; y < ph; y++)
      for (let x = 0; x < pw; x++) {
        let on = false;
        if (f === TOP) on = true;
        else if (f === BACK && hair.back !== false) on = y < Math.max(rows, ph - Math.round(ph * 0.25));
        else if (side && f !== BOTTOM) on = y < rows || (f !== FRONT && y < rows + 1 && hash(x, y, seed) > 0.5);
        if (f === FRONT && y === rows && hash(x, 3, seed) > 0.6) on = true;
        if (on) img.set(x, y, matPixel(hair.mat ?? 'fur', hair.color, x, y, pw, ph, f, seed + 2, accent)[0]);
      }
  }
  // chunky bevel: lighter top row, darker bottom row on side faces
  if (side && ph >= 4 && SIDE_BEVEL[mat0] !== false) {
    for (let x = 0; x < pw; x++) {
      img.mul(x, 0, 1.07);
      img.mul(x, ph - 1, 0.84);
    }
  }
  if (p) {
    if (f === FRONT && p.front) decal(img, p.front, accent, seed, f);
    if (f === BACK && p.back) decal(img, p.back, accent, seed, f);
    if ((f === 0 || f === 1) && p.side) decal(img, p.side, accent, seed, f);
    if (f === TOP && p.top) decal(img, p.top, accent, seed, f);
    if (f === FRONT && p.face) paintFace(img, p.face, base);
  }
  return img;
}

// ---------------------------------------------------------------- atlas

export interface SkinAtlas {
  tex: THREE.DataTexture;
  w: number;
  h: number;
  /** Per box*6+face: x, y (atlas, bottom-left of the inner rect), pw, ph. */
  rects: Int32Array;
  faces: Img[];
}

const atlasCache = new WeakMap<VoxelModel, SkinAtlas>();

export function getSkinAtlas(m: VoxelModel): SkinAtlas | null {
  const spec = skinOf(m);
  if (!spec) return null;
  let a = atlasCache.get(m);
  if (a) return a;
  const px = spec.px ?? 1;
  const n = m.boxes.length;
  const faces: Img[] = [];
  const order: number[] = [];
  let area = 0;
  let maxW = 0;
  for (let i = 0; i < n; i++) {
    const b = m.boxes[i];
    for (let f = 0; f < 6; f++) {
      const [fw, fh] = faceDims(b, f);
      const pw = Math.max(1, Math.round(fw * px));
      const ph = Math.max(1, Math.round(fh * px));
      faces.push(paintBoxFace(b, i, f, spec.paints[i], pw, ph, px));
      order.push(i * 6 + f);
      area += (pw + 2) * (ph + 2);
      maxW = Math.max(maxW, pw + 2);
    }
  }
  let W = 64;
  while (W * W < area * 1.3 || W < maxW) W *= 2;
  order.sort((p, q) => faces[q].h - faces[p].h);
  const rects = new Int32Array(n * 6 * 4);
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const k of order) {
    const im = faces[k];
    const rw = im.w + 2;
    const rh = im.h + 2;
    if (x + rw > W) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    rects[k * 4] = x + 1;
    rects[k * 4 + 1] = y + 1;
    rects[k * 4 + 2] = im.w;
    rects[k * 4 + 3] = im.h;
    x += rw;
    shelf = Math.max(shelf, rh);
  }
  const H = Math.max(4, Math.ceil((y + shelf) / 4) * 4);
  const data = new Uint8Array(W * H * 4);
  for (const k of order) {
    const im = faces[k];
    const rx = rects[k * 4];
    const ry = rects[k * 4 + 1];
    // copy with a 1px replicated gutter; image row 0 (top) lands on the highest atlas row
    for (let yy = -1; yy <= im.h; yy++)
      for (let xx = -1; xx <= im.w; xx++) {
        const sx = Math.min(im.w - 1, Math.max(0, xx));
        const sy = Math.min(im.h - 1, Math.max(0, yy));
        const si = (sy * im.w + sx) * 4;
        const ay = ry + (im.h - 1 - yy);
        const ax = rx + xx;
        const di = (ay * W + ax) * 4;
        data[di] = im.d[si];
        data[di + 1] = im.d[si + 1];
        data[di + 2] = im.d[si + 2];
        data[di + 3] = im.d[si + 3];
      }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  a = { tex, w: W, h: H, rects, faces };
  atlasCache.set(m, a);
  return a;
}

/** Texel colour + glow of a face image (image coords: y = 0 top). Used to bake skins into vertex colours. */
export function atlasTexel(a: SkinAtlas, box: number, f: number, x: number, y: number): [number, number] {
  const im = a.faces[box * 6 + f];
  return [im.get(x, y), im.glowAt(x, y)];
}

export function atlasFaceSize(a: SkinAtlas, box: number, f: number): [number, number] {
  const im = a.faces[box * 6 + f];
  return [im.w, im.h];
}

// ---------------------------------------------------------------- material

export const PART_IDS: Record<string, number> = { legL: 1, legR: 2, armL: 3, armR: 4, wingL: 5, wingR: 6, tail: 7, jaw: 8, head: 9 };

export interface SkinMatOptions {
  /** Instanced batches: flash + walk phase come packed in the aFlash instance attribute. */
  instanced?: boolean;
  /** Shader-driven walk cycle (requires aPart/aPivot attributes). */
  anim?: boolean;
  flashUniform?: { value: number };
  rim?: number;
}

/**
 * Packs the walk phase (radians), movement amount (0..1) and hit flash (0..1) into the
 * single per-instance float the instanced batches carry.
 */
export function packAnim(phase: number, move: number, flash: number): number {
  const t = phase / (Math.PI * 2);
  const k = Math.floor((t - Math.floor(t)) * 128) & 127;
  const mv = Math.round(Math.max(0, Math.min(1, move)) * 7);
  return k + mv * 128 + Math.max(0, Math.min(1, flash)) * 0.99;
}

const matCache = new WeakMap<VoxelModel, Map<string, THREE.MeshLambertMaterial>>();

/** Lambert material with the model's pixel skin, alpha-encoded glow, hit flash and optional walk shader. */
export function getSkinMaterial(m: VoxelModel, o: SkinMatOptions = {}): THREE.MeshLambertMaterial | null {
  const a = getSkinAtlas(m);
  if (!a) return null;
  const key = `${o.instanced ? 'i' : 'm'}${o.anim ? 'a' : ''}${o.flashUniform ? 'u' : ''}${o.rim ?? ''}`;
  let byKey = matCache.get(m);
  if (!byKey) matCache.set(m, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit && !o.flashUniform) return hit;
  const g = { ...DEFAULT_GAIT, ...(skinOf(m)!.gait ?? {}) };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: a.tex });
  const uGaitA = { value: new THREE.Vector4(g.leg, g.arm, g.wing, g.tail) };
  const uGaitB = { value: new THREE.Vector4(g.bob, g.roll, g.hop, g.jaw) };
  const uHead = { value: g.head };
  const uRim = { value: o.rim ?? 0.12 };
  const anim = !!(o.anim && o.instanced);
  mat.onBeforeCompile = (shader) => {
    if (o.flashUniform) shader.uniforms.uFlash = o.flashUniform;
    shader.uniforms.uGaitA = uGaitA;
    shader.uniforms.uGaitB = uGaitB;
    shader.uniforms.uHead = uHead;
    shader.uniforms.uRim = uRim;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aGlow;
varying float vGlow;
varying float vFlash;
${o.instanced ? 'attribute float aFlash;' : ''}
${o.flashUniform ? 'uniform float uFlash;' : ''}
${
  anim
    ? `attribute float aPart;
attribute vec3 aPivot;
uniform vec4 uGaitA;
uniform vec4 uGaitB;
uniform float uHead;
mat3 skRotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 skRotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 skRotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }`
    : ''
}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        anim
          ? `float skK = floor(aFlash + 0.0001);
float skFlash = clamp((aFlash - skK) / 0.99, 0.0, 1.0);
float skPh = mod(skK, 128.0) / 128.0 * 6.2831853;
float skMv = floor(skK / 128.0 + 0.0001) / 7.0;
float skAmp = 0.12 + 0.88 * skMv;
float skS = sin(skPh);
int skPart = int(aPart + 0.5);
mat3 skR = mat3(1.0);
if (skPart == 1) skR = skRotX(skS * uGaitA.x * skAmp);
else if (skPart == 2) skR = skRotX(-skS * uGaitA.x * skAmp);
else if (skPart == 3) skR = skRotX(-skS * uGaitA.y * skAmp);
else if (skPart == 4) skR = skRotX(skS * uGaitA.y * skAmp);
else if (skPart == 5) skR = skRotZ(-sin(skPh * 2.0) * uGaitA.z);
else if (skPart == 6) skR = skRotZ(sin(skPh * 2.0) * uGaitA.z);
else if (skPart == 7) skR = skRotY(skS * uGaitA.w);
else if (skPart == 8) skR = skRotX(max(0.0, sin(skPh * 2.0)) * uGaitB.w);
else if (skPart == 9) skR = skRotX(sin(skPh * 2.0) * uHead * skAmp);
mat3 skRoll = skRotZ(skS * uGaitB.y * skAmp);
vec3 objectNormal = skRoll * (skR * vec3(normal));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`
          : '#include <beginnormal_vertex>',
      )
      .replace(
        '#include <begin_vertex>',
        `${
          anim
            ? `vec3 transformed = skR * (position - aPivot) + aPivot;
float skSq = uGaitB.z * (0.5 + 0.5 * cos(skPh * 2.0)) * skAmp;
transformed.y *= 1.0 - skSq;
transformed.xz *= 1.0 + skSq * 0.6;
transformed = skRoll * transformed;
transformed.y += abs(skS) * uGaitB.x * skAmp + uGaitB.z * max(0.0, sin(skPh * 2.0 - 1.2)) * skAmp * 0.6;`
            : '#include <begin_vertex>'
        }
vGlow = aGlow;
vFlash = ${anim ? 'skFlash' : o.instanced ? 'aFlash' : o.flashUniform ? 'uFlash' : '0.0'};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vGlow;\nvarying float vFlash;\nuniform float uRim;`)
      .replace('#include <map_fragment>', `#include <map_fragment>\nfloat skGlow = max(vGlow, 1.0 - sampledDiffuseColor.a);`)
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb * 1.45, skGlow);
float skRimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
gl_FragColor.rgb += vec3(1.0, 0.96, 0.9) * skRimF * uRim * (1.0 - skGlow);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.92), clamp(vFlash, 0.0, 1.0));`,
      );
  };
  mat.customProgramCacheKey = () => `skin-${key.replace(/[\d.]+$/, '')}`;
  if (!o.flashUniform) byKey.set(key, mat);
  return mat;
}
