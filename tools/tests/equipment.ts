/** Equipment rules: slots, two-handed vs shield, no loss or duplication. Run: npx tsx tools/tests/equipment.ts */
import { BAG_SIZE, ITEMS, STARTER_ITEMS } from '../../src/rpg/items';
import { allItems, equipFromBag, equipToSlot, fixGear, gearProblem, moveInBag, newGear, unequip, type Gear } from '../../src/rpg/equipment';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
const sorted = (g: Gear) => allItems(g).sort().join(',');
const at = (g: Gear, id: string) => g.bag.indexOf(id);
const must = (r: ReturnType<typeof equipFromBag>): Gear => {
  if (!r.ok) throw new Error(r.error);
  return r.gear;
};

let g = newGear(STARTER_ITEMS);
const all = sorted(g);
ok(STARTER_ITEMS.length === 20 && ITEMS.length === 20, 'starter bag holds 20 items (7 weapons, shield, 12 armor pieces)');
ok(g.bag.length === BAG_SIZE && allItems(g).length === 20, 'all starter items are in the bag, nothing equipped');

// one-handed sword + shield
g = must(equipFromBag(g, at(g, 'sword_recruit')));
g = must(equipFromBag(g, at(g, 'shield_wood')));
ok(g.equip.main === 'sword_recruit' && g.equip.off === 'shield_wood', '1H sword and shield together');
ok(sorted(g) === all && !gearProblem(g), 'no loss / duplication');
// two-handed sword returns the shield to the bag
g = must(equipFromBag(g, at(g, 'sword_guard2h')));
ok(g.equip.main === 'sword_guard2h' && g.equip.off === null, '2H sword takes both hands, shield removed');
ok(g.bag.includes('shield_wood') && g.bag.includes('sword_recruit'), 'shield and the old sword went back to the bag');
ok(sorted(g) === all && !gearProblem(g), 'no loss / duplication after 2H');
// shield while holding a 2H weapon: the 2H weapon goes back to the bag
g = must(equipFromBag(g, at(g, 'shield_wood')));
ok(g.equip.off === 'shield_wood' && g.equip.main === null && g.bag.includes('sword_guard2h'), 'shield replaces the 2H weapon (never both)');
ok(sorted(g) === all && !gearProblem(g), 'no loss / duplication after shield over 2H');
// 1H staff with the shield
g = must(equipFromBag(g, at(g, 'staff_spark')));
ok(g.equip.main === 'staff_spark' && g.equip.off === 'shield_wood', '1H staff is shield compatible');
// every 2H weapon removes the shield
for (const id of ['spear_militia', 'staff_apprentice', 'bow_hunter', 'crossbow_light']) {
  g = must(equipFromBag(g, at(g, 'shield_wood') >= 0 ? at(g, 'shield_wood') : at(g, id)));
  if (g.equip.off === 'shield_wood') g = must(equipFromBag(g, at(g, id)));
  ok(g.equip.main === id && g.equip.off === null && sorted(g) === all, `${id}: two-handed, no shield, nothing lost`);
}
// armor: each piece in its own slot, swapping returns the old piece to the source cell
for (const id of ['app_hood', 'app_gloves', 'app_boots', 'app_robe']) g = must(equipFromBag(g, at(g, id)));
ok(g.equip.head === 'app_hood' && g.equip.hands === 'app_gloves' && g.equip.feet === 'app_boots' && g.equip.body === 'app_robe', 'apprentice set equipped piece by piece');
const cell = at(g, 'guard_helm');
g = must(equipFromBag(g, cell));
ok(g.equip.head === 'guard_helm' && g.bag[cell] === 'app_hood', 'swap: the old helmet lands in the cell the new one came from');
// drag to a wrong slot is refused, nothing changes
const wrong = equipToSlot(g, at(g, 'scout_boots'), 'head');
ok(!wrong.ok, 'boots cannot go to the helmet slot');
const right = equipToSlot(g, at(g, 'scout_boots'), 'feet');
ok(right.ok && right.gear.equip.feet === 'scout_boots', 'drag boots to the boots slot');
if (right.ok) g = right.gear;
// unequip everything
for (const s of ['main', 'off', 'head', 'hands', 'feet', 'body'] as const) if (g.equip[s]) g = must(unequip(g, s));
ok(Object.values(g.equip).every((v) => v === null) && sorted(g) === all, 'unequip all: everything back in the bag');
// bag move
const m = moveInBag(g, 0, 23);
ok(m.bag[23] === g.bag[0] && m.bag[0] === g.bag[23] && sorted(m) === all, 'moving inside the bag swaps cells');
// edge: full bag — taking off fails without losing anything
const full: Gear = { equip: { main: 'sword_recruit', off: 'shield_wood', head: null, hands: null, feet: null, body: null }, bag: new Array(BAG_SIZE).fill('app_hood') };
const u = unequip(full, 'main');
ok(!u.ok, 'unequip with a full bag is refused');
// edge: 2H from a full bag while sword+shield are worn: two items come off, only one cell frees → refused
full.bag[5] = 'sword_guard2h';
const fullBefore = sorted(full);
const r2 = equipFromBag(full, 5);
ok(!r2.ok && sorted(full) === fullBefore && full.equip.off === 'shield_wood', '2H with no room for the shield is refused, gear untouched');
// edge: same but with one free cell → works, both items land in the bag
full.bag[6] = null;
const r3 = equipFromBag(full, 5);
ok(r3.ok && r3.gear.equip.main === 'sword_guard2h' && !r3.gear.equip.off && r3.gear.bag.includes('shield_wood') && r3.gear.bag.includes('sword_recruit'), '2H with one free cell: sword and shield both returned');
// edge: empty cell, unknown items, broken saves
ok(!equipFromBag(newGear([]), 0).ok, 'equipping an empty cell is refused');
const fixed = fixGear({ equip: { main: 'bow_hunter', off: 'shield_wood', head: 'guard_boots', hands: 'nope' }, bag: ['x', 'sword_recruit'] }, newGear([]));
ok(fixed.equip.main === 'bow_hunter' && fixed.equip.off === null && fixed.equip.head === null && fixed.bag.includes('shield_wood') && fixed.bag.includes('guard_boots') && !gearProblem(fixed), 'repairing a broken save: misplaced items to the bag, unknown dropped, no shield with 2H');
// fuzz: random clicks never lose or duplicate items and never break the rules
let fz = newGear(STARTER_ITEMS);
let seed = 7;
const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
let bad = 0;
for (let i = 0; i < 5000; i++) {
  const op = rnd(3);
  const r = op === 0 ? equipFromBag(fz, rnd(BAG_SIZE)) : op === 1 ? unequip(fz, (['main', 'off', 'head', 'hands', 'feet', 'body'] as const)[rnd(6)]) : { ok: true as const, gear: moveInBag(fz, rnd(BAG_SIZE), rnd(BAG_SIZE)) };
  if (r.ok) fz = r.gear;
  if (sorted(fz) !== all || gearProblem(fz)) bad++;
}
ok(bad === 0, `5000 random actions: no loss, no duplication, rules hold (${bad} bad)`);
console.log(fails ? `${fails} equipment check(s) FAILED` : 'all equipment checks passed');
process.exit(fails ? 1 : 0);
