import { segDist2 } from '../core/math';
import type { Enemy } from './Enemy';
import type { Run } from './Run';

export class Bullet {
  active = false;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  dmg = 0;
  r = 0.3;
  life = 0;
  color = 0xff3a6a;
  slow = false;
}

export class Zone {
  active = false;
  x = 0;
  z = 0;
  r = 1;
  /** Remaining telegraph time. */
  t = 0;
  tele = 1;
  dmg = 0;
  /** Lingering pool duration after detonation (0 = none). */
  pool = 0;
  poolT = 0;
  tick = 0;
  color = 0xff3030;
  freeze = false;
  /** Visual only (exploder/charger warnings). */
  visualOnly = false;
  delayedBlast = false;
}

export class Laser {
  active = false;
  x = 0;
  z = 0;
  angle = 0;
  sweep = 0;
  len = 10;
  /** Length after walls cut the beam (what is drawn and what hurts). */
  reach = 10;
  width = 1;
  tele = 1;
  t = 0;
  dur = 2;
  dmg = 0;
  tick = 0;
  owner: Enemy | null = null;
  ownerUid = 0;
  color = 0xff3060;
}

export class Shock {
  active = false;
  x = 0;
  z = 0;
  r = 0;
  maxR = 10;
  speed = 7;
  width = 1;
  dmg = 0;
  hit = false;
  color = 0xff5a3a;
}

export class LineWarn {
  active = false;
  x = 0;
  z = 0;
  dx = 0;
  dz = 0;
  len = 8;
  width = 1;
  t = 0;
  total = 1;
}

function pool<T extends { active: boolean }>(make: () => T, n: number): T[] {
  return Array.from({ length: n }, make);
}
function take<T extends { active: boolean }>(arr: T[], make: () => T): T {
  for (const o of arr) if (!o.active) return o;
  const o = make();
  arr.push(o);
  return o;
}

/** Enemy-side threats: bullets, telegraphed zones, lasers, shockwaves and explosions. */
export class Hazards {
  readonly bullets = pool(() => new Bullet(), 400);
  readonly zones = pool(() => new Zone(), 80);
  readonly lasers = pool(() => new Laser(), 16);
  readonly shocks = pool(() => new Shock(), 16);
  readonly warns = pool(() => new LineWarn(), 24);
  /** Countdown for global darkness from events/bosses. */

  constructor(private run: Run) {}

  bullet(x: number, z: number, vx: number, vz: number, dmg: number, r = 0.28, life = 4, color = 0xff3a6a, slow = false) {
    const b = take(this.bullets, () => new Bullet());
    b.active = true;
    b.x = x;
    b.z = z;
    b.vx = vx;
    b.vz = vz;
    b.dmg = dmg;
    b.r = r;
    b.life = life;
    b.color = color;
    b.slow = slow;
  }

  zone(x: number, z: number, r: number, tele: number, dmg: number, opts: { pool?: number; color?: number; freeze?: boolean } = {}) {
    const o = take(this.zones, () => new Zone());
    o.active = true;
    o.x = x;
    o.z = z;
    o.r = r;
    o.t = o.tele = tele;
    o.dmg = dmg;
    o.pool = opts.pool ?? 0;
    o.poolT = 0;
    o.tick = 0;
    o.color = opts.color ?? (opts.freeze ? 0x6ad8ff : 0xff3030);
    o.freeze = !!opts.freeze;
    o.visualOnly = false;
    o.delayedBlast = false;
    return o;
  }

  /** Purely visual warning circle. */
  telegraph(x: number, z: number, r: number, t: number) {
    const o = this.zone(x, z, r, t, 0);
    o.visualOnly = true;
  }

  delayedExplosion(x: number, z: number, r: number, dmg: number, t: number) {
    const o = this.zone(x, z, r, t, dmg);
    o.visualOnly = true;
    o.delayedBlast = true;
  }

  lineTelegraph(x: number, z: number, dx: number, dz: number, len: number, width: number, t: number) {
    const w = take(this.warns, () => new LineWarn());
    w.active = true;
    w.x = x;
    w.z = z;
    w.dx = dx;
    w.dz = dz;
    w.len = len;
    w.width = width;
    w.t = w.total = t;
  }

  laser(owner: Enemy | null, x: number, z: number, angle: number, opts: { sweep: number; len: number; width: number; tele: number; dur: number; dmg: number; color?: number }) {
    const l = take(this.lasers, () => new Laser());
    l.active = true;
    l.owner = owner;
    l.ownerUid = owner?.uid ?? 0;
    l.x = x;
    l.z = z;
    l.angle = angle;
    l.sweep = opts.sweep;
    l.len = opts.len;
    l.reach = opts.len;
    l.width = opts.width;
    l.tele = opts.tele;
    l.t = 0;
    l.dur = opts.dur;
    l.dmg = opts.dmg;
    l.tick = 0;
    l.color = opts.color ?? 0xff3060;
  }

