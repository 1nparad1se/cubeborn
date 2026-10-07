import type { AchievementCategory, AchievementDef, AchievementRarity } from './types';

type Raw = Omit<AchievementDef, 'category' | 'rarity' | 'icon' | 'color'>;

/**
 * Achievements are checked against lifetime stats (see meta/Stats). `cond.stat` names a stat key,
 * `cond.value` the threshold. Rewards unlock content.
 */
const RAW: Raw[] = [
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
  // ---- v2.2
  // progress
  { id: 'level_10', name: { ru: 'Первые шаги', en: 'First Steps' }, desc: { ru: 'Достигните 10 уровня', en: 'Reach level 10' }, cond: { stat: 'bestLevel', value: 10 }, gold: 25 },
  { id: 'runs_50', name: { ru: 'Ветеран', en: 'Veteran' }, desc: { ru: 'Сыграйте 50 забегов', en: 'Play 50 runs' }, cond: { stat: 'runs', value: 50 }, gold: 250 },
  { id: 'heroes_all', name: { ru: 'Все в строю', en: 'Full Roster' }, desc: { ru: 'Сыграйте забег каждым из 9 героев', en: 'Play a run with each of the 9 heroes' }, cond: { stat: 'heroesPlayed', value: 9 }, gold: 400 },
  { id: 'ach_25', name: { ru: 'Охотник за трофеями', en: 'Trophy Hunter' }, desc: { ru: 'Получите 25 достижений', en: 'Earn 25 achievements' }, cond: { stat: 'achievementsDone', value: 25 }, gold: 300 },
  { id: 'ach_60', name: { ru: 'Живая легенда', en: 'Living Legend' }, desc: { ru: 'Получите 60 достижений', en: 'Earn 60 achievements' }, cond: { stat: 'achievementsDone', value: 60 }, gold: 1500 },
  // combat
  { id: 'crits_500', name: { ru: 'Меткий глаз', en: 'Keen Eye' }, desc: { ru: 'Нанесите 500 критических ударов', en: 'Land 500 critical hits' }, cond: { stat: 'crits', value: 500 }, gold: 40 },
  { id: 'crits_10000', name: { ru: 'Смертельная точность', en: 'Lethal Precision' }, desc: { ru: 'Нанесите 10 000 критических ударов', en: 'Land 10,000 critical hits' }, cond: { stat: 'crits', value: 10000 }, gold: 300 },
  { id: 'damage_1m', name: { ru: 'Миллион урона', en: 'A Million Hurts' }, desc: { ru: 'Нанесите 1 000 000 урона за всё время', en: 'Deal 1,000,000 damage in total' }, cond: { stat: 'damage', value: 1000000 }, gold: 500 },
  { id: 'elites_100', name: { ru: 'Палач элиты', en: 'Elite Executioner' }, desc: { ru: 'Убейте 100 элитных врагов', en: 'Defeat 100 elite enemies' }, cond: { stat: 'elites', value: 100 }, gold: 200 },
  { id: 'boss_50', name: { ru: 'Гроза владык', en: 'Bane of Lords' }, desc: { ru: 'Победите 50 боссов', en: 'Defeat 50 bosses' }, cond: { stat: 'bossKills', value: 50 }, gold: 600 },
  // weapons: kills by element
  { id: 'ek_physical', name: { ru: 'Мастер клинка', en: 'Blademaster' }, desc: { ru: 'Убейте 5 000 врагов физическим оружием', en: 'Defeat 5,000 enemies with physical weapons' }, cond: { stat: 'ek_physical', value: 5000 }, gold: 150 },
  { id: 'ek_fire', name: { ru: 'Пироман', en: 'Pyromaniac' }, desc: { ru: 'Сожгите 1 500 врагов огнём', en: 'Burn 1,500 enemies with fire' }, cond: { stat: 'ek_fire', value: 1500 }, gold: 120 },
  { id: 'ek_ice', name: { ru: 'Вечная мерзлота', en: 'Permafrost' }, desc: { ru: 'Заморозьте насмерть 1 000 врагов', en: 'Defeat 1,000 enemies with ice' }, cond: { stat: 'ek_ice', value: 1000 }, gold: 120 },
  { id: 'ek_lightning', name: { ru: 'Громовержец', en: 'Thunderer' }, desc: { ru: 'Убейте 1 500 врагов молнией', en: 'Defeat 1,500 enemies with lightning' }, cond: { stat: 'ek_lightning', value: 1500 }, gold: 120 },
  { id: 'ek_poison', name: { ru: 'Отравитель', en: 'Poisoner' }, desc: { ru: 'Отравите 1 000 врагов', en: 'Defeat 1,000 enemies with poison' }, cond: { stat: 'ek_poison', value: 1000 }, gold: 120 },
  { id: 'ek_dark', name: { ru: 'Повелитель тьмы', en: 'Lord of Shadows' }, desc: { ru: 'Убейте 1 000 врагов тёмной силой', en: 'Defeat 1,000 enemies with dark power' }, cond: { stat: 'ek_dark', value: 1000 }, gold: 120 },
  { id: 'ek_arcane', name: { ru: 'Чародей', en: 'Spellweaver' }, desc: { ru: 'Убейте 1 500 врагов чарами', en: 'Defeat 1,500 enemies with arcane magic' }, cond: { stat: 'ek_arcane', value: 1500 }, gold: 120 },
  { id: 'ek_holy', name: { ru: 'Свет во тьме', en: 'Light in the Dark' }, desc: { ru: 'Изгоните 750 врагов святым светом', en: 'Defeat 750 enemies with holy light' }, cond: { stat: 'ek_holy', value: 750 }, gold: 120 },
  { id: 'weapons_15', name: { ru: 'Знаток оружия', en: 'Armory Scholar' }, desc: { ru: 'Опробуйте 15 разных видов оружия', en: 'Try 15 different weapons' }, cond: { stat: 'weaponsFound', value: 15 }, gold: 100 },
  // exploration
  { id: 'maps_3', name: { ru: 'Путешественник', en: 'Traveler' }, desc: { ru: 'Сыграйте на 3 разных картах', en: 'Play on 3 different maps' }, cond: { stat: 'mapsPlayed', value: 3 }, gold: 60 },
  { id: 'maps_6', name: { ru: 'Картограф', en: 'Cartographer' }, desc: { ru: 'Сыграйте на всех 6 картах', en: 'Play on all 6 maps' }, cond: { stat: 'mapsPlayed', value: 6 }, gold: 250 },
  { id: 'enemies_25', name: { ru: 'Бестиарий', en: 'Bestiary' }, desc: { ru: 'Встретьте 25 видов врагов', en: 'Encounter 25 kinds of enemies' }, cond: { stat: 'enemiesSeen', value: 25 }, gold: 80 },
  { id: 'enemies_45', name: { ru: 'Натуралист', en: 'Naturalist' }, desc: { ru: 'Встретьте 45 видов врагов', en: 'Encounter 45 kinds of enemies' }, cond: { stat: 'enemiesSeen', value: 45 }, gold: 300 },
  { id: 'relics_3', name: { ru: 'Хранитель реликвий', en: 'Relic Keeper' }, desc: { ru: 'Соберите 3 реликвии боссов', en: 'Collect 3 boss relics' }, cond: { stat: 'relics', value: 3 }, gold: 150 },
  { id: 'jumps_500', name: { ru: 'Попрыгун', en: 'Hopper' }, desc: { ru: 'Прыгните 500 раз', en: 'Jump 500 times' }, cond: { stat: 'jumps', value: 500 }, gold: 50 },
  // day & night
  { id: 'night_1', name: { ru: 'Первая ночь', en: 'First Night' }, desc: { ru: 'Переживите ночь до рассвета', en: 'Survive a night until dawn' }, cond: { stat: 'nightsSurvived', value: 1 }, gold: 30 },
  { id: 'nights_10', name: { ru: 'Дитя ночи', en: 'Child of the Night' }, desc: { ru: 'Переживите 10 ночей', en: 'Survive 10 nights' }, cond: { stat: 'nightsSurvived', value: 10 }, gold: 120 },
  { id: 'nights_50', name: { ru: 'Владыка сумерек', en: 'Lord of Twilight' }, desc: { ru: 'Переживите 50 ночей', en: 'Survive 50 nights' }, cond: { stat: 'nightsSurvived', value: 50 }, gold: 500 },
  { id: 'run_nights_3', name: { ru: 'Три луны', en: 'Three Moons' }, desc: { ru: 'Переживите 3 ночи за один забег', en: 'Survive 3 nights in one run' }, cond: { stat: 'bestRunNights', value: 3 }, gold: 200 },
  { id: 'bloodmoon_1', name: { ru: 'Кровавая луна', en: 'Blood Moon' }, desc: { ru: 'Встретьте кровавую луну', en: 'Face a blood moon' }, cond: { stat: 'bloodMoons', value: 1 }, gold: 60 },
  { id: 'bloodmoon_5', name: { ru: 'Багровый страж', en: 'Crimson Warden' }, desc: { ru: 'Встретьте 5 кровавых лун', en: 'Face 5 blood moons' }, cond: { stat: 'bloodMoons', value: 5 }, gold: 250 },
  { id: 'nightboss_1', name: { ru: 'Ночной кошмар', en: 'Night Terror' }, desc: { ru: 'Победите ночного босса', en: 'Defeat a night boss' }, cond: { stat: 'nightBossKills', value: 1 }, gold: 200 },
  { id: 'night_kills_2000', name: { ru: 'Ночной охотник', en: 'Night Hunter' }, desc: { ru: 'Убейте 2 000 врагов ночью', en: 'Defeat 2,000 enemies at night' }, cond: { stat: 'nightKills', value: 2000 }, gold: 120 },
  { id: 'day_kills_5000', name: { ru: 'Под палящим солнцем', en: 'Under the Blazing Sun' }, desc: { ru: 'Убейте 5 000 врагов днём', en: 'Defeat 5,000 enemies in daylight' }, cond: { stat: 'dayKills', value: 5000 }, gold: 120 },
  { id: 'sleepers_50', name: { ru: 'Не будите спящих', en: 'Let Sleeping Stones Lie' }, desc: { ru: 'Разбейте 50 спящих статуй', en: 'Shatter 50 sleeping statues' }, cond: { stat: 'sleepersKilled', value: 50 }, gold: 80 },
  { id: 'dire_100', name: { ru: 'Укротитель зверей', en: 'Beast Tamer' }, desc: { ru: 'Убейте 100 зверей в ночном обличье', en: 'Defeat 100 beasts in their dire night form' }, cond: { stat: 'direKilled', value: 100 }, gold: 100 },
  // economy
  { id: 'gold_100k', name: { ru: 'Золотой дракон', en: 'Golden Dragon' }, desc: { ru: 'Соберите 100 000 золота', en: 'Collect 100,000 gold' }, cond: { stat: 'gold', value: 100000 }, gold: 1000 },
  { id: 'spend_10k', name: { ru: 'Инвестор', en: 'Investor' }, desc: { ru: 'Потратьте 10 000 золота на улучшения', en: 'Spend 10,000 gold on upgrades' }, cond: { stat: 'permSpent', value: 10000 }, gold: 300 },
  { id: 'perm_25', name: { ru: 'Самосовершенствование', en: 'Self-Improvement' }, desc: { ru: 'Купите 25 уровней улучшений', en: 'Buy 25 upgrade levels' }, cond: { stat: 'permLevels', value: 25 }, gold: 250 },
  { id: 'chests_100', name: { ru: 'Расхититель гробниц', en: 'Tomb Raider' }, desc: { ru: 'Откройте 100 сундуков', en: 'Open 100 chests' }, cond: { stat: 'chests', value: 100 }, gold: 200 },
  // survival
  { id: 'nohit_60', name: { ru: 'Неприкасаемый', en: 'Untouchable' }, desc: { ru: 'Продержитесь 60 секунд без урона', en: 'Go 60 seconds without taking damage' }, cond: { stat: 'bestNoHit', value: 60 }, gold: 60 },
  { id: 'nohit_180', name: { ru: 'Призрак', en: 'Ghost' }, desc: { ru: 'Продержитесь 3 минуты без урона', en: 'Go 3 minutes without taking damage' }, cond: { stat: 'bestNoHit', value: 180 }, gold: 300 },
  { id: 'survive_20', name: { ru: 'Бессмертный', en: 'Deathless' }, desc: { ru: 'Продержитесь 20 минут', en: 'Survive 20 minutes' }, cond: { stat: 'bestTime', value: 1200 }, gold: 300 },
  // endless
  { id: 'endless_1', name: { ru: 'Без конца', en: 'No End in Sight' }, desc: { ru: 'Сыграйте бесконечный забег', en: 'Play an endless run' }, cond: { stat: 'endlessRuns', value: 1 }, gold: 40 },
  { id: 'endless_w10', name: { ru: 'Десятая волна', en: 'Tenth Wave' }, desc: { ru: 'Дойдите до 10 волны в бесконечном режиме', en: 'Reach wave 10 in endless mode' }, cond: { stat: 'bestEndlessWave', value: 10 }, gold: 100 },
  { id: 'endless_w25', name: { ru: 'За гранью', en: 'Beyond the Edge' }, desc: { ru: 'Дойдите до 25 волны в бесконечном режиме', en: 'Reach wave 25 in endless mode' }, cond: { stat: 'bestEndlessWave', value: 25 }, gold: 350 },
  { id: 'endless_w50', name: { ru: 'Вечность', en: 'Eternity' }, desc: { ru: 'Дойдите до 50 волны в бесконечном режиме', en: 'Reach wave 50 in endless mode' }, cond: { stat: 'bestEndlessWave', value: 50 }, gold: 1500 },
  { id: 'endless_30m', name: { ru: 'Марафон', en: 'Marathon' }, desc: { ru: 'Продержитесь 30 минут в бесконечном режиме', en: 'Last 30 minutes in endless mode' }, cond: { stat: 'bestEndlessTime', value: 1800 }, gold: 800 },
];

