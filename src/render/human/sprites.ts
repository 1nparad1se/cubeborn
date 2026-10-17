/**
 * Pixel sprites of the starter weapons (our own pixel art, generated from simple rules so every
 * item reads as a flat Minecraft-style item: a diagonal blade, a shaft, a crystal). A sprite is a
 * square grid of colours ('' = empty); it becomes the inventory icon (drawn to a canvas) and the
 * 3D item (each pixel extruded into a one-pixel-thick block, see itemMeshes.ts).
 */
export type Sprite = { n: number; px: string[] };

function make(n: number, fn: (x: number, y: number, u: number, v: number) => string): Sprite {
  const px: string[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // diagonal coordinates: u along the bottom-left → top-right diagonal (0 .. n-1), v across it
      const u = (x + (n - 1 - y)) / 2;
      const v = x - (n - 1 - y);
      px.push(fn(x, y, u, v));
    }
  return { n, px };
}

/** Outline: an empty pixel next to a filled one becomes dark. */
function outline(s: Sprite, color: string): Sprite {
  const { n, px } = s;
  const out = [...px];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (px[y * n + x]) continue;
      const nb = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const a = x + dx;
        const b = y + dy;
        return a >= 0 && b >= 0 && a < n && b < n && px[b * n + a] && px[b * n + a] !== color;
      });
      if (nb) out[y * n + x] = color;
    }
  return { n, px: out };
}

const IRON = { hi: '#eef0f4', mid: '#c4c8d0', lo: '#8a8e98', dark: '#4a4c56' };
const WOOD = { hi: '#a8763e', mid: '#835a2c', lo: '#5e3e1c' };
const GOLD = { hi: '#ffe27a', mid: '#e0b034', lo: '#a07818' };
const K = '#2a2026';

function blade(v: number): string {
  return v < 0 ? IRON.hi : v === 0 ? IRON.mid : IRON.lo;
}

/** Iron one-handed sword: short blade, small brass guard, leather grip. */
export const SPR_SWORD = outline(
  make(16, (_x, _y, u, v) => {
    const a = Math.abs(v);
    if (u >= 14.5) return a <= 0 ? IRON.hi : '';
    if (u >= 5.5 && a <= 1) return blade(v);
    if (u >= 4 && u < 5.5 && a <= 3) return a === 3 ? GOLD.lo : GOLD.mid;
    if (u >= 1.5 && u < 4 && a <= 0) return u < 2.5 ? WOOD.lo : WOOD.mid;
    if (u >= 1.5 && u < 4 && a === 1) return WOOD.lo;
    if (u >= 0.5 && u < 1.5 && a <= 1) return GOLD.mid;
    return '';
  }),
  K,
);

/** Two-handed guard sword: long wide blade with a fuller, wide steel guard, long grip. */
export const SPR_SWORD2H = outline(
  make(24, (_x, _y, u, v) => {
    const a = Math.abs(v);
    if (u >= 22) return a <= 0 ? IRON.hi : '';
    if (u >= 21 && a <= 1) return blade(v);
    if (u >= 7.5 && a <= 2) return v === 0 ? IRON.dark : v < 0 ? IRON.hi : a === 2 ? IRON.lo : IRON.mid;
    if (u >= 6 && u < 7.5 && a <= 4) return a === 4 ? IRON.dark : IRON.lo;
    if (u >= 2 && u < 6 && a <= 1) return (Math.round(u * 2) % 2 === 0 ? WOOD.lo : '#3a2a20');
    if (u >= 0.5 && u < 2 && a <= 2) return IRON.lo;
    return '';
  }),
  K,
);

/** Militia spear: long ash shaft with an iron leaf head and a wrap below it. */
export const SPR_SPEAR = outline(
  make(30, (_x, _y, u, v) => {
    const a = Math.abs(v);
    if (u >= 28.5) return a === 0 ? IRON.hi : '';
    if (u >= 25 && a <= 1) return blade(v);
    if (u >= 23 && u < 25 && a <= 2) return blade(v);
    if (u >= 22 && u < 23 && a <= 1) return IRON.dark;
    if (u >= 20.5 && u < 22 && a <= 1) return '#d8d0b8';
    if (u >= 0.5 && u < 20.5 && a <= 0) return Math.floor(u) % 5 === 0 ? WOOD.lo : WOOD.hi;
    if (u >= 0.5 && u < 20.5 && a === 1 && v > 0) return WOOD.mid;
    return '';
  }),
  K,
);

