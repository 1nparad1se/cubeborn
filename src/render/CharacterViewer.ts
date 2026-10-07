import * as THREE from 'three';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator, type AnimName } from './rig/Animator';
import { heroRig } from '../models/heroRigs';
import { makeHeroTexture } from './Textures';

const MAX_SPARKS = 400;

interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
  drag: number;
  grav: number;
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Stand-alone preview stage for the Character Viewer: its own WebGL canvas, studio lighting
 * (soft key with shadows, fill, cool rim light), a turntable floor and a camera that orbits
 * the model. Drag (mouse or one finger) rotates the hero, the wheel or a pinch zooms within
 * limits, double-click resets. Animation events spawn small particle effects.
 */
export class CharacterViewer {
  readonly canvas: HTMLCanvasElement;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  private rig: HeroRig | null = null;
  private anim: HeroAnimator | null = null;
  private heroId = '';
  private texture = makeHeroTexture();
  private stage = new THREE.Group();
  private sparks: Spark[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private glowDisc: THREE.Mesh;
  private running = false;
  private last = 0;
  private raf = 0;
  private ro: ResizeObserver;
  private deathT = -1;
  private flashT = 0;
  private color = new THREE.Color(0xffffff);
  // view state
  yaw = 0.5;
  private yawVel = 0;
  pitch = 0.18;
  dist = 5.4;
  private distNow = 5.4;
  private pitchNow = 0.18;
  readonly minDist = 2.4;
  readonly maxDist = 8.5;
  turntable = false;
  speed = 1;
  topView = false;
  /** Current animation shown by the viewer. */
  mode: AnimName = 'idle';
  onModeChange: ((m: AnimName) => void) | null = null;

  constructor(private host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cv-canvas';
    host.appendChild(this.canvas);
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.setClearColor(0x000000, 0);
    this.buildStage();
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sparkMat, MAX_SPARKS);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.count = 0;
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);
    this.glowDisc = this.stage.getObjectByName('glow') as THREE.Mesh;
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  private buildStage() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xe4ecff, 0x3a3444, 1.5));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.7);
    key.position.set(2.6, 5.5, 3.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
    key.shadow.camera.right = key.shadow.camera.top = 2.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 14;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 5;
    s.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.7);
    fill.position.set(-4, 2.5, 2.5);
    s.add(fill);
    const rim = new THREE.DirectionalLight(0x8fc4ff, 2.6);
    rim.position.set(-1.5, 3.5, -5);
    s.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffc89a, 1.4);
    rim2.position.set(3, 2, -4);
    s.add(rim2);
    // turntable: soft glow, shadow catcher, rings
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, color: 0xffffff }));
    glow.name = 'glow';
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.002;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.12, 40), new THREE.MeshLambertMaterial({ color: 0x2c3140 }));
    plate.position.y = -0.06;
    plate.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.45, 40), new THREE.MeshLambertMaterial({ color: 0x394052 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    top.receiveShadow = true;
    const ringGeo = new THREE.RingGeometry(1.36, 1.42, 48);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.ShadowMaterial({ opacity: 0.38 }));
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.003;
    shadowCatcher.receiveShadow = true;
    this.stage.add(glow, plate, top, ring, shadowCatcher);
    s.add(this.stage);
  }

  setHero(id: string, color: number, silhouette = false) {
    const def = heroRig(id);
    if (!def) return;
    if (this.rig) {
      this.stage.remove(this.rig.root);
      this.rig.dispose();
    }
    this.heroId = id;
    this.color.setHex(color);
    (this.glowDisc.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.rig = new HeroRig(def, this.texture, { shadows: true, rim: silhouette ? 0 : 0.42, silhouette });
    this.anim = new HeroAnimator(this.rig);
    this.anim.onEvent = (ev) => this.onEvent(ev);
    this.stage.add(this.rig.root);
    this.deathT = -1;
    this.play(this.mode === 'death' || this.mode === 'hit' ? 'idle' : this.mode);
    this.anim.update(0.016);
  }

  get hero(): string {
    return this.heroId;
  }

  /** Plays an animation: idle/walk/run loop in place, actions play once over the current gait. */
  play(name: AnimName) {
    const a = this.anim;
    if (!a) return;
    this.deathT = -1;
    if (name === 'idle' || name === 'walk' || name === 'run') {
      a.reset();
      a.forceGait = name === 'idle' ? null : name;
      this.mode = name;
    } else if (name === 'hit') {
      a.hit(0, -1);
      this.flashT = 0.2;
      this.burst(this.rig!.root.position.x, 1.1, 0.25, 0xff5a4a, 18, 2.6, 0.06, 0.4);
    } else {
      if (name === 'death' || name === 'victory') a.forceGait = null;
      a.play(name, { force: true });
      if (name === 'death') this.deathT = 0;
      this.mode = name;
    }
    this.onModeChange?.(this.mode);
  }

  resetView() {
    this.yaw = 0.5;
    this.yawVel = 0;
    this.pitch = this.topView ? 0.92 : 0.18;
    this.dist = 5.4;
  }

  setTopView(on: boolean) {
    this.topView = on;
    this.pitch = on ? 0.92 : 0.18;
    if (on) this.dist = Math.max(this.dist, 6.2);
  }

  zoomBy(f: number) {
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * f));
  }

  private bindInput() {
    const c = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let lastMove = 0;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.yawVel = 0;
      c.classList.add('dragging');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        const k = 0.0105;
        this.yaw += dx * k;
        const now = performance.now();
        const dtm = Math.max(1, now - lastMove);
        lastMove = now;
        this.yawVel = (dx * k) / (dtm / 1000);
        this.pitch = Math.min(1.25, Math.max(-0.12, this.pitch + dy * 0.006));
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomBy(pinch / d);
        pinch = d;
      }
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!pointers.size) c.classList.remove('dragging');
      if (performance.now() - lastMove > 80) this.yawVel = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(Math.exp(Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.16));
      },
      { passive: false },
    );
    c.addEventListener('dblclick', () => this.resetView());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Advances and draws one frame (exposed for tests). */
  frame(dt: number) {
    const adt = dt * this.speed;
    if (this.turntable) this.yaw += dt * 0.6;
    else if (Math.abs(this.yawVel) > 0.01) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-4 * dt);
    }
    if (this.rig && this.anim) {
      this.rig.root.rotation.y = this.yaw;
      this.anim.update(adt);
      this.flashT = Math.max(0, this.flashT - dt);
      this.rig.flash.value = this.flashT > 0 ? this.flashT * 3 : 0;
      if (this.deathT >= 0) {
        this.deathT += adt;
        if (this.deathT > 2.6) this.play('idle');
      }
      if (this.mode !== 'idle' && this.mode !== 'walk' && this.mode !== 'run' && this.mode !== 'death' && this.mode !== 'victory' && this.anim.current !== this.mode) {
        this.mode = this.anim.forceGait ?? 'idle';
        this.onModeChange?.(this.mode);
      }
    }
    // camera: zoom also raises the target toward the face
    this.distNow += (this.dist - this.distNow) * (1 - Math.exp(-10 * dt));
    this.pitchNow += (this.pitch - this.pitchNow) * (1 - Math.exp(-10 * dt));
    const zoomT = (this.maxDist - this.distNow) / (this.maxDist - this.minDist);
    const ty = 0.82 + zoomT * 0.55;
    const cp = Math.cos(this.pitchNow);
    this.camera.position.set(0, ty + Math.sin(this.pitchNow) * this.distNow, cp * this.distNow);
    this.camera.lookAt(0, ty - zoomT * 0.05, 0);
    this.updateSparks(dt);
    this.gl.render(this.scene, this.camera);
  }

  private onEvent(ev: string) {
    const rig = this.rig;
    if (!rig) return;
    const p = new THREE.Vector3();
    rig.tip.getWorldPosition(p);
    const c = this.color.getHex();
    switch (ev) {
      case 'impulse':
        this.burst(p.x, p.y, p.z, c, 26, 3.2, 0.07, 0.5);
        this.burst(p.x, p.y, p.z, 0xffffff, 8, 1.6, 0.05, 0.3);
        break;
      case 'charge':
        this.burst(p.x, p.y, p.z, c, 16, -1.6, 0.05, 0.5, 2.2);
        break;
      case 'death':
        this.burst(0, 0.2, 0, 0xb8b0a0, 34, 2.4, 0.09, 0.8);
        this.burst(0, 0.6, 0, c, 20, 1.2, 0.07, 1.4, 0, -1.4);
        break;
      case 'levelup':
        this.ringBurst(0xffe680, 0.15, 36, 2.6);
        this.burst(0, 1.2, 0, 0xffe680, 30, 2.2, 0.07, 1.0, 0, -1.2);
        break;
      case 'ability':
        this.ringBurst(c, 0.5, 44, 3.4);
        this.burst(0, 1.0, 0, 0xffffff, 16, 2.8, 0.05, 0.5);
        break;
    }
  }

  private burst(x: number, y: number, z: number, color: number, n: number, speed: number, size: number, life: number, spawnR = 0, grav = 3) {
    for (let i = 0; i < n && this.sparks.length < MAX_SPARKS; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const dx = Math.cos(a) * r;
      const dy = u;
      const dz = Math.sin(a) * r;
      const sp = speed * (0.4 + Math.random() * 0.6);
      // negative speed: particles start out on a sphere and rush inward
      const off = spawnR > 0 ? spawnR * 0.3 : 0;
      this.sparks.push({
        x: x + dx * off, y: y + dy * off, z: z + dz * off,
        vx: dx * sp, vy: dy * sp + (speed > 0 ? 0.8 : 0), vz: dz * sp,
        life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.8),
        color: new THREE.Color(color), drag: 2.2, grav,
      });
    }
  }

  private ringBurst(color: number, y: number, n: number, speed: number) {
    for (let i = 0; i < n && this.sparks.length < MAX_SPARKS; i++) {
      const a = (i / n) * Math.PI * 2;
      this.sparks.push({ x: Math.cos(a) * 0.3, y, z: Math.sin(a) * 0.3, vx: Math.cos(a) * speed, vy: 0.4, vz: Math.sin(a) * speed, life: 0.7, max: 0.7, size: 0.08, color: new THREE.Color(color), drag: 3, grav: 0 });
    }
  }

  private updateSparks(dt: number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    let n = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy = p.vy * dr - p.grav * dt;
      p.vz *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = Math.min(1, p.life / (p.max * 0.5));
      s.setScalar(p.size * k);
      v.set(p.x, p.y, p.z);
      q.setFromAxisAngle(v.clone().normalize(), p.life * 6);
      m.compose(v, q, s);
      this.sparkMesh.setMatrixAt(n, m);
      this.sparkMesh.setColorAt(n, p.color.clone().multiplyScalar(k));
      n++;
    }
    this.sparkMesh.count = n;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    if (this.rig) this.rig.dispose();
    this.texture.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.canvas.remove();
  }
}
