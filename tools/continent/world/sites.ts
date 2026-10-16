/**
 * Этап 4: объекты инфраструктуры (кроме зданий деревень и дорог).
 * anchor — авторская точка. Для пещер это примерное место у склона: инструмент build.ts находит рядом
 * обрыв (уклон за входом ≥ 35°, перед входом проходимая площадка) и записывает итоговые координаты
 * в world/generated.json. Остальные объекты встают точно в anchor.
 */
import type { P } from '../geom';

export type CaveType = 'beast_den' | 'goblin_cave' | 'mine' | 'underground_lake' | 'ice_cave' | 'tomb' | 'desert_temple' | 'big_dungeon' | 'bandit_hideout';
export const CAVE_TYPE_RU: Record<CaveType, string> = {
  beast_den: 'Логово зверей', goblin_cave: 'Гоблинская пещера', mine: 'Шахта', underground_lake: 'Подземное озеро', ice_cave: 'Ледяная пещера',
  tomb: 'Гробница', desert_temple: 'Пустынный храм', big_dungeon: 'Большое подземелье', bandit_hideout: 'Логово разбойников',
};

export interface Site {
  id: string; ru: string;
  kind: 'farm' | 'mine' | 'quarry' | 'ruin' | 'tower' | 'lighthouse' | 'shrine' | 'cave';
  anchor: P;
  /** Для пещер: тип, входы (каждый — anchor), уровни, зацепка для сюжета. */
  cave?: { type: CaveType; entrances: P[]; lv: [number, number]; lore: string; noCliff?: boolean };
  purpose: string;
  props: string[];
}

