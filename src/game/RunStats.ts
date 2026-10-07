/** Statistics collected during one run; used for results, achievements and collection. */
export class RunStats {
  kills = 0;
  killsBy: Record<string, number> = {};
  damageBy: Record<string, number> = {};
  gold = 0;
  elites = 0;
  chests = 0;
  damageTaken = 0;
  treasureSprites = 0;
  bossesKilled: string[] = [];
  bossesSeen = 0;
  /** Chests opened by rarity index (common..legendary). */
  chestRarity = [0, 0, 0, 0, 0];
  xpGained = 0;
  evolutions: string[] = [];
  seen = new Set<string>();
  weaponsUsed = new Set<string>();
  discovered = new Set<string>();
  maxedWeapons = 0;

  addDamage(id: string, v: number) {
    this.damageBy[id] = (this.damageBy[id] ?? 0) + v;
  }
}
