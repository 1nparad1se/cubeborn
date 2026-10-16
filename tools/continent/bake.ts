/**
 * Детерминированная запекалка континента: design.ts → карты высот/биомов/воды/дорог/регионов + проверки.
 * Запуск: npx tsx tools/continent/bake.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './design';
import { clamp, lerp, pointInPoly, polyDist, segDist, smooth, spline, polyArea, type P } from './geom';
import { fbm, ridged, vnoise } from './noise';
import { encodePNG } from './png';
import { createHash } from 'node:crypto';
import { SIDE_ROADS } from './world/roads';
import { mesaHeight, mulberry32 } from './relief';
import { REGION_POLYS } from './world/regions';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out');
const VDATA = join(HERE, 'viewer', 'public', 'data');
const DOCS = join(ROOT, 'docs', 'continent');
for (const d of [OUT, VDATA, DOCS]) mkdirSync(d, { recursive: true });

const N = 2048, W = D.WORLD, CS = W / N, SEA = D.SEA_LEVEL, SEED = D.SEED;
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const idx = (cx: number, cy: number) => cy * N + cx;
const cxOf = (x: number) => clamp(Math.floor(x / CS), 0, N - 1);

function box(minx: number, miny: number, maxx: number, maxy: number, cb: (i: number, x: number, y: number) => void) {
  const x0 = cxOf(minx), x1 = cxOf(maxx), y0 = cxOf(miny), y1 = cxOf(maxy);
  for (let cy = y0; cy <= y1; cy++) { const y = (cy + 0.5) * CS; for (let cx = x0; cx <= x1; cx++) cb(cy * N + cx, (cx + 0.5) * CS, y); }
}
function sample(a: Float32Array, x: number, y: number) {
  const fx = clamp(x / CS - 0.5, 0, N - 1.001), fy = clamp(y / CS - 0.5, 0, N - 1.001);
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, i = iy * N + ix;
  return lerp(lerp(a[i], a[i + 1], tx), lerp(a[i + N], a[i + N + 1], tx), ty);
}
/** Catmull–Rom on n-dimensional vertices. */
function splineN(pts: number[][], step: number): number[][] {
  const out: number[][] = []; const n = pts.length; const g = (i: number) => pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const k = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(pts[n - 1]); return out;
}
/** Euclidean distance transform (Felzenszwalb) of a boolean grid: distance (in cells) to nearest `true`. */
function edt(src: Uint8Array): Float32Array {
  const INF = 1e20, f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const g = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = src[i] ? 0 : INF;
  const pass = (get: (k: number) => number, set: (k: number, val: number) => void) => {
    for (let q = 0; q < N; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < N; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < N; q++) set(q, d[q]);
  };
  for (let x = 0; x < N; x++) pass(k => g[k * N + x], (k, val) => { g[k * N + x] = val; });
  for (let y = 0; y < N; y++) pass(k => g[y * N + k], (k, val) => { g[y * N + k] = val; });
  const out = new Float32Array(N * N); for (let i = 0; i < N * N; i++) out[i] = Math.sqrt(g[i]); return out;
}

// ───────────── 1. Суша: береговой полигон + мелкая изрезанность ─────────────
const inside = new Uint8Array(N * N);
for (const poly of [D.COAST, ...D.ISLANDS.map(i => i.poly)]) {
const coast = spline(poly, 30, true);
for (let cy = 0; cy < N; cy++) {
  const y = (cy + 0.5) * CS; const xs: number[] = [];
  for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
    const [xi, yi] = coast[i], [xj, yj] = coast[j];
    if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) for (let cx = cxOf(xs[k]); cx <= cxOf(xs[k + 1]); cx++) inside[cy * N + cx] = 1;
}
}
const land = new Uint8Array(N * N);
for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
  const x = (cx + 0.5) * CS, y = (cy + 0.5) * CS;
  const wx = 85 * fbm(x / 650, y / 650, SEED + 1) + 25 * fbm(x / 140, y / 140, SEED + 2);
  const wy = 85 * fbm(x / 650, y / 650, SEED + 3) + 25 * fbm(x / 140, y / 140, SEED + 4);
  land[idx(cx, cy)] = inside[idx(cxOf(x + wx), cxOf(y + wy))];
}
const sea0 = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) sea0[i] = land[i] ? 0 : 1;
const coastDist = edt(sea0); const seaDist = edt(land);
log('coast done');

// ───────────── 2. Подложка: опорные высоты (ОВР) + береговой подъём ─────────────
const base = new Float32Array(N * N);
const h = new Float32Array(N * N);
for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
  const i = idx(cx, cy), x = (cx + 0.5) * CS, y = (cy + 0.5) * CS;
  let sw = 0, sv = 0;
  for (const [bx, by, bh] of D.BASE_HEIGHTS) { const d2 = (x - bx) ** 2 + (y - by) ** 2 + 4e4; const w = 1 / (d2 * d2); sw += w; sv += bh * w; }
  const b = sv / sw + 5 * fbm(x / 900, y / 900, SEED + 5) + 2 * fbm(x / 220, y / 220, SEED + 6);
  base[i] = b;
  if (land[i]) { const cd = coastDist[i] * CS; h[i] = SEA + 1.2 + (b - SEA - 1.2) * smooth(0, 520, cd) + 1.5 * smooth(0, 40, cd); }
  else h[i] = SEA - 2 - Math.min(28, seaDist[i] * CS * 0.05) + 1.5 * fbm(x / 300, y / 300, SEED + 7);
}
log('base done');

// ───────────── 3. Хребты, отроги, пики ─────────────
let erosionStats: Record<string, number> = {};
const R = new Float32Array(N * N); // абсолютная высота гор (0 = нет)
const RS = new Float32Array(N * N), RU = new Float32Array(N * N); // дуговая координата вдоль гребня (со сдвигом по склону) и относительное удаление
for (const r of D.RIDGES) {
  const dense = splineN(r.pts, 40); const sharp = r.sharp ?? 1.6;
  let arc = 0;
  for (let k = 0; k + 1 < dense.length; k++) {
    const a = dense[k], b = dense[k + 1]; const wm = Math.max(a[3], b[3]) * 1.3;
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]); const arc0 = arc; arc += segLen;
    box(Math.min(a[0], b[0]) - wm, Math.min(a[1], b[1]) - wm, Math.max(a[0], b[0]) + wm, Math.max(a[1], b[1]) + wm, (i, x, y) => {
      if (!land[i]) return;
      const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]);
      const w = lerp(a[3], b[3], t) * (0.78 + 0.5 * vnoise(x / 380, y / 380, SEED + 11));
      const u = d / w; if (u >= 1) return;
      const crest = lerp(a[2], b[2], t) * (0.84 + 0.3 * vnoise(x / 700, y / 700, SEED + 8)) ;
      const v = base[i] + Math.max(0, crest - base[i]) * Math.pow(1 - u, sharp) * smooth(0, 120, coastDist[i] * CS);
      if (v > R[i]) {
        R[i] = v; RU[i] = u;
        const side = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) > 0 ? 0.5 : 0; // отроги по разные стороны гребня не совпадают
        RS[i] = (arc0 + t * segLen) / 270 + side + r.pts.length * 0.37;
      }
    });
  }
}
for (let i = 0; i < N * N; i++) if (R[i] > h[i]) {
  const x = ((i % N) + 0.5) * CS, y = (Math.floor(i / N) + 0.5) * CS;
  const amt = R[i] - h[i]; const u = RU[i];
  // отроги и распадки: долины, сбегающие перпендикулярно гребню, глубже к подножию
  const g = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (RS[i] + 0.45 * fbm(x / 420, y / 420, SEED + 9) + 0.25 * u)), 2.2);
  const gully = g * smooth(0.1, 0.5, u) * (1 - smooth(0.8, 1, u));
  const rough = (0.72 + 0.42 * ridged(x / 600, y / 600, SEED + 12) + 0.08 * fbm(x / 80, y / 80, SEED + 13)) * (1 - 0.5 * gully);
  h[i] = h[i] + amt * rough;
}
for (const p of D.PEAKS) box(p.at[0] - p.r, p.at[1] - p.r, p.at[0] + p.r, p.at[1] + p.r, (i, x, y) => {
  const u = Math.hypot(x - p.at[0], y - p.at[1]) / (p.r * (0.85 + 0.3 * vnoise(x / 120, y / 120, SEED + 14))); if (u >= 1) return;
  const v = base[i] + (p.y - base[i]) * Math.pow(1 - u, p.sharp) * (0.94 + 0.08 * ridged(x / 160, y / 160, SEED + 15));
  if (v > h[i]) h[i] = v;
  if (p.spire) { const us = Math.hypot(x - p.at[0], y - p.at[1]) / p.spire[1]; if (us < 1) h[i] += p.spire[0] * (1 - us) * (0.9 + 0.2 * vnoise(x / 25, y / 25, SEED + 16)); }
});
log('ridges done');

