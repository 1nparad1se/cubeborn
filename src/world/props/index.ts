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

/**
 * Every category's props, in sheet order. Each category edits only its own file.
 * Built lazily on first use: camps.ts imports place.ts (which imports this file), so when a map
 * imports camps first, this module runs before CAMP_PROPS exists — the arrays are only read later.
 */
let ALL: PropDef[] | null = null;
const REG: Record<string, PropDef> = {};
function all(): PropDef[] {
  if (!ALL) {
    ALL = [...TREE_PROPS, ...WATER_PROPS, ...STONE_PROPS, ...VEGETATION_PROPS, ...CAMP_PROPS, ...LIGHT_PROPS, ...CARGO_PROPS, ...BRIDGE_PROPS, ...ROAD_PROPS];
    for (const p of ALL) {
      if (REG[p.id]) throw new Error(`duplicate prop id: ${p.id}`);
      REG[p.id] = p;
    }
  }
  return ALL;
}

/** The prop registry by id (a plain-object view, filled on first access). */
export const PROPS: Record<string, PropDef> = new Proxy(REG, {
  get: (o, k) => (all(), Reflect.get(o, k)),
  has: (o, k) => (all(), Reflect.has(o, k)),
  ownKeys: (o) => (all(), Reflect.ownKeys(o)),
  getOwnPropertyDescriptor: (o, k) => (all(), Reflect.getOwnPropertyDescriptor(o, k)),
});

export function propsOf(cat: PropCategory): PropDef[] {
  return all().filter((p) => p.category === cat);
}

export const PROP_CATEGORIES: PropCategory[] = ['trees', 'water', 'stone', 'vegetation', 'camps', 'lights', 'cargo', 'bridges', 'roads'];
