import * as THREE from 'three';

/** World size of one body pixel: a 32-px-tall figure stands 1.8 blocks. */
export const PX = 1.8 / 32;

export type Face = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

/**
 * Colour of one texel of a box face. Face pixel (x, y) counts from the top-left corner of the
 * face as seen from outside; `w`, `h` are the face size in pixels. Return '' for a hole.
 */
export type Paint = (face: Face, x: number, y: number, w: number, h: number) => string;

/**
 * A canvas texture atlas packed with box skins (Minecraft-like box UV layout, our own painting).
 * Boxes are allocated on shelves; each gets six face rectangles.
 */
export class SkinAtlas {
  readonly canvas: HTMLCanvasElement | null;
  private g: CanvasRenderingContext2D | null;
  readonly texture: THREE.Texture | null;
  private cx = 0;
  private cy = 0;
  private rowH = 0;

  constructor(readonly size = 128) {
    const can = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.canvas = can;
    if (can) {
      can.width = can.height = size;
      this.g = can.getContext('2d');
      const t = new THREE.CanvasTexture(can);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      this.texture = t;
    } else {
      this.g = null;
      this.texture = null;
    }
  }

  private alloc(w: number, h: number): [number, number] {
    if (this.cx + w > this.size) {
      this.cx = 0;
      this.cy += this.rowH;
      this.rowH = 0;
    }
    const at: [number, number] = [this.cx, this.cy];
    this.cx += w;
    this.rowH = Math.max(this.rowH, h);
    if (this.cy + h > this.size) throw new Error('skin atlas full');
    return at;
  }

  /**
   * Box geometry `w × h × d` pixels (centred), inflated by `inflate` pixels on every side,
   * textured by `paint` (texture resolution stays w × h × d, like Minecraft armor layers).
   */
  box(w: number, h: number, d: number, paint: Paint, inflate = 0): THREE.BufferGeometry {
    const [u0, v0] = this.alloc(2 * d + 2 * w, d + h);
    const rects: Record<Face, [number, number, number, number]> = {
      top: [u0 + d, v0, w, d],
      bottom: [u0 + d + w, v0, w, d],
      right: [u0, v0 + d, d, h],
      front: [u0 + d, v0 + d, w, h],
      left: [u0 + d + w, v0 + d, d, h],
      back: [u0 + 2 * d + w, v0 + d, w, h],
    };
    const g = this.g;
    if (g)
      for (const f of Object.keys(rects) as Face[]) {
        const [rx, ry, rw, rh] = rects[f];
        for (let y = 0; y < rh; y++)
          for (let x = 0; x < rw; x++) {
            const c = paint(f, x, y, rw, rh);
            if (!c) continue;
            g.fillStyle = c;
            g.fillRect(rx + x, ry + y, 1, 1);
          }
      }
    if (this.texture) this.texture.needsUpdate = true;
    const geo = new THREE.BoxGeometry((w + 2 * inflate) * PX, (h + 2 * inflate) * PX, (d + 2 * inflate) * PX);
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z. The model faces +z, so +x is its left side.
    const order: Face[] = ['left', 'right', 'top', 'bottom', 'front', 'back'];
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const S = this.size;
    for (let f = 0; f < 6; f++) {
      const [rx, ry, rw, rh] = rects[order[f]];
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(i, (rx + u * rw) / S, 1 - (ry + (1 - v) * rh) / S);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  material(): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ map: this.texture, alphaTest: 0.5, side: THREE.FrontSide });
  }

  dispose() {
    this.texture?.dispose();
  }
}

/** Deterministic per-texel noise in 0..1 (pixel shading variety). */
export function texNoise(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Picks one of a few shades by noise (keeps flat areas lively but clean). */
export function shade(list: string[], x: number, y: number, s: number): string {
  const r = texNoise(x, y, s);
  return r < 0.7 ? list[0] : r < 0.88 ? list[1 % list.length] : list[2 % list.length];
}
