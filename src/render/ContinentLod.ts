import * as THREE from 'three';
import type { ContinentData } from '../game/continent/data';
import { SEA, WORLD } from '../game/continent/data';
import type { MapDef } from '../data/types';
import { MAT_TILES } from '../game/continent/window';

/**
 * Far LOD of the continent: one coarse mesh of the whole 8000² map from the 2048² overview
 * (a vertex every ~15.6 blocks, coloured by sub-biome, water at its level) drawn under and
 * beyond the streamed window. Fragments inside the window are discarded (the detailed terrain is
 * there), so the rings meet without seams; distance haze instead of the near fog keeps the
 * northern mountains visible on the horizon.
 */
export class ContinentLod {
  readonly mesh: THREE.Mesh;
  private readonly uRect = { value: new THREE.Vector4(0, 0, 0, 0) };
  readonly uHaze = { value: new THREE.Color(0xa9cfd6) };

  constructor(d: ContinentData, map: MapDef, grid = 512) {
    const G = grid;
    const step = WORLD / (G - 1);
    const pos = new Float32Array(G * G * 3);
    const col = new Float32Array(G * G * 3);
    const c = new THREE.Color();
    const tiles = map.palette.tiles;
    const lakes = d.feat.lakes ?? [];
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const x = i * step;
        const z = j * step;
        const k = j * G + i;
        let y = d.heightAt(x, z);
        const m = d.mapAt(x, z);
        if (m.water) {
          let lev = SEA;
          for (const l of lakes) if ((x - l.at[0]) ** 2 + (z - l.at[1]) ** 2 < (l.r * 1.3) ** 2) lev = l.level;
          if (m.water === 1 || y < lev) y = Math.max(y, lev - 0.6);
          c.setHex(m.water === 1 ? 0x2f86b8 : m.water === 4 ? 0x4f6e50 : 0x3a9ccc);
        } else {
          const name = MAT_TILES[m.biome] ?? 'grass';
          c.setHex(tiles[name]?.[0] ?? 0x6aa842);
          // high peaks read as rock and snow from afar
          if (y > 300) c.lerp(new THREE.Color(0xf2f6fa), Math.min(1, (y - 300) / 80));
        }
        pos[k * 3] = x;
        pos[k * 3 + 1] = y - 1.2;
        pos[k * 3 + 2] = z;
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
    const idx = new Uint32Array((G - 1) * (G - 1) * 6);
    let n = 0;
    for (let j = 0; j < G - 1; j++)
      for (let i = 0; i < G - 1; i++) {
        const a = j * G + i;
        idx[n++] = a;
        idx[n++] = a + G;
        idx[n++] = a + 1;
        idx[n++] = a + 1;
        idx[n++] = a + G;
        idx[n++] = a + G + 1;
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRect = this.uRect;
      sh.uniforms.uHaze = this.uHaze;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLW = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLW;\nuniform vec4 uRect;\nuniform vec3 uHaze;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLW.x > uRect.x && vLW.z > uRect.y && vLW.x < uRect.z && vLW.z < uRect.w) discard;')
        .replace('#include <opaque_fragment>', 'float hz = 1.0 - exp(-length(vLW - cameraPosition) / 2600.0);\noutgoingLight = mix(outgoingLight, uHaze, clamp(hz, 0.0, 0.85));\n#include <opaque_fragment>');
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  /** The detailed window (world rect): the LOD is cut away inside it, a few cells in from its edge. */
  setWindow(ox: number, oz: number, size: number) {
    this.uRect.value.set(ox + 3, oz + 3, ox + size - 3, oz + size - 3);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
