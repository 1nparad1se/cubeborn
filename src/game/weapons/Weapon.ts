import type { WeaponDef, WeaponStats } from '../../data/types';
import { WEAPON_BY_ID, WEAPON_MAX_LEVEL } from '../../data/weapons';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../Projectiles';
import type { Run } from '../Run';
import { makeDamage, type DamageInfo } from '../types';

/** Code side of a weapon mechanic. One behaviour serves a base weapon and its evolution. */
export interface WeaponBehavior {
  /** Called when cooldown elapses. */
  fire(w: WeaponInstance, run: Run): void;
  /** Called every frame (persistent effects). */
  update?(w: WeaponInstance, run: Run, dt: number): void;
  onAdd?(w: WeaponInstance, run: Run): void;
  onRemove?(w: WeaponInstance, run: Run): void;
  onKill?(w: WeaponInstance, run: Run, e: Enemy): void;
  projectileUpdate?(w: WeaponInstance, run: Run, p: Projectile, dt: number): boolean;
  projectileHit?(w: WeaponInstance, run: Run, p: Projectile, e: Enemy): void;
  projectileExpire?(w: WeaponInstance, run: Run, p: Projectile): void;
}

const REGISTRY: Record<string, WeaponBehavior> = {};

export function registerBehavior(key: string, b: WeaponBehavior) {
  REGISTRY[key] = b;
}

export function getBehavior(key: string): WeaponBehavior {
  const b = REGISTRY[key];
  if (!b) throw new Error(`Unknown weapon behavior: ${key}`);
  return b;
}

/** A weapon owned by the player during a run. */
export class WeaponInstance {
  level = 1;
  stats: WeaponStats;
  cdT = 0.3;
  dmg: DamageInfo = makeDamage();
  behavior: WeaponBehavior;
  /** Behaviour scratch state. */
  state: Record<string, any> = {};
  kills = 0;
  /** Last aimed direction (set by aim() when a target was found) and when. */
  aimX = 0;
  aimZ = 1;
  aimAt = -1;

  constructor(public def: WeaponDef, public source: number) {
    this.behavior = getBehavior(def.behavior);
    this.stats = { ...def.base };
    this.refreshDamage();
  }

  get maxLevel(): number {
    return this.def.evolved ? 1 : WEAPON_MAX_LEVEL;
  }
  get isMax(): boolean {
    return this.level >= this.maxLevel;
  }
  get evo(): boolean {
    return !!this.stats.evo;
  }

  levelUp() {
    if (this.isMax) return;
    const delta = this.def.levels[this.level - 1];
    this.level++;
    if (delta) for (const k in delta) this.stats[k] = (this.stats[k] ?? 0) + (delta[k] ?? 0);
    this.refreshDamage();
  }

  refreshDamage() {
    const s = this.stats;
    const d = this.dmg;
    d.damage = s.damage;
    d.critChance = s.critChance;
    d.critDamage = s.critDamage;
    d.knockback = s.knockback;
    d.source = this.source;
    d.weaponId = this.def.id;
    d.slow = s.slow ?? 0;
    d.slowDur = s.slowDur ?? 0;
    d.freeze = s.freeze ?? 0;
    d.freezeDur = s.freezeDur ?? 1.5;
    d.poison = s.poison ?? 0;
    d.poisonDur = s.poisonDur ?? 0;
    d.burn = s.burn ?? 0;
    d.burnDur = s.burnDur ?? 0;
  }

  // ---- effective values with player modifiers
  amount(run: Run): number {
    return Math.max(1, Math.round(this.stats.amount + run.player.stats.amount));
  }
  area(run: Run): number {
    return this.stats.area * run.player.stats.area;
  }
  speed(run: Run): number {
    return this.stats.projSpeed * run.player.stats.projSpeed;
  }
  duration(run: Run): number {
    return this.stats.duration * run.player.stats.duration;
  }
  pierce(run: Run): number {
    return this.stats.pierce < 0 ? -1 : this.stats.pierce + run.player.stats.pierce;
  }
  cooldown(run: Run): number {
    const frenzy = run.player.buffs.frenzy > 0 ? 0.6 : 1;
    return Math.max(0.05, (this.stats.cooldown * run.player.stats.cooldown * frenzy) / Math.max(0.1, this.stats.attackSpeed));
  }
  p(key: string, def = 0): number {
    return this.stats[key] ?? def;
  }
}

