/**
 * Hand-tuned 32×32 pixel-art icons for passive items and boss relics.
 *
 * Shapes are described as point tests on a 32×32 grid (evaluated at pixel centres) and painted
 * with 5-tone ramps: the item colour is expanded into a hue-shifted ramp (shadows lean toward
 * violet, highlights toward warm white) and fixed material ramps cover gold, steel, wood,
 * leather, bone, glass, stone and fire. Shading helpers add a top-left light gradient, bevel /
 * rim light at shape edges and a 50% checker dither on tone transitions. A final pass draws a
 * clean 1px dark outline and a soft drop-shadow row under the silhouette.
 */

type Test = (x: number, y: number) => boolean;
type Ramp = readonly string[];
type ColorFn = (x: number, y: number, fx: number, fy: number) => string | null | undefined;

const S = 32;
const OUTLINE = '#120d1c';
const SHADOW = 'rgba(6,4,12,0.45)';

// ------------------------------------------------------------------ colour
type RGB = [number, number, number];
const rgbOf = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mixRgb = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const css = (c: RGB) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const SHADE_TO: RGB = [34, 18, 56];
const LIGHT_TO: RGB = [255, 250, 232];

/** 5-tone hue-shifted ramp from a base colour: [deep, shadow, base, light, highlight]. */
function ramp(hex: number): Ramp {
  const c = rgbOf(hex);
  return [mixRgb(c, SHADE_TO, 0.62), mixRgb(c, SHADE_TO, 0.34), c, mixRgb(c, LIGHT_TO, 0.34), mixRgb(c, LIGHT_TO, 0.68)].map(css);
}

const GOLD: Ramp = ['#6b3a12', '#a8641c', '#e3a52c', '#ffd84d', '#fff4b4'];
const STEEL: Ramp = ['#2c3242', '#525c76', '#8a95ac', '#c4ccda', '#f2f6fc'];
const WOOD: Ramp = ['#3a200f', '#5e3519', '#8a5a32', '#b07a48', '#d8a870'];
const LEATHER: Ramp = ['#3a1c12', '#62321c', '#93522b', '#bd7a45', '#e2a86e'];
const BONE: Ramp = ['#54463a', '#8f7c62', '#cbb994', '#ebdfc2', '#fffbee'];
const GLASS: Ramp = ['#2e4a6a', '#5c86ae', '#9cc8e8', '#d4eeff', '#ffffff'];
const STONE: Ramp = ['#262632', '#43434f', '#666674', '#8f8f9e', '#babac8'];
const FIRE: Ramp = ['#7a1410', '#d23c18', '#ff8a2a', '#ffd04a', '#fff8d2'];
const IRON: Ramp = ['#141018', '#241e2a', '#3c3240', '#5a4c58', '#7e6e78'];
const PLUME: Ramp = ['#5e6c84', '#a2b2c8', '#d8e2ee', '#f2f6ff', '#ffffff'];
const VOID: Ramp = ['#0e081a', '#1e1434', '#33244e', '#56447a', '#8a78b4'];
const WHITE = '#fffdf6';
const DARK = '#1a1024';

// ------------------------------------------------------------------ shape tests (continuous coords)
const disc = (cx: number, cy: number, r: number): Test => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ell = (cx: number, cy: number, rx: number, ry: number): Test => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const ring = (cx: number, cy: number, r0: number, r1: number): Test => (x, y) => {
  const d = Math.hypot(x - cx, y - cy);
  return d >= r0 && d <= r1;
};
/** Pixel-aligned box: covers pixels x..x+w-1, y..y+h-1. */
const box = (x0: number, y0: number, w: number, h: number): Test => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
function poly(pts: number[]): Test {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
function segDist(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2));
  return Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
}
const seg = (x0: number, y0: number, x1: number, y1: number, r: number): Test => (x, y) => segDist(x, y, x0, y0, x1, y1) <= r;
/** Polyline with radius r. */
const path = (pts: number[], r: number): Test => (x, y) => {
  for (let i = 0; i + 3 < pts.length; i += 2) if (segDist(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= r) return true;
  return false;
};
const U = (...ts: Test[]): Test => (x, y) => ts.some((t) => t(x, y));
const I = (...ts: Test[]): Test => (x, y) => ts.every((t) => t(x, y));
const sub = (a: Test, ...b: Test[]): Test => (x, y) => a(x, y) && !b.some((t) => t(x, y));
/** Rotate a test by `deg` around (cx, cy). */
const rot = (t: Test, cx: number, cy: number, deg: number): Test => {
  const a = (-deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return (x, y) => t(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c);
};
/** Axis helper: returns t∈[0,1] along a→b and signed perpendicular distance d. */
function axis(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  return { len, at: (x: number, y: number) => ({ t: ((x - x0) * ux + (y - y0) * uy) / len, d: (x - x0) * -uy + (y - y0) * ux }) };
}
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------------ canvas context
interface ShadeOpts {
  /** base tone index (0..4), default 2 */
  b?: number;
  /** gradient strength across the shape (top-left lighter), default 1 */
  g?: number;
  /** light direction (toward the light), default up-left */
  dir?: [number, number];
  /** bevel: +1 on lit edges, −1 on shadow edges; default 1 */
  bevel?: number;
  /** checker dither on tone transitions, default true */
  dither?: boolean;
  /** extra per-pixel tone offset */
  tex?: (x: number, y: number) => number;
}

class Pix {
  col: (string | null)[] = new Array(S * S).fill(null);
  soft: boolean[] = new Array(S * S).fill(false);

  set(x: number, y: number, c: string | null | undefined, soft = false) {
    if (c === undefined || x < 0 || y < 0 || x >= S || y >= S) return;
    const i = y * S + x;
    this.col[i] = c;
    this.soft[i] = c === null ? false : soft;
  }
  get(x: number, y: number) {
    return x < 0 || y < 0 || x >= S || y >= S ? null : this.col[y * S + x];
  }
  px(x: number, y: number, c: string) {
    this.set(x, y, c);
  }
  /** Bresenham line in a single colour. */
  line(x0: number, y0: number, x1: number, y1: number, c: string, soft = false) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, soft);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  pts(list: number[], c: string, soft = false) {
    for (let i = 0; i < list.length; i += 2) this.set(list[i], list[i + 1], c, soft);
  }
  paint(t: Test, fn: ColorFn | string, soft = false) {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const fx = x + 0.5, fy = y + 0.5;
        if (!t(fx, fy)) continue;
        this.set(x, y, typeof fn === 'string' ? fn : fn(x, y, fx, fy), soft);
      }
  }
  fill(t: Test, c: string) {
    this.paint(t, c);
  }
  erase(t: Test) {
    this.paint(t, () => null);
  }
  /** Soft (un-outlined) translucent glow on empty pixels inside t. */
  glow(t: Test, c: string, alpha = 0.3) {
    const [r, g, b] = rgbOf(parseInt(c.slice(1), 16));
    const cc = `rgba(${r},${g},${b},${alpha})`;
    this.paint(t, (x, y) => (this.get(x, y) ? undefined : cc), true);
  }
  pick(r: Ramp, v: number, x: number, y: number, dither = true) {
    const n = r.length - 1;
    v = Math.max(0, Math.min(n, v));
    let i = Math.floor(v);
    const f = v - i;
    if (dither && f > 0.43 && f < 0.57) i += (x + y) & 1;
    else if (f >= 0.5) i++;
    return r[Math.min(n, i)];
  }
  /** Flat-lit shape with gradient + bevel + dither. */
  shade(t: Test, r: Ramp, o: ShadeOpts = {}) {
    const b = o.b ?? 2, g = o.g ?? 1, bev = o.bevel ?? 1, dither = o.dither ?? true;
    const [lx, ly] = o.dir ?? [-0.7, -0.7];
    let mn = Infinity, mx = -Infinity;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (t(x + 0.5, y + 0.5)) {
          const p = x * lx + y * ly;
          mn = Math.min(mn, p);
          mx = Math.max(mx, p);
        }
    if (mn === Infinity) return;
    const span = mx - mn || 1;
    this.paint(t, (x, y, fx, fy) => {
      let v = b + g * (((x * lx + y * ly - mn) / span) * 2 - 1);
      if (bev) {
        const lit = (lx < 0 && !t(fx - 1, fy)) || (ly < 0 && !t(fx, fy - 1)) || (lx > 0 && !t(fx + 1, fy)) || (ly > 0 && !t(fx, fy + 1));
        const dark = (lx < 0 && !t(fx + 1, fy)) || (ly < 0 && !t(fx, fy + 1)) || (lx > 0 && !t(fx - 1, fy)) || (ly > 0 && !t(fx, fy - 1));
        if (lit && !dark) v += bev;
        else if (dark && !lit) v -= bev;
      }
      if (o.tex) v += o.tex(x, y);
      return this.pick(r, v, x, y, dither);
    });
  }
  /** Spherical shading for round shapes, with specular and rim light. */
  ball(t: Test, cx: number, cy: number, rx: number, ry: number, r: Ramp, o: { b?: number; spec?: boolean; rim?: boolean; tex?: (x: number, y: number) => number } = {}) {
    const L = [-0.5, -0.62, 0.6];
    const ll = Math.hypot(L[0], L[1], L[2]);
    const b = o.b ?? 0;
    this.paint(t, (x, y, fx, fy) => {
      const nx = Math.max(-1, Math.min(1, (fx - cx) / rx)), ny = Math.max(-1, Math.min(1, (fy - cy) / ry));
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const d = (nx * L[0] + ny * L[1] + nz * L[2]) / ll;
      let v = 0.5 + Math.max(0, d) * 3.3 + b;
      if (o.rim !== false && nz < 0.45 && nx * 0.6 + ny * 0.8 > 0.55) v = Math.max(v, 1.7 + b);
      if (o.tex) v += o.tex(x, y);
      if (o.spec !== false && d > 0.93) return WHITE;
      return this.pick(r, v, x, y);
    });
  }
  /** Four-point sparkle (soft, never outlined). */
  sparkle(x: number, y: number, big = false, c = WHITE) {
    this.set(x, y, c, true);
    const arms = big ? 2 : 1;
    for (let i = 1; i <= arms; i++) {
      const cc = i === arms && big ? '#fff2b0' : c;
      this.set(x + i, y, cc, true);
      this.set(x - i, y, cc, true);
      this.set(x, y + i, cc, true);
      this.set(x, y - i, cc, true);
    }
  }
}

