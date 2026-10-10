/**
 * Headless open-world check: a bot hunts in the world for MAXT seconds per class and reports
 * spawn density, respawns, leashes, deaths and the experience rate against PROG.xpForLevel.
 * Usage: npx tsx tools/worldsim.ts [classes comma list | all] ; env MAXT=600 (seconds), LEVEL=n, SEED=n, MAP=blightwood
 */
import { Run } from '../src/game/Run';
import { NullFx } from '../src/game/types';
import { MAP_BY_ID } from '../src/data/maps';
import { HEROES, HERO_BY_ID } from '../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../src/data/difficulty';
import { PROG } from '../src/config/progression';
import { newChar, addCharXp, learn } from '../src/meta/Characters';
import { findPath } from '../src/game/arpg/Path';
import { actBot } from './actbot';
import type { Enemy } from '../src/game/Enemy';

const arg = process.argv[2] ?? 'all';
const ids = arg === 'all' ? HEROES.map((h) => h.id) : arg.split(',');
const maxT = Number(process.env.MAXT ?? 600);
const map = MAP_BY_ID[process.env.MAP ?? 'blightwood'];
const dt = 1 / 40;

function hunt(run: Run, pref: number, st: { goal: { x: number; z: number } | null; path: number[]; pi: number; repath: number; home: boolean }): [number, number] {
  const p = run.player;
  const w = run.world!;
  const toward = (x: number, z: number): [number, number] => {
    const d = Math.hypot(x - p.x, z - p.z) || 1;
    return [(x - p.x) / d, (z - p.z) / d];
  };
  // low health: back to town until healed
  if (p.hp < p.stats.maxHp * 0.35) st.home = true;
  if (st.home && w.inSafe(p.x, p.z) && p.hp > p.stats.maxHp * 0.95) st.home = false;
  let tgt: Enemy | null = null;
  let td = 1e9;
  if (!st.home)
    run.enemies.forEachInRadius(p.x, p.z, 12, (e) => {
      if (e.def.category === 'prop' || e.returning) return;
      const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
      if (d < td) {
        td = d;
        tgt = e;
      }
    });
  if (tgt) {
    const e = tgt as Enemy;
    const d = Math.sqrt(td);
    if (d > pref + 0.5) return toward(e.x, e.z);
    if (d < pref - 1.5) {
      const [x, z] = toward(e.x, e.z);
      return [-x, -z];
    }
    return [0, 0];
  }
  // pick a camp of a fitting level that has someone home
  st.repath -= dt;
  if (st.home) st.goal = w.town;
  else if (!st.goal || Math.hypot(st.goal.x - p.x, st.goal.z - p.z) < 3 || st.repath < -20) {
    let best = null as { x: number; z: number } | null;
    let bd = 1e9;
    for (const c of w.camps) {
      if (c.def.level > p.level + 1 || c.def.level < p.level - 4) continue;
      if (!c.members.some((m) => run.time >= m.deadUntil)) continue;
      const d = Math.hypot(c.hx - p.x, c.hz - p.z) + Math.random() * 25;
      if (d < 6 || d > bd) continue;
      bd = d;
      best = { x: c.hx, z: c.hz };
    }
    st.goal = best;
    st.repath = 0;
  }
  if (!st.goal) return [0, 0];
  if (st.repath <= 0 || st.pi >= st.path.length) {
    st.repath = 1;
    const g = st.goal;
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    const k = Math.min(1, 45 / d);
    st.path = findPath(run.terrain, p.x, p.z, p.x + (g.x - p.x) * k, p.z + (g.z - p.z) * k, 20000);
    st.pi = 0;
  }
  while (st.pi < st.path.length && Math.hypot(st.path[st.pi] - p.x, st.path[st.pi + 1] - p.z) < 0.5) st.pi += 2;
  if (st.pi < st.path.length) return toward(st.path[st.pi], st.path[st.pi + 1]);
  return toward(st.goal.x, st.goal.z);
}

