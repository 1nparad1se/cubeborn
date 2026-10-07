/** Headless checks for the day/night cycle. Run: npx tsx tools/tests/daynight.ts */
import { Run } from '../../src/game/Run';
import { NullFx } from '../../src/game/types';
import { MAP_BY_ID } from '../../src/data/maps';
import { HERO_BY_ID } from '../../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../../src/data/difficulty';
import { DAY_NIGHT } from '../../src/config/dayNight';

const mk = (len: number) =>
  new Run({
    map: MAP_BY_ID.blightwood, diff: DIFFICULTY_BY_ID.normal, hero: HERO_BY_ID.bram, permanent: {}, mode: 'campaign',
    unlockedWeapons: new Set(), unlockedPassives: new Set(), fx: NullFx, settings: { damageNumbers: false, dayLength: len }, tr: (k: string) => k, seed: 3,
  });
/** Steps the run, auto-resolving level-ups and chests like the sim bot. */
function step(r: Run, dt: number) {
  if (r.state === 'levelup') r.choose(r.pendingChoices![0]);
  else if (r.state === 'chest') r.closeChest();
  r.update(dt, 0, 0);
}
let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
const run = mk(300);
run.debug.god = true;
const dn = run.dayNight;
ok(dn.period === 'day' && dn.night === 0, 'runs start in daylight');
const seen: string[] = [];
run.events.on('dayPeriod', (p) => seen.push(p));
const moth = run.enemies.spawnById('dusk_moth', run.player.x + 30, run.player.z)!;
const sporeling = run.enemies.spawnById('sporeling', run.player.x + 8, run.player.z + 2)!;
const zombie = run.enemies.spawnById('rot_zombie', run.player.x + 8, run.player.z - 2)!;
const gargoyle = run.enemies.spawnById('gargoyle', run.player.x + 9, run.player.z + 4)!;
for (const e of [moth, sporeling, zombie, gargoyle]) {
  e.speed = 0; // keep them in place
  e.invuln = true;
}
const base = { moth: moth.maxHp / moth.todHp, spor: sporeling.maxHp / sporeling.todHp };
ok(Math.abs(moth.todHp - 0.2) < 1e-6 && Math.abs(moth.todDmg - 0.2) < 1e-6 && Math.abs(moth.todSpd - 0.8) < 1e-6, `nocturnal by day ×0.2/×0.2/×0.8 (${moth.todHp}, ${moth.todDmg}, ${moth.todSpd})`);
ok(Math.abs(sporeling.todHp - 1.5) < 1e-6, `diurnal by day ×1.5 hp (${sporeling.todHp})`);
ok(zombie.todHp === 1 && zombie.todDmg === 1, 'neutral unaffected');
ok(gargoyle.asleep, 'gargoyle sleeps by day');
const dt = 1 / 20;
let lastNight = 0;
let monotonic = true;
// run to the middle of the night
for (let t = 0; t < 300 * 0.55; t += dt) {
  step(run, dt);
  if (dn.period === 'dusk' && dn.night + 1e-9 < lastNight) monotonic = false;
  lastNight = dn.night;
}
ok(seen.join(',') === 'dusk,night', `periods: ${seen.join(',')}`);
ok(monotonic, 'dusk darkens smoothly');
ok(dn.night === 1 && dn.light.sun < 0.5 && dn.light.warm < 0, `night lighting: sun ${dn.light.sun.toFixed(2)}, warm ${dn.light.warm}`);
ok(Math.abs(moth.todHp - (dn.bloodMoon ? 1.8 : 1.5)) < 1e-6 && Math.abs(moth.todSpd - 1.2) < 1e-6, `nocturnal at night ×1.5 hp ×1.2 speed (${moth.todHp}, ${moth.todSpd})`);
ok(Math.abs(moth.maxHp / moth.todHp - base.moth) < 1e-6, 'health rescaled, base kept');
ok(Math.abs(sporeling.todDmg - 0.2) < 1e-6, `diurnal at night ×0.2 damage (${sporeling.todDmg})`);
ok(!gargoyle.asleep, 'gargoyle awake at night');
ok(dn.poolFor([['rot_zombie', 1], ['wraith', 1]]).length > 2, 'night visitors join the pool');
ok(run.stats.nights === 1, 'night counted');
// on to dawn
for (let t = 0; t < 300 * 0.42; t += dt) step(run, dt);
ok(seen.includes('dawn') && run.stats.nightsSurvived === 1, `dawn reached, night survived (${seen.join(',')})`);
ok(dn.poolFor([['rot_zombie', 1], ['wraith', 1]]).find((p) => p[0] === 'wraith')?.[1] === 0 || dn.isNight, 'night-only enemies leave the day pool');
// min clamps
const m = dn.mulFor('nocturnal', { damage: 1, hp: 1, speed: 1 });
ok(m.hp >= DAY_NIGHT.minMul.hp && m.speed >= DAY_NIGHT.minMul.speed, 'multipliers respect the floors');
// off
const off = mk(0);
const z = off.enemies.spawnById('dusk_moth', off.player.x + 8, off.player.z)!;
ok(!off.dayNight.enabled && z.todHp === 1, 'cycle off: no modifiers');
process.exit(fails ? 1 : 0);
