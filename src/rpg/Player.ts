import { clamp } from '../core/math';
import { clearLine, findPath } from '../game/arpg/Path';
import { SLOPE } from '../game/Terrain';
import type { WeaponStats } from './items';
import type { World } from './World';

/**
 * Minecraft-like jump: one jump from the ground (standing or moving), no double jump, no dash
 * and no invulnerability. The apex (1.35 blocks) clears 1-block obstacles; walls and the map
 * border still block horizontal movement in the air.
 */
export const JUMP = {
  height: 1.35,
  airTime: 0.56,
  /** Presses this early still count once the hero lands (s). */
  buffer: 0.14,
  /** Landing recovery (s) before the next jump. */
  landLag: 0.08,
};

export interface AttackState {
  weapon: WeaponStats | null;
  /** Seconds since the attack started. */
  t: number;
  dur: number;
  hitAt: number;
  done: boolean;
  dirX: number;
  dirZ: number;
  /** Counter for the renderer (one per attack). */
  seq: number;
}

/** The hero on the training ground: walking, jumping, facing and basic attacks. */
export class RpgPlayer {
  x: number;
  z: number;
  y: number;
  vx = 0;
  vz = 0;
  fx = 0;
  fz = -1;
  radius = 0.32;
  moving = false;
  /** Walk cycle phase (renderer). */
  anim = 0;
  jumpPhase: 'ground' | 'air' | 'land' = 'ground';
  jumpT = 0;
  jumpV = 0;
  private jumpBuf = 0;
  private airY0 = 0;
  private airV0 = 0;
  path: number[] = [];
  pathI = 0;
  attack: AttackState | null = null;
  private seq = 0;
  /** Time until the next attack may start. */
  cooldown = 0;

  constructor(private w: World, x: number, z: number) {
    this.x = x;
    this.z = z;
    this.y = w.terrain.groundY(x, z);
  }

  get ground(): number {
    return this.w.terrain.groundY(this.x, this.z);
  }

  get airborne(): boolean {
    return this.jumpPhase === 'air';
  }

  /** Height of the feet above the ground under them. */
  get jumpY(): number {
    return Math.max(0, this.y - this.ground);
  }

  requestJump() {
    this.jumpBuf = JUMP.buffer;
  }

  cancelAttack() {
    this.attack = null;
    this.cooldown = 0;
  }

