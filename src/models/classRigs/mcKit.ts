import { DEFAULT_PROPS, type Proportions } from '../../render/rig/HeroRig';
import type { RigPart, V3 } from '../../render/rig/shapes';
import { shade, skinBox, type FaceId, type Painter, type Pix, type SkinBox } from '../../render/rig/skins';

/**
 * Minecraft-Dungeons style hero kit: blocky Minecraft proportions (8x8x8 head, 8x12x4 body,
 * 4x12x4 limbs, one voxel per texel) built from a few big pixel-skinned boxes, plus pixel-art
 * held items extruded from sprites. Limbs are split at the elbows / knees so the existing
 * clips still bend them; each lower segment reaches one texel up inside the upper one (and is
 * a hair thinner) so bending never opens a gap.
 */

/** Voxel size of the blocky heroes: 32 voxels tall, about as tall in the world as before. */
export const MC_SCALE = 0.057;
/** Clip translations (rootPos / hipsPos) keep the units they were authored in. */
export const MC_POS_SCALE = 0.085;

export function mcProps(slim = false, o: Partial<Proportions> = {}): Proportions {
  return {
    ...DEFAULT_PROPS,
    thigh: 6,
    shin: 5,
    foot: 1,
    hipX: 2,
    spine: 2.9,
    shoulderY: 6,
    shoulderX: slim ? 5.5 : 6,
    upperArm: 5,
    foreArm: 3,
    neck: 8,
    depth: 4,
    ...o,
  };
}

export type Side = 'L' | 'R';

/** Skinned box part: centre in bone space, optional slice / inflation / rotation. */
export function cube(b: string, p: V3, box: SkinBox, o: { y0?: number; y1?: number; inf?: number; r?: V3; g?: boolean; grp?: string; c?: number; px?: number } = {}): RigPart {
  return { b, p, d: [box.w, box.h, box.d], c: o.c ?? 0xffffff, r: o.r, g: o.g, grp: o.grp, sk: { box, y0: o.y0, y1: o.y1, inf: o.inf, px: o.px } };
}

interface Slice {
  b: string;
  y0: number;
  y1: number;
  /** Top of the slice in bone space. */
  top: number;
  inset: number;
}

const BODY_SLICES: Slice[] = [
  { b: 'chest', y0: 0, y1: 8, top: 8, inset: 0 },
  { b: 'spine', y0: 7, y1: 10, top: 3.9, inset: 0.04 },
  { b: 'hips', y0: 9, y1: 12, top: 3, inset: 0.08 },
];
const ARM_SLICES: Slice[] = [
  { b: 'arm', y0: 0, y1: 7, top: 2, inset: 0 },
  { b: 'fore', y0: 6, y1: 10, top: 1, inset: 0.04 },
  { b: 'hand', y0: 9, y1: 12, top: 1, inset: 0.08 },
];
const LEG_SLICES: Slice[] = [
  { b: 'leg', y0: 0, y1: 6, top: 0, inset: 0 },
  { b: 'shin', y0: 5, y1: 12, top: 1, inset: 0.04 },
];

function sliced(slices: Slice[], box: SkinBox, side: Side | '', x: number, z: number, inf: number, o: { from?: number; to?: number } = {}): RigPart[] {
  const out: RigPart[] = [];
  for (const s of slices) {
    const y0 = Math.max(s.y0, o.from ?? 0);
    const y1 = Math.min(s.y1, o.to ?? box.h);
    if (y1 - y0 <= 0) continue;
    const top = s.top - (y0 - s.y0);
    const h = y1 - y0;
    out.push(cube(s.b + side, [x, top - h / 2, z], box, { y0, y1, inf: inf - s.inset }));
  }
  return out;
}

/** Body (8x12x4) on hips / spine / chest; `inf` > 0 for a jacket or armour layer. */
export function body(box: SkinBox, inf = 0, o: { from?: number; to?: number; z?: number } = {}): RigPart[] {
  return sliced(BODY_SLICES, box, '', 0, o.z ?? 0, inf, o);
}

/** One arm (w x 12 x 4) split over arm / fore / hand. */
export function arm(side: Side, box: SkinBox, inf = 0, o: { from?: number; to?: number } = {}): RigPart[] {
  return sliced(ARM_SLICES, box, side, 0, 0, inf, o);
}

/** One leg (4x12x4) split over leg / shin. */
export function leg(side: Side, box: SkinBox, inf = 0, o: { from?: number; to?: number } = {}): RigPart[] {
  return sliced(LEG_SLICES, box, side, 0, 0, inf, o);
}

/** Head (8x8x8 by default) sitting on the neck joint. */
export function headCube(box: SkinBox, inf = 0, o: { y?: number; z?: number } = {}): RigPart {
  return cube('head', [0, (o.y ?? 0) + box.h / 2, o.z ?? 0], box, { inf });
}

