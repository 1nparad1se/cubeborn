import type { Lang } from '../i18n';
import { fixChar, type CharSave } from './Characters';

export type Quality = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type Level3 = 'low' | 'medium' | 'high';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type ViewDistance = 'near' | 'medium' | 'far' | 'max';
export type AntiAliasing = 'off' | 'msaa' | 'ssaa';
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless';

/** Rebindable actions; each holds up to two KeyboardEvent.code values. */
export type BindAction = 'up' | 'down' | 'left' | 'right' | 'jump' | 'attack' | 'inventory' | 'pause' | 'zoomIn' | 'zoomOut';

export type Keybinds = Record<BindAction, string[]>;

export function defaultKeybinds(): Keybinds {
  return {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    attack: ['KeyF'],
    inventory: ['KeyI', 'KeyB'],
    pause: ['Escape', 'KeyP'],
    zoomIn: ['Equal', 'NumpadAdd'],
    zoomOut: ['Minus', 'NumpadSubtract'],
  };
}

export interface Settings {
  // audio
  master: number;
  music: number;
  sfx: number;
  ui: number;
  /** World ambience (wind, water, birds and crickets). */
  ambient: number;
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
  showFps: boolean;
  autoPause: boolean;
  /** Camera distance multiplier (wheel zoom), 0.75 (close) .. 1.35 (far). */
  cameraZoom: number;
  /** Interface scale for the HUD and menus, 0.8 .. 1.3. */
  uiScale: number;
  /** Control hints when entering the world. */
  showHints: boolean;
  /** Left and right mouse buttons swapped. */
  swapMouse: boolean;
  /** Wheel zooms the other way. */
  invertWheel: boolean;
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
  /** World clock (minutes since midnight and days passed). */
  clock?: { minutes: number; days: number };
}

const KEY = 'cubeborn.save.v1';
/**
 * Where the save as it was before the RPG rework (v8) is kept: written once, never overwritten.
 * The older pre-v7 backup key stays untouched.
 */
export const BACKUP_KEY = 'cubeborn.save.backup.v7';
export const VERSION = 8;

export function defaultSettings(): Settings {
  const lang: Lang = (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  return {
    master: 1,
    music: 0.6,
    sfx: 0.8,
    ui: 0.8,
    ambient: 0.7,
    displayMode: 'windowed',
    resolution: 'native',
    vsync: true,
    fpsLimit: 0,
    quality: 'high',
    ...QUALITY_PRESETS.high,
    screenShake: 1,
    damageNumbers: true,
    showFps: false,
    autoPause: true,
    cameraZoom: 1,
    uiScale: 1,
    showHints: true,
    swapMouse: false,
    invertWheel: false,
    lang,
    keybinds: defaultKeybinds(),
  };
}

function defaultSave(): SaveData {
  return { version: VERSION, settings: defaultSettings(), chars: [], activeChar: null };
}

/**
 * Brings stored data to the current format. Only the settings (and the world clock) are kept from
 * saves before v8: old-format characters and world data are dropped (loadSave copies the original to BACKUP_KEY first). Key bindings reset,
 * since the old key actions are gone.
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
  if (oldVersion < VERSION) delete rs.keybinds;
  const binds: Record<string, unknown> = { ...(rs.keybinds || {}) };
  const kb = defaultKeybinds();
  for (const k of Object.keys(kb) as BindAction[]) if (Array.isArray(binds[k])) kb[k] = (binds[k] as unknown[]).filter((c): c is string => typeof c === 'string');
  const settings: Settings = { ...d.settings, ...rs, keybinds: kb };
  for (const k of Object.keys(settings) as (keyof Settings)[]) if (!(k in d.settings)) delete settings[k];
  const chars = oldVersion < VERSION || !Array.isArray(raw.chars) ? [] : (raw.chars.map(fixChar).filter(Boolean) as CharSave[]);
  return {
    version: VERSION,
    settings,
    chars,
    activeChar: chars.some((c) => c.id === raw.activeChar) ? raw.activeChar : (chars[0]?.id ?? null),
    ...(raw.clock && typeof raw.clock === 'object' && Number.isFinite(raw.clock.minutes)
      ? { clock: { minutes: ((raw.clock.minutes % 1440) + 1440) % 1440, days: Number.isFinite(raw.clock.days) ? Math.max(0, Math.floor(raw.clock.days)) : 0 } }
      : {}),
  };
}

/** True when a stored save predates the current format (it is backed up before migration). */
function needsBackup(raw: any): boolean {
  return !!raw && typeof raw === 'object' && (typeof raw.version !== 'number' || raw.version < VERSION);
}

/** Storage used by the save (localStorage in the browser; tests pass a stand-in). */
export interface SaveStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
const store = (): SaveStorage => localStorage;

export function loadSave(st: SaveStorage = store()): SaveData {
  let s: string | null = null;
  try {
    s = st.getItem(KEY);
    if (!s) return defaultSave();
    const raw = JSON.parse(s);
    if (needsBackup(raw) && st.getItem(BACKUP_KEY) === null) st.setItem(BACKUP_KEY, s);
    const data = migrate(raw);
    // the migrated save replaces the old one at once, so nothing old can come back on a later load
    if (needsBackup(raw)) st.setItem(KEY, JSON.stringify(data));
    return data;
  } catch {
    // unreadable save: keep a copy instead of overwriting it with a fresh one
    try {
      if (s) st.setItem(KEY + '.unreadable', s);
    } catch {
      /* storage unavailable */
    }
    return defaultSave();
  }
}

export function writeSave(data: SaveData, st: SaveStorage = store()): boolean {
  try {
    st.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
