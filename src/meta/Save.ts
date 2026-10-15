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
  | 'ult' | 'identity' | 'special' | 'dodge' | 'attack' | 'attackHere' | 'stop' | 'skills'
  | 'pause' | 'zoomIn' | 'zoomOut' | 'map';

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
    skills: ['KeyK'],
    pause: ['Escape', 'KeyP'],
    zoomIn: ['Equal', 'NumpadAdd'],
    zoomOut: ['Minus', 'NumpadSubtract'],
    map: ['Tab'],
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
  showFps: boolean;
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

export interface SaveData {
  version: number;
  settings: Settings;
  /** Created characters and the one played last. */
  chars: CharSave[];
  activeChar: string | null;
  /** Creatures met in the world (bestiary); empty until creatures exist. */
  bestiary: string[];
}

const KEY = 'cubeborn.save.v1';
/** Where the save as it was before the v7 rework is kept (written once, never overwritten). */
export const BACKUP_KEY = 'cubeborn.save.backup.v6';
const VERSION = 7;

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
    showFps: false,
    autoPause: true,
    dayNight: 'normal',
    cameraZoom: 1,
    lang,
    keybinds: defaultKeybinds(),
  };
}

export function defaultSave(): SaveData {
  return { version: VERSION, settings: defaultSettings(), chars: [], activeChar: null, bestiary: [] };
}

/** Field names of saves before v7 that belonged to removed systems (gold, shop, achievements, maps...). */
const DROPPED = ['gold', 'perm', 'unlocked', 'achievements', 'stats', 'discovered', 'mapClears', 'endless', 'seenIntro', 'permSpent', 'last', 'gear'];

/**
 * Brings stored data to the current format. Settings and characters are kept (characters are
 * repaired by fixChar); data of removed systems is dropped. Before a pre-v7 save is changed the
 * original is copied to BACKUP_KEY, so nothing is lost silently.
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
  }
  // v5 action combat: eight skill keys (Q W E R A S D F), Ultimate V, Identity Z — every old binding resets
  if (oldVersion < 5) delete rs.keybinds;
  delete rs.vibration;
  delete rs.showWaveCounter;
  delete rs.showEnemyCount;
  const binds: Record<string, unknown> = { ...(rs.keybinds || {}) };
  // v7: the world map moved to Tab; developer keys, inventory and potion are gone
  if (oldVersion < 7) for (const k of ['map', 'devPanel', 'devDebug', 'devGod', 'inventory', 'potion']) delete binds[k];
  const kb = defaultKeybinds();
  for (const k of Object.keys(kb) as BindAction[]) if (Array.isArray(binds[k])) kb[k] = (binds[k] as unknown[]).filter((c): c is string => typeof c === 'string');
  const settings: Settings = { ...d.settings, ...rs, keybinds: kb };
  for (const k of Object.keys(settings) as (keyof Settings)[]) if (!(k in d.settings)) delete settings[k];
  const chars = Array.isArray(raw.chars) ? (raw.chars.map(fixChar).filter(Boolean) as CharSave[]) : [];
  return {
    version: VERSION,
    settings,
    chars,
    activeChar: chars.some((c) => c.id === raw.activeChar) ? raw.activeChar : (chars[0]?.id ?? null),
    bestiary: Array.isArray(raw.bestiary) ? raw.bestiary.filter((x: unknown) => typeof x === 'string') : [],
  };
}

/** True when a stored save has data of removed systems (it will be backed up before migration). */
function needsBackup(raw: any): boolean {
  return !!raw && typeof raw === 'object' && (typeof raw.version !== 'number' || raw.version < VERSION || DROPPED.some((k) => k in raw));
}

export function loadSave(): SaveData {
  let s: string | null = null;
  try {
    s = localStorage.getItem(KEY);
    if (!s) return defaultSave();
    const raw = JSON.parse(s);
    if (needsBackup(raw) && localStorage.getItem(BACKUP_KEY) === null) localStorage.setItem(BACKUP_KEY, s);
    return migrate(raw);
  } catch {
    // unreadable save: keep a copy instead of overwriting it with a fresh one
    try {
      if (s) localStorage.setItem(KEY + '.unreadable', s);
    } catch {
      /* storage unavailable */
    }
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
