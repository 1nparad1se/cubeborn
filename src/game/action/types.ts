import type { Loc } from '../../data/types';
import type { DmgType } from '../types';

/**
 * Action combat data model (Lost-Ark-like): every class has a basic attack chain, eight skills on
 * Q W E R / A S D F, an Identity (Z) driven by its own class resource, an Awakening Ultimate (V)
 * charged by fighting, and a dodge (Space). Skills are timed scripts of events (hits, moves,
 * projectiles, zones, summons, buffs) so one interpreter plays every class.
 */

export type ClassId = 'berserker' | 'paladin' | 'steelfist' | 'ranger' | 'deathblade' | 'reaper' | 'summoner' | 'sorceress' | 'templar';

export type StatusId = 'burn' | 'slow' | 'freeze' | 'stun' | 'poison' | 'bleed' | 'curse' | 'weaken' | 'root' | 'mark';

/** How a skill is driven by its key. */
export type CastType =
  /** One press plays the whole script. */
  | 'normal'
  /** Each press within the combo window plays the next step. */
  | 'combo'
  /** Hold the key: the script loops its `tick` events until released or `holdMax`. */
  | 'hold'
  /** Hold to charge (up to `chargeMax`), release to strike harder. */
  | 'charge'
  /** A preparation (cast time) before the script plays; the hero is rooted and vulnerable. */
  | 'cast';

export type SkillTag = 'melee' | 'ranged' | 'aoe' | 'mobility' | 'control' | 'counter' | 'back' | 'head' | 'burst' | 'summon' | 'buff' | 'defense' | 'directional' | 'combo' | 'charge' | 'holding';

/** Where a shape is centred. */
export type Anchor =
  /** On the hero. */
  | 'self'
  /** At the cursor, clamped to `range`. */
  | 'aim'
  /** In front of the hero by `off` units. */
  | 'front';

export type Shape =
  /** Disc of radius r. */
  | { k: 'circle'; r: number; at?: Anchor; off?: number }
  /** Arc in front of the hero (degrees). */
  | { k: 'cone'; r: number; arc: number; back?: boolean }
  /** Rectangle from the hero along the facing (or backwards with `back`). */
  | { k: 'rect'; len: number; w: number; back?: boolean; off?: number }
  /** Two rectangles out of the hero's flanks. */
  | { k: 'sides'; len: number; w: number }
  /** Donut between r0 and r1. */
  | { k: 'ring'; r0: number; r1: number; at?: Anchor }
  /** Four rectangles in a cross around the anchor. */
  | { k: 'cross'; len: number; w: number; at?: Anchor };

export interface HitEv {
  do: 'hit';
  t: number;
  shape: Shape;
  /** Damage multiplier of the class power (basic hits ~1, skills 2..12). */
  dmg: number;
  /** Stagger damage dealt (enemies have a stagger bar). */
  stag?: number;
  el?: DmgType;
  knock?: number;
  /** Pulls enemies toward the shape's centre instead of pushing. */
  pull?: number;
  st?: StatusId;
  /** Status strength: seconds (stun/freeze/root/weaken/curse/mark), dps multiplier (burn/poison/bleed), slow factor. */
  stp?: number;
  /** Lifts enemies (visual knock-up, also a short stun). */
  launch?: boolean;
  /** Effect drawn for the hit. */
  fx?: HitFx;
  color?: number;
  /** Multiplies damage on hits from behind the enemy. */
  backMul?: number;
  /** Damage multiplier against enemies below 30% hp. */
  execute?: number;
  /** Repeats the hit `n` times every `every` seconds. */
  n?: number;
  every?: number;
  /** Camera shake. */
  shake?: number;
  sfx?: string;
}

export type HitFx = 'slash' | 'slash_wide' | 'thrust' | 'smash' | 'spin' | 'shock' | 'holy' | 'fire' | 'ice' | 'bolt' | 'dark' | 'poison' | 'punch' | 'none';

export interface MoveEv {
  do: 'move';
  t: number;
  /**
   * dash: slide along the facing; leap: arc to the cursor (clamped); blink: teleport to the cursor;
   * back: slide backwards; behind: teleport behind the enemy nearest to the cursor.
   */
  kind: 'dash' | 'leap' | 'blink' | 'back' | 'behind';
  dist: number;
  dur: number;
  /** Damage everything touched on the way (dash). */
  hit?: Omit<HitEv, 'do' | 't' | 'shape'> & { r: number };
  /** Invulnerable while moving. */
  iframe?: boolean;
}

