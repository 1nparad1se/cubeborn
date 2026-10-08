import * as THREE from 'three';
import type { VoxBox, VoxelModel } from '../data/types';

const tmpColor = new THREE.Color();

/** Tag offsets used to build the two walking frames of instanced enemies. */
const FRAME_OFFSETS: Record<string, [number, number, number][]> = {
  legL: [[0, 0.6, 1.2], [0, 0, -1.2]],
  legR: [[0, 0, -1.2], [0, 0.6, 1.2]],
  armL: [[0, 0, -1], [0, 0, 1]],
  armR: [[0, 0, 1], [0, 0, -1]],
  wingL: [[0, 1.6, 0], [0, -1.4, 0]],
  wingR: [[0, 1.6, 0], [0, -1.4, 0]],
  tail: [[0.8, 0, 0], [-0.8, 0, 0]],
  jaw: [[0, 0, 0], [0, -0.8, 0]],
};

export interface BuildOptions {
  /** 0/1 walking frame (applies tag offsets), -1 none. */
  frame?: number;
  /** Only include boxes with this tag ('' = untagged + body). */
  tag?: string;
  /** Subtract this pivot (in voxel units) from positions. */
  pivot?: [number, number, number];
  /** Darken/brighten all colors. */
  tint?: number;
  /**
   * Rounds box edges (0 = sharp cubes, 1 = fully soft). Creatures default to rounded so
   * they read as sculpted figures rather than stacks of cubes.
   */
  round?: number;
}

/**
 * Merges voxel boxes into one BufferGeometry with per-vertex colors, per-face UVs scaled
 * to box size (constant pixel density) and an aGlow attribute for emissive parts.
 */
