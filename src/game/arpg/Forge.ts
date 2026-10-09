import { PROG, STONE_TIERS, TIER_OF } from '../../config/progression';
import type { Item } from './Gear';

/**
 * The forge: enhancing items with stones of their own tier, dismantling items into stones and
 * crafting higher stones from lower ones. Pure functions over a wallet (character stones + gold).
 */
export interface Wallet {
  stones: number[];
  gold: number;
}

export interface EnhanceCost {
  tier: number;
  stones: number;
  gold: number;
  chance: number;
}

/** Cost and chance of the next enhancement step, or null at the cap. */
export function enhanceCost(it: Item): EnhanceCost | null {
  const k = it.enh ?? 0;
  if (k >= PROG.enhMax) return null;
  const tier = TIER_OF[it.rarity];
  const base = PROG.enhChance(k);
  const chance = Math.min(1, base + (it.pity ?? 0) * base * PROG.enhPity);
  return { tier, stones: PROG.enhStones(k, tier), gold: PROG.enhGold(k, tier), chance };
}

export type EnhanceResult = 'ok' | 'fail' | 'cap' | 'stones' | 'gold';

/** One enhancement attempt. Failure keeps the level, spends the cost and raises the next chance. */
export function enhance(it: Item, w: Wallet, rand: () => number = Math.random): EnhanceResult {
  const c = enhanceCost(it);
  if (!c) return 'cap';
  if (w.stones[c.tier] < c.stones) return 'stones';
  if (w.gold < c.gold) return 'gold';
  w.stones[c.tier] -= c.stones;
  w.gold -= c.gold;
  it.enhSpent = (it.enhSpent ?? 0) + c.stones;
  if (rand() < c.chance) {
    it.enh = (it.enh ?? 0) + 1;
    it.pity = 0;
    return 'ok';
  }
  it.pity = (it.pity ?? 0) + 1;
  return 'fail';
}

/** Stones an item gives when dismantled (its own tier). */
export function dismantleValue(it: Item): { tier: number; stones: number } {
  return { tier: TIER_OF[it.rarity], stones: PROG.dismantleStones(it.ilvl, it.enhSpent ?? 0) };
}

export function dismantle(it: Item, w: Wallet) {
  const v = dismantleValue(it);
  w.stones[v.tier] += v.stones;
  return v;
}

/** Crafts `n` stones of tier `to` from tier `to - 1`. Returns how many were made. */
export function craftStones(w: Wallet, to: number, n = 1): number {
  if (to < 1 || to >= STONE_TIERS) return 0;
  let made = 0;
  for (let i = 0; i < n; i++) {
    if (w.stones[to - 1] < PROG.craftRatio || w.gold < PROG.craftGold[to - 1]) break;
    w.stones[to - 1] -= PROG.craftRatio;
    w.gold -= PROG.craftGold[to - 1];
    w.stones[to]++;
    made++;
  }
  return made;
}

/** Most stones of tier `to` that can be crafted right now. */
export function craftMax(w: Wallet, to: number): number {
  if (to < 1 || to >= STONE_TIERS) return 0;
  return Math.max(0, Math.min(Math.floor(w.stones[to - 1] / PROG.craftRatio), Math.floor(w.gold / PROG.craftGold[to - 1])));
}
