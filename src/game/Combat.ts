import type { Enemy } from './Enemy';
import type { Run } from './Run';
import type { DamageInfo } from './types';

/** Central damage resolution so crits, statuses, knockback, numbers and kills are consistent. */
export class Combat {
  constructor(private run: Run) {}

  /**
   * Applies player damage to an enemy. Returns damage dealt (0 if immune).
   * dirX/dirZ define knockback direction; if zero, pushes away from the player.
   */
  hit(e: Enemy, info: DamageInfo, mult = 1, dirX = 0, dirZ = 0): number {
    if (!e.alive) return 0;
    const run = this.run;
    const st = run.player.stats;
    if (e.invuln || e.shieldT > 0) {
      if (Math.random() < 0.2) run.fx.burst(e.x, 1, e.z, 0xa0a0ff, 3, 2, 0.12, 0.3, 'glow');
      return 0;
    }
    const critChance = info.critChance + st.critChance;
    const crit = Math.random() < critChance;
    let dmg = info.damage * st.might * run.player.damageMul * mult;
    if (crit) dmg *= info.critDamage + st.critDamage;
    dmg *= 0.92 + Math.random() * 0.16;
    if (info.el) dmg *= this.combo(e, info, crit, dmg, dirX, dirZ);
    e.hp -= dmg;
    e.flash = 0.1;
    run.stats.addDamage(info.weaponId, dmg);

    // knockback
    if (info.knockback > 0 && e.kbResist < 1) {
      let kx = dirX;
      let kz = dirZ;
      if (kx === 0 && kz === 0) {
        kx = e.x - run.player.x;
        kz = e.z - run.player.z;
      }
      const l = Math.hypot(kx, kz) || 1;
      const f = info.knockback * st.knockback * (1 - e.kbResist) * 5;
      e.kx += (kx / l) * f;
      e.kz += (kz / l) * f;
    }
    // statuses
    if (info.slow > 0) {
      e.slowMul = Math.min(e.slowMul, info.slow);
      e.slowT = Math.max(e.slowT, info.slowDur * st.duration);
    }
    if (info.freeze > 0 && Math.random() < info.freeze) e.freezeT = Math.max(e.freezeT, (info.freezeDur || 1.5) * st.duration);
    if (info.poison > 0) {
      e.poisonDps = Math.max(e.poisonDps, info.poison * st.might);
      e.poisonT = Math.max(e.poisonT, info.poisonDur * st.duration);
    }
    if (info.burn > 0) {
      e.burnDps = Math.max(e.burnDps, info.burn * st.might);
      e.burnT = Math.max(e.burnT, info.burnDur * st.duration);
    }
    if (info.stun > 0) e.stunT = Math.max(e.stunT, info.stun * st.duration);
    if (info.bleed > 0) {
      e.bleedDps = Math.max(e.bleedDps, info.bleed * st.might);
      e.bleedT = Math.max(e.bleedT, (info.bleedDur || 3) * st.duration);
    }
    if (info.curse > 0) e.curseT = Math.max(e.curseT, info.curse * st.duration);
    if (info.weaken > 0) e.weakenT = Math.max(e.weakenT, info.weaken * st.duration);
    if (info.el) run.action.onHit(e, info, dmg, crit);
    if (info.stag > 0 || info.launch || info.root > 0 || info.mark > 0) this.actionEffects(e, info);
    if (crit) run.stats.crits++;
    if (run.settings.damageNumbers) run.fx.number(e.x, e.z, dmg, crit);
    run.vfx.impact(e, info.weaponId, dmg, crit, dirX || e.x - run.player.x, dirZ || e.z - run.player.z);
    run.hitSoundBudget++;
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  }

