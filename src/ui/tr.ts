import { getLang } from '../i18n';

/** Inline Russian / English text picked by the interface language. */
export function tr(ru: string, en: string): string {
  return getLang() === 'en' ? en : ru;
}
