/** Shared content definition types. */

export interface Loc {
  ru: string;
  en: string;
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