  shock(x: number, z: number, maxR: number, speed: number, width: number, dmg: number, color = 0xff5a3a) {
    const s = take(this.shocks, () => new Shock());
    s.active = true;
    s.x = x;
    s.z = z;
    s.r = 0.5;
    s.maxR = maxR;
    s.speed = speed;
    s.width = width;
    s.dmg = dmg;
    s.hit = false;
    s.color = color;
  }

  /** Immediate explosion that can hit the player. */
  explode(x: number, z: number, r: number, dmg: number, color: number) {
    const run = this.run;
    const p = run.player;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < (r + p.radius) ** 2 && run.terrain.los(x, z, p.x, p.z)) p.hurt(dmg, null);
    run.fx.burst(x, 0.6, z, color, 26, 6, 0.2, 0.6, 'glow');
    run.fx.burst(x, 0.4, z, 0x333333, 10, 3, 0.25, 0.8, 'smoke');
    run.fx.light(x, z, color, 4, r * 3, 0.3);
    run.fx.shake(0.2);
    run.fx.sound('explosion', 0.6);
  }

  clearNear(x: number, z: number, r: number) {
    for (const b of this.bullets) if (b.active && (b.x - x) ** 2 + (b.z - z) ** 2 < r * r) b.active = false;
  }

  clearAll() {
    for (const b of this.bullets) b.active = false;
    for (const o of this.zones) o.active = false;
    for (const l of this.lasers) l.active = false;
    for (const s of this.shocks) s.active = false;
    for (const w of this.warns) w.active = false;
  }

  update(dt: number) {
    const run = this.run;
    const p = run.player;
    const t = run.terrain;
    for (const b of this.bullets) {
      if (!b.active) continue;
      const ox = b.x;
      const oz = b.z;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      // enemy shots stop at walls like the player's (the shooter's own cell never blocks)
      const hit = t.shotRay(ox, oz, b.x, b.z);
      if (hit < 1) {
        b.active = false;
        run.fx.burst(ox + (b.x - ox) * hit, 0.8, oz + (b.z - oz) * hit, b.color, 4, 2, 0.1, 0.25, 'glow');
        continue;
      }
      const rr = b.r + p.radius;
      if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < rr * rr) {
        b.active = false;
        if (p.hurt(b.dmg, null) > 0 && b.slow) p.slowT = 1.5;
        run.fx.burst(b.x, 0.8, b.z, b.color, 6, 3, 0.12, 0.3, 'glow');
      }
    }
    for (const o of this.zones) {
      if (!o.active) continue;
      if (o.t > 0) {
        o.t -= dt;
        if (o.t <= 0) {
          if (o.visualOnly && !o.delayedBlast) {
            o.active = false;
            continue;
          }
          // detonate
          const inside = (p.x - o.x) ** 2 + (p.z - o.z) ** 2 < (o.r + p.radius * 0.5) ** 2 && t.los(o.x, o.z, p.x, p.z);
          if (inside) {
            p.hurt(o.dmg, null);
            if (o.freeze) p.slowT = 2;
          }
          run.fx.burst(o.x, 0.4, o.z, o.color, 16, 5, 0.18, 0.5, 'glow');
          run.fx.light(o.x, o.z, o.color, 2.5, o.r * 3, 0.25);
          if (o.pool > 0) o.poolT = o.pool;
          else o.active = false;
        }
      } else {
        o.poolT -= dt;
        o.tick -= dt;
        if (o.tick <= 0) {
          o.tick = 0.5;
          if ((p.x - o.x) ** 2 + (p.z - o.z) ** 2 < o.r * o.r && t.los(o.x, o.z, p.x, p.z)) p.hurt(o.dmg * 0.35, null, true);
        }
        if (o.poolT <= 0) o.active = false;
      }
    }
    for (const l of this.lasers) {
      if (!l.active) continue;
      if (l.owner) {
        if (!l.owner.alive || l.owner.uid !== l.ownerUid) {
          l.active = false;
          continue;
        }
        l.x = l.owner.x;
        l.z = l.owner.z;
      }
      l.t += dt;
      if (l.t > l.tele) l.angle += l.sweep * dt;
      l.reach = l.len * t.shotRay(l.x, l.z, l.x + Math.cos(l.angle) * l.len, l.z + Math.sin(l.angle) * l.len);
      if (l.t > l.tele) {
        l.tick -= dt;
        const ex = l.x + Math.cos(l.angle) * l.reach;
        const ez = l.z + Math.sin(l.angle) * l.reach;
        if (l.tick <= 0 && segDist2(p.x, p.z, l.x, l.z, ex, ez) < (l.width / 2 + p.radius) ** 2) {
          l.tick = 0.25;
          p.hurt(l.dmg, null);
        }
      }
      if (l.t > l.tele + l.dur) l.active = false;
    }
    for (const s of this.shocks) {
      if (!s.active) continue;
      s.r += s.speed * dt;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (!s.hit && Math.abs(d - s.r) < s.width / 2 + p.radius && t.los(s.x, s.z, p.x, p.z)) {
        s.hit = true;
        p.hurt(s.dmg, null);
      }
      if (s.r >= s.maxR) s.active = false;
    }
    for (const w of this.warns) {
      if (!w.active) continue;
      w.t -= dt;
      if (w.t <= 0) w.active = false;
    }
  }
}
