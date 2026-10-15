import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { thumbImg } from '../render/Thumbnails';
import { t, L } from '../i18n';
import type { Profile } from '../meta/Profile';
import { CLASSES, classDef } from '../game/action/classes';
import type { ClassDef } from '../game/action/types';
import { SLOT_KEYS } from '../game/action/types';
import { MAX_CHARS, REGION, type CharSave } from '../meta/Characters';
import { SkillSandbox, type DemoAction } from '../render/SkillSandbox';
import { BESTIARY_CATEGORIES, CREATURES } from '../data/bestiary';
import { settingsPanel } from './Settings';
import { attachTip, classStage, hideTip, skillTipBody, tr } from './ClassPreview';
import { fmtTime } from './format';
import './menu.css';

export interface MenuApi {
  profile: Profile;
  version: string;
  sfx(id: string): void;
  /** Enters the world with a saved character. */
  play(charId: string): void;
  /** Captures the next key press for rebinding. */
  captureKey(cb: (code: string) => void): void;
  /** True when a setting changed that only applies after a restart. */
  needsRestart(): boolean;
  applySettings(): void;
  /** Restores the default settings (characters are kept). */
  resetSettings(): void;
  /** Menu campfire with the created characters (empty = a single showcase hero). */
  setCampfire(members: { id: string; cls: string }[], activeId: string | null): void;
  setShowcase(modelId: string): void;
  /** Client-space points above the campfire characters' heads. */
  campfireAnchors(): { id: string; x: number; y: number }[];
  /** Slides the menu backdrop toward the right edge (0 = centred, 1 = right third). */
  setMenuShift(v: number): void;
  /** Stops drawing the 3D menu backdrop while a screen with its own 3D view is open. */
  setBackdropPaused(v: boolean): void;
}

type ScreenId = 'main' | 'continue' | 'create' | 'bestiary' | 'settings';

/** Menu entries in order (main list and the tab bar of the inner screens). */
const ENTRIES: { id: ScreenId | 'exit'; icon: string; ru: string; en: string }[] = [
  { id: 'continue', icon: 'play', ru: 'Продолжить игру', en: 'Continue' },
  { id: 'create', icon: 'helm', ru: 'Создать персонажа', en: 'Create character' },
  { id: 'bestiary', icon: 'skull', ru: 'Бестиарий', en: 'Bestiary' },
  { id: 'settings', icon: 'gear', ru: 'Настройки', en: 'Settings' },
  { id: 'exit', icon: 'door', ru: 'Выход', en: 'Exit' },
];

/** Small square-pixel glyphs for the menu buttons (CSS draws them, see menu.css). */
const glyph = (name: string) => h('i.mm-glyph.g-' + name);

/** Class emblem: the class's identity icon in its colour. */
export function classEmblem(c: ClassDef, cls = 'mm-emblem'): HTMLElement {
  return iconImg('sk_' + c.identity.icon, c.color, cls);
}

/** Readable play time: "2 ч 15 мин" / "2 h 15 min". */
function playTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return tr(`${m} мин`, `${m} min`);
  return tr(`${Math.floor(m / 60)} ч ${m % 60} мин`, `${Math.floor(m / 60)} h ${m % 60} min`);
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

/** Real numbers of a class for the creation screen. */
function classStats(c: ClassDef) {
  const chain = c.basic.steps.reduce((s, st) => s + st.dur, 0);
  return {
    hp: c.baseHp,
    attack: c.power,
    armor: c.armor,
    speed: c.baseSpeed,
    /** Basic attack hits per second. */
    aps: chain > 0 ? c.basic.steps.length / chain : 1,
  };
}
const STAT_MAX = (() => {
  const all = CLASSES.map(classStats);
  return { hp: Math.max(...all.map((s) => s.hp)), attack: Math.max(...all.map((s) => s.attack)), armor: Math.max(...all.map((s) => s.armor)), speed: Math.max(...all.map((s) => s.speed)), aps: Math.max(...all.map((s) => s.aps)) };
})();

