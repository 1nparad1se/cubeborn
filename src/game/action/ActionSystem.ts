import type { StatMods } from '../../data/types';
import { TAU } from '../../core/math';
import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { makeDamage, type DamageInfo, type DmgType } from '../types';
import { L as loc } from '../../i18n';
import { classDef } from './classes';
import { Summons } from './Summons';
import { EL_STATUS, ST_DEFAULT, tripodsFor } from './tripods';
import {
  MAX_LEVEL, SKILL_MAX, TRIPOD_LEVELS,
  type ActionEv, type BuffEv, type ChainEv, type ClassDef, type HitEv, type MoveEv, type ProjEv, type Shape, type SkillDef,
  type StatusId, type Step, type SummonEv, type ZoneEv,
} from './types';
import { ActFxList } from './vfx';

/** Frame input for action combat, filled by the client (world space). */
export interface Controls {
  aimX: number;
  aimZ: number;
  /** Basic attack held. */
  attack: boolean;
  /** Walk toward the cursor (LMB held). */
  move: boolean;
  /** A new move click this frame. */
  click: boolean;
  stop: boolean;
  /** Slots pressed this frame: 0..7 = Q W E R A S D F, 8 = Ultimate, 9 = special. */
  casts: number[];
  /** Slots currently held (same indices) — hold and charge skills read these. */
  held: boolean[];
  dodge: boolean;
  identity: boolean;
}

export function makeControls(): Controls {
  return { aimX: 0, aimZ: 0, attack: false, move: false, click: false, stop: false, casts: [], held: new Array(10).fill(false), dodge: false, identity: false };
}

export const SLOT_ULT = 8;
export const SLOT_SPECIAL = 9;
const SRC_BASIC = 20;
const MELEE = new Set(['berserker', 'paladin', 'steelfist', 'deathblade', 'reaper', 'templar']);

/**
 * Basic-attack step-forward per melee class: distance in world units and the part of the
 * wind-up (time before the first hit) when the body travels. Ranged classes have none.
 */
const BASIC_STEP: Record<string, { dist: number; from: number; to: number }> = {
  berserker: { dist: 0.9, from: 0.35, to: 0.95 },
  paladin: { dist: 0.6, from: 0.25, to: 0.9 },
  steelfist: { dist: 0.45, from: 0.1, to: 0.7 },
  deathblade: { dist: 0.75, from: 0.1, to: 0.8 },
  reaper: { dist: 0.5, from: 0.15, to: 0.85 },
  templar: { dist: 0.7, from: 0.25, to: 0.9 },
};
const SRC_SKILL = 21;
const SRC_SUMMON = 22;

type Src = 'basic' | 'skill' | 'dodge' | 'identity';

interface Playing {
  src: Src;
  /** Skill slot (0..9) or -1. */
  slot: number;
  def: SkillDef | null;
  step: Step;
  /** Index of the step inside the skill (combo / hold phase / basic chain). */
  idx: number;
  phase: 'play' | 'charge' | 'cast';
  t: number;
  /** Events sorted by time and the next one to fire. */
  evs: ActionEv[];
  next: number;
  rate: number;
  dirX: number;
  dirZ: number;
  /** Aim point snapshot taken when the input was pressed; never re-read from the cursor. */
  tx: number;
  tz: number;
  /** Basic-attack step-forward: distance left to travel and its time window. */
  stepLeft?: number;
  stepFrom?: number;
  stepTo?: number;
  /** Damage multiplier (charge, tripods). */
  mul: number;
  stagMul: number;
  areaMul: number;
  extraSt: StatusId | null;
  superArmor: boolean;
  /** Charge / cast timer. */
  prep: number;
  /** Basic hits landed by this step (resource gains once per event). */
  gained: boolean;
}

interface Mover {
  kind: MoveEv['kind'];
  t: number;
  dur: number;
  sx: number;
  sz: number;
  ex: number;
  ez: number;
  info: DamageInfo | null;
  r: number;
  hitSet: Set<number>;
  fx: string;
  color: number;
}

interface Lasting {
  ev: ZoneEv;
  x: number;
  z: number;
  r: number;
  t: number;
  acc: number;
  info: DamageInfo;
  seal: boolean;
  trap: boolean;
}

interface ActiveBuff {
  b: BuffEv;
  t: number;
  mul: number;
}

const EL_COLOR: Record<DmgType, number> = { phys: 0xe8e0d0, fire: 0xff7a2a, ice: 0x8ae8ff, lightning: 0x8ad8ff, poison: 0x9cff4f, dark: 0xb070ff, magic: 0xffe08a };
const SFX_ALIAS: Record<string, string> = { roar: 'bossRoar', meteor: 'explosion', smash: 'slam' };
const EL_SFX: Record<DmgType, string> = { phys: 'slash', fire: 'fire', ice: 'ice', lightning: 'zap', poison: 'venom', dark: 'shadow', magic: 'magic' };
const EL_WEAPON: Record<DmgType, string> = { phys: 'el_physical', fire: 'el_fire', ice: 'el_ice', lightning: 'el_lightning', poison: 'el_poison', dark: 'el_dark', magic: 'el_holy' };

/** Sorted event lists are cached per step. */
const SORTED = new WeakMap<Step, ActionEv[]>();
function sortedEvents(s: Step): ActionEv[] {
  let e = SORTED.get(s);
  if (!e) {
    e = [...s.ev].sort((a, b) => a.t - b.t);
    SORTED.set(s, e);
  }
  return e;
}

/**
 * Lost-Ark-like action combat for the hero: plays timed skill scripts (combo / hold / charge / cast),
 * a basic attack chain, dodge, the class resource and Identity, the Awakening Ultimate, skill levels
 * with tripods, summons, lasting zones and stagger damage.
 */
export class ActionSystem {
  readonly cls: ClassDef;
  readonly fx = new ActFxList();
  readonly summons: Summons;
  res = 0;
  /** Skill levels Q..F (0 = locked). */
  readonly levels = [0, 0, 0, 0, 0, 0, 0, 0];
  /** Chosen tripods per skill [tier1, tier2] (-1 = none). */
  readonly tri: [number, number][] = Array.from({ length: 8 }, () => [-1, -1] as [number, number]);
  points = 0;
  /** Cooldowns: 0..7 skills, 8 Ultimate, 9 special. */
  readonly cds = new Array(10).fill(0);
  readonly cdMax = new Array(10).fill(1);
  dodgeCharges = 1;
  dodgeT = 0;
  /** Awakening gauge 0..100 (filled by fighting). */
  ult = 0;
  identityT = 0;
  stealthT = 0;
  shield = 0;
  shieldMax = 0;
  /** Shield from the Evasion legendary power: seconds left. */
  private evasionT = 0;
  /** Healing left this second from battle vigour (melee classes). */
  private vigour = 0;
  private vigourT = 0;
  /** HUD feedback timers per slot (0..9, 10 dodge, 11 identity, 12 basic). */
  readonly flash = new Array(13).fill(0);
  readonly denied = new Array(13).fill(0);
  /** Animation request for the renderer: name, play rate and a serial that ticks on each request. */
  readonly anim = { name: '', rate: 1, n: 0, loop: false };
  /** Current action (null = free). */
  cur: Playing | null = null;
  /** Hero is being moved by a skill (dash / leap / blink). */
  mover: Mover | null = null;
  /** Combo window: skill slot, next step index, time left. */
  private combo = { slot: -1, idx: 0, t: 0 };
  /** Basic chain: next step and the window left to continue it. */
  private basicIdx = 0;
  private basicT = 0;
  /** Buffered press (slot, -2 dodge, -3 identity) and its time left. */
  private buf = { slot: -1, t: 0, ax: 0, az: 0 };
  private buffs: ActiveBuff[] = [];
  readonly buff = { dmg: 0, speed: 0, atkSpeed: 0, armor: 0, dr: 0, crit: 0 };
  private counter: { ev: Omit<HitEv, 'do' | 't'>; cd: number } | null = null;
  private lasting: Lasting[] = [];
  /** Templar seals on the ground. */
  get seals(): number {
    let n = 0;
    for (const l of this.lasting) if (l.seal) n++;
    return n;
  }
  /** Hero recoils from a heavy hit (cannot act). */
  stunT = 0;
  /** Steel fist flow stacks / time. */
  private flow = 0;
  private flowT = 0;
  overflow = 0;

  constructor(private run: Run) {
    this.cls = classDef(run.hero.id);
    this.summons = new Summons(run);
    this.res = this.cls.res.startFull ? this.cls.res.max : 0;
    this.dodgeCharges = this.cls.dodge.charges;
    this.unlockSkills(1);
  }

  // ------------------------------------------------------------------ queries
  skill(slot: number): SkillDef | null {
    if (slot < 8) return this.cls.skills[slot];
    if (slot === SLOT_ULT) return this.cls.ult;
    return null;
  }

  level(slot: number): number {
    if (slot < 8) return this.levels[slot];
    if (slot === SLOT_ULT) return this.run.player.level >= this.cls.ult.unlock ? 1 : 0;
    return this.cls.special ? 1 : 0;
  }

  get resMax(): number {
    return this.cls.res.max + (this.cls.res.orbs ? 0 : this.run.loot.totals.resMax);
  }

  get maxLevel(): number {
    return MAX_LEVEL;
  }

  /** Orbs filled (orb classes). */
  get orbs(): number {
    const o = this.cls.res.orbs;
    if (!o) return 0;
    return Math.floor((this.res + 0.01) / (this.cls.res.max / o));
  }

  get busy(): boolean {
    return !!this.cur || !!this.mover || this.stunT > 0;
  }

