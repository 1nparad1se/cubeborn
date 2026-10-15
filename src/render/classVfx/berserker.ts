import type { Run } from '../../game/Run';
import type { ActFx } from '../../game/action/vfx';
import type { ActionFxRenderer } from '../ActionFxRenderer';
import type { ClassVfx } from './index';

/**
 * Berserker effects after the reference sheet: a blood-red crescent slash with a hot white edge, a
 * red thrust streak for the charge, ground eruptions of dark voxel rock with glowing red cracks, a
 * spinning red ring for whirlwinds and a red star burst on impact. Every effect has five phases:
 * preparation and wind-up (drawn from the playing step before its hit lands), the main shape and
 * the impact (on the hit's first frames) and a fade (the rest of the hit's life). The moment damage
 * lands is the simulation's: these only read it.
 */

const TAU = Math.PI * 2;
const RED = 0xff1418;
const RED_HOT = 0xff5040;
const RED_DEEP = 0x9a0c14;
const WHITE = 0xffffff;
const ROCK = 0x3a3638;
const ROCK_L = 0x5a5458;
const EMBER = 0xff4030;

function rnd(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Eight-pointed red star burst with a white core (camera-facing). */
function star(p: ActionFxRenderer, x: number, y: number, z: number, s: number, k: number) {
  const a = Math.min(1, k * 1.6);
  p.glint(x, y, z, s * 1.6, RED, a * 0.55, 0);
  p.glint(x, y, z, s * 1.6, RED, a * 0.55, Math.PI / 4);
  p.glint(x, y, z, s * 0.9, RED_HOT, a * 0.8, Math.PI / 8);
  p.glint(x, y, z, s * 0.45, WHITE, a, 0);
  // pointed rays: thin bright squares stretched along eight directions
  const reach = s * (1.1 + (1 - k) * 0.9);
  for (let i = 0; i < 8; i++) {
    const b = (i / 8) * TAU;
    for (let j = 1; j <= 3; j++) {
      const d = (reach * j) / 3;
      p.square(x + Math.cos(b) * d, y + Math.sin(b) * d, z, (0.2 - j * 0.045) * a * s, j === 1 ? WHITE : RED, 1.2);
    }
  }
}

/** Ground cracks glowing red, radiating from (x, z). */
function cracks(p: ActionFxRenderer, x: number, z: number, r: number, k: number, seed: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(seed + i) * 0.6;
    const len = r * (0.6 + rnd(seed + i * 3) * 0.5);
    const segs = 4;
    let cx = x;
    let cz = z;
    let ca = a;
    for (let j = 0; j < segs; j++) {
      ca += (rnd(seed + i * 11 + j) - 0.5) * 0.7;
      const nx = cx + Math.cos(ca) * (len / segs);
      const nz = cz + Math.sin(ca) * (len / segs);
      p.b.segment(cx, 0.08, cz, nx, 0.08, nz, 0.16 * (1 - j / segs) + 0.05, RED, Math.min(1, k * 1.5));
      cx = nx;
      cz = nz;
    }
  }
}

/** Dark voxel rocks bursting out of the ground and falling back, with red ember chips. */
function rocks(p: ActionFxRenderer, x: number, z: number, r: number, k: number, seed: number, n: number) {
  const t = 1 - k;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i * 5) * TAU;
    const d = r * (0.25 + rnd(seed + i) * 0.75);
    const v = 2.4 + rnd(seed + i * 9) * 2.6;
    const out = t * (0.6 + rnd(i + seed) * 0.8);
    const y = Math.max(0, v * t - 9 * t * t) + 0.1;
    const s = (0.22 + rnd(seed + i * 2) * 0.3) * Math.min(1, k * 2.2);
    p.block(x + Math.cos(a) * (d + out), y + s * 0.5, z + Math.sin(a) * (d + out), a + t * 4, s, s, s, rnd(i) < 0.5 ? ROCK : ROCK_L, t * 3 * (rnd(i) - 0.5), t * 2);
    if (i % 3 === 0) p.square(x + Math.cos(a) * (d + out), y + s, z + Math.sin(a) * (d + out), s * 0.45, EMBER, 1.3);
  }
}

