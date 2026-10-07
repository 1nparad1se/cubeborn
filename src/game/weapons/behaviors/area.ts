import { registerBehavior, type WeaponInstance } from '../Weapon';
import type { Run } from '../../Run';
import type { Projectile } from '../../Projectiles';
import type { Effect } from '../../Effects';
import { explosionFx, groundTarget, hitCircle, reaches } from './util';
import { TAU } from '../../../core/math';

// Whirling Saws / Maelstrom Saws: blades orbiting the hero.
registerBehavior('orbit', {
  fire(w, run) {
    const list: Projectile[] = (w.state.saws ??= []);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].active) list.splice(i, 1);
    const n = w.amount(run);
    if (w.evo && list.length === n) return;
    for (const p of list) p.active = false;
    list.length = 0;
    const life = w.evo ? 1e9 : w.duration(run);
    for (let i = 0; i < n; i++) {
      const pl = run.player;
      const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, life, 'saw', w.def.color);
      p.custom = true;
      p.pierce = -1;
      p.hitEvery = w.p('hitEvery', 0.4);
      p.a = (i / n) * TAU;
      p.radius = 0.55 * w.area(run);
      p.scale = w.area(run);
      p.spin = 18;
      list.push(p);
    }
    run.fx.sound('saw', 0.4);
  },
  projectileUpdate(w, run, p) {
    const pl = run.player;
    const base = w.p('radius', 2.4) * Math.sqrt(w.area(run));
    const r = w.evo ? base * (1 + 0.4 * Math.sin(run.time * 1.6)) : base;
    const ang = p.a + run.time * w.speed(run);
    p.x = pl.x + Math.cos(ang) * r;
    p.z = pl.z + Math.sin(ang) * r;
    p.vx = -Math.sin(ang);
    p.vz = Math.cos(ang);
    p.radius = 0.55 * w.area(run);
    return true;
  },
  onRemove(w) {
    for (const p of (w.state.saws ?? []) as Projectile[]) p.active = false;
  },
});

// Sanctified Halo / Sanctum: damaging aura.
registerBehavior('aura', {
  update(w, run) {
    let ef: Effect | undefined = w.state.ef;
    if (!ef || !ef.active || ef.kind !== 'aura') {
      ef = run.effects.add('aura', run.player.x, run.player.z, 1e9, w.def.color);
      ef.follow = true;
      w.state.ef = ef;
    }
    ef.r = w.p('radius', 2.2) * w.area(run);
  },
  fire(w, run) {
    const pl = run.player;
    const r = w.p('radius', 2.2) * w.area(run);
    run.enemies.forEachInRadius(pl.x, pl.z, r, (e) => {
      if (!reaches(run, w, pl.x, pl.z, e)) return false;
      run.combat.hit(e, w.dmg, 1, e.x - pl.x, e.z - pl.z);
      if (w.evo && e.alive) {
        e.slowMul = Math.min(e.slowMul, w.p('slow', 0.6));
        e.slowT = Math.max(e.slowT, 0.6);
      }
      return false;
    });
  },
  onKill(w, run, e) {
    if (!w.evo) return;
    const pl = run.player;
    const r = w.p('radius', 2.2) * w.area(run) + 0.5;
    if ((e.x - pl.x) ** 2 + (e.z - pl.z) ** 2 < r * r) pl.heal(0.35, true);
  },
  onRemove(w) {
    if (w.state.ef) w.state.ef.active = false;
  },
});

