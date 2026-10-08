import { buff, chain, circle, cone, fx, hit, L, move, proj, skill, step, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0xb05aff;
const FIRE = 0xff7a2a;
const ICE = 0x8ae8ff;
const BOLT = 0x8ad8ff;
const ARC = 0xd08aff;

/** Sorceress — fire, ice, lightning and arcane; cast-time spells with big burst. */
export const SORCERESS: ClassDef = {
  id: 'sorceress',
  name: L('Чародейка', 'Sorceress'),
  title: L('Владычица Четырёх Стихий', 'Mistress of Four Elements'),
  desc: L(
    'Маг огня, льда, молнии и чистой магии. Сильнейшие заклинания требуют времени на подготовку, но наносят огромный урон по площади. Хрупкая — держите дистанцию.',
    'A mage of fire, ice, lightning and arcane. The strongest spells need time to cast but deal huge area damage. Fragile — keep your distance.',
  ),
  role: L('Дальний бой · взрывной урон', 'Ranged · burst damage'),
  difficulty: 2,
  weapon: L('Посох и гримуар', 'Staff and grimoire'),
  ratings: { attack: 5, defense: 1, mobility: 3, control: 4, support: 1, range: 5 },
  passive: {
    name: L('Стихийный резонанс', 'Elemental Resonance'),
    desc: L('Лёд + молния — раскол (×2 урона); огонь по горящим — воспламенение. Заклинания с подготовкой +20% урона.', 'Ice + lightning shatters (×2 damage); fire on burning foes ignites. Cast-time spells +20% damage.'),
  },
  baseHp: 125,
  baseSpeed: 4.5,
  armor: 0,
  power: 11,
  color: C,
  res: {
    id: 'arcane', name: L('Чары', 'Arcana'), desc: L('Копятся от заклинаний. Полная шкала — Разрыв (Z).', 'Builds from spells. Full bar — Rupture (Z).'),
    color: '#c08aff', max: 100, regen: 1, onBasic: 2, onSkill: 4, onKill: 1, onHurt: 0,
  },
  basic: {
    name: L('Магическая стрела', 'Magic Bolt'), desc: L('Быстрая стрела чистой магии.', 'A quick bolt of pure magic.'),
    icon: 'sorceress_basic', el: 'magic', ranged: true, window: 0.3,
    steps: [step('so_basic', 0.4, [proj(0.16, { dmg: 1, stag: 3, el: 'magic', speed: 24, range: 12, r: 0.35, vis: 'arcanebolt', color: ARC })], { cancel: 0.24, move: 0.6, track: true })],
  },
  dodge: { name: L('Мерцание', 'Flicker'), cd: 6, charges: 1, step: step('so_dodge', 0.3, [move(0, 'blink', 5, 0.05, { iframe: true })], { iframes: [0, 0.3] }) },
  skills: [
    skill({
      id: 'so_q', name: L('Огненный шар', 'Fireball'), desc: L('Огненный шар взрывается при попадании и поджигает врагов.', 'A fireball that explodes on hit and sets foes ablaze.'),
      icon: 'sorceress_q', color: FIRE, cd: 4, type: 'normal', tags: ['ranged', 'aoe'], el: 'fire', range: 12, radius: 2.2, unlock: 1,
      steps: [step('so_q', 0.42, [proj(0.18, { dmg: 3.2, stag: 10, el: 'fire', speed: 18, range: 12, r: 0.5, explode: 2.2, vis: 'fireball', color: FIRE, st: 'burn', stp: 5 })], { cancel: 0.28, track: true })],
    }),
    skill({
      id: 'so_w', name: L('Телепорт', 'Blink'), desc: L('Мгновенный перенос к курсору, оставляющий вспышку магии.', 'An instant teleport to the cursor, leaving a magic flash.'),
      icon: 'sorceress_w', color: ARC, cd: 7, type: 'normal', tags: ['mobility'], el: 'magic', range: 7, radius: 2, unlock: 1,
      steps: [step('so_w', 0.3, [hit(0, circle(2), 1.2, { stag: 6, el: 'magic', fx: 'shock', knock: 1.5 }), move(0.04, 'blink', 7, 0.04, { iframe: true })], { cancel: 0.16 })],
    }),
    skill({
      id: 'so_e', name: L('Ледяное копьё', 'Frost Lance'), desc: L('Копьё льда пробивает линию врагов и замораживает их.', 'A lance of ice pierces a line of foes and freezes them.'),
      icon: 'sorceress_e', color: ICE, cd: 7, type: 'normal', tags: ['ranged', 'control', 'directional'], el: 'ice', range: 13, radius: 0.7, unlock: 1,
      steps: [step('so_e', 0.5, [proj(0.22, { dmg: 3.4, stag: 18, el: 'ice', speed: 30, range: 13, r: 0.7, pierce: -1, vis: 'frostlance', color: ICE, st: 'freeze', stp: 1.6 })], { cancel: 0.34, track: true })],
    }),
    skill({
      id: 'so_r', name: L('Метеор', 'Meteor'), desc: L('Подготовка 1 сек., затем огромный метеор падает у курсора.', 'A 1s cast, then a huge meteor crashes at the cursor.'),
      icon: 'sorceress_r', color: FIRE, cd: 12, type: 'cast', castTime: 1, tags: ['aoe', 'burst'], el: 'fire', range: 11, radius: 3.4, unlock: 2,
      steps: [step('so_r', 0.6, [zone(0.1, { at: 'aim', range: 11, r: 3.4, delay: 0.6, dmg: 9, stag: 40, el: 'fire', vis: 'meteor', color: FIRE, st: 'burn', stp: 8, knock: 2 })], { cancel: 0.4 })],
    }),
    skill({
      id: 'so_a', name: L('Цепная молния', 'Chain Lightning'), desc: L('Молния бьёт врага у курсора и перескакивает ещё на пятерых.', 'Lightning strikes the foe at the cursor and leaps to five more.'),
      icon: 'sorceress_a', color: BOLT, cd: 6, type: 'normal', tags: ['ranged'], el: 'lightning', range: 11, radius: 5, unlock: 3,
      steps: [step('so_a', 0.4, [chain(0.16, { n: 6, range: 11, jump: 5, dmg: 3, stag: 10, el: 'lightning', color: BOLT, st: 'stun', stp: 0.3 })], { cancel: 0.26, track: true })],
    }),
    skill({
      id: 'so_s', name: L('Ледяная вспышка', 'Frost Nova'), desc: L('Волна холода вокруг замораживает всех рядом.', 'A wave of cold around you freezes everything nearby.'),
      icon: 'sorceress_s', color: ICE, cd: 11, type: 'normal', tags: ['aoe', 'control', 'defense'], el: 'ice', range: 0, radius: 3.6, unlock: 4,
      steps: [step('so_s', 0.45, [hit(0.2, circle(3.6), 2.4, { stag: 20, el: 'ice', fx: 'ice', st: 'freeze', stp: 2, knock: 1 })], { cancel: 0.3 })],
    }),
    skill({
      id: 'so_d', name: L('Гроза', 'Thunderstorm'), desc: L('Подготовка 0.6 сек.: грозовая туча 5 сек. бьёт молниями врагов под ней.', 'A 0.6s cast: a storm cloud strikes foes beneath it with lightning for 5s.'),
      icon: 'sorceress_d', color: BOLT, cd: 14, type: 'cast', castTime: 0.6, tags: ['aoe', 'ranged'], el: 'lightning', range: 10, radius: 4, unlock: 5,
      steps: [step('so_d', 0.45, [zone(0.1, { at: 'aim', range: 10, r: 4, delay: 0.2, dur: 5, every: 0.3, dmg: 1.8, stag: 6, el: 'lightning', vis: 'storm', color: BOLT })], { cancel: 0.28 })],
    }),
    skill({
      id: 'so_f', name: L('Чародейский взрыв', 'Arcane Burst'), desc: L('Удерживайте для накопления силы (до 1.5 сек.), отпустите — конус чистой магии.', 'Hold to gather power (up to 1.5s), release — a cone of pure magic.'),
      icon: 'sorceress_f', color: ARC, cd: 10, type: 'charge', chargeMax: 1.5, chargeMul: 2.6, tags: ['aoe', 'charge', 'burst'], el: 'magic', range: 7, radius: 7, unlock: 6,
      steps: [step('so_f', 0.5, [hit(0.12, cone(7, 70), 5.6, { stag: 30, el: 'magic', fx: 'shock', knock: 2.4, shake: 0.2 })], { cancel: 0.32, armor: 'push' })],
    }),
  ],
  ult: skill({
    id: 'so_ult', name: L('Звездопад', 'Starfall'), desc: L('Пробуждение: долгая подготовка, затем с неба падают двенадцать звёзд по огромной области.', 'Awakening: a long cast, then twelve stars fall across a huge area.'),
    icon: 'sorceress_ult', color: ARC, cd: 90, type: 'cast', castTime: 1.4, tags: ['burst', 'aoe'], el: 'magic', range: 11, radius: 6.5, unlock: 8,
    steps: [step('so_ult', 1.6, [
      fx(0, 'light', { color: ARC, r: 8 }),
      zone(0.1, { at: 'aim', range: 11, r: 2.4, delay: 0.5, dmg: 6, stag: 18, el: 'magic', vis: 'meteor', color: ARC, n: 12, spread: 5.5, knock: 1.4 }),
      zone(0.1, { at: 'aim', range: 11, r: 6.5, delay: 1.4, dmg: 8, stag: 60, el: 'magic', vis: 'light', color: ARC }),
    ], { iframes: [0, 1.2], armor: 'super', cancel: 1.2 })],
  }),
  identity: {
    kind: 'rupture', name: L('Разрыв', 'Rupture'), desc: L('При полных чарах: 8 сек. все заклинания без подготовки, перезарядка в 2 раза быстрее, +15% урона.', 'At full arcana: for 8s all spells cast instantly, cooldowns tick twice as fast, +15% damage.'),
    icon: 'sorceress_id', need: 100, dur: 8, color: ARC,
    step: step('so_identity', 0.45, [buff(0.15, 8, { dmg: 0.15, color: ARC }), fx(0.15, 'burst', { color: ARC, r: 3 })], { iframes: [0, 0.45] }),
  },
};
