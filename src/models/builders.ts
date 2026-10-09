import type { VoxBox, VoxelModel } from '../data/types';
import type { BoxPaint, FaceSpec, Gait, SkinnedModel, SkinSpec } from '../render/creatureSkins';

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
  // Minecraft-mob face: wide square eyes over dark sockets, a nose and a mouth line
  const dark = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
  b.push([-head * 0.25, hy + head * 0.38, head / 2, head * 0.3, head * 0.22, 0.25, dark(o.skin, 0.55), 'head'], [head * 0.25, hy + head * 0.38, head / 2, head * 0.3, head * 0.22, 0.25, dark(o.skin, 0.55), 'head']);
  b.push([-head * 0.22, hy + head * 0.4, head / 2 + 0.05, 1, 1, 0.3, eye, 'head'], [head * 0.22, hy + head * 0.4, head / 2 + 0.05, 1, 1, 0.3, eye, 'head']);
  b.push([0, hy + head * 0.25, head / 2 + 0.05, head * 0.18, head * 0.2, 0.4, dark(o.skin, 0.8), 'head']);
  b.push([0, hy + head * 0.1, head / 2, head * 0.45, head * 0.1, 0.25, dark(o.skin, 0.45), 'head']);
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

// ================================================================ pixel-skinned mobs
// Creature models in the blocky dungeon-crawler style: authored in "pixel units" (16 per
// world unit at scale 1/16), one texel per unit, every box carries a BoxPaint (material,
// colour bands, hair, decals, painted face). See render/creatureSkins.ts.

/** Model scale for pixel-unit mobs: 16 units = 1 world unit. */
export const PX = 1 / 16;

/** Accumulates boxes + paints for a pixel-skinned mob. */
export class Mob {
  readonly boxes: VoxBox[] = [];
  readonly paints: (BoxPaint | undefined)[] = [];
  readonly pivots: Record<string, [number, number, number]> = {};

  /** Box with x/z centre and BOTTOM y, in pixel units. Returns its index. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, c: number, tag?: string, p?: BoxPaint): number {
    this.boxes.push(tag ? [x, y, z, w, h, d, c, tag] : [x, y, z, w, h, d, c]);
    this.paints.push(p);
    return this.boxes.length - 1;
  }

  /** Box at +x and its mirror at -x; L/R tags are swapped on the mirror. tag is the +x side's tag. */
  pair(x: number, y: number, z: number, w: number, h: number, d: number, c: number, tag?: string, p?: BoxPaint) {
    const flip = (t?: string) => (t === 'armL' ? 'armR' : t === 'armR' ? 'armL' : t === 'legL' ? 'legR' : t === 'legR' ? 'legL' : t === 'wingL' ? 'wingR' : t === 'wingR' ? 'wingL' : t);
    this.box(x, y, z, w, h, d, c, tag, p);
    this.box(-x, y, z, w, h, d, c, flip(tag), p ? { ...p, seed: (p.seed ?? 0) + 17 } : undefined);
  }

  build(scale = PX, extra: { gait?: Partial<Gait>; px?: number } = {}): SkinnedModel {
    const skin: SkinSpec = { paints: this.paints, gait: extra.gait, px: extra.px };
    if (Object.keys(this.pivots).length) skin.pivots = this.pivots;
    return { boxes: this.boxes, scale, skin };
  }
}

export interface BipedOpts {
  /** Head w, h, d (default 8). */
  head?: [number, number, number];
  /** Torso w, h, d (default 8, 12, 4). */
  body?: [number, number, number];
  /** Arm w, h, d (default 4, 12, 4). */
  arm?: [number, number, number];
  /** Leg w, h, d (default 4, 12, 4). */
  leg?: [number, number, number];
  skin: number;
  /** Head colour (default skin). */
  headColor?: number;
  shirt: number;
  pants: number;
  shoes?: number;
  /** Arm colour above the hands (default shirt). */
  sleeve?: number;
  /** Units of bare hand at the bottom of the arms (default 4). */
  hand?: number;
  /** Units of shoe at the bottom of the legs (default 2). */
  shoe?: number;
  face: FaceSpec;
  hair?: BoxPaint['hair'];
  headPaint?: BoxPaint;
  bodyPaint?: BoxPaint;
  armPaint?: BoxPaint;
  legPaint?: BoxPaint;
  /** Zombie pose: arms stretched forward. */
  armsForward?: boolean;
  /** Robe: the torso continues down to this height above the ground. */
  robe?: number;
  robeColor?: number;
  robePaint?: BoxPaint;
  /** Head pushed forward (hunched). */
  hunch?: number;
  /** Lower the head into the shoulders by this many units. */
  neck?: number;
  /** Gap between the legs. */
  legGap?: number;
}

