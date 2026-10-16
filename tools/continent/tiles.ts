/**
 * Полноразмерный мир: тайлы 256×256 блоков, 1 блок на отсчёт (32×32 тайла на 8192², мир — 8000²).
 * Источник — замороженная обзорная карта (out/heightmap_2048.png) + векторы (реки, дороги) + авторские формы
 * (меса со слоистыми уступами), пересчитанные на блочном разрешении. Детерминированно.
 *
 * Формат тайла t_X_Y.png (RGB8): R,G = высота Y×16 (uint16, старший/младший байт), B = материал (см. MAT в docs).
 *   npx tsx tools/continent/tiles.ts --all        → tools/continent/out/tiles/ (все тайлы, для движка) + хеш
 *   npx tsx tools/continent/tiles.ts --site       → tools/continent/viewer/public/data/tiles/ (подмножество для просмотрщика)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as D from './design';
import { clamp, lerp, segDist, smooth, type P } from './geom';
import { fbm, ridged, vnoise } from './noise';
import { decodePNG, encodePNG } from './png';
import { mesaHeight } from './relief';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const N = 2048, W = D.WORLD, CS = W / N, SEA = D.SEA_LEVEL, SEED = D.SEED;
export const TILE = 256, TILES = 32;
/** Материалы блока: 0..18 — подбиомы (как в карте биомов), далее вода и дороги. */
export const MAT = { river: 20, lake: 21, sea: 22, swamp: 23, road: 24, path: 25 };

function loadInputs() {
  const hp = decodePNG(readFileSync(join(OUT, 'heightmap_2048.png')));
  const H = new Float32Array(N * N); for (let i = 0; i < N * N; i++) H[i] = (hp.data[i] as number) / 64;
  const biome = decodePNG(readFileSync(join(OUT, 'biome_2048.png'))).data as Uint8Array;
  const water = decodePNG(readFileSync(join(OUT, 'water_2048.png'))).data as Uint8Array;
  const wl = decodePNG(readFileSync(join(OUT, 'waterlevel_2048.png'))).data as Uint16Array;
  const vec = JSON.parse(readFileSync(join(OUT, 'vectors.json'), 'utf8')) as {
    rivers: { id: string; pts: number[][] }[]; roads: { route: string; kind: string; pts: number[][] }[];
    pads: { id: string; at: P; r: number; y: number }[]; mesaFoot: Record<string, number>;
  };
  return { H, biome, water, wl, vec };
}

