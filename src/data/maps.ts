import type { MapDef } from './types';

/**
 * The one persistent world: Greenvale, a 250×250 grass meadow with scattered trees and a
 * small river on its eastern side. The layout is hand-placed (see game/map/greenvale.ts) and
 * is identical on every launch.
 */
export const GREENVALE: MapDef = {
  id: 'greenvale',
  name: { ru: 'Зелёный Дол', en: 'Greenvale' },
  desc: { ru: 'Тихая долина: трава, рощи и речка на востоке.', en: 'A quiet vale of grass, groves and a small river to the east.' },
  size: 250,
  generator: 'meadow',
  palette: {
    sky: 0x9fd2ec, fog: 0xa8d0c8, fogNear: 30, fogFar: 64, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass2: [0x78b44c, 0x7eb952],
      bank: [0x8fae5a, 0x96b360],
      sand: [0xd8c48a, 0xd0bb82, 0xdccb92],
      water: [0x2fa3c8, 0x34aad0],
    },
    blocks: { trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0x6aa63e], birch: [0xe8e4d8, 0xd8d2c4], pine: [0x2f6a3a, 0x36743f] },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};

/**
 * «Витрина мира»: a walkable showcase of the world prop library (every prop, water type and road
 * kind) laid out as natural locations; no creatures. See game/map/showcase.ts.
 */
export const SHOWCASE: MapDef = {
  id: 'showcase',
  name: { ru: 'Витрина мира', en: 'World Showcase' },
  desc: { ru: 'Все объекты мира в живых локациях: лес, деревня, реки и мосты, горы, руины, побережье, болото и лагеря.', en: 'Every world object in living locations: forest, village, rivers and bridges, mountains, ruins, coast, swamp and camps.' },
  size: 176,
  generator: 'meadow',
  noMobs: true,
  palette: {
    sky: 0x9fd2ec, fog: 0xa8d0c8, fogNear: 34, fogFar: 72, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass2: [0x78b44c, 0x7eb952],
      moss: [0x4f8a36, 0x58933a],
      rock: [0x8a8690, 0x7e7a84, 0x96929c],
      snow: [0xeef3f8, 0xe2eaf2],
      sand: [0xd8c48a, 0xd0bb82, 0xdccb92],
    },
    blocks: { trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0x6aa63e], birch: [0xe8e4d8, 0xd8d2c4], pine: [0x2f6a3a, 0x36743f] },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};

/**
 * «Расколотые Земли»: the 8000×8000 continent (tools/continent, relief frozen), streamed in
 * windows around the hero (game/continent). Tile names follow the tile materials (window.ts).
 */
export const CONTINENT: MapDef = {
  id: 'continent',
  name: { ru: 'Расколотые Земли', en: 'Shattered Lands' },
  desc: { ru: 'Континент 8000×8000: Зеленодол, Дремучий Лес, северные горы, пустыня и каньоны.', en: 'An 8000×8000 continent: Zelenodol, the Old Forest, the northern mountains, the desert and its canyons.' },
  size: 8000,
  generator: 'meadow',
  palette: {
    sky: 0x9fd2ec, fog: 0xa9cfd6, fogNear: 40, fogFar: 92, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      sand_deep: [0xc8b480, 0xc0ac78],
      sand_shore: [0xd8c48a, 0xd0bb82],
      sand_beach: [0xe2d098, 0xdac88e, 0xe6d6a2],
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass_forest: [0x4f8e36, 0x56953a, 0x4a8832],
      moss_swamp: [0x5a6e34, 0x546a30, 0x60743a],
      grass_hills: [0x7aae4a, 0x80b250, 0x74a846],
      grass_conifer: [0x4c7e3a, 0x528440, 0x487a36],
      grass_steppe: [0xa8a85a, 0xb0ae62, 0xa2a254],
      moss_taiga: [0x5e7a4a, 0x647e50, 0x587446],
      snow: [0xeef3f8, 0xe2eaf2, 0xe8eef6],
      snow_rock: [0xd8dee6, 0xc8ced8],
      ice_glacier: [0xcfe6f2, 0xbfdcec],
      stone_waste: [0x9a948a, 0x8e887e, 0xa49e94],
      sand: [0xe0c27e, 0xd8ba76, 0xe6c886],
      rock_red: [0xb4643c, 0xa85a36, 0xbe6e44],
      grass_oasis: [0x5aa848, 0x62b04e],
      rock_cliff: [0x8a8690, 0x7e7a84, 0x96929c],
      sand_salt: [0xeeeae0, 0xe4e0d4],
      dirt: [0x8a6a44, 0x80603e],
      dirt_road: [0xa88a5e, 0x9a7c52],
      dirt_path: [0x8e7048, 0x82663e],
    },
    blocks: {
      trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0x6aa63e], birch: [0xe8e4d8, 0xd8d2c4], pine: [0x2f6a3a, 0x36743f],
      snowpine: [0xe8f0f6, 0x2f6a3a, 0xdfe8f0], palm: [0x5aa040, 0x66ac46], cactus: [0x4e8a3a, 0x58943e], acacia: [0x7a9a3a, 0x86a642],
      plank_light: [0xb08454, 0xa87c4c, 0xb88c5c], plank_dark: [0x6e5038, 0x664a32], plank_door: [0x5a3c22],
      roof_red: [0xa8442c, 0xb04c30, 0x9c3e28], snow_roof: [0xeef3f8, 0xe2eaf2], sandstone: [0xd8b880, 0xd0b078], sandstone_roof: [0xc09460, 0xb88c58],
      sandstone_dark: [0xa88a5c], stone_wall: [0x8a8690, 0x7e7a84], glass_window: [0xf0d890],
    },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};
