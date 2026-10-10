import { PROG } from '../config/progression';
import type { CharSave } from '../meta/Characters';
import { DayNight } from './DayNight';
import type { DayPeriod } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import type { DifficultyDef, HeroDef, MapDef, StatMods } from '../data/types';
import { modelMainColor } from '../models';
import { Allies } from './Allies';
import type { BossController } from './bosses/Boss';
import { Combat } from './Combat';
import { Effects } from './Effects';
import { EnemyManager } from './EnemyManager';
import { Hazards } from './Hazards';
import { generateTerrain } from './mapgen/generators';
import { NavField } from './NavField';
import { Pickups } from './Pickups';
import { Player } from './Player';
import { Projectiles } from './Projectiles';
import { RunStats } from './RunStats';
import { Spawner } from './Spawner';
import { resolveStats, sumMods } from './Stats';
import type { Terrain } from './Terrain';
import { makeDamage, type FxSink } from './types';
import { Vfx } from './Vfx';
import { WaveDirector, type RunMode, type Wave, type WaveScale } from './Waves';
import { MapFeatures } from './MapFeatures';
import { RARITIES, type Rarity } from '../data/types';
import { ActionSystem, makeControls } from './action/ActionSystem';
import { Loot, type GearSave } from './arpg/Loot';
import { BossArena } from './bosses/BossArena';
import { continentWorld } from './world/continent/world';
import { World } from './world/World';
import { worldPlan } from './world/WorldGen';
import { WORLD } from '../config/world';

export type RunState = 'playing' | 'chest' | 'dead' | 'victory';

export interface ChestReward {
  kind: 'gold' | 'item' | 'heal';
  id: string;
  level: number;
}

export type ChestSource = 'elite' | 'boss' | 'event' | 'secret' | 'treasure';

export interface ChestData {
  rewards: ChestReward[];
  gold: number;
  tier: number;
  rarity: Rarity;
}

export interface RunEvents extends Record<string, unknown> {
  chest: ChestData;
  wave: Wave;
  modifier: string;
  feature: string;
  bossSpawn: BossController;
  bossPhase: BossController;
  bossDefeated: BossController;
  gameover: void;
  victory: void;
  banner: string;
  dayPeriod: DayPeriod;
  pickup: string;
  /** Open world: a good moment to write the character to the save (town, timer, respawn). */
  worldSave: void;
  /** Open world: the hero entered another area (-1 = the town). */
  zone: number;
  waystone: string;
  dungeonFound: string;
  homeSet: string;
}

/** Seed of the persistent open world (changing it reshapes the world for every player). */
export const WORLD_SEED = 20261010;

export interface RunOptions {
  map: MapDef;
  diff: DifficultyDef;
  hero: HeroDef;
  permanent: StatMods;
  fx: FxSink;
  settings: { damageNumbers: boolean; dayLength?: number };
  tr: (key: string) => string;
  seed?: number;
  mode?: RunMode;
  /** Saved equipment and bag. */
  gear?: GearSave | null;
  /** The character played: level, experience, skills (a copy; App writes results back). */
  char?: CharSave | null;
}

/** One playthrough of a map: owns every gameplay system and advances the simulation. */
export class Run {
  readonly map: MapDef;
  readonly diff: DifficultyDef;
  readonly hero: HeroDef;
  readonly rng: Rng;
  readonly seed: number;
  readonly fx: FxSink;
  readonly terrain: Terrain;
  readonly nav: NavField;
  readonly events = new EventBus<RunEvents>();
  readonly stats = new RunStats();
  readonly player: Player;
  readonly enemies: EnemyManager;
  readonly projectiles: Projectiles;
  readonly pickups: Pickups;
  readonly hazards: Hazards;
  readonly allies: Allies;
  readonly effects = new Effects();
  readonly combat: Combat;
  readonly vfx: Vfx;
  readonly spawner: Spawner;
  /** Action combat: class skills, combos, resource, Identity, Ultimate, summons; and the frame's controls. */
  readonly action: ActionSystem;
  readonly ctl = makeControls();
  readonly loot: Loot;
  readonly bosses: BossController[] = [];
  /** Boss fights happen one on one inside a pillar ring (spawns and the wave clock pause). */
  readonly arena = new BossArena(this);
  readonly settings: { damageNumbers: boolean; dayLength?: number };
  readonly dayNight: DayNight;
  readonly tr: (key: string) => string;
  readonly weather = { darkness: 0, blizzard: 0, surge: 0, storm: 0 };
  readonly mode: RunMode;
  readonly waves: WaveDirector;
  /** Monster level right now: grows through the map's range with the waves (enemy strength, item level, experience). */
  get zoneLevel(): number {
    if (this.levelCtx > 0) return this.levelCtx;
    if (this.world) return this.world.levelAt(this.player.x, this.player.z);
    return PROG.mobLevel(this.map.id, this.waves?.wave?.n ?? 1);
  }
  /** Level override while a kill's rewards are handed out or a boss is made (the monster's own level). */
  levelCtx = 0;
  /** Open world (mode 'world'): resident monsters, town, lairs. */
  readonly world: World | null = null;
  readonly features: MapFeatures;
  /** Multipliers for enemies spawned in the current wave. */
  waveScale: WaveScale;
  /** Developer-mode switches (all off in normal play). */
  readonly debug = { god: false, infHp: false, xpMul: 1, freeze: false, enemyHp: 1, enemyDmg: 1, tainted: false, infRes: false, noCd: false };
  /** Developer stat bonuses (added on top of everything). */
  readonly devMods: StatMods = {};
  readonly reviveBlast = makeDamage();
  readonly nukeBlast = makeDamage();

