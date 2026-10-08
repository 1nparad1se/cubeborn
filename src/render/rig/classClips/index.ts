import type { Clip } from '../clips';
import { BERSERKER_CLIPS } from './berserker';
import { PALADIN_CLIPS } from './paladin';
import { STEELFIST_CLIPS } from './steelfist';
import { RANGER_CLIPS } from './ranger';
import { DEATHBLADE_CLIPS } from './deathblade';
import { REAPER_CLIPS } from './reaper';
import { SUMMONER_CLIPS } from './summoner';
import { SORCERESS_CLIPS } from './sorceress';
import { TEMPLAR_CLIPS } from './templar';

/** Per-class action clip libraries, keyed by class id. */
export const CLASS_CLIPS: Record<string, Record<string, Clip>> = {
  berserker: BERSERKER_CLIPS,
  paladin: PALADIN_CLIPS,
  steelfist: STEELFIST_CLIPS,
  ranger: RANGER_CLIPS,
  deathblade: DEATHBLADE_CLIPS,
  reaper: REAPER_CLIPS,
  summoner: SUMMONER_CLIPS,
  sorceress: SORCERESS_CLIPS,
  templar: TEMPLAR_CLIPS,
};
