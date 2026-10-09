import * as THREE from 'three';

/**
 * Minecraft Dungeons style ambient particles that hang in the air around the camera: fireflies
 * at night and in forests, drifting pollen and leaves by day, embers over lava, snow in the
 * north, dust motes in crypts. All motion runs in the vertex shader (no per-frame CPU work):
 * each layer is one THREE.Points draw whose particles live in a box that wraps around the
 * camera target, so they never need respawning.
 */

type Motion = 'wander' | 'fall' | 'rise' | 'drift';

interface LayerDef {
  count: number;
  /** World-space size of a particle (a pixel square for leaves/snow, a soft dot for glows). */
  size: number;
  colors: [number, number];
  /** Additive glowing dot (fireflies, embers) or a solid little square (leaves, snow, ash). */
  glow: boolean;
  /** HDR brightness of glowing layers (above 1 feeds the bloom pass). */
  bright?: number;
  motion: Motion;
  /** Base velocity (world units / s). */
  vel: [number, number, number];
  /** Wobble amplitude and frequency. */
  sway: number;
  freq: number;
  /** Height band above the floor. */
  y: [number, number];
  /** Opacity by time of day: base + nightWeight * night (clamped 0..1). */
  alpha: number;
  night: number;
  /** Twinkle (0 none .. 1 full blink). */
  blink: number;
}

const FIREFLY: LayerDef = { count: 120, size: 0.13, colors: [0xd8ff6a, 0xffe27a], glow: true, bright: 3.2, motion: 'wander', vel: [0.05, 0, 0.03], sway: 0.9, freq: 0.35, y: [0.3, 3.2], alpha: 0, night: 1, blink: 1 };
const POLLEN: LayerDef = { count: 200, size: 0.07, colors: [0xfff4c8, 0xffffff], glow: true, bright: 1.1, motion: 'drift', vel: [0.35, 0.04, 0.12], sway: 0.6, freq: 0.25, y: [0.3, 4.5], alpha: 0.85, night: -0.75, blink: 0.25 };
const LEAVES: LayerDef = { count: 70, size: 0.16, colors: [0x7ec23a, 0xd9b23c], glow: false, motion: 'fall', vel: [0.55, -0.45, 0.2], sway: 0.8, freq: 0.6, y: [0, 7], alpha: 0.95, night: -0.4, blink: 0 };