  update(dt: number) {
    const w = this.w;
    const c = w.ctl;
    this.updateJump(dt);
    if (this.cooldown > 0) this.cooldown -= dt;
    // ---------------------------------------------------------- intentions
    let ix = c.moveX;
    let iz = c.moveZ;
    const keyMove = Math.hypot(ix, iz) > 0.08;
    if (keyMove || c.clickMove) {
      // walking by hand drops the automatic attack; a swing in progress before its hit is cancelled
      w.autoAttack = false;
      if (this.attack && !this.attack.done) this.attack = null;
    }
    if (c.clickMove) {
      this.setPath(c.clickMove.x, c.clickMove.z);
      c.clickMove = null;
    }
    if (keyMove) this.path.length = 0;
    const t = w.target;
    let wantAttack = false;
    let aimX = this.fx;
    let aimZ = this.fz;
    if (t && (w.autoAttack || c.attackHeld)) {
      const reach = w.stats.range + t.radius - 0.1;
      const d = Math.hypot(t.x - this.x, t.z - this.z);
      aimX = (t.x - this.x) / (d || 1);
      aimZ = (t.z - this.z) / (d || 1);
      if (d > reach) {
        // walk into reach (melee) or into range (ranged weapons)
        if (!keyMove && !this.attack) {
          if (!this.path.length || this.repath <= 0) {
            this.setPath(t.x - aimX * (reach - 0.3), t.z - aimZ * (reach - 0.3));
            this.repath = 0.3;
          }
        }
      } else {
        this.path.length = 0;
        wantAttack = !keyMove;
      }
    } else if (c.attackHeld && !keyMove) {
      // no target: attack toward the cursor
      const dx = c.aimX - this.x;
      const dz = c.aimZ - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        aimX = dx / d;
        aimZ = dz / d;
      }
      this.path.length = 0;
      wantAttack = true;
    }
    this.repath -= dt;
    if (!keyMove && this.path.length) [ix, iz] = this.steer();
    // ---------------------------------------------------------- attacks
    if (wantAttack && !this.attack && this.cooldown <= 0) this.startAttack(aimX, aimZ);
    const a = this.attack;
    if (a) {
      a.t += dt;
      this.fx = a.dirX;
      this.fz = a.dirZ;
      if (!a.done && a.t >= a.dur * a.hitAt) {
        a.done = true;
        w.resolveAttack(a.weapon, w.stats.hitDamage, a.dirX, a.dirZ);
      }
      if (a.t >= a.dur) this.attack = null;
      // feet stay planted until the hit lands
      if (!a.done) ix = iz = 0;
    }
    // ---------------------------------------------------------- movement
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    this.moving = len > 0.08;
    if (this.moving && !this.attack) {
      this.fx = ix / Math.max(len, 1e-6);
      this.fz = iz / Math.max(len, 1e-6);
    }
    const speed = w.stats.moveSpeed;
    const k = 1 - Math.exp(-30 * dt);
    this.vx += (ix * speed - this.vx) * k;
    this.vz += (iz * speed - this.vz) * k;
    this.moveWithTerrain(this.vx * dt, this.vz * dt);
    if (this.moving || Math.hypot(this.vx, this.vz) > 0.3) this.anim += dt * speed * 2.2;
  }

  private repath = 0;

  private startAttack(dx: number, dz: number) {
    const w = this.w;
    const st = w.stats;
    const wpn = st.weapon;
    this.attack = { weapon: wpn, t: 0, dur: st.interval, hitAt: wpn?.hitAt ?? 0.45, done: false, dirX: dx, dirZ: dz, seq: ++this.seq };
    this.cooldown = st.interval;
    this.fx = dx;
    this.fz = dz;
    const k = wpn?.kind;
    if (k === 'sword1h' || k === 'sword2h' || !k) w.fx.sound('slash', 0.45);
    else if (k === 'spear') w.fx.sound('thrust', 0.5);
  }

  private setPath(tx: number, tz: number) {
    const t = this.w.terrain;
    if (Math.hypot(tx - this.x, tz - this.z) < 0.2) {
      this.path.length = 0;
      return;
    }
    this.path = clearLine(t, this.x, this.z, tx, tz) ? [tx, tz] : findPath(t, this.x, this.z, tx, tz);
    this.pathI = 0;
  }

  private steer(): [number, number] {
    while (this.pathI < this.path.length) {
      const tx = this.path[this.pathI];
      const tz = this.path[this.pathI + 1];
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      const last = this.pathI + 2 >= this.path.length;
      if (d < (last ? 0.12 : 0.35)) {
        this.pathI += 2;
        continue;
      }
      const k = last ? Math.min(1, d / 0.6 + 0.25) : 1;
      return [(dx / d) * k, (dz / d) * k];
    }
    this.path.length = 0;
    return [0, 0];
  }

  private updateJump(dt: number) {
    if (this.jumpBuf > 0 && this.jumpPhase !== 'land') this.jumpBuf -= dt;
    this.jumpT += dt;
    const g = this.ground;
    switch (this.jumpPhase) {
      case 'ground':
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.w.jumps++;
          this.takeOff((4 * JUMP.height) / JUMP.airTime);
          this.w.fx.sound('jump', 0.5);
        }
        break;
      case 'air': {
        const grav = (8 * JUMP.height) / (JUMP.airTime * JUMP.airTime);
        const t = this.jumpT;
        this.y = this.airY0 + this.airV0 * t - 0.5 * grav * t * t;
        this.jumpV = this.airV0 - grav * t;
        if (this.jumpV <= 0 && this.y <= g) {
          this.y = g;
          this.land();
        }
        break;
      }
      case 'land':
        if (this.jumpT >= JUMP.landLag) this.jumpPhase = 'ground';
        break;
    }
    if (this.jumpPhase !== 'air') {
      if (g > this.y) this.y = g;
      else if (this.y > g) {
        // walking off a ledge is a fall
        if (this.y - g > SLOPE.fall) this.takeOff(0);
        else this.y = g;
      }
    }
  }

  private takeOff(v0: number) {
    this.jumpPhase = 'air';
    this.jumpT = 0;
    this.airY0 = this.y;
    this.airV0 = v0;
    this.jumpV = v0;
  }

  private land() {
    this.jumpV = 0;
    this.jumpPhase = 'land';
    this.jumpT = 0;
    this.w.fx.burst(this.x, 0.1, this.z, 0xb8a888, 8, 2.2, 0.14, 0.4, 'smoke');
    this.w.fx.sound('land', 0.5);
  }

  private moveWithTerrain(mx: number, mz: number) {
    const t = this.w.terrain;
    const r = this.radius;
    const air = this.jumpPhase === 'air';
    const feet = this.y;
    // in the air the body may only enter ground at or below the feet: a 1-block ledge is cleared
    // once the jump lifts the feet above it (no clipping into the side of an obstacle)
    const okAir = (x: number, z: number) => {
      if (!air) return t.canWalk(this.x, this.z, x, z, feet, false);
      if (t.blocksLocal(Math.floor(x - t.ox), Math.floor(z - t.oz))) return false;
      return t.groundY(x, z) <= feet + 0.02;
    };
    const nx = this.x + mx;
    const sx = mx > 0 ? r : -r;
    if (mx === 0 || (okAir(nx + sx, this.z - r * 0.8) && okAir(nx + sx, this.z + r * 0.8))) this.x = nx;
    else this.vx = 0;
    const nz = this.z + mz;
    const sz = mz > 0 ? r : -r;
    if (mz === 0 || (okAir(this.x - r * 0.8, nz + sz) && okAir(this.x + r * 0.8, nz + sz))) this.z = nz;
    else this.vz = 0;
    this.x = clamp(this.x, t.ox + 1, t.ox + t.size - 1);
    this.z = clamp(this.z, t.oz + 1, t.oz + t.size - 1);
  }
}
