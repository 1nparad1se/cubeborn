import { h, clear } from './dom';
import { LANGS, setLang, type Lang } from '../i18n';
import { keyName } from '../input/Input';
import { QUALITY_PRESETS, defaultKeybinds, defaultSettings, type BindAction, type Quality, type Settings } from '../meta/Save';
import type { MenuApi } from './Menus';
import { tr } from './tr';
import './settings.css';

const RESOLUTIONS: [number, number][] = [
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];

/** Resolutions that fit the current monitor (in physical pixels). */
export function availableResolutions(): string[] {
  const dpr = window.devicePixelRatio || 1;
  const sw = Math.round((window.screen?.width || 1920) * dpr);
  const sh = Math.round((window.screen?.height || 1080) * dpr);
  const out = RESOLUTIONS.filter(([w, hh]) => w <= sw && hh <= sh).map(([w, hh]) => `${w}x${hh}`);
  return out.length ? out : ['1280x720'];
}

type Section = 'screen' | 'graphics' | 'game' | 'audio' | 'controls' | 'other';
const SECTIONS: { id: Section; icon: string; ru: string; en: string }[] = [
  { id: 'screen', icon: 'monitor', ru: 'Экран', en: 'Display' },
  { id: 'graphics', icon: 'gem', ru: 'Графика', en: 'Graphics' },
  { id: 'game', icon: 'sword', ru: 'Игра', en: 'Gameplay' },
  { id: 'audio', icon: 'note', ru: 'Звук', en: 'Audio' },
  { id: 'controls', icon: 'keys', ru: 'Управление', en: 'Controls' },
  { id: 'other', icon: 'dots', ru: 'Прочее', en: 'Other' },
];

/** Settings each section owns ("По умолчанию" resets only these). */
const SECTION_KEYS: Record<Section, (keyof Settings)[]> = {
  screen: ['displayMode', 'resolution', 'vsync', 'fpsLimit', 'uiScale'],
  graphics: ['quality', 'shadows', 'effects', 'particles', 'viewDistance', 'antiAliasing', 'textures', 'postProcessing'],
  game: ['cameraZoom', 'screenShake', 'damageNumbers', 'showFps', 'showHints', 'autoPause'],
  audio: ['master', 'music', 'sfx', 'ambient', 'ui'],
  controls: ['keybinds', 'swapMouse', 'invertWheel'],
  other: ['lang'],
};

const SUB_KEYS = ['shadows', 'effects', 'particles', 'viewDistance', 'antiAliasing', 'textures', 'postProcessing'] as const;

const BIND_LABEL: Record<BindAction, [string, string]> = {
  up: ['Вперёд', 'Up'],
  down: ['Назад', 'Down'],
  left: ['Влево', 'Left'],
  right: ['Вправо', 'Right'],
  jump: ['Прыжок', 'Jump'],
  attack: ['Базовая атака (по цели)', 'Basic attack'],
  inventory: ['Инвентарь и снаряжение', 'Inventory'],
  pause: ['Пауза', 'Pause'],
  zoomIn: ['Приблизить камеру', 'Zoom in'],
  zoomOut: ['Отдалить камеру', 'Zoom out'],
};
const bindLabel = (a: BindAction) => tr(...BIND_LABEL[a]);
const BIND_GROUPS: [string, string, BindAction[]][] = [
  ['Передвижение', 'Movement', ['up', 'down', 'left', 'right', 'jump']],
  ['Бой', 'Combat', ['attack']],
  ['Экраны и камера', 'Screens and camera', ['inventory', 'pause', 'zoomIn', 'zoomOut']],
];
/** Actions that need a key (warned about when left without one). */
const ESSENTIAL: BindAction[] = ['jump', 'attack', 'inventory'];

let section: Section = 'screen';
/** Settings as last applied; edits made since are a preview until «Применить». */
let applied: Settings | null = null;

const clone = (s: Settings): Settings => JSON.parse(JSON.stringify(s));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** True when the open settings screen has changes that were not applied. */
export function settingsDirty(api: MenuApi): boolean {
  return !!applied && !same(applied, api.profile.data.settings);
}

