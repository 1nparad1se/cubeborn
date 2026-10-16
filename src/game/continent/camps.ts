import { CREATURES } from '../../data/bestiary';
import type { Camp } from '../map/greenvaleZones';
import type { ContinentData, XY } from './data';

/**
 * The continent's creature camps (world.json, stage 4): one MobWorld camp per species group, at
 * fixed coordinates with the designed level range, aggro and leash radii, respawn time, patrol
 * loop and member spots (ranged on their posts, melee at the front, the rest at the fire).
 */
export function continentCamps(d: ContinentData): Camp[] {
  const out: Camp[] = [];
  for (const c of d.world.camps) {
    let ranged = 0;
    let melee = 0;
    let rest = 0;
    for (const g of c.groups) {
      const creature = CREATURES.find((x) => x.id === g.species);
      if (!creature) continue;
      const homes: [number, number][] = [];
      for (let i = 0; i < g.count; i++) {
        let p: XY | undefined;
        if (g.attack === 'ranged') p = c.rangedPos[ranged++];
        else p = c.meleePos[melee++];
        p ??= c.rest[rest++];
        if (!p) {
          const a = (i / g.count) * Math.PI * 2 + out.length;
          p = [c.at[0] + Math.cos(a) * 2.5, c.at[1] + Math.sin(a) * 2.5];
        }
        homes.push([p[0], p[1]]);
      }
      out.push({
        creature,
        x: c.at[0],
        z: c.at[1],
        level: g.lv[0],
        lvMax: g.lv[1],
        size: g.count,
        id: c.id,
        aggro: c.aggro,
        leash: c.leash,
        respawn: c.respawnSec,
        unique: c.unique,
        homes,
        patrol: c.patrol?.length ? c.patrol.map((p) => [p[0], p[1]] as [number, number]) : undefined,
      });
    }
  }
  return out;
}
