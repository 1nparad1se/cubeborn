import { TAU } from '../../core/math';
import { BOSS_BY_ID } from '../../data/bosses';
import { BOSS_TUNING } from '../../config/bossTuning';
import type { EnemyDef } from '../../data/types';
import type { Run } from '../Run';
import type { BossController } from './Boss';

/** The dead boss's body: the renderer plays the death animation on it. */
export interface BossCorpse {
  id: string;
  model: string;
  x: number;
  z: number;
  yaw: number;
  color: number;
  height: number;
  t: number;
  max: number;
}

/**
 * Boss arena: when a boss appears every other monster vanishes in a puff, a ring of glowing pillars
 * rises around the hero and the boss, and nobody leaves it until the boss falls. Monster spawning,
 * scripted map events and the wave clock are paused for the whole fight. After the death animation
 * the pillars sink and the run continues.
 */
export class BossArena {
  /** off: no fight; rise: pillars rising; fight; fall: boss dead, death animation; drop: pillars sinking. */
  state: 'off' | 'rise' | 'fight' | 'fall' | 'drop' = 'off';
  x = 0;
  z = 0;
  r = BOSS_TUNING.arenaR;
  /** Pillar height factor 0..1 for the renderer. */
  rise = 0;
  t = 0;
  boss: BossController | null = null;
  corpse: BossCorpse | null = null;

  constructor(private run: Run) {}

  /** True while the arena holds the run (spawns and the wave clock paused). */
  get active(): boolean {
    return this.state !== 'off';
  }

  /** Spawning gate: during the fight only bosses may appear. */
  allows(def: EnemyDef): boolean {
    return !this.active || !!BOSS_BY_ID[def.id];
  }

