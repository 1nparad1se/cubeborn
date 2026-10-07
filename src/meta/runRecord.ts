import { Run } from '../game/Run';

/**
 * What one run adds to the lifetime stats: `add` keys are summed, `max` keys keep the best.
 * finishRun applies it to the profile; during a run the same record lets achievements unlock
 * live (Profile.checkAchievements with a projection) without touching the save.
 */
export interface RunRecord {
  add: Record<string, number>;
  max: Record<string, number>;
}

export function runRecord(run: Run, goldEarned: number): RunRecord {
  const s = run.summary();
  const st = run.stats;
  const add: Record<string, number> = {
    gold: goldEarned,
    kills: s.kills,
    runs: 1,
    elites: s.elites,
    chests: s.chests,
    treasureSprites: s.treasureSprites,
    bossKills: s.bosses.length,
    jumps: st.jumps,
    nights: st.nights,
    nightsSurvived: st.nightsSurvived,
    bloodMoons: st.bloodMoons,
    nightBosses: st.nightBosses,
    nightBossKills: st.nightBossKills,
    nightKills: st.nightKills,
    dayKills: st.dayKills,
    sleepersKilled: st.sleepersKilled,
    direKilled: st.direKilled,
    crits: st.crits,
    damage: Math.round(st.totalDamage),
    ['mapplay_' + run.map.id]: 1,
    ['heroplay_' + run.hero.id]: 1,
  };
  if (run.mode === 'endless') add.endlessRuns = 1;
  for (const [id, n] of Object.entries(st.killsBy)) add['kill_' + id] = n;
  for (const [el, n] of Object.entries(st.elementKills)) add['ek_' + el] = n;
  for (const id of s.bosses) add['boss_' + id] = (add['boss_' + id] ?? 0) + 1;
  const max: Record<string, number> = {
    bestRunKills: s.kills,
    bestLevel: s.level,
    bestTime: s.time,
    bestRunEvos: s.evolutions.length,
    bestWeaponCount: s.weaponCount,
    maxedWeapons: s.maxedWeapons,
    bestRunNights: st.nightsSurvived,
    bestNoHit: Math.max(st.noHitBest, run.time - st.lastHurt),
  };
  if (run.mode === 'endless') {
    max.bestEndlessWave = s.wave;
    max.bestEndlessTime = s.time;
  }
  return { add, max };
}

/** Estimated gold for a run still in progress (the same formula the results screen uses). */
export function runGold(run: Run): number {
  return Run.goldReward(run.summary(), run.diff.reward);
}
