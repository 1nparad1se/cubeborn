import type { VoxelModel } from '../data/types';
import { HERO_MODELS, ALLY_MODELS } from './heroes';
import { PROJECTILE_MODELS, PICKUP_MODELS } from './items';

export { HERO_MODELS, ALLY_MODELS, PROJECTILE_MODELS, PICKUP_MODELS };

const ALL: Record<string, VoxelModel> = { ...HERO_MODELS, ...ALLY_MODELS };

export function getModel(id: string): VoxelModel | undefined {
  return ALL[id];
}
