/**
 * Skill visual effects by element (v2.2). Every attack plays in three beats:
 *  - anticipation: energy gathers at the hero just before a weapon fires;
 *  - impact: a burst on the hit enemy, sprayed along the hit direction, bigger on crits;
 *  - follow-through: element residue that lingers after the hit (embers, frost mist, bubbles…).
 * Counts are for the highest quality; the effects / particles settings scale them down.
 */

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'dark' | 'arcane' | 'holy';

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

export interface ElementFx {
  /** Anticipation: particles that converge on the hero's hands before the weapon fires. */
  windup: EmitLayer;
  /** Release: a short cone at the hero in the attack direction. */
  release: EmitLayer;
  /** Impact on the enemy, sprayed along the hit direction. */
  impact: EmitLayer[];
  /** Follow-through residue left at the hit point. */
  residue: EmitLayer[];
  /** Short light flash on impact (0 = none) and its colour. */
  light: number;
  lightColor: number;
  /** Impact sound (rate-limited) and how often it may play per second. */
  sound?: string;
  soundRate?: number;
}

/*
 * Minecraft Dungeons look: impacts are bold flat-coloured square pixels with a few short white
 * glints, fire is stacked square flames with embers, ice is crystal blocks, poison is bubbling
 * green squares, dark is purple/blue soul flames, holy is golden square motes.
 */
