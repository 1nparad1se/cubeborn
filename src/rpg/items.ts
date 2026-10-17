/**
 * Starter items: seven weapons, a shield and three armor sets (12 pieces). Pure data — the
 * numbers here are the whole balance (see docs/rpg/README.md for the tables).
 */

export type Slot = 'main' | 'off' | 'head' | 'hands' | 'feet' | 'body';
export const SLOTS: Slot[] = ['main', 'off', 'head', 'hands', 'feet', 'body'];
export const SLOT_NAME: Record<Slot, string> = {
  main: 'Основная рука',
  off: 'Вторая рука',
  head: 'Шлем',
  hands: 'Перчатки',
  feet: 'Ботинки',
  body: 'Доспех',
};

export type WeaponKind = 'sword1h' | 'sword2h' | 'spear' | 'staff1h' | 'staff2h' | 'bow' | 'crossbow';
export type DamageType = 'phys' | 'magic';
/** melee: one target in reach; sweep: every target in a rectangle in front; projectile: flies to the target. */
export type AttackShape = 'melee' | 'sweep' | 'projectile';

export interface WeaponStats {
  kind: WeaponKind;
  dmgType: DamageType;
  shape: AttackShape;
  /** Damage of one hit. */
  damage: number;
  /** Seconds from the start of one attack to the next (before speed bonuses). */
  interval: number;
  /** Fraction of the interval when the hit lands / the shot leaves (swing, draw, cast). */
  hitAt: number;
  /** Reach (melee, blocks from the body) or flight distance (projectiles). */
  range: number;
  /** Sweep: half-width of the hit rectangle. */
  halfWidth?: number;
  /** Projectile speed, blocks per second. */
  projSpeed?: number;
  /** Projectile look. */
  proj?: 'arrow' | 'bolt' | 'spark' | 'orb';
}

/** Bonus stats; percentages are fractions (0.05 = +5 %). */
export interface ItemStats {
  physDef?: number;
  magicDmg?: number;
  castSpeed?: number;
  moveSpeed?: number;
  atkSpeed?: number;
}

export type ArmorSet = 'apprentice' | 'scout' | 'guard';

export interface ItemDef {
  id: string;
  name: string;
  /** Short type line («Одноручный меч»). */
  type: string;
  desc: string;
  slot: Slot;
  twoHanded?: boolean;
  weapon?: WeaponStats;
  stats: ItemStats;
  armorSet?: ArmorSet;
  /** Armor weight class for the tooltip. */
  armorClass?: 'Магическая' | 'Лёгкая' | 'Тяжёлая';
}

