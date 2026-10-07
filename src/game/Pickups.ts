import { BALANCE } from '../config/balance';
import { TAU } from '../core/math';
import type { Enemy } from './Enemy';
import type { ChestSource, Run } from './Run';

export type PickupKind = 'xp' | 'gold' | 'heart' | 'magnet' | 'chest' | 'fury' | 'haste' | 'aegis' | 'frenzy' | 'chrono' | 'nuke' | 'star' | 'pouch';

export class Pickup {
  active = false;
  kind: PickupKind = 'xp';
  x = 0;
  z = 0;
  y = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  value = 0;
  attracted = false;
  age = 0;
  /** Chest tier: 0 normal, 1 boss. */
  tier = 0;
  /** Chest rarity index (0 common .. 4 legendary). */
  rarity = 0;
}

export const POWERUPS: PickupKind[] = ['fury', 'haste', 'aegis', 'frenzy', 'chrono', 'nuke'];

/** Experience gems, gold, healing, chests and power-ups lying on the ground. */
export class Pickups {
  readonly list: Pickup[] = [];
  private free: Pickup[] = [];
  gemCount = 0;
  private overflow: Pickup | null = null;

  constructor(private run: Run) {
    for (let i = 0; i < 800; i++) this.free.push(new Pickup());
  }

  spawn(kind: PickupKind, x: number, z: number, value = 0, pop = false): Pickup {
    const p = this.free.pop() ?? new Pickup();
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.z = z;
    p.y = 0;
    p.value = value;
    p.attracted = false;
    p.age = 0;
    p.tier = 0;
    p.rarity = 0;
    p.vx = p.vz = p.vy = 0;
    if (pop) {
      const a = Math.random() * TAU;
      const s = 1.5 + Math.random() * 2;
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = 4;
    }
    this.list.push(p);
    if (kind === 'xp') this.gemCount++;
    return p;
  }

  dropXp(x: number, z: number, value: number) {
    if (this.gemCount >= BALANCE.maxGems) {
      if (!this.overflow || !this.overflow.active) this.overflow = this.spawn('xp', x, z, 0);
      this.overflow.value += value;
      return;
    }
    this.spawn('xp', x + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3, value);
  }

  rollKillDrops(e: Enemy) {
    const luck = this.run.player.stats.luck;
    const r = Math.random();
    if (r < BALANCE.goldDropChance * luck) this.spawn('gold', e.x, e.z, e.elite ? 2 : 1, true);
    else if (r < (BALANCE.goldDropChance + BALANCE.heartDropChance) * luck) this.spawn('heart', e.x, e.z, 0, true);
    else if (Math.random() < BALANCE.magnetDropChance * luck) this.spawn('magnet', e.x, e.z, 0, true);
    else if (Math.random() < BALANCE.powerupDropChance * luck) this.spawn(this.run.rng.pick(POWERUPS), e.x, e.z, 0, true);
  }

  dropFromProp(x: number, z: number) {
    const rng = this.run.rng;
    const luck = this.run.player.stats.luck;
    const roll = rng.next();
    if (roll < 0.3) this.spawn('heart', x, z, 0, true);
    else if (roll < 0.55) this.spawn('gold', x, z, 1 + rng.int(0, 1), true);
    else if (roll < 0.66) this.spawn('magnet', x, z, 0, true);
    else if (roll < 0.66 + 0.25 * luck) this.spawn(rng.pick(POWERUPS), x, z, 0, true);
    else if (roll < 0.97) this.spawn('pouch', x, z, 3 + rng.int(0, 3), true);
    else this.spawn('star', x, z, 0, true);
  }

  spawnChest(x: number, z: number, tier = 0, source: ChestSource = tier ? 'boss' : 'elite', pop = true): Pickup {
    const c = this.spawn('chest', x, z, 0, pop);
    c.tier = tier;
    c.rarity = this.run.rollChestRarity(source);
    this.run.fx.sound('chestDrop');
    return c;
  }

  treasureBurst(x: number, z: number) {
    for (let i = 0; i < 6; i++) this.spawn('gold', x, z, 1, true);
    if (this.run.rng.chance(0.3)) this.spawnChest(x, z, 0, 'treasure');
  }

  collectAllXp() {
    for (const p of this.list) if (p.active && (p.kind === 'xp' || p.kind === 'gold')) p.attracted = true;
  }

