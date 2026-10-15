import { hash2 } from '../../core/Rng';

/**
 * Shared world texture library: 16x16 procedural pixel tiles in the soft blocky MCD-like style,
 * full colour (not tinted grey), drawn from the palettes of the world asset reference sheets.
 * Props (src/world/props) and the ground (road surfaces, see groundTiles.ts) both use them.
 *
 * Pure data (no THREE / DOM): `paintTile` returns RGBA pixels, `buildWorldAtlas` packs every
 * registered tile into one atlas image that the prop renderer uploads as a texture.
 *
 * Add a texture: `defineTex('name', (x, y, h) => hex)` in any module imported before the atlas is
 * built (keep shared ones here; a category may also define its own at the top of its file).
 * `h(a, b?)` is a per-texture deterministic hash for pixel noise.
 */

export const TEX_PX = 16;

/** Pixel painter: returns a 0xRRGGBB colour (or -1 for a transparent pixel). */
export type Painter = (x: number, y: number, h: (a: number, b?: number) => number, v: number) => number;

interface TexDef {
  name: string;
  paint: Painter;
}

const DEFS: TexDef[] = [];
const INDEX = new Map<string, number>();

/** Registers a texture (re-defining a name replaces it). Returns its atlas index. */
export function defineTex(name: string, paint: Painter): number {
  const i = INDEX.get(name);
  if (i !== undefined) {
    DEFS[i].paint = paint;
    return i;
  }
  DEFS.push({ name, paint });
  INDEX.set(name, DEFS.length - 1);
  return DEFS.length - 1;
}

/** Atlas index of a texture; unknown names fall back to the magenta "missing" tile (index 0). */
export function texId(name: string): number {
  return INDEX.get(name) ?? 0;
}

export function hasTex(name: string): boolean {
  return INDEX.has(name);
}

export function texNames(): string[] {
  return DEFS.map((d) => d.name);
}

// ---------------------------------------------------------------- colour helpers

export function shade(hex: number, k: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * k)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * k)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * k)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Picks from a dark→light ramp by a 0..1 value. */
export function ramp(cols: readonly number[], t: number): number {
  return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(t * cols.length)))];
}

/** Pixel of a tile (RGBA 0..255, alpha 0 for transparent pixels). Variant v reseeds the noise. */
export function paintTile(name: string, v = 0): Uint8Array {
  const out = new Uint8Array(TEX_PX * TEX_PX * 4);
  const def = DEFS[texId(name)];
  const seed = 1013 + texId(name) * 97 + v * 7919;
  const h = (a: number, b = 0) => hash2(a, b, seed);
  for (let y = 0; y < TEX_PX; y++)
    for (let x = 0; x < TEX_PX; x++) {
      const c = def.paint(x, y, (a, b = 0) => h(a * 31 + x * 3 + 7, b * 17 + y * 5 + 3) , v);
      const i = (y * TEX_PX + x) * 4;
      if (c < 0) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = (c >> 16) & 255;
      out[i + 1] = (c >> 8) & 255;
      out[i + 2] = c & 255;
      out[i + 3] = 255;
    }
  return out;
}

/** Atlas layout: `cols` tiles per row; tile i sits at column i % cols, row floor(i / cols) (row 0 at the top). */
export interface WorldAtlas {
  data: Uint8Array;
  cols: number;
  rows: number;
  width: number;
  height: number;
  count: number;
}

export const ATLAS_COLS = 16;

export function buildWorldAtlas(): WorldAtlas {
  const count = DEFS.length;
  const cols = ATLAS_COLS;
  const rows = Math.max(1, Math.ceil(count / cols));
  const width = cols * TEX_PX;
  const height = rows * TEX_PX;
  const data = new Uint8Array(width * height * 4);
  DEFS.forEach((d, i) => {
    const px = paintTile(d.name);
    const ox = (i % cols) * TEX_PX;
    const oy = Math.floor(i / cols) * TEX_PX;
    for (let y = 0; y < TEX_PX; y++) data.set(px.subarray(y * TEX_PX * 4, (y + 1) * TEX_PX * 4), ((oy + y) * width + ox) * 4);
  });
  return { data, cols, rows, width, height, count };
}

// ---------------------------------------------------------------- palettes (from the sheets)

