import { DAY_NIGHT, type DayKind, type DayPeriod, type PhaseLight, type StatMul } from '../config/dayNight';
import { BOSSES } from '../data/bosses';
import { ENEMY_BY_ID } from '../data/enemies';
import type { Enemy } from './Enemy';
import type { Run } from './Run';

function smooth(x: number): number {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
}

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * k);
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * k);
  const bl = Math.round(ab + ((b & 255) - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

function lerpLight(a: PhaseLight, b: PhaseLight, k: number, out: PhaseLight): PhaseLight {
  out.sun = a.sun + (b.sun - a.sun) * k;
  out.ambient = a.ambient + (b.ambient - a.ambient) * k;
  out.tint = a.tint + (b.tint - a.tint) * k;
  out.fog = a.fog + (b.fog - a.fog) * k;
  out.fogTint = a.fogTint + (b.fogTint - a.fogTint) * k;
  out.warm = a.warm + (b.warm - a.warm) * k;
  out.sat = a.sat + (b.sat - a.sat) * k;
  // colours blend only where they are actually applied so day keeps the map's own palette
  out.sunColor = lerpColor(a.tint > 0 ? a.sunColor : b.sunColor, b.tint > 0 ? b.sunColor : a.sunColor, k);
  out.ambientColor = lerpColor(a.tint > 0 ? a.ambientColor : b.ambientColor, b.tint > 0 ? b.ambientColor : a.ambientColor, k);
  out.fogColor = lerpColor(a.fogTint > 0 ? a.fogColor : b.fogColor, b.fogTint > 0 ? b.fogColor : a.fogColor, k);
  return out;
}

/**
 * Day/night cycle of a run: dawn → day → dusk → night with smooth lighting, time-of-day stats
 * for enemies (see DAY_NIGHT.kinds), night spawns and night events (elite packs, blood moon,
 * rare night bosses). Disabled when the cycle length setting is 0.
 */
export class DayNight {
  readonly length: number;
  /** Seconds into the current cycle. */
  t = 0;
  /** Completed nights (the first night is 1 while it lasts). */
  nights = 0;
  period: DayPeriod = 'day';
  /** 0 full day .. 1 full night, eased through dawn and dusk. */
  night = 0;
  /** Blended lighting for the renderer. */
  readonly light: PhaseLight = { ...DAY_NIGHT.light.day };
  bloodMoon = false;
  /** The coming night is a blood moon (decided at dusk, announced ahead). */
  bloodAhead = false;
  private warned = false;
  private tick = 0;
  private eliteT = -1;
  private bossT = -1;
  private bounds: { p: DayPeriod; a: number; b: number }[] = [];
  private nightPoolCache: { night: boolean; nights: number; base: [string, number][]; pool: [string, number][] } | null = null;

  constructor(private run: Run, length: number) {
    this.length = Math.max(0, length);
    let a = 0;
    for (const [p, share] of DAY_NIGHT.phases) {
      this.bounds.push({ p, a: a * this.length, b: (a + share) * this.length });
      a += share;
    }
    // runs begin in the morning
    this.t = this.enabled ? this.bounds.find((b) => b.p === 'day')!.a : 0;
    this.compute();
  }

  get enabled(): boolean {
    return this.length > 0;
  }

  get isNight(): boolean {
    return this.enabled && this.night >= 0.5;
  }

  /** Seconds until the next period begins. */
  get timeToNext(): number {
    const b = this.bounds.find((x) => this.t >= x.a && this.t < x.b);
    return b ? b.b - this.t : 0;
  }

  /** Position of the sun (day) or moon (night) across the sky, -1 (rising) .. 1 (setting). */
  get sunArc(): number {
    if (!this.enabled) return 0;
    const night = this.bounds.find((b) => b.p === 'night')!;
    if (this.t >= night.a && this.t < night.b) return ((this.t - night.a) / (night.b - night.a)) * 2 - 1;
    // dawn..dusk (wrapping past the night)
    const dayLen = this.length - (night.b - night.a);
    const since = (this.t - night.b + this.length) % this.length;
    return Math.min(1, (since / dayLen) * 2 - 1);
  }

  /** Progress through the whole cycle 0..1 (for the HUD dial). */
  get cycleProgress(): number {
    return this.enabled ? this.t / this.length : 0.3;
  }

  private periodAt(t: number): { p: DayPeriod; a: number; b: number } {
    for (const b of this.bounds) if (t >= b.a && t < b.b) return b;
    return this.bounds[this.bounds.length - 1];
  }

  private compute() {
    if (!this.enabled) {
      this.period = 'day';
      this.night = 0;
      Object.assign(this.light, DAY_NIGHT.light.day);
      return;
    }
    const cur = this.periodAt(this.t);
    this.period = cur.p;
    const k = (this.t - cur.a) / Math.max(1e-6, cur.b - cur.a);
    const L = DAY_NIGHT.light;
    switch (cur.p) {
      case 'day':
        this.night = 0;
        // the last stretch of the day already leans toward dusk
        lerpLight(L.day, L.dusk, smooth((k - 0.85) / 0.15) * 0.5, this.light);
        break;
      case 'dusk':
        this.night = smooth(k);
        if (k < 0.5) lerpLight(L.day, L.dusk, 0.5 + k, this.light);
        else lerpLight(L.dusk, L.night, smooth((k - 0.5) * 2), this.light);
        break;
      case 'night':
        this.night = 1;
        lerpLight(L.night, L.dawn, smooth((k - 0.9) / 0.1) * 0.4, this.light);
        break;
      case 'dawn':
        this.night = 1 - smooth(k);
        if (k < 0.5) lerpLight(L.night, L.dawn, smooth(0.4 + k * 1.2), this.light);
        else lerpLight(L.dawn, L.day, smooth((k - 0.5) * 2), this.light);
        break;
    }
    // dark maps carry their own mood: soften the night there
    if (this.run.map.palette.heroLight) {
      const s = DAY_NIGHT.darkMapNightStrength;
      const d = DAY_NIGHT.light.day;
      this.light.sun = d.sun + (this.light.sun - d.sun) * s;
      this.light.ambient = d.ambient + (this.light.ambient - d.ambient) * s;
      this.light.tint *= s;
      this.light.fogTint *= s;
      this.light.fog = d.fog + (this.light.fog - d.fog) * s;
    }
    if (this.bloodMoon || (this.bloodAhead && this.period === 'dusk')) {
      const bm = DAY_NIGHT.events.bloodMoonLight;
      const w = this.bloodMoon ? this.night : this.night * 0.6;
      this.light.sunColor = lerpColor(this.light.sunColor, bm.sunColor, w * 0.7);
      this.light.fogColor = lerpColor(this.light.fogColor, bm.fogColor, w * 0.8);
      this.light.tint = Math.max(this.light.tint, w * 0.7);
      this.light.fogTint = Math.max(this.light.fogTint, w * 0.6);
    }
  }

  // ---------------------------------------------------------------- enemies
  kindOf(id: string): DayKind {
    return DAY_NIGHT.kinds[id] ?? 'neutral';
  }

  /** Current stat multipliers for a day kind (blended through dawn and dusk, with floors). */
  mulFor(kind: DayKind, out: StatMul): StatMul {
    if (!this.enabled) {
      out.damage = out.hp = out.speed = 1;
      return out;
    }
    const m = DAY_NIGHT.mods[kind];
    const n = this.night;
    // the night being approached or lived through: during the day that is the coming one
    const idx = this.period === 'night' || this.period === 'dawn' ? this.nights : this.nights + 1;
    const R = DAY_NIGHT.nightRamp;
    const ramp = R[Math.min(R.length - 1, Math.max(0, idx - 1))];
    // the ramp tempers night empowerment only; daylight creatures are weak from the first dusk
    const up = (v: number) => (v > 1 ? 1 + (v - 1) * ramp : v);
    const nd = up(m.night.damage);
    const nh = up(m.night.hp);
    const ns = up(m.night.speed);
    const blood = this.bloodMoon && (kind === 'nocturnal' || kind === 'sleeper' || kind === 'shifter') ? 1 + (DAY_NIGHT.events.bloodMoonMul - 1) * n : 1;
    const mn = DAY_NIGHT.minMul;
    out.damage = Math.max(mn.damage, (m.day.damage + (nd - m.day.damage) * n) * blood);
    out.hp = Math.max(mn.hp, (m.day.hp + (nh - m.day.hp) * n) * blood);
    out.speed = Math.max(mn.speed, m.day.speed + (ns - m.day.speed) * n);
    return out;
  }

  private tmp: StatMul = { damage: 1, hp: 1, speed: 1 };

  /** Applies the time-of-day multipliers to one enemy (keeps its health fraction). */
  apply(e: Enemy) {
    if (e.boss || e.def.behavior === 'prop' || e.isAlly) return;
    const m = this.mulFor(e.dayKind, this.tmp);
    if (m.hp !== e.todHp) {
      const r = m.hp / e.todHp;
      e.maxHp = Math.max(DAY_NIGHT.minHp, e.maxHp * r);
      e.hp = Math.min(e.maxHp, Math.max(DAY_NIGHT.minHp, e.hp * r));
      e.todHp = m.hp;
    }
    e.todDmg = m.damage;
    e.todSpd = m.speed;
    e.dire = e.dayKind === 'shifter' && this.enabled ? this.night : 0;
    if (e.dayKind === 'sleeper') {
      const p = this.run.player;
      if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < DAY_NIGHT.sleeperWakeRadius ** 2) e.awakeT = DAY_NIGHT.sleeperDozeAfter;
      e.asleep = this.enabled && this.night < 0.5 && e.awakeT <= 0;
    } else e.asleep = false;
  }

  /** Effective contact/shot damage of an enemy right now. */
  static damageOf(e: Enemy): number {
    return Math.max(DAY_NIGHT.minDamage, e.damage * e.todDmg);
  }

  /** Spawn pool with night-only enemies removed by day and night visitors added after dark. */
  poolFor(base: [string, number][]): [string, number][] {
    if (!this.enabled) return base;
    const night = this.isNight;
    const c = this.nightPoolCache;
    if (c && c.base === base && c.night === night && c.nights === this.nights) return c.pool;
    let pool = base.map(([id, w]) => [id, !night && DAY_NIGHT.nightOnly.includes(id) ? 0 : w] as [string, number]);
    if (night && this.nights >= DAY_NIGHT.visitorsFromNight) for (const [id, w] of DAY_NIGHT.nightSpawns[this.run.map.id] ?? []) if (ENEMY_BY_ID[id]) pool.push([id, w]);
    if (!pool.some((p) => p[1] > 0)) pool = base;
    this.nightPoolCache = { night, nights: this.nights, base, pool };
    return pool;
  }

  get spawnRate(): number {
    if (!this.enabled) return 1;
    const n = this.night;
    return 1 + (DAY_NIGHT.nightSpawnRate - 1) * n + (this.bloodMoon ? (DAY_NIGHT.events.bloodMoonSpawnRate - 1) * n : 0);
  }

  // ---------------------------------------------------------------- update
  update(dt: number) {
    if (!this.enabled) return;
    const run = this.run;
    const prev = this.period;
    this.t += dt;
    if (this.t >= this.length) this.t -= this.length;
    this.compute();
    if (this.period !== prev) this.onPeriod(this.period);
    // blood moon warning ahead of nightfall
    if (this.bloodAhead && !this.warned && this.period === 'dusk' && this.timeToNext <= DAY_NIGHT.events.warnAhead) {
      this.warned = true;
      run.events.emit('banner', 'dn_bloodmoon_warn');
      run.fx.sound('warning', 0.8);
    }
    if (this.eliteT > 0) {
      this.eliteT -= dt;
      if (this.eliteT <= 0) this.elitePack();
    }
    if (this.bossT > 0) {
      this.bossT -= dt;
      if (this.bossT <= 0) this.nightBoss();
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const e of run.enemies.list) if (e.alive) this.apply(e);
    }
  }

  private onPeriod(p: DayPeriod) {
    const run = this.run;
    const E = DAY_NIGHT.events;
    run.events.emit('dayPeriod', p);
    if (p === 'dusk') {
      // decide now whether the coming night is dangerous, so the warning can come ahead of it
      const upcoming = this.nights + 1;
      this.bloodAhead = upcoming >= E.bloodMoonFrom && run.rng.chance(E.bloodMoonChance);
      this.warned = false;
      run.events.emit('banner', 'dn_dusk');
    } else if (p === 'night') {
      this.nights++;
      this.bloodMoon = this.bloodAhead;
      this.bloodAhead = false;
      run.stats.nights++;
      if (this.bloodMoon) run.stats.bloodMoons++;
      run.events.emit('banner', this.bloodMoon ? 'dn_bloodmoon' : 'dn_night');
      run.fx.sound('nightfall', 0.8);
      this.eliteT = this.bloodMoon || run.rng.chance(E.elitePackChance) ? E.elitePackDelay : -1;
      const bossChance = this.nights >= E.nightBossFrom ? (this.bloodMoon ? E.nightBossBloodChance : E.nightBossChance) : 0;
      this.bossT = run.bosses.length === 0 && run.rng.chance(bossChance) ? E.nightBossDelay : -1;
    } else if (p === 'dawn') {
      if (this.nights > 0) run.stats.nightsSurvived++;
      this.bloodMoon = false;
      this.eliteT = this.bossT = -1;
      run.events.emit('banner', 'dn_dawn');
      run.fx.sound('dawn', 0.7);
    }
  }

  /** A pack of empowered night hunters. */
  elitePack() {
    const run = this.run;
    const E = DAY_NIGHT.events;
    const ids = new Set<string>();
    for (const [id] of DAY_NIGHT.nightSpawns[run.map.id] ?? []) ids.add(id);
    for (const [id, w] of run.spawner.currentPool) if (w > 0 && this.kindOf(id) !== 'diurnal' && this.kindOf(id) !== 'neutral') ids.add(id);
    const list = [...ids].filter((id) => ENEMY_BY_ID[id]);
    if (!list.length) return;
    const n = Math.min(E.elitePackSize[1], E.elitePackSize[0] + Math.floor(this.nights / 2) + (this.bloodMoon ? 2 : 0));
    for (let i = 0; i < n; i++) {
      const e = run.spawner.spawnOne(list[i % list.length], run.spawner.randomElite());
      if (e) e.nightPack = true;
    }
    run.events.emit('banner', 'dn_pack');
    run.fx.sound('warning', 0.5);
  }

  /** A rare boss from another land prowls the night. */
  nightBoss() {
    const run = this.run;
    if (run.bosses.length > 0) return;
    const own = new Set([run.map.midBoss, run.map.boss]);
    const pool = BOSSES.filter((b) => !own.has(b.id));
    const def = run.rng.pick(pool.length ? pool : BOSSES);
    if (run.spawner.spawnNightBoss(def.id, DAY_NIGHT.events.nightBossHp)) {
      run.stats.nightBosses++;
      run.events.emit('banner', 'dn_nightboss');
    }
  }

  /** Developer: jump to the start of a period. */
  devSet(p: DayPeriod) {
    if (!this.enabled) return;
    const b = this.bounds.find((x) => x.p === p)!;
    this.t = b.a + 0.01;
    if (p === 'night' && this.bloodAhead) {
      // a forced blood moon: run the nightfall again with the flag set
      this.bloodMoon = false;
    }
    this.compute();
    this.onPeriod(this.period);
    this.compute();
  }
}
