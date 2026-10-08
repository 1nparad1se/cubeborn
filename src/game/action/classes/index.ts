import type { ClassDef, ClassId } from '../types';
import { BERSERKER } from './berserker';
import { DEATHBLADE } from './deathblade';
import { PALADIN } from './paladin';
import { RANGER } from './ranger';
import { REAPER } from './reaper';
import { SORCERESS } from './sorceress';
import { STEELFIST } from './steelfist';
import { SUMMONER } from './summoner';
import { TEMPLAR } from './templar';

/** The nine playable classes in select-screen order. */
export const CLASSES: ClassDef[] = [BERSERKER, PALADIN, STEELFIST, RANGER, DEATHBLADE, REAPER, SUMMONER, SORCERESS, TEMPLAR];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;

export const CLASS_IDS = CLASSES.map((c) => c.id);

export function classDef(id: string): ClassDef {
  return CLASS_BY_ID[id as ClassId] ?? BERSERKER;
}