export const PAL = {
  // wood: crates/cargo sheet
  wood: [0x3e2a1e, 0x6d4c3a, 0x8b5e3c, 0xa67b4e],
  woodDark: [0x2a1c12, 0x3e2a1a, 0x5b3a24, 0x7a5a3a],
  woodLight: [0x6b4f32, 0x8c6a3f, 0xb88a53, 0xd4b07a],
  woodOld: [0x2e241a, 0x4a3a2a, 0x6b5440, 0x8c7a62],
  metal: [0x2b2b2b, 0x4a4a4a, 0x6b6b6b, 0x8a8a8a, 0xa0a7b0],
  cloth: [0x5e4d3a, 0x7d6b52, 0xa8926d, 0xc9b89a],
  straw: [0x6a5018, 0x8c6b1f, 0xb9963a, 0xd4b04f, 0xe6c86a],
  stone: [0x2a2a2a, 0x3f3f3f, 0x5e5e5e, 0x7a7a7a, 0x9a9a9a, 0xc3c3c3],
  stoneP: [0x3e3a44, 0x58525e, 0x766e7a, 0x8e8690, 0xa8a0a8],
  moss: [0x2e4a24, 0x3a5a2a, 0x4f7a34, 0x6a9a3e],
  leaf: [0x1b5e20, 0x2e7d32, 0x388e3c, 0x4caf50, 0x81c784],
  bark: [0x3e2723, 0x4e342e, 0x5d4037, 0x6d4c41, 0x8d6e63],
  red: [0x5a1010, 0x8b1e1e, 0xb02a24, 0xd04432],
  green: [0x1e4a24, 0x2e6b2e, 0x3b7f3b, 0x5aa04a],
  white: [0x9a9080, 0xc0b8a6, 0xddd5c2, 0xf0ead8],
  fire: [0xfff4b3, 0xffd166, 0xff8a00, 0xff3b00],
  dirt: [0x4a3020, 0x6a4428, 0x8a5a34, 0xa6744a],
  sand: [0xb8945a, 0xd4b07a, 0xe2c48e, 0xf0d8a6],
  mud: [0x2e2418, 0x3e3020, 0x4e3e2a, 0x5e4e34],
};

// ---------------------------------------------------------------- shared tiles

defineTex('missing', (x, y) => ((x >> 2) + (y >> 2)) & 1 ? 0xff00ff : 0x200020);

/** Horizontal planks, `rows` px tall each, with dark seams, end joints and grain streaks. */
function planks(cols: readonly number[], rowH = 4, seamK = 0.55): Painter {
  return (x, y, h) => {
    const row = Math.floor(y / rowH);
    const ry = y % rowH;
    // staggered end joint per row
    const joint = Math.floor(hash2(row, 3, 77) * 16);
    if (ry === rowH - 1) return shade(cols[0], 0.95);
    if (x === joint) return shade(cols[1], seamK + 0.25);
    const base = cols[1 + (Math.floor(hash2(row, x > joint ? 1 : 0, 51) * (cols.length - 1)) % (cols.length - 1))];
    let k = 0.94 + h(1) * 0.1;
    if (ry === 0) k *= 1.1; // lit upper edge of each board
    if (hash2(x >> 2, row * 7 + ry, 13) > 0.82) k *= 0.88; // grain streaks
    return shade(base, k);
  };
}

defineTex('plank', planks(PAL.wood));
defineTex('plank_dark', planks(PAL.woodDark));
defineTex('plank_light', planks(PAL.woodLight));
defineTex('plank_old', (x, y, h, v) => {
  const c = planks(PAL.woodOld)(x, y, h, v);
  return hash2(x, y >> 1, 91) > 0.93 ? shade(c, 0.7) : c; // cracks
});
/** Vertical planks (doors, walls, crates seen on end). */
defineTex('plank_v', (x, y, h, v) => planks(PAL.wood)(y, x, h, v));
defineTex('plank_v_dark', (x, y, h, v) => planks(PAL.woodDark)(y, x, h, v));

