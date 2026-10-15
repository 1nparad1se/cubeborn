import * as THREE from 'three';
import { DITHER } from '../../render/dither';
import { ATLAS_COLS, TEX_PX, buildWorldAtlas, texId } from '../textures/atlas';
import { PROPS } from '../props/index';
import { buildModel, instYaw } from '../props/place';
import { PX, type Anim, type Face, type Part, type PropEmitter, type PropInstance, type TexSpec } from '../props/types';

/**
 * Draws world props: every prop in a chunk is baked into ONE merged static mesh (bevelled
 * textured boxes sampling the shared world atlas, vertex-animated swing / flag / sway / flicker
 * parts, glowing parts), plus one or two instanced meshes of looping GPU particles (fire,
 * embers, sparks, smoke, mist, fireflies, motes, drips). No per-frame CPU work besides the
 * shared uniforms. Lights are not drawn here: placement registers them on Terrain.lights and the
 * main renderer feeds the nearest ones to the LightPool.
 */

export interface PropUniforms {
  uTime: { value: number };
  uNight: { value: number };
  uFocus: { value: THREE.Vector3 };
  uCamDir: { value: THREE.Vector2 };
}

export interface PropChunk {
  x: number;
  z: number;
  build: () => THREE.Mesh[];
}

const FACES: Face[] = ['px', 'nx', 'py' as Face, 'ny' as Face, 'pz', 'nz'];
const ANIM_KIND: Record<Anim['kind'], number> = { swing: 1, flag: 2, sway: 3, flicker: 4, bob: 5, spin: 6 };

function faceTex(tex: TexSpec, f: Face): string {
  if (typeof tex === 'string') return tex;
  const side = f === 'px' || f === 'nx' || f === 'pz' || f === 'nz';
  return tex[f] ?? (side ? tex.side : tex.end) ?? tex.side ?? tex.end ?? 'missing';
}

