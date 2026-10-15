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
import { swampDrowned } from './swampDrowned';
import { rootSpider } from './rootSpider';
import { iceTroll } from './iceTroll';
import { northBerserker } from './northBerserker';
import { frostWolf } from './frostWolf';
import { iceKnight } from './iceKnight';
import { desertRaider } from './desertRaider';
import { sandScorpion } from './sandScorpion';
import { giantBat } from './giantBat';
import { caveOrc } from './caveOrc';

/** Bestiary creature models by id (one file per creature). Not spawned in the world yet. */
export const MOB_DEFS: Record<string, MobDef> = Object.fromEntries(
  [forestSpider(), forestGoblin(), goblinArcher(), forestTroll(), swampWitch(), skeletonMiner(), shadowGhost(), jackal(), wildBoar(), carrionRaven(), swampDrowned(), rootSpider(), iceTroll(), northBerserker(), frostWolf(), iceKnight(), desertRaider(), sandScorpion(), giantBat(), caveOrc()].map((d) => [d.id, d]),
);
