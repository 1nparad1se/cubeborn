import type { Enemy } from './Enemy';
import type { Run } from './Run';
import { makeDamage } from './types';

/** Hero-specific passive abilities. */
export class Perks {
  private shieldT = 0;
  private staticT = 0;
  private raised = 0;
  private dmg = makeDamage();

  constructor(private run: Run, readonly id: string) {
    this.dmg.source = 0;
    this.dmg.weaponId = 'perk';
    this.dmg.knockback = 1;
    this.dmg.critChance = 0.05;
    this.dmg.critDamage = 1.5;
  }

  update(dt: number) {
    const run = this.run;
    const p = run.player;
    if (this.id === 'bastion' && !p.shield) {
      this.shieldT += dt;
      if (this.shieldT >= 10) {
        this.shieldT = 0;
        p.shield = true;
        p.cues.ability++;
        run.fx.burst(p.x, 1, p.z, 0x8ad0ff, 10, 2, 0.12, 0.4, 'glow');
      }
    }
    if (this.id === 'static') {
      if (p.moving) this.staticT += dt;
      if (this.staticT >= 3) {
        this.staticT = 0;
        this.dmg.damage = 14 + p.level * 1.6;
        let from = { x: p.x, z: p.z };
        const seen = new Set<number>();
        for (let i = 0; i < 4; i++) {
          const e = run.enemies.nearest(from.x, from.z, i === 0 ? 8 : 4, seen);
          if (!e) break;
          seen.add(e.uid);
          const ef = run.effects.add('bolt', from.x, from.z, 0.2, 0x4ad0ff);
          ef.x2 = e.x;
          ef.z2 = e.z;
          ef.y = 0.9;
          ef.w = 0.12;
          run.combat.hit(e, this.dmg);
          from = { x: e.x, z: e.z };
        }
        run.fx.sound('zap', 0.4);
        if (seen.size > 0) p.cues.ability++;
      }
    }
  }

  damageMul(): number {
    if (this.id === 'kindling') return 1 + Math.min(0.6, this.run.player.level * 0.015);
    return 1;
  }

  healMul(): number {
    return this.id === 'grace' ? 2 : 1;
  }

  onKill(e: Enemy) {
    const run = this.run;
    if (this.id === 'raise_dead' && !e.isAlly && run.rng.chance(0.04) && run.allies.count(-1) < 8) {
      this.dmg.damage = 8 + run.player.level * 0.8;
      run.allies.spawn(e.x, e.z, 10, 6, this.dmg, 0.6, 'ally_risen', -1, 0.9);
      this.raised++;
      run.player.cues.ability++;
    }
    if (this.id === 'volatile' && e.poisonT > 0) {
      this.dmg.damage = 6 + run.player.level * 1.5;
      run.enemies.forEachInRadius(e.x, e.z, 1.8, (o) => {
        run.combat.hit(o, this.dmg, 1, o.x - e.x, o.z - e.z);
        return false;
      });
      run.fx.burst(e.x, 0.5, e.z, 0x9cff4f, 10, 4, 0.16, 0.4, 'glow');
      const ef = run.effects.add('flash', e.x, e.z, 0.25, 0x9cff4f);
      ef.r = 1.8;
    }
  }

  onDodge() {
    if (this.id === 'wind_way') {
      this.run.player.burstT = 1.5;
      this.run.player.cues.ability++;
    }
  }

  onShieldBreak() {
    this.shieldT = 0;
  }
}
