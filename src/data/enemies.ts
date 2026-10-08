import type { EnemyDef } from './types';

type E = Omit<EnemyDef, 'model' | 'kbResist' | 'size' | 'radius'> & Partial<Pick<EnemyDef, 'model' | 'kbResist' | 'size' | 'radius'>>;

function def(e: E): EnemyDef {
  return { model: e.id, kbResist: 0, size: 1, radius: 0.45, ...e };
}

/**
 * Enemy catalogue. Stats are base values for map tier 1 at minute 0; the spawner scales
 * HP and damage with map tier, run time and difficulty.
 */
export const ENEMIES: EnemyDef[] = [
  // ---------------------------------------------------------------- Blightwood
  def({ id: 'rot_zombie', name: { ru: 'Гнилой зомби', en: 'Rot Zombie' }, category: 'normal', behavior: 'chase', hp: 11, damage: 7, speed: 2.1, xp: 1 }),
  def({ id: 'sporeling', name: { ru: 'Спороносец', en: 'Sporeling' }, category: 'normal', behavior: 'chase', hp: 6, damage: 5, speed: 2.7, xp: 1, size: 0.8, radius: 0.35 }),
  def({ id: 'blight_wolf', name: { ru: 'Чумной волк', en: 'Blight Wolf' }, category: 'fast', behavior: 'chase', hp: 9, damage: 7, speed: 4.4, xp: 2, radius: 0.5 }),
  def({ id: 'thorn_beetle', name: { ru: 'Шипастый жук', en: 'Thorn Beetle' }, category: 'tank', behavior: 'chase', hp: 70, damage: 11, speed: 1.5, xp: 6, size: 1.3, radius: 0.75, kbResist: 0.7 }),
  def({ id: 'spore_spitter', name: { ru: 'Плевун', en: 'Spore Spitter' }, category: 'ranged', behavior: 'ranged', hp: 14, damage: 6, speed: 2.0, xp: 3, p: { range: 7, fireCd: 2.8, bulletSpeed: 6, bullets: 1 } }),
  def({ id: 'dusk_moth', name: { ru: 'Сумеречная моль', en: 'Dusk Moth' }, category: 'flying', behavior: 'flyer', hp: 7, damage: 5, speed: 3.4, xp: 1, flying: true, radius: 0.4 }),
  def({ id: 'bloat_toad', name: { ru: 'Раздутая жаба', en: 'Bloat Toad' }, category: 'exploder', behavior: 'exploder', hp: 16, damage: 16, speed: 2.6, xp: 3, size: 1.1, p: { fuse: 0.9, blast: 2.2, trigger: 1.8 } }),
  def({ id: 'sapling_shaman', name: { ru: 'Шаман-росток', en: 'Sapling Shaman' }, category: 'summoner', behavior: 'summoner', hp: 45, damage: 6, speed: 1.6, xp: 8, size: 1.2, radius: 0.6, kbResist: 0.4, p: { summon: 'sporeling', count: 4, cd: 6, range: 8 } }),
  // ---------------------------------------------------------------- Gloamhaven
  def({ id: 'ghoul', name: { ru: 'Упырь', en: 'Ghoul' }, category: 'normal', behavior: 'chase', hp: 13, damage: 8, speed: 2.4, xp: 1 }),
  def({ id: 'plague_rat', name: { ru: 'Чумная крыса', en: 'Plague Rat' }, category: 'fast', behavior: 'chase', hp: 5, damage: 5, speed: 4.6, xp: 1, size: 0.8, radius: 0.35 }),
  def({ id: 'crypt_bat', name: { ru: 'Склепная мышь', en: 'Crypt Bat' }, category: 'flying', behavior: 'flyer', hp: 7, damage: 6, speed: 3.8, xp: 1, flying: true, radius: 0.4 }),
  def({ id: 'iron_husk', name: { ru: 'Железная оболочка', en: 'Iron Husk' }, category: 'tank', behavior: 'chase', hp: 86, damage: 13, speed: 1.6, xp: 7, size: 1.35, radius: 0.75, kbResist: 0.8 }),
  def({ id: 'cult_archer', name: { ru: 'Культист-лучник', en: 'Cult Archer' }, category: 'ranged', behavior: 'ranged', hp: 14, damage: 8, speed: 2.2, xp: 3, p: { range: 8, fireCd: 2.4, bulletSpeed: 7.5, bullets: 1 } }),
  def({ id: 'powder_imp', name: { ru: 'Пороховой бес', en: 'Powder Imp' }, category: 'exploder', behavior: 'exploder', hp: 11, damage: 20, speed: 3.6, xp: 3, size: 0.85, p: { fuse: 0.7, blast: 2.4, trigger: 1.6 } }),
  def({ id: 'bell_cultist', name: { ru: 'Звонарь культа', en: 'Bell Cultist' }, category: 'summoner', behavior: 'summoner', hp: 50, damage: 7, speed: 1.7, xp: 9, size: 1.15, radius: 0.55, kbResist: 0.4, p: { summon: 'ghoul', count: 3, cd: 6, range: 9, role: 'support' } }),
  def({ id: 'gargoyle', name: { ru: 'Горгулья', en: 'Gargoyle' }, category: 'special', behavior: 'charger', hp: 36, damage: 14, speed: 2.2, xp: 5, flying: true, size: 1.15, radius: 0.6, kbResist: 0.5, p: { chargeCd: 4, chargeSpeed: 12, trigger: 8, windup: 0.6 } }),
  // ---------------------------------------------------------------- Ossuary Depths
  def({ id: 'skeleton', name: { ru: 'Скелет', en: 'Skeleton' }, category: 'normal', behavior: 'chase', hp: 14, damage: 9, speed: 2.4, xp: 1 }),
  def({ id: 'bone_archer', name: { ru: 'Костяной лучник', en: 'Bone Archer' }, category: 'ranged', behavior: 'ranged', hp: 15, damage: 9, speed: 2.2, xp: 3, p: { range: 8, fireCd: 2.2, bulletSpeed: 8, bullets: 1 } }),
  def({ id: 'wraith', name: { ru: 'Призрак', en: 'Wraith' }, category: 'special', behavior: 'teleporter', hp: 22, damage: 10, speed: 2.6, xp: 4, flying: true, p: { tpCd: 4.5, tpDist: 3.5 } }),
  def({ id: 'bone_hound', name: { ru: 'Костяная гончая', en: 'Bone Hound' }, category: 'fast', behavior: 'chase', hp: 10, damage: 8, speed: 4.8, xp: 2, radius: 0.5 }),
  def({ id: 'crypt_golem', name: { ru: 'Склепный голем', en: 'Crypt Golem' }, category: 'tank', behavior: 'chase', hp: 110, damage: 15, speed: 1.4, xp: 9, size: 1.5, radius: 0.85, kbResist: 0.85 }),
  def({ id: 'necro_acolyte', name: { ru: 'Аколит смерти', en: 'Death Acolyte' }, category: 'summoner', behavior: 'summoner', hp: 51, damage: 8, speed: 1.8, xp: 10, size: 1.1, radius: 0.55, kbResist: 0.3, p: { summon: 'skeleton', count: 3, cd: 5.5, range: 9 } }),
  // ---------------------------------------------------------------- Emberwaste
  def({ id: 'magma_slime', name: { ru: 'Магмовый слизень', en: 'Magma Slime' }, category: 'normal', behavior: 'splitter', hp: 20, damage: 10, speed: 2.0, xp: 2, size: 1.2, radius: 0.6, splitInto: 'magma_slimelet', p: { split: 3 } }),
  def({ id: 'magma_slimelet', name: { ru: 'Магмовая капля', en: 'Magma Droplet' }, category: 'normal', behavior: 'chase', hp: 6, damage: 6, speed: 3.0, xp: 1, size: 0.6, radius: 0.3 }),
  def({ id: 'fire_imp', name: { ru: 'Огненный бес', en: 'Fire Imp' }, category: 'ranged', behavior: 'ranged', hp: 15, damage: 10, speed: 3.0, xp: 3, p: { range: 7, fireCd: 2.0, bulletSpeed: 8, bullets: 3, spread: 30 } }),
  def({ id: 'cinder_hound', name: { ru: 'Пепельная гончая', en: 'Cinder Hound' }, category: 'fast', behavior: 'chase', hp: 12, damage: 10, speed: 5.0, xp: 2, radius: 0.5 }),
  def({ id: 'obsidian_brute', name: { ru: 'Обсидиановый громила', en: 'Obsidian Brute' }, category: 'tank', behavior: 'chase', hp: 128, damage: 17, speed: 1.5, xp: 10, size: 1.55, radius: 0.85, kbResist: 0.85 }),
  def({ id: 'ember_wisp', name: { ru: 'Тлеющий огонёк', en: 'Ember Wisp' }, category: 'exploder', behavior: 'exploder', hp: 10, damage: 21, speed: 3.8, xp: 3, flying: true, size: 0.8, p: { fuse: 0.6, blast: 2.2, trigger: 1.5 } }),
  def({ id: 'lava_salamander', name: { ru: 'Лавовая саламандра', en: 'Lava Salamander' }, category: 'special', behavior: 'charger', hp: 41, damage: 15, speed: 2.3, xp: 6, size: 1.2, radius: 0.6, kbResist: 0.5, p: { chargeCd: 3.5, chargeSpeed: 13, trigger: 8, windup: 0.55 } }),
  // ---------------------------------------------------------------- Frostveil
  def({ id: 'frost_walker', name: { ru: 'Ледяной ходок', en: 'Frost Walker' }, category: 'normal', behavior: 'chase', hp: 16, damage: 10, speed: 2.3, xp: 1 }),
  def({ id: 'snow_wolf', name: { ru: 'Снежный волк', en: 'Snow Wolf' }, category: 'fast', behavior: 'chase', hp: 14, damage: 10, speed: 5.0, xp: 2, radius: 0.5 }),
  def({ id: 'ice_golem', name: { ru: 'Ледяной голем', en: 'Ice Golem' }, category: 'tank', behavior: 'chase', hp: 150, damage: 19, speed: 1.4, xp: 11, size: 1.6, radius: 0.9, kbResist: 0.9 }),
  def({ id: 'frost_mage', name: { ru: 'Морозный маг', en: 'Frost Mage' }, category: 'ranged', behavior: 'ranged', hp: 18, damage: 10, speed: 2.2, xp: 4, p: { range: 8, fireCd: 2.6, bulletSpeed: 7, bullets: 5, spread: 50, slow: 1 } }),
  def({ id: 'tusk_calf', name: { ru: 'Бивнерог', en: 'Tusk Calf' }, category: 'special', behavior: 'charger', hp: 52, damage: 17, speed: 2.0, xp: 7, size: 1.35, radius: 0.7, kbResist: 0.7, p: { chargeCd: 4, chargeSpeed: 12, trigger: 9, windup: 0.7 } }),
  def({ id: 'snow_slime', name: { ru: 'Снежный слизень', en: 'Snow Slime' }, category: 'normal', behavior: 'splitter', hp: 24, damage: 10, speed: 2.0, xp: 2, size: 1.2, radius: 0.6, splitInto: 'snow_slimelet', p: { split: 3 } }),
  def({ id: 'snow_slimelet', name: { ru: 'Снежок', en: 'Snowball' }, category: 'normal', behavior: 'chase', hp: 8, damage: 7, speed: 3.0, xp: 1, size: 0.6, radius: 0.3 }),
  def({ id: 'frost_bat', name: { ru: 'Инеевая мышь', en: 'Rime Bat' }, category: 'flying', behavior: 'flyer', hp: 9, damage: 8, speed: 4.0, xp: 1, flying: true, radius: 0.4 }),
  // ---------------------------------------------------------------- Aetherfall Ruins
  def({ id: 'ruin_guard', name: { ru: 'Древний страж', en: 'Ancient Guard' }, category: 'normal', behavior: 'chase', hp: 19, damage: 11, speed: 2.4, xp: 1 }),
  def({ id: 'gear_spider', name: { ru: 'Заводной паук', en: 'Gear Spider' }, category: 'fast', behavior: 'chase', hp: 14, damage: 10, speed: 5.2, xp: 2, radius: 0.5 }),
  def({ id: 'stone_sentinel', name: { ru: 'Каменный часовой', en: 'Stone Sentinel' }, category: 'tank', behavior: 'chase', hp: 163, damage: 21, speed: 1.4, xp: 12, size: 1.6, radius: 0.9, kbResist: 0.9 }),
  def({ id: 'void_eye', name: { ru: 'Око пустоты', en: 'Void Eye' }, category: 'ranged', behavior: 'ranged', hp: 18, damage: 11, speed: 2.4, xp: 4, flying: true, p: { range: 9, fireCd: 2.2, bulletSpeed: 8, bullets: 2, spread: 16 } }),
  def({ id: 'phantom', name: { ru: 'Фантом', en: 'Phantom' }, category: 'special', behavior: 'teleporter', hp: 24, damage: 12, speed: 2.8, xp: 4, flying: true, p: { tpCd: 3.5, tpDist: 3 } }),
  def({ id: 'rune_drone', name: { ru: 'Рунный дрон', en: 'Rune Drone' }, category: 'flying', behavior: 'orbiter', hp: 20, damage: 11, speed: 3.6, xp: 3, flying: true, p: { orbit: 6, diveCd: 4 } }),
  def({ id: 'arcane_bomber', name: { ru: 'Тайный подрывник', en: 'Arcane Bomber' }, category: 'exploder', behavior: 'exploder', hp: 15, damage: 24, speed: 3.4, xp: 3, p: { fuse: 0.7, blast: 2.6, trigger: 1.7 } }),
  // ---------------------------------------------------------------- shared / special
  def({ id: 'shield_crystal', name: { ru: 'Кристалл-щит', en: 'Ward Crystal' }, category: 'special', behavior: 'prop', hp: 120, damage: 0, speed: 0, xp: 5, size: 1.2, radius: 0.7, kbResist: 1 }),
  def({ id: 'treasure_sprite', name: { ru: 'Кладовик', en: 'Treasure Sprite' }, category: 'special', behavior: 'chase', hp: 60, damage: 0, speed: 3.6, xp: 10, size: 0.9, kbResist: 0.5, p: { flee: 1 } }),
  def({ id: 'crate', name: { ru: 'Ящик', en: 'Crate' }, category: 'prop', behavior: 'prop', hp: 8, damage: 0, speed: 0, xp: 0, size: 1, radius: 0.5, kbResist: 1 }),
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** Elite modifiers: applied to random enemies from minute 3. */
export const ELITE_MODS = {
  swift: { name: { ru: 'Стремительный', en: 'Swift' }, color: 0x5affd0, hp: 2.5, speed: 1.5, damage: 1.2 },
  armored: { name: { ru: 'Бронированный', en: 'Armored' }, color: 0xb0c4de, hp: 5, speed: 0.9, damage: 1.2 },
  vampiric: { name: { ru: 'Вампирический', en: 'Vampiric' }, color: 0xff3355, hp: 3.5, speed: 1.1, damage: 1.4 },
  splitting: { name: { ru: 'Делящийся', en: 'Splitting' }, color: 0xb6ff4a, hp: 3, speed: 1, damage: 1.2 },
  volatile: { name: { ru: 'Взрывной', en: 'Volatile' }, color: 0xff8a2a, hp: 3, speed: 1.15, damage: 1.3 },
  warded: { name: { ru: 'Защищённый', en: 'Warded' }, color: 0x9a7aff, hp: 3, speed: 1, damage: 1.2 },
  frenzied: { name: { ru: 'Неистовый', en: 'Frenzied' }, color: 0xff5a1a, hp: 3, speed: 1.3, damage: 1.6 },
} as const;
export type EliteId = keyof typeof ELITE_MODS;
export const ELITE_IDS = Object.keys(ELITE_MODS) as EliteId[];