/** Solid beam: lengthwise grain along x, a lit top edge and a dark bottom edge. */
function beam(cols: readonly number[]): Painter {
  return (x, y, h) => {
    if (y === 0) return shade(cols[3], 1.02);
    if (y === 15) return shade(cols[0], 1);
    const g = hash2(x >> 2, y, 33);
    let c = g > 0.7 ? cols[1] : g > 0.25 ? cols[2] : cols[3];
    if (h(2) > 0.92) c = shade(c, 0.85);
    return shade(c, 0.95 + h(1) * 0.08);
  };
}
defineTex('beam', beam(PAL.wood));
defineTex('beam_dark', beam(PAL.woodDark));
defineTex('beam_old', beam(PAL.woodOld));
/** End grain of a beam or post: growth rings. */
defineTex('wood_end', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (x === 0 || y === 0 || x === 15 || y === 15) return PAL.wood[0];
  const ring = Math.floor(d / 2.2) & 1;
  return shade(ring ? PAL.wood[2] : PAL.wood[3], 0.95 + h(1) * 0.08);
});
defineTex('log_end', (x, y, h) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 7.2) return shade(PAL.bark[1], 0.9 + h(1) * 0.15);
  const ring = Math.floor(d / 1.8) & 1;
  return shade(ring ? 0xb08a5a : 0xc8a06a, 0.94 + h(1) * 0.08);
});
/** Bark: vertical ridges. */
defineTex('bark', (x, y, h) => {
  const ridge = (x + Math.floor(hash2(x >> 1, y >> 2, 5) * 2)) % 4;
  const c = ridge === 0 ? PAL.bark[0] : ridge === 1 ? PAL.bark[2] : PAL.bark[3];
  return shade(c, 0.92 + h(1) * 0.12);
});
defineTex('leaves', (x, y, h) => {
  const r = hash2(x >> 1, y >> 1, 9);
  if (h(3) > 0.94) return -1;
  return shade(r > 0.75 ? PAL.leaf[4] : r > 0.45 ? PAL.leaf[3] : r > 0.2 ? PAL.leaf[2] : PAL.leaf[1], 0.92 + h(1) * 0.1);
});

// crates: a dark frame around the face and one diagonal brace (MCD crate)
function crateFace(cols: readonly number[], brace: 'diag' | 'cross' | 'none', iron = false): Painter {
  const inner = planks([cols[0], cols[1], cols[2], cols[3]], 4);
  return (x, y, h, v) => {
    const edge = x <= 1 || y <= 1 || x >= 14 || y >= 14;
    if (iron && ((x <= 2 && y <= 2) || (x >= 13 && y <= 2) || (x <= 2 && y >= 13) || (x >= 13 && y >= 13))) {
      // metal corner caps with a rivet
      if ((x === 1 || x === 14) && (y === 1 || y === 14)) return PAL.metal[4];
      return shade(PAL.metal[2], 0.9 + h(1) * 0.15);
    }
    if (edge) {
      const lit = x <= 1 && y > 1 ? 1.05 : y <= 1 ? 1.12 : 0.85;
      return shade(cols[1], lit * (0.95 + h(2) * 0.08));
    }
    if (x === 2 || y === 2 || x === 13 || y === 13) return shade(cols[0], 1);
    if (brace === 'diag' && Math.abs(x - y) <= 1) return shade(cols[2], x - y === -1 ? 0.8 : 1.08);
    if (brace === 'cross' && (Math.abs(x - y) <= 1 || Math.abs(x + y - 15) <= 1)) return shade(cols[2], 1.05);
    return inner(x, y, h, v);
  };
}
defineTex('crate', crateFace(PAL.wood, 'diag'));
defineTex('crate_top', crateFace(PAL.wood, 'cross'));
defineTex('crate_plain', crateFace(PAL.wood, 'none'));
defineTex('crate_iron', crateFace(PAL.wood, 'diag', true));
defineTex('crate_iron_top', crateFace(PAL.wood, 'cross', true));
defineTex('crate_dark', crateFace(PAL.woodDark, 'diag'));
defineTex('crate_old', crateFace(PAL.woodOld, 'diag'));

