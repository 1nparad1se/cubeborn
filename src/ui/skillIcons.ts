/**
 * Hand-made 24×24 pixel-art ability icons for every class skill, Identity and Awakening (plus dodge).
 * Each icon is a framed tile: a dark vignette tinted with the skill's colour, a chunky
 * foreground glyph with an automatic dark outline, and a bevelled border. Awakenings (`*_ult`)
 * get a brighter centre and a gold frame, Identities (`*_id`) a thin tinted inner frame.
 * Ids are `sk_<icon>` where `<icon>` is the `icon` field of the class data
 * (`<class>_basic|q|w|e|r|a|s|d|f|ult|id|dodge`, `summoner_x`). Cached as data URLs.
 */

const N = 24;

type C = string;
interface P {
  /** pixel */
  p(x: number, y: number, c: C): void;
  r(x: number, y: number, w: number, h: number, c: C): void;
  l(x0: number, y0: number, x1: number, y1: number, c: C, w?: number): void;
  o(cx: number, cy: number, r: number, c: C): void;
  ring(cx: number, cy: number, r: number, c: C, w?: number): void;
  /** polygon fill */
  poly(pts: number[], c: C): void;
  c: C;
  lt: C;
  dk: C;
  wh: C;
}

function mix(hex: number, k: number): C {
  let r = (hex >> 16) & 255;
  let g = (hex >> 8) & 255;
  let b = hex & 255;
  if (k > 0) {
    r += (255 - r) * k;
    g += (255 - g) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    g *= 1 + k;
    b *= 1 + k;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const PI = Math.PI;
const FIRE = ['#fff3b0', '#ffc23a', '#ff7a1a', '#d8361a'];
const ICE = ['#ffffff', '#c8f0ff', '#6cc8ff', '#2a74c8'];
const BOLT = ['#ffffff', '#c8f4ff', '#4ad0ff'];
const HOLY = ['#fffbe0', '#ffe48a', '#ffbe3a'];
const BONE = ['#f4efe0', '#cfc6ae', '#8a8270'];
const STEEL = ['#f0f4f8', '#b8c0cc', '#6a7484'];
const WOOD = ['#c08a52', '#8a5a32', '#5a3a1e'];
const POISON = ['#e8ffb0', '#9cff4f', '#3aa02a'];
const DARK = ['#d8b0ff', '#a070ff', '#5a2aa0', '#2a1050'];
const BLOOD = ['#ffb0a0', '#ff3040', '#a01020'];
const SPIRIT = ['#ffffff', '#b0fff0', '#4ae0c0', '#1a8a78'];
const ARCANE = ['#ffffff', '#f0c8ff', '#c070ff', '#7030c0'];
const SEAL = ['#ffffff', '#c0f8ff', '#5ad8ff', '#2a8ab8'];
const GOLD = ['#fff4c0', '#ffd060', '#c08a20'];
const STONE = ['#c8c0b0', '#9a9080', '#6a6258', '#45403a'];
const SKIN = ['#ffe0c0', '#f0c090', '#c08a60'];
const INK = '#14101c';

// ------------------------------------------------------------------ drawing helpers

/** Arc outline from angle a0 to a1 (radians, y down). */
function arc(d: P, cx: number, cy: number, r: number, a0: number, a1: number, c: C, w = 1): void {
  for (let k = 0; k < w; k++) {
    const rr = r + k;
    const n = Math.ceil(Math.abs(a1 - a0) * rr * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      d.p(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, c);
    }
  }
}

/** Tapered crescent (a slash trail) along an arc; `hi` paints the outer edge. */
function cres(d: P, cx: number, cy: number, r: number, a0: number, a1: number, th: number, c: C, hi?: C): void {
  const n = Math.ceil(Math.abs(a1 - a0) * (r + th) * 2.2) + 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const w = th * Math.sin(PI * t);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let k = 0; k <= w; k += 0.5) d.p(cx + ca * (r + k), cy + sa * (r + k), c);
    if (hi && w >= 0.8) d.p(cx + ca * (r + w), cy + sa * (r + w), hi);
  }
}

/** Straight lens-shaped slash streak. */
function slash(d: P, x0: number, y0: number, x1: number, y1: number, th: number, c: C, hi?: C): void {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / L;
  const ny = (x1 - x0) / L;
  const n = Math.ceil(L * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const w = (th * Math.sin(PI * t)) / 2;
    for (let k = -w; k <= w; k += 0.5) d.p(x + nx * k, y + ny * k, c);
  }
  if (hi) for (let i = 2; i <= n - 2; i++) d.p(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, hi);
}

/** Blade from hilt (hx,hy) to tip (tx,ty); hw = half width. */
function sword(d: P, hx: number, hy: number, tx: number, ty: number, hw = 1.5, B: C[] = STEEL, guard: C = '#c89048', grip: C = WOOD[1], gl = 3): void {
  const L = Math.hypot(tx - hx, ty - hy);
  const ux = (tx - hx) / L;
  const uy = (ty - hy) / L;
  const nx = -uy;
  const ny = ux;
  if (gl > 0) {
    d.l(hx - ux * gl, hy - uy * gl, hx - ux, hy - uy, grip, hw >= 2 ? 2 : 1);
    d.p(hx - ux * (gl + 1), hy - uy * (gl + 1), guard);
  }
  const tb = L - hw * 1.8;
  d.poly(
    [hx + nx * hw, hy + ny * hw, hx + ux * tb + nx * hw, hy + uy * tb + ny * hw, tx + ux * 0.5, ty + uy * 0.5, hx + ux * tb - nx * hw, hy + uy * tb - ny * hw, hx - nx * hw, hy - ny * hw],
    B[1],
  );
  if (hw >= 1.2) d.l(hx - nx * (hw - 0.6) + ux, hy - ny * (hw - 0.6) + uy, hx + ux * tb - nx * (hw - 0.6), hy + uy * tb - ny * (hw - 0.6), B[2]);
  d.l(hx + ux, hy + uy, hx + ux * (tb + 0.5), hy + uy * (tb + 0.5), B[0]);
  if (gl > 0) {
    const g = hw + 2;
    d.l(hx + nx * g, hy + ny * g, hx - nx * g, hy - ny * g, guard, hw >= 2 ? 2 : 1);
  }
}

/** Thin dagger: 1px blade line with a highlight, tiny guard. */
function dagger(d: P, hx: number, hy: number, tx: number, ty: number, B: C[] = STEEL, guard: C = '#c89048', grip: C = WOOD[2]): void {
  const L = Math.hypot(tx - hx, ty - hy);
  const ux = (tx - hx) / L;
  const uy = (ty - hy) / L;
  const nx = -uy;
  const ny = ux;
  d.l(hx - ux * 2, hy - uy * 2, hx, hy, grip);
  d.l(hx + ux, hy + uy, tx, ty, B[1], 2);
  d.l(hx + ux, hy + uy, tx - ux, ty - uy, B[0]);
  d.l(hx + nx * 1.6, hy + ny * 1.6, hx - nx * 1.6, hy - ny * 1.6, guard);
}

function arrow(d: P, x0: number, y0: number, x1: number, y1: number, sh: C = WOOD[0], hd: C = STEEL[0], fl: C = '#f4f4ff', hs = 2.2): void {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  const nx = -uy;
  const ny = ux;
  d.l(x0, y0, x1 - ux, y1 - uy, sh);
  d.l(x1, y1, x1 - ux * hs + nx * hs * 0.8, y1 - uy * hs + ny * hs * 0.8, hd);
  d.l(x1, y1, x1 - ux * hs - nx * hs * 0.8, y1 - uy * hs - ny * hs * 0.8, hd);
  d.l(x1 - ux, y1 - uy, x1 - ux * 2, y1 - uy * 2, hd);
  if (fl) for (const s of [1, -1]) {
    d.l(x0 + ux, y0 + uy, x0 - ux + nx * s * 1.5, y0 - uy + ny * s * 1.5, fl);
    d.l(x0 + ux * 2.5, y0 + uy * 2.5, x0 + ux * 0.5 + nx * s * 1.5, y0 + uy * 0.5 + ny * s * 1.5, fl);
  }
}

/** Zigzag lightning: thick coloured stroke with a bright core. */
function bolt(d: P, pts: number[], c: C, core: C = '#ffffff', w = 2): void {
  for (let i = 0; i + 3 < pts.length; i += 2) d.l(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c, w);
  for (let i = 0; i + 3 < pts.length; i += 2) d.l(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], core);
}

/** Four-point sparkle. */
function spark(d: P, x: number, y: number, r: number, c: C, core: C = '#ffffff'): void {
  d.l(x - r, y, x + r, y, c);
  d.l(x, y - r, x, y + r, c);
  if (r >= 3) {
    const q = Math.round(r / 2.5);
    d.l(x - q, y - q, x + q, y + q, c);
    d.l(x + q, y - q, x - q, y + q, c);
  }
  d.p(x, y, core);
  if (r >= 3) {
    d.p(x + 1, y, core);
    d.p(x - 1, y, core);
    d.p(x, y + 1, core);
    d.p(x, y - 1, core);
  }
}

function ell(d: P, cx: number, cy: number, rx: number, ry: number, c: C, a0 = 0, a1 = PI * 2): void {
  const n = Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * 2);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    d.p(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c);
  }
}

function ellf(d: P, cx: number, cy: number, rx: number, ry: number, c: C): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) d.p(x, y, c);
}

/** Kite shield, top-left at (x,y). */
function kite(d: P, x: number, y: number, w: number, h: number, rim: C, face: C): void {
  d.poly([x, y, x + w, y, x + w, y + h * 0.5, x + w / 2, y + h, x, y + h * 0.5], rim);
  d.poly([x + 1, y + 1, x + w - 1, y + 1, x + w - 1, y + h * 0.5 - 0.3, x + w / 2, y + h - 1.6, x + 1, y + h * 0.5 - 0.3], face);
}

function flame(d: P, cx: number, by: number, h: number, w: number, pal: C[] = FIRE): void {
  const f = (s: number, c: C) =>
    d.poly([cx - w * s, by, cx - w * s * 0.9, by - h * s * 0.45, cx - w * s * 0.35, by - h * s * 0.75, cx - w * 0.1, by - h * s, cx + w * s * 0.35, by - h * s * 0.62, cx + w * s * 0.9, by - h * s * 0.42, cx + w * s, by], c);
  f(1, pal[pal.length - 1]);
  f(0.68, pal[pal.length - 2]);
  f(0.38, pal[1]);
  d.p(cx, by - 2, pal[0]);
}

