import { hash2 } from '../../core/Rng';
import { defineTex, shade } from './atlas';
import { leafPainter } from './trees';

/**
 * Vegetation textures (sheet 4 «Кусты и растительность», section 12 palettes): bush leaves,
 * grass blade cut-outs (green / dry / field / swamp / snow), flower petals in six colours,
 * berries, mushroom caps, ferns, dry wood, cactus, snow, lily pads, cattails, vines.
 */

// bush leaves (листва кусты)
defineTex('leaf_bush', leafPainter([0x2a5a24, 0x3a7a2e, 0x4e9a3a, 0x72b850], 0.04));
defineTex('leaf_bush_dark', leafPainter([0x16381a, 0x214a22, 0x2c5e2a, 0x3e7434], 0.04));
defineTex('leaf_bush_light', leafPainter([0x4a8a2e, 0x62a23a, 0x80bc4a, 0xa8d46a], 0.04));
defineTex('leaf_snowy', (x, y, h) => {
  // snow-dusted leaves: snow on the top rows
  if (y < 4 + (hash2(x, 1, 7) * 3 | 0)) return shade(hash2(x, y, 9) > 0.5 ? 0xe6eef4 : 0xc8d4e0, 0.96 + h(1) * 0.05);
  return shade(hash2(x >> 1, y >> 1, 11) > 0.5 ? 0x2a4a2e : 0x1e3a24, 0.92 + h(1) * 0.1);
});

/** Grass blades cut-out: blades of varying height growing from the bottom edge. */
function blades(cols: readonly number[], minH: number, tips?: number) {
  return (x: number, y: number, h: (a: number, b?: number) => number) => {
    const bh = minH + Math.floor(hash2(x, 5, 13) * (16 - minH));
    const top = 15 - bh;
    if (y < top || hash2(x, 7, 17) < 0.18) return -1;
    if (tips !== undefined && y <= top + 1 && hash2(x, 9, 19) > 0.6) return tips;
    const t = (y - top) / Math.max(1, bh);
    const c = t < 0.3 ? cols[3] : t < 0.6 ? cols[2] : t < 0.85 ? cols[1] : cols[0];
    return shade(c, 0.92 + h(1) * 0.12);
  };
}
// grass palette: #1E4A24 #4F7A34 #8CA83A #C8C060 (section 12 «трава»)
defineTex('grass_blades', blades([0x1e4a24, 0x2e6a2a, 0x4f8a34, 0x7aae44], 6));
defineTex('grass_blades_tall', blades([0x1e4a24, 0x3a6e2a, 0x5a9234, 0x9ab848], 10, 0xc8c060));
defineTex('grass_blades_dry', blades([0x5a3e1e, 0x8a6430, 0xb8904a, 0xd4b06a], 7));
defineTex('grass_blades_field', blades([0x2a5a24, 0x4f7a34, 0x8ca83a, 0xc8c060], 8, 0xe0d070));
defineTex('grass_blades_swamp', blades([0x1a3a2a, 0x24503a, 0x2e6648, 0x4a7a52], 8));
defineTex('grass_blades_desert', blades([0x6a5a20, 0x9a8a2a, 0xc0b040, 0xd8c860], 7));

// flowers: white #F4F0E6, yellow #F2C230, red #C8202A, blue #3A6AE0, purple #7A3AC8, pink #E87AC8
export const FLOWER_COLS: Record<string, number> = {
  white: 0xf4f0e6,
  yellow: 0xf2c230,
  red: 0xc8202a,
  blue: 0x3a6ae0,
  purple: 0x8a4ad8,
  pink: 0xe87ac8,
};
for (const [k, c] of Object.entries(FLOWER_COLS)) {
  // petals: a 4-petal cross with a yellow/orange centre, repeated in 8x8 cells
  defineTex('petal_' + k, (x, y, h) => {
    const cx = (x & 7) - 3.5;
    const cy = (y & 7) - 3.5;
    const d = Math.abs(cx) + Math.abs(cy);
    if (Math.abs(cx) < 1 && Math.abs(cy) < 1) return k === 'yellow' ? 0xb86a10 : 0xf2c230;
    return shade(c, (cy < 0 ? 1.06 : 0.9) * (d > 3 ? 0.85 : 1) * (0.95 + h(1) * 0.08));
  });
}
defineTex('flower_stem', (x, y, h) => shade(hash2(x, y >> 2, 21) > 0.5 ? 0x3a7a2e : 0x2e6226, 0.92 + h(1) * 0.12));

