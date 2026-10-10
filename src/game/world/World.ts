import { WORLD } from '../../config/world';
import { L } from '../../i18n';
import { PROG } from '../../config/progression';
import { ENEMY_BY_ID } from '../../data/enemies';
import type { Loc } from '../../data/types';
import { BossController } from '../bosses/Boss';
import type { Enemy } from '../Enemy';
import type { Run } from '../Run';
import { levelAtDist, ringOf, sectorOf, type Area, type CampDef, type Lair, type Station, type WorldLayout } from './WorldGen';
import type { ContinentLayout, NpcDef, TownRt, WaystoneRt } from './continent/places';

/** A villager, merchant or guard of the continent walking around its post. */
export interface NpcRt {
  def: NpcDef;
  x: number;
  z: number;
  yaw: number;
  anim: number;
  vx: number;
  vz: number;
  wx: number;
  wz: number;
  t: number;
}

/** Persistent continent progress of a character. */
export interface WorldProgress {
  /** Discovered waystones (ids). */
  known: string[];
  /** Settlement the hero wakes up in after death. */
  home: string;
  /** Last position (resumes the session there). */
  x?: number;
  z?: number;
  /** Explored map cells (FOG × FOG bits, base64). */
  fog?: string;
  /** Dungeon entrances found. */
  dungeons?: string[];
  /** Teleport scrolls carried. */
  scrolls?: number;
}

/** Fog-of-war resolution: one bit per FOG_CELL² blocks. */
export const FOG_CELL = 16;

interface Member {
  id: string;
  e: Enemy | null;
  uid: number;
  /** Run time when the member may come back after being killed. */
  deadUntil: number;
}

interface CampRt {
  def: CampDef;
  members: Member[];
  active: boolean;
  /** Current home (patrols walk their route). */
  hx: number;
  hz: number;
  /** Patrol progress 0..2 (there and back). */
  pt: number;
}

interface LairRt {
  def: Lair;
  deadUntil: number;
  boss: BossController | null;
}

const BUCKET = 64;

/**
 * Open-world simulation: resident monsters at fixed camps (spawned only near the hero, killed
 * ones respawn on their camp's timer), aggro / leash / return-home behaviour, named elites,
 * boss lairs with the 1v1 arena, the safe town and the hero's death and respawn there.
 */
export class World {
  readonly camps: CampRt[];
  readonly lairs: LairRt[];
  private buckets = new Map<number, number[]>();
  private active = new Set<number>();
  private actT = 0;
  private saveT = WORLD.saveEvery;
  private deathT = -1;
  private wasSafe = true;
  private lastArea = -2;
  /** Increments whenever the hero is moved instantly (respawn, teleport): the camera snaps. */
  jumpSeq = 0;
  /** Counters for tools and the debug panel. */
  readonly stats = { spawned: 0, respawned: 0, killed: 0, leashed: 0, snapped: 0, deaths: 0, bossKills: 0 };

  /** Continent only: NPCs, waystones, home town, explored map. */
  readonly cont: ContinentLayout | null;
  readonly npcs: NpcRt[] = [];
  private npcActive: number[] = [];
  readonly known = new Set<string>();
  readonly foundDungeons = new Set<string>();
  home = '';
  scrolls = 0;
  readonly fogN: number;
  readonly fog: Uint8Array;
  private discT = 0;

