import type { Loc } from '../data/types';

/**
 * Eldoria — the persistent continent of the open world. Everything that makes its geography is
 * written here by hand: coastline features, mountain ranges and their passes, rivers and lakes,
 * named areas with their monster levels, settlements, roads, faction camps, monster dens, boss
 * lairs, teleport waystones, dungeon entrances and landmarks. The generator only rasterises this
 * plan (with fixed-seed noise for small detail), so the world is the same on every launch.
 *
 * Coordinates are blocks: x grows to the east, z to the south (north is the top of the map).
 */

export const CONT = {
  size: 2048,
  /** Fixed seed of the small-scale detail noise (never change: it reshapes coasts and forests). */
  seed: 70317,
  /** Land ellipse (before bays and capes) and coast noise. */
  land: { cx: 1024, cz: 1010, rx: 915, rz: 950, noise: 0.11, noiseScale: 170 },
  /** Where the hero first wakes up (the start village's waystone). */
  start: 'quietford',
  /** Climate bands by z (before noise): snow until `snow`, taiga until `taiga`, green until `steppe`, steppe until `desert`. */
  climate: { snow: 610, taiga: 790, steppe: 1400, desert: 1565, wobble: 70 },
  /** Mobs exist only near the hero. */
  actR: 64,
  deactR: 84,
  /** Grid step of the wild monster spots between places. */
  wildStep: 30,
};

export type Climate = 'snow' | 'taiga' | 'green' | 'steppe' | 'desert';
export type Style = 'heart' | 'north' | 'south';

export interface Circle {
  x: number;
  z: number;
  r: number;
}

// ------------------------------------------------------------------ coast
/** Sea bites into the land ellipse. */
export const BAYS: (Circle & { name: Loc })[] = [
  { x: 70, z: 1120, r: 175, name: { ru: 'Залив Чаек', en: 'Gull Bay' } },
  { x: 1390, z: 20, r: 140, name: { ru: 'Ледяной фьорд', en: 'Ice Fjord' } },
  { x: 2010, z: 1260, r: 150, name: { ru: 'Янтарная бухта', en: 'Amber Cove' } },
  { x: 1780, z: 2110, r: 180, name: { ru: 'Залив Миражей', en: 'Mirage Gulf' } },
  { x: 560, z: 2050, r: 120, name: { ru: 'Бухта Скорпиона', en: 'Scorpion Cove' } },
  { x: 700, z: 40, r: 110, name: { ru: 'Губа Тюленей', en: 'Seal Inlet' } },
];
/** Land pushed out of the ellipse (peninsulas and capes). */
export const CAPES: Circle[] = [
  { x: 1900, z: 800, r: 150 },
  { x: 300, z: 250, r: 160 },
  { x: 260, z: 1780, r: 120 },
  { x: 1100, z: 1960, r: 140 },
  { x: 1700, z: 220, r: 130 },
  { x: 1520, z: 170, r: 150 },
  { x: 1810, z: 1610, r: 170 },
  { x: 320, z: 1850, r: 170 },
  { x: 1870, z: 1300, r: 110 },
  { x: 1560, z: 1850, r: 190 },
];

// ------------------------------------------------------------------ mountains
export interface Range {
  id: string;
  name: Loc;
  pts: [number, number][];
  /** Half width (blocks) and height tier (1..7). */
  w: number;
  h: number;
  climate: Climate;
}

export const RANGES: Range[] = [
  {
    id: 'icefang', name: { ru: 'Хребет Ледяных Клыков', en: 'Icefang Range' }, w: 38, h: 6, climate: 'snow',
    pts: [[230, 590], [420, 560], [560, 540], [760, 548], [980, 515], [1200, 540], [1420, 500], [1600, 520], [1800, 560], [1930, 600]],
  },
  {
    id: 'frostcrown', name: { ru: 'Пики Хладной Короны', en: 'Frostcrown Peaks' }, w: 46, h: 7, climate: 'snow',
    pts: [[760, 130], [900, 175], [1080, 150], [1230, 200], [1330, 260]],
  },
  { id: 'eastpeaks', name: { ru: 'Восточные зубцы', en: 'Eastern Teeth' }, w: 34, h: 6, climate: 'snow', pts: [[1560, 300], [1700, 330], [1840, 420]] },
  {
    id: 'greyback', name: { ru: 'Серые холмы', en: 'Greyback Hills' }, w: 26, h: 3, climate: 'green',
    pts: [[1470, 760], [1505, 880], [1495, 1030], [1530, 1160], [1560, 1260]],
  },
  { id: 'westhills', name: { ru: 'Вороньи холмы', en: 'Raven Hills' }, w: 22, h: 3, climate: 'green', pts: [[330, 790], [420, 800], [520, 840], [560, 920]] },
  {
    id: 'redrock', name: { ru: 'Красные скалы', en: 'Redrock Scarp' }, w: 30, h: 4, climate: 'desert',
    pts: [[560, 1575], [760, 1560], [960, 1585], [1180, 1545], [1400, 1595], [1640, 1560], [1800, 1520]],
  },
  { id: 'kharumcliffs', name: { ru: 'Утёсы Кхарума', en: 'Kharum Cliffs' }, w: 24, h: 4, climate: 'desert', pts: [[380, 1620], [420, 1760], [560, 1830]] },
  { id: 'sunspine', name: { ru: 'Солнечный хребет', en: 'Sunspine' }, w: 26, h: 5, climate: 'desert', pts: [[1180, 1660], [1260, 1700], [1360, 1660]] },
];

/** Corridors cut through ranges (roads and rivers rely on them). */
export interface Pass {
  name: Loc;
  pts: [number, number][];
  w: number;
}
export const PASSES: Pass[] = [
  { name: { ru: 'Перевал Вороньих Врат', en: 'Raven Gate Pass' }, pts: [[705, 470], [712, 545], [708, 620]], w: 9 },
  { name: { ru: 'Западная тропа', en: 'Western Trail' }, pts: [[385, 500], [392, 560], [400, 625]], w: 6 },
  { name: { ru: 'Орочий перевал', en: 'Orc Pass' }, pts: [[1350, 455], [1345, 525], [1352, 600]], w: 8 },
  { name: { ru: 'Медный проход', en: 'Copper Gap' }, pts: [[1605, 380], [1640, 440], [1650, 470]], w: 7 },
  { name: { ru: 'Северный проход', en: 'North Gap' }, pts: [[1010, 230], [1020, 300]], w: 8 },
  { name: { ru: 'Ущелье Бастиона', en: 'Bastion Gorge' }, pts: [[1440, 1000], [1560, 1000]], w: 9 },
  { name: { ru: 'Северный проход Серых холмов', en: 'Greyback North Gap' }, pts: [[1450, 830], [1560, 840]], w: 6 },
  { name: { ru: 'Каньон Ветров', en: 'Windcanyon' }, pts: [[945, 1520], [955, 1585], [950, 1650]], w: 9 },
  { name: { ru: 'Ущелье Ржавицы', en: 'Rustwater Cut' }, pts: [[1420, 1520], [1440, 1600], [1460, 1660]], w: 12 },
  { name: { ru: 'Западное ущелье', en: 'West Cut' }, pts: [[690, 1510], [700, 1570], [690, 1630]], w: 6 },
  { name: { ru: 'Тропа Кхарума', en: 'Kharum Path' }, pts: [[560, 1720], [500, 1740]], w: 6 },
  { name: { ru: 'Солнечная тропа', en: 'Sun Path' }, pts: [[1250, 1640], [1260, 1720]], w: 5 },
  { name: { ru: 'Вороний проход', en: 'Raven Gap' }, pts: [[440, 740], [430, 880]], w: 6 },
];

/** Chasms (dark, impassable) crossed by bridges. */
export const CHASMS: { name: Loc; pts: [number, number][]; w: number }[] = [
  { name: { ru: 'Разлом Хьяльма', en: "Hjalm's Rift" }, pts: [[1220, 290], [1290, 330], [1340, 380], [1400, 395], [1460, 360], [1530, 310], [1590, 280]], w: 6 },
];

// ------------------------------------------------------------------ water
export interface River {
  id: string;
  name: Loc;
  pts: [number, number][];
  /** Width at the source and at the mouth. */
  w0: number;
  w1: number;
  /** Frozen rivers are walkable ice. */
  frozen?: boolean;
  /** Dry riverbeds are walkable gravel. */
  dry?: boolean;
}

