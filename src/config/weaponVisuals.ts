/**
 * Weapon visuals (v2.3): how each weapon's object looks and moves while it flies, attacks, hits
 * and is destroyed. One shared animation system (render/weapons) reads these values; every weapon
 * has its own numbers. Models live in render/weapons/models.ts, motion scripts in animate.ts.
 */

export type WeaponAnim = 'idle' | 'fly' | 'attack' | 'hit' | 'destroy' | 'chain' | 'open' | 'fanOpen' | 'return' | 'shatter' | 'charge';

/** Where the object lives in the game. */
export type VisualKind =
  /** A projectile drawn instead of its old voxel model. */
  | 'projectile'
  /** An artifact that floats beside the hero (it casts the weapon). */
  | 'artifact'
  /** A summoned ally. */
  | 'ally';

export interface WeaponVisualDef {
  /** Model id (render/weapons/models.ts) and animation script id. */
  model: string;
  script: string;
  kind: VisualKind;
  /** Model scale (on top of the projectile's own scale in the game). */
  scale: number;
  /** Spin speed (rad/s) and direction; axis: roll = around travel, tumble = end over end, yaw = around up. */
  spin: number;
  spinDir: 1 | -1;
  spinAxis: 'roll' | 'tumble' | 'yaw';
  /** Bob (sway) amplitude in world units and its speed. */
  bob: number;
  bobSpeed: number;
  /** Flight speed in the viewer (world units/s). The game keeps each weapon's own speed. */
  flightSpeed: number;
  /** Glow intensity and how fast it pulses. */
  glow: number;
  pulse: number;
  /** Trail: width (0 = none), lifetime and colour. */
  trail: number;
  trailLife: number;
  trailColor: number;
  /** Particles per second while flying and the overall effect intensity. */
  particles: number;
  intensity: number;
  /** Main colour (lights, flashes). */
  color: number;
  /** Animations the viewer offers on top of idle/fly/attack/hit/destroy. */
  extra: WeaponAnim[];
  /** Lengths of the one-shot animations (seconds). */
  attackTime: number;
  hitTime: number;
  destroyTime: number;
}

const base = {
  spinDir: 1 as const,
  bob: 0.05,
  bobSpeed: 3,
  flightSpeed: 3,
  glow: 0.6,
  pulse: 4,
  trail: 0.2,
  trailLife: 0.3,
  particles: 12,
  intensity: 1,
  extra: [] as WeaponAnim[],
  attackTime: 1,
  hitTime: 0.6,
  destroyTime: 0.9,
};

const EMBER: WeaponVisualDef = {
  ...base,
  model: 'ember',
  script: 'ember',
  kind: 'projectile',
  scale: 1,
  spin: 5,
  spinAxis: 'roll',
  bob: 0.02,
  flightSpeed: 4,
  glow: 0.7,
  pulse: 6,
  trail: 0.3,
  trailLife: 0.32,
  trailColor: 0xff7a24,
  particles: 26,
  color: 0xff7a2e,
  attackTime: 0.8,
};

const FLASK: WeaponVisualDef = {
  ...base,
  model: 'flask',
  script: 'flask',
  kind: 'projectile',
  scale: 1,
  spin: 9,
  spinAxis: 'tumble',
  bob: 0,
  flightSpeed: 3,
  glow: 0.5,
  pulse: 3,
  trail: 0.14,
  trailLife: 0.28,
  trailColor: 0x8aff3a,
  particles: 10,
  color: 0x9cff4f,
  extra: ['shatter'],
  attackTime: 1.1,
  destroyTime: 1.2,
};

const CYCLONE: WeaponVisualDef = {
  ...base,
  model: 'cyclone',
  script: 'cyclone',
  kind: 'projectile',
  scale: 1,
  spin: 7,
  spinAxis: 'yaw',
  bob: 0,
  flightSpeed: 2,
  glow: 0.4,
  pulse: 2,
  trail: 0,
  trailColor: 0xc8f5ff,
  particles: 14,
  color: 0xc8f5ff,
  extra: ['fanOpen'],
  attackTime: 1.6,
  destroyTime: 1,
};

