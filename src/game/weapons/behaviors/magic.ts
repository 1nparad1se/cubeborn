import { registerBehavior, type WeaponInstance } from '../Weapon';
import type { Run } from '../../Run';
import type { Enemy } from '../../Enemy';
import type { Projectile } from '../../Projectiles';
import type { Effect } from '../../Effects';
import { explosionFx, hitCircle, hitLine } from './util';
import { TAU } from '../../../core/math';

function strikeAt(w: WeaponInstance, run: Run, x: number, z: number) {
  const r = w.p('radius', 1.3) * w.area(run);
  hitCircle(run, w, x, z, r);
  const ef = run.effects.add('bolt', x, z, 0.22, w.def.color);
  ef.x2 = x + (run.rng.next() - 0.5) * 2;
  ef.z2 = z - 2;
  ef.y = 12;
  ef.w = 0.25;
  explosionFx(run, x, z, r, w.def.color, 0.05);
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
        if (t) strikeAt(w, run, t.x, t.z);
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

// Chain Spark / Thunderweb: lightning hopping between enemies.
const visited = new Set<number>();
registerBehavior('chain', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const hops = Math.round(w.p('chains', 4));
    const range = w.p('range', 4.5) * w.area(run);
    for (let i = 0; i < n; i++) {
      run.later(i * 0.12, () => {
        visited.clear();
        let from = { x: pl.x, z: pl.z };
        let cur: Enemy | null = run.enemies.nearest(pl.x, pl.z, 9, visited);
        let left = hops;
        while (cur && left-- > 0) {
          visited.add(cur.uid);
          const ef = run.effects.add('bolt', from.x, from.z, 0.2, w.def.color);
          ef.x2 = cur.x;
          ef.z2 = cur.z;
          ef.y = 0.9;
          ef.w = 0.12;
          run.combat.hit(cur, w.dmg, 1, cur.x - from.x, cur.z - from.z);
          run.fx.burst(cur.x, 0.9, cur.z, w.def.color, 4, 3, 0.1, 0.25, 'glow');
          if (w.evo) {
            const fork = run.enemies.nearest(cur.x, cur.z, range, visited);
            if (fork) {
              visited.add(fork.uid);
              const ef2 = run.effects.add('bolt', cur.x, cur.z, 0.2, 0xffffff);
              ef2.x2 = fork.x;
              ef2.z2 = fork.z;
              ef2.y = 0.9;
              ef2.w = 0.08;
              run.combat.hit(fork, w.dmg, 0.6, fork.x - cur.x, fork.z - cur.z);
            }
          }
          from = { x: cur.x, z: cur.z };
          cur = run.enemies.nearest(cur.x, cur.z, range, visited);
        }
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
    const t0 = run.enemies.nearest(pl.x, pl.z, 12);
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
        const t = run.enemies.nearest(pl.x, pl.z, len);
        if (t) {
          const want = Math.atan2(t.z - pl.z, t.x - pl.x);
          let d = want - b.angle;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          b.angle += d * Math.min(1, 4 * dt) + (b.idx ? 0.25 * b.idx * dt : 0);
        }
      }
      const ex = pl.x + Math.cos(b.angle) * len;
      const ez = pl.z + Math.sin(b.angle) * len;
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
