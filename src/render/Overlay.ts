import * as THREE from 'three';
import type { Run } from '../game/Run';
import { ELITE_MODS } from '../data/enemies';

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
 * elite health bars and off-screen indicators for chests and bosses.
 */
export class Overlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nums: Num[] = [];
  private w = 1;
  private h = 1;
  private dpr = 1;
  showNumbers = true;
  healthBars: 'off' | 'elites' | 'all' = 'elites';

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
      y: 1.6,
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
    this.nums.push({ x, y: 2.4, z, text, color: hex(color), size: 12, life: 1.2, max: 1.2, vx: 0, big: true });
  }

  clear() {
    this.nums.length = 0;
  }

  draw(dt: number, camera: THREE.Camera, run: Run | null) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!run) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // health bars: elites always (unless off), ordinary enemies only once damaged
    const px = run.player.x;
    const pz = run.player.z;
    if (this.healthBars !== 'off') {
      const all = this.healthBars === 'all';
      let drawn = 0;
      for (const e of run.enemies.list) {
        if (!e.active || e.dying > 0 || e.boss || e.def.behavior === 'prop') continue;
        if (!e.elite && (!all || e.hp >= e.maxHp || drawn > 160)) continue;
        if ((e.x - px) ** 2 + (e.z - pz) ** 2 > 30 * 30) continue;
        if (!this.project(camera, e.x, 1.2 + e.scale * 1.4, e.z)) continue;
        const bw = e.elite ? 34 : 18;
        const sx = Math.round(v.x - bw / 2);
        const sy = Math.round(v.y);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(sx - 1, sy - 1, bw + 2, e.elite ? 6 : 4);
        ctx.fillStyle = e.elite ? hex(ELITE_MODS[e.elite].color) : '#ff4a5a';
        ctx.fillRect(sx, sy, Math.max(0, (bw * e.hp) / e.maxHp), e.elite ? 4 : 2);
        drawn++;
      }
    }

    // off-screen chest / boss arrows
    for (const k of run.pickups.list) if (k.active && k.kind === 'chest') this.arrow(camera, k.x, k.z, '#ffd23d');
    for (const b of run.bosses) if (b.e.active && b.e.boss === b) this.arrow(camera, b.e.x, b.e.z, '#ff4a5a');

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
      // Russo One reads cleanly at small sizes in Cyrillic and Latin; sizes were authored for the pixel font
      ctx.font = `${Math.round(size * 1.3)}px "Russo One", Rubik, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,8,16,0.9)';
      ctx.strokeText(n.text, v.x, v.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, v.x, v.y);
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

  private arrow(camera: THREE.Camera, x: number, z: number, color: string) {
    v.set(x, 0.5, z).project(camera);
    const sx = (v.x * 0.5 + 0.5) * this.w;
    const sy = (-v.y * 0.5 + 0.5) * this.h;
    const m = 28;
    if (sx > m && sx < this.w - m && sy > m && sy < this.h - m) return;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const t = Math.min(Math.abs((cx - m) / Math.cos(a) || 1e9), Math.abs((cy - m - 40) / Math.sin(a) || 1e9));
    const ax = cx + Math.cos(a) * t;
    const ay = cy + Math.sin(a) * t;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}