  /**
   * Elemental combos and status amplifiers for typed (skill) damage. Returns a damage multiplier.
   * Frozen + lightning shatters, burning + fire ignites, bleeding + physical crit hemorrhages,
   * curse amplifies everything and dark most of all.
   */
  private combo(e: Enemy, info: DamageInfo, crit: boolean, dmg: number, dirX: number, dirZ: number): number {
    const run = this.run;
    let m = run.action.damageMulVs(e, info, dirX, dirZ);
    if (e.curseT > 0) m *= info.el === 'dark' ? 1.35 : 1.2;
    if (info.el === 'lightning' && e.freezeT > 0) {
      e.freezeT = 0;
      m *= 2;
      run.fx.text(e.x, e.z, run.tr('combo_shatter'), 0xbfe8ff);
      run.fx.burst(e.x, 0.8, e.z, 0xd8f4ff, 16, 5, 0.16, 0.5, 'debris');
      run.stats.combos++;
    } else if (info.el === 'fire' && e.burnT > 0 && info.burn <= 0) {
      e.burnT = 0;
      run.fx.text(e.x, e.z, run.tr('combo_ignite'), 0xffa040);
      run.stats.combos++;
      const r = 2.4;
      const ring = run.effects.add('ring', e.x, e.z, 0.35, 0xff7a2a);
      ring.r = r;
      run.fx.burst(e.x, 0.6, e.z, 0xff8a2a, 18, 5, 0.18, 0.5, 'glow');
      const blast = dmg * 0.6;
      const src = e;
      run.enemies.forEachInRadius(e.x, e.z, r, (o) => {
        if (o !== src) this.applyRaw(o, blast, 0xff8a3a, 'combo');
      });
    } else if (info.el === 'phys' && crit && e.bleedT > 0) {
      m *= 1.4;
      run.fx.text(e.x, e.z, run.tr('combo_hemorrhage'), 0xff5060);
      run.stats.combos++;
    }
    return m;
  }

  /** Stagger bar size of a target. */
  stagMaxOf(e: Enemy): number {
    return 18 + e.maxHp * 0.05;
  }

  /** Stagger, knock-up, root and mark from action skills. */
  private actionEffects(e: Enemy, info: DamageInfo) {
    if (!e.alive) return;
    if (info.stag > 0 && e.brokenT <= 0) {
      if (!e.stagMax) e.stagMax = this.stagMaxOf(e);
      e.stag += info.stag;
      e.stagIdle = 0;
      if (e.stag >= e.stagMax) this.breakStagger(e);
    }
    if (info.launch && e.kbResist < 0.95 && !e.flying) {
      e.launchT = 0.6;
      e.stunT = Math.max(e.stunT, 0.65);
    }
    if (info.root > 0) e.rootT = Math.max(e.rootT, info.root);
    if (info.mark > 0) e.markT = Math.max(e.markT, info.mark);
  }

  /** A full stagger bar breaks the enemy: stunned, vulnerable (+30% damage), attacks interrupted. */
  breakStagger(e: Enemy) {
    const run = this.run;
    e.stag = 0;
    e.brokenT = 1.6;
    e.stunT = Math.max(e.stunT, e.brokenT);
    const f = run.action.fx.add('break', e.x, e.z, 0.8, 0xffe080);
    f.r = e.radius * 2 + 0.6;
    f.y = e.scale * 1.6;
    run.action.addUlt(0.3);
  }

  /** Damage over time / non-weapon damage without crit or knockback. */
  applyRaw(e: Enemy, dmg: number, color: number, source: string) {
    if (!e.alive || e.invuln || e.shieldT > 0) return;
    e.hp -= dmg;
    this.run.stats.addDamage(source, dmg);
    if (this.run.settings.damageNumbers) this.run.fx.number(e.x, e.z, dmg, false, color);
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Kills a target: death fx, plague spread, experience and skill hooks. */
  killEnemy(e: Enemy, silent = false) {
    if (!e.alive) return;
    const run = this.run;
    run.enemies.startDying(e);
    run.fx.burst(e.x, 0.6 * e.scale, e.z, 0xb0b0b0, 7, 4 + e.scale, 0.14 * e.scale, 0.7, 'debris');
    if (!silent) run.killSoundBudget++;
    if (e.poisonT > 0 && e.poisonDps > 0) {
      // plague: poison jumps to nearby foes when its carrier dies
      const dps = e.poisonDps * 0.8;
      const t = Math.max(2, e.poisonT);
      let n = 0;
      run.enemies.forEachInRadius(e.x, e.z, 3, (o) => {
        if (o === e || !o.alive || n >= 4) return;
        n++;
        o.poisonDps = Math.max(o.poisonDps, dps);
        o.poisonT = Math.max(o.poisonT, t);
      });
      if (n) {
        const ring = run.effects.add('ring', e.x, e.z, 0.4, 0x9cff4f);
        ring.r = 3;
        run.fx.burst(e.x, 0.5, e.z, 0x9cff4f, 12, 3, 0.16, 0.6, 'smoke');
      }
    }
    run.action.onKill(e);
    run.stats.kills++;
    if (!e.noReward && e.xp > 0) {
      run.player.addXp(e.xp);
      run.xpSoundBudget++;
    }
    if (run.player.stats.lifesteal > 0) run.player.heal(run.player.stats.lifesteal, true);
  }
}
