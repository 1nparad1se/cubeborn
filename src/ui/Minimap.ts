import type { Run } from '../game/Run';
import { CELL } from '../game/Terrain';
import { h } from './dom';
import { WORLD } from '../config/world';
import { L } from '../i18n';
import { AREAS, RANGES } from '../config/continent';
import { FOG_CELL } from '../game/world/World';

const SHRINE_COLOR: Record<string, string> = { heal: '#6aff9a', fury: '#ff6a6a', magnet: '#8ad8ff', gold: '#ffd23d' };
const RARITY_COLOR = ['#f2f2f2', '#6aff8a', '#5ab4ff', '#c77dff', '#ffb02e'];
/** Pixels per map cell in the baked terrain image (outlines stay one pixel thin). */
const PX_SMALL = 3;
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
  /** Pixels per cell of the baked image (big worlds use fewer to keep the image small). */
  private px = PX_SMALL;
  big = false;
  /** Continent worlds: baked overview image, fog overlay and big-map view state. */
  private cont = false;
  private fogImg: HTMLCanvasElement | null = null;
  private fogAcc = 99;
  private zoom = 3;
  private vx = 0;
  private vz = 0;
  private drag: { x: number; y: number; vx: number; vz: number } | null = null;
  /** Big-map view (centre, scale) of the last frame, for wheel zoom around the cursor. */
  private view = { scale: 1, cw: 1, ch: 1 };

  constructor() {
    this.canvas = h('canvas.minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.root = h('div.minimap', this.canvas);
    const c = this.canvas;
    c.addEventListener('wheel', (e) => {
      if (!this.big || !this.cont) return;
      e.preventDefault();
      e.stopPropagation();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      const { scale, cw, ch } = this.view;
      // world point under the cursor stays put
      const mx = (e.clientX - r.left) * dpr - cw / 2;
      const my = (e.clientY - r.top) * dpr - ch / 2;
      const wx = this.vx + mx / scale;
      const wz = this.vz + my / scale;
      const nz = Math.max(1, Math.min(24, this.zoom * Math.exp(-e.deltaY * 0.0015)));
      const ns = (scale / this.zoom) * nz;
      this.zoom = nz;
      this.vx = wx - mx / ns;
      this.vz = wz - my / ns;
      this.clampView();
      this.acc = 1;
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      if (!this.big || !this.cont) return;
      e.stopPropagation();
      this.drag = { x: e.clientX, y: e.clientY, vx: this.vx, vz: this.vz };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const s = this.view.scale;
      this.vx = this.drag.vx - ((e.clientX - this.drag.x) * dpr) / s;
      this.vz = this.drag.vz - ((e.clientY - this.drag.y) * dpr) / s;
      this.clampView();
      this.acc = 1;
    });
    const end = () => (this.drag = null);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  private clampView() {
    const n = this.run?.terrain.size ?? 1;
    this.vx = Math.max(0, Math.min(n, this.vx));
    this.vz = Math.max(0, Math.min(n, this.vz));
  }

  /** Continent: one pixel per two cells, tile colours shaded by elevation, roads on top. */
  private bakeContinent(run: Run) {
    const t = run.terrain;
    const n = t.size;
    const S = 2;
    const W = Math.ceil(n / S);
    this.px = 1 / S;
    const img = document.createElement('canvas');
    img.width = W;
    img.height = W;
    const c = img.getContext('2d')!;
    const data = c.createImageData(W, W);
    const pal = run.map.palette;
    const tileCol = t.tileNames.map((name) => (pal.tiles[name] ?? [0x6a7a50])[0]);
    const d = data.data;
    for (let z = 0; z < W; z++)
      for (let x = 0; x < W; x++) {
        const cx = Math.min(n - 1, x * S + 1);
        const cz = Math.min(n - 1, z * S + 1);
        const i = cz * n + cx;
        const col = tileCol[t.tile[i]] ?? 0x6a7a50;
        let r = (col >> 16) & 255;
        let g = (col >> 8) & 255;
        let b = col & 255;
        const cell = t.cell[i];
        if (cell === CELL.liquid) {
          r = r * 0.6 + 20;
          g = g * 0.6 + 50;
          b = b * 0.6 + 90;
        } else {
          // elevation: lighter high ground, slope shading from the north-west neighbour
          const e = t.elev[i];
          const en = t.elev[Math.max(0, cz - S) * n + Math.max(0, cx - S)];
          const f = 0.78 + Math.min(0.35, e * 0.02) + Math.max(-0.25, Math.min(0.25, (e - en) * 0.06));
          r *= f;
          g *= f;
          b *= f;
          if (cell === CELL.solid || cell === CELL.wall) {
            r *= 0.8;
            g *= 0.8;
            b *= 0.8;
          }
        }
        const o = (z * W + x) * 4;
        d[o] = Math.min(255, r);
        d[o + 1] = Math.min(255, g);
        d[o + 2] = Math.min(255, b);
        d[o + 3] = 255;
      }
    c.putImageData(data, 0, 0);
    const cont = run.world!.cont!;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const rd of cont.roads) {
      if (rd.pts.length < 2) continue;
      c.strokeStyle = rd.kind === 'main' || rd.kind === 'highway' ? 'rgba(236,220,180,0.85)' : 'rgba(220,205,170,0.6)';
      c.lineWidth = rd.kind === 'main' || rd.kind === 'highway' ? 2 : 1.3;
      c.beginPath();
      rd.pts.forEach(([x, z], k) => (k ? c.lineTo(x / S, z / S) : c.moveTo(x / S, z / S)));
      c.stroke();
    }
    // settlements as pale blocks
    c.fillStyle = 'rgba(240,226,190,0.75)';
    for (const tw of cont.towns) c.fillRect(tw.x0 / S, tw.z0 / S, (tw.x1 - tw.x0) / S, (tw.z1 - tw.z0) / S);
    this.base = img;
    const w = run.world!;
    this.fogImg = document.createElement('canvas');
    this.fogImg.width = w.fogN;
    this.fogImg.height = w.fogN;
    this.fogAcc = 99;
  }

  /** Redraws the fog-of-war overlay (one pixel per fog cell); cheap, at most once a second. */
  private updateFog(run: Run) {
    const w = run.world!;
    const f = this.fogImg!;
    const c = f.getContext('2d')!;
    const N = w.fogN;
    const data = c.createImageData(N, N);
    const d = data.data;
    for (let i = 0; i < N * N; i++) {
      if (w.fog[i]) continue;
      const x = i % N;
      const z = (i / N) | 0;
      const hatch = (x + z) % 4 === 0;
      const o = i * 4;
      d[o] = hatch ? 58 : 34;
      d[o + 1] = hatch ? 50 : 30;
      d[o + 2] = hatch ? 38 : 26;
      d[o + 3] = 236;
    }
    c.putImageData(data, 0, 0);
  }

  private explored(run: Run, x: number, z: number) {
    const w = run.world!;
    const fx = Math.floor(x / FOG_CELL);
    const fz = Math.floor(z / FOG_CELL);
    return fx >= 0 && fz >= 0 && fx < w.fogN && fz < w.fogN && w.fog[fz * w.fogN + fx] === 1;
  }

  /** Bakes the terrain into an image for this run. */
  setRun(run: Run | null) {
    this.run = run;
    this.base = null;
    this.cont = !!run?.world?.cont;
    this.fogImg = null;
    if (!run) return;
    if (this.cont) {
      this.bakeContinent(run);
      this.acc = 1;
      return;
    }
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
          const c3 = cell === CELL.hazard ? tint(0xc04030, [44, 48, 54], 0.35) : tint(tileCol[t.tile[i]] ?? 0x666666, [38, 54, 58], 0.12);
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
    this.drag = null;
    if (on && this.run) {
      this.vx = this.run.player.x;
      this.vz = this.run.player.z;
      this.zoom = 3;
      this.clampView();
    }
  }

  /** Open world: area rings and names (big map), the town, boss lairs and named elites. */
  private drawWorld(run: Run, toScreen: (x: number, z: number) => [number, number], inView: (x: number, y: number, m?: number) => boolean, outline: (draw: () => void, fill: string) => void, u: number, scale: number, cw: number, ch: number) {
    const w = run.world!;
    const ctx = this.ctx;
    if (w.cont) return this.drawContinent(run, toScreen, inView, outline, u);
    const c = w.layout.c + 0.5;
    const [tx, ty] = toScreen(c, c);
    if (this.big) {
      // ring borders and area names
      ctx.strokeStyle = 'rgba(255,230,160,0.35)';
      ctx.lineWidth = 1.2 * u;
      ctx.setLineDash([4 * u, 4 * u]);
      for (let r = 0; r <= WORLD.rings; r++) {
        ctx.beginPath();
        ctx.arc(tx, ty, (WORLD.ringStart + r * WORLD.ringW) * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = `600 ${Math.round(10 * u)}px Rubik, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const a of w.layout.areas) {
        const ang = ((a.sector + 0.5) / WORLD.sectors) * Math.PI * 2 - Math.PI - Math.PI / WORLD.sectors;
        const d = WORLD.ringStart + (a.ring + 0.5) * WORLD.ringW;
        const [sx, sy] = toScreen(c + Math.cos(ang) * d, c + Math.sin(ang) * d);
        if (!inView(sx, sy)) continue;
        const label = `${L(a.name)} ${a.lo}-${a.hi}`;
        ctx.lineWidth = 3 * u;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(label, sx, sy);
        ctx.fillStyle = '#f4ead0';
        ctx.fillText(label, sx, sy);
      }
    }
    // the town: a walled circle with a house
    if (inView(tx, ty, 20)) {
      const s = Math.max(6 * u, WORLD.townR * scale);
      ctx.lineWidth = 2 * u;
      ctx.strokeStyle = '#8affb0';
      ctx.beginPath();
      ctx.arc(tx, ty, s, 0, Math.PI * 2);
      ctx.stroke();
      const hs = 4.5 * u;
      outline(() => {
        ctx.beginPath();
        ctx.moveTo(tx - hs, ty + hs);
        ctx.lineTo(tx - hs, ty - hs * 0.2);
        ctx.lineTo(tx, ty - hs);
        ctx.lineTo(tx + hs, ty - hs * 0.2);
        ctx.lineTo(tx + hs, ty + hs);
        ctx.closePath();
      }, '#8affb0');
    }
    // boss lairs: a red skull-ish square (dim while the boss is away)
    for (const l of w.lairs) {
      const [sx, sy] = toScreen(l.def.x, l.def.z);
      if (!inView(sx, sy, 10)) continue;
      const s = 5 * u;
      const up = !l.boss && run.time >= l.deadUntil;
      outline(() => {
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
      }, up ? '#ff3a5a' : '#6a3a44');
      ctx.fillStyle = '#000';
      ctx.fillRect(sx - s * 0.45, sy - s * 0.3, s * 0.3, s * 0.3);
      ctx.fillRect(sx + s * 0.15, sy - s * 0.3, s * 0.3, s * 0.3);
    }
    // named elites: orange stars while they are home
    for (const cp of w.camps) {
      if (cp.def.kind !== 'elite') continue;
      const [sx, sy] = toScreen(cp.hx, cp.hz);
      if (!inView(sx, sy, 6)) continue;
      const up = run.time >= cp.members[0].deadUntil;
      const s = 4 * u;
      outline(() => {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const r = k % 2 ? s * 0.45 : s;
          if (k) ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
          else ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
        }
        ctx.closePath();
      }, up ? '#ffa030' : '#5a4a3a');
    }
    void cw;
    void ch;
  }

  /** Continent overlay: places, areas and markers (discovered / explored ones only). */
  private drawContinent(run: Run, toScreen: (x: number, z: number) => [number, number], inView: (x: number, y: number, m?: number) => boolean, outline: (draw: () => void, fill: string) => void, u: number) {
    const w = run.world!;
    const cont = w.cont!;
    const ctx = this.ctx;
    const big = this.big;
    const label = (text: string, x: number, y: number, size: number, fill: string, weight = 600) => {
      ctx.font = `${weight} ${Math.round(size * u)}px Rubik, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    };
    if (big) {
      const z = this.zoom;
      // mountain ranges (explored middle point) and areas with their level range
      if (z >= 1.5)
        for (const r of RANGES) {
          const [mx, mz] = r.pts[r.pts.length >> 1];
          if (!this.explored(run, mx, mz)) continue;
          const [sx, sy] = toScreen(mx, mz);
          if (inView(sx, sy, 40)) label(L(r.name), sx, sy, 10, 'rgba(220,226,236,0.85)', 500);
        }
      for (const a of AREAS) {
        if (!this.explored(run, a.x, a.z)) continue;
        const [sx, sy] = toScreen(a.x, a.z);
        if (!inView(sx, sy, 60)) continue;
        label(`${L(a.name)} ${a.lo}-${a.hi}`, sx, sy - 14 * u, 11, '#f4ead0');
      }
    }
    // settlements
    for (const t of cont.towns) {
      const x = (t.x0 + t.x1) / 2;
      const z = (t.z0 + t.z1) / 2;
      const [sx, sy] = toScreen(x, z);
      if (!inView(sx, sy, 60)) continue;
      const known = this.explored(run, x, z) || t.def.id === w.home;
      if (!known) continue;
      const k = t.def.kind;
      const s = (k === 'capital' ? 6 : k === 'city' ? 5 : 4) * u;
      const home = t.def.id === w.home;
      outline(() => {
        ctx.beginPath();
        ctx.moveTo(sx - s, sy + s);
        ctx.lineTo(sx - s, sy - s * 0.2);
        ctx.lineTo(sx, sy - s);
        ctx.lineTo(sx + s, sy - s * 0.2);
        ctx.lineTo(sx + s, sy + s);
        ctx.closePath();
      }, home ? '#8affb0' : t.def.safe ? '#fff2d0' : '#9a9088');
      if (home) {
        ctx.lineWidth = 2 * u;
        ctx.strokeStyle = '#8affb0';
        ctx.beginPath();
        ctx.arc(sx, sy, s * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (big) {
        const fs = k === 'capital' ? 15 : k === 'city' ? 13 : k === 'town' || k === 'fort' ? 11 : 10;
        if (fs >= 11 || this.zoom >= 2) label(L(t.def.name), sx, sy + s + 9 * u, fs, home ? '#b0ffc8' : '#fff', k === 'capital' || k === 'city' ? 700 : 600);
      }
    }
    // landmarks
    if (big && this.zoom >= 3)
      for (const lm of cont.landmarks) {
        if (!this.explored(run, lm.x, lm.z)) continue;
        const [sx, sy] = toScreen(lm.x, lm.z);
        if (!inView(sx, sy, 40)) continue;
        outline(() => {
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5 * u, 0, Math.PI * 2);
        }, '#e8d8a8');
        label(L(lm.name), sx, sy + 9 * u, 9, '#e8d8a8', 500);
      }
    // faction camps (explored)
    for (const st of cont.sites) {
      if (!this.explored(run, st.x, st.z)) continue;
      const [sx, sy] = toScreen(st.x, st.z);
      if (!inView(sx, sy, 30)) continue;
      const s = 4 * u;
      outline(() => {
        ctx.beginPath();
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx + s, sy + s * 0.8);
        ctx.lineTo(sx - s, sy + s * 0.8);
        ctx.closePath();
      }, '#ff5a4a');
      if (big && this.zoom >= 2.5) label(`${L(st.def.name)} ${st.def.lo}-${st.def.hi}`, sx, sy + 10 * u, 9, '#ffb0a0', 500);
    }
    // dungeons (found)
    for (const dg of cont.dungeons) {
      if (!w.foundDungeons.has(dg.def.id)) continue;
      const [sx, sy] = toScreen(dg.x, dg.z);
      if (!inView(sx, sy, 30)) continue;
      const s = 4.5 * u;
      outline(() => {
        ctx.beginPath();
        ctx.arc(sx, sy + s * 0.3, s, Math.PI, 0);
        ctx.lineTo(sx + s, sy + s * 0.8);
        ctx.lineTo(sx - s, sy + s * 0.8);
        ctx.closePath();
      }, '#c77dff');
      if (big && this.zoom >= 2) label(`${L(dg.def.name)} ${dg.def.lo}-${dg.def.hi}`, sx, sy + 11 * u, 9, '#e0c0ff', 500);
    }
    // waystones (discovered)
    for (const ws of cont.waystones) {
      if (!w.known.has(ws.id)) continue;
      const [sx, sy] = toScreen(ws.x, ws.z);
      if (!inView(sx, sy, 10)) continue;
      const s = 4 * u;
      outline(() => {
        ctx.beginPath();
        ctx.moveTo(sx, sy - s * 1.2);
        ctx.lineTo(sx + s * 0.6, sy);
        ctx.lineTo(sx, sy + s * 1.2);
        ctx.lineTo(sx - s * 0.6, sy);
        ctx.closePath();
      }, '#5ae8ff');
    }
    // boss lairs (explored)
    for (const l of w.lairs) {
      if (!this.explored(run, l.def.x, l.def.z)) continue;
      const [sx, sy] = toScreen(l.def.x, l.def.z);
      if (!inView(sx, sy, 10)) continue;
      const s = 5 * u;
      const up = !l.boss && run.time >= l.deadUntil;
      outline(() => {
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
      }, up ? '#ff3a5a' : '#6a3a44');
      ctx.fillStyle = '#000';
      ctx.fillRect(sx - s * 0.45, sy - s * 0.3, s * 0.3, s * 0.3);
      ctx.fillRect(sx + s * 0.15, sy - s * 0.3, s * 0.3, s * 0.3);
    }
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
    const contBig = this.big && this.cont;
    const cx = contBig ? this.vx : this.big ? n / 2 : p.x;
    const cz = contBig ? this.vz : this.big ? n / 2 : p.z;
    const scale = contBig ? (Math.min(cw, ch) / n) * this.zoom : this.big ? Math.min(cw, ch) / (n * Math.SQRT2) : cw / LOCAL_SPAN;
    if (contBig) this.view = { scale, cw, ch };
    // the continent big map is north-up so it reads like a map and pans naturally
    const yaw = contBig ? 0 : this.yaw;
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
    ctx.imageSmoothingEnabled = this.cont || !this.big;
    ctx.drawImage(this.base, 0, 0);
    if (this.cont && this.fogImg) {
      this.fogAcc += 1;
      if (this.fogAcc >= 15) {
        this.fogAcc = 0;
        this.updateFog(run);
      }
      // fog image: one pixel per FOG_CELL world units, in base-image pixels
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.fogImg, 0, 0, this.fogImg.width * FOG_CELL * this.px, this.fogImg.height * FOG_CELL * this.px);
    }
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
    if (run.world) this.drawWorld(run, toScreen, inView, outline, u, scale, cw, ch);
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