  /** Movement allowed right now (0 rooted .. 1 free). */
  get moveMul(): number {
    if (this.mover || this.stunT > 0) return 0;
    const c = this.cur;
    if (!c) return 1;
    if (c.phase !== 'play') return c.phase === 'charge' ? 0.25 : 0;
    if (c.t >= (c.step.cancel ?? c.step.dur) && c.src === 'basic') return 1;
    return c.step.move ?? 0;
  }

  /** Facing the action locks the hero into (or null to face the cursor). */
  get facing(): [number, number] | null {
    const c = this.cur;
    if (this.mover || !c) return null;
    // a basic attack hands facing back to movement once its recovery can be cancelled
    if (c.src === 'basic' && c.phase === 'play' && c.t >= (c.step.cancel ?? c.step.dur) && this.run.player.moving) return null;
    return [c.dirX, c.dirZ];
  }

  get speedMul(): number {
    return 1 + this.buff.speed;
  }

  get armorBonus(): number {
    return this.buff.armor;
  }

  /** Is this the stagger-broken / super-armor phase of the current step? */
  get superArmor(): boolean {
    const c = this.cur;
    if (this.identityT > 0 && this.cls.identity.kind === 'bloodlust') return true;
    return !!c && (c.superArmor || c.step.armor === 'super' || (c.step.armor === 'push' && c.phase === 'play'));
  }

  tripod(slot: number, tier: number) {
    const s = this.cls.skills[slot];
    const i = this.tri[slot][tier];
    if (i < 0 || this.levels[slot] < TRIPOD_LEVELS[tier]) return null;
    return tripodsFor(s)[tier][i] ?? null;
  }

  /** Legendary power worn by the hero (gear). */
  has(power: string): boolean {
    return this.run.loot.powers.has(power);
  }

  /** Adds Awakening gauge (once the Ultimate is unlocked). */
  addUlt(v: number) {
    if (this.run.player.level < this.cls.ult.unlock) return;
    this.ult = Math.min(100, this.ult + v * (this.has('p_awaken') ? 1.4 : 1));
  }

  cooldownOf(slot: number): number {
    if (slot === SLOT_SPECIAL) return this.cls.special?.cd ?? 1;
    const s = this.skill(slot)!;
    let cd = s.cd * this.run.player.stats.cooldown;
    if (slot < 8 && this.tripod(slot, 0)?.kind === 'cd') cd *= 0.8;
    if (slot !== SLOT_ULT && this.has('p_haste')) cd *= 0.88;
    return cd;
  }

  costOf(slot: number): number {
    const s = this.skill(slot);
    if (!s || !s.cost || s.cost < 0) return 0;
    if (this.identityT > 0 && this.cls.identity.kind === 'awaken') return 0;
    return s.cost;
  }

  ready(slot: number): boolean {
    if (this.level(slot) <= 0) return false;
    if (slot === SLOT_ULT) return this.ult >= 100 || this.run.debug.noCd;
    if (this.cds[slot] > 0 && !this.comboOpen(slot)) return false;
    return this.res >= this.costOf(slot) - 0.01 || this.run.debug.infRes;
  }

  private comboOpen(slot: number): boolean {
    return this.combo.slot === slot && this.combo.t > 0;
  }

  /** Identity can be triggered (Z). */
  get identityReady(): boolean {
    if (this.identityT > 0) return false;
    if (this.cls.identity.kind === 'axis') return this.seals > 0;
    return this.res >= this.cls.identity.need - 0.01;
  }

  // ------------------------------------------------------------------ levels
  /** Gives level-1 to every skill whose unlock level is reached. */
  unlockSkills(level: number) {
    for (let i = 0; i < 8; i++) if (this.levels[i] === 0 && level >= this.cls.skills[i].unlock) this.levels[i] = 1;
  }

  onLevel(level: number) {
    this.points++;
    const before = this.levels.filter((l) => l > 0).length;
    this.unlockSkills(level);
    const run = this.run;
    if (this.levels.filter((l) => l > 0).length > before) run.fx.text(run.player.x, run.player.z, run.tr('act_new_skill'), 0xffe080);
    if (level === this.cls.ult.unlock) run.fx.text(run.player.x, run.player.z, run.tr('act_ult_open'), 0xffd060);
    // hero level raises health, armor and regeneration
    run.recomputeStats();
  }

  /** Front-line classes that fight in contact range. */
  get melee(): boolean {
    return MELEE.has(this.cls.id);
  }

  canLearn(slot: number): boolean {
    return this.points > 0 && slot < 8 && this.levels[slot] > 0 && this.levels[slot] < SKILL_MAX;
  }

  learn(slot: number): boolean {
    if (!this.canLearn(slot)) return false;
    this.points--;
    this.levels[slot]++;
    this.flash[slot] = 0.5;
    const run = this.run;
    run.fx.sound('select', 0.7);
    run.fx.burst(run.player.x, 1, run.player.z, 0xffe080, 16, 3, 0.12, 0.5, 'glow');
    return true;
  }

  setTripod(slot: number, tier: number, i: number): boolean {
    if (this.levels[slot] < TRIPOD_LEVELS[tier]) return false;
    this.tri[slot][tier] = i;
    return true;
  }

  onOverflow() {
    const run = this.run;
    this.overflow++;
    run.player.heal(run.player.stats.maxHp * 0.25);
    run.stats.gold += 5;
    run.fx.text(run.player.x, run.player.z, run.tr('arpg_overflow'), 0x8affff);
  }

  statMods(): StatMods {
    const lv = Math.max(0, (this.run.player?.level ?? 1) - 1);
    const m = this.melee ? 1 : 0;
    return {
      armor: this.cls.armor + lv * (0.15 + m * 0.2),
      maxHp: this.cls.baseHp * lv * (0.06 + m * 0.03),
      regen: (0.3 + lv * 0.05) * (1 + m),
    };
  }

  // ------------------------------------------------------------------ developer helpers
  devMaxAll() {
    for (let i = 0; i < 8; i++) {
      this.levels[i] = SKILL_MAX;
      for (let t = 0; t < 2; t++) if (this.tri[i][t] < 0) this.tri[i][t] = 0;
    }
  }

  devUnlockAll() {
    for (let i = 0; i < 8; i++) if (this.levels[i] === 0) this.levels[i] = 1;
  }

  devSetLevel(slot: number, lv: number) {
    this.levels[slot] = Math.max(1, Math.min(SKILL_MAX, lv));
  }

  resetCooldowns() {
    this.cds.fill(0);
    this.dodgeCharges = this.cls.dodge.charges;
    this.dodgeT = 0;
  }

  fillResource() {
    this.res = this.resMax;
  }

