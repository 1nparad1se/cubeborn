import type { RigPart, V3 } from '../../render/rig/shapes';
import type { Proportions } from '../../render/rig/HeroRig';

/** Authoring helpers for hero rigs. Units are voxels, +z is the front, R limbs sit on -x. */

export type PartOpts = Partial<Omit<RigPart, 'b' | 'p' | 'd' | 'c'>>;

export function P(b: string, p: V3, d: V3, c: number, o: PartOpts = {}): RigPart {
  return { b, p, d, c, ...o };
}

/** Multiplies a colour's brightness. */
export function shade(c: number, k: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

const SWAP: Record<string, string> = {
  armL: 'armR', foreL: 'foreR', handL: 'handR', legL: 'legR', shinL: 'shinR', footL: 'footR',
  armR: 'armL', foreR: 'foreL', handR: 'handL', legR: 'legL', shinR: 'shinL', footR: 'footL',
};

/** Mirror of a part across x: limb parts move to the opposite limb. */
export function mirrorPart(q: RigPart): RigPart {
  return {
    ...q,
    b: SWAP[q.b] ?? q.b,
    p: [-q.p[0], q.p[1], q.p[2]],
    r: q.r ? [q.r[0], -q.r[1], -q.r[2]] : undefined,
    sh: q.sh ? [-q.sh[0], q.sh[1]] : undefined,
  };
}

/** The parts plus their mirrored copies. */
export function sym(parts: RigPart[]): RigPart[] {
  return [...parts, ...parts.map(mirrorPart)];
}

// ---------------------------------------------------------------- body builders

export interface LegOpts {
  pants: number;
  boots: number;
  /** Thigh / shin widths. */
  thighW?: number;
  shinW?: number;
  knee?: number;
  /** Boot cuff height above the ankle (0 = low shoes). */
  cuff?: number;
  cuffColor?: number;
  toe?: number;
  sole?: number;
}

/** Two-segment legs with shaped thighs, calves, boots with a raised toe cap. */
export function legs(pr: Proportions, o: LegOpts): RigPart[] {
  const tw = o.thighW ?? 2.3;
  const sw = o.shinW ?? 2.0;
  const cuff = o.cuff ?? 1.6;
  const L: RigPart[] = [
    P('legL', [0, -pr.thigh / 2 + 0.1, 0], [tw * 0.9, pr.thigh + 0.5, tw], o.pants, { s: 'rbox', t: [1.14, 1.08], bv: [0.45, 0.2] }),
    P('shinL', [0, -pr.shin / 2 + 0.05, 0.05], [sw * 0.92, pr.shin + 0.3, sw * 0.98], o.pants, { s: 'rbox', t: [1.12, 1.12], bv: [0.4, 0.15] }),
    // boot: shaft, foot, toe cap, sole
    P('footL', [0, -pr.foot * 0.5 + 0.1, 0.1], [2.1, pr.foot + 0.2, 2.3], o.boots, { s: 'rbox', bv: [0.45, 0.1] }),
    P('footL', [0, -pr.foot + 0.5, 0.75], [2.15, 1.0, 3.3], o.boots, { s: 'rbox', t: [0.96, 0.88], sh: [0, -0.15], bv: [0.55, 0.35] }),
    P('footL', [0, -pr.foot + 0.12, 0.65], [2.25, 0.24, 3.55], o.sole ?? shade(o.boots, 0.55), { flat: true }),
  ];
  if (o.toe !== undefined) L.push(P('footL', [0, -pr.foot + 0.75, 1.95], [1.9, 0.7, 0.8], o.toe));
  if (cuff > 0) L.push(P('shinL', [0, -pr.shin + cuff / 2 - 0.1, 0.05], [sw + 0.3, cuff, sw + 0.35], o.cuffColor ?? o.boots, { s: 'rbox', t: [1.06, 1.06], bv: [0.45, 0.15] }));
  if (o.knee !== undefined) L.push(P('shinL', [0, -0.1, 0.55], [sw + 0.2, 1.3, 1.4], o.knee, { s: 'rbox', t: [0.85, 0.85], bv: [0.4, 0.3, 0.3] }));
  return sym(L);
}

export interface TorsoOpts {
  shirt: number;
  pants: number;
  belt?: number;
  buckle?: number;
  /** Chest width at the bottom; the top flares by `flare`. */
  chestW?: number;
  flare?: number;
  chestD?: number;
  chestH?: number;
  waistW?: number;
}

/** Pelvis, belt, waist and a chest that widens toward the shoulders. */
export function torso(pr: Proportions, o: TorsoOpts): RigPart[] {
  const cw = o.chestW ?? 5.6;
  const cd = o.chestD ?? pr.depth - 0.2;
  const ch = o.chestH ?? 4.1;
  const ww = o.waistW ?? cw * 0.86;
  const out: RigPart[] = [
    P('hips', [0, 0.25, 0], [ww + 0.3, 2.1, cd * 0.92], o.pants, { s: 'rbox', bv: [0.7, 0.1, 0.5] }),
    P('spine', [0, 0.55, 0], [ww, 1.9, cd * 0.88], o.shirt, { s: 'rbox', t: [1.06, 1.05], bv: [0.7, 0] }),
    P('chest', [0, ch / 2 - 0.15, 0], [cw, ch, cd], o.shirt, { s: 'rbox', t: [o.flare ?? 1.22, 1.06], bv: [0.8, 0.6] }),
  ];
  if (o.belt !== undefined) out.push(P('hips', [0, 1.05, 0], [ww + 0.6, 0.75, cd * 0.97], o.belt, { flat: true }));
  if (o.buckle !== undefined) out.push(P('hips', [0, 1.05, cd * 0.49], [1.1, 0.85, 0.3], o.buckle, { flat: true }));
  return out;
}

export interface ArmOpts {
  sleeve: number;
  skin: number;
  /** Forearm colour (bracers, bare skin...). */
  fore?: number;
  glove?: number;
  upperW?: number;
  foreW?: number;
  /** Deltoid cap colour (defaults to the sleeve). */
  shoulder?: number;
  shoulderSize?: number;
  cuff?: number;
}

/** Shoulder cap, tapered upper arm, forearm and a hand with a thumb. */
export function arms(pr: Proportions, o: ArmOpts): RigPart[] {
  const uw = o.upperW ?? 1.85;
  const fw = o.foreW ?? 1.75;
  const ss = o.shoulderSize ?? 2.3;
  const glove = o.glove ?? o.skin;
  const L: RigPart[] = [
    P('armL', [0.1, -0.35, 0], [ss, ss * 0.85, ss], o.shoulder ?? o.sleeve, { s: 'rbox', t: [0.82, 0.86], bv: [0.55, 0.5] }),
    P('armL', [0, -pr.upperArm / 2 - 0.15, 0], [uw, pr.upperArm + 0.3, uw * 1.02], o.sleeve, { s: 'rbox', t: [1.1, 1.08], bv: [0.42, 0] }),
    P('foreL', [0, -pr.foreArm / 2 + 0.1, 0.02], [fw * 0.92, pr.foreArm + 0.2, fw * 0.95], o.fore ?? o.sleeve, { s: 'rbox', t: [1.12, 1.1], bv: [0.4, 0] }),
    P('handL', [0, -0.75, 0.1], [1.45, 1.55, 1.6], glove, { s: 'rbox', t: [1.05, 1], bv: [0.35, 0, 0.35] }),
    P('handL', [-0.55, -0.55, 0.75], [0.55, 0.9, 0.6], glove),
  ];
  if (o.cuff !== undefined) L.push(P('foreL', [0, -pr.foreArm + 0.45, 0.02], [fw + 0.15, 0.7, fw + 0.2], o.cuff, { flat: true }));
  return sym(L);
}

export interface HeadOpts {
  skin: number;
  eyes?: number;
  eyeWhite?: number;
  brows?: number;
  mouth?: number;
  /** Head size (w, h, d). */
  size?: V3;
  noFace?: boolean;
  noEars?: boolean;
  nose?: number;
  glowEyes?: boolean;
  /** Skip nose and mouth (masks, scarves, beards drawn by the hero). */
  noLower?: boolean;
}

/** Head: skull block, narrower jaw, ears, eyes with whites, brows, nose and mouth. */
export function head(o: HeadOpts): RigPart[] {
  const [w, hh, d] = o.size ?? [5.8, 5.3, 5.4];
  const out: RigPart[] = [
    P('head', [0, 1.05 + hh * 0.56, -0.05], [w, hh * 0.78, d], o.skin, { s: 'rbox', t: [1, 0.98], bv: [1.0, 0.9, 0.3] }),
    P('head', [0, 1.2, 0.15], [w * 0.88, 1.9, d * 0.86], o.skin, { s: 'rbox', t: [1.12, 1.1], bv: [1.0, 0, 0.6] }),
  ];
  if (!o.noEars) out.push(...sym([P('head', [w / 2 + 0.15, 2.9, 0], [0.5, 1.3, 1.1], shade(o.skin, 0.92))]));
  if (o.noFace) return out;
  const fz = d / 2 + 0.05;
  const ey = 3.0;
  const eyes = o.eyes ?? 0x1a1a2a;
  if (o.glowEyes) out.push(...sym([P('head', [1.2, ey, fz], [1.0, 0.55, 0.25], eyes, { g: true, r: [0, 0, -8] })]));
  else
    out.push(
      ...sym([
        P('head', [1.25, ey, fz], [1.3, 1.25, 0.2], o.eyeWhite ?? 0xf4f0ea, { flat: true }),
        P('head', [1.05, ey - 0.1, fz + 0.06], [0.7, 1.0, 0.2], eyes, { flat: true }),
      ]),
    );
  if (o.brows !== undefined) out.push(...sym([P('head', [1.25, ey + 1.0, fz], [1.6, 0.42, 0.3], o.brows, { r: [0, 0, -6], flat: true })]));
  if (o.glowEyes) out.push(...sym([P('head', [1.2, ey, fz - 0.02], [1.4, 0.95, 0.2], 0x1a1620, { flat: true, r: [0, 0, -8] })]));
  if (o.noLower) return out;
  out.push(P('head', [0, 2.2, fz + 0.2], [0.85, 1.05, 0.6], o.nose ?? shade(o.skin, 0.93), { t: [0.8, 0.7] }));
  out.push(P('head', [0, 1.35, fz - 0.08], [1.5, 0.3, 0.2], o.mouth ?? shade(o.skin, 0.62), { flat: true }));
  return out;
}

/** Ring of small boxes (halos, collars, rims) around the y axis. */
export function ring(b: string, center: V3, radius: number, n: number, size: V3, c: number, o: PartOpts = {}): RigPart[] {
  const out: RigPart[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(P(b, [center[0] + Math.sin(a) * radius, center[1], center[2] + Math.cos(a) * radius], size, c, { ...o, r: [0, (a * 180) / Math.PI, 0] }));
  }
  return out;
}
