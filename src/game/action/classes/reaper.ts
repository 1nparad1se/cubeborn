import { buff, circle, cone, fx, hit, L, move, proj, rect, skill, step, summon, zone } from '../dsl';
import type { ClassDef } from '../types';

const C = 0x7a4aff;
const SHADOW = 0x9a6aff;
const TOXIC = 0x9cff4f;

/** Reaper — dagger and shadow, stealth, teleports and constant repositioning. */
export const REAPER: ClassDef = {
  id: 'reaper',
  name: L('Жнец', 'Reaper'),
  title: L('Безмолвная Тьма', 'The Silent Dark'),
  desc: L(
    'Тень с кинжалом. Уходит в невидимость, телепортируется, бьёт в спину тёмной энергией и всё время меняет позицию. Выход из тени — сокрушительный удар.',
    'A shadow with a dagger. Vanishes into stealth, teleports, strikes the back with dark energy and keeps repositioning. Leaving the shadows is a crushing blow.',
  ),
  role: L('Ближний бой · скрытность и рывки', 'Melee · stealth and blinks'),
  difficulty: 3,
  weapon: L('Кинжал жнеца', "Reaper's dagger"),
  ratings: { attack: 5, defense: 1, mobility: 5, control: 2, support: 1, range: 2 },
  passive: {
    name: L('Из тени', 'From the Shadow'),
    desc: L('Первый удар из невидимости наносит +80% урона и всегда крит. Удары со спины +30%.', 'The first hit from stealth deals +80% damage and always crits. Back attacks +30%.'),
  },
  baseHp: 110,
  baseSpeed: 5.1,
  armor: 1,
  power: 9.5,
  color: C,
  res: {
    id: 'shadow', name: L('Тень', 'Shadow'), desc: L('Копится от ударов в спину и навыков. Полная шкала — Личина (Z).', 'Builds from back attacks and skills. Full bar — Persona (Z).'),
    color: '#9a6aff', max: 100, regen: 0, onBasic: 2.5, onSkill: 4, onKill: 2, onHurt: 0,
  },
  basic: {
    name: L('Тенистые уколы', 'Shade Stabs'), desc: L('Три быстрых удара кинжалом; последний оставляет тёмный след.', 'Three quick dagger stabs; the last leaves a dark trail.'),
    icon: 'reaper_basic', el: 'phys', ranged: false, window: 0.35,
    steps: [
      step('rp_basic1', 0.3, [hit(0.12, cone(2.3, 100), 0.8, { stag: 3, fx: 'thrust', backMul: 1.3 })], { cancel: 0.18, move: 0.35, track: true }),
      step('rp_basic2', 0.3, [hit(0.12, cone(2.3, 100), 0.8, { stag: 3, fx: 'thrust', backMul: 1.3 })], { cancel: 0.18, move: 0.35, track: true }),
      step('rp_basic3', 0.42, [hit(0.18, cone(2.6, 140), 1.3, { stag: 6, fx: 'dark', el: 'dark', backMul: 1.3 })], { cancel: 0.26, move: 0.25, track: true }),
    ],
  },
  dodge: { name: L('Растворение', 'Dissolve'), cd: 4, charges: 2, step: step('rp_dodge', 0.34, [move(0, 'dash', 5, 0.18, { iframe: true })], { iframes: [0, 0.26] }) },
  skills: [
    skill({
      id: 'rp_q', name: L('Мрачный разрез', 'Grim Slash'), desc: L('Два удара: разрез и прокол насквозь с тёмной вспышкой.', 'Two blows: a slash and a thrust through with a dark burst.'),
      icon: 'reaper_q', color: SHADOW, cd: 4, type: 'combo', window: 0.6, tags: ['melee', 'combo', 'back'], el: 'dark', range: 3.6, radius: 2.6, unlock: 1,
      steps: [
        step('rp_q1', 0.3, [hit(0.12, cone(2.6, 130), 2, { stag: 7, fx: 'dark', el: 'dark', backMul: 1.4 })], { cancel: 0.18, track: true }),
        step('rp_q2', 0.42, [move(0.02, 'dash', 1.4, 0.1), hit(0.16, rect(3.6, 1.4), 3.2, { stag: 12, fx: 'dark', el: 'dark', backMul: 1.4 })], { cancel: 0.28, track: true }),
      ],
    }),
    skill({
      id: 'rp_w', name: L('Шаг тени', 'Shadow Step'), desc: L('Телепорт к курсору; на старом месте остаётся тень-двойник, взрывающаяся через 1 сек.', 'Teleport to the cursor; a shadow double is left behind and explodes after 1s.'),
      icon: 'reaper_w', color: C, cd: 7, type: 'normal', tags: ['mobility', 'aoe'], el: 'dark', range: 7, radius: 2.6, unlock: 1,
      steps: [step('rp_w', 0.35, [summon(0, 'clone', 1, 4), move(0.04, 'blink', 7, 0.04, { iframe: true })], { cancel: 0.2 })],
    }),
    skill({
      id: 'rp_e', name: L('Ядовитый туман', 'Toxic Mist'), desc: L('Облако яда вокруг героя; внутри герой уходит в невидимость на 2 сек.', 'A poison cloud around the hero; inside, the hero turns invisible for 2s.'),
      icon: 'reaper_e', color: TOXIC, cd: 12, type: 'normal', tags: ['aoe', 'defense'], el: 'poison', range: 0, radius: 3.2, unlock: 1,
      steps: [step('rp_e', 0.45, [zone(0.18, { at: 'self', r: 3.2, dur: 4, every: 0.5, dmg: 0.8, el: 'poison', vis: 'poison', color: TOXIC, st: 'poison', stp: 5 }), buff(0.2, 2, { stealth: true, color: SHADOW })], { cancel: 0.25 })],
    }),
    skill({
      id: 'rp_r', name: L('Засада', 'Ambush'), desc: L('Исчезает и появляется за спиной врага у курсора с тяжёлым ударом.', 'Vanishes and appears behind the foe at the cursor with a heavy strike.'),
      icon: 'reaper_r', color: C, cd: 9, type: 'normal', tags: ['mobility', 'burst', 'back'], el: 'dark', range: 9, radius: 2.4, unlock: 2,
      note: L('Со спины ×1.7.', '×1.7 from behind.'),
      steps: [step('rp_r', 0.6, [move(0.05, 'behind', 9, 0.08, { iframe: true }), hit(0.24, cone(2.6, 160), 5.6, { stag: 22, fx: 'dark', el: 'dark', backMul: 1.7, shake: 0.15, sfx: 'shadow' })], { cancel: 0.42 })],
    }),
    skill({
      id: 'rp_a', name: L('Танец смерти', 'Death Dance'), desc: L('Кружится, нанося серию порезов по кругу и перемещаясь вперёд.', 'Spins through a series of cuts all around while moving forward.'),
      icon: 'reaper_a', color: SHADOW, cd: 8, type: 'normal', tags: ['aoe', 'mobility'], el: 'dark', range: 4, radius: 2.6, unlock: 3,
      steps: [step('rp_a', 0.75, [move(0.05, 'dash', 4, 0.55), hit(0.1, circle(2.6), 1.4, { stag: 5, fx: 'spin', el: 'dark', n: 4, every: 0.13, backMul: 1.3 })], { cancel: 0.58, armor: 'push' })],
    }),
    skill({
      id: 'rp_s', name: L('Тёмная коса', 'Dark Scythe'), desc: L('Широкий взмах призрачной косой из тьмы, проклинающий врагов.', 'A wide sweep of a phantom scythe of darkness that curses foes.'),
      icon: 'reaper_s', color: C, cd: 10, type: 'normal', tags: ['aoe', 'control'], el: 'dark', range: 4.4, radius: 4.4, unlock: 4,
      steps: [step('rp_s', 0.6, [hit(0.28, cone(4.4, 200), 4.4, { stag: 18, fx: 'dark', el: 'dark', st: 'curse', stp: 5, knock: 1.2, shake: 0.12 })], { cancel: 0.42, track: true })],
    }),
    skill({
      id: 'rp_d', name: L('Призрачные клинки', 'Phantom Blades'), desc: L('Выпускает три теневых клинка, наводящихся на ближайших врагов.', 'Releases three shadow blades that home in on nearby foes.'),
      icon: 'reaper_d', color: SHADOW, cd: 7, type: 'normal', tags: ['ranged'], el: 'dark', range: 10, radius: 0.5, unlock: 5,
      steps: [step('rp_d', 0.4, [proj(0.14, { dmg: 2.6, stag: 8, el: 'dark', n: 3, spread: 50, speed: 15, range: 10, r: 0.5, vis: 'shadowblade', color: SHADOW, seek: true })], { cancel: 0.26, track: true })],
    }),
    skill({
      id: 'rp_f', name: L('Исчезновение', 'Vanish'), desc: L('Отскок назад и невидимость на 3 сек. Следующий удар — из тени.', 'Leap back and turn invisible for 3s. The next hit comes from the shadow.'),
      icon: 'reaper_f', color: C, cd: 14, type: 'normal', tags: ['mobility', 'defense'], el: 'dark', range: 4, radius: 0, unlock: 6,
      steps: [step('rp_f', 0.4, [move(0.02, 'back', 4, 0.22, { iframe: true }), buff(0.2, 3, { stealth: true, speed: 0.25, color: SHADOW }), fx(0.02, 'burst', { color: SHADOW, r: 1.5 })], { cancel: 0.24 })],
    }),
  ],
  ult: skill({
    id: 'rp_ult', name: L('Жатва душ', 'Soul Harvest'), desc: L('Пробуждение: жнец призывает гигантскую косу тьмы, которая пожинает всё вокруг и вытягивает души, а затем взрывается.', 'Awakening: the reaper calls a giant scythe of darkness that reaps everything around, draws souls in and explodes.'),
    icon: 'reaper_ult', color: C, cd: 80, type: 'normal', tags: ['burst', 'aoe'], el: 'dark', range: 0, radius: 6, unlock: 8,
    steps: [step('rp_ult', 2.1, [
      buff(0, 2.1, { stealth: true }),
      hit(0.35, circle(6), 3, { stag: 20, el: 'dark', fx: 'dark', pull: 4, n: 3, every: 0.3 }),
      hit(1.5, circle(6), 15, { stag: 120, el: 'dark', fx: 'dark', shake: 0.7, knock: 2.4, st: 'curse', stp: 6, sfx: 'shadow' }),
    ], { iframes: [0, 1.8], armor: 'super', cancel: 1.8 })],
  }),
  identity: {
    kind: 'persona', name: L('Личина', 'Persona'), desc: L('При полной тени: 6 сек. невидимость и +30% скорости. Выход из тени — мощный удар со спины.', 'At full shadow: 6s of stealth and +30% speed. Leaving it — a mighty back strike.'),
    icon: 'reaper_id', need: 100, dur: 6, color: SHADOW,
    step: step('rp_identity', 0.4, [buff(0.1, 6, { stealth: true, speed: 0.3, dmg: 0.2, color: SHADOW }), fx(0.1, 'burst', { color: SHADOW, r: 2 })], { iframes: [0, 0.4] }),
  },
};
