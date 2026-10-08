import { TAU } from '../../core/math';
import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { makeDamage, type DamageInfo, type DmgType } from '../types';
import type { SummonKind } from './types';

/** Behaviour table for each summon kind. */
interface SummonSpec {
  speed: number;
  /** Attack reach (melee) or shooting range. */
  reach: number;
  /** Seconds between attacks at base speed. */
  every: number;
  el: DmgType;
  stag: number;
  scale: number;
  fly: boolean;
  /** Area of the attack (0 = single target). */
  area: number;
  color: number;
}

const SPECS: Record<SummonKind, SummonSpec> = {
  wolf: { speed: 7.5, reach: 1.3, every: 0.7, el: 'magic', stag: 4, scale: 1, fly: false, area: 0, color: 0x8affd8 },
  golem: { speed: 3.2, reach: 2, every: 1.6, el: 'phys', stag: 16, scale: 1.5, fly: false, area: 2.6, color: 0xb0a080 },
  wisp: { speed: 9, reach: 9, every: 0.8, el: 'lightning', stag: 3, scale: 0.6, fly: true, area: 0, color: 0x8ad8ff },
  ancient: { speed: 3.6, reach: 2.6, every: 1.3, el: 'phys', stag: 26, scale: 2.2, fly: false, area: 3.4, color: 0x6ac85a },
  hawk: { speed: 13, reach: 1.2, every: 1, el: 'phys', stag: 4, scale: 0.9, fly: true, area: 0, color: 0xd8c8a0 },
  clone: { speed: 0, reach: 0, every: 99, el: 'dark', stag: 20, scale: 1, fly: false, area: 2.6, color: 0x7a4aff },
  serpent: { speed: 6, reach: 3, every: 0.55, el: 'lightning', stag: 6, scale: 1.3, fly: true, area: 1.4, color: 0x8ad8ff },
  drake: { speed: 5.5, reach: 4.5, every: 1.2, el: 'fire', stag: 14, scale: 1.8, fly: true, area: 0, color: 0xff6a2a },
};

export class Summon {
  active = false;
  kind: SummonKind = 'wolf';
  x = 0;
  z = 0;
  y = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  life = 0;
  max = 1;
  info: DamageInfo = makeDamage();
  cd = 0;
  /** Attack animation timer (renderer). */
  attackT = 0;
  anim = 0;
  target: Enemy | null = null;
  targetUid = 0;
  retarget = 0;
  orbitA = 0;
  serial = 0;
}

let serial = 1;

/** Pets of the summoner (and the ranger hawk / reaper shadow clone): seek, attack, follow the hero. */
export class Summons {
  readonly list: Summon[] = [];
  /** Command: forced target near the cursor, its time left and damage bonus. */
  private cmdT = 0;
  private cmdMul = 0;
  private cmdX = 0;
  private cmdZ = 0;
  /** Frenzy buff for summons (damage, attack speed) and its time left. */
  frenzyT = 0;
  frenzyDmg = 0;
  frenzyAtk = 0;

  constructor(private run: Run) {}

  static spec(kind: SummonKind): SummonSpec {
    return SPECS[kind];
  }

  count(kind?: SummonKind): number {
    let n = 0;
    for (const s of this.list) if (s.active && (!kind || s.kind === kind)) n++;
    return n;
  }

  spawn(kind: SummonKind, x: number, z: number, life: number, dmg: number, source: number): Summon {
    const caps: Partial<Record<SummonKind, number>> = { wolf: 4, golem: 1, wisp: 6, hawk: 1, serpent: 1, drake: 1, ancient: 1 };
    const cap = caps[kind];
    if (cap !== undefined && this.count(kind) >= cap) {
      // replace the oldest of that kind
      let old: Summon | null = null;
      for (const s of this.list) if (s.active && s.kind === kind && (!old || s.life < old.life)) old = s;
      if (old) old.active = false;
    }
    let s = this.list.find((o) => !o.active);
    if (!s) {
      s = new Summon();
      this.list.push(s);
    }
    const sp = SPECS[kind];
    const t = this.run.terrain;
    if (!sp.fly && t.blocksWalker(Math.floor(x), Math.floor(z))) {
      x = this.run.player.x;
      z = this.run.player.z;
    }
    s.active = true;
    s.kind = kind;
    s.x = x;
    s.z = z;
    s.y = sp.fly ? 1.6 : 0;
    s.vx = s.vz = 0;
    s.life = s.max = life;
    s.cd = 0.3 + Math.random() * 0.3;
    s.attackT = 0;
    s.target = null;
    s.retarget = 0;
    s.orbitA = Math.random() * TAU;
    s.serial = serial++;
    const d = s.info;
    Object.assign(d, makeDamage());
    d.damage = dmg;
    d.el = sp.el;
    d.weaponId = 'summon_' + kind;
    d.knockback = kind === 'golem' || kind === 'ancient' ? 1.2 : 0.3;
    d.source = source;
    d.stag = sp.stag;
    if (kind === 'drake') {
      d.burn = dmg * 0.3;
      d.burnDur = 3;
    }
    if (kind === 'hawk') d.mark = 4;
    this.run.fx.burst(x, 0.8, z, sp.color, 16, 3, 0.14, 0.5, 'glow');
    return s;
  }

