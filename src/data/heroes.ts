import { CLASSES } from '../game/action/classes';
import type { HeroDef } from './types';

/**
 * Playable heroes = the nine action-combat classes (src/game/action/classes). HeroDef is the light
 * view the menus, saves and achievements use; combat reads the full ClassDef.
 */
export const HEROES: HeroDef[] = CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  title: c.title,
  desc: c.desc,
  perkName: c.passive.name,
  perkDesc: c.passive.desc,
  perk: 'none',
  startWeapon: '',
  baseHp: c.baseHp,
  baseSpeed: c.baseSpeed,
  stats: {},
  model: c.id,
  color: c.color,
}));

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
