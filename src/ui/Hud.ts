import './classSelect.css';
import './mcd.css';
import type { Run } from '../game/Run';
import type { BossController } from '../game/bosses/Boss';
import { CAMPAIGN_WAVES, MODIFIERS, WAVE_TYPE_COLOR, WaveDirector } from '../game/Waves';
import { h, clear, hex } from './dom';
import { t, L } from '../i18n';
import { fmtTime, fmtNum } from './format';
import { Minimap } from './Minimap';
import { DAY_NIGHT } from '../config/dayNight';
import { ArpgHud } from './ArpgHud';
import type { Enemy } from '../game/Enemy';

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
  private buffs: HTMLElement;
  private wavePanel: HTMLElement;
  /** Day/night dial: phase ring, sun/moon marker, period name and time to the next change. */
  private dnBox: HTMLElement;
  private dnRing: SVGElement;
  private dnMark: SVGElement;
  private dnName: HTMLElement;
  private dnNext: HTMLElement;
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
  private bannerT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private boss: BossController | null = null;
  private opts: HudOptions = { minimap: true, waves: true, fps: false, enemies: false };
  /** Endless best wave on this map, for the record line. */
  bestWave = 0;
  onPause: () => void = () => {};
  readonly arpg = new ArpgHud();
  private bossFx: HTMLElement;
  /** Stagger bar under the boss health: fills gold, flashes while the boss is broken. */
  private bossStag: HTMLElement;
  private bossStagText: HTMLElement;
  private bossStagBox: HTMLElement;

  constructor(parent: HTMLElement) {
    this.xpFill = h('div.xp-fill');
    this.xpText = h('div.xp-text');
    this.lvl = h('div.hb-hex-num');
    this.hpFill = h('div.heart-fill');
    this.hpText = h('div.heart-text');
    this.time = h('div.hud-time');
    this.kills = h('span');
    this.gold = h('span');
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
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    svg.classList.add('dn-dial');
    this.dnRing = document.createElementNS(NS, 'g');
    let a0 = 0;
    const PCOL: Record<string, string> = { dawn: '#f2a46a', day: '#ffd86a', dusk: '#c46a8a', night: '#3a4a9a' };
    for (const [p, share] of DAY_NIGHT.phases) {
      const a1 = a0 + share;
      const arc = document.createElementNS(NS, 'path');
      const pt = (f: number) => `${(Math.sin(f * Math.PI * 2) * 15).toFixed(2)} ${(-Math.cos(f * Math.PI * 2) * 15).toFixed(2)}`;
      arc.setAttribute('d', `M ${pt(a0)} A 15 15 0 ${share > 0.5 ? 1 : 0} 1 ${pt(a1)}`);
      arc.setAttribute('stroke', PCOL[p]);
      arc.setAttribute('class', 'dn-arc');
      this.dnRing.append(arc);
      a0 = a1;
    }
    this.dnMark = document.createElementNS(NS, 'g');
    const body = document.createElementNS(NS, 'circle');
    body.setAttribute('r', '5');
    body.setAttribute('cy', '-15');
    body.setAttribute('class', 'dn-body');
    this.dnMark.append(body);
    svg.append(this.dnRing, this.dnMark);
    this.dnName = h('div.dn-name');
    this.dnNext = h('div.dn-next');
    this.dnBox = h('div.daynight.hidden', svg as unknown as HTMLElement, h('div.dn-text', this.dnName, this.dnNext));
    this.bossName = h('div.boss-name');
    this.bossFill = h('div.boss-fill');
    this.bossPhase = h('div.boss-phase');
    this.bossFx = h('div.boss-fx');
    this.bossStag = h('div.boss-stag-fill');
    this.bossStagText = h('div.boss-stag-text');
    this.bossStagBox = h('div.boss-stag', this.bossStag, this.bossStagText);
    this.bossBox = h('div.boss-bar.hidden', this.bossName, h('div.boss-track', this.bossFill), this.bossStagBox, this.bossPhase, this.bossFx);
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
      h('div.hud-top', this.time, this.bossBox, this.arpg.hoverBox),
      h('div.hud-tr', this.mapBox, this.dnBox, this.wavePanel),
      bannerBox,
      this.hint,
      this.arpg.root,
      h(
        'div.hotbar.legacy',
        h('div.hb-wing.left', h('div.hb-item', h('i.ic-coin'), this.gold), pause, mapKey),
        h('div.heart-frame', heart),
        h(
          'div.hb-mid',
          h('div.hb-kills', h('i.ic-skull'), this.kills),
          h('div.xp-row', this.xpText, h('div.xp-bar', this.xpFill, h('div.xp-seg'))),
        ),
        h('div.hb-hex', h('div.hb-hex-inner', h('small', t('hud_lv')), this.lvl)),
        h('div.hb-wing.right'),
      ),
    );
    parent.appendChild(this.root);
    this.bannerBox = bannerBox;
  }

  private bannerBox: HTMLElement;

  reset(run: Run | null = null) {
    this.last = {};
    this.boss = null;
    this.bossBox.classList.add('hidden');
    this.bannerBox.classList.remove('show');
    this.vignette.style.opacity = '0';
    this.minimap.setRun(run);
    this.arpg.reset(run);
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
      this.last.bossStag = -2;
    }
  }

  showHint(on: boolean, keys = '') {
    this.hint.classList.toggle('hidden', !on);
    if (on) {
      clear(this.hint);
      this.hint.append(h('div.hint-text', t('hint_keys', { keys })), h('div.hint-sub', t('hint_auto')));
    }
  }

  setHover(e: Enemy | null) {
    this.arpg.setHover(e);
  }

  toggleMap() {
    this.minimap.setBig(!this.minimap.big);
  }

  update(run: Run, dt: number, realDt: number) {
    const p = run.player;
    this.arpg.update(run);
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
        this.waveType.textContent = t('wave_' + w.type) + ' · ' + L({ ru: 'Ур. монстров', en: 'Monster lv' }) + ' ' + run.zoneLevel + ' · ';
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

    // day / night
    const dn = run.dayNight;
    this.set('dnOn', dn.enabled ? 1 : 0, () => this.dnBox.classList.toggle('hidden', !dn.enabled));
    if (dn.enabled) {
      const per = dn.bloodMoon && dn.period === 'night' ? 'blood' : dn.period;
      this.set('dnPer', per + (dn.bloodAhead ? '!' : ''), () => {
        this.dnName.textContent = t('period_' + per);
        this.dnBox.dataset.period = per;
        this.dnBox.classList.toggle('warn', dn.bloodAhead);
      });
      this.set('dnNext', Math.ceil(dn.timeToNext), () => (this.dnNext.textContent = `${fmtTime(Math.ceil(dn.timeToNext))} ${t('period_next')}`));
      this.set('dnDeg', Math.round(dn.cycleProgress * 360), () => this.dnMark.setAttribute('transform', `rotate(${(dn.cycleProgress * 360).toFixed(1)})`));
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
        const broken = e.brokenT > 0;
        const sk = e.stagMax > 0 ? Math.min(1, e.stag / e.stagMax) : 0;
        this.set('bossStag', broken ? -1 : Math.round(sk * 300), () => {
          this.bossStag.style.transform = `scaleX(${broken ? 1 : sk})`;
          this.bossStagBox.classList.toggle('broken', broken);
          this.bossStagText.textContent = broken ? t('ak_broken') : t('ak_stagger');
        });
        this.arpg.bossExtras(boss, this.bossPhase, this.bossFx);
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
