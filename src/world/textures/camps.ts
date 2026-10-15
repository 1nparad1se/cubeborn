import { hash2 } from '../../core/Rng';
import { PAL, defineTex, ramp, shade, type Painter } from './atlas';

/**
 * Camp textures (sheet 5 «Лагеря», section 6 «Материалы и цвета»): tent canvas in the four camp
 * palettes (bandit red, light canvas, forest green, orc hide), torn canvas with holes, camp
 * banners per faction, tower stone bricks and a bound-stake palisade log. Self-registers on import.
 */

/** Tent canvas: vertical panels with stitched seams every 8 px and a darker hem. */
function canvas(cols: readonly number[], torn = 0): Painter {
  return (x, y, h) => {
    if (torn && hash2(x >> 1, y >> 1, 917) < torn && y > 3) return -1;
    if (torn && hash2(x >> 1, y >> 1, 917) < torn + 0.08 && y > 3) return shade(cols[0], 0.9);
    if ((x & 7) === 0) return shade(cols[1], 0.92);
    if ((x & 7) === 1 && (y & 1) === 0) return shade(cols[3], 0.95);
    let c = hash2(x >> 1, y >> 2, 31) > 0.85 ? cols[3] : cols[2];
    if (y >= 14) c = cols[0];
    if (h(4) > 0.95) c = cols[1];
    const weave = ((x + y) & 1) === 0 ? 1.03 : 0.97;
    return shade(c, weave * (0.96 + h(1) * 0.07));
  };
}

const RED = [0x4a0e0e, 0x761a1a, 0x9a2420, 0xb2342a];
const WHITE = [0x9a8e78, 0xbfb49c, 0xd8ccb2, 0xece2c8];
const GREEN = [0x2a3a24, 0x3e5232, 0x52683e, 0x6a8048];
const HIDE = [0x3e2a1a, 0x5a3e26, 0x76563a, 0x8e6e4c];
const GREY = [0x5a5852, 0x76736a, 0x938f84, 0xaaa69a];

defineTex('camp_canvas_red', canvas(RED));
defineTex('camp_canvas_white', canvas(WHITE));
defineTex('camp_canvas_green', canvas(GREEN));
defineTex('camp_canvas_hide', canvas(HIDE));
defineTex('camp_canvas_torn', canvas(GREY, 0.1));

/** Banner cloth with a pale emblem; `glyph` picks the faction sign (all original). */
function banner(cols: readonly number[], glyph: 'claw' | 'skull' | 'leaf' | 'torn', ink: number): Painter {
  return (x, y, h) => {
    // swallow-tail cut at the bottom
    if (y >= 13 && Math.abs(x - 7.5) < (y - 12) * 1.6) return -1;
    if (glyph === 'torn' && hash2(x >> 1, y >> 1, 77) < 0.14 && y > 2) return -1;
    if (x === 0 || x === 15 || y === 0) return shade(cols[0], 1);
    let c = ramp(cols, 0.5 + hash2(x, y >> 2, 3) * 0.4);
    if (((x + (y >> 1)) & 1) === 0) c = shade(c, 1.04);
    let on = false;
    if (glyph === 'claw') on = ((x === 7 || x === 8) && y >= 4 && y <= 11) || (y >= 3 && y <= 6 && (x === 4 || x === 11)) || (y === 7 && x >= 4 && x <= 11) || (y === 3 && (x === 7 || x === 8));
    if (glyph === 'skull') on = (y >= 3 && y <= 7 && x >= 5 && x <= 10 && !((y === 5) && (x === 6 || x === 9))) || (y === 8 && (x === 6 || x === 8 || x === 10)) || (y === 10 && (x === 4 || x === 11)) || (y === 11 && (x === 5 || x === 10));
    if (glyph === 'leaf') on = (Math.abs(x - 7.5) + Math.abs(y - 7) * 0.7 < 4) && !(x === 7 || x === 8) || ((x === 7 || x === 8) && y >= 4 && y <= 12);
    if (glyph === 'torn') on = (x === 7 || x === 8) && y >= 4 && y <= 9;
    return on ? shade(ink, 0.95 + h(1) * 0.08) : shade(c, 0.96 + h(2) * 0.06);
  };
}
defineTex('camp_banner_bandit', banner(RED, 'claw', 0xe8d8b0));
defineTex('camp_banner_orc', banner([0x1e1a18, 0x2e2622, 0x3e332c, 0x4e4238], 'skull', 0xd8ccb0));
defineTex('camp_banner_forest', banner(GREEN, 'leaf', 0xd8d0a0));
defineTex('camp_banner_torn', banner([0x4a1a16, 0x6a2a22, 0x7e3a30, 0x8e4a3a], 'torn', 0xb8a888));

/** Tower stone: offset blocks of 8x4 with mortar, moss specks low down. */
defineTex('camp_brick', (x, y, h) => {
  const row = y >> 2;
  const off = (row & 1) * 4;
  const bx = (x + off) >> 3;
  if ((y & 3) === 3 || ((x + off) & 7) === 7) return shade(PAL.stone[1], 0.95);
  const c = ramp([0x55555c, 0x6e6e76, 0x85858c, 0x9a9aa0], hash2(bx, row, 11));
  let k = 0.94 + h(1) * 0.1;
  if ((y & 3) === 0) k *= 1.1;
  return shade(c, k);
});

/** Rough palisade log: vertical bark streaks with a pale cut face line. */
defineTex('camp_log', (x, y, h) => {
  const s = hash2(x, y >> 2, 5);
  const c = s > 0.8 ? 0x3a2414 : s > 0.4 ? 0x5a3a22 : 0x6e4a2c;
  return shade(c, (x === 0 || x === 15 ? 0.8 : 1) * (0.95 + h(1) * 0.08));
});

/** Thatch / reed for forest huts. */
defineTex('camp_thatch', (x, y, h) => {
  const s = hash2(x, y >> 1, 61);
  const c = ramp([0x5a4a20, 0x7a6428, 0x9a8034, 0xb89a48], s);
  return shade(c, (y & 3) === 3 ? 0.78 : 0.95 + h(1) * 0.1);
});

/** Iron bars of a cage (transparent between bars). */
defineTex('camp_bars', (x, y) => {
  if ((x & 7) === 2 || (x & 7) === 3) return shade(PAL.metal[1], x & 1 ? 0.9 : 1.15);
  if (y === 0 || y === 15) return PAL.metal[0];
  return -1;
});
