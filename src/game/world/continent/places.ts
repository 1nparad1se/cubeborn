import { AREAS, CAMP_SITES, CONT, DUNGEONS, FACTIONS, LAIRS, LANDMARKS, SETTLEMENTS, WILD_WAYSTONES, type CampSite, type DungeonDef, type Service, type SettlementDef } from '../../../config/continent';
import { ELITE_IDS, ENEMY_BY_ID, type EliteId } from '../../../data/enemies';
import type { Loc } from '../../../data/types';
import { CELL } from '../../Terrain';
import { placeInst, prefabSize, PREFABS } from '../build/prefabs';
import type { BuildSpot } from '../build/VB';
import type { CampDef, Lair } from '../WorldGen';
import { addBuild, areaIndexAt, distField, fits, GRID, stamp, W_DRY, W_ICE, W_SEA, type Gen } from './generate';

/**
 * Builds the places of the continent on the rasterised terrain: settlements (streets, walls,
 * service buildings, houses, NPC posts, waystones), faction camps with their garrisons, boss
 * lairs, dungeon entrances, landmarks, vegetation and the wild monster spots in between.
 */

export interface TownRt {
  def: SettlementDef;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Where a hero bound here wakes up. */
  spawn: { x: number; z: number };
}

export interface WaystoneRt {
  id: string;
  name: Loc;
  x: number;
  z: number;
  town: string | null;
  open: boolean;
}

export interface DungeonRt {
  def: DungeonDef;
  x: number;
  z: number;
}

export interface NpcDef {
  id: string;
  name: Loc;
  role: string;
  model: string;
  x: number;
  z: number;
  yaw: number;
  town: string;
  services: Service[];
  /** Wandering radius around the post (0 = stands still). */
  wander: number;
  /** Guards fight monsters that come near. */
  guard?: boolean;
}

export interface CampSiteRt {
  def: CampSite;
  x: number;
  z: number;
  r: number;
}

export interface ContinentLayout {
  size: number;
  grid: number;
  /** Area index per coarse cell (255 = sea). */
  areaGrid: Uint8Array;
  /** Monster level per coarse cell. */
  levelGrid: Uint8Array;
  /** Climate per coarse cell (0 snow .. 4 desert). */
  climGrid: Uint8Array;
  towns: TownRt[];
  waystones: WaystoneRt[];
  dungeons: DungeonRt[];
  camps: CampDef[];
  sites: CampSiteRt[];
  lairs: (Lair & { id: string })[];
  npcs: NpcDef[];
  roads: { kind: string; pts: [number, number][] }[];
  landmarks: { id: string; name: Loc; x: number; z: number; about: Loc }[];
  start: { x: number; z: number };
  log: string[];
}

// ------------------------------------------------------------------ prefab sets per style
const HEART_HOUSES = ['house_cottage', 'house_big', 'house_survival', 'house_pretty', 'house_small', 'house_medieval', 'house_farm', 'house_country', 'house_little', 'house_medieval2', 'house_forest'];
const NORTH_HOUSES = ['north_house', 'north_house', 'north_house', 'north_longhouse'];
const SOUTH_HOUSES = ['desert_house', 'desert_house', 'desert_house2', 'desert_courtyard'];

/** Building of each service by style ('' = no building, the NPC stands on the square). */
const SERVICE_BUILD: Record<Service, [string, string, string]> = {
  smith: ['smithy', 'north_forge', 'smithy'],
  armorer: ['armory_shop', 'north_shop', 'bazaar'],
  trader: ['general_store', 'north_shop', 'bazaar'],
  alchemist: ['alchemist', 'alchemist', 'bazaar'],
  mage: ['mage_tower', 'mage_tower', 'mage_tower'],
  innkeeper: ['tavern', 'north_longhouse', 'caravanserai'],
  priest: ['chapel', 'chapel', 'desert_temple'],
  banker: ['warehouse', 'mine_store', 'caravanserai'],
  trainer: ['training_ground', 'training_ground', 'training_ground'],
  elder: ['town_hall', 'north_hall', 'desert_courtyard'],
  stable: ['stable', 'stable', 'desert_tent'],
  jeweler: ['market_stalls', 'north_shop', 'bazaar'],
  guide: ['', '', ''],
};

const SERVICE_MODEL: Record<Service, string> = {
  smith: 'npc_smith', armorer: 'npc_smith', trader: 'npc_merchant', alchemist: 'npc_alchemist', mage: 'npc_mage', innkeeper: 'npc_innkeeper',
  priest: 'npc_priest', banker: 'npc_merchant', trainer: 'npc_guard', elder: 'npc_elder', stable: 'npc_farmer', jeweler: 'npc_noble', guide: 'npc_caravaneer',
};

const ROLE_NAME: Record<string, Loc> = {
  smith: { ru: 'Кузнец', en: 'Blacksmith' }, armorer: { ru: 'Бронник', en: 'Armourer' }, trader: { ru: 'Торговец', en: 'Trader' },
  alchemist: { ru: 'Алхимик', en: 'Alchemist' }, mage: { ru: 'Маг', en: 'Mage' }, innkeeper: { ru: 'Трактирщик', en: 'Innkeeper' },
  priest: { ru: 'Жрец', en: 'Priest' }, banker: { ru: 'Хранитель склада', en: 'Warden of the Vault' }, trainer: { ru: 'Наставник', en: 'Mentor' },
  elder: { ru: 'Староста', en: 'Elder' }, stable: { ru: 'Конюх', en: 'Stablemaster' }, jeweler: { ru: 'Ювелир', en: 'Jeweller' },
  guide: { ru: 'Проводник', en: 'Guide' }, guard: { ru: 'Стражник', en: 'Guard' }, villager: { ru: 'Житель', en: 'Villager' },
};

const FIRST: Record<string, string[]> = {
  heart: ['Аларик', 'Берта', 'Годвин', 'Эльза', 'Мартин', 'Агнес', 'Освальд', 'Хильда', 'Тобиас', 'Марта', 'Ульрих', 'Грета', 'Лоренц', 'Ида', 'Конрад', 'Рут', 'Бенедикт', 'Клара', 'Фридрих', 'Ханна'],
  north: ['Бьорн', 'Сигрид', 'Ульф', 'Астрид', 'Торвальд', 'Ингрид', 'Хаук', 'Рагна', 'Эйнар', 'Гуннхильд', 'Свен', 'Фрея', 'Олав', 'Тора'],
  south: ['Карим', 'Лейла', 'Рашид', 'Зара', 'Хасан', 'Амира', 'Тарик', 'Самира', 'Джамаль', 'Ясмин', 'Назир', 'Фарах'],
};
const FIRST_EN: Record<string, string[]> = {
  heart: ['Alaric', 'Bertha', 'Godwin', 'Elsa', 'Martin', 'Agnes', 'Oswald', 'Hilda', 'Tobias', 'Martha', 'Ulrich', 'Greta', 'Lorenz', 'Ida', 'Konrad', 'Ruth', 'Benedict', 'Clara', 'Friedrich', 'Hanna'],
  north: ['Bjorn', 'Sigrid', 'Ulf', 'Astrid', 'Torvald', 'Ingrid', 'Hauk', 'Ragna', 'Einar', 'Gunnhild', 'Sven', 'Freya', 'Olav', 'Tora'],
  south: ['Karim', 'Leila', 'Rashid', 'Zara', 'Hasan', 'Amira', 'Tarik', 'Samira', 'Jamal', 'Yasmin', 'Nazir', 'Farah'],
};

function styleIx(s: SettlementDef) {
  return s.style === 'north' ? 1 : s.style === 'south' ? 2 : 0;
}

