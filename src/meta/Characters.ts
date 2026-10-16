import { PROG } from '../config/progression';
import type { Loc } from '../data/types';

/**
 * Created characters: each has a class, a name, its own level (1..50) and experience, skill
 * levels and tripods, unspent skill points and the place in the world where it was left.
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
  created: number;
  /** Seconds played. */
  playTime: number;
  /** Last time the character was played (ms since epoch). */
  lastPlayed: number;
  /** Where the hero stood when the game was saved (world cells); absent = the spawn point. */
  pos?: { x: number; z: number };
  /** Position on the continent «Расколотые Земли» (world blocks); absent = Зеленодол. */
  cpos?: { x: number; z: number };
  /** Unique continent camps this character has cleared (they never respawn). */
  uniq?: string[];
}

export const MAX_CHARS = 12;

/** Region name shown on character cards (one world for now). */
export const REGION: Loc = { ru: 'Расколотые Земли', en: 'Shattered Lands' };

/** Class groups for character creation. */
export const CLASS_GROUPS: { id: string; name: Loc; classes: string[] }[] = [
  { id: 'warrior', name: { ru: 'Воин', en: 'Warrior' }, classes: ['berserker', 'paladin', 'templar'] },
  { id: 'monk', name: { ru: 'Монах', en: 'Monk' }, classes: ['steelfist'] },
  { id: 'gunner', name: { ru: 'Стрелок', en: 'Gunner' }, classes: ['ranger'] },
  { id: 'assassin', name: { ru: 'Ассасин', en: 'Assassin' }, classes: ['reaper', 'deathblade'] },
  { id: 'mage', name: { ru: 'Маг', en: 'Mage' }, classes: ['summoner', 'sorceress'] },
];

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
  const now = Date.now();
  return {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim().slice(0, 16) || 'Hero',
    cls,
    level: 1,
    xp: 0,
    skills: autoSkills(1),
    tri: Array.from({ length: 8 }, () => [-1, -1]),
    points: 0,
    created: now,
    playTime: 0,
    lastPlayed: now,
  };
}

/**
 * Repairs a stored character: fills fields added by updates, clamps bad values and keeps only
 * the fields the game still uses (equipment, bags, stones and continent progress of older
 * versions are dropped; the backup made by Save.migrate keeps them).
 */
export function fixChar(raw: any): CharSave | null {
  if (!raw || typeof raw !== 'object' || typeof raw.cls !== 'string') return null;
  const d = newChar(String(raw.name ?? 'Hero'), raw.cls);
  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const c: CharSave = {
    ...d,
    id: typeof raw.id === 'string' && raw.id ? raw.id : d.id,
    created: num(raw.created, d.created),
    playTime: Math.max(0, num(raw.playTime, 0)),
    lastPlayed: num(raw.lastPlayed, num(raw.created, d.created)),
  };
  c.level = Math.max(1, Math.min(PROG.maxLevel, Math.floor(num(raw.level, 1))));
  c.xp = Math.max(0, num(raw.xp, 0));
  c.skills = autoSkills(c.level, Array.isArray(raw.skills) && raw.skills.length === 8 ? raw.skills.map((v: any) => Math.max(0, Math.min(PROG.skillMax, Number(v) || 0))) : undefined);
  c.tri = Array.isArray(raw.tri) && raw.tri.length === 8 ? raw.tri.map((t: any) => (Array.isArray(t) ? [Number(t[0] ?? -1), Number(t[1] ?? -1)] : [-1, -1])) : d.tri;
  if (raw.pos && Number.isFinite(raw.pos.x) && Number.isFinite(raw.pos.z)) c.pos = { x: raw.pos.x, z: raw.pos.z };
  if (raw.cpos && Number.isFinite(raw.cpos.x) && Number.isFinite(raw.cpos.z)) c.cpos = { x: raw.cpos.x, z: raw.cpos.z };
  if (Array.isArray(raw.uniq)) c.uniq = raw.uniq.filter((v: unknown) => typeof v === 'string').slice(0, 256);
  // spent points can never exceed what the level earned
  const spent = c.skills.reduce((s, l, i) => s + Math.max(0, l - (c.level >= i + 1 ? 1 : 0)), 0);
  c.points = Math.max(0, pointsEarned(c.level) - spent);
  return c;
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
