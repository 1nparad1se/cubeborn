import * as THREE from 'three';
import type { RigPart } from './shapes';
import { skinQuads, skinSize, type SkinAtlas } from './skins';
import { Vox } from './voxSculpt';

/**
 * Detailed voxel look for character models: every part of a bone (boxes, tapered blocks,
 * cylinders, balls and pixel-skinned boxes) is filled into one fine voxel grid, so the
 * figure reads as many small blocks with ambient occlusion and per-voxel shade variation
 * instead of a few large textured boxes. Skinned parts take each voxel's colour from the
 * nearest skin texel, so faces, trims and patterns survive as voxel relief.
 */

/** Voxel edge in model units (a hero is about 30 units tall). */
export const VOXEL_RES = 0.5;

const DEG = Math.PI / 180;
const q = new THREE.Quaternion();
const qi = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();

/** True when a part is too thin for the grid and stays as plain geometry (blades, strings, eyes). */
export function keepsGeometry(p: RigPart, res = VOXEL_RES): boolean {
  if (p.raw) return true;
  const d = p.sk ? skinSize(p.sk) : p.d;
  return Math.min(d[0], d[1], d[2]) < res * 1.4;
}

interface Px {
  data: Uint8ClampedArray;
  w: number;
}

const PIXELS = new WeakMap<SkinAtlas, Px | null>();

function atlasPixels(atlas: SkinAtlas): Px | null {
  let px = PIXELS.get(atlas);
  if (px === undefined) {
    px = null;
    const img = atlas.texture.image as HTMLCanvasElement | undefined;
    const ctx = img?.getContext?.('2d');
    if (ctx) px = { data: ctx.getImageData(0, 0, img!.width, img!.height).data, w: img!.width };
    PIXELS.set(atlas, px);
  }
  return px;
}

/** Inside test in part space (centred, unrotated). */
function insideShape(p: RigPart, x: number, y: number, z: number, hx: number, hy: number, hz: number): boolean {
  if (Math.abs(y) > hy) return false;
  const u = (y + hy) / (2 * hy);
  const tx = p.t?.[0] ?? 1;
  const tz = p.t?.[1] ?? tx;
  const ax = hx * (1 + (tx - 1) * u);
  const az = hz * (1 + (tz - 1) * u);
  const ox = x - (p.sh?.[0] ?? 0) * u;
  const oz = z - (p.sh?.[1] ?? 0) * u;
  switch (p.sk ? 'box' : p.s ?? 'box') {
    case 'cyl':
      return (ox / ax) ** 2 + (oz / az) ** 2 <= 1;
    case 'ball':
      return (x / hx) ** 2 + (y / hy) ** 2 + (z / hz) ** 2 <= 1;
    case 'gem':
      return Math.abs(x / hx) + Math.abs(y / hy) + Math.abs(z / hz) <= 1;
    case 'rbox': {
      // chamfered vertical edges
      const side = Math.min(p.bv?.[0] ?? Math.min(hx, hz) * 0.44, Math.min(hx, hz) * 0.9);
      if (Math.abs(ox) > ax || Math.abs(oz) > az) return false;
      return Math.abs(ox) + Math.abs(oz) <= ax + az - side;
    }
    default:
      return Math.abs(ox) <= ax && Math.abs(oz) <= az;
  }
}