/** Barrel staves with two iron hoops. */
defineTex('barrel', (x, y, h) => {
  if (y === 2 || y === 3 || y === 12 || y === 13) return shade(y === 2 || y === 12 ? PAL.metal[3] : PAL.metal[1], 0.95 + h(1) * 0.1);
  const stave = x % 4;
  if (stave === 3) return PAL.wood[0];
  const c = stave === 0 ? PAL.wood[3] : PAL.wood[2];
  const bulge = 1 - Math.abs(y - 7.5) / 30;
  return shade(c, bulge * (0.92 + h(1) * 0.1));
});
defineTex('barrel_top', (x, y, h) => {
  const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  if (d > 6.5) return shade(PAL.metal[2], 0.95 + h(1) * 0.1);
  if (d > 5.5) return PAL.wood[0];
  if (x % 5 === 4) return PAL.wood[1];
  if (d < 1.2) return PAL.wood[0]; // bung
  return shade(PAL.wood[3], 0.92 + h(1) * 0.1);
});

// metal
defineTex('metal', (x, y, h) => {
  let c = shade(PAL.metal[2], 0.92 + h(1) * 0.12);
  if (y === 0) c = PAL.metal[3];
  if (y === 15) c = PAL.metal[1];
  return c;
});
defineTex('metal_dark', (x, y, h) => {
  if ((x === 3 || x === 12) && (y === 3 || y === 12)) return PAL.metal[3]; // rivets
  return shade(PAL.metal[1], 0.9 + h(1) * 0.15);
});
defineTex('gold', (x, y, h) => shade(h(4) > 0.85 ? 0xfff0a0 : 0xd8a838, 0.9 + h(1) * 0.15));
defineTex('chain', (x, y) => {
  const link = (y >> 2) & 1;
  const inLink = link ? x >= 6 && x <= 9 : x >= 5 && x <= 10;
  if (!inLink) return -1;
  const hole = link ? false : (x === 7 || x === 8) && (y & 3) !== 0 && (y & 3) !== 3;
  return hole ? -1 : shade(PAL.metal[3], (y & 3) === 0 ? 1.15 : 0.95);
});

// fabric and sacks
defineTex('sack', (x, y, h) => {
  const weave = ((x + y) & 1) === 0 ? 1.04 : 0.96;
  let c = ramp(PAL.cloth, 0.55 + h(1) * 0.45);
  if (h(3) > 0.95) c = PAL.cloth[1];
  return shade(c, weave);
});
defineTex('sack_tied', (x, y, h, v) => (y >= 6 && y <= 7 ? shade(0x6a4a2a, 0.9 + h(1) * 0.2) : (DEFS[texId('sack')].paint(x, y, h, v))));
function cloth(cols: readonly number[]): Painter {
  return (x, y, h) => {
    const weave = ((x + (y >> 1)) & 1) === 0 ? 1.03 : 0.97;
    let c = cols[2];
    if (y >= 14) c = cols[1];
    if (h(2) > 0.93) c = cols[3];
    if (h(5) < 0.04) c = cols[1];
    return shade(c, weave * (0.97 + h(1) * 0.06));
  };
}
defineTex('cloth_red', cloth(PAL.red));
defineTex('cloth_white', cloth(PAL.white));
defineTex('cloth_green', cloth(PAL.green));
defineTex('cloth_brown', cloth(PAL.cloth));
/** Bandit banner: red cloth with a pale trident-like emblem (original glyph). */
defineTex('banner_red', (x, y, h, v) => {
  const base = cloth(PAL.red)(x, y, h, v);
  if (x <= 0 || x >= 15) return shade(PAL.red[0], 1);
  const em = (x === 7 || x === 8) && y >= 4 && y <= 12;
  const prongs = (y >= 4 && y <= 6 && (x === 4 || x === 11)) || (y === 7 && x >= 4 && x <= 11);
  return em || prongs ? 0xe8d8b0 : base;
});
defineTex('rope', (x, y, h) => shade(((x + y) & 3) < 2 ? 0x9a7a4a : 0x7a5a32, 0.92 + h(1) * 0.12));
defineTex('leather', (x, y, h) => shade(h(3) > 0.9 ? 0x5e4a2e : 0x8b6f47, 0.92 + h(1) * 0.1));

// straw / hay
defineTex('hay', (x, y, h) => {
  // vertical strands with darker gaps
  const s = hash2(x, y >> 2, 45);
  let c = s > 0.8 ? PAL.straw[4] : s > 0.45 ? PAL.straw[3] : s > 0.15 ? PAL.straw[2] : PAL.straw[1];
  if (y === 5 || y === 10) c = shade(0x6a4a24, 1); // binding twine
  return shade(c, 0.94 + h(1) * 0.1);
});
defineTex('hay_top', (x, y, h) => {
  const s = hash2(x >> 1, y >> 1, 46);
  return shade(s > 0.6 ? PAL.straw[4] : s > 0.3 ? PAL.straw[3] : PAL.straw[2], 0.9 + h(1) * 0.14);
});