/** Jagged rock spikes rising along a line (rect smashes) or a circle (ground slams). */
function spikes(p: ActionFxRenderer, x: number, z: number, k: number, seed: number, pts: Array<[number, number]>) {
  const t = 1 - k;
  const rise = Math.min(1, t * 5);
  const sink = Math.min(1, k * 2.2);
  for (let i = 0; i < pts.length; i++) {
    const [px, pz] = pts[i];
    const h = (0.5 + rnd(seed + i) * 0.7) * rise * sink;
    const w = 0.35 + rnd(seed + i * 3) * 0.2;
    const yaw = rnd(seed + i * 7) * TAU;
    const tilt = (rnd(seed + i * 2) - 0.5) * 0.5;
    p.block(px, h * 0.5 - 0.1, pz, yaw, w, h, w, ROCK, tilt, (rnd(i + 3) - 0.5) * 0.4);
    p.block(px, h - 0.05, pz, yaw, w * 0.55, h * 0.35, w * 0.55, ROCK_L, tilt, 0);
    p.glint(px, 0.15, pz, w * 1.6, RED, sink * 0.5, 0.785);
  }
  void x;
  void z;
}

/** Red crescent slash: a wide blood-red arc with a pale hot edge over a deep red inner arc. */
function crescent(p: ActionFxRenderer, f: ActFx, r: number, arc: number, base: number, k: number, first: boolean) {
  p.arcSweep(f.x, f.z, base, arc, r * 1.05, k, 0xff1010, 1.35, f.seed);
  p.arcSweep(f.x, f.z, base, arc * 0.9, r * 0.82, Math.min(1, k * 1.15), RED_DEEP, 0.9, f.seed);
  const t = 1 - k;
  // opaque blood-red pixels along the swept crescent so it reads red on any ground
  const sweep = Math.min(1, t * 3.4 + 0.08);
  const dir = Math.floor(f.seed) % 2 === 0 ? 1 : -1;
  const m = p.n(Math.ceil(arc / 0.09));
  for (let i = 0; i < m; i++) {
    const u = (i / m) * sweep;
    const ang = dir > 0 ? base - arc / 2 + u * arc : base + arc / 2 - u * arc;
    const tip = Math.pow(Math.sin(u * Math.PI), 0.7);
    const rr = r * 0.93 - tip * r * 0.1;
    const y = 0.9 + (u - 0.5) * 0.45 * dir;
    const s = (0.1 + tip * 0.2) * Math.min(1, k * 1.8);
    p.square(f.x + Math.cos(ang) * rr, y, f.z + Math.sin(ang) * rr, s, i % 4 === 0 ? RED_HOT : i & 1 ? RED : RED_DEEP, 1.15);
  }
  // embers peeling off the arc
  const n = p.n(8);
  for (let i = 0; i < n; i++) {
    const a = base + (rnd(f.seed + i) - 0.5) * arc;
    const d = r * (0.8 + rnd(f.seed + i * 3) * 0.3) + t * 0.8;
    p.square(f.x + Math.cos(a) * d, 0.9 + (rnd(i * 5 + f.seed) - 0.3) * 0.8 + t * 0.6, f.z + Math.sin(a) * d, 0.12 * k, i & 1 ? EMBER : RED_HOT, 1.25);
  }
  if (t < 0.5) {
    const d = r * 0.7;
    star(p, f.x + Math.cos(base) * d, 1, f.z + Math.sin(base) * d, 0.55 * (1 - t), k);
  }
  if (first) p.spray('pixel', f.x + Math.cos(base) * r * 0.7, 1, f.z + Math.sin(base) * r * 0.7, 8, RED, EMBER, 4, 0.14, 0.35, Math.PI, 0.4);
}

