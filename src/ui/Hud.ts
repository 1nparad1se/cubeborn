import type { Run } from '../game/Run';
import type { BossController } from '../game/bosses/Boss';
import { CAMPAIGN_WAVES, MODIFIERS, WAVE_TYPE_COLOR, WaveDirector } from '../game/Waves';
import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { fmtTime, fmtNum } from './format';
import { BALANCE } from '../config/balance';
import { PASSIVE_BY_ID } from '../data/passives';
import { WEAPON_BY_ID } from '../data/weapons';
import { Minimap } from './Minimap';

export interface HudOptions {
  minimap: boolean;
  waves: boolean;
  fps: boolean;
  enemies: boolean;
}

/** In-run heads-up display laid out for PC screens. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root: HTMLElement;
  readonly minimap = new Minimap();
  private xpFill: HTMLElement;
  private xpText: HTMLElement;
  private lvl: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private time: HTMLElement;
  private kills: HTMLElement;
  private gold: HTMLElement;
  private slotsW: HTMLElement;
  private slotsP: HTMLElement;
  private buffs: HTMLElement;
  private wavePanel: HTMLElement;
  private waveTitle: HTMLElement;
  private waveType: HTMLElement;
  private waveFill: HTMLElement;
  private waveNext: HTMLElement;
  private waveStrip: HTMLElement;
  private mods: HTMLElement;
  private record: HTMLElement;
  private bossBox: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossPhase: HTMLElement;
  private banner: HTMLElement;
  private bannerSub: HTMLElement;
  private vignette: HTMLElement;
  private fps: HTMLElement;
  private hint: HTMLElement;
  private mapBox: HTMLElement;
  private last: Record<string, string | number> = {};
  private buildKey = '';
  private bannerT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private boss: BossController | null = null;
  private opts: HudOptions = { minimap: true, waves: true, fps: false, enemies: false };
  /** Endless best wave on this map, for the record line. */
  bestWave = 0;
  onPause: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.xpFill = h('div.xp-fill');
    this.xpText = h('div.xp-text');
    this.lvl = h('div.hb-hex-num');
    this.hpFill = h('div.heart-fill');
    this.hpText = h('div.heart-text');
    this.time = h('div.hud-time');
    this.kills = h('span');
    this.gold = h('span');
    this.slotsW = h('div.slots');
    this.slotsP = h('div.slots.passives');
    this.buffs = h('div.buffs');
    this.waveTitle = h('div.wave-title');
    this.waveType = h('div.wave-type');
    this.waveFill = h('div.wave-fill');
    this.waveNext = h('div.wave-next');
    this.waveStrip = h('div.wave-strip');
    this.mods = h('div.wave-mods');
    this.record = h('div.wave-record');
    this.wavePanel = h(
      'div.wave-panel',
      h('div.wave-head', this.waveTitle, h('span.key', 'J')),
      h('div.wave-rule'),
      h('div.wave-sub', this.waveType, this.waveNext),
      h('div.wave-track', this.waveFill),
      this.waveStrip,
      this.mods,
      this.record,
    );
    this.bossName = h('div.boss-name');
    this.bossFill = h('div.boss-fill');
    this.bossPhase = h('div.boss-phase');
    this.bossBox = h('div.boss-bar.hidden', this.bossName, h('div.boss-track', this.bossFill), this.bossPhase);
    this.banner = h('div.banner-main');
    this.bannerSub = h('div.banner-sub');
    const bannerBox = h('div.banner', this.banner, this.bannerSub);
    this.vignette = h('div.vignette');
    this.fps = h('div.fps.hidden');
    this.hint = h('div.hint.hidden');
    const pause = h('button.hb-key', { 'aria-label': 'pause', title: 'Esc', onclick: () => this.onPause() }, h('i.ic-pause', h('span'), h('span')), h('span.key', 'Esc'));
    const mapKey = h('button.hb-key', { 'aria-label': 'map', title: 'M', onclick: () => this.toggleMap() }, h('i.ic-map'), h('span.key', 'M'));
    this.mapBox = h('div.map-box', this.minimap.root, h('span.key.map-key', 'M'));
    // pixel heart: a dark heart with a red heart clipped to the current HP fraction
    const heart = h('div.heart', h('div.heart-bg'), this.hpFill, this.hpText);
    this.root = h(
      'div.hud',
      this.vignette,
      h('div.hud-tl', this.fps, this.buffs),
      h('div.hud-top', this.time, this.bossBox),
      h('div.hud-tr', this.mapBox, this.wavePanel),
      bannerBox,
      this.hint,
      h(
        'div.hotbar',
        h('div.hb-wing.left', h('div.hb-item', h('i.ic-coin'), this.gold), pause, mapKey),
        h('div.heart-frame', heart),
        h(
          'div.hb-mid',
          h('div.hb-kills', h('i.ic-skull'), this.kills),
          this.slotsW,
          h('div.xp-row', this.xpText, h('div.xp-bar', this.xpFill, h('div.xp-seg'))),
        ),
        h('div.hb-hex', h('div.hb-hex-inner', h('small', t('hud_lv')), this.lvl)),
        h('div.hb-wing.right', this.slotsP),
      ),
    );
    parent.appendChild(this.root);
    this.bannerBox = bannerBox;
  }

  private bannerBox: HTMLElement;

  reset(run: Run | null = null) {
    this.last = {};
    this.buildKey = '';
    this.boss = null;
    this.bossBox.classList.add('hidden');
    this.bannerBox.classList.remove('show');
    this.vignette.style.opacity = '0';
    this.minimap.setRun(run);
    this.minimap.setBig(false);
    clear(this.waveStrip);
    if (run && run.waves.mode === 'campaign') {
      // the whole run at a glance: one pip per wave, bosses marked
      WaveDirector.campaignPlan().forEach((type, i) => {
        const pip = h('i' + (type === 'boss' || type === 'final' ? '.boss' : ''), { style: `--wc:${WAVE_TYPE_COLOR[type]}`, title: `${i + 1}: ${t('wave_' + type)}` });
        this.waveStrip.append(pip);
      });
    }
  }

  setOptions(o: HudOptions) {
    this.opts = o;
    this.mapBox.querySelector('.minimap')?.classList.toggle('hidden', !o.minimap);
    this.wavePanel.classList.toggle('hidden', !o.waves);
    this.fps.classList.toggle('hidden', !o.fps && !o.enemies);
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  showBanner(text: string, color = '#ffd23d', dur = 2.6, sub = '') {
    this.banner.textContent = text;
    this.banner.style.color = color;
    this.bannerSub.textContent = sub;
    this.bannerBox.classList.remove('show');
    void this.bannerBox.offsetWidth;
    this.bannerBox.classList.add('show');
    this.bannerT = dur;
  }

  setBoss(b: BossController | null) {
    this.boss = b;
    this.bossBox.classList.toggle('hidden', !b);
    if (b) {
      this.bossName.textContent = (b.enraged ? t('enraged') + ' ' : '') + L(b.def.name);
      this.bossName.style.color = hex(b.def.color);
      this.last.bossHp = -1;
      this.last.bossPhase = -1;
    }
  }

  showHint(on: boolean, keys = '') {
    this.hint.classList.toggle('hidden', !on);
    if (on) {
      clear(this.hint);
      this.hint.append(h('div.hint-text', t('hint_keys', { keys })), h('div.hint-sub', t('hint_auto')));
    }
  }

  toggleMap() {
    this.minimap.setBig(!this.minimap.big);
  }

  update(run: Run, dt: number, realDt: number) {
    const p = run.player;
    const xpk = p.xpNext > 0 ? Math.min(1, p.xp / p.xpNext) : 0;
    this.set('xp', Math.round(xpk * 400), () => (this.xpFill.style.transform = `scaleX(${xpk})`));
    this.set('xpt', p.level, () => (this.xpText.textContent = String(p.level)));
    this.set('lvl', p.level, () => (this.lvl.textContent = String(p.level)));
    const hpk = Math.max(0, p.hp / p.stats.maxHp);
    this.set('hp', Math.round(hpk * 300), () => {
      // the red heart drains from the top
      this.hpFill.style.clipPath = `inset(${((1 - hpk) * 100).toFixed(1)}% 0 0 0)`;
      this.hpFill.parentElement!.parentElement!.classList.toggle('low', hpk < 0.3);
    });
    this.set('hpt', Math.ceil(Math.max(0, p.hp)), () => (this.hpText.textContent = String(Math.ceil(Math.max(0, p.hp)))));
    this.set('time', Math.floor(run.time), () => (this.time.textContent = fmtTime(run.time)));
    this.set('kills', run.stats.kills, () => (this.kills.textContent = fmtNum(run.stats.kills)));
    this.set('gold', Math.round(run.stats.gold), () => (this.gold.textContent = fmtNum(run.stats.gold)));

    // waves
    if (this.opts.waves) {
      const wd = run.waves;
      const w = wd.wave;
      const endless = wd.mode === 'endless';
      this.set('wave', w.n, () => {
        this.waveTitle.textContent = endless ? t('hud_wave_endless', { n: w.n }) : t('hud_wave', { n: w.n, total: CAMPAIGN_WAVES });
        this.waveType.textContent = t('wave_' + w.type) + ' · ';
        this.waveType.style.color = WAVE_TYPE_COLOR[w.type];
        this.wavePanel.style.setProperty('--wc', WAVE_TYPE_COLOR[w.type]);
        const pips = this.waveStrip.children;
        for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('done', i < w.n - 1), pips[i].classList.toggle('cur', i === w.n - 1);
        if (endless) this.record.textContent = this.bestWave > 0 ? (w.n > this.bestWave ? t('new_record') : t('best_wave', { n: this.bestWave })) : '';
        this.record.classList.toggle('new', endless && this.bestWave > 0 && w.n > this.bestWave);
      });
      const rem = wd.remaining;
      this.set('wnext', w.final ? -1 : Math.ceil(rem), () => {
        this.waveNext.textContent = w.final ? t('hud_final_wave') : w.n >= wd.total ? '' : t('hud_next_wave', { time: fmtTime(Math.ceil(rem)) });
      });
      this.set('wprog', Math.round(wd.progress * 200), () => (this.waveFill.style.transform = `scaleX(${wd.progress})`));
      const mk = wd.modifiers.map((m) => m.id).join();
      this.set('mods', mk, () => {
        clear(this.mods);
        for (const m of wd.modifiers) {
          const def = MODIFIERS.find((x) => x.id === m.id)!;
          this.mods.append(h('span.mod-chip', { style: `--mc:${def.color}`, title: t('mod_' + m.id + '_desc') }, t('mod_' + m.id)));
        }
      });
    }

    // build slots
    const key = run.weapons.list.map((w) => w.def.id + w.level).join() + '|' + [...run.passives.levels].map(([id, l]) => id + l).join();
    if (key !== this.buildKey) {
      this.buildKey = key;
      clear(this.slotsW);
      clear(this.slotsP);
      for (let i = 0; i < BALANCE.weaponSlots; i++) {
        const w = run.weapons.list[i];
        this.slotsW.append(
          w
            ? h('div.slot' + (w.def.evolved ? '.evo' : w.isMax ? '.max' : ''), { title: L(WEAPON_BY_ID[w.def.id].name) }, iconImg(w.def.icon, w.def.color), h('b', w.def.evolved ? '★' : w.isMax ? 'MAX' : String(w.level)), h('span.slot-n', String(i + 1)))
            : h('div.slot.empty', h('span.slot-n', String(i + 1))),
        );
      }
      const ps = [...run.passives.levels];
      for (let i = 0; i < BALANCE.passiveSlots; i++) {
        const e = ps[i];
        const def = e && PASSIVE_BY_ID[e[0]];
        this.slotsP.append(def ? h('div.slot.small', { title: L(def.name) }, iconImg(def.icon, def.color), h('b', String(e[1]))) : h('div.slot.small.empty'));
      }
    }
    // effects: buffs with remaining time, weather and map events
    const b = p.buffs;
    const wt = run.weather;
    const bk = `${Math.ceil(b.fury)}|${Math.ceil(b.haste)}|${Math.ceil(b.aegis)}|${Math.ceil(b.frenzy)}|${p.shield}|${Math.ceil(wt.darkness)}|${Math.ceil(wt.blizzard)}|${Math.ceil(wt.surge)}|${Math.ceil(wt.storm)}|${run.enemies.frozenAll > 0}`;
    this.set('buffs', bk, () => {
      clear(this.buffs);
      const add = (v: number | boolean, cls: string, label: string) => {
        if (!v || (typeof v === 'number' && v <= 0)) return;
        this.buffs.append(h('div.buff.' + cls, label + (typeof v === 'number' && v < 900 ? ` ${Math.ceil(v)}` : '')));
      };
      add(b.fury, 'fury', t('buff_fury'));
      add(b.haste, 'haste', t('buff_haste'));
      add(b.aegis, 'aegis', t('buff_aegis'));
      add(b.frenzy, 'frenzy', t('buff_frenzy'));
      add(p.shield, 'shield', t('buff_shield'));
      add(run.enemies.frozenAll, 'chrono', t('buff_chrono'));
      add(wt.darkness, 'debuff', t('fx_darkness'));
      add(wt.blizzard, 'debuff', t('fx_blizzard'));
      add(wt.storm, 'debuff', t('fx_storm'));
      add(wt.surge, 'surge', t('fx_surge'));
    });

    // boss bar
    const boss = this.boss;
    if (boss) {
      const e = boss.e;
      if (!e.active || e.boss !== boss) this.setBoss(run.bosses.find((x) => x.e.active && x.e.boss === x && !x.isClone) ?? null);
      else {
        const k = Math.max(0, e.hp / e.maxHp);
        this.set('bossHp', Math.round(k * 500), () => (this.bossFill.style.transform = `scaleX(${k})`));
        this.set('bossInv', e.invuln ? 1 : 0, () => this.bossBox.classList.toggle('invuln', e.invuln));
        this.set('bossPhase', boss.phase, () => {
          clear(this.bossPhase);
          for (let i = 0; i < boss.def.phases.length; i++) this.bossPhase.append(h('i' + (i <= boss.phase ? '.on' : '')));
        });
      }
    }

    // hurt vignette
    const v = p.hurtT > 0 ? 0.7 : hpk < 0.25 ? 0.25 + Math.sin(run.time * 6) * 0.1 : 0;
    this.set('vig', Math.round(v * 20), () => (this.vignette.style.opacity = String(v)));

    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerBox.classList.remove('show');
    }
    if (this.opts.minimap) this.minimap.update(realDt);
    this.fpsAcc += realDt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      const parts: string[] = [];
      if (this.opts.fps) parts.push(`FPS: ${Math.round(this.fpsN / this.fpsAcc)}`);
      if (this.opts.enemies) parts.push(`${t('hud_enemies')}: ${run.enemies.aliveCount}`);
      this.fps.textContent = parts.join('   ');
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    void dt;
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }
}
