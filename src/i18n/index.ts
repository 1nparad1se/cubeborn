import type { Loc } from '../data/types';

export type Lang = 'ru' | 'en';

/** Interface strings looked up by key (most UI text is written inline with tr()). */
const DICTS: Record<Lang, Record<string, string>> = {
  ru: {
    game_subtitle: 'Воксельная RPG',
    tap_to_start: 'Нажмите любую клавишу или кликните',
    splash_note: 'Оригинальная игра. Звук и музыка синтезируются в реальном времени.',
    menu_settings: 'Настройки',
    btn_no: 'Нет',
    btn_yes: 'Да',
    dn_dusk: 'Закат: скоро стемнеет',
    dn_night: 'Наступила ночь',
    dn_dawn: 'Рассвет',
  },
  en: {
    game_subtitle: 'A voxel RPG',
    tap_to_start: 'Press any key or click',
    splash_note: 'An original game. Sound and music are synthesised in real time.',
    menu_settings: 'Settings',
    btn_no: 'No',
    btn_yes: 'Yes',
    dn_dusk: 'Dusk: darkness is coming',
    dn_night: 'Night has fallen',
    dn_dawn: 'Dawn',
  },
};
let current: Lang = 'ru';

export function setLang(lang: Lang) {
  current = DICTS[lang] ? lang : 'ru';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}
export function getLang(): Lang {
  return current;
}
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
];

/** Translates a UI key; `{name}` placeholders are filled from params. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}

/** Picks the current language from a content Loc object. */
export function L(loc: Loc | undefined): string {
  if (!loc) return '';
  return loc[current] ?? loc.en;
}