function skull(d: P, cx: number, cy: number, c: C = BONE[0], s: C = BONE[1]): void {
  d.o(cx, cy, 5, c);
  d.r(cx - 3, cy + 3, 7, 4, s);
  d.r(cx - 3, cy - 1, 2, 3, INK);
  d.r(cx + 2, cy - 1, 2, 3, INK);
  d.p(cx, cy + 3, INK);
  d.r(cx - 2, cy + 5, 1, 2, INK);
  d.r(cx, cy + 5, 1, 2, INK);
  d.r(cx + 2, cy + 5, 1, 2, INK);
  d.p(cx - 3, cy - 4, '#ffffff');
}

/** Standing silhouette, 7 wide × 16 tall, top-left at (x,y). */
function figure(d: P, x: number, y: number, c: C): void {
  d.o(x + 3, y + 2, 2, c);
  d.poly([x + 0.5, y + 5, x + 6.5, y + 5, x + 6, y + 11, x + 1, y + 11], c);
  d.r(x + 1, y + 11, 2, 5, c);
  d.r(x + 4, y + 11, 2, 5, c);
}

/** Hooded head with glowing eyes. */
function hood(d: P, cx: number, cy: number, c: C, eye: C): void {
  d.poly([cx, cy - 7, cx + 6, cy - 1, cx + 6, cy + 7, cx - 6, cy + 7, cx - 6, cy - 1], c);
  d.o(cx, cy + 1, 4, INK);
  d.r(cx - 3, cy + 1, 2, 1, eye);
  d.r(cx + 2, cy + 1, 2, 1, eye);
}

/** Closed fist. dir 0 = punching right, 1 = down, 2 = left, 3 = up. Base at (x,y). */
function fist(d: P, x: number, y: number, dir = 0, wrap: C = '#e8f4ff'): void {
  const P = (u: number, v: number, c: C) => {
    if (dir === 0) d.p(x + u, y + v, c);
    else if (dir === 1) d.p(x + 6 - v, y + u, c);
    else if (dir === 2) d.p(x - u, y + v, c);
    else d.p(x + v, y - u, c);
  };
  const R = (u: number, v: number, w: number, h: number, c: C) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) P(u + i, v + j, c);
  };
  R(0, 1, 3, 5, wrap);
  R(0, 1, 3, 1, '#ffffff');
  R(3, 0, 6, 7, SKIN[1]);
  R(9, 1, 1, 5, SKIN[1]);
  R(4, 0, 5, 1, SKIN[0]);
  for (const v of [2, 4]) R(6, v, 4, 1, SKIN[2]);
  R(3, 5, 5, 2, SKIN[2]);
  R(4, 5, 3, 1, SKIN[1]);
}

function seal(d: P, cx: number, cy: number, r: number, c: C, lt: C, core: C = '#ffffff'): void {
  d.ring(cx, cy, r, c, 1);
  d.ring(cx, cy, r - 2, lt, 1);
  const q = r - 3;
  d.l(cx, cy - q, cx + q, cy, lt);
  d.l(cx + q, cy, cx, cy + q, lt);
  d.l(cx, cy + q, cx - q, cy, lt);
  d.l(cx - q, cy, cx, cy - q, lt);
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4 + PI / 8;
    d.p(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), core);
  }
  d.o(cx, cy, 1, core);
}

function cloud(d: P, cx: number, cy: number, c: C, lt: C): void {
  d.o(cx - 5, cy + 1, 3, c);
  d.o(cx, cy - 1, 4, c);
  d.o(cx + 5, cy + 1, 3, c);
  d.r(cx - 7, cy + 1, 15, 3, c);
  d.p(cx - 1, cy - 4, lt);
  d.p(cx - 2, cy - 3, lt);
  d.p(cx - 6, cy - 1, lt);
}

/** Circular "roll" arrow around (cx,cy). */
function roll(d: P, cx: number, cy: number, r: number, c: C): void {
  arc(d, cx, cy, r, -PI * 0.35, PI * 1.35, c, 2);
  const a = -PI * 0.35;
  const x = cx + Math.cos(a) * (r + 0.5);
  const y = cy + Math.sin(a) * (r + 0.5);
  d.poly([x - 3, y - 2, x + 3, y - 2, x, y + 3], c);
}

function speed(d: P, ys: number[], x0: number, x1: number, c: C): void {
  ys.forEach((y, i) => d.l(x0 + (i % 2) * 2, y, x1 - (i % 2), y, c));
}

/** Halberd: shaft from (x0,y0) to the spike tip (x1,y1), axe head near the tip. */
function halberd(d: P, x0: number, y0: number, x1: number, y1: number, head: C[] = STEEL, shaft: C = WOOD[1]): void {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  const nx = -uy;
  const ny = ux;
  d.l(x0, y0, x1 - ux * 4, y1 - uy * 4, shaft, 2);
  d.l(x0, y0, x1 - ux * 4, y1 - uy * 4, WOOD[0]);
  // spike
  d.l(x1 - ux * 5, y1 - uy * 5, x1, y1, head[1], 1);
  d.p(x1, y1, head[0]);
  // axe blade on +n side
  const bx = x1 - ux * 5;
  const by = y1 - uy * 5;
  d.poly([bx + ux * 2, by + uy * 2, bx + nx * 5 + ux * 3.5, by + ny * 5 + uy * 3.5, bx + nx * 6 - ux * 1, by + ny * 6 - uy * 1, bx + nx * 4.5 - ux * 4, by + ny * 4.5 - uy * 4, bx - ux * 2, by - uy * 2], head[1]);
  d.l(bx + nx * 5 + ux * 3, by + ny * 5 + uy * 3, bx + nx * 4.5 - ux * 3.5, by + ny * 4.5 - uy * 3.5, head[0]);
  // back hook on −n side
  d.poly([bx, by, bx - nx * 3.5 + ux * 1.5, by - ny * 3.5 + uy * 1.5, bx - ux * 1.5, by - uy * 1.5], head[2]);
}

function orb(d: P, x: number, y: number, r: number, pal: C[]): void {
  d.o(x, y, r, pal[2]);
  d.o(x, y, Math.max(1, r - 1.4), pal[1]);
  d.o(x - Math.ceil(r / 3), y - Math.ceil(r / 3), Math.max(0, Math.floor(r / 3)), pal[0]);
}

function wisp(d: P, x: number, y: number, pal: C[], dir = 1): void {
  d.o(x, y, 2, pal[1]);
  d.l(x - dir * 2, y + 1, x - dir * 4, y + 2, pal[2]);
  d.l(x - dir * 1, y + 2, x - dir * 3, y + 3, pal[2]);
  d.p(x, y, pal[0]);
  d.p(x - 1, y - 1, pal[0]);
}

function ground(d: P, y: number, c: C, top: C): void {
  d.r(0, y, 24, 24 - y, c);
  d.l(0, y, 23, y, top);
}

/** Scythe: shaft from bottom (ox+13, oy+22) up to (ox+11, oy+1), blade sweeping left. */
function scythe2(d: P, ox: number, oy: number, blade: C[], shaft: C = WOOD[2]): void {
  d.l(ox + 14, oy + 22, ox + 11, oy + 1, shaft, 2);
  d.l(ox + 14, oy + 22, ox + 11, oy + 1, WOOD[1]);
  d.poly([ox + 10, oy, ox + 14, oy + 1, ox + 14, oy + 4, ox + 8, oy + 4, ox + 3, oy + 6, ox - 1, oy + 12, ox, oy + 6, ox + 4, oy + 2], blade[1]);
  d.l(ox + 13, oy + 4, ox + 8, oy + 4, blade[0]);
  d.l(ox + 8, oy + 4, ox + 3, oy + 6, blade[0]);
  d.l(ox + 3, oy + 6, ox, oy + 11, blade[0]);
}

/** Silhouette with a bright rim (top-left) so dark shapes read on dark tiles. */
function rimFigure(d: P, x: number, y: number, rim: C, body: C): void {
  figure(d, x, y, rim);
  figure(d, x + 1, y + 1, body);
}

type Icon = (d: P) => void;

