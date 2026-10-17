/** Save v8: old saves keep only settings, old heroes and world data are dropped, a backup is kept. Run: npx tsx tools/tests/save.ts */
import { BACKUP_KEY, VERSION, loadSave, migrate, writeSave, type SaveStorage } from '../../src/meta/Save';
import { newChar } from '../../src/meta/Characters';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
(globalThis as any).navigator ??= { language: 'ru-RU' };
const mem = (init: Record<string, string> = {}): SaveStorage & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const old = {
  version: 7,
  settings: { master: 0.4, shadows: 'low', keybinds: { skillQ: ['KeyQ'], dodge: ['Space'] }, enemyHealthBars: 'all' },
  chars: [{ id: 'a', name: 'Брам', cls: 'berserker', level: 31, skills: [3, 3, 3, 3, 1, 1, 1, 1], cpos: { x: 4100, z: 3900 }, uniq: ['camp1'] }],
  activeChar: 'a',
  bestiary: ['cave_orc', 'wild_boar'],
  clock: { minutes: 700, days: 3 },
};
const raw = JSON.stringify(old);
const st = mem({ 'cubeborn.save.v1': raw });
const d = loadSave(st);
ok(d.version === VERSION && VERSION === 8, 'save version is 8');
ok(d.chars.length === 0 && d.activeChar === null, 'old class heroes are dropped');
ok(!('bestiary' in d), 'bestiary (old creatures) is gone');
ok(d.settings.master === 0.4 && d.settings.shadows === 'low', 'settings are kept');
ok(!('enemyHealthBars' in d.settings) && !('skillQ' in d.settings.keybinds) && d.settings.keybinds.jump[0] === 'Space', 'old settings of removed systems dropped, key bindings reset');
ok(st.m.get(BACKUP_KEY) === raw, 'the original save is backed up under ' + BACKUP_KEY);
const stored = JSON.parse(st.m.get('cubeborn.save.v1')!);
ok(stored.version === 8 && stored.chars.length === 0 && !JSON.stringify(stored).includes('berserker') && !JSON.stringify(stored).includes('cpos'), 'the stored save is rewritten: nothing old can come back');
// a second load does not overwrite the backup
st.m.set('cubeborn.save.v1', JSON.stringify({ ...old, version: 6 }));
loadSave(st);
ok(st.m.get(BACKUP_KEY) === raw, 'the backup is written once and never overwritten');
// v8 characters survive a round trip
const c = newChar('Ратибор', 'human');
const s2 = mem();
writeSave({ version: 8, settings: d.settings, chars: [c], activeChar: c.id }, s2);
const back = loadSave(s2);
ok(back.chars.length === 1 && back.chars[0].race === 'human' && back.chars[0].gear.bag.filter(Boolean).length === 20, 'a new human with the 20 starter items loads back');
ok(!s2.m.has(BACKUP_KEY), 'a current save is not backed up');
// a v8 save holding an old-style class hero (no race) drops it
const mixed = migrate({ version: 8, settings: {}, chars: [{ id: 'x', name: 'Old', cls: 'paladin' }, c] });
ok(mixed.chars.length === 1 && mixed.chars[0].id === c.id, 'characters without a playable race are dropped');
// an unavailable race cannot be created
ok(newChar('Гимли', 'dwarf').race === 'human', 'races that are not available yet fall back to human');
console.log(fails ? `${fails} save check(s) FAILED` : 'all save checks passed');
process.exit(fails ? 1 : 0);