// ───────────── 4. Плато, меса, кратер, низины, дюны ─────────────
const canyonMask = new Uint8Array(N * N); // 1 = стены/дно каньона или откос месы (красный камень)
for (const p of D.PLATEAUS) {
  const xs = p.poly.map(q => q[0]), ys = p.poly.map(q => q[1]); const e = p.edge;
  box(Math.min(...xs) - e, Math.min(...ys) - e, Math.max(...xs) + e, Math.max(...ys) + e, (i, x, y) => {
    const sd = pointInPoly(x, y, p.poly) ? polyDist(x, y, p.poly) : -polyDist(x, y, p.poly);
    const v = clamp((sd + e * (0.85 + 0.3 * vnoise(x / 150, y / 150, SEED + 16))) / e, 0, 1); if (v <= 0) return;
    const top = p.top + 4 * fbm(x / 200, y / 200, SEED + 17);
    if (top > h[i]) h[i] = h[i] + (top - h[i]) * Math.pow(v, 2.6);
  });
}
const mesaMask = new Uint8Array(N * N);
const mesaFoot: Record<string, number> = {};
for (const m of D.MESAS) {
  const foot = base[idx(cxOf(m.at[0]), cxOf(m.at[1]))]; mesaFoot[m.id] = +foot.toFixed(2);
  const ext = m.r * 1.5 + m.edge * 3.5;
  box(m.at[0] - ext, m.at[1] - ext, m.at[0] + ext, m.at[1] + ext, (i, x, y) => {
    const r = mesaHeight(m, foot, x, y); if (!r) return;
    if (r.v > h[i] + 0.3) { h[i] = r.v; if (r.zone > 0) canyonMask[i] = 1; mesaMask[i] = 1; }
  });
}
for (const c of D.CRATERS) {
  const ext = c.r + c.w;
  box(c.at[0] - ext, c.at[1] - ext, c.at[0] + ext, c.at[1] + ext, (i, x, y) => {
    const d = Math.hypot(x - c.at[0], y - c.at[1]) * (1 + 0.06 * fbm(x / 120, y / 120, SEED + 19));
    if (d < c.r) h[i] = c.floor + (c.rim - c.floor) * Math.pow(d / c.r, 2.6);
    else { const u = (d - c.r) / c.w; if (u < 1) h[i] = Math.max(h[i], base[i] + (c.rim - base[i]) * Math.pow(1 - u, 1.7)); }
  });
}
const lowMask = new Float32Array(N * N);
const water = new Uint8Array(N * N); // 0 нет, 1 море, 2 река, 3 озеро, 4 болото
const wlevel = new Float32Array(N * N);
for (const l of D.LOWLANDS) {
  const xs = l.poly.map(q => q[0]), ys = l.poly.map(q => q[1]);
  box(Math.min(...xs) - 220, Math.min(...ys) - 220, Math.max(...xs) + 220, Math.max(...ys) + 220, (i, x, y) => {
    const sd = pointInPoly(x, y, l.poly) ? polyDist(x, y, l.poly) : -polyDist(x, y, l.poly);
    const m = smooth(-220, 120, sd + 60 * fbm(x / 300, y / 300, SEED + 20)); if (m <= 0) return;
    lowMask[i] = m; h[i] = lerp(h[i], l.y + 1.6 * fbm(x / 70, y / 70, SEED + 21), m);
    if (m > 0.7 && fbm(x / 60, y / 60, SEED + 22) > 0.22) { h[i] = l.y - 1.2; water[i] = 4; wlevel[i] = l.y; }
  });
}
log('plateaus/mesas/crater/lowland done');

// ───────────── 5. Перевалы ─────────────
for (const p of D.PASSES) box(p.at[0] - p.r, p.at[1] - p.r, p.at[0] + p.r, p.at[1] + p.r, (i, x, y) => {
  const s = smooth(0, p.r, Math.hypot(x - p.at[0], y - p.at[1])); const t = lerp(p.y, h[i], Math.pow(s, 0.8));
  if (t < h[i]) h[i] = t;
});

// ───────────── 6. Каньоны и пандусы ─────────────
for (const c of D.CANYONS) {
  const dense = splineN(c.pts, 20);
  const tgt = new Float32Array(N * N).fill(1e9); let maxW = 0; for (const p of c.pts) maxW = Math.max(maxW, p[3]);
  const ext = maxW + c.wall + 20;
  for (let k = 0; k + 1 < dense.length; k++) {
    const a = dense[k], b = dense[k + 1];
    box(Math.min(a[0], b[0]) - ext, Math.min(a[1], b[1]) - ext, Math.max(a[0], b[0]) + ext, Math.max(a[1], b[1]) + ext, (i, x, y) => {
      const [d0, t] = segDist(x, y, a[0], a[1], b[0], b[1]);
      const d = d0 + 14 * fbm(x / 110, y / 110, SEED + 25);
      const w = lerp(a[3], b[3], t), fl = lerp(a[2], b[2], t);
      let v: number;
      if (d < w) v = fl + 1.2 * fbm(x / 50, y / 50, SEED + 26);
      else if (d < w + c.wall) {
        let k2 = (d - w) / c.wall;
        if (c.terrace > 0) { const steps = 4; k2 = Math.floor(k2 * steps) / steps * 0.75 + k2 * 0.25; }
        v = fl + (h[i] - fl) * Math.pow(k2, 0.7);
      } else return;
      if (v < tgt[i]) tgt[i] = v;
    });
  }
  for (let i = 0; i < N * N; i++) if (tgt[i] < h[i]) { if (h[i] - tgt[i] > 6 && c.terrace > 0) canyonMask[i] = 1; h[i] = tgt[i]; }
}
for (const r of D.RAMPS) {
  const ext = r.w * 3;
  box(Math.min(r.a[0], r.b[0]) - ext, Math.min(r.a[1], r.b[1]) - ext, Math.max(r.a[0], r.b[0]) + ext, Math.max(r.a[1], r.b[1]) + ext, (i, x, y) => {
    const [d, t] = segDist(x, y, r.a[0], r.a[1], r.b[0], r.b[1]);
    const m = 1 - smooth(r.w, r.w * 2.5, d); if (m <= 0) return;
    h[i] = lerp(h[i], lerp(r.a[2], r.b[2], t), m);
  });
}
log('passes/canyons done');

// ───────────── 6b. Пустынный рельеф: холмы, бедленды, уступы ─────────────
const polyMask = (poly: P[], x: number, y: number, fade: number) => { const sd = pointInPoly(x, y, poly) ? polyDist(x, y, poly) : -polyDist(x, y, poly); return smooth(-fade, fade, sd); };
for (const f of D.HILL_FIELDS) {
  const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]); const sp = f.spacing;
  const add = new Float32Array(N * N);
  for (let gy = Math.floor(Math.min(...ys) / sp); gy <= Math.ceil(Math.max(...ys) / sp); gy++) for (let gx = Math.floor(Math.min(...xs) / sp); gx <= Math.ceil(Math.max(...xs) / sp); gx++) {
    const r1 = vnoise(gx * 7.31, gy * 3.17, SEED + 70), r2 = vnoise(gx * 5.13, gy * 9.71, SEED + 71), r3 = vnoise(gx * 2.7, gy * 6.1, SEED + 72);
    const cx0 = (gx + 0.15 + 0.7 * r1) * sp, cy0 = (gy + 0.15 + 0.7 * r2) * sp, rad = sp * (0.45 + 0.35 * r3), hh = f.h * (0.45 + 0.75 * r3);
    box(cx0 - rad * 1.6, cy0 - rad * 1.6, cx0 + rad * 1.6, cy0 + rad * 1.6, (i, x, y) => {
      const d = Math.hypot(x - cx0, (y - cy0) * 1.3) / rad; if (d > 1.6) return;
      const v = hh * Math.exp(-d * d * 1.6); if (v > add[i]) add[i] = v;
    });
  }
  box(Math.min(...xs) - 150, Math.min(...ys) - 150, Math.max(...xs) + 150, Math.max(...ys) + 150, (i, x, y) => { if (add[i] > 0 && land[i]) h[i] += add[i] * polyMask(f.poly, x, y, 150); });
}
for (const b of D.BADLANDS) {
  const xs = b.poly.map(q => q[0]), ys = b.poly.map(q => q[1]);
  box(Math.min(...xs) - 120, Math.min(...ys) - 120, Math.max(...xs) + 120, Math.max(...ys) + 120, (i, x, y) => {
    const m = polyMask(b.poly, x, y, 120); if (m <= 0) return;
    const v = ridged(x / b.scale, y / b.scale, SEED + 73, 4);
    const cut = b.depth * Math.pow(clamp(1 - v * 1.6, 0, 1), 1.3);
    const lift = b.depth * 0.5 * smooth(0.3, 0.8, v);
    h[i] += m * (lift - cut); canyonMask[i] = canyonMask[i] || (m > 0.5 && cut > 4 ? 1 : 0);
  });
}
for (const e of D.ESCARPMENTS) {
  const xs = e.pts.map(q => q[0]), ys = e.pts.map(q => q[1]); const ext = e.fade + 50;
  let total = 0; const segL = e.pts.slice(1).map((q, k) => { const l = Math.hypot(q[0] - e.pts[k][0], q[1] - e.pts[k][1]); total += l; return l; });
  box(Math.min(...xs) - ext, Math.min(...ys) - ext, Math.max(...xs) + ext, Math.max(...ys) + ext, (i, x, y) => {
    let best = Infinity, sideBest = 0, arcBest = 0, arc = 0;
    for (let k = 0; k + 1 < e.pts.length; k++) {
      const a = e.pts[k], b = e.pts[k + 1]; const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]);
      if (d < best) { best = d; sideBest = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0 ? 1 : -1; arcBest = (arc + t * segL[k]) / total; }
      arc += segL[k];
    }
    const sdv = sideBest * best + 10 * fbm(x / 60, y / 60, SEED + 74);
    const rise = e.h * smooth(-e.edge, e.edge, sdv) * (1 - smooth(e.fade * 0.4, e.fade, best)) * smooth(0, 0.12, arcBest) * (1 - smooth(0.88, 1, arcBest));
    if (rise > 0.05) h[i] += rise;
  });
}
log('desert relief done');

