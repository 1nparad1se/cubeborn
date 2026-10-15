import './classSelect.css';
import './mcd.css';
import type { Run } from '../game/Run';
import { h, clear } from './dom';
import { t } from '../i18n';
import { fmtTime } from './format';
import { Minimap } from './Minimap';
import { DAY_NIGHT } from '../config/dayNight';
import { ArpgHud } from './ArpgHud';
import type { Enemy } from '../game/Enemy';

export interface HudOptions {
  minimap: boolean;
  fps: boolean;
}

/** In-run heads-up display laid out for PC screens. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root: HTMLElement;
  readonly minimap = new Minimap();
  private buffs: HTMLElement;
  /** Day/night dial: phase ring, sun/moon marker, period name and time to the next change. */
  private dnBox: HTMLElement;
  private dnMark: SVGElement;
  private dnName: HTMLElement;
  private dnNext: HTMLElement;
  private banner: HTMLElement;
  private bannerSub: HTMLElement;
  private bannerBox: HTMLElement;
  private vignette: HTMLElement;
  private fps: HTMLElement;
  private hint: HTMLElement;
  private mapBox: HTMLElement;
  private last: Record<string, string | number> = {};
  private bannerT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private opts: HudOptions = { minimap: true, fps: false };
  readonly arpg = new ArpgHud();

  constructor(parent: HTMLElement) {
    this.buffs = h('div.buffs');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    svg.classList.add('dn-dial');
    const ring = document.createElementNS(NS, 'g');
    let a0 = 0;
    const PCOL: Record<string, string> = { dawn: '#f2a46a', day: '#ffd86a', dusk: '#c46a8a', night: '#3a4a9a' };
    for (const [p, share] of DAY_NIGHT.phases) {
      const a1 = a0 + share;
      const arc = document.createElementNS(NS, 'path');
      const pt = (f: number) => `${(Math.sin(f * Math.PI * 2) * 15).toFixed(2)} ${(-Math.cos(f * Math.PI * 2) * 15).toFixed(2)}`;
      arc.setAttribute('d', `M ${pt(a0)} A 15 15 0 ${share > 0.5 ? 1 : 0} 1 ${pt(a1)}`);
      arc.setAttribute('stroke', PCOL[p]);
      arc.setAttribute('class', 'dn-arc');
      ring.append(arc);
      a0 = a1;
    }
    this.dnMark = document.createElementNS(NS, 'g');
    const body = document.createElementNS(NS, 'circle');
    body.setAttribute('r', '5');
    body.setAttribute('cy', '-15');
    body.setAttribute('class', 'dn-body');
    this.dnMark.append(body);
    svg.append(ring, this.dnMark);
    this.dnName = h('div.dn-name');
    this.dnNext = h('div.dn-next');
    this.dnBox = h('div.daynight.hidden', svg as unknown as HTMLElement, h('div.dn-text', this.dnName, this.dnNext));
    this.banner = h('div.banner-main');
    this.bannerSub = h('div.banner-sub');
    this.bannerBox = h('div.banner', this.banner, this.bannerSub);
    this.vignette = h('div.vignette');
    this.fps = h('div.fps.hidden');
    this.hint = h('div.hint.hidden');
    this.mapBox = h('div.map-box', this.minimap.root, h('span.key.map-key', 'Tab'));
    this.root = h(
      'div.hud',
      this.vignette,
      h('div.hud-tl', this.fps, this.buffs),
      h('div.hud-top', this.arpg.hoverBox),
      h('div.hud-tr', this.mapBox, this.dnBox),
      this.bannerBox,
      this.hint,
      this.arpg.root,
    );
    parent.appendChild(this.root);
  }

  reset(run: Run | null = null) {
    this.last = {};
    this.bannerBox.classList.remove('show');
    this.vignette.style.opacity = '0';
    this.minimap.setRun(run);
    this.arpg.reset(run);
    this.minimap.setBig(false);
  }

  setOptions(o: HudOptions) {
    this.opts = o;
    this.mapBox.querySelector('.minimap')?.classList.toggle('hidden', !o.minimap);
    this.fps.classList.toggle('hidden', !o.fps);
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

  /** Full-screen world map (Tab). */
  toggleMap() {
    this.minimap.setBig(!this.minimap.big);
  }

  update(run: Run, realDt: number) {
    const p = run.player;
    this.arpg.update(run);
    const hpk = Math.max(0, p.hp / p.stats.maxHp);

    // day / night
    const dn = run.dayNight;
    this.set('dnOn', dn.enabled ? 1 : 0, () => this.dnBox.classList.toggle('hidden', !dn.enabled));
    if (dn.enabled) {
      this.set('dnPer', dn.period, () => {
        this.dnName.textContent = t('period_' + dn.period);
        this.dnBox.dataset.period = dn.period;
      });
      this.set('dnNext', Math.ceil(dn.timeToNext), () => (this.dnNext.textContent = `${fmtTime(Math.ceil(dn.timeToNext))} ${t('period_next')}`));
      this.set('dnDeg', Math.round(dn.cycleProgress * 360), () => this.dnMark.setAttribute('transform', `rotate(${(dn.cycleProgress * 360).toFixed(1)})`));
    }

    // buffs with remaining time
    const b = p.buffs;
    const bk = `${Math.ceil(b.fury)}|${Math.ceil(b.haste)}|${Math.ceil(b.aegis)}|${Math.ceil(b.frenzy)}|${p.shield}`;
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
    });

    // hurt vignette
    const v = p.hurtT > 0 ? 0.7 : hpk < 0.25 ? 0.25 + Math.sin(run.time * 6) * 0.1 : 0;
    this.set('vig', Math.round(v * 20), () => (this.vignette.style.opacity = String(v)));

    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerBox.classList.remove('show');
    }
    if (this.opts.minimap || this.minimap.big) this.minimap.update(realDt);
    this.fpsAcc += realDt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      if (this.opts.fps) this.fps.textContent = `FPS: ${Math.round(this.fpsN / this.fpsAcc)}`;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }
}