/**
 * Leaving the settings: with unapplied changes asks to apply or discard them first.
 * `go` runs once the settings are settled.
 */
export function leaveSettings(api: MenuApi, host: HTMLElement, go: () => void) {
  if (!settingsDirty(api)) {
    closeDraft(api);
    go();
    return;
  }
  stDialog(host, tr('Есть изменения, которые не применены.', 'Some changes are not applied.'), [
    { label: tr('Отмена', 'Cancel') },
    {
      label: tr('Не сохранять', 'Discard'),
      fn: () => {
        revert(api);
        go();
      },
    },
    {
      label: tr('Применить', 'Apply'),
      primary: true,
      fn: () => {
        apply(api);
        closeDraft(api);
        go();
      },
    },
  ]);
}

function apply(api: MenuApi) {
  const s = api.profile.data.settings;
  applied = clone(s);
  api.profile.committedSettings = null;
  api.profile.save();
  api.profile.committedSettings = applied;
}

function revert(api: MenuApi) {
  if (applied) {
    const back = clone(applied);
    api.profile.data.settings = back;
    setLang(back.lang);
    api.applySettings();
  }
  closeDraft(api);
}

function closeDraft(api: MenuApi) {
  applied = null;
  api.profile.committedSettings = null;
}

function stDialog(host: HTMLElement, text: string, buttons: { label: string; primary?: boolean; fn?: () => void }[]) {
  const box: HTMLElement = h(
    'div.st-dialog',
    h(
      'div.st-dialog-box',
      h('p', text),
      h(
        'div.st-dialog-btns',
        ...buttons.map((b) =>
          h('button.st-btn' + (b.primary ? '.primary' : ''), {
            onclick: () => {
              box.remove();
              b.fn?.();
            },
          }, b.label),
        ),
      ),
    ),
  );
  (host.closest('.app') ?? host).appendChild(box);
}

/**
 * Settings screen in the main-menu style: six sections on the left, the options of the section
 * on the right, «По умолчанию», «Применить» and «Назад» at the bottom. Changes preview at once
 * and are saved by «Применить»; leaving without it asks first. Shared by the menu and the pause.
 */
