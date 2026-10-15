/** Headless checks for the sloped terrain: walk up/down slopes, cliffs block, falls, jump onto ledges, paths. Run: npx tsx tools/tests/terrain.ts */
import { Run } from '../../src/game/Run';
import { NullFx } from '../../src/game/types';
import { GREENVALE } from '../../src/data/maps';
import { HERO_BY_ID } from '../../src/data/heroes';
import { findPath } from '../../src/game/arpg/Path';
import { SLOPE } from '../../src/game/Terrain';

const run = new Run({ map: GREENVALE, hero: HERO_BY_ID.sorceress, fx: NullFx, settings: { damageNumbers: false }, tr: (k: string) => k });
const p = run.player;
const t = run.terrain;
const dt = 1 / 60;
let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
for (const e of run.enemies.list) e.active = false;
run.mobs.update = () => {};
const n = t.size;
const free = (x: number, z: number, k0: number, k1: number) => {
  for (let dz = -1; dz <= 1; dz++) for (let k = k0; k <= k1; k++) if (t.blocksWalker(x + k, z + dz)) return false;
  return true;
};
const gy = (x: number, z: number) => t.groundY(x, z);
/** A row walking +x where the ground climbs `rise` over 8 cells along a walkable continuous slope. */
function findSlope(minRise: number): [number, number] | null {
  for (let z = 10; z < n - 10; z++)
    for (let x = 10; x < n - 20; x++) {
      if (!free(x, z, 0, 9) || t.elev[z * n + x] > 4) continue;
      let good = true;
      for (let s = 0; s < 80 && good; s++) {
        const a = gy(x + s / 10, z + 0.5);
        const b = gy(x + (s + 1) / 10, z + 0.5);
        if (b < a - 0.001 || b - a > SLOPE.maxTan * 0.1 * 0.9) good = false;
        for (const oz of [0.1, 0.5, 0.9]) {
          const [gx, gz] = t.slopeAt(x + s / 10, z + oz);
          if (Math.hypot(gx, gz) > SLOPE.maxTan * 0.9) good = false;
        }
      }
      if (good && gy(x + 8, z + 0.5) - gy(x, z + 0.5) >= minRise) return [x, z];
    }
  return null;
}
/** A row walking +x that meets a rock face rising by d0..d1 at x+1, smooth ground on both sides. */
function findFace(d0: number, d1: number): [number, number] | null {
  for (let z = 10; z < n - 10; z++)
    for (let x = 10; x < n - 10; x++) {
      if (!free(x, z, -3, 4)) continue;
      const lo = gy(x + 0.5, z + 0.5);
      const hi = gy(x + 1.5, z + 0.5);
      if (hi - lo < d0 || hi - lo > d1) continue;
      let smooth = true;
      for (let dz = -1; dz <= 1 && smooth; dz++)
        for (let k = -3; k <= 4 && smooth; k++) {
          if (k === 1) continue;
          const a = gy(x + k - 0.5, z + dz + 0.5);
          const b = gy(x + k + 0.5, z + dz + 0.5);
          if (Math.abs(b - a) > 0.6) smooth = false;
        }
      if (smooth) return [x, z];
    }
  return null;
}
/** Distance of the feet to the surface under the body (centre or a foot at a rim). */
const feetErr = () => {
  let e = Infinity;
  for (const [dx, dz] of [[0, 0], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) e = Math.min(e, Math.abs(p.y - gy(p.x + dx, p.z + dz)));
  return e;
};
function put(x: number, z: number) {
  p.placeAt(x, z);
  p.y = gy(x, z);
  p.vx = p.vz = 0;
  for (let i = 0; i < 20; i++) run.update(dt, 0, 0);
}
/** Walks `frames` frames; returns the largest |feet − surface| seen while on the ground. */
function walk(frames: number, ix: number, iz = 0, jumpAt = -1): number {
  let err = 0;
  for (let i = 0; i < frames; i++) {
    if (i === jumpAt) p.requestJump();
    run.update(dt, ix, iz);
    if (p.jumpPhase === 'ground') err = Math.max(err, feetErr());
  }
  return err;
}

const s = findSlope(1);
ok(!!s, 'found a gentle hill slope');
if (s) {
  put(s[0] + 0.5, s[1] + 0.5);
  const y0 = p.y;
  let jumps = run.stats.jumps;
  let mono = true;
  let prev = p.y;
  let err = 0;
  for (let i = 0; i < 150 && p.x < s[0] + 8; i++) {
    run.update(dt, 1, 0);
    if (p.y < prev - 1e-4) mono = false;
    prev = p.y;
    err = Math.max(err, Math.abs(p.y - gy(p.x, p.z)));
    if (p.jumpPhase !== 'ground') mono = false;
  }
  ok(p.x >= s[0] + 7.5 && p.y > y0 + 0.9, `walks up the slope continuously (y ${y0.toFixed(2)}→${p.y.toFixed(2)})`);
  ok(mono && run.stats.jumps === jumps, 'no hops or dips on the way up');
  ok(err < 0.01, `feet on the surface going up (max err ${err.toFixed(4)})`);
  let e2 = 0;
  for (let i = 0; i < 200 && p.x > s[0] + 0.5; i++) e2 = Math.max(e2, walk(1, -1));
  ok(p.x < s[0] + 1 && Math.abs(p.y - y0) < 0.1 && p.jumpPhase === 'ground', `walks down again without falling (y=${p.y.toFixed(2)})`);
  ok(e2 < 0.01, `feet on the surface going down (max err ${e2.toFixed(4)})`);
  // diagonal
  put(s[0] + 0.5, s[1] + 0.2);
  const e3 = walk(80, 0.7, 0.7);
  ok(e3 < 0.01, `diagonal across the slope stays on the surface (err ${e3.toFixed(4)})`);
}
const c3 = findFace(2.6, 4.5);
ok(!!c3, 'found a cliff');
if (c3) {
  put(c3[0] - 1.5, c3[1] + 0.5);
  walk(90, 1);
  ok(p.x < c3[0] + 1, `a cliff blocks walking (x=${p.x.toFixed(2)}, face at ${c3[0] + 1})`);
  put(c3[0] - 1.5, c3[1] + 0.5);
  walk(90, 1, 0, 20);
  ok(p.x < c3[0] + 1, `and jumping (x=${p.x.toFixed(2)})`);
  put(c3[0] + 3.5, c3[1] + 0.5);
  const top = p.y;
  const j0 = run.stats.jumps;
  let fell = false;
  for (let i = 0; i < 120; i++) {
    run.update(dt, -1, 0);
    if (p.jumpPhase === 'air' && p.y < top - 0.5) fell = true;
  }
  ok(fell && feetErr() < 0.01 && p.jumpPhase !== 'air' && p.y < top - 2, `walks off the cliff and falls (y ${top.toFixed(2)}→${p.y.toFixed(2)})`);
  ok(run.stats.jumps === j0, 'a fall is not a jump');
  // paths never climb a rock face
  const path = findPath(t, c3[0] - 1.5, c3[1] + 0.5, c3[0] + 3.5, c3[1] + 0.5, 40000);
  let px = c3[0] - 1.5;
  let pz = c3[1] + 0.5;
  let bad = false;
  for (let i = 0; i < path.length; i += 2) {
    const steps = Math.ceil(Math.hypot(path[i] - px, path[i + 1] - pz) / 0.1);
    let prev = gy(px, pz);
    for (let k = 1; k <= steps; k++) {
      const e = gy(px + ((path[i] - px) * k) / steps, pz + ((path[i + 1] - pz) * k) / steps);
      if (e > prev + SLOPE.lip) bad = true;
      prev = e;
    }
    px = path[i];
    pz = path[i + 1];
  }
  ok(!bad, `click-to-move path around the cliff never climbs a face (${path.length / 2} legs)`);
}
const c2 = findFace(1.2, 2.05);
ok(!!c2, 'found a low ledge');
if (c2) {
  put(c2[0] - 1.5, c2[1] + 0.5);
  walk(90, 1);
  ok(p.x < c2[0] + 1, `a ledge blocks walking (x=${p.x.toFixed(2)})`);
  put(c2[0] - 1.5, c2[1] + 0.5);
  walk(120, 1, 0, 8);
  ok(p.x > c2[0] + 1 && feetErr() < 0.01, `a jump gets onto it (x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)})`);
}
// a steep slope (walkable tiers but too steep) blocks: check with canWalk directly on a synthetic case
{
  let found = false;
  let blocked = true;
  for (let z = 5; z < n - 5 && !found; z++)
    for (let x = 5; x < n - 5 && !found; x++) {
      if (t.blocksWalker(x, z)) continue;
      const [gx, gz] = t.slopeAt(x + 0.5, z + 0.5);
      if (Math.hypot(gx, gz) <= SLOPE.maxTan * 1.05 || t.deckC.has(z * n + x)) continue;
      found = true;
      const l = Math.hypot(gx, gz);
      const x1 = x + 0.5 + (gx / l) * 0.05;
      const z1 = z + 0.5 + (gz / l) * 0.05;
      blocked = !t.canWalk(x + 0.5 - (gx / l) * 0.05, z + 0.5 - (gz / l) * 0.05, x1, z1, gy(x + 0.5 - (gx / l) * 0.05, z + 0.5 - (gz / l) * 0.05));
    }
  ok(!found || blocked, found ? 'a slope steeper than 40° cannot be climbed' : 'no over-steep walkable slopes on the map');
}
ok(Math.abs(t.groundY(125.5, 128.5)) < 0.01 && !!t.reach && t.reach[128 * t.size + 125] === 1, 'spawn on flat reachable ground');
process.exit(fails ? 1 : 0);
