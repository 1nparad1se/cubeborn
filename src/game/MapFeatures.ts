import { TAU } from '../core/math';
import type { Enemy } from './Enemy';
import type { Run } from './Run';

/** A shrine or secret chest placed by map generation. */
export interface MapPoi {
  x: number;
  z: number;
  kind: string;
  sub?: string;
  used: boolean;
  /** Seen by the player (secret areas are hidden on the minimap until found). */
  found: boolean;
}

/**
 * Per-map signature mechanics plus interactive points of interest (shrines, secret chests).
 *  - Blightwood: enemies burst out of the thickets around the player.
 *  - Gloamhaven: the dead bell tolls, bringing darkness and frenzied enemies.
 *  - Ossuary: ceilings collapse in the corridors.
 *  - Emberwaste: volcanic eruptions shower the area with lava bombs.
 *  - Frostveil: deep snow slows walking off the trails.
 *  - Aetherfall: aether storms blind and push the hero.
 */
export class MapFeatures {
  readonly pois: MapPoi[] = [];
  private timer = 0;
  private active = 0;
  private sub = 0;
  private bellBoosted: Enemy[] = [];
  private windA = 0;
  private snowTiles = new Set<number>();
  private ambushFx = 0;

  constructor(private run: Run) {
    const t = run.terrain;
    for (const m of t.markers) if (m.kind === 'shrine' || m.kind === 'secret') this.pois.push({ x: m.x, z: m.z, kind: m.kind, sub: m.sub, used: false, found: m.kind !== 'secret' });
    for (const m of t.markers) if (m.kind === 'poi') this.pois.push({ x: m.x, z: m.z, kind: 'poi', sub: m.sub, used: true, found: true });
    // secret rooms hold a chest from the start
    for (const p of this.pois) if (p.kind === 'secret') run.pickups.spawnChest(p.x, p.z, 0, 'secret', false);
    if (run.map.generator === 'tundra') for (const n of ['snow', 'snow2']) this.snowTiles.add(t.tileId(n));
    this.timer = FIRST[run.map.generator] ?? 60;
  }

  get kind(): string {
    return this.run.map.generator;
  }