// ------------------------------------------------------------------ entry point
export function buildPlaces(g: Gen): ContinentLayout {
  const T0 = performance.now();
  const step = (name: string) => g.log.push(`${name} ${Math.round(performance.now() - T0)}ms`);
  const towns: TownRt[] = [];
  const waystones: WaystoneRt[] = [];
  const npcs: NpcDef[] = [];
  for (const s of SETTLEMENTS) towns.push(buildTown(g, s, waystones, npcs));
  step('towns');
  for (const w of WILD_WAYSTONES) {
    const ws = placeWaystone(g, w.x, w.z, w.id, w.name, null, !!w.open);
    if (ws) waystones.push(ws);
  }
  const landmarks = buildLandmarks(g);
  const dungeons = buildDungeons(g);
  const lairs = buildLairs(g);
  step('places');
  const sites: CampSiteRt[] = [];
  const camps: CampDef[] = [];
  for (const site of CAMP_SITES) buildCamp(g, site, sites, camps);
  step('camps');
  vegetation(g);
  step('vegetation');
  // walkable reach from the start
  const start = towns.find((t) => t.def.id === CONT.start)!.spawn;
  const reach = reachable(g, start.x, start.z);
  for (const t of towns) if (!reach[Math.floor(t.spawn.z) * g.n + Math.floor(t.spawn.x)]) g.log.push(`UNREACHABLE town ${t.def.id}`);
  const grids = levelGrids(g, towns);
  wildCamps(g, reach, grids, camps, sites);
  step('wild');
  return {
    size: g.n, grid: GRID, ...grids, towns, waystones, dungeons, camps, sites, lairs, npcs,
    roads: g.roads.map((r) => ({ kind: r.kind, pts: r.pts })), landmarks, start, log: g.log,
  };
}

// ------------------------------------------------------------------ settlements
interface Lot {
  x: number;
  z: number;
  rot: number;
}

/** Finds a spot for a w × d prefab inside the rect whose front (after rotation) faces a street. */
function findLot(g: Gen, kind: string, x0: number, z0: number, x1: number, z1: number, prefer: (x: number, z: number) => number, seed: number, needStreet = true): Lot | null {
  const [w, d] = prefabSize(kind);
  let best: Lot | null = null;
  let bestS = Infinity;
  const n = g.n;
  const isStreet = (x: number, z: number) => g.inb(x, z) && g.road[z * n + x] > 0;
  for (let rot = 0; rot < 4; rot++) {
    const fw = rot & 1 ? d : w;
    const fd = rot & 1 ? w : d;
    for (let z = z0; z + fd <= z1; z += 2)
      for (let x = x0; x + fw <= x1; x += 2) {
        // front direction after rotation: 0 → +z, 1 → +x, 2 → -z, 3 → -x
        const fx = rot === 1 ? x + fw : rot === 3 ? x - 1 : x + Math.floor(fw / 2);
        const fz = rot === 0 ? z + fd : rot === 2 ? z - 1 : z + Math.floor(fd / 2);
        const dx = rot === 1 ? 1 : rot === 3 ? -1 : 0;
        const dz = rot === 0 ? 1 : rot === 2 ? -1 : 0;
        let street = !needStreet;
        for (let k = 0; k < 4 && !street; k++) if (isStreet(fx + dx * k, fz + dz * k)) street = true;
        if (!street) continue;
        const s = prefer(x + fw / 2, z + fd / 2) + hashJ(x, z, seed + rot) * 3;
        if (s >= bestS) continue;
        // one free cell of margin around the footprint (except towards the street)
        if (!fits(g, x, z, fw, fd, { water: false })) continue;
        if (!fits(g, x - 1, z - 1, fw + 2, fd + 2, { roads: true, water: true })) continue;
        bestS = s;
        best = { x, z, rot };
      }
  }
  return best;
}

