import * as THREE from 'three';
import type { MapDef } from '../data/types';
import type { Terrain } from '../game/Terrain';
import { hash2 } from '../core/Rng';
import { ATLAS_VARIANTS, makeGroundAtlas } from './Textures';
import { unitCube } from './VoxelGeometry';

const CHUNK = 16;

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

/** Static voxel world: shader-tiled ground, instanced block chunks, decor and glow blocks. */
export class WorldRenderer {
  readonly group = new THREE.Group();
  readonly uniforms = { uTime: { value: 0 }, uSurge: { value: 0 }, uFocus: { value: new THREE.Vector3(0, 0, 9999) } };
  private disposables: { dispose(): void }[] = [];

  constructor(terrain: Terrain, map: MapDef, blockTex: THREE.Texture, quality: string) {
    this.buildGround(terrain, map);
    this.buildBlocks(terrain, map, blockTex, quality);
    this.buildDecor(terrain, quality);
  }

  private buildGround(t: Terrain, map: MapDef) {
    const n = t.size;
    const data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const x = i % n;
      const z = (i / n) | 0;
      data[i * 4] = t.tile[i];
      data[i * 4 + 1] = Math.floor(hash2(x, z, 5) * ATLAS_VARIANTS);
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }
    const cells = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    cells.magFilter = cells.minFilter = THREE.NearestFilter;
    cells.needsUpdate = true;
    const atlas = makeGroundAtlas(t.tileNames, map.palette.tiles);
    const anims = new Float32Array(32);
    t.tileNames.forEach((nm, i) => (anims[i] = tileAnim(nm)));
    const geo = new THREE.PlaneGeometry(n, n, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(n / 2, 0, n / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const u = this.uniforms;
    const tileCount = Math.max(1, t.tileNames.length);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCells = { value: cells };
      sh.uniforms.uAtlas = { value: atlas };
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uSurge = u.uSurge;
      sh.uniforms.uAnim = { value: anims };
      sh.uniforms.uSize = { value: n };
      sh.uniforms.uTiles = { value: tileCount };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vWorldXZ;
uniform sampler2D uCells;
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uSurge;
uniform float uAnim[32];
uniform float uSize;
uniform float uTiles;
float gAnim = 0.0;
vec3 gEmit = vec3(0.0);`,
        )
        .replace(
          '#include <map_fragment>',
          `{
  vec2 cell = floor(vWorldXZ);
  vec2 local = fract(vWorldXZ);
  vec4 cd = texture2D(uCells, (cell + 0.5) / uSize);
  float tile = floor(cd.r * 255.0 + 0.5);
  float variant = floor(cd.g * 255.0 + 0.5);
  float anim = 0.0;
  for (int i = 0; i < 32; i++) { if (float(i) == tile) anim = uAnim[i]; }
  gAnim = anim;
  vec2 l = local;
  if (anim > 0.5 && anim < 4.5) {
    float sp = anim == 2.0 ? 0.08 : 0.18;
    l = fract(local + vec2(floor(uTime * sp * 16.0) / 16.0, floor(uTime * sp * 8.0) / 16.0));
  }
  vec2 auv = vec2((tile + l.x) / uTiles, 1.0 - (variant + l.y) / ${ATLAS_VARIANTS.toFixed(1)});
  vec4 texel = texture2D(uAtlas, auv);
  diffuseColor.rgb *= texel.rgb;
  float px = floor(local.x * 16.0);
  float py = floor(local.y * 16.0);
  float spark = step(0.985, fract(sin(dot(vec2(px, py) + cell * 17.0 + floor(uTime * 2.0), vec2(12.9898, 78.233))) * 43758.5453));
  if (anim == 1.0) { gEmit = texel.rgb * 0.15 + vec3(0.6, 0.8, 1.0) * spark * 0.5; }
  if (anim == 2.0) { gEmit = texel.rgb * (0.85 + 0.15 * sin(uTime * 2.0 + cell.x * 0.7)) + vec3(1.0, 0.8, 0.3) * spark * 0.6; }
  if (anim == 3.0) { gEmit = texel.rgb * 0.35 + vec3(0.7, 1.0, 0.4) * spark * 0.4; }
  if (anim == 4.0) { gEmit = vec3(0.35, 0.15, 0.8) * spark + texel.rgb * 0.2; }
  if (anim == 5.0) { gEmit = texel.rgb * (0.5 + 0.5 * sin(uTime * 3.0)) * (0.6 + uSurge * 1.5); }
  if (anim == 6.0) { gEmit = vec3(0.8, 0.95, 1.0) * spark * 0.3; }
}`,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmit;');
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.disposables.push(geo, mat, cells, atlas);
  }

  private buildBlocks(t: Terrain, map: MapDef, tex: THREE.Texture, quality: string) {
    const n = t.size;
    const chunks = Math.ceil(n / CHUNK);
    const cube = unitCube();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const u = this.uniforms;
    // Blocks standing between the camera and the hero dissolve with an ordered dither so
    // tall trees and walls in the foreground never hide the action.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFocus = u.uFocus;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uFocus;')
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
vec2 dd = vWPos.xz - (uFocus.xz + vec2(0.0, 2.2));
dd.y *= 0.75;
float pd = length(dd);
if (vWPos.y > 1.2 && pd < 5.0 && vWPos.z > uFocus.z - 0.6) {
  float k = (1.0 - smoothstep(3.0, 5.0, pd)) * clamp((vWPos.y - 1.2) / 1.0, 0.0, 1.0) * 0.85;
  int ix = int(mod(gl_FragCoord.x, 4.0)); int iy = int(mod(gl_FragCoord.y, 4.0));
  float bayer = (ix == 0 ? (iy == 0 ? 0.0 : iy == 1 ? 12.0 : iy == 2 ? 3.0 : 15.0) : ix == 1 ? (iy == 0 ? 8.0 : iy == 1 ? 4.0 : iy == 2 ? 11.0 : 7.0) : ix == 2 ? (iy == 0 ? 2.0 : iy == 1 ? 14.0 : iy == 2 ? 1.0 : 13.0) : (iy == 0 ? 10.0 : iy == 1 ? 6.0 : iy == 2 ? 9.0 : 5.0)) / 16.0;
  if (bayer < k) discard;
}`,
        );
    };
    const glowMat = new THREE.MeshBasicMaterial({ map: tex });
    this.disposables.push(cube, mat, glowMat);
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
    const col = new THREE.Color();
    const pal = map.palette.blocks;
    const fill = (list: typeof t.blocks, material: THREE.Material, shadows: boolean) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(cube, material, list.length);
      list.forEach((b, i) => {
        const s = b.s ?? 1;
        m4.makeScale(s, s, s);
        m4.setPosition(b.x + 0.5, b.y + (b.s ? 0 : 0), b.z + 0.5);
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
    };
    const shadows = quality !== 'low';
    for (const list of buckets) fill(list, mat, shadows);
    fill(glowBlocks, glowMat, false);
  }

  private buildDecor(t: Terrain, quality: string) {
    let list = t.decor;
    if (quality === 'low') list = list.filter((_, i) => i % 3 === 0);
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
    const build = (arr: typeof list, material: THREE.Material) => {
      if (!arr.length) return;
      const g = cube.clone();
      const sway = new Float32Array(g.attributes.position.count).fill(0);
      g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
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
      // per-instance sway flag
      g.setAttribute('aSway', new THREE.InstancedBufferAttribute(swayInst, 1));
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.disposables.push(g, mesh);
    };
    build(normal, mat);
    build(glow, glowMat);
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