  /** Raises the arena around the hero and places the boss inside. */
  start(b: BossController) {
    const run = this.run;
    const p = run.player;
    // a second boss (e.g. a roaming night boss) leaves the stage to the new one
    for (const o of [...run.bosses]) {
      if (o === b || o.isClone) continue;
      if (o.e.alive) {
        run.fx.burst(o.e.x, 1.5, o.e.z, o.def.color, 40, 6, 0.3, 0.9, 'smoke');
        o.interrupt();
        run.enemies.release(o.e);
      }
      run.bosses.splice(run.bosses.indexOf(o), 1);
    }
    this.boss = b;
    this.corpse = null;
    this.clearMobs();
    if (this.state !== 'fight') {
      this.pickCenter(p.x, p.z);
      this.state = 'rise';
      this.t = 0;
      this.rise = 0;
    }
    // the boss enters on the far side, facing the hero
    const e = b.e;
    let ang = Math.atan2(this.z - p.z, this.x - p.x);
    if (Math.hypot(this.z - p.z, this.x - p.x) < 1) ang = run.rng.next() * TAU;
    let placed = false;
    for (let k = 0; k < 16 && !placed; k++) {
      const a = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
      for (const d of [this.r * 0.5, this.r * 0.4, this.r * 0.3]) {
        const x = this.x + Math.cos(a) * d;
        const z = this.z + Math.sin(a) * d;
        if (Math.hypot(x - p.x, z - p.z) < e.radius + 5) continue;
        if (b.def.flying || run.terrain.walkableAt(x, z)) {
          e.x = x;
          e.z = z;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      e.x = this.x;
      e.z = this.z;
    }
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
    run.hazards.clearAll();
    run.fx.shake(0.5);
  }

  /** Every monster leaves in a puff of smoke. */
  private clearMobs() {
    const run = this.run;
    for (const e of run.enemies.list) {
      if (!e.active || e.boss) continue;
      if (e.dying === 0) run.fx.burst(e.x, 0.6 * e.scale, e.z, 0xd8d0e0, 8, 2.5, 0.3, 0.8, 'smoke');
      run.enemies.release(e);
    }
    run.fx.sound('teleport', 0.6);
  }

  /** Centre: the most open spot close to the hero (the hero must start well inside). */
  private pickCenter(px: number, pz: number) {
    const run = this.run;
    const t = run.terrain;
    const R = this.r;
    const lim = (v: number) => Math.min(t.size - R - 2, Math.max(R + 2, v));
    let best = -1;
    let bx = lim(px);
    let bz = lim(pz);
    for (let k = 0; k < 25; k++) {
      const a = (k / 24) * TAU;
      const d = k === 0 ? 0 : 3 + (k % 3) * 2;
      const cx = lim(px + Math.cos(a) * d);
      const cz = lim(pz + Math.sin(a) * d);
      if (Math.hypot(cx - px, cz - pz) > R - 4) continue;
      let open = 0;
      for (let gz = -R; gz <= R; gz += 2)
        for (let gx = -R; gx <= R; gx += 2) {
          if (gx * gx + gz * gz > R * R) continue;
          if (t.walkableAt(cx + gx, cz + gz)) open++;
        }
      const score = open - Math.hypot(cx - px, cz - pz) * 0.5;
      if (score > best) {
        best = score;
        bx = cx;
        bz = cz;
      }
    }
    this.x = bx;
    this.z = bz;
  }

  onBossDead(b: BossController) {
    if (b !== this.boss) return;
    const e = b.e;
    this.corpse = { id: b.def.id, model: b.def.model, x: e.x, z: e.z, yaw: e.yaw, color: b.def.color, height: b.def.height, t: 2.6, max: 2.6 };
    this.boss = null;
    this.state = 'fall';
    this.t = 0;
  }

  update(dt: number) {
    if (this.corpse) {
      this.corpse.t -= dt;
      if (this.corpse.t <= -1) this.corpse = null;
    }
    if (this.state === 'off') return;
    const run = this.run;
    const p = run.player;
    this.t += dt;
    // the wave clock stands still during the fight
    if (!run.waves.wave.final) run.waves.wave.start += dt;
    for (const b of run.bosses) b.tick(dt);
    switch (this.state) {
      case 'rise':
        this.rise = Math.min(1, this.t / 1.2);
        if (this.rise >= 1) this.state = 'fight';
        break;
      case 'fight':
        this.rise = 1;
        if (!this.boss || !this.boss.e.alive) {
          // the boss vanished without a death (developer tools, run end)
          this.state = 'drop';
          this.t = 0;
        }
        break;
      case 'fall':
        if (this.t > 2.4) {
          this.state = 'drop';
          this.t = 0;
          run.fx.sound('teleport', 0.5);
        }
        break;
      case 'drop':
        this.rise = Math.max(0, 1 - this.t / 1.2);
        if (this.rise <= 0) {
          this.state = 'off';
          // a boss wave ends with its boss: a short breather, then the next wave
          const w = run.waves.wave;
          if (!w.final && w.boss) w.start = Math.min(w.start, run.time + 4 - w.duration);
        }
        break;
    }
    if (this.state === 'drop' || this.state === 'off') return;
    // the wall: the hero stays inside
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const d = Math.hypot(dx, dz);
    const lim = this.r - 0.7;
    if (d > lim) {
      const ux = dx / d;
      const uz = dz / d;
      p.slide(-ux * (d - lim), -uz * (d - lim));
      const out = p.pullX * ux + p.pullZ * uz;
      if (out > 0) {
        p.pullX -= ux * out;
        p.pullZ -= uz * out;
      }
    }
    // the boss too
    const b = this.boss;
    if (b && b.e.alive) {
      const e = b.e;
      const ex = e.x - this.x;
      const ez = e.z - this.z;
      const ed = Math.hypot(ex, ez);
      const bl = this.r - e.radius * 0.6 - 0.4;
      if (ed > bl) {
        e.x = this.x + (ex / ed) * bl;
        e.z = this.z + (ez / ed) * bl;
      }
    }
    // enemy shots stop at the wall
    for (const s of run.hazards.bullets) {
      if (s.active && (s.x - this.x) ** 2 + (s.z - this.z) ** 2 > (this.r + 0.5) ** 2) {
        s.active = false;
        run.fx.burst(s.x, 0.8, s.z, s.color, 3, 2, 0.1, 0.25, 'glow');
      }
    }
  }

  /** Pillar positions around the ring (for the renderer). */
  pillars(): { x: number; z: number; a: number }[] {
    const n = Math.round((TAU * this.r) / 2.2);
    const out: { x: number; z: number; a: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      out.push({ x: this.x + Math.cos(a) * this.r, z: this.z + Math.sin(a) * this.r, a });
    }
    return out;
  }
}
