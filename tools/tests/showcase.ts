/** Headless checks for «Витрина мира»: every prop id placed, every water type and road kind present, spawn reachable. Run: npx tsx tools/tests/showcase.ts */
import { SHOWCASE } from '../../src/data/maps';
import { SHOWCASE_SPAWN, buildShowcase, unusedPropIds } from '../../src/game/map/showcase';
import { PROPS } from '../../src/world/props/index';
import { ROAD_KINDS, ROAD_VARIANTS } from '../../src/world/textures/groundTiles';
import { CELL } from '../../src/game/Terrain';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
const t0 = performance.now();
const t = buildShowcase(SHOWCASE);
console.log(`built in ${(performance.now() - t0).toFixed(0)} ms: ${t.props.length} props, ${t.lights.length} lights, ${t.tileNames.length} tile kinds`);
const unused = unusedPropIds(t);
ok(unused.length === 0, `every prop id placed (${Object.keys(PROPS).length - unused.length}/${Object.keys(PROPS).length}); unused: ${unused.length}${unused.length ? ' → ' + unused.join(', ') : ''}`);
const count = new Map<string, number>();
for (let i = 0; i < t.size * t.size; i++) {
  const nm = t.tileNames[t.tile[i]];
  count.set(nm, (count.get(nm) ?? 0) + 1);
}
const has = (nm: string) => (count.get(nm) ?? 0) > 0;
for (const ty of ['river', 'stream', 'lake', 'swamp', 'sea', 'fast', 'lagoon', 'mountain']) {
  const depths = [1, 2, 3, 4, 5].filter((d) => has(`water_${ty}_${d}`));
  ok(depths.length > 0, `water type ${ty} (depths ${depths.join(',')})`);
}
for (const k of ROAD_KINDS) {
  const missing = [k, ...ROAD_VARIANTS[k].map((v) => `${k}_${v}`)].filter((nm) => !has(nm));
  ok(missing.length === 0, `road kind ${k} with every variant${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
}
for (const s of ['shore_sand', 'shore_sand_wet', 'shore_grass', 'shore_clay_dirt', 'shore_rock', 'shore_mud_dirt', 'shore_pebble_rock']) ok(has(s), `shore tile ${s}`);
const si = Math.floor(SHOWCASE_SPAWN.z) * t.size + Math.floor(SHOWCASE_SPAWN.x);
ok(t.cell[si] === CELL.floor && !!t.reach?.[si], 'spawn on reachable floor');
let land = 0;
let reach = 0;
for (let i = 0; i < t.size * t.size; i++)
  if (t.cell[i] === CELL.floor) {
    land++;
    if (t.reach![i]) reach++;
  }
ok(reach / land > 0.6, `most floor reachable on foot (${((reach / land) * 100).toFixed(0)}%)`);
// every district has reachable ground
const spots: [string, number, number][] = [['forest', 30, 84], ['ruins', 96, 40], ['lake', 132, 46], ['mountain top', 13, 26], ['caves', 40, 66], ['coast', 148, 128], ['swamp boardwalk', 22, 147], ['camps', 80, 128], ['village', 96, 92]];
for (const [nm, x, z] of spots) {
  let found = false;
  for (let dz = -3; dz <= 3 && !found; dz++) for (let dx = -3; dx <= 3 && !found; dx++) found = !!t.reach![(z + dz) * t.size + x + dx];
  ok(found, `${nm} reachable`);
}
ok(t.props.every((p) => Number.isFinite(p.x + p.y + p.z)), 'prop positions finite');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
