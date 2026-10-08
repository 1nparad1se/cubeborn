import { buff, command, fx, L, proj, skill, step, summon, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0x5ae0b0;
const SPIRIT = 0x8affd8;

/** Summoner — staff of spirits; wolves, golem, wisps, serpent and a drake fight for her. */
export const SUMMONER: ClassDef = {
  id: 'summoner',
  name: L('Призывательница', 'Summoner'),
  title: L('Хранительница Древних', 'Keeper of the Ancients'),
  desc: L(
    'Заклинательница духов с посохом. Призывает волков, каменного голема, огоньки, небесного змея и дракона, отдаёт им приказы (X) и поддерживает их чарами.',
    'A spirit caller with a staff. Summons wolves, a stone golem, wisps, a sky serpent and a drake, commands them (X) and supports them with charms.',
  ),
  role: L('Дальний бой · призыв', 'Ranged · summons'),
  difficulty: 2,
  weapon: L('Посох духов', 'Spirit staff'),
  ratings: { attack: 3, defense: 2, mobility: 2, control: 4, support: 4, range: 4 },
  passive: {
    name: L('Связь с духами', 'Spirit Bond'),
    desc: L('Призванные существа сильнее на 3% за каждый уровень героя. X — приказ атаковать врага у курсора.', 'Summons grow 3% stronger per hero level. X — order them to attack the foe at the cursor.'),
  },
  baseHp: 115,
  baseSpeed: 4.4,
  armor: 1,
  power: 8.5,
  color: C,
  res: {
    id: 'spirit', name: L('Дух', 'Spirit'), desc: L('Копится от атак призванных. Полная шкала — Древний (Z).', 'Builds from summon attacks. Full bar — Ancient (Z).'),
    color: '#6affc8', max: 100, regen: 1.5, onBasic: 2, onSkill: 2, onKill: 1.5, onHurt: 0,
  },
  basic: {
    name: L('Сфера духа', 'Spirit Orb'), desc: L('Посох выпускает сферу духа.', 'The staff fires a spirit orb.'),
    icon: 'summoner_basic', el: 'magic', ranged: true, window: 0.3,
    steps: [step('sm_basic', 0.45, [proj(0.2, { dmg: 1.1, stag: 3, el: 'magic', speed: 18, range: 11, r: 0.4, vis: 'spiritorb', color: SPIRIT })], { cancel: 0.28, move: 0.5, track: true })],
  },
  dodge: { name: L('Шаг духа', 'Spirit Step'), cd: 6, charges: 1, step: step('sm_dodge', 0.45, [{ do: 'move', t: 0, kind: 'dash', dist: 4.4, dur: 0.28, iframe: true }], { iframes: [0, 0.32] }) },
  skills: [
    skill({
      id: 'sm_q', name: L('Стая волков', 'Wolf Pack'), desc: L('Призывает двух духов-волков на 20 сек. Быстро бегают и кусают.', 'Summons two spirit wolves for 20s. Fast runners that bite.'),
      icon: 'summoner_q', color: SPIRIT, cd: 10, type: 'normal', tags: ['summon'], el: 'magic', range: 0, radius: 0, unlock: 1,
      steps: [step('sm_q', 0.55, [summon(0.3, 'wolf', 20, 1.4, { n: 2 })], { cancel: 0.36 })],
    }),
    skill({
      id: 'sm_w', name: L('Каменный голем', 'Stone Golem'), desc: L('Призывает голема на 25 сек.: медленный, отвлекает врагов и бьёт по площади.', 'Summons a golem for 25s: slow, draws foes and slams an area.'),
      icon: 'summoner_w', color: 0xb0a080, cd: 18, type: 'normal', tags: ['summon', 'defense'], el: 'phys', range: 6, radius: 2.4, unlock: 1,
      steps: [step('sm_w', 0.7, [summon(0.4, 'golem', 25, 3, { at: 'aim' }), fx(0.4, 'shake', { shake: 0.2 })], { cancel: 0.5 })],
    }),
    skill({
      id: 'sm_e', name: L('Рой огоньков', 'Wisp Swarm'), desc: L('Три огонька 15 сек. кружат вокруг героини и стреляют по врагам.', 'Three wisps circle the summoner for 15s and shoot foes.'),
      icon: 'summoner_e', color: 0x8ad8ff, cd: 12, type: 'normal', tags: ['summon', 'ranged'], el: 'lightning', range: 0, radius: 0, unlock: 1,
      steps: [step('sm_e', 0.5, [summon(0.25, 'wisp', 15, 0.9, { n: 3 })], { cancel: 0.32 })],
    }),
    skill({
      id: 'sm_r', name: L('Сфера душ', 'Soul Orb'), desc: L('Медленная сфера пробивает всех на пути и наносит урон снова и снова.', 'A slow orb that passes through foes, hurting them again and again.'),
      icon: 'summoner_r', color: SPIRIT, cd: 8, type: 'normal', tags: ['ranged', 'aoe'], el: 'magic', range: 10, radius: 1.2, unlock: 2,
      steps: [step('sm_r', 0.5, [proj(0.2, { dmg: 1.4, stag: 4, el: 'magic', speed: 6, range: 10, r: 1.2, pierce: -1, vis: 'soulorb', color: SPIRIT, st: 'slow', stp: 0.4 })], { cancel: 0.32, track: true })],
    }),
    skill({
      id: 'sm_a', name: L('Ледяной цветок', 'Frost Bloom'), desc: L('Под курсором распускается ледяной цветок и замораживает врагов.', 'An ice flower blooms at the cursor and freezes foes.'),
      icon: 'summoner_a', color: 0x8ae8ff, cd: 11, type: 'normal', tags: ['control', 'aoe'], el: 'ice', range: 9, radius: 2.8, unlock: 3,
      steps: [step('sm_a', 0.5, [zone(0.22, { at: 'aim', range: 9, r: 2.8, delay: 0.5, dmg: 3.4, stag: 26, el: 'ice', vis: 'ice', color: 0x8ae8ff, st: 'freeze', stp: 2 })], { cancel: 0.32, track: true })],
    }),
    skill({
      id: 'sm_s', name: L('Неистовство', 'Frenzy'), desc: L('Все призванные 8 сек. атакуют на 50% быстрее и сильнее, героиня лечится.', 'All summons attack 50% faster and harder for 8s; the summoner heals.'),
      icon: 'summoner_s', color: 0xff8a5a, cd: 18, type: 'normal', tags: ['buff', 'summon'], el: 'magic', range: 0, radius: 0, unlock: 4,
      steps: [step('sm_s', 0.5, [buff(0.2, 8, { summons: true, dmg: 0.5, atkSpeed: 0.5, heal: 0.08, color: 0xff8a5a }), fx(0.2, 'ring', { color: 0xff8a5a, r: 6 })], { cancel: 0.3 })],
    }),
    skill({
      id: 'sm_d', name: L('Терновые лозы', 'Thorn Vines'), desc: L('Лозы прорастают линией к курсору, опутывая и раня врагов.', 'Vines sprout in a line to the cursor, rooting and hurting foes.'),
      icon: 'summoner_d', color: 0x6aa83a, cd: 12, type: 'normal', tags: ['control', 'directional'], el: 'poison', range: 9, radius: 1.4, unlock: 5,
      steps: [step('sm_d', 0.55, [zone(0.24, { at: 'front', range: 9, r: 1.4, delay: 0.15, dur: 3, every: 0.5, dmg: 0.9, stag: 6, el: 'poison', vis: 'vines', color: 0x6aa83a, st: 'root', stp: 1.8, n: 5, spread: 0 })], { cancel: 0.36, track: true })],
    }),
    skill({
      id: 'sm_f', name: L('Небесный змей', 'Sky Serpent'), desc: L('Призывает змея на 12 сек., который пролетает над врагами, поражая их молниями.', 'Summons a serpent for 12s that flies over foes striking them with lightning.'),
      icon: 'summoner_f', color: 0x8ad8ff, cd: 20, type: 'normal', tags: ['summon', 'aoe'], el: 'lightning', range: 0, radius: 2, unlock: 6,
      steps: [step('sm_f', 0.65, [summon(0.35, 'serpent', 12, 2)], { cancel: 0.45 })],
    }),
  ],
  ult: skill({
    id: 'sm_ult', name: L('Пламенный Дракон', 'Flame Drake'), desc: L('Пробуждение: из портала вылетает огненный дракон, выжигает землю у курсора и сражается 15 сек.', 'Awakening: a fire drake bursts from a portal, scorches the ground at the cursor and fights for 15s.'),
    icon: 'summoner_ult', color: 0xff6a2a, cd: 90, type: 'normal', tags: ['burst', 'summon', 'aoe'], el: 'fire', range: 10, radius: 4.5, unlock: 8,
    steps: [step('sm_ult', 1.8, [
      fx(0.2, 'flash', { color: 0xff6a2a }),
      summon(0.6, 'drake', 15, 3, { at: 'aim' }),
      zone(0.8, { at: 'aim', range: 10, r: 4.5, delay: 0.3, dmg: 10, stag: 90, el: 'fire', vis: 'fire', color: 0xff6a2a, st: 'burn', stp: 8 }),
      zone(1.1, { at: 'aim', range: 10, r: 4, dur: 4, every: 0.5, dmg: 0.8, el: 'fire', vis: 'fire', color: 0xff6a2a }),
    ], { iframes: [0, 1.4], armor: 'super', cancel: 1.4 })],
  }),
  special: {
    name: L('Приказ', 'Command'), desc: L('Все призванные бросаются на врага у курсора и 4 сек. наносят +30% урона.', 'Every summon charges the foe at the cursor and deals +30% damage for 4s.'),
    icon: 'summoner_x', cd: 2,
    step: step('sm_command', 0.35, [command(0.1, 0.3)], { cancel: 0.15, move: 0.8 }),
  },
  identity: {
    kind: 'ancient', name: L('Древний', 'Ancient'), desc: L('При полном духе: древний страж-энт сражается 12 сек., сокрушая врагов вокруг.', 'At full spirit: an ancient treant guardian fights for 12s, crushing foes around it.'),
    icon: 'summoner_id', need: 100, dur: 12, color: SPIRIT,
    step: step('sm_identity', 0.6, [summon(0.3, 'ancient', 12, 4, { at: 'aim' }), command(0.3, 0.3)]),
  },
};
