import { newChar, addCharXp, learn } from '../src/meta/Characters';
import { PROG } from '../src/config/progression';
/**
 * Headless balance simulator: plays runs with a simple kiting bot and prints per-checkpoint metrics.
 * Usage: npx tsx tools/sim.ts [mapId] [heroId] [diffId] [runs] [perm 0|1|2] [mode campaign|endless]
 * Env: GOD=1 (player cannot die; damage is still counted), MAXT=seconds, QUIET=1, DMG=1 (damage sources), DAY=cycle seconds (0 = off, default 300)
 */
import { Run } from '../src/game/Run';
import { NullFx } from '../src/game/types';
import { MAP_BY_ID } from '../src/data/maps';
import { HERO_BY_ID } from '../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../src/data/difficulty';
import { actBot } from './actbot';
import type { StatMods } from '../src/data/types';
import type { Enemy } from '../src/game/Enemy';
import type { RunMode } from '../src/game/Waves';

const [mapId = 'blightwood', heroId = 'berserker', diffId = 'normal', runsArg = '3', permArg = '0', modeArg = 'campaign'] = process.argv.slice(2);
const PERM1: StatMods = { might: 0.25, maxHp: 50, armor: 3, regen: 0.75, growth: 0.25, cooldown: 0.09, area: 0.16, duration: 0.16, luck: 0.24, magnet: 0.6 };
// perm=2: every permanent upgrade maxed, including Multiplier and Second Chance
const PERM2: StatMods = { ...PERM1, moveSpeed: 0.15, critChance: 0.09, projSpeed: 0.24, amount: 1, revival: 1 };
const perm: StatMods = permArg === '2' ? PERM2 : permArg === '1' ? PERM1 : {};
const mode = modeArg as RunMode;
const god = !!process.env.GOD;
const maxT = Number(process.env.MAXT ?? (mode === 'endless' ? 3200 : 1400));

/**
 * Sampling bot: scores 16 headings by predicted danger (enemies, bullets, hazard zones and
 * tiles, walls) against the pull of gems and chests, the way a careful human kites.
 */
export function bot(run: Run, pref = 0): [number, number] {
  const p = run.player;
  const t = run.terrain;
  const near: Enemy[] = [];
  run.enemies.forEachInRadius(p.x, p.z, 10, (e) => {
    if (e.def.category !== 'prop') near.push(e);
  });
  let target: { x: number; z: number } | null = null;
  let bd = 1e9;
  for (const pk of run.pickups.list) {
    if (!pk.active) continue;
    const d = (pk.x - p.x) ** 2 + (pk.z - p.z) ** 2;
    const w = pk.kind === 'chest' ? d * 0.15 : pk.kind === 'xp' ? d : d * 0.7;
    if (w < bd && d < 30 * 30) {
      bd = w;
      target = pk;
    }
  }
  // shrines are worth a detour
  for (const s of run.features.pois) {
    if (s.used || s.kind !== 'shrine') continue;
    const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
    if (d < 25 * 25 && d * 0.3 < bd) {
      bd = d * 0.3;
      target = s;
    }
  }
  const speed = p.moveSpeed;
  let best = -1e9;
  let bx = 0;
  let bz = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let score = 0;
    for (const h of [0.35, 0.8]) {
      const px = p.x + dx * speed * h;
      const pz = p.z + dz * speed * h;
      if (t.blocksWalker(Math.floor(px), Math.floor(pz))) score -= h < 0.5 ? 1000 : 60;
      const c = t.cellAt(px, pz);
      if (c === 3) score -= 40;
      for (const e of near) {
        const ex = e.x + e.vx * h;
        const ez = e.z + e.vz * h;
        const d2 = (ex - px) ** 2 + (ez - pz) ** 2;
        const r = e.radius + p.radius + 0.4;
        score -= (e.boss ? 6 : e.elite ? 2.5 : 1) * (d2 < r * r ? (pref > 0 && pref < 3 ? 6 : 60) : (pref > 0 && pref < 3 ? 0.6 : 4) / (d2 + 0.3));
      }
      for (const b of run.hazards.bullets) {
        if (!b.active) continue;
        const d2 = (b.x + b.vx * h - px) ** 2 + (b.z + b.vz * h - pz) ** 2;
        if (d2 < 1.5) score -= 25;
      }
      for (const z of run.hazards.zones) {
        if (!z.active || z.visualOnly) continue;
        const d = Math.hypot(px - z.x, pz - z.z);
        if (d < z.r + 0.6) score -= 50;
      }
    }
    // fighting distance: melee classes close in, ranged ones keep range
    if (pref > 0 && near.length) {
      let ne = near[0];
      let nd = 1e9;
      for (const e of near) {
        const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
        if (d < nd) {
          nd = d;
          ne = e;
        }
      }
      const d = Math.hypot(ne.x - p.x - dx * speed * 0.5, ne.z - p.z - dz * speed * 0.5);
      score -= Math.abs(d - pref - ne.radius) * (pref < 3 ? 2.2 : 1.2);
    }
    if (target) {
      const tx = target.x - p.x;
      const tz = target.z - p.z;
      const tl = Math.hypot(tx, tz) || 1;
      score += ((tx * dx + tz * dz) / tl) * 1.5;
    }
    // prefer open space: count free cells ahead
    const fx = p.x + dx * 4;
    const fz = p.z + dz * 4;
    if (t.blocksWalker(Math.floor(fx), Math.floor(fz))) score -= 3;
    const c = t.size / 2;
    score += ((c - p.x) * dx + (c - p.z) * dz) * 0.002;
    if (score > best) {
      best = score;
      bx = dx;
      bz = dz;
    }
  }
  if (!near.length && !target) return [0, 0];
  return [bx, bz];
}

