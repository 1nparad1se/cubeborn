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

const TILE_PX = 16;
export const ATLAS_VARIANTS = 4;

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
          const n = hash2(x + ti * 31, y + v * 17, 3 + ti);
          let shade = 0.9 + n * 0.2;
          // pattern accents per tile family
          if (/grass/.test(name) && hash2(x, y, v + 9) > 0.86) shade *= 1.18;
          if (/cobble|plaza|marble|tile|floor/.test(name) && (x % 8 === 0 || y % 8 === 0)) shade *= 0.78;
          if (/road|basalt/.test(name) && hash2(x, y, v + 2) > 0.92) shade *= 0.7;
          if (/snow/.test(name) && hash2(x, y, v + 4) > 0.9) shade *= 1.1;
          if (/sand|ash/.test(name) && (x + y * 3 + v) % 7 === 0) shade *= 0.92;
          if (/water|lava|bog|void|ice/.test(name)) shade = 0.92 + Math.sin((x + v * 4) * 0.8 + y * 0.4) * 0.06 + n * 0.06;
          if (/rune/.test(name) && (x === 7 || x === 8 || y === 7 || y === 8)) shade *= 1.35;
          const edge = x === 0 || y === 0;
          if (edge && !/water|lava|bog|void/.test(name)) shade *= 0.86;
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
