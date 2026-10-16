// Загрузка запечённых карт (out/*.png, vectors.json) для инструментов этапов 3–5. Только чтение — рельеф заморожен.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../png';
import { WORLD, SEA_LEVEL } from '../design';
import { clamp, segDist, type P } from '../geom';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
export const N = 2048, CS = WORLD / N;

export function loadMaps() {
  const hp = decodePNG(readFileSync(join(OUT, 'heightmap_2048.png'))).data as Uint16Array;
  const H = new Float32Array(N * N); for (let i = 0; i < N * N; i++) H[i] = hp[i] / 64;
  const biome = decodePNG(readFileSync(join(OUT, 'biome_2048.png'))).data as Uint8Array;
  const major = decodePNG(readFileSync(join(OUT, 'major_biome_2048.png'))).data as Uint8Array;
  const water = decodePNG(readFileSync(join(OUT, 'water_2048.png'))).data as Uint8Array;
  const region = decodePNG(readFileSync(join(OUT, 'regions_2048.png'))).data as Uint8Array;
  const vec = JSON.parse(readFileSync(join(OUT, 'vectors.json'), 'utf8')) as {
    rivers: { id: string; pts: number[][] }[]; roads: { route: string; kind: string; pts: number[][] }[];
    pads: { id: string; at: P; r: number; y: number }[];
  };
  const ci = (x: number, y: number) => clamp(Math.floor(y / CS), 0, N - 1) * N + clamp(Math.floor(x / CS), 0, N - 1);
  const h = (x: number, y: number) => H[ci(x, y)];
  const slope = (x: number, y: number) => {
    const cx = clamp(Math.floor(x / CS), 1, N - 2), cy = clamp(Math.floor(y / CS), 1, N - 2), i = cy * N + cx;
    const gx = (H[i + 1] - H[i - 1]) / (2 * CS), gy = (H[i + N] - H[i - N]) / (2 * CS);
    return Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI;
  };
  // сегменты дорог и рек в корзинах 128 блоков
  const B = 128, GB = Math.ceil(WORLD / B) + 1;
  type S = { a: number[]; b: number[]; kind: string; w: number };
  const roadB: S[][] = Array.from({ length: GB * GB }, () => []), riverB: S[][] = Array.from({ length: GB * GB }, () => []);
  const put = (arr: S[][], s: S) => {
    const x0 = Math.floor((Math.min(s.a[0], s.b[0]) - 64) / B), x1 = Math.floor((Math.max(s.a[0], s.b[0]) + 64) / B);
    const y0 = Math.floor((Math.min(s.a[1], s.b[1]) - 64) / B), y1 = Math.floor((Math.max(s.a[1], s.b[1]) + 64) / B);
    for (let y = Math.max(0, y0); y <= Math.min(GB - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(GB - 1, x1); x++) arr[y * GB + x].push(s);
  };
  for (const r of vec.roads) for (let k = 0; k + 1 < r.pts.length; k++) put(roadB, { a: r.pts[k], b: r.pts[k + 1], kind: r.kind, w: r.kind === 'main' ? 3 : 2 });
  for (const r of vec.rivers) for (let k = 0; k + 1 < r.pts.length; k++) put(riverB, { a: r.pts[k], b: r.pts[k + 1], kind: r.id, w: Math.max(r.pts[k][3], r.pts[k + 1][3]) });
  const nearest = (arr: S[][], x: number, y: number) => {
    const bx = clamp(Math.floor(x / B), 0, GB - 1), by = clamp(Math.floor(y / B), 0, GB - 1); let best = Infinity, at: P = [x, y], kind = '';
    for (const s of arr[by * GB + bx]) { const [d, t] = segDist(x, y, s.a[0], s.a[1], s.b[0], s.b[1]); const e = d - s.w; if (e < best) { best = e; at = [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]; kind = s.kind; } }
    return { d: best, at, kind };
  };
  const roadDist = (x: number, y: number) => nearest(roadB, x, y);
  const riverDist = (x: number, y: number) => nearest(riverB, x, y);
  const isWater = (x: number, y: number) => water[ci(x, y)] !== 0 || h(x, y) < SEA_LEVEL;
  return { H, biome, major, water, region, vec, ci, h, slope, roadDist, riverDist, isWater };
}
export type Maps = ReturnType<typeof loadMaps>;
