import { BALANCE } from '../config/balance';
import { clamp } from '../core/math';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { CELL } from './Terrain';
import type { PlayerStats } from './Stats';

export interface Buffs {
  fury: number;
  haste: number;
  aegis: number;
  frenzy: number;
}

/** The hero during a run: movement, health, experience and temporary buffs. */
export class Player {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  fx = 0;
  fz = 1;
  radius = 0.38;
  hp = 100;
  stats!: PlayerStats;
  level = 1;
  xp = 0;
  xpNext = BALANCE.xpForLevel(1);
  pendingLevels = 0;
  invulnT = 0;
  hurtT = 0;
  dead = false;
  revivals = 0;
  /** Extra damage multiplier from buffs and perks. */
  damageMul = 1;
  moving = false;
  anim = 0;
  attackPulse = 0;
  buffs: Buffs = { fury: 0, haste: 0, aegis: 0, frenzy: 0 };
  /** Bastion perk shield. */
  shield = false;
  slowT = 0;
  pullX = 0;
  pullZ = 0;
  hazardTick = 0;
  /** Extra speed burst (wind way perk). */
  burstT = 0;
  regenAcc = 0;

  constructor(private run: Run, x: number, z: number) {
    this.x = x;
    this.z = z;
  }

  get moveSpeed(): number {
    let s = this.run.hero.baseSpeed * this.stats.moveSpeed;
    if (this.buffs.haste > 0) s *= 1.4;
    if (this.burstT > 0) s *= 1.35;
    if (this.slowT > 0) s *= 0.6;
    if (this.run.weather.blizzard > 0) s *= 0.85;
    s *= this.run.features.moveMul(this.x, this.z, true);
    return s;
  }

  update(dt: number, ix: number, iz: number) {
    const run = this.run;
    const t = run.terrain;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.burstT > 0) this.burstT -= dt;
    if (this.attackPulse > 0) this.attackPulse -= dt;
    for (const k in this.buffs) {
      const key = k as keyof Buffs;
      if (this.buffs[key] > 0) this.buffs[key] -= dt;
    }
    this.damageMul = (this.buffs.fury > 0 ? 1.5 : 1) * run.perks.damageMul();

    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    this.moving = len > 0.08;
    if (this.moving) {
      const l = Math.hypot(ix, iz);
      this.fx = ix / l;
      this.fz = iz / l;
    }
    const speed = this.moveSpeed;
    const onIce = t.cellAt(this.x, this.z) === CELL.ice;
    const tx = ix * speed;
    const tz = iz * speed;
    const accel = onIce ? 2.2 : 30;
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    let mx = (this.vx + this.pullX) * dt;
    let mz = (this.vz + this.pullZ) * dt;
    this.pullX *= Math.exp(-3 * dt);
    this.pullZ *= Math.exp(-3 * dt);
    this.moveWithTerrain(mx, mz);
    if (this.moving || Math.hypot(this.vx, this.vz) > 0.3) this.anim += dt * speed * 2.2;
    else this.anim += dt;