// ------------------------------------------------------------------ helpers shared by several icons
const heartShape = (cx: number, cy: number, s: number): Test =>
  U(disc(cx - 5 * s, cy - 3.5 * s, 6.2 * s), disc(cx + 5 * s, cy - 3.5 * s, 6.2 * s), poly([cx - 10.9 * s, cy - 1.8 * s, cx + 10.9 * s, cy - 1.8 * s, cx, cy + 11.5 * s]));

/** A feather along a→b; colour picked by fn(t, d, x, y). */
function feather(d: Pix, x0: number, y0: number, x1: number, y1: number, maxW: number, fn: (t: number, side: number, x: number, y: number, wN: number) => string | null, quill: Ramp, wave = 0) {
  const ax = axis(x0, y0, x1, y1);
  const t0 = 0.2;
  const width = (t: number) => {
    if (t < t0 || t > 1) return -1;
    const u = (t - t0) / (1 - t0);
    let w = maxW * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.55) * (u > 0.75 ? 1 - (u - 0.75) * 1.6 : 1);
    if (wave) w *= 1 + wave * Math.sin(u * 22);
    return w;
  };
  const vane: Test = (x, y) => {
    const { t, d: dd } = ax.at(x, y);
    const w = width(t);
    return w > 0 && Math.abs(dd) <= w;
  };
  d.paint(vane, (x, y, fx, fy) => {
    const { t, d: dd } = ax.at(fx, fy);
    return fn(t, dd, x, y, Math.abs(dd) / Math.max(0.5, width(t)));
  });
  // quill
  d.paint(seg(x0, y0, x0 + (x1 - x0) * 0.97, y0 + (y1 - y0) * 0.97, 0.75), (x, y, fx, fy) => {
    const { t } = ax.at(fx, fy);
    return t < t0 ? quill[2] : quill[4];
  });
}

// ------------------------------------------------------------------ glyphs
type Draw = (d: Pix, C: Ramp, hex: number) => void;

