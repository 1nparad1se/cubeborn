import type { BossAttack, BossDef, BossPhase, EnemyDef } from '../../data/types';
import { BOSS_BY_ID } from '../../data/bosses';
import { BOSS_TUNING, bossLevelScale } from '../../config/bossTuning';
import { PROG } from '../../config/progression';
import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { detonate, SKILLS, skillName, n, type BossAnim, type BossTele, type Cast } from './BossAttacks';

const bossDefs: Record<string, EnemyDef> = {};
/** Synthetic enemy definition so a boss can live in the enemy pool. */
export function bossEnemyDef(def: BossDef): EnemyDef {
  return (bossDefs[def.id] ??= {
    id: def.id,
    name: def.name,
    category: 'special',
    behavior: 'chase',
    hp: def.hp,
    damage: def.damage,
    speed: 0,
    radius: def.radius,
    size: 1,
    xp: 150,
    kbResist: 1,
    model: def.model,
    flying: def.flying,
  });
}

const ENRAGE_ATTACK: BossAttack = { type: 'enrage', cd: 0 };

/**
 * Drives one boss: intro, phases (with enrage), a skill state machine (wind-up -> act -> recover),
 * stagger checks and counter windows, body collision with the hero and the death sequence.
 * The boss fights inside the arena (BossArena): no other monsters are around.
 */
export class BossController {
  phase = 0;
  cds: number[] = [];
  /** Seconds before another skill may start. */
  busy = 1.5;
  cast: Cast | null = null;
  /** Ground telegraphs (drawn by the renderer; some carry delayed blasts). */
  readonly teles: BossTele[] = [];
  crystals: Enemy[] = [];
  hidden = 0;
  anim = 0;
  /** Visual cue for the renderer (0..1) while casting (kept for older views). */
  cast01 = 0;
  /** Leap height for the renderer. */
  airY = 0;
  /** Intro (rise + roar) seconds left; the boss neither acts nor takes damage. */
  introT = 0;
  readonly introMax = 3.2;
  /** Self-stun after ramming a wall or being countered (the renderer plays the stun pose). */
  dazeT = 0;
  /** Seconds since the last phase change (enrage flare on the model). */
  phaseT = 99;
  /** Wind-up multiplier (enrage phases are quicker). */
  windMul = 1;
  /** Boss level (monster level when it appeared). */
  level = 1;
  /** Skill name floating over the boss. */
  label = '';
  labelT = 0;

  constructor(
    public run: Run,
    public e: Enemy,
    public def: BossDef,
    public isFinal: boolean,
    public isClone = false,
  ) {
    this.enterPhase(0);
  }

  /** Health/damage scale this boss was spawned with. */
  hpScale = 1;
  dmgScale = 1;
  enraged = false;
  /** A roaming night boss (day/night cycle), not part of the wave plan. */
  nightBoss = false;
  /** Stagger check: a long cast the hero must break with stagger damage before it lands. */
  checkT = 0;
  checkMax = 0;
  checkNeed = 1;
  checkDone = 0;
  nextCheck = 30;
  private checkZone: { active: boolean } | null = null;

