// Общие функции рельефа: используются и запекалкой обзорной карты (bake.ts), и тайлами 1 блок/отсчёт (tiles.ts),
// чтобы авторские формы (меса со слоистыми уступами) были одинаковыми на обоих разрешениях.
import type { Mesa } from './design';
import { SEED } from './design';
import { clamp, smooth } from './geom';
import { fbm, vnoise } from './noise';

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Высота месы/останца в точке. zone: 0 — плоская вершина, 1 — слоистый обрыв, 2 — осыпной шлейф. null — вне формы.
 * План неровный: лопасти (sin по углу) + шум + промоины (узкие врезы в обрыв).
 */
export function mesaHeight(m: Mesa, foot: number, x: number, y: number): { v: number; zone: number } | null {
  const sd0 = SEED + m.id.length * 31 + Math.round(m.at[0]);
  const dx = x - m.at[0], dy = y - m.at[1]; const d = Math.hypot(dx, dy); const ang = Math.atan2(dy, dx);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let rr = m.r * (1 + 0.11 * Math.sin(ang * m.lobes + (sd0 % 7)) + 0.2 * fbm(ca * 1.1 + 5, sa * 1.1 + 5, sd0) + 0.08 * fbm(ca * 4 + 1, sa * 4 + 1, sd0 + 1));
  const notch = Math.pow(Math.max(0, Math.sin(ang * m.notches + 2.1 * fbm(ca * 2, sa * 2, sd0 + 2))), 24);
  rr -= notch * (m.edge * 0.9 + m.r * 0.1);
  const cliff = m.edge, apron = m.edge * 2.5;
  const sd = rr - d; const H = m.top - foot; if (H <= 0) return null;
  if (sd >= 0) return { v: m.top + 1.2 * fbm(x / 40, y / 40, sd0 + 3) - 2 * smooth(0, 1, 1 - clamp(sd / 8, 0, 1)) * 0.5, zone: 0 };
  if (sd > -cliff) {
    let k = 1 + sd / cliff; k = clamp(k + 0.07 * fbm(x / 22, y / 22, sd0 + 4), 0, 1);
    const L = m.layers; const lay = Math.floor(k * L), fr = k * L - lay;
    const step = Math.min(1, (lay + smooth(0.3, 0.85, fr)) / L);
    return { v: foot + H * (0.2 + 0.8 * step), zone: 1 };
  }
  if (sd > -cliff - apron) {
    const t = (-sd - cliff) / apron;
    return { v: foot + H * 0.2 * Math.pow(1 - t, 2) * (0.8 + 0.4 * vnoise(x / 26, y / 26, sd0 + 5)), zone: 2 };
  }
  return null;
}
