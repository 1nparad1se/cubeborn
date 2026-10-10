/** Shared content definition types. All game content is described as data in /src/data. */

export interface Loc {
  ru: string;
  en: string;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Player stat keys. Multiplicative stats are stored as bonus fractions (0.1 = +10%). */
export type StatKey =
  | 'maxHp'
  | 'armor'
  | 'moveSpeed'
  | 'might'
  | 'area'
  | 'cooldown'
  | 'amount'
  | 'projSpeed'
  | 'duration'
  | 'luck'
  | 'growth'
  | 'magnet'
  | 'regen'
  | 'critChance'
  | 'critDamage'
  | 'greed'
  | 'knockback'
  | 'pierce'
  | 'revival'
  | 'lifesteal'
  | 'thorns'
  | 'curse'
  | 'dodge'
  | 'reroll'
  | 'skip'
  | 'banish';

export type StatMods = Partial<Record<StatKey, number>>;

// ---------------------------------------------------------------- voxel models

/** One box: x, y, z (center x/z, bottom y) in voxel units, w, h, d, color, optional tag for animation. */
export type VoxBox = [number, number, number, number, number, number, number, string?];

export interface VoxelModel {
  boxes: VoxBox[];
  /** World units per voxel. */
  scale: number;
  /** Optional emissive boxes are rendered bright regardless of lighting. */
  glow?: number[];
}

// ---------------------------------------------------------------- weapons

export type Targeting = 'nearest' | 'random' | 'facing' | 'self' | 'strongest' | 'furthest' | 'cluster';

export interface WeaponStats {
  damage: number;
  /** Seconds between activations. */
  cooldown: number;
  /** Multiplier on activation rate (1 = base). */
  attackSpeed: number;
  amount: number;
  projSpeed: number;
  area: number;
  /** Seconds a projectile/effect lives. */
  duration: number;
  knockback: number;
  critChance: number;
  critDamage: number;
  /** Number of extra enemies a projectile passes through. -1 = infinite. */
  pierce: number;
  /** Behaviour-specific extras (chain count, slow, poison dps...). */
  [extra: string]: number;
}

export interface WeaponDef {
  id: string;
  name: Loc;
  desc: Loc;
  icon: string; // emoji-free glyph id for the icon renderer
  color: number;
  rarity: Rarity;
  behavior: string;
  targeting: Targeting;
  base: WeaponStats;
  /** Deltas applied when reaching level index+2. */
  levels: Partial<WeaponStats>[];
  evolution?: { passive: string; into: string };
  evolved?: boolean;
  /** Locked until an unlock grants it. */
  locked?: boolean;
  /** Tags used by hero passives (e.g. 'poison', 'fire', 'melee'). */
  tags?: string[];
  /** Hit sound id. */
  sfx?: string;
  /** Hits ignore walls (default from WALLS.passBehaviors). */
  passWalls?: boolean;
}

// ---------------------------------------------------------------- passives

export interface PassiveDef {
  id: string;
  name: Loc;
  desc: Loc;
  icon: string;
  color: number;
  rarity: Rarity;
  maxLevel: number;
  perLevel: StatMods;
  locked?: boolean;
}

// ---------------------------------------------------------------- heroes

export interface HeroDef {
  id: string;
  name: Loc;
  title: Loc;
  desc: Loc;
  perkName: Loc;
  perkDesc: Loc;
  perk: string;
  startWeapon: string;
  baseHp: number;
  baseSpeed: number;
  stats: StatMods;
  model: string;
  color: number;
  locked?: boolean;
}

// ---------------------------------------------------------------- enemies

export type EnemyBehavior =
  | 'chase'
  | 'ranged'
  | 'flyer'
  | 'summoner'
  | 'exploder'
  | 'charger'
  | 'splitter'
  | 'teleporter'
  | 'orbiter'
  | 'prop';

export interface EnemyDef {
  id: string;
  name: Loc;
  category: 'normal' | 'fast' | 'tank' | 'ranged' | 'flying' | 'summoner' | 'exploder' | 'special' | 'prop';
  behavior: EnemyBehavior;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  /** Visual scale multiplier. */
  size: number;
  xp: number;
  /** Knockback resistance 0..1 */
  kbResist: number;
  model: string;
  /** Behaviour parameters. */
  p?: Record<string, number | string>;
  flying?: boolean;
  /** Death splits into these. */
  splitInto?: string;
}

export type EliteModId = 'swift' | 'armored' | 'vampiric' | 'splitting' | 'volatile' | 'warded' | 'frenzied';

// ---------------------------------------------------------------- bosses

export interface BossAttack {
  type: string;
  cd: number;
  /** Skill name shown over the boss while it winds up. */
  name?: Loc;
  [k: string]: number | string | number[] | string[] | Loc | undefined;
}

export interface BossPhase {
  /** Phase starts when hp fraction <= this. */
  hp: number;
  move: 'chase' | 'keep' | 'stationary' | 'wander';
  speed: number;
  attacks: BossAttack[];
  /** One-shot actions when phase begins. */
  onEnter?: BossAttack[];
  /** Enrage phase: faster wind-ups, shorter gaps, glowing model. */
  enrage?: boolean;
  /** Seconds between two skills (default 1.1). */
  gap?: number;
}

export interface BossDef {
  id: string;
  name: Loc;
  title: Loc;
  /** Relative toughness (1 = a mid-map boss); the absolute health follows the monster level. */
  hp: number;
  /** Relative damage (1 = a mid-map boss); the absolute damage follows the monster level. */
  damage: number;
  /** Body (collision) radius in world units. */
  radius: number;
  /** Standing height in world units (the model is scaled to it). */
  height: number;
  model: string;
  color: number;
  phases: BossPhase[];
  relic: string;
  music?: string;
  flying?: boolean;
}

export interface RelicDef {
  id: string;
  name: Loc;
  desc: Loc;
  stats: StatMods;
  color: number;
}

// ---------------------------------------------------------------- maps

export interface SpawnSegment {
  /** Start time in seconds. */
  t: number;
  /** Enemy ids with weights. */
  pool: [string, number][];
  /** Target spawns per minute. */
  rate: number;
  /** Max simultaneous alive enemies. */
  max: number;
}

export interface MapEvent {
  t: number;
  type: string;
  [k: string]: number | string | string[] | undefined;
}

export interface MapPalette {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ambient: number;
  ambientIntensity: number;
  sun: number;
  sunIntensity: number;
  hemiGround: number;
  /** Color of the light pool that follows the hero on dark maps. */
  heroLight?: number;
  /** Tile colors by tile type name. */
  tiles: Record<string, number[]>;
  /** Block colors for obstacle materials. */
  blocks: Record<string, number[]>;
}

export interface MapDef {
  id: string;
  name: Loc;
  desc: Loc;
  size: number;
  generator: string;
  palette: MapPalette;
  difficultyStars: number;
  recommendedLevel: number;
  segments: SpawnSegment[];
  events: MapEvent[];
  midBoss: string;
  boss: string;
  bossTime: number;
  music: { root: number; scale: string; tempo: number; mood: string };
  /** Enemy hp scale for map tier. */
  tier: number;
  hazardDps?: number;
  /** Ambient particles type. */
  ambient?: string;
}

// ---------------------------------------------------------------- meta

export interface DifficultyDef {
  id: string;
  name: Loc;
  hp: number;
  damage: number;
  speed: number;
  spawn: number;
  elite: number;
  reward: number;
  color: string;
  modifiers: Loc;
}

export interface PermUpgradeDef {
  id: string;
  name: Loc;
  desc: Loc;
  icon: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  perLevel: StatMods;
}

export type UnlockRef = { kind: 'hero' | 'weapon' | 'passive' | 'map'; id: string };

export type AchievementCategory = 'progress' | 'combat' | 'weapons' | 'exploration' | 'daynight' | 'economy' | 'survival' | 'endless';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  /** Icon glyph (ui/icons) and its colour. */
  icon: string;
  color: number;
  name: Loc;
  desc: Loc;
  /** Condition key evaluated against stats. */
  cond: { stat: string; value: number; extra?: string };
  reward?: UnlockRef;
  gold?: number;
  hidden?: boolean;
}
