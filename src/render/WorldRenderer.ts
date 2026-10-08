import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MapDef } from '../data/types';
import { CELL, type Block, type Terrain } from '../game/Terrain';
import { hash2 } from '../core/Rng';
import { ATLAS_VARIANTS, makeGroundAtlas, makeTerrainBlockTexture } from './Textures';
import { unitCube } from './VoxelGeometry';

const CHUNK = 16;
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

/** Surface height of liquid cells: water and lava sit below the banks, the void is a chasm. */
function liquidLevel(name: string): number {
  if (/void/.test(name)) return -6;
  if (/lava/.test(name)) return -0.5;
  return -0.62;
}

const GLSL_NOISE = `
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

/** Ordered-dither fade for geometry between the camera and the hero. */
const DITHER = `
vec2 toCam = uCamDir;
vec2 rel = vWPos.xz - uFocus.xz;
float ahead = dot(rel, toCam);
vec2 dd = vec2(dot(rel, vec2(-toCam.y, toCam.x)), (ahead - 2.2) * 0.75);
float pd = length(dd);
if (vWPos.y > 1.2 && pd < 5.0 && ahead > -0.6) {
  float k = (1.0 - smoothstep(3.0, 5.0, pd)) * clamp((vWPos.y - 1.2) / 1.0, 0.0, 1.0) * 0.85;
  int ix = int(mod(gl_FragCoord.x, 4.0)); int iy = int(mod(gl_FragCoord.y, 4.0));
  float bayer = (ix == 0 ? (iy == 0 ? 0.0 : iy == 1 ? 12.0 : iy == 2 ? 3.0 : 15.0) : ix == 1 ? (iy == 0 ? 8.0 : iy == 1 ? 4.0 : iy == 2 ? 11.0 : 7.0) : ix == 2 ? (iy == 0 ? 2.0 : iy == 1 ? 14.0 : iy == 2 ? 1.0 : 13.0) : (iy == 0 ? 10.0 : iy == 1 ? 6.0 : iy == 2 ? 9.0 : 5.0)) / 16.0;
  if (bayer < k) discard;
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
  };
  private disposables: { dispose(): void }[] = [];
  /** Block and decor meshes with their chunk centers, for distance culling. */
  private chunks: { mesh: THREE.Object3D; x: number; z: number }[] = [];
  private level: Float32Array;

  constructor(terrain: Terrain, map: MapDef, _blockTex: THREE.Texture, quality: string) {
    this.level = this.computeLevels(terrain);
    this.buildGround(terrain, map);
    this.buildBlocks(terrain, map, quality);
    this.buildTrees(terrain, map, quality);
    this.buildDecor(terrain, quality);
    this.buildGrass(terrain, map, quality);
  }

  private computeLevels(t: Terrain): Float32Array {
    const n = t.size;
    const level = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) if (t.cell[i] === CELL.liquid) level[i] = liquidLevel(t.tileNames[t.tile[i]] ?? '');
    return level;
  }

  private buildGround(t: Terrain, map: MapDef) {
    const n = t.size;
    const level = this.level;
    // distance from each liquid cell to the nearest bank (for depth tint)
    const shore = new Uint8Array(n * n);
    const q = new Int32Array(n * n);
    let qh = 0;
    let qt = 0;
    for (let i = 0; i < n * n; i++) {
      if (level[i] < 0) {
        const x = i % n;
        const z = (i / n) | 0;
        const land = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < n && cz < n && level[cz * n + cx] >= 0;
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
        if (level[j] < 0 && !shore[j]) {
          shore[j] = shore[i] + 1;
          q[qt++] = j;
        }
      }
    }
    const data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const x = i % n;
      const z = (i / n) | 0;
      data[i * 4] = t.tile[i];
      data[i * 4 + 1] = Math.floor(hash2(x, z, 5) * ATLAS_VARIANTS);
      data[i * 4 + 2] = level[i] < 0 ? 40 * Math.max(1, shore[i] || 5) : 0;
      data[i * 4 + 3] = 255;
    }
    const cells = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    cells.magFilter = cells.minFilter = THREE.NearestFilter;
    cells.needsUpdate = true;

    // soft contact shadows around walls, rocks and tree trunks
    const occ = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) occ[i] = t.cell[i] === CELL.solid || t.cell[i] === CELL.wall ? 1 : 0;
    const blur = (src: Float32Array) => {
      const out = new Float32Array(n * n);
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          let s = 0;
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) {
              const cx = Math.min(n - 1, Math.max(0, x + dx));
              const cz = Math.min(n - 1, Math.max(0, z + dz));
              s += src[cz * n + cx];
            }
          out[z * n + x] = s / 9;
        }
      return out;
    };
    const soft = blur(blur(occ));
    const aoData = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const v = Math.round(255 * (1 - Math.min(0.5, soft[i] * 0.75)));
      aoData[i * 4] = aoData[i * 4 + 1] = aoData[i * 4 + 2] = v;
      aoData[i * 4 + 3] = 255;
    }
    const ao = new THREE.DataTexture(aoData, n, n, THREE.RGBAFormat);
    ao.magFilter = ao.minFilter = THREE.LinearFilter;
    ao.needsUpdate = true;

    const atlas = makeGroundAtlas(t.tileNames, map.palette.tiles);
    const anims = new Float32Array(32);
    t.tileNames.forEach((nm, i) => (anims[i] = tileAnim(nm)));
    const tileCount = Math.max(1, t.tileNames.length);
    const soilHex = map.palette.tiles.dirt?.[0] ?? map.palette.tiles.ash?.[0] ?? map.palette.tiles.rock?.[0] ?? map.palette.tiles.sand?.[0] ?? 0x6a5a4a;
    const soil = new THREE.Color(soilHex).multiplyScalar(0.8);

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCells = { value: cells };
      sh.uniforms.uAtlas = { value: atlas };
      sh.uniforms.uAO = { value: ao };
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uSurge = u.uSurge;
      sh.uniforms.uAnim = { value: anims };
      sh.uniforms.uSize = { value: n };
      sh.uniforms.uTiles = { value: tileCount };
      sh.uniforms.uSoil = { value: soil };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTop;\nvarying vec3 vWPos;\nvarying vec3 vN;\nvarying float vTop;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvN = normal;\nvTop = aTop;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWPos;