export interface HumanSkin {
  head: Painter;
  /** Hat layer: 8x8x8 inflated by 0.5 (hoods, hair volume, helmets); clear texels are cut out. */
  hat?: Painter;
  body: Painter;
  /** Jacket layer over the body, inflated by 0.3. */
  jacket?: Painter;
  arm: (side: Side) => Painter;
  /** Sleeve layer over the arms (inflated 0.3). */
  sleeve?: (side: Side) => Painter;
  leg: (side: Side) => Painter;
  /** Trouser / greave layer over the legs (inflated 0.25). */
  pants?: (side: Side) => Painter;
  /** 3-wide arms. */
  slim?: boolean;
  name: string;
  /** Soft vertical shading on body and limbs (default on). */
  shading?: boolean;
}

/** A full Minecraft-proportioned hero body with optional overlay layers. */
export function humanoid(s: HumanSkin): RigPart[] {
  const aw = s.slim ? 3 : 4;
  const out: RigPart[] = [];
  const sh = s.shading === false ? (p: Painter) => p : soft;
  out.push(headCube(skinBox(s.name + '.head', [8, 8, 8], dimTop(s.head))));
  if (s.hat) out.push(headCube(skinBox(s.name + '.hat', [8, 8, 8], dimTop(s.hat)), 0.5));
  const bodyBox = skinBox(s.name + '.body', [8, 12, 4], sh(s.body));
  out.push(...body(bodyBox));
  if (s.jacket) out.push(...body(skinBox(s.name + '.jacket', [8, 12, 4], s.jacket), 0.3));
  for (const side of ['L', 'R'] as Side[]) {
    out.push(...arm(side, skinBox(`${s.name}.arm${side}`, [aw, 12, 4], sh(s.arm(side)))));
    if (s.sleeve) out.push(...arm(side, skinBox(`${s.name}.sleeve${side}`, [aw, 12, 4], s.sleeve(side)), 0.3));
    out.push(...leg(side, skinBox(`${s.name}.leg${side}`, [4, 12, 4], sh(s.leg(side)))));
    if (s.pants) out.push(...leg(side, skinBox(`${s.name}.pants${side}`, [4, 12, 4], s.pants(side)), 0.25));
  }
  return out;
}

/**
 * Tops of heads catch the most light under the high game camera (and trip the bloom): paint
 * them a little darker so hair and helmets keep their colour.
 */
export function dimTop(p: Painter, k = 0.8): Painter {
  return (f, g) => {
    p(f, g);
    if (f === 'T') g.tint(0, 0, g.w, g.h, k);
  };
}

/** Wraps a painter with a soft top-to-bottom shade on the side faces (painted ambient occlusion). */
export function soft(p: Painter, top = 1.04, bottom = 0.86): Painter {
  return (f, g) => {
    p(f, g);
    if (isSide(f)) g.shadeV(top, bottom);
  };
}

// ---------------------------------------------------------------- generic painters

/** Plain noisy material with a darker rim on the side faces (crates, pads, horns...). */
export function solid(base: number, o: { amt?: number; edge?: number; top?: number; bottom?: number; shadeV?: boolean } = {}): Painter {
  return (f, g) => {
    g.fill(f === 'T' ? (o.top ?? shade(base, 1.08)) : f === 'D' ? (o.bottom ?? shade(base, 0.75)) : base, o.amt ?? 0.08);
    if (o.edge !== undefined && f !== 'T' && f !== 'D') g.border(o.edge, 'tblr');
    if (o.shadeV) g.shadeV();
  };
}

export function tex(name: string, size: [number, number, number], paint: Painter): SkinBox {
  return skinBox(name, size, paint);
}

/** Which side face of a limb looks outward (away from the body). */
export function outer(side: Side): FaceId {
  return side === 'L' ? 'L' : 'R';
}
export function inner(side: Side): FaceId {
  return side === 'L' ? 'R' : 'L';
}

/** Is this a vertical face (front, back or sides)? */
export function isSide(f: FaceId): boolean {
  return f !== 'T' && f !== 'D';
}

export interface FaceOpts {
  skin: number;
  /** Iris colour. */
  eye: number;
  white?: number;
  brow?: number;
  mouth?: number;
  /** Eyes on this row (default 4). */
  row?: number;
  /** Nose shadow under the eyes. */
  nose?: boolean;
}

/** Minecraft Dungeons style face on an 8-wide front: two-texel eyes, brows, nose and mouth. */
export function paintFace(g: Pix, o: FaceOpts) {
  const r = o.row ?? 4;
  const white = o.white ?? 0xf4f4f0;
  g.set(1, r, white);
  g.set(2, r, o.eye);
  g.set(5, r, o.eye);
  g.set(6, r, white);
  if (o.brow !== undefined) {
    g.rect(1, r - 1, 2, 1, o.brow);
    g.rect(5, r - 1, 2, 1, o.brow);
  }
  if (o.nose !== false) g.rect(3, r + 1, 2, 1, shade(o.skin, 0.84));
  if (o.mouth !== undefined) g.rect(3, r + 2, 2, 1, o.mouth);
}

