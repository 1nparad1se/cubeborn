import type { Run } from '../game/Run';
import { CELL } from '../game/Terrain';
import { h } from './dom';

const SHRINE_COLOR: Record<string, string> = { heal: '#6aff9a', fury: '#ff5a5a', magnet: '#8ad8ff', gold: '#ffd23d' };
const RARITY_COLOR = ['#e8e4f0', '#6aff8a', '#5ab4ff', '#c77dff', '#ffb02e'];

function shade(c: number, k: number): [number, number, number] {
  return [Math.min(255, ((c >> 16) & 255) * k), Math.min(255, ((c >> 8) & 255) * k), Math.min(255, (c & 255) * k)];
}

/**
 * Whole-map minimap in the HUD corner: terrain baked once per run, then the hero, bosses,
 * elites, chests, shrines and points of interest redrawn ~12 times a second.
 * Regular enemies are intentionally not shown.
 */
export class Minimap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private run: Run | null = null;
  private acc = 1;
  private size = 0;
  private pulse = 0;
  big = false;

  constructor() {
    this.canvas = h('canvas.minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.root = h('div.minimap', this.canvas);
  }

  /** Bakes the terrain into an image for this run. */
  setRun(run: Run | null) {
    this.run = run;
    this.base = null;
    if (!run) return;
    const t = run.terrain;
    const n = t.size;
    const img = document.createElement('canvas');
    img.width = n;
    img.height = n;
    const c = img.getContext('2d')!;
    const data = c.createImageData(n, n);
    const pal = run.map.palette;
    const tileCol = t.tileNames.map((name) => (pal.tiles[name] ?? [0x555555])[0]);
    const blockCol = shade(Object.values(pal.blocks)[0]?.[0] ?? 0x444444, 0.55);
    for (let i = 0; i < n * n; i++) {
      const cell = t.cell[i];
      let rgb: [number, number, number];
      if (cell === CELL.wall) rgb = [12, 10, 16];
      else if (cell === CELL.solid) {
        const hgt = t.height[i];
        rgb = hgt > 0 ? shade((blockCol[0] << 16) | (blockCol[1] << 8) | blockCol[2], 0.8 + Math.min(4, hgt) * 0.08) : [24, 20, 28];
      } else if (cell === CELL.liquid) rgb = shade(tileCol[t.tile[i]] ?? 0x2255aa, 1.05);
      else if (cell === CELL.hazard) {
        const b = shade(tileCol[t.tile[i]] ?? 0x885533, 1);
        rgb = [Math.min(255, b[0] * 0.7 + 90), b[1] * 0.6, b[2] * 0.6];
      } else rgb = shade(tileCol[t.tile[i]] ?? 0x666666, 0.72);
      const o = i * 4;
      data.data[o] = rgb[0];
      data.data[o + 1] = rgb[1];
      data.data[o + 2] = rgb[2];
      data.data[o + 3] = 255;
    }
    c.putImageData(data, 0, 0);
    this.base = img;
    this.acc = 1;
  }

  setBig(on: boolean) {
    this.big = on;
    this.root.classList.toggle('big', on);
    this.acc = 1;
  }

  update(dt: number) {
    const run = this.run;
    if (!run || !this.base) return;
    this.pulse += dt;
    this.acc += dt;
    if (this.acc < 1 / 12) return;
    this.acc = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = this.root.clientWidth || 180;
    const px = Math.round(css * dpr);
    if (px !== this.size) {
      this.size = px;
      this.canvas.width = this.canvas.height = px;
    }
    const ctx = this.ctx;
    const n = run.terrain.size;
    const k = px / n;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, px, px);
    const dot = (x: number, z: number, r: number, color: string, stroke = 'rgba(0,0,0,0.85)') => {
      ctx.beginPath();
      ctx.arc(x * k, z * k, r * dpr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = dpr;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };
    // points of interest
    for (const p of run.features.pois) {
      const x = p.x * k;
      const z = p.z * k;
      if (p.kind === 'poi') {
        ctx.fillStyle = p.sub === 'village' ? 'rgba(255,214,150,0.9)' : p.sub === 'camp' ? 'rgba(255,150,80,0.85)' : p.sub === 'tower' ? 'rgba(220,220,240,0.85)' : p.sub === 'ruin' ? 'rgba(190,180,170,0.8)' : 'rgba(140,220,120,0.55)';
        const s = (p.sub === 'village' ? 2.6 : 1.8) * dpr;
        ctx.fillRect(x - s, z - s, s * 2, s * 2);
      } else if (p.kind === 'shrine') {
        const s = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, z - s);
        ctx.lineTo(x + s, z);
        ctx.lineTo(x, z + s);
        ctx.lineTo(x - s, z);
        ctx.closePath();
        ctx.fillStyle = p.used ? '#55505e' : SHRINE_COLOR[p.sub ?? 'heal'] ?? '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = dpr;
        ctx.stroke();
      } else if (p.kind === 'secret' && p.found) {
        ctx.font = `${Math.round(9 * dpr)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd23d';
        ctx.fillText('?', x, z);
      }
    }
    // chests lying on the ground
    for (const pk of run.pickups.list) {
      if (!pk.active || pk.kind !== 'chest') continue;
      const s = 2.6 * dpr;
      ctx.fillStyle = RARITY_COLOR[pk.rarity] ?? '#ffd23d';
      ctx.fillRect(pk.x * k - s, pk.z * k - s, s * 2, s * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = dpr;
      ctx.strokeRect(pk.x * k - s, pk.z * k - s, s * 2, s * 2);
    }
    // elites and the treasure sprite (regular enemies are hidden)
    for (const e of run.enemies.list) {
      if (!e.alive || e.boss) continue;
      if (e.elite) dot(e.x, e.z, 1.8, '#ffa030');
      else if (e.def.id === 'treasure_sprite') dot(e.x, e.z, 2.2, '#fff06a');
    }
    // bosses pulse
    for (const b of run.bosses) {
      if (!b.e.active || b.isClone) continue;
      const r = 3.6 + Math.sin(this.pulse * 6) * 0.8;
      dot(b.e.x, b.e.z, r, '#ff2a4a', '#fff');
    }
    // camera view and hero arrow
    const p = run.player;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = dpr;
    const vw = 22 * k;
    const vh = 14 * k;
    ctx.strokeRect(p.x * k - vw, p.z * k - vh, vw * 2, vh * 2);
    const a = Math.atan2(p.fz, p.fx);
    const s = 4.5 * dpr;
    ctx.save();
    ctx.translate(p.x * k, p.z * k);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.7, -s * 0.65);
    ctx.lineTo(-s * 0.35, 0);
    ctx.lineTo(-s * 0.7, s * 0.65);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();
  }
}