export interface BipedRig {
  legH: number;
  bodyTop: number;
  headY: number;
  headTop: number;
  headZ: number;
  armX: number;
  bodyW: number;
  bodyD: number;
  head: [number, number, number];
  arm: [number, number, number];
  /** Index of the head box. */
  headIdx: number;
}

/** Blocky humanoid (legs, torso, arms, head) with painted clothes and a face. */
export function biped(m: Mob, o: BipedOpts): BipedRig {
  const [hw, hh, hd] = o.head ?? [8, 8, 8];
  const [bw, bh, bd] = o.body ?? [8, 12, 4];
  const [aw, ah, ad] = o.arm ?? [4, 12, 4];
  const [lw, lh, ld] = o.leg ?? [4, 12, 4];
  const gap = o.legGap ?? 0;
  const shoes = o.shoes ?? shadeHex(o.pants, 0.55);
  const lx = lw / 2 + gap / 2;
  const legP: BoxPaint = { mat: 'cloth', bands: [[o.shoe ?? 2, shoes, 'leather']], ...o.legPaint };
  m.pair(lx, 0, 0, lw, lh, ld, o.pants, 'legR', legP);
  const bodyTop = lh + bh;
  if (o.robe !== undefined) {
    const rc = o.robeColor ?? o.shirt;
    m.box(0, o.robe, 0, bw + 1, lh - o.robe + 1, bd + 2, rc, 'body', { mat: 'cloth', front: 'trim', side: 'rag', back: 'rag', ...o.robePaint });
  }
  m.box(0, lh, 0, bw, bh, bd, o.shirt, 'body', { mat: 'cloth', ...o.bodyPaint });
  const ax = bw / 2 + aw / 2;
  const sleeve = o.sleeve ?? o.shirt;
  const hand = o.hand ?? 4;
  if (o.armsForward) {
    const len = ah;
    const zc = len / 2 - ad / 2;
    m.pair(ax, bodyTop - aw, zc - hand / 2, aw, ad, len - hand, sleeve, 'armL', { mat: 'cloth', ...o.armPaint });
    m.pair(ax, bodyTop - aw, zc + len / 2 - hand / 2, aw, ad, hand, o.skin, 'armL', { mat: 'skin' });
    m.pivots.armL = [ax, bodyTop - aw / 2, 0];
    m.pivots.armR = [-ax, bodyTop - aw / 2, 0];
  } else {
    m.pair(ax, bodyTop - ah, 0, aw, ah, ad, sleeve, 'armL', { mat: 'cloth', bands: [[hand, o.skin, 'skin']], ...o.armPaint });
  }
  const neck = o.neck ?? 0;
  const headY = bodyTop - neck;
  const headZ = o.hunch ?? 0;
  const hc = o.headColor ?? o.skin;
  const headIdx = m.box(0, headY, headZ, hw, hh, hd, hc, 'head', { mat: 'skin', face: o.face, hair: o.hair, ...o.headPaint });
  return { legH: lh, bodyTop, headY, headTop: headY + hh, headZ, armX: ax, bodyW: bw, bodyD: bd, head: [hw, hh, hd], arm: [aw, ah, ad], headIdx };
}

export interface QuadMobOpts {
  /** Body w, h, d. */
  body: [number, number, number];
  legH: number;
  legW?: number;
  head: [number, number, number];
  snout?: [number, number, number];
  fur: number;
  headColor?: number;
  snoutColor?: number;
  legColor?: number;
  belly?: number;
  mat?: BoxPaint['mat'];
  face: FaceSpec;
  /** Ear w, h, d (pair on top of the head). */
  ears?: [number, number, number];
  earColor?: number;
  /** Tail w, h, d (behind the body). */
  tail?: [number, number, number];
  tailColor?: number;
  tailPaint?: BoxPaint;
  /** Mane/shoulder block over the front half of the body: w, h, d. */
  mane?: [number, number, number];
  maneColor?: number;
  bodyPaint?: BoxPaint;
  headPaint?: BoxPaint;
  /** Head height offset relative to the body top. */
  headDy?: number;
}

export interface QuadRig {
  legH: number;
  bodyTop: number;
  headY: number;
  headZ: number;
  headTop: number;
  bodyD: number;
  headIdx: number;
}