  /**
   * Spawns a boss. Health and damage follow the monster level (PROG) through BOSS_TUNING, times the
   * boss's own toughness, the difficulty, the hero/zone level gap and the extra `hpMul` / `dmgMul`.
   */
  static spawn(run: Run, id: string, x: number, z: number, isFinal: boolean, hpMul = 1, isClone = false, dmgMul = 1): BossController | null {
    const def = BOSS_BY_ID[id];
    if (!def) return null;
    const e = run.enemies.spawn(bossEnemyDef(def), x, z, { noScale: true });
    if (!e) return null;
    const lv = run.zoneLevel;
    const ls = bossLevelScale(lv);
    const gap = PROG.enemyScale(lv, run.player.level);
    e.maxHp = e.hp = Math.max(1, ls.hp * def.hp * run.diff.hp * hpMul * gap.hp * (1 + (run.player.stats.curse - 1) * 0.5) * run.debug.enemyHp);
    e.damage = ls.dmg * def.damage * run.diff.damage * dmgMul * gap.dmg * run.debug.enemyDmg;
    e.speed = 0;
    e.radius = def.radius;
    e.scale = 1;
    e.kbResist = 1;
    e.xp = isClone ? 20 : Math.round(150 * PROG.xpMul(lv, run.player.level) * (isFinal ? 2 : 1));
    e.flying = !!def.flying;
    // no contact damage: the boss hurts through its skills; its body blocks the hero instead
    e.touchCd = 1e9;
    const c = new BossController(run, e, def, isFinal, isClone);
    c.hpScale = hpMul;
    c.dmgScale = dmgMul;
    c.level = lv;
    e.boss = c;
    run.bosses.push(c);
    if (!isClone) {
      c.introT = c.introMax;
      e.invuln = true;
      run.arena.start(c);
    }
    return c;
  }

  /** Stagger bar size: grows with boss health; each phase refills it. */
  stagMax(): number {
    return (BOSS_TUNING.stagBase + Math.sqrt(this.e.maxHp) * BOSS_TUNING.stagSqrt) * (1 + this.phase * 0.25);
  }

  /** Stagger break: every attack in progress is interrupted and the boss is stunned (vulnerable). */
  onStagger() {
    if (this.checkT > 0) {
      this.checkT = 0;
      if (this.checkZone) this.checkZone.active = false;
      this.checkZone = null;
    }
    this.interrupt();
    this.busy = 1.2;
  }

  /** Cancels the skill in progress and its telegraphs. */
  interrupt() {
    const c = this.cast;
    this.cast = null;
    this.cast01 = 0;
    this.airY = 0;
    this.e.vx = this.e.vz = 0;
    this.hidden = 0;
    // a cancelled enrage / hide must never leave the boss invulnerable
    if (this.introT <= 0) this.e.invuln = false;
    for (let i = this.teles.length - 1; i >= 0; i--) if (this.teles[i].owned) this.teles.splice(i, 1);
    for (const l of this.run.hazards.lasers) if (l.active && l.owner === this.e) l.active = false;
    this.run.player.pullX = this.run.player.pullZ = 0;
    void c;
  }

  /** Damage taken multiplier outside a stagger window. */
  dmgTakenMul(): number {
    return 1;
  }

  get phaseDef(): BossPhase {
    return this.def.phases[this.phase];
  }

  /** What the model shows: the skill family, its stage (wind / act / recover / idle) and progress. */
  get animState(): { kind: BossAnim | 'idle' | 'stun' | 'intro' | 'check'; stage: number; k: number } {
    if (this.introT > 0) return { kind: 'intro', stage: 0, k: 1 - this.introT / this.introMax };
    if (this.e.brokenT > 0 || this.dazeT > 0 || this.e.stunT > 0 || this.e.freezeT > 0) return { kind: 'stun', stage: 0, k: 0 };
    if (this.checkT > 0) return { kind: 'check', stage: 0, k: 1 - this.checkT / this.checkMax };
    const c = this.cast;
    if (!c) return { kind: 'idle', stage: -1, k: 0 };
    const dur = c.stage === 0 ? c.wind : c.stage === 1 ? c.act : c.rec;
    return { kind: c.impl.anim, stage: c.stage, k: dur > 0 ? Math.min(1, c.t / dur) : 1 };
  }

  private enterPhase(i: number) {
    this.phase = i;
    const ph = this.def.phases[i];
    this.e.stag = 0;
    this.e.stagMax = 0;
    this.cds = ph.attacks.map((a, k) => a.cd * 0.4 + k * 0.8);
    this.windMul = ph.enrage ? 0.82 : 1;
    if (i > 0) {
      this.phaseT = 0;
      this.run.fx.shake(0.4);
      this.run.fx.burst(this.e.x, 1.5, this.e.z, this.def.color, 40, 6, 0.25, 0.9, 'glow');
      this.run.fx.sound('bossPhase');
      this.run.events.emit('bossPhase', this);
      if (ph.enrage && !this.isClone) {
        this.interrupt();
        this.startCast(ENRAGE_ATTACK);
      }
      // every new phase is followed by a stagger check
      if (!this.isClone) this.nextCheck = 9;
    }
    if (ph.onEnter) for (const a of ph.onEnter) this.startCast(a);
  }

