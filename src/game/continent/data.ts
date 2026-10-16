/**
 * «Расколотые Земли» — the 8000×8000 continent baked by tools/continent (relief frozen). The game
 * streams it: the 1-block tiles (packed 4×4 into 1024² atlases, RGB8: (R<<8|G)/16 = Y, B = material),
 * the 2048² overview heights for far LOD and the maps, world.json (villages, camps, NPCs) and the
 * per-sector detail instances (detail.wasm, format CBD1). Files live under `continent/` next to the
 * game (copied by the vite plugin from tools/continent/viewer/site/data).
 */

export const WORLD = 8000;
export const SEA = 40;
export const ATLAS = 1024;
export const SECTOR = 256;
export const SECTORS = 32;
export const OVERVIEW = 2048;

/** Sub-biome / water / road material codes of the tiles (see docs/continent). */
export const MAT = { river: 20, lake: 21, sea: 22, swamp: 23, road: 24, path: 25 } as const;
export const isWaterMat = (m: number) => m >= 20 && m <= 23;

export interface RGBAImage {
  w: number;
  h: number;
  /** 4 bytes per pixel. */
  data: Uint8Array | Uint8ClampedArray;
}

/** How the continent files are read: fetch + canvas in the browser, the file system in node tests. */
export interface ContinentIO {
  json<T>(path: string): Promise<T>;
  bin(path: string): Promise<ArrayBuffer>;
  image(path: string): Promise<RGBAImage>;
}

export const browserIO = (base = './continent/'): ContinentIO => ({
  json: (p) => fetch(base + p).then((r) => {
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    return r.json();
  }),
  bin: (p) => fetch(base + p).then((r) => {
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    return r.arrayBuffer();
  }),
  image: async (p) => {
    const r = await fetch(base + p);
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
    const ctx = (c as HTMLCanvasElement).getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
    bmp.close();
    return { w: d.width, h: d.height, data: d.data };
  },
});

// ---------------------------------------------------------------- world.json shapes (subset)
export type XY = [number, number];
export interface WBuilding { id: string; ru: string; type: string; at: XY; size: [number, number]; rot: number; props?: string[] }
export interface WVillage { id: string; ru: string; at: XY; padR: number; padY: number; buildings: WBuilding[]; extras?: { id: string; at: XY }[] }
export interface WCampGroup { species: string; count: number; lv: [number, number]; ru: string; attack: string }
export interface WCamp {
  id: string; ru: string; region: string; at: XY; groups: WCampGroup[]; lvMin: number; lvMax: number;
  patrolR: number; patrol: XY[]; rest: XY[]; rangedPos: XY[]; meleePos: XY[];
  aggro: number; leash: number; respawnSec: number; unique: boolean; props?: { id: string; at: XY }[];
}
export interface WNpc { id: string; ru: string; village: string; role: string; schedule: { h: number; at: string; doing: string; pos: XY }[] }
export interface WSite { id: string; ru: string; kind: string; at: XY }
export interface WRegion { id: string; ru: string; biome: string; lv: [number, number]; poly: XY[] }
export interface WorldJson { villages: WVillage[]; camps: WCamp[]; npcs: WNpc[]; sites: WSite[]; regions: WRegion[] }
export interface RouteLeg { mode: string; label?: string; pts: XY[] }
export interface Features {
  routes: { id: string; ru: string; kind: string; legs: RouteLeg[] }[];
  bridges: { at: XY; kind: string; route: string; ru: string; length: number; heightAbove?: number }[];
  landmarks: { id: string; ru: string; at: XY; kind: string }[];
  rivers: { id: string; ru: string; pts: number[][] }[];
  lakes: { id: string; ru: string; at: XY; r: number; level: number }[];
}
export interface DetailKind { id: string; ru: string; type: 'prop' | 'tree'; prop?: string; tree?: { kind: string; leaf: string; trunk: string; h: number }; group?: string }

/** Decoded continent data that stays in memory (atlases come and go, see AtlasCache). */
export class ContinentData {
  /** Overview heights, Y×64 (2048², 3.9 blocks per sample). */
  hov!: Uint16Array;
  /** Overview maps: R = sub-biome, G = water | road << 4, B = region (RGBA). */
  maps!: RGBAImage;
  world!: WorldJson;
  feat!: Features;
  kinds!: DetailKind[];
  /** CBD1 sector offsets (in instances) and the instance words. */
  detOff!: Uint32Array;
  det!: Uint32Array;
  readonly atlases: AtlasCache;

  constructor(readonly io: ContinentIO) {
    this.atlases = new AtlasCache(io);
  }

