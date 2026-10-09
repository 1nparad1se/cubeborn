import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { L } from '../i18n';
import { keyName } from '../input/Input';
import { SKILL_BINDS, type BindAction, type Keybinds } from '../meta/Save';
import type { ClassDef, SkillDef, SkillTag, CastType } from '../game/action/types';
import { SLOT_KEYS } from '../game/action/types';
import type { DmgType } from '../game/types';
import { CharacterViewer, type PreviewStep } from '../render/CharacterViewer';
import './classSelect.css';
import './mcd.css';

/** Inline bilingual string (Russian first). */
export const tr = (ru: string, en: string): string => L({ ru, en });

const DMG: Record<DmgType, [string, string]> = {
  phys: ['Физический', 'Physical'],
  fire: ['Огонь', 'Fire'],
  ice: ['Холод', 'Cold'],
  lightning: ['Молния', 'Lightning'],
  poison: ['Яд', 'Poison'],
  dark: ['Тьма', 'Dark'],
  magic: ['Магия', 'Magic'],
};
export const DMG_COLOR: Record<DmgType, string> = { phys: '#e6dccb', fire: '#ff8a3a', ice: '#7fd8ff', lightning: '#ffe45a', poison: '#8be04e', dark: '#b07aff', magic: '#ff7ae0' };
export const CAST: Record<CastType, [string, string]> = {
  normal: ['Мгновенный', 'Instant'],
  combo: ['Комбо (повторные нажатия)', 'Combo (press again)'],
  hold: ['Удержание клавиши', 'Hold the key'],
  charge: ['Заряд (удерживать и отпустить)', 'Charge (hold and release)'],
  cast: ['Подготовка (каст)', 'Cast time'],
};
export const TAGS: Record<SkillTag, [string, string]> = {
  melee: ['ближний бой', 'melee'],
  ranged: ['дальний бой', 'ranged'],
  aoe: ['по области', 'area'],
  mobility: ['перемещение', 'mobility'],
  control: ['контроль', 'control'],
  counter: ['контратака', 'counter'],
  back: ['атака в спину', 'back attack'],
  head: ['атака в голову', 'head attack'],
  burst: ['взрывной урон', 'burst'],
  summon: ['призыв', 'summon'],
  buff: ['усиление', 'buff'],
  defense: ['защита', 'defense'],
  directional: ['направленный', 'directional'],
  combo: ['комбо', 'combo'],
  charge: ['заряд', 'charge'],
  holding: ['удержание', 'holding'],
};
const RATINGS: [keyof ClassDef['ratings'], string, string][] = [
  ['attack', 'Атака', 'Attack'],
  ['defense', 'Защита', 'Defense'],
  ['mobility', 'Мобильность', 'Mobility'],
  ['control', 'Контроль', 'Control'],
  ['support', 'Поддержка', 'Support'],
  ['range', 'Дальность', 'Range'],
];

export const dmgName = (el: DmgType): string => tr(...(DMG[el] ?? DMG.phys));

/** Clip prefix of a class (bz, pl, sf…), read from its first basic step. */
export function classPrefix(c: ClassDef): string {
  return (c.basic.steps[0]?.anim ?? c.id).split('_')[0];
}

/** The clips a skill plays, in order, with the looping poses held for a moment. */
export function skillSeq(s: SkillDef, has: (clip: string) => boolean): PreviewStep[] {
  const st = s.steps;
  const a = st[0]?.anim ?? s.id;
  switch (s.type) {
    case 'hold':
      return [{ clip: st[0].anim }, ...(st[1] ? [{ clip: st[1].anim, hold: Math.min(1.6, s.holdMax ?? 1.6) }] : []), ...(st[2] ? [{ clip: st[2].anim }] : [])];
    case 'charge':
      return [...(has(a + '_charge') ? [{ clip: a + '_charge', hold: Math.min(1.2, s.chargeMax ?? 1) }] : []), { clip: a }];
    case 'cast':
      return [...(has(a + '_cast') ? [{ clip: a + '_cast', hold: Math.min(1.4, s.castTime ?? 1) }] : []), { clip: a }];
    default:
      return st.map((x) => ({ clip: x.anim }));
  }
}

export interface AnimEntry {
  /** Unique key (reported back by the viewer for highlighting). */
  key: string;
  label: string;
  /** Key chip shown in front of the label. */
  chip?: string;
  /** Gait entries switch locomotion instead of playing clips. */
  gait?: 'idle' | 'walk' | 'run';
  seq: PreviewStep[];
  /** Every clip of the entry (for the "all clips" chips of the viewer). */
  clips: string[];
}

export interface AnimGroup {
  id: string;
  label: string;
  items: AnimEntry[];
}