  /** Starts the stagger check: the boss channels a huge blast unless broken in time. */
  private startCheck() {
    const run = this.run;
    const e = this.e;
    this.checkMax = this.checkT = 6;
    this.checkDone = 0;
    // sized so a focused rotation of stagger skills breaks it, independent of the normal bar
    this.checkNeed = Math.round((BOSS_TUNING.checkBase + Math.sqrt(e.maxHp) * BOSS_TUNING.checkSqrt + this.phase * 40) * (this.isFinal ? 1.2 : 1));
    e.stag = 0;
    this.interrupt();
    this.checkZone = run.hazards.zone(e.x, e.z, e.radius + 6, this.checkMax, e.damage * 2.6, { color: 0xff7a1a });
    run.fx.sound('bossRoar', 0.8);
    run.fx.text(e.x, e.z, run.tr('act_check'), 0xffb040);
  }

  /** Damage dealt during a stagger check counts toward it. */
  checkHit(stag: number) {
    if (this.checkT <= 0) return false;
    this.checkDone += stag;
    return this.checkDone >= this.checkNeed;
  }

  /** Counter window: the boss is winding up a counterable skill (charge, leap, roar). */
  get counterOpen(): boolean {
    const c = this.cast;
    return !!c && c.stage === 0 && !!c.impl.counter && c.t > 0.15;
  }

  /** A skill landed in the counter window: the move is cancelled and the boss reels. */
  countered() {
    const run = this.run;
    const e = this.e;
    this.interrupt();
    this.daze(1.8);
    run.fx.text(e.x, e.z, run.tr('act_counter'), 0x8ad8ff);
    run.fx.sound('shield', 0.9);
    run.fx.shake(0.3);
    const f = run.action.fx.add('break', e.x, e.z, 0.6, 0x8ad8ff);
    f.r = e.radius * 2;
  }

  /** The boss stands dazed (stun pose, open to punishment). */
  daze(t: number) {
    this.dazeT = Math.max(this.dazeT, t);
    this.busy = Math.max(this.busy, t * 0.5);
    this.e.vx = this.e.vz = 0;
  }

  /** Turns toward a direction (x, z); k = turn share per call. */
  faceDir(dx: number, dz: number, k = 0.2) {
    if (dx === 0 && dz === 0) return;
    const want = Math.atan2(dx, dz);
    let d = want - this.e.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.e.yaw += d * k;
  }

  startCast(a: BossAttack) {
    const impl = SKILLS[a.type];
    if (!impl) return;
    const c: Cast = { a, impl, stage: 0, t: 0, wind: 0.5, act: 0.1, rec: 0.5, ang: 0, tx: 0, tz: 0, sx: 0, sz: 0, dist: 0, left: 0, hit: false, acc: 0, wall: false };
    this.cast = c;
    impl.begin(this, c);
    this.cast01 = 1;
    const name = skillName(a);
    if (name) {
      this.label = name;
      this.labelT = Math.max(1.2, c.wind + 0.4);
    }
  }

