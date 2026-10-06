import type { StatKey, StatMods } from '../data/types';
import { BALANCE } from '../config/balance';

/** Fully resolved player stats used by every system during a run. */
export interface PlayerStats {
  maxHp: number;
  armor: number;
  moveSpeed: number; // multiplier
  might: number; // multiplier
  area: number; // multiplier
  cooldown: number; // multiplier (lower is faster)
  amount: number; // additive projectiles
  projSpeed: number; // multiplier
  duration: number; // multiplier
  luck: number; // multiplier
  growth: number; // multiplier
  magnet: number; // world radius
  regen: number; // hp per second
  critChance: number; // additive
  critDamage: number; // additive to crit multiplier
  greed: number; // multiplier
  knockback: number; // multiplier
  pierce: number; // additive
  revival: number;
  lifesteal: number; // hp per kill
  thorns: number; // fraction reflected
  curse: number; // multiplier on enemy count/hp
  dodge: number; // chance
  reroll: number;
  skip: number;
  banish: number;
}

export function sumMods(...list: StatMods[]): StatMods {
  const out: StatMods = {};
  for (const m of list) {
    for (const k in m) {
      const key = k as StatKey;
      out[key] = (out[key] ?? 0) + (m[key] ?? 0);
    }
  }
  return out;
}

export function resolveStats(baseHp: number, m: StatMods): PlayerStats {
  const g = (k: StatKey) => m[k] ?? 0;
  return {
    maxHp: Math.max(1, baseHp + g('maxHp')),
    armor: g('armor'),
    moveSpeed: Math.max(0.3, 1 + g('moveSpeed')),
    might: Math.max(0.1, 1 + g('might')),
    area: Math.max(0.3, 1 + g('area')),
    cooldown: Math.max(1 - BALANCE.maxCooldownReduction, 1 - g('cooldown')),
    amount: Math.round(g('amount')),
    projSpeed: Math.max(0.3, 1 + g('projSpeed')),
    duration: Math.max(0.3, 1 + g('duration')),
    luck: Math.max(0, 1 + g('luck')),
    growth: Math.max(0.1, 1 + g('growth')),
    magnet: BALANCE.basePickupRadius * Math.max(0.3, 1 + g('magnet')),
    regen: g('regen'),
    critChance: g('critChance'),
    critDamage: g('critDamage'),
    greed: Math.max(0, 1 + g('greed')),
    knockback: Math.max(0, 1 + g('knockback')),
    pierce: Math.round(g('pierce')),
    revival: Math.round(g('revival')),
    lifesteal: g('lifesteal'),
    thorns: g('thorns'),
    curse: Math.max(0.5, 1 + g('curse')),
    dodge: Math.min(BALANCE.maxDodge, g('dodge')),
    reroll: Math.round(g('reroll')) + BALANCE.baseRerolls,
    skip: Math.round(g('skip')) + BALANCE.baseSkips,
    banish: Math.round(g('banish')) + BALANCE.baseBanish,
  };
}
