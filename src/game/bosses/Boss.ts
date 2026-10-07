import { BALANCE } from '../../config/balance';
import type { BossAttack, BossDef, BossPhase } from '../../data/types';
import { BOSS_BY_ID } from '../../data/bosses';
import { TAU } from '../../core/math';
import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { runAttack } from './BossAttacks';
import type { EnemyDef } from '../../data/types';

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

/** Drives one boss enemy: phases, movement and attack scheduling. */
export class BossController {
  phase = 0;
  cds: number[] = [];
  /** Seconds before another attack may start. */
  busy = 1.5;
  // durational attack state
  spiralT = 0;
  spiralAngle = 0;
  spiralAttack: BossAttack | null = null;
  spiralAcc = 0;
  dashLeft = 0;
  /** 0 idle, 1 telegraphing, 2 charging */
  dashPhase = 0;
  dashTele = 0.7;
  dashT = 0;
  dashX = 0;
  dashZ = 0;
  dashSpeed = 0;
  pullT = 0;
  pullStrength = 0;
  crystals: Enemy[] = [];
  wanderX = 0;
  wanderZ = 0;
  wanderT = 0;
  hidden = 0;
  anim = 0;
  /** Visual cue for the renderer (0..1) while casting. */
  cast = 0;

  constructor(
    public run: Run,
    public e: Enemy,
    public def: BossDef,
    public isFinal: boolean,
    public isClone = false,
  ) {
    this.enterPhase(0);
  }

  /** Health/damage scale this boss was spawned with (clones inherit it). */
  hpScale = 1;
  dmgScale = 1;
  enraged = false;
  /** A roaming night boss (day/night cycle), not part of the wave plan. */
  nightBoss = false;

  static spawn(run: Run, id: string, x: number, z: number, isFinal: boolean, hpMul = 1, isClone = false, dmgMul = 1): BossController | null {
    const def = BOSS_BY_ID[id];
    if (!def) return null;
    const e = run.enemies.spawn(bossEnemyDef(def), x, z, { noScale: true });
    if (!e) return null;
    // re-skin the pooled enemy as the boss
    e.maxHp = e.hp = def.hp * BALANCE.bossHpMul * run.diff.hp * hpMul * (1 + (run.player.stats.curse - 1) * 0.5);
    e.damage = def.damage * run.diff.damage * dmgMul;
    e.speed = 0;
    e.radius = def.radius;
    e.scale = 1;
    e.kbResist = 1;
    e.xp = isClone ? 20 : 150;
    e.flying = !!def.flying;
    const c = new BossController(run, e, def, isFinal, isClone);
    c.hpScale = hpMul;
    c.dmgScale = dmgMul;
    e.boss = c;
    run.bosses.push(c);
    return c;
  }

  get phaseDef(): BossPhase {
    return this.def.phases[this.phase];
  }

  private enterPhase(i: number) {
    this.phase = i;
    const ph = this.def.phases[i];
    this.cds = ph.attacks.map((a, k) => a.cd * 0.5 + k * 0.7);
    if (i > 0) {
      this.busy = 1.2;
      this.run.fx.shake(0.4);
      this.run.fx.burst(this.e.x, 1.5, this.e.z, this.def.color, 40, 6, 0.25, 0.9, 'glow');
      this.run.fx.sound('bossPhase');
      this.run.events.emit('bossPhase', this);
    }
    if (ph.onEnter) for (const a of ph.onEnter) runAttack(this, a);
  }

