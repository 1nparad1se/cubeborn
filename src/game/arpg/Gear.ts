import type { Loc, Rarity, StatMods } from '../../data/types';
import { RARITIES } from '../../data/types';
import type { DmgType } from '../types';
import { POWERS } from '../action/powers';

/**
 * Loot: equipment slots, base items, affixes and item generation. Items are plain JSON so they
 * live in the save file as they are.
 */

export type GearSlot = 'weapon' | 'helm' | 'armor' | 'gloves' | 'boots' | 'amulet' | 'ring' | 'trinket';
/** Equipment positions on the hero (two rings). */
export type EquipPos = 'weapon' | 'helm' | 'armor' | 'gloves' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'trinket';
export const EQUIP_POS: EquipPos[] = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'ring1', 'ring2', 'trinket'];

export function slotOf(pos: EquipPos): GearSlot {
  return pos === 'ring1' || pos === 'ring2' ? 'ring' : pos;
}

/** Stats an affix can roll. StatMods keys plus action-RPG extras. */
export type AffixStat =
  | 'might' | 'maxHp' | 'armor' | 'moveSpeed' | 'critChance' | 'critDamage' | 'cooldown' | 'regen' | 'area' | 'lifesteal' | 'duration' | 'luck' | 'greed'
  | 'atkSpeed' | 'resRegen' | 'resMax' | 'skillDmg'
  | 'dmg_phys' | 'dmg_fire' | 'dmg_ice' | 'dmg_lightning' | 'dmg_poison' | 'dmg_dark' | 'dmg_magic';

export interface Affix {
  stat: AffixStat;
  v: number;
}

export interface Item {
  uid: string;
  slot: GearSlot;
  base: string;
  rarity: Rarity;
  ilvl: number;
  /** Fixed stat of the base type. */
  implicit: Affix;
  affixes: Affix[];
  /** Legendary power: a build modifier granted while worn. */
  power?: string;
  /** Name parts (indices) so names stay translatable. */
  prefix: number;
  suffix: number;
}

interface BaseDef {
  id: string;
  slot: GearSlot;
  name: Loc;
  icon: string;
  implicit: AffixStat;
  /** Implicit value at item level 1 and per level. */
  iv: [number, number];
}

const loc = (ru: string, en: string): Loc => ({ ru, en });

export const BASES: BaseDef[] = [
  { id: 'blade', slot: 'weapon', name: loc('Клинок', 'Blade'), icon: 'sword', implicit: 'might', iv: [0.06, 0.008] },
  { id: 'axe', slot: 'weapon', name: loc('Топор', 'Axe'), icon: 'glaive', implicit: 'critDamage', iv: [0.15, 0.015] },
  { id: 'staff', slot: 'weapon', name: loc('Посох', 'Staff'), icon: 'staff', implicit: 'skillDmg', iv: [0.08, 0.01] },
  { id: 'bow', slot: 'weapon', name: loc('Лук', 'Bow'), icon: 'bow', implicit: 'atkSpeed', iv: [0.06, 0.006] },
  { id: 'helm', slot: 'helm', name: loc('Шлем', 'Helm'), icon: 'crown', implicit: 'maxHp', iv: [10, 2] },
  { id: 'hood', slot: 'helm', name: loc('Капюшон', 'Hood'), icon: 'eye', implicit: 'cooldown', iv: [0.03, 0.002] },
  { id: 'plate', slot: 'armor', name: loc('Латы', 'Plate'), icon: 'plate', implicit: 'armor', iv: [2, 0.35] },
  { id: 'robe', slot: 'armor', name: loc('Мантия', 'Robe'), icon: 'banner', implicit: 'resRegen', iv: [1, 0.15] },
  { id: 'gloves', slot: 'gloves', name: loc('Перчатки', 'Gloves'), icon: 'gauntlet', implicit: 'atkSpeed', iv: [0.04, 0.004] },
  { id: 'boots', slot: 'boots', name: loc('Сапоги', 'Boots'), icon: 'boots', implicit: 'moveSpeed', iv: [0.04, 0.003] },
  { id: 'amulet', slot: 'amulet', name: loc('Амулет', 'Amulet'), icon: 'charm', implicit: 'resMax', iv: [10, 1] },
  { id: 'ring', slot: 'ring', name: loc('Кольцо', 'Ring'), icon: 'rune', implicit: 'critChance', iv: [0.02, 0.0015] },
  { id: 'idol', slot: 'trinket', name: loc('Идол', 'Idol'), icon: 'idol', implicit: 'luck', iv: [0.05, 0.004] },
];

