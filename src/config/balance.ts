/** Global tuning constants. Content-specific numbers live in /src/data. */
export const BALANCE = {
  runDuration: 900,
  weaponSlots: 6,
  passiveSlots: 6,
  passiveMaxDefault: 5,

  // player
  basePickupRadius: 1.6,
  hurtInvuln: 0.12,
  contactInterval: 0.5,
  armorMin: 1,
  maxCooldownReduction: 0.6,
  maxDodge: 0.6,

  // experience: xp required to go from level L to L+1
  xpForLevel(level: number): number {
    if (level < 20) return 5 + (level - 1) * 9;
    if (level < 40) return 176 + (level - 20) * 14;
    return 456 + (level - 40) * 18;
  },
  /** XP gems merge into a single gem when more than this many are on the floor. */
  maxGems: 450,
  gemPullSpeed: 14,

  // enemies
  spawnRadiusMin: 20,
  spawnRadiusMax: 25,
  despawnRadius: 42,
  enemyHpPerMinute: 0.18,
  enemyHpPerMinuteLate: 0.45,
  enemyDamagePerMinute: 0.05,
  separationStrength: 7,
  eliteChanceStart: 180,
  eliteChancePerMin: 0.0009,
  hardCap: 1400,

  // drops
  goldDropChance: 0.04,
  heartDropChance: 0.004,
  magnetDropChance: 0.0015,
  powerupDropChance: 0.002,
  eliteChestChance: 0.7,
  crateCount: 70,

  // level up
  choiceCount: 3,
  extraChoiceLuck: 0.25,
  baseRerolls: 1,
  baseSkips: 1,
  baseBanish: 0,

  // rewards
  goldPerKill: 0.06,
  goldPerMinute: 8,
  goldVictoryBonus: 250,
  goldBossBonus: 120,
};