export const RIVERS: River[] = [
  {
    id: 'silverrun', name: { ru: 'Сребротечь', en: 'Silverrun' }, w0: 4, w1: 11,
    pts: [[880, 600], [895, 690], [940, 790], [990, 880], [1005, 960], [990, 1040], [955, 1120], [880, 1175], [770, 1196], [680, 1196], [570, 1172], [440, 1148], [330, 1128], [230, 1118]],
  },
  { id: 'alder', name: { ru: 'Ольховка', en: 'Alderbrook' }, w0: 3, w1: 6, pts: [[1450, 905], [1380, 960], [1290, 975], [1180, 945], [1060, 905]] },
  { id: 'fernbrook', name: { ru: 'Папоротниковый ручей', en: 'Fernbrook' }, w0: 2, w1: 4, pts: [[600, 905], [650, 1000], [700, 1110], [720, 1192]] },
  {
    id: 'coldwater', name: { ru: 'Студёная', en: 'Coldwater' }, w0: 4, w1: 9, frozen: true,
    pts: [[1150, 300], [1280, 330], [1450, 420], [1600, 470], [1760, 450], [1900, 420], [2010, 400]],
  },
  { id: 'holmriver', name: { ru: 'Хольма', en: 'Holm River' }, w0: 3, w1: 7, frozen: true, pts: [[560, 420], [480, 370], [420, 300], [330, 200], [230, 130]] },
  { id: 'eastrun', name: { ru: 'Янтарка', en: 'Amberrun' }, w0: 3, w1: 8, pts: [[1600, 1080], [1700, 1150], [1800, 1210], [1880, 1250]] },
  {
    id: 'rustwater', name: { ru: 'Ржавица', en: 'Rustwater' }, w0: 4, w1: 10,
    pts: [[1440, 1640], [1500, 1700], [1590, 1750], [1625, 1820], [1660, 1900], [1700, 1970], [1730, 2015]],
  },
  { id: 'drybed', name: { ru: 'Сухое русло', en: 'Dry Bed' }, w0: 5, w1: 8, dry: true, pts: [[950, 1650], [900, 1740], [840, 1830], [760, 1920], [700, 1990]] },
];

export interface Lake extends Circle {
  name: Loc;
  frozen?: boolean;
  bog?: boolean;
}
export const LAKES: Lake[] = [
  { x: 1000, z: 905, r: 52, name: { ru: 'Зеркальное озеро', en: 'Mirror Lake' } },
  { x: 1250, z: 1160, r: 18, name: { ru: 'Лесное озеро', en: 'Forest Pond' } },
  { x: 390, z: 1320, r: 30, name: { ru: 'Озеро Туманов', en: 'Mist Mere' }, bog: true },
  { x: 650, z: 330, r: 40, name: { ru: 'Ледяное озеро', en: 'Icemere' }, frozen: true },
  { x: 1460, z: 165, r: 26, name: { ru: 'Озеро Короны', en: 'Crown Tarn' }, frozen: true },
  { x: 820, z: 1830, r: 12, name: { ru: 'Оазис Зейра', en: 'Zeyra Oasis' } },
  { x: 1180, z: 1810, r: 7, name: { ru: 'Пересохший пруд', en: 'Dry Pond' } },
  { x: 560, z: 690, r: 14, name: { ru: 'Сосновое озеро', en: 'Pine Tarn' } },
  { x: 1690, z: 690, r: 16, name: { ru: 'Медвежье озеро', en: 'Bear Lake' } },
];

/** Marsh: bog ground with pools and dead trees. */
export const MARSHES: Circle[] = [
  { x: 400, z: 1330, r: 110 },
  { x: 1700, z: 1180, r: 40 },
];

// ------------------------------------------------------------------ areas and levels
export interface AreaDef {
  id: string;
  name: Loc;
  x: number;
  z: number;
  /** Influence radius: cells take the area whose (distance / r) is smallest. */
  r: number;
  lo: number;
  hi: number;
  /** Monster pool of the wilds (enemy ids, weights). */
  mobs: [string, number][];
  /** Density of wild monster spots (1 = normal). */
  wild?: number;
}

const HEART_WILD: [string, number][] = [['forest_wolf', 4], ['wild_boar', 3], ['giant_spider', 2], ['sporeling', 2], ['dusk_moth', 1]];
const DEEP_WOOD: [string, number][] = [['giant_spider', 4], ['forest_bear', 2], ['thorn_beetle', 3], ['sapling_shaman', 1], ['spore_spitter', 2], ['blight_wolf', 3]];
const SWAMP: [string, number][] = [['bloat_toad', 4], ['rot_zombie', 3], ['spore_spitter', 2], ['dusk_moth', 2], ['sporeling', 2]];
const TAIGA: [string, number][] = [['forest_wolf', 3], ['forest_bear', 2], ['snow_wolf', 2], ['frost_bat', 1], ['giant_spider', 1]];
const NORTH: [string, number][] = [['snow_wolf', 4], ['frost_walker', 3], ['tusk_calf', 2], ['frost_bat', 2], ['snow_slime', 2], ['ice_golem', 1]];
const PEAKS: [string, number][] = [['ice_golem', 3], ['frost_mage', 2], ['snow_wolf', 3], ['frost_walker', 2], ['frost_bat', 2]];
const STEPPE: [string, number][] = [['wild_boar', 3], ['forest_wolf', 2], ['plague_rat', 2], ['sand_scorpion', 2], ['giant_spider', 1]];
const DESERT: [string, number][] = [['sand_scorpion', 4], ['dune_stalker', 2], ['sun_mummy', 2], ['gear_spider', 1], ['magma_slime', 1]];
const DUNES: [string, number][] = [['sand_scorpion', 3], ['dune_stalker', 3], ['sun_mummy', 3], ['phantom', 1]];
const ANCIENT: [string, number][] = [['ruin_guard', 4], ['stone_sentinel', 2], ['phantom', 2], ['void_eye', 1], ['gear_spider', 2], ['arcane_bomber', 1]];
const UNDEAD: [string, number][] = [['skeleton', 4], ['bone_archer', 2], ['bone_hound', 2], ['wraith', 1], ['ghoul', 2]];
const FIRE: [string, number][] = [['cinder_hound', 3], ['magma_slime', 3], ['fire_imp', 2], ['obsidian_brute', 1], ['lava_salamander', 1], ['ember_wisp', 1]];

