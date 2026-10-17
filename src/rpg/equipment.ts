import { BAG_SIZE, ITEM_BY_ID, SLOTS, item, type ItemDef, type Slot, type WeaponStats } from './items';
import { RACE_BY_ID, type RaceDef } from './races';

/** What a character wears and carries. Bag cells hold item ids (null = empty cell). */
export interface Gear {
  equip: Record<Slot, string | null>;
  bag: (string | null)[];
}

export function emptyEquip(): Record<Slot, string | null> {
  return { main: null, off: null, head: null, hands: null, feet: null, body: null };
}

export function newGear(items: string[]): Gear {
  const bag: (string | null)[] = new Array(BAG_SIZE).fill(null);
  items.slice(0, BAG_SIZE).forEach((id, i) => (bag[i] = id));
  return { equip: emptyEquip(), bag };
}

export function cloneGear(g: Gear): Gear {
  return { equip: { ...g.equip }, bag: [...g.bag] };
}

/** Slot an item goes to. */
export function slotOf(def: ItemDef): Slot {
  return def.slot;
}

export function isTwoHanded(id: string | null): boolean {
  return !!item(id)?.twoHanded;
}

export type EquipResult = { ok: true; gear: Gear } | { ok: false; error: string };

function firstFree(bag: (string | null)[], skip = -1): number {
  for (let i = 0; i < bag.length; i++) if (i !== skip && bag[i] === null) return i;
  return -1;
}

/**
 * Equips the item in bag cell `from`. The item it replaces goes back into that cell; a shield is
 * returned to the bag when a two-handed weapon is taken, and a two-handed weapon when a shield is
 * taken. Fails (changing nothing) when the bag has no room for what comes off.
 */
export function equipFromBag(g: Gear, from: number): EquipResult {
  const id = g.bag[from];
  const def = item(id);
  if (!id || !def) return { ok: false, error: 'Пустая ячейка' };
  const out = cloneGear(g);
  const slot = slotOf(def);
  out.bag[from] = null;
  const returned: string[] = [];
  const prev = out.equip[slot];
  if (prev) returned.push(prev);
  out.equip[slot] = id;
  if (slot === 'main' && def.twoHanded && out.equip.off) {
    returned.push(out.equip.off);
    out.equip.off = null;
  }
  if (slot === 'off' && isTwoHanded(out.equip.main)) {
    returned.push(out.equip.main!);
    out.equip.main = null;
  }
  for (const r of returned) {
    const cell = out.bag[from] === null ? from : firstFree(out.bag);
    if (cell < 0) return { ok: false, error: 'Нет места в инвентаре' };
    out.bag[cell] = r;
  }
  return { ok: true, gear: out };
}

/** Takes off the item in `slot` into the first free bag cell (or cell `to` when it is free). */
export function unequip(g: Gear, slot: Slot, to = -1): EquipResult {
  const id = g.equip[slot];
  if (!id) return { ok: false, error: 'Слот пуст' };
  const out = cloneGear(g);
  const cell = to >= 0 && to < out.bag.length && out.bag[to] === null ? to : firstFree(out.bag);
  if (cell < 0) return { ok: false, error: 'Нет места в инвентаре' };
  out.bag[cell] = id;
  out.equip[slot] = null;
  return { ok: true, gear: out };
}

/** Equips bag cell `from` into a specific slot (drag and drop); the slot must fit the item. */
export function equipToSlot(g: Gear, from: number, slot: Slot): EquipResult {
  const def = item(g.bag[from]);
  if (!def) return { ok: false, error: 'Пустая ячейка' };
  if (slotOf(def) !== slot) return { ok: false, error: 'Этот предмет сюда не надевается' };
  return equipFromBag(g, from);
}

/** Swaps two bag cells (sorting by drag). */
export function moveInBag(g: Gear, a: number, b: number): Gear {
  const out = cloneGear(g);
  [out.bag[a], out.bag[b]] = [out.bag[b], out.bag[a]];
  return out;
}

/** Every item id the gear holds (equipped and carried), for conservation checks. */
export function allItems(g: Gear): string[] {
  return [...SLOTS.map((s) => g.equip[s]), ...g.bag].filter((x): x is string => !!x);
}

