import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { statModLines, weaponDeltaLines, fmtNum, fmtTime } from './format';
import type { Run, ChestReward, ChestData } from '../game/Run';
import type { Choice } from '../game/Leveling';
import { WEAPON_BY_ID, WEAPON_MAX_LEVEL } from '../data/weapons';
import { PASSIVE_BY_ID } from '../data/passives';
import type { AchievementDef } from '../data/types';
import { rewardText, settingsPanel, type MenuApi } from './Menus';
import { BALANCE } from '../config/balance';

const RARITY_COLOR: Record<string, string> = { common: '#c8ccd8', uncommon: '#6aff8a', rare: '#5ab4ff', epic: '#c77dff', legendary: '#ffb02e' };

export interface ResultData {
  victory: boolean;
  summary: ReturnType<Run['summary']>;
  goldEarned: number;
  diffName: string;
  achievements: AchievementDef[];
  relic: string | null;
  newUnlocks: string[];
  /** Endless: whether this run beat the stored record, and the best wave before it. */
  endless?: { newRecord: boolean; best: number };
}

/** Level-up, chest, pause and results overlays shown during a run. */
export class RunModals {
  readonly root: HTMLElement;
  private banishMode = false;

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

  // ------------------------------------------------------------------ level up
  levelUp(run: Run, choices: Choice[], done: () => void) {
    this.banishMode = false;
    const cards = h('div.choices');
    const actions = h('div.row.actions');
    const render = (list: Choice[]) => {
      clear(cards);
      list.forEach((c, i) => {
        const card = choiceCard(run, c);
        card.style.animationDelay = i * 0.06 + 's';
        card.addEventListener('click', () => {
          if (this.banishMode) {
            if (c.kind === 'gold' || c.kind === 'heal') return;
            const next = run.banish(c.id);
            this.api.sfx('uiBack');
            this.banishMode = false;
            if (next) render(next);
            return;
          }
          this.api.sfx('select');
          run.choose(c);
          done();
        });
        cards.append(card);
      });
      renderActions();
    };
    const renderActions = () => {
      clear(actions);
      const lv = run.leveling;
      actions.append(
        h('button.btn.small' + (lv.rerolls > 0 ? '' : '.disabled'), {
          onclick: () => {
            const next = run.reroll();
            if (next) {
              this.api.sfx('ui');
              render(next);
            } else this.api.sfx('denied');
          },
        }, iconImg('dice', 0xffffff, 'icon sm'), `${t('btn_reroll')} ${lv.rerolls}`),
        h('button.btn.small' + (lv.skips > 0 ? '' : '.disabled'), {
          onclick: () => {
            if (lv.skips <= 0) return this.api.sfx('denied');
            this.api.sfx('ui');
            run.skip();
            done();
          },
        }, iconImg('skip', 0x8ad8ff, 'icon sm'), `${t('btn_skip')} ${lv.skips}`),
        h('button.btn.small' + (lv.banishes > 0 ? '' : '.disabled') + (this.banishMode ? '.active' : ''), {
          onclick: () => {
            if (lv.banishes <= 0) return this.api.sfx('denied');
            this.banishMode = !this.banishMode;
            this.api.sfx('ui');
            this.root.querySelector('.levelup')?.classList.toggle('banishing', this.banishMode);
            renderActions();
          },
        }, iconImg('banish', 0xff5a5a, 'icon sm'), `${t('btn_banish')} ${lv.banishes}`),
      );
    };
    render(choices);
    this.open(h('div.modal-back', h('div.modal.levelup', h('h2.glow', t('level_up')), h('div.sub', t('hud_level', { n: run.player.level + 1 - run.player.pendingLevels + 0 })), cards, actions, h('div.banish-hint', t('banish_hint')))));
  }