  constructor(private run: Run, readonly layout: WorldLayout, prog?: WorldProgress | null) {
    this.cont = layout.cont ?? null;
    this.fogN = Math.ceil(layout.size / FOG_CELL);
    this.fog = new Uint8Array(this.fogN * this.fogN);
    if (this.cont) {
      const cont = this.cont;
      for (const n of cont.npcs) this.npcs.push({ def: n, x: n.x, z: n.z, yaw: n.yaw, anim: 0, vx: 0, vz: 0, wx: n.x, wz: n.z, t: 0 });
      for (const w of cont.waystones) if (w.open) this.known.add(w.id);
      const start = cont.towns.find((t) => t.def.id === 'quietford') ?? cont.towns[0];
      this.home = start.def.id;
      if (prog) {
        for (const id of prog.known ?? []) if (cont.waystones.some((w) => w.id === id)) this.known.add(id);
        for (const id of prog.dungeons ?? []) this.foundDungeons.add(id);
        if (prog.home && cont.towns.some((t) => t.def.id === prog.home)) this.home = prog.home;
        this.scrolls = prog.scrolls ?? 0;
        if (prog.fog) {
          try {
            const bin = atob(prog.fog);
            for (let i = 0; i < bin.length && i * 8 < this.fog.length; i++) {
              const b = bin.charCodeAt(i);
              for (let k = 0; k < 8; k++) if (b & (1 << k)) this.fog[i * 8 + k] = 1;
            }
          } catch {
            /* a broken fog string only loses the explored map */
          }
        }
      }
    }
    this.camps = layout.camps.map((def) => ({ def, members: def.ids.map((id) => ({ id, e: null, uid: 0, deadUntil: 0 })), active: false, hx: def.x, hz: def.z, pt: 0 }));
    this.camps.forEach((c, i) => {
      const k = this.bucketKey(Math.floor(c.def.x / BUCKET), Math.floor(c.def.z / BUCKET));
      const list = this.buckets.get(k);
      if (list) list.push(i);
      else this.buckets.set(k, [i]);
    });
    this.lairs = layout.lairs.map((def) => ({ def, deadUntil: 0, boss: null }));
    run.events.on('bossDefeated', (b: BossController) => {
      const l = this.lairs.find((x) => x.boss === b);
      if (!l) return;
      l.boss = null;
      l.deadUntil = run.time + run.rng.range(...WORLD.respawn.boss);
      this.stats.bossKills++;
    });
  }

  private bucketKey(bx: number, bz: number) {
    return bz * 1024 + bx;
  }

  get town(): { x: number; z: number } {
    if (this.cont) {
      const t = this.homeTown;
      return { x: t.spawn.x, z: t.spawn.z };
    }
    return { x: this.layout.c + 0.5, z: this.layout.c + 2.5 };
  }

  get homeTown(): TownRt {
    const c = this.cont!;
    return c.towns.find((t) => t.def.id === this.home) ?? c.towns[0];
  }

  /** Continent: the settlement a point is in (with a small margin), safe or not. */
  townAt(x: number, z: number, m = 4): TownRt | null {
    if (!this.cont) return null;
    for (const t of this.cont.towns) if (x >= t.x0 - m && x <= t.x1 + m && z >= t.z0 - m && z <= t.z1 + m) return t;
    return null;
  }

  inSafe(x: number, z: number): boolean {
    if (this.cont) {
      const t = this.townAt(x, z);
      return !!t && t.def.safe;
    }
    const c = this.layout.c + 0.5;
    return (x - c) ** 2 + (z - c) ** 2 < WORLD.safeR * WORLD.safeR;
  }

  distToTown(x: number, z: number): number {
    if (this.cont) {
      let best = Infinity;
      for (const t of this.cont.towns) if (t.def.safe) best = Math.min(best, Math.hypot(x - (t.x0 + t.x1) / 2, z - (t.z0 + t.z1) / 2));
      return best;
    }
    return Math.hypot(x - this.layout.c - 0.5, z - this.layout.c - 0.5);
  }

  private gridAt(g: Uint8Array, x: number, z: number): number {
    const c = this.cont!;
    const n = Math.ceil(c.size / c.grid);
    const gx = Math.max(0, Math.min(n - 1, Math.floor(x / c.grid)));
    const gz = Math.max(0, Math.min(n - 1, Math.floor(z / c.grid)));
    return g[gz * n + gx];
  }

