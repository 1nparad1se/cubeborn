import { hash2 } from '../../core/Rng';
import { PAL, defineTex, mix, shade, type Painter } from './atlas';

/**
 * Sheet 3 «Скалы и каменистая местность»: the ten 16x16 rock variants (section 2) plus the
 * cave/ruin extras (purple crystals, rails, waterfall, castle banner). Big chunky 8x8 / 4x8
 * blocks with lit top-left rims and dark seams, palettes from section 12.
 */

export const ROCK_PAL = {
  grey: [0x4a4250, 0x6e6674, 0x80788a, 0x948c9a, 0xaaa2ae],
  dark: [0x1c1a20, 0x2c2a32, 0x38363e, 0x45434b, 0x55525a],
  speck: [0x3a3440, 0x5c5660, 0x6c6670, 0x7e7880, 0x8e8890],
  sandstone: [0x8a5a2e, 0xc8885a, 0xd89a68, 0xe6ae7a, 0xf0c090],
  red: [0x3e1a10, 0x6e2e1c, 0x8a3c24, 0xa04a2c, 0xb45a36],
  weathered: [0x4a4248, 0x6e646a, 0x857a7e, 0x9a8e90, 0xaea2a2],
  dirt: [0x4a2a18, 0x7a4426, 0x96582e, 0xae6c3a, 0xc4844a],
  snow: [0x5a6a8a, 0x8a9ab8, 0xb8c6dc, 0xd8e2f0, 0xf2f6fc],
  crystal: [0x2a1260, 0x5a2ac0, 0x8a50f0, 0xb88cff, 0xe8d8ff],
};

/** Chunky rock: irregular 8x8 blocks split into halves, lit upper-left rim, dark seams. */
function rock(cols: readonly number[], o: { moss?: number; cracks?: number; speck?: number; snow?: number; dirt?: number } = {}): Painter {
  return (x, y, h) => {
    const row = y >> 3;
    const off = row & 1 ? 4 : 0;
    const bx = (x + off) >> 3;
    const id = hash2(bx * 5 + 1, row * 3 + 2, 33);
    // some blocks split vertically into two 4-wide stones
    const split = id > 0.82;
    const lx = split ? (x + off) & 3 : (x + off) & 7;
    const W = split ? 3 : 7;
    const ly = y & 7;
    if (lx === W || ly === 7) return shade(cols[0], 0.95 + h(2) * 0.1);
    const sub = split ? hash2(((x + off) >> 2) * 7, row, 34) : id;
    let c = cols[1 + Math.floor(sub * (cols.length - 1)) % (cols.length - 1)];
    let k = 0.93 + h(1) * 0.12;
    if (lx === 0 || ly === 0) k *= 1.16;
    if (lx === W - 1 || ly === 6) k *= 0.82;
    if (o.cracks && hash2(x >> 0, (y + x) >> 1, 63) > 1 - o.cracks && lx > 0 && ly > 0) return shade(cols[0], 1.05);
    if (o.speck && h(5) > 1 - o.speck) c = h(6) > 0.5 ? 0xb0aab4 : 0x2c2830;
    if (o.moss && hash2(x >> 1, y >> 1, 64) < o.moss * (1.2 - y / 16)) c = PAL.moss[1 + Math.floor(h(4) * 3)];
    if (o.snow && (ly < 3 + Math.floor(hash2(x, row, 65) * 3) || hash2(x >> 1, y >> 1, 66) < o.snow)) c = ROCK_PAL.snow[2 + Math.floor(h(4) * 3)];
    if (o.dirt && hash2(x >> 1, y >> 1, 67) < o.dirt) c = ROCK_PAL.dirt[1 + Math.floor(h(4) * 3)];
    return shade(c, k);
  };
}

