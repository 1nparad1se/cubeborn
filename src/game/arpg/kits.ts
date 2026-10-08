import type { Loc } from '../../data/types';
import type { DmgType } from '../types';

/**
 * Action-RPG class kits: every hero has a basic attack, three skills (Q/W/E), an Ultimate (R),
 * a class resource and a unique mechanic. Skills are built from small action primitives so the
 * caster in Skills.ts can run every kit with one interpreter.
 */

export type StatusId = 'burn' | 'slow' | 'freeze' | 'stun' | 'poison' | 'bleed' | 'curse' | 'weaken';

export type ActKind =
  /** Melee arc in front of the hero toward the cursor. */
  | 'cone'
  /** Projectiles toward the cursor. */
  | 'proj'
  /** Ring around the hero. */
  | 'nova'
  /** Area at the cursor (clamped to range) after a telegraph; may tick for `dur`. */
  | 'ground'
  /** Dash toward the cursor hitting everything on the way. */
  | 'dash'
  /** Self buff. */
  | 'buff'
  /** Summons allies near the hero. */
  | 'summon'
  /** Lightning that jumps between enemies starting near the cursor. */
  | 'chain'
  /** Straight line toward the cursor. */
  | 'beam'
  /** Vortex at the cursor pulling enemies in. */
  | 'pull'
  /** Teleport to the cursor. */
  | 'blink'
  /** Stationary emitter at the cursor that shoots the nearest enemy. */
  | 'turret'
  /** Heal the hero (fraction of max HP). */
  | 'heal';

export interface Act {
  k: ActKind;
  dmg?: number;
  el?: DmgType;
  /** Radius (cone/nova/ground/pull) or width (beam). */
  r?: number;
  /** Cone arc in degrees. */
  arc?: number;
  /** Reach: cone length, cast range, dash distance, beam length. */
  range?: number;
  /** Count: projectiles, chain jumps, summons, ticks. */
  n?: number;
  spread?: number;
  speed?: number;
  pierce?: number;
  vis?: string;
  color?: number;
  /** Telegraph / fuse before a ground effect lands. */
  delay?: number;
  /** Lasting effects: seconds. */
  dur?: number;
  /** Seconds between ticks for lasting effects. */
  every?: number;
  /** Projectile explodes on hit/expiry with this radius. */
  explode?: number;
  st?: StatusId;
  /** Status power: seconds for stun/freeze/curse/weaken, dps for burn/poison/bleed, slow factor for slow. */
  stp?: number;
  knock?: number;
  /** Buff fields. */
  buff?: Partial<SkillBuff>;
  heal?: number;
  /** Start position: 'self' (default) or 'aim'. */
  at?: 'self' | 'aim';
}

export interface SkillBuff {
  dmg: number;
  speed: number;
  armor: number;
  atkSpeed: number;
  lifesteal: number;
  crit: number;
  /** Reflects this fraction of melee damage. */
  thorns: number;
}

export type UpKind = 'dmg' | 'cd' | 'area' | 'count' | 'dur' | 'cost' | 'status' | 'special';
export type SpecialId = 'echo' | 'leech' | 'refund' | 'execute' | 'shock' | 'trail' | 'pull' | 'barrier' | 'crit' | 'pierce';

export interface SkillUp {
  t: UpKind;
  v: number;
  st?: StatusId;
  sp?: SpecialId;
}

export interface SkillDef {
  id: string;
  name: Loc;
  desc: Loc;
  icon: string;
  color: number;
  cd: number;
  /** Resource cost (for 'heat' classes this is heat generated instead). */
  cost: number;
  acts: Act[];
  /** Five upgrades for levels 2..6 (Ultimates: three for 12/18/22). */
  ups: SkillUp[];
  /** Locks facing for this long after casting. */
  lock?: number;
}

export type ResourceId = 'rage' | 'focus' | 'mana' | 'energy' | 'spirit' | 'heat' | 'charge' | 'steam' | 'faith';

export interface ResourceDef {
  id: ResourceId;
  name: Loc;
  color: string;
  max: number;
  /** Per second (negative = decay). */
  regen: number;
  /** Starts full? */
  startFull: boolean;
  /** Gain per basic-attack hit / per kill / per damage taken (fraction of damage). */
  onHit: number;
  onKill: number;
  onHurt: number;
}

export interface BasicDef {
  act: Act;
  /** Seconds between attacks at base attack speed. */
  interval: number;
  name: Loc;
}

export interface ClassKit {
  hero: string;
  role: Loc;
  res: ResourceDef;
  basic: BasicDef;
  /** Q, W, E. */
  skills: [SkillDef, SkillDef, SkillDef];
  ult: SkillDef;
  mechanic: { id: string; name: Loc; desc: Loc };
  /** Strengths/weaknesses blurb for the hero screen. */
  traits: Loc;
}

const loc = (ru: string, en: string): Loc => ({ ru, en });