  time = 0;
  state: RunState = 'playing';
  /** Real-time slow motion factor (victory/death moments). */
  timeScale = 1;
  private permanent: StatMods;
  private lastRevivalStat = 0;
  private timers: { t: number; fn: () => void }[] = [];
  private endTimer = -1;
  private endState: RunState = 'playing';
  // budgets let the client limit how many sounds fire per frame
  hitSoundBudget = 0;
  killSoundBudget = 0;
  xpSoundBudget = 0;

  constructor(o: RunOptions) {
    this.map = o.map;
    this.diff = o.diff;
    this.hero = o.hero;
    // the open world is one fixed map (same terrain, town, camps every session); wave runs stay random
    this.seed = o.seed ?? (o.mode === 'world' ? WORLD_SEED : (Math.random() * 1e9) | 0);
    this.rng = new Rng(this.seed);
    this.fx = o.fx;
    this.settings = o.settings;
    this.tr = o.tr;
    this.permanent = o.permanent;
    this.mode = o.mode ?? 'campaign';
    this.waves = new WaveDirector(this, this.mode);
    this.dayNight = new DayNight(this, o.settings.dayLength ?? 0);
    this.vfx = new Vfx(this);
    this.waveScale = this.waves.scale();
    let layout = null;
    if (this.mode === 'world' && o.map.generator === 'continent') {
      // the persistent continent: the same world every session, generated once per page
      const cw = continentWorld();
      layout = cw.layout;
      this.terrain = cw.terrain;
    } else if (this.mode === 'world') {
      // one big location: the map's own generator at world size, carved into town, areas, camps and lairs
      const plan = worldPlan(o.map, this.seed, PROG.mapRange[o.map.id] ?? [1, 10]);
      layout = plan.layout;
      this.terrain = generateTerrain({ ...o.map, size: WORLD.size }, this.seed, { world: plan.hooks });
    } else this.terrain = generateTerrain(o.map, this.seed);
    this.nav = new NavField(this.terrain);
    const c = Math.floor(this.terrain.size / 2) + 0.5;
    this.player = new Player(this, c, layout ? c + 2 : c);
    if (layout?.cont) {
      const wp = o.char?.world;
      const start = layout.cont.towns.find((t) => t.def.id === (wp?.home ?? 'quietford')) ?? layout.cont.towns[0];
      const ok = (x: number, z: number) => this.terrain.walkableAt(x, z);
      if (wp?.x !== undefined && wp.z !== undefined && ok(wp.x, wp.z)) {
        this.player.x = wp.x;
        this.player.z = wp.z;
      } else {
        this.player.x = start.spawn.x;
        this.player.z = start.spawn.z;
      }
    }
    const ch = o.char ?? null;
    if (ch) {
      this.player.level = ch.level;
      this.player.xp = ch.xp;
      this.player.xpNext = PROG.xpForLevel(ch.level);
    }
    this.action = new ActionSystem(this);
    if (ch) this.action.applyChar(ch);
    this.loot = new Loot(this, o.gear ?? (ch ? { equipped: ch.equipped, bag: ch.bag } : null));
    this.recomputeStats();
    this.player.hp = this.player.stats.maxHp;
    this.player.revivals = this.player.stats.revival;
    this.enemies = new EnemyManager(this);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.hazards = new Hazards(this);
    this.allies = new Allies(this);
    this.combat = new Combat(this);
    this.spawner = new Spawner(this);
    this.features = new MapFeatures(this);
    if (layout) this.world = new World(this, layout, o.char?.world ?? null);
    this.nav.update(0, this.player.x, this.player.z, true);
    this.reviveBlast.damage = 200;
    this.reviveBlast.knockback = 4;
    this.reviveBlast.weaponId = 'revive';
    this.nukeBlast.damage = 400;
    this.nukeBlast.knockback = 2;
    this.nukeBlast.weaponId = 'nuke';
  }