/** Small spark staff: short wand with an orange crystal in a brass claw. */
export const SPR_STAFF1H = outline(
  make(16, (_x, _y, u, v) => {
    const a = Math.abs(v);
    if (u >= 12 && u <= 14.5 && a <= 1) return v < 0 || u > 14 ? '#ffe090' : '#ff9a30';
    if (u >= 11 && u < 12 && a <= 2) return a === 2 ? GOLD.lo : GOLD.mid;
    if (u >= 1 && u < 11 && a <= 0) return Math.floor(u) % 4 === 0 ? WOOD.lo : WOOD.hi;
    if (u >= 1 && u < 11 && a === 1 && v > 0) return WOOD.lo;
    return '';
  }),
  K,
);

/** Apprentice staff: tall staff with a blue crystal held by a brass ring. */
export const SPR_STAFF2H = outline(
  make(26, (_x, _y, u, v) => {
    const a = Math.abs(v);
    if (u >= 21 && u <= 24.5 && a <= 2 && !(a === 2 && (u < 21.5 || u > 24))) return v < 0 ? '#c8ecff' : a === 2 ? '#2a64c0' : '#4aa0f0';
    if (u >= 19.5 && u < 21 && a <= 3) return a >= 2 ? GOLD.lo : GOLD.mid;
    if (u >= 0.5 && u < 19.5 && a <= 0) return Math.floor(u) % 6 === 0 ? GOLD.mid : WOOD.mid;
    if (u >= 0.5 && u < 19.5 && a === 1 && v > 0) return WOOD.lo;
    return '';
  }),
  K,
);

/** Hunting bow, vertical (grip in the middle), string on the right; `drawn` pulls the string with an arrow. */
export function bowSprite(drawn: boolean): Sprite {
  const n = 20;
  const px: string[] = new Array(n * n).fill('');
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < n && y < n) px[y * n + x] = c;
  };
  const mid = (n - 1) / 2;
  const pull = drawn ? 4 : 0;
  for (let y = 1; y < n - 1; y++) {
    const d = (y - mid) / (mid - 0.5);
    // limb: an arc bowing to the left
    const lx = Math.round(5 + d * d * 5);
    set(lx, y, Math.abs(d) < 0.18 ? '#3a2a20' : WOOD.mid);
    set(lx + 1, y, Math.abs(d) < 0.18 ? '#5a4030' : WOOD.lo);
    // string: from tip to tip, pulled back at the nock when drawn
    const sx = Math.round(11 + pull * (1 - Math.abs(d)));
    set(sx, y, '#f0ece0');
  }
  if (drawn) {
    // the arrow lies across the bow, pointing left (forward)
    for (let x = 1; x <= 14; x++) set(x, Math.round(mid), x <= 2 ? IRON.mid : x >= 13 ? '#e04040' : WOOD.hi);
    set(1, Math.round(mid) - 1, IRON.lo);
    set(1, Math.round(mid) + 1, IRON.lo);
  }
  return outline({ n, px }, K);
}

/** Light crossbow seen from the side: stock along x, prod across; `loaded` shows a bolt. */
export function crossbowSprite(loaded: boolean): Sprite {
  const n = 20;
  const px: string[] = new Array(n * n).fill('');
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < n && y < n) px[y * n + x] = c;
  };
  // stock: horizontal from x 3 to 18 at rows 9-10, butt widening at the back (right)
  for (let x = 3; x <= 18; x++) {
    set(x, 9, WOOD.hi);
    set(x, 10, WOOD.mid);
  }
  for (let x = 14; x <= 18; x++) set(x, 11, WOOD.lo);
  set(17, 12, WOOD.lo);
  set(18, 12, WOOD.lo);
  // trigger
  set(12, 11, IRON.dark);
  set(12, 12, IRON.dark);
  // prod (bow arms) near the front, vertical (it is seen edge-on from the side)
  for (let y = 4; y <= 15; y++) set(4, y, y === 9 || y === 10 ? IRON.dark : IRON.lo);
  for (let y = 5; y <= 14; y++) set(5, y, IRON.mid);
  // string
  if (loaded) {
    for (let x = 5; x <= 10; x++) set(x, 8, '#e8e4d8');
    for (let x = 1; x <= 10; x++) set(x, 7, x <= 2 ? IRON.hi : x >= 9 ? '#4070c0' : WOOD.lo);
  } else for (let y = 5; y <= 14; y++) set(6, y, '#e8e4d8');
  return outline({ n, px }, K);
}

