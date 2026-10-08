import type { Loc } from '../data/types';
import { RU } from './ru';
import { EN } from './en';
import { RU2, EN2 } from './extra';
import { RU3, EN3 } from './v3';
import { RU4, EN4 } from './v4';
import { RU5, EN5 } from './v5';
import { RU_DEV, EN_DEV } from './dev';
import { RU_A, EN_A } from './arpg';

export type Lang = 'ru' | 'en';
const DICTS: Record<Lang, Record<string, string>> = { ru: { ...RU, ...RU2, ...RU3, ...RU4, ...RU5, ...RU_DEV, ...RU_A }, en: { ...EN, ...EN2, ...EN3, ...EN4, ...EN5, ...EN_DEV, ...EN_A } };
let current: Lang = 'ru';

export function setLang(lang: Lang) {
  current = DICTS[lang] ? lang : 'ru';
  document.documentElement.lang = current;
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