type Seg = { ax: number; ay: number; bx: number; by: number; a: number[]; b: number[]; w: number; kind: number };
function makeTileFn() {
  const { H, biome, water, wl, vec } = loadInputs();
  const B = 64, GB = Math.ceil(8192 / B);
  const riverB: Seg[][] = Array.from({ length: GB * GB }, () => []), roadB: Seg[][] = Array.from({ length: GB * GB }, () => []);
  const addSeg = (arr: Seg[][], s: Seg, pad: number) => {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - pad) / B), x1 = Math.floor((Math.max(s.ax, s.bx) + pad) / B);
    const y0 = Math.floor((Math.min(s.ay, s.by) - pad) / B), y1 = Math.floor((Math.max(s.ay, s.by) + pad) / B);
    for (let y = Math.max(0, y0); y <= Math.min(GB - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(GB - 1, x1); x++) arr[y * GB + x].push(s);
  };
  for (const r of vec.rivers) for (let k = 0; k + 1 < r.pts.length; k++) { const a = r.pts[k], b = r.pts[k + 1]; addSeg(riverB, { ax: a[0], ay: a[1], bx: b[0], by: b[1], a, b, w: Math.max(a[3], b[3]), kind: 0 }, Math.max(a[3], b[3]) + 8); }
  for (const r of vec.roads) {
    const main = ['main', 'alt', 'danger', 'secret', 'secondary', 'caravan'].includes(r.kind) ? 1 : 0;
    const w = r.kind === 'main' ? 3 : main ? 2.2 : 1.4;
    for (let k = 0; k + 1 < r.pts.length; k++) { const a = r.pts[k], b = r.pts[k + 1]; addSeg(roadB, { ax: a[0], ay: a[1], bx: b[0], by: b[1], a, b, w, kind: main }, w + 4); }
  }
  const Hc = (cx: number, cy: number) => H[clamp(cy, 0, N - 1) * N + clamp(cx, 0, N - 1)];
  const cub = (p0: number, p1: number, p2: number, p3: number, t: number) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const bicubic = (x: number, y: number) => {
    const fx = x / CS - 0.5, fy = y / CS - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const r: number[] = [];
    for (let j = -1; j <= 2; j++) r.push(cub(Hc(ix - 1, iy + j), Hc(ix, iy + j), Hc(ix + 1, iy + j), Hc(ix + 2, iy + j), tx));
    return cub(r[0], r[1], r[2], r[3], ty);
  };
  const near = (x: number, y: number) => clamp(Math.floor(y / CS), 0, N - 1) * N + clamp(Math.floor(x / CS), 0, N - 1);
  const mesas = D.MESAS.map(m => ({ m, foot: vec.mesaFoot[m.id], ext: m.r * 1.5 + m.edge * 3.5 }));

  return (tx: number, ty: number) => {
    const hOut = new Uint16Array(TILE * TILE), mat = new Uint8Array(TILE * TILE);
    for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
      const wx = tx * TILE + lx, wy = ty * TILE + ly, x = wx + 0.5, y = wy + 0.5, o = ly * TILE + lx;
      if (wx >= W || wy >= W) { hOut[o] = SEA * 16 - 64; mat[o] = MAT.sea; continue; }
      let h = bicubic(x, y);
      // естественная граница материалов: выборка карты биомов с небольшим дрожанием
      const jx = x + 5 * fbm(x / 14, y / 14, SEED + 90), jy = y + 5 * fbm(x / 14, y / 14, SEED + 91);
      let m = biome[near(jx, jy)]; const ni = near(x, y); const wt = water[ni];
      // ближайшие дорога и река
      const bk = clamp(Math.floor(y / B), 0, GB - 1) * GB + clamp(Math.floor(x / B), 0, GB - 1);
      let rd = Infinity, rw = 0, rlev = 0;
      for (const s of riverB[bk]) { const [d, t] = segDist(x, y, s.ax, s.ay, s.bx, s.by); const w = lerp(s.a[3], s.b[3], t); if (d - w < rd - rw) { rd = d; rw = w; rlev = lerp(s.a[2], s.b[2], t); } }
      let qd = Infinity, qw = 0, qmain = 0;
      for (const s of roadB[bk]) { const [d] = segDist(x, y, s.ax, s.ay, s.bx, s.by); if (d - s.w < qd - qw) { qd = d; qw = s.w; qmain = s.kind; } }
      let pad = 0; for (const p of vec.pads) { const d = Math.hypot(x - p.at[0], y - p.at[1]); pad = Math.max(pad, 1 - smooth(p.r * 0.8, p.r * 1.3, d)); }
      // детализация по материалу (гасится у дорог, рек, площадок)
      const calm = Math.min(smooth(qw, qw + 8, qd), smooth(rw, rw + 10, rd), 1 - pad);
      const rocky = m === 11 || m === 12 || m === 17 || m === 15 || m === 13 || m === 6;
      if (rocky) {
        h += calm * (1.4 * fbm(x / 11, y / 11, SEED + 92, 3) + 1.6 * (ridged(x / 23, y / 23, SEED + 93, 3) - 0.35));
        if (m === 15 || m === 17 || m === 11) { const st = 3; const q = Math.floor(h / st) * st + st * smooth(0.55, 0.95, (h / st) % 1); h = lerp(h, q, 0.6 * calm); }
      } else if (m === 14) {
        h += calm * 0.6 * Math.sin((x * 0.9 + y * 0.4) / 3.2 + 3 * fbm(x / 40, y / 40, SEED + 94));
      } else if (m <= 1) { /* море */ } else {
        h += calm * (0.55 * fbm(x / 13, y / 13, SEED + 95, 3) + (m === 4 || m === 7 || m === 9 ? 0.35 * vnoise(x / 4, y / 4, SEED + 96) : 0));
      }
      // меса и останцы — слоистые уступы на блочном разрешении
      for (const q of mesas) {
        if (Math.abs(x - q.m.at[0]) > q.ext || Math.abs(y - q.m.at[1]) > q.ext) continue;
        const r = mesaHeight(q.m, q.foot, x, y);
        if (r && r.v > h - 2) { h = r.zone === 1 ? r.v + 0.6 * fbm(x / 6, y / 6, SEED + 97) : r.zone === 0 ? r.v : Math.max(h, r.v); if (r.zone === 1) m = 15; }
      }
      // дороги: полотно без детального шума
      let mm = m;
      if (qd < qw + 1.5) { const base = bicubic(x, y); h = lerp(base, h, smooth(qw - 0.5, qw + 1.5, qd)); if (qd < qw) mm = qmain ? MAT.road : MAT.path; }
      // реки на ширину в блоках
      if (rd < rw + 12) {
        if (rd < rw) { h = Math.min(h, rlev - 2.2 * (1 - (rd / rw) ** 2) - 0.6); mm = MAT.river; }
        else h = Math.min(h, rlev + 0.4 + (rd - rw) * 0.6);
      }
      // моря, озёра, болотные бочаги — по уровню воды обзорной карты
      if (wt === 1 || wt === 3 || wt === 4) { const lev = wl[ni] / 64; if (h < lev) mm = wt === 1 ? MAT.sea : wt === 3 ? MAT.lake : MAT.swamp; }
      else if (h < SEA && mm !== MAT.river) mm = MAT.sea;
      if (mm === MAT.river && qd < qw + 1) mm = qmain ? MAT.road : MAT.path; // мост/брод поверх реки
      hOut[o] = clamp(Math.round(h * 16), 0, 65535); mat[o] = mm;
    }
    return { hOut, mat };
  };
}

