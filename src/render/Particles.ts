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
  size: number;
  life: number;
  max: number;
  rot: number;
  spin: number;
  kind: number; // 0 glow, 1 debris, 2 smoke, 3 ambient glow, 4 snow, 5 rain, 6 spark, 7 ember, 8 shard, 9 bubble, 10 wisp, 11 gather
}

const EMIT_KIND: Record<EmitKind, number> = { glow: 0, debris: 1, smoke: 2, spark: 6, ember: 7, shard: 8, bubble: 9, wisp: 10, gather: 11 };

export type AmbientKind = 'spores' | 'fireflies' | 'dust' | 'embers' | 'snow' | 'motes' | 'rain';

/**
 * CPU particle pool rendered as instanced voxel cubes: additive glow sparks, lit debris
 * chunks with gravity and bounce, soft smoke puffs and per-map ambient particles.
 */
export class Particles {
  private list: P[] = [];
  private n = 0;
  private glow: InstancedBatch;
  private debris: InstancedBatch;
  private smoke: InstancedBatch;
  private max: number;
  private ambientAcc = 0;
  /** Ambient map particles (the weapon viewer can switch them off). */
  ambientOn = true;

  constructor(scene: THREE.Scene, blockTex: THREE.Texture, blobTex: THREE.Texture, quality: string, private ambient: AmbientKind, private ambientColor: number) {
    this.max = quality === 'low' ? 900 : quality === 'medium' ? 1800 : 3000;
    for (let i = 0; i < this.max; i++) this.list.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, size: 1, life: 0, max: 1, rot: 0, spin: 0, kind: 0 });
    this.glow = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), makeGlowMaterial(), scene, 512);
    this.glow.mesh.renderOrder = 7;
    const cube = buildVoxelGeometry({ boxes: [[0, -5, 0, 10, 10, 10, 0xffffff]], scale: 0.1 }, {});
    this.debris = new InstancedBatch(cube, makeVoxelMaterial({ map: blockTex, instanced: true }), scene, 256, true);
    const smokeGeo = new THREE.PlaneGeometry(1, 1);
    const smokeMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.45 });
    this.smoke = new InstancedBatch(smokeGeo, smokeMat, scene, 128);
    this.smoke.mesh.renderOrder = 4;
  }

  burst(x: number, y: number, z: number, color: number, count: number, speed: number, size: number, life: number, kind: ParticleKind = 'glow') {
    const k = kind === 'glow' ? 0 : kind === 'debris' ? 1 : 2;
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    for (let i = 0; i < count; i++) {
      if (this.n >= this.max) return;
      const p = this.list[this.n++];
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = k === 1 ? 2 + Math.random() * speed : k === 2 ? 0.6 + Math.random() : (Math.random() - 0.2) * speed * 0.8;
      p.r = r;
      p.g = g;
      p.b = b;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.rot = Math.random() * 6;
      p.spin = (Math.random() - 0.5) * 12;
      p.kind = k;
    }
  }

  /**
   * Skill VFX spray: `count` particles of one style sprayed in a cone of half-angle `spread` around
   * (dirX, dirZ) (all around when the direction is zero). Each particle picks a colour between
   * `color` and `color2`. 'gather' particles start `speed` units away and converge on the point.
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
    for (let i = 0; i < count; i++) {
      if (this.n >= this.max) return;
      const p = this.list[this.n++];
      const a = directed ? base + (Math.random() * 2 - 1) * L.spread : Math.random() * Math.PI * 2;
      const t = Math.random();
      p.r = r1 + (r2 - r1) * t;
      p.g = g1 + (g2 - g1) * t;
      p.b = b1 + (b2 - b1) * t;
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
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = (L.up ?? 0) * (0.5 + Math.random() * 0.7) + (k === 1 ? 2 + Math.random() * L.speed : k === 2 ? 0.4 + Math.random() * 0.6 : (Math.random() - 0.4) * sp * 0.4);
      // wisps curl: spin is their turn rate
      p.spin = k === 10 ? (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4) : (Math.random() - 0.5) * 12;
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

  update(dt: number, cx: number, cz: number, blizzard: number, camYaw = 0) {
    if (this.ambientOn) this.spawnAmbient(cx, cz, dt, blizzard);
    this.glow.begin();
    this.debris.begin();
    this.smoke.begin();
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
          p.vx *= 1 - dt * 3;
          p.vz *= 1 - dt * 3;
          p.vy -= dt * 2;
          const s = p.size * (0.3 + k * 0.7);
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * k * 1.4, p.g * k * 1.4, p.b * k * 1.4);
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
          p.vx *= 1 - dt * 2;
          p.vz *= 1 - dt * 2;
          const s = p.size * (2 - k);
          this.smoke.push(p.x, p.y, p.z, camYaw, s, s, s, 0x000000, 0, 0, -0.9, 1);
          const c = this.smoke.mesh.instanceColor!.array as Float32Array;
          const j = (this.smoke.count - 1) * 3;
          c[j] = p.r * 0.6;
          c[j + 1] = p.g * 0.6;
          c[j + 2] = p.b * 0.6;
          break;
        }
        case 3: {
          const tw = Math.sin(k * Math.PI);
          const s = p.size * (0.6 + tw * 0.4);
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * tw, p.g * tw, p.b * tw);
          break;
        }
        case 4: {
          if (p.y < 0.05) {
            p.life = Math.min(p.life, 0.3);
            p.vx = p.vy = p.vz = 0;
            p.y = 0.05;
          }
          this.glow.pushFast(p.x, p.y, p.z, p.rot, p.size, p.size, 0.7 * Math.min(1, k * 4), 0.75 * Math.min(1, k * 4), 0.8 * Math.min(1, k * 4));
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
          // spark streak stretched along its velocity
          p.vx *= 1 - dt * 5;
          p.vz *= 1 - dt * 5;
          p.vy -= dt * 7;
          const v = Math.hypot(p.vx, p.vz);
          const len = p.size * 1.5 + v * 0.035;
          const b = 1.6 * k;
          this.glow.pushAxis(p.x, p.y, p.z, Math.atan2(-p.vz, p.vx), len, p.size * 0.6, p.size * 0.6, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 7: {
          // ember: drifts up with a sway and flickers out
          p.vx *= 1 - dt * 2.5;
          p.vz *= 1 - dt * 2.5;
          p.vy = Math.max(p.vy - dt * 0.6, 0.3);
          p.x += Math.sin(p.rot * 1.7 + p.life * 9) * dt * 0.4;
          const fl = (0.7 + 0.3 * Math.sin(p.life * 40 + p.rot * 5)) * Math.min(1, k * 1.6) * 1.4;
          const s = p.size * (0.4 + k * 0.6);
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * fl, p.g * fl, p.b * fl);
          break;
        }
        case 8: {
          // ice shard: tall crystal that falls, bounces once and melts
          p.vy -= dt * 16;
          if (p.y < p.size * 0.8) {
            p.y = p.size * 0.8;
            p.vy *= -0.3;
            p.vx *= 0.5;
            p.vz *= 0.5;
            p.spin *= 0.5;
          }
          const b = 1.2 * Math.min(1, k * 2.5);
          this.glow.pushAxis(p.x, p.y, p.z, p.rot, p.size * 0.55, p.size * 1.7, p.size * 0.55, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 9: {
          // bubble: rises slowly, swells, then pops
          p.vx *= 1 - dt * 4;
          p.vz *= 1 - dt * 4;
          p.vy = Math.max(0.25, p.vy - dt * 0.5);
          const s = p.size * (k < 0.12 ? 1.8 - k * 4 : 0.6 + (1 - k) * 0.9);
          const b = k < 0.12 ? k * 8 : 0.95;
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 10: {
          // wisp: curls around while drifting
          const ca = Math.cos(p.spin * dt);
          const sa = Math.sin(p.spin * dt);
          const vx = p.vx * ca - p.vz * sa;
          p.vz = p.vx * sa + p.vz * ca;
          p.vx = vx;
          p.vx *= 1 - dt * 1.2;
          p.vz *= 1 - dt * 1.2;
          p.vy *= 1 - dt;
          const s = p.size * (0.3 + k * 0.9);
          const b = 1.3 * Math.sin(k * Math.PI);
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * b, p.g * b, p.b * b);
          break;
        }
        case 11: {
          // gather: brightens as it converges
          const g = 0.4 + (1 - k) * 1.3;
          const s = p.size * (0.5 + (1 - k) * 0.7);
          this.glow.pushFast(p.x, p.y, p.z, p.rot, s, s, p.r * g, p.g * g, p.b * g);
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
    this.debris.end();
    this.smoke.end();
  }

  clear() {
    this.n = 0;
  }

  dispose() {
    this.glow.dispose();
    this.debris.dispose();
    this.smoke.dispose();
  }
}