// ---------------------------------------------------------------- pixel-art items

type Axis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
const AX: Record<Axis, V3> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

export interface ItemOpts {
  /** Bone the item is attached to (grip bones are authored in hand space). */
  b: string;
  /** Where the pivot texel's centre sits, in bone space. */
  at: V3;
  /** Pivot texel (column, row) of the sprite: the texel held in the fist. */
  pivot: [number, number];
  /** Voxels per sprite texel. */
  px?: number;
  /** Thickness in voxels. */
  th?: number;
  /** Bone-space directions of the sprite's +column and up (-row) axes. */
  u?: Axis;
  v?: Axis;
  /** Palette characters rendered bright (glowing runes, crystals). */
  glow?: string;
  grp?: string;
  /** Per-character thickness multipliers (thicker hilts or gems). */
  thick?: Record<string, number>;
}

/**
 * Minecraft-style held item: every opaque sprite texel becomes a voxel (merged per row run),
 * extruded to the item thickness. '.' and ' ' are empty.
 */
export function pixelItem(rows: string[], pal: Record<string, number>, o: ItemOpts): RigPart[] {
  const px = o.px ?? 1;
  const th = o.th ?? px;
  const u = AX[o.u ?? '+y'];
  const v = AX[o.v ?? '+z'];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const out: RigPart[] = [];
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      if (ch === '.' || ch === ' ' || pal[ch] === undefined) {
        i++;
        continue;
      }
      let k = i;
      while (k + 1 < row.length && row[k + 1] === ch) k++;
      const cu = ((i + k) / 2 - o.pivot[0]) * px;
      const cv = (o.pivot[1] - j) * px;
      const len = (k - i + 1) * px;
      const t = th * (o.thick?.[ch] ?? 1);
      const p: V3 = [o.at[0] + u[0] * cu + v[0] * cv, o.at[1] + u[1] * cu + v[1] * cv, o.at[2] + u[2] * cu + v[2] * cv];
      const d: V3 = [
        Math.abs(u[0]) * len + Math.abs(v[0]) * px + Math.abs(n[0]) * t,
        Math.abs(u[1]) * len + Math.abs(v[1]) * px + Math.abs(n[1]) * t,
        Math.abs(u[2]) * len + Math.abs(v[2]) * px + Math.abs(n[2]) * t,
      ];
      out.push({ b: o.b, p, d, c: pal[ch], flat: true, g: o.glow?.includes(ch), grp: o.grp });
      i = k + 1;
    }
  });
  return out;
}

// ---------------------------------------------------------------- shared painters

/** Grip point in hand space: the centre of the 4x2x4 fist block (2x... for slim arms). */
export const GRIP: V3 = [0, -1, 0];

/** First column of the back `n` columns on a side face (sides run front→back on L, back→front on R). */
export function backCols(f: FaceId, w: number, n: number): [number, number] {
  return f === 'L' ? [w - n, w] : [0, n];
}

export interface HairOpts {
  skin: number;
  hair: number;
  /** Rows of fringe on the front. */
  fringe?: number;
  /** How far the hair comes down on the sides and back (rows). */
  side?: number;
  back?: number;
  /** Columns of hair framing the face on the front. */
  frame?: number;
}

/** Skin head with a hair cap: fringe, sideburns / locks and back of the head. */
export function hairHead(f: FaceId, g: Pix, o: HairOpts) {
  const hairD = shade(o.hair, 0.8);
  g.fill(o.skin, 0.035);
  const fr = o.fringe ?? 2;
  const side = o.side ?? 3;
  const back = o.back ?? 8;
  if (f === 'T') {
    g.fill(o.hair, 0.1);
    return;
  }
  if (f === 'D') return;
  if (f === 'F') {
    g.nrect(0, 0, 8, fr, o.hair, 0.1);
    const fw = o.frame ?? 1;
    g.nrect(0, fr, fw, side - fr, o.hair, 0.1).nrect(8 - fw, fr, fw, side - fr, o.hair, 0.1);
    g.set(2, fr, hairD).set(5, fr, o.hair);
  } else if (f === 'B') {
    g.nrect(0, 0, 8, back, o.hair, 0.1);
    for (let x = 0; x < 8; x += 2) g.set(x, back - 1, hairD);
  } else {
    g.nrect(0, 0, 8, fr + 1, o.hair, 0.1);
    const [a, b] = backCols(f, 8, 5);
    g.nrect(a, 0, b - a, back, o.hair, 0.1);
    g.nrect(f === 'L' ? 0 : 6, 0, 2, side, o.hair, 0.1);
  }
}
