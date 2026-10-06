import type { MapDef, MapEvent, SpawnSegment } from './types';

/**
 * Builds the standard 15-minute pacing curve from per-map enemy pools.
 * Each stage lists [enemyId, weight]; rate/max scale up through the run.
 */
function pacing(stages: { t: number; pool: [string, number][] }[]): SpawnSegment[] {
  // spawns per minute and alive caps at stage start times (seconds)
  const curve: Record<number, [number, number]> = {
    0: [70, 60], 60: [110, 90], 120: [150, 140], 180: [190, 190], 300: [240, 280],
    420: [280, 360], 600: [340, 480], 720: [400, 600], 840: [480, 750],
  };
  const times = Object.keys(curve).map(Number);
  const out: SpawnSegment[] = [];
  for (const t of times) {
    let pool = stages[0].pool;
    for (const s of stages) if (s.t <= t) pool = s.pool;
    const [rate, max] = curve[t];
    out.push({ t, pool, rate, max });
  }
  return out;
}

/** Events common to every map; map-specific ones are appended. */
function commonEvents(swarm: string, fast: string, eliteA: string, eliteB: string): MapEvent[] {
  return [
    { t: 90, type: 'swarm', enemy: swarm, count: 30 },
    { t: 150, type: 'chest' },
    { t: 180, type: 'elite', enemy: eliteA, count: 1 },
    { t: 240, type: 'stampede', enemy: fast, count: 24 },
    { t: 270, type: 'treasure' },
    { t: 330, type: 'elite', enemy: eliteB, count: 1 },
    { t: 390, type: 'swarm', enemy: swarm, count: 60 },
    { t: 520, type: 'elite', enemy: eliteA, count: 2 },
    { t: 560, type: 'stampede', enemy: fast, count: 40 },
    { t: 600, type: 'chest' },
    { t: 640, type: 'swarm', enemy: swarm, count: 90 },
    { t: 690, type: 'elite', enemy: eliteB, count: 2 },
    { t: 750, type: 'treasure' },
    { t: 780, type: 'stampede', enemy: fast, count: 60 },
    { t: 810, type: 'elite', enemy: eliteA, count: 3 },
    { t: 860, type: 'swarm', enemy: swarm, count: 120 },
  ];
}

