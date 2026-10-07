import type { Run } from '../game/Run';
import { CELL } from '../game/Terrain';
import { h } from './dom';

const SHRINE_COLOR: Record<string, string> = { heal: '#6aff9a', fury: '#ff6a6a', magnet: '#8ad8ff', gold: '#ffd23d' };
const RARITY_COLOR = ['#f2f2f2', '#6aff8a', '#5ab4ff', '#c77dff', '#ffb02e'];
/** Pixels per map cell in the baked terrain image (outlines stay one pixel thin). */
const PX = 3;
/** World units visible across the corner minimap. */
const LOCAL_SPAN = 64;

/**
 * Dungeon-crawler style minimap: muted terrain with thin white outlines along walls and
 * water, rotated to match the diagonal camera. The corner view follows the hero; the big
 * view (M) shows the whole map. Bosses, elites, chests, shrines and points of interest are
 * shown as icons; regular enemies are intentionally not shown.
 */
export class Minimap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private run: Run | null = null;
  private acc = 1;
  private pulse = 0;
  private yaw = Math.PI / 4;
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
    const W = n * PX;
    const img = document.createElement('canvas');
    img.width = W;
    img.height = W;
    const c = img.getContext('2d')!;
    const data = c.createImageData(W, W);
    const pal = run.map.palette;
    const tileCol = t.tileNames.map((name) => (pal.tiles[name] ?? [0x555555])[0]);
    // blocked mask; small obstacle clusters (trees, rocks, props) are dropped so only
    // real walls, cliffs and water get contour lines
    const blocked = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const k = t.cell[i];
      blocked[i] = k === CELL.floor || k === CELL.hazard || k === CELL.ice ? 0 : 1;
    }
    const comp = new Int32Array(n * n).fill(-1);
    const stack: number[] = [];
    const members: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (!blocked[i] || comp[i] >= 0) continue;
      members.length = 0;
      stack.push(i);
      comp[i] = i;
      let liquid = false;
      while (stack.length) {
        const j = stack.pop()!;
        members.push(j);
        if (t.cell[j] === CELL.liquid) liquid = true;
        const x = j % n;
        const z = (j / n) | 0;
        const nb = [x > 0 ? j - 1 : -1, x < n - 1 ? j + 1 : -1, z > 0 ? j - n : -1, z < n - 1 ? j + n : -1];
        for (const q of nb)
          if (q >= 0 && blocked[q] && comp[q] < 0) {
            comp[q] = i;
            stack.push(q);
          }
      }
      if (!liquid && members.length < 14) for (const j of members) blocked[j] = 0;
    }
    const walk = (x: number, z: number) => x >= 0 && z >= 0 && x < n && z < n && !blocked[z * n + x];
    const tint = (hexc: number, base: [number, number, number], f: number): [number, number, number] => [
      base[0] + (((hexc >> 16) & 255) - base[0]) * f,
      base[1] + (((hexc >> 8) & 255) - base[1]) * f,
      base[2] + ((hexc & 255) - base[2]) * f,
    ];
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const cell = t.cell[i];
        const open = !blocked[i];
        let rgba: [number, number, number, number];
        if (open) {
          const c3 = cell === CELL.hazard ? tint(0xc04030, [44, 48, 54], 0.35) : tint(tileCol[t.tile[i]] ?? 0x666666, [44, 48, 54], 0.14);
          rgba = [c3[0], c3[1], c3[2], 200];
        } else if (cell === CELL.liquid) {
          const c3 = tint(tileCol[t.tile[i]] ?? 0x2255aa, [30, 44, 66], 0.25);
          rgba = [c3[0], c3[1], c3[2], 150];
        } else rgba = [12, 14, 17, 95];
        for (let py = 0; py < PX; py++)
          for (let px = 0; px < PX; px++) {
            let c4 = rgba;
            // thin bright contour on the walkable side of every edge
            if (open && ((px === 0 && !walk(x - 1, z)) || (px === PX - 1 && !walk(x + 1, z)) || (py === 0 && !walk(x, z - 1)) || (py === PX - 1 && !walk(x, z + 1)))) c4 = [236, 240, 244, 255];
            const o = ((z * PX + py) * W + x * PX + px) * 4;
            data.data[o] = c4[0];
            data.data[o + 1] = c4[1];
            data.data[o + 2] = c4[2];
            data.data[o + 3] = c4[3];
          }
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
    if (this.acc < 1 / 15) return;
    this.acc = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round((this.root.clientWidth || 250) * dpr);
    const ch = Math.round((this.root.clientHeight || 210) * dpr);
    if (cw !== this.canvas.width || ch !== this.canvas.height) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const ctx = this.ctx;
    const n = run.terrain.size;
    const p = run.player;
    // view: centre (world) and scale (canvas px per world unit)
    const cx = this.big ? n / 2 : p.x;
    const cz = this.big ? n / 2 : p.z;
    const scale = this.big ? Math.min(cw, ch) / (n * Math.SQRT2) : cw / LOCAL_SPAN;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const toScreen = (x: number, z: number): [number, number] => {
      const dx = (x - cx) * scale;
      const dz = (z - cz) * scale;
      return [cw / 2 + dx * cos - dz * sin, ch / 2 + dx * sin + dz * cos];
    };
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(this.yaw);
    ctx.scale(scale / PX, scale / PX);
    ctx.translate(-cx * PX, -cz * PX);
    ctx.imageSmoothingEnabled = !this.big;
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();

    const u = dpr * (this.big ? 1.2 : 1);
    const inView = (sx: number, sy: number, m = 0) => sx >= -m && sy >= -m && sx <= cw + m && sy <= ch + m;
    const outline = (draw: () => void, fill: string) => {
      ctx.lineWidth = 2.5 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineJoin = 'round';
      draw();
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    // points of interest as small white glyphs
    for (const poi of run.features.pois) {
      const [sx, sy] = toScreen(poi.x, poi.z);
      if (!inView(sx, sy, 10)) continue;
      if (poi.kind === 'poi') {
        const s = 4.5 * u;
        if (poi.sub === 'village') {
          outline(() => {
            ctx.beginPath();
            ctx.moveTo(sx - s, sy + s);
            ctx.lineTo(sx - s, sy - s * 0.2);
            ctx.lineTo(sx, sy - s);
            ctx.lineTo(sx + s, sy - s * 0.2);
            ctx.lineTo(sx + s, sy + s);
            ctx.closePath();
          }, '#ffffff');
        } else if (poi.sub === 'camp') {
          outline(() => {
            ctx.beginPath();
            ctx.moveTo(sx, sy - s);
            ctx.lineTo(sx + s, sy + s * 0.8);
            ctx.lineTo(sx - s, sy + s * 0.8);
            ctx.closePath();
          }, '#ffd9a8');
        } else if (poi.sub === 'tower') {
          outline(() => {
            ctx.beginPath();
            ctx.rect(sx - s * 0.45, sy - s * 1.1, s * 0.9, s * 2.2);
          }, '#ffffff');
        } else if (poi.sub === 'ruin') {
          outline(() => {
            ctx.beginPath();
            ctx.rect(sx - s * 0.8, sy - s * 0.2, s * 1.6, s);
          }, '#d8d2c8');
        }
      } else if (poi.kind === 'shrine') {
        const s = 4 * u;
        outline(() => {
          ctx.beginPath();
          ctx.moveTo(sx, sy - s);
          ctx.lineTo(sx + s, sy);
          ctx.lineTo(sx, sy + s);
          ctx.lineTo(sx - s, sy);
          ctx.closePath();
        }, poi.used ? '#6a6670' : SHRINE_COLOR[poi.sub ?? 'heal'] ?? '#fff');
      } else if (poi.kind === 'secret' && poi.found) {
        ctx.font = `700 ${Math.round(12 * u)}px Rubik, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3 * u;
        ctx.strokeStyle = '#000';
        ctx.strokeText('?', sx, sy);
        ctx.fillStyle = '#ffd23d';
        ctx.fillText('?', sx, sy);
      }
    }
    // chests
    for (const pk of run.pickups.list) {
      if (!pk.active || pk.kind !== 'chest') continue;
      const [sx, sy] = toScreen(pk.x, pk.z);
      if (!inView(sx, sy, 6)) continue;
      const s = 3.6 * u;
      outline(() => {
        ctx.beginPath();
        ctx.rect(sx - s, sy - s * 0.7, s * 2, s * 1.4);
      }, RARITY_COLOR[pk.rarity] ?? '#ffd23d');
    }
    // elites and the treasure sprite (regular enemies are hidden)
    for (const e of run.enemies.list) {
      if (!e.alive || e.boss) continue;
      const elite = !!e.elite;
      if (!elite && e.def.id !== 'treasure_sprite') continue;
      const [sx, sy] = toScreen(e.x, e.z);
      if (!inView(sx, sy)) continue;
      outline(() => {
        ctx.beginPath();
        ctx.arc(sx, sy, (elite ? 2.6 : 3) * u, 0, Math.PI * 2);
      }, elite ? '#ffa030' : '#fff06a');
    }
    // bosses pulse; off-screen bosses stick to the minimap border
    for (const b of run.bosses) {
      if (!b.e.active || b.isClone) continue;
      let [sx, sy] = toScreen(b.e.x, b.e.z);
      const m = 9 * u;
      sx = Math.max(m, Math.min(cw - m, sx));
      sy = Math.max(m, Math.min(ch - m, sy));
      const r = (5 + Math.sin(this.pulse * 6) * 1.2) * u;
      outline(() => {
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
      }, '#ff2a4a');
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - r * 0.35, sy - r * 0.35, r * 0.25, r * 0.25);
      ctx.fillRect(sx + r * 0.1, sy - r * 0.35, r * 0.25, r * 0.25);
    }
    // the hero: white arrow in the facing direction
    const [hx, hy] = toScreen(p.x, p.z);
    const a = Math.atan2(p.fz, p.fx) + this.yaw;
    const s = 6.5 * u;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    outline(() => {
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.75, -s * 0.7);
      ctx.lineTo(-s * 0.35, 0);
      ctx.lineTo(-s * 0.75, s * 0.7);
      ctx.closePath();
    }, '#ffffff');
    ctx.restore();
  }
}