// berries / fruit: red #B01828, blue #2A48C0, orange #E07A20
defineTex('berry_red', (x, y, h) => ((x & 3) === 1 && (y & 3) === 1 ? 0xff8a8a : shade(0xb01828, 0.88 + h(1) * 0.2)));
defineTex('berry_blue', (x, y, h) => ((x & 3) === 1 && (y & 3) === 1 ? 0xa0b8ff : shade(0x2a48c0, 0.88 + h(1) * 0.2)));
defineTex('fruit_orange', (x, y, h) => ((x & 3) === 1 && (y & 3) === 1 ? 0xffd08a : shade(0xe07a20, 0.88 + h(1) * 0.2)));

// mushrooms: red #C83030, brown #A07858, purple #6A3AA0, glow blue #6A8AFF
function cap(base: number, spot: number) {
  return (x: number, y: number, h: (a: number, b?: number) => number) => {
    const s = hash2(x >> 2, y >> 2, 29) > 0.62 && (x & 3) > 0 && (y & 3) > 0 && (x & 3) < 3;
    return s ? spot : shade(base, 0.9 + h(1) * 0.15);
  };
}
defineTex('cap_red', cap(0xc83030, 0xf4ece0));
defineTex('cap_brown', cap(0xa07858, 0xd8c0a0));
defineTex('cap_purple', cap(0x6a3aa0, 0xc8a8f0));
defineTex('cap_glow', cap(0x4a6aff, 0xd8f0ff));
defineTex('gill', (x, y, h) => shade(x & 1 ? 0xb8a890 : 0xd8ccb4, 0.95 + h(1) * 0.06));

// ferns / broad leaves
defineTex('fern', (x, y, h) => {
  // central rib with paired leaflets
  if (x === 7 || x === 8) return shade(0x3a6a22, 0.9 + h(1) * 0.1);
  const lf = (y + Math.abs(x - 7.5)) % 4 < 2.6;
  if (!lf || Math.abs(x - 7.5) > 7 - y * 0.15) return -1;
  return shade(hash2(x >> 1, y >> 1, 31) > 0.5 ? 0x4e9a3a : 0x3a7e2e, 0.92 + h(1) * 0.12);
});
defineTex('leaf_broad', (x, y, h) => {
  const rib = x === 7 || ((x - 7.5) * 0.6 + 8 - y) % 5 < 0.6;
  return shade(rib ? 0x8ac860 : hash2(x >> 2, y >> 2, 33) > 0.5 ? 0x4a9a34 : 0x3e8a2e, 0.93 + h(1) * 0.1);
});
defineTex('leaf_tropic', (x, y, h) => {
  const rib = x === 7 || x === 8;
  const slit = (y & 3) === 0 && Math.abs(x - 7.5) > 3;
  if (slit) return -1;
  return shade(rib ? 0x9ad470 : hash2(x >> 2, y >> 1, 35) > 0.5 ? 0x2e8a3a : 0x24743a, 0.92 + h(1) * 0.1);
});