export const BASE_BY_ID: Record<string, BaseDef> = Object.fromEntries(BASES.map((b) => [b.id, b]));

/** Affix roll ranges at item level 1 (min, max) and growth per item level (fraction of base). */
const AFFIX: Record<AffixStat, { r: [number, number]; g: number; pct: boolean }> = {
  might: { r: [0.04, 0.08], g: 0.06, pct: true },
  maxHp: { r: [8, 16], g: 0.08, pct: false },
  armor: { r: [1, 3], g: 0.08, pct: false },
  moveSpeed: { r: [0.03, 0.06], g: 0.02, pct: true },
  critChance: { r: [0.02, 0.04], g: 0.03, pct: true },
  critDamage: { r: [0.1, 0.2], g: 0.05, pct: true },
  cooldown: { r: [0.03, 0.05], g: 0.02, pct: true },
  regen: { r: [0.3, 0.8], g: 0.08, pct: false },
  area: { r: [0.05, 0.1], g: 0.03, pct: true },
  lifesteal: { r: [0.5, 1.2], g: 0.06, pct: false },
  duration: { r: [0.06, 0.12], g: 0.03, pct: true },
  luck: { r: [0.05, 0.1], g: 0.03, pct: true },
  greed: { r: [0.06, 0.12], g: 0.03, pct: true },
  atkSpeed: { r: [0.04, 0.08], g: 0.03, pct: true },
  resRegen: { r: [1, 2], g: 0.06, pct: false },
  resMax: { r: [8, 15], g: 0.05, pct: false },
  skillDmg: { r: [0.05, 0.1], g: 0.06, pct: true },
  dmg_phys: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_fire: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_ice: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_lightning: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_poison: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_dark: { r: [0.08, 0.15], g: 0.06, pct: true },
  dmg_magic: { r: [0.08, 0.15], g: 0.06, pct: true },
};

export const AFFIX_STATS = Object.keys(AFFIX) as AffixStat[];

export function isPct(stat: AffixStat): boolean {
  return AFFIX[stat].pct;
}

/** Affix count by rarity. */
const AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const RARITY_MUL: Record<Rarity, number> = { common: 1, uncommon: 1.1, rare: 1.25, epic: 1.45, legendary: 1.7 };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#d8d8d8', uncommon: '#5ad66a', rare: '#5ab4ff', epic: '#c070ff', legendary: '#ff9a2a' };
export const RARITY_HEX: Record<Rarity, number> = { common: 0xd8d8d8, uncommon: 0x5ad66a, rare: 0x5ab4ff, epic: 0xc070ff, legendary: 0xff9a2a };

const PREFIX: Loc[] = [
  loc('Крепкий', 'Sturdy'), loc('Пылающий', 'Blazing'), loc('Ледяной', 'Frozen'), loc('Грозовой', 'Stormy'), loc('Ядовитый', 'Venomous'),
  loc('Сумрачный', 'Dusky'), loc('Рунный', 'Runic'), loc('Быстрый', 'Swift'), loc('Кровавый', 'Bloody'), loc('Древний', 'Ancient'),
  loc('Звёздный', 'Starlit'), loc('Каменный', 'Stone'),
];
const SUFFIX: Loc[] = [
  loc('медведя', 'of the Bear'), loc('лиса', 'of the Fox'), loc('ворона', 'of the Raven'), loc('бури', 'of the Storm'), loc('пепла', 'of Ash'),
  loc('инея', 'of Frost'), loc('теней', 'of Shadows'), loc('рассвета', 'of Dawn'), loc('глубин', 'of the Deep'), loc('королей', 'of Kings'),
];

let uidN = 0;
function newUid(): string {
  return Date.now().toString(36) + '-' + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6);
}

function round(stat: AffixStat, v: number): number {
  return AFFIX[stat].pct ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;
}

/** Rolls a rarity; `bonus` shifts odds toward rarer items (elites, bosses, luck). */
export function rollRarity(rand: () => number, bonus = 0): Rarity {
  const w = [60, 26, 10, 3.2, 0.8].map((x, i) => (i === 0 ? x : x * (1 + bonus * i)));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) {
    r -= w[i];
    if (r <= 0) return RARITIES[i];
  }
  return 'common';
}

