import { WALLS } from '../config/walls';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { makeDamage, type DamageInfo } from './types';
import type { WeaponInstance } from './weapons/Weapon';

/** Player-side projectile. Behaviours may take over movement with `custom`. */
export class Projectile {
  active = false;
  x = 0;
  y = 0.8;
  z = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  life = 1;
  age = 0;
  radius = 0.3;
  dmg: DamageInfo = makeDamage();
  /** Remaining enemies it can pass through; -1 = infinite. */
  pierce = 0;
  hitIds: number[] = [];
  /** >0: can re-hit the same enemy after this many seconds (uses enemy.lastHit). */
  hitEvery = 0;
  collide = true;
  /** Flies through walls (lobbed/arcing projectiles). Weapons with passWalls never stop either. */
  passWalls = false;
  custom = false;
  homing = 0;
  target: Enemy | null = null;
  targetUid = 0;
  vis = 'orb';
  color = 0xffffff;
  scale = 1;
  yaw = 0;
  pitch = 0;
  spin = 0;
  owner: WeaponInstance | null = null;
  /** Scratch values for behaviours. */
  a = 0;
  b = 0;
  c = 0;
  d = 0;
  e = 0;
  /** Light emitted for the light pool (0 = none). */
  glow = 0;
}

export class Projectiles {
  readonly list: Projectile[] = [];
  private free: Projectile[] = [];

  constructor(private run: Run) {
    for (let i = 0; i < 600; i++) this.free.push(new Projectile());
  }

  spawn(owner: WeaponInstance | null, x: number, z: number, vx: number, vz: number, life: number, vis: string, color: number): Projectile {
    const p = this.free.pop() ?? new Projectile();
    p.active = true;
    p.owner = owner;
    p.x = x;
    p.z = z;
    p.y = 0.8;
    p.vx = vx;
    p.vz = vz;
    p.vy = 0;
    p.life = life;
    p.age = 0;
    p.radius = 0.3;
    p.pierce = 0;
    p.hitIds.length = 0;
    p.hitEvery = 0;
    p.collide = true;
    p.passWalls = false;
    p.custom = false;
    p.homing = 0;
    p.target = null;
    p.targetUid = 0;
    p.vis = vis;
    p.color = color;
    p.scale = 1;
    p.yaw = Math.atan2(vx, vz);
    p.pitch = 0;
    p.spin = 0;
    p.a = p.b = p.c = p.d = p.e = 0;
    p.glow = 0;
    if (owner) {
      const src = owner.dmg;
      const d = p.dmg;
      d.damage = src.damage;
      d.critChance = src.critChance;
      d.critDamage = src.critDamage;
      d.knockback = src.knockback;
      d.source = src.source;
      d.weaponId = src.weaponId;
      d.slow = src.slow;
      d.slowDur = src.slowDur;
      d.freeze = src.freeze;
      d.freezeDur = src.freezeDur;
      d.poison = src.poison;
      d.poisonDur = src.poisonDur;
      d.burn = src.burn;
      d.burnDur = src.burnDur;
    }
    this.list.push(p);
    return p;
  }

  kill(p: Projectile) {
    if (!p.active) return;
    p.active = false;
    p.owner?.behavior.projectileExpire?.(p.owner, this.run, p);
  }

  update(dt: number) {
    const run = this.run;
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.active) {
        this.free.push(p);
        continue;
      }
      p.age += dt;
      p.life -= dt;
      const ox = p.x;
      const oz = p.z;
      if (p.custom && p.owner?.behavior.projectileUpdate) {
        if (!p.owner.behavior.projectileUpdate(p.owner, run, p, dt)) this.kill(p);
      } else {
        if (p.homing > 0) this.steer(p, dt);
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (p.vy) {
          p.y += p.vy * dt;
          p.vy -= 18 * dt;
        }
      }
      p.yaw += p.spin * dt;
      if (p.active && p.collide && !p.passWalls && (p.x !== ox || p.z !== oz) && !(p.owner?.passWalls ?? false)) {
        const t = run.terrain.shotRay(ox, oz, p.x, p.z);
        if (t < 1) this.hitWall(p, ox, oz, Math.max(0, t - 0.03));
      }
      if (p.active && p.life <= 0) this.kill(p);
      if (p.active && p.collide) this.collide(p);
      if (p.active) list[w++] = p;
      else this.free.push(p);
    }
    list.length = w;
  }

  /** Stops a projectile at a wall: impact sparks, then the behaviour may keep it (bounce/return). */
  private hitWall(p: Projectile, ox: number, oz: number, t: number) {
    const run = this.run;
    const hx = ox + (p.x - ox) * t;
    const hz = oz + (p.z - oz) * t;
    if (p.owner?.behavior.projectileWall?.(p.owner, run, p, hx, hz)) return;
    p.x = hx;
    p.z = hz;
    run.fx.burst(hx, Math.max(0.4, p.y), hz, p.color, WALLS.impactParticles, 2.5, 0.1, 0.25, 'glow');
    run.fx.burst(hx, Math.max(0.4, p.y), hz, 0x8a8478, 3, 2, 0.14, 0.4, 'debris');
    this.kill(p);
  }

  private steer(p: Projectile, dt: number) {
    const run = this.run;
    if (!p.target || !p.target.alive || p.target.uid !== p.targetUid) {
      p.target = run.enemies.nearest(p.x, p.z, 10, undefined, !(p.owner?.passWalls ?? false));
      p.targetUid = p.target?.uid ?? 0;
    }
    const t = p.target;
    if (!t) return;
    const sp = Math.hypot(p.vx, p.vz);
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, p.homing * dt);
    p.vx += ((dx / d) * sp - p.vx) * k;
    p.vz += ((dz / d) * sp - p.vz) * k;
    const s2 = Math.hypot(p.vx, p.vz) || 1;
    p.vx = (p.vx / s2) * sp;
    p.vz = (p.vz / s2) * sp;
    p.yaw = Math.atan2(p.vx, p.vz);
  }

  private collide(p: Projectile) {
    const run = this.run;
    const time = run.time;
    const beh = p.owner?.behavior;
    const wallsBlock = p.radius > 0.6 && !p.passWalls && !(p.owner?.passWalls ?? false);
    run.enemies.forEachInRadius(p.x, p.z, p.radius, (e) => {
      // big area projectiles (pools, tornadoes, crescents) don't reach behind walls
      if (wallsBlock && !run.terrain.los(p.x, p.z, e.x, e.z)) return false;
      if (p.hitEvery > 0) {
        const src = p.dmg.source;
        if (time - e.lastHit[src] < p.hitEvery) return false;
        e.lastHit[src] = time;
      } else {
        if (p.hitIds.includes(e.uid)) return false;
        p.hitIds.push(e.uid);
      }
      const len = Math.hypot(p.vx, p.vz);
      run.combat.hit(e, p.dmg, 1, len > 0.1 ? p.vx : e.x - p.x, len > 0.1 ? p.vz : e.z - p.z);
      if (p.owner && beh?.projectileHit) beh.projectileHit(p.owner, run, p, e);
      if (p.pierce >= 0) {
        p.pierce--;
        if (p.pierce < 0) {
          this.kill(p);
          return true;
        }
      }
      return !p.active;
    });
  }

  clear() {
    for (const p of this.list) p.active = false;
    this.list.length = 0;
  }
}