export interface ProjEv {
  do: 'proj';
  t: number;
  dmg: number;
  stag?: number;
  el?: DmgType;
  n?: number;
  /** Fan spread in degrees. */
  spread?: number;
  speed: number;
  range: number;
  /** Collision radius. */
  r?: number;
  /** -1 = pierce all. */
  pierce?: number;
  vis: string;
  color?: number;
  explode?: number;
  st?: StatusId;
  stp?: number;
  knock?: number;
  /** Homes toward the nearest enemy. */
  seek?: boolean;
  /** Fires backwards (relative to facing) in degrees offset. */
  angle?: number;
}

export interface ZoneEv {
  do: 'zone';
  t: number;
  at: Anchor;
  range?: number;
  r: number;
  /** Telegraph before it lands. */
  delay?: number;
  /** Lasting time (0 = one blast). */
  dur?: number;
  every?: number;
  dmg: number;
  stag?: number;
  el?: DmgType;
  st?: StatusId;
  stp?: number;
  pull?: number;
  knock?: number;
  /** 'meteor' falls from the sky, 'storm' strikes random foes, 'seal' is a templar seal, 'trap' waits for an enemy. */
  vis?: 'aura' | 'meteor' | 'storm' | 'seal' | 'trap' | 'light' | 'poison' | 'ice' | 'fire' | 'rain' | 'vines';
  color?: number;
  /** Spreads several zones randomly within this radius. */
  n?: number;
  spread?: number;
  /** Slows / protects the hero standing inside (paladin sanctuary). */
  ward?: number;
  /** Heals the hero per tick (fraction of max hp). */
  heal?: number;
}

export interface SummonEv {
  do: 'summon';
  t: number;
  kind: SummonKind;
  n?: number;
  dur: number;
  /** Damage multiplier of the summon's attack. */
  dmg: number;
  at?: Anchor;
}

export type SummonKind = 'wolf' | 'golem' | 'wisp' | 'ancient' | 'hawk' | 'clone' | 'serpent' | 'drake';

export interface BuffEv {
  do: 'buff';
  t: number;
  dur: number;
  dmg?: number;
  speed?: number;
  atkSpeed?: number;
  armor?: number;
  /** Damage reduction 0..1. */
  dr?: number;
  crit?: number;
  /** Absorbs damage (fraction of max hp). */
  shield?: number;
  heal?: number;
  stealth?: boolean;
  /** Buff for summons only. */
  summons?: boolean;
  /** Counter stance: retaliates with this hit while it lasts when struck. */
  counter?: Omit<HitEv, 'do' | 't'>;
  color?: number;
}

export interface FxEv {
  do: 'fx';
  t: number;
  kind: 'flash' | 'ring' | 'burst' | 'shake' | 'light' | 'sound';
  color?: number;
  r?: number;
  sound?: string;
  shake?: number;
}

/** Lightning that jumps from the enemy nearest the cursor to its neighbours. */
export interface ChainEv {
  do: 'chain';
  t: number;
  /** Jumps (targets). */
  n: number;
  /** Reach of the first target from the hero. */
  range: number;
  /** Jump distance between targets. */
  jump: number;
  dmg: number;
  stag?: number;
  el?: DmgType;
  st?: StatusId;
  stp?: number;
  color?: number;
}

/** Orders every summon to attack the enemy nearest the cursor (summoner). */
export interface CommandEv {
  do: 'command';
  t: number;
  /** Damage multiplier of the summons' next attacks for a few seconds. */
  dmg?: number;
}

export type ActionEv = HitEv | MoveEv | ProjEv | ZoneEv | SummonEv | BuffEv | FxEv | ChainEv | CommandEv;

/** One timed animation + event script. */
export interface Step {
  /** Total commit time of the step (seconds at base speed). */
  dur: number;
  /** From this moment other skills / dodge may cancel the rest. Defaults to `dur`. */
  cancel?: number;
  /** Animation clip name in the class library. */
  anim: string;
  ev: ActionEv[];
  /** Movement allowed while the step plays (0 rooted .. 1 full speed). */
  move?: number;
  /** Turns with the cursor while playing. */
  track?: boolean;
  /** Cannot be interrupted by heavy hits. */
  armor?: 'super' | 'push' | 'none';
  /** Invulnerable for this window [start, end]. */
  iframes?: [number, number];
}