export const ITEMS: ItemDef[] = [
  // ------------------------------------------------------------------ weapons
  {
    id: 'sword_recruit',
    name: 'Железный меч новобранца',
    type: 'Одноручный меч',
    desc: 'Быстрые удары по одной цели. Можно взять щит во вторую руку.',
    slot: 'main',
    weapon: { kind: 'sword1h', dmgType: 'phys', shape: 'melee', damage: 14, interval: 0.6, hitAt: 0.45, range: 2.3 },
    stats: {},
  },
  {
    id: 'sword_guard2h',
    name: 'Двуручный меч стражника',
    type: 'Двуручный меч',
    desc: 'Медленный тяжёлый удар по одной цели. Занимает обе руки.',
    slot: 'main',
    twoHanded: true,
    weapon: { kind: 'sword2h', dmgType: 'phys', shape: 'melee', damage: 40, interval: 1.55, hitAt: 0.55, range: 2.6 },
    stats: {},
  },
  {
    id: 'spear_militia',
    name: 'Железная пика ополченца',
    type: 'Пика',
    desc: 'Длинный выпад: задевает все цели в полосе перед собой. Занимает обе руки.',
    slot: 'main',
    twoHanded: true,
    weapon: { kind: 'spear', dmgType: 'phys', shape: 'sweep', damage: 24, interval: 1.15, hitAt: 0.5, range: 3.6, halfWidth: 1.0 },
    stats: {},
  },
  {
    id: 'staff_spark',
    name: 'Малый посох искры',
    type: 'Одноручный магический посох',
    desc: 'Быстро выпускает искру — снаряд с небольшим магическим уроном. Можно взять щит.',
    slot: 'main',
    weapon: { kind: 'staff1h', dmgType: 'magic', shape: 'projectile', damage: 12, interval: 0.7, hitAt: 0.5, range: 12, projSpeed: 16, proj: 'spark' },
    stats: {},
  },
  {
    id: 'staff_apprentice',
    name: 'Посох ученика',
    type: 'Двуручный магический посох',
    desc: 'Долгое заклинание: тяжёлая магическая сфера. Занимает обе руки.',
    slot: 'main',
    twoHanded: true,
    weapon: { kind: 'staff2h', dmgType: 'magic', shape: 'projectile', damage: 36, interval: 1.8, hitAt: 0.62, range: 14, projSpeed: 12, proj: 'orb' },
    stats: {},
  },
  {
    id: 'bow_hunter',
    name: 'Охотничий лук',
    type: 'Лук',
    desc: 'Натянуть и выстрелить: стреляет чаще арбалета, но слабее. Занимает обе руки.',
    slot: 'main',
    twoHanded: true,
    weapon: { kind: 'bow', dmgType: 'phys', shape: 'projectile', damage: 15, interval: 0.8, hitAt: 0.6, range: 16, projSpeed: 24, proj: 'arrow' },
    stats: {},
  },
  {
    id: 'crossbow_light',
    name: 'Лёгкий арбалет',
    type: 'Арбалет',
    desc: 'Мощный выстрел и долгая перезарядка после него. Занимает обе руки.',
    slot: 'main',
    twoHanded: true,
    weapon: { kind: 'crossbow', dmgType: 'phys', shape: 'projectile', damage: 38, interval: 1.95, hitAt: 0.14, range: 18, projSpeed: 30, proj: 'bolt' },
    stats: {},
  },
  {
    id: 'shield_wood',
    name: 'Деревянный щит с железным ободом',
    type: 'Щит',
    desc: 'Вторая рука. Повышает физическую защиту. Совместим с одноручным мечом и одноручным посохом.',
    slot: 'off',
    stats: { physDef: 10 },
  },
  // ------------------------------------------------------------------ armor: apprentice (magic)
  { id: 'app_hood', name: 'Капюшон ученика', type: 'Шлем', desc: 'Комплект ученика.', slot: 'head', armorSet: 'apprentice', armorClass: 'Магическая', stats: { physDef: 1, magicDmg: 0.04, castSpeed: 0.03 } },
  { id: 'app_gloves', name: 'Перчатки ученика', type: 'Перчатки', desc: 'Комплект ученика.', slot: 'hands', armorSet: 'apprentice', armorClass: 'Магическая', stats: { physDef: 1, castSpeed: 0.06 } },
  { id: 'app_boots', name: 'Ботинки ученика', type: 'Ботинки', desc: 'Комплект ученика.', slot: 'feet', armorSet: 'apprentice', armorClass: 'Магическая', stats: { physDef: 1, magicDmg: 0.03 } },
  { id: 'app_robe', name: 'Одеяние ученика', type: 'Доспех', desc: 'Комплект ученика.', slot: 'body', armorSet: 'apprentice', armorClass: 'Магическая', stats: { physDef: 3, magicDmg: 0.08, castSpeed: 0.04 } },
  // ------------------------------------------------------------------ armor: scout (light)
  { id: 'scout_helm', name: 'Кожаный шлем разведчика', type: 'Шлем', desc: 'Комплект разведчика.', slot: 'head', armorSet: 'scout', armorClass: 'Лёгкая', stats: { physDef: 3, atkSpeed: 0.02 } },
  { id: 'scout_gloves', name: 'Перчатки разведчика', type: 'Перчатки', desc: 'Комплект разведчика.', slot: 'hands', armorSet: 'scout', armorClass: 'Лёгкая', stats: { physDef: 2, atkSpeed: 0.05 } },
  { id: 'scout_boots', name: 'Ботинки разведчика', type: 'Ботинки', desc: 'Комплект разведчика.', slot: 'feet', armorSet: 'scout', armorClass: 'Лёгкая', stats: { physDef: 2, moveSpeed: 0.04 } },
  { id: 'scout_armor', name: 'Доспех разведчика', type: 'Доспех', desc: 'Комплект разведчика.', slot: 'body', armorSet: 'scout', armorClass: 'Лёгкая', stats: { physDef: 6, moveSpeed: 0.02, atkSpeed: 0.03 } },
  // ------------------------------------------------------------------ armor: guard (heavy)
  { id: 'guard_helm', name: 'Железный шлем стражника', type: 'Шлем', desc: 'Комплект стражника.', slot: 'head', armorSet: 'guard', armorClass: 'Тяжёлая', stats: { physDef: 6, moveSpeed: -0.01 } },
  { id: 'guard_gloves', name: 'Перчатки стражника', type: 'Перчатки', desc: 'Комплект стражника.', slot: 'hands', armorSet: 'guard', armorClass: 'Тяжёлая', stats: { physDef: 4 } },
  { id: 'guard_boots', name: 'Ботинки стражника', type: 'Ботинки', desc: 'Комплект стражника.', slot: 'feet', armorSet: 'guard', armorClass: 'Тяжёлая', stats: { physDef: 5, moveSpeed: -0.02 } },
  { id: 'guard_cuirass', name: 'Кираса стражника', type: 'Доспех', desc: 'Комплект стражника.', slot: 'body', armorSet: 'guard', armorClass: 'Тяжёлая', stats: { physDef: 12, moveSpeed: -0.03 } },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function item(id: string | null | undefined): ItemDef | null {
  return (id && ITEM_BY_ID[id]) || null;
}

/** Every new character starts with one of each item in the bag. */
export const STARTER_ITEMS: string[] = ITEMS.map((i) => i.id);

/** Bag size (grid 6 × 4). */
export const BAG_SIZE = 24;

export const ARMOR_SETS: { id: ArmorSet; name: string; cls: string; items: string[] }[] = [
  { id: 'apprentice', name: 'Комплект ученика', cls: 'Магическая', items: ['app_hood', 'app_gloves', 'app_boots', 'app_robe'] },
  { id: 'scout', name: 'Комплект разведчика', cls: 'Лёгкая', items: ['scout_helm', 'scout_gloves', 'scout_boots', 'scout_armor'] },
  { id: 'guard', name: 'Комплект стражника', cls: 'Тяжёлая', items: ['guard_helm', 'guard_gloves', 'guard_boots', 'guard_cuirass'] },
];

/** Damage per second of a weapon on one target, before bonuses. */
export function baseDps(w: WeaponStats): number {
  return w.damage / w.interval;
}
