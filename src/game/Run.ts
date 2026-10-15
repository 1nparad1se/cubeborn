import { PROG } from '../config/progression';
import type { CharSave } from '../meta/Characters';
import { DayNight } from './DayNight';
import type { DayPeriod } from '../config/dayNight';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import type { HeroDef, MapDef } from '../data/types';
import { Allies } from './Allies';
import { Combat } from './Combat';
import { Effects } from './Effects';
import { EnemyManager } from './EnemyManager';
import { Player } from './Player';
import { MobWorld } from './MobWorld';
import { Projectiles } from './Projectiles';
import { RunStats } from './RunStats';
import { resolveStats, sumMods } from './Stats';
import type { Terrain } from './Terrain';
import type { FxSink } from './types';
import { Vfx } from './Vfx';
import { ActionSystem, makeControls } from './action/ActionSystem';
import { SPAWN, buildGreenvale } from './map/greenvale';

export type RunState = 'playing' | 'dead';

export interface RunEvents extends Record<string, unknown> {
  banner: string;
  dayPeriod: DayPeriod;
  /** The hero fell and came back at the spawn point. */
  respawn: void;
  /** A bestiary creature was met (aggro or kill): its id. */
  meet: string;
}

export interface RunOptions {
  map: MapDef;
  hero: HeroDef;
  fx: FxSink;
  settings: { damageNumbers: boolean; dayLength?: number };
  tr: (key: string) => string;
  /** The character played: level, experience, skills, position (a copy; App writes results back). */
  char?: CharSave | null;
}

/** The terrain is built once per page: the world never changes. */
let terrainCache: { id: string; terrain: Terrain } | null = null;
function worldTerrain(map: MapDef): Terrain {
  if (terrainCache?.id !== map.id) terrainCache = { id: map.id, terrain: buildGreenvale(map) };
  return terrainCache.terrain;
}

/** A play session in the persistent world: owns every gameplay system and advances the simulation. */
export class Run {
  readonly map: MapDef;
  readonly hero: HeroDef;
  readonly rng = new Rng((Math.random() * 1e9) | 0);
  readonly fx: FxSink;
  readonly terrain: Terrain;
  readonly events = new EventBus<RunEvents>();
  readonly stats = new RunStats();
  readonly player: Player;
  /** Combat targets (the world has no creatures yet; skills hit whatever is placed here). */
  readonly enemies: EnemyManager;
  /** The creatures of the map: camps, AI and respawn. */
  readonly mobs: MobWorld;
  readonly projectiles: Projectiles;
  readonly allies: Allies;
  readonly effects = new Effects();
  readonly combat: Combat;
  readonly vfx: Vfx;
  /** Action combat: class skills, combos, resource, Identity, Ultimate, summons; and the frame's controls. */
  readonly action: ActionSystem;
  readonly ctl = makeControls();
  readonly settings: { damageNumbers: boolean; dayLength?: number };
  readonly dayNight: DayNight;
  readonly tr: (key: string) => string;
  readonly weather = { darkness: 0 };

  time = 0;
  state: RunState = 'playing';
  private timers: { t: number; fn: () => void }[] = [];
  private respawnT = -1;
  // budgets let the client limit how many sounds fire per frame
  hitSoundBudget = 0;
  killSoundBudget = 0;
  xpSoundBudget = 0;

  constructor(o: RunOptions) {
    this.map = o.map;
    this.hero = o.hero;
    this.fx = o.fx;
    this.settings = o.settings;
    this.tr = o.tr;
    this.dayNight = new DayNight(this, o.settings.dayLength ?? 0);
    this.vfx = new Vfx(this);
    this.terrain = worldTerrain(o.map);
    const ch = o.char ?? null;
    const pos = ch?.pos;
    const start = pos && this.terrain.walkableAt(pos.x, pos.z) ? pos : SPAWN;
    this.player = new Player(this, start.x, start.z);
    if (ch) {
      this.player.level = ch.level;
      this.player.xp = ch.xp;
      this.player.xpNext = PROG.xpForLevel(ch.level);
    }
    this.action = new ActionSystem(this);
    if (ch) this.action.applyChar(ch);
    this.recomputeStats();
    this.player.hp = this.player.stats.maxHp;
    this.player.revivals = this.player.stats.revival;
    this.enemies = new EnemyManager(this);
    this.projectiles = new Projectiles(this);
    this.allies = new Allies(this);
    this.combat = new Combat(this);
    this.mobs = new MobWorld(this);
    this.mobs.onMeet = (id) => this.events.emit('meet', id);
  }

  /** Recomputes player stats from the class and its skills. */
  recomputeStats() {
    const p = this.player;
    const oldMax = p.stats?.maxHp ?? 0;
    const mods = sumMods(this.hero.stats, this.action.statMods());
    p.stats = resolveStats(this.hero.baseHp, mods);
    if (oldMax > 0 && p.stats.maxHp > oldMax) p.hp += p.stats.maxHp - oldMax;
  }

  later(delay: number, fn: () => void) {
    this.timers.push({ t: this.time + delay, fn });
  }

  update(dt: number, ix: number, iz: number) {
    if (this.respawnT >= 0) {
      this.respawnT -= dt;
      if (this.respawnT < 0) this.respawn();
    }
    this.time += dt;
    const p = this.player;
    if (this.weather.darkness > 0) this.weather.darkness -= dt;
    if (!p.dead) p.update(dt, ix, iz);
    this.action.update(dt, this.ctl);
    // one-shot inputs are consumed by the first sub-step
    this.ctl.casts.length = 0;
    this.ctl.click = false;
    this.ctl.dodge = false;
    this.ctl.identity = false;
    this.dayNight.update(dt);
    if (this.timers.length) {
      const now = this.time;
      const due = this.timers.filter((t) => t.t <= now);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.t > now);
        for (const t of due) t.fn();
      }
    }
    this.vfx.update(dt);
    this.mobs.update(dt);
    this.enemies.update(dt);
    this.projectiles.update(dt);
    this.allies.update(dt);
    this.effects.update(dt, p.x, p.z);
    if (p.pendingLevels > 0 && !p.dead) {
      // levels become skill points (granted in ActionSystem.onLevel): the HUD highlights upgradable slots
      p.pendingLevels = 0;
      this.fx.sound('levelup');
      this.fx.burst(p.x, 1, p.z, 0x8affff, 30, 4, 0.16, 0.8, 'glow');
      this.fx.text(p.x, p.z, this.tr('arpg_point'), 0xffe080);
    }
  }

  // ---------------------------------------------------------------- death
  /** The hero fell: a short pause, then back on their feet at the spawn point. Nothing is lost. */
  onPlayerDeath() {
    if (this.respawnT >= 0) return;
    this.state = 'dead';
    this.fx.sound('death');
    this.fx.burst(this.player.x, 1, this.player.z, this.hero.color, 50, 6, 0.2, 1.2, 'debris');
    this.fx.shake(0.6);
    this.fx.vibrate(300);
    this.respawnT = 2.5;
  }

  private respawn() {
    const p = this.player;
    p.x = SPAWN.x;
    p.z = SPAWN.z;
    p.dead = false;
    p.hp = p.stats.maxHp;
    p.invulnT = 2;
    this.state = 'playing';
    this.events.emit('respawn', undefined);
  }
}