  /** Movement multiplier for the terrain under a point (deep snow on Frostveil). */
  moveMul(x: number, z: number, player: boolean): number {
    if (!this.snowTiles.size) return 1;
    const t = this.run.terrain;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!t.inBounds(cx, cz)) return 1;
    return this.snowTiles.has(t.tile[t.idx(cx, cz)]) ? (player ? 0.84 : 0.9) : 1;
  }

  /** Blightwood: some walkers spawn from the thickets close to the hero instead of the ring. */
  spawnPos(flying: boolean): { x: number; z: number } | null {
    const run = this.run;
    if (this.kind !== 'forest' || flying || run.time < 30 || !run.rng.chance(0.28)) return null;
    const spots = run.terrain.spots;
    if (!spots.length) return null;
    const p = run.player;
    for (let k = 0; k < 24; k++) {
      const s = spots[Math.floor(run.rng.next() * spots.length)];
      const d2 = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d2 < 8 * 8 || d2 > 17 * 17) continue;
      for (let a = 0; a < 4; a++) {
        const ang = run.rng.next() * TAU;
        const x = s.x + 0.5 + Math.cos(ang) * 1.6;
        const z = s.z + 0.5 + Math.sin(ang) * 1.6;
        if (!run.terrain.walkableAt(x, z) || !run.nav.has(Math.floor(x), Math.floor(z))) continue;
        if (this.ambushFx <= 0) {
          run.fx.burst(x, 1.2, z, 0x3f8a32, 10, 3, 0.14, 0.6, 'debris');
          this.ambushFx = 0.15;
        }
        return { x, z };
      }
    }
    return null;
  }

  update(dt: number) {
    const run = this.run;
    this.ambushFx -= dt;
    this.updatePois();
    if (this.active > 0) {
      this.active -= dt;
      this.tickActive(dt);
      if (this.active <= 0) this.endActive();
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = PERIOD[this.kind] ?? 60;
    switch (this.kind) {
      case 'city': {
        // the dead bell: darkness and frenzied enemies for a while
        this.active = 14;
        run.weather.darkness = Math.max(run.weather.darkness, 14);
        this.bellBoosted = [];
        for (const e of run.enemies.list) {
          if (!e.alive || e.boss || e.def.behavior === 'prop') continue;
          e.speed *= 1.2;
          this.bellBoosted.push(e);
        }
        run.fx.sound('bossPhase');
        run.events.emit('feature', 'feat_bell');
        break;
      }
      case 'catacombs':
        this.active = 10;
        this.sub = 0;
        run.events.emit('feature', 'feat_collapse');
        break;
      case 'volcano':
        this.active = 9;
        this.sub = 0;
        run.fx.shake(0.4);
        run.events.emit('feature', 'feat_eruption');
        break;
      case 'ruins':
        this.active = 16;
        this.windA = run.rng.next() * TAU;
        run.weather.storm = 16;
        run.events.emit('feature', 'feat_storm');
        break;
      case 'tundra':
        // deep snow is constant; periodic reminder only on the first occurrence
        if (!this.sub) run.events.emit('feature', 'feat_snow');
        this.sub = 1;
        this.timer = 1e9;
        break;
      case 'forest':
        if (!this.sub) run.events.emit('feature', 'feat_ambush');
        this.sub = 1;
        this.timer = 1e9;
        break;
    }
  }

  private tickActive(dt: number) {
    const run = this.run;
    const p = run.player;
    const dmg = 10 * run.map.tier * run.diff.damage * Math.sqrt(run.waveScale.damage);
    if (this.kind === 'catacombs') {
      // falling rocks along walls near the hero
      this.sub += dt;
      while (this.sub > 0.45) {
        this.sub -= 0.45;
        for (let k = 0; k < 8; k++) {
          const a = run.rng.next() * TAU;
          const d = run.rng.range(1, 8);
          const x = p.x + Math.cos(a) * d + p.vx * 0.5;
          const z = p.z + Math.sin(a) * d + p.vz * 0.5;
          if (!run.terrain.walkableAt(x, z)) continue;
          run.hazards.zone(x, z, 1.4, 1.2, dmg, { color: 0xb8a888 });
          run.spawnFallingRock(x, z, 1.2, 0x9a8e78);
          break;
        }
      }
    } else if (this.kind === 'volcano') {
      this.sub += dt;
      while (this.sub > 0.3) {
        this.sub -= 0.3;
        const a = run.rng.next() * TAU;
        const d = run.rng.range(0, 10);
        const x = p.x + Math.cos(a) * d + p.vx * 0.6;
        const z = p.z + Math.sin(a) * d + p.vz * 0.6;
        run.hazards.zone(x, z, 2, 1.3, dmg * 1.1, { color: 0xff5a0a, pool: 2.5 });
        run.spawnFallingRock(x, z, 1.3, 0xff6a1a);
      }
    } else if (this.kind === 'ruins') {
      // wind slowly turns and pushes the hero
      this.windA += dt * 0.25;
      p.pullX += Math.cos(this.windA) * 2.2 * dt * 3;
      p.pullZ += Math.sin(this.windA) * 2.2 * dt * 3;
    }
  }

  private endActive() {
    if (this.kind === 'city') {
      for (const e of this.bellBoosted) if (e.alive) e.speed /= 1.2;
      this.bellBoosted = [];
    }
  }

  /** Current wind direction during an Aetherfall storm (for particles). */
  get wind(): { x: number; z: number } | null {
    if (this.kind !== 'ruins' || this.active <= 0) return null;
    return { x: Math.cos(this.windA), z: Math.sin(this.windA) };
  }

  private updatePois() {
    const run = this.run;
    const p = run.player;
    for (const s of this.pois) {
      const d2 = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (!s.found && d2 < 14 * 14) {
        s.found = true;
        if (s.kind === 'secret') run.events.emit('feature', 'feat_secret');
      }
      if (s.used || s.kind !== 'shrine' || d2 > 1.6 * 1.6) continue;
      s.used = true;
      this.bless(s.sub ?? 'heal');
    }
  }

  private bless(type: string) {
    const run = this.run;
    const p = run.player;
    switch (type) {
      case 'heal':
        p.heal(p.stats.maxHp * 0.5);
        break;
      case 'fury':
        p.buffs.fury = Math.max(p.buffs.fury, 20);
        break;
      case 'magnet':
        run.pickups.collectAllXp();
        p.buffs.haste = Math.max(p.buffs.haste, 10);
        break;
      case 'gold':
        run.stats.gold += 4 * p.stats.greed;
        break;
    }
    run.fx.burst(p.x, 1, p.z, 0xfff0a0, 40, 5, 0.2, 1, 'glow');
    run.fx.light(p.x, p.z, 0xfff0a0, 4, 8, 0.6);
    run.fx.sound('powerup');
    run.fx.text(p.x, p.z, run.tr('shrine_' + type), 0xfff0a0);
  }
}

/** Seconds before the first occurrence and between occurrences. */
const FIRST: Record<string, number> = { forest: 35, city: 150, catacombs: 100, volcano: 80, tundra: 5, ruins: 120 };
const PERIOD: Record<string, number> = { forest: 1e9, city: 150, catacombs: 55, volcano: 65, tundra: 1e9, ruins: 90 };

