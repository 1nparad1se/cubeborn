import { h, clear, hex } from './dom';
import { L } from '../i18n';
import { thumbImg } from '../render/Thumbnails';
import { classDef } from '../game/action/classes';
import { CLASS_GROUPS, MAX_CHARS, groupOf, type CharSave } from '../meta/Characters';
import type { Profile } from '../meta/Profile';
import { classInfo, classStage, tr } from './ClassPreview';
import './charScreens.css';

/** Display line of a character: class · group · level. */
export function charLine(c: CharSave): string {
  return `${L(classDef(c.cls).name)} · ${L(groupOf(c.cls).name)} · ${tr('Ур.', 'Lv')} ${c.level}`;
}

/** Checks a new character name; returns an error text or null. */
export function nameError(p: Profile, raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return tr('Имя должно содержать минимум 2 символа', 'The name needs at least 2 characters');
  if (name.length > 16) return tr('Имя не длиннее 16 символов', 'The name must be at most 16 characters');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(name)) return tr('Только буквы, цифры, пробел, «-» и «_»', 'Letters, digits, space, "-" and "_" only');
  if (p.data.chars.some((c) => c.name.toLowerCase() === name.toLowerCase())) return tr('Персонаж с таким именем уже есть', 'A character with this name already exists');
  return null;
}

export interface CharScreenApi {
  profile: Profile;
  sfx(id: string): void;
  btn(label: string, onclick: () => void, cls?: string): HTMLElement;
}

/**
 * Character creation: class groups (Warrior, Monk, Gunner, Assassin, Mage) with their classes
 * on the left, the rotatable 3D class preview in the middle, the class sheet with the name field
 * and the Create button on the right.
 */
export function createScreen(api: CharScreenApi, start: string, onCreate: (c: CharSave) => void): { el: HTMLElement; dispose(): void } {
  const p = api.profile;
  const st = classStage(api.sfx, false);
  const list = h('div.cs-list.cc-list');
  const info = h('div.detail.cs-info');
  const err = h('div.cc-err');
  const input = h('input.cc-name', { type: 'text', maxlength: '16', placeholder: tr('Имя персонажа', 'Character name'), spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  let cur = groupOf(start).classes.includes(start) ? start : CLASS_GROUPS[0].classes[0];
  const full = p.data.chars.length >= MAX_CHARS;
  const create = api.btn(tr('Создать персонажа', 'Create character'), () => submit(), '.primary.big');
  const submit = () => {
    if (full) return;
    const e = nameError(p, input.value);
    err.textContent = e ?? '';
    if (e) {
      input.focus();
      return;
    }
    const c = p.createChar(input.value.trim(), cur);
    if (c) onCreate(c);
  };
  input.addEventListener('input', () => {
    err.textContent = input.value.trim() ? (nameError(p, input.value) ?? '') : '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') e.stopPropagation();
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      submit();
    }
  });
  const order = CLASS_GROUPS.flatMap((g) => g.classes);
  const show = (id: string) => {
    cur = id;
    for (const el of list.querySelectorAll<HTMLElement>('.cs-card')) el.classList.toggle('sel', el.dataset.id === id);
    const c = classDef(id);
    st.setClass(c);
    clear(info);
    info.append(classInfo(c, p.data.settings.keybinds));
  };
  for (const g of CLASS_GROUPS) {
    list.append(h('div.cc-group', L(g.name)));
    for (const id of g.classes) {
      const c = classDef(id);
      list.append(
        h(
          'button.cs-card',
          {
            'data-id': id,
            style: `--hc:${hex(c.color)}`,
            onclick: () => {
              api.sfx('select');
              show(id);
            },
          },
          thumbImg(id, 'thumb'),
          h('div.cs-card-txt', h('div.cs-card-name', L(c.name)), h('div.cs-card-role', L(c.role)), h('div.cs-card-diff', '★'.repeat(c.difficulty) + '☆'.repeat(Math.max(0, 3 - c.difficulty)))),
        ),
      );
    }
  }
  const step = (dir: number) => {
    const i = order.indexOf(cur);
    api.sfx('select');
    show(order[(i + dir + order.length) % order.length]);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented || document.activeElement === input) return;
    if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') step(-1);
    else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  show(cur);
  st.viewer.play('idle');
  st.viewer.start();
  const foot = h(
    'div.detail.cs-foot.cc-foot',
    h('label.cc-label', tr('Имя персонажа', 'Character name'), h('span.cc-count', tr(`до 16 символов · ${p.data.chars.length}/${MAX_CHARS} персонажей`, `up to 16 characters · ${p.data.chars.length}/${MAX_CHARS} characters`))),
    input,
    err,
    full ? h('div.locked-note', tr('Достигнут предел персонажей — удалите одного, чтобы создать нового', 'Character limit reached — delete one to create another')) : create,
  );
  const el = h(
    'div.cs.cc',
    list,
    h(
      'div.cs-center',
      h('div.cv-stage-wrap.cs-stage', st.stage, h('button.cv-nav.prev', { onclick: () => step(-1) }, '‹'), h('button.cv-nav.next', { onclick: () => step(1) }, '›'), h('div.cv-hint', tr('Тяните мышью — вращать · колесо — масштаб · ←/→ — класс', 'Drag to rotate · wheel to zoom · ←/→ — class'))),
      st.anims,
    ),
    h('div.cs-right', info, foot),
  );
  setTimeout(() => input.focus(), 50);
  return {
    el,
    dispose() {
      window.removeEventListener('keydown', onKey);
      st.dispose();
    },
  };
}

