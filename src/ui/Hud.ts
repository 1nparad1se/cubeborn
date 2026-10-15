import './classSelect.css';
import './mcd.css';
import './hud.css';
import type { Run } from '../game/Run';
import { h, clear } from './dom';
import { t } from '../i18n';
import { Minimap } from './Minimap';
import { tr } from './ClassPreview';
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
  /** World clock beside the minimap: sun / moon, HH:MM and the period name. */
  private clockBox: HTMLElement;
  private clockTime = h('div.ck-time');
  private clockName = h('div.ck-name');
  private mapWrap: HTMLElement;
  private zoomIn: HTMLElement;
  private zoomOut: HTMLElement;
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
    this.clockBox = h('div.clock', h('div.ck-icon', sunMoonSvg()), h('div.ck-text', this.clockTime, this.clockName));
    this.banner = h('div.banner-main');
    this.bannerSub = h('div.banner-sub');
    this.bannerBox = h('div.banner', this.banner, this.bannerSub);
    this.vignette = h('div.vignette');
    this.fps = h('div.fps.hidden');
    this.hint = h('div.hint.hidden');
    const zoomBtn = (dir: number, label: string, title: string) => {
      const b = h('button.mm-zoom', { title }, label);
      b.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.minimap.zoom(dir);
        this.syncZoom();
      });
      return b;
    };
    this.zoomIn = zoomBtn(1, '+', tr('Приблизить', 'Zoom in'));
    this.zoomOut = zoomBtn(-1, '−', tr('Отдалить', 'Zoom out'));
    this.mapWrap = h('div.mm-wrap', this.minimap.root, compassRing(), h('div.mm-zooms', this.zoomIn, this.zoomOut));
    this.mapBox = h('div.map-box', this.clockBox, this.mapWrap);
    this.syncZoom();
    this.root = h(
      'div.hud',
      this.vignette,
      h('div.hud-tl', this.fps, this.buffs),
      h('div.hud-top', this.arpg.hoverBox),
      h('div.hud-tr', this.mapBox),
      this.bannerBox,
      this.hint,
      this.arpg.root,
    );
    parent.appendChild(this.root);
    // minimap and clock scale with the window (drawn for a 1350×900 reference box)
    const fit = () => {
      const k = Math.min((window.innerWidth || 1280) / 1350, (window.innerHeight || 720) / 900);
      this.root.style.setProperty('--ms', Math.max(0.72, Math.min(1.45, k)).toFixed(4));
    };
    fit();
    window.addEventListener('resize', fit);
  }

  reset(run: Run | null = null) {
    this.last = {};
    this.bannerBox.classList.remove('show');
    this.vignette.style.opacity = '0';
    this.minimap.setRun(run);
    this.arpg.reset(run);
    this.minimap.setBig(false);
    this.mapWrap.classList.remove('big');
  }

  setOptions(o: HudOptions) {
    this.opts = o;
    this.mapWrap.classList.toggle('off', !o.minimap);
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
    this.mapWrap.classList.toggle('big', this.minimap.big);
  }

  private syncZoom() {
    this.zoomIn.classList.toggle('dim', !this.minimap.canZoomIn);
    this.zoomOut.classList.toggle('dim', !this.minimap.canZoomOut);
  }

  update(run: Run, realDt: number) {
    const p = run.player;
    this.arpg.update(run);
    const hpk = Math.max(0, p.hp / p.stats.maxHp);

    // world clock
    const dn = run.dayNight;
    const hm = dn.clock.hhmm;
    this.set('ckT', hm, () => (this.clockTime.textContent = hm));
    this.set('ckP', dn.period, () => {
      this.clockName.textContent = t('period_' + dn.period);
      this.clockBox.dataset.period = dn.period;
    });

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

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(markup: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = markup;
  return box.firstElementChild as HTMLElement;
}

/** Sun (day, dawn, dusk) and crescent moon (night) icons; CSS shows the one for the period. */
function sunMoonSvg(): HTMLElement {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    rays += `<line x1="${(16 + c * 10.5).toFixed(2)}" y1="${(16 + s * 10.5).toFixed(2)}" x2="${(16 + c * 14.5).toFixed(2)}" y2="${(16 + s * 14.5).toFixed(2)}"/>`;
  }
  return svgEl(
    `<svg xmlns="${SVG_NS}" viewBox="0 0 32 32" class="ck-svg">` +
      `<defs><radialGradient id="ckSun" cx="40%" cy="38%" r="65%"><stop offset="0" stop-color="#fff6b0"/><stop offset="0.55" stop-color="#ffc83a"/><stop offset="1" stop-color="#f08a10"/></radialGradient></defs>` +
      `<g class="ck-sun"><g class="ck-rays" stroke-width="2.6" stroke-linecap="round">${rays}</g><circle cx="16" cy="16" r="7.6" fill="url(#ckSun)" stroke="#a85a08" stroke-width="1"/></g>` +
      `<g class="ck-moon"><path d="M20.5 5.5a11 11 0 1 0 6 18.6A9 9 0 0 1 20.5 5.5z" fill="#e6ecff" stroke="#7a88b8" stroke-width="1"/><circle cx="12" cy="17" r="1.6" fill="#c0c8e8"/><circle cx="16" cy="23" r="1.1" fill="#c0c8e8"/></g>` +
      `</svg>`,
  );
}

