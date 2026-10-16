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
  /** Continent camps (world.json): id, level range top, aggro/leash radii, respawn, uniques, homes. */
  id?: string;
  lvMax?: number;
  aggro?: number;
  leash?: number;
  respawn?: number;
  unique?: boolean;
  /** Home spot per member (else a ring around the centre). */
  homes?: [number, number][];
  /** Patrol loop the camp's members walk between rests. */
  patrol?: [number, number][];
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
  // open, nearly level ground (one block of relief at most) the hero can walk to
  const open = (x: number, z: number) => {
    let lo = 99;
    let hi = -1;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = Math.floor(x + dx);
        const cz = Math.floor(z + dz);
        if (!t.walkableAt(cx, cz)) return false;
        if (t.reach && !t.reach[cz * t.size + cx]) return false;
        const e = t.elev[cz * t.size + cx];
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    return hi - lo <= 1;
  };
  for (const c of CREATURES) {
    const s = creatureStats(c);
    const region = regionOf(c);
    const want = c.category === 'bosses' ? 1 : 3;
    let made = 0;
    for (let k = 0; k < 1200 && made < want; k++) {
      let [x, z] = region.sample(rng);
      // a region mostly on cliffs or peaks: later tries drift toward the meadow
      if (k >= 400) {
        const f = (k - 400) / 800;
        x += (SPAWN.x - x) * f * 0.6;
        z += (SPAWN.z - z) * f * 0.6;
      }
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