/** Holds the player's weapons and drives them each frame. */
/** Behaviours that hit all around the hero, so the hero keeps facing the way it moves. */
const UNDIRECTED = new Set(['aura', 'nova', 'orbit', 'radial', 'summon', 'wisp', 'pool', 'mine', 'tornado']);

export class WeaponSystem {
  readonly list: WeaponInstance[] = [];
  private nextSource = 1;

  /** The hero's starting weapon and its evolution drive the hero's attack animation. */
  private heroWeapon: string;
  private heroEvolved: string;

  constructor(private run: Run) {
    this.heroWeapon = run.hero.startWeapon;
    this.heroEvolved = WEAPON_BY_ID[run.hero.startWeapon]?.evolution?.into ?? '';
  }

  has(id: string): boolean {
    return this.list.some((w) => w.def.id === id);
  }
  get(id: string): WeaponInstance | undefined {
    return this.list.find((w) => w.def.id === id);
  }

  add(id: string): WeaponInstance {
    const def = WEAPON_BY_ID[id];
    const w = new WeaponInstance(def, this.nextSource++ % 23 + 1);
    this.list.push(w);
    w.behavior.onAdd?.(w, this.run);
    this.run.stats.weaponsUsed.add(id);
    return w;
  }

  /** Replaces a maxed weapon with its evolution, keeping the slot. */
  evolve(w: WeaponInstance): WeaponInstance | null {
    const into = w.def.evolution?.into;
    if (!into) return null;
    w.behavior.onRemove?.(w, this.run);
    const def = WEAPON_BY_ID[into];
    const nw = new WeaponInstance(def, w.source);
    nw.kills = w.kills;
    const i = this.list.indexOf(w);
    this.list[i] = nw;
    nw.behavior.onAdd?.(nw, this.run);
    this.run.stats.weaponsUsed.add(into);
    return nw;
  }

  /** Weapons ready to evolve (maxed + required passive owned). */
  evolvable(): WeaponInstance[] {
    return this.list.filter((w) => w.isMax && w.def.evolution && this.run.passives.has(w.def.evolution.passive));
  }

  update(dt: number) {
    const run = this.run;
    for (const w of this.list) {
      w.behavior.update?.(w, run, dt);
      w.cdT -= dt;
      if (w.cdT <= 0) {
        w.cdT += w.cooldown(run);
        if (w.cdT < 0) w.cdT = w.cooldown(run);
        w.behavior.fire(w, run);
        if (w.def.id === this.heroWeapon || w.def.id === this.heroEvolved) this.heroAttackCue(w);
      }
    }
  }

  /**
   * Tells the renderer the hero attacked and where: the aimed target, else the nearest enemy for
   * targeted attacks; area attacks around the hero (auras, novas, orbits, summons) have no direction.
   */
  private heroAttackCue(w: WeaponInstance) {
    const run = this.run;
    const c = run.player.cues;
    c.attack++;
    c.aim = false;
    if (w.aimAt === run.time) {
      c.aimX = w.aimX;
      c.aimZ = w.aimZ;
      c.aim = true;
    } else if (!UNDIRECTED.has(w.def.behavior)) {
      const p = run.player;
      const t = run.enemies.nearest(p.x, p.z, 12);
      if (t) {
        const d = Math.hypot(t.x - p.x, t.z - p.z) || 1;
        c.aimX = (t.x - p.x) / d;
        c.aimZ = (t.z - p.z) / d;
        c.aim = true;
      }
    }
  }

  // ---- developer tools
  /** Sets a weapon's level, rebuilding it from level 1 when going down. */
  devSetLevel(id: string, level: number) {
    const w = this.get(id);
    if (!w) return;
    level = Math.max(1, Math.min(w.maxLevel, level));
    if (level < w.level) {
      w.behavior.onRemove?.(w, this.run);
      const nw = new WeaponInstance(w.def, w.source);
      nw.kills = w.kills;
      this.list[this.list.indexOf(w)] = nw;
      nw.behavior.onAdd?.(nw, this.run);
      while (nw.level < level) nw.levelUp();
    } else while (w.level < level) w.levelUp();
  }

  devRemove(id: string) {
    const w = this.get(id);
    if (!w) return;
    w.behavior.onRemove?.(w, this.run);
    this.list.splice(this.list.indexOf(w), 1);
  }

  onKill(e: Enemy) {
    for (const w of this.list) w.behavior.onKill?.(w, this.run, e);
  }

  clear() {
    for (const w of this.list) w.behavior.onRemove?.(w, this.run);
    this.list.length = 0;
  }
}
