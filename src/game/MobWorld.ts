import { L } from '../i18n';
import { creatureStats, mobScale, type CreatureStats } from '../data/creatureStats';
import type { EnemyDef } from '../data/types';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { buildCamps, type Camp } from './map/greenvaleZones';

/** Mobs farther than this from the hero stand still (no AI); they are drawn only nearer still. */
const ACTIVE_R = 48;
/** How far a mob follows the hero from its camp before it gives up and walks home. */
const LEASH = 16;
/** Seconds from the start of an attack to the moment it lands. */
const WINDUP = 0.38;

type MobState = 'idle' | 'wander' | 'chase' | 'return';

/** One camp member: the creature slot that respawns, and its live combat target while alive. */
export class Mob {
  e: Enemy | null = null;
  uid = 0;
  state: MobState = 'idle';
  timer = 0;
  tx = 0;
  tz = 0;
  /** Attack cooldown, and the running attack (counts down from WINDUP + recovery; 0 = none). */
  cd = 0;
  atkT = 0;
  respawnT = 0;
  lastHp = 0;
  /** Home spot inside the camp. */
  hx = 0;
  hz = 0;
  /** Seconds spent walking home without getting closer (cliffs): then it is put back at home. */
  stuckT = 0;
  bestD = 1e9;
  constructor(readonly camp: Camp, readonly s: CreatureStats, readonly def: EnemyDef) {}
}

/** A creature's shot at the hero. */
export interface MobShot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  /** Flight height (world y). */
  y: number;
  dmg: number;
  color: number;
  src: Enemy | null;
}

/**
 * The creatures living on the map: camps of every bestiary creature, a simple brain per mob
 * (wander, aggro, chase, attack, leash home), death and timed respawn per camp.
 */
export class MobWorld {
  readonly camps: Camp[];
  readonly mobs: Mob[] = [];
  readonly shots: MobShot[] = [];
  private byUid = new Map<number, Mob>();
  /** Creatures met this session (aggro or kill); `onMeet` fires once per id. */
  private met = new Set<string>();
  onMeet: ((id: string) => void) | null = null;

  constructor(private run: Run) {
    this.camps = run.map.noMobs ? [] : buildCamps(run.terrain);
    const defs = new Map<string, EnemyDef>();
    for (const camp of this.camps) {
      const c = camp.creature;
      const s = creatureStats(c);
      let def = defs.get(c.id);
      if (!def) {
        def = {
          id: c.id, name: c.name, category: s.flyer ? 'flying' : s.attack === 'ranged' ? 'ranged' : 'normal',
          behavior: s.flyer ? 'flyer' : s.attack === 'ranged' ? 'ranged' : 'chase',
          hp: s.hp, damage: s.damage, speed: s.speed, radius: s.radius, size: s.size, xp: s.xp, kbResist: s.kbResist,
          model: c.model, flying: s.flyer, p: { mob: 1 },
        };
        defs.set(c.id, def);
      }
      for (let i = 0; i < camp.size; i++) {
        const m = new Mob(camp, s, def);
        const a = (i / camp.size) * Math.PI * 2 + camp.x;
        m.hx = camp.x + Math.cos(a) * 2.2;
        m.hz = camp.z + Math.sin(a) * 2.2;
        this.mobs.push(m);
        this.spawn(m);
      }
    }
  }

  /** Whether an enemy is a world creature (drawn by the mob renderer, not as a voxel model). */
  static isMob(e: Enemy): boolean {
    return !!e.def.p?.mob;
  }

  mobOf(e: Enemy): Mob | undefined {
    return this.byUid.get(e.uid);
  }

  private spawn(m: Mob) {
    const sc = mobScale(m.s, m.camp.level);
    const e = this.run.enemies.spawn(m.def, m.hx, m.hz, { level: m.camp.level, hpMul: sc.hp / m.def.hp });
    if (!e) return;
    e.damage = sc.damage;
    e.xp = sc.xp;
    e.name = L(m.camp.creature.name);
    e.yaw = Math.random() * Math.PI * 2;
    if (m.s.flyer) e.y = 0;
    m.e = e;
    m.uid = e.uid;
    m.state = 'idle';
    m.timer = 1 + Math.random() * 3;
    m.cd = 0;
    m.atkT = 0;
    m.lastHp = e.hp;
    this.byUid.set(e.uid, m);
  }

