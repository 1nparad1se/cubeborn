/** World clock checks: frame-rate independence, phases, HH:MM, save/restore. Run: npx tsx tools/tests/clock.ts */
import { GameClock, formatClock, phaseAt } from '../../src/game/GameClock';
import { migrate } from '../../src/meta/Save';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
// 1 real second = 1 game minute, whatever the frame rate
for (const fps of [30, 60, 144, 240]) {
  const c = new GameClock(0);
  for (let i = 0; i < fps * 90; i++) c.advance(1 / fps);
  ok(Math.abs(c.minutes - 90) < 1e-6, `${fps} fps: 90 s → 01:30 (${c.hhmm})`);
}
const w = new GameClock(23 * 60 + 59);
w.advance(2);
ok(w.hhmm === '00:01' && w.days === 1, 'wraps past midnight and counts the day');
ok(new GameClock(600).hhmm === '10:00' && formatClock(5 * 60 + 7) === '05:07' && formatClock(0) === '00:00' && formatClock(13 * 60 + 45.9) === '13:45', 'HH:MM 24h, zero padded');
const P: [number, string][] = [[4 * 60 + 59, 'night'], [5 * 60, 'dawn'], [6 * 60 + 59, 'dawn'], [7 * 60, 'day'], [17 * 60 + 59, 'day'], [18 * 60, 'dusk'], [19 * 60 + 59, 'dusk'], [20 * 60, 'night'], [0, 'night']];
for (const [m, p] of P) ok(phaseAt(m).p === p, `${formatClock(m)} is ${p}`);
ok(new GameClock(-1).hhmm === '23:59', 'negative wraps');
// save / restore
const c = new GameClock(17 * 60 + 24.5, 3);
const back = GameClock.fromSave(JSON.parse(JSON.stringify(c.toSave())));
ok(back.hhmm === '17:24' && back.days === 3 && Math.abs(back.minutes - c.minutes) < 0.01, 'save → restore keeps the time');
const m = migrate({ version: 7, settings: {}, chars: [], clock: c.toSave() });
ok(GameClock.fromSave(m.clock).hhmm === '17:24', 'clock survives save migration');
const old = migrate({ version: 7, settings: { dayNight: 'short' }, chars: [] });
ok(!old.clock && !('dayNight' in old.settings) && GameClock.fromSave(old.clock).hhmm === '08:00', 'old save without a clock loads, starts 08:00');
ok(GameClock.fromSave({ minutes: 'x' }).hhmm === '08:00', 'garbage clock → fresh clock');
if (fails) {
  console.log(`${fails} failure(s)`);
  process.exit(1);
}
console.log('all clock checks passed');
