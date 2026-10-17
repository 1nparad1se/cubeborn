import { h, clear } from './dom';
import { t, L } from '../i18n';
import type { Profile } from '../meta/Profile';
import { MAX_CHARS, type CharSave } from '../meta/Characters';
import { playableRaces, RACE_BY_ID, type RaceDef } from '../rpg/races';
import { TEST_MAP } from '../rpg/testMap';
import { settingsPanel, leaveSettings } from './Settings';
import { tr } from './tr';
import './menu.css';

export interface MenuApi {
  profile: Profile;
  version: string;
  sfx(id: string): void;
  /** Enters the training meadow with a saved character. */
  play(charId: string): void;
  /** Captures the next key press for rebinding. */
  captureKey(cb: (code: string) => void): void;
  /** True when a setting changed that only applies after a restart. */
  needsRestart(): boolean;
  applySettings(): void;
  /** Restores the default settings (characters are kept). */
  resetSettings(): void;
  /** Slides the menu backdrop toward the right edge (0 = centred, 1 = right third). */
  setMenuShift(v: number): void;
}

type ScreenId = 'main' | 'continue' | 'create' | 'settings';

/** Menu entries in order (main list and the tab bar of the inner screens). */
const ENTRIES: { id: ScreenId | 'exit'; icon: string; ru: string; en: string }[] = [
  { id: 'continue', icon: 'play', ru: 'Продолжить игру', en: 'Continue' },
  { id: 'create', icon: 'helm', ru: 'Создать персонажа', en: 'Create character' },
  { id: 'settings', icon: 'gear', ru: 'Настройки', en: 'Settings' },
  { id: 'exit', icon: 'door', ru: 'Выход', en: 'Exit' },
];

/** Small square-pixel glyphs for the menu buttons (CSS draws them, see menu.css). */
const glyph = (name: string) => h('i.mm-glyph.g-' + name);

/** Readable play time: "2 ч 15 мин" / "2 h 15 min". */
function playTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return tr(`${m} мин`, `${m} min`);
  return tr(`${Math.floor(m / 60)} ч ${m % 60} мин`, `${Math.floor(m / 60)} h ${m % 60} min`);
}

/** Checks a new character name; returns an error text or null. */
function nameError(p: Profile, raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return tr('Имя должно содержать минимум 2 символа', 'The name needs at least 2 characters');
  if (name.length > 16) return tr('Имя не длиннее 16 символов', 'The name must be at most 16 characters');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(name)) return tr('Только буквы, цифры, пробел, «-» и «_»', 'Letters, digits, space, "-" and "_" only');
  if (p.data.chars.some((c) => c.name.toLowerCase() === name.toLowerCase())) return tr('Персонаж с таким именем уже есть', 'A character with this name already exists');
  return null;
}

/** Out-of-game screens: main menu, continue, character creation, settings. */
export class Menus {
  readonly root: HTMLElement;
  private stack: ScreenId[] = ['main'];
  /** Tear-down for the open screen (3D viewers, timers, key handlers). */
  private cleanup: (() => void) | null = null;
  /** Character highlighted in the Continue list. */
  private sel: string | null = null;

  constructor(parent: HTMLElement, private api: MenuApi) {
    this.root = h('div.menus');
    parent.appendChild(this.root);
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
    if (!v) {
      this.cleanup?.();
      this.cleanup = null;
    }
  }

  get current(): ScreenId {
    return this.stack[this.stack.length - 1];
  }

  /** True when a screen other than the main menu is open. */
  get canGoBack(): boolean {
    return this.current !== 'main' || !!this.root.querySelector('.mm-dialog');
  }

  open(id: ScreenId) {
    if (id === 'main') this.stack = ['main'];
    else this.stack = ['main', id];
    this.render();
  }

  back() {
    const dlg = this.root.querySelector('.mm-dialog');
    const sdlg = this.root.closest('.app')?.querySelector('.st-dialog');
    if (sdlg) {
      sdlg.remove();
      return;
    }
    if (this.current === 'settings') {
      leaveSettings(this.api, this.root, () => {
        this.api.sfx('uiBack');
        this.open('main');
      });
      return;
    }
    if (dlg) {
      dlg.remove();
      return;
    }
    this.api.sfx('uiBack');
    this.open('main');
  }

  home() {
    this.open('main');
  }

  render() {
    this.cleanup?.();
    this.cleanup = null;
    clear(this.root);
    const id = this.current;
    const el = this.build(id);
    el.classList.add('screen', 'screen-' + id);
    this.root.appendChild(el);
    this.api.setMenuShift(id === 'main' ? 0.35 : id === 'continue' ? 0.75 : 1);
  }

  private build(id: ScreenId): HTMLElement {
    switch (id) {
      case 'main':
        return this.mainScreen();
      case 'continue':
        return this.continueScreen();
      case 'create':
        return this.createScreen();
      case 'settings':
        return this.frame(t('menu_settings'), settingsPanel(this.api, () => this.render(), () => this.open('main')), '.mm-full');
    }
  }