export function settingsPanel(api: MenuApi, rerender: () => void, onBack: () => void): HTMLElement {
  if (!applied) {
    applied = clone(api.profile.data.settings);
    api.profile.committedSettings = applied;
  }
  const s = () => api.profile.data.settings;
  const nav = h('nav.st-nav');
  const body = h('div.st-body');
  const head = h('div.st-head');
  const applyBtn = h('button.st-btn.primary', {
    onclick: () => {
      if (!settingsDirty(api)) return;
      api.sfx('select');
      apply(api);
      flash(tr('Настройки применены и сохранены.', 'Settings applied and saved.'));
      refresh();
    },
  }, tr('Применить', 'Apply'));
  const status = h('div.st-status');
  let flashT = 0;
  const flash = (text: string) => {
    status.textContent = text;
    status.classList.add('show');
    clearTimeout(flashT);
    flashT = window.setTimeout(() => status.classList.remove('show'), 2400);
  };
  const changed = () => {
    api.applySettings();
    refresh();
  };
  const refresh = () => {
    const dirty = settingsDirty(api);
    applyBtn.toggleAttribute('disabled', !dirty);
    root.classList.toggle('dirty', dirty);
  };

  // ---------------------------------------------------------------- controls
  const row = (label: string, control: HTMLElement, hint?: string) => h('div.st-row', h('div.st-label', h('span', label), hint ? h('small', hint) : null), h('div.st-ctl', control));
  const group = (title: string) => h('div.st-group', title);
  const slider = (label: string, get: () => number, set: (v: number) => void, o: { min?: number; max?: number; k?: number; fmt?: (v: number) => string; hint?: string } = {}) => {
    const k = o.k ?? 100;
    const fmt = o.fmt ?? ((v: number) => Math.round(v * 100) + '%');
    const val = h('span.st-val', fmt(get()));
    const input = h('input.st-range', { type: 'range', min: o.min ?? 0, max: o.max ?? 100, value: Math.round(get() * k) }) as HTMLInputElement;
    const paint = () => input.style.setProperty('--p', ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100 + '%');
    paint();
    input.addEventListener('input', () => {
      set(Number(input.value) / k);
      val.textContent = fmt(get());
      paint();
      changed();
    });
    return row(label, h('div.st-slider', input, val), o.hint);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void, hint?: string) => {
    const b = h('button.st-toggle' + (get() ? '.on' : ''), {
      role: 'switch',
      onclick: () => {
        set(!get());
        b.classList.toggle('on', get());
        txt.textContent = get() ? tr('Вкл', 'On') : tr('Выкл', 'Off');
        api.sfx('ui');
        changed();
      },
    }, h('i'));
    const txt = h('span.st-toggle-txt', get() ? tr('Вкл', 'On') : tr('Выкл', 'Off'));
    return row(label, h('div.st-toggle-wrap', b, txt), hint);
  };
  const seg = <T extends string | number>(label: string, opts: { id: T; name: string }[], get: () => T, set: (v: T) => void, hint?: string) => {
    const box = h('div.st-seg');
    const draw = () => {
      clear(box);
      for (const o of opts)
        box.append(
          h('button' + (o.id === get() ? '.sel' : ''), {
            onclick: () => {
              if (o.id === get()) return;
              api.sfx('ui');
              set(o.id);
              draw();
              changed();
            },
          }, o.name),
        );
    };
    draw();
    return row(label, box, hint);
  };
  const lv3 = () => [
    { id: 'low' as const, name: tr('Низко', 'Low') },
    { id: 'medium' as const, name: tr('Средне', 'Medium') },
    { id: 'high' as const, name: tr('Высоко', 'High') },
  ];
  const off = () => tr('Выкл', 'Off');
  /** Changing a graphics sub-setting turns the preset into "custom". */
  const sub = <K extends (typeof SUB_KEYS)[number]>(key: K) => (v: Settings[K]) => {
    s()[key] = v;
    s().quality = 'custom';
    renderBody();
  };

  // ---------------------------------------------------------------- key binding
  let bindNote = '';
  const bindRow = (a: BindAction, clash: Set<string>) => {
    const st = s();
    const all = Object.keys(defaultKeybinds()) as BindAction[];
    const keys = h('div.st-binds');
    for (let slot = 0; slot < 2; slot++) {
      const code = st.keybinds[a][slot] ?? '';
      const b = h('button.st-key' + (code ? '' : '.empty') + (code && clash.has(code) ? '.conflict' : ''), {
        onclick: () => {
          api.sfx('ui');
          b.textContent = tr('Нажмите клавишу…', 'Press a key…');
          b.classList.add('wait');
          api.captureKey((c) => {
            bindNote = '';
            if (c !== 'Escape' || a === 'pause') {
              if (c === 'Backspace' || c === 'Delete') st.keybinds[a].splice(slot, 1);
              else {
                const from = all.filter((o) => o !== a && st.keybinds[o].includes(c));
                for (const other of all) if (other !== a) st.keybinds[other] = st.keybinds[other].filter((k) => k !== c);
                const list = [...st.keybinds[a]];
                if (slot < list.length) list[slot] = c;
                else list.push(c);
                st.keybinds[a] = list.filter((k, i) => list.indexOf(k) === i);
                if (from.length) bindNote = tr(`Клавиша ${keyName(c)} переназначена на «${bindLabel(a)}» и снята с: ${from.map(bindLabel).join(', ')}.`, `${keyName(c)} now does "${bindLabel(a)}" and was removed from: ${from.map(bindLabel).join(', ')}.`);
              }
              changed();
            }
            renderBody();
          });
        },
      }, code ? keyName(code) : '—');
      keys.append(b);
    }
    return row(bindLabel(a), keys);
  };

  // ---------------------------------------------------------------- sections
  const renderBody = () => {
    const st = s();
    clear(body);
    const sec = SECTIONS.find((x) => x.id === section)!;
    clear(head);
    head.append(h('h2', tr(sec.ru, sec.en)));
    switch (section) {
      case 'screen': {
        const res = availableResolutions();
        body.append(
          seg(tr('Режим окна', 'Window mode'), [
            { id: 'windowed', name: tr('В окне', 'Windowed') },
            { id: 'fullscreen', name: tr('Полный экран', 'Fullscreen') },
            { id: 'borderless', name: tr('Без рамки', 'Borderless') },
          ], () => st.displayMode, (v) => (st.displayMode = v), tr('В браузере полный экран и режим без рамки работают одинаково: игра занимает весь экран без панелей браузера.', 'In a browser, fullscreen and borderless behave the same: the game fills the screen without browser bars.')),
          seg(tr('Разрешение', 'Resolution'), [{ id: 'native', name: tr('Родное', 'Native') }, ...res.map((r) => ({ id: r, name: r.replace('x', '×') }))], () => (st.resolution === 'native' || res.includes(st.resolution) ? st.resolution : 'native'), (v) => (st.resolution = v), tr('Разрешение отрисовки 3D-сцены; показаны только подходящие вашему монитору.', 'Render resolution of the 3D scene; only ones that fit your monitor are listed.')),
          toggle(tr('Вертикальная синхронизация', 'Vertical sync'), () => st.vsync, (v) => (st.vsync = v)),
          seg(tr('Ограничение кадров', 'Frame limit'), [30, 60, 120, 144, 165, 240, 0].map((n) => ({ id: n, name: n ? String(n) : '∞' })), () => st.fpsLimit, (v) => (st.fpsLimit = v)),
          slider(tr('Масштаб интерфейса', 'Interface scale'), () => st.uiScale, (v) => (st.uiScale = v), { min: 80, max: 130, hint: tr('Размер меню, панелей и подсказок.', 'Size of menus, panels and hints.') }),
        );
        break;
      }
      case 'graphics':
        body.append(
          seg<Quality>(tr('Общее качество', 'Overall quality'), [
            { id: 'low', name: tr('Низкое', 'Low') },
            { id: 'medium', name: tr('Среднее', 'Medium') },
            { id: 'high', name: tr('Высокое', 'High') },
            { id: 'ultra', name: tr('Ультра', 'Ultra') },
            ...(st.quality === 'custom' ? [{ id: 'custom' as Quality, name: tr('Своё', 'Custom') }] : []),
          ], () => st.quality, (v) => {
            st.quality = v;
            if (v !== 'custom') Object.assign(st, QUALITY_PRESETS[v]);
            renderBody();
          }, tr('«Ультра» включает все параметры на максимум.', 'Ultra turns every option to the maximum.')),
          group(tr('Детали', 'Details')),
          seg(tr('Качество текстур', 'Texture quality'), lv3(), () => st.textures, sub('textures'), tr('Фильтрация и мипмапы текстур блоков.', 'Filtering and mipmaps of block textures.')),
          seg(tr('Тени', 'Shadows'), [{ id: 'off' as const, name: off() }, ...lv3()], () => st.shadows, sub('shadows'), tr('Размер карты теней: 1024, 2048 или 4096.', 'Shadow map size: 1024, 2048 or 4096.')),
          seg(tr('Освещение и эффекты', 'Lighting and effects'), lv3(), () => st.effects, sub('effects'), tr('Число динамических источников света (2, 4 или 6), сила свечения и затенение (AO).', 'Dynamic light count (2, 4 or 6), glow strength and ambient occlusion.')),
          seg(tr('Частицы', 'Particles'), lv3(), () => st.particles, sub('particles'), tr('Количество частиц в эффектах ударов и окружения.', 'How many particles hits and the world spawn.')),
          seg(tr('Дальность прорисовки', 'View distance'), [
            { id: 'near', name: tr('Близко', 'Near') },
            { id: 'medium', name: tr('Средне', 'Medium') },
            { id: 'far', name: tr('Далеко', 'Far') },
            { id: 'max', name: tr('Макс.', 'Max') },
          ], () => st.viewDistance, sub('viewDistance')),
          seg(tr('Сглаживание', 'Anti-aliasing'), [
            { id: 'off', name: off() },
            { id: 'msaa', name: 'MSAA' },
            { id: 'ssaa', name: 'MSAA + SSAA' },
          ], () => st.antiAliasing, sub('antiAliasing'), tr('MSAA включается или выключается после перезапуска игры.', 'MSAA turns on or off after restarting the game.')),
          toggle(tr('Постобработка', 'Post-processing'), () => st.postProcessing, sub('postProcessing'), tr('Свечение, цветокоррекция, тональная компрессия и виньетка.', 'Bloom, color grading, tone mapping and vignette.')),
        );
        break;
      case 'game':
        body.append(
          group(tr('Камера', 'Camera')),
          slider(tr('Отдаление камеры', 'Camera distance'), () => st.cameraZoom, (v) => (st.cameraZoom = v), { min: 75, max: 135, hint: tr('Также меняется колесом мыши в игре.', 'Also changes with the mouse wheel in game.') }),
          slider(tr('Тряска экрана', 'Screen shake'), () => st.screenShake, (v) => (st.screenShake = v)),
          group(tr('Интерфейс', 'Interface')),
          toggle(tr('Цифры урона', 'Damage numbers'), () => st.damageNumbers, (v) => (st.damageNumbers = v)),
          toggle(tr('Подсказки управления', 'Control hints'), () => st.showHints, (v) => (st.showHints = v), tr('Подсказка по клавишам в начале игры новым персонажем.', 'Key hints when a new character starts.')),
          toggle(tr('Счётчик кадров', 'FPS counter'), () => st.showFps, (v) => (st.showFps = v)),
          group(tr('Мир', 'World')),
          toggle(tr('Пауза при сворачивании', 'Pause when the window loses focus'), () => st.autoPause, (v) => (st.autoPause = v)),
        );
        break;
      case 'audio':
        body.append(
          slider(tr('Общая громкость', 'Master volume'), () => st.master, (v) => (st.master = v)),
          slider(tr('Музыка', 'Music'), () => st.music, (v) => (st.music = v)),
          slider(tr('Звуковые эффекты', 'Sound effects'), () => st.sfx, (v) => (st.sfx = v)),
          slider(tr('Окружение', 'Ambience'), () => st.ambient, (v) => (st.ambient = v), { hint: tr('Ветер, река, птицы днём и сверчки ночью.', 'Wind, the river, birds by day and crickets at night.') }),
          slider(tr('Интерфейс', 'Interface'), () => st.ui, (v) => (st.ui = v)),
        );
        break;
      case 'controls': {
        const all = Object.keys(defaultKeybinds()) as BindAction[];
        const owners = new Map<string, BindAction[]>();
        for (const a of all) for (const k of st.keybinds[a]) owners.set(k, [...(owners.get(k) ?? []), a]);
        const clash = new Set([...owners].filter(([, o]) => o.length > 1).map(([k]) => k));
        const warns: string[] = [...clash].map((k) => tr(`Клавиша ${keyName(k)} назначена сразу на: ${owners.get(k)!.map(bindLabel).join(', ')}.`, `${keyName(k)} is bound to several actions: ${owners.get(k)!.map(bindLabel).join(', ')}.`));
        const unbound = ESSENTIAL.filter((a) => !st.keybinds[a].length);
        if (unbound.length) warns.push(tr(`Без клавиши: ${unbound.map(bindLabel).join(', ')}.`, `No key: ${unbound.map(bindLabel).join(', ')}.`));
        body.append(
          group(tr('Мышь', 'Mouse')),
          toggle(tr('Поменять кнопки мыши местами', 'Swap mouse buttons'), () => st.swapMouse, (v) => (st.swapMouse = v), tr('Обычно: левая — идти и выбирать цель, правая — атаковать.', 'Default: left moves and picks a target, right attacks.')),
          toggle(tr('Обратное направление колеса', 'Reverse wheel zoom'), () => st.invertWheel, (v) => (st.invertWheel = v)),
          h('div.st-hint', tr('Чувствительности мыши нет: курсор системный и указывает точку в мире напрямую.', 'There is no mouse sensitivity: the system cursor points at the world directly.')),
        );
        if (bindNote) body.append(h('div.st-note', bindNote));
        for (const w of warns) body.append(h('div.st-warn', w));
        for (const [ru, en, acts] of BIND_GROUPS) {
          body.append(group(tr(ru, en)));
          for (const a of acts) body.append(bindRow(a, clash));
        }
        body.append(h('div.st-hint', tr('Щёлкните по клавише и нажмите новую. Backspace очищает слот, Esc отменяет.', 'Click a key and press a new one. Backspace clears the slot, Esc cancels.')));
        break;
      }
      case 'other':
        body.append(
          seg<Lang>(tr('Язык', 'Language'), LANGS, () => st.lang, (v) => {
            st.lang = v;
            setLang(v);
            rerender();
          }),
          row(
            tr('Все настройки', 'All settings'),
            h('button.st-btn.danger', {
              onclick: () => {
                api.sfx('ui');
                stDialog(root, tr('Вернуть все настройки и клавиши к значениям по умолчанию? Персонажи не пострадают.', 'Restore every setting and key to the defaults? Characters are not affected.'), [
                  { label: tr('Отмена', 'Cancel') },
                  {
                    label: tr('Сбросить', 'Reset'),
                    primary: true,
                    fn: () => {
                      const keep = s().lang;
                      api.profile.data.settings = { ...defaultSettings(), lang: keep };
                      changed();
                      rerender();
                    },
                  },
                ]);
              },
            }, tr('Сбросить всё', 'Reset everything')),
            tr('Изменение нужно применить кнопкой «Применить».', 'Press Apply to keep the change.'),
          ),
          h('div.st-credits', tr('Cubeborn — оригинальная игра. Вся графика, модели, звуки и музыка созданы процедурно. Шрифты: Russo One, Rubik и Press Start 2P (SIL OFL).', 'Cubeborn is an original game. All graphics, models, sounds and music are procedural. Fonts: Russo One, Rubik and Press Start 2P (SIL OFL).'), h('br'), api.version),
        );
        break;
    }
    if (api.needsRestart()) body.prepend(h('div.st-note', tr('Изменение сглаживания вступит в силу после перезапуска игры.', 'The anti-aliasing change takes effect after restarting the game.')));
    refresh();
  };

  const drawNav = () => {
    clear(nav);
    for (const sc of SECTIONS)
      nav.append(
        h('button.st-tab' + (section === sc.id ? '.sel' : ''), {
          onclick: () => {
            if (section === sc.id) return;
            api.sfx('ui');
            section = sc.id;
            drawNav();
            renderBody();
          },
        }, h('i.st-ico.i-' + sc.icon), h('span', tr(sc.ru, sc.en))),
      );
  };

  const defaults = h('button.st-btn', {
    onclick: () => {
      api.sfx('ui');
      const d = defaultSettings();
      const st = s() as unknown as Record<string, unknown>;
      for (const k of SECTION_KEYS[section]) st[k] = JSON.parse(JSON.stringify((d as unknown as Record<string, unknown>)[k]));
      if (section === 'other') setLang(s().lang);
      flash(tr('Раздел возвращён к значениям по умолчанию. Нажмите «Применить», чтобы сохранить.', 'Section restored to defaults. Press Apply to keep it.'));
      changed();
      if (section === 'other') rerender();
      else renderBody();
    },
  }, tr('По умолчанию', 'Defaults'));
  const back = h('button.st-btn', { onclick: () => leaveSettings(api, root, onBack) }, tr('Назад', 'Back'));

  const root = h('div.st', h('div.st-side', nav), h('div.st-main', head, h('div.st-scroll', body), h('div.st-foot', status, h('div.st-foot-btns', defaults, back, applyBtn))));
  drawNav();
  renderBody();
  return root;
}