export interface SkillDef {
  id: string;
  name: Loc;
  desc: Loc;
  /** Icon id in ui/skillIcons. */
  icon: string;
  color: number;
  cd: number;
  /** Class resource spent (negative = gained). */
  cost?: number;
  type: CastType;
  tags: SkillTag[];
  el: DmgType;
  /** For the skill screen. */
  range: number;
  radius: number;
  /** Combo: steps played by successive presses. Others: steps[0] (hold: steps[0] intro, steps[1] tick loop, steps[2] finisher). */
  steps: Step[];
  /** Combo window after each step (seconds). */
  window?: number;
  holdMax?: number;
  chargeMax?: number;
  /** Preparation time for 'cast' skills. */
  castTime?: number;
  /** Damage multiplier at full charge (charge skills). */
  chargeMul?: number;
  /** Level the skill unlocks at. */
  unlock: number;
  /** Skill gains the class resource instead of spending it (cost < 0 also works). */
  builder?: boolean;
  /** Bonus vs. staggered (broken) or from-behind targets, for the skill screen. */
  note?: Loc;
}

export interface ResourceDef {
  id: string;
  name: Loc;
  desc: Loc;
  color: string;
  max: number;
  /** Per second (negative decays). */
  regen: number;
  /** Shown as orbs instead of a bar (steel fist, deathblade, templar). */
  orbs?: number;
  startFull?: boolean;
  /** Gain per hit landed by a basic attack / a skill, per kill, per damage taken (fraction). */
  onBasic: number;
  onSkill: number;
  onKill: number;
  onHurt: number;
}

/** How each class's Identity (Z) behaves; implemented in ActionSystem.identity(). */
export type IdentityKind =
  /** Berserker: Bloodlust — faster, stronger, glowing red while fury drains. */
  | 'bloodlust'
  /** Paladin: Sanctuary — a holy zone that protects and heals. */
  | 'sanctuary'
  /** Steel Fist: Spirit Awakening — empowered strikes, skills cost no orbs. */
  | 'awaken'
  /** Ranger: Hawk — a hunting hawk joins the fight and marks foes. */
  | 'hawk'
  /** Deathblade: Surge — a long dash through foes that spends every death orb. */
  | 'surge'
  /** Reaper: Persona — stealth; the next back attack lands huge damage. */
  | 'persona'
  /** Summoner: Ancient — calls an ancient guardian. */
  | 'ancient'
  /** Sorceress: Arcane Rupture — cast times and cooldowns shortened. */
  | 'rupture'
  /** Templar: Divine Axis — detonates every seal and shields the hero. */
  | 'axis';

export interface IdentityDef {
  kind: IdentityKind;
  name: Loc;
  desc: Loc;
  icon: string;
  /** Resource needed to trigger (usually the full bar). */
  need: number;
  /** Effect duration (0 = instant). */
  dur: number;
  /** Optional instant script played when triggered. */
  step?: Step;
  color: number;
}

export interface ClassDef {
  id: ClassId;
  name: Loc;
  title: Loc;
  desc: Loc;
  role: Loc;
  /** 1..3 */
  difficulty: number;
  weapon: Loc;
  /** Ratings 1..5 for the select screen. */
  ratings: { attack: number; defense: number; mobility: number; control: number; support: number; range: number };
  /** Class mechanic shown on the select screen. */
  passive: { name: Loc; desc: Loc };
  baseHp: number;
  baseSpeed: number;
  armor: number;
  /** Base damage of one power point. */
  power: number;
  color: number;
  res: ResourceDef;
  basic: { steps: Step[]; window: number; name: Loc; desc: Loc; icon: string; el: DmgType; ranged: boolean };
  dodge: { name: Loc; step: Step; cd: number; charges: number };
  skills: SkillDef[];
  ult: SkillDef;
  identity: IdentityDef;
  /** Extra class action on X (summoner: command summons). */
  special?: { name: Loc; desc: Loc; icon: string; cd: number; step: Step };
}

/** Skill tree upgrades (tripods): tier 1 at skill level 4, tier 2 at level 7. */
export type TripodKind = 'dmg' | 'cd' | 'area' | 'stag' | 'status' | 'armor' | 'speed' | 'cost' | 'extra' | 'crit' | 'range';

export interface Tripod {
  id: string;
  name: Loc;
  desc: Loc;
  kind: TripodKind;
  v: number;
  st?: StatusId;
}

export const SKILL_MAX = 10;
export const TRIPOD_LEVELS = [4, 7];
export const MAX_LEVEL = 30;
export const SLOT_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'] as const;
