import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { ClassDef, ClassId } from '../game/action/types';
import { ActionSystem, makeControls, SLOT_SPECIAL, SLOT_ULT, type Controls } from '../game/action/ActionSystem';
import { classDef } from '../game/action/classes';
import { makeDamage, type DamageInfo, type FxSink } from '../game/types';
import { PROJECTILE_MODELS } from '../models';
import { SUMMON_MODELS } from '../models/summons';
import type { VoxelModel } from '../data/types';
import { ActionFxRenderer, type FxBatches } from './ActionFxRenderer';
import { InstancedBatch } from './InstancedBatch';
import { LightPool } from './LightPool';
import { makeGlowMaterial, makeVoxelMaterial } from './Materials';
import { Particles } from './Particles';
import { makeBlobTexture, makeBlockTexture, makeCreatureTexture } from './Textures';
import { buildVoxelGeometry } from './VoxelGeometry';
import { getSkinMaterial, packAnim, skinOf } from './creatureSkins';

/** What a demo plays: a skill slot (0..7), the basic chain, dodge, identity (Z), special (X) or the ultimate (V). */
export type DemoAction = { k: 'skill'; slot: number } | { k: 'basic' } | { k: 'dodge' } | { k: 'identity' } | { k: 'special' } | { k: 'ult' };

/** The sandboxed hero the viewer draws its rig from. */
export interface SandboxHero {
  x: number;
  z: number;
  fx: number;
  fz: number;
  vx: number;
  vz: number;
  jumpY: number;
  invulnT: number;
}

interface DemoProj {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  life: number;
  age: number;
  vis: string;
  color: number;
  dmg: DamageInfo;
  pierce: number;
  radius: number;
  scale: number;
  glow: number;
  hitEvery: number;
  homing: number;
  hook: { hit?: (p: DemoProj) => void; expire?: (p: DemoProj) => void } | null;
}

/** Projectiles that leave a light ribbon behind them (same table as the game renderer). */
const TRAIL_VIS = new Set(['arrow', 'bigarrow', 'firearrow', 'markarrow', 'heavybolt', 'spear', 'frostlance', 'dagger', 'shard', 'wispbolt', 'wispshot', 'shadowblade', 'crescent', 'palm', 'fistwave', 'arcanebolt', 'spiritorb']);

/** A callable that swallows any call or property read: stands in for run members the demo does not model. */
const NOOP: any = new Proxy(function () {}, { get: () => NOOP, apply: () => undefined });
function soft<T extends object>(o: T): T {
  return new Proxy(o, {
    get(t, k, r) {
      if (typeof k === 'symbol' || k in t) return Reflect.get(t, k, r);
      return NOOP;
    },
  });
}

