import * as THREE from 'three';
import type { ParticleKind } from '../game/types';
import type { EmitKind, EmitLayer } from '../config/vfx';
import { InstancedBatch } from './InstancedBatch';
import { makeGlowMaterial, makeVoxelMaterial } from './Materials';
import { buildVoxelGeometry } from './VoxelGeometry';

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  /** Second colour (flames blend toward it over their life). */
  r2: number;
  g2: number;
  b2: number;
  size: number;
  life: number;
  max: number;
  rot: number;
  spin: number;
  /**
   * 0 glow square, 1 debris chunk, 2 dust puff, 3 ambient mote, 4 snow, 5 rain, 6 spark streak,
   * 7 ember, 8 ice shard, 9 bubble, 10 soul wisp, 11 gather, 12 pixel, 13 flame
   */
  kind: number;
}

const EMIT_KIND: Record<EmitKind, number> = { glow: 0, debris: 1, smoke: 2, spark: 6, ember: 7, shard: 8, bubble: 9, wisp: 10, gather: 11, pixel: 12, flame: 13, puff: 2 };

export type AmbientKind = 'spores' | 'fireflies' | 'dust' | 'embers' | 'snow' | 'motes' | 'rain';

/**
 * Camera-facing square material (Minecraft Dungeons style pixel particles). Instances are pushed
 * with InstancedBatch.pushFast: the yaw argument becomes the in-screen roll, `s` the width and `sy`
 * the height of the square, so no camera information is needed on the CPU.
 */
export function makeSquareMaterial(additive: boolean, opacity = 1): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: additive || opacity < 1,
    opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive && opacity >= 1,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
vec3 bbC0 = instanceMatrix[0].xyz;
float bbS = length(bbC0);
float bbA = atan(-bbC0.z, bbC0.x);
float bbCa = cos(bbA);
float bbSa = sin(bbA);
vec2 bbP = position.xy * vec2(bbS, instanceMatrix[1].y);
mvPosition.xy += vec2(bbP.x * bbCa - bbP.y * bbSa, bbP.x * bbSa + bbP.y * bbCa);
gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => `bbsq-${additive ? 'a' : 'o'}-${opacity < 1 ? 't' : ''}`;
  return mat;
}

/**
 * CPU particle pool in the Minecraft Dungeons look: bold flat-coloured camera-facing squares
 * (pixels, flames, embers, bubbles, soul wisps), additive glow squares and streak sparks, lit
 * block debris that bounces, and chunky square dust puffs that swell and shrink away.
 */
export class Particles {
  private list: P[] = [];
  private n = 0;
  /** Additive streaks and crystals (3D boxes). */
  private glow: InstancedBatch;
  /** Additive camera-facing squares. */
  private glowSq: InstancedBatch;
  /** Opaque unlit camera-facing squares (bold pixel particles). */
  private solid: InstancedBatch;
  /** Soft (slightly transparent) square dust puffs. */
  private puff: InstancedBatch;
  private debris: InstancedBatch;
  private max: number;
  private ambientAcc = 0;
  /** Ambient map particles (the weapon viewer can switch them off). */
  ambientOn = true;

