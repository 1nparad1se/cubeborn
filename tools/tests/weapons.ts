/** Weapon and armor numbers make sense: trade-offs, not one weapon best at everything. Run: npx tsx tools/tests/weapons.ts */
import { ITEMS, ITEM_BY_ID, baseDps, ARMOR_SETS } from '../../src/rpg/items';
import { computeStats, newGear, equipFromBag } from '../../src/rpg/equipment';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
const w = (id: string) => ITEM_BY_ID[id].weapon!;
const pairs: [string, string, string][] = [
  ['sword_recruit', 'sword_guard2h', '1H vs 2H sword'],
  ['staff_spark', 'staff_apprentice', '1H vs 2H staff'],
  ['bow_hunter', 'crossbow_light', 'bow vs crossbow'],
];
for (const [fast, slow, label] of pairs) {
  const a = w(fast);
  const b = w(slow);
  ok(a.interval < b.interval, `${label}: fast one attacks more often (${a.interval} < ${b.interval} s)`);
  ok(a.damage < b.damage, `${label}: slow one hits harder (${a.damage} < ${b.damage})`);
  const r = baseDps(b) / baseDps(a);
  ok(r > 0.85 && r < 1.2, `${label}: DPS comparable (${baseDps(a).toFixed(1)} vs ${baseDps(b).toFixed(1)}, ratio ${r.toFixed(2)})`);
}
ok(!ITEM_BY_ID.sword_recruit.twoHanded && !ITEM_BY_ID.staff_spark.twoHanded, '1H sword and 1H staff are one-handed (shield compatible)');
ok(['sword_guard2h', 'spear_militia', 'staff_apprentice', 'bow_hunter', 'crossbow_light'].every((id) => ITEM_BY_ID[id].twoHanded), 'the rest are two-handed');
ok(w('spear_militia').range > w('sword_guard2h').range && w('spear_militia').range > w('sword_recruit').range, 'spear reaches further than the swords');
ok(w('spear_militia').shape === 'sweep' && baseDps(w('spear_militia')) < baseDps(w('sword_recruit')), 'spear hits an area but has the lowest single-target melee DPS');
const ranged = ['staff_spark', 'staff_apprentice', 'bow_hunter', 'crossbow_light'];
const melee = ['sword_recruit', 'sword_guard2h'];
ok(ranged.every((r) => melee.every((m) => w(r).range > 3 * w(m).range && baseDps(w(r)) < baseDps(w(m)))), 'ranged weapons trade single-target DPS for range');
ok(w('staff_spark').dmgType === 'magic' && w('staff_apprentice').dmgType === 'magic', 'staffs deal magic damage');
ok(ITEMS.filter((i) => i.weapon).every((i) => i.weapon!.hitAt > 0 && i.weapon!.hitAt < 1), 'every weapon hits inside its attack cycle');
// no weapon dominates every metric (damage, speed, DPS, range, area)
const ws = ITEMS.filter((i) => i.weapon).map((i) => i.weapon!);
const dominates = (a: typeof ws[0], b: typeof ws[0]) => a.damage >= b.damage && a.interval <= b.interval && a.range >= b.range && (a.shape === 'sweep' || b.shape !== 'sweep') && (a !== b);
ok(!ws.some((a) => ws.some((b) => a !== b && dominates(a, b))), 'no weapon is better than another on every metric');
// armor classes
const def = (set: string) => ARMOR_SETS.find((s) => s.id === set)!.items.reduce((s, id) => s + (ITEM_BY_ID[id].stats.physDef ?? 0), 0);
ok(def('apprentice') < def('scout') && def('scout') < def('guard'), `defense: magic ${def('apprentice')} < light ${def('scout')} < heavy ${def('guard')}`);
const sum = (set: string, k: 'magicDmg' | 'castSpeed' | 'moveSpeed' | 'atkSpeed') => ARMOR_SETS.find((s) => s.id === set)!.items.reduce((s, id) => s + (ITEM_BY_ID[id].stats[k] ?? 0), 0);
ok(sum('apprentice', 'magicDmg') > 0 && sum('apprentice', 'castSpeed') > 0, 'apprentice set: magic damage and cast speed');
ok(sum('scout', 'moveSpeed') > 0 && sum('scout', 'atkSpeed') > 0, 'scout set: move speed and attack speed');
ok(sum('guard', 'moveSpeed') < 0, 'guard set: slower movement');
// stats follow gear
let g = newGear(['staff_spark', 'app_hood', 'app_gloves', 'app_boots', 'app_robe']);
const base = computeStats('human', g);
for (let i = 0; i < 5; i++) {
  const r = equipFromBag(g, g.bag.findIndex((x) => x));
  if (r.ok) g = r.gear;
}
const robed = computeStats('human', g);
ok(robed.hitDamage > 12 && robed.interval < 0.7 && robed.physDef === 6, `apprentice set boosts the staff: ${robed.hitDamage.toFixed(1)} dmg every ${robed.interval.toFixed(3)} s, defense ${robed.physDef}`);
ok(base.weapon === null && base.hitDamage === 4, 'bare hands without a weapon');
console.log(fails ? `${fails} weapon check(s) FAILED` : 'all weapon checks passed');
process.exit(fails ? 1 : 0);