const ROD: WeaponVisualDef = {
  ...base,
  model: 'rod',
  script: 'rod',
  kind: 'artifact',
  scale: 1,
  // artifacts hover beside the hero without spinning
  spin: 0,
  spinAxis: 'yaw',
  bob: 0.09,
  bobSpeed: 2.2,
  flightSpeed: 2.6,
  glow: 0.8,
  pulse: 5,
  trail: 0.22,
  trailLife: 0.4,
  trailColor: 0x8ad0ff,
  particles: 8,
  color: 0xfff27a,
  extra: ['charge'],
  attackTime: 1.1,
  hitTime: 0.8,
};

const TOME: WeaponVisualDef = {
  ...base,
  model: 'tome',
  script: 'tome',
  kind: 'artifact',
  scale: 1,
  spin: 0,
  spinAxis: 'yaw',
  bob: 0.08,
  bobSpeed: 1.8,
  flightSpeed: 2.2,
  glow: 0.6,
  pulse: 2.5,
  trail: 0.3,
  trailLife: 0.45,
  trailColor: 0xffd860,
  particles: 10,
  color: 0xffb35c,
  extra: ['open'],
  attackTime: 2.2,
  destroyTime: 1.2,
};

const SPARK: WeaponVisualDef = {
  ...base,
  model: 'spark',
  script: 'spark',
  kind: 'projectile',
  scale: 1,
  spin: 9,
  spinAxis: 'yaw',
  bob: 0.02,
  bobSpeed: 9,
  flightSpeed: 7,
  glow: 1,
  pulse: 14,
  trail: 0.22,
  trailLife: 0.22,
  trailColor: 0x7ad8ff,
  particles: 30,
  color: 0x7ad8ff,
  extra: ['chain'],
  attackTime: 1.6,
  hitTime: 0.5,
  destroyTime: 0.6,
};

const FAMILIAR: WeaponVisualDef = {
  ...base,
  model: 'familiar',
  script: 'familiar',
  kind: 'ally',
  scale: 1,
  spin: 0,
  spinAxis: 'yaw',
  bob: 0.12,
  bobSpeed: 3.2,
  flightSpeed: 3.2,
  glow: 0.6,
  pulse: 3,
  trail: 0.18,
  trailLife: 0.35,
  trailColor: 0x9a5aff,
  particles: 9,
  color: 0xb070ff,
  extra: ['return'],
  attackTime: 1.3,
  destroyTime: 1.1,
};

