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
  jumps = 0;
  /** Day/night. */
  nights = 0;
  nightsSurvived = 0;
  bloodMoons = 0;
  nightBosses = 0;
  nightKills = 0;
  dayKills = 0;
  sleepersKilled = 0;
  direKilled = 0;
  /** Achievements: critical hits, kills per skill element, the longest stretch without taking damage. */
  crits = 0;
  /** Mob wind-ups broken by the hero's hits. */
  interrupts = 0;
  combos = 0;
  skillsCast = 0;
  dodges = 0;
  nightBossKills = 0;
  elementKills: Record<string, number> = {};
  lastHurt = 0;
  noHitBest = 0;
  totalDamage = 0;

  addDamage(id: string, v: number) {
    this.damageBy[id] = (this.damageBy[id] ?? 0) + v;
    this.totalDamage += v;
  }
}
