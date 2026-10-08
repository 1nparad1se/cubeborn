import type { Loc } from '../../data/types';
import type {
  Anchor, BuffEv, ChainEv, CommandEv, FxEv, HitEv, MoveEv, ProjEv, Shape, SkillDef, Step, SummonEv, SummonKind, ZoneEv,
} from './types';

/** Small builders that keep the class tables in classes/*.ts readable. */

export const L = (ru: string, en: string): Loc => ({ ru, en });

export const circle = (r: number, at: Anchor = 'self', off?: number): Shape => ({ k: 'circle', r, at, off });
export const cone = (r: number, arc: number, back?: boolean): Shape => ({ k: 'cone', r, arc, back });
export const rect = (len: number, w: number, o: { back?: boolean; off?: number } = {}): Shape => ({ k: 'rect', len, w, ...o });
export const sides = (len: number, w: number): Shape => ({ k: 'sides', len, w });
export const ring = (r0: number, r1: number, at: Anchor = 'self'): Shape => ({ k: 'ring', r0, r1, at });
export const cross = (len: number, w: number, at: Anchor = 'self'): Shape => ({ k: 'cross', len, w, at });

export function hit(t: number, shape: Shape, dmg: number, o: Partial<Omit<HitEv, 'do' | 't' | 'shape' | 'dmg'>> = {}): HitEv {
  return { do: 'hit', t, shape, dmg, ...o };
}

export function move(t: number, kind: MoveEv['kind'], dist: number, dur: number, o: Partial<Omit<MoveEv, 'do' | 't' | 'kind' | 'dist' | 'dur'>> = {}): MoveEv {
  return { do: 'move', t, kind, dist, dur, ...o };
}

export function proj(t: number, o: Omit<ProjEv, 'do' | 't'>): ProjEv {
  return { do: 'proj', t, ...o };
}

export function zone(t: number, o: Omit<ZoneEv, 'do' | 't'>): ZoneEv {
  return { do: 'zone', t, ...o };
}

export function summon(t: number, kind: SummonKind, dur: number, dmg: number, o: Partial<Omit<SummonEv, 'do' | 't' | 'kind' | 'dur' | 'dmg'>> = {}): SummonEv {
  return { do: 'summon', t, kind, dur, dmg, ...o };
}

export function buff(t: number, dur: number, o: Omit<BuffEv, 'do' | 't' | 'dur'>): BuffEv {
  return { do: 'buff', t, dur, ...o };
}

export function fx(t: number, kind: FxEv['kind'], o: Omit<FxEv, 'do' | 't' | 'kind'> = {}): FxEv {
  return { do: 'fx', t, kind, ...o };
}

export function chain(t: number, o: Omit<ChainEv, 'do' | 't'>): ChainEv {
  return { do: 'chain', t, ...o };
}

export function command(t: number, dmg?: number): CommandEv {
  return { do: 'command', t, dmg };
}

export function step(anim: string, dur: number, ev: Step['ev'], o: Partial<Omit<Step, 'anim' | 'dur' | 'ev'>> = {}): Step {
  return { anim, dur, ev, ...o };
}

export function skill(s: SkillDef): SkillDef {
  return s;
}
