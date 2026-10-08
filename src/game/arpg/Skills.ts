import type { Rarity, StatMods } from '../../data/types';
import { PASSIVES, PASSIVE_BY_ID } from '../../data/passives';
import { TAU } from '../../core/math';
import type { Enemy } from '../Enemy';
import type { Choice } from '../Leveling';
import type { Run } from '../Run';
import { makeDamage, type DamageInfo, type DmgType } from '../types';
import {
  kitFor, MAX_LEVEL, MOD_BY_ID, MODS, SKILL_MAX, STAT_UPS, ULT_LEVEL, ULT_UP_LEVELS,
  type Act, type ClassKit, type SkillBuff, type SkillDef, type SpecialId, type StatusId,
} from './kits';
import { clearLine } from './Path';

/** Frame input for the action-RPG controls, filled by the client each frame (world space). */
export interface Controls {
  /** Cursor on the ground. */
  aimX: number;
  aimZ: number;
  /** Basic attack held (RMB, or Shift+LMB). */
  attack: boolean;
  /** LMB held over the ground: walk toward the cursor. */
  move: boolean;
  /** A new click this frame (re-path even when not held). */
  click: boolean;
  /** Skill slots pressed this frame (0..3 = Q W E R). */
  casts: number[];
  dodge: boolean;
  /** Stop moving (S / hold-position). */
  stop: boolean;
}

export function makeControls(): Controls {
  return { aimX: 0, aimZ: 0, attack: false, move: false, click: false, casts: [], dodge: false, stop: false };
}

interface CastMeta {
  slot: number;
  basic: boolean;
  sp: Set<SpecialId>;
}

interface Lasting {
  x: number;
  z: number;
  r: number;
  t: number;
  every: number;
  acc: number;
  info: DamageInfo;
  pull: boolean;
  /** Turrets shoot the nearest enemy in range instead of pulsing an area. */
  turret: boolean;
  range: number;
  vis: string;
  color: number;
  fxColor: number;
  el: DmgType;
}

const EL_FX: Record<DmgType, string> = { phys: 'el_physical', fire: 'el_fire', ice: 'el_ice', lightning: 'el_lightning', poison: 'el_poison', dark: 'el_dark', magic: 'el_holy' };
export const EL_COLOR: Record<DmgType, number> = { phys: 0xe8e0d0, fire: 0xff7a2a, ice: 0x8ae8ff, lightning: 0x8ad8ff, poison: 0x9cff4f, dark: 0xb070ff, magic: 0xffe08a };
const EL_SFX: Record<DmgType, string> = { phys: 'slash', fire: 'fire', ice: 'ice', lightning: 'zap', poison: 'venom', dark: 'shadow', magic: 'magic' };
const SOURCE_SKILL = 20;
const SOURCE_BASIC = 21;
const ALLY_GROUP = -7;

/** Default strength of a status added by an upgrade or modifier when the act has none of it. */
const ST_DEFAULT: Record<StatusId, number> = { burn: 6, slow: 0.55, freeze: 1.2, stun: 0.8, poison: 6, bleed: 6, curse: 4, weaken: 4 };

/**
 * Hero abilities for the action-RPG combat: basic attack toward the cursor, Q/W/E/R skills with
 * cooldowns, levels and a class resource, dodge, build modifiers and the level-up choices.
 */
export class SkillSystem {
  readonly kit: ClassKit;
  res = 0;
  /** Q/W/E levels (1..6). */
  readonly levels = [1, 1, 1];
  /** Ultimate level: 0 = not learned, then 1..4. */
  ultLevel = 0;
  /** Ultimate upgrades earned (levels 12/18/22) — applied once the Ultimate is learned. */
  ultBank = 0;
  ultDeclined = false;
  readonly cds = [0, 0, 0, 0];
  readonly cdMax = [1, 1, 1, 1];
  basicCd = 0;
  dodgeCd = 0;
  dodgeMax = 3;
  dodgeLevel = 0;
  /** Unspent skill points (one per level). */
  points = 0;
  readonly mods = new Set<string>();
  readonly statUps = new Map<string, number>();
  private buffs: { b: Partial<SkillBuff>; t: number }[] = [];
  readonly buff: SkillBuff = { dmg: 0, speed: 0, armor: 0, atkSpeed: 0, lifesteal: 0, crit: 0, thorns: 0 };
  private lasting: Lasting[] = [];
  private meta = new WeakMap<DamageInfo, CastMeta>();
  /** Facing lock after a cast (seconds) and its direction. */
  lockT = 0;
  lockX = 0;
  lockZ = 1;
  private basicCount = 0;
  private harvest = 0;
  private kindle = false;
  /** Flashes the HUD slot that was just used / refused. */
  readonly flash = [0, 0, 0, 0, 0];
  readonly denied = [0, 0, 0, 0, 0];
  /** Overflow bars past the level cap. */
  overflow = 0;

  constructor(private run: Run) {
    this.kit = kitFor(run.hero.id);
    this.res = this.kit.res.startFull ? this.kit.res.max : 0;
  }

  get resMax(): number {
    return this.kit.res.max + this.run.loot.totals.resMax;
  }

  /** A build modifier is active when chosen on level up or granted by a legendary item. */
  hasMod(id: string): boolean {
    return this.mods.has(id) || this.run.loot.powers.has(id);
  }

  skill(slot: number): SkillDef {
    return slot < 3 ? this.kit.skills[slot] : this.kit.ult;
  }

  level(slot: number): number {
    return slot < 3 ? this.levels[slot] : this.ultLevel;
  }

  // ------------------------------------------------------------------ upgrades
  private ups(slot: number) {
    const def = this.skill(slot);
    const lv = this.level(slot);
    const out = { dmg: 1, cd: 1, area: 1, count: 0, dur: 1, cost: 1, st: {} as Partial<Record<StatusId, number>>, sp: new Set<SpecialId>() };
    for (let i = 0; i < lv - 1 && i < def.ups.length; i++) {
      const u = def.ups[i];
      switch (u.t) {
        case 'dmg':
          out.dmg += u.v;
          break;
        case 'cd':
          out.cd -= u.v;
          break;
        case 'area':
          out.area += u.v;
          break;
        case 'count':
          out.count += u.v;
          break;
        case 'dur':
          out.dur += u.v;
          break;
        case 'cost':
          out.cost -= u.v;
          break;
        case 'status':
          out.st[u.st!] = (out.st[u.st!] ?? 0) + u.v;
          break;
        case 'special':
          out.sp.add(u.sp!);
          break;
      }
    }
    return out;
  }