const RES: Record<ResourceId, ResourceDef> = {
  rage: { id: 'rage', name: loc('Ярость', 'Rage'), color: '#e0403a', max: 100, regen: -4, startFull: false, onHit: 7, onKill: 2, onHurt: 0.6 },
  focus: { id: 'focus', name: loc('Концентрация', 'Focus'), color: '#f0c040', max: 100, regen: 14, startFull: true, onHit: 3, onKill: 0, onHurt: 0 },
  mana: { id: 'mana', name: loc('Мана', 'Mana'), color: '#3a8aff', max: 120, regen: 9, startFull: true, onHit: 0, onKill: 1, onHurt: 0 },
  energy: { id: 'energy', name: loc('Энергия', 'Energy'), color: '#7ae05a', max: 100, regen: 16, startFull: true, onHit: 1, onKill: 0, onHurt: 0 },
  spirit: { id: 'spirit', name: loc('Дух', 'Spirit'), color: '#a070ff', max: 100, regen: 4, startFull: true, onHit: 1, onKill: 7, onHurt: 0 },
  heat: { id: 'heat', name: loc('Нестабильность', 'Volatility'), color: '#9cff4f', max: 100, regen: -9, startFull: false, onHit: 0, onKill: 0, onHurt: 0 },
  charge: { id: 'charge', name: loc('Заряд', 'Charge'), color: '#4ad0ff', max: 100, regen: 8, startFull: true, onHit: 2, onKill: 1, onHurt: 0 },
  steam: { id: 'steam', name: loc('Пар', 'Steam'), color: '#d8a060', max: 100, regen: 11, startFull: true, onHit: 0, onKill: 1, onHurt: 0 },
  faith: { id: 'faith', name: loc('Вера', 'Faith'), color: '#ffe08a', max: 100, regen: 5, startFull: true, onHit: 4, onKill: 1, onHurt: 0.2 },
};

export const RESOURCES = RES;