// ───────────── 6c. Эрозия: капельная (гидравлическая) + термическая, с масками ─────────────
const emask = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) emask[i] = land[i] ? (1 - lowMask[i]) * (mesaMask[i] ? 0.12 : canyonMask[i] ? 0.35 : 1) : 0;
for (const p of D.PASSES) box(p.at[0] - p.r, p.at[1] - p.r, p.at[0] + p.r, p.at[1] + p.r, (i, x, y) => { emask[i] *= 0.25 + 0.75 * smooth(p.r * 0.3, p.r, Math.hypot(x - p.at[0], y - p.at[1])); });
for (const r of D.RAMPS) box(Math.min(r.a[0], r.b[0]) - 40, Math.min(r.a[1], r.b[1]) - 40, Math.max(r.a[0], r.b[0]) + 40, Math.max(r.a[1], r.b[1]) + 40, (i) => { emask[i] = 0; });
for (const v of D.VILLAGES) box(v.at[0] - v.pad * 1.6, v.at[1] - v.pad * 1.6, v.at[0] + v.pad * 1.6, v.at[1] + v.pad * 1.6, (i) => { emask[i] *= 0.2; });
const preErosion = h.slice();
{
  const rnd = mulberry32(SEED + 77);
  const brush: [number, number, number][] = []; let ws = 0;
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const d = Math.hypot(ox, oy); if (d <= 2.2) { const w = 2.3 - d; brush.push([ox, oy, w]); ws += w; } }
  for (const b of brush) b[2] /= ws;
  const inertia = 0.06, capF = 4.5, minCap = 0.02, depoS = 0.25, eroS = 0.45, evap = 0.025, grav = 3, maxSteps = 70;
  const DROPS = 3_500_000; let used = 0;
  for (let n = 0; n < DROPS; n++) {
    let x = 2 + rnd() * (N - 5), y = 2 + rnd() * (N - 5);
    const r0 = rnd(); const i0 = (y | 0) * N + (x | 0);
    if (emask[i0] < 0.3 || h[i0] < SEA + 6) continue;
    if (r0 > clamp((h[i0] - SEA - 10) / 140, 0.05, 1)) continue;
    used++;
    let dx = 0, dy = 0, sp = 1, wat = 1, sed = 0;
    for (let st = 0; st < maxSteps; st++) {
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, k = iy * N + ix;
      const a = h[k], b = h[k + 1], c = h[k + N], d = h[k + N + 1];
      const gx = (b - a) * (1 - fy) + (d - c) * fy, gy = (c - a) * (1 - fx) + (d - b) * fx;
      const hOld = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
      dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
      const len = Math.hypot(dx, dy); if (len < 1e-6) break; dx /= len; dy /= len;
      x += dx; y += dy; if (x < 2 || y < 2 || x > N - 3 || y > N - 3) break;
      const jx = x | 0, jy = y | 0, gx2 = x - jx, gy2 = y - jy, j = jy * N + jx;
      if (h[j] < SEA) break;
      const hNew = h[j] * (1 - gx2) * (1 - gy2) + h[j + 1] * gx2 * (1 - gy2) + h[j + N] * (1 - gx2) * gy2 + h[j + N + 1] * gx2 * gy2;
      const dh = hNew - hOld; const em = emask[k];
      const cap = Math.max(-dh * sp * wat * capF, minCap);
      if (sed > cap || dh > 0) {
        const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depoS; sed -= dep;
        const de = dep * em;
        h[k] += de * (1 - fx) * (1 - fy); h[k + 1] += de * fx * (1 - fy); h[k + N] += de * (1 - fx) * fy; h[k + N + 1] += de * fx * fy;
      } else {
        const ero = Math.min((cap - sed) * eroS, -dh) * em;
        for (const [ox, oy, w] of brush) { const q = (iy + oy) * N + ix + ox; const take = Math.min(ero * w, Math.max(0, h[q] - SEA - 1)); h[q] -= take; sed += take; }
      }
      sp = Math.min(10, Math.sqrt(Math.max(0, sp * sp - dh * grav))); wat *= 1 - evap;
    }
  }
  // термическая эрозия: осыпи у подножий
  const talus = Math.tan(34 * Math.PI / 180) * CS;
  for (let it = 0; it < 6; it++) for (let cy = 1; cy < N - 1; cy++) for (let cx = 1; cx < N - 1; cx++) {
    const i = cy * N + cx; const em = emask[i]; if (em < 0.2) continue;
    let md = 0, mj = -1; for (const j of [i + 1, i - 1, i + N, i - N]) { const dd = h[i] - h[j]; if (dd > md) { md = dd; mj = j; } }
    if (mj >= 0 && md > talus) { const mv = (md - talus) * 0.22 * em; h[i] -= mv; h[mj] += mv; }
  }
  let sumAbs = 0, maxCut = 0; for (let i = 0; i < N * N; i++) { const dlt = preErosion[i] - h[i]; sumAbs += Math.abs(dlt); if (dlt > maxCut) maxCut = dlt; }
  erosionStats = { droplets: used, meanChange: +(sumAbs / (N * N)).toFixed(3), maxCut: +maxCut.toFixed(1) };
}
log('erosion done', erosionStats);

// ───────────── 6d. Дюны: направленные гряды (пологий наветренный склон, крутой подветренный) ─────────────
for (const f of D.DUNE_FIELDS) {
  const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]);
  const ux = Math.cos(f.dir * Math.PI / 180), uy = Math.sin(f.dir * Math.PI / 180);
  box(Math.min(...xs) - 200, Math.min(...ys) - 200, Math.max(...xs) + 200, Math.max(...ys) + 200, (i, x, y) => {
    const m = polyMask(f.poly, x, y, 200); if (m <= 0 || !land[i]) return;
    const along = (x * ux + y * uy) / f.wl + 1.3 * fbm(x / 520, y / 520, SEED + 23); const trans = -x * uy + y * ux;
    const fr = along - Math.floor(along);
    const prof = fr < 0.72 ? smooth(0, 0.72, fr) : 1 - smooth(0.72, 1, fr);
    const cres = 0.4 + 0.6 * vnoise(trans / 170, Math.floor(along) * 0.7, SEED + 24);
    h[i] += f.amp * m * prof * cres;
  });
}

