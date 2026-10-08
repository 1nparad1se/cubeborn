import { buff, circle, cone, fx, hit, L, move, proj, rect, sides, skill, step } from '../dsl';
import type { ClassDef } from '../types';

const C = 0xc04aff;
const STEEL = 0xd8e0f0;

/** Deathblade — twin blades, flash steps, huge damage from behind. */
export const DEATHBLADE: ClassDef = {
  id: 'deathblade',
  name: L('Клинок смерти', 'Deathblade'),
  title: L('Пляска Двух Лезвий', 'Dance of Twin Edges'),
  desc: L(
    'Убийца с двумя клинками. Мгновенные шаги за спину врага, удары со спины наносят намного больше урона. Копит сферы смерти для рывка Всплеска.',
    'An assassin with twin blades. Instant steps behind the foe; back attacks deal far more damage. Builds death orbs for the Surge dash.',
  ),
  role: L('Ближний бой · урон со спины', 'Melee · back attacks'),
  difficulty: 3,
  weapon: L('Парные клинки', 'Twin blades'),
  ratings: { attack: 5, defense: 1, mobility: 5, control: 2, support: 1, range: 1 },
  passive: {
    name: L('Удар в спину', 'Backstab'),
    desc: L('Удары со спины: +40% урона и крит. Отмеченные «со спины» навыки дают ещё больше.', 'Back attacks: +40% damage and crit. Skills marked "from behind" deal even more.'),
  },
  baseHp: 115,
  baseSpeed: 5,
  armor: 1,
  power: 9.5,
  color: C,
  res: {
    id: 'death', name: L('Сферы смерти', 'Death Orbs'), desc: L('3 сферы. Копятся от ударов. Полные — Всплеск (Z).', '3 orbs. Built by blows. All full — Surge (Z).'),
    color: '#c070ff', max: 99, orbs: 3, regen: 0, onBasic: 2, onSkill: 3, onKill: 1, onHurt: 0,
  },
  basic: {
    name: L('Двойные порезы', 'Twin Cuts'), desc: L('Три стремительных скрещённых пореза.', 'Three swift crossing cuts.'),
    icon: 'deathblade_basic', el: 'phys', ranged: false, window: 0.35,
    steps: [
      step('db_basic1', 0.3, [hit(0.12, cone(2.4, 120), 0.8, { stag: 3, fx: 'slash', backMul: 1.4 })], { cancel: 0.18, move: 0.35, track: true }),
      step('db_basic2', 0.3, [hit(0.12, cone(2.4, 120), 0.8, { stag: 3, fx: 'slash', backMul: 1.4 })], { cancel: 0.18, move: 0.35, track: true }),
      step('db_basic3', 0.42, [hit(0.18, cone(2.6, 160), 1.4, { stag: 6, fx: 'slash_wide', backMul: 1.4 })], { cancel: 0.28, move: 0.25, track: true }),
    ],
  },
  dodge: { name: L('Тенистый шаг', 'Shade Step'), cd: 4, charges: 2, step: step('db_dodge', 0.36, [move(0, 'dash', 5, 0.2, { iframe: true })], { iframes: [0, 0.26] }) },
  skills: [
    skill({
      id: 'db_q', name: L('Перекрёстная жатва', 'Cross Harvest'), desc: L('Три удара: косой, обратный и крестовой разрез.', 'Three strikes: a diagonal, a backhand and a cross cut.'),
      icon: 'deathblade_q', color: STEEL, cd: 4, type: 'combo', window: 0.6, tags: ['melee', 'combo', 'back'], el: 'phys', range: 2.8, radius: 2.8, unlock: 1,
      steps: [
        step('db_q1', 0.28, [hit(0.12, cone(2.7, 140), 1.8, { stag: 6, fx: 'slash', backMul: 1.5 })], { cancel: 0.16, track: true }),
        step('db_q2', 0.28, [hit(0.12, cone(2.7, 140), 1.8, { stag: 6, fx: 'slash', backMul: 1.5 })], { cancel: 0.16, track: true }),
        step('db_q3', 0.45, [hit(0.2, circle(2.8), 3, { stag: 12, fx: 'slash_wide', backMul: 1.5, st: 'bleed', stp: 4 })], { cancel: 0.3 }),
      ],
    }),
    skill({
      id: 'db_w', name: L('Вспышка', 'Flash Step'), desc: L('Мгновенный шаг за спину врага у курсора и удар в спину.', 'An instant step behind the foe at the cursor and a strike in the back.'),
      icon: 'deathblade_w', color: C, cd: 6, type: 'normal', tags: ['mobility', 'back'], el: 'dark', range: 8, radius: 2, unlock: 1,
      note: L('Со спины ×1.6 урона.', '×1.6 damage from behind.'),
      steps: [step('db_w', 0.42, [move(0.02, 'behind', 8, 0.06, { iframe: true }), hit(0.14, cone(2.6, 150), 3.4, { stag: 12, fx: 'dark', el: 'dark', backMul: 1.6 })], { cancel: 0.26 })],
    }),
    skill({
      id: 'db_e', name: L('Стальное вращение', 'Steel Spin'), desc: L('Рывок вперёд с вращением клинков, режущий всех на пути.', 'A forward dash with spinning blades, cutting all in the way.'),
      icon: 'deathblade_e', color: STEEL, cd: 7, type: 'normal', tags: ['mobility', 'aoe'], el: 'phys', range: 6, radius: 1.8, unlock: 1,
      steps: [step('db_e', 0.5, [move(0.03, 'dash', 6, 0.32, { hit: { r: 1.8, dmg: 2.8, stag: 10, fx: 'spin', backMul: 1.3 } })], { cancel: 0.36 })],
    }),
    skill({
      id: 'db_r', name: L('Крестовой разрез', 'Cross Cut'), desc: L('Два мощных разреза крест-накрест, вызывающих сильное кровотечение.', 'Two heavy crossing cuts that cause heavy bleeding.'),
      icon: 'deathblade_r', color: 0xff3a5a, cd: 8, type: 'normal', tags: ['melee', 'burst', 'back'], el: 'phys', range: 3.2, radius: 3.2, unlock: 2,
      steps: [step('db_r', 0.6, [hit(0.16, cone(3.2, 110), 2.6, { stag: 12, fx: 'slash', backMul: 1.5 }), hit(0.32, cone(3.2, 110), 3.4, { stag: 14, fx: 'slash_wide', backMul: 1.5, st: 'bleed', stp: 8 })], { cancel: 0.44, track: true })],
    }),
    skill({
      id: 'db_a', name: L('Буря клинков', 'Blade Storm'), desc: L('Удерживайте: вихрь клинков вокруг, с которым можно бежать.', 'Hold: a whirl of blades around you that you can run with.'),
      icon: 'deathblade_a', color: STEEL, cd: 11, type: 'hold', holdMax: 2, tags: ['aoe', 'holding'], el: 'phys', range: 2.6, radius: 2.6, unlock: 3,
      steps: [
        step('db_a_in', 0.1, []),
        step('db_a_loop', 0.18, [hit(0.06, circle(2.6), 1, { stag: 4, fx: 'spin' })], { move: 0.7, armor: 'push' }),
        step('db_a_out', 0.35, [hit(0.12, circle(3), 2.6, { stag: 12, fx: 'slash_wide', knock: 1 })], { cancel: 0.22 }),
      ],
    }),
    skill({
      id: 'db_s', name: L('Веер кинжалов', 'Dagger Fan'), desc: L('Бросок пяти кинжалов веером с отскоком назад.', 'Throws five daggers in a fan while hopping back.'),
      icon: 'deathblade_s', color: STEEL, cd: 7, type: 'normal', tags: ['ranged', 'mobility'], el: 'phys', range: 9, radius: 0.4, unlock: 4,
      steps: [step('db_s', 0.45, [move(0.02, 'back', 2.5, 0.18), proj(0.14, { dmg: 2, stag: 5, n: 5, spread: 50, speed: 24, range: 9, vis: 'dagger', color: STEEL, st: 'bleed', stp: 3 })], { cancel: 0.3, track: true })],
    }),
    skill({
      id: 'db_d', name: L('Казнь', 'Execution'), desc: L('Шаг за спину и смертельный удар. Огромный урон врагам со спины и с малым здоровьем. Тратит сферу.', 'Step behind and strike to kill. Huge damage to foes from behind and on low health. Spends an orb.'),
      icon: 'deathblade_d', color: C, cd: 12, type: 'normal', cost: 33, tags: ['burst', 'back'], el: 'dark', range: 6, radius: 2.4, unlock: 5,
      note: L('Со спины ×1.6, по раненым ×2.', '×1.6 from behind, ×2 vs. wounded.'),
      steps: [step('db_d', 0.7, [move(0.02, 'behind', 6, 0.06, { iframe: true }), hit(0.3, rect(2.6, 2.4), 8, { stag: 30, fx: 'dark', el: 'dark', backMul: 1.6, execute: 2, shake: 0.25, sfx: 'shadow' })], { cancel: 0.5, armor: 'super' })],
    }),
    skill({
      id: 'db_f', name: L('Призрачный натиск', 'Phantom Rush'), desc: L('До трёх нажатий: каждое — рывок сквозь врагов с порезом.', 'Up to three presses: each is a dash through foes with a cut.'),
      icon: 'deathblade_f', color: C, cd: 10, type: 'combo', window: 0.9, tags: ['mobility', 'combo'], el: 'dark', range: 5, radius: 1.5, unlock: 6,
      steps: [
        step('db_f1', 0.32, [move(0.02, 'dash', 5, 0.16, { iframe: true, hit: { r: 1.5, dmg: 2.2, stag: 8, el: 'dark', fx: 'dark', backMul: 1.3 } })], { cancel: 0.2, track: true }),
        step('db_f2', 0.32, [move(0.02, 'dash', 5, 0.16, { iframe: true, hit: { r: 1.5, dmg: 2.2, stag: 8, el: 'dark', fx: 'dark', backMul: 1.3 } })], { cancel: 0.2, track: true }),
        step('db_f3', 0.5, [move(0.02, 'dash', 5, 0.16, { iframe: true, hit: { r: 1.5, dmg: 3.2, stag: 14, el: 'dark', fx: 'dark', backMul: 1.3 } }), hit(0.22, sides(2.6, 2), 2.4, { stag: 10, el: 'dark', fx: 'dark' })], { cancel: 0.34, track: true }),
      ],
    }),
  ],
  ult: skill({
    id: 'db_ult', name: L('Тысяча порезов', 'Thousand Cuts'), desc: L('Пробуждение: клинок смерти исчезает и рассекает пространство вокруг десятками порезов, затем возникает с крестовым ударом.', 'Awakening: the deathblade vanishes and rends the space around with dozens of cuts, then reappears with a cross strike.'),
    icon: 'deathblade_ult', color: C, cd: 80, type: 'normal', tags: ['burst', 'aoe'], el: 'dark', range: 0, radius: 5, unlock: 8,
    steps: [step('db_ult', 2.0, [
      fx(0.1, 'burst', { color: C, r: 2 }),
      hit(0.3, circle(5), 1.4, { stag: 8, el: 'dark', fx: 'slash', n: 12, every: 0.07, backMul: 1.2 }),
      hit(1.35, circle(5), 12, { stag: 110, el: 'dark', fx: 'dark', shake: 0.6, knock: 2, sfx: 'shadow' }),
    ], { iframes: [0, 1.6], armor: 'super', cancel: 1.7 })],
  }),
  identity: {
    kind: 'surge', name: L('Всплеск', 'Surge'), desc: L('При трёх сферах: длинный рывок сквозь врагов, урон растёт с каждой сферой. 8 сек. после — +20% скорости.', 'With three orbs: a long dash through foes; damage scales with orbs. +20% speed for 8s after.'),
    icon: 'deathblade_id', need: 99, dur: 8, color: C,
    step: step('db_identity', 0.6, [move(0.05, 'dash', 8, 0.25, { iframe: true, hit: { r: 2, dmg: 9, stag: 40, el: 'dark', fx: 'dark', backMul: 1.3 } }), buff(0.3, 8, { speed: 0.2, atkSpeed: 0.2, color: C }), fx(0.3, 'flash', { color: C })], { iframes: [0, 0.5] }),
  },
};