const ICONS: Record<string, Icon> = {
  // ================================================================ BERSERKER — greatsword, fury
  berserker_basic: (d) => {
    cres(d, 12, 13, 8, -PI * 0.95, PI * 0.05, 3, d.c, d.lt);
    sword(d, 5, 19, 19, 5, 1.6);
    for (const x of [15, 18, 21]) d.r(x, 20, 2, 2, d.lt);
  },
  berserker_q: (d) => {
    cres(d, 12, 17, 9, -PI * 0.98, -PI * 0.02, 4, d.c, d.lt);
    arc(d, 12, 17, 6, -PI * 0.85, -PI * 0.15, d.lt);
    arc(d, 12, 17, 4, -PI * 0.75, -PI * 0.25, d.c);
    sword(d, 4, 19, 22, 19, 1.6);
  },
  berserker_w: (d) => {
    ground(d, 19, '#4a3020', '#8a6a42');
    d.l(12, 20, 8, 23, '#ffd060');
    d.l(12, 20, 16, 23, '#ffd060');
    d.l(10, 19, 3, 21, '#ffd060');
    d.l(14, 19, 21, 21, '#ffd060');
    d.l(5, 17, 1, 13, '#ffe8a0');
    d.l(19, 17, 23, 13, '#ffe8a0');
    d.l(7, 15, 5, 11, d.lt);
    d.l(17, 15, 19, 11, d.lt);
    d.r(3, 9, 2, 2, '#a07850');
    d.r(19, 8, 2, 2, '#a07850');
    d.p(5, 6, '#a07850');
    sword(d, 12, 4, 12, 19, 2);
  },
  berserker_e: (d) => {
    ell(d, 12, 4, 10, 2.5, d.lt);
    ell(d, 12, 4, 9, 1.8, d.c);
    ell(d, 12, 9, 7.5, 2, d.lt);
    ell(d, 12, 13.5, 5.5, 1.6, d.c);
    ell(d, 12, 17.5, 3.5, 1.2, d.lt);
    ell(d, 12, 21, 1.5, 0.8, d.c);
    sword(d, 15, 9, 23, 6, 1.2, STEEL, '#c89048', WOOD[1], 0);
    sword(d, 9, 13, 1, 16, 1.2, STEEL, '#c89048', WOOD[1], 0);
    d.p(16, 9, '#c89048');
    d.p(8, 13, '#c89048');
  },
  berserker_r: (d) => {
    skull(d, 12, 15);
    d.l(12, 10, 11, 13, INK);
    d.l(11, 13, 13, 15, INK);
    d.l(6, 9, 3, 7, '#ffe8a0');
    d.l(18, 9, 21, 7, '#ffe8a0');
    d.p(5, 11, '#ffe8a0');
    d.p(19, 11, '#ffe8a0');
    sword(d, 12, -3, 12, 9, 2);
  },
  berserker_a: (d) => {
    speed(d, [6, 10, 14, 18], 0, 6, d.lt);
    d.poly([6, 12, 17, 9, 19, 21, 8, 22], '#8a3020');
    d.poly([6, 13, 8, 6, 13, 3, 18, 4, 21, 8, 21, 14], STEEL[1]);
    d.l(8, 7, 20, 8, STEEL[2]);
    d.l(7, 11, 21, 12, STEEL[2]);
    d.l(9, 5, 14, 4, STEEL[0]);
    d.p(11, 9, STEEL[0]);
    d.p(17, 10, STEEL[0]);
    spark(d, 21, 16, 2, '#ffe8a0');
    d.l(22, 4, 23, 2, '#ffe8a0');
  },
  berserker_s: (d) => {
    arc(d, 12, 12, 9, -0.7, 0.7, d.lt);
    arc(d, 12, 12, 11, -0.55, 0.55, d.c);
    arc(d, 12, 12, 9, PI - 0.7, PI + 0.7, d.lt);
    arc(d, 12, 12, 11, PI - 0.55, PI + 0.55, d.c);
    d.o(12, 12, 6, SKIN[1]);
    d.poly([5, 11, 6, 5, 12, 3, 18, 5, 19, 11, 17, 8, 7, 8], '#8a3a1e');
    d.l(7, 9, 10, 10, INK);
    d.l(17, 9, 14, 10, INK);
    d.r(9, 13, 7, 5, '#3a0a0a');
    d.r(10, 15, 5, 2, '#b01818');
    d.r(9, 13, 7, 1, '#ffffff');
    d.p(12, 3, '#ff8a4a');
  },
  berserker_d: (d) => {
    ground(d, 18, '#4a3020', '#8a6a42');
    d.l(6, 19, 23, 19, '#ff8a3a');
    d.l(6, 20, 23, 21, '#2a1208');
    d.poly([8, 18, 10, 13, 12, 18], STONE[2]);
    d.poly([12, 18, 14.5, 10, 17, 18], STONE[1]);
    d.poly([17, 18, 20, 6, 23, 18], STONE[0]);
    d.l(10, 14, 10, 17, STONE[1]);
    d.l(14, 11, 14, 17, STONE[0]);
    d.l(19, 8, 19, 17, '#ffffff');
    d.p(11, 9, STONE[1]);
    d.p(16, 6, STONE[1]);
    d.p(22, 3, STONE[0]);
    sword(d, 4, 4, 4, 20, 1.6);
  },
  berserker_f: (d) => {
    speed(d, [5, 12, 19], 0, 5, BLOOD[0]);
    cres(d, 2, 12, 10, -1.25, 1.25, 5, BLOOD[2]);
    cres(d, 3, 12, 10, -1.15, 1.15, 3.5, BLOOD[1], BLOOD[0]);
    d.r(17, 4, 2, 2, BLOOD[1]);
    d.p(20, 8, BLOOD[1]);
    d.r(18, 18, 2, 2, BLOOD[1]);
    d.p(21, 15, BLOOD[2]);
  },
  berserker_ult: (d) => {
    for (const a of [-2.7, -2.2, -1.57, -0.95, -0.45]) d.l(12 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 12 + Math.cos(a) * 15, 16 + Math.sin(a) * 15, '#ff6a3a');
    ground(d, 18, '#3a1410', '#ff5a2a');
    bolt(d, [12, 18, 10, 20, 13, 22, 11, 24], '#ff3a1a', '#ffd060');
    d.l(11, 19, 3, 22, '#ff7a3a');
    d.l(13, 19, 21, 22, '#ff7a3a');
    flame(d, 4, 18, 8, 3);
    flame(d, 20, 18, 8, 3);
    sword(d, 12, 6, 12, 20, 2.2, ['#ffffff', '#ffd8c8', '#c03a2a'], '#ffd060', '#3a1a10', 4);
  },
  berserker_id: (d) => {
    flame(d, 12, 24, 23, 11, ['#ffe0a0', '#ff8a3a', '#e8301a', '#901010']);
    d.o(12, 11, 5, '#200606');
    d.poly([2, 24, 5, 17, 19, 17, 22, 24], '#200606');
    d.r(8, 11, 3, 1, '#fff0a0');
    d.r(13, 11, 3, 1, '#fff0a0');
    d.p(8, 10, '#ff4a2a');
    d.p(15, 10, '#ff4a2a');
    d.l(10, 15, 14, 15, '#a01010');
  },
  berserker_dodge: (d) => {
    roll(d, 12, 11, 8, d.lt);
    d.poly([7, 14, 9, 9, 12, 7, 15, 8, 17, 12, 17, 15], STEEL[1]);
    d.l(8, 12, 17, 12, STEEL[2]);
    d.p(11, 9, STEEL[0]);
    d.o(4, 21, 2, '#a89070');
    d.o(8, 22, 1, '#a89070');
    d.o(19, 21, 2, '#a89070');
  },

  // ================================================================ PALADIN — sword & shield, holy light
  paladin_basic: (d) => {
    sword(d, 4, 20, 18, 6, 1.3);
    d.o(16, 16, 6, STEEL[2]);
    d.o(16, 16, 5, d.c);
    d.ring(16, 16, 3, d.lt);
    d.o(16, 16, 1, HOLY[0]);
    d.p(13, 13, '#ffffff');
  },
  paladin_q: (d) => {
    sword(d, 3, 12, 16, 12, 1.5);
    d.l(1, 7, 8, 7, HOLY[1]);
    d.l(1, 17, 8, 17, HOLY[1]);
    d.ring(19, 12, 4, HOLY[2]);
    spark(d, 19, 12, 4, '#ffffff', '#ffffff');
    d.p(21, 4, HOLY[0]);
    d.p(22, 20, HOLY[0]);
  },
  paladin_w: (d) => {
    speed(d, [6, 11, 16], 0, 4, d.lt);
    kite(d, 4, 3, 12, 17, STEEL[1], d.c);
    d.r(9, 6, 2, 10, HOLY[0]);
    d.r(6, 9, 8, 2, HOLY[0]);
    spark(d, 19, 11, 4, '#fff4a0');
    spark(d, 19, 3, 1, '#ffe060');
    spark(d, 21, 20, 1, '#ffe060');
  },
  paladin_e: (d) => {
    d.ring(12, 12, 11, HOLY[1]);
    for (const a of [-2.4, -1.57, -0.75, 0, PI]) d.l(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, 12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11, HOLY[0]);
    kite(d, 5, 3, 14, 18, HOLY[2], '#f4f0e8');
    d.r(11, 5, 2, 12, HOLY[2]);
    d.r(7, 8, 10, 2, HOLY[2]);
    d.p(7, 5, '#ffffff');
  },
  paladin_r: (d) => {
    ground(d, 19, '#5a4a2a', HOLY[2]);
    ellf(d, 12, 20, 6, 2, HOLY[1]);
    d.r(8, 0, 8, 20, HOLY[2]);
    d.r(9, 0, 6, 20, HOLY[1]);
    d.r(11, 0, 2, 20, HOLY[0]);
    d.l(5, 18, 1, 14, HOLY[1]);
    d.l(19, 18, 23, 14, HOLY[1]);
    spark(d, 4, 8, 1, HOLY[0]);
    spark(d, 20, 5, 1, HOLY[0]);
  },
  paladin_a: (d) => {
    d.l(0, 6, 9, 6, HOLY[2], 2);
    d.l(0, 12, 10, 12, HOLY[1], 2);
    d.l(0, 18, 9, 18, HOLY[2], 2);
    d.l(2, 9, 8, 9, HOLY[0]);
    d.l(2, 15, 8, 15, HOLY[0]);
    kite(d, 10, 3, 12, 18, STEEL[1], d.c);
    d.r(15, 6, 2, 11, HOLY[0]);
    d.r(12, 9, 8, 2, HOLY[0]);
  },
  paladin_s: (d) => {
    for (const a of [-2.6, -2.0, -1.57, -1.1, -0.5]) d.l(12 + Math.cos(a) * 8, 5 + Math.sin(a) * 3, 12 + Math.cos(a) * 12, 5 + Math.sin(a) * 6, HOLY[2]);
    d.ring(12, 15, 8, HOLY[1]);
    ell(d, 12, 4, 5, 1.6, HOLY[0]);
    ell(d, 12, 4, 6, 2.2, HOLY[2]);
    rimFigure(d, 8, 7, HOLY[0], '#6a4a1a');
    spark(d, 3, 10, 2, HOLY[0]);
    spark(d, 21, 18, 2, HOLY[0]);
    spark(d, 20, 9, 1, HOLY[0]);
  },
  paladin_d: (d) => {
    d.poly([8, 12, 24, 1, 24, 23], HOLY[2]);
    d.poly([8, 12, 24, 5, 24, 19], HOLY[1]);
    d.poly([8, 12, 24, 9, 24, 15], HOLY[0]);
    kite(d, 1, 4, 9, 15, STEEL[1], d.c);
    d.r(5, 6, 1, 9, HOLY[0]);
    d.r(3, 9, 5, 1, HOLY[0]);
  },
  paladin_f: (d) => {
    ellf(d, 12, 19, 10, 3.5, mix(0xffbe3a, -0.55));
    ell(d, 12, 19, 10, 3.5, HOLY[1]);
    ell(d, 12, 19, 6.5, 2.2, HOLY[2]);
    d.p(3, 12, HOLY[0]);
    d.p(20, 9, HOLY[0]);
    d.p(6, 7, HOLY[1]);
    d.p(18, 14, HOLY[1]);
    sword(d, 12, 3, 12, 19, 1.6);
  },
  paladin_ult: (d) => {
    for (const a of [-2.8, -2.2, -1.57, -0.95, -0.35, 0.3, 2.85]) d.l(12 + Math.cos(a) * 6, 11 + Math.sin(a) * 6, 12 + Math.cos(a) * 16, 11 + Math.sin(a) * 16, HOLY[2]);
    ground(d, 21, '#5a4a2a', HOLY[1]);
    const H = '#fff6e0';
    d.r(6, 10, 11, 8, H);
    d.r(6, 4, 2, 7, H);
    d.r(9, 2, 2, 9, H);
    d.r(12, 3, 2, 8, H);
    d.r(15, 5, 2, 6, H);
    d.l(17, 15, 20, 10, H, 2);
    d.r(14, 11, 3, 7, HOLY[1]);
    d.l(8, 15, 13, 15, HOLY[1]);
    d.r(8, 18, 7, 3, '#ffffff');
    d.l(7, 21, 16, 21, '#ffffff');
    d.l(1, 21, 4, 18, '#ffffff');
    d.l(22, 21, 19, 18, '#ffffff');
  },
  paladin_id: (d) => {
    ellf(d, 12, 19, 10, 3.5, mix(0xffbe3a, -0.5));
    ell(d, 12, 19, 10, 3.5, HOLY[1]);
    arc(d, 12, 19, 10, PI, PI * 2, HOLY[1]);
    arc(d, 12, 19, 8, PI * 1.15, PI * 1.85, HOLY[0]);
    d.r(11, 8, 3, 10, HOLY[0]);
    d.r(8, 11, 9, 3, HOLY[0]);
    d.r(12, 9, 1, 8, HOLY[2]);
    d.r(9, 12, 7, 1, HOLY[2]);
    spark(d, 4, 4, 1, HOLY[0]);
    spark(d, 20, 5, 1, HOLY[0]);
  },
  paladin_dodge: (d) => {
    roll(d, 12, 12, 8, d.lt);
    kite(d, 8, 7, 8, 11, STEEL[1], d.c);
    d.r(11, 9, 2, 6, HOLY[0]);
  },

  // ================================================================ STEEL FIST — martial arts, spirit orbs
  steelfist_basic: (d) => {
    fist(d, 2, 4, 0);
    fist(d, 7, 13, 0);
    spark(d, 15, 5, 2, '#ffffff', d.lt);
    spark(d, 20, 16, 3, d.lt);
  },
  steelfist_q: (d) => {
    cres(d, 21, 22, 13, PI * 1.0, PI * 1.38, 4, d.c, d.lt);
    fist(d, 11, 14, 3);
    d.l(14, 16, 14, 22, d.lt);
    d.l(18, 15, 18, 19, d.lt);
    spark(d, 20, 3, 2, '#ffffff', d.lt);
  },
  steelfist_w: (d) => {
    bolt(d, [0, 8, 4, 11, 2, 13, 8, 15], d.c, '#ffffff', 1);
    speed(d, [5, 18, 21], 0, 8, d.lt);
    fist(d, 9, 8, 0);
    spark(d, 21, 11, 2, '#ffffff', d.lt);
  },
  steelfist_e: (d) => {
    d.l(6, 21, 13, 9, '#2a4a7a', 4);
    d.l(13, 9, 15, 19, '#2a4a7a', 3);
    d.r(14, 19, 4, 2, '#20283a');
    d.o(13, 8, 2, STEEL[1]);
    d.p(12, 7, '#ffffff');
    d.l(6, 21, 13, 9, '#3a62a0', 1);
    spark(d, 18, 4, 3, d.lt);
    d.l(4, 15, 4, 10, d.lt);
    d.l(20, 15, 20, 11, d.lt);
  },
  steelfist_r: (d) => {
    d.r(11, 9, 13, 6, d.c);
    d.r(11, 10, 13, 4, d.lt);
    d.r(11, 11, 13, 2, '#ffffff');
    d.ring(6, 12, 8, d.lt);
    fist(d, 1, 9, 0);
    spark(d, 20, 5, 1, '#ffffff');
    spark(d, 17, 19, 1, '#ffffff');
  },
  steelfist_a: (d) => {
    fist(d, 9, 1, 0);
    fist(d, 2, 7, 0);
    fist(d, 12, 11, 0);
    fist(d, 4, 16, 0);
    d.l(21, 4, 23, 4, d.lt);
    d.l(22, 14, 23, 14, d.lt);
    d.l(14, 19, 16, 19, d.lt);
  },
  steelfist_s: (d) => {
    cres(d, 12, 12, 8, -PI * 0.1, PI * 0.85, 3, d.c, d.lt);
    cres(d, 12, 12, 8, PI * 0.9, PI * 1.85, 3, d.c, d.lt);
    d.l(3, 12, 16, 11, '#2a4a7a', 3);
    d.poly([15, 9, 21, 9, 23, 12, 21, 13, 15, 13], '#20283a');
    d.l(16, 10, 21, 10, '#4a5a7a');
    spark(d, 21, 4, 2, '#ffffff', d.lt);
  },
  steelfist_d: (d) => {
    d.ring(17, 12, 6, d.c);
    orb(d, 17, 12, 4, SPIRIT);
    d.r(3, 9, 5, 9, SKIN[1]);
    for (const x of [3, 5, 7]) d.r(x, 3, 1, 6, SKIN[1]);
    d.r(4, 4, 1, 5, SKIN[2]);
    d.r(6, 4, 1, 5, SKIN[2]);
    d.r(8, 10, 3, 2, SKIN[1]);
    d.r(3, 17, 5, 3, '#e8f4ff');
    d.l(9, 6, 11, 4, '#ffffff');
    d.l(9, 18, 11, 20, '#ffffff');
  },
  steelfist_f: (d) => {
    flame(d, 12, 6, 6, 5, SPIRIT);
    ellf(d, 12, 20, 10, 2.5, d.dk);
    ell(d, 12, 20, 10, 2.5, d.lt);
    ell(d, 12, 20, 7, 1.6, '#ffffff');
    fist(d, 9, 6, 1);
    d.l(2, 18, 0, 15, d.lt);
    d.l(21, 18, 23, 15, d.lt);
  },
  steelfist_ult: (d) => {
    d.poly([1, 9, 5, 4, 3, 10, 7, 7, 6, 12], SPIRIT[3]);
    d.poly([4, 11, 9, 5, 15, 5, 21, 8, 23, 11, 17, 12, 22, 15, 15, 17, 9, 17, 3, 15], SPIRIT[2]);
    d.poly([9, 5, 15, 5, 21, 8, 22, 10, 10, 9], SPIRIT[1]);
    d.poly([23, 11, 16, 12.5, 22, 15], INK);
    d.p(21, 12, '#ffffff');
    d.p(19, 13, '#ffffff');
    d.p(21, 14, '#ffffff');
    d.l(10, 5, 5, 0, '#ffffff', 2);
    d.l(13, 5, 11, 0, SPIRIT[1], 2);
    d.r(14, 8, 3, 2, '#ffe060');
    d.p(16, 8, INK);
    d.l(22, 9, 23, 5, SPIRIT[1]);
    d.l(19, 16, 23, 21, SPIRIT[1]);
    for (const [x, y] of [[3, 20], [8, 21], [13, 21]] as const) d.o(x, y, 1, '#ffffff');
  },
  steelfist_id: (d) => {
    d.ring(12, 12, 10, d.dk);
    fist(d, 9, 17, 3);
    for (const [x, y] of [[4, 6], [12, 2], [20, 6]] as const) orb(d, x, y, 2, SPIRIT);
    bolt(d, [3, 12, 6, 15, 4, 17, 7, 20], d.c, '#ffffff', 1);
    bolt(d, [21, 12, 18, 15, 20, 17, 17, 20], d.c, '#ffffff', 1);
  },
  steelfist_dodge: (d) => {
    for (const [x, y, c] of [[5, 13, d.dk], [11, 6, d.c], [18, 11, d.lt]] as const) {
      ellf(d, x, y, 2, 3, c);
      ellf(d, x, y + 6, 1.6, 1.6, c);
      d.p(x - 2, y - 4, c);
      d.p(x, y - 5, c);
      d.p(x + 2, y - 4, c);
    }
    d.l(1, 22, 9, 22, d.lt);
    d.l(14, 22, 22, 22, d.lt);
  },

  // ================================================================ RANGER — bow, traps, hawk
  ranger_basic: (d) => {
    arc(d, 5, 12, 9, -1.15, 1.15, WOOD[1], 2);
    arc(d, 5, 12, 9, -1.0, 1.0, WOOD[0]);
    d.l(8, 3, 3, 12, '#e8e8e8');
    d.l(3, 12, 8, 21, '#e8e8e8');
    arrow(d, 3, 12, 21, 12);
  },
  ranger_q: (d) => {
    d.l(0, 10, 12, 10, d.lt);
    d.l(0, 14, 12, 14, d.lt);
    d.ring(15, 12, 4, d.c, 1);
    arrow(d, 2, 12, 22, 12, '#fff4d0', '#ffffff', d.lt, 3);
    d.l(2, 12, 18, 12, '#ffffff');
    spark(d, 15, 12, 2, '#ffffff');
  },
  ranger_w: (d) => {
    arc(d, 12, 11, 8, PI * 1.0, PI * 1.95, d.lt, 2);
    d.poly([1, 10, 7, 10, 4, 14.5], d.lt);
    arrow(d, 9, 10, 16, 21, WOOD[0], '#ffffff', '');
    arrow(d, 6, 13, 9, 22, WOOD[0], '#ffffff', '');
    arrow(d, 13, 9, 22, 18, WOOD[0], '#ffffff', '');
    d.o(12, 9, 1, '#ffffff');
  },
  ranger_e: (d) => {
    ellf(d, 12, 20, 9, 3, d.dk);
    ell(d, 12, 20, 9, 3, d.lt);
    for (const [x, y] of [[4, 1], [12, 4], [20, 0], [8, 10], [16, 9]] as const) arrow(d, x, y, x, y + 9, WOOD[0], '#ffffff', '');
  },
  ranger_r: (d) => {
    arrow(d, 1, 18, 10, 11);
    d.o(16, 8, 5, FIRE[3]);
    d.o(16, 8, 4, FIRE[2]);
    d.o(16, 8, 2, FIRE[1]);
    d.p(16, 8, FIRE[0]);
    for (const a of [-2.5, -1.6, -0.6, 0.4, 1.3]) d.l(16 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 16 + Math.cos(a) * 8, 8 + Math.sin(a) * 8, FIRE[1]);
    d.r(14, 15, 2, 2, STONE[2]);
    d.p(22, 13, STONE[2]);
  },
  ranger_a: (d) => {
    ellf(d, 12, 15, 10, 5, STEEL[2]);
    ellf(d, 12, 15, 8, 3.6, '#3a3a2a');
    ellf(d, 12, 15, 3, 1.4, '#a07a4a');
    d.p(12, 15, '#e0c080');
    for (let i = 0; i < 9; i++) {
      const a = PI + (i * PI) / 8;
      const x = 12 + Math.cos(a) * 9;
      const y = 15 + Math.sin(a) * 4.5;
      d.l(x, y, x + Math.cos(a) * -0.5, y - 4, STEEL[0]);
      d.p(x, y - 1, STEEL[1]);
    }
    for (let i = 1; i < 8; i++) {
      const a = (i * PI) / 8;
      const x = 12 + Math.cos(a) * 9;
      const y = 15 + Math.sin(a) * 4.5;
      d.l(x, y, x, y - 3, STEEL[0]);
    }
    ell(d, 12, 15, 10, 5, STEEL[1]);
    d.l(20, 19, 23, 23, STEEL[2], 2);
  },
  ranger_s: (d) => {
    for (let i = 0; i < 7; i++) {
      const a = -PI / 2 + (i * PI) / 12;
      arrow(d, 3 + Math.cos(a) * 4, 21 + Math.sin(a) * 4, 3 + Math.cos(a) * 19, 21 + Math.sin(a) * 19, WOOD[0], '#ffffff', '');
    }
    d.o(3, 21, 2, d.lt);
  },
  ranger_d: (d) => {
    for (const [x, y] of [[2, 3], [9, 9], [3, 15], [10, 20]] as const) {
      arrow(d, x, y, x + 12, y, WOOD[0], '#ffffff', d.lt);
      d.l(0, y + 1, x - 1, y + 1, d.dk);
    }
  },
  ranger_f: (d) => {
    d.ring(12, 12, 8, '#ff5a5a', 1);
    d.ring(12, 12, 4, '#ff5a5a', 1);
    d.l(12, 1, 12, 6, '#ff9a9a');
    d.l(12, 18, 12, 23, '#ff9a9a');
    d.l(1, 12, 6, 12, '#ff9a9a');
    d.l(18, 12, 23, 12, '#ff9a9a');
    arrow(d, 20, 3, 12, 11, WOOD[0], '#ffffff', '#ff7a7a');
    d.o(12, 12, 1, '#ffffff');
  },
  ranger_ult: (d) => {
    d.r(0, 0, 24, 2, '#2a3a2a');
    for (const [x, y] of [[1, 0], [7, 2], [13, 0], [19, 2], [4, 8], [10, 10], [16, 8], [22, 10], [1, 14], [13, 15]] as const) arrow(d, x, y, x + 2, y + 6, WOOD[0], '#ffffff', '', 2);
    ground(d, 21, '#3a4a2a', d.lt);
    ell(d, 12, 21, 10, 1.6, '#ffe060');
  },
  ranger_id: (d) => {
    d.poly([11, 10, 1, 4, 3, 8, 0, 9, 4, 12, 2, 14, 10, 15], '#8a5a32');
    d.poly([13, 10, 23, 4, 21, 8, 24, 9, 20, 12, 22, 14, 14, 15], '#8a5a32');
    d.l(3, 6, 10, 11, '#c08a52');
    d.l(21, 6, 14, 11, '#c08a52');
    d.poly([10, 9, 14, 9, 15, 16, 12, 18, 9, 16], '#6a4228');
    d.poly([9, 17, 15, 17, 16, 22, 8, 22], '#5a3a1e');
    d.o(12, 7, 2, '#f4efe0');
    d.p(11, 7, INK);
    d.p(13, 7, INK);
    d.r(12, 9, 1, 2, '#ffc23a');
    d.l(10, 18, 9, 20, '#ffc23a');
    d.l(14, 18, 15, 20, '#ffc23a');
  },
  ranger_dodge: (d) => {
    roll(d, 12, 12, 8, d.lt);
    arrow(d, 8, 16, 16, 8, WOOD[0], '#ffffff', '#f4f4ff');
  },

  // ================================================================ DEATHBLADE — twin blades, orbs
  deathblade_basic: (d) => {
    slash(d, 2, 4, 22, 20, 3, d.c);
    dagger(d, 5, 19, 18, 6);
    dagger(d, 19, 19, 6, 6);
  },
  deathblade_q: (d) => {
    slash(d, 3, 3, 21, 21, 4, d.c, '#ffffff');
    slash(d, 3, 21, 21, 3, 4, d.dk, d.lt);
    slash(d, 1, 12, 23, 12, 3, d.lt, '#ffffff');
  },
  deathblade_w: (d) => {
    d.r(9, 6, 7, 2, d.dk);
    figure(d, 9, 6, INK);
    arc(d, 12, 13, 9, PI * 1.05, PI * 1.95, d.lt, 2);
    d.poly([18, 10, 23, 10, 20.5, 14], d.lt);
    d.l(4, 15, 2, 20, d.dk);
    d.l(5, 17, 4, 21, d.dk);
    dagger(d, 22, 20, 15, 14);
    spark(d, 15, 14, 2, '#ffffff', d.lt);
  },
  deathblade_e: (d) => {
    speed(d, [6, 10, 14, 18], 0, 7, d.lt);
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2 + 0.3;
      const x = 15 + Math.cos(a) * 7;
      const y = 12 + Math.sin(a) * 7;
      d.poly([15 + Math.cos(a - 0.25) * 2, 12 + Math.sin(a - 0.25) * 2, x, y, 15 + Math.cos(a - 1.1) * 4.5, 12 + Math.sin(a - 1.1) * 4.5], STEEL[1]);
      d.l(15, 12, x, y, STEEL[0]);
    }
    d.ring(15, 12, 9, d.c);
    d.o(15, 12, 2, d.c);
    d.p(15, 12, '#ffffff');
  },
  deathblade_r: (d) => {
    slash(d, 2, 2, 22, 22, 5, BLOOD[2], BLOOD[0]);
    slash(d, 22, 2, 2, 22, 5, BLOOD[1], '#ffffff');
    d.r(5, 19, 2, 2, BLOOD[1]);
    d.p(19, 6, BLOOD[1]);
    d.p(4, 9, BLOOD[2]);
    d.r(18, 20, 1, 2, BLOOD[1]);
  },
  deathblade_a: (d) => {
    for (let i = 0; i < 6; i++) {
      const a = (i * PI) / 3;
      cres(d, 12, 12, 6, a, a + 0.9, 3, DARK[2], DARK[1]);
      const x = 12 + Math.cos(a + 0.9) * 8;
      const y = 12 + Math.sin(a + 0.9) * 8;
      d.l(x, y, x + Math.cos(a + 0.9 + PI / 2) * 3, y + Math.sin(a + 0.9 + PI / 2) * 3, '#ffffff', 2);
    }
    d.o(12, 12, 2, DARK[3]);
    d.p(12, 12, '#ffffff');
  },
  deathblade_s: (d) => {
    for (let i = 0; i < 5; i++) {
      const a = -PI / 2 + (i - 2) * 0.45;
      dagger(d, 12 + Math.cos(a) * 6, 21 + Math.sin(a) * 6, 12 + Math.cos(a) * 17, 21 + Math.sin(a) * 17);
    }
    d.l(5, 22, 19, 22, d.lt);
  },
  deathblade_d: (d) => {
    d.o(8, 13, 4, BLOOD[1]);
    d.o(15, 13, 4, BLOOD[1]);
    d.poly([4, 14, 19, 14, 11.5, 22], BLOOD[1]);
    d.p(7, 11, BLOOD[0]);
    bolt(d, [11, 10, 13, 14, 10, 17, 12, 21], INK, '#3a0a14');
    dagger(d, 17, 2, 9, 15, STEEL, d.c);
  },
  deathblade_f: (d) => {
    bolt(d, [1, 21, 20, 16, 4, 11, 21, 4], d.c, '#ffffff', 2);
    for (const [x, y] of [[20, 16], [4, 11], [21, 4]] as const) spark(d, x, y, 2, '#ffffff', d.lt);
    d.l(1, 22, 6, 21, d.dk);
  },
  deathblade_ult: (d) => {
    d.ring(12, 12, 10, d.dk, 2);
    d.o(12, 12, 6, DARK[3]);
    for (const [x0, y0, x1, y1] of [[1, 6, 9, 2], [15, 1, 22, 7], [19, 14, 23, 21], [2, 16, 7, 22], [10, 20, 17, 23], [0, 11, 4, 9], [20, 9, 23, 11]] as const) slash(d, x0, y0, x1, y1, 2, d.lt, '#ffffff');
    slash(d, 5, 5, 19, 19, 3, '#ffffff', '#ffffff');
    slash(d, 19, 5, 5, 19, 3, '#ffffff', '#ffffff');
    d.o(12, 12, 1, d.c);
  },
  deathblade_id: (d) => {
    for (const x of [5, 12, 19]) orb(d, x, 5, 3, ARCANE);
    d.l(1, 15, 17, 15, d.dk, 4);
    d.l(3, 15, 18, 15, d.c, 2);
    d.l(6, 15, 18, 15, '#ffffff');
    d.poly([17, 10, 23, 15, 17, 20], d.lt);
    d.l(2, 20, 10, 20, d.lt);
  },
  deathblade_dodge: (d) => {
    for (const [x, c] of [[1, d.dk], [7, d.c], [13, d.lt]] as const) {
      d.l(x, 5, x + 7, 12, c, 3);
      d.l(x + 7, 12, x, 19, c, 3);
    }
    d.l(16, 8, 20, 12, '#ffffff');
  },

  // ================================================================ REAPER — shadow assassin
  reaper_basic: (d) => {
    d.l(1, 9, 9, 9, d.dk, 2);
    d.l(0, 14, 8, 14, d.c, 2);
    d.l(2, 18, 9, 18, d.dk, 1);
    dagger(d, 6, 15, 21, 8, ['#ffffff', '#d0c0ff', '#7a5ac0'], '#8a5ae0', INK);
    spark(d, 21, 8, 2, '#ffffff', d.lt);
  },
  reaper_q: (d) => {
    cres(d, 9, 15, 9, -PI * 0.95, -PI * 0.15, 3, d.lt, '#ffffff');
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4;
      d.l(17 + Math.cos(a) * 2, 15 + Math.sin(a) * 2, 17 + Math.cos(a) * (i % 2 ? 4 : 6), 15 + Math.sin(a) * (i % 2 ? 4 : 6), DARK[0]);
    }
    d.o(17, 15, 2, DARK[3]);
    dagger(d, 3, 19, 15, 15, ['#ffffff', '#d0c0ff', '#7a5ac0'], '#8a5ae0', INK);
  },
  reaper_w: (d) => {
    figure(d, 2, 5, d.c);
    d.r(4, 6, 1, 1, d.lt);
    d.l(10, 11, 13, 11, d.lt);
    d.l(9, 14, 13, 14, d.lt);
    d.l(10, 17, 13, 17, d.lt);
    rimFigure(d, 14, 4, d.lt, INK);
    d.r(17, 6, 1, 1, '#ffffff');
    d.r(19, 6, 1, 1, '#ffffff');
  },
  reaper_e: (d) => {
    d.o(6, 14, 5, POISON[2]);
    d.o(14, 10, 6, POISON[2]);
    d.o(18, 16, 5, POISON[2]);
    d.o(6, 14, 3, POISON[1]);
    d.o(14, 10, 4, POISON[1]);
    d.o(18, 16, 3, POISON[1]);
    d.r(9, 13, 6, 4, '#2a5a20');
    d.p(10, 14, POISON[0]);
    d.p(13, 14, POISON[0]);
    d.r(11, 16, 2, 1, POISON[0]);
    d.o(4, 4, 1, POISON[0]);
    d.p(21, 6, POISON[0]);
    d.p(8, 21, POISON[0]);
  },
  reaper_r: (d) => {
    hood(d, 9, 13, DARK[2], '#ffffff');
    d.poly([3, 24, 3, 19, 15, 19, 15, 24], DARK[2]);
    dagger(d, 15, 17, 21, 3, ['#ffffff', '#d0c0ff', '#7a5ac0'], '#8a5ae0', INK);
    d.l(15, 9, 20, 9, d.lt);
    d.p(22, 2, '#ffffff');
  },
  reaper_a: (d) => {
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const a = t * PI * 3.2;
      const r = 1 + t * 10;
      d.p(12 + Math.cos(a) * r, 12 + Math.sin(a) * r, i % 3 ? d.c : d.lt);
    }
    for (const a of [0.4, 2.5, 4.6]) {
      const x = 12 + Math.cos(a) * 9;
      const y = 12 + Math.sin(a) * 9;
      d.l(x, y, x + Math.cos(a + 1.9) * 4, y + Math.sin(a + 1.9) * 4, STEEL[0], 2);
    }
  },
  reaper_s: (d) => {
    cres(d, 13, 13, 9, PI * 0.55, PI * 1.6, 3.5, DARK[2], DARK[1]);
    scythe2(d, 6, 1, ['#ffffff', d.lt]);
  },
  reaper_d: (d) => {
    d.o(19, 12, 2, '#ff4a5a');
    d.ring(19, 12, 4, '#ff4a5a');
    for (const [y, c] of [[4, d.lt], [12, d.c], [20, d.lt]] as const) {
      arc(d, 3, 12 + (y - 12) * 0.2, 1, 0, 0, c);
      d.l(1, y, 7, y + (12 - y) * 0.3, c);
      d.l(7, y + (12 - y) * 0.3, 12, y + (12 - y) * 0.65, c);
      const tx = 15;
      const ty = 12 + (y - 12) * 0.25;
      d.poly([11, y + (12 - y) * 0.65 - 1.5, tx, ty, 11, y + (12 - y) * 0.65 + 1.5], DARK[0]);
    }
  },
  reaper_f: (d) => {
    d.r(8, 16, 2, 6, DARK[2]);
    d.r(12, 16, 2, 6, DARK[2]);
    d.poly([6, 11, 16, 11, 15, 17, 7, 17], DARK[2]);
    d.l(6, 11, 15, 11, d.lt);
    for (const [x, y] of [[7, 9], [10, 8], [14, 9], [8, 6], [12, 5], [15, 6], [6, 3], [11, 2], [17, 3], [9, 10], [13, 10], [4, 7], [18, 8]] as const) d.p(x, y, y > 7 ? d.lt : '#ffffff');
    d.l(17, 21, 22, 16, d.lt);
    d.poly([23, 13, 23, 19, 18, 14], d.lt);
  },
  reaper_ult: (d) => {
    d.ring(12, 12, 10, d.dk);
    for (const [x, y, a] of [[4, 6, 0.6], [20, 4, 2.2], [4, 18, -0.6], [20, 18, 3.8]] as const) {
      d.o(x, y, 2, '#d0f0ff');
      d.p(x - 1, y, INK);
      d.p(x + 1, y, INK);
      d.l(x - Math.cos(a) * 2, y - Math.sin(a) * 2, x - Math.cos(a) * 4, y - Math.sin(a) * 4, '#a0d0ff');
    }
    scythe2(d, 5, 1, ['#ffffff', d.lt]);
    d.o(12, 14, 2, '#ffffff');
  },
  reaper_id: (d) => {
    d.poly([1, 8, 8, 6, 12, 9, 16, 6, 23, 8, 21, 14, 16, 17, 12, 14, 8, 17, 3, 14], '#f0eef8');
    d.poly([4, 10, 9, 9, 10, 12, 6, 13], INK);
    d.poly([20, 10, 15, 9, 14, 12, 18, 13], INK);
    d.r(6, 11, 2, 1, d.lt);
    d.r(16, 11, 2, 1, d.lt);
    d.l(12, 11, 12, 15, '#b8b4c8');
    d.l(3, 9, 0, 4, d.c, 2);
    d.l(21, 9, 23, 4, d.c, 2);
    d.l(8, 18, 6, 22, '#b8b4c8');
  },
  reaper_dodge: (d) => {
    cloud(d, 12, 15, d.dk, d.c);
    d.o(7, 9, 2, d.c);
    d.o(15, 7, 2, d.c);
    d.o(11, 4, 1, d.lt);
    d.p(19, 3, d.lt);
    d.p(4, 4, d.lt);
    d.p(20, 10, d.lt);
    d.r(8, 15, 2, 1, INK);
    d.r(14, 15, 2, 1, INK);
  },

  // ================================================================ SUMMONER — spirits & beasts
  summoner_basic: (d) => {
    d.l(4, 22, 13, 10, WOOD[1], 2);
    d.l(4, 22, 13, 10, WOOD[0]);
    d.ring(15, 7, 5, d.c);
    orb(d, 15, 7, 3, SPIRIT);
    d.l(20, 2, 22, 0, SPIRIT[1]);
    d.p(21, 10, SPIRIT[1]);
  },
  summoner_q: (d) => {
    const fur = SPIRIT[2];
    d.poly([3, 2, 9, 8, 15, 8, 21, 2, 21, 12, 17, 18, 12, 22, 7, 18, 3, 12], fur);
    d.poly([5, 5, 8, 9, 5, 10], SPIRIT[3]);
    d.poly([19, 5, 16, 9, 19, 10], SPIRIT[3]);
    d.poly([9, 14, 15, 14, 14, 20, 12, 22, 10, 20], SPIRIT[1]);
    d.r(11, 19, 3, 2, INK);
    d.l(6, 11, 9, 12, '#ffffff');
    d.l(18, 11, 15, 12, '#ffffff');
    d.l(12, 8, 12, 13, SPIRIT[3]);
    d.p(3, 14, SPIRIT[1]);
    d.p(21, 14, SPIRIT[1]);
  },
  summoner_w: (d) => {
    d.r(5, 6, 14, 11, STONE[1]);
    d.r(7, 2, 10, 6, STONE[0]);
    d.r(1, 8, 5, 10, STONE[2]);
    d.r(18, 8, 5, 10, STONE[2]);
    d.r(1, 17, 5, 3, STONE[1]);
    d.r(18, 17, 5, 3, STONE[1]);
    d.r(6, 17, 4, 6, STONE[2]);
    d.r(14, 17, 4, 6, STONE[2]);
    d.r(9, 4, 2, 2, '#9affd8');
    d.r(13, 4, 2, 2, '#9affd8');
    d.l(8, 10, 15, 14, STONE[3]);
    d.l(12, 7, 12, 10, STONE[3]);
    d.r(5, 6, 3, 2, '#6aa83a');
    d.p(16, 15, '#6aa83a');
  },
  summoner_e: (d) => {
    d.ring(12, 12, 7, d.c);
    orb(d, 12, 12, 2, SPIRIT);
    wisp(d, 12, 4, ICE, 1);
    wisp(d, 19, 15, ICE, -1);
    wisp(d, 5, 16, ICE, 1);
  },
  summoner_r: (d) => {
    d.l(0, 10, 6, 10, d.dk, 2);
    d.l(1, 15, 6, 15, d.dk, 2);
    d.o(14, 12, 8, SPIRIT[3]);
    d.o(14, 12, 7, SPIRIT[2]);
    d.o(14, 12, 5, SPIRIT[1]);
    arc(d, 14, 12, 6, 0, PI * 1.2, SPIRIT[0]);
    d.r(11, 10, 2, 3, INK);
    d.r(16, 10, 2, 3, INK);
    d.o(14, 15, 1, INK);
  },
  summoner_a: (d) => {
    for (let i = 0; i < 6; i++) {
      const a = (i * PI) / 3 - PI / 2;
      const x = 12 + Math.cos(a) * 9;
      const y = 12 + Math.sin(a) * 9;
      const nx = -Math.sin(a) * 2.6;
      const ny = Math.cos(a) * 2.6;
      d.poly([12, 12, 12 + Math.cos(a) * 5 + nx, 12 + Math.sin(a) * 5 + ny, x, y, 12 + Math.cos(a) * 5 - nx, 12 + Math.sin(a) * 5 - ny], ICE[2]);
      d.l(12, 12, x, y, ICE[1]);
    }
    d.o(12, 12, 2, ICE[0]);
    d.p(12, 12, '#6cc8ff');
  },
  summoner_s: (d) => {
    for (const k of [0, 1, 2]) slash(d, 6 + k * 5, 2, 2 + k * 6, 21, 3, '#ff5a3a', '#ffd0b0');
    d.poly([18, 3, 23, 9, 20, 9, 20, 15, 16, 15, 16, 9, 13, 9], '#ffe060');
    d.p(18, 5, '#ffffff');
  },
  summoner_d: (d) => {
    ground(d, 20, '#3a2a1a', '#6a4a2a');
    const vine = (pts: number[]) => {
      for (let i = 0; i + 3 < pts.length; i += 2) d.l(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], '#3a7a2a', 2);
      for (let i = 0; i + 3 < pts.length; i += 2) d.l(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], '#8ad85a');
    };
    vine([5, 20, 3, 15, 6, 11, 4, 7]);
    vine([12, 20, 14, 14, 11, 9, 13, 3]);
    vine([19, 20, 21, 16, 18, 12, 20, 8]);
    for (const [x, y] of [[2, 13], [7, 9], [15, 12], [10, 7], [22, 14], [17, 10], [14, 4]] as const) d.p(x, y, '#e8ffb0');
  },
  summoner_f: (d) => {
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = 2 + t * 17;
      const y = 14 + Math.sin(t * PI * 2) * 4;
      d.o(x, y, t > 0.9 ? 2 : 1.4 - t * 0.6, i % 4 < 2 ? BOLT[2] : BOLT[1]);
    }
    d.o(20, 13, 3, BOLT[2]);
    d.r(20, 12, 1, 1, '#ffffff');
    d.l(22, 14, 23, 15, '#ff4a5a');
    d.l(19, 10, 17, 7, BOLT[1]);
    bolt(d, [20, 17, 18, 20, 21, 21, 19, 24], '#fff4a0', '#ffffff', 1);
    bolt(d, [9, 19, 7, 22, 9, 23], '#fff4a0', '#ffffff', 1);
  },
  summoner_ult: (d) => {
    d.ring(12, 13, 10, '#ff6a2a', 2);
    ellf(d, 12, 13, 8, 8, '#3a0a0a');
    flame(d, 6, 22, 6, 3);
    flame(d, 18, 22, 6, 3);
    d.poly([4, 13, 9, 7, 15, 6, 21, 9, 23, 13, 18, 14, 22, 18, 14, 18, 8, 17, 4, 15], '#e8501a');
    d.poly([9, 7, 15, 6, 21, 9, 22, 11, 10, 10], '#ff9a3a');
    d.poly([23, 13, 17, 15, 22, 18], INK);
    d.p(21, 14, '#ffffff');
    d.p(19, 16, FIRE[1]);
    d.r(14, 9, 3, 2, '#fff060');
    d.p(15, 9, INK);
    d.l(10, 7, 4, 1, '#d8361a', 2);
    d.l(13, 6, 11, 0, '#ff7a1a', 2);
    d.poly([4, 13, 0, 9, 2, 15], '#d8361a');
  },
  summoner_id: (d) => {
    for (const [x0, y0, x1, y1] of [[8, 6, 3, 1], [8, 7, 1, 6], [16, 6, 21, 1], [16, 7, 23, 6], [12, 4, 12, 0]] as const) d.l(x0, y0, x1, y1, WOOD[1], 2);
    d.o(4, 2, 2, '#4a9a3a');
    d.o(20, 2, 2, '#4a9a3a');
    d.o(12, 1, 2, '#6ac85a');
    d.poly([5, 6, 19, 6, 20, 24, 4, 24], WOOD[1]);
    d.l(8, 7, 8, 23, WOOD[2]);
    d.l(16, 7, 16, 23, WOOD[2]);
    d.r(7, 11, 3, 2, '#9affd8');
    d.r(14, 11, 3, 2, '#9affd8');
    d.r(9, 16, 6, 2, INK);
    d.l(5, 9, 19, 9, WOOD[0]);
    d.p(1, 20, '#6ac85a');
    d.p(22, 20, '#6ac85a');
  },
  summoner_x: (d) => {
    d.ring(17, 12, 5, '#ff5a5a');
    d.l(15, 10, 19, 14, '#ff8a8a');
    d.l(19, 10, 15, 14, '#ff8a8a');
    for (const [x, c] of [[1, d.dk], [5, d.c], [9, d.lt]] as const) {
      d.l(x, 6, x + 4, 12, c, 2);
      d.l(x + 4, 12, x, 18, c, 2);
    }
    d.p(22, 4, d.lt);
    d.p(22, 20, d.lt);
  },
  summoner_dodge: (d) => {
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      d.o(3 + t * 13, 20 - Math.sin(t * PI * 0.9) * 11, i > 2 ? 1 : 0.4, i % 2 ? SPIRIT[1] : SPIRIT[2]);
    }
    d.o(18, 14, 3, SPIRIT[2]);
    d.o(18, 14, 2, SPIRIT[1]);
    d.p(17, 13, '#ffffff');
    d.p(17, 14, INK);
    d.p(19, 14, INK);
    d.l(20, 17, 22, 20, SPIRIT[2]);
    d.l(16, 17, 15, 20, SPIRIT[2]);
  },

  // ================================================================ SORCERESS — elemental magic
  sorceress_basic: (d) => {
    for (let i = 0; i < 5; i++) d.o(2 + i * 2.2, 20 - i * 1.6, 0.3 + i * 0.35, i % 2 ? ARCANE[1] : ARCANE[2]);
    d.poly([15, 4, 20, 10, 15, 16, 10, 10], ARCANE[2]);
    d.poly([15, 6, 18, 10, 15, 14, 12, 10], ARCANE[1]);
    d.r(14, 9, 2, 2, '#ffffff');
    spark(d, 21, 4, 1, ARCANE[1]);
    spark(d, 8, 5, 1, ARCANE[1]);
  },
  sorceress_q: (d) => {
    d.poly([12, 5, 19, 12, 1, 23], FIRE[3]);
    d.poly([13, 7, 17, 11, 4, 20], FIRE[2]);
    d.poly([14, 9, 16, 11, 8, 17], FIRE[1]);
    d.o(15, 9, 6, FIRE[3]);
    d.o(15, 9, 5, FIRE[2]);
    d.o(15, 9, 3, FIRE[1]);
    d.o(16, 8, 1, FIRE[0]);
    d.p(5, 15, FIRE[1]);
    d.p(9, 21, FIRE[2]);
    d.p(21, 3, FIRE[1]);
  },
  sorceress_w: (d) => {
    for (let x = 2; x < 9; x += 2) for (let y = 4; y < 21; y += 2) if (((x + y) >> 1) % 2) d.p(x, y, ARCANE[2]);
    figure(d, 1, 5, mix(0xb05aff, -0.4));
    d.l(9, 12, 13, 12, ARCANE[1]);
    d.ring(17, 12, 5, ARCANE[2]);
    spark(d, 17, 12, 4, ARCANE[1]);
    d.p(17, 4, '#ffffff');
    d.p(22, 7, ARCANE[1]);
    d.p(21, 18, ARCANE[1]);
  },
  sorceress_e: (d) => {
    d.l(1, 22, 18, 5, ICE[3], 4);
    d.l(1, 22, 18, 5, ICE[2], 2);
    d.l(3, 20, 18, 5, ICE[0]);
    d.poly([23, 0, 14, 4, 20, 10], ICE[1]);
    d.l(22, 1, 17, 6, '#ffffff');
    d.poly([9, 14, 6, 9, 11, 12], ICE[1]);
    d.poly([12, 11, 15, 16, 10, 13], ICE[1]);
    d.p(4, 14, ICE[0]);
    d.p(13, 21, ICE[0]);
  },
  sorceress_r: (d) => {
    d.l(1, 1, 12, 12, FIRE[3], 5);
    d.l(2, 1, 12, 11, FIRE[2], 3);
    d.l(4, 3, 12, 11, FIRE[1], 1);
    d.o(15, 15, 6, '#5a2a1a');
    d.o(14, 14, 4, '#8a4a2a');
    d.r(16, 17, 3, 1, FIRE[1]);
    d.p(18, 12, FIRE[1]);
    d.l(12, 15, 13, 16, FIRE[1]);
    d.p(12, 12, FIRE[0]);
    d.p(13, 13, '#c87a4a');
  },
  sorceress_a: (d) => {
    for (const [x, y] of [[3, 4], [20, 8], [6, 20], [19, 20]] as const) {
      d.o(x, y, 2, mix(0x4ad0ff, -0.5));
      d.p(x, y, '#ffffff');
    }
    bolt(d, [3, 4, 8, 8, 6, 9, 12, 12], BOLT[2], '#ffffff');
    bolt(d, [12, 12, 15, 9, 16, 11, 20, 8], BOLT[2], '#ffffff');
    bolt(d, [12, 12, 10, 16, 8, 16, 6, 20], BOLT[2], '#ffffff');
    bolt(d, [12, 12, 15, 15, 14, 17, 19, 20], BOLT[2], '#ffffff');
    d.o(12, 12, 1, '#fff4a0');
  },
  sorceress_s: (d) => {
    d.ring(12, 12, 10, ICE[2], 2);
    d.ring(12, 12, 7, ICE[3], 1);
    d.l(12, 5, 12, 19, ICE[0]);
    d.l(5, 12, 19, 12, ICE[0]);
    d.l(7, 7, 17, 17, ICE[1]);
    d.l(17, 7, 7, 17, ICE[1]);
    for (const [x, y] of [[12, 5], [12, 19], [5, 12], [19, 12]] as const) {
      d.p(x - 1 + (x === 12 ? 0 : 1), y - 1 + (y === 12 ? 0 : 1), ICE[1]);
    }
    d.r(11, 11, 3, 3, ICE[0]);
  },
  sorceress_d: (d) => {
    cloud(d, 12, 6, '#4a5468', '#7a849a');
    d.r(4, 8, 17, 2, '#3a4458');
    bolt(d, [12, 10, 9, 15, 13, 15, 10, 22], '#fff4a0', '#ffffff');
    bolt(d, [5, 11, 4, 15, 6, 16, 4, 19], BOLT[2], BOLT[0], 1);
    bolt(d, [19, 11, 20, 14, 18, 15, 20, 19], BOLT[2], BOLT[0], 1);
    d.p(16, 18, BOLT[1]);
    d.p(7, 21, BOLT[1]);
  },
  sorceress_f: (d) => {
    d.poly([8, 12, 24, 0, 24, 24], ARCANE[3]);
    d.poly([8, 12, 24, 4, 24, 20], ARCANE[2]);
    d.poly([8, 12, 24, 8, 24, 16], ARCANE[1]);
    spark(d, 17, 5, 1, '#ffffff');
    spark(d, 20, 17, 1, '#ffffff');
    d.o(6, 12, 3, ARCANE[1]);
    d.o(6, 12, 1, '#ffffff');
    d.r(1, 9, 3, 7, SKIN[1]);
    d.r(2, 7, 1, 3, SKIN[1]);
    d.r(0, 15, 3, 2, ARCANE[3]);
  },
  sorceress_ult: (d) => {
    for (const [x, y, s] of [[5, 4, 2], [16, 3, 3], [10, 12, 3], [20, 13, 2], [5, 18, 2]] as const) {
      d.l(x - 4, y - 4, x - 1, y - 1, ARCANE[2], 2);
      spark(d, x, y, s, s > 2 ? '#fff4a0' : ARCANE[1], '#ffffff');
    }
    d.r(0, 22, 24, 2, ARCANE[3]);
    d.l(0, 22, 23, 22, ARCANE[1]);
  },
  sorceress_id: (d) => {
    d.r(5, 2, 14, 2, '#c89048');
    d.r(5, 20, 14, 2, '#c89048');
    d.poly([7, 4, 17, 4, 13, 12, 17, 20, 7, 20, 11, 12], '#e0d8f8');
    d.poly([8, 5, 16, 5, 12.5, 11, 11.5, 11], ARCANE[2]);
    d.poly([12, 13, 16, 19, 8, 19], ARCANE[1]);
    bolt(d, [3, 6, 9, 11, 6, 13, 13, 19], '#ffe060', '#ffffff', 1);
    spark(d, 20, 9, 2, ARCANE[1]);
    spark(d, 4, 17, 1, ARCANE[1]);
  },
  sorceress_dodge: (d) => {
    for (let x = 2; x < 11; x += 2) for (let y = 4; y < 21; y += 2) if ((x + y) % 4 === 0) d.p(x, y, ARCANE[2]);
    spark(d, 16, 11, 5, ARCANE[1]);
    spark(d, 7, 19, 1, ARCANE[1]);
    spark(d, 21, 4, 1, ARCANE[1]);
  },

  // ================================================================ TEMPLAR — halberd, seals of light
  templar_basic: (d) => {
    halberd(d, 4, 22, 19, 3);
  },
  templar_q: (d) => {
    halberd(d, 2, 13, 22, 13);
    spark(d, 2, 13, 3, d.lt);
    d.poly([20, 2, 24, 5, 20, 8], d.lt);
    d.l(14, 5, 20, 5, d.lt, 2);
    d.poly([4, 16, 0, 19, 4, 22], d.lt);
    d.l(4, 19, 10, 19, d.lt, 2);
  },
  templar_w: (d) => {
    ellf(d, 12, 12, 10, 10, SEAL[3]);
    seal(d, 12, 12, 10, SEAL[2], SEAL[1]);
    d.l(12, 0, 12, 3, '#ffffff');
    d.l(12, 21, 12, 23, '#ffffff');
    d.l(0, 12, 2, 12, '#ffffff');
    d.l(21, 12, 23, 12, '#ffffff');
  },
  templar_e: (d) => {
    d.ring(12, 12, 9, SEAL[2], 2);
    d.ring(12, 12, 10, SEAL[1], 1);
    for (const a of [PI / 4, (PI * 3) / 4, (PI * 5) / 4, (PI * 7) / 4]) {
      const x = 12 + Math.cos(a) * 7.5;
      const y = 12 + Math.sin(a) * 7.5;
      d.l(x, y, 12 + Math.cos(a) * 3.5, 12 + Math.sin(a) * 3.5, '#ffffff', 2);
      d.poly([12 + Math.cos(a) * 2, 12 + Math.sin(a) * 2, 12 + Math.cos(a + 0.6) * 5, 12 + Math.sin(a + 0.6) * 5, 12 + Math.cos(a - 0.6) * 5, 12 + Math.sin(a - 0.6) * 5], SEAL[0]);
    }
    d.o(12, 12, 1, SEAL[2]);
  },
  templar_r: (d) => {
    d.l(0, 23, 13, 10, GOLD[2], 4);
    d.l(1, 22, 14, 9, GOLD[1], 2);
    d.l(3, 20, 15, 8, '#ffffff');
    d.poly([22, 1, 13, 5, 19, 11], GOLD[0]);
    d.poly([21, 2, 15, 5, 19, 9], '#ffffff');
    d.l(12, 7, 17, 12, GOLD[1], 2);
    spark(d, 6, 9, 1, GOLD[0]);
    spark(d, 17, 19, 1, GOLD[0]);
  },
  templar_a: (d) => {
    cres(d, 12, 12, 8, -PI * 0.9, -PI * 0.1, 3, d.c, d.lt);
    cres(d, 12, 12, 8, PI * 0.1, PI * 0.9, 3, d.dk, d.c);
    halberd(d, 3, 21, 21, 3);
  },
  templar_s: (d) => {
    ellf(d, 12, 19, 10, 3.5, SEAL[3]);
    ell(d, 12, 19, 10, 3.5, SEAL[1]);
    ell(d, 12, 19, 6, 2, SEAL[2]);
    kite(d, 6, 2, 12, 16, SEAL[2], '#e8fcff');
    d.l(12, 4, 12, 14, SEAL[2]);
    d.l(8, 7, 16, 7, SEAL[2]);
    d.o(12, 7, 1, SEAL[3]);
    d.p(8, 4, '#ffffff');
  },
  templar_d: (d) => {
    seal(d, 12, 12, 5, GOLD[1], GOLD[0]);
    const chain = (x0: number, y0: number, x1: number, y1: number) => {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
        const y = y0 + ((y1 - y0) * (i + 0.5)) / n;
        if (i % 2) d.ring(x, y, 1, GOLD[1]);
        else d.r(x - 1, y - 1, 2, 2, GOLD[0]);
      }
    };
    chain(1, 1, 8, 8);
    chain(23, 1, 16, 8);
    chain(1, 23, 8, 16);
    chain(23, 23, 16, 16);
  },
  templar_f: (d) => {
    ground(d, 17, '#2a3a4a', SEAL[3]);
    d.poly([12, 17, 13, 19, 23, 19, 13, 20, 12, 24, 11, 20, 0, 19, 11, 19], GOLD[1]);
    d.l(1, 19, 22, 19, '#ffffff');
    d.l(12, 18, 12, 23, '#ffffff');
    d.l(4, 16, 2, 12, GOLD[0]);
    d.l(20, 16, 22, 12, GOLD[0]);
    d.l(7, 14, 6, 10, GOLD[0]);
    d.l(17, 14, 18, 10, GOLD[0]);
    halberd(d, 12, -2, 12, 18);
  },
  templar_ult: (d) => {
    ellf(d, 12, 11, 11, 11, mix(0xffd070, -0.65));
    seal(d, 12, 11, 11, GOLD[1], GOLD[2], '#ffffff');
    d.r(10, 0, 4, 24, GOLD[1]);
    d.r(0, 9, 24, 4, GOLD[1]);
    d.r(11, 0, 2, 24, '#ffffff');
    d.r(0, 10, 24, 2, '#ffffff');
    d.o(12, 11, 2, '#ffffff');
  },
  templar_id: (d) => {
    for (const [x, y] of [[5, 5], [19, 5], [12, 19]] as const) {
      d.l(x, y, 12, 11, SEAL[1]);
      d.o(x, y, 4, SEAL[3]);
      d.ring(x, y, 4, SEAL[2]);
      d.r(x - 1, y - 1, 2, 2, SEAL[0]);
    }
    spark(d, 12, 11, 4, GOLD[1], '#ffffff');
  },
  templar_dodge: (d) => {
    speed(d, [5, 9, 13], 0, 9, d.lt);
    ellf(d, 15, 18, 8, 3, SEAL[3]);
    ell(d, 15, 18, 8, 3, SEAL[1]);
    ell(d, 15, 18, 4, 1.5, SEAL[2]);
    d.poly([11, 7, 15, 7, 15, 13, 19, 13, 19, 16, 11, 16], STEEL[2]);
    d.r(11, 7, 4, 2, STEEL[1]);
  },

  // ---------------------------------------------------------------- generic dodge (boot + wind)
  dodge: (d) => {
    d.poly([8, 6, 13, 6, 13, 15, 18, 15, 18, 19, 8, 19], '#8a6a4a');
    d.r(8, 17, 10, 2, '#5a3a22');
    d.r(8, 6, 5, 2, '#a88a6a');
    d.poly([13, 8, 6, 10, 13, 12], '#f4f4ff');
    d.l(1, 10, 6, 10, '#d8f0ff');
    d.l(0, 14, 6, 14, '#d8f0ff');
    d.l(2, 18, 6, 18, '#d8f0ff');
  },
};

