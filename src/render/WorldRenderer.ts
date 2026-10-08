import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../data/types';
import { CELL, type Block, type Terrain } from '../game/Terrain';
import { hash2 } from '../core/Rng';
import { ATLAS_VARIANTS, makeBlockAtlas, makeGroundAtlas } from './Textures';
import { TILE_COUNT, roofVoxels, tileOf, treeVoxels, type Vox } from './VoxelFlora';
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
      // a few flat paving stones set into the grass (alpha 254 marks a slab cell)
      const tn = t.tileNames[t.tile[i]] ?? '';
      const slab = false && /grass/.test(tn);
      data[i * 4 + 3] = slab ? 254 : 255;
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
    vec3 soilc = uSoil * (0.8 + nz * 0.25);
    // rounded stones packed in the earth, like the reference cliff
    vec2 sg = vec2(along, d) * 2.2;
    vec2 si = floor(sg);
    vec2 sf = fract(sg);
    float best = 9.0;
    vec2 bid = si;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 pt = o + vec2(h21(si + o), h21(si + o + 9.1)) * 0.8 + 0.1;
      float dd = length((sf - pt) * vec2(1.0, 1.3));
      if (dd < best) { best = dd; bid = si + o; }
    }
    if (best < 0.36 && d > 0.25) {
      float sv = 0.62 + h21(bid) * 0.22;
      soilc = mix(vec3(sv * 1.02, sv * 0.96, sv * 0.88), uSoil * 1.3, 0.25) * (best > 0.3 ? 0.75 : 1.0);
    }
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
    // every ground cell reads as 3x3 small blocks, matching the tree blocks
    vec2 sub = floor(xz * 3.0);
    vec2 l = fract(xz * 3.0);
    variant = mod(variant + floor(h21(sub * 1.7) * 4.0), ${ATLAS_VARIANTS.toFixed(1)});
    if (anim > 0.5 && anim < 4.5) {
      float sp = anim == 2.0 ? 0.08 : 0.18;
      l = fract(local + vec2(floor(uTime * sp * 16.0) / 16.0, floor(uTime * sp * 8.0) / 16.0));
    }
    col = atlasAt(tile, variant, l);
    col *= 0.93 + h21(sub + 11.0) * 0.12;
    float se = min(min(l.x, l.y), min(1.0 - l.x, 1.0 - l.y));
    col *= se < 0.06 ? 0.9 : 1.0;
    // large painted patches of lighter and darker ground
    float m = vnoise(xz * 0.08) * 0.6 + vnoise(xz * 0.27) * 0.4;
    col *= 0.86 + m * 0.26;
    if (cd.a < 0.997) {
      // flat stone slab, slightly smaller than the cell and nudged off-grid
      vec2 lc = fract(xz) - 0.5 - (vec2(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.12;
      vec2 hs = vec2(0.36 + h21(cell) * 0.08, 0.34 + h21(cell + 1.3) * 0.08);
      vec2 q = abs(lc) - hs + 0.06;
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.06;
      if (sd < 0.0) {
        float g = 0.4 + vnoise(xz * 9.0) * 0.07 + h21(floor(xz * 16.0)) * 0.03;
        col = vec3(g * 0.98, g, g * 1.03);
        if (sd > -0.04) col *= 1.1;
      } else if (sd < 0.03) col *= 0.7;
    }
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
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nattribute float aTile;\nuniform float uTime;\nvarying vec2 vSub;\nvarying float vTl;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
float tl = aTile;
if (tl == 2.0 && abs(normal.y) > 0.5) tl = 7.0;
float rep = max(1.0, floor(max(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)) * 3.0 + 0.5));
vSub = vMapUv * rep;
vTl = tl;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
if (aTile == 1.0) { float ph = vWPos.x * 0.35 + vWPos.z * 0.27; transformed.x += sin(uTime * 1.3 + ph) * 0.04; transformed.z += cos(uTime * 1.1 + ph) * 0.03; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFocus;\nuniform vec2 uCamDir;\nvarying vec2 vSub;\nvarying float vTl;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DITHER)
        .replace('#include <map_fragment>', `vec2 fs = fract(vSub);
vec4 sampledDiffuseColor = texture2D(map, vec2((fs.x * 0.998 + 0.001 + vTl) / ${TILE_COUNT}.0, fs.y));
diffuseColor *= sampledDiffuseColor;
vec2 cellId = floor(vSub);
if (vTl == 1.0 || vTl == 2.0 || vTl == 8.0) diffuseColor.rgb *= 0.95 + fract(sin(dot(cellId, vec2(12.9898, 78.233)) + vTl) * 43758.5453) * 0.08;
diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 1.3, vWPos.y));`);
    };
    const glowMat = new THREE.MeshBasicMaterial({ map: tex });
    glowMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv.x /= ${TILE_COUNT}.0;`);
    };
    this.disposables.push(cube, mat, glowMat, tex);
    const buckets: (typeof t.blocks)[] = Array.from({ length: chunks * chunks }, () => []);
    const glowBlocks: typeof t.blocks = [];
    // natural rock piles: one lumpy, tilted boulder per column instead of stacked cubes
    const rockCols = new Map<number, { x: number; z: number; h: number; b: Block }>();
    for (const b of t.blocks) {
      if (!b.rock) continue;
      const k = b.z * n + b.x;
      const c = rockCols.get(k);
      if (c) c.h = Math.max(c.h, b.y + 1);
      else rockCols.set(k, { x: b.x, z: b.z, h: b.y + 1, b });
    }
    for (const b of t.blocks) {
      if (b.rock) continue;
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
    // Every block is a Minecraft-style textured cube; trees and roofs add their own blocks.
    const vox: Vox[][] = Array.from({ length: chunks * chunks }, () => []);
    const bucketOf = (x: number, z: number) => Math.min(chunks - 1, Math.max(0, Math.floor(z / CHUNK))) * chunks + Math.min(chunks - 1, Math.max(0, Math.floor(x / CHUNK)));
    for (const tr of t.trees) {
      const list: Vox[] = [];
      treeVoxels(tr, map, list);
      vox[bucketOf(tr.x, tr.z)].push(...list);
    }
    for (const rf of t.roofs) {
      const list: Vox[] = [];
      roofVoxels(rf, map, list);
      vox[bucketOf(rf.x + rf.w / 2, rf.z + rf.d / 2)].push(...list);
    }
    const toVox = (b: Block): Vox => {
      const s = b.s ?? 1;
      const colors = pal[b.mat] ?? [0x888888];
      col.setHex(colors[b.v % colors.length]).multiplyScalar(0.92 + hash2(b.x * 3 + b.y, b.z, 11) * 0.14);
      return { x: b.x + 0.5, y: b.y, z: b.z + 0.5, sx: s, sy: s, sz: s, color: col.getHex(), tile: tileOf(b.mat) };
    };
    const fill = (list: Block[], extra: Vox[], material: THREE.Material, shadows: boolean, cx = -1, cz = -1) => {
      const items = list.map(toVox).concat(extra);
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
      this.group.add(mesh);
      this.disposables.push(mesh, geo);
      if (cx >= 0) this.chunks.push({ mesh, x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK });
    };
    if (rockCols.size) {
      // Minecraft-style rock piles: crisp stone blocks of mixed shapes (tall, long, low)
      const rg = cube.clone();
      const list = [...rockCols.values()];
      const tiles = new Float32Array(list.length).fill(4);
      rg.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1));
      const mesh = new THREE.InstancedMesh(rg, mat, list.length);
      list.forEach((c, i) => {
        const r = (a: number) => hash2(c.x, c.z, a);
        const kind = r(1);
        if (kind < 0.35) sc.set(0.9, c.h + 0.5 + r(5) * 0.5, 0.9);
        else if (kind < 0.7) {
          const len = 1.6 + r(6) * 0.4;
          if (r(2) < 0.5) sc.set(len, 0.8 + r(5) * 0.25, 0.9);
          else sc.set(0.9, 0.8 + r(5) * 0.25, len);
        } else sc.set(1, c.h * (0.75 + r(5) * 0.25), 1);
        m4.compose(v3.set(c.x + 0.5 + (r(7) - 0.5) * 0.2, 0, c.z + 0.5 + (r(8) - 0.5) * 0.2), q.identity(), sc);
        mesh.setMatrixAt(i, m4);
        const colors = pal[c.b.mat] ?? [0x888888];
        mesh.setColorAt(i, col.setHex(colors[c.b.v % colors.length]).multiplyScalar(0.95 + r(9) * 0.2));
      });
      mesh.castShadow = quality !== 'low';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.disposables.push(mesh, rg);
    }
    const shadows = quality !== 'low';
    buckets.forEach((list, i) => fill(list, vox[i], mat, shadows, i % chunks, Math.floor(i / chunks)));
    fill(glowBlocks, [], glowMat, false);
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