/** Every animation of a class, grouped for the viewer: locomotion, basic, skills, ultimate, identity, dodge, reactions. */
export function classAnimGroups(c: ClassDef, has: (clip: string) => boolean): AnimGroup[] {
  const p = classPrefix(c);
  const entry = (key: string, label: string, seq: PreviewStep[], chip?: string): AnimEntry => ({ key, label, chip, seq, clips: seq.map((s) => s.clip) });
  const gait = (g: 'idle' | 'walk' | 'run', label: string): AnimEntry => ({ key: g, label, gait: g, seq: [], clips: [] });
  const basic = c.basic.steps.map((s) => ({ clip: s.anim }));
  const groups: AnimGroup[] = [
    { id: 'loco', label: tr('Передвижение', 'Locomotion'), items: [gait('idle', tr('Покой', 'Idle')), gait('walk', tr('Шаг', 'Walk')), gait('run', tr('Бег', 'Run'))] },
    {
      id: 'basic',
      label: tr('Базовая атака', 'Basic attack'),
      items: [entry('basic', basic.length > 1 ? tr('Вся цепочка', 'Full chain') : L(c.basic.name), basic, tr('ПКМ', 'RMB')), ...(basic.length > 1 ? basic.map((b, i) => entry('basic' + i, tr(`Удар ${i + 1}`, `Hit ${i + 1}`), [b])) : [])],
    },
    { id: 'skills', label: tr('Навыки', 'Skills'), items: c.skills.map((s, i) => entry('skill_' + s.id, L(s.name), skillSeq(s, has), SLOT_KEYS[i])) },
    { id: 'ult', label: tr('Пробуждение', 'Awakening'), items: [entry('ult', L(c.ult.name), skillSeq(c.ult, has), 'V')] },
    {
      id: 'identity',
      label: tr('Идентичность', 'Identity'),
      items: [
        entry('identity', L(c.identity.name), [{ clip: c.identity.step?.anim ?? p + '_identity' }], 'Z'),
        ...(c.special ? [entry('special', L(c.special.name), [{ clip: c.special.step.anim }], 'X')] : []),
      ],
    },
    { id: 'dodge', label: tr('Уклонение', 'Dodge'), items: [entry('dodge', L(c.dodge.name), [{ clip: c.dodge.step.anim }], tr('Пробел', 'Space'))] },
    {
      id: 'react',
      label: tr('Реакции', 'Reactions'),
      items: [
        entry('stagger', tr('Оглушение', 'Stagger'), [{ clip: p + '_stagger', hold: 1.8 }]),
        entry('heavyhit', tr('Тяжёлый удар', 'Heavy hit'), [{ clip: p + '_heavyhit' }]),
        entry('death', tr('Смерть', 'Death'), [{ clip: p + '_death', hold: 2.4 }]),
        entry('victory', tr('Победа', 'Victory'), [{ clip: p + '_victory', hold: 3 }]),
      ],
    },
  ];
  return groups;
}

// ------------------------------------------------------------------ tooltip

let tipEl: HTMLElement | null = null;

function tip(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div.cs-tip.hidden');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function hideTip() {
  tipEl?.classList.add('hidden');
}

/** Shows `build()` in a floating pixel panel next to the cursor while hovering `el`. */
export function attachTip(el: HTMLElement, build: () => HTMLElement) {
  const move = (e: MouseEvent) => {
    const t = tip();
    const r = t.getBoundingClientRect();
    let x = e.clientX + 18;
    let y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  };
  el.addEventListener('mouseenter', (e) => {
    const t = tip();
    clear(t);
    t.append(build());
    t.classList.remove('hidden');
    move(e);
  });
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseleave', hideTip);
}

/** Tooltip body of a skill: description, cooldown, range, radius, damage type, cast type, tags. */
export function skillTipBody(c: ClassDef, s: SkillDef, key: string): HTMLElement {
  const kv = (k: string, v: string, color?: string) => h('div.cs-tip-kv', h('span', k), h('b', color ? { style: `color:${color}` } : null, v));
  const res = L(c.res.name);
  return h(
    'div.cs-tip-body',
    h('div.cs-tip-head', iconImg('sk_' + s.icon, s.color, 'icon'), h('div', h('div.cs-tip-name', L(s.name)), h('div.cs-tip-sub', `${key} · ${tr(...CAST[s.type])}`))),
    h('p', L(s.desc)),
    kv(tr('Перезарядка', 'Cooldown'), s.cd + tr(' сек', 's')),
    s.range ? kv(tr('Дальность', 'Range'), String(s.range)) : null,
    s.radius ? kv(tr('Радиус', 'Radius'), String(s.radius)) : null,
    kv(tr('Тип урона', 'Damage type'), dmgName(s.el), DMG_COLOR[s.el]),
    kv(tr('Тип навыка', 'Skill type'), tr(...CAST[s.type])),
    s.castTime ? kv(tr('Подготовка', 'Cast time'), s.castTime + tr(' сек', 's')) : null,
    s.chargeMax ? kv(tr('Полный заряд', 'Full charge'), s.chargeMax + tr(' сек', 's') + (s.chargeMul ? ` · ×${s.chargeMul}` : '')) : null,
    s.holdMax ? kv(tr('Удержание до', 'Hold up to'), s.holdMax + tr(' сек', 's')) : null,
    s.cost ? kv(s.cost > 0 ? tr('Расход', 'Cost') : tr('Даёт', 'Gains'), `${Math.abs(s.cost)} · ${res}`, c.res.color) : null,
    s.unlock > 1 ? kv(tr('Открывается', 'Unlocks at'), tr(`ур. ${s.unlock}`, `lvl ${s.unlock}`)) : null,
    s.tags.length ? h('div.cs-tags', ...s.tags.map((tg) => h('span', tr(...(TAGS[tg] ?? [tg, tg]))))) : null,
    s.note ? h('div.cs-tip-note', L(s.note)) : null,
  );
}