  constructor(scene: THREE.Scene, blockTex: THREE.Texture, _blobTex: THREE.Texture, quality: string, private ambient: AmbientKind, private ambientColor: number) {
    this.max = quality === 'low' ? 900 : quality === 'medium' ? 1800 : 3000;
    for (let i = 0; i < this.max; i++) this.list.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, size: 1, life: 0, max: 1, rot: 0, spin: 0, kind: 0 });
    this.glow = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), makeGlowMaterial(), scene, 256);
    this.glow.mesh.renderOrder = 7;
    const sq = new THREE.PlaneGeometry(1, 1);
    this.glowSq = new InstancedBatch(sq, makeSquareMaterial(true), scene, 512);
    this.glowSq.mesh.renderOrder = 7;
    this.solid = new InstancedBatch(sq, makeSquareMaterial(false), scene, 512);
    this.solid.mesh.renderOrder = 3;
    this.puff = new InstancedBatch(sq, makeSquareMaterial(false, 0.7), scene, 128);
    this.puff.mesh.renderOrder = 4;
    const cube = buildVoxelGeometry({ boxes: [[0, -5, 0, 10, 10, 10, 0xffffff]], scale: 0.1 }, { round: 0 });
    this.debris = new InstancedBatch(cube, makeVoxelMaterial({ map: blockTex, instanced: true }), scene, 256, true);
  }

  private take(): P | null {
    return this.n < this.max ? this.list[this.n++] : null;
  }

  burst(x: number, y: number, z: number, color: number, count: number, speed: number, size: number, life: number, kind: ParticleKind = 'glow') {
    const k = kind === 'glow' ? 0 : kind === 'debris' ? 1 : 2;
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    for (let i = 0; i < count; i++) {
      const p = this.take();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = k === 1 ? 2 + Math.random() * speed : k === 2 ? 0.6 + Math.random() : (Math.random() - 0.2) * speed * 0.8;
      p.r = p.r2 = r;
      p.g = p.g2 = g;
      p.b = p.b2 = b;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.rot = Math.random() * 6;
      p.spin = (Math.random() - 0.5) * 12;
      // generic glow bursts: two thirds bold opaque pixels, one third additive glints (keeps big bursts from
      // washing the screen out under bloom)
      p.kind = k === 0 ? (i % 3 === 0 ? 0 : 12) : k;
      if (k === 2) {
        p.size *= 0.8;
        p.spin = (Math.random() - 0.5) * 3;
      }
    }
    // chunk bursts (deaths, rubble) end in a little poof of square dust, like MCD mobs
    if (k === 1 && count >= 6) {
      const puffs = Math.min(8, Math.round(count / 3));
      for (let i = 0; i < puffs; i++) {
        const p = this.take();
        if (!p) return;
        const a = Math.random() * Math.PI * 2;
        const sp = 0.8 + Math.random() * 1.6;
        p.x = x + Math.cos(a) * 0.2;
        p.y = y + Math.random() * 0.4;
        p.z = z + Math.sin(a) * 0.2;
        p.vx = Math.cos(a) * sp;
        p.vz = Math.sin(a) * sp;
        p.vy = 0.5 + Math.random() * 0.8;
        p.r = p.r2 = 0.74 + Math.random() * 0.08;
        p.g = p.g2 = 0.72 + Math.random() * 0.08;
        p.b = p.b2 = 0.7 + Math.random() * 0.08;
        p.size = Math.min(0.42, Math.max(0.24, size * 1.8)) * (0.7 + Math.random() * 0.5);
        p.life = p.max = 0.45 + Math.random() * 0.3;
        p.rot = Math.random() * 6;
        p.spin = (Math.random() - 0.5) * 3;
        p.kind = 2;
      }
    }
  }

  /**
   * Skill VFX spray: `count` particles of one style sprayed in a cone of half-angle `spread` around
   * (dirX, dirZ) (all around when the direction is zero). Each particle picks a colour between
   * `color` and `color2` (flames instead blend from one to the other over their life).
   * 'gather' particles start `speed` units away and converge on the point.
   */
  emit(x: number, y: number, z: number, L: EmitLayer, dirX: number, dirZ: number, mul: number) {
    const count = Math.round(L.count * mul + Math.random() * 0.5);
    if (count <= 0) return;
    const k = EMIT_KIND[L.kind];
    const c2 = L.color2 ?? L.color;
    const r1 = ((L.color >> 16) & 255) / 255;
    const g1 = ((L.color >> 8) & 255) / 255;
    const b1 = (L.color & 255) / 255;
    const r2 = ((c2 >> 16) & 255) / 255;
    const g2 = ((c2 >> 8) & 255) / 255;
    const b2 = (c2 & 255) / 255;
    const directed = dirX !== 0 || dirZ !== 0;
    const base = directed ? Math.atan2(dirZ, dirX) : 0;
    const jit = L.jitter ?? 0;
    for (let i = 0; i < count; i++) {
      const p = this.take();
      if (!p) return;
      const a = directed ? base + (Math.random() * 2 - 1) * L.spread : Math.random() * Math.PI * 2;
      if (k === 13) {
        p.r = r1;
        p.g = g1;
        p.b = b1;
        p.r2 = r2;
        p.g2 = g2;
        p.b2 = b2;
      } else {
        const t = Math.random();
        p.r = p.r2 = r1 + (r2 - r1) * t;
        p.g = p.g2 = g1 + (g2 - g1) * t;
        p.b = p.b2 = b1 + (b2 - b1) * t;
      }
      p.size = L.size * (0.65 + Math.random() * 0.7);
      p.life = p.max = L.life * (0.7 + Math.random() * 0.6);
      p.rot = Math.random() * 6;
      p.kind = k;
      if (k === 11) {
        // converge from a ring around the point
        const d = L.speed * (0.7 + Math.random() * 0.6);
        const oy = (Math.random() - 0.3) * d * 0.8;
        p.x = x + Math.cos(a) * d;
        p.z = z + Math.sin(a) * d;
        p.y = y + oy;
        p.vx = -Math.cos(a) * d / p.life;
        p.vz = -Math.sin(a) * d / p.life;
        p.vy = -oy / p.life;
        p.spin = 0;
        continue;
      }
      const sp = L.speed * (0.4 + Math.random() * 0.6);
      const ja = Math.random() * Math.PI * 2;
      const jd = jit * Math.sqrt(Math.random());
      p.x = x + Math.cos(ja) * jd;
      p.y = y + (jit > 0 ? Math.random() * jit * 0.3 : 0);
      p.z = z + Math.sin(ja) * jd;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = (L.up ?? 0) * (0.5 + Math.random() * 0.7) + (k === 1 ? 2 + Math.random() * L.speed : k === 2 ? 0.4 + Math.random() * 0.6 : k === 13 ? 0.6 : (Math.random() - 0.4) * sp * 0.4);
      // wisps curl: spin is their turn rate; squares roll slowly
      p.spin = k === 10 ? (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4) : k === 2 || k === 13 ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 12;
    }
  }

  private spawnAmbient(cx: number, cz: number, dt: number, blizzard: number) {
    const rate = (this.ambient === 'snow' ? 40 : this.ambient === 'rain' ? 110 : 14) + blizzard * 160;
    this.ambientAcc += dt * rate;
    const c = this.ambientColor;
    while (this.ambientAcc >= 1) {
      this.ambientAcc--;
      if (this.n >= this.max - 50) return;
      const p = this.list[this.n++];
      p.x = cx + (Math.random() - 0.5) * 40;
      p.z = cz + (Math.random() - 0.5) * 34 - 2;
      p.spin = (Math.random() - 0.5) * 2;
      p.rot = Math.random() * 6;
      if (this.ambient === 'rain' && Math.random() < 0.94) {
        p.y = 9 + Math.random() * 5;
        p.vx = -1.2;
        p.vz = -1.2;
        p.vy = -24 - Math.random() * 4;
        p.size = 0.025;
        p.life = p.max = 1.2;
        p.kind = 5;
        continue;
      }
      const snow = this.ambient === 'snow' || (blizzard > 0 && Math.random() < 0.85);
      if (snow) {
        p.y = 8 + Math.random() * 6;
        p.vx = 1 + blizzard * 6 + Math.random();
        p.vz = 0.5 + Math.random();
        p.vy = -2 - Math.random() * 2;
        p.r = p.g = p.b = 0.85;
        p.size = 0.06 + Math.random() * 0.06;
        p.life = p.max = 5;
        p.kind = 4;
        continue;
      }
      p.kind = 3;
      p.r = ((c >> 16) & 255) / 255;
      p.g = ((c >> 8) & 255) / 255;
      p.b = (c & 255) / 255;
      p.size = 0.05 + Math.random() * 0.07;
      p.life = p.max = 3 + Math.random() * 4;
      switch (this.ambient) {
        case 'embers':
          p.y = 0.2;
          p.vx = (Math.random() - 0.5) * 0.6;
          p.vz = (Math.random() - 0.5) * 0.6;
          p.vy = 0.8 + Math.random() * 1.4;
          break;
        case 'dust':
          p.y = 0.3 + Math.random() * 2;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vz = (Math.random() - 0.5) * 0.3;
          p.vy = (Math.random() - 0.5) * 0.1;
          break;
        default:
          p.y = 0.3 + Math.random() * 2.5;
          p.vx = (Math.random() - 0.5) * 0.8;
          p.vz = (Math.random() - 0.5) * 0.8;
          p.vy = (Math.random() - 0.3) * 0.4;
      }
    }
  }

  update(dt: number, cx: number, cz: number, blizzard: number, _camYaw = 0) {
    if (this.ambientOn) this.spawnAmbient(cx, cz, dt, blizzard);
    this.glow.begin();
    this.glowSq.begin();
    this.solid.begin();
    this.puff.begin();
    this.debris.begin();
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const k = p.life / p.max;
      switch (p.kind) {
        case 0: {
          // additive glint square: snaps out, shrinks away
          p.vx *= 1 - dt * 3;
          p.vz *= 1 - dt * 3;
          p.vy -= dt * 2;
          const s = p.size * (0.25 + k * 0.75);
          const b = 0.8 * Math.min(1, k * 2);
          this.glowSq.pushFast(p.x, p.y, p.z, p.rot * 0.2, s, s, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 1: {
          p.vy -= dt * 22;
          if (p.y < p.size * 0.5) {
            p.y = p.size * 0.5;
            p.vy *= -0.35;
            p.vx *= 0.6;
            p.vz *= 0.6;
            p.spin *= 0.6;
          }
          const s = p.size * Math.min(1, k * 3);
          this.debris.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r, p.g, p.b, 0);
          break;
        }
        case 2: {
          // chunky dust puff: pops up to full size, drifts, shrinks to nothing
          p.vx *= 1 - dt * 3;
          p.vz *= 1 - dt * 3;
          p.vy *= 1 - dt * 1.5;
          const t = 1 - k;
          const s = p.size * (t < 0.2 ? 0.5 + t * 2.5 : 1 - (t - 0.2) * 1.1);
          // a touch darker as they age, like MCD smoke
          const sh = 1 - t * 0.25;
          this.puff.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * sh, p.g * sh, p.b * sh);
          break;
        }
        case 3: {
          const tw = Math.sin(k * Math.PI);
          const s = p.size * (0.6 + tw * 0.4);
          this.glowSq.pushFast(p.x, p.y, p.z, 0, s, s, p.r * tw, p.g * tw, p.b * tw);
          break;
        }
        case 4: {
          if (p.y < 0.05) {
            p.life = Math.min(p.life, 0.3);
            p.vx = p.vy = p.vz = 0;
            p.y = 0.05;
          }
          const f = Math.min(1, k * 4);
          this.glowSq.pushFast(p.x, p.y, p.z, p.rot * 0.3, p.size, p.size, 0.7 * f, 0.75 * f, 0.8 * f);
          break;
        }
        case 5: {
          // rain streak, then a tiny splash ring on the ground
          if (p.y <= 0.02) {
            if (p.vy !== 0) {
              p.vx = p.vy = p.vz = 0;
              p.y = 0.02;
              p.life = Math.min(p.life, 0.18);
              p.max = 0.18;
            }
            const sp = 0.12 + (1 - p.life / 0.18) * 0.18;
            this.glow.pushFast(p.x, p.y, p.z, 0.785, sp, 0.02, 0.22, 0.26, 0.3);
          } else this.glow.pushFast(p.x, p.y, p.z, 0.785, p.size, 0.55, 0.2, 0.24, 0.3);
          break;
        }
        case 6: {
          // hit spark: a short bright streak along its velocity with a square head
          p.vx *= 1 - dt * 6;
          p.vz *= 1 - dt * 6;
          p.vy -= dt * 7;
          const v = Math.hypot(p.vx, p.vz);
          const len = p.size * 1.2 + v * 0.025;
          const b = 1.4 * Math.min(1, k * 1.8);
          this.glow.pushAxis(p.x, p.y, p.z, Math.atan2(-p.vz, p.vx), len, p.size * 0.7, p.size * 0.7, p.r * b, p.g * b, p.b * b);
          const s = p.size * 1.3 * k;
          this.solid.pushFast(p.x, p.y, p.z, 0.785, s, s, p.r, p.g, p.b);
          break;
        }
        case 7: {
          // ember: a small hot square that drifts up with a sway and blinks out
          p.vx *= 1 - dt * 2.5;
          p.vz *= 1 - dt * 2.5;
          p.vy = Math.max(p.vy - dt * 0.6, 0.3);
          p.x += Math.sin(p.rot * 1.7 + p.life * 9) * dt * 0.4;
          const on = Math.sin(p.life * 30 + p.rot * 5) > -0.6 ? 1 : 0.4;
          const s = p.size * (0.4 + k * 0.6) * on;
          const b = 1;
          this.solid.pushFast(p.x, p.y, p.z, 0, s, s, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 8: {
          // ice shard: a block of crystal that falls, bounces once and shrinks
          p.vy -= dt * 16;
          if (p.y < p.size * 0.8) {
            p.y = p.size * 0.8;
            p.vy *= -0.3;
            p.vx *= 0.5;
            p.vz *= 0.5;
            p.spin *= 0.5;
          }
          const s = p.size * Math.min(1, k * 2.5);
          this.debris.pushFast(p.x, p.y, p.z, p.rot, s * 0.8, s * 1.6, p.r, p.g, p.b, 0.45);
          break;
        }
        case 9: {
          // bubble: rises slowly, swells, then pops into a ring of tiny squares
          p.vx *= 1 - dt * 4;
          p.vz *= 1 - dt * 4;
          p.vy = Math.max(0.25, p.vy - dt * 0.5);
          if (k < 0.12) {
            const s = p.size * 0.35;
            const o = p.size * (1.8 - k * 6);
            for (let j = 0; j < 4; j++) {
              const a = j * 1.5708 + 0.785;
              this.solid.pushFast(p.x + Math.cos(a) * o * 0.7, p.y + Math.sin(a) * o * 0.7, p.z, 0, s, s, p.r * 1.1, p.g * 1.1, p.b * 1.1);
            }
          } else {
            const s = p.size * (0.6 + (1 - k) * 0.9);
            this.solid.pushFast(p.x, p.y, p.z, 0, s, s, p.r, p.g, p.b);
            // glossy highlight pixel
            this.solid.pushFast(p.x - s * 0.18, p.y + s * 0.18, p.z, 0, s * 0.3, s * 0.3, 0.95, 1, 0.9);
          }
          break;
        }
        case 10: {
          // soul wisp: a curling bright square flame
          const ca = Math.cos(p.spin * dt);
          const sa = Math.sin(p.spin * dt);
          const vx = p.vx * ca - p.vz * sa;
          p.vz = p.vx * sa + p.vz * ca;
          p.vx = vx;
          p.vx *= 1 - dt * 1.2;
          p.vz *= 1 - dt * 1.2;
          p.vy = p.vy * (1 - dt) + dt * 0.8;
          const s = p.size * (0.3 + k * 0.9);
          const b = Math.min(1, Math.sin(k * Math.PI) * 2);
          this.solid.pushFast(p.x, p.y, p.z, 0, s, s, p.r * b, p.g * b, p.b * b);
          this.glowSq.pushFast(p.x, p.y, p.z, 0, s * 1.8, s * 1.8, p.r * b * 0.3, p.g * b * 0.3, p.b * b * 0.3);
          break;
        }
        case 11: {
          // gather: brightens as it converges
          const g = 0.4 + (1 - k) * 1.1;
          const s = p.size * (0.5 + (1 - k) * 0.7);
          this.glowSq.pushFast(p.x, p.y, p.z, 0, s, s, p.r * g, p.g * g, p.b * g);
          break;
        }
        case 12: {
          // pixel: a bold flat square thrown out by an impact, slowed by drag, shrinks away
          p.vx *= 1 - dt * 4;
          p.vz *= 1 - dt * 4;
          p.vy = p.vy * (1 - dt * 3) - dt * 3;
          const s = p.size * Math.min(1, k * 1.6);
          this.solid.pushFast(p.x, p.y, p.z, 0, s, s, p.r, p.g, p.b);
          break;
        }
        case 13: {
          // flame: rises faster and faster, blending from its hot colour to its smoky one, shrinking
          p.vx *= 1 - dt * 3;
          p.vz *= 1 - dt * 3;
          p.vy += dt * 3.2;
          const t = 1 - k;
          const s = p.size * (t < 0.15 ? 0.6 + t * 2.6 : 1 - (t - 0.15) * 0.95);
          const hot = 1 - t * 0.25;
          this.solid.pushFast(p.x, p.y, p.z, 0, s, s, (p.r + (p.r2 - p.r) * t) * hot, (p.g + (p.g2 - p.g) * t) * hot, (p.b + (p.b2 - p.b) * t) * hot);
          break;
        }
      }
      if (w !== i) {
        const t = this.list[w];
        this.list[w] = p;
        this.list[i] = t;
      }
      w++;
    }
    this.n = w;
    this.glow.end();
    this.glowSq.end();
    this.solid.end();
    this.puff.end();
    this.debris.end();
  }

  clear() {
    this.n = 0;
  }

  dispose() {
    this.glow.dispose();
    this.glowSq.dispose();
    this.solid.dispose();
    this.puff.dispose();
    this.debris.dispose();
  }
}
