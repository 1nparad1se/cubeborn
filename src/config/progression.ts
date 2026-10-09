import type { Rarity } from '../data/types';

/**
 * Long-term progression: character levels 1..50, zone levels of the maps, item drops,
 * enhancement, dismantling and stone crafting. Every number of the grind lives here.
 *
 * Pacing target (an average player on maps of their level):
 *   level 10 ≈ 1.5 h, level 20 ≈ 8 h, level 30 ≈ 40 h, level 40 ≈ 100 h, level 50 ≈ 200+ h.
 * Item side: a full +15 mythic set is a several-hundred-hour goal.
 */
export const PROG = {
  maxLevel: 50,
  /** Skills unlock one per level in Q W E R A S D F order until this level; afterwards each level gives a skill point. */
  autoSkillLevels: 8,
  skillMax: 8,

  /** Experience to go from `level` to `level + 1`. */
  xpForLevel(level: number): number {
    if (level >= 50) return Infinity;
    return Math.round(22 * level * level * Math.pow(1.08, level - 1));
  },
  /** Total experience from level 1 to `level`. */
  xpTotal(level: number): number {
    let s = 0;
    for (let l = 1; l < level; l++) s += PROG.xpForLevel(l);
    return s;
  },

  /** Character stat growth per level above 1 (added to the class base). */
  perLevel: { might: 0.03, maxHpPct: 0.045, armor: 0.25, regen: 0.04 },

  /** Zone level of a map on a difficulty: map base + difficulty step. */
  /** Monster level range of each map: the first wave starts at the low end, the last campaign wave reaches the top. */
  mapRange: { blightwood: [1, 10], gloamhaven: [11, 20], ossuary: [21, 30], emberwaste: [31, 40], frostveil: [41, 50], aetherfall: [41, 50] } as Record<string, [number, number]>,
  /** Monster level on a map at a wave (campaign has 30 waves; Endless keeps climbing to 50). */
  mobLevel(mapId: string, wave: number): number {
    const [lo, hi] = PROG.mapRange[mapId] ?? [1, 10];
    const lv = lo + Math.floor(((Math.max(1, wave) - 1) / 29) * (hi - lo + 0.999));
    return Math.min(50, Math.max(lo, lv));
  },
  /** Hero level needed to wear each item tier: simple 1+, common 11+, epic 21+, legendary 31+, mythic 41+. */
  tierLevel: [1, 11, 21, 31, 41],
  /**
   * Enemies scale with the gap between the zone and the hero: +6% hp / +4% damage per level the zone
   * is above the hero, down to −3%/level below (capped), so out-levelled maps are easy and over-reaching hurts.
   */
  enemyScale(zone: number, hero: number): { hp: number; dmg: number } {
    const d = zone - hero;
    if (d >= 0) return { hp: Math.min(4, Math.pow(1.06, d)), dmg: Math.min(3, Math.pow(1.04, d)) };
    return { hp: Math.max(0.55, Math.pow(0.97, -d)), dmg: Math.max(0.6, Math.pow(0.975, -d)) };
  },
  /** Experience per kill: grows with the zone level, falls off when the hero out-levels the zone by more than 5. */
  xpMul(zone: number, hero: number): number {
    const base = Math.pow(1.08, zone - 1);
    const over = hero - zone - 5;
    return base * (over > 0 ? Math.max(0.1, 1 - over * 0.15) : 1);
  },

  // ------------------------------------------------------------------ drops
  /** Chance a killed enemy drops an item, by category (an enemy def `drop` overrides it). */
  dropChance: { normal: 0.012, fast: 0.012, ranged: 0.016, tank: 0.04, elite: 0.22, miniboss: 1, boss: 1 } as Record<string, number>,
  /** Number of rolls for bosses. */
  bossRolls: { miniboss: 2, boss: 4 },
  /** Rarity weights (sum 100): simple, common, epic, legendary, mythic. */
  rarityWeights: [64, 27.5, 7.4, 1.0, 0.1],
  /** Elite / boss shift toward rarer items (multiplies the weight of tier i by 1 + bonus·i). */
  rarityBonus: { normal: 0, elite: 1.2, miniboss: 2.5, boss: 4 },
  /** Mythic items only drop from elites and bosses. */
  mythicFrom: ['elite', 'miniboss', 'boss'],
  /** Relative chance of each base item (rings, amulets and idols are rarer). */
  baseWeight: { blade: 10, axe: 10, staff: 10, bow: 10, helm: 9, hood: 9, plate: 8, robe: 8, gloves: 9, boots: 9, amulet: 4, ring: 5, idol: 3 } as Record<string, number>,

  // ------------------------------------------------------------------ stones and forge
  /** Stats gained per enhancement level (fraction of the item's base values). */
  enhStep: 0.06,
  enhMax: 15,
  /** Stones of the item's own tier per enhancement step k (0 → +1 is k = 0); rarer tiers need fewer, rarer stones. */
  enhStones(k: number, tier = 0): number {
    return Math.ceil((1 + k * 0.5 + Math.pow(k, 1.7) * 0.1) * [3, 2.2, 1.6, 1.2, 1][tier]);
  },
  /** Gold per enhancement step, by tier. */
  enhGold(k: number, tier: number): number {
    return Math.round((10 + k * k * 6) * [1, 2, 4, 8, 16][tier]);
  },
  /** Success chance of step k: sure up to +3, then falls to 8% at +14 → +15. */
  enhChance(k: number): number {
    if (k < 3) return 1;
    return Math.max(0.08, 1 - (k - 2) * 0.077);
  },
  /** Each failure adds this share of the base chance until the step succeeds (artisan's pity). */
  enhPity: 0.1,
  /** Stones returned by dismantling: base by tier, more for higher item levels, half of the stones spent on enhancement. */
  dismantleStones(ilvl: number, enhSpent: number): number {
    return 1 + Math.floor(ilvl / 8) + Math.floor(enhSpent * 0.5);
  },
  /** Stones of one tier needed to craft a single stone of the next tier, and its gold cost. */
  craftRatio: 10,
  craftGold: [15, 60, 250, 1000],
};

export const STONE_TIERS = 5;
export const TIER_OF: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