// ------------------------------------------------------------------ info panel

const bindKey = (kb: Keybinds | undefined, a: BindAction, fallback: string) => (kb?.[a]?.[0] ? keyName(kb[a][0]) : fallback);

/** Full class sheet: name, title, role, difficulty, ratings, base stats, weapon, resource, passive, identity, skills. */
export function classInfo(c: ClassDef, kb?: Keybinds): HTMLElement {
  const col = hex(c.color);
  const sec = (label: string) => h('div.cs-sec', label);
  const kv = (k: string, v: string) => h('div.kv', h('span', k), h('span', v));
  const ratings = h(
    'div.cs-ratings',
    ...RATINGS.map(([k, ru, en]) =>
      h('div.cs-rate', h('span.cs-rate-n', tr(ru, en)), h('div.cs-bar', ...Array.from({ length: 5 }, (_, i) => h('i' + (i < c.ratings[k] ? '.on' : '')))), h('b', String(c.ratings[k]))),
    ),
  );
  const skillRow = (s: SkillDef, key: string) => {
    const row = h('div.cs-skill', { style: `--sc:${hex(s.color)}` }, h('span.cs-key', key), iconImg('sk_' + s.icon, s.color, 'icon'), h('span.cs-skill-n', L(s.name)), s.unlock > 1 ? h('span.cs-skill-lv', tr(`ур. ${s.unlock}`, `lv ${s.unlock}`)) : null);
    attachTip(row, () => skillTipBody(c, s, key));
    return row;
  };
  const res = c.res;
  return h(
    'div.cs-sheet',
    { style: `--hc:${col}` },
    h('div.cs-head', h('div.cs-name', L(c.name)), h('div.cs-title', L(c.title))),
    h(
      'div.cs-pills',
      h('span.pill', { style: `--pc:${col}` }, L(c.role)),
      h('span.cs-diff', { title: tr('Сложность', 'Difficulty') }, tr('Сложность ', 'Difficulty '), h('b', '★'.repeat(c.difficulty)), h('i', '☆'.repeat(Math.max(0, 3 - c.difficulty)))),
    ),
    h('p.cs-desc', L(c.desc)),
    sec(tr('Характеристики', 'Ratings')),
    ratings,
    h(
      'div.cs-base',
      kv(tr('Здоровье', 'Health'), String(c.baseHp)),
      kv(tr('Скорость', 'Speed'), String(c.baseSpeed)),
      kv(tr('Броня', 'Armor'), String(c.armor)),
      kv(tr('Оружие', 'Weapon'), L(c.weapon)),
    ),
    sec(tr('Ресурс', 'Resource')),
    h(
      'div.cs-res',
      { style: `--rc:${res.color}` },
      h('div.cs-res-top', h('b', L(res.name)), res.orbs ? h('span.cs-orbs', ...Array.from({ length: res.orbs }, () => h('i'))) : h('span.cs-resbar', h('i'))),
      h('span', L(res.desc)),
    ),
    sec(tr('Пассивное умение класса', 'Class passive')),
    h('div.perk', h('b', L(c.passive.name)), h('span', L(c.passive.desc))),
    sec(tr('Идентичность', 'Identity') + ` (${bindKey(kb, 'identity', 'Z')})`),
    h('div.cs-identity', { style: `--sc:${hex(c.identity.color)}` }, iconImg('sk_' + c.identity.icon, c.identity.color, 'icon'), h('div', h('b', L(c.identity.name)), h('span', L(c.identity.desc)))),
    sec(tr('Навыки', 'Skills')),
    h(
      'div.cs-skills',
      (() => {
        const row = h('div.cs-skill.basic', { style: `--sc:${hex(c.color)}` }, h('span.cs-key', tr('ПКМ', 'RMB')), iconImg('sk_' + c.basic.icon, c.color, 'icon'), h('span.cs-skill-n', L(c.basic.name)));
        attachTip(row, () =>
          h(
            'div.cs-tip-body',
            h('div.cs-tip-head', iconImg('sk_' + c.basic.icon, c.color, 'icon'), h('div', h('div.cs-tip-name', L(c.basic.name)), h('div.cs-tip-sub', tr('Базовая атака', 'Basic attack')))),
            h('p', L(c.basic.desc)),
            h('div.cs-tip-kv', h('span', tr('Тип урона', 'Damage type')), h('b', { style: `color:${DMG_COLOR[c.basic.el]}` }, dmgName(c.basic.el))),
            h('div.cs-tip-kv', h('span', tr('Ударов в цепочке', 'Chain hits')), h('b', String(c.basic.steps.length))),
          ),
        );
        return row;
      })(),
      ...c.skills.map((s, i) => skillRow(s, bindKey(kb, SKILL_BINDS[i], SLOT_KEYS[i]))),
      skillRow(c.ult, bindKey(kb, 'ult', 'V')),
    ),
    c.special ? sec(tr('Особое действие', 'Special action') + ` (${bindKey(kb, 'special', 'X')})`) : null,
    c.special ? h('div.perk', h('b', L(c.special.name)), h('span', L(c.special.desc))) : null,
    h('div.kv', h('span', tr('Уклонение', 'Dodge') + ` (${bindKey(kb, 'dodge', 'Space')})`), h('span', `${L(c.dodge.name)} · ${c.dodge.cd}${tr(' сек', 's')}${c.dodge.charges > 1 ? ' ×' + c.dodge.charges : ''}`)),
  );
}

