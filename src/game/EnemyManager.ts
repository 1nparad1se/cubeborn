import { SpatialGrid } from '../core/SpatialGrid';
import { BALANCE } from '../config/balance';
import { ELITE_MODS, ENEMY_BY_ID, type EliteId } from '../data/enemies';
import type { EnemyDef } from '../data/types';
import { Enemy } from './Enemy';
import type { Run } from './Run';
import { TAU } from '../core/math';

const GRID_CELL = 2;

/** Owns all enemies: pooling, AI, movement, separation and spatial queries. */
export class EnemyManager {
  readonly list: Enemy[] = [];
  private free: number[] = [];
  readonly grid: SpatialGrid;
  private xs: Float32Array;
  private zs: Float32Array;
  aliveCount = 0;
  /** Seconds of global freeze from the Chrono pickup. */
  frozenAll = 0;
  /** Total enemies spawned this run (debug info derives the spawn rate from it). */
  spawned = 0;
  private uidCounter = 1;

  constructor(private run: Run, capacity = 1600) {
    const size = run.terrain.size;
    this.grid = new SpatialGrid(size, size, GRID_CELL, capacity);
    this.xs = new Float32Array(capacity);
    this.zs = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.list.push(new Enemy(i));
      this.free.push(capacity - 1 - i);
    }
  }

  private grow() {
    const old = this.list.length;
    const n = old * 2;
    for (let i = old; i < n; i++) {
      this.list.push(new Enemy(i));
      this.free.push(i);
    }
    const xs = new Float32Array(n);
    xs.set(this.xs);
    this.xs = xs;
    const zs = new Float32Array(n);
    zs.set(this.zs);
    this.zs = zs;
  }

  /** Spawns an enemy with time/difficulty scaling applied. */
  spawn(def: EnemyDef, x: number, z: number, opts: { elite?: EliteId | null; hpMul?: number; noScale?: boolean } = {}): Enemy | null {
    if (this.free.length === 0) {
      if (this.list.length >= 4096) return null;
      this.grow();
    }
    const e = this.list[this.free.pop()!];
    e.reset(def);
    e.uid = this.uidCounter++;
    e.x = x;
    e.z = z;
    const r = this.run;
    const sc = r.waveScale;
    const tier = r.map.tier;
    const curse = r.player.stats.curse;
    const hpMul = opts.noScale ? 1 : tier * r.diff.hp * sc.hp * (1 + (curse - 1) * 0.5);
    const dmgMul = opts.noScale ? 1 : (0.85 + tier * 0.15) * r.diff.damage * sc.damage;
    e.maxHp = e.hp = Math.max(1, def.hp * hpMul * (opts.hpMul ?? 1) * r.debug.enemyHp);
    e.damage = def.damage * dmgMul * r.debug.enemyDmg;
    this.spawned++;
    // wave speed-ups mostly affect slow enemies so that fast ones stay outrunnable
    const spBoost = opts.noScale ? 0 : (sc.speed - 1) * Math.min(1, Math.max(0.25, (5.5 - def.speed) / 3));
    e.speed = Math.min(def.speed * r.diff.speed * (1 + spBoost) * (1 + (curse - 1) * 0.25) * (0.92 + Math.random() * 0.16), r.waves.mode === 'endless' ? 7 : 6.2);
    e.xp = def.xp;
    if (def.behavior === 'prop') e.speed = 0;
    if (opts.elite) this.makeElite(e, opts.elite);
    e.yaw = Math.atan2(r.player.x - x, r.player.z - z);
    this.aliveCount++;
    r.stats.seen.add(def.id);
    return e;
  }

  spawnById(id: string, x: number, z: number, opts?: Parameters<EnemyManager['spawn']>[3]) {
    const def = ENEMY_BY_ID[id];
    return def ? this.spawn(def, x, z, opts) : null;
  }

  makeElite(e: Enemy, id: EliteId) {
    const m = ELITE_MODS[id];
    if (!e.elite) {
      e.elite = id;
      e.scale *= 1.45;
      e.radius *= 1.35;
      e.kbResist = Math.min(1, e.kbResist + 0.5);
      e.xp *= 8;
    } else e.elite2 = id;
    e.maxHp *= m.hp * 4 * (1 + BALANCE.eliteHpPerWave * (this.run.waves.wave.n - 1));
    e.hp = e.maxHp;
    e.speed *= m.speed;
    e.damage *= m.damage;
    if (id === 'armored') e.kbResist = 1;
  }

  release(e: Enemy) {
    if (!e.active) return;
    e.active = false;
    e.boss = null;
    this.free.push(e.index);
    if (e.dying === 0) this.aliveCount--;
  }

  /** Marks as dying (plays death anim), removing it from gameplay immediately. */
  startDying(e: Enemy) {
    if (e.dying > 0) return;
    e.dying = 0.28;
    this.aliveCount--;
  }

  // ------------------------------------------------------------------ queries
  forEachInRadius(x: number, z: number, r: number, fn: (e: Enemy) => void | boolean, includeProps = true) {
    const list = this.list;
    this.grid.query(x, z, r + 1.5, (i) => {
      const e = list[i];
      if (!e.alive || (!includeProps && e.def.behavior === 'prop' && !e.boss)) return false;
      const dx = e.x - x;
      const dz = e.z - z;
      const rr = r + e.radius;
      if (dx * dx + dz * dz <= rr * rr) return fn(e) === true;
      return false;
    });
  }

  nearest(x: number, z: number, maxR = 30, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    // expanding search keeps it cheap in dense crowds
    for (let r = 4; r <= maxR + 4; r *= 2) {
      this.grid.query(x, z, Math.min(r, maxR), (i) => {
        const e = this.list[i];
        if (!e.alive || this.isProp(e)) return;
        if (exclude && exclude.has(e.uid)) return;
        const d = (e.x - x) ** 2 + (e.z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      });
      if (best) return best;
      if (r >= maxR) break;
    }
    return best;
  }

  isProp(e: Enemy): boolean {
    return e.def.behavior === 'prop' && !e.boss && e.def.id !== 'shield_crystal';
  }

  /** Random targetable enemy within radius of point (used for strikes/random targeting). */
  randomInRadius(x: number, z: number, r: number): Enemy | null {
    let count = 0;
    let pick: Enemy | null = null;
    const rng = this.run.rng;
    this.forEachInRadius(x, z, r, (e) => {
      if (this.isProp(e)) return;
      count++;
      if (rng.next() * count < 1) pick = e;
    });
    return pick;
  }

  /** Approximate densest spot among a few samples near the player. */
  cluster(x: number, z: number, r: number): { x: number; z: number } | null {
    let best: Enemy | null = null;
    let bestN = 0;
    for (let k = 0; k < 6; k++) {
      const e = this.randomInRadius(x, z, r);
      if (!e) break;
      let n = 0;
      this.forEachInRadius(e.x, e.z, 2.5, () => {
        n++;
      });
      if (n > bestN) {
        bestN = n;
        best = e;
      }
    }
    const b = best as Enemy | null;
    return b ? { x: b.x, z: b.z } : null;
  }

  strongest(x: number, z: number, r: number): Enemy | null {
    let best: Enemy | null = null;
    this.forEachInRadius(x, z, r, (e) => {
      if (this.isProp(e)) return;
      if (!best || e.hp > best.hp) best = e;
    });
    return best;
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const run = this.run;
    const list = this.list;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (e.active) {
        this.xs[i] = e.x;
        this.zs[i] = e.z;
      }
    }
    this.grid.rebuild(n, this.xs, this.zs, (i) => list[i].alive);
    if (this.frozenAll > 0) this.frozenAll -= dt;
    if (this.run.debug.freeze) this.frozenAll = Math.max(this.frozenAll, 0.05);

    const p = run.player;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          e.dying = 0.0001; // keep counted as dying until released
          this.releaseDead(e);
        }
        continue;
      }
      this.updateStatus(e, dt);
      if (!e.active || e.dying > 0) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.touchCd > 0) e.touchCd -= dt;

      const frozen = e.freezeT > 0 || this.frozenAll > 0;
      if (e.boss) {
        if (!frozen) e.boss.update(dt);
      } else if (!frozen) this.think(e, dt);
      else {
        e.vx = 0;
        e.vz = 0;
      }

      // integrate with knockback
      let mx = (e.vx + e.kx) * dt;
      let mz = (e.vz + e.kz) * dt;
      const kd = Math.exp(-8 * dt);
      e.kx *= kd;
      e.kz *= kd;

      // separation from neighbours
      if (!e.boss && e.def.behavior !== 'prop') {
        let checks = 0;
        const sep = BALANCE.separationStrength * dt;
        this.grid.query(e.x, e.z, e.radius * 2, (j) => {
          if (j === i) return false;
          const o = list[j];
          const dx = e.x - o.x;
          const dz = e.z - o.z;
          const rr = e.radius + o.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const push = ((rr - d) / rr) * sep * (o.boss ? 2 : 1);
            mx += (dx / d) * push;
            mz += (dz / d) * push;
          }
          return ++checks > 8;
        });
      }
      this.moveWithTerrain(e, mx, mz);

      const dxp = p.x - e.x;
      const dzp = p.z - e.z;
      const d2 = dxp * dxp + dzp * dzp;
      // contact damage
      if (e.damage > 0 && !frozen && e.touchCd <= 0) {
        const rr = e.radius + p.radius;
        if (d2 < rr * rr) {
          e.touchCd = BALANCE.contactInterval;
          const dealt = p.hurt(e.damage, e);
          if (dealt > 0 && e.hasElite('vampiric')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
        }
      }
      // keep far enemies near the action instead of leaving them behind
      if (!e.boss && !e.elite && e.def.behavior !== 'prop' && d2 > BALANCE.despawnRadius * BALANCE.despawnRadius) {
        if (e.def.id === 'treasure_sprite') {
          this.release(e);
          continue;
        }
        run.spawner.relocate(e);
      } else if (e.def.category === 'prop' && d2 > 2500) {
        this.release(e);
        continue;
      }
      if (e.ttl > 0) {
        e.ttl -= dt;
        if (e.ttl <= 0) {
          run.fx.burst(e.x, 0.8, e.z, 0xfff0a0, 20, 4, 0.18, 0.6, 'glow');
          this.release(e);
          continue;
        }
      }
      const sp = Math.hypot(e.vx, e.vz);
      if (sp > 0.05) {
        e.anim += dt * (2 + sp * 1.6);
        e.yaw = Math.atan2(e.vx, e.vz);
      } else e.anim += dt;
    }
  }

  private releaseDead(e: Enemy) {
    e.active = false;
    e.boss = null;
    this.free.push(e.index);
  }

  private updateStatus(e: Enemy, dt: number) {
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowMul = 1;
    }
    if (e.freezeT > 0) e.freezeT -= dt;
    if (e.shieldT > 0) e.shieldT -= dt;
    if (e.poisonT > 0 || e.burnT > 0) {
      e.dotTick -= dt;
      if (e.dotTick <= 0) {
        e.dotTick = 0.5;
        let dmg = 0;
        if (e.poisonT > 0) {
          dmg += e.poisonDps * 0.5;
          e.poisonT -= 0.5;
        }
        if (e.burnT > 0) {
          dmg += e.burnDps * 0.5;
          e.burnT -= 0.5;
        }
        if (dmg > 0) this.run.combat.applyRaw(e, dmg, e.poisonT > 0 ? 0x9cff4f : 0xff8a3a, 'dot');
      }
    }
    // warded elites pulse a protective shield
    if (e.hasElite('warded')) {
      e.aux += dt;
      if (e.aux > 6) {
        e.aux = 0;
        e.shieldT = 2;
      }
    }
  }

  /** Per-behaviour AI producing desired velocity e.vx/e.vz. */
  private think(e: Enemy, dt: number) {
    const run = this.run;
    const p = run.player;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    let ux = dx / dist;
    let uz = dz / dist;
    // walkers follow the flow field when not close
    if (!e.flying && dist > 2.5) {
      const cx = Math.floor(e.x);
      const cz = Math.floor(e.z);
      if (run.nav.has(cx, cz)) {
        const i = cz * run.terrain.size + cx;
        const fx = run.nav.dirX[i];
        const fz = run.nav.dirZ[i];
        if (fx || fz) {
          ux = fx;
          uz = fz;
        }
      }
    }
    let speed = e.speed * e.slowMul;
    if (!e.flying && !e.boss) speed *= run.features.moveMul(e.x, e.z, false);
    if (e.hasElite('frenzied') && e.hp < e.maxHp * 0.5) speed *= 1.5;
    const pp = e.def.p ?? {};
    switch (e.def.behavior) {
      case 'prop':
        e.vx = e.vz = 0;
        return;
      case 'flyer': {
        e.aux += dt;
        const w = Math.sin(e.aux * 3 + e.index) * 0.6;
        e.vx = (ux - uz * w) * speed;
        e.vz = (uz + ux * w) * speed;
        e.y = 0.6 + Math.sin(e.aux * 5) * 0.15;
        return;
      }
      case 'ranged': {
        const range = (pp.range as number) ?? 7;
        let m = 1;
        if (dist < range * 0.6) m = -0.7;
        else if (dist < range) m = 0.15;
        e.vx = ux * speed * m;
        e.vz = uz * speed * m;
        if (m !== 1) {
          // strafe
          const s = e.index % 2 ? 1 : -1;
          e.vx += -uz * speed * 0.4 * s;
          e.vz += ux * speed * 0.4 * s;
        }
        e.cd -= dt;
        if (e.cd <= 0 && dist < range + 3) {
          e.cd = ((pp.fireCd as number) ?? 2.5) * (0.85 + Math.random() * 0.3);
          const count = (pp.bullets as number) ?? 1;
          const spread = (((pp.spread as number) ?? 20) * Math.PI) / 180;
          const base = Math.atan2(dz, dx);
          for (let k = 0; k < count; k++) {
            const a = count === 1 ? base : base - spread / 2 + (spread * k) / (count - 1);
            run.hazards.bullet(e.x, e.z, Math.cos(a) * ((pp.bulletSpeed as number) ?? 7), Math.sin(a) * ((pp.bulletSpeed as number) ?? 7), e.damage * 0.65, 0.28, 4, pp.slow ? 0x8ae8ff : 0xff3a6a, !!pp.slow);
          }
          e.flash = 0.05;
        }
        return;
      }
      case 'summoner': {
        const range = (pp.range as number) ?? 8;
        const m = dist < range * 0.7 ? -0.5 : dist < range ? 0 : 1;
        e.vx = ux * speed * m;
        e.vz = uz * speed * m;
        e.cd -= dt;
        if (e.cd <= 0 && dist < range + 6) {
          e.cd = (pp.cd as number) ?? 6;
          const count = (pp.count as number) ?? 3;
          for (let k = 0; k < count; k++) {
            const a = (k / count) * TAU;
            const sx = e.x + Math.cos(a) * 1.2;
            const sz = e.z + Math.sin(a) * 1.2;
            if (run.terrain.walkableAt(sx, sz) && this.aliveCount < BALANCE.hardCap) {
              const m2 = this.spawnById(pp.summon as string, sx, sz);
              if (m2) m2.xp = 0;
            }
          }
          run.fx.burst(e.x, 1, e.z, 0xb070ff, 14, 3, 0.16, 0.6, 'glow');
        }
        return;
      }
      case 'exploder': {
        if (e.state === 0) {
          e.vx = ux * speed;
          e.vz = uz * speed;
          if (dist < ((pp.trigger as number) ?? 1.6)) {
            e.state = 1;
            e.stateT = (pp.fuse as number) ?? 0.8;
            run.hazards.telegraph(e.x, e.z, (pp.blast as number) ?? 2, e.stateT);
          }
        } else {
          e.vx = e.vz = 0;
          e.stateT -= dt;
          e.flash = Math.sin(e.stateT * 40) > 0 ? 0.1 : 0;
          if (e.stateT <= 0) {
            run.hazards.explode(e.x, e.z, (pp.blast as number) ?? 2, e.damage, 0xff7a2a);
            run.combat.killEnemy(e, true);
          }
        }
        return;
      }
      case 'charger': {
        if (e.state === 0) {
          e.vx = ux * speed;
          e.vz = uz * speed;
          e.cd -= dt;
          if (e.cd <= 0 && dist < ((pp.trigger as number) ?? 8)) {
            e.state = 1;
            e.stateT = (pp.windup as number) ?? 0.6;
            e.dirX = dx / dist;
            e.dirZ = dz / dist;
            run.hazards.lineTelegraph(e.x, e.z, e.dirX, e.dirZ, 9, e.radius * 2, e.stateT);
          }
        } else if (e.state === 1) {
          e.vx = e.vz = 0;
          e.stateT -= dt;
          e.flash = 0.03;
          if (e.stateT <= 0) {
            e.state = 2;
            e.stateT = 0.75;
          }
        } else {
          const cs = (pp.chargeSpeed as number) ?? 12;
          e.vx = e.dirX * cs;
          e.vz = e.dirZ * cs;
          e.stateT -= dt;
          if (e.stateT <= 0) {
            e.state = 0;
            e.cd = (pp.chargeCd as number) ?? 4;
          }
        }
        return;
      }
      case 'teleporter': {
        e.vx = ux * speed;
        e.vz = uz * speed;
        e.cd -= dt;
        e.y = 0.3 + Math.sin(e.anim * 2) * 0.15;
        if (e.cd <= 0 && dist > 5) {
          e.cd = (pp.tpCd as number) ?? 4;
          const a = Math.random() * TAU;
          const r = (pp.tpDist as number) ?? 3.5;
          const tx = p.x + Math.cos(a) * r;
          const tz = p.z + Math.sin(a) * r;
          if (!run.terrain.blocksFlyer(Math.floor(tx), Math.floor(tz))) {
            run.fx.burst(e.x, 0.8, e.z, 0x9a7aff, 12, 3, 0.15, 0.5, 'glow');
            e.x = tx;
            e.z = tz;
            run.fx.burst(e.x, 0.8, e.z, 0x9a7aff, 12, 3, 0.15, 0.5, 'glow');
          }
        }
        return;
      }
      case 'orbiter': {
        const orbit = (pp.orbit as number) ?? 6;
        e.cd -= dt;
        if (e.state === 0) {
          const tang = e.index % 2 ? 1 : -1;
          const radial = (dist - orbit) * 0.8;
          e.vx = (ux * radial - uz * tang * 1.2) * speed * 0.6;
          e.vz = (uz * radial + ux * tang * 1.2) * speed * 0.6;
          if (e.cd <= 0) {
            e.state = 1;
            e.stateT = 0.9;
            e.dirX = ux;
            e.dirZ = uz;
          }
        } else {
          e.vx = e.dirX * speed * 3;
          e.vz = e.dirZ * speed * 3;
          e.stateT -= dt;
          if (e.stateT <= 0) {
            e.state = 0;
            e.cd = (pp.diveCd as number) ?? 4;
          }
        }
        e.y = 0.7;
        return;
      }
      default: {
        // chase / splitter / treasure sprite
        if (pp.flee) {
          e.vx = -ux * speed;
          e.vz = -uz * speed;
          return;
        }
        e.vx = ux * speed;
        e.vz = uz * speed;
      }
    }
  }

  private moveWithTerrain(e: Enemy, mx: number, mz: number) {
    const t = this.run.terrain;
    const fly = e.flying || (e.boss != null && e.boss.def.flying);
    const nx = e.x + mx;
    const nz = e.z + mz;
    const blocked = fly ? (cx: number, cz: number) => t.blocksFlyer(cx, cz) : (cx: number, cz: number) => t.blocksWalker(cx, cz);
    const r = Math.min(e.radius, 0.45);
    // axis-separated resolution against blocked cells
    const sx = mx > 0 ? r : -r;
    if (!blocked(Math.floor(nx + sx), Math.floor(e.z))) e.x = nx;
    else e.kx = 0;
    const sz = mz > 0 ? r : -r;
    if (!blocked(Math.floor(e.x), Math.floor(nz + sz))) e.z = nz;
    else e.kz = 0;
    // unstick if inside geometry (spawned or pushed in)
    if (blocked(Math.floor(e.x), Math.floor(e.z)) && !fly) {
      const p = this.run.player;
      const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
      e.x += ((p.x - e.x) / d) * 0.1;
      e.z += ((p.z - e.z) / d) * 0.1;
    }
  }

  clear() {
    for (const e of this.list) if (e.active) this.release(e);
    this.aliveCount = 0;
  }
}