export const AREAS: AreaDef[] = [
  // ---- green heart
  { id: 'quietvale', name: { ru: 'Тихая долина', en: 'Quiet Vale' }, x: 760, z: 1210, r: 190, lo: 1, hi: 5, mobs: [['forest_wolf', 3], ['wild_boar', 3], ['sporeling', 3], ['dusk_moth', 1]] },
  { id: 'wheatdale', name: { ru: 'Пшеничный дол', en: 'Wheatdale' }, x: 880, z: 1340, r: 130, lo: 3, hi: 8, mobs: [['wild_boar', 4], ['plague_rat', 3], ['forest_wolf', 2], ['sporeling', 1]] },
  { id: 'mirror', name: { ru: 'Зеркальное озеро', en: 'Mirror Lake' }, x: 990, z: 890, r: 140, lo: 4, hi: 9, mobs: [['bloat_toad', 2], ['forest_wolf', 3], ['wild_boar', 2], ['dusk_moth', 2]] },
  { id: 'crownlands', name: { ru: 'Королевские земли', en: 'Crownlands' }, x: 1080, z: 1080, r: 170, lo: 5, hi: 12, mobs: [['forest_wolf', 3], ['wild_boar', 3], ['bandit_thug', 2], ['giant_spider', 1]] },
  { id: 'alderwood', name: { ru: 'Ольховый лес', en: 'Alder Wood' }, x: 1310, z: 960, r: 140, lo: 6, hi: 12, mobs: HEART_WILD },
  { id: 'elderwood', name: { ru: 'Старолесье', en: 'Elderwood' }, x: 1270, z: 1260, r: 150, lo: 15, hi: 25, mobs: DEEP_WOOD, wild: 1.3 },
  { id: 'ashen', name: { ru: 'Пепелище', en: 'Ashen Hamlet' }, x: 1130, z: 1390, r: 90, lo: 10, hi: 16, mobs: [['rot_zombie', 3], ['ghoul', 3], ['plague_rat', 2], ['crypt_bat', 2]] },
  { id: 'ravenhills', name: { ru: 'Вороньи холмы', en: 'Raven Hills' }, x: 440, z: 880, r: 150, lo: 12, hi: 18, mobs: [['forest_wolf', 3], ['giant_spider', 2], ['wild_boar', 2], ['forest_bear', 1]] },
  { id: 'battlefield', name: { ru: 'Поле Старой Битвы', en: 'Old Battlefield' }, x: 620, z: 1010, r: 90, lo: 16, hi: 24, mobs: UNDEAD },
  { id: 'mistfen', name: { ru: 'Туманные топи', en: 'Mistfen' }, x: 400, z: 1330, r: 140, lo: 12, hi: 20, mobs: SWAMP, wild: 1.2 },
  { id: 'gullcoast', name: { ru: 'Берег Чаек', en: 'Gull Coast' }, x: 280, z: 1060, r: 150, lo: 6, hi: 12, mobs: [['forest_wolf', 2], ['wild_boar', 2], ['bloat_toad', 2], ['bandit_thug', 1]] },
  { id: 'greyback', name: { ru: 'Серые холмы', en: 'Greyback Hills' }, x: 1500, z: 950, r: 120, lo: 10, hi: 18, mobs: [['forest_bear', 2], ['forest_wolf', 3], ['giant_spider', 2], ['orc_grunt', 1]] },
  { id: 'eastmarch', name: { ru: 'Восточная марка', en: 'East March' }, x: 1740, z: 1030, r: 150, lo: 14, hi: 22, mobs: [['orc_grunt', 3], ['orc_archer', 2], ['orc_warboar', 2], ['forest_wolf', 2]] },
  { id: 'fang', name: { ru: 'Клык', en: 'The Fang' }, x: 1880, z: 800, r: 150, lo: 18, hi: 26, mobs: [['orc_grunt', 3], ['orc_archer', 2], ['orc_brute', 1], ['orc_warboar', 2]] },
  { id: 'ambercoast', name: { ru: 'Янтарный берег', en: 'Amber Coast' }, x: 1800, z: 1270, r: 130, lo: 12, hi: 18, mobs: [['bloat_toad', 2], ['forest_wolf', 2], ['giant_spider', 2], ['orc_grunt', 1]] },
  // ---- taiga (frontier)
  { id: 'pinewood', name: { ru: 'Предгорная пуща', en: 'Foothill Pinewood' }, x: 520, z: 720, r: 170, lo: 12, hi: 20, mobs: TAIGA },
  { id: 'ravengate', name: { ru: 'Вороньи Врата', en: 'Raven Gate' }, x: 720, z: 670, r: 110, lo: 10, hi: 18, mobs: [['forest_wolf', 3], ['bandit_thug', 2], ['bandit_archer', 1], ['forest_bear', 1]] },
  { id: 'pinehollow', name: { ru: 'Хвойная долина', en: 'Pine Hollow' }, x: 1020, z: 720, r: 160, lo: 12, hi: 20, mobs: TAIGA },
  { id: 'orcpass', name: { ru: 'Орочий перевал', en: 'Orc Pass' }, x: 1350, z: 620, r: 110, lo: 18, hi: 26, mobs: [['orc_grunt', 3], ['orc_archer', 2], ['orc_brute', 1], ['orc_warboar', 1]] },
  { id: 'pinemarch', name: { ru: 'Сосновый край', en: 'Pinemarch' }, x: 1650, z: 690, r: 150, lo: 14, hi: 22, mobs: TAIGA },
  // ---- north
  { id: 'holmshore', name: { ru: 'Хольмский берег', en: 'Holm Shore' }, x: 360, z: 290, r: 190, lo: 20, hi: 28, mobs: NORTH },
  { id: 'icemere', name: { ru: 'Ледяное озеро', en: 'Icemere' }, x: 660, z: 340, r: 130, lo: 22, hi: 30, mobs: NORTH },
  { id: 'ironvale', name: { ru: 'Долина Железного Пика', en: 'Ironpeak Vale' }, x: 1040, z: 370, r: 140, lo: 20, hi: 27, mobs: [['frost_walker', 3], ['snow_wolf', 3], ['clan_raider', 2], ['snow_slime', 2]] },
  { id: 'crownpeaks', name: { ru: 'Пики Хладной Короны', en: 'Frostcrown Peaks' }, x: 1150, z: 170, r: 150, lo: 28, hi: 36, mobs: PEAKS },
  { id: 'copperslopes', name: { ru: 'Медные склоны', en: 'Copper Slopes' }, x: 1620, z: 430, r: 140, lo: 24, hi: 32, mobs: [['snow_wolf', 2], ['frost_walker', 2], ['orc_grunt', 2], ['tusk_calf', 2]] },
  { id: 'crownruins', name: { ru: 'Руины Хладной Короны', en: 'Frostcrown Ruins' }, x: 1520, z: 200, r: 110, lo: 35, hi: 45, mobs: [['skeleton', 3], ['wraith', 2], ['frost_mage', 2], ['bone_archer', 2], ['ice_golem', 1]] },
  { id: 'endlessfrost', name: { ru: 'Край Вечной Стужи', en: 'Rim of Endless Frost' }, x: 1780, z: 190, r: 140, lo: 40, hi: 48, mobs: PEAKS },
  // ---- steppe
  { id: 'dustway', name: { ru: 'Пыльный тракт', en: 'Dustway' }, x: 960, z: 1470, r: 150, lo: 10, hi: 18, mobs: STEPPE },
  { id: 'drymeadows', name: { ru: 'Сухие луга', en: 'Dry Meadows' }, x: 560, z: 1480, r: 150, lo: 12, hi: 20, mobs: [['bandit_thug', 2], ['bandit_archer', 1], ['wild_boar', 3], ['plague_rat', 2]] },
  { id: 'eaststeppe', name: { ru: 'Восточная степь', en: 'East Steppe' }, x: 1450, z: 1440, r: 150, lo: 14, hi: 22, mobs: STEPPE },
  // ---- desert
  { id: 'windcanyon', name: { ru: 'Каньон Ветров', en: 'Windcanyon' }, x: 950, z: 1650, r: 110, lo: 25, hi: 30, mobs: DESERT },
  { id: 'zeyra', name: { ru: 'Оазис Зейра', en: 'Zeyra Oasis' }, x: 820, z: 1820, r: 140, lo: 25, hi: 32, mobs: DESERT },
  { id: 'kharum', name: { ru: 'Мёртвый Кхарум', en: 'Dead Kharum' }, x: 480, z: 1720, r: 130, lo: 35, hi: 45, mobs: ANCIENT },
  { id: 'rustvalley', name: { ru: 'Долина Ржавицы', en: 'Rustwater Valley' }, x: 1560, z: 1800, r: 160, lo: 26, hi: 34, mobs: DESERT },
  { id: 'oblivion', name: { ru: 'Пески Забвения', en: 'Sands of Oblivion' }, x: 1160, z: 1880, r: 170, lo: 30, hi: 40, mobs: DUNES },
  { id: 'suneye', name: { ru: 'Храм Солнечного Ока', en: 'Sun-Eye Temple' }, x: 1260, z: 1620, r: 80, lo: 40, hi: 50, mobs: ANCIENT },
  { id: 'embergorge', name: { ru: 'Огненное ущелье', en: 'Ember Gorge' }, x: 1820, z: 1600, r: 120, lo: 38, hi: 46, mobs: FIRE },
  { id: 'sandblade', name: { ru: 'Песчаный рубеж', en: 'Sandblade March' }, x: 1150, z: 1700, r: 110, lo: 28, hi: 36, mobs: DESERT },
  { id: 'scorpioncape', name: { ru: 'Мыс Скорпиона', en: 'Scorpion Cape' }, x: 300, z: 1850, r: 150, lo: 32, hi: 40, mobs: DUNES },
];

// ------------------------------------------------------------------ settlements
export type SettlementKind = 'capital' | 'city' | 'town' | 'village' | 'fort' | 'hamlet' | 'ruin';
export type WallKind = 'stone' | 'palisade' | 'desert' | 'none' | 'ruined';
export type Service = 'smith' | 'armorer' | 'trader' | 'alchemist' | 'mage' | 'innkeeper' | 'priest' | 'banker' | 'trainer' | 'elder' | 'stable' | 'jeweler' | 'guide';

export interface SettlementDef {
  id: string;
  name: Loc;
  kind: SettlementKind;
  style: Style;
  x: number;
  z: number;
  /** Half sizes of the settled rectangle (walls run along it). */
  hw: number;
  hd: number;
  walls: WallKind;
  /** Safe from monsters inside (ruins are not). */
  safe: boolean;
  /** Has a teleport waystone; `open` = known from the start. */
  waystone?: 'open' | 'hidden';
  /** Services of the merchants and masters living here. */
  services: Service[];
  /** Level band of the goods sold. */
  shopLv: [number, number];
  /** Short line for the map tooltip. */
  about: Loc;
}