  /** Hunting area under a point (null in the town). */
  areaAt(x: number, z: number): Area | null {
    if (this.inSafe(x, z)) return null;
    if (this.cont) {
      const a = this.gridAt(this.cont.areaGrid, x, z);
      return a === 255 ? null : (this.layout.areas[a] ?? null);
    }
    const c = this.layout.c + 0.5;
    const d = Math.hypot(x - c, z - c);
    return this.layout.areas[ringOf(d) * WORLD.sectors + sectorOf(x - c, z - c)] ?? null;
  }

  /** Monster level of the ground under a point. */
  levelAt(x: number, z: number): number {
    if (this.cont) return Math.max(1, this.gridAt(this.cont.levelGrid, x, z));
    const [lo, hi] = PROG.mapRange[this.run.map.id] ?? [1, 10];
    return levelAtDist(this.distToTown(x, z), lo, hi);
  }

  /** Location, area and level under the hero (for the HUD). */
  place(): { loc: Loc; area: Area | null; town: boolean; level: number } {
    const p = this.run.player;
    const area = this.areaAt(p.x, p.z);
    const town = this.cont ? this.townAt(p.x, p.z) : null;
    return { loc: town ? town.def.name : this.run.map.name, area, town: !area, level: this.levelAt(p.x, p.z) };
  }

