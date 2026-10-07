/**
 * Day/night cycle configuration (v2.2). Everything that the cycle changes lives here: phase
 * lengths, lighting per phase, how each enemy type reacts, night-only spawns and night events.
 * The cycle length itself is a player setting (Settings → Gameplay).
 */

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';

/** How an enemy type reacts to the time of day. */
export type DayKind =
  /** Stronger at night, weak in daylight. */
  | 'nocturnal'
  /** Stronger by day, weak at night. */
  | 'diurnal'
  /** Unaffected. */
  | 'neutral'
  /** Special: sleeps (non-aggressive, petrified look) by day unless disturbed; a nocturnal hunter at night. */
  | 'sleeper'
  /** Special: turns into a dire form at night (red tint, bigger, faster) with nocturnal stats. */
  | 'shifter';

export interface StatMul {
  damage: number;
  hp: number;
  speed: number;
}

export interface PhaseLight {
  /** Sun (or moon) intensity multiplier and colour it tints toward. */
  sun: number;
  sunColor: number;
  /** Ambient light multiplier and tint. */
  ambient: number;
  ambientColor: number;
  /** How strongly the tints apply (0 keeps the map palette). */
  tint: number;
  /** Fog distance multiplier (<1 = closer, thicker) and fog colour blend. */
  fog: number;
  fogColor: number;
  fogTint: number;
  /** Colour temperature for the grade pass: + warm, - cold. */
  warm: number;
  /** Saturation multiplier. */
  sat: number;
}

