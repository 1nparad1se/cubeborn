import * as THREE from 'three';

/**
 * Small render-side effect primitives shared by the weapon models in the game and in the weapon
 * viewer: soft additive halos, camera-facing ribbon trails, jagged lightning arcs and a rune
 * circle. All of them live in world space and are updated by their owner every frame.
 */

let radialTex: THREE.Texture | null = null;
/** Soft white radial gradient used by every halo sprite. */
export function haloTexture(): THREE.Texture {
  if (radialTex) return radialTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  radialTex = new THREE.CanvasTexture(c);
  radialTex.colorSpace = THREE.SRGBColorSpace;
  return radialTex;
}

/** Additive glow sprite. `base` keeps the authored size so animations can pulse around it. */
export class Halo {
  readonly sprite: THREE.Sprite;
  readonly mat: THREE.SpriteMaterial;
  base: number;
  /** `over`: drawn without a depth test, so a big flash is never cut off by the floor or a wall. */
  constructor(color: number, size: number, opacity = 1, over = false) {
    this.mat = new THREE.SpriteMaterial({ map: haloTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !over, transparent: true, opacity });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.setScalar(size);
    this.sprite.renderOrder = 8;
    this.base = size;
  }
  set(k: number, opacity?: number) {
    this.sprite.scale.setScalar(this.base * k);
    if (opacity !== undefined) this.mat.opacity = opacity;
  }
  dispose() {
    this.mat.dispose();
  }
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const col = new THREE.Color();

function additive(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
}

/**
 * Ribbon trail: a strip through the last positions of its anchor, widened toward the camera so it
 * reads from any angle. It tapers and fades toward the tail and empties itself when the anchor stops.
 */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  private pts: { p: THREE.Vector3; age: number }[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private colr: Float32Array;
  color = new THREE.Color();
  core = new THREE.Color(0xffffff);
  /** Seconds a point lives, max points, width at the head, brightness. */
  constructor(
    color: number,
    public life = 0.35,
    public width = 0.25,
    public intensity = 1,
    private max = 18,
  ) {
    this.color.setHex(color);
    this.pos = new Float32Array(max * 2 * 3);
    this.colr = new Float32Array(max * 2 * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colr, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, additive());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  reset() {
    this.pts.length = 0;
    this.geo.setDrawRange(0, 0);
  }

  /** Adds the anchor's position (sampled when it moved far enough) and redraws. */
  update(dt: number, head: THREE.Vector3, camera: THREE.Camera, emit = true) {
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].age > this.life) this.pts.pop();
    if (emit) {
      const last = this.pts[0];
      if (!last || last.p.distanceToSquared(head) > 0.0025) {
        this.pts.unshift({ p: head.clone(), age: 0 });
        if (this.pts.length > this.max) this.pts.length = this.max;
      } else last.p.copy(head);
    }
    const n = this.pts.length;
    if (n < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }
    const camPos = camera.position;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i].p;
      const nb = this.pts[Math.min(n - 1, i + 1)].p;
      const pb = this.pts[Math.max(0, i - 1)].p;
      tmpA.subVectors(pb, nb); // segment direction
      if (tmpA.lengthSq() < 1e-8) tmpA.set(1, 0, 0);
      tmpB.subVectors(camPos, p);
      tmpC.crossVectors(tmpA, tmpB).normalize();
      const u = i / (n - 1);
      const fade = (1 - u) * (1 - this.pts[i].age / this.life);
      const w = this.width * (1 - u * 0.85) * 0.5;
      this.pos.set([p.x + tmpC.x * w, p.y + tmpC.y * w, p.z + tmpC.z * w], i * 6);
      this.pos.set([p.x - tmpC.x * w, p.y - tmpC.y * w, p.z - tmpC.z * w], i * 6 + 3);
      // white-hot near the head, element colour toward the tail
      const k = Math.max(0, fade) * this.intensity;
      col.copy(this.color).lerp(this.core, Math.max(0, 0.6 - u * 1.4));
      this.colr.set([col.r * k, col.g * k, col.b * k, col.r * k, col.g * k, col.b * k], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Jagged lightning between two points, re-rolled a few times per second. Drawn as two
 * camera-facing strips: a coloured glow and a thin white core.
 */
export class ArcLine {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private colr: Float32Array;
  private offs: number[] = [];
  private rollT = 0;
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  color = new THREE.Color();
  /** 0 hides the arc. */
  intensity = 1;
  constructor(color: number, public width = 0.05, public jag = 0.18, private segs = 7, public rate = 18) {
    this.color.setHex(color);
    const verts = (segs + 1) * 2 * 2;
    this.pos = new Float32Array(verts * 3);
    this.colr = new Float32Array(verts * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colr, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let s = 0; s < 2; s++) {
      const o = s * (segs + 1) * 2;
      for (let i = 0; i < segs; i++) {
        const a = o + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, additive());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.roll();
  }

  private roll() {
    this.offs.length = 0;
    for (let i = 0; i <= this.segs; i++) this.offs.push(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  }

  update(dt: number, camera: THREE.Camera) {
    this.rollT -= dt;
    if (this.rollT <= 0) {
      this.rollT = 1 / this.rate;
      this.roll();
    }
    const vis = this.intensity > 0.01;
    this.mesh.visible = vis;
    if (!vis) return;
    const len = this.a.distanceTo(this.b);
    const jag = this.jag * Math.min(1, len * 1.5);
    for (let s = 0; s < 2; s++) {
      const w = (s === 0 ? this.width * 2.6 : this.width * 0.8) * 0.5;
      const k = (s === 0 ? 0.75 : 1.3) * this.intensity;
      const c = s === 0 ? this.color : WHITE;
      const o = s * (this.segs + 1) * 2;
      for (let i = 0; i <= this.segs; i++) {
        const u = i / this.segs;
        const env = Math.sin(u * Math.PI);
        tmpD.lerpVectors(this.a, this.b, u);
        tmpD.x += this.offs[i * 3] * jag * env;
        tmpD.y += this.offs[i * 3 + 1] * jag * env;
        tmpD.z += this.offs[i * 3 + 2] * jag * env;
        tmpA.subVectors(this.b, this.a);
        tmpB.subVectors(camera.position, tmpD);
        tmpC.crossVectors(tmpA, tmpB).normalize();
        const j = (o + i * 2) * 3;
        this.pos.set([tmpD.x + tmpC.x * w, tmpD.y + tmpC.y * w, tmpD.z + tmpC.z * w, tmpD.x - tmpC.x * w, tmpD.y - tmpC.y * w, tmpD.z - tmpC.z * w], j);
        this.colr.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], j);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
const WHITE = new THREE.Color(1, 1, 1);

let circleTex: THREE.Texture | null = null;
/** Rune circle texture: two rings, a star polygon and little glyphs, drawn once. */
export function runeCircleTexture(): THREE.Texture {
  if (circleTex) return circleTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 118, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 96, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 44, 0, Math.PI * 2);
  g.stroke();
  // seven-point star
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = ((i * 3) / 7) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * 94;
    const y = Math.sin(a) * 94;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // glyphs between the rings
  for (let i = 0; i < 14; i++) {
    g.save();
    g.rotate((i / 14) * Math.PI * 2);
    g.translate(0, -107);
    const k = i % 4;
    g.fillRect(-1.5, -6, 3, 12);
    if (k === 0) g.fillRect(-6, -2, 12, 3);
    else if (k === 1) {
      g.beginPath();
      g.arc(0, 0, 4, 0, Math.PI * 2);
      g.stroke();
    } else if (k === 2) g.fillRect(-5, 3, 10, 3);
    else g.fillRect(2, -6, 4, 4);
    g.restore();
  }
  circleTex = new THREE.CanvasTexture(c);
  circleTex.colorSpace = THREE.SRGBColorSpace;
  return circleTex;
}

/** Flat additive rune circle (magic circles under casts). */
export class RuneCircle {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.MeshBasicMaterial;
  constructor(color: number, size: number) {
    this.mat = new THREE.MeshBasicMaterial({ map: runeCircleTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 6;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
