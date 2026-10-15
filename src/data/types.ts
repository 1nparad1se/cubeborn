/** Shared content definition types. All game content is described as data in /src/data. */

export interface Loc {
  ru: string;
  en: string;
}

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
  /** Look family for foliage and ambient particles. */
  generator: string;
  palette: MapPalette;
  music: { root: number; scale: string; tempo: number; mood: string };
  /** Damage per second on hazard tiles. */
  hazardDps?: number;
}

