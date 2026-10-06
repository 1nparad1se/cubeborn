import type { BossDef, RelicDef } from './types';

/**
 * Bosses are composed from reusable attack patterns (src/game/bosses/BossAttacks.ts).
 * Each phase starts at an HP threshold and swaps movement, attacks and one-shot actions.
 */
export const BOSSES: BossDef[] = [
  // ------------------------------------------------------------ Blightwood
  {
    id: 'spore_mother', name: { ru: 'Мать спор', en: 'Spore Mother' }, title: { ru: 'Сердце гнили', en: 'Heart of Rot' },
    hp: 2600, damage: 14, radius: 1.4, model: 'spore_mother', color: 0xc05ad6, relic: 'spore_sac',
    phases: [
      { hp: 1, move: 'chase', speed: 1.6, attacks: [
        { type: 'zones', cd: 4, count: 5, radius: 1.8, telegraph: 1.2, spread: 5, pool: 3 },
        { type: 'summon', cd: 7, enemy: 'sporeling', count: 8 },
        { type: 'ring', cd: 5, count: 14, speed: 5, waves: 1 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2, onEnter: [{ type: 'summon', cd: 0, enemy: 'bloat_toad', count: 6 }], attacks: [
        { type: 'zones', cd: 3, count: 8, radius: 1.8, telegraph: 1.0, spread: 6, pool: 4 },
        { type: 'ring', cd: 4, count: 18, speed: 5.5, waves: 2, waveDelay: 0.4, rotate: 10 },
        { type: 'summon', cd: 6, enemy: 'sporeling', count: 10 },
      ] },
    ],
  },
  {
    id: 'rotroot', name: { ru: 'Гнилокорень', en: 'Rotroot' }, title: { ru: 'Старейшина чащи', en: 'Elder of the Thicket' },
    hp: 9000, damage: 18, radius: 1.8, model: 'rotroot', color: 0x6b8f3a, relic: 'heartwood',
    phases: [
      { hp: 1, move: 'chase', speed: 1.5, attacks: [
        { type: 'zones', cd: 3.5, count: 6, radius: 1.5, telegraph: 1.1, spread: 0, line: 1 },
        { type: 'slam', cd: 6, radius: 10, speed: 7, width: 1.2 },
        { type: 'summon', cd: 8, enemy: 'sapling_shaman', count: 2 },
      ] },
      { hp: 0.6, move: 'chase', speed: 1.8, attacks: [
        { type: 'spiral', cd: 7, arms: 4, speed: 5, duration: 3, rate: 8, turn: 60 },
        { type: 'zones', cd: 3, count: 8, radius: 1.5, telegraph: 1.0, spread: 0, line: 1 },
        { type: 'slam', cd: 5, radius: 11, speed: 8, width: 1.2 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.2, onEnter: [{ type: 'summon', cd: 0, enemy: 'thorn_beetle', count: 4 }], attacks: [
        { type: 'spiral', cd: 5, arms: 6, speed: 5.5, duration: 3, rate: 9, turn: -80 },
        { type: 'zones', cd: 2.5, count: 10, radius: 1.6, telegraph: 0.9, spread: 7, pool: 3 },
        { type: 'slam', cd: 4, radius: 12, speed: 9, width: 1.3 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Gloamhaven
  {
    id: 'rat_tyrant', name: { ru: 'Крысиный тиран', en: 'Rat Tyrant' }, title: { ru: 'Король сточных канав', en: 'King of the Gutters' },
    hp: 3800, damage: 16, radius: 1.3, model: 'rat_tyrant', color: 0x8a7a6a, relic: 'gutter_crown',
    phases: [
      { hp: 1, move: 'chase', speed: 2.4, attacks: [
        { type: 'dash', cd: 4, speed: 16, telegraph: 0.7, count: 2 },
        { type: 'summon', cd: 6, enemy: 'plague_rat', count: 12 },
        { type: 'aimed', cd: 3.5, count: 5, spread: 40, speed: 8, bursts: 2, burstDelay: 0.4 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.8, attacks: [
        { type: 'dash', cd: 3, speed: 18, telegraph: 0.55, count: 3 },
        { type: 'summon', cd: 5, enemy: 'plague_rat', count: 16 },
        { type: 'ring', cd: 4, count: 20, speed: 6, waves: 2, waveDelay: 0.35 },
      ] },
    ],
  },
  {
    id: 'bellwarden', name: { ru: 'Колоколоносец', en: 'Bellwarden' }, title: { ru: 'Глас пустых улиц', en: 'Voice of Empty Streets' },
    hp: 13000, damage: 20, radius: 1.7, model: 'bellwarden', color: 0x6a6f86, relic: 'silent_bell', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.2, attacks: [
        { type: 'slam', cd: 4.5, radius: 12, speed: 7, width: 1.1, waves: 2 },
        { type: 'aimed', cd: 3, count: 3, spread: 20, speed: 10, bursts: 3, burstDelay: 0.25 },
        { type: 'teleport', cd: 7 },
      ] },
      { hp: 0.6, move: 'keep', speed: 2.6, onEnter: [{ type: 'summon', cd: 0, enemy: 'gargoyle', count: 4 }], attacks: [
        { type: 'slam', cd: 4, radius: 13, speed: 8, width: 1.1, waves: 3 },
        { type: 'spiral', cd: 6, arms: 3, speed: 6, duration: 3, rate: 10, turn: 90 },
        { type: 'teleport', cd: 5 },
        { type: 'summon', cd: 9, enemy: 'crypt_bat', count: 10 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.4, onEnter: [{ type: 'darkness', cd: 0, duration: 999 }], attacks: [
        { type: 'slam', cd: 3, radius: 14, speed: 9, width: 1.2, waves: 3 },
        { type: 'spiral', cd: 5, arms: 5, speed: 6, duration: 3, rate: 10, turn: -100 },
        { type: 'aimed', cd: 2.5, count: 7, spread: 60, speed: 9, bursts: 2, burstDelay: 0.3 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Ossuary Depths
  {
    id: 'bone_colossus', name: { ru: 'Костяной колосс', en: 'Bone Colossus' }, title: { ru: 'Собранный из тысячи', en: 'Built of a Thousand' },
    hp: 5200, damage: 20, radius: 1.8, model: 'bone_colossus', color: 0xe6dcc0, relic: 'colossus_marrow',
    phases: [
      { hp: 1, move: 'chase', speed: 1.5, attacks: [
        { type: 'slam', cd: 4.5, radius: 9, speed: 7, width: 1.3 },
        { type: 'aimed', cd: 3, count: 6, spread: 50, speed: 8, bursts: 1 },
        { type: 'summon', cd: 7, enemy: 'skeleton', count: 10 },
      ] },
      { hp: 0.4, move: 'chase', speed: 2, onEnter: [{ type: 'summon', cd: 0, enemy: 'bone_hound', count: 8 }], attacks: [
        { type: 'slam', cd: 3.5, radius: 11, speed: 8, width: 1.3, waves: 2 },
        { type: 'ring', cd: 3.5, count: 24, speed: 6, waves: 2, waveDelay: 0.4, rotate: 7 },
        { type: 'dash', cd: 5, speed: 13, telegraph: 0.8, count: 2 },
      ] },
    ],
  },
  {
    id: 'lich_vharos', name: { ru: 'Лич Вхарос', en: 'Lich Vharos' }, title: { ru: 'Хозяин склепов', en: 'Master of the Crypts' },
    hp: 16000, damage: 22, radius: 1.4, model: 'lich_vharos', color: 0x5affc8, relic: 'phylactery', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.2, attacks: [
        { type: 'spiral', cd: 6, arms: 4, speed: 6, duration: 3, rate: 9, turn: 70 },
        { type: 'teleport', cd: 6 },
        { type: 'summon', cd: 8, enemy: 'necro_acolyte', count: 2 },
      ] },
      { hp: 0.66, move: 'stationary', speed: 0, onEnter: [{ type: 'shield', cd: 0, count: 4, enemy: 'shield_crystal' }], attacks: [
        { type: 'laser', cd: 5, count: 3, telegraph: 1.0, duration: 2.5, sweep: 40, width: 0.8, length: 16 },
        { type: 'ring', cd: 3, count: 16, speed: 5, waves: 3, waveDelay: 0.4, rotate: 11 },
      ] },
      { hp: 0.33, move: 'keep', speed: 2.8, onEnter: [{ type: 'summon', cd: 0, enemy: 'wraith', count: 8 }], attacks: [
        { type: 'laser', cd: 4, count: 4, telegraph: 0.9, duration: 2.5, sweep: -55, width: 0.8, length: 16 },
        { type: 'spiral', cd: 5, arms: 6, speed: 6.5, duration: 3, rate: 10, turn: -90 },
        { type: 'teleport', cd: 4 },
        { type: 'zones', cd: 4, count: 6, radius: 1.8, telegraph: 1.0, spread: 4 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Emberwaste
  {
    id: 'cinder_golem', name: { ru: 'Пепельный голем', en: 'Cinder Golem' }, title: { ru: 'Кузня, что ходит', en: 'The Walking Forge' },
    hp: 7000, damage: 22, radius: 1.8, model: 'cinder_golem', color: 0x5a3a3a, relic: 'forge_heart',
    phases: [
      { hp: 1, move: 'chase', speed: 1.6, attacks: [
        { type: 'dash', cd: 5, speed: 14, telegraph: 0.9, count: 1 },
        { type: 'zones', cd: 4, count: 6, radius: 2, telegraph: 1.2, spread: 6, pool: 4 },
        { type: 'ring', cd: 4, count: 16, speed: 6, waves: 1 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2, onEnter: [{ type: 'summon', cd: 0, enemy: 'ember_wisp', count: 10 }], attacks: [
        { type: 'dash', cd: 3.5, speed: 16, telegraph: 0.7, count: 2 },
        { type: 'meteor', cd: 5, count: 10, radius: 2.2, telegraph: 1.2, spread: 9 },
        { type: 'ring', cd: 3, count: 22, speed: 6.5, waves: 2, waveDelay: 0.35, rotate: 8 },
      ] },
    ],
  },
  {
    id: 'magmaw', name: { ru: 'Магмоглот', en: 'Magmaw' }, title: { ru: 'Червь расплавленных глубин', en: 'Wyrm of the Molten Deep' },
    hp: 21000, damage: 26, radius: 1.9, model: 'magmaw', color: 0xff5a1a, relic: 'wyrm_scale',
    phases: [
      { hp: 1, move: 'chase', speed: 2, attacks: [
        { type: 'laser', cd: 5, count: 1, telegraph: 1.0, duration: 2, sweep: 70, width: 1.4, length: 12, aim: 1 },
        { type: 'meteor', cd: 6, count: 10, radius: 2.2, telegraph: 1.3, spread: 9 },
        { type: 'teleport', cd: 8, burrow: 1 },
      ] },
      { hp: 0.6, move: 'chase', speed: 2.4, onEnter: [{ type: 'summon', cd: 0, enemy: 'lava_salamander', count: 4 }], attacks: [
        { type: 'laser', cd: 4, count: 2, telegraph: 0.9, duration: 2.2, sweep: 80, width: 1.4, length: 13, aim: 1 },
        { type: 'ring', cd: 3.5, count: 24, speed: 6, waves: 2, waveDelay: 0.3, rotate: 7 },
        { type: 'teleport', cd: 6, burrow: 1 },
        { type: 'meteor', cd: 5, count: 14, radius: 2.2, telegraph: 1.1, spread: 10 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.8, attacks: [
        { type: 'spiral', cd: 5, arms: 6, speed: 6.5, duration: 3.5, rate: 11, turn: 110 },
        { type: 'meteor', cd: 3.5, count: 18, radius: 2.2, telegraph: 1.0, spread: 11 },
        { type: 'teleport', cd: 5, burrow: 1 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Frostveil
  {
    id: 'frostfang', name: { ru: 'Морозный Клык', en: 'Frostfang' }, title: { ru: 'Йети вечной метели', en: 'Yeti of the Endless Blizzard' },
    hp: 8500, damage: 24, radius: 1.7, model: 'frostfang', color: 0xe6f4ff, relic: 'yeti_pelt',
    phases: [
      { hp: 1, move: 'chase', speed: 2.2, attacks: [
        { type: 'dash', cd: 4, speed: 15, telegraph: 0.7, count: 2 },
        { type: 'slam', cd: 5, radius: 10, speed: 7, width: 1.2 },
        { type: 'aimed', cd: 3, count: 5, spread: 45, speed: 9, bursts: 2, burstDelay: 0.3, slow: 1 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.6, onEnter: [{ type: 'summon', cd: 0, enemy: 'snow_wolf', count: 8 }], attacks: [
        { type: 'dash', cd: 3, speed: 17, telegraph: 0.55, count: 3 },
        { type: 'slam', cd: 4, radius: 12, speed: 8, width: 1.2, waves: 2 },
        { type: 'zones', cd: 4, count: 7, radius: 1.8, telegraph: 1.0, spread: 5 },
      ] },
    ],
  },
  {
    id: 'glacial_matriarch', name: { ru: 'Ледяная Матриарх', en: 'Glacial Matriarch' }, title: { ru: 'Королева белой тишины', en: 'Queen of White Silence' },
    hp: 25000, damage: 28, radius: 1.6, model: 'glacial_matriarch', color: 0x9fe6ff, relic: 'frozen_tear', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.2, attacks: [
        { type: 'spiral', cd: 5, arms: 5, speed: 5.5, duration: 3, rate: 9, turn: 80, slow: 1 },
        { type: 'zones', cd: 4, count: 8, radius: 1.8, telegraph: 1.1, spread: 6, freeze: 1 },
        { type: 'teleport', cd: 7 },
      ] },
      { hp: 0.6, move: 'keep', speed: 2.5, onEnter: [{ type: 'split', cd: 0, count: 2, hpFrac: 0.12 }], attacks: [
        { type: 'laser', cd: 4.5, count: 3, telegraph: 1.0, duration: 2.5, sweep: 50, width: 0.9, length: 15 },
        { type: 'ring', cd: 3, count: 20, speed: 6, waves: 3, waveDelay: 0.35, rotate: 9, slow: 1 },
        { type: 'summon', cd: 8, enemy: 'frost_mage', count: 3 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.6, onEnter: [{ type: 'pull', cd: 0, strength: 3, duration: 3 }], attacks: [
        { type: 'spiral', cd: 4, arms: 8, speed: 6, duration: 3, rate: 10, turn: -90, slow: 1 },
        { type: 'zones', cd: 3, count: 10, radius: 1.8, telegraph: 0.9, spread: 7, freeze: 1 },
        { type: 'pull', cd: 8, strength: 2.5, duration: 2 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Aetherfall Ruins
  {
    id: 'clockwork_sentinel', name: { ru: 'Заводной часовой', en: 'Clockwork Sentinel' }, title: { ru: 'Последний механизм', en: 'The Last Mechanism' },
    hp: 10000, damage: 26, radius: 1.6, model: 'clockwork_sentinel', color: 0xc9a050, relic: 'mainspring',
    phases: [
      { hp: 1, move: 'stationary', speed: 0, attacks: [
        { type: 'laser', cd: 4, count: 4, telegraph: 1.0, duration: 3, sweep: 45, width: 0.8, length: 16 },
        { type: 'aimed', cd: 2.5, count: 3, spread: 15, speed: 11, bursts: 3, burstDelay: 0.2 },
        { type: 'summon', cd: 7, enemy: 'gear_spider', count: 8 },
      ] },
      { hp: 0.5, move: 'wander', speed: 2.2, onEnter: [{ type: 'summon', cd: 0, enemy: 'rune_drone', count: 6 }], attacks: [
        { type: 'laser', cd: 3.5, count: 6, telegraph: 0.9, duration: 3, sweep: -50, width: 0.8, length: 16 },
        { type: 'ring', cd: 3, count: 24, speed: 6.5, waves: 2, waveDelay: 0.3, rotate: 7 },
        { type: 'teleport', cd: 6 },
      ] },
    ],
  },
  {
    id: 'hollow_sovereign', name: { ru: 'Полый Властелин', en: 'Hollow Sovereign' }, title: { ru: 'Тот, кто погасил свет', en: 'The One Who Dimmed the Light' },
    hp: 32000, damage: 30, radius: 1.7, model: 'hollow_sovereign', color: 0x7a3dff, relic: 'hollow_crown', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.4, attacks: [
        { type: 'spiral', cd: 5, arms: 5, speed: 6, duration: 3, rate: 10, turn: 70 },
        { type: 'teleport', cd: 6 },
        { type: 'aimed', cd: 3, count: 5, spread: 30, speed: 10, bursts: 3, burstDelay: 0.25 },
      ] },
      { hp: 0.75, move: 'stationary', speed: 0, onEnter: [{ type: 'shield', cd: 0, count: 5, enemy: 'shield_crystal' }], attacks: [
        { type: 'laser', cd: 4, count: 5, telegraph: 1.0, duration: 3, sweep: 50, width: 0.8, length: 18 },
        { type: 'meteor', cd: 4, count: 12, radius: 2, telegraph: 1.1, spread: 10 },
      ] },
      { hp: 0.5, move: 'keep', speed: 2.8, onEnter: [{ type: 'summon', cd: 0, enemy: 'phantom', count: 10 }], attacks: [
        { type: 'pull', cd: 9, strength: 3, duration: 2.5 },
        { type: 'slam', cd: 4, radius: 13, speed: 9, width: 1.2, waves: 3 },
        { type: 'spiral', cd: 4.5, arms: 7, speed: 6.5, duration: 3, rate: 10, turn: -100 },
        { type: 'teleport', cd: 5 },
      ] },
      { hp: 0.2, move: 'chase', speed: 3, onEnter: [{ type: 'split', cd: 0, count: 2, hpFrac: 0.08 }, { type: 'darkness', cd: 0, duration: 999 }], attacks: [
        { type: 'laser', cd: 3.5, count: 6, telegraph: 0.8, duration: 3, sweep: 70, width: 0.9, length: 18 },
        { type: 'ring', cd: 2.5, count: 28, speed: 7, waves: 3, waveDelay: 0.3, rotate: 6 },
        { type: 'zones', cd: 3, count: 10, radius: 1.8, telegraph: 0.9, spread: 6 },
      ] },
    ],
  },
];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

/** Relics: permanent trophies granted the first time a boss is defeated. */
export const RELICS: RelicDef[] = [
  { id: 'spore_sac', name: { ru: 'Споровый мешок', en: 'Spore Sac' }, desc: { ru: '+0.2 HP/сек', en: '+0.2 HP/s' }, stats: { regen: 0.2 }, color: 0xc05ad6 },
  { id: 'heartwood', name: { ru: 'Сердцевина', en: 'Heartwood' }, desc: { ru: '+15 к макс. здоровью', en: '+15 max HP' }, stats: { maxHp: 15 }, color: 0x6b8f3a },
  { id: 'gutter_crown', name: { ru: 'Корона канав', en: 'Gutter Crown' }, desc: { ru: '+10% золота', en: '+10% gold' }, stats: { greed: 0.1 }, color: 0x8a7a6a },
  { id: 'silent_bell', name: { ru: 'Безмолвный колокол', en: 'Silent Bell' }, desc: { ru: '−4% перезарядки', en: '−4% cooldown' }, stats: { cooldown: 0.04 }, color: 0x6a6f86 },
  { id: 'colossus_marrow', name: { ru: 'Мозг колосса', en: 'Colossus Marrow' }, desc: { ru: '+1 броня', en: '+1 armor' }, stats: { armor: 1 }, color: 0xe6dcc0 },
  { id: 'phylactery', name: { ru: 'Филактерия', en: 'Phylactery' }, desc: { ru: '+1 воскрешение', en: '+1 revival' }, stats: { revival: 1 }, color: 0x5affc8 },
  { id: 'forge_heart', name: { ru: 'Сердце горна', en: 'Forge Heart' }, desc: { ru: '+6% урона', en: '+6% damage' }, stats: { might: 0.06 }, color: 0xff7a3a },
  { id: 'wyrm_scale', name: { ru: 'Чешуя червя', en: 'Wyrm Scale' }, desc: { ru: '+8% площади', en: '+8% area' }, stats: { area: 0.08 }, color: 0xff5a1a },
  { id: 'yeti_pelt', name: { ru: 'Шкура йети', en: 'Yeti Pelt' }, desc: { ru: '+6% скорости', en: '+6% speed' }, stats: { moveSpeed: 0.06 }, color: 0xe6f4ff },
  { id: 'frozen_tear', name: { ru: 'Застывшая слеза', en: 'Frozen Tear' }, desc: { ru: '+10% длительности', en: '+10% duration' }, stats: { duration: 0.1 }, color: 0x9fe6ff },
  { id: 'mainspring', name: { ru: 'Главная пружина', en: 'Mainspring' }, desc: { ru: '+10% скорости снарядов, +5% крита', en: '+10% proj. speed, +5% crit' }, stats: { projSpeed: 0.1, critChance: 0.05 }, color: 0xc9a050 },
  { id: 'hollow_crown', name: { ru: 'Полая корона', en: 'Hollow Crown' }, desc: { ru: '+1 снаряд', en: '+1 projectile' }, stats: { amount: 1 }, color: 0x7a3dff },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
