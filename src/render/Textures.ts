import * as THREE from 'three';
import { TILE_COUNT } from './VoxelFlora';
import { hash2 } from '../core/Rng';

/** Small grayscale "pixel" texture applied to every voxel face for a crafted block look. */
export function makeBlockTexture(px = 8): THREE.DataTexture {
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const edge = x === 0 || y === 0 || x === px - 1 || y === px - 1;
      let v = 0.86 + hash2(x, y, 7) * 0.14;
      if (edge) v *= 0.82;
      if (x === 1 && y === 1) v = Math.min(1, v * 1.08);
      const i = (y * px + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, px, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 16px grayscale texture for hero models: painted 2x2 pixel clusters and faint cloth/metal
 * streaks without the dark block edges, so characters look crafted rather than stacked cubes.
 */
export function makeHeroTexture(): THREE.DataTexture {
  const px = 16;
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const cl = hash2(x >> 1, y >> 1, 41);
      let v = 0.9 + cl * 0.1 + hash2(x, y, 42) * 0.03;
      if (hash2(x >> 2, y, 43) > 0.9) v *= 0.95;
      const i = (y * px + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, v) * 255);
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, px, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Minecraft-mob skin: one 16px tile spans 8 model voxels, so every voxel shows 2x2 painted
 * pixels with a little per-pixel variation, like the pixel skins of Minecraft creatures.
 */
export function makeCreatureTexture(): THREE.DataTexture {
  const px = 16;
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      let v = 0.84 + hash2(x, y, 81) * 0.14;
      if (hash2(x, y, 82) > 0.9) v *= 0.86;
      if (hash2(x >> 1, y >> 1, 83) > 0.85) v *= 1.06;
      const i = (y * px + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, v) * 255);
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, px, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 8, 1 / 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 16px grayscale texture for terrain blocks: clustered stone-like shading, a soft bevel
 * (light top-left, dark bottom-right) and faint cracks, in the style of hand-painted voxel art.
 */
export function makeTerrainBlockTexture(): THREE.DataTexture {
  const px = 16;
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      // 2x2 clusters read as painted pixels rather than noise
      const cl = hash2(x >> 1, y >> 1, 21);
      let v = 0.8 + cl * 0.16 + hash2(x, y, 22) * 0.06;
      if (x === 0 || y === px - 1) v *= 1.08;
      if (x === px - 1 || y === 0) v *= 0.8;
      if (hash2(x, y >> 2, 23) > 0.93) v *= 0.82;
      const i = (y * px + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, v) * 255);
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, px, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Soft round blob used for shadows and glows. */
export function makeBlobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ================================================================== world pixel textures
//
// Every world surface is a 16x16 pixel tile drawn with nearest filtering, in the spirit of
// classic blocky games: one tile spans one ground block (half a world unit). Colors come
// from the map palette; the patterns below only modulate brightness per pixel.

const TILE_PX = 16;
export const ATLAS_VARIANTS = 4;
/** Ground atlas rows: 4 top variants, the rim (first block below a cliff edge), 2 soil, deep stone. */
export const GROUND_ROWS = 8;
export const ROW_RIM = 4;
export const ROW_SOIL = 5;
export const ROW_STONE = 7;

type Px = (x: number, y: number) => number;
const H = (x: number, y: number, s: number) => hash2(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, s);

/** Ground tile families: each draws its own pixel pattern. */
export type GroundFam =
  | 'grass' | 'dirt' | 'path' | 'cobble' | 'slab' | 'tile' | 'snow' | 'sand' | 'ash' | 'basalt'
  | 'rock' | 'sulfur' | 'ice' | 'water' | 'lava' | 'bog' | 'void' | 'rune' | 'bone';

export function groundFamily(name: string): GroundFam {
  if (/grass|moss/.test(name)) return 'grass';
  if (/^dirt/.test(name)) return 'dirt';
  if (/path|trail/.test(name)) return 'path';
  if (/cobble|road/.test(name)) return 'cobble';
  if (/plaza|marble|floor/.test(name)) return 'slab';
  if (/tile/.test(name)) return 'tile';
  if (/snow/.test(name)) return 'snow';
  if (/sand/.test(name)) return 'sand';
  if (/ash|scorch/.test(name)) return 'ash';
  if (/basalt/.test(name)) return 'basalt';
  if (/rock|stone/.test(name)) return 'rock';
  if (/sulfur/.test(name)) return 'sulfur';
  if (/ice/.test(name)) return 'ice';
  if (/water/.test(name)) return 'water';
  if (/lava/.test(name)) return 'lava';
  if (/bog/.test(name)) return 'bog';
  if (/void/.test(name)) return 'void';
  if (/rune/.test(name)) return 'rune';
  if (/bone/.test(name)) return 'bone';
  return 'rock';
}

/** Toroidal Voronoi stones for cobblestone: returns [stone id, edge distance]. */
function cobbleCell(x: number, y: number, s: number): [number, number] {
  let d1 = 99;
  let d2 = 99;
  let id = 0;
  for (let gy = -1; gy <= 4; gy++)
    for (let gx = -1; gx <= 4; gx++) {
      const cx = ((gx % 4) + 4) % 4;
      const cy = ((gy % 4) + 4) % 4;
      const px = gx * 4 + 0.5 + hash2(cx, cy, s) * 3;
      const py = gy * 4 + 0.5 + hash2(cx, cy, s + 1) * 3;
      const d = Math.hypot((x - px) * 1.0, (y - py) * 1.15);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = cy * 4 + cx;
      } else if (d < d2) d2 = d;
    }
  return [id, d2 - d1];
}

const PATTERN: Record<string, (s: number) => Px> = {
  grass: (s) => (x, y) => {
    const r = H(x, y, s);
    let m = r < 0.1 ? 0.8 : r < 0.32 ? 0.9 : r < 0.84 ? 1 : 1.1;
    if (H(x, y + 1, s) > 0.9 && r > 0.5) m = 1.12; // short bright blades
    return m * (0.96 + H(x >> 1, y >> 1, s + 1) * 0.08);
  },
  dirt: (s) => (x, y) => {
    const r = H(x, y, s);
    let m = 0.9 + H(x >> 1, y >> 1, s + 2) * 0.12;
    if (r < 0.1) m = 0.76;
    else if (r > 0.95) m = 1.24;
    else if (r > 0.9) m = 1.12;
    return m;
  },
  path: (s) => (x, y) => {
    // coarse dirt with packed gravel
    const g = H(x >> 1, y >> 1, s + 3);
    let m = 0.9 + H(x, y, s) * 0.12;
    if (g > 0.78) m = (x & 1) + (y & 1) === 2 ? 0.86 : 1.16;
    else if (H(x, y, s + 4) < 0.08) m = 0.74;
    return m;
  },
  cobble: (s) => (x, y) => {
    const [id, e] = cobbleCell(x, y, s);
    if (e < 0.9) return 0.62;
    const [id2] = cobbleCell(x - 1, y - 1, s);
    let m = 0.84 + hash2(id, 0, s + 5) * 0.22 + H(x, y, s + 6) * 0.06;
    if (id2 !== id) m *= 1.1; // lit upper-left rim of each stone
    return m;
  },
  slab: (s) => (x, y) => {
    if (x === 15 || y === 15) return 0.72;
    if (x === 0 || y === 0) return 1.06;
    let m = 0.93 + H(x, y, s) * 0.07;
    if (H(x >> 2, y >> 2, s + 7) > 0.85 && H(x, y, s + 8) > 0.6) m *= 0.9;
    return m;
  },
  tile: (s) => (x, y) => {
    const lx = x & 7;
    const ly = y & 7;
    if (lx === 7 || ly === 7) return 0.7;
    if (lx === 0 || ly === 0) return 1.05;
    return 0.9 + hash2(x >> 3, y >> 3, s + 9) * 0.1 + H(x, y, s) * 0.05;
  },
  snow: (s) => (x, y) => {
    const r = H(x, y, s);
    return r < 0.08 ? 0.92 : r > 0.94 ? 1.03 : 0.97 + H(x >> 1, y >> 1, s + 1) * 0.03;
  },
  sand: (s) => (x, y) => {
    const r = H(x, y, s);
    let m = 0.94 + H(x >> 1, y, s + 1) * 0.07;
    if (r < 0.07) m = 0.86;
    else if (r > 0.95) m = 1.07;
    return m;
  },
  ash: (s) => (x, y) => {
    // netherrack-like: rough clumps with dark seams
    let m = 0.86 + H(x >> 1, y, s) * 0.18;
    if (H(x >> 2, y, s + 1) > 0.78) m = 0.74;
    if (H(x, y, s + 2) > 0.92) m = 1.14;
    return m;
  },
  basalt: (s) => (x, y) => {
    let m = 0.86 + H(x, y >> 2, s) * 0.16;
    if ((x + (H(0, y >> 3, s + 1) > 0.5 ? 2 : 0)) % 4 === 0) m *= 0.84;
    if (H(x, y, s + 2) > 0.94) m = 1.1;
    return m;
  },
  rock: (s) => (x, y) => {
    let m = 0.92 + H(x >> 1, y, s) * 0.1;
    if (H(x >> 2, y >> 1, s + 1) > 0.8) m = 0.8;
    if (H(x, y, s + 2) > 0.93) m = 1.1;
    return m;
  },
  sulfur: (s) => (x, y) => {
    const r = H(x, y, s);
    return r > 0.86 ? 1.22 : r < 0.12 ? 0.8 : 0.92 + H(x >> 1, y >> 1, s + 1) * 0.1;
  },
  ice: (s) => (x, y) => {
    let m = 0.97 + H(x, y, s) * 0.04;
    if ((x + y) % 11 === 0) m = 1.1;
    if ((x - y + 32) % 13 === 0) m = 1.06;
    return m;
  },
  water: (s) => (x, y) => {
    let m = 0.92 + H(x, y, s) * 0.06;
    if ((x + (y >> 1) * 3 + (y & 1)) % 9 < 2) m = 1.1;
    return m;
  },
  lava: (s) => (x, y) => {
    const v = H(x >> 1, y >> 1, s);
    return v > 0.72 ? 1.22 : v < 0.2 ? 0.78 : 0.96 + H(x, y, s + 1) * 0.08;
  },
  bog: (s) => (x, y) => {
    const r = H(x, y, s);
    return r < 0.15 ? 0.8 : r > 0.9 ? 1.15 : 0.9 + H(x >> 1, y >> 1, s + 1) * 0.12;
  },
  void: (s) => (x, y) => 0.8 + H(x, y, s) * 0.3,
  rune: (s) => (x, y) => (x === 7 || x === 8 || y === 7 || y === 8 ? 1.35 : 0.88 + H(x, y, s) * 0.1),
  bone: (s) => (x, y) => (y % 5 === 0 ? 0.86 : 0.92 + H(x, y, s) * 0.1),
};

/** Families whose top layer hangs over the cliff face like a grass block side. */
const OVERHANG = new Set<GroundFam>(['grass', 'snow', 'bog']);

type SoilKind = 'dirt' | 'rock' | 'sandstone' | 'basalt';

function soilOf(fam: GroundFam, blocks: Record<string, number[]>, tiles: Record<string, number[]>): [SoilKind, number, number] {
  const cliff = blocks.cliff?.[0];
  if (fam === 'grass' || fam === 'dirt' || fam === 'path' || fam === 'bog')
    return ['dirt', blocks.soil?.[0] ?? tiles.dirt?.[0] ?? 0x7a5636, cliff ?? 0x80848a];
  if (fam === 'snow' || fam === 'ice' || fam === 'rock') return ['rock', cliff ?? tiles.rock?.[0] ?? 0x7a828c, blocks.soil?.[0] ?? 0x5e646e];
  if (fam === 'sand' || fam === 'rune' || fam === 'void') return ['sandstone', blocks.soil?.[0] ?? blocks.sandstone?.[0] ?? 0xb89a6a, cliff ?? 0x9a8058];
  if (fam === 'ash' || fam === 'basalt' || fam === 'sulfur' || fam === 'lava') return ['basalt', blocks.soil?.[0] ?? blocks.basalt?.[0] ?? 0x524a4e, cliff ?? 0x2e2836];
  return ['rock', cliff ?? 0x77777f, cliff ?? 0x6a6a72];
}

const SOIL_PATTERN: Record<SoilKind, (s: number) => Px> = {
  dirt: PATTERN.dirt,
  rock: PATTERN.rock,
  basalt: PATTERN.basalt,
  sandstone: (s) => (x, y) => {
    if (y % 8 === 0) return 0.84;
    if (y % 8 === 1) return 1.04;
    return 0.92 + H(x, y >> 1, s) * 0.06;
  },
};

/**
 * Builds the ground atlas: one 16px column per tile type and GROUND_ROWS rows (top variants,
 * the cliff rim with its overhang, soil and deep stone). Brightness patterns are per family.
 */
export function makeGroundAtlas(tileNames: string[], tiles: Record<string, number[]>, blocks: Record<string, number[]>): THREE.CanvasTexture {
  const cols = Math.max(1, tileNames.length);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_PX;
  canvas.height = GROUND_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const col = new THREE.Color();
  const put = (ti: number, row: number, x: number, y: number, hex: number, m: number) => {
    col.setHex(hex);
    const i = ((row * TILE_PX + y) * canvas.width + ti * TILE_PX + x) * 4;
    const k = 1 + (m - 1) * 0.85;
    img.data[i] = Math.min(255, col.r * 255 * k);
    img.data[i + 1] = Math.min(255, col.g * 255 * k);
    img.data[i + 2] = Math.min(255, col.b * 255 * k);
    img.data[i + 3] = 255;
  };
  tileNames.forEach((name, ti) => {
    const colors = tiles[name] ?? [0x777777];
    const fam = groundFamily(name);
    const pat = PATTERN[fam];
    const [kind, soil, stone] = soilOf(fam, blocks, tiles);
    const soilPat = SOIL_PATTERN[kind];
    const vc = new THREE.Color();
    for (let v = 0; v < ATLAS_VARIANTS; v++) {
      const f = pat(11 + ti * 7 + v * 131);
      // variants stay close to the main colour so blocks read as one surface, not a checkerboard
      const c = vc.setHex(colors[0]).lerp(new THREE.Color(colors[v % colors.length]), 0.45).getHex();
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) put(ti, v, x, y, c, f(x, y));
    }
    // rim: the top layer hanging over the soil in a ragged strip
    const topPat = pat(17 + ti * 7);
    const sp = soilPat(23 + ti);
    for (let x = 0; x < TILE_PX; x++) {
      let hang = 0;
      if (OVERHANG.has(fam)) {
        hang = 3 + Math.floor(hash2(x, 0, 29 + ti) * 2.6);
        if (hash2(x, 1, 29 + ti) > 0.82) hang += 2;
      } else if (kind === 'sandstone' || kind === 'basalt') hang = fam === 'sand' || fam === 'ash' ? 2 : 1;
      for (let y = 0; y < TILE_PX; y++) {
        if (y < hang) put(ti, ROW_RIM, x, y, colors[0], topPat(x, y) * (y === hang - 1 ? 0.88 : 1));
        else put(ti, ROW_RIM, x, y, soil, sp(x, y) * (y === hang ? 0.84 : 1));
      }
    }
    for (let r = 0; r < 2; r++) {
      const p = soilPat(41 + ti * 3 + r * 17);
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) put(ti, ROW_SOIL + r, x, y, soil, p(x, y));
    }
    const deep = (kind === 'basalt' ? PATTERN.basalt : PATTERN.rock)(53 + ti);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) put(ti, ROW_STONE, x, y, stone, deep(x, y));
  });
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 16px block textures in one strip (tiles in VoxelFlora.TILE order), grey so the per-block
 * colour tints them. Leaves have a few see-through pixels (alpha-tested).
 */