class Buf {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  tile: number[] = [];
  edge: number[] = [];
  glow: number[] = [];
  base: number[] = [];
  anim: number[] = [];
  pivot: number[] = [];
  axis: number[] = [];
  idx: number[] = [];
  get verts() {
    return this.pos.length / 3;
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const f = (a: number[], n: number) => new THREE.Float32BufferAttribute(a, n);
    g.setAttribute('position', f(this.pos, 3));
    g.setAttribute('normal', f(this.nor, 3));
    g.setAttribute('color', f(this.col, 3));
    g.setAttribute('aUv', f(this.uv, 2));
    g.setAttribute('aTile', f(this.tile, 1));
    g.setAttribute('aEdge', f(this.edge, 4));
    g.setAttribute('aGlow', f(this.glow, 3));
    g.setAttribute('aBase', f(this.base, 1));
    g.setAttribute('aAnim', f(this.anim, 4));
    g.setAttribute('aPivot', f(this.pivot, 3));
    g.setAttribute('aAxis', f(this.axis, 3));
    g.setIndex(this.verts > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _nm = new THREE.Matrix3();

/** Local px → world matrix of an instance. */
function instMatrix(inst: PropInstance, out: THREE.Matrix4): THREE.Matrix4 {
  const s = PX * (inst.scale ?? 1);
  out.makeRotationY(instYaw(inst));
  out.scale(_v.set(s, s, s));
  out.setPosition(inst.x, inst.y, inst.z);
  return out;
}

function partMatrix(p: Part, out: THREE.Matrix4): THREE.Matrix4 {
  out.identity();
  if (!p.rot) return out;
  const pv = p.rot.pivot ?? [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2];
  _e.set(p.rot.x ?? 0, p.rot.y ?? 0, p.rot.z ?? 0, 'YXZ');
  _r.makeRotationFromEuler(_e);
  out.makeTranslation(pv[0], pv[1], pv[2]).multiply(_r).multiply(_t.makeTranslation(-pv[0], -pv[1], -pv[2]));
  return out;
}

/** Appends one part (6 faces) to the buffer in world space. */
function addPart(b: Buf, p: Part, world: THREE.Matrix4, inst: PropInstance, phase: number) {
  _m.multiplyMatrices(world, partMatrix(p, _t.clone()));
  _nm.getNormalMatrix(_m);
  const x0 = p.x, y0 = p.y, z0 = p.z, x1 = p.x + p.w, y1 = p.y + p.h, z1 = p.z + p.d;
  _c.setHex(p.tint ?? 0xffffff);
  const glow = p.glow ?? 0;
  const bevel = p.bevel ?? 1;
  const ao = p.noAO ? -1000 : inst.y;
  const [ou, ov] = p.uv ?? [0, 0];
  // animation pivot/axis in world space
  let ak = 0, amp = 0, spd = 0, aph = 0;
  const pv = new THREE.Vector3();
  const ax = new THREE.Vector3(0, 0, 1);
  if (p.anim) {
    const a = p.anim;
    ak = ANIM_KIND[a.kind];
    amp = a.amp ?? (a.kind === 'swing' ? 0.1 : a.kind === 'flicker' ? 0.25 : a.kind === 'spin' ? 0.5 : 0.03);
    spd = a.speed ?? 2;
    aph = (a.phase ?? 0) + phase;
    const top = a.kind === 'swing' || a.kind === 'flag';
    const piv = a.pivot ?? [p.x + p.w / 2, top ? y1 : y0, p.z + p.d / 2];
    pv.set(piv[0], piv[1], piv[2]).applyMatrix4(world);
    const axl = a.axis ?? (a.kind === 'flag' ? [0, 0, 1] : [1, 0, 0]);
    ax.set(axl[0], axl[1], axl[2]).transformDirection(world);
  }
  for (const f of FACES) {
    // corners in local px: counter-clockwise seen from outside; uv: u right, v down from the face top
    let c: number[][];
    let fw: number;
    let fh: number;
    let nx = 0, ny = 0, nz = 0;
    let tex: string;
    switch (f as string) {
      case 'pz': c = [[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]]; fw = p.w; fh = p.h; nz = 1; tex = faceTex(p.tex, 'pz'); break;
      case 'nz': c = [[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]]; fw = p.w; fh = p.h; nz = -1; tex = faceTex(p.tex, 'nz'); break;
      case 'px': c = [[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]]; fw = p.d; fh = p.h; nx = 1; tex = faceTex(p.tex, 'px'); break;
      case 'nx': c = [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]]; fw = p.d; fh = p.h; nx = -1; tex = faceTex(p.tex, 'nx'); break;
      case 'py': c = [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]; fw = p.w; fh = p.d; ny = 1; tex = faceTex(p.tex, 'top'); break;
      default: c = [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]]; fw = p.w; fh = p.d; ny = -1; tex = faceTex(p.tex, 'bottom'); break;
    }
    const uvs = [[0, 0], [0, fh], [fw, fh], [fw, 0]];
    _n.set(nx, ny, nz).applyMatrix3(_nm).normalize();
    const tile = texId(tex);
    const s = b.verts;
    for (let k = 0; k < 4; k++) {
      _v.set(c[k][0], c[k][1], c[k][2]).applyMatrix4(_m);
      b.pos.push(_v.x, _v.y, _v.z);
      b.nor.push(_n.x, _n.y, _n.z);
      b.col.push(_c.r, _c.g, _c.b);
      b.uv.push(uvs[k][0] + ou, uvs[k][1] + ov);
      b.tile.push(tile);
      b.edge.push(uvs[k][0], uvs[k][1], fw, fh);
      b.glow.push(glow, p.flicker ?? 0, bevel);
      b.base.push(ao);
      b.anim.push(ak, amp, spd, aph);
      b.pivot.push(pv.x, pv.y, pv.z);
      b.axis.push(ax.x, ax.y, ax.z);
    }
    b.idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  }
}

/** Particle defaults per emitter kind: [kind id, colour, colour2, size px, additive]. */
const EMIT: Record<PropEmitter['kind'], [number, number, number, number, boolean]> = {
  fire: [0, 0xffe27a, 0xff3b00, 2.4, true],
  embers: [1, 0xffd166, 0xff6a00, 1.2, true],
  sparks: [2, 0xfff4b3, 0xff8a00, 1, true],
  smoke: [3, 0x5a5650, 0x8a8680, 6, false],
  mist: [4, 0xe8f4ff, 0xffffff, 12, false],
  fireflies: [5, 0xd8ff6a, 0xffe27a, 1.6, true],
  motes: [6, 0x9cc4ff, 0x3b82ff, 1.4, true],
  drips: [7, 0xa8d8ff, 0xe0f4ff, 1, true],
};

interface PBuf {
  origin: number[];
  p: number[];
  q: number[];
  c1: number[];
  c2: number[];
}

function addEmitter(add: PBuf, alpha: PBuf, e: PropEmitter, inst: PropInstance, world: THREE.Matrix4, seed: number) {
  const [kind, c1, c2, sz, additive] = EMIT[e.kind];
  const buf = additive ? add : alpha;
  const s = PX * (inst.scale ?? 1);
  _v.set(e.x, e.y, e.z).applyMatrix4(world);
  const ca = new THREE.Color(e.color ?? c1);
  const cb = new THREE.Color(e.color2 ?? c2);
  for (let i = 0; i < e.count; i++) {
    const r = (k: number) => {
      const x = Math.sin((seed + i * 12.9898 + k * 78.233) * 43758.5453);
      return x - Math.floor(x);
    };
    buf.origin.push(_v.x, _v.y, _v.z);
    buf.p.push(kind, (i + r(1) * 0.5) / e.count, (e.size ?? sz) * s, e.rate ?? 1);
    buf.q.push((e.spread ?? 4) * s, (e.height ?? 24) * s, r(2), 0);
    buf.c1.push(ca.r, ca.g, ca.b);
    buf.c2.push(cb.r, cb.g, cb.b);
  }
}

const PARTICLE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aOrigin;
attribute vec4 aP;
attribute vec4 aQ;
attribute vec3 aC1;
attribute vec3 aC2;
uniform float uTime;
uniform float uNight;
varying vec3 vCol;
varying float vA;
void main() {
  float kind = aP.x; float ph = aP.y; float sz = aP.z; float rate = aP.w;
  float spread = aQ.x; float hgt = aQ.y; float sd = aQ.z;
  vec3 p = aOrigin; float a = 1.0; float s = sz; vec3 c = aC1; float life = 0.0;
  float ang = sd * 6.2832;
  if (kind < 0.5) {
    life = fract(uTime * 1.5 * rate + ph);
    float r = spread * (0.25 + 0.75 * fract(sd * 7.31)) * (1.0 - life * 0.8);
    p += vec3(cos(ang + life) * r, life * hgt, sin(ang + life) * r);
    p.x += sin(uTime * 7.0 + sd * 20.0) * 0.02 * life;
    s = sz * (1.0 - life * 0.7);
    c = mix(aC1, aC2, smoothstep(0.1, 0.9, life));
    a = 1.0 - life * life;
  } else if (kind < 1.5) {
    life = fract(uTime * 0.4 * rate + ph);
    float aa = ang + life * 3.0;
    p += vec3(cos(aa) * spread * (0.3 + life), life * hgt, sin(aa) * spread * (0.3 + life));
    c = mix(aC1, aC2, life);
    a = (1.0 - life) * step(0.25, fract(uTime * 2.7 + sd * 9.0));
  } else if (kind < 2.5) {
    life = fract(uTime * 1.1 * rate + ph);
    vec2 d = vec2(cos(ang), sin(ang));
    p += vec3(d.x * spread * life * 2.0, hgt * (life * 1.8 - life * life), d.y * spread * life * 2.0);
    s = sz * (1.0 - life); a = 1.0 - life;
  } else if (kind < 3.5) {
    life = fract(uTime * 0.2 * rate + ph);
    p += vec3(sin(life * 3.0 + sd * 9.0) * spread * 0.6 + life * hgt * 0.25, life * hgt, cos(life * 2.0 + sd * 5.0) * spread * 0.6);
    s = sz * (0.5 + life * 1.6);
    c = mix(aC1, aC2, life);
    a = 0.45 * smoothstep(0.0, 0.15, life) * (1.0 - life);
  } else if (kind < 4.5) {
    life = fract(uTime * 0.07 * rate + ph);
    p += vec3(cos(ang) * spread * life, hgt * 0.3 * sin(life * 3.14), sin(ang) * spread * life);
    s = sz * (0.6 + life); a = 0.22 * sin(life * 3.14);
  } else if (kind < 5.5) {
    float t = uTime * 0.3 * rate + sd * 40.0;
    p += vec3(sin(t * 1.3 + sd * 5.0) * spread, (0.5 + 0.5 * sin(t * 0.9 + sd * 3.0)) * hgt, cos(t * 1.1 + sd * 7.0) * spread);
    float bl = 0.5 + 0.5 * sin(uTime * 2.3 + sd * 30.0);
    a = clamp(uNight * 1.3 - 0.1, 0.0, 1.0) * bl * bl;
    c = mix(aC1, aC2, bl);
  } else if (kind < 6.5) {
    life = fract(uTime * 0.22 * rate + ph);
    float aa = ang + life * 4.0;
    p += vec3(cos(aa) * spread * (1.0 - life * 0.5), life * hgt, sin(aa) * spread * (1.0 - life * 0.5));
    a = sin(life * 3.14); s = sz * (0.6 + 0.4 * a);
    c = mix(aC1, aC2, life);
  } else {
    life = fract(uTime * 0.8 * rate + ph);
    p += vec3((fract(sd * 3.1) - 0.5) * spread, -life * life * hgt, (fract(sd * 7.7) - 0.5) * spread);
    a = 1.0 - life;
  }
  vCol = c; vA = a;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  mvPosition.xy += position.xy * s * step(0.004, a);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const PARTICLE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uBright;
varying vec3 vCol;
varying float vA;
void main() {
  if (vA < 0.004) discard;
  gl_FragColor = vec4(vCol * uBright, vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function particleMaterial(u: PropUniforms, additive: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uBright: { value: additive ? 1.4 : 1 } }]),
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: true,
  });
  m.uniforms.uTime = u.uTime;
  m.uniforms.uNight = u.uNight;
  return m;
}