const ITEM: Record<string, Draw> = {
  // ---------------------------------------------------------------- passives
  crystal: (d, C) => {
    d.shade(poly([5, 19, 9, 13, 12.5, 16, 12.5, 28, 7, 28]), C, { b: 1.6, g: 0.8 });
    d.shade(poly([20, 16, 24.5, 9, 28, 14, 27, 27, 20, 28]), C, { b: 1.4, g: 0.8 });
    d.shade(poly([16, 1.5, 9.5, 9, 11, 26.5, 16, 30.5]), C, { b: 3, g: 0.6 });
    d.shade(poly([16, 1.5, 22.5, 9, 21, 26.5, 16, 30.5]), C, { b: 1.4, g: 0.6 });
    d.shade(poly([16, 6, 12.8, 11, 13.8, 24, 16, 27, 18.2, 24, 19.2, 11]), C, { b: 2.6, g: 0.9, bevel: 0.6 });
    d.line(13, 10, 13, 19, C[4]);
    d.line(14, 7, 15, 5, C[4]);
    d.px(13, 9, WHITE);
    d.px(10, 17, C[4]);
    d.px(25, 12, C[4]);
    d.sparkle(26, 4, true);
    d.sparkle(5, 8);
  },
  plate: (d, C) => {
    const torso = poly([5, 7, 11, 3.5, 14, 7, 18, 7, 21, 3.5, 27, 7, 26.5, 16, 24, 25, 16, 29.5, 8, 25, 5.5, 16]);
    d.shade(torso, C, { b: 2.1, g: 1.1 });
    // centre ridge and pectoral lines
    d.line(16, 8, 16, 28, C[4]);
    d.line(17, 8, 17, 28, C[1]);
    d.line(9, 15, 14, 17, C[1]);
    d.line(23, 15, 19, 17, C[1]);
    d.line(9, 14, 14, 16, C[3]);
    // belt
    d.shade(I(torso, box(5, 21, 22, 3)), LEATHER, { b: 2, g: 0.6, bevel: 0.6 });
    d.fill(box(15, 21, 3, 3), GOLD[3]);
    d.px(16, 22, GOLD[1]);
    // pauldrons
    d.ball(ell(7, 9, 4.2, 4.2), 6.5, 8, 4.2, 4.2, C, { b: 0.3 });
    d.ball(ell(25, 9, 4.2, 4.2), 24.5, 8, 4.2, 4.2, C, { b: 0 });
    // gold trim at collar
    d.line(11, 4, 14, 7, GOLD[3]);
    d.line(15, 7, 18, 7, GOLD[2]);
    d.line(19, 6, 21, 4, GOLD[2]);
    d.pts([7, 14, 25, 14, 10, 25, 22, 25], GOLD[3]);
    d.px(6, 7, WHITE);
  },
  heart: (d, C) => {
    const h = heartShape(16, 15, 1);
    d.shade(h, C, { b: 2, g: 1.3 });
    d.shade(heartShape(16, 15.5, 0.52), C, { b: 3.1, g: 0.8, bevel: 0.7 });
    // facet lines
    d.line(16, 21, 16, 26, C[1]);
    d.line(9, 13, 6, 12, C[3]);
    d.line(23, 13, 26, 12, C[1]);
    d.fill(ell(10, 8.5, 2.6, 1.6), C[4]);
    d.px(9, 8, WHITE);
    d.px(10, 8, WHITE);
    d.px(13, 13, WHITE);
    d.sparkle(26, 4, true);
  },
  boots: (d, C) => {
    // wind behind
    const W = C[4];
    d.line(1, 21, 7, 21, W, true);
    d.line(3, 25, 8, 25, C[3], true);
    d.line(2, 17, 5, 17, C[3], true);
    d.pts([1, 20, 0, 19, 1, 18], W, true);
    d.pts([2, 24], C[3], true);
    // wing feathers
    d.shade(poly([11, 7, 3, 2, 5, 7.5]), PLUME, { b: 2.6, g: 0.5 });
    d.shade(poly([11, 10, 1.5, 7, 4, 11.5]), PLUME, { b: 2.3, g: 0.5 });
    d.shade(poly([11, 13, 3, 12.5, 6, 15.5]), PLUME, { b: 2, g: 0.5 });
    // boot
    const boot = U(poly([10.5, 5, 20.5, 5, 20.5, 17, 25, 18.5, 28.5, 21.5, 28.5, 26, 10.5, 26]));
    d.shade(boot, C, { b: 2, g: 1.2 });
    d.shade(box(9, 3, 13, 4), C, { b: 3, g: 0.6 });
    d.line(10, 6, 20, 6, C[1]);
    d.shade(box(10, 26, 19, 3), LEATHER, { b: 1.5, g: 0.5 });
    d.fill(box(10, 26, 6, 3), LEATHER[1]);
    // laces / straps
    d.pts([18, 9, 19, 10, 18, 11, 18, 13, 19, 14, 18, 15], C[0]);
    d.line(11, 20, 19, 20, GOLD[2]);
    d.px(13, 20, GOLD[4]);
    d.line(22, 21, 26, 22, C[3]);
    d.px(27, 23, C[4]);
  },
  hourglass: (d, C) => {
    const top = I(ell(16, 9.5, 7, 6.5), box(9, 5, 14, 11));
    const bot = I(ell(16, 22.5, 7, 6.5), box(9, 17, 14, 10));
    const glass = U(top, bot, box(15, 14, 2, 4));
    d.shade(glass, GLASS, { b: 2.2, g: 1.2 });
    d.shade(I(top, (x, y) => y > 9), C, { b: 2.6, g: 0.8 });
    d.shade(I(bot, poly([8, 27, 24, 27, 19, 22, 16, 20.5, 13, 22])), C, { b: 2.3, g: 0.8 });
    d.line(16, 14, 16, 21, C[3]);
    d.px(15, 13, C[2]);
    d.px(16, 13, C[3]);
    d.line(11, 6, 11, 9, WHITE);
    d.line(11, 19, 11, 22, GLASS[4]);
    d.px(21, 11, GLASS[4]);
    // frame
    d.shade(box(7, 5, 2, 22), WOOD, { b: 2.3, g: 0.6 });
    d.shade(box(23, 5, 2, 22), WOOD, { b: 1.8, g: 0.6 });
    d.shade(box(5, 2, 22, 3), WOOD, { b: 2.6, g: 0.7 });
    d.shade(box(5, 27, 22, 3), WOOD, { b: 2, g: 0.7 });
    d.line(5, 2, 26, 2, GOLD[3]);
    d.line(5, 29, 26, 29, GOLD[1]);
    d.pts([5, 3, 26, 3, 5, 28, 26, 28], GOLD[2]);
    d.sparkle(28, 14);
  },
  lens: (d, C) => {
    // incoming white beam
    d.line(0, 18, 9, 16, WHITE);
    d.line(0, 17, 9, 15, '#e8ecff');
    // spectrum fan
    const bands = ['#ff4a5a', '#ff9a3a', '#ffe14a', '#5ee86b', '#4ab8ff', '#9a6bff'];
    bands.forEach((c, i) => d.line(21, 15 + (i >> 1), 30, 9 + i * 2.6 | 0, c));
    bands.forEach((c, i) => d.line(21, 16 + (i >> 1), 30, 10 + i * 2.6 | 0, c));
    // prism
    d.shade(poly([16, 3.5, 4.5, 26.5, 14, 26.5]), C, { b: 3.1, g: 0.8 });
    d.shade(poly([16, 3.5, 14, 26.5, 27.5, 26.5]), C, { b: 1.6, g: 0.8 });
    d.line(16, 4, 14, 25, C[4]);
    d.line(15, 5, 6, 24, C[4]);
    d.line(5, 26, 26, 26, C[0]);
    d.px(15, 6, WHITE);
    d.px(15, 7, WHITE);
    d.line(10, 16, 19, 16, C[4]);
  },
  quiver: (d, C) => {
    const fl = [ramp(0xe84a4a), PLUME, ramp(0x5ad1c8)];
    const arrows: [number, number][] = [[8, 2], [16, 1], [24, 2]];
    arrows.forEach(([tx, ty], i) => {
      d.line(11 + i * 5, 12, tx, ty + 3, WOOD[3]);
      const R = fl[i];
      const ang = Math.atan2(ty - 12, tx - (11 + i * 5));
      const deg = (ang * 180) / Math.PI + 90;
      d.shade(rot(poly([tx - 2.3, ty + 2, tx, ty - 0.5, tx + 2.3, ty + 2, tx + 2.3, ty + 7, tx, ty + 5.2, tx - 2.3, ty + 7]), tx, ty + 3, deg), R, { b: 2.4, g: 0.8 });
      d.paint(rot(seg(tx, ty, tx, ty + 6, 0.45), tx, ty + 3, deg), R[0]);
    });
    const tube = poly([9.5, 11, 22.5, 11, 21, 29.5, 11, 29.5]);
    d.shade(tube, C, { b: 2, g: 1.3, dir: [-1, -0.2] });
    d.fill(ell(16, 11.5, 6.5, 1.8), C[0]);
    d.shade(box(10, 13, 12, 2), GOLD, { b: 2.4, g: 0.8 });
    d.shade(box(11, 24, 10, 2), GOLD, { b: 2, g: 0.8 });
    for (let y = 16; y < 23; y += 2) d.px(13, y, C[4]);
    for (let y = 16; y < 23; y += 2) d.px(19, y + 1, C[1]);
    // strap
    d.line(22, 15, 26, 21, LEATHER[1]);
    d.line(26, 21, 25, 27, LEATHER[1]);
    d.line(23, 15, 27, 21, LEATHER[3]);
  },
  feather: (d, C) => {
    const bar = ramp(0x8a5a32);
    feather(d, 5, 29, 27, 3, 5.6, (t, s, x, y, wN) => {
      if (t > 0.58 && t < 0.62 && s > 1.2) return null;
      if (t > 0.36 && t < 0.39 && s < -1.5) return null;
      const band = Math.floor(t * 34 + Math.abs(s) * 0.45) % 3 === 0 && t < 0.9;
      const base = s < 0 ? 3 : 1.8;
      const v = base + (wN > 0.82 ? -0.7 : 0) + (t > 0.9 ? 0.8 : 0);
      return d.pick(band ? bar : C, band ? v - 0.6 : v, x, y);
    }, BONE);
    d.px(21, 9, WHITE);
    d.sparkle(7, 6);
  },
  candle: (d, C) => {
    const W = ramp(0xf2e4c4);
    // holder
    d.ball(ring(27, 21.5, 1.4, 3), 27, 21.5, 3, 3, GOLD);
    d.ball(ell(16, 26, 11.5, 3.6), 16, 25.5, 11.5, 4, GOLD);
    d.fill(ell(16, 25, 7, 1.6), GOLD[1]);
    // wax
    d.shade(box(12, 11, 8, 15), W, { b: 2.6, g: 1, dir: [-1, -0.3] });
    d.fill(ell(16, 11, 4, 1.4), W[4]);
    d.pts([12, 13, 12, 14, 12, 15, 12, 16, 19, 13, 19, 14, 15, 12], W[4]);
    d.px(12, 17, W[3]);
    d.line(16, 8, 16, 10, DARK);
    // flame
    d.shade(U(disc(16, 7, 3.3), poly([12.8, 7, 19.2, 7, 16.5, 0.5])), C, { b: 2.6, g: 1, bevel: 0.5 });
    d.fill(U(disc(16, 7.4, 2), poly([14.2, 7, 17.8, 7, 16.2, 2.8])), FIRE[3]);
    d.pts([16, 7, 15, 7, 16, 6, 16, 8], FIRE[4]);
    d.sparkle(24, 4);
  },
  clover: (d, C) => {
    d.paint(path([16, 17, 18, 22, 21, 26, 21, 30], 1), C[1]);
    d.line(17, 18, 19, 23, C[3]);
    const leaf = U(disc(13.4, 8, 3.9), disc(18.6, 8, 3.9), poly([9.6, 9, 22.4, 9, 16, 16.2]));
    for (const a of [-45, 45, 135, 225]) {
      const t = rot(leaf, 16, 16, a);
      d.shade(t, C, { b: a === -45 ? 2.8 : a === 225 ? 1.7 : 2.2, g: 0.9 });
    }
    for (const a of [-45, 45, 135, 225]) d.paint(rot(seg(16, 8.5, 16, 15, 0.5), 16, 16, a), C[1]);
    for (const a of [-45, 45, 135, 225]) d.paint(rot(I(ring(16, 11.5, 2.1, 2.9), (x, y) => y < 11), 16, 16, a), C[4]);
    d.px(15, 15, C[4]);
    d.px(16, 16, C[3]);
    d.sparkle(27, 4, true, '#fff2b0');
    d.sparkle(4, 27);
  },
  eye: (d, C) => {
    d.line(16, 1, 16, 5, GOLD[3], true);
    d.line(8, 3, 10, 7, GOLD[3], true);
    d.line(24, 3, 22, 7, GOLD[3], true);
    d.line(2, 10, 5, 11, GOLD[2], true);
    d.line(30, 10, 27, 11, GOLD[2], true);
    const almond = I(disc(16, 26.5, 16.5), disc(16, 5.5, 16.5));
    d.shade(almond, ramp(0x5a3a8a), { b: 2, g: 0.8 });
    const inner = I(disc(16, 27.6, 15.4), disc(16, 4.4, 15.4));
    d.shade(inner, BONE, { b: 3.2, g: 0.8, bevel: 0 });
    const iris = I(disc(16, 16, 6), inner);
    d.ball(iris, 16, 16, 6, 6, C, { spec: false, b: 0.3 });
    d.paint(I(ring(16, 16, 5.2, 6.1), inner), C[0]);
    d.fill(disc(16, 16, 2.6), DARK);
    d.fill(ell(14, 14, 1.4, 1.1), WHITE);
    d.px(18, 18, C[4]);
    d.px(19, 17, C[4]);
    d.paint(I(inner, (x, y) => !inner(x, y - 1.2)), (x, y) => (d.get(x, y) === DARK ? undefined : C[0]));
    d.fill(ell(16, 26, 1.6, 1.8), C[3]);
    d.px(16, 25, C[4]);
  },
  magnet: (d, C) => {
    const arch = I(ring(16, 13, 5, 11), (x, y) => y <= 13);
    const legs = U(box(5, 13, 6, 10), box(21, 13, 6, 10));
    d.shade(U(arch, legs), C, { b: 2, g: 1.1 });
    d.paint(I(ring(16, 13, 8.2, 9.2), (x, y) => y < 12 && x < 19), C[4]);
    d.line(7, 13, 7, 21, C[4]);
    d.line(23, 13, 23, 21, C[3]);
    d.shade(box(5, 23, 6, 6), STEEL, { b: 2.4, g: 0.9 });
    d.shade(box(21, 23, 6, 6), STEEL, { b: 2, g: 0.9 });
    d.line(5, 23, 10, 23, STEEL[4]);
    d.line(21, 23, 26, 23, STEEL[4]);
    // field sparks
    const Y = '#ffe66b';
    d.pts([13, 23, 14, 24, 13, 25, 14, 26, 13, 27], Y, true);
    d.pts([18, 23, 17, 24, 18, 25, 17, 26, 18, 27], Y, true);
    d.pts([15, 28, 16, 29, 16, 22], '#fff4c0', true);
    d.sparkle(28, 3, true);
  },
  moss: (d, C) => {
    d.shade(ell(16, 23.5, 12.5, 6.5), STONE, { b: 2, g: 1.2, tex: (x, y) => (hash(x, y, 3) < 0.15 ? -1 : 0) });
    const blob = U(disc(9.5, 18, 5), disc(16, 14.5, 6.2), disc(23, 17.5, 4.8), ell(16, 19.5, 11.5, 3.6));
    d.shade(blob, C, { b: 2.2, g: 1.1, tex: (x, y) => { const h = hash(x, y, 7); return h < 0.18 ? 1 : h > 0.85 ? -1 : 0; } });
    d.pts([6, 22, 6, 23, 11, 23, 11, 24, 11, 25, 20, 23, 20, 24, 25, 21, 25, 22, 25, 23], C[1]);
    d.pts([6, 24, 11, 26, 20, 25, 25, 24], C[2]);
    // sprouts
    d.line(15, 6, 16, 9, C[1]);
    d.pts([13, 5, 14, 5, 14, 6, 17, 4, 18, 4, 18, 5, 17, 5], C[3]);
    d.pts([13, 4, 18, 3], C[4]);
    // tiny flower
    const P = '#ff8ac8';
    d.pts([22, 11, 24, 11, 23, 10, 23, 12], P);
    d.px(23, 11, '#fff2a0');
    // healing plus
    d.pts([28, 4, 28, 5, 28, 6, 27, 5, 29, 5], C[4], true);
    d.pts([4, 9, 4, 10, 4, 11, 3, 10, 5, 10], C[3], true);
  },
  target: (d, C) => {
    const cx = 14.5, cy = 17.5;
    d.ball(disc(cx, cy, 12.5), cx, cy, 12.5, 12.5, C, { spec: false, b: 0.2 });
    d.shade(disc(cx, cy, 9.6), BONE, { b: 3, g: 0.8, bevel: 0 });
    d.shade(disc(cx, cy, 7), C, { b: 2.2, g: 0.8, bevel: 0 });
    d.shade(disc(cx, cy, 4.3), BONE, { b: 3.1, g: 0.6, bevel: 0 });
    d.shade(disc(cx, cy, 2.2), C, { b: 1.4, g: 0.4, bevel: 0 });
    d.paint(I(ring(cx, cy, 11.3, 12.6), (x, y) => x + y > 33), C[1]);
    // arrow
    d.line(15, 16, 26, 5, WOOD[2]);
    d.line(16, 16, 27, 5, WOOD[3]);
    d.px(15, 17, DARK);
    d.shade(poly([25, 7.5, 24, 3, 27.5, 1, 28, 5]), ramp(0xe84a4a), { b: 2.4, g: 0.6 });
    d.shade(poly([25.5, 8, 30, 7, 31, 4.5, 28.5, 4.5]), PLUME, { b: 2.4, g: 0.6 });
    d.px(9, 10, WHITE);
  },
  whetstone: (d, C) => {
    const tex = (x: number, y: number) => (hash(x, y, 11) < 0.14 ? -0.8 : hash(x, y, 12) < 0.08 ? 0.8 : 0);
    d.shade(poly([2.5, 19.5, 18.5, 12.5, 29.5, 17.5, 13.5, 24.5]), C, { b: 3.2, g: 0.5, tex });
    d.shade(poly([2.5, 19.5, 13.5, 24.5, 13.5, 29.5, 2.5, 24.5]), C, { b: 1.9, g: 0.4, tex });
    d.shade(poly([13.5, 24.5, 29.5, 17.5, 29.5, 22.5, 13.5, 29.5]), C, { b: 1.1, g: 0.4, tex });
    d.line(6, 20, 20, 14, C[4]);
    d.line(7, 21, 21, 15, ramp(0x6bb0ff)[3]);
    // blade on the stone
    const blade = seg(7, 4, 19, 15, 1.6);
    d.shade(blade, STEEL, { b: 2.4, g: 0.6, dir: [0.7, -0.7] });
    d.line(8, 4, 19, 14, STEEL[4]);
    d.paint(seg(3, 8.5, 9, 2.5, 1), (x, y) => GOLD[(x + y) % 3 === 0 ? 3 : 2]);
    d.paint(seg(2.5, 3, 5.5, 5.5, 1), LEATHER[2]);
    d.px(3, 3, LEATHER[4]);
    // sparks
    const Y = '#ffe66b';
    d.pts([21, 13, 23, 11, 24, 14, 26, 12, 22, 9, 27, 9], Y, true);
    d.pts([25, 10, 28, 12], '#fff8d0', true);
  },
  idol: (d, C) => {
    d.shade(box(6, 25, 20, 5), STONE, { b: 2, g: 0.8 });
    d.line(6, 25, 25, 25, STONE[4]);
    d.shade(poly([10, 15, 22, 15, 23.5, 25, 8.5, 25]), C, { b: 1.9, g: 1 });
    d.shade(poly([9.5, 6, 11.5, 0.5, 13.5, 4, 16, 0, 18.5, 4, 20.5, 0.5, 22.5, 6]), C, { b: 2.8, g: 0.7 });
    d.shade(U(ell(16, 10, 7.2, 6.4), box(7, 8, 2, 6), box(23, 8, 2, 6)), C, { b: 2.4, g: 1 });
    const RG = ramp(0xff3a5a);
    d.fill(box(11, 9, 4, 2), RG[2]);
    d.fill(box(17, 9, 4, 2), RG[2]);
    d.pts([11, 9, 17, 9], RG[4]);
    d.line(14, 14, 17, 14, C[0]);
    d.px(15, 12, C[1]);
    d.px(16, 12, C[1]);
    d.line(10, 19, 22, 19, C[1]);
    d.line(10, 18, 22, 18, C[3]);
    d.ball(disc(16, 21.8, 1.9), 16, 21.8, 1.9, 1.9, RG);
    d.sparkle(4, 5, true);
    d.sparkle(28, 13);
  },
  thorns: (d, C) => {
    const shirt = sub(
      U(poly([9, 5.5, 23, 5.5, 25, 9, 24.5, 28, 7.5, 28, 7, 9]), poly([9, 5.5, 2.5, 10, 3.5, 17, 8.5, 16]), poly([23, 5.5, 29.5, 10, 28.5, 17, 23.5, 16])),
      ell(16, 5.5, 3.6, 2.6),
    );
    d.shade(shirt, C, { b: 2.1, g: 1.1, dither: false, tex: (x, y) => ((x + (y % 2)) % 2 === 0 ? 0.6 : -0.4) });
    d.shade(I(shirt, box(0, 26, 32, 3)), LEATHER, { b: 2, g: 0.5 });
    d.shade(I(shirt, U(box(0, 15, 6, 3), box(26, 15, 6, 3))), LEATHER, { b: 2, g: 0.5 });
    d.line(13, 7, 19, 7, C[4]);
    const T = BONE;
    const spikes = [11, 5, 11, 3, 21, 5, 21, 3, 4, 10, 2, 9, 28, 10, 30, 9, 7, 19, 5, 19, 25, 19, 27, 19, 7, 24, 5, 24, 25, 24, 27, 24, 16, 28, 16, 30, 11, 28, 11, 30, 21, 28, 21, 30];
    for (let i = 0; i < spikes.length; i += 4) {
      d.line(spikes[i], spikes[i + 1], spikes[i + 2], spikes[i + 3], T[2]);
      d.px(spikes[i + 2], spikes[i + 3], T[4]);
    }
    d.pts([12, 12, 20, 12, 16, 17, 12, 21, 20, 21], T[3]);
    d.pts([12, 13, 20, 13, 16, 18, 12, 22, 20, 22], C[0]);
  },
  phoenix: (d) => {
    const PH = ['#5a0a14', '#b8201a', '#ff5a1a', '#ffa82a', '#ffe27a', '#fffbe0'];
    feather(d, 6, 29, 25, 3, 6.2, (t, s, x, y, wN) => {
      let v = 0.6 + t * 3.6 + (s < 0 ? 0.6 : 0) - wN * 0.9;
      if (wN > 0.78 && hash(x, y, 5) < 0.35) v += 1.2;
      return d.pick(PH, v, x, y);
    }, GOLD, 0.18);
    // flame tongues off the tip and edges
    d.paint(poly([24, 4, 27, 0.5, 26.5, 5, 30, 3, 26, 8]), (x, y) => d.pick(PH, 4.2, x, y));
    d.paint(poly([12, 16, 7, 11.5, 10, 18]), (x, y) => d.pick(PH, 2.2, x, y));
    d.paint(poly([21, 17, 26, 15, 21, 19.5]), (x, y) => d.pick(PH, 2.8, x, y));
    d.pts([5, 9, 28, 13, 9, 4, 30, 21, 3, 15], FIRE[3], true);
    d.pts([6, 10, 27, 12, 30, 22], FIRE[4], true);
    d.sparkle(18, 6, false, '#fffbe0');
  },
  fang: (d, C) => {
    d.paint(path([9, 5, 6, 2, 3, 1], 0.6), LEATHER[2]);
    d.paint(path([22, 5, 25, 2, 28, 1], 0.6), LEATHER[2]);
    const tooth = poly([8.5, 6, 21, 6, 24.5, 9.5, 26, 14, 25.5, 19, 23.5, 23.5, 20, 27.8, 20.4, 23, 19.8, 18.5, 17.5, 14, 13.5, 10, 9.5, 8]);
    d.shade(tooth, BONE, { b: 2.6, g: 1.2 });
    d.paint(path([12, 8.5, 17, 12, 20.5, 17, 21.5, 21], 0.5), BONE[4]);
    d.paint(path([24.5, 11, 24.5, 18, 23, 22], 0.5), BONE[1]);
    d.shade(I(tooth, (x, y) => y > 22.5 - (x - 20) * 0.3), C, { b: 2.2, g: 0.9 });
    d.paint(I(tooth, path([22, 15, 22.5, 20, 22, 23], 0.55)), C[2]);
    d.px(22, 15, C[3]);
    d.ball(disc(20.2, 30, 1.4), 19.9, 29.6, 1.4, 1.4, C);
    d.shade(box(8, 4, 15, 3), GOLD, { b: 2.4, g: 0.9 });
    d.pts([10, 5, 13, 5, 16, 5, 19, 5], GOLD[1]);
    d.sparkle(6, 24, false, C[4]);
  },
  gauntlet: (d, C) => {
    d.shade(poly([8.5, 21, 23.5, 21, 27, 30, 5, 30]), C, { b: 1.8, g: 1.1 });
    d.line(16, 23, 16, 29, C[3]);
    d.line(11, 23, 10, 29, C[1]);
    d.line(21, 23, 22, 29, C[1]);
    d.shade(poly([7, 17, 25, 17, 24, 21, 8, 21]), C, { b: 1.6, g: 0.8 });
    d.shade(box(8, 20, 16, 2), GOLD, { b: 2.3, g: 0.8 });
    const xs = [9.5, 14, 18.5, 23];
    xs.forEach((x, i) => d.shade(ell(x, 13, 2.3, 4.6), C, { b: 2.2 - i * 0.15, g: 0.9 }));
    xs.slice(1).forEach((x) => d.line(Math.round(x - 2.6), 9, Math.round(x - 2.6), 16, C[0]));
    xs.forEach((x) => d.ball(disc(x, 8, 2.6), x - 0.5, 7.4, 2.6, 2.6, C, { b: 0.4 }));
    xs.slice(1).forEach((x) => d.px(Math.round(x - 2.6), 9, C[0]));
    d.shade(poly([3.5, 13.5, 9.5, 13, 18.5, 15.5, 19, 19, 10, 19.5, 4, 18]), C, { b: 2.8, g: 0.9 });
    d.line(10, 15, 17, 16, C[4]);
    d.line(13, 18, 18, 18, C[1]);
    d.pts([11, 23, 16, 22, 21, 23], GOLD[3]);
    d.sparkle(28, 3, true);
  },
  rune: (d, C) => {
    const tex = (x: number, y: number) => (hash(x, y, 21) < 0.12 ? -0.8 : hash(x, y, 22) < 0.08 ? 0.7 : 0);
    const stone = poly([8, 3, 23.5, 2, 27.5, 7, 27, 26.5, 21, 30, 7, 29, 4.5, 24, 5, 8]);
    d.shade(stone, STONE, { b: 2.2, g: 1, tex });
    d.line(23, 4, 21, 7, STONE[0]);
    d.line(7, 23, 9, 26, STONE[0]);
    const glyph = path([16, 7, 16, 25], 0.6);
    const chevA = path([11.5, 12, 16, 7, 20.5, 12], 0.6);
    const chevB = path([11.5, 18.5, 16, 14, 20.5, 18.5], 0.6);
    const all = U(glyph, chevA, chevB);
    const near = (r: number): Test => (x, y) => {
      for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (all(x + ox, y + oy)) return true;
      return false;
    };
    d.paint(I(stone, near(2)), (x, y) => ((x + y) % 2 ? C[1] : undefined));
    d.paint(I(stone, near(1)), C[1]);
    d.paint(all, C[3]);
    d.pts([16, 7, 16, 8, 16, 14, 16, 15, 16, 20, 16, 21], WHITE);
    d.pts([10, 1, 22, 31], C[3], true);
    d.sparkle(29, 13, false, C[4]);
    d.sparkle(3, 4, false, C[4]);
  },
  charm: (d, C) => {
    for (let i = 0; i <= 10; i++) {
      d.px(4 + i, 1 + Math.round(i * 0.8), i % 2 ? GOLD[3] : GOLD[1]);
      d.px(27 - i, 1 + Math.round(i * 0.8), i % 2 ? GOLD[3] : GOLD[1]);
    }
    d.ball(ring(16, 11, 0.8, 2), 16, 11, 2, 2, GOLD);
    d.ball(disc(16, 20.5, 9.3), 16, 20.5, 9.3, 9.3, GOLD, { spec: false });
    d.paint(ring(16, 20.5, 6.6, 7.4), GOLD[1]);
    d.ball(disc(16, 20.5, 6.6), 16, 20.5, 6.6, 6.6, C, { spec: false, b: 0.2 });
    // ward star
    d.line(16, 15, 16, 26, C[4]);
    d.line(11, 20, 21, 20, C[4]);
    d.pts([14, 18, 18, 18, 14, 22, 18, 22], C[3]);
    d.px(16, 20, WHITE);
    d.px(13, 17, WHITE);
    d.pts([16, 12, 7, 20, 25, 20, 16, 29], GOLD[4]);
    d.pts([10, 14, 22, 14, 10, 27, 22, 27], GOLD[3]);
  },
  cskull: (d, C) => {
    d.shade(U(poly([8.5, 11, 11.5, 0.5, 14, 8]), poly([13.5, 8, 17.5, 0, 20.5, 8]), poly([19, 9, 24.5, 1.5, 24, 11])), C, { b: 2.8, g: 1 });
    d.paint(U(poly([10.5, 10, 11.5, 4, 13, 9]), poly([16, 8, 17.5, 3, 19, 8]), poly([21, 10, 23.5, 5, 22.5, 11])), C[4]);
    const BN = ramp(0xe0d8ea);
    const skull = U(disc(16, 14.5, 10), poly([9.5, 18, 22.5, 18, 21, 27.5, 11, 27.5]));
    d.shade(skull, BN, { b: 2.6, g: 1.1 });
    d.paint(path([20, 5, 21, 8, 19, 10, 20, 12], 0.5), BN[0]);
    for (const ex of [11.5, 20.5]) {
      d.fill(ell(ex, 15.5, 3, 2.8), '#1a0a2a');
      d.paint(disc(ex, 15.8, 1.6), C[2]);
      d.px(Math.floor(ex), 15, C[4]);
    }
    d.fill(poly([14.5, 21.5, 17.5, 21.5, 16, 18.5]), '#1a0a2a');
    d.line(11, 23, 20, 23, '#1a0a2a');
    for (let x = 11; x <= 20; x++) d.px(x, 24, x % 2 ? BN[3] : BN[1]);
    for (let x = 12; x <= 19; x++) d.px(x, 25, x % 2 ? BN[2] : BN[0]);
    d.paint(I(skull, (x, y) => y > 26), BN[1]);
    d.pts([26, 15, 27, 20, 4, 18, 5, 23], C[3], true);
  },
  banner: (d, C) => {
    const cloth = poly([7, 7, 27, 7, 27, 28, 22, 23.5, 17, 28, 12, 23.5, 7, 28]);
    d.shade(cloth, C, { b: 2.1, g: 0.8, tex: (x) => Math.sin((x - 7) * 0.55) * 0.9 });
    d.shade(box(7, 7, 20, 2), GOLD, { b: 2.4, g: 0.6 });
    // emblem: crossed swords
    d.line(12, 11, 21, 20, STEEL[4]);
    d.line(21, 11, 12, 20, STEEL[3]);
    d.pts([12, 18, 13, 19, 14, 20, 19, 18, 20, 19, 21, 20], GOLD[3]);
    d.pts([11, 21, 22, 21], GOLD[2]);
    d.ball(disc(16.5, 15.5, 1.7), 16.5, 15.5, 1.7, 1.7, GOLD);
    // pole
    d.shade(box(3, 4, 3, 27), WOOD, { b: 2.2, g: 0.6, dir: [-1, 0] });
    d.shade(box(3, 5, 26, 2), WOOD, { b: 2.4, g: 0.6 });
    d.shade(poly([4.5, -0.5, 7.5, 4, 1.5, 4]), GOLD, { b: 2.6, g: 0.6 });
    d.pts([28, 5, 28, 6], GOLD[3]);
    d.line(3, 29, 5, 29, GOLD[2]);
    // tassel
    d.pts([27, 9, 28, 10, 28, 11, 28, 12], GOLD[3]);
    d.pts([27, 13, 28, 13, 29, 13], GOLD[1]);
  },

  // ---------------------------------------------------------------- relics
  relic_spore_sac: (d, C) => {
    const pale = '#f0d8ff';
    d.pts([7, 6, 10, 3, 22, 2, 25, 6, 5, 11, 27, 11, 13, 1, 19, 4], pale, true);
    d.pts([8, 3, 24, 4, 26, 9, 6, 8], C[3], true);
    d.fill(box(9, 2, 2, 2), C[3]);
    d.fill(box(23, 6, 2, 2), C[4]);
    d.shade(poly([13, 3.5, 19, 3.5, 20, 9, 12, 9]), C, { b: 1.6, g: 0.8 });
    d.line(12, 7, 19, 7, LEATHER[3]);
    d.line(12, 8, 19, 8, LEATHER[1]);
    const sac = ell(16, 19, 11.5, 10.5);
    d.ball(sac, 15, 17, 11.5, 11, C, { spec: false, tex: (x, y) => (hash(x, y, 31) < 0.1 ? -0.7 : 0) });
    for (const [x, y, r] of [[10, 15, 2.3], [21, 13.5, 1.7], [20, 23, 2.6], [11.5, 24, 1.5], [25, 19, 1.3]] as const) {
      d.ball(disc(x, y, r), x - 0.4, y - 0.4, r, r, ramp(0xf2b8ff), { spec: false });
    }
    d.paint(path([14, 10, 13, 13, 14, 16], 0.5), C[1]);
    d.paint(path([18, 10, 20, 12, 22, 17, 25, 22], 0.5), C[1]);
    d.fill(ell(9.5, 12, 2, 1.2), C[4]);
    d.px(9, 11, WHITE);
  },
  relic_heartwood: (d, C) => {
    const h = heartShape(16, 16.5, 0.98);
    d.paint(h, (x, y, fx, fy) => {
      const r = Math.hypot(fx - 16, (fy - 14.5) * 1.15);
      const edge = !h(fx - 1.2, fy) || !h(fx + 1.2, fy) || !h(fx, fy - 1.2) || !h(fx, fy + 1.2);
      if (edge) return d.pick(WOOD, !h(fx - 1, fy) || !h(fx, fy - 1) ? 1.2 : 0.3, x, y);
      const band = Math.floor(r / 2.4) % 2;
      return d.pick(WOOD, 3 - band * 1.1 - r * 0.06 + (hash(x, y, 41) < 0.08 ? -0.6 : 0), x, y);
    });
    d.ball(disc(16, 14.8, 2.6), 15.6, 14.4, 2.6, 2.6, C, { b: 0.6 });
    d.paint(path([16, 8, 16.5, 5, 18, 3], 0.6), C[1]);
    d.shade(poly([17.5, 4.5, 21.5, 0.8, 26, 1.5, 22, 6]), C, { b: 2.7, g: 0.8 });
    d.shade(poly([16, 6, 11.5, 2, 7.5, 3.5, 11.5, 7.5]), C, { b: 2.2, g: 0.8 });
    d.line(18, 4, 23, 2, C[1]);
    d.line(15, 6, 11, 4, C[1]);
    d.sparkle(26, 9, false, C[4]);
  },
  relic_gutter_crown: (d, C) => {
    const rust = ramp(0x8a4a22);
    const tex = (x: number, y: number) => (hash(x, y, 51) < 0.1 ? -0.8 : 0);
    const spikes = poly([4.5, 18, 5.5, 8, 10.5, 13.5, 15, 4.5, 20, 13, 23, 10, 27.5, 8.5, 27.5, 18]);
    d.shade(spikes, C, { b: 2.4, g: 1, tex });
    d.shade(poly([4.5, 17, 27.5, 17, 26.5, 26.5, 5.5, 26.5]), C, { b: 2, g: 1, tex });
    d.paint(I(U(spikes, box(5, 17, 22, 10)), (x, y) => hash(x | 0, y | 0, 52) < 0.07), (x, y) => (d.get(x, y) ? rust[hash(x, y, 53) < 0.5 ? 1 : 2] : undefined));
    d.line(5, 17, 26, 17, C[4]);
    d.line(6, 25, 26, 25, C[0]);
    for (const [x, y] of [[5.5, 7.5], [15, 4], [27.5, 8]] as const) d.ball(disc(x, y, 1.5), x, y, 1.5, 1.5, C, { spec: false });
    // gems: dull green, empty socket, cracked red
    d.ball(disc(16, 21.5, 2.3), 15.5, 21, 2.3, 2.3, ramp(0x6a9a3a));
    d.fill(disc(10, 21.5, 1.6), DARK);
    d.ball(disc(22, 21.5, 1.6), 21.6, 21, 1.6, 1.6, ramp(0x9a3a3a), { spec: false });
    d.px(22, 21, DARK);
    // dent + grime drips
    d.pts([12, 18, 13, 19], C[0]);
    const G = ramp(0x7a9a3a);
    d.paint(path([8, 17, 8, 20, 8.5, 22], 0.6), G[2]);
    d.paint(path([19, 17, 19.5, 19], 0.6), G[2]);
    d.paint(path([25, 17, 24.5, 21, 25, 24], 0.6), G[1]);
    d.pts([8, 17, 19, 17, 25, 17], G[3]);
    d.ball(disc(8.5, 23.5, 1.2), 8.3, 23.3, 1.2, 1.2, G, { spec: false });
    // fly
    d.px(29, 3, DARK);
    d.pts([28, 2, 30, 2], '#cfe0f0', true);
  },
  relic_silent_bell: (d, C) => {
    d.ball(ring(16, 3.5, 1.1, 2.6), 16, 3.5, 2.6, 2.6, STEEL, { spec: false });
    const bell = U(ell(16, 11.5, 7.2, 6), poly([8.8, 11.5, 23.2, 11.5, 24, 21, 28.5, 25, 28.5, 27.5, 3.5, 27.5, 3.5, 25, 8, 21]));
    d.shade(bell, C, { b: 1.9, g: 1.7, dir: [-1, -0.25] });
    d.paint(path([11, 8, 10.5, 14, 10, 21, 7, 25], 0.6), C[4]);
    d.px(12, 7, WHITE);
    d.paint(path([22, 12, 22.5, 21, 25.5, 24.5], 0.5), C[0]);
    d.shade(box(3, 25, 26, 2), C, { b: 2.6, g: 1.4, dir: [-1, 0] });
    d.line(4, 25, 27, 25, C[4]);
    d.fill(ell(16, 28, 11, 1.4), DARK);
    // crack
    d.paint(path([19, 6, 17.5, 10, 19.5, 13, 18, 17], 0.5), DARK);
    // linen gag wrapped around the bell
    const L = ramp(0xe8dcc0);
    d.shade(seg(6, 19.5, 26, 14.5, 1.6), L, { b: 2.4, g: 0.8 });
    d.paint(path([8, 20, 7, 24, 9, 26], 0.6), L[2]);
    d.paint(path([9, 20, 11, 24], 0.6), L[1]);
    d.ball(disc(8.5, 19.5, 1.8), 8, 19, 1.8, 1.8, L, { spec: false });
  },
  relic_colossus_marrow: (d, C) => {
    const M = ['#5a0a1a', '#b81e3a', '#ff4a5a', '#ff9a8a', '#ffe4d4'];
    const ax = axis(7, 25, 22.5, 9.5);
    const shaft = (x: number, y: number) => {
      const { t } = ax.at(x, y);
      return segDist(x, y, 7, 25, 22.5, 9.5) <= 3.1 + Math.abs(t - 0.45) * 2.6 && t < 1 - ((Math.floor(x) + Math.floor(y)) % 3) * 0.04;
    };
    const knob = U(disc(4.5, 23.5, 3.4), disc(8.5, 27.5, 3.4));
    d.shade(U(shaft, knob), C, { b: 2.4, g: 1.3 });
    d.line(6, 22, 18, 10, C[4]);
    d.paint(path([10, 25, 20, 15], 0.5), C[1]);
    // broken end: marrow
    d.ball(ell(22.5, 9.5, 3.1, 3.1), 22, 9, 3, 3, M, { spec: false, b: 0.6 });
    d.ball(disc(22.3, 9.3, 1.6), 22, 9, 1.6, 1.6, M, { b: 1.4 });
    d.pts([26, 6, 27, 5, 25, 4], C[3]);
    // dripping marrow
    d.pts([25, 12, 25, 13, 26, 14], M[2]);
    d.px(26, 16, M[3]);
    d.sparkle(29, 2, false, M[4]);
  },
  relic_phylactery: (d, C) => {
    const body = ell(16, 19.5, 9, 9.5);
    d.shade(U(body, box(13, 6, 6, 5)), GLASS, { b: 1.8, g: 1 });
    const liquid = I(body, (x, y) => y > 14 + Math.sin(x * 0.9) * 0.6);
    d.ball(liquid, 15, 19, 8.5, 8.5, C, { spec: false, b: 0.6 });
    // ghostly soul face
    d.pts([13, 19, 14, 19, 18, 19, 19, 19], C[0]);
    d.pts([13, 18, 19, 18], C[1]);
    d.pts([15, 22, 16, 22, 17, 22], C[1]);
    d.pts([15, 23, 17, 23], C[0]);
    d.pts([10, 16, 21, 24], WHITE);
    d.pts([12, 25, 22, 17], C[4]);
    d.line(11, 13, 10, 17, GLASS[4]);
    // gold cage
    d.shade(box(11, 3, 10, 3), GOLD, { b: 2.4, g: 0.8 });
    d.ball(disc(16, 1.8, 1.5), 16, 1.6, 1.5, 1.5, GOLD);
    d.shade(I(body, box(0, 13, 32, 2)), GOLD, { b: 2.2, g: 0.8 });
    d.paint(I(body, path([16, 14, 16, 29], 0.5)), GOLD[2]);
    d.shade(poly([10, 27, 22, 27, 24.5, 30, 7.5, 30]), GOLD, { b: 2, g: 0.8 });
    d.pts([16, 20], C[4]);
  },
  relic_forge_heart: (d, C) => {
    const h = heartShape(16, 16.5, 0.98);
    d.shade(h, IRON, { b: 2.2, g: 1.2 });
    const cracks = U(path([10, 9, 13, 13, 11, 17, 14, 21, 16, 26], 0.55), path([13, 13, 18, 14, 22, 10], 0.55), path([18, 14, 19.5, 19, 23, 17.5], 0.55), path([7, 14, 11, 17], 0.5));
    const near = (r: number): Test => (x, y) => cracks(x, y) || cracks(x + r, y) || cracks(x - r, y) || cracks(x, y + r) || cracks(x, y - r);
    d.paint(I(h, near(1.6)), (x, y) => ((x + y) % 2 ? FIRE[0] : FIRE[1]));
    d.paint(I(h, near(0.8)), FIRE[2]);
    d.paint(I(h, cracks), FIRE[3]);
    d.ball(disc(16.5, 15.5, 2.6), 16, 15, 2.6, 2.6, FIRE, { b: 0.8 });
    d.pts([8, 8, 7, 9, 22, 8], IRON[4]);
    // iron bands
    d.pts([4, 13, 5, 13, 27, 13, 26, 13], IRON[3]);
    // rising sparks
    d.pts([10, 3, 21, 1, 24, 4, 14, 0, 6, 6, 27, 7], FIRE[3], true);
    d.pts([17, 3, 26, 2], FIRE[4], true);
  },
  relic_wyrm_scale: (d, C) => {
    const sc = poly([4.5, 7, 16, 1.5, 27.5, 7, 26.5, 17, 16, 30.5, 5.5, 17]);
    const tex = (x: number, y: number) => {
      const v = Math.abs(x + 0.5 - 16) * 0.85 + (y + 0.5);
      const m = ((v % 7) + 7) % 7;
      return m < 1 ? -1.3 : m < 2 ? 0.9 : 0;
    };
    d.shade(sc, C, { b: 2.1, g: 1.3, tex });
    d.line(16, 3, 16, 28, C[4]);
    d.line(17, 4, 17, 28, C[1]);
    d.fill(ell(10, 7.5, 2.4, 1.3), C[4]);
    d.px(9, 7, WHITE);
    d.px(10, 7, WHITE);
    d.pts([28, 22, 4, 24], FIRE[3], true);
    d.sparkle(28, 2, false, FIRE[4]);
  },
  relic_yeti_pelt: (d, C) => {
    const body = U(
      ell(16, 19, 8.6, 9.5),
      poly([10, 12, 3, 7, 1.5, 11, 8.5, 17]),
      poly([22, 12, 29, 7, 30.5, 11, 23.5, 17]),
      poly([9.5, 22, 2, 26, 3.5, 29.5, 11, 27]),
      poly([22.5, 22, 30, 26, 28.5, 29.5, 21, 27]),
      ell(16, 8, 6.6, 4.6),
      poly([9.5, 6, 9, 2.5, 12.5, 4.5]),
      poly([22.5, 6, 23, 2.5, 19.5, 4.5]),
    );
    const shag: Test = (x, y) => body(x, y) && !(!body(x, y - 1.5) && hash(Math.floor(x), Math.floor(y), 61) < 0.45) && !(!body(x + 1.5, y) && hash(Math.floor(x), Math.floor(y), 62) < 0.35);
    d.shade(shag, C, { b: 2, g: 1.2, tex: (x, y) => { const h = hash(x, Math.floor(y / 3), 63); return h < 0.28 ? -1 : h > 0.8 ? 0.8 : 0; } });
    d.paint(I(body, path([16, 14, 16, 28], 0.5)), C[1]);
    d.pts([2, 7, 1, 9, 1, 10, 29, 7, 30, 9, 30, 10, 2, 28, 3, 29, 29, 28, 28, 29], '#3a4458');
    // horns
    d.shade(poly([10, 5, 6, 0.8, 8, 4.5]), BONE, { b: 2.6, g: 0.6 });
    d.shade(poly([22, 5, 26, 0.8, 24, 4.5]), BONE, { b: 2.2, g: 0.6 });
    // face: blue-grey muzzle with closed eyes and a fang
    const FACE = ramp(0x6a7ea0);
    d.shade(ell(16, 9.2, 4.2, 3), FACE, { b: 2, g: 0.9 });
    d.pts([13, 8, 14, 8, 17, 8, 18, 8], FACE[0]);
    d.pts([15, 10, 16, 10], DARK);
    d.pts([14, 11, 17, 11], WHITE);
    d.sparkle(27, 17, false, '#e0f4ff');
  },
  relic_frozen_tear: (d, C) => {
    const tear = U(disc(16, 19.5, 8.8), poly([7.6, 17.5, 24.4, 17.5, 16, 1.5]));
    d.shade(tear, C, { b: 2.2, g: 1.4 });
    d.shade(poly([16, 7, 21.5, 17.5, 16, 26, 10.5, 17.5]), C, { b: 3, g: 0.9, bevel: 0.6 });
    d.line(16, 3, 16, 7, C[4]);
    d.line(16, 26, 16, 27, C[1]);
    d.line(10, 18, 8, 20, C[1]);
    d.line(22, 18, 24, 20, C[0]);
    d.line(11, 13, 13, 9, WHITE);
    d.px(11, 14, C[4]);
    d.px(13, 15, WHITE);
    // frost
    const F = '#e8f8ff';
    for (const [x, y] of [[26, 6], [5, 9], [27, 24]] as const) {
      d.pts([x, y - 2, x, y - 1, x, y + 1, x, y + 2, x - 2, y, x - 1, y, x + 1, y, x + 2, y], F, true);
      d.pts([x - 1, y - 1, x + 1, y - 1, x - 1, y + 1, x + 1, y + 1], C[3], true);
      d.px(x, y, WHITE);
    }
  },
  relic_mainspring: (d, C) => {
    const gear = (x: number, y: number) => {
      const r = Math.hypot(x - 16, y - 16);
      const a = Math.atan2(y - 16, x - 16);
      return r <= 11.6 || (r <= 14.2 && Math.cos(a * 10) > 0.25);
    };
    d.ball(gear, 16, 16, 14.5, 14.5, STEEL, { spec: false, b: -0.3 });
    d.fill(disc(16, 16, 10.4), IRON[1]);
    const k = 2.9;
    const spiral = (x: number, y: number) => {
      const r = Math.hypot(x - 16, y - 16);
      if (r < 2 || r > 10.2) return false;
      const a = (Math.atan2(y - 16, x - 16) + Math.PI) / (2 * Math.PI);
      const ph = (((r - k * a) % k) + k) % k;
      return ph < 1.6;
    };
    d.paint(spiral, (x, y, fx, fy) => {
      const lit = !spiral(fx - 0.9, fy - 0.9);
      const dark = !spiral(fx + 0.9, fy + 0.9);
      return d.pick(C, 2.2 + (lit ? 1.2 : 0) - (dark ? 0.9 : 0) + (fx + fy < 30 ? 0.3 : -0.3), x, y, false);
    });
    // outer hook end
    d.paint(path([25.5, 16, 27, 12, 25, 9.5], 0.7), C[3]);
    d.ball(disc(16, 16, 2.2), 15.6, 15.6, 2.2, 2.2, STEEL);
    d.fill(box(15, 15, 2, 2), DARK);
    d.pts([5, 9, 27, 23], STEEL[4]);
    d.sparkle(28, 3, false, GOLD[4]);
  },
  /** Enhancement stone: a rough slate shard with a faceted crystal of the tier colour growing out of it. */
  enh_stone: (d, C) => {
    const tex = (x: number, y: number) => (hash(x, y, 41) < 0.14 ? -0.8 : hash(x, y, 42) < 0.07 ? 0.6 : 0);
    const rock = poly([3.5, 21, 8, 15.5, 14, 17, 19, 14.5, 26, 16.5, 29, 22, 26.5, 28.5, 16, 30, 6, 28.5]);
    d.shade(rock, STONE, { b: 1.9, g: 1, tex });
    d.line(9, 21, 13, 24, STONE[0]);
    d.line(21, 20, 24, 26, STONE[0]);
    // main crystal: tall hexagonal prism, left face lit, right face in shadow
    const left = poly([10.5, 22, 10.5, 9, 15.5, 3, 15.5, 24]);
    const right = poly([15.5, 3, 20.5, 9, 20.5, 22, 15.5, 24]);
    d.shade(left, C, { b: 3, g: 0.8 });
    d.shade(right, C, { b: 1.6, g: 0.6 });
    d.line(15, 4, 15, 23, C[4]);
    d.line(16, 4, 16, 23, C[1]);
    d.line(11, 10, 15, 5, C[4]);
    // small side crystals
    d.shade(poly([20, 23, 22, 15.5, 25.5, 13, 26, 21, 23.5, 24]), C, { b: 2.2, g: 1 });
    d.line(22, 16, 25, 14, C[4]);
    d.shade(poly([6, 23, 6.5, 17, 9, 14.5, 11, 18, 10.5, 23.5]), C, { b: 2, g: 1 });
    d.line(7, 17, 9, 15, C[4]);
    d.pts([12, 12, 13, 15, 12, 18], C[4]);
    d.glow(disc(15.5, 13, 9), C[3], 0.18);
    d.sparkle(26, 6, true, C[4]);
    d.sparkle(5, 9, false, C[4]);
  },
  relic_hollow_crown: (d, C) => {
    const spikes = poly([4.5, 17, 5.5, 5.5, 10.5, 12, 16, 2.5, 21.5, 12, 26.5, 5.5, 27.5, 17]);
    d.shade(spikes, VOID, { b: 2.3, g: 1 });
    d.paint(path([5.5, 6, 10.5, 12, 16, 3], 0.5), VOID[4]);
    d.paint(path([16, 3, 21.5, 12, 26.5, 6], 0.5), VOID[3]);
    // the hollow: void inside the rim
    d.fill(ell(16, 16, 10.6, 3.2), '#07030f');
    d.pts([12, 15, 19, 16, 22, 15, 9, 16], C[3]);
    d.px(15, 16, C[4]);
    const band = (x: number, y: number) => {
      const u = (x - 16) / 11;
      if (Math.abs(u) > 1) return false;
      const k = Math.sqrt(1 - u * u);
      return y >= 16 + 3.2 * k && y <= 24.5 + 2.6 * k;
    };
    d.shade(band, VOID, { b: 2.2, g: 1.1 });
    d.paint((x, y) => band(x, y) && !band(x, y - 1), C[3]);
    d.paint((x, y) => band(x, y) && !band(x, y + 1), VOID[0]);
    for (const [x, y, r] of [[16, 22.5, 2.4], [9.5, 21.5, 1.7], [22.5, 21.5, 1.7]] as const) d.ball(disc(x, y, r), x - 0.3, y - 0.3, r, r, C);
    for (const [x, y] of [[5.5, 5], [16, 2.2], [26.5, 5]] as const) d.ball(disc(x, y, 1.6), x, y, 1.6, 1.6, C);
  },
};

