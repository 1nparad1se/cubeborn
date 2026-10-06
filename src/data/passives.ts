import type { PassiveDef } from './types';

/** Passive items. Each level adds `perLevel` to the player's stats. */
export const PASSIVES: PassiveDef[] = [
  { id: 'might_crystal', name: { ru: 'Кристалл мощи', en: 'Might Crystal' }, desc: { ru: '+8% урона', en: '+8% damage' }, icon: 'crystal', color: 0xff5a5a, rarity: 'common', maxLevel: 5, perLevel: { might: 0.08 } },
  { id: 'iron_plate', name: { ru: 'Железная пластина', en: 'Iron Plate' }, desc: { ru: '+1 броня', en: '+1 armor' }, icon: 'plate', color: 0xb8c0cc, rarity: 'common', maxLevel: 5, perLevel: { armor: 1 } },
  { id: 'heart_gem', name: { ru: 'Самоцвет сердца', en: 'Heart Gem' }, desc: { ru: '+20 к макс. здоровью', en: '+20 max HP' }, icon: 'heart', color: 0xff4d79, rarity: 'common', maxLevel: 5, perLevel: { maxHp: 20 } },
  { id: 'wind_boots', name: { ru: 'Сапоги ветра', en: 'Wind Boots' }, desc: { ru: '+8% скорости', en: '+8% move speed' }, icon: 'boots', color: 0x7ee0c8, rarity: 'common', maxLevel: 5, perLevel: { moveSpeed: 0.08 } },
  { id: 'hourglass', name: { ru: 'Песочные часы', en: 'Hourglass' }, desc: { ru: '−6% перезарядки', en: '−6% cooldown' }, icon: 'hourglass', color: 0xffd36b, rarity: 'rare', maxLevel: 5, perLevel: { cooldown: 0.06 } },
  { id: 'prism_lens', name: { ru: 'Призма', en: 'Prism Lens' }, desc: { ru: '+10% площади', en: '+10% area' }, icon: 'lens', color: 0xa98cff, rarity: 'common', maxLevel: 5, perLevel: { area: 0.1 } },
  { id: 'quiver', name: { ru: 'Колчан', en: 'Quiver' }, desc: { ru: '+1 снаряд', en: '+1 projectile' }, icon: 'quiver', color: 0xc9a46b, rarity: 'epic', maxLevel: 2, perLevel: { amount: 1 } },
  { id: 'hawk_feather', name: { ru: 'Перо ястреба', en: 'Hawk Feather' }, desc: { ru: '+12% скорости снарядов', en: '+12% projectile speed' }, icon: 'feather', color: 0xe8e0d0, rarity: 'common', maxLevel: 5, perLevel: { projSpeed: 0.12 } },
  { id: 'ember_candle', name: { ru: 'Вечная свеча', en: 'Ember Candle' }, desc: { ru: '+12% длительности', en: '+12% duration' }, icon: 'candle', color: 0xffa64d, rarity: 'common', maxLevel: 5, perLevel: { duration: 0.12 } },
  { id: 'clover', name: { ru: 'Кубический клевер', en: 'Cube Clover' }, desc: { ru: '+12% удачи', en: '+12% luck' }, icon: 'clover', color: 0x5ee86b, rarity: 'rare', maxLevel: 5, perLevel: { luck: 0.12 } },
  { id: 'sage_eye', name: { ru: 'Око мудреца', en: "Sage's Eye" }, desc: { ru: '+8% опыта', en: '+8% experience' }, icon: 'eye', color: 0x6bd4ff, rarity: 'common', maxLevel: 5, perLevel: { growth: 0.08 } },
  { id: 'lodestone', name: { ru: 'Магнитный камень', en: 'Lodestone' }, desc: { ru: '+30% радиуса сбора', en: '+30% pickup radius' }, icon: 'magnet', color: 0xff6b6b, rarity: 'common', maxLevel: 5, perLevel: { magnet: 0.3 } },
  { id: 'regen_moss', name: { ru: 'Живой мох', en: 'Living Moss' }, desc: { ru: '+0.3 HP/сек', en: '+0.3 HP/sec' }, icon: 'moss', color: 0x6bc24a, rarity: 'common', maxLevel: 5, perLevel: { regen: 0.3 } },
  { id: 'hunter_mark', name: { ru: 'Метка охотника', en: "Hunter's Mark" }, desc: { ru: '+4% шанса крита', en: '+4% crit chance' }, icon: 'target', color: 0xff8b3d, rarity: 'rare', maxLevel: 5, perLevel: { critChance: 0.04 } },
  { id: 'whetstone', name: { ru: 'Точильный камень', en: 'Whetstone' }, desc: { ru: '+15% крит. урона', en: '+15% crit damage' }, icon: 'whetstone', color: 0x9aa4b0, rarity: 'common', maxLevel: 5, perLevel: { critDamage: 0.15 } },
  { id: 'golden_idol', name: { ru: 'Золотой идол', en: 'Golden Idol' }, desc: { ru: '+15% золота', en: '+15% gold' }, icon: 'idol', color: 0xffd23d, rarity: 'common', maxLevel: 5, perLevel: { greed: 0.15 } },
  { id: 'thorn_mail', name: { ru: 'Шипастая кольчуга', en: 'Thorn Mail' }, desc: { ru: 'Отражает 25% урона', en: 'Reflects 25% of damage' }, icon: 'thorns', color: 0x8fae5a, rarity: 'rare', maxLevel: 5, perLevel: { thorns: 0.25, armor: 0.5 } },
  { id: 'phoenix_feather', name: { ru: 'Перо феникса', en: 'Phoenix Feather' }, desc: { ru: '+1 воскрешение', en: '+1 revival' }, icon: 'phoenix', color: 0xff6a2a, rarity: 'legendary', maxLevel: 1, perLevel: { revival: 1 } },
  { id: 'blood_fang', name: { ru: 'Кровавый клык', en: 'Blood Fang' }, desc: { ru: 'Лечит 0.4 HP за убийство', en: 'Heals 0.4 HP per kill' }, icon: 'fang', color: 0xc8243a, rarity: 'rare', maxLevel: 5, perLevel: { lifesteal: 0.4 } },
  { id: 'heavy_gauntlet', name: { ru: 'Тяжёлая перчатка', en: 'Heavy Gauntlet' }, desc: { ru: '+25% отбрасывания, +3% урона', en: '+25% knockback, +3% damage' }, icon: 'gauntlet', color: 0x8a8f9a, rarity: 'common', maxLevel: 5, perLevel: { knockback: 0.25, might: 0.03 } },
  { id: 'piercing_rune', name: { ru: 'Руна пронзания', en: 'Piercing Rune' }, desc: { ru: '+1 пробивание', en: '+1 pierce' }, icon: 'rune', color: 0x5ad1ff, rarity: 'epic', maxLevel: 3, perLevel: { pierce: 1 } },
  { id: 'ward_charm', name: { ru: 'Оберег', en: 'Ward Charm' }, desc: { ru: '+4% уклонения', en: '+4% dodge' }, icon: 'charm', color: 0xc1a8ff, rarity: 'rare', maxLevel: 5, perLevel: { dodge: 0.04 } },
  { id: 'cursed_skull', name: { ru: 'Проклятый череп', en: 'Cursed Skull' }, desc: { ru: '+10% врагов, +8% опыта и золота', en: '+10% enemies, +8% XP and gold' }, icon: 'cskull', color: 0x7a3dff, rarity: 'rare', maxLevel: 5, perLevel: { curse: 0.1, growth: 0.08, greed: 0.08 } },
  { id: 'battle_banner', name: { ru: 'Боевое знамя', en: 'Battle Banner' }, desc: { ru: '+5% урона и площади', en: '+5% damage and area' }, icon: 'banner', color: 0xe84a4a, rarity: 'rare', maxLevel: 5, perLevel: { might: 0.05, area: 0.05 }, locked: true },
];

export const PASSIVE_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