  // ------------------------------------------------------------------ chest
  chest(run: Run, data: ChestData, done: () => void) {
    const list = h('div.chest-rewards');
    const chest = h('div.chest-anim' + (data.tier > 0 ? '.boss' : ''), h('div.chest-lid'), h('div.chest-body'), h('div.chest-rays'));
    const btn = h('button.btn.primary.hidden', {
      onclick: () => {
        this.api.sfx('ui');
        done();
      },
    }, t('btn_take'));
    const goldEl = h('div.chest-gold.hidden', h('i.ic-coin'), '+' + fmtNum(data.gold));
    const rc = RARITY_COLOR[data.rarity];
    this.open(
      h(
        'div.modal-back',
        h(
          'div.modal.chest.rarity-' + data.rarity,
          { style: `--rc:${rc}` },
          h('h2.glow', { style: `color:${rc}` }, t('chest_' + data.rarity)),
          h('div.sub', t(data.tier > 0 ? 'chest_boss' : 'chest') + ' · ' + t('rarity_' + data.rarity)),
          chest,
          list,
          goldEl,
          btn,
        ),
      ),
    );
    let i = 0;
    const reveal = () => {
      if (!this.isOpen) return;
      if (i >= data.rewards.length) {
        goldEl.classList.remove('hidden');
        btn.classList.remove('hidden');
        this.api.sfx('coin');
        return;
      }
      const r = data.rewards[i++];
      list.append(rewardRow(run, r));
      this.api.sfx(r.kind === 'evolution' ? 'evolution' : 'powerup');
      setTimeout(reveal, r.kind === 'evolution' ? 900 : 420);
    };
    setTimeout(() => chest.classList.add('open'), 350);
    setTimeout(reveal, 900);
  }

  // ------------------------------------------------------------------ pause
  pause(run: Run, actions: { resume(): void; restart(): void; exit(): void }) {
    const body = h('div.pause-body');
    const showMain = () => {
      clear(body);
      body.append(
        h('div.build', ...buildRows(run)),
        h('div.stat-grid', ...statRows(run)),
        h(
          'div.col.pause-buttons',
          h('button.btn.primary', { onclick: () => actions.resume() }, t('btn_resume')),
          h('button.btn', {
            onclick: () => {
              this.api.sfx('ui');
              showSettings();
            },
          }, t('menu_settings')),
          h('button.btn', { onclick: () => actions.restart() }, t('btn_restart')),
          h('button.btn.danger', { onclick: () => actions.exit() }, t('btn_exit')),
        ),
      );
    };
    const backBtn = () => h('button.btn', { onclick: () => showMain() }, t('btn_back'));
    const showSettings = () => {
      clear(body);
      body.append(settingsPanel(this.api, showSettings, true), backBtn());
    };
    showMain();
    this.open(h('div.modal-back', h('div.modal.pause', h('h2', t('paused')), h('div.sub', `${L(run.map.name)} · ${t('mode_' + run.mode)} · ${L(run.diff.name)} · ${t(run.mode === 'endless' ? 'hud_wave_endless' : 'hud_wave', { n: run.waves.wave.n, total: 30 })} · ${fmtTime(run.time)}`), body)));
  }

