import * as THREE from 'three';
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

const TILE_PX = 16;
export const ATLAS_VARIANTS = 4;

/** Shade multiplier for one pixel of a ground tile, by tile family. */
function tileShade(name: string, x: number, y: number, v: number, ti: number): number {
  const n = hash2(x + ti * 31, y + v * 17, 3 + ti);
  const blob = hash2((x + v * 3) >> 1, (y + v * 5) >> 1, 40 + ti);
  if (/grass|moss/.test(name)) {
    // painted clumps with a few bright blades
    let s = 0.86 + blob * 0.2 + n * 0.06;
    if (hash2(x, y, v + 9) > 0.9) s *= 1.18;
    if (hash2(x, y + 1, v + 9) > 0.9) s *= 1.1;
    if (hash2(x, y, v + 13) > 0.95) s *= 0.8;
    return s;
  }
  if (/dirt|path|trail|scorch|ash/.test(name)) {
    let s = 0.88 + blob * 0.14 + n * 0.05;
    if (hash2(x, y, v + 2) > 0.94) s *= 1.22; // pebbles
    if (hash2(x, y, v + 3) > 0.95) s *= 0.78;
    return s;
  }
  if (/cobble|plaza|marble|tile|floor|road/.test(name)) {
    // staggered stones with dark mortar
    const row = y >> 2;
    const off = row % 2 ? 4 : 0;
    const sx = (x + off) >> 3;
    const mortar = y % 4 === 0 || (x + off) % 8 === 0;
    if (/marble|tile|plaza/.test(name)) {
      const big = x % 8 === 0 || y % 8 === 0;
      return big ? 0.76 : 0.9 + hash2(x >> 3, y >> 3, v + 7) * 0.12 + n * 0.04;
    }
    if (mortar) return 0.66 + n * 0.06;
    return 0.86 + hash2(sx, row, v + 5) * 0.2 + n * 0.05;
  }
  if (/snow/.test(name)) return 0.94 + blob * 0.06 + (hash2(x, y, v + 4) > 0.92 ? 0.06 : 0);
  if (/sand/.test(name)) return 0.9 + ((x + y * 2 + v) % 6 === 0 ? -0.06 : 0) + blob * 0.08 + n * 0.04;
  if (/water|lava|bog|void|ice/.test(name)) return 0.92 + Math.sin((x + v * 4) * 0.8 + y * 0.4) * 0.06 + n * 0.06;
  if (/rune/.test(name)) return x === 7 || x === 8 || y === 7 || y === 8 ? 1.35 : 0.9 + n * 0.1;
  if (/bone/.test(name)) return 0.86 + blob * 0.12 + (hash2(x, y, v + 6) > 0.9 ? 0.2 : 0);
  return 0.88 + blob * 0.12 + n * 0.06;
}

/**
 * Builds the ground atlas: one column per tile type, ATLAS_VARIANTS rows of 16x16 pixel art.
 * Colors come from the map palette; patterns are generated per tile kind.
 */
