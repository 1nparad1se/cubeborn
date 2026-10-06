import type { Lang } from '../i18n';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  music: number;
  sfx: number;
  vibration: boolean;
  quality: Quality;
  damageNumbers: boolean;
  screenShake: boolean;
  lang: Lang;
  showFps: boolean;
}

export interface SaveData {
  version: number;
  gold: number;
  perm: Record<string, number>;
  unlocked: { heroes: string[]; weapons: string[]; passives: string[]; maps: string[] };
  achievements: string[];
  stats: Record<string, number>;
  discovered: { weapons: string[]; passives: string[]; enemies: string[]; bosses: string[]; relics: string[] };
  /** Highest difficulty index cleared per map (-1 none). */
  mapClears: Record<string, number>;
  settings: Settings;
  seenIntro: boolean;
  last: { hero: string; map: string; diff: string };
}

const KEY = 'cubeborn.save.v1';
const VERSION = 1;

export function defaultSettings(): Settings {
  const lang: Lang = (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return { music: 0.6, sfx: 0.8, vibration: true, quality: mobile ? 'medium' : 'high', damageNumbers: true, screenShake: true, lang, showFps: false };
}

export function defaultSave(): SaveData {
  return {
    version: VERSION,
    gold: 0,
    perm: {},
    unlocked: { heroes: [], weapons: [], passives: [], maps: [] },
    achievements: [],
    stats: {},
    discovered: { weapons: [], passives: [], enemies: [], bosses: [], relics: [] },
    mapClears: {},
    settings: defaultSettings(),
    seenIntro: false,
    last: { hero: 'bram', map: 'blightwood', diff: 'normal' },
  };
}

/** Merges stored data over defaults so that new fields appear after updates. */
function migrate(raw: any): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const out: SaveData = {
    ...d,
    ...raw,
    unlocked: { ...d.unlocked, ...(raw.unlocked || {}) },
    discovered: { ...d.discovered, ...(raw.discovered || {}) },
    settings: { ...d.settings, ...(raw.settings || {}) },
    last: { ...d.last, ...(raw.last || {}) },
    stats: { ...(raw.stats || {}) },
    perm: { ...(raw.perm || {}) },
    mapClears: { ...(raw.mapClears || {}) },
  };
  out.version = VERSION;
  return out;
}

export function loadSave(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return defaultSave();
    return migrate(JSON.parse(s));
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
