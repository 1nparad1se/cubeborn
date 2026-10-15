/** Statistics of one play session (shown on the character card and in the pause menu). */
export class RunStats {
  kills = 0;
  damageBy: Record<string, number> = {};
  damageTaken = 0;
  xpGained = 0;
  jumps = 0;
  crits = 0;
  combos = 0;
  skillsCast = 0;
  dodges = 0;
  lastHurt = 0;
  noHitBest = 0;
  totalDamage = 0;

  addDamage(id: string, v: number) {
    this.damageBy[id] = (this.damageBy[id] ?? 0) + v;
    this.totalDamage += v;
  }
}
