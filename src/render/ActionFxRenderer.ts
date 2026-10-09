import type { Run } from '../game/Run';
import type { ActFx } from '../game/action/vfx';
import type { Shape } from '../game/action/types';
import type { InstancedBatch } from './InstancedBatch';
import type { LightPool } from './LightPool';

/** Glow batches shared with the EntityRenderer (all additive, unlit). */
export interface FxBatches {
  glowBox: InstancedBatch;
  glowBoxTop: InstancedBatch;
  glowDisc: InstancedBatch;
  glowRing: InstancedBatch;
  glowRingThin: InstancedBatch;
  glowPlane: InstancedBatch;
  darkDisc: InstancedBatch;
  segment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, w: number, c: number, a: number): void;
}

const TAU = Math.PI * 2;
const WHITE = 0xffffff;

function rnd(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/**
 * Draws the action-combat visuals emitted by ActionSystem (`run.action.fx`): attack shapes as
 * sweeping slashes / smashes / thrusts, ground telegraphs, lasting zones, sky falls, lightning,
 * dash streaks, buff auras, cast gathering and stagger breaks. Everything is built from the
 * shared additive glow batches, so it costs no extra draw calls.
 */
export class ActionFxRenderer {
  private time = 0;
  private dt = 0;
  /** Brightness share when many bright effects overlap. */
  private dim = 1;

  constructor(
    private run: Run,
    private b: FxBatches,
    private lights: LightPool,
  ) {}

  update(dt: number) {
    this.dt = dt;
    this.time += dt;
    const list = this.run.action.fx.list;
    // many overlapping falls / flashes would white out the screen with bloom: share the brightness
    let heavy = 0;
    for (const f of list) if (f.k === 'fall' || f.k === 'flash' || (f.k === 'hit' && f.fx === 'holy')) heavy++;
    this.dim = 1 / Math.sqrt(Math.max(1, heavy / 2));
    for (const f of list) {
      const first = f.max - f.life <= dt * 1.5 + 0.001;
      switch (f.k) {
        case 'hit':
          this.hit(f, first);
          break;
        case 'warn':
          this.warn(f);
          break;
        case 'zone':
          this.zone(f);
          break;
        case 'fall':
          this.fall(f, first);
          break;
        case 'bolt':
          this.bolt(f);
          break;
        case 'trail':
          this.trail(f);
          break;
        case 'blink':
          this.blink(f, first);
          break;
        case 'ring': {
          const k = f.life / f.max;
          const r = f.r * (0.4 + (1 - k) * 1.8);
          this.b.glowRing.push(f.x, 0.12, f.z, 0, r, 1, r, f.color, 0, 0, 0, k);
          this.b.glowRingThin.push(f.x, 0.6, f.z, 0, r * 0.9, 1, r * 0.9, WHITE, 0, 0, 0, k * 0.6);
          break;
        }
        case 'flash': {
          const k = (f.life / f.max) * this.dim;
          const r = f.r * (1 + (1 - k) * 1.6);
          this.b.glowDisc.push(f.x, 0.1, f.z, 0, r * 3, 1, r * 3, f.color, 0, 0, 0, k * 0.4);
          this.b.glowDisc.push(f.x, 1, f.z, 0, r * 1.6, 1, r * 1.6, WHITE, 0, 0, 0, k * k * 0.3);
          this.b.glowRing.push(f.x, 0.14, f.z, 0, r * 1.4, 1, r * 1.4, f.color, 0, 0, 0, k * 0.8);
          if (first) this.run.fx.burst(f.x, 1, f.z, f.color, 16, 5, 0.12, 0.5, 'glow');
          break;
        }
        case 'aura':
          this.aura(f);
          break;
        case 'gather':
          this.gather(f);
          break;
        case 'break':
          this.breakFx(f, first);
          break;
        case 'block': {
          const k = f.life / f.max;
          const x = f.x + Math.cos(f.a) * 0.9;
          const z = f.z + Math.sin(f.a) * 0.9;
          this.b.glowPlane.push(x, 1, z, Math.PI / 2 - f.a, 1.8, 1, 0.3, f.color, 0, 0, 0, k);
          this.b.glowDisc.push(x, 1, z, 0, 1.6 * (2 - k), 1, 1.6 * (2 - k), WHITE, 0, 0, 0, k * 0.8);
          if (first) this.run.fx.burst(x, 1, z, 0xffe08a, 10, 5, 0.08, 0.3, 'glow');
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- attack shapes
  private hit(f: ActFx, first: boolean) {
    const sh = f.shape;
    if (!sh) return;
    const k = f.life / f.max; // 1 -> 0
    const c = f.color;
    const style = f.fx || 'slash';
    if (style === 'none') return;
    switch (sh.k) {
      case 'cone':
        this.cone(f, sh, k, style);
        break;
      case 'circle':
        if (style === 'slash' || style === 'slash_wide' || style === 'spin') this.spin(f, sh.r, k);
        else this.burst(f, sh.r, k, style, first);
        break;
      case 'ring':
        this.burst(f, sh.r1, k, style, first);
        this.b.glowRingThin.push(f.x, 0.08, f.z, 0, sh.r0, 1, sh.r0, c, 0, 0, 0, k * 0.6);
        break;
      case 'rect': {
        const a = sh.back ? f.a + Math.PI : f.a;
        this.thrust(f.x, f.z, a, sh.off ?? 0, sh.len, sh.w, k, c, style);
        break;
      }
      case 'sides':
        this.thrust(f.x, f.z, f.a + Math.PI / 2, 0, sh.len, sh.w, k, c, style);
        this.thrust(f.x, f.z, f.a - Math.PI / 2, 0, sh.len, sh.w, k, c, style);
        break;
      case 'cross':
        for (let i = 0; i < 4; i++) this.thrust(f.x, f.z, f.a + (i * Math.PI) / 2, 0, sh.len, sh.w, k, c, style);
        this.burst(f, sh.w, k, style, first);
        break;
    }
    if (first) this.impact(f, style);
  }

  /** Particles and light on the first frame of a hit. */
  private impact(f: ActFx, style: string) {
    const fx = this.run.fx;
    const r = f.shape ? Math.min(4, shapeSize(f.shape)) : 1;
    switch (style) {
      case 'smash':
      case 'shock':
        fx.burst(f.x, 0.3, f.z, 0x6a5a48, Math.round(6 + r * 3), 4 + r, 0.16, 0.6, 'debris');
        fx.burst(f.x, 0.4, f.z, f.color, 8, 3 + r, 0.12, 0.4, 'glow');
        break;
      case 'holy':
        fx.burst(f.x, 0.6, f.z, 0xfff2b0, 14, 3 + r, 0.12, 0.6, 'glow');
        break;
      case 'fire':
        fx.burst(f.x, 0.6, f.z, 0xff8a2a, 14, 3 + r, 0.14, 0.5, 'glow');
        break;
      case 'ice':
        fx.burst(f.x, 0.6, f.z, 0xc8f4ff, 12, 3 + r, 0.12, 0.5, 'glow');
        break;
      case 'dark':
      case 'shadow':
        fx.burst(f.x, 0.6, f.z, 0x8a5aff, 12, 3 + r, 0.14, 0.5, 'glow');
        break;
      case 'poison':
        fx.burst(f.x, 0.4, f.z, 0x9cff4f, 10, 2.5 + r, 0.14, 0.6, 'glow');
        break;
      case 'bolt':
      case 'zap':
        fx.burst(f.x, 0.8, f.z, 0xc8ecff, 10, 6, 0.08, 0.3, 'glow');
        break;
    }
    if (style !== 'slash' && style !== 'thrust' && style !== 'whoosh') this.lights.request(f.x, 1.2, f.z, f.color, 1.2, 4 + r, this.run.player.x, this.run.player.z);
  }

  /** Sweeping arc of a cone attack (slashes, breath, swings). */
  private cone(f: ActFx, sh: Extract<Shape, { k: 'cone' }>, k: number, style: string) {
    const c = f.color;
    const arc = (sh.arc * Math.PI) / 180;
    const base = sh.back ? f.a + Math.PI : f.a;
    if (style === 'fire' || style === 'poison' || style === 'ice' || style === 'dark' || style === 'holy' || style === 'shadow') {
      // breath / blast: a filled fan of glowing planes that runs outward
      const rays = Math.max(5, Math.ceil(arc / 0.18));
      const reach = sh.r * Math.min(1, (1 - k) * 3 + 0.2);
      for (let i = 0; i < rays; i++) {
        const a = base - arc / 2 + ((i + 0.5) / rays) * arc;
        const jit = 0.85 + rnd(f.seed + i) * 0.3;
        const len = reach * jit;
        const cx = f.x + Math.cos(a) * len * 0.5;
        const cz = f.z + Math.sin(a) * len * 0.5;
        const w = (arc / rays) * len * 1.2;
        this.b.glowPlane.push(cx, 0.1 + i * 0.002, cz, Math.PI / 2 - a, w, 1, len, c, 0, 0, 0, k * 0.55);
      }
      this.b.glowDisc.push(f.x + Math.cos(base) * reach * 0.6, 0.12, f.z + Math.sin(base) * reach * 0.6, 0, reach * 1.2, 1, reach * 1.2, mix(c, WHITE, 0.3), 0, 0, 0, k * 0.4);
      return;
    }
    if (style === 'punch' || style === 'shock' || style === 'smash' || style === 'meteor') {
      // ground shock fan
      const rr = sh.r * (0.4 + (1 - k) * 0.7);
      const n = Math.max(4, Math.ceil(arc / 0.25));
      for (let i = 0; i < n; i++) {
        const a = base - arc / 2 + ((i + 0.5) / n) * arc;
        this.b.glowPlane.push(f.x + Math.cos(a) * rr, 0.1, f.z + Math.sin(a) * rr, Math.PI / 2 - a, (arc / n) * rr * 1.3, 1, 0.5, c, 0, 0, 0, k);
      }
      this.b.glowDisc.push(f.x + Math.cos(base) * sh.r * 0.5, 0.08, f.z + Math.sin(base) * sh.r * 0.5, 0, sh.r * 1.4, 1, sh.r * 1.4, c, 0, 0, 0, k * 0.35);
      if (style === 'punch') this.punch(f.x, f.z, base, sh.r * 0.6, k, c);
      return;
    }
    // blade slash: a crescent that sweeps across the arc at chest height, plus a ground echo
    this.arcSweep(f.x, f.z, base, arc, sh.r, k, c, style === 'slash_wide' ? 1.3 : 1, f.seed);
  }

  private arcSweep(x: number, z: number, base: number, arc: number, r: number, k: number, c: number, wide: number, seed: number) {
    const n = Math.max(5, Math.ceil(arc / 0.18));
    const sweep = Math.min(1, (1 - k) * 3);
    const shown = Math.max(1, Math.ceil(n * sweep));
    // alternate swing direction for combo hits
    const dir = Math.floor(seed) % 2 === 0 ? 1 : -1;
    const h = 0.85;
    for (let j = 0; j < shown; j++) {
      const i = dir > 0 ? j : n - 1 - j;
      const a = base - arc / 2 + ((i + 0.5) / n) * arc;
      const rr = r * 0.8;
      const seg = (arc / n) * rr * 1.3;
      const tip = 1 - Math.abs(i / (n - 1 || 1) - 0.5) * 1.2;
      const head = j / shown; // brighter at the leading edge
      const a2 = k * (0.45 + head * 0.55);
      this.b.glowPlane.push(x + Math.cos(a) * rr, h, z + Math.sin(a) * rr, Math.PI / 2 - a, r * 0.38 * tip * wide, 1, seg, c, 0, 0, 0, a2);
      this.b.glowPlane.push(x + Math.cos(a) * rr * 1.04, h + 0.02, z + Math.sin(a) * rr * 1.04, Math.PI / 2 - a, r * 0.1 * tip, 1, seg, WHITE, 0, 0, 0, a2);
      this.b.glowPlane.push(x + Math.cos(a) * rr * 0.75, 0.06, z + Math.sin(a) * rr * 0.75, Math.PI / 2 - a, r * 0.5 * tip * wide, 1, seg, c, 0, 0, 0, a2 * 0.25);
    }
  }

  /** Full-circle spin slash. */
  private spin(f: ActFx, r: number, k: number) {
    this.arcSweep(f.x, f.z, f.a + Math.PI, TAU, r, k, f.color, 1, f.seed);
    this.b.glowRingThin.push(f.x, 0.08, f.z, 0, r, 1, r, f.color, 0, 0, 0, k * 0.5);
  }

  /** Round impact: smash, shock, holy, fire, ice, dark, poison, explosion. */
  private burst(f: ActFx, r: number, k: number, style: string, _first: boolean) {
    const c = f.color;
    const t = 1 - k;
    const rr = r * (0.35 + t * 0.75);
    this.b.glowRing.push(f.x, 0.1, f.z, 0, rr, 1, rr, c, 0, 0, 0, k * 0.8);
    this.b.glowDisc.push(f.x, 0.08, f.z, 0, r * 2.2, 1, r * 2.2, c, 0, 0, 0, k * 0.3);
    this.b.glowDisc.push(f.x, 0.1, f.z, 0, r * 1.1, 1, r * 1.1, WHITE, 0, 0, 0, k * k * 0.25);
    switch (style) {
      case 'smash':
      case 'shock':
      case 'meteor': {
        // cracked ground: radial plates jump out of the floor and settle
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rnd(f.seed * 3 + i) * 0.5;
          const d = r * (0.45 + rnd(i + f.seed) * 0.4);
          const up = Math.sin(Math.min(1, t * 2.5) * Math.PI) * 0.5;
          this.b.glowBoxTop.push(f.x + Math.cos(a) * d, up * 0.4, f.z + Math.sin(a) * d, a, 0.35, 0.18 + up, 0.35, mix(c, 0x806040, 0.5), 0, 0, 0, k);
        }
        this.b.glowRingThin.push(f.x, 0.5, f.z, 0, rr * 1.1, 1, rr * 1.1, WHITE, 0, 0, 0, k * 0.6);
        break;
      }
      case 'holy': {
        // pillar of light
        const w = r * 0.5 * (1 - t * 0.6);
        this.b.glowBoxTop.push(f.x, 2.5, f.z, this.time, w, 5, w, c, 0, 0, 0, k * 0.3);
        this.b.glowBox.push(f.x, 2.5, f.z, -this.time, w * 0.3, 5, w * 0.3, WHITE, 0, 0, 0, k * 0.5);
        break;
      }
      case 'fire': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + this.time;
          const d = rr * 0.6;
          const hgt = 0.6 + rnd(f.seed + i) * 0.8;
          this.b.glowBox.push(f.x + Math.cos(a) * d, hgt * t, f.z + Math.sin(a) * d, a, 0.3 * k + 0.1, 0.5 * k + 0.1, 0.3 * k + 0.1, mix(0xffe04a, 0xff4a1a, t), 0, 0, 0, k);
        }
        break;
      }
      case 'ice': {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + f.seed;
          const d = r * (0.3 + rnd(i * 5 + f.seed) * 0.6);
          const hgt = (0.5 + rnd(i + 2) * 0.8) * Math.min(1, t * 4);
          this.b.glowBoxTop.push(f.x + Math.cos(a) * d, hgt * 0.5, f.z + Math.sin(a) * d, a, 0.25, hgt, 0.25, 0xc8f4ff, 0, 0, 0, k);
        }
        break;
      }
      case 'dark':
      case 'shadow': {
        this.b.darkDisc.push(f.x, 0.05, f.z, 0, r * 2, 1, r * 2, 0x8070a0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU - this.time * 3;
          const d = r * (1 - t) * 0.9;
          this.b.glowBox.push(f.x + Math.cos(a) * d, 0.8, f.z + Math.sin(a) * d, a, 0.25, 0.25, 0.25, c, 0, 0, 0, k);
        }
        break;
      }
      case 'poison':
        this.b.glowDisc.push(f.x, 0.07, f.z, this.time, r * 2.4, 1, r * 2.4, 0x7ae040, 0, 0, 0, k * 0.5);
        break;
      case 'punch':
        this.punch(f.x, f.z, f.a, r, k, c);
        break;
    }
  }

  /** Straight attack: thrust, charge line, beam, wave. */
  private thrust(x: number, z: number, a: number, off: number, len: number, w: number, k: number, c: number, style: string) {
    const ext = Math.min(1, (1 - k) * 4 + 0.15);
    const L = len * ext;
    const cx = x + Math.cos(a) * (off + L * 0.5);
    const cz = z + Math.sin(a) * (off + L * 0.5);
    const yaw = Math.PI / 2 - a;
    const ground = style === 'smash' || style === 'shock' || style === 'fire' || style === 'ice' || style === 'poison' || style === 'meteor';
    if (ground) {
      this.b.glowPlane.push(cx, 0.09, cz, yaw, w, 1, L, c, 0, 0, 0, k * 0.6);
      this.b.glowPlane.push(cx, 0.1, cz, yaw, w * 0.3, 1, L, WHITE, 0, 0, 0, k * 0.5);
      // rising spikes along the line
      const n = Math.max(2, Math.ceil(L / 1.1));
      for (let i = 0; i < n; i++) {
        const d = off + ((i + 0.5) / n) * L;
        const hgt = 0.25 + Math.sin(Math.min(1, (1 - k) * 3) * Math.PI) * 0.6;
        this.b.glowBoxTop.push(x + Math.cos(a) * d, hgt * 0.5, z + Math.sin(a) * d, a + i, w * 0.3, hgt, w * 0.3, mix(c, WHITE, 0.2), 0, 0, 0, k);
      }
      return;
    }
    // air thrust: a bright lance with a fading tail
    this.b.glowPlane.push(cx, 0.9, cz, yaw, w * 0.55, 1, L, c, 0, 0, 0, k * 0.85);
    this.b.glowPlane.push(cx, 0.92, cz, yaw, w * 0.16, 1, L, WHITE, 0, 0, 0, k);
    this.b.glowPlane.push(cx, 0.07, cz, yaw, w, 1, L, c, 0, 0, 0, k * 0.2);
    const tx = x + Math.cos(a) * (off + L);
    const tz = z + Math.sin(a) * (off + L);
    this.b.glowDisc.push(tx, 0.9, tz, 0, w * 1.4, 1, w * 1.4, WHITE, 0, 0, 0, k * 0.7);
  }

  /** Fist shockwave in front of the hero. */
  private punch(x: number, z: number, a: number, r: number, k: number, c: number) {
    const d = r * 0.6;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const s = 0.6 + (1 - k) * 1.2;
    this.b.glowRing.push(px, 0.9, pz, 0, s * 0.7, 1, s * 0.7, WHITE, 0, 0, 0, k);
    this.b.glowPlane.push(px, 0.9, pz, Math.PI / 2 - a, s * 1.4, 1, s * 0.4, c, 0, 0, 0, k);
    this.b.glowDisc.push(px, 0.9, pz, 0, s * 1.6, 1, s * 1.6, c, 0, 0, 0, k * 0.6);
  }

  // ---------------------------------------------------------------- telegraphs and zones
  private warn(f: ActFx) {
    const k = 1 - f.life / f.max; // 0 -> 1
    const blink = 0.8 + Math.sin(this.time * 20) * 0.2;
    this.b.glowRing.push(f.x, 0.07, f.z, 0, f.r, 1, f.r, f.color, 0, 0, 0, 0.75 * blink);
    this.b.glowDisc.push(f.x, 0.06, f.z, 0, f.r * 2.2 * k, 1, f.r * 2.2 * k, f.color, 0, 0, 0, 0.45);
  }

  private zone(f: ActFx) {
    const c = f.color;
    const age = f.max - f.life;
    const fade = Math.min(1, age * 4, f.life * 2);
    const r = f.r;
    const t = this.time;
    const b = this.b;
    switch (f.vis) {
      case 'seal': {
        // engraved sigil: two counter-rotating rings, a square glyph and a soft core
        b.glowRing.push(f.x, 0.07, f.z, t * 0.6, r, 1, r, c, 0, 0, 0, 0.7 * fade);
        b.glowRingThin.push(f.x, 0.08, f.z, -t, r * 0.7, 1, r * 0.7, WHITE, 0, 0, 0, 0.5 * fade);
        for (let i = 0; i < 4; i++) {
          const a = t * 0.6 + (i * Math.PI) / 2;
          b.glowPlane.push(f.x + Math.cos(a) * r * 0.5, 0.09, f.z + Math.sin(a) * r * 0.5, Math.PI / 2 - a + Math.PI / 2, r * 0.9, 1, 0.12, c, 0, 0, 0, 0.6 * fade);
        }
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 1.6, 1, r * 1.6, c, 0, 0, 0, (0.25 + Math.sin(t * 3 + f.seed) * 0.08) * fade);
        break;
      }
      case 'poison':
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 2.1, 1, r * 2.1, 0x90a080);
        b.glowDisc.push(f.x, 0.06, f.z, t * 0.2, r * 2.3, 1, r * 2.3, c, 0, 0, 0, 0.45 * fade);
        if (Math.random() < this.dt * 8) this.run.fx.burst(f.x + (Math.random() - 0.5) * r * 1.6, 0.2, f.z + (Math.random() - 0.5) * r * 1.6, 0x9cff4f, 1, 0.6, 0.15, 0.8, 'glow');
        break;
      case 'fire':
        b.glowDisc.push(f.x, 0.06, f.z, t, r * 2.3, 1, r * 2.3, c, 0, 0, 0, (0.45 + Math.sin(t * 13 + f.seed) * 0.1) * fade);
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, 0xffe04a, 0, 0, 0, 0.5 * fade);
        for (let i = 0; i < 5; i++) {
          const ph = (t * 1.6 + i / 5 + f.seed) % 1;
          const a = i * 2.4 + f.seed;
          const d = r * (0.2 + 0.7 * rnd(i + Math.floor(t * 1.6 + i / 5 + f.seed)));
          b.glowBox.push(f.x + Math.cos(a) * d, ph * 1.4, f.z + Math.sin(a) * d, a, 0.22 * (1 - ph), 0.3 * (1 - ph), 0.22 * (1 - ph), mix(0xffe04a, 0xff3a1a, ph), 0, 0, 0, fade);
        }
        break;
      case 'ice':
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 2.2, 1, r * 2.2, 0xc8f4ff, 0, 0, 0, 0.4 * fade);
        b.glowRing.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.6 * fade);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + f.seed;
          b.glowBoxTop.push(f.x + Math.cos(a) * r * 0.8, 0.25 * fade, f.z + Math.sin(a) * r * 0.8, a, 0.25, 0.5 * fade, 0.25, 0xe0f8ff, 0, 0, 0, 0.8 * fade);
        }
        break;
      case 'rain': {
        // arrows / light streaks falling into the circle
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.6 * fade);
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2, 1, r * 2, c, 0, 0, 0, 0.18 * fade);
        for (let i = 0; i < 10; i++) {
          const ph = (t * 2.5 + i / 10 + f.seed) % 1;
          const n = Math.floor(t * 2.5 + i / 10 + f.seed) * 13 + i;
          const a = rnd(n) * TAU;
          const d = Math.sqrt(rnd(n + 1)) * r;
          const x = f.x + Math.cos(a) * d;
          const z = f.z + Math.sin(a) * d;
          const y = (1 - ph) * 6;
          this.b.segment(x - 0.3, y + 0.9, z - 0.3, x, y, z, 0.07, c, fade);
          if (ph > 0.9) b.glowDisc.push(x, 0.08, z, 0, 0.6, 1, 0.6, WHITE, 0, 0, 0, fade * 0.6);
        }
        break;
      }
      case 'storm':
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 2.2, 1, r * 2.2, 0x7080a0);
        b.glowRing.push(f.x, 0.07, f.z, -t * 0.4, r, 1, r, c, 0, 0, 0, 0.5 * fade);
        b.glowDisc.push(f.x, 5.5, f.z, 0, r * 2.4, 1, r * 2.4, 0x405070, 0, 0, 0, 0.25 * fade);
        break;
      case 'vines':
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.1, 1, r * 2.1, 0x4a9a3a, 0, 0, 0, 0.35 * fade);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + f.seed;
          const d = r * (0.3 + rnd(i + f.seed) * 0.65);
          const h = (0.5 + Math.sin(t * 3 + i) * 0.15) * fade;
          b.glowBoxTop.push(f.x + Math.cos(a) * d, h * 0.5, f.z + Math.sin(a) * d, a + t * 0.3, 0.16, h, 0.16, 0x6ac85a, 0, 0, 0, 0.9 * fade);
        }
        break;
      case 'trap': {
        const blink = Math.floor(t * 3 + f.seed) % 2 === 0 ? 1 : 0.5;
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.35 * fade);
        b.glowBoxTop.push(f.x, 0.1, f.z, Math.PI / 4, 0.5, 0.15, 0.5, c, 0, 0, 0, blink * fade);
        break;
      }
      case 'light':
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 2.3, 1, r * 2.3, c, 0, 0, 0, 0.18 * fade);
        b.glowRing.push(f.x, 0.07, f.z, t * 0.5, r, 1, r, 0xfff2b0, 0, 0, 0, 0.45 * fade);
        b.glowBoxTop.push(f.x, 2, f.z, t, r * 0.15, 4, r * 0.15, c, 0, 0, 0, 0.15 * fade);
        break;
      default:
        // aura / generic ward
        b.glowRing.push(f.x, 0.08, f.z, t * 0.8, r, 1, r, c, 0, 0, 0, 0.55 * fade);
        b.glowRingThin.push(f.x, 0.1, f.z, -t * 1.4, r * 0.8, 1, r * 0.8, c, 0, 0, 0, 0.35 * fade);
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.1, 1, r * 2.1, c, 0, 0, 0, (0.1 + Math.sin(t * 3) * 0.03) * fade);
    }
    if (f.vis !== 'trap' && f.vis !== 'seal') this.lights.request(f.x, 1, f.z, c, 0.6 * fade, r * 2, this.run.player.x, this.run.player.z);
  }

  // ---------------------------------------------------------------- sky falls, lightning, movement
  private fall(f: ActFx, first: boolean) {
    const k = f.life / f.max; // 1 -> 0
    const d = this.dim;
    const c = f.color;
    if (f.vis === 'meteor_drop') {
      const y = 0.4 + k * 14;
      const ox = k * 4;
      const s = Math.max(0.8, f.r * 0.45);
      this.b.glowBoxTop.push(f.x - ox, y, f.z - ox * 0.5, this.time * 4, s, s, s, mix(c, 0xffe04a, 0.4), 0, 0, 0, d);
      this.b.glowBox.push(f.x - ox, y, f.z - ox * 0.5, -this.time * 3, s * 0.6, s * 0.6, s * 0.6, WHITE, 0, 0, 0, d);
      this.b.segment(f.x - ox - 2.4, y + 3.6, f.z - ox * 0.5 - 1.2, f.x - ox, y, f.z - ox * 0.5, s * 0.8, c, 0.5 * d);
      this.lights.request(f.x - ox, y, f.z, c, 1.2, 8, this.run.player.x, this.run.player.z);
      return;
    }
    if (f.vis === 'light_drop') {
      const w = f.r * 0.2 * (1 - k * 0.5);
      this.b.glowBoxTop.push(f.x, 4, f.z, 0, w, 8, w, c, 0, 0, 0, (1 - k) * 0.35 * d);
      return;
    }
    // impact
    const t = 1 - k;
    const r = f.r * (0.5 + t * 1.1);
    this.b.glowDisc.push(f.x, 0.1, f.z, 0, f.r * 2.8, 1, f.r * 2.8, c, 0, 0, 0, k * 0.45 * d);
    this.b.glowDisc.push(f.x, 0.12, f.z, 0, f.r * 1.4, 1, f.r * 1.4, WHITE, 0, 0, 0, k * k * 0.35 * d);
    this.b.glowRing.push(f.x, 0.14, f.z, 0, r, 1, r, c, 0, 0, 0, k * d);
    if (f.vis === 'light') {
      const w = f.r * 0.45 * k;
      this.b.glowBoxTop.push(f.x, 4, f.z, this.time, w, 8, w, c, 0, 0, 0, k * 0.45 * d);
      this.b.glowBox.push(f.x, 4, f.z, 0, w * 0.35, 8, w * 0.35, WHITE, 0, 0, 0, k * 0.6 * d);
    } else {
      this.b.darkDisc.push(f.x, 0.04, f.z, 0, f.r * 2, 1, f.r * 2, 0x605048);
    }
    if (first) {
      this.run.fx.burst(f.x, 0.5, f.z, f.vis === 'meteor' ? 0xff8a2a : 0xfff2b0, 22, 6, 0.16, 0.6, 'glow');
      this.run.fx.light(f.x, f.z, c, 3, f.r * 3, 0.4);
    }
  }

  private bolt(f: ActFx) {
    const k = f.life / f.max;
    const segs = f.y > 3 ? 7 : 5;
    const y0 = f.y > 0 ? f.y : 0.9;
    let px = f.x;
    let py = y0;
    let pz = f.z;
    const seed = Math.floor(this.time * 30) + f.seed;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const j = i === segs ? 0 : 0.6;
      const nx = f.x + (f.x2 - f.x) * t + (rnd(seed + i) - 0.5) * j;
      const nz = f.z + (f.z2 - f.z) * t + (rnd(seed + i * 7) - 0.5) * j;
      const ny = y0 + (0.7 - y0) * t + (i === segs ? 0 : (rnd(seed + i * 3) - 0.5) * 0.4);
      this.b.segment(px, py, pz, nx, ny, nz, 0.22, f.color, k);
      this.b.segment(px, py, pz, nx, ny, nz, 0.08, WHITE, k);
      px = nx;
      py = ny;
      pz = nz;
    }
    this.b.glowDisc.push(f.x2, 0.07, f.z2, 0, 1.8, 1, 1.8, f.color, 0, 0, 0, k * 0.7);
  }

  private trail(f: ActFx) {
    const p = this.run.player;
    const k = f.life / f.max;
    // the streak grows with the hero during the dash and fades after
    const ex = this.run.action.mover ? p.x : f.x2;
    const ez = this.run.action.mover ? p.z : f.z2;
    const dx = ex - f.x;
    const dz = ez - f.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const yaw = Math.atan2(dx, dz);
    const cx = f.x + dx / 2;
    const cz = f.z + dz / 2;
    const leap = f.vis === 'leap';
    const fade = Math.min(1, k * 2.5);
    this.b.glowPlane.push(cx, 0.08, cz, yaw, leap ? 0.5 : 1.1, 1, len, f.color, 0, 0, 0, fade * 0.45);
    if (!leap) {
      this.b.glowPlane.push(cx, 0.9, cz, yaw, 0.7, 1, len, f.color, 0, 0, 0, fade * 0.35);
      this.b.glowPlane.push(cx, 0.92, cz, yaw, 0.18, 1, len, WHITE, 0, 0, 0, fade * 0.5);
    } else {
      // arcing dotted path for leaps
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        this.b.glowDisc.push(f.x + dx * t, Math.sin(t * Math.PI) * 2.2 + 0.4, f.z + dz * t, 0, 0.5, 1, 0.5, f.color, 0, 0, 0, fade * 0.5);
      }
    }
  }

  private blink(f: ActFx, first: boolean) {
    const k = f.life / f.max;
    const r = 0.4 + (1 - k) * 1.2;
    this.b.glowRing.push(f.x, 0.1, f.z, 0, r, 1, r, f.color, 0, 0, 0, k);
    this.b.darkDisc.push(f.x, 0.04, f.z, 0, 2.2 * k, 1, 2.2 * k, 0x8070a0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + f.seed;
      this.b.glowBox.push(f.x + Math.cos(a) * 0.4, 0.4 + (1 - k) * 1.8 + i * 0.12, f.z + Math.sin(a) * 0.4, a, 0.16 * k, 0.16 * k, 0.16 * k, f.color, 0, 0, 0, k);
    }
    if (first) this.run.fx.burst(f.x, 0.9, f.z, f.color, 12, 3, 0.12, 0.4, 'glow');
  }

  private aura(f: ActFx) {
    const fade = Math.min(1, (f.max - f.life) * 4, f.life * 2);
    const t = this.time;
    const r = f.r;
    this.b.glowRing.push(f.x, 0.06, f.z, t, r, 1, r, f.color, 0, 0, 0, 0.45 * fade);
    // three motes orbiting the hero
    for (let i = 0; i < 3; i++) {
      const a = t * 2.4 + (i * TAU) / 3;
      const y = 0.6 + Math.sin(t * 3 + i * 2) * 0.35;
      this.b.glowBox.push(f.x + Math.cos(a) * r * 0.9, y, f.z + Math.sin(a) * r * 0.9, a, 0.14, 0.14, 0.14, f.color, 0, 0, 0, 0.9 * fade);
    }
    this.b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.4, 1, r * 2.4, f.color, 0, 0, 0, 0.2 * fade);
  }

  private gather(f: ActFx) {
    const t = this.time;
    const p = (f.max - f.life) / f.max; // charge progress
    const pulse = (t * 2.5) % 1;
    const rr = f.r * 1.8 * (1 - pulse) + 0.3;
    this.b.glowRingThin.push(f.x, 0.08, f.z, 0, rr, 1, rr, f.color, 0, 0, 0, 0.6 * pulse);
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.8 + i / 6) % 1;
      const a = i * 1.7 + t * 2;
      const d = (1 - ph) * f.r * 1.6;
      this.b.glowBox.push(f.x + Math.cos(a) * d, 0.5 + ph * 0.8, f.z + Math.sin(a) * d, a, 0.12, 0.12, 0.12, f.color, 0, 0, 0, ph);
    }
    this.b.glowDisc.push(f.x, 0.06, f.z, 0, 1.2 + p * 1.8, 1, 1.2 + p * 1.8, f.color, 0, 0, 0, 0.25 + p * 0.35);
  }

  private breakFx(f: ActFx, first: boolean) {
    const k = f.life / f.max;
    const t = 1 - k;
    const r = 0.6 + t * 2.4;
    this.b.glowRing.push(f.x, 1.2, f.z, 0, r, 1, r, f.color, 0, 0, 0, k);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + f.seed;
      const d = 0.4 + t * 2;
      this.b.glowPlane.push(f.x + Math.cos(a) * d, 1.3, f.z + Math.sin(a) * d, Math.PI / 2 - a, 0.18, 1, 0.9 * k + 0.2, WHITE, 0, 0, 0, k);
    }
    if (first) {
      this.run.fx.burst(f.x, 1.3, f.z, 0xffe080, 20, 6, 0.12, 0.5, 'glow');
      this.run.fx.light(f.x, f.z, 0xffe080, 2.5, 5, 0.3);
    }
  }
}

function shapeSize(sh: Shape): number {
  switch (sh.k) {
    case 'circle':
    case 'cone':
      return sh.r;
    case 'ring':
      return sh.r1;
    default:
      return sh.len * 0.5;
  }
}
