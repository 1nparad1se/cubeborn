import type { DayPeriod } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import { HEROES } from '../data/heroes';
import { MAPS } from '../data/maps';
import { ACHIEVEMENTS } from '../data/achievements';
import { ENEMY_BY_ID, ELITE_MODS, type EliteId } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import type { Profile } from '../meta/Profile';
import type { SaveData } from '../meta/Save';
import type { Run } from '../game/Run';
import type { Enemy } from '../game/Enemy';
import type { PickupKind } from '../game/Pickups';
import { DEV_TOOLS_AVAILABLE } from './flags';
import { L, t } from '../i18n';
import { MAX_LEVEL, TRIPOD_LEVELS, SLOT_KEYS, type ClassId } from '../game/action/types';
import { CLASS_BY_ID } from '../game/action/classes';
import { tripodsFor } from '../game/action/tripods';
import { BossController } from '../game/bosses/Boss';
import { EQUIP_POS, makeItem, slotOf, BASES, type GearSlot } from '../game/arpg/Gear';
import { BAG_SIZE } from '../game/arpg/Loot';
import type { Rarity, StatKey } from '../data/types';

export type DevToggle = 'god' | 'infHp' | 'infXp' | 'infGold' | 'infCoins' | 'freeze' | 'infRes' | 'noCd';

/** Where spawns and drops land: at the cursor or around the hero. */
export type DevPlace = 'cursor' | 'hero';

/** XP multiplier used by "Infinite XP" (a true infinite would level up every frame). */
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

/** A named teleport destination on the current map. */
export interface DevPoint {
  id: string;
  label: string;
  x: number;
  z: number;
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
  /**
   * Provided by the App: starts a new run with the given class on the current map (the map,
   * difficulty and mode of the running or last run). The run it starts goes through applyRun as usual.
   */
  onStartClass: ((id: ClassId) => void) | null = null;
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

  // ---------------------------------------------------------------- class
  /** Starts a new test run with the chosen class on the current map (needs App's onStartClass). */
  startClass(id: ClassId) {
    if (!this.enabled) return;
    if (!this.onStartClass) return this.changed(t('dvm_no_start'));
    const name = L(CLASS_BY_ID[id]?.name) || id;
    this.onStartClass(id);
    this.changed(t('dvm_class', { name }));
  }

  // ---------------------------------------------------------------- player
  private need(): Run | null {
    if (!this.run) this.changed(t('dvm_need_run'));
    return this.run;
  }

  /** Sets the hero level (1..30). Raising it grants the skill points and skills those levels give. */
  setLevel(level: number) {
    const run = this.need();
    if (!run) return;
    const p = run.player;
    const a = run.action;
    level = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
    if (level > p.level) {
      a.points += level - p.level;
      a.unlockSkills(level);
    }
    p.level = level;
    p.pendingLevels = 0;
    p.xp = 0;
    p.xpNext = BALANCE.xpForLevel(p.level);
    run.recomputeStats();
    this.changed(t('dvm_level', { n: level }));
  }

  maxLevel() {
    this.setLevel(MAX_LEVEL);
  }

  addPoints(n: number) {
    const run = this.need();
    if (!run) return;
    run.action.points = Math.max(0, run.action.points + n);
    this.changed(t('dvm_points', { n: run.action.points }));
  }

  addXp(v: number) {
    const run = this.need();
    if (!run) return;
    run.player.addXp(v / run.debug.xpMul / 1.35 / run.player.stats.growth);
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
    run.player.hp = run.player.stats.maxHp;
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
    run.action.shield = 0;
    p.hurt(p.hp + 99999, null, true);
    run.debug.god = wasGod;
    run.debug.infHp = wasInf;
    this.changed(t('dvm_killed_player'));
  }

  /** Level 30, every skill at level 10 with both tripods, full HP, resource, Ultimate gauge and cooldowns. */
  maxPlayer() {
    const run = this.need();
    if (!run) return;
    this.setLevel(MAX_LEVEL);
    const a = run.action;
    a.devMaxAll();
    a.resetCooldowns();
    a.fillResource();
    a.fillUlt();
    run.player.hp = run.player.stats.maxHp;
    this.changed(t('dvm_max_player'));
  }

  // ---------------------------------------------------------------- action combat
  resetCooldowns() {
    const run = this.need();
    if (!run) return;
    run.action.resetCooldowns();
    this.changed(t('dvm_cd_reset'));
  }

