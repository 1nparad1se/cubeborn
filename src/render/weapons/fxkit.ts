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

// ------------------------------------------------------------------ natural lightning
interface BoltPath {
  pts: THREE.Vector3[];
  /** Distance down the channel (0 = cloud, 1 = ground) of each point, for the stepped leader. */
  u: number[];
  /** Half-width scale of each point. */
  w: number[];
  /** 0 = main channel, 1 = branch, 2 = twig. */
  depth: number;
}
export interface StrikeOpts {
  /** Channel width in world units. */
  width?: number;
  /** Glow colour of the channel (the core is always white). */
  color?: number;
  /** Number of side branches. */
  branches?: number;
  /** Restrokes after the main one (0–3); -1 picks one or two at random. */
  restrokes?: number;
  /** Seconds the stepped leader takes to reach the ground. */
  leader?: number;
}
const MAX_PTS = 420;
const AFTERGLOW = new THREE.Color(0x8a6aff);
const tmpE = new THREE.Vector3();
const tmpF = new THREE.Vector3();

/** Midpoint displacement: a jagged path from a to b with kinks at every scale, like a real channel. */
function fractalPath(a: THREE.Vector3, b: THREE.Vector3, levels: number, rough: number): THREE.Vector3[] {
  let pts = [a.clone(), b.clone()];
  let amp = a.distanceTo(b) * rough;
  for (let l = 0; l < levels; l++) {
    const next: THREE.Vector3[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const m = p.clone().lerp(q, 0.4 + Math.random() * 0.2);
      tmpE.subVectors(q, p).normalize();
      tmpF.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      tmpF.addScaledVector(tmpE, -tmpF.dot(tmpE));
      if (tmpF.lengthSq() < 1e-6) tmpF.set(1, 0, 0);
      tmpF.normalize().multiplyScalar(amp * (Math.random() * 2 - 1));
      m.add(tmpF);
      next.push(m, q);
    }
    pts = next;
    amp *= 0.58;
  }
  return pts;
}

/**
 * A single lightning strike shaped and timed like the real thing: a fractal channel with forked,
 * tapering branches, drawn top to bottom by a stepped leader in a few hundredths of a second, then
 * the blinding return stroke, one or two flickering restrokes down the same channel, and a short
 * violet afterglow. The channel keeps its shape for the whole strike (only the restrokes shift it a
 * little). `strokes` counts strokes so owners can fire impact effects and lights on each one.
 */
