import type { VoxBox, VoxelModel } from '../data/types';

/** Model helpers. Units are voxels; +z is the front of a model, y is up, x/z centered. */

export const V = 0.1; // world units per voxel

export function model(boxes: VoxBox[], scale = V): VoxelModel {
  return { boxes, scale };
}

export interface HumanoidOpts {
  skin: number;
  shirt: number;
  pants: number;
  shoes?: number;
  hair?: number;
  eyes?: number;
  legH?: number;
  bodyH?: number;
  bodyW?: number;
  head?: number;
  armW?: number;
  legW?: number;
  depth?: number;
  sleeves?: number;
  extras?: VoxBox[];
  noHair?: boolean;
}

/** Blocky humanoid with tagged limbs (legL/legR/armL/armR/head). */
export function humanoid(o: HumanoidOpts): VoxBox[] {
  const legH = o.legH ?? 6;
  const bodyH = o.bodyH ?? 6;
  const bodyW = o.bodyW ?? 6;
  const head = o.head ?? 6;
  const armW = o.armW ?? 2;
  const legW = o.legW ?? bodyW / 2;
  const d = o.depth ?? 3;
  const shoes = o.shoes ?? 0x2a2a2a;
  const b: VoxBox[] = [];
  const lx = bodyW / 4;
  b.push([-lx, 1, 0, legW, legH - 1, d, o.pants, 'legL'], [-lx, 0, 0.2, legW, 1, d + 0.4, shoes, 'legL']);
  b.push([lx, 1, 0, legW, legH - 1, d, o.pants, 'legR'], [lx, 0, 0.2, legW, 1, d + 0.4, shoes, 'legR']);
  b.push([0, legH, 0, bodyW, bodyH, d + 0.4, o.shirt, 'body']);
  const ax = bodyW / 2 + armW / 2;
  const sl = o.sleeves ?? o.shirt;
  b.push([-ax, legH + 2, 0, armW, bodyH - 2, armW + 0.4, sl, 'armL'], [-ax, legH, 0, armW, 2, armW + 0.2, o.skin, 'armL']);
  b.push([ax, legH + 2, 0, armW, bodyH - 2, armW + 0.4, sl, 'armR'], [ax, legH, 0, armW, 2, armW + 0.2, o.skin, 'armR']);
  const hy = legH + bodyH;
  b.push([0, hy, 0, head, head, head, o.skin, 'head']);
  const eye = o.eyes ?? 0x1a1a2a;
  b.push([-head * 0.22, hy + head * 0.4, head / 2, 1, 1, 0.3, eye, 'head'], [head * 0.22, hy + head * 0.4, head / 2, 1, 1, 0.3, eye, 'head']);
  if (o.hair !== undefined && !o.noHair) {
    b.push([0, hy + head - 1, -0.3, head + 0.4, 1.4, head + 0.2, o.hair, 'head']);
    b.push([0, hy + head * 0.35, -head / 2 + 0.6, head + 0.4, head * 0.65, 1.4, o.hair, 'head']);
  }
  if (o.extras) b.push(...o.extras);
  return b;
}

export interface QuadOpts {
  body: number;
  belly?: number;
  legs?: number;
  head?: number;
  eyes?: number;
  len?: number;
  w?: number;
  h?: number;
  legH?: number;
  headSize?: number;
  tail?: number;
  extras?: VoxBox[];
}

