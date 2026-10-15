import { h, clear } from './dom';
import { t } from '../i18n';
import type { Run } from '../game/Run';
import { settingsPanel, type MenuApi } from './Menus';
import { tr } from './ClassPreview';

export interface PauseActions {
  resume(): void;
  /** Writes the save; returns false when the browser refused it. */
  save(): boolean;
  exit(): void;
}

/** The pause menu shown over the paused world. */
export class RunModals {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private api: MenuApi) {
    this.root = h('div.run-modals');
    parent.appendChild(this.root);
  }

  close() {
    clear(this.root);
    this.root.classList.remove('open');
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  private open(el: HTMLElement) {
    clear(this.root);
    this.root.append(el);
    this.root.classList.add('open');
  }

  pause(_run: Run, a: PauseActions) {
    const side = h('div.pz-side');
    const note = h('div.mm-note');
    const btn = (icon: string, label: string, fn: () => void, primary = false) =>
      h('button.mm-btn' + (primary ? '.primary' : ''), { onclick: fn }, h('i.mm-glyph.g-' + icon), h('span.mm-label', label), h('span.mm-arrow', '›'));
    const showMain = () => {
      clear(side);
      side.append(
        h('h1.pz-title', tr('ПАУЗА', 'PAUSED')),
        h('div.pz-rule', h('i')),
        h(
          'nav.mm-nav',
          btn('play', tr('Продолжить игру', 'Resume'), () => a.resume(), true),
          btn('gear', tr('Настройки', 'Settings'), () => {
            this.api.sfx('ui');
            showSettings();
          }),
          btn('disk', tr('Сохранить игру', 'Save game'), () => {
            const ok = a.save();
            this.api.sfx(ok ? 'select' : 'denied');
            note.textContent = ok ? tr('Игра сохранена.', 'Game saved.') : tr('Не удалось сохранить: браузер запретил запись.', 'Could not save: the browser refused to write.');
            note.classList.remove('show');
            void note.offsetWidth;
            note.classList.add('show');
          }),
          btn('door', tr('Выйти в главное меню', 'Exit to main menu'), () => {
            this.api.sfx('ui');
            a.exit();
          }),
        ),
        note,
      );
    };
    const showSettings = () => {
      clear(side);
      side.append(
        h('h1.pz-title', t('menu_settings')),
        h('div.pz-settings', settingsPanel(this.api, showSettings, true)),
        h('button.mm-btn.pz-back', { onclick: () => showMain() }, h('span.mm-label', t('btn_back'))),
      );
    };
    showMain();
    this.open(h('div.pz', side));
  }
}
