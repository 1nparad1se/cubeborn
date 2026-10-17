import { fixGear, newGear, type Gear } from '../rpg/equipment';
import { STARTER_ITEMS } from '../rpg/items';
import { RACE_BY_ID } from '../rpg/races';

/**
 * A created character: race, name, level and experience (progression comes later), the gear
 * (equipped items and the bag) and play time. The world is the training meadow; characters
 * always appear at its spawn point.
 */
export interface CharSave {
  id: string;
  name: string;
  race: string;
  level: number;
  xp: number;
  gear: Gear;
  created: number;
  /** Seconds played. */
  playTime: number;
  lastPlayed: number;
}

export const MAX_CHARS = 12;

export function newChar(name: string, race: string): CharSave {
  const now = Date.now();
  return {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim().slice(0, 16) || 'Герой',
    race: RACE_BY_ID[race]?.available ? race : 'human',
    level: 1,
    xp: 0,
    gear: newGear(STARTER_ITEMS),
    created: now,
    playTime: 0,
    lastPlayed: now,
  };
}

/** Repairs a stored character of the current format; anything else (old class heroes) is dropped. */
export function fixChar(raw: any): CharSave | null {
  if (!raw || typeof raw !== 'object' || typeof raw.race !== 'string' || !RACE_BY_ID[raw.race]?.available) return null;
  const d = newChar(String(raw.name ?? 'Герой'), raw.race);
  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  return {
    ...d,
    id: typeof raw.id === 'string' && raw.id ? raw.id : d.id,
    level: Math.max(1, Math.floor(num(raw.level, 1))),
    xp: Math.max(0, num(raw.xp, 0)),
    gear: fixGear(raw.gear, d.gear),
    created: num(raw.created, d.created),
    playTime: Math.max(0, num(raw.playTime, 0)),
    lastPlayed: num(raw.lastPlayed, num(raw.created, d.created)),
  };
}
