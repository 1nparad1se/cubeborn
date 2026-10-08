import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { makeDamage, type DamageInfo } from './types';

/** Friendly summoned minion (Bone Familiars, Raise Dead). */
export class Ally {
  active = false;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  yaw = 0;
  life = 0;
  speed = 6;
  scale = 1;
  dmg: DamageInfo = makeDamage();
  hitEvery = 0.6;
  model = 'ally_skeleton';
  target: Enemy | null = null;
  targetUid = 0;
  retarget = 0;
  anim = 0;
  swing = 0;
  attack = 0;
  /** Group id: weapon instance source or -1 for perk allies. */
  group = -1;
  /** Flying familiar (Bone Familiars): circles the hero, dashes at enemies, bites, returns. */
  fly = false;
  state: 'orbit' | 'dash' | 'bite' | 'return' = 'orbit';
  y = 0;
  orbitA = 0;
  phase = 0;
  /** Unique per spawn (pooled objects get a new one). */
  serial = 0;
}

let nextSerial = 1;

export class Allies {
  readonly list: Ally[] = [];

  constructor(private run: Run) {}

  spawn(x: number, z: number, life: number, speed: number, dmg: DamageInfo, hitEvery: number, model: string, group: number, scale = 1): Ally {
    let a = this.list.find((o) => !o.active);
    if (!a) {
      a = new Ally();
      this.list.push(a);
    }
    a.active = true;
    a.x = x;
    a.z = z;
    a.vx = a.vz = 0;
    a.life = life;
    a.speed = speed;
    a.hitEvery = hitEvery;
    a.model = model;
    a.group = group;
    a.scale = scale;
    a.target = null;
    a.retarget = 0;
    a.fly = false;
    a.state = 'orbit';
    a.y = 0;
    a.orbitA = Math.atan2(z - this.run.player.z, x - this.run.player.x);
    a.phase = Math.random() * 10;
    a.serial = nextSerial++;
    Object.assign(a.dmg, dmg);
    this.run.fx.burst(x, 0.6, z, 0xd8ffd0, 10, 3, 0.14, 0.5, 'glow');
    return a;
  }

  count(group: number): number {
    let n = 0;
    for (const a of this.list) if (a.active && a.group === group) n++;
    return n;
  }

  dismiss(group: number) {
    for (const a of this.list) if (a.active && a.group === group) a.active = false;
  }

  update(dt: number) {
    const run = this.run;
    for (const a of this.list) {
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0) {
        a.active = false;
        run.fx.burst(a.x, 0.6, a.z, 0xe8e2cc, 8, 2, 0.12, 0.5, 'debris');
        continue;
      }
      a.retarget -= dt;
      if (a.retarget <= 0 || !a.target || !a.target.alive || a.target.uid !== a.targetUid) {
        a.retarget = 0.5;
        a.target = run.enemies.nearest(a.x, a.z, 10);
        a.targetUid = a.target?.uid ?? 0;
      }
      if (a.fly) this.fly(a, dt);
      else this.walk(a, dt);
      a.swing -= dt;
      if (a.swing <= 0) {
        let hit = false;
        run.enemies.forEachInRadius(a.x, a.z, 0.7 * a.scale, (e) => {
          run.combat.hit(e, a.dmg, 1, e.x - a.x, e.z - a.z);
          hit = true;
          return false;
        });
        if (hit) {
          a.swing = a.hitEvery;
          a.attack = 0.2;
          if (a.fly && a.state === 'dash') a.state = 'bite';
        }
      }
      if (a.attack > 0) a.attack -= dt;
    }
  }

  private walk(a: Ally, dt: number) {
    const run = this.run;
    const p = run.player;
    {
      let tx = p.x;
      let tz = p.z;
      let chasing = false;
      if (a.target && (a.target.x - p.x) ** 2 + (a.target.z - p.z) ** 2 < 16 * 16) {
        tx = a.target.x;
        tz = a.target.z;
        chasing = true;
      }
      const dx = tx - a.x;
      const dz = tz - a.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = chasing ? 0 : 2;
      const sp = d > want ? a.speed : 0;
      a.vx = (dx / d) * sp;
      a.vz = (dz / d) * sp;
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      if (sp > 0) {
        a.yaw = Math.atan2(a.vx, a.vz);
        a.anim += dt * 8;
      }
      // teleport back if left far behind
      if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 > 400) {
        a.x = p.x + (Math.random() - 0.5) * 2;
        a.z = p.z + (Math.random() - 0.5) * 2;
      }
    }
  }

  /** Familiar flight: orbit → dash → bite (hovering on the prey) → return to the orbit. */
  private fly(a: Ally, dt: number) {
    const p = this.run.player;
    const t = this.run.time + a.phase;
    a.orbitA += dt * (1.5 + Math.sin(a.phase) * 0.3);
    const R = 1.7 + Math.sin(t * 1.3) * 0.35;
    const ox = p.x + Math.cos(a.orbitA) * R + Math.sin(t * 2.7) * 0.15;
    const oz = p.z + Math.sin(a.orbitA) * R + Math.cos(t * 2.3) * 0.15;
    const oy = 1.25 + Math.sin(t * 2.1) * 0.3;
    const tg = a.target && a.target.alive && a.target.uid === a.targetUid && (a.target.x - p.x) ** 2 + (a.target.z - p.z) ** 2 < 16 * 16 ? a.target : null;
    if (a.state === 'orbit' && tg && a.swing <= 0 && (tg.x - a.x) ** 2 + (tg.z - a.z) ** 2 < 7 * 7) a.state = 'dash';
    if ((a.state === 'dash' || a.state === 'bite') && !tg) a.state = 'return';
    let gx = ox;
    let gz = oz;
    let gy = oy;
    let sp = a.speed * 1.5;
    if (tg && a.state === 'dash') {
      gx = tg.x;
      gz = tg.z;
      gy = 0.75;
      sp = a.speed * 1.8;
    } else if (tg && a.state === 'bite') {
      // circles its prey, snapping whenever it can bite again
      const ang = t * 3;
      gx = tg.x + Math.cos(ang) * 0.6;
      gz = tg.z + Math.sin(ang) * 0.6;
      gy = 0.8 + Math.sin(t * 5) * 0.15;
      sp = a.speed * 1.2;
    }
    const dx = gx - a.x;
    const dz = gz - a.z;
    const d = Math.hypot(dx, dz);
    if (a.state === 'orbit') {
      // in orbit it rides along with the hero: a stiff spring, no speed cap
      const k = 1 - Math.exp(-7 * dt);
      a.vx = (dx * k) / Math.max(dt, 1e-4);
      a.vz = (dz * k) / Math.max(dt, 1e-4);
    } else {
      const s = d > 1e-3 ? Math.min(sp, d / Math.max(dt, 1e-4)) : 0;
      a.vx = d > 1e-3 ? (dx / d) * s : 0;
      a.vz = d > 1e-3 ? (dz / d) * s : 0;
    }
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.y += (gy - a.y) * (1 - Math.exp(-6 * dt));
    if (a.state === 'return' && d < 0.4) a.state = 'orbit';
    if (Math.hypot(a.vx, a.vz) > 0.05) a.yaw = Math.atan2(a.vx, a.vz);
    a.anim += dt * 8;
    if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 > 400) {
      a.x = ox;
      a.z = oz;
      a.state = 'orbit';
    }
  }

  clear() {
    for (const a of this.list) a.active = false;
  }
}