/** The merged-prop material: atlas sampling, bevel edges, ground AO, glow and vertex animation. */
export function makePropMaterial(u: PropUniforms, atlas: THREE.DataTexture, rows: number, dither = true): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.uniforms.uFocus = u.uFocus;
    sh.uniforms.uCamDir = u.uCamDir;
    sh.uniforms.uAtlas = { value: atlas };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
attribute vec2 aUv; attribute float aTile; attribute vec4 aEdge; attribute vec3 aGlow; attribute float aBase;
attribute vec4 aAnim; attribute vec3 aPivot; attribute vec3 aAxis;
varying vec2 vUv2; varying float vTile; varying vec4 vEdge; varying vec3 vGlow; varying float vBase; varying vec3 vWPos;
vec3 rotAxis(vec3 v, vec3 k, float a) { float c = cos(a); float s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vUv2 = aUv; vTile = aTile; vEdge = aEdge; vGlow = aGlow; vBase = aBase;
if (aAnim.x > 0.5) {
  float k = aAnim.x; float t = uTime * aAnim.z + aAnim.w;
  vec3 rel = transformed - aPivot;
  if (k < 1.5) {
    float a = aAnim.y * (sin(t) + 0.3 * sin(t * 2.3 + 1.0));
    transformed = aPivot + rotAxis(rel, normalize(aAxis), a);
  } else if (k < 2.5) {
    float down = max(0.0, -rel.y);
    transformed += aAxis * aAnim.y * sin(t - down * 2.5) * down * 4.0;
  } else if (k < 3.5) {
    float up = max(0.0, rel.y);
    transformed.x += aAnim.y * sin(t) * up * 4.0; transformed.z += aAnim.y * cos(t * 0.8) * up * 4.0;
  } else if (k < 4.5) {
    float n = sin(t) * 0.5 + sin(t * 2.3 + 1.0) * 0.3 + sin(t * 5.1 + 2.0) * 0.2;
    transformed.y = aPivot.y + rel.y * (1.0 + aAnim.y * n);
    transformed.xz = aPivot.xz + rel.xz * (1.0 - aAnim.y * 0.4 * n);
  } else if (k < 5.5) {
    transformed.y += aAnim.y * sin(t);
  } else {
    transformed = aPivot + rotAxis(rel, vec3(0.0, 1.0, 0.0), uTime * aAnim.y + aAnim.w);
  }
}
vWPos = transformed;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uAtlas; uniform float uTime; uniform vec3 uFocus; uniform vec2 uCamDir;
varying vec2 vUv2; varying float vTile; varying vec4 vEdge; varying vec3 vGlow; varying float vBase; varying vec3 vWPos;
vec3 gGlow = vec3(0.0);`,
      )
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + (dither ? DITHER : ''))
      .replace(
        '#include <map_fragment>',
        `{
  vec2 px = clamp(mod(floor(vUv2), ${TEX_PX}.0), 0.0, ${TEX_PX - 1}.0) + 0.5;
  vec2 cell = vec2(mod(vTile, ${ATLAS_COLS}.0), floor(vTile / ${ATLAS_COLS}.0));
  vec4 tx = texture2D(uAtlas, (cell * ${TEX_PX}.0 + px) / vec2(${ATLAS_COLS * TEX_PX}.0, ${rows * TEX_PX}.0));
  if (tx.a < 0.5) discard;
  diffuseColor.rgb *= tx.rgb;
  // MCD bevel: a soft darker pixel rim round every face, lighter on the upper edge
  float bev = vGlow.z;
  if (bev > 0.0) {
    float du = min(vEdge.x, vEdge.z - vEdge.x);
    float dv = min(vEdge.y, vEdge.w - vEdge.y);
    float d = min(du, dv);
    if (d < bev) diffuseColor.rgb *= (vEdge.y < bev && dv == vEdge.y && du >= bev) ? 1.12 : 0.8;
  }
  // contact darkening near the ground the prop stands on
  diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 0.7, vWPos.y - vBase));
  if (vGlow.x > 0.0) {
    float f = vGlow.y;
    float fl = 1.0 - f * (0.25 - 0.15 * sin(uTime * 11.0 + vWPos.x * 7.0) - 0.1 * sin(uTime * 23.0 + vWPos.z * 5.0));
    gGlow = tx.rgb * vGlow.x * fl;
  }
}`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gGlow * vColor.rgb;');
  };
  mat.customProgramCacheKey = () => 'world-props-' + (dither ? 'd' : 'n');
  return mat;
}

/** Shared GPU resources for the props of one world (atlas texture, materials). */
export class PropKit {
  readonly atlas: THREE.DataTexture;
  readonly mat: THREE.MeshLambertMaterial;
  readonly fxAdd: THREE.ShaderMaterial;
  readonly fxAlpha: THREE.ShaderMaterial;
  readonly quad = new THREE.PlaneGeometry(1, 1);

  constructor(readonly u: PropUniforms, dither = true) {
    const a = buildWorldAtlas();
    this.atlas = new THREE.DataTexture(a.data, a.width, a.height, THREE.RGBAFormat);
    this.atlas.magFilter = this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.needsUpdate = true;
    this.mat = makePropMaterial(u, this.atlas, a.rows, dither);
    this.fxAdd = particleMaterial(u, true);
    this.fxAlpha = particleMaterial(u, false);
  }

  /** Builds the meshes of a list of instances (one merged mesh + particle meshes). */
  build(list: PropInstance[], shadows: boolean): THREE.Mesh[] {
    const b = new Buf();
    const pa: PBuf = { origin: [], p: [], q: [], c1: [], c2: [] };
    const pb: PBuf = { origin: [], p: [], q: [], c1: [], c2: [] };
    const world = new THREE.Matrix4();
    for (const inst of list) {
      const def = PROPS[inst.id];
      if (!def) continue;
      const model = buildModel(def, inst);
      instMatrix(inst, world);
      const phase = (inst.seed % 1000) * 0.0063;
      for (const p of model.parts) addPart(b, p, world, inst, phase);
      (model.emitters ?? []).forEach((e, k) => addEmitter(pa, pb, e, inst, world, (inst.seed % 9973) + k * 101));
    }
    const out: THREE.Mesh[] = [];
    if (b.verts) {
      const mesh = new THREE.Mesh(b.geometry(), this.mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    for (const [pbuf, mat] of [[pa, this.fxAdd], [pb, this.fxAlpha]] as const) {
      const n = pbuf.p.length / 4;
      if (!n) continue;
      const g = new THREE.InstancedBufferGeometry();
      g.index = this.quad.index!.clone();
      g.setAttribute('position', this.quad.getAttribute('position').clone());
      g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(pbuf.origin), 3));
      g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(pbuf.p), 4));
      g.setAttribute('aQ', new THREE.InstancedBufferAttribute(new Float32Array(pbuf.q), 4));
      g.setAttribute('aC1', new THREE.InstancedBufferAttribute(new Float32Array(pbuf.c1), 3));
      g.setAttribute('aC2', new THREE.InstancedBufferAttribute(new Float32Array(pbuf.c2), 3));
      g.instanceCount = n;
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = mat === this.fxAdd ? 7 : 5;
      out.push(mesh);
    }
    return out;
  }

  /** Splits the props into square chunks of `size` cells, each built on demand. */
  chunks(props: PropInstance[], shadows: boolean, size = 16): PropChunk[] {
    const map = new Map<number, PropInstance[]>();
    for (const p of props) {
      const k = Math.floor(p.z / size) * 4096 + Math.floor(p.x / size);
      let l = map.get(k);
      if (!l) map.set(k, (l = []));
      l.push(p);
    }
    const out: PropChunk[] = [];
    for (const [k, list] of map) {
      const cx = k % 4096;
      const cz = Math.floor(k / 4096);
      out.push({ x: (cx + 0.5) * size, z: (cz + 0.5) * size, build: () => this.build(list, shadows) });
    }
    return out;
  }

  dispose() {
    this.atlas.dispose();
    this.mat.dispose();
    this.fxAdd.dispose();
    this.fxAlpha.dispose();
    this.quad.dispose();
  }
}
