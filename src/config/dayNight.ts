/**
 * Day/night cycle configuration (v2.2). Everything that the cycle changes lives here: phase
 * lighting per phase. The phases follow the world clock (see game/GameClock.ts):
 * dawn 05–07, day 07–18, dusk 18–20, night 20–05; 1 real second = 1 game minute.
 */

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';

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
  light: {
    // Minecraft Dungeons palette: peachy dawn, warm saturated day, magenta-orange dusk and a
    // deep, rich blue night lit by torches (not a grey, desaturated one)
    dawn: { sun: 0.85, sunColor: 0xffc49a, ambient: 0.9, ambientColor: 0xc8c8f0, tint: 0.45, fog: 0.92, fogColor: 0xe8b4a8, fogTint: 0.3, warm: 0.06, sat: 1.04 },
    day: { sun: 1, sunColor: 0xfff0d8, ambient: 1, ambientColor: 0xffffff, tint: 0, fog: 1, fogColor: 0xffffff, fogTint: 0, warm: 0.035, sat: 1.08 },
    dusk: { sun: 0.72, sunColor: 0xff9050, ambient: 0.75, ambientColor: 0xb090d0, tint: 0.55, fog: 0.88, fogColor: 0x7a4a78, fogTint: 0.38, warm: 0.08, sat: 1.08 },
    // moonlight: a cold blue key light, deep blue ambient and fog, colour kept rich
    night: { sun: 0.58, sunColor: 0x5a7cff, ambient: 0.7, ambientColor: 0x3a58d8, tint: 0.9, fog: 0.74, fogColor: 0x0a1640, fogTint: 0.72, warm: -0.06, sat: 1.0 },
  } as Record<DayPeriod, PhaseLight>,
  /** Maps whose palette is already dark get a softer night (their own lighting carries the mood). */
  darkMapNightStrength: 0.55,

};
