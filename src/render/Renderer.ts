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
import { getModel } from '../models';

export type Quality = 'low' | 'medium' | 'high';

const AMBIENT: Record<string, [AmbientKind, number]> = {
  forest: ['spores', 0xc58aff],
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
  private time = 0;
  private torchTerrain: Terrain | null = null;
  // menu diorama
  private showModel: ArticulatedModel | null = null;
  private showId = '';
  private menuMode = false;
  private menuAngle = 0;
  private w = 1;
  private h = 1;

  constructor(private container: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false });
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
    this.applyQuality(quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private lightCount(): number {
    return this.quality === 'low' ? 2 : this.quality === 'medium' ? 4 : 6;
  }

  applyQuality(q: Quality) {
    const changed = q !== this.quality;
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.gl.setPixelRatio(q === 'low' ? Math.min(dpr, 1) * 0.85 : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.gl.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (changed) {
      // light count is baked into shaders: rebuild the pool
      for (const l of this.lights.lights) this.scene.remove(l);
      this.lights = new LightPool(this.scene, this.lightCount());
    }
    this.resize();
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.rig.resize(w, h);
    this.overlay.resize(w, h, window.devicePixelRatio || 1);
  }

  private setAtmosphere(map: MapDef) {
    const p = map.palette;
    this.scene.background = new THREE.Color(p.sky);
    this.scene.fog = new THREE.Fog(p.fog, p.fogNear + 8, p.fogFar + 12);
    this.hemi.color.setHex(p.ambient);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.ambientIntensity * 2.2;
    this.sun.color.setHex(p.sun);
    this.sun.intensity = p.sunIntensity * 1.6;
  }

  private buildWorld(terrain: Terrain, map: MapDef) {
    this.disposeWorld();
    this.setAtmosphere(map);
    this.world = new WorldRenderer(terrain, map, this.blockTex, this.quality);
    this.scene.add(this.world.group);
    this.torchTerrain = terrain;
  }

  /** Starts drawing a run; returns the FxSink the game logic should use. */
  startRun(run: Run, hooks: FxHooks, settings: { damageNumbers: boolean; screenShake: boolean }): FxSink {
    this.menuMode = false;
    this.clearShowcase();
    this.run = run;
    this.buildWorld(run.terrain, run.map);
    this.entities = new EntityRenderer(this.scene, run, this.blockTex, this.blobTex, this.quality, this.lights);
    const [kind, color] = AMBIENT[run.map.generator] ?? ['motes', 0xffffff];
    this.particles = new Particles(this.scene, this.blockTex, this.blobTex, this.quality, kind, color);
    this.overlay.showNumbers = settings.damageNumbers;
    this.overlay.clear();
    this.rig.shakeEnabled = settings.screenShake;
    this.rig.snap(run.player.x, run.player.z);
    return this.makeFx(hooks);
  }

  setSettings(s: { damageNumbers: boolean; screenShake: boolean }) {
    this.overlay.showNumbers = s.damageNumbers;
    this.rig.shakeEnabled = s.screenShake;
  }

  private makeFx(hooks: FxHooks): FxSink {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      burst(x, y, z, color, count, speed, size, life, kind?: ParticleKind) {
        const mul = self.quality === 'low' ? 0.5 : self.quality === 'medium' ? 0.8 : 1;
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
    if (this.showId === modelId && this.showModel) return;
    this.clearShowcase();
    const m = getModel(modelId);
    if (!m) return;
    this.showModel = new ArticulatedModel(m, this.blockTex, true);
    this.showId = modelId;
    this.scene.add(this.showModel.root);
  }

  private clearShowcase() {
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
    this.gl.render(this.scene, this.rig.camera);
    this.overlay.draw(dt, this.rig.camera, this.menuMode ? null : this.run);
  }

  private menuFrame(dt: number) {
    const c = (this.torchTerrain?.size ?? 64) / 2;
    this.menuAngle += dt * 0.12;
    const cam = this.rig.camera;
    const portrait = this.h > this.w;
    const dist = portrait ? 13 : 10;
    cam.position.set(c + Math.sin(this.menuAngle) * dist, portrait ? 7.5 : 6, c + Math.cos(this.menuAngle) * dist);
    cam.lookAt(c, 1.4, c);
    this.sun.position.set(c + 10, 25, c + 6);
    this.sun.target.position.set(c, 0, c);
    if (this.showModel) {
      const m = this.showModel;
      m.root.position.set(c, 0, c);
      m.root.rotation.y = this.menuAngle + Math.sin(this.time * 0.6) * 0.4;
      m.pose({ walk: 0, moving: 0, attack: 0, cast: Math.max(0, Math.sin(this.time * 0.7)) * 0.3, time: this.time, flash: 0 });
    }
    this.lights.request(c + 1.5, 2.5, c + 1.5, 0xffc070, 1.2, 9, c, c);
  }

  private runFrame(dt: number) {
    const run = this.run!;
    const p = run.player;
    const lead = { x: p.vx * 0.18, z: p.vz * 0.18 };
    this.rig.update(dt, p.x, p.z, lead);
    const t = this.rig.target;
    // weather
    const pal = run.map.palette;
    const dark = run.weather.darkness;
    this.hemi.intensity = pal.ambientIntensity * 2.2 * (1 - dark * 0.72);
    this.sun.intensity = pal.sunIntensity * 1.6 * (1 - dark * 0.8);
    const fog = this.scene.fog as THREE.Fog;
    const bl = run.weather.blizzard;
    fog.near = (pal.fogNear + 8) * (1 - bl * 0.45) * (1 - dark * 0.3);
    fog.far = (pal.fogFar + 12) * (1 - bl * 0.4) * (1 - dark * 0.3);
    // sun follows the camera so the shadow map covers the view
    this.sun.position.set(t.x + 8, 26, t.z + 10);
    this.sun.target.position.set(t.x, 0, t.z - 2);
    this.world?.uniforms.uFocus.value.set(p.x, 0, p.z);
    this.entities!.update(dt, t.x, t.z);
    this.particles!.update(dt, t.x, t.z, bl);
  }

  dispose() {
    this.endRun();
    this.gl.dispose();
  }
}
