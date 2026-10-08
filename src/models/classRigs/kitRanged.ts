import type { RigPart, V3 } from '../../render/rig/shapes';
import { P, shade, sym, type PartOpts } from '../heroRigs/kit';

/** Authoring helpers shared by the Ranger, Summoner and Sorceress models (voxel units, +z front). */

const DEG = 180 / Math.PI;

/** A box stretched between two points (its height runs from `a` to `c`); `wd` = width, depth. */
export function seg(b: string, a: V3, c: V3, wd: [number, number], col: number, o: PartOpts = {}): RigPart {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  const rz = -Math.asin(Math.max(-1, Math.min(1, nx))) * DEG;
  const rx = Math.atan2(nz, ny) * DEG;
  return P(b, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], [wd[0], len + (o.s === 'cyl' ? 0 : wd[1] * 0.15), wd[1]], col, { ...o, r: [rx, 0, rz] });
}

/** A polyline of segments; `taper` shrinks the thickness toward the last point. */
export function curve(b: string, pts: V3[], wd: [number, number], col: number, o: PartOpts & { taper?: number } = {}): RigPart[] {
  const out: RigPart[] = [];
  const { taper = 1, ...rest } = o;
  for (let i = 0; i + 1 < pts.length; i++) {
    const k = 1 + (taper - 1) * (i / Math.max(1, pts.length - 2));
    out.push(seg(b, pts[i], pts[i + 1], [wd[0] * k, wd[1] * k], col, rest));
  }
  return out;
}

/** Feminine face details over head(): lashes, lips, blush and a soft chin (head size w, d). */
export function softFace(skin: number, lash: number, lips: number, d = 5.2): RigPart[] {
  const fz = d / 2 + 0.06;
  return [
    ...sym([
      P('head', [1.55, 3.72, fz + 0.04], [1.25, 0.32, 0.18], lash, { flat: true, r: [0, 0, -10] }),
      P('head', [2.05, 3.55, fz + 0.04], [0.35, 0.3, 0.16], lash, { flat: true, r: [0, 0, -35] }),
      P('head', [1.85, 2.15, fz - 0.02], [0.75, 0.4, 0.12], shade(lips, 1.15), { flat: true }),
    ]),
    P('head', [0, 1.35, fz - 0.02], [1.1, 0.42, 0.16], lips, { flat: true }),
    P('head', [0, 1.6, fz - 0.03], [0.6, 0.16, 0.14], shade(skin, 0.86), { flat: true }),
  ];
}

/** Small glowing motes scattered on a ring (for spin bones). */
export function motes(b: string, r: number, n: number, y: number, size: number, cols: number[], o: PartOpts = {}): RigPart[] {
  const out: RigPart[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const s = size * (i % 2 ? 0.7 : 1);
    out.push(P(b, [Math.sin(a) * r, y + Math.sin(i * 2.3) * 0.9, Math.cos(a) * r], [s, s * 1.3, s], cols[i % cols.length], { s: 'gem', g: true, ...o }));
  }
  return out;
}

/** A leaf: flattened gem with a darker midrib. */
export function leaf(b: string, p: V3, size: number, rot: V3, col: number, glow = false): RigPart[] {
  return [
    P(b, p, [size * 0.55, size, size * 0.16], col, { s: 'gem', r: rot, g: glow, flat: true }),
  ];
}

/** Like sym() but keeps every part on its own bone (for symmetric props on one grip bone). */
export function symX(parts: RigPart[]): RigPart[] {
  return [...parts, ...parts.map((q) => ({ ...q, p: [-q.p[0], q.p[1], q.p[2]] as V3, r: q.r ? ([q.r[0], -q.r[1], -q.r[2]] as V3) : undefined, sh: q.sh ? ([-q.sh[0], q.sh[1]] as [number, number]) : undefined }))];
}
