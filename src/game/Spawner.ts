import { BALANCE } from '../config/balance';
import { TAU } from '../core/math';
import { ELITE_IDS, ENEMY_BY_ID, type EliteId } from '../data/enemies';
import type { MapEvent, SpawnSegment } from '../data/types';
import { BossController } from './bosses/Boss';
import type { Enemy } from './Enemy';
import type { Run } from './Run';

/** Time-based enemy waves, scripted map events, bosses and breakable props. */
export class Spawner {
  private acc = 0;
  private eventIdx = 0;
  private events: MapEvent[];
  private midSpawned = false;
  private bossSpawned = false;
  private propTimer = 0;
  private rain: { t: number; style: string; radius: number; every: number; acc: number } | null = null;

  constructor(private run: Run) {
    this.events = [...run.map.events].sort((a, b) => a.t - b.t);
  }

  get segment(): SpawnSegment {
    const segs = this.run.map.segments;
    let s = segs[0];
    for (const g of segs) if (g.t <= this.run.time) s = g;
    return s;
  }

  get bossSpawnedFlag() {
    return this.bossSpawned;
  }

  /** Waves are reduced while a boss fight is underway. */
  private bossDamp(): number {
    return this.run.bosses.length > 0 ? 0.45 : 1;
  }

  update(dt: number) {
    const run = this.run;
    const seg = this.segment;
    const curse = run.player.stats.curse;
    const ramp = Math.min(1, run.time / BALANCE.runDuration);
    const rate = (seg.rate / 60) * (1 + (BALANCE.spawnRateMul - 1) * ramp) * run.diff.spawn * curse * this.bossDamp();
    const max = Math.min(BALANCE.hardCap, seg.max * (1 + (BALANCE.spawnMaxMul - 1) * ramp) * run.diff.spawn * curse);
    this.acc += rate * dt;
    // catch up faster when the field is nearly empty
    if (run.enemies.aliveCount < max * 0.3) this.acc += rate * dt * 2;
    let guard = 0;
    while (this.acc >= 1 && guard++ < 40) {
      this.acc -= 1;
      if (run.enemies.aliveCount >= max) {
        this.acc = Math.min(this.acc, 1);
        break;
      }
      const pick = run.rng.weighted(seg.pool, (p) => p[1]);
      if (pick) this.spawnOne(pick[0]);
    }
    // scripted events
    while (this.eventIdx < this.events.length && this.events[this.eventIdx].t <= run.time) this.runEvent(this.events[this.eventIdx++]);
    if (!this.midSpawned && run.time >= run.map.bossTime / 2) {
      this.midSpawned = true;
      this.spawnBoss(run.map.midBoss, false);
    }
    if (!this.bossSpawned && run.time >= run.map.bossTime) {
      this.bossSpawned = true;
      this.spawnBoss(run.map.boss, true);
    }
    if (this.rain) this.updateRain(dt);
    this.propTimer -= dt;
    if (this.propTimer <= 0) {
      this.propTimer = 2.5;
      this.maintainProps();
    }
  }

  private eliteChance(): number {
    const run = this.run;
    if (run.time < BALANCE.eliteChanceStart) return 0;
    const min = (run.time - BALANCE.eliteChanceStart) / 60;
    return Math.min(0.03, 0.002 + min * BALANCE.eliteChancePerMin) * run.diff.elite;
  }

  randomElite(): EliteId {
    return this.run.rng.pick(ELITE_IDS);
  }

  spawnOne(id: string, elite?: EliteId | null): Enemy | null {
    const run = this.run;
    const def = ENEMY_BY_ID[id];
    if (!def) return null;
    const pos = this.findSpawnPos(!!def.flying);
    if (!pos) return null;
    if (elite === undefined) elite = run.rng.chance(this.eliteChance()) ? this.randomElite() : null;
    const e = run.enemies.spawn(def, pos.x, pos.z, { elite });
    if (e && elite && run.diff.elite >= 2.4 && run.rng.chance(0.5)) {
      let second = this.randomElite();
      if (second === elite) second = this.randomElite();
      if (second !== elite) run.enemies.makeElite(e, second);
    }
    return e;
  }

  /** Random point on a ring around the player, biased toward the movement direction. */
  findSpawnPos(flying: boolean, rMin = BALANCE.spawnRadiusMin, rMax = BALANCE.spawnRadiusMax): { x: number; z: number } | null {
    const run = this.run;
    const p = run.player;
    const t = run.terrain;
    const moveAng = Math.atan2(p.vz, p.vx);
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    for (let k = 0; k < 12; k++) {
      const a = moving && run.rng.chance(0.5) ? moveAng + (run.rng.next() - 0.5) * 2.2 : run.rng.next() * TAU;
      const r = run.rng.range(rMin, rMax);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      if (flying ? t.blocksFlyer(cx, cz) : t.blocksWalker(cx, cz)) continue;
      if (!flying && !run.nav.has(cx, cz)) continue;
      return { x, z };
    }
    return null;
  }

  relocate(e: Enemy) {
    const pos = this.findSpawnPos(e.flying);
    if (!pos) return;
    e.x = pos.x;
    e.z = pos.z;
    e.kx = e.kz = 0;
  }