    // hazard tiles
    const cell = t.cellAt(this.x, this.z);
    if (cell === CELL.hazard) {
      this.hazardTick -= dt;
      if (this.hazardTick <= 0) {
        this.hazardTick = 0.5;
        this.hurt((run.map.hazardDps ?? 8) * 0.5 * run.diff.damage, null, true);
      }
    }
    // regeneration
    const regen = this.stats.regen * (run.diff.id === 'inferno' ? 0.5 : 1);
    if (regen > 0 && this.hp < this.stats.maxHp) {
      this.regenAcc += regen * dt;
      if (this.regenAcc >= 1) {
        this.heal(Math.floor(this.regenAcc), true);
        this.regenAcc -= Math.floor(this.regenAcc);
      }
    }
  }

  private moveWithTerrain(mx: number, mz: number) {
    const t = this.run.terrain;
    const r = this.radius;
    const nx = this.x + mx;
    const cx0 = Math.floor(this.z - r * 0.8);
    const cx1 = Math.floor(this.z + r * 0.8);
    const edgeX = Math.floor(nx + (mx > 0 ? r : -r));
    if (!t.blocksWalker(edgeX, cx0) && !t.blocksWalker(edgeX, cx1)) this.x = nx;
    else this.vx = 0;
    const nz = this.z + mz;
    const r0 = Math.floor(this.x - r * 0.8);
    const r1 = Math.floor(this.x + r * 0.8);
    const edgeZ = Math.floor(nz + (mz > 0 ? r : -r));
    if (!t.blocksWalker(r0, edgeZ) && !t.blocksWalker(r1, edgeZ)) this.z = nz;
    else this.vz = 0;
    this.x = clamp(this.x, 1, t.size - 1);
    this.z = clamp(this.z, 1, t.size - 1);
  }

  /** Applies incoming damage. Returns damage actually taken. */
  hurt(raw: number, source: Enemy | null, ignoreInvuln = false): number {
    const run = this.run;
    if (this.dead || run.debug.god) return 0;
    if (!ignoreInvuln && this.invulnT > 0) return 0;
    if (this.buffs.aegis > 0) return 0;
    if (this.stats.dodge > 0 && Math.random() < this.stats.dodge) {
      run.fx.text(this.x, this.z, run.tr('dodge'), 0xc1e8ff);
      run.perks.onDodge();
      return 0;
    }
    if (this.shield) {
      this.shield = false;
      run.perks.onShieldBreak();
      run.fx.burst(this.x, 1, this.z, 0x8ad0ff, 18, 4, 0.16, 0.5, 'glow');
      run.fx.sound('shield');
      this.invulnT = 0.4;
      return 0;
    }
    const dmg = Math.max(BALANCE.armorMin, raw - this.stats.armor);
    this.hp -= dmg;
    this.hurtT = 0.25;
    if (!ignoreInvuln) this.invulnT = BALANCE.hurtInvuln;
    run.stats.damageTaken += dmg;
    run.fx.number(this.x, this.z, dmg, false, 0xff4040);
    run.fx.sound('hurt');
    run.fx.vibrate(25);
    run.fx.shake(0.15);
    if (source && this.stats.thorns > 0) run.combat.applyRaw(source, raw * this.stats.thorns * this.stats.might, 0xb0e070, 'thorns');
    if (this.hp <= 0) this.onLethal();
    return dmg;
  }

  private onLethal() {
    const run = this.run;
    if (this.revivals > 0) {
      this.revivals--;
      this.hp = this.stats.maxHp * 0.5;
      this.invulnT = 3;
      run.fx.burst(this.x, 1, this.z, 0xffa040, 60, 7, 0.22, 1.2, 'glow');
      run.fx.light(this.x, this.z, 0xffa040, 5, 10, 1);
      run.fx.sound('revive');
      run.fx.text(this.x, this.z, run.tr('revived'), 0xffc060);
      // clear nearby threats
      run.hazards.clearNear(this.x, this.z, 8);
      run.enemies.forEachInRadius(this.x, this.z, 6, (e) => {
        run.reviveBlast.damage = 40 * run.waveScale.hp * run.diff.hp * run.map.tier;
        if (!e.boss) run.combat.hit(e, run.reviveBlast, 1);
      });
      return;
    }
    this.hp = 0;
    this.dead = true;
    run.onPlayerDeath();
  }

  heal(amount: number, quiet = false) {
    if (this.dead) return;
    const mul = this.run.diff.id === 'inferno' ? 0.5 : 1;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount * mul);
    const healed = this.hp - before;
    if (!quiet && healed > 0.5) this.run.fx.number(this.x, this.z, healed, false, 0x6bff8a);
  }

  addXp(v: number) {
    this.xp += v * this.stats.growth;
    this.run.stats.xpGained += v * this.stats.growth;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pendingLevels++;
      this.xpNext = BALANCE.xpForLevel(this.level);
    }
  }
}