const cache = new Map<string, string>();

/** Resolves `sk_<icon>` to a drawer; unknown `*_dodge` ids fall back to the generic dodge icon. */
function drawerFor(id: string): Icon | undefined {
  if (!id.startsWith('sk_')) return undefined;
  const k = id.slice(3);
  return ICONS[k] ?? (k.endsWith('_dodge') ? ICONS.dodge : undefined);
}

export function hasSkillIcon(id: string): boolean {
  return !!drawerFor(id);
}

/** Data URL for an ability icon (`sk_<skillId>`), tinted by the skill colour. */
export function skillIconUrl(id: string, color: number): string {
  const key = id + ':' + color;
  const hit = cache.get(key);
  if (hit) return hit;
  const ult = id.endsWith('_ult');
  const ident = id.endsWith('_id');
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  // background: tinted vignette (Awakenings glow brighter in the centre)
  const grad = g.createRadialGradient(N / 2, N / 2 - 3, 2, N / 2, N / 2, N * 0.75);
  grad.addColorStop(0, mix(color, ult ? -0.1 : -0.35));
  grad.addColorStop(1, mix(color, ult ? -0.8 : -0.88));
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  // foreground on its own layer (for the outline pass)
  const fg = document.createElement('canvas');
  fg.width = fg.height = N;
  const f = fg.getContext('2d')!;
  const px = (x: number, y: number, c: C) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    f.fillStyle = c;
    f.fillRect(x, y, 1, 1);
  };
  const d: P = {
    c: mix(color, 0),
    lt: mix(color, 0.45),
    dk: mix(color, -0.4),
    wh: '#f4f4ff',
    p: px,
    r: (x, y, w, h, c) => {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px(x + i, y + j, c);
    },
    l: (x0, y0, x1, y1, c, w = 1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(x + a - ((w - 1) >> 1), y + b - ((w - 1) >> 1), c);
      }
    },
    o: (cx, cy, r, c) => {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) if (Math.hypot(x, y) <= r + 0.3) px(cx + x, cy + y, c);
    },
    ring: (cx, cy, r, c, w = 1) => {
      for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) if (Math.abs(Math.hypot(x, y) - r) < 0.5 * w + 0.15) px(cx + x, cy + y, c);
    },
    poly: (pts, c) => {
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const tx = x + 0.5;
          const ty = y + 0.5;
          let inside = false;
          for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
            const xi = pts[i];
            const yi = pts[i + 1];
            const xj = pts[j];
            const yj = pts[j + 1];
            if (yi > ty !== yj > ty && tx < ((xj - xi) * (ty - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) px(x, y, c);
        }
    },
  };
  drawerFor(id)?.(d);
  // dark outline around the glyph
  const img = f.getImageData(0, 0, N, N);
  const a = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && a[(y * N + x) * 4 + 3] > 0;
  g.fillStyle = 'rgba(8,6,14,0.9)';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  g.drawImage(fg, 0, 0);
  // bevelled frame
  if (ult) {
    // Awakening: gold frame with bright corners
    g.fillStyle = '#ffd060';
    g.fillRect(0, 0, N, 1);
    g.fillRect(0, 0, 1, N);
    g.fillStyle = '#a8701a';
    g.fillRect(0, N - 1, N, 1);
    g.fillRect(N - 1, 0, 1, N);
    g.fillStyle = 'rgba(255,224,140,0.45)';
    g.fillRect(1, 1, N - 2, 1);
    g.fillRect(1, 1, 1, N - 2);
    g.fillRect(1, N - 2, N - 2, 1);
    g.fillRect(N - 2, 1, 1, N - 2);
    g.fillStyle = '#fff6d0';
    for (const [x, y] of [[0, 0], [N - 2, 0], [0, N - 2], [N - 2, N - 2]]) g.fillRect(x, y, 2, 2);
  } else {
    if (ident) {
      g.fillStyle = mix(color, 0.2).replace('rgb', 'rgba').replace(')', ',0.55)');
      g.fillRect(1, 1, N - 2, 1);
      g.fillRect(1, 1, 1, N - 2);
      g.fillRect(1, N - 2, N - 2, 1);
      g.fillRect(N - 2, 1, 1, N - 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 0, N, 1);
    g.fillRect(0, 0, 1, N);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, N - 1, N, 1);
    g.fillRect(N - 1, 0, 1, N);
  }
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