// ------------------------------------------------------------------ the rest of the arsenal (v2.4)
const proj = (o: Partial<WeaponVisualDef> & { model: string; color: number }): WeaponVisualDef => ({
  ...base,
  script: o.model,
  kind: 'projectile',
  scale: 1,
  spin: 0,
  spinAxis: 'roll',
  bob: 0,
  flightSpeed: 5,
  trailColor: o.color,
  attackTime: 0.35,
  hitTime: 0.45,
  destroyTime: 0.7,
  ...o,
});
const art = (o: Partial<WeaponVisualDef> & { model: string; color: number }): WeaponVisualDef => ({
  ...base,
  script: o.model,
  kind: 'artifact',
  scale: 1,
  spin: 0,
  spinAxis: 'yaw',
  bob: 0.06,
  bobSpeed: 2,
  flightSpeed: 2.5,
  trail: 0,
  trailColor: o.color,
  ...o,
});
const DAGGER = proj({ model: 'dagger', color: 0xcfe3ff, spin: 3, trail: 0.12, trailLife: 0.18, particles: 14, glow: 0.4, flightSpeed: 6 });
const ARCANE = proj({ model: 'arcane', color: 0xb98cff, spin: 2, trail: 0.22, trailLife: 0.35, trailColor: 0x9a6aff, particles: 18, glow: 0.8, pulse: 6, bob: 0.03, flightSpeed: 4 });
const ICESHARD = proj({ model: 'iceshard', color: 0x8fe9ff, spin: 4, trail: 0.16, trailLife: 0.3, particles: 14, glow: 0.6, flightSpeed: 5 });
const ARROW = proj({ model: 'arrow', color: 0xc9a46b, spin: 6, trail: 0.08, trailLife: 0.2, trailColor: 0xffffff, particles: 16, glow: 0.3, flightSpeed: 7 });
const HEAVYBOLT = proj({ model: 'heavybolt', color: 0xa0806a, spin: 2.5, trail: 0.14, trailLife: 0.25, trailColor: 0xd8c8b0, particles: 8, glow: 0.3, flightSpeed: 5 });
const GLAIVE = proj({ model: 'glaive', color: 0xe8f0ff, spin: 14, spinAxis: 'yaw', trail: 0.3, trailLife: 0.3, particles: 14, glow: 0.6, flightSpeed: 4.5, destroyTime: 0.6 });
const SAW = proj({ model: 'saw', color: 0xd0d6e0, spin: 22, spinAxis: 'yaw', trail: 0.18, trailLife: 0.18, trailColor: 0xfff0c0, particles: 10, glow: 0.3, flightSpeed: 3.5, destroyTime: 0.6 });
const WISP = proj({ model: 'wisp', kind: 'ally', color: 0x9dffd6, spinAxis: 'yaw', bob: 0.1, bobSpeed: 2.6, trail: 0.2, trailLife: 0.4, particles: 12, glow: 0.8, pulse: 3, flightSpeed: 3, attackTime: 0.45, hitTime: 0.4, destroyTime: 0.9, });
const BOMB = proj({ model: 'bomb', color: 0xff9b3d, spin: 5, spinAxis: 'tumble', trail: 0.1, trailLife: 0.3, trailColor: 0x8a8480, particles: 6, glow: 0.3, flightSpeed: 3, attackTime: 0.8, hitTime: 0.9, destroyTime: 1 });
const MINE = proj({ model: 'mine', color: 0xff5470, spinAxis: 'yaw', trail: 0, particles: 6, glow: 0.6, pulse: 3, flightSpeed: 2, attackTime: 0.8, hitTime: 0.9, destroyTime: 0.8 });
const RUNEBLADE = art({ model: 'runeblade', color: 0x9fd8ff, kind: 'projectile', trail: 0.5, trailLife: 0.22, trailColor: 0xbfe8ff, particles: 10, glow: 0.6, attackTime: 0.5, hitTime: 0.35, destroyTime: 0.8 });
const FIST = art({ model: 'fist', color: 0xffc66b, kind: 'projectile', trail: 0.2, trailLife: 0.2, particles: 8, glow: 0.6, attackTime: 0.32, hitTime: 0.3, destroyTime: 0.7 });
const LANCE = art({ model: 'lance', color: 0xd9e6ff, kind: 'projectile', trail: 0.3, trailLife: 0.25, trailColor: 0xe8f0ff, particles: 8, glow: 0.5, attackTime: 0.55, hitTime: 0.35, destroyTime: 0.8 });
const PRISM = art({ model: 'prism', color: 0xff6bd6, particles: 8, glow: 0.8, pulse: 4, attackTime: 1.4, hitTime: 0.4, destroyTime: 0.8 });
const HALO = art({ model: 'halo', color: 0xfff1a8, particles: 10, glow: 0.8, pulse: 2, bob: 0.04, attackTime: 0.7, hitTime: 0.4, destroyTime: 0.9 });
const HEART = art({ model: 'heart', color: 0x7affc3, particles: 6, glow: 0.8, pulse: 3, attackTime: 1, hitTime: 0.4, destroyTime: 0.9 });