  /** Telegraph timers and delayed blasts (they keep running between casts). */
  private updateTeles(dt: number) {
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const tl = this.teles[i];
      if (tl.done) {
        tl.t -= dt;
        if (tl.t < -0.25) this.teles.splice(i, 1);
        continue;
      }
      tl.t -= dt;
      if (tl.t <= 0) {
        if (tl.blast) detonate(this, tl);
        else tl.done = true;
        tl.t = 0;
      }
    }
  }

  private updateCast(dt: number) {
    const c = this.cast!;
    c.t += dt;
    const e = this.e;
    const p = this.run.player;
    if (c.stage === 0) {
      e.vx = e.vz = 0;
      // track the hero a little during the first part of a wind-up
      if (c.impl.anim !== 'charge' && c.impl.anim !== 'leap') this.faceDir(p.x - e.x, p.z - e.z, 0.08);
      else this.faceDir(Math.cos(c.ang), Math.sin(c.ang), 0.25);
      if (c.t >= c.wind) {
        c.stage = 1;
        c.t = 0;
        c.impl.strike?.(this, c);
      }
      return;
    }
    if (c.stage === 1) {
      if (c.impl.tick) c.impl.tick(this, c, dt);
      else e.vx = e.vz = 0;
      if (c.t >= c.act) {
        if (c.impl.again?.(this, c)) {
          c.stage = 0;
          c.t = 0;
          return;
        }
        e.vx = e.vz = 0;
        c.stage = 2;
        c.t = 0;
      }
      return;
    }
    e.vx = e.vz = 0;
    if (c.t >= c.rec) {
      this.cast = null;
      this.busy = (this.phaseDef.gap ?? 1.1) * (this.phaseDef.enrage ? 0.75 : 1);
    }
  }

  update(dt: number) {
    const run = this.run;
    const e = this.e;
    const p = run.player;
    this.anim += dt;
    if (this.cast01 > 0) this.cast01 -= dt * 2;
    if (this.introT > 0) {
      this.introT -= dt;
      e.vx = e.vz = 0;
      this.faceDir(p.x - e.x, p.z - e.z, 0.1);
      if (this.introT <= this.introMax - 1.3 && this.introT + dt > this.introMax - 1.3) {
        run.fx.sound('bossRoar', 1);
        run.fx.shake(0.8);
        run.fx.burst(e.x, 2, e.z, this.def.color, 50, 8, 0.3, 1, 'glow');
      }
      if (this.introT <= 0) e.invuln = false;
      return;
    }
    // phase transitions
    const frac = e.hp / e.maxHp;
    const next = this.def.phases[this.phase + 1];
    if (next && frac <= next.hp && !this.isClone) this.enterPhase(this.phase + 1);
    if (this.dazeT > 0) {
      this.dazeT -= dt;
      e.vx = e.vz = 0;
      return;
    }
    if (this.checkT > 0) {
      e.vx = e.vz = 0;
      this.cast01 = 1;
      this.checkT -= dt;
      if (this.checkZone) {
        const z = this.checkZone as { x: number; z: number; active: boolean };
        z.x = e.x;
        z.z = e.z;
      }
      if (this.checkT <= 0) {
        // failed: the blast lands (the hazard zone deals the damage) and a shock rolls out
        this.checkZone = null;
        run.fx.text(e.x, e.z, run.tr('act_check_fail'), 0xff5a3a);
        run.fx.shake(0.7);
        run.hazards.shock(e.x, e.z, 16, 9, 1.2, e.damage * 0.7, 0xff7a1a);
        this.busy = 1.2;
      }
      return;
    }
    if (this.cast) {
      this.updateCast(dt);
      return;
    }
    if (!this.isClone && (this.phase > 0 || this.isFinal) && e.stunT <= 0) {
      this.nextCheck -= dt;
      if (this.nextCheck <= 0) {
        this.nextCheck = BOSS_TUNING.checkEvery + Math.random() * 10;
        this.startCheck();
        return;
      }
    }
    // pick a skill: any ready one whose reach covers the hero; otherwise walk closer
    const ph = this.phaseDef;
    for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
    const gapToHero = Math.hypot(p.x - e.x, p.z - e.z) - e.radius;
    let pick = -1;
    if (this.busy > 0) this.busy -= dt;
    else {
      const ready: number[] = [];
      for (let i = 0; i < this.cds.length; i++) if (this.cds[i] <= 0 && gapToHero <= n(ph.attacks[i], 'range', 99) && gapToHero >= n(ph.attacks[i], 'min', -9)) ready.push(i);
      if (ready.length) pick = ready[Math.floor(Math.random() * ready.length)];
    }
    if (pick >= 0) {
      const a = ph.attacks[pick];
      this.cds[pick] = (a.cd * (0.85 + Math.random() * 0.3)) / Math.sqrt(run.diff.speed) / (ph.enrage ? 1.15 : 1);
      e.vx = e.vz = 0;
      this.startCast(a);
      return;
    }
    this.move(dt, gapToHero);
  }

  /** Runs every frame, even while the boss is stunned or frozen (called by the arena). */
  tick(dt: number) {
    this.phaseT += dt;
    if (this.labelT > 0) this.labelT -= dt;
    this.e.touchCd = 1e9;
    this.updateTeles(dt);
    if (this.introT <= 0) this.pushHero();
  }

  /** The body is solid: the hero is pushed out of it. */
  private pushHero() {
    const p = this.run.player;
    const e = this.e;
    if (this.hidden > 0 || this.airY > 0.5 || p.dead) return;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    const min = e.radius * 0.9 + p.radius;
    if (d < min) {
      const k = (min - d) / Math.max(d, 0.01);
      p.slide(dx * k, dz * k);
    }
  }

  private move(dt: number, gap: number) {
    const run = this.run;
    const e = this.e;
    const p = run.player;
    const ph = this.phaseDef;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const sp = ph.speed * run.diff.speed;
    let ux = dx / d;
    let uz = dz / d;
    if (!this.def.flying && d > e.radius + 3) {
      const cx = Math.floor(e.x);
      const cz = Math.floor(e.z);
      if (run.nav.has(cx, cz)) {
        const i = cz * run.terrain.size + cx;
        if (run.nav.dirX[i] || run.nav.dirZ[i]) {
          ux = run.nav.dirX[i];
          uz = run.nav.dirZ[i];
        }
      }
    }
    switch (ph.move) {
      case 'stationary':
        e.vx = e.vz = 0;
        this.faceDir(dx, dz, 0.05);
        return;
      case 'keep': {
        const want = 7;
        const m = gap > want + 1 ? 1 : gap < want - 2 ? -0.8 : 0;
        e.vx = ux * sp * m - uz * sp * 0.4;
        e.vz = uz * sp * m + ux * sp * 0.4;
        this.faceDir(dx, dz, 0.08);
        return;
      }
      default:
        if (gap > 1.2) {
          e.vx = ux * sp;
          e.vz = uz * sp;
        } else {
          e.vx = e.vz = 0;
          this.faceDir(dx, dz, 0.08);
        }
    }
    void dt;
  }

  onDeath() {
    const run = this.run;
    const e = this.e;
    this.interrupt();
    this.teles.length = 0;
    run.fx.shake(0.9);
    run.fx.vibrate(120);
    run.fx.light(e.x, e.z, this.def.color, 6, 16, 1);
    run.fx.burst(e.x, 1.5, e.z, this.def.color, 80, 9, 0.3, 1.4, 'debris');
    run.fx.burst(e.x, 1.5, e.z, 0xffffff, 40, 7, 0.2, 1, 'glow');
    run.fx.sound('bossDeath');
    for (const c of this.crystals) if (c.alive) run.combat.killEnemy(c, true);
    for (const l of run.hazards.lasers) if (l.owner === e) l.active = false;
    run.bosses.splice(run.bosses.indexOf(this), 1);
    run.pickups.dropXp(e.x, e.z, e.xp);
    run.stats.kills++;
    if (!this.isClone) {
      run.pickups.spawnChest(e.x, e.z, 1);
      run.stats.bossesKilled.push(this.def.id);
      if (this.nightBoss) run.stats.nightBossKills++;
      run.stats.gold += 4 * run.player.stats.greed;
      for (let i = 0; i < 4; i++) run.pickups.spawn('gold', e.x, e.z, 1, true);
      run.events.emit('bossDefeated', this);
      run.arena.onBossDead(this);
    }
    if (this.isFinal && !run.bosses.some((b) => b.isFinal)) run.onFinalBossDefeated();
  }
}