  update(dt: number) {
    const run = this.run;
    const e = this.e;
    const p = run.player;
    this.anim += dt;
    if (this.cast > 0) this.cast -= dt * 2;
    // phase transitions
    const frac = e.hp / e.maxHp;
    const next = this.def.phases[this.phase + 1];
    if (next && frac <= next.hp && !this.isClone) this.enterPhase(this.phase + 1);
    // shield crystals
    if (this.crystals.length) {
      this.crystals = this.crystals.filter((c) => c.alive && c.def.id === 'shield_crystal');
      e.invuln = this.crystals.length > 0;
    }
    if (this.hidden > 0) {
      this.hidden -= dt;
      e.vx = e.vz = 0;
      if (this.hidden <= 0) {
        e.invuln = this.crystals.length > 0;
        run.hazards.explode(e.x, e.z, 2.6, e.damage, this.def.color);
      }
      return;
    }
    if (this.pullT > 0) {
      this.pullT -= dt;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      p.pullX = (dx / d) * this.pullStrength;
      p.pullZ = (dz / d) * this.pullStrength;
    }
    // spiral emission
    if (this.spiralT > 0 && this.spiralAttack) {
      const a = this.spiralAttack;
      this.spiralT -= dt;
      this.spiralAcc += dt * (a.rate as number);
      this.spiralAngle += (((a.turn as number) ?? 60) * Math.PI) / 180 * dt;
      const arms = (a.arms as number) ?? 4;
      while (this.spiralAcc >= 1) {
        this.spiralAcc--;
        for (let k = 0; k < arms; k++) {
          const ang = this.spiralAngle + (k / arms) * TAU;
          const sp = (a.speed as number) ?? 5;
          run.hazards.bullet(e.x, e.z, Math.cos(ang) * sp, Math.sin(ang) * sp, e.damage * 0.55, 0.32, 5, a.slow ? 0x8ae8ff : 0xff3a8a, !!a.slow);
        }
      }
      this.cast = 1;
    }
    // dash sequence: telegraph -> charge, repeated dashLeft times
    if (this.dashPhase === 1) {
      e.vx = e.vz = 0;
      this.dashT -= dt;
      if (this.dashT <= 0) {
        this.dashPhase = 2;
        this.dashT = this.dashDist / this.dashSpeed;
        run.fx.sound('dash');
      }
      return;
    }
    if (this.dashPhase === 2) {
      e.vx = this.dashX * this.dashSpeed;
      e.vz = this.dashZ * this.dashSpeed;
      this.dashT -= dt;
      if (this.dashT <= 0) {
        this.dashLeft--;
        if (this.dashLeft > 0) this.startDash();
        else {
          this.dashPhase = 0;
          this.busy = 0.7;
        }
      }
      return;
    }
    this.move(dt);
    // attack scheduling
    if (this.busy > 0) {
      this.busy -= dt;
      return;
    }
    const ph = this.phaseDef;
    for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
    let pick = -1;
    for (let i = 0; i < this.cds.length; i++) if (this.cds[i] <= 0 && (pick < 0 || this.cds[i] < this.cds[pick])) pick = i;
    if (pick >= 0) {
      const a = ph.attacks[pick];
      this.cds[pick] = a.cd * (0.85 + Math.random() * 0.3) / Math.sqrt(run.diff.speed);
      this.busy = 0.6;
      this.cast = 1;
      runAttack(this, a);
    }
  }

  dashDist = 10;

  startDash() {
    const e = this.e;
    const p = this.run.player;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    this.dashX = dx / d;
    this.dashZ = dz / d;
    this.dashDist = Math.min(14, d + 4);
    this.dashPhase = 1;
    this.dashT = this.dashTele;
    this.run.hazards.lineTelegraph(e.x, e.z, this.dashX, this.dashZ, this.dashDist, e.radius * 2, this.dashTele);
  }

  /** Sets a phase without its entry actions (used by clones). */
  forcePhase(i: number) {
    this.phase = i;
    this.cds = this.def.phases[i].attacks.map((a, k) => a.cd * 0.5 + k * 0.7);
  }

  private move(dt: number) {
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
    if (!this.def.flying && d > 3) {
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
        break;
      case 'keep': {
        const want = 7;
        const m = d > want + 1 ? 1 : d < want - 1 ? -0.8 : 0;
        e.vx = ux * sp * m - uz * sp * 0.5;
        e.vz = uz * sp * m + ux * sp * 0.5;
        break;
      }
      case 'wander': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2.5;
          const a = Math.random() * TAU;
          this.wanderX = p.x + Math.cos(a) * 6;
          this.wanderZ = p.z + Math.sin(a) * 6;
        }
        const wx = this.wanderX - e.x;
        const wz = this.wanderZ - e.z;
        const wd = Math.hypot(wx, wz) || 1;
        e.vx = wd > 0.5 ? (wx / wd) * sp : 0;
        e.vz = wd > 0.5 ? (wz / wd) * sp : 0;
        break;
      }
      default:
        e.vx = d > 1 ? ux * sp : 0;
        e.vz = d > 1 ? uz * sp : 0;
    }
  }

  onDeath() {
    const run = this.run;
    const e = this.e;
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
      run.stats.gold += 4 * run.player.stats.greed;
      for (let i = 0; i < 4; i++) run.pickups.spawn('gold', e.x, e.z, 1, true);
      run.events.emit('bossDefeated', this);
    }
    if (this.isFinal && !run.bosses.some((b) => b.isFinal)) run.onFinalBossDefeated();
  }
}