export function makeBlockAtlas(): THREE.DataTexture {
  const px = 16;
  const tiles = TILE_COUNT;
  const W = px * tiles;
  const data = new Uint8Array(W * px * 4);
  const set = (t: number, x: number, y: number, v: number, a = 255) => {
    const i = (y * W + t * px + x) * 4;
    const sv = 0.92 + (v - 0.92) * 0.85;
    data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, Math.max(0, sv)) * 255);
    data[i + 3] = a;
  };
  const cob = PATTERN.cobble(61);
  const rock = PATTERN.rock(62);
  const basalt = PATTERN.basalt(63);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const n = H(x, y, 61);
      // 0 smooth block with a soft bevel (gold, crystal, lamps)
      let v = 0.9 + n * 0.06;
      if (x === 0 || y === 0) v = 1;
      if (x === px - 1 || y === px - 1) v = 0.8;
      set(0, x, y, v);
      // 1 leaves: dense two-tone clumps, a few holes
      const clump = H(x >> 1, y >> 1, 64);
      const lr = H(x, y, 65);
      let lv = clump > 0.45 ? 0.98 : 0.8;
      if (lr > 0.86) lv = 1.08;
      else if (lr < 0.14) lv = 0.62;
      const hole = H(x, y, 66) > 0.95;
      set(1, x, y, lv, hole ? 0 : 255);
      // 2 bark: vertical grooves
      const gcol = H(x, 0, 67);
      let bv = 0.84 + H(x, y >> 2, 68) * 0.14;
      if (gcol < 0.28) bv = 0.68;
      set(2, x, y, bv);
      // 3 planks: four boards with seams and offset end joints
      const row = y >> 2;
      let pv = 0.88 + H(row, 0, 69) * 0.08 + (H(x >> 2, y, 70) - 0.5) * 0.06;
      if ((y & 3) === 3) pv = 0.66;
      if (x === ((row * 7 + 3) & 15)) pv = 0.72;
      set(3, x, y, pv);
      // 4 cobblestone
      set(4, x, y, cob(x, y));
      // 5 bricks: dark bricks with lighter mortar
      const br = y >> 2;
      const bx = (x + (br & 1) * 4) & 7;
      let kv = 0.8 + H((x + (br & 1) * 4) >> 3, br, 72) * 0.12 + n * 0.04;
      if ((y & 3) === 3 || bx === 7) kv = 1;
      set(5, x, y, kv);
      // 6 shingles
      const sr = y >> 2;
      const sx = (x + (sr & 1) * 2) & 3;
      let shv = 0.86 + H((x + (sr & 1) * 2) >> 2, sr, 73) * 0.12 + n * 0.03;
      if ((y & 3) === 0) shv = 0.64;
      if (sx === 0) shv *= 0.84;
      set(6, x, y, shv);
      // 7 log top rings
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      set(7, x, y, d > 6.5 ? 0.66 : 0.84 + ((Math.floor(d) & 1) ? 0.08 : 0) + n * 0.04);
      // 8 birch bark: white with short dark streaks
      const streak = H(x >> 2, y, 74) > 0.8 || H(x >> 1, y >> 1, 75) > 0.94;
      set(8, x, y, streak ? 0.2 + n * 0.1 : 0.98);
      // 9 sandstone: smooth top band, layered body, dark base line
      let ss = 0.92 + H(x, y >> 1, 76) * 0.06;
      if (y < 3) ss = 1;
      if (y === 3 || y === 12) ss = 0.8;
      if (y > 12) ss = 0.88 + n * 0.04;
      set(9, x, y, ss);
      // 10 stone bricks: four bricks with dark mortar and a bevel
      const sbr = y >> 3;
      const sbx = (x + (sbr & 1) * 8) & 15;
      let sb = 0.9 + H((x + (sbr & 1) * 8) >> 4, sbr, 77) * 0.06 + n * 0.05;
      if ((y & 7) === 7 || sbx === 15) sb = 0.62;
      else if ((y & 7) === 0 || sbx === 0) sb = 1.02;
      if (H(x, y, 78) > 0.96) sb *= 0.85; // cracks
      set(10, x, y, sb);
      // 11 ice: pale with light diagonal streaks
      let iv = 0.94 + n * 0.04;
      if ((x + y) % 9 === 0) iv = 1.04;
      set(11, x, y, iv);
      // 12 obsidian: dark with bright specks
      const ov = H(x, y, 79) > 0.9 ? 1.18 : 0.84 + H(x >> 1, y >> 1, 80) * 0.12;
      set(12, x, y, ov);
      // 13 snow block
      set(13, x, y, 0.96 + n * 0.04);
      // 14 pillar: fluted column (marble, bone)
      let plv = 0.93 + H(x, y >> 2, 81) * 0.04;
      if (x === 0 || x === 15) plv = 0.78;
      else if (x % 5 === 0) plv = 0.84;
      else if (x % 5 === 1) plv = 1.02;
      set(14, x, y, plv);
      // 15 basalt / rough stone
      set(15, x, y, (x + y) % 2 ? basalt(x, y) : rock(x, y));
    }
  drawDetailTiles(data, W, px);
  const tex = new THREE.DataTexture(data, W, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Full-colour detail tiles 16..23 of the block atlas (windows, doors, lattice, lanterns, hay,
 * flowers, glass). Instances using them carry a white tint; they map once per block.
 */
function drawDetailTiles(data: Uint8Array, W: number, px: number) {
  const put = (t: number, x: number, y: number, c: number, a = 255) => {
    const i = (y * W + t * px + x) * 4;
    data[i] = (c >> 16) & 255;
    data[i + 1] = (c >> 8) & 255;
    data[i + 2] = c & 255;
    data[i + 3] = a;
  };
  const mul = (c: number, k: number) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
    const b = Math.min(255, Math.round((c & 255) * k));
    return (r << 16) | (g << 8) | b;
  };
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const n = H(x, y, 91);
      const edge = x === 0 || y === 0 || x === px - 1 || y === px - 1;
      // 16 window: oak frame with a cross mullion, pale sky glass with a highlight streak
      {
        const frame = edge || x === 1 || y === 1 || x === px - 2 || y === px - 2 || x === 7 || x === 8 || y === 7 || y === 8;
        const glass = (x + y) % 11 === 0 || (x + y) % 11 === 1 ? 0xe8f4ff : mul(0x9cc8e8, 0.92 + n * 0.12);
        put(16, x, y, frame ? mul(0x8a6438, edge ? 0.75 : 0.95 + n * 0.1) : glass);
      }
      // 17 door: vertical oak boards, dark frame, two small panes, an iron handle
      {
        let c = mul(0x9a7040, 0.86 + H(x >> 2, y, 92) * 0.14);
        if (x % 4 === 0) c = mul(0x9a7040, 0.68);
        if (edge) c = 0x4e3620;
        if (y >= 2 && y <= 5 && ((x >= 3 && x <= 6) || (x >= 9 && x <= 12))) c = mul(0x9cc8e8, 0.9 + n * 0.1);
        if (x === 12 && y >= 9 && y <= 10) c = 0x2a2a2e;
        put(17, x, y, c);
      }
      // 18 lattice (trapdoor): brown frame with square holes showing a dark interior
      {
        const hole = x % 5 !== 0 && y % 5 !== 0 && !edge;
        put(18, x, y, hole ? mul(0x5a3e24, 0.7 + n * 0.1) : mul(0xa47844, 0.88 + n * 0.12));
      }
      // 19 lantern: dark iron cage around a warm flame
      {
        const cage = edge || x === 1 || x === px - 2 || y <= 2 || y >= px - 2;
        const core = Math.hypot(x - 7.5, y - 8.5) / 6;
        put(19, x, y, cage ? mul(0x3a3c42, 0.9 + n * 0.2) : mul(0xffd070, 1.15 - core * 0.35));
      }
      // 20 dark window: spruce frame, deep blue glass
      {
        const frame = edge || x === 1 || y === 1 || x === px - 2 || y === px - 2 || x === 7 || x === 8 || y === 7 || y === 8;
        const glass = (x + y) % 11 === 0 ? 0x8ab0d8 : mul(0x3a5a7a, 0.9 + n * 0.15);
        put(20, x, y, frame ? mul(0x5a3e24, edge ? 0.75 : 0.95 + n * 0.1) : glass);
      }
      // 21 hay bale: straw with two dark bands
      {
        let c = mul(0xd8b44a, 0.82 + H(x, y >> 1, 93) * 0.25);
        if (y === 4 || y === 11) c = mul(0x8a5a2a, 0.9);
        put(21, x, y, c);
      }
      // 22 flowers: leafy green with red, yellow, pink and white blossoms
      {
        let c = mul(0x4f8a34, 0.75 + H(x >> 1, y >> 1, 94) * 0.35);
        const f = H(x >> 1, y >> 1, 95);
        if (f > 0.84) c = [0xe04a3a, 0xf0d040, 0xf08ab0, 0xf4f0e8, 0xb06ae0][Math.floor(H(x >> 1, y >> 1, 96) * 5)];
        put(22, x, y, c);
      }
      // 23 glass pane: thin frame, clear glass
      {
        const glass = (x + y) % 9 === 0 ? 0xf0f8ff : mul(0xb8d8f0, 0.94 + n * 0.08);
        put(23, x, y, edge ? 0x8a6438 : glass);
      }
    }
}

