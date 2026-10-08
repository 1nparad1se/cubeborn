import { t } from '../i18n';
import type { StatMods, WeaponStats } from '../data/types';

const PCT_STATS = new Set(['might', 'area', 'cooldown', 'projSpeed', 'duration', 'luck', 'growth', 'greed', 'critChance', 'critDamage', 'moveSpeed', 'magnet', 'lifesteal', 'thorns', 'curse', 'dodge', 'knockback']);

export function num(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(r);
}

/** "+10% Сила" style lines for passive / upgrade stat modifiers. */
export function statModLines(m: StatMods): string[] {
  const out: string[] = [];
  for (const k in m) {
    const v = m[k as keyof StatMods]!;
    if (!v) continue;
    const sign = v > 0 ? '+' : '−';
    let val: string;
    if (k === 'cooldown') val = `−${num(Math.abs(v) * 100)}%`;
    else if (PCT_STATS.has(k)) val = `${sign}${num(Math.abs(v) * 100)}%`;
    else if (k === 'regen') val = `${sign}${num(Math.abs(v))}/${t('u_sec')}`;
    else val = `${sign}${num(Math.abs(v))}`;
    out.push(`${val} ${t('stat_' + k)}`);
  }
  return out;
}

/** Describes a weapon level delta: "+5 урона, +1 снаряд". */
export function weaponDeltaLines(d: Partial<WeaponStats>): string[] {
  const out: string[] = [];
  for (const k in d) {
    const v = d[k]!;
    if (!v) continue;
    const sign = v > 0 ? '+' : '−';
    const a = Math.abs(v);
    switch (k) {
      case 'cooldown':
        out.push(t('wd_cooldown', { v: num(a) }));
        break;
      case 'area':
      case 'projSpeed':
      case 'critChance':
      case 'width':
        out.push(`${sign}${num(a * 100)}% ${t('wd_' + k)}`);
        break;
      case 'duration':
      case 'slowDur':
      case 'freeze':
        out.push(`${sign}${num(a)}${t('u_s')} ${t('wd_' + k)}`);
        break;
      default:
        out.push(`${sign}${num(a)} ${t('wd_' + k)}`);
    }
  }
  return out;
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
