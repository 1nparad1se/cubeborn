import { DAY_NIGHT } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import { ENEMY_BY_ID } from '../data/enemies';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import type { DamageInfo } from './types';
import { TAU } from '../core/math';

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
    if (e.dayKind === 'sleeper') e.awakeT = DAY_NIGHT.sleeperDozeAfter;
    const critChance = info.critChance + st.critChance;
    const crit = Math.random() < critChance;
    let dmg = info.damage * st.might * run.player.damageMul * mult;
    if (crit) dmg *= info.critDamage + st.critDamage;
    dmg *= 0.92 + Math.random() * 0.16;
    if (e.hasElite('armored')) dmg *= 0.7;
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
    if (info.freeze > 0 && !e.boss && Math.random() < info.freeze) e.freezeT = Math.max(e.freezeT, (info.freezeDur || 1.5) * st.duration);
    if (info.poison > 0) {
      e.poisonDps = Math.max(e.poisonDps, info.poison * st.might);
      e.poisonT = Math.max(e.poisonT, info.poisonDur * st.duration);
    }
    if (info.burn > 0) {
      e.burnDps = Math.max(e.burnDps, info.burn * st.might);
      e.burnT = Math.max(e.burnT, info.burnDur * st.duration);
    }
    if (run.settings.damageNumbers) run.fx.number(e.x, e.z, dmg, crit);
    run.vfx.impact(e, info.weaponId, dmg, crit, dirX || e.x - run.player.x, dirZ || e.z - run.player.z);
    run.hitSoundBudget++;
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  }

  /** Damage over time / non-weapon damage without crit or knockback. */
  applyRaw(e: Enemy, dmg: number, color: number, source: string) {
    if (!e.alive || e.invuln || e.shieldT > 0) return;
    e.hp -= dmg;
    this.run.stats.addDamage(source, dmg);
    if (this.run.settings.damageNumbers) this.run.fx.number(e.x, e.z, dmg, false, color);
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Kills an enemy: rewards, death fx, split/explode effects, perks. */
  killEnemy(e: Enemy, silent = false) {
    if (!e.alive) return;
    const run = this.run;
    const def = e.def;
    run.enemies.startDying(e);
    const isProp = def.category === 'prop';
    if (e.boss) {
      e.boss.onDeath();
      return;
    }
    // death fx: chunks in the enemy's main color
    run.fx.burst(e.x, 0.6 * e.scale, e.z, run.enemyColor(def.id), isProp ? 10 : e.elite ? 26 : 7, 4 + e.scale, 0.14 * e.scale, 0.7, 'debris');
    if (e.elite) {
      run.fx.shake(0.35);
      run.fx.light(e.x, e.z, 0xffe0a0, 3, 6, 0.4);
    }
    if (isProp) {
      run.pickups.dropFromProp(e.x, e.z);
      run.fx.sound('crate');
      return;
    }
    if (!silent) run.killSoundBudget++;
    run.stats.kills++;
    run.stats.killsBy[def.id] = (run.stats.killsBy[def.id] ?? 0) + 1;
    if (run.dayNight.isNight) run.stats.nightKills++;
    else if (run.dayNight.enabled) run.stats.dayKills++;
    if (e.asleep) run.stats.sleepersKilled++;
    if (e.dire > 0.5) run.stats.direKilled++;
    if (!e.noReward) {
      if (e.xp > 0) run.pickups.dropXp(e.x, e.z, e.xp);
      run.pickups.rollKillDrops(e);
    }
    if (e.elite) {
      run.stats.elites++;
      // chests are rare, but an elite is likely to carry one once a weapon is ready to evolve
      const chance = run.weapons.evolvable().length ? BALANCE.evoChestChance : BALANCE.eliteChestChance;
      if (Math.random() < chance * run.player.stats.luck) run.pickups.spawnChest(e.x, e.z, 0, 'elite');
    }
    if (def.id === 'treasure_sprite') {
      run.stats.treasureSprites++;
      run.pickups.treasureBurst(e.x, e.z);
    }
    // lifesteal
    if (run.player.stats.lifesteal > 0) run.player.heal(run.player.stats.lifesteal, true);
    // splitting
    const splitId = def.splitInto ?? (e.hasElite('splitting') ? def.id : undefined);
    if (splitId && run.enemies.aliveCount < BALANCE.hardCap) {
      const n = (def.p?.split as number) ?? 4;
      const child = ENEMY_BY_ID[splitId];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + Math.random();
        const c = run.enemies.spawn(child, e.x + Math.cos(a) * 0.6, e.z + Math.sin(a) * 0.6);
        if (c) {
          c.kx = Math.cos(a) * 4;
          c.kz = Math.sin(a) * 4;
          if (e.hasElite('splitting')) c.xp = 1;
        }
      }
    }
    if (e.hasElite('volatile')) {
      run.hazards.telegraph(e.x, e.z, 3, 0.7);
      run.hazards.delayedExplosion(e.x, e.z, 3, e.damage, 0.7);
    }
    run.weapons.onKill(e);
    run.perks.onKill(e);
  }
}