function hashJ(x: number, z: number, s: number) {
  let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildTown(g: Gen, s: SettlementDef, waystones: WaystoneRt[], npcs: NpcDef[]): TownRt {
  const n = g.n;
  const t = g.t;
  const x0 = s.x - s.hw;
  const x1 = s.x + s.hw;
  const z0 = s.z - s.hd;
  const z1 = s.z + s.hd;
  const st = styleIx(s);
  const ruin = s.kind === 'ruin';
  const plazaTile = st === 2 ? 'sandroad' : ruin ? 'path' : 'plaza';
  const streetTile = st === 2 ? 'sandroad' : st === 1 ? 'trail' : s.kind === 'village' || s.kind === 'hamlet' ? 'path' : 'road';
  // ground of the settlement
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (!g.inb(x, z)) continue;
      const i = z * n + x;
      if (!g.land[i] || (g.water[i] && g.water[i] !== W_DRY)) continue;
      if (!g.road[i] && st === 0 && !ruin) {
        const tile = t.tileNames[t.tile[i]];
        if (/forest|tundra|dry/.test(tile)) g.setTile(i, 'grass');
      }
    }
  // streets: the roads already crossing the town, plus a cross through the square
  const W = s.kind === 'capital' ? 5 : s.kind === 'city' ? 4 : 3;
  const street = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
    for (let k = 0; k <= L; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / L);
      const z = Math.round(az + ((bz - az) * k) / L);
      for (let a = -Math.floor(W / 2); a <= Math.floor((W - 1) / 2); a++) {
        const xx = bx !== ax ? x : x + a;
        const zz = bx !== ax ? z + a : z;
        if (!g.inb(xx, zz)) continue;
        const i = zz * n + xx;
        if (!g.land[i] || g.water[i] === W_SEA) continue;
        if (g.water[i] && g.water[i] !== W_DRY && g.water[i] !== W_ICE) continue;
        g.road[i] = Math.max(g.road[i], 2);
        g.flatten(i, streetTile);
      }
    }
  };
  street(x0 + 3, s.z, x1 - 3, s.z);
  street(s.x, z0 + 3, s.x, z1 - 3);
  if (s.kind === 'capital') {
    street(x0 + 3, s.z - 26, x1 - 3, s.z - 26);
    street(x0 + 3, s.z + 26, x1 - 3, s.z + 26);
    street(s.x - 34, z0 + 3, s.x - 34, z1 - 3);
    street(s.x + 34, z0 + 3, s.x + 34, z1 - 3);
  } else if (s.kind === 'city') {
    street(x0 + 3, s.z + 18, x1 - 3, s.z + 18);
    street(s.x - 22, z0 + 3, s.x - 22, z1 - 3);
  }
  // town square
  const P = s.kind === 'capital' ? 13 : s.kind === 'city' ? 10 : s.kind === 'hamlet' ? 5 : 7;
  for (let z = s.z - P; z <= s.z + P; z++)
    for (let x = s.x - P; x <= s.x + P; x++) {
      if (!g.inb(x, z)) continue;
      const i = z * n + x;
      if (!g.land[i] || (g.water[i] && g.water[i] !== W_DRY)) continue;
      g.road[i] = Math.max(g.road[i], 2);
      g.flatten(i, plazaTile);
    }
  const towns: TownRt = { def: s, x0, z0, x1, z1, spawn: { x: s.x + 0.5, z: s.z + P - 1.5 } };
  // walls with gates where streets leave the rect
  const gates = walls(g, s, x0, z0, x1, z1);
  // centre piece of the square
  if (!ruin) {
    const centre = st === 2 ? 'desert_well' : s.kind === 'capital' || s.kind === 'city' ? 'fountain' : 'well_small';
    if (PREFABS[centre]) {
      const [w, d] = prefabSize(centre);
      addBuild(g, placeInst(centre, s.x - Math.floor(w / 2), s.z - Math.floor(d / 2), 0, hashSeed(s.id, 1)));
    }
  }
  // waystone on the square's north edge
  if (s.waystone) {
    const ws = placeWaystone(g, s.x, s.z - P + 3, 'ws_' + s.id, s.name, s.id, s.waystone === 'open');
    if (ws) waystones.push(ws);
  }
  const inner = { x0: x0 + 4, z0: z0 + 4, x1: x1 - 4, z1: z1 - 4 };
  const prefer = (px: number, pz: number) => Math.hypot(px - s.x, pz - s.z);
  let seed = hashSeed(s.id, 7);
  const names = new NameGen(s.style, hashSeed(s.id, 3));
  const addNpc = (role: string, model: string, sp: { x: number; z: number; yaw?: number }, services: Service[], wander = 0, guard = false) => {
    const nm = role === 'guard' || role === 'villager' ? ROLE_NAME[role] : names.next();
    npcs.push({ id: `${s.id}_${npcs.length}`, name: nm, role, model, x: sp.x, z: sp.z, yaw: sp.yaw ?? 0, town: s.id, services, wander, guard });
  };
  if (!ruin) {
    // capital keep first, against the northern part
    if (s.kind === 'capital' && PREFABS.keep) {
      const lot = findLot(g, 'keep', inner.x0, inner.z0, inner.x1, s.z - 10, (px, pz) => Math.abs(px - s.x) + (pz - z0) * 0.5, seed++);
      if (lot) {
        const b = addBuild(g, placeInst('keep', lot.x, lot.z, lot.rot, seed++));
        const sp = b?.spots.find((p) => p.kind === 'npc');
        if (sp) addNpc('elder', 'npc_noble', sp, ['elder']);
      }
    }
    // service buildings (several services may share a building with many vendor spots)
    const byBuild = new Map<string, Service[]>();
    for (const sv of s.services) {
      if (s.kind === 'capital' && sv === 'elder') continue;
      const kind = SERVICE_BUILD[sv][st];
      if (!kind || !PREFABS[kind]) {
        // no building: the NPC waits on the square
        addNpc(sv, SERVICE_MODEL[sv], squareSpot(s, P, npcs.length), [sv]);
        continue;
      }
      const list = byBuild.get(kind) ?? [];
      list.push(sv);
      byBuild.set(kind, list);
    }
    for (const [kind, svs] of byBuild) {
      const lot = findLot(g, kind, inner.x0, inner.z0, inner.x1, inner.z1, prefer, seed++);
      if (!lot) {
        g.log.push(`${s.id}: no lot for ${kind}`);
        for (const sv of svs) addNpc(sv, SERVICE_MODEL[sv], squareSpot(s, P, npcs.length), [sv]);
        continue;
      }
      const b = addBuild(g, placeInst(kind, lot.x, lot.z, lot.rot, seed++));
      const posts = (b?.spots ?? []).filter((p) => p.kind === 'vendor' || p.kind === 'npc' || p.kind === 'anvil' || p.kind === 'stall');
      const doors = (b?.spots ?? []).filter((p) => p.kind === 'door');
      svs.forEach((sv, k) => {
        const sp = posts[k] ?? doors[k] ?? frontOf(lot, kind);
        addNpc(sv, sv === 'smith' && st === 1 ? 'npc_smith' : SERVICE_MODEL[sv], sp, [sv]);
      });
      // guards of barracks and training grounds
      for (const gp of (b?.spots ?? []).filter((p) => p.kind === 'guard')) addNpc('guard', guardModel(st), gp, [], 0, true);
    }
    // forts get barracks, every walled town a few towers inside are part of the walls
    if (s.kind === 'fort' || s.kind === 'capital') {
      for (const kind of [st === 2 ? 'fort_barracks' : 'barracks', 'fort_barracks']) {
        if (!PREFABS[kind]) continue;
        const lot = findLot(g, kind, inner.x0, inner.z0, inner.x1, inner.z1, prefer, seed++);
        if (!lot) continue;
        const b = addBuild(g, placeInst(kind, lot.x, lot.z, lot.rot, seed++));
        for (const gp of (b?.spots ?? []).filter((p) => p.kind === 'guard')) addNpc('guard', guardModel(st), gp, [], 0, true);
        if (s.kind !== 'capital') break;
      }
    }
    // special quarters
    const extras: string[] = [];
    if (s.id === 'wheatdale') extras.push('windmill', 'barn', 'barn', 'farm_field', 'farm_field', 'farm_field', 'farm_field', 'stable');
    if (s.id === 'alderhollow') extras.push('sawmill', 'hunter_lodge', 'watermill');
    if (s.id === 'quietford') extras.push('farm_field', 'farm_field', 'barn', 'hunter_lodge');
    if (s.id === 'reedwater') extras.push('fisher_hut', 'fisher_hut', 'fisher_hut');
    if (s.id === 'windhaven') extras.push('warehouse', 'warehouse', 'fisher_hut', 'market_stalls');
    if (s.id === 'dustway') extras.push('warehouse', 'stable', 'market_stalls');
    if (s.id === 'ironpeak') extras.push('mine_store', 'north_watchtower', 'north_watchtower');
    if (s.id === 'copperbrook') extras.push('mine_store');
    if (s.id === 'holmvald') extras.push('north_tent_camp', 'north_longhouse');
    if (s.id === 'surhad') extras.push('bazaar', 'desert_tent', 'desert_tower');
    if (s.id === 'zeyra') extras.push('desert_tent', 'desert_tent', 'desert_tent');
    if (s.kind === 'capital') extras.push('market_stalls', 'market_stalls', 'stable', 'warehouse', 'chapel');
    for (const kind of extras) {
      if (!PREFABS[kind]) continue;
      const field = kind === 'farm_field';
      const lot = findLot(g, kind, inner.x0, inner.z0, inner.x1, inner.z1, field ? (px, pz) => -Math.hypot(px - s.x, pz - s.z) : prefer, seed++, !field);
      if (!lot) continue;
      const b = addBuild(g, placeInst(kind, lot.x, lot.z, lot.rot, seed++));
      for (const sp of (b?.spots ?? []).filter((p) => p.kind === 'npc').slice(0, 1)) addNpc('villager', st === 1 ? 'npc_miner' : field || kind === 'barn' ? 'npc_farmer' : 'npc_villager_m', sp, [], 4);
    }
    // houses
    const want = s.kind === 'capital' ? 40 : s.kind === 'city' ? 22 : s.kind === 'town' ? 14 : s.kind === 'village' ? 11 : s.kind === 'hamlet' ? 6 : 4;
    const pool = st === 1 ? NORTH_HOUSES : st === 2 ? SOUTH_HOUSES : HEART_HOUSES.concat(s.kind === 'capital' || s.kind === 'city' ? ['house_mansion', 'house_mansion'] : []);
    const near = s.kind === 'hamlet' || s.kind === 'village';
    let placed = 0;
    for (let k = 0; k < want * 3 && placed < want; k++) {
      const kind = pool[(hashJ(k, placed, seed) * pool.length) | 0];
      if (!PREFABS[kind]) continue;
      const lot = findLot(g, kind, inner.x0, inner.z0, inner.x1, inner.z1, (px, pz) => prefer(px, pz) * (near ? 1 : 0.4) + hashJ(px | 0, pz | 0, k) * 30, seed++);
      if (!lot) continue;
      const b = addBuild(g, placeInst(kind, lot.x, lot.z, lot.rot, seed++));
      placed++;
      const sp = b?.spots.find((p) => p.kind === 'npc') ?? b?.spots.find((p) => p.kind === 'door');
      if (sp && placed % 2 === 1) addNpc('villager', villagerModel(st, placed), sp, [], 5);
    }
    // water-side homes and docks
    if (s.id === 'reedwater' || s.id === 'windhaven' || s.id === 'quietford') shoreBuilds(g, s, seed++);
    // lamps along the main streets of bigger places
    if (s.kind !== 'hamlet' && PREFABS.lamp_row) streetLamps(g, s, x0, z0, x1, z1, seed++);
    // gate guards
    for (const gt of gates) addNpc('guard', guardModel(st), gt, [], 0, true);
    // a couple of idle townsfolk on the square
    for (let k = 0; k < (s.kind === 'capital' ? 6 : s.kind === 'city' ? 4 : 2); k++) addNpc('villager', villagerModel(st, k + 3), squareSpot(s, P, k + 11), [], 7);
  } else ruins(g, s, seed);
  return towns;
}

