import type { BoneId } from './HeroRig';

/** Euler angles in degrees (x, y, z). For 'rootPos' the values are a translation in voxels. */
export type Euler3 = [number, number, number];
export type PoseMap = Partial<Record<BoneId | 'rootPos', Euler3>>;

/** Decides which attack clip a hero plays. */
export type WeaponStyle = 'sword' | 'hammer' | 'bow' | 'staff' | 'summon' | 'rod' | 'throw' | 'lob' | 'fists';

/**
 * Per-hero locomotion personality. Angles are in degrees, distances in voxels.
 * The same procedural cycle produces a heavy knight's stomp or a monk's light run.
 */
export interface Gait {
  /** Strides per world unit travelled. */
  cadence: number;
  stride: number;
  knee: number;
  armSwing: number;
  elbow: number;
  /** Vertical bob per step. */
  bounce: number;
  /** Forward lean while running. */
  lean: number;
  /** Hip roll (side to side). */
  sway: number;
  /** Hip/shoulder counter-twist. */
  twist: number;
  /** 0 = springy, 1 = heavy stomp (sharp drop on each footfall). */
  heavy: number;
  headBob: number;
  /** Arms held away from the body (bulky armour, robes). */
  armOut: number;
  /** Breathing / idle sway strength. */
  idle: number;
}

export interface AnimStyle {
  weapon: WeaponStyle;
  gait: Gait;
  /** Base pose added to idle: how the hero stands and holds the weapon. */
  stance: PoseMap;
  /** Fraction of the stance kept while running (weapon arms stay up for a knight, relax for a mage). */
  stanceRun?: number;
  victory: 'cheer' | 'salute' | 'raise' | 'flex';
}
