import { CREATURES, type CreatureEntry } from './bestiary';

/** How a creature fights in the world. */
export type MobAttack = 'melee' | 'ranged';

/** World stats of a creature at level 1 (they scale with the camp's level, see mobScale). */
export interface CreatureStats {
  /** Base level offset added to the camp's zone level (tough creatures sit a little higher). */
  tier: number;
  hp: number;
  damage: number;
  /** Walk speed (cells/s); chases at this speed, wanders at 40%. */
  speed: number;
  /** Seconds between attacks. */
  attackCd: number;
  attack: MobAttack;
  /** Ranged: preferred shooting distance; melee: ignored. */
  range: number;
  /** Projectile colour for ranged attackers. */
  shot: number;
  aggro: number;
  flyer: boolean;
  /** Body radius (collision, hit tests) and visual scale. */
  radius: number;
  size: number;
  kbResist: number;
  xp: number;
  /** Mobs per camp and seconds before a dead camp member comes back. */
  pack: number;
  respawn: number;
}

const BASE: CreatureStats = {
  tier: 0, hp: 70, damage: 8, speed: 2.6, attackCd: 1.4, attack: 'melee', range: 1.2, shot: 0xffffff,
  aggro: 7, flyer: false, radius: 0.45, size: 1, kbResist: 0.2, xp: 10, pack: 3, respawn: 30,
};

/** Hand-tuned stats per creature id; anything missing falls back to BASE plus the guesses in creatureStats(). */
const TUNED: Record<string, Partial<CreatureStats>> = {
  forest_spider: { hp: 55, damage: 7, speed: 3.4, aggro: 7, pack: 4, xp: 9 },
  shadow_ghost: { tier: 4, hp: 90, damage: 12, speed: 2.4, flyer: true, aggro: 8, kbResist: 0.5, xp: 16 },
  forest_troll: { tier: 3, hp: 260, damage: 20, speed: 2.0, attackCd: 2.0, radius: 0.7, kbResist: 0.8, pack: 2, xp: 30, respawn: 45 },
  jackal: { hp: 50, damage: 7, speed: 4.0, attackCd: 1.0, aggro: 8, pack: 4, xp: 8 },
  forest_goblin: { hp: 70, damage: 8, xp: 10 },
  wild_boar: { hp: 95, damage: 10, speed: 3.2, kbResist: 0.4, radius: 0.55, aggro: 5, pack: 3, xp: 12 },
  swamp_witch: { tier: 2, hp: 70, damage: 11, attack: 'ranged', range: 7, shot: 0x8aff5a, attackCd: 2.0, speed: 2.2, pack: 2, xp: 15 },
  goblin_archer: { hp: 55, damage: 8, attack: 'ranged', range: 8, shot: 0xffe0a0, attackCd: 1.8, xp: 11 },
  carrion_raven: { hp: 40, damage: 6, speed: 3.8, flyer: true, aggro: 8, pack: 4, xp: 8 },
  skeleton_miner: { tier: 1, hp: 110, damage: 11, speed: 2.2, kbResist: 0.4, xp: 14 },
};

const RANGED_WORDS = ['archer', 'witch', 'mage', 'shaman', 'caster', 'sorcer', 'warlock', 'frost', 'ice', 'priest', 'slinger', 'necro', 'wizard', 'druid', 'oracle'];
const FLYER_WORDS = ['raven', 'bat', 'ghost', 'wisp', 'spirit', 'wraith', 'eagle', 'hawk', 'harpy', 'vulture', 'crow', 'owl', 'moth', 'specter', 'spectre', 'phantom'];
const BIG_WORDS = ['troll', 'golem', 'ogre', 'giant', 'yeti', 'bear', 'mammoth', 'worm', 'scorpion', 'treant', 'ent'];

const cache = new Map<string, CreatureStats>();

/** World stats of a creature (every CREATURES entry has one, tuned or guessed from its id and category). */
export function creatureStats(c: CreatureEntry): CreatureStats {
  let s = cache.get(c.id);
  if (s) return s;
  const id = c.id;
  const has = (w: string[]) => w.some((x) => id.includes(x));
  const guess: Partial<CreatureStats> = {};
  if (has(RANGED_WORDS)) Object.assign(guess, { attack: 'ranged', range: 7, attackCd: 1.9, hp: 60, pack: 2, shot: id.includes('ice') || id.includes('frost') ? 0x9ad8ff : 0xd08aff });
  if (has(FLYER_WORDS)) Object.assign(guess, { flyer: true, hp: 50, speed: 3.4 });
  if (has(BIG_WORDS)) Object.assign(guess, { tier: 3, hp: 240, damage: 18, speed: 2.0, attackCd: 2, radius: 0.7, kbResist: 0.8, pack: 2, xp: 28 });
  if (c.category === 'bosses') Object.assign(guess, { tier: 8, hp: 1500, damage: 30, radius: 0.9, size: 1.5, kbResist: 1, pack: 1, xp: 250, respawn: 300, aggro: 10 });
  else if (c.category === 'special') guess.tier = (guess.tier ?? 0) + 3;
  s = { ...BASE, ...guess, ...TUNED[id] };
  cache.set(id, s);
  return s;
}

/** Health, damage and experience at a level (level 1 = the base stats). */
export function mobScale(s: CreatureStats, level: number): { hp: number; damage: number; xp: number } {
  const l = level - 1;
  return {
    hp: Math.round(s.hp * (1 + l * 0.28)),
    damage: Math.round(s.damage * (1 + l * 0.16) * 10) / 10,
    xp: Math.round(s.xp * (1 + l * 0.45) * (1 + l * 0.03)),
  };
}

export function creatureById(id: string): CreatureEntry | undefined {
  return CREATURES.find((c) => c.id === id);
}