export const SPR_BOW = bowSprite(false);
export const SPR_BOW_DRAWN = bowSprite(true);
export const SPR_XBOW = crossbowSprite(true);
export const SPR_XBOW_EMPTY = crossbowSprite(false);

/** Shield face (front texture, 10 × 12): oak planks with an iron rim and boss. */
export function shieldFace(x: number, y: number, w: number, h: number): string {
  const rim = x === 0 || y === 0 || x === w - 1 || y === h - 1;
  if (rim) return (x + y) % 3 === 0 ? IRON.hi : IRON.lo;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) return Math.abs(x - cx) < 1 && Math.abs(y - cy) < 1 ? IRON.hi : IRON.mid;
  if (y === 3 || y === h - 4) return IRON.dark;
  const plank = Math.floor((x - 1) / 3);
  return x % 3 === 0 ? WOOD.lo : plank % 2 ? WOOD.mid : WOOD.hi;
}

// ---------------------------------------------------------------- armor icons

export type ArmorPalette = { a: string; b: string; c: string; d: string };
export const ARMOR_PAL: Record<string, ArmorPalette> = {
  // a main, b light, c dark, d trim
  apprentice: { a: '#3c4ea6', b: '#5a70cc', c: '#26306c', d: '#e0b440' },
  scout: { a: '#8a5a32', b: '#a8743e', c: '#5a3a1e', d: '#4e6e30' },
  guard: { a: '#b8bcc6', b: '#e4e6ec', c: '#62666e', d: '#8a6a3a' },
};

/** Inventory icon of an armor piece: a 16-px silhouette per slot in the set's colours. */
export function armorIcon(slot: 'head' | 'hands' | 'feet' | 'body', set: string): Sprite {
  const P = ARMOR_PAL[set] ?? ARMOR_PAL.guard;
  const masks: Record<string, string[]> = {
    head: [
      '................',
      '................',
      '.....bbbbbb.....',
      '....baaaaaab....',
      '...baaaaaaaab...',
      '...aaddddddaa...',
      '...aa......aa...',
      '...aa......aa...',
      '...aa......aa...',
      '...ac......ca...',
      '...cc......cc...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    body: [
      '................',
      '..bbbb....bbbb..',
      '.baaaabbbbaaaab.',
      '.aaaaaadaaaaaaa.',
      '.aaa.aadaaa.aaa.',
      '.cc..aadaaa..cc.',
      '.....aadaaa.....',
      '.....aadaaa.....',
      '.....dddddd.....',
      '.....aaaaaa.....',
      '.....aaaaaa.....',
      '.....cccccc.....',
      '................',
      '................',
      '................',
      '................',
    ],
    hands: [
      '................',
      '................',
      '................',
      '..bbb.....bbb...',
      '..aaa.....aaa...',
      '..aaa.....aaa...',
      '..ddd.....ddd...',
      '.baaab...baaab..',
      '.aaaaa...aaaaa..',
      '.aaaac...caaaa..',
      '.aacc.....ccaa..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    feet: [
      '................',
      '................',
      '................',
      '..bbb.....bbb...',
      '..aaa.....aaa...',
      '..aaa.....aaa...',
      '..ddd.....ddd...',
      '..aaa.....aaa...',
      '..aaa.....aaa...',
      '..aaabb...aaabb.',
      '..aaaaa...aaaaa.',
      '..ccccc...ccccc.',
      '................',
      '................',
      '................',
      '................',
    ],
  };
  const rows = masks[slot];
  const px: string[] = [];
  for (const r of rows) for (const ch of r) px.push(ch === '.' ? '' : P[ch as keyof ArmorPalette]);
  return outline({ n: 16, px }, K);
}

/** Draws a sprite to a canvas (inventory icon), `scale` screen pixels per sprite pixel. */
export function spriteCanvas(s: Sprite, scale = 3): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = s.n * scale;
  const g = c.getContext('2d')!;
  for (let y = 0; y < s.n; y++)
    for (let x = 0; x < s.n; x++) {
      const col = s.px[y * s.n + x];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}
