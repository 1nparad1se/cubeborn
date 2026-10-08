import type { DayPeriod } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import { HEROES } from '../data/heroes';
import { WEAPONS, WEAPON_BY_ID } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { MAPS } from '../data/maps';
import { PERM_UPGRADES } from '../data/upgrades';
import { ACHIEVEMENTS } from '../data/achievements';
import { ENEMY_BY_ID } from '../data/enemies';
import type { Profile } from '../meta/Profile';
import type { SaveData } from '../meta/Save';
import type { Run } from '../game/Run';
import type { PickupKind } from '../game/Pickups';
import type { EliteId } from '../data/enemies';
import { DEV_TOOLS_AVAILABLE } from './flags';
import { BOSSES } from '../data/bosses';
import { L, t } from '../i18n';
import { MAX_LEVEL } from '../game/arpg/kits';
import { EQUIP_POS, makeItem, slotOf, BASES, type GearSlot } from '../game/arpg/Gear';
import type { Rarity, StatKey } from '../data/types';

const wname = (id: string) => L(WEAPON_BY_ID[id]?.name) || id;

export type DevToggle = 'god' | 'infHp' | 'infXp' | 'infGold' | 'infCoins' | 'freeze' | 'infRes' | 'noCd';

/** XP multiplier used by "Infinite XP" (a true infinite would open a level-up every frame). */
export const INF_XP_MUL = 25;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Rolling counter: rate per second over the last few seconds. */
class Rate {
  private samples: { t: number; v: number }[] = [];
  value = 0;
  push(t: number, total: number, window = 5) {
    this.samples.push({ t, v: total });
    while (this.samples.length > 2 && t - this.samples[0].t > window) this.samples.shift();
    const a = this.samples[0];
    this.value = t - a.t > 0.2 ? (total - a.v) / (t - a.t) : 0;
  }
  reset() {
    this.samples.length = 0;
    this.value = 0;
  }
}

/**
 * Developer / test mode. Switching it on swaps the profile onto a disposable copy of the
 * save (only settings still reach storage), so cheats, unlocks and test runs never touch the
 * real progress. Switching it off, pressing RESET TEST STATE or reloading the page brings the
 * normal save back. Session switches (god mode, infinite resources, time scale) are applied to
 * every run started while developer mode is on.
 */
export class DevMode {
  enabled = false;
  profile: Profile | null = null;
  run: Run | null = null;
  readonly toggles: Record<DevToggle, boolean> = { god: false, infHp: false, infXp: false, infGold: false, infCoins: false, freeze: false, infRes: false, noCd: false };
  enemyHp = 1;
  enemyDmg = 1;
  timeScale = 1;
  paused = false;
  panelOpen = false;
  debugOpen = false;
  /** Short feedback line shown at the bottom of the panel. */
  message = '';
  private listeners = new Set<() => void>();
  /** Called after test data changed so menus can redraw. */
  onProfileChange: (() => void) | null = null;
  // debug info
  readonly dps = new Rate();
  readonly dtps = new Rate();
  readonly spawnRate = new Rate();
  private sampleT = 0;

  get available(): boolean {
    return DEV_TOOLS_AVAILABLE;
  }

