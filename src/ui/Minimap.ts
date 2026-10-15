import { groundTile } from '../world/textures/groundTiles';
import type { Run } from '../game/Run';
import { CELL } from '../game/Terrain';
import { h } from './dom';

/** Pixels per map cell in the baked terrain image (outlines stay one pixel thin). */
const PX_SMALL = 3;
/** World units across the round minimap at each zoom step (+ zooms in, − zooms out). */
const ROUND_SPANS = [36, 52, 72, 100, 140];
/** Pixels per map cell in the round minimap's image. */
const PX_ROUND = 2;

/**
 * Minimaps. The corner one is a round compass map, north up (north is world −Z, east +X, the
 * convention of the map generators): coloured terrain with height shading, roads, rivers and
 * creatures, the hero's arrow pointing where they face, and +/− zoom. The big view (Tab) shows
 * the whole map in the muted dungeon-crawler style, rotated to match the diagonal camera.
 */
export class Minimap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  /** Colour image for the round corner map. */
  private round: HTMLCanvasElement | null = null;
  private zoomI = 2;
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

  /** Zooms the round map in (+1) or out (−1). */
  zoom(dir: number) {
    this.zoomI = Math.max(0, Math.min(ROUND_SPANS.length - 1, this.zoomI - dir));
    this.acc = 1;
  }

  get canZoomIn(): boolean {
    return this.zoomI > 0;
  }

  get canZoomOut(): boolean {
    return this.zoomI < ROUND_SPANS.length - 1;
  }

  /** Bakes the terrain into an image for this run. */
  setRun(run: Run | null) {
    this.run = run;
    this.base = null;
    this.round = null;
    if (!run) return;
    this.round = this.bakeRound(run);
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
    const tileCol = t.tileNames.map((name) => (pal.tiles[name] ?? groundTile(name)?.colors ?? [0x555555])[0]);
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

  /**
   * Colour image for the round map: the ground's own tile colours lit by height (higher is
   * lighter, slopes facing north-west catch the light), dark rock for walls and cliffs, water in
   * its own colour and trees / props as darker green specks.
   */
  private bakeRound(run: Run): HTMLCanvasElement {
    const t = run.terrain;
    const n = t.size;
    const PX = PX_ROUND;
    const W = n * PX;
    const img = document.createElement('canvas');
    img.width = W;
    img.height = W;
    const c = img.getContext('2d')!;
    const data = c.createImageData(W, W);
    const pal = run.map.palette;
    const tileCol = t.tileNames.map((name) => (pal.tiles[name] ?? groundTile(name)?.colors ?? [0x555555])[0]);
    const hgt = new Float32Array(n * n);
    let lo = 1e9;
    let hi = -1e9;
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const y = t.groundY(x + 0.5, z + 0.5);
        hgt[z * n + x] = y;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    const span = Math.max(1, hi - lo);
    const H = (x: number, z: number) => hgt[Math.max(0, Math.min(n - 1, z)) * n + Math.max(0, Math.min(n - 1, x))];
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const cell = t.cell[i];
        const y = hgt[i];
        const tc = tileCol[t.tile[i]] ?? 0x5a8a3a;
        let r = (tc >> 16) & 255;
        let g = (tc >> 8) & 255;
        let b = tc & 255;
        if (cell === CELL.liquid) {
          // water: its tile colour pulled toward a clear blue
          r = r * 0.35 + 40 * 0.65;
          g = g * 0.35 + 110 * 0.65;
          b = b * 0.35 + 190 * 0.65;
        } else if (cell === CELL.hazard) {
          r = r * 0.5 + 190 * 0.5;
          g = g * 0.5 + 70 * 0.5;
          b = b * 0.5 + 40 * 0.5;
        } else if (cell !== CELL.floor && cell !== CELL.ice) {
          // walls and obstacles: trees and props keep a dark green, big rock masses turn grey
          const rock = H(x, z) - Math.min(H(x - 1, z), H(x + 1, z), H(x, z - 1), H(x, z + 1)) > 1.5;
          if (rock) {
            r = 92;
            g = 88;
            b = 80;
          } else {
            r = r * 0.45;
            g = g * 0.6;
            b = b * 0.4;
          }
        }
        // height: lighter up high; a simple hill-shade from the north-west
        const lift = 0.82 + ((y - lo) / span) * 0.4;
        const shade = Math.max(-0.35, Math.min(0.35, (H(x - 1, z - 1) - H(x + 1, z + 1)) * 0.18));
        const k = lift * (1 - shade);
        r = Math.min(255, r * k);
        g = Math.min(255, g * k);
        b = Math.min(255, b * k);
        for (let py = 0; py < PX; py++)
          for (let px = 0; px < PX; px++) {
            const o = ((z * PX + py) * W + x * PX + px) * 4;
            data.data[o] = r;
            data.data[o + 1] = g;
            data.data[o + 2] = b;
            data.data[o + 3] = 255;
          }
      }
    c.putImageData(data, 0, 0);
    return img;
  }

  /** The round corner map, north up, centred on the hero. */
  private drawRound(run: Run, cw: number, ch: number, dpr: number) {
    const ctx = this.ctx;
    const p = run.player;
    const R = Math.min(cw, ch) / 2;
    const scale = (R * 2) / ROUND_SPANS[this.zoomI];
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d2a1c';
    ctx.fillRect(0, 0, cw, ch);
    if (this.round) {
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(scale / PX_ROUND, scale / PX_ROUND);
      ctx.translate(-p.x * PX_ROUND, -p.z * PX_ROUND);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.round, 0, 0);
      ctx.restore();
    }
    const toScreen = (x: number, z: number): [number, number] => [cw / 2 + (x - p.x) * scale, ch / 2 + (z - p.z) * scale];
    // creatures: red dots (brighter when hunting the hero)
    const reach = (ROUND_SPANS[this.zoomI] * 0.75) ** 2;
    const r = 2.2 * dpr;
    for (const e of run.enemies.list) {
      if (!e.alive || (e.x - p.x) ** 2 + (e.z - p.z) ** 2 > reach) continue;
      const [ex, ey] = toScreen(e.x, e.z);
      ctx.beginPath();
      ctx.arc(ex, ey, r + dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fillStyle = run.mobs.mobOf(e)?.state === 'chase' ? '#ff4a3a' : '#d0584c';
      ctx.fill();
    }
    // soft vignette toward the rim
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, R * 0.6, cw / 2, ch / 2, R);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    // the hero: a gold arrowhead pointing where they face (x right = east, z down = south)
    const a = Math.atan2(p.fz, p.fx);
    const s = 7.5 * dpr;
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.25);
    ctx.lineTo(s * 0.85, s * 0.85);
    ctx.lineTo(0, s * 0.4);
    ctx.lineTo(-s * 0.85, s * 0.85);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4 * dpr;
    ctx.strokeStyle = 'rgba(20,12,0,0.9)';
    ctx.stroke();
    const gr = ctx.createLinearGradient(0, -s, 0, s);
    gr.addColorStop(0, '#ffe680');
    gr.addColorStop(1, '#f08a10');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.restore();
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
    if (!this.big) {
      this.drawRound(run, cw, ch, dpr);
      return;
    }
    const ctx = this.ctx;
    const n = run.terrain.size;
    const p = run.player;
    // view: centre (world) and scale (canvas px per world unit)
    const cx = n / 2;
    const cz = n / 2;
    const scale = Math.min(cw, ch) / (n * Math.SQRT2);
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
    const span = 1e9;
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
