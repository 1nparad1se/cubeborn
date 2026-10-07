import type { Enemy } from '../../Enemy';
import type { Run } from '../../Run';
import type { WeaponInstance } from '../Weapon';
import { segDist2, TAU } from '../../../core/math';

export interface Aim {
  x: number;
  z: number;
  target: Enemy | null;
}

const tmp: Aim = { x: 0, z: 1, target: null };

/** Resolves a firing direction for the weapon's targeting mode. Returns a shared object. */
export function aim(w: WeaponInstance, run: Run, range = 14): Aim {
  const p = run.player;
  tmp.target = null;
  w.aimAt = run.time;
  let t: Enemy | null = null;
  switch (w.def.targeting) {
    case 'nearest':
      t = run.enemies.nearest(p.x, p.z, range);
      break;
    case 'random':
      t = run.enemies.randomInRadius(p.x, p.z, range);
      break;
    case 'strongest':
      t = run.enemies.strongest(p.x, p.z, range);
      break;
    default:
      break;
  }
  if (t) {
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    tmp.x = dx / d;
    tmp.z = dz / d;
    tmp.target = t;
    w.aimX = tmp.x;
    w.aimZ = tmp.z;
    return tmp;
  }
  if (w.def.targeting === 'random') {
    const a = run.rng.next() * TAU;
    tmp.x = Math.cos(a);
    tmp.z = Math.sin(a);
    w.aimAt = -1;
    return tmp;
  }
  tmp.x = p.fx;
  tmp.z = p.fz;
  w.aimAt = -1;
  return tmp;
}

/** Point to drop area attacks on: an enemy cluster, else random near the player. */
export function groundTarget(run: Run, range = 12): { x: number; z: number } {
  const p = run.player;
  const c = run.enemies.cluster(p.x, p.z, range);
  if (c) return c;
  const a = run.rng.next() * TAU;
  const r = 3 + run.rng.next() * 5;
  return { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
}

/** Damages enemies in a circle. Returns number hit. */
export function hitCircle(run: Run, w: WeaponInstance, x: number, z: number, r: number, mult = 1, rehit = 0): number {
  let n = 0;
  const time = run.time;
  run.enemies.forEachInRadius(x, z, r, (e) => {
    if (rehit > 0) {
      if (time - e.lastHit[w.source] < rehit) return false;
      e.lastHit[w.source] = time;
    }
    run.combat.hit(e, w.dmg, mult, e.x - x, e.z - z);
    n++;
    return false;
  });
  return n;
}

/** Damages enemies along a segment. */
export function hitLine(run: Run, w: WeaponInstance, x0: number, z0: number, x1: number, z1: number, width: number, mult = 1, rehit = 0): number {
  let n = 0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const half = Math.hypot(x1 - x0, z1 - z0) / 2;
  const dirX = x1 - x0;
  const dirZ = z1 - z0;
  const time = run.time;
  run.enemies.forEachInRadius(cx, cz, half + width, (e) => {
    const rr = width / 2 + e.radius;
    if (segDist2(e.x, e.z, x0, z0, x1, z1) > rr * rr) return false;
    if (rehit > 0) {
      if (time - e.lastHit[w.source] < rehit) return false;
      e.lastHit[w.source] = time;
    }
    run.combat.hit(e, w.dmg, mult, dirX, dirZ);
    n++;
    return false;
  });
  return n;
}

export function explosionFx(run: Run, x: number, z: number, r: number, color: number, shake = 0.12) {
  run.fx.burst(x, 0.5, z, color, Math.min(40, 10 + r * 6), 3 + r * 2, 0.2, 0.55, 'glow');
  run.fx.burst(x, 0.4, z, 0x2a2a2a, 6, 2, 0.3, 0.8, 'smoke');
  run.fx.light(x, z, color, 3, r * 3.5, 0.3);
  const e = run.effects.add('flash', x, z, 0.3, color);
  e.r = r;
  if (shake > 0) run.fx.shake(shake);
}