export const SETTLEMENTS: SettlementDef[] = [
  {
    id: 'altgard', name: { ru: 'Альтгард', en: 'Altgard' }, kind: 'capital', style: 'heart', x: 1068, z: 1072, hw: 62, hd: 52, walls: 'stone', safe: true, waystone: 'open',
    services: ['smith', 'armorer', 'trader', 'alchemist', 'mage', 'innkeeper', 'priest', 'banker', 'trainer', 'elder', 'jeweler', 'stable'], shopLv: [5, 16],
    about: { ru: 'Столица королевства: крепость, рынок, все мастера и торговцы.', en: 'The royal capital: keep, market, every master and merchant.' },
  },
  {
    id: 'quietford', name: { ru: 'Тихий Брод', en: 'Quietford' }, kind: 'village', style: 'heart', x: 768, z: 1232, hw: 34, hd: 26, walls: 'none', safe: true, waystone: 'open',
    services: ['trader', 'smith', 'banker', 'elder', 'innkeeper'], shopLv: [1, 6],
    about: { ru: 'Деревня у брода через Сребротечь. Здесь начинается путь.', en: 'A village at the Silverrun ford. Every journey starts here.' },
  },
  {
    id: 'alderhollow', name: { ru: 'Ольховый Лог', en: 'Alder Hollow' }, kind: 'village', style: 'heart', x: 1330, z: 1008, hw: 30, hd: 24, walls: 'palisade', safe: true, waystone: 'hidden',
    services: ['trader', 'smith', 'alchemist'], shopLv: [5, 12],
    about: { ru: 'Лесная деревня лесорубов и охотников на Ольховке.', en: 'A woodcutters’ and hunters’ village on the Alderbrook.' },
  },
  {
    id: 'wheatdale', name: { ru: 'Пшеничный Дол', en: 'Wheatdale' }, kind: 'village', style: 'heart', x: 880, z: 1352, hw: 34, hd: 26, walls: 'none', safe: true,
    services: ['trader', 'innkeeper'], shopLv: [3, 8],
    about: { ru: 'Фермы, мельница и поля, кормящие столицу.', en: 'Farms, a windmill and the fields that feed the capital.' },
  },
  {
    id: 'reedwater', name: { ru: 'Камышовка', en: 'Reedwater' }, kind: 'hamlet', style: 'heart', x: 924, z: 842, hw: 20, hd: 16, walls: 'none', safe: true,
    services: ['trader'], shopLv: [4, 9],
    about: { ru: 'Рыбацкая деревушка на Зеркальном озере.', en: 'A fishing hamlet on Mirror Lake.' },
  },
  {
    id: 'windhaven', name: { ru: 'Ветрогорск', en: 'Windhaven' }, kind: 'city', style: 'heart', x: 286, z: 1066, hw: 44, hd: 38, walls: 'palisade', safe: true, waystone: 'hidden',
    services: ['smith', 'armorer', 'trader', 'alchemist', 'innkeeper', 'banker', 'jeweler'], shopLv: [6, 14],
    about: { ru: 'Портовый город на Заливе Чаек: доки, склады и рынок.', en: 'A harbour town on Gull Bay: docks, warehouses and a market.' },
  },
  {
    id: 'dustway', name: { ru: 'Пыльный Тракт', en: 'Dustway' }, kind: 'town', style: 'heart', x: 962, z: 1466, hw: 36, hd: 30, walls: 'palisade', safe: true, waystone: 'hidden',
    services: ['trader', 'armorer', 'innkeeper', 'stable', 'guide'], shopLv: [10, 18],
    about: { ru: 'Торговая стоянка караванов между зелёными землями и пустыней.', en: 'A caravan post between the green lands and the desert.' },
  },
  {
    id: 'stonewatch', name: { ru: 'Каменная Застава', en: 'Stonewatch' }, kind: 'fort', style: 'heart', x: 712, z: 652, hw: 30, hd: 24, walls: 'stone', safe: true, waystone: 'hidden',
    services: ['smith', 'trader', 'trainer'], shopLv: [10, 18],
    about: { ru: 'Крепость у Вороньих Врат, стерегущая путь на север.', en: 'The fortress at Raven Gate guarding the road north.' },
  },
  {
    id: 'eastbastion', name: { ru: 'Восточный Бастион', en: 'East Bastion' }, kind: 'fort', style: 'heart', x: 1618, z: 1004, hw: 28, hd: 22, walls: 'stone', safe: true, waystone: 'hidden',
    services: ['smith', 'trader', 'trainer'], shopLv: [12, 20],
    about: { ru: 'Пограничная крепость против орочьих земель.', en: 'A border fortress facing the orc lands.' },
  },
  {
    id: 'ironpeak', name: { ru: 'Железный Пик', en: 'Ironpeak' }, kind: 'city', style: 'north', x: 1048, z: 352, hw: 44, hd: 36, walls: 'stone', safe: true, waystone: 'hidden',
    services: ['smith', 'armorer', 'trader', 'alchemist', 'innkeeper', 'banker', 'mage'], shopLv: [20, 30],
    about: { ru: 'Шахтёрский город, врезанный в скалы. Лучшие кузницы севера.', en: 'A mining city cut into the cliffs. The best forges of the north.' },
  },
  {
    id: 'holmvald', name: { ru: 'Хольмвальд', en: 'Holmvald' }, kind: 'village', style: 'north', x: 432, z: 300, hw: 30, hd: 26, walls: 'palisade', safe: true, waystone: 'hidden',
    services: ['trader', 'smith', 'trainer'], shopLv: [20, 28],
    about: { ru: 'Селение мирного клана Хольм на берегу северной реки.', en: 'The village of the peaceful Holm clan on the northern river.' },
  },
  {
    id: 'copperbrook', name: { ru: 'Медный Ручей', en: 'Copperbrook' }, kind: 'hamlet', style: 'north', x: 1580, z: 452, hw: 22, hd: 18, walls: 'palisade', safe: true,
    services: ['trader', 'smith'], shopLv: [24, 32],
    about: { ru: 'Посёлок рудокопов у Медного прохода.', en: 'A miners’ hamlet at the Copper Gap.' },
  },
  {
    id: 'surhad', name: { ru: 'Сурхад', en: 'Surhad' }, kind: 'city', style: 'south', x: 1544, z: 1812, hw: 46, hd: 40, walls: 'desert', safe: true, waystone: 'hidden',
    services: ['smith', 'armorer', 'trader', 'alchemist', 'mage', 'innkeeper', 'banker', 'jeweler', 'guide'], shopLv: [26, 38],
    about: { ru: 'Торговый город юга на Ржавице: базар, караван-сарай, храм.', en: 'The trade city of the south on the Rustwater: bazaar, caravanserai, temple.' },
  },
  {
    id: 'zeyra', name: { ru: 'Зейра', en: 'Zeyra' }, kind: 'village', style: 'south', x: 836, z: 1806, hw: 30, hd: 24, walls: 'none', safe: true, waystone: 'hidden',
    services: ['trader', 'alchemist', 'guide'], shopLv: [25, 32],
    about: { ru: 'Поселение у оазиса — единственная вода на пути через пески.', en: 'A settlement at the oasis, the only water across the sands.' },
  },
  {
    id: 'sandblade', name: { ru: 'Форт Песчаный Клинок', en: 'Fort Sandblade' }, kind: 'fort', style: 'south', x: 1124, z: 1716, hw: 26, hd: 22, walls: 'desert', safe: true, waystone: 'hidden',
    services: ['smith', 'trader', 'trainer'], shopLv: [28, 36],
    about: { ru: 'Укреплённый форпост на краю Песков Забвения.', en: 'A fortified outpost on the edge of the Sands of Oblivion.' },
  },
  {
    id: 'ashen', name: { ru: 'Пепелище', en: 'Ashen Hamlet' }, kind: 'ruin', style: 'heart', x: 1150, z: 1392, hw: 24, hd: 20, walls: 'ruined', safe: false,
    services: [], shopLv: [0, 0],
    about: { ru: 'Сожжённая орками деревня. По ночам здесь бродят мертвецы.', en: 'A village burned by orcs. The dead walk here at night.' },
  },
  {
    id: 'kharum', name: { ru: 'Мёртвый Кхарум', en: 'Dead Kharum' }, kind: 'ruin', style: 'south', x: 486, z: 1712, hw: 40, hd: 34, walls: 'ruined', safe: false, waystone: 'hidden',
    services: [], shopLv: [0, 0],
    about: { ru: 'Древний город, засыпанный песком. Его стражи всё ещё несут службу.', en: 'An ancient city buried in sand. Its guardians still keep watch.' },
  },
  {
    id: 'frostcrown', name: { ru: 'Крепость Хладной Короны', en: 'Frostcrown Keep' }, kind: 'ruin', style: 'north', x: 1524, z: 212, hw: 34, hd: 28, walls: 'ruined', safe: false, waystone: 'hidden',
    services: [], shopLv: [0, 0],
    about: { ru: 'Заброшенный замок северных королей, захваченный нежитью.', en: 'The abandoned castle of the northern kings, held by the undead.' },
  },
  {
    id: 'ravenhold', name: { ru: 'Воронье Гнездо', en: 'Ravenhold' }, kind: 'ruin', style: 'heart', x: 448, z: 872, hw: 28, hd: 24, walls: 'ruined', safe: false,
    services: [], shopLv: [0, 0],
    about: { ru: 'Разрушенный замок на холмах — логово разбойников.', en: 'A ruined castle in the hills — the bandits’ den.' },
  },
];