  fillResource() {
    const run = this.need();
    if (!run) return;
    run.action.fillResource();
    this.changed(t('dvm_res_full', { res: L(run.action.cls.res.name) }));
  }

  fillUlt() {
    const run = this.need();
    if (!run) return;
    run.action.fillUlt();
    const a = run.action;
    this.changed(run.player.level >= a.cls.ult.unlock ? t('dvm_ult_full') : t('dvm_ult_locked', { n: a.cls.ult.unlock }));
  }

  /** Fills the class resource so the Identity (Z) can be triggered at once. */
  readyIdentity() {
    const run = this.need();
    if (!run) return;
    const a = run.action;
    a.identityT = Math.min(a.identityT, 0);
    a.fillResource();
    this.changed(t('dvm_identity', { name: L(a.cls.identity.name) }));
  }

  unlockSkills() {
    const run = this.need();
    if (!run) return;
    run.action.devUnlockAll();
    this.changed(t('dvm_skills_open'));
  }

  maxSkills() {
    const run = this.need();
    if (!run) return;
    run.action.devMaxAll();
    this.changed(t('dvm_skills_max'));
  }

  setSkillLevel(slot: number, level: number) {
    const run = this.need();
    if (!run) return;
    const a = run.action;
    if (slot < 0 || slot > 7) return;
    a.devSetLevel(slot, level);
    this.changed(t('dvm_skill_level', { s: SLOT_KEYS[slot], name: L(a.cls.skills[slot].name), n: a.levels[slot] }));
  }

  /** Picks a tripod (index 0..2, -1 clears) of a tier; raises the skill to the tier's level when needed. */
  setTripod(slot: number, tier: number, i: number) {
    const run = this.need();
    if (!run) return;
    const a = run.action;
    if (slot < 0 || slot > 7 || tier < 0 || tier > 1) return;
    if (a.levels[slot] < TRIPOD_LEVELS[tier]) a.devSetLevel(slot, TRIPOD_LEVELS[tier]);
    a.setTripod(slot, tier, i);
    const tp = i >= 0 ? tripodsFor(a.cls.skills[slot])[tier][i] : null;
    this.changed(tp ? t('dvm_tripod', { s: SLOT_KEYS[slot], name: L(tp.name) }) : t('dvm_tripod_off', { s: SLOT_KEYS[slot] }));
  }

  /** Presses a skill key for the hero (cooldown and resource reset first). Slot 8 is the Ultimate. */
  testSkill(slot: number) {
    const run = this.need();
    if (!run) return;
    const a = run.action;
    if (slot < 8 && a.levels[slot] <= 0) a.devSetLevel(slot, 1);
    a.cds[slot] = 0;
    a.fillResource();
    if (slot === 8) a.fillUlt();
    run.ctl.casts.push(slot);
    const def = a.skill(slot);
    this.changed(t('dvm_cast', { name: L(def?.name) }));
  }

  // ---------------------------------------------------------------- places
  /** The point a spawn lands on: the cursor (when walkable) or a ring around the hero. */
  private placeFor(run: Run, place: DevPlace, i = 0, n = 1, r = 4): { x: number; z: number } {
    const p = run.player;
    const cx = place === 'cursor' ? run.ctl.aimX : p.x;
    const cz = place === 'cursor' ? run.ctl.aimZ : p.z;
    const ring = place === 'cursor' ? (n > 1 ? 1.2 + Math.sqrt(n) * 0.4 : 0) : r;
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    return this.walkable(run, cx + Math.cos(a) * ring, cz + Math.sin(a) * ring) ?? { x: p.x + 4, z: p.z };
  }

