import { buff, circle, cone, fx, hit, L, move, proj, rect, sides, skill, step, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0xd8402a;
const FURY = 0xff5a2a;

/** Berserker — heavy two-handed greatsword, fury builds into Bloodlust. Slow, crushing, armored swings. */
export const BERSERKER: ClassDef = {
  id: 'berserker',
  name: L('Берсерк', 'Berserker'),
  title: L('Ярость Кровавого Клинка', 'Fury of the Blood Blade'),
  desc: L(
    'Воин с огромным двуручным мечом. Медленные, но сокрушительные удары с бронёй от прерывания. Копит ярость и впадает в Кровавое безумие: быстрее, сильнее, красное свечение.',
    'A warrior with a huge two-handed sword. Slow but crushing armored swings. Builds fury and enters Bloodlust: faster, stronger, glowing red.',
  ),
  role: L('Ближний бой · урон и оглушение', 'Melee · damage and stagger'),
  difficulty: 1,
  weapon: L('Двуручный меч', 'Greatsword'),
  ratings: { attack: 5, defense: 3, mobility: 2, control: 3, support: 1, range: 1 },
  passive: {
    name: L('Тяжёлая рука', 'Heavy Hand'),
    desc: L('Сильные удары не прерываются (сверхброня). Ярость копится от ударов и полученного урона.', 'Strong swings cannot be interrupted (super armor). Fury builds from hits and damage taken.'),
  },
  baseHp: 170,
  baseSpeed: 4.2,
  armor: 4,
  power: 11,
  color: C,
  res: {
    id: 'fury', name: L('Ярость', 'Fury'), desc: L('Копится в бою, убывает вне боя. Полная шкала — Кровавое безумие (Z).', 'Builds in combat, drains out of it. Full bar — Bloodlust (Z).'),
    color: '#ff4a2a', max: 100, regen: -3, onBasic: 4, onSkill: 3, onKill: 2, onHurt: 0.25,
  },
  basic: {
    name: L('Рубка', 'Hack'), desc: L('Цепочка из трёх рубящих ударов; третий — тяжёлый удар сверху.', 'A three-hit chain; the third is an overhead crash.'),
    icon: 'berserker_basic', el: 'phys', ranged: false, window: 0.5,
    steps: [
      step('bz_basic1', 0.62, [hit(0.3, cone(3, 150), 1.2, { stag: 6, fx: 'slash_wide', knock: 0.6, sfx: 'whoosh' })], { cancel: 0.42, move: 0.2, track: true }),
      step('bz_basic2', 0.62, [hit(0.3, cone(3, 150), 1.2, { stag: 6, fx: 'slash_wide', knock: 0.6, sfx: 'whoosh' })], { cancel: 0.42, move: 0.2, track: true }),
      step('bz_basic3', 0.9, [hit(0.45, rect(3.6, 2.2), 2.2, { stag: 14, fx: 'smash', knock: 1.4, shake: 0.12, sfx: 'smash' })], { cancel: 0.62, move: 0, armor: 'push' }),
    ],
  },
  dodge: { name: L('Рывок плечом', 'Shoulder Roll'), cd: 7, charges: 1, step: step('bz_dodge', 0.55, [move(0, 'dash', 4.2, 0.32, { iframe: true })], { iframes: [0, 0.36] }) },
  skills: [
    skill({
      id: 'bz_q', name: L('Рассекающий взмах', 'Cleaving Sweep'), desc: L('Два мощных взмаха: широкая дуга перед собой и разворот по кругу.', 'Two heavy swings: a wide arc ahead, then a full spin.'),
      icon: 'berserker_q', color: C, cd: 5, type: 'combo', window: 0.8, tags: ['melee', 'combo', 'aoe'], el: 'phys', range: 3.4, radius: 3.4, unlock: 1,
      steps: [
        step('bz_q1', 0.55, [hit(0.28, cone(3.4, 170), 2.6, { stag: 12, fx: 'slash_wide', knock: 1, sfx: 'whoosh' })], { cancel: 0.4, track: true, armor: 'push' }),
        step('bz_q2', 0.75, [hit(0.36, circle(3.4), 3.6, { stag: 18, fx: 'spin', knock: 1.6, shake: 0.1, sfx: 'whoosh' })], { cancel: 0.55, armor: 'push' }),
      ],
    }),
    skill({
      id: 'bz_w', name: L('Прыжок разрушителя', 'Leap Crash'), desc: L('Прыжок к курсору и удар мечом о землю — оглушает и подбрасывает врагов.', 'Leaps to the cursor and crashes down, stunning and launching foes.'),
      icon: 'berserker_w', color: C, cd: 9, type: 'normal', tags: ['mobility', 'aoe', 'control'], el: 'phys', range: 7, radius: 3.2, unlock: 1,
      steps: [step('bz_w', 1.0, [move(0.1, 'leap', 7, 0.45), hit(0.55, circle(3.2), 5, { stag: 30, st: 'stun', stp: 1, launch: true, fx: 'smash', shake: 0.35, sfx: 'smash', knock: 1.5 })], { cancel: 0.8, armor: 'super' })],
    }),
    skill({
      id: 'bz_e', name: L('Вихрь клинка', 'Blade Whirl'), desc: L('Удерживайте: герой вращается с мечом, двигаясь медленно и разрубая всё вокруг.', 'Hold: spin with the sword, moving slowly and cutting everything around.'),
      icon: 'berserker_e', color: C, cd: 12, type: 'hold', holdMax: 2.4, tags: ['melee', 'aoe', 'holding'], el: 'phys', range: 2.8, radius: 2.8, unlock: 1,
      steps: [
        step('bz_e_in', 0.2, [], { armor: 'push' }),
        step('bz_e_loop', 0.3, [hit(0.1, circle(2.8), 1.3, { stag: 5, fx: 'spin', knock: 0.4, sfx: 'whoosh' })], { move: 0.45, armor: 'push' }),
        step('bz_e_out', 0.5, [hit(0.2, circle(3.2), 3, { stag: 14, fx: 'spin', knock: 1.5, shake: 0.12 })], { cancel: 0.35, armor: 'push' }),
      ],
    }),
    skill({
      id: 'bz_r', name: L('Сокрушитель черепов', 'Skull Crusher'), desc: L('Удерживайте, чтобы зарядить, и отпустите: сокрушительный удар сверху вниз. Полный заряд — тройной урон и огромное оглушение.', 'Hold to charge, release for an overhead blow. Full charge triples damage and stagger.'),
      icon: 'berserker_r', color: C, cd: 11, type: 'charge', chargeMax: 1.2, chargeMul: 2.6, tags: ['melee', 'charge', 'burst', 'head'], el: 'phys', range: 4, radius: 1.6, unlock: 2,
      note: L('Против оглушённых — +30% урона.', '+30% damage vs. staggered foes.'),
      steps: [step('bz_r', 0.8, [hit(0.32, rect(4, 2), 6.5, { stag: 40, fx: 'smash', shake: 0.3, knock: 2, sfx: 'smash' })], { cancel: 0.6, armor: 'super' })],
    }),
    skill({
      id: 'bz_a', name: L('Таран', 'Shoulder Charge'), desc: L('Рывок вперёд плечом, сбивающий врагов с ног.', 'Charges forward with the shoulder, knocking foes down.'),
      icon: 'berserker_a', color: C, cd: 7, type: 'normal', tags: ['mobility', 'control'], el: 'phys', range: 6, radius: 1.4, unlock: 3,
      steps: [step('bz_a', 0.55, [move(0.05, 'dash', 6, 0.3, { hit: { r: 1.4, dmg: 2.5, stag: 20, knock: 2.4, st: 'stun', stp: 0.6, fx: 'smash' } })], { cancel: 0.42, armor: 'push' })],
    }),
    skill({
      id: 'bz_s', name: L('Боевой клич', 'War Cry'), desc: L('Рёв ужаса: ослабляет врагов вокруг и даёт +25% урона и ярость на 8 сек.', 'A terrifying roar: weakens foes around you and grants +25% damage and fury for 8s.'),
      icon: 'berserker_s', color: FURY, cd: 18, type: 'normal', cost: -30, tags: ['buff', 'control'], el: 'phys', range: 5, radius: 5, unlock: 4,
      steps: [step('bz_s', 0.7, [hit(0.3, circle(5), 0.4, { stag: 10, st: 'weaken', stp: 5, fx: 'shock', sfx: 'roar' }), buff(0.3, 8, { dmg: 0.25, color: FURY }), fx(0.3, 'ring', { color: FURY, r: 5 })], { cancel: 0.5 })],
    }),
    skill({
      id: 'bz_d', name: L('Разлом земли', 'Earth Rend'), desc: L('Три удара: два косых и вонзание меча с разломом по линии.', 'Three strikes: two diagonal slashes and a sword plunge that rends the ground in a line.'),
      icon: 'berserker_d', color: 0xb08a5a, cd: 10, type: 'combo', window: 0.9, tags: ['melee', 'combo', 'directional'], el: 'phys', range: 7, radius: 1.6, unlock: 5,
      steps: [
        step('bz_d1', 0.45, [hit(0.22, cone(3, 120), 2, { stag: 8, fx: 'slash' })], { cancel: 0.32, track: true }),
        step('bz_d2', 0.45, [hit(0.22, cone(3, 120), 2, { stag: 8, fx: 'slash' })], { cancel: 0.32, track: true }),
        step('bz_d3', 0.85, [hit(0.42, rect(7, 1.8), 5.5, { stag: 28, fx: 'smash', shake: 0.25, launch: true, sfx: 'smash' })], { cancel: 0.65, armor: 'super' }),
      ],
    }),
    skill({
      id: 'bz_f', name: L('Кровавый полумесяц', 'Blood Crescent'), desc: L('Взмах, выпускающий кровавую волну, которая пронзает всех на пути и вызывает кровотечение.', 'A swing that releases a blood wave, piercing everything and causing bleeding.'),
      icon: 'berserker_f', color: 0xff3040, cd: 8, type: 'normal', cost: 15, tags: ['ranged', 'directional'], el: 'phys', range: 10, radius: 1.2, unlock: 6,
      steps: [step('bz_f', 0.6, [proj(0.28, { dmg: 3.4, stag: 12, speed: 20, range: 10, r: 1.2, pierce: -1, vis: 'crescent', color: 0xff3040, st: 'bleed', stp: 4 })], { cancel: 0.42, track: true })],
    }),
  ],
  ult: skill({
    id: 'bz_ult', name: L('Кровавый Судный День', 'Red Doom'), desc: L('Пробуждение: взлёт к курсору, два огненных удара по сторонам и падение с колоссальным разломом.', 'Awakening: leap to the cursor, two blazing side cuts and a colossal ground-splitting fall.'),
    icon: 'berserker_ult', color: 0xff2a1a, cd: 90, type: 'normal', tags: ['burst', 'aoe'], el: 'fire', range: 8, radius: 5.5, unlock: 8,
    steps: [step('bz_ult', 2.0, [
      move(0.1, 'leap', 8, 0.5, { iframe: true }),
      hit(0.75, sides(4.5, 2.4), 6, { stag: 30, fx: 'fire', el: 'fire', shake: 0.25, sfx: 'smash' }),
      hit(1.1, circle(3.6), 6, { stag: 30, fx: 'spin', el: 'fire', shake: 0.25 }),
      hit(1.45, circle(5.5), 16, { stag: 120, fx: 'smash', el: 'fire', launch: true, shake: 0.7, st: 'burn', stp: 8, sfx: 'meteor' }),
      zone(1.45, { at: 'self', r: 5, dur: 3, every: 0.5, dmg: 0.8, el: 'fire', vis: 'fire', color: 0xff5a1a }),
    ], { iframes: [0, 1.6], armor: 'super', cancel: 1.75 })],
  }),
  identity: {
    kind: 'bloodlust', name: L('Кровавое безумие', 'Bloodlust'), desc: L('При полной ярости: 15 сек. +25% урона, +20% скорости атаки и бега, сверхброня. Тело светится красным.', 'At full fury: 15s of +25% damage, +20% attack and move speed, super armor. The body glows red.'),
    icon: 'berserker_id', need: 100, dur: 15, color: FURY,
    step: step('bz_identity', 0.6, [fx(0.25, 'burst', { color: FURY, r: 3, shake: 0.3 }), hit(0.25, circle(3), 1, { stag: 10, knock: 2, fx: 'shock' })], { iframes: [0, 0.6] }),
  },
};
