import { buff, circle, cone, fx, hit, L, move, rect, skill, step, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0xf0c850;
const HOLY = 0xffe08a;

/** Paladin — sword and tower shield, holy light; protective zones and buffs. */
export const PALADIN: ClassDef = {
  id: 'paladin',
  name: L('Паладин', 'Paladin'),
  title: L('Щит Рассвета', 'Shield of Dawn'),
  desc: L(
    'Рыцарь с мечом и башенным щитом. Блокирует удары, ставит святые зоны защиты, усиливает себя и наказывает врагов светом.',
    'A knight with sword and tower shield. Blocks blows, raises holy protective zones, empowers himself and smites foes with light.',
  ),
  role: L('Защита · поддержка · контроль', 'Defense · support · control'),
  difficulty: 1,
  weapon: L('Меч и башенный щит', 'Sword and tower shield'),
  ratings: { attack: 3, defense: 5, mobility: 2, control: 3, support: 5, range: 2 },
  passive: {
    name: L('Святая вера', 'Holy Faith'),
    desc: L('Каждый навык восстанавливает 2% здоровья. Блок щитом отражает удар обратно.', 'Every skill restores 2% health. A shield block reflects the blow.'),
  },
  baseHp: 180,
  baseSpeed: 4.3,
  armor: 6,
  power: 9,
  color: C,
  res: {
    id: 'faith', name: L('Вера', 'Faith'), desc: L('Копится от ударов и навыков. Полная шкала — Святилище (Z).', 'Builds from hits and skills. Full bar — Sanctuary (Z).'),
    color: '#ffd860', max: 100, regen: 0, onBasic: 3, onSkill: 5, onKill: 1, onHurt: 0.15,
  },
  basic: {
    name: L('Удары рыцаря', 'Knight Strikes'), desc: L('Два взмаха мечом и удар щитом.', 'Two sword swings and a shield bash.'),
    icon: 'paladin_basic', el: 'phys', ranged: false, window: 0.45,
    steps: [
      step('pl_basic1', 0.45, [hit(0.2, cone(2.6, 120), 1, { stag: 5, fx: 'slash' })], { cancel: 0.3, move: 0.25, track: true }),
      step('pl_basic2', 0.45, [hit(0.2, cone(2.6, 120), 1, { stag: 5, fx: 'slash' })], { cancel: 0.3, move: 0.25, track: true }),
      step('pl_basic3', 0.6, [hit(0.28, rect(2.6, 1.8), 1.6, { stag: 14, fx: 'smash', knock: 1.6, st: 'stun', stp: 0.3 })], { cancel: 0.42, track: true }),
    ],
  },
  dodge: { name: L('Перекат', 'Roll'), cd: 6, charges: 1, step: step('pl_dodge', 0.5, [move(0, 'dash', 4.2, 0.3, { iframe: true })], { iframes: [0, 0.34] }) },
  skills: [
    skill({
      id: 'pl_q', name: L('Праведный удар', 'Righteous Strike'), desc: L('Три удара: два взмаха светящимся мечом и колющий удар со вспышкой света.', 'Three blows: two glowing slashes and a thrust that bursts with light.'),
      icon: 'paladin_q', color: HOLY, cd: 5, type: 'combo', window: 0.8, tags: ['melee', 'combo'], el: 'magic', range: 4, radius: 2.8, unlock: 1,
      steps: [
        step('pl_q1', 0.4, [hit(0.18, cone(2.8, 130), 2, { stag: 8, el: 'magic', fx: 'holy' })], { cancel: 0.28, track: true }),
        step('pl_q2', 0.4, [hit(0.18, cone(2.8, 130), 2, { stag: 8, el: 'magic', fx: 'holy' })], { cancel: 0.28, track: true }),
        step('pl_q3', 0.6, [hit(0.3, rect(4, 1.4), 3.6, { stag: 16, el: 'magic', fx: 'holy', knock: 1.2, shake: 0.08 })], { cancel: 0.45, track: true }),
      ],
    }),
    skill({
      id: 'pl_w', name: L('Таран щитом', 'Shield Bash'), desc: L('Короткий рывок со щитом: оглушает и отталкивает.', 'A short shield lunge that stuns and pushes back.'),
      icon: 'paladin_w', color: C, cd: 7, type: 'normal', tags: ['control', 'mobility'], el: 'phys', range: 3, radius: 1.8, unlock: 1,
      steps: [step('pl_w', 0.5, [move(0.05, 'dash', 2.6, 0.18), hit(0.22, cone(2.4, 110), 2.4, { stag: 24, st: 'stun', stp: 1.4, knock: 2.6, fx: 'smash', sfx: 'shield' })], { cancel: 0.38, armor: 'push' })],
    }),
    skill({
      id: 'pl_e', name: L('Щит веры', 'Faith Shield'), desc: L('Удерживайте: поднятый щит блокирует 70% урона спереди и отвечает святым ударом каждому, кто бьёт.', 'Hold: the raised shield blocks 70% of damage and answers every attacker with a holy strike.'),
      icon: 'paladin_e', color: HOLY, cd: 10, type: 'hold', holdMax: 3, tags: ['defense', 'counter', 'holding'], el: 'magic', range: 2.6, radius: 2.6, unlock: 1,
      steps: [
        step('pl_e_in', 0.15, [buff(0, 0.5, { dr: 0.7, counter: { shape: cone(2.6, 140), dmg: 2, stag: 12, el: 'magic', fx: 'holy', knock: 1.5 }, color: HOLY })], { armor: 'super' }),
        step('pl_e_loop', 0.3, [buff(0, 0.35, { dr: 0.7, counter: { shape: cone(2.6, 140), dmg: 2, stag: 12, el: 'magic', fx: 'holy', knock: 1.5 }, color: HOLY })], { move: 0.3, armor: 'super', track: true }),
        step('pl_e_out', 0.45, [hit(0.2, cone(3, 140), 2.6, { stag: 18, el: 'magic', fx: 'holy', knock: 1.8 })], { cancel: 0.3 }),
      ],
    }),
    skill({
      id: 'pl_r', name: L('Приговор небес', "Heaven's Verdict"), desc: L('Меч указывает на цель, и через миг с неба бьёт столп света.', 'The sword points and a pillar of light strikes from the sky a moment later.'),
      icon: 'paladin_r', color: HOLY, cd: 9, type: 'normal', tags: ['aoe', 'ranged', 'burst'], el: 'magic', range: 9, radius: 2.6, unlock: 2,
      steps: [step('pl_r', 0.55, [zone(0.25, { at: 'aim', range: 9, r: 2.6, delay: 0.6, dmg: 6, stag: 30, el: 'magic', vis: 'light', color: HOLY, st: 'stun', stp: 0.8 })], { cancel: 0.4, track: true })],
    }),
    skill({
      id: 'pl_a', name: L('Святой натиск', 'Holy Charge'), desc: L('Рывок со щитом вперёд, сбивающий врагов, с ударом в конце.', 'Charge forward with the shield, bowling foes over, finishing with a blow.'),
      icon: 'paladin_a', color: C, cd: 9, type: 'normal', tags: ['mobility', 'control'], el: 'magic', range: 7, radius: 1.5, unlock: 3,
      steps: [step('pl_a', 0.7, [move(0.05, 'dash', 7, 0.35, { hit: { r: 1.5, dmg: 2, stag: 18, knock: 2.5, el: 'magic', fx: 'holy' } }), hit(0.45, circle(2.4), 2.6, { stag: 16, el: 'magic', fx: 'holy' })], { cancel: 0.55, armor: 'push' })],
    }),
    skill({
      id: 'pl_s', name: L('Благословение', 'Blessing'), desc: L('Свет окутывает героя: +20% урона, +5 брони, щит 20% здоровья на 8 сек.', 'Light wraps the hero: +20% damage, +5 armor and a 20% health shield for 8s.'),
      icon: 'paladin_s', color: HOLY, cd: 20, type: 'normal', cost: -20, tags: ['buff', 'defense'], el: 'magic', range: 0, radius: 2, unlock: 4,
      steps: [step('pl_s', 0.6, [buff(0.3, 8, { dmg: 0.2, armor: 5, shield: 0.2, heal: 0.08, color: HOLY }), fx(0.3, 'ring', { color: HOLY, r: 2.4 })], { cancel: 0.45 })],
    }),
    skill({
      id: 'pl_d', name: L('Гнев света', 'Wrath of Light'), desc: L('Поднятый щит выпускает конус святого света.', 'The raised shield releases a cone of holy light.'),
      icon: 'paladin_d', color: HOLY, cd: 11, type: 'normal', tags: ['aoe', 'directional'], el: 'magic', range: 7, radius: 7, unlock: 5,
      steps: [step('pl_d', 0.75, [hit(0.35, cone(7, 60), 5.2, { stag: 24, el: 'magic', fx: 'holy', knock: 1.5, st: 'weaken', stp: 4, shake: 0.12 })], { cancel: 0.55, armor: 'push', track: true })],
    }),
    skill({
      id: 'pl_f', name: L('Освящённая земля', 'Consecrate'), desc: L('Меч вонзается в землю: 5 сек. святой круг жжёт врагов и лечит героя.', 'The sword is driven into the ground: for 5s a holy circle burns foes and heals the hero.'),
      icon: 'paladin_f', color: HOLY, cd: 14, type: 'normal', tags: ['aoe', 'defense'], el: 'magic', range: 0, radius: 3.6, unlock: 6,
      steps: [step('pl_f', 0.65, [zone(0.3, { at: 'self', r: 3.6, dur: 5, every: 0.5, dmg: 0.9, stag: 3, el: 'magic', vis: 'light', color: HOLY, heal: 0.01 })], { cancel: 0.45 })],
    }),
  ],
  ult: skill({
    id: 'pl_ult', name: L('Длань Небес', 'Hand of Heaven'), desc: L('Пробуждение: паладин взмывает в столпе света; огромная святая длань обрушивается вокруг, оглушая всех.', 'Awakening: the paladin rises in a pillar of light; a vast holy hand crashes down, stunning everything.'),
    icon: 'paladin_ult', color: HOLY, cd: 90, type: 'normal', tags: ['burst', 'aoe', 'control'], el: 'magic', range: 0, radius: 7, unlock: 8,
    steps: [step('pl_ult', 2.2, [
      fx(0.2, 'light', { color: HOLY, r: 8 }),
      zone(0.4, { at: 'self', r: 7, delay: 1.0, dmg: 18, stag: 140, el: 'magic', vis: 'light', color: HOLY, st: 'stun', stp: 2.5 }),
      buff(1.4, 6, { dr: 0.4, heal: 0.25, color: HOLY }),
    ], { iframes: [0, 2.0], armor: 'super', cancel: 1.9 })],
  }),
  identity: {
    kind: 'sanctuary', name: L('Святилище', 'Sanctuary'), desc: L('При полной вере: 8 сек. святой круг — внутри −40% входящего урона, лечение и замедление врагов.', 'At full faith: an 8s holy circle — inside, −40% damage taken, healing and slowed foes.'),
    icon: 'paladin_id', need: 100, dur: 8, color: HOLY,
    step: step('pl_identity', 0.6, [zone(0.3, { at: 'self', r: 5, dur: 8, every: 0.5, dmg: 0.3, el: 'magic', vis: 'aura', color: HOLY, ward: 0.4, heal: 0.012, st: 'slow', stp: 0.5 })], { iframes: [0, 0.6] }),
  },
};
