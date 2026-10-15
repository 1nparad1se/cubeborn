import type { Run } from '../../game/Run';
import type { ActFx } from '../../game/action/vfx';
import type { ActionFxRenderer } from '../ActionFxRenderer';
import { berserkerVfx } from './berserker';

/**
 * A class's own look for the effects its hero emits. Purely visual: the simulation never reads it,
 * so swapping or removing one cannot change damage, timing or hit areas.
 */
export interface ClassVfx {
  /** Draws one of the hero's effects; return true when drawn (the shared look is skipped). `k` runs 1 -> 0. */
  draw?(f: ActFx, k: number, first: boolean, p: ActionFxRenderer): boolean;
  /** Per-frame effects driven by the playing action step (preparation and wind-up before the hit lands). */
  frame?(run: Run, p: ActionFxRenderer): void;
}

const REGISTRY: Record<string, () => ClassVfx> = {
  berserker: berserkerVfx,
};

/** The class's effect set, or null to keep the shared look. */
export function classVfx(heroId: string): ClassVfx | null {
  return REGISTRY[heroId]?.() ?? null;
}
