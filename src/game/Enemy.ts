import type { EnemyDef } from '../data/types';
import { MAX_SOURCES } from './types';

/**
 * A combat target: anything the hero's skills can hit (future monsters and bosses).
 * Pooled; plain mutable fields for speed; reset() on reuse. It has no behaviour of its own:
 * the creature that owns it decides how it moves and attacks.
 */
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
  damage = 0;
  speed = 0;
  radius = 0.4;
  scale = 1;
  xp = 0;
  kbResist = 0;
  flying = false;
  flash = 0;
  anim = 0;
  /** 0 alive, >0 dying timer */
  dying = 0;
  slowT = 0;
  slowMul = 1;
  freezeT = 0;
  poisonT = 0;
  poisonDps = 0;
  burnT = 0;
  burnDps = 0;
  /** Statuses: stun (no actions), bleed (physical DoT), curse (+damage taken), weaken (−damage dealt), mark (hunter). */
  stunT = 0;
  bleedT = 0;
  bleedDps = 0;
  curseT = 0;
  weakenT = 0;
  markT = 0;
  dotTick = 0;
  invuln = false;
  shieldT = 0;
  isAlly = false;
  noReward = false;
  lastHit = new Float32Array(MAX_SOURCES);
  /** Hit reaction (VFX): time left and the direction the last hit pushed toward. */
  hitT = 0;
  hitDx = 0;
  hitDz = 0;
  /** Stagger: accumulated stagger, bar size (0 = not computed yet), broken window, decay delay. */
  stag = 0;
  stagMax = 0;
  brokenT = 0;
  stagIdle = 0;
  /** Rooted (cannot move) and knock-up height/time. */
  rootT = 0;
  launchT = 0;
  /** Level of the creature. */
  level = 1;
  /** Display name override; empty = the definition's name. */
  name = '';

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
    this.slowT = this.freezeT = this.poisonT = this.burnT = 0;
    this.slowMul = 1;
    this.poisonDps = this.burnDps = 0;
    this.stunT = this.bleedT = this.bleedDps = this.curseT = this.weakenT = this.markT = 0;
    this.dotTick = 0;
    this.invuln = false;
    this.shieldT = 0;
    this.isAlly = false;
    this.noReward = false;
    this.lastHit.fill(-99);
    this.radius = def.radius;
    this.scale = def.size;
    this.kbResist = def.kbResist;
    this.flying = !!def.flying;
    this.hitT = this.hitDx = this.hitDz = 0;
    this.stag = this.stagMax = this.brokenT = this.stagIdle = 0;
    this.rootT = this.launchT = 0;
    this.level = 1;
    this.name = '';
  }

  get alive(): boolean {
    return this.active && this.dying === 0;
  }
}
