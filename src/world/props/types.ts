/**
 * World prop library types. Pure data: no THREE / DOM, so map generators (which also run in the
 * headless tests) can place props.
 *
 * Units: builders work in PIXELS. One reference-sheet "block" is 16 px and 16 px = 2/3 of a world
 * unit (PX = 1/24), so 3 blocks span exactly 2 map cells and a 4-block lantern post stands
 * ~1.5x a hero. Local space: origin at the centre of the footprint on the ground, +y up,
 * +x and +z toward the game camera (the camera looks from +x+z, so the px/pz faces and the top
 * are the visible ones: put the "front" of a prop on +z).
 */

/** World units per pixel. */
export const PX = 1 / 24;
/** Pixels per reference-sheet block. */
export const BLOCK = 16;

export type PropCategory = 'trees' | 'vegetation' | 'water' | 'stone' | 'camps' | 'lights' | 'cargo' | 'bridges' | 'roads';

export type Face = 'top' | 'bottom' | 'px' | 'nx' | 'pz' | 'nz';

/**
 * Texture of a box: one atlas texture name for all faces, or per face. `side` covers the four
 * vertical faces, `end` top and bottom; explicit faces win over the groups.
 */
export type TexSpec = string | Partial<Record<Face | 'side' | 'end', string>>;

/**
 * Vertex animation of a part (runs in the shader, costs nothing on the CPU).
 * - swing: pendulum around `axis` through `pivot` (hanging lanterns, chains, signs)
 * - flag: cloth wave away from `axis` (the cloth's normal), growing with the distance below the pivot (banners)
 * - sway: gentle bend in the wind, growing with the height above the pivot (plants, reeds, tops of poles)
 * - flicker: flame-like squash/stretch around `pivot` (static flame cores)
 * - bob: up/down float (lilies, floating logs)
 * - spin: rotation around the vertical axis through `pivot` (crystals, windmills)
 */
export interface Anim {
  kind: 'swing' | 'flag' | 'sway' | 'flicker' | 'bob' | 'spin';
  /** Pivot in local px (default: the part's own top centre for swing/flag, bottom centre otherwise). */
  pivot?: [number, number, number];
  /** Axis in local space (swing: rotation axis, flag: wave direction). Default [1,0,0] / [0,0,1]. */
  axis?: [number, number, number];
  /** Amplitude (radians for swing/spin speed, world units for flag/sway/bob, fraction for flicker). */
  amp?: number;
  /** Angular speed (rad/s). */
  speed?: number;
  /** Phase offset (added to a per-instance random phase). */
  phase?: number;
}

/** One textured box of a prop, in local px. (x, y, z) is the MIN corner. */
export interface Part {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tex: TexSpec;
  /** Colour multiplier (default white). */
  tint?: number;
  /** Self-illumination 0..~3 (lantern glass, flames, crystals, embers). Glowing parts flicker if `flicker` is set. */
  glow?: number;
  /** Glow flicker strength 0..1 (fire-like). */
  flicker?: number;
  /** Width in px of the soft dark edge drawn round every face (default 1, 0 = none). MCD bevel look. */
  bevel?: number;
  /** Rotation of the part in radians around its pivot (default: its centre), applied before the prop rotation. */
  rot?: { x?: number; y?: number; z?: number; pivot?: [number, number, number] };
  /** Texture offset in px (shifts the pattern, e.g. to vary plank joints). */
  uv?: [number, number];
  anim?: Anim;
  /** Does not receive the vertical ground-occlusion gradient (floating / high parts). */
  noAO?: boolean;
}

/** A light source in local px. Drawn through the shared LightPool (nearest N lights win). */
export interface PropLight {
  x: number;
  y: number;
  z: number;
  color: number;
  /** Base intensity (1 ≈ a torch). Doubled-ish at night by the renderer. */
  intensity: number;
  /** Reach in world units. */
  radius: number;
  /** Flicker strength 0..1 (0 = steady magic light, 1 = campfire). */
  flicker?: number;
  /** Intensity multiplier by day (default 0.35: lamps are dim in sunlight). */
  day?: number;
}

/**
 * GPU particles that loop forever around a point (no CPU cost). Kinds:
 * fire (rising pixel flames), embers (slow drifting sparks), sparks (quick bright pops), smoke (grey
 * puffs, alpha), mist (low drifting white haze), fireflies (wander; night only), motes (magic dust
 * rising, uses color), drips (falling drops).
 */
export interface PropEmitter {
  kind: 'fire' | 'embers' | 'sparks' | 'smoke' | 'mist' | 'fireflies' | 'motes' | 'drips';
  x: number;
  y: number;
  z: number;
  /** Particles alive at once. */
  count: number;
  /** Horizontal spread radius in px. */
  spread?: number;
  /** Rise height in px (fall height for drips). */
  height?: number;
  /** Particle size in px. */
  size?: number;
  /** Colours (defaults per kind). */
  color?: number;
  color2?: number;
  /** Speed multiplier. */
  rate?: number;
}

export interface PropModel {
  parts: Part[];
  lights?: PropLight[];
  emitters?: PropEmitter[];
}

export interface BuildCtx {
  /** Variant index 0..variants-1. */
  variant: number;
  /** Seeded random in [0,1) for this instance (same seed = same prop). */
  rnd: () => number;
  seed: number;
  /** Free parameters for parametric props (e.g. bridge `length` in cells). */
  params: Record<string, number>;
}

export interface PropDef {
  id: string;
  /** Russian display name (as on the reference sheet). */
  name: string;
  category: PropCategory;
  /** Footprint in map cells [x, z] at rotation 0; may depend on params (parametric props). */
  size: [number, number] | ((params: Record<string, number>) => [number, number]);
  /**
   * Blocks movement: true = every footprint cell is solid, false = walk through (debris, rugs,
   * flowers), or a function choosing per footprint cell (fx, fz from the min corner, rotation 0).
   */
  solid: boolean | ((fx: number, fz: number, ctx: BuildCtx) => boolean);
  /** Height in world units for shot blocking (default: the model's height). */
  height?: number;
  /**
   * Walkable surface (bridges, boardwalks, stairs, platforms): the deck height in WHOLE blocks of
   * terrain (world units) above the placement y for a footprint cell, or null when that cell has no
   * deck. Deck cells become walkable floor at that height even over water or a chasm; the ground
   * under them is still drawn as before.
   */
  deck?: (fx: number, fz: number, ctx: BuildCtx) => number | null;
  /** Number of variants (default 1). */
  variants?: number;
  /** Free-form tags for map generators (e.g. 'camp', 'bandit', 'night'). */
  tags?: string[];
  build(ctx: BuildCtx): PropModel;
}

/** A placed prop (stored on Terrain.props, drawn by the prop renderer). */
export interface PropInstance {
  id: string;
  /** World position of the footprint centre and the base height. */
  x: number;
  y: number;
  z: number;
  /** Quarter turns counter-clockwise seen from above (0..3, three.js rotation.y). */
  rot: number;
  /** Extra free yaw in radians (decoration only; does not change the footprint). */
  yaw?: number;
  variant: number;
  seed: number;
  params?: Record<string, number>;
  /** Uniform scale (decoration only, default 1). */
  scale?: number;
}