// section 2: the ten variants
defineTex('rock_grey', rock(ROCK_PAL.grey));
defineTex('rock_dark', rock(ROCK_PAL.dark));
defineTex('rock_speckled', rock(ROCK_PAL.speck, { speck: 0.12 }));
defineTex('rock_sandstone', rock(ROCK_PAL.sandstone));
defineTex('rock_red', rock(ROCK_PAL.red));
defineTex('rock_weathered', rock(ROCK_PAL.weathered, { cracks: 0.05 }));
defineTex('rock_moss', rock(ROCK_PAL.grey, { moss: 0.55 }));
defineTex('rock_cracked', rock(ROCK_PAL.grey, { cracks: 0.14 }));
defineTex('rock_dirt', rock(ROCK_PAL.red, { dirt: 0.5 }));
defineTex('rock_snow', rock(ROCK_PAL.grey, { snow: 0.25 }));
/** Rock top: same blocks plus scattered moss / grass tufts (tops of crags). */
defineTex('rock_top', rock(ROCK_PAL.grey, { moss: 0.3 }));
/** Mountain path flagstones: warm worn slabs (sheet section 4). */
defineTex('path_flag', (x, y, h) => {
  const row = y >> 2;
  const off = (row & 1) * 3;
  const lx = (x + off) % 6;
  if (lx === 5 || (y & 3) === 3) return shade(0x4a3428, 1);
  const id = hash2(Math.floor((x + off) / 6), row, 81);
  const base = mix(0x8a6a58, 0xa8826a, id);
  let k = 0.92 + h(1) * 0.12;
  if (lx === 0 || (y & 3) === 0) k *= 1.12;
  return shade(h(7) > 0.93 ? PAL.moss[2] : base, k);
});
defineTex('crystal_purple', (x, y, h) => {
  const d = Math.abs(x - 7.5) + (15 - y) * 0.2;
  const c = d < 2 ? ROCK_PAL.crystal[4] : d < 4 ? ROCK_PAL.crystal[3] : d < 6 ? ROCK_PAL.crystal[2] : ROCK_PAL.crystal[1];
  return shade(c, 0.92 + h(1) * 0.14);
});
defineTex('crystal_blue', (x, y, h) => {
  const d = Math.abs(x - 7.5) + (15 - y) * 0.2;
  const c = d < 2 ? 0xe0f4ff : d < 4 ? 0x8ac8ff : d < 6 ? 0x3a8ae8 : 0x1a4aa0;
  return shade(c, 0.92 + h(1) * 0.14);
});
/** Rail track: iron rails on dark sleepers (top face). */
defineTex('rail_track', (x, y, h) => {
  if (x === 3 || x === 12) return shade(0x8a8e96, 0.9 + h(1) * 0.15);
  if (x === 4 || x === 11) return shade(0x4a4c52, 1);
  if ((y & 3) < 2) return shade(PAL.woodDark[2], 0.9 + h(2) * 0.15);
  return shade(0x2a2420, 0.9 + h(1) * 0.2);
});
/** Falling water sheet (cave/ruins waterfall). */
defineTex('waterfall', (x, y, h) => {
  const s = hash2(x, (y + x * 3) >> 2, 91);
  return s > 0.8 ? 0xd8f4ff : s > 0.45 ? shade(0x5ab0e8, 0.95 + h(1) * 0.1) : shade(0x2a78c8, 0.95 + h(1) * 0.1);
});
/** Red banner with a gold emblem (towers, castle, cave temple). */
defineTex('banner_gold', (x, y, h) => {
  if (x === 0 || x === 15) return shade(0xd8a838, 0.9 + h(1) * 0.15);
  const dx = Math.abs(x - 7.5);
  if (y > 4 && y < 11 && dx + Math.abs(y - 7.5) < 4) return shade(0xf0c040, 0.9 + h(1) * 0.15);
  return shade(y > 13 ? 0x7a1414 : 0xb02424, 0.9 + h(2) * 0.12);
});
/** Dark cave mouth interior (fades to black). */
defineTex('cave_dark', (x, y, h) => shade(0x0e0c10, 0.8 + h(1) * 0.5));