  private meet(m: Mob) {
    const id = m.camp.creature.id;
    if (this.met.has(id)) return;
    this.met.add(id);
    this.onMeet?.(id);
  }

  update(dt: number) {
    const run = this.run;
    const p = run.player;
    for (const m of this.mobs) {
      const e = m.e;
      if (!e || !e.active || e.uid !== m.uid || e.dying > 0) {
        // dead: the camp brings it back after its respawn timer
        if (e) {
          if (e.uid === m.uid && e.hp <= 0) this.meet(m);
          this.byUid.delete(m.uid);
          m.e = null;
          m.respawnT = m.s.respawn * (0.8 + Math.random() * 0.4);
        }
        m.respawnT -= dt;
        // never pop back in under the hero's nose
        if (m.respawnT <= 0 && (m.hx - p.x) ** 2 + (m.hz - p.z) ** 2 > 18 * 18) this.spawn(m);
        continue;
      }
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > ACTIVE_R * ACTIVE_R && m.state !== 'return') {
        e.vx = e.vz = 0;
        if (m.state === 'chase') this.goHome(m);
        continue;
      }
      this.think(m, e, dt, dx, dz, Math.sqrt(d2));
    }
    this.updateShots(dt);
  }

  private goHome(m: Mob) {
    m.state = 'return';
    m.stuckT = 0;
    m.bestD = 1e9;
    m.atkT = 0;
    m.tx = m.hx;
    m.tz = m.hz;
  }

  /** Pulls the whole camp onto the hero (pack aggro). */
  private aggro(m: Mob) {
    if (m.state === 'chase') return;
    m.state = 'chase';
    this.meet(m);
    for (const o of this.mobs) if (o !== m && o.camp === m.camp && o.e && o.e.alive && o.state !== 'chase' && o.state !== 'return') o.state = 'chase';
  }

  private think(m: Mob, e: Enemy, dt: number, dx: number, dz: number, dist: number) {
    const run = this.run;
    const p = run.player;
    const s = m.s;
    const busy = e.stunT > 0 || e.freezeT > 0 || e.launchT > 0;
    const hurt = e.hp < m.lastHp;
    m.lastHp = e.hp;
    if (m.cd > 0) m.cd -= dt;
    const hdx = e.x - m.camp.x;
    const hdz = e.z - m.camp.z;
    const fromCamp = Math.hypot(hdx, hdz);
    if (m.state !== 'chase' && m.state !== 'return' && !p.dead && (dist < s.aggro || hurt)) this.aggro(m);
    let speed = 0;
    let mx = 0;
    let mz = 0;
    switch (m.state) {
      case 'idle':
        m.timer -= dt;
        if (m.timer <= 0) {
          m.state = 'wander';
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 3.5;
          m.tx = m.hx + Math.cos(a) * r;
          m.tz = m.hz + Math.sin(a) * r;
          m.timer = 6;
        }
        break;
      case 'wander': {
        m.timer -= dt;
        const wx = m.tx - e.x;
        const wz = m.tz - e.z;
        const wd = Math.hypot(wx, wz);
        if (wd < 0.3 || m.timer <= 0) {
          m.state = 'idle';
          m.timer = 2 + Math.random() * 4;
        } else {
          speed = s.speed * 0.4;
          mx = wx / wd;
          mz = wz / wd;
        }
        break;
      }
      case 'chase': {
        if (p.dead || fromCamp > LEASH + s.aggro) {
          this.goHome(m);
          break;
        }
        const reach = s.attack === 'ranged' ? s.range : e.radius + p.radius + s.range * 0.6;
        if (m.atkT > 0) {
          // attacking: stand, face the hero, land the blow at the end of the windup
          const before = m.atkT;
          m.atkT -= dt;
          const hitAt = s.attackCd * 0.5;
          if (before > hitAt && m.atkT <= hitAt && !busy) this.strike(m, e, dist, reach);
        } else if (dist <= reach && !busy) {
          if (m.cd <= 0) {
            m.atkT = WINDUP + s.attackCd * 0.5;
            m.cd = s.attackCd;
          }
          // ranged creatures back off a little when the hero comes very close
          if (s.attack === 'ranged' && dist < s.range * 0.45) {
            speed = s.speed * 0.6;
            mx = -dx / dist;
            mz = -dz / dist;
          }
        } else {
          speed = s.speed;
          mx = dx / (dist || 1);
          mz = dz / (dist || 1);
        }
        if (dist > 0.01) e.yaw = turn(e.yaw, Math.atan2(dx, dz), dt * 10);
        break;
      }
      case 'return': {
        const wx = m.tx - e.x;
        const wz = m.tz - e.z;
        const wd = Math.hypot(wx, wz);
        // walking home it heals up and shrugs off damage (no kiting a creature to death across the map)
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
        m.lastHp = e.hp;
        e.invuln = true;
        // blocked by terrain on the way back: after a while it simply turns up at home
        if (wd < m.bestD - 0.3) {
          m.bestD = wd;
          m.stuckT = 0;
        } else if ((m.stuckT += dt) > 4) {
          e.x = m.hx;
          e.z = m.hz;
        }
        if (wd < 0.5) {
          e.invuln = false;
          e.hp = e.maxHp;
          m.state = 'idle';
          m.timer = 1 + Math.random() * 2;
        } else {
          speed = s.speed * 1.5;
          mx = wx / wd;
          mz = wz / wd;
        }
        break;
      }
    }
    if (m.state !== 'return' && e.invuln) e.invuln = false;
    speed *= e.slowMul;
    e.vx = mx * speed;
    e.vz = mz * speed;
    if (speed > 0 && m.state !== 'chase') e.yaw = turn(e.yaw, Math.atan2(mx, mz), dt * 8);
    // flyers hover, bobbing
    if (s.flyer) e.y = 1.1 + Math.sin(e.anim * 2.4 + e.index) * 0.18;
  }

  private strike(m: Mob, e: Enemy, dist: number, reach: number) {
    const run = this.run;
    const p = run.player;
    const dmg = e.damage * (e.weakenT > 0 ? 0.7 : 1);
    if (m.s.attack === 'ranged') {
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const l = Math.hypot(dx, dz) || 1;
      const sp = 9;
      this.shots.push({ x: e.x + (dx / l) * 0.5, z: e.z + (dz / l) * 0.5, vx: (dx / l) * sp, vz: (dz / l) * sp, life: (m.s.range + 3) / sp, y: run.terrain.groundY(e.x, e.z) + 0.9, dmg, color: m.s.shot, src: e });
      run.fx.sound(m.s.shot === 0xffe0a0 ? 'bow' : 'magic', 0.3);
    } else if (dist <= reach + 0.5 && Math.abs(p.y - run.terrain.groundY(e.x, e.z)) < 1.6) {
      p.hurt(dmg, e);
    }
  }

  private updateShots(dt: number) {
    const run = this.run;
    const p = run.player;
    const t = run.terrain;
    let w = 0;
    for (const s of this.shots) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (s.life <= 0 || t.blocksShot(Math.floor(s.x), Math.floor(s.z), s.y + 0.7)) continue;
      if (!p.dead && (s.x - p.x) ** 2 + (s.z - p.z) ** 2 < (p.radius + 0.3) ** 2 && Math.abs(p.y + 0.9 - s.y) < 1.8) {
        p.hurt(s.dmg, s.src && s.src.alive ? s.src : null);
        run.fx.burst(s.x, s.y - t.groundY(s.x, s.z), s.z, s.color, 8, 3, 0.12, 0.35, 'glow');
        continue;
      }
      this.shots[w++] = s;
    }
    this.shots.length = w;
  }
}

function turn(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
