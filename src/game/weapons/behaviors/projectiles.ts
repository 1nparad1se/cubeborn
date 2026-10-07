import { registerBehavior, type WeaponInstance } from '../Weapon';
import type { Run } from '../../Run';
import type { Projectile } from '../../Projectiles';
import { aim, clipShot, explosionFx, hitCircle } from './util';
import { TAU } from '../../../core/math';

function shoot(w: WeaponInstance, run: Run, x: number, z: number, ang: number, speed: number, life: number, vis: string): Projectile {
  const p = run.projectiles.spawn(w, x, z, Math.cos(ang) * speed, Math.sin(ang) * speed, life, vis, w.def.color);
  p.pierce = w.pierce(run);
  return p;
}

// Twin Daggers / Thousand Edges: thrown in the movement direction.
registerBehavior('directional', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const base = Math.atan2(pl.fz, pl.fx);
    const sp = w.speed(run);
    const life = w.duration(run);
    if (w.evo) {
      const spread = (w.p('spread', 50) * Math.PI) / 180;
      for (let i = 0; i < n; i++) {
        const a = base + (run.rng.next() - 0.5) * spread;
        const p = shoot(w, run, pl.x, pl.z, a, sp, life, 'dagger');
        p.scale = 1.1;
      }
      if (run.rng.chance(0.3)) run.fx.sound('throw', 0.25);
      return;
    }
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.07), () => {
        const off = (i % 2 ? 1 : -1) * 0.25;
        const a = base + (run.rng.next() - 0.5) * 0.12;
        shoot(w, run, pl.x - Math.sin(base) * off, pl.z + Math.cos(base) * off, a, sp, life, 'dagger');
        run.fx.sound('throw', 0.35);
      });
    }
  },
});

// Arcane Staff / Archmage Scepter: homing bolts (evolution splits on hit).
registerBehavior('bolt', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.12), () => {
        const a0 = aim(w, run, 16);
        const a = Math.atan2(a0.z, a0.x) + (run.rng.next() - 0.5) * 0.6;
        const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.duration(run), 'bolt');
        p.homing = w.p('homing', 6);
        p.target = a0.target;
        p.targetUid = a0.target?.uid ?? 0;
        p.glow = 1;
        p.radius = 0.35;
        run.fx.sound('magic', 0.35);
      });
    }
  },
  projectileHit(w, run, p, e) {
    if (!w.evo || p.a === 1) return;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + run.rng.next();
      const c = shoot(w, run, e.x, e.z, a, w.speed(run) * 0.9, 0.8, 'bolt');
      c.a = 1;
      c.scale = 0.6;
      c.pierce = 0;
      c.homing = 4;
      c.hitIds.push(e.uid);
      c.dmg.damage *= 0.4;
    }
  },
});

// Ember Orb / Sunfire Core: explosive fireballs.
function fireballBlast(w: WeaponInstance, run: Run, p: Projectile) {
  if (p.a === 1) return;
  p.a = 1;
  const r = w.p('radius', 1.8) * w.area(run);
  hitCircle(run, w, p.x, p.z, r);
  explosionFx(run, p.x, p.z, r, 0xff8a2a, 0.08);
  run.fx.sound('fire', 0.5);
  if (w.evo) {
    const pool = run.projectiles.spawn(w, p.x, p.z, 0, 0, 3 * run.player.stats.duration, 'firepool', 0xff7a1a);
    pool.radius = r * 0.8;
    pool.scale = r * 0.8;
    pool.hitEvery = 0.5;
    pool.pierce = -1;
    pool.y = 0.05;
    pool.dmg.damage *= 0.12;
    pool.dmg.knockback = 0;
    pool.glow = 1;
  }
}
registerBehavior('fireball', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.15), () => {
        const a0 = aim(w, run, 14);
        const a = Math.atan2(a0.z, a0.x);
        const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.duration(run), 'fireball');
        p.pierce = 0;
        p.radius = 0.45;
        p.scale = 0.9 + w.area(run) * 0.2;
        p.glow = 1.5;
        p.spin = 6;
      });
    }
  },
  projectileHit(w, run, p) {
    fireballBlast(w, run, p);
  },
  projectileExpire(w, run, p) {
    fireballBlast(w, run, p);
  },
});

