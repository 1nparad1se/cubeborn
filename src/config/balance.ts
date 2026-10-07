/** Global tuning constants. Content-specific numbers live in /src/data. */
export const BALANCE = {
  /** Length of a campaign run up to the final boss wave (30 waves of 36 s). */
  runDuration: 1044,
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
  // Early levels come quickly; later ones grow polynomially more expensive.
  xpForLevel(level: number): number {
    const l = level - 1;
    return Math.round(6 + l * 6 + 0.25 * Math.pow(l, 2.7));
  },
  /** XP gems merge into a single gem when more than this many are on the floor. */
  maxGems: 450,
  gemPullSpeed: 14,

  // enemies
  spawnRadiusMin: 20,
  spawnRadiusMax: 25,
  despawnRadius: 42,
  separationStrength: 7,
  hardCap: 1400,
  /** Global multiplier on boss health. */
  bossHpMul: 1.8,
  /** Elites gain extra health per wave on top of the wave scaling. */
  eliteHpPerWave: 0.02,

  /** Wave scaling (see game/Waves.ts). s = wave - 1. */
  waves: {
    length: 36,
    endlessLength: 30,
    hpLin: 0.08,
    hpQuad: 0.011,
    dmgLin: 0.05,
    dmgQuad: 0.0045,
    speedLin: 0.006,
    speedQuad: 0.00015,
    speedCap: 1.3,
    speedCapEndless: 1.45,
    countLin: 0.006,
    expStart: 50,
    expHp: 1.05,
    expDmg: 1.05,
    exp2Start: 80,
    exp2Hp: 1.08,
    exp2Dmg: 1.1,
    eliteBase: 0.0008,
    elitePerWave: 0.00028,
    eliteMax: 0.012,
    rateBase: 70,
    rateLin: 18,
    rateQuad: 0.4,
    maxBase: 60,
    maxLin: 20,
    maxQuad: 0.6,
  },

  // drops
  // Gold is ~10x scarcer than in v1: every source was scaled down together.
  goldDropChance: 0.008,
  heartDropChance: 0.0025,
  magnetDropChance: 0.0015,
  powerupDropChance: 0.002,
  eliteChestChance: 0.025,
  /** Elite chest chance while a weapon can evolve, so evolutions stay reachable. */
  evoChestChance: 0.4,
  crateCount: 70,

  // level up
  choiceCount: 3,
  extraChoiceLuck: 0.25,
  baseRerolls: 1,
  baseSkips: 1,
  baseBanish: 0,

  // rewards
  goldPerKill: 0.006,
  goldPerMinute: 0.8,
  goldVictoryBonus: 30,
  goldBossBonus: 12,
  /** Endless: gold per wave reached. */
  goldPerWave: 0.6,
};
