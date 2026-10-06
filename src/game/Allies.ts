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
}

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
    const p = run.player;
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
        }
      }
      if (a.attack > 0) a.attack -= dt;
    }
  }

  clear() {
    for (const a of this.list) a.active = false;
  }
}