export function makeItem(rand: () => number, ilvl: number, rarity: Rarity, baseId?: string): Item {
  const base = baseId ? BASE_BY_ID[baseId] : BASES[Math.floor(rand() * BASES.length)];
  const rm = RARITY_MUL[rarity];
  const implicit: Affix = { stat: base.implicit, v: round(base.implicit, (base.iv[0] + base.iv[1] * (ilvl - 1)) * rm) };
  const affixes: Affix[] = [];
  const used = new Set<AffixStat>([base.implicit]);
  const n = AFFIX_COUNT[rarity];
  while (affixes.length < n) {
    const stat = AFFIX_STATS[Math.floor(rand() * AFFIX_STATS.length)];
    if (used.has(stat)) continue;
    // at most one elemental damage line per item
    if (stat.startsWith('dmg_') && [...used].some((s) => s.startsWith('dmg_'))) continue;
    used.add(stat);
    const a = AFFIX[stat];
    const v = (a.r[0] + rand() * (a.r[1] - a.r[0])) * (1 + a.g * (ilvl - 1)) * rm;
    affixes.push({ stat, v: round(stat, v) });
  }
  const item: Item = {
    uid: newUid(),
    slot: base.slot,
    base: base.id,
    rarity,
    ilvl,
    implicit,
    affixes,
    prefix: Math.floor(rand() * PREFIX.length),
    suffix: Math.floor(rand() * SUFFIX.length),
  };
  if (rarity === 'legendary') item.power = POWERS[Math.floor(rand() * POWERS.length)].id;
  return item;
}

export function itemName(it: Item, lang: 'ru' | 'en'): string {
  const b = BASE_BY_ID[it.base];
  const bn = b ? b.name[lang] : it.base;
  if (it.rarity === 'common') return bn;
  if (it.rarity === 'uncommon') return `${adj(PREFIX[it.prefix % PREFIX.length][lang], bn, lang)}`;
  return `${adj(PREFIX[it.prefix % PREFIX.length][lang], bn, lang)} ${SUFFIX[it.suffix % SUFFIX.length][lang]}`;
}

/** Russian adjective agreement with the base noun's gender (rough but readable). */
function adj(a: string, noun: string, lang: 'ru' | 'en'): string {
  if (lang !== 'ru') return `${a} ${noun}`;
  const fem = /(а|я|ь)$/.test(noun) && noun !== 'Посох';
  const plural = /(ы|и)$/.test(noun);
  let w = a;
  if (plural) w = a.replace(/(ый|ий|ой)$/, (m) => (m === 'ий' ? 'ие' : 'ые'));
  else if (fem) w = a.replace(/(ый|ой)$/, 'ая').replace(/ий$/, 'яя');
  return `${w} ${noun}`;
}

export function baseIcon(it: Item): string {
  return BASE_BY_ID[it.base]?.icon ?? 'chest';
}

/** All stat lines of an item (implicit first). */
export function itemStats(it: Item): Affix[] {
  return [it.implicit, ...it.affixes];
}

/** Gear totals: StatMods for resolveStats plus the action-RPG extras. */
export interface GearTotals {
  mods: StatMods;
  atkSpeed: number;
  resRegen: number;
  resMax: number;
  skillDmg: number;
  elem: Partial<Record<DmgType, number>>;
  powers: string[];
}

export function gearTotals(items: (Item | null | undefined)[], baseHp: number): GearTotals {
  const out: GearTotals = { mods: {}, atkSpeed: 0, resRegen: 0, resMax: 0, skillDmg: 0, elem: {}, powers: [] };
  for (const it of items) {
    if (!it) continue;
    for (const a of itemStats(it)) addAffix(out, a, baseHp);
    if (it.power) out.powers.push(it.power);
  }
  return out;
}

function addAffix(out: GearTotals, a: Affix, baseHp: number) {
  void baseHp;
  switch (a.stat) {
    case 'atkSpeed':
      out.atkSpeed += a.v;
      return;
    case 'resRegen':
      out.resRegen += a.v;
      return;
    case 'resMax':
      out.resMax += a.v;
      return;
    case 'skillDmg':
      out.skillDmg += a.v;
      return;
  }
  if (a.stat.startsWith('dmg_')) {
    const el = a.stat.slice(4) as DmgType;
    out.elem[el] = (out.elem[el] ?? 0) + a.v;
    return;
  }
  const k = a.stat as keyof StatMods;
  out.mods[k] = (out.mods[k] ?? 0) + a.v;
}

/** Gold an item sells for. */
export function sellPrice(it: Item): number {
  const r = RARITIES.indexOf(it.rarity);
  return Math.round((2 + it.ilvl * 0.6) * [1, 2, 4, 8, 16][r]);
}

/** A rough power score used to say whether an item is an upgrade. */
export function score(it: Item | null | undefined): number {
  if (!it) return 0;
  let s = 0;
  for (const a of itemStats(it)) {
    const ref = AFFIX[a.stat].r[1];
    s += a.v / ref;
  }
  return s + (it.power ? 3 : 0);
}