// ------------------------------------------------------------------ roads
/** Road classes: main trade roads, secondary roads, trails. */
export type RoadKind = 'main' | 'road' | 'trail';
export interface RoadDef {
  from: string;
  to: string;
  kind: RoadKind;
  /** Waypoints the road must pass (passes, fords, bridges). */
  via?: [number, number][];
  name?: Loc;
}

export const ROADS: RoadDef[] = [
  // the royal roads from the capital
  { from: 'altgard', to: 'quietford', kind: 'main', name: { ru: 'Речной тракт', en: 'River Road' } },
  { from: 'altgard', to: 'stonewatch', kind: 'main', via: [[930, 800], [820, 720]], name: { ru: 'Северный тракт', en: 'North Road' } },
  { from: 'altgard', to: 'eastbastion', kind: 'main', via: [[1330, 1040], [1500, 1000]], name: { ru: 'Восточный тракт', en: 'East Road' } },
  { from: 'altgard', to: 'dustway', kind: 'main', via: [[1000, 1300]], name: { ru: 'Южный тракт', en: 'South Road' } },
  { from: 'quietford', to: 'windhaven', kind: 'main', via: [[560, 1215], [420, 1180]], name: { ru: 'Западный тракт', en: 'West Road' } },
  { from: 'dustway', to: 'sandblade', kind: 'main', via: [[950, 1530], [950, 1640], [1040, 1700]], name: { ru: 'Караванный путь', en: 'Caravan Way' } },
  { from: 'sandblade', to: 'surhad', kind: 'main', via: [[1300, 1760], [1440, 1800]], name: { ru: 'Караванный путь', en: 'Caravan Way' } },
  { from: 'stonewatch', to: 'ironpeak', kind: 'main', via: [[708, 600], [710, 520], [760, 440], [900, 400]], name: { ru: 'Путь через Врата', en: 'Gate Road' } },
  // secondary roads
  { from: 'altgard', to: 'alderhollow', kind: 'road', via: [[1230, 1030]] },
  { from: 'quietford', to: 'wheatdale', kind: 'road' },
  { from: 'altgard', to: 'reedwater', kind: 'road', via: [[1040, 960]] },
  { from: 'wheatdale', to: 'dustway', kind: 'road' },
  { from: 'ironpeak', to: 'holmvald', kind: 'road', via: [[800, 380], [600, 360]] },
  { from: 'ironpeak', to: 'copperbrook', kind: 'road', via: [[1200, 360], [1370, 395], [1500, 440]] },
  { from: 'dustway', to: 'zeyra', kind: 'road', via: [[950, 1600], [880, 1720]] },
  { from: 'zeyra', to: 'sandblade', kind: 'road', via: [[980, 1760]] },
  { from: 'windhaven', to: 'stonewatch', kind: 'road', via: [[400, 900], [450, 760], [600, 680]] },
  { from: 'eastbastion', to: 'alderhollow', kind: 'road' },
  { from: 'surhad', to: 'eastbastion', kind: 'road', via: [[1440, 1600], [1440, 1470], [1560, 1240]] },
  { from: 'reedwater', to: 'alderhollow', kind: 'road', via: [[1180, 900], [1290, 1010]] },
  // trails to wild places
  { from: 'copperbrook', to: 'frostcrown', kind: 'trail', via: [[1420, 430], [1405, 395], [1420, 330]] },
  { from: 'altgard', to: 'ashen', kind: 'trail', via: [[1120, 1250]] },
  { from: 'quietford', to: 'ravenhold', kind: 'road', via: [[640, 1100], [520, 960]] },
  { from: 'windhaven', to: 'kharum', kind: 'trail', via: [[320, 1300], [480, 1480], [690, 1560], [600, 1700]], name: { ru: 'Заброшенный королевский тракт', en: 'Old Royal Road' } },
  { from: 'ironpeak', to: 'frostcrown', kind: 'trail', via: [[1150, 300], [1300, 260], [1440, 230]] },
  { from: 'eastbastion', to: 'fangcamp', kind: 'trail', via: [[1760, 900]] },
];

// ------------------------------------------------------------------ factions and camps
export type Faction = 'orc' | 'bandit' | 'clan' | 'raider' | 'undead' | 'ancient' | 'beast';

export const FACTIONS: Record<Faction, { name: Loc; color: string; mobs: string[]; boss: string; elite: string }> = {
  orc: { name: { ru: 'Орочья орда', en: 'Orc Horde' }, color: '#c0503a', mobs: ['orc_grunt', 'orc_grunt', 'orc_archer', 'orc_warboar', 'orc_brute', 'orc_shaman'], boss: 'orc_brute', elite: 'orc_brute' },
  bandit: { name: { ru: 'Разбойники', en: 'Bandits' }, color: '#a08060', mobs: ['bandit_thug', 'bandit_thug', 'bandit_archer', 'bandit_cutthroat', 'bandit_brute'], boss: 'bandit_brute', elite: 'bandit_brute' },
  clan: { name: { ru: 'Северные кланы', en: 'Northern Clans' }, color: '#6a8ac0', mobs: ['clan_raider', 'clan_raider', 'clan_hunter', 'clan_berserker', 'clan_seer'], boss: 'clan_berserker', elite: 'clan_berserker' },
  raider: { name: { ru: 'Пустынные налётчики', en: 'Desert Raiders' }, color: '#d0a050', mobs: ['raider_blade', 'raider_blade', 'raider_archer', 'sand_scorpion', 'dune_stalker'], boss: 'raider_blade', elite: 'raider_blade' },
  undead: { name: { ru: 'Нежить', en: 'The Undead' }, color: '#9aa0b8', mobs: ['skeleton', 'skeleton', 'bone_archer', 'ghoul', 'wraith', 'necro_acolyte'], boss: 'crypt_golem', elite: 'crypt_golem' },
  ancient: { name: { ru: 'Древние стражи', en: 'Ancient Wardens' }, color: '#b090e0', mobs: ['ruin_guard', 'ruin_guard', 'gear_spider', 'phantom', 'stone_sentinel', 'void_eye'], boss: 'stone_sentinel', elite: 'stone_sentinel' },
  beast: { name: { ru: 'Звери', en: 'Beasts' }, color: '#8a9a5a', mobs: ['forest_wolf'], boss: 'forest_bear', elite: 'forest_bear' },
};

export type CampSize = 'scout' | 'outpost' | 'warcamp' | 'stronghold';
export interface CampSite {
  id: string;
  name: Loc;
  faction: Faction;
  size: CampSize;
  x: number;
  z: number;
  lo: number;
  hi: number;
  /** Why it is here (map tooltip). */
  about: Loc;
  /** Commander's name. */
  chief: Loc;
}

