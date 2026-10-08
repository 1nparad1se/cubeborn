import { DayNight } from './DayNight';
import type { DayPeriod } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import type { DifficultyDef, HeroDef, MapDef, StatMods } from '../data/types';
import { WEAPON_BY_ID } from '../data/weapons';
import { PASSIVE_BY_ID } from '../data/passives';
import { modelMainColor } from '../models';
import { Allies } from './Allies';
import type { BossController } from './bosses/Boss';
import { Combat } from './Combat';
import { Effects } from './Effects';
import { EnemyManager } from './EnemyManager';
import { Hazards } from './Hazards';
import { Leveling, Passives, type Choice } from './Leveling';
import { generateTerrain } from './mapgen/generators';
import { NavField } from './NavField';
import { Perks } from './Perks';
import { Pickups } from './Pickups';
import { Player } from './Player';
import { Projectiles } from './Projectiles';
import { RunStats } from './RunStats';
import { Spawner } from './Spawner';
import { resolveStats, sumMods } from './Stats';
import type { Terrain } from './Terrain';
import { makeDamage, type FxSink } from './types';
import { Vfx } from './Vfx';
import { WeaponSystem, type WeaponInstance } from './weapons/Weapon';
import { WaveDirector, type RunMode, type Wave, type WaveScale } from './Waves';
import { MapFeatures } from './MapFeatures';
import { RARITIES, type Rarity } from '../data/types';
import './weapons/behaviors';
import { SkillSystem, makeControls } from './arpg/Skills';
import { Loot, type GearSave } from './arpg/Loot';

export type RunState = 'playing' | 'levelup' | 'chest' | 'dead' | 'victory';

export interface ChestReward {
  kind: 'evolution' | 'weapon_up' | 'passive_up' | 'gold';
  id: string;
  level: number;
  from?: string;
}

export type ChestSource = 'elite' | 'boss' | 'event' | 'secret' | 'treasure';

export interface ChestData {
  rewards: ChestReward[];
  gold: number;
  tier: number;
  rarity: Rarity;
}

export interface RunEvents extends Record<string, unknown> {
  levelup: Choice[];
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
  evolution: string;
}

export interface RunOptions {
  map: MapDef;
  diff: DifficultyDef;
  hero: HeroDef;
  permanent: StatMods;
  unlockedWeapons: Set<string>;
  unlockedPassives: Set<string>;
  fx: FxSink;
  settings: { damageNumbers: boolean; dayLength?: number };
  tr: (key: string) => string;
  seed?: number;
  mode?: RunMode;
  /** Saved equipment and bag. */
  gear?: GearSave | null;
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
  readonly weapons: WeaponSystem;
  readonly passives = new Passives();
  readonly leveling: Leveling;
  readonly spawner: Spawner;
  readonly perks: Perks;
  /** Action-RPG hero abilities and the frame's mouse/keyboard controls. */
  readonly skills: SkillSystem;
  readonly ctl = makeControls();
  readonly loot: Loot;
  readonly bosses: BossController[] = [];
  readonly unlockedWeapons: Set<string>;
  readonly unlockedPassives: Set<string>;
  readonly settings: { damageNumbers: boolean; dayLength?: number };
  readonly dayNight: DayNight;
  readonly tr: (key: string) => string;
  readonly weather = { darkness: 0, blizzard: 0, surge: 0, storm: 0 };
  readonly mode: RunMode;
  readonly waves: WaveDirector;
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
  pendingChoices: Choice[] | null = null;
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
    this.seed = o.seed ?? ((Math.random() * 1e9) | 0);
    this.rng = new Rng(this.seed);
    this.fx = o.fx;
    this.settings = o.settings;
    this.tr = o.tr;
    this.permanent = o.permanent;
    this.unlockedWeapons = o.unlockedWeapons;
    this.unlockedPassives = o.unlockedPassives;
    this.unlockedWeapons.add(o.hero.startWeapon);
    this.mode = o.mode ?? 'campaign';
    this.waves = new WaveDirector(this, this.mode);
    this.dayNight = new DayNight(this, o.settings.dayLength ?? 0);
    this.vfx = new Vfx(this);
    this.waveScale = this.waves.scale();
    this.terrain = generateTerrain(o.map, this.seed);
    this.nav = new NavField(this.terrain);
    const c = Math.floor(o.map.size / 2) + 0.5;
    this.player = new Player(this, c, c);
    this.skills = new SkillSystem(this);
    this.loot = new Loot(this, o.gear ?? null);
    this.recomputeStats();
    this.player.hp = this.player.stats.maxHp;
    this.player.revivals = this.player.stats.revival;
    this.enemies = new EnemyManager(this);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.hazards = new Hazards(this);
    this.allies = new Allies(this);
    this.combat = new Combat(this);
    this.weapons = new WeaponSystem(this);
    this.leveling = new Leveling(this);
    this.leveling.initCounters();
    this.spawner = new Spawner(this);
    // class mechanics replace the old auto-battler perks
    this.perks = new Perks(this, 'none');
    this.features = new MapFeatures(this);
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
    const mods = sumMods(this.hero.stats, this.permanent, this.passives.mods(), this.skills.statMods(), this.loot.totals.mods, this.devMods);
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
    this.skills.update(dt, this.ctl);
    // one-shot inputs are consumed by the first sub-step
    this.ctl.casts.length = 0;
    this.ctl.click = false;
    this.ctl.dodge = false;
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
    if (!p.dead) {
      this.spawner.update(dt);
      this.features.update(dt);
      this.weapons.update(dt);
      this.perks.update(dt);
    }
    this.enemies.update(dt);
    this.projectiles.update(dt);
    this.allies.update(dt);
    this.hazards.update(dt);
    this.pickups.update(dt);
    this.loot.update(dt);
    this.effects.update(dt, p.x, p.z);
    this.stats.maxedWeapons = Math.max(this.stats.maxedWeapons, this.weapons.list.filter((w) => w.isMax).length);
    if (p.pendingLevels > 0 && this.state === 'playing' && !p.dead && this.endTimer < 0) this.beginLevelUp();
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

