/**
 * Headless balance simulator: plays runs with a simple kiting bot and prints outcomes.
 * Usage: npx tsx tools/sim.ts [mapId] [heroId] [diffId] [runs]
 */
import { Run } from '../src/game/Run';
import { NullFx } from '../src/game/types';
import { MAP_BY_ID } from '../src/data/maps';
import { HERO_BY_ID } from '../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../src/data/difficulty';
import { WEAPONS } from '../src/data/weapons';
import { PASSIVES } from '../src/data/passives';
import type { StatMods } from '../src/data/types';

const [mapId = 'blightwood', heroId = 'bram', diffId = 'normal', runsArg = '3', permArg = '0'] = process.argv.slice(2);
const perm: StatMods = permArg === '1' ? { might: 0.25, maxHp: 50, armor: 3, regen: 0.75, growth: 0.25, cooldown: 0.09, area: 0.16, duration: 0.16, luck: 0.24, magnet: 0.6 } : {};

function bot(run: Run): [number, number] {
  const p = run.player;
  // repulsion from nearby enemies + bullets, attraction to xp and chests
  let fx = 0;
  let fz = 0;
  run.enemies.forEachInRadius(p.x, p.z, 6, (e) => {
    if (e.def.category === 'prop') return;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d2 = dx * dx + dz * dz + 0.1;
    const w = (e.boss ? 6 : 1) / d2;
    fx += dx * w;
    fz += dz * w;
  });
  for (const b of run.hazards.bullets) {
    if (!b.active) continue;
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 9) {
      fx += (dx / (d2 + 0.1)) * 2;
      fz += (dz / (d2 + 0.1)) * 2;
    }
  }
  for (const z of run.hazards.zones) {
    if (!z.active || z.visualOnly) continue;
    const dx = p.x - z.x;
    const dz = p.z - z.z;
    const d = Math.hypot(dx, dz);
    if (d < z.r + 1) {
      fx += (dx / (d + 0.1)) * 4;
      fz += (dz / (d + 0.1)) * 4;
    }
  }
  let best: { x: number; z: number } | null = null;
  let bd = 1e9;
  for (const pk of run.pickups.list) {
    if (!pk.active) continue;
    const d = (pk.x - p.x) ** 2 + (pk.z - p.z) ** 2;
    const w = pk.kind === 'chest' ? d * 0.2 : d;
    if (w < bd && d < 400) {
      bd = w;
      best = pk;
    }
  }
  if (best) {
    const dx = best.x - p.x;
    const dz = best.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    fx += (dx / d) * 0.6;
    fz += (dz / d) * 0.6;
  }
  // avoid hazard tiles (lava, spikes) and walls like a human would
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (const rr of [0.8, 1.6]) {
      const sx = p.x + Math.cos(ang) * rr;
      const sz = p.z + Math.sin(ang) * rr;
      const c = run.terrain.cellAt(sx, sz);
      if (c === 3 || c === 1 || c === 5 || c === 2) {
        fx -= Math.cos(ang) * (c === 3 ? 3 : 1) / rr;
        fz -= Math.sin(ang) * (c === 3 ? 3 : 1) / rr;
      }
    }
  }
  // drift toward map center to avoid corners
  const c = run.terrain.size / 2;
  fx += (c - p.x) * 0.004;
  fz += (c - p.z) * 0.004;
  const l = Math.hypot(fx, fz);
  if (l < 0.05) return [0, 0];
  return [fx / l, fz / l];
}

const map = MAP_BY_ID[mapId];
const hero = HERO_BY_ID[heroId];
const diff = DIFFICULTY_BY_ID[diffId];
for (let r = 0; r < Number(runsArg); r++) {
  const t0 = performance.now();
  const run = new Run({
    map, diff, hero, permanent: perm,
    unlockedWeapons: new Set(WEAPONS.map((w) => w.id)),
    unlockedPassives: new Set(PASSIVES.map((p) => p.id)),
    fx: NullFx, settings: { damageNumbers: false }, tr: (k) => k, seed: 1000 + r,
  });
  const dmgBy: Record<string, number> = {};
  if (process.env.DMG) {
    const orig = run.player.hurt.bind(run.player);
    run.player.hurt = (raw, src, ig) => {
      const d = orig(raw, src, ig);
      if (d > 0) {
        let k = src ? src.def.id : (new Error().stack!.split('\n')[2].match(/(\w+)\.ts:(\d+)/)?.slice(1).join(':') ?? '?');
        dmgBy[k] = (dmgBy[k] ?? 0) + d;
      }
      return d;
    };
  }
  const dt = 1 / 30;
  let maxEnemies = 0;
  let lastLog = 0;
  let steps = 0;
  while (run.state !== 'dead' && run.state !== 'victory' && run.time < 1100 && steps < 40000) {
    steps++;
    if (run.state === 'levelup') {
      const ch = run.pendingChoices!;
      // prefer upgrades of owned weapons, then new
      const pick = ch.find((c) => c.kind === 'weapon_up') ?? ch.find((c) => c.kind === 'weapon_new') ?? ch[0];
      run.choose(pick);
      continue;
    }
    if (run.state === 'chest') {
      run.closeChest();
      continue;
    }
    const [ix, iz] = bot(run);
    run.update(dt, ix, iz);
    maxEnemies = Math.max(maxEnemies, run.enemies.aliveCount);
    if (run.time - lastLog > 60) {
      lastLog = run.time;
      if (process.env.BOSS) for (const b of run.bosses) console.log('   boss', b.def.id, b.e.hp?.toFixed(0), '/', b.e.maxHp?.toFixed(0), 'phase', b.phase, 'cry', b.crystals.length, 'inv', b.e.invuln, 'hid', b.hidden.toFixed(1), 'dist', Math.hypot(b.e.x - run.player.x, b.e.z - run.player.z).toFixed(1));
      console.log(`  t=${run.time.toFixed(0)} lvl=${run.player.level} hp=${run.player.hp.toFixed(0)}/${run.player.stats.maxHp} alive=${run.enemies.aliveCount} kills=${run.stats.kills} weapons=${run.weapons.list.map((w) => w.def.id + ':' + w.level).join(',')}`);
    }
  }
  const s = run.summary();
  const ms = performance.now() - t0;
  console.log(`RUN ${r}: ${s.victory ? 'VICTORY' : 'DEAD'} time=${s.time.toFixed(0)} level=${s.level} kills=${s.kills} maxAlive=${maxEnemies} gold=${s.gold} bosses=${s.bosses.join('/')} evos=${s.evolutions.join('/')} sim=${(ms / 1000).toFixed(1)}s (${((ms / (s.time / dt)) * 1000).toFixed(0)}us/step)`);
  if (process.env.DMG) console.log('  taken:', Object.entries(dmgBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v.toFixed(0)).join(' '));
  console.log('   dmg:', s.weapons.map((w) => `${w.id}@${w.level}=${w.damage}`).join(' '));
}
