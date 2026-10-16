/**
 * Headless streaming walk on «Расколотые Земли»: the hero walks a long road across many sectors
 * (window shifts), never sinks through the ground, the terrain and creature counts and the decoded
 * atlases stay bounded, and the window seams agree (the same world height on both sides).
 * Run: npx tsx tools/tests/continent-stream.ts
 */
import { Run } from '../../src/game/Run';
import { NullFx } from '../../src/game/types';
import { CONTINENT } from '../../src/data/maps';
import { HERO_BY_ID } from '../../src/data/heroes';
import { ContinentData } from '../../src/game/continent/data';
import { nodeIO } from '../../src/game/continent/nodeIO';
import { CONTINENT_SPAWN, ContinentStream, setContinent } from '../../src/game/continent/stream';
import { buildWindow } from '../../src/game/continent/window';

let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};

const data = await ContinentData.load(nodeIO(new URL('../continent/viewer/site/data/', import.meta.url).pathname));
const stream = await ContinentStream.open(data, CONTINENT_SPAWN.x, CONTINENT_SPAWN.z);
setContinent(stream);
const run = new Run({ map: CONTINENT, hero: HERO_BY_ID.berserker, fx: NullFx, settings: { damageNumbers: false }, tr: (k: string) => k });
const p = run.player;
ok(Math.hypot(p.x - CONTINENT_SPAWN.x, p.z - CONTINENT_SPAWN.z) < 6, `spawn in Зеленодол (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
ok(run.terrain.walkableAt(p.x, p.z), 'spawn is walkable');
ok(run.mobs.camps.length > 80, `continent camps loaded (${run.mobs.camps.length} groups)`);

// seams: two overlapping windows give the same ground height in their shared cells
{
  const a = stream.terrain;
  const ox = a.ox + 256;
  await data.atlases.ensure(ox, a.oz, ox + 512, a.oz + 512);
  const b = buildWindow(data, ox, a.oz, { detail: false }).t;
  let worst = 0;
  for (let k = 0; k < 2000; k++) {
    const x = ox + 20 + ((k * 37) % 220) + 0.37;
    const z = a.oz + 20 + ((k * 91) % 470) + 0.61;
    const ia = a.idx(Math.floor(x), Math.floor(z));
    const ib = b.idx(Math.floor(x), Math.floor(z));
    if (a.deckC.has(ia) || b.deckC.has(ib) || a.cell[ia] !== b.cell[ib] || a.props.length === -1) continue;
    worst = Math.max(worst, Math.abs(a.groundY(x, z) - b.groundY(x, z)));
  }
  ok(worst < 0.6, `window seams agree (max height difference ${worst.toFixed(3)} incl. building pads)`);
}

// the walk: the northern road out of Зеленодол, then east along the main roads
const route: [number, number][] = [];
for (const r of data.feat.routes)
  if (r.id === 'north_main' || r.id === 'east_road')
    for (const leg of r.legs) if (leg.mode === 'road') for (const q of leg.pts) route.push([q[0], q[1]]);
const dt = 1 / 30;
let wp = 0;
let steps = 0;
let sunk = 0;
let worstSink = 0;
let stuck = 0;
let stuckT = 0;
let best = 1e9;
let walked = 0;
let maxEnemies = 0;
let maxAtlases = 0;
let maxBlocks = 0;
const startShifts = stream.shifts;
const sectors = new Set<string>();
const t0 = performance.now();
while (wp < route.length && steps < 30 * 60 * 40) {
  const [tx, tz] = route[wp];
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 2.5) {
    wp++;
    best = 1e9;
    stuckT = 0;
    continue;
  }
  p.hp = p.stats.maxHp;
  p.invulnT = 1;
  const x0 = p.x;
  const z0 = p.z;
  run.update(dt, dx / d, dz / d);
  steps++;
  walked += Math.hypot(p.x - x0, p.z - z0);
  // let background loads finish like frames would
  if (steps % 30 === 0) await stream.settle();
  const t = run.terrain;
  const g = t.groundY(p.x, p.z);
  if (!Number.isFinite(p.y) || (p.jumpPhase === 'ground' && p.y < g - 0.3)) {
    sunk++;
    worstSink = Math.max(worstSink, g - p.y);
  }
  sectors.add(`${Math.floor(p.x / 256)},${Math.floor(p.z / 256)}`);
  maxEnemies = Math.max(maxEnemies, run.enemies.list.filter((e) => e.active).length);
  maxAtlases = Math.max(maxAtlases, data.atlases.decoded);
  maxBlocks = Math.max(maxBlocks, t.blocks.length + t.props.length);
  if (d < best - 0.5) {
    best = d;
    stuckT = 0;
  } else if ((stuckT += dt) > 6) {
    // blocked (a prop on the road, a steep spot): hop to the waypoint like a click-path would
    stuck++;
    if (process.env.DBG) {
      const t2 = run.terrain;
      const ax = p.x + (dx / d) * 0.8;
      const az = p.z + (dz / d) * 0.8;
      const i = t2.idx(Math.floor(ax), Math.floor(az));
      const [sx, sz] = t2.slopeAt(ax, az);
      const pr = t2.props.find((q) => Math.abs(q.x - (ax - t2.ox)) < 2 && Math.abs(q.z - (az - t2.oz)) < 2);
      console.log('hop', p.x.toFixed(1), p.z.toFixed(1), 'cell', t2.cell[i], 'tile', t2.tileNames[t2.tile[i]], 'slope', Math.hypot(sx, sz).toFixed(2), 'prop', pr?.id, 'y', p.y.toFixed(1), 'g', t2.groundY(ax, az).toFixed(1));
    }
    if (!stream.covers(tx, tz)) {
      // the next road starts elsewhere: travel there (teleport loads its window)
      const nt = await stream.jump(tx, tz);
      run.swapTerrain(nt);
      stuck--;
    }
    const t2 = run.terrain;
    const q = stream.walkableNear(tx, tz);
    if (t2.walkableAt(q.x, q.z)) p.placeAt(q.x, q.z);
    p.y = t2.groundY(p.x, p.z);
    wp++;
    best = 1e9;
    stuckT = 0;
  }
}
const ms = performance.now() - t0;
const shifts = stream.shifts - startShifts;
console.log(`walked ${walked.toFixed(0)} blocks in ${(steps * dt / 60).toFixed(1)} game min, ${sectors.size} sectors, ${shifts} window shifts, ${stuck} hops, sim ${(ms / 1000).toFixed(1)} s`);
ok(wp >= route.length - 1, `reached the end of the route (${wp}/${route.length} waypoints)`);
ok(walked > 2500, `long walk (${walked.toFixed(0)} blocks)`);
ok(sectors.size >= 12, `crossed many sectors (${sectors.size})`);
ok(shifts >= 6, `window moved with the hero (${shifts} shifts)`);
ok(sunk === 0, `never below the ground (${sunk} frames, worst ${worstSink.toFixed(2)})`);
ok(stuck <= Math.max(6, route.length * 0.03), `rarely blocked on the road (${stuck} hops)`);
ok(maxAtlases <= data.atlases.max, `decoded atlases bounded (${maxAtlases} ≤ ${data.atlases.max})`);
ok(maxEnemies < 200, `active creatures bounded (${maxEnemies})`);
ok(maxBlocks < 60000, `window content bounded (${maxBlocks} blocks + props)`);
ok(run.terrain.size === 512, 'window size constant');
const g = globalThis as { gc?: () => void };
if (g.gc) g.gc();
const mu = process.memoryUsage();
const heap = (mu.heapUsed + mu.arrayBuffers) / 1048576;
ok(heap < 600, `memory after the walk ${heap.toFixed(0)} MB (JS heap ${(mu.heapUsed / 1048576).toFixed(0)} + buffers ${(mu.arrayBuffers / 1048576).toFixed(0)})`);
console.log(fails ? `${fails} FAILED` : 'all continent streaming checks passed');
process.exit(fails ? 1 : 0);
