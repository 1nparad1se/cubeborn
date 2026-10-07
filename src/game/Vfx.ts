import { ELEMENT_FX, VFX, elementFor, type Element } from '../config/vfx';
import { WEAPON_BY_ID } from '../data/weapons';
import type { Enemy } from './Enemy';
import type { Run } from './Run';
import type { WeaponInstance } from './weapons/Weapon';

/**
 * Skill VFX director: plays the anticipation → impact → follow-through beats of every attack in
 * its element's style (config/vfx.ts). Purely visual; does nothing headless (sim/tests).
 * Budgets keep big fights readable: past the per-frame impact budget hits only flash and recoil.
 */
export class Vfx {
  private elements = new Map<string, Element>();
  private budget = 0;
  private shakeT = 0;
  private soundT: Partial<Record<Element, number>> = {};
  private statusAcc = 0;

  constructor(private run: Run) {}

  elementOf(weaponId: string): Element {
    let e = this.elements.get(weaponId);
    if (!e) {
      e = elementFor(weaponId, WEAPON_BY_ID[weaponId]?.tags);
      this.elements.set(weaponId, e);
    }
    return e;
  }

  update(dt: number) {
    this.budget = VFX.impactBudget;
    if (this.shakeT > 0) this.shakeT -= dt;
    for (const k in this.soundT) this.soundT[k as Element]! -= dt;
    this.statusTick(dt);
  }

  /** Anticipation: energy converges on the hero's hand just before a weapon fires. */
  windup(w: WeaponInstance) {
    const lv = this.run.fx.level();
    if (lv < 1) return;
    const p = this.run.player;
    const fx = ELEMENT_FX[this.elementOf(w.def.id)];
    this.run.fx.emit(p.x + p.fx * 0.35, 1 + p.jumpY, p.z + p.fz * 0.35, fx.windup, 0, 0, VFX.levelMul[lv]);
  }

  /** Release: a short cone from the hero toward the attack direction. */
  release(w: WeaponInstance, dirX: number, dirZ: number) {
    const lv = this.run.fx.level();
    if (lv < 0) return;
    const p = this.run.player;
    const fx = ELEMENT_FX[this.elementOf(w.def.id)];
    this.run.fx.emit(p.x + dirX * 0.45, 0.95 + p.jumpY, p.z + dirZ * 0.45, fx.release, dirX, dirZ, VFX.levelMul[lv]);
  }

  /**
   * Impact on an enemy: hit reaction (squash + recoil along the hit), element burst sprayed along
   * the hit direction, crit/big-hit flash and light shake, then residue for the follow-through.
   */
  impact(e: Enemy, weaponId: string, dmg: number, crit: boolean, dirX: number, dirZ: number) {
    const l = Math.hypot(dirX, dirZ);
    if (l > 0) {
      dirX /= l;
      dirZ /= l;
    }
    e.hitT = 0.16;
    e.hitDx = dirX;
    e.hitDz = dirZ;
    const run = this.run;
    const lv = run.fx.level();
    if (lv < 0) return;
    const big = dmg >= e.maxHp * VFX.bigHitShare;
    if ((crit || big) && this.shakeT <= 0) {
      run.fx.shake(crit ? VFX.critShake : VFX.bigHitShake);
      this.shakeT = VFX.shakeCooldown;
    }
    if (this.budget <= 0) return;
    this.budget--;
    const el = this.elementOf(weaponId);
    const fx = ELEMENT_FX[el];
    const mul = VFX.levelMul[lv] * (crit ? VFX.critMul : 1) * Math.min(1.6, 0.8 + e.scale * 0.25);
    const y = 0.55 * e.scale + e.y;
    // the spray leaves the far side of the enemy, as if the blow went through it
    const hx = e.x + dirX * e.radius * 0.6;
    const hz = e.z + dirZ * e.radius * 0.6;
    for (const L of fx.impact) run.fx.emit(hx, y, hz, L, dirX, dirZ, mul);
    if (lv >= 1 && Math.random() < VFX.residueChance) for (const L of fx.residue) run.fx.emit(e.x, y * 0.8, e.z, L, 0, 0, VFX.levelMul[lv]);
    if (crit) {
      const f = run.effects.add('flash', e.x, e.z, 0.14, fx.lightColor);
      f.r = 0.5 + e.radius;
      f.y = y;
    }
    if (fx.light > 0 && lv >= 1 && (crit || big || Math.random() < 0.2)) run.fx.light(e.x, e.z, fx.lightColor, fx.light * (crit ? 1.4 : 1), 3.5, 0.16);
    if (fx.sound && (this.soundT[el] ?? 0) <= 0) {
      this.soundT[el] = 1 / (fx.soundRate ?? 4);
      run.fx.sound(fx.sound, 0.45);
    }
  }

  /** Follow-through for area blasts (explosions, novas, strikes): residue spread over the area. */
  area(x: number, z: number, r: number, weaponId: string) {
    const lv = this.run.fx.level();
    if (lv < 1) return;
    const fx = ELEMENT_FX[this.elementOf(weaponId)];
    const n = Math.min(5, 1 + Math.round(r));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.8;
      for (const L of fx.residue) this.run.fx.emit(x + Math.cos(a) * d, 0.4, z + Math.sin(a) * d, L, 0, 0, VFX.levelMul[lv]);
    }
  }

  /** Lingering status looks: burning enemies shed embers, frozen ones frost, poisoned ones bubbles. */
  private statusTick(dt: number) {
    const run = this.run;
    const lv = run.fx.level();
    if (lv < 1) return;
    this.statusAcc += dt;
    if (this.statusAcc < 0.1) return;
    const step = this.statusAcc;
    this.statusAcc = 0;
    const R = VFX.statusRate;
    const p = run.player;
    const mul = VFX.levelMul[lv];
    let n = 0;
    for (const e of run.enemies.list) {
      if (!e.alive || e.dying > 0) continue;
      if (e.burnT <= 0 && e.freezeT <= 0 && e.poisonT <= 0) continue;
      if (Math.abs(e.x - p.x) > 18 || Math.abs(e.z - p.z) > 14) continue;
      if (++n > 40) break;
      const y = 0.6 * e.scale + e.y;
      if (e.burnT > 0 && Math.random() < R.burn * step) run.fx.emit(e.x, y, e.z, ELEMENT_FX.fire.residue[0], 0, 0, 0.5 * mul);
      if (e.freezeT > 0 && Math.random() < R.freeze * step) run.fx.emit(e.x, y * 1.2, e.z, ELEMENT_FX.ice.impact[0], 0, 0, 0.3 * mul);
      if (e.poisonT > 0 && Math.random() < R.poison * step) run.fx.emit(e.x, y, e.z, ELEMENT_FX.poison.impact[1], 0, 0, 0.6 * mul);
    }
  }
}
