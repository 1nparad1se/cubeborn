/**
 * Open-world mode: one big location per map, mobs living at fixed camps that respawn on a
 * timer, levels rising with the distance from the safe town (Lineage-2 style). Every number
 * of the world layout and the mob behaviour lives here.
 */
export const WORLD = {
  /** Side of a location in blocks. */
  size: 1000,
  /** Town palisade radius; inside `safeR` no monster may enter or aggro. */
  townR: 30,
  safeR: 36,
  /** Hunting areas: concentric rings around the town split into `sectors` named areas each. */
  ringStart: 48,
  ringW: 86,
  rings: 5,
  sectors: 4,
  /** Camp grid: one camp per `campStep`² blocks (jittered), none closer than this to the town. */
  campStep: 21,
  campJitter: 7,
  campMinD: 56,
  /** Mobs exist only near the hero: camps inside actR spawn their members, beyond deactR idle ones vanish. */
  actR: 64,
  deactR: 84,
  /** Respawn time ranges (seconds). */
  respawn: { normal: [30, 60] as [number, number], elite: [300, 600] as [number, number], boss: [900, 1200] as [number, number] },
  /** Aggressive mobs notice the hero within aggroR (elites a little farther); passive ones only fight back. */
  aggroR: 8.5,
  eliteAggroR: 11,
  /** Chasing farther than leashR from home makes a mob give up, run home and heal. */
  leashR: 26,
  /** Mobs that cannot get home in time snap back (stuck behind obstacles). */
  returnTimeout: 7,
  /** Members of a camp within this radius join a fight (social aggro). */
  assistR: 9,
  /** Idle wandering radius around home. */
  wanderR: 4,
  /** Share of passive camps per ring (inner rings are calmer). */
  passiveShare: [0.7, 0.45, 0.25, 0.12, 0.05],
  /** Open-world mobs are tougher than wave fodder and worth more experience (kills are rarer). */
  hpMul: 2.6,
  dmgMul: 1.15,
  xpMul: 2,
  /** Named elites per ring (ring 0 = nearest the town). */
  elitesPerRing: [1, 3, 3, 3, 2],
  /** Health regained per second inside the town (share of max). */
  townRegen: 0.06,
  /** Seconds before a fallen hero wakes up in the town. */
  respawnDelay: 3,
  /** Character progress is written to the save this often (and on every return to the town). */
  saveEvery: 60,
  /** A boss lair wakes its boss when the hero comes this close to its centre. */
  lairTrigger: 11,
};