export const SITES: Site[] = [
  // ── Хутора и фермы ──
  { id: 'farm_kolosok', ru: 'Хутор Колосок', kind: 'farm', anchor: [3560, 4140], purpose: 'пшеничные поля, снабжает таверну Зеленодола', props: ['hay_bale', 'cart', 'crate_produce', 'grass_field'] },
  { id: 'farm_apiary', ru: 'Пасека Медуницы', kind: 'farm', anchor: [3560, 3700], purpose: 'ульи, мёд для рынка', props: ['crate_produce', 'flowers_yellow', 'bush_flower'] },
  { id: 'farm_berezka', ru: 'Ферма Берёзка', kind: 'farm', anchor: [4420, 3180], purpose: 'скот и сыры, у Берёзовой Рощи', props: ['camp_palisade', 'hay_bale', 'cart'] },
  { id: 'farm_reindeer', ru: 'Олений загон', kind: 'farm', anchor: [3470, 1780], purpose: 'северные олени, шкуры', props: ['camp_palisade', 'hay_bale', 'sack_pile'] },
  { id: 'farm_dates', ru: 'Финиковая роща', kind: 'farm', anchor: [4700, 6560], purpose: 'финики и вода оазиса', props: ['palm_bush', 'crate_produce', 'sack'] },
  // ── Шахты и карьеры ──
  { id: 'mine_copper', ru: 'Медный рудник Снежного Предела', kind: 'mine', anchor: [3460, 1500], purpose: 'действующий рудник, работа для героя', props: ['cave_mine', 'mine_rails', 'mine_support', 'mine_lantern', 'cart'] },
  { id: 'quarry_flint', ru: 'Кремнёвый карьер', kind: 'quarry', anchor: [1560, 2700], purpose: 'добыча кремня; брошен после набегов троллей', props: ['rock_block', 'plank_stack', 'crate_stone'] },
  { id: 'mine_salt', ru: 'Соляные копи', kind: 'mine', anchor: [2400, 6820], purpose: 'соль для караванов', props: ['cave_mine', 'sack_pile', 'cart'] },
  // ── Руины ──
  { id: 'ruin_outpost', ru: 'Руины Старой Заставы', kind: 'ruin', anchor: [2380, 2330], purpose: 'разрушенная застава на Перевале Ветров', props: ['ruin_wall', 'ruin_tower', 'camp_palisade'] },
  { id: 'ruin_chapel', ru: 'Затопленная часовня', kind: 'ruin', anchor: [2330, 5050], purpose: 'часовня, ушедшая в топь', props: ['ruin_arch', 'ruin_columns', 'flooded_logs'] },
  { id: 'ruin_canyon_bridge', ru: 'Обрушенный Каньонный мост', kind: 'ruin', anchor: [2330, 6420], purpose: 'конец заброшенного Каньонного тракта', props: ['bridge_stone_broken', 'ruin_stairs'] },
  { id: 'ruin_observatory', ru: 'Обсерватория Тура', kind: 'ruin', anchor: [6500, 1900], purpose: 'башня звездочётов на плато', props: ['round_tower', 'ruin_platform', 'statue_broken'] },
  { id: 'ruin_sun_city', ru: 'Город Солнца (руины)', kind: 'ruin', anchor: [3420, 6560], purpose: 'остатки древнего города у Столовых Гор', props: ['temple_pillar', 'ruin_columns', 'obelisk', 'statue'] },
  { id: 'ruin_battlefield', ru: 'Поле Вороньей Битвы', kind: 'ruin', anchor: [4700, 2650], purpose: 'старое поле боя, вороны и призраки', props: ['statue_broken', 'camp_stakes', 'camp_skull_trophy'] },
  // ── Башни, маяк, святилища ──
  { id: 'tower_pass', ru: 'Сторожевая башня Перевала', kind: 'tower', anchor: [2200, 2440], purpose: 'дозор над серпантином; ночлег стражи', props: ['camp_stone_tower', 'camp_banner', 'standing_torch'] },
  { id: 'tower_east_gate', ru: 'Башня Восточных Ворот', kind: 'tower', anchor: [5230, 2560], purpose: 'контроль прохода к Озёрной Тиши', props: ['round_tower', 'camp_banner'] },
  { id: 'tower_abyss', ru: 'Башня над Бездной', kind: 'tower', anchor: [3760, 5880], purpose: 'охрана Моста над Бездной', props: ['camp_stone_tower', 'fire_bowl'] },
  { id: 'tower_dry_wind', ru: 'Башня Суховея', kind: 'tower', anchor: [6000, 5480], purpose: 'брошенная башня на перевале — логово налётчиков', props: ['ruin_tower', 'camp_palisade'] },
  { id: 'lighthouse', ru: 'Маяк Буревестник', kind: 'lighthouse', anchor: [7780, 4200], purpose: 'погасший маяк на мысу', props: ['round_tower', 'fire_bowl', 'coast_rocks'] },
  { id: 'shrine_spring', ru: 'Родник Светлой', kind: 'shrine', anchor: [3540, 1300], purpose: 'святилище у истока Светлой', props: ['shrine', 'waterfall_small'] },
  { id: 'shrine_oasis', ru: 'Алтарь Пальмового Ключа', kind: 'shrine', anchor: [4780, 6800], purpose: 'алтарь воды', props: ['shrine', 'palm_bush'] },
  // ── Пещеры и подземелья ──
  { id: 'cave_wolf_den', ru: 'Логово Серой Стаи', kind: 'cave', anchor: [2850, 1520], purpose: 'логово морозных волков', props: ['cave_small', 'camp_skull_trophy'],
    cave: { type: 'beast_den', entrances: [[2850, 1520]], lv: [21, 24], lore: 'Вожак стаи Седогрив уносит оленей из загона Снежного Предела.' } },
  { id: 'cave_crooked_fang', ru: 'Нора Кривого Клыка', kind: 'cave', anchor: [2700, 2560], purpose: 'гоблинская пещера у южного подножия Кряжа', props: ['cave_medium', 'camp_torch', 'camp_crates'],
    cave: { type: 'goblin_cave', entrances: [[2700, 2560]], lv: [7, 10], lore: 'Гоблины грабят обозы на Северном тракте и прячут добычу здесь.' } },
  { id: 'cave_root_burrows', ru: 'Корневые Норы', kind: 'cave', anchor: [1750, 3350], purpose: 'норы корневиков под Западным Гребнем', props: ['cave_small', 'mushrooms_glow', 'fallen_tree'],
    cave: { type: 'beast_den', entrances: [[1750, 3350]], lv: [9, 12], lore: 'Корни Дремучего Леса оживают — друид из Зеленодола просит найти сердце рощи.' } },
  { id: 'cave_old_adit', ru: 'Старая Штольня', kind: 'cave', anchor: [3060, 2520], purpose: 'заброшенный рудник сквозь Кряж (тайный путь)', props: ['cave_mine', 'mine_rails', 'mine_support', 'mine_lantern'],
    cave: { type: 'mine', entrances: [[3060, 2520], [3060, 1930]], lv: [14, 18], lore: 'Рудокопы ушли 40 лет назад, но кирки в темноте стучат до сих пор.' } },
  { id: 'cave_quiet_grotto', ru: 'Тихий Грот', kind: 'cave', anchor: [6250, 3520], purpose: 'подземное озеро под валом кратера', props: ['cave_medium', 'cave_pool', 'crystal_cluster'],
    cave: { type: 'underground_lake', entrances: [[6250, 3520]], lv: [12, 15], lore: 'Вода грота светится; говорят, это слёзы упавшей звезды, создавшей Око Земли.' } },
  { id: 'cave_crystal_maw', ru: 'Хрустальный Зев', kind: 'cave', anchor: [4880, 1480], purpose: 'ледяная пещера над Озером Белой Тишины', props: ['cave_large', 'crystal_cluster', 'stalagmites'],
    cave: { type: 'ice_cave', entrances: [[4880, 1480]], lv: [27, 30], lore: 'Во льду вморожен рыцарь в доспехах древнего ордена.' } },
  { id: 'cave_ice_citadel', ru: 'Ледяная Цитадель', kind: 'cave', anchor: [4120, 1260], purpose: 'большое подземелье в толще Короны', props: ['castle', 'cave_large', 'temple_pillar', 'magic_crystal'],
    cave: { type: 'big_dungeon', entrances: [[4120, 1260], [3880, 1180], [4450, 760]], lv: [44, 50], lore: 'Орден Ледяных Рыцарей охраняет сердце зимы; финальная цель северной ветки.' } },
  { id: 'cave_kings_barrow', ru: 'Курган Королей', kind: 'cave', anchor: [5650, 3980], purpose: 'гробница под Медовыми Холмами', props: ['cave_ruins', 'obelisk', 'statue_broken'],
    cave: { type: 'tomb', entrances: [[5650, 3980]], lv: [12, 16], lore: 'Здесь похоронены первые короли долины; призраки не дают пахать холмы.' } },
  { id: 'cave_sun_temple', ru: 'Храм Солнца', kind: 'cave', anchor: [3270, 6610], purpose: 'пустынный храм в стене Наковальни', props: ['temple', 'temple_pillar', 'statue'],
    cave: { type: 'desert_temple', entrances: [[3270, 6610]], lv: [38, 42], lore: 'Жрецы запечатали в храме солнечный камень, которым когда-то орошали пустыню.' } },
  { id: 'cave_sand_kings', ru: 'Гробница Песчаных Царей', kind: 'cave', anchor: [5760, 6820], purpose: 'гробница в обрыве Одинокой Месы', props: ['cave_ruins', 'temple_pillar', 'obelisk'],
    cave: { type: 'tomb', entrances: [[5760, 6820], [6050, 7000]], lv: [37, 40], lore: 'Два входа: парадный с запада и грабительский лаз с востока.' } },
  { id: 'cave_scorpion_nest', ru: 'Гнездо Скорпионов', kind: 'cave', anchor: [6950, 6450], purpose: 'логово скорпионов в Красных Скалах', props: ['cave_medium', 'bush_dry'],
    cave: { type: 'beast_den', entrances: [[6950, 6450]], lv: [36, 39], lore: 'Матка скорпионов охраняет кладку — яд нужен алхимику Приюта.' } },
  { id: 'cave_raider_hole', ru: 'Пещера Налётчиков', kind: 'cave', anchor: [3170, 6200], purpose: 'укрытие налётчиков в стене Разлома', props: ['cave_medium', 'camp_crates', 'camp_banner'],
    cave: { type: 'bandit_hideout', entrances: [[3170, 6200]], lv: [29, 32], lore: 'Отсюда налётчики спускаются к Козьей тропе и грабят контрабандистов.' } },
  { id: 'cave_ash_mines', ru: 'Орочьи Копи Пепельного Хребта', kind: 'cave', anchor: [6300, 5200], purpose: 'большое подземелье орков, три входа', props: ['cave_large', 'camp_forge', 'camp_palisade', 'mine_rails'],
    cave: { type: 'big_dungeon', entrances: [[6300, 5200], [6450, 5450], [6050, 5260]], lv: [24, 28], lore: 'Орки роют ход под перевалом, чтобы выйти к Медовым Холмам.' } },
  { id: 'cave_bat_grotto', ru: 'Мышиный Грот', kind: 'cave', anchor: [1450, 2250], purpose: 'пещера летучих мышей в Западном Гребне', props: ['cave_small', 'stalagmites'],
    cave: { type: 'beast_den', entrances: [[1450, 2250]], lv: [19, 22], lore: 'Гуано из грота — ценное удобрение для хуторов.' } },
  { id: 'cave_drowned_crypt', ru: 'Утопленный склеп', kind: 'cave', anchor: [2300, 5020], purpose: 'склеп под затопленной часовней (люк)', props: ['ruin_stairs', 'cave_ruins'],
    cave: { type: 'tomb', entrances: [[2300, 5020]], lv: [16, 18], lore: 'Ведьма топей поднимает утопленников из склепа.', noCliff: true } },
  { id: 'cave_troll_lair', ru: 'Троллья Берлога', kind: 'cave', anchor: [1380, 3000], purpose: 'берлога лесного тролля в Западном Гребне', props: ['cave_medium', 'camp_skull_trophy'],
    cave: { type: 'beast_den', entrances: [[1380, 3000]], lv: [21, 22], lore: 'Тролль Камнелоб разорил Кремнёвый карьер.' } },
  { id: 'cave_ice_troll', ru: 'Пещера Ледяного Тролля', kind: 'cave', anchor: [6950, 1480], purpose: 'берлога ледяных троллей на краю Тура', props: ['cave_large', 'camp_skull_trophy'],
    cave: { type: 'beast_den', entrances: [[6950, 1480]], lv: [34, 38], lore: 'Отсюда тролли спускаются на Тур во время бурь.' } },
  { id: 'cave_fjord', ru: 'Грот Китового Зуба', kind: 'cave', anchor: [5120, 900], purpose: 'морская пещера во фьорде', props: ['cave_medium', 'water_driftwood'],
    cave: { type: 'underground_lake', entrances: [[5120, 900]], lv: [32, 36], lore: 'Берсерки прячут здесь драккар; второй вход — с моря.' } },
];

