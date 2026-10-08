import type { Loc } from '../../data/types';
import { L } from './dsl';

/** Legendary item powers for the action combat (one per legendary item). */
export interface PowerDef {
  id: string;
  name: Loc;
  desc: Loc;
}

export const POWERS: PowerDef[] = [
  { id: 'p_breaker', name: L('Ломатель', 'Breaker'), desc: L('Оглушающий урон (stagger) +40%.', 'Stagger damage +40%.') },
  { id: 'p_awaken', name: L('Пробуждённый', 'Awakened'), desc: L('Шкала Пробуждения заполняется на 40% быстрее.', 'The Awakening gauge fills 40% faster.') },
  { id: 'p_backstab', name: L('Удар из тени', 'Shadowstrike'), desc: L('Удары со спины +25% урона.', 'Back attacks deal +25% damage.') },
  { id: 'p_wellspring', name: L('Родник силы', 'Wellspring'), desc: L('Ресурс класса копится на 30% быстрее.', 'The class resource builds 30% faster.') },
  { id: 'p_haste', name: L('Поспешность', 'Haste'), desc: L('Перезарядка навыков −12%.', 'Skill cooldowns −12%.') },
  { id: 'p_evasion', name: L('Уклонение', 'Evasion'), desc: L('Уклонение даёт щит 10% здоровья на 2 сек.', 'Dodging grants a 10% health shield for 2s.') },
  { id: 'p_precision', name: L('Точность', 'Precision'), desc: L('+12% шанса крита.', '+12% crit chance.') },
  { id: 'p_reaper', name: L('Палач', 'Executioner'), desc: L('+40% урона врагам с здоровьем ниже 30%.', '+40% damage to foes below 30% health.') },
  { id: 'p_breakpoint', name: L('Брешь', 'Breach'), desc: L('Оглушённые враги получают ещё +20% урона.', 'Broken foes take another +20% damage.') },
];

export const POWER_BY_ID: Record<string, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p]));
