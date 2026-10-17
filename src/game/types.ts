import type { EmitLayer } from '../config/vfx';

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