export function buildVoxelGeometry(m: VoxelModel, opts: BuildOptions = {}): THREE.BufferGeometry {
  const boxes = m.boxes.filter((b) => {
    if (opts.tag === undefined) return true;
    const t = b[7] ?? '';
    if (opts.tag === '') return t === '' || t === 'body';
    return t === opts.tag;
  });
  const s = m.scale;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const glow: number[] = [];
  const idx: number[] = [];
  const glowSet = new Set(m.glow ?? []);
  boxes.forEach((b, bi) => addBox(b, glowSet.has(m.boxes.indexOf(b)) || isGlowColor(b[6]), bi));

  function addBox(b: VoxBox, isGlow: boolean, _bi: number) {
    let [x, y, z, w, h, d, c] = b;
    const tag = b[7];
    if (opts.frame !== undefined && opts.frame >= 0 && tag && FRAME_OFFSETS[tag]) {
      const o = FRAME_OFFSETS[tag][opts.frame];
      x += o[0];
      y += o[1];
      z += o[2];
    }
    if (opts.pivot) {
      x -= opts.pivot[0];
      y -= opts.pivot[1];
      z -= opts.pivot[2];
    }
    tmpColor.setHex(c);
    if (opts.tint) tmpColor.multiplyScalar(opts.tint);
    const x0 = (x - w / 2) * s;
    const x1 = (x + w / 2) * s;
    const y0 = y * s;
    const y1 = (y + h) * s;
    const z0 = (z - d / 2) * s;
    const z1 = (z + d / 2) * s;
    const round = opts.round ?? 0.4;
    // edge radius in voxels: thin parts get nearly round, big slabs keep their volume
    const rv = round > 0 ? Math.min(Math.min(w, h, d) * 0.5 * round, 1.1) : 0;
    if (rv < 0.05) {
      // faces: +x -x +y -y +z -z ; uv scaled by face dims in voxels
      const faces: [number[], number[], number, number][] = [
        [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], d, h],
        [[x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], d, h],
        [[x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], [0, 1, 0], w, d],
        [[x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], w, d],
        [[x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], w, h],
        [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], w, h],
      ];
      for (const [v, n, fw, fh] of faces) {
        if (n[1] === -1 && y0 <= 0.001) continue; // skip bottoms on the ground
        const base = pos.length / 3;
        pos.push(...v);
        for (let k = 0; k < 4; k++) {
          nor.push(n[0], n[1], n[2]);
          col.push(tmpColor.r, tmpColor.g, tmpColor.b);
          glow.push(isGlow ? 1 : 0);
        }
        uv.push(0, 0, fw, 0, fw, fh, 0, fh);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      return;
    }
    // rounded box: every face is a grid whose points are pushed out from an inner box by
    // the radius, giving soft edges and smooth normals that blend across faces
    const r = rv * s;
    const ix0 = x0 + r;
    const ix1 = x1 - r;
    const iy0 = y0 + r;
    const iy1 = y1 - r;
    const iz0 = z0 + r;
    const iz1 = z1 - r;
    const N = rv > 0.8 ? 4 : 3;
    const cr = tmpColor.r;
    const cg = tmpColor.g;
    const cb = tmpColor.b;
    // origin, u axis, v axis of each face (outward normal = u x v)
    const F: [number[], number[], number[], number, number, number][] = [
      [[x1, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0], d, h, 0],
      [[x0, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0], d, h, 0],
      [[x0, y1, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], w, d, 1],
      [[x0, y0, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], w, d, -1],
      [[x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], w, h, 0],
      [[x1, y0, z0], [x0 - x1, 0, 0], [0, y1 - y0, 0], w, h, 0],
    ];
    for (const [o, ua, va, fw, fh, up] of F) {
      if (up === -1 && y0 <= 0.001) continue;
      const base = pos.length / 3;
      for (let j = 0; j <= N; j++)
        for (let i = 0; i <= N; i++) {
          const fu = i / N;
          const fv = j / N;
          const px = o[0] + ua[0] * fu + va[0] * fv;
          const py = o[1] + ua[1] * fu + va[1] * fv;
          const pz = o[2] + ua[2] * fu + va[2] * fv;
          const qx = Math.min(ix1, Math.max(ix0, px));
          const qy = Math.min(iy1, Math.max(iy0, py));
          const qz = Math.min(iz1, Math.max(iz0, pz));
          let nx = px - qx;
          let ny = py - qy;
          let nz = pz - qz;
          const l = Math.hypot(nx, ny, nz) || 1;
          nx /= l;
          ny /= l;
          nz /= l;
          pos.push(qx + nx * r, qy + ny * r, qz + nz * r);
          nor.push(nx, ny, nz);
          // soft sculpted shading: lighter tops, a touch darker undersides
          const k = 0.9 + ny * 0.12;
          col.push(cr * k, cg * k, cb * k);
          glow.push(isGlow ? 1 : 0);
          uv.push(fu * fw, fv * fh);
        }
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const a = base + j * (N + 1) + i;
          const b2 = a + 1;
          const c2 = a + N + 1;
          const d2 = c2 + 1;
          idx.push(a, b2, d2, a, d2, c2);
        }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Very bright saturated colors are treated as emissive (eyes, crystals, embers). */
function isGlowColor(c: number): boolean {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 235 && max - min > 100;
}

export const TAGS = ['legL', 'legR', 'armL', 'armR', 'head', 'wingL', 'wingR', 'tail', 'jaw', 'lid'] as const;

/** Pivot (voxel units) for an articulated part based on its bounding box. */
export function partPivot(m: VoxelModel, tag: string): [number, number, number] {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const b of m.boxes) {
    if (b[7] !== tag) continue;
    minX = Math.min(minX, b[0] - b[3] / 2);
    maxX = Math.max(maxX, b[0] + b[3] / 2);
    minY = Math.min(minY, b[1]);
    maxY = Math.max(maxY, b[1] + b[4]);
    minZ = Math.min(minZ, b[2] - b[5] / 2);
    maxZ = Math.max(maxZ, b[2] + b[5] / 2);
  }
  if (minX === Infinity) return [0, 0, 0];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  switch (tag) {
    case 'legL':
    case 'legR':
      return [cx, maxY, cz];
    case 'armL':
    case 'armR': {
      // shoulder: top of the largest arm box
      let top = minY;
      let best = 0;
      for (const b of m.boxes) if (b[7] === tag && b[3] * b[4] * b[5] > best) {
        best = b[3] * b[4] * b[5];
        top = b[1] + b[4];
      }
      return [cx, top, cz];
    }
    case 'wingL':
      return [maxX, cy, cz];
    case 'wingR':
      return [minX, cy, cz];
    case 'head':
      return [cx, minY, cz];
    case 'tail':
      return [cx, cy, maxZ];
    case 'jaw':
      return [cx, maxY, minZ];
    case 'lid':
      return [cx, minY, minZ];
    default:
      return [cx, cy, cz];
  }
}

export function hasTag(m: VoxelModel, tag: string): boolean {
  return m.boxes.some((b) => b[7] === tag);
}

/** Unit cube with per-face UVs (0..1) used for terrain blocks and particles. */
export function unitCube(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const glow = new Float32Array(g.attributes.position.count);
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  return g;
}