  fillUlt() {
    this.ult = 100;
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, c: Controls) {
    const run = this.run;
    const p = run.player;
    const r = this.cls.res;
    // resource
    let regen = r.regen;
    if (regen < 0 && run.time - run.stats.lastHurt < 3) regen = 0;
    if (regen < 0 && run.time - this.lastHitTime < 3) regen = 0;
    if (this.identityT > 0 && this.cls.identity.kind === 'bloodlust') regen = -this.cls.res.max / this.cls.identity.dur;
    if (!r.orbs) regen += run.loot.totals.resRegen;
    this.res = Math.max(0, Math.min(this.resMax, this.res + regen * dt));
    if (run.debug.infRes) this.res = this.resMax;
    const cdRate = this.identityT > 0 && this.cls.identity.kind === 'rupture' ? 2 : 1;
    for (let i = 0; i < 10; i++) if (this.cds[i] > 0) this.cds[i] = Math.max(0, this.cds[i] - dt * cdRate);
    if (run.debug.noCd) {
      this.cds.fill(0);
      this.dodgeCharges = this.cls.dodge.charges;
    }
    if (this.dodgeCharges < this.cls.dodge.charges) {
      this.dodgeT += dt;
      if (this.dodgeT >= this.cls.dodge.cd) {
        this.dodgeT = 0;
        this.dodgeCharges++;
      }
    }
    for (let i = 0; i < 13; i++) {
      if (this.flash[i] > 0) this.flash[i] -= dt;
      if (this.denied[i] > 0) this.denied[i] -= dt;
    }
    if (this.combo.t > 0) {
      this.combo.t -= dt;
      if (this.combo.t <= 0) this.combo.slot = -1;
    }
    if (this.basicT > 0) {
      this.basicT -= dt;
      if (this.basicT <= 0) this.basicIdx = 0;
    }
    if (this.identityT > 0) {
      this.identityT -= dt;
      if (this.identityT <= 0) this.endIdentity();
    }
    if (this.stealthT > 0) this.stealthT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.flowT > 0) {
      this.flowT -= dt;
      if (this.flowT <= 0) this.flow = 0;
    }
    if (this.buf.t > 0) this.buf.t -= dt;
    if (this.counter && this.counter.cd > 0) this.counter.cd -= dt;
    this.updateBuffs(dt);
    this.updateLasting(dt);
    this.summons.update(dt);
    this.fx.update(dt, p.x, p.z);
    if (p.dead) {
      this.cur = null;
      this.mover = null;
      return;
    }
    // inputs
    if (c.dodge) this.press(-2, c);
    if (c.identity) this.press(-3, c);
    for (const s of c.casts) this.press(s, c);
    if (this.mover) this.updateMover(dt);
    if (this.cur) this.updateAction(dt, c);
    // buffered press
    if (this.buf.t > 0 && this.buf.slot !== -1) this.tryPress(this.buf.slot, c);
    // basic attack
    if (c.attack && this.stunT <= 0) this.tryBasic(c);
  }

  private lastHitTime = -99;

  /** Aim point the next started action uses instead of the live cursor (the press snapshot). */
  private lockAim: [number, number] | null = null;

  private press(slot: number, c: Controls) {
    this.buf.slot = slot;
    this.buf.t = 0.4;
    // the target point is fixed the moment the key goes down
    this.buf.ax = c.aimX;
    this.buf.az = c.aimZ;
  }

  /** Attempts the buffered press; keeps it buffered while the current action cannot be cancelled. */
  private tryPress(slot: number, c: Controls) {
    this.lockAim = [this.buf.ax, this.buf.az];
    try {
      this.tryPressAt(slot, c);
    } finally {
      this.lockAim = null;
    }
  }

  private tryPressAt(slot: number, c: Controls) {
    if (this.stunT > 0 && slot !== -2) return;
    const cur = this.cur;
    if (slot === -2) {
      // dodge cancels nearly anything (not the Ultimate, not mid-move)
      if (this.mover && this.mover.kind !== 'dash') return;
      if (cur && cur.slot === SLOT_ULT) return;
      if (this.dodgeCharges <= 0) {
        this.denied[10] = 0.3;
        this.buf.t = 0;
        return;
      }
      this.buf.t = 0;
      this.dodge(c);
      return;
    }
    if (slot === -3) {
      if (!this.identityReady) {
        this.denied[11] = 0.3;
        this.buf.t = 0;
        return;
      }
      if (cur && !this.cancellable(cur, true)) return;
      this.buf.t = 0;
      this.triggerIdentity(c);
      return;
    }
    // same hold/charge skill pressed again is ignored
    if (cur && cur.slot === slot && cur.def && (cur.def.type === 'hold' || cur.def.type === 'charge') && cur.def.type !== undefined && !this.comboOpen(slot)) {
      this.buf.t = 0;
      return;
    }
    if (!this.ready(slot)) {
      if (this.level(slot) > 0 && this.buf.t > 0.35) {
        this.denied[slot] = 0.3;
        if (slot < 8 && this.cds[slot] <= 0 && this.res < this.costOf(slot)) {
          this.run.fx.text(this.run.player.x, this.run.player.z, this.run.tr('act_no_res').replace('{res}', loc(this.cls.res.name)), 0xa0b0ff);
          this.run.fx.sound('denied', 0.35);
        }
      }
      if (this.level(slot) <= 0 || this.cds[slot] > 0.4) this.buf.t = 0;
      return;
    }
    if (this.mover) return;
    if (cur && !this.cancellable(cur, false, slot)) return;
    this.buf.t = 0;
    this.cast(slot, c);
  }

  /** Whether the current action can be cut by a new skill now. */
  private cancellable(cur: Playing, identity: boolean, slot = -1): boolean {
    if (cur.phase === 'charge' || cur.phase === 'cast') return false;
    if (cur.src === 'basic') {
      // skills cut basic attacks once the swing has started (no input delay feel)
      return true;
    }
    if (cur.slot === SLOT_ULT) return cur.t >= (cur.step.cancel ?? cur.step.dur);
    // a combo continues from its own window
    if (slot >= 0 && slot === cur.slot && cur.def?.type === 'combo') return cur.t >= (cur.step.cancel ?? cur.step.dur);
    if (cur.def?.type === 'hold' && cur.idx === 1) return true;
    if (identity) return true;
    return cur.t >= (cur.step.cancel ?? cur.step.dur);
  }

  // ------------------------------------------------------------------ starting actions
  private aimDir(c: Controls): [number, number] {
    const p = this.run.player;
    const [ax, az] = this.lockAim ?? [c.aimX, c.aimZ];
    const dx = ax - p.x;
    const dz = az - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) return [p.fx, p.fz];
    return [dx / l, dz / l];
  }

  private start(src: Src, slot: number, def: SkillDef | null, step: Step, idx: number, c: Controls, phase: Playing['phase'] = 'play', mul = 1): Playing {
    const p = this.run.player;
    const [dx, dz] = this.aimDir(c);
    let superArmor = false;
    let stagMul = 1;
    let areaMul = 1;
    let rate = 1;
    let extraSt: StatusId | null = null;
    if (def && slot < 8) {
      const lv = this.levels[slot];
      mul *= 1 + (lv - 1) * 0.12;
      const t1 = this.tripod(slot, 0);
      const t2 = this.tripod(slot, 1);
      if (t1?.kind === 'area') areaMul += t1.v;
      if (t1?.kind === 'status') extraSt = t1.st ?? EL_STATUS[def.el];
      if (t2?.kind === 'dmg') mul *= 1 + t2.v;
      if (t2?.kind === 'stag') {
        stagMul += t2.v;
        superArmor = true;
      }
      if (t2?.kind === 'speed') rate *= 1 + t2.v;
    }
    if (src === 'basic') rate *= 1 + this.buff.atkSpeed + this.run.loot.totals.atkSpeed + (this.cls.id === 'steelfist' ? this.flow * 0.03 : 0);
    else if (src === 'skill') rate *= 1 + this.buff.atkSpeed * 0.5;
    const play: Playing = {
      src, slot, def, step, idx, phase, t: 0, evs: sortedEvents(step), next: 0, rate,
      dirX: dx, dirZ: dz, tx: this.lockAim ? this.lockAim[0] : c.aimX, tz: this.lockAim ? this.lockAim[1] : c.aimZ,
      stepLeft: 0, stepFrom: 0, stepTo: 0, mul, stagMul, areaMul, extraSt, superArmor, prep: 0, gained: false,
    };
    this.cur = play;
    p.fx = dx;
    p.fz = dz;
    if (src === 'basic' && phase === 'play') this.planStep(play);
    if (!step.move && phase === 'play') {
      p.clearPath();
      p.vx *= 0.2;
      p.vz *= 0.2;
    }
    if (phase === 'play') this.playAnim(step.anim, rate);
    else this.playAnim(step.anim + (phase === 'charge' ? '_charge' : '_cast'), 1, true);
    return play;
  }

  private playAnim(name: string, rate: number, loop = false) {
    this.anim.name = name;
    this.anim.rate = rate;
    this.anim.loop = loop;
    this.anim.n++;
  }

  private tryBasic(c: Controls) {
    const cur = this.cur;
    if (this.mover) return;
    if (cur) {
      if (cur.src !== 'basic') return;
      if (cur.t < (cur.step.cancel ?? cur.step.dur) / Math.max(0.01, 1)) return;
    }
    const b = this.cls.basic;
    const idx = this.basicIdx % b.steps.length;
    this.start('basic', -1, null, b.steps[idx], idx, c);
    this.basicIdx = idx + 1;
    this.basicT = 0;
    this.flash[12] = 0.2;
    const p = this.run.player;
    p.cues.attack++;
  }

  private cast(slot: number, c: Controls) {
    const run = this.run;
    const p = run.player;
    if (slot === SLOT_SPECIAL) {
      const sp = this.cls.special!;
      this.cds[slot] = this.cdMax[slot] = sp.cd;
      this.flash[slot] = 0.35;
      this.start('skill', slot, null, sp.step, 0, c);
      return;
    }
    const def = this.skill(slot)!;
    let idx = 0;
    if (def.type === 'combo' && this.comboOpen(slot)) idx = this.combo.idx;
    else {
      // fresh cast: pay and start the cooldown
      const cost = this.costOf(slot);
      if (cost > 0 && !run.debug.infRes) this.res -= cost;
      if (def.cost && def.cost < 0) this.gain(-def.cost);
      if (slot === SLOT_ULT) {
        if (!run.debug.noCd) this.ult = 0;
        run.fx.sound('evolution', 0.9);
        run.fx.shake(0.2);
        const f = this.fx.add('flash', p.x, p.z, 0.6, def.color);
        f.r = 6;
        f.follow = true;
      } else {
        this.cds[slot] = this.cdMax[slot] = this.cooldownOf(slot);
      }
      run.stats.skillsCast++;
      this.flash[slot] = 0.35;
    }
    this.combo.slot = -1;
    if (def.type === 'charge') {
      this.start('skill', slot, def, def.steps[0], 0, c, 'charge');
      this.gather(def.color, def.chargeMax ?? 1);
    } else if (def.type === 'cast') {
      const castTime = this.identityT > 0 && this.cls.identity.kind === 'rupture' ? 0 : (def.castTime ?? 0.5);
      if (castTime <= 0) this.start('skill', slot, def, def.steps[0], 0, c, 'play', 1.2);
      else {
        this.start('skill', slot, def, def.steps[0], 0, c, 'cast', 1.2);
        this.cur!.prep = castTime;
        this.gather(def.color, castTime);
      }
    } else this.start('skill', slot, def, def.steps[idx], idx, c);
    p.cues.ability++;
    run.fx.sound(EL_SFX[def.el], 0.55);
  }

  private gather(color: number, t: number) {
    const p = this.run.player;
    const f = this.fx.add('gather', p.x, p.z, t, color);
    f.follow = true;
    f.r = 1.2;
  }

  private dodge(c: Controls) {
    const run = this.run;
    const p = run.player;
    this.dodgeCharges--;
    this.flash[10] = 0.35;
    this.cur = null;
    this.mover = null;
    // dodge toward the walking direction, else toward the cursor
    let dx = p.moveDirX;
    let dz = p.moveDirZ;
    if (Math.hypot(dx, dz) < 0.1) [dx, dz] = this.aimDir(c);
    const step = this.cls.dodge.step;
    const play = this.start('dodge', -1, null, step, 0, c);
    play.dirX = dx;
    play.dirZ = dz;
    p.fx = dx;
    p.fz = dz;
    p.clearPath();
    run.stats.dodges++;
    run.fx.sound('dash', 0.5);
    if (this.has('p_evasion')) {
      this.shield = Math.max(this.shield, p.stats.maxHp * 0.1);
      this.shieldMax = Math.max(this.shieldMax, this.shield);
      this.evasionT = 2;
    }
  }

  private triggerIdentity(c: Controls) {
    const run = this.run;
    const p = run.player;
    const id = this.cls.identity;
    this.flash[11] = 0.5;
    this.cur = null;
    run.fx.sound('evolution', 0.7);
    run.fx.text(p.x, p.z, loc(id.name), 0xffe080);
    const orbsBefore = this.orbs;
    switch (id.kind) {
      case 'bloodlust':
        this.identityT = id.dur;
        this.addBuff({ do: 'buff', t: 0, dur: id.dur, dmg: 0.25, atkSpeed: 0.2, speed: 0.2, color: id.color }, 1);
        break;
      case 'awaken':
      case 'rupture':
        this.identityT = id.dur;
        this.res = 0;
        break;
      case 'persona':
        this.identityT = id.dur;
        this.res = 0;
        break;
      case 'surge':
        this.identityT = id.dur;
        this.res = 0;
        break;
      case 'axis':
        this.detonateSeals();
        this.res = 0;
        break;
      default:
        this.identityT = id.dur;
        this.res = 0;
    }
    if (id.step) {
      const play = this.start('identity', -1, null, id.step, 0, c);
      if (id.kind === 'surge') play.mul = 0.5 + orbsBefore * 0.5;
    }
    run.stats.skillsCast++;
  }

  private endIdentity() {
    if (this.cls.identity.kind === 'bloodlust') this.res = 0;
  }

  // ------------------------------------------------------------------ running actions
  private updateAction(dt: number, c: Controls) {
    const cur = this.cur!;
    const p = this.run.player;
    if (cur.phase === 'charge') {
      const def = cur.def!;
      cur.prep += dt;
      const max = def.chargeMax ?? 1;
      p.fx = cur.dirX;
      p.fz = cur.dirZ;
      if (!c.held[cur.slot] || cur.prep >= max + 0.25) {
        const k = Math.min(1, cur.prep / max);
        const mul = cur.mul * (1 + ((def.chargeMul ?? 2) - 1) * k);
        if (k >= 1) this.run.fx.sound('select', 0.4);
        this.lockAim = [cur.tx, cur.tz];
        this.start('skill', cur.slot, def, cur.step, 0, c, 'play', mul / (1 + (this.levels[cur.slot] - 1) * 0.12) / this.tripodDmg(cur.slot));
      }
      this.lockAim = null;
      return;
    }
    if (cur.phase === 'cast') {
      cur.prep -= dt;
      if (cur.prep <= 0) {
        const def = cur.def!;
        this.lockAim = [cur.tx, cur.tz];
        this.start('skill', cur.slot, def, cur.step, 0, c, 'play', cur.mul / (1 + (cur.slot < 8 ? (this.levels[cur.slot] - 1) * 0.12 : 0)) / this.tripodDmg(cur.slot));
        // the target is the point locked when the key was pressed
      }
      this.lockAim = null;
      return;
    }
    cur.t += dt * cur.rate;
    // directions and points stay as snapshotted at the press; the cursor is not re-read
    if ((cur.stepLeft ?? 0) > 0) this.updateStep(cur, dt);
    // invulnerability window
    const iw = cur.step.iframes;
    if (iw && cur.t >= iw[0] && cur.t <= iw[1]) p.invulnT = Math.max(p.invulnT, 0.06);
    while (cur.next < cur.evs.length && cur.evs[cur.next].t <= cur.t) {
      const ev = cur.evs[cur.next++];
      this.fire(cur, ev);
      if (this.cur !== cur) return;
    }
    if (cur.t >= cur.step.dur) this.finish(cur, c);
  }

  /** Plans the melee basic step-forward: shorter when the target is already close, none when touching. */
  private planStep(cur: Playing) {
    const cfg = BASIC_STEP[this.cls.id];
    if (!cfg || this.stunT > 0) return;
    const p = this.run.player;
    const firstHit = cur.evs.find((e) => e.do === 'hit');
    const th = firstHit ? firstHit.t : cur.step.dur * 0.4;
    let dist = cfg.dist;
    // stop short of the nearest enemy in the swing direction (keep body radii apart)
    const e = this.run.enemies.nearest(p.x + cur.dirX * 1.2, p.z + cur.dirZ * 1.2, 2.4, undefined, false);
    if (e) {
      const ahead = (e.x - p.x) * cur.dirX + (e.z - p.z) * cur.dirZ;
      const gap = ahead - e.radius - p.radius - 0.25;
      dist = Math.max(0, Math.min(dist, gap));
    }
    if (dist < 0.05) return;
    cur.stepLeft = dist;
    cur.stepFrom = th * cfg.from;
    cur.stepTo = Math.max(cur.stepFrom + 0.02, th * cfg.to);
  }

  /** Moves the body forward during the wind-up through the normal wall-sliding movement. */
  private updateStep(cur: Playing, dt: number) {
    if (this.stunT > 0) {
      cur.stepLeft = 0;
      return;
    }
    const t0 = cur.t - dt * cur.rate;
    const from = cur.stepFrom ?? 0;
    const to = cur.stepTo ?? 0;
    const left = cur.stepLeft ?? 0;
    const a = Math.max(t0, from);
    const b = Math.min(cur.t, to);
    if (b <= a) return;
    const total = BASIC_STEP[this.cls.id]?.dist ?? 0;
    const want = Math.min(left, (total * (b - a)) / (to - from));
    const p = this.run.player;
    // never walk into an enemy body mid-step
    let d = want;
    const e = this.run.enemies.nearest(p.x + cur.dirX * d, p.z + cur.dirZ * d, 1.5, undefined, false);
    if (e && Math.hypot(e.x - p.x - cur.dirX * d, e.z - p.z - cur.dirZ * d) < e.radius + p.radius) d = 0;
    if (d > 0) p.slide(cur.dirX * d, cur.dirZ * d);
    cur.stepLeft = d > 0 ? left - want : 0;
  }

  private tripodDmg(slot: number): number {
    if (slot < 0 || slot >= 8) return 1;
    const t = this.tripod(slot, 1);
    return t?.kind === 'dmg' ? 1 + t.v : 1;
  }

  private finish(cur: Playing, c: Controls) {
    this.lockAim = [cur.tx, cur.tz];
    try {
      this.finishAt(cur, c);
    } finally {
      this.lockAim = null;
    }
  }

  private finishAt(cur: Playing, c: Controls) {
    const def = cur.def;
    this.cur = null;
    if (cur.src === 'basic') {
      this.basicT = this.cls.basic.window;
      return;
    }
    if (!def) return;
    if (def.type === 'hold') {
      if (cur.idx === 0) {
        this.holdT = 0;
        this.start('skill', cur.slot, def, def.steps[1], 1, c);
        return;
      }
      if (cur.idx === 1) {
        this.holdT += cur.step.dur / cur.rate;
        if (c.held[cur.slot] && this.holdT < (def.holdMax ?? 2)) {
          const n = this.start('skill', cur.slot, def, def.steps[1], 1, c);
          n.t = 0;
          return;
        }
        if (def.steps[2]) this.start('skill', cur.slot, def, def.steps[2], 2, c);
        return;
      }
      return;
    }
    if (def.type === 'combo' && cur.idx + 1 < def.steps.length) {
      this.combo.slot = cur.slot;
      this.combo.idx = cur.idx + 1;
      this.combo.t = def.window ?? 0.8;
    }
  }

  private holdT = 0;

  // ------------------------------------------------------------------ events
  private fire(cur: Playing, ev: ActionEv) {
    switch (ev.do) {
      case 'hit':
        this.doHit(cur, ev);
        break;
      case 'move':
        this.doMove(cur, ev);
        break;
      case 'proj':
        this.doProj(cur, ev);
        break;
      case 'zone':
        this.doZone(cur, ev);
        break;
      case 'summon':
        this.doSummon(cur, ev);
        break;
      case 'buff':
        this.addBuff(ev, cur.mul);
        break;
      case 'fx':
        this.doFx(ev);
        break;
      case 'chain':
        this.doChain(cur, ev);
        break;
      case 'command': {
        const run = this.run;
        this.summons.command(cur.tx, cur.tz, ev.dmg ?? 0.3);
        const f = this.fx.add('ring', cur.tx, cur.tz, 0.5, this.cls.color);
        f.r = 2;
        run.fx.sound('select', 0.5);
        break;
      }
    }
  }

  private elOf(cur: Playing, el?: DmgType): DmgType {
    return el ?? cur.def?.el ?? this.cls.basic.el;
  }

  /** Builds the damage record of an event. */
  private info(cur: Playing, ev: { dmg: number; stag?: number; el?: DmgType; knock?: number; st?: StatusId; stp?: number; backMul?: number; execute?: number; launch?: boolean }, extraMul = 1): DamageInfo {
    const run = this.run;
    const p = run.player;
    const d = makeDamage();
    const el = this.elOf(cur, ev.el);
    d.el = el;
    d.weaponId = EL_WEAPON[el];
    const gear = run.loot.totals;
    const lvMul = 1 + (p.level - 1) * 0.07;
    let mul = cur.mul * extraMul * lvMul * (1 + this.buff.dmg) * (1 + (gear.elem[el] ?? 0));
    if (cur.src !== 'basic') mul *= 1 + gear.skillDmg;
    if (this.identityT > 0 && this.cls.identity.kind === 'awaken') mul *= 1.3;
    if (cur.def?.type === 'cast' && this.cls.id === 'sorceress') mul *= 1;
    d.damage = this.cls.power * ev.dmg * mul;
    d.knockback = ev.knock ?? (cur.src === 'basic' ? 0.3 : 0.6);
    d.source = cur.src === 'basic' ? SRC_BASIC : SRC_SKILL;
    d.critChance = this.buff.crit + (this.has('p_precision') ? 0.12 : 0);
    d.critDamage = 1.6;
    d.stag = (ev.stag ?? 0) * cur.stagMul * (1 + (p.level - 1) * 0.03) * (this.has('p_breaker') ? 1.4 : 1);
    d.backMul = ev.backMul ?? 1;
    d.execute = ev.execute ?? 1;
    d.launch = !!ev.launch;
    const sts: [StatusId, number][] = [];
    if (ev.st) sts.push([ev.st, ev.stp ?? ST_DEFAULT[ev.st]]);
    if (cur.extraSt && ev.dmg > 0.5 && cur.extraSt !== ev.st) sts.push([cur.extraSt, ST_DEFAULT[cur.extraSt]]);
    if (this.identityT > 0 && this.cls.identity.kind === 'awaken' && Math.random() < 0.25) sts.push(['stun', 0.3]);
    for (const [st, v] of sts) {
      switch (st) {
        case 'burn':
          d.burn = v * this.cls.power * 0.25 * lvMul;
          d.burnDur = 3;
          break;
        case 'poison':
          d.poison = v * this.cls.power * 0.25 * lvMul;
          d.poisonDur = 4;
          break;
        case 'bleed':
          d.bleed = v * this.cls.power * 0.25 * lvMul;
          d.bleedDur = 4;
          break;
        case 'slow':
          d.slow = Math.max(0.2, 1 - v);
          d.slowDur = 2;
          break;
        case 'freeze':
          d.freeze = 1;
          d.freezeDur = v;
          break;
        case 'stun':
          d.stun = v;
          break;
        case 'curse':
          d.curse = v;
          break;
        case 'weaken':
          d.weaken = v;
          break;
        case 'root':
          d.root = v;
          break;
        case 'mark':
          d.mark = v;
          break;
      }
    }
    return d;
  }

  /** Centre of a shape for the current action. */
  private anchor(cur: Playing, at: 'self' | 'aim' | 'front' | undefined, off = 0, range = 0): [number, number] {
    const p = this.run.player;
    if (at === 'aim') {
      const rng = range || cur.def?.range || 8;
      const dx = cur.tx - p.x;
      const dz = cur.tz - p.z;
      const l = Math.hypot(dx, dz);
      if (l <= rng) return [cur.tx, cur.tz];
      return [p.x + (dx / l) * rng, p.z + (dz / l) * rng];
    }
    if (at === 'front') return [p.x + cur.dirX * off, p.z + cur.dirZ * off];
    return [p.x + cur.dirX * off, p.z + cur.dirZ * off];
  }

  /** Is a point inside a shape centred at (ox, oz) facing (dx, dz)? */
  static inShape(sh: Shape, ox: number, oz: number, dx: number, dz: number, ex: number, ez: number, er: number, area = 1): boolean {
    const rx = ex - ox;
    const rz = ez - oz;
    const dist = Math.hypot(rx, rz);
    switch (sh.k) {
      case 'circle':
        return dist <= sh.r * area + er;
      case 'ring':
        return dist <= sh.r1 * area + er && dist >= sh.r0 * area - er;
      case 'cone': {
        if (dist > sh.r * area + er) return false;
        if (dist < 0.8) return true;
        const fx = sh.back ? -dx : dx;
        const fz = sh.back ? -dz : dz;
        const cos = (rx * fx + rz * fz) / dist;
        const half = ((sh.arc * Math.PI) / 180) / 2 + Math.atan2(er, dist);
        return cos >= Math.cos(Math.min(Math.PI, half));
      }
      case 'rect': {
        const fx = sh.back ? -dx : dx;
        const fz = sh.back ? -dz : dz;
        const along = rx * fx + rz * fz - (sh.off ?? 0);
        const perp = Math.abs(rx * fz - rz * fx);
        return along >= -er - 0.4 && along <= sh.len * area + er && perp <= (sh.w * area) / 2 + er;
      }
      case 'sides': {
        const along = Math.abs(rx * dx + rz * dz);
        const perp = Math.abs(rx * dz - rz * dx);
        return along <= (sh.w * area) / 2 + er && perp <= sh.len * area + er;
      }
      case 'cross': {
        const along = Math.abs(rx * dx + rz * dz);
        const perp = Math.abs(rx * dz - rz * dx);
        const L = sh.len * area + er;
        const W = (sh.w * area) / 2 + er;
        return (along <= L && perp <= W) || (perp <= L && along <= W);
      }
    }
  }

  static shapeReach(sh: Shape, area = 1): number {
    switch (sh.k) {
      case 'circle':
        return sh.r * area;
      case 'ring':
        return sh.r1 * area;
      case 'cone':
        return sh.r * area;
      case 'rect':
        return (sh.len + (sh.off ?? 0)) * area + sh.w;
      case 'sides':
        return sh.len * area + sh.w;
      case 'cross':
        return sh.len * area * 1.1 + sh.w;
    }
  }

  private doHit(cur: Playing, ev: HitEv) {
    const run = this.run;
    const n = ev.n ?? 1;
    const go = (k: number) => {
      if (run.player.dead) return;
      const sh = ev.shape;
      const at = sh.k === 'circle' || sh.k === 'ring' || sh.k === 'cross' ? sh.at : 'self';
      const off = sh.k === 'circle' ? (sh.off ?? 0) : 0;
      const [ox, oz] = this.anchor(cur, at, off);
      this.hitShape(cur, ev, ox, oz, cur.dirX, cur.dirZ, k);
    };
    go(0);
    for (let k = 1; k < n; k++) run.later(k * (ev.every ?? 0.1) / cur.rate, () => go(k));
  }

  /** Damages everything inside a shape and draws it. */
  private hitShape(cur: Playing, ev: Omit<HitEv, 'do' | 't'>, ox: number, oz: number, dx: number, dz: number, k = 0) {
    const run = this.run;
    const area = cur.areaMul * (run.player.stats.area || 1);
    const info = this.info(cur, ev);
    if (ev.pull) info.knockback = 0;
    let hits = 0;
    const stealth = this.stealthT > 0;
    if (stealth) {
      info.damage *= 1.8;
      info.critChance = 1;
    }
    run.enemies.forEachInRadius(ox, oz, ActionSystem.shapeReach(ev.shape, area) + 1, (e) => {
      if (!ActionSystem.inShape(ev.shape, ox, oz, dx, dz, e.x, e.z, e.radius, area)) return;
      if (ev.shape.k !== 'circle' || ev.shape.r > 2) {
        if (!run.terrain.los(ox, oz, e.x, e.z) && Math.hypot(e.x - ox, e.z - oz) > 1.5) return;
      }
      if (ev.pull) {
        const px = ox - e.x;
        const pz = oz - e.z;
        const l = Math.hypot(px, pz) || 1;
        if (!e.boss) {
          const f = ev.pull * (1 - e.kbResist) * 2;
          e.kx += (px / l) * f;
          e.kz += (pz / l) * f;
        }
      }
      run.combat.hit(e, info, 1, e.x - run.player.x || dx, e.z - run.player.z || dz);
      hits++;
    });
    if (hits > 0) this.onEventHits(cur, hits);
    if (stealth && hits > 0) this.breakStealth();
    // visuals
    const f = this.fx.add('hit', ox, oz, ev.fx === 'smash' || ev.fx === 'shock' ? 0.45 : 0.3, ev.color ?? this.colorOf(cur, ev.el));
    f.a = Math.atan2(dz, dx);
    f.shape = scaleShape(ev.shape, area);
    f.fx = ev.fx ?? 'slash';
    f.seed = k;
    if (ev.shake) run.fx.shake(ev.shake);
    if (ev.sfx && k === 0) run.fx.sound(SFX_ALIAS[ev.sfx] ?? ev.sfx, 0.55);
    else if (k === 0 && hits > 0) run.fx.sound(EL_SFX[this.elOf(cur, ev.el)], 0.3);
    if (ev.fx === 'smash' || ev.fx === 'shock' || ev.fx === 'holy' || ev.fx === 'fire') run.fx.light(ox, oz, f.color, 1.5, 5, 0.25);
  }

  private colorOf(cur: Playing, el?: DmgType): number {
    if (cur.src === 'basic') return EL_COLOR[this.elOf(cur, el)];
    return cur.def?.color ?? EL_COLOR[this.elOf(cur, el)];
  }

  private onEventHits(cur: Playing, hits: number) {
    const r = this.cls.res;
    const extra = Math.min(hits - 1, 4) * 0.25;
    if (cur.src === 'basic') this.gain(r.onBasic * (1 + extra));
    else if (cur.src === 'skill' && cur.slot !== SLOT_ULT && !(cur.def?.cost && cur.def.cost > 0)) this.gain(r.onSkill * (1 + extra));
    if (this.cls.id === 'steelfist' && cur.src === 'skill') {
      this.flow = Math.min(10, this.flow + 1);
      this.flowT = 2;
    }
    if (this.cls.id === 'paladin' && cur.src === 'skill' && cur.next <= 1) this.run.player.heal(this.run.player.stats.maxHp * 0.02, true);
    this.lastHitTime = this.run.time;
  }

  gain(v: number) {
    if (v <= 0) return;
    if (this.identityT > 0 && this.cls.identity.kind === 'bloodlust') return;
    this.res = Math.min(this.resMax, this.res + v * (this.has('p_wellspring') ? 1.3 : 1));
  }

  private breakStealth() {
    this.stealthT = 0;
    const p = this.run.player;
    const f = this.fx.add('blink', p.x, p.z, 0.4, 0x9a6aff);
    f.r = 1.4;
    if (this.cls.identity.kind === 'persona' && this.identityT > 0) {
      // leaving the Persona: a shadow burst around the hero
      this.identityT = 0;
      const cur = this.cur;
      if (cur) this.hitShape(cur, { shape: { k: 'circle', r: 3 }, dmg: 6, stag: 40, el: 'dark', fx: 'dark', backMul: 1.3, shake: 0.3 }, p.x, p.z, cur.dirX, cur.dirZ);
    }
  }

  private doMove(cur: Playing, ev: MoveEv) {
    const run = this.run;
    const p = run.player;
    const t = run.terrain;
    let [dx, dz] = [cur.dirX, cur.dirZ];
    if (cur.src === 'dodge') [dx, dz] = [cur.dirX, cur.dirZ];
    let ex = p.x;
    let ez = p.z;
    const dist = ev.dist;
    switch (ev.kind) {
      case 'dash':
        ex = p.x + dx * dist;
        ez = p.z + dz * dist;
        break;
      case 'back':
        ex = p.x - dx * dist;
        ez = p.z - dz * dist;
        break;
      case 'leap':
      case 'blink': {
        const [ax, az] = this.anchor(cur, 'aim', 0, dist);
        ex = ax;
        ez = az;
        if (cur.src === 'dodge') {
          ex = p.x + dx * dist;
          ez = p.z + dz * dist;
        }
        break;
      }
      case 'behind': {
        const e = run.enemies.nearest(cur.tx, cur.tz, 4, undefined, false) ?? run.enemies.nearest(p.x, p.z, dist, undefined, true);
        if (e && Math.hypot(e.x - p.x, e.z - p.z) <= dist + 3) {
          // behind relative to where the enemy is facing
          const fx = Math.sin(e.yaw);
          const fz = Math.cos(e.yaw);
          const back = e.radius + 0.9;
          ex = e.x - fx * back;
          ez = e.z - fz * back;
          if (t.blocksWalker(Math.floor(ex), Math.floor(ez))) {
            ex = e.x + (e.x - p.x) / (Math.hypot(e.x - p.x, e.z - p.z) || 1) * back;
            ez = e.z + (e.z - p.z) / (Math.hypot(e.x - p.x, e.z - p.z) || 1) * back;
          }
          const l = Math.hypot(e.x - ex, e.z - ez) || 1;
          cur.dirX = (e.x - ex) / l;
          cur.dirZ = (e.z - ez) / l;
          cur.tx = e.x;
          cur.tz = e.z;
        } else {
          const [ax, az] = this.anchor(cur, 'aim', 0, dist);
          ex = ax;
          ez = az;
        }
        break;
      }
    }
    // walls: blink/behind/leap land on the nearest free cell along the line
    if (ev.kind === 'blink' || ev.kind === 'behind' || ev.kind === 'leap') {
      for (let i = 0; i < 24 && t.blocksWalker(Math.floor(ex), Math.floor(ez)); i++) {
        ex += (p.x - ex) * 0.15;
        ez += (p.z - ez) * 0.15;
      }
      if (t.blocksWalker(Math.floor(ex), Math.floor(ez))) {
        ex = p.x;
        ez = p.z;
      }
    }
    const color = cur.def?.color ?? this.cls.color;
    let info: DamageInfo | null = null;
    let r = 0;
    if (ev.hit) {
      info = this.info(cur, ev.hit);
      r = ev.hit.r;
    }
    if (ev.iframe) p.invulnT = Math.max(p.invulnT, ev.dur + 0.08);
    p.cancelJump();
    p.clearPath();
    if (ev.kind === 'blink' || ev.kind === 'behind') {
      const a = this.fx.add('blink', p.x, p.z, 0.4, color);
      a.r = 1.2;
      p.x = ex;
      p.z = ez;
      p.vx = p.vz = 0;
      const b = this.fx.add('blink', ex, ez, 0.4, color);
      b.r = 1.4;
      p.fx = cur.dirX;
      p.fz = cur.dirZ;
      run.fx.sound('dash', 0.45);
      return;
    }
    this.mover = { kind: ev.kind, t: 0, dur: Math.max(0.05, ev.dur / cur.rate), sx: p.x, sz: p.z, ex, ez, info, r, hitSet: new Set(), fx: ev.hit?.fx ?? '', color };
    const tr = this.fx.add('trail', p.x, p.z, ev.dur + 0.25, color);
    tr.x2 = ex;
    tr.z2 = ez;
    tr.vis = ev.kind;
    if (ev.kind !== 'leap') run.fx.sound('dash', 0.4);
  }

  private updateMover(dt: number) {
    const m = this.mover!;
    const run = this.run;
    const p = run.player;
    m.t += dt;
    const u = Math.min(1, m.t / m.dur);
    // ease-out slide; leaps travel linearly with an arc
    const k = m.kind === 'leap' ? u : 1 - (1 - u) * (1 - u);
    const tx = m.sx + (m.ex - m.sx) * k;
    const tz = m.sz + (m.ez - m.sz) * k;
    if (m.kind === 'leap') {
      p.x = tx;
      p.z = tz;
      p.jumpY = 4 * 1.8 * u * (1 - u);
    } else {
      const ox = p.x;
      const oz = p.z;
      p.slide(tx - p.x, tz - p.z);
      if (Math.hypot(p.x - ox, p.z - oz) < 0.0005 && u < 1 && m.t > 0.04) {
        // hit a wall: stop sliding
        m.t = m.dur;
      }
    }
    if (m.info && m.r > 0) {
      const cur = this.cur;
      let hits = 0;
      run.enemies.forEachInRadius(p.x, p.z, m.r, (e) => {
        if (m.hitSet.has(e.uid)) return;
        m.hitSet.add(e.uid);
        run.combat.hit(e, m.info!, 1, m.ex - m.sx, m.ez - m.sz);
        hits++;
      });
      if (hits && cur) this.onEventHits(cur, hits);
      if (hits && this.stealthT > 0) this.breakStealth();
    }
    if (u >= 1) {
      if (m.kind === 'leap') {
        p.jumpY = 0;
        run.fx.burst(p.x, 0.2, p.z, 0xb8a888, 12, 3, 0.2, 0.5, 'smoke');
      }
      this.mover = null;
    }
  }

  private doProj(cur: Playing, ev: ProjEv) {
    const run = this.run;
    const p = run.player;
    const n = ev.n ?? 1;
    const spread = ((ev.spread ?? (n > 1 ? 12 * (n - 1) : 0)) * Math.PI) / 180;
    const base = Math.atan2(cur.dirZ, cur.dirX) + ((ev.angle ?? 0) * Math.PI) / 180;
    const color = ev.color ?? this.colorOf(cur, ev.el);
    const area = cur.areaMul;
    const stealth = this.stealthT > 0;
    for (let i = 0; i < n; i++) {
      let a = n > 1 ? base - spread / 2 + (spread * i) / (n - 1) : base;
      if (n === 1 && spread > 0) a += (Math.random() - 0.5) * spread;
      const life = ev.range / ev.speed;
      const pr = run.projectiles.spawn(null, p.x + Math.cos(a) * 0.6, p.z + Math.sin(a) * 0.6, Math.cos(a) * ev.speed, Math.sin(a) * ev.speed, life, ev.vis, color);
      Object.assign(pr.dmg, this.info(cur, ev));
      if (stealth) {
        pr.dmg.damage *= 1.8;
        pr.dmg.critChance = 1;
      }
      pr.pierce = ev.pierce ?? 0;
      pr.radius = (ev.r ?? 0.3) * Math.sqrt(area);
      pr.scale = Math.max(1, (ev.r ?? 0.3) * 2.2) * Math.sqrt(area);
      pr.glow = 1;
      pr.y = 1.1;
      if (ev.pierce === -1) pr.hitEvery = ev.speed < 10 ? 0.4 : 99;
      if (ev.seek) pr.homing = 5;
      const self = this;
      const playing = cur;
      if (ev.explode) {
        const er = ev.explode * Math.sqrt(area);
        let done = false;
        const boom = (x: number, z: number) => {
          if (done) return;
          done = true;
          self.blast(playing, x, z, er, pr.dmg, color);
        };
        pr.hook = { hit: (q) => boom(q.x, q.z), expire: (q) => boom(q.x, q.z) };
      } else if (cur.src !== 'basic' || ev.stag) {
        let once = false;
        pr.hook = {
          hit: () => {
            if (!once) {
              once = true;
              self.onEventHits(playing, 1);
            }
          },
        };
      }
    }
    if (stealth) this.breakStealth();
  }

  /** Circle damage with a burst (explosions). */
  private blast(cur: Playing, x: number, z: number, r: number, info: DamageInfo, color: number) {
    const run = this.run;
    let hits = 0;
    run.enemies.forEachInRadius(x, z, r, (e) => {
      if (!run.terrain.los(x, z, e.x, e.z)) return;
      run.combat.hit(e, info, 1, e.x - x, e.z - z);
      hits++;
    });
    if (hits) this.onEventHits(cur, hits);
    const f = this.fx.add('hit', x, z, 0.45, color);
    f.fx = 'shock';
    f.shape = { k: 'circle', r };
    run.fx.light(x, z, color, 2.5, r * 2.5, 0.3);
    run.fx.sound('explosion', 0.4);
  }

  private doZone(cur: Playing, ev: ZoneEv) {
    const run = this.run;
    const p = run.player;
    const area = cur.areaMul;
    const r = ev.r * area;
    const color = ev.color ?? this.colorOf(cur, ev.el);
    const n = ev.n ?? 1;
    const spots: [number, number][] = [];
    if (ev.at === 'front') {
      // a line of zones along the facing up to range
      const step = (ev.range ?? 8) / n;
      for (let i = 0; i < n; i++) spots.push([p.x + cur.dirX * step * (i + 0.7), p.z + cur.dirZ * step * (i + 0.7)]);
    } else {
      const [cx, cz] = this.anchor(cur, ev.at, 0, ev.range);
      for (let i = 0; i < n; i++) {
        if (n > 1 && (ev.spread ?? 0) > 0) {
          const a = Math.random() * TAU;
          const d = Math.sqrt(Math.random()) * (ev.spread ?? 0);
          spots.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]);
        } else spots.push([cx, cz]);
      }
    }
    const info = this.info(cur, ev);
    const delay = (ev.delay ?? 0) / Math.max(0.5, cur.rate);
    spots.forEach(([x, z], i) => {
      const stagger = ev.vis === 'meteor' && n > 1 ? i * 0.09 : ev.at === 'front' ? i * 0.06 : 0;
      const land = () => {
        if (ev.dur && ev.dur > 0) this.addLasting(cur, ev, x, z, r, info);
        else {
          if (ev.pull) this.pullIn(x, z, r * 1.5, ev.pull);
          this.blast(cur, x, z, r, info, color);
          if (ev.vis === 'meteor' || ev.vis === 'light') {
            const f = this.fx.add('fall', x, z, 0.6, color);
            f.vis = ev.vis;
            f.r = r;
            run.fx.shake(ev.vis === 'meteor' ? 0.22 : 0.14);
            run.fx.burst(x, 0.5, z, color, 20, 6, 0.2, 0.7, 'glow');
            if (ev.vis === 'meteor') run.fx.burst(x, 0.4, z, 0x5a3a2a, 12, 5, 0.16, 0.6, 'debris');
          }
          if (ev.vis === 'seal') this.registerSeal(cur, x, z, color);
        }
      };
      const total = delay + stagger;
      if (total > 0.01) {
        const w = this.fx.add('warn', x, z, total, color);
        w.r = r;
        w.vis = ev.vis ?? '';
        if (ev.vis === 'meteor' || ev.vis === 'light') {
          const f = this.fx.add('fall', x, z, total, color);
          f.vis = ev.vis + '_drop';
          f.r = r;
        }
        run.later(total, land);
      } else land();
    });
  }

  private registerSeal(cur: Playing, x: number, z: number, color: number) {
    // a short-lived blast seal still leaves a mark on the ground
    const ev: ZoneEv = { do: 'zone', t: 0, at: 'self', r: 2, dur: 10, every: 1, dmg: 0, el: 'magic', vis: 'seal', color, st: 'slow', stp: 0.5 };
    this.addLasting(cur, ev, x, z, 2, this.info(cur, ev));
  }

  private addLasting(cur: Playing, ev: ZoneEv, x: number, z: number, r: number, info: DamageInfo) {
    const seal = ev.vis === 'seal' && this.cls.id === 'templar';
    if (seal) {
      // max five seals: the oldest fades
      const seals = this.lasting.filter((l) => l.seal);
      if (seals.length >= 5) seals.sort((a, b) => a.t - b.t)[0].t = 0;
      this.res = Math.min(this.resMax, this.res + 20);
    }
    const dur = (ev.dur ?? 3) * (this.run.player.stats.duration || 1);
    this.lasting.push({ ev, x, z, r, t: seal ? Math.max(dur, 10) : dur, acc: 0, info, seal, trap: ev.vis === 'trap' });
    const f = this.fx.add('zone', x, z, seal ? Math.max(dur, 10) : dur, ev.color ?? this.colorOf(cur, ev.el));
    f.vis = ev.vis ?? 'aura';
    f.r = r;
    (f as { ref?: Lasting }).ref = this.lasting[this.lasting.length - 1];
  }

  private updateLasting(dt: number) {
    const run = this.run;
    const p = run.player;
    let w = 0;
    let ward = 0;
    for (const l of this.lasting) {
      l.t -= dt;
      if (l.t <= 0) continue;
      this.lasting[w++] = l;
      const ev = l.ev;
      const inside = (p.x - l.x) ** 2 + (p.z - l.z) ** 2 <= l.r * l.r;
      if (inside && ev.ward) ward = Math.max(ward, ev.ward);
      if (l.trap) {
        const e = run.enemies.nearest(l.x, l.z, l.r, undefined, false);
        if (e) {
          run.enemies.forEachInRadius(l.x, l.z, l.r, (o) => {
            run.combat.hit(o, l.info, 1, 0, 0);
          });
          const f = this.fx.add('hit', l.x, l.z, 0.4, ev.color ?? 0xc0c0c0);
          f.fx = 'smash';
          f.shape = { k: 'circle', r: l.r };
          run.fx.sound('crate', 0.5);
          l.t = 0;
          this.lasting[w - 1] = l;
        }
        continue;
      }
      l.acc -= dt;
      if (l.acc > 0) continue;
      l.acc += ev.every ?? 0.5;
      if (inside && ev.heal) p.heal(p.stats.maxHp * ev.heal, true);
      if (ev.pull) this.pullIn(l.x, l.z, l.r * 1.3, ev.pull * 0.4);
      if (ev.dmg <= 0 && !ev.st) continue;
      if (ev.vis === 'storm') {
        const e = run.enemies.randomInRadius(l.x, l.z, l.r, false);
        if (e) {
          const b = this.fx.add('bolt', e.x, e.z, 0.25, ev.color ?? 0x8ad8ff);
          b.y = 7;
          b.x2 = e.x;
          b.z2 = e.z;
          run.enemies.forEachInRadius(e.x, e.z, 1.4, (o) => {
            run.combat.hit(o, l.info, 1, 0, 0);
          });
          run.fx.light(e.x, e.z, 0x8ad8ff, 2.5, 4, 0.15);
          if (Math.random() < 0.3) run.fx.sound('zap', 0.25);
        }
        continue;
      }
      run.enemies.forEachInRadius(l.x, l.z, l.r, (e) => {
        run.combat.hit(e, l.info, 1, 0, 0);
      });
    }
    this.lasting.length = w;
    this.ward = ward;
  }

  /** Damage reduction from standing in a protective zone. */
  private ward = 0;

  private detonateSeals() {
    const run = this.run;
    const seals = this.lasting.filter((l) => l.seal);
    const n = seals.length;
    const play: Playing = {
      src: 'identity', slot: -1, def: null, step: this.cls.identity.step!, idx: 0, phase: 'play', t: 0, evs: [], next: 0, rate: 1,
      dirX: run.player.fx, dirZ: run.player.fz, tx: 0, tz: 0, mul: 1 + n * 0.25, stagMul: 1, areaMul: 1, extraSt: null, superArmor: false, prep: 0, gained: true,
    };
    seals.forEach((l, i) => {
      run.later(i * 0.08, () => {
        this.hitShape(play, { shape: { k: 'circle', r: 3 }, dmg: 4.5, stag: 35, el: 'magic', fx: 'holy', st: 'stun', stp: 0.8, shake: 0.15, color: 0x7ae8ff }, l.x, l.z, 1, 0);
        const f = this.fx.add('fall', l.x, l.z, 0.6, 0x7ae8ff);
        f.vis = 'light';
        f.r = 3;
      });
      l.t = 0;
    });
  }

  private pullIn(x: number, z: number, r: number, force: number) {
    this.run.enemies.forEachInRadius(x, z, r, (e) => {
      if (e.boss) return;
      const dx = x - e.x;
      const dz = z - e.z;
      const l = Math.hypot(dx, dz) || 1;
      if (l < 0.6) return;
      const f = force * (1 - e.kbResist);
      e.kx += (dx / l) * f;
      e.kz += (dz / l) * f;
    });
  }

  private doSummon(cur: Playing, ev: SummonEv) {
    const run = this.run;
    const p = run.player;
    const n = ev.n ?? 1;
    const [cx, cz] = ev.at === 'aim' ? this.anchor(cur, 'aim', 0, cur.def?.range || 6) : [p.x, p.z];
    const lvMul = 1 + (p.level - 1) * (this.cls.id === 'summoner' ? 0.1 : 0.07);
    const dmg = this.cls.power * ev.dmg * cur.mul * lvMul;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const d = ev.kind === 'clone' ? 0 : 1.4;
      this.summons.spawn(ev.kind, cx + Math.cos(a) * d, cz + Math.sin(a) * d, ev.dur * (p.stats.duration || 1), dmg, SRC_SUMMON);
    }
    const f = this.fx.add('ring', cx, cz, 0.5, this.cls.color);
    f.r = 1.8;
  }

  private addBuff(b: BuffEv, mul: number) {
    const run = this.run;
    const p = run.player;
    if (b.summons) {
      this.summons.frenzyT = b.dur;
      this.summons.frenzyDmg = b.dmg ?? 0;
      this.summons.frenzyAtk = b.atkSpeed ?? 0;
      if (b.heal) p.heal(p.stats.maxHp * b.heal);
      return;
    }
    if (b.heal) p.heal(p.stats.maxHp * b.heal);
    if (b.shield) {
      this.shield = Math.max(this.shield, p.stats.maxHp * b.shield);
      this.shieldMax = this.shield;
    }
    if (b.stealth) this.stealthT = Math.max(this.stealthT, b.dur);
    if (b.counter) this.counter = { ev: b.counter, cd: 0 };
    this.buffs.push({ b, t: b.dur, mul });
    if (b.dur >= 2 && (b.dmg || b.armor || b.dr || b.speed || b.atkSpeed || b.shield)) {
      const f = this.fx.add('aura', p.x, p.z, b.dur, b.color ?? this.cls.color);
      f.follow = true;
      f.r = 1.2;
    }
  }

  private updateBuffs(dt: number) {
    const s = this.buff;
    s.dmg = s.speed = s.atkSpeed = s.armor = s.dr = s.crit = 0;
    let w = 0;
    let counter = false;
    for (const it of this.buffs) {
      it.t -= dt;
      if (it.t <= 0) continue;
      this.buffs[w++] = it;
      const b = it.b;
      s.dmg += b.dmg ?? 0;
      s.speed += b.speed ?? 0;
      s.atkSpeed += b.atkSpeed ?? 0;
      s.armor += b.armor ?? 0;
      s.dr = Math.max(s.dr, b.dr ?? 0);
      s.crit += b.crit ?? 0;
      if (b.counter) counter = true;
    }
    this.buffs.length = w;
    if (!counter) this.counter = null;
    if (this.evasionT > 0) this.evasionT -= dt;
    this.vigourT -= dt;
    if (this.vigourT <= 0) {
      this.vigourT = 1;
      this.vigour = this.run.player.stats.maxHp * 0.025;
    }
    if (this.shield > 0 && this.evasionT <= 0 && !this.buffs.some((b) => b.b.shield)) this.shield = 0;
    if (this.cls.id === 'reaper' || this.cls.id === 'deathblade') s.crit += 0.05;
  }

  private doFx(ev: Extract<ActionEv, { do: 'fx' }>) {
    const run = this.run;
    const p = run.player;
    const color = ev.color ?? this.cls.color;
    switch (ev.kind) {
      case 'shake':
        run.fx.shake(ev.shake ?? 0.2);
        break;
      case 'sound':
        if (ev.sound) run.fx.sound(ev.sound, 0.6);
        break;
      case 'light':
        run.fx.light(p.x, p.z, color, 2, (ev.r ?? 6) * 2, 0.8);
        {
          const f = this.fx.add('flash', p.x, p.z, 0.7, color);
          f.r = ev.r ?? 6;
          f.follow = true;
        }
        break;
      default: {
        const f = this.fx.add(ev.kind === 'burst' ? 'flash' : (ev.kind as 'ring' | 'flash'), p.x, p.z, 0.5, color);
        f.r = ev.r ?? 3;
        f.follow = ev.kind !== 'ring';
        if (ev.shake) run.fx.shake(ev.shake);
        run.fx.burst(p.x, 1, p.z, color, 24, 4, 0.16, 0.6, 'glow');
      }
    }
  }

  private doChain(cur: Playing, ev: ChainEv) {
    const run = this.run;
    const p = run.player;
    const [tx, tz] = this.anchor(cur, 'aim', 0, ev.range);
    const color = ev.color ?? 0x8ad8ff;
    const info = this.info(cur, ev);
    let e = run.enemies.nearest(tx, tz, 3.5, undefined, true) ?? run.enemies.nearest(p.x, p.z, ev.range, undefined, true);
    if (!e) {
      const b = this.fx.add('bolt', p.x, p.z, 0.2, color);
      b.y = 1.2;
      b.x2 = tx;
      b.z2 = tz;
      return;
    }
    const hit = new Set<number>();
    let sx = p.x;
    let sz = p.z;
    let hits = 0;
    for (let i = 0; i < ev.n && e; i++) {
      const target: Enemy = e;
      hit.add(target.uid);
      const fx0 = sx;
      const fz0 = sz;
      const go = () => {
        if (!target.alive) return;
        const b = this.fx.add('bolt', fx0, fz0, 0.25, color);
        b.y = i === 0 ? 1.3 : 0.9;
        b.x2 = target.x;
        b.z2 = target.z;
        run.combat.hit(target, info, i === 0 ? 1 : 0.85, target.x - fx0, target.z - fz0);
      };
      if (i === 0) go();
      else run.later(i * 0.06, go);
      hits++;
      sx = target.x;
      sz = target.z;
      e = run.enemies.nearest(sx, sz, ev.jump, hit, true);
    }
    this.onEventHits(cur, hits);
    run.fx.sound('zap', 0.5);
  }

  // ------------------------------------------------------------------ combat hooks
  /** Extra damage multiplier against an enemy (called by Combat). */
  damageMulVs(e: Enemy, info: DamageInfo, dirX: number, dirZ: number): number {
    let m = 1;
    const p = this.run.player;
    // back attack: the hit comes from behind the enemy's facing
    const fx = Math.sin(e.yaw);
    const fz = Math.cos(e.yaw);
    const ax = p.x - e.x;
    const az = p.z - e.z;
    const al = Math.hypot(ax, az) || 1;
    const behind = (ax * fx + az * fz) / al < -0.25;
    if (behind && info.source !== SRC_SUMMON) {
      const base = this.cls.id === 'deathblade' ? 1.4 : this.cls.id === 'reaper' ? 1.3 : 1.1;
      m *= Math.max(base, info.backMul) * (this.has('p_backstab') ? 1.25 : 1);
      if (Math.random() < 0.02 && this.run.fx.level() >= 0) this.run.fx.text(e.x, e.z, this.run.tr('act_back'), 0xd0a0ff);
    }
    if (info.execute > 1 && e.hp < e.maxHp * 0.3) m *= info.execute;
    if (this.has('p_reaper') && e.hp < e.maxHp * 0.3) m *= 1.4;
    if (e.markT > 0 && info.source === SRC_SKILL) m *= 1.25;
    if (e.brokenT > 0) m *= this.has('p_breakpoint') ? 1.5 : 1.3;
    void dirX;
    void dirZ;
    return m;
  }

  /** Damage landed on an enemy (after it was applied). */
  onHit(e: Enemy, info: DamageInfo, dmg: number, crit: boolean) {
    // awakening gauge fills from fighting
    const gain = 0.12 + info.stag * 0.035 + Math.min(1.5, dmg / Math.max(40, e.maxHp) * 2);
    this.addUlt(gain * (info.source === SRC_SUMMON ? 0.5 : 1));
    if (info.source === SRC_SUMMON) this.gain(this.cls.res.onBasic * 0.6);
    // battle vigour: front-line classes heal a little with every blow (capped per second)
    if (this.melee && info.source !== SRC_SUMMON && this.vigour > 0) {
      const p = this.run.player;
      const h = Math.min(this.vigour, p.stats.maxHp * 0.006);
      this.vigour -= h;
      p.heal(h, true);
    }
    void crit;
  }

  onKill(e: Enemy) {
    this.gain(this.cls.res.onKill);
    this.addUlt(e.elite ? 6 : e.boss ? 20 : 0.8);
  }

  /**
   * Incoming damage hook (before armor): damage reduction, shields, counters and heavy-hit interrupts.
   * Returns the damage that goes through.
   */
  absorb(raw: number, source: Enemy | null): number {
    const run = this.run;
    const p = run.player;
    let dmg = raw * (1 - this.buff.dr) * (1 - this.ward);
    if (this.counter && source && this.counter.cd <= 0) {
      this.counter.cd = 0.35;
      const cur = this.cur ?? this.dummy();
      const a = Math.atan2(source.z - p.z, source.x - p.x);
      this.hitShape(cur, this.counter.ev, p.x, p.z, Math.cos(a), Math.sin(a));
      const f = this.fx.add('block', p.x, p.z, 0.3, 0xffe08a);
      f.a = a;
      run.fx.sound('shield', 0.5);
    }
    if (this.shield > 0) {
      const take = Math.min(this.shield, dmg);
      this.shield -= take;
      dmg -= take;
      if (this.shield <= 0) run.fx.sound('shield', 0.5);
    }
    this.gain(dmg * this.cls.res.onHurt);
    this.ult = Math.min(100, this.ult + (p.level >= this.cls.ult.unlock ? dmg * 0.05 : 0));
    // heavy hits interrupt what the hero is doing unless the step has armor
    if (dmg > p.stats.maxHp * 0.15 && !this.superArmor && this.cur?.src !== 'dodge') {
      this.cur = null;
      this.mover = null;
      this.stunT = 0.35;
      p.jumpY = 0;
      this.playAnim(this.cls.basic.steps[0].anim.slice(0, 2) + '_heavyhit', 1);
    }
    return dmg;
  }

  private dummy(): Playing {
    const p = this.run.player;
    return { src: 'skill', slot: -1, def: null, step: this.cls.basic.steps[0], idx: 0, phase: 'play', t: 0, evs: [], next: 0, rate: 1, dirX: p.fx, dirZ: p.fz, tx: p.x, tz: p.z, mul: 1, stagMul: 1, areaMul: 1, extraSt: null, superArmor: false, prep: 0, gained: true };
  }

  /** Visible stealth amount for the renderer (0..1). */
  get stealth(): number {
    return this.stealthT > 0 ? Math.min(1, this.stealthT * 4) : 0;
  }

  /** Charge progress 0..1 (HUD / VFX) or -1. */
  get charge(): number {
    const c = this.cur;
    if (!c || c.phase !== 'charge') return -1;
    return Math.min(1, c.prep / (c.def?.chargeMax ?? 1));
  }

  /** Cast progress 0..1 or -1. */
  get casting(): number {
    const c = this.cur;
    if (!c || c.phase !== 'cast') return -1;
    const total = c.def?.castTime ?? 1;
    return 1 - Math.max(0, c.prep) / total;
  }

  clearAll() {
    this.cur = null;
    this.mover = null;
    this.lasting.length = 0;
    this.summons.clear();
    this.fx.clear();
  }
}

function scaleShape(s: Shape, k: number): Shape {
  if (k === 1) return s;
  switch (s.k) {
    case 'circle':
      return { ...s, r: s.r * k };
    case 'ring':
      return { ...s, r0: s.r0 * k, r1: s.r1 * k };
    case 'cone':
      return { ...s, r: s.r * k };
    case 'rect':
      return { ...s, len: s.len * k, w: s.w * k };
    case 'sides':
      return { ...s, len: s.len * k, w: s.w * k };
    case 'cross':
      return { ...s, len: s.len * k, w: s.w * k };
  }
}