/** Weapon id → visual. Evolutions reuse their base visual at tier 4 with their own colours. */
export const WEAPON_VISUALS: Record<string, WeaponVisualDef> = {
  ember_orb: EMBER,
  sunfire_core: { ...EMBER, trailColor: 0xffc040, color: 0xffd23d, glow: 1, particles: 34, intensity: 1.3 },
  venom_flask: FLASK,
  plague_bloom: { ...FLASK, trailColor: 0xd4ff3d, color: 0xd4ff3d, intensity: 1.25 },
  cyclone_fan: CYCLONE,
  hurricane_eye: { ...CYCLONE, scale: 1, spin: 9, intensity: 1.3, color: 0x9ae8ff },
  storm_rod: ROD,
  tempest_crown: { ...ROD, glow: 1, intensity: 1.3, color: 0xb3f0ff },
  starfall_tome: TOME,
  cataclysm: { ...TOME, trailColor: 0xff7a2a, color: 0xff5a2a, intensity: 1.3 },
  chain_spark: SPARK,
  thunderweb: { ...SPARK, trailColor: 0xd2f3ff, color: 0xd2f3ff, intensity: 1.3 },
  bone_familiars: FAMILIAR,
  legion_of_bones: { ...FAMILIAR, model: 'familiar_lord', scale: 1.25, trailColor: 0x7a8aff, color: 0x9a8aff, intensity: 1.3 },
  twin_daggers: DAGGER,
  thousand_edges: { ...DAGGER, trailColor: 0xbfe0ff, color: 0xbfe0ff, intensity: 1.25 },
  arcane_staff: ARCANE,
  archmage_scepter: { ...ARCANE, trailColor: 0xffd860, color: 0xd8b0ff, intensity: 1.3 },
  frost_shards: ICESHARD,
  absolute_zero: { ...ICESHARD, trailColor: 0xffffff, color: 0xd8f8ff, intensity: 1.3 },
  longbow: ARROW,
  skypiercer: { ...ARROW, trailColor: 0xc8f5ff, color: 0xc8f5ff, intensity: 1.3 },
  bolt_thrower: HEAVYBOLT,
  siege_engine: { ...HEAVYBOLT, trailColor: 0xff8a2a, color: 0xff8a2a, intensity: 1.3 },
  moon_glaive: GLAIVE,
  eclipse_glaive: { ...GLAIVE, trailColor: 0xffc860, color: 0xffc860, intensity: 1.3 },
  whirling_saws: SAW,
  maelstrom_saws: { ...SAW, trailColor: 0xff6a5a, color: 0xff6a5a, intensity: 1.3 },
  guardian_wisps: WISP,
  spirit_choir: { ...WISP, trailColor: 0xfff0a0, color: 0xc8fff0, intensity: 1.3 },
  powder_keg: BOMB,
  cluster_barrage: { ...BOMB, color: 0xff5a3a, intensity: 1.3 },
  rune_traps: MINE,
  minefield: { ...MINE, color: 0xff8a9a, intensity: 1.3 },
  rune_blade: RUNEBLADE,
  soulreaver: { ...RUNEBLADE, trailColor: 0xb08aff, color: 0x9a6aff, intensity: 1.3 },
  spirit_fists: FIST,
  hundred_palms: { ...FIST, trailColor: 0xffe070, color: 0xffe070, intensity: 1.3 },
  sky_lance: LANCE,
  dragon_lance: { ...LANCE, trailColor: 0xff8a4a, color: 0xff6a3a, intensity: 1.3 },
  prism_ray: PRISM,
  rainbow_lattice: { ...PRISM, color: 0xffffff, intensity: 1.3 },
  sanctified_halo: HALO,
  sanctum: { ...HALO, color: 0xfffaf0, intensity: 1.3 },
  pulse_heart: HEART,
  resonance: { ...HEART, color: 0xb8ffe0, intensity: 1.3 },
};

/** Secondary objects a weapon creates (falling stars, cyclone gusts, puddles, storm clouds). */
export const SUB_VISUALS: Record<string, WeaponVisualDef> = {
  star: { ...base, model: 'star', script: 'star', kind: 'projectile', scale: 1, spin: 6, spinAxis: 'roll', bob: 0, flightSpeed: 6, glow: 1, pulse: 8, trail: 0.42, trailLife: 0.42, trailColor: 0xffd860, particles: 30, color: 0xffd860 },
  fan: { ...base, model: 'fan', script: 'fan', kind: 'artifact', scale: 1, spin: 0, spinAxis: 'yaw', bob: 0.03, trail: 0, trailColor: 0xc8f5ff, particles: 12, color: 0xc8f5ff, attackTime: 0.9 },
  puddle: { ...base, model: 'puddle', script: 'puddle', kind: 'projectile', scale: 1, spin: 0, spinAxis: 'yaw', bob: 0, trail: 0, trailColor: 0x9cff4f, particles: 4, color: 0x9cff4f },
  wispshot: { ...base, model: 'wispshot', script: 'wispshot', kind: 'projectile', scale: 1, spin: 0, spinAxis: 'roll', bob: 0, flightSpeed: 6, glow: 1, trail: 0.12, trailLife: 0.25, trailColor: 0x9dffd6, particles: 20, color: 0x9dffd6, attackTime: 0.2, hitTime: 0.4, destroyTime: 0.5 },
  stormcloud: { ...base, model: 'stormcloud', script: 'stormcloud', kind: 'projectile', scale: 1, spin: 0.4, spinAxis: 'yaw', bob: 0.15, bobSpeed: 1, trail: 0, trailColor: 0x9ad0ff, particles: 6, color: 0xb3f0ff },
};

/** Upgrade tier shown by the models: 1 base, 2 middle levels, 3 max level, 4 evolution. */
export function visualTier(level: number, maxLevel: number, evolved: boolean): number {
  if (evolved) return 4;
  if (level >= maxLevel) return 3;
  return level >= 3 ? 2 : 1;
}
