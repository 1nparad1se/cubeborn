import { ACHIEVEMENTS } from '../data/achievements';
import type { RunRecord } from './runRecord';
import { HEROES } from '../data/heroes';
import { MAPS } from '../data/maps';
import { PASSIVES } from '../data/passives';
import { PERM_UPGRADES, permCost, PERM_BY_ID } from '../data/upgrades';
import { WEAPONS } from '../data/weapons';
import { RELIC_BY_ID } from '../data/bosses';
import type { AchievementDef, StatMods, UnlockRef } from '../data/types';
import { loadSave, writeSave, defaultSave, clearSave, type SaveData } from './Save';

/** Account-level state: currency, unlocks, achievements and lifetime stats. */
export class Profile {
  data: SaveData;
  private saveTimer = 0;

  constructor() {
    this.data = loadSave();
  }

  /**
   * Developer test state: while set, `data` is a disposable copy and only the settings
   * reach storage; everything else on disk stays as it was before developer mode.
   */
  testBase: SaveData | null = null;

  save(): void {
    if (this.testBase) writeSave({ ...this.testBase, settings: this.data.settings });
    else writeSave(this.data);
  }

  /** Coalesces frequent writes (e.g. settings sliders). */
  saveSoon(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 300);
  }

  reset(): void {
    const settings = this.data.settings;
    if (this.testBase) {
      this.data = defaultSave();
      this.data.settings = settings;
      return;
    }
    clearSave();
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }

  // ---------------------------------------------------------------- unlocks
  isHeroUnlocked(id: string): boolean {
    const h = HEROES.find((x) => x.id === id);
    return !!h && (!h.locked || this.data.unlocked.heroes.includes(id));
  }
  isWeaponUnlocked(id: string): boolean {
    const w = WEAPONS.find((x) => x.id === id);
    return !!w && (!w.locked || this.data.unlocked.weapons.includes(id));
  }
  isPassiveUnlocked(id: string): boolean {
    const p = PASSIVES.find((x) => x.id === id);
    return !!p && (!p.locked || this.data.unlocked.passives.includes(id));
  }
  isMapUnlocked(id: string): boolean {
    return MAPS[0].id === id || this.data.unlocked.maps.includes(id);
  }
  /** Difficulty index available for a map: one above the best clear. */
  maxDifficulty(mapId: string): number {
    const c = this.data.mapClears[mapId];
    return c === undefined ? 0 : Math.min(3, c + 1);
  }

  unlock(ref: UnlockRef): boolean {
    const list = ref.kind === 'hero' ? this.data.unlocked.heroes : ref.kind === 'weapon' ? this.data.unlocked.weapons : ref.kind === 'passive' ? this.data.unlocked.passives : this.data.unlocked.maps;
    if (list.includes(ref.id)) return false;
    list.push(ref.id);
    return true;
  }

  discover(kind: keyof SaveData['discovered'], id: string): boolean {
    const list = this.data.discovered[kind];
    if (list.includes(id)) return false;
    list.push(id);
    return true;
  }

  // ---------------------------------------------------------------- stats
  stat(key: string): number {
    return this.data.stats[key] ?? 0;
  }
  addStat(key: string, v: number): void {
    this.data.stats[key] = this.stat(key) + v;
  }
  maxStat(key: string, v: number): void {
    if (v > this.stat(key)) this.data.stats[key] = v;
  }

  /**
   * Stats used by achievements: lifetime stats plus a few derived counts. With a run record the
   * value is projected as if the run in progress had ended now (live unlocks during a run).
   */
  derivedStat(key: string, rec?: RunRecord): number {
    const d = this.data;
    switch (key) {
      case 'evolutions':
        return d.discovered.weapons.filter((id) => WEAPONS.find((w) => w.id === id)?.evolved).length;
      case 'heroWins':
        return HEROES.filter((h) => this.stat('herowin_' + h.id) > 0).length;
      case 'mapsCleared':
        return MAPS.filter((m) => (d.mapClears[m.id] ?? -1) >= 0).length;
      case 'heroesPlayed':
        return HEROES.filter((h) => this.stat('heroplay_' + h.id) + (rec?.add['heroplay_' + h.id] ?? 0) > 0).length;
      case 'mapsPlayed':
        return MAPS.filter((m) => this.stat('mapplay_' + m.id) + (rec?.add['mapplay_' + m.id] ?? 0) > 0).length;
      case 'achievementsDone':
        return d.achievements.length;
      case 'enemiesSeen':
        return d.discovered.enemies.length;
      case 'weaponsFound':
        return d.discovered.weapons.filter((id) => !WEAPONS.find((w) => w.id === id)?.evolved).length;
      case 'relics':
        return d.discovered.relics.length;
      case 'permSpent':
        return d.permSpent ?? 0;
      case 'permLevels':
        return Object.values(d.perm).reduce((a, b) => a + b, 0);
    }
    const v = this.stat(key);
    if (!rec) return v;
    if (key in rec.max) return Math.max(v, rec.max[key]);
    return v + (rec.add[key] ?? 0);
  }

  /** Returns newly completed achievements and applies their rewards (repeats so meta achievements chain). */
  checkAchievements(): AchievementDef[] {
    const done: AchievementDef[] = [];
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const a of ACHIEVEMENTS) {
        if (this.data.achievements.includes(a.id)) continue;
        if (this.derivedStat(a.cond.stat) >= a.cond.value) {
          this.data.achievements.push(a.id);
          if (a.reward) this.unlock(a.reward);
          if (a.gold) this.data.gold += a.gold;
          done.push(a);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return done;
  }

  /** Achievements the run in progress has already earned (not yet saved; finishRun makes them real). */
  liveAchievements(rec: RunRecord, shown: Set<string>): AchievementDef[] {
    const out: AchievementDef[] = [];
    for (const a of ACHIEVEMENTS) {
      if (shown.has(a.id) || this.data.achievements.includes(a.id)) continue;
      if (this.derivedStat(a.cond.stat, rec) >= a.cond.value) out.push(a);
    }
    return out;
  }

  achievementProgress(a: AchievementDef): number {
    return Math.min(1, this.derivedStat(a.cond.stat) / a.cond.value);
  }

  /** Current value toward an achievement (for "350 / 1 000" progress labels). */
  achievementValue(a: AchievementDef): number {
    return Math.min(a.cond.value, Math.floor(this.derivedStat(a.cond.stat)));
  }

  // ---------------------------------------------------------------- permanent upgrades
  permLevel(id: string): number {
    return this.data.perm[id] ?? 0;
  }
  permNextCost(id: string): number {
    const def = PERM_BY_ID[id];
    return permCost(def, this.permLevel(id));
  }
  buyPerm(id: string): boolean {
    const def = PERM_BY_ID[id];
    const lvl = this.permLevel(id);
    if (!def || lvl >= def.maxLevel) return false;
    const cost = permCost(def, lvl);
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    this.data.permSpent = (this.data.permSpent ?? 0) + cost;
    this.data.perm[id] = lvl + 1;
    this.save();
    return true;
  }
  /** Refunds all gold spent on upgrades. */
  refundPerms(): void {
    // refunds what was actually paid (levels bought before the ×5 price change refund old prices)
    const total = this.data.permSpent ?? 0;
    this.data.permSpent = 0;
    this.data.perm = {};
    this.data.gold += total;
    this.save();
  }
  /** Total upgrade levels bought: shown as account "power level". */
  powerLevel(): number {
    let n = 0;
    for (const k in this.data.perm) n += this.data.perm[k];
    return n + this.data.discovered.relics.length;
  }

  /** Stat bonuses from permanent upgrades and relics. */
  permanentMods(): StatMods {
    const out: StatMods = {};
    const add = (m: StatMods, times = 1) => {
      for (const k in m) {
        const key = k as keyof StatMods;
        out[key] = (out[key] ?? 0) + (m[key] ?? 0) * times;
      }
    };
    for (const def of PERM_UPGRADES) {
      const lvl = this.permLevel(def.id);
      if (lvl > 0) add(def.perLevel, lvl);
    }
    for (const id of this.data.discovered.relics) {
      const r = RELIC_BY_ID[id];
      if (r) add(r.stats);
    }
    return out;
  }
}
