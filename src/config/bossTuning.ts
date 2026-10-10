/**
 * Boss tuning. Bosses fight the hero one on one inside an arena, so their numbers are set
 * against an on-level hero (character level ≈ monster level, gear of that level) rather than
 * against the wave curve of the common monsters:
 *   - health ≈ what such a hero deals in ~2 minutes of good play (bosses also recover, dodge-roll
 *     windows and stagger breaks eat into that, so a fight lands around 1.5–3 min);
 *   - damage: a heavy skill (multiplier ~1.5) takes ~20–30% of such a hero's health, so four or
 *     five clean mistakes kill.
 * Every boss def multiplies these with its own `hp` / `damage` (map final bosses are tougher),
 * then the difficulty and the zone/hero level gap (PROG.enemyScale) apply.
 */
export const BOSS_TUNING = {
  /** Health at monster level 1 and its growth per level. */
  hpBase: 8200,
  hpGrowth: 1.093,
  /**
   * Damage is solved against a reference on-level hero (health and armor by level, see
   * refHp / refArmor) so that a heavy skill (x1.5) takes `heavyShare` of its health after armor.
   */
  heavyShare: 0.17,
  refHp: (level: number) => 150 + 15 * level,
  refArmor: (level: number) => 4 + 1.1 * level,
  /** Stagger bar: base + sqrt(maxHp) * k (each phase adds 25%). */
  stagBase: 260,
  stagSqrt: 2.4,
  /** Stagger check: damage needed = base + sqrt(maxHp) * k. */
  checkBase: 140,
  checkSqrt: 1.4,
  /** Seconds between stagger checks (plus up to 10 s of jitter). */
  checkEvery: 30,
  /** Arena radius (world units). */
  arenaR: 15,
};

/** Health and damage of a boss at a monster level (before the boss's own multipliers). */
export function bossLevelScale(level: number): { hp: number; dmg: number } {
  const T = BOSS_TUNING;
  const lv = Math.max(1, Math.min(60, level));
  const hp = T.hpBase * Math.pow(T.hpGrowth, lv - 1);
  // invert the hero's armor formula (Player.hurt): post = raw * (1 - min(0.6, 1.5% armor)) - armor / 2
  const a = T.refArmor(lv);
  const dmg = (T.heavyShare * T.refHp(lv) + a * 0.5) / (1.5 * (1 - Math.min(0.6, a * 0.015)));
  return { hp, dmg };
}
