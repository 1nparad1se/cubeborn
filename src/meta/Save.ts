import type { EquipPos, Item } from '../game/arpg/Gear';
import type { Lang } from '../i18n';
import { fixChar, type CharSave } from './Characters';

export type Quality = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type Level3 = 'low' | 'medium' | 'high';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type ViewDistance = 'near' | 'medium' | 'far' | 'max';
export type AntiAliasing = 'off' | 'msaa' | 'ssaa';
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless';
export type HealthBars = 'off' | 'elites' | 'all';

/** Rebindable actions; each holds up to two KeyboardEvent.code values. */
export type BindAction =
  | 'up' | 'down' | 'left' | 'right' | 'jump'
  | 'skillQ' | 'skillW' | 'skillE' | 'skillR' | 'skillA' | 'skillS' | 'skillD' | 'skillF'
  | 'ult' | 'identity' | 'special' | 'dodge' | 'attack' | 'attackHere' | 'stop' | 'potion' | 'inventory' | 'skills'
  | 'pause' | 'zoomIn' | 'zoomOut' | 'map' | 'devPanel' | 'devDebug' | 'devGod';

/** Skill slot order on the bar (Q W E R A S D F). */
export const SKILL_BINDS: BindAction[] = ['skillQ', 'skillW', 'skillE', 'skillR', 'skillA', 'skillS', 'skillD', 'skillF'];
export type Keybinds = Record<BindAction, string[]>;

export function defaultKeybinds(): Keybinds {
  return {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: [],
    skillQ: ['KeyQ'],
    skillW: ['KeyW'],
    skillE: ['KeyE'],
    skillR: ['KeyR'],
    skillA: ['KeyA'],
    skillS: ['KeyS'],
    skillD: ['KeyD'],
    skillF: ['KeyF'],
    ult: ['KeyV'],
    identity: ['KeyZ'],
    special: ['KeyX'],
    dodge: ['Space'],
    attack: ['KeyC'],
    attackHere: ['ShiftLeft'],
    stop: ['KeyH'],
    potion: ['Digit1'],
    inventory: ['KeyI'],
    skills: ['KeyK'],
    pause: ['Escape', 'KeyP'],
    zoomIn: ['Equal', 'NumpadAdd'],
    zoomOut: ['Minus', 'NumpadSubtract'],
    map: ['KeyM', 'Tab'],
    devPanel: ['F1'],
    devDebug: ['F2'],
    devGod: ['F3'],
  };
}

export interface Settings {
  // audio
  master: number;
  music: number;
  sfx: number;
  ui: number;
  // video
  displayMode: DisplayMode;
  /** 'native' or "WxH" render resolution. */
  resolution: string;
  vsync: boolean;
  /** Frame cap; 0 = unlimited. */
  fpsLimit: number;
  quality: Quality;
  shadows: ShadowQuality;
  effects: Level3;
  particles: Level3;
  viewDistance: ViewDistance;
  antiAliasing: AntiAliasing;
  textures: Level3;
  postProcessing: boolean;
  /** 0..1 */
  screenShake: number;
  // gameplay
  damageNumbers: boolean;
  enemyHealthBars: HealthBars;
  showMinimap: boolean;
  showWaveCounter: boolean;
  showFps: boolean;
  showEnemyCount: boolean;
  autoPause: boolean;
  /** Day/night cycle length: 'off' | 'short' | 'normal' | 'long' (see DAY_NIGHT.lengths). */
  dayNight: string;
  /** Camera distance multiplier (wheel zoom), 0.75 (close) .. 1.35 (far). */
  cameraZoom: number;
  lang: Lang;
  keybinds: Keybinds;
}

/** Sub-settings implied by each graphics preset. */
export const QUALITY_PRESETS: Record<Exclude<Quality, 'custom'>, Pick<Settings, 'shadows' | 'effects' | 'particles' | 'viewDistance' | 'antiAliasing' | 'textures' | 'postProcessing'>> = {
  low: { shadows: 'off', effects: 'low', particles: 'low', viewDistance: 'near', antiAliasing: 'off', textures: 'low', postProcessing: false },
  medium: { shadows: 'low', effects: 'medium', particles: 'medium', viewDistance: 'medium', antiAliasing: 'msaa', textures: 'medium', postProcessing: false },
  high: { shadows: 'medium', effects: 'high', particles: 'high', viewDistance: 'far', antiAliasing: 'msaa', textures: 'high', postProcessing: true },
  ultra: { shadows: 'high', effects: 'high', particles: 'high', viewDistance: 'max', antiAliasing: 'ssaa', textures: 'high', postProcessing: true },
};

