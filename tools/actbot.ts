import type { Run } from '../src/game/Run';
import type { Enemy } from '../src/game/Enemy';
import { SLOT_ULT, SLOT_SPECIAL } from '../src/game/action/ActionSystem';
import { inside } from '../src/game/bosses/BossAttacks';

/**
 * Combat half of the headless bot: aims at the densest nearby group, holds the basic attack,
 * presses ready skills when foes are in reach, holds hold/charge skills for a while, dodges
 * telegraphed zones, fires Identity and the Ultimate, and spends skill points.
 * Returns the preferred fighting distance for the movement bot.
 */
const held = new Map<number, number>();
export function actBot(run: Run, dt: number): number {
  const a = run.action;
  const p = run.player;
  const c = run.ctl;
  const cls = a.cls;
  // spend points round-robin on unlocked skills; pick tripods (first tier: area, second: damage)
  while (a.points > 0) {
    let best = -1;
    for (let i = 0; i < 8; i++) if (a.canLearn(i) && (best < 0 || a.levels[i] < a.levels[best])) best = i;
    if (best < 0) break;
    a.learn(best);
    if (a.levels[best] >= 4 && a.tri[best][0] < 0) a.setTripod(best, 0, 1);
    if (a.levels[best] >= 7 && a.tri[best][1] < 0) a.setTripod(best, 1, 0);
  }
  // target: nearest enemy, aim at the middle of its neighbours
  let tgt: Enemy | null = null;
  let td = 1e9;
  run.enemies.forEachInRadius(p.x, p.z, 14, (e) => {
    if (e.def.category === 'prop') return;
    const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2 - (e.boss ? 30 : e.elite ? 10 : 0);
    if (d < td) {
      td = d;
      tgt = e;
    }
  });
  const ranged = cls.basic.ranged;
  const pref = ranged ? 6.5 : 1.6;
  c.attack = false;
  for (let i = 0; i < 10; i++) c.held[i] = false;
  // keep holding hold / charge skills for a while
  for (const [slot, t] of held) {
    const nt = t - dt;
    if (nt <= 0) held.delete(slot);
    else {
      held.set(slot, nt);
      c.held[slot] = true;
    }
  }
  if (!tgt) return pref;
  const e: Enemy = tgt;
  c.aimX = e.x;
  c.aimZ = e.z;
  // distance to the body's edge (bosses are huge)
  const dist = Math.max(0, Math.sqrt(Math.max(0, td + (e.boss ? 30 : e.elite ? 10 : 0))) - (e.boss ? e.radius : 0));
  // dodge out of a telegraphed zone under the hero
  for (const z of run.hazards.zones) {
    if (!z.active || z.visualOnly) continue;
    if (Math.hypot(p.x - z.x, p.z - z.z) < z.r + 0.3 && z.t < 0.45 && Math.random() < 0.3) {
      c.dodge = true;
      break;
    }
  }
  // boss telegraphs: roll out of one that is about to land
  for (const b of run.bosses)
    for (const tl of b.teles) {
      if (tl.done || tl.t > 0.45 || !tl.blast) continue;
      if (inside(tl, p.x, p.z, p.radius) && Math.random() < 0.35) c.dodge = true;
    }
  if (a.identityReady && Math.random() < 0.1) c.identity = true;
  if (a.ready(SLOT_ULT) && (e.boss || e.elite || run.enemies.aliveCount > 12) && dist < 7) c.casts.push(SLOT_ULT);
  if (cls.special && a.ready(SLOT_SPECIAL) && Math.random() < 0.05) c.casts.push(SLOT_SPECIAL);
  if (!a.busy || (a.cur && a.cur.src === 'basic')) {
    for (let i = 0; i < 8; i++) {
      const s = cls.skills[i];
      if (!a.ready(i)) continue;
      const reach = Math.max(2.5, s.range || s.radius || 3);
      if (dist > reach + 1) continue;
      c.casts.push(i);
      if (s.type === 'hold') held.set(i, s.holdMax ?? 2);
      if (s.type === 'charge') held.set(i, (s.chargeMax ?? 1) * 1.05);
      break;
    }
  }
  if (dist < (ranged ? 12 : 3.4)) c.attack = true;
  return pref;
}
