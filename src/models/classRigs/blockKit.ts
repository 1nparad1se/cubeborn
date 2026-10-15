import type { RigPart, V3 } from '../../render/rig/shapes';

/**
 * Block-model kit shared by the hero class rigs: every model is built from many small flat-coloured,
 * softly bevelled blocks (no pixel skins), each a separate part merged per bone.
 */

/** Default bevel of a block. */
export const BV = 0.18;

export interface BlockOpts {
  r?: V3;
  g?: boolean;
  flat?: boolean;
  bv?: number;
  grp?: string;
}

/** Block from corner (x0, y0, z0) to (x1, y1, z1) in bone space, softly bevelled. */
export function bk(b: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, o: BlockOpts = {}): RigPart {
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  const d = Math.abs(z1 - z0);
  const bv = Math.min(o.bv ?? BV, w / 3, h / 3, d / 3);
  const part: RigPart = { b, s: bv > 0.02 ? 'rbox' : 'box', bv: [bv, bv, bv], p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], d: [w, h, d], c, r: o.r, g: o.g, flat: o.flat };
  if (o.grp) part.grp = o.grp;
  return part;
}

/** Block centred at (x, y, z) with size (w, h, d); handy for rotated pieces. */
export function bc(b: string, x: number, y: number, z: number, w: number, h: number, d: number, c: number, o: BlockOpts = {}): RigPart {
  return bk(b, x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, c, o);
}

/** Deterministic jitter for ragged edges. */
export function jr(n: number): number {
  const v = Math.sin(n * 91.7 + 13.1) * 43758.5;
  return v - Math.floor(v);
}