// Frost Shards / Absolute Zero: fan of slowing shards; evolution shatters frozen foes.
registerBehavior('frost', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const spread = (w.p('spread', 30) * Math.PI) / 180;
    const a0 = aim(w, run, 12);
    const base = Math.atan2(a0.z, a0.x);
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
      const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.duration(run), 'shard');
      p.radius = 0.3;
    }
    run.fx.sound('ice', 0.4);
  },
  onKill(w, run, e) {
    if (!w.evo || e.freezeT <= 0) return;
    if (run.rng.next() > 0.5) return;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const c = shoot(w, run, e.x, e.z, a, w.speed(run) * 0.8, 0.5, 'shard');
      c.scale = 0.6;
      c.dmg.damage *= 0.5;
      c.pierce = 1;
    }
    run.fx.burst(e.x, 0.6, e.z, 0xd0f8ff, 10, 4, 0.14, 0.4, 'glow');
  },
});

// Longbow / Skypiercer: fast piercing arrows; evolution bursts into more arrows.
registerBehavior('arrow', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.1), () => {
        const a0 = aim(w, run, 18);
        const a = Math.atan2(a0.z, a0.x) + (run.rng.next() - 0.5) * 0.08;
        const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.duration(run), 'arrow');
        p.radius = 0.3;
        run.fx.sound('bow', 0.4);
      });
    }
  },
  projectileExpire(w, run, p) {
    if (!w.evo || p.a === 1) return;
    const base = Math.atan2(p.vz, p.vx);
    for (let k = -2; k <= 2; k++) {
      const c = shoot(w, run, p.x, p.z, base + k * 0.3, w.speed(run) * 0.8, 0.45, 'arrow');
      c.a = 1;
      c.scale = 0.8;
      c.dmg.damage *= 0.5;
    }
  },
});

// Bolt Thrower / Siege Engine: heavy bolts in all directions.
registerBehavior('radial', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    w.state.rot = ((w.state.rot ?? 0) + Math.PI / n) % TAU;
    for (let i = 0; i < n; i++) {
      const a = w.state.rot + (i / n) * TAU;
      const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.duration(run), 'heavybolt');
      p.radius = 0.4;
      p.scale = 1.1;
    }
    run.fx.sound('bow', 0.6);
  },
  projectileHit(w, run, p, e) {
    if (!w.evo) return;
    const r = w.p('radius', 1.8) * w.area(run);
    hitCircle(run, w, e.x, e.z, r, 0.5);
    explosionFx(run, e.x, e.z, r, 0xffa04a, 0);
  },
});

// Moon Glaive / Eclipse Glaive: returning blades / spiralling glaives.
registerBehavior('boomerang', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(w.evo ? 0 : i * w.p('interval', 0.15), () => {
        const a0 = aim(w, run, 12);
        const a = w.evo ? (i / n) * TAU : Math.atan2(a0.z, a0.x) + (i - (n - 1) / 2) * 0.3;
        const p = shoot(w, run, pl.x, pl.z, a, w.speed(run), w.evo ? w.duration(run) : 6, 'glaive');
        p.custom = true;
        p.pierce = -1;
        p.radius = 0.55 * w.area(run);
        p.scale = w.area(run);
        p.spin = 14;
        p.a = a; // angle
        p.b = 0; // phase / distance
        p.c = Math.cos(a);
        p.d = Math.sin(a);
        p.hitEvery = w.evo ? 0.3 : 0;
        run.fx.sound('whoosh', 0.4);
      });
    }
  },
  projectileWall(w, run, p) {
    // outgoing glaives turn back at a wall; returning and spiralling ones are recalled through it
    if (!w.evo && p.e === 0) {
      p.e = 1;
      p.hitIds.length = 0;
    }
    return true;
  },
  projectileUpdate(w, run, p, dt) {
    const pl = run.player;
    if (w.evo) {
      // spiral out then in around the hero
      const life = w.duration(run);
      const t = p.age / life;
      const reach = w.p('reach', 8) * Math.sqrt(w.area(run));
      const r = 1 + Math.sin(t * Math.PI) * reach;
      p.a += (w.speed(run) / Math.max(2, r)) * dt;
      p.x = pl.x + Math.cos(p.a) * r;
      p.z = pl.z + Math.sin(p.a) * r;
      return p.life > 0;
    }
    const sp = w.speed(run);
    const reach = w.p('reach', 7);
    if (p.e === 0) {
      p.x += p.c * sp * dt;
      p.z += p.d * sp * dt;
      p.b += sp * dt;
      if (p.b >= reach) {
        p.e = 1;
        p.hitIds.length = 0;
      }
      return true;
    }
    const dx = pl.x - p.x;
    const dz = pl.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) return false;
    const s = sp * 1.25 * dt;
    p.x += (dx / d) * s;
    p.z += (dz / d) * s;
    p.vx = dx;
    p.vz = dz;
    return true;
  },
});