  cooldownOf(slot: number): number {
    const st = this.run.player.stats;
    return this.skill(slot).cd * Math.max(0.3, this.ups(slot).cd) * st.cooldown * (this.hasMod('m_arcane') ? 0.9 : 1);
  }

  costOf(slot: number): number {
    return this.skill(slot).cost * this.ups(slot).cost;
  }

  /** Can this slot be cast right now (learned, off cooldown, enough resource)? */
  ready(slot: number): boolean {
    if (this.level(slot) <= 0 || this.cds[slot] > 0) return false;
    return this.affordable(slot);
  }

  affordable(slot: number): boolean {
    if (this.kit.res.id === 'heat') return true;
    return this.res >= this.costOf(slot) - 0.01;
  }

  /** Character-level damage scaling. */
  private get levelMul(): number {
    return 1 + (this.run.player.level - 1) * 0.06;
  }

  private get heatMul(): number {
    return this.kit.res.id === 'heat' ? 1 + this.res * 0.006 : 1;
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, c: Controls) {
    const run = this.run;
    const p = run.player;
    const r = this.kit.res;
    // resource
    let regen = r.regen;
    if (r.id === 'rage' && run.time - run.stats.lastHurt < 3) regen = 0;
    if (r.id !== 'heat') regen += run.loot.totals.resRegen;
    const max = this.resMax;
    this.res = Math.max(0, Math.min(max, this.res + regen * dt));
    if (run.debug.infRes) this.res = r.id === 'heat' ? 0 : max;
    if (run.debug.noCd) {
      this.cds.fill(0);
      this.dodgeCd = 0;
    }
    for (let i = 0; i < 4; i++) if (this.cds[i] > 0) this.cds[i] = Math.max(0, this.cds[i] - dt);
    for (let i = 0; i < 5; i++) {
      if (this.flash[i] > 0) this.flash[i] -= dt;
      if (this.denied[i] > 0) this.denied[i] -= dt;
    }
    if (this.basicCd > 0) this.basicCd -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.lockT > 0) this.lockT -= dt;
    this.updateBuffs(dt);
    this.updateLasting(dt);
    if (p.dead) return;
    // fizz: overload
    if (r.id === 'heat' && this.res >= this.resMax - 0.01) this.overload();
    if (c.dodge) this.dodge(c);
    for (const s of c.casts) this.cast(s, c.aimX, c.aimZ);
    if (c.attack && this.basicCd <= 0 && p.dashT <= 0) this.basicAttack(c.aimX, c.aimZ);
  }

  private updateBuffs(dt: number) {
    const b = this.buff;
    b.dmg = b.speed = b.armor = b.atkSpeed = b.lifesteal = b.crit = b.thorns = 0;
    let w = 0;
    for (const it of this.buffs) {
      it.t -= dt;
      if (it.t <= 0) continue;
      this.buffs[w++] = it;
      for (const k in it.b) b[k as keyof SkillBuff] += it.b[k as keyof SkillBuff] ?? 0;
    }
    this.buffs.length = w;
    // passive class mechanics and modifiers
    if (this.kit.mechanic.id === 'bulwark') b.armor += Math.floor(this.res / 10);
    if (this.hasMod('m_swift')) b.atkSpeed += 0.15;
    b.atkSpeed += this.run.loot.totals.atkSpeed;
    if (this.kit.mechanic.id === 'overclock' && this.lasting.some((l) => l.turret)) b.atkSpeed += 0.3;
  }

  /** Effective armor bonus and damage reduction from skills. */
  get armorBonus(): number {
    return this.buff.armor;
  }

  get speedMul(): number {
    return 1 + this.buff.speed;
  }

  // ------------------------------------------------------------------ damage
  private makeInfo(act: Act, mul: number, slot: number, basic: boolean, sp: Set<SpecialId>, extraSt: Partial<Record<StatusId, number>> = {}): DamageInfo {
    const d = makeDamage();
    const el = act.el ?? 'phys';
    d.el = el;
    d.weaponId = EL_FX[el];
    const gear = this.run.loot.totals;
    d.damage = (act.dmg ?? 0) * mul * (1 + (gear.elem[el] ?? 0)) * (basic ? 1 : 1 + gear.skillDmg);
    d.knockback = act.knock ?? (basic ? 0.5 : 0.8);
    d.source = basic ? SOURCE_BASIC : SOURCE_SKILL;
    d.critChance = this.buff.crit + (sp.has('crit') ? 0.25 : 0) + (this.hasMod('m_assassin') ? 0.12 : 0);
    d.critDamage = 1.6;
    const st: Partial<Record<StatusId, number>> = {};
    if (act.st) st[act.st] = act.stp ?? ST_DEFAULT[act.st];
    for (const k in extraSt) {
      const id = k as StatusId;
      st[id] = (st[id] ?? 0) + (st[id] !== undefined ? extraSt[id]! : ST_DEFAULT[id]);
    }
    if (!basic) {
      if (this.hasMod('m_pyro')) st.burn = Math.max(st.burn ?? 0, ST_DEFAULT.burn);
      if (this.hasMod('m_frost')) {
        st.slow = st.slow ?? ST_DEFAULT.slow;
        if (!st.freeze) {
          d.freeze = 0.15;
          d.freezeDur = 1.2;
        }
      }
      if (this.hasMod('m_hexer')) st.curse = Math.max(st.curse ?? 0, 4);
    }
    if (this.hasMod('m_plague')) st.poison = Math.max(st.poison ?? 0, 4) * 1.3;
    const lv = this.levelMul;
    const jail = this.hasMod('m_jailer') ? 1.4 : 1;
    for (const k in st) {
      const v = st[k as StatusId]!;
      switch (k as StatusId) {
        case 'burn':
          d.burn = v * lv * (this.hasMod('m_pyro') ? 1.15 : 1);
          d.burnDur = 3;
          break;
        case 'poison':
          d.poison = v * lv;
          d.poisonDur = 4;
          break;
        case 'bleed':
          d.bleed = v * lv;
          d.bleedDur = 4;
          break;
        case 'slow':
          d.slow = Math.max(0.2, 1 - v);
          d.slowDur = 2;
          break;
        case 'freeze':
          d.freeze = 1;
          d.freezeDur = v * jail;
          break;
        case 'stun':
          d.stun = v * jail;
          break;
        case 'curse':
          d.curse = v;
          break;
        case 'weaken':
          d.weaken = v;
          break;
      }
    }
    this.meta.set(d, { slot, basic, sp });
    return d;
  }

  /** Extra damage multiplier against an enemy for typed damage (called by Combat). */
  damageMulVs(e: Enemy, info: DamageInfo): number {
    let m = 1;
    const meta = this.meta.get(info);
    if (this.kit.mechanic.id === 'mark' && e.markT > 0 && meta && !meta.basic) m *= 1.3;
    if (this.hasMod('m_inferno') && e.burnT > 0) m *= 1.25;
    if (this.hasMod('m_shatter') && (e.freezeT > 0 || e.stunT > 0)) m *= 1.35;
    const low = e.hp < e.maxHp * 0.3;
    if (low && this.hasMod('m_executioner')) m *= 1.6;
    if (low && meta?.sp.has('execute')) m *= 2;
    return m;
  }

  /** Typed damage landed (called by Combat after damage is applied). */
  onHit(e: Enemy, info: DamageInfo, dmg: number, crit: boolean) {
    const run = this.run;
    const meta = this.meta.get(info);
    if (!meta) return;
    if (meta.basic) {
      this.gain(this.kit.res.onHit);
      if (this.kit.mechanic.id === 'mark') e.markT = 4;
    } else {
      if (meta.sp.has('refund') && meta.slot >= 0) this.cds[meta.slot] = Math.max(0, this.cds[meta.slot] - 0.3);
      if (meta.sp.has('shock') && Math.random() < 0.35) this.chainFrom(e, info.damage * 0.35, 2, 'lightning');
    }
    let leech = this.buff.lifesteal;
    if (meta.sp.has('leech')) leech += 0.08;
    if (!meta.basic && this.hasMod('m_vampire')) leech += 0.04;
    if (leech > 0) run.player.heal(Math.min(dmg * leech, run.player.stats.maxHp * 0.04), true);
    if (crit && this.hasMod('m_assassin')) {
      e.bleedDps = Math.max(e.bleedDps, 5 * this.levelMul);
      e.bleedT = Math.max(e.bleedT, 3);
    }
    if (this.hasMod('m_conduit') && info.el !== 'lightning' && Math.random() < 0.15) this.chainFrom(e, info.damage * 0.5, 3, 'lightning');
  }

  onKill(e: Enemy) {
    const run = this.run;
    this.gain(this.kit.res.onKill);
    if (this.kit.mechanic.id === 'harvest' && !e.boss) {
      this.harvest++;
      if (this.harvest >= 6) {
        this.harvest = 0;
        this.spawnSkeleton(e.x, e.z, 10 * this.levelMul, 10);
      }
    }
    if (run.player.stats.lifesteal > 0) {
      // handled by Combat.killEnemy
    }
  }

  /** Damage taken by the hero (after armor). */
  onHurt(dmg: number) {
    this.gain(dmg * this.kit.res.onHurt);
  }

  gain(v: number) {
    if (this.kit.res.id === 'heat' || v <= 0) return;
    this.res = Math.min(this.resMax, this.res + v);
  }

  // ------------------------------------------------------------------ basic attack
  private basicAttack(ax: number, az: number) {
    const run = this.run;
    const p = run.player;
    const b = this.kit.basic;
    this.basicCd = b.interval / (1 + this.buff.atkSpeed);
    const sp = new Set<SpecialId>();
    let act = b.act;
    let mul = this.levelMul * this.heatMul;
    if (this.kit.mechanic.id === 'spark' && this.kindle) {
      // Kindle: an empowered exploding fireball after a skill
      this.kindle = false;
      act = { ...act, dmg: (act.dmg ?? 0) * 2.2, explode: 2.2, st: 'burn', stp: 6 };
    }
    this.basicCount++;
    if (this.kit.mechanic.id === 'flow' && this.basicCount % 3 === 0) {
      act = { ...act, range: (act.range ?? 2) + 1.6, arc: 150, dmg: (act.dmg ?? 0) * 1.8, knock: 2 };
      for (let i = 0; i < 3; i++) this.cds[i] = Math.max(0, this.cds[i] - 0.5);
      run.effects.add('ring', p.x, p.z, 0.3, 0xffe8b0).r = 2.6;
    }
    mul *= 1;
    const info = this.makeInfo(act, mul, -1, true, sp);
    p.cues.attack++;
    p.cues.aim = true;
    const [dx, dz] = this.dirTo(ax, az);
    p.cues.aimX = dx;
    p.cues.aimZ = dz;
    p.attackPulse = 0.2;
    run.fx.sound(act.k === 'proj' && act.vis === 'arrow' ? 'bow' : act.k === 'cone' ? 'whoosh' : EL_SFX[act.el ?? 'phys'], 0.35);
    this.runAct(act, info, ax, az, 1, 0);
  }

  // ------------------------------------------------------------------ skills
  cast(slot: number, ax: number, az: number): boolean {
    const run = this.run;
    const p = run.player;
    const def = this.skill(slot);
    if (this.level(slot) <= 0) {
      this.denied[slot] = 0.3;
      return false;
    }
    if (this.cds[slot] > 0) {
      this.denied[slot] = 0.3;
      return false;
    }
    if (!this.affordable(slot)) {
      this.denied[slot] = 0.3;
      run.fx.text(p.x, p.z, run.tr('arpg_no_res').replace('{res}', run.tr('res_' + this.kit.res.id)), 0xa0b0ff);
      run.fx.sound('denied', 0.4);
      return false;
    }
    const up = this.ups(slot);
    const cost = this.costOf(slot);
    if (this.kit.res.id === 'heat') this.res = Math.max(0, Math.min(this.kit.res.max, this.res + cost));
    else this.res -= cost;
    this.cds[slot] = this.cdMax[slot] = this.cooldownOf(slot);
    this.flash[slot] = 0.35;
    run.stats.skillsCast++;
    const [dx, dz] = this.dirTo(ax, az);
    if (def.lock) {
      this.lockT = def.lock;
      this.lockX = dx;
      this.lockZ = dz;
    }
    p.cues.ability++;
    p.cues.aim = true;
    p.cues.aimX = dx;
    p.cues.aimZ = dz;
    const ultMul = slot === 3 ? 1 : 1;
    const mul = this.levelMul * this.heatMul * up.dmg * ultMul;
    for (const act of def.acts) {
      const info = this.makeInfo(act, mul, slot, false, up.sp, act.dmg ? up.st : {});
      this.runAct(act, info, ax, az, up.area, up.count, up.dur, up.sp);
    }
    if (up.sp.has('echo')) {
      run.later(0.45, () => {
        if (p.dead) return;
        for (const act of def.acts) {
          if (act.k === 'dash' || act.k === 'blink' || act.k === 'buff' || act.k === 'heal' || act.k === 'summon' || act.k === 'turret') continue;
          const info = this.makeInfo(act, mul * 0.6, slot, false, up.sp, act.dmg ? up.st : {});
          this.runAct(act, info, ax, az, up.area, up.count, up.dur, up.sp);
        }
      });
    }
    if (up.sp.has('barrier')) p.buffs.aegis = Math.max(p.buffs.aegis, 1.2);
    if (this.kit.mechanic.id === 'spark') this.kindle = true;
    if (this.kit.mechanic.id === 'grace') p.heal(p.stats.maxHp * 0.03);
    if (this.hasMod('m_arcane')) this.gain(8);
    run.fx.sound(slot === 3 ? 'evolution' : EL_SFX[def.acts.find((a) => a.el)?.el ?? 'phys'], 0.7);
    return true;
  }

  private dirTo(ax: number, az: number): [number, number] {
    const p = this.run.player;
    let dx = ax - p.x;
    let dz = az - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.01) return [p.fx, p.fz];
    dx /= l;
    dz /= l;
    return [dx, dz];
  }

  /** Clamps the cursor to a cast range from the hero. */
  private target(ax: number, az: number, range: number): [number, number] {
    const p = this.run.player;
    if (range <= 0) return [p.x, p.z];
    const dx = ax - p.x;
    const dz = az - p.z;
    const l = Math.hypot(dx, dz);
    if (l <= range) return [ax, az];
    return [p.x + (dx / l) * range, p.z + (dz / l) * range];
  }

  private runAct(act: Act, info: DamageInfo, ax: number, az: number, area = 1, extra = 0, dur = 1, sp: Set<SpecialId> = new Set()) {
    const run = this.run;
    const p = run.player;
    const st = p.stats;
    const ar = area * st.area;
    const color = act.color ?? EL_COLOR[info.el || 'phys'];
    const n = Math.max(1, (act.n ?? 1) + extra);
    switch (act.k) {
      case 'cone': {
        const every = act.every ?? 0;
        for (let i = 0; i < n; i++) {
          const go = () => {
            if (p.dead) return;
            const [dx, dz] = this.dirTo(run.ctl.aimX, run.ctl.aimZ);
            this.cone(p.x, p.z, dx, dz, (act.range ?? 2.5) * Math.sqrt(ar), ((act.arc ?? 120) * Math.PI) / 180, info, color);
          };
          if (i === 0 || every <= 0) go();
          else run.later(i * every, go);
        }
        break;
      }
      case 'proj': {
        const [dx, dz] = this.dirTo(ax, az);
        const spread = ((act.spread ?? (n > 1 ? 12 * (n - 1) : 0)) * Math.PI) / 180;
        const base = Math.atan2(dz, dx);
        const speed = act.speed ?? 16;
        const life = (act.range ?? 12) / speed;
        for (let i = 0; i < n; i++) {
          const a = n > 1 ? base - spread / 2 + (spread * i) / (n - 1) : base;
          const pr = run.projectiles.spawn(null, p.x + Math.cos(a) * 0.5, p.z + Math.sin(a) * 0.5, Math.cos(a) * speed, Math.sin(a) * speed, life, act.vis ?? 'bolt', color);
          Object.assign(pr.dmg, info);
          this.meta.set(pr.dmg, this.meta.get(info)!);
          pr.pierce = (act.pierce ?? 0) + (sp.has('pierce') ? 2 : 0);
          pr.radius = (act.r ?? 0.35) * Math.sqrt(ar);
          pr.scale = act.r ? Math.max(1, act.r) : 1;
          pr.glow = 1;
          if (act.r && act.pierce === -1) pr.hitEvery = 0.35;
          if (act.explode) {
            const er = act.explode * Math.sqrt(ar);
            const boom = (x: number, z: number) => this.blast(x, z, er, pr.dmg, color, 0.6);
            pr.hook = { expire: (q) => boom(q.x, q.z) };
          }
        }
        break;
      }
      case 'nova': {
        const r = (act.r ?? 3) * ar;
        const every = act.every ?? 0;
        for (let i = 0; i < n; i++) {
          const go = () => {
            if (p.dead) return;
            if (sp.has('pull')) this.pullIn(p.x, p.z, r * 1.4, 6);
            this.blast(p.x, p.z, r, info, color, 1);
          };
          if (i === 0 || every <= 0) go();
          else run.later(i * every, go);
        }
        break;
      }
      case 'ground': {
        const [tx, tz] = this.target(ax, az, act.range ?? 10);
        const r = (act.r ?? 2) * ar;
        const delay = act.delay ?? 0.4;
        const every = act.every ?? 0;
        const spread = act.spread ?? 0;
        for (let i = 0; i < n; i++) {
          let gx = tx;
          let gz = tz;
          if (spread > 0 && (n > 1 || i > 0)) {
            const a = Math.random() * TAU;
            const d = Math.sqrt(Math.random()) * spread;
            gx += Math.cos(a) * d;
            gz += Math.sin(a) * d;
          }
          const start = i * every;
          const warn = () => {
            const w = run.effects.add('warn', gx, gz, delay, color);
            w.r = r;
          };
          if (start > 0) run.later(start, warn);
          else warn();
          run.later(start + delay, () => {
            if (act.dur) {
              this.lasting.push({ x: gx, z: gz, r, t: act.dur * dur * st.duration, every: act.every ?? 0.5, acc: 0, info, pull: sp.has('pull'), turret: false, range: 0, vis: act.vis ?? '', color, fxColor: color, el: info.el || 'phys' });
              const a = run.effects.add('aura', gx, gz, act.dur * dur * st.duration, color);
              a.r = r;
              if (act.vis === 'cloud') run.effects.add('cloud', gx, gz, act.dur * dur * st.duration, color).r = r;
            } else {
              if (sp.has('pull')) this.pullIn(gx, gz, r * 1.6, 7);
              this.blast(gx, gz, r, info, color, 1);
              if (act.vis === 'meteor') {
                run.fx.burst(gx, 2, gz, 0xff8a2a, 22, 6, 0.22, 0.7, 'glow');
                run.fx.burst(gx, 0.4, gz, 0x5a3a2a, 12, 5, 0.16, 0.6, 'debris');
                run.fx.shake(0.18);
              }
              if (sp.has('trail')) this.lasting.push({ x: gx, z: gz, r: r * 0.8, t: 3, every: 0.5, acc: 0, info: this.dotInfo(info, 0.25), pull: false, turret: false, range: 0, vis: '', color, fxColor: 0xff6a1a, el: 'fire' });
            }
          });
        }
        break;
      }
      case 'dash': {
        const hits = n;
        const dist = act.range ?? 6;
        const r = (act.r ?? 1.2) * Math.sqrt(ar);
        let k = 0;
        const step = () => {
          if (p.dead) return;
          let [dx, dz] = this.dirTo(ax, az);
          if (hits > 1) {
            // multi-dash: hop between nearby foes
            const e = run.enemies.randomInRadius(p.x, p.z, dist + 2, true);
            if (e) [dx, dz] = this.dirTo(e.x, e.z);
            p.buffs.aegis = Math.max(p.buffs.aegis, 0.3);
          }
          const d = hits > 1 ? Math.min(dist, Math.hypot(ax - p.x, az - p.z) + 2) : Math.min(dist, Math.max(2.5, Math.hypot(ax - p.x, az - p.z)));
          p.dash(dx, dz, hits > 1 ? dist : d, 0.18, r, info, color);
          if (sp.has('trail')) run.later(0.1, () => this.lasting.push({ x: p.x, z: p.z, r: 1.6, t: 3, every: 0.5, acc: 0, info: this.dotInfo(info, 0.25), pull: false, turret: false, range: 0, vis: '', color, fxColor: 0xff6a1a, el: 'fire' }));
          if (++k < hits) run.later(0.22, step);
        };
        step();
        break;
      }
      case 'blink': {
        const [tx, tz] = this.target(ax, az, act.range ?? 8);
        p.blinkTo(tx, tz, color);
        break;
      }
      case 'buff': {
        this.buffs.push({ b: { ...act.buff }, t: (act.dur ?? 5) * dur * st.duration });
        if ((act.buff?.armor ?? 0) >= 999) p.buffs.aegis = Math.max(p.buffs.aegis, (act.dur ?? 1) * dur);
        const a = run.effects.add('ring', p.x, p.z, 0.5, color);
        a.r = 1.8;
        a.follow = true;
        run.fx.burst(p.x, 1, p.z, color, 16, 3, 0.16, 0.6, 'glow');
        break;
      }
      case 'heal': {
        p.heal(p.stats.maxHp * (act.heal ?? 0.1));
        run.fx.burst(p.x, 1, p.z, 0x6bff8a, 14, 3, 0.14, 0.7, 'glow');
        break;
      }
      case 'summon': {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          this.spawnSkeleton(p.x + Math.cos(a) * 1.5, p.z + Math.sin(a) * 1.5, info.damage, (act.dur ?? 12) * dur * st.duration);
        }
        break;
      }
      case 'chain': {
        const [tx, tz] = this.target(ax, az, act.range ?? 10);
        const first = run.enemies.nearest(tx, tz, 3.5, undefined, true) ?? run.enemies.nearest(p.x, p.z, act.range ?? 10, undefined, true);
        if (!first) {
          const b = run.effects.add('bolt', p.x, tx, 0.2, color);
          b.z = p.z;
          b.y = 1;
          b.x2 = tx;
          b.z2 = tz;
          b.w = 0.08;
          break;
        }
        this.chainHops(p.x, p.z, first, info, n, color);
        break;
      }
      case 'beam': {
        const [dx, dz] = this.dirTo(ax, az);
        const len = act.range ?? 10;
        const w = (act.r ?? 0.8) * Math.sqrt(ar);
        let ex = p.x + dx * len;
        let ez = p.z + dz * len;
        const t = run.terrain.shotRay(p.x, p.z, ex, ez);
        if (t < 1) {
          ex = p.x + (ex - p.x) * t;
          ez = p.z + (ez - p.z) * t;
        }
        const L = Math.hypot(ex - p.x, ez - p.z);
        run.enemies.forEachInRadius(p.x + dx * L * 0.5, p.z + dz * L * 0.5, L * 0.5 + w + 1, (e) => {
          const rx = e.x - p.x;
          const rz = e.z - p.z;
          const along = rx * dx + rz * dz;
          if (along < 0 || along > L) return;
          const perp = Math.abs(rx * dz - rz * dx);
          if (perp > w + e.radius) return;
          run.combat.hit(e, info, 1, dx, dz);
        });
        const b = run.effects.add('beam', p.x, p.z, 0.3, color);
        b.x2 = ex;
        b.z2 = ez;
        b.y = 1;
        b.w = w;
        break;
      }
      case 'pull': {
        const [tx, tz] = this.target(ax, az, act.range ?? 10);
        this.pullIn(tx, tz, (act.r ?? 3) * ar, 8);
        break;
      }
      case 'turret': {
        const [tx, tz] = this.target(ax, az, 9);
        for (let i = 0; i < n; i++) {
          let gx = tx;
          let gz = tz;
          if (n > 1) {
            const a = (i / n) * TAU;
            gx += Math.cos(a) * (act.spread ?? 2);
            gz += Math.sin(a) * (act.spread ?? 2);
          }
          if (run.terrain.blocksWalker(Math.floor(gx), Math.floor(gz))) {
            gx = tx;
            gz = tz;
          }
          const life = (act.dur ?? 10) * dur * st.duration;
          this.lasting.push({ x: gx, z: gz, r: 0.6, t: life, every: act.every ?? 0.5, acc: 0, info, pull: false, turret: true, range: act.range ?? 6, vis: act.vis ?? 'dagger', color, fxColor: color, el: info.el || 'phys' });
          const a = run.effects.add('aura', gx, gz, life, color);
          a.r = 0.7;
          run.fx.burst(gx, 0.6, gz, color, 12, 3, 0.14, 0.5, 'debris');
        }
        break;
      }
    }
  }

  private dotInfo(src: DamageInfo, mul: number): DamageInfo {
    const d = makeDamage();
    d.el = 'fire';
    d.weaponId = EL_FX.fire;
    d.damage = src.damage * mul;
    d.burn = Math.max(4, src.damage * 0.15);
    d.burnDur = 2;
    d.knockback = 0;
    d.source = SOURCE_SKILL;
    this.meta.set(d, { slot: -1, basic: false, sp: new Set() });
    return d;
  }

  private cone(x: number, z: number, dx: number, dz: number, range: number, arc: number, info: DamageInfo, color: number) {
    const run = this.run;
    const half = arc / 2;
    const cosH = Math.cos(half);
    run.enemies.forEachInRadius(x, z, range + 0.6, (e) => {
      const rx = e.x - x;
      const rz = e.z - z;
      const d = Math.hypot(rx, rz);
      if (d > range + e.radius) return;
      if (d > 0.6 && (rx * dx + rz * dz) / d < cosH) return;
      if (d > 1.2 && !run.terrain.los(x, z, e.x, e.z)) return;
      run.combat.hit(e, info, 1, rx || dx, rz || dz);
    });
    const s = run.effects.add('slash', x, z, 0.22, color);
    s.angle = Math.atan2(dz, dx);
    s.arc = arc;
    s.r = range;
  }

  /** Damage in a circle (with a ring effect). */
  blast(x: number, z: number, r: number, info: DamageInfo, color: number, fxMul: number) {
    const run = this.run;
    run.enemies.forEachInRadius(x, z, r, (e) => {
      if (!run.terrain.los(x, z, e.x, e.z)) return;
      run.combat.hit(e, info, 1, e.x - x, e.z - z);
    });
    const ring = run.effects.add('ring', x, z, 0.4, color);
    ring.r = r;
    if (fxMul > 0) {
      const f = run.effects.add('flash', x, z, 0.25, color);
      f.r = r * 0.5;
      run.fx.burst(x, 0.6, z, color, Math.round(10 * fxMul + r * 3), 3 + r, 0.15, 0.5, 'glow');
      run.fx.light(x, z, color, 2, r * 2.5, 0.25);
    }
  }

  private pullIn(x: number, z: number, r: number, force: number) {
    const run = this.run;
    run.enemies.forEachInRadius(x, z, r, (e) => {
      if (e.boss) return;
      const dx = x - e.x;
      const dz = z - e.z;
      const l = Math.hypot(dx, dz) || 1;
      const f = force * (1 - e.kbResist);
      e.kx += (dx / l) * f;
      e.kz += (dz / l) * f;
    });
    const ring = run.effects.add('ring', x, z, 0.5, 0xc0d0ff);
    ring.r = r;
  }

  private chainHops(fx: number, fz: number, first: Enemy, info: DamageInfo, n: number, color: number) {
    const run = this.run;
    const hit = new Set<number>();
    let cur: Enemy | null = first;
    let px = fx;
    let pz = fz;
    let delay = 0;
    for (let i = 0; i < n && cur; i++) {
      const e: Enemy = cur;
      hit.add(e.uid);
      const sx = px;
      const sz = pz;
      const go = () => {
        if (!e.alive) return;
        const b = run.effects.add('bolt', sx, sz, 0.22, color);
        b.y = i === 0 ? 1.1 : 0.8;
        b.x2 = e.x;
        b.z2 = e.z;
        b.w = 0.07;
        run.combat.hit(e, info, i === 0 ? 1 : 0.85, e.x - sx, e.z - sz);
        if (this.kit.mechanic.id === 'static' && Math.random() < 0.2) e.stunT = Math.max(e.stunT, e.boss ? 0.2 : 0.8);
      };
      if (delay <= 0) go();
      else run.later(delay, go);
      delay += 0.05;
      px = e.x;
      pz = e.z;
      cur = run.enemies.nearest(px, pz, 5, hit, true);
    }
  }

  private chainFrom(e: Enemy, dmg: number, n: number, el: DmgType) {
    const info = makeDamage();
    info.el = el;
    info.weaponId = EL_FX[el];
    info.damage = dmg;
    info.knockback = 0;
    info.source = SOURCE_SKILL;
    const hit = new Set<number>([e.uid]);
    const next = this.run.enemies.nearest(e.x, e.z, 5, hit, true);
    if (next) this.chainHops(e.x, e.z, next, info, n, EL_COLOR[el]);
  }

  private spawnSkeleton(x: number, z: number, dmg: number, life: number) {
    const run = this.run;
    const d = makeDamage();
    d.damage = dmg;
    d.el = 'dark';
    d.weaponId = EL_FX.dark;
    d.knockback = 0.4;
    d.source = 22;
    this.meta.set(d, { slot: -1, basic: false, sp: new Set() });
    const cap = 14;
    let alive = run.allies.count(ALLY_GROUP);
    if (alive >= cap) {
      // replace the oldest
      const old = run.allies.list.filter((a) => a.active && a.group === ALLY_GROUP).sort((a, b) => a.life - b.life)[0];
      if (old) old.life = 0.01;
      alive--;
    }
    if (run.terrain.blocksWalker(Math.floor(x), Math.floor(z))) {
      x = run.player.x;
      z = run.player.z;
    }
    run.allies.spawn(x, z, life, 6.5, d, 0.7, 'ally_skeleton', ALLY_GROUP, 1.05);
  }

  private updateLasting(dt: number) {
    const run = this.run;
    let w = 0;
    for (const l of this.lasting) {
      l.t -= dt;
      if (l.t <= 0) continue;
      this.lasting[w++] = l;
      l.acc -= dt;
      if (l.acc > 0) continue;
      l.acc += l.every;
      if (l.turret) {
        const e = run.enemies.nearest(l.x, l.z, l.range, undefined, true);
        if (!e) continue;
        const dx = e.x - l.x;
        const dz = e.z - l.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = 20;
        const pr = run.projectiles.spawn(null, l.x, l.z, (dx / d) * sp, (dz / d) * sp, (l.range + 1) / sp, l.vis, l.color);
        Object.assign(pr.dmg, l.info);
        this.meta.set(pr.dmg, this.meta.get(l.info) ?? { slot: -1, basic: false, sp: new Set() });
        pr.y = 1;
        run.fx.burst(l.x, 1, l.z, l.color, 3, 2, 0.08, 0.2, 'glow');
      } else {
        if (l.pull) this.pullIn(l.x, l.z, l.r * 1.3, 3);
        if (l.vis === 'cloud') {
          // storm: strike a random foe inside
          const e = run.enemies.randomInRadius(l.x, l.z, l.r, false);
          if (e) {
            const b = run.effects.add('bolt', e.x, e.z, 0.25, l.color);
            b.y = 6;
            b.x2 = e.x;
            b.z2 = e.z;
            b.w = 0.09;
            this.blast(e.x, e.z, 1.3, l.info, l.color, 0.3);
          }
        } else {
          run.enemies.forEachInRadius(l.x, l.z, l.r, (e) => {
            run.combat.hit(e, l.info, 1, 0, 0);
          });
          if (run.fx.level() >= 1) run.fx.burst(l.x, 0.3, l.z, l.fxColor, 5, 1.5, 0.12, 0.5, l.el === 'poison' ? 'smoke' : 'glow');
        }
      }
    }
    this.lasting.length = w;
  }

  /** Fizzwick at full Volatility: a huge blast that also hurts him. */
  private overload() {
    const run = this.run;
    const p = run.player;
    this.res = 0;
    const d = makeDamage();
    d.el = 'poison';
    d.weaponId = EL_FX.poison;
    d.damage = 90 * this.levelMul * 1.6;
    d.knockback = 3;
    d.poison = 12 * this.levelMul;
    d.poisonDur = 4;
    d.source = SOURCE_SKILL;
    this.meta.set(d, { slot: -1, basic: false, sp: new Set() });
    this.blast(p.x, p.z, 4.5, d, 0xb0ff60, 2);
    run.fx.shake(0.5);
    run.fx.text(p.x, p.z, run.tr('arpg_overload'), 0xd0ff60);
    p.hurt(p.stats.maxHp * 0.15, null, true);
  }

  // ------------------------------------------------------------------ dodge
  dodgeCooldown(): number {
    return 3 * Math.pow(0.85, this.dodgeLevel) * (this.hasMod('m_swift') ? 0.7 : 1);
  }

  private dodge(c: Controls) {
    const run = this.run;
    const p = run.player;
    if (this.dodgeCd > 0 || p.dashT > 0) {
      this.denied[4] = 0.3;
      return;
    }
    let dx = p.moveDirX;
    let dz = p.moveDirZ;
    if (Math.hypot(dx, dz) < 0.1) [dx, dz] = this.dirTo(c.aimX, c.aimZ);
    const l = Math.hypot(dx, dz) || 1;
    this.dodgeCd = this.dodgeMax = this.dodgeCooldown();
    this.flash[4] = 0.35;
    p.dash(dx / l, dz / l, 4.6 + this.dodgeLevel * 0.3, 0.2, 0, null, 0xd8f0ff);
    p.invulnT = Math.max(p.invulnT, 0.32);
    p.clearPath();
    run.stats.dodges++;
    run.fx.sound('dash', 0.5);
  }

  // ------------------------------------------------------------------ stats from choices
  statMods(): StatMods {
    const out: StatMods = {};
    const base = this.run.hero.baseHp;
    for (const [id, n] of this.statUps) {
      const s = STAT_UPS.find((x) => x.id === id);
      if (!s) continue;
      const v = s.stat === 'maxHp' ? s.v * base : s.v;
      out[s.stat] = (out[s.stat] ?? 0) + v * n;
    }
    if (this.hasMod('m_juggernaut')) {
      out.maxHp = (out.maxHp ?? 0) + base * 0.25;
      out.armor = (out.armor ?? 0) + 3;
      out.moveSpeed = (out.moveSpeed ?? 0) - 0.08;
    }
    return out;
  }

  // ------------------------------------------------------------------ level-up choices
  /** Level reached at the level-up currently being chosen. */
  private get choiceLevel(): number {
    const p = this.run.player;
    return p.level - p.pendingLevels + 1;
  }

  /** True when this level-up is the Ultimate prompt (level 6, not yet decided). */
  get ultPrompt(): boolean {
    return this.ultLevel === 0 && !this.ultDeclined && this.choiceLevel >= ULT_LEVEL;
  }

  rollChoices(): Choice[] {
    const run = this.run;
    if (this.ultPrompt) return [{ kind: 'ult_learn', id: 'yes', level: 1, rarity: 'legendary' }, { kind: 'ult_decline', id: 'no', level: 0, rarity: 'common' }];
    const pool: { c: Choice; w: number }[] = [];
    const rar = (lv: number): Rarity => (lv >= 6 ? 'legendary' : lv >= 5 ? 'epic' : lv >= 4 ? 'rare' : lv >= 3 ? 'uncommon' : 'common');
    for (let i = 0; i < 3; i++) if (this.levels[i] < SKILL_MAX) pool.push({ c: { kind: 'skill_up', id: String(i), level: this.levels[i] + 1, rarity: rar(this.levels[i] + 1) }, w: 12 });
    if (this.ultLevel === 0 && this.ultDeclined && this.choiceLevel >= ULT_LEVEL) pool.push({ c: { kind: 'ult_learn', id: 'yes', level: 1, rarity: 'legendary' }, w: 30 });
    for (const s of STAT_UPS) if (!run.leveling.banished.has(s.id)) pool.push({ c: { kind: 'stat', id: s.id, level: (this.statUps.get(s.id) ?? 0) + 1, rarity: 'common' }, w: 3 });
    if (this.dodgeLevel < 4) pool.push({ c: { kind: 'dodge_up', id: 'dodge', level: this.dodgeLevel + 1, rarity: 'uncommon' }, w: 4 });
    for (const m of MODS) if (!this.hasMod(m.id) && !run.leveling.banished.has(m.id)) pool.push({ c: { kind: 'mod', id: m.id, level: 1, rarity: 'epic' }, w: this.mods.size >= 4 ? 1 : 3.5 });
    for (const def of PASSIVES) {
      if (!run.unlockedPassives.has(def.id) || run.leveling.banished.has(def.id)) continue;
      const lv = run.passives.level(def.id);
      if (lv >= def.maxLevel) continue;
      if (lv === 0 && run.passives.count >= 6) continue;
      pool.push({ c: { kind: lv ? 'passive_up' : 'passive_new', id: def.id, level: lv + 1, rarity: def.rarity }, w: 1.2 });
    }
    const picks: Choice[] = [];
    // always offer at least one skill upgrade while any remain
    const skills = pool.filter((o) => o.c.kind === 'skill_up');
    if (skills.length) {
      const s = run.rng.pick(skills);
      picks.push(s.c);
      pool.splice(pool.indexOf(s), 1);
    }
    const want = 4;
    while (picks.length < want && pool.length) {
      const it = run.rng.weighted(pool, (o) => o.w);
      if (!it) break;
      // one stat card at most
      if (it.c.kind === 'stat' && picks.some((p) => p.kind === 'stat')) {
        pool.splice(pool.indexOf(it), 1);
        continue;
      }
      picks.push(it.c);
      pool.splice(pool.indexOf(it), 1);
    }
    if (!picks.length) picks.push({ kind: 'heal', id: 'heal', level: 0, rarity: 'common' }, { kind: 'gold', id: 'gold', level: 0, rarity: 'common' });
    return picks;
  }

  /** Applies a level-up choice. Returns true when it consumed the level (decline does not). */
  apply(c: Choice): boolean {
    const run = this.run;
    switch (c.kind) {
      case 'skill_up': {
        const i = +c.id;
        this.levels[i] = Math.min(SKILL_MAX, this.levels[i] + 1);
        break;
      }
      case 'ult_learn':
        this.ultLevel = 1 + this.ultBank;
        this.cds[3] = 0;
        run.fx.text(run.player.x, run.player.z, run.tr('arpg_ult_learned'), 0xffd060);
        break;
      case 'ult_decline':
        this.ultDeclined = true;
        return false;
      case 'stat':
        this.statUps.set(c.id, (this.statUps.get(c.id) ?? 0) + 1);
        run.recomputeStats();
        break;
      case 'dodge_up':
        this.dodgeLevel++;
        break;
      case 'mod':
        this.mods.add(c.id);
        run.recomputeStats();
        break;
      case 'passive_new':
      case 'passive_up':
        if (PASSIVE_BY_ID[c.id]) {
          run.passives.add(c.id);
          run.recomputeStats();
        }
        break;
      case 'gold':
        run.stats.gold += 5 * run.player.stats.greed;
        break;
      case 'heal':
        run.player.heal(run.player.stats.maxHp * 0.3);
        break;
    }
    return true;
  }

  /** Called when the hero reaches a new level (before choosing). */
  onLevel(level: number) {
    if (ULT_UP_LEVELS.includes(level)) {
      if (this.ultLevel > 0) {
        this.ultLevel = Math.min(4, this.ultLevel + 1);
        this.run.fx.text(this.run.player.x, this.run.player.z, this.run.tr('arpg_ult_up'), 0xffd060);
      } else this.ultBank++;
    }
  }

  /** Experience past the level cap: heals, refills the resource and pays gold. */
  onOverflow() {
    const run = this.run;
    this.overflow++;
    run.player.heal(run.player.stats.maxHp * 0.25);
    if (this.kit.res.id !== 'heat') this.res = this.resMax;
    run.stats.gold += 5;
    run.fx.text(run.player.x, run.player.z, run.tr('arpg_overflow'), 0x8affff);
  }

  /** Whether a skill point can go into a slot now (0..2 skills, 3 Ultimate, 4 dodge). */
  canLearn(slot: number): boolean {
    if (this.points <= 0) return false;
    if (slot < 3) return this.levels[slot] < SKILL_MAX;
    if (slot === 3) return this.ultLevel === 0 && this.run.player.level >= ULT_LEVEL;
    return this.dodgeLevel < 4;
  }

  learn(slot: number): boolean {
    if (!this.canLearn(slot)) return false;
    this.points--;
    const run = this.run;
    if (slot < 3) this.apply({ kind: 'skill_up', id: String(slot), level: this.levels[slot] + 1, rarity: 'common' });
    else if (slot === 3) this.apply({ kind: 'ult_learn', id: 'yes', level: 1, rarity: 'legendary' });
    else this.apply({ kind: 'dodge_up', id: 'dodge', level: this.dodgeLevel + 1, rarity: 'common' });
    this.flash[slot] = 0.5;
    run.fx.sound('select', 0.7);
    run.fx.burst(run.player.x, 1, run.player.z, 0xffe080, 16, 3, 0.12, 0.5, 'glow');
    return true;
  }

  // ------------------------------------------------------------------ developer helpers
  devMaxAll() {
    for (let i = 0; i < 3; i++) this.levels[i] = SKILL_MAX;
    this.ultLevel = 4;
  }

  resetCooldowns() {
    this.cds.fill(0);
    this.dodgeCd = 0;
    this.basicCd = 0;
  }

  get maxLevel(): number {
    return MAX_LEVEL;
  }

  modName(id: string) {
    return MOD_BY_ID[id]?.name;
  }

  /** Whether the walk from the hero to a point is a straight clear line (for hold-to-move). */
  clear(ax: number, az: number): boolean {
    const p = this.run.player;
    return clearLine(this.run.terrain, p.x, p.z, ax, az);
  }
}