// ───────────── 7. Реки: русло монотонно не поднимается вниз по течению ─────────────
interface RiverOut { id: string; ru: string; mouth: string; pts: [number, number, number, number][]; } // x, y, уровень воды, полуширина
const riversOut: RiverOut[] = [];
const carveChannel = (pts: number[][], wet: boolean, depthCh: number, bankSlope: number) => {
  const tgt = new Map<number, number>(); const lvl = new Map<number, number>(); const wid = new Map<number, boolean>();
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1]; const ext = Math.max(a[3], b[3]) + 70;
    box(Math.min(a[0], b[0]) - ext, Math.min(a[1], b[1]) - ext, Math.max(a[0], b[0]) + ext, Math.max(a[1], b[1]) + ext, (i, x, y) => {
      const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]);
      const w = lerp(a[3], b[3], t), s = lerp(a[2], b[2], t);
      let v: number;
      if (d < w) v = s - depthCh * (1 - (d / w) ** 2) - 0.6;
      else if (d < w + 70) v = s + 0.4 + (d - w) * bankSlope; else return;
      const old = tgt.get(i); if (old === undefined || v < old) tgt.set(i, v);
      if (d < w) { const ol = lvl.get(i); if (ol === undefined || s < ol) lvl.set(i, s); wid.set(i, true); }
    });
  }
  for (const [i, v] of tgt) if (v < h[i]) h[i] = v;
  if (wet) for (const [i, s] of lvl) if (wid.get(i) && water[i] !== 1) { water[i] = 2; wlevel[i] = s; }
};
const canyonAxes = D.CANYONS.map(c => c.pts);
const distToCanyon = (x: number, y: number) => { let m = Infinity; for (const c of canyonAxes) for (let k = 0; k + 1 < c.length; k++) { const [d, t] = segDist(x, y, c[k][0], c[k][1], c[k + 1][0], c[k + 1][1]); m = Math.min(m, d - lerp(c[k][3], c[k + 1][3], t)); } return m; };
function meander(pts: P[], amp: number, seed: number): P[] {
  if (!amp) return pts;
  const out: P[] = []; let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    if (k) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const f = k / (pts.length - 1);
    const damp = smooth(0, 0.08, f) * (1 - smooth(0.93, 1, f)) * clamp((distToCanyon(pts[k][0], pts[k][1]) + 20) / 220, 0, 1);
    const off = amp * damp * (0.65 * Math.sin(s / 260 + seed) + 0.35 * fbm(s / 500, seed, SEED + 50) * 1.6);
    out.push([pts[k][0] - dy / l * off, pts[k][1] + dx / l * off]);
  }
  return out;
}
for (const r of D.RIVERS) {
  const dense = meander(spline(r.pts, 5), r.meander ?? 0, r.id.length * 1.7); const L = dense.length;
  const pts: [number, number, number, number][] = [];
  let surf = Infinity;
  for (let k = 0; k < L; k++) {
    const [x, y] = dense[k];
    const local = sample(h, x, y);
    surf = Math.min(surf, local - 1.2);
    const f = k / (L - 1);
    pts.push([x, y, Math.max(surf, SEA - 0.0), lerp(r.w0, r.w1, Math.pow(f, 0.8))]);
  }
  // монотонность после ограничения уровнем моря
  for (let k = 1; k < L; k++) pts[k][2] = Math.min(pts[k][2], pts[k - 1][2]);
  carveChannel(pts, true, r.depth, 0.55);
  riversOut.push({ id: r.id, ru: r.ru, mouth: r.mouth, pts });
  if (process.env.DBG) console.log(r.id, pts.filter((_, k) => k % 20 === 0).map(p => `${Math.round(p[0])},${Math.round(p[1])}:${p[2].toFixed(0)}`).join(" "));
}
for (const b of D.DRY_BEDS) {
  const dense = spline(b.pts, 6); let surf = Infinity;
  const pts = dense.map(([x, y]) => { surf = Math.min(surf, sample(h, x, y) - 1); return [x, y, surf, b.w]; });
  carveChannel(pts, false, b.depth, 0.5);
}
log('rivers done');

// ───────────── 8. Озёра ─────────────
interface LakeOut { id: string; ru: string; at: P; r: number; level: number; water: boolean; }
const lakesOut: LakeOut[] = [];
const playa = new Uint8Array(N * N);
for (const l of D.LAKES) {
  let level = l.level ?? Infinity;
  // уровень озера на реке = уровень реки в ближайшей точке
  let best = Infinity;
  for (const r of riversOut) for (const p of r.pts) { const d = Math.hypot(p[0] - l.at[0], p[1] - l.at[1]); if (d < l.r && d < best) { best = d; level = Math.min(level, p[2]); } }
  if (!isFinite(level)) {
    let rim = Infinity; for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; rim = Math.min(rim, sample(h, l.at[0] + Math.cos(t) * l.r, l.at[1] + Math.sin(t) * l.r)); }
    level = rim - 1;
  }
  const ext = l.r * 1.3;
  box(l.at[0] - ext, l.at[1] - ext, l.at[0] + ext, l.at[1] + ext, (i, x, y) => {
    const ang = Math.atan2(y - l.at[1], x - l.at[0]);
    const rr = l.r * (1 + 0.28 * fbm(Math.cos(ang) * 1.6 + 9, Math.sin(ang) * 1.6 + 9, SEED + 27 + l.id.length) + 0.1 * fbm(Math.cos(ang) * 5 + 3, Math.sin(ang) * 5 + 3, SEED + 29));
    const d = Math.hypot(x - l.at[0], y - l.at[1]); const u = d / rr;
    if (u < 1) {
      const v = l.water ? level - 0.8 - l.depth * (1 - u * u) : level - 0.5;
      if (v < h[i]) h[i] = v;
      if (l.water && h[i] < level) { water[i] = 3; wlevel[i] = level; }
      if (!l.water) { h[i] = Math.min(h[i], level + 0.3 * fbm(x / 40, y / 40, SEED + 28)); playa[i] = 1; }
    } else if (u < 1.3) {
      const v = level + 0.5 + (d - rr) * 0.25; if (v < h[i]) h[i] = v;
    }
  });
  lakesOut.push({ id: l.id, ru: l.ru, at: l.at, r: l.r, level: +level.toFixed(1), water: l.water });
}

// ───────────── 8b. Площадки деревень ─────────────
const padsOut: { id: string; at: P; r: number; y: number }[] = [];
for (const v of D.VILLAGES) {
  const hs: number[] = [];
  box(v.at[0] - v.pad, v.at[1] - v.pad, v.at[0] + v.pad, v.at[1] + v.pad, (i, x, y) => { if (!water[i] && Math.hypot(x - v.at[0], y - v.at[1]) < v.pad) hs.push(h[i]); });
  hs.sort((a, b) => a - b); const target = hs[Math.floor(hs.length / 2)];
  box(v.at[0] - v.pad * 1.7, v.at[1] - v.pad * 1.7, v.at[0] + v.pad * 1.7, v.at[1] + v.pad * 1.7, (i, x, y) => {
    if (water[i]) return; const d = Math.hypot(x - v.at[0], y - v.at[1]); const m = 1 - smooth(v.pad, v.pad * 1.7, d); if (m <= 0) return;
    h[i] = lerp(h[i], target + 0.4 * fbm(x / 60, y / 60, SEED + 80), m);
  });
  padsOut.push({ id: v.id, at: v.at, r: v.pad, y: +target.toFixed(1) });
}

// ───────────── 9. Море: заливка от открытого моря по всему, что ниже уровня ─────────────
{
  const q: number[] = [];
  for (let i = 0; i < N * N; i++) if (!land[i]) { water[i] = 1; wlevel[i] = SEA; q.push(i); }
  while (q.length) {
    const i = q.pop()!; const cx = i % N, cy = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx; if (water[j] === 1) continue;
      if (h[j] < SEA - 0.05 && water[j] === 0) { water[j] = 1; wlevel[j] = SEA; q.push(j); }
    }
  }
}
let belowSeaDry = 0; for (let i = 0; i < N * N; i++) if (land[i] && h[i] < SEA - 0.05 && !water[i]) belowSeaDry++;
log('lakes/sea done');