// Pulse Heart / Resonance: expanding waves.
interface Wave {
  t: number;
  dur: number;
  r: number;
  x: number;
  z: number;
}
registerBehavior('nova', {
  fire(w, run) {
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * 0.3, () => {
        const pl = run.player;
        const r = w.p('radius', 5) * w.area(run);
        const dur = w.p('duration', 0.6);
        (w.state.waves ??= []).push({ t: 0, dur, r, x: pl.x, z: pl.z } as Wave);
        const ef = run.effects.add('ring', pl.x, pl.z, dur, w.def.color);
        ef.r = r;
        ef.w = 0.6;
        run.fx.sound('pulse', 0.5);
        run.fx.light(pl.x, pl.z, w.def.color, 2, r * 1.5, dur);
      });
    }
  },
  update(w, run, dt) {
    const waves: Wave[] = w.state.waves ?? [];
    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      const r0 = (wv.t / wv.dur) * wv.r;
      wv.t += dt;
      const r1 = Math.min(1, wv.t / wv.dur) * wv.r;
      run.enemies.forEachInRadius(wv.x, wv.z, r1, (e) => {
        const d = Math.hypot(e.x - wv.x, e.z - wv.z);
        if (d + e.radius < r0) return false;
        if (!reaches(run, w, wv.x, wv.z, e)) return false;
        run.combat.hit(e, w.dmg, 1, e.x - wv.x, e.z - wv.z);
        return false;
      });
      if (wv.t >= wv.dur) {
        waves.splice(i, 1);
        if (w.evo) {
          // drag survivors back toward the center
          run.enemies.forEachInRadius(wv.x, wv.z, wv.r + 1, (e) => {
            if (e.boss) return false;
            const dx = wv.x - e.x;
            const dz = wv.z - e.z;
            const d = Math.hypot(dx, dz) || 1;
            e.kx += (dx / d) * 9 * (1 - e.kbResist);
            e.kz += (dz / d) * 9 * (1 - e.kbResist);
            return false;
          });
        }
      }
    }
  },
});

// Cyclone Fan / Hurricane Eye: wandering tornadoes that pull enemies.
registerBehavior('tornado', {
  fire(w, run) {
    const pl = run.player;
    if (w.evo) {
      const t: Projectile | undefined = w.state.eye;
      if (t && t.active) return;
      const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, 1e9, 'tornado', w.def.color);
      p.custom = true;
      p.pierce = -1;
      p.hitEvery = w.p('hitEvery', 0.25);
      w.state.eye = p;
      return;
    }
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      const a = run.rng.next() * TAU;
      const sp = w.speed(run);
      const p = run.projectiles.spawn(w, pl.x, pl.z, Math.cos(a) * sp, Math.sin(a) * sp, w.duration(run), 'tornado', w.def.color);
      p.custom = true;
      p.pierce = -1;
      p.hitEvery = w.p('hitEvery', 0.35);
      p.a = a;
    }
    run.fx.sound('wind', 0.5);
  },
  projectileUpdate(w, run, p, dt) {
    const pl = run.player;
    const r = w.p('radius', 1.6) * w.area(run);
    p.radius = r;
    p.scale = r / 1.6;
    if (w.evo) {
      const k = 1 - Math.exp(-3 * dt);
      p.x += (pl.x - p.x) * k;
      p.z += (pl.z - p.z) * k;
    } else {
      p.a += (run.rng.next() - 0.5) * 4 * dt;
      const sp = w.speed(run);
      p.vx = Math.cos(p.a) * sp;
      p.vz = Math.sin(p.a) * sp;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
    }
    const pull = w.p('pull', 3);
    run.enemies.forEachInRadius(p.x, p.z, r * 2.2, (e) => {
      if (e.boss) return false;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      const f = pull * (1 - e.kbResist) * dt * 4;
      e.kx += (dx / d) * f - (dz / d) * f * 0.6;
      e.kz += (dz / d) * f + (dx / d) * f * 0.6;
      return false;
    });
    return p.life > 0;
  },
  projectileWall(w, run, p) {
    // tornadoes veer off walls instead of dissolving
    p.a += Math.PI * (0.75 + run.rng.next() * 0.5);
    return true;
  },
});

