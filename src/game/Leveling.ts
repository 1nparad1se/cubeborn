import { BALANCE } from '../config/balance';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import type { Rarity, StatMods } from '../data/types';
import { WEAPONS } from '../data/weapons';
import type { Run } from './Run';

const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, uncommon: 8.5, rare: 7, epic: 4, legendary: 2 };

/** Passive items owned during a run. */
export class Passives {
  readonly levels = new Map<string, number>();
  has(id: string) {
    return this.levels.has(id);
  }
  level(id: string) {
    return this.levels.get(id) ?? 0;
  }
  get count() {
    return this.levels.size;
  }
  add(id: string) {
    this.levels.set(id, this.level(id) + 1);
  }
  mods(): StatMods {
    const out: StatMods = {};
    for (const [id, lvl] of this.levels) {
      const def = PASSIVE_BY_ID[id];
      for (const k in def.perLevel) {
        const key = k as keyof StatMods;
        out[key] = (out[key] ?? 0) + (def.perLevel[key] ?? 0) * lvl;
      }
    }
    return out;
  }
}

export type ChoiceKind = 'weapon_new' | 'weapon_up' | 'passive_new' | 'passive_up' | 'gold' | 'heal' | 'skill_up' | 'ult_learn' | 'ult_decline' | 'stat' | 'dodge_up' | 'mod';

export interface Choice {
  kind: ChoiceKind;
  id: string;
  /** Level after taking it. */
  level: number;
  rarity: Rarity;
}

/** Generates and applies level-up choices. */
export class Leveling {
  readonly banished = new Set<string>();
  rerolls = 0;
  skips = 0;
  banishes = 0;

  constructor(private run: Run) {}

  initCounters() {
    const s = this.run.player.stats;
    this.rerolls = s.reroll;
    this.skips = s.skip;
    this.banishes = s.banish;
  }

  candidates(): { c: Choice; w: number }[] {
    const run = this.run;
    const luck = run.player.stats.luck;
    const out: { c: Choice; w: number }[] = [];
    const rw = (r: Rarity) => RARITY_WEIGHT[r] * (r === 'common' ? 1 : luck);
    for (const w of run.weapons.list) {
      if (w.def.evolved || w.isMax) continue;
      out.push({ c: { kind: 'weapon_up', id: w.def.id, level: w.level + 1, rarity: w.def.rarity }, w: rw(w.def.rarity) * 1.4 });
    }
    if (run.weapons.list.length < BALANCE.weaponSlots) {
      for (const def of WEAPONS) {
        if (def.evolved || run.weapons.has(def.id) || this.banished.has(def.id)) continue;
        if (def.evolution && run.weapons.has(def.evolution.into)) continue;
        if (!run.unlockedWeapons.has(def.id)) continue;
        out.push({ c: { kind: 'weapon_new', id: def.id, level: 1, rarity: def.rarity }, w: rw(def.rarity) });
      }
    }
    for (const [id, lvl] of run.passives.levels) {
      const def = PASSIVE_BY_ID[id];
      if (lvl >= def.maxLevel) continue;
      out.push({ c: { kind: 'passive_up', id, level: lvl + 1, rarity: def.rarity }, w: rw(def.rarity) * 1.1 });
    }
    if (run.passives.count < BALANCE.passiveSlots) {
      for (const def of PASSIVES) {
        if (run.passives.has(def.id) || this.banished.has(def.id) || !run.unlockedPassives.has(def.id)) continue;
        // favour passives that complete an evolution recipe
        const helps = run.weapons.list.some((w) => w.def.evolution?.passive === def.id);
        out.push({ c: { kind: 'passive_new', id: def.id, level: 1, rarity: def.rarity }, w: rw(def.rarity) * (helps ? 1.8 : 0.8) });
      }
    }
    return out;
  }

  roll(): Choice[] {
    const run = this.run;
    const pool = this.candidates();
    const luck = run.player.stats.luck;
    let n = BALANCE.choiceCount;
    if (run.rng.chance(Math.min(0.5, (luck - 1) * BALANCE.extraChoiceLuck + 0.08))) n++;
    const picks: Choice[] = [];
    while (picks.length < n && pool.length) {
      const it = run.rng.weighted(pool, (o) => o.w);
      if (!it) break;
      picks.push(it.c);
      pool.splice(pool.indexOf(it), 1);
    }
    if (picks.length === 0) {
      picks.push({ kind: 'gold', id: 'gold', level: 0, rarity: 'common' });
      picks.push({ kind: 'heal', id: 'heal', level: 0, rarity: 'common' });
    }
    return picks;
  }

  apply(c: Choice) {
    const run = this.run;
    switch (c.kind) {
      case 'weapon_new':
        run.weapons.add(c.id);
        break;
      case 'weapon_up':
        run.weapons.get(c.id)?.levelUp();
        break;
      case 'passive_new':
      case 'passive_up':
        run.passives.add(c.id);
        run.recomputeStats();
        break;
      case 'gold':
        run.stats.gold += 3 * run.player.stats.greed;
        break;
      case 'heal':
        run.player.heal(run.player.stats.maxHp * 0.3);
        break;
    }
    run.stats.discovered.add(c.id);
  }

}
