import * as THREE from 'three';
import { GeoSink, addPart, type RigPart, type V3 } from '../rig/shapes';
import { Halo } from './fxkit';

/**
 * Weapon models: authored like hero rigs (chamfered boxes, cylinders, gems… in voxel units) but
 * split into named nodes that the weapon animator moves (lids, blades, jaws, pages, rings).
 * Custom geometry (lumpy rock, tori, fan wedges, a liquid bowl) goes through the same sink so
 * everything keeps the flat-shaded, hand-painted look of the game.
 */

export interface NodeDef {
  n: string;
  parent?: string;
  /** Pivot position in voxels (relative to the parent). */
  at?: V3;
  /** Initial rotation in degrees. */
  rot?: V3;
  /** Shown from this upgrade tier on (1 = always, 4 = evolution only)… */
  tier?: number;
  /** …and hidden from this tier on (an evolution replaces a part). */
  until?: number;
}

export interface HaloDef {
  name: string;
  node: string;
  at: V3;
  size: number;
  color: number;
  opacity?: number;
  tier?: number;
  /** Ignore depth (big flashes). */
  over?: boolean;
}

/** Raw triangles for a node, coloured per triangle by `paint` (centroid → colour, glow). */
export interface CustomGeo {
  node: string;
  tris: number[];
  paint: (cx: number, cy: number, cz: number, i: number) => [number, number];
  glass?: boolean;
  /** Tier group like 't2' or 'u4' (see parts). */
  tier?: string;
}

export interface ModelDef {
  /** World units per voxel. */
  vox: number;
  nodes: NodeDef[];
  /**
   * `b` is the node. `grp`: 'glass' uses the glass material; 't2' shows the part from tier 2 on,
   * 'u4' hides it from tier 4 on; 'glass:t3' combines both.
   */
  parts: RigPart[];
  custom?: CustomGeo[];
  halos?: HaloDef[];
  /** Rim light strength. */
  rim?: number;
  /** Glass tint opacity. */
  glassOpacity?: number;
}

const DEG = Math.PI / 180;
const tmpN = new THREE.Vector3();
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();
const c3 = new THREE.Color();

/** Appends raw triangles with flat normals and per-triangle paint. */
function addTris(sink: GeoSink, g: CustomGeo, scale: number) {
  const t = g.tris;
  for (let i = 0, f = 0; i < t.length; i += 9, f++) {
    e1.set(t[i + 3] - t[i], t[i + 4] - t[i + 1], t[i + 5] - t[i + 2]);
    e2.set(t[i + 6] - t[i], t[i + 7] - t[i + 1], t[i + 8] - t[i + 2]);
    tmpN.crossVectors(e1, e2).normalize();
    const [hex, glow] = g.paint((t[i] + t[i + 3] + t[i + 6]) / 3, (t[i + 1] + t[i + 4] + t[i + 7]) / 3, (t[i + 2] + t[i + 5] + t[i + 8]) / 3, f);
    c3.setHex(hex);
    const m = glow > 0 ? 1 : tmpN.y > 0.5 ? 1.06 : tmpN.y < -0.5 ? 0.8 : 0.93;
    for (let k = 0; k < 3; k++) {
      sink.pos.push(t[i + k * 3] * scale, t[i + k * 3 + 1] * scale, t[i + k * 3 + 2] * scale);
      sink.nor.push(tmpN.x, tmpN.y, tmpN.z);
      sink.uv.push(t[i + k * 3] * 0.5, t[i + k * 3 + 2] * 0.5);
      sink.col.push(Math.min(1, c3.r * m), Math.min(1, c3.g * m), Math.min(1, c3.b * m));
      sink.glow.push(glow);
    }
  }
}