function guardModel(st: number) {
  return st === 1 ? 'npc_guard_north' : st === 2 ? 'npc_guard_desert' : 'npc_guard';
}

function villagerModel(st: number, k: number) {
  const heart = ['npc_villager_m', 'npc_villager_f', 'npc_farmer', 'npc_child', 'npc_villager_f', 'npc_hunter'];
  const north = ['npc_miner', 'npc_villager_m', 'npc_villager_f', 'npc_hunter', 'npc_child'];
  const south = ['npc_caravaneer', 'npc_villager_f', 'npc_villager_m', 'npc_child', 'npc_merchant'];
  const l = st === 1 ? north : st === 2 ? south : heart;
  return l[k % l.length];
}

function squareSpot(s: SettlementDef, P: number, k: number): { x: number; z: number; yaw: number } {
  const a = (k * 2.399) % (Math.PI * 2);
  const r = P - 2.5;
  return { x: s.x + 0.5 + Math.cos(a) * r, z: s.z + 0.5 + Math.sin(a) * r, yaw: a + Math.PI };
}

function frontOf(l: Lot, kind: string): BuildSpot {
  const [w, d] = prefabSize(kind);
  const fw = l.rot & 1 ? d : w;
  const fd = l.rot & 1 ? w : d;
  const x = l.rot === 1 ? l.x + fw + 0.5 : l.rot === 3 ? l.x - 0.5 : l.x + fw / 2;
  const z = l.rot === 0 ? l.z + fd + 0.5 : l.rot === 2 ? l.z - 0.5 : l.z + fd / 2;
  return { x, z, kind: 'front', yaw: (l.rot * Math.PI) / 2 };
}

export function hashSeed(id: string, k: number) {
  let h = k * 2654435761;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

class NameGen {
  private k = 0;
  constructor(private style: string, private seed: number) {}
  next(): Loc {
    const ru = FIRST[this.style] ?? FIRST.heart;
    const en = FIRST_EN[this.style] ?? FIRST_EN.heart;
    const i = (this.seed + this.k++ * 7) % ru.length;
    return { ru: ru[i], en: en[i] };
  }
}

/** Town walls: segments along the rect with corner towers and gates where streets cross. */
function walls(g: Gen, s: SettlementDef, x0: number, z0: number, x1: number, z1: number): { x: number; z: number; yaw: number }[] {
  const n = g.n;
  const guards: { x: number; z: number; yaw: number }[] = [];
  if (s.walls === 'none') return guards;
  const st = styleIx(s);
  const kinds =
    s.walls === 'stone'
      ? { seg: 'wall_stone', tower: 'wall_tower', gate: 'gatehouse', depth: 3 }
      : s.walls === 'palisade'
        ? { seg: 'palisade', tower: st === 1 ? 'north_watchtower' : 'watchtower_wood', gate: 'palisade_gate', depth: 1 }
        : s.walls === 'desert'
          ? { seg: 'desert_wall', tower: 'desert_tower', gate: 'desert_gate', depth: 2 }
          : { seg: 'ruins_wall', tower: 'ruined_tower', gate: '', depth: 2 };
  if (!PREFABS[kinds.seg]) return guards;
  const [tw] = PREFABS[kinds.tower] ? prefabSize(kinds.tower) : [0];
  const [gw, gd] = kinds.gate && PREFABS[kinds.gate] ? prefabSize(kinds.gate) : [0, 0];
  const seed = hashSeed(s.id, 11);
  // 4 sides: [axis along x?, fixed coordinate, from, to, rot of segments, gate rot]
  const sides: { alongX: boolean; c: number; a0: number; a1: number; rot: number; out: number }[] = [
    { alongX: true, c: z0, a0: x0, a1: x1, rot: 2, out: -1 },
    { alongX: true, c: z1 - kinds.depth + 1, a0: x0, a1: x1, rot: 0, out: 1 },
    { alongX: false, c: x0, a0: z0, a1: z1, rot: 3, out: -1 },
    { alongX: false, c: x1 - kinds.depth + 1, a0: z0, a1: z1, rot: 1, out: 1 },
  ];
  const corner = tw || 0;
  for (const sd of sides) {
    // gates: street cells on the wall line
    const gates: number[] = [];
    let run = -1;
    for (let a = sd.a0 + corner; a <= sd.a1 - corner; a++) {
      const x = sd.alongX ? a : sd.c;
      const z = sd.alongX ? sd.c : a;
      const isRoad = g.inb(x, z) && g.road[z * n + x] > 0;
      if (isRoad && run < 0) run = a;
      if ((!isRoad || a === sd.a1 - corner) && run >= 0) {
        gates.push(Math.round((run + a - 1) / 2));
        run = -1;
      }
    }
    // merge gates closer than a gate width
    const gl: number[] = [];
    for (const gt of gates) if (!gl.length || gt - gl[gl.length - 1] > gw + 4) gl.push(gt);
    let a = sd.a0 + corner;
    const end = sd.a1 - corner + 1;
    const ruined = s.walls === 'ruined';
    let k = 0;
    while (a < end) {
      const gate = gl.find((gt) => gt - Math.floor(gw / 2) <= a + 0 && gt + Math.ceil(gw / 2) > a) ?? gl.find((gt) => gt - Math.floor(gw / 2) === a);
      const nextGate = gl.find((gt) => gt - Math.floor(gw / 2) > a);
      if (gw && gate !== undefined && a >= gate - Math.floor(gw / 2)) {
        const ga = gate - Math.floor(gw / 2);
        const gx = sd.alongX ? ga : sd.out < 0 ? sd.c : sd.c + kinds.depth - gd;
        const gz = sd.alongX ? (sd.out < 0 ? sd.c : sd.c + kinds.depth - gd) : ga;
        const b = addBuild(g, placeInst(kinds.gate, gx, gz, sd.rot, seed + k++));
        for (const sp of (b?.spots ?? []).filter((p) => p.kind === 'guard')) guards.push({ x: sp.x, z: sp.z, yaw: sp.yaw ?? 0 });
        // the passage must stay a street
        a = ga + gw;
        continue;
      }
      let len = Math.min(12, end - a);
      if (nextGate !== undefined) len = Math.min(len, nextGate - Math.floor(gw / 2) - a);
      if (len <= 0) {
        a++;
        continue;
      }
      if (!(ruined && hashJ(a, sd.c, seed) < 0.35)) {
        const x = sd.alongX ? a : sd.c;
        const z = sd.alongX ? sd.c : a;
        addBuild(g, placeInst(kinds.seg, x, z, sd.rot, seed + k++, [len]), { clearUnder: false });
      }
      a += len;
    }
  }
  // corner towers
  if (PREFABS[kinds.tower])
    for (const [cx, cz] of [[x0, z0], [x1 - tw + 1, z0], [x0, z1 - tw + 1], [x1 - tw + 1, z1 - tw + 1]]) {
      if (s.walls === 'ruined' && hashJ(cx, cz, seed) < 0.4) continue;
      const b = addBuild(g, placeInst(kinds.tower, cx, cz, 0, seed + cx));
      for (const sp of (b?.spots ?? []).filter((p) => p.kind === 'guard')) guards.push({ x: sp.x, z: sp.z, yaw: sp.yaw ?? 0 });
    }
  return guards;
}

function shoreBuilds(g: Gen, s: SettlementDef, seed: number) {
  const n = g.n;
  const kinds = ['house_lake', 'house_water', 'dock', 'dock'];
  let k = 0;
  for (const kind of kinds) {
    if (!PREFABS[kind]) continue;
    const [w, d] = prefabSize(kind, kind === 'dock' ? [9] : undefined);
    let done = false;
    // scan the rect border for a spot whose front half stands on water and back half on land
    for (let z = s.z - s.hd - 10; z <= s.z + s.hd + 10 && !done; z += 2)
      for (let x = s.x - s.hw - 10; x <= s.x + s.hw + 10 && !done; x += 2)
        for (let rot = 0; rot < 4 && !done; rot++) {
          const fw = rot & 1 ? d : w;
          const fd = rot & 1 ? w : d;
          let wet = 0;
          let dry = 0;
          let bad = false;
          for (let zz = z; zz < z + fd && !bad; zz++)
            for (let xx = x; xx < x + fw; xx++) {
              if (!g.inb(xx, zz)) {
                bad = true;
                break;
              }
              const i = zz * n + xx;
              if (g.occ[i] || g.road[i] || g.t.elev[i]) {
                bad = true;
                break;
              }
              if (g.water[i] === 2 || g.water[i] === 3 || g.water[i] === W_SEA) wet++;
              else dry++;
            }
          if (bad) continue;
          const total = fw * fd;
          // docks reach out (front = water side): mostly wet; houses half and half
          const ok = kind === 'dock' ? wet > total * 0.6 && dry > 0 : wet > total * 0.3 && dry > total * 0.3;
          if (!ok) continue;
          // the front must face the water: check the cell beyond the front edge
          const fx = rot === 1 ? x + fw : rot === 3 ? x - 1 : x + (fw >> 1);
          const fz = rot === 0 ? z + fd : rot === 2 ? z - 1 : z + (fd >> 1);
          const wantWater = kind === 'dock';
          const fi = g.inb(fx, fz) ? fz * n + fx : -1;
          const frontWet = fi >= 0 && (g.water[fi] === 2 || g.water[fi] === 3 || g.water[fi] === W_SEA);
          if (wantWater !== frontWet) continue;
          addBuild(g, placeInst(kind, x, z, rot, seed + k++, kind === 'dock' ? [9] : undefined), { clearUnder: false });
          // decks of docks are walkable over the water
          if (kind === 'dock')
            for (let zz = z; zz < z + fd; zz++)
              for (let xx = x; xx < x + fw; xx++) {
                const i = zz * n + xx;
                if (g.water[i]) g.t.cell[i] = CELL.floor;
              }
          done = true;
        }
  }
}

function streetLamps(g: Gen, s: SettlementDef, x0: number, z0: number, x1: number, z1: number, seed: number) {
  const n = g.n;
  let k = 0;
  // lamps at street cells next to free ground, every ~9 cells
  for (let z = z0 + 4; z <= z1 - 4; z += 9)
    for (let x = x0 + 4; x <= x1 - 4; x += 9) {
      const i = z * n + x;
      if (!g.road[i]) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let xx = x;
        let zz = z;
        while (g.inb(xx, zz) && g.road[zz * n + xx]) {
          xx += dx;
          zz += dz;
        }
        if (Math.abs(xx - x) + Math.abs(zz - z) > 4) continue;
        if (!fits(g, xx, zz, 1, 1)) continue;
        addBuild(g, placeInst('lamp_row', xx, zz, 0, seed + k++, [1]));
        break;
      }
    }
}

