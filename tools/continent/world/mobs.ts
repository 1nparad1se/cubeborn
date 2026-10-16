/**
 * Этап 5: расстановка мобов. Только виды из каталога игры (src/data/bestiary.ts → CREATURES, статы — src/data/creatureStats.ts).
 * at — авторская точка лагеря; build.ts сдвигает её на ближайшую подходящую площадку (суша, нужный биом, не вода,
 * не дорога, уклон ≤ 20°) и рассчитывает места отдыха, позиции стрелков/бойцов и маршрут патруля.
 * Радиусы — в блоках. aggro/leash по умолчанию берутся из статов вида (aggro в клетках × 1.5 = блоки).
 */
import type { P } from '../geom';

export type Territory = 'camp' | 'road_camp' | 'fort' | 'lair' | 'pack' | 'herd' | 'nest' | 'ruin' | 'cave' | 'roost' | 'swamp' | 'patrol';
export interface Group { species: string; count: number; lv: [number, number]; boss?: string }
export interface Camp {
  id: string; ru: string; region: string; at: P; territory: Territory; groups: Group[];
  /** радиус патруля (блоки) */ patrol: number;
  props: string[];
  /** уникальный — после смерти не возрождается */ unique?: boolean;
  /** явно опасное место (уровень выше окружения) — нужен знак/предупреждение */ danger?: string;
  /** пещера/руина, к которой привязан лагерь (sites.ts) */ site?: string;
  quest: string;
  note: string;
}

const C = (id: string, ru: string, region: string, at: P, territory: Territory, groups: Group[], patrol: number, props: string[], quest: string, note: string, extra: Partial<Camp> = {}): Camp =>
  ({ id, ru, region, at, territory, groups, patrol, props, quest, note, ...extra });
const g = (species: string, count: number, a: number, b: number, boss?: string): Group => ({ species, count, lv: [a, b], ...(boss ? { boss } : {}) });

