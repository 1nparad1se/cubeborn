/** Particle spray description used by the particle renderer (Particles.emit). */

/** Particle styles the renderer knows (see Particles.emit). */
export type EmitKind = 'glow' | 'debris' | 'smoke' | 'spark' | 'ember' | 'shard' | 'bubble' | 'wisp' | 'gather' | 'pixel' | 'flame' | 'puff';

export interface EmitLayer {
  kind: EmitKind;
  count: number;
  /** Main colour and an optional second colour each particle blends toward at random. */
  color: number;
  color2?: number;
  speed: number;
  size: number;
  life: number;
  /** Half-angle of the spray cone around the hit direction (π = all around). */
  spread: number;
  /** Extra upward speed. */
  up?: number;
  /** Random start offset radius around the point. */
  jitter?: number;
}
