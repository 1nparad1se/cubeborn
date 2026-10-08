import { h, clear, hex, put } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { num } from './format';
import { WEAPON_BY_ID, WEAPONS, WEAPON_MAX_LEVEL } from '../data/weapons';
import type { WeaponDef, WeaponStats } from '../data/types';
import { WEAPON_VISUALS, visualTier, type WeaponAnim } from '../config/weaponVisuals';
import { WeaponViewer } from '../render/WeaponViewer';

const RARITY_COLOR: Record<string, string> = { common: '#c8ccd8', uncommon: '#6aff8a', rare: '#5ab4ff', epic: '#c77dff', legendary: '#ffb02e' };
const SPEEDS = [0.25, 0.5, 1];

export interface WeaponViewerScreen {
  el: HTMLElement;
  dispose(): void;
}

/** Weapons with an animated 3D model, each base weapon followed by its evolution. */
export function animatedWeapons(): WeaponDef[] {
  const out: WeaponDef[] = [];
  for (const w of WEAPONS) {
    if (w.evolved || !WEAPON_VISUALS[w.id]) continue;
    out.push(w);
    const evo = w.evolution ? WEAPON_BY_ID[w.evolution.into] : null;
    if (evo && WEAPON_VISUALS[evo.id]) out.push(evo);
  }
  return out;
}

/** Stats of a weapon at a level (base plus every level-up delta). */
function statsAt(w: WeaponDef, level: number): WeaponStats {
  const s = { ...w.base };
  for (let i = 0; i < level - 1 && i < w.levels.length; i++) {
    const d = w.levels[i];
    for (const k in d) s[k] = (s[k] ?? 0) + (d[k] ?? 0);
  }
  return s;
}

/**
 * WEAPON ANIMATIONS: a list of weapons on the left, the selected weapon's model on its own lit
 * stage in the middle (drag to rotate, wheel to zoom) with buttons for every animation, and its
 * description, type, level and stats on the right.
 */
