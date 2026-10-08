import * as THREE from 'three';
import type { WeaponAnim } from '../config/weaponVisuals';
import { WEAPON_BY_ID } from '../data/weapons';
import { Particles } from './Particles';
import { LightPool } from './LightPool';
import { makeBlobTexture, makeBlockTexture } from './Textures';
import { WeaponActor, type FxPort } from './weapons/actor';
import { WeaponModel } from './weapons/build';
import { MODELS } from './weapons/models';
import { resolveVisual } from './weapons/WeaponVisualSystem';

/** Primary object shown for each weapon behaviour, and its secondary objects. */
const KIT: Record<string, { main: string; sub?: string }> = {
  fireball: { main: '' },
  pool: { main: '', sub: 'puddle' },
  tornado: { main: ':fan', sub: '' },
  strike: { main: '', sub: 'stormcloud' },
  meteor: { main: '', sub: 'star' },
  chain: { main: '' },
  summon: { main: '' },
  directional: { main: '' },
  bolt: { main: '' },
  frost: { main: '' },
  arrow: { main: '' },
  radial: { main: '' },
  boomerang: { main: '' },
  orbit: { main: '' },
  wisp: { main: '', sub: 'wispshot' },
  lob: { main: '' },
  mine: { main: '' },
  slash: { main: '' },
  fists: { main: '' },
  lance: { main: '' },
  beam: { main: '' },
  aura: { main: '' },
  nova: { main: '' },
};
/** Thrown and shot weapons share one demo. */
const MISSILES = new Set(['directional', 'bolt', 'frost', 'arrow', 'radial']);
/** Height of a weapon's object when it rests on the stage. */
const REST_Y: Record<string, number> = { mine: 0.03, aura: 1.7, nova: 1.3, beam: 1.4, slash: 1.0, lance: 1.0, fists: 1.1, wisp: 1.35 };
/** Target posts used by attack and hit demos. */
const DUMMY_AT: [number, number][] = [
  [1.9, -1.5],
  [-2.0, -1.2],
  [2.5, 0.9],
  [-2.4, 1.0],
];
const DUMMY_HEAD = 0.95;

