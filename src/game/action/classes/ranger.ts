import { buff, fx, L, move, proj, skill, step, summon, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0x6ac85a;
const ARROW = 0xe8d8b0;

/** Ranger — longbow, traps, arrow rain and shooting while backing away. */
export const RANGER: ClassDef = {
  id: 'ranger',
  name: L('Рейнджер', 'Ranger'),
  title: L('Тень Серого Леса', 'Shade of the Grey Wood'),
  desc: L(
    'Лучница дальнего боя. Стреляет на бегу, ставит капканы, вызывает дождь стрел и отступает сальто назад. Метит цели для огромного урона.',
    'A ranged archer. Shoots on the move, sets traps, calls arrow rain and backflips away. Marks targets for huge damage.',
  ),
  role: L('Дальний бой · контроль поля', 'Ranged · zone control'),
  difficulty: 2,
  weapon: L('Длинный лук', 'Longbow'),
  ratings: { attack: 4, defense: 1, mobility: 4, control: 4, support: 2, range: 5 },
  passive: {
    name: L('Стрельба на ходу', 'Running Shot'),
    desc: L('Базовые выстрелы не замедляют бег. Отмеченные цели получают +25% урона от навыков.', 'Basic shots do not slow you. Marked targets take +25% skill damage.'),
  },
  baseHp: 120,
  baseSpeed: 4.8,
  armor: 1,
  power: 9,
  color: C,
  res: {
    id: 'focus', name: L('Сосредоточение', 'Focus'), desc: L('Копится от попаданий. Полная шкала — Сокол (Z).', 'Builds from hits. Full bar — Hawk (Z).'),
    color: '#9ae86a', max: 100, regen: 1, onBasic: 2.5, onSkill: 3, onKill: 1, onHurt: 0,
  },
  basic: {
    name: L('Выстрел', 'Shot'), desc: L('Быстрый выстрел из лука на ходу.', 'A quick shot while moving.'),
    icon: 'ranger_basic', el: 'phys', ranged: true, window: 0.3,
    steps: [step('rg_basic', 0.38, [proj(0.14, { dmg: 1, stag: 3, speed: 28, range: 14, r: 0.3, vis: 'arrow', color: ARROW })], { cancel: 0.2, move: 0.75, track: true })],
  },
  dodge: { name: L('Сальто', 'Somersault'), cd: 5, charges: 2, step: step('rg_dodge', 0.45, [move(0, 'dash', 5, 0.28, { iframe: true })], { iframes: [0, 0.32] }) },
  skills: [
    skill({
      id: 'rg_q', name: L('Пронзающая стрела', 'Piercing Arrow'), desc: L('Удерживайте для натяжения и отпустите: стрела пробивает всех на линии.', 'Hold to draw, release: the arrow pierces everything in its line.'),
      icon: 'ranger_q', color: ARROW, cd: 6, type: 'charge', chargeMax: 1, chargeMul: 2.4, tags: ['ranged', 'charge', 'directional'], el: 'phys', range: 18, radius: 0.6, unlock: 1,
      steps: [step('rg_q', 0.45, [proj(0.12, { dmg: 4.4, stag: 18, speed: 40, range: 18, r: 0.6, pierce: -1, vis: 'bigarrow', color: ARROW, knock: 1 })], { cancel: 0.3, track: true })],
    }),
    skill({
      id: 'rg_w', name: L('Отскок с выстрелом', 'Recoil Shot'), desc: L('Сальто назад с веером из трёх стрел в полёте.', 'A backflip that fires three arrows mid-air.'),
      icon: 'ranger_w', color: C, cd: 6, type: 'normal', tags: ['mobility', 'ranged'], el: 'phys', range: 12, radius: 0.4, unlock: 1,
      steps: [step('rg_w', 0.55, [move(0.02, 'back', 5, 0.3, { iframe: true }), proj(0.18, { dmg: 2, stag: 6, n: 3, spread: 24, speed: 28, range: 12, vis: 'arrow', color: ARROW, st: 'slow', stp: 0.45 })], { cancel: 0.36, track: true })],
    }),
    skill({
      id: 'rg_e', name: L('Дождь стрел', 'Arrow Rain'), desc: L('Залп в небо: 3 сек. стрелы падают в круг у курсора.', 'A volley into the sky: arrows fall in a circle at the cursor for 3s.'),
      icon: 'ranger_e', color: ARROW, cd: 11, type: 'normal', tags: ['aoe', 'ranged'], el: 'phys', range: 11, radius: 3.4, unlock: 1,
      steps: [step('rg_e', 0.55, [zone(0.25, { at: 'aim', range: 11, r: 3.4, delay: 0.4, dur: 3, every: 0.25, dmg: 0.9, stag: 2, vis: 'rain', color: ARROW, st: 'slow', stp: 0.3 })], { cancel: 0.38, track: true })],
    }),
    skill({
      id: 'rg_r', name: L('Взрывная стрела', 'Blast Arrow'), desc: L('Стрела с зарядом взрывается при попадании, отбрасывая врагов.', 'An arrow with a charge that explodes on hit, knocking foes back.'),
      icon: 'ranger_r', color: 0xff9a3a, cd: 8, type: 'normal', tags: ['ranged', 'aoe'], el: 'fire', range: 14, radius: 2.6, unlock: 2,
      steps: [step('rg_r', 0.5, [proj(0.2, { dmg: 5, stag: 24, el: 'fire', speed: 26, range: 14, r: 0.4, explode: 2.6, vis: 'firearrow', color: 0xff9a3a, knock: 2, st: 'burn', stp: 4 })], { cancel: 0.34, track: true })],
    }),
    skill({
      id: 'rg_a', name: L('Капкан', 'Bear Trap'), desc: L('Ставит капкан у курсора: первый враг попадает в него, получает урон и обездвижен.', 'Sets a trap at the cursor: the first foe is snapped, damaged and rooted.'),
      icon: 'ranger_a', color: 0xa0a0a0, cd: 9, type: 'normal', tags: ['control'], el: 'phys', range: 6, radius: 1.8, unlock: 3,
      steps: [step('rg_a', 0.45, [zone(0.2, { at: 'aim', range: 6, r: 1.8, dur: 12, dmg: 5, stag: 30, vis: 'trap', color: 0xc0c0c0, st: 'root', stp: 2.5, n: 2, spread: 1.4 })], { cancel: 0.3 })],
    }),
    skill({
      id: 'rg_s', name: L('Веер стрел', 'Arrow Fan'), desc: L('Веер из 7 стрел перед собой.', 'A fan of 7 arrows ahead.'),
      icon: 'ranger_s', color: ARROW, cd: 7, type: 'normal', tags: ['ranged', 'aoe', 'directional'], el: 'phys', range: 10, radius: 0.4, unlock: 4,
      steps: [step('rg_s', 0.45, [proj(0.16, { dmg: 2, stag: 6, n: 7, spread: 70, speed: 26, range: 10, vis: 'arrow', color: ARROW, pierce: 1 })], { cancel: 0.3, track: true })],
    }),
    skill({
      id: 'rg_d', name: L('Шквал', 'Barrage'), desc: L('Удерживайте: непрерывный поток стрел. Можно медленно двигаться.', 'Hold: a nonstop stream of arrows. You can move slowly.'),
      icon: 'ranger_d', color: ARROW, cd: 12, type: 'hold', holdMax: 2.2, tags: ['ranged', 'holding'], el: 'phys', range: 14, radius: 0.4, unlock: 5,
      steps: [
        step('rg_d_in', 0.12, []),
        step('rg_d_loop', 0.13, [proj(0.05, { dmg: 0.9, stag: 3, speed: 32, range: 14, vis: 'arrow', color: ARROW, spread: 8, n: 1 })], { move: 0.5, track: true }),
        step('rg_d_out', 0.3, [], { cancel: 0.1 }),
      ],
    }),
    skill({
      id: 'rg_f', name: L('Метка охотника', "Hunter's Mark"), desc: L('Стрела-метка: всё вокруг точки попадания помечено на 8 сек. (+25% урона навыков).', 'A marking arrow: everything around the impact is marked for 8s (+25% skill damage).'),
      icon: 'ranger_f', color: 0xff5a5a, cd: 14, type: 'normal', tags: ['control', 'buff'], el: 'phys', range: 14, radius: 3, unlock: 6,
      steps: [step('rg_f', 0.45, [proj(0.16, { dmg: 2.4, stag: 8, speed: 30, range: 14, r: 0.4, explode: 3, vis: 'markarrow', color: 0xff5a5a, st: 'mark', stp: 8 })], { cancel: 0.3, track: true })],
    }),
  ],
  ult: skill({
    id: 'rg_ult', name: L('Небесный залп', 'Sky Volley'), desc: L('Пробуждение: лучница выпускает в небо сотни стрел, которые накрывают огромную область у курсора.', 'Awakening: the archer looses hundreds of arrows into the sky that blanket a huge area at the cursor.'),
    icon: 'ranger_ult', color: ARROW, cd: 80, type: 'normal', tags: ['burst', 'aoe', 'ranged'], el: 'phys', range: 12, radius: 6, unlock: 8,
    steps: [step('rg_ult', 1.8, [
      fx(0.3, 'flash', { color: ARROW }),
      zone(0.5, { at: 'aim', range: 12, r: 6, delay: 0.6, dur: 2.2, every: 0.15, dmg: 1.6, stag: 6, vis: 'rain', color: ARROW, st: 'slow', stp: 0.4 }),
      zone(0.5, { at: 'aim', range: 12, r: 6, delay: 2.9, dmg: 10, stag: 80, vis: 'rain', color: 0xfff0c0, knock: 2 }),
    ], { iframes: [0, 1.4], armor: 'super', cancel: 1.4 })],
  }),
  identity: {
    kind: 'hawk', name: L('Сокол', 'Hawk'), desc: L('При полном сосредоточении: 15 сек. сокол атакует врагов у курсора и метит их.', 'At full focus: for 15s a hawk attacks foes near the cursor and marks them.'),
    icon: 'ranger_id', need: 100, dur: 15, color: C,
    step: step('rg_identity', 0.5, [summon(0.2, 'hawk', 15, 1.4), buff(0.2, 15, { crit: 0.15, color: C })]),
  },
};
