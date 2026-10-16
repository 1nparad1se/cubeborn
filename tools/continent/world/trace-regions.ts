/**
 * Одноразовый инструмент: обводит текущую раскладку регионов (out/regions_2048.png) полигонами и печатает их как TS-данные.
 * Результат вручную вставлен в world/regions.ts и дальше правится как авторские данные (bake от seed больше не зависит).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../png';
import { REGIONS } from '../design';
type P = [number, number];
const HERE = dirname(fileURLToPath(import.meta.url));
const reg = decodePNG(readFileSync(join(HERE, '..', 'out', 'regions_2048.png'))).data as Uint8Array;
const N = 2048, G = 256, S = N / G, CELL = 8000 / G;
const grid = new Uint8Array(G * G).fill(255);
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
  const cnt = new Map<number, number>();
  for (let k = 0; k < S; k++) for (let q = 0; q < S; q++) { const v = reg[(y * S + k) * N + x * S + q]; cnt.set(v, (cnt.get(v) ?? 0) + 1); }
  let best = 255, bc = 0; for (const [v, c] of cnt) if (c > bc) { bc = c; best = v; }
  grid[y * G + x] = best;
}
function dp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  let md = 0, mi = 0; const [a, b] = [pts[0], pts[pts.length - 1]];
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l; if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [a, b];
  return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
}
const out: string[] = [];
REGIONS.forEach((r, id) => {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < G && y < G && grid[y * G + x] === id;
  // рёбра границы (по часовой), затем сцепка в петли
  const edges = new Map<string, P[]>(); const key = (p: P) => p[0] + ',' + p[1];
  const add = (a: P, b: P) => { const k = key(a); if (!edges.has(k)) edges.set(k, []); edges.get(k)!.push(b); };
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (inside(x, y)) {
    if (!inside(x, y - 1)) add([x, y], [x + 1, y]);
    if (!inside(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!inside(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!inside(x - 1, y)) add([x, y + 1], [x, y]);
  }
  let best: P[] = [];
  while (edges.size) {
    const [k0, lst] = edges.entries().next().value as [string, P[]];
    const start = k0.split(',').map(Number) as P; const loop: P[] = [start]; let cur = lst.pop()!; if (!lst.length) edges.delete(k0);
    while (key(cur) !== k0) { loop.push(cur); const l = edges.get(key(cur)); if (!l) break; const nx = l.pop()!; if (!l.length) edges.delete(key(cur)); cur = nx; }
    if (loop.length > best.length) best = loop;
  }
  const half = Math.floor(best.length / 2);
  const simp = [...dp(best.slice(0, half + 1), 1.1).slice(0, -1), ...dp([...best.slice(half), best[0]], 1.1).slice(0, -1)].map(p => [Math.round(p[0] * CELL / 10) * 10, Math.round(p[1] * CELL / 10) * 10] as P);
  out.push(`  ${r.id}: ${JSON.stringify(simp)},`);
});
console.log(out.join('\n'));
