import * as THREE from 'three';
import { SUB_VISUALS, WEAPON_VISUALS, visualTier, type WeaponAnim, type WeaponVisualDef } from '../../config/weaponVisuals';
import type { Run } from '../../game/Run';
import type { Projectile } from '../../game/Projectiles';
import type { Ally } from '../../game/Allies';
import type { WeaponInstance } from '../../game/weapons/Weapon';
import type { LightPool } from '../LightPool';
import { WeaponActor, type FxPort } from './actor';
import { Lightning } from './fxkit';
import { strikeFx, strikeOpts } from './scripts';

/**
 * Draws the reworked weapons in a run: projectiles (fireballs, flasks, pools, tornadoes, falling
 * stars, storm clouds), the travelling Chain Spark, flying familiars and the artifacts that float
 * beside the hero and cast (Storm Rod, Starfall Tome, Cyclone Fan). Models are pooled; an object
 * that leaves the game keeps playing its hit/destroy animation as a "ghost" before it is recycled.
 */

interface Tracked {
  actor: WeaponActor;
  key: string;
  serial: number;
  seen: boolean;
  /** Animation played when the game object disappears. */
  end: WeaponAnim;
}
interface Ghost {
  actor: WeaponActor;
  key: string;
  t: number;
}
interface Artifact {
  actor: WeaponActor;
  key: string;
  fires: number;
  slot: number;
  seen: boolean;
}
interface ChainSpark {
  actor: WeaponActor;
  key: string;
  hop: number;
  arrived: boolean;
  seen: boolean;
}
interface Melee {
  actor: WeaponActor;
  key: string;
  /** Offset from the hero for strikes that follow him. */
  ox: number;
  oz: number;
  follow: boolean;
}
interface FamiliarState {
  state: string;
  attack: number;
}

/** Visual for a key: a weapon id, or 'weaponId:sub' for its secondary objects (stars, fan, puddle…). */
export function resolveVisual(key: string): WeaponVisualDef | undefined {
  const [id, sub] = key.split(':');
  if (sub) {
    const s = SUB_VISUALS[sub];
    const w = WEAPON_VISUALS[id];
    // evolutions tint their secondary objects
    return s && w ? { ...s, intensity: w.intensity, trailColor: sub === 'star' && id === 'cataclysm' ? 0xff7a2a : s.trailColor } : s;
  }
  return WEAPON_VISUALS[id];
}