export const MAPS: MapDef[] = [
  {
    id: 'blightwood',
    name: { ru: 'Гнилолесье', en: 'Blightwood' },
    desc: { ru: 'Заражённый лес. Болота с ядом, грибы и старые деревья.', en: 'An infected forest of toxic bogs, mushrooms and old trees.' },
    size: 160, generator: 'forest', difficultyStars: 1, recommendedLevel: 0, tier: 1,
    palette: {
      sky: 0x1d2a1f, fog: 0x22301f, fogNear: 22, fogFar: 46, ambient: 0x9fb6a0, ambientIntensity: 0.55,
      sun: 0xfff0d0, sunIntensity: 1.25, hemiGround: 0x2a3a20,
      tiles: { grass: [0x4d8a3a, 0x548f3e, 0x46803a], grass2: [0x5d9a44, 0x63a149], dirt: [0x7a5a3a, 0x6f5235], path: [0x9a8a6a, 0x8e7f61], bog: [0x5a3a7a, 0x6a3f8a], water: [0x2a6aa8, 0x2f74b3] },
      blocks: { trunk: [0x5a3d24, 0x664629], leaves: [0x2f6b2a, 0x387a30, 0x2a5f2a, 0x6b3a8a], stone: [0x7a7f86, 0x6e737a], mushroom: [0xc8483a, 0xe8e0d0], plank: [0x8a6a42, 0x7a5c38] },
    },
    segments: pacing([
      { t: 0, pool: [['rot_zombie', 6], ['sporeling', 4]] },
      { t: 60, pool: [['rot_zombie', 5], ['sporeling', 4], ['dusk_moth', 3]] },
      { t: 120, pool: [['rot_zombie', 4], ['blight_wolf', 3], ['dusk_moth', 3], ['spore_spitter', 1]] },
      { t: 300, pool: [['rot_zombie', 4], ['blight_wolf', 3], ['spore_spitter', 2], ['thorn_beetle', 1], ['bloat_toad', 2]] },
      { t: 600, pool: [['rot_zombie', 3], ['blight_wolf', 4], ['thorn_beetle', 2], ['bloat_toad', 2], ['sapling_shaman', 1], ['spore_spitter', 2]] },
      { t: 840, pool: [['blight_wolf', 4], ['thorn_beetle', 3], ['bloat_toad', 3], ['sapling_shaman', 1], ['dusk_moth', 3]] },
    ]),
    events: [...commonEvents('sporeling', 'blight_wolf', 'thorn_beetle', 'rot_zombie'), { t: 480, type: 'hazard_rain', count: 30, radius: 1.8, duration: 20, style: 'spore' }],
    midBoss: 'spore_mother', boss: 'rotroot', bossTime: 900,
    music: { root: 45, scale: 'dorian', tempo: 112, mood: 'forest' }, hazardDps: 6, ambient: 'spores',
  },
  {
    id: 'gloamhaven',
    name: { ru: 'Сумрачная Гавань', en: 'Gloamhaven' },
    desc: { ru: 'Заброшенный город. Узкие улицы, площади и мёртвый колокол.', en: 'An abandoned city of narrow streets, plazas and a dead bell.' },
    size: 160, generator: 'city', difficultyStars: 2, recommendedLevel: 5, tier: 1.1,
    palette: {
      sky: 0x1a1c2a, fog: 0x1e2130, fogNear: 20, fogFar: 44, ambient: 0xa0a8c8, ambientIntensity: 0.62,
      sun: 0xd8e0ff, sunIntensity: 1.1, hemiGround: 0x2a2a3a,
      tiles: { cobble: [0x6a6a72, 0x62626a, 0x707078], road: [0x4a4a52, 0x45454d], plaza: [0x8a8478, 0x827c70], grass: [0x4a6a3a, 0x52723f], water: [0x2a4f7a, 0x2f5784], dirt: [0x5a4a3a, 0x524335] },
      blocks: { brick: [0x7a4a3a, 0x6e4234, 0x844f3e], stone: [0x7a7a82, 0x70707a], roof: [0x3a3a52, 0x44445e], plank: [0x6a5034, 0x5e472e], lamp: [0xffd37a] },
    },
    segments: pacing([
      { t: 0, pool: [['ghoul', 6], ['plague_rat', 3]] },
      { t: 60, pool: [['ghoul', 5], ['plague_rat', 4], ['crypt_bat', 3]] },
      { t: 120, pool: [['ghoul', 5], ['plague_rat', 4], ['crypt_bat', 3], ['cult_archer', 2]] },
      { t: 300, pool: [['ghoul', 4], ['plague_rat', 4], ['cult_archer', 2], ['iron_husk', 1], ['powder_imp', 2]] },
      { t: 600, pool: [['ghoul', 3], ['plague_rat', 4], ['iron_husk', 2], ['powder_imp', 2], ['bell_cultist', 1], ['gargoyle', 1]] },
      { t: 840, pool: [['plague_rat', 4], ['iron_husk', 3], ['powder_imp', 3], ['bell_cultist', 1], ['gargoyle', 2], ['cult_archer', 2]] },
    ]),
    events: [...commonEvents('plague_rat', 'plague_rat', 'iron_husk', 'gargoyle'), { t: 480, type: 'darkness', duration: 40 }],
    midBoss: 'rat_tyrant', boss: 'bellwarden', bossTime: 900,
    music: { root: 43, scale: 'phrygian', tempo: 118, mood: 'city' }, ambient: 'ash',
  },
  {
    id: 'ossuary',
    name: { ru: 'Костяные глубины', en: 'Ossuary Depths' },
    desc: { ru: 'Подземные катакомбы. Узкие коридоры, залы и факелы.', en: 'Underground catacombs of narrow halls, crypts and torches.' },
    size: 140, generator: 'catacombs', difficultyStars: 3, recommendedLevel: 10, tier: 1.2,
    palette: {
      sky: 0x0c0a10, fog: 0x0e0c14, fogNear: 18, fogFar: 40, ambient: 0x8a7aa8, ambientIntensity: 0.62,
      sun: 0xb8a8ff, sunIntensity: 0.8, hemiGround: 0x1a1420,
      tiles: { floor: [0x4a4650, 0x45414b, 0x504c56], tile: [0x5a5560, 0x55505b], bone: [0x8a8270, 0x7e7666], lava: [0xff6a1a, 0xff8a2a], moss: [0x3a4a3a, 0x354535] },
      blocks: { wall: [0x3e3a46, 0x46424e, 0x38343f], pillar: [0x6a6470, 0x625c68], bone: [0xd8d0b8, 0xc8c0a8], torch: [0xffa040], coffin: [0x4a3424] },
    },
    segments: pacing([
      { t: 0, pool: [['skeleton', 6], ['crypt_bat', 3]] },
      { t: 60, pool: [['skeleton', 5], ['crypt_bat', 3], ['bone_hound', 2]] },
      { t: 120, pool: [['skeleton', 5], ['bone_hound', 3], ['bone_archer', 2], ['crypt_bat', 2]] },
      { t: 300, pool: [['skeleton', 4], ['bone_hound', 3], ['bone_archer', 2], ['wraith', 2], ['crypt_golem', 1]] },
      { t: 600, pool: [['skeleton', 3], ['bone_hound', 3], ['wraith', 3], ['crypt_golem', 2], ['necro_acolyte', 1], ['bone_archer', 2]] },
      { t: 840, pool: [['bone_hound', 4], ['wraith', 3], ['crypt_golem', 3], ['necro_acolyte', 2], ['bone_archer', 2]] },
    ]),
    events: [...commonEvents('skeleton', 'bone_hound', 'crypt_golem', 'wraith'), { t: 480, type: 'swarm', enemy: 'wraith', count: 40 }],
    midBoss: 'bone_colossus', boss: 'lich_vharos', bossTime: 900,
    music: { root: 38, scale: 'harmonic', tempo: 104, mood: 'crypt' }, hazardDps: 14, ambient: 'dust',
  },
  {
    id: 'emberwaste',
    name: { ru: 'Пепельные пустоши', en: 'Emberwaste' },
    desc: { ru: 'Огненные земли. Реки лавы, обсидиан и метеоритные дожди.', en: 'Fire lands of lava rivers, obsidian and meteor showers.' },
    size: 160, generator: 'volcano', difficultyStars: 4, recommendedLevel: 16, tier: 1.3,
    palette: {
      sky: 0x2a120a, fog: 0x3a1a0e, fogNear: 20, fogFar: 44, ambient: 0xffb08a, ambientIntensity: 0.5,
      sun: 0xffc89a, sunIntensity: 1.1, hemiGround: 0x3a1a10,
      tiles: { ash: [0x4a3a36, 0x433531, 0x51403b], basalt: [0x2e2a2c, 0x353032], scorch: [0x6a3a22, 0x5e3420], lava: [0xff5a0a, 0xff7a1a], sulfur: [0xb8a83a, 0xa8983a] },
      blocks: { obsidian: [0x1e1a24, 0x2a2430, 0x241e2a], basalt: [0x3a3438, 0x433c40], magma: [0xff6a1a], bone: [0xd8c8a8], crystal: [0xff8a3a] },
    },
    segments: pacing([
      { t: 0, pool: [['magma_slime', 4], ['magma_slimelet', 4]] },
      { t: 60, pool: [['magma_slime', 4], ['cinder_hound', 3], ['magma_slimelet', 3]] },
      { t: 120, pool: [['magma_slime', 4], ['cinder_hound', 3], ['fire_imp', 2], ['ember_wisp', 2]] },
      { t: 300, pool: [['magma_slime', 3], ['cinder_hound', 3], ['fire_imp', 2], ['ember_wisp', 2], ['obsidian_brute', 1]] },
      { t: 600, pool: [['magma_slime', 3], ['cinder_hound', 3], ['obsidian_brute', 2], ['lava_salamander', 2], ['fire_imp', 2], ['ember_wisp', 2]] },
      { t: 840, pool: [['cinder_hound', 4], ['obsidian_brute', 3], ['lava_salamander', 2], ['ember_wisp', 3], ['fire_imp', 2]] },
    ]),
    events: [...commonEvents('magma_slimelet', 'cinder_hound', 'obsidian_brute', 'lava_salamander'), { t: 360, type: 'hazard_rain', count: 30, radius: 2.2, duration: 25, style: 'meteor' }, { t: 700, type: 'hazard_rain', count: 50, radius: 2.2, duration: 30, style: 'meteor' }],
    midBoss: 'cinder_golem', boss: 'magmaw', bossTime: 900,
    music: { root: 40, scale: 'phrygian', tempo: 128, mood: 'fire' }, hazardDps: 18, ambient: 'embers',
  },
  {
    id: 'frostveil',
    name: { ru: 'Морозная Завеса', en: 'Frostveil' },
    desc: { ru: 'Ледяная пустошь. Скользкий лёд, сугробы и метели.', en: 'A frozen waste of slippery ice, snowdrifts and blizzards.' },
    size: 160, generator: 'tundra', difficultyStars: 4, recommendedLevel: 22, tier: 1.4,
    palette: {
      sky: 0xa8c4d8, fog: 0xc8dcea, fogNear: 20, fogFar: 46, ambient: 0xd0e4ff, ambientIntensity: 0.7,
      sun: 0xffffff, sunIntensity: 1.2, hemiGround: 0x7a8aa0,
      tiles: { snow: [0xe8f0f8, 0xdde8f2, 0xf2f6fa], snow2: [0xd0dce8, 0xc8d6e4], ice: [0x9fd4f0, 0xa8dcf4], rock: [0x7a828c, 0x727a84], water: [0x2a6a9a, 0x2f74a8] },
      blocks: { ice: [0x9fe0ff, 0xb0e8ff, 0x8ad4f8], snow: [0xf2f6fa, 0xe6eef6], pine: [0x2a4a3a, 0x30523f], trunk: [0x4a3424, 0x553b29], rock: [0x6a727c, 0x7a828c] },
    },
    segments: pacing([
      { t: 0, pool: [['frost_walker', 6], ['snow_slimelet', 3]] },
      { t: 60, pool: [['frost_walker', 5], ['snow_wolf', 2], ['frost_bat', 3]] },
      { t: 120, pool: [['frost_walker', 4], ['snow_wolf', 3], ['frost_bat', 3], ['snow_slime', 2], ['frost_mage', 1]] },
      { t: 300, pool: [['frost_walker', 4], ['snow_wolf', 3], ['snow_slime', 2], ['frost_mage', 2], ['ice_golem', 1]] },
      { t: 600, pool: [['frost_walker', 3], ['snow_wolf', 4], ['ice_golem', 2], ['tusk_calf', 2], ['frost_mage', 2], ['snow_slime', 2]] },
      { t: 840, pool: [['snow_wolf', 4], ['ice_golem', 3], ['tusk_calf', 2], ['frost_mage', 3], ['frost_bat', 3]] },
    ]),
    events: [...commonEvents('snow_slimelet', 'snow_wolf', 'ice_golem', 'tusk_calf'), { t: 420, type: 'blizzard', duration: 45 }, { t: 730, type: 'blizzard', duration: 45 }],
    midBoss: 'frostfang', boss: 'glacial_matriarch', bossTime: 900,
    music: { root: 47, scale: 'aeolian', tempo: 100, mood: 'ice' }, ambient: 'snow',
  },
  {
    id: 'aetherfall',
    name: { ru: 'Руины Эфирфолла', en: 'Aetherfall Ruins' },
    desc: { ru: 'Древние руины. Колонны, рунные круги и магические бури.', en: 'Ancient ruins of pillars, rune circles and arcane storms.' },
    size: 170, generator: 'ruins', difficultyStars: 5, recommendedLevel: 30, tier: 1.5,
    palette: {
      sky: 0x1a1430, fog: 0x221a3a, fogNear: 22, fogFar: 48, ambient: 0xc0a8ff, ambientIntensity: 0.5,
      sun: 0xffe8c8, sunIntensity: 1.15, hemiGround: 0x2a2040,
      tiles: { sand: [0xc8b088, 0xbfa780, 0xd0b890], marble: [0xd8d4cc, 0xccc8c0], moss: [0x5a7a4a, 0x52724a], rune: [0x6a4aff, 0x7a5aff], void: [0x1a0a3a, 0x220e48] },
      blocks: { marble: [0xe0dcd4, 0xd4d0c8, 0xccc6bc], sandstone: [0xb89a6a, 0xae9060], gold: [0xe8c050], vine: [0x4a7a3a], crystal: [0x9a7aff] },
    },
    segments: pacing([
      { t: 0, pool: [['ruin_guard', 6], ['gear_spider', 2]] },
      { t: 60, pool: [['ruin_guard', 5], ['gear_spider', 3], ['void_eye', 1]] },
      { t: 120, pool: [['ruin_guard', 4], ['gear_spider', 3], ['void_eye', 2], ['phantom', 2]] },
      { t: 300, pool: [['ruin_guard', 4], ['gear_spider', 3], ['void_eye', 2], ['phantom', 2], ['stone_sentinel', 1], ['arcane_bomber', 2]] },
      { t: 600, pool: [['ruin_guard', 3], ['gear_spider', 3], ['stone_sentinel', 2], ['rune_drone', 2], ['arcane_bomber', 2], ['phantom', 2]] },
      { t: 840, pool: [['gear_spider', 4], ['stone_sentinel', 3], ['rune_drone', 3], ['arcane_bomber', 3], ['void_eye', 2], ['phantom', 2]] },
    ]),
    events: [...commonEvents('ruin_guard', 'gear_spider', 'stone_sentinel', 'rune_drone'), { t: 420, type: 'arcane_surge', duration: 40 }, { t: 740, type: 'hazard_rain', count: 50, radius: 2, duration: 30, style: 'arcane' }],
    midBoss: 'clockwork_sentinel', boss: 'hollow_sovereign', bossTime: 900,
    music: { root: 41, scale: 'lydian', tempo: 120, mood: 'ruins' }, hazardDps: 10, ambient: 'motes',
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
