import type { Loc } from './types';

/** Bestiary tabs. `icon` is a menu glyph (see menu.css). */
export const BESTIARY_CATEGORIES: { id: string; name: Loc; icon: string }[] = [
  { id: 'all', name: { ru: 'Все существа', en: 'All creatures' }, icon: 'skull' },
  { id: 'forest', name: { ru: 'Лесные', en: 'Forest' }, icon: 'tree' },
  { id: 'snow', name: { ru: 'Снежные', en: 'Snow' }, icon: 'flake' },
  { id: 'desert', name: { ru: 'Пустынные', en: 'Desert' }, icon: 'sun' },
  { id: 'dungeons', name: { ru: 'Подземелья', en: 'Dungeons' }, icon: 'door' },
  { id: 'special', name: { ru: 'Особые', en: 'Special' }, icon: 'star' },
  { id: 'bosses', name: { ru: 'Боссы', en: 'Bosses' }, icon: 'crown' },
];

export interface CreatureEntry {
  id: string;
  name: Loc;
  /** One of BESTIARY_CATEGORIES (not 'all'). */
  category: string;
  /** Voxel model id used for the portrait. */
  model: string;
}

/** Creatures that can appear in the bestiary. The world has none yet: add entries here as creatures are made. */
export const CREATURES: CreatureEntry[] = [];
