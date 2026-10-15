import * as THREE from 'three';
import type { MapDef } from '../data/types';
import { CELL, type Block, type Terrain } from '../game/Terrain';
import { hash2 } from '../core/Rng';
import { ATLAS_VARIANTS, GROUND_ROWS, ROW_RIM, ROW_SOIL, ROW_STONE, SPRITE, SPRITE_COLORED, SPRITE_COUNT, makeBlockAtlas, makeFoliageAtlas, makeGroundAtlas } from './Textures';
import { TILE_COUNT, tileOf, treeVoxels, type Vox } from './VoxelFlora';
import { unitCube } from './VoxelGeometry';
import { DITHER } from './dither';
import { PropKit } from '../world/render/PropRenderer';
import { groundTile } from '../world/textures/groundTiles';

type Slot = { x: number; z: number; build: () => void; objs: THREE.Mesh[] | null };

const CHUNK = 16;

/** The terrain as the ground renderer sees it: original ground (water, chasms) under prop decks. */
function groundView(t: Terrain): Terrain {
  if (!t.under.size) return t;
  const cell = t.cell.slice();
  const elev = t.elev.slice();
  for (const [i, u] of t.under) {
    cell[i] = u.cell;
    elev[i] = u.elev;
  }
  return Object.assign(Object.create(t), { cell, elev }) as Terrain;
}
/** Ground chunks are larger: they are cheap merged quads. */
const GCHUNK = 32;
/** Depth of the cliffs around the map edge. */
const SKIRT = -14;

/** Tile animation kinds understood by the ground shader. */
function tileAnim(name: string): number {
  if (/water/.test(name)) return 1;
  if (/lava/.test(name)) return 2;
  if (/bog/.test(name)) return 3;
  if (/void/.test(name)) return 4;
  if (/rune/.test(name)) return 5;
  if (/ice/.test(name)) return 6;
  return 0;
}

/**
 * Water look per tile (src/world/textures/water.ts names `water_<type>_<depth>`): kind code for the
 * shader (0 river/stream/plain, 1 swamp, 2 fast/mountain, 3 sea, 4 lake/lagoon) and depth 1..5
 * (0 = unknown: the distance-to-shore estimate is used).
 */
export function waterLook(name: string): { kind: number; depth: number } {
  const m = /^water_([a-z]+)_(\d)$/.exec(name);
  const ty = m?.[1] ?? '';
  const kind = ty === 'swamp' ? 1 : ty === 'fast' || ty === 'mountain' ? 2 : ty === 'sea' ? 3 : ty === 'lake' || ty === 'lagoon' ? 4 : 0;
  return { kind, depth: m ? Number(m[2]) : 0 };
}

/** Calm water where the built-in lily pads may float (not rapids, mountain streams or the sea). */
function lilyWater(name: string): boolean {
  return /water/.test(name) && !/^water_(fast|mountain|sea)_/.test(name);
}

/** Surface height of liquid cells: water and lava sit below the banks, the void is a chasm. */
function liquidLevel(name: string): number {
  if (/void/.test(name)) return -6;
  if (/lava/.test(name)) return -0.5;
  return -0.62;
}

type SpriteW = [number, number][];
interface FoliageRule {
  density: number;
  sprites: SpriteW;
  /** Fixed tint for grey sprites (null: the tile colour). */
  tint?: number;
}

const FLOWERS: SpriteW = [[SPRITE.poppy, 3], [SPRITE.dandelion, 3], [SPRITE.cornflower, 2], [SPRITE.bluet, 3], [SPRITE.tulip, 1.5], [SPRITE.daisy, 2.5], [SPRITE.allium, 1]];
const MEADOW: SpriteW = [[SPRITE.grass, 52], [SPRITE.tallGrass, 20], [SPRITE.fern, 7], ...FLOWERS];
const TUFTS: SpriteW = [[SPRITE.grass, 70], [SPRITE.tallGrass, 20], [SPRITE.fern, 10]];

/** Which foliage grows on a tile, per map generator. */
function foliageRule(gen: string, tile: string): FoliageRule | null {
  const grassy = /grass/.test(tile);
  if (gen === 'meadow') {
    if (grassy) return { density: 1.7, sprites: MEADOW };
    // river banks: shorter, sparser grass thinning toward the water
    if (/bank/.test(tile)) return { density: 0.7, sprites: TUFTS };
    if (/sand/.test(tile)) return { density: 0.06, sprites: TUFTS };
  } else if (grassy) return { density: 1, sprites: TUFTS };
  // library ground tiles (roads, shores) declare their own tuft density
  const f = groundTile(tile)?.foliage;
  return f ? { density: f, sprites: TUFTS } : null;
}

function pickSprite(list: SpriteW, r: number): number {
  let total = 0;
  for (const [, w] of list) total += w;
  let x = r * total;
  for (const [s, w] of list) {
    x -= w;
    if (x <= 0) return s;
  }
  return list[list.length - 1][0];
}

const GLSL_NOISE = `
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}`;



/**
 * Static voxel world in a painted dungeon-crawler style: textured ground with sunken water,
 * foam and cliff banks, soft contact shadows, instanced block chunks, grass and flowers.
 */
