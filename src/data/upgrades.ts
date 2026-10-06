import type { PermUpgradeDef } from './types';

/** Permanent upgrades bought with gold between runs. Cost = baseCost * costGrowth^level. */
export const PERM_UPGRADES: PermUpgradeDef[] = [
  { id: 'might', name: { ru: 'Сила', en: 'Might' }, desc: { ru: '+5% урона', en: '+5% damage' }, icon: 'crystal', maxLevel: 5, baseCost: 200, costGrowth: 1.6, perLevel: { might: 0.05 } },
  { id: 'vitality', name: { ru: 'Выносливость', en: 'Vitality' }, desc: { ru: '+10 к макс. здоровью', en: '+10 max HP' }, icon: 'heart', maxLevel: 5, baseCost: 150, costGrowth: 1.6, perLevel: { maxHp: 10 } },
  { id: 'armor', name: { ru: 'Закалка', en: 'Toughness' }, desc: { ru: '+1 броня', en: '+1 armor' }, icon: 'plate', maxLevel: 3, baseCost: 300, costGrowth: 1.9, perLevel: { armor: 1 } },
  { id: 'swiftness', name: { ru: 'Скорость', en: 'Swiftness' }, desc: { ru: '+5% скорости', en: '+5% move speed' }, icon: 'boots', maxLevel: 3, baseCost: 250, costGrowth: 1.8, perLevel: { moveSpeed: 0.05 } },
  { id: 'recovery', name: { ru: 'Восстановление', en: 'Recovery' }, desc: { ru: '+0.15 HP/сек', en: '+0.15 HP/s' }, icon: 'moss', maxLevel: 5, baseCost: 180, costGrowth: 1.6, perLevel: { regen: 0.15 } },
  { id: 'luck', name: { ru: 'Удача', en: 'Luck' }, desc: { ru: '+8% удачи', en: '+8% luck' }, icon: 'clover', maxLevel: 3, baseCost: 300, costGrowth: 1.8, perLevel: { luck: 0.08 } },
  { id: 'growth', name: { ru: 'Опыт', en: 'Wisdom' }, desc: { ru: '+5% опыта', en: '+5% experience' }, icon: 'eye', maxLevel: 5, baseCost: 220, costGrowth: 1.6, perLevel: { growth: 0.05 } },
  { id: 'magic', name: { ru: 'Магия', en: 'Magic' }, desc: { ru: '+4% площади и длительности', en: '+4% area and duration' }, icon: 'lens', maxLevel: 4, baseCost: 260, costGrowth: 1.7, perLevel: { area: 0.04, duration: 0.04 } },
  { id: 'cooldown', name: { ru: 'Сосредоточение', en: 'Focus' }, desc: { ru: '−3% перезарядки', en: '−3% cooldown' }, icon: 'hourglass', maxLevel: 3, baseCost: 400, costGrowth: 1.9, perLevel: { cooldown: 0.03 } },
  { id: 'magnet', name: { ru: 'Притяжение', en: 'Magnetism' }, desc: { ru: '+20% радиуса сбора', en: '+20% pickup radius' }, icon: 'magnet', maxLevel: 3, baseCost: 150, costGrowth: 1.7, perLevel: { magnet: 0.2 } },
  { id: 'greed', name: { ru: 'Жадность', en: 'Greed' }, desc: { ru: '+10% золота', en: '+10% gold' }, icon: 'idol', maxLevel: 5, baseCost: 200, costGrowth: 1.6, perLevel: { greed: 0.1 } },
  { id: 'crit', name: { ru: 'Точность', en: 'Precision' }, desc: { ru: '+3% шанса крита', en: '+3% crit chance' }, icon: 'target', maxLevel: 3, baseCost: 300, costGrowth: 1.8, perLevel: { critChance: 0.03 } },
  { id: 'projspeed', name: { ru: 'Стремительность', en: 'Velocity' }, desc: { ru: '+8% скорости снарядов', en: '+8% projectile speed' }, icon: 'feather', maxLevel: 3, baseCost: 180, costGrowth: 1.7, perLevel: { projSpeed: 0.08 } },
  { id: 'amount', name: { ru: 'Множитель', en: 'Multiplier' }, desc: { ru: '+1 снаряд', en: '+1 projectile' }, icon: 'quiver', maxLevel: 1, baseCost: 5000, costGrowth: 1, perLevel: { amount: 1 } },
  { id: 'revival', name: { ru: 'Второй шанс', en: 'Second Chance' }, desc: { ru: '+1 воскрешение', en: '+1 revival' }, icon: 'phoenix', maxLevel: 1, baseCost: 3000, costGrowth: 1, perLevel: { revival: 1 } },
  { id: 'reroll', name: { ru: 'Переброс', en: 'Reroll' }, desc: { ru: '+1 переброс улучшений', en: '+1 upgrade reroll' }, icon: 'dice', maxLevel: 5, baseCost: 150, costGrowth: 1.5, perLevel: { reroll: 1 } },
  { id: 'skip', name: { ru: 'Пропуск', en: 'Skip' }, desc: { ru: '+1 пропуск улучшения', en: '+1 upgrade skip' }, icon: 'skip', maxLevel: 3, baseCost: 120, costGrowth: 1.5, perLevel: { skip: 1 } },
  { id: 'banish', name: { ru: 'Изгнание', en: 'Banish' }, desc: { ru: '+1 изгнание предмета из пула', en: '+1 item banish' }, icon: 'banish', maxLevel: 3, baseCost: 200, costGrowth: 1.6, perLevel: { banish: 1 } },
];

export const PERM_BY_ID: Record<string, PermUpgradeDef> = Object.fromEntries(PERM_UPGRADES.map((u) => [u.id, u]));

export function permCost(def: PermUpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level) / 10) * 10;
}
