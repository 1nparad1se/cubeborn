/**
 * Guards the Berserker's gameplay against visual reworks: the class definition (damage, ranges,
 * cooldowns, timings, effects, keys) must match the snapshot taken before the rework.
 * Run: npx tsx tools/tests/berserker-mechanics.ts   (UPDATE=1 rewrites the snapshot)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { BERSERKER } from '../../src/game/action/classes/berserker';

const file = new URL('./fixtures/berserker-mechanics.json', import.meta.url);
const now = JSON.stringify(BERSERKER, null, 1);
if (process.env.UPDATE || !existsSync(file)) {
  writeFileSync(file, now);
  console.log('snapshot written');
  process.exit(0);
}
const before = readFileSync(file, 'utf8');
if (before === now) console.log('ok   Berserker mechanics unchanged');
else {
  const a = before.split('\n');
  const b = now.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) console.log(`line ${i + 1}: ${a[i]} -> ${b[i]}`);
  console.log('FAIL Berserker mechanics changed');
  process.exit(1);
}