export const DAY_NIGHT = {
  /** Cycle length options in seconds (setting); 0 turns the cycle off. */
  lengths: { off: 0, short: 180, normal: 300, long: 480 } as Record<string, number>,
  defaultLength: 'normal',
  /** Share of the cycle each period takes, in order. The run starts at the beginning of `day`. */
  phases: [
    ['dawn', 0.1],
    ['day', 0.42],
    ['dusk', 0.1],
    ['night', 0.38],
  ] as [DayPeriod, number][],

  light: {
    dawn: { sun: 0.85, sunColor: 0xffc9a0, ambient: 0.9, ambientColor: 0xffd8c8, tint: 0.45, fog: 0.92, fogColor: 0xe8b8a8, fogTint: 0.3, warm: 0.07, sat: 1.02 },
    day: { sun: 1, sunColor: 0xffffff, ambient: 1, ambientColor: 0xffffff, tint: 0, fog: 1, fogColor: 0xffffff, fogTint: 0, warm: 0.04, sat: 1.06 },
    dusk: { sun: 0.7, sunColor: 0xff9a5a, ambient: 0.78, ambientColor: 0xd8a0c0, tint: 0.55, fog: 0.88, fogColor: 0x8a5a7a, fogTint: 0.35, warm: 0.09, sat: 1.05 },
    // moonlight: a cold, dim key light, thicker blue fog and a desaturated palette
    night: { sun: 0.38, sunColor: 0x8aa8ff, ambient: 0.42, ambientColor: 0x7088d0, tint: 0.75, fog: 0.72, fogColor: 0x141a38, fogTint: 0.6, warm: -0.07, sat: 0.82 },
  } as Record<DayPeriod, PhaseLight>,
  /** Maps whose palette is already dark get a softer night (their own lighting carries the mood). */
  darkMapNightStrength: 0.55,

  /** Enemy multipliers at full day and full night; dawn and dusk blend between them. */
  mods: {
    nocturnal: { day: { damage: 0.2, hp: 0.2, speed: 0.8 }, night: { damage: 1.5, hp: 1.5, speed: 1.2 } },
    diurnal: { day: { damage: 1.5, hp: 1.5, speed: 1.2 }, night: { damage: 0.2, hp: 0.2, speed: 0.8 } },
    neutral: { day: { damage: 1, hp: 1, speed: 1 }, night: { damage: 1, hp: 1, speed: 1 } },
    sleeper: { day: { damage: 1, hp: 1, speed: 1 }, night: { damage: 1.5, hp: 1.5, speed: 1.2 } },
    shifter: { day: { damage: 1, hp: 1, speed: 1 }, night: { damage: 1.5, hp: 1.5, speed: 1.2 } },
  } as Record<DayKind, { day: StatMul; night: StatMul }>,
  /**
   * Night strength by night number (1st, 2nd, 3rd+): scales how far the night-side multipliers
   * move away from 1, so the first dark falls gently and later nights hit with the full table.
   */
  nightRamp: [0.45, 0.75, 1] as number[],
  /** Floors so weakened enemies stay meaningful: multipliers never go below these. */
  minMul: { damage: 0.2, hp: 0.2, speed: 0.5 } as StatMul,
  /** Absolute floors after scaling. */
  minDamage: 1,
  minHp: 1,

  /** Enemy id → day kind. Unlisted enemies are neutral. */
  kinds: {
    // nocturnal hunters
    dusk_moth: 'nocturnal', ghoul: 'nocturnal', plague_rat: 'nocturnal', crypt_bat: 'nocturnal', wraith: 'nocturnal',
    bone_hound: 'nocturnal', phantom: 'nocturnal', void_eye: 'nocturnal', frost_bat: 'nocturnal', ember_wisp: 'nocturnal',
    // creatures of daylight
    spore_spitter: 'diurnal', sapling_shaman: 'diurnal', thorn_beetle: 'diurnal', cult_archer: 'diurnal',
    magma_slime: 'diurnal', fire_imp: 'diurnal', lava_salamander: 'diurnal', tusk_calf: 'diurnal', gear_spider: 'diurnal', rune_drone: 'diurnal',
    // stone by day, hunters by night
    gargoyle: 'sleeper', crypt_golem: 'sleeper', stone_sentinel: 'sleeper', ice_golem: 'sleeper', obsidian_brute: 'sleeper', iron_husk: 'sleeper',
    // dire forms at night
    blight_wolf: 'shifter', snow_wolf: 'shifter', cinder_hound: 'shifter', bloat_toad: 'shifter',
  } as Record<string, DayKind>,

  /** Sleepers wake when the hero comes this close or when hit; they doze off again after this long undisturbed. */
  sleeperWakeRadius: 3.2,
  sleeperDozeAfter: 6,
  /** Dire form look. */
  shifterTint: [1.45, 0.62, 0.62] as [number, number, number],
  shifterScale: 1.15,

  /** Only spawn at night (weight 0 by day). */
  nightOnly: ['wraith', 'phantom', 'void_eye', 'frost_bat'] as string[],
  /** Extra night visitors per map, added to the spawn pool while it is dark. */
  nightSpawns: {
    blightwood: [['crypt_bat', 3], ['wraith', 1.5]],
    gloamhaven: [['ghoul', 3], ['phantom', 1.5]],
    ossuary: [['wraith', 3], ['bone_hound', 2]],
    emberwaste: [['ember_wisp', 3], ['crypt_bat', 1.5]],
    frostveil: [['frost_bat', 3], ['wraith', 1.5]],
    aetherfall: [['phantom', 3], ['void_eye', 2]],
  } as Record<string, [string, number][]>,
  /** Night visitors join from this night on. */
  visitorsFromNight: 2,
  /** Night spawn rate multiplier (more enemies in the dark). */
  nightSpawnRate: 1.1,

  events: {
    /** Seconds after nightfall when the night's elite pack arrives, and its chance (blood moon: always). */
    elitePackDelay: 12,
    elitePackChance: 0.6,
    elitePackSize: [3, 7] as [number, number],
    /** A rare night boss: chance per night from this night on (blood moon raises it). */
    nightBossFrom: 2,
    nightBossChance: 0.12,
    nightBossBloodChance: 0.5,
    nightBossHp: 0.75,
    nightBossDelay: 25,
    /** Dangerous night (blood moon): chance per night from the second night, warned this long before dusk ends. */
    bloodMoonFrom: 2,
    bloodMoonChance: 0.3,
    warnAhead: 20,
    /** Extra multiplier on night stats during a blood moon. */
    bloodMoonMul: 1.2,
    bloodMoonSpawnRate: 1.3,
    bloodMoonLight: { sunColor: 0xff5a4a, fogColor: 0x3a0a14 },
  },
} as const;
