import { registerBehavior, type WeaponInstance } from '../Weapon';
import type { Run } from '../../Run';
import type { Enemy } from '../../Enemy';
import type { Projectile } from '../../Projectiles';
import type { Effect } from '../../Effects';
import { clipShot, explosionFx, hitCircle, hitLine } from './util';
import { TAU } from '../../../core/math';

/** A lightning strike on (x, z); `from` is the storm cloud it falls from (else the open sky). */
function strikeAt(w: WeaponInstance, run: Run, x: number, z: number, from?: Projectile) {
  const r = w.p('radius', 1.3) * w.area(run);
  hitCircle(run, w, x, z, r);
  // drawn by the weapon visuals as a natural strike; x2/z2/y name the cloud when there is one
  const ef = run.effects.add('strike', x, z, 0.8, w.def.color);
  ef.x2 = from ? from.x : x;
  ef.z2 = from ? from.z : z;
  ef.y = from ? from.y + 0.6 : 0;
  ef.r = r;
  explosionFx(run, x, z, r, w.def.color, 0.05, w.def.id);
  run.fx.sound('zap', 0.5);
}

// Storm Rod / Tempest Crown: lightning from the sky (evolution: orbiting storm clouds).
registerBehavior('strike', {
  update(w, run) {
    if (!w.evo) return;
    const want = w.amount(run) + 1;
    const list: Projectile[] = (w.state.clouds ??= []);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].active) list.splice(i, 1);
    while (list.length < want) {
      const pl = run.player;
      const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, 1e9, 'cloud', 0x8090b0);
      p.custom = true;
      p.collide = false;
      p.y = 4;
      list.push(p);
    }
    while (list.length > want) list.pop()!.active = false;
    list.forEach((p, i) => (p.a = (i / list.length) * TAU));
  },
  fire(w, run) {
    const pl = run.player;
    if (w.evo) {
      for (const c of (w.state.clouds ?? []) as Projectile[]) {
        const t = run.enemies.randomInRadius(c.x, c.z, 5);
        if (t) strikeAt(w, run, t.x, t.z, c);
      }
      return;
    }
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.1), () => {
        const t = run.enemies.randomInRadius(pl.x, pl.z, 13);
        if (t) strikeAt(w, run, t.x, t.z);
      });
    }
  },
  projectileUpdate(w, run, p, dt) {
    const pl = run.player;
    p.b += dt;
    const ang = p.a + p.b * 0.8;
    p.x = pl.x + Math.cos(ang) * 4.5;
    p.z = pl.z + Math.sin(ang) * 4.5;
    return true;
  },
  onRemove(w) {
    for (const p of (w.state.clouds ?? []) as Projectile[]) p.active = false;
  },
});

// Chain Spark / Thunderweb: a spark of lightning that hops from enemy to enemy. Each hop takes
// HOP seconds, so the spark is seen travelling and the damage lands as it arrives.
const HOP = 0.065;
let chainSerial = 1;
function chainHop(w: WeaponInstance, run: Run, id: number, k: number, fx: number, fz: number, cur: Enemy, left: number, range: number, seen: Set<number>, fork: boolean) {
  const los = !w.passWalls;
  seen.add(cur.uid);
  const ef = run.effects.add('spark', fx, fz, HOP + 0.28, fork ? 0xffffff : w.def.color);
  ef.x2 = cur.x;
  ef.z2 = cur.z;
  ef.y = 0.9;
  ef.r = id;
  ef.r2 = k;
  ef.w = HOP;
  ef.arc = fork ? 1 : 0;
  run.later(HOP, () => {
    const x = cur.alive ? cur.x : ef.x2;
    const z = cur.alive ? cur.z : ef.z2;
    if (cur.alive) run.combat.hit(cur, w.dmg, fork ? 0.6 : 1, x - fx, z - fz);
    // the path it took stays lit for a moment so the chain reads among many enemies
    const b = run.effects.add('bolt', fx, fz, 0.24, fork ? 0xffffff : w.def.color);
    b.x2 = x;
    b.z2 = z;
    b.y = 0.9;
    b.w = fork ? 0.07 : 0.1;
    if (fork) return;
    if (w.evo) {
      const f = run.enemies.nearest(x, z, range, seen, los);
      if (f) chainHop(w, run, chainSerial++, 0, x, z, f, 1, range, seen, true);
    }
    if (left > 1) {
      const next = run.enemies.nearest(x, z, range, seen, los);
      if (next) chainHop(w, run, id, k + 1, x, z, next, left - 1, range, seen, false);
    }
  });
}
registerBehavior('chain', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const hops = Math.round(w.p('chains', 4));
    const range = w.p('range', 4.5) * w.area(run);
    for (let i = 0; i < n; i++) {
      run.later(i * 0.12, () => {
        const seen = new Set<number>();
        const first = run.enemies.nearest(pl.x, pl.z, 9, seen, !w.passWalls);
        if (!first) return;
        chainHop(w, run, chainSerial++, 0, pl.x, pl.z, first, hops, range, seen, false);
        run.fx.light(pl.x, pl.z, w.def.color, 1.5, 6, 0.15);
        run.fx.sound('zap', 0.4);
      });
    }
  },
});