  /** Nearest walkable point to (x, z) on a small spiral search, or null. */
  private walkable(run: Run, x: number, z: number): { x: number; z: number } | null {
    const tr = run.terrain;
    const ok = (px: number, pz: number) => tr.inBounds(Math.floor(px), Math.floor(pz)) && !tr.blocksWalker(Math.floor(px), Math.floor(pz));
    if (ok(x, z)) return { x, z };
    for (let r = 1; r <= 8; r++) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  private moveHero(run: Run, x: number, z: number) {
    const p = run.player;
    p.x = x;
    p.z = z;
    p.clearPath();
    run.nav.update(0, x, z, true);
  }

  /** Moves the hero to the last cursor point on the ground. */
  teleportToCursor() {
    const run = this.need();
    if (!run) return;
    const t2 = run.terrain;
    const x = run.ctl.aimX;
    const z = run.ctl.aimZ;
    if (!t2.inBounds(Math.floor(x), Math.floor(z)) || t2.blocksWalker(Math.floor(x), Math.floor(z))) return this.changed(t('dvm_tp_blocked'));
    this.moveHero(run, x, z);
    this.changed(t('dvm_tp'));
  }

  /** Named destinations of the current map: centre, the living boss and the map's landmarks. */
  points(): DevPoint[] {
    const run = this.run;
    if (!run) return [];
    const c = run.terrain.size / 2;
    const out: DevPoint[] = [{ id: 'centre', label: t('dv_pt_centre'), x: c, z: c }];
    const boss = run.bosses.find((b) => b.e.alive);
    if (boss) out.push({ id: 'boss', label: t('dv_pt_boss', { name: L(boss.def.name) }), x: boss.e.x, z: boss.e.z });
    const s = run.terrain.size;
    out.push(
      { id: 'nw', label: t('dv_pt_nw'), x: s * 0.15, z: s * 0.15 },
      { id: 'ne', label: t('dv_pt_ne'), x: s * 0.85, z: s * 0.15 },
      { id: 'sw', label: t('dv_pt_sw'), x: s * 0.15, z: s * 0.85 },
      { id: 'se', label: t('dv_pt_se'), x: s * 0.85, z: s * 0.85 },
    );
    run.terrain.markers.forEach((m, i) => {
      const kind = m.kind === 'poi' ? 'poi_' + (m.sub ?? '') : m.kind;
      out.push({ id: 'm' + i, label: `${t('dv_pt_' + kind)} ${i + 1}`, x: m.x, z: m.z });
    });
    return out;
  }

  teleportTo(id: string) {
    const run = this.need();
    if (!run) return;
    const pt = this.points().find((p) => p.id === id);
    if (!pt) return;
    // next to a boss, not inside it
    const dx = id === 'boss' ? -4 : 0;
    const pos = this.walkable(run, pt.x + dx, pt.z);
    if (!pos) return this.changed(t('dvm_tp_blocked'));
    this.moveHero(run, pos.x, pos.z);
    this.changed(t('dvm_tp_to', { name: pt.label }));
  }

  // ---------------------------------------------------------------- gear
  /** A random item of the slot and rarity straight into the bag. */
  giveItem(slot: GearSlot | 'any', rarity: Rarity, count = 1) {
    const run = this.need();
    if (!run) return;
    const loot = run.loot;
    const bases = slot === 'any' ? BASES : BASES.filter((b) => b.slot === slot);
    let n = 0;
    for (let i = 0; i < count; i++) {
      if (loot.bag.length >= BAG_SIZE) break;
      const base = bases[Math.floor(Math.random() * bases.length)];
      loot.give(makeItem(Math.random, loot.ilvl, rarity, base.id));
      n++;
    }
    this.changed(n ? t('dvm_give', { n, rar: t('rar_' + rarity) }) : t('dvm_bag_full'));
  }

  /** Drops a random item of the slot and rarity on the ground near the hero. */
  dropItem(slot: GearSlot | 'any', rarity: Rarity) {
    const run = this.need();
    if (!run) return;
    const bases = slot === 'any' ? BASES : BASES.filter((b) => b.slot === slot);
    const base = bases[Math.floor(Math.random() * bases.length)];
    const p = run.player;
    run.loot.drop(makeItem(Math.random, run.loot.ilvl, rarity, base.id), p.x + 1.5, p.z);
    this.changed(t('dvm_item_drop'));
  }

  /** A full equipped set of one rarity (replaces what is worn; the old pieces go to the bag while it has room). */
  giveGearSet(rarity: Rarity) {
    const run = this.need();
    if (!run) return;
    const loot = run.loot;
    for (const pos of EQUIP_POS) {
      const opts = BASES.filter((b) => b.slot === slotOf(pos));
      const it = makeItem(Math.random, loot.ilvl, rarity, opts[Math.floor(Math.random() * opts.length)].id);
      loot.bag.push(it);
      loot.equip(it, pos);
      if (loot.bag.length > BAG_SIZE) loot.bag.length = BAG_SIZE;
    }
    this.changed(t('dvm_gear_set'));
  }

  clearBag() {
    const run = this.need();
    if (!run) return;
    run.loot.bag.length = 0;
    this.changed(t('dvm_bag_clear'));
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
  unlock(what: 'heroes' | 'maps' | 'achievements' | 'all') {
    const p = this.profile;
    if (!p || !this.enabled) return;
    const d: SaveData = p.data;
    const add = (list: string[], ids: string[]) => {
      for (const id of ids) if (!list.includes(id)) list.push(id);
    };
    const all = what === 'all';
    if (all || what === 'heroes') add(d.unlocked.heroes, HEROES.map((h) => h.id));
    if (all || what === 'maps') {
      add(d.unlocked.maps, MAPS.map((m) => m.id));
      for (const m of MAPS) d.mapClears[m.id] = Math.max(d.mapClears[m.id] ?? -1, 3);
    }
    if (all || what === 'achievements') add(d.achievements, ACHIEVEMENTS.map((a) => a.id));
    d.seenIntro = true;
    this.changed(t('dvm_unlocked', { what: t('dvm_what_' + what) }));
    this.onProfileChange?.();
  }

  // ---------------------------------------------------------------- enemies
  spawnEnemy(id: string, elite: boolean | EliteId = false, count = 1, place: DevPlace = 'cursor') {
    const run = this.need();
    if (!run) return;
    const def = ENEMY_BY_ID[id];
    if (!def) return;
    for (let i = 0; i < count; i++) {
      const pos = this.placeFor(run, place, i, count, 6);
      const el = elite === true ? run.spawner.randomElite() : elite || null;
      run.enemies.spawn(def, pos.x, pos.z, { elite: el });
    }
    const eliteName = typeof elite === 'string' ? ` (${L(ELITE_MODS[elite].name)})` : elite ? t('dvm_elite') : '';
    this.changed(t('dvm_spawned', { name: L(def.name) || id, n: count, elite: eliteName }));
  }

  spawnBoss(id: string, place: DevPlace = 'cursor') {
    const run = this.need();
    if (!run) return;
    const def = BOSSES.find((b) => b.id === id);
    if (!def) return;
    const pos = this.placeFor(run, place, 0, 1, 10);
    const b = BossController.spawn(run, id, pos.x, pos.z, false);
    if (!b) return this.changed(t('dvm_boss_fail'));
    run.stats.bossesSeen++;
    run.events.emit('bossSpawn', b);
    run.fx.sound('bossRoar');
    run.fx.shake(0.5);
    this.changed(t('dvm_boss', { name: L(def.name) || id }));
  }

  /** The current boss, or else the enemy nearest the hero. */
  private target(run: Run): Enemy | null {
    const b = run.bosses.find((x) => x.e.alive);
    if (b) return b.e;
    let best: Enemy | null = null;
    let bd = 1e9;
    const p = run.player;
    for (const e of run.enemies.list) {
      if (!e.alive || e.isAlly || e.def.category === 'prop') continue;
      const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Fills the stagger bar of the current boss (or the nearest enemy): it breaks at once. */
  breakStagger() {
    const run = this.need();
    if (!run) return;
    const e = this.target(run);
    if (!e) return this.changed(t('dvm_no_target'));
    run.combat.breakStagger(e);
    this.changed(t('dvm_stagger', { name: e.boss ? L(e.boss.def.name) : L(e.def.name) }));
  }

  /** Breaks the stagger of every enemy on the map. */
  breakAll() {
    const run = this.need();
    if (!run) return;
    let n = 0;
    for (const e of run.enemies.list) {
      if (!e.alive || e.isAlly || e.def.category === 'prop') continue;
      run.combat.breakStagger(e);
      n++;
    }
    this.changed(t('dvm_stagger_all', { n }));
  }

  /** Drops the current boss (or the nearest enemy) to 10% health. */
  lowTarget() {
    const run = this.need();
    if (!run) return;
    const e = this.target(run);
    if (!e) return this.changed(t('dvm_no_target'));
    e.hp = Math.max(1, Math.min(e.hp, e.maxHp * 0.1));
    this.changed(t('dvm_low', { name: e.boss ? L(e.boss.def.name) : L(e.def.name) }));
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
    this.spawnBoss(run.waves.wave.boss ?? run.map.midBoss, 'hero');
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
