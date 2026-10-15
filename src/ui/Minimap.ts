import type { Run } from '../game/Run';
import { CELL } from '../game/Terrain';
import { h } from './dom';

/** Pixels per map cell in the baked terrain image (outlines stay one pixel thin). */
const PX_SMALL = 3;
/** World units visible across the corner minimap. */
const LOCAL_SPAN = 64;

/**
 * Dungeon-crawler style minimap: muted terrain with thin white outlines along walls and
 * water, rotated to match the diagonal camera. The corner view follows the hero; the big
 * view (Tab) shows the whole map.
 */
export class Minimap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private run: Run | null = null;
  private acc = 1;
  private yaw = Math.PI / 4;
  /** Pixels per cell of the baked image (big worlds use fewer to keep the image small). */
  private px = PX_SMALL;
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
    const PX = n > 500 ? 2 : PX_SMALL;
    this.px = PX;
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
    const small = new Uint8Array(n * n);
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
      if (!liquid && members.length < 14) for (const j of members) {
        blocked[j] = 0;
        // trees and small props: a darker dot instead of an outlined wall
        small[j] = 1;
      }
    }
    const walk = (x: number, z: number) => x >= 0 && z >= 0 && x < n && z < n && !blocked[z * n + x];
    const cliff = (i: number, x: number, z: number) => x >= 0 && z >= 0 && x < n && z < n && t.elev[i] - t.elev[z * n + x] >= 2;
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
          const el = t.elev[i];
          // height shading: higher ground is lighter, peaks turn to rock and snow
          const base = el >= 11 ? 0xe8eef4 : el >= 8 ? 0x8a8c90 : tileCol[t.tile[i]] ?? 0x666666;
          const c3 = cell === CELL.hazard ? tint(0xc04030, [44, 48, 54], 0.35) : tint(base, [38, 54, 58], 0.12 + Math.min(10, el) * 0.05);
          rgba = small[i] ? [c3[0] * 0.55, c3[1] * 0.62, c3[2] * 0.55, 220] : [c3[0], c3[1], c3[2], 200];
        } else if (cell === CELL.liquid) {
          const c3 = tint(tileCol[t.tile[i]] ?? 0x2255aa, [30, 44, 66], 0.25);
          rgba = [c3[0], c3[1], c3[2], 150];
        } else rgba = [12, 14, 17, 95];
        for (let py = 0; py < PX; py++)
          for (let px = 0; px < PX; px++) {
            let c4 = rgba;
            // thin bright contour on the walkable side of every edge
            if (open && ((px === 0 && !walk(x - 1, z)) || (px === PX - 1 && !walk(x + 1, z)) || (py === 0 && !walk(x, z - 1)) || (py === PX - 1 && !walk(x, z + 1)))) c4 = [236, 240, 244, 255];
            // dark line at the top of every cliff (a drop of two blocks or more)
            else if (open && ((px === 0 && cliff(i, x - 1, z)) || (px === PX - 1 && cliff(i, x + 1, z)) || (py === 0 && cliff(i, x, z - 1)) || (py === PX - 1 && cliff(i, x, z + 1)))) c4 = [30, 34, 40, 230];
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
    const yaw = this.yaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const toScreen = (x: number, z: number): [number, number] => {
      const dx = (x - cx) * scale;
      const dz = (z - cz) * scale;
      return [cw / 2 + dx * cos - dz * sin, ch / 2 + dx * sin + dz * cos];
    };
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(yaw);
    ctx.scale(scale / this.px, scale / this.px);
    ctx.translate(-cx * this.px, -cz * this.px);
    ctx.imageSmoothingEnabled = !this.big;
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();

    const u = dpr * (this.big ? 1.2 : 1);
    const outline = (draw: () => void, fill: string) => {
      ctx.lineWidth = 2.5 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineJoin = 'round';
      draw();
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    // creatures: small red dots (brighter when hunting the hero)
    const span = this.big ? 1e9 : (LOCAL_SPAN * 0.75) ** 2;
    const r = (this.big ? 1.6 : 2.2) * dpr;
    for (const e of run.enemies.list) {
      if (!e.alive || (e.x - p.x) ** 2 + (e.z - p.z) ** 2 > span) continue;
      const [ex, ey] = toScreen(e.x, e.z);
      if (ex < -4 || ey < -4 || ex > cw + 4 || ey > ch + 4) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(ex - r - dpr, ey - r - dpr, (r + dpr) * 2, (r + dpr) * 2);
      ctx.fillStyle = run.mobs.mobOf(e)?.state === 'chase' ? '#ff5040' : '#c8504a';
      ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
    }
    // the hero: a gold diamond with a small white pointer in the facing direction
    const [hx, hy] = toScreen(p.x, p.z);
    const a = Math.atan2(p.fz, p.fx) + yaw;
    const s = 6.5 * u;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.save();
    ctx.rotate(a);
    outline(() => {
      ctx.beginPath();
      ctx.moveTo(s * 1.55, 0);
      ctx.lineTo(s * 0.95, -s * 0.42);
      ctx.lineTo(s * 0.95, s * 0.42);
      ctx.closePath();
    }, '#ffffff');
    ctx.restore();
    const d = s * 0.78;
    outline(() => {
      ctx.beginPath();
      ctx.moveTo(0, -d);
      ctx.lineTo(d, 0);
      ctx.lineTo(0, d);
      ctx.lineTo(-d, 0);
      ctx.closePath();
    }, '#ffd23d');
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(-d * 0.22, -d * 0.22, d * 0.44, d * 0.44);
    ctx.restore();
  }
}