export const CAMPS: Camp[] = [
  // ─── Зеленодольская Долина (1–5) ───
  C('c01', 'Кабаний выпас у опушки', 'zelenodol_vale', [3500, 3990], 'herd', [g('wild_boar', 3, 1, 2)], 40, ['bush_berry', 'mushrooms_small', 'stump'], 'q_boar_tusks', 'кабаны пасутся на опушке Дремучего Леса'),
  C('c02', 'Вороньё над полями', 'zelenodol_vale', [4150, 4250], 'roost', [g('carrion_raven', 4, 2, 3)], 60, ['dead_tree', 'hay_bale'], 'q_scarecrow', 'вороны клюют посевы у дороги'),
  C('c03', 'Паучья опушка', 'zelenodol_vale', [3420, 3600], 'nest', [g('forest_spider', 4, 3, 4)], 30, ['fallen_tree', 'undergrowth'], 'q_spider_silk', 'паутина в подлеске за пасекой'),
  C('c04', 'Гоблинская засада у брода', 'zelenodol_vale', [4060, 4560], 'road_camp', [g('forest_goblin', 3, 4, 5), g('goblin_archer', 2, 4, 5)], 35, ['camp_tent_small', 'camp_campfire', 'camp_crates'], 'q_first_ambush', 'гоблины подстерегают путников у южного тракта'),
  C('c05', 'Кабаны у Светлой', 'zelenodol_vale', [4250, 3700], 'herd', [g('wild_boar', 3, 2, 3)], 40, ['bush_low', 'reeds'], 'q_boar_tusks', 'роются в прибрежных кустах'),
  // ─── Луга Светлой (4–9) ───
  C('c06', 'Лагерь гоблинов у ущелья', 'svetlaya_meadows', [3640, 3260], 'road_camp', [g('forest_goblin', 4, 6, 8), g('goblin_archer', 2, 6, 8)], 40, ['camp_tent_large', 'camp_campfire', 'camp_cart', 'camp_barrels'], 'q_stolen_cart', 'грабят телеги на Тропе Волчьего Ущелья'),
  C('c07', 'Вороны Поля Битвы', 'svetlaya_meadows', [4640, 2600], 'roost', [g('carrion_raven', 5, 5, 7)], 70, ['camp_stakes', 'camp_skull_trophy', 'dead_tree'], 'q_battlefield_relics', 'стая над старым полем боя', { site: 'ruin_battlefield' }),
  C('c08', 'Призраки Вороньей Битвы', 'svetlaya_meadows', [4760, 2720], 'ruin', [g('shadow_ghost', 3, 8, 9)], 30, ['statue_broken', 'obelisk'], 'q_restless_dead', 'появляются ночью среди надгробий', { site: 'ruin_battlefield' }),
  C('c09', 'Кабаны Берёзовой Рощи', 'svetlaya_meadows', [4250, 2930], 'herd', [g('wild_boar', 4, 5, 6)], 45, ['tree_birch', 'bush_berry'], 'q_boar_tusks', 'опушка рощи'),
  // ─── Дремучий Лес (5–10) ───
  C('c10', 'Паучьи гнёзда', 'old_forest', [2600, 3720], 'nest', [g('forest_spider', 5, 6, 8)], 35, ['fallen_tree', 'mushrooms_big', 'vines'], 'q_spider_queen', 'сплошная паутина между дубами'),
  C('c11', 'Корневики глухомани', 'old_forest', [2300, 3520], 'nest', [g('root_spider', 3, 8, 10)], 30, ['tree_big', 'mushrooms_glow'], 'q_heart_of_grove', 'оживающие корни в самой чаще'),
  C('c12', 'Гоблинский пост на тракте', 'old_forest', [2980, 2960], 'road_camp', [g('forest_goblin', 4, 7, 9), g('goblin_archer', 2, 7, 9)], 40, ['camp_watchtower', 'camp_campfire', 'camp_palisade'], 'q_toll_goblins', 'берут «пошлину» на Северном тракте'),
  C('c13', 'Кабанья тропа', 'old_forest', [3250, 3330], 'herd', [g('wild_boar', 3, 5, 6)], 40, ['stump', 'bush_mid'], 'q_boar_tusks', 'опушка у Северного тракта'),
  C('c14', 'Нора Кривого Клыка', 'old_forest', [2700, 2580], 'cave', [g('forest_goblin', 3, 8, 10), g('goblin_archer', 3, 8, 10), g('forest_goblin', 1, 11, 11, 'Вожак Кривой Клык')], 30, ['cave_medium', 'camp_torch', 'camp_crates', 'camp_cage'], 'q_crooked_fang', 'гоблинская пещера, логово вожака', { site: 'cave_crooked_fang', unique: true }),
  C('c15', 'Корневые Норы', 'west_ridge', [1760, 3330], 'cave', [g('root_spider', 4, 17, 19)], 30, ['cave_small', 'mushrooms_glow'], 'q_heart_of_grove', 'норы под Западным Гребнем', { site: 'cave_root_burrows' }),
  C('c87', 'Старый Мшистый', 'old_forest', [2150, 3900], 'lair', [g('forest_troll', 1, 28, 28, 'Старый Мшистый')], 25, ['tree_big', 'camp_skull_trophy', 'fallen_tree'], 'q_mossy_legend', 'древний тролль в глуши — опасное место для новичков', { unique: true, danger: 'уровень 28 посреди зоны 5–10: знак «кости на кольях» на тропе' }),
  // ─── Берег Светлой Губы (8–12) ───
  C('c16', 'Береговые вороны', 'west_coast', [1300, 4300], 'roost', [g('carrion_raven', 4, 8, 9)], 60, ['water_driftwood', 'coast_rocks'], 'q_wreck', 'кружат над обломками у устья'),
  C('c17', 'Гоблины у губы', 'west_coast', [1600, 4080], 'camp', [g('forest_goblin', 4, 10, 12), g('goblin_archer', 2, 10, 12)], 40, ['camp_tent_small', 'camp_campfire', 'camp_sacks'], 'q_bay_goblins', 'промышляют рыбой и грабежом'),
  C('c18', 'Кабаны Кремнёвого Бора', 'west_coast', [1350, 4780], 'herd', [g('wild_boar', 4, 9, 10)], 45, ['tree_pine', 'bush_low'], 'q_boar_tusks', 'на краю бора'),
  // ─── Медовые Холмы (10–14) ───
  C('c19', 'Кабаны на увалах', 'honey_hills', [5200, 4300], 'herd', [g('wild_boar', 4, 10, 11)], 50, ['bush_berry', 'flowers_yellow'], 'q_boar_tusks', 'роют медовые луга'),
  C('c20', 'Стражи Кургана', 'honey_hills', [5650, 3990], 'cave', [g('shadow_ghost', 4, 13, 15)], 30, ['cave_ruins', 'obelisk', 'statue_broken'], 'q_kings_barrow', 'призраки первых королей', { site: 'cave_kings_barrow' }),
  C('c21', 'Тихий Грот', 'honey_hills', [6240, 3540], 'cave', [g('giant_bat', 5, 12, 14)], 30, ['cave_medium', 'cave_pool', 'crystal_cluster'], 'q_star_tears', 'летучие мыши над светящимся озером', { site: 'cave_quiet_grotto' }),
  C('c22', 'Гоблины Суховейных Ворот', 'honey_hills', [5300, 4650], 'road_camp', [g('forest_goblin', 4, 12, 13), g('goblin_archer', 2, 12, 13)], 40, ['camp_tent_large', 'camp_campfire', 'camp_cart'], 'q_detour_raids', 'перехватывают обозы на Восточном объезде'),
  // ─── Восточное Взморье (12–16) ───
  C('c23', 'Вороны маяка', 'east_shore', [7700, 4230], 'roost', [g('carrion_raven', 5, 14, 15)], 60, ['round_tower', 'coast_rocks'], 'q_light_the_beacon', 'гнездятся в погасшем маяке', { site: 'lighthouse' }),
  C('c24', 'Тролли Приморской Дубравы', 'east_shore', [7100, 3900], 'lair', [g('forest_troll', 2, 15, 16)], 30, ['tree_big', 'camp_skull_trophy'], 'q_oak_trolls', 'в глубине дубравы, вдали от дорог'),
  C('c25', 'Кабаны взморья', 'east_shore', [6800, 3600], 'herd', [g('wild_boar', 4, 12, 13)], 45, ['tree_oak', 'bush_mid'], 'q_boar_tusks', 'опушка дубравы'),
  // ─── Сухая Степь (12–16) ───
  C('c26', 'Шакалья стая', 'dry_steppe', [4150, 5300], 'pack', [g('jackal', 5, 12, 14)], 70, ['grass_dry', 'bush_dry'], 'q_jackal_pelts', 'кружат по ковыльной степи'),
  C('c27', 'Вороньё степи', 'dry_steppe', [3600, 5150], 'roost', [g('carrion_raven', 4, 13, 14)], 60, ['dead_tree', 'grass_dry'], 'q_caravan_bones', 'над павшими волами каравана'),
  C('c28', 'Гоблинский стан у тракта', 'dry_steppe', [3580, 5560], 'road_camp', [g('forest_goblin', 4, 14, 16), g('goblin_archer', 2, 14, 16)], 40, ['camp_tent_large', 'camp_campfire', 'camp_palisade', 'camp_banner'], 'q_steppe_toll', 'перекрывают путь к Мосту над Бездной'),
  // ─── Гнилые Топи (14–18) ───
  C('c29', 'Утопленники Зеркального плёса', 'rot_marsh', [2600, 4900], 'swamp', [g('swamp_drowned', 5, 14, 16)], 35, ['flooded_logs', 'cattail', 'lily_pads'], 'q_drowned_bells', 'бредут из бочагов'),
  C('c30', 'Ковен Затопленной часовни', 'rot_marsh', [2380, 5120], 'ruin', [g('swamp_witch', 2, 16, 18), g('swamp_drowned', 4, 16, 17)], 30, ['ruin_arch', 'camp_cauldron', 'flooded_logs'], 'q_coven', 'ведьмы варят зелья в развалинах', { site: 'ruin_chapel' }),
  C('c31', 'Топь утопленников', 'rot_marsh', [2100, 5160], 'swamp', [g('swamp_drowned', 4, 15, 17)], 35, ['reeds', 'algae'], 'q_drowned_bells', 'глубокая часть топи'),
  C('c32', 'Матушка Тина', 'rot_marsh', [2300, 4980], 'cave', [g('swamp_witch', 1, 18, 18, 'Матушка Тина'), g('swamp_drowned', 3, 17, 18)], 20, ['ruin_stairs', 'camp_cauldron', 'glow_mushrooms'], 'q_mother_mire', 'уникальная ведьма у входа в Утопленный склеп', { site: 'cave_drowned_crypt', unique: true }),
  C('c33', 'Пауки у кромки топи', 'rot_marsh', [2850, 4650], 'nest', [g('forest_spider', 4, 14, 15)], 30, ['fallen_tree', 'reeds'], 'q_spider_silk', 'сухая гряда у края болота'),
  // ─── Сторожевой Кряж (16–20) ───
  C('c34', 'Берсерки Старой Заставы', 'guard_ridge', [2380, 2330], 'fort', [g('north_berserker', 4, 18, 20)], 35, ['ruin_wall', 'camp_palisade', 'camp_banner', 'camp_weapon_rack'], 'q_retake_outpost', 'северяне укрепились в руинах на перевале', { site: 'ruin_outpost' }),
  C('c35', 'Старая Штольня (южный вход)', 'guard_ridge', [3060, 2540], 'cave', [g('skeleton_miner', 5, 14, 18), g('giant_bat', 3, 14, 16)], 25, ['cave_mine', 'mine_rails', 'mine_support', 'mine_lantern'], 'q_old_adit', 'мёртвые рудокопы и мыши в штольне', { site: 'cave_old_adit' }),
  C('c88', 'Бродячий ледяной тролль', 'guard_ridge', [2500, 2060], 'lair', [g('ice_troll', 1, 38, 38, 'Белый Горб')], 30, ['camp_skull_trophy', 'rock_high'], 'q_white_hump', 'спускается с Короны на северный склон перевала — очень опасно', { unique: true, danger: 'уровень 38 у серпантина зоны 16–24: следы и обглоданные кости на дороге' }),
  // ─── Западный Гребень (18–22) ───
  C('c38', 'Мышиный Грот', 'west_ridge', [1450, 2250], 'cave', [g('giant_bat', 6, 19, 21)], 30, ['cave_small', 'stalagmites'], 'q_guano', 'колония летучих мышей', { site: 'cave_bat_grotto' }),
  C('c39', 'Тролли Кремнёвого карьера', 'west_ridge', [1560, 2700], 'lair', [g('forest_troll', 2, 20, 21)], 30, ['rock_block', 'plank_stack', 'camp_skull_trophy'], 'q_flint_quarry', 'заняли брошенный карьер', { site: 'quarry_flint' }),
  C('c40', 'Вороны Гребня', 'west_ridge', [1700, 2950], 'roost', [g('carrion_raven', 4, 18, 19)], 60, ['dead_tree', 'rock_sharp'], 'q_caravan_bones', 'над осыпями'),
  C('c37', 'Камнелоб', 'west_ridge', [1380, 3000], 'cave', [g('forest_troll', 1, 22, 22, 'Камнелоб')], 20, ['cave_medium', 'camp_skull_trophy'], 'q_stonebrow', 'уникальный тролль, разоривший карьер', { site: 'cave_troll_lair', unique: true }),
  // ─── Кремнёвый Нос (18–22) ───
  C('c41', 'Гоблинский острог', 'flint_cape', [1100, 5800], 'fort', [g('forest_goblin', 5, 19, 21), g('goblin_archer', 3, 19, 21), g('forest_goblin', 1, 22, 22, 'Вождь Ржавая Секира')], 50, ['camp_palisade', 'camp_gate', 'camp_watchtower', 'camp_hut', 'camp_forge'], 'q_goblin_chief', 'укреплённая деревня гоблинов на полуострове', { unique: true }),
  C('c42', 'Кабаны полуострова', 'flint_cape', [1300, 5300], 'herd', [g('wild_boar', 4, 18, 19)], 45, ['bush_mid', 'grass_tall'], 'q_boar_tusks', 'луга у бора'),
  C('c43', 'Пауки Кремнёвого Бора', 'flint_cape', [900, 5500], 'nest', [g('forest_spider', 5, 19, 20)], 30, ['tree_pine', 'fallen_tree'], 'q_spider_queen', 'сосняк, затянутый паутиной'),
  // ─── Долина Снежного Предела (20–24) ───
  C('c44', 'Логово Серой Стаи', 'snow_vale', [2850, 1540], 'cave', [g('frost_wolf', 5, 21, 23), g('frost_wolf', 1, 24, 24, 'Седогрив')], 50, ['cave_small', 'camp_skull_trophy'], 'q_greymane', 'стая с вожаком-уникумом', { site: 'cave_wolf_den', unique: true }),
  C('c45', 'Волки у Волчьего Ущелья', 'snow_vale', [3600, 1950], 'pack', [g('frost_wolf', 4, 20, 22)], 70, ['rock_mid', 'biome_snow'], 'q_wolf_gorge', 'стая стережёт выход из ущелья'),
  C('c46', 'Старая Штольня (северный вход)', 'snow_vale', [3060, 1910], 'cave', [g('skeleton_miner', 4, 20, 21)], 25, ['cave_mine', 'mine_support', 'mine_lantern'], 'q_old_adit', 'северная часть штольни у Снежного Предела', { site: 'cave_old_adit' }),
  C('c47', 'Стоянка берсерков', 'snow_vale', [2700, 1820], 'camp', [g('north_berserker', 3, 22, 24)], 40, ['camp_tent_large', 'camp_campfire', 'camp_weapon_rack'], 'q_raiders_north', 'разведчики берсерков у деревни'),
  // ─── Высокогорье Тура (24–28) ───
  C('c49', 'Стая Тура', 'tur', [6300, 2000], 'pack', [g('frost_wolf', 5, 24, 26)], 80, ['biome_snow', 'rock_low'], 'q_tur_wolves', 'гоняют оленей по плато'),
  C('c50', 'Ледяные тролли Тура', 'tur', [6800, 1900], 'lair', [g('ice_troll', 2, 27, 28)], 30, ['rock_high', 'camp_skull_trophy'], 'q_tur_trolls', 'на северном краю плато'),
  C('c51', 'Призраки Обсерватории', 'tur', [6520, 1920], 'ruin', [g('shadow_ghost', 3, 26, 28)], 30, ['round_tower', 'statue_broken'], 'q_star_charts', 'звездочёты, не покинувшие башню', { site: 'ruin_observatory' }),
  // ─── Озёрная Тишь (26–30) ───
  C('c52', 'Хрустальный Зев', 'white_silence', [4880, 1500], 'cave', [g('ice_knight', 3, 28, 30)], 25, ['cave_large', 'crystal_cluster', 'stalagmites'], 'q_frozen_knight', 'рыцари стерегут вмороженного собрата', { site: 'cave_crystal_maw' }),
  C('c53', 'Волки Белой Тишины', 'white_silence', [5200, 1700], 'pack', [g('frost_wolf', 5, 26, 28)], 80, ['biome_snow', 'rock_mid'], 'q_silence_wolves', 'берег ледникового озера'),
  C('c54', 'Застава берсерков у Ворот', 'white_silence', [5420, 2160], 'fort', [g('north_berserker', 4, 27, 29)], 35, ['camp_palisade', 'camp_watchtower', 'camp_banner'], 'q_east_gate', 'северяне держат Восточные Ворота'),
  // ─── Северные Фьорды (30–34) ───
  C('c55', 'Берсерки фьордов', 'north_fjords', [1400, 900], 'fort', [g('north_berserker', 6, 31, 33)], 45, ['camp_palisade', 'camp_hut', 'camp_gate', 'camp_banner', 'water_pier'], 'q_fjord_raiders', 'укреплённое селение в бывшей рыбацкой деревне'),
  C('c57', 'Волки побережья', 'north_fjords', [850, 1150], 'pack', [g('frost_wolf', 5, 30, 32)], 80, ['coast_rocks', 'biome_snow'], 'q_fjord_wolves', 'мыс у Северного Стража'),
  // ─── Пики Исполина (42–48) / Грот Китового Зуба ───
  C('c56', 'Драккар ярла', 'east_peaks', [5120, 920], 'cave', [g('north_berserker', 4, 42, 44), g('north_berserker', 1, 46, 46, 'Ярл Хродгар')], 30, ['cave_medium', 'water_driftwood', 'camp_banner'], 'q_jarl', 'укрытие ярла и его драккара', { site: 'cave_fjord', unique: true }),
  C('c62', 'Ледяные рыцари Исполина', 'east_peaks', [5900, 1260], 'patrol', [g('ice_knight', 4, 44, 46)], 60, ['temple_pillar', 'magic_crystal'], 'q_frost_order', 'дозор ордена у старых ворот'),
  C('c63', 'Тролли Исполина', 'east_peaks', [6300, 1180], 'lair', [g('ice_troll', 3, 45, 47)], 30, ['rock_high', 'camp_skull_trophy'], 'q_giant_trolls', 'на склонах Старого Исполина'),
  // ─── Хладные Пустоши (34–38) ───
  C('c58', 'Пещера Ледяного Тролля', 'frost_waste', [6950, 1500], 'cave', [g('ice_troll', 3, 35, 37)], 30, ['cave_large', 'camp_skull_trophy'], 'q_storm_trolls', 'берлога у края Тура', { site: 'cave_ice_troll' }),
  C('c59', 'Тундровая стая', 'frost_waste', [7200, 1000], 'pack', [g('frost_wolf', 6, 34, 36)], 90, ['biome_snow'], 'q_tundra_hunt', 'гоняют по открытой тундре'),
  // ─── Ледяная Корона (40–46) ───
  C('c60', 'Дозор Ледяного Плато', 'ice_crown', [2480, 1520], 'patrol', [g('ice_knight', 4, 41, 43)], 60, ['temple_pillar', 'crystal_cluster'], 'q_frost_order', 'патруль на краю плато'),
  C('c61', 'Тролли Короны Ветров', 'ice_crown', [2800, 1250], 'lair', [g('ice_troll', 2, 43, 45)], 30, ['rock_high', 'camp_skull_trophy'], 'q_crown_trolls', 'у подножия пика'),
  // ─── Чертоги Белого Клыка (46–50) ───
  C('c64', 'Врата Ледяной Цитадели', 'white_fang', [4120, 1290], 'fort', [g('ice_knight', 5, 47, 49)], 30, ['castle', 'temple_pillar', 'magic_crystal', 'camp_banner'], 'q_ice_citadel', 'главный вход в цитадель', { site: 'cave_ice_citadel' }),
  C('c65', 'Командор Инеевой Стражи', 'white_fang', [3900, 1200], 'cave', [g('ice_knight', 1, 50, 50, 'Командор Инеевой Стражи')], 15, ['castle', 'magic_crystal'], 'q_frost_commander', 'финальный босс северной ветки', { site: 'cave_ice_citadel', unique: true }),
  // ─── Пепельный Хребет (22–26) ───
  C('c66', 'Орочьи Копи (главный вход)', 'ash_ridge', [6300, 5220], 'cave', [g('cave_orc', 5, 24, 26)], 30, ['cave_large', 'camp_forge', 'camp_palisade', 'mine_rails'], 'q_orc_tunnel', 'орки роют ход под перевалом', { site: 'cave_ash_mines' }),
  C('c67', 'Орочьи Копи (южный вход)', 'ash_ridge', [6450, 5470], 'cave', [g('cave_orc', 3, 23, 25)], 25, ['cave_medium', 'camp_torch'], 'q_orc_tunnel', 'выход к пустоши', { site: 'cave_ash_mines' }),
  C('c68', 'Налётчики Башни Суховея', 'ash_ridge', [6000, 5500], 'fort', [g('desert_raider', 4, 23, 25)], 35, ['ruin_tower', 'camp_palisade', 'camp_banner'], 'q_dry_wind_tower', 'засели в брошенной башне на перевале', { site: 'tower_dry_wind' }),
  C('c69', 'Мыши западного лаза', 'ash_ridge', [6050, 5280], 'cave', [g('giant_bat', 4, 22, 24)], 25, ['cave_small'], 'q_orc_tunnel', 'третий вход в копи', { site: 'cave_ash_mines' }),
  // ─── Земли Оазиса (24–28) ───
  C('c70', 'Шакалы у Приюта', 'oasis', [4900, 6300], 'pack', [g('jackal', 5, 24, 25)], 70, ['bush_dry', 'biome_desert'], 'q_jackal_pelts', 'подкрадываются к стадам оазиса'),
  C('c71', 'Скорпионы Южных Гряд', 'oasis', [4200, 6950], 'nest', [g('sand_scorpion', 3, 26, 27)], 30, ['rock_low', 'bush_dry'], 'q_scorpion_venom', 'в дюнах за оазисом'),
  C('c72', 'Налётчики караванного пути', 'oasis', [5050, 6820], 'road_camp', [g('desert_raider', 4, 26, 28)], 40, ['camp_canopy', 'camp_campfire', 'camp_crates'], 'q_caravan_guard', 'поджидают караваны к Месе'),
  // ─── Багровый Разлом (28–32) ───
  C('c73', 'Пещера Налётчиков', 'crimson_rift', [3170, 6200], 'cave', [g('desert_raider', 5, 29, 31), g('desert_raider', 1, 32, 32, 'Атаман Красный Платок')], 30, ['cave_medium', 'camp_crates', 'camp_banner', 'camp_cage'], 'q_red_scarf', 'логово атамана в стене каньона', { site: 'cave_raider_hole', unique: true }),
  C('c74', 'Скорпионы дна каньона', 'crimson_rift', [2500, 6500], 'nest', [g('sand_scorpion', 4, 28, 30)], 30, ['rock_low', 'bush_dry'], 'q_scorpion_venom', 'на сухом дне Разлома'),
  C('c75', 'Мыши стен Разлома', 'crimson_rift', [4250, 5960], 'roost', [g('giant_bat', 5, 28, 30)], 40, ['rock_cliff_block'], 'q_rift_bats', 'вылетают из трещин у Золотой Струны'),
  C('c76', 'Шакалы южной бровки', 'crimson_rift', [3900, 6250], 'pack', [g('jackal', 5, 28, 29)], 70, ['bush_dry'], 'q_jackal_pelts', 'рыщут вдоль бровки каньона'),
  // ─── Море Дюн (32–36) ───
  C('c77', 'Скорпионы Моря Дюн', 'dune_sea', [2200, 7250], 'nest', [g('sand_scorpion', 5, 33, 35)], 35, ['biome_desert'], 'q_scorpion_venom', 'среди барханов'),
  C('c78', 'Налётчики Соляных копей', 'dune_sea', [2420, 6780], 'fort', [g('desert_raider', 5, 32, 34)], 40, ['cave_mine', 'camp_palisade', 'camp_canopy', 'sack_pile'], 'q_salt_mines', 'захватили копи и обирают караваны', { site: 'mine_salt' }),
  C('c79', 'Шакалы Солёной Чаши', 'dune_sea', [1750, 6800], 'pack', [g('jackal', 6, 32, 33)], 80, ['bush_dry'], 'q_jackal_pelts', 'у края солончака'),
  // ─── Пустошь Ржавых Скал (36–40) ───
  C('c80', 'Гнездо Скорпионов', 'rust_waste', [6950, 6470], 'cave', [g('sand_scorpion', 5, 37, 39), g('sand_scorpion', 1, 40, 40, 'Матка Песков')], 30, ['cave_medium', 'bush_dry'], 'q_sand_mother', 'матка охраняет кладку', { site: 'cave_scorpion_nest', unique: true }),
  C('c81', 'Острог налётчиков в оврагах', 'rust_waste', [6500, 6120], 'fort', [g('desert_raider', 6, 36, 38)], 45, ['camp_palisade', 'camp_gate', 'camp_watchtower', 'camp_canopy'], 'q_badland_fort', 'крепость в Ржавых Оврагах'),
  C('c82', 'Шакалы пустоши', 'rust_waste', [6300, 7050], 'pack', [g('jackal', 6, 36, 37)], 80, ['bush_dry'], 'q_jackal_pelts', 'у Змеиного Русла'),
  C('c85', 'Гробница Песчаных Царей', 'rust_waste', [5760, 6840], 'cave', [g('skeleton_miner', 4, 37, 39), g('shadow_ghost', 3, 38, 39), g('shadow_ghost', 1, 40, 40, 'Песчаный Царь')], 30, ['cave_ruins', 'temple_pillar', 'obelisk'], 'q_sand_king', 'мёртвые строители и дух царя', { site: 'cave_sand_kings', unique: true }),
  // ─── Столовые Горы (38–42) ───
  C('c83', 'Призраки Города Солнца', 'table_mountains', [3420, 6560], 'ruin', [g('shadow_ghost', 4, 39, 41)], 40, ['temple_pillar', 'ruin_columns', 'obelisk'], 'q_sun_city', 'тени жителей древнего города', { site: 'ruin_sun_city' }),
  C('c84', 'Храм Солнца', 'table_mountains', [3270, 6630], 'cave', [g('skeleton_miner', 4, 39, 41)], 25, ['temple', 'temple_pillar', 'statue'], 'q_sun_stone', 'мёртвые храмовые каменотёсы', { site: 'cave_sun_temple' }),
];

