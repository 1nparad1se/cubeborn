/** Headless checks for terrain heights: step up, cliffs block, jump onto 2-block ledges, falls. Run: npx tsx tools/tests/terrain.ts */
import { Run } from '../../src/game/Run';
import { NullFx } from '../../src/game/types';
import { GREENVALE } from '../../src/data/maps';
import { HERO_BY_ID } from '../../src/data/heroes';
import { findPath } from '../../src/game/arpg/Path';

const run = new Run({ map: GREENVALE, hero: HERO_BY_ID.sorceress, fx: NullFx, settings: { damageNumbers: false }, tr: (k: string) => k });
const p = run.player;
const t = run.terrain;
const dt = 1 / 60;
let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
// mobs stay out of the way
for (const e of run.enemies.list) e.active = false;
run.mobs.update = () => {};

/** A spot where, walking +x, the ground rises (or drops, d < 0) by exactly d blocks: a 3-row-wide clean edge. */
function findEdge(d: number): [number, number] | null {
  const n = t.size;
  const e = (x: number, z: number) => t.elev[z * n + x];
  for (let z = 10; z < n - 10; z++)
    for (let x = 10; x < n - 10; x++) {
      let good = true;
      for (let dz = -1; dz <= 1 && good; dz++)
        for (let k = -4; k <= 4 && good; k++) {
          const cx = x + k;
          const cz = z + dz;
          if (t.blocksWalker(cx, cz)) good = false;
          else if (e(cx, cz) !== e(x, z) + (k > 0 ? d : 0)) good = false;
        }
      if (good) return [x, z];
    }
  return null;
}
function walk(frames: number, ix: number, jumpAt = -1) {
  for (let i = 0; i < frames; i++) {
    if (i === jumpAt) p.requestJump();
    run.update(dt, ix, 0);
  }
}
function put(x: number, z: number) {
  p.placeAt(x + 0.5, z + 0.5);
  p.vx = p.vz = 0;
}

const s1 = findEdge(1);
ok(!!s1, 'found a one-block step');
if (s1) {
  put(s1[0] - 2, s1[1]);
  const y0 = p.y;
  walk(90, 1);
  ok(p.x > s1[0] + 2 && Math.abs(p.y - (y0 + 1)) < 0.01, `walks up a 1-block step (x=${p.x.toFixed(1)}, y ${y0}→${p.y.toFixed(2)})`);
  walk(90, -1);
  ok(p.x < s1[0] && Math.abs(p.y - y0) < 0.01, `walks down it again without falling (y=${p.y.toFixed(2)})`);
}
const s3 = findEdge(3);
ok(!!s3, 'found a 3-block cliff');
if (s3) {
  put(s3[0] - 2, s3[1]);
  walk(90, 1);
  ok(p.x < s3[0] + 1, `a 3-block cliff blocks walking (x=${p.x.toFixed(2)}, cliff at ${s3[0] + 1})`);
  put(s3[0] - 2, s3[1]);
  walk(90, 1, 20);
  ok(p.x < s3[0] + 1, `and jumping (x=${p.x.toFixed(2)})`);
  // fall off it: start on top and walk -x
  put(s3[0] + 2, s3[1]);
  const top = p.y;
  let fell = false;
  for (let i = 0; i < 120; i++) {
    run.update(dt, -1, 0);
    if (p.jumpPhase === 'air' && p.y < top - 0.5) fell = true;
  }
  ok(fell && Math.abs(p.y - (top - 3)) < 0.01 && p.jumpPhase !== 'air', `walks off the cliff and falls 3 blocks (y ${top}→${p.y.toFixed(2)})`);
  ok(run.stats.jumps === 1, 'a fall is not a jump');
}
const s2 = findEdge(2);
ok(!!s2, 'found a 2-block ledge');
if (s2) {
  put(s2[0] - 2, s2[1]);
  walk(90, 1);
  ok(p.x < s2[0] + 1, `a 2-block ledge blocks walking (x=${p.x.toFixed(2)})`);
  put(s2[0] - 2, s2[1]);
  const y0 = p.y;
  walk(120, 1, 8);
  ok(p.x > s2[0] + 1 && Math.abs(p.y - (y0 + 2)) < 0.01, `a jump gets onto it (x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)})`);
}
// paths never climb more than a block per cell
if (s3) {
  const path = findPath(t, s3[0] - 2 + 0.5, s3[1] + 0.5, s3[0] + 3.5, s3[1] + 0.5, 40000);
  let px = s3[0] - 1.5;
  let pz = s3[1] + 0.5;
  let bad = false;
  for (let i = 0; i < path.length; i += 2) {
    const steps = Math.ceil(Math.hypot(path[i] - px, path[i + 1] - pz) / 0.2);
    let prev = t.elevAt(px, pz);
    for (let k = 1; k <= steps; k++) {
      const e = t.elevAt(px + ((path[i] - px) * k) / steps, pz + ((path[i + 1] - pz) * k) / steps);
      if (e > prev + 1) bad = true;
      prev = e;
    }
    px = path[i];
    pz = path[i + 1];
  }
  ok(!bad, `click-to-move path around the cliff climbs one block at a time (${path.length / 2} legs)`);
}
// the spawn meadow is flat and walkable
ok(t.groundY(125.5, 128.5) === 0 && !!t.reach && t.reach[128 * t.size + 125] === 1, 'spawn on flat reachable ground');
process.exit(fails ? 1 : 0);
