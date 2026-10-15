/**
 * Character progression: levels 1..50, experience per level, skill unlocks and stat growth.
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

  /** Character stat growth per level above 1 (added to the class base). */
  perLevel: { might: 0.03, maxHpPct: 0.045, armor: 0.25, regen: 0.04 },
};