/** Виды, которых требует концепция, но нет в каталоге игры: НЕ расставлены, нужны новые модели/статы. */
export const MISSING_SPECIES: { ru: string; where: string; why: string }[] = [
  { ru: 'Лесной (серый) волк', where: 'Дремучий Лес, Луга Светлой', why: 'есть только морозный волк (зима); стаи волков нужны и в зелёных землях' },
  { ru: 'Медведь', where: 'Дремучий Лес, Кремнёвый Бор, Тайга', why: 'классический хищник опушек и тайги' },
  { ru: 'Разбойник (человек)', where: 'тракты зелёных земель', why: 'налётчик — пустынный; зелёным дорогам нужны свои бандиты' },
  { ru: 'Каменный голем', where: 'Столовые Горы, Ледяная Цитадель, Орочьи Копи', why: 'стражи храмов и руин' },
  { ru: 'Мумия / страж гробницы', where: 'Гробница Песчаных Царей, Храм Солнца', why: 'сейчас там скелеты-шахтёры и призраки' },
  { ru: 'Песчаный червь', where: 'Море Дюн', why: 'крупная угроза открытых дюн' },
  { ru: 'Скелет-воин / некромант', where: 'Поле Вороньей Битвы, Курган Королей', why: 'нежить руин; скелет-шахтёр подходит только для шахт' },
  { ru: 'Йети / снежный элементаль', where: 'Ледяная Корона, Хладные Пустоши', why: 'разнообразие высокогорья' },
  { ru: 'Гарпия / стервятник', where: 'Красные Скалы, Пепельный Хребет', why: 'летающий враг пустыни (сейчас только мыши и вороны)' },
  { ru: 'Модели боссов', where: 'все уникальные лагеря', why: 'уникумы пока — усиленные версии видов каталога (категория «Боссы» пуста)' },
];