export const ELEMENT_FX: Record<Element, ElementFx> = {
  physical: {
    windup: { kind: 'gather', count: 5, color: 0xffffff, color2: 0xc8d4e8, speed: 1, size: 0.07, life: 0.16, spread: Math.PI },
    release: { kind: 'spark', count: 3, color: 0xffffff, color2: 0xd8e4ff, speed: 7, size: 0.06, life: 0.14, spread: 0.35 },
    impact: [
      { kind: 'spark', count: 4, color: 0xffffff, color2: 0xfff0c0, speed: 8, size: 0.07, life: 0.16, spread: 0.6, up: 1 },
      { kind: 'pixel', count: 4, color: 0xffffff, color2: 0xe8e0d0, speed: 4.5, size: 0.11, life: 0.28, spread: 0.9, up: 1.5 },
      { kind: 'debris', count: 2, color: 0xb8b0a0, speed: 3.5, size: 0.08, life: 0.5, spread: 0.9 },
    ],
    residue: [{ kind: 'puff', count: 1, color: 0xe8e0d0, speed: 0.6, size: 0.32, life: 0.4, spread: Math.PI }],
    light: 0,
    lightColor: 0xffffff,
  },
  fire: {
    windup: { kind: 'gather', count: 8, color: 0xffb040, color2: 0xff5010, speed: 1, size: 0.09, life: 0.2, spread: Math.PI },
    release: { kind: 'flame', count: 5, color: 0xffd040, color2: 0xd8301a, speed: 4, size: 0.14, life: 0.3, spread: 0.45, up: 0.6 },
    impact: [
      { kind: 'pixel', count: 7, color: 0xffd040, color2: 0xff5a10, speed: 6, size: 0.14, life: 0.32, spread: 0.9, up: 2 },
      { kind: 'flame', count: 5, color: 0xffe060, color2: 0xc82a14, speed: 1.6, size: 0.2, life: 0.45, spread: Math.PI, up: 0.8, jitter: 0.3 },
    ],
    residue: [
      { kind: 'ember', count: 4, color: 0xffc040, color2: 0xff4a10, speed: 0.8, size: 0.07, life: 0.9, spread: Math.PI, up: 1.6 },
      { kind: 'puff', count: 1, color: 0x4a403c, speed: 0.4, size: 0.4, life: 0.7, spread: Math.PI, up: 0.8 },
    ],
    light: 1.4,
    lightColor: 0xff7a20,
    sound: 'ignite',
    soundRate: 5,
  },
  ice: {
    windup: { kind: 'gather', count: 8, color: 0xe8fbff, color2: 0x7ad8ff, speed: 1, size: 0.08, life: 0.2, spread: Math.PI },
    release: { kind: 'shard', count: 3, color: 0xdff8ff, color2: 0x8fe0ff, speed: 6, size: 0.09, life: 0.3, spread: 0.4, up: 1 },
    impact: [
      { kind: 'shard', count: 5, color: 0xe8fbff, color2: 0x8ad8ff, speed: 5, size: 0.11, life: 0.6, spread: 0.9, up: 3 },
      { kind: 'pixel', count: 4, color: 0xffffff, color2: 0xa8ecff, speed: 3.5, size: 0.1, life: 0.3, spread: Math.PI, up: 1 },
    ],
    residue: [{ kind: 'puff', count: 2, color: 0xe8f8ff, speed: 0.5, size: 0.3, life: 0.6, spread: Math.PI }],
    light: 0.9,
    lightColor: 0x8fe0ff,
    sound: 'frost',
    soundRate: 5,
  },
  lightning: {
    windup: { kind: 'spark', count: 5, color: 0xffffff, color2: 0x9ad8ff, speed: 4, size: 0.05, life: 0.12, spread: Math.PI, up: 0.5 },
    release: { kind: 'spark', count: 5, color: 0xffffff, color2: 0xfff27a, speed: 11, size: 0.06, life: 0.1, spread: 0.6 },
    impact: [
      { kind: 'spark', count: 7, color: 0xffffff, color2: 0x9ae8ff, speed: 12, size: 0.06, life: 0.12, spread: Math.PI, up: 2 },
      { kind: 'pixel', count: 4, color: 0xd8f4ff, color2: 0x6ac8ff, speed: 5, size: 0.1, life: 0.2, spread: Math.PI, up: 1.5 },
    ],
    residue: [{ kind: 'spark', count: 3, color: 0xbfe8ff, color2: 0xfff6b0, speed: 3, size: 0.04, life: 0.35, spread: Math.PI, up: 0.5 }],
    light: 1,
    lightColor: 0xbfe8ff,
  },
  poison: {
    windup: { kind: 'gather', count: 6, color: 0xb8ff6a, color2: 0x5ad020, speed: 1, size: 0.08, life: 0.2, spread: Math.PI },
    release: { kind: 'bubble', count: 3, color: 0x9cf04a, speed: 2.5, size: 0.1, life: 0.4, spread: 0.6, up: 0.6 },
    impact: [
      { kind: 'pixel', count: 5, color: 0x9cff4f, color2: 0x3a9a10, speed: 3.5, size: 0.12, life: 0.3, spread: 0.9, up: 1 },
      { kind: 'bubble', count: 3, color: 0x8ae040, color2: 0x4ab020, speed: 1, size: 0.12, life: 0.7, spread: Math.PI, up: 0.8 },
    ],
    residue: [{ kind: 'puff', count: 1, color: 0x6ab830, speed: 0.3, size: 0.38, life: 0.8, spread: Math.PI, up: 0.3 }],
    light: 0,
    lightColor: 0x9cff4f,
    sound: 'venom',
    soundRate: 4,
  },
  dark: {
    windup: { kind: 'gather', count: 8, color: 0xc070ff, color2: 0x5a1a9a, speed: 1, size: 0.09, life: 0.22, spread: Math.PI },
    release: { kind: 'wisp', count: 3, color: 0xa060ff, color2: 0x5aa8ff, speed: 3, size: 0.1, life: 0.4, spread: 0.6 },
    impact: [
      { kind: 'wisp', count: 4, color: 0xb070ff, color2: 0x4ab0ff, speed: 3.2, size: 0.12, life: 0.45, spread: 0.9, up: 0.6 },
      { kind: 'pixel', count: 3, color: 0x6a2ab0, color2: 0x2a1450, speed: 2.5, size: 0.14, life: 0.35, spread: Math.PI, up: 0.8 },
    ],
    residue: [{ kind: 'flame', count: 2, color: 0x9a6aff, color2: 0x3a5aff, speed: 0.4, size: 0.11, life: 0.6, spread: Math.PI, up: 0.6 }],
    light: 1,
    lightColor: 0xa050ff,
    sound: 'shadow',
    soundRate: 4,
  },
  arcane: {
    windup: { kind: 'gather', count: 7, color: 0xe0b8ff, color2: 0x8a5aff, speed: 1, size: 0.08, life: 0.2, spread: Math.PI },
    release: { kind: 'pixel', count: 4, color: 0xd8b0ff, color2: 0xff8af0, speed: 5, size: 0.09, life: 0.22, spread: 0.5 },
    impact: [
      { kind: 'spark', count: 4, color: 0xffffff, color2: 0xc890ff, speed: 7, size: 0.06, life: 0.16, spread: 0.8, up: 1 },
      { kind: 'pixel', count: 5, color: 0xc89cff, color2: 0xff7ae0, speed: 3, size: 0.12, life: 0.3, spread: Math.PI, up: 1 },
    ],
    residue: [{ kind: 'glow', count: 3, color: 0xd8b8ff, speed: 0.4, size: 0.08, life: 0.7, spread: Math.PI, up: 0.7 }],
    light: 0.8,
    lightColor: 0xb98cff,
  },
  holy: {
    windup: { kind: 'gather', count: 6, color: 0xfff6c8, color2: 0xffd860, speed: 1, size: 0.08, life: 0.2, spread: Math.PI },
    release: { kind: 'ember', count: 4, color: 0xfff1a8, color2: 0xffc840, speed: 4, size: 0.08, life: 0.3, spread: 0.6, up: 1 },
    impact: [
      { kind: 'spark', count: 4, color: 0xffffff, color2: 0xffe080, speed: 6, size: 0.05, life: 0.16, spread: Math.PI, up: 3 },
      { kind: 'pixel', count: 4, color: 0xffe680, color2: 0xffc030, speed: 2.5, size: 0.11, life: 0.32, spread: Math.PI, up: 2 },
    ],
    residue: [{ kind: 'ember', count: 3, color: 0xfff1a8, color2: 0xffc840, speed: 0.3, size: 0.07, life: 0.8, spread: Math.PI, up: 1.4 }],
    light: 0.7,
    lightColor: 0xfff1a8,
  },
};