  update(dt: number) {
    const run = this.run;
    const pl = run.player;
    const magnet = pl.stats.magnet;
    const m2 = magnet * magnet;
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.active) {
        this.free.push(p);
        continue;
      }
      p.age += dt;
      if (p.vy !== 0 || p.y > 0) {
        p.vy -= 20 * dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
          p.vx = p.vz = 0;
        }
      }
      const dx = pl.x - p.x;
      const dz = pl.z - p.z;
      const d2 = dx * dx + dz * dz;
      const grab = p.kind === 'chest' ? 0.9 : 0.6;
      if (!p.attracted && d2 < m2 && p.kind !== 'chest' && p.age > 0.25) p.attracted = true;
      if (p.attracted) {
        const d = Math.sqrt(d2) || 0.001;
        const sp = BALANCE.gemPullSpeed + p.age * 2;
        // slight overshoot-free homing
        p.x += (dx / d) * Math.min(d, sp * dt);
        p.z += (dz / d) * Math.min(d, sp * dt);
      }
      if (d2 < grab * grab) {
        this.collect(p);
        p.active = false;
        this.free.push(p);
        continue;
      }
      list[w++] = p;
    }
    list.length = w;
  }

  private collect(p: Pickup) {
    const run = this.run;
    const pl = run.player;
    switch (p.kind) {
      case 'xp':
        this.gemCount--;
        if (p === this.overflow) this.overflow = null;
        pl.addXp(p.value);
        run.xpSoundBudget++;
        break;
      case 'gold':
        run.stats.gold += p.value * pl.stats.greed;
        run.fx.sound('coin', 0.5);
        break;
      case 'pouch':
        run.stats.gold += p.value * pl.stats.greed;
        run.fx.text(pl.x, pl.z, `+${Math.round(p.value * pl.stats.greed)}`, 0xffd23d);
        run.fx.sound('coin');
        break;
      case 'heart':
        pl.heal((10 + pl.stats.maxHp * 0.2) * run.perks.healMul());
        run.fx.sound('heal');
        run.fx.burst(pl.x, 1, pl.z, 0x6bff8a, 12, 2.5, 0.14, 0.6, 'glow');
        break;
      case 'magnet':
        this.collectAllXp();
        run.fx.sound('magnet');
        break;
      case 'chest':
        run.openChest(p.tier, p.rarity);
        break;
      case 'fury':
        pl.buffs.fury = 12;
        this.powerFx(0xff5050, 'pu_fury');
        break;
      case 'haste':
        pl.buffs.haste = 12;
        this.powerFx(0x5affd0, 'pu_haste');
        break;
      case 'aegis':
        pl.buffs.aegis = 7;
        this.powerFx(0xffe08a, 'pu_aegis');
        break;
      case 'frenzy':
        pl.buffs.frenzy = 12;
        this.powerFx(0xff9a3a, 'pu_frenzy');
        break;
      case 'chrono':
        run.enemies.frozenAll = 6;
        this.powerFx(0x8ad8ff, 'pu_chrono');
        break;
      case 'nuke':
        this.powerFx(0xffffff, 'pu_nuke');
        run.fx.light(pl.x, pl.z, 0xffffff, 6, 30, 0.5);
        run.fx.shake(0.6);
        run.nukeBlast.damage = 60 * run.waveScale.hp * run.diff.hp * run.map.tier;
        run.enemies.forEachInRadius(pl.x, pl.z, 20, (e) => {
          if (!e.boss) run.combat.hit(e, run.nukeBlast, 1);
        });
        break;
      case 'star':
        pl.addXp((pl.xpNext - pl.xp) / pl.stats.growth + 0.01);
        this.powerFx(0xfff07a, 'pu_star');
        break;
    }
    run.events.emit('pickup', p.kind);
  }

  private powerFx(color: number, key: string) {
    const run = this.run;
    const pl = run.player;
    run.fx.burst(pl.x, 1, pl.z, color, 30, 5, 0.18, 0.8, 'glow');
    run.fx.text(pl.x, pl.z, run.tr(key), color);
    run.fx.sound('powerup');
  }

  clear() {
    for (const p of this.list) p.active = false;
    this.list.length = 0;
    this.gemCount = 0;
  }
}
