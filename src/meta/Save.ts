import { PERM_UPGRADES, permCost } from '../data/upgrades';
import type { Lang } from '../i18n';

export type Quality = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type Level3 = 'low' | 'medium' | 'high';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type ViewDistance = 'near' | 'medium' | 'far' | 'max';
export type AntiAliasing = 'off' | 'msaa' | 'ssaa';
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless';
export type HealthBars = 'off' | 'elites' | 'all';

/** Rebindable actions; each holds up to two KeyboardEvent.code values. */
export type BindAction = 'up' | 'down' | 'left' | 'right' | 'jump' | 'skillQ' | 'skillW' | 'skillE' | 'skillR' | 'dodge' | 'attackHere' | 'stop' | 'potion' | 'inventory' | 'pause' | 'zoomIn' | 'zoomOut' | 'map' | 'devPanel' | 'devDebug' | 'devGod';
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
    dodge: ['Space'],
    attackHere: ['ShiftLeft'],
    stop: ['KeyS'],
    potion: ['Digit1'],
    inventory: ['KeyI', 'KeyC'],
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
  last: { hero: string; map: string; diff: string; mode: 'campaign' | 'endless' };
}

const KEY = 'cubeborn.save.v1';
const VERSION = 4;

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
    last: { hero: 'bram', map: 'blightwood', diff: 'normal', mode: 'campaign' },
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
  if (oldVersion < 4 && rs.keybinds) {
    // v4 action-RPG controls: Q/W/E/R are skills, Space dodges, the mouse moves the hero.
    // Old WASD/Space bindings would collide, so only the remaining custom keys survive.
    const taken = new Set(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyI', 'KeyC', 'Digit1']);
    const kb: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(rs.keybinds as Record<string, string[]>)) if (Array.isArray(v)) kb[k] = v.filter((c) => !taken.has(c));
    delete kb.jump;
    for (const k of ['up', 'down', 'left', 'right']) if (kb[k] && !kb[k].length) delete kb[k];
    rs.keybinds = kb;
  }
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
  // v3: upgrade prices ×5; levels already bought stay, and their refund value is the old price paid
  if (oldVersion < 3 || typeof raw.permSpent !== 'number') {
    let spent = 0;
    for (const u of PERM_UPGRADES) for (let i = 0; i < (out.perm[u.id] ?? 0); i++) spent += permCost(u, i, 1);
    out.permSpent = spent;
  }
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