// dry / dead vegetation: #6A4A2A #8A6A3A #B08A5A #D0B080
defineTex('twig_dry', (x, y, h) => shade(hash2(x, y >> 1, 37) > 0.5 ? 0xb08a5a : 0x8a6a3a, 0.9 + h(1) * 0.15));
defineTex('dead_wood', (x, y, h) => {
  const ridge = (x + Math.floor(hash2(x >> 2, y >> 3, 39) * 2)) % 4;
  return shade(ridge === 0 ? 0x3a2a1e : ridge === 1 ? 0x5a4632 : 0x6e5a44, 0.92 + h(1) * 0.12);
});
defineTex('dead_wood_end', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 6.8) return shade(0x4a3a2a, 0.9 + h(1) * 0.15);
  if (hash2(x, y, 41) > 0.93) return 0x3a2c20; // cracks
  return shade(Math.floor(d / 1.8) & 1 ? 0x8a6e4e : 0xa08460, 0.94 + h(1) * 0.08);
});
defineTex('cactus', (x, y, h) => {
  if (x % 5 === 0) return shade(0x2e5a24, 0.9);
  if (x % 5 === 2 && y % 4 === 1) return 0xe8e0b0; // spines
  return shade(hash2(x, y >> 2, 43) > 0.5 ? 0x5a8a34 : 0x4a7a2e, 0.93 + h(1) * 0.1);
});
// snow: #A8B4C8 #C0CCDC #D8E2EE #F0F6FA
defineTex('snow', (x, y, h) => {
  const r = h(1);
  return r > 0.8 ? 0xf0f6fa : r > 0.45 ? 0xd8e2ee : r > 0.15 ? 0xc0ccdc : 0xa8b4c8;
});

// swamp: #4A6A2A #3A5A2A #2A4A3A #1E5A4A #1E4A4A
defineTex('lily_pad', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 7.6 || (x >= 7 && x <= 8 && y > 8)) return -1; // round pad with a notch
  if (Math.abs(x - 7.5) < 0.6 || Math.abs(y - 7.5) < 0.6) return shade(0x6a9a3a, 0.95);
  return shade(d > 6 ? 0x2e5a24 : hash2(x >> 1, y >> 1, 45) > 0.5 ? 0x4a7a2e : 0x3e6a28, 0.93 + h(1) * 0.1);
});
defineTex('cattail', (x, y, h) => shade(hash2(x, y, 47) > 0.6 ? 0x8a5a2a : 0x6a3e1e, 0.9 + h(1) * 0.15));
defineTex('reed', (x, y, h) => shade(y % 6 === 0 ? 0x3a5a22 : hash2(x, y >> 2, 49) > 0.5 ? 0x6a9a3a : 0x5a8a30, 0.93 + h(1) * 0.1));
defineTex('algae', (x, y, h) => {
  if (hash2(x, 3, 51) < 0.35 || y < Math.floor(hash2(x, 4, 53) * 8)) return -1;
  return shade(hash2(x >> 1, y >> 1, 55) > 0.5 ? 0x1e5a4a : 0x2a7a5a, 0.9 + h(1) * 0.15);
});
defineTex('water_still', (x, y, h) => shade((x + 2 * y) % 9 === 0 ? 0x4aa0c8 : h(2) > 0.5 ? 0x24688e : 0x1e5a80, 0.95 + h(1) * 0.08));

// vines / lianas
defineTex('vine_stem', (x, y, h) => shade((x + y) % 3 === 0 ? 0x4a3a1e : 0x5e4a26, 0.9 + h(1) * 0.15));
defineTex('vine_leaves', (x, y, h) => {
  const cx = (x & 3) - 1.5;
  const cy = ((y + (x >> 2) * 2) & 3) - 1.5;
  const on = cx * cx + cy * cy < 3.4 && hash2(x >> 2, (y + (x >> 2) * 2) >> 2, 57) > 0.2;
  if (!on) return -1;
  return shade(hash2(x >> 2, y >> 2, 59) > 0.5 ? 0x3a8a34 : 0x2a6e2a, (cy < 0 ? 1.08 : 0.9) + h(1) * 0.08);
});