export const CAMP_SITES: CampSite[] = [
  { id: 'orcpass', name: { ru: 'Орочий лагерь на перевале', en: 'Orc Pass Warcamp' }, faction: 'orc', size: 'stronghold', x: 1350, z: 640, lo: 20, hi: 26, chief: { ru: 'Вождь Гарш Костолом', en: 'Chief Garsh Bonesplitter' }, about: { ru: 'Орда держит перевал и не пускает караваны на север.', en: 'The horde holds the pass and blocks caravans to the north.' } },
  { id: 'fangcamp', name: { ru: 'Стан Клыка', en: 'Fang Camp' }, faction: 'orc', size: 'warcamp', x: 1870, z: 800, lo: 20, hi: 26, chief: { ru: 'Урза Красная Рука', en: 'Urza Redhand' }, about: { ru: 'Главная стоянка орды на полуострове.', en: 'The horde’s main camp on the peninsula.' } },
  { id: 'orceast', name: { ru: 'Орочья застава у брода', en: 'Orc Ford Outpost' }, faction: 'orc', size: 'outpost', x: 1770, z: 1110, lo: 15, hi: 20, chief: { ru: 'Мугрок', en: 'Mugrok' }, about: { ru: 'Орки перекрыли брод через Янтарку.', en: 'Orcs block the ford across the Amberrun.' } },
  { id: 'orcscout', name: { ru: 'Орочий дозор', en: 'Orc Lookout' }, faction: 'orc', size: 'scout', x: 1590, z: 1250, lo: 12, hi: 16, chief: { ru: 'Глазастый Шрак', en: 'Shrak the Watcher' }, about: { ru: 'Разведчики орды следят за дорогой на юг.', en: 'Horde scouts watch the road south.' } },
  { id: 'orcmine', name: { ru: 'Захваченный рудник', en: 'Seized Mine' }, faction: 'orc', size: 'warcamp', x: 1720, z: 500, lo: 26, hi: 32, chief: { ru: 'Кузнец Драгул', en: 'Dragul the Smith' }, about: { ru: 'Орки отбили у рудокопов медный рудник.', en: 'Orcs seized a copper mine from the miners.' } },
  { id: 'bridgegang', name: { ru: 'Засада у моста', en: 'Bridge Ambush' }, faction: 'bandit', size: 'outpost', x: 545, z: 1150, lo: 7, hi: 11, chief: { ru: 'Ловкий Тибо', en: 'Nimble Tibo' }, about: { ru: 'Разбойники берут плату за проход по мосту.', en: 'Bandits take a toll on the bridge.' } },
  { id: 'elderbandits', name: { ru: 'Лесной притон', en: 'Forest Hideout' }, faction: 'bandit', size: 'outpost', x: 1180, z: 1190, lo: 14, hi: 18, chief: { ru: 'Марта Чёрная Стрела', en: 'Marta Blackarrow' }, about: { ru: 'Притон в чаще у Лесного озера.', en: 'A hideout in the thicket by the Forest Pond.' } },
  { id: 'steppebandits', name: { ru: 'Степные головорезы', en: 'Steppe Cutthroats' }, faction: 'bandit', size: 'warcamp', x: 600, z: 1450, lo: 14, hi: 20, chief: { ru: 'Одноглазый Борх', en: 'One-eyed Borkh' }, about: { ru: 'Грабят караваны на старом королевском тракте.', en: 'They rob caravans on the old royal road.' } },
  { id: 'ravenhold', name: { ru: 'Воронье Гнездо', en: 'Ravenhold' }, faction: 'bandit', size: 'stronghold', x: 448, z: 872, lo: 12, hi: 18, chief: { ru: 'Барон Вороний Глаз', en: 'Baron Raveneye' }, about: { ru: 'Главарь разбойников засел в руинах замка.', en: 'The bandit lord holds the castle ruins.' } },
  { id: 'gatebandits', name: { ru: 'Лагерь у Врат', en: 'Gate Camp' }, faction: 'bandit', size: 'scout', x: 790, z: 720, lo: 10, hi: 14, chief: { ru: 'Хромой Ян', en: 'Limping Yan' }, about: { ru: 'Поджидают путников у северного тракта.', en: 'They wait for travellers on the north road.' } },
  { id: 'frostclan', name: { ru: 'Стан Ледяного Клыка', en: 'Icefang Clan Camp' }, faction: 'clan', size: 'warcamp', x: 300, z: 440, lo: 22, hi: 28, chief: { ru: 'Ярл Сигвар', en: 'Jarl Sigvar' }, about: { ru: 'Враждебный клан, изгнанный из Хольмвальда.', en: 'A hostile clan exiled from Holmvald.' } },
  { id: 'peakclan', name: { ru: 'Лагерь у Северного прохода', en: 'North Gap Camp' }, faction: 'clan', size: 'outpost', x: 860, z: 260, lo: 26, hi: 32, chief: { ru: 'Хильда Седая', en: 'Hilda Greymane' }, about: { ru: 'Клан грабит рудокопов, идущих к перевалу.', en: 'The clan raids miners heading for the pass.' } },
  { id: 'raidclan', name: { ru: 'Стоянка налётчиков', en: 'Raider Hold' }, faction: 'clan', size: 'warcamp', x: 1250, z: 290, lo: 24, hi: 30, chief: { ru: 'Торд Медвежья Шкура', en: 'Thord Bearhide' }, about: { ru: 'Лагерь над Разломом Хьяльма.', en: 'A camp above Hjalm’s Rift.' } },
  { id: 'canyonraiders', name: { ru: 'Засада в каньоне', en: 'Canyon Ambush' }, faction: 'raider', size: 'outpost', x: 990, z: 1690, lo: 26, hi: 30, chief: { ru: 'Сабир Песчаный Пёс', en: 'Sabir Sanddog' }, about: { ru: 'Налётчики стерегут выход из Каньона Ветров.', en: 'Raiders watch the mouth of Windcanyon.' } },
  { id: 'oasisraiders', name: { ru: 'Лагерь у дюн', en: 'Dune Camp' }, faction: 'raider', size: 'warcamp', x: 690, z: 1910, lo: 30, hi: 34, chief: { ru: 'Аз-Захр', en: 'Az-Zahr' }, about: { ru: 'Налётчики угрожают оазису Зейра.', en: 'Raiders threaten the Zeyra oasis.' } },
  { id: 'duneraiders', name: { ru: 'Крепость налётчиков', en: 'Raider Fort' }, faction: 'raider', size: 'stronghold', x: 1320, z: 1900, lo: 32, hi: 38, chief: { ru: 'Королева Миражей', en: 'The Mirage Queen' }, about: { ru: 'Сердце пустынного разбоя.', en: 'The heart of desert banditry.' } },
  { id: 'caperaiders', name: { ru: 'Пиратская бухта', en: 'Pirate Cove' }, faction: 'raider', size: 'outpost', x: 340, z: 1880, lo: 34, hi: 40, chief: { ru: 'Капитан Ржавый Крюк', en: 'Captain Rusthook' }, about: { ru: 'Контрабандисты в Бухте Скорпиона.', en: 'Smugglers in Scorpion Cove.' } },
  { id: 'kharumguard', name: { ru: 'Стражи Кхарума', en: 'Kharum Wardens' }, faction: 'ancient', size: 'stronghold', x: 486, z: 1712, lo: 36, hi: 45, chief: { ru: 'Привратник Кхарума', en: 'The Kharum Gatekeeper' }, about: { ru: 'Древние стражи охраняют мёртвый город.', en: 'Ancient wardens guard the dead city.' } },
  { id: 'crowndead', name: { ru: 'Гарнизон мёртвых', en: 'Dead Garrison' }, faction: 'undead', size: 'stronghold', x: 1524, z: 212, lo: 36, hi: 45, chief: { ru: 'Рыцарь-призрак Эльвар', en: 'Wraith Knight Elvar' }, about: { ru: 'Мёртвый гарнизон Хладной Короны.', en: 'The dead garrison of Frostcrown.' } },
  { id: 'ashendead', name: { ru: 'Мертвецы Пепелища', en: 'Ashen Dead' }, faction: 'undead', size: 'outpost', x: 1150, z: 1392, lo: 11, hi: 16, chief: { ru: 'Староста-упырь', en: 'The Ghoul Reeve' }, about: { ru: 'Погибшие жители не обрели покоя.', en: 'The slain villagers found no rest.' } },
  { id: 'battledead', name: { ru: 'Павшая армия', en: 'Fallen Army' }, faction: 'undead', size: 'warcamp', x: 620, z: 1010, lo: 17, hi: 24, chief: { ru: 'Знаменосец Старой Битвы', en: 'Standard-bearer of the Old Battle' }, about: { ru: 'Солдаты древней войны поднимаются из курганов.', en: 'Soldiers of an ancient war rise from the barrows.' } },
];