  static async load(io: ContinentIO): Promise<ContinentData> {
    const d = new ContinentData(io);
    const [h, maps, world, feat, kinds, det] = await Promise.all([
      io.bin('height_2048.wasm'),
      io.image('maps_2048.png'),
      io.json<WorldJson>('world.json'),
      io.json<Features>('features.json'),
      io.json<{ kinds: DetailKind[] }>('detail_kinds.json'),
      io.bin('detail.wasm'),
    ]);
    d.hov = new Uint16Array(h);
    d.maps = maps;
    d.world = world;
    d.feat = feat;
    d.kinds = kinds.kinds;
    const dv = new DataView(det);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'CBD1') throw new Error('detail.wasm: not CBD1');
    const n = dv.getUint32(4, true);
    d.detOff = new Uint32Array(det, 8, n + 1);
    d.det = new Uint32Array(det, 8 + (n + 1) * 4);
    return d;
  }

  /** Overview height (Y) at world (x, z), bilinear. */
  heightAt(x: number, z: number): number {
    const N = OVERVIEW;
    const fx = Math.max(0, Math.min(N - 1.001, (x / WORLD) * N - 0.5));
    const fz = Math.max(0, Math.min(N - 1.001, (z / WORLD) * N - 0.5));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h = this.hov;
    const a = h[iz * N + ix] + (h[iz * N + ix + 1] - h[iz * N + ix]) * tx;
    const b = h[(iz + 1) * N + ix] + (h[(iz + 1) * N + ix + 1] - h[(iz + 1) * N + ix]) * tx;
    return (a + (b - a) * tz) / 64;
  }

  /** Overview sub-biome and water code at (x, z). */
  mapAt(x: number, z: number): { biome: number; water: number; region: number } {
    const N = OVERVIEW;
    const cx = Math.max(0, Math.min(N - 1, Math.floor((x / WORLD) * N)));
    const cz = Math.max(0, Math.min(N - 1, Math.floor((z / WORLD) * N)));
    const o = (cz * N + cx) * 4;
    const m = this.maps.data;
    return { biome: m[o], water: m[o + 1] & 15, region: m[o + 2] };
  }

  /** Detail instances of a sector: [x, z, kind, rot, variant, scale] in world cells. */
  forSector(sx: number, sz: number, fn: (x: number, z: number, kind: number, rot: number, variant: number, scale: number) => void) {
    if (sx < 0 || sz < 0 || sx >= SECTORS || sz >= SECTORS) return;
    const s = sz * SECTORS + sx;
    const a = this.detOff[s];
    const b = this.detOff[s + 1];
    for (let i = a; i < b; i++) {
      const w = this.det[i];
      const f = w >>> 24;
      fn(sx * SECTOR + (w & 255), sz * SECTOR + ((w >>> 8) & 255), (w >>> 16) & 255, f & 3, (f >> 2) & 3, 0.8 + (f >> 4) * 0.06);
    }
  }
}

/** Decoded 1024² atlases kept in a small LRU (each is 4 MB decoded): memory stays bounded. */
export class AtlasCache {
  private map = new Map<string, Promise<RGBAImage>>();
  private ready = new Map<string, RGBAImage>();
  /** At most this many decoded atlases (a 512 window touches 4 at most). */
  max = 6;
  loads = 0;
  constructor(private io: ContinentIO) {}

  key(ax: number, az: number) {
    return `a_${ax}_${az}`;
  }

  /** Starts (or reuses) the load of the atlases covering world rect [x0, x1) × [z0, z1). */
  ensure(x0: number, z0: number, x1: number, z1: number): Promise<void> {
    const ps: Promise<RGBAImage>[] = [];
    for (let az = Math.max(0, Math.floor(z0 / ATLAS)); az <= Math.min(7, Math.floor((z1 - 1) / ATLAS)); az++)
      for (let ax = Math.max(0, Math.floor(x0 / ATLAS)); ax <= Math.min(7, Math.floor((x1 - 1) / ATLAS)); ax++) {
        const k = this.key(ax, az);
        let p = this.map.get(k);
        if (!p) {
          this.loads++;
          p = this.io.image(`atlas/${k}.png`).then((img) => {
            this.ready.set(k, img);
            return img;
          });
          this.map.set(k, p);
        } else {
          // most recently used last
          this.map.delete(k);
          this.map.set(k, p);
        }
        ps.push(p);
      }
    return Promise.all(ps).then(() => this.trim());
  }

  has(x0: number, z0: number, x1: number, z1: number): boolean {
    for (let az = Math.max(0, Math.floor(z0 / ATLAS)); az <= Math.min(7, Math.floor((z1 - 1) / ATLAS)); az++)
      for (let ax = Math.max(0, Math.floor(x0 / ATLAS)); ax <= Math.min(7, Math.floor((x1 - 1) / ATLAS)); ax++) if (!this.ready.has(this.key(ax, az))) return false;
    return true;
  }

  private trim() {
    while (this.map.size > this.max) {
      const k = this.map.keys().next().value as string;
      this.map.delete(k);
      this.ready.delete(k);
    }
  }

  get decoded(): number {
    return this.ready.size;
  }

  /** Height Y and material at world cell (x, z) (sea outside the atlases or the world). */
  sample(x: number, z: number): [number, number] {
    if (x < 0 || z < 0 || x >= WORLD || z >= WORLD) return [SEA - 4, MAT.sea];
    const img = this.ready.get(this.key(Math.floor(x / ATLAS), Math.floor(z / ATLAS)));
    if (!img) return [SEA - 4, MAT.sea];
    const o = ((z % ATLAS) * ATLAS + (x % ATLAS)) * 4;
    const d = img.data;
    return [((d[o] << 8) | d[o + 1]) / 16, d[o + 2]];
  }
}
