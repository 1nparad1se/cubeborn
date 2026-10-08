import type { HeroRigDef } from '../render/rig/HeroRig';
import { HERO_RIGS } from './heroRigs';
import { CLASS_RIGS } from './classRigs';

/** Every character model by id: the nine action classes (and the retired heroes they replaced). */
export function heroRig(id: string): HeroRigDef | undefined {
  return CLASS_RIGS[id] ?? HERO_RIGS[id];
}

export const ALL_RIGS: Record<string, HeroRigDef> = { ...HERO_RIGS, ...CLASS_RIGS };
