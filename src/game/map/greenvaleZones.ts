import { Rng } from '../../core/Rng';
import { CREATURES, type CreatureEntry } from '../../data/bestiary';
import { creatureStats } from '../../data/creatureStats';
import type { Terrain } from '../Terrain';
import { RIVER, SPAWN } from './greenvale';

/** A creature camp: its members wander around the centre and come back after death. */
export interface Camp {
  creature: CreatureEntry;
  x: number;
  z: number;
  level: number;
  /** Number of members. */
  size: number;
}

/** No camp closer than this to the spawn point: the meadow stays safe. */
export const SAFE_RADIUS = 28;

/** Themed regions of the vale. Greenvale is one biome, so the themes are just distinct corners. */
interface Region {
  id: string;
  /** Picks a candidate point (cells). */
  sample(rng: Rng): [number, number];
}

const disc = (cx: number, cz: number, r: number): Region['sample'] => (rng) => {
  const a = rng.next() * Math.PI * 2;
  const d = Math.sqrt(rng.next()) * r;
  return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
};

const REGIONS: Record<string, Region> = {
  // the woods west and north of the meadow, the nearest (lowest level) ring
  forest: {
    id: 'forest',
    sample(rng) {
      const a = Math.PI * (0.7 + rng.next() * 0.85); // west through north
      const d = SAFE_RADIUS + 2 + rng.next() * 50;
      return [SPAWN.x + Math.cos(a) * d, SPAWN.z + Math.sin(a) * d];
    },
  },
  // the west bank of the river
  swamp: {
    id: 'swamp',
    sample(rng) {
      const z = 60 + rng.next() * 160;
      return [RIVER.centerX(z) - 8 - rng.next() * 16, z];
    },
  },
  snow: { id: 'snow', sample: disc(42, 42, 26) },
  desert: { id: 'desert', sample: disc(48, 208, 26) },
  dungeons: { id: 'dungeons', sample: disc(128, 214, 22) },
  special: { id: 'special', sample: disc(160, 52, 22) },
  bosses: { id: 'bosses', sample: disc(125, 20, 10) },
};

const SWAMP_WORDS = ['swamp', 'witch', 'frog', 'toad', 'bog', 'marsh', 'leech', 'croc', 'lizard', 'slime', 'snake', 'serpent'];

function regionOf(c: CreatureEntry): Region {
  if (SWAMP_WORDS.some((w) => c.id.includes(w))) return REGIONS.swamp;
  return REGIONS[c.category] ?? REGIONS.forest;
}

/** Zone level: 1 at the edge of the safe meadow, rising about one level per 8 cells outward. */
export function zoneLevel(x: number, z: number): number {
  const d = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  return Math.max(1, 1 + Math.floor((d - SAFE_RADIUS) / 8));
}

/**
 * Lays out the camps of every creature in CREATURES (fixed seed: the same on every launch).
 * New creatures get camps automatically, in the region of their category.
 */
export function buildCamps(t: Terrain): Camp[] {
  const camps: Camp[] = [];
  const rng = new Rng(7331);
  const open = (x: number, z: number) => {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!t.walkableAt(x + dx, z + dz)) return false;
    return true;
  };
  for (const c of CREATURES) {
    const s = creatureStats(c);
    const region = regionOf(c);
    const want = c.category === 'bosses' ? 1 : 3;
    let made = 0;
    for (let k = 0; k < 400 && made < want; k++) {
      const [x, z] = region.sample(rng);
      if (x < 8 || z < 8 || x > t.size - 8 || z > t.size - 8) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < SAFE_RADIUS) continue;
      if (!open(x, z)) continue;
      if (camps.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 11 * 11)) continue;
      camps.push({ creature: c, x, z, level: zoneLevel(x, z) + s.tier, size: s.pack });
      made++;
    }
  }
  return camps;
}