/** Colour of a skin texel nearest to the part-space point (or -1 where the skin is transparent). */
function skinColor(p: RigPart, atlas: SkinAtlas, px: Px, x: number, y: number, z: number, hx: number, hy: number, hz: number): number {
  const quads = skinQuads(p.sk!, atlas, hx, hy, hz);
  // face whose plane is closest
  const dx = hx - Math.abs(x);
  const dy = hy - Math.abs(y);
  const dz = hz - Math.abs(z);
  let axis = 0;
  let sign = Math.sign(x) || 1;
  if (dy < dx && dy <= dz) {
    axis = 1;
    sign = Math.sign(y) || 1;
  } else if (dz < dx && dz < dy) {
    axis = 2;
    sign = Math.sign(z) || 1;
  }
  const P = [x, y, z];
  for (const quad of quads) {
    const k = quad.c;
    if (Math.abs(k[0][axis] - sign * [hx, hy, hz][axis]) > 1e-4 || Math.abs(k[2][axis] - k[0][axis]) > 1e-4) continue;
    // bilinear param on the axis-aligned rectangle TL(0) TR(1) BL(3)
    const ex = [k[1][0] - k[0][0], k[1][1] - k[0][1], k[1][2] - k[0][2]];
    const ey = [k[3][0] - k[0][0], k[3][1] - k[0][1], k[3][2] - k[0][2]];
    const d = [P[0] - k[0][0], P[1] - k[0][1], P[2] - k[0][2]];
    const lx = ex[0] ** 2 + ex[1] ** 2 + ex[2] ** 2 || 1;
    const ly = ey[0] ** 2 + ey[1] ** 2 + ey[2] ** 2 || 1;
    const s = (d[0] * ex[0] + d[1] * ex[1] + d[2] * ex[2]) / lx;
    const t = (d[0] * ey[0] + d[1] * ey[1] + d[2] * ey[2]) / ly;
    if (s < -0.01 || s > 1.01 || t < -0.01 || t > 1.01) continue;
    const uv = quad.uv;
    const uu = uv[0][0] + Math.min(1, Math.max(0, s)) * (uv[1][0] - uv[0][0]);
    const vv = uv[0][1] + Math.min(1, Math.max(0, t)) * (uv[3][1] - uv[0][1]);
    const ix = Math.min(atlas.width - 1, Math.floor(uu * atlas.width));
    const iy = Math.min(atlas.height - 1, Math.floor(vv * atlas.height));
    const o = (iy * px.w + ix) * 4;
    if (px.data[o + 3] < 128) return -1;
    return (px.data[o] << 16) | (px.data[o + 1] << 8) | px.data[o + 2];
  }
  return -1;
}

function tint(hex: number, t: number): number {
  if (t === 0xffffff) return hex;
  const r = (((hex >> 16) & 255) * ((t >> 16) & 255)) / 255;
  const g = (((hex >> 8) & 255) * ((t >> 8) & 255)) / 255;
  const b = ((hex & 255) * (t & 255)) / 255;
  return (r << 16) | (g << 8) | b;
}

/** Fills one part into the bone's voxel grid. */
function fillPart(vox: Vox, p: RigPart, atlas: SkinAtlas | null, px: Px | null) {
  const size = p.sk ? skinSize(p.sk) : p.d;
  const inf = p.sk?.inf ?? 0;
  const hx = size[0] / 2 + inf;
  const hy = size[1] / 2 + inf;
  const hz = size[2] / 2 + inf;
  e.set((p.r?.[0] ?? 0) * DEG, (p.r?.[1] ?? 0) * DEG, (p.r?.[2] ?? 0) * DEG);
  q.setFromEuler(e);
  qi.copy(q).invert();
  // bounds of the rotated part (taper/shear can only widen the top face a little)
  const ext = Math.hypot(hx * Math.max(1, p.t?.[0] ?? 1) + Math.abs(p.sh?.[0] ?? 0), hy, hz * Math.max(1, p.t?.[1] ?? p.t?.[0] ?? 1) + Math.abs(p.sh?.[1] ?? 0));
  let colAt = p.c;
  const skinned = !!(p.sk && atlas && px);
  vox.fill(
    [p.p[0] - ext, p.p[1] - ext, p.p[2] - ext],
    [p.p[0] + ext, p.p[1] + ext, p.p[2] + ext],
    (x, y, z) => {
      v.set(x - p.p[0], y - p.p[1], z - p.p[2]).applyQuaternion(qi);
      if (!insideShape(p, v.x, v.y, v.z, hx, hy, hz)) return false;
      if (skinned) {
        const k = skinColor(p, atlas!, px!, v.x, v.y, v.z, hx, hy, hz);
        if (k < 0) return false;
        colAt = tint(k, p.c);
      }
      return true;
    },
    () => colAt,
    { g: p.g ? 1 : 0 },
  );
}

/**
 * Voxelises a bone's parts: returns one prebuilt part (the voxel mesh) plus the parts that stay
 * plain geometry because they are thinner than a voxel.
 */
export function voxelizeParts(bone: string, parts: RigPart[], atlas: SkinAtlas | null, res = VOXEL_RES): RigPart[] {
  const px = atlas ? atlasPixels(atlas) : null;
  const vox = new Vox(bone, res);
  const keep: RigPart[] = [];
  for (const p of parts) {
    if (keepsGeometry(p, res) || (p.sk && !px)) keep.push(p);
    else fillPart(vox, p, atlas, px);
  }
  if (vox.cells.size) keep.unshift(vox.part({ jitter: 0.06 }));
  return keep;
}