interface Live {
  a: WeaponActor;
  key: string;
  /** Free per-actor demo state. */
  t: number;
  done?: boolean;
  from?: THREE.Vector3;
  to?: THREE.Vector3;
  mid?: THREE.Vector3;
  dur?: number;
  dummy?: number;
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

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

/**
 * WEAPON ANIMATIONS stage: its own WebGL canvas and demo scene (not a game map) with studio
 * light, a soft shadow, target posts and the game's particle system. It plays every animation of
 * a weapon (idle, flight, attack, hit, destroy and the weapon's own extras) with the same models
 * and motion scripts the game uses. Drag rotates the view, the wheel zooms within limits.
 */
export class WeaponViewer {
  readonly canvas: HTMLCanvasElement;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  private world = new THREE.Group();
  private particles: Particles;
  private lights: LightPool;
  private port: FxPort;
  private blockTex = makeBlockTexture();
  private blobTex = makeBlobTexture();
  private dummies: { m: WeaponModel; hit: number; x: number; z: number }[] = [];
  private live: Live[] = [];
  private bg: THREE.Object3D[] = [];
  private ro: ResizeObserver;
  private running = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  /** Demo timeline state for the current animation. */
  private d: Record<string, number> = {};
  private demoT = 0;
  private holdT = -1;
  weaponId = 'ember_orb';
  tier = 1;
  mode: WeaponAnim = 'idle';
  /** Repeat one-shot animations in a loop. */
  loop = true;
  speed = 1;
  bgFx = true;
  onModeChange: ((m: WeaponAnim) => void) | null = null;
  // view
  yaw = 0;
  pitch = 0.42;
  dist = 6.4;
  private yawVel = 0;
  private yawNow = 0;
  private distNow = 6.4;
  private pitchNow = 0.42;
  readonly minDist = 2.2;
  readonly maxDist = 12;

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
    this.scene.add(this.world);
    this.buildStage();
    this.particles = new Particles(this.scene, this.blockTex, this.blobTex, 'high', 'motes', 0x9ab4ff);
    this.lights = new LightPool(this.scene, 4);
    const self = this;
    this.port = {
      emit(x, y, z, l, dx, dz, mul) {
        self.particles.emit(x, y, z, l, dx, dz, mul);
      },
      light(x, y, z, color, intensity, radius) {
        self.lights.request(x, y, z, color, intensity * 0.5, radius, 0, 0);
      },
      quality: 2,
    };
    for (const [x, z] of DUMMY_AT) {
      const m = new WeaponModel(MODELS.dummy);
      m.root.position.set(x, 0, z);
      m.root.rotation.y = Math.atan2(-x, -z);
      m.root.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : 0));
      this.world.add(m.root);
      this.dummies.push({ m, hit: 0, x, z });
    }
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  private buildStage() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xe4ecff, 0x34303e, 1.35));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
    key.position.set(3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -4.5;
    key.shadow.camera.right = key.shadow.camera.top = 4.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 6;
    s.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.6);
    fill.position.set(-4, 2.5, 3);
    s.add(fill);
    const rim = new THREE.DirectionalLight(0x8fc4ff, 2.2);
    rim.position.set(-2, 4, -6);
    s.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffc89a, 1.1);
    rim2.position.set(4, 2, -4);
    s.add(rim2);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.75, 0.14, 56), new THREE.MeshLambertMaterial({ color: 0x2a2f3c }));
    floor.position.y = -0.07;
    floor.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CircleGeometry(3.6, 56), new THREE.MeshLambertMaterial({ color: 0x353b4a }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    top.receiveShadow = true;
    const catcher = new THREE.Mesh(new THREE.CircleGeometry(5, 48), new THREE.ShadowMaterial({ opacity: 0.4 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.004;
    catcher.receiveShadow = true;
    s.add(floor, top, catcher);
    // background dressing that the "background effects" switch turns off
    const glow = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0.28)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, color: 0x8fb4ff }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.003;
    glow.name = 'glow';
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.45, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.45, 3.52, 72), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.43, 64), ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.006;
    s.add(glow, ring, ring2);
    this.bg.push(glow, ring, ring2);
  }

  // ---------------------------------------------------------------- weapon / mode
  private get behavior(): string {
    return WEAPON_BY_ID[this.weaponId]?.behavior ?? 'fireball';
  }

  setWeapon(id: string, tier: number) {
    this.weaponId = id;
    this.tier = tier;
    // smoke and sparks of the previous weapon must not drift into this one's demo
    this.particles.clear();
    const c = WEAPON_BY_ID[id]?.color ?? 0xffffff;
    ((this.bg[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(c);
    this.play(this.mode);
  }

  setTier(t: number) {
    this.tier = t;
    this.play(this.mode);
  }

  setBgFx(on: boolean) {
    this.bgFx = on;
    this.particles.ambientOn = on;
    for (const o of this.bg) o.visible = on;
  }

  /** Animations this weapon offers (base five + its extras). */
  anims(): WeaponAnim[] {
    const def = resolveVisual(this.weaponId);
    const extra = def?.extra ?? [];
    return ['idle', 'fly', 'attack', 'hit', 'destroy', ...extra];
  }

  play(mode: WeaponAnim) {
    for (const l of this.live) l.a.dispose();
    this.live = [];
    this.d = {};
    this.demoT = 0;
    this.holdT = -1;
    this.mode = mode;
    for (const dm of this.dummies) dm.m.root.visible = mode !== 'idle' && mode !== 'fly' && mode !== 'charge' && mode !== 'open' && mode !== 'destroy';
    this.onModeChange?.(mode);
  }

  replay() {
    this.play(this.mode);
  }

  private key(part: string): string {
    // part '' = the weapon itself, ':sub' = a secondary object, 'sub' alone also accepted
    if (!part) return this.weaponId;
    return this.weaponId + (part.startsWith(':') ? part : ':' + part);
  }

  private spawn(part: string, x: number, y: number, z: number, size = 1): Live | null {
    const def = resolveVisual(this.key(part));
    if (!def) return null;
    const a = new WeaponActor(def, this.world, this.tier);
    a.model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material as THREE.Material).transparent) m.castShadow = true;
    });
    a.place(x, y, z);
    a.size = size;
    a.play('fly');
    const l: Live = { a, key: part, t: 0 };
    this.live.push(l);
    return l;
  }

  private kill(l: Live) {
    l.a.dispose();
    this.live.splice(this.live.indexOf(l), 1);
  }

  private hitDummy(i: number, dir = 1) {
    const dm = this.dummies[i];
    if (!dm) return;
    dm.hit = 1;
    this.d['hd' + i] = dir;
  }

  private dummyHead(i: number, out: THREE.Vector3): THREE.Vector3 {
    const dm = this.dummies[i];
    return out.set(dm.x, DUMMY_HEAD, dm.z);
  }

  /** Size of the main object on the stage (projectiles are small in the game). */
  private mainSize(): number {
    const b = this.behavior;
    if (MISSILES.has(b) || b === 'wisp') return 1.7;
    if (b === 'slash' || b === 'lance') return 1.15;
    if (b === 'aura') return 1.2;
    return b === 'fireball' || b === 'chain' ? 1.6 : b === 'pool' ? 1.5 : b === 'summon' ? 1.5 : b === 'tornado' ? 1.25 : 1.35;
  }

  // ---------------------------------------------------------------- demos
  /** Advances the current demo; returns true when a one-shot demo has ended. */
  private demo(dt: number): boolean {
    const b = this.behavior;
    const m = this.mode;
    const T = (this.demoT += dt);
    const first = this.live.length === 0 && !this.d.started;
    if (first) this.d.started = 1;
    const kit = KIT[b];
    const S = this.mainSize();

    if (m === 'idle') {
      if (first) {
        const l = this.spawn(kit.main, 0, b === 'tornado' ? 1.3 : REST_Y[b] ?? 1.15, 0, S);
        if (l) {
          l.a.play('idle');
          l.a.facing = 'fixed';
          if (b === 'tornado') {
            l.a.facing = 'aim';
            l.a.aim.set(0, 0, 1);
          }
        }
        if (b === 'strike' && this.tier >= 4) for (let i = 0; i < 2; i++) this.spawn('stormcloud', 0, 3, 0, 0.7)!.t = i * Math.PI;
      }
      for (const l of this.live)
        if (l.key === 'stormcloud') {
          l.t += dt;
          l.a.pos.set(Math.cos(l.t * 0.8) * 1.7, 3, Math.sin(l.t * 0.8) * 1.7);
        }
      return false;
    }

    if (m === 'fly') {
      if (first) {
        const part = b === 'tornado' ? '' : kit.main;
        const l = this.spawn(part, 0, 1.2, 0, b === 'tornado' ? 0.9 : S);
        if (l) {
          if (b === 'tornado') l.a.play('attack');
          l.a.facing = b === 'strike' || b === 'meteor' ? 'fixed' : 'velocity';
        }
      }
      const l = this.live[0];
      if (l) {
        const def = l.a.def;
        // figure-eight with climbs and dives: every direction and sharp turns at the ends
        const w = 0.55 * (def.flightSpeed / 3);
        l.t += dt * w;
        const t = l.t;
        const ground = b === 'tornado' || b === 'mine';
        l.a.pos.set(Math.sin(t) * 2.3, ground ? 0.02 : 1.35 + Math.sin(t * 1.5) * 0.65, Math.sin(t * 2) * 1.35);
        if (ground && l.a.mode === 'attack' && l.a.finished) l.a.play('fly');
      }
      return false;
    }

    // one-shot demos per weapon
    switch (b) {
      case 'fireball':
        return this.demoEmber(m, T, dt, first, S);
      case 'pool':
        return this.demoFlask(m, T, dt, first, S);
      case 'tornado':
        return this.demoCyclone(m, T, dt, first, S);
      case 'strike':
        return this.demoRod(m, T, dt, first, S);
      case 'meteor':
        return this.demoTome(m, T, dt, first, S);
      case 'chain':
        return this.demoSpark(m, T, dt, first, S);
      case 'summon':
        return this.demoFamiliar(m, T, dt, first, S);
      case 'boomerang':
        return this.demoGlaive(m, T, dt, first, S);
      case 'orbit':
        return this.demoSaw(m, T, dt, first, S);
      case 'wisp':
        return this.demoWisp(m, T, dt, first, S);
      case 'lob':
        return this.demoBomb(m, T, dt, first, S);
      case 'mine':
        return this.demoMine(m, T, dt, first, S);
      case 'slash':
      case 'fists':
      case 'lance':
        return this.demoMelee(m, T, dt, first, S);
      case 'beam':
        return this.demoPrism(m, T, dt, first, S);
      case 'aura':
      case 'nova':
        return this.demoPulse(m, T, dt, first, S);
    }
    if (MISSILES.has(b)) return this.demoMissile(m, T, dt, first, S);
    return true;
  }

  /** Moves a live object along its from→(mid)→to path; true on arrival. */
  private travel(l: Live, dt: number): boolean {
    l.t += dt;
    const k = Math.min(1, l.t / (l.dur ?? 1));
    const a = l.from!;
    const c = l.to!;
    if (l.mid) {
      const u = 1 - k;
      l.a.pos.set(u * u * a.x + 2 * u * k * l.mid.x + k * k * c.x, u * u * a.y + 2 * u * k * l.mid.y + k * k * c.y, u * u * a.z + 2 * u * k * l.mid.z + k * k * c.z);
    } else l.a.pos.lerpVectors(a, c, k);
    return k >= 1;
  }

  private demoEmber(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'destroy') {
      if (first) this.spawn('', 0, 1.15, 0, S)?.a.play('destroy');
      return this.allDone();
    }
    if (first) {
      const start = m === 'hit' ? this.dummyHead(0, v1).clone().add(new THREE.Vector3(-0.9, 0.1, 1.1)) : new THREE.Vector3(-1.6, 1.1, 1.4);
      const l = this.spawn('', start.x, start.y, start.z, S);
      if (!l) return true;
      l.from = start;
      l.to = this.dummyHead(0, new THREE.Vector3());
      l.mid = l.from.clone().lerp(l.to, 0.5).add(new THREE.Vector3(0, m === 'hit' ? 0.1 : 0.5, 0));
      l.dur = m === 'hit' ? 0.25 : 0.9;
      if (m === 'attack') l.a.play('attack');
    }
    const l = this.live[0];
    if (l && l.a.mode !== 'hit') {
      if (l.a.mode === 'attack' && l.a.finished) l.a.play('fly');
      if (this.travel(l, dt)) {
        l.a.play('hit');
        this.hitDummy(0);
      }
    }
    return this.allDone(T > 1);
  }

  private demoFlask(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'destroy') {
      if (first) {
        this.spawn('', -0.9, 1.15, 0, S)?.a.play('destroy');
        const p = this.spawn('puddle', 1.1, 0.03, 0.2, 1.1);
        if (p) {
          p.a.facing = 'fixed';
          p.a.play('destroy');
        }
      }
      return this.allDone();
    }
    if (first) {
      const hitOnly = m === 'hit' || m === 'shatter';
      const to = new THREE.Vector3(DUMMY_AT[0][0] - 0.5, 0.35, DUMMY_AT[0][1] + 0.5);
      const from = hitOnly ? to.clone().add(new THREE.Vector3(-0.3, 1.6, 0.4)) : new THREE.Vector3(-1.8, 1.1, 1.5);
      const l = this.spawn('', from.x, from.y, from.z, S);
      if (!l) return true;
      l.from = from;
      l.to = to;
      l.mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, hitOnly ? 0.2 : 2.4, 0));
      l.dur = hitOnly ? 0.3 : 1.0;
      if (!hitOnly) l.a.play('attack');
    }
    const l = this.live[0];
    if (l && l.key === '' && l.a.mode !== 'shatter') {
      if (this.travel(l, dt)) {
        l.a.play('shatter');
        this.hitDummy(0);
        const p = this.spawn('puddle', l.a.pos.x, 0.03, l.a.pos.z, 1.15);
        if (p) {
          p.a.facing = 'fixed';
          p.a.play('attack');
          p.t = 0;
        }
      }
    }
    const p = this.live.find((x) => x.key === 'puddle');
    if (p) {
      p.t += dt;
      if (p.a.mode === 'attack' && p.a.finished) p.a.play('fly');
      if (p.t > 2.6 && p.a.mode !== 'destroy') p.a.play('destroy');
      if (p.a.mode === 'fly' && Math.floor(p.t / 0.5) !== Math.floor((p.t - dt) / 0.5)) this.hitDummy(0, 0.3);
    }
    return this.allDone(T > 1.2 && !!p);
  }

  private demoCyclone(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    const toward = new THREE.Vector3(DUMMY_AT[0][0], 0, DUMMY_AT[0][1]).normalize();
    if (m === 'destroy') {
      if (first) this.spawn('', 0, 0.02, 0, 0.9)?.a.play('destroy');
      return this.allDone();
    }
    if (m === 'hit') {
      if (first) {
        const c = this.spawn('', DUMMY_AT[0][0] - 0.2, 0.02, DUMMY_AT[0][1] + 0.3, 0.9);
        c?.a.play('attack');
      }
      const c = this.live[0];
      if (c) {
        c.t += dt;
        if (c.a.mode === 'attack' && c.a.finished) c.a.play('fly');
        if (Math.floor(c.t / 0.35) !== Math.floor((c.t - dt) / 0.35)) this.hitDummy(0, 0.6);
        if (c.t > 2.2 && c.a.mode !== 'destroy') c.a.play('destroy');
      }
      return this.allDone();
    }
    // attack / fanOpen: the fan opens and sweeps, a cyclone spins up and rolls at the target
    if (first) {
      const f = this.spawn(':fan', 0, 1.3, 0.7, 1.35);
      if (f) {
        f.a.facing = 'aim';
        f.a.aim.copy(toward);
        f.a.play('attack');
      }
    }
    const fan = this.live.find((x) => x.key === ':fan');
    if (fan && fan.a.finished && fan.a.mode !== 'idle') fan.a.play('idle');
    let c = this.live.find((x) => x.key === '');
    if (!c && T > 0.32 && !this.d.spawned) {
      this.d.spawned = 1;
      c = this.spawn('', toward.x * 0.9, 0.02, 0.7 + toward.z * 0.9, 0.9) ?? undefined;
      if (c) {
        c.a.play('attack');
        c.from = c.a.pos.clone();
        c.to = new THREE.Vector3(DUMMY_AT[0][0] - 0.3, 0.02, DUMMY_AT[0][1] + 0.4);
        c.dur = 1.8;
      }
    }
    if (c) {
      if (c.a.mode === 'attack' && c.a.finished) c.a.play('fly');
      if (c.a.mode !== 'destroy') {
        const arrived = this.travel(c, dt);
        c.a.pos.x += Math.sin(c.t * 4) * 0.12;
        if (c.t > 1.2 && Math.floor(c.t / 0.35) !== Math.floor((c.t - dt) / 0.35)) this.hitDummy(0, 0.6);
        if (arrived && c.t > 3) c.a.play('destroy');
      }
    }
    return this.allDone(!!this.d.spawned);
  }

  private demoRod(m: WeaponAnim, T: number, _dt: number, first: boolean, S: number): boolean {
    if (first) {
      const l = this.spawn('', 0, 1.15, 0, S);
      if (!l) return true;
      l.a.play(m === 'attack' ? 'charge' : m);
      if (m === 'hit') this.dummyHead(0, l.a.target).setY(0.9);
    }
    const l = this.live[0];
    if (!l) return true;
    const a = l.a;
    if (m === 'attack') {
      if (a.mode === 'charge' && a.finished) a.play('attack');
      if (a.mode === 'attack' && a.modeT >= a.def.attackTime * 0.4 && !this.d.struck) {
        this.d.struck = 1;
        this.dummyHead(0, a.target).setY(0.9);
        a.play('hit');
        this.hitDummy(0);
      }
      return a.mode === 'hit' && a.finished;
    }
    if (m === 'hit' && T < 0.05) this.hitDummy(0);
    return a.finished;
  }

  private demoTome(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'hit') {
      if (first) {
        const to = this.dummyHead(0, new THREE.Vector3()).setY(0.6);
        const from = to.clone().add(new THREE.Vector3(-1.6, 5, -1.2));
        const s = this.spawn('star', from.x, from.y, from.z, 1.4);
        if (s) {
          s.from = from;
          s.to = to;
          s.dur = 0.7;
        }
      }
      const s = this.live[0];
      if (s && s.a.mode !== 'hit' && this.travel(s, dt)) {
        s.a.play('hit');
        this.hitDummy(0);
      }
      return this.allDone();
    }
    if (first) {
      const l = this.spawn('', 0, 1.25, 0, S);
      if (!l) return true;
      l.a.play(m);
    }
    const tome = this.live.find((x) => x.key === '');
    if (m === 'attack' && tome && tome.a.modeT >= 1.15 && !this.d.cast) {
      this.d.cast = 1;
      tome.a.nodePoint('book', 0, 5, 0, v2);
      for (let i = 0; i < 3; i++) {
        const s = this.spawn('star', v2.x, v2.y, v2.z, 1.3);
        if (!s) continue;
        s.from = v2.clone();
        s.to = this.dummyHead(i, new THREE.Vector3()).setY(0.55);
        s.mid = s.from.clone().lerp(s.to, 0.3).setY(5.5 + i * 0.4);
        s.dur = 1.0 + i * 0.15;
        s.dummy = i;
      }
    }
    for (const s of this.live) {
      if (s.key !== 'star' || s.a.mode === 'hit') continue;
      if (this.travel(s, dt)) {
        s.a.play('hit');
        this.hitDummy(s.dummy ?? 0);
      }
    }
    return this.allDone(T > 2);
  }

  private demoSpark(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'destroy') {
      if (first) this.spawn('', 0, 1.15, 0, S)?.a.play('destroy');
      return this.allDone();
    }
    if (m === 'hit') {
      if (first) {
        const to = this.dummyHead(0, new THREE.Vector3());
        const l = this.spawn('', to.x - 1.4, to.y + 0.2, to.z + 1, S);
        if (l) {
          l.from = l.a.pos.clone();
          l.to = to;
          l.dur = 0.3;
          l.a.target.copy(l.from);
        }
      }
      const l = this.live[0];
      if (l && l.a.mode !== 'hit' && this.travel(l, dt)) {
        l.a.play('hit');
        this.hitDummy(0);
      }
      return this.allDone();
    }
    // attack / chain: hops from the centre through all four posts
    const order = [0, 2, 1, 3];
    const HOP = 0.32;
    if (first) {
      const l = this.spawn('', 0, 1.1, 0.4, S);
      if (!l) return true;
      l.a.play('chain');
      this.d.hop = -1;
    }
    const l = this.live[0];
    if (!l) return true;
    if (l.a.mode === 'destroy') return l.a.finished;
    const hop = Math.floor(T / HOP);
    if (hop < order.length) {
      if (hop !== this.d.hop) {
        this.d.hop = hop;
        l.from = l.a.pos.clone();
        l.a.target.copy(l.from);
        l.to = this.dummyHead(order[hop], new THREE.Vector3());
        l.mid = l.from.clone().lerp(l.to, 0.5).add(new THREE.Vector3(0, 0.5, 0));
        l.t = 0;
        l.dur = HOP * 0.8;
        this.d.arrived = 0;
      }
      if (this.travel(l, dt) && !this.d.arrived) {
        this.d.arrived = 1;
        l.a.s.hop = 1;
        this.hitDummy(order[hop]);
      }
    } else if (T > order.length * HOP + 0.35) l.a.play('destroy');
    return false;
  }

  private demoFamiliar(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (first) {
      const start = m === 'return' ? this.dummyHead(0, new THREE.Vector3()).add(new THREE.Vector3(-0.3, 0, 0.5)) : new THREE.Vector3(1.2, 1.2, 0);
      const l = this.spawn('', start.x, start.y, start.z, S);
      if (!l) return true;
      if (m === 'destroy') {
        l.a.facing = 'fixed';
        l.a.play('destroy');
      }
      if (m === 'hit') {
        this.dummyHead(0, l.a.pos).add(new THREE.Vector3(-0.35, 0.05, 0.55));
        l.a.place(l.a.pos.x, l.a.pos.y, l.a.pos.z);
        l.a.facing = 'aim';
        this.dummyHead(0, l.a.aim).sub(l.a.pos).normalize();
      }
      if (m === 'return') {
        l.a.play('return');
        this.d.phase = 3;
      }
    }
    const l = this.live[0];
    if (!l) return true;
    const a = l.a;
    if (m === 'destroy') return a.finished;
    if (m === 'hit') {
      // two bites
      const n = T < 0.05 ? 0 : T > 0.75 && !this.d.b2 ? 1 : -1;
      if (n === 0 && !this.d.b1) {
        this.d.b1 = 1;
        a.play('hit');
        this.hitDummy(0, 0.7);
      } else if (n === 1) {
        this.d.b2 = 1;
        a.play('hit');
        this.hitDummy(0, 0.7);
      }
      return T > 1.6;
    }
    // attack: orbit → dash → bite → return to orbit (return alone starts at the post)
    const orbit = (ang: number, out: THREE.Vector3) => out.set(Math.cos(ang) * 1.2, 1.2 + Math.sin(ang * 2) * 0.25, Math.sin(ang) * 1.2);
    const phase = this.d.phase ?? 0;
    if (phase === 0) {
      this.d.ang = (this.d.ang ?? 0) + dt * 2.2;
      orbit(this.d.ang, a.pos);
      a.facing = 'velocity';
      if (T > 0.9) {
        this.d.phase = 1;
        a.play('attack');
        l.from = a.pos.clone();
        l.to = this.dummyHead(0, new THREE.Vector3()).add(new THREE.Vector3(-0.25, 0, 0.35));
        l.t = 0;
        l.dur = 0.55;
      }
    } else if (phase === 1) {
      a.facing = 'aim';
      this.dummyHead(0, a.aim).sub(a.pos);
      if (a.aim.lengthSq() > 1e-4) a.aim.normalize();
      if (this.travel(l, dt)) {
        this.d.phase = 2;
        this.d.p2 = T;
        a.play('hit');
        this.hitDummy(0);
      }
    } else if (phase === 2) {
      a.pos.y = l.to!.y + Math.sin((T - this.d.p2) * 6) * 0.05;
      if (T - this.d.p2 > 0.7) {
        this.d.phase = 3;
        a.play('return');
      }
    }
    if (this.d.phase === 3) {
      if (!this.d.retFrom) {
        this.d.retFrom = 1;
        l.from = a.pos.clone();
        l.to = orbit(0, new THREE.Vector3());
        l.mid = l.from.clone().lerp(l.to, 0.5).add(new THREE.Vector3(0, 1.1, 0));
        l.t = 0;
        l.dur = 0.95;
        a.facing = 'velocity';
      }
      if (this.travel(l, dt)) {
        this.d.ang = (this.d.ang2 = (this.d.ang2 ?? 0) + dt * 2.2);
        orbit(this.d.ang2, a.pos);
        if (!this.d.end) this.d.end = T;
        return T - this.d.end > 0.8;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- the rest of the arsenal
  /** Daggers, arcane bolts, frost shards, arrows and siege bolts: launched, fly, hit the posts. */
  private demoMissile(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    const b = this.behavior;
    if (m === 'destroy') {
      if (first) {
        const l = this.spawn('', -2.2, 1.2, 0.6, S);
        if (l) {
          l.from = l.a.pos.clone();
          l.to = new THREE.Vector3(0.6, 1.25, -0.2);
          l.dur = 0.55;
        }
      }
      const l = this.live[0];
      if (l && l.a.mode === 'fly' && this.travel(l, dt)) l.a.play('destroy');
      return this.allDone(T > 0.6);
    }
    if (m === 'hit') {
      if (first) {
        const to = this.dummyHead(0, new THREE.Vector3());
        const l = this.spawn('', to.x - 1.3, to.y + 0.1, to.z + 1.1, S);
        if (l) {
          l.from = l.a.pos.clone();
          l.to = to;
          l.dur = 0.22;
          l.dummy = 0;
        }
      }
    } else if (m === 'attack') {
      // a volley: each shot leaves the centre and flies at its own post (radial: all four)
      const n = b === 'radial' ? 4 : b === 'directional' ? 3 : 2;
      const gap = b === 'radial' ? 0 : 0.14;
      for (let i = 0; i < n; i++) {
        if (this.d['s' + i] || T < i * gap) continue;
        this.d['s' + i] = 1;
        const di = b === 'radial' ? i : b === 'directional' ? 0 : i;
        const to = this.dummyHead(di, new THREE.Vector3());
        if (b === 'directional') to.y += (i - 1) * 0.12;
        const l = this.spawn('', 0, 1.05, 0, S);
        if (!l) continue;
        l.a.play('attack');
        l.from = new THREE.Vector3(0, 1.05, 0);
        l.to = to;
        // homing bolts curve in; the rest fly straight
        if (b === 'bolt') l.mid = l.from.clone().lerp(to, 0.5).add(new THREE.Vector3((i ? -1 : 1) * 1.4, 0.8, 0.6));
        l.dur = (l.from.distanceTo(to) / l.a.def.flightSpeed) * (b === 'bolt' ? 1.4 : 1);
        l.dummy = di;
      }
    }
    for (const l of this.live) {
      if (l.a.mode === 'hit' || l.a.mode === 'destroy' || !l.to) continue;
      if (l.a.mode === 'attack' && l.a.finished) l.a.play('fly');
      if (this.travel(l, dt)) {
        l.a.play('hit');
        this.hitDummy(l.dummy ?? 0);
      }
    }
    return this.allDone(T > 0.6);
  }

  /** Moon Glaive: flies out through a post and comes back. */
  private demoGlaive(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m !== 'attack') return this.demoMissile(m, T, dt, first, S);
    if (first) {
      const l = this.spawn('', 0, 1.0, 0, S);
      if (!l) return true;
      l.a.play('attack');
      l.from = new THREE.Vector3(0, 1.0, 0);
      l.to = this.dummyHead(0, new THREE.Vector3()).add(new THREE.Vector3(0.8, 0, -0.6));
      l.mid = l.from.clone().lerp(l.to, 0.5).add(new THREE.Vector3(-1.2, 0.2, -0.6));
      l.dur = 0.75;
    }
    const l = this.live[0];
    if (!l) return true;
    if (l.a.mode === 'attack' && l.a.finished) l.a.play('fly');
    if (!this.d.hit1 && T > 0.55) {
      this.d.hit1 = 1;
      this.hitDummy(0);
    }
    if (this.travel(l, dt)) {
      if (!this.d.back) {
        // swing round and come home on the other side
        this.d.back = 1;
        l.from = l.a.pos.clone();
        l.to = new THREE.Vector3(0, 1.0, 0);
        l.mid = l.from.clone().lerp(l.to, 0.5).add(new THREE.Vector3(1.4, 0.2, 1));
        l.t = 0;
        l.dur = 0.8;
      } else if (!this.d.end) {
        this.d.end = 1;
        l.a.play('destroy');
      }
    }
    return this.allDone(!!this.d.end);
  }

  /** Whirling Saws: orbit the centre and cut through the posts. */
  private demoSaw(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'hit') {
      if (first) {
        const to = this.dummyHead(0, new THREE.Vector3()).setY(0.85);
        const l = this.spawn('', to.x, to.y, to.z, S);
        l?.a.play('hit');
        this.hitDummy(0);
      }
      return this.allDone();
    }
    const n = m === 'attack' ? 2 : 1;
    if (first) for (let i = 0; i < n; i++) this.spawn('', 0, 0.85, 0, S)!.a.play(m === 'attack' ? 'attack' : 'fly');
    const R = 2.45;
    this.live.forEach((l, i) => {
      if (l.a.mode === 'destroy') return;
      if (l.a.mode === 'attack' && l.a.finished) l.a.play('fly');
      const ang = T * 2.6 + (i / n) * Math.PI * 2;
      const r = Math.min(R, T * 4);
      l.a.pos.set(Math.cos(ang) * r, 0.85, Math.sin(ang) * r);
      // cut every post it passes
      this.dummies.forEach((dm, k) => {
        const key = 'cut' + i + k;
        if (Math.hypot(dm.x - l.a.pos.x, dm.z - l.a.pos.z) < 0.6) {
          if (!this.d[key]) {
            this.d[key] = 1;
            this.hitDummy(k);
          }
        } else this.d[key] = 0;
      });
    });
    const end = m === 'destroy' ? 0.9 : 3;
    if (T > end && !this.d.end) {
      this.d.end = 1;
      for (const l of this.live) l.a.play('destroy');
    }
    return this.allDone(!!this.d.end);
  }

  /** Guardian Wisp: hovers and fires spirit sparks at the posts. */
  private demoWisp(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    if (m === 'destroy') {
      if (first) this.spawn('', 0, 1.35, 0, S)?.a.play('destroy');
      return this.allDone();
    }
    if (m === 'hit') {
      if (first) {
        const to = this.dummyHead(0, new THREE.Vector3());
        const l = this.spawn('wispshot', to.x - 1.2, to.y + 0.2, to.z + 1, 1.6);
        if (l) {
          l.from = l.a.pos.clone();
          l.to = to;
          l.dur = 0.2;
          l.dummy = 0;
        }
      }
    } else if (first) {
      const w = this.spawn('', 0, 1.35, 0, S);
      if (w) w.a.facing = 'aim';
    }
    const w = this.live.find((l) => l.key === '');
    if (w && m === 'attack') {
      const shot = Math.floor((T - 0.2) / 0.55);
      const di = Math.max(0, shot) % 3;
      this.dummyHead(di, w.a.aim).sub(w.a.pos).normalize();
      if (shot >= 0 && shot < 3 && !this.d['w' + shot]) {
        this.d['w' + shot] = 1;
        w.a.play('attack');
        const to = this.dummyHead(di, new THREE.Vector3());
        const l = this.spawn('wispshot', w.a.pos.x, w.a.pos.y, w.a.pos.z, 1.6);
        if (l) {
          l.from = w.a.pos.clone();
          l.to = to;
          l.dur = l.from.distanceTo(to) / 6;
          l.dummy = di;
        }
      }
      if (w.a.mode === 'attack' && w.a.finished) w.a.play('fly');
    }
    for (const l of this.live) {
      if (l.key !== 'wispshot' || l.a.mode === 'hit') continue;
      if (this.travel(l, dt)) {
        l.a.play('hit');
        this.hitDummy(l.dummy ?? 0);
      }
    }
    if (m === 'attack') return T > 2.2 && this.live.every((l) => l.key === '' || l.a.finished);
    return this.allDone(T > 0.3);
  }

  /** Powder Keg: lobbed, lands, the fuse burns down, blast. */
  private demoBomb(m: WeaponAnim, T: number, dt: number, first: boolean, S: number): boolean {
    const land = new THREE.Vector3(DUMMY_AT[0][0] - 0.7, 0.32, DUMMY_AT[0][1] + 0.6);
    if (first) {
      const from = m === 'attack' ? new THREE.Vector3(0, 1.1, 0) : land.clone();
      const l = this.spawn('', from.x, from.y, from.z, S);
      if (!l) return true;
      if (m === 'attack') {
        l.from = from;
        l.to = land;
        l.mid = from.clone().lerp(land, 0.5).add(new THREE.Vector3(0, 2.6, 0));
        l.dur = 0.9;
      } else l.a.play(m === 'hit' ? 'hit' : 'destroy');
      if (m === 'hit') this.blast(land, 2.4);
    }
    const l = this.live[0];
    if (!l) return true;
    if (m === 'attack' && l.to && !this.d.landed && this.travel(l, dt)) {
      this.d.landed = 1;
      l.a.play('attack');
    }
    if (m === 'attack' && l.a.mode === 'attack' && l.a.finished) {
      l.a.play('hit');
      this.blast(l.a.pos, 2.4);
    }
    return this.allDone(m !== 'attack' || this.d.landed === 1);
  }

  /** Rune Trap: planted, armed, a post comes too close, blast. */
  private demoMine(m: WeaponAnim, T: number, _dt: number, first: boolean, S: number): boolean {
    const at = new THREE.Vector3(DUMMY_AT[0][0] - 0.8, 0.03, DUMMY_AT[0][1] + 0.7);
    if (first) {
      const l = this.spawn('', at.x, at.y, at.z, S);
      if (!l) return true;
      l.a.facing = 'fixed';
      l.a.play(m === 'attack' ? 'attack' : m);
      if (m === 'hit') this.blast(at, 2.2);
    }
    const l = this.live[0];
    if (!l) return true;
    if (m === 'attack' && l.a.mode === 'attack' && l.a.finished && T > 1.6) {
      l.a.play('hit');
      this.blast(at, 2.2);
    }
    return this.allDone(m !== 'attack' || T > 1.7);
  }

  /** Hits every post within a radius of a point. */
  private blast(p: THREE.Vector3, r: number) {
    this.dummies.forEach((dm, i) => {
      if (Math.hypot(dm.x - p.x, dm.z - p.z) < r) this.hitDummy(i);
    });
  }

  /** Rune Blade, Spirit Fists and Sky Lance: the spectral weapon appears and strikes a post. */
  private demoMelee(m: WeaponAnim, T: number, _dt: number, first: boolean, S: number): boolean {
    const b = this.behavior;
    const head = this.dummyHead(0, new THREE.Vector3());
    // stand the weapon a step short of the post, facing it
    const dir = head.clone().setY(0).normalize();
    const reach = b === 'lance' ? 2.4 : b === 'slash' ? 1.25 : 1.1;
    const base = head.clone().addScaledVector(dir, -reach).setY(b === 'fists' ? 0.95 : 0.9);
    const n = b === 'fists' && m === 'attack' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      if (this.d['m' + i] || T < i * 0.16 || (!first && i === 0)) continue;
      this.d['m' + i] = 1;
      const off = b === 'fists' ? (i - 1) * 0.35 : 0;
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const l = this.spawn('', base.x + side.x * off, base.y + (i === 1 ? 0.2 : 0), base.z + side.z * off, S);
      if (!l) continue;
      l.a.facing = 'aim';
      l.a.aim.copy(dir);
      l.a.s.arc = 140;
      l.a.target.copy(head);
      l.a.play(m === 'attack' ? 'attack' : m);
    }
    const hitAt = m === 'attack' ? (b === 'slash' ? 0.25 : b === 'lance' ? 0.26 : 0.15) : 0.02;
    for (let i = 0; i < n; i++) {
      const k = 'h' + i;
      if (!this.d[k] && m !== 'destroy' && T > hitAt + i * 0.16) {
        this.d[k] = 1;
        this.hitDummy(0, i % 2 ? -1 : 1);
      }
    }
    return this.allDone(T > 0.3) && T > 0.9;
  }

  /** Prism Ray: charges and burns a beam into a post. */
  private demoPrism(m: WeaponAnim, T: number, _dt: number, first: boolean, S: number): boolean {
    if (first) {
      const l = this.spawn('', 0, 1.4, 0, S);
      if (!l) return true;
      l.a.s.beam = 1;
      this.dummyHead(0, l.a.target);
      l.a.play(m);
    }
    const l = this.live[0];
    if (!l) return true;
    if (m === 'attack') {
      const p = T / l.a.def.attackTime;
      const tick = Math.floor(T / 0.15);
      if (p > 0.3 && p < 0.88 && this.d.tick !== tick) {
        this.d.tick = tick;
        this.hitDummy(0, 0.5);
      }
    } else if (m === 'hit' && first) this.hitDummy(0);
    return l.a.finished;
  }

  /** Sanctified Halo and Pulse Heart: a wave rolls out and strikes every post. */
  private demoPulse(m: WeaponAnim, T: number, _dt: number, first: boolean, S: number): boolean {
    const b = this.behavior;
    if (first) {
      const l = this.spawn('', 0, REST_Y[b] ?? 1.3, 0, S);
      if (!l) return true;
      l.a.facing = 'fixed';
      l.a.s.radius = 3.2;
      l.a.play(m);
      if (m === 'hit') this.blast(new THREE.Vector3(), 9);
    }
    const l = this.live[0];
    if (!l) return true;
    const hitT = l.a.def.attackTime * (b === 'nova' ? 0.6 : 0.55);
    if (m === 'attack' && !this.d.hit && T > hitT) {
      this.d.hit = 1;
      this.blast(new THREE.Vector3(), 9);
    }
    return l.a.finished && T > 0.5;
  }

  /** True when every live object has finished (finished hits/destroys are removed; idle ones don't count). */
  private allDone(ready = true): boolean {
    if (!ready) return false;
    let busy = false;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      const oneShot = l.a.mode === 'hit' || l.a.mode === 'destroy' || l.a.mode === 'shatter';
      if (oneShot && l.a.finished) this.kill(l);
      else if (!l.a.finished && l.a.mode !== 'idle') busy = true;
    }
    return !busy;
  }

  // ---------------------------------------------------------------- input / camera / loop
  zoomBy(f: number) {
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * f));
  }

  resetView() {
    this.yaw = 0;
    this.yawVel = 0;
    this.pitch = 0.42;
    this.dist = 6.4;
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
        this.yaw -= dx * k;
        const now = performance.now();
        const dtm = Math.max(1, now - lastMove);
        lastMove = now;
        this.yawVel = (-dx * k) / (dtm / 1000);
        this.pitch = Math.min(1.35, Math.max(-0.05, this.pitch + dy * 0.006));
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
    this.time += adt;
    if (Math.abs(this.yawVel) > 0.01) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-4 * dt);
    }
    // camera orbits the stage centre
    const k = 1 - Math.exp(-10 * dt);
    this.yawNow += (this.yaw - this.yawNow) * k;
    this.distNow += (this.dist - this.distNow) * k;
    this.pitchNow += (this.pitch - this.pitchNow) * k;
    const ty = 0.9;
    const cp = Math.cos(this.pitchNow);
    this.camera.position.set(Math.sin(this.yawNow) * cp * this.distNow, ty + Math.sin(this.pitchNow) * this.distNow, Math.cos(this.yawNow) * cp * this.distNow);
    this.camera.lookAt(0, ty, 0);
    this.camera.updateMatrixWorld();

    this.lights.begin();
    if (this.holdT >= 0) {
      this.holdT += adt;
      if (this.holdT > 0.7) {
        if (this.loop) this.play(this.mode);
        else this.play('idle');
      }
    } else if (this.demo(adt)) this.holdT = 0;
    for (const l of this.live) l.a.update(adt, this.camera, this.port);
    // target posts wobble when hit
    this.dummies.forEach((dm, i) => {
      dm.hit = Math.max(0, dm.hit - adt * 2.2);
      const w = dm.hit * (this.d['hd' + i] ?? 1);
      dm.m.pose('head', Math.sin(this.time * 34) * 0.18 * w, 0, Math.sin(this.time * 27) * 0.3 * w);
      dm.m.pose('post', -w * 0.12, 0, 0);
      dm.m.glow.value = w;
    });
    this.lights.end(adt, 0, 0);
    this.particles.update(adt, 0, 0, 0, this.yawNow);
    this.gl.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    for (const l of this.live) l.a.dispose();
    for (const d of this.dummies) d.m.dispose();
    this.blockTex.dispose();
    this.blobTex.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
    });
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.canvas.remove();
  }
}