/** Four-legged creature along +z. */
export function quad(o: QuadOpts): VoxBox[] {
  const len = o.len ?? 9;
  const w = o.w ?? 5;
  const h = o.h ?? 4;
  const legH = o.legH ?? 3;
  const hs = o.headSize ?? 4;
  const legs = o.legs ?? o.body;
  const b: VoxBox[] = [];
  const fx = w / 2 - 1;
  const fz = len / 2 - 1.5;
  b.push([-fx, 0, fz, 2, legH, 2, legs, 'legL'], [fx, 0, -fz, 2, legH, 2, legs, 'legL']);
  b.push([fx, 0, fz, 2, legH, 2, legs, 'legR'], [-fx, 0, -fz, 2, legH, 2, legs, 'legR']);
  b.push([0, legH, 0, w, h, len, o.body, 'body']);
  if (o.belly !== undefined) b.push([0, legH - 0.3, 0, w - 1.5, 1, len - 2, o.belly, 'body']);
  const head = o.head ?? o.body;
  b.push([0, legH + h - hs * 0.5, len / 2 + hs / 2 - 0.5, hs, hs, hs, head, 'head']);
  const eye = o.eyes ?? 0xffe04a;
  b.push([-hs * 0.25, legH + h - hs * 0.5 + hs * 0.55, len / 2 + hs - 0.3, 0.9, 0.9, 0.4, eye, 'head'], [hs * 0.25, legH + h - hs * 0.5 + hs * 0.55, len / 2 + hs - 0.3, 0.9, 0.9, 0.4, eye, 'head']);
  if (o.tail !== undefined) b.push([0, legH + h - 1.5, -len / 2 - 1.5, 1.2, 1.2, 3, o.tail, 'tail']);
  if (o.extras) b.push(...o.extras);
  return b;
}

/** Bat/moth style flyer with tagged wings. */
export function flyer(body: number, wing: number, eyes: number, size = 4, wingSpan = 6, extras: VoxBox[] = []): VoxBox[] {
  return [
    [0, 6, 0, size, size, size, body, 'body'],
    [-size / 2 - wingSpan / 2, 7.5, 0, wingSpan, 0.8, size + 1, wing, 'wingL'],
    [size / 2 + wingSpan / 2, 7.5, 0, wingSpan, 0.8, size + 1, wing, 'wingR'],
    [-size * 0.22, 6 + size * 0.55, size / 2, 0.9, 0.9, 0.3, eyes],
    [size * 0.22, 6 + size * 0.55, size / 2, 0.9, 0.9, 0.3, eyes],
    ...extras,
  ];
}

/** Squat slime cube with eyes. */
export function slime(color: number, dark: number, eyes = 0x1a1a1a, s = 7, extras: VoxBox[] = []): VoxBox[] {
  return [
    [0, 0, 0, s, s * 0.8, s, color, 'body'],
    [0, 0, 0, s + 0.4, 1, s + 0.4, dark, 'body'],
    [-s * 0.22, s * 0.45, s / 2, 1.2, 1.4, 0.4, eyes, 'body'],
    [s * 0.22, s * 0.45, s / 2, 1.2, 1.4, 0.4, eyes, 'body'],
    ...extras,
  ];
}

/** Eight-legged crawler. */
export function spider(body: number, legs: number, eyes: number, s = 5, extras: VoxBox[] = []): VoxBox[] {
  const b: VoxBox[] = [
    [0, 2, -1, s + 1, s * 0.7, s + 2, body, 'body'],
    [0, 2, s / 2 + 1, s - 1, s * 0.5, 3, body, 'head'],
    [-1, 2 + s * 0.3, s / 2 + 2.6, 0.8, 0.8, 0.3, eyes, 'head'],
    [1, 2 + s * 0.3, s / 2 + 2.6, 0.8, 0.8, 0.3, eyes, 'head'],
    [0, 2 + s * 0.42, s / 2 + 2.6, 0.6, 0.6, 0.3, eyes, 'head'],
  ];
  for (let i = 0; i < 4; i++) {
    const z = -2 + i * 1.6;
    const tagA = i % 2 ? 'legL' : 'legR';
    const tagB = i % 2 ? 'legR' : 'legL';
    b.push([-s / 2 - 2, 0, z, 3.5, 2.5, 0.8, legs, tagA], [s / 2 + 2, 0, z, 3.5, 2.5, 0.8, legs, tagB]);
  }
  return [...b, ...extras];
}

/** Mirrors boxes across x (for symmetric decorations). */
export function mirror(boxes: VoxBox[]): VoxBox[] {
  const out: VoxBox[] = [...boxes];
  for (const b of boxes) {
    const t = b[7] === 'armL' ? 'armR' : b[7] === 'armR' ? 'armL' : b[7] === 'legL' ? 'legR' : b[7] === 'legR' ? 'legL' : b[7] === 'wingL' ? 'wingR' : b[7];
    out.push([-b[0], b[1], b[2], b[3], b[4], b[5], b[6], t]);
  }
  return out;
}
