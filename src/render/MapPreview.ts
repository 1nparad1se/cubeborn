import * as THREE from 'three';
import type { MapDef } from '../data/types';
import { generateTerrain } from '../game/mapgen/generators';
import { WorldRenderer } from './WorldRenderer';
import { MCD } from './Renderer';

/** Window of real terrain generated for the preview (cells per side). */
const SIZE = 56;

/**
 * Live, slowly orbiting render of a small slice of a map's real terrain, built with the game's own
 * generator and WorldRenderer. Owns its own WebGLRenderer/scene, so the game renderer is untouched.
 * One instance is reused across map selections; call dispose() when the screen closes.
 */
export class MapPreview {
  readonly canvas = document.createElement('canvas');
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 200);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private world: WorldRenderer | null = null;
  private dummyTex = new THREE.Texture();
  private raf = 0;
  private t0 = performance.now();
  private last = 0;
  private mapId = '';
  private ro: ResizeObserver;
  private cA = new THREE.Color();

  constructor() {
    this.canvas.className = 'map-preview-canvas';
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.sun.position.set(SIZE / 2 - 20, 40, SIZE / 2 - 12);
    this.sun.target.position.set(SIZE / 2, 0, SIZE / 2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
  }

  private resize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Shows the given map (regenerates the terrain slice only when the map changes). */
  show(map: MapDef) {
    if (this.mapId === map.id && this.world) return;
    this.mapId = map.id;
    this.disposeWorld();
    const terrain = generateTerrain({ ...map, size: SIZE }, 4242, { zones: false });
    this.world = new WorldRenderer(terrain, map, this.dummyTex, 'medium');
    this.scene.add(this.world.group);
    const p = map.palette;
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, 26, 62);
    this.hemi.color.setHex(p.ambient).lerp(this.cA.setHex(MCD.sky), MCD.skyMix);
    this.hemi.groundColor.setHex(p.hemiGround).lerp(this.cA.setHex(MCD.ground), MCD.groundMix);
    this.hemi.intensity = p.ambientIntensity * 3.0 * MCD.ambMul;
    this.sun.color.setHex(p.sun).lerp(this.cA.setHex(MCD.sun), MCD.sunMix);
    this.sun.intensity = p.sunIntensity * 2.4 * MCD.sunMul;
    this.start();
  }

  private start() {
    if (this.raf) return;
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < 33 || !this.canvas.isConnected) return; // ~30 fps is plenty
      this.last = now;
      this.frame((now - this.t0) / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(time: number) {
    if (!this.world) return;
    if (this.canvas.width <= 1) this.resize();
    const c = SIZE / 2;
    const a = time * 0.12 + 0.8;
    const r = 21 + Math.sin(time * 0.21) * 2.5;
    this.camera.position.set(c + Math.cos(a) * r, 15 + Math.sin(time * 0.17), c + Math.sin(a) * r);
    this.camera.lookAt(c + Math.cos(time * 0.09) * 3, 0, c + Math.sin(time * 0.07) * 3);
    this.world.update(time, 0);
    this.gl.render(this.scene, this.camera);
  }

  private disposeWorld() {
    if (!this.world) return;
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.world = null;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    this.disposeWorld();
    this.dummyTex.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.canvas.remove();
  }
}
