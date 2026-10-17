import * as THREE from 'three';
import type { World } from '../rpg/World';
import type { MapDef } from '../data/types';
import type { FxSink, ParticleKind } from '../game/types';
import type { Terrain } from '../game/Terrain';
import { CameraRig } from './CameraRig';
import { WorldRenderer } from './WorldRenderer';
import { GROUND } from './ground';
import { RpgEntities } from './RpgEntities';
import { HumanModel } from './human/HumanModel';
import { Particles } from './Particles';
import { Overlay } from './Overlay';
import { LightPool } from './LightPool';
import { makeBlobTexture, makeBlockTexture } from './Textures';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { AmbientFx } from './AmbientFx';

import type { Settings } from '../meta/Save';

export type Quality = 'low' | 'medium' | 'high';


export interface FxHooks {
  sound(id: string, volume?: number): void;
  vibrate(ms: number): void;
}

/** Replaces NaN / infinite pixels so bloom cannot smear one bad pixel into a black square. */
const ScrubShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  bool bad = !(c.r == c.r && c.g == c.g && c.b == c.b) || max(max(c.r, c.g), c.b) > 6e4;
  gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(64.0)), c.a);
}`,
};

/**
 * Minecraft Dungeons style finish, applied in linear HDR before tone mapping: tilt-shift blur
 * toward the top and bottom of the screen, a soft haze over the far (top) part of the view,
 * a split-tone grade (teal shadows, warm highlights, rich saturation) and a light vignette.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSat: { value: 1.06 },
    uWarm: { value: 0.04 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBlur: { value: 0 },
    uHaze: { value: new THREE.Color(0x8fb39a) },
    uHazeK: { value: 0.1 },
    uShadow: { value: new THREE.Vector3(0.9, 1.0, 1.12) },
    uHigh: { value: new THREE.Vector3(1.06, 1.0, 0.92) },
    uVig: { value: 0.22 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uWarm; uniform vec2 uRes; uniform float uBlur;
uniform vec3 uHaze; uniform float uHazeK; uniform vec3 uShadow; uniform vec3 uHigh; uniform float uVig; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  // tilt-shift: sharp band around the hero, growing blur toward the top (far) and bottom edges
  float dy = vUv.y - 0.47;
  float b = uBlur * smoothstep(0.1, 0.5, abs(dy) * (dy > 0.0 ? 1.0 : 0.85));
  if (b > 0.35) {
    vec3 acc = c.rgb;
    float wsum = 1.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 12.0) * b;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * r / uRes;
      acc += texture2D(tDiffuse, vUv + o).rgb;
      wsum += 1.0;
    }
    c.rgb = acc / wsum;
  }
  // distance haze toward the top of the screen
  c.rgb = mix(c.rgb, uHaze, uHazeK * smoothstep(0.55, 1.0, vUv.y));
  // split tone + saturation + temperature
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb *= mix(uShadow, uHigh, smoothstep(0.02, 0.7, l));
  l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = max(vec3(0.0), mix(vec3(l), c.rgb, uSat));
  c.rgb *= vec3(1.0 + uWarm, 1.0, 1.0 - uWarm);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.8);
  c.rgb *= 1.0 - uVig * smoothstep(0.08, 0.5, dot(q, q) * 1.6);
  gl_FragColor = c;
}`,
};

/**
 * Cheap screen-space ambient occlusion from the depth buffer alone: for pairs of opposite taps
 * it checks whether the surface around a pixel bends toward the camera (a crease, like the foot
 * of a wall or a cliff) using inverse depth, which is linear across flat surfaces, so open
 * ground gets no darkening at all. Creases are tinted toward a cool teal like MCD shadows.
 */
const AOShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uNear: { value: 1 },
    uFar: { value: 200 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uProj: { value: 600 },
    uRadius: { value: 1.2 },
    uStrength: { value: 0.8 },
    uTint: { value: new THREE.Vector3(0.2, 0.27, 0.36) },
    uSteps: { value: 2 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform vec2 uRes;
uniform float uProj; uniform float uRadius; uniform float uStrength; uniform vec3 uTint; uniform int uSteps; varying vec2 vUv;
float invZ(vec2 uv) { return -1.0 / perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = c; return; }
  float z0 = -perspectiveDepthToViewZ(d, uNear, uFar);
  float iz0 = 1.0 / z0;
  float rpx = clamp(uRadius * uProj / z0, 3.0, 80.0);
  float occ = 0.0;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 0.5236 + 0.26;
    vec2 dir = vec2(cos(a), sin(a)) * rpx / uRes;
    for (int s = 1; s <= 2; s++) {
      if (s > uSteps) break;
      float k = float(s) / float(uSteps);
      float za = invZ(vUv + dir * k);
      float zb = invZ(vUv - dir * k);
      // positive when both neighbours are nearer than the plane through them: a concave crease
      float crease = (0.5 * (za + zb) - iz0) * z0 * z0;
      float dz = max(abs(1.0 / za - z0), abs(1.0 / zb - z0));
      float range = 1.0 - smoothstep(uRadius * 0.9, uRadius * 1.8, dz);
      occ += clamp(crease / (uRadius * 0.35 * k), 0.0, 1.0) * range;
      n += 1.0;
    }
  }
  occ = clamp(occ / n * 3.0, 0.0, 1.0) * uStrength;
  c.rgb *= mix(vec3(1.0), uTint, occ);
  gl_FragColor = c;
}`,
};

/** Runs AOShader on the scene colour and the depth texture of the buffer the scene was drawn into. */
class AOPass extends Pass {
  readonly material = new THREE.ShaderMaterial(AOShader);
  private quad = new FullScreenQuad(this.material);
  constructor(private camera: THREE.PerspectiveCamera) {
    super();
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    u.uRes.value.set(readBuffer.width, readBuffer.height);
    u.uProj.value = readBuffer.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** MCD-style lighting bias applied on top of every map palette. */
export const MCD = {
  /** Cool teal sky fill and deep teal bounce from the ground. */
  sky: 0xa8d8e8,
  skyMix: 0.3,
  ground: 0x284c5a,
  groundMix: 0.45,
  /** Warm, slightly golden sun. */
  sun: 0xffe0b0,
  sunMix: 0.35,
  sunMul: 1.12,
  ambMul: 0.88,
};

/** Owns the WebGL context and draws either the in-run world or the menu diorama. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly overlay: Overlay;
  readonly rig: CameraRig;
  private scene = new THREE.Scene();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private blockTex = makeBlockTexture();
  private blobTex = makeBlobTexture();
  private world: WorldRenderer | null = null;
  private entities: RpgEntities | null = null;
  private particles: Particles | null = null;
  private lights: LightPool;
  private run: World | null = null;
  private quality: Quality = 'medium';
  private s: Settings;
  /** MSAA is fixed when the WebGL context is created. */
  readonly msaa: boolean;
  private viewMul = 1;
  private cullT = 0;
  private zoomLevel = 1;
  private time = 0;
  private torchTerrain: Terrain | null = null;
  // menu diorama
  /** Menu backdrop: a hero standing at the spawn point. */
  private showHero: HumanModel | null = null;
  private menuMode = false;
  private menuX = 0;
  private menuZ = 0;
  private menuAngle = 0;
  /** 0 keeps the menu showcase centred; 1 slides it into the right third of the screen. */
  menuShift = 0;
  /** Fixed camera (eye and look-at point) overriding the follow camera; used for screenshots and previews. */
  photo: { x: number; y: number; z: number; lx: number; ly: number; lz: number; noFog?: boolean } | null = null;
  private menuShiftNow = 0;
  private w = 1;
  private h = 1;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private ao: AOPass | null = null;
  private ambient: AmbientFx | null = null;
  private cA = new THREE.Color();
  private cB = new THREE.Color();

  constructor(private container: HTMLElement, settings: Settings) {
    this.s = settings;
    this.quality = settings.effects;
    this.msaa = settings.antiAliasing !== 'off';
    this.gl = new THREE.WebGLRenderer({ antialias: this.msaa, powerPreference: 'high-performance', alpha: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.domElement.className = 'game-canvas';
    container.appendChild(this.gl.domElement);
    this.overlay = new Overlay(container);
    this.rig = new CameraRig(1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.shadow.camera.left = -20;
    this.sun.shadow.camera.right = 20;
    this.sun.shadow.camera.top = 20;
    this.sun.shadow.camera.bottom = -20;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.lights = new LightPool(this.scene, this.lightCount());
    this.applySettings(settings);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private lightCount(): number {
    return this.quality === 'low' ? 2 : this.quality === 'medium' ? 5 : 8;
  }

  /** Particle budget multiplier from the particle quality setting. */
  private get particleMul(): number {
    return this.s.particles === 'low' ? 0.4 : this.s.particles === 'medium' ? 0.75 : 1;
  }

  /** Applies video settings; most take effect immediately (MSAA needs a restart). */
  applySettings(st: Settings) {
    this.s = st;
    const q = st.effects;
    const changed = q !== this.quality;
    this.quality = q;
    // shadows
    const sh = st.shadows;
    this.gl.shadowMap.enabled = sh !== 'off';
    this.sun.castShadow = sh !== 'off';
    this.gl.shadowMap.type = sh === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    const size = sh === 'high' ? 4096 : sh === 'medium' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // textures: filtering and mipmaps on the shared voxel textures
    for (const tex of [this.blockTex, this.blobTex]) {
      const mip = st.textures !== 'low';
      tex.generateMipmaps = mip;
      tex.minFilter = mip ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
      tex.anisotropy = st.textures === 'high' ? Math.min(16, this.gl.capabilities.getMaxAnisotropy()) : st.textures === 'medium' ? 4 : 1;
      tex.needsUpdate = true;
    }
    // post processing: filmic tone mapping (the CSS vignette is toggled by the app)
    this.gl.toneMapping = st.postProcessing ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.gl.toneMappingExposure = st.postProcessing ? 1.2 : 1;
    if (st.postProcessing && !this.composer) this.makeComposer();
    else if (!st.postProcessing && this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloom = null;
      this.grade = null;
      this.ao = null;
    }
    if (this.bloom) this.bloom.strength = st.effects === 'low' ? 0.3 : 0.5;
    if (this.ao) this.ao.enabled = st.effects !== 'low';
    if (this.ao) this.ao.material.uniforms.uSteps.value = st.effects === 'high' ? 2 : 1;
    this.viewMul = { near: 0.8, medium: 1, far: 1.3, max: 1.7 }[st.viewDistance] ?? 1;
    this.applyFar();
    this.rig.camera.updateProjectionMatrix();
    this.rig.shake = st.screenShake;
    this.overlay.showNumbers = st.damageNumbers;
    if (changed) {
      // light count is baked into shaders: rebuild the pool
      for (const l of this.lights.lights) this.scene.remove(l);
      this.lights = new LightPool(this.scene, this.lightCount());
    }
    if (this.scene.fog && this.run) this.setAtmosphere(this.run.map);
    this.resize();
  }

  /** Scene -> contact AO -> bloom -> tilt-shift, haze and colour grade -> tone mapping and sRGB output. */
  private makeComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.msaa ? 4 : 0 });
    // the scene depth feeds the AO pass (each composer buffer gets its own copy)
    rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    const c = new EffectComposer(this.gl, rt);
    c.addPass(new RenderPass(this.scene, this.rig.camera));
    this.ao = new AOPass(this.rig.camera);
    this.ao.enabled = this.s.effects !== 'low';
    this.ao.material.uniforms.uSteps.value = this.s.effects === 'high' ? 2 : 1;
    c.addPass(this.ao);
    c.addPass(new ShaderPass(ScrubShader));
    // high threshold: only emissive things (fire, magic, glowing particles) bloom, not sunlit ground
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.05);
    c.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    c.addPass(new OutputPass());
    this.composer = c;
  }

  /** Current camera zoom (smoothly follows the target set by the wheel). */
  setZoom(z: number) {
    this.zoomLevel = z;
  }

  /** Effects detail level used by world and entity renderers. */
  private get detail(): Quality {
    return this.s.shadows === 'off' ? 'low' : (this.quality as Quality);
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
    // render resolution: native device pixels, or a fixed resolution scaled to the window
    const dpr = window.devicePixelRatio || 1;
    let ratio = this.quality === 'low' ? Math.min(dpr, 1) : Math.min(dpr, 2);
    const res = this.s.resolution;
    if (res && res !== 'native') {
      const [rw, rh] = res.split('x').map(Number);
      if (rw > 0 && rh > 0) ratio = Math.min(rw / w, rh / h);
    }
    if (this.s.antiAliasing === 'ssaa') ratio *= 1.5;
    this.gl.setPixelRatio(Math.max(0.5, Math.min(3, ratio)));
    this.gl.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.gl.getPixelRatio());
      this.composer.setSize(w, h);
    }
    if (this.grade) {
      const pr = this.gl.getPixelRatio();
      this.grade.uniforms.uRes.value.set(w * pr, h * pr);
      // tilt-shift strength in drawing-buffer pixels (none on low effects)
      this.grade.uniforms.uBlur.value = this.quality === 'low' ? 0 : (this.quality === 'high' ? 3.2 : 2.4) * pr * (h / 900);
    }
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.rig.resize(w, h);
    this.overlay.resize(w, h, window.devicePixelRatio || 1);
  }

  /** Camera far plane from the view distance setting. */
  private applyFar() {
    this.rig.camera.far = 240 * this.viewMul;
    this.rig.camera.updateProjectionMatrix();
  }

  private setAtmosphere(map: MapDef) {
    const p = map.palette;
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, (p.fogNear + 8) * this.viewMul, (p.fogFar + 12) * this.viewMul);
    this.hemi.color.setHex(p.ambient).lerp(this.cA.setHex(MCD.sky), MCD.skyMix);
    this.hemi.groundColor.setHex(p.hemiGround).lerp(this.cA.setHex(MCD.ground), MCD.groundMix);
    this.hemi.intensity = p.ambientIntensity * 3.0 * MCD.ambMul;
    this.sun.color.setHex(p.sun).lerp(this.cA.setHex(MCD.sun), MCD.sunMix);
    this.sun.intensity = p.sunIntensity * 2.4 * MCD.sunMul;
  }

  private buildWorld(terrain: Terrain, map: MapDef) {
    this.disposeWorld();
    this.setAtmosphere(map);
    this.world = new WorldRenderer(terrain, map, this.blockTex, this.detail);
    this.scene.add(this.world.group);
    this.torchTerrain = terrain;
  }

  /** Cuts the camera to a point (open-world respawn / teleport) and builds the streamed world around it at once. */
  snapTo(x: number, z: number) {
    this.rig.snap(x, z, this.run ? this.run.terrain.groundY(x, z) : 0);
    this.world?.cull(x, z, 70, 0);
  }

  /** Starts drawing the world; returns the FxSink the game logic should use. */
  startRun(run: World, hooks: FxHooks): FxSink {
    this.menuMode = false;
    this.clearShowcase();
    this.run = run;
    GROUND.fn = (x, z) => run.terrain.groundY(x, z);
    this.buildWorld(run.terrain, run.map);
    this.applyFar();
    this.entities = new RpgEntities(run, this.s.shadows !== 'off');
    this.scene.add(this.entities.group);
    this.particles = new Particles(this.scene, this.blockTex, this.blobTex, this.s.particles);
    this.ambient = new AmbientFx(this.scene, run.map.generator, this.quality, this.particleMul);
    this.overlay.clear();
    this.rig.snap(run.player.x, run.player.z, run.player.y);
    this.world?.cull(run.player.x, run.player.z, 70, 0);
    return this.makeFx(hooks);
  }

  /** The hero model being drawn (previews and tests). */
  get heroModel(): HumanModel | null {
    return this.entities?.hero ?? null;
  }

  private makeFx(hooks: FxHooks): FxSink {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      burst(x, y, z, color, count, speed, size, life, kind?: ParticleKind) {
        const mul = self.particleMul;
        self.particles?.burst(x, y, z, color, Math.max(1, Math.round(count * mul)), speed, size, life, kind);
      },
      number(x, z, value, crit, color) {
        self.overlay.number(x, z, value, crit, color);
      },
      text(x, z, text, color) {
        self.overlay.text(x, z, text, color);
      },
      shake(a) {
        self.rig.addShake(a);
      },
      light(x, z, color, intensity, radius, duration) {
        self.lights.flash(x, z, color, intensity, radius, duration);
      },
      sound: hooks.sound,
      vibrate: hooks.vibrate,
      emit(x, y, z, layer, dirX = 0, dirZ = 0, mul = 1) {
        self.particles?.emit(x, y, z, layer, dirX, dirZ, mul * self.particleMul);
      },
      level() {
        return self.s.effects === 'low' ? 0 : self.s.effects === 'medium' ? 1 : 2;
      },
    };
  }

  endRun() {
    if (this.entities) {
      this.scene.remove(this.entities.group);
      this.entities.dispose();
      this.entities = null;
    }
    this.particles?.dispose();
    this.particles = null;
    this.ambient?.dispose();
    this.ambient = null;
    this.disposeWorld();
    this.run = null;
    this.applyFar();
    GROUND.fn = null;
    this.overlay.clear();
  }

  private disposeWorld() {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    this.torchTerrain = null;
  }

  /** Menu background: the training meadow with a hero at (x, z), slowly circled by the camera. */
  showMenu(map: MapDef, terrain: Terrain, x: number, z: number) {
    this.endRun();
    this.menuMode = true;
    this.menuX = x;
    this.menuZ = z;
    GROUND.fn = (px, pz) => terrain.groundY(px, pz);
    this.buildWorld(terrain, map);
    this.scene.fog = new THREE.Fog(map.palette.fog, 14, 44);
    this.world?.cull(x, z, 60, 0);
    this.clearShowcase();
    this.showHero = new HumanModel('human', true);
    this.scene.add(this.showHero.root);
  }

  private clearShowcase() {
    if (this.showHero) {
      this.scene.remove(this.showHero.root);
      this.showHero.dispose();
      this.showHero = null;
    }
  }

  frame(dt: number) {
    this.time += dt;
    const lights = this.lights;
    lights.begin();
    if (this.menuMode) this.menuFrame(dt);
    else if (this.run) this.runFrame(dt);
    const t = this.rig.target;
    if (this.torchTerrain) {
      // after dark torches and fires throw wider, warmer pools of light (MCD night scenes)
      const nk = this.run ? this.run.dayNight.night : 0;
      const boost = 1 + nk * 0.45;
      const rad = 7 + nk * 2.5;
      // terrain lights are window-local on streamed worlds
      const lox = this.torchTerrain.ox;
      const loz = this.torchTerrain.oz;
      for (const l of this.torchTerrain.lights) {
        const lx = l.x + lox;
        const lz = l.z + loz;
        if ((lx - t.x) ** 2 + (lz - t.z) ** 2 > 24 * 24) continue;
        const f = l.flicker ?? 1;
        const flick = 1 - f * 0.15 + f * (Math.sin(this.time * 9 + lx * 3) * 0.08 + Math.sin(this.time * 23 + lz) * 0.05);
        const day = l.day ?? 1;
        const dk = day + (1 - day) * nk;
        lights.request(lx, l.y, lz, l.color, l.intensity * flick * boost * dk, l.radius ? l.radius * (1 + nk * 0.3) : rad, t.x, t.z);
      }
    }
    lights.end(dt, t.x, t.z);
    this.world?.update(this.time, 0);
    if (this.composer) this.composer.render(dt);
    else this.gl.render(this.scene, this.rig.camera);
    this.overlay.draw(dt, this.rig.camera, this.menuMode ? null : this.run);
  }

  private menuFrame(dt: number) {
    const cx = this.menuX;
    const cz = this.menuZ;
    const gy = this.torchTerrain ? this.torchTerrain.groundY(cx, cz) : 0;
    this.menuAngle += dt * 0.12;
    const cam = this.rig.camera;
    const portrait = this.h > this.w;
    const dist = portrait ? 9 : 7;
    this.menuShiftNow += (this.menuShift - this.menuShiftNow) * (1 - Math.exp(-6 * dt));
    const off = portrait ? 0 : this.menuShiftNow * dist * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * 0.58;
    const fx = -Math.sin(this.menuAngle);
    const fz = -Math.cos(this.menuAngle);
    const ox = fz * off;
    const oz = -fx * off;
    cam.position.set(cx + Math.sin(this.menuAngle) * dist + ox, gy + (portrait ? 4.5 : 3.6), cz + Math.cos(this.menuAngle) * dist + oz);
    cam.lookAt(cx + ox, gy + 1.1, cz + oz);
    this.sun.position.set(cx + 10, 25, cz + 6);
    this.sun.target.position.set(cx, 0, cz);
    const hero = this.showHero;
    if (hero) {
      hero.root.position.set(cx, gy, cz);
      hero.root.rotation.y = this.menuAngle + Math.sin(this.time * 0.5) * 0.3;
      hero.pose({ walk: 0, moving: 0, airborne: false, vy: 0, attack: null, time: this.time });
    }
    this.lights.request(cx + 1.5, gy + 2.5, cz + 1.5, 0xffc070, 1.0, 9, cx, cz);
  }

  private runFrame(dt: number) {
    const run = this.run!;
    const p = run.player;
    const lead = { x: p.vx * 0.18, z: p.vz * 0.18 };
    this.rig.zoom += (this.zoomLevel - this.rig.zoom) * (1 - Math.exp(-10 * Math.max(dt, 1 / 120)));
    this.rig.update(dt, p.x, p.z, lead, p.airborne ? Math.min(p.y, p.ground + 0.5) : p.ground);
    if (this.photo) {
      const ph = this.photo;
      this.rig.camera.position.set(ph.x, ph.y, ph.z);
      this.rig.camera.lookAt(ph.lx, ph.ly, ph.lz);
    }
    const zoom = this.rig.zoom;
    const t = this.rig.target;
    const pal = run.map.palette;
    // day/night: moonlight, colder palette and thicker fog after dark
    const L = run.dayNight.light;
    const nightK = run.dayNight.night;
    this.hemi.intensity = pal.ambientIntensity * 3.0 * MCD.ambMul * L.ambient;
    this.sun.intensity = pal.sunIntensity * 2.4 * MCD.sunMul * L.sun;
    // MCD bias (teal fill, warm sun) fades out as the phase tint (moonlight, dusk) takes over
    this.hemi.color.setHex(pal.ambient).lerp(this.cA.setHex(MCD.sky), MCD.skyMix * (1 - L.tint)).lerp(this.cA.setHex(L.ambientColor), L.tint);
    this.hemi.groundColor.setHex(pal.hemiGround).lerp(this.cA.setHex(MCD.ground), MCD.groundMix);
    this.sun.color.setHex(pal.sun).lerp(this.cA.setHex(MCD.sun), MCD.sunMix * (1 - L.tint)).lerp(this.cA.setHex(L.sunColor), L.tint);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(pal.fog).lerp(this.cB.setHex(L.fogColor), L.fogTint);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fog.color);
    if (this.grade) {
      const g = this.grade.uniforms;
      g.uWarm.value = L.warm;
      g.uSat.value = L.sat * 0.82;
      g.uHaze.value.copy(fog.color);
      g.uHazeK.value = 0.08 + nightK * 0.08;
      // MCD nights stay rich blue rather than grey: cooler shadows after dark
      g.uShadow.value.set(0.9 - nightK * 0.18, 1.0 - nightK * 0.04, 1.12 + nightK * 0.28);
    }
    // fog is measured from the camera: start a little past the hero so the far (top) part of the
    // view hazes over like MCD, and push it back with the view-distance setting
    const camD = this.rig.distance * this.rig.autoZoom;
    const vm = this.viewMul;
    const nearK = L.fog;
    const farK = 0.35 + 0.65 * L.fog;
    fog.near = Math.max(camD * 0.75, camD - 6 + (pal.fogNear - 18) * vm * nearK);
    fog.far = Math.max(camD + 12, camD - 6 + (pal.fogFar - 6) * vm * farK);
    // shadow box grows with zoom so the whole view stays shadowed
    if (this.photo?.noFog) {
      fog.near = 400;
      fog.far = 900;
    }
    const ext = 26 * Math.max(1, zoom * this.rig.autoZoom);
    const sc = this.sun.shadow.camera;
    if (sc.right !== ext) {
      sc.left = sc.bottom = -ext;
      sc.right = sc.top = ext;
      sc.updateProjectionMatrix();
    }
    this.cullT -= dt;
    if (this.cullT <= 0) {
      this.cullT = 0.25;
      this.world?.cull(t.x, t.z, fog.far + 6);
    }
    // sun follows the camera so the shadow map covers the view; the box is centred a little
    // up-screen because the tilted view sees farther toward the top
    // MCD light comes from the upper left of the screen, so shadows fall down and to the right;
    // the sun (and the moon at night) swings across the sky, so shadows sweep over the day
    const arc = run.dayNight.sunArc;
    const ang = Math.atan2(0.22, -0.97) + arc * 0.55;
    const elev = 26 - Math.abs(arc) * 6;
    const cx = t.x - this.rig.toCam.x * 3;
    const cz = t.z - this.rig.toCam.z * 3;
    this.sun.position.set(cx + Math.cos(ang) * 17, t.y + elev, cz + Math.sin(ang) * 17);
    this.sun.target.position.set(cx, t.y, cz);
    this.world?.uniforms.uFocus.value.set(p.x, p.y, p.z);
    if (this.world) this.world.uniforms.uNight.value = nightK;
    this.world?.uniforms.uCamDir.value.set(this.rig.toCam.x, this.rig.toCam.z);
    // a warm light pool follows the hero on dark maps
    if (pal.heroLight) this.lights.request(p.x, 2.6, p.z, pal.heroLight, 1.6 + nightK * 0.4, 9, t.x, t.z);
    else if (nightK > 0.05) this.lights.request(p.x, 2.6, p.z, 0xffd8a0, 2.6 * nightK, 10, t.x, t.z);
    this.entities!.update(dt);
    this.particles!.update(dt);
    const cam = this.rig.camera;
    const px = (this.h * this.gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    this.ambient?.update(dt, t.x, t.z, nightK, px, 0, t.y);
  }

  dispose() {
    this.clearShowcase();
    this.endRun();
    this.gl.dispose();
  }
}