// ───────────── 10. Биомы: климат = широта + шум + высотный градиент; пороги подбираются под 55/25/20 ─────────────
const T = new Float32Array(N * N);
const isLand = (i: number) => water[i] !== 1;
const landIdx: number[] = [];
// влага: расстояние до рек и озёр (зелёные полосы вдоль рек, уходящих в пустыню)
const wetSrc = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) wetSrc[i] = water[i] === 2 || water[i] === 3 ? 1 : 0;
const wetDist = edt(wetSrc);
// крупномасштабный рельеф (НЧ-фильтр) — долины ниже окрестностей суше и теплее: языки степи
const LP = 128, lp = new Float32Array(LP * LP);
for (let y = 0; y < LP; y++) for (let x = 0; x < LP; x++) { let s2 = 0; for (let k = 0; k < 16; k++) for (let q = 0; q < 16; q++) s2 += Math.max(SEA, h[(y * 16 + k) * N + x * 16 + q]); lp[y * LP + x] = s2 / 256; }
for (let it = 0; it < 3; it++) { const c = lp.slice(); for (let y = 1; y < LP - 1; y++) for (let x = 1; x < LP - 1; x++) lp[y * LP + x] = (c[y * LP + x] * 4 + c[y * LP + x - 1] + c[y * LP + x + 1] + c[(y - 1) * LP + x] + c[(y + 1) * LP + x]) / 8; }
const lpAt = (x: number, y: number) => { const fx = clamp(x / W * LP - 0.5, 0, LP - 1.001), fy = clamp(y / W * LP - 0.5, 0, LP - 1.001); const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy; const k = iy * LP + ix; return lerp(lerp(lp[k], lp[k + 1], tx), lerp(lp[k + LP], lp[k + LP + 1], tx), ty); };
for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
  const i = idx(cx, cy), x = (cx + 0.5) * CS, y = (cy + 0.5) * CS;
  let bias = 0; for (const [bx, by, dt, br] of D.CLIMATE) bias += dt * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (br * br));
  const yw = y + 260 * fbm(x / 900, y / 900, SEED + 60) + 90 * fbm(x / 260, y / 260, SEED + 61);
  const lat = yw / W; const south = smooth(0.52, 0.72, lat);
  const moist = canyonMask[i] ? 0 : Math.exp(-wetDist[i] * CS / 210);
  const valley = clamp(lpAt(x, y) - Math.max(SEA, h[i]), 0, 50);
  const sandTongue = Math.max(0, ridged(x / 820, y / 820, SEED + 62) - 0.42);
  T[i] = lat + bias + 0.07 * fbm(x / 2200, y / 2200, SEED + 30) + 0.04 * fbm(x / 1000, y / 1000, SEED + 44) + 0.025 * fbm(x / 380, y / 380, SEED + 31)
    - 0.0006 * Math.max(0, h[i] - 70) - 0.1 * moist * south + 0.0011 * valley * south + 0.09 * sandTongue * south;
  if (isLand(i)) landIdx.push(i);
}
const sortedT = landIdx.map(i => T[i]).sort((a, b) => a - b);
const TW = sortedT[Math.floor(sortedT.length * 0.20)], TD = sortedT[Math.floor(sortedT.length * 0.75)];
const major = new Uint8Array(N * N).fill(255); // 0 green, 1 winter, 2 desert, 255 sea
for (const i of landIdx) major[i] = T[i] < TW ? 1 : T[i] > TD ? 2 : 0;

// уклон (градусы) по центральным разностям
const slope = new Float32Array(N * N);
for (let cy = 1; cy < N - 1; cy++) for (let cx = 1; cx < N - 1; cx++) {
  const i = idx(cx, cy); const gx = (h[i + 1] - h[i - 1]) / (2 * CS), gy = (h[i + N] - h[i - N]) / (2 * CS);
  slope[i] = Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI;
}
// Подбиомы (индексы палитры)
export const SUB = ['Глубокое море', 'Мелководье', 'Пляж', 'Луга', 'Лиственный лес', 'Болото', 'Холмы', 'Смешанный хвойный лес', 'Сухая степь',
  'Тайга', 'Снежная равнина', 'Заснеженные скалы', 'Ледник', 'Каменистая пустошь', 'Песок', 'Красные скалы (каньон)', 'Оазис', 'Скалы', 'Солончак'];
const biome = new Uint8Array(N * N);
const oasis = D.LAKES.find(l => l.id === 'oasis')!;
for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
  const i = idx(cx, cy), x = (cx + 0.5) * CS, y = (cy + 0.5) * CS; const m = major[i];
  if (m === 255) { biome[i] = seaDist[i] * CS > 160 ? 0 : 1; continue; }
  const s = slope[i], hh = h[i], cd = coastDist[i] * CS; let b: number;
  if (m === 1) {
    if (hh > 300 + 25 * fbm(x / 200, y / 200, SEED + 32)) b = 12;
    else if (s > 36) b = 11;
    else if (T[i] > TW - 0.03 + 0.012 * fbm(x / 150, y / 150, SEED + 33) && hh < 175) b = 9;
    else b = 10;
  } else if (m === 2) {
    const od = Math.hypot(x - oasis.at[0], y - oasis.at[1]);
    if (od < oasis.r * 2.2 + 40 * fbm(x / 60, y / 60, SEED + 34)) b = 16;
    else if (canyonMask[i] || (s > 30 && hh > 75)) b = 15;
    else if (playa[i]) b = 18;
    else if (T[i] < TD + 0.03 + 0.015 * fbm(x / 160, y / 160, SEED + 35) || (fbm(x / 500, y / 500, SEED + 36) * 0.8 + (x - 5700) / 700 > 0) || s > 18) b = 13;
    else b = 14;
  } else {
    if (s > 42) b = 17;
    else if (T[i] > TD - 0.032 + 0.012 * fbm(x / 160, y / 160, SEED + 37)) b = 8;
    else if (T[i] < TW + 0.03 + 0.012 * fbm(x / 160, y / 160, SEED + 38)) b = 7;
    else if (lowMask[i] > 0.5) b = 5;
    else if (D.FORESTS.some(f => pointInPoly(x + 60 * fbm(x / 150, y / 150, SEED + 39), y + 60 * fbm(x / 150, y / 150, SEED + 40), f.poly)) || fbm(x / 260, y / 260, SEED + 41) > 0.42) b = 4;
    else if (hh > 118 || s > 24) b = 6;
    else if (cd < 22 && hh < 46) b = 2;
    else b = 3;
  }
  biome[i] = b;
}
log('biomes done', { TW: TW.toFixed(4), TD: TD.toFixed(4) });

// ───────────── 11. Регионы ─────────────
// полигоны из world/regions.ts (порядок = D.REGIONS); щели между соседними полигонами заполняются ближайшим регионом
const region = new Uint8Array(N * N).fill(255);
REGION_POLYS.forEach((rp, k) => {
  for (let cy = 0; cy < N; cy++) {
    const y = (cy + 0.5) * CS; const xs: number[] = [];
    for (let i = 0, j = rp.poly.length - 1; i < rp.poly.length; j = i++) { const [xi, yi] = rp.poly[i], [xj, yj] = rp.poly[j]; if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi)); }
    xs.sort((q, w) => q - w);
    for (let m = 0; m + 1 < xs.length; m += 2) for (let cx = cxOf(xs[m]); cx <= cxOf(xs[m + 1]); cx++) { const i = cy * N + cx; if (isLand(i) && region[i] === 255) region[i] = k; }
  }
});
{
  let frontier: number[] = []; for (const i of landIdx) if (region[i] !== 255) frontier.push(i);
  while (frontier.length) {
    const next: number[] = [];
    for (const i of frontier) { const cx = i % N, cy = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (region[j] === 255 && isLand(j)) { region[j] = region[i]; next.push(j); } } }
    frontier = next;
  }
}
log('regions done');

