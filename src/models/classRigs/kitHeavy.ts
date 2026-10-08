import type { RigPart, V3 } from '../../render/rig/shapes';
import { DEFAULT_PROPS, type Proportions } from '../../render/rig/HeroRig';
import { P, type PartOpts } from '../heroRigs/kit';

/**
 * Extra authoring helpers for the heavy classes (Berserker, Paladin, Templar): weapon parts
 * placed relative to the grip point, rings in the vertical plane (halos, seals, shield rims),
 * rivet rows and ragged cloth hems.
 */

export function props(o: Partial<Proportions>): Proportions {
  return { ...DEFAULT_PROPS, ...o };
}

/**
 * Builder for a held item: parts are given relative to the grip point (the pivot), so the
 * weapon reads in its own frame (+z along the blade / haft, +y toward the knuckles).
 */
export function held(b: 'gripL' | 'gripR', at: V3) {
  return (p: V3, d: V3, c: number, o: PartOpts = {}): RigPart => P(b, [at[0] + p[0], at[1] + p[1], at[2] + p[2]], d, c, o);
}

/** Ring of boxes in the x/y plane around the z axis (discs seen from the front or back). */
export function ringZ(b: string, center: V3, radius: number, n: number, size: V3, c: number, o: PartOpts = {}, phase = 0): RigPart[] {
  const out: RigPart[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + phase) / n) * Math.PI * 2;
    out.push(P(b, [center[0] + Math.sin(a) * radius, center[1] + Math.cos(a) * radius, center[2]], size, c, { ...o, r: [0, 0, (-a * 180) / Math.PI] }));
  }
  return out;
}

/** Ring of boxes in the x/z plane around the y axis, starting at the front. */
export function ringY(b: string, center: V3, radius: number, n: number, size: V3, c: number, o: PartOpts = {}, phase = 0): RigPart[] {
  const out: RigPart[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + phase) / n) * Math.PI * 2;
    out.push(P(b, [center[0] + Math.sin(a) * radius, center[1], center[2] + Math.cos(a) * radius], size, c, { ...o, r: [0, (a * 180) / Math.PI, 0] }));
  }
  return out;
}

/** Small studs at the given points. */
export function rivets(b: string, pts: V3[], c: number, s = 0.36): RigPart[] {
  return pts.map((p) => P(b, p, [s, s, s], c, { flat: true }));
}

/**
 * A ragged hem: a row of tabs of varying length hanging below `y` across `width`,
 * on a face at depth `z` (cloth panels, torn tabards, fur fringes).
 */
export function hem(b: string, x0: number, width: number, y: number, z: number, lens: number[], c: number, thick = 0.4, o: PartOpts = {}): RigPart[] {
  const n = lens.length;
  const w = width / n;
  return lens.map((len, i) => P(b, [x0 - width / 2 + w * (i + 0.5), y - len / 2, z], [w * 0.92, len, thick], c, { t: [1.25, 1], ...o }));
}
