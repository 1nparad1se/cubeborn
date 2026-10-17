import { EventBus } from '../core/EventBus';
import { DayNight } from '../game/DayNight';
import type { GameClock } from '../game/GameClock';
import type { Terrain } from '../game/Terrain';
import type { FxSink } from '../game/types';
import type { MapDef } from '../data/types';
import { computeStats, type CharStats, type Gear } from './equipment';
import type { WeaponStats } from './items';
import { RpgPlayer } from './Player';
import { DUMMIES, SPAWN, TEST_MAP, buildTestMap } from './testMap';

/** Training dummy: static, never attacks, never dies; it only counts the damage it takes. */
export class Dummy {
  readonly radius = 0.45;
  /** Height of the body (hits and projectiles aim at its middle). */
  readonly height = 1.7;
  total = 0;
  hits = 0;
  /** Recent hits (time, damage) for the DPS readout. */
  log: { t: number; d: number }[] = [];
  lastHit = -99;
  /** Hit wobble 0..1 (renderer). */
  wobble = 0;
  wobX = 0;
  wobZ = 0;
  constructor(readonly id: string, readonly name: string, readonly x: number, readonly z: number) {}

  /** Damage per second over the last 5 seconds of hits. */
  dps(now: number): number {
    const from = now - 5;
    let sum = 0;
    let first = now;
    for (const h of this.log)
      if (h.t >= from) {
        sum += h.d;
        first = Math.min(first, h.t);
      }
    if (sum <= 0) return 0;
    return sum / Math.max(1, now - first);
  }
}

export type ProjKind = NonNullable<WeaponStats['proj']>;

export interface Projectile {
  kind: ProjKind;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  left: number;
  damage: number;
  magic: boolean;
  /** Fixed target (the selected dummy) or null to fly straight. */
  target: Dummy | null;
  dead: boolean;
  age: number;
}

/** One frame of player intentions, filled by the client from keyboard and mouse. */
export interface Controls {
  /** Camera-relative walking input (world x, z), length ≤ 1. */
  moveX: number;
  moveZ: number;
  /** Click on the ground: walk there. */
  clickMove: { x: number; z: number } | null;
  /** Attack held (button or key): attack the target, or toward `aim` without one. */
  attackHeld: boolean;
  aimX: number;
  aimZ: number;
}

interface WorldEvents extends Record<string, unknown> {
  banner: string;
  dayPeriod: string;
  hit: { dummy: Dummy; damage: number };
}

/** The training ground simulation: the hero, three dummies and projectiles. No rendering. */
export class World {
  readonly map: MapDef = TEST_MAP;
  readonly terrain: Terrain;
  readonly events = new EventBus<WorldEvents>();
  readonly dayNight: DayNight;
  readonly player: RpgPlayer;
  readonly dummies: Dummy[];
  readonly projectiles: Projectile[] = [];
  readonly ctl: Controls = { moveX: 0, moveZ: 0, clickMove: null, attackHeld: false, aimX: 0, aimZ: 0 };
  /** The selected (pinned) target; attacks go to it. */
  target: Dummy | null = null;
  /** Attack the target automatically (walk into reach, then keep attacking). */
  autoAttack = false;
  time = 0;
  stats: CharStats;
  jumps = 0;

  constructor(
    readonly fx: FxSink,
    clock: GameClock,
    readonly raceId: string,
    public gear: Gear,
    terrain?: Terrain,
  ) {
    this.terrain = terrain ?? buildTestMap();
    this.dummies = DUMMIES.map((d) => new Dummy(d.id, d.name, d.x, d.z));
    this.stats = computeStats(raceId, gear);
    this.player = new RpgPlayer(this, SPAWN.x, SPAWN.z);
    this.dayNight = new DayNight(this, clock);
  }

  /** New gear (inventory change): stats follow at once. */
  setGear(g: Gear) {
    this.gear = g;
    this.stats = computeStats(this.raceId, g);
    this.player.cancelAttack();
  }

  select(d: Dummy | null, attack = false) {
    this.target = d;
    this.autoAttack = !!d && attack;
  }