// --------------------------------------------------------------------------------- kits
export const KITS: ClassKit[] = [
  // ---------------------------------------------------------------- Bram: tank
  {
    hero: 'bram',
    role: loc('Танк', 'Tank'),
    res: RES.rage,
    traits: loc('Очень живучий, держит толпу и контролирует её. Медленный и с малой дальностью.', 'Very sturdy, holds and controls crowds. Slow with short reach.'),
    mechanic: { id: 'bulwark', name: loc('Несокрушимость', 'Bulwark'), desc: loc('Каждые 10 ярости дают +1 брони. Получая удар, копит ярость.', 'Every 10 rage grants +1 armor. Taking hits builds rage.') },
    basic: { name: loc('Рубящий удар', 'Cleave'), interval: 0.72, act: { k: 'cone', dmg: 14, el: 'phys', range: 2.7, arc: 130, knock: 1.4 } },
    skills: [
      {
        id: 'bram_slam', name: loc('Сотрясение земли', 'Earthshaker'), desc: loc('Удар щитом о землю оглушает всех рядом.', 'Slams the ground, stunning everything nearby.'),
        icon: 'gauntlet', color: 0xc8a060, cd: 7, cost: 25, lock: 0.35,
        acts: [{ k: 'nova', dmg: 30, el: 'phys', r: 3.2, st: 'stun', stp: 1.2, knock: 2 }],
        ups: [{ t: 'dmg', v: 0.3 }, { t: 'area', v: 0.2 }, { t: 'status', v: 0.5, st: 'stun' }, { t: 'special', v: 1, sp: 'echo' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'bram_charge', name: loc('Таран', 'Bull Rush'), desc: loc('Рывок к курсору, сбивает и ослабляет врагов.', 'Charges to the cursor, bowling over and weakening foes.'),
        icon: 'boots', color: 0x8ab0e0, cd: 8, cost: 20,
        acts: [{ k: 'dash', dmg: 26, el: 'phys', range: 7, r: 1.4, st: 'weaken', stp: 4, knock: 3 }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'cd', v: 0.2 }, { t: 'special', v: 1, sp: 'barrier' }, { t: 'area', v: 0.25 }, { t: 'special', v: 1, sp: 'refund' }],
      },
      {
        id: 'bram_bulwark', name: loc('Каменная кожа', 'Stoneskin'), desc: loc('+броня и отражение урона на 6 сек.', '+armor and damage reflection for 6s.'),
        icon: 'plate', color: 0x9aa8c0, cd: 16, cost: 30,
        acts: [{ k: 'buff', dur: 6, buff: { armor: 6, thorns: 0.6 } }, { k: 'heal', heal: 0.08 }],
        ups: [{ t: 'dur', v: 0.25 }, { t: 'cd', v: 0.15 }, { t: 'special', v: 1, sp: 'leech' }, { t: 'dur', v: 0.25 }, { t: 'cd', v: 0.2 }],
      },
    ],
    ult: {
      id: 'bram_ult', name: loc('Падение крепости', 'Fortress Fall'), desc: loc('Гигантский прыжок к курсору: оглушение и огромный урон.', 'Leaps to the cursor: huge damage and a long stun.'),
      icon: 'meteor', color: 0xffc070, cd: 45, cost: 50, lock: 0.6,
      acts: [{ k: 'blink', range: 9 }, { k: 'nova', dmg: 110, el: 'phys', r: 5, st: 'stun', stp: 2.5, knock: 4 }, { k: 'buff', dur: 5, buff: { armor: 10 } }],
      ups: [{ t: 'dmg', v: 0.5 }, { t: 'area', v: 0.25 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Shen: fast melee
  {
    hero: 'shen',
    role: loc('Быстрый боец', 'Fast melee'),
    res: RES.focus,
    traits: loc('Самый быстрый, мощные комбо и рывки. Мало здоровья для ближнего боя.', 'Fastest hero with combos and dashes. Low HP for a melee.'),
    mechanic: { id: 'flow', name: loc('Поток', 'Flow'), desc: loc('Каждый 3-й обычный удар бьёт волной ветра и сокращает перезарядку навыков на 0.5 сек.', 'Every 3rd basic strike releases a wind wave and cuts skill cooldowns by 0.5s.') },
    basic: { name: loc('Удар ладонью', 'Palm Strike'), interval: 0.36, act: { k: 'cone', dmg: 8, el: 'phys', range: 2.2, arc: 100, knock: 0.6 } },
    skills: [
      {
        id: 'shen_dash', name: loc('Шаг ветра', 'Wind Step'), desc: loc('Стремительный рывок сквозь врагов с кровотечением.', 'A swift dash through foes that makes them bleed.'),
        icon: 'feather', color: 0xf0e0a0, cd: 4, cost: 20,
        acts: [{ k: 'dash', dmg: 20, el: 'phys', range: 6, r: 1.2, st: 'bleed', stp: 8 }],
        ups: [{ t: 'dmg', v: 0.3 }, { t: 'cd', v: 0.2 }, { t: 'special', v: 1, sp: 'refund' }, { t: 'status', v: 0.5, st: 'bleed' }, { t: 'special', v: 1, sp: 'echo' }],
      },
      {
        id: 'shen_palms', name: loc('Сто ладоней', 'Hundred Palms'), desc: loc('Серия из 6 быстрых ударов впереди.', 'A flurry of 6 rapid strikes ahead.'),
        icon: 'fist', color: 0xffc66b, cd: 6, cost: 30, lock: 0.5,
        acts: [{ k: 'cone', dmg: 9, el: 'phys', range: 2.8, arc: 90, n: 6, every: 0.08, knock: 0.3 }],
        ups: [{ t: 'count', v: 2 }, { t: 'dmg', v: 0.3 }, { t: 'special', v: 1, sp: 'crit' }, { t: 'area', v: 0.25 }, { t: 'special', v: 1, sp: 'execute' }],
      },
      {
        id: 'shen_cyclone', name: loc('Вихрь', 'Cyclone'), desc: loc('Смерч вокруг героя затягивает и замедляет врагов.', 'A whirlwind around the hero pulls and slows foes.'),
        icon: 'tornado', color: 0xc0f0ff, cd: 10, cost: 35,
        acts: [{ k: 'nova', dmg: 16, el: 'phys', r: 3.6, n: 4, every: 0.3, st: 'slow', stp: 0.5 }],
        ups: [{ t: 'area', v: 0.2 }, { t: 'special', v: 1, sp: 'pull' }, { t: 'dmg', v: 0.35 }, { t: 'count', v: 2 }, { t: 'cd', v: 0.25 }],
      },
    ],
    ult: {
      id: 'shen_ult', name: loc('Тысяча порывов', 'Thousand Gales'), desc: loc('Неуязвимый танец: 8 рывков между ближайшими врагами.', 'An invulnerable dance: 8 dashes between nearby foes.'),
      icon: 'cskull', color: 0xfff0b0, cd: 40, cost: 50,
      acts: [{ k: 'dash', dmg: 45, el: 'phys', range: 5, r: 1.6, n: 8, st: 'bleed', stp: 12 }],
      ups: [{ t: 'count', v: 3 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Lyra: ranged mage
  {
    hero: 'lyra',
    role: loc('Маг', 'Mage'),
    res: RES.mana,
    traits: loc('Огромный урон по площади с дистанции. Хрупкая, зависит от маны.', 'Huge ranged area damage. Fragile and mana-hungry.'),
    mechanic: { id: 'spark', name: loc('Искра', 'Kindle'), desc: loc('После навыка следующая обычная атака — взрывной огненный шар.', 'After a skill, the next basic attack is an exploding fireball.') },
    basic: { name: loc('Огненная стрела', 'Fire Bolt'), interval: 0.55, act: { k: 'proj', dmg: 11, el: 'fire', speed: 17, range: 12, vis: 'fireball', color: 0xff8a2a } },
    skills: [
      {
        id: 'lyra_meteor', name: loc('Метеор', 'Meteor'), desc: loc('Через миг метеор падает на курсор и оставляет пламя.', 'A meteor crashes at the cursor and leaves fire.'),
        icon: 'meteor', color: 0xff8a2a, cd: 6, cost: 35, lock: 0.3,
        acts: [{ k: 'ground', dmg: 45, el: 'fire', r: 2.6, range: 13, delay: 0.7, st: 'burn', stp: 10, vis: 'meteor' }],
        ups: [{ t: 'dmg', v: 0.3 }, { t: 'area', v: 0.2 }, { t: 'special', v: 1, sp: 'trail' }, { t: 'cost', v: 0.25 }, { t: 'special', v: 1, sp: 'echo' }],
      },
      {
        id: 'lyra_frost', name: loc('Ледяное кольцо', 'Frost Ring'), desc: loc('Волна холода вокруг замораживает врагов.', 'A wave of cold freezes nearby foes.'),
        icon: 'shard', color: 0x8ae8ff, cd: 9, cost: 30,
        acts: [{ k: 'nova', dmg: 18, el: 'ice', r: 4, st: 'freeze', stp: 2 }],
        ups: [{ t: 'status', v: 0.5, st: 'freeze' }, { t: 'area', v: 0.2 }, { t: 'dmg', v: 0.4 }, { t: 'cd', v: 0.2 }, { t: 'special', v: 1, sp: 'barrier' }],
      },
      {
        id: 'lyra_blink', name: loc('Пепельный скачок', 'Ash Blink'), desc: loc('Телепорт к курсору, взрыв огня на месте исчезновения.', 'Teleports to the cursor, leaving a fire blast behind.'),
        icon: 'phoenix', color: 0xffb060, cd: 8, cost: 20,
        acts: [{ k: 'nova', dmg: 20, el: 'fire', r: 2.5, st: 'burn', stp: 6 }, { k: 'blink', range: 8 }],
        ups: [{ t: 'cd', v: 0.2 }, { t: 'dmg', v: 0.4 }, { t: 'special', v: 1, sp: 'barrier' }, { t: 'area', v: 0.3 }, { t: 'cd', v: 0.2 }],
      },
    ],
    ult: {
      id: 'lyra_ult', name: loc('Огненный шторм', 'Firestorm'), desc: loc('Дождь из 10 метеоров вокруг курсора.', 'Rains 10 meteors around the cursor.'),
      icon: 'sun', color: 0xff6a1a, cd: 50, cost: 60, lock: 0.4,
      acts: [{ k: 'ground', dmg: 55, el: 'fire', r: 2.2, range: 14, delay: 0.6, n: 10, every: 0.18, spread: 4, st: 'burn', stp: 14, vis: 'meteor' }],
      ups: [{ t: 'count', v: 4 }, { t: 'dmg', v: 0.4 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Kestrel: crowd control archer
  {
    hero: 'kestrel',
    role: loc('Контроль', 'Crowd control'),
    res: RES.energy,
    traits: loc('Держит врагов на расстоянии ловушками и замедлением, сильные криты. Слаба в упор.', 'Keeps foes at bay with traps and slows; strong crits. Weak up close.'),
    mechanic: { id: 'mark', name: loc('Метка охотника', 'Hunter’s Mark'), desc: loc('Обычные стрелы помечают цель на 4 сек.: навыки наносят ей +30% урона.', 'Basic arrows mark targets for 4s: skills deal +30% to them.') },
    basic: { name: loc('Выстрел', 'Shot'), interval: 0.45, act: { k: 'proj', dmg: 10, el: 'phys', speed: 26, range: 15, vis: 'arrow', color: 0xe8d8b0, pierce: 1 } },
    skills: [
      {
        id: 'kes_volley', name: loc('Веер стрел', 'Fan Volley'), desc: loc('Веер из 7 замедляющих стрел.', 'A fan of 7 slowing arrows.'),
        icon: 'quiver', color: 0xc8e0a0, cd: 5, cost: 30,
        acts: [{ k: 'proj', dmg: 14, el: 'phys', n: 7, spread: 55, speed: 24, range: 13, vis: 'arrow', color: 0xc8e0a0, st: 'slow', stp: 0.5, pierce: 1 }],
        ups: [{ t: 'count', v: 2 }, { t: 'dmg', v: 0.3 }, { t: 'special', v: 1, sp: 'pierce' }, { t: 'special', v: 1, sp: 'crit' }, { t: 'cd', v: 0.25 }],
      },
      {
        id: 'kes_net', name: loc('Ловчая сеть', 'Snare Net'), desc: loc('Сеть у курсора обездвиживает врагов.', 'A net at the cursor roots foes in place.'),
        icon: 'chain', color: 0xd0c090, cd: 9, cost: 25,
        acts: [{ k: 'ground', dmg: 10, el: 'phys', r: 2.6, range: 12, delay: 0.25, st: 'stun', stp: 2 }],
        ups: [{ t: 'area', v: 0.25 }, { t: 'status', v: 0.5, st: 'stun' }, { t: 'special', v: 1, sp: 'pull' }, { t: 'cd', v: 0.2 }, { t: 'status', v: 1, st: 'weaken' }],
      },
      {
        id: 'kes_frost', name: loc('Ледяная стрела', 'Frost Arrow'), desc: loc('Пронзающая стрела, замораживающая всех на линии.', 'A piercing arrow that freezes everything in line.'),
        icon: 'bow', color: 0x8ae8ff, cd: 7, cost: 30,
        acts: [{ k: 'beam', dmg: 34, el: 'ice', range: 16, r: 0.9, st: 'freeze', stp: 1.6 }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'status', v: 0.5, st: 'freeze' }, { t: 'area', v: 0.3 }, { t: 'special', v: 1, sp: 'execute' }, { t: 'cd', v: 0.25 }],
      },
    ],
    ult: {
      id: 'kes_ult', name: loc('Ливень стрел', 'Arrow Storm'), desc: loc('4 сек. стрелы падают на область у курсора, всё замедлено.', 'For 4s arrows rain on the cursor area, slowing everything.'),
      icon: 'crossbow', color: 0xe8e8a0, cd: 45, cost: 60,
      acts: [{ k: 'ground', dmg: 22, el: 'phys', r: 4.5, range: 14, delay: 0.3, dur: 4, every: 0.35, st: 'slow', stp: 0.4 }],
      ups: [{ t: 'dur', v: 0.4 }, { t: 'dmg', v: 0.5 }, { t: 'area', v: 0.25 }],
    },
  },
  // ---------------------------------------------------------------- Morwen: summoner
  {
    hero: 'morwen',
    role: loc('Призыватель', 'Summoner'),
    res: RES.spirit,
    traits: loc('Армия скелетов сражается за неё, сильное проклятие. Сама слабая в бою.', 'An army of skeletons fights for her; strong curses. Weak on her own.'),
    mechanic: { id: 'harvest', name: loc('Жатва душ', 'Soul Harvest'), desc: loc('Убийства дают Дух; каждый 6-й убитый враг встаёт скелетом.', 'Kills grant Spirit; every 6th slain foe rises as a skeleton.') },
    basic: { name: loc('Костяная игла', 'Bone Needle'), interval: 0.6, act: { k: 'proj', dmg: 9, el: 'dark', speed: 18, range: 12, vis: 'wispshot', color: 0xc8a0ff } },
    skills: [
      {
        id: 'mor_raise', name: loc('Поднять мёртвых', 'Raise Dead'), desc: loc('Призывает 3 скелетов на 14 сек.', 'Summons 3 skeletons for 14s.'),
        icon: 'skull', color: 0xe8e2cc, cd: 9, cost: 40,
        acts: [{ k: 'summon', dmg: 10, el: 'dark', n: 3, dur: 14 }],
        ups: [{ t: 'count', v: 1 }, { t: 'dmg', v: 0.35 }, { t: 'dur', v: 0.3 }, { t: 'count', v: 1 }, { t: 'cd', v: 0.25 }],
      },
      {
        id: 'mor_curse', name: loc('Порча', 'Hex'), desc: loc('Проклятие у курсора: враги получают больше урона и слабеют.', 'A hex at the cursor: foes take more damage and are weakened.'),
        icon: 'eye', color: 0x8c5ad6, cd: 8, cost: 25,
        acts: [{ k: 'ground', dmg: 12, el: 'dark', r: 3.4, range: 13, delay: 0.3, st: 'curse', stp: 6 }, { k: 'ground', r: 3.4, range: 13, delay: 0.3, st: 'weaken', stp: 6 }],
        ups: [{ t: 'area', v: 0.25 }, { t: 'status', v: 3, st: 'curse' }, { t: 'dmg', v: 0.5 }, { t: 'special', v: 1, sp: 'pull' }, { t: 'cd', v: 0.25 }],
      },
      {
        id: 'mor_drain', name: loc('Похищение жизни', 'Life Drain'), desc: loc('Луч тьмы ранит врагов на линии и лечит хозяйку.', 'A dark beam hurts foes in line and heals Morwen.'),
        icon: 'fang', color: 0xb070ff, cd: 7, cost: 30,
        acts: [{ k: 'beam', dmg: 26, el: 'dark', range: 11, r: 1, st: 'poison', stp: 5 }],
        ups: [{ t: 'special', v: 1, sp: 'leech' }, { t: 'dmg', v: 0.35 }, { t: 'area', v: 0.3 }, { t: 'cd', v: 0.2 }, { t: 'dmg', v: 0.35 }],
      },
    ],
    ult: {
      id: 'mor_ult', name: loc('Легион костей', 'Bone Legion'), desc: loc('Призывает 8 скелетов-воинов на 20 сек.', 'Summons 8 skeleton warriors for 20s.'),
      icon: 'cskull', color: 0xd0b0ff, cd: 60, cost: 70,
      acts: [{ k: 'summon', dmg: 18, el: 'dark', n: 8, dur: 20 }, { k: 'nova', dmg: 30, el: 'dark', r: 4, st: 'curse', stp: 6 }],
      ups: [{ t: 'count', v: 4 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Fizzwick: risk / reward
  {
    hero: 'fizz',
    role: loc('Риск и награда', 'Risk / reward'),
    res: RES.heat,
    traits: loc('Навыки не тратят ресурс, а копят Нестабильность: чем она выше, тем больше урон. На 100 взрывается и ранит себя.', 'Skills build Volatility instead of spending it: higher means more damage. At 100 it explodes, hurting him too.'),
    mechanic: { id: 'volatile', name: loc('Нестабильность', 'Volatility'), desc: loc('+0.6% урона за каждую единицу. На 100 — взрыв: 15% здоровья себе и огромный урон вокруг.', '+0.6% damage per point. At 100 it blows up: 15% of his HP and big damage around.') },
    basic: { name: loc('Склянка', 'Vial'), interval: 0.7, act: { k: 'proj', dmg: 9, el: 'poison', speed: 14, range: 11, vis: 'flask', color: 0x9cff4f, explode: 1.6, st: 'poison', stp: 4 } },
    skills: [
      {
        id: 'fizz_bomb', name: loc('Кислотная бомба', 'Acid Bomb'), desc: loc('Бомба у курсора: взрыв и ядовитая лужа.', 'A bomb at the cursor: blast and a poison pool.'),
        icon: 'bomb', color: 0x9cff4f, cd: 5, cost: 22,
        acts: [{ k: 'ground', dmg: 34, el: 'poison', r: 2.6, range: 12, delay: 0.55, st: 'poison', stp: 10, vis: 'bomb' }, { k: 'ground', dmg: 6, el: 'poison', r: 2.2, range: 12, delay: 0.6, dur: 3, every: 0.5, st: 'poison', stp: 6, vis: 'pool' }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'area', v: 0.2 }, { t: 'special', v: 1, sp: 'echo' }, { t: 'status', v: 6, st: 'poison' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'fizz_flame', name: loc('Огнесмесь', 'Firemix'), desc: loc('Струя горящей смеси перед собой.', 'A spray of burning mixture ahead.'),
        icon: 'flask', color: 0xff8a2a, cd: 6, cost: 25, lock: 0.4,
        acts: [{ k: 'cone', dmg: 12, el: 'fire', range: 4.5, arc: 60, n: 4, every: 0.1, st: 'burn', stp: 8 }],
        ups: [{ t: 'count', v: 2 }, { t: 'area', v: 0.25 }, { t: 'dmg', v: 0.3 }, { t: 'status', v: 6, st: 'burn' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'fizz_vent', name: loc('Сброс давления', 'Vent'), desc: loc('Сбрасывает 40 Нестабильности взрывом вокруг себя.', 'Releases 40 Volatility as a blast around him.'),
        icon: 'nova', color: 0xd0ff80, cd: 10, cost: -40,
        acts: [{ k: 'nova', dmg: 30, el: 'poison', r: 3.5, st: 'weaken', stp: 3, knock: 3 }],
        ups: [{ t: 'dmg', v: 0.4 }, { t: 'special', v: 1, sp: 'barrier' }, { t: 'area', v: 0.25 }, { t: 'cd', v: 0.25 }, { t: 'special', v: 1, sp: 'leech' }],
      },
    ],
    ult: {
      id: 'fizz_ult', name: loc('Цепная реакция', 'Chain Reaction'), desc: loc('Пять склянок по кругу: каждая взрывается и разносит яд.', 'Five flasks around: each blows up and spreads poison.'),
      icon: 'cskull', color: 0xb0ff60, cd: 45, cost: 30,
      acts: [{ k: 'ground', dmg: 70, el: 'poison', r: 2.8, range: 10, delay: 0.5, n: 5, every: 0.15, spread: 4, st: 'poison', stp: 18, vis: 'bomb' }],
      ups: [{ t: 'count', v: 3 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Vex: lightning control
  {
    hero: 'vex',
    role: loc('Повелитель молний', 'Stormcaller'),
    res: RES.charge,
    traits: loc('Цепные молнии и оглушения, отличен против толп. Слабее против одиночных целей.', 'Chain lightning and stuns; great against crowds. Weaker on single targets.'),
    mechanic: { id: 'static', name: loc('Статика', 'Static'), desc: loc('Удары молнией с шансом 20% оглушают. Молния по замороженным — Раскол (×2).', 'Lightning hits have a 20% stun chance. Lightning on frozen foes shatters (×2).') },
    basic: { name: loc('Разряд', 'Zap'), interval: 0.5, act: { k: 'chain', dmg: 9, el: 'lightning', n: 2, range: 11 } },
    skills: [
      {
        id: 'vex_ball', name: loc('Шаровая молния', 'Ball Lightning'), desc: loc('Медленный шар бьёт током всех вокруг себя.', 'A slow orb that zaps everything around it.'),
        icon: 'lightning', color: 0x8ae0ff, cd: 6, cost: 30,
        acts: [{ k: 'proj', dmg: 9, el: 'lightning', speed: 6, range: 11, vis: 'wisp', color: 0x8ae0ff, pierce: -1, r: 1.4 }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'area', v: 0.3 }, { t: 'count', v: 1 }, { t: 'special', v: 1, sp: 'shock' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'vex_nova', name: loc('Громовой круг', 'Thunder Ring'), desc: loc('Разряд вокруг героя оглушает врагов.', 'A discharge around the hero stuns foes.'),
        icon: 'nova', color: 0x4ad0ff, cd: 8, cost: 30,
        acts: [{ k: 'nova', dmg: 24, el: 'lightning', r: 3.6, st: 'stun', stp: 1 }],
        ups: [{ t: 'area', v: 0.25 }, { t: 'dmg', v: 0.35 }, { t: 'status', v: 0.5, st: 'stun' }, { t: 'special', v: 1, sp: 'echo' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'vex_storm', name: loc('Гроза', 'Tempest'), desc: loc('Туча у курсора 4 сек. бьёт молниями.', 'A storm cloud at the cursor strikes for 4s.'),
        icon: 'tornado', color: 0x9ab0ff, cd: 12, cost: 40,
        acts: [{ k: 'ground', dmg: 16, el: 'lightning', r: 3.2, range: 13, delay: 0.3, dur: 4, every: 0.4, vis: 'cloud' }],
        ups: [{ t: 'dur', v: 0.35 }, { t: 'dmg', v: 0.35 }, { t: 'area', v: 0.25 }, { t: 'status', v: 0.6, st: 'slow' }, { t: 'cd', v: 0.25 }],
      },
    ],
    ult: {
      id: 'vex_ult', name: loc('Суд небес', 'Skyfall'), desc: loc('Молнии бьют по 12 врагам с оглушением.', 'Lightning strikes 12 foes, stunning them.'),
      icon: 'lightning', color: 0xc0f0ff, cd: 45, cost: 60,
      acts: [{ k: 'chain', dmg: 60, el: 'lightning', n: 12, range: 16, st: 'stun', stp: 1.5 }],
      ups: [{ t: 'count', v: 6 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Tink: engineer
  {
    hero: 'tink',
    role: loc('Инженер', 'Engineer'),
    res: RES.steam,
    traits: loc('Турели и мины контролируют поле боя. Сам стреляет слабо.', 'Turrets and mines control the field. Weak personal damage.'),
    mechanic: { id: 'overclock', name: loc('Разгон', 'Overclock'), desc: loc('Пока турель активна, обычные атаки на 30% быстрее.', 'While a turret is active, basic attacks are 30% faster.') },
    basic: { name: loc('Гвоздомёт', 'Nailgun'), interval: 0.26, act: { k: 'proj', dmg: 5, el: 'phys', speed: 24, range: 12, vis: 'dagger', color: 0xd0d0d8 } },
    skills: [
      {
        id: 'tink_turret', name: loc('Турель', 'Turret'), desc: loc('Ставит турель у курсора на 12 сек.', 'Places a turret at the cursor for 12s.'),
        icon: 'crossbow', color: 0xd6923a, cd: 10, cost: 40,
        acts: [{ k: 'turret', dmg: 9, el: 'phys', range: 6, dur: 12, every: 0.45, vis: 'dagger', color: 0xffd080 }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'dur', v: 0.3 }, { t: 'special', v: 1, sp: 'shock' }, { t: 'cd', v: 0.25 }, { t: 'dmg', v: 0.4 }],
      },
      {
        id: 'tink_mines', name: loc('Минное поле', 'Minefield'), desc: loc('Три мины у курсора взрываются с огнём.', 'Three mines at the cursor explode in fire.'),
        icon: 'mine', color: 0xff5470, cd: 8, cost: 30,
        acts: [{ k: 'ground', dmg: 30, el: 'fire', r: 2, range: 11, delay: 1, n: 3, every: 0.25, spread: 2.5, st: 'burn', stp: 8, vis: 'mine' }],
        ups: [{ t: 'count', v: 2 }, { t: 'dmg', v: 0.35 }, { t: 'area', v: 0.25 }, { t: 'status', v: 1, st: 'stun' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'tink_rocket', name: loc('Ракетный ранец', 'Rocket Pack'), desc: loc('Реактивный рывок, взрыв при приземлении.', 'A rocket dash with a blast on landing.'),
        icon: 'bomb', color: 0xffa050, cd: 7, cost: 25,
        acts: [{ k: 'blink', range: 7 }, { k: 'nova', dmg: 24, el: 'fire', r: 2.6, knock: 3, st: 'burn', stp: 6 }],
        ups: [{ t: 'cd', v: 0.2 }, { t: 'dmg', v: 0.4 }, { t: 'special', v: 1, sp: 'trail' }, { t: 'area', v: 0.25 }, { t: 'special', v: 1, sp: 'barrier' }],
      },
    ],
    ult: {
      id: 'tink_ult', name: loc('Осадная батарея', 'Siege Battery'), desc: loc('Три мощные турели вокруг курсора на 15 сек.', 'Three heavy turrets around the cursor for 15s.'),
      icon: 'banner', color: 0xffc060, cd: 55, cost: 60,
      acts: [{ k: 'turret', dmg: 16, el: 'fire', range: 7, dur: 15, every: 0.35, n: 3, spread: 2.5, vis: 'fireball', color: 0xff8a2a }],
      ups: [{ t: 'count', v: 2 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
  // ---------------------------------------------------------------- Aurelia: holy bruiser / support
  {
    hero: 'aurelia',
    role: loc('Паладин', 'Paladin'),
    res: RES.faith,
    traits: loc('Сама себя лечит и защищает, магический урон по площади. Средняя скорость и дальность.', 'Heals and shields herself, magic area damage. Average speed and reach.'),
    mechanic: { id: 'grace', name: loc('Благодать', 'Grace'), desc: loc('Каждый навык лечит на 3% здоровья.', 'Every skill heals 3% HP.') },
    basic: { name: loc('Священный молот', 'Holy Hammer'), interval: 0.62, act: { k: 'cone', dmg: 12, el: 'magic', range: 2.6, arc: 120, knock: 1 } },
    skills: [
      {
        id: 'aur_smite', name: loc('Кара', 'Smite'), desc: loc('Луч света бьёт у курсора и ослабляет врагов.', 'A pillar of light strikes the cursor and weakens foes.'),
        icon: 'sun', color: 0xffe08a, cd: 5, cost: 25,
        acts: [{ k: 'ground', dmg: 34, el: 'magic', r: 2.2, range: 12, delay: 0.35, st: 'weaken', stp: 4 }],
        ups: [{ t: 'dmg', v: 0.35 }, { t: 'area', v: 0.25 }, { t: 'special', v: 1, sp: 'echo' }, { t: 'status', v: 1, st: 'stun' }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'aur_shield', name: loc('Щит рассвета', 'Dawn Shield'), desc: loc('Неуязвимость 1.5 сек. и лечение.', 'Invulnerable for 1.5s and healed.'),
        icon: 'halo', color: 0xfff0c0, cd: 14, cost: 35,
        acts: [{ k: 'buff', dur: 1.5, buff: { armor: 999 } }, { k: 'heal', heal: 0.15 }],
        ups: [{ t: 'dur', v: 0.35 }, { t: 'cd', v: 0.15 }, { t: 'special', v: 1, sp: 'leech' }, { t: 'dur', v: 0.35 }, { t: 'cd', v: 0.2 }],
      },
      {
        id: 'aur_consecrate', name: loc('Освящение', 'Consecrate'), desc: loc('Освящённая земля вокруг жжёт врагов 5 сек.', 'Holy ground around her burns foes for 5s.'),
        icon: 'rune', color: 0xffd060, cd: 11, cost: 35,
        acts: [{ k: 'ground', dmg: 10, el: 'magic', r: 3.6, range: 0, delay: 0.1, dur: 5, every: 0.5, st: 'slow', stp: 0.6 }],
        ups: [{ t: 'area', v: 0.25 }, { t: 'dmg', v: 0.4 }, { t: 'dur', v: 0.3 }, { t: 'special', v: 1, sp: 'leech' }, { t: 'cd', v: 0.2 }],
      },
    ],
    ult: {
      id: 'aur_ult', name: loc('Восход', 'Daybreak'), desc: loc('Вспышка света: урон и оглушение по большой площади, полное лечение.', 'A burst of light: damage and stun over a wide area and a full heal.'),
      icon: 'star', color: 0xfff6c0, cd: 60, cost: 60,
      acts: [{ k: 'nova', dmg: 90, el: 'magic', r: 6, st: 'stun', stp: 2 }, { k: 'heal', heal: 1 }],
      ups: [{ t: 'area', v: 0.25 }, { t: 'dmg', v: 0.5 }, { t: 'cd', v: 0.3 }],
    },
  },
];

export const KIT_BY_HERO: Record<string, ClassKit> = Object.fromEntries(KITS.map((k) => [k.hero, k]));

export function kitFor(heroId: string): ClassKit {
  return KIT_BY_HERO[heroId] ?? KITS[0];
}

// --------------------------------------------------------------------------------- build choices
/** Stat upgrades offered on level up. */
export const STAT_UPS: { id: string; name: Loc; stat: 'might' | 'maxHp' | 'armor' | 'moveSpeed' | 'critChance' | 'critDamage' | 'cooldown' | 'regen' | 'area' | 'lifesteal'; v: number; icon: string }[] = [
  { id: 'su_might', name: loc('+8% урона', '+8% damage'), stat: 'might', v: 0.08, icon: 'sword' },
  { id: 'su_hp', name: loc('+12% здоровья', '+12% max HP'), stat: 'maxHp', v: 0.12, icon: 'heart' },
  { id: 'su_armor', name: loc('+2 брони', '+2 armor'), stat: 'armor', v: 2, icon: 'plate' },
  { id: 'su_speed', name: loc('+6% скорости', '+6% move speed'), stat: 'moveSpeed', v: 0.06, icon: 'boots' },
  { id: 'su_crit', name: loc('+5% шанса крита', '+5% crit chance'), stat: 'critChance', v: 0.05, icon: 'target' },
  { id: 'su_critd', name: loc('+20% крит. урона', '+20% crit damage'), stat: 'critDamage', v: 0.2, icon: 'fang' },
  { id: 'su_cd', name: loc('−6% перезарядки', '−6% cooldowns'), stat: 'cooldown', v: 0.06, icon: 'hourglass' },
  { id: 'su_regen', name: loc('+1 HP/сек', '+1 HP/s'), stat: 'regen', v: 1, icon: 'moss' },
  { id: 'su_area', name: loc('+8% площади', '+8% area'), stat: 'area', v: 0.08, icon: 'nova' },
  { id: 'su_leech', name: loc('+1 HP за убийство', '+1 HP per kill'), stat: 'lifesteal', v: 1, icon: 'fang' },
];

/** Build-defining modifiers (one level each). */
export interface ModDef {
  id: string;
  name: Loc;
  desc: Loc;
  icon: string;
  color: number;
  /** Build family for synergy hints. */
  tag: 'fire' | 'ice' | 'control' | 'crit' | 'poison' | 'tank' | 'speed' | 'dark' | 'lightning';
}

export const MODS: ModDef[] = [
  { id: 'm_pyro', name: loc('Пироман', 'Pyromaniac'), desc: loc('Все навыки поджигают врагов. +15% огненного урона.', 'All skills set foes on fire. +15% fire damage.'), icon: 'fireball', color: 0xff6a1a, tag: 'fire' },
  { id: 'm_inferno', name: loc('Пекло', 'Inferno'), desc: loc('Горящие враги получают +25% урона от всего.', 'Burning foes take +25% damage from everything.'), icon: 'phoenix', color: 0xff8a2a, tag: 'fire' },
  { id: 'm_frost', name: loc('Ледяное сердце', 'Frozen Heart'), desc: loc('Навыки замедляют; 15% шанс заморозить.', 'Skills slow; 15% chance to freeze.'), icon: 'shard', color: 0x8ae8ff, tag: 'ice' },
  { id: 'm_shatter', name: loc('Хрупкость', 'Brittle'), desc: loc('Замороженные и оглушённые враги получают +35% урона.', 'Frozen and stunned foes take +35% damage.'), icon: 'crystal', color: 0xbfe8ff, tag: 'control' },
  { id: 'm_jailer', name: loc('Тюремщик', 'Jailer'), desc: loc('Оглушения и заморозки длятся на 40% дольше.', 'Stuns and freezes last 40% longer.'), icon: 'chain', color: 0xc0c0d0, tag: 'control' },
  { id: 'm_assassin', name: loc('Убийца', 'Assassin'), desc: loc('+12% шанса крита, криты вызывают кровотечение.', '+12% crit chance; crits cause bleeding.'), icon: 'dagger', color: 0xff5060, tag: 'crit' },
  { id: 'm_executioner', name: loc('Палач', 'Executioner'), desc: loc('+60% урона по врагам ниже 30% здоровья.', '+60% damage to foes below 30% HP.'), icon: 'skull', color: 0xd03040, tag: 'crit' },
  { id: 'm_plague', name: loc('Чумной', 'Plaguebearer'), desc: loc('Все удары отравляют. Яд сильнее на 30%.', 'All hits poison. Poison is 30% stronger.'), icon: 'flask', color: 0x9cff4f, tag: 'poison' },
  { id: 'm_juggernaut', name: loc('Джаггернаут', 'Juggernaut'), desc: loc('+25% здоровья, +3 брони, −8% скорости.', '+25% HP, +3 armor, −8% speed.'), icon: 'plate', color: 0x9aa8c0, tag: 'tank' },
  { id: 'm_vampire', name: loc('Вампиризм', 'Vampirism'), desc: loc('Навыки лечат на 4% нанесённого урона.', 'Skills heal 4% of damage dealt.'), icon: 'fang', color: 0xd04060, tag: 'tank' },
  { id: 'm_swift', name: loc('Ураган', 'Tailwind'), desc: loc('+15% скорости атаки, уклонение перезаряжается на 30% быстрее.', '+15% attack speed; dodge recharges 30% faster.'), icon: 'feather', color: 0xc0f0ff, tag: 'speed' },
  { id: 'm_conduit', name: loc('Проводник', 'Conduit'), desc: loc('Удары с шансом 15% бьют цепной молнией.', 'Hits have a 15% chance to chain lightning.'), icon: 'lightning', color: 0x4ad0ff, tag: 'lightning' },
  { id: 'm_hexer', name: loc('Проклинатель', 'Hexer'), desc: loc('Навыки проклинают врагов (+20% урона по ним).', 'Skills curse foes (+20% damage taken).'), icon: 'eye', color: 0x8c5ad6, tag: 'dark' },
  { id: 'm_arcane', name: loc('Тайный поток', 'Arcane Flow'), desc: loc('Каждый навык восстанавливает 8 ресурса и −10% перезарядки.', 'Each skill restores 8 resource; −10% cooldowns.'), icon: 'rune', color: 0x9a6aff, tag: 'speed' },
];

export const MOD_BY_ID: Record<string, ModDef> = Object.fromEntries(MODS.map((m) => [m.id, m]));

export const MAX_LEVEL = 22;
export const ULT_LEVEL = 6;
export const ULT_UP_LEVELS = [12, 18, 22];
export const SKILL_MAX = 6;