  /** The station (town service, NPC, waystone, dungeon) the hero stands at, if any. */
  nearStation(): Station | null {
    const p = this.run.player;
    let best: Station | null = null;
    let bd = Infinity;
    for (const s of this.layout.stations) {
      const d = Math.hypot(p.x - (s.x + 0.5), p.z - (s.z + 1));
      if (d < (s.r ?? 3.2) && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** Continent: waystones the hero can travel to, with their gold cost from here. */
  travelList(): { w: WaystoneRt; cost: number; here: boolean }[] {
    const c = this.cont;
    if (!c) return [];
    const p = this.run.player;
    return c.waystones
      .filter((w) => this.known.has(w.id))
      .map((w) => {
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        return { w, here: d < 12, cost: Math.round(10 + d * 0.08 + this.levelAt(w.x, w.z) * 6) };
      });
  }

  /** Teleports the hero next to a known waystone (on free ground, never into a wall). */
  travelTo(id: string): boolean {
    const w = this.cont?.waystones.find((x) => x.id === id);
    if (!w || !this.known.has(id)) return false;
    const spot = this.freeSpot(w.x, w.z + 3);
    if (!spot) return false;
    this.moveHero(spot.x, spot.z);
    return true;
  }

  /** Nearest walkable spot to a point (spiral search). */
  freeSpot(x: number, z: number): { x: number; z: number } | null {
    const t = this.run.terrain;
    const ok = (cx: number, cz: number) => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (t.blocksWalker(cx + dx, cz + dz)) return false;
      return true;
    };
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    for (let r = 0; r < 24; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (ok(x0 + dx, z0 + dz)) return { x: x0 + dx + 0.5, z: z0 + dz + 0.5 };
        }
    return null;
  }

  /** Persistent progress for the character save. */
  progress(): WorldProgress | null {
    if (!this.cont) return null;
    const p = this.run.player;
    let bin = '';
    for (let i = 0; i < this.fog.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) if (this.fog[i + k]) b |= 1 << k;
      bin += String.fromCharCode(b);
    }
    const safeSpot = p.dead ? null : this.freeSpot(p.x, p.z);
    return { known: [...this.known], home: this.home, x: safeSpot?.x, z: safeSpot?.z, fog: btoa(bin), dungeons: [...this.foundDungeons], scrolls: this.scrolls };
  }

  /** Continent: reveals the map, finds waystones and dungeon mouths, binds the hero to towns. */
  private discover() {
    const c = this.cont!;
    const p = this.run.player;
    const R = 3;
    const fx = Math.floor(p.x / FOG_CELL);
    const fz = Math.floor(p.z / FOG_CELL);
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R + 1) continue;
        const x = fx + dx;
        const z = fz + dz;
        if (x >= 0 && z >= 0 && x < this.fogN && z < this.fogN) this.fog[z * this.fogN + x] = 1;
      }
    for (const w of c.waystones) {
      if (this.known.has(w.id) || Math.hypot(w.x - p.x, w.z - p.z) > 9) continue;
      this.known.add(w.id);
      this.run.events.emit('waystone', w.id);
    }
    for (const d of c.dungeons) {
      if (this.foundDungeons.has(d.def.id) || Math.hypot(d.x - p.x, d.z - p.z) > 14) continue;
      this.foundDungeons.add(d.def.id);
      this.run.events.emit('dungeonFound', d.def.id);
    }
    // entering a safe settlement with a waystone makes it home
    const t = this.townAt(p.x, p.z, 0);
    if (t && t.def.safe && t.def.waystone && this.home !== t.def.id && this.known.has(c.waystones.find((w) => w.town === t.def.id)?.id ?? '')) {
      this.home = t.def.id;
      this.run.events.emit('homeSet', t.def.id);
    }
  }

  /** NPCs near the hero amble around their posts. */
  private npcStep(dt: number) {
    const p = this.run.player;
    const t = this.run.terrain;
    for (const i of this.npcActive) {
      const n = this.npcs[i];
      const d = n.def;
      n.t -= dt;
      if (d.wander > 0 && n.t <= 0) {
        n.t = 3 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * d.wander;
        const wx = d.x + Math.cos(a) * r;
        const wz = d.z + Math.sin(a) * r;
        if (t.walkableAt(wx, wz)) {
          n.wx = wx;
          n.wz = wz;
        }
      }
      const dx = n.wx - n.x;
      const dz = n.wz - n.z;
      const dist = Math.hypot(dx, dz);
      const talk = Math.hypot(p.x - n.x, p.z - n.z) < 3.5;
      if (dist > 0.3 && !talk) {
        n.vx = (dx / dist) * 1.4;
        n.vz = (dz / dist) * 1.4;
        const nx = n.x + n.vx * dt;
        const nz = n.z + n.vz * dt;
        if (t.walkableAt(nx, nz)) {
          n.x = nx;
          n.z = nz;
        } else n.wx = n.x, n.wz = n.z;
        n.yaw = Math.atan2(n.vx, n.vz);
        n.anim += dt;
      } else {
        n.vx = n.vz = 0;
        if (talk) n.yaw = Math.atan2(p.x - n.x, p.z - n.z);
      }
    }
  }

  private npcActivate() {
    const p = this.run.player;
    this.npcActive.length = 0;
    this.npcs.forEach((n, i) => {
      if ((n.x - p.x) ** 2 + (n.z - p.z) ** 2 < 70 * 70) this.npcActive.push(i);
    });
  }

  /** NPCs worth drawing (near the hero). */
  get visibleNpcs(): NpcRt[] {
    return this.npcActive.map((i) => this.npcs[i]);
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const run = this.run;
    const p = run.player;
    if (this.deathT >= 0) {
      this.deathT -= dt;
      if (this.deathT < 0) this.respawn();
    }
    this.actT -= dt;
    if (this.actT <= 0) {
      this.actT = 0.5;
      this.activate();
    }
    for (const i of this.active) this.patrol(this.camps[i], dt);
    if (this.cont) {
      this.discT -= dt;
      if (this.discT <= 0) {
        this.discT = 0.5;
        this.npcActivate();
        if (!p.dead) this.discover();
      }
      this.npcStep(dt);
    }
    if (!p.dead) {
      const safe = this.inSafe(p.x, p.z);
      if (safe) p.heal(p.stats.maxHp * WORLD.townRegen * dt, true);
      if (safe && !this.wasSafe) run.events.emit('worldSave', undefined);
      this.wasSafe = safe;
      const area = this.areaAt(p.x, p.z);
      const aid = area ? area.id : -1;
      if (aid !== this.lastArea) {
        if (this.lastArea !== -2) run.events.emit('zone', aid);
        this.lastArea = aid;
      }
      this.lairCheck();
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = WORLD.saveEvery;
      run.events.emit('worldSave', undefined);
    }
  }

  /** Spawns the camps near the hero, removes idle ones far away and strays nobody owns. */
  private activate() {
    const run = this.run;
    const p = run.player;
    const r = WORLD.actR;
    const bx0 = Math.floor((p.x - r) / BUCKET);
    const bx1 = Math.floor((p.x + r) / BUCKET);
    const bz0 = Math.floor((p.z - r) / BUCKET);
    const bz1 = Math.floor((p.z + r) / BUCKET);
    const arena = run.arena.active;
    for (let bz = bz0; bz <= bz1; bz++)
      for (let bx = bx0; bx <= bx1; bx++) {
        const list = this.buckets.get(this.bucketKey(bx, bz));
        if (!list) continue;
        for (const i of list) {
          const c = this.camps[i];
          if ((c.hx - p.x) ** 2 + (c.hz - p.z) ** 2 > r * r) continue;
          if (!c.active) {
            c.active = true;
            this.active.add(i);
          }
        }
      }
    const far2 = WORLD.deactR * WORLD.deactR;
    for (const i of this.active) {
      const c = this.camps[i];
      const d2 = (c.hx - p.x) ** 2 + (c.hz - p.z) ** 2;
      let busy = false;
      for (let k = 0; k < c.members.length; k++) {
        const m = c.members[k];
        if (m.e && (m.e.uid !== m.uid || !m.e.active)) m.e = null; // released by someone else (boss arena)
        if (m.e && d2 > far2 && !m.e.engaged) {
          run.enemies.release(m.e);
          m.e = null;
        }
        if (m.e) busy = true;
        else if (d2 <= far2 && !arena && run.time >= m.deadUntil && !p.dead) {
          this.spawnMember(c, k);
          if (m.e) busy = true;
        }
      }
      if (d2 > far2 && !busy) {
        c.active = false;
        this.active.delete(i);
      }
    }
    // strays (split children, summons) far from the hero leave
    for (const e of run.enemies.list) {
      if (!e.active || e.boss || e.camp >= 0) continue;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > 90 * 90) run.enemies.release(e);
    }
  }

  private spawnMember(c: CampRt, k: number) {
    const run = this.run;
    const m = c.members[k];
    const def = ENEMY_BY_ID[m.id];
    if (!def) return;
    const t = run.terrain;
    const rad = c.def.kind === 'camp' ? 3.5 : c.def.kind === 'elite' ? 4 : 2.2;
    let x = c.hx;
    let z = c.hz;
    for (let tries = 0; tries < 6; tries++) {
      const a = run.rng.next() * Math.PI * 2;
      const d = run.rng.range(0.5, rad);
      const tx = c.hx + Math.cos(a) * d;
      const tz = c.hz + Math.sin(a) * d;
      if (def.flying ? !t.blocksFlyer(Math.floor(tx), Math.floor(tz)) : t.walkableAt(tx, tz)) {
        x = tx;
        z = tz;
        break;
      }
    }
    const elite = c.def.kind === 'elite' && k === 0 ? c.def.elite ?? null : null;
    const e = run.enemies.spawn(def, x, z, { level: c.def.level, elite });
    if (!e) return;
    const ci = this.camps.indexOf(c);
    e.camp = ci;
    e.member = k;
    e.homeX = x;
    e.homeZ = z;
    e.aggressive = c.def.aggressive;
    e.engaged = false;
    e.xp *= WORLD.xpMul;
    e.yaw = run.rng.next() * Math.PI * 2;
    if (elite && c.def.name) e.name = L(c.def.name);
    m.e = e;
    m.uid = e.uid;
    this.stats.spawned++;
    if (m.deadUntil > 0) this.stats.respawned++;
  }

  /** Patrols walk their route while nobody of them fights; members follow the moving home. */
  private patrol(c: CampRt, dt: number) {
    const d = c.def;
    if (d.wx === undefined || d.wz === undefined) return;
    if (c.members.some((m) => m.e && (m.e.engaged || m.e.returning))) return;
    const len = Math.hypot(d.wx - d.x, d.wz - d.z) || 1;
    c.pt = (c.pt + (dt * 1.1) / len) % 2;
    const k = c.pt < 1 ? c.pt : 2 - c.pt;
    const nx = d.x + (d.wx - d.x) * k;
    const nz = d.z + (d.wz - d.z) * k;
    if (!this.run.terrain.walkableAt(nx, nz)) {
      c.pt = (c.pt + 1) % 2; // blocked: turn back
      return;
    }
    const mx = nx - c.hx;
    const mz = nz - c.hz;
    c.hx = nx;
    c.hz = nz;
    for (const m of c.members)
      if (m.e && m.e.alive) {
        m.e.homeX += mx;
        m.e.homeZ += mz;
      }
  }

  // ------------------------------------------------------------------ mob behaviour
  /**
   * Movement of resident monsters that are not fighting: idle wandering, noticing the hero,
   * giving up the chase (leash) and walking home. Returns true when it set the velocity
   * (the regular combat AI is skipped this frame).
   */
  steer(e: Enemy, dt: number): boolean {
    if (e.camp < 0) return false;
    const run = this.run;
    const p = run.player;
    const speed = e.speed * e.slowMul * e.todSpd;
    if (e.returning) {
      e.retT += dt;
      const dx = e.homeX - e.x;
      const dz = e.homeZ - e.z;
      const d = Math.hypot(dx, dz);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3 * dt);
      if (d < 1 || e.retT > WORLD.returnTimeout) {
        if (d >= 1) {
          e.x = e.homeX;
          e.z = e.homeZ;
          this.stats.snapped++;
        }
        e.returning = false;
        e.engaged = false;
        e.hp = e.maxHp;
        e.poisonT = e.burnT = e.bleedT = e.curseT = e.markT = 0;
        e.vx = e.vz = 0;
        return true;
      }
      e.vx = (dx / d) * speed * 1.5;
      e.vz = (dz / d) * speed * 1.5;
      return true;
    }
    const dxp = p.x - e.x;
    const dzp = p.z - e.z;
    const dp2 = dxp * dxp + dzp * dzp;
    if (!e.engaged) {
      const r = e.elite ? WORLD.eliteAggroR : WORLD.aggroR;
      if (e.aggressive && !p.dead && dp2 < r * r && !this.inSafe(p.x, p.z) && run.terrain.los(e.x, e.z, p.x, p.z)) {
        this.engage(e);
        return false;
      }
      // idle: amble around home
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 2.5 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * WORLD.wanderR;
        e.wx = e.homeX + Math.cos(a) * d;
        e.wz = e.homeZ + Math.sin(a) * d;
        if (!run.terrain.walkableAt(e.wx, e.wz) && !e.flying) {
          e.wx = e.homeX;
          e.wz = e.homeZ;
        }
      }
      const dx = e.wx - e.x;
      const dz = e.wz - e.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        e.vx = (dx / d) * speed * 0.4;
        e.vz = (dz / d) * speed * 0.4;
      } else e.vx = e.vz = 0;
      return true;
    }
    // fighting: give up when the hero is gone, safe, or the chase went too far
    const away = Math.hypot(e.x - e.homeX, e.z - e.homeZ);
    if (p.dead || this.inSafe(p.x, p.z) || away > (e.elite ? WORLD.leashR * 1.3 : WORLD.leashR)) {
      this.giveUp(e);
      return true;
    }
    return false;
  }

  private giveUp(e: Enemy) {
    e.engaged = false;
    e.returning = true;
    e.retT = 0;
    e.atkT = 0;
    if (e.atkZone) {
      e.atkZone.active = false;
      e.atkZone = null;
    }
    e.state = 0;
    this.stats.leashed++;
  }

  private engage(e: Enemy) {
    if (e.engaged || e.returning) return;
    e.engaged = true;
    // social aggro: the rest of an aggressive camp joins in
    const c = this.camps[e.camp];
    if (!c || !c.def.aggressive) return;
    for (const m of c.members) {
      const o = m.e;
      if (!o || o === e || !o.alive || o.engaged || o.returning) continue;
      if (Math.hypot(o.x - e.x, o.z - e.z) < WORLD.assistR) o.engaged = true;
    }
    // faction camps raise the alarm: every post of the same camp within earshot joins
    if (c.def.site === undefined) return;
    for (const i of this.active) {
      const oc = this.camps[i];
      if (oc === c || oc.def.site !== c.def.site) continue;
      if (Math.hypot(oc.hx - e.x, oc.hz - e.z) > 34) continue;
      for (const m of oc.members) {
        const o = m.e;
        if (o && o.alive && !o.engaged && !o.returning) o.engaged = true;
      }
    }
  }

  /** A resident monster was hurt: it fights back (passive ones too). */
  provoke(e: Enemy) {
    if (e.camp >= 0) this.engage(e);
  }

  /** Mobs never enter the town. */
  blocksMob(x: number, z: number): boolean {
    return this.inSafe(x, z);
  }

  onKill(e: Enemy) {
    if (e.camp < 0) return;
    const c = this.camps[e.camp];
    const m = c?.members[e.member];
    if (!m || m.e !== e) return;
    m.e = null;
    m.deadUntil = this.run.time + this.run.rng.range(...c.def.respawn);
    this.stats.killed++;
  }

  // ------------------------------------------------------------------ bosses
  private lairCheck() {
    const run = this.run;
    const p = run.player;
    if (run.arena.active) return;
    for (const l of this.lairs) {
      if (l.boss || run.time < l.deadUntil) continue;
      if (Math.hypot(p.x - l.def.x, p.z - l.def.z) > WORLD.lairTrigger) continue;
      run.levelCtx = l.def.level;
      const b = BossController.spawn(run, l.def.boss, l.def.x + 6, l.def.z, false);
      run.levelCtx = 0;
      if (!b) continue;
      l.boss = b;
      (b.e as Enemy).level = l.def.level;
      run.stats.bossesSeen++;
      run.events.emit('bossSpawn', b);
      return;
    }
  }

  // ------------------------------------------------------------------ death and travel
  onPlayerDeath() {
    const run = this.run;
    this.stats.deaths++;
    this.deathT = WORLD.respawnDelay;
    run.fx.sound('death');
    run.fx.burst(run.player.x, 1, run.player.z, run.hero.color, 50, 6, 0.2, 1.2, 'debris');
    run.fx.shake(0.6);
    // a boss that wins goes back to its lair at full strength
    for (const l of this.lairs) {
      const b = l.boss;
      if (!b) continue;
      if (b.e.active) run.enemies.release(b.e);
      const i = run.bosses.indexOf(b);
      if (i >= 0) run.bosses.splice(i, 1);
      l.boss = null;
    }
    for (const e of run.enemies.list) if (e.alive && e.engaged && e.camp >= 0) this.giveUp(e);
    run.events.emit('banner', 'world_died');
  }

  get respawning(): boolean {
    return this.deathT >= 0;
  }

  /** The hero wakes up at the town beacon (an optional experience penalty, see PROG.deathXpLoss). */
  respawn() {
    const run = this.run;
    const p = run.player;
    if (PROG.deathXpLoss > 0) p.xp = Math.max(0, p.xp - p.xpNext * PROG.deathXpLoss);
    p.dead = false;
    p.hp = p.stats.maxHp;
    this.moveHero(this.town.x, this.town.z);
    p.invulnT = 2;
    run.hazards.clearAll();
    this.wasSafe = true;
    run.events.emit('worldSave', undefined);
  }

  moveHero(x: number, z: number) {
    const run = this.run;
    const p = run.player;
    p.x = x;
    p.z = z;
    p.vx = p.vz = 0;
    p.clearPath();
    run.nav.update(0, x, z, true);
    this.jumpSeq++;
    this.actT = 0;
  }
}