  private go(id: ScreenId | 'exit') {
    this.api.sfx('ui');
    const go = () => (id === 'exit' ? this.exitDialog() : this.open(id));
    if (this.current === 'settings') leaveSettings(this.api, this.root, go);
    else go();
  }

  // ------------------------------------------------------------------ main
  private mainScreen(): HTMLElement {
    const p = this.api.profile;
    const has = p.data.chars.length > 0;
    const nav = h('nav.mm-nav');
    const note = h('div.mm-note');
    for (const e of ENTRIES) {
      const off = e.id === 'continue' && !has;
      nav.append(
        h(
          'button.mm-btn' + (off ? '.off' : '') + ((e.id === 'continue' && has) || (e.id === 'create' && !has) ? '.primary' : ''),
          {
            onclick: () => {
              if (off) {
                this.api.sfx('denied');
                note.textContent = tr('Сохранённых персонажей пока нет. Создайте первого.', 'No saved characters yet. Create your first one.');
                note.classList.add('show');
                return;
              }
              this.go(e.id);
            },
          },
          glyph(e.icon),
          h('span.mm-label', tr(e.ru, e.en)),
          h('span.mm-arrow', '›'),
        ),
      );
    }
    const cur = p.char;
    return h(
      'div.mm',
      h(
        'div.mm-side',
        h('div.mm-logo', h('div.mm-logo-title', 'CUBEBORN'), h('div.mm-logo-sub', t('game_subtitle'))),
        nav,
        note,
        cur ? h('div.mm-last', tr('Последний персонаж: ', 'Last character: '), h('b', cur.name), ` · ${RACE_BY_ID[cur.race]?.name ?? ''}`) : null,
      ),
      h('div.mm-ver', this.api.version),
    );
  }

  /** Inner screen frame: tab bar of the menu entries on top, back button, title, body. */
  private frame(title: string, body: HTMLElement, cls = ''): HTMLElement {
    const bar = h('div.mm-tabs');
    for (const e of ENTRIES) {
      const off = e.id === 'continue' && !this.api.profile.data.chars.length;
      bar.append(
        h('button.mm-tab' + (e.id === this.current ? '.sel' : '') + (off ? '.off' : ''), {
          onclick: () => {
            if (e.id === this.current || off) return;
            this.go(e.id);
          },
        }, glyph(e.icon), h('span', tr(e.ru, e.en))),
      );
    }
    return h(
      'div.mm-frame' + cls,
      h('div.mm-top', h('button.mm-back', { title: 'Esc', onclick: () => this.back() }, '←'), h('h1.mm-title', title), bar),
      h('div.mm-body', body),
    );
  }

  // ------------------------------------------------------------------ continue
  private continueScreen(): HTMLElement {
    const p = this.api.profile;
    const wrap = h('div.mc');
    const render = () => {
      clear(wrap);
      const chars = p.chars;
      if (!chars.length) {
        wrap.append(h('div.mc-empty', h('p', tr('Сохранённых персонажей пока нет.', 'There are no saved characters yet.')), h('button.mm-big', { onclick: () => this.go('create') }, tr('Создать персонажа', 'Create character'))));
        return;
      }
      if (!this.sel || !chars.some((c) => c.id === this.sel)) this.sel = p.char?.id ?? chars[0].id;
      const list = h('div.mc-list');
      for (const c of chars) {
        list.append(
          h(
            'button.mc-row' + (c.id === this.sel ? '.sel' : ''),
            {
              onclick: () => {
                if (c.id === this.sel) return;
                this.api.sfx('select');
                this.sel = c.id;
                p.selectChar(c.id);
                render();
              },
              ondblclick: () => this.api.play(c.id),
            },
            h('div.mc-txt', h('b', c.name), h('span', `${RACE_BY_ID[c.race]?.name ?? ''} · ${tr('Уровень', 'Level')} ${c.level}`), h('small', `${L(TEST_MAP.name)} · ${playTime(c.playTime)}`)),
          ),
        );
      }
      const cur = chars.find((c) => c.id === this.sel) ?? chars[0];
      const detail = h(
        'div.mc-detail',
        h('div.mc-head', h('div', h('h2', cur.name), h('span', `${RACE_BY_ID[cur.race]?.name ?? ''} · ${tr('Уровень', 'Level')} ${cur.level}`))),
        h('div.mc-kv', h('span', tr('Локация', 'Location')), h('b', L(TEST_MAP.name))),
        h('div.mc-kv', h('span', tr('Время в игре', 'Play time')), h('b', playTime(cur.playTime))),
        h('div.mc-kv', h('span', tr('Последняя игра', 'Last played')), h('b', new Date(cur.lastPlayed).toLocaleDateString())),
        h('button.mm-big', { onclick: () => this.api.play(cur.id) }, tr('Играть', 'Play')),
        h('button.mm-small.danger', { onclick: () => this.deleteDialog(cur, render) }, tr('Удалить персонажа', 'Delete character')),
      );
      wrap.append(h('div.mc-col', h('div.mc-count', tr(`Персонажи: ${chars.length} / ${MAX_CHARS}`, `Characters: ${chars.length} / ${MAX_CHARS}`)), list), detail);
    };
    render();
    return this.frame(tr('Продолжить игру', 'Continue'), wrap, '.mm-left');
  }

