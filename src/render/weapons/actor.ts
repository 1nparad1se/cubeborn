import * as THREE from 'three';
import type { EmitLayer } from '../../config/vfx';
import type { WeaponAnim, WeaponVisualDef } from '../../config/weaponVisuals';
import { WeaponModel } from './build';
import { MODELS } from './models';
import { ArcLine, Lightning, Ribbon, RuneCircle, type StrikeOpts } from './fxkit';
import { SCRIPTS } from './scripts';

/** Where an actor sends particles and lights: the game's particle system or the viewer's own. */
export interface FxPort {
  emit(x: number, y: number, z: number, layer: EmitLayer, dirX: number, dirZ: number, mul: number): void;
  light(x: number, y: number, z: number, color: number, intensity: number, radius: number): void;
  /** Effects detail: 0 low, 1 medium, 2 high. */
  quality: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4();
const qT = new THREE.Quaternion();
const ORIGIN = new THREE.Vector3();

/**
 * One animated weapon object: model + trail + arcs + script. The owner moves `pos` (and may give a
 * velocity); the actor turns to face its travel, spins, bobs, pulses and plays the current
 * animation through its script. Used by both the game (WeaponVisualSystem) and the viewer.
 */
export class WeaponActor {
  readonly model: WeaponModel;
  readonly ribbon: Ribbon | null;
  readonly arcs: ArcLine[] = [];
  readonly bolts: Lightning[] = [];
  circle: RuneCircle | null = null;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  /** Smoothed travel direction (unit) and speed. */
  readonly dir = new THREE.Vector3(0, 0, 1);
  speed = 0;
  /** Targets/aim for scripted attacks (world). */
  readonly aim = new THREE.Vector3(0, 0, 1);
  readonly target = new THREE.Vector3();
  mode: WeaponAnim = 'fly';
  modeT = 0;
  t = Math.random() * 10;
  /** Anticipation 0..1 (energy gathering before an attack). */
  charge = 0;
  /** Facing: follow the velocity, keep the authored orientation, or face `aim`. */
  facing: 'velocity' | 'fixed' | 'aim' = 'velocity';
  /** Root scale on top of the visual's own scale. */
  size = 1;
  /** Set by the script when a one-shot animation (hit/destroy…) has finished. */
  finished = false;
  /** Script scratch. */
  readonly s: Record<string, number> = {};
  spinAngle = 0;
  private prev = new THREE.Vector3();
  private hasPrev = false;
  private acc: Record<string, number> = {};
  /** Velocity is supplied by the owner this frame (else estimated from movement). */
  velGiven = false;

  constructor(
    readonly def: WeaponVisualDef,
    readonly world: THREE.Object3D,
    tier = 1,
  ) {
    this.model = new WeaponModel(MODELS[def.model]);
    this.model.setTier(tier);
    world.add(this.model.root);
    this.ribbon = def.trail > 0 ? new Ribbon(def.trailColor, def.trailLife, def.trail, 1) : null;
    if (this.ribbon) world.add(this.ribbon.mesh);
    SCRIPTS[def.script]?.init?.(this);
  }

  get tier(): number {
    return this.model.tier;
  }

  setTier(t: number) {
    if (t !== this.model.tier) this.model.setTier(t);
  }

  addArc(color: number, width = 0.05, jag = 0.18, segs = 7): ArcLine {
    const a = new ArcLine(color, width, jag, segs);
    this.world.add(a.mesh);
    this.arcs.push(a);
    return a;
  }

  /** Fires a natural lightning strike (reusing a finished one). */
  strike(from: THREE.Vector3, to: THREE.Vector3, o?: StrikeOpts): Lightning {
    let b = this.bolts.find((x) => !x.alive);
    if (!b) {
      b = new Lightning();
      this.world.add(b.mesh);
      this.bolts.push(b);
    }
    b.strike(from, to, o);
    return b;
  }

  addCircle(color: number, size: number): RuneCircle {
    this.circle = new RuneCircle(color, size);
    this.world.add(this.circle.mesh);
    return this.circle;
  }

  play(mode: WeaponAnim) {
    this.mode = mode;
    this.modeT = 0;
    this.finished = false;
    SCRIPTS[this.def.script]?.start?.(this, mode);
  }

  /** Makes a pooled actor fresh again (the game reuses actors instead of rebuilding models). */
  reset(tier: number) {
    this.setTier(tier);
    this.mode = 'fly';
    this.modeT = 0;
    this.charge = 0;
    this.finished = false;
    this.size = 1;
    this.speed = 0;
    this.vel.set(0, 0, 0);
    this.hasPrev = false;
    this.model.body.visible = true;
    this.model.body.scale.setScalar(1);
    this.ribbon?.reset();
    for (const a of this.arcs) a.intensity = 0;
    for (const b of this.bolts) b.stop();
    if (this.circle) this.circle.mat.opacity = 0;
    this.setVisible(true);
    SCRIPTS[this.def.script]?.start?.(this, 'fly');
  }

  setVisible(v: boolean) {
    this.model.root.visible = v;
    if (this.ribbon) this.ribbon.mesh.visible = v;
    for (const a of this.arcs) a.mesh.visible = v && a.intensity > 0.01;
    for (const b of this.bolts) b.mesh.visible = v && b.alive;
    if (this.circle) this.circle.mesh.visible = v && this.circle.mat.opacity > 0.01;
  }

