import { groundAt } from './ground';
import * as THREE from 'three';
import type { World } from '../rpg/World';

interface Num {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  vx: number;
  big: boolean;
}

const v = new THREE.Vector3();

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

/**
 * 2D canvas layered over the WebGL view: floating damage numbers, short text popups,
 * and health bars of combat targets.
 */
export class Overlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nums: Num[] = [];
  private w = 1;
  private h = 1;
  private dpr = 1;
  showNumbers = true;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'overlay-canvas';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = Math.min(dpr, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  number(x: number, z: number, value: number, crit: boolean, color?: number) {
    if (!this.showNumbers && color === undefined) return;
    // thin out ordinary hit numbers in big fights so the screen stays readable
    if (!crit && color === undefined && this.nums.length > 30 && Math.random() < (this.nums.length - 30) / 40) return;
    if (this.nums.length > 90) {
      // drop the oldest small number
      const i = this.nums.findIndex((n) => !n.big);
      if (i >= 0) this.nums.splice(i, 1);
      else return;
    }
    const v = Math.round(value);
    if (v <= 0) return;
    this.nums.push({
      x: x + (Math.random() - 0.5) * 0.5,
      y: 1.6 + groundAt(x, z),
      z,
      text: String(v),
      color: color !== undefined ? hex(color) : crit ? '#ffd23d' : '#f0ecf8',
      size: crit ? 14 : color !== undefined ? 12 : 9,
      life: crit ? 0.8 : 0.6,
      max: crit ? 0.8 : 0.6,
      vx: (Math.random() - 0.5) * 0.6,
      big: crit || color !== undefined,
    });
  }

  text(x: number, z: number, text: string, color: number) {
    this.nums.push({ x, y: 2.4 + groundAt(x, z), z, text, color: hex(color), size: 12, life: 1.2, max: 1.2, vx: 0, big: true });
  }

  clear() {
    this.nums.length = 0;
  }

  draw(dt: number, camera: THREE.Camera, run: World | null) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!run) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // dummy plates: name, and the running damage total and DPS while it is being hit
    const px = run.player.x;
    const pz = run.player.z;
    for (const d of run.dummies) {
      if ((d.x - px) ** 2 + (d.z - pz) ** 2 > 28 * 28) continue;
      if (!this.project(camera, d.x, groundAt(d.x, d.z) + d.height + 0.35, d.z)) continue;
      const sel = run.target === d;
      ctx.font = '600 11px "Russo One", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(d.name, v.x, v.y - 10);
      ctx.fillStyle = sel ? '#ffd040' : '#ffffff';
      ctx.fillText(d.name, v.x, v.y - 10);
      if (d.total > 0) {
        const line = `Σ ${d.total}  ·  ${Math.round(d.dps(run.time))} DPS`;
        ctx.font = '600 10px "Russo One", sans-serif';
        ctx.strokeText(line, v.x, v.y + 4);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText(line, v.x, v.y + 4);
      }
    }

    // damage numbers
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.life -= dt;
      if (n.life <= 0) {
        this.nums.splice(i, 1);
        continue;
      }
      const k = n.life / n.max;
      n.y += dt * (0.8 + k * 1.6);
      n.x += n.vx * dt;
      if (!this.project(camera, n.x, n.y, n.z)) continue;
      const pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
      const size = Math.round(n.size * pop);
      ctx.globalAlpha = Math.min(1, k * 3);
      // blocky pixel digits (Press Start 2P has Cyrillic too) with a hard drop shadow and a square outline
      const fs = Math.max(8, Math.round(size * 1.1));
      ctx.font = `${fs}px "Press Start 2P", "Russo One", monospace`;
      ctx.lineJoin = 'miter';
      const off = Math.max(2, Math.round(fs / 8));
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillText(n.text, v.x + off, v.y + off);
      ctx.lineWidth = Math.max(3, Math.round(fs / 5));
      ctx.strokeStyle = 'rgba(8,8,12,0.95)';
      ctx.strokeText(n.text, v.x, v.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, v.x, v.y);
      ctx.lineJoin = 'round';
    }
    ctx.globalAlpha = 1;
  }

  private project(camera: THREE.Camera, x: number, y: number, z: number): boolean {
    v.set(x, y, z).project(camera);
    if (v.z > 1) return false;
    v.x = (v.x * 0.5 + 0.5) * this.w;
    v.y = (-v.y * 0.5 + 0.5) * this.h;
    return v.x > -40 && v.x < this.w + 40 && v.y > -40 && v.y < this.h + 40;
  }
}
