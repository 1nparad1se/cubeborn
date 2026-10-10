import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { PROG } from '../../config/progression';
import { RARITIES } from '../../data/types';
import type { Rarity } from '../../data/types';
import { EQUIP_POS, gearTotals, makeItem, reqLevel, sellPrice, slotOf, RARITY_HEX, type EquipPos, type GearTotals, type Item } from './Gear';

export interface GroundItem {
  id: number;
  item: Item;
  x: number;
  z: number;
  age: number;
}

/** Saved equipment and bag (lives in the profile between runs). */
export interface GearSave {
  equipped: Partial<Record<EquipPos, Item>>;
  bag: Item[];
}

export const BAG_SIZE = 60;
let groundN = 1;

/**
 * Items during a run: drops on the ground, automatic pickup, the bag and the equipped set.
 * Equipment changes recompute the hero's stats at once.
 */
export class Loot {
  readonly ground: GroundItem[] = [];
  readonly equipped: Record<EquipPos, Item | null>;
  readonly bag: Item[];
  totals: GearTotals;
  readonly powers = new Set<string>();
  /** Items picked up this run (for the results / achievements). */
  found = 0;
  private fullWarnT = 0;
  onPickup: ((it: Item) => void) | null = null;

  constructor(private run: Run, saved: GearSave | null) {
    this.equipped = Object.fromEntries(EQUIP_POS.map((p) => [p, null])) as Record<EquipPos, Item | null>;
    this.bag = [];
    if (saved) {
      for (const p of EQUIP_POS) {
        const it = saved.equipped?.[p];
        if (it && slotOf(p) === it.slot) this.equipped[p] = structuredClone(it);
      }
      for (const it of saved.bag ?? []) if (this.bag.length < BAG_SIZE && it?.slot) this.bag.push(structuredClone(it));
    }
    this.totals = gearTotals([], run.hero.baseHp);
    this.refresh(false);
  }

  /** Replaces the equipment and bag (the open world's town screens edit the saved character). */
  reload(saved: GearSave) {
    for (const p of EQUIP_POS) {
      const it = saved.equipped?.[p];
      this.equipped[p] = it && slotOf(p) === it.slot ? structuredClone(it) : null;
    }
    this.bag.length = 0;
    for (const it of saved.bag ?? []) if (this.bag.length < BAG_SIZE && it?.slot) this.bag.push(structuredClone(it));
    this.refresh();
  }

  serialize(): GearSave {
    const equipped: Partial<Record<EquipPos, Item>> = {};
    for (const p of EQUIP_POS) if (this.equipped[p]) equipped[p] = this.equipped[p]!;
    return { equipped, bag: [...this.bag] };
  }

  private refresh(recompute = true) {
    this.totals = gearTotals(EQUIP_POS.map((p) => this.equipped[p]), this.run.hero.baseHp);
    this.powers.clear();
    for (const id of this.totals.powers) this.powers.add(id);
    if (recompute) this.run.recomputeStats();
  }

  /** Item level for drops right now. */
  get ilvl(): number {
    // items carry the level of the monsters that dropped them
    return Math.max(1, Math.min(PROG.maxLevel, this.run.zoneLevel));
  }

  onKill(e: Enemy) {
    const run = this.run;
    if (e.def.category === 'prop' || e.noReward) return;
    const luck = run.player.stats.luck;
    // each enemy kind has its own chance (category default, `drop` on the def overrides it)
    const kind = e.boss ? (e.def.id === run.map.midBoss ? 'miniboss' : 'boss') : e.elite ? 'elite' : 'normal';
    const P = PROG;
    let chance = (e.def as { drop?: number }).drop ?? P.dropChance[e.def.category] ?? P.dropChance.normal;
    if (e.elite) chance = Math.max(chance, P.dropChance.elite);
    if (e.boss) chance = 1;
    const rolls = kind === 'boss' ? P.bossRolls.boss : kind === 'miniboss' ? P.bossRolls.miniboss : 1;
    const bonus = P.rarityBonus[kind] + (luck - 1) * 0.6;
    for (let i = 0; i < rolls; i++) {
      if (Math.random() >= chance * luck) continue;
      const rar = rollDropRarity(Math.random, bonus, P.mythicFrom.includes(kind));
      this.drop(makeItem(Math.random, this.ilvl, rar), e.x + (Math.random() - 0.5) * 1.2, e.z + (Math.random() - 0.5) * 1.2);
    }
  }

  /** Drops a random item of at least the given rarity tier (chests). Returns its base id. */
  dropAt(x: number, z: number, minTier: number): string | null {
    const rar = rollDropRarity(Math.random, minTier * 0.8 + (this.run.player.stats.luck - 1) * 0.6, minTier >= 3);
    const it = makeItem(Math.random, this.ilvl, rar);
    const a = Math.random() * Math.PI * 2;
    this.drop(it, x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2);
    return it.base;
  }