/** Projectile look by its visual id; `sub` selects a secondary visual. */
const SHOT: Record<string, { sub?: string; end: WeaponAnim; spawn: WeaponAnim; facing?: 'fixed' }> = {
  fireball: { end: 'hit', spawn: 'fly' },
  flask: { end: 'shatter', spawn: 'fly' },
  pool: { sub: 'puddle', end: 'destroy', spawn: 'attack', facing: 'fixed' },
  tornado: { end: 'destroy', spawn: 'attack' },
  meteor: { sub: 'star', end: 'hit', spawn: 'fly' },
  cloud: { sub: 'stormcloud', end: 'destroy', spawn: 'fly', facing: 'fixed' },
  dagger: { end: 'hit', spawn: 'fly' },
  bolt: { end: 'hit', spawn: 'fly' },
  shard: { end: 'hit', spawn: 'fly' },
  arrow: { end: 'hit', spawn: 'fly' },
  heavybolt: { end: 'hit', spawn: 'fly' },
  glaive: { end: 'destroy', spawn: 'fly' },
  saw: { end: 'destroy', spawn: 'attack' },
  wisp: { end: 'destroy', spawn: 'fly' },
  wispshot: { sub: 'wispshot', end: 'hit', spawn: 'fly' },
  bomb: { end: 'hit', spawn: 'fly' },
  mine: { end: 'hit', spawn: 'attack', facing: 'fixed' },
};
/** Spectral melee weapons drawn over their strike effects: the effect kind → the weapon behavior. */
const MELEE: Record<string, string> = { slash: 'slash', punch: 'fists', lance: 'lance' };
/** Model size per projectile scale (the small missiles read better a little larger). */
const SHOT_SIZE: Record<string, number> = { dagger: 1.1, bolt: 1, shard: 1.1, arrow: 1.2, heavybolt: 1.2, glaive: 1, saw: 1, wisp: 0.8, wispshot: 0.9, bomb: 0.9, mine: 0.9 };
/** Weapons whose projectiles get the new visuals. */
const OWNERS = new Set(Object.keys(WEAPON_VISUALS));
/** Artifacts beside the hero: offset (world) per weapon base id. */
const ARTIFACT: Record<string, { sub?: string; at: [number, number, number]; size: number }> = {
  storm_rod: { at: [0.95, 1.75, 0.2], size: 0.62 },
  tempest_crown: { at: [0.95, 1.75, 0.2], size: 0.62 },
  starfall_tome: { at: [-0.95, 1.95, 0.15], size: 0.62 },
  cataclysm: { at: [-0.95, 1.95, 0.15], size: 0.62 },
  cyclone_fan: { sub: 'fan', at: [0, 2.35, -0.7], size: 0.7 },
  hurricane_eye: { sub: 'fan', at: [0, 2.35, -0.7], size: 0.7 },
  prism_ray: { at: [0.9, 1.25, -0.5], size: 0.5 },
  rainbow_lattice: { at: [0.9, 1.25, -0.5], size: 0.5 },
  sanctified_halo: { at: [0, 2.3, 0.05], size: 0.55 },
  sanctum: { at: [0, 2.3, 0.05], size: 0.55 },
  pulse_heart: { at: [-0.9, 1.2, -0.5], size: 0.5 },
  resonance: { at: [-0.9, 1.2, -0.5], size: 0.5 },
};
/** How long before firing the tome starts opening (its cast lands on the shot). */
const TOME_LEAD = 1.15;
const FROM = new THREE.Vector3();
const TO = new THREE.Vector3();
const HZ = new THREE.Vector3();
const ROD_LEAD = 0.9;
const MAX_ACTORS = 90;

export class WeaponVisualSystem {
  readonly group = new THREE.Group();
  private pool = new Map<string, WeaponActor[]>();
  private shots = new Map<Projectile, Tracked>();
  private flyers = new Map<Ally, Tracked & { fam: FamiliarState }>();
  private chains = new Map<number, ChainSpark>();
  private artifacts = new Map<WeaponInstance, Artifact>();
  private ghosts: Ghost[] = [];
  /** Storm Rod strikes: effect → its seed when first seen, so a pooled effect is never replayed. */
  private strikes = new Map<object, number>();
  /** Melee strike effects already given a spectral weapon (effect → seed). */
  private meleeSeen = new Map<object, number>();
  private melees: Melee[] = [];
  private bolts: Lightning[] = [];
  private live = 0;
  private port: FxPort;
  private camX = 0;
  private camZ = 0;

  constructor(
    scene: THREE.Object3D,
    private run: Run,
    private lights: LightPool,
  ) {
    scene.add(this.group);
    const self = this;
    this.port = {
      emit(x, y, z, l, dx, dz, mul) {
        run.fx.emit(x, y, z, l, dx, dz, mul);
      },
      light(x, y, z, color, intensity, radius) {
        self.lights.request(x, y, z, color, intensity * 0.45, radius, self.camX, self.camZ);
      },
      quality: 2,
    };
  }

  /** True when this projectile is drawn here (the voxel renderer skips it). */
  handles(p: Projectile): boolean {
    return this.shots.has(p);
  }
  handlesAlly(a: Ally): boolean {
    return a.fly && this.flyers.has(a);
  }

  private acquire(key: string, tier: number): WeaponActor | null {
    const list = this.pool.get(key);
    let a = list?.pop();
    if (!a) {
      if (this.live >= MAX_ACTORS) return null;
      const def = resolveVisual(key);
      if (!def) return null;
      a = new WeaponActor(def, this.group, tier);
      this.live++;
    }
    a.reset(tier);
    return a;
  }