/** The compass ring around the round minimap: wood band in metal rims, ticks, N E S W plates. */
function compassRing(): HTMLElement {
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    if (i % 18 === 0) continue;
    const a = (i / 72) * Math.PI * 2;
    const long = i % 9 === 0;
    const r0 = long ? 83.5 : 85.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ticks += `<line x1="${(100 + c * r0).toFixed(2)}" y1="${(100 + s * r0).toFixed(2)}" x2="${(100 + c * 89).toFixed(2)}" y2="${(100 + s * 89).toFixed(2)}" stroke-width="${long ? 1.6 : 0.8}"/>`;
  }
  // small silver darts on the diagonals (NE, SE, SW, NW), pointing inward
  let darts = '';
  for (let i = 0; i < 4; i++) {
    const deg = 45 + i * 90;
    darts += `<g transform="rotate(${deg} 100 100)"><path d="M100 13.5 l3.4 7 l-3.4 -1.6 l-3.4 1.6z" fill="url(#mmSilver)" stroke="#1a140c" stroke-width="0.8"/></g>`;
  }
  const plate = (x: number, y: number, ch: string) =>
    `<g class="mm-dir"><circle cx="${x}" cy="${y}" r="10" fill="url(#mmPlate)" stroke="#0e0b07" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="8.2" fill="none" stroke="#8a7a5c" stroke-width="0.8" opacity="0.8"/>` +
    `<text x="${x}" y="${y + 4.6}" text-anchor="middle">${ch}</text></g>`;
  return svgEl(
    `<svg xmlns="${SVG_NS}" viewBox="0 0 200 200" class="mm-ring">` +
      `<defs>` +
      `<linearGradient id="mmWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a30"/><stop offset="0.45" stop-color="#5c3a1c"/><stop offset="1" stop-color="#3a2412"/></linearGradient>` +
      `<linearGradient id="mmMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d2c4"/><stop offset="0.5" stop-color="#7a7468"/><stop offset="1" stop-color="#3a3630"/></linearGradient>` +
      `<linearGradient id="mmSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9a9aa4"/></linearGradient>` +
      `<radialGradient id="mmPlate" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#3e3a34"/><stop offset="1" stop-color="#14120f"/></radialGradient>` +
      `</defs>` +
      `<circle cx="100" cy="100" r="88" fill="none" stroke="#120d08" stroke-width="15"/>` +
      `<circle cx="100" cy="100" r="88" fill="none" stroke="url(#mmWood)" stroke-width="11"/>` +
      `<circle cx="100" cy="100" r="88" fill="none" stroke="#2a1a0c" stroke-width="11" stroke-dasharray="1.2 5.3" opacity="0.45"/>` +
      `<circle cx="100" cy="100" r="94" fill="none" stroke="url(#mmMetal)" stroke-width="2.6"/>` +
      `<circle cx="100" cy="100" r="82" fill="none" stroke="url(#mmMetal)" stroke-width="2.6"/>` +
      `<circle cx="100" cy="100" r="80.6" fill="none" stroke="#0a0806" stroke-width="1"/>` +
      `<g stroke="#e8dcc0" opacity="0.75">${ticks}</g>` +
      darts +
      plate(100, 12, 'N') +
      plate(188, 100, 'E') +
      plate(100, 188, 'S') +
      plate(12, 100, 'W') +
      `</svg>`,
  );
}
