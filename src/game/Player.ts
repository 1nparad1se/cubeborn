import { BALANCE } from '../config/balance';
import { clamp } from '../core/math';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { CELL } from './Terrain';
import type { DamageInfo } from './types';
import { clearLine, findPath } from './arpg/Path';
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
  /** Animation cues for the renderer: each counter ticks when the event happens. */
  cues = { attack: 0, aim: false, aimX: 0, aimZ: 1, hit: 0, hitX: 0, hitZ: 0, ability: 0, jump: 0, land: 0 };
  /** Jump: height above ground, vertical speed, phase and time in phase. */
  jumpY = 0;
  jumpV = 0;
  jumpPhase: 'ground' | 'windup' | 'air' | 'land' = 'ground';
  jumpT = 0;
  private jumpBuf = 0;
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
  // ---------------------------------------------------------------- action-RPG movement
  /** Click-to-move waypoints [x0, z0, x1, z1, ...] and the next index. */
  path: number[] = [];
  pathI = 0;
  private repathT = 0;
  /** Current walking direction (unit or zero) — dodge goes this way. */
  moveDirX = 0;
  moveDirZ = 0;
  /** Dash / dodge in progress. */
  dashT = 0;
  private dashVX = 0;
  private dashVZ = 0;
  private dashR = 0;
  private dashInfo: DamageInfo | null = null;
  private dashColor = 0xffffff;
  private dashHit = new Set<number>();

  constructor(private run: Run, x: number, z: number) {
    this.x = x;
    this.z = z;
  }

  get airborne(): boolean {
    return this.jumpPhase === 'air' || this.jumpPhase === 'windup';
  }
  /** High enough for ground threats (hazard tiles, pools, shockwaves) to pass underneath. */
  get clearsGround(): boolean {
    return this.jumpY > BALANCE.jump.groundClear;
  }

  /** Queues a jump (buffered so a press just before landing still counts). */
  requestJump() {
    if (this.dead) return;
    this.jumpBuf = BALANCE.jump.buffer;
  }

  private updateJump(dt: number) {
    const J = BALANCE.jump;
    // the buffer only runs down in the air, so a press just before touching down survives the landing lag
    if (this.jumpBuf > 0 && this.jumpPhase !== 'land') this.jumpBuf -= dt;
    this.jumpT += dt;
    switch (this.jumpPhase) {
      case 'ground':
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.jumpPhase = 'windup';
          this.jumpT = 0;
          this.cues.jump++;
          this.run.stats.jumps++;
        }
        break;
      case 'windup':
        if (this.jumpT >= J.windup) {
          this.jumpPhase = 'air';
          this.jumpT = 0;
          // ballistic arc reaching `height` at airTime / 2
          this.jumpV = (4 * J.height) / J.airTime;
          this.run.fx.sound('jump', 0.5);
        }
        break;
      case 'air': {
        // exact parabola: apex `height` at airTime / 2
        const u = this.jumpT / J.airTime;
        if (u >= 1) this.land();
        else {
          this.jumpY = 4 * J.height * u * (1 - u);
          this.jumpV = ((4 * J.height) / J.airTime) * (1 - 2 * u);
        }
        break;
      }
      case 'land':
        if (this.jumpT >= J.landLag) this.jumpPhase = 'ground';
        break;
    }
  }

  private land() {
    const run = this.run;
    this.jumpY = 0;
    this.jumpV = 0;
    this.jumpPhase = 'land';
    this.jumpT = 0;
    this.cues.land++;
    // landing dust
    run.fx.burst(this.x, 0.15, this.z, 0xb8a888, 10, 2.6, 0.22, 0.5, 'smoke');
    run.fx.burst(this.x, 0.1, this.z, 0x8a7a64, 6, 2, 0.1, 0.35, 'debris');
    const ring = run.effects.add('ring', this.x, this.z, 0.3, 0xd8ccb0);
    ring.r = 1.1;
    ring.w = 0.25;
    run.fx.sound('land', 0.5);
  }

  /** Drops out of a jump at once (death, revive, teleport). */
  cancelJump() {
    this.jumpPhase = 'ground';
    this.jumpY = 0;
    this.jumpV = 0;
    this.jumpBuf = 0;
  }

  get moveSpeed(): number {
    let s = this.run.hero.baseSpeed * this.stats.moveSpeed * this.run.action.speedMul;
    if (this.buffs.haste > 0) s *= 1.4;
    if (this.burstT > 0) s *= 1.35;
    if (this.airborne) s *= BALANCE.jump.airSpeed;
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
    this.damageMul = this.buffs.fury > 0 ? 1.5 : 1;
    this.updateJump(dt);

    const act = run.action;
    if (act.mover) {
      // a skill is moving the hero (dash / leap)
      this.moving = true;
      this.anim += dt * 12;
      this.afterMove(dt);
      return;
    }
    if (this.dashT > 0) {
      this.updateDash(dt);
      this.moving = true;
      this.anim += dt * 12;
      this.afterMove(dt);
      return;
    }
    [ix, iz] = this.steer(dt, ix, iz);
    const mm = act.moveMul;
    ix *= mm;
    iz *= mm;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    this.moving = len > 0.08;
    this.moveDirX = this.moving ? ix / Math.max(len, 1e-6) : 0;
    this.moveDirZ = this.moving ? iz / Math.max(len, 1e-6) : 0;
    // facing is separate from the cursor: an action locks it to its attack direction,
    // otherwise the hero looks where it walks (the renderer turns smoothly toward it)
    const lock = act.facing;
    if (lock) {
      this.fx = lock[0];
      this.fz = lock[1];
    } else if (this.moving) {
      this.fx = this.moveDirX;
      this.fz = this.moveDirZ;
    }
    const speed = this.moveSpeed;
    const onIce = t.cellAt(this.x, this.z) === CELL.ice && !this.airborne;
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
    this.afterMove(dt);
  }

  private afterMove(dt: number) {
    const run = this.run;
    const t = run.terrain;

    // hazard tiles
    const cell = t.cellAt(this.x, this.z);
    if (cell === CELL.hazard && !this.clearsGround) {
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

  /** Moves by (mx, mz) sliding along walls. */
  slide(mx: number, mz: number) {
    this.moveWithTerrain(mx, mz);
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

  clearPath() {
    this.path.length = 0;
    this.pathI = 0;
  }

  /** Dash: fast slide with optional damage to everything touched on the way. */
  dash(dx: number, dz: number, dist: number, time: number, r: number, info: DamageInfo | null, color: number) {
    this.dashT = time;
    this.dashVX = (dx * dist) / time;
    this.dashVZ = (dz * dist) / time;
    this.dashR = r;
    this.dashInfo = info;
    this.dashColor = color;
    this.dashHit.clear();
    this.fx = dx;
    this.fz = dz;
    this.cancelJump();
    this.clearPath();
    this.cues.ability++;
  }

  /** Teleport to a point (or the nearest walkable spot toward it). */
  blinkTo(x: number, z: number, color: number) {
    const run = this.run;
    const t = run.terrain;
    // walk back along the line until the spot is free
    const sx = this.x;
    const sz = this.z;
    let tx = x;
    let tz = z;
    for (let i = 0; i < 20 && t.blocksWalker(Math.floor(tx), Math.floor(tz)); i++) {
      tx += (sx - tx) * 0.15;
      tz += (sz - tz) * 0.15;
    }
    if (t.blocksWalker(Math.floor(tx), Math.floor(tz))) return;
    run.fx.burst(this.x, 1, this.z, color, 18, 4, 0.16, 0.5, 'glow');
    this.x = tx;
    this.z = tz;
    this.vx = this.vz = 0;
    this.clearPath();
    this.invulnT = Math.max(this.invulnT, 0.25);
    run.fx.burst(tx, 1, tz, color, 22, 4, 0.16, 0.5, 'glow');
    const ring = run.effects.add('ring', tx, tz, 0.35, color);
    ring.r = 1.6;
  }

  private updateDash(dt: number) {
    const run = this.run;
    this.dashT -= dt;
    const ox = this.x;
    const oz = this.z;
    this.moveWithTerrain(this.dashVX * dt, this.dashVZ * dt);
    this.vx = this.dashVX * 0.3;
    this.vz = this.dashVZ * 0.3;
    // trail
    run.fx.burst(this.x, 0.8, this.z, this.dashColor, 3, 1, 0.14, 0.35, 'glow');
    if (Math.hypot(this.x - ox, this.z - oz) < 0.001) this.dashT = 0;
    const info = this.dashInfo;
    if (info && this.dashR > 0) {
      run.enemies.forEachInRadius(this.x, this.z, this.dashR, (e) => {
        if (this.dashHit.has(e.uid)) return;
        this.dashHit.add(e.uid);
        run.combat.hit(e, info, 1, this.dashVX, this.dashVZ);
      });
    }
    if (this.dashT <= 0) {
      this.vx *= 0.3;
      this.vz *= 0.3;
    }
  }

  /** Click-to-move: steering toward the next waypoint; returns the input direction. */
  private steer(dt: number, ix: number, iz: number): [number, number] {
    const run = this.run;
    const c = run.ctl;
    if (Math.hypot(ix, iz) > 0.08) {
      this.clearPath();
      return [ix, iz];
    }
    if (c.stop) this.clearPath();
    this.repathT -= dt;
    if (c.click || (c.move && this.repathT <= 0)) {
      this.repathT = 0.15;
      const t = run.terrain;
      if (Math.hypot(c.aimX - this.x, c.aimZ - this.z) < 0.3) this.clearPath();
      else {
        this.path = clearLine(t, this.x, this.z, c.aimX, c.aimZ) ? [c.aimX, c.aimZ] : findPath(t, this.x, this.z, c.aimX, c.aimZ);
        this.pathI = 0;
      }
    }
    while (this.pathI < this.path.length) {
      const tx = this.path[this.pathI];
      const tz = this.path[this.pathI + 1];
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      const last = this.pathI + 2 >= this.path.length;
      if (d < (last ? 0.12 : 0.35)) {
        this.pathI += 2;
        continue;
      }
      // ease in on the last metre so the hero does not overshoot the click
      const k = last ? Math.min(1, d / 0.6 + 0.25) : 1;
      return [(dx / d) * k, (dz / d) * k];
    }
    if (this.path.length) this.clearPath();
    return [0, 0];
  }

  /** Applies incoming damage. Returns damage actually taken. */
  hurt(raw: number, source: Enemy | null, ignoreInvuln = false): number {
    const run = this.run;
    if (this.dead || run.debug.god) return 0;
    if (!ignoreInvuln && this.invulnT > 0) return 0;
    if (this.buffs.aegis > 0) return 0;
    if (this.stats.dodge > 0 && Math.random() < this.stats.dodge) {
      run.fx.text(this.x, this.z, run.tr('dodge'), 0xc1e8ff);
      return 0;
    }
    if (this.shield) {
      this.shield = false;
      run.fx.burst(this.x, 1, this.z, 0x8ad0ff, 18, 4, 0.16, 0.5, 'glow');
      run.fx.sound('shield');
      this.invulnT = 0.4;
      return 0;
    }
    const armor = this.stats.armor + run.action.armorBonus;
    // armor: flat reduction for small hits plus a percentage for big ones
    let dmg = Math.max(BALANCE.armorMin, raw * (1 - Math.min(0.6, armor * 0.015)) - armor * 0.5);
    dmg = run.action.absorb(dmg, source);
    if (dmg <= 0) return 0;
    this.hp -= dmg;
    this.hurtT = 0.25;
    this.cues.hit++;
    this.cues.hitX = source ? this.x - source.x : 0;
    this.cues.hitZ = source ? this.z - source.z : 0;
    if (!ignoreInvuln) this.invulnT = BALANCE.hurtInvuln;
    run.stats.damageTaken += dmg;
    run.stats.noHitBest = Math.max(run.stats.noHitBest, run.time - run.stats.lastHurt);
    run.stats.lastHurt = run.time;
    run.fx.number(this.x, this.z, dmg, false, 0xff4040);
    run.fx.sound('hurt');
    run.fx.vibrate(25);
    run.fx.shake(0.15);
    if (source && this.stats.thorns > 0) run.combat.applyRaw(source, raw * this.stats.thorns * this.stats.might, 0xb0e070, 'thorns');
    if (run.debug.infHp) this.hp = this.stats.maxHp;
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
      this.cues.ability++;
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
    this.cancelJump();
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
    // fewer, tougher foes: each is worth more experience
    v *= this.run.debug.xpMul * 1.35;
    this.xp += v * this.stats.growth;
    this.run.stats.xpGained += v * this.stats.growth;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      if (this.level >= this.run.action.maxLevel) {
        // past the cap: every extra bar restores the hero instead of levelling
        this.run.action.onOverflow();
        continue;
      }
      this.level++;
      this.pendingLevels++;
      this.run.action.onLevel(this.level);
      this.xpNext = BALANCE.xpForLevel(this.level);
    }
  }
}