/** Spinning red ring: two counter-rotating ribbons, a ground ring and a whirl of embers. */
function ring(p: ActionFxRenderer, f: ActFx, r: number, k: number) {
  const spin = (1 - k) * 9;
  p.arcSweep(f.x, f.z, f.a + spin, TAU, r, k, RED, 1.1, f.seed);
  p.arcSweep(f.x, f.z, f.a - spin + 1, TAU, r * 0.75, k, RED_DEEP, 0.7, f.seed + 1);
  p.b.glowRing.push(f.x, 0.1, f.z, 0, r, 1, r, RED, 0, 0, 0, k * 0.8 * p.dim);
  p.b.glowRingThin.push(f.x, 0.12, f.z, 0, r * 1.08, 1, r * 1.08, RED_HOT, 0, 0, 0, k * 0.6);
  p.b.glowDisc.push(f.x, 0.07, f.z, 0, r * 1.5, 1, r * 1.5, RED_DEEP, 0, 0, 0, k * 0.2 * p.dim);
  const n = p.n(14);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + p.time * 7;
    const d = r * (0.9 + rnd(f.seed + i) * 0.15);
    p.square(f.x + Math.cos(a) * d, 0.5 + rnd(i * 3) * 0.9, f.z + Math.sin(a) * d, 0.13 * k, i % 3 ? RED : WHITE, 1.2);
  }
}

/** Ground eruption: cracks, a red shock ring, flying rocks and a star burst at the centre. */
function eruption(p: ActionFxRenderer, f: ActFx, r: number, k: number, first: boolean) {
  const t = 1 - k;
  const rr = r * (0.3 + Math.sqrt(t) * 0.8);
  p.b.glowRing.push(f.x, 0.1, f.z, 0, rr, 1, rr, RED, 0, 0, 0, k * 0.85 * p.dim);
  p.b.glowDisc.push(f.x, 0.08, f.z, 0, r * 1.4, 1, r * 1.4, RED_DEEP, 0, 0, 0, k * 0.3 * p.dim);
  cracks(p, f.x, f.z, r, k, f.seed, p.n(9));
  const pts: Array<[number, number]> = [];
  const n = p.n(10);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + f.seed;
    const d = r * (0.55 + rnd(f.seed + i) * 0.35);
    pts.push([f.x + Math.cos(a) * d, f.z + Math.sin(a) * d]);
  }
  spikes(p, f.x, f.z, k, f.seed, pts);
  rocks(p, f.x, f.z, r * 0.6, k, f.seed, p.n(12));
  if (t < 0.45) star(p, f.x, 0.9, f.z, 1.1 * (1 - t), k);
  if (first) {
    p.spray('pixel', f.x, 0.4, f.z, 16, RED, EMBER, 6, 0.18, 0.5, Math.PI, 1);
    p.spray('puff', f.x, 0.3, f.z, 10, 0x5a5052, 0x2e2a2c, 3, 0.4, 0.6, Math.PI, 0.3);
  }
}

/** Line eruption for forward smashes: rocks and spikes bursting along the strike, a red seam under them. */
function fissure(p: ActionFxRenderer, f: ActFx, a: number, off: number, len: number, w: number, k: number, first: boolean) {
  const t = 1 - k;
  const ext = Math.min(1, t * 5 + 0.15);
  const L = len * ext;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cx = f.x + ca * (off + L * 0.5);
  const cz = f.z + sa * (off + L * 0.5);
  p.b.glowPlane.push(cx, 0.09, cz, Math.PI / 2 - a, w * 0.35, 1, L, RED, 0, 0, 0, k * 0.9 * p.dim);
  p.b.glowPlane.push(cx, 0.08, cz, Math.PI / 2 - a, w, 1, L, RED_DEEP, 0, 0, 0, k * 0.3 * p.dim);
  const pts: Array<[number, number]> = [];
  const n = Math.max(3, Math.ceil(L / 0.7));
  for (let i = 0; i < n; i++) {
    const d = off + ((i + 0.5) / n) * L;
    const side = (i & 1 ? 1 : -1) * w * (0.2 + rnd(f.seed + i) * 0.2);
    pts.push([f.x + ca * d - sa * side, f.z + sa * d + ca * side]);
  }
  spikes(p, f.x, f.z, k, f.seed, pts);
  const ex = f.x + ca * (off + L);
  const ez = f.z + sa * (off + L);
  rocks(p, ex, ez, w * 0.6, k, f.seed, p.n(6));
  if (t < 0.45) star(p, f.x + ca * (off + len * 0.35), 0.9, f.z + sa * (off + len * 0.35), 0.9 * (1 - t), k);
  if (first) p.spray('pixel', cx, 0.4, cz, 12, RED, EMBER, 5, 0.16, 0.45, Math.PI, 1);
}