/** Спокойные пустые зоны: без лагерей и объектов — место для отдыха игрока, видов и будущих событий. validate.ts следит, чтобы в радиусе не было лагерей. */
export const CALM_AREAS: { id: string; ru: string; at: [number, number]; r: number; why: string }[] = [
  { id: 'calm_east_shore', ru: 'Тихий Берег', at: [7600, 2800], r: 300, why: 'пустой луговой берег моря — передышка после Медовых Холмов, вид на закат' },
  { id: 'calm_honey', ru: 'Медовые Поляны', at: [5300, 3400], r: 300, why: 'цветочные поляны без врагов, только пчёлы-декор и травы для сбора' },
  { id: 'calm_west', ru: 'Западные Луга у Гребня', at: [500, 2400], r: 300, why: 'спокойная окраина Западного Гребня для исследования без боя' },
  { id: 'calm_south_coast', ru: 'Южная Бухта', at: [7000, 4700], r: 260, why: 'пустой пляж восточного берега, место под будущую рыбалку' },
  { id: 'calm_oasis_palms', ru: 'Пальмовая Роща', at: [5100, 5500], r: 260, why: 'тень и вода после жары степи — безопасный привал на караванном пути' },
  { id: 'calm_dunes', ru: 'Пустая Гладь Дюн', at: [900, 6700], r: 320, why: 'нарочно пустое море песка: ощущение одиночества и масштаба' },
  { id: 'calm_mesa_foot', ru: 'Подножие Столовых Гор', at: [3400, 7600], r: 260, why: 'тихая долина у юго-западных мес, вид на страты' },
  { id: 'calm_fang_snow', ru: 'Снежное Плато Белого Клыка', at: [3400, 500], r: 260, why: 'безмолвное высокогорье: только ветер и снег' },
];