  attach(profile: Profile) {
    this.profile = profile;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(msg?: string) {
    if (msg !== undefined) this.message = msg;
    for (const fn of this.listeners) fn();
  }

  // ---------------------------------------------------------------- mode
  setEnabled(on: boolean) {
    if (!this.available || !this.profile || on === this.enabled) return;
    const p = this.profile;
    if (on) {
      // the settings object is shared by reference across the app, so it stays the same object
      const settings = p.data.settings;
      p.testBase = clone(p.data);
      p.data = clone(p.data);
      p.data.settings = settings;
      this.enabled = true;
    } else {
      this.restoreSave();
      p.testBase = null;
      p.save();
      this.enabled = false;
      this.panelOpen = false;
      this.debugOpen = false;
      this.resetSwitches();
    }
    this.changed(on ? t('dvm_enabled') : '');
    this.onProfileChange?.();
  }

  /** Throws away every test change: save data, unlocks and session switches. */
  resetTestState() {
    if (!this.enabled) return;
    this.restoreSave();
    this.resetSwitches();
    if (this.run) this.applyRun(this.run);
    this.changed(t('dvm_reset'));
    this.onProfileChange?.();
  }

  private restoreSave() {
    const p = this.profile!;
    if (!p.testBase) return;
    const settings = p.data.settings;
    p.data = clone(p.testBase);
    p.data.settings = settings;
  }

  private resetSwitches() {
    for (const k in this.toggles) this.toggles[k as DevToggle] = false;
    this.enemyHp = this.enemyDmg = 1;
    this.timeScale = 1;
    this.paused = false;
  }

  /** Copies the session switches onto a run (called when a run starts and after changes). */
  applyRun(run: Run) {
    this.run = run;
    const on = this.enabled;
    const d = run.debug;
    // a run touched by developer mode never pays out into the normal save
    if (on) d.tainted = true;
    d.god = on && this.toggles.god;
    d.infHp = on && this.toggles.infHp;
    d.xpMul = on && this.toggles.infXp ? INF_XP_MUL : 1;
    d.freeze = on && this.toggles.freeze;
    d.infRes = on && this.toggles.infRes;
    d.noCd = on && this.toggles.noCd;
    d.enemyHp = on ? this.enemyHp : 1;
    d.enemyDmg = on ? this.enemyDmg : 1;
    this.dps.reset();
    this.dtps.reset();
    this.spawnRate.reset();
  }

  endRun() {
    this.run = null;
    this.paused = false;
  }

  toggle(k: DevToggle, v = !this.toggles[k]) {
    this.toggles[k] = v;
    if (this.run) this.applyRun(this.run);
    this.changed();
  }

  setEnemyMul(hp: number, dmg: number) {
    this.enemyHp = Math.max(0.1, hp);
    this.enemyDmg = Math.max(0, dmg);
    if (this.run) this.applyRun(this.run);
    this.changed();
  }

  /** Per-frame upkeep for the infinite switches and debug counters (real time). */
  tick(dt: number) {
    if (!this.enabled) return;
    const run = this.run;
    if (this.toggles.infCoins && this.profile && this.profile.data.gold < 999999) this.profile.data.gold = 999999;
    if (!run) return;
    const p = run.player;
    if (this.toggles.infHp && !p.dead) p.hp = p.stats.maxHp;
    if (this.toggles.infGold && run.stats.gold < 99999) run.stats.gold = 99999;
    this.sampleT -= dt;
    if (this.sampleT <= 0) {
      this.sampleT = 0.25;
      let dealt = 0;
      for (const k in run.stats.damageBy) dealt += run.stats.damageBy[k];
      this.dps.push(run.time, dealt);
      this.dtps.push(run.time, run.stats.damageTaken);
      this.spawnRate.push(run.time, run.enemies.spawned);
    }
  }

  // ---------------------------------------------------------------- player
  private need(): Run | null {
    if (!this.run) this.changed(t('dvm_need_run'));
    return this.run;
  }

  maxLevel() {
    const run = this.need();
    if (!run) return;
    const p = run.player;
    // walk the levels so Ultimate upgrades at 12/18/22 are granted; choices are skipped
    while (p.level < MAX_LEVEL) {
      p.level++;
      run.skills.onLevel(p.level);
    }
    p.pendingLevels = 0;
    p.xp = 0;
    p.xpNext = BALANCE.xpForLevel(p.level);
    this.changed(t('dvm_level'));
  }

  addXp(v: number) {
    const run = this.need();
    if (!run) return;
    run.player.addXp(v / run.debug.xpMul / run.player.stats.growth);
    this.changed(t('dvm_xp', { v }));
  }

  addGold(v: number) {
    const run = this.need();
    if (!run) return;
    run.stats.gold += v;
    this.changed(t('dvm_gold', { v }));
  }

  addCoins(v: number) {
    if (!this.profile) return;
    this.profile.data.gold += v;
    this.changed(t('dvm_coins', { v }));
    this.onProfileChange?.();
  }

  heal() {
    const run = this.need();
    if (!run) return;
    run.player.heal(run.player.stats.maxHp * 10, true);
    this.changed(t('dvm_healed'));
  }

  killPlayer() {
    const run = this.need();
    if (!run || run.player.dead) return;
    const wasGod = run.debug.god;
    const wasInf = run.debug.infHp;
    run.debug.god = run.debug.infHp = false;
    const p = run.player;
    p.revivals = 0;
    p.invulnT = 0;
    p.buffs.aegis = 0;
    p.shield = false;
    p.hurt(p.hp + 99999, null, true);
    run.debug.god = wasGod;
    run.debug.infHp = wasInf;
    this.changed(t('dvm_killed_player'));
  }

  /** Max level, full slots of maxed (and evolved where possible) weapons, maxed passives, full HP. */
  maxPlayer() {
    const run = this.need();
    if (!run) return;
    this.maxLevel();
    const ws = run.weapons;
    // fill weapon slots: evolvable weapons first so their evolutions can be shown off
    const candidates = WEAPONS.filter((w) => !w.evolved && !ws.has(w.id) && !ws.list.some((x) => x.def.evolution?.into === w.id)).sort((a, b) => Number(!!b.evolution) - Number(!!a.evolution));
    for (const w of candidates) {
      if (ws.list.length >= BALANCE.weaponSlots) break;
      ws.add(w.id);
    }
    for (const w of [...ws.list]) {
      while (!w.isMax) w.levelUp();
      const evo = w.def.evolution;
      if (!evo) continue;
      if (!run.passives.has(evo.passive) && run.passives.count < BALANCE.passiveSlots) run.passives.levels.set(evo.passive, PASSIVE_BY_ID[evo.passive]?.maxLevel ?? 1);
      if (run.passives.has(evo.passive)) this.evolve(run, w.def.id);
    }
    for (const ps of PASSIVES) {
      if (run.passives.count >= BALANCE.passiveSlots) break;
      if (!run.passives.has(ps.id)) run.passives.levels.set(ps.id, ps.maxLevel);
    }
    for (const id of [...run.passives.levels.keys()]) run.passives.levels.set(id, PASSIVE_BY_ID[id].maxLevel);
    run.recomputeStats();
    run.player.hp = run.player.stats.maxHp;
    this.changed(t('dvm_max_player'));
  }

  // ---------------------------------------------------------------- action-RPG tools
  /** Level 22, every skill at max, the Ultimate learned and maxed. */
  arpgMax() {
    const run = this.need();
    if (!run) return;
    this.maxLevel();
    run.skills.devMaxAll();
    run.skills.resetCooldowns();
    this.changed(t('dvm_arpg_max'));
  }

  setSkillLevel(slot: number, level: number) {
    const run = this.need();
    if (!run) return;
    const sk = run.skills;
    if (slot < 3) sk.levels[slot] = Math.max(1, Math.min(6, level));
    else sk.ultLevel = Math.max(0, Math.min(4, level));
    this.changed(t('dvm_skill_lv', { s: ['Q', 'W', 'E', 'R'][slot], n: sk.level(slot) }));
  }

  resetCooldowns() {
    const run = this.need();
    if (!run) return;
    run.skills.resetCooldowns();
    this.changed(t('dvm_cd_reset'));
  }

  /** Casts a skill toward the nearest enemy (or ahead) ignoring cooldown and cost. */
  testSkill(slot: number) {
    const run = this.need();
    if (!run) return;
    const sk = run.skills;
    const p = run.player;
    if (sk.level(slot) <= 0) sk.ultLevel = slot === 3 ? 1 : sk.ultLevel;
    const e = run.enemies.nearest(p.x, p.z, 14, undefined, true);
    const ax = e ? e.x : p.x + p.fx * 5;
    const az = e ? e.z : p.z + p.fz * 5;
    sk.cds[slot] = 0;
    sk.res = run.skills.kit.res.id === 'heat' ? 0 : sk.resMax;
    sk.cast(slot, ax, az);
    this.changed(t('dvm_skill_test', { s: ['Q', 'W', 'E', 'R'][slot] }));
  }

  /** Moves the hero to the last cursor point on the ground. */
  teleportToCursor() {
    const run = this.need();
    if (!run) return;
    const t2 = run.terrain;
    const x = run.ctl.aimX;
    const z = run.ctl.aimZ;
    if (!t2.inBounds(Math.floor(x), Math.floor(z)) || t2.blocksWalker(Math.floor(x), Math.floor(z))) {
      this.changed(t('dvm_tp_blocked'));
      return;
    }
    run.player.x = x;
    run.player.z = z;
    run.player.clearPath();
    run.nav.update(0, x, z, true);
    this.changed(t('dvm_tp'));
  }

  createItem(slot: GearSlot | 'any', rarity: Rarity) {
    const run = this.need();
    if (!run) return;
    const bases = slot === 'any' ? BASES : BASES.filter((b) => b.slot === slot);
    const base = bases[Math.floor(Math.random() * bases.length)];
    const it = makeItem(Math.random, run.loot.ilvl, rarity, base.id);
    run.loot.drop(it, run.player.x + run.player.fx * 1.5, run.player.z + run.player.fz * 1.5);
    this.changed(t('dvm_item'));
  }

  /** A full equipped set of one rarity (replaces what is worn). */
  giveGearSet(rarity: Rarity) {
    const run = this.need();
    if (!run) return;
    const loot = run.loot;
    for (const pos of EQUIP_POS) {
      const opts = BASES.filter((b) => b.slot === slotOf(pos));
      const it = makeItem(Math.random, loot.ilvl, rarity, opts[Math.floor(Math.random() * opts.length)].id);
      loot.bag.push(it);
      loot.equip(it, pos);
      const i = loot.bag.length;
      if (i > 30) loot.bag.length = 30;
    }
    this.changed(t('dvm_gear_set'));
  }

  /** Adds a flat developer bonus to a stat (fractions for % stats). */
  addStat(stat: StatKey, v: number) {
    const run = this.need();
    if (!run) return;
    run.devMods[stat] = (run.devMods[stat] ?? 0) + v;
    run.recomputeStats();
    this.changed(t('dvm_stat', { s: t('stat_' + stat), v }));
  }

  clearStats() {
    const run = this.need();
    if (!run) return;
    for (const k of Object.keys(run.devMods)) delete run.devMods[k as StatKey];
    run.recomputeStats();
    this.changed(t('dvm_stat_clear'));
  }

  // ---------------------------------------------------------------- unlocks (test save only)
  unlock(what: 'heroes' | 'weapons' | 'maps' | 'upgrades' | 'achievements' | 'evolutions' | 'all') {
    const p = this.profile;
    if (!p || !this.enabled) return;
    const d: SaveData = p.data;
    const add = (list: string[], ids: string[]) => {
      for (const id of ids) if (!list.includes(id)) list.push(id);
    };
    const all = what === 'all';
    if (all || what === 'heroes') add(d.unlocked.heroes, HEROES.map((h) => h.id));
    if (all || what === 'weapons') {
      add(d.unlocked.weapons, WEAPONS.map((w) => w.id));
      add(d.unlocked.passives, PASSIVES.map((x) => x.id));
      add(d.discovered.weapons, WEAPONS.filter((w) => !w.evolved).map((w) => w.id));
      add(d.discovered.passives, PASSIVES.map((x) => x.id));
    }
    if (all || what === 'maps') {
      add(d.unlocked.maps, MAPS.map((m) => m.id));
      for (const m of MAPS) d.mapClears[m.id] = Math.max(d.mapClears[m.id] ?? -1, 3);
    }
    if (all || what === 'upgrades') for (const u of PERM_UPGRADES) d.perm[u.id] = u.maxLevel;
    if (all || what === 'achievements') add(d.achievements, ACHIEVEMENTS.map((a) => a.id));
    if (all || what === 'evolutions') add(d.discovered.weapons, WEAPONS.filter((w) => w.evolved).map((w) => w.id));
    d.seenIntro = true;
    this.changed(t('dvm_unlocked', { what: t('dvm_what_' + what) }));
    this.onProfileChange?.();
  }

  // ---------------------------------------------------------------- weapons
  addWeapon(id: string) {
    const run = this.need();
    if (!run) return;
    const def = WEAPON_BY_ID[id];
    if (!def) return;
    if (def.evolved) return this.addEvolution(id);
    if (run.weapons.has(id)) return this.changed(t('dvm_owned'));
    if (run.weapons.list.length >= BALANCE.weaponSlots) return this.changed(t('dvm_slots'));
    run.weapons.add(id);
    run.stats.discovered.add(id);
    this.changed(t('dvm_added', { name: wname(id) }));
  }

  setWeaponLevel(id: string, level: number) {
    const run = this.need();
    if (!run) return;
    run.weapons.devSetLevel(id, level);
    this.changed();
  }

  removeWeapon(id: string) {
    const run = this.need();
    if (!run) return;
    run.weapons.devRemove(id);
    this.changed(t('dvm_removed', { name: wname(id) }));
  }

  /** Gives an evolved weapon: evolves its base weapon when owned, otherwise adds it to a free slot. */
  addEvolution(id: string) {
    const run = this.need();
    if (!run) return;
    if (run.weapons.has(id)) return this.changed(t('dvm_owned'));
    const base = run.weapons.list.find((w) => w.def.evolution?.into === id);
    if (base) {
      while (!base.isMax) base.levelUp();
      this.evolve(run, base.def.id);
    } else if (run.weapons.list.length < BALANCE.weaponSlots) {
      run.weapons.add(id);
      run.stats.evolutions.push(id);
      run.stats.discovered.add(id);
    } else return this.changed(t('dvm_slots'));
    this.changed(t('dvm_evolved', { name: wname(id) }));
  }

  private evolve(run: Run, id: string) {
    const w = run.weapons.get(id);
    if (!w) return;
    const nw = run.weapons.evolve(w);
    if (!nw) return;
    run.stats.evolutions.push(nw.def.id);
    run.stats.discovered.add(nw.def.id);
    run.events.emit('evolution', nw.def.id);
  }

  addPassive(id: string) {
    const run = this.need();
    if (!run) return;
    if (!run.passives.has(id) && run.passives.count >= BALANCE.passiveSlots) return this.changed(t('dvm_pslots'));
    this.setPassiveLevel(id, run.passives.level(id) + 1);
  }

  setPassiveLevel(id: string, level: number) {
    const run = this.need();
    if (!run) return;
    const def = PASSIVE_BY_ID[id];
    if (!def) return;
    level = Math.max(0, Math.min(def.maxLevel, level));
    if (level === 0) run.passives.levels.delete(id);
    else run.passives.levels.set(id, level);
    run.stats.discovered.add(id);
    run.recomputeStats();
    this.changed();
  }

  // ---------------------------------------------------------------- enemies
  spawnEnemy(id: string, elite: boolean | EliteId = false, count = 1) {
    const run = this.need();
    if (!run) return;
    const def = ENEMY_BY_ID[id];
    if (!def) return;
    for (let i = 0; i < count; i++) {
      const pos = run.spawner.findSpawnPos(!!def.flying, 5, 9) ?? { x: run.player.x + 6, z: run.player.z };
      const el = elite === true ? run.spawner.randomElite() : elite || null;
      run.enemies.spawn(def, pos.x, pos.z, { elite: el });
    }
    this.changed(t('dvm_spawned', { name: L(ENEMY_BY_ID[id]?.name) || id, n: count, elite: elite ? t('dvm_elite') : '' }));
  }

  spawnBoss(id: string) {
    const run = this.need();
    if (!run) return;
    run.spawner.devSpawnBoss(id);
    this.changed(t('dvm_boss', { name: L(BOSSES.find((b) => b.id === id)?.name) || id }));
  }

  killAll() {
    const run = this.need();
    if (!run) return;
    let n = 0;
    for (const e of run.enemies.list) {
      if (!e.alive || e.isAlly) continue;
      run.combat.killEnemy(e, true);
      n++;
    }
    this.changed(t('dvm_killed', { n }));
  }

  // ---------------------------------------------------------------- waves & time
  setWave(n: number) {
    const run = this.need();
    if (!run) return;
    run.waves.jumpTo(n);
    run.spawner.devWaveStart();
    this.changed(t('dvm_wave', { n: run.waves.wave.n }));
  }

  nextWave() {
    if (this.run) this.setWave(this.run.waves.wave.n + 1);
  }

  prevWave() {
    if (this.run) this.setWave(this.run.waves.wave.n - 1);
  }

  restartWave() {
    if (this.run) this.setWave(this.run.waves.wave.n);
  }

  spawnWaveBoss() {
    const run = this.need();
    if (!run) return;
    this.spawnBoss(run.waves.wave.boss ?? run.map.midBoss);
  }

  eliteWave() {
    const run = this.need();
    if (!run) return;
    run.spawner.devEliteWave();
    this.changed(t('dvm_elite_wave'));
  }

  /** Day/night: jump to a period, force a blood moon, call the night events. */
  setDayPeriod(p: DayPeriod) {
    const run = this.need();
    if (!run || !run.dayNight.enabled) return;
    run.dayNight.devSet(p);
    this.changed(t('dvm_period', { p: t('period_' + p) }));
  }

  bloodMoon() {
    const run = this.need();
    if (!run || !run.dayNight.enabled) return;
    run.dayNight.bloodAhead = true;
    run.dayNight.devSet('night');
    this.changed(t('dvm_blood'));
  }

  nightPack() {
    const run = this.need();
    if (!run) return;
    run.dayNight.elitePack();
    this.changed(t('dvm_pack'));
  }

  nightBoss() {
    const run = this.need();
    if (!run) return;
    run.dayNight.nightBoss();
    this.changed(t('dvm_nboss'));
  }

  /** Moves the clock: the wave that would be running at that time starts now. */
  setTime(sec: number) {
    const run = this.need();
    if (!run) return;
    sec = Math.max(0, sec);
    const len = run.waves.wave.duration;
    const n = Math.floor(sec / len) + 1;
    run.time = sec;
    run.waves.jumpTo(n, Math.min(sec, (n - 1) * len));
    run.spawner.devSkipEventsTo(sec);
    run.spawner.devWaveStart();
    this.changed(t('dvm_time', { t: `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` }));
  }

  setTimeScale(v: number) {
    this.timeScale = v;
    this.changed();
  }

  setPaused(v: boolean) {
    this.paused = v;
    this.changed();
  }

  // ---------------------------------------------------------------- spawn & clear
  spawnPickup(kind: PickupKind | 'chest' | 'coins', value = 0) {
    const run = this.need();
    if (!run) return;
    const p = run.player;
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 2.2;
    const z = p.z + Math.sin(a) * 2.2;
    if (kind === 'chest') run.pickups.spawnChest(x, z, 0, 'elite');
    else if (kind === 'coins') for (let i = 0; i < 12; i++) run.pickups.spawn('gold', p.x + Math.cos((i / 12) * Math.PI * 2) * 2.4, p.z + Math.sin((i / 12) * Math.PI * 2) * 2.4, 1);
    else run.pickups.spawn(kind, x, z, value, true);
    this.changed(t('dvm_pickup', { name: t('dv_' + (kind === 'chest' ? 'sp_chest' : kind === 'coins' ? 'sp_coins' : kind === 'xp' ? 'sp_xp' : kind === 'pouch' ? 'sp_gold' : 'pu_' + kind)) }));
  }

  clearProjectiles() {
    const run = this.need();
    if (!run) return;
    run.projectiles.clear();
    run.hazards.clearAll();
    this.changed(t('dvm_proj'));
  }

  clearPickups() {
    const run = this.need();
    if (!run) return;
    run.pickups.clear();
    run.pickups.gemCount = 0;
    this.changed(t('dvm_pickups'));
  }

  clearEffects() {
    const run = this.need();
    if (!run) return;
    run.effects.clear();
    run.hazards.clearAll();
    this.changed(t('dvm_fx'));
  }
}

/** The one developer-mode instance for the app. */
export const dev = new DevMode();