  /** Recomputes player stats from hero, permanent upgrades, passives. */
  recomputeStats() {
    const p = this.player;
    const oldMax = p.stats?.maxHp ?? 0;
    const mods = sumMods(this.hero.stats, this.permanent, this.action.statMods(), this.loot.totals.mods, this.devMods);
    p.stats = resolveStats(this.hero.baseHp, mods);
    if (oldMax > 0 && p.stats.maxHp > oldMax) p.hp += p.stats.maxHp - oldMax;
    const newRev = p.stats.revival;
    if (oldMax > 0 && newRev > this.lastRevivalStat) p.revivals += newRev - this.lastRevivalStat;
    this.lastRevivalStat = newRev;
  }

  later(delay: number, fn: () => void) {
    this.timers.push({ t: this.time + delay, fn });
  }

  enemyColor(id: string): number {
    return modelMainColor(id);
  }

  spawnFallingRock(x: number, z: number, t: number, color: number) {
    const e = this.effects.add('fall', x, z, t, color);
    e.r = 1;
  }

  get isFinalPhase(): boolean {
    return this.spawner.bossSpawnedFlag;
  }

  update(dt: number, ix: number, iz: number) {
    if (this.endTimer >= 0) {
      // slow-motion ending
      this.endTimer -= dt;
      dt *= this.timeScale;
      if (this.endTimer < 0) {
        this.state = this.endState;
        this.events.emit(this.state === 'victory' ? 'victory' : 'gameover', undefined);
        return;
      }
    }
    if (this.state !== 'playing') return;
    this.time += dt;
    const p = this.player;
    for (const k of ['darkness', 'blizzard', 'surge', 'storm'] as const) if (this.weather[k] > 0) this.weather[k] -= dt;
    if (!p.dead) p.update(dt, ix, iz);
    this.action.update(dt, this.ctl);
    // one-shot inputs are consumed by the first sub-step
    this.ctl.casts.length = 0;
    this.ctl.click = false;
    this.ctl.dodge = false;
    this.ctl.identity = false;
    this.dayNight.update(dt);
    this.nav.update(dt, p.x, p.z);
    this.surgeBuff();
    // timers
    if (this.timers.length) {
      const now = this.time;
      const due = this.timers.filter((t) => t.t <= now);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.t > now);
        for (const t of due) t.fn();
      }
    }
    this.vfx.update(dt);
    if (this.world) this.world.update(dt);
    else if (!p.dead) {
      this.spawner.update(dt);
      this.features.update(dt);
    }
    this.enemies.update(dt);
    this.arena.update(dt);
    this.projectiles.update(dt);
    this.allies.update(dt);
    this.hazards.update(dt);
    this.pickups.update(dt);
    this.loot.update(dt);
    this.effects.update(dt, p.x, p.z);
    if (p.pendingLevels > 0 && !p.dead) {
      // levels become skill points (granted in ActionSystem.onLevel): the HUD highlights upgradable slots
      p.pendingLevels = 0;
      this.fx.sound('levelup');
      this.fx.burst(p.x, 1, p.z, 0x8affff, 30, 4, 0.16, 0.8, 'glow');
      this.fx.text(p.x, p.z, this.tr('arpg_point'), 0xffe080);
    }
  }

  private surgeBuff() {
    // arcane surge: standing in a rune circle empowers the hero
    if (this.weather.surge <= 0) return;
    const p = this.player;
    for (const m of this.terrain.markers) {
      if (m.kind === 'rune' && (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 9) {
        p.buffs.fury = Math.max(p.buffs.fury, 0.3);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- chests
  /** Rolls a chest rarity for a drop source; luck shifts the odds toward rarer chests. */
  rollChestRarity(source: ChestSource): number {
    const luck = this.player.stats.luck;
    const w = source === 'boss' ? [0, 0, 55, 33, 12] : source === 'secret' ? [0, 50, 32, 13, 5] : [52, 28, 13, 5, 2];
    if (this.mode === 'endless' && this.waves.wave.n > 30) w[0] *= 0.5;
    const ws = w.map((x, i) => (i === 0 ? x : x * luck));
    let r = this.rng.next() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ws.length; i++) {
      r -= ws[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  /** Opens a chest: gear drops scattered around it, gold and a heal; rarer chests hold more. */
  openChest(tier: number, rarityIdx = 0, x = this.player.x, z = this.player.z) {
    const rewards: ChestReward[] = [];
    const rarity = RARITIES[Math.max(0, Math.min(4, rarityIdx))];
    const count = [1, 2, 2, 3, 4][rarityIdx] ?? 1;
    for (let i = 0; i < count; i++) {
      const it = this.loot.dropAt(x, z, Math.max(rarityIdx, 1));
      if (it) rewards.push({ kind: 'item', id: it, level: 1 });
    }
    const baseGold = [3, 5, 8, 12, 20][rarityIdx] ?? 3;
    const gold = Math.round((baseGold + this.rng.int(0, 3)) * this.player.stats.greed);
    rewards.push({ kind: 'gold', id: 'gold', level: gold });
    this.stats.gold += gold;
    this.stats.chests++;
    this.stats.chestRarity[rarityIdx]++;
    this.player.heal(this.player.stats.maxHp * (0.1 + rarityIdx * 0.05), true);
    this.fx.sound('chestOpen');
    this.fx.burst(x, 1, z, 0xffe080, 30, 5, 0.16, 0.8, 'glow');
    this.fx.text(x, z, this.tr('act_chest'), 0xffe080);
    void tier;
    void rarity;
  }

  closeChest() {
    if (this.state === 'chest') this.state = 'playing';
  }

  // ---------------------------------------------------------------- ending
  onPlayerDeath() {
    if (this.world) return this.world.onPlayerDeath();
    if (this.endTimer >= 0) return;
    this.fx.sound('death');
    this.fx.burst(this.player.x, 1, this.player.z, this.hero.color, 50, 6, 0.2, 1.2, 'debris');
    this.fx.shake(0.6);
    this.fx.vibrate(300);
    this.endState = 'dead';
    this.endTimer = 1.6;
    this.timeScale = 0.25;
  }

  onFinalBossDefeated() {
    if (this.endTimer >= 0) return;
    this.endState = 'victory';
    this.endTimer = 2.5;
    this.timeScale = 0.3;
    this.hazards.clearAll();
    // remaining enemies flee into dust
    for (const e of this.enemies.list) if (e.alive && !e.boss) this.combat.killEnemy(e, true);
    this.fx.sound('victory');
  }

  get ending(): boolean {
    return this.endTimer >= 0;
  }

  /** Summary used by the results screen and meta progression. */
  summary() {
    const p = this.player;
    return {
      time: this.time,
      kills: this.stats.kills,
      level: p.level,
      gold: Math.round(this.stats.gold),
      weapons: [] as { id: string; level: number; damage: number }[],
      passives: [] as { id: string; level: number }[],
      victory: this.state === 'victory' || this.endState === 'victory',
      mode: this.mode,
      wave: this.waves.wave.n,
      damageTaken: Math.round(this.stats.damageTaken),
      chestRarity: [...this.stats.chestRarity],
      bosses: [...this.stats.bossesKilled],
      evolutions: [...this.stats.evolutions],
      elites: this.stats.elites,
      chests: this.stats.chests,
      maxedWeapons: 0,
      weaponCount: 0,
      treasureSprites: this.stats.treasureSprites,
      discovered: [...this.stats.discovered],
      seen: [...this.stats.seen],
    };
  }

  static goldReward(summary: ReturnType<Run['summary']>, diffReward: number): number {
    const waves = summary.mode === 'endless' ? summary.wave * BALANCE.goldPerWave : 0;
    const base = summary.gold + summary.kills * BALANCE.goldPerKill + (summary.time / 60) * BALANCE.goldPerMinute + summary.bosses.length * BALANCE.goldBossBonus + (summary.victory ? BALANCE.goldVictoryBonus : 0) + waves;
    return Math.round(base * diffReward);
  }
}
