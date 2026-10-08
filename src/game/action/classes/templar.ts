import { buff, circle, cone, cross, fx, hit, L, move, proj, rect, ring, skill, step, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0x4ab8d8;
const SEAL = 0x7ae8ff;
const GOLD = 0xffd070;

/** Templar — halberd and seals; energy circles, space control, directional sweeps. */
export const TEMPLAR: ClassDef = {
  id: 'templar',
  name: L('Храмовница', 'Templar'),
  title: L('Хранительница Печатей', 'Warden of Seals'),
  desc: L(
    'Воительница с алебардой. Ставит на землю печати и энергетические круги, управляет пространством, бьёт в заданных направлениях — вперёд, назад и по бокам. Подрывает все печати разом.',
    'A warrior with a halberd. Places seals and energy circles, controls space and strikes in set directions — forward, backward and to the sides. Detonates all seals at once.',
  ),
  role: L('Ближний бой · контроль пространства', 'Melee · space control'),
  difficulty: 3,
  weapon: L('Алебарда', 'Halberd'),
  ratings: { attack: 4, defense: 4, mobility: 3, control: 5, support: 2, range: 3 },
  passive: {
    name: L('Печати', 'Seals'),
    desc: L('Навыки оставляют печати на земле (до 5). Враги на печатях замедлены. Z — подрыв всех печатей.', 'Skills leave seals on the ground (up to 5). Foes on seals are slowed. Z — detonate every seal.'),
  },
  baseHp: 150,
  baseSpeed: 4.4,
  armor: 4,
  power: 9.5,
  color: C,
  res: {
    id: 'seals', name: L('Печати', 'Seals'), desc: L('Пять печатей. Каждая поставленная печать заполняет ячейку. Подрыв — Ось Небес (Z).', 'Five seals. Each placed seal fills a slot. Detonate — Divine Axis (Z).'),
    color: '#7ae8ff', max: 100, orbs: 5, regen: 0, onBasic: 1, onSkill: 0, onKill: 0.5, onHurt: 0,
  },
  basic: {
    name: L('Удары алебардой', 'Halberd Strikes'), desc: L('Два длинных выпада и широкий взмах.', 'Two long thrusts and a wide sweep.'),
    icon: 'templar_basic', el: 'phys', ranged: false, window: 0.4,
    steps: [
      step('tp_basic1', 0.42, [hit(0.18, rect(3.4, 1.2), 1, { stag: 5, fx: 'thrust' })], { cancel: 0.28, move: 0.25, track: true }),
      step('tp_basic2', 0.42, [hit(0.18, rect(3.4, 1.2), 1, { stag: 5, fx: 'thrust' })], { cancel: 0.28, move: 0.25, track: true }),
      step('tp_basic3', 0.6, [hit(0.28, cone(3.4, 180), 1.6, { stag: 10, fx: 'slash_wide', knock: 1.2 })], { cancel: 0.42, move: 0.15, track: true }),
    ],
  },
  dodge: { name: L('Шаг печати', 'Seal Step'), cd: 5, charges: 1, step: step('tp_dodge', 0.45, [move(0, 'dash', 4.4, 0.26, { iframe: true })], { iframes: [0, 0.3] }) },
  skills: [
    skill({
      id: 'tp_q', name: L('Разящая ось', 'Striking Axis'), desc: L('Два удара: выпад вперёд и разворот с ударом древком назад.', 'Two blows: a forward thrust and a turn striking backwards with the shaft.'),
      icon: 'templar_q', color: C, cd: 5, type: 'combo', window: 0.7, tags: ['melee', 'combo', 'directional'], el: 'phys', range: 4, radius: 3, unlock: 1,
      steps: [
        step('tp_q1', 0.42, [hit(0.18, rect(4, 1.4), 2.6, { stag: 10, fx: 'thrust' })], { cancel: 0.28, track: true }),
        step('tp_q2', 0.55, [hit(0.24, rect(3.4, 2, { back: true }), 3, { stag: 14, fx: 'smash', knock: 1.6 }), hit(0.24, cone(2.6, 120), 1.6, { stag: 6, fx: 'slash' })], { cancel: 0.38 }),
      ],
    }),
    skill({
      id: 'tp_w', name: L('Печать изгнания', 'Seal of Banishing'), desc: L('Ставит печать у курсора; через 1 сек. она взрывается и оглушает. Оставляет печать.', 'Places a seal at the cursor; after 1s it erupts and stuns. Leaves a seal.'),
      icon: 'templar_w', color: SEAL, cd: 8, type: 'normal', tags: ['aoe', 'control'], el: 'magic', range: 9, radius: 2.8, unlock: 1,
      steps: [step('tp_w', 0.45, [zone(0.2, { at: 'aim', range: 9, r: 2.8, delay: 1, dmg: 4.6, stag: 30, el: 'magic', vis: 'seal', color: SEAL, st: 'stun', stp: 1 })], { cancel: 0.3, track: true })],
    }),
    skill({
      id: 'tp_e', name: L('Круг правосудия', 'Circle of Judgment'), desc: L('Энергетическое кольцо вокруг: бьёт врагов на краю и затягивает их внутрь.', 'An energy ring around you: strikes foes at its edge and pulls them in.'),
      icon: 'templar_e', color: SEAL, cd: 10, type: 'normal', tags: ['aoe', 'control'], el: 'magic', range: 0, radius: 4.5, unlock: 1,
      steps: [step('tp_e', 0.6, [hit(0.28, ring(1.6, 4.5), 3.6, { stag: 18, el: 'magic', fx: 'shock', pull: 5 }), zone(0.3, { at: 'self', r: 2.4, dur: 3, every: 0.5, dmg: 0.6, el: 'magic', vis: 'seal', color: SEAL, st: 'slow', stp: 0.5 })], { cancel: 0.42 })],
    }),
    skill({
      id: 'tp_r', name: L('Копьё рассвета', 'Dawnspear'), desc: L('Бросок светового копья, пробивающего врагов. Повторное нажатие — перенос к копью с ударом.', 'Throws a spear of light that pierces foes. Press again to blink to it with a strike.'),
      icon: 'templar_r', color: GOLD, cd: 10, type: 'combo', window: 1.4, tags: ['ranged', 'mobility', 'combo'], el: 'magic', range: 9, radius: 2.2, unlock: 2,
      steps: [
        step('tp_r1', 0.45, [proj(0.2, { dmg: 3.4, stag: 12, el: 'magic', speed: 26, range: 9, r: 0.6, pierce: -1, vis: 'spear', color: GOLD })], { cancel: 0.3, track: true }),
        step('tp_r2', 0.5, [move(0.04, 'blink', 9, 0.05, { iframe: true }), hit(0.16, circle(2.2), 3, { stag: 16, el: 'magic', fx: 'holy', knock: 1.2 })], { cancel: 0.32 }),
      ],
    }),
    skill({
      id: 'tp_a', name: L('Двойной взмах', 'Twin Sweep'), desc: L('Взмах алебардой перед собой, затем разворот с ударом за спину.', 'A halberd sweep ahead, then a turn striking behind.'),
      icon: 'templar_a', color: C, cd: 7, type: 'normal', tags: ['melee', 'directional', 'aoe'], el: 'phys', range: 3.8, radius: 3.8, unlock: 3,
      steps: [step('tp_a', 0.7, [hit(0.2, cone(3.8, 150), 3, { stag: 12, fx: 'slash_wide' }), hit(0.45, cone(3.8, 150, true), 3.6, { stag: 16, fx: 'slash_wide', knock: 1.4 })], { cancel: 0.55, armor: 'push' })],
    }),
    skill({
      id: 'tp_s', name: L('Святой оплот', 'Sanctum Ward'), desc: L('Печать-оплот под героиней: щит 25% здоровья и −30% урона на 6 сек.', 'A ward seal underfoot: a 25% health shield and −30% damage taken for 6s.'),
      icon: 'templar_s', color: SEAL, cd: 18, type: 'normal', tags: ['defense', 'buff'], el: 'magic', range: 0, radius: 2.6, unlock: 4,
      steps: [step('tp_s', 0.5, [buff(0.22, 6, { shield: 0.25, dr: 0.3, color: SEAL }), zone(0.22, { at: 'self', r: 2.6, dur: 6, every: 1, dmg: 0.4, el: 'magic', vis: 'seal', color: SEAL, ward: 0.2 })], { cancel: 0.32 })],
    }),
    skill({
      id: 'tp_d', name: L('Цепи небес', "Heaven's Chains"), desc: L('Цепи света из печати у курсора стягивают врагов в центр и оглушают.', 'Chains of light from a seal at the cursor drag foes to its centre and stun them.'),
      icon: 'templar_d', color: GOLD, cd: 13, type: 'normal', tags: ['control', 'aoe'], el: 'magic', range: 8, radius: 4, unlock: 5,
      steps: [step('tp_d', 0.55, [zone(0.25, { at: 'aim', range: 8, r: 4, delay: 0.3, dmg: 3.4, stag: 32, el: 'magic', vis: 'seal', color: GOLD, pull: 8, st: 'stun', stp: 1.4 })], { cancel: 0.36, track: true })],
    }),
    skill({
      id: 'tp_f', name: L('Божественный удар', 'Divine Crash'), desc: L('Прыжок к курсору и удар алебардой, рассекающий землю крестом.', 'Leap to the cursor and strike, splitting the ground in a cross.'),
      icon: 'templar_f', color: GOLD, cd: 12, type: 'normal', tags: ['mobility', 'aoe', 'burst'], el: 'magic', range: 7, radius: 4, unlock: 6,
      steps: [step('tp_f', 0.85, [move(0.08, 'leap', 7, 0.4, { iframe: true }), hit(0.5, cross(4, 1.6), 5.6, { stag: 34, el: 'magic', fx: 'holy', shake: 0.3, sfx: 'smash' }), zone(0.5, { at: 'self', r: 2, dur: 4, every: 1, dmg: 0.3, el: 'magic', vis: 'seal', color: SEAL, st: 'slow', stp: 0.5 })], { cancel: 0.65, armor: 'super' })],
    }),
  ],
  ult: skill({
    id: 'tp_ult', name: L('Последний Приговор', 'Final Judgment'), desc: L('Пробуждение: над полем вспыхивает гигантская печать, крест света рассекает землю, а затем печать рушится на врагов.', 'Awakening: a giant seal flares over the field, a cross of light splits the ground, then the seal collapses on foes.'),
    icon: 'templar_ult', color: GOLD, cd: 90, type: 'normal', tags: ['burst', 'aoe', 'control'], el: 'magic', range: 0, radius: 7, unlock: 8,
    steps: [step('tp_ult', 2.0, [
      zone(0.2, { at: 'self', r: 7, dur: 1.6, every: 0.4, dmg: 0.6, el: 'magic', vis: 'seal', color: GOLD, st: 'slow', stp: 0.7 }),
      hit(0.7, cross(7, 2.4), 8, { stag: 50, el: 'magic', fx: 'holy', shake: 0.35 }),
      hit(1.5, circle(7), 14, { stag: 110, el: 'magic', fx: 'holy', shake: 0.7, st: 'stun', stp: 2, launch: true, sfx: 'meteor' }),
    ], { iframes: [0, 1.7], armor: 'super', cancel: 1.75 })],
  }),
  identity: {
    kind: 'axis', name: L('Ось Небес', 'Divine Axis'), desc: L('Подрывает все печати на поле: урон растёт с числом печатей. Героиня получает щит.', 'Detonates every seal on the field: damage grows with the seal count. The templar gains a shield.'),
    icon: 'templar_id', need: 20, dur: 0, color: SEAL,
    step: step('tp_identity', 0.6, [fx(0.25, 'flash', { color: SEAL }), buff(0.25, 5, { shield: 0.15, color: SEAL })], { iframes: [0, 0.6] }),
  },
};