function ruins(g: Gen, s: SettlementDef, seed: number) {
  const st = styleIx(s);
  const pool = st === 2 ? ['ruins_wall', 'ruined_tower', 'desert_house', 'ruins_wall'] : st === 1 ? ['ruins_wall', 'ruined_tower', 'ruins_wall', 'graveyard'] : ['ruins_wall', 'cart_wreck', 'ruined_tower', 'graveyard', 'house_small'];
  let placed = 0;
  for (let k = 0; k < 40 && placed < (s.kind === 'ruin' ? 14 : 6); k++) {
    const kind = pool[k % pool.length];
    if (!PREFABS[kind]) continue;
    const [w, d] = prefabSize(kind, kind === 'ruins_wall' ? [8] : undefined);
    const x = Math.round(s.x - s.hw + 4 + hashJ(k, 1, seed) * (s.hw * 2 - w - 8));
    const z = Math.round(s.z - s.hd + 4 + hashJ(k, 2, seed) * (s.hd * 2 - d - 8));
    if (!fits(g, x - 1, z - 1, w + 2, d + 2)) continue;
    addBuild(g, placeInst(kind, x, z, (k * 3) & 3, seed + k, kind === 'ruins_wall' ? [8] : undefined));
    placed++;
  }
  if (s.id === 'frostcrown' && PREFABS.keep) {
    const [w, d] = prefabSize('keep');
    if (fits(g, s.x - (w >> 1), s.z - (d >> 1) - 4, w, d, { roads: true })) addBuild(g, placeInst('keep', s.x - (w >> 1), s.z - (d >> 1) - 4, 0, seed + 99));
  }
}

export function placeWaystone(g: Gen, x: number, z: number, id: string, name: Loc, town: string | null, open: boolean): WaystoneRt | null {
  if (!PREFABS.obelisk) return null;
  const [w, d] = prefabSize('obelisk');
  const bx = Math.round(x - w / 2);
  const bz = Math.round(z - d / 2);
  // flat clear ground around it
  stamp(g, x, z, 5, (i) => {
    if (!g.land[i] || (g.water[i] && g.water[i] !== W_DRY)) return;
    g.flatten(i);
    g.prot[i] = Math.max(g.prot[i], 1);
  });
  const b = addBuild(g, placeInst('obelisk', bx, bz, 0, hashSeed(id, 5)), { clearUnder: true });
  const sp = b?.spots.find((p) => p.kind === 'teleport') ?? { x: bx + w / 2, z: bz + d + 0.5 };
  return { id, name, x: sp.x, z: sp.z, town, open };
}

// ------------------------------------------------------------------ landmarks, dungeons, lairs
function buildLandmarks(g: Gen) {
  const out: ContinentLayout['landmarks'] = [];
  for (const l of LANDMARKS) {
    if (!PREFABS[l.prefab]) continue;
    const [w, d] = prefabSize(l.prefab, l.p);
    const rot = l.rot ?? 0;
    const fw = rot & 1 ? d : w;
    const fd = rot & 1 ? w : d;
    const bx = Math.round(l.x - fw / 2);
    const bz = Math.round(l.z - fd / 2);
    stamp(g, l.x, l.z, Math.max(fw, fd) / 2 + 3, (i) => {
      if (!g.land[i] || g.water[i] || g.occ[i]) return;
      g.flatten(i);
      g.prot[i] = Math.max(g.prot[i], 1);
    });
    addBuild(g, placeInst(l.prefab, bx, bz, rot, hashSeed(l.id, 2), l.p));
    out.push({ id: l.id, name: l.name, x: l.x, z: l.z, about: l.about });
  }
  return out;
}

function buildDungeons(g: Gen): DungeonRt[] {
  const out: DungeonRt[] = [];
  const n = g.n;
  for (const dg of DUNGEONS) {
    if (!PREFABS[dg.kind]) continue;
    const [w, d] = prefabSize(dg.kind);
    const rot = dg.rot & 3;
    const fw = rot & 1 ? d : w;
    const fd = rot & 1 ? w : d;
    // the mouth (front edge centre) sits at (x, z)
    const bx = rot === 1 ? dg.x - fw : rot === 3 ? dg.x : Math.round(dg.x - fw / 2);
    const bz = rot === 0 ? dg.z - fd : rot === 2 ? dg.z : Math.round(dg.z - fd / 2);
    // clear the ground in front, then the footprint
    stamp(g, dg.x, dg.z + (rot === 0 ? 3 : rot === 2 ? -3 : 0), 5, (i) => {
      if (!g.land[i] || (g.water[i] && g.water[i] !== W_DRY && g.water[i] !== W_ICE)) return;
      g.flatten(i);
      g.prot[i] = Math.max(g.prot[i], 1);
    });
    // caves and mines lean on a rock mound behind them
    if (dg.kind === 'cave_entrance' || dg.kind === 'mine_entrance' || dg.kind === 'waterfall_cave') {
      const bw = fw + 8;
      const bd = 9;
      const mx0 = rot & 1 ? (rot === 1 ? bx - bd : bx + fw) : bx - 4;
      const mz0 = rot & 1 ? bz - 4 : rot === 0 ? bz - bd + 2 : bz + fd - 2;
      const mw = rot & 1 ? bd : bw;
      const md = rot & 1 ? bw : bd;
      for (let z = mz0; z < mz0 + md; z++)
        for (let x = mx0; x < mx0 + mw; x++) {
          if (!g.inb(x, z)) continue;
          const i = z * n + x;
          if (!g.land[i] || g.water[i] || g.road[i] || g.occ[i]) continue;
          const edge = Math.min(x - mx0, mx0 + mw - 1 - x, z - mz0, mz0 + md - 1 - z);
          const tier = Math.min(5, 2 + edge + (g.h(x, z, 71) < 0.3 ? 1 : 0));
          if (g.t.elev[i] >= tier) continue;
          g.t.elev[i] = tier;
          g.t.cell[i] = CELL.solid;
          g.t.height[i] = tier;
          const c = g.clim[i];
          g.setTile(i, c === 0 ? 'snow' : c === 4 ? 'canyon' : c === 1 ? 'rock' : tier > 3 ? 'rock' : 'grass');
        }
    }
    const b = addBuild(g, placeInst(dg.kind, bx, bz, rot, hashSeed(dg.id, 4)));
    const sp = b?.spots.find((p) => p.kind === 'dungeon') ?? { x: dg.x, z: dg.z };
    out.push({ def: dg, x: sp.x, z: sp.z });
  }
  return out;
}

