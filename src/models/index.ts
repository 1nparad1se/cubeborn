import type { VoxelModel } from '../data/types';
import { ENEMY_MODELS } from './enemies';
import { HERO_MODELS, ALLY_MODELS } from './heroes';
import { BOSS_MODELS } from './bosses';
import { PROJECTILE_MODELS, PICKUP_MODELS } from './items';

export { ENEMY_MODELS, HERO_MODELS, ALLY_MODELS, BOSS_MODELS, PROJECTILE_MODELS, PICKUP_MODELS };

const ALL: Record<string, VoxelModel> = { ...ENEMY_MODELS, ...HERO_MODELS, ...ALLY_MODELS, ...BOSS_MODELS };

export function getModel(id: string): VoxelModel | undefined {
  return ALL[id];
}

const mainColorCache: Record<string, number> = {};

/** Colour of the largest box: used for death debris and UI accents. */
export function modelMainColor(id: string): number {
  if (mainColorCache[id] !== undefined) return mainColorCache[id];
  const m = ALL[id];
  let best = 0x888888;
  let vol = 0;
  if (m)
    for (const b of m.boxes) {
      const v = b[3] * b[4] * b[5];
      if (v > vol) {
        vol = v;
        best = b[6];
      }
    }
  return (mainColorCache[id] = best);
}