// ───────────── 12. Дороги: поиск пути по уклону на сетке 1024² ─────────────
const G = 1024, GC = W / G;
const gh = new Float32Array(G * G), gw = new Uint8Array(G * G);
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
  const i = (y * 2) * N + x * 2; gh[y * G + x] = (h[i] + h[i + 1] + h[i + N] + h[i + N + 1]) / 4;
  const ws = [water[i], water[i + 1], water[i + N], water[i + N + 1]];
  gw[y * G + x] = ws.includes(1) ? 1 : ws.includes(3) ? 3 : ws.includes(2) ? 2 : ws.includes(4) ? 4 : 0;
}
class Heap { a: number[] = []; f: number[] = [];
  push(n: number, f: number) { const a = this.a, F = this.f; a.push(n); F.push(f); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= F[i]) break; [a[p], a[i]] = [a[i], a[p]]; [F[p], F[i]] = [F[i], F[p]]; i = p; } }
  pop(): number { const a = this.a, F = this.f; const top = a[0]; const ln = a.pop()!, lf = F.pop()!; if (a.length) { a[0] = ln; F[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && F[l] < F[m]) m = l; if (r < a.length && F[r] < F[m]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; [F[m], F[i]] = [F[i], F[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }
const roadUse = new Uint8Array(G * G); // повторное использование трасс дешевле — дороги сливаются в сеть
function astar(a: P, b: P, maxDeg = 28, soft = false): P[] {
  const MAXS = Math.tan(maxDeg * Math.PI / 180);
  const sx = clamp(Math.floor(a[0] / GC), 0, G - 1), sy = clamp(Math.floor(a[1] / GC), 0, G - 1);
  const tx = clamp(Math.floor(b[0] / GC), 0, G - 1), ty = clamp(Math.floor(b[1] / GC), 0, G - 1);
  const g = new Float32Array(G * G).fill(Infinity), from = new Int32Array(G * G).fill(-1), closed = new Uint8Array(G * G);
  const s = sy * G + sx, t = ty * G + tx; g[s] = 0; const hp = new Heap(); hp.push(s, 0);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (hp.size) {
    const c = hp.pop(); if (c === t) break; if (closed[c]) continue; closed[c] = 1;
    const cx = c % G, cy = (c / G) | 0;
    for (const [dx, dy, dl] of dirs) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
      const n = ny * G + nx; if (closed[n]) continue;
      const wn = gw[n]; if (wn === 1 || wn === 3) continue;
      const len = dl * GC; const sl = Math.abs(gh[n] - gh[c]) / len;
      if (sl > MAXS && n !== t) continue;
      let cost = len * (1 + 30 * sl * sl + (wn === 4 ? 2 : 0));
      if (wn === 2 && gw[c] !== 2) cost += 260; // въезд на мост/брод
      if (roadUse[n]) cost *= 0.6;
      const ng = g[c] + cost;
      if (ng < g[n]) { g[n] = ng; from[n] = c; hp.push(n, ng + Math.hypot(nx - tx, ny - ty) * GC); }
    }
  }
  if (from[t] < 0 && t !== s) { if (soft) return []; throw new Error(`Дорога не найдена: ${a} → ${b}`); }
  const path: P[] = []; for (let c = t; c >= 0; c = from[c]) { path.push([(c % G + 0.5) * GC, (((c / G) | 0) + 0.5) * GC]); roadUse[c] = 1; if (c === s) break; }
  return path.reverse();
}
interface RouteOut { id: string; ru: string; kind: string; note: string; legs: { mode: string; label?: string; pts: P[] }[]; length: number; maxSlopeDeg: number; }
const routesOut: RouteOut[] = [];
const bridges: { at: P; kind: string; route: string; ru: string; length: number; heightAbove?: number }[] = [];
const tunnels: { a: P; b: P; ru: string; route: string; length: number }[] = [];
const roadMask = new Uint8Array(N * N);
const paint = (x: number, y: number, v: number) => { const cx = cxOf(x), cy = cxOf(y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && roadMask[ny * N + nx] < v) roadMask[ny * N + nx] = v; } };
for (const r of D.ROUTES) {
  let cur = r.from; const legs: RouteOut['legs'] = []; let length = 0;
  for (const sg of r.segs) {
    let pts: P[];
    if (sg.mode === 'road') pts = smoothPath(astar(cur, sg.to));
    else pts = [cur, sg.to];
    const segLen = pts.reduce((acc, p, k) => k ? acc + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0, 0);
    length += segLen;
    if (sg.mode === 'bridge') {
      let minFloor = Infinity; for (let k = 0; k <= 20; k++) minFloor = Math.min(minFloor, sample(h, lerp(cur[0], sg.to[0], k / 20), lerp(cur[1], sg.to[1], k / 20)));
      const deck = Math.max(sample(h, cur[0], cur[1]), sample(h, sg.to[0], sg.to[1]));
      bridges.push({ at: [(cur[0] + sg.to[0]) / 2, (cur[1] + sg.to[1]) / 2], kind: 'canyon', route: r.id, ru: sg.label ?? 'Мост', length: Math.round(segLen), heightAbove: Math.round(deck - minFloor) });
    }
    if (sg.mode === 'tunnel') tunnels.push({ a: cur, b: sg.to, ru: sg.label ?? 'Туннель', route: r.id, length: Math.round(segLen) });
    if (sg.mode === 'road') {
      // мосты/броды — где дорога пересекает реку
      let inRiver = false, start: P = pts[0];
      for (let k = 0; k < pts.length; k++) {
        const w = water[idx(cxOf(pts[k][0]), cxOf(pts[k][1]))] === 2;
        if (w && !inRiver) { inRiver = true; start = pts[k]; }
        if (!w && inRiver) {
          inRiver = false; const at: P = [(start[0] + pts[k][0]) / 2, (start[1] + pts[k][1]) / 2];
          const ford = r.kind === 'danger' || r.kind === 'alt' && Math.hypot(at[0] - 4870, at[1] - 5100) < 600;
          const dup = bridges.some(b => Math.hypot(b.at[0] - at[0], b.at[1] - at[1]) < 120);
          if (!dup) bridges.push({ at, kind: ford ? 'ford' : 'river', route: r.id, ru: ford ? 'Брод' : 'Мост', length: Math.round(Math.hypot(start[0] - pts[k][0], start[1] - pts[k][1]) + 12) });
        }
      }
    }
    for (let k = 0; k + 1 < pts.length; k++) {
      const n = Math.ceil(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) / 2);
      for (let s = 0; s <= n; s++) paint(lerp(pts[k][0], pts[k + 1][0], s / n), lerp(pts[k][1], pts[k + 1][1], s / n), sg.mode === 'road' ? 1 : sg.mode === 'bridge' ? 2 : 3);
    }
    legs.push({ mode: sg.mode, label: sg.label, pts }); cur = sg.to;
  }
  routesOut.push({ id: r.id, ru: r.ru, kind: r.kind, note: r.note, legs, length: Math.round(length), maxSlopeDeg: 0 });
}
// Второстепенные дороги, тропы, караванные пути, заброшенные дороги (world/roads.ts)
const SIDE_DEG: Record<string, number> = { secondary: 25, forest_path: 28, mountain_path: 33, caravan: 22, abandoned: 28 };
const sideFails: string[] = [];
for (const r of SIDE_ROADS) {
  const legs: RouteOut['legs'] = []; let length = 0;
  for (let k = 0; k + 1 < r.pts.length; k++) {
    let raw = astar(r.pts[k], r.pts[k + 1], SIDE_DEG[r.kind], true);
    if (!raw.length) raw = astar(r.pts[k], r.pts[k + 1], 36, true);
    if (!raw.length) { sideFails.push(`${r.id}: ${r.pts[k]} → ${r.pts[k + 1]}`); continue; }
    const pts = smoothPath(raw);
    length += pts.reduce((acc, p, q) => q ? acc + Math.hypot(p[0] - pts[q - 1][0], p[1] - pts[q - 1][1]) : 0, 0);
    let inRiver = false, start: P = pts[0];
    for (let q = 0; q < pts.length; q++) {
      const w = water[idx(cxOf(pts[q][0]), cxOf(pts[q][1]))] === 2;
      if (w && !inRiver) { inRiver = true; start = pts[q]; }
      if (!w && inRiver) { inRiver = false; const at: P = [(start[0] + pts[q][0]) / 2, (start[1] + pts[q][1]) / 2]; if (!bridges.some(b => Math.hypot(b.at[0] - at[0], b.at[1] - at[1]) < 120)) bridges.push({ at, kind: r.kind === 'secondary' || r.kind === 'caravan' ? 'river' : 'ford', route: r.id, ru: r.kind === 'secondary' || r.kind === 'caravan' ? 'Мост' : 'Брод', length: Math.round(Math.hypot(start[0] - pts[q][0], start[1] - pts[q][1]) + 10) }); }
    }
    for (let q = 0; q + 1 < pts.length; q++) { const n = Math.ceil(Math.hypot(pts[q + 1][0] - pts[q][0], pts[q + 1][1] - pts[q][1]) / 2); for (let s2 = 0; s2 <= n; s2++) paint(lerp(pts[q][0], pts[q + 1][0], s2 / n), lerp(pts[q][1], pts[q + 1][1], s2 / n), 4); }
    legs.push({ mode: 'road', pts });
  }
  routesOut.push({ id: r.id, ru: r.ru, kind: r.kind, note: r.reason ?? '', legs, length: Math.round(length), maxSlopeDeg: 0 });
}
function smoothPath(p: P[]): P[] {
  if (p.length < 5) return p;
  let q = p.map(v => [v[0], v[1]] as P);
  for (let it = 0; it < 4; it++) q = q.map((v, k) => k === 0 || k === q.length - 1 ? v : [(q[k - 1][0] + 2 * v[0] + q[k + 1][0]) / 4, (q[k - 1][1] + 2 * v[1] + q[k + 1][1]) / 4] as P);
  return q;
}
// Профилирование полотна: сглаживаем высоты вдоль трассы и прорезаем/подсыпаем коридор 5 блоков.
for (const r of routesOut) {
  let maxSl = 0;
  for (const leg of r.legs) {
    if (leg.mode !== 'road') continue;
    const dense: P[] = []; for (let k = 0; k + 1 < leg.pts.length; k++) { const a = leg.pts[k], b = leg.pts[k + 1]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let s = 0; s < n; s++) dense.push([lerp(a[0], b[0], s / n), lerp(a[1], b[1], s / n)]); }
    dense.push(leg.pts[leg.pts.length - 1]);
    const raw = dense.map(([x, y]) => { const i = idx(cxOf(x), cxOf(y)); return water[i] === 2 ? NaN : sample(h, x, y); });
    // заполнение пролётов мостов линейно между берегами
    for (let k = 0; k < raw.length; k++) if (isNaN(raw[k])) { let e = k; while (e < raw.length && isNaN(raw[e])) e++; let a = k > 0 ? raw[k - 1] : raw[e], b = e < raw.length ? raw[e] : a; if (a === undefined || isNaN(a)) a = sample(h, dense[k][0], dense[k][1]); if (b === undefined || isNaN(b)) b = a; for (let j = k; j < e; j++) raw[j] = lerp(a, b, (j - k + 1) / (e - k + 1)); k = e; }
    let prof = raw.slice();
    for (let it = 0; it < 6; it++) prof = prof.map((v, k) => k === 0 || k === prof.length - 1 ? v : (prof[k - 1] + v + prof[k + 1]) / 3);
    for (let k = 0; k < dense.length; k++) {
      const [x, y] = dense[k]; const cx = cxOf(x), cy = cxOf(y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; const i = ny * N + nx; if (water[i]) continue; h[i] = lerp(h[i], prof[k], dx === 0 && dy === 0 ? 1 : 0.6); }
      if (k > 0) maxSl = Math.max(maxSl, Math.atan(Math.abs(prof[k] - prof[k - 1]) / Math.max(0.5, Math.hypot(x - dense[k - 1][0], y - dense[k - 1][1]))) * 180 / Math.PI);
    }
  }
  r.maxSlopeDeg = +maxSl.toFixed(1);
}
log('roads done');

