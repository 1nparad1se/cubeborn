/**
 * Этап 4: состав деревень. Каждое здание — назначение, размер (блоки), желаемое место.
 * build.ts раскладывает их по площадке деревни (кольца вокруг центра, фасадом к ближайшей дороге,
 * не на дорогах и не в воде) и пишет итоговые координаты в world/generated.json.
 * place: 'center' — у площади, 'ring' — общий порядок, 'edge' — по краю площадки,
 * 'river' — на берегу реки (мельница), 'gate' — у въезда (на дороге наружу).
 */
export interface BuildingSpec { id: string; ru: string; type: string; purpose: string; size: [number, number]; place: 'center' | 'ring' | 'edge' | 'river' | 'gate'; props: string[] }
export interface VillageSpec { village: string; style: string; buildings: BuildingSpec[]; extras: { ru: string; purpose: string; prop: string }[] }

const house = (n: number, ru: string, purpose: string, style: string[]): BuildingSpec => ({ id: `house${n}`, ru, type: 'house', purpose, size: [7, 9], place: 'ring', props: style });

export const VILLAGE_SPECS: VillageSpec[] = [
  {
    village: 'zelenodol', style: 'фахверк, соломенные и тёсовые крыши, плетни',
    buildings: [
      { id: 'well', ru: 'Колодец', type: 'well', purpose: 'центр площади, точка сбора', size: [3, 3], place: 'center', props: ['shrine'] },
      { id: 'tavern', ru: 'Таверна «Сытый Кабан»', type: 'tavern', purpose: 'ночлег, слухи, доска заданий', size: [12, 14], place: 'center', props: ['hanging_lantern', 'barrel', 'camp_table_chairs'] },
      { id: 'elder', ru: 'Дом старосты', type: 'elder', purpose: 'выдаёт стартовые задания', size: [9, 11], place: 'center', props: ['camp_banner', 'floor_lantern'] },
      { id: 'smithy', ru: 'Кузница', type: 'smithy', purpose: 'ковка и ремонт оружия', size: [9, 9], place: 'ring', props: ['camp_forge', 'camp_weapon_rack'] },
      { id: 'shop_general', ru: 'Лавка торговца', type: 'shop', purpose: 'припасы, продажа добычи', size: [8, 9], place: 'ring', props: ['table_goods', 'crate_stack'] },
      { id: 'shop_herbs', ru: 'Лавка травницы', type: 'shop', purpose: 'зелья и травы', size: [7, 8], place: 'ring', props: ['flowers_purple', 'sack'] },
      { id: 'warehouse', ru: 'Склад', type: 'warehouse', purpose: 'запасы зерна для хуторов', size: [10, 12], place: 'edge', props: ['crate_big', 'sack_pile', 'cart'] },
      { id: 'barn', ru: 'Амбар', type: 'barn', purpose: 'сено и инвентарь', size: [9, 11], place: 'edge', props: ['hay_bale', 'cart'] },
      { id: 'mill', ru: 'Водяная мельница', type: 'mill', purpose: 'мелет зерно с Хутора Колосок', size: [9, 9], place: 'river', props: ['waterfall_spill', 'sack_pile'] },
      { id: 'pen', ru: 'Загон', type: 'pen', purpose: 'овцы и козы', size: [14, 10], place: 'edge', props: ['camp_palisade', 'hay_bale'] },
      house(1, 'Дом плотника', 'плотник чинит мост и телеги', ['plank_stack']),
      house(2, 'Дом охотника', 'учит охоте на кабанов', ['camp_skull_trophy']),
      house(3, 'Дом рыбака', 'рыба из Светлой', ['water_pier']),
      house(4, 'Дом пасечника', 'хозяин Пасеки Медуницы', ['crate_produce']),
      house(5, 'Дом вдовы Марфы', 'квестодатель (пропавший сын)', ['flowers_red']),
      house(6, 'Дом стражника', 'местный ополченец', ['camp_weapon_rack']),
      house(7, 'Дом ткачихи', 'ткани и сумки', ['sack']),
      house(8, 'Пустой дом', 'можно купить/заселить позже', ['crate_broken']),
    ],
    extras: [
      { ru: 'Деревянный мост через Светлую', purpose: 'южный выезд к тракту на пустыню', prop: 'bridge_wood_arched' },
      { ru: 'Огороды и плетни', purpose: 'вокруг жилых домов', prop: 'combo_fence_bush' },
    ],
  },
  {
    village: 'snezhny', style: 'срубы на каменном цоколе, крутые крыши, частокол',
    buildings: [
      { id: 'tavern', ru: 'Таверна «Тёплый Очаг»', type: 'tavern', purpose: 'ночлег, горячая еда, слухи о Короне', size: [11, 13], place: 'center', props: ['chandelier', 'barrel'] },
      { id: 'smithy', ru: 'Кузница рудознатца', type: 'smithy', purpose: 'перековка меди с рудника', size: [9, 9], place: 'center', props: ['camp_forge', 'mine_lantern'] },
      { id: 'supply', ru: 'Лавка снабжения', type: 'shop', purpose: 'тёплая одежда, факелы, верёвки', size: [8, 9], place: 'ring', props: ['crate_stack', 'sack_pile'] },
      { id: 'elder', ru: 'Дом старосты', type: 'elder', purpose: 'задания по волкам и берсеркам', size: [9, 10], place: 'ring', props: ['camp_banner'] },
      { id: 'tower', ru: 'Сторожевая вышка', type: 'watchtower', purpose: 'дозор над ущельем и перевалом', size: [5, 5], place: 'edge', props: ['camp_watchtower', 'fire_bowl'] },
      { id: 'shelter1', ru: 'Штормовое укрытие (север)', type: 'shelter', purpose: 'укрытие в буран', size: [6, 6], place: 'edge', props: ['camp_storehouse', 'floor_lantern'] },
      { id: 'shelter2', ru: 'Штормовое укрытие (юг)', type: 'shelter', purpose: 'укрытие в буран', size: [6, 6], place: 'edge', props: ['camp_storehouse'] },
      { id: 'warehouse', ru: 'Рудный склад', type: 'warehouse', purpose: 'медь с рудника', size: [9, 11], place: 'edge', props: ['crate_reinforced', 'cart', 'mine_rails'] },
      house(1, 'Дом рудокопа', 'работа на Медном руднике', ['mine_lantern']),
      house(2, 'Дом оленевода', 'хозяин Оленьего загона', ['hay_bale']),
      house(3, 'Дом проводника', 'водит через Перевал Ветров', ['camp_banner']),
      house(4, 'Дом знахарки', 'лечит обморожения', ['sack']),
    ],
    extras: [
      { ru: 'Мост через горную Светлую', purpose: 'тропа к Медному руднику', prop: 'bridge_wood_chained' },
      { ru: 'Частокол', purpose: 'защита от волков', prop: 'camp_palisade' },
    ],
  },
  {
    village: 'peschany', style: 'глинобитные и каменные дома с плоскими крышами, тканевые навесы',
    buildings: [
      { id: 'well', ru: 'Большой колодец', type: 'well', purpose: 'вода из-под оазиса', size: [4, 4], place: 'center', props: ['shrine'] },
      { id: 'market', ru: 'Рынок', type: 'market', purpose: 'караванная торговля, навесы с товаром', size: [16, 16], place: 'center', props: ['camp_canopy', 'table_goods', 'crate_produce'] },
      { id: 'tavern', ru: 'Таверна «Колодец Путника»', type: 'tavern', purpose: 'ночлег караванщиков', size: [11, 13], place: 'ring', props: ['hanging_lantern', 'camp_table_chairs'] },
      { id: 'smithy', ru: 'Кузница', type: 'smithy', purpose: 'кривые клинки, ремонт', size: [9, 9], place: 'ring', props: ['camp_forge'] },
      { id: 'warehouse', ru: 'Караван-сарай (склад)', type: 'warehouse', purpose: 'хранение грузов караванов', size: [12, 12], place: 'edge', props: ['crate_stack', 'sack_pile', 'cart'] },
      { id: 'pen1', ru: 'Загон для вьючных животных', type: 'pen', purpose: 'вьючные животные караванов', size: [14, 10], place: 'edge', props: ['camp_palisade', 'hay_bale'] },
      { id: 'pen2', ru: 'Козий загон', type: 'pen', purpose: 'козы', size: [10, 8], place: 'edge', props: ['camp_palisade'] },
      { id: 'guard_n', ru: 'Пост стражи (север)', type: 'guard_post', purpose: 'охрана дороги к Мосту над Бездной', size: [4, 4], place: 'gate', props: ['camp_stone_tower', 'standing_torch'] },
      { id: 'guard_e', ru: 'Пост стражи (восток)', type: 'guard_post', purpose: 'охрана караванного пути', size: [4, 4], place: 'gate', props: ['camp_stone_tower', 'standing_torch'] },
      house(1, 'Дом караванщика', 'нанимает охрану караванов', ['camp_cart']),
      house(2, 'Дом алхимика', 'покупает яд скорпионов', ['camp_cauldron']),
      house(3, 'Дом смотрителя оазиса', 'следит за водой', ['palm_bush']),
    ],
    extras: [
      { ru: 'Тканевые навесы от солнца', purpose: 'над рынком и у домов', prop: 'camp_canopy' },
      { ru: 'Пальмы и грядки у оазиса', purpose: 'между деревней и водой', prop: 'palm_bush' },
    ],
  },
];
