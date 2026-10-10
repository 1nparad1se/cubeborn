import type { MapDef } from './types';

/**
 * The persistent open-world continent (Eldoria): one map definition whose palette carries every
 * biome's tiles and block colours (green heartland, snowy north, desert south). Monsters, levels
 * and places come from the continent data (config/continent.ts), not from wave segments.
 */
export const CONTINENT_MAP: MapDef = {
  id: 'eldoria',
  name: { ru: 'Эльдория', en: 'Eldoria' },
  desc: { ru: 'Материк трёх земель: снежный север, зелёное сердце и пустынный юг.', en: 'A continent of three lands: the snowy north, the green heart and the desert south.' },
  size: 2048,
  generator: 'continent',
  difficultyStars: 1,
  recommendedLevel: 0,
  tier: 1,
  palette: {
    sky: 0x9ec8d8, fog: 0xa4c8c0, fogNear: 30, fogFar: 64, ambient: 0xdcecff, ambientIntensity: 0.55,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a6a3a,
    tiles: {
      // green heart
      grass: [0x65a040, 0x6ba544, 0x609a3d], grass2: [0x74ad4a, 0x7bb250], meadow: [0x7cb04c, 0x84b652], forest: [0x4e8a36, 0x538f3a],
      dirt: [0x8e6a46, 0x866442], path: [0xa08458, 0x987c52], road: [0x8e8c90, 0x86848a, 0x96949a], plaza: [0xa8a49c, 0xa09c94],
      farm: [0x6a4a2e, 0x624428], bog: [0x5a6a3a, 0x52623a], water: [0x3a86c8, 0x3f8ed0], sea: [0x2a6ab0, 0x2e70b8], beach: [0xe0cc94, 0xd8c48c],
      // steppe
      dry: [0xa8a858, 0xa0a052, 0xb0ae60], drydirt: [0xa88a5a, 0xa08254],
      // north
      snow: [0xe8f0f8, 0xdde8f2, 0xf2f6fa], snow2: [0xd0dce8, 0xc8d6e4], tundra: [0x8a9a74, 0x82926e], ice: [0x9fd4f0, 0xa8dcf4], rock: [0x7a828c, 0x727a84], gravel: [0x8c8a86, 0x84827e], trail: [0x9aa8b8, 0x929fb0],
      // south
      sand: [0xe2c890, 0xdcc088, 0xe8d098], dune: [0xeacc8c, 0xe4c484], redsand: [0xc8784a, 0xc07044], canyon: [0xb06a44, 0xa8643e], sandroad: [0xc8b088, 0xc0a880], oasis: [0x6aa848, 0x72b04e],
      ash: [0x7a6a62, 0x726258], lava: [0xff5a0a, 0xff7a1a],
    },
    blocks: {
      trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0xc8862a], autumn: [0xc8862a, 0xd09a3a, 0xb8702a],
      pine: [0x2e4e3a, 0x34563f], pineSnow: [0x2e4e3a, 0x34563f], spruce: [0x4a3424, 0x553b29],
      savanna: [0x7a8a3a, 0x86943e], acacia: [0x8a6a4a, 0x7e6044], palm: [0x5a9a3a, 0x4e8a34], palmTrunk: [0xa88a5a, 0x9e8052], cactus: [0x4a8a3a, 0x52923e], dead: [0x6a5a4a, 0x625244],
      stone: [0x8e949c, 0x80868e], rock: [0x7a828c, 0x6e7680], snow: [0xf2f6fa, 0xe6eef6], ice: [0x9fe0ff, 0xb0e8ff], sandstone: [0xd8bc84, 0xceb27a], redrock: [0xb4643e, 0xa85c3a],
      mushroom: [0xd04a3a, 0xf0e8d8], plank: [0xa87c4a, 0x9a7044], soil: [0x7c5a3e], cliff: [0x84868c], basalt: [0x524a4e, 0x5a5256],
      shrine: [0x6aff9a, 0xff5a5a, 0x8ad8ff, 0xffd23d],
    },
  },
  segments: [{ t: 0, pool: [['rot_zombie', 1]], rate: 0, max: 0 }],
  events: [],
  midBoss: 'spore_mother',
  boss: 'rotroot',
  bossTime: 99999,
  music: { root: 45, scale: 'dorian', tempo: 108, mood: 'forest' },
  ambient: 'spores',
};
