import { buff, circle, cone, fx, hit, L, move, proj, rect, skill, step } from '../dsl';
import type { ClassDef } from '../types';

const C = 0x4ad0ff;
const SPIRIT = 0x8ae8ff;

/** Steel Fist — gauntlets, fast chains, dashes and jumps; spirit orbs fuel finishers. */
export const STEELFIST: ClassDef = {
  id: 'steelfist',
  name: L('Стальной кулак', 'Steel Fist'),
  title: L('Буря Кастетов', 'Gauntlet Tempest'),
  desc: L(
    'Боец в стальных перчатках. Очень быстрые серии ударов, рывки, прыжки и подбросы. Удары копят сферы духа, которые тратятся на добивающие приёмы.',
    'A fighter in steel gauntlets. Very fast strike chains, dashes, jumps and launches. Blows build spirit orbs that power finishers.',
  ),
  role: L('Ближний бой · скорость и комбо', 'Melee · speed and combos'),
  difficulty: 2,
  weapon: L('Стальные перчатки', 'Steel gauntlets'),
  ratings: { attack: 4, defense: 2, mobility: 5, control: 3, support: 1, range: 1 },
  passive: {
    name: L('Поток ударов', 'Flow of Blows'),
    desc: L('Каждое попадание навыком в течение 2 сек. ускоряет атаки на 3% (до 30%).', 'Every skill hit within 2s speeds attacks by 3% (up to 30%).'),
  },
  baseHp: 130,
  baseSpeed: 4.9,
  armor: 2,
  power: 8.5,
  color: C,
  res: {
    id: 'orbs', name: L('Сферы духа', 'Spirit Orbs'), desc: L('3 сферы. Копятся ударами; добивающие приёмы тратят сферу. Полные — Пробуждение духа (Z).', '3 orbs. Built by blows; finishers spend an orb. All full — Spirit Awakening (Z).'),
    color: '#6ad8ff', max: 99, orbs: 3, regen: 0, onBasic: 3, onSkill: 2.5, onKill: 1, onHurt: 0,
  },
  basic: {
    name: L('Серия кулаков', 'Fist Flurry'), desc: L('Четыре быстрых удара: джеб, хук, локоть и пинок.', 'Four quick blows: jab, hook, elbow and kick.'),
    icon: 'steelfist_basic', el: 'phys', ranged: false, window: 0.35,
    steps: [
      step('sf_basic1', 0.26, [hit(0.1, cone(2.3, 90), 0.75, { stag: 3, fx: 'punch' })], { cancel: 0.16, move: 0.35, track: true }),
      step('sf_basic2', 0.26, [hit(0.1, cone(2.3, 90), 0.75, { stag: 3, fx: 'punch' })], { cancel: 0.16, move: 0.35, track: true }),
      step('sf_basic3', 0.3, [hit(0.12, cone(2.4, 110), 0.9, { stag: 4, fx: 'punch' })], { cancel: 0.2, move: 0.35, track: true }),
      step('sf_basic4', 0.42, [hit(0.2, cone(2.8, 140), 1.5, { stag: 8, fx: 'slash', knock: 1.4 })], { cancel: 0.3, move: 0.2, track: true }),
    ],
  },
  dodge: { name: L('Скользящий шаг', 'Slip Step'), cd: 4, charges: 2, step: step('sf_dodge', 0.4, [move(0, 'dash', 4.6, 0.22, { iframe: true })], { iframes: [0, 0.28] }) },
  skills: [
    skill({
      id: 'sf_q', name: L('Драконий апперкот', 'Dragon Uppercut'), desc: L('Три удара: двойка в корпус и апперкот, подбрасывающий врагов.', 'Three blows: a body one-two and an uppercut that launches foes.'),
      icon: 'steelfist_q', color: C, cd: 4, type: 'combo', window: 0.6, tags: ['melee', 'combo', 'control'], el: 'phys', range: 2.6, radius: 2.6, unlock: 1,
      steps: [
        step('sf_q1', 0.25, [hit(0.1, cone(2.5, 100), 1.6, { stag: 6, fx: 'punch' })], { cancel: 0.14, track: true }),
        step('sf_q2', 0.25, [hit(0.1, cone(2.5, 100), 1.6, { stag: 6, fx: 'punch' })], { cancel: 0.14, track: true }),
        step('sf_q3', 0.45, [move(0.05, 'dash', 1.2, 0.12), hit(0.18, cone(2.6, 120), 2.8, { stag: 16, launch: true, fx: 'punch', shake: 0.08 })], { cancel: 0.3, track: true }),
      ],
    }),
    skill({
      id: 'sf_w', name: L('Рывок дракона', 'Dragon Dash'), desc: L('Стремительный рывок сквозь врагов с ударом кулаком.', 'A lightning dash through foes with a punch.'),
      icon: 'steelfist_w', color: C, cd: 6, type: 'normal', tags: ['mobility'], el: 'phys', range: 6, radius: 1.3, unlock: 1,
      steps: [step('sf_w', 0.4, [move(0.03, 'dash', 6, 0.2, { hit: { r: 1.3, dmg: 2.6, stag: 12, fx: 'punch', knock: 0.8 }, iframe: true })], { cancel: 0.26 })],
    }),
    skill({
      id: 'sf_e', name: L('Взлетающее колено', 'Rising Knee'), desc: L('Прыжок к цели с ударом коленом, подбрасывающий врагов.', 'Leap at the target with a knee strike that launches foes.'),
      icon: 'steelfist_e', color: C, cd: 7, type: 'normal', tags: ['mobility', 'control'], el: 'phys', range: 5, radius: 2, unlock: 1,
      steps: [step('sf_e', 0.55, [move(0.05, 'leap', 5, 0.28), hit(0.33, circle(2), 3, { stag: 18, launch: true, fx: 'punch', shake: 0.1 })], { cancel: 0.4, armor: 'push' })],
    }),
    skill({
      id: 'sf_r', name: L('Сокрушающий кулак', 'Crushing Fist'), desc: L('Удерживайте для заряда и отпустите: удар, пробивающий линию врагов. Тратит сферу.', 'Hold to charge and release: a blow that pierces a line of foes. Spends an orb.'),
      icon: 'steelfist_r', color: SPIRIT, cd: 8, type: 'charge', chargeMax: 1, chargeMul: 2.2, cost: 33, tags: ['melee', 'charge', 'burst', 'directional'], el: 'phys', range: 5, radius: 1.6, unlock: 2,
      steps: [step('sf_r', 0.55, [hit(0.2, rect(5, 1.8), 6.5, { stag: 34, fx: 'shock', knock: 2.4, shake: 0.25, sfx: 'smash' })], { cancel: 0.38, armor: 'super' })],
    }),
    skill({
      id: 'sf_a', name: L('Сто кулаков', 'Hundred Fists'), desc: L('Удерживайте: град ударов перед собой.', 'Hold: a hail of punches ahead.'),
      icon: 'steelfist_a', color: C, cd: 9, type: 'hold', holdMax: 1.8, tags: ['melee', 'holding'], el: 'phys', range: 2.8, radius: 2.8, unlock: 3,
      steps: [
        step('sf_a_in', 0.1, []),
        step('sf_a_loop', 0.12, [hit(0.04, cone(2.8, 90), 0.75, { stag: 3, fx: 'punch' })], { track: true, armor: 'push' }),
        step('sf_a_out', 0.4, [hit(0.16, cone(3, 120), 2.5, { stag: 14, fx: 'shock', knock: 2 })], { cancel: 0.26 }),
      ],
    }),
    skill({
      id: 'sf_s', name: L('Ураганный пинок', 'Hurricane Kick'), desc: L('Вращающийся пинок по кругу и сальто назад.', 'A spinning kick all around, then a backflip.'),
      icon: 'steelfist_s', color: C, cd: 8, type: 'normal', tags: ['aoe', 'mobility'], el: 'phys', range: 3, radius: 3, unlock: 4,
      steps: [step('sf_s', 0.65, [hit(0.15, circle(3), 2.2, { stag: 12, fx: 'spin', n: 2, every: 0.12, knock: 1 }), move(0.42, 'back', 3.2, 0.18, { iframe: true })], { cancel: 0.5 })],
    }),
    skill({
      id: 'sf_d', name: L('Шоковая ладонь', 'Shock Palm'), desc: L('Удар ладонью выпускает сферу духа, взрывающуюся при попадании. Тратит сферу.', 'A palm strike releases a spirit orb that bursts on impact. Spends an orb.'),
      icon: 'steelfist_d', color: SPIRIT, cd: 6, type: 'normal', cost: 33, tags: ['ranged'], el: 'lightning', range: 9, radius: 2.4, unlock: 5,
      steps: [step('sf_d', 0.45, [proj(0.16, { dmg: 4.4, stag: 22, el: 'lightning', speed: 22, range: 9, r: 0.6, explode: 2.4, vis: 'palm', color: SPIRIT, st: 'stun', stp: 0.5 })], { cancel: 0.3, track: true })],
    }),
    skill({
      id: 'sf_f', name: L('Метеорный удар', 'Meteor Drop'), desc: L('Высокий прыжок и падение кулаком в землю с волной.', 'A high jump and a fist-first fall with a shockwave.'),
      icon: 'steelfist_f', color: SPIRIT, cd: 12, type: 'normal', tags: ['mobility', 'aoe', 'burst'], el: 'phys', range: 7, radius: 3.4, unlock: 6,
      steps: [step('sf_f', 0.85, [move(0.08, 'leap', 7, 0.45, { iframe: true }), hit(0.55, circle(3.4), 5.4, { stag: 34, fx: 'shock', launch: true, shake: 0.35, sfx: 'smash' })], { cancel: 0.68, armor: 'super' })],
    }),
  ],
  ult: skill({
    id: 'sf_ult', name: L('Тысяча шагов дракона', 'Thousand Dragon Steps'), desc: L('Пробуждение: пять мгновенных ударов из-за спины разных врагов и финальный взрыв духа.', 'Awakening: five instant strikes from behind different foes and a final spirit blast.'),
    icon: 'steelfist_ult', color: SPIRIT, cd: 80, type: 'normal', tags: ['burst', 'mobility'], el: 'lightning', range: 9, radius: 4.5, unlock: 8,
    steps: [step('sf_ult', 2.0, [
      move(0.05, 'behind', 9, 0.05), hit(0.12, circle(2.2), 3, { stag: 20, fx: 'punch', el: 'lightning', backMul: 1.3 }),
      move(0.3, 'behind', 9, 0.05), hit(0.37, circle(2.2), 3, { stag: 20, fx: 'punch', el: 'lightning', backMul: 1.3 }),
      move(0.55, 'behind', 9, 0.05), hit(0.62, circle(2.2), 3, { stag: 20, fx: 'punch', el: 'lightning', backMul: 1.3 }),
      move(0.8, 'behind', 9, 0.05), hit(0.87, circle(2.2), 3, { stag: 20, fx: 'punch', el: 'lightning', backMul: 1.3 }),
      move(1.05, 'behind', 9, 0.05), hit(1.12, circle(2.2), 3, { stag: 20, fx: 'punch', el: 'lightning', backMul: 1.3 }),
      hit(1.5, circle(4.5), 14, { stag: 100, fx: 'bolt', el: 'lightning', shake: 0.6, launch: true, sfx: 'zap' }),
    ], { iframes: [0, 1.7], armor: 'super', cancel: 1.75 })],
  }),
  identity: {
    kind: 'awaken', name: L('Пробуждение духа', 'Spirit Awakening'), desc: L('При трёх сферах: 10 сек. навыки не тратят сферы, удары +30% урона и бьют молнией.', 'With three orbs: for 10s skills cost no orbs, blows deal +30% damage and strike with lightning.'),
    icon: 'steelfist_id', need: 99, dur: 10, color: SPIRIT,
    step: step('sf_identity', 0.5, [fx(0.2, 'burst', { color: SPIRIT, r: 3, shake: 0.2 }), buff(0.2, 10, { dmg: 0.3, atkSpeed: 0.15, color: SPIRIT })], { iframes: [0, 0.5] }),
  },
};
