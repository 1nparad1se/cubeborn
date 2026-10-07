import type { Loc } from './types';

export interface MapLore {
  story: Loc;
  /** Signature mechanic of the map. */
  feature: { name: Loc; desc: Loc };
  /** Advice on how strong the hero should be. */
  recommended: Loc;
}

/** Map-select texts: each map has its own story and signature mechanic. */
export const MAP_LORE: Record<string, MapLore> = {
  blightwood: {
    story: {
      ru: 'Когда-то здесь стояла деревня лесорубов. Однажды они срубили Старейшее дерево, и из его корней вышла гниль. За одну зиму она съела лес, людей и даже память о них. Теперь сам лес охотится: споры набиваются в лёгкие, а мёртвые лесорубы снова бродят между стволами. В глубине чащи растёт Гнилокорень, и он помнит каждый удар топора.',
      en: 'A woodcutters\' village once stood here, until they felled the Eldest Tree and rot crept out of its roots. In a single winter it devoured the forest, the people and even the memory of them. Now the woods hunt on their own: spores fill the lungs and dead woodcutters wander between the trunks again. Deep in the thicket grows Rotroot, and it remembers every swing of the axe.',
    },
    feature: {
      name: { ru: 'Засада из чащи', en: 'Thicket Ambush' },
      desc: { ru: 'Враги выскакивают из зарослей рядом с вами, а не только из-за края экрана. Держитесь полян и троп.', en: 'Enemies burst out of the undergrowth right next to you, not only from beyond the screen. Keep to clearings and paths.' },
    },
    recommended: { ru: 'Первая карта. Подходит любой герой без улучшений.', en: 'The first map. Any hero, no upgrades needed.' },
  },
  gloamhaven: {
    story: {
      ru: 'Гавань была самым богатым портом побережья, пока в её колокол не вселилось нечто из сточных каналов. С каждым ударом колокола гасли фонари, а жители уходили в туман и не возвращались. Теперь улицы держат крысы и культисты. Колокол звонит до сих пор, хотя звонаря нет уже сто лет.',
      en: 'The Haven was the richest port on the coast until something from the sewers crawled into its bell. With every toll the lanterns died and townsfolk walked into the fog, never to return. Rats and cultists rule the streets now. The bell still rings, though no bell-ringer has lived for a century.',
    },
    feature: {
      name: { ru: 'Мёртвый набат', en: 'The Dead Bell' },
      desc: { ru: 'Время от времени колокол бьёт: город погружается во тьму, а враги становятся на 20% быстрее.', en: 'Every so often the bell tolls: the city falls dark and enemies move 20% faster.' },
    },
    recommended: { ru: 'Пара улучшений «Выносливость» и «Сила» сильно помогут.', en: 'A few levels of Vitality and Might help a lot.' },
  },
  ossuary: {
    story: {
      ru: 'Под монастырём веками хоронили павших рыцарей ордена, укладывая кости в стены. Лич Вхарос был хранителем склепов, а стал их хозяином: он поднял мёртвых, чтобы они вечно охраняли его. Своды крипт дрожат от шагов костяного колосса и рушатся на головы незваных гостей. Выхода отсюда нет, есть только путь глубже.',
      en: 'For centuries the order buried its fallen knights beneath the monastery, setting their bones into the walls. Lich Vharos was the keeper of the crypts and became their master, raising the dead to guard him forever. The vaults tremble under the bone colossus\' steps and collapse onto uninvited guests. There is no way out, only the way deeper.',
    },
    feature: {
      name: { ru: 'Тесные склепы и обвалы', en: 'Narrow Crypts and Cave-ins' },
      desc: { ru: 'Узкие коридоры не дают убежать от толпы, а потолки периодически обрушиваются вокруг героя.', en: 'Narrow corridors leave little room to run, and ceilings periodically collapse around the hero.' },
    },
    recommended: { ru: 'Нужны урон по площади и броня. Лучше открыть 2–3 оружия заранее.', en: 'Bring area damage and armor. Unlock 2–3 extra weapons first.' },
  },
  emberwaste: {
    story: {
      ru: 'Здесь была кузница гномьего царства, пока мастера не прорубили шахту слишком глубоко и не разбудили Магмоглота. Червь выпил жар из самого сердца горы, и пепел похоронил подземный город. Големы, которых гномы собрали для защиты, до сих пор стоят на посту и не отличают своих от чужих. Земля дышит, и каждый её вдох — извержение.',
      en: 'This was the forge of a dwarven realm until its masters dug too deep and woke Magmaw. The wyrm drank the heat from the mountain\'s heart and ash buried the city beneath. The golems the dwarves built for protection still stand guard and no longer tell friend from foe. The ground breathes, and every breath is an eruption.',
    },
    feature: {
      name: { ru: 'Извержения', en: 'Eruptions' },
      desc: { ru: 'Земля периодически извергает лавовые бомбы вокруг героя, а лавовые разломы жгут при касании.', en: 'The ground periodically spews lava bombs around the hero, and lava fissures burn on contact.' },
    },
    recommended: { ru: 'Средняя сложность. Берите скорость и восстановление.', en: 'Mid difficulty. Take speed and recovery.' },
  },
  frostveil: {
    story: {
      ru: 'Ледяная Матриарх когда-то была королевой северного народа. Она остановила время, чтобы её дети никогда не умерли, и вместе со временем замёрзло всё королевство. Метель здесь не утихает уже триста лет, и в ней воют волки, потерявшие стаю. Снег глубок, и каждый шаг вне натоптанных троп даётся с трудом.',
      en: 'The Glacial Matriarch was once queen of the northern folk. She stopped time so her children would never die, and the whole kingdom froze with it. The blizzard has not ceased for three hundred years, and wolves who lost their pack howl inside it. The snow runs deep, and every step off the trodden trails is a struggle.',
    },
    feature: {
      name: { ru: 'Глубокий снег', en: 'Deep Snow' },
      desc: { ru: 'Вне троп герой движется на 16% медленнее, враги на 10% медленнее. Тропы соединяют поселения.', en: 'Off the trails the hero moves 16% slower and enemies 10% slower. Trails connect the settlements.' },
    },
    recommended: { ru: 'Высокая сложность. Нужны хорошие улучшения скорости и здоровья.', en: 'High difficulty. Strong speed and health upgrades recommended.' },
  },
  aetherfall: {
    story: {
      ru: 'Небесный город упал, когда Полый Властелин погасил его эфирное сердце, чтобы забрать свет себе. Обломки рухнули в пустыню, и теперь над руинами бушуют эфирные бури, которые сбивают с ног и слепят. Заводные стражи всё ещё охраняют пустые площади, исполняя приказы, отданные тысячу лет назад. В центре бури ждёт тот, кто однажды уже погасил свет.',
      en: 'The sky city fell when the Hollow Sovereign snuffed out its aether heart to take the light for himself. Its ruins crashed into the desert, and aether storms now rage over them, blinding travellers and knocking them off their feet. Clockwork sentinels still guard the empty plazas, following orders given a thousand years ago. At the heart of the storm waits the one who already dimmed the light once.',
    },
    feature: {
      name: { ru: 'Эфирная буря', en: 'Aether Storm' },
      desc: { ru: 'Во время бури видимость падает, а ветер толкает героя в сторону. Руны дают силу во время всплесков магии.', en: 'During a storm visibility drops and the wind pushes the hero. Rune circles empower you during arcane surges.' },
    },
    recommended: { ru: 'Финальная карта. Нужен развитый аккаунт и продуманный билд.', en: 'The final map. Needs a developed account and a planned build.' },
  },
};
