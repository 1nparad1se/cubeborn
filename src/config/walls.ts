/**
 * Line-of-sight rules for attacks. Shots and area hits stop at walls (map border and solid
 * obstacles at least `minHeight` blocks tall; water and lava never block shots). A weapon can
 * opt out with `passWalls: true` in its definition; the behaviours below pass by design.
 */
export const WALLS = {
  /** Solid columns lower than this are low cover: shots fly over them. */
  minHeight: 2,
  /** Behaviours that ignore walls: sky strikes, things falling from above, overhead orbits, allies. */
  passBehaviors: ['orbit', 'strike', 'meteor', 'summon'] as readonly string[],
  /** Spark burst size when a shot hits a wall. */
  impactParticles: 6,
} as const;
