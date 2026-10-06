import type { DifficultyDef } from './types';

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'normal', name: { ru: 'Обычная', en: 'Normal' }, hp: 1, damage: 1, speed: 1, spawn: 1, elite: 1, reward: 1, color: '#7be37b', modifiers: { ru: 'Стандартный забег.', en: 'The standard run.' } },
  { id: 'hard', name: { ru: 'Сложная', en: 'Hard' }, hp: 1.6, damage: 1.35, speed: 1.08, spawn: 1.2, elite: 1.6, reward: 1.6, color: '#ffd24a', modifiers: { ru: 'Враги сильнее и быстрее, больше элиты.', en: 'Stronger, faster foes and more elites.' } },
  { id: 'nightmare', name: { ru: 'Кошмар', en: 'Nightmare' }, hp: 2.2, damage: 1.6, speed: 1.15, spawn: 1.4, elite: 2.4, reward: 2.4, color: '#ff7a3a', modifiers: { ru: 'Элиты с двумя модификаторами, боссы яростнее.', en: 'Elites gain two modifiers, bosses are fiercer.' } },
  { id: 'inferno', name: { ru: 'Инферно', en: 'Inferno' }, hp: 3.2, damage: 2.0, speed: 1.22, spawn: 1.6, elite: 3.5, reward: 3.5, color: '#ff3a5a', modifiers: { ru: 'Врагам не страшна боль. Лечение −50%.', en: 'Foes know no pain. Healing −50%.' } },
];

export const DIFFICULTY_BY_ID: Record<string, DifficultyDef> = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));