// Prism Ray / Rainbow Lattice: sustained beams.
interface BeamState {
  ef: Effect;
  angle: number;
  t: number;
  idx: number;
}
registerBehavior('beam', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const beams: BeamState[] = (w.state.beams ??= []);
    const dur = w.duration(run);
    const t0 = run.enemies.nearest(pl.x, pl.z, 12, undefined, !w.passWalls);
    const base = t0 ? Math.atan2(t0.z - pl.z, t0.x - pl.x) : Math.atan2(pl.fz, pl.fx);
    for (let i = 0; i < n; i++) {
      const ef = run.effects.add('beam', pl.x, pl.z, dur, w.def.color);
      ef.w = w.p('width', 0.7) * w.area(run);
      ef.y = 0.9;
      beams.push({ ef, angle: base + (i / n) * TAU * (w.evo ? 1 : 0.15), t: dur, idx: i });
    }
    run.fx.sound('beam', 0.5);
  },
  update(w, run, dt) {
    const beams: BeamState[] = w.state.beams ?? [];
    if (!beams.length) return;
    const pl = run.player;
    const len = w.p('length', 9) * w.area(run);
    const width = w.p('width', 0.7) * w.area(run);
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t -= dt;
      if (b.t <= 0) {
        b.ef.active = false;
        beams.splice(i, 1);
        continue;
      }
      if (w.evo) b.angle += 1.1 * dt;
      else {
        const t = run.enemies.nearest(pl.x, pl.z, len, undefined, !w.passWalls);
        if (t) {
          const want = Math.atan2(t.z - pl.z, t.x - pl.x);
          let d = want - b.angle;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          b.angle += d * Math.min(1, 4 * dt) + (b.idx ? 0.25 * b.idx * dt : 0);
        }
      }
      const reach = len * clipShot(run, w, pl.x, pl.z, pl.x + Math.cos(b.angle) * len, pl.z + Math.sin(b.angle) * len);
      const ex = pl.x + Math.cos(b.angle) * reach;
      const ez = pl.z + Math.sin(b.angle) * reach;
      b.ef.x = pl.x;
      b.ef.z = pl.z;
      b.ef.x2 = ex;
      b.ef.z2 = ez;
      b.ef.life = Math.max(b.ef.life, 0.05);
      hitLine(run, w, pl.x, pl.z, ex, ez, width, 1, w.p('hitEvery', 0.15));
      if (run.rng.chance(0.3)) run.fx.burst(ex, 0.9, ez, w.def.color, 1, 2, 0.12, 0.3, 'glow');
      run.fx.light((pl.x + ex) / 2, (pl.z + ez) / 2, w.def.color, 1.2, 6, 0.05);
    }
  },
  onRemove(w) {
    for (const b of (w.state.beams ?? []) as BeamState[]) b.ef.active = false;
    w.state.beams = [];
  },
});