  command(x: number, z: number, mul: number) {
    this.cmdT = 4;
    this.cmdMul = mul;
    this.cmdX = x;
    this.cmdZ = z;
    for (const s of this.list) {
      s.target = null;
      s.retarget = 0;
    }
  }

  clear() {
    for (const s of this.list) s.active = false;
  }

  update(dt: number) {
    const run = this.run;
    const p = run.player;
    if (this.cmdT > 0) this.cmdT -= dt;
    if (this.frenzyT > 0) this.frenzyT -= dt;
    const atkMul = 1 + (this.frenzyT > 0 ? this.frenzyAtk : 0);
    for (const s of this.list) {
      if (!s.active) continue;
      s.life -= dt;
      s.anim += dt;
      if (s.attackT > 0) s.attackT -= dt;
      const sp = SPECS[s.kind];
      if (s.life <= 0) {
        if (s.kind === 'clone') this.explodeClone(s);
        run.fx.burst(s.x, 0.8 + s.y, s.z, sp.color, 12, 3, 0.14, 0.5, 'glow');
        s.active = false;
        continue;
      }
      if (s.kind === 'clone') continue;
      // targeting
      if (s.target && (!s.target.alive || s.target.uid !== s.targetUid)) s.target = null;
      s.retarget -= dt;
      if (!s.target || s.retarget <= 0) {
        s.retarget = 0.6;
        const cx = this.cmdT > 0 ? this.cmdX : s.kind === 'wisp' ? p.x : s.kind === 'hawk' ? run.ctl.aimX : p.x;
        const cz = this.cmdT > 0 ? this.cmdZ : s.kind === 'wisp' ? p.z : s.kind === 'hawk' ? run.ctl.aimZ : p.z;
        const e = run.enemies.nearest(cx, cz, this.cmdT > 0 ? 8 : 11, undefined, !sp.fly);
        s.target = e;
        s.targetUid = e?.uid ?? 0;
      }
      const e = s.target;
      let tx: number;
      let tz: number;
      if (s.kind === 'wisp') {
        // wisps orbit the hero and shoot
        s.orbitA += dt * 2.2;
        tx = p.x + Math.cos(s.orbitA) * 1.6;
        tz = p.z + Math.sin(s.orbitA) * 1.6;
      } else if (e) {
        const keep = s.kind === 'drake' ? 3.2 : s.kind === 'serpent' ? 0 : sp.reach * 0.7 + e.radius;
        const dx = s.x - e.x;
        const dz = s.z - e.z;
        const d = Math.hypot(dx, dz) || 1;
        if (s.kind === 'serpent') {
          s.orbitA += dt * 2.4;
          tx = e.x + Math.cos(s.orbitA) * 2.4;
          tz = e.z + Math.sin(s.orbitA) * 2.4;
        } else {
          tx = e.x + (dx / d) * keep;
          tz = e.z + (dz / d) * keep;
        }
      } else {
        // follow the hero loosely
        s.orbitA += dt * 0.6;
        const r = sp.fly ? 2.2 : 2.6;
        tx = p.x + Math.cos(s.orbitA) * r;
        tz = p.z + Math.sin(s.orbitA) * r;
      }
      const mx = tx - s.x;
      const mz = tz - s.z;
      const md = Math.hypot(mx, mz);
      const speed = sp.speed * (e ? 1 : md > 6 ? 1.6 : 0.9);
      if (md > 0.15) {
        const k = Math.min(1, (speed * dt) / md);
        const nx = s.x + mx * k;
        const nz = s.z + mz * k;
        if (sp.fly || !run.terrain.blocksWalker(Math.floor(nx), Math.floor(nz))) {
          s.x = nx;
          s.z = nz;
        } else if (md > 8) {
          s.x = tx;
          s.z = tz;
        }
        s.vx = mx / md;
        s.vz = mz / md;
      } else s.vx = s.vz = 0;
      if (Math.hypot(p.x - s.x, p.z - s.z) > 18) {
        s.x = p.x;
        s.z = p.z;
      }
      if (e) s.yaw = Math.atan2(e.x - s.x, e.z - s.z);
      else if (md > 0.15) s.yaw = Math.atan2(mx, mz);
      if (sp.fly) s.y = (s.kind === 'hawk' && e && Math.hypot(e.x - s.x, e.z - s.z) < 2 ? 0.8 : 1.6) + Math.sin(s.anim * 3) * 0.15;
      // attack
      s.cd -= dt * atkMul;
      if (!e || s.cd > 0) continue;
      const ed = Math.hypot(e.x - s.x, e.z - s.z);
      if (ed > sp.reach + e.radius) continue;
      s.cd = sp.every;
      s.attackT = 0.35;
      this.attack(s, e);
    }
  }

