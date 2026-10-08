import * as THREE from 'three';

/**
 * Whirlwind shells for the Cyclone Fan's tornado and the Hurricane Eye. A funnel is a lathe
 * (narrow at the ground, flaring at the top) drawn with a shader: thin streaks of air wrap around
 * it on a twisted spiral and race upward, the silhouette is denser than the middle (like a real
 * funnel seen through dust), dust tints the base and the whole column snakes slowly. A disc variant
 * draws the spiral cloud bands of a hurricane around a calm eye. Sizes are in world units at scale 1.
 */

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    s += vnoise(p) * a;
    p = p * 2.03 + 7.1;
    a *= 0.5;
  }
  return s;
}
`;

const FUNNEL_VS = /* glsl */ `
uniform float uTime;
uniform float uSway;
uniform float uSeed;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec3 p = position;
  float h = uv.y;
  // the column snakes: higher parts swing further
  float k = pow(h, 1.4) * uSway;
  p.x += sin(uTime * 1.3 + h * 3.1 + uSeed) * k;
  p.z += cos(uTime * 1.1 + h * 2.6 + uSeed * 1.7) * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FUNNEL_FS = /* glsl */ `
uniform float uTime;
uniform float uSpin;
uniform float uTwist;
uniform float uOpacity;
uniform float uDensity;
uniform float uSeed;
uniform vec3 uAir;
uniform vec3 uDust;
uniform vec3 uGlow;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${NOISE}
void main() {
  float h = vUv.y;
  // around the funnel (0..1), twisted with height and turning
  float a = fract(vUv.x + h * uTwist - uTime * uSpin);
  // streaks: fast variation around, slow variation upward (they race upward a little);
  // blended across the wrap so the funnel has no seam
  float y1 = h * 2.2 - uTime * 0.9;
  float y2 = h * 5.0 - uTime * 1.6;
  float n1 = mix(fbm(vec2(a * 22.0 + uSeed, y1)), fbm(vec2((a - 1.0) * 22.0 + uSeed, y1)), a);
  float n2 = mix(fbm(vec2(a * 9.0 - uSeed, y2)), fbm(vec2((a - 1.0) * 9.0 - uSeed, y2)), a);
  n1 = clamp((n1 - 0.5) * 1.35 + 0.5, 0.0, 1.0);
  n2 = clamp((n2 - 0.5) * 1.35 + 0.5, 0.0, 1.0);
  // wrapped bands: the air circling the funnel (slow around, fast upward)
  float y3 = h * 16.0 - uTime * 2.2 + a * 3.0;
  float n3 = mix(fbm(vec2(a * 5.0 + uSeed, y3)), fbm(vec2((a - 1.0) * 5.0 + uSeed, y3)), a);
  n3 = clamp((n3 - 0.5) * 1.5 + 0.5, 0.0, 1.0);
  float streak = smoothstep(0.42 - uDensity * 0.12, 0.85, n1) * 0.5 + smoothstep(0.55, 0.85, n2) * 0.3 + smoothstep(0.4 - uDensity * 0.1, 0.8, n3) * 0.75;
  // silhouette is denser than the middle
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float edge = 0.35 + 0.65 * rim * rim;
  // fade at the very bottom and soft at the top
  float fade = smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(0.82, 1.0, h));
  float alpha = streak * edge * fade * uOpacity;
  vec3 col = mix(uDust, uAir, smoothstep(0.02, 0.4, h));
  col = mix(col, vec3(1.0), n1 * 0.35);
  col += uGlow * streak * 0.6;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

const DISC_FS = /* glsl */ `
uniform float uTime;
uniform float uSpin;
uniform float uOpacity;
uniform float uSeed;
uniform vec3 uAir;
uniform vec3 uDust;
uniform vec3 uGlow;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${NOISE}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float ang = atan(q.y, q.x) / 6.28318;
  // logarithmic spiral bands wound around the eye
  float s = ang * 2.0 + log(max(r, 0.02)) * 0.75 - uTime * uSpin;
  float bands = fbm(vec2(s * 5.0 + uSeed, r * 5.0 - uTime * 0.3));
  float wave = 0.5 + 0.5 * sin(s * 6.28318);
  float arms = smoothstep(0.3, 0.85, wave * 0.6 + bands * 0.7);
  float eye = smoothstep(0.13, 0.26, r);
  float outer = 1.0 - smoothstep(0.7, 1.0, r);
  float alpha = arms * eye * outer * uOpacity;
  vec3 col = mix(uAir, uDust, smoothstep(0.3, 1.0, r));
  col = mix(col, vec3(1.0), bands * 0.4);
  // the eye wall glows
  col += uGlow * (1.0 - smoothstep(0.18, 0.4, r)) * 0.9;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

const DISC_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export interface VortexOpts {
  /** Funnel height and radii at the ground and at the top (world units). */
  height?: number;
  r0?: number;
  r1?: number;
  /** Turns of twist from bottom to top, spin speed (turns/s), sway amplitude. */
  twist?: number;
  spin?: number;
  sway?: number;
  opacity?: number;
  density?: number;
  air?: number;
  dust?: number;
  glow?: number;
}

function funnelGeometry(height: number, r0: number, r1: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const h = i / n;
    // narrow neck at the ground, flaring trumpet at the top
    const r = r0 + (r1 - r0) * Math.pow(h, 1.7) + Math.sin(h * Math.PI) * r0 * 0.4;
    pts.push(new THREE.Vector2(r, h * height));
  }
  return new THREE.LatheGeometry(pts, 36);
}

/** One whirlwind shell or spiral cloud disc; the owner sets `opacity`, the time runs on `update`. */
export class Vortex {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  /** Multiplies the authored opacity (animations fade shells in and out with it). */
  fade = 1;
  private baseOpacity: number;
  constructor(kind: 'funnel' | 'disc', o: VortexOpts = {}) {
    const u = {
      uTime: { value: Math.random() * 50 },
      uSpin: { value: o.spin ?? 0.9 },
      uTwist: { value: o.twist ?? 0.6 },
      uSway: { value: o.sway ?? 0.12 },
      uOpacity: { value: o.opacity ?? 0.6 },
      uDensity: { value: o.density ?? 0.5 },
      uSeed: { value: Math.random() * 40 },
      uAir: { value: new THREE.Color(o.air ?? 0xe4f7ff) },
      uDust: { value: new THREE.Color(o.dust ?? 0xb8a888) },
      uGlow: { value: new THREE.Color(o.glow ?? 0x000000) },
    };
    this.baseOpacity = u.uOpacity.value;
    this.mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: kind === 'funnel' ? FUNNEL_VS : DISC_VS,
      fragmentShader: kind === 'funnel' ? FUNNEL_FS : DISC_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geo = kind === 'funnel' ? funnelGeometry(o.height ?? 2.3, o.r0 ?? 0.14, o.r1 ?? 1.2) : new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false;
  }

  update(dt: number) {
    this.mat.uniforms.uTime.value += dt;
    this.mat.uniforms.uOpacity.value = this.baseOpacity * this.fade;
    this.mesh.visible = this.fade > 0.01;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
