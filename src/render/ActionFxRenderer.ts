import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { ActFx } from '../game/action/vfx';
import type { Shape } from '../game/action/types';
import type { EmitKind, EmitLayer } from '../config/vfx';
import { InstancedBatch } from './InstancedBatch';
import type { LightPool } from './LightPool';
import { makeSquareMaterial } from './Particles';

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

// Minecraft Dungeons palette: bold flat colours, a hot core and a deep rim
const FIRE_HOT = 0xffc020;
const FIRE_MID = 0xf05a0c;
const FIRE_DEEP = 0xb01808;
const SMOKE = 0x4a4440;
const DUST = 0xdcd0b8;
const DIRT = 0x7a6650;
const STONE = 0x8a8680;
const SOUL_A = 0xa070ff;
const SOUL_B = 0x4aa8ff;
const GOLD = 0xffcc40;
const GOLD_HI = 0xfff1a8;
const SWING_GOLD = 0xffb83a;
const ICE = 0xa8e4ff;
const ICE_HI = 0xeafcff;
const TOXIC = 0x8ae040;
const TOXIC_DEEP = 0x3e9a18;

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

/** Three-stop flame colour: hot core (t=0) -> orange -> deep red (t=1). */
function flameCol(t: number, hot = FIRE_HOT, mid = FIRE_MID, deep = FIRE_DEEP): number {
  return t < 0.5 ? mix(hot, mid, t * 2) : mix(mid, deep, (t - 0.5) * 2);
}

const LEVEL_MUL = [0.45, 0.75, 1];
const RIB_MAX = 12000;
/** Ribbon cross-section scratch: x, y, z, r, g, b per point (outer, edge, inner) × (prev, next). */
const RP = Array.from({ length: 6 }, () => new Float32Array(6));

function setPt(p: Float32Array, x: number, y: number, z: number, r: number, g: number, b: number) {
  p[0] = x;
  p[1] = y;
  p[2] = z;
  p[3] = r;
  p[4] = g;
  p[5] = b;
}

/**
 * Draws the action-combat visuals emitted by ActionSystem (`run.action.fx`) in the Minecraft
 * Dungeons style: crisp crescent sword arcs with a white edge, chunky square dust and block debris
 * on smashes, stacked square flames, crystal blocks, jagged bolts, golden motes, soul flames and
 * bubbling poison. Glows reuse the EntityRenderer's additive batches; the bold pixels go through
 * two camera-facing square batches and one lit block batch owned here (three extra draw calls).
 */
export class ActionFxRenderer {
  private time = 0;
  private dt = 0;
  /** Brightness share when many bright effects overlap. */
  private dim = 1;
  /** Effects-quality multiplier for procedural counts. */
  private mul = 1;
  private lv = 2;
  /** Opaque unlit camera-facing squares (pixel flames, motes, dust). */
  private sqS: InstancedBatch;
  /** Additive camera-facing squares (glints, halos). */
  private sqG: InstancedBatch;
  /** Lit blocks (crystals, ground plates, rocks, vines). */
  private blk: InstancedBatch;
  /** Dynamic additive ribbon mesh for crisp curved sword arcs (one draw call). */
  private rib: THREE.Mesh;
  private ribPos: Float32Array;
  private ribCol: Float32Array;
  private ribN = 0;
  private L: EmitLayer = { kind: 'pixel', count: 1, color: WHITE, speed: 1, size: 0.1, life: 0.3, spread: Math.PI };

