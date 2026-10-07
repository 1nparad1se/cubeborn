import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { MapDef } from '../data/types';
import type { FxSink, ParticleKind } from '../game/types';
import type { Terrain } from '../game/Terrain';
import { CameraRig } from './CameraRig';
import { WorldRenderer } from './WorldRenderer';
import { EntityRenderer } from './EntityRenderer';
import { Particles, type AmbientKind } from './Particles';
import { Overlay } from './Overlay';
import { LightPool } from './LightPool';
import { makeBlobTexture, makeBlockTexture } from './Textures';
import { ArticulatedModel } from './ArticulatedModel';
import { heroRig } from '../models/heroRigs';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator } from './rig/Animator';
import { makeHeroTexture } from './Textures';
import { getModel } from '../models';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import type { Settings } from '../meta/Save';

export type Quality = 'low' | 'medium' | 'high';

const AMBIENT: Record<string, [AmbientKind, number]> = {
  forest: ['rain', 0xc58aff],
  city: ['fireflies', 0xffd37a],
  catacombs: ['dust', 0x9affd8],
  volcano: ['embers', 0xff8a2a],
  tundra: ['snow', 0xffffff],
  ruins: ['motes', 0x8ad8ff],
};

export interface FxHooks {
  sound(id: string, volume?: number): void;
  vibrate(ms: number): void;
}