// ------------------------------------------------------------------ 3D stage

export interface ClassStage {
  /** The stage (canvas + overlay); place it anywhere. */
  stage: HTMLElement;
  /** Animation buttons for the current class. */
  anims: HTMLElement;
  viewer: CharacterViewer;
  setClass(c: ClassDef): void;
  dispose(): void;
}

/**
 * Rotatable full-body preview of a class rig with animation buttons. `full` lists every clip
 * grouped (viewer); otherwise a short curated row (class select).
 */
export function classStage(sfx: (id: string) => void, full: boolean): ClassStage {
  const stage = h('div.cv-stage');
  const viewer = new CharacterViewer(stage);
  const anims = h('div.cs-anims' + (full ? '.full' : ''));
  const btns = new Map<string, HTMLElement>();
  let cur: ClassDef | null = null;
  viewer.onModeChange = (m) => {
    for (const [k, b] of btns) b.classList.toggle('sel', k === m);
  };
  const run = (e: AnimEntry) => {
    sfx('ui');
    if (e.gait) viewer.play(e.gait);
    else viewer.playSeq(e.seq, e.key);
  };
  const button = (e: AnimEntry, cls = '') => {
    const missing = !e.gait && e.clips.length > 0 && !e.clips.some((c) => viewer.has(c));
    const b = h('button.cv-anim' + cls + (missing ? '.missing' : ''), { onclick: () => run(e), title: e.clips.join(' → ') || e.label }, e.chip ? h('span.key', e.chip) : null, e.label);
    btns.set(e.key, b);
    return b;
  };
  const build = () => {
    clear(anims);
    btns.clear();
    if (!cur) return;
    const groups = classAnimGroups(cur, (c) => viewer.has(c));
    if (!full) {
      // idle, walk, run, basic chain, Q W E R, ultimate, identity, dodge, victory
      const pick = (g: string) => groups.find((x) => x.id === g)!.items;
      const items = [...pick('loco'), pick('basic')[0], ...pick('skills').slice(0, 4), ...pick('ult'), pick('identity')[0], ...pick('dodge'), pick('react')[3]];
      anims.append(...items.map((e) => button(e)));
    } else {
      for (const g of groups) {
        const row = h('div.cs-agroup', h('div.cs-alabel', g.label));
        const list = h('div.cs-aitems');
        for (const e of g.items) {
          // multi-clip entries also get a chip per clip so each one can be checked alone
          if (e.clips.length > 1 && g.id !== 'basic') {
            const sub = h('div.cs-acombo', button(e));
            e.clips.forEach((clip, i) => sub.append(button({ key: e.key + ':' + i, label: clip.replace(/^[a-z]+_/, ''), seq: [e.seq[i]], clips: [clip] }, '.mini')));
            list.append(sub);
          } else list.append(button(e));
        }
        row.append(list);
        anims.append(row);
      }
    }
    viewer.onModeChange?.(viewer.mode);
  };
  return {
    stage,
    anims,
    viewer,
    setClass(c: ClassDef) {
      cur = c;
      viewer.setHero(c.id, c.color);
      stage.style.setProperty('--hc', hex(c.color));
      build();
    },
    dispose() {
      hideTip();
      viewer.dispose();
    },
  };
}