  constructor(
    private run: Run,
    private b: FxBatches,
    private lights: LightPool,
  ) {
    const parent = b.glowBox.mesh.parent ?? new THREE.Group();
    const sq = new THREE.PlaneGeometry(1, 1);
    this.sqS = new InstancedBatch(sq, makeSquareMaterial(false), parent, 256);
    this.sqS.mesh.renderOrder = 3;
    this.sqG = new InstancedBatch(sq, makeSquareMaterial(true), parent, 128);
    this.sqG.mesh.renderOrder = 7;
    this.blk = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), parent, 64);
    this.blk.mesh.renderOrder = 2;
    const g = new THREE.BufferGeometry();
    this.ribPos = new Float32Array(RIB_MAX * 3);
    this.ribCol = new Float32Array(RIB_MAX * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.ribPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.ribCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.rib = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.rib.frustumCulled = false;
    this.rib.renderOrder = 5;
    parent.add(this.rib);
  }

  private vtx(x: number, y: number, z: number, r: number, g: number, b: number) {
    const i = this.ribN++ * 3;
    this.ribPos[i] = x;
    this.ribPos[i + 1] = y;
    this.ribPos[i + 2] = z;
    this.ribCol[i] = r;
    this.ribCol[i + 1] = g;
    this.ribCol[i + 2] = b;
  }

  /** Quad between two ribbon cross-sections: a0-b0 (previous) and a1-b1 (next), colours per edge. */
  private quad(a0: Float32Array, b0: Float32Array, a1: Float32Array, b1: Float32Array) {
    if (this.ribN + 6 > RIB_MAX) return;
    this.vtx(a0[0], a0[1], a0[2], a0[3], a0[4], a0[5]);
    this.vtx(b0[0], b0[1], b0[2], b0[3], b0[4], b0[5]);
    this.vtx(a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
    this.vtx(b0[0], b0[1], b0[2], b0[3], b0[4], b0[5]);
    this.vtx(b1[0], b1[1], b1[2], b1[3], b1[4], b1[5]);
    this.vtx(a1[0], a1[1], a1[2], a1[3], a1[4], a1[5]);
  }

  private flushRibbons() {
    const g = this.rib.geometry;
    g.setDrawRange(0, this.ribN);
    if (this.ribN > 0) {
      for (const name of ['position', 'color']) {
        const a = g.getAttribute(name) as THREE.BufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, this.ribN * 3);
        a.needsUpdate = true;
      }
    }
    this.ribN = 0;
  }

  // ---------------------------------------------------------------- primitives
  /** Bold opaque square (bright > 1 blooms a little). */
  square(x: number, y: number, z: number, s: number, c: number, bright = 1, roll = 0) {
    if (s <= 0.005) return;
    // flat colours stay just under the bloom / tone-mapping knee so they keep their saturation
    bright *= 0.88;
    this.sqS.pushFast(x, y, z, roll, s, s, (((c >> 16) & 255) / 255) * bright, (((c >> 8) & 255) / 255) * bright, ((c & 255) / 255) * bright);
  }

  /** Additive glowing square. */
  glint(x: number, y: number, z: number, s: number, c: number, a = 1, roll = 0) {
    if (s <= 0.005 || a <= 0.005) return;
    this.sqG.pushFast(x, y, z, roll, s, s, (((c >> 16) & 255) / 255) * a, (((c >> 8) & 255) / 255) * a, ((c & 255) / 255) * a);
  }

  /** Lit block with yaw / roll / pitch. */
  block(x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, c: number, roll = 0, pitch = 0) {
    if (sy <= 0.005 || sx <= 0.005) return;
    this.blk.push(x, y, z, yaw, sx, sy, sz, c, 0, roll, pitch);
  }

  /** Particle spray through the shared pool (scaled by the effects setting). */
  spray(kind: EmitKind, x: number, y: number, z: number, count: number, c1: number, c2: number, speed: number, size: number, life: number, spread = Math.PI, up = 0, dx = 0, dz = 0, jitter = 0) {
    if (this.lv < 0) return;
    const L = this.L;
    L.kind = kind;
    L.count = count;
    L.color = c1;
    L.color2 = c2;
    L.speed = speed;
    L.size = size;
    L.life = life;
    L.spread = spread;
    L.up = up;
    L.jitter = jitter;
    this.run.fx.emit(x, y, z, L, dx, dz, this.mul);
  }

  /** Procedural count scaled by the effects setting. */
  private n(base: number): number {
    return Math.max(1, Math.round(base * this.mul));
  }

  update(dt: number) {
    this.dt = dt;
    this.time += dt;
    this.lv = this.run.fx.level();
    this.mul = LEVEL_MUL[Math.max(0, Math.min(2, this.lv))];
    const list = this.run.action.fx.list;
    // many overlapping falls / flashes would white out the screen with bloom: share the brightness
    let heavy = 0;
    for (const f of list) if (f.k === 'fall' || f.k === 'flash' || f.k === 'zone' || (f.k === 'hit' && (f.fx === 'holy' || f.fx === 'fire' || f.fx === 'smash'))) heavy++;
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
          this.bolt(f, first);
          break;
        case 'trail':
          this.trail(f);
          break;
        case 'blink':
          this.blink(f, first);
          break;
        case 'ring': {
          const k = f.life / f.max;
          const r = f.r * (0.35 + Math.sqrt(1 - k) * 0.8);
          this.b.glowRingThin.push(f.x, 0.12, f.z, 0, r, 1, r, f.color, 0, 0, 0, k * 0.7);
          this.squareRing(f.x, 0.3, f.z, r, this.n(12), f.color, k, f.seed);
          break;
        }
        case 'flash':
          this.flash(f, first);
          break;
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
          this.glint(x, 1, z, 1.1 * (2 - k), GOLD_HI, k * 0.5, 0.785);
          for (let i = 0; i < 6; i++) {
            const a = f.a + (rnd(f.seed + i) - 0.5) * 2.4;
            const d = (1 - k) * (0.6 + rnd(i * 3 + f.seed) * 0.8);
            this.square(x + Math.cos(a) * d, 1 + (rnd(i + 9) - 0.3) * d, z + Math.sin(a) * d, 0.14 * k, i & 1 ? WHITE : GOLD, 1.15);
          }
          break;
        }
      }
    }
    // upload this frame's squares and blocks, then reopen the batches so projectiles drawn early
    // next frame (EntityRenderer.drawProjectiles) can add theirs
    this.flushRibbons();
    this.sqS.end();
    this.sqG.end();
    this.blk.end();
    this.sqS.begin();
    this.sqG.begin();
    this.blk.begin();
  }

  // ---------------------------------------------------------------- attack shapes
  private hit(f: ActFx, first: boolean) {
    const sh = f.shape;
    if (!sh) return;
    const k = f.life / f.max; // 1 -> 0
    const c = f.color;
    let style: string = f.fx || 'slash';
    if (style === 'none') return;
    // ActionSystem blasts (explosive arrows, fireball bursts) come as 'shock': fire-coloured ones
    // are drawn as MCD fire explosions
    if (style === 'shock' && isFireColor(f.color)) style = 'fire';
    switch (sh.k) {
      case 'cone':
        this.cone(f, sh, k, style);
        break;
      case 'circle':
        if (style === 'slash' || style === 'slash_wide' || style === 'spin') this.spin(f, sh.r, k);
        else this.burst(f, sh.r, k, style);
        break;
      case 'ring':
        this.burst(f, sh.r1, k, style);
        this.b.glowRingThin.push(f.x, 0.08, f.z, 0, sh.r0, 1, sh.r0, c, 0, 0, 0, k * 0.6);
        break;
      case 'rect': {
        const a = sh.back ? f.a + Math.PI : f.a;
        this.thrust(f.x, f.z, a, sh.off ?? 0, sh.len, sh.w, k, c, style, f.seed);
        break;
      }
      case 'sides':
        this.thrust(f.x, f.z, f.a + Math.PI / 2, 0, sh.len, sh.w, k, c, style, f.seed);
        this.thrust(f.x, f.z, f.a - Math.PI / 2, 0, sh.len, sh.w, k, c, style, f.seed + 7);
        break;
      case 'cross':
        for (let i = 0; i < 4; i++) this.thrust(f.x, f.z, f.a + (i * Math.PI) / 2, 0, sh.len, sh.w, k, c, style, f.seed + i * 5);
        this.burst(f, sh.w, k, style);
        break;
    }
    if (first) this.impact(f, style);
  }

  /** Particles and light on the first frame of a hit. */
  private impact(f: ActFx, style: string) {
    const fx = this.run.fx;
    const sh = f.shape;
    const r = sh ? Math.min(4, shapeSize(sh)) : 1;
    // where the effect is centred: in front of the hero for cones / lines, else on the anchor
    let cx = f.x;
    let cz = f.z;
    let dx = 0;
    let dz = 0;
    if (sh && (sh.k === 'cone' || sh.k === 'rect')) {
      const a = sh.back ? f.a + Math.PI : f.a;
      dx = Math.cos(a);
      dz = Math.sin(a);
      const d = sh.k === 'cone' ? sh.r * 0.6 : (sh.off ?? 0) + sh.len * 0.5;
      cx += dx * d;
      cz += dz * d;
    }
    const c = f.color;
    switch (style) {
      case 'smash':
      case 'shock':
        fx.burst(cx, 0.3, cz, DIRT, Math.round(5 + r * 2), 4 + r, 0.18, 0.7, 'debris');
        fx.burst(cx, 0.3, cz, STONE, Math.round(3 + r), 3 + r, 0.14, 0.6, 'debris');
        this.spray('pixel', cx, 0.5, cz, 6 + r * 2, mix(c, WHITE, 0.45), c, 4 + r, 0.13, 0.32, Math.PI, 2.5);
        break;
      case 'meteor':
        this.explosion(cx, cz, r, 1);
        break;
      case 'punch':
        this.spray('pixel', cx, 0.9, cz, 8, WHITE, mix(c, WHITE, 0.4), 5, 0.12, 0.25, 0.9, 1.5, dx, dz);
        this.spray('puff', f.x + dx * 0.8, 0.3, f.z + dz * 0.8, 3, DUST, 0xc8bca4, 2.5, 0.38, 0.45, 0.6, 0.4, dx, dz);
        break;
      case 'holy':
        this.spray('ember', cx, 0.3, cz, 6 + r * 2, GOLD_HI, GOLD, 1, 0.09, 0.9, Math.PI, 2.4, 0, 0, r * 0.6);
        this.spray('pixel', cx, 0.8, cz, 6, WHITE, GOLD, 3 + r, 0.11, 0.3, Math.PI, 2);
        break;
      case 'fire':
        this.explosion(cx, cz, r, 0.7);
        break;
      case 'ice':
        this.spray('shard', cx, 0.6, cz, 6 + r, ICE_HI, ICE, 3 + r, 0.12, 0.7, Math.PI, 3);
        this.spray('puff', cx, 0.4, cz, 3 + r, ICE_HI, 0xc8ecff, 1.5 + r * 0.4, 0.4, 0.6, Math.PI, 0.6, 0, 0, r * 0.4);
        this.spray('pixel', cx, 0.6, cz, 5, WHITE, ICE, 3 + r, 0.1, 0.3, Math.PI, 1.5);
        break;
      case 'dark':
      case 'shadow':
        this.spray('wisp', cx, 0.6, cz, 6 + r, SOUL_A, SOUL_B, 2.5 + r * 0.5, 0.13, 0.55, Math.PI, 0.8, 0, 0, r * 0.3);
        this.spray('flame', cx, 0.2, cz, 4 + r * 2, 0xc8a0ff, 0x3a3aff, 0.8, 0.16, 0.55, Math.PI, 0.8, 0, 0, r * 0.6);
        this.spray('pixel', cx, 0.6, cz, 4, 0x6a2ab0, 0x2a1450, 3, 0.14, 0.35, Math.PI, 1);
        break;
      case 'poison':
        this.spray('bubble', cx, 0.3, cz, 4 + r, TOXIC, TOXIC_DEEP, 1.2, 0.14, 0.8, Math.PI, 0.8, 0, 0, r * 0.6);
        this.spray('puff', cx, 0.3, cz, 3 + r, 0x7ac83a, 0x4a8a20, 1.5, 0.42, 0.7, Math.PI, 0.5, 0, 0, r * 0.5);
        this.spray('pixel', cx, 0.5, cz, 5, 0xb8ff6a, TOXIC_DEEP, 3, 0.12, 0.3, Math.PI, 1.5);
        break;
      case 'bolt':
      case 'zap':
        this.spray('spark', cx, 0.8, cz, 8, WHITE, 0x9ae8ff, 9, 0.06, 0.16, Math.PI, 2);
        this.spray('pixel', cx, 0.8, cz, 5, 0xd8f4ff, 0x5ab8ff, 4, 0.1, 0.22, Math.PI, 1.5);
        break;
      case 'spin':
        // dust kicked up around the feet
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + f.seed;
          this.spray('puff', f.x + Math.cos(a) * r * 0.5, 0.25, f.z + Math.sin(a) * r * 0.5, 1, DUST, 0xc8bca4, 2, 0.34, 0.4, 0.3, 0.3, Math.cos(a), Math.sin(a));
        }
        this.edgeSparks(f.x, f.z, f.a, TAU, r, c, 6);
        break;
      default:
        if (sh && sh.k === 'cone') this.edgeSparks(f.x, f.z, sh.back ? f.a + Math.PI : f.a, (sh.arc * Math.PI) / 180, sh.r, c, 4);
        else this.spray('pixel', cx, 0.9, cz, 4, WHITE, mix(c, WHITE, 0.5), 4, 0.1, 0.22, 0.8, 1, dx, dz);
    }
    if (style !== 'slash' && style !== 'slash_wide' && style !== 'spin' && style !== 'thrust' && style !== 'whoosh') {
      this.lights.request(cx, 1.2, cz, style === 'fire' || style === 'meteor' ? FIRE_MID : c, 1.1, 4 + r, this.run.player.x, this.run.player.z);
    }
  }

  /** Square sparks thrown from a blade arc. */
  private edgeSparks(x: number, z: number, base: number, arc: number, r: number, c: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = base - arc / 2 + ((i + 0.5) / n) * arc;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      this.spray('pixel', x + ca * r * 0.8, 0.9, z + sa * r * 0.8, 1, WHITE, mix(c, WHITE, 0.5), 3, 0.1, 0.25, 0.5, 1.2, ca, sa);
    }
    this.spray('spark', x + Math.cos(base) * r * 0.8, 0.9, z + Math.sin(base) * r * 0.8, 3, WHITE, mix(c, WHITE, 0.6), 7, 0.06, 0.15, 0.9, 1, Math.cos(base), Math.sin(base));
  }

  /** Big MCD fire explosion: a ball of orange/red pixels, square flames, dark smoke and embers. */
  private explosion(x: number, z: number, r: number, scale: number) {
    this.spray('pixel', x, 0.6, z, Math.round((10 + r * 4) * scale), 0xffd040, 0xff4a10, 3.5 + r * 1.4, 0.2, 0.42, Math.PI, 2.6, 0, 0, r * 0.3);
    this.spray('flame', x, 0.3, z, Math.round((8 + r * 3) * scale), FIRE_HOT, FIRE_DEEP, 1.2, 0.3, 0.6, Math.PI, 1, 0, 0, r * 0.5);
    this.spray('puff', x, 0.9, z, Math.round((3 + r) * scale), SMOKE, 0x2e2a28, 1.2, 0.55, 0.9, Math.PI, 1.6, 0, 0, r * 0.4);
    this.spray('ember', x, 0.5, z, Math.round(6 * scale), 0xffc040, 0xff4a10, 2.5, 0.07, 1, Math.PI, 2.5, 0, 0, r * 0.4);
  }

  /** Sweeping arc of a cone attack (slashes, breath, swings). */
  private cone(f: ActFx, sh: Extract<Shape, { k: 'cone' }>, k: number, style: string) {
    const c = f.color;
    const arc = (sh.arc * Math.PI) / 180;
    const base = sh.back ? f.a + Math.PI : f.a;
    if (style === 'fire' || style === 'poison' || style === 'ice' || style === 'dark' || style === 'holy' || style === 'shadow') {
      // breath / blast: a fan of square puffs that rolls outward, over a faint glow fan
      const t = 1 - k;
      const reach = sh.r * Math.min(1, t * 3 + 0.2);
      const rays = Math.max(4, Math.ceil(arc / 0.3));
      const rows = 3;
      for (let i = 0; i < rays; i++) {
        const a = base - arc / 2 + ((i + 0.5) / rays) * arc;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const w = (arc / rays) * reach * 1.1;
        this.b.glowPlane.push(f.x + ca * reach * 0.5, 0.1 + i * 0.002, f.z + sa * reach * 0.5, Math.PI / 2 - a, w, 1, reach, c, 0, 0, 0, k * 0.3);
        for (let j = 0; j < rows; j++) {
          const u = (j + 1) / rows;
          const d = reach * u * (0.8 + rnd(f.seed + i * 7 + j) * 0.3);
          const s = (0.2 + u * 0.4) * Math.min(1, k * 2.5);
          const y = 0.5 + rnd(i + j * 3 + f.seed) * 0.5 + t * 0.6 * u;
          const px = f.x + ca * d;
          const pz = f.z + sa * d;
          this.elementSquare(style, px, y, pz, s, u, f.seed + i * 3 + j);
        }
      }
      return;
    }
    if (style === 'punch' || style === 'shock' || style === 'smash' || style === 'meteor') {
      // ground shock fan: a wedge of floor blocks popping up behind a shock front
      const t = 1 - k;
      const rr = sh.r * (0.4 + t * 0.7);
      const n = Math.max(4, Math.ceil(arc / 0.25));
      for (let i = 0; i < n; i++) {
        const a = base - arc / 2 + ((i + 0.5) / n) * arc;
        this.b.glowPlane.push(f.x + Math.cos(a) * rr, 0.1, f.z + Math.sin(a) * rr, Math.PI / 2 - a, (arc / n) * rr * 1.2, 1, 0.4, c, 0, 0, 0, k * 0.8);
        if (style !== 'punch') {
          const d = sh.r * (0.35 + rnd(f.seed + i) * 0.5);
          const up = Math.sin(Math.min(1, t * 2.5) * Math.PI) * 0.45;
          this.block(f.x + Math.cos(a) * d, up * 0.5 - 0.05, f.z + Math.sin(a) * d, a + rnd(i) * 0.6, 0.38, 0.2 + up, 0.38, mix(DIRT, STONE, rnd(i * 5 + f.seed)), (rnd(i + 3) - 0.5) * 0.5, 0);
        }
      }
      this.dustRing(f.x + Math.cos(base) * sh.r * 0.45, f.z + Math.sin(base) * sh.r * 0.45, sh.r * 0.7, k, f.seed, 8);
      if (style === 'punch') this.punch(f.x, f.z, base, sh.r * 0.6, k, c);
      return;
    }
    // blade slash: a crisp crescent that sweeps across the arc at chest height
    this.arcSweep(f.x, f.z, base, arc, sh.r, k, c, style === 'slash_wide' ? 1.25 : 1, f.seed);
  }

  /** One square of an element breath / blast. `u` 0..1 is how far out it is. */
  private elementSquare(style: string, x: number, y: number, z: number, s: number, u: number, seed: number) {
    switch (style) {
      case 'fire':
        this.square(x, y, z, s, flameCol(u * 0.8 + rnd(seed) * 0.2), 1.1);
        break;
      case 'poison':
        this.square(x, y * 0.7, z, s, mix(TOXIC, TOXIC_DEEP, rnd(seed)), 1);
        break;
      case 'ice':
        this.square(x, y, z, s * 0.9, mix(ICE_HI, ICE, u), 1.05);
        break;
      case 'holy':
        this.square(x, y, z, s * 0.6, mix(GOLD_HI, GOLD, rnd(seed)), 1.1);
        break;
      default:
        this.square(x, y, z, s * 0.8, mix(SOUL_A, SOUL_B, rnd(seed)), 1.1);
        this.glint(x, y, z, s * 1.5, SOUL_A, 0.25);
    }
  }

  /**
   * Crescent sword swing: a white-hot leading edge over a coloured band that trails and fades
   * behind the swing, tilted like a diagonal slash, with a faint shadow on the ground.
   */
  private arcSweep(x: number, z: number, base: number, arc: number, r: number, k: number, c0: number, wide: number, seed: number) {
    // plain steel swings (near-white colour) get the golden MCD sword trail
    const mx = Math.max((c0 >> 16) & 255, (c0 >> 8) & 255, c0 & 255);
    const mn = Math.min((c0 >> 16) & 255, (c0 >> 8) & 255, c0 & 255);
    const c = mx - mn < 60 ? SWING_GOLD : c0;
    const full = arc > 6;
    const n = Math.max(8, Math.ceil(arc / 0.07));
    const life = 1 - k;
    const sweep = Math.min(1, life * 3.4 + 0.08);
    // alternate swing direction for combo hits
    const dir = Math.floor(seed) % 2 === 0 ? 1 : -1;
    const rr = r * 0.8;
    const fade = Math.min(1, k * 1.8) * Math.min(1, this.dim * 1.3);
    const er = (((mix(c, WHITE, 0.75) >> 16) & 255) / 255);
    const eg = (((mix(c, WHITE, 0.75) >> 8) & 255) / 255);
    const eb = ((mix(c, WHITE, 0.75) & 255) / 255);
    const br = ((c >> 16) & 255) / 255;
    const bg = ((c >> 8) & 255) / 255;
    const bb = (c & 255) / 255;
    let prev = 0;
    const steps = Math.max(1, Math.ceil(n * sweep));
    for (let j = 0; j <= steps; j++) {
      const u = Math.min(sweep, j / n);
      const a = dir > 0 ? base - arc / 2 + u * arc : base + arc / 2 - u * arc;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const behind = sweep - u; // 0 at the leading edge
      const tail = Math.max(0, 1 - behind * 1.5);
      const al = fade * (0.15 + 0.85 * tail);
      // crescent: thick in the middle of the swing, sharp at both ends
      const tip = full ? 0.75 : Math.max(0.04, Math.pow(Math.sin(u * Math.PI), 0.7));
      const w = r * 0.32 * tip * wide * (0.55 + 0.45 * tail);
      const y = 0.9 + (full ? Math.sin(a * 2 + seed) * 0.12 : (u - 0.5) * 0.45 * dir);
      const cur = prev ^ 1;
      const o = RP[cur * 3];
      const m = RP[cur * 3 + 1];
      const iN = RP[cur * 3 + 2];
      const ro = rr + w * 0.15;
      const rm = rr - w * 0.12;
      const ri = rr - w;
      setPt(o, x + ca * ro, y, z + sa * ro, er * al, eg * al, eb * al);
      setPt(m, x + ca * rm, y, z + sa * rm, br * al * 0.85, bg * al * 0.85, bb * al * 0.85);
      setPt(iN, x + ca * ri, y, z + sa * ri, 0, 0, 0);
      if (j > 0) {
        const po = RP[prev * 3];
        const pm = RP[prev * 3 + 1];
        const pi = RP[prev * 3 + 2];
        this.quad(po, pm, o, m);
        this.quad(pm, pi, m, iN);
      }
      prev = cur;
      // pixel glints riding the leading edge
      if (j > 0 && behind < 0.12 && rnd(seed + j * 13) < 0.35) {
        const d = rr + w * (0.15 + rnd(seed + j) * 0.4);
        this.square(x + ca * d, y + 0.05, z + sa * d, 0.1 * fade, j & 1 ? WHITE : mix(c, WHITE, 0.6), 1);
      }
    }
    // faint coloured shadow of the swing on the ground
    if (!full) {
      const a = base + (dir > 0 ? -arc / 2 + sweep * arc : arc / 2 - sweep * arc);
      this.b.glowDisc.push(x + Math.cos(a) * rr * 0.7, 0.06, z + Math.sin(a) * rr * 0.7, 0, r * 0.9, 1, r * 0.9, c, 0, 0, 0, fade * 0.15);
    }
  }

  /** Full-circle spin slash. */
  private spin(f: ActFx, r: number, k: number) {
    this.arcSweep(f.x, f.z, f.a + Math.PI, TAU, r, k, f.color, 1, f.seed);
    this.b.glowRingThin.push(f.x, 0.08, f.z, 0, r, 1, r, f.color, 0, 0, 0, k * 0.4);
  }

  /** Expanding ring of chunky dust squares on the ground. */
  private dustRing(x: number, z: number, r: number, k: number, seed: number, count: number) {
    const t = 1 - k;
    const n = this.n(count);
    const rr = r * (0.45 + Math.sqrt(t) * 0.75);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed;
      const d = rr * (0.85 + rnd(seed + i) * 0.3);
      const s = (0.38 + rnd(i * 3 + seed) * 0.3) * (t < 0.15 ? t / 0.15 : Math.min(1, k * 1.6));
      const sh = 1 - t * 0.2 - rnd(i + seed) * 0.12;
      this.square(x + Math.cos(a) * d, 0.22 + t * 0.35 + rnd(i) * 0.15, z + Math.sin(a) * d, s, mix(DUST, 0x9a8e7a, 1 - sh), 1, rnd(i) * 0.3);
    }
  }

  /** Ring of small coloured squares thrown outward. */
  private squareRing(x: number, y: number, z: number, r: number, n: number, c: number, k: number, seed: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed;
      const d = r * (0.9 + rnd(seed + i) * 0.2);
      this.square(x + Math.cos(a) * d, y + rnd(i * 7 + seed) * 0.4, z + Math.sin(a) * d, 0.14 * k, i % 3 === 0 ? mix(c, WHITE, 0.5) : c, 1.05);
    }
  }

  /** Round impact: smash, shock, holy, fire, ice, dark, poison, explosion. */
  private burst(f: ActFx, r: number, k: number, style: string) {
    const c = f.color;
    const t = 1 - k;
    const rr = r * (0.35 + Math.sqrt(t) * 0.75);
    const d = this.dim;
    const b = this.b;
    b.glowRing.push(f.x, 0.1, f.z, 0, rr, 1, rr, c, 0, 0, 0, k * 0.7 * d);
    b.glowDisc.push(f.x, 0.08, f.z, 0, r * 1.6, 1, r * 1.6, c, 0, 0, 0, k * 0.12 * d);
    switch (style) {
      case 'smash':
      case 'shock':
      case 'meteor': {
        // cracked crater: floor blocks jump out of the ground and settle, dust rolls outward
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 1.5, 1, r * 1.5, 0x70645a);
        const n = this.n(10);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rnd(f.seed * 3 + i) * 0.5;
          const dd = r * (0.35 + rnd(i + f.seed) * 0.45);
          const up = Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.55;
          const s = 0.32 + rnd(i * 7 + f.seed) * 0.18;
          this.block(f.x + Math.cos(a) * dd, up * 0.6 - 0.04, f.z + Math.sin(a) * dd, a, s, 0.22 + up * 0.4, s, mix(DIRT, STONE, rnd(i * 5 + f.seed)), (rnd(i + 3) - 0.5) * up, (rnd(i + 5) - 0.5) * up);
        }
        this.dustRing(f.x, f.z, r, k, f.seed, 14);
        if (style === 'meteor') this.fireColumns(f.x, f.z, r * 0.8, k, f.seed, 8);
        b.glowRingThin.push(f.x, 0.4, f.z, 0, rr * 1.1, 1, rr * 1.1, mix(c, WHITE, 0.5), 0, 0, 0, k * 0.4 * d);
        break;
      }
      case 'holy': {
        // soft golden shaft and square motes rising out of the ring
        const w = r * 0.35 * (1 - t * 0.5);
        b.glowBoxTop.push(f.x, 2.5, f.z, this.time * 0.5, w, 5, w, GOLD, 0, 0, 0, k * 0.16 * d);
        b.glowRingThin.push(f.x, 0.12, f.z, -this.time, rr * 0.8, 1, rr * 0.8, GOLD_HI, 0, 0, 0, k * 0.5 * d);
        const n = this.n(12);
        for (let i = 0; i < n; i++) {
          const a = rnd(f.seed + i * 3) * TAU;
          const dd = r * Math.sqrt(rnd(f.seed + i * 5)) * 0.9;
          const y = 0.2 + t * (1.2 + rnd(i) * 1.6);
          const s = 0.12 * Math.min(1, k * 2) * (0.7 + rnd(i * 11) * 0.6);
          this.square(f.x + Math.cos(a) * dd, y, f.z + Math.sin(a) * dd, s, i % 3 === 0 ? WHITE : i & 1 ? GOLD : GOLD_HI, 1.1);
        }
        break;
      }
      case 'fire': {
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 1.4, 1, r * 1.4, 0x605048);
        this.fireColumns(f.x, f.z, r * 0.8, k, f.seed, 8);
        break;
      }
      case 'ice': {
        // crystal blocks spike up out of the ground, tilted outward
        b.glowDisc.push(f.x, 0.07, f.z, 0, r * 2, 1, r * 2, ICE_HI, 0, 0, 0, k * 0.2 * d);
        this.crystals(f.x, f.z, r, Math.min(1, t * 5) * Math.min(1, k * 3), f.seed, 7);
        break;
      }
      case 'dark':
      case 'shadow': {
        b.darkDisc.push(f.x, 0.05, f.z, 0, r * 2, 1, r * 2, 0x7060a0);
        this.soulFlames(f.x, f.z, r * (0.3 + t * 0.6), k, f.seed, 8, -this.time * 2);
        break;
      }
      case 'poison':
        b.glowDisc.push(f.x, 0.07, f.z, this.time, r * 2.2, 1, r * 2.2, TOXIC, 0, 0, 0, k * 0.3 * d);
        this.bubbles(f.x, f.z, r, k, f.seed, 10);
        break;
      case 'punch':
        this.punch(f.x, f.z, f.a, r, k, c);
        break;
      default:
        this.squareRing(f.x, 0.5, f.z, rr, this.n(10), c, k, f.seed);
    }
  }

  /** Columns of stacked square flames (yellow core at the base, red tips). */
  private fireColumns(x: number, z: number, r: number, k: number, seed: number, count: number) {
    const n = this.n(count);
    const grow = Math.min(1, (1 - k) * 6) * Math.min(1, k * 2.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed;
      const d = r * (0.25 + rnd(seed + i) * 0.75);
      this.flameStack(x + Math.cos(a) * d, z + Math.sin(a) * d, (0.7 + rnd(i * 3 + seed) * 0.6) * grow, seed + i * 17);
    }
  }

  /** One flickering flame: three to four squares stacked and shrinking upward. */
  private flameStack(x: number, z: number, s: number, seed: number) {
    if (s <= 0.02) return;
    const ph = (this.time * 3.2 + rnd(seed) * 4) % 1;
    let y = 0.12 * s;
    for (let j = 0; j < 4; j++) {
      const u = j / 3;
      const sz = s * (0.5 - u * 0.3) * (1 - ph * 0.25 * u);
      const sway = Math.sin(this.time * 9 + seed + j) * 0.06 * u * s;
      const yy = y + ph * 0.25 * s * u;
      this.square(x + sway, yy, z, sz, flameCol(Math.min(1, 0.25 + u * 0.75 + ph * 0.15)), 1 - u * 0.1);
      if (j < 2) this.glint(x + sway, yy, z, sz * 0.55, FIRE_HOT, 0.75 - j * 0.3);
      y += sz * 0.8;
    }
    // ember spark popping off the top
    if (ph > 0.6) this.square(x + (rnd(seed + 3) - 0.5) * 0.3 * s, y + (ph - 0.6) * 1.6 * s, z, 0.06 * s, FIRE_HOT, 1.2);
  }

  /** Tilted crystal blocks with bright caps. */
  private crystals(x: number, z: number, r: number, g: number, seed: number, count: number) {
    if (g <= 0.02) return;
    const n = this.n(count);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed;
      const d = r * (0.25 + rnd(i * 5 + seed) * 0.6);
      const h = (0.6 + rnd(i + seed) * 0.9) * g;
      const w = 0.22 + rnd(i * 3 + seed) * 0.14;
      const tilt = 0.25 + rnd(i * 9 + seed) * 0.25;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      this.block(px, h * 0.4, pz, -a, w, h, w, mix(ICE, ICE_HI, rnd(i + 2)), Math.cos(a) * tilt, Math.sin(a) * tilt);
      this.glint(px + Math.cos(a) * h * tilt * 0.4, h * 0.85, pz + Math.sin(a) * h * tilt * 0.4, w * 0.9, ICE_HI, 0.45 * g);
    }
  }

  /** Blue / purple soul flames circling a point. */
  private soulFlames(x: number, z: number, r: number, k: number, seed: number, count: number, rot: number) {
    const n = this.n(count);
    const g = Math.min(1, k * 2.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rot + seed;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      const ph = (this.time * 2.6 + rnd(seed + i)) % 1;
      const s = 0.3 * g * (0.8 + rnd(i * 3) * 0.4);
      for (let j = 0; j < 3; j++) {
        const u = j / 2;
        const sz = s * (1 - u * 0.55) * (1 - ph * 0.3);
        this.square(px, 0.3 + j * s * 0.75 + ph * 0.2, pz, sz, mix(j === 0 ? 0xd8c8ff : SOUL_A, SOUL_B, u), 1.15);
      }
      this.glint(px, 0.6, pz, s * 2.4, SOUL_A, 0.22 * g);
    }
  }

  /** Bubbling poison: green squares that rise, swell and pop. */
  private bubbles(x: number, z: number, r: number, k: number, seed: number, count: number, fade = 1) {
    const n = this.n(count);
    for (let i = 0; i < n; i++) {
      const cyc = this.time * (0.9 + rnd(i + seed) * 0.6) + rnd(seed + i * 3);
      const ph = cyc % 1;
      const id = Math.floor(cyc) * 31 + i;
      const a = rnd(id + seed) * TAU;
      const d = Math.sqrt(rnd(id * 3 + seed)) * r * 0.9;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const s = (0.12 + ph * 0.16) * Math.min(1, k * 3) * fade;
      if (ph > 0.88) {
        // pop
        const o = s * 1.4;
        for (let j = 0; j < 4; j++) this.square(px + (j & 1 ? o : -o), 0.15 + ph * 0.6 + (j & 2 ? o : -o) * 0.6, pz, s * 0.3, 0xc8ff8a, 1.05);
      } else {
        const y = 0.12 + ph * 0.6;
        this.square(px, y, pz, s, rnd(id) < 0.5 ? TOXIC : 0x5ab828, 1);
        this.square(px - s * 0.2, y + s * 0.2, pz, s * 0.3, 0xe0ffc0, 1.05);
      }
    }
  }

  /** Straight attack: thrust, charge line, beam, wave. */
  private thrust(x: number, z: number, a: number, off: number, len: number, w: number, k: number, c: number, style: string, seed: number) {
    const ext = Math.min(1, (1 - k) * 4 + 0.15);
    const L = len * ext;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = x + ca * (off + L * 0.5);
    const cz = z + sa * (off + L * 0.5);
    const yaw = Math.PI / 2 - a;
    const ground = style === 'smash' || style === 'shock' || style === 'fire' || style === 'ice' || style === 'poison' || style === 'meteor' || style === 'dark' || style === 'holy';
    if (ground) {
      this.b.glowPlane.push(cx, 0.09, cz, yaw, w, 1, L, c, 0, 0, 0, k * 0.4);
      const n = Math.max(2, Math.ceil(L / 0.9));
      const t = 1 - k;
      for (let i = 0; i < n; i++) {
        const dd = off + ((i + 0.5) / n) * L;
        const px = x + ca * dd + (rnd(seed + i) - 0.5) * w * 0.5;
        const pz = z + sa * dd + (rnd(seed + i * 3) - 0.5) * w * 0.5;
        const pop = Math.sin(Math.min(1, t * 3) * Math.PI);
        switch (style) {
          case 'fire':
            this.flameStack(px, pz, (0.8 + rnd(i) * 0.4) * Math.min(1, k * 2.5) * Math.min(1, t * 8), seed + i * 11);
            break;
          case 'ice':
            this.crystals(px, pz, w * 0.4, Math.min(1, t * 6) * Math.min(1, k * 3), seed + i, 2);
            break;
          case 'poison':
            this.square(px, 0.2 + t * 0.5, pz, 0.3 * k, rnd(i) < 0.5 ? TOXIC : TOXIC_DEEP, 1);
            break;
          case 'dark':
            this.square(px, 0.3 + t * 0.8, pz, 0.28 * k, mix(SOUL_A, SOUL_B, rnd(i)), 1.15);
            break;
          case 'holy':
            this.square(px, 0.3 + t * 1.2, pz, 0.16 * k, i & 1 ? GOLD : GOLD_HI, 1.1);
            break;
          default: {
            const hgt = 0.25 + pop * 0.5;
            this.block(px, hgt * 0.5 - 0.05, pz, a + i, w * 0.32, hgt, w * 0.32, mix(DIRT, STONE, rnd(i * 5 + seed)), (rnd(i) - 0.5) * 0.4, 0);
            this.square(px, 0.25 + t * 0.4, pz, 0.4 * Math.min(1, k * 1.6) * Math.min(1, t * 6), DUST, 1);
          }
        }
      }
      return;
    }
    // air thrust: a bright lance with a fading tail and a pixel spray at the tip
    this.b.glowPlane.push(cx, 0.9, cz, yaw, w * 0.5, 1, L, c, 0, 0, 0, k * 0.7);
    this.b.glowPlane.push(cx, 0.92, cz, yaw, w * 0.14, 1, L, mix(c, WHITE, 0.7), 0, 0, 0, k);
    this.b.glowPlane.push(cx, 0.07, cz, yaw, w, 1, L, c, 0, 0, 0, k * 0.12);
    const tx = x + ca * (off + L);
    const tz = z + sa * (off + L);
    this.glint(tx, 0.9, tz, w * 0.8, mix(c, WHITE, 0.5), k * 0.6, 0.785);
    for (let i = 0; i < 3; i++) {
      const o = (1 - k) * (0.3 + i * 0.25);
      this.square(tx + ca * o - sa * (i - 1) * o * 0.6, 0.9 + (i - 1) * 0.12, tz + sa * o + ca * (i - 1) * o * 0.6, 0.1 * k, i === 1 ? WHITE : c, 1.1);
    }
  }

  /** Fist shockwave in front of the hero. */
  private punch(x: number, z: number, a: number, r: number, k: number, c: number) {
    const d = r * 0.6;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const s = 0.6 + (1 - k) * 1.2;
    this.b.glowRing.push(px, 0.9, pz, 0, s * 0.7, 1, s * 0.7, mix(c, WHITE, 0.5), 0, 0, 0, k * 0.8);
    this.b.glowPlane.push(px, 0.9, pz, Math.PI / 2 - a, s * 1.4, 1, s * 0.4, c, 0, 0, 0, k * 0.8);
    this.glint(px, 0.9, pz, s * 0.7, c, k * 0.25, 0.785);
    for (let i = 0; i < 8; i++) {
      const b = (i / 8) * TAU;
      const o = s * 0.8;
      this.square(px + Math.cos(b) * o, 0.9 + Math.sin(b) * o * 0.5, pz + Math.sin(b) * o * 0.3, 0.12 * k, i & 1 ? WHITE : c, 1.1);
    }
  }

  // ---------------------------------------------------------------- telegraphs and zones
  private warn(f: ActFx) {
    const k = 1 - f.life / f.max; // 0 -> 1
    const blink = 0.8 + Math.sin(this.time * 20) * 0.2;
    this.b.glowRing.push(f.x, 0.07, f.z, 0, f.r, 1, f.r, f.color, 0, 0, 0, 0.7 * blink);
    this.b.glowDisc.push(f.x, 0.06, f.z, 0, f.r * 2.2 * k, 1, f.r * 2.2 * k, f.color, 0, 0, 0, 0.35);
  }

  private zone(f: ActFx) {
    const c = f.color;
    const age = f.max - f.life;
    const fade = Math.min(1, age * 4, f.life * 2);
    const r = f.r;
    const t = this.time;
    const b = this.b;
    const d = this.dim;
    switch (f.vis) {
      case 'seal': {
        // engraved sigil: two counter-rotating rings, a square glyph and corner runes
        b.glowRing.push(f.x, 0.07, f.z, t * 0.6, r, 1, r, c, 0, 0, 0, 0.6 * fade);
        b.glowRingThin.push(f.x, 0.08, f.z, -t, r * 0.7, 1, r * 0.7, mix(c, WHITE, 0.5), 0, 0, 0, 0.4 * fade);
        for (let i = 0; i < 4; i++) {
          const a = t * 0.6 + (i * Math.PI) / 2;
          b.glowPlane.push(f.x + Math.cos(a) * r * 0.5, 0.09, f.z + Math.sin(a) * r * 0.5, Math.PI / 2 - a + Math.PI / 2, r * 0.9, 1, 0.12, c, 0, 0, 0, 0.55 * fade);
          const a2 = a + Math.PI / 4;
          const bob = Math.sin(t * 3 + i) * 0.1;
          this.square(f.x + Math.cos(a2) * r * 0.72, 0.35 + bob, f.z + Math.sin(a2) * r * 0.72, 0.16 * fade, mix(c, WHITE, 0.3), 1.1);
        }
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 1.6, 1, r * 1.6, c, 0, 0, 0, (0.18 + Math.sin(t * 3 + f.seed) * 0.06) * fade * d);
        break;
      }
      case 'poison':
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 2.1, 1, r * 2.1, 0x90a080);
        b.glowDisc.push(f.x, 0.06, f.z, t * 0.2, r * 2.2, 1, r * 2.2, c, 0, 0, 0, 0.3 * fade * d);
        this.bubbles(f.x, f.z, r, 1, f.seed, Math.min(18, Math.round(r * 4)), fade);
        if (Math.random() < this.dt * 3 * this.mul) this.spray('puff', f.x + (Math.random() - 0.5) * r * 1.4, 0.2, f.z + (Math.random() - 0.5) * r * 1.4, 1, 0x7ac83a, 0x4a8a20, 0.3, 0.5, 1, Math.PI, 0.4);
        break;
      case 'fire': {
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 2, 1, r * 2, 0x806050);
        b.glowDisc.push(f.x, 0.06, f.z, t, r * 2.1, 1, r * 2.1, c, 0, 0, 0, (0.3 + Math.sin(t * 13 + f.seed) * 0.06) * fade * d);
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, FIRE_HOT, 0, 0, 0, 0.4 * fade);
        const n = this.n(Math.min(16, Math.round(r * 3.5)));
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + f.seed;
          const dd = r * Math.sqrt((i + 0.5) / n) * 0.92;
          this.flameStack(f.x + Math.cos(a) * dd, f.z + Math.sin(a) * dd, (0.75 + rnd(i + f.seed) * 0.5) * fade, f.seed + i * 13);
        }
        if (Math.random() < this.dt * 6 * this.mul) this.spray('ember', f.x + (Math.random() - 0.5) * r * 1.4, 0.3, f.z + (Math.random() - 0.5) * r * 1.4, 1, 0xffc040, 0xff4a10, 0.6, 0.07, 1, Math.PI, 1.6);
        break;
      }
      case 'ice':
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 2.1, 1, r * 2.1, ICE_HI, 0, 0, 0, 0.25 * fade * d);
        b.glowRing.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.5 * fade);
        this.crystals(f.x, f.z, r * 1.1, fade, f.seed, 8);
        break;
      case 'rain': {
        // glowing arrows / light streaks falling into the circle
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.55 * fade);
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2, 1, r * 2, c, 0, 0, 0, 0.12 * fade * d);
        const n = this.n(10);
        for (let i = 0; i < n; i++) {
          const ph = (t * 2.5 + i / n + f.seed) % 1;
          const id = Math.floor(t * 2.5 + i / n + f.seed) * 13 + i;
          const a = rnd(id) * TAU;
          const dd = Math.sqrt(rnd(id + 1)) * r;
          const x = f.x + Math.cos(a) * dd;
          const z = f.z + Math.sin(a) * dd;
          const y = (1 - ph) * 6;
          this.b.segment(x - 0.45, y + 1.4, z - 0.45, x, y, z, 0.07, c, fade * 0.6);
          this.square(x, y + 0.05, z, 0.12, mix(c, WHITE, 0.6), 1.15);
          if (ph > 0.88) {
            this.square(x, 0.12, z, 0.3 * fade, DUST, 1);
            this.glint(x, 0.15, z, 0.5, c, fade * 0.5, 0.785);
          }
        }
        break;
      }
      case 'storm': {
        b.darkDisc.push(f.x, 0.04, f.z, 0, r * 2.2, 1, r * 2.2, 0x7080a0);
        b.glowRing.push(f.x, 0.07, f.z, -t * 0.4, r, 1, r, c, 0, 0, 0, 0.45 * fade);
        // a chunky storm cloud of dark squares overhead
        const n = this.n(10);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + t * 0.3 + f.seed;
          const dd = r * (0.2 + rnd(i + f.seed) * 0.6);
          this.square(f.x + Math.cos(a) * dd, 5.2 + rnd(i * 3) * 0.6, f.z + Math.sin(a) * dd, (0.9 + rnd(i * 7) * 0.7) * fade, mix(0x3a4258, 0x58607a, rnd(i * 5)), 1);
        }
        break;
      }
      case 'vines': {
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.1, 1, r * 2.1, 0x4a9a3a, 0, 0, 0, 0.25 * fade);
        const n = this.n(9);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + f.seed;
          const dd = r * (0.3 + rnd(i + f.seed) * 0.65);
          const h = (0.5 + Math.sin(t * 3 + i) * 0.15) * fade;
          const px = f.x + Math.cos(a) * dd;
          const pz = f.z + Math.sin(a) * dd;
          this.block(px, h * 0.5, pz, a + t * 0.3, 0.16, h, 0.16, 0x4a8a32, Math.sin(t * 2 + i) * 0.2, 0);
          this.block(px, h, pz, a, 0.24, 0.12, 0.24, 0x6ac85a);
        }
        break;
      }
      case 'trap': {
        const blink = Math.floor(t * 3 + f.seed) % 2 === 0 ? 1 : 0.5;
        b.glowRingThin.push(f.x, 0.07, f.z, 0, r, 1, r, c, 0, 0, 0, 0.35 * fade);
        b.glowBoxTop.push(f.x, 0.1, f.z, Math.PI / 4, 0.5, 0.15, 0.5, c, 0, 0, 0, blink * fade);
        break;
      }
      case 'light': {
        b.glowDisc.push(f.x, 0.06, f.z, 0, r * 2.2, 1, r * 2.2, c, 0, 0, 0, 0.14 * fade * d);
        b.glowRing.push(f.x, 0.07, f.z, t * 0.5, r, 1, r, GOLD_HI, 0, 0, 0, 0.4 * fade);
        b.glowBoxTop.push(f.x, 2, f.z, t, r * 0.15, 4, r * 0.15, c, 0, 0, 0, 0.1 * fade * d);
        const n = this.n(Math.min(14, Math.round(r * 3)));
        for (let i = 0; i < n; i++) {
          const cyc = t * 0.7 + rnd(f.seed + i);
          const ph = cyc % 1;
          const id = Math.floor(cyc) * 17 + i;
          const a = rnd(id) * TAU;
          const dd = Math.sqrt(rnd(id + 2)) * r * 0.9;
          this.square(f.x + Math.cos(a) * dd, 0.2 + ph * 2.2, f.z + Math.sin(a) * dd, 0.11 * Math.sin(ph * Math.PI) * fade, i & 1 ? GOLD : GOLD_HI, 1.1);
        }
        break;
      }
      default: {
        // aura / generic ward with motes drifting up from the rim
        b.glowRing.push(f.x, 0.08, f.z, t * 0.8, r, 1, r, c, 0, 0, 0, 0.5 * fade);
        b.glowRingThin.push(f.x, 0.1, f.z, -t * 1.4, r * 0.8, 1, r * 0.8, c, 0, 0, 0, 0.3 * fade);
        b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.1, 1, r * 2.1, c, 0, 0, 0, (0.08 + Math.sin(t * 3) * 0.03) * fade * d);
        const n = this.n(10);
        for (let i = 0; i < n; i++) {
          const ph = (t * 0.6 + rnd(i + f.seed)) % 1;
          const a = (i / n) * TAU + t * 0.4;
          this.square(f.x + Math.cos(a) * r, 0.15 + ph * 1.6, f.z + Math.sin(a) * r, 0.1 * Math.sin(ph * Math.PI) * fade, i & 1 ? c : mix(c, WHITE, 0.5), 1.05);
        }
      }
    }
    if (f.vis !== 'trap' && f.vis !== 'seal') this.lights.request(f.x, 1, f.z, f.vis === 'fire' ? FIRE_MID : c, 0.6 * fade, r * 2, this.run.player.x, this.run.player.z);
  }

  // ---------------------------------------------------------------- sky falls, lightning, movement
  private fall(f: ActFx, first: boolean) {
    const k = f.life / f.max; // 1 -> 0
    const d = this.dim;
    const c = f.color;
    if (f.vis === 'meteor_drop') {
      // a burning block with a tail of square flames and smoke
      const y = 0.4 + k * 14;
      const ox = k * 4;
      const s = Math.min(1.1, Math.max(0.55, f.r * 0.28));
      const mx = f.x - ox;
      const mz = f.z - ox * 0.5;
      // tail palette follows the skill colour (fire meteors orange, arcane stars violet)
      const hot = mix(c, FIRE_HOT, 0.5);
      const mid = c;
      const deep = mix(c, 0x301018, 0.5);
      this.block(mx, y, mz, this.time * 4, s, s, s, 0x4a3226, this.time * 3, this.time * 2);
      this.glint(mx, y, mz, s * 1.8, mid, 0.4 * d);
      const n = this.n(12);
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        const jx = (rnd(f.seed + i + Math.floor(this.time * 20)) - 0.5) * s * 0.6;
        const tx = mx - u * 2.6 + jx;
        const ty = y + u * 3.9;
        const tz = mz - u * 1.3;
        this.square(tx, ty, tz, s * 0.7 * (1 - u * 0.8), u < 0.75 ? flameCol(u * 1.3, hot, mid, deep) : mix(deep, SMOKE, (u - 0.75) * 4), 1 - u * 0.2);
      }
      this.lights.request(mx, y, f.z, FIRE_MID, 1.2, 8, this.run.player.x, this.run.player.z);
      return;
    }
    if (f.vis === 'light_drop') {
      const w = f.r * 0.18 * (1 - k * 0.5);
      this.b.glowBoxTop.push(f.x, 4, f.z, 0, w, 8, w, c, 0, 0, 0, (1 - k) * 0.22 * d);
      for (let i = 0; i < 4; i++) {
        const y = ((this.time * 3 + i / 4) % 1) * 6;
        this.square(f.x + (rnd(i + f.seed) - 0.5) * w, 6 - y, f.z + (rnd(i * 3 + f.seed) - 0.5) * w, 0.12 * (1 - k), GOLD_HI, 1.1);
      }
      return;
    }
    // impact
    const t = 1 - k;
    const r = f.r * (0.5 + Math.sqrt(t) * 1.1);
    this.b.glowDisc.push(f.x, 0.1, f.z, 0, f.r * 2.4, 1, f.r * 2.4, c, 0, 0, 0, k * 0.3 * d);
    this.b.glowRing.push(f.x, 0.14, f.z, 0, r, 1, r, c, 0, 0, 0, k * 0.8 * d);
    if (f.vis === 'light') {
      const w = f.r * 0.35 * k;
      this.b.glowBoxTop.push(f.x, 4, f.z, this.time, w, 8, w, c, 0, 0, 0, k * 0.25 * d);
      this.b.glowBox.push(f.x, 4, f.z, 0, w * 0.3, 8, w * 0.3, GOLD_HI, 0, 0, 0, k * 0.3 * d);
      this.squareRing(f.x, 0.4 + t * 1.2, f.z, r * 0.8, this.n(12), mix(c, GOLD_HI, 0.5), k, f.seed);
    } else {
      this.b.darkDisc.push(f.x, 0.04, f.z, 0, f.r * 2, 1, f.r * 2, 0x605048);
      this.fireColumns(f.x, f.z, f.r * 0.8, k, f.seed, 10);
      this.dustRing(f.x, f.z, f.r, k, f.seed, 12);
    }
    if (first) {
      if (f.vis === 'meteor') {
        this.explosion(f.x, f.z, Math.min(4, f.r), 1.2);
        this.run.fx.burst(f.x, 0.3, f.z, 0x5a4a3a, 8, 5, 0.2, 0.7, 'debris');
      } else {
        this.spray('ember', f.x, 0.3, f.z, 10, GOLD_HI, GOLD, 1.5, 0.1, 0.9, Math.PI, 2.6, 0, 0, f.r * 0.5);
        this.spray('pixel', f.x, 0.6, f.z, 10, WHITE, GOLD, 4, 0.12, 0.35, Math.PI, 2);
      }
      this.run.fx.light(f.x, f.z, f.vis === 'meteor' ? FIRE_MID : c, 2.4, f.r * 3, 0.4);
    }
  }

  private bolt(f: ActFx, first: boolean) {
    const k = f.life / f.max;
    const high = f.y > 3;
    const segs = high ? 9 : 6;
    const y0 = f.y > 0 ? f.y : 0.9;
    let px = f.x;
    let py = y0;
    let pz = f.z;
    const seed = Math.floor(this.time * 24) + f.seed;
    // flicker: lightning strobes rather than fading smoothly
    const a = k * (rnd(seed * 3) < 0.25 ? 0.45 : 1);
    const dx = f.x2 - f.x;
    const dz = f.z2 - f.z;
    let bx = 0;
    let by = 0;
    let bz = 0;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const j = i === segs ? 0 : high ? 0.9 : 0.6;
      const nx = f.x + dx * t + (rnd(seed + i) - 0.5) * j;
      const nz = f.z + dz * t + (rnd(seed + i * 7) - 0.5) * j;
      const ny = y0 + (0.7 - y0) * t + (i === segs ? 0 : (rnd(seed + i * 3) - 0.5) * (high ? 0.6 : 0.4));
      this.b.segment(px, py, pz, nx, ny, nz, 0.24, f.color, a * 0.8);
      this.b.segment(px, py, pz, nx, ny, nz, 0.08, WHITE, a);
      if (i === Math.floor(segs / 2)) {
        bx = nx;
        by = ny;
        bz = nz;
      }
      px = nx;
      py = ny;
      pz = nz;
    }
    // one forked branch off the middle
    const ex = bx + (rnd(seed + 41) - 0.5) * 1.6 + dx * 0.15;
    const ez = bz + (rnd(seed + 43) - 0.5) * 1.6 + dz * 0.15;
    const ey = Math.max(0.3, by - 0.6 - rnd(seed + 47));
    this.b.segment(bx, by, bz, ex, ey, ez, 0.12, f.color, a * 0.6);
    this.b.segment(bx, by, bz, ex, ey, ez, 0.04, WHITE, a * 0.8);
    this.b.glowDisc.push(f.x2, 0.07, f.z2, 0, 1.4, 1, 1.4, f.color, 0, 0, 0, k * 0.5);
    // crackling square sparks at the strike point
    for (let i = 0; i < 4; i++) {
      const ra = rnd(seed + i * 5) * TAU;
      const rr = 0.2 + rnd(seed + i * 9) * 0.5;
      this.square(f.x2 + Math.cos(ra) * rr, 0.4 + rnd(seed + i) * 0.7, f.z2 + Math.sin(ra) * rr, 0.09 * k, i & 1 ? WHITE : mix(f.color, WHITE, 0.4), 1.2);
    }
    if (first) this.spray('spark', f.x2, 0.7, f.z2, 5, WHITE, f.color, 8, 0.05, 0.16, Math.PI, 2);
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
    if (!leap) {
      this.b.glowPlane.push(cx, 0.08, cz, yaw, 0.8, 1, len, f.color, 0, 0, 0, fade * 0.25);
      this.b.glowPlane.push(cx, 0.9, cz, yaw, 0.55, 1, len, f.color, 0, 0, 0, fade * 0.3);
      this.b.glowPlane.push(cx, 0.92, cz, yaw, 0.14, 1, len, mix(f.color, WHITE, 0.6), 0, 0, 0, fade * 0.45);
      // dust kicked up along the path: squares that are biggest where the hero just left
      const n = Math.min(10, Math.ceil(len / 0.6));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const s = (0.2 + u * 0.22) * fade * (0.8 + rnd(f.seed + i) * 0.4);
        const side = (rnd(f.seed + i * 3) - 0.5) * 0.5;
        this.square(f.x + dx * u - (dz / len) * side, 0.18 + (1 - fade) * 0.3, f.z + dz * u + (dx / len) * side, s, mix(DUST, f.color, 0.2), 1);
      }
    } else {
      this.b.glowPlane.push(cx, 0.08, cz, yaw, 0.45, 1, len, f.color, 0, 0, 0, fade * 0.3);
      // arcing dotted path for leaps
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        this.square(f.x + dx * t, Math.sin(t * Math.PI) * 2.2 + 0.4, f.z + dz * t, 0.16 * fade, i & 1 ? f.color : mix(f.color, WHITE, 0.5), 1.1);
      }
    }
  }

  private blink(f: ActFx, first: boolean) {
    const k = f.life / f.max;
    const r = 0.4 + (1 - k) * 1.2;
    this.b.glowRing.push(f.x, 0.1, f.z, 0, r, 1, r, f.color, 0, 0, 0, k * 0.8);
    this.b.darkDisc.push(f.x, 0.04, f.z, 0, 2.2 * k, 1, 2.2 * k, 0x8070a0);
    // a column of squares puffing upward
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + f.seed;
      const rr = 0.3 + (1 - k) * 0.5 + rnd(i + f.seed) * 0.2;
      const s = 0.22 * k * (0.7 + rnd(i * 3) * 0.6);
      this.square(f.x + Math.cos(a) * rr, 0.3 + (1 - k) * 1.8 * (0.5 + rnd(i * 5) * 0.8), f.z + Math.sin(a) * rr, s, i & 1 ? f.color : mix(f.color, 0x201030, 0.4), 1.05);
    }
    if (first) this.spray('puff', f.x, 0.6, f.z, 5, mix(f.color, 0x302040, 0.4), f.color, 1.8, 0.36, 0.45, Math.PI, 1);
  }

  private flash(f: ActFx, first: boolean) {
    // a burst of power around the hero: rings and a shell of squares, no screen wash
    const k = f.life / f.max;
    const d = this.dim;
    const t = 1 - k;
    const r = f.r * (0.4 + Math.sqrt(t) * 0.9);
    this.b.glowDisc.push(f.x, 0.1, f.z, 0, f.r * 2, 1, f.r * 2, f.color, 0, 0, 0, k * 0.2 * d);
    this.b.glowRing.push(f.x, 0.14, f.z, 0, r, 1, r, f.color, 0, 0, 0, k * 0.8 * d);
    this.b.glowRingThin.push(f.x, 0.8, f.z, 0, r * 0.7, 1, r * 0.7, mix(f.color, WHITE, 0.5), 0, 0, 0, k * 0.5 * d);
    const n = this.n(16);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.seed;
      const dd = r * (0.7 + rnd(i + f.seed) * 0.35);
      this.square(f.x + Math.cos(a) * dd, 0.5 + rnd(i * 3 + f.seed) * 1.2 + t * 0.6, f.z + Math.sin(a) * dd, 0.16 * k, i % 3 === 0 ? mix(f.color, WHITE, 0.45) : f.color, 1.1);
    }
    if (first) this.spray('pixel', f.x, 1, f.z, 10, mix(f.color, WHITE, 0.5), f.color, 5, 0.13, 0.4, Math.PI, 2);
  }

  private aura(f: ActFx) {
    const fade = Math.min(1, (f.max - f.life) * 4, f.life * 2);
    const t = this.time;
    const r = f.r;
    this.b.glowRing.push(f.x, 0.06, f.z, t, r, 1, r, f.color, 0, 0, 0, 0.4 * fade);
    // four squares orbiting the hero, and motes rising off the rim
    for (let i = 0; i < 4; i++) {
      const a = t * 2.4 + (i * TAU) / 4;
      const y = 0.7 + Math.sin(t * 3 + i * 2) * 0.35;
      this.square(f.x + Math.cos(a) * r * 0.9, y, f.z + Math.sin(a) * r * 0.9, 0.16 * fade, i & 1 ? f.color : mix(f.color, WHITE, 0.5), 1.1);
    }
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.9 + i / 5) % 1;
      const a = i * 2.4 + Math.floor(t * 0.9 + i / 5) * 1.7;
      this.square(f.x + Math.cos(a) * r * 0.7, 0.2 + ph * 1.8, f.z + Math.sin(a) * r * 0.7, 0.09 * Math.sin(ph * Math.PI) * fade, f.color, 1.05);
    }
    this.b.glowDisc.push(f.x, 0.05, f.z, 0, r * 2.2, 1, r * 2.2, f.color, 0, 0, 0, 0.12 * fade);
  }

  private gather(f: ActFx) {
    const t = this.time;
    const p = (f.max - f.life) / f.max; // charge progress
    const pulse = (t * 2.5) % 1;
    const rr = f.r * 1.8 * (1 - pulse) + 0.3;
    this.b.glowRingThin.push(f.x, 0.08, f.z, 0, rr, 1, rr, f.color, 0, 0, 0, 0.5 * pulse);
    for (let i = 0; i < 8; i++) {
      const ph = (t * 1.8 + i / 8) % 1;
      const a = i * 1.7 + t * 2;
      const d = (1 - ph) * f.r * 1.6;
      this.square(f.x + Math.cos(a) * d, 0.5 + ph * 0.8, f.z + Math.sin(a) * d, 0.13 * (0.4 + ph * 0.6), i & 1 ? f.color : mix(f.color, WHITE, 0.5), 0.7 + ph * 0.5);
    }
    this.b.glowDisc.push(f.x, 0.06, f.z, 0, 1.2 + p * 1.6, 1, 1.2 + p * 1.6, f.color, 0, 0, 0, 0.18 + p * 0.25);
  }

  private breakFx(f: ActFx, first: boolean) {
    // stagger break: a small golden star pops over the enemy's head
    const k = f.life / f.max;
    const t = 1 - k;
    const r = 0.4 + Math.sqrt(t) * 1.1;
    this.b.glowRingThin.push(f.x, 1.6, f.z, 0, r * 0.8, 1, r * 0.8, GOLD_HI, 0, 0, 0, k * 0.35);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + f.seed;
      const d = 0.25 + Math.sqrt(t) * 0.9;
      this.square(f.x + Math.cos(a) * d, 1.6 + Math.sin(a) * d * 0.4, f.z + Math.sin(a) * d * 0.6, 0.15 * k, i & 1 ? GOLD_HI : GOLD, 1);
    }
    this.glint(f.x, 1.6, f.z, 0.6 * k, GOLD_HI, k * 0.5, 0.785);
    if (first) {
      this.spray('pixel', f.x, 1.5, f.z, 6, GOLD_HI, GOLD, 4, 0.11, 0.35, Math.PI, 2);
      this.run.fx.light(f.x, f.z, 0xffe080, 1.6, 4, 0.25);
    }
  }
}

function isFireColor(c: number): boolean {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return r >= 0xe8 && g >= 0x50 && g <= 0xb8 && b <= 0x60;
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