varying vec3 vN;
varying float vTop;
uniform sampler2D uCells;
uniform sampler2D uAtlas;
uniform sampler2D uAO;
uniform float uTime;
uniform float uSurge;
uniform float uAnim[32];
uniform float uSize;
uniform float uTiles;
uniform vec3 uSoil;
vec3 gEmit = vec3(0.0);
${GLSL_NOISE}
vec4 cellAt(vec2 c) { return texture2D(uCells, (c + 0.5) / uSize); }
vec3 atlasAt(float tile, float variant, vec2 l) {
  l = clamp(l, 0.001, 0.999);
  return texture2D(uAtlas, vec2((tile + l.x) / uTiles, 1.0 - (variant + l.y) / ${ATLAS_VARIANTS.toFixed(1)})).rgb;
}
float animOf(float tile) { float a = 0.0; for (int i = 0; i < 32; i++) { if (float(i) == tile) a = uAnim[i]; } return a; }
bool isLand(vec2 c) { return cellAt(c).b < 0.05; }`,
        )
        .replace(
          '#include <map_fragment>',
          `{
  bool side = abs(vN.y) < 0.5;
  vec2 xz = side ? vWPos.xz - vN.xz * 0.05 : vWPos.xz;
  vec2 cell = floor(xz);
  vec4 cd = cellAt(cell);
  bool liquid = cd.b > 0.05;
  vec2 pxc = (floor(xz * 16.0) + 0.5) / 16.0;
  if (!side && !liquid) {
    // organic, pixel-stepped borders between neighbouring ground tiles
    vec2 jit = vec2(vnoise(pxc * 2.7), vnoise(pxc * 2.7 + 17.3)) - 0.5;
    vec2 sc = floor(pxc + jit * 0.6);
    vec4 jd = cellAt(sc);
    if (jd.b < 0.05 && sc.x >= 0.0 && sc.y >= 0.0 && sc.x < uSize && sc.y < uSize) cd = jd;
  }
  float tile = floor(cd.r * 255.0 + 0.5);
  float variant = floor(cd.g * 255.0 + 0.5);
  float anim = animOf(tile);
  vec2 local = fract(xz);
  vec3 col;
  if (side) {
    float along = dot(vWPos.xz, vec2(-vN.z, vN.x));
    float d = vTop - vWPos.y;
    vec2 sp = floor(vec2(along, d) * 16.0);
    vec3 topc = atlasAt(tile, variant, vec2(fract(along), 0.4));
    float band = (2.0 + floor(h21(vec2(sp.x, cell.x * 3.0 + cell.y)) * 3.0)) / 16.0;
    float nz = h21(sp + cell * 7.0);
    vec3 soilc = uSoil * (0.8 + nz * 0.25) * (mod(sp.y, 5.0) < 1.0 ? 0.88 : 1.0);
    if (h21(sp * 0.5 + 3.0) > 0.94) soilc *= 1.25;
    col = d < band && d >= 0.0 ? topc * 0.95 : soilc;
    col *= mix(1.0, 0.35, clamp(d / 6.0, 0.0, 1.0));
    if (anim == 4.0) col = mix(col, vec3(0.12, 0.06, 0.25), clamp(d / 4.0, 0.0, 1.0));
  } else if (liquid) {
    float shore = cd.b * 255.0 / 40.0;
    float ed = 1.0;
    vec2 lp = fract(pxc);
    if (isLand(cell + vec2(-1.0, 0.0))) ed = min(ed, lp.x);
    if (isLand(cell + vec2(1.0, 0.0))) ed = min(ed, 1.0 - lp.x);
    if (isLand(cell + vec2(0.0, -1.0))) ed = min(ed, lp.y);
    if (isLand(cell + vec2(0.0, 1.0))) ed = min(ed, 1.0 - lp.y);
    float depth = clamp((shore - 1.0 + ed) / 2.5, 0.0, 1.0);
    vec2 flow = local;
    if (anim == 1.0 || anim == 2.0) flow = fract(local + vec2(floor(uTime * (anim == 2.0 ? 0.6 : 1.2)) / 16.0, 0.0));
    vec3 base = atlasAt(tile, variant, flow);
    if (anim == 1.0) {
      col = mix(base * 1.2, base * 0.6, depth);
      col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))), 0.18);
      float rip = sin((pxc.x + pxc.y) * 5.0 + uTime * 1.4 + vnoise(pxc * 1.7) * 6.0);
      if (rip > 0.975) col += vec3(0.09, 0.11, 0.13);
      float foamW = 0.07 + 0.045 * (0.5 + 0.5 * sin(uTime * 2.2 + (pxc.x - pxc.y) * 4.0));
      if (ed < foamW) col = mix(col, vec3(0.93, 0.97, 1.0), 0.85);
      else if (ed < foamW + 0.07 && h21(floor(pxc * 16.0) + floor(uTime * 3.0)) > 0.6) col = mix(col, vec3(0.85, 0.92, 1.0), 0.45);
      gEmit = col * 0.18;
    } else if (anim == 2.0) {
      col = base * (1.0 - depth * 0.15);
      if (ed < 0.12) col = vec3(0.25, 0.08, 0.04);
      float glow = 0.8 + 0.2 * sin(uTime * 2.0 + cell.x * 0.7 + cell.y * 0.4);
      gEmit = col * glow * (ed < 0.12 ? 0.2 : 1.0);
    } else if (anim == 4.0) {
      col = base * 0.6;
      float star = step(0.985, h21(floor(pxc * 16.0) + floor(uTime * 2.0)));
      gEmit = vec3(0.35, 0.15, 0.8) * star + base * 0.25;
    } else {
      col = mix(base, base * 0.6, depth);
      gEmit = col * 0.1;
    }
  } else {
    vec2 l = local;
    if (anim > 0.5 && anim < 4.5) {
      float sp = anim == 2.0 ? 0.08 : 0.18;
      l = fract(local + vec2(floor(uTime * sp * 16.0) / 16.0, floor(uTime * sp * 8.0) / 16.0));
    }
    col = atlasAt(tile, variant, l);
    // large painted patches of lighter and darker ground
    float m = vnoise(xz * 0.08) * 0.6 + vnoise(xz * 0.27) * 0.4;
    col *= 0.86 + m * 0.26;
    col *= texture2D(uAO, xz / uSize).r;
    float spark = step(0.985, h21(floor(pxc * 16.0) + cell * 17.0 + floor(uTime * 2.0)));
    if (anim == 2.0) gEmit = col * (0.85 + 0.15 * sin(uTime * 2.0 + cell.x * 0.7)) + vec3(1.0, 0.8, 0.3) * spark * 0.6;
    if (anim == 3.0) {
      // toxic bog: slow 2x2 bubbles instead of star-like sparkles
      float bub = step(0.965, h21(floor(pxc * 8.0) + cell * 5.0 + floor(uTime * 0.8 + h21(cell) * 4.0)));
      col = mix(col, col * 1.35 + vec3(0.05, 0.12, 0.0), bub);
      gEmit = col * 0.22 + vec3(0.3, 0.55, 0.15) * bub * 0.15;
    }
    if (anim == 5.0) gEmit = col * (0.5 + 0.5 * sin(uTime * 3.0)) * (0.6 + uSurge * 1.5);
    if (anim == 6.0) gEmit = vec3(0.8, 0.95, 1.0) * spark * 0.3;
  }
  diffuseColor.rgb *= col;
}`,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmit;');
    };
    this.disposables.push(mat, cells, atlas, ao);

    // merged quads per chunk: tops (row runs of equal height) and vertical banks
    const per = Math.ceil(n / GCHUNK);
    const lv = (x: number, z: number) => (x < 0 || z < 0 || x >= n || z >= n ? SKIRT : level[z * n + x]);
    for (let cz = 0; cz < per; cz++)
      for (let cx = 0; cx < per; cx++) {
        const pos: number[] = [];
        const nor: number[] = [];
        const top: number[] = [];
        const idx: number[] = [];
        const quad = (p: number[], nx: number, ny: number, nz: number, h: number) => {
          const b = pos.length / 3;
          pos.push(...p);
          for (let k = 0; k < 4; k++) {
            nor.push(nx, ny, nz);
            top.push(h);
          }
          // pick the winding whose face normal matches the requested one
          const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2];
          const bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
          const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
          if (fx * nx + fy * ny + fz * nz >= 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
          else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
        };
        const x0 = cx * GCHUNK;
        const z0 = cz * GCHUNK;
        const x1 = Math.min(n, x0 + GCHUNK);
        const z1 = Math.min(n, z0 + GCHUNK);
        for (let z = z0; z < z1; z++) {
          let run = x0;
          for (let x = x0; x <= x1; x++) {
            if (x < x1 && lv(x, z) === lv(run, z)) continue;
            const y = lv(run, z);
            quad([run, y, z, run, y, z + 1, x, y, z + 1, x, y, z], 0, 1, 0, y);
            run = x;
          }
          for (let x = x0; x < x1; x++) {
            const y = lv(x, z);
            const sides: [number, number, number[]][] = [
              [1, 0, [x + 1, 0, z, x + 1, 0, z + 1]],
              [-1, 0, [x, 0, z + 1, x, 0, z]],
              [0, 1, [x + 1, 0, z + 1, x, 0, z + 1]],
              [0, -1, [x, 0, z, x + 1, 0, z]],
            ];
            for (const [dx, dz, e] of sides) {
              const ny = lv(x + dx, z + dz);
              if (ny >= y) continue;
              quad([e[0], y, e[2], e[3], y, e[5], e[3], ny, e[5], e[0], ny, e[2]], dx, 0, dz, y);
            }
          }
        }
        if (!idx.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.disposables.push(geo);
        this.chunks.push({ mesh, x: x0 + GCHUNK / 2, z: z0 + GCHUNK / 2 });
      }
  }

  private buildBlocks(t: Terrain, map: MapDef, quality: string) {
    const n = t.size;
    const chunks = Math.ceil(n / CHUNK);
    const cube = unitCube();
    const tex = makeTerrainBlockTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const u = this.uniforms;
    // Blocks standing between the camera and the hero dissolve with an ordered dither so
    // tall trees and walls in the foreground never hide the action; block bases get a soft
    // ambient-occlusion gradient where they meet the ground.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFocus = u.uFocus;
      sh.uniforms.uCamDir = u.uCamDir;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFocus;\nuniform vec2 uCamDir;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DITHER)
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 1.3, vWPos.y));');
    };
    const glowMat = new THREE.MeshBasicMaterial({ map: tex });
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
    const occ = new Set<number>();
    const key = (x: number, y: number, z: number) => (y * n + z) * n + x;
    for (const b of t.blocks) if ((b.s ?? 1) === 1) occ.add(key(b.x, b.y, b.z));
    const STONE = /stone|rock|basalt|brick|marble|sandstone|^wall|pillar|bone|obsidian|cobble/;
    const WOOD = /plank|trunk|log/;
    type Style = 'cube' | 'stone' | 'boulder' | 'logX' | 'logZ';
    const styleOf = (b: Block): Style => {
      if ((b.s ?? 1) !== 1) return 'cube';
      const nx = occ.has(key(b.x - 1, b.y, b.z)) || occ.has(key(b.x + 1, b.y, b.z));
      const nz = occ.has(key(b.x, b.y, b.z - 1)) || occ.has(key(b.x, b.y, b.z + 1));
      if (WOOD.test(b.mat)) return nz && !nx ? 'logZ' : 'logX';
      if (STONE.test(b.mat)) {
        const ci = b.z * n + b.x;
        const lone = (t.height[ci] ?? 0) <= 2 && !(nx && nz) && !(occ.has(key(b.x - 1, b.y, b.z)) && occ.has(key(b.x + 1, b.y, b.z))) && !(occ.has(key(b.x, b.y, b.z - 1)) && occ.has(key(b.x, b.y, b.z + 1)));
        return lone ? 'boulder' : 'stone';
      }
      return 'cube';
    };
    const stoneGeo = new RoundedBoxGeometry(0.94, 0.94, 0.94, 2, 0.16);
    stoneGeo.translate(0, 0.47, 0);
    const boulderGeo = (() => {
      const g = new THREE.IcosahedronGeometry(0.62, 1).toNonIndexed();
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + (hash2(Math.round(x * 40), Math.round(y * 40) * 3 + Math.round(z * 40) * 7, 3) - 0.5) * 0.28;
        p.setXYZ(i, x * k, Math.max(-0.1, y * k * 0.8), z * k);
      }
      g.translate(0, 0.42, 0);
      g.computeVertexNormals();
      return g;
    })();
    const logGeo = (() => {
      const parts: THREE.BufferGeometry[] = [];
      for (const [y, o] of [[0.25, 0.04], [0.75, -0.04]] as [number, number][]) {
        const c = new THREE.CylinderGeometry(0.26, 0.26, 1.02, 9, 1);
        c.rotateZ(Math.PI / 2);
        c.translate(o, y, 0);
        parts.push(c);
      }
      const g = mergeGeometries(parts, false)!;
      for (const c of parts) c.dispose();
      return g;
    })();
    const GEO: Record<Style, THREE.BufferGeometry> = { cube, stone: stoneGeo, boulder: boulderGeo, logX: logGeo, logZ: logGeo };
    this.disposables.push(stoneGeo, boulderGeo, logGeo);
    const fill = (list: typeof t.blocks, material: THREE.Material, shadows: boolean, cx = -1, cz = -1) => {
      if (!list.length) return;
      const groups = new Map<Style, Block[]>();
      for (const b of list) {
        const st = material === glowMat ? 'cube' : styleOf(b);
        let g = groups.get(st);
        if (!g) groups.set(st, (g = []));
        g.push(b);
      }
      for (const [st, items] of groups) {
        const mesh = new THREE.InstancedMesh(GEO[st], material, items.length);
        items.forEach((b, i) => {
          const s = b.s ?? 1;
          const h = hash2(b.x * 3 + b.y, b.z, 23);
          let yaw = 0;
          sc.set(s, s, s);
          if (st === 'logZ') yaw = Math.PI / 2;
          else if (st === 'stone') {
            // masonry: each stone slightly different in size and turn
            yaw = (h - 0.5) * 0.12;
            const k = 0.94 + hash2(b.x, b.z * 5 + b.y, 24) * 0.08;
            sc.set(k, 0.96 + h * 0.06, k);
          } else if (st === 'boulder') {
            yaw = h * Math.PI * 2;
            const k = 0.85 + hash2(b.x, b.z, 25) * 0.4;
            sc.set(k, 0.8 + hash2(b.z, b.x, 26) * 0.5, k);
          }
          q.setFromAxisAngle(v3.set(0, 1, 0), yaw);
          m4.compose(v3.set(b.x + 0.5, b.y, b.z + 0.5), q, sc);
          mesh.setMatrixAt(i, m4);
          const colors = pal[b.mat] ?? [0x888888];
          col.setHex(colors[b.v % colors.length]);
          const shade = 0.9 + hash2(b.x * 3 + b.y, b.z, 11) * 0.16;
          col.multiplyScalar(shade);
          mesh.setColorAt(i, col);
        });
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        this.disposables.push(mesh);
        if (cx >= 0) this.chunks.push({ mesh, x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK });
      }
    };
    const shadows = quality !== 'low';
    buckets.forEach((list, i) => fill(list, mat, shadows, i % chunks, Math.floor(i / chunks)));
    fill(glowBlocks, glowMat, false);
  }

  /**
   * Rounded trees: a tapered trunk with a root flare and a canopy of faceted blobs for
   * broadleaf trees, stacked cones with snowy tips for pines. Merged per chunk; the canopy
   * sways in the wind and dissolves when it stands in front of the hero.
   */
  private buildTrees(t: Terrain, map: MapDef, quality: string) {
    if (!t.trees.length && !t.roofs.length) return;
    const pal = map.palette.blocks;
    const u = this.uniforms;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFocus = u.uFocus;
      sh.uniforms.uCamDir = u.uCamDir;
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nattribute float aSway;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float ph = position.x * 0.35 + position.z * 0.27;
transformed.x += sin(uTime * 1.3 + ph) * 0.07 * aSway;
transformed.z += cos(uTime * 1.1 + ph) * 0.05 * aSway;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFocus;\nuniform vec2 uCamDir;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DITHER);
    };
    this.disposables.push(mat);
    const rbox = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
    const blob = new THREE.IcosahedronGeometry(1, 1);
    const cone = new THREE.ConeGeometry(1, 1, 8, 2);
    const trunkG = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
    const dome = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const disc = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
    const slab = new THREE.BoxGeometry(1, 1, 1, 4, 1, 4);
    const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
    const tmp = new THREE.Color();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    // one coloured, flat-shaded piece of a tree in world space
    const piece = (g: THREE.BufferGeometry, px: number, py: number, pz: number, sx: number, sy: number, sz: number, ry: number, color: number, sway: number, seed: number, opts: { jitter?: number; snowAbove?: number; snow?: number; taper?: number } = {}) => {
      const geo = g.clone().toNonIndexed();
      geo.deleteAttribute('uv');
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const jit = opts.jitter ?? 0;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        if (opts.taper !== undefined) {
          const k = 1 - (y + 0.5) * opts.taper;
          x *= k;
          z *= k;
        }
        if (jit) {
          // lumpy, organic silhouette; the same corner moves the same way on every face
          const n = hash2(Math.round(x * 50) + seed, Math.round(y * 50) * 7 + Math.round(z * 50) * 13, 5) - 0.5;
          x *= 1 + n * jit;
          y *= 1 + n * jit;
          z *= 1 + n * jit;
        }
        pos.setXYZ(i, x, y, z);
      }
      e.set(0, ry, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
      geo.applyMatrix4(m4);
      geo.computeVertexNormals();
      const n = pos.count;
      const cols = new Float32Array(n * 3);
      const sw = new Float32Array(n);
      const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
      const wp = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < n; i += 3) {
        // per-face tint: lit tops, darker undersides, a little variation
        const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
        const cy = (wp.getY(i) + wp.getY(i + 1) + wp.getY(i + 2)) / 3;
        const v = 0.78 + ny * 0.2 + (hash2(i + seed, seed, 9) - 0.5) * 0.14;
        tmp.setHex(opts.snowAbove !== undefined && cy > opts.snowAbove && ny > 0.1 ? opts.snow ?? 0xffffff : color).multiplyScalar(v);
        for (let j = 0; j < 3; j++) {
          cols[(i + j) * 3] = tmp.r;
          cols[(i + j) * 3 + 1] = tmp.g;
          cols[(i + j) * 3 + 2] = tmp.b;
          sw[i + j] = sway * Math.max(0, wp.getY(i + j) - 1.2);
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geo.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
      return geo;
    };
    const chunks = Math.ceil(t.size / CHUNK);
    const buckets: THREE.BufferGeometry[][] = Array.from({ length: chunks * chunks }, () => []);
    for (const tr of t.trees) {
      const cx = tr.x + 0.5;
      const cz = tr.z + 0.5;
      const seed = tr.x * 131 + tr.z * 17;
      const r = (a: number) => hash2(tr.x, tr.z, a);
      const trunkCols = pal[tr.trunk] ?? [0x6e4c2c];
      const leafCols = pal[tr.leaf] ?? [0x3f8a30];
      const trunkC = trunkCols[tr.v % trunkCols.length];
      const leafC = leafCols[tr.v % leafCols.length];
      const parts: THREE.BufferGeometry[] = [];
      // Minecraft-like: everything is built from slightly bevelled cubes
      const cube = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number, sway: number, sd: number) => {
        tmp.setHex(c).offsetHSL(0, 0, (hash2(sd, seed, 3) - 0.5) * 0.07);
        parts.push(piece(rbox, x, y, z, sx, sy, sz, 0, tmp.getHex(), sway, sd));
      };
      const ox = cx + (r(5) - 0.5) * 0.1;
      const oz = cz + (r(6) - 0.5) * 0.1;
      if (tr.kind === 'oak') {
        const h = tr.h;
        const big = h >= 4;
        cube(ox, h / 2, oz, 0.55, h, 0.55, trunkC, 0, seed);
        const R = big ? 2 : 1;
        const top = h + 0.2;
        // two wide leaf layers, corners trimmed at random, then a small cap
        for (let ly = 0; ly < 2; ly++) {
          for (let ix = -R; ix <= R; ix++) for (let iz = -R; iz <= R; iz++) {
            const corner = Math.abs(ix) === R && Math.abs(iz) === R;
            if (corner && r(200 + ix * 7 + iz * 3 + ly * 31) < 0.7) continue;
            cube(ox + ix * 0.8, top - 0.8 + ly * 0.8, oz + iz * 0.8, 0.84, 0.84, 0.84, leafC, 1, seed + 50 + ix * 9 + iz * 3 + ly * 41);
          }
        }
        for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
          if (ix && iz && r(300 + ix * 5 + iz) < 0.6) continue;
          cube(ox + ix * 0.8, top + 0.8, oz + iz * 0.8, 0.84, 0.84, 0.84, leafC, 1, seed + 90 + ix * 9 + iz);
        }
      } else if (tr.kind === 'mushroom') {
        // giant Minecraft-style toadstool: square stem, flat blocky cap with white spots
        const capC = leafCols[0];
        const stemC = leafCols[1 % leafCols.length];
        const h = tr.h + 0.6;
        cube(ox, h / 2, oz, 0.7, h, 0.7, stemC, 0, seed);
        const R = 2;
        for (let ix = -R; ix <= R; ix++) for (let iz = -R; iz <= R; iz++) {
          if (Math.abs(ix) === R && Math.abs(iz) === R) continue;
          const spot = r(400 + ix * 11 + iz * 5) < 0.22;
          cube(ox + ix * 0.75, h + 0.3, oz + iz * 0.75, 0.78, 0.6, 0.78, spot ? 0xf4eee2 : capC, 0, seed + 60 + ix * 9 + iz);
        }
        for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
          const spot = r(500 + ix * 11 + iz * 5) < 0.25;
          cube(ox + ix * 0.75, h + 0.85, oz + iz * 0.75, 0.78, 0.55, 0.78, spot ? 0xf4eee2 : capC, 0, seed + 120 + ix * 9 + iz);
        }
        cube(ox, h - 0.08, oz, 3.4, 0.12, 3.4, 0xb89a80, 0, seed + 2);
      } else {
        // spruce: square trunk and stacked square layers that narrow upward
        const h = tr.h + 1;
        cube(ox, h / 2, oz, 0.5, h, 0.5, trunkC, 0, seed);
        const layers = [2, 1, 1, 0];
        for (let i = 0; i < layers.length; i++) {
          const R = layers[i];
          const y = 1.5 + i * ((h - 1.2) / layers.length);
          for (let ix = -R; ix <= R; ix++) for (let iz = -R; iz <= R; iz++) {
            if (R === 2 && Math.abs(ix) === 2 && Math.abs(iz) === 2) continue;
            if (R === 1 && i === 2 && ix && iz) continue;
            const c = i === layers.length - 1 && pal.snow ? 0xf2f6fa : leafC;
            cube(ox + ix * 0.7, y, oz + iz * 0.7, 0.74, 0.6, 0.74, c, 0.6, seed + 30 + i * 37 + ix * 7 + iz);
          }
        }
      }
      const bx = Math.min(chunks - 1, Math.max(0, Math.floor(tr.x / CHUNK)));
      const bz = Math.min(chunks - 1, Math.max(0, Math.floor(tr.z / CHUNK)));
      buckets[bz * chunks + bx].push(...parts);
    }
    // Minecraft-style stepped roofs: stair layers that narrow toward the ridge
    for (const rf of t.roofs) {
      const cols = pal[rf.mat] ?? [0x8a4a3a];
      let rc = cols[0];
      if (rf.mat === 'leaves') rc = 0x9a7a4a;
      if (rf.mat === 'snow') rc = 0xeef3f8;
      const seed = rf.x * 31 + rf.z * 7;
      const alongX = rf.w >= rf.d;
      const L = (alongX ? rf.w : rf.d) + 0.6;
      const W = (alongX ? rf.d : rf.w) + 0.6;
      const cx = rf.x + rf.w / 2;
      const cz = rf.z + rf.d / 2;
      const parts: THREE.BufferGeometry[] = [];
      const steps = Math.max(2, Math.ceil(W / 2));
      const stepW = W / (steps * 2);
      for (let i = 0; i < steps; i++) {
        const w = W - i * stepW * 2;
        tmp.setHex(rc).offsetHSL(0, 0, (i % 2 ? -0.04 : 0.02));
        const sx = alongX ? L : w;
        const sz = alongX ? w : L;
        parts.push(piece(rbox, cx, rf.y + 0.25 + i * 0.5, cz, sx, 0.5, sz, 0, tmp.getHex(), 0, seed + i));
      }
      // log ridge on top
      parts.push(piece(rbox, cx, rf.y + 0.25 + steps * 0.5 - 0.1, cz, alongX ? L + 0.1 : 0.4, 0.3, alongX ? 0.4 : L + 0.1, 0, 0x5a3a24, 0, seed + 20));
      if (L > 4) parts.push(piece(rbox, cx + (alongX ? L * 0.25 : W * 0.25), rf.y + steps * 0.35 + 0.3, cz + (alongX ? W * 0.25 : L * 0.25), 0.6, steps * 0.7 + 0.6, 0.6, 0, 0x7a7a80, 0, seed + 7));
      const bx = Math.min(chunks - 1, Math.max(0, Math.floor(cx / CHUNK)));
      const bz = Math.min(chunks - 1, Math.max(0, Math.floor(cz / CHUNK)));
      buckets[bz * chunks + bx].push(...parts);
    }
    rbox.dispose();
    blob.dispose();
    cone.dispose();
    trunkG.dispose();
    dome.dispose();
    disc.dispose();
    slab.dispose();
    prism.dispose();
    const shadows = quality !== 'low';
    buckets.forEach((list, i) => {
      if (!list.length) return;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!geo) return;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.disposables.push(geo);
      this.chunks.push({ mesh, x: ((i % chunks) + 0.5) * CHUNK, z: (Math.floor(i / chunks) + 0.5) * CHUNK });
    });
  }

  private buildDecor(t: Terrain, quality: string) {
    let list = t.decor;
    if (quality === 'low') list = list.filter((_, i) => i % 3 === 0);
    // lily pads on calm water
    const n = t.size;
    const lilies: typeof list = [];
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if (this.level[i] !== -0.62 || !/water/.test(t.tileNames[t.tile[i]] ?? '')) continue;
        if (hash2(x, z, 77) < 0.93) continue;
        const ox = hash2(x, z, 78) * 0.5 + 0.25;
        const oz = hash2(x, z, 79) * 0.5 + 0.25;
        lilies.push({ x: x + ox, z: z + oz, y: -0.6, size: 0.42, h: 0.04, color: 0x4a9a3a });
        if (hash2(x, z, 80) > 0.5) lilies.push({ x: x + ox + 0.05, z: z + oz, y: -0.56, size: 0.14, h: 0.1, color: 0xc89aff });
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

  /** Dense swaying grass tufts and small flowers on grassy ground. */
  private buildGrass(t: Terrain, map: MapDef, quality: string) {
    const density = quality === 'low' ? 0 : quality === 'medium' ? 0.35 : 0.6;
    if (!density) return;
    const n = t.size;
    const grassy = t.tileNames.map((nm) => /grass|moss/.test(nm));
    if (!grassy.some(Boolean)) return;
    const blade = (x: number, z: number, h: number, w: number) => {
      const b = new THREE.BoxGeometry(w, h, w);
      b.translate(x, h / 2, z);
      b.deleteAttribute('uv');
      const c = new Float32Array(b.attributes.position.count * 3);
      for (let i = 0; i < b.attributes.position.count; i++) {
        const k = 0.55 + (b.attributes.position.getY(i) / h) * 0.6;
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
      }
      b.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return b;
    };
    const tuft = mergeGeometries([blade(-0.1, 0.04, 0.36, 0.07), blade(0.09, -0.07, 0.28, 0.07), blade(0.02, 0.11, 0.44, 0.07), blade(-0.02, -0.12, 0.22, 0.06)])!;
    const stem = blade(0, 0, 0.3, 0.04);
    const head = new THREE.BoxGeometry(0.14, 0.1, 0.14);
    head.translate(0, 0.33, 0);
    head.deleteAttribute('uv');
    head.setAttribute('color', new THREE.BufferAttribute(new Float32Array(head.attributes.position.count * 3).fill(1.6), 3));
    const flower = mergeGeometries([stem, head])!;
    const u = this.uniforms;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uFocus = u.uFocus;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uFocus;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 ip = instanceMatrix[3].xyz;
float ph = ip.x * 0.9 + ip.z * 0.6;
float bend = position.y * 2.2;
transformed.x += sin(uTime * 2.0 + ph) * 0.06 * bend;
transformed.z += cos(uTime * 1.6 + ph) * 0.04 * bend;
vec2 away = ip.xz - uFocus.xz;
float near = 1.0 - smoothstep(0.3, 1.1, length(away));
transformed.xz += normalize(away + 0.0001) * near * 0.25 * bend;`,
      );
    };
    this.disposables.push(tuft, flower, mat, stem, head);
    const palette = map.palette.tiles;
    const flowerColors = [0xffffff, 0xd8b8ff, 0xffb84a, 0xff8ab8, 0xfff07a];
    const m4 = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    const col = new THREE.Color();
    const DC = 32;
    const per = Math.ceil(n / DC);
    for (let cz = 0; cz < per; cz++)
      for (let cx = 0; cx < per; cx++) {
        const tufts: [number, number, number, number, number][] = [];
        const flowers: [number, number, number, number][] = [];
        for (let z = cz * DC; z < Math.min(n, (cz + 1) * DC); z++)
          for (let x = cx * DC; x < Math.min(n, (cx + 1) * DC); x++) {
            const i = z * n + x;
            if (t.cell[i] !== CELL.floor || !grassy[t.tile[i]]) continue;
            const r = hash2(x, z, 91);
            if (r > density) continue;
            const ox = hash2(x, z, 92);
            const oz = hash2(x, z, 93);
            const base = palette[t.tileNames[t.tile[i]]]?.[0] ?? 0x4a8a3a;
            if (hash2(x, z, 94) > 0.9) flowers.push([x + ox, z + oz, flowerColors[Math.floor(hash2(x, z, 95) * flowerColors.length)], hash2(x, z, 96)]);
            else tufts.push([x + ox, z + oz, base, hash2(x, z, 97), 0.8 + hash2(x, z, 98) * 0.6]);
          }
        const addInst = (geo: THREE.BufferGeometry, count: number, setter: (mesh: THREE.InstancedMesh, i: number) => void) => {
          if (!count) return;
          const mesh = new THREE.InstancedMesh(geo, mat, count);
          for (let i = 0; i < count; i++) setter(mesh, i);
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          this.group.add(mesh);
          this.disposables.push(mesh);
          this.chunks.push({ mesh, x: (cx + 0.5) * DC, z: (cz + 0.5) * DC });
        };
        addInst(tuft, tufts.length, (mesh, i) => {
          const [x, z, c, a, s] = tufts[i];
          rot.makeRotationY(a * Math.PI * 2);
          m4.makeScale(s, s, s).premultiply(rot);
          m4.setPosition(x, 0, z);
          mesh.setMatrixAt(i, m4);
          mesh.setColorAt(i, col.setHex(c).multiplyScalar(1.05 + a * 0.25));
        });
        addInst(flower, flowers.length, (mesh, i) => {
          const [x, z, c, a] = flowers[i];
          rot.makeRotationY(a * Math.PI * 2);
          m4.copy(rot);
          m4.setPosition(x, 0, z);
          mesh.setMatrixAt(i, m4);
          mesh.setColorAt(i, col.setHex(c));
        });
      }
  }

  /** Hides block/decor chunks farther than radius from the camera target. */
  cull(x: number, z: number, radius: number) {
    const r2 = (radius + 24) ** 2;
    for (const c of this.chunks) c.mesh.visible = (c.x - x) ** 2 + (c.z - z) ** 2 < r2;
  }

  update(time: number, surge: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uSurge.value = surge;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