const map = MAP_BY_ID[mapId];
const hero = HERO_BY_ID[heroId];
const diff = DIFFICULTY_BY_ID[diffId];
const quiet = !!process.env.QUIET;
const results: string[] = [];
for (let r = 0; r < Number(runsArg); r++) {
  const t0 = performance.now();
  const run = new Run({
    map, diff, hero, permanent: perm, mode,
    fx: NullFx, settings: { damageNumbers: false, dayLength: Number(process.env.DAY ?? 300) }, tr: (k) => k, seed: 1000 + r,
    // LEVEL=n plays a character of that level with its points spread over the skills in order
    char: process.env.LEVEL ? (() => {
      const c = newChar('sim', hero.id);
      addCharXp(c, PROG.xpTotal(Number(process.env.LEVEL)));
      for (let k = 0; c.points > 0 && k < 400; k++) learn(c, k % 8);
      return c;
    })() : null,
  });
  run.debug.god = god;
  // --- instrumentation
  let taken = 0;
  let takenWin = 0;
  const dmgBy: Record<string, number> = {};
  const orig = run.player.hurt.bind(run.player);
  run.player.hurt = (raw, src, ig) => {
    const pl = run.player;
    const would = god && !(pl.invulnT > 0 && !ig) && pl.buffs.aegis <= 0 ? Math.max(1, raw - pl.stats.armor) : 0;
    const d = orig(raw, src, ig) || would;
    if (d > 0) {
      taken += d;
      takenWin += d;
      if (process.env.DMG) {
        const k = src ? src.def.id : 'hazard';
        dmgBy[k] = (dmgBy[k] ?? 0) + d;
      }
    }
    return d;
  };
  const born = new Map<number, number>();
  let lifeSum = 0;
  let lifeN = 0;
  let hpSum = 0;
  let hpN = 0;
  const origSpawn = run.enemies.spawn.bind(run.enemies);
  run.enemies.spawn = (def, x, z, o) => {
    const e = origSpawn(def, x, z, o);
    if (e && !e.boss && def.behavior !== 'prop') {
      born.set(e.uid, run.time);
      hpSum += e.maxHp;
      hpN++;
    }
    return e;
  };
  const origKill = run.combat.killEnemy.bind(run.combat);
  run.combat.killEnemy = (e: Enemy, silent?: boolean) => {
    const b = born.get(e.uid);
    if (b !== undefined && e.alive) {
      lifeSum += run.time - b;
      lifeN++;
      born.delete(e.uid);
    }
    return origKill(e, silent);
  };
  let dealtPrev = 0;
  const dealt = () => Object.values(run.stats.damageBy).reduce((a, b) => a + b, 0);

  const dt = 1 / 30;
  let maxEnemies = 0;
  let lastLog = 0;
  let lastWave = 0;
  let steps = 0;
  const marks = mode === 'endless' ? [10, 20, 30, 50, 70, 100] : [];
  const minuteMarks = [3, 5, 7, 10, 12, 15, 17];
  const line = (tag: string) => {
    const span = Math.max(1, run.time - lastLog);
    const d = dealt();
    const dps = (d - dealtPrev) / span;
    dealtPrev = d;
    const avgHp = hpN ? hpSum / hpN : 0;
    const out = `  ${tag.padEnd(7)} t=${run.time.toFixed(0).padStart(4)} wave=${String(run.waves.wave.n).padStart(3)}(${run.waves.wave.type}) lvl=${String(run.player.level).padStart(2)} hp=${run.player.hp.toFixed(0)}/${run.player.stats.maxHp.toFixed(0)} alive=${run.enemies.aliveCount} kills=${run.stats.kills} dmgIn/s=${(takenWin / span).toFixed(1)} enemyHP=${avgHp.toFixed(0)} dps=${dps.toFixed(0)} ttkFull=${dps ? (avgHp / dps).toFixed(3) : '-'}s life=${lifeN ? (lifeSum / lifeN).toFixed(1) : '-'}s xp=${run.stats.xpGained.toFixed(0)} gold=${run.stats.gold.toFixed(0)} chests=${run.stats.chestRarity.join('/')} bosses=${run.stats.bossesKilled.length}/${run.stats.bossesSeen}`;
    lastLog = run.time;
    takenWin = 0;
    hpSum = hpN = lifeSum = lifeN = 0;
    if (!quiet) console.log(out);
  };
  while (run.state !== 'dead' && run.state !== 'victory' && run.time < maxT && steps < 200000) {
    steps++;
    if (run.state === 'chest') {
      run.closeChest();
      continue;
    }
    const pref = actBot(run, dt);
    const [ix, iz] = bot(run, pref);
    run.update(dt, ix, iz);
    maxEnemies = Math.max(maxEnemies, run.enemies.aliveCount);
    if (mode === 'campaign') {
      const m = minuteMarks.find((mm) => run.time >= mm * 60 && lastLog < mm * 60);
      if (m) line(m + 'min');
      if (run.waves.wave.n !== lastWave && [25, 30].includes(run.waves.wave.n)) line('W' + run.waves.wave.n);
    } else if (run.waves.wave.n !== lastWave && marks.includes(run.waves.wave.n)) line('W' + run.waves.wave.n);
    lastWave = run.waves.wave.n;
  }
  line('END');
  const s = run.summary();
  const ms = performance.now() - t0;
  const res = `RUN ${r}: ${s.victory ? 'VICTORY' : run.state === 'dead' || run.ending ? 'DEAD' : 'TIMEOUT'} time=${s.time.toFixed(0)} wave=${s.wave} level=${s.level} kills=${s.kills} maxAlive=${maxEnemies} taken=${taken.toFixed(0)} runGold=${s.gold} reward=${Run.goldReward(s, diff.reward)} elites=${s.elites} chests=${s.chestRarity.join('/')} bosses=${s.bosses.join('/')} xp=${run.stats.xpGained.toFixed(0)} staggers=${run.stats.combos} casts=${run.stats.skillsCast} sim=${(ms / 1000).toFixed(1)}s`;
  results.push(res);
  console.log(res);
  if (process.env.DMG) console.log('  taken by:', Object.entries(dmgBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v.toFixed(0)).join(' '));
}
