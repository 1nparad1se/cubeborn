import type { EmitLayer } from '../config/vfx';
/** Information carried by every instance of player-caused damage. */
export interface DamageInfo {
  damage: number;
  critChance: number;
  critDamage: number;
  knockback: number;
  /** Source slot used for per-enemy re-hit timers (0..MAX_SOURCES-1). */
  source: number;
  weaponId: string;
  slow: number;
  slowDur: number;
  freeze: number;
  freezeDur: number;
  poison: number;
  poisonDur: number;
  burn: number;
  burnDur: number;
  /** Damage type (action-RPG combat); '' = untyped legacy weapon damage. */
  el: DmgType | '';
  stun: number;
  bleed: number;
  bleedDur: number;
  curse: number;
  weaken: number;
  /** Action combat: stagger damage, back-attack and execute multipliers, launch, root and mark seconds. */
  stag: number;
  backMul: number;
  execute: number;
  launch: boolean;
  root: number;
  mark: number;
}

export type DmgType = 'phys' | 'fire' | 'ice' | 'lightning' | 'poison' | 'dark' | 'magic';

export const MAX_SOURCES = 24;

export function makeDamage(): DamageInfo {
  return { damage: 0, critChance: 0, critDamage: 1.5, knockback: 1, source: 0, weaponId: '', slow: 0, slowDur: 0, freeze: 0, freezeDur: 0, poison: 0, poisonDur: 0, burn: 0, burnDur: 0, el: '', stun: 0, bleed: 0, bleedDur: 0, curse: 0, weaken: 0, stag: 0, backMul: 1, execute: 1, launch: false, root: 0, mark: 0 };
}

export function copyDamage(dst: DamageInfo, src: DamageInfo): DamageInfo {
  dst.damage = src.damage;
  dst.critChance = src.critChance;
  dst.critDamage = src.critDamage;
  dst.knockback = src.knockback;
  dst.source = src.source;
  dst.weaponId = src.weaponId;
  dst.slow = src.slow;
  dst.slowDur = src.slowDur;
  dst.freeze = src.freeze;
  dst.freezeDur = src.freezeDur;
  dst.poison = src.poison;
  dst.poisonDur = src.poisonDur;
  dst.burn = src.burn;
  dst.burnDur = src.burnDur;
  dst.el = src.el;
  dst.stun = src.stun;
  dst.bleed = src.bleed;
  dst.bleedDur = src.bleedDur;
  dst.curse = src.curse;
  dst.weaken = src.weaken;
  dst.stag = src.stag;
  dst.backMul = src.backMul;
  dst.execute = src.execute;
  dst.launch = src.launch;
  dst.root = src.root;
  dst.mark = src.mark;
  return dst;
}

export type ParticleKind = 'glow' | 'debris' | 'smoke';

/**
 * Presentation sink. The simulation calls these; the browser client renders/plays them and
 * the headless balance simulator ignores them.
 */
export interface FxSink {
  burst(x: number, y: number, z: number, color: number, count: number, speed: number, size: number, life: number, kind?: ParticleKind): void;
  number(x: number, z: number, value: number, crit: boolean, color?: number): void;
  text(x: number, z: number, text: string, color: number): void;
  shake(amount: number): void;
  light(x: number, z: number, color: number, intensity: number, radius: number, duration: number): void;
  sound(id: string, volume?: number): void;
  vibrate(ms: number): void;
  /** Directional particle spray (skill VFX); see config/vfx.ts. */
  emit(x: number, y: number, z: number, layer: EmitLayer, dirX?: number, dirZ?: number, mul?: number): void;
  /** Visual effects detail: -1 headless, 0 low, 1 medium, 2 high. */
  level(): number;
}

export const NullFx: FxSink = {
  burst() {},
  number() {},
  text() {},
  shake() {},
  light() {},
  sound() {},
  vibrate() {},
  emit() {},
  level: () => -1,
};