  private release(key: string, a: WeaponActor) {
    a.setVisible(false);
    let list = this.pool.get(key);
    if (!list) this.pool.set(key, (list = []));
    list.push(a);
  }

  private ghost(key: string, a: WeaponActor, anim: WeaponAnim) {
    a.play(anim);
    this.ghosts.push({ actor: a, key, t: 0 });
  }

  update(dt: number, camera: THREE.Camera, camX: number, camZ: number) {
    this.camX = camX;
    this.camZ = camZ;
    const lv = this.run.fx.level();
    this.port.quality = lv < 0 ? 0 : lv;
    this.updateShots();
    this.updateChains();
    this.updateFlyers();
    this.updateArtifacts(dt);
    this.updateStrikes(camera);
    this.updateMelee();
    const port = this.port;
    for (const b of this.bolts) b.update(dt, camera);
    strikeFx(this.bolts, port, [0.35, 0.65, 1][port.quality]);
    for (const t of this.shots.values()) t.actor.update(dt, camera, port);
    for (const c of this.chains.values()) c.actor.update(dt, camera, port);
    for (const f of this.flyers.values()) f.actor.update(dt, camera, port);
    for (const a of this.artifacts.values()) a.actor.update(dt, camera, port);
    const pl = this.run.player;
    for (let i = this.melees.length - 1; i >= 0; i--) {
      const m = this.melees[i];
      if (m.follow) m.actor.pos.set(pl.x + m.ox, m.actor.pos.y, pl.z + m.oz);
      m.actor.update(dt, camera, port);
      if (m.actor.finished) {
        this.release(m.key, m.actor);
        this.melees.splice(i, 1);
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      g.actor.update(dt, camera, port);
      if (g.actor.finished || g.t > 3) {
        this.release(g.key, g.actor);
        this.ghosts.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- projectiles
  private updateShots() {
    for (const t of this.shots.values()) t.seen = false;
    for (const p of this.run.projectiles.list) {
      if (!p.active) continue;
      const look = SHOT[p.vis];
      const w = p.owner;
      if (!look || !w || !OWNERS.has(w.def.id)) continue;
      let t = this.shots.get(p);
      if (t && t.serial !== p.serial) {
        // the pooled projectile was reused for a new shot
        this.ghost(t.key, t.actor, t.end);
        this.shots.delete(p);
        t = undefined;
      }
      if (!t) {
        const key = look.sub ? w.def.id + ':' + look.sub : w.def.id;
        const actor = this.acquire(key, visualTier(w.level, w.maxLevel, !!w.def.evolved));
        if (!actor) continue;
        actor.facing = look.facing ?? 'velocity';
        actor.place(p.x, this.shotY(p), p.z);
        if (p.vis === 'mine') actor.s.armed = 0;
        actor.play(look.spawn);
        t = { actor, key, serial: p.serial, seen: true, end: look.end };
        this.shots.set(p, t);
      }
      t.seen = true;
      const a = t.actor;
      a.pos.set(p.x, this.shotY(p), p.z);
      a.size = p.vis === 'pool' ? p.radius : p.vis === 'meteor' ? p.scale * 0.85 : p.vis === 'cloud' ? 1.1 : p.scale * (SHOT_SIZE[p.vis] ?? 1);
      if (p.vis === 'mine') {
        // armed once it has settled; a mine that runs out quietly sinks instead of blowing up
        a.s.armed = p.age > 0.5 ? 1 : 0;
        t.end = p.a > 0 ? 'hit' : 'destroy';
        continue;
      }
      if (p.vis === 'bomb') {
        // lands, then the fuse burns down until the blast
        if (p.y <= 0.31 && a.mode === 'fly') a.play('attack');
        continue;
      }
      if ((a.mode === 'attack' && a.finished) || a.mode === 'idle') a.play('fly');
    }
    for (const [p, t] of this.shots) {
      if (t.seen) continue;
      this.ghost(t.key, t.actor, t.end);
      this.shots.delete(p);
    }
  }

  private shotY(p: Projectile): number {
    if (p.vis === 'tornado') return 0.02;
    if (p.vis === 'pool' || p.vis === 'mine') return 0.03;
    return p.y;
  }

  // ---------------------------------------------------------------- storm rod strikes
  private updateStrikes(camera: THREE.Camera) {
    for (const [e, seed] of this.strikes) if (!(e as { active: boolean }).active || (e as { seed: number }).seed !== seed) this.strikes.delete(e);
    let rod: WeaponInstance | undefined;
    for (const w of this.run.weapons.list) if (w.def.behavior === 'strike') rod = w;
    const tier = rod ? visualTier(rod.level, rod.maxLevel, !!rod.def.evolved) : 1;
    for (const e of this.run.effects.list) {
      if (!e.active || e.kind !== 'strike' || this.strikes.get(e) === e.seed) continue;
      this.strikes.set(e, e.seed);
      let b = this.bolts.find((x) => !x.alive);
      if (!b) {
        if (this.bolts.length >= 12) continue;
        b = new Lightning();
        this.group.add(b.mesh);
        this.bolts.push(b);
      }
      TO.set(e.x, 0.05, e.z);
      if (e.y > 0) FROM.set(e.x2, e.y, e.z2);
      else {
        // from high up and a little beyond the target, so the channel stretches across the screen
        HZ.set(e.x - camera.position.x, 0, e.z - camera.position.z).normalize();
        const side = (Math.random() - 0.5) * 3;
        FROM.set(e.x + HZ.x * 3 - HZ.z * side, 12 + Math.random() * 2, e.z + HZ.z * 3 + HZ.x * side);
      }
      b.strike(FROM, TO, strikeOpts(tier));
    }
  }

  // ---------------------------------------------------------------- spectral melee
  private updateMelee() {
    for (const [e, seed] of this.meleeSeen) if (!(e as { active: boolean }).active || (e as { seed: number }).seed !== seed) this.meleeSeen.delete(e);
    const pl = this.run.player;
    for (const e of this.run.effects.list) {
      const beh = MELEE[e.kind];
      if (!e.active || !beh || this.meleeSeen.get(e) === e.seed) continue;
      this.meleeSeen.set(e, e.seed);
      const w = this.run.weapons.list.find((x) => x.def.behavior === beh);
      if (!w || !OWNERS.has(w.def.id)) continue;
      const a = this.acquire(w.def.id, visualTier(w.level, w.maxLevel, !!w.def.evolved));
      if (!a) continue;
      const dx = Math.cos(e.angle);
      const dz = Math.sin(e.angle);
      let x = e.x;
      let z = e.z;
      let y = 0.95;
      if (beh === 'slash') a.size = Math.max(0.9, e.r * 0.42);
      else if (beh === 'lance') {
        a.size = 0.9 + Math.min(1, e.r / 12) * 0.4;
        x += dx * 0.4;
        z += dz * 0.4;
      } else {
        // the fist strikes the punch point from a step behind it
        a.size = Math.max(0.6, e.r * 0.75);
        x -= dx * 0.9;
        z -= dz * 0.9;
        y = 0.85;
      }
      a.place(x, y, z);
      a.facing = 'aim';
      a.aim.set(dx, 0, dz);
      a.s.arc = (Math.min(Math.PI * 2, e.arc || 2.3) * 180) / Math.PI;
      a.target.set(e.x + dx * (e.r || 1), 0.8, e.z + dz * (e.r || 1));
      a.play('attack');
      this.melees.push({ actor: a, key: w.def.id, ox: x - pl.x, oz: z - pl.z, follow: e.follow });
    }
  }

  // ---------------------------------------------------------------- chain spark
  private updateChains() {
    for (const c of this.chains.values()) c.seen = false;
    let chainW: WeaponInstance | undefined;
    for (const w of this.run.weapons.list) if (w.def.behavior === 'chain') chainW = w;
    // latest hop of every chain
    const latest = new Map<number, (typeof this.run.effects.list)[number]>();
    for (const e of this.run.effects.list) {
      if (!e.active || e.kind !== 'spark') continue;
      const cur = latest.get(e.r);
      if (!cur || e.r2 > cur.r2) latest.set(e.r, e);
    }
    for (const [id, e] of latest) {
      let c = this.chains.get(id);
      if (!c) {
        const key = chainW?.def.id ?? 'chain_spark';
        const actor = this.acquire(key, chainW ? visualTier(chainW.level, chainW.maxLevel, !!chainW.def.evolved) : 1);
        if (!actor) continue;
        actor.place(e.x, e.y, e.z);
        actor.play('chain');
        actor.size = e.arc ? 0.7 : 1;
        c = { actor, key, hop: -1, arrived: false, seen: true };
        this.chains.set(id, c);
      }
      c.seen = true;
      const a = c.actor;
      if (e.r2 !== c.hop) {
        c.hop = e.r2;
        c.arrived = false;
        a.target.set(e.x, e.y, e.z);
      }
      const k = Math.min(1, (e.maxLife - e.life) / Math.max(0.01, e.w));
      a.pos.set(e.x + (e.x2 - e.x) * k, e.y + Math.sin(k * Math.PI) * 0.45, e.z + (e.z2 - e.z) * k);
      if (k >= 1 && !c.arrived) {
        c.arrived = true;
        a.s.hop = 1;
      }
    }
    for (const [id, c] of this.chains) {
      if (c.seen) continue;
      this.ghost(c.key, c.actor, 'destroy');
      this.chains.delete(id);
    }
  }

  // ---------------------------------------------------------------- familiars
  private updateFlyers() {
    for (const f of this.flyers.values()) f.seen = false;
    for (const al of this.run.allies.list) {
      if (!al.active || !al.fly) continue;
      let f = this.flyers.get(al);
      if (f && f.serial !== al.serial) {
        this.ghost(f.key, f.actor, 'destroy');
        this.flyers.delete(al);
        f = undefined;
      }
      if (!f) {
        const w = this.run.weapons.list.find((x) => x.source === al.group);
        const key = w?.def.id ?? 'bone_familiars';
        const actor = this.acquire(key, w ? visualTier(w.level, w.maxLevel, !!w.def.evolved) : 1);
        if (!actor) continue;
        actor.place(al.x, al.y, al.z);
        actor.play('fly');
        f = { actor, key, serial: al.serial, seen: true, end: 'destroy', fam: { state: al.state, attack: 0 } };
        this.flyers.set(al, f);
      }
      f.seen = true;
      const a = f.actor;
      a.pos.set(al.x, al.y, al.z);
      a.size = al.scale;
      const st = f.fam;
      if (al.state !== st.state) {
        if (al.state === 'dash') a.play('attack');
        else if (al.state === 'return') a.play('return');
        st.state = al.state;
      }
      if (al.attack > st.attack + 0.05) a.play('hit');
      st.attack = al.attack;
      if (a.finished && a.mode !== 'fly') a.play('fly');
      const tg = al.target;
      if ((al.state === 'dash' || al.state === 'bite') && tg && tg.alive) {
        a.facing = 'aim';
        a.aim.set(tg.x - al.x, 0.6 - al.y, tg.z - al.z);
        if (a.aim.lengthSq() < 1e-4) a.aim.set(0, 0, 1);
        a.aim.normalize();
      } else a.facing = 'velocity';
    }
    for (const [al, f] of this.flyers) {
      if (f.seen) continue;
      this.ghost(f.key, f.actor, 'destroy');
      this.flyers.delete(al);
    }
  }

  // ---------------------------------------------------------------- artifacts beside the hero
  private updateArtifacts(dt: number) {
    for (const a of this.artifacts.values()) a.seen = false;
    const pl = this.run.player;
    let slot = 0;
    for (const w of this.run.weapons.list) {
      const spec = ARTIFACT[w.def.id];
      if (!spec) continue;
      let art = this.artifacts.get(w);
      const tier = visualTier(w.level, w.maxLevel, !!w.def.evolved);
      if (!art) {
        const key = spec.sub ? w.def.id + ':' + spec.sub : w.def.id;
        const actor = this.acquire(key, tier);
        if (!actor) continue;
        actor.place(pl.x + spec.at[0], pl.jumpY + spec.at[1], pl.z + spec.at[2]);
        actor.play('idle');
        art = { actor, key, fires: w.fires, slot, seen: true };
        this.artifacts.set(w, art);
      }
      art.seen = true;
      slot++;
      const a = art.actor;
      a.setTier(tier);
      a.size = spec.size;
      // floats after the hero with a little lag, which also gives it a sense of weight
      const k = 1 - Math.exp(-6 * dt);
      a.pos.x += (pl.x + spec.at[0] - a.pos.x) * k;
      a.pos.y += (pl.jumpY + spec.at[1] - a.pos.y) * k;
      a.pos.z += (pl.z + spec.at[2] - a.pos.z) * k;
      const cd = w.cooldown(this.run);
      const fired = w.fires !== art.fires;
      art.fires = w.fires;
      const base = w.def.behavior;
      if (base === 'strike') {
        a.charge = a.mode === 'attack' ? a.charge : cd > ROD_LEAD + 0.4 ? Math.max(0, 1 - w.cdT / ROD_LEAD) : 0;
        if (fired) a.play('attack');
      } else if (base === 'meteor') {
        // open the book ahead of time so the stars leave it on the shot
        if (a.mode !== 'attack' && cd > TOME_LEAD + 0.5 && w.cdT > 0 && w.cdT <= TOME_LEAD) {
          a.play('attack');
          a.modeT = TOME_LEAD - w.cdT;
        } else if (fired && a.mode !== 'attack') {
          a.play('attack');
          a.modeT = TOME_LEAD - 0.05;
        }
      } else if (base === 'tornado' && fired) {
        // face where the newest tornado heads
        let dir: Projectile | null = null;
        for (const p of this.run.projectiles.list) if (p.active && p.owner === w && p.vis === 'tornado' && p.age < 0.05) dir = p;
        if (dir && (dir.vx || dir.vz)) a.aim.set(dir.vx, 0, dir.vz).normalize();
        else a.aim.set(pl.fx, 0, pl.fz).normalize();
        a.facing = 'aim';
        a.play('attack');
      }
      else if (base === 'beam' && fired) {
        // the voxel beam is the ray; the prism flares and throws it
        a.s.beam = 0;
        a.play('attack');
      } else if (base === 'aura' && fired) {
        a.s.radius = w.p('radius', 2.2) * w.area(this.run);
        // the game already draws the aura ring: the wave is a light accent over it
        a.s.waveK = 0.35;
        a.play('attack');
      } else if (base === 'nova' && fired) {
        a.s.radius = w.p('radius', 5) * w.area(this.run);
        a.s.waveK = 0.3;
        a.play('attack');
      }
      if (a.finished && a.mode !== 'idle') a.play('idle');
      if (base === 'tornado' && a.mode === 'idle') {
        a.facing = 'aim';
        a.aim.lerp(new THREE.Vector3(0, 0, 1), Math.min(1, dt * 2)).normalize();
      }
      a.velGiven = false;
    }
    for (const [w, art] of this.artifacts) {
      if (art.seen) continue;
      this.release(art.key, art.actor);
      this.artifacts.delete(w);
    }
  }

  dispose() {
    const all: WeaponActor[] = [];
    for (const l of this.pool.values()) all.push(...l);
    for (const t of this.shots.values()) all.push(t.actor);
    for (const t of this.flyers.values()) all.push(t.actor);
    for (const c of this.chains.values()) all.push(c.actor);
    for (const a of this.artifacts.values()) all.push(a.actor);
    for (const m of this.melees) all.push(m.actor);
    for (const g of this.ghosts) all.push(g.actor);
    for (const a of all) a.dispose();
    for (const b of this.bolts) b.dispose();
    this.group.removeFromParent();
  }
}
