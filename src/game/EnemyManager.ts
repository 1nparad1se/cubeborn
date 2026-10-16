import { SpatialGrid } from '../core/SpatialGrid';
import type { EnemyDef } from '../data/types';
import { Enemy } from './Enemy';
import type { Run } from './Run';

const GRID_CELL = 2;

/**
 * Owns the combat targets: pooling, statuses, knockback physics and spatial queries.
 * The world has no creatures yet; this is the layer future monsters plug into.
 */
export class EnemyManager {
  readonly list: Enemy[] = [];
  private free: number[] = [];
  readonly grid: SpatialGrid;
  private xs: Float32Array;
  private zs: Float32Array;
  aliveCount = 0;
  private uidCounter = 1;

  constructor(private run: Run, capacity = 64) {
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

  /** Places a target of a definition at a point (health from the definition). */
  spawn(def: EnemyDef, x: number, z: number, opts: { level?: number; hpMul?: number } = {}): Enemy | null {
    if (this.free.length === 0) {
      if (this.list.length >= 4096) return null;
      this.grow();
    }
    const e = this.list[this.free.pop()!];
    e.reset(def);
    e.uid = this.uidCounter++;
    e.x = x;
    e.z = z;
    e.level = opts.level ?? 1;
    e.maxHp = e.hp = Math.max(1, def.hp * (opts.hpMul ?? 1));
    e.damage = def.damage;
    e.speed = def.speed;
    e.xp = def.xp;
    e.yaw = Math.atan2(this.run.player.x - x, this.run.player.z - z);
    this.aliveCount++;
    return e;
  }

  release(e: Enemy) {
    if (!e.active) return;
    e.active = false;
    this.free.push(e.index);
    if (e.dying === 0) this.aliveCount--;
  }

  /** Marks as dying (plays the death animation), removing it from gameplay immediately. */
  startDying(e: Enemy) {
    if (e.dying > 0) return;
    e.dying = 0.28;
    this.aliveCount--;
  }

  // ------------------------------------------------------------------ queries
  forEachInRadius(x: number, z: number, r: number, fn: (e: Enemy) => void | boolean) {
    const list = this.list;
    this.grid.query(x, z, r + 1.5, (i) => {
      const e = list[i];
      if (!e.alive) return false;
      const dx = e.x - x;
      const dz = e.z - z;
      const rr = r + e.radius;
      if (dx * dx + dz * dz <= rr * rr) return fn(e) === true;
      return false;
    });
  }

  /** Nearest target. `los`: only targets with a clear shot from (x,z) (see Terrain.los). */
  nearest(x: number, z: number, maxR = 30, exclude?: Set<number>, los = false): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    const t = this.run.terrain;
    // expanding search keeps it cheap in dense crowds
    for (let r = 4; r <= maxR + 4; r *= 2) {
      this.grid.query(x, z, Math.min(r, maxR), (i) => {
        const e = this.list[i];
        if (!e.alive) return;
        if (exclude && exclude.has(e.uid)) return;
        const d = (e.x - x) ** 2 + (e.z - z) ** 2;
        if (d < bd && (!los || t.los(x, z, e.x, e.z))) {
          bd = d;
          best = e;
        }
      });
      if (best) return best;
      if (r >= maxR) break;
    }
    return best;
  }

  /** Random target within radius of a point. */
  randomInRadius(x: number, z: number, r: number, los = false): Enemy | null {
    let count = 0;
    let pick: Enemy | null = null;
    const rng = this.run.rng;
    const t = this.run.terrain;
    this.forEachInRadius(x, z, r, (e) => {
      if (los && !t.los(x, z, e.x, e.z)) return;
      count++;
      if (rng.next() * count < 1) pick = e;
    });
    return pick;
  }

  /** Approximate densest spot among a few samples. */
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

  strongest(x: number, z: number, r: number, los = false): Enemy | null {
    let best: Enemy | null = null;
    const t = this.run.terrain;
    this.forEachInRadius(x, z, r, (e) => {
      if (best && e.hp <= best.hp) return;
      if (los && !t.los(x, z, e.x, e.z)) return;
      best = e;
    });
    return best;
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    if (this.aliveCount === 0 && !this.list.some((e) => e.active)) return;
    const list = this.list;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (e.active) {
        this.xs[i] = e.x;
        this.zs[i] = e.z;
      }
    }
    this.grid.ox = this.run.terrain.ox;
    this.grid.oz = this.run.terrain.oz;
    this.grid.rebuild(n, this.xs, this.zs, (i) => list[i].alive);
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          e.active = false;
          this.free.push(e.index);
        }
        continue;
      }
      this.updateStatus(e, dt);
      if (!e.active || e.dying > 0) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.freezeT > 0 || e.stunT > 0 || e.rootT > 0) e.vx = e.vz = 0;
      // knockback slides the target over the ground
      const mx = (e.vx + e.kx) * dt;
      const mz = (e.vz + e.kz) * dt;
      const kd = Math.exp(-8 * dt);
      e.kx *= kd;
      e.kz *= kd;
      this.moveWithTerrain(e, mx, mz);
      e.anim += dt;
    }
  }

  private updateStatus(e: Enemy, dt: number) {
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowMul = 1;
    }
    if (e.freezeT > 0) e.freezeT -= dt;
    if (e.stunT > 0) e.stunT -= dt;
    if (e.curseT > 0) e.curseT -= dt;
    if (e.weakenT > 0) e.weakenT -= dt;
    if (e.markT > 0) e.markT -= dt;
    if (e.shieldT > 0) e.shieldT -= dt;
    if (e.rootT > 0) e.rootT -= dt;
    if (e.launchT > 0) e.launchT -= dt;
    if (e.brokenT > 0) e.brokenT -= dt;
    else if (e.stag > 0) {
      // the stagger bar drains after a few seconds without stagger damage
      e.stagIdle += dt;
      if (e.stagIdle > 3) e.stag = Math.max(0, e.stag - e.stagMax * 0.12 * dt);
    }
    if (e.poisonT > 0 || e.burnT > 0 || e.bleedT > 0) {
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
        if (e.bleedT > 0) {
          dmg += e.bleedDps * 0.5;
          e.bleedT -= 0.5;
        }
        if (dmg > 0) this.run.combat.applyRaw(e, dmg, e.poisonT > 0 ? 0x9cff4f : e.burnT > 0 ? 0xff8a3a : 0xd0303a, 'dot');
      }
    }
  }

  private moveWithTerrain(e: Enemy, mx: number, mz: number) {
    if (!mx && !mz) return;
    const t = this.run.terrain;
    // ground creatures climb or drop one block at most: cliffs stop them both ways
    const ex = Math.floor(e.x);
    const ez = Math.floor(e.z);
    const blocked = e.flying
      ? (cx: number, cz: number) => t.blocksFlyer(cx, cz)
      : (cx: number, cz: number) => t.blocksWalker(cx, cz) || ((cx !== ex || cz !== ez) && !t.stepOk(ex, ez, cx, cz));
    const r = Math.min(e.radius, 0.45);
    const nx = e.x + mx;
    const nz = e.z + mz;
    // axis-separated resolution against blocked cells
    if (!blocked(Math.floor(nx + (mx > 0 ? r : -r)), Math.floor(e.z))) e.x = nx;
    else e.kx = 0;
    if (!blocked(Math.floor(e.x), Math.floor(nz + (mz > 0 ? r : -r)))) e.z = nz;
    else e.kz = 0;
  }

  clear() {
    for (const e of this.list) if (e.active) this.release(e);
    this.aliveCount = 0;
  }
}
