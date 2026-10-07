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

/**
 * Events common to every map. Swarms, stampedes and elites now come from wave types
 * (see game/Waves.ts); what remains here are the treasure sprites.
 */
function commonEvents(): MapEvent[] {
  return [
    { t: 470, type: 'treasure' },
    { t: 900, type: 'treasure' },
  ];
}

export const MAPS: MapDef[] = [
  {
    id: 'blightwood',
    name: { ru: 'Гнилолесье', en: 'Blightwood' },
    desc: { ru: 'Заражённый лес. Болота с ядом, грибы и старые деревья.', en: 'An infected forest of toxic bogs, mushrooms and old trees.' },
    size: 360, generator: 'forest', difficultyStars: 1, recommendedLevel: 0, tier: 1,
    palette: {
      sky: 0x9ec4b4, fog: 0x8fb39a, fogNear: 26, fogFar: 58, ambient: 0xd6ecff, ambientIntensity: 0.55,
      sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a6a34,
      tiles: { grass: [0x5f9440, 0x669a44, 0x598c3c], grass2: [0x6ea24a, 0x76a850], dirt: [0x9a7048, 0x926a44], path: [0xa88456, 0x9e7c50], bog: [0x6a4a8a, 0x7a4f9a], water: [0x3a86c8, 0x3f8ed0] },
      blocks: { trunk: [0x6e4c2c, 0x7a5532], leaves: [0x3f8a30, 0x4a9a36, 0x37802c, 0x7a4a9a], stone: [0x8e949c, 0x80868e], mushroom: [0xd04a3a, 0xf0e8d8], plank: [0xa87c4a, 0x9a7044] },
    },
    segments: pacing([
      { t: 0, pool: [['rot_zombie', 6], ['sporeling', 4]] },
      { t: 60, pool: [['rot_zombie', 5], ['sporeling', 4], ['dusk_moth', 3]] },
      { t: 120, pool: [['rot_zombie', 4], ['blight_wolf', 3], ['dusk_moth', 3], ['spore_spitter', 1]] },
      { t: 300, pool: [['rot_zombie', 4], ['blight_wolf', 3], ['spore_spitter', 2], ['thorn_beetle', 1], ['bloat_toad', 2]] },
      { t: 600, pool: [['rot_zombie', 3], ['blight_wolf', 4], ['thorn_beetle', 2], ['bloat_toad', 2], ['sapling_shaman', 1], ['spore_spitter', 2]] },
      { t: 840, pool: [['blight_wolf', 4], ['thorn_beetle', 3], ['bloat_toad', 3], ['sapling_shaman', 1], ['dusk_moth', 3]] },
    ]),
    events: [...commonEvents(), { t: 560, type: 'hazard_rain', count: 30, radius: 1.8, duration: 20, style: 'spore' }],
    midBoss: 'spore_mother', boss: 'rotroot', bossTime: 1044,
    music: { root: 45, scale: 'dorian', tempo: 112, mood: 'forest' }, hazardDps: 6, ambient: 'spores',
  },
  {
    id: 'gloamhaven',
    name: { ru: 'Сумрачная Гавань', en: 'Gloamhaven' },
    desc: { ru: 'Заброшенный город. Узкие улицы, площади и мёртвый колокол.', en: 'An abandoned city of narrow streets, plazas and a dead bell.' },
    size: 360, generator: 'city', difficultyStars: 2, recommendedLevel: 5, tier: 1.1,
    palette: {
      sky: 0x1c1a34, fog: 0x2a2648, fogNear: 22, fogFar: 50, ambient: 0x9a90e0, ambientIntensity: 0.95,
      sun: 0xb0bcff, sunIntensity: 0.95, hemiGround: 0x2a2444, heroLight: 0xd8f08a,
      tiles: { cobble: [0x8e8aa8, 0x8884a0, 0x9692b0], road: [0x76728e, 0x706c88], plaza: [0x9c94ac, 0x948ca4], grass: [0x628a74, 0x689078], water: [0x3a4ca0, 0x3f52a8], dirt: [0x8a7a96, 0x82728e] },
      blocks: { brick: [0x7a4a4a, 0x6e4242, 0x844f50], stone: [0x77748e, 0x6d6a84], roof: [0x3e3a66, 0x484472], plank: [0x6a5038, 0x5e4732], lamp: [0xffd37a] },
    },
    segments: pacing([
      { t: 0, pool: [['ghoul', 6], ['plague_rat', 3]] },
      { t: 60, pool: [['ghoul', 5], ['plague_rat', 4], ['crypt_bat', 3]] },
      { t: 120, pool: [['ghoul', 5], ['plague_rat', 4], ['crypt_bat', 3], ['cult_archer', 2]] },
      { t: 300, pool: [['ghoul', 4], ['plague_rat', 4], ['cult_archer', 2], ['iron_husk', 1], ['powder_imp', 2]] },
      { t: 600, pool: [['ghoul', 3], ['plague_rat', 4], ['iron_husk', 2], ['powder_imp', 2], ['bell_cultist', 1], ['gargoyle', 1]] },
      { t: 840, pool: [['plague_rat', 4], ['iron_husk', 3], ['powder_imp', 3], ['bell_cultist', 1], ['gargoyle', 2], ['cult_archer', 2]] },
    ]),
    events: [...commonEvents()],
    midBoss: 'rat_tyrant', boss: 'bellwarden', bossTime: 1044,
    music: { root: 43, scale: 'phrygian', tempo: 118, mood: 'city' }, ambient: 'ash',
  },
  {
    id: 'ossuary',
    name: { ru: 'Костяные глубины', en: 'Ossuary Depths' },
    desc: { ru: 'Подземные катакомбы. Узкие коридоры, залы и факелы.', en: 'Underground catacombs of narrow halls, crypts and torches.' },
    size: 300, generator: 'catacombs', difficultyStars: 3, recommendedLevel: 10, tier: 1.2,
    palette: {
      sky: 0x0e0c16, fog: 0x13101c, fogNear: 18, fogFar: 42, ambient: 0x9a8ac8, ambientIntensity: 0.9,
      sun: 0xb8a8ff, sunIntensity: 0.7, hemiGround: 0x1a1424, heroLight: 0xffc070,
      tiles: { floor: [0x8c86a0, 0x847e98, 0x948ea8], tile: [0xa09ab2, 0x9892aa], bone: [0x8a8270, 0x7e7666], lava: [0xff6a1a, 0xff8a2a], moss: [0x4e6a4e, 0x486448] },
      blocks: { wall: [0x4e4858, 0x565062, 0x48424f], pillar: [0x6a6470, 0x625c68], bone: [0xd8d0b8, 0xc8c0a8], torch: [0xffa040], coffin: [0x4a3424] },
    },
    segments: pacing([
      { t: 0, pool: [['skeleton', 6], ['crypt_bat', 3]] },
      { t: 60, pool: [['skeleton', 5], ['crypt_bat', 3], ['bone_hound', 2]] },
      { t: 120, pool: [['skeleton', 5], ['bone_hound', 3], ['bone_archer', 2], ['crypt_bat', 2]] },
      { t: 300, pool: [['skeleton', 4], ['bone_hound', 3], ['bone_archer', 2], ['wraith', 2], ['crypt_golem', 1]] },
      { t: 600, pool: [['skeleton', 3], ['bone_hound', 3], ['wraith', 3], ['crypt_golem', 2], ['necro_acolyte', 1], ['bone_archer', 2]] },
      { t: 840, pool: [['bone_hound', 4], ['wraith', 3], ['crypt_golem', 3], ['necro_acolyte', 2], ['bone_archer', 2]] },
    ]),
    events: [...commonEvents(), { t: 560, type: 'swarm', enemy: 'wraith', count: 40 }],
    midBoss: 'bone_colossus', boss: 'lich_vharos', bossTime: 1044,
    music: { root: 38, scale: 'harmonic', tempo: 104, mood: 'crypt' }, hazardDps: 14, ambient: 'dust',
  },
  {
    id: 'emberwaste',
    name: { ru: 'Пепельные пустоши', en: 'Emberwaste' },
    desc: { ru: 'Огненные земли. Реки лавы, обсидиан и метеоритные дожди.', en: 'Fire lands of lava rivers, obsidian and meteor showers.' },
    size: 360, generator: 'volcano', difficultyStars: 4, recommendedLevel: 16, tier: 1.3,
    palette: {
      sky: 0x4a2414, fog: 0x5a2c18, fogNear: 22, fogFar: 50, ambient: 0xffc8a8, ambientIntensity: 0.85,
      sun: 0xffc896, sunIntensity: 1.25, hemiGround: 0x4a2214,
      tiles: { ash: [0x9a7666, 0x926e5e, 0xa27e6e], basalt: [0x7e7276, 0x867a7e], scorch: [0xb4643c, 0xaa5e38], lava: [0xff5a0a, 0xff7a1a], sulfur: [0xb8a83a, 0xa8983a] },
      blocks: { obsidian: [0x2e2836, 0x383042, 0x322a3a], basalt: [0x524a4e, 0x5a5256], magma: [0xff6a1a], bone: [0xd8c8a8], crystal: [0xff8a3a] },
    },
    segments: pacing([
      { t: 0, pool: [['magma_slime', 4], ['magma_slimelet', 4]] },
      { t: 60, pool: [['magma_slime', 4], ['cinder_hound', 3], ['magma_slimelet', 3]] },
      { t: 120, pool: [['magma_slime', 4], ['cinder_hound', 3], ['fire_imp', 2], ['ember_wisp', 2]] },
      { t: 300, pool: [['magma_slime', 3], ['cinder_hound', 3], ['fire_imp', 2], ['ember_wisp', 2], ['obsidian_brute', 1]] },
      { t: 600, pool: [['magma_slime', 3], ['cinder_hound', 3], ['obsidian_brute', 2], ['lava_salamander', 2], ['fire_imp', 2], ['ember_wisp', 2]] },
      { t: 840, pool: [['cinder_hound', 4], ['obsidian_brute', 3], ['lava_salamander', 2], ['ember_wisp', 3], ['fire_imp', 2]] },
    ]),
    events: [...commonEvents()],
    midBoss: 'cinder_golem', boss: 'magmaw', bossTime: 1044,
    music: { root: 40, scale: 'phrygian', tempo: 128, mood: 'fire' }, hazardDps: 18, ambient: 'embers',
  },
  {
    id: 'frostveil',
    name: { ru: 'Морозная Завеса', en: 'Frostveil' },
    desc: { ru: 'Ледяная пустошь. Скользкий лёд, сугробы и метели.', en: 'A frozen waste of slippery ice, snowdrifts and blizzards.' },
    size: 360, generator: 'tundra', difficultyStars: 4, recommendedLevel: 22, tier: 1.4,
    palette: {
      sky: 0xb4d0e4, fog: 0xc4dcee, fogNear: 22, fogFar: 52, ambient: 0xd4e8ff, ambientIntensity: 0.42,
      sun: 0xfff6ea, sunIntensity: 0.9, hemiGround: 0x7a8aa8,
      tiles: { snow: [0xe8f0f8, 0xdde8f2, 0xf2f6fa], snow2: [0xd0dce8, 0xc8d6e4], ice: [0x9fd4f0, 0xa8dcf4], rock: [0x7a828c, 0x727a84], water: [0x2a6a9a, 0x2f74a8], trail: [0x9aa8b8, 0x929fb0] },
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
    events: [...commonEvents(), { t: 490, type: 'blizzard', duration: 45 }, { t: 850, type: 'blizzard', duration: 45 }],
    midBoss: 'frostfang', boss: 'glacial_matriarch', bossTime: 1044,
    music: { root: 47, scale: 'aeolian', tempo: 100, mood: 'ice' }, ambient: 'snow',
  },
  {
    id: 'aetherfall',
    name: { ru: 'Руины Эфирфолла', en: 'Aetherfall Ruins' },
    desc: { ru: 'Древние руины. Колонны, рунные круги и магические бури.', en: 'Ancient ruins of pillars, rune circles and arcane storms.' },
    size: 380, generator: 'ruins', difficultyStars: 5, recommendedLevel: 30, tier: 1.5,
    palette: {
      sky: 0x6a5a9a, fog: 0x7a6aa0, fogNear: 24, fogFar: 56, ambient: 0xd8c8ff, ambientIntensity: 0.46,
      sun: 0xffe2b8, sunIntensity: 1.0, hemiGround: 0x5a4a6a,
      tiles: { sand: [0xd8b47a, 0xceaa72, 0xe0bc84], marble: [0xd8d4cc, 0xccc8c0], moss: [0x5a7a4a, 0x52724a], rune: [0x6a4aff, 0x7a5aff], void: [0x1a0a3a, 0x220e48] },
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
    events: [...commonEvents(), { t: 490, type: 'arcane_surge', duration: 40 }, { t: 860, type: 'hazard_rain', count: 50, radius: 2, duration: 30, style: 'arcane' }],
    midBoss: 'clockwork_sentinel', boss: 'hollow_sovereign', bossTime: 1044,
    music: { root: 41, scale: 'lydian', tempo: 120, mood: 'ruins' }, hazardDps: 10, ambient: 'motes',
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

// Shrine altars share one glowing material on every map (variant = blessing type).
for (const m of MAPS) m.palette.blocks.shrine = [0x6aff9a, 0xff5a5a, 0x8ad8ff, 0xffd23d];