export function makeGroundAtlas(tileNames: string[], palette: Record<string, number[]>): THREE.CanvasTexture {
  const cols = Math.max(1, tileNames.length);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_PX;
  canvas.height = ATLAS_VARIANTS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const col = new THREE.Color();
  tileNames.forEach((name, ti) => {
    const colors = palette[name] ?? [0x777777];
    for (let v = 0; v < ATLAS_VARIANTS; v++) {
      const base = colors[v % colors.length];
      for (let y = 0; y < TILE_PX; y++)
        for (let x = 0; x < TILE_PX; x++) {
          col.setHex(base);
          const shade = 0.93 + (tileShade(name, x, y, v, ti) - 0.93) * 0.45; // soft, painted look
          const i = ((v * TILE_PX + y) * canvas.width + ti * TILE_PX + x) * 4;
          img.data[i] = Math.min(255, col.r * 255 * shade);
          img.data[i + 1] = Math.min(255, col.g * 255 * shade);
          img.data[i + 2] = Math.min(255, col.b * 255 * shade);
          img.data[i + 3] = 255;
        }
    }
  });
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
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

/**
 * Minecraft-style 16px block textures in one strip (tiles in VoxelFlora.TILE order), grey so
 * the per-block colour tints them. Leaves have see-through pixels (alpha-tested).
 */
export function makeBlockAtlas(): THREE.DataTexture {
  const px = 16;
  const tiles = 9;
  const W = px * tiles;
  const data = new Uint8Array(W * px * 4);
  const set = (t: number, x: number, y: number, v: number, a = 255) => {
    const i = (y * W + t * px + x) * 4;
    const sv = 0.86 + (v - 0.8) * 0.45; // low contrast: soft, painted Minecraft Dungeons look
    data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, Math.max(0, sv)) * 255);
    data[i + 3] = a;
  };
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const n = hash2(x, y, 61);
      const cl = hash2(x >> 1, y >> 1, 62);
      // 0 smooth
      let v = 0.82 + cl * 0.12 + n * 0.06;
      if (x === 0 || y === px - 1) v *= 1.06;
      if (x === px - 1 || y === 0) v *= 0.84;
      set(0, x, y, v);
      // 1 leaves: dense two-tone clumps with holes
      const leaf = hash2(x, y, 63);
      const hole = leaf > 0.93 && hash2(x >> 1, y >> 1, 64) > 0.5;
      const lv = hash2(x, y, 65) > 0.55 ? 0.95 + n * 0.05 : hash2(x, y, 66) > 0.4 ? 0.74 : 0.56;
      set(1, x, y, lv, hole ? 0 : 255);
      // 2 bark: vertical grooves
      const col = hash2(x, 0, 67);
      let bv = 0.7 + col * 0.22 + hash2(x, y >> 2, 68) * 0.1;
      if (col < 0.25) bv *= 0.72;
      set(2, x, y, bv);
      // 3 planks: four boards with seams and offset end joints
      const row = y >> 2;
      let pv = 0.84 + hash2(row, 0, 69) * 0.1 + (hash2(x >> 2, y, 70) - 0.5) * 0.08;
      if ((y & 3) === 3) pv *= 0.62;
      if (x === ((row * 7 + 3) & 15)) pv *= 0.7;
      set(3, x, y, pv);
      // 4 stone (Minecraft smooth stone): grey with blocky lighter and darker streaks, no seams
      const sRow = y >> 1;
      const sOff = Math.floor(hash2(sRow, 0, 76) * 4);
      const sSeg = Math.floor((x + sOff) / (2 + Math.floor(hash2(sRow, 1, 77) * 3)));
      const sh = hash2(sSeg, sRow, 71);
      let cv = 0.8;
      if (sh > 0.72) cv = 0.94;
      else if (sh < 0.22) cv = 0.66;
      else if (sh < 0.32) cv = 0.6;
      set(4, x, y, cv + 0.12);
      // 5 brick
      const br = y >> 2;
      const bx = (x + (br & 1) * 4) & 7;
      let kv = 0.8 + hash2((x + (br & 1) * 4) >> 3, br, 72) * 0.15 + n * 0.05;
      if ((y & 3) === 3 || bx === 7) kv = 0.92;
      set(5, x, y, kv);
      // 6 shingles: overlapping rows with staggered gaps
      const sr = y >> 2;
      const sx = (x + (sr & 1) * 2) & 3;
      let sv = 0.8 + hash2((x + (sr & 1) * 2) >> 2, sr, 73) * 0.16 + n * 0.04;
      if ((y & 3) === 0) sv *= 0.62;
      if (sx === 0) sv *= 0.8;
      set(6, x, y, sv);
      // 7 log top rings
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      // 8 birch bark: white with short dark horizontal streaks and knots
      const streak = hash2(x >> 2, y, 74) > 0.8 || (hash2(x >> 1, y >> 1, 75) > 0.94);
      set(8, x, y, streak ? n * 0.08 : 1.0);
      set(7, x, y, d > 6.5 ? 0.6 : 0.8 + ((Math.floor(d) & 1) ? 0.08 : 0) + n * 0.04);
    }
  const tex = new THREE.DataTexture(data, W, px, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