  private spawnBoss(id: string, final: boolean) {
    const run = this.run;
    const pos = this.findSpawnPos(true, 13, 15) ?? { x: run.player.x + 12, z: run.player.z };
    const b = BossController.spawn(run, id, pos.x, pos.z, final);
    if (b) {
      run.events.emit('bossSpawn', b);
      run.fx.sound('bossRoar');
      run.fx.shake(0.5);
    }
  }

  private runEvent(ev: MapEvent) {
    const run = this.run;
    const p = run.player;
    switch (ev.type) {
      case 'swarm': {
        const n = Math.round(((ev.count as number) ?? 30) * run.diff.spawn);
        const def = ENEMY_BY_ID[ev.enemy as string];
        if (!def) break;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const x = p.x + Math.cos(a) * 17;
          const z = p.z + Math.sin(a) * 17;
          const cx = Math.floor(x);
          const cz = Math.floor(z);
          if (def.flying ? run.terrain.blocksFlyer(cx, cz) : run.terrain.blocksWalker(cx, cz)) continue;
          run.enemies.spawn(def, x, z);
        }
        run.events.emit('banner', 'ev_swarm');
        break;
      }
      case 'stampede': {
        const n = Math.round(((ev.count as number) ?? 20) * run.diff.spawn);
        const def = ENEMY_BY_ID[ev.enemy as string];
        if (!def) break;
        const a = run.rng.next() * TAU;
        const px = -Math.sin(a);
        const pz = Math.cos(a);
        for (let i = 0; i < n; i++) {
          const off = (i - n / 2) * 0.9;
          const x = p.x + Math.cos(a) * 18 + px * off;
          const z = p.z + Math.sin(a) * 18 + pz * off;
          if (!run.terrain.walkableAt(x, z)) continue;
          const e = run.enemies.spawn(def, x, z);
          if (e) e.speed *= 1.3;
        }
        run.events.emit('banner', 'ev_stampede');
        break;
      }
      case 'elite': {
        const n = (ev.count as number) ?? 1;
        for (let i = 0; i < n; i++) this.spawnOne(ev.enemy as string, this.randomElite());
        run.events.emit('banner', 'ev_elite');
        break;
      }
      case 'chest': {
        const pos = this.findSpawnPos(false, 6, 10);
        if (pos) run.pickups.spawnChest(pos.x, pos.z);
        break;
      }
      case 'treasure': {
        const pos = this.findSpawnPos(false, 8, 11);
        if (!pos) break;
        const e = run.enemies.spawnById('treasure_sprite', pos.x, pos.z);
        if (e) e.ttl = 22;
        run.events.emit('banner', 'ev_treasure');
        break;
      }
      case 'hazard_rain':
        this.rain = { t: (ev.duration as number) ?? 20, style: (ev.style as string) ?? 'meteor', radius: (ev.radius as number) ?? 2, every: ((ev.duration as number) ?? 20) / ((ev.count as number) ?? 30), acc: 0 };
        run.events.emit('banner', 'ev_rain_' + this.rain.style);
        break;
      case 'darkness':
        run.weather.darkness = (ev.duration as number) ?? 30;
        run.events.emit('banner', 'ev_darkness');
        break;
      case 'blizzard':
        run.weather.blizzard = (ev.duration as number) ?? 40;
        run.events.emit('banner', 'ev_blizzard');
        break;
      case 'arcane_surge':
        run.weather.surge = (ev.duration as number) ?? 40;
        run.events.emit('banner', 'ev_surge');
        break;
    }
  }

  private updateRain(dt: number) {
    const run = this.run;
    const r = this.rain!;
    r.t -= dt;
    r.acc += dt;
    while (r.acc >= r.every) {
      r.acc -= r.every;
      const p = run.player;
      const a = run.rng.next() * TAU;
      const d = run.rng.range(0, 9);
      const x = p.x + Math.cos(a) * d + p.vx * 0.6;
      const z = p.z + Math.sin(a) * d + p.vz * 0.6;
      const dmg = 12 * run.map.tier * run.diff.damage;
      if (r.style === 'spore') run.hazards.zone(x, z, r.radius, 1.3, dmg * 0.6, { pool: 3, color: 0xa04aff });
      else if (r.style === 'arcane') run.hazards.zone(x, z, r.radius, 1.2, dmg, { color: 0x9a6aff });
      else {
        run.hazards.zone(x, z, r.radius, 1.3, dmg, { color: 0xff7a1a });
        run.spawnFallingRock(x, z, 1.3, 0xff7a1a);
      }
    }
    if (r.t <= 0) this.rain = null;
  }

  /** Keeps a handful of breakable crates around the player. */
  private maintainProps() {
    const run = this.run;
    const p = run.player;
    let near = 0;
    run.enemies.forEachInRadius(p.x, p.z, 30, (e) => {
      if (e.def.id === 'crate') near++;
    });
    const want = 8;
    for (let i = near; i < want; i++) {
      const pos = this.findSpawnPos(false, 14, 26);
      if (!pos) continue;
      run.enemies.spawnById('crate', Math.floor(pos.x) + 0.5, Math.floor(pos.z) + 0.5, { noScale: true });
    }
  }
}