  /** Teleports (no trail streak, no velocity spike). */
  place(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.prev.copy(this.pos);
    this.hasPrev = true;
    this.ribbon?.reset();
  }

  /** Emission helper: how many events of a given rate happen this frame. */
  rate(key: string, perSec: number, dt: number): number {
    const v = (this.acc[key] ?? Math.random()) + perSec * dt;
    const n = Math.floor(v);
    this.acc[key] = v - n;
    return n;
  }

  update(dt: number, camera: THREE.Camera, fx: FxPort) {
    const d = this.def;
    this.t += dt;
    this.modeT += dt;
    // velocity: given or estimated from movement
    if (!this.velGiven) {
      if (this.hasPrev && dt > 0) this.vel.subVectors(this.pos, this.prev).divideScalar(dt);
      else this.vel.set(0, 0, 0);
    }
    this.velGiven = false;
    this.prev.copy(this.pos);
    this.hasPrev = true;
    const sp = this.vel.length();
    this.speed += (sp - this.speed) * Math.min(1, dt * 10);
    if (sp > 0.05) {
      const k = Math.min(1, dt * 14);
      this.dir.lerp(this.vel.clone().divideScalar(sp), k).normalize();
    }
    const m = this.model;
    m.root.position.copy(this.pos);
    // orientation
    let look: THREE.Vector3 | null = null;
    if (this.facing === 'velocity' && this.speed > 0.1) look = this.dir;
    else if (this.facing === 'aim') look = this.aim;
    if (look && look.lengthSq() > 1e-6) {
      // slight bank keeps fast turns readable; projectiles keep their nose on the trajectory
      m4.lookAt(ORIGIN, look, Math.abs(look.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : UP);
      qT.setFromRotationMatrix(m4);
      // lookAt points -Z at the target; our models face +Z
      qT.multiply(FLIP);
      m.root.quaternion.slerp(qT, Math.min(1, dt * 16));
    }
    m.root.scale.setScalar(d.scale * this.size);
    // generic spin / bob / glow
    const spinMul = SCRIPTS[d.script]?.spinMul?.(this) ?? 1;
    this.spinAngle += d.spin * d.spinDir * dt * spinMul;
    const b = m.body;
    b.rotation.set(0, 0, 0);
    if (d.spinAxis === 'roll') b.rotation.z = this.spinAngle;
    else if (d.spinAxis === 'tumble') b.rotation.x = this.spinAngle;
    else b.rotation.y = this.spinAngle;
    b.position.set(0, (Math.sin(this.t * d.bobSpeed) * d.bob) / Math.max(0.01, m.root.scale.y), 0);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * d.pulse);
    m.glow.value = d.glow * (0.55 + 0.45 * pulse) * d.intensity + this.charge * 1.2;
    const script = SCRIPTS[d.script];
    script?.pose(this, dt, pulse);
    m.root.updateMatrixWorld(true);
    script?.fx?.(this, dt, fx, pulse);
    // trail from the object's actual centre so it never lags sideways
    if (this.ribbon) {
      const moving = this.speed > 0.4 && this.mode !== 'hit' && this.mode !== 'destroy' && this.mode !== 'shatter';
      this.ribbon.width = d.trail * this.size * (0.8 + this.tier * 0.12);
      this.ribbon.intensity = d.intensity * (0.7 + 0.1 * this.tier);
      this.ribbon.update(dt, this.trailHead(), camera, moving);
    }
    for (const a of this.arcs) a.update(dt, camera);
    for (const b of this.bolts) b.update(dt, camera);
    if (this.circle) this.circle.mesh.visible = this.circle.mat.opacity > 0.01;
  }

  private head = new THREE.Vector3();
  trailHead(): THREE.Vector3 {
    const n = this.model.nodes[SCRIPTS[this.def.script]?.trailNode ?? ''];
    if (n) return n.getWorldPosition(this.head);
    return this.head.copy(this.pos);
  }

  /** World position of a point given in a node's voxel space. */
  nodePoint(node: string, x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const n = this.model.nodes[node];
    const v = this.model.vox;
    out.set(x * v, y * v, z * v);
    return n ? n.localToWorld(out) : this.model.root.localToWorld(out);
  }

  dispose() {
    this.model.dispose();
    if (this.ribbon) {
      this.ribbon.mesh.removeFromParent();
      this.ribbon.dispose();
    }
    for (const a of this.arcs) {
      a.mesh.removeFromParent();
      a.dispose();
    }
    for (const b of this.bolts) {
      b.mesh.removeFromParent();
      b.dispose();
    }
    if (this.circle) {
      this.circle.mesh.removeFromParent();
      this.circle.dispose();
    }
  }
}

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

/** A weapon's motion script: poses nodes every frame and spawns its effects. */
export interface WeaponScript {
  init?(a: WeaponActor): void;
  start?(a: WeaponActor, mode: WeaponAnim): void;
  pose(a: WeaponActor, dt: number, pulse: number): void;
  fx?(a: WeaponActor, dt: number, fx: FxPort, pulse: number): void;
  /** Spin speed multiplier for the current state. */
  spinMul?(a: WeaponActor): number;
  /** Node whose centre the trail follows. */
  trailNode?: string;
}
