import { hash2 } from '../../core/Rng';
import { defineTex, shade } from './atlas';

/**
 * Tree textures (sheet 1 «Деревья»): leaf blocks in the sheet palettes (main + shadow tones),
 * bark of oak / birch / pine, moss and ivy. Self-registers on import (trees.ts imports it).
 */

/** Leaf block: 2x2 px leaf clusters in four tones, a few holes (cut-out) and a lit upper-left rim. */
export function leafPainter(cols: readonly number[], holes = 0.05) {
  return (x: number, y: number, h: (a: number, b?: number) => number) => {
    if (h(3) > 1 - holes) return -1;
    const r = hash2(x >> 1, y >> 1, 19);
    // leaf "veins": a darker diagonal speckle pattern like the sheet's oak leaf tiles
    const vein = ((x + 2 * y) & 7) === 0;
    const c = r > 0.88 ? cols[3] : r > 0.6 ? cols[2] : r > 0.28 ? cols[1] : cols[0];
    let k = 0.93 + h(1) * 0.12;
    if (vein) k *= 0.82;
    if (y <= 1 || x <= 1) k *= 1.06;
    return shade(c, k);
  };
}

// greens from the sheet: main #2E7D32 #388E3C #4CAF50 #81C784, shadows #1B5E20 #2E7D32 #245B24 #3E8E41
export const LEAF_OAK = [0x2e7d32, 0x388e3c, 0x4caf50, 0x81c784];
export const LEAF_OAK_DARK = [0x1b5e20, 0x245b24, 0x2e7d32, 0x3e8e41];
export const LEAF_YELLOW = [0xa86a10, 0xd09a1c, 0xe8b830, 0xf6d860];
export const LEAF_AUTUMN = [0x8a2410, 0xb83a18, 0xd85a20, 0xf08a3a];
export const LEAF_BIRCH = [0x4a8a2a, 0x6aa83a, 0x8cc850, 0xb8e07a];
export const LEAF_PINE = [0x10402a, 0x1a5232, 0x24643a, 0x3a7a48];

defineTex('leaf_oak', leafPainter(LEAF_OAK));
defineTex('leaf_oak_dark', leafPainter(LEAF_OAK_DARK));
defineTex('leaf_yellow', leafPainter(LEAF_YELLOW));
defineTex('leaf_yellow_dark', leafPainter([0x7a4a0a, 0xa06a12, 0xc08a1c, 0xd8a838]));
defineTex('leaf_autumn', leafPainter(LEAF_AUTUMN));
defineTex('leaf_autumn_dark', leafPainter([0x5a160a, 0x7e2410, 0xa03418, 0xc04a1e]));
defineTex('leaf_birch', leafPainter(LEAF_BIRCH));
defineTex('leaf_birch_dark', leafPainter([0x2e6a1e, 0x3e7a28, 0x5a9a34, 0x7ab84a]));
defineTex('leaf_pine', (x, y, h) => {
  // needles: short diagonal strokes
  if (h(3) > 0.96) return -1;
  const n = ((x + y) & 3) === 0 || ((x - y) & 7) === 0;
  const r = hash2(x >> 1, y >> 1, 23);
  const c = n ? LEAF_PINE[3] : r > 0.6 ? LEAF_PINE[2] : r > 0.25 ? LEAF_PINE[1] : LEAF_PINE[0];
  return shade(c, 0.92 + h(1) * 0.12);
});

// bark main #5D4037 #6D4C41 #8D6E63 #A1887F, shadows #3E2723 #4E342E
const BARK = [0x3e2723, 0x4e342e, 0x5d4037, 0x6d4c41, 0x8d6e63, 0xa1887f];
defineTex('bark_oak', (x, y, h) => {
  const col = x + Math.floor(hash2(x >> 2, y >> 3, 31) * 2);
  const ridge = col % 4;
  let c = ridge === 0 ? BARK[0] : ridge === 1 ? BARK[2] : ridge === 2 ? BARK[3] : BARK[4];
  if (hash2(x, y >> 1, 37) > 0.93) c = BARK[5];
  return shade(c, 0.92 + h(1) * 0.12);
});
defineTex('bark_oak_dark', (x, y, h) => {
  const ridge = (x + Math.floor(hash2(x >> 2, y >> 3, 41) * 2)) % 4;
  return shade(ridge === 0 ? BARK[0] : ridge === 1 ? BARK[1] : BARK[2], 0.92 + h(1) * 0.12);
});
defineTex('bark_birch', (x, y, h) => {
  // white bark with black horizontal lenticels
  const band = hash2(y, x >> 2, 43) > 0.92 || (hash2(y >> 1, 3, 47) > 0.93 && (x & 7) < 5);
  if (band) return shade(0x2a2622, 0.9 + h(1) * 0.2);
  return shade(hash2(x >> 1, y, 53) > 0.7 ? 0xd8d2c4 : 0xeee8dc, 0.95 + h(1) * 0.06);
});
defineTex('bark_pine', (x, y, h) => {
  const plate = hash2(x >> 2, (y + (x >> 2) * 3) >> 2, 59);
  const edge = (y + (x >> 2) * 3) % 4 === 0 || x % 4 === 0;
  return shade(edge ? 0x3a2418 : plate > 0.5 ? 0x7a4a30 : 0x6a3e28, 0.92 + h(1) * 0.12);
});
defineTex('trunk_top', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 6.5) return shade(BARK[1], 0.9 + h(1) * 0.15);
  return shade(Math.floor(d / 1.7) & 1 ? 0x9a7048 : 0xb88a5a, 0.94 + h(1) * 0.08);
});
// extra elements: moss #556B2F, light moss #6B8E23, ivy #2E7D32, lichen #8D6E63-grey
defineTex('moss_tree', (x, y, h) => {
  if (h(2) > 0.7) return -1;
  return shade(hash2(x >> 1, y >> 1, 61) > 0.5 ? 0x6b8e23 : 0x556b2f, 0.92 + h(1) * 0.12);
});
defineTex('ivy_leaf', (x, y, h) => {
  // small heart-shaped leaves on a thin stem, transparent between
  const cx = (x & 3) - 1.5;
  const cy = (y & 3) - 1.5;
  const on = cx * cx + cy * cy < 3.2 && hash2(x >> 2, y >> 2, 67) > 0.25;
  if (x === 7 || x === 8) return shade(0x3a5a1e, 0.95);
  if (!on) return -1;
  return shade(hash2(x >> 2, y >> 2, 71) > 0.5 ? 0x388e3c : 0x2e7d32, (cy < 0 ? 1.08 : 0.92) + h(1) * 0.08);
});