  // ------------------------------------------------------------------ results
  results(data: ResultData, actions: { retry(): void; menu(): void }) {
    const s = data.summary;
    const weapons = [...s.weapons].sort((a, b) => b.damage - a.damage);
    this.open(
      h(
        'div.modal-back',
        h(
          'div.modal.results' + (data.victory ? '.victory' : '.defeat'),
          h('h2.glow', data.victory ? t('victory') : t('game_over')),
          h('div.sub', data.victory ? t('victory_sub') : s.mode === 'endless' ? t('endless_over_sub') : t('defeat_sub')),
          data.endless ? h('div.record-line' + (data.endless.newRecord ? '.new' : ''), data.endless.newRecord ? t('new_record') : t('best_wave', { n: data.endless.best })) : null,
          h(
            'div.stat-grid',
            h('div.kv', h('span', t('r_wave')), h('span', s.mode === 'endless' ? String(s.wave) : `${s.wave} / 30`)),
            h('div.kv', h('span', t('r_time')), h('span', fmtTime(s.time))),
            h('div.kv', h('span', t('r_level')), h('span', String(s.level))),
            h('div.kv', h('span', t('r_kills')), h('span', fmtNum(s.kills))),
            h('div.kv', h('span', t('r_bosses')), h('span', String(s.bosses.length))),
            h('div.kv', h('span', t('r_diff')), h('span', data.diffName)),
            h('div.kv.gold', h('span', t('r_gold')), h('span', h('i.ic-coin'), '+' + fmtNum(data.goldEarned))),
          ),
          h(
            'div.dmg-table',
            ...weapons.map((w) => {
              const def = WEAPON_BY_ID[w.id];
              return h('div.dmg-row', iconImg(def.icon, def.color, 'icon sm'), h('span.n', L(def.name)), h('span.l', def.evolved ? '★' : w.level >= WEAPON_MAX_LEVEL ? 'MAX' : t('lvl_short', { n: w.level })), h('span.d', fmtNum(w.damage)));
            }),
          ),
          data.relic ? h('div.unlock', t('relic_found', { name: data.relic })) : null,
          ...data.newUnlocks.map((u) => h('div.unlock', u)),
          ...data.achievements.map((a) => h('div.unlock.ach', '★ ' + L(a.name) + (a.reward || a.gold ? ' — ' + rewardText(a) : ''))),
          h(
            'div.row',
            h('button.btn', {
              onclick: () => {
                this.api.sfx('ui');
                actions.menu();
              },
            }, t('btn_menu')),
            h('button.btn.primary', {
              onclick: () => {
                this.api.sfx('ui');
                actions.retry();
              },
            }, t('btn_retry')),
          ),
        ),
      ),
    );
  }
}

function choiceCard(run: Run, c: Choice): HTMLElement {
  let icon: HTMLElement;
  let name: string;
  let tag: string;
  let lines: string[] = [];
  let color = RARITY_COLOR[c.rarity] ?? '#ffffff';
  let hint = '';
  if (c.kind === 'weapon_new' || c.kind === 'weapon_up') {
    const w = WEAPON_BY_ID[c.id];
    icon = iconImg(w.icon, w.color, 'icon lg');
    name = L(w.name);
    if (c.kind === 'weapon_new') {
      tag = t('new');
      lines = [L(w.desc)];
    } else {
      tag = c.level >= WEAPON_MAX_LEVEL ? 'MAX' : t('lvl_short', { n: c.level });
      lines = weaponDeltaLines(w.levels[c.level - 2] ?? {});
    }
    if (w.evolution) {
      const ps = PASSIVE_BY_ID[w.evolution.passive];
      const has = run.passives.levels.has(ps.id);
      hint = (has ? '✓ ' : '') + t('evo_with', { name: L(ps.name) });
    }
  } else if (c.kind === 'passive_new' || c.kind === 'passive_up') {
    const p = PASSIVE_BY_ID[c.id];
    icon = iconImg(p.icon, p.color, 'icon lg');
    name = L(p.name);
    tag = c.kind === 'passive_new' ? t('new') : t('lvl_short', { n: c.level });
    lines = c.kind === 'passive_new' ? [L(p.desc)] : statModLines(p.perLevel);
    const evo = Object.values(WEAPON_BY_ID).find((w) => w.evolution?.passive === p.id && run.weapons.has(w.id));
    if (evo) hint = '✓ ' + t('evo_for', { name: L(evo.name) });
  } else if (c.kind === 'gold') {
    icon = iconImg('coin', 0xffd23d, 'icon lg');
    name = t('choice_gold');
    tag = '';
    lines = [t('choice_gold_desc', { n: Math.round(3 * run.player.stats.greed) })];
    color = '#ffd23d';
  } else {
    icon = iconImg('heart', 0xff4a6a, 'icon lg');
    name = t('choice_heal');
    tag = '';
    lines = [t('choice_heal_desc')];
    color = '#ff6a8a';
  }
  return h(
    'button.choice' + (c.kind.endsWith('_new') ? '.is-new' : ''),
    { style: `--rc:${color}` },
    h('div.choice-icon', icon),
    h('div.choice-body', h('div.choice-head', h('span.choice-name', name), tag ? h('span.choice-tag', tag) : null), ...lines.map((l) => h('div.choice-line', l)), hint ? h('div.choice-hint', hint) : null),
  );
}