  private dmgMul(): number {
    return (this.cmdT > 0 ? 1 + this.cmdMul : 1) * (this.frenzyT > 0 ? 1 + this.frenzyDmg : 1);
  }

  private attack(s: Summon, e: Enemy) {
    const run = this.run;
    const sp = SPECS[s.kind];
    const mul = this.dmgMul();
    const fxl = run.action.fx;
    switch (s.kind) {
      case 'wisp': {
        const dx = e.x - s.x;
        const dz = e.z - s.z;
        const d = Math.hypot(dx, dz) || 1;
        const pr = run.projectiles.spawn(null, s.x, s.z, (dx / d) * 18, (dz / d) * 18, 0.7, 'wispbolt', sp.color);
        Object.assign(pr.dmg, s.info);
        pr.dmg.damage *= mul;
        pr.y = 1.4;
        pr.glow = 1;
        break;
      }
      case 'serpent': {
        const b = fxl.add('bolt', e.x, e.z, 0.25, sp.color);
        b.y = 5;
        b.x2 = e.x;
        b.z2 = e.z;
        run.enemies.forEachInRadius(e.x, e.z, sp.area, (o) => {
          run.combat.hit(o, s.info, mul, o.x - s.x, o.z - s.z);
        });
        break;
      }
      case 'drake': {
        // fire breath cone
        const a = Math.atan2(e.z - s.z, e.x - s.x);
        const f = fxl.add('hit', s.x, s.z, 0.45, sp.color);
        f.a = a;
        f.fx = 'fire';
        f.shape = { k: 'cone', r: sp.reach, arc: 60 };
        const cos = Math.cos((30 * Math.PI) / 180);
        run.enemies.forEachInRadius(s.x, s.z, sp.reach + 0.5, (o) => {
          const dx = o.x - s.x;
          const dz = o.z - s.z;
          const d = Math.hypot(dx, dz) || 1;
          if ((dx * Math.cos(a) + dz * Math.sin(a)) / d < cos && d > 0.8) return;
          run.combat.hit(o, s.info, mul, dx, dz);
        });
        break;
      }
      case 'golem':
      case 'ancient': {
        const f = fxl.add('hit', e.x, e.z, 0.4, sp.color);
        f.fx = 'smash';
        f.shape = { k: 'circle', r: sp.area };
        run.enemies.forEachInRadius(e.x, e.z, sp.area, (o) => {
          run.combat.hit(o, s.info, mul, o.x - e.x, o.z - e.z);
        });
        run.fx.shake(s.kind === 'ancient' ? 0.15 : 0.06);
        break;
      }
      default:
        run.combat.hit(e, s.info, mul, e.x - s.x, e.z - s.z);
        if (s.kind === 'hawk') run.fx.burst(e.x, 1, e.z, 0xffe0a0, 6, 3, 0.1, 0.3, 'glow');
    }
  }

  private explodeClone(s: Summon) {
    const run = this.run;
    const sp = SPECS.clone;
    const f = run.action.fx.add('hit', s.x, s.z, 0.5, sp.color);
    f.fx = 'dark';
    f.shape = { k: 'circle', r: sp.area };
    run.enemies.forEachInRadius(s.x, s.z, sp.area, (o) => {
      run.combat.hit(o, s.info, 1, o.x - s.x, o.z - s.z);
    });
    run.fx.shake(0.12);
  }
}