/** Weapon id → element. Unlisted weapons use their tags (fire, ice, lightning, poison, holy, magic → arcane), else physical. */
export const WEAPON_ELEMENT: Record<string, Element> = {
  el_physical: 'physical', el_fire: 'fire', el_ice: 'ice', el_lightning: 'lightning', el_poison: 'poison', el_dark: 'dark', el_arcane: 'arcane', el_holy: 'holy',
  rune_blade: 'physical', spirit_fists: 'physical', sky_lance: 'physical', twin_daggers: 'physical', longbow: 'physical',
  bolt_thrower: 'physical', moon_glaive: 'physical', whirling_saws: 'physical', cyclone_fan: 'physical', hurricane_eye: 'physical',
  hundred_palms: 'physical', thousand_edges: 'physical',
  ember_orb: 'fire', powder_keg: 'fire', starfall_tome: 'fire', dragon_lance: 'fire', sunfire_core: 'fire', siege_engine: 'fire',
  cluster_barrage: 'fire', cataclysm: 'fire', maelstrom_saws: 'fire',
  frost_shards: 'ice', absolute_zero: 'ice',
  storm_rod: 'lightning', chain_spark: 'lightning', tempest_crown: 'lightning', thunderweb: 'lightning',
  venom_flask: 'poison', plague_bloom: 'poison',
  soulreaver: 'dark', bone_familiars: 'dark', legion_of_bones: 'dark', rune_traps: 'dark', minefield: 'dark', eclipse_glaive: 'dark',
  arcane_staff: 'arcane', archmage_scepter: 'arcane', prism_ray: 'arcane', rainbow_lattice: 'arcane', pulse_heart: 'arcane',
  resonance: 'arcane', guardian_wisps: 'arcane', spirit_choir: 'arcane',
  sanctified_halo: 'holy', sanctum: 'holy', skypiercer: 'holy',
};

export const VFX = {
  /** Seconds before a weapon fires when its anticipation starts, and the shortest cooldown that gets one. */
  windupLead: 0.16,
  windupMinCooldown: 0.45,
  /** Max impacts rendered per frame (the rest only flash), and the residue share. */
  impactBudget: 14,
  residueChance: 0.55,
  /** Crits: particle multiplier, extra flash ring and light shake (rate-limited). */
  critMul: 1.8,
  critShake: 0.09,
  bigHitShake: 0.06,
  /** A hit dealing at least this share of the enemy's max hp counts as a big hit. */
  bigHitShare: 0.35,
  shakeCooldown: 0.12,
  /** Enemy hit reaction: squash amount and recoil distance along the hit direction. */
  hitSquash: 0.14,
  hitRecoil: 0.12,
  /** Status visuals per enemy per second while the status ticks. */
  statusRate: { burn: 3.5, freeze: 2, poison: 2.5 },
  /** Effects setting → multiplier (0 = beat disabled). */
  levelMul: [0.45, 0.75, 1] as number[],
};

/** Element of a weapon by id, falling back to its tags. */
export function elementFor(id: string, tags?: readonly string[]): Element {
  const e = WEAPON_ELEMENT[id];
  if (e) return e;
  if (!tags) return 'physical';
  for (const t of ['fire', 'ice', 'lightning', 'poison', 'holy'] as const) if (tags.includes(t)) return t;
  if (tags.includes('magic')) return 'arcane';
  return 'physical';
}