  // ---------------------------------------------------------------- level up
  private beginLevelUp() {
    this.state = 'levelup';
    this.pendingChoices = this.skills.rollChoices();
    this.fx.sound('levelup');
    this.fx.burst(this.player.x, 1, this.player.z, 0x8affff, 30, 4, 0.16, 0.8, 'glow');
    this.events.emit('levelup', this.pendingChoices);
  }

  choose(c: Choice | null) {
    if (this.state !== 'levelup') return;
    if (c && !this.skills.apply(c)) {
      // declining the Ultimate keeps the level: offer the regular choices
      this.pendingChoices = this.skills.rollChoices();
      this.events.emit('levelup', this.pendingChoices);
      return;
    }
    if (c) this.stats.discovered.add(c.id);
    this.player.pendingLevels--;
    this.pendingChoices = null;
    this.state = 'playing';
    if (this.player.pendingLevels > 0) this.beginLevelUp();
  }

  reroll(): Choice[] | null {
    if (this.leveling.rerolls <= 0 || this.state !== 'levelup') return null;
    this.leveling.rerolls--;
    this.pendingChoices = this.skills.rollChoices();
    return this.pendingChoices;
  }

  skip() {
    if (this.leveling.skips <= 0) return;
    this.leveling.skips--;
    this.stats.gold += 1;
    this.choose(null);
  }

  banish(id: string): Choice[] | null {
    if (this.leveling.banishes <= 0 || this.state !== 'levelup') return null;
    this.leveling.banishes--;
    this.leveling.banished.add(id);
    this.pendingChoices = this.skills.rollChoices();
    return this.pendingChoices;
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

  /** Opens a chest: rarer chests hold more upgrades, more gold and heal more. */
  openChest(tier: number, rarityIdx = 0) {
    const rewards: ChestReward[] = [];
    const rarity = RARITIES[Math.max(0, Math.min(4, rarityIdx))];
    const count = [1, 2, 3, 4, 5][rarityIdx] ?? 1;
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const evo = this.weapons.evolvable().find((w) => !used.has(w.def.id));
      if (evo) {
        used.add(evo.def.id);
        const nw = this.weapons.evolve(evo) as WeaponInstance;
        rewards.push({ kind: 'evolution', id: nw.def.id, level: 1, from: evo.def.id });
        this.stats.evolutions.push(nw.def.id);
        this.stats.discovered.add(nw.def.id);
        this.events.emit('evolution', nw.def.id);
        continue;
      }
      const ups: ChestReward[] = [];
      for (const w of this.weapons.list) if (!w.isMax && !w.def.evolved) ups.push({ kind: 'weapon_up', id: w.def.id, level: w.level + 1 });
      for (const [id, lvl] of this.passives.levels) if (lvl < PASSIVE_BY_ID[id].maxLevel) ups.push({ kind: 'passive_up', id, level: lvl + 1 });
      if (ups.length) {
        const pick = this.rng.pick(ups);
        if (pick.kind === 'weapon_up') this.weapons.get(pick.id)!.levelUp();
        else {
          this.passives.add(pick.id);
          this.recomputeStats();
        }
        rewards.push(pick);
      } else rewards.push({ kind: 'gold', id: 'gold', level: 0 });
    }
    const baseGold = [3, 5, 8, 12, 20][rarityIdx] ?? 3;
    const gold = Math.round((baseGold + this.rng.int(0, 3) + rewards.filter((x) => x.kind === 'gold').length * 5) * this.player.stats.greed);
    this.stats.gold += gold;
    this.stats.chests++;
    this.stats.chestRarity[rarityIdx]++;
    this.player.heal(this.player.stats.maxHp * (0.1 + rarityIdx * 0.05) * this.perks.healMul(), true);
    this.state = 'chest';
    this.fx.sound('chestOpen');
    this.events.emit('chest', { rewards, gold, tier, rarity });
  }

  closeChest() {
    if (this.state === 'chest') this.state = 'playing';
  }

  // ---------------------------------------------------------------- ending
  onPlayerDeath() {
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
      weapons: this.weapons.list.map((w) => ({ id: w.def.id, level: w.level, damage: Math.round(this.stats.damageBy[w.def.id] ?? 0) })),
      passives: [...this.passives.levels.entries()].map(([id, level]) => ({ id, level })),
      victory: this.state === 'victory' || this.endState === 'victory',
      mode: this.mode,
      wave: this.waves.wave.n,
      damageTaken: Math.round(this.stats.damageTaken),
      chestRarity: [...this.stats.chestRarity],
      bosses: [...this.stats.bossesKilled],
      evolutions: [...this.stats.evolutions],
      elites: this.stats.elites,
      chests: this.stats.chests,
      maxedWeapons: this.stats.maxedWeapons,
      weaponCount: this.weapons.list.length,
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

  weaponName(id: string) {
    return WEAPON_BY_ID[id]?.name;
  }
}