function packTile(hOut: Uint16Array, mat: Uint8Array) {
  const rgb = new Uint8Array(TILE * TILE * 3);
  for (let i = 0; i < TILE * TILE; i++) { rgb[i * 3] = hOut[i] >> 8; rgb[i * 3 + 1] = hOut[i] & 255; rgb[i * 3 + 2] = mat[i]; }
  return encodePNG(TILE, TILE, rgb, 3, 8, 2);
}

/** Тайлы, которые попадают в опубликованный просмотрщик: окрестности деревень, ориентиров и ракурсов-крупных планов. */
export function siteTiles(): [number, number][] {
  const focus: [number, number, number][] = [
    ...D.VILLAGES.map(v => [v.at[0], v.at[1], 2] as [number, number, number]),
    [4300, 1150, 2], [3650, 2180, 1], [6262, 2520, 1], [4790, 5640, 1], [3670, 6065, 2], [2950, 6260, 1],
    [5900, 6900, 2], [3350, 6850, 2], [6400, 6250, 1], [2300, 7050, 2], [6600, 6000, 2], [6400, 3700, 1],
    [2280, 2250, 1], [4100, 5300, 2], [2300, 5000, 1], [6300, 5250, 1], [2600, 1060, 1], [1950, 6300, 1],
  ];
  const set = new Set<string>();
  for (const [fx, fy, r] of focus) { const cx = Math.floor(fx / TILE), cy = Math.floor(fy / TILE); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < TILES && y < TILES) set.add(`${x},${y}`); } }
  return [...set].map(s => s.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

const all = process.argv.includes('--all');
// --all → все 1024 тайла в out/tiles (для движка); --site → те же тайлы в просмотрщик (они достаточно малы: ~32 МБ)
const list: [number, number][] = process.argv.includes('--subset') ? siteTiles() : Array.from({ length: TILES * TILES }, (_, i) => [i % TILES, Math.floor(i / TILES)] as [number, number]);
const dir = all ? join(OUT, 'tiles') : join(HERE, 'viewer', 'public', 'data', 'tiles');
mkdirSync(dir, { recursive: true });
const shardArg = process.argv.find(a => a.startsWith('--shard='));
if (shardArg) {
  // дочерний процесс: свой срез тайлов
  const [k, n] = shardArg.slice(8).split('/').map(Number);
  const fn = makeTileFn(); const res: Record<string, [string, number]> = {};
  list.forEach(([tx, ty], i) => {
    if (i % n !== k) return;
    const { hOut, mat } = fn(tx, ty); const png = packTile(hOut, mat); const key = `t_${tx}_${ty}`;
    writeFileSync(join(dir, key + '.png'), png);
    res[key] = [createHash('sha256').update(Buffer.from(hOut.buffer)).update(mat).digest('hex'), png.length];
  });
  writeFileSync(join(dir, `.shard${k}.json`), JSON.stringify(res));
} else {
  const n = Math.max(1, Number(process.env.THREADS ?? 4)); const t0 = Date.now();
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((res, rej) => {
    const c = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2), `--shard=${k}/${n}`], { stdio: 'inherit' });
    c.on('exit', code => code === 0 ? res() : rej(new Error('shard ' + k + ' failed')));
  })));
  const hashes: Record<string, [string, number]> = {};
  for (let k = 0; k < n; k++) { const f = join(dir, `.shard${k}.json`); Object.assign(hashes, JSON.parse(readFileSync(f, 'utf8'))); unlinkSync(f); }
  const keys = Object.keys(hashes).sort(); let bytes = 0;
  const combined = createHash('sha256'); for (const k of keys) { combined.update(k + ':' + hashes[k][0] + '\n'); bytes += hashes[k][1]; }
  const manifest = { tile: TILE, tiles: TILES, world: W, encoding: 'RGB8: (R<<8|G) = Y*16, B = material', mat: MAT, list: keys, hash: combined.digest('hex'), bytes };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  console.log(`tiles: ${keys.length}, ${(bytes / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s, hash ${manifest.hash}`);
  if (all) {
    const sp = join(HERE, '..', '..', 'docs', 'continent', 'stats.json');
    if (existsSync(sp)) { const st = JSON.parse(readFileSync(sp, 'utf8')); st.heightHash = { ...(st.heightHash ?? {}), tiles1block: manifest.hash, tilesBytes: bytes, tilesNote: 'sha256 по строкам «имя:sha256(высоты Uint16LE + материалы)» всех 1024 тайлов, отсортированных по имени' }; writeFileSync(sp, JSON.stringify(st, null, 1)); }
  }
}