// Venom Flask / Plague Bloom: thrown flasks leave poison pools.
function makePool(w: WeaponInstance, run: Run, x: number, z: number, scale = 1) {
  const r = w.p('radius', 1.7) * w.area(run) * scale;
  const p = run.projectiles.spawn(w, x, z, 0, 0, w.duration(run) * scale, 'pool', w.def.color);
  p.custom = true;
  p.pierce = -1;
  p.hitEvery = w.p('hitEvery', 0.4);
  p.radius = r;
  p.scale = r;
  p.y = 0.04;
  p.a = r;
  p.dmg.knockback = 0;
  run.fx.burst(x, 0.3, z, w.def.color, 10, 3, 0.15, 0.5, 'glow');
  run.fx.sound('glass', 0.4);
}
registerBehavior('pool', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      const t = run.enemies.randomInRadius(pl.x, pl.z, 10);
      const tx = t ? t.x : pl.x + (run.rng.next() - 0.5) * 8;
      const tz = t ? t.z : pl.z + (run.rng.next() - 0.5) * 8;
      const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, 0.55, 'flask', w.def.color);
      p.custom = true;
      p.collide = false;
      p.spin = 10;
      p.a = pl.x;
      p.b = pl.z;
      p.c = tx;
      p.d = tz;
    }
  },
  projectileUpdate(w, run, p) {
    if (p.vis === 'flask') {
      const t = Math.min(1, p.age / 0.55);
      p.x = p.a + (p.c - p.a) * t;
      p.z = p.b + (p.d - p.b) * t;
      p.y = 0.8 + Math.sin(t * Math.PI) * 2.5;
      if (t >= 1) {
        makePool(w, run, p.x, p.z);
        return false;
      }
      return true;
    }
    // pool
    if (w.evo) {
      const grow = 1 + Math.min(0.6, p.age * 0.15);
      p.radius = p.a * grow;
      p.scale = p.radius;
    }
    return p.life > 0;
  },
  onKill(w, run, e) {
    if (!w.evo || e.poisonT <= 0) return;
    if ((w.state.bloomCd ?? 0) > run.time) return;
    w.state.bloomCd = run.time + 0.6;
    makePool(w, run, e.x, e.z, 0.6);
  },
});

// Powder Keg / Cluster Barrage: lobbed bombs.
function bombBlast(w: WeaponInstance, run: Run, x: number, z: number, scale: number) {
  const r = w.p('radius', 2.4) * w.area(run) * scale;
  hitCircle(run, w, x, z, r, scale < 1 ? 0.5 : 1);
  explosionFx(run, x, z, r, 0xff9b3d, scale < 1 ? 0.05 : 0.18);
  run.fx.sound('explosion', scale < 1 ? 0.3 : 0.6);
}
registerBehavior('lob', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.2), () => {
        const g = groundTarget(run, 11);
        const tx = g.x + (run.rng.next() - 0.5) * 2;
        const tz = g.z + (run.rng.next() - 0.5) * 2;
        const p = run.projectiles.spawn(w, pl.x, pl.z, 0, 0, 10, 'bomb', w.def.color);
        p.custom = true;
        p.collide = false;
        p.a = pl.x;
        p.b = pl.z;
        p.c = tx;
        p.d = tz;
        p.e = 1;
        p.spin = 6;
      });
    }
  },
  projectileUpdate(w, run, p) {
    const flight = 0.6;
    if (p.age < flight) {
      const t = p.age / flight;
      p.x = p.a + (p.c - p.a) * t;
      p.z = p.b + (p.d - p.b) * t;
      p.y = 0.6 + Math.sin(t * Math.PI) * 3 * p.e;
      return true;
    }
    p.y = 0.3;
    p.spin = 0;
    const fuse = (p.e < 1 ? 0.3 : w.p('duration', 0.8)) + flight;
    p.glow = Math.sin(p.age * 30) > 0 ? 1 : 0;
    if (p.age >= fuse) {
      bombBlast(w, run, p.x, p.z, p.e);
      if (w.evo && p.e === 1) {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + run.rng.next();
          const c = run.projectiles.spawn(w, p.x, p.z, 0, 0, 10, 'bomb', 0xffd04a);
          c.custom = true;
          c.collide = false;
          c.a = p.x;
          c.b = p.z;
          c.c = p.x + Math.cos(a) * 2.8;
          c.d = p.z + Math.sin(a) * 2.8;
          c.e = 0.5;
          c.scale = 0.6;
        }
      }
      return false;
    }
    return true;
  },
});