// Guardian Wisps / Spirit Choir: companions that shoot (evolution fires piercing rays).
registerBehavior('wisp', {
  update(w, run) {
    const want = w.amount(run);
    const list: Projectile[] = (w.state.wisps ??= []);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].active || list[i].owner !== w) list.splice(i, 1);
    while (list.length < want) {
      const pl = run.player;
      const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, 1e9, 'wisp', w.def.color);
      p.custom = true;
      p.collide = false;
      p.glow = 0.8;
      list.push(p);
    }
    while (list.length > want) list.pop()!.active = false;
    for (let i = 0; i < list.length; i++) list[i].a = (i / list.length) * TAU;
  },
  fire(w, run) {
    const range = w.p('range', 9);
    for (const wp of (w.state.wisps ?? []) as Projectile[]) {
      const t = run.enemies.nearest(wp.x, wp.z, range, undefined, !w.passWalls);
      if (!t) continue;
      const dx = t.x - wp.x;
      const dz = t.z - wp.z;
      const d = Math.hypot(dx, dz) || 1;
      if (w.evo) {
        const reach = range * clipShot(run, w, wp.x, wp.z, wp.x + (dx / d) * range, wp.z + (dz / d) * range);
        const ex = wp.x + (dx / d) * reach;
        const ez = wp.z + (dz / d) * reach;
        const ef = run.effects.add('beam', wp.x, wp.z, 0.2, w.def.color);
        ef.x2 = ex;
        ef.z2 = ez;
        ef.w = 0.35;
        ef.y = 1.2;
        run.enemies.forEachInRadius((wp.x + ex) / 2, (wp.z + ez) / 2, range / 2 + 0.5, (e) => {
          const t2 = ((e.x - wp.x) * dx + (e.z - wp.z) * dz) / d;
          if (t2 < 0 || t2 > reach) return false;
          const px = wp.x + (dx / d) * t2 - e.x;
          const pz = wp.z + (dz / d) * t2 - e.z;
          if (px * px + pz * pz < (0.4 + e.radius) ** 2) run.combat.hit(e, w.dmg, 1, dx, dz);
          return false;
        });
      } else {
        const sp = w.speed(run);
        const p = run.projectiles.spawn(w, wp.x, wp.z, (dx / d) * sp, (dz / d) * sp, w.duration(run), 'wispshot', w.def.color);
        p.pierce = w.pierce(run);
        p.y = 1.2;
        p.radius = 0.25;
      }
    }
    run.fx.sound('magic', 0.2);
  },
  projectileUpdate(w, run, p, dt) {
    if (p.vis !== 'wisp') return true;
    const pl = run.player;
    p.b += dt;
    const ang = p.a + p.b * 1.4;
    const tx = pl.x + Math.cos(ang) * 1.4;
    const tz = pl.z + Math.sin(ang) * 1.4;
    const k = 1 - Math.exp(-8 * dt);
    p.x += (tx - p.x) * k;
    p.z += (tz - p.z) * k;
    p.y = 1.3 + Math.sin(p.b * 3 + p.a) * 0.15;
    return true;
  },
  onRemove(w) {
    for (const p of (w.state.wisps ?? []) as Projectile[]) p.active = false;
  },
});