  private deleteDialog(c: CharSave, done: () => void) {
    this.dialog(
      tr(`Удалить персонажа «${c.name}» (${RACE_BY_ID[c.race]?.name ?? ''}, ур. ${c.level})? Он и его снаряжение будут потеряны навсегда.`, `Delete "${c.name}"? The character and its gear are lost for good.`),
      [
        { label: tr('Отмена', 'Cancel') },
        {
          label: tr('Удалить', 'Delete'),
          cls: '.danger',
          fn: () => {
            this.api.profile.deleteChar(c.id);
            this.sel = null;
            done();
          },
        },
      ],
    );
  }

  /** Modal question with buttons; Esc or a button closes it. */
  private dialog(text: string, buttons: { label: string; cls?: string; fn?: () => void }[]) {
    const box: HTMLElement = h(
      'div.mm-dialog',
      h(
        'div.mm-dialog-box',
        h('p', text),
        h(
          'div.mm-dialog-btns',
          ...buttons.map((b) =>
            h('button.mm-small' + (b.cls ?? ''), {
              onclick: () => {
                this.api.sfx('ui');
                box.remove();
                b.fn?.();
              },
            }, b.label),
          ),
        ),
      ),
    );
    this.root.appendChild(box);
  }

  // ------------------------------------------------------------------ exit
  private exitDialog() {
    this.dialog(tr('Выйти из игры? Все персонажи и настройки уже сохранены.', 'Quit the game? All characters and settings are saved.'), [
      { label: tr('Отмена', 'Cancel') },
      {
        label: tr('Выйти', 'Quit'),
        cls: '.primary',
        fn: () => {
          this.api.profile.save();
          // a page can close only a window it opened itself; otherwise say how to leave
          window.close();
          setTimeout(() => {
            if (window.closed) return;
            this.dialog(tr('Браузер не даёт странице закрыть себя. Закройте вкладку, чтобы выйти, — прогресс сохранён.', 'The browser does not let a page close itself. Close the tab to quit — your progress is saved.'), [{ label: tr('Понятно', 'OK') }]);
          }, 250);
        },
      },
    ]);
  }

  // ------------------------------------------------------------------ create
  /**
   * Character creation: pick a race (only «Человек» is available for now) and a name, then
   * confirm. No class, gender, appearance or stats: every human starts the same. The hero stands
   * in the 3D backdrop beside the panel.
   */
  private createScreen(): HTMLElement {
    const p = this.api.profile;
    const sfx = (x: string) => this.api.sfx(x);
    const races = playableRaces();
    let race: RaceDef = races[0];
    const err = h('div.cc-err');
    const input = h('input.cc-name', { type: 'text', maxlength: '16', placeholder: tr('Имя персонажа', 'Character name'), spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
    const full = p.data.chars.length >= MAX_CHARS;
    const submit = () => {
      if (full) return;
      const e = nameError(p, input.value);
      err.textContent = e ?? '';
      if (e) {
        sfx('denied');
        input.focus();
        return;
      }
      const c = p.createChar(input.value.trim(), race.id);
      if (!c) return;
      sfx('select');
      this.sel = c.id;
      this.api.play(c.id);
    };
    input.addEventListener('input', () => (err.textContent = input.value.trim() ? (nameError(p, input.value) ?? '') : ''));
    input.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        submit();
      }
    });
    const desc = h('p.cc-desc');
    const cards = h('div.cc-races');
    const pick = (r: RaceDef) => {
      race = r;
      desc.textContent = r.desc;
      for (const el of cards.children) el.classList.toggle('sel', (el as HTMLElement).dataset.id === r.id);
    };
    for (const r of races)
      cards.append(
        h('button.cc-race', { 'data-id': r.id, onclick: () => (sfx('select'), pick(r)) }, h('i.cc-race-ico'), h('b', r.name), h('small', tr('Доступна', 'Available'))),
      );
    pick(race);
    const b = race.base;
    const panel = h(
      'div.cc-panel',
      h('div.cc-sec', tr('Раса', 'Race')),
      cards,
      desc,
      h('div.cc-base', h('div', h('span', 'Здоровье'), h('b', String(b.maxHp))), h('div', h('span', 'Скорость'), h('b', `${b.moveSpeed} бл/с`)), h('div', h('span', 'Защита'), h('b', String(b.physDef)))),
      h('p.cc-note', 'Класса нет: стиль боя определяет оружие. Все стартовые предметы уже лежат в сумке.'),
      h('div.cc-sec', tr('Имя персонажа', 'Character name'), h('small', ` · ${p.data.chars.length} / ${MAX_CHARS}`)),
      input,
      err,
      full ? h('div.cc-err', tr('Достигнут предел персонажей — удалите одного в «Продолжить игру».', 'Character limit reached.')) : h('button.mm-big.cc-go', { onclick: submit }, tr('Подтвердить', 'Confirm')),
    );
    setTimeout(() => input.focus(), 60);
    return this.frame(tr('Создание персонажа', 'Create character'), h('div.cc', panel), '.mm-left');
  }
}