/** Red thrust streak for the charge: a glowing lance along the path with a hot tip. */
function streak(p: ActionFxRenderer, f: ActFx, k: number) {
  const dx = f.x2 - f.x;
  const dz = f.z2 - f.z;
  const L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  const a = Math.atan2(dz, dx);
  const yaw = Math.PI / 2 - a;
  const cx = (f.x + f.x2) / 2;
  const cz = (f.z + f.z2) / 2;
  p.b.glowPlane.push(cx, 0.95, cz, yaw, 0.9, 1, L, RED, 0, 0, 0, k * 0.7);
  p.b.glowPlane.push(cx, 0.97, cz, yaw, 0.22, 1, L, RED_HOT, 0, 0, 0, k);
  p.b.glowPlane.push(cx, 0.07, cz, yaw, 1.4, 1, L, RED_DEEP, 0, 0, 0, k * 0.25);
  const n = p.n(10);
  for (let i = 0; i < n; i++) {
    const u = rnd(f.seed + i);
    p.square(f.x + dx * u, 0.6 + rnd(i * 3) * 0.8, f.z + dz * u, 0.12 * k * (0.5 + u), i & 1 ? RED : EMBER, 1.2);
  }
  star(p, f.x2, 1, f.z2, 0.5, k);
}

export function berserkerVfx(): ClassVfx {
  return {
    draw(f, k, first, p) {
      if (f.k === 'trail') {
        streak(p, f, k);
        return true;
      }
      if (f.k === 'ring' || (f.k as string) === 'burst') return false;
      if (f.k !== 'hit' || !f.shape) return false;
      const sh = f.shape;
      const style = f.fx || 'slash';
      if (style === 'fire' || style === 'none') return false; // the ultimate's fire keeps its element look
      switch (sh.k) {
        case 'cone': {
          const base = sh.back ? f.a + Math.PI : f.a;
          crescent(p, f, sh.r, (sh.arc * Math.PI) / 180, base, k, first);
          return true;
        }
        case 'circle':
          if (style === 'spin' || style === 'slash' || style === 'slash_wide') ring(p, f, sh.r, k);
          else eruption(p, f, sh.r, k, first);
          if (first) p.spray('pixel', f.x, 1, f.z, 6, RED, WHITE, 4, 0.12, 0.3, Math.PI, 0.5);
          return true;
        case 'rect':
          fissure(p, f, sh.back ? f.a + Math.PI : f.a, sh.off ?? 0, sh.len, sh.w, k, first);
          return true;
      }
      return false;
    },

    frame(run: Run, p: ActionFxRenderer) {
      const cur = run.action.cur;
      if (!cur || !cur.step.anim.startsWith('bz_')) return;
      // next damaging moment of the step (hit or dash hit)
      let next = -1;
      for (const e of cur.step.ev) {
        if ((e.do === 'hit' || e.do === 'move' || e.do === 'proj') && e.t >= cur.t) {
          next = e.t;
          break;
        }
      }
      const pl = run.player;
      const charging = cur.phase === 'charge';
      if (next < 0 && !charging) return;
      // preparation (first half of the lead-in) then wind-up (closing on the hit): embers drawn in, the ground glow tightening
      const lead = charging ? 1 : Math.max(0.12, next);
      const u = charging ? 0.5 + 0.5 * Math.sin(p.time * 10) : Math.min(1, cur.t / lead);
      const windup = charging ? 1 : Math.max(0, (u - 0.5) * 2);
      const prep = Math.min(1, u * 2);
      const r = 1.6 - windup * 0.8;
      p.b.glowDisc.push(pl.x, 0.07, pl.z, 0, r, 1, r, RED_DEEP, 0, 0, 0, 0.12 + prep * 0.18 + windup * 0.25);
      const n = p.n(charging ? 10 : 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + p.time * 2.4;
        const d = 1.4 * (1 - ((p.time * 1.6 + i / n) % 1));
        p.square(pl.x + Math.cos(a) * d, 0.3 + ((i * 0.37 + p.time) % 1) * 1.5, pl.z + Math.sin(a) * d, 0.09 * prep, i & 1 ? RED : EMBER, 1.2);
      }
      if (windup > 0.6) p.glint(pl.x + cur.dirX * 0.6, 1.4, pl.z + cur.dirZ * 0.6, 0.6 * windup, RED, (windup - 0.6) * 1.5, Math.PI / 4);
    },
  };
}
