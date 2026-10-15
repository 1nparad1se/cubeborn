import type { PropCategory, PropDef } from './types';
import { LIGHT_PROPS } from './lights';
import { CARGO_PROPS } from './cargo';
import { TREE_PROPS } from './trees';
import { VEGETATION_PROPS } from './vegetation';
import { WATER_PROPS } from './water';
import { STONE_PROPS } from './stone';
import { CAMP_PROPS } from './camps';
import { BRIDGE_PROPS } from './bridges';
import { ROAD_PROPS } from './roads';

export * from './types';

/** Every category's props, in sheet order. Each category edits only its own file. */
const ALL: PropDef[] = [
  ...TREE_PROPS,
  ...WATER_PROPS,
  ...STONE_PROPS,
  ...VEGETATION_PROPS,
  ...CAMP_PROPS,
  ...LIGHT_PROPS,
  ...CARGO_PROPS,
  ...BRIDGE_PROPS,
  ...ROAD_PROPS,
];

/** The prop registry by id. */
export const PROPS: Record<string, PropDef> = {};
for (const p of ALL) {
  if (PROPS[p.id]) throw new Error(`duplicate prop id: ${p.id}`);
  PROPS[p.id] = p;
}

export function propsOf(cat: PropCategory): PropDef[] {
  return ALL.filter((p) => p.category === cat);
}

export const PROP_CATEGORIES: PropCategory[] = ['trees', 'water', 'stone', 'vegetation', 'camps', 'lights', 'cargo', 'bridges', 'roads'];