let failed = 0;
for (const id of ids) {
  const hero = HERO_BY_ID[id];
  const t0 = performance.now();
  const lvl0 = Number(process.env.LEVEL ?? 1);
  const ch = newChar('sim', id);
  if (lvl0 > 1) {
    addCharXp(ch, PROG.xpTotal(lvl0));
    for (let k = 0; ch.points > 0 && k < 400; k++) learn(ch, k % 8);
  }
  const run = new Run({ map, diff: DIFFICULTY_BY_ID.normal, hero, permanent: {}, fx: NullFx, settings: { damageNumbers: false, dayLength: 300 }, tr: (k) => k, mode: 'world', seed: Number(process.env.SEED ?? 77), char: ch });
  const genMs = performance.now() - t0;
  const w = run.world!;
  const st = { goal: null as { x: number; z: number } | null, path: [] as number[], pi: 0, repath: 0, home: false };
  let aliveSum = 0;
  let aliveMax = 0;
  let samples = 0;
  let maxFar = 0;
  let stepMs = 0;
  let stepMax = 0;
  let err = '';
  const xpStart = PROG.xpTotal(run.player.level) + run.player.xp;
  try {
    while (run.time < maxT) {
      const pref = actBot(run, dt);
      const [ix, iz] = hunt(run, pref, st);
      const s0 = performance.now();
      run.update(dt, ix, iz);
      const sm = performance.now() - s0;
      stepMs += sm;
      stepMax = Math.max(stepMax, sm);
      if (Math.floor(run.time / dt) % 40 === 0) {
        samples++;
        aliveSum += run.enemies.aliveCount;
        aliveMax = Math.max(aliveMax, run.enemies.aliveCount);
        maxFar = Math.max(maxFar, w.distToTown(run.player.x, run.player.z));
      }
    }
  } catch (e) {
    err = (e as Error).stack?.split('\n').slice(0, 4).join(' | ') ?? String(e);
    failed++;
  }
  const p = run.player;
  const xpGain = PROG.xpTotal(p.level) + p.xp - xpStart;
  const perMin = xpGain / (run.time / 60);
  const minsToNext = PROG.xpForLevel(p.level) / Math.max(1, perMin);
  const steps = run.time / dt;
  console.log(
    `${id.padEnd(11)} gen=${(genMs / 1000).toFixed(1)}s t=${run.time.toFixed(0)}s lvl ${lvl0}->${p.level} kills=${run.stats.kills} xp/min=${perMin.toFixed(0)} (next lv needs ${PROG.xpForLevel(p.level)} ≈ ${minsToNext.toFixed(1)} min) ` +
      `alive avg=${(aliveSum / Math.max(1, samples)).toFixed(0)} max=${aliveMax} spawned=${w.stats.spawned} respawned=${w.stats.respawned} leashed=${w.stats.leashed} snapped=${w.stats.snapped} deaths=${w.stats.deaths} items=${run.loot.found} far=${maxFar.toFixed(0)} area=${w.areaAt(p.x, p.z)?.name.en ?? 'town'} ` +
      `step avg=${(stepMs / steps).toFixed(2)}ms max=${stepMax.toFixed(1)}ms` + (err ? `\n  EXCEPTION ${err}` : ''),
  );
}
// ---- leash check: get chased by an aggressive pack, walk away, the pack gives up, goes home and heals
{
  const run = new Run({ map, diff: DIFFICULTY_BY_ID.normal, hero: HERO_BY_ID.berserker, permanent: {}, fx: NullFx, settings: { damageNumbers: false, dayLength: 0 }, tr: (k) => k, mode: 'world', seed: 5 });
  const w = run.world!;
  run.debug.god = true;
  const c = w.camps.find((k) => k.def.aggressive && k.def.kind === 'pack' && k.def.level <= 3 && w.distToTown(k.hx, k.hz) > 70)!;
  w.moveHero(c.hx + 5, c.hz);
  for (let i = 0; i < 80; i++) run.update(dt, 0, 0);
  const mem = () => c.members.map((m) => m.e).filter((e): e is Enemy => !!e && e.alive);
  const engaged0 = mem().filter((e) => e.engaged).length;
  // hit one so it is hurt when it gives up
  const hurt = mem()[0];
  if (hurt) hurt.hp *= 0.5;
  const ang = Math.atan2(run.player.z - c.hz, run.player.x - c.hx);
  let maxChase = 0;
  for (let i = 0; i < 600; i++) {
    const p = run.player;
    const nx = p.x + Math.cos(ang) * 0.15;
    const nz = p.z + Math.sin(ang) * 0.15;
    if (run.terrain.walkableAt(nx, nz)) {
      p.x = nx;
      p.z = nz;
    } else p.z += 0.15;
    run.update(dt, 0, 0);
    for (const e of mem()) maxChase = Math.max(maxChase, Math.hypot(e.x - e.homeX, e.z - e.homeZ));
  }
  for (let i = 0; i < 400; i++) run.update(dt, 0, 0);
  const after = mem();
  const home = after.filter((e) => !e.returning && !e.engaged && Math.hypot(e.x - e.homeX, e.z - e.homeZ) < 6 && e.hp >= e.maxHp - 0.01).length;
  console.log(`LEASH camp lv${c.def.level} members=${c.members.length} engaged=${engaged0} maxChase=${maxChase.toFixed(1)} (leashR=${26}) leashed=${w.stats.leashed} snapped=${w.stats.snapped} backHomeHealed=${home}/${after.length} heroDist=${Math.hypot(run.player.x - c.hx, run.player.z - c.hz).toFixed(0)}`);
  if (!engaged0 || home !== after.length) failed++;
}
process.exit(failed ? 1 : 0);