/** Rules that must always hold. Returns the broken rule or null. */
export function gearProblem(g: Gear): string | null {
  for (const s of SLOTS) {
    const id = g.equip[s];
    if (!id) continue;
    const def = ITEM_BY_ID[id];
    if (!def) return `unknown item ${id}`;
    if (def.slot !== s) return `${id} in wrong slot ${s}`;
  }
  if (isTwoHanded(g.equip.main) && g.equip.off) return 'two-handed weapon with an off-hand item';
  return null;
}

/** Repairs stored gear: unknown ids dropped, misplaced items moved to the bag. */
export function fixGear(raw: any, fallback: Gear): Gear {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.bag) || !raw.equip) return fallback;
  const g: Gear = { equip: emptyEquip(), bag: new Array(BAG_SIZE).fill(null) };
  const spill: string[] = [];
  raw.bag.slice(0, BAG_SIZE).forEach((id: unknown, i: number) => {
    if (typeof id === 'string' && ITEM_BY_ID[id]) g.bag[i] = id;
  });
  for (const s of SLOTS) {
    const id = raw.equip[s];
    if (typeof id === 'string' && ITEM_BY_ID[id]) {
      if (ITEM_BY_ID[id].slot === s) g.equip[s] = id;
      else spill.push(id);
    }
  }
  if (isTwoHanded(g.equip.main) && g.equip.off) {
    spill.push(g.equip.off);
    g.equip.off = null;
  }
  for (const id of spill) {
    const c = firstFree(g.bag);
    if (c >= 0) g.bag[c] = id;
  }
  return g;
}

// ---------------------------------------------------------------- stats

export interface CharStats {
  maxHp: number;
  physDef: number;
  /** Share of physical damage taken that the defense removes (0..1). */
  physReduce: number;
  magicDmg: number;
  castSpeed: number;
  atkSpeed: number;
  /** Move speed bonus fraction (sum of items). */
  moveBonus: number;
  /** Blocks per second. */
  moveSpeed: number;
  weapon: WeaponStats | null;
  weaponName: string;
  /** Damage of one basic attack. */
  hitDamage: number;
  /** Seconds between basic attacks. */
  interval: number;
  /** Basic attacks per second. */
  attacksPerSec: number;
  /** Damage per second against one target. */
  dps: number;
  range: number;
}

/** Bare-hands attack when the main hand is empty. */
export const FISTS: WeaponStats = { kind: 'sword1h', dmgType: 'phys', shape: 'melee', damage: 4, interval: 0.6, hitAt: 0.45, range: 1.6 };

export function computeStats(raceId: string, g: Gear): CharStats {
  const race: RaceDef = RACE_BY_ID[raceId] ?? RACE_BY_ID.human;
  const b = race.base;
  let physDef = b.physDef;
  let magicDmg = 0;
  let castSpeed = 0;
  let atkSpeed = 0;
  let moveBonus = 0;
  for (const s of SLOTS) {
    const def = item(g.equip[s]);
    if (!def) continue;
    physDef += def.stats.physDef ?? 0;
    magicDmg += def.stats.magicDmg ?? 0;
    castSpeed += def.stats.castSpeed ?? 0;
    atkSpeed += def.stats.atkSpeed ?? 0;
    moveBonus += def.stats.moveSpeed ?? 0;
  }
  const wdef = item(g.equip.main);
  const w = wdef?.weapon ?? FISTS;
  const magic = w.dmgType === 'magic';
  const hitDamage = magic ? w.damage * b.magicPower * (1 + magicDmg) : w.damage * b.physPower;
  const interval = w.interval / (1 + (magic ? castSpeed : atkSpeed));
  return {
    maxHp: b.maxHp,
    physDef,
    physReduce: physDef / (physDef + 50),
    magicDmg,
    castSpeed,
    atkSpeed,
    moveBonus,
    moveSpeed: b.moveSpeed * (1 + moveBonus),
    weapon: wdef?.weapon ?? null,
    weaponName: wdef?.name ?? 'Без оружия',
    hitDamage,
    interval,
    attacksPerSec: 1 / interval,
    dps: hitDamage / interval,
    range: w.range,
  };
}