export class Lightning {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pos = new Float32Array(MAX_PTS * 4 * 3);
  private col = new Float32Array(MAX_PTS * 4 * 3);
  private paths: BoltPath[] = [];
  private restrokeAt: number[] = [];
  private leaderT = 0.06;
  readonly from = new THREE.Vector3();
  readonly to = new THREE.Vector3();
  color = new THREE.Color(0xbfe4ff);
  width = 0.12;
  t = 0;
  dur = 0;
  /** Current brightness of the main channel (0 when idle); drives lights. */
  brightness = 0;
  /** Strokes that have landed so far (the return stroke and each restroke). */
  strokes = 0;
  /** Strokes the owner has already answered with impact effects. */
  handled = 0;
  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    // across-the-strip coordinate: the soft profile makes the glow fall off instead of ending in an edge
    const uv = new Float32Array(MAX_PTS * 4 * 2);
    for (let i = 0; i < MAX_PTS * 2; i++) uv.set([0, 0, 1, 0], i * 4);
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mat = additive();
    mat.map = strokeTexture();
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
  }

  get alive(): boolean {
    return this.t < this.dur;
  }

  strike(from: THREE.Vector3, to: THREE.Vector3, o: StrikeOpts = {}) {
    this.from.copy(from);
    this.to.copy(to);
    this.width = o.width ?? 0.12;
    this.color.setHex(o.color ?? 0xbfe4ff);
    this.leaderT = o.leader ?? 0.06;
    this.t = 0;
    this.strokes = 0;
    this.handled = 0;
    this.brightness = 0;
    const len = from.distanceTo(to);
    // main channel
    const lv = Math.max(4, Math.min(7, Math.round(Math.log2(len / 0.12))));
    const main = fractalPath(from, to, lv, 0.2);
    this.paths = [{ pts: main, u: main.map((_, i) => i / (main.length - 1)), w: main.map((_, i) => 0.8 + 0.2 * (i / (main.length - 1))), depth: 0 }];
    // branches fork downward and outward from the upper two thirds and taper to nothing
    const nb = o.branches ?? 5;
    for (let b = 0; b < nb; b++) {
      const i = Math.floor((0.08 + Math.random() * 0.62) * (main.length - 1));
      const p = main[i];
      const u0 = i / (main.length - 1);
      tmpE.subVectors(main[Math.min(main.length - 1, i + 2)], p).normalize();
      tmpF.set(Math.random() * 2 - 1, -Math.random() * 0.3, Math.random() * 2 - 1).normalize();
      const dir = tmpE.clone().multiplyScalar(0.6).add(tmpF).normalize();
      const bl = len * (0.12 + Math.random() * 0.26) * (1 - u0 * 0.6);
      const end = p.clone().addScaledVector(dir, bl);
      const br = fractalPath(p, end, Math.max(3, lv - 2), 0.24);
      const k = bl / len;
      this.paths.push({ pts: br, u: br.map((_, j) => u0 + (j / (br.length - 1)) * k * 1.4), w: br.map((_, j) => 0.55 * (1 - j / (br.length - 1)) + 0.05), depth: 1 });
      // a twig off some branches
      if (Math.random() < 0.55) {
        const j = Math.floor((0.3 + Math.random() * 0.4) * (br.length - 1));
        const q = br[j];
        tmpF.set(Math.random() * 2 - 1, -0.4 - Math.random() * 0.4, Math.random() * 2 - 1).normalize();
        const tend = q.clone().addScaledVector(tmpF, bl * (0.3 + Math.random() * 0.3));
        const tw = fractalPath(q, tend, 3, 0.25);
        const tu = u0 + (j / (br.length - 1)) * k * 1.4;
        this.paths.push({ pts: tw, u: tw.map((_, m) => tu + (m / (tw.length - 1)) * k * 0.6), w: tw.map((_, m) => 0.3 * (1 - m / (tw.length - 1)) + 0.03), depth: 2 });
      }
    }
    // restrokes reuse the channel a beat later
    const nr = o.restrokes === undefined || o.restrokes < 0 ? 1 + (Math.random() < 0.5 ? 1 : 0) : o.restrokes;
    this.restrokeAt = [];
    let at = this.leaderT;
    for (let r = 0; r < nr; r++) {
      at += 0.07 + Math.random() * 0.07;
      this.restrokeAt.push(at);
    }
    this.dur = at + 0.35;
    // index buffer: glow strips then core strips
    let n = 0;
    const idx: number[] = [];
    const starts: number[] = [];
    for (const p of this.paths) {
      if (n + p.pts.length > MAX_PTS) break;
      starts.push(n);
      n += p.pts.length;
    }
    this.paths.length = starts.length;
    for (let pass = 0; pass < 2; pass++) {
      const base = pass * n * 2;
      this.paths.forEach((p, k) => {
        for (let i = 0; i < p.pts.length - 1; i++) {
          const a = base + (starts[k] + i) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });
    }
    this.geo.setIndex(idx);
    this.mesh.visible = true;
  }

  /** Brightness envelope: dim leader, blinding return stroke, decaying restrokes, faint afterglow. */
  private envelope(t: number): { main: number; branch: number; reveal: number } {
    if (t < this.leaderT) {
      const steps = 9;
      const reveal = Math.ceil((t / this.leaderT) * steps) / steps;
      return { main: 0.35 + Math.random() * 0.2, branch: 0.45, reveal };
    }
    const s = t - this.leaderT;
    let main = 1.5 * Math.exp(-s * 14);
    let branch = 1.1 * Math.exp(-s * 18);
    for (const r of this.restrokeAt) {
      if (t < r) continue;
      const d = t - r;
      main += 0.95 * Math.exp(-d * 15);
      branch += 0.35 * Math.exp(-d * 20);
    }
    const tail = 1 - s / Math.max(0.01, this.dur - this.leaderT);
    main += 0.22 * tail * tail;
    main *= 0.85 + Math.random() * 0.3;
    return { main, branch, reveal: 1 };
  }

  update(dt: number, camera: THREE.Camera) {
    if (!this.alive) {
      this.mesh.visible = false;
      this.brightness = 0;
      return;
    }
    const prevT = this.t;
    this.t += dt;
    if (prevT < this.leaderT && this.t >= this.leaderT) this.strokes++;
    for (const r of this.restrokeAt)
      if (prevT < r && this.t >= r) {
        this.strokes++;
        // the channel shifts a little between strokes
        for (const p of this.paths) for (let i = 1; i < p.pts.length - 1; i++) p.pts[i].addScaledVector(tmpF.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), this.width * 0.8);
      }
    const env = this.envelope(this.t);
    this.brightness = env.reveal < 1 ? env.main * 0.3 : env.main;
    const s = Math.max(0, this.t - this.leaderT);
    // glow drifts from cold white-blue to violet as the channel cools
    const glowC = tmpCol.copy(this.color).lerp(AFTERGLOW, Math.min(1, s / 0.3));
    const stroke = Math.min(1, env.main);
    let v = 0;
    for (let pass = 0; pass < 2; pass++) {
      const glow = pass === 0;
      for (const p of this.paths) {
        const lvl = p.depth === 0 ? env.main : env.branch * (p.depth === 1 ? 1 : 0.7);
        for (let i = 0; i < p.pts.length; i++) {
          const pt = p.pts[i];
          const prev = p.pts[Math.max(0, i - 1)];
          const next = p.pts[Math.min(p.pts.length - 1, i + 1)];
          tmpA.subVectors(next, prev);
          tmpB.subVectors(camera.position, pt);
          tmpC.crossVectors(tmpA, tmpB);
          if (tmpC.lengthSq() < 1e-10) tmpC.set(1, 0, 0);
          tmpC.normalize();
          const shown = p.u[i] <= env.reveal ? 1 : 0;
          // the leader tip glows a little brighter than the path behind it
          const tip = env.reveal < 1 && env.reveal - p.u[i] < 0.12 ? 1.8 : 1;
          const w = this.width * p.w[i] * (glow ? 2.2 + stroke * 1.6 : 0.45 + stroke * 0.2) * shown;
          const k = lvl * shown * tip * (glow ? 0.6 : 1.6);
          const c = glow ? glowC : WHITE;
          const j = v * 6;
          this.pos[j] = pt.x + tmpC.x * w;
          this.pos[j + 1] = pt.y + tmpC.y * w;
          this.pos[j + 2] = pt.z + tmpC.z * w;
          this.pos[j + 3] = pt.x - tmpC.x * w;
          this.pos[j + 4] = pt.y - tmpC.y * w;
          this.pos[j + 5] = pt.z - tmpC.z * w;
          this.col[j] = this.col[j + 3] = c.r * k;
          this.col[j + 1] = this.col[j + 4] = c.g * k;
          this.col[j + 2] = this.col[j + 5] = c.b * k;
          v++;
        }
      }
    }
    this.geo.setDrawRange(0, Infinity);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.mesh.visible = true;
  }

  stop() {
    this.t = this.dur;
    this.mesh.visible = false;
    this.brightness = 0;
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
const tmpCol = new THREE.Color();

let strokeTex: THREE.Texture | null = null;
/** 1D soft profile across a lightning strip: bright centre, smooth falloff to the edges. */
function strokeTexture(): THREE.Texture {
  if (strokeTex) return strokeTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 2;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.5, 'rgba(255,255,255,1)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 2);
  strokeTex = new THREE.CanvasTexture(c);
  strokeTex.colorSpace = THREE.SRGBColorSpace;
  return strokeTex;
}

let waveTex: THREE.Texture | null = null;
/** Soft ring texture for shock waves and aura pulses. */
function waveTexture(): THREE.Texture {
  if (waveTex) return waveTex;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.05)');
  grd.addColorStop(0.86, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.93, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  waveTex = new THREE.CanvasTexture(c);
  waveTex.colorSpace = THREE.SRGBColorSpace;
  return waveTex;
}

/** A flat expanding ring on the ground (nova waves, aura pulses, explosions). */
export class WaveRing {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.MeshBasicMaterial;
  constructor(color: number) {
    this.mat = new THREE.MeshBasicMaterial({ map: waveTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }
  /** Radius in world units and opacity. */
  set(x: number, y: number, z: number, r: number, opacity: number) {
    this.mesh.position.set(x, y, z);
    this.mesh.scale.set(r, r, 1);
    this.mat.opacity = opacity;
    this.mesh.visible = opacity > 0.01 && r > 0.01;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