  dummyAt(x: number, z: number, slack = 0.35): Dummy | null {
    let best: Dummy | null = null;
    let bd = 1e9;
    for (const d of this.dummies) {
      const dist = Math.hypot(d.x - x, d.z - z) - d.radius;
      if (dist < slack && dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  update(dt: number) {
    this.time += dt;
    this.dayNight.update();
    this.player.update(dt);
    this.updateProjectiles(dt);
    for (const d of this.dummies) {
      d.wobble = Math.max(0, d.wobble - dt * 2.2);
      while (d.log.length && d.log[0].t < this.time - 6) d.log.shift();
      // the running total starts over after ten quiet seconds
      if (d.total > 0 && this.time - d.lastHit > 10) {
        d.total = 0;
        d.hits = 0;
      }
    }
  }

  /** Damage to a dummy (it never dies): numbers, wobble and counters. */
  damage(d: Dummy, amount: number, magic: boolean, fromX: number, fromZ: number) {
    const v = Math.round(amount);
    d.total += v;
    d.hits++;
    d.lastHit = this.time;
    d.log.push({ t: this.time, d: v });
    d.wobble = 1;
    const l = Math.hypot(d.x - fromX, d.z - fromZ) || 1;
    d.wobX = (d.x - fromX) / l;
    d.wobZ = (d.z - fromZ) / l;
    this.fx.number(d.x, d.z, v, false, magic ? 0xc88cff : 0xffffff);
    this.fx.burst(d.x, 1.1, d.z, magic ? 0xb070ff : 0xd8c070, magic ? 10 : 7, 2.4, 0.12, 0.4, magic ? 'glow' : 'debris');
    this.fx.sound(magic ? 'magic' : 'hit', 0.6);
    this.events.emit('hit', { dummy: d, damage: v });
  }

  /** Called by the player at the hit moment of a basic attack. */
  resolveAttack(w: WeaponStats | null, dmg: number, fx: number, fz: number) {
    const p = this.player;
    const range = this.stats.range;
    const shape = w?.shape ?? 'melee';
    const magic = w?.dmgType === 'magic';
    if (shape === 'projectile' && w) {
      this.spawnProjectile(w, dmg, fx, fz);
      return;
    }
    if (shape === 'sweep' && w) {
      // every dummy inside the rectangle in front: length = reach, half-width = halfWidth
      const hw = w.halfWidth ?? 0.9;
      let n = 0;
      for (const d of this.dummies) {
        const rx = d.x - p.x;
        const rz = d.z - p.z;
        const along = rx * fx + rz * fz;
        const side = Math.abs(rx * fz - rz * fx);
        if (along > -d.radius && along <= range + d.radius && side <= hw + d.radius) {
          this.damage(d, dmg, false, p.x, p.z);
          n++;
        }
      }
      this.fx.burst(p.x + fx * range * 0.8, 1.1, p.z + fz * range * 0.8, 0xe8e8f0, 6, 3, 0.08, 0.25, 'glow');
      if (!n) this.fx.sound('thrust', 0.5);
      return;
    }
    // melee: the selected target when in reach, else the nearest dummy in a cone in front
    const inReach = (d: Dummy) => Math.hypot(d.x - p.x, d.z - p.z) - d.radius <= range + 0.15;
    let hit: Dummy | null = this.target && inReach(this.target) ? this.target : null;
    if (!hit) {
      let best = 1e9;
      for (const d of this.dummies) {
        const rx = d.x - p.x;
        const rz = d.z - p.z;
        const dist = Math.hypot(rx, rz);
        if (!inReach(d) || (rx * fx + rz * fz) / (dist || 1) < 0.5) continue;
        if (dist < best) {
          best = dist;
          hit = d;
        }
      }
    }
    if (hit) this.damage(hit, dmg, magic, p.x, p.z);
    else this.fx.sound('slash', 0.4);
  }

  private spawnProjectile(w: WeaponStats, dmg: number, fx: number, fz: number) {
    const p = this.player;
    const kind = w.proj ?? 'arrow';
    const y = p.y + 1.25;
    const sx = p.x + fx * 0.5;
    const sz = p.z + fz * 0.5;
    const tgt = this.target && Math.hypot(this.target.x - p.x, this.target.z - p.z) <= w.range + 1 ? this.target : null;
    let dx = fx;
    let dz = fz;
    let dy = 0;
    if (tgt) {
      const tx = tgt.x - sx;
      const tz = tgt.z - sz;
      const l = Math.hypot(tx, tz) || 1;
      dx = tx / l;
      dz = tz / l;
      dy = (this.terrain.groundY(tgt.x, tgt.z) + tgt.height * 0.6 - y) / l;
    }
    const n = Math.hypot(dx, dy, dz) || 1;
    this.projectiles.push({ kind, x: sx, y, z: sz, dx: dx / n, dy: dy / n, dz: dz / n, speed: w.projSpeed ?? 20, left: w.range * 1.15, damage: dmg, magic: w.dmgType === 'magic', target: tgt, dead: false, age: 0 });
    this.fx.sound(kind === 'arrow' || kind === 'bolt' ? 'bow' : 'magic', 0.6);
  }

  private updateProjectiles(dt: number) {
    const list = this.projectiles;
    for (const pr of list) {
      if (pr.dead) continue;
      pr.age += dt;
      const step = pr.speed * dt;
      // a few sub-steps so fast bolts cannot pass through a dummy
      const subs = Math.max(1, Math.ceil(step / 0.3));
      for (let s = 0; s < subs && !pr.dead; s++) {
        const k = step / subs;
        pr.x += pr.dx * k;
        pr.y += pr.dy * k;
        pr.z += pr.dz * k;
        pr.left -= k;
        for (const d of this.dummies) {
          const g = this.terrain.groundY(d.x, d.z);
          if (Math.hypot(pr.x - d.x, pr.z - d.z) <= d.radius + 0.12 && pr.y >= g - 0.1 && pr.y <= g + d.height + 0.2) {
            this.damage(d, pr.damage, pr.magic, pr.x - pr.dx, pr.z - pr.dz);
            pr.dead = true;
            break;
          }
        }
        if (pr.dead) break;
        const cx = Math.floor(pr.x);
        const cz = Math.floor(pr.z);
        if (pr.left <= 0 || pr.y < this.terrain.groundY(pr.x, pr.z) || this.terrain.blocksShot(cx, cz, pr.y)) {
          pr.dead = true;
          if (pr.magic) this.fx.burst(pr.x, pr.y - this.terrain.groundY(pr.x, pr.z), pr.z, pr.kind === 'orb' ? 0x6ab8ff : 0xffb040, 6, 2, 0.1, 0.3, 'glow');
        }
      }
      if (pr.magic && !pr.dead) this.fx.burst(pr.x, pr.y - this.terrain.groundY(pr.x, pr.z), pr.z, pr.kind === 'orb' ? 0x6ab8ff : 0xffb040, 1, 0.3, 0.07, 0.25, 'glow');
    }
    // keep the dead a moment so the renderer can drop them, then compact
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }
}