  drop(item: Item, x: number, z: number) {
    const run = this.run;
    if (run.terrain.blocksWalker(Math.floor(x), Math.floor(z))) {
      x = run.player.x;
      z = run.player.z;
    }
    this.ground.push({ id: groundN++, item, x, z, age: 0 });
    const c = RARITY_HEX[item.rarity];
    run.fx.burst(x, 1, z, c, item.rarity === 'legendary' ? 30 : 10, 3, 0.14, 0.7, 'glow');
    if (item.rarity === 'legendary' || item.rarity === 'epic') run.fx.sound('chestOpen', 0.5);
  }

  update(dt: number) {
    const run = this.run;
    const p = run.player;
    if (this.fullWarnT > 0) this.fullWarnT -= dt;
    let w = 0;
    for (const g of this.ground) {
      g.age += dt;
      const d2 = (g.x - p.x) ** 2 + (g.z - p.z) ** 2;
      if (g.age > 0.5 && d2 < 1.4 * 1.4 && !p.dead) {
        if (this.bag.length >= BAG_SIZE) {
          if (this.fullWarnT <= 0) {
            this.fullWarnT = 3;
            run.fx.text(p.x, p.z, run.tr('inv_full'), 0xff8080);
          }
        } else {
          this.bag.push(g.item);
          this.found++;
          run.fx.sound('powerup', 0.6);
          run.fx.burst(g.x, 0.8, g.z, RARITY_HEX[g.item.rarity], 8, 2, 0.12, 0.4, 'glow');
          this.onPickup?.(g.item);
          continue;
        }
      }
      // ground items last a long while but not forever
      if (g.age > 240) continue;
      this.ground[w++] = g;
    }
    this.ground.length = w;
  }

  // ------------------------------------------------------------------ inventory actions
  /** Equips a bag item; the replaced piece goes back to the bag. */
  equip(item: Item, pos?: EquipPos): boolean {
    const i = this.bag.indexOf(item);
    if (i < 0) return false;
    const target = pos ?? this.bestPos(item);
    if (!target || slotOf(target) !== item.slot) return false;
    if (reqLevel(item) > this.run.player.level) {
      this.run.fx.text(this.run.player.x, this.run.player.z, this.run.tr('inv_req_level').replace('{n}', String(reqLevel(item))), 0xff8080);
      return false;
    }
    const old = this.equipped[target];
    this.bag.splice(i, 1);
    this.equipped[target] = item;
    if (old) this.bag.splice(i, 0, old);
    this.refresh();
    this.run.fx.sound('select', 0.5);
    return true;
  }

  unequip(pos: EquipPos): boolean {
    const it = this.equipped[pos];
    if (!it || this.bag.length >= BAG_SIZE) return false;
    this.equipped[pos] = null;
    this.bag.push(it);
    this.refresh();
    return true;
  }

  /** Where an item would go: the free matching position, else the first one. */
  bestPos(item: Item): EquipPos | null {
    const ps = EQUIP_POS.filter((p) => slotOf(p) === item.slot);
    return ps.find((p) => !this.equipped[p]) ?? ps[0] ?? null;
  }

  /** The equipped piece a bag item would be compared against. */
  compareTarget(item: Item): Item | null {
    const ps = EQUIP_POS.filter((p) => slotOf(p) === item.slot);
    if (ps.some((p) => !this.equipped[p])) return null;
    return this.equipped[ps[0]];
  }

  dropFromBag(item: Item) {
    const i = this.bag.indexOf(item);
    if (i < 0) return;
    this.bag.splice(i, 1);
    const p = this.run.player;
    const g = { id: groundN++, item, x: p.x + p.fx * 1.6, z: p.z + p.fz * 1.6, age: -2 };
    this.ground.push(g);
  }

  sell(item: Item): number {
    const i = this.bag.indexOf(item);
    if (i < 0) return 0;
    this.bag.splice(i, 1);
    const g = sellPrice(item);
    this.run.stats.gold += g;
    this.run.fx.sound('coin', 0.6);
    return g;
  }

  /** Developer: put an item straight into the bag. */
  give(item: Item) {
    if (this.bag.length < BAG_SIZE) this.bag.push(item);
  }
}

/** Rolls a drop's tier from the progression weights; mythic only where allowed. */
export function rollDropRarity(rand: () => number, bonus: number, mythic: boolean): Rarity {
  const w = PROG.rarityWeights.map((x, i) => (i === 4 && !mythic ? 0 : x * (1 + bonus * i)));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) {
    r -= w[i];
    if (r <= 0) return RARITIES[i];
  }
  return 'common';
}