/** Lambert with painted vertex colours, pulsing glow vertices and a rim light (per model instance). */
export function weaponMaterial(glow: { value: number }, rim: number, glass = false, opacity = 0.4): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: glass, opacity: glass ? opacity : 1, depthWrite: !glass, side: THREE.DoubleSide });
  const uRim = { value: rim };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.uniforms.uRim = uRim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uGlow;\nuniform float uRim;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * rimF * uRim;
gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb * (1.1 + uGlow * 0.5), vGlow);
${glass ? 'gl_FragColor.a = clamp(gl_FragColor.a + rimF * 0.35 + vGlow * 0.35, 0.0, 1.0);' : ''}`,
      );
  };
  mat.customProgramCacheKey = () => 'weapon-' + (glass ? 'g' : 's');
  return mat;
}

const geoCache = new WeakMap<ModelDef, Map<string, Map<string, THREE.BufferGeometry>>>();
/** Geometry of one node, split by material and tier group ('t2' shown from tier 2, 'u4' hidden from 4). */
function nodeGeos(def: ModelDef, node: string): Map<string, THREE.BufferGeometry> {
  let byNode = geoCache.get(def);
  if (!byNode) geoCache.set(def, (byNode = new Map()));
  let out = byNode.get(node);
  if (out) return out;
  const sinks = new Map<string, GeoSink>();
  const sinkFor = (key: string) => {
    let k = sinks.get(key);
    if (!k) sinks.set(key, (k = new GeoSink()));
    return k;
  };
  for (const p of def.parts) {
    if (p.b !== node) continue;
    const grp = p.grp ?? '';
    const glassPart = grp === 'glass' || grp.startsWith('glass:');
    const tierKey = grp.includes(':') ? grp.split(':')[1] : /^[tu]\d$/.test(grp) ? grp : '';
    addPart(sinkFor((glassPart ? 'g' : 's') + '|' + tierKey), p, def.vox);
  }
  for (const c of def.custom ?? []) if (c.node === node) addTris(sinkFor((c.glass ? 'g' : 's') + '|' + (c.tier ?? '')), c, def.vox);
  out = new Map();
  for (const [key, sink] of sinks) {
    if (sink.empty) continue;
    const geo = sink.build();
    // shared by every instance (game and viewer): owners must not dispose it
    geo.userData.shared = true;
    out.set(key, geo);
  }
  byNode.set(node, out);
  return out;
}

/** A built weapon model instance with animatable nodes and halos. */
export class WeaponModel {
  /** World placement (position + facing) set by the runtime. */
  readonly root = new THREE.Group();
  /** Spin/bob layer inside the root. */
  readonly body = new THREE.Group();
  readonly nodes: Record<string, THREE.Group> = {};
  readonly halos: Record<string, Halo> = {};
  /** Extra glow on glowing parts (pulses, charge). */
  readonly glow = { value: 0 };
  readonly vox: number;
  private mats: THREE.Material[] = [];
  private tiered: { obj: THREE.Object3D; tier: number; until: number }[] = [];
  /** Free per-instance animation state (springs, timers). */
  readonly s: Record<string, number> = {};
  tier = 1;

  constructor(def: ModelDef) {
    this.vox = def.vox;
    this.root.add(this.body);
    const solid = weaponMaterial(this.glow, def.rim ?? 0.3);
    const glass = weaponMaterial(this.glow, 0.9, true, def.glassOpacity ?? 0.38);
    this.mats.push(solid, glass);
    for (const n of def.nodes) {
      const g = new THREE.Group();
      g.name = n.n;
      if (n.at) g.position.set(n.at[0] * def.vox, n.at[1] * def.vox, n.at[2] * def.vox);
      if (n.rot) g.rotation.set(n.rot[0] * DEG, n.rot[1] * DEG, n.rot[2] * DEG);
      g.userData.rest = g.rotation.clone();
      g.userData.restPos = g.position.clone();
      this.nodes[n.n] = g;
      (n.parent ? this.nodes[n.parent] : this.body).add(g);
      if (n.tier || n.until) this.tiered.push({ obj: g, tier: n.tier ?? 1, until: n.until ?? 99 });
      // geometry is built once per model and node, then shared by every instance
      for (const [key, geo] of nodeGeos(def, n.n)) {
        const [kind, tierKey] = key.split('|');
        const m = new THREE.Mesh(geo, kind === 'g' ? glass : solid);
        if (kind === 'g') m.renderOrder = 5;
        else m.castShadow = true;
        g.add(m);
        if (tierKey) this.tiered.push({ obj: m, tier: tierKey[0] === 't' ? Number(tierKey[1]) : 1, until: tierKey[0] === 'u' ? Number(tierKey[1]) : 99 });
      }
    }
    for (const hd of def.halos ?? []) {
      const h = new Halo(hd.color, hd.size * def.vox, hd.opacity ?? 1, hd.over ?? hd.name === 'flash');
      h.sprite.position.set(hd.at[0] * def.vox, hd.at[1] * def.vox, hd.at[2] * def.vox);
      (this.nodes[hd.node] ?? this.body).add(h.sprite);
      this.halos[hd.name] = h;
      if (hd.tier) this.tiered.push({ obj: h.sprite, tier: hd.tier, until: 99 });
    }
  }

  setTier(t: number) {
    this.tier = t;
    for (const x of this.tiered) x.obj.visible = t >= x.tier && t < x.until;
  }

  /** Rotation of a node relative to its authored rest pose (degrees → radians done by caller). */
  pose(name: string, x: number, y: number, z: number) {
    const g = this.nodes[name];
    if (!g) return;
    const r = g.userData.rest as THREE.Euler;
    g.rotation.set(r.x + x, r.y + y, r.z + z);
  }

  offset(name: string, x: number, y: number, z: number) {
    const g = this.nodes[name];
    if (!g) return;
    const r = g.userData.restPos as THREE.Vector3;
    g.position.set(r.x + x * this.vox, r.y + y * this.vox, r.z + z * this.vox);
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    for (const h of Object.values(this.halos)) h.dispose();
    this.root.removeFromParent();
  }
}

// ------------------------------------------------------------------ custom geometry helpers

/** Deterministic 3D value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const h = (a: number, b: number, c: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 19.3) * 43758.5453;
    return s - Math.floor(s);
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = l(h(ix, iy, iz), h(ix + 1, iy, iz), u);
  const x10 = l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u);
  const x01 = l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u);
  const x11 = l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u);
  return l(l(x00, x10, v), l(x01, x11, v), w) * 2 - 1;
}

function geoTris(g: THREE.BufferGeometry, fn?: (v: THREE.Vector3) => void): number[] {
  const src = g.index ? g.toNonIndexed() : g;
  const a = src.attributes.position;
  const o: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i);
    fn?.(v);
    o.push(v.x, v.y, v.z);
  }
  g.dispose();
  if (src !== g) src.dispose();
  return o;
}

/** Irregular rock: an icosphere pushed in and out by noise (radius in voxels). */
export function lumpTris(r: number, rough: number, seed: number, detail = 2, at: V3 = [0, 0, 0]): number[] {
  return geoTris(new THREE.IcosahedronGeometry(1, detail), (v) => {
    const n = noise3(v.x * 1.8, v.y * 1.8, v.z * 1.8, seed);
    v.multiplyScalar(r * (1 + n * rough)).add(new THREE.Vector3(...at));
  });
}

/** Torus lying in the XZ plane (R ring radius, t tube radius, voxels). */
export function torusTris(R: number, t: number, seg = 16, tube = 5, at: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], arc = Math.PI * 2): number[] {
  const g = new THREE.TorusGeometry(R, t, tube, seg, arc);
  g.rotateX(Math.PI / 2);
  g.rotateX(rot[0] * DEG);
  g.rotateY(rot[1] * DEG);
  g.rotateZ(rot[2] * DEG);
  g.translate(...at);
  return geoTris(g);
}

/** Lower part of a sphere with a flat top (a liquid level). `level` is the cap height in radii (-1..1). */
export function bowlTris(r: number, level: number, seg = 12): number[] {
  const cut = Math.acos(Math.max(-0.99, Math.min(0.99, level)));
  const g = new THREE.SphereGeometry(r, seg, 7, 0, Math.PI * 2, cut, Math.PI - cut);
  const o = geoTris(g);
  // cap
  const y = r * Math.cos(cut);
  const cr = r * Math.sin(cut);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    o.push(0, y, 0, Math.sin(a1) * cr, y, Math.cos(a1) * cr, Math.sin(a0) * cr, y, Math.cos(a0) * cr);
  }
  return o;
}

/** Fan-shaped wedge (a thin membrane) in the XY plane from angle a0 to a1 (degrees, 0 = +Y). */
export function wedgeTris(r0: number, r1: number, a0: number, a1: number, thick: number, seg = 3): number[] {
  const o: number[] = [];
  const pt = (r: number, a: number, z: number): V3 => [Math.sin(a * DEG) * r, Math.cos(a * DEG) * r, z];
  const z0 = -thick / 2;
  const z1 = thick / 2;
  for (let i = 0; i < seg; i++) {
    const aa = a0 + ((a1 - a0) * i) / seg;
    const ab = a0 + ((a1 - a0) * (i + 1)) / seg;
    for (const z of [z1, z0]) {
      const A = pt(r0, aa, z);
      const B = pt(r1, aa, z);
      const C = pt(r1, ab, z);
      const D = pt(r0, ab, z);
      if (z > 0) o.push(...A, ...B, ...C, ...A, ...C, ...D);
      else o.push(...A, ...C, ...B, ...A, ...D, ...C);
    }
    // outer edge
    const B1 = pt(r1, aa, z1);
    const C1 = pt(r1, ab, z1);
    const B0 = pt(r1, aa, z0);
    const C0 = pt(r1, ab, z0);
    o.push(...B1, ...B0, ...C0, ...B1, ...C0, ...C1);
  }
  return o;
}

/** A twisted ribbon segment of a whirlwind ring: arc from a0 to a1 at radius r, rising by rise. */
export function swirlTris(r: number, a0: number, a1: number, h: number, rise: number, thick: number, seg = 4): number[] {
  const o: number[] = [];
  const P = (a: number, y: number, rr: number): V3 => [Math.cos(a * DEG) * rr, y, Math.sin(a * DEG) * rr];
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg;
    const t1 = (i + 1) / seg;
    const aa = a0 + (a1 - a0) * t0;
    const ab = a0 + (a1 - a0) * t1;
    const y0 = rise * t0;
    const y1 = rise * t1;
    // taper: thin at both ends
    const w0 = h * Math.sin(Math.PI * (0.15 + t0 * 0.7));
    const w1 = h * Math.sin(Math.PI * (0.15 + t1 * 0.7));
    const ro = r + thick / 2;
    const ri = r - thick / 2;
    const A = P(aa, y0 - w0 / 2, ro);
    const B = P(aa, y0 + w0 / 2, ro);
    const C = P(ab, y1 + w1 / 2, ro);
    const D = P(ab, y1 - w1 / 2, ro);
    const Ai = P(aa, y0 - w0 / 2, ri);
    const Bi = P(aa, y0 + w0 / 2, ri);
    const Ci = P(ab, y1 + w1 / 2, ri);
    const Di = P(ab, y1 - w1 / 2, ri);
    o.push(...A, ...C, ...B, ...A, ...D, ...C); // outer
    o.push(...Ai, ...Bi, ...Ci, ...Ai, ...Ci, ...Di); // inner
    o.push(...B, ...C, ...Ci, ...B, ...Ci, ...Bi); // top
    o.push(...A, ...Ai, ...Di, ...A, ...Di, ...D); // bottom
  }
  return o;
}
