/**
 * Training ground simulation: jump arc and 1-block obstacles, dummies take damage and stay,
 * spear sweep hits both dummies of the pair, projectiles fly and hit. Run: npx tsx tools/tests/world.ts
 */
import { World } from '../../src/rpg/World';
import { GameClock } from '../../src/game/GameClock';
import { NullFx } from '../../src/game/types';
import { newGear, equipFromBag, type Gear } from '../../src/rpg/equipment';
import { STARTER_ITEMS } from '../../src/rpg/items';
import { JUMP } from '../../src/rpg/Player';
import { DUMMIES, OBSTACLES, TEST_MAP } from '../../src/rpg/testMap';
import { CELL } from '../../src/game/Terrain';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
const dt = 1 / 60;
const wield = (id: string): Gear => {
  const g = newGear(STARTER_ITEMS);
  const r = equipFromBag(g, g.bag.indexOf(id));
  if (!r.ok) throw new Error(r.error);
  return r.gear;
};
const make = (id: string) => new World(NullFx, new GameClock(), 'human', wield(id));
const run = (w: World, sec: number, each?: () => void) => {
  for (let t = 0; t < sec; t += dt) {
    each?.();
    w.update(dt);
  }
};
const place = (w: World, x: number, z: number) => {
  const p = w.player;
  p.x = x;
  p.z = z;
  p.y = w.terrain.groundY(x, z);
  p.vx = p.vz = 0;
};

// ---------------------------------------------------------------- map
{
  const w = make('sword_recruit');
  const t = w.terrain;
  ok(TEST_MAP.size === 100 && t.size === 100, 'test map is exactly 100 × 100');
  ok(w.dummies.length === 3 && DUMMIES.length === 3, 'exactly three dummies');
  let open = 0;
  for (let z = 10; z < 90; z++) for (let x = 10; x < 90; x++) if (t.cell[z * 100 + x] === CELL.floor && t.elev[z * 100 + x] === 0) open++;
  ok(open > 6200, `the middle is open flat ground (${open} of 6400 cells)`);
  ok(OBSTACLES.every(([x0, z0, x1, z1]) => Math.min(x0, z0, 99 - x1, 99 - z1) <= 16), 'obstacles stand near the edges');
}

// ---------------------------------------------------------------- jump
{
  const w = make('sword_recruit');
  place(w, 30, 70);
  w.player.requestJump();
  let apex = 0;
  let mid = false;
  run(w, 1.2, () => {
    apex = Math.max(apex, w.player.y);
    if (!mid && w.player.airborne && w.player.jumpV < 0) {
      mid = true;
      w.player.requestJump(); // mid-air press must not double jump
    }
  });
  ok(Math.abs(apex - JUMP.height) < 0.05, `jump from standing reaches ${apex.toFixed(2)} (≈ ${JUMP.height})`);
  run(w, 0.4);
  ok(w.jumps === 1 && !w.player.airborne && w.player.y === 0, 'one jump, no double jump, lands on the ground');
  // running jump keeps the horizontal speed (not a dash: same speed as walking)
  place(w, 30, 70);
  w.ctl.moveX = 1;
  run(w, 0.5);
  const vWalk = Math.hypot(w.player.vx, w.player.vz);
  w.player.requestJump();
  let vMax = 0;
  run(w, 0.5, () => (vMax = Math.max(vMax, Math.hypot(w.player.vx, w.player.vz))));
  w.ctl.moveX = 0;
  ok(vMax <= vWalk + 1e-6, `running jump is not a dash (air speed ${vMax.toFixed(2)} ≤ walk ${vWalk.toFixed(2)})`);
}

// ---------------------------------------------------------------- 1-block obstacle
{
  const w = make('sword_recruit');
  const [x0, z0, x1] = OBSTACLES[0]; // 3-wide, 1-deep block row at z0
  const tx = (x0 + x1) / 2 + 0.5;
  // walking into it: blocked
  place(w, tx, z0 + 3.5);
  w.ctl.moveZ = -1;
  run(w, 1.5);
  ok(w.player.z > z0 + 1, `walking into the 1-block obstacle is blocked (z ${w.player.z.toFixed(2)})`);
  // jumping while walking: clears it and lands beyond (or on top)
  place(w, tx, z0 + 2.2);
  w.player.requestJump();
  let onTop = false;
  run(w, 1.2, () => {
    if (Math.floor(w.player.z) === z0 && w.player.y > 0.99) onTop = true;
  });
  w.ctl.moveZ = 0;
  ok(w.player.z < z0, `jumping clears the 1-block obstacle (z ${w.player.z.toFixed(2)} past ${z0})`);
  ok(onTop || w.player.z < z0, 'passes over the block, never through its side');
  ok(!w.player.airborne && w.player.y === 0, 'correct landing on the far side');
}

// ---------------------------------------------------------------- dummies take damage and stay
{
  const w = make('sword_recruit');
  const c = w.dummies.find((d) => d.id === 'dummy_c')!;
  place(w, c.x, c.z + 1.8);
  w.select(c, true);
  run(w, 6);
  ok(c.hits >= 8 && c.total === c.hits * 14, `1H sword: ${c.hits} hits × 14 = ${c.total}`);
  ok(w.dummies.length === 3 && w.dummies.includes(c), 'dummies never disappear');
  ok(c.dps(w.time) > 18 && c.dps(w.time) < 26, `DPS readout ≈ 23 (${c.dps(w.time).toFixed(1)})`);
  const others = w.dummies.filter((d) => d !== c);
  ok(others.every((d) => d.total === 0), 'single target: the other dummies are untouched');
  run(w, 600);
  ok(c.total > 1000 && w.dummies.length === 3, `ten more minutes of hits: total ${c.total}, still standing`);
}

// ---------------------------------------------------------------- spear sweep hits the pair
{
  const w = make('spear_militia');
  const [a, b] = w.dummies;
  place(w, (a.x + b.x) / 2, a.z + 3);
  w.select(a, true);
  run(w, 1.2);
  ok(a.hits === 1 && b.hits === 1, `one spear thrust hits both dummies of the pair (A ${a.hits}, B ${b.hits})`);
  ok(w.dummies[2].hits === 0, 'the lone dummy is out of the sweep');
  // two-handed sword at the same spot: single target only
  const s = make('sword_guard2h');
  const [a2, b2] = s.dummies;
  place(s, (a2.x + b2.x) / 2, a2.z + 2);
  s.select(a2, true);
  run(s, 3.5);
  ok(a2.hits >= 2 && b2.hits === 0, `2H sword hits only the selected dummy (A ${a2.hits}, B ${b2.hits})`);
}

// ---------------------------------------------------------------- ranged weapons
for (const id of ['staff_spark', 'staff_apprentice', 'bow_hunter', 'crossbow_light']) {
  const w = make(id);
  const c = w.dummies[2];
  place(w, c.x, c.z + 9);
  w.select(c, true);
  let flying = 0;
  run(w, 5, () => (flying = Math.max(flying, w.projectiles.length)));
  ok(flying > 0 && c.hits >= 2 && Math.hypot(w.player.x - c.x, w.player.z - c.z) > 8, `${id}: shoots from range (${c.hits} hits, ${flying} in flight at most)`);
}
console.log(fails ? `${fails} world check(s) FAILED` : 'all world checks passed');
process.exit(fails ? 1 : 0);
