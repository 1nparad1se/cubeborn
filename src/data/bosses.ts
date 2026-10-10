import type { BossDef, RelicDef } from './types';

const nm = (ru: string, en: string) => ({ ru, en });

/**
 * Bosses fight the hero one on one inside an arena (src/game/bosses/BossArena.ts). Each one is a
 * big original voxel creature with 5–7 telegraphed skills (src/game/bosses/BossAttacks.ts):
 * slams with shock rings, sweeps, charges, leaps, stunning roars, volleys, eruptions, beams,
 * gravity wells and blinks. Every boss has at least one stun and one knockback; enrage phases at
 * 50% and 25% health add new moves. `hp` / `damage` are relative: the absolute numbers follow the
 * monster level (config/bossTuning.ts). Skill params: range/min = gap to the hero at which it is
 * used, wind = wind-up seconds, m = damage multiplier, stun = seconds, kb = knockback speed.
 */
export const BOSSES: BossDef[] = [
  // ------------------------------------------------------------ Blightwood
  {
    id: 'spore_mother', name: { ru: 'Мать спор', en: 'Spore Mother' }, title: { ru: 'Сердце гнили', en: 'Heart of Rot' },
    hp: 1, damage: 1, radius: 2.6, height: 7.2, model: 'spore_mother', color: 0xc05ad6, relic: 'spore_sac',
    phases: [
      { hp: 1, move: 'chase', speed: 1.7, attacks: [
        { type: 'smash', cd: 6, name: nm('Удар шляпкой', 'Cap Slam'), range: 4, r: 4.2, m: 1.4, kb: 11, rings: 1, ringR: 11, wind: 1.15 },
        { type: 'erupt', cd: 7, name: nm('Споровый взрыв', 'Spore Burst'), pattern: 'scatter', count: 6, r: 2, spread: 6, m: 0.8, fx: 'poison', pool: 3, wind: 0.9 },
        { type: 'volley', cd: 5, name: nm('Дождь дождевиков', 'Puffball Volley'), min: 3, count: 5, spread: 50, bursts: 2, delay: 0.45, speed: 7.5, m: 0.4, size: 0.5 },
        { type: 'roar', cd: 13, name: nm('Удушливое облако', 'Choking Cloud'), range: 6, r: 7.5, stun: 1.5, wind: 1.3, fx: 'poison' },
      ] },
      { hp: 0.5, move: 'chase', speed: 2, enrage: true, gap: 0.9, attacks: [
        { type: 'smash', cd: 5.5, name: nm('Удар шляпкой', 'Cap Slam'), range: 4, r: 4.4, m: 1.4, kb: 12, rings: 2, ringR: 12, wind: 1.05 },
        { type: 'erupt', cd: 6, name: nm('Корни-душители', 'Strangling Roots'), pattern: 'line', count: 7, r: 1.7, step: 0.1, m: 1.0, stun: 1.2, wind: 0.8 },
        { type: 'erupt', cd: 8, name: nm('Споровый взрыв', 'Spore Burst'), pattern: 'scatter', count: 8, r: 2, spread: 7, m: 0.8, fx: 'poison', pool: 3, wind: 0.85 },
        { type: 'spiral', cd: 10, name: nm('Споровый вихрь', 'Spore Whirl'), arms: 4, speed: 5.5, duration: 3, rate: 7, turn: 70, m: 0.35 },
        { type: 'roar', cd: 12, name: nm('Удушливое облако', 'Choking Cloud'), range: 6, r: 8, stun: 1.6, wind: 1.2 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.2, enrage: true, gap: 0.75, attacks: [
        { type: 'leap', cd: 7, name: nm('Падение грибницы', 'Mycelium Drop'), min: 2, r: 4, outer: 1.8, m: 1.5, stun: 1.3, kb: 10, wind: 1.0 },
        { type: 'erupt', cd: 6, name: nm('Корни-душители', 'Strangling Roots'), pattern: 'fan', lines: 3, spread: 60, count: 6, r: 1.6, step: 0.1, m: 1.0, stun: 1.2, wind: 0.8 },
        { type: 'smash', cd: 5, name: nm('Удар шляпкой', 'Cap Slam'), range: 4, r: 4.6, m: 1.5, kb: 12, rings: 2, ringR: 13, wind: 0.95 },
        { type: 'nova', cd: 6, name: nm('Споровая волна', 'Spore Wave'), count: 18, waves: 3, delay: 0.4, rotate: 10, speed: 6, m: 0.35 },
        { type: 'erupt', cd: 8, name: nm('Споровый взрыв', 'Spore Burst'), pattern: 'scatter', count: 10, r: 2, spread: 8, m: 0.8, fx: 'poison', pool: 3, wind: 0.8 },
      ] },
    ],
  },
  {
    id: 'rotroot', name: { ru: 'Гнилокорень', en: 'Rotroot' }, title: { ru: 'Старейшина чащи', en: 'Elder of the Thicket' },
    hp: 1.35, damage: 1.12, radius: 3.0, height: 9.5, model: 'rotroot', color: 0x8fc83a, relic: 'heartwood',
    phases: [
      { hp: 1, move: 'chase', speed: 1.5, attacks: [
        { type: 'smash', cd: 6, name: nm('Корневой удар', 'Root Slam'), range: 4.5, r: 4.5, m: 1.5, stun: 1.3, rings: 1, ringR: 12, wind: 1.25 },
        { type: 'sweep', cd: 5, name: nm('Терновый взмах', 'Thorn Sweep'), range: 5, r: 7.5, arc: 170, m: 1.2, kb: 13, wind: 1.0 },
        { type: 'erupt', cd: 6, name: nm('Терновая тропа', 'Bramble Path'), pattern: 'line', count: 8, r: 1.6, step: 0.09, m: 0.9, wind: 0.85 },
        { type: 'beam', cd: 11, name: nm('Луч гнили', 'Heartrot Beam'), min: 3, aim: 1, sweep: 80, length: 16, width: 1.6, dur: 2.2, m: 0.32, wind: 1.1 },
        { type: 'roar', cd: 14, name: nm('Зов старейшины', 'Elder Call'), range: 6, r: 8.5, stun: 1.6, wind: 1.35 },
      ] },
      { hp: 0.5, move: 'chase', speed: 1.8, enrage: true, gap: 0.9, attacks: [
        { type: 'sweep', cd: 5, name: nm('Двойной взмах', 'Double Sweep'), range: 5, r: 7.5, arc: 180, hits: 2, m: 1.2, kb: 13, wind: 0.95 },
        { type: 'vortex', cd: 11, name: nm('Хватка лоз', 'Vine Grasp'), r: 5.5, strength: 3.2, dur: 2.2, m: 1.4, stun: 1.0 },
        { type: 'erupt', cd: 7, name: nm('Дождь семян', 'Seed Storm'), pattern: 'scatter', count: 9, r: 2, spread: 8, m: 0.9, rock: 1, fx: 'poison', wind: 1.0 },
        { type: 'smash', cd: 6, name: nm('Корневой удар', 'Root Slam'), range: 4.5, r: 4.8, m: 1.5, stun: 1.3, rings: 2, ringR: 13, wind: 1.1 },
        { type: 'beam', cd: 10, name: nm('Луч гнили', 'Heartrot Beam'), min: 3, aim: 1, sweep: 100, length: 17, width: 1.6, dur: 2.4, m: 0.32, wind: 1.0 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.1, enrage: true, gap: 0.7, attacks: [
        { type: 'erupt', cd: 6, name: nm('Терновый крест', 'Thorn Cross'), pattern: 'cross', count: 6, r: 1.7, step: 0.08, m: 1.0, stun: 1.0, wind: 0.85 },
        { type: 'leap', cd: 8, name: nm('Падение древа', 'Treefall'), min: 2, r: 4.5, outer: 1.8, m: 1.7, stun: 1.4, kb: 12, wind: 1.1 },
        { type: 'sweep', cd: 5, name: nm('Двойной взмах', 'Double Sweep'), range: 5, r: 8, arc: 190, hits: 2, m: 1.25, kb: 14, wind: 0.9 },
        { type: 'nova', cd: 6, name: nm('Шипы', 'Thorn Burst'), count: 22, waves: 3, delay: 0.35, rotate: 8, speed: 6.5, m: 0.35 },
        { type: 'vortex', cd: 10, name: nm('Хватка лоз', 'Vine Grasp'), r: 6, strength: 3.5, dur: 2, m: 1.5, stun: 1.1 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Gloamhaven
  {
    id: 'rat_tyrant', name: { ru: 'Крысиный тиран', en: 'Rat Tyrant' }, title: { ru: 'Король сточных канав', en: 'King of the Gutters' },
    hp: 1, damage: 1, radius: 2.7, height: 5.8, model: 'rat_tyrant', color: 0xc8a050, relic: 'gutter_crown',
    phases: [
      { hp: 1, move: 'chase', speed: 2.6, attacks: [
        { type: 'charge', cd: 6, name: nm('Бросок по канаве', 'Gutter Rush'), min: 3, count: 2, speed: 17, len: 18, m: 1.4, kb: 13, wind: 0.95, wind2: 0.6 },
        { type: 'sweep', cd: 5, name: nm('Удар хвостом', 'Tail Lash'), range: 4.5, r: 7, arc: 220, m: 1.1, kb: 14, wind: 0.85 },
        { type: 'volley', cd: 5, name: nm('Чумной плевок', 'Plague Spit'), min: 2, count: 5, spread: 40, bursts: 2, delay: 0.35, speed: 9, m: 0.4, color: 0x9aff4a },
        { type: 'leap', cd: 9, name: nm('Прыжок тирана', 'Tyrant Pounce'), min: 3, r: 3.6, outer: 1.8, m: 1.5, stun: 1.3, kb: 10, wind: 0.9 },
      ] },
      { hp: 0.5, move: 'chase', speed: 3, enrage: true, gap: 0.8, attacks: [
        { type: 'charge', cd: 6, name: nm('Бешеный бросок', 'Frenzied Rush'), min: 2, count: 3, speed: 19, len: 20, m: 1.4, kb: 14, wind: 0.85, wind2: 0.5 },
        { type: 'erupt', cd: 7, name: nm('Чумные лужи', 'Plague Pools'), pattern: 'scatter', count: 7, r: 2, spread: 7, m: 0.7, fx: 'poison', pool: 4, wind: 0.85 },
        { type: 'sweep', cd: 5, name: nm('Удар хвостом', 'Tail Lash'), range: 4.5, r: 7.5, arc: 240, hits: 2, m: 1.1, kb: 14, wind: 0.8 },
        { type: 'roar', cd: 12, name: nm('Писк тирана', 'Tyrant Screech'), range: 5, r: 7.5, stun: 1.5, wind: 1.1 },
        { type: 'leap', cd: 8, name: nm('Прыжок тирана', 'Tyrant Pounce'), min: 3, r: 3.8, outer: 1.8, m: 1.5, stun: 1.3, kb: 10, wind: 0.85 },
      ] },
      { hp: 0.25, move: 'chase', speed: 3.3, enrage: true, gap: 0.65, attacks: [
        { type: 'charge', cd: 5, name: nm('Бешеный бросок', 'Frenzied Rush'), min: 2, count: 4, speed: 20, len: 20, m: 1.4, kb: 14, wind: 0.75, wind2: 0.45 },
        { type: 'nova', cd: 6, name: nm('Чумная волна', 'Plague Wave'), count: 20, waves: 2, delay: 0.4, rotate: 9, speed: 6.5, m: 0.38, color: 0x9aff4a },
        { type: 'erupt', cd: 7, name: nm('Чумные лужи', 'Plague Pools'), pattern: 'ring', count: 8, dist: 5, rings2: 2, r: 2, step: 0.04, m: 0.8, fx: 'poison', pool: 3, wind: 0.85 },
        { type: 'sweep', cd: 4.5, name: nm('Удар хвостом', 'Tail Lash'), range: 4.5, r: 7.5, arc: 240, hits: 2, m: 1.15, kb: 15, wind: 0.75 },
      ] },
    ],
  },
  {
    id: 'bellwarden', name: { ru: 'Колоколоносец', en: 'Bellwarden' }, title: { ru: 'Глас пустых улиц', en: 'Voice of Empty Streets' },
    hp: 1.35, damage: 1.12, radius: 2.8, height: 9, model: 'bellwarden', color: 0xffa040, relic: 'silent_bell', flying: true,
    phases: [
      { hp: 1, move: 'chase', speed: 2.1, attacks: [
        { type: 'roar', cd: 11, name: nm('Набатный звон', 'Tolling Knell'), range: 7, r: 9, stun: 1.7, wind: 1.4, m: 0.4 },
        { type: 'smash', cd: 6, name: nm('Удар колоколом', 'Bell Crash'), range: 4.5, r: 4.4, m: 1.5, kb: 12, rings: 2, ringR: 13, wind: 1.15 },
        { type: 'sweep', cd: 6, name: nm('Порыв крыльев', 'Wing Gust'), range: 6, r: 9, arc: 120, m: 0.7, kb: 18, wind: 0.9 },
        { type: 'volley', cd: 5, name: nm('Эхо-снаряды', 'Echo Bolts'), min: 3, count: 3, spread: 24, bursts: 3, delay: 0.28, speed: 10, m: 0.4 },
        { type: 'blink', cd: 10, name: nm('Пикирование горгульи', 'Gargoyle Dive'), min: 5, r: 4, m: 1.4, stun: 1.0, wind: 0.6, hide: 0.7 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.4, enrage: true, gap: 0.9, attacks: [
        { type: 'smash', cd: 5.5, name: nm('Удар колоколом', 'Bell Crash'), range: 4.5, r: 4.6, m: 1.5, kb: 12, rings: 3, ringR: 14, wind: 1.05 },
        { type: 'nova', cd: 7, name: nm('Реквием', 'Requiem'), count: 20, waves: 3, delay: 0.4, rotate: 9, speed: 6, m: 0.38 },
        { type: 'roar', cd: 10, name: nm('Набатный звон', 'Tolling Knell'), range: 7, r: 9.5, stun: 1.8, wind: 1.3, m: 0.4 },
        { type: 'blink', cd: 8, name: nm('Пикирование горгульи', 'Gargoyle Dive'), min: 4, r: 4.2, m: 1.4, stun: 1.0, wind: 0.55, hide: 0.65 },
        { type: 'sweep', cd: 6, name: nm('Порыв крыльев', 'Wing Gust'), range: 6, r: 9.5, arc: 130, m: 0.7, kb: 18, wind: 0.85 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.6, enrage: true, gap: 0.7, attacks: [
        { type: 'spiral', cd: 8, name: nm('Похоронный звон', 'Death Knell'), arms: 5, speed: 6, duration: 3, rate: 9, turn: -95, m: 0.35 },
        { type: 'erupt', cd: 6, name: nm('Падающие колокола', 'Falling Bells'), pattern: 'scatter', count: 9, r: 2.2, spread: 8, m: 1.0, rock: 1, stun: 0.8, wind: 1.0 },
        { type: 'smash', cd: 5, name: nm('Удар колоколом', 'Bell Crash'), range: 4.5, r: 4.8, m: 1.6, kb: 13, rings: 3, ringR: 15, wind: 0.95 },
        { type: 'roar', cd: 9, name: nm('Набатный звон', 'Tolling Knell'), range: 7, r: 10, stun: 1.8, wind: 1.2, m: 0.45 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Ossuary Depths
  {
    id: 'bone_colossus', name: { ru: 'Костяной колосс', en: 'Bone Colossus' }, title: { ru: 'Собранный из тысячи', en: 'Built of a Thousand' },
    hp: 1, damage: 1, radius: 2.8, height: 8.6, model: 'bone_colossus', color: 0x6affc8, relic: 'colossus_marrow',
    phases: [
      { hp: 1, move: 'chase', speed: 1.6, attacks: [
        { type: 'smash', cd: 6, name: nm('Костяная дубина', 'Bone Club'), range: 4.5, r: 4.3, m: 1.6, stun: 1.4, rings: 1, ringR: 11, wind: 1.25 },
        { type: 'sweep', cd: 5, name: nm('Размах бедром', 'Femur Sweep'), range: 5, r: 7.5, arc: 170, m: 1.2, kb: 14, wind: 0.95 },
        { type: 'erupt', cd: 6, name: nm('Костяные копья', 'Bone Spears'), pattern: 'line', count: 8, r: 1.5, step: 0.08, m: 0.9, wind: 0.85 },
        { type: 'volley', cd: 5, name: nm('Залп рёбрами', 'Rib Volley'), min: 3, count: 7, spread: 60, bursts: 1, delay: 0.3, speed: 8.5, m: 0.42, color: 0xe6dcc0 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2, enrage: true, gap: 0.85, attacks: [
        { type: 'charge', cd: 7, name: nm('Поступь колосса', 'Colossus March'), min: 3, count: 2, speed: 14, len: 18, m: 1.5, kb: 14, wind: 1.0, wind2: 0.7 },
        { type: 'smash', cd: 5.5, name: nm('Могильный толчок', 'Grave Quake'), range: 4.5, r: 4.5, at: 'boss', m: 1.5, stun: 1.2, rings: 3, ringR: 14, wind: 1.15 },
        { type: 'erupt', cd: 6, name: nm('Костяные копья', 'Bone Spears'), pattern: 'fan', lines: 3, spread: 50, count: 7, r: 1.5, step: 0.08, m: 0.9, wind: 0.8 },
        { type: 'sweep', cd: 5, name: nm('Размах бедром', 'Femur Sweep'), range: 5, r: 8, arc: 180, hits: 2, m: 1.2, kb: 14, wind: 0.9 },
        { type: 'roar', cd: 13, name: nm('Хруст тысячи костей', 'Thousand Bones'), range: 6, r: 8, stun: 1.5, wind: 1.3 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.3, enrage: true, gap: 0.7, attacks: [
        { type: 'leap', cd: 8, name: nm('Падение колосса', 'Colossus Fall'), min: 2, r: 4.5, outer: 1.8, m: 1.7, stun: 1.4, kb: 12, wind: 1.05 },
        { type: 'nova', cd: 6, name: nm('Буря костей', 'Bone Storm'), count: 24, waves: 2, delay: 0.4, rotate: 7, speed: 6.5, m: 0.38, color: 0xe6dcc0 },
        { type: 'smash', cd: 5, name: nm('Могильный толчок', 'Grave Quake'), range: 4.5, r: 4.6, at: 'boss', m: 1.5, stun: 1.2, rings: 3, ringR: 15, wind: 1.0 },
        { type: 'erupt', cd: 6, name: nm('Костяной крест', 'Bone Cross'), pattern: 'cross', count: 6, r: 1.6, step: 0.08, m: 1.0, kb: 9, wind: 0.85 },
      ] },
    ],
  },
  {
    id: 'lich_vharos', name: { ru: 'Лич Вхарос', en: 'Lich Vharos' }, title: { ru: 'Хозяин склепов', en: 'Master of the Crypts' },
    hp: 1.35, damage: 1.12, radius: 2.4, height: 8.6, model: 'lich_vharos', color: 0x5affc8, relic: 'phylactery', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.2, attacks: [
        { type: 'beam', cd: 8, name: nm('Луч душ', 'Soul Beam'), aim: 1, sweep: 90, length: 17, width: 1.3, dur: 2.4, m: 0.3, wind: 1.0 },
        { type: 'erupt', cd: 7, name: nm('Могильные руки', 'Grave Hands'), pattern: 'scatter', count: 6, r: 2, spread: 6, m: 0.8, stun: 1.2, fx: 'dark', wind: 1.0 },
        { type: 'nova', cd: 6, name: nm('Некротическая волна', 'Necrotic Nova'), count: 18, waves: 2, delay: 0.45, rotate: 10, speed: 5.5, m: 0.38 },
        { type: 'blink', cd: 9, name: nm('Шаг сквозь тень', 'Shadow Step'), r: 4.2, m: 1.3, kb: 12, wind: 0.5, hide: 0.7 },
        { type: 'volley', cd: 5, name: nm('Стрелы скверны', 'Blight Bolts'), min: 2, count: 3, spread: 20, bursts: 3, delay: 0.25, speed: 10, m: 0.38 },
      ] },
      { hp: 0.5, move: 'keep', speed: 2.5, enrage: true, gap: 0.85, attacks: [
        { type: 'vortex', cd: 10, name: nm('Хватка смерти', 'Death Grip'), r: 5.5, strength: 3.4, dur: 2.2, m: 1.4, kb: 12 },
        { type: 'beam', cd: 8, name: nm('Луч душ', 'Soul Beam'), count: 3, sweep: 50, length: 17, width: 1.1, dur: 2.6, m: 0.3, wind: 1.0 },
        { type: 'erupt', cd: 6, name: nm('Могильные руки', 'Grave Hands'), pattern: 'scatter', count: 8, r: 2, spread: 7, m: 0.8, stun: 1.2, fx: 'dark', wind: 0.95 },
        { type: 'roar', cd: 12, name: nm('Вопль ужаса', 'Dread Wail'), range: 7, r: 8.5, stun: 1.6, wind: 1.25 },
        { type: 'blink', cd: 8, name: nm('Шаг сквозь тень', 'Shadow Step'), r: 4.4, m: 1.4, kb: 13, wind: 0.45, hide: 0.65 },
      ] },
      { hp: 0.25, move: 'keep', speed: 2.8, enrage: true, gap: 0.7, attacks: [
        { type: 'spiral', cd: 7, name: nm('Вихрь душ', 'Soul Spiral'), arms: 6, speed: 6, duration: 3, rate: 9, turn: -90, m: 0.33 },
        { type: 'erupt', cd: 6, name: nm('Костяной ливень', 'Bone Rain'), pattern: 'scatter', count: 12, r: 2, spread: 9, m: 0.9, rock: 1, fx: 'dark', wind: 1.0 },
        { type: 'vortex', cd: 9, name: nm('Хватка смерти', 'Death Grip'), r: 6, strength: 3.6, dur: 2, m: 1.5, kb: 13 },
        { type: 'beam', cd: 8, name: nm('Луч душ', 'Soul Beam'), count: 4, sweep: -60, length: 18, width: 1.1, dur: 2.6, m: 0.3, wind: 0.95 },
        { type: 'roar', cd: 10, name: nm('Вопль ужаса', 'Dread Wail'), range: 7, r: 9, stun: 1.7, wind: 1.15 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Emberwaste
  {
    id: 'cinder_golem', name: { ru: 'Пепельный голем', en: 'Cinder Golem' }, title: { ru: 'Кузня, что ходит', en: 'The Walking Forge' },
    hp: 1, damage: 1, radius: 3.0, height: 8.4, model: 'cinder_golem', color: 0xff6a1a, relic: 'forge_heart',
    phases: [
      { hp: 1, move: 'chase', speed: 1.6, attacks: [
        { type: 'smash', cd: 6, name: nm('Магмовый кулак', 'Magma Fist'), range: 4.5, r: 4.4, m: 1.6, kb: 12, rings: 2, ringR: 12, fx: 'fire', wind: 1.2 },
        { type: 'charge', cd: 7, name: nm('Таран горна', 'Forge Ram'), min: 3, count: 1, speed: 15, len: 18, m: 1.6, kb: 15, stun: 0.8, wind: 1.05 },
        { type: 'erupt', cd: 6, name: nm('Извержение', 'Molten Eruption'), pattern: 'scatter', count: 6, r: 2.1, spread: 6, m: 0.9, fx: 'fire', pool: 3, wind: 0.95 },
        { type: 'volley', cd: 5, name: nm('Шлаковый залп', 'Slag Volley'), min: 3, count: 5, spread: 45, bursts: 2, delay: 0.35, speed: 8.5, m: 0.42, color: 0xff7a1a },
        { type: 'roar', cd: 13, name: nm('Рёв печи', 'Furnace Roar'), range: 6, r: 8, stun: 1.5, kb: 6, wind: 1.3, fx: 'fire' },
      ] },
      { hp: 0.5, move: 'chase', speed: 1.9, enrage: true, gap: 0.85, attacks: [
        { type: 'erupt', cd: 7, name: nm('Огненный дождь', 'Meteor Rain'), pattern: 'scatter', count: 10, r: 2.2, spread: 9, m: 1.0, rock: 1, fx: 'fire', wind: 1.1 },
        { type: 'smash', cd: 5.5, name: nm('Магмовый кулак', 'Magma Fist'), range: 4.5, r: 4.6, m: 1.6, kb: 13, rings: 3, ringR: 13, fx: 'fire', wind: 1.1 },
        { type: 'charge', cd: 6, name: nm('Таран горна', 'Forge Ram'), min: 3, count: 2, speed: 16, len: 18, m: 1.6, kb: 15, stun: 0.8, wind: 0.95, wind2: 0.65 },
        { type: 'erupt', cd: 6, name: nm('Лавовые трещины', 'Lava Fissures'), pattern: 'fan', lines: 3, spread: 55, count: 6, r: 1.7, step: 0.09, m: 0.9, fx: 'fire', wind: 0.85 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.2, enrage: true, gap: 0.7, attacks: [
        { type: 'leap', cd: 8, name: nm('Падение наковальни', 'Anvil Drop'), min: 2, r: 4.6, outer: 1.8, m: 1.7, stun: 1.4, kb: 12, fx: 'fire', wind: 1.05 },
        { type: 'nova', cd: 6, name: nm('Выброс шлака', 'Slag Burst'), count: 24, waves: 2, delay: 0.35, rotate: 7, speed: 6.5, m: 0.38, color: 0xff7a1a },
        { type: 'erupt', cd: 6, name: nm('Огненный дождь', 'Meteor Rain'), pattern: 'scatter', count: 12, r: 2.2, spread: 9, m: 1.0, rock: 1, fx: 'fire', wind: 1.0 },
        { type: 'roar', cd: 10, name: nm('Рёв печи', 'Furnace Roar'), range: 6, r: 8.5, stun: 1.6, kb: 6, wind: 1.15 },
      ] },
    ],
  },
  {
    id: 'magmaw', name: { ru: 'Магмоглот', en: 'Magmaw' }, title: { ru: 'Червь расплавленных глубин', en: 'Wyrm of the Molten Deep' },
    hp: 1.35, damage: 1.12, radius: 3.0, height: 9, model: 'magmaw', color: 0xff5a1a, relic: 'wyrm_scale',
    phases: [
      { hp: 1, move: 'chase', speed: 2, attacks: [
        { type: 'beam', cd: 8, name: nm('Огненное дыхание', 'Flame Breath'), aim: 1, sweep: 90, length: 15, width: 2, dur: 2.2, m: 0.34, wind: 1.0, color: 0xff7a1a },
        { type: 'blink', cd: 10, name: nm('Засада из глубин', 'Deep Ambush'), burrow: 1, r: 4.5, m: 1.5, stun: 1.3, wind: 0.6, hide: 1.0 },
        { type: 'sweep', cd: 5, name: nm('Удар хвостом', 'Tail Lash'), range: 5, r: 8, arc: 200, m: 1.2, kb: 15, wind: 0.95 },
        { type: 'volley', cd: 5, name: nm('Лавовый плевок', 'Magma Spit'), min: 2, count: 5, spread: 40, bursts: 2, delay: 0.35, speed: 9, m: 0.42, color: 0xff7a1a },
        { type: 'erupt', cd: 8, name: nm('Лавовый дождь', 'Lava Rain'), pattern: 'scatter', count: 9, r: 2.2, spread: 8, m: 0.9, rock: 1, fx: 'fire', wind: 1.1 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.3, enrage: true, gap: 0.85, attacks: [
        { type: 'erupt', cd: 7, name: nm('Кольца извержения', 'Eruption Rings'), pattern: 'ring', count: 8, dist: 5, rings2: 2, r: 2, step: 0.05, m: 1.0, fx: 'fire', kb: 8, wind: 0.9 },
        { type: 'beam', cd: 8, name: nm('Огненное дыхание', 'Flame Breath'), aim: 1, sweep: 120, length: 16, width: 2, dur: 2.4, m: 0.34, wind: 0.95, color: 0xff7a1a },
        { type: 'blink', cd: 8, name: nm('Засада из глубин', 'Deep Ambush'), burrow: 1, r: 4.8, m: 1.5, stun: 1.3, wind: 0.55, hide: 0.9 },
        { type: 'sweep', cd: 5, name: nm('Удар хвостом', 'Tail Lash'), range: 5, r: 8, arc: 220, hits: 2, m: 1.2, kb: 15, wind: 0.9 },
        { type: 'roar', cd: 12, name: nm('Рёв глубин', 'Roar of the Deep'), range: 6, r: 8.5, stun: 1.6, wind: 1.25, fx: 'fire' },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.6, enrage: true, gap: 0.7, attacks: [
        { type: 'spiral', cd: 7, name: nm('Пламенный вихрь', 'Inferno Coil'), arms: 6, speed: 6.5, duration: 3.2, rate: 10, turn: 110, m: 0.35, color: 0xff7a1a },
        { type: 'erupt', cd: 6, name: nm('Лавовый дождь', 'Lava Rain'), pattern: 'scatter', count: 13, r: 2.2, spread: 10, m: 1.0, rock: 1, fx: 'fire', wind: 1.0 },
        { type: 'blink', cd: 7, name: nm('Засада из глубин', 'Deep Ambush'), burrow: 1, r: 5, m: 1.6, stun: 1.3, wind: 0.5, hide: 0.85 },
        { type: 'charge', cd: 7, name: nm('Бросок червя', 'Wyrm Lunge'), min: 2, count: 2, speed: 18, len: 20, m: 1.5, kb: 15, wind: 0.85, wind2: 0.55 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Frostveil
  {
    id: 'frostfang', name: { ru: 'Морозный Клык', en: 'Frostfang' }, title: { ru: 'Йети вечной метели', en: 'Yeti of the Endless Blizzard' },
    hp: 1, damage: 1, radius: 2.8, height: 8.2, model: 'frostfang', color: 0x8ad8ff, relic: 'yeti_pelt',
    phases: [
      { hp: 1, move: 'chase', speed: 2.2, attacks: [
        { type: 'smash', cd: 6, name: nm('Лавинный удар', 'Avalanche Slam'), range: 4.5, r: 4.4, m: 1.6, stun: 1.4, rings: 1, ringR: 11, fx: 'ice', wind: 1.2 },
        { type: 'charge', cd: 7, name: nm('Ледяной таран', 'Glacial Charge'), min: 3, count: 2, speed: 17, len: 18, m: 1.4, kb: 14, wind: 0.95, wind2: 0.6 },
        { type: 'volley', cd: 5, name: nm('Сосульки', 'Icicle Volley'), min: 2, count: 5, spread: 45, bursts: 2, delay: 0.3, speed: 9, m: 0.38, slow: 1 },
        { type: 'sweep', cd: 5, name: nm('Размах когтей', 'Claw Swipe'), range: 4.5, r: 7, arc: 160, m: 1.2, kb: 13, wind: 0.85 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.5, enrage: true, gap: 0.85, attacks: [
        { type: 'leap', cd: 8, name: nm('Прыжок йети', 'Yeti Leap'), min: 2, r: 4.3, outer: 1.8, m: 1.6, stun: 1.4, kb: 11, fx: 'ice', wind: 1.0 },
        { type: 'roar', cd: 11, name: nm('Морозный рёв', 'Frost Roar'), range: 6, r: 8.5, stun: 1.6, wind: 1.25, fx: 'ice', slow: 1 },
        { type: 'erupt', cd: 6, name: nm('Ледяные шипы', 'Ice Spikes'), pattern: 'line', count: 8, r: 1.6, step: 0.08, m: 0.9, fx: 'ice', slow: 1, wind: 0.8 },
        { type: 'sweep', cd: 5, name: nm('Двойной размах', 'Double Swipe'), range: 4.5, r: 7.5, arc: 170, hits: 2, m: 1.2, kb: 13, wind: 0.8 },
        { type: 'charge', cd: 7, name: nm('Ледяной таран', 'Glacial Charge'), min: 3, count: 3, speed: 18, len: 18, m: 1.4, kb: 14, wind: 0.85, wind2: 0.5 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.8, enrage: true, gap: 0.7, attacks: [
        { type: 'erupt', cd: 6, name: nm('Ледяное поле', 'Frozen Ground'), pattern: 'ring', count: 8, dist: 4.5, rings2: 2, r: 2, step: 0.04, m: 0.9, fx: 'ice', pool: 3, wind: 0.85 },
        { type: 'smash', cd: 5, name: nm('Лавинный удар', 'Avalanche Slam'), range: 4.5, r: 4.7, at: 'boss', m: 1.6, stun: 1.4, rings: 3, ringR: 14, fx: 'ice', wind: 1.0 },
        { type: 'nova', cd: 6, name: nm('Метель', 'Blizzard Burst'), count: 22, waves: 3, delay: 0.35, rotate: 8, speed: 6.5, m: 0.35, slow: 1 },
        { type: 'leap', cd: 7, name: nm('Прыжок йети', 'Yeti Leap'), min: 2, r: 4.5, outer: 1.8, m: 1.7, stun: 1.4, kb: 12, fx: 'ice', wind: 0.95 },
      ] },
    ],
  },
  {
    id: 'glacial_matriarch', name: { ru: 'Ледяная Матриарх', en: 'Glacial Matriarch' }, title: { ru: 'Королева белой тишины', en: 'Queen of White Silence' },
    hp: 1.35, damage: 1.12, radius: 2.4, height: 9, model: 'glacial_matriarch', color: 0x9fe6ff, relic: 'frozen_tear', flying: true,
    phases: [
      { hp: 1, move: 'keep', speed: 2.2, attacks: [
        { type: 'beam', cd: 8, name: nm('Луч инея', 'Frost Ray'), aim: 1, sweep: 90, length: 17, width: 1.3, dur: 2.4, m: 0.3, wind: 1.0, color: 0x9adfff },
        { type: 'erupt', cd: 7, name: nm('Поле осколков', 'Shatter Field'), pattern: 'scatter', count: 7, r: 2, spread: 7, m: 0.85, fx: 'ice', slow: 1, pool: 3, wind: 1.0 },
        { type: 'volley', cd: 5, name: nm('Ледяные копья', 'Ice Lances'), min: 2, count: 3, spread: 18, bursts: 3, delay: 0.25, speed: 11, m: 0.38, slow: 1 },
        { type: 'roar', cd: 11, name: nm('Ледяная темница', 'Glacial Prison'), range: 7, r: 8.5, stun: 1.7, wind: 1.3, fx: 'ice' },
        { type: 'blink', cd: 9, name: nm('Снежный шаг', 'Snow Step'), r: 4, m: 1.2, kb: 13, wind: 0.5, hide: 0.6 },
      ] },
      { hp: 0.5, move: 'keep', speed: 2.5, enrage: true, gap: 0.85, attacks: [
        { type: 'vortex', cd: 10, name: nm('Объятья метели', 'Blizzard Embrace'), r: 5.5, strength: 3.3, dur: 2.2, m: 1.4, stun: 1.0, fx: 'ice' },
        { type: 'spiral', cd: 8, name: nm('Вьюга', 'Whiteout'), arms: 5, speed: 5.5, duration: 3, rate: 9, turn: 80, m: 0.33, slow: 1 },
        { type: 'erupt', cd: 6, name: nm('Ледопад', 'Icefall'), pattern: 'scatter', count: 10, r: 2.2, spread: 8, m: 0.95, rock: 1, fx: 'ice', wind: 1.05 },
        { type: 'beam', cd: 8, name: nm('Луч инея', 'Frost Ray'), count: 3, sweep: 50, length: 17, width: 1.1, dur: 2.5, m: 0.3, wind: 1.0, color: 0x9adfff },
        { type: 'roar', cd: 11, name: nm('Ледяная темница', 'Glacial Prison'), range: 7, r: 9, stun: 1.7, wind: 1.2 },
      ] },
      { hp: 0.25, move: 'keep', speed: 2.7, enrage: true, gap: 0.7, attacks: [
        { type: 'nova', cd: 6, name: nm('Кристальная волна', 'Crystal Nova'), count: 24, waves: 3, delay: 0.35, rotate: 8, speed: 6.5, m: 0.35, slow: 1 },
        { type: 'erupt', cd: 6, name: nm('Ледяной крест', 'Frost Cross'), pattern: 'cross', count: 7, r: 1.7, step: 0.07, m: 1.0, fx: 'ice', stun: 1.0, wind: 0.85 },
        { type: 'vortex', cd: 9, name: nm('Объятья метели', 'Blizzard Embrace'), r: 6, strength: 3.5, dur: 2, m: 1.5, stun: 1.1 },
        { type: 'erupt', cd: 6, name: nm('Ледопад', 'Icefall'), pattern: 'scatter', count: 13, r: 2.2, spread: 10, m: 0.95, rock: 1, fx: 'ice', wind: 1.0 },
        { type: 'blink', cd: 7, name: nm('Снежный шаг', 'Snow Step'), r: 4.4, m: 1.3, kb: 14, wind: 0.45, hide: 0.55 },
      ] },
    ],
  },
  // ------------------------------------------------------------ Aetherfall Ruins
  {
    id: 'clockwork_sentinel', name: { ru: 'Заводной часовой', en: 'Clockwork Sentinel' }, title: { ru: 'Последний механизм', en: 'The Last Mechanism' },
    hp: 1, damage: 1, radius: 3.0, height: 8.6, model: 'clockwork_sentinel', color: 0xffc04a, relic: 'mainspring',
    phases: [
      { hp: 1, move: 'chase', speed: 1.7, attacks: [
        { type: 'smash', cd: 6, name: nm('Поршневой удар', 'Piston Slam'), range: 4.5, r: 4.3, m: 1.6, kb: 13, rings: 2, ringR: 12, wind: 1.15 },
        { type: 'sweep', cd: 5, name: nm('Шестерёнчатый взмах', 'Gear Sweep'), range: 5, r: 7.5, arc: 200, m: 1.2, kb: 14, wind: 0.95 },
        { type: 'volley', cd: 5, name: nm('Руническая пушка', 'Rune Cannon'), min: 2, count: 3, spread: 16, bursts: 3, delay: 0.22, speed: 11, m: 0.38 },
        { type: 'beam', cd: 9, name: nm('Лазерная сетка', 'Laser Grid'), count: 4, sweep: 45, length: 16, width: 1, dur: 2.6, m: 0.3, wind: 1.0, color: 0xff3a3a },
        { type: 'roar', cd: 12, name: nm('Перегрузка', 'Overload Pulse'), range: 6, r: 8, stun: 1.5, wind: 1.3, fx: 'shock' },
      ] },
      { hp: 0.5, move: 'chase', speed: 2, enrage: true, gap: 0.85, attacks: [
        { type: 'charge', cd: 7, name: nm('Разгон', 'Overclock Rush'), min: 3, count: 2, speed: 17, len: 18, m: 1.5, kb: 15, wind: 0.95, wind2: 0.6 },
        { type: 'nova', cd: 6, name: nm('Тайная волна', 'Arcane Nova'), count: 24, waves: 2, delay: 0.35, rotate: 7, speed: 6.5, m: 0.36 },
        { type: 'smash', cd: 5.5, name: nm('Поршневой удар', 'Piston Slam'), range: 4.5, r: 4.5, m: 1.6, kb: 13, rings: 3, ringR: 13, wind: 1.05 },
        { type: 'beam', cd: 8, name: nm('Лазерная сетка', 'Laser Grid'), count: 6, sweep: -50, length: 17, width: 1, dur: 2.6, m: 0.3, wind: 1.0, color: 0xff3a3a },
        { type: 'roar', cd: 11, name: nm('Перегрузка', 'Overload Pulse'), range: 6, r: 8.5, stun: 1.6, wind: 1.2 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.3, enrage: true, gap: 0.7, attacks: [
        { type: 'leap', cd: 8, name: nm('Прыжок часового', 'Sentinel Drop'), min: 2, r: 4.6, outer: 1.8, m: 1.7, stun: 1.4, kb: 12, wind: 1.0 },
        { type: 'erupt', cd: 6, name: nm('Рунные мины', 'Rune Mines'), pattern: 'cross', count: 7, r: 1.7, step: 0.06, m: 1.0, fx: 'holy', kb: 9, wind: 0.85 },
        { type: 'spiral', cd: 7, name: nm('Вращение турели', 'Turret Spin'), arms: 4, speed: 7, duration: 3, rate: 10, turn: 100, m: 0.33 },
        { type: 'sweep', cd: 4.5, name: nm('Шестерёнчатый взмах', 'Gear Sweep'), range: 5, r: 8, arc: 210, hits: 2, m: 1.25, kb: 15, wind: 0.85 },
      ] },
    ],
  },
  {
    id: 'hollow_sovereign', name: { ru: 'Полый Властелин', en: 'Hollow Sovereign' }, title: { ru: 'Тот, кто погасил свет', en: 'The One Who Dimmed the Light' },
    hp: 1.4, damage: 1.15, radius: 2.6, height: 9.6, model: 'hollow_sovereign', color: 0x9a5aff, relic: 'hollow_crown', flying: true,
    phases: [
      { hp: 1, move: 'chase', speed: 2.3, attacks: [
        { type: 'beam', cd: 8, name: nm('Луч пустоты', 'Void Ray'), aim: 1, sweep: 100, length: 18, width: 1.4, dur: 2.4, m: 0.32, wind: 1.0 },
        { type: 'blink', cd: 8, name: nm('Разлом', 'Rift Step'), r: 4.3, m: 1.4, stun: 1.2, wind: 0.5, hide: 0.65 },
        { type: 'sweep', cd: 5, name: nm('Коса пустоты', 'Void Scythe'), range: 5, r: 8, arc: 180, m: 1.25, kb: 14, wind: 0.95 },
        { type: 'nova', cd: 6, name: nm('Тёмная волна', 'Dark Nova'), count: 20, waves: 2, delay: 0.4, rotate: 9, speed: 6, m: 0.38 },
        { type: 'volley', cd: 5, name: nm('Осколки тьмы', 'Shadow Shards'), min: 2, count: 5, spread: 30, bursts: 3, delay: 0.25, speed: 10, m: 0.38 },
      ] },
      { hp: 0.5, move: 'chase', speed: 2.6, enrage: true, gap: 0.8, attacks: [
        { type: 'vortex', cd: 10, name: nm('Колодец тяжести', 'Gravity Well'), r: 6, strength: 3.6, dur: 2.3, m: 1.5, kb: 14 },
        { type: 'roar', cd: 11, name: nm('Указ Властелина', "Sovereign's Decree"), range: 7, r: 9.5, stun: 1.8, wind: 1.3, fx: 'dark' },
        { type: 'erupt', cd: 6, name: nm('Дождь пустоты', 'Void Rain'), pattern: 'scatter', count: 11, r: 2.2, spread: 9, m: 0.95, rock: 1, fx: 'dark', wind: 1.05 },
        { type: 'blink', cd: 7, name: nm('Разлом', 'Rift Step'), r: 4.5, m: 1.5, stun: 1.2, wind: 0.45, hide: 0.6 },
        { type: 'beam', cd: 8, name: nm('Луч пустоты', 'Void Ray'), count: 4, sweep: 55, length: 18, width: 1.1, dur: 2.6, m: 0.3, wind: 1.0 },
      ] },
      { hp: 0.25, move: 'chase', speed: 2.9, enrage: true, gap: 0.65, attacks: [
        { type: 'spiral', cd: 7, name: nm('Затмение', 'Eclipse'), arms: 7, speed: 6.5, duration: 3, rate: 10, turn: -100, m: 0.33 },
        { type: 'erupt', cd: 6, name: nm('Крест пустоты', 'Void Cross'), pattern: 'cross', count: 7, r: 1.8, step: 0.06, m: 1.05, fx: 'dark', stun: 1.0, wind: 0.85 },
        { type: 'leap', cd: 8, name: nm('Падение звезды', 'Fallen Star'), min: 2, r: 4.8, outer: 1.8, m: 1.8, stun: 1.4, kb: 13, fx: 'dark', wind: 1.0 },
        { type: 'vortex', cd: 9, name: nm('Колодец тяжести', 'Gravity Well'), r: 6.5, strength: 3.8, dur: 2.1, m: 1.6, kb: 15 },
        { type: 'sweep', cd: 4.5, name: nm('Коса пустоты', 'Void Scythe'), range: 5, r: 8.5, arc: 200, hits: 2, m: 1.3, kb: 15, wind: 0.85 },
      ] },
    ],
  },
];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

/** Relics: permanent trophies granted the first time a boss is defeated. */
export const RELICS: RelicDef[] = [
  { id: 'spore_sac', name: { ru: 'Споровый мешок', en: 'Spore Sac' }, desc: { ru: '+0.2 HP/сек', en: '+0.2 HP/s' }, stats: { regen: 0.2 }, color: 0xc05ad6 },
  { id: 'heartwood', name: { ru: 'Сердцевина', en: 'Heartwood' }, desc: { ru: '+15 к макс. здоровью', en: '+15 max HP' }, stats: { maxHp: 15 }, color: 0x6b8f3a },
  { id: 'gutter_crown', name: { ru: 'Корона канав', en: 'Gutter Crown' }, desc: { ru: '+10% золота', en: '+10% gold' }, stats: { greed: 0.1 }, color: 0x8a7a6a },
  { id: 'silent_bell', name: { ru: 'Безмолвный колокол', en: 'Silent Bell' }, desc: { ru: '−4% перезарядки', en: '−4% cooldown' }, stats: { cooldown: 0.04 }, color: 0x6a6f86 },
  { id: 'colossus_marrow', name: { ru: 'Мозг колосса', en: 'Colossus Marrow' }, desc: { ru: '+1 броня', en: '+1 armor' }, stats: { armor: 1 }, color: 0xe6dcc0 },
  { id: 'phylactery', name: { ru: 'Филактерия', en: 'Phylactery' }, desc: { ru: '+1 воскрешение', en: '+1 revival' }, stats: { revival: 1 }, color: 0x5affc8 },
  { id: 'forge_heart', name: { ru: 'Сердце горна', en: 'Forge Heart' }, desc: { ru: '+6% урона', en: '+6% damage' }, stats: { might: 0.06 }, color: 0xff7a3a },
  { id: 'wyrm_scale', name: { ru: 'Чешуя червя', en: 'Wyrm Scale' }, desc: { ru: '+8% площади', en: '+8% area' }, stats: { area: 0.08 }, color: 0xff5a1a },
  { id: 'yeti_pelt', name: { ru: 'Шкура йети', en: 'Yeti Pelt' }, desc: { ru: '+6% скорости', en: '+6% speed' }, stats: { moveSpeed: 0.06 }, color: 0xe6f4ff },
  { id: 'frozen_tear', name: { ru: 'Застывшая слеза', en: 'Frozen Tear' }, desc: { ru: '+10% длительности', en: '+10% duration' }, stats: { duration: 0.1 }, color: 0x9fe6ff },
  { id: 'mainspring', name: { ru: 'Главная пружина', en: 'Mainspring' }, desc: { ru: '+10% скорости снарядов, +5% крита', en: '+10% proj. speed, +5% crit' }, stats: { projSpeed: 0.1, critChance: 0.05 }, color: 0xc9a050 },
  { id: 'hollow_crown', name: { ru: 'Полая корона', en: 'Hollow Crown' }, desc: { ru: '+1 снаряд', en: '+1 projectile' }, stats: { amount: 1 }, color: 0x7a3dff },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
