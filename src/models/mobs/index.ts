import type { MobDef } from './mobKit';
import { forestSpider } from './forestSpider';
import { forestGoblin } from './forestGoblin';
import { forestTroll } from './forestTroll';
import { swampWitch } from './swampWitch';
import { skeletonMiner } from './skeletonMiner';
import { shadowGhost } from './shadowGhost';
import { jackal } from './jackal';
import { wildBoar } from './wildBoar';
import { carrionRaven } from './carrionRaven';
import { goblinArcher } from './goblinArcher';

/** Bestiary creature models by id (one file per creature). Not spawned in the world yet. */
export const MOB_DEFS: Record<string, MobDef> = Object.fromEntries([forestSpider(), forestGoblin(), goblinArcher(), forestTroll(), swampWitch(), skeletonMiner(), shadowGhost(), jackal(), wildBoar(), carrionRaven()].map((d) => [d.id, d]));