function buildLairs(g: Gen): ContinentLayout['lairs'] {
  const out: ContinentLayout['lairs'] = [];
  const t = g.t;
  for (const l of LAIRS) {
    stamp(g, l.x, l.z, 18, (i, x, z) => {
      if (!g.land[i] || g.water[i] === W_SEA) return;
      if (g.water[i] && g.water[i] !== W_ICE && g.water[i] !== W_DRY) {
        t.cell[i] = CELL.floor;
        g.water[i] = 0;
      }
      g.flatten(i);
      g.prot[i] = Math.max(g.prot[i], 1);
      const c = g.clim[i];
      if (g.h(x, z, 81) < 0.5) g.setTile(i, c === 0 ? 'gravel' : c === 4 ? 'canyon' : 'dirt');
    });
    // standing stones around the arena
    for (let k = 0; k < 12; k++) {
      if (k % 6 === 0) continue;
      const a = (k / 12) * Math.PI * 2;
      const x = Math.round(l.x + Math.cos(a) * 17);
      const z = Math.round(l.z + Math.sin(a) * 17);
      if (!g.inb(x, z)) continue;
      const c = g.climAt(x, z);
      t.column(x, z, 3 + (k % 2), c === 4 ? 'sandstone' : c === 0 ? 'rock' : 'stone');
    }
    t.lights.push({ x: l.x, z: l.z, y: 3, color: 0xa04aff, intensity: 2.2 });
    out.push({ id: l.id, x: l.x, z: l.z, boss: l.boss, level: l.level, name: l.name });
  }
  return out;
}

// ------------------------------------------------------------------ faction camps
const CAMP_R = { scout: 9, outpost: 14, warcamp: 19, stronghold: 24 } as const;
const CAMP_N = { scout: 4, outpost: 7, warcamp: 11, stronghold: 15 } as const;

function buildCamp(g: Gen, site: CampSite, sites: CampSiteRt[], camps: CampDef[]) {
  const r = CAMP_R[site.size];
  const n = g.n;
  const fac = FACTIONS[site.faction];
  const onTown = SETTLEMENTS.find((s) => s.id === site.id && s.kind === 'ruin');
  const seed = hashSeed(site.id, 9);
  if (!onTown) {
    stamp(g, site.x, site.z, r, (i, x, z) => {
      if (!g.land[i] || (g.water[i] && g.water[i] !== W_DRY && g.water[i] !== W_ICE)) return;
      g.flatten(i);
      g.prot[i] = Math.max(g.prot[i], 1);
      const c = g.clim[i];
      if (g.h(x, z, 91) < 0.55 && !g.road[i]) g.setTile(i, c === 0 ? 'snow2' : c === 4 ? 'redsand' : c === 3 ? 'drydirt' : 'dirt');
    });
    const sets: Record<string, string[]> = {
      orc: ['orc_hut', 'orc_tent', 'orc_tent', 'orc_totem', 'orc_forge', 'orc_tent', 'orc_totem', 'watchtower_wood', 'orc_tent', 'orc_spikes'],
      bandit: ['bandit_tent', 'bandit_tent', 'bandit_lookout', 'cart_wreck', 'bandit_tent', 'bandit_tent', 'training_ground'],
      clan: ['north_tent_camp', 'north_longhouse', 'north_tent_camp', 'north_watchtower', 'north_tent_camp'],
      raider: ['desert_tent', 'desert_tent', 'desert_tower', 'desert_tent', 'cart_wreck', 'desert_tent', 'desert_tent'],
      undead: ['graveyard', 'ruins_wall', 'ruined_tower', 'graveyard'],
      ancient: ['ruins_wall', 'ruined_tower'],
      beast: [],
    };
    const list = sets[site.faction] ?? [];
    const count = site.size === 'scout' ? 2 : site.size === 'outpost' ? 4 : site.size === 'warcamp' ? 7 : 10;
    let k = 0;
    for (let tries = 0; tries < 60 && k < count; tries++) {
      const kind = list[k % list.length];
      if (!kind || !PREFABS[kind]) {
        k++;
        continue;
      }
      const [w, d] = prefabSize(kind);
      const a = hashJ(tries, 3, seed) * Math.PI * 2;
      const rr = 3 + hashJ(tries, 4, seed) * (r - Math.max(w, d) / 2 - 3);
      const bx = Math.round(site.x + Math.cos(a) * rr - w / 2);
      const bz = Math.round(site.z + Math.sin(a) * rr - d / 2);
      // face the camp centre
      const rot = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 3 : 1) : Math.sin(a) > 0 ? 2 : 0;
      const fw = rot & 1 ? d : w;
      const fd = rot & 1 ? w : d;
      if (!fits(g, bx - 1, bz - 1, fw + 2, fd + 2, { roads: false })) continue;
      addBuild(g, placeInst(kind, bx, bz, rot, seed + tries));
      k++;
    }
    // a fence of the faction around bigger camps
    if ((site.size === 'warcamp' || site.size === 'stronghold') && (site.faction === 'orc' || site.faction === 'clan')) ringFence(g, site.x, site.z, r + 1, site.faction === 'orc' ? 'palisade' : 'palisade', seed);
    // campfire in the middle
    if (PREFABS.campfire_pit) addBuild(g, placeInst('campfire_pit', site.x - 1, site.z - 1, 0, seed));
    else g.t.lights.push({ x: site.x + 0.5, z: site.z + 0.5, y: 1.2, color: 0xff9a40, intensity: 1.4 });
  }
  const idx = sites.length;
  sites.push({ def: site, x: site.x, z: site.z, r });
  // garrison: the chief and his escort in the middle, the rest spread in small groups
  const total = CAMP_N[site.size];
  const lv = (k: number) => Math.round(site.lo + ((site.hi - site.lo) * k) / Math.max(1, total - 1));
  const area = areaIndexAt(site.x, site.z);
  const groups = Math.max(1, Math.round(total / 4));
  let made = 0;
  for (let gi = 0; gi < groups; gi++) {
    const size = gi === 0 ? Math.min(4, total) : Math.min(4, total - made);
    if (size <= 0) break;
    const a = (gi / groups) * Math.PI * 2 + hashJ(gi, 5, seed);
    const rr = gi === 0 ? 0 : r * 0.6;
    let cx = site.x + Math.cos(a) * rr;
    let cz = site.z + Math.sin(a) * rr;
    const free = freeNear(g, cx, cz, 6);
    if (!free) continue;
    [cx, cz] = free;
    const ids: string[] = [];
    for (let k = 0; k < size; k++) ids.push(gi === 0 && k === 0 ? fac.elite : fac.mobs[(gi * 3 + k) % fac.mobs.length]);
    const camp: CampDef = {
      x: cx, z: cz, kind: gi === 0 ? 'elite' : 'camp', area, level: lv(Math.min(total - 1, made + size - 1)), ids, aggressive: true,
      respawn: gi === 0 ? [300, 600] : [60, 120], site: idx,
    };
    if (gi === 0) {
      camp.elite = ELITE_IDS[seed % ELITE_IDS.length] as EliteId;
      camp.name = site.chief;
      camp.level = site.hi;
    }
    camps.push(camp);
    made += size;
  }
  // a patrol between the camp and the nearest road
  if (site.size !== 'scout' && !onTown) {
    const p = nearestRoad(g, site.x, site.z, 60);
    if (p) {
      const ids = [fac.mobs[0], fac.mobs[1], fac.mobs[2]];
      camps.push({ x: site.x + 0.5, z: site.z + 0.5, kind: 'patrol', area, level: site.lo, ids, aggressive: true, respawn: [60, 120], wx: p[0] + 0.5, wz: p[1] + 0.5, site: idx });
    }
  }
  void n;
}