export class WorldRenderer {
  readonly group = new THREE.Group();
  readonly uniforms = {
    uTime: { value: 0 },
    uSurge: { value: 0 },
    uFocus: { value: new THREE.Vector3(0, 0, 9999) },
    uCamDir: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) },
    uNight: { value: 0 },
  };
  private disposables: { dispose(): void }[] = [];
  /** Block and decor meshes with their chunk centers, for distance culling. */
  private chunks: { mesh: THREE.Object3D; x: number; z: number }[] = [];
  private level: Float32Array;
  /**
   * Big worlds stream their chunks: geometry is built when the camera comes near and freed when it
   * leaves (small maps build everything up front).
   */
  private readonly lazy: boolean;
  private slots: Slot[] = [];
  private cur: THREE.Mesh[] | null = null;
  /** Chunks built / freed so far (debug info). */
  stats = { built: 0, freed: 0, live: 0 };

  constructor(terrain: Terrain, map: MapDef, _blockTex: THREE.Texture, quality: string, lazy = terrain.size > 420) {
    this.lazy = lazy;
    const props = terrain.props;
    terrain = groundView(terrain);
    this.level = this.computeLevels(terrain);
    this.buildGround(terrain, map, quality);
    this.buildBlocks(terrain, map, quality);
    this.buildDecor(terrain, quality);
    this.buildFoliage(terrain, map, quality);
    this.buildFalls(terrain, quality);
    this.buildProps(props, quality);
  }

  /** World props (src/world/props): one merged mesh plus GPU particles per 16-cell chunk. */
  private buildProps(props: Terrain['props'], quality: string) {
    if (!props.length) return;
    const kit = new PropKit(this.uniforms);
    this.disposables.push(kit);
    for (const c of kit.chunks(props, quality !== 'low')) this.defer(c.x, c.z, () => {
      for (const m of c.build()) this.place(m, c.x, c.z);
    });
  }

  /**
   * Mist and spray where water drops off a ledge: puffs of white voxels rising and drifting out
   * from the foot of every waterfall (animated on the GPU, one draw call).
   */
  private buildFalls(t: Terrain, quality: string) {
    const n = t.size;
    const level = this.level;
    type Puff = { x: number; y: number; z: number; dx: number; dz: number; top: number };
    const puffs: Puff[] = [];
    const per = quality === 'low' ? 3 : quality === 'medium' ? 5 : 8;
    for (let z = 1; z < n - 1; z++)
      for (let x = 1; x < n - 1; x++) {
        const i = z * n + x;
        if (t.cell[i] !== CELL.liquid || !/water/.test(t.tileNames[t.tile[i]] ?? '')) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (z + dz) * n + x + dx;
          const foot = t.cell[j] === CELL.liquid ? level[j] : t.elev[j];
          if (level[i] - foot < 1.5) continue;
          for (let k = 0; k < per; k++) {
            const r = (a: number) => hash2(x * 13 + k, z * 7 + k * 3, a);
            const ex = x + 0.5 + dx * 0.5 + (dz ? r(1) - 0.5 : 0);
            const ez = z + 0.5 + dz * 0.5 + (dx ? r(1) - 0.5 : 0);
            puffs.push({ x: ex, y: foot, z: ez, dx, dz, top: level[i] });
          }
        }
      }
    if (!puffs.length) return;
    const geo = unitCube();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), puffs.length);
    const ph = new Float32Array(puffs.length);
    const dir = new Float32Array(puffs.length * 3);
    const m4 = new THREE.Matrix4();
    puffs.forEach((p, i) => {
      m4.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m4);
      ph[i] = hash2(Math.floor(p.x * 31), Math.floor(p.z * 17), i);
      dir[i * 3] = p.dx;
      dir[i * 3 + 1] = p.top - p.y;
      dir[i * 3 + 2] = p.dz;
    });
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 3));
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPh;\nattribute vec3 aDir;\nvarying float vA;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float life = fract(uTime * 0.55 + aPh * 7.0);
float sz = (0.18 + life * 0.42) * (0.7 + aPh * 0.6);
transformed *= sz;
// spray kicks out from the cliff and billows up, part way to the lip
transformed.x += aDir.x * (0.2 + life * 1.3) + sin(aPh * 40.0) * life * 0.5 * (1.0 - abs(aDir.x));
transformed.z += aDir.z * (0.2 + life * 1.3) + cos(aPh * 40.0) * life * 0.5 * (1.0 - abs(aDir.z));
transformed.y += life * min(aDir.y * 0.6, 2.5) + 0.1;
vA = (1.0 - life) * smoothstep(0.0, 0.15, life);`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vA;')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vA;');
    };
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.group.add(mesh);
    this.disposables.push(geo, mat, mesh);
  }

  /** Runs a chunk builder now (small maps) or when the camera comes near (big worlds). */
  private defer(x: number, z: number, build: () => void) {
    if (this.lazy) this.slots.push({ x, z, build, objs: null });
    else build();
  }

  /** Adds a chunk mesh: owned by the streaming slot being built, or kept for the map's lifetime. */
  private place(mesh: THREE.Mesh, x: number, z: number) {
    this.group.add(mesh);
    if (this.cur) {
      this.cur.push(mesh);
      return;
    }
    this.disposables.push(mesh.geometry);
    if (mesh instanceof THREE.InstancedMesh) this.disposables.push(mesh);
    this.chunks.push({ mesh, x, z });
  }

  /** Surface height per cell: raised plateaus, the y=0 floor, sunken liquids. */
  private computeLevels(t: Terrain): Float32Array {
    const n = t.size;
    const level = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      if (t.cell[i] === CELL.liquid) level[i] = t.elev[i] + liquidLevel(t.tileNames[t.tile[i]] ?? '');
      else level[i] = t.elev[i];
    }
    return level;
  }

  private buildGround(t: Terrain, map: MapDef, quality: string) {
    const n = t.size;
    const level = this.level;
    // distance from each liquid cell to the nearest bank (for depth tint)
    const shore = new Uint8Array(n * n);
    const q = new Int32Array(n * n);
    let qh = 0;
    let qt = 0;
    const wet = (i: number) => t.cell[i] === CELL.liquid;
    for (let i = 0; i < n * n; i++) {
      if (wet(i)) {
        const x = i % n;
        const z = (i / n) | 0;
        const land = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < n && cz < n && !wet(cz * n + cx);
        if (land(x + 1, z) || land(x - 1, z) || land(x, z + 1) || land(x, z - 1)) {
          shore[i] = 1;
          q[qt++] = i;
        }
      }
    }
    while (qh < qt) {
      const i = q[qh++];
      if (shore[i] >= 5) continue;
      const x = i % n;
      const z = (i / n) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = x + dx;
        const cz = z + dz;
        if (cx < 0 || cz < 0 || cx >= n || cz >= n) continue;
        const j = cz * n + cx;
        if (wet(j) && !shore[j]) {
          shore[j] = shore[i] + 1;
          q[qt++] = j;
        }
      }
    }
    // cell data: tile, variant, liquid shore depth, elevation (for same-level tile blending)
    const data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const x = i % n;
      const z = (i / n) | 0;
      data[i * 4] = t.tile[i];
      data[i * 4 + 1] = Math.floor(hash2(x, z, 5) * ATLAS_VARIANTS);
      data[i * 4 + 2] = wet(i) ? 40 * Math.max(1, shore[i] || 5) : 0;
      data[i * 4 + 3] = Math.min(255, t.elev[i] * 16);
    }
    const cells = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    cells.magFilter = cells.minFilter = THREE.NearestFilter;
    cells.needsUpdate = true;

    // ambient occlusion on the ground from taller neighbours: cliff feet, walls, tree trunks
    const top = new Float32Array(n * n);
    const C0 = t.corner;
    for (let i = 0; i < n * n; i++) {
      const c = t.cell[i];
      top[i] = C0 ? t.centerY(i) : t.elev[i];
      if (c === CELL.solid || c === CELL.wall) top[i] += t.height[i] ? Math.min(2, t.height[i]) : 0;
    }
    const aoData = new Uint8Array(n * n * 4);
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const me = top[i];
        let occ = 0;
        for (let dz = -2; dz <= 2; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            if (!dx && !dz) continue;
            const cx = Math.min(n - 1, Math.max(0, x + dx));
            const cz = Math.min(n - 1, Math.max(0, z + dz));
            const w = Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? 1 : 0.45;
            // only real rises shade the ground (cliffs, walls, trunks), not the gentle slope itself
            occ += Math.min(2.2, Math.max(0, top[cz * n + cx] - me - (C0 ? 0.45 * Math.max(Math.abs(dx), Math.abs(dz)) : 0))) * w;
          }
        const v = Math.round(255 * (1 - Math.min(0.5, (occ / 15.2) * 0.75)));
        aoData[i * 4] = aoData[i * 4 + 1] = aoData[i * 4 + 2] = v;
        aoData[i * 4 + 3] = 255;
      }
    const ao = new THREE.DataTexture(aoData, n, n, THREE.RGBAFormat);
    ao.magFilter = ao.minFilter = THREE.LinearFilter;
    ao.needsUpdate = true;

    const atlas = makeGroundAtlas(t.tileNames, map.palette.tiles, map.palette.blocks);
    const tileCount = Math.max(1, t.tileNames.length);
    // per tile: animation kind, water kind, water depth (one texel each, any number of tiles)
    const infoData = new Uint8Array(tileCount * 4);
    t.tileNames.forEach((nm, i) => {
      const w = waterLook(nm);
      infoData[i * 4] = tileAnim(nm);
      infoData[i * 4 + 1] = w.kind;
      infoData[i * 4 + 2] = w.depth;
      infoData[i * 4 + 3] = 255;
    });
    const info = new THREE.DataTexture(infoData, tileCount, 1, THREE.RGBAFormat);
    info.magFilter = info.minFilter = THREE.NearestFilter;
    info.needsUpdate = true;

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCells = { value: cells };
      sh.uniforms.uAtlas = { value: atlas };
      sh.uniforms.uAO = { value: ao };
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uSurge = u.uSurge;
      sh.uniforms.uFocus = u.uFocus;
      sh.uniforms.uCamDir = u.uCamDir;
      sh.uniforms.uInfo = { value: info };
      sh.uniforms.uSize = { value: n };
      sh.uniforms.uTiles = { value: tileCount };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTop;\nattribute float aSide;\nvarying vec3 vWPos;\nvarying vec3 vN;\nvarying float vTop;\nvarying float vSide;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvN = normal;\nvTop = aTop;\nvSide = aSide;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWPos;
varying vec3 vN;
varying float vTop;
varying float vSide;
uniform sampler2D uCells;
uniform sampler2D uAtlas;
uniform sampler2D uAO;
uniform float uTime;
uniform float uSurge;
uniform vec3 uFocus;
uniform vec2 uCamDir;
uniform sampler2D uInfo;
uniform float uSize;
uniform float uTiles;
vec3 gEmit = vec3(0.0);
${GLSL_NOISE}
vec4 cellAt(vec2 c) { return texture2D(uCells, (c + 0.5) / uSize); }
vec3 atlasAt(float tile, float row, vec2 l) {
  l = clamp(l, 0.001, 0.999);
  return texture2D(uAtlas, vec2((tile + l.x) / uTiles, 1.0 - (row + l.y) / ${GROUND_ROWS.toFixed(1)})).rgb;
}
vec3 infoOf(float tile) { return floor(texture2D(uInfo, vec2((tile + 0.5) / uTiles, 0.5)).rgb * 255.0 + 0.5); }
float animOf(float tile) { return infoOf(tile).r; }
float tileOf(vec4 c) { return floor(c.r * 255.0 + 0.5); }
bool isLand(vec2 c) { return cellAt(c).b < 0.05; }`,
        )
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DITHER)
        .replace(
          '#include <map_fragment>',
          `{
  bool side = vSide > 0.5;
  vec2 xz = side ? vWPos.xz - vN.xz * 0.05 : vWPos.xz;
  vec2 cell = floor(xz);
  vec4 cd = cellAt(cell);
  bool liquid = cd.b > 0.05;
  vec2 pxc = (floor(xz * 32.0) + 0.5) / 32.0;
  float tile = tileOf(cd);
  float variant = floor(cd.g * 255.0 + 0.5);
  float anim = animOf(tile);
  vec2 local = fract(xz);
  vec3 col;
  float elev = cd.a * 255.0 / 16.0;
  if (side && liquid && anim == 1.0) {
    // waterfall: pixel lanes of water rushing down with bright streaks
    float along = dot(vWPos.xz, vec2(-vN.z, vN.x));
    float lx = floor(along * 16.0);
    float py = floor(vWPos.y * 16.0) / 16.0;
    float lane = h21(vec2(lx, 3.0));
    float sp = 2.6 + lane * 1.6;
    vec3 base = atlasAt(tile, variant, fract(vec2(along * 2.0, py * 2.0 + uTime * sp)));
    col = base * (1.05 + lane * 0.15);
    float streak = fract(py * 0.8 + uTime * sp * 0.5 + lane * 5.0);
    if (streak > 0.78) col = mix(col, vec3(0.88, 0.95, 1.0), 0.7);
    float lip = clamp(1.0 - (vTop - vWPos.y) * 3.0, 0.0, 1.0);
    col = mix(col, vec3(0.9, 0.97, 1.0), lip * 0.6);
    gEmit = col * 0.25;
  } else if (side) {
    // cliff face: block-aligned rim (top layer hanging over), soil, then stone deeper down
    float along = dot(vWPos.xz, vec2(-vN.z, vN.x));
    float d = max(0.0, vTop - vWPos.y);
    vec2 sb = vec2(along, d) * 2.0;
    vec2 bk = floor(sb);
    vec2 sl = fract(sb);
    float hb = h21(bk + cell * 3.7);
    if (hb > 0.5) sl.x = 1.0 - sl.x;
    float row;
    if (bk.y < 0.5) row = ${ROW_RIM.toFixed(1)};
    else row = h21(bk * 1.31 + cell) < smoothstep(0.3, 1.6, d) ? ${ROW_STONE.toFixed(1)} : ${ROW_SOIL.toFixed(1)} + step(0.5, hb);
    // high peaks are bare rock all the way up
    if (elev > 7.5) row = ${ROW_STONE.toFixed(1)};
    col = atlasAt(tile, row, sl);
    // snow caps hang over the rim of the highest cliffs
    if (elev > 10.5 && d < 0.5 - h21(vec2(bk.x, 9.0)) * 0.3) col = vec3(0.9, 0.94, 0.98) * (0.94 + hb * 0.06);
    col *= 0.94 + h21(bk + 17.0) * 0.08;
    col *= mix(1.0, 0.72, clamp(d / 6.0, 0.0, 1.0));
    col *= 0.8 + 0.2 * smoothstep(-0.2, 0.9, vWPos.y);
    gEmit = col * 0.22;
    if (anim == 4.0) col = mix(col, vec3(0.12, 0.06, 0.25), clamp(d / 4.0, 0.0, 1.0));
  } else if (liquid) {
    float shore = cd.b * 255.0 / 40.0;
    float ed = 1.0;
    vec2 lp = fract(pxc);
    if (isLand(cell + vec2(-1.0, 0.0))) ed = min(ed, lp.x);
    if (isLand(cell + vec2(1.0, 0.0))) ed = min(ed, 1.0 - lp.x);
    if (isLand(cell + vec2(0.0, -1.0))) ed = min(ed, lp.y);
    if (isLand(cell + vec2(0.0, 1.0))) ed = min(ed, 1.0 - lp.y);
    vec3 tinfo = infoOf(tile);
    float wk = tinfo.g;
    float wd = tinfo.b;
    float depth = clamp((shore - 1.0 + ed) / 2.5, 0.0, 1.0);
    // explicit depth level from the tile name: 1 light .. 5 dark, still lighter right at the bank
    if (wd > 0.5) depth = clamp((wd - 1.0) / 4.0, 0.0, 1.0) * (0.55 + 0.45 * smoothstep(0.0, 0.5, ed + (shore - 1.0)));
    // churning foam at the foot of a waterfall (a neighbouring water cell high above)
    float fallEd = 1.0;
    if (cellAt(cell + vec2(-1.0, 0.0)).a > cd.a + 0.05) fallEd = min(fallEd, lp.x);
    if (cellAt(cell + vec2(1.0, 0.0)).a > cd.a + 0.05) fallEd = min(fallEd, 1.0 - lp.x);
    if (cellAt(cell + vec2(0.0, -1.0)).a > cd.a + 0.05) fallEd = min(fallEd, lp.y);
    if (cellAt(cell + vec2(0.0, 1.0)).a > cd.a + 0.05) fallEd = min(fallEd, 1.0 - lp.y);
    vec2 bp = xz * 2.0;
    vec2 flow = fract(bp);
    // flow speed per water kind: swamp creeps, rapids rush, lakes and the sea barely drift
    float fs = anim == 2.0 ? 5.0 : wk == 1.0 ? 2.0 : wk == 2.0 ? 16.0 : wk == 3.0 ? 3.0 : wk == 4.0 ? 4.0 : 9.0;
    if (anim == 1.0 || anim == 2.0) flow = fract(bp + vec2(floor(uTime * fs) / 16.0, 0.0));
    vec3 base = atlasAt(tile, mod(variant + floor(h21(floor(bp)) * 2.0), 4.0), flow);
    if (anim == 1.0) {
      col = wd > 0.5 ? base * (1.12 - 0.22 * depth) : mix(base * 1.15, base * 0.62, depth);
      float rip = sin((pxc.x + pxc.y) * 5.0 + uTime * 1.4 + vnoise(pxc * 1.7) * 6.0);
      if (rip > (wk == 2.0 ? 0.9 : 0.975)) col += vec3(0.09, 0.11, 0.13);
      if (wk == 2.0) {
        // rapids: bright streaks racing downstream
        float sl = fract(pxc.x * 1.3 + uTime * 1.9 + h21(vec2(floor(pxc.y * 16.0), 5.0)) * 7.0);
        if (sl > 0.86) col = mix(col, vec3(0.86, 0.94, 1.0), 0.55);
      }
      if (wk != 1.0) {
        // swamp water has no foam; the sea has a wide, slow surf band
        float sea = wk == 3.0 ? 1.0 : 0.0;
        float foamW = mix(0.06, 0.15, sea) + mix(0.04, 0.06, sea) * (0.5 + 0.5 * sin(uTime * mix(2.2, 0.9, sea) + (pxc.x - pxc.y) * 4.0));
        if (ed < foamW) col = mix(col, vec3(0.9, 0.96, 1.0), 0.75);
        else if (ed < foamW + 0.07 && h21(floor(pxc * 16.0) + floor(uTime * mix(3.0, 1.5, sea))) > 0.6) col = mix(col, vec3(0.85, 0.92, 1.0), 0.4);
      }
      float churn = (1.0 - smoothstep(0.0, 1.6, fallEd + h21(floor(pxc * 16.0) + floor(uTime * 8.0)) * 0.9));
      col = mix(col, vec3(0.92, 0.97, 1.0), churn * 0.9);
      gEmit = col * 0.16;
    } else if (anim == 2.0) {
      col = base * (1.0 - depth * 0.15);
      if (ed < 0.1) col = vec3(0.25, 0.08, 0.04);
      float glow = 0.8 + 0.2 * sin(uTime * 2.0 + cell.x * 0.7 + cell.y * 0.4);
      gEmit = col * glow * (ed < 0.1 ? 0.2 : 1.0);
    } else if (anim == 4.0) {
      col = base * 0.6;
      float star = step(0.985, h21(floor(pxc * 16.0) + floor(uTime * 2.0)));
      gEmit = vec3(0.35, 0.15, 0.8) * star + base * 0.25;
    } else {
      col = mix(base, base * 0.6, depth);
      gEmit = col * 0.1;
    }
  } else {
    // ground top: one 16px texture per half-unit block, ragged pixel borders between tiles
    vec2 bp = xz * 2.0;
    vec2 blk = floor(bp);
    vec2 l = fract(bp);
    float ut = tile;
    vec2 clump = floor(xz * 16.0);
    float W = 0.22;
    float ex = min(local.x, 1.0 - local.x);
    float ez = min(local.y, 1.0 - local.y);
    vec4 nx = cellAt(cell + vec2(local.x < 0.5 ? -1.0 : 1.0, 0.0));
    vec4 nz = cellAt(cell + vec2(0.0, local.y < 0.5 ? -1.0 : 1.0));
    float tx = tileOf(nx);
    float tz = tileOf(nz);
    if (tx != tile && nx.b < 0.05 && abs(nx.a - cd.a) < 0.01 && ex < W && h21(clump + 3.1) < 0.55 * (1.0 - ex / W)) ut = tx;
    else if (tz != tile && nz.b < 0.05 && abs(nz.a - cd.a) < 0.01 && ez < W && h21(clump + 7.3) < 0.55 * (1.0 - ez / W)) ut = tz;
    float bh = h21(blk * 1.37 + ut);
    float v = floor(bh * ${ATLAS_VARIANTS.toFixed(1)});
    if (h21(blk + 5.0) > 0.5) l.x = 1.0 - l.x;
    float ua = animOf(ut);
    if (ua > 0.5 && ua < 4.5) {
      float sp = ua == 2.0 ? 2.0 : 3.0;
      l = fract(l + vec2(floor(uTime * sp) / 16.0, floor(uTime * sp * 0.5) / 16.0));
    }
    col = atlasAt(ut, v, l);
    // slopes: worn earth where the ground tilts, bare stone where it is steep (pixel-dithered)
    float tilt = 1.0 - normalize(vN).y;
    float dith = h21(clump + 23.0);
    if (!liquid && ua < 0.5) {
      if (dith < smoothstep(0.1, 0.2, tilt) * 0.85) col = atlasAt(ut, ${ROW_SOIL.toFixed(1)} + step(0.5, bh), l);
      if (dith < smoothstep(0.24, 0.36, tilt)) col = atlasAt(ut, ${ROW_STONE.toFixed(1)}, l);
    }
    // the high peaks (by block tier, not by the height of the rolling hills): bare stone, then snow
    if (elev > 7.5) col = atlasAt(ut, ${ROW_STONE.toFixed(1)}, l) * 1.05;
    if (elev > 10.5) col = vec3(0.9, 0.94, 0.98) * (0.93 + h21(floor(xz * 16.0)) * 0.07);
    col *= 0.97 + h21(blk + 11.0) * 0.05;
    // broad painted patches of lighter and darker ground
    float m = vnoise(xz * 0.07) * 0.6 + vnoise(xz * 0.23) * 0.4;
    col *= 0.9 + m * 0.2;
    col *= texture2D(uAO, xz / uSize).r;
    float spark = step(0.985, h21(floor(pxc * 16.0) + cell * 17.0 + floor(uTime * 2.0)));
    if (ua == 2.0) gEmit = col * (0.85 + 0.15 * sin(uTime * 2.0 + cell.x * 0.7)) + vec3(1.0, 0.8, 0.3) * spark * 0.6;
    if (ua == 3.0) {
      float bub = step(0.965, h21(floor(pxc * 8.0) + cell * 5.0 + floor(uTime * 0.8 + h21(cell) * 4.0)));
      col = mix(col, col * 1.35 + vec3(0.05, 0.12, 0.0), bub);
      gEmit = col * 0.22 + vec3(0.3, 0.55, 0.15) * bub * 0.15;
    }
    if (ua == 5.0) gEmit = col * (0.5 + 0.5 * sin(uTime * 3.0)) * (0.6 + uSurge * 1.5);
    if (ua == 6.0) gEmit = vec3(0.8, 0.95, 1.0) * spark * 0.3;
  }
  diffuseColor.rgb *= col;
}`,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmit;');
    };
    this.disposables.push(mat, cells, atlas, ao);

    // merged geometry per chunk: the sloped ground surface (two triangles per cell, flat runs
    // merged), flat water, and vertical rock faces where neighbouring surfaces do not meet (cliffs,
    // banks, waterfalls); raised geometry goes into its own mesh so it can cast shadows
    const per = Math.ceil(n / GCHUNK);
    const C = t.corner;
    const liq = (i: number) => t.cell[i] === CELL.liquid;
    /** Height of corner k (dx + 2 dz) of cell (x, z): water flat at its level, the edge skirt below. */
    const ch = (x: number, z: number, k: number) => {
      if (x < 0 || z < 0 || x >= n || z >= n) return SKIRT;
      const i = z * n + x;
      return liq(i) || !C ? level[i] : C[i * 4 + k];
    };
    // per-cell surface gradient, for smooth vertex normals across linked cells
    const grad = new Float32Array(n * n * 2);
    if (C)
      for (let i = 0; i < n * n; i++) {
        if (liq(i)) continue;
        grad[i * 2] = (C[i * 4 + 1] - C[i * 4] + C[i * 4 + 3] - C[i * 4 + 2]) * 0.5;
        grad[i * 2 + 1] = (C[i * 4 + 2] - C[i * 4] + C[i * 4 + 3] - C[i * 4 + 1]) * 0.5;
      }
    const vnorm = (x: number, z: number, k: number, out: number[]) => {
      const h = ch(x, z, k);
      const vx = x + (k & 1);
      const vz = z + (k >> 1);
      let gx = 0;
      let gz = 0;
      let c = 0;
      for (let j = 0; j < 4; j++) {
        const ax = vx - 1 + (j & 1);
        const az = vz - 1 + (j >> 1);
        if (ax < 0 || az < 0 || ax >= n || az >= n) continue;
        const a = az * n + ax;
        if (liq(a) || Math.abs(ch(ax, az, 3 - j) - h) > 1e-3) continue;
        gx += grad[a * 2];
        gz += grad[a * 2 + 1];
        c++;
      }
      if (c) {
        gx /= c;
        gz /= c;
      }
      const l = Math.hypot(gx, 1, gz);
      out.push(-gx / l, 1 / l, -gz / l);
    };
    const castShadows = quality !== 'low';
    for (let cz = 0; cz < per; cz++)
      for (let cx = 0; cx < per; cx++) this.defer((cx + 0.5) * GCHUNK, (cz + 0.5) * GCHUNK, () => {
        const parts = [0, 1].map(() => ({ pos: [] as number[], nor: [] as number[], top: [] as number[], side: [] as number[], idx: [] as number[] }));
        const nrm: number[] = [];
        /** A ground quad: 4 corners (x, y, z) in the order (0,0) (1,0) (1,1) (0,1), split along the flatter diagonal. */
        const surf = (p: number[], ns: number[], raised: boolean) => {
          const part = parts[raised ? 1 : 0];
          const b = part.pos.length / 3;
          part.pos.push(...p);
          part.nor.push(...ns);
          for (let k = 0; k < 4; k++) {
            part.top.push(p[k * 3 + 1]);
            part.side.push(0);
          }
          // counter-clockwise seen from above (+y)
          if (Math.abs(p[1] - p[7]) <= Math.abs(p[4] - p[10])) part.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
          else part.idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 2);
        };
        /** A rock face quad: top edge (p0, p1), bottom edge (p2, p3), facing (nx, nz). */
        const wall = (p: number[], nx: number, nz: number, t0: number, t1: number) => {
          const part = parts[1];
          const b = part.pos.length / 3;
          part.pos.push(...p);
          for (let k = 0; k < 4; k++) {
            part.nor.push(nx, 0, nz);
            part.side.push(1);
          }
          part.top.push(t0, t1, t1, t0);
          const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2];
          const bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
          const fx = ay * bz - az * by, fz = ax * by - ay * bx;
          if (fx * nx + fz * nz >= 0) part.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
          else part.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
        };
        const x0 = cx * GCHUNK;
        const z0 = cz * GCHUNK;
        const x1 = Math.min(n, x0 + GCHUNK);
        const z1 = Math.min(n, z0 + GCHUNK);
        const flatH = (x: number, z: number) => {
          const h = ch(x, z, 0);
          return ch(x, z, 1) === h && ch(x, z, 2) === h && ch(x, z, 3) === h ? h : NaN;
        };
        for (let z = z0; z < z1; z++) {
          let x = x0;
          while (x < x1) {
            const h = flatH(x, z);
            if (!Number.isNaN(h)) {
              // a run of flat cells at one height (meadows, water): one quad
              let e = x + 1;
              while (e < x1 && flatH(e, z) === h) e++;
              surf([x, h, z, e, h, z, e, h, z + 1, x, h, z + 1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], h > 0.01);
              x = e;
              continue;
            }
            nrm.length = 0;
            vnorm(x, z, 0, nrm);
            vnorm(x, z, 1, nrm);
            vnorm(x, z, 3, nrm);
            vnorm(x, z, 2, nrm);
            const a = ch(x, z, 0), b = ch(x, z, 1), c = ch(x, z, 3), d = ch(x, z, 2);
            surf([x, a, z, x + 1, b, z, x + 1, c, z + 1, x, d, z + 1], nrm.slice(), Math.max(a, b, c, d) > 0.01);
            x++;
          }
          for (let x = x0; x < x1; x++) {
            // each side: my edge corners (k1, k2) against the neighbour's matching corners
            const sides: [number, number, number, number, number, number, number[]][] = [
              [1, 0, 1, 3, 0, 2, [x + 1, z, x + 1, z + 1]],
              [-1, 0, 2, 0, 3, 1, [x, z + 1, x, z]],
              [0, 1, 3, 2, 1, 0, [x + 1, z + 1, x, z + 1]],
              [0, -1, 0, 1, 2, 3, [x, z, x + 1, z]],
            ];
            for (const [dx, dz, k1, k2, m1, m2, e] of sides) {
              const a1 = ch(x, z, k1);
              const a2 = ch(x, z, k2);
              const b1 = ch(x + dx, z + dz, m1);
              const b2 = ch(x + dx, z + dz, m2);
              if (a1 <= b1 + 1e-3 && a2 <= b2 + 1e-3) continue;
              const l1 = Math.min(a1, b1);
              const l2 = Math.min(a2, b2);
              wall([e[0], a1, e[1], e[2], a2, e[3], e[2], l2, e[3], e[0], l1, e[1]], dx, dz, a1, a2);
            }
          }
        }
        parts.forEach((part, k) => {
          if (!part.idx.length) return;
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
          geo.setAttribute('normal', new THREE.Float32BufferAttribute(part.nor, 3));
          geo.setAttribute('aTop', new THREE.Float32BufferAttribute(part.top, 1));
          geo.setAttribute('aSide', new THREE.Float32BufferAttribute(part.side, 1));
          geo.setIndex(part.idx);
          geo.computeBoundingSphere();
          const mesh = new THREE.Mesh(geo, mat);
          mesh.receiveShadow = true;
          mesh.castShadow = k === 1 && castShadows;
          this.place(mesh, x0 + GCHUNK / 2, z0 + GCHUNK / 2);
        });
      });
  }

  private buildBlocks(t: Terrain, map: MapDef, quality: string) {
    const n = t.size;
    const chunks = Math.ceil(n / CHUNK);
    const cube = unitCube();
    const tex = makeBlockAtlas();
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    const u = this.uniforms;
    // Blocks standing between the camera and the hero dissolve with an ordered dither so
    // tall trees and walls in the foreground never hide the action; block bases get a soft
    // ambient-occlusion gradient where they meet the ground.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFocus = u.uFocus;
      sh.uniforms.uCamDir = u.uCamDir;
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nattribute float aTile;\nuniform float uTime;\nvarying vec2 vSub;\nvarying float vTl;\nvarying float vNy;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
float tl = aTile;
if (tl == 2.0 && abs(normal.y) > 0.5) tl = 7.0;
if (tl == 9.0 && normal.y > 0.5) tl = 0.0;
// texture repeats per face axis (two tiles per block; detail tiles 16+ once per block)
float sX = length(instanceMatrix[0].xyz); float sY = length(instanceMatrix[1].xyz); float sZ = length(instanceMatrix[2].xyz);
vec2 fsz = abs(normal.y) > 0.5 ? vec2(sX, sZ) : abs(normal.x) > 0.5 ? vec2(sZ, sY) : vec2(sX, sY);
vec2 rep = max(vec2(1.0), floor(fsz * (aTile > 15.5 ? 1.0 : 2.0) + 0.5));
vSub = vMapUv * rep;
vTl = tl;
vNy = normal.y;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
if (aTile == 1.0) { float ph = vWPos.x * 0.35 + vWPos.z * 0.27; transformed.x += sin(uTime * 1.3 + ph) * 0.03; transformed.z += cos(uTime * 1.1 + ph) * 0.02; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFocus;\nuniform vec2 uCamDir;\nvarying vec2 vSub;\nvarying float vTl;\nvarying float vNy;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DITHER)
        .replace('#include <map_fragment>', `vec2 fs = fract(vSub);
vec4 sampledDiffuseColor = texture2D(map, vec2((fs.x * 0.998 + 0.001 + vTl) / ${TILE_COUNT}.0, fs.y));
diffuseColor *= sampledDiffuseColor;
vec2 cellId = floor(vSub);
if (vTl == 1.0 && vNy < -0.5) diffuseColor.rgb *= 0.62;
if (vTl == 1.0 && vNy > -0.5 && vNy < 0.5) diffuseColor.rgb *= 0.86;
diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.0, vWPos.y));`);
    };
    const glowMat = new THREE.MeshBasicMaterial({ map: tex });
    glowMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTile;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\nif (aTile > 15.5) vMapUv.x += aTile;\nvMapUv.x /= ${TILE_COUNT}.0;`);
    };
    this.disposables.push(cube, mat, glowMat, tex);
    const buckets: (typeof t.blocks)[] = Array.from({ length: chunks * chunks }, () => []);
    const glowBlocks: typeof t.blocks = [];
    for (const b of t.blocks) {
      if (b.glow) {
        glowBlocks.push(b);
        continue;
      }
      const cx = Math.min(chunks - 1, Math.max(0, Math.floor(b.x / CHUNK)));
      const cz = Math.min(chunks - 1, Math.max(0, Math.floor(b.z / CHUNK)));
      buckets[cz * chunks + cx].push(b);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v3 = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const pal = map.palette.blocks;
    // Blocks are drawn by material: stone as rounded masonry (lone stones as boulders), wood
    // as stacked horizontal logs, everything else as plain blocks.
    // Every block is a Minecraft-style textured cube; trees add their own blocks.
    const bucketOf = (x: number, z: number) => Math.min(chunks - 1, Math.max(0, Math.floor(z / CHUNK))) * chunks + Math.min(chunks - 1, Math.max(0, Math.floor(x / CHUNK)));
    // tree voxels are made when their chunk is built (big worlds hold ~1M of them)
    const treeB: (typeof t.trees)[] = Array.from({ length: chunks * chunks }, () => []);
    for (const tr of t.trees) treeB[bucketOf(tr.x, tr.z)].push(tr);
    const voxOf = (i: number): Vox[] => {
      const out: Vox[] = [];
      for (const tr of treeB[i]) {
        const list: Vox[] = [];
        treeVoxels(tr, map, list);
        // trees on plateaus stand on the raised ground
        const lift = t.minCorner(tr.z * n + tr.x) - (t.corner ? 0.05 : 0);
        if (lift) for (const v of list) v.y += lift;
        for (const v of list) out.push(v);
      }
      return out;
    };
    const toVox = (b: Block): Vox => {
      const s = b.s ?? 1;
      const colors = pal[b.mat] ?? [0x888888];
      col.setHex(colors[b.v % colors.length]).multiplyScalar(0.92 + hash2(b.x * 3 + b.y, b.z, 11) * 0.14);
      return { x: b.x + 0.5, y: b.y, z: b.z + 0.5, sx: s, sy: s, sz: s, color: col.getHex(), tile: tileOf(b.mat) };
    };
    const fill = (list: Block[], extra: Vox[], material: THREE.Material, shadows: boolean, cx = -1, cz = -1) => {
      let items = list.map(toVox).concat(extra);
      if (material === mat && items.some((v) => v.glow)) {
        // glowing voxels of structures (lanterns, fires) use the unlit material
        fill([], items.filter((v) => v.glow), glowMat, false, cx, cz);
        items = items.filter((v) => !v.glow);
      }
      if (!items.length) return;
      const geo = cube.clone();
      const tiles = new Float32Array(items.length);
      const mesh = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach((b, i) => {
        m4.compose(v3.set(b.x, b.y, b.z), q.identity(), sc.set(b.sx, b.sy, b.sz));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.setHex(b.color).multiplyScalar(1.12));
        tiles[i] = b.tile;
      });
      geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1));
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      if (cx >= 0) this.place(mesh, (cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK);
      else {
        this.group.add(mesh);
        this.disposables.push(mesh, geo);
      }
    };
    const shadows = quality !== 'low';
    buckets.forEach((list, i) => {
      if (!list.length && !treeB[i].length) return;
      const cx = i % chunks;
      const cz = Math.floor(i / chunks);
      this.defer((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK, () => fill(list, voxOf(i), mat, shadows, cx, cz));
    });
    fill(glowBlocks, [], glowMat, false);
  }

  private buildDecor(t: Terrain, quality: string) {
    let list = t.decor.filter((d) => !d.sway || d.glow);
    if (quality === 'low') list = list.filter((_, i) => i % 3 === 0);
    // lily pads on calm water
    const n = t.size;
    const lilies: typeof list = [];
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if (t.cell[i] !== CELL.liquid || !lilyWater(t.tileNames[t.tile[i]] ?? '')) continue;
        // calm water only: no lilies where a waterfall churns
        if (Math.max(this.level[i - 1] ?? 0, this.level[i + 1] ?? 0, this.level[i - n] ?? 0, this.level[i + n] ?? 0) > this.level[i] + 1) continue;
        const ly = this.level[i];
        if (hash2(x, z, 77) < 0.93) continue;
        const ox = hash2(x, z, 78) * 0.5 + 0.25;
        const oz = hash2(x, z, 79) * 0.5 + 0.25;
        lilies.push({ x: x + ox, z: z + oz, y: ly + 0.02, size: 0.42, h: 0.04, color: 0x4a9a3a });
        if (hash2(x, z, 80) > 0.5) lilies.push({ x: x + ox + 0.05, z: z + oz, y: ly + 0.06, size: 0.14, h: 0.1, color: 0xc89aff });
      }
    list = list.concat(lilies);
    if (!list.length) return;
    const cube = unitCube();
    const u = this.uniforms;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
transformed.x += sin(uTime * 2.2 + ph) * 0.12 * position.y * aSway;
transformed.z += cos(uTime * 1.7 + ph) * 0.08 * position.y * aSway;`,
        );
    };
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.disposables.push(cube, mat, glowMat);
    const normal = list.filter((d) => !d.glow);
    const glow = list.filter((d) => d.glow);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const build = (arr: typeof list, material: THREE.Material, cx: number, cz: number, size: number) => {
      if (!arr.length) return;
      const g = cube.clone();
      const mesh = new THREE.InstancedMesh(g, material, arr.length);
      const swayInst = new Float32Array(arr.length);
      arr.forEach((d, i) => {
        m4.makeScale(d.size, d.h ?? d.size, d.size);
        m4.setPosition(d.x, d.y, d.z);
        mesh.setMatrixAt(i, m4);
        col.setHex(d.color);
        mesh.setColorAt(i, col);
        swayInst[i] = d.sway ? 1 : 0;
      });
      g.setAttribute('aSway', new THREE.InstancedBufferAttribute(swayInst, 1));
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.disposables.push(g, mesh);
      this.chunks.push({ mesh, x: (cx + 0.5) * size, z: (cz + 0.5) * size });
    };
    // decor is split into 32-cell chunks so that far chunks can be culled
    const DC = 32;
    const per = Math.ceil(t.size / DC);
    const bucket = (arr: typeof list) => {
      const out: (typeof list)[] = Array.from({ length: per * per }, () => []);
      for (const d of arr) out[Math.min(per - 1, Math.max(0, Math.floor(d.z / DC))) * per + Math.min(per - 1, Math.max(0, Math.floor(d.x / DC)))].push(d);
      return out;
    };
    bucket(normal).forEach((arr, i) => build(arr, mat, i % per, Math.floor(i / per), DC));
    bucket(glow).forEach((arr, i) => build(arr, glowMat, i % per, Math.floor(i / per), DC));
  }

  /**
   * Ground foliage: crossed pixel-art sprites (grass tufts, ferns, small flowers, dead bushes)
   * on suitable tiles, plus the generator's swaying decor drawn as flower sprites.
   */
  private buildFoliage(t: Terrain, map: MapDef, quality: string) {
    const q = quality === 'low' ? 0.3 : quality === 'medium' ? 0.6 : 1;
    const n = t.size;
    const rules = t.tileNames.map((nm) => foliageRule(map.generator, nm));
    const tiles = map.palette.tiles;
    // quad 1x1 with its base at y=0; two crossed planes
    const plane = (rot: number) => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
      g.rotateY(rot);
      const nor = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
      return g;
    };
    const p1 = plane(Math.PI / 4);
    const p2 = plane(-Math.PI / 4);
    const cross = new THREE.BufferGeometry();
    cross.setAttribute('position', new THREE.Float32BufferAttribute([...p1.attributes.position.array, ...p2.attributes.position.array], 3));
    cross.setAttribute('normal', new THREE.Float32BufferAttribute([...p1.attributes.normal.array, ...p2.attributes.normal.array], 3));
    cross.setAttribute('uv', new THREE.Float32BufferAttribute([...p1.attributes.uv.array, ...p2.attributes.uv.array], 2));
    const i1 = Array.from(p1.index!.array);
    cross.setIndex([...i1, ...i1.map((i) => i + 4)]);
    p1.dispose();
    p2.dispose();
    const tex = makeFoliageAtlas();
    const u = this.uniforms;
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uFocus = u.uFocus;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uFocus;\nattribute float aSprite;\nvarying float vSpr;\nvarying float vH;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vSpr = aSprite;
vH = uv.y;
vec3 ip = instanceMatrix[3].xyz;
float ph = ip.x * 0.9 + ip.z * 0.6;
float bend = uv.y;
transformed.x += sin(uTime * 2.0 + ph) * 0.07 * bend;
transformed.z += cos(uTime * 1.6 + ph) * 0.05 * bend;
vec2 away = ip.xz - uFocus.xz;
float near = 1.0 - smoothstep(0.3, 1.1, length(away));
transformed.xz += normalize(away + 0.0001) * near * 0.3 * bend;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSpr;\nvarying float vH;')
        // lit like the ground below, from either side of the crossed planes
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);')
        .replace(
          '#include <map_fragment>',
          `vec4 sampledDiffuseColor = texture2D(map, vec2((clamp(vMapUv.x, 0.001, 0.999) + vSpr) / ${SPRITE_COUNT}.0, vMapUv.y));
diffuseColor *= sampledDiffuseColor;
diffuseColor.rgb *= 0.78 + 0.22 * vH;`,
        );
    };
    this.disposables.push(cross, tex, mat);
    type F = { x: number; y: number; z: number; s: number; sp: number; c: number; a: number };
    const DC = 32;
    const per = Math.ceil(n / DC);
    const buckets: F[][] = Array.from({ length: per * per }, () => []);
    const bucketPut = (f: F) => buckets[Math.min(per - 1, Math.max(0, Math.floor(f.z / DC))) * per + Math.min(per - 1, Math.max(0, Math.floor(f.x / DC)))].push(f);
    const col = new THREE.Color();
    const scan = (put: (f: F) => void, x0: number, z0: number) => {
    for (let z = z0; z < Math.min(n, z0 + DC); z++)
      for (let x = x0; x < Math.min(n, x0 + DC); x++) {
        const i = z * n + x;
        const rule = rules[t.tile[i]];
        if (!rule) continue;
        const c = t.cell[i];
        const e = t.elev[i];
        if (c !== CELL.floor && c !== CELL.hazard && c !== CELL.ice) continue;
        if (t.under.has(i)) continue;
        // nothing grows on the bare rock and snow of the peaks
        if (e >= 8) continue;
        // nor on rock-steep slopes
        const [sgx, sgz] = t.slopeAt(x + 0.5, z + 0.5);
        if (Math.hypot(sgx, sgz) > 0.75) continue;
        const dens = rule.density * q;
        let count = Math.floor(dens);
        if (hash2(x, z, 91) < dens - count) count++;
        const base = tiles[t.tileNames[t.tile[i]]]?.[0] ?? 0x5f9440;
        for (let k = 0; k < count; k++) {
          const r = (a: number) => hash2(x * 3 + k, z * 5 + k * 7, a);
          const sp = pickSprite(rule.sprites, r(1));
          const tint = SPRITE_COLORED.has(sp) ? 0xffffff : rule.tint ?? col.setHex(base).multiplyScalar(1.12 + r(2) * 0.22).getHex();
          const fx = x + 0.12 + r(3) * 0.76;
          const fz = z + 0.12 + r(4) * 0.76;
          put({ x: fx, y: t.groundY(fx, fz) - 0.03, z: fz, s: 0.6 * (0.8 + r(5) * 0.5), sp, c: tint, a: r(6) });
        }
        // a fringe of tall grass along cliff rims, hanging over the edge
        if (e && rule.sprites.some(([sp]) => sp === SPRITE.grass) && q > 0.5) {
          const lvl = this.level;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
            // only over a real rim: the neighbour's surface well below this cell's
            const nb = nz * n + nx;
            if ((t.cell[nb] === CELL.liquid ? lvl[nb] : t.centerY(nb)) > t.centerY(i) - 0.9) continue;
            for (let k = 0; k < 2; k++) {
              const r = (a: number) => hash2(x * 7 + k + dx * 3, z * 11 + k + dz * 5, a);
              const along = 0.15 + (k + r(1)) * 0.35;
              const px = dx ? x + (dx > 0 ? 0.92 : 0.08) : x + along;
              const pz = dz ? z + (dz > 0 ? 0.92 : 0.08) : z + along;
              put({ x: px, y: t.groundY(px, pz) - 0.04, z: pz, s: 0.62 * (0.85 + r(2) * 0.4), sp: r(3) < 0.6 ? SPRITE.tallGrass : SPRITE.grass, c: col.setHex(base).multiplyScalar(1.1 + r(4) * 0.2).getHex(), a: r(5) });
            }
          }
        }
      }
    };
    // swaying decor from the generator (flower rings around camps and clearings)
    for (const d of t.decor) {
      if (!d.sway || d.glow) continue;
      col.setHex(d.color);
      const hsl = { h: 0, s: 0, l: 0 };
      col.getHSL(hsl);
      let sp: number = SPRITE.grass;
      if (hsl.s > 0.25 && hsl.l > 0.3) {
        const h = hsl.h * 360;
        sp = h < 20 || h > 330 ? (hsl.l > 0.6 ? SPRITE.tulip : SPRITE.poppy) : h < 70 ? SPRITE.dandelion : h < 170 ? SPRITE.grass : h < 250 ? SPRITE.cornflower : SPRITE.allium;
      } else if (hsl.l > 0.8) sp = SPRITE.daisy;
      bucketPut({ x: d.x, y: d.y, z: d.z, s: 0.5, sp, c: SPRITE_COLORED.has(sp) ? 0xffffff : d.color, a: hash2(Math.floor(d.x * 7), Math.floor(d.z * 7), 3) });
    }
    const m4 = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    buckets.forEach((decorList, bi) => this.defer(((bi % per) + 0.5) * DC, (Math.floor(bi / per) + 0.5) * DC, () => {
      const list = decorList.slice();
      scan((f) => list.push(f), (bi % per) * DC, Math.floor(bi / per) * DC);
      if (!list.length) return;
      const geo = cross.clone();
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const spr = new Float32Array(list.length);
      list.forEach((f, i) => {
        rot.makeRotationY(f.a * Math.PI);
        m4.makeScale(f.s, f.s, f.s).premultiply(rot);
        m4.setPosition(f.x, f.y, f.z);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.setHex(f.c));
        spr[i] = f.sp;
      });
      geo.setAttribute('aSprite', new THREE.InstancedBufferAttribute(spr, 1));
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.place(mesh, ((bi % per) + 0.5) * DC, (Math.floor(bi / per) + 0.5) * DC);
    }));
  }

  /** Hides block/decor chunks farther than radius from the camera target. */
  cull(x: number, z: number, radius: number, budgetMs = 6) {
    const r2 = (radius + 24) ** 2;
    for (const c of this.chunks) c.mesh.visible = (c.x - x) ** 2 + (c.z - z) ** 2 < r2;
    if (!this.lazy) return;
    // streaming: build the nearest missing chunks within a time budget, free the far ones
    const far2 = (radius + 90) ** 2;
    const want: { s: Slot; d: number }[] = [];
    for (const s of this.slots) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (s.objs) {
        if (d > far2) this.free(s);
        continue;
      }
      if (d < r2) want.push({ s, d });
    }
    want.sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    for (const w of want) {
      this.cur = [];
      w.s.build();
      w.s.objs = this.cur;
      this.cur = null;
      this.stats.built++;
      this.stats.live++;
      if (budgetMs > 0 && performance.now() - t0 > budgetMs) break;
    }
  }

  private free(s: Slot) {
    for (const m of s.objs ?? []) {
      this.group.remove(m);
      m.geometry.dispose();
      if (m instanceof THREE.InstancedMesh) m.dispose();
    }
    s.objs = null;
    this.stats.freed++;
    this.stats.live--;
  }

  update(time: number, surge: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uSurge.value = surge;
  }

  dispose() {
    for (const s of this.slots) if (s.objs) this.free(s);
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