/** Four-legged mob facing +z; diagonal legs share a tag so they trot. */
export function quadMob(m: Mob, o: QuadMobOpts): QuadRig {
  const [bw, bh, bd] = o.body;
  const lw = o.legW ?? 2;
  const lx = bw / 2 - lw / 2;
  const lz = bd / 2 - lw / 2;
  const legC = o.legColor ?? o.fur;
  const mat = o.mat ?? 'fur';
  const legP: BoxPaint = { mat, bands: [[1, shadeHex(legC, 0.7), mat]] };
  m.box(lx, 0, lz, lw, o.legH, lw, legC, 'legL', legP);
  m.box(-lx, 0, -lz, lw, o.legH, lw, legC, 'legL', legP);
  m.box(-lx, 0, lz, lw, o.legH, lw, legC, 'legR', legP);
  m.box(lx, 0, -lz, lw, o.legH, lw, legC, 'legR', legP);
  m.box(0, o.legH, 0, bw, bh, bd, o.fur, 'body', { mat, ...(o.belly !== undefined ? { bands: [[1, o.belly, mat]] } : {}), ...o.bodyPaint });
  if (o.mane) {
    const [mw, mh, md] = o.mane;
    m.box(0, o.legH - 1, bd / 2 - md / 2 + 1, mw, mh, md, o.maneColor ?? o.fur, 'body', { mat });
  }
  const [hw, hh, hd] = o.head;
  const headY = o.legH + bh - hh * 0.7 + (o.headDy ?? 0);
  const headZ = bd / 2 + hd / 2 - 1;
  const hc = o.headColor ?? o.fur;
  const headIdx = m.box(0, headY, headZ, hw, hh, hd, hc, 'head', { mat, face: o.face, ...o.headPaint });
  if (o.snout) {
    const [sw, sh, sd] = o.snout;
    m.box(0, headY, headZ + hd / 2 + sd / 2, sw, sh, sd, o.snoutColor ?? hc, 'head', { mat, face: { style: 'snout' } });
  }
  if (o.ears) {
    const [ew, eh, ed] = o.ears;
    m.pair(hw / 2 - ew / 2, headY + hh, headZ - hd / 2 + ed / 2 + 1, ew, eh, ed, o.earColor ?? hc, 'head', { mat });
  }
  if (o.tail) {
    const [tw, th, td] = o.tail;
    m.box(0, o.legH + bh - th - 0.5, -bd / 2 - td / 2, tw, th, td, o.tailColor ?? o.fur, 'tail', { mat, ...o.tailPaint });
  }
  return { legH: o.legH, bodyTop: o.legH + bh, headY, headZ, headTop: headY + hh, bodyD: bd, headIdx };
}

export function shadeHex(c: number, k: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export interface TreantOpts {
  bark: number;
  barkDark: number;
  leaf: number;
  leafLight: number;
  glow: number;
  flower?: number;
  scale: number;
}

/** Walking tree: root legs, hollow trunk with a glowing heart, craggy face, leaf crown, branch arms. */
export function treant(o: TreantOpts): SkinnedModel {
  const m = new Mob();
  const bark: BoxPaint = { mat: 'bark' };
  m.pair(5, 0, 0, 7, 12, 7, o.barkDark, 'legR', { ...bark, bands: [[2, shadeHex(o.barkDark, 0.8), 'bark']] });
  m.pair(8, 0, 4, 3, 2, 4, o.barkDark, 'legR', bark);
  m.box(0, 12, 0, 18, 18, 10, o.bark, 'body', { mat: 'bark', front: 'core', accent: o.glow });
  m.box(0, 29, -0.5, 19, 2, 11, o.leaf, 'body', { mat: 'leaf' });
  m.box(0, 28, 1, 12, 11, 10, shadeHex(o.bark, 1.15), 'head', { mat: 'bark', face: { style: 'treant', eye: o.glow } });
  m.box(0, 36, 0, 24, 8, 20, o.leaf, 'head', { mat: 'leaf' });
  m.box(0, 44, -1, 16, 5, 14, o.leafLight, 'head', { mat: 'leaf' });
  if (o.flower !== undefined) {
    m.box(-7, 43, 7, 3, 3, 3, o.flower, 'head', { mat: 'plain' });
    m.box(8, 40, -6, 3, 3, 3, o.flower, 'head', { mat: 'plain' });
  }
  m.box(9, 41, 3, 2, 2, 2, o.glow, 'head', { mat: 'glow' });
  m.pair(12, 6, 0, 6, 22, 7, o.bark, 'armL', { ...bark, bands: [[6, o.barkDark, 'bark']] });
  m.pair(12, 27, 0, 7, 4, 8, o.leaf, 'armL', { mat: 'leaf' });
  m.pair(13.5, 2, 2, 2, 4, 2, o.barkDark, 'armL', bark);
  m.pair(10.5, 2, 2, 2, 4, 2, o.barkDark, 'armL', bark);
  return m.build(o.scale, { gait: { leg: 0.35, arm: 0.3, roll: 0.06, bob: 0.05 } });
}