function ringFence(g: Gen, cx: number, cz: number, r: number, kind: string, seed: number) {
  if (!PREFABS[kind]) return;
  const x0 = Math.round(cx - r);
  const z0 = Math.round(cz - r);
  const L = Math.round(r * 2);
  const segs: [number, number, number][] = [];
  for (let a = 0; a < L; a += 8) {
    const len = Math.min(8, L - a);
    if (a + len / 2 > L / 2 - 5 && a + len / 2 < L / 2 + 5) continue; // openings in the middle of each side
    segs.push([x0 + a, z0, 2], [x0 + a, z0 + L, 0]);
    segs.push([x0, z0 + a, 3], [x0 + L, z0 + a, 1]);
  }
  let k = 0;
  for (const [x, z, rot] of segs) {
    const len = 8;
    const [w, d] = prefabSize(kind, [len]);
    const fw = rot & 1 ? d : w;
    const fd = rot & 1 ? w : d;
    if (!fits(g, x, z, fw, fd)) continue;
    addBuild(g, placeInst(kind, x, z, rot, seed + k++, [len]));
  }
}

function freeNear(g: Gen, x: number, z: number, r: number): [number, number] | null {
  const n = g.n;
  for (let rr = 0; rr <= r; rr++)
    for (let k = 0; k < Math.max(1, rr * 8); k++) {
      const a = (k / Math.max(1, rr * 8)) * Math.PI * 2;
      const xx = Math.floor(x + Math.cos(a) * rr);
      const zz = Math.floor(z + Math.sin(a) * rr);
      if (!g.inb(xx, zz)) continue;
      const c = g.t.cell[zz * n + xx];
      if (c === CELL.floor || c === CELL.ice) return [xx + 0.5, zz + 0.5];
    }
  return null;
}

function nearestRoad(g: Gen, x: number, z: number, r: number): [number, number] | null {
  const n = g.n;
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let zz = Math.max(0, z - r); zz <= Math.min(n - 1, z + r); zz += 2)
    for (let xx = Math.max(0, x - r); xx <= Math.min(n - 1, x + r); xx += 2) {
      const i = zz * n + xx;
      if (!g.road[i] || g.t.cell[i] !== CELL.floor) continue;
      const d = Math.hypot(xx - x, zz - z);
      if (d < bd && d > 15) {
        bd = d;
        best = [xx, zz];
      }
    }
  return best;
}

// ------------------------------------------------------------------ vegetation
function vegetation(g: Gen) {
  const { n, t } = g;
  const clearR = distField(g, (i) => g.road[i] > 0 || g.occ[i] > 0 || g.prot[i] > 1, 3);
  const wet = distField(g, (i) => g.water[i] === 2 || g.water[i] === 3, 7);
  const elderIx = AREAS.findIndex((a) => a.id === 'elderwood');
  const alderIx = AREAS.findIndex((a) => a.id === 'alderwood');
  for (let z = 2; z < n - 2; z++)
    for (let x = 2; x < n - 2; x++) {
      const i = z * n + x;
      if (!g.land[i] || g.water[i] || t.cell[i] !== CELL.floor || clearR[i] < 2 || g.prot[i] > 0) continue;
      const r = g.h(x, z, 101);
      const c = g.clim[i];
      const f = g.noise.forest.at(x, z);
      const tile = t.tileNames[t.tile[i]];
      let dens = 0;
      let kind: 'oak' | 'pine' | 'acacia' | 'palm' | 'cactus' | 'dead' | 'willow' = 'oak';
      let leaf = 'leaves';
      let trunk = 'trunk';
      if (c === 2) {
        dens = f > 0.62 ? 0.085 : f > 0.52 ? 0.03 : 0.005;
        if (/bog/.test(tile)) {
          dens = 0.03;
          kind = g.h(x, z, 103) < 0.5 ? 'willow' : 'dead';
          trunk = 'trunk';
        } else if (g.h(x, z, 104) < 0.12 && f > 0.55) kind = 'pine';
        const ax = areaIndexAt(x, z);
        if (ax === elderIx) dens = Math.max(dens, f > 0.45 ? 0.11 : 0.04);
        if (ax === alderIx) dens = Math.max(dens, 0.05);
        if (g.h(x >> 3, z >> 3, 105) < 0.12) leaf = 'autumn';
      } else if (c === 1) {
        dens = f > 0.5 ? 0.07 : 0.015;
        kind = g.h(x, z, 106) < 0.8 ? 'pine' : 'oak';
        leaf = kind === 'pine' ? (/snow/.test(tile) ? 'pineSnow' : 'pine') : 'leaves';
      } else if (c === 0) {
        dens = f > 0.55 ? 0.03 : 0.006;
        kind = 'pine';
        leaf = 'pineSnow';
      } else if (c === 3) {
        dens = f > 0.62 ? 0.012 : 0.0025;
        kind = g.h(x, z, 107) < 0.6 ? 'acacia' : 'oak';
        leaf = kind === 'acacia' ? 'savanna' : 'leaves';
        trunk = kind === 'acacia' ? 'acacia' : 'trunk';
      } else {
        if (wet[i] <= 6) {
          dens = 0.05;
          kind = 'palm';
          leaf = 'palm';
          trunk = 'palmTrunk';
        } else {
          dens = 0.0018;
          kind = g.h(x, z, 108) < 0.75 ? 'cactus' : 'dead';
          leaf = kind === 'cactus' ? 'cactus' : 'dead';
          trunk = 'dead';
        }
      }
      if (r >= dens) continue;
      // keep a cell between trunks
      if (t.cell[i - 1] === CELL.solid || t.cell[i - n] === CELL.solid || t.cell[i - n - 1] === CELL.solid || t.cell[i - n + 1] === CELL.solid) continue;
      if (t.solidCell(x, z, 2)) t.trees.push({ x, z, h: Math.floor(g.h(x, z, 109) * 5), kind, leaf, trunk, v: Math.floor(g.h(x, z, 110) * 3) });
    }
}

// ------------------------------------------------------------------ reach, levels and wild monsters
function reachable(g: Gen, sx: number, sz: number): Uint8Array {
  const { n, t } = g;
  const seen = new Uint8Array(n * n);
  const q = new Int32Array(n * n);
  let h = 0;
  let tl = 0;
  const s = Math.floor(sz) * n + Math.floor(sx);
  seen[s] = 1;
  q[tl++] = s;
  const ok = (j: number) => {
    const c = t.cell[j];
    return c === CELL.floor || c === CELL.ice || c === CELL.hazard;
  };
  while (h < tl) {
    const i = q[h++];
    const x = i % n;
    for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n]) {
      if (j < 0 || j >= n * n || seen[j] || !ok(j)) continue;
      seen[j] = 1;
      q[tl++] = j;
    }
  }
  return seen;
}