type Meta = [AchievementCategory, AchievementRarity, string, number];
/** Category, rarity and icon (glyph + colour) of every achievement. */
const META: Record<string, Meta> = {
  kills_100: ['combat', 'common', 'sword', 0xd8dce4], kills_1000: ['combat', 'common', 'sword', 0xd8dce4], kills_5000: ['combat', 'rare', 'skull', 0xe8e2cc],
  kills_10000: ['combat', 'epic', 'skull', 0xff7a7a], kills_50000: ['combat', 'legendary', 'cskull', 0xff5d8f], run_kills_1500: ['combat', 'rare', 'saw', 0xff8a6a],
  survive_5: ['survival', 'common', 'hourglass', 0x9fd8ff], survive_10: ['survival', 'rare', 'hourglass', 0x9fd8ff], survive_15: ['survival', 'epic', 'hourglass', 0xffd23d],
  level_20: ['progress', 'common', 'crystal', 0x8affff], level_40: ['progress', 'rare', 'crystal', 0x8affff], level_70: ['progress', 'epic', 'crystal', 0xd08aff],
  boss_first: ['combat', 'common', 'crown', 0xffd23d], boss_10: ['combat', 'rare', 'crown', 0xffd23d], boss_rotroot: ['combat', 'rare', 'moss', 0x8ad050],
  boss_bellwarden: ['combat', 'rare', 'idol', 0xc8c0a8], boss_lich: ['combat', 'epic', 'cskull', 0x9a7aff], boss_magmaw: ['combat', 'epic', 'fireball', 0xff6a1a],
  boss_matriarch: ['combat', 'epic', 'shard', 0x8fe9ff], boss_sovereign: ['combat', 'legendary', 'crown', 0xfff1a8], midboss_any: ['combat', 'common', 'moss', 0xb8ff6a],
  max_weapon: ['weapons', 'common', 'whetstone', 0xb8c0cc], max_weapon_4: ['weapons', 'rare', 'gauntlet', 0xffc66b], evolve_1: ['weapons', 'common', 'phoenix', 0xff9a3a],
  evolve_5: ['weapons', 'rare', 'phoenix', 0xff9a3a], evolve_12: ['weapons', 'legendary', 'phoenix', 0xffd23d], two_evos: ['weapons', 'rare', 'nova', 0xffb35c],
  full_slots: ['weapons', 'common', 'quiver', 0xc9a46b], gold_1000: ['economy', 'common', 'coin', 0xffd23d], gold_20000: ['economy', 'rare', 'coin', 0xffd23d],
  chests_10: ['economy', 'common', 'chest', 0xc8964a], elites_25: ['combat', 'rare', 'fang', 0xff5470], runs_10: ['progress', 'common', 'boots', 0xc9a46b],
  treasure: ['exploration', 'common', 'clover', 0x7aff9a], win_bram: ['progress', 'rare', 'trophy', 0xffd23d], win_lyra: ['progress', 'rare', 'trophy', 0xffd23d],
  win_shen: ['progress', 'rare', 'trophy', 0xffd23d], heroes_4: ['progress', 'epic', 'banner', 0xff6a6a], win_hard: ['progress', 'rare', 'trophy', 0xffa04a],
  win_nightmare: ['progress', 'epic', 'trophy', 0xd08aff], win_inferno: ['progress', 'legendary', 'trophy', 0xff5a2a], all_maps: ['exploration', 'legendary', 'compass', 0xffd23d],
  level_10: ['progress', 'common', 'crystal', 0x8affff], runs_50: ['progress', 'epic', 'boots', 0xffc66b], heroes_all: ['progress', 'legendary', 'banner', 0xffd23d],
  ach_25: ['progress', 'epic', 'star', 0xffd23d], ach_60: ['progress', 'legendary', 'star', 0xff9af0],
  crits_500: ['combat', 'common', 'target', 0xff7a7a], crits_10000: ['combat', 'epic', 'target', 0xff4a4a], damage_1m: ['combat', 'legendary', 'meteor', 0xff8a2a],
  elites_100: ['combat', 'epic', 'fang', 0xff5470], boss_50: ['combat', 'legendary', 'crown', 0xff9a3a],
  ek_physical: ['weapons', 'rare', 'sword', 0xd8e4ff], ek_fire: ['weapons', 'rare', 'fireball', 0xff7a2e], ek_ice: ['weapons', 'rare', 'shard', 0x8fe9ff],
  ek_lightning: ['weapons', 'rare', 'lightning', 0xfff27a], ek_poison: ['weapons', 'rare', 'flask', 0x9cff4f], ek_dark: ['weapons', 'rare', 'skull', 0xb060ff],
  ek_arcane: ['weapons', 'rare', 'staff', 0xb98cff], ek_holy: ['weapons', 'rare', 'halo', 0xfff1a8], weapons_15: ['weapons', 'epic', 'quiver', 0xffd6a0],
  maps_3: ['exploration', 'common', 'compass', 0x9fd8ff], maps_6: ['exploration', 'epic', 'compass', 0xffd23d], enemies_25: ['exploration', 'rare', 'eye', 0xff9a6a],
  enemies_45: ['exploration', 'legendary', 'eye', 0xff5a8a], relics_3: ['exploration', 'epic', 'idol', 0xffd23d], jumps_500: ['exploration', 'common', 'feather', 0xc8f5ff],
  night_1: ['daynight', 'common', 'moon', 0xb8c8ff], nights_10: ['daynight', 'rare', 'moon', 0x8aa8ff], nights_50: ['daynight', 'legendary', 'moon', 0xc8a0ff],
  run_nights_3: ['daynight', 'epic', 'moon', 0x7a8aff], bloodmoon_1: ['daynight', 'rare', 'moon', 0xff4a4a], bloodmoon_5: ['daynight', 'epic', 'moon', 0xff2a3a],
  nightboss_1: ['daynight', 'epic', 'cskull', 0x9a7aff], night_kills_2000: ['daynight', 'rare', 'fang', 0x8a7aff], day_kills_5000: ['daynight', 'rare', 'sun', 0xffd23d],
  sleepers_50: ['daynight', 'rare', 'plate', 0xa8b0c0], dire_100: ['daynight', 'rare', 'fang', 0xff4a4a],
  gold_100k: ['economy', 'legendary', 'coin', 0xffd23d], spend_10k: ['economy', 'epic', 'chest', 0xffd23d], perm_25: ['economy', 'rare', 'rune', 0x9fd8ff],
  chests_100: ['economy', 'epic', 'chest', 0xffb35c],
  nohit_60: ['survival', 'rare', 'plate', 0x9fd8ff], nohit_180: ['survival', 'legendary', 'feather', 0xe8f0ff], survive_20: ['survival', 'legendary', 'hourglass', 0xff9af0],
  endless_1: ['endless', 'common', 'skip', 0x9dffd6], endless_w10: ['endless', 'rare', 'skip', 0x9dffd6], endless_w25: ['endless', 'epic', 'skip', 0xffd23d],
  endless_w50: ['endless', 'legendary', 'skip', 0xff5d8f], endless_30m: ['endless', 'epic', 'hourglass', 0x9dffd6],
};

export const ACHIEVEMENTS: AchievementDef[] = RAW.map((a) => {
  const m = META[a.id] ?? ['progress', 'common', 'star', 0xffd23d];
  return { ...a, category: m[0], rarity: m[1], icon: m[2], color: m[3] };
});

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = ['progress', 'combat', 'weapons', 'exploration', 'daynight', 'economy', 'survival', 'endless'];
export const RARITY_COLOR: Record<AchievementRarity, string> = { common: '#c8ccd8', rare: '#5ab0ff', epic: '#c070ff', legendary: '#ffb02e' };

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