/** Gentle color grade applied before tone mapping: richer saturation and warm highlights. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.06 }, uWarm: { value: 0.04 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uWarm; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = max(vec3(0.0), mix(vec3(l), c.rgb, uSat));
  c.rgb *= vec3(1.0 + uWarm, 1.0, 1.0 - uWarm);
  gl_FragColor = c;
}`,
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
  private entities: EntityRenderer | null = null;
  private particles: Particles | null = null;
  private lights: LightPool;
  private run: Run | null = null;
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
  private showModel: ArticulatedModel | null = null;
  private showRig: HeroRig | null = null;
  private showAnim: HeroAnimator | null = null;
  private showActT = 4;
  private heroTex: THREE.Texture | null = null;
  private showId = '';
  private menuMode = false;
  private menuAngle = 0;
  /** 0 keeps the menu showcase centred; 1 slides it into the right third of the screen. */
  menuShift = 0;
  private menuShiftNow = 0;
  private w = 1;
  private h = 1;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
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
    return this.quality === 'low' ? 2 : this.quality === 'medium' ? 4 : 6;
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
    this.gl.toneMappingExposure = st.postProcessing ? 1.1 : 1;
    if (st.postProcessing && !this.composer) this.makeComposer();
    else if (!st.postProcessing && this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloom = null;
    }
    if (this.bloom) this.bloom.strength = st.effects === 'low' ? 0.25 : 0.42;
    this.viewMul = { near: 0.8, medium: 1, far: 1.3, max: 1.7 }[st.viewDistance] ?? 1;
    this.rig.camera.far = 200 * this.viewMul;
    this.rig.camera.updateProjectionMatrix();
    this.rig.shake = st.screenShake;
    this.overlay.showNumbers = st.damageNumbers;
    this.overlay.healthBars = st.enemyHealthBars;
    if (changed) {
      // light count is baked into shaders: rebuild the pool
      for (const l of this.lights.lights) this.scene.remove(l);
      this.lights = new LightPool(this.scene, this.lightCount());
    }
    if (this.scene.fog && this.run) this.setAtmosphere(this.run.map);
    this.resize();
  }

  /** Scene -> bloom -> color grade -> tone mapping and sRGB output. */
  private makeComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.msaa ? 4 : 0 });
    const c = new EffectComposer(this.gl, rt);
    c.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.82);
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
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.rig.resize(w, h);
    this.overlay.resize(w, h, window.devicePixelRatio || 1);
  }

  private setAtmosphere(map: MapDef) {
    const p = map.palette;
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, (p.fogNear + 8) * this.viewMul, (p.fogFar + 12) * this.viewMul);
    this.hemi.color.setHex(p.ambient);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.ambientIntensity * 3.0;
    this.sun.color.setHex(p.sun);
    this.sun.intensity = p.sunIntensity * 2.4;
  }

  private buildWorld(terrain: Terrain, map: MapDef) {
    this.disposeWorld();
    this.setAtmosphere(map);
    this.world = new WorldRenderer(terrain, map, this.blockTex, this.detail);
    this.scene.add(this.world.group);
    this.torchTerrain = terrain;
  }

  /** Starts drawing a run; returns the FxSink the game logic should use. */
  startRun(run: Run, hooks: FxHooks): FxSink {
    this.menuMode = false;
    this.clearShowcase();
    this.run = run;
    this.buildWorld(run.terrain, run.map);
    this.entities = new EntityRenderer(this.scene, run, this.blockTex, this.blobTex, this.detail === 'high' && this.s.shadows !== 'low' ? 'high' : this.detail === 'low' ? 'low' : 'medium', this.lights);
    const [kind, color] = AMBIENT[run.map.generator] ?? ['motes', 0xffffff];
    this.particles = new Particles(this.scene, this.blockTex, this.blobTex, this.s.particles, kind, color);
    this.overlay.clear();
    this.rig.snap(run.player.x, run.player.z);
    return this.makeFx(hooks);
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
    };
  }

  endRun() {
    this.entities?.dispose();
    this.entities = null;
    this.particles?.dispose();
    this.particles = null;
    this.disposeWorld();
    this.run = null;
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

  /** Menu background: a small slice of a map with a hero slowly circled by the camera. */
  showMenu(map: MapDef, terrain: Terrain, heroModel: string) {
    this.endRun();
    this.menuMode = true;
    this.buildWorld(terrain, map);
    this.scene.fog = new THREE.Fog(map.palette.fog, 14, 44);
    this.setShowcase(heroModel);
  }

  setShowcase(modelId: string) {
    if (this.showId === modelId && (this.showModel || this.showRig)) return;
    this.clearShowcase();
    const rd = heroRig(modelId);
    if (rd) {
      this.heroTex ??= makeHeroTexture();
      this.showRig = new HeroRig(rd, this.heroTex, { shadows: true, rim: 0.4 });
      this.showAnim = new HeroAnimator(this.showRig);
      this.showAnim.play('victory', { force: true });
      this.showActT = 3.5;
      this.showId = modelId;
      this.scene.add(this.showRig.root);
      return;
    }
    const m = getModel(modelId);
    if (!m) return;
    this.showModel = new ArticulatedModel(m, this.blockTex, true);
    this.showId = modelId;
    this.scene.add(this.showModel.root);
  }

  private clearShowcase() {
    if (this.showRig) {
      this.scene.remove(this.showRig.root);
      this.showRig.dispose();
      this.showRig = null;
      this.showAnim = null;
      this.showId = '';
    }
    if (this.showModel) {
      this.scene.remove(this.showModel.root);
      this.showModel.dispose();
      this.showModel = null;
      this.showId = '';
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
      for (const l of this.torchTerrain.lights) {
        if ((l.x - t.x) ** 2 + (l.z - t.z) ** 2 > 22 * 22) continue;
        const flick = 0.85 + Math.sin(this.time * 9 + l.x * 3) * 0.08 + Math.sin(this.time * 23 + l.z) * 0.05;
        lights.request(l.x, l.y, l.z, l.color, l.intensity * flick, 7, t.x, t.z);
      }
    }
    lights.end(dt, t.x, t.z);
    this.world?.update(this.time, this.run?.weather.surge ?? 0);
    if (this.composer) this.composer.render(dt);
    else this.gl.render(this.scene, this.rig.camera);
    this.overlay.draw(dt, this.rig.camera, this.menuMode ? null : this.run);
  }

  private menuFrame(dt: number) {
    const c = (this.torchTerrain?.size ?? 64) / 2;
    this.menuAngle += dt * 0.12;
    const cam = this.rig.camera;
    const portrait = this.h > this.w;
    const dist = portrait ? 13 : 10;
    this.menuShiftNow += (this.menuShift - this.menuShiftNow) * (1 - Math.exp(-6 * dt));
    // pan the camera sideways so the model sits right of centre, leaving room for panels
    const off = portrait ? 0 : this.menuShiftNow * dist * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * 0.58;
    const fx = -Math.sin(this.menuAngle);
    const fz = -Math.cos(this.menuAngle);
    const ox = fz * off;
    const oz = -fx * off;
    cam.position.set(c + Math.sin(this.menuAngle) * dist + ox, portrait ? 7.5 : 6, c + Math.cos(this.menuAngle) * dist + oz);
    cam.lookAt(c + ox, 1.4, c + oz);
    this.sun.position.set(c + 10, 25, c + 6);
    this.sun.target.position.set(c, 0, c);
    if (this.showModel) {
      const m = this.showModel;
      m.root.position.set(c, 0, c);
      m.root.rotation.y = this.menuAngle + Math.sin(this.time * 0.6) * 0.4;
      m.pose({ walk: 0, moving: 0, attack: 0, cast: Math.max(0, Math.sin(this.time * 0.7)) * 0.3, time: this.time, flash: 0 });
    }
    if (this.showRig && this.showAnim) {
      const r = this.showRig;
      r.root.position.set(c, 0, c);
      r.root.rotation.y = this.menuAngle + Math.sin(this.time * 0.6) * 0.4;
      // the menu hero idles and now and then shows off an attack
      this.showActT -= dt;
      if (this.showActT <= 0) {
        this.showActT = 6 + Math.random() * 4;
        this.showAnim.play(Math.random() < 0.7 ? 'attack' : 'ability');
      }
      this.showAnim.update(Math.min(dt, 0.05));
    }
    this.lights.request(c + 1.5, 2.5, c + 1.5, 0xffc070, 1.2, 9, c, c);
  }

  private runFrame(dt: number) {
    const run = this.run!;
    const p = run.player;
    const lead = { x: p.vx * 0.18, z: p.vz * 0.18 };
    this.rig.zoom += (this.zoomLevel - this.rig.zoom) * (1 - Math.exp(-10 * Math.max(dt, 1 / 120)));
    this.rig.update(dt, p.x, p.z, lead);
    const zoom = this.rig.zoom;
    const t = this.rig.target;
    // weather
    const pal = run.map.palette;
    const dark = run.weather.darkness;
    // day/night: moonlight, colder palette and thicker fog after dark
    const L = run.dayNight.light;
    this.hemi.intensity = pal.ambientIntensity * 3.0 * (1 - dark * 0.72) * L.ambient;
    this.sun.intensity = pal.sunIntensity * 2.4 * (1 - dark * 0.8) * L.sun;
    this.hemi.color.setHex(pal.ambient).lerp(this.cA.setHex(L.ambientColor), L.tint);
    this.sun.color.setHex(pal.sun).lerp(this.cA.setHex(L.sunColor), L.tint);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(pal.fog).lerp(this.cB.setHex(L.fogColor), L.fogTint);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fog.color);
    if (this.grade) {
      this.grade.uniforms.uWarm.value = L.warm;
      this.grade.uniforms.uSat.value = L.sat;
    }
    const bl = run.weather.blizzard;
    const storm = Math.min(1, run.weather.storm);
    const vm = this.viewMul * Math.max(1, zoom);
    fog.near = (pal.fogNear + 8) * vm * (1 - bl * 0.45) * (1 - dark * 0.3) * (1 - storm * 0.55) * L.fog;
    fog.far = (pal.fogFar + 12) * vm * (1 - bl * 0.4) * (1 - dark * 0.3) * (1 - storm * 0.5) * (0.35 + 0.65 * L.fog);
    // shadow box grows with zoom so the whole view stays shadowed
    const ext = 20 * Math.max(1, zoom);
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
    // sun follows the camera so the shadow map covers the view
    // the sun (and the moon at night) crosses the sky, so shadows sweep over the day
    const arc = run.dayNight.sunArc;
    this.sun.position.set(t.x + 3 + arc * 16, 26 - Math.abs(arc) * 6, t.z - 12 + arc * 4);
    this.sun.target.position.set(t.x, 0, t.z);
    this.world?.uniforms.uFocus.value.set(p.x, 0, p.z);
    this.world?.uniforms.uCamDir.value.set(this.rig.toCam.x, this.rig.toCam.z);
    // a warm light pool follows the hero on dark maps
    const nightK = run.dayNight.night;
    if (pal.heroLight) this.lights.request(p.x, 2.6, p.z, pal.heroLight, 1.6 + dark * 0.8 + nightK * 0.4, 9, t.x, t.z);
    else if (nightK > 0.05) this.lights.request(p.x, 2.6, p.z, 0xffe2b0, 1.5 * nightK, 8.5, t.x, t.z);
    this.entities!.update(dt, t.x, t.z);
    this.particles!.update(dt, t.x, t.z, bl);
  }

  dispose() {
    this.endRun();
    this.gl.dispose();
  }
}