export function hasItemIcon(id: string): boolean {
  return id in ITEM;
}

/** Renders a 32×32 item icon onto a new canvas, or returns null when no art exists for `id`. */
export function drawItemIcon(id: string, color: number, silhouette = false): HTMLCanvasElement | null {
  const fn = ITEM[id];
  if (!fn) return null;
  const d = new Pix();
  fn(d, ramp(color), color);
  if (silhouette) {
    for (let i = 0; i < S * S; i++) {
      if (d.soft[i]) d.col[i] = null;
      else if (d.col[i]) {
        const x = i % S, y = (i / S) | 0;
        d.col[i] = y > 0 && !d.col[i - S] ? '#4a4e64' : x > 0 && !d.col[i - 1] ? '#3c4054' : '#30334a';
      }
    }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && !!d.col[y * S + x] && !d.soft[y * S + x];
  // outline & shadow maps
  const outline: boolean[] = new Array(S * S).fill(false);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) outline[y * S + x] = true;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && (solid(x, y) || outline[y * S + x]);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (outline[i]) {
        g.fillStyle = silhouette ? '#0a0810' : OUTLINE;
        g.fillRect(x, y, 1, 1);
      } else if (d.col[i]) {
        g.fillStyle = d.col[i]!;
        g.fillRect(x, y, 1, 1);
      }
      if (!filled(x, y) && filled(x, y - 1) && !d.col[i]) {
        g.fillStyle = SHADOW;
        g.fillRect(x, y, 1, 1);
      }
    }
  return cv;
}
