/**
 * Terrain height for world-space drawing. Gameplay effects, particles, decals and lights are
 * authored relative to the ground (y = 0 is "on the floor"); batches with `lift` set add the
 * ground height under each instance. The renderer points `fn` at the running world's terrain.
 */
export const GROUND: { fn: ((x: number, z: number) => number) | null } = { fn: null };

export function groundAt(x: number, z: number): number {
  return GROUND.fn ? GROUND.fn(x, z) : 0;
}
