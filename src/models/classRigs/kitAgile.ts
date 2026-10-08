import type { RigPart, V3 } from '../../render/rig/shapes';
import { P, type PartOpts } from '../heroRigs/kit';

/**
 * Extra authoring helpers for the agile classes (Steel Fist, Deathblade, Reaper):
 * wrap bands, straps, curved blades and tattered hems. Units are voxels, +z is the front.
 */

/** Horizontal wrap bands around a limb segment at the given heights. */
export function bands(b: string, ys: number[], size: [number, number, number], c: number, o: PartOpts = {}): RigPart[] {
  return ys.map((y, i) => P(b, [0, y, 0], size, c, { flat: true, r: [0, 0, i % 2 ? 4 : -4], ...o }));
}

export interface BladeOpts {
  /** Bone the blade is authored on (a grip bone). */
  b: string;
  /** Where the blade leaves the guard (hand space). */
  at: V3;
  /** +1 blade runs toward +z (forward grip), -1 toward -z (reverse grip). */
  dir: 1 | -1;
  len: number;
  /** Total bend (deg) toward +y over the length: the convex side (the edge) faces -y. */
  curve: number;
  /** Blade width at the base and thickness. */
  w: number;
  th: number;
  seg?: number;
  steel: number;
  /** Glowing edge colour (omit for none). */
  edge?: number;
  /** Darker spine/fuller colour along the back. */
  spine?: number;
}

/** Point along the blade arc at distance s, and the tangent angle (rad). */
function arc(o: BladeOpts, s: number): { p: V3; phi: number } {
  const k = ((o.curve * Math.PI) / 180) / o.len;
  const phi = k * s;
  const y = k > 1e-6 ? (1 - Math.cos(phi)) / k : 0;
  const z = k > 1e-6 ? Math.sin(phi) / k : s;
  return { p: [o.at[0], o.at[1] + y, o.at[2] + o.dir * z], phi };
}

/** End point of a blade (for the effect tip). */
export function bladeTip(o: BladeOpts): V3 {
  return arc(o, o.len).p;
}

/**
 * Curved single-edged blade built from tapered segments in the hand's y-z plane (flat faces
 * along x). The last segment narrows to a point; a glowing strip runs along the cutting edge.
 */
export function curvedBlade(o: BladeOpts): RigPart[] {
  const n = o.seg ?? 5;
  const ds = o.len / n;
  const out: RigPart[] = [];
  for (let i = 0; i < n; i++) {
    const s0 = i * ds;
    const mid = arc(o, s0 + ds / 2);
    const phi = mid.phi;
    // segment local +y follows the blade direction, local +z points to the edge side for dir=+1
    const th = (Math.atan2(o.dir * Math.cos(phi), Math.sin(phi)) * 180) / Math.PI;
    const f0 = 1 - (i / n) * 0.35;
    const w = o.w * f0;
    const last = i === n - 1;
    const segLen = ds * (last ? 1.0 : 1.12);
    // the tip: narrow the top toward the spine so the point sits on the back line
    const tipOpts: PartOpts = last ? { t: [1, 0.12], sh: [0, -o.dir * w * 0.38] } : { t: [1, 0.9] };
    out.push(P(o.b, mid.p, [o.th, segLen, w], o.steel, { r: [th, 0, 0], ...tipOpts }));
    // spine bar along the back edge (thicker) and the glowing cutting edge
    const n0 = (-o.dir * w) / 2; // local z offset of the spine
    const toWorld = (lz: number): V3 => {
      const ang = (th * Math.PI) / 180;
      // local z axis after Rx(th): (0, -sin th, cos th)
      return [mid.p[0], mid.p[1] - Math.sin(ang) * lz, mid.p[2] + Math.cos(ang) * lz];
    };
    if (!last && o.spine !== undefined) out.push(P(o.b, toWorld(n0 * 0.82), [o.th * 1.5, segLen, w * 0.2], o.spine, { r: [th, 0, 0], flat: true }));
    if (o.edge !== undefined) {
      const ew = last ? w * 0.18 : w * 0.16;
      out.push(P(o.b, toWorld(-n0 * (last ? 0.55 : 0.92)), [o.th * 1.25, segLen * (last ? 0.85 : 1), ew], o.edge, { r: [th, 0, 0], g: true, ...(last ? { t: [1, 0.3], sh: [0, -o.dir * w * 0.25] } : {}) }));
    }
  }
  return out;
}

/** Ragged hem: strips of varied length hanging from a bone at height y, spread across width w. */
export function tatters(b: string, y: number, z: number, w: number, n: number, len: number, th: number, c: number, o: PartOpts = {}): RigPart[] {
  const out: RigPart[] = [];
  const pattern = [1, 0.6, 0.85, 0.5, 0.95, 0.7, 0.55, 0.9];
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + sw * (i + 0.5);
    const l = len * pattern[i % pattern.length];
    out.push(P(b, [x, y - l / 2, z], [sw * 0.92, l, th], c, { t: [0.55, 1], r: [0, 0, 180 + (i % 3) - 1], ...o }));
  }
  return out;
}
