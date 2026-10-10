import { AREAS } from '../../../config/continent';
import type { Service } from '../../../config/continent';
import type { Terrain } from '../../Terrain';
import type { Area, Station, StationKind, WorldLayout } from '../WorldGen';
import { generateContinent } from './generate';
import { buildPlaces, type ContinentLayout } from './places';

/** NPC service → the station panel it opens. */
const SERVICE_STATION: Partial<Record<Service, StationKind>> = {
  smith: 'forge',
  jeweler: 'forge',
  armorer: 'shop',
  trader: 'shop',
  alchemist: 'alchemy',
  innkeeper: 'inn',
  banker: 'stash',
  guide: 'teleport',
  mage: 'talk',
  priest: 'talk',
  trainer: 'talk',
  elder: 'talk',
  stable: 'talk',
};

let cache: { terrain: Terrain; layout: WorldLayout } | null = null;

/**
 * The persistent continent: generated once per page (it is the same every launch) and reused by
 * later sessions. The terrain is mutable in play only through camps and bosses, which live in the
 * World, so sharing it between sessions is safe.
 */
export function continentWorld(): { terrain: Terrain; layout: WorldLayout } {
  if (cache) return cache;
  const g = generateContinent();
  const cont = buildPlaces(g);
  cache = { terrain: g.t, layout: toLayout(cont) };
  return cache;
}

function toLayout(cont: ContinentLayout): WorldLayout {
  const areas: Area[] = AREAS.map((a, i) => ({ id: i, ring: 0, sector: 0, name: a.name, lo: a.lo, hi: a.hi, mobs: a.mobs.map((m) => m[0]) }));
  const stations: Station[] = [];
  cont.npcs.forEach((n, i) => {
    const kind = n.services.map((s) => SERVICE_STATION[s]).find(Boolean);
    if (!kind) return;
    stations.push({ kind, x: n.x - 0.5, z: n.z - 1, name: n.name, ref: String(i), town: n.town, r: 2.6 });
  });
  for (const w of cont.waystones) stations.push({ kind: 'teleport', x: w.x - 0.5, z: w.z - 1, name: w.name, ref: w.id, town: w.town ?? undefined, r: 3.4 });
  for (const d of cont.dungeons) stations.push({ kind: 'dungeon', x: d.x - 0.5, z: d.z - 1, name: d.def.name, ref: d.def.id, r: 3.4 });
  return { size: cont.size, c: Math.floor(cont.size / 2), areas, camps: cont.camps, lairs: cont.lairs, stations, cont };
}