// Rune Traps / Minefield: proximity mines.
registerBehavior('mine', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + run.time;
      const r = n === 1 ? 0 : w.evo ? 3 : 1.5;
      const p = run.projectiles.spawn(w, pl.x + Math.cos(a) * r, pl.z + Math.sin(a) * r, 0, 0, w.duration(run), 'mine', w.def.color);
      p.custom = true;
      p.collide = false;
      p.y = 0.05;
      p.a = 0; // fuse (0 = waiting)
    }
    run.fx.sound('mine', 0.3);
  },
  projectileUpdate(w, run, p, dt) {
    if (p.a > 0) {
      p.a -= dt;
      if (p.a <= 0) {
        const r = w.p('radius', 2.2) * w.area(run);
        hitCircle(run, w, p.x, p.z, r);
        explosionFx(run, p.x, p.z, r, w.def.color, 0.1);
        run.fx.sound('explosion', 0.45);
        if (w.evo) {
          // chain reaction
          for (const o of run.projectiles.list)
            if (o.active && o !== p && o.owner === w && o.vis === 'mine' && o.a === 0 && (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < (r * 1.6) ** 2) o.a = 0.15;
        }
        return false;
      }
      p.glow = 1;
      return true;
    }
    p.glow = Math.sin(p.age * 6) > 0.6 ? 0.6 : 0;
    if (p.age < 0.5) return p.life > 0;
    const trig = w.p('trigger', 1.3);
    let found = false;
    run.enemies.forEachInRadius(p.x, p.z, trig, () => {
      found = true;
      return true;
    });
    if (found) p.a = 0.12;
    return p.life > 0;
  },
});

// Starfall Tome / Cataclysm: meteors onto clusters.
registerBehavior('meteor', {
  fire(w, run) {
    const n = w.amount(run);
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.3), () => {
        const g = groundTarget(run, 13);
        const r = w.p('radius', 2.8) * w.area(run);
        const fall = w.p('duration', 0.9);
        const ef = run.effects.add('warn', g.x, g.z, fall, w.def.color);
        ef.r = r;
        const p = run.projectiles.spawn(w, g.x - 3, g.z - 3, 0, 0, fall, 'meteor', w.def.color);
        p.custom = true;
        p.collide = false;
        p.a = g.x;
        p.b = g.z;
        p.c = fall;
        p.glow = 2;
        p.scale = 0.8 + r * 0.25;
      });
    }
  },
  projectileUpdate(w, run, p) {
    const t = Math.min(1, p.age / p.c);
    p.x = p.a - 3 * (1 - t);
    p.z = p.b - 3 * (1 - t);
    p.y = 14 * (1 - t) + 0.3;
    if (run.rng.chance(0.5)) run.fx.burst(p.x, p.y, p.z, 0xffa040, 1, 1, 0.2, 0.4, 'glow');
    if (t >= 1) {
      const r = w.p('radius', 2.8) * w.area(run);
      hitCircle(run, w, p.a, p.b, r);
      explosionFx(run, p.a, p.b, r, w.def.color, 0.3);
      run.fx.burst(p.a, 0.3, p.b, 0x5a4a3a, 14, 5, 0.25, 0.8, 'debris');
      run.fx.sound('explosion', 0.7);
      return false;
    }
    return true;
  },
});

// Bone Familiars / Legion of Bones: summoned skeleton allies.
registerBehavior('summon', {
  fire(w, run) {
    const pl = run.player;
    const n = w.amount(run);
    const have = run.allies.count(w.source);
    const toSpawn = w.evo ? n - have : n;
    const scale = (w.evo ? 1.25 : 1) * Math.sqrt(w.area(run));
    for (let i = 0; i < toSpawn; i++) {
      const a = run.rng.next() * TAU;
      run.allies.spawn(pl.x + Math.cos(a) * 1.5, pl.z + Math.sin(a) * 1.5, w.evo ? 1e9 : w.duration(run), w.speed(run), w.dmg, w.p('hitEvery', 0.6), w.evo ? 'ally_knight' : 'ally_skeleton', w.source, scale);
    }
    if (toSpawn > 0) run.fx.sound('bones', 0.5);
  },
  onRemove(w, run) {
    run.allies.dismiss(w.source);
  },
});
