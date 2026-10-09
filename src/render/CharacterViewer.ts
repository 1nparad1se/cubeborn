import * as THREE from 'three';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator, type AnimName } from './rig/Animator';
import { heroRig } from '../models/rigs';
import { makeHeroTexture } from './Textures';
import type { SkillSandbox } from './SkillSandbox';

const MAX_SPARKS = 400;
const UP = new THREE.Vector3(0, 1, 0);

/** One clip of a previewed sequence; `hold` keeps a looping clip for that many seconds. */
export interface PreviewStep {
  clip: string;
  hold?: number;
}

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
  /** Rig height relative to the 1.9-unit hero the stage was framed for (big weapons, horns). */
  private fit = 1;
  get minDist() {
    return 2.4 * this.fit;
  }
  get maxDist() {
    return (this.demo ? 26 : 8.5) * this.fit;
  }
  /** Skill demo playing in the stage (the hero is driven by its sandbox). */
  private demo: SkillSandbox | null = null;
  private demoYaw = 0;
  private savedView: [number, number] | null = null;
  private key!: THREE.DirectionalLight;
  /** Freezes animation and demos (the camera still moves). */
  paused = false;
  /** Small procedural moves of the viewer: turning on the spot and a jump. */
  private turnT = -1;
  private jumpT = -1;
  turntable = false;
  speed = 1;
  topView = false;
  /** Current animation shown by the viewer (a gait, a clip name or a sequence key). */
  mode: AnimName = 'idle';
  onModeChange: ((m: AnimName) => void) | null = null;
  /** Base locomotion under the actions. */
  private gait: 'idle' | 'walk' | 'run' = 'idle';
  /** Clip sequence being previewed (combo steps, charge pose → release, hold intro → loop → finish). */
  private seq: PreviewStep[] = [];
  private seqI = 0;
  private seqT = 0;
  private seqClip = '';

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
    this.key = key;
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
    this.detachDemo();
    if (this.rig) {
      this.stage.remove(this.rig.root);
      this.rig.dispose();
    }
    this.heroId = id;
    this.color.setHex(color);
    (this.glowDisc.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.rig = new HeroRig(def, this.texture, { shadows: true, rim: silhouette ? 0 : 0.42, silhouette });
    this.anim = new HeroAnimator(this.rig);
    this.anim.update(0.016);
    const box = new THREE.Box3().setFromObject(this.rig.root);
    const hgt = Number.isFinite(box.max.y) ? box.max.y - Math.min(0, box.min.y) : 1.9;
    const prev = this.fit;
    this.fit = Math.min(1.8, Math.max(0.85, hgt / 1.9));
    this.dist *= this.fit / prev;
    this.anim.onEvent = (ev) => this.onEvent(ev);
    this.stage.add(this.rig.root);
    this.deathT = -1;
    this.seq = [];
    this.anim.forceGait = this.gait === 'idle' ? null : this.gait;
    this.setMode(this.gait);
    this.anim.update(0.016);
  }

  /** Whether the current rig's clip library has this clip. */
  has(clip: string): boolean {
    return !!this.anim?.has(clip);
  }

  /** Every clip name of the current rig's library. */
  clipNames(): string[] {
    const c = (this.anim as unknown as { clips?: Record<string, unknown> } | null)?.clips;
    return c ? Object.keys(c).sort() : [];
  }

  get demoActive(): boolean {
    return !!this.demo;
  }

  /**
   * Hands the hero to a skill sandbox: its group joins the stage (rotating with the view), the
   * rig follows the sandbox hero and plays the clips its ActionSystem requests.
   */
  attachDemo(sb: SkillSandbox, key: string) {
    if (this.demo !== sb) {
      this.detachDemo(false);
      this.demo = sb;
      this.stage.add(sb.group);
      this.savedView = [this.dist, this.pitch];
      const sc = this.key.shadow.camera;
      sc.left = sc.bottom = -12;
      sc.right = sc.top = 12;
      sc.far = 30;
      sc.updateProjectionMatrix();
      this.key.shadow.mapSize.set(2048, 2048);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    this.seq = [];
    this.turnT = this.jumpT = -1;
    this.deathT = -1;
    if (this.anim) {
      this.anim.reset();
      this.anim.forceGait = null;
    }
    this.demoYaw = Math.atan2(sb.hero.fx, sb.hero.fz);
    this.demoReq = sb.action.anim.n;
    this.dist = Math.min(this.maxDist, Math.max(7, Math.min(16, sb.extent * 1.35)));
    this.pitch = 0.8;
    this.setMode(key);
  }

  /** Back to the turntable (disposes the sandbox when `dispose`). */
  detachDemo(dispose = true) {
    const sb = this.demo;
    if (!sb) return;
    this.demo = null;
    this.stage.remove(sb.group);
    if (dispose) sb.dispose();
    this.stage.rotation.y = 0;
    if (this.rig) {
      this.rig.root.position.set(0, 0, 0);
      const mat = this.rig.material;
      mat.opacity = 1;
      if (mat.transparent) {
        mat.transparent = false;
        mat.depthWrite = true;
        mat.needsUpdate = true;
      }
    }
    if (this.anim) {
      this.anim.reset();
      this.anim.speed = this.anim.fwd = this.anim.side = this.anim.turn = 0;
      this.anim.air = false;
      this.anim.forceGait = this.gait === 'idle' ? null : this.gait;
    }
    const sc = this.key.shadow.camera;
    sc.left = sc.bottom = -2.5;
    sc.right = sc.top = 2.5;
    sc.far = 14;
    sc.updateProjectionMatrix();
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    if (this.savedView) [this.dist, this.pitch] = this.savedView;
    this.dist = Math.min(this.maxDist, this.dist);
    this.savedView = null;
    this.setMode(this.gait);
  }

  /** Turns the hero a full circle on the spot (the legs step, the cape sways). */
  playTurn() {
    if (!this.anim) return;
    this.detachDemo();
    this.seq = [];
    this.anim.reset();
    this.turnT = 0;
    this.setMode('turn');
  }

  /** A hop: crouch, airborne, landing. */
  playJump() {
    if (!this.anim) return;
    this.detachDemo();
    this.seq = [];
    this.anim.reset();
    this.jumpT = 0;
    this.setMode('jump');
  }

  private setMode(m: string) {
    if (this.mode === m) return;
    this.mode = m;
    this.onModeChange?.(m);
  }

  /**
   * Plays a sequence of named clips one after another (each step starts when the previous one
   * ends, or after `hold` seconds for looping poses). `key` is reported through onModeChange.
   */
  playSeq(steps: PreviewStep[], key = steps[0]?.clip ?? '') {
    if (!this.anim || !steps.length) return;
    this.detachDemo();
    this.turnT = this.jumpT = -1;
    this.deathT = -1;
    this.anim.reset();
    this.seq = steps;
    this.startStep(0);
    this.setMode(key);
  }

  private startStep(i: number) {
    const a = this.anim!;
    this.seqI = i;
    this.seqT = 0;
    a.play(this.seq[i].clip, { force: true });
    this.seqClip = a.playing;
  }

  private updateSeq(adt: number) {
    const a = this.anim;
    if (!a || !this.seq.length) return;
    this.seqT += adt;
    const st = this.seq[this.seqI];
    const done = st.hold !== undefined ? this.seqT >= st.hold || (a.playing !== this.seqClip && this.seqT > 0.05) : a.playing !== this.seqClip;
    if (!done) return;
    if (this.seqI + 1 < this.seq.length) this.startStep(this.seqI + 1);
    else {
      if (st.hold !== undefined && a.playing === this.seqClip) {
        // looping poses play their tail; held poses (death) stand back up
        if (/_death$/.test(this.seqClip)) a.reset();
        else a.endLoop();
      }
      this.seq = [];
      this.setMode(this.gait);
    }
  }

  get hero(): string {
    return this.heroId;
  }

  /** Plays an animation: idle/walk/run loop in place, actions play once over the current gait. */
  play(name: AnimName) {
    const a = this.anim;
    if (!a) return;
    if (this.demo && name !== 'hit') this.detachDemo();
    this.turnT = this.jumpT = -1;
    this.deathT = -1;
    this.seq = [];
    if (name === 'idle' || name === 'walk' || name === 'run') {
      a.reset();
      a.forceGait = name === 'idle' ? null : name;
      this.gait = name;
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
    this.dist = 5.4 * this.fit;
  }

  setTopView(on: boolean) {
    this.topView = on;
    this.pitch = on ? 0.92 : 0.18;
    if (on) this.dist = Math.max(this.dist, 6.2 * this.fit);
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
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      // performance.now(): rAF timestamps can run behind it (negative steps would grow timers)
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
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
    const adt = this.paused ? 0 : dt * this.speed;
    if (this.turntable) this.yaw += dt * 0.6;
    else if (Math.abs(this.yawVel) > 0.01) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-4 * dt);
    }
    if (this.rig && this.anim && this.demo) this.frameDemo(dt, adt);
    else if (this.rig && this.anim) {
      this.stage.rotation.y = 0;
      this.rig.root.rotation.y = this.yaw;
      this.updateMoves(adt);
      this.anim.update(adt);
      this.flashT = Math.max(0, this.flashT - dt);
      this.rig.flash.value = this.flashT > 0 ? this.flashT * 3 : 0;
      if (this.deathT >= 0) {
        this.deathT += adt;
        if (this.deathT > 2.6) this.play('idle');
      }
      if (this.seq.length) this.updateSeq(adt);
      else if (this.turnT >= 0 || this.jumpT >= 0) {
        /* procedural move running */
      } else if (this.mode !== this.gait && this.mode !== 'death' && this.mode !== 'victory' && this.anim.current !== this.mode) this.setMode(this.gait);
    }
    // camera: zoom also raises the target toward the face
    this.distNow += (this.dist - this.distNow) * (1 - Math.exp(-10 * dt));
    this.pitchNow += (this.pitch - this.pitchNow) * (1 - Math.exp(-10 * dt));
    const zoomT = (this.maxDist - this.distNow) / (this.maxDist - this.minDist);
    const ty = (0.82 + zoomT * 0.55) * this.fit;
    const cp = Math.cos(this.pitchNow);
    if (this.demo) {
      // frame the demo: between the skill's focus and the hero, rotated with the stage
      const sb = this.demo;
      const f = this.camFocus.set((sb.focusX + sb.hero.x) / 2, 0, (sb.focusZ + sb.hero.z) / 2).applyAxisAngle(UP, this.stage.rotation.y);
      const sh = sb.shake;
      const jx = sh > 0 ? (Math.random() - 0.5) * sh * 0.5 : 0;
      const jy = sh > 0 ? (Math.random() - 0.5) * sh * 0.5 : 0;
      this.camera.position.set(f.x + jx, 1 + Math.sin(this.pitchNow) * this.distNow + jy, f.z + cp * this.distNow);
      this.camera.lookAt(f.x + jx, 1 + jy, f.z);
    } else {
      this.camera.position.set(0, ty + Math.sin(this.pitchNow) * this.distNow, cp * this.distNow);
      this.camera.lookAt(0, ty - zoomT * 0.05, 0);
    }
    this.updateSparks(dt);
    this.gl.render(this.scene, this.camera);
  }

  private camFocus = new THREE.Vector3();

  /** Turn-in-place and jump moves of the viewer (no clip: driven through the animator inputs). */
  private updateMoves(adt: number) {
    const a = this.anim!;
    const rig = this.rig!;
    if (this.turnT >= 0) {
      this.turnT += adt;
      const T = 2.4;
      const u = Math.min(1, this.turnT / T);
      // ease in/out a full turn; the yaw rate feeds the lean and the stepping legs
      const ang = Math.PI * 2 * (u * u * (3 - 2 * u));
      const rate = (Math.PI * 2 * 6 * u * (1 - u)) / T;
      rig.root.rotation.y = this.yaw + ang;
      a.turn = Math.max(-3, Math.min(3, rate / 4));
      a.speed = Math.min(1.2, rate * 0.35);
      a.side = a.speed;
      a.fwd = 0;
      if (u >= 1) {
        this.turnT = -1;
        a.turn = a.speed = a.side = 0;
        this.setMode(this.gait);
      }
    }
    if (this.jumpT >= 0) {
      this.jumpT += adt;
      const W = 0.16;
      const AIR = 0.62;
      const LAND = 0.25;
      const t = this.jumpT;
      if (t < W) {
        a.crouch = t / W;
        a.air = false;
        rig.root.position.y = 0;
      } else if (t < W + AIR) {
        const u = (t - W) / AIR;
        a.crouch = 0;
        a.air = true;
        a.airV = 1 - 2 * u;
        rig.root.position.y = 4 * 1.1 * u * (1 - u);
      } else if (t < W + AIR + LAND) {
        a.air = false;
        a.crouch = 1 - (t - W - AIR) / LAND;
        rig.root.position.y = 0;
      } else {
        a.crouch = 0;
        this.jumpT = -1;
        this.setMode(this.gait);
      }
    }
  }

  /** Drives the rig from the sandbox like the game renderer drives the hero (EntityRenderer.drawHeroRig). */
  private frameDemo(dt: number, adt: number) {
    const sb = this.demo!;
    const a = this.anim!;
    const rig = this.rig!;
    this.stage.rotation.y = this.yaw;
    sb.update(adt);
    const p = sb.hero;
    rig.root.position.set(p.x, p.jumpY, p.z);
    const yaw = Math.atan2(p.fx, p.fz);
    let d = yaw - this.demoYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const maxTurn = 11 * adt;
    const dy = Math.max(-maxTurn, Math.min(maxTurn, d * Math.min(1, adt * 16)));
    this.demoYaw += dy;
    rig.root.rotation.y = this.demoYaw;
    const cs = Math.cos(this.demoYaw);
    const sn = Math.sin(this.demoYaw);
    a.speed = Math.hypot(p.vx, p.vz);
    a.fwd = p.vx * sn + p.vz * cs;
    a.side = p.vx * cs - p.vz * sn;
    a.turn = adt > 0 ? Math.max(-3, Math.min(3, dy / adt / 4)) : 0;
    a.air = p.jumpY > 0.05;
    const act = sb.action;
    const req = act.anim;
    if (req.n !== this.demoReq) {
      this.demoReq = req.n;
      a.play(req.name, { force: true, rate: req.rate });
    } else if (!act.cur && a.playing && a.has(a.playing) && (a.playing.endsWith('_charge') || a.playing.endsWith('_cast'))) a.endLoop();
    a.update(adt);
    const blink = p.invulnT > 0 && Math.floor(performance.now() / 50) % 2 === 0;
    rig.flash.value = blink ? 0.3 : 0;
    // reaper stealth: faint shadow like in the game
    const want = act.stealth ? 0.35 : 1;
    const mat = rig.material;
    mat.opacity += (want - mat.opacity) * Math.min(1, Math.max(adt, 0) * 10);
    const tr = mat.opacity < 0.99;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.depthWrite = !tr;
      mat.needsUpdate = true;
    }
    void dt;
  }

  private demoReq = 0;

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
    this.detachDemo();
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
