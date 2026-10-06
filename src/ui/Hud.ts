import type { Run } from '../game/Run';
import type { BossController } from '../game/bosses/Boss';
import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { fmtTime, fmtNum } from './format';
import { BALANCE } from '../config/balance';
import { PASSIVE_BY_ID } from '../data/passives';

/** In-run heads-up display. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root: HTMLElement;
  private xpFill: HTMLElement;
  private lvl: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private time: HTMLElement;
  private kills: HTMLElement;
  private gold: HTMLElement;
  private slotsW: HTMLElement;
  private slotsP: HTMLElement;
  private buffs: HTMLElement;
  private bossBox: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossPhase: HTMLElement;
  private banner: HTMLElement;
  private vignette: HTMLElement;
  private fps: HTMLElement;
  private hint: HTMLElement;
  private last: Record<string, string | number> = {};
  private buildKey = '';
  private bannerT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private boss: BossController | null = null;
  onPause: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.xpFill = h('div.xp-fill');
    this.lvl = h('div.xp-level');
    this.hpFill = h('div.hp-fill');
    this.hpText = h('div.hp-text');
    this.time = h('div.hud-time');
    this.kills = h('span');
    this.gold = h('span');
    this.slotsW = h('div.slots');
    this.slotsP = h('div.slots.passives');
    this.buffs = h('div.buffs');
    this.bossName = h('div.boss-name');
    this.bossFill = h('div.boss-fill');
    this.bossPhase = h('div.boss-phase');
    this.bossBox = h('div.boss-bar.hidden', this.bossName, h('div.boss-track', this.bossFill), this.bossPhase);
    this.banner = h('div.banner');
    this.vignette = h('div.vignette');
    this.fps = h('div.fps.hidden');
    this.hint = h('div.hint.hidden');
    const pause = h('button.pause-btn', { 'aria-label': 'pause', onclick: () => this.onPause() }, h('span'), h('span'));
    this.root = h(
      'div.hud',
      this.vignette,
      h('div.xp-bar', this.xpFill, this.lvl),
      h(
        'div.hud-top',
        h('div.hud-left', h('div.hp-bar', this.hpFill, this.hpText), this.slotsW, this.slotsP, this.buffs),
        this.time,
        h('div.hud-right', h('div.hud-stat', h('i.ic-skull'), this.kills), h('div.hud-stat', h('i.ic-coin'), this.gold), pause),
      ),
      this.banner,
      this.bossBox,
      this.fps,
      this.hint,
    );
    parent.appendChild(this.root);
  }

  reset() {
    this.last = {};
    this.buildKey = '';
    this.boss = null;
    this.bossBox.classList.add('hidden');
    this.banner.classList.remove('show');
    this.vignette.style.opacity = '0';
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  showBanner(text: string, color = '#ffd23d', dur = 2.6) {
    this.banner.textContent = text;
    this.banner.style.color = color;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.bannerT = dur;
  }

  setBoss(b: BossController | null) {
    this.boss = b;
    this.bossBox.classList.toggle('hidden', !b);
    if (b) {
      this.bossName.textContent = L(b.def.name);
      this.bossName.style.color = hex(b.def.color);
      this.last.bossHp = -1;
      this.last.bossPhase = -1;
    }
  }

  showHint(on: boolean, touch: boolean) {
    this.hint.classList.toggle('hidden', !on);
    if (on) {
      clear(this.hint);
      this.hint.append(h('div.hint-hand'), h('div.hint-text', t(touch ? 'hint_touch' : 'hint_keys')), h('div.hint-sub', t('hint_auto')));
    }
  }

  setFpsVisible(v: boolean) {
    this.fps.classList.toggle('hidden', !v);
  }

  update(run: Run, dt: number, realDt: number) {
    const p = run.player;
    const xpk = p.xpNext > 0 ? Math.min(1, p.xp / p.xpNext) : 0;
    this.set('xp', Math.round(xpk * 400), () => (this.xpFill.style.transform = `scaleX(${xpk})`));
    this.set('lvl', p.level, () => (this.lvl.textContent = t('hud_level', { n: p.level })));
    const hpk = Math.max(0, p.hp / p.stats.maxHp);
    this.set('hp', Math.round(hpk * 300), () => {
      this.hpFill.style.transform = `scaleX(${hpk})`;
      this.hpFill.classList.toggle('low', hpk < 0.3);
    });
    this.set('hpt', `${Math.ceil(Math.max(0, p.hp))}/${Math.round(p.stats.maxHp)}`, () => (this.hpText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.stats.maxHp)}`));
    this.set('time', Math.floor(run.time), () => {
      this.time.textContent = fmtTime(run.time);
      this.time.classList.toggle('boss-time', run.time >= run.map.bossTime - 30 && run.time < run.map.bossTime);
    });
    this.set('kills', run.stats.kills, () => (this.kills.textContent = fmtNum(run.stats.kills)));
    this.set('gold', Math.round(run.stats.gold), () => (this.gold.textContent = fmtNum(run.stats.gold)));

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
            ? h('div.slot' + (w.def.evolved ? '.evo' : w.isMax ? '.max' : ''), iconImg(w.def.icon, w.def.color), h('b', w.def.evolved ? '★' : w.isMax ? 'M' : String(w.level)))
            : h('div.slot.empty'),
        );
      }
      const ps = [...run.passives.levels];
      for (let i = 0; i < BALANCE.passiveSlots; i++) {
        const e = ps[i];
        const def = e && PASSIVE_BY_ID[e[0]];
        this.slotsP.append(def ? h('div.slot.small', iconImg(def.icon, def.color), h('b', String(e[1]))) : h('div.slot.small.empty'));
      }
    }
    // buffs
    const b = p.buffs;
    const bk = `${b.fury > 0}${b.haste > 0}${b.aegis > 0}${b.frenzy > 0}${p.shield}`;
    this.set('buffs', bk, () => {
      clear(this.buffs);
      const add = (on: boolean, cls: string, label: string) => on && this.buffs.append(h('div.buff.' + cls, label));
      add(b.fury > 0, 'fury', t('buff_fury'));
      add(b.haste > 0, 'haste', t('buff_haste'));
      add(b.aegis > 0, 'aegis', t('buff_aegis'));
      add(b.frenzy > 0, 'frenzy', t('buff_frenzy'));
      add(p.shield, 'shield', t('buff_shield'));
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
      if (this.bannerT <= 0) this.banner.classList.remove('show');
    }
    this.fpsAcc += realDt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} FPS · ${run.enemies.aliveCount}`;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    void dt;
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }
}