/** Best result per map in Endless mode. */
export interface EndlessRecord {
  wave: number;
  time: number;
  kills: number;
  gold: number;
  level: number;
  hero: string;
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
  /** Endless best results per map id. */
  endless: Record<string, EndlessRecord>;
  seenIntro: boolean;
  /** Gold actually paid for permanent upgrades (what a refund returns). */
  permSpent: number;
  last: { hero: string; map: string; diff: string; mode: 'campaign' | 'endless' | 'world' };
  /** Action-RPG equipment: one shared bag, equipped sets per hero. */
  gear: { bag: Item[]; equipped: Record<string, Partial<Record<EquipPos, Item>>>; shop?: Item[] };
  /** Created characters (v6) and the one picked at the campfire. Old `gear` goes to the first one created. */
  chars: CharSave[];
  activeChar: string | null;
}

const KEY = 'cubeborn.save.v1';
const VERSION = 6;

export function defaultSettings(): Settings {
  const lang: Lang = (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  return {
    master: 1,
    music: 0.6,
    sfx: 0.8,
    ui: 0.8,
    displayMode: 'windowed',
    resolution: 'native',
    vsync: true,
    fpsLimit: 0,
    quality: 'high',
    ...QUALITY_PRESETS.high,
    screenShake: 1,
    damageNumbers: true,
    enemyHealthBars: 'elites',
    showMinimap: true,
    showWaveCounter: true,
    showFps: false,
    showEnemyCount: false,
    autoPause: true,
    dayNight: 'normal',
    cameraZoom: 1,
    lang,
    keybinds: defaultKeybinds(),
  };
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
    endless: {},
    seenIntro: false,
    permSpent: 0,
    last: { hero: 'berserker', map: 'blightwood', diff: 'normal', mode: 'campaign' },
    gear: { bag: [], equipped: {} },
    chars: [],
    activeChar: null,
  };
}

/**
 * Merges stored data over defaults so that new fields appear after updates.
 * v1 -> v2: graphics presets expand into sub-settings, screen shake becomes a level,
 * gold is re-denominated to the new economy (upgrade prices dropped 4x, so the balance does too).
 */
export function migrate(raw: any): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const oldVersion = typeof raw.version === 'number' ? raw.version : 1;
  const rs = { ...(raw.settings || {}) };
  if (oldVersion < 2) {
    const q = rs.quality === 'low' || rs.quality === 'medium' || rs.quality === 'high' ? rs.quality : 'high';
    Object.assign(rs, { quality: q }, QUALITY_PRESETS[q as 'low' | 'medium' | 'high']);
    if (typeof rs.screenShake === 'boolean') rs.screenShake = rs.screenShake ? 1 : 0;
    delete rs.vibration;
  }
  // v5 action combat: eight skill keys (Q W E R A S D F), Ultimate V, Identity Z — every old binding resets
  if (oldVersion < 5) delete rs.keybinds;
  const settings: Settings = { ...d.settings, ...rs, keybinds: { ...defaultKeybinds(), ...(rs.keybinds || {}) } };
  for (const k of Object.keys(settings.keybinds) as BindAction[]) if (!Array.isArray(settings.keybinds[k])) settings.keybinds[k] = defaultKeybinds()[k];
  const out: SaveData = {
    ...d,
    ...raw,
    unlocked: { ...d.unlocked, ...(raw.unlocked || {}) },
    discovered: { ...d.discovered, ...(raw.discovered || {}) },
    settings,
    endless: { ...(raw.endless || {}) },
    last: { ...d.last, ...(raw.last || {}) },
    stats: { ...(raw.stats || {}) },
    perm: { ...(raw.perm || {}) },
    mapClears: { ...(raw.mapClears || {}) },
  };
  if (oldVersion < 2) out.gold = Math.floor((Number(raw.gold) || 0) / 4);
  // v5: permanent upgrades are gone — the gold paid for them comes back
  if (oldVersion < 5) {
    out.gold += Number(raw.permSpent) || 0;
    out.perm = {};
    out.permSpent = 0;
  }
  // gear: keep only well-formed items (older saves have none)
  const g = raw.gear && typeof raw.gear === 'object' ? raw.gear : {};
  out.gear = { bag: Array.isArray(g.bag) ? g.bag.filter((x: any) => x && typeof x.slot === 'string') : [], equipped: g.equipped && typeof g.equipped === 'object' ? g.equipped : {}, shop: Array.isArray(g.shop) ? g.shop.filter((x: any) => x && typeof x.slot === 'string') : [] };
  if (oldVersion < 5) {
    // the nine new classes replace the old heroes: their equipment returns to the stash
    const known = ['berserker', 'paladin', 'steelfist', 'ranger', 'deathblade', 'reaper', 'summoner', 'sorceress', 'templar'];
    for (const [hero, set] of Object.entries(out.gear.equipped)) {
      if (known.includes(hero)) continue;
      for (const it of Object.values(set || {})) if (it && typeof (it as Item).slot === 'string') out.gear.bag.push(it as Item);
      delete out.gear.equipped[hero];
    }
    if (!known.includes(out.last.hero)) out.last.hero = 'berserker';
  }
  out.chars = Array.isArray(raw.chars) ? (raw.chars.map(fixChar).filter(Boolean) as CharSave[]) : [];
  out.activeChar = out.chars.some((c) => c.id === raw.activeChar) ? raw.activeChar : (out.chars[0]?.id ?? null);
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
