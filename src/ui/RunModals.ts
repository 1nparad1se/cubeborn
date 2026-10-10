import { h, clear } from './dom';
import { t, L } from '../i18n';
import { fmtNum, fmtTime } from './format';
import type { Run } from '../game/Run';
import type { AchievementDef } from '../data/types';
import { rewardText, settingsPanel, type MenuApi } from './Menus';
import { InventoryUi } from './InventoryUi';
import { SKILL_MAX } from '../game/action/types';
import { SLOT_ULT } from '../game/action/ActionSystem';
import { skillImg, slotKey } from './SkillsScreen';

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
  /** The finished run, to show the class and its skill levels (optional). */
  run?: Run;
}

/** Inventory, pause and results overlays shown during a run. */
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

  // ------------------------------------------------------------------ inventory
  inventory(run: Run, close: () => void) {
    this.open(new InventoryUi(run, close).root);
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
    this.open(h('div.modal-back', h('div.modal.pause', h('h2', t('paused')), h('div.sub', `${L(run.map.name)} · ${t('mode_' + run.mode)} · ${run.world ? L(run.world.place().area?.name) || t('world_town') : L(run.diff.name) + ' · ' + t(run.mode === 'endless' ? 'hud_wave_endless' : 'hud_wave', { n: run.waves.wave.n, total: 30 })} · ${fmtTime(run.time)}`), body)));
  }

  // ------------------------------------------------------------------ results
  results(data: ResultData, actions: { retry(): void; menu(): void }) {
    const s = data.summary;
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
          data.run ? h('div.build.results-build', h('div.build-head', t('ak_skills_used')), ...buildRows(data.run)) : null,
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

/** Class name and the learned skills with their levels and chosen tripods. */
function buildRows(run: Run): HTMLElement[] {
  const a = run.action;
  const c = a.cls;
  const row = h('div.build-row.skills');
  for (let i = 0; i < 8; i++) {
    const s = c.skills[i];
    const lv = a.levels[i];
    const tri = [0, 1].map((tier) => a.tripod(i, tier)).filter(Boolean).map((x) => L(x!.name));
    row.append(
      h(
        'div.slot.sk-mini' + (lv > 0 ? '' : '.empty'),
        { title: `${L(s.name)} · ${lv > 0 ? t('ak_lv', { n: lv, m: SKILL_MAX }) : t('ak_unlock_short', { n: s.unlock })}${tri.length ? '\n' + tri.join(', ') : ''}` },
        skillImg(s.icon, s.color, 'icon'),
        h('span.sk-mini-key', slotKey(null, i)),
        lv > 0 ? h('b', String(lv)) : null,
      ),
    );
  }
  const ultOn = run.player.level >= c.ult.unlock;
  row.append(h('div.slot.sk-mini.ult' + (ultOn ? '' : '.empty'), { title: L(c.ult.name) }, skillImg(c.ult.icon, c.ult.color, 'icon'), h('span.sk-mini-key', slotKey(null, SLOT_ULT))));
  return [h('div.build-cls', { style: `color:#${c.color.toString(16).padStart(6, '0')}` }, L(c.name), h('span', ' · ' + t('ak_level_hero', { n: run.player.level }))), row];
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
    [t('stat_moveSpeed'), pct(s.moveSpeed)],
    [t('stat_luck'), pct(s.luck)],
    [t('stat_growth'), pct(s.growth)],
    [t('stat_critChance'), pct(s.critChance)],
    [t('stat_magnet'), s.magnet.toFixed(1)],
  ];
  return rows.map(([k, v]) => h('div.kv', h('span', k), h('span', v)));
}