function rewardRow(_run: Run, r: ChestReward): HTMLElement {
  if (r.kind === 'evolution') {
    const w = WEAPON_BY_ID[r.id];
    const from = WEAPON_BY_ID[r.from!];
    return h('div.reward.evo', iconImg(from.icon, from.color, 'icon'), h('span.arrow', '→'), iconImg(w.icon, w.color, 'icon lg'), h('div', h('b', t('evolution') + '!'), h('div', L(w.name)), h('small', L(w.desc))));
  }
  if (r.kind === 'weapon_up') {
    const w = WEAPON_BY_ID[r.id];
    return h('div.reward', iconImg(w.icon, w.color, 'icon'), h('div', h('b', L(w.name)), h('small', r.level >= WEAPON_MAX_LEVEL ? 'MAX' : t('lvl_short', { n: r.level }))));
  }
  if (r.kind === 'passive_up') {
    const p = PASSIVE_BY_ID[r.id];
    return h('div.reward', iconImg(p.icon, p.color, 'icon'), h('div', h('b', L(p.name)), h('small', t('lvl_short', { n: r.level }))));
  }
  return h('div.reward', iconImg('coin', 0xffd23d, 'icon'), h('div', h('b', t('choice_gold'))));
}

function buildRows(run: Run): HTMLElement[] {
  const rows: HTMLElement[] = [];
  const ws = h('div.build-row');
  for (let i = 0; i < BALANCE.weaponSlots; i++) {
    const w = run.weapons.list[i];
    ws.append(w ? h('div.slot' + (w.def.evolved ? '.evo' : ''), { title: L(w.def.name) }, iconImg(w.def.icon, w.def.color), h('b', w.def.evolved ? '★' : w.isMax ? 'M' : String(w.level))) : h('div.slot.empty'));
  }
  const ps = h('div.build-row');
  const list = [...run.passives.levels];
  for (let i = 0; i < BALANCE.passiveSlots; i++) {
    const e = list[i];
    const def = e && PASSIVE_BY_ID[e[0]];
    ps.append(def ? h('div.slot', { title: L(def.name) }, iconImg(def.icon, def.color), h('b', String(e[1]))) : h('div.slot.empty'));
  }
  rows.push(ws, ps);
  return rows;
}

function statRows(run: Run): HTMLElement[] {
  const s = run.player.stats;
  const pct = (v: number) => Math.round(v * 100) + '%';
  const rows: [string, string][] = [
    [t('stat_maxHp'), String(Math.round(s.maxHp))],
    [t('stat_armor'), String(s.armor)],
    [t('stat_regen'), s.regen.toFixed(1)],
    [t('stat_might'), pct(s.might)],
    [t('stat_area'), pct(s.area)],
    [t('stat_cooldown'), pct(s.cooldown)],
    [t('stat_amount'), '+' + s.amount],
    [t('stat_moveSpeed'), pct(s.moveSpeed)],
    [t('stat_luck'), pct(s.luck)],
    [t('stat_growth'), pct(s.growth)],
    [t('stat_critChance'), pct(s.critChance)],
    [t('stat_magnet'), s.magnet.toFixed(1)],
  ];
  return rows.map(([k, v]) => h('div.kv', h('span', k), h('span', v)));
}

export { hex };