export function weaponViewerScreen(startId: string | null, sfx: (id: string) => void): WeaponViewerScreen {
  const list = animatedWeapons();
  const stageHost = h('div.cv-stage');
  const viewer = new WeaponViewer(stageHost);
  const info = h('div.cv-info');
  const strip = h('div.cv-strip.wv-strip');
  const animBar = h('div.cv-anims');
  const tools = h('div.cv-tools');
  const levelBar = h('div.wv-levels');
  let cur = list.find((w) => w.id === startId) ?? list[0];
  let level = cur.evolved ? 1 : WEAPON_MAX_LEVEL;

  const tierOf = () => visualTier(level, cur.evolved ? 1 : WEAPON_MAX_LEVEL, !!cur.evolved);

  const renderInfo = () => {
    const w = cur;
    const vis = WEAPON_VISUALS[w.id];
    const s = statsAt(w, level);
    const tier = tierOf();
    const rows: [string, string][] = [
      [t('ws_damage'), num(s.damage)],
      [t('wd_cooldown_s'), num(s.cooldown) + t('u_s')],
      [t('stat_amount'), num(s.amount)],
      [t('stat_area'), Math.round(s.area * 100) + '%'],
      [t('stat_duration'), num(s.duration) + t('u_s')],
      [t('stat_pierce'), s.pierce < 0 ? '∞' : num(s.pierce)],
      [t('stat_critChance'), Math.round(s.critChance * 100) + '%'],
    ];
    clear(info);
    put(
      info,
      h('div.cv-name', L(w.name)),
      h('div.wv-tags', h('span.pill', { style: `--pc:${RARITY_COLOR[w.rarity]}` }, t('rarity_' + w.rarity)), w.evolved ? h('span.pill', { style: '--pc:#ffd23d' }, t('evolution')) : null),
      h('p.cv-desc', L(w.desc)),
      h('div.cv-sec', t('wv_look')),
      h('p.wv-look', t('wv_look_' + w.id) !== 'wv_look_' + w.id ? t('wv_look_' + w.id) : ''),
      h('div.kv', h('span', t('wv_type')), h('span', t('wv_kind_' + (vis?.kind ?? 'projectile')))),
      h('div.kv', h('span', t('wv_level')), h('span', w.evolved ? t('evolution') : level >= WEAPON_MAX_LEVEL ? 'MAX' : String(level))),
      h('div.kv', h('span', t('wv_stage')), h('span', t('wv_tier_' + tier))),
      h('div.cv-sec', t('cv_stats')),
      ...rows.map(([k, v]) => h('div.kv', h('span', k), h('span', v))),
    );
  };

  const renderLevels = () => {
    clear(levelBar);
    levelBar.append(h('span.cv-label', t('wv_level')));
    if (cur.evolved) {
      levelBar.append(h('button.cv-tool.on', t('evolution')));
      return;
    }
    for (let lv = 1; lv <= WEAPON_MAX_LEVEL; lv++) {
      levelBar.append(
        h('button.cv-tool' + (lv === level ? '.on' : ''), {
          title: t('wv_tier_' + visualTier(lv, WEAPON_MAX_LEVEL, false)),
          onclick: () => {
            sfx('ui');
            level = lv;
            viewer.setTier(tierOf());
            renderLevels();
            renderInfo();
          },
        }, lv === WEAPON_MAX_LEVEL ? 'MAX' : String(lv)),
      );
    }
    const evo = cur.evolution ? WEAPON_BY_ID[cur.evolution.into] : null;
    if (evo)
      levelBar.append(
        h('button.cv-tool.evo', {
          onclick: () => {
            sfx('select');
            show(evo.id);
          },
        }, '➜ ' + L(evo.name)),
      );
  };

  const animBtns = new Map<WeaponAnim, HTMLElement>();
  const renderAnims = () => {
    clear(animBar);
    animBtns.clear();
    viewer.anims().forEach((a, i) => {
      const b = h('button.cv-anim' + (i >= 5 ? '.extra' : ''), {
        onclick: () => {
          sfx('ui');
          viewer.play(a);
        },
      }, h('span.key', String(i + 1)), t('wanim_' + a));
      animBtns.set(a, b);
      animBar.append(b);
    });
    for (const [a, b] of animBtns) b.classList.toggle('sel', a === viewer.mode);
  };
  viewer.onModeChange = (m) => {
    for (const [a, b] of animBtns) b.classList.toggle('sel', a === m);
  };

  const show = (id: string) => {
    const w = WEAPON_BY_ID[id];
    if (!w) return;
    cur = w;
    if (w.evolved) level = 1;
    else if (level < 1 || level > WEAPON_MAX_LEVEL) level = WEAPON_MAX_LEVEL;
    for (const c of strip.children) c.classList.toggle('sel', (c as HTMLElement).dataset.id === id);
    stageHost.style.setProperty('--hc', hex(w.color));
    const keep = viewer.anims().includes(viewer.mode) ? viewer.mode : 'idle';
    viewer.weaponId = id;
    const mode = viewer.anims().includes(keep) ? keep : 'idle';
    viewer.mode = mode;
    viewer.setWeapon(id, tierOf());
    renderAnims();
    renderLevels();
    renderInfo();
  };

  for (const w of list) {
    strip.append(
      h(
        'button.cv-card.wv-card' + (w.evolved ? '.evo' : ''),
        {
          'data-id': w.id,
          style: `--hc:${RARITY_COLOR[w.rarity]}`,
          title: L(w.name),
          onclick: () => {
            sfx('select');
            show(w.id);
          },
        },
        iconImg(w.icon, w.color, 'icon'),
        h('span.cv-card-name', L(w.name)),
        h('span.wv-rar', { style: `color:${RARITY_COLOR[w.rarity]}` }, w.evolved ? t('evolution') : t('rarity_' + w.rarity)),
      ),
    );
  }

  const speedSeg = h('div.seg.cv-speed');
  const renderSpeed = () => {
    clear(speedSeg);
    for (const s of SPEEDS)
      speedSeg.append(
        h('button' + (viewer.speed === s ? '.sel' : ''), {
          onclick: () => {
            viewer.speed = s;
            renderSpeed();
          },
        }, '×' + s),
      );
  };
  renderSpeed();
  const toggle = (label: string, title: string, get: () => boolean, set: (v: boolean) => void) => {
    const b: HTMLElement = h('button.cv-tool' + (get() ? '.on' : ''), {
      title,
      onclick: () => {
        sfx('ui');
        set(!get());
        b.classList.toggle('on', get());
      },
    }, label);
    return b;
  };
  put(
    tools,
    h('button.cv-tool.wv-play', { onclick: () => (sfx('ui'), viewer.replay()) }, '▶ ' + t('wv_play')),
    toggle('↻ ' + t('wv_repeat'), t('wv_repeat_hint'), () => viewer.loop, (v) => (viewer.loop = v)),
    h('span.cv-label', t('cv_speed')),
    speedSeg,
    toggle(t('wv_bgfx'), t('wv_bgfx_hint'), () => viewer.bgFx, (v) => viewer.setBgFx(v)),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(0.85) }, '+'),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(1 / 0.85) }, '−'),
    h('button.cv-tool', { onclick: () => viewer.resetView() }, t('cv_reset')),
  );

  const step = (dir: number) => {
    const i = list.findIndex((x) => x.id === cur.id);
    sfx('select');
    show(list[(i + dir + list.length) % list.length].id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') step(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') step(1);
    else if (e.code === 'KeyR') viewer.resetView();
    else if (e.code === 'Space') viewer.replay();
    else if (/^Digit[1-9]$/.test(e.code)) {
      const a = viewer.anims()[Number(e.code.slice(5)) - 1];
      if (a) viewer.play(a);
    } else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const el = h(
    'div.cv.wv',
    strip,
    h('div.cv-center', h('div.cv-stage-wrap.wv-stage', stageHost, h('div.cv-hint', t('wv_hint'))), animBar, levelBar, tools),
    info,
  );
  show(cur.id);
  viewer.play('idle');
  viewer.start();
  (window as unknown as { weaponViewer?: WeaponViewer }).weaponViewer = viewer;
  return {
    el,
    dispose() {
      window.removeEventListener('keydown', onKey);
      viewer.dispose();
      delete (window as unknown as { weaponViewer?: WeaponViewer }).weaponViewer;
    },
  };
}