const LAYERS: Record<string, LayerDef[]> = {
  // Blightwood: sunny woods with pollen and falling leaves by day, fireflies through dusk and night
  forest: [POLLEN, LEAVES, { ...FIREFLY, alpha: 0.12, night: 0.88 }],
  // Gloamhaven: an evening town, always lit by fireflies and drifting warm dust
  city: [{ ...FIREFLY, count: 150, alpha: 0.75, night: 0.25, colors: [0xffd37a, 0xd8ff6a] }, { ...POLLEN, count: 110, colors: [0xffd8a0, 0xffc890], bright: 0.9, alpha: 0.5, night: 0.1 }],
  // Ossuary: slow cold dust motes in the crypt air and a few ghostly wisps
  catacombs: [
    { count: 220, size: 0.06, colors: [0xcfe8ff, 0xb8fff0], glow: true, bright: 0.9, motion: 'drift', vel: [0.08, 0.05, 0.04], sway: 0.35, freq: 0.15, y: [0.2, 4], alpha: 0.75, night: 0.1, blink: 0.3 },
    { ...FIREFLY, count: 40, size: 0.16, colors: [0x9affd8, 0x7ad8ff], alpha: 0.55, night: 0.35, bright: 2.4 },
  ],
  // Emberwaste: embers rising off the ground and grey ash flakes coming down
  volcano: [
    { count: 170, size: 0.08, colors: [0xff8a2a, 0xffc040], glow: true, bright: 3.5, motion: 'rise', vel: [0.2, 0.9, 0.1], sway: 0.5, freq: 0.9, y: [0, 6], alpha: 0.9, night: 0.1, blink: 0.6 },
    { count: 110, size: 0.1, colors: [0x6a625e, 0x9a908a], glow: false, motion: 'fall', vel: [0.3, -0.35, 0.15], sway: 0.5, freq: 0.4, y: [0, 7], alpha: 0.75, night: 0, blink: 0 },
  ],
  // Frostveil: steady snowfall and a few glints
  tundra: [
    { count: 320, size: 0.09, colors: [0xffffff, 0xe0f0ff], glow: false, motion: 'fall', vel: [0.35, -0.9, 0.15], sway: 0.45, freq: 0.5, y: [0, 8], alpha: 0.95, night: 0, blink: 0 },
    { ...POLLEN, count: 70, colors: [0xcfeaff, 0xffffff], bright: 1.6, alpha: 0.45, night: 0.2, blink: 0.9 },
  ],
  // Aetherfall: floating arcane motes rising slowly
  ruins: [
    { count: 170, size: 0.08, colors: [0x8ad8ff, 0xd8b0ff], glow: true, bright: 2.2, motion: 'rise', vel: [0.06, 0.32, 0.04], sway: 0.6, freq: 0.3, y: [0.2, 6], alpha: 0.75, night: 0.25, blink: 0.6 },
    { ...FIREFLY, count: 50, colors: [0xd8b0ff, 0x8ad8ff], alpha: 0.1, night: 0.8 },
  ],
};

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform float uBox;
uniform vec3 uVel;
uniform float uSway;
uniform float uFreq;
uniform vec2 uY;
uniform float uSize;
uniform float uPx;
uniform float uAlpha;
uniform float uBlink;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uWander;
varying vec3 vCol;
varying float vA;
void main() {
  float t = uTime;
  float sp = 0.6 + 0.8 * aSeed.x;
  vec3 p = position + uVel * t * sp;
  float f = uFreq * (0.7 + 0.6 * aSeed.w);
  vec3 sw = vec3(sin(t * f * 6.2832 + aSeed.y * 6.2832), sin(t * f * 4.1 + aSeed.z * 6.2832) * (0.35 + uWander * 0.65), cos(t * f * 5.3 + aSeed.w * 6.2832));
  // fireflies loop around in little lazy figure-eights
  sw += uWander * vec3(sin(t * f * 2.7 + aSeed.z * 9.0), 0.0, sin(t * f * 3.3 + aSeed.x * 9.0)) * 1.4;
  p += sw * uSway;
  // wrap height and the horizontal box around the camera target
  float hy = uY.y - uY.x;
  float fy = fract((p.y - uY.x) / hy);
  p.y = uY.x + fy * hy;
  vec2 rel = mod(p.xz - uCenter.xz + 0.5 * uBox, uBox) - 0.5 * uBox;
  p.xz = uCenter.xz + rel;
  float edge = 1.0 - smoothstep(0.32 * uBox, 0.5 * uBox, length(rel));
  float band = smoothstep(0.0, 0.12, fy) * (1.0 - smoothstep(0.85, 1.0, fy));
  float tw = 0.5 + 0.5 * sin(t * (1.3 + aSeed.x * 2.2) + aSeed.y * 40.0);
  tw = mix(1.0, tw * tw * 1.6, uBlink);
  vA = uAlpha * edge * band * tw;
  vCol = mix(uColA, uColB, aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uSize * (0.65 + 0.7 * aSeed.w) * uPx / -mv.z);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FRAG_GLOW = /* glsl */ `
uniform float uBright;
varying vec3 vCol;
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.45, r);
  float halo = (1.0 - smoothstep(0.2, 1.0, r)) * 0.35;
  float a = (core + halo) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * uBright * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FRAG_SOLID = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  if (vA < 0.01) discard;
  // a crisp pixel square with a darker lower-right edge, like a Minecraft particle
  vec2 q = gl_PointCoord;
  float shade = (q.x > 0.7 || q.y > 0.7) ? 0.72 : 1.0;
  gl_FragColor = vec4(vCol * shade, vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

interface Layer {
  def: LayerDef;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
}

export class AmbientFx {
  private layers: Layer[] = [];
  private time = 0;
  private readonly box: number;

  /** quality: render detail; density: particle setting multiplier (0..1). */
  constructor(
    private scene: THREE.Scene,
    generator: string,
    quality: 'low' | 'medium' | 'high',
    density: number,
  ) {
    this.box = quality === 'low' ? 38 : 46;
    const qMul = (quality === 'low' ? 0.4 : quality === 'medium' ? 0.7 : 1) * density;
    const defs = LAYERS[generator] ?? LAYERS.forest;
    for (const def of defs) {
      const n = Math.max(8, Math.round(def.count * qMul * (this.box / 46) ** 2));
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = Math.random() * this.box;
        pos[i * 3 + 1] = def.y[0] + Math.random() * (def.y[1] - def.y[0]);
        pos[i * 3 + 2] = Math.random() * this.box;
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      // the box wraps in the shader, so the bounds cover everything the camera may see
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: def.glow ? FRAG_GLOW : FRAG_SOLID,
        uniforms: {
          uTime: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uBox: { value: this.box },
          uVel: { value: new THREE.Vector3(...def.vel) },
          uSway: { value: def.sway },
          uFreq: { value: def.freq },
          uY: { value: new THREE.Vector2(def.y[0], def.y[1]) },
          uSize: { value: def.size },
          uPx: { value: 600 },
          uAlpha: { value: 0 },
          uBlink: { value: def.blink },
          uColA: { value: new THREE.Color(def.colors[0]) },
          uColB: { value: new THREE.Color(def.colors[1]) },
          uWander: { value: def.motion === 'wander' ? 1 : 0 },
          uBright: { value: def.bright ?? 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: def.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = 6;
      scene.add(points);
      this.layers.push({ def, points, mat });
    }
  }

  /**
   * cx/cz: camera target; night: 0 day .. 1 night; pxPerUnit: drawing-buffer pixels per world
   * unit at view distance 1 (height / (2 tan(fov/2))); dim: weather darkness 0..1.
   */
  update(dt: number, cx: number, cz: number, night: number, pxPerUnit: number, dim = 0) {
    this.time += dt;
    // keep the float time small so the shader math stays precise in long runs
    const t = this.time % 3600;
    for (const l of this.layers) {
      const u = l.mat.uniforms;
      u.uTime.value = t;
      u.uCenter.value.set(cx, 0, cz);
      u.uPx.value = pxPerUnit;
      const d = l.def;
      let a = Math.max(0, Math.min(1, d.alpha + d.night * night));
      // storms wash out daylight motes but make glowing ones stand out
      if (!d.glow) a *= 1 - dim * 0.3;
      u.uAlpha.value = a;
      l.points.visible = a > 0.01;
    }
  }

  dispose() {
    for (const l of this.layers) {
      this.scene.remove(l.points);
      l.points.geometry.dispose();
      l.mat.dispose();
    }
    this.layers.length = 0;
  }
}