// ------------------------------------------------------------------ boss lairs
export interface LairDef {
  id: string;
  name: Loc;
  boss: string;
  level: number;
  x: number;
  z: number;
  about: Loc;
}
export const LAIRS: LairDef[] = [
  { id: 'sporenest', name: { ru: 'Гнездо Споровой Матки', en: 'Spore Mother’s Nest' }, boss: 'spore_mother', level: 16, x: 330, z: 1390, about: { ru: 'В сердце Туманных топей.', en: 'In the heart of Mistfen.' } },
  { id: 'rotroot', name: { ru: 'Корни Гнилодрева', en: 'Rotroot’s Hollow' }, boss: 'rotroot', level: 24, x: 1360, z: 1330, about: { ru: 'Под гниющим корнем Старолесья.', en: 'Under a rotting root of the Elderwood.' } },
  { id: 'rattyrant', name: { ru: 'Крысиный погреб', en: 'Rat Cellar' }, boss: 'rat_tyrant', level: 14, x: 1180, z: 1420, about: { ru: 'Под сгоревшей мельницей Пепелища.', en: 'Under the burned mill of the Ashen Hamlet.' } },
  { id: 'bellwarden', name: { ru: 'Звонница Вороньего Гнезда', en: 'Ravenhold Belfry' }, boss: 'bellwarden', level: 18, x: 420, z: 850, about: { ru: 'Колокол разрушенного замка звонит сам собой.', en: 'The ruined castle’s bell tolls by itself.' } },
  { id: 'colossus', name: { ru: 'Курган Колосса', en: 'Colossus Barrow' }, boss: 'bone_colossus', level: 24, x: 580, z: 1040, about: { ru: 'Центр Поля Старой Битвы.', en: 'The centre of the Old Battlefield.' } },
  { id: 'frostfang', name: { ru: 'Логово Морозного Клыка', en: 'Frostfang’s Den' }, boss: 'frostfang', level: 30, x: 1210, z: 250, about: { ru: 'Пещеры у Пиков Хладной Короны.', en: 'Caves below the Frostcrown Peaks.' } },
  { id: 'matriarch', name: { ru: 'Ледяной трон', en: 'Ice Throne' }, boss: 'glacial_matriarch', level: 38, x: 1470, z: 120, about: { ru: 'На льду Озера Короны.', en: 'On the ice of Crown Tarn.' } },
  { id: 'lich', name: { ru: 'Тронный зал Хладной Короны', en: 'Frostcrown Throne Hall' }, boss: 'lich_vharos', level: 44, x: 1540, z: 190, about: { ru: 'Последний король севера не умер до конца.', en: 'The last king of the north never fully died.' } },
  { id: 'sentinel', name: { ru: 'Часовой Кхарума', en: 'Kharum Sentinel' }, boss: 'clockwork_sentinel', level: 38, x: 470, z: 1690, about: { ru: 'Механический страж на площади мёртвого города.', en: 'A clockwork guard on the dead city’s square.' } },
  { id: 'cindergolem', name: { ru: 'Кузня Пепла', en: 'Cinder Forge' }, boss: 'cinder_golem', level: 40, x: 1800, z: 1570, about: { ru: 'Раскалённое сердце Огненного ущелья.', en: 'The burning heart of Ember Gorge.' } },
  { id: 'magmaw', name: { ru: 'Пасть Магмы', en: 'Magma Maw' }, boss: 'magmaw', level: 46, x: 1880, z: 1640, about: { ru: 'Там, где земля плавится.', en: 'Where the earth melts.' } },
  { id: 'sovereign', name: { ru: 'Око Солнца', en: 'Eye of the Sun' }, boss: 'hollow_sovereign', level: 50, x: 1262, z: 1610, about: { ru: 'Владыка пустого трона в забытом храме.', en: 'The lord of the hollow throne in the forgotten temple.' } },
];

// ------------------------------------------------------------------ waystones in the wild and dungeon entrances
export interface Waystone {
  id: string;
  name: Loc;
  x: number;
  z: number;
  open?: boolean;
}
/** Waystones outside settlements (settlements with `waystone` get one on their square). */
export const WILD_WAYSTONES: Waystone[] = [
  { id: 'ws_mirror', name: { ru: 'Камень Зеркального озера', en: 'Mirror Lake Stone' }, x: 1068, z: 840 },
  { id: 'ws_elder', name: { ru: 'Камень Старолесья', en: 'Elderwood Stone' }, x: 1240, z: 1300 },
  { id: 'ws_crown', name: { ru: 'Камень Пиков', en: 'Peak Stone' }, x: 1300, z: 250 },
  { id: 'ws_ember', name: { ru: 'Камень Огненного ущелья', en: 'Ember Stone' }, x: 1740, z: 1640 },
  { id: 'ws_cape', name: { ru: 'Камень Мыса', en: 'Cape Stone' }, x: 400, z: 1820 },
];

export type DungeonKind = 'cave_entrance' | 'mine_entrance' | 'crypt_entrance' | 'temple_ruin' | 'tomb_entrance' | 'fortress_hatch' | 'waterfall_cave';
export interface DungeonDef {
  id: string;
  name: Loc;
  kind: DungeonKind;
  x: number;
  z: number;
  /** Facing of the mouth (prefab rotation). */
  rot: number;
  lo: number;
  hi: number;
  about: Loc;
}

