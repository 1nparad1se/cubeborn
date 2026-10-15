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
  /** Model id used for the portrait (a bestiary creature model, see models/mobs). */
  model: string;
  /**
   * Shown in the bestiary before it is met in the world: the creature's model is ready but it does
   * not spawn yet, so the entry is visible as a preview.
   */
  preview?: boolean;
}

/** Creatures that can appear in the bestiary. None spawn in the world yet; these are model previews. */
export const CREATURES: CreatureEntry[] = [
  { id: 'forest_spider', name: { ru: 'Лесной паук', en: 'Forest Spider' }, category: 'forest', model: 'mob_spider', preview: true },
  { id: 'shadow_ghost', name: { ru: 'Теневой призрак', en: 'Shadow Ghost' }, category: 'special', model: 'mob_shadow_ghost', preview: true },
  { id: 'forest_troll', name: { ru: 'Лесной тролль', en: 'Forest Troll' }, category: 'forest', model: 'mob_forest_troll', preview: true },
  { id: 'jackal', name: { ru: 'Шакал', en: 'Jackal' }, category: 'desert', model: 'mob_jackal', preview: true },
  { id: 'forest_goblin', name: { ru: 'Лесной гоблин', en: 'Forest Goblin' }, category: 'forest', model: 'mob_forest_goblin', preview: true },
  { id: 'wild_boar', name: { ru: 'Дикий кабан', en: 'Wild Boar' }, category: 'forest', model: 'mob_wild_boar', preview: true },
  { id: 'swamp_witch', name: { ru: 'Ведьма топей', en: 'Swamp Witch' }, category: 'forest', model: 'mob_swamp_witch', preview: true },
  { id: 'goblin_archer', name: { ru: 'Гоблин-лучник', en: 'Goblin Archer' }, category: 'forest', model: 'mob_goblin_archer', preview: true },
  { id: 'carrion_raven', name: { ru: 'Ворон-падальщик', en: 'Carrion Raven' }, category: 'forest', model: 'mob_carrion_raven', preview: true },
  { id: 'skeleton_miner', name: { ru: 'Скелет-шахтер', en: 'Skeleton Miner' }, category: 'dungeons', model: 'mob_skeleton_miner', preview: true },
];