function levelGrids(g: Gen, towns: TownRt[]) {
  const n = g.n;
  const gn = Math.ceil(n / GRID);
  const areaGrid = new Uint8Array(gn * gn).fill(255);
  const levelGrid = new Uint8Array(gn * gn);
  const climGrid = new Uint8Array(gn * gn);
  // coarse distance to roads and towns
  const near = new Float32Array(gn * gn).fill(1e9);
  const q: number[] = [];
  for (let gz = 0; gz < gn; gz++)
    for (let gx = 0; gx < gn; gx++) {
      let any = false;
      for (let dz = 0; dz < GRID && !any; dz += 2)
        for (let dx = 0; dx < GRID && !any; dx += 2) {
          const x = gx * GRID + dx;
          const z = gz * GRID + dz;
          if (x < n && z < n && (g.road[z * n + x] >= 2 || g.prot[z * n + x] === 2)) any = true;
        }
      if (any) {
        near[gz * gn + gx] = 0;
        q.push(gz * gn + gx);
      }
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % gn;
    const z = (i / gn) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx;
      const zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= gn || zz >= gn) continue;
      const j = zz * gn + xx;
      if (near[j] > near[i] + 1) {
        near[j] = near[i] + 1;
        q.push(j);
      }
    }
  }
  for (let gz = 0; gz < gn; gz++)
    for (let gx = 0; gx < gn; gx++) {
      const x = gx * GRID + GRID / 2;
      const z = gz * GRID + GRID / 2;
      const i = Math.min(n - 1, z) * n + Math.min(n - 1, x);
      const k = gz * gn + gx;
      climGrid[k] = g.clim[i];
      if (!g.land[i]) continue;
      const ai = areaIndexAt(x, z);
      areaGrid[k] = ai;
      const a = AREAS[ai];
      const dc = Math.min(1, Math.hypot(x - a.x, z - a.z) / a.r);
      const dr = Math.min(1, (near[k] * GRID) / 60);
      const danger = 0.5 * dc + 0.5 * dr;
      levelGrid[k] = Math.round(a.lo + (a.hi - a.lo) * danger);
    }
  void towns;
  return { areaGrid, levelGrid, climGrid };
}

const NAMED: Loc[] = [
  { ru: 'Старый Клык', en: 'Old Fang' }, { ru: 'Хромоногий', en: 'Limpleg' }, { ru: 'Седая Шкура', en: 'Greyhide' }, { ru: 'Пожиратель', en: 'The Devourer' },
  { ru: 'Тихий Ужас', en: 'Silent Dread' }, { ru: 'Рваное Ухо', en: 'Torn Ear' }, { ru: 'Костогрыз', en: 'Bonegnaw' }, { ru: 'Чёрная Вдова', en: 'Black Widow' },
  { ru: 'Гроза Дорог', en: 'Bane of Roads' }, { ru: 'Красный Глаз', en: 'Red Eye' }, { ru: 'Мшистый', en: 'Mossback' }, { ru: 'Песчаный Призрак', en: 'Sand Ghost' },
  { ru: 'Ледяное Сердце', en: 'Iceheart' }, { ru: 'Буревестник', en: 'Stormcaller' }, { ru: 'Шипастый', en: 'Spineback' }, { ru: 'Вожак', en: 'The Packleader' },
];

function wildCamps(g: Gen, reach: Uint8Array, grids: { areaGrid: Uint8Array; levelGrid: Uint8Array }, camps: CampDef[], sites: CampSiteRt[]) {
  const n = g.n;
  const gn = Math.ceil(n / GRID);
  const step = CONT.wildStep;
  const safeNear = distField(g, (i) => g.prot[i] === 2, 30);
  const elitesPer = new Map<number, number>();
  let named = 0;
  for (let gz = step / 2; gz < n; gz += step)
    for (let gx = step / 2; gx < n; gx += step) {
      const jx = Math.round(gx + (g.h(gx, gz, 121) - 0.5) * step * 0.6);
      const jz = Math.round(gz + (g.h(gx, gz, 122) - 0.5) * step * 0.6);
      if (!g.inb(jx, jz)) continue;
      const k = Math.floor(jz / GRID) * gn + Math.floor(jx / GRID);
      const ai = grids.areaGrid[k];
      if (ai === 255) continue;
      const a = AREAS[ai];
      if ((a.wild ?? 1) < 1 && g.h(jx, jz, 123) > (a.wild ?? 1)) continue;
      const spot = freeNear(g, jx, jz, 5);
      if (!spot) continue;
      const si = Math.floor(spot[1]) * n + Math.floor(spot[0]);
      if (!reach[si] || g.road[si] || g.prot[si] || safeNear[si] < 26) continue;
      if (sites.some((s) => Math.hypot(s.x - spot[0], s.z - spot[1]) < s.r + 14)) continue;
      const level = grids.levelGrid[k];
      const pool = a.mobs.filter(([id]) => ENEMY_BY_ID[id]);
      if (!pool.length) continue;
      const pick = (salt: number) => {
        let total = 0;
        for (const [, w] of pool) total += w;
        let r = g.h(jx + salt, jz, 124) * total;
        for (const [id, w] of pool) {
          r -= w;
          if (r <= 0) return id;
        }
        return pool[0][0];
      };
      const roll = g.h(jx, jz, 125);
      const kind: CampDef['kind'] = roll < 0.45 ? 'pack' : roll < 0.7 ? 'camp' : roll < 0.87 ? 'lone' : 'patrol';
      const ids: string[] = [];
      const hp = (id: string) => ENEMY_BY_ID[id]?.hp ?? 0;
      if (kind === 'pack') {
        const id = pick(1);
        for (let i = 2 + Math.floor(g.h(jx, jz, 126) * 3); i > 0; i--) ids.push(id);
      } else if (kind === 'camp') {
        const p = pick(2);
        const q2 = pick(3);
        for (let i = 3 + Math.floor(g.h(jx, jz, 127) * 3); i > 0; i--) ids.push(i % 2 ? p : q2);
      } else if (kind === 'lone') {
        const tough = [...pool].sort((p, q2) => hp(q2[0]) - hp(p[0]))[0][0];
        ids.push(tough);
        if (g.h(jx, jz, 128) < 0.4) ids.push(tough);
      } else {
        const id = pick(4);
        for (let i = 3; i > 0; i--) ids.push(id);
      }
      // low levels are calmer: many beasts there only fight back
      const passive = level <= 6 ? g.h(jx, jz, 129) < 0.55 : level <= 14 ? g.h(jx, jz, 129) < 0.25 : g.h(jx, jz, 129) < 0.08;
      const camp: CampDef = { x: spot[0], z: spot[1], kind, area: ai, level: Math.min(50, level + (kind === 'lone' ? 1 : 0)), ids, aggressive: !passive, respawn: [30, 60] };
      if (kind === 'patrol') {
        const ang = g.h(jx, jz, 130) * Math.PI * 2;
        camp.wx = spot[0] + Math.cos(ang) * 20;
        camp.wz = spot[1] + Math.sin(ang) * 20;
      }
      // one named elite per area (two in big ones) far from the roads
      const have = elitesPer.get(ai) ?? 0;
      if (have < (a.r > 140 ? 2 : 1) && kind !== 'patrol' && safeNear[si] >= 30 && g.h(jx, jz, 131) < 0.2) {
        elitesPer.set(ai, have + 1);
        const boss = [...pool].sort((p, q2) => hp(q2[0]) - hp(p[0]))[0][0];
        camp.kind = 'elite';
        camp.ids = [boss, pick(5), pick(6)];
        camp.level = Math.min(50, a.hi + 1);
        camp.aggressive = true;
        camp.elite = ELITE_IDS[Math.floor(g.h(jx, jz, 132) * ELITE_IDS.length)];
        camp.name = NAMED[named++ % NAMED.length];
        camp.respawn = [300, 600];
      }
      camps.push(camp);
    }
}