/** Out-of-game screens: main menu at the campfire, continue, character creation, bestiary, settings. */
export class Menus {
  readonly root: HTMLElement;
  private stack: ScreenId[] = ['main'];
  /** Tear-down for the open screen (3D viewers, timers, key handlers). */
  private cleanup: (() => void) | null = null;
  /** Character highlighted in the Continue list / at the campfire. */
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
    hideTip();
    clear(this.root);
    const id = this.current;
    this.api.setBackdropPaused(id === 'create');
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
      case 'bestiary':
        return this.bestiaryScreen();
      case 'settings':
        return this.frame(t('menu_settings'), h('div.mm-settings', settingsPanel(this.api, () => this.render())));
    }
  }

  private go(id: ScreenId | 'exit') {
    this.api.sfx('ui');
    if (id === 'exit') this.exitDialog();
    else this.open(id);
  }

  // ------------------------------------------------------------------ campfire
  private showCamp() {
    const p = this.api.profile;
    const chars = p.chars;
    if (!this.sel || !chars.some((c) => c.id === this.sel)) this.sel = p.char?.id ?? chars[0]?.id ?? null;
    if (chars.length) this.api.setCampfire(chars.slice(0, 9).map((c) => ({ id: c.id, cls: c.cls })), this.sel);
    else this.api.setShowcase(CLASSES[0].id);
  }

  // ------------------------------------------------------------------ main
  private mainScreen(): HTMLElement {
    const p = this.api.profile;
    this.showCamp();
    const has = p.data.chars.length > 0;
    const nav = h('nav.mm-nav');
    for (const e of ENTRIES) {
      const off = e.id === 'continue' && !has;
      const b = h(
        'button.mm-btn' + (off ? '.off' : '') + (e.id === 'continue' && has ? '.primary' : ''),
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
      );
      nav.append(b);
    }
    const note = h('div.mm-note');
    // name cards above the characters at the campfire
    const cards = h('div.mm-cards');
    const byId = new Map<string, HTMLElement>();
    for (const c of p.chars.slice(0, 9)) {
      const def = classDef(c.cls);
      const card = h(
        'button.mm-card' + (c.id === this.sel ? '.sel' : ''),
        {
          style: `--hc:${hex(def.color)}`,
          title: tr('Двойной щелчок — играть', 'Double-click to play'),
          onclick: () => {
            if (this.sel === c.id) return;
            this.api.sfx('select');
            this.sel = c.id;
            this.api.profile.selectChar(c.id);
            this.showCamp();
            for (const [k, el] of byId) el.classList.toggle('sel', k === c.id);
          },
          ondblclick: () => this.api.play(c.id),
        },
        classEmblem(def),
        h('div.mm-card-txt', h('b', c.name), h('span', `${L(def.name)} · ${tr('Уровень', 'Level')} ${c.level}`), h('small', L(REGION))),
      );
      byId.set(c.id, card);
      cards.append(card);
    }
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const host = this.root.getBoundingClientRect();
      for (const a of this.api.campfireAnchors()) {
        const el = byId.get(a.id);
        if (!el) continue;
        el.style.transform = `translate(${Math.round(a.x - host.left)}px, ${Math.round(a.y - host.top)}px) translate(-50%, -100%)`;
        el.style.visibility = 'visible';
      }
    };
    if (byId.size) raf = requestAnimationFrame(place);
    this.cleanup = () => cancelAnimationFrame(raf);
    return h(
      'div.mm',
      h('div.mm-side', h('div.mm-logo', h('div.mm-logo-title', 'CUBEBORN'), h('div.mm-logo-sub', t('game_subtitle'))), nav, note),
      cards,
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
    this.showCamp();
    const wrap = h('div.mc');
    const render = () => {
      clear(wrap);
      const chars = p.chars;
      if (!chars.length) {
        wrap.append(
          h('div.mc-empty', h('p', tr('Сохранённых персонажей пока нет.', 'There are no saved characters yet.')), h('button.mm-big', { onclick: () => this.go('create') }, tr('Создать персонажа', 'Create character'))),
        );
        return;
      }
      const list = h('div.mc-list');
      for (const c of chars) {
        const def = classDef(c.cls);
        list.append(
          h(
            'button.mc-row' + (c.id === this.sel ? '.sel' : ''),
            {
              style: `--hc:${hex(def.color)}`,
              onclick: () => {
                if (c.id === this.sel) return;
                this.api.sfx('select');
                this.sel = c.id;
                p.selectChar(c.id);
                this.showCamp();
                render();
              },
              ondblclick: () => this.api.play(c.id),
            },
            thumbImg(c.cls, 'mc-thumb'),
            h('div.mc-txt', h('b', c.name), h('span', `${L(def.name)} · ${tr('Уровень', 'Level')} ${c.level}`), h('small', `${L(REGION)} · ${playTime(c.playTime)}`)),
            classEmblem(def),
          ),
        );
      }
      const cur = chars.find((c) => c.id === this.sel) ?? chars[0];
      const def = classDef(cur.cls);
      const detail = h(
        'div.mc-detail',
        { style: `--hc:${hex(def.color)}` },
        h('div.mc-head', classEmblem(def), h('div', h('h2', cur.name), h('span', `${L(def.name)} · ${tr('Уровень', 'Level')} ${cur.level}`))),
        h('div.mc-kv', h('span', tr('Регион', 'Region')), h('b', L(REGION))),
        h('div.mc-kv', h('span', tr('Время в игре', 'Play time')), h('b', playTime(cur.playTime))),
        h('div.mc-kv', h('span', tr('Очки навыков', 'Skill points')), h('b', String(cur.points))),
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
    const def = classDef(c.cls);
    this.dialog(
      tr(`Удалить персонажа «${c.name}» (${L(def.name)}, ур. ${c.level})? Его уровень и навыки будут потеряны навсегда.`, `Delete "${c.name}" (${L(def.name)}, lv ${c.level})? Their level and skills are lost for good.`),
      [
        { label: tr('Отмена', 'Cancel') },
        {
          label: tr('Удалить', 'Delete'),
          cls: '.danger',
          fn: () => {
            this.api.profile.deleteChar(c.id);
            this.sel = null;
            this.showCamp();
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
   * Character creation: class cards along the bottom, the full-height 3D model in the middle
   * (drag to rotate, wheel to zoom), the class sheet with real numbers, skills, animation
   * preview, the name field and the Choose button on the right.
   */
  private createScreen(): HTMLElement {
    const p = this.api.profile;
    const sfx = (x: string) => this.api.sfx(x);
    const st = classStage(sfx, false);
    let cur: ClassDef = classDef(p.char?.cls ?? CLASSES[0].id);
    let sb: SkillSandbox | null = null;
    const stopDemo = () => {
      if (st.viewer.demoActive) st.viewer.detachDemo();
      sb = null;
    };
    const demo = (key: string, list: DemoAction[]) => {
      sfx('select');
      if (!st.viewer.demoActive || !sb || sb.classId !== cur.id) {
        stopDemo();
        sb = new SkillSandbox(cur.id);
      }
      sb.play(list);
      st.viewer.attachDemo(sb, 'demo:' + key);
    };
    const panel = h('div.cc2-panel');
    const strip = h('div.cc2-strip');
    const err = h('div.cc2-err');
    const input = h('input.cc2-name', { type: 'text', maxlength: '16', placeholder: tr('Имя персонажа', 'Character name'), spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
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
      const c = p.createChar(input.value.trim(), cur.id);
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
    const bar = (label: string, v: number, max: number, text: string, color: string) =>
      h('div.cc2-stat', h('span', label), h('div.cc2-bar', h('i', { style: `width:${Math.round((v / max) * 100)}%;background:${color}` })), h('b', text));
    const showPanel = () => {
      clear(panel);
      const c = cur;
      const s = classStats(c);
      const skill = (sd: ClassDef['skills'][number], key: string, act: DemoAction) => {
        const b = h('button.cc2-skill', { style: `--sc:${hex(sd.color)}`, onclick: () => demo(sd.id, [act]) }, iconImg('sk_' + sd.icon, sd.color, 'icon'), h('span.key', key));
        attachTip(b, () => skillTipBody(c, sd, key));
        return b;
      };
      panel.append(
        h('div.cc2-head', { style: `--hc:${hex(c.color)}` }, classEmblem(c, 'cc2-emblem'), h('div', h('h2', L(c.name)), h('div.cc2-role', `${L(c.role)} · ${L(c.weapon)}`))),
        h('p.cc2-desc', L(c.desc)),
        h(
          'div.cc2-stats',
          bar(tr('Здоровье', 'Health'), s.hp, STAT_MAX.hp, String(s.hp), '#e0454f'),
          bar(tr('Атака', 'Attack'), s.attack, STAT_MAX.attack, String(s.attack), '#ff8a3a'),
          bar(tr('Защита', 'Defense'), s.armor, STAT_MAX.armor, String(s.armor), '#4a9aff'),
          bar(tr('Скорость передвижения', 'Move speed'), s.speed, STAT_MAX.speed, s.speed.toFixed(1), '#f0c040'),
          bar(tr('Скорость атаки', 'Attack speed'), s.aps, STAT_MAX.aps, tr(`${s.aps.toFixed(1)} уд/с`, `${s.aps.toFixed(1)} hits/s`), '#9a6aff'),
        ),
        h('div.cc2-sec', tr('Особенности класса', 'Class features')),
        h('div.cc2-feat', h('b', L(c.passive.name)), h('span', L(c.passive.desc))),
        h('div.cc2-feat', { style: `--rc:${c.res.color}` }, h('b', tr('Ресурс: ', 'Resource: ') + L(c.res.name)), h('span', L(c.res.desc))),
        h('div.cc2-sec', tr('Основные навыки', 'Main skills')),
        h('div.cc2-skills', ...c.skills.slice(0, 4).map((sd, i) => skill(sd, SLOT_KEYS[i], { k: 'skill', slot: i })), skill(c.ult, 'V', { k: 'ult' })),
        h('div.cc2-hint', tr('Нажмите на навык, чтобы увидеть его в действии.', 'Click a skill to see it in action.')),
        h('div.cc2-sec', tr('Просмотр анимации', 'Animation preview')),
        st.anims,
      );
    };
    const pick = (c: ClassDef) => {
      cur = c;
      stopDemo();
      st.setClass(c);
      st.viewer.play('idle');
      for (const el of strip.children) el.classList.toggle('sel', (el as HTMLElement).dataset.id === c.id);
      showPanel();
    };
    for (const c of CLASSES)
      strip.append(
        h(
          'button.cc2-card',
          {
            'data-id': c.id,
            style: `--hc:${hex(c.color)}`,
            onclick: () => {
              if (c.id === cur.id) return;
              sfx('select');
              pick(c);
            },
          },
          thumbImg(c.id, 'cc2-thumb'),
          h('div.cc2-card-name', L(c.name)),
          classEmblem(c, 'cc2-card-em'),
        ),
      );
    const order = CLASSES.map((c) => c.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || document.activeElement === input) return;
      const dir = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      sfx('select');
      pick(classDef(order[(order.indexOf(cur.id) + dir + order.length) % order.length]));
    };
    window.addEventListener('keydown', onKey);
    pick(cur);
    st.viewer.start();
    const choose = h(
      'div.cc2-choose',
      h('label', tr('Имя персонажа', 'Character name'), h('small', tr(`персонажей ${p.data.chars.length} / ${MAX_CHARS}`, `characters ${p.data.chars.length} / ${MAX_CHARS}`))),
      input,
      err,
      full ? h('div.cc2-err', tr('Достигнут предел персонажей — удалите одного в «Продолжить игру».', 'Character limit reached — delete one under Continue.')) : h('button.mm-big.cc2-go', { onclick: submit }, tr('Выбрать', 'Choose')),
    );
    this.cleanup = () => {
      window.removeEventListener('keydown', onKey);
      stopDemo();
      st.dispose();
    };
    const el = h(
      'div.cc2',
      h('div.cc2-stage', st.stage, h('div.cc2-stage-hint', tr('Тяните мышью — вращать · колесо — масштаб · ←/→ — класс', 'Drag to rotate · wheel to zoom · ←/→ — class'))),
      h('div.cc2-right', panel, choose),
      strip,
    );
    setTimeout(() => input.focus(), 60);
    return this.frame(tr('Создание персонажа', 'Create character'), el, '.mm-full');
  }

  // ------------------------------------------------------------------ bestiary
  /**
   * Bestiary: categories on the left, the creature grid and a detail panel. The world has no
   * creatures yet, so the grid shows that nothing has been discovered; entries come from
   * data/bestiary.ts and are unlocked by `profile.data.bestiary` (ids of creatures met).
   */
  private bestiaryScreen(): HTMLElement {
    const seen = new Set(this.api.profile.data.bestiary);
    let cat = 'all';
    const cats = h('div.mb-cats');
    const grid = h('div.mb-grid');
    const detail = h('div.mb-detail');
    const render = () => {
      clear(cats);
      for (const c of BESTIARY_CATEGORIES) {
        const list = CREATURES.filter((x) => c.id === 'all' || x.category === c.id);
        const found = list.filter((x) => seen.has(x.id)).length;
        cats.append(
          h('button.mb-cat' + (cat === c.id ? '.sel' : ''), {
            onclick: () => {
              if (cat === c.id) return;
              this.api.sfx('ui');
              cat = c.id;
              render();
            },
          }, glyph(c.icon), h('span', L(c.name)), h('small', c.id === 'all' ? `${found} / ${list.length}` : String(found))),
        );
      }
      clear(grid);
      clear(detail);
      const shown = CREATURES.filter((x) => (cat === 'all' || x.category === cat) && seen.has(x.id));
      if (!shown.length) {
        grid.append(h('div.mb-empty', glyph('skull'), h('p', tr('Существа пока не обнаружены', 'No creatures discovered yet'))));
        detail.append(h('p.mb-detail-empty', tr('Встреченные в мире существа появятся здесь: описание, характеристики, добыча и анимации.', 'Creatures you meet in the world appear here: description, stats, loot and animations.')));
        return;
      }
      for (const x of shown) grid.append(h('div.mb-cell', thumbImg(x.model, 'mb-thumb'), h('span', L(x.name))));
    };
    render();
    return this.frame(
      tr('Бестиарий', 'Bestiary'),
      h('div.mb', cats, grid, detail, h('button.mm-small.mb-back', { onclick: () => this.back() }, tr('Назад', 'Back'))),
      '.mm-full',
    );
  }
}

export function confirmBox(parent: HTMLElement, text: string, yes: () => void) {
  const box = h(
    'div.modal-back.confirm',
    h(
      'div.modal',
      h('p', text),
      h(
        'div.row',
        h('button.btn', { onclick: () => box.remove() }, t('btn_no')),
        h('button.btn.danger', {
          onclick: () => {
            box.remove();
            yes();
          },
        }, t('btn_yes')),
      ),
    ),
  );
  (parent.closest('.app') ?? parent).appendChild(box);
}

export { settingsPanel, fmtTime };