/** Foliage sprites (index into makeFoliageAtlas). Grass sprites are grey and tinted per map. */
export const SPRITE = {
  grass: 0, tallGrass: 1, fern: 2, poppy: 3, dandelion: 4, cornflower: 5, bluet: 6, tulip: 7,
  deadBush: 8, allium: 9, mushroom: 10, dryGrass: 11, daisy: 12,
} as const;
export const SPRITE_COUNT = 13;
/** Sprites drawn in their own colours (flowers); the rest take the instance tint. */
export const SPRITE_COLORED = new Set<number>([3, 4, 5, 6, 7, 8, 9, 10, 12]);

/** Crossed-quad foliage sprites: grass tufts, ferns and small flowers as 16px pixel art. */
export function makeFoliageAtlas(): THREE.CanvasTexture {
  const W = TILE_PX * SPRITE_COUNT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, TILE_PX);
  const px = (s: number, x: number, y: number, c: number, k = 1) => {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = (y * W + s * TILE_PX + x) * 4;
    img.data[i] = Math.min(255, ((c >> 16) & 255) * k);
    img.data[i + 1] = Math.min(255, ((c >> 8) & 255) * k);
    img.data[i + 2] = Math.min(255, (c & 255) * k);
    img.data[i + 3] = 255;
  };
  const grey = (v: number) => {
    const g = Math.round(Math.min(1, v) * 255);
    return (g << 16) | (g << 8) | g;
  };
  /** Grass blades rising from the bottom row, leaning a little. */
  const blades = (s: number, count: number, hMin: number, hMax: number, seed: number) => {
    for (let b = 0; b < count; b++) {
      const x0 = 1 + Math.floor(hash2(b, 0, seed) * 14);
      const h = hMin + Math.floor(hash2(b, 1, seed) * (hMax - hMin + 1));
      const lean = hash2(b, 2, seed) < 0.5 ? -1 : 1;
      for (let k = 0; k < h; k++) {
        const x = x0 + (k > h * 0.6 ? lean : 0);
        px(s, x, 15 - k, grey(0.6 + (k / h) * 0.42 + hash2(b, k, seed + 1) * 0.06));
      }
    }
  };
  const stem = (s: number, x: number, top: number, c = 0x4f8a34) => {
    for (let y = top; y < 16; y++) px(s, x, y, c, 0.9 + (y & 1) * 0.1);
  };
  blades(SPRITE.grass, 9, 3, 7, 1);
  blades(SPRITE.tallGrass, 9, 8, 14, 2);
  // fern: a central rib with paired leaflets
  for (const [cx, lean, h] of [[7, 0, 12], [4, -1, 8], [11, 1, 9]] as [number, number, number][])
    for (let k = 0; k < h; k++) {
      const x = cx + Math.round((k / h) * lean * 3);
      px(SPRITE.fern, x, 15 - k, grey(0.66 + k * 0.025));
      if (k % 2 === 1 && k < h - 1) {
        px(SPRITE.fern, x - 1, 15 - k, grey(0.82));
        px(SPRITE.fern, x + 1, 15 - k, grey(0.82));
      }
    }
  blades(SPRITE.dryGrass, 7, 4, 9, 3);
  // flowers
  const leaf = 0x3f7a2c;
  const flower = (s: number, x: number, top: number, head: [number, number, number][]) => {
    stem(s, x, top);
    px(s, x - 1, 12, leaf);
    px(s, x + 1, 13, leaf);
    for (const [dx, dy, c] of head) px(s, x + dx, top + dy, c);
  };
  const R = 0xd8282a, Rd = 0x9a1418, Y = 0xffd83a, Yd = 0xd8a020, B = 0x4a6ae8, Bl = 0x7a9aff, Wt = 0xf4f4f0, P = 0xff8ac0, Pd = 0xe05a9a, V = 0xb45ae8, Vd = 0x8a3ac8;
  flower(SPRITE.poppy, 7, 7, [[-1, -1, R], [0, -1, R], [1, -1, R], [-1, 0, R], [0, 0, 0x2a1a10], [1, 0, R], [0, -2, Rd], [-1, 1, Rd], [1, 1, Rd]]);
  flower(SPRITE.dandelion, 8, 9, [[-1, -1, Y], [0, -1, Y], [1, -1, Yd], [0, -2, Y], [0, 0, Yd]]);
  flower(SPRITE.cornflower, 7, 8, [[-1, -1, B], [0, -2, Bl], [1, -1, B], [0, -1, 0x2a2a6a], [-1, -2, Bl], [1, -2, Bl], [0, 0, B]]);
  for (const [x, top] of [[4, 10], [8, 8], [12, 11]] as [number, number][]) {
    stem(SPRITE.bluet, x, top + 1);
    px(SPRITE.bluet, x, top, 0xffe070);
    px(SPRITE.bluet, x - 1, top, Wt);
    px(SPRITE.bluet, x + 1, top, Wt);
    px(SPRITE.bluet, x, top - 1, Wt);
  }
  flower(SPRITE.tulip, 7, 7, [[-1, -2, P], [1, -2, P], [-1, -1, P], [0, -1, Pd], [1, -1, P], [-1, 0, Pd], [0, 0, Pd], [1, 0, Pd], [0, -2, Pd]]);
  // daisy: white petals around a yellow eye
  flower(SPRITE.daisy, 8, 8, [[0, -1, 0xffd040], [-1, -1, Wt], [1, -1, Wt], [0, -2, Wt], [0, 0, Wt], [-2, -1, Wt], [2, -1, Wt]]);
  // allium: tall stem, round purple head
  stem(SPRITE.allium, 8, 6);
  for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) if (Math.abs(dx + 0.5) + Math.abs(dy + 0.5) < 3) px(SPRITE.allium, 8 + dx, 4 + dy, (dx + dy) & 1 ? V : Vd);
  // dead bush: brown forked twigs
  const tw = 0x8a5a2a;
  for (const [x0, dx, h] of [[8, 0, 10], [8, -1, 7], [8, 1, 8], [8, -2, 5], [8, 2, 6]] as [number, number, number][])
    for (let k = 0; k < h; k++) px(SPRITE.deadBush, x0 + Math.round((k / h) * dx * 4), 15 - k, tw, 0.85 + (k & 1) * 0.15);
  // small brown mushroom
  for (let y = 12; y < 16; y++) px(SPRITE.mushroom, 8, y, 0xe8dcc0);
  for (let dx = -3; dx <= 3; dx++) px(SPRITE.mushroom, 8 + dx, 11, 0x9a6a44, Math.abs(dx) === 3 ? 0.8 : 1);
  for (let dx = -2; dx <= 2; dx++) px(SPRITE.mushroom, 8 + dx, 10, 0xb07a50);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
