import type { Loc } from '../../data/types';
import type { DmgType } from '../types';
import { L } from './dsl';
import type { SkillDef, StatusId, Tripod } from './types';

/** Status each element adds through the "Elemental Seal" tripod. */
export const EL_STATUS: Record<DmgType, StatusId> = { phys: 'bleed', fire: 'burn', ice: 'freeze', lightning: 'stun', poison: 'poison', dark: 'curse', magic: 'weaken' };

const ST_NAME: Record<StatusId, Loc> = {
  bleed: L('кровотечение', 'bleeding'), burn: L('горение', 'burning'), freeze: L('заморозку', 'freeze'), stun: L('оглушение', 'stun'),
  poison: L('яд', 'poison'), curse: L('проклятие', 'curse'), weaken: L('ослабление', 'weaken'), slow: L('замедление', 'slow'), root: L('обездвиживание', 'root'), mark: L('метку', 'mark'),
};

/**
 * Skill upgrades (tripods): every skill offers three choices at level 4 and three at level 7.
 * Tier 1 shapes the skill (cooldown, area, status), tier 2 makes it stronger (damage, stagger, speed).
 */
export function tripodsFor(s: SkillDef): [Tripod[], Tripod[]] {
  const st = EL_STATUS[s.el];
  const t1: Tripod[] = [
    { id: 'cd', kind: 'cd', v: 0.2, name: L('Быстрая перезарядка', 'Quick Recovery'), desc: L('Перезарядка −20%.', 'Cooldown −20%.') },
    { id: 'area', kind: 'area', v: 0.25, name: L('Широкий охват', 'Wide Reach'), desc: L('Радиус и размер +25%.', 'Radius and size +25%.') },
    {
      id: 'status', kind: 'status', v: 1, st, name: L('Стихийная печать', 'Elemental Seal'),
      desc: { ru: `Удары накладывают ${ST_NAME[st].ru}.`, en: `Hits inflict ${ST_NAME[st].en}.` },
    },
  ];
  const t2: Tripod[] = [
    { id: 'dmg', kind: 'dmg', v: 0.35, name: L('Сокрушение', 'Devastation'), desc: L('Урон +35%.', 'Damage +35%.') },
    { id: 'stag', kind: 'stag', v: 0.6, name: L('Пролом', 'Breaker'), desc: L('Оглушающий урон +60% и сверхброня во время навыка.', 'Stagger damage +60% and super armor while casting.') },
    { id: 'speed', kind: 'speed', v: 0.25, name: L('Стремительность', 'Swiftness'), desc: L('Навык выполняется на 25% быстрее.', 'The skill plays 25% faster.') },
  ];
  return [t1, t2];
}

/** Default strength of a status added by the tripod. */
export const ST_DEFAULT: Record<StatusId, number> = { burn: 5, slow: 0.5, freeze: 1.2, stun: 0.8, poison: 5, bleed: 5, curse: 4, weaken: 4, root: 1.5, mark: 6 };
