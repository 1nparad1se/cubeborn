import type { EquipPos, Item } from '../game/arpg/Gear';
import { EQUIP_POS, slotOf } from '../game/arpg/Gear';
import { PROG, STONE_TIERS, TIER_OF } from '../config/progression';
import type { Loc } from '../data/types';

/**
 * Created characters: each has a class, a name, its own level (1..50) and experience, skill
 * levels and tripods, unspent skill points, its own equipment, bag and enhancement stones.
 */
export interface CharSave {
  id: string;
  name: string;
  cls: string;
  level: number;
  /** Experience into the current level. */
  xp: number;
  /** Skill levels Q W E R A S D F (0 = not learned yet). */
  skills: number[];
  /** Tripod picks per skill (two tiers, -1 = none). */
  tri: number[][];
  points: number;
  equipped: Partial<Record<EquipPos, Item>>;
  bag: Item[];
  /** Enhancement stones by tier: simple, common, epic, legendary, mythic. */
  stones: number[];
  created: number;
  playTime: number;
  runs: number;
  /** Continent progress: waystones, home town, explored map, last position. */
  world?: import('../game/world/World').WorldProgress;
}

export const MAX_CHARS = 8;
export const CHAR_BAG = 60;

/** Class groups for character creation. */
export const CLASS_GROUPS: { id: string; name: Loc; classes: string[] }[] = [
  { id: 'warrior', name: { ru: 'Воин', en: 'Warrior' }, classes: ['berserker', 'paladin', 'templar'] },
  { id: 'monk', name: { ru: 'Монах', en: 'Monk' }, classes: ['steelfist'] },
  { id: 'gunner', name: { ru: 'Стрелок', en: 'Gunner' }, classes: ['ranger'] },
  { id: 'assassin', name: { ru: 'Ассасин', en: 'Assassin' }, classes: ['reaper', 'deathblade'] },
  { id: 'mage', name: { ru: 'Маг', en: 'Mage' }, classes: ['summoner', 'sorceress'] },
];

export function groupOf(cls: string) {
  return CLASS_GROUPS.find((g) => g.classes.includes(cls)) ?? CLASS_GROUPS[0];
}

/** Skill levels a character of `level` has before spending points: Q at 1, then one new skill per level up to 8. */
export function autoSkills(level: number, prev?: number[]): number[] {
  const out = prev ? [...prev] : [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) if (out[i] === 0 && level >= i + 1) out[i] = 1;
  return out;
}

/** Skill points a character has earned in total at a level (one per level after the auto levels). */
export function pointsEarned(level: number): number {
  return Math.max(0, level - PROG.autoSkillLevels);
}

export function newChar(name: string, cls: string): CharSave {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim().slice(0, 16) || 'Hero',
    cls,
    level: 1,
    xp: 0,
    skills: autoSkills(1),
    tri: Array.from({ length: 8 }, () => [-1, -1]),
    points: 0,
    equipped: {},
    bag: [],
    stones: new Array(STONE_TIERS).fill(0),
    created: Date.now(),
    playTime: 0,
    runs: 0,
  };
}

/** Repairs a stored character (missing fields after updates, bad values). */
export function fixChar(raw: any): CharSave | null {
  if (!raw || typeof raw !== 'object' || typeof raw.cls !== 'string') return null;
  const d = newChar(String(raw.name ?? 'Hero'), raw.cls);
  const c: CharSave = { ...d, ...raw };
  c.level = Math.max(1, Math.min(PROG.maxLevel, Math.floor(Number(c.level) || 1)));
  c.xp = Math.max(0, Number(c.xp) || 0);
  c.skills = autoSkills(c.level, Array.isArray(raw.skills) && raw.skills.length === 8 ? raw.skills.map((v: any) => Math.max(0, Math.min(PROG.skillMax, Number(v) || 0))) : undefined);
  c.tri = Array.isArray(raw.tri) && raw.tri.length === 8 ? raw.tri.map((t: any) => (Array.isArray(t) ? [Number(t[0] ?? -1), Number(t[1] ?? -1)] : [-1, -1])) : d.tri;
  c.stones = Array.from({ length: STONE_TIERS }, (_, i) => Math.max(0, Math.floor(Number(raw.stones?.[i]) || 0)));
  c.bag = Array.isArray(raw.bag) ? raw.bag.filter((x: any) => x && typeof x.slot === 'string') : [];
  const eq: Partial<Record<EquipPos, Item>> = {};
  for (const p of EQUIP_POS) {
    const it = raw.equipped?.[p];
    if (it && typeof it.slot === 'string' && slotOf(p) === it.slot) eq[p] = it;
  }
  c.equipped = eq;
  // spent points can never exceed what the level earned
  const spent = c.skills.reduce((s, l, i) => s + Math.max(0, l - (c.level >= i + 1 ? 1 : 0)), 0);
  c.points = Math.max(0, pointsEarned(c.level) - spent);
  return c;
}

/** Adds experience; returns the levels gained. */
export function addCharXp(c: CharSave, xp: number): number {
  let gained = 0;
  c.xp += xp;
  while (c.level < PROG.maxLevel && c.xp >= PROG.xpForLevel(c.level)) {
    c.xp -= PROG.xpForLevel(c.level);
    c.level++;
    gained++;
    if (c.level > PROG.autoSkillLevels) c.points++;
  }
  if (c.level >= PROG.maxLevel) c.xp = 0;
  c.skills = autoSkills(c.level, c.skills);
  return gained;
}

export function canLearn(c: CharSave, slot: number): boolean {
  return c.points > 0 && c.skills[slot] > 0 && c.skills[slot] < PROG.skillMax;
}

export function learn(c: CharSave, slot: number): boolean {
  if (!canLearn(c, slot)) return false;
  c.points--;
  c.skills[slot]++;
  return true;
}

/** Returns all spent points (free respec). */
export function resetSkills(c: CharSave) {
  c.skills = autoSkills(c.level);
  c.tri = Array.from({ length: 8 }, () => [-1, -1]);
  c.points = pointsEarned(c.level);
}

export function stoneTier(it: Item): number {
  return TIER_OF[it.rarity];
}