// ───────────── 13. Проверки ─────────────
const fails: string[] = [];
// 13a. проценты биомов
const cnt = [0, 0, 0]; for (const i of landIdx) cnt[major[i]]++;
const landN = landIdx.length; const pct = cnt.map(c => +(100 * c / landN).toFixed(2));
const want = [55, 20, 25];
['green', 'winter', 'desert'].forEach((n, k) => { if (Math.abs(pct[k] - want[k]) > 1) fails.push(`биом ${n}: ${pct[k]}% (нужно ${want[k]}±1)`); });
// 13b. высоты по биомам
const hstat = [0, 1, 2].map(() => ({ max: -Infinity, mean: 0, at: [0, 0] as P }));
for (const i of landIdx) { const s = hstat[major[i]]; s.mean += h[i]; if (h[i] > s.max) { s.max = h[i]; s.at = [((i % N) + 0.5) * CS, (Math.floor(i / N) + 0.5) * CS]; } }
hstat.forEach((s, k) => { s.mean /= Math.max(1, cnt[k]); });
// 13c. монотонность рек (уровень воды) и русло ниже уровня воды
const riverChecks = riversOut.map(r => {
  let rises = 0, maxRise = 0, dry = 0; for (let k = 1; k < r.pts.length; k++) { const d = r.pts[k][2] - r.pts[k - 1][2]; if (d > 1e-6) { rises++; maxRise = Math.max(maxRise, d); } }
  for (const p of r.pts) if (sample(h, p[0], p[1]) > p[2] + 0.5) dry++;
  const len = r.pts.reduce((a, p, k) => k ? a + Math.hypot(p[0] - r.pts[k - 1][0], p[1] - r.pts[k - 1][1]) : 0, 0);
  if (rises) fails.push(`река ${r.ru}: уровень поднимается вниз по течению (${rises})`);
  return { id: r.id, ru: r.ru, source: r.pts[0].slice(0, 3).map(v => Math.round(v)), mouthAt: r.pts[r.pts.length - 1].slice(0, 3).map(v => Math.round(v)), mouth: r.mouth, lengthBlocks: Math.round(len), drop: Math.round(r.pts[0][2] - r.pts[r.pts.length - 1][2]), monotonic: rises === 0, maxRise, samplesWithBedAboveWater: dry };
});
// 13d. водопады — где уровень реки падает ≥ 10 блоков на 30 блоках течения
const waterfalls: { river: string; at: P; top: number; bottom: number; height: number }[] = [];
for (const r of riversOut) {
  const p = r.pts; let k = 0;
  while (k < p.length - 6) {
    if (p[k][2] - p[k + 6][2] >= 10) {
      let e = k + 6; while (e < p.length - 6 && p[e][2] - p[e + 6][2] >= 4) e += 1;
      const top = p[k][2], bottom = p[Math.min(e + 6, p.length - 1)][2];
      const mid = p[Math.floor((k + e) / 2)];
      waterfalls.push({ river: r.ru, at: [Math.round(mid[0]), Math.round(mid[1])], top: Math.round(top), bottom: Math.round(bottom), height: Math.round(top - bottom) });
      k = e + 6;
    } else k++;
  }
}
// 13e. проходимость: заливка от Зеленодола по уклону ≤ 40°
const WALK = Math.tan(40 * Math.PI / 180);
const reach = (useRoads: boolean) => {
  const seen = new Uint8Array(G * G); const st: number[] = [];
  const g0 = (p: P) => clamp(Math.floor(p[1] / GC), 0, G - 1) * G + clamp(Math.floor(p[0] / GC), 0, G - 1);
  const roadG = new Uint8Array(G * G);
  if (useRoads) for (let i = 0; i < N * N; i++) if (roadMask[i]) roadG[((Math.floor(i / N) >> 1) * G) + ((i % N) >> 1)] = 1;
  const s = g0(D.VILLAGES[0].at); seen[s] = 1; st.push(s);
  const tun = useRoads ? tunnels.map(t => [g0(t.a), g0(t.b)]) : [];
  while (st.length) {
    const c = st.pop()!; const cx = c % G, cy = (c / G) | 0;
    for (const [a, b] of tun) { const o = c === a ? b : c === b ? a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; st.push(o); } }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
      const n = ny * G + nx; if (seen[n] || gw[n] === 1) continue;
      const len = (dx && dy ? Math.SQRT2 : 1) * GC;
      const ok = Math.abs(gh[n] - gh[c]) <= WALK * len || (useRoads && roadG[n] && roadG[c]);
      if (ok) { seen[n] = 1; st.push(n); }
    }
  }
  return { seen, villages: Object.fromEntries(D.VILLAGES.map(v => [v.id, !!seen[g0(v.at)]])) };
};
const reachRoads = reach(true), reachTerrain = reach(false);
for (const [k, v] of Object.entries(reachRoads.villages)) if (!v) fails.push(`деревня ${k} недостижима от Зеленодола`);
// недоступные участки суши (компоненты), ранжированные по высоте
const unreach: { at: P; peakY: number; areaBlocks2: number; nearest: string }[] = [];
{
  const lab = new Uint8Array(G * G);
  for (let i = 0; i < G * G; i++) {
    if (lab[i] || reachRoads.seen[i] || gw[i] === 1) continue;
    const st = [i]; lab[i] = 1; let n = 0, top = -Infinity, at = i;
    while (st.length) { const c = st.pop()!; n++; if (gh[c] > top) { top = gh[c]; at = c; } const cx = c % G, cy = (c / G) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; const m = ny * G + nx; if (!lab[m] && !reachRoads.seen[m] && gw[m] !== 1) { lab[m] = 1; st.push(m); } } }
    if (n * GC * GC >= 3000) {
      const p: P = [Math.round((at % G + 0.5) * GC), Math.round((((at / G) | 0) + 0.5) * GC)];
      let nearest = '', nd = Infinity; for (const L of [...D.PEAKS, ...D.MESAS]) { const d = Math.hypot(L.at[0] - p[0], L.at[1] - p[1]); if (d < nd) { nd = d; nearest = L.ru; } }
      unreach.push({ at: p, peakY: Math.round(top), areaBlocks2: Math.round(n * GC * GC), nearest: nd < 500 ? nearest : '' });
    }
  }
  unreach.sort((a, b) => b.peakY - a.peakY);
}
// 13f. каньон преграждает путь: без мостов и пандусов Приют достижим только объездом
let unreachableLandPct = 0; { let u = 0, l = 0; for (let i = 0; i < G * G; i++) if (gw[i] !== 1) { l++; if (!reachRoads.seen[i]) u++; } unreachableLandPct = +(100 * u / l).toFixed(2); }

