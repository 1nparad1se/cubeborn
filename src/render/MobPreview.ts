import * as THREE from 'three';
import { MOB_DEFS } from '../models/mobs';
import { MobRig } from './rig/MobRig';
import { makeHeroTexture } from './Textures';

let tex: THREE.Texture | null = null;

/**
 * A small self-contained 3D view of a bestiary creature for the menu: its own canvas and renderer,
 * the creature playing its idle loop on a slow turntable, drag to rotate. Stops and frees itself
 * once the canvas leaves the page (or on dispose()).
 */
export class MobPreview {
  readonly canvas = document.createElement('canvas');
  private gl: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  private pivot = new THREE.Group();
  private rig: MobRig | null = null;
  private raf = 0;
  private last = 0;
  private t = 0;
  private yaw = 0;
  private spin = 0.35;
  private drag: { x: number; yaw: number } | null = null;
  private idleAfterDrag = 0;

  constructor(modelId: string) {
    this.canvas.className = 'mb-view';
    const def = MOB_DEFS[modelId];
    try {
      this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    } catch {
      this.gl = null;
    }
    if (!this.gl || !def) return;
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3444, 1.5));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
    key.position.set(3, 7, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffa080, 1.0);
    rim.position.set(-3, 4, -6);
    this.scene.add(rim);
    tex ??= makeHeroTexture();
    this.rig = new MobRig(def, tex, { rim: 0.35 });
    this.rig.update(0);
    this.pivot.add(this.rig.root);
    this.scene.add(this.pivot);
    // frame the rest pose: centre it on the turntable axis, camera distance from its size
    const bb = new THREE.Box3().setFromObject(this.rig.root);
    const c = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    this.rig.root.position.set(-c.x, -bb.min.y, -c.z);
    const r = Math.max(size.x, size.y, size.z) * 0.7 + 0.05;
    const dist = r / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, size.y * 0.5 + dist * 0.28, dist);
    this.camera.lookAt(0, size.y * 0.45, 0);
    this.yaw = def.yaw ?? 0.45;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, yaw: this.yaw };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012;
    });
    const up = () => {
      this.drag = null;
      this.idleAfterDrag = 2.5;
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.raf = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number) {
    if (!this.gl || !this.rig) return;
    if (!this.canvas.isConnected && this.last) {
      this.dispose();
      return;
    }
    const dt = this.last ? Math.min(0.1, (ts - this.last) / 1000) : 0;
    this.last = ts;
    this.t += dt;
    if (!this.drag) {
      if (this.idleAfterDrag > 0) this.idleAfterDrag -= dt;
      else this.yaw += this.spin * dt;
    }
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 300;
    if (this.canvas.width !== Math.round(w * this.gl.getPixelRatio()) || this.canvas.height !== Math.round(h * this.gl.getPixelRatio())) {
      this.gl.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.pivot.rotation.y = this.yaw;
    this.rig.update(this.t);
    this.gl.setClearColor(0x000000, 0);
    this.gl.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((t2) => this.frame(t2));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.rig?.dispose();
    this.rig = null;
    this.gl?.dispose();
    this.gl?.forceContextLoss();
    this.gl = null;
  }
}