function flatPlane(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}
function flatRing(inner: number, seg = 40): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(inner, 1, seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Isolated skill playground for the Character Viewer. A real ActionSystem plays the class
 * scripts against a fake, empty Run (no enemies, debug infinite resource / no cooldowns,
 * damage goes nowhere), and the real ActionFxRenderer, Particles and summon / projectile
 * models draw the result inside the viewer's own scene. Nothing here touches the profile,
 * the save or a running game: the sandbox owns every object it creates and disposes them.
 */
export class SkillSandbox {
  readonly group = new THREE.Group();
  readonly cls: ClassDef;
  readonly hero: SandboxHero;
  action!: ActionSystem;
  private run!: Run;
  private ctl: Controls = makeControls();
  private time = 0;
  private later: { t: number; fn: () => void }[] = [];
  private projs: DemoProj[] = [];
  private blobTex = makeBlobTexture();
  private blockTex = makeBlockTexture();
  private creatureTex = makeCreatureTexture();
  private voxMat = makeVoxelMaterial({ map: this.creatureTex, instanced: true });
  private batches: FxBatches & { all: InstancedBatch[] };
  private models = new Map<string, { b: InstancedBatch; skinned: boolean }>();
  private actFx!: ActionFxRenderer;
  private particles: Particles;
  private lights: LightPool;
  private floor: THREE.Group;
  private aimMark: THREE.Mesh;
  /** Demo script state. */
  private queue: DemoAction[] = [];
  private cur: DemoAction | null = null;
  private curT = 0;
  private reqs = 0;
  private lastReq = 0;
  private pressCd = 0;
  private idleT = 0;
  /** Demo finished (everything settled). */
  done = true;
  /** Where the demo aims (local stage coordinates). */
  aimX = 0;
  aimZ = -6;
  /** Camera focus and radius that frame the demo. */
  focusX = 0;
  focusZ = -3;
  extent = 6;
  shake = 0;
  onSound: ((id: string) => void) | null = null;

  constructor(readonly classId: ClassId) {
    this.cls = classDef(classId);
    this.hero = { x: 0, z: 0, fx: 0, fz: -1, vx: 0, vz: 0, jumpY: 0, invulnT: 0 };
    const g = this.group;
    // demo floor: a dark arena disc with a grid and range rings
    this.floor = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshLambertMaterial({ color: 0x262a33, transparent: true, opacity: 0.92 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.13;
    disc.receiveShadow = true;
    const grid = new THREE.GridHelper(32, 32, 0x4a5262, 0x353b47);
    grid.position.y = -0.12;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.floor.add(disc, grid);
    g.add(this.floor);
    this.aimMark = new THREE.Mesh(flatRing(0.8, 32), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.5, depthWrite: false }));
    this.aimMark.scale.setScalar(0.6);
    this.aimMark.position.y = 0.02;
    g.add(this.aimMark);
    // glow batches identical to the EntityRenderer's
    const glowMat = makeGlowMaterial();
    const glowTopMat = makeGlowMaterial(undefined, false);
    const softMat = makeGlowMaterial(this.blobTex);
    const darkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.blobTex, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true });
    const glowBox = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), glowMat, g, 128);
    const glowBoxTop = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), glowTopMat, g, 64);
    const glowDisc = new InstancedBatch(flatPlane(), softMat, g, 64);
    const glowRing = new InstancedBatch(flatRing(0.84), glowMat, g, 64);
    const glowRingThin = new InstancedBatch(flatRing(0.93), glowMat, g, 64);
    const glowPlane = new InstancedBatch(flatPlane(), glowMat, g, 128);
    const darkDisc = new InstancedBatch(flatPlane(), darkMat, g, 16);
    for (const b of [glowBox, glowDisc, glowRing, glowRingThin, glowPlane]) b.mesh.renderOrder = 5;
    glowBoxTop.mesh.renderOrder = 6;
    this.batches = {
      glowBox, glowBoxTop, glowDisc, glowRing, glowRingThin, glowPlane, darkDisc,
      all: [glowBox, glowBoxTop, glowDisc, glowRing, glowRingThin, glowPlane, darkDisc],
      segment(x1, y1, z1, x2, y2, z2, w, c, a) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dy, dz);
        glowBoxTop.push((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, Math.atan2(dx, dz), w, w, len, c, 0, 0, -Math.atan2(dy, Math.hypot(dx, dz)), a);
      },
    };
    // Particles and LightPool only call add() on their parent: the stage group keeps them in local space
    this.particles = new Particles(g as unknown as THREE.Scene, this.blockTex, this.blobTex, 'medium', 'motes', 0xffffff);
    this.particles.ambientOn = false;
    this.lights = new LightPool(g as unknown as THREE.Scene, 4);
    this.reset();
  }

  /** Fresh hero, action system and effects (replay / back to idle). */
  reset() {
    this.later = [];
    this.projs = [];
    this.time = 0;
    this.particles.clear();
    Object.assign(this.hero, { x: 0, z: 0, fx: 0, fz: -1, vx: 0, vz: 0, jumpY: 0, invulnT: 0 });
    this.run = this.makeRun();
    this.action = new ActionSystem(this.run);
    (this.run as unknown as { action: ActionSystem }).action = this.action;
    this.action.devUnlockAll();
    this.action.fillResource();
    this.actFx = this.actFx ?? new ActionFxRenderer(this.run, this.batches, this.lights);
    // the fx renderer keeps a reference to its run: point it at the new one
    (this.actFx as unknown as { run: Run }).run = this.run;
    this.ctl = makeControls();
    this.queue = [];
    this.cur = null;
    this.done = true;
    this.shake = 0;
  }

  /** Fake Run: just enough of the game for ActionSystem, Summons and ActionFxRenderer. */
  private makeRun(): Run {
    const self = this;
    const h = this.hero;
    const player = soft({
      get x() {
        return h.x;
      },
      set x(v: number) {
        h.x = v;
      },
      get z() {
        return h.z;
      },
      set z(v: number) {
        h.z = v;
      },
      get fx() {
        return h.fx;
      },
      set fx(v: number) {
        h.fx = v;
      },
      get fz() {
        return h.fz;
      },
      set fz(v: number) {
        h.fz = v;
      },
      get jumpY() {
        return h.jumpY;
      },
      set jumpY(v: number) {
        h.jumpY = v;
      },
      get invulnT() {
        return h.invulnT;
      },
      set invulnT(v: number) {
        h.invulnT = v;
      },
      vx: 0,
      vz: 0,
      dead: false,
      level: 30,
      moving: false,
      moveDirX: 0,
      moveDirZ: 0,
      radius: 0.45,
      hp: 100,
      cues: { attack: 0, ability: 0, hit: 0, hitX: 0, hitZ: 0 },
      stats: soft({ maxHp: 100, duration: 1, cooldown: 1, area: 1, damage: 1, speed: 1 } as Record<string, number>),
      slide(dx: number, dz: number) {
        h.x += dx;
        h.z += dz;
      },
      cancelJump() {},
      clearPath() {},
      heal() {},
    });
    const fx: FxSink = {
      burst: (x, y, z, color, count, speed, size, life, kind) => this.particles.burst(x, y, z, color, count, speed, size, life, kind),
      number() {},
      text() {},
      shake: (a) => (this.shake = Math.min(0.6, this.shake + a)),
      light: (x, z, color, intensity, radius, duration) => this.lights.flash(x, z, color, intensity, radius, duration),
      sound: (id) => this.onSound?.(id),
      vibrate() {},
      emit: (x, y, z, layer, dx = 0, dz = 0, mul = 1) => this.particles.emit(x, y, z, layer, dx, dz, mul),
      level: () => 2,
    };
    const run = {
      hero: { id: this.classId, color: this.cls.color, model: this.classId },
      player,
      fx,
      debug: { infRes: true, noCd: true },
      get time() {
        return self.time;
      },
      ctl: {
        get aimX() {
          return self.aimX;
        },
        get aimZ() {
          return self.aimZ;
        },
      },
      enemies: soft({ nearest: () => null, forEachInRadius() {}, randomInRadius: () => null, list: [] }),
      combat: soft({ hit() {} }),
      terrain: soft({ blocksWalker: () => false, los: () => true, height: () => 0 }),
      loot: soft({ powers: new Set<string>(), totals: soft({ resMax: 0, resRegen: 0, atkSpeed: 0, skillDmg: 0, elem: {} } as Record<string, unknown>) }),
      stats: soft({ dodges: 0, gold: 0, lastHurt: -99, skillsCast: 0 }),
      projectiles: {
        list: this.projs,
        spawn: (_o: unknown, x: number, z: number, vx: number, vz: number, life: number, vis: string, color: number) => {
          const p: DemoProj = { x, z, y: 1.1, vx, vz, life, age: 0, vis, color, dmg: makeDamage(), pierce: 0, radius: 0.3, scale: 1, glow: 0, hitEvery: 99, homing: 0, hook: null };
          this.projs.push(p);
          return p;
        },
      },
      later: (t: number, fn: () => void) => this.later.push({ t: this.time + t, fn }),
      tr: (k: string) => k,
      recomputeStats() {},
    };
    return soft(run) as unknown as Run;
  }

  /** Starts a demo (resets first so every play starts from the same spot). */
  play(list: DemoAction[]) {
    this.reset();
    // aim straight ahead, at the skill's reach (clamped to keep everything framed)
    const first = list[list.length - 1];
    const def = first.k === 'skill' ? this.cls.skills[first.slot] : first.k === 'ult' ? this.cls.ult : null;
    let reach = def ? Math.max(def.range, def.radius) : first.k === 'basic' ? 3 : 4;
    if (def) for (const s of def.steps) for (const e of s.ev) if (e.do === 'move' && e.kind !== 'back') reach = Math.max(reach, e.dist);
    const aim = Math.max(3, Math.min(8, def?.range || reach || 5));
    const summons = !!def?.steps.some((st) => st.ev.some((e) => e.do === 'summon'));
    this.aimX = 0;
    this.aimZ = -aim;
    // the camera frames the midpoint of the hero and this focus
    this.focusX = 0;
    this.focusZ = -Math.min(aim, Math.max(2, reach));
    this.extent = Math.max(summons ? 7 : 4.5, Math.min(11, Math.max(reach, aim) * 0.9 + (def?.radius ?? 1) * 0.5));
    this.queue = list.slice();
    this.next();
  }

  private next() {
    this.cur = this.queue.shift() ?? null;
    this.curT = 0;
    this.reqs = 0;
    this.lastReq = this.action.anim.n;
    this.pressCd = 0;
    this.idleT = 0;
    this.done = !this.cur;
    this.ctl.held.fill(false);
    this.ctl.attack = false;
  }

  private slotOf(a: DemoAction): number {
    return a.k === 'skill' ? a.slot : a.k === 'ult' ? SLOT_ULT : a.k === 'special' ? SLOT_SPECIAL : -1;
  }

  /** Builds this frame's input from the demo script. */
  private drive(dt: number) {
    const c = this.ctl;
    c.casts.length = 0;
    c.dodge = false;
    c.identity = false;
    c.aimX = this.aimX;
    c.aimZ = this.aimZ;
    const a = this.cur;
    if (!a) return;
    const act = this.action;
    this.curT += dt;
    this.pressCd -= dt;
    if (act.anim.n !== this.lastReq) {
      this.lastReq = act.anim.n;
      this.reqs++;
    }
    const slot = this.slotOf(a);
    const first = this.curT <= dt + 1e-6;
    let wanted = 1;
    switch (a.k) {
      case 'basic':
        wanted = this.cls.basic.steps.length;
        c.attack = this.reqs < wanted;
        break;
      case 'dodge':
        if (first) c.dodge = true;
        break;
      case 'identity':
        if (first) c.identity = true;
        break;
      default: {
        const def = act.skill(slot);
        if (def?.type === 'combo') {
          wanted = def.steps.length;
          const cur = act.cur;
          const free = !cur || (cur.slot === slot && cur.t >= (cur.step.cancel ?? cur.step.dur));
          if (this.reqs < wanted && free && this.pressCd <= 0 && !act.mover) {
            c.casts.push(slot);
            this.pressCd = 0.25;
          }
        } else if (first) c.casts.push(slot);
        if (def?.type === 'hold') c.held[slot] = this.curT < Math.min(2.4, def.holdMax ?? 2);
        else if (def?.type === 'charge') c.held[slot] = this.curT < (def.chargeMax ?? 1) + 0.05;
        else c.held[slot] = false;
      }
    }
    // the step is over once the action system is idle again
    if (this.curT > 0.3 && !act.busy && (a.k !== 'basic' || this.reqs >= wanted)) {
      this.idleT += dt;
      if (this.idleT > 0.15 || this.curT > 12) {
        c.attack = false;
        if (this.queue.length) this.next();
        else this.cur = null;
      }
    } else this.idleT = 0;
  }

  get busy(): boolean {
    return !!this.cur || this.action.busy;
  }

  /** Effects still on screen. */
  get settled(): boolean {
    return !this.busy && this.projs.length === 0 && this.action.fx.list.length === 0;
  }

  update(dt: number) {
    const h = this.hero;
    const ox = h.x;
    const oz = h.z;
    if (dt > 0) {
      this.time += dt;
      for (let i = 0; i < this.later.length; i++) {
        const l = this.later[i];
        if (l.t <= this.time) {
          this.later.splice(i--, 1);
          l.fn();
        }
      }
      this.drive(dt);
      this.action.update(dt, this.ctl);
      if (h.invulnT > 0) h.invulnT -= dt;
      this.updateProjs(dt);
      if (!this.cur && this.settled) this.done = true;
      h.vx = (h.x - ox) / dt;
      h.vz = (h.z - oz) / dt;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this.draw(dt);
  }

  private updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.age += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.life <= 0) {
        this.projs.splice(i, 1);
        p.hook?.expire?.(p);
      }
    }
  }

  private model(id: string, m: VoxelModel | undefined) {
    let e = this.models.get(id);
    if (e || !m) return e ?? null;
    const skin = skinOf(m) ? getSkinMaterial(m, { instanced: true, anim: true }) : null;
    if (skin) e = { b: new InstancedBatch(buildVoxelGeometry(m, { skin: true, anim: true }), skin, this.group, 8, true), skinned: true };
    else e = { b: new InstancedBatch(buildVoxelGeometry(m, { frame: -1 }), this.voxMat, this.group, 8, true), skinned: false };
    this.models.set(id, e);
    return e;
  }

  private draw(dt: number) {
    const B = this.batches;
    for (const b of B.all) b.begin();
    for (const m of this.models.values()) m.b.begin();
    this.lights.begin();
    const h = this.hero;
    // hero ring + soft light
    B.glowRingThin.push(h.x, 0.04, h.z, 0, 0.78, 1, 0.78, this.cls.color, 0, 0, 0, 0.55);
    this.lights.request(h.x, 2.2, h.z, 0xffe6c0, 0.55, 9, h.x, h.z);
    // aim marker
    this.aimMark.position.set(this.aimX, 0.02, this.aimZ);
    this.aimMark.visible = !!this.cur;
    // projectiles
    const t = this.time;
    for (const p of this.projs) {
      const fadeIn = Math.min(1, p.age * 12);
      const s = p.scale * (0.4 + fadeIn * 0.6);
      const yaw = p.vis === 'saw' || p.vis === 'glaive' || p.vis === 'tornado' || p.vis === 'wisp' ? t * 10 : Math.atan2(p.vx, p.vz);
      const mb = this.model('p:' + p.vis, PROJECTILE_MODELS[p.vis]);
      if (mb) mb.b.pushFast(p.x, p.y - 0.15, p.z, yaw, s, s, 1, 1, 1, 0);
      else B.glowBox.push(p.x, p.y, p.z, t * 5, 0.32 * s, 0.32 * s, 0.32 * s, p.color);
      B.glowDisc.push(p.x, 0.05, p.z, 0, 1.2 * s, 1, 1.2 * s, p.color, 0, 0, 0, 0.3);
      this.lights.request(p.x, 1, p.z, p.color, 0.8, 5, h.x, h.z);
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0.5 && TRAIL_VIS.has(p.vis)) {
        const ux = p.vx / sp;
        const uz = p.vz / sp;
        const len = Math.min(p.age * sp, 1.4 * s);
        const ry = Math.atan2(ux, uz);
        B.glowPlane.push(p.x - ux * len * 0.5, p.y, p.z - uz * len * 0.5, ry, 0.16 * s, 1, len, p.color, 0, 0, 0, 0.55 * fadeIn);
        B.glowPlane.push(p.x - ux * len * 0.35, p.y + 0.01, p.z - uz * len * 0.35, ry, 0.05 * s, 1, len * 0.7, 0xffffff, 0, 0, 0, 0.5 * fadeIn);
      }
    }
    // summons
    for (const m of this.action.summons.list) {
      if (!m.active) continue;
      const fade = Math.min(1, m.life * 2, (m.max - m.life) * 5);
      if (m.kind === 'clone') {
        const a = (0.55 + Math.sin(t * 14 + m.serial) * 0.1) * fade;
        B.glowBoxTop.push(m.x, 0.75, m.z, m.yaw, 0.55, 0.9, 0.35, 0x5a2aaa, 0, 0, 0, a);
        B.glowBoxTop.push(m.x, 1.45, m.z, m.yaw, 0.42, 0.42, 0.42, 0x7a4aff, 0, 0, 0, a);
        continue;
      }
      const mb = this.model('s:' + m.kind, SUMMON_MODELS[m.kind]);
      if (!mb) continue;
      const spec = m.kind === 'golem' ? 1.5 : m.kind === 'ancient' ? 2.2 : m.kind === 'drake' ? 1.8 : m.kind === 'serpent' ? 1.3 : m.kind === 'wisp' ? 0.6 : m.kind === 'hawk' ? 0.9 : 1;
      const s = spec * (0.4 + fade * 0.6);
      const fl = (1 - fade) * 0.6;
      if (mb.skinned) mb.b.pushFast(m.x, m.y, m.z, m.yaw, s, s, 1.05, 1.1, 1.15, packAnim(m.anim * 2.4 * Math.PI, Math.min(1, Math.hypot(m.vx, m.vz) / 1.5), fl));
      else mb.b.pushFast(m.x, m.y, m.z, m.yaw, s, s, 1.05, 1.1, 1.15, fl);
      B.glowRingThin.push(m.x, 0.04, m.z, 0, spec * 0.55, 1, spec * 0.55, this.cls.color, 0, 0, 0, 0.35 * fade);
      if (m.kind === 'wisp') B.glowDisc.push(m.x, m.y, m.z, 0, 1.2, 1, 1.2, 0x8ad8ff, 0, 0, 0, 0.6 * fade);
    }
    this.actFx.update(dt);
    for (const b of B.all) b.end();
    for (const m of this.models.values()) m.b.end();
    this.particles.update(dt, h.x, h.z, 0);
    this.lights.end(dt, h.x, h.z);
  }

  dispose() {
    // collect GPU resources first: InstancedBatch.dispose() detaches meshes from the group
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const shared = new Set<THREE.Material>();
    for (const m of this.models.values()) if (m.skinned) shared.add(m.b.mesh.material as THREE.Material);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) if (!shared.has(x)) mats.add(x);
    });
    this.particles.dispose();
    for (const m of this.models.values()) m.b.dispose();
    for (const b of this.batches.all) b.dispose();
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    this.voxMat.dispose();
    this.blobTex.dispose();
    this.blockTex.dispose();
    this.creatureTex.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