// ───────────── 14. Вывод ─────────────
const hU16 = new Uint16Array(N * N); for (let i = 0; i < N * N; i++) hU16[i] = clamp(Math.round(h[i] * 64), 0, 65535);
const heightHash = createHash('sha256').update(Buffer.from(hU16.buffer)).digest('hex');
// Рельеф утверждён и заморожен: tools/continent/frozen.json хранит хеш. Любое изменение высот — ошибка (если не передан --unfreeze).
const frozenPath = join(HERE, 'frozen.json');
if (existsSync(frozenPath) && !process.argv.includes('--unfreeze')) {
  const fr = JSON.parse(readFileSync(frozenPath, 'utf8'));
  if (fr.overview2048 !== heightHash) { console.error(`РЕЛЬЕФ ЗАМОРОЖЕН: хеш высот изменился (${heightHash} ≠ ${fr.overview2048}). Отмените изменения design.ts/bake.ts, влияющие на высоты.`); process.exit(2); }
}
const wU16 = new Uint16Array(N * N); for (let i = 0; i < N * N; i++) wU16[i] = water[i] ? clamp(Math.round(wlevel[i] * 64), 0, 65535) : 0;
writeFileSync(join(OUT, 'waterlevel_2048.png'), encodePNG(N, N, wU16, 1, 16));
writeFileSync(join(OUT, 'canyonmask_2048.png'), encodePNG(N, N, canyonMask, 1, 8));
writeFileSync(join(OUT, 'vectors.json'), JSON.stringify({
  rivers: riversOut.map(r => ({ id: r.id, pts: r.pts.map(p => p.map(v => +v.toFixed(2))) })),
  roads: routesOut.flatMap(r => r.legs.filter(l => l.mode === 'road').map(l => ({ route: r.id, kind: r.kind, pts: l.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]) }))),
  lakes: lakesOut, pads: padsOut, mesaFoot,
}));
writeFileSync(join(OUT, 'heightmap_2048.png'), encodePNG(N, N, hU16, 1, 16));
writeFileSync(join(OUT, 'biome_2048.png'), encodePNG(N, N, biome, 1, 8));
writeFileSync(join(OUT, 'water_2048.png'), encodePNG(N, N, water, 1, 8));
writeFileSync(join(OUT, 'roads_2048.png'), encodePNG(N, N, roadMask, 1, 8));
writeFileSync(join(OUT, 'regions_2048.png'), encodePNG(N, N, region, 1, 8));
const majorPng = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) majorPng[i] = major[i];
writeFileSync(join(OUT, 'major_biome_2048.png'), encodePNG(N, N, majorPng, 1, 8));
// для просмотрщика: высоты — сырой Uint16 LE (Y*64), индексы — PNG
writeFileSync(join(VDATA, 'height_2048.wasm'), Buffer.from(hU16.buffer));
// упакованные индексы: R = подбиом, G = вода, B = регион (255 = нет)
const pack = new Uint8Array(N * N * 3); for (let i = 0; i < N * N; i++) { pack[i * 3] = biome[i]; pack[i * 3 + 1] = water[i] | (roadMask[i] << 4); pack[i * 3 + 2] = region[i]; }
writeFileSync(join(VDATA, 'maps_2048.png'), encodePNG(N, N, pack, 3, 8));

const regionStats = D.REGIONS.map((r, k) => {
  let n = 0, minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, sx = 0, sy = 0, top = -Infinity; const bc = [0, 0, 0];
  for (const i of landIdx) if (region[i] === k) { const x = (i % N) * CS, y = Math.floor(i / N) * CS; n++; sx += x; sy += y; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); bc[major[i]]++; top = Math.max(top, h[i]); }
  const bn = ['green', 'winter', 'desert'][bc.indexOf(Math.max(...bc))];
  return { id: r.id, ru: r.ru, lv: r.lv, relief: r.relief, biome: bn, areaKm2Blocks: Math.round(n * CS * CS), bbox: [minx, miny, maxx, maxy].map(Math.round), centroid: n ? [Math.round(sx / n), Math.round(sy / n)] : r.seed, maxY: Math.round(top) };
});
const stats = {
  generatedBy: 'tools/continent/bake.ts', seed: SEED, world: W, grid: N, blocksPerSample: CS, seaLevel: SEA, heightEncoding: 'uint16 = round(Y*64)',
  landSharePct: +(100 * landN / (N * N)).toFixed(2),
  biomes: { landPct: { green: pct[0], winter: pct[1], desert: pct[2] }, target: { green: 55, winter: 20, desert: 25 }, thresholds: { TW, TD },
    maxY: { green: Math.round(hstat[0].max), winter: Math.round(hstat[1].max), desert: Math.round(hstat[2].max) },
    maxAt: { green: hstat[0].at.map(Math.round), winter: hstat[1].at.map(Math.round), desert: hstat[2].at.map(Math.round) },
    meanY: { green: Math.round(hstat[0].mean), winter: Math.round(hstat[1].mean), desert: Math.round(hstat[2].mean) } },
  subBiomes: SUB.map((n, k) => { let c = 0; for (const i of landIdx) if (biome[i] === k) c++; return { id: k, ru: n, landPct: +(100 * c / landN).toFixed(2) }; }).filter(s => s.landPct > 0),
  rivers: riverChecks, waterfalls, lakes: lakesOut, belowSeaDryCells: belowSeaDry,
  roads: routesOut.map(r => ({ id: r.id, ru: r.ru, kind: r.kind, lengthBlocks: r.length, maxGradedSlopeDeg: r.maxSlopeDeg })), maxRoadSlopeDeg: Math.max(...routesOut.map(r => r.maxSlopeDeg)),
  bridges, tunnels,
  reachability: { walkSlopeDeg: 40, grid: G, withRoads: reachRoads.villages, terrainOnly: reachTerrain.villages, unreachableLandPct, unreachableAreas: unreach.slice(0, 15) },
  regions: regionStats,
  heightHash: { overview2048: heightHash, encoding: 'sha256 of Uint16LE heightmap_2048 (Y*64)', frozen: existsSync(frozenPath), tiles1block: existsSync(frozenPath) ? JSON.parse(readFileSync(frozenPath, 'utf8')).tiles1block : null, tilesNote: 'sha256 по строкам «имя:sha256(высоты Uint16LE + материалы)» всех 1024 тайлов 256² (tiles.ts --all)' },
  erosion: erosionStats, villagePads: padsOut, sideRoadFailures: sideFails,
  checks: { failed: fails },
};
writeFileSync(join(DOCS, 'stats.json'), JSON.stringify(stats, null, 1));
const feat = {
  world: W, sea: SEA, grid: N, sub: SUB, stats: { biomes: stats.biomes, landSharePct: stats.landSharePct },
  rivers: riversOut.map(r => ({ id: r.id, ru: r.ru, pts: r.pts.filter((_, k) => k % 4 === 0 || k === r.pts.length - 1).map(p => p.map(v => Math.round(v * 10) / 10)) })),
  routes: routesOut.map(r => ({ id: r.id, ru: r.ru, kind: r.kind, note: r.note, legs: r.legs.map(l => ({ mode: l.mode, label: l.label, pts: l.pts.map(p => [Math.round(p[0]), Math.round(p[1])]) })) })),
  bridges, tunnels, passes: D.PASSES.map(p => ({ ru: p.ru, at: p.at })), villages: D.VILLAGES, landmarks: D.LANDMARKS, waterfalls, lakes: lakesOut,
  regions: regionStats.map((r, k) => ({ id: r.id, ru: r.ru, lv: r.lv, biome: REGION_POLYS[k].biome, centroid: r.centroid, poly: REGION_POLYS[k].poly })),
  ridges: D.RIDGES.map(r => ({ ru: r.ru, at: r.pts[Math.floor(r.pts.length / 2)].slice(0, 2) })),
  canyons: D.CANYONS.map(c => ({ ru: c.ru, pts: c.pts.map(p => [p[0], p[1]]) })),
  coastAreaCheck: Math.round(polyArea(D.COAST)),
};
writeFileSync(join(VDATA, 'features.json'), JSON.stringify(feat));
log('written', { biomes: stats.biomes.landPct, maxY: stats.biomes.maxY, maxRoadSlope: stats.maxRoadSlopeDeg, reach: stats.reachability.withRoads, terrainOnly: stats.reachability.terrainOnly });
console.log('waterfalls', waterfalls); console.log('bridges', bridges.map(b => `${b.ru}@${b.at.map(Math.round)}`).join('; '));
console.log('rivers', riverChecks.map(r => `${r.ru}: drop ${r.drop}, mono ${r.monotonic}, dry ${r.samplesWithBedAboveWater}`).join(' | '));
console.log('unreachable top', unreach.slice(0, 8));
if (fails.length) { console.error('ПРОВЕРКИ НЕ ПРОЙДЕНЫ:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('Все проверки пройдены.');