// stone family (sheet 3 / 9 palettes): blocky bricks with lit upper-left rims
function stoneBlocks(cols: readonly number[], moss = 0, cracks = 0): Painter {
  return (x, y, h) => {
    const row = y >> 3;
    const off = row & 1 ? 4 : 0;
    const bx = ((x + off) >> 3) & 1;
    const lx = (x + off) & 7;
    const ly = y & 7;
    const id = hash2(bx + row * 3, row, 21);
    if (lx === 7 || ly === 7) return shade(cols[0], 1);
    let c = cols[1 + Math.floor(id * (cols.length - 2))];
    let k = 0.94 + h(1) * 0.1;
    if (lx === 0 || ly === 0) k *= 1.14;
    if (lx === 6 || ly === 6) k *= 0.84;
    if (cracks && hash2(x, y >> 1, 61) > 1 - cracks && lx > 1 && ly > 1) return shade(cols[0], 1.1);
    if (moss && hash2(x >> 1, y >> 1, 62) < moss * (1 - y / 22)) c = PAL.moss[1 + Math.floor(h(4) * 3)];
    return shade(c, k);
  };
}
defineTex('stone', stoneBlocks(PAL.stoneP));
defineTex('stone_grey', stoneBlocks(PAL.stone.slice(1)));
defineTex('stone_dark', stoneBlocks([0x1e1c22, 0x2e2c34, 0x3a3842, 0x46444e]));
defineTex('stone_mossy', stoneBlocks(PAL.stoneP, 0.45));
defineTex('stone_cracked', stoneBlocks(PAL.stoneP, 0, 0.12));
defineTex('sandstone', stoneBlocks([0x8a6a3a, 0xc89a5a, 0xd8ae6e, 0xe6c286]));
defineTex('stone_red', stoneBlocks([0x4a1e14, 0x8a3a24, 0xa44a2e, 0xb85a3a]));
/** Plain smooth stone (bowls, slabs, pillar caps). */
defineTex('stone_smooth', (x, y, h) => {
  let k = 0.95 + h(1) * 0.08;
  if (y === 0 || x === 0) k = 1.12;
  if (y === 15 || x === 15) k = 0.8;
  return shade(PAL.stoneP[3], k);
});
defineTex('cobble', (x, y, h) => {
  const gx = Math.floor((x + (((y >> 2) & 1) * 2)) / 4);
  const gy = y >> 2;
  const lx = (x + (((y >> 2) & 1) * 2)) & 3;
  const ly = y & 3;
  if (lx === 3 || ly === 3) return shade(PAL.stoneP[0], 1);
  const id = hash2(gx, gy, 71);
  let k = 0.92 + h(1) * 0.1;
  if (lx === 0 || ly === 0) k *= 1.12;
  return shade(PAL.stoneP[1 + Math.floor(id * 3)], k);
});
defineTex('coal', (x, y, h) => {
  const r = h(1);
  if (r > 0.93) return 0xff6a10;
  if (r > 0.88) return 0xb83a08;
  return shade(r > 0.5 ? 0x2a2420 : 0x1a1614, 0.9 + h(2) * 0.3);
});
defineTex('ash', (x, y, h) => shade(h(1) > 0.6 ? 0x5a5550 : 0x46423e, 0.92 + h(2) * 0.12));

// ground-ish tiles usable on props
defineTex('dirt', (x, y, h) => shade(ramp(PAL.dirt, 0.3 + h(1) * 0.7), 0.95 + h(2) * 0.08));
defineTex('sand', (x, y, h) => shade(ramp(PAL.sand, 0.4 + h(1) * 0.6), 0.97 + h(2) * 0.05));
defineTex('mud', (x, y, h) => shade(ramp(PAL.mud, h(1)), 0.95 + h(2) * 0.1));
defineTex('grass_top', (x, y, h) => shade(h(1) > 0.8 ? 0x78b44c : h(1) > 0.3 ? 0x6aa842 : 0x5a9438, 0.95 + h(2) * 0.08));
defineTex('moss', (x, y, h) => shade(ramp(PAL.moss, h(1)), 0.95 + h(2) * 0.1));

