import type { AchievementDef } from './types';

/**
 * Achievements are checked against lifetime stats (see meta/Stats). `cond.stat` names a stat key,
 * `cond.value` the threshold. Rewards unlock content.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // kills
  { id: 'kills_100', name: { ru: 'Первая кровь', en: 'First Blood' }, desc: { ru: 'Убейте 100 врагов', en: 'Defeat 100 enemies' }, cond: { stat: 'kills', value: 100 }, gold: 5 },
  { id: 'kills_1000', name: { ru: 'Истребитель', en: 'Exterminator' }, desc: { ru: 'Убейте 1 000 врагов', en: 'Defeat 1,000 enemies' }, cond: { stat: 'kills', value: 1000 }, reward: { kind: 'weapon', id: 'sky_lance' } },
  { id: 'kills_5000', name: { ru: 'Жнец', en: 'Reaper' }, desc: { ru: 'Убейте 5 000 врагов', en: 'Defeat 5,000 enemies' }, cond: { stat: 'kills', value: 5000 }, reward: { kind: 'weapon', id: 'rune_traps' } },
  { id: 'kills_10000', name: { ru: 'Буря клинков', en: 'Bladestorm' }, desc: { ru: 'Убейте 10 000 врагов', en: 'Defeat 10,000 enemies' }, cond: { stat: 'kills', value: 10000 }, reward: { kind: 'hero', id: 'vex' } },
  { id: 'kills_50000', name: { ru: 'Легенда резни', en: 'Legend of Carnage' }, desc: { ru: 'Убейте 50 000 врагов', en: 'Defeat 50,000 enemies' }, cond: { stat: 'kills', value: 50000 }, gold: 200 },
  { id: 'run_kills_1500', name: { ru: 'Мясорубка', en: 'Meatgrinder' }, desc: { ru: 'Убейте 1 500 врагов за забег', en: 'Defeat 1,500 enemies in one run' }, cond: { stat: 'bestRunKills', value: 1500 }, gold: 30 },
  // survival
  { id: 'survive_5', name: { ru: 'Выживший', en: 'Survivor' }, desc: { ru: 'Продержитесь 5 минут', en: 'Survive 5 minutes' }, cond: { stat: 'bestTime', value: 300 }, reward: { kind: 'weapon', id: 'cyclone_fan' } },
  { id: 'survive_10', name: { ru: 'Несгибаемый', en: 'Unbending' }, desc: { ru: 'Продержитесь 10 минут', en: 'Survive 10 minutes' }, cond: { stat: 'bestTime', value: 600 }, reward: { kind: 'hero', id: 'aurelia' } },
  { id: 'survive_15', name: { ru: 'Рассвет', en: 'Dawnbringer' }, desc: { ru: 'Продержитесь 15 минут', en: 'Survive 15 minutes' }, cond: { stat: 'bestTime', value: 900 }, gold: 50 },
  // levels
  { id: 'level_20', name: { ru: 'Ученик', en: 'Apprentice' }, desc: { ru: 'Достигните 20 уровня', en: 'Reach level 20' }, cond: { stat: 'bestLevel', value: 20 }, reward: { kind: 'weapon', id: 'guardian_wisps' } },
  { id: 'level_40', name: { ru: 'Мастер', en: 'Master' }, desc: { ru: 'Достигните 40 уровня', en: 'Reach level 40' }, cond: { stat: 'bestLevel', value: 40 }, reward: { kind: 'hero', id: 'tink' } },
  { id: 'level_70', name: { ru: 'Грандмастер', en: 'Grandmaster' }, desc: { ru: 'Достигните 70 уровня', en: 'Reach level 70' }, cond: { stat: 'bestLevel', value: 70 }, gold: 100 },
  // bosses
  { id: 'boss_first', name: { ru: 'Победитель чудовищ', en: 'Monster Slayer' }, desc: { ru: 'Победите любого босса', en: 'Defeat any boss' }, cond: { stat: 'bossKills', value: 1 }, reward: { kind: 'weapon', id: 'prism_ray' } },
  { id: 'boss_10', name: { ru: 'Охотник на боссов', en: 'Boss Hunter' }, desc: { ru: 'Победите 10 боссов', en: 'Defeat 10 bosses' }, cond: { stat: 'bossKills', value: 10 }, gold: 80 },
  { id: 'boss_rotroot', name: { ru: 'Лесоруб', en: 'Woodcutter' }, desc: { ru: 'Победите Гнилокорня', en: 'Defeat Rotroot' }, cond: { stat: 'boss_rotroot', value: 1 }, reward: { kind: 'map', id: 'gloamhaven' } },
  { id: 'boss_bellwarden', name: { ru: 'Тишина', en: 'Silence' }, desc: { ru: 'Победите Колоколоносца', en: 'Defeat the Bellwarden' }, cond: { stat: 'boss_bellwarden', value: 1 }, reward: { kind: 'map', id: 'ossuary' } },
  { id: 'boss_lich', name: { ru: 'Разбитая филактерия', en: 'Broken Phylactery' }, desc: { ru: 'Победите Лича Вхароса', en: 'Defeat Lich Vharos' }, cond: { stat: 'boss_lich_vharos', value: 1 }, reward: { kind: 'map', id: 'emberwaste' } },
  { id: 'boss_magmaw', name: { ru: 'Укротитель пламени', en: 'Flametamer' }, desc: { ru: 'Победите Магмоглота', en: 'Defeat Magmaw' }, cond: { stat: 'boss_magmaw', value: 1 }, reward: { kind: 'map', id: 'frostveil' } },
  { id: 'boss_matriarch', name: { ru: 'Оттепель', en: 'Thaw' }, desc: { ru: 'Победите Ледяную Матриарх', en: 'Defeat the Glacial Matriarch' }, cond: { stat: 'boss_glacial_matriarch', value: 1 }, reward: { kind: 'map', id: 'aetherfall' } },
  { id: 'boss_sovereign', name: { ru: 'Последний свет', en: 'Last Light' }, desc: { ru: 'Победите Полого Властелина', en: 'Defeat the Hollow Sovereign' }, cond: { stat: 'boss_hollow_sovereign', value: 1 }, gold: 300 },
  { id: 'midboss_any', name: { ru: 'Разминка', en: 'Warm-up' }, desc: { ru: 'Победите Мать спор', en: 'Defeat the Spore Mother' }, cond: { stat: 'boss_spore_mother', value: 1 }, reward: { kind: 'weapon', id: 'starfall_tome' } },
  // weapons & builds
  { id: 'max_weapon', name: { ru: 'Оружейник', en: 'Weaponsmith' }, desc: { ru: 'Прокачайте оружие до максимума', en: 'Upgrade a weapon to MAX' }, cond: { stat: 'maxedWeapons', value: 1 }, reward: { kind: 'weapon', id: 'bolt_thrower' } },
  { id: 'max_weapon_4', name: { ru: 'Арсенал', en: 'Arsenal' }, desc: { ru: 'Прокачайте 4 оружия до максимума за забег', en: 'Max 4 weapons in one run' }, cond: { stat: 'maxedWeapons', value: 4 }, gold: 60 },
  { id: 'evolve_1', name: { ru: 'Эволюция', en: 'Evolution' }, desc: { ru: 'Создайте эволюцию оружия', en: 'Evolve a weapon' }, cond: { stat: 'evolutions', value: 1 }, reward: { kind: 'passive', id: 'battle_banner' } },
  { id: 'evolve_5', name: { ru: 'Алхимия войны', en: 'Alchemy of War' }, desc: { ru: 'Откройте 5 разных эволюций', en: 'Discover 5 different evolutions' }, cond: { stat: 'evolutions', value: 5 }, gold: 100 },
  { id: 'evolve_12', name: { ru: 'Коллекционер', en: 'Collector' }, desc: { ru: 'Откройте 12 разных эволюций', en: 'Discover 12 different evolutions' }, cond: { stat: 'evolutions', value: 12 }, gold: 250 },
  { id: 'two_evos', name: { ru: 'Двойной удар', en: 'Double Trouble' }, desc: { ru: 'Получите 2 эволюции за один забег', en: 'Own 2 evolutions in one run' }, cond: { stat: 'bestRunEvos', value: 2 }, gold: 50 },
  { id: 'full_slots', name: { ru: 'Полный набор', en: 'Full Kit' }, desc: { ru: 'Заполните все 6 слотов оружия', en: 'Fill all 6 weapon slots' }, cond: { stat: 'bestWeaponCount', value: 6 }, gold: 20 },
  // economy & misc
  { id: 'gold_1000', name: { ru: 'Копилка', en: 'Piggy Bank' }, desc: { ru: 'Соберите 1 000 золота', en: 'Collect 1,000 gold' }, cond: { stat: 'gold', value: 1000 }, gold: 10 },
  { id: 'gold_20000', name: { ru: 'Сокровищница', en: 'Treasury' }, desc: { ru: 'Соберите 20 000 золота', en: 'Collect 20,000 gold' }, cond: { stat: 'gold', value: 20000 }, gold: 150 },
  { id: 'chests_10', name: { ru: 'Кладоискатель', en: 'Treasure Hunter' }, desc: { ru: 'Откройте 10 сундуков', en: 'Open 10 chests' }, cond: { stat: 'chests', value: 10 }, gold: 20 },
  { id: 'elites_25', name: { ru: 'Гроза элиты', en: 'Elite Breaker' }, desc: { ru: 'Убейте 25 элитных врагов', en: 'Defeat 25 elite enemies' }, cond: { stat: 'elites', value: 25 }, gold: 30 },
  { id: 'runs_10', name: { ru: 'Упорство', en: 'Persistence' }, desc: { ru: 'Сыграйте 10 забегов', en: 'Play 10 runs' }, cond: { stat: 'runs', value: 10 }, gold: 30 },
  { id: 'treasure', name: { ru: 'Поймал!', en: 'Gotcha!' }, desc: { ru: 'Поймайте кладовика', en: 'Catch a Treasure Sprite' }, cond: { stat: 'treasureSprites', value: 1 }, gold: 15 },
  // heroes & difficulty
  { id: 'win_bram', name: { ru: 'Несокрушимый', en: 'Unbreakable' }, desc: { ru: 'Победите на любой карте за Брама', en: 'Win any map as Bram' }, cond: { stat: 'herowin_bram', value: 1 }, gold: 30 },
  { id: 'win_lyra', name: { ru: 'Пламя не гаснет', en: 'Undying Flame' }, desc: { ru: 'Победите на любой карте за Лиру', en: 'Win any map as Lyra' }, cond: { stat: 'herowin_lyra', value: 1 }, gold: 30 },
  { id: 'win_shen', name: { ru: 'Ветер побеждает', en: 'Wind Prevails' }, desc: { ru: 'Победите на любой карте за Шена', en: 'Win any map as Shen' }, cond: { stat: 'herowin_shen', value: 1 }, gold: 30 },
  { id: 'heroes_4', name: { ru: 'Отряд', en: 'The Party' }, desc: { ru: 'Победите 4 разными героями', en: 'Win with 4 different heroes' }, cond: { stat: 'heroWins', value: 4 }, gold: 120 },
  { id: 'win_hard', name: { ru: 'Испытание', en: 'Trial' }, desc: { ru: 'Победите на сложности «Сложная»', en: 'Win on Hard difficulty' }, cond: { stat: 'diffwin_hard', value: 1 }, gold: 80 },
  { id: 'win_nightmare', name: { ru: 'Кошмар наяву', en: 'Waking Nightmare' }, desc: { ru: 'Победите на сложности «Кошмар»', en: 'Win on Nightmare difficulty' }, cond: { stat: 'diffwin_nightmare', value: 1 }, gold: 150 },
  { id: 'win_inferno', name: { ru: 'Сквозь пекло', en: 'Through the Inferno' }, desc: { ru: 'Победите на сложности «Инферно»', en: 'Win on Inferno difficulty' }, cond: { stat: 'diffwin_inferno', value: 1 }, gold: 400 },
  { id: 'all_maps', name: { ru: 'Покоритель миров', en: 'World Conqueror' }, desc: { ru: 'Пройдите все 6 карт', en: 'Clear all 6 maps' }, cond: { stat: 'mapsCleared', value: 6 }, gold: 500 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