export const DUNGEONS: DungeonDef[] = [
  { id: 'whispercave', name: { ru: 'Пещера Шёпота', en: 'Whisper Cave' }, kind: 'cave_entrance', x: 640, z: 1110, rot: 0, lo: 3, hi: 6, about: { ru: 'Из глубины слышен шёпот.', en: 'Whispers echo from the depths.' } },
  { id: 'altcrypt', name: { ru: 'Королевский склеп', en: 'Royal Crypt' }, kind: 'crypt_entrance', x: 1170, z: 1160, rot: 0, lo: 8, hi: 12, about: { ru: 'Усыпальница королей у стен столицы.', en: 'The tomb of kings outside the capital walls.' } },
  { id: 'ashencrypt', name: { ru: 'Склеп Пепелища', en: 'Ashen Crypt' }, kind: 'crypt_entrance', x: 1176, z: 1412, rot: 3, lo: 12, hi: 16, about: { ru: 'Откуда приходят мертвецы.', en: 'Where the dead come from.' } },
  { id: 'treeroots', name: { ru: 'Корни Древа', en: 'Roots of the Tree' }, kind: 'temple_ruin', x: 1318, z: 1290, rot: 0, lo: 18, hi: 25, about: { ru: 'Древний храм под Великим Дубом.', en: 'An ancient temple under the Great Oak.' } },
  { id: 'ravencellar', name: { ru: 'Подвалы Вороньего Гнезда', en: 'Ravenhold Cellars' }, kind: 'fortress_hatch', x: 466, z: 860, rot: 0, lo: 14, hi: 18, about: { ru: 'Сокровищница барона.', en: 'The baron’s treasury.' } },
  { id: 'falls', name: { ru: 'Грот за водопадом', en: 'Grotto Behind the Falls' }, kind: 'waterfall_cave', x: 880, z: 592, rot: 0, lo: 14, hi: 20, about: { ru: 'Скрытый вход у истока Сребротечи.', en: 'A hidden entrance at the Silverrun spring.' } },
  { id: 'sunkenruin', name: { ru: 'Затопленные руины', en: 'Sunken Ruins' }, kind: 'temple_ruin', x: 360, z: 1290, rot: 1, lo: 15, hi: 20, about: { ru: 'Храм, ушедший в болото.', en: 'A temple sunk into the marsh.' } },
  { id: 'barrow', name: { ru: 'Курган Знаменосца', en: 'Standard-bearer’s Barrow' }, kind: 'crypt_entrance', x: 640, z: 990, rot: 0, lo: 18, hi: 24, about: { ru: 'Здесь похоронены знамёна старой войны.', en: 'The banners of the old war are buried here.' } },
  { id: 'gatemine', name: { ru: 'Шахта Заставы', en: 'Watch Mine' }, kind: 'mine_entrance', x: 768, z: 604, rot: 0, lo: 12, hi: 18, about: { ru: 'Заброшенная шахта у Вороньих Врат.', en: 'An abandoned mine near Raven Gate.' } },
  { id: 'deepmine', name: { ru: 'Глубокая шахта', en: 'The Deep Mine' }, kind: 'mine_entrance', x: 1090, z: 296, rot: 0, lo: 22, hi: 28, about: { ru: 'Самая старая шахта Железного Пика.', en: 'The oldest mine of Ironpeak.' } },
  { id: 'coppermine', name: { ru: 'Медный рудник', en: 'Copper Mine' }, kind: 'mine_entrance', x: 1740, z: 470, rot: 0, lo: 28, hi: 32, about: { ru: 'Рудник, захваченный орками.', en: 'The mine seized by the orcs.' } },
  { id: 'icecave', name: { ru: 'Ледяная пещера', en: 'Ice Cave' }, kind: 'cave_entrance', x: 630, z: 284, rot: 0, lo: 24, hi: 30, about: { ru: 'Пещера под Ледяным озером.', en: 'A cave beneath Icemere.' } },
  { id: 'crowncrypt', name: { ru: 'Склеп Северных Королей', en: 'Crypt of the North Kings' }, kind: 'crypt_entrance', x: 1500, z: 176, rot: 0, lo: 38, hi: 45, about: { ru: 'Под замком спят короли севера.', en: 'The kings of the north sleep under the castle.' } },
  { id: 'peakcave', name: { ru: 'Пещера Стужи', en: 'Frost Hollow' }, kind: 'cave_entrance', x: 1180, z: 236, rot: 0, lo: 30, hi: 36, about: { ru: 'Ледяные ходы под пиками.', en: 'Icy tunnels under the peaks.' } },
  { id: 'kharumtomb', name: { ru: 'Гробница Кхарума', en: 'Tomb of Kharum' }, kind: 'tomb_entrance', x: 452, z: 1696, rot: 0, lo: 38, hi: 45, about: { ru: 'Усыпальница последнего царя Кхарума.', en: 'The tomb of Kharum’s last king.' } },
  { id: 'suntemple', name: { ru: 'Святилище Солнечного Ока', en: 'Sun-Eye Sanctum' }, kind: 'tomb_entrance', x: 1248, z: 1636, rot: 0, lo: 42, hi: 50, about: { ru: 'Самое опасное место материка.', en: 'The most dangerous place on the continent.' } },
  { id: 'sandtomb', name: { ru: 'Песчаная гробница', en: 'Sand Tomb' }, kind: 'tomb_entrance', x: 1100, z: 1900, rot: 0, lo: 32, hi: 38, about: { ru: 'Её то заносит песком, то открывает ветер.', en: 'The wind buries and unearths it in turns.' } },
  { id: 'snakeden', name: { ru: 'Змеиная нора', en: 'Serpent Hole' }, kind: 'cave_entrance', x: 286, z: 1830, rot: 0, lo: 34, hi: 40, about: { ru: 'Логово контрабандистов и змей.', en: 'A den of smugglers and snakes.' } },
  { id: 'emberrift', name: { ru: 'Огненный разлом', en: 'Ember Rift' }, kind: 'cave_entrance', x: 1846, z: 1608, rot: 0, lo: 40, hi: 46, about: { ru: 'Из разлома тянет жаром.', en: 'Heat pours out of the rift.' } },
  { id: 'sunkenfort', name: { ru: 'Затонувший форт', en: 'Sunken Fort' }, kind: 'fortress_hatch', x: 1860, z: 1300, rot: 0, lo: 16, hi: 20, about: { ru: 'Руины форта у самого моря.', en: 'Fort ruins at the water’s edge.' } },
  { id: 'orccave', name: { ru: 'Пещера Клыка', en: 'Fang Cave' }, kind: 'cave_entrance', x: 1930, z: 760, rot: 0, lo: 22, hi: 26, about: { ru: 'Здесь орки держат пленников.', en: 'The orcs keep their captives here.' } },
];

// ------------------------------------------------------------------ landmarks
export interface LandmarkDef {
  id: string;
  name: Loc;
  prefab: string;
  x: number;
  z: number;
  rot?: number;
  p?: number[];
  about: Loc;
}
export const LANDMARKS: LandmarkDef[] = [
  { id: 'greatoak', name: { ru: 'Великий Дуб', en: 'The Great Oak' }, prefab: 'ancient_tree', x: 1300, z: 1272, about: { ru: 'Дереву тысячи лет. Говорят, его корни уходят в древний храм.', en: 'A thousand-year-old tree. Its roots are said to reach an ancient temple.' } },
  { id: 'windmillhill', name: { ru: 'Мельничий холм', en: 'Mill Hill' }, prefab: 'windmill', x: 940, z: 1300, about: { ru: 'Мельница видна со всей долины.', en: 'The mill is seen from the whole vale.' } },
  { id: 'oldtower', name: { ru: 'Старая сторожевая башня', en: 'Old Watchtower' }, prefab: 'ruined_tower', x: 880, z: 1050, about: { ru: 'Башня времён первой войны с орками.', en: 'A tower from the first orc war.' } },
  { id: 'siege1', name: { ru: 'Остов осадной машины', en: 'Siege Engine Wreck' }, prefab: 'siege_wreck', x: 600, z: 990, about: { ru: 'Осадные машины так и остались на поле битвы.', en: 'The siege engines still stand on the battlefield.' } },
  { id: 'siege2', name: { ru: 'Разбитая баллиста', en: 'Broken Ballista' }, prefab: 'siege_wreck', x: 660, z: 1040, rot: 1, about: { ru: 'Обломки баллисты в высокой траве.', en: 'A broken ballista in the tall grass.' } },
  { id: 'graveyard', name: { ru: 'Кладбище Альтгарда', en: 'Altgard Graveyard' }, prefab: 'graveyard', x: 1150, z: 1166, about: { ru: 'Старое кладбище у королевского склепа.', en: 'An old graveyard by the royal crypt.' } },
  { id: 'wreck1', name: { ru: 'Разграбленная повозка', en: 'Looted Wagon' }, prefab: 'cart_wreck', x: 1040, z: 1360, about: { ru: 'Кто-то не доехал до Пыльного Тракта.', en: 'Someone never reached Dustway.' } },
  { id: 'wreck2', name: { ru: 'Брошенный караван', en: 'Abandoned Caravan' }, prefab: 'cart_wreck', x: 1010, z: 1640, rot: 1, about: { ru: 'Следы налёта в каньоне.', en: 'Signs of a raid in the canyon.' } },
  { id: 'shrine1', name: { ru: 'Придорожное святилище', en: 'Roadside Shrine' }, prefab: 'shrine', x: 900, z: 1130, about: { ru: 'Путники оставляют здесь цветы.', en: 'Travellers leave flowers here.' } },
  { id: 'shrine2', name: { ru: 'Святилище Перевала', en: 'Pass Shrine' }, prefab: 'shrine', x: 726, z: 590, about: { ru: 'Последняя молитва перед севером.', en: 'The last prayer before the north.' } },
  { id: 'lighthouse', name: { ru: 'Маяк Ветрогорска', en: 'Windhaven Lighthouse' }, prefab: 'wall_tower', x: 214, z: 1020, about: { ru: 'Огонь маяка виден с моря.', en: 'The lighthouse fire is seen far out at sea.' } },
  { id: 'brokenbridge', name: { ru: 'Обрушенный мост', en: 'Fallen Bridge' }, prefab: 'cart_wreck', x: 450, z: 1160, about: { ru: 'Старый королевский мост, разрушенный во время войны.', en: 'The old royal bridge, broken in the war.' } },
  { id: 'ruinwall1', name: { ru: 'Стены Старой Заставы', en: 'Old Outpost Walls' }, prefab: 'ruins_wall', x: 1450, z: 1360, p: [12], about: { ru: 'Остатки заставы времён королевского тракта.', en: 'Remains of an outpost of the royal road.' } },
  { id: 'ruintower2', name: { ru: 'Башня Ветров', en: 'Tower of Winds' }, prefab: 'ruined_tower', x: 760, z: 1620, about: { ru: 'Песок точит её уже тысячу лет.', en: 'The sand has been wearing it down for a thousand years.' } },
  { id: 'ruintower3', name: { ru: 'Северная башня', en: 'North Tower' }, prefab: 'ruined_tower', x: 1360, z: 470, about: { ru: 'Разрушенная крепость на перевале.', en: 'A ruined fort on the pass.' } },
  { id: 'clanshrine', name: { ru: 'Камни предков', en: 'Ancestor Stones' }, prefab: 'shrine', x: 560, z: 250, about: { ru: 'Священное место клана Хольм.', en: 'A sacred place of the Holm clan.' } },
  { id: 'oasisruin', name: { ru: 'Колодец Мудреца', en: 'Sage’s Well' }, prefab: 'desert_well', x: 1180, z: 1830, about: { ru: 'Пересохший колодец посреди дюн.', en: 'A dry well among the dunes.' } },
];