// lights: lantern glass, flames, crystals, glowstone, glowing mushrooms
defineTex('lantern_glass', (x, y, h) => {
  // warm core fading to orange at the rim, one bright flame stroke in the middle
  const d = Math.max(Math.abs(x - 7.5) / 8, Math.abs(y - 9) / 8);
  if ((x === 7 || x === 8) && y >= 5 && y <= 12) return y < 8 ? 0xfffbe0 : 0xfff4b3;
  return d < 0.45 ? PAL.fire[1] : d < 0.8 ? mix(PAL.fire[1], PAL.fire[2], 0.5) : PAL.fire[2];
});
defineTex('flame', (x, y, h) => {
  const t = y / 15;
  const c = t < 0.3 ? PAL.fire[0] : t < 0.6 ? PAL.fire[1] : t < 0.85 ? PAL.fire[2] : PAL.fire[3];
  return shade(c, 0.95 + h(1) * 0.08);
});
defineTex('ember_bed', (x, y, h) => {
  const r = h(1);
  return r > 0.75 ? PAL.fire[1] : r > 0.4 ? PAL.fire[2] : r > 0.15 ? PAL.fire[3] : 0x7a1a04;
});
defineTex('crystal', (x, y, h) => {
  const d = (x + y) % 8;
  if (d === 0) return 0xd8f4ff;
  return shade(d < 3 ? 0x3b82ff : d < 6 ? 0x2e64e0 : 0x5aa8ff, 0.92 + h(1) * 0.12);
});
defineTex('crystal_cyan', (x, y, h) => {
  const d = (x + y) % 8;
  if (d === 0) return 0xe0ffff;
  return shade(d < 4 ? 0x00e5ff : 0x00b8d8, 0.92 + h(1) * 0.12);
});
defineTex('glowstone', (x, y, h) => {
  const r = hash2(x >> 1, y >> 1, 81);
  if (x % 5 === 0 || y % 5 === 0) return r > 0.5 ? 0x8a5a1a : 0x6a4214;
  return r > 0.6 ? 0xfff0a0 : r > 0.3 ? 0xffd166 : 0xffb030;
});
defineTex('mushroom_glow', (x, y, h) => {
  const spot = hash2(x >> 2, y >> 2, 83) > 0.7 && (x & 3) > 0 && (y & 3) > 0;
  return spot ? 0xd0f8ff : shade(0x3b82ff, 0.9 + h(1) * 0.2);
});
defineTex('mushroom_stem', (x, y, h) => shade(0xd8d4c8, 0.92 + h(1) * 0.1));

// produce (vegetables, fruit), bottles, bones
defineTex('produce', (x, y, h) => {
  const blob = hash2(x >> 2, y >> 2, 87);
  const c = blob > 0.7 ? 0xf2a33a : blob > 0.45 ? 0x3b7f3b : blob > 0.25 ? 0xa6c86a : blob > 0.12 ? 0xc0302a : 0x2e6b2e;
  return shade(c, ((x & 3) === 0 || (y & 3) === 0 ? 0.82 : 1) * (0.94 + h(1) * 0.1));
});
defineTex('cabbage', (x, y, h) => shade((x + y) % 5 === 0 ? 0xc8e080 : 0x6aa83a, 0.9 + h(1) * 0.15));
defineTex('pumpkin', (x, y, h) => shade(x % 4 === 0 ? 0xc06a10 : 0xf2a33a, 0.92 + h(1) * 0.1));
defineTex('apple', (x, y, h) => shade(h(3) > 0.85 ? 0xff8a6a : 0xc0302a, 0.92 + h(1) * 0.1));
defineTex('bottle', (x, y, h) => shade(x < 5 ? 0x7ac87a : 0x2e7a3a, 0.9 + h(1) * 0.1));
defineTex('bone', (x, y, h) => shade(h(2) > 0.85 ? 0xc8bca0 : 0xe8e0c8, 0.95 + h(1) * 0.06));
defineTex('paper', (x, y, h) => (y % 3 === 1 && x > 2 && x < 13 ? 0x8a7a5a : shade(0xe8dcb8, 0.95 + h(1) * 0.06)));
