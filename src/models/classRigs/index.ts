import type { HeroRigDef } from '../../render/rig/HeroRig';
import { berserkerRig } from './berserker';
import { paladinRig } from './paladin';
import { steelfistRig } from './steelfist';
import { rangerRig } from './ranger';
import { deathbladeRig } from './deathblade';
import { reaperRig } from './reaper';
import { summonerRig } from './summoner';
import { sorceressRig } from './sorceress';
import { templarRig } from './templar';

/** Models of the nine action classes (one file per class). */
export const CLASS_RIGS: Record<string, HeroRigDef> = Object.fromEntries([berserkerRig(), paladinRig(), steelfistRig(), rangerRig(), deathbladeRig(), reaperRig(), summonerRig(), sorceressRig(), templarRig()].map((d) => [d.id, d]));