export interface RosterHooks {
  /** Active character changed (the campfire follows). */
  onSelect(): void;
  onCreate(): void;
  onPlay(): void;
  confirm(text: string, yes: () => void): void;
  /** Developer mode: start any class without a character. */
  onDevClass?: () => void;
}

/**
 * Character roster: every created character (name, class, group, level) with select, delete
 * and "create new"; the campfire backdrop stays visible on the right.
 */
export function rosterScreen(api: CharScreenApi, hooks: RosterHooks): HTMLElement {
  const p = api.profile;
  const root = h('div.roster');
  const render = () => {
    clear(root);
    const active = p.char;
    const list = h('div.roster-list');
    for (const c of p.data.chars) {
      const def = classDef(c.cls);
      list.append(
        h(
          'button.roster-card' + (c.id === active?.id ? '.sel' : ''),
          {
            'data-id': c.id,
            style: `--hc:${hex(def.color)}`,
            onclick: () => {
              if (c.id === active?.id) return;
              api.sfx('select');
              p.selectChar(c.id);
              hooks.onSelect();
              render();
            },
            ondblclick: () => hooks.onPlay(),
          },
          thumbImg(c.cls, 'thumb'),
          h('div.roster-txt', h('div.roster-name', c.name), h('div.roster-cls', `${L(def.name)} · ${L(groupOf(c.cls).name)}`)),
          h('div.roster-lv', h('small', tr('Ур.', 'Lv')), String(c.level)),
        ),
      );
    }
    const n = p.data.chars.length;
    if (n < MAX_CHARS) list.append(h('button.roster-card.new', { onclick: () => hooks.onCreate() }, h('div.roster-plus', '+'), h('div.roster-txt', h('div.roster-name', tr('Новый персонаж', 'New character')), h('div.roster-cls', `${n}/${MAX_CHARS}`))));
    const detail = h('div.detail.roster-detail');
    if (active) {
      const def = classDef(active.cls);
      detail.append(
        h('div.cs-head', { style: `--hc:${hex(def.color)}` }, h('div.cs-name', active.name), h('div.cs-title', charLine(active))),
        h('div.kv', h('span', tr('Забегов', 'Runs')), h('span', String(active.runs))),
        h('div.kv', h('span', tr('Очки навыков', 'Skill points')), h('span', String(active.points))),
        h(
          'div.roster-btns',
          api.btn(tr('Выбрать карту', 'Choose map') + ' →', () => hooks.onPlay(), '.primary.big'),
          api.btn(tr('Удалить', 'Delete'), () =>
            hooks.confirm(tr(`Удалить персонажа «${active.name}» (${L(def.name)}, ур. ${active.level})? Его уровень, навыки и предметы будут потеряны навсегда.`, `Delete "${active.name}" (${L(def.name)}, lv ${active.level})? Their level, skills and items are lost for good.`), () => {
              p.deleteChar(active.id);
              hooks.onSelect();
              if (!p.data.chars.length) hooks.onCreate();
              else render();
            }),
          '.danger'),
        ),
      );
    } else detail.append(h('p', tr('Персонажей пока нет — создайте первого.', 'No characters yet — create your first one.')), api.btn(tr('Создать персонажа', 'Create character'), () => hooks.onCreate(), '.primary.big'));
    if (hooks.onDevClass) detail.append(api.btn(tr('Разработчик: любой класс', 'Developer: any class'), () => hooks.onDevClass!()));
    root.append(h('div.roster-col', h('div.roster-title', tr('Персонажи', 'Characters')), list), detail);
  };
  render();
  return root;
}
