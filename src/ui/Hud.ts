import './mcd.css';
import './hud.css';
import './rpg.css';
import type { World } from '../rpg/World';
import { h, clear } from './dom';
import { t } from '../i18n';
import { item } from '../rpg/items';
import { RACE_BY_ID } from '../rpg/races';
import { itemIcon } from './itemIcons';

export interface HudOptions {
  fps: boolean;
}

/**
 * Heads-up display of the training ground: the hero frame (name, race, level, health), the
 * target frame of the selected dummy (damage total, DPS), the world clock, the weapon panel with
 * the inventory button, banners and hints. Writes to the DOM only when a value changes.
 */
export class Hud {
  readonly root: HTMLElement;
  private clockBox: HTMLElement;
  private clockTime = h('div.ck-time');
  private clockName = h('div.ck-name');
  private banner: HTMLElement;
  private bannerSub: HTMLElement;
  private bannerBox: HTMLElement;
  private fps: HTMLElement;
  private hint: HTMLElement;
  private heroName = h('b');
  private heroSub = h('span');
  private heroHp = h('i');
  private heroHpText = h('em');
  private target: HTMLElement;
  private tName = h('b');
  private tTotal = h('span');
  private tDps = h('span');
  private tHits = h('span');
  private weaponIcon = h('div.rh-wicon');
  private weaponName = h('b');
  private weaponInfo = h('span');
  private cd = h('i');
  private last: Record<string, string | number> = {};
  private bannerT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private opts: HudOptions = { fps: false };
  /** Inventory button / target clear button. */
  onInventory: (() => void) | null = null;
  onClearTarget: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.clockBox = h('div.clock', h('div.ck-icon', sunMoonSvg()), h('div.ck-text', this.clockTime, this.clockName));
    this.banner = h('div.banner-main');
    this.bannerSub = h('div.banner-sub');
    this.bannerBox = h('div.banner', this.banner, this.bannerSub);
    this.fps = h('div.fps.hidden');
    this.hint = h('div.rh-hint.hidden');
    this.target = h(
      'div.rh-target.hidden',
      h('div.rh-tname', this.tName, h('button.rh-tx', { title: 'Снять цель', onclick: () => this.onClearTarget?.() }, '×')),
      h('div.rh-tbar', h('i')),
      h('div.rh-tstats', this.tTotal, this.tDps, this.tHits),
      h('small', 'Манекен не атакует и не погибает'),
    );
    const invBtn = h('button.rh-inv', { title: 'Инвентарь и снаряжение (I)', onclick: () => this.onInventory?.() }, h('i.rh-bag'), h('span', 'Инвентарь'), h('kbd', 'I'));
    this.root = h(
      'div.hud.rpg-hud',
      h('div.rh-tl', h('div.rh-hero', h('div.rh-hero-txt', this.heroName, this.heroSub), h('div.rh-hp', this.heroHp, this.heroHpText)), this.fps),
      h('div.rh-top', this.target),
      h('div.rh-tr', this.clockBox),
      this.bannerBox,
      this.hint,
      h('div.rh-bottom', h('div.rh-weapon', this.weaponIcon, h('div.rh-wtxt', this.weaponName, this.weaponInfo), h('div.rh-cd', this.cd)), invBtn),
    );
    parent.appendChild(this.root);
  }

  reset() {
    this.last = {};
    this.bannerBox.classList.remove('show');
  }

  setOptions(o: HudOptions) {
    this.opts = o;
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

  showHint(on: boolean) {
    this.hint.classList.toggle('hidden', !on);
    if (on) {
      clear(this.hint);
      this.hint.append(
        h('div', h('kbd', 'WASD'), ' — ходьба, ', h('kbd', 'Пробел'), ' — прыжок, ', h('kbd', 'ЛКМ'), ' по земле — идти'),
        h('div', h('kbd', 'ЛКМ'), ' по манекену — выбрать цель и атаковать, ', h('kbd', 'ПКМ'), ' / ', h('kbd', 'F'), ' — базовая атака'),
        h('div', h('kbd', 'I'), ' — инвентарь и снаряжение, ', h('kbd', 'Esc'), ' — пауза'),
      );
    }
  }

  update(w: World, realDt: number, charName: string, level: number) {
    const st = w.stats;
    // hero frame
    this.set('hn', charName, () => (this.heroName.textContent = charName));
    const sub = `${RACE_BY_ID[w.raceId]?.name ?? ''} · Уровень ${level}`;
    this.set('hs', sub, () => (this.heroSub.textContent = sub));
    this.set('hp', st.maxHp, () => {
      this.heroHp.style.width = '100%';
      this.heroHpText.textContent = `${st.maxHp} / ${st.maxHp}`;
    });
    // target frame
    const tg = w.target;
    this.set('tg', tg ? tg.id : '', () => {
      this.target.classList.toggle('hidden', !tg);
      if (tg) this.tName.textContent = tg.name;
    });
    if (tg) {
      const tot = `Всего: ${tg.total}`;
      const dps = `DPS: ${Math.round(tg.dps(w.time))}`;
      const hits = `Ударов: ${tg.hits}`;
      this.set('tt', tot, () => (this.tTotal.textContent = tot));
      this.set('td', dps, () => (this.tDps.textContent = dps));
      this.set('th', hits, () => (this.tHits.textContent = hits));
    }
    // weapon panel
    const main = w.gear.equip.main;
    this.set('wp', `${main}|${st.hitDamage}|${st.interval}`, () => {
      clear(this.weaponIcon);
      const def = item(main);
      if (def) this.weaponIcon.append(itemIcon(def.id, 2));
      this.weaponName.textContent = def?.name ?? 'Без оружия';
      const kind = st.weapon?.dmgType === 'magic' ? 'маг.' : 'физ.';
      this.weaponInfo.textContent = `${Math.round(st.hitDamage)} ${kind} урона · раз в ${st.interval.toFixed(2)} с · дальность ${st.range}`;
    });
    const p = w.player;
    const k = st.interval > 0 ? Math.max(0, Math.min(1, p.cooldown / st.interval)) : 0;
    this.cd.style.width = `${Math.round((1 - k) * 100)}%`;
    // world clock
    const dn = w.dayNight;
    const hm = dn.clock.hhmm;
    this.set('ckT', hm, () => (this.clockTime.textContent = hm));
    this.set('ckP', dn.period, () => {
      this.clockName.textContent = { day: 'День', dusk: 'Закат', night: 'Ночь', dawn: 'Рассвет' }[dn.period] ?? '';
      this.clockBox.dataset.period = dn.period;
    });
    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerBox.classList.remove('show');
    }
    this.fpsAcc += realDt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      if (this.opts.fps) this.fps.textContent = `FPS: ${Math.round(this.fpsN / this.fpsAcc)}`;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    void t;
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
