import type { EnemyDef } from '../data/types';
import type { DayKind } from '../config/dayNight';
import type { EliteId } from '../data/enemies';
import { MAX_SOURCES } from './types';
import type { BossController } from './bosses/Boss';

/** Pooled enemy instance. Plain mutable fields for speed; reset() on reuse. */
export class Enemy {
  index: number;
  active = false;
  /** Unique id increments on each spawn so stale references can be detected. */
  uid = 0;
  def!: EnemyDef;
  x = 0;
  z = 0;
  y = 0;
  vx = 0;
  vz = 0;
  kx = 0;
  kz = 0;
  yaw = 0;
  hp = 1;
  maxHp = 1;
  damage = 1;
  speed = 1;
  radius = 0.4;
  scale = 1;
  xp = 1;
  kbResist = 0;
  flying = false;
  flash = 0;
  anim = 0;
  /** 0 alive, >0 dying timer */
  dying = 0;
  touchCd = 0;
  state = 0;
  stateT = 0;
  cd = 0;
  aux = 0;
  dirX = 0;
  dirZ = 0;
  slowT = 0;
  slowMul = 1;
  freezeT = 0;
  poisonT = 0;
  poisonDps = 0;
  burnT = 0;
  burnDps = 0;
  /** Action-RPG statuses: stun (no actions), bleed (physical DoT), curse (+damage taken), weaken (−damage dealt), mark (hunter). */
  stunT = 0;
  bleedT = 0;
  bleedDps = 0;
  curseT = 0;
  weakenT = 0;
  markT = 0;
  dotTick = 0;
  invuln = false;
  shieldT = 0;
  elite: EliteId | null = null;
  elite2: EliteId | null = null;
  boss: BossController | null = null;
  isAlly = false;
  noReward = false;
  /** Seconds left before the enemy leaves on its own (treasure sprite). */
  ttl = 0;
  lastHit = new Float32Array(MAX_SOURCES);
  /** Map-specific tint hook for frozen/poisoned visuals. */
  tint = 0;
  /** Day/night: how this type reacts, the multipliers currently applied, sleep and dire-form state. */
  dayKind: DayKind = 'neutral';
  todHp = 1;
  todDmg = 1;
  todSpd = 1;
  asleep = false;
  awakeT = 0;
  /** 0..1 dire (night) form of shifters. */
  dire = 0;
  /** Part of a night elite pack. */
  nightPack = false;
  /** Hit reaction (VFX): time left and the direction the last hit pushed toward. */
  hitT = 0;
  hitDx = 0;
  hitDz = 0;

  constructor(index: number) {
    this.index = index;
  }

  reset(def: EnemyDef) {
    this.def = def;
    this.active = true;
    this.vx = this.vz = this.kx = this.kz = 0;
    this.y = 0;
    this.flash = 0;
    this.anim = Math.random() * 10;
    this.dying = 0;
    this.touchCd = 0;
    this.state = 0;
    this.stateT = 0;
    this.cd = 1 + Math.random() * 2;
    this.aux = 0;
    this.slowT = this.freezeT = this.poisonT = this.burnT = 0;
    this.slowMul = 1;
    this.poisonDps = this.burnDps = 0;
    this.stunT = this.bleedT = this.bleedDps = this.curseT = this.weakenT = this.markT = 0;
    this.dotTick = 0;
    this.invuln = false;
    this.shieldT = 0;
    this.elite = null;
    this.elite2 = null;
    this.boss = null;
    this.isAlly = false;
    this.noReward = false;
    this.ttl = 0;
    this.lastHit.fill(-99);
    this.radius = def.radius;
    this.scale = def.size;
    this.kbResist = def.kbResist;
    this.flying = !!def.flying;
    this.tint = 0;
    this.dayKind = 'neutral';
    this.todHp = this.todDmg = this.todSpd = 1;
    this.asleep = false;
    this.awakeT = 0;
    this.dire = 0;
    this.nightPack = false;
    this.hitT = 0;
    this.hitDx = 0;
    this.hitDz = 0;
  }

  get alive(): boolean {
    return this.active && this.dying === 0;
  }

  hasElite(id: EliteId): boolean {
    return this.elite === id || this.elite2 === id;
  }
}
