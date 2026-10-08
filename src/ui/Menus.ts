import { armoryScreen } from './ArmoryScreen';
import { h, clear, hex, put } from './dom';
import { iconImg } from './icons';
import { thumbImg } from '../render/Thumbnails';
import { t, L } from '../i18n';
import type { RunMode } from '../game/Waves';
import { statModLines, fmtNum, fmtTime } from './format';
import type { Profile } from '../meta/Profile';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { CLASSES, classDef } from '../game/action/classes';
import { ENEMIES, ENEMY_BY_ID } from '../data/enemies';
import { MAP_LORE } from '../data/mapLore';
import { WAVE_TYPE_COLOR, WaveDirector } from '../game/Waves';
import { BOSSES, RELICS, BOSS_BY_ID } from '../data/bosses';
import { MAPS } from '../data/maps';
import { DIFFICULTIES } from '../data/difficulty';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../data/achievements';
import type { AchievementCategory, AchievementDef } from '../data/types';
import { settingsPanel } from './Settings';
import { viewerScreen } from './ViewerScreen';
import { classInfo, classStage, tr } from './ClassPreview';

export interface MenuApi {
  profile: Profile;
  sfx(id: string): void;
  startRun(hero: string, map: string, diff: string, mode?: RunMode): void;
  /** Captures the next key press for rebinding. */
  captureKey(cb: (code: string) => void): void;
  /** True when a setting changed that only applies after a restart. */
  needsRestart(): boolean;
  setShowcase(modelId: string): void;
  /** Slides the menu showcase model toward the right edge (0 = centred, 1 = right third). */
  setMenuShift(v: number): void;
  applySettings(): void;
  resetProgress(): void;
  /** Stops drawing the 3D menu backdrop while a screen with its own 3D view is open. */
  setBackdropPaused(v: boolean): void;
  /** Developer mode switch and its tools (Settings → Developer). */
  setDevMode(on: boolean): void;
  openDevPanel(): void;
  toggleDevDebug(): void;
  version: string;
}

type ScreenId = 'main' | 'armory' | 'heroes' | 'viewer' | 'maps' | 'collection' | 'achievements' | 'settings';

const RARITY_COLOR: Record<string, string> = { common: '#c8ccd8', uncommon: '#6aff8a', rare: '#5ab4ff', epic: '#c77dff', legendary: '#ffb02e' };
/** Tabs along the top bar of the menu screens (Q / E cycle through them). */
const TABS: ScreenId[] = ['armory', 'viewer', 'maps', 'collection', 'achievements', 'settings'];
/** Screens where the 3D showcase stays visible on the right instead of an item preview. */
const SHOWCASE: ScreenId[] = ['main', 'maps'];
/** Screens with their own 3D view (the menu backdrop stops drawing). */
const OWN_3D: ScreenId[] = ['viewer', 'heroes'];

function pill(text: string, color: string): HTMLElement {
  return h('span.pill', { style: `--pc:${color}` }, text);
}

/** Builds the out-of-run menu screens inside a single container. */
export class Menus {
  readonly root: HTMLElement;
  private stack: ScreenId[] = [];
  private selectMode = false;
  private selHero: string = HEROES[0].id;
  private selMap = 'blightwood';
  private selDiff = 'normal';
  private achStatus: 'all' | 'done' | 'locked' = 'all';
  private achCat: AchievementCategory | 'all' = 'all';
  /** Set by the Endless button: the map screen opens with Endless mode picked. */
  private presetMode: RunMode | null = null;
  /** Tear-down for the open screen (the character viewer owns a WebGL context). */
  private cleanup: (() => void) | null = null;

  constructor(parent: HTMLElement, private api: MenuApi) {
    this.root = h('div.menus');
    parent.appendChild(this.root);
    const last = api.profile.data.last;
    this.selHero = HERO_BY_ID[last.hero] ? last.hero : HEROES[0].id;
    this.selMap = last.map;
    this.selDiff = last.diff;
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private get current(): ScreenId {
    return this.stack[this.stack.length - 1] ?? 'main';
  }

  private onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat || this.root.classList.contains('hidden')) return;
    if (modalOpen()) return;
    const id = this.current;
    if (id === 'main') return;
    if (OWN_3D.includes(id) && e.code !== 'KeyQ' && e.code !== 'KeyE' && e.code !== 'Enter') return;
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      this.cycleTab(e.code === 'KeyQ' ? -1 : 1);
    } else if (e.code === 'Enter' && this.selectMode) {
      e.preventDefault();
      (this.root.querySelector('.detail .btn.primary') as HTMLElement | null)?.click();
    }
  }

  private tabs(): ScreenId[] {
    return this.selectMode ? ['heroes', 'maps'] : TABS;
  }

  private cycleTab(dir: number) {
    const tabs = this.tabs();
    const i = tabs.indexOf(this.current);
    if (i < 0) return;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    if (this.selectMode && next === 'maps' && !this.api.profile.isHeroUnlocked(this.selHero)) return;
    this.api.sfx('ui');
    this.switchTo(next);
  }

  private switchTo(id: ScreenId) {
    this.stack[this.stack.length - 1] = id;
    this.render();
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }

  open(id: ScreenId, push = true) {
    if (push) this.stack.push(id);
    this.render();
  }

  /** True when a screen other than the main menu is open. */
  get canGoBack(): boolean {
    return this.stack.length > 1 || (this.stack.length === 1 && this.stack[0] !== 'main');
  }

  back() {
    this.api.sfx('uiBack');
    this.stack.pop();
    if (!this.stack.length) this.stack.push('main');
    if (this.stack[this.stack.length - 1] === 'main') {
      this.selectMode = false;
      this.presetMode = null;
    }
    this.render();
  }

  home() {
    this.stack = ['main'];
    this.selectMode = false;
    this.presetMode = null;
    this.render();
  }

  render() {
    const id = this.stack[this.stack.length - 1] ?? 'main';
    this.cleanup?.();
    this.cleanup = null;
    clear(this.root);
    this.api.setBackdropPaused(OWN_3D.includes(id));
    const el = this.build(id);
    el.classList.add('screen', 'screen-' + id);
    this.root.appendChild(el);
    this.api.setMenuShift(id === 'main' ? 0 : 1);
    this.root.scrollTop = 0;
  }

  private build(id: ScreenId): HTMLElement {
    switch (id) {
      case 'main':
        return this.mainScreen();
      case 'heroes':
        return this.heroScreen();
      case 'viewer': {
        const v = viewerScreen(this.api.profile, this.selHero, (x) => this.api.sfx(x), (hid) => {
          if (this.api.profile.isHeroUnlocked(hid)) this.selHero = hid;
        });
        this.cleanup = () => v.dispose();
        return this.frame(v.el);
      }
      case 'armory': {
        const gold = h('div.gold-chip', h('i.ic-coin'), h('span', fmtNum(this.api.profile.data.gold)));
        const el = armoryScreen(this.api.profile, (x) => this.api.sfx(x), this.selHero, (hid) => (this.selHero = hid), () => ((gold.lastChild as HTMLElement).textContent = fmtNum(this.api.profile.data.gold)));
        return this.frame(el, { gold });
      }
      case 'maps':
        return this.mapScreen();
      case 'collection':
        return this.collectionScreen();
      case 'achievements':
        return this.achievementScreen();
      case 'settings':
        return this.frame(h('div.mcol', settingsPanel(this.api, () => this.render())));
    }
  }

  /**
   * Dungeon-crawler style screen frame: tab bar with Q/E key chips and currency on top,
   * content in the middle, key hints along the bottom.
   */
  private frame(body: HTMLElement, opts: { extra?: HTMLElement; gold?: HTMLElement } = {}): HTMLElement {
    const id = this.current;
    const tabs = this.tabs();
    const bar = h('div.mtabs');
    tabs.forEach((tid, i) => {
      const label = this.selectMode ? `${i + 1}. ${t(tid === 'heroes' ? 'choose_hero' : 'choose_map')}` : t('menu_' + tid);
      bar.append(
        h('button.mtab' + (tid === id ? '.sel' : ''), {
          onclick: () => {
            if (tid === id) return;
            if (this.selectMode && tid === 'maps' && !this.api.profile.isHeroUnlocked(this.selHero)) return;
            this.api.sfx('ui');
            this.switchTo(tid);
          },
        }, label),
      );
    });
    const hint = (label: string, keys: string[], onclick: () => void) => h('button.mhint', { onclick }, h('span', label), ...keys.map((k) => h('span.key', k)));
    const hints = [hint(t('btn_back'), ['Esc'], () => this.back())];
    if (tabs.length > 1) hints.unshift(hint(t('hint_tabs'), ['Q', 'E'], () => this.cycleTab(1)));
    if (this.selectMode) hints.unshift(hint(id === 'maps' ? t('btn_start') : t('btn_next'), ['Enter'], () => (this.root.querySelector('.detail .btn.primary') as HTMLElement | null)?.click()));
    return h(
      'div.mframe' + (SHOWCASE.includes(id) ? '.showcase' : ''),
      h(
        'div.mtop',
        h('div.mtop-l'),
        h('div.mtop-c', h('span.key.tabkey', { onclick: () => this.cycleTab(-1) }, 'Q'), bar, h('span.key.tabkey', { onclick: () => this.cycleTab(1) }, 'E')),
        h('div.mtop-r', opts.extra ?? null, opts.gold ?? h('div.gold-chip', h('i.ic-coin'), fmtNum(this.api.profile.data.gold))),
      ),
      h('div.mbody', body),
      h('div.mfoot', ...hints),
    );
  }

  /** Marks the clicked cell of a grid as selected. */
  private selectable(grid: HTMLElement): HTMLElement {
    grid.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest('.icon-cell');
      if (!cell) return;
      for (const c of grid.children) c.classList.toggle('sel', c === cell);
    });
    return grid;
  }

  private btn(label: string, onclick: () => void, cls = ''): HTMLElement {
    return h('button.btn' + cls, {
      onclick: () => {
        this.api.sfx('ui');
        onclick();
      },
    }, label);
  }

  // ------------------------------------------------------------------ main
  private mainScreen(): HTMLElement {
    const p = this.api.profile;
    this.api.setShowcase(HERO_BY_ID[this.selHero]?.model ?? HEROES[0].model);
    const newAch = ACHIEVEMENTS.length;
    return h(
      'div.main-menu',
      h('div.logo', h('div.logo-title', 'CUBEBORN'), h('div.logo-sub', t('game_subtitle'))),
      h(
        'div.main-buttons',
        this.btn(t('menu_play'), () => {
          if (!p.data.seenIntro) {
            this.api.startRun(this.selHero, MAPS[0].id, 'normal');
            return;
          }
          this.selectMode = true;
          this.open('heroes');
        }, '.primary.big'),
        h(
          'div.main-grid',
          this.btn(t('menu_armory'), () => this.open('armory'), '.armory-btn'),
          this.btn(t('menu_characters'), () => {
            this.selectMode = false;
            this.open('viewer');
          }),
          this.btn(t('menu_maps'), () => {
            this.selectMode = false;
            this.open('maps');
          }),
          this.btn(t('menu_collection'), () => this.open('collection')),
          this.btn(`${t('menu_achievements')} ${p.data.achievements.length}/${newAch}`, () => this.open('achievements')),
          this.btn(t('menu_endless'), () => {
            this.selectMode = true;
            this.presetMode = 'endless';
            this.open('heroes');
          }),
          this.btn(t('menu_settings'), () => this.open('settings')),
        ),
      ),
      h('div.main-foot', h('div.gold-chip', h('i.ic-coin'), fmtNum(p.data.gold)), h('div.power', t('power_level', { n: p.powerLevel() })), h('div.version', this.api.version)),
    );
  }

  // ------------------------------------------------------------------ heroes
  /**
   * Class select: the nine classes on the left, a large rotatable 3D preview with animation
   * buttons in the middle, and the full class sheet on the right; "Choose map" moves on.
   */
  private heroScreen(): HTMLElement {
    const p = this.api.profile;
    if (!p.isHeroUnlocked(this.selHero)) this.selHero = HEROES.find((x) => p.isHeroUnlocked(x.id))?.id ?? HEROES[0].id;
    const st = classStage((x) => this.api.sfx(x), false);
    const list = h('div.cs-list');
    const info = h('div.detail.cs-info');
    let cur = this.selHero;
    const show = (id: string) => {
      const c = classDef(id);
      const unlocked = p.isHeroUnlocked(id);
      cur = id;
      if (unlocked) this.selHero = id;
      for (const el of list.children) el.classList.toggle('sel', (el as HTMLElement).dataset.id === id);
      st.setClass(c);
      clear(info);
      const ach = ACHIEVEMENTS.find((a) => a.reward?.kind === 'hero' && a.reward.id === id);
      const wins = p.stat('herowin_' + id);
      put(
        info,
        classInfo(c, p.data.settings.keybinds),
        wins ? h('div.kv', h('span', t('cv_wins')), h('span', String(wins))) : null,
        unlocked ? null : h('div.locked-note', '🔒 ' + (ach ? t('unlock_by', { name: L(ach.name), desc: L(ach.desc) }) : t('locked'))),
      );
      clear(foot);
      if (this.selectMode && unlocked) foot.append(this.btn(tr('Выбрать карту', 'Choose map') + ' →', () => this.open('maps'), '.primary.big'));
      else if (!this.selectMode)
        foot.append(
          this.btn(t('cv_open'), () => {
            this.selHero = id;
            this.open('viewer');
          }),
        );
    };
    const foot = h('div.detail.cs-foot');
    for (const c of CLASSES) {
      const unlocked = p.isHeroUnlocked(c.id);
      const wins = p.stat('herowin_' + c.id);
      list.append(
        h(
          'button.cs-card' + (unlocked ? '' : '.locked'),
          {
            'data-id': c.id,
            style: `--hc:${hex(c.color)}`,
            onclick: () => {
              this.api.sfx('select');
              show(c.id);
            },
          },
          thumbImg(c.id, 'thumb', !unlocked),
          h('div.cs-card-txt', h('div.cs-card-name', L(c.name)), h('div.cs-card-role', L(c.role)), h('div.cs-card-diff', '★'.repeat(c.difficulty) + '☆'.repeat(Math.max(0, 3 - c.difficulty)))),
          wins ? h('div.badge', '★') : null,
        ),
      );
    }
    const step = (dir: number) => {
      const i = CLASSES.findIndex((c) => c.id === cur);
      this.api.sfx('select');
      show(CLASSES[(i + dir + CLASSES.length) % CLASSES.length].id);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || modalOpen()) return;
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') step(-1);
      else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') step(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    this.cleanup = () => {
      window.removeEventListener('keydown', onKey);
      st.dispose();
    };
    show(cur);
    st.viewer.play('idle');
    st.viewer.start();
    const center = h(
      'div.cs-center',
      h('div.cv-stage-wrap.cs-stage', st.stage, h('button.cv-nav.prev', { onclick: () => step(-1) }, '‹'), h('button.cv-nav.next', { onclick: () => step(1) }, '›'), h('div.cv-hint', tr('Тяните мышью — вращать · колесо — масштаб · ↑/↓ — класс', 'Drag to rotate · wheel to zoom · ↑/↓ — class'))),
      st.anims,
    );
    return this.frame(h('div.cs', list, center, h('div.cs-right', info, foot)));
  }

  // ------------------------------------------------------------------ maps
  private selMode: RunMode = 'campaign';

  private mapScreen(): HTMLElement {
    const p = this.api.profile;
    if (!p.isMapUnlocked(this.selMap)) this.selMap = MAPS[0].id;
    this.selMode = this.presetMode ?? p.data.last.mode ?? 'campaign';
    const list = h('div.map-list');
    const detail = h('div.detail.map-detail');
    const show = (id: string) => {
      const m = MAPS.find((x) => x.id === id)!;
      const lore = MAP_LORE[id];
      const unlocked = p.isMapUnlocked(id);
      if (unlocked) this.selMap = id;
      for (const c of list.children) c.classList.toggle('sel', (c as HTMLElement).dataset.id === id);
      clear(detail);
      const maxD = p.maxDifficulty(id);
      if (DIFFICULTIES.findIndex((d) => d.id === this.selDiff) > maxD) this.selDiff = 'normal';
      const diffs = h('div.diffs');
      const diffInfo = h('div.diff-info');
      const renderDiffs = () => {
        clear(diffs);
        DIFFICULTIES.forEach((d, i) => {
          const ok = i <= maxD;
          diffs.append(
            h(
              'button.diff' + (d.id === this.selDiff ? '.sel' : '') + (ok ? '' : '.locked'),
              {
                style: `--dc:${d.color}`,
                onclick: () => {
                  if (!ok) {
                    this.api.sfx('denied');
                    return;
                  }
                  this.api.sfx('select');
                  this.selDiff = d.id;
                  renderDiffs();
                },
              },
              ok ? L(d.name) : '🔒',
            ),
          );
        });
        const d = DIFFICULTIES.find((x) => x.id === this.selDiff)!;
        clear(diffInfo);
        diffInfo.append(h('span', L(d.modifiers)), h('span.reward', t('reward_mult', { n: d.reward })));
      };
      renderDiffs();
      const prev = MAPS[MAPS.indexOf(m) - 1];
      const prevBoss = prev && BOSS_BY_ID[prev.boss];
      const seenBoss = (bid: string) => unlocked || p.data.discovered.bosses.includes(bid);
      // main enemies: the heaviest weights across the map's pools
      const weights = new Map<string, number>();
      for (const seg of m.segments) for (const [eid, w] of seg.pool) weights.set(eid, (weights.get(eid) ?? 0) + w);
      const mainEnemies = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([eid]) => (p.data.discovered.enemies.includes(eid) || unlocked ? L(ENEMY_BY_ID[eid]?.name) : '???'));
      const next = MAPS[MAPS.indexOf(m) + 1];
      const relics = [m.midBoss, m.boss].map((b) => RELICS.find((r) => r.id === BOSS_BY_ID[b]?.relic)).filter(Boolean);
      const rec = p.data.endless[id];
      const modes = h('div.seg.mode-seg');
      const modeInfo = h('div.mode-info');
      const renderModes = () => {
        clear(modes);
        for (const md of ['campaign', 'endless'] as RunMode[])
          modes.append(
            h('button' + (this.selMode === md ? '.sel' : ''), {
              onclick: () => {
                this.api.sfx('select');
                this.selMode = md;
                renderModes();
              },
            }, t('mode_' + md)),
          );
        clear(modeInfo);
        if (this.selMode === 'campaign') {
          const plan = WaveDirector.campaignPlan();
          const strip = h('div.wave-strip.big');
          plan.forEach((type, i) => strip.append(h('i' + (type === 'boss' || type === 'final' ? '.boss' : ''), { style: `--wc:${WAVE_TYPE_COLOR[type]}`, title: `${i + 1}: ${t('wave_' + type)}` })));
          const idx = (ty: string) => plan.map((x, i) => (x === ty ? i + 1 : 0)).filter(Boolean).join(', ');
          modeInfo.append(
            h('p.small', t('campaign_desc', { n: plan.length })),
            strip,
            h('div.kv', h('span', t('wave_elite')), h('span', idx('elite'))),
            h('div.kv', h('span', t('wave_danger')), h('span', idx('danger'))),
            h('div.kv', h('span', t('wave_boss')), h('span', `10, 20 — ${seenBoss(m.midBoss) ? L(BOSS_BY_ID[m.midBoss].name) : '???'}`)),
            h('div.kv', h('span', t('wave_final')), h('span', `30 — ${seenBoss(m.boss) ? L(BOSS_BY_ID[m.boss].name) : '???'}`)),
          );
        } else {
          modeInfo.append(
            h('p.small', t('endless_desc')),
            rec
              ? h('div.record', h('b', t('best_wave', { n: rec.wave })), h('span', `${fmtTime(rec.time)} · ${fmtNum(rec.kills)} ${t('r_kills').toLowerCase()} · ${t('lvl_short', { n: rec.level })} · ${rec.gold} ${t('gold')}`))
              : h('div.record.none', t('no_record')),
          );
        }
      };
      renderModes();
      put(
        detail,
        h('div.detail-title', h('h3', L(m.name)), h('div.stars', '★'.repeat(m.difficultyStars) + '☆'.repeat(Math.max(0, 6 - m.difficultyStars)))),
        h('p', L(m.desc)),
        lore ? h('p.story', L(lore.story)) : null,
        lore ? h('div.feature', h('b', '✦ ' + L(lore.feature.name)), h('span', L(lore.feature.desc))) : null,
        lore ? h('div.kv', h('span', t('recommended')), h('span', L(lore.recommended))) : null,
        h('div.kv', h('span', t('main_enemies')), h('span', mainEnemies.join(', '))),
        h('div.kv', h('span', t('boss_mid')), h('span', seenBoss(m.midBoss) ? L(BOSS_BY_ID[m.midBoss].name) : '???')),
        h('div.kv', h('span', t('boss_final')), h('span', seenBoss(m.boss) ? L(BOSS_BY_ID[m.boss].name) : '???')),
        h('div.kv', h('span', t('rewards')), h('span', [t('relics') + ': ' + relics.map((r) => (p.data.discovered.relics.includes(r!.id) ? L(r!.name) : '???')).join(', '), next ? t('opens_map', { name: L(next.name) }) : t('last_map')].join(' · '))),
        h('div.kv', h('span', t('best_clear')), h('span', p.data.mapClears[id] !== undefined ? L(DIFFICULTIES[p.data.mapClears[id]].name) : '—')),
        unlocked ? h('div', h('div.label', t('mode')), modes, modeInfo, h('div.label', t('difficulty')), diffs, diffInfo) : h('div.locked-note', '🔒 ' + t('map_unlock', { boss: prevBoss ? L(prevBoss.name) : '?' })),
        unlocked
          ? this.btn(t('btn_start'), () => {
              p.data.last = { hero: this.selHero, map: this.selMap, diff: this.selDiff, mode: this.selMode };
              p.save();
              this.api.startRun(this.selHero, this.selMap, this.selDiff, this.selMode);
            }, '.primary.big')
          : null,
      );
    };
    for (const m of MAPS) {
      const unlocked = p.isMapUnlocked(m.id);
      const clear_ = p.data.mapClears[m.id];
      const rec = p.data.endless[m.id];
      list.append(
        h(
          'button.map-card' + (unlocked ? '' : '.locked'),
          {
            'data-id': m.id,
            style: `--mc:${hex(m.palette.tiles[Object.keys(m.palette.tiles)[0]][0])}`,
            onclick: () => {
              this.api.sfx('select');
              show(m.id);
            },
          },
          h('div.map-swatch'),
          h('div.name', unlocked ? L(m.name) : '???'),
          rec ? h('div.badge.wave-badge', '∞' + rec.wave) : null,
          clear_ !== undefined ? h('div.badge', { style: `color:${DIFFICULTIES[clear_].color}` }, '★') : null,
        ),
      );
    }
    setTimeout(() => show(this.selMap));
    return this.frame(h('div.split', list, detail));
  }

  // ------------------------------------------------------------------ collection
  private tab = 'enemies';
  private collectionScreen(): HTMLElement {
    const p = this.api.profile;
    const tabs = h('div.tabs');
    const body = h('div.split.tri');
    const grid = this.selectable(h('div.icon-grid'));
    const detail = h('div.detail');
    const preview = h('div.preview');
    const look = (node: HTMLElement, color: string) => {
      clear(preview);
      preview.append(node);
      preview.style.setProperty('--rc', color);
    };
    body.append(grid, detail, preview);
    const render = () => {
      clear(tabs);
      for (const id of ['enemies', 'bosses', 'relics']) {
        tabs.append(
          h('button.tab' + (this.tab === id ? '.sel' : ''), {
            onclick: () => {
              this.api.sfx('ui');
              this.tab = id;
              render();
            },
          }, t('tab_' + id)),
        );
      }
      clear(grid);
      clear(detail);
      clear(preview);
      if (this.tab === 'enemies') {
        grid.classList.add('thumbs');
        for (const e of ENEMIES) {
          if (e.behavior === 'prop' || e.id === 'shield_crystal') continue;
          const seen = p.data.discovered.enemies.includes(e.id);
          grid.append(
            h('button.icon-cell.thumb-cell' + (seen ? '' : '.locked'), {
              onclick: () => {
                clear(detail);
                if (!seen) {
                  put(detail, h('h3', '???'), h('p', t('not_seen')));
                  return;
                }
                look(thumbImg(e.model, 'thumb huge'), RARITY_COLOR.common);
                put(detail, 
                  h('div.detail-title', h('h3', L(e.name)), pill(t('cat_' + e.category), RARITY_COLOR.common)),
                  h('div.kv', h('span', t('stat_maxHp')), h('span', String(e.hp))),
                  h('div.kv', h('span', t('ws_damage')), h('span', String(e.damage))),
                  h('div.kv', h('span', t('stat_moveSpeed')), h('span', String(e.speed))),
                  h('div.kv', h('span', t('killed')), h('span', fmtNum(p.stat('kill_' + e.id)))),
                );
              },
            }, thumbImg(e.model, 'thumb', !seen)),
          );
        }
      } else if (this.tab === 'bosses') {
        grid.classList.add('thumbs');
        for (const b of BOSSES) {
          const seen = p.data.discovered.bosses.includes(b.id);
          grid.append(
            h('button.icon-cell.thumb-cell' + (seen ? '' : '.locked'), {
              style: `--rc:${RARITY_COLOR.epic}`,
              onclick: () => {
                clear(detail);
                if (!seen) {
                  put(detail, h('h3', '???'), h('p', t('not_seen')));
                  return;
                }
                const relic = RELICS.find((r) => r.id === b.relic);
                look(thumbImg(b.model, 'thumb huge'), RARITY_COLOR.epic);
                put(detail, 
                  h('div.detail-title', h('h3', L(b.name)), pill(L(b.title), hex(b.color))),
                  h('div.kv', h('span', t('stat_maxHp')), h('span', fmtNum(b.hp))),
                  h('div.kv', h('span', t('phases')), h('span', String(b.phases.length))),
                  h('div.kv', h('span', t('killed')), h('span', fmtNum(p.stat('boss_' + b.id)))),
                  relic ? h('div.kv', h('span', t('relic')), h('span', p.data.discovered.relics.includes(relic.id) ? L(relic.name) : '???')) : null,
                );
              },
            }, thumbImg(b.model, 'thumb', !seen)),
          );
        }
      } else {
        for (const r of RELICS) {
          const got = p.data.discovered.relics.includes(r.id);
          grid.append(
            h('button.icon-cell' + (got ? '' : '.locked'), {
              style: `--rc:${RARITY_COLOR.legendary}`,
              onclick: () => {
                clear(detail);
                if (got) look(iconImg('relic_' + r.id, r.color, 'icon xl'), RARITY_COLOR.legendary);
                const boss = BOSSES.find((b) => b.relic === r.id);
                put(detail, 
                  h('div.detail-title', h('h3', got ? L(r.name) : '???'), got ? pill(t('relic'), RARITY_COLOR.legendary) : null),
                  h('p', got ? L(r.desc) : t('relic_hint', { boss: boss ? L(boss.name) : '?' })),
                  got ? h('div.mods', ...statModLines(r.stats).map((s) => h('div.mod', s))) : null,
                );
              },
            }, iconImg('relic_' + r.id, r.color, 'icon', !got)),
          );
        }
      }
      if (this.tab !== 'enemies' && this.tab !== 'bosses') grid.classList.remove('thumbs');
      (grid.firstChild as HTMLElement | null)?.click();
    };
    render();
    return this.frame(h('div.mcol', tabs, body));
  }

  // ------------------------------------------------------------------ achievements
  private achievementScreen(): HTMLElement {
    const p = this.api.profile;
    const all = ACHIEVEMENTS;
    const doneSet = new Set(p.data.achievements);
    const doneCount = all.filter((a) => doneSet.has(a.id)).length;
    const pct = Math.round((doneCount / all.length) * 100);
    const goldEarned = all.filter((a) => doneSet.has(a.id)).reduce((g, a) => g + (a.gold ?? 0), 0);
    const rerender = () => this.render();
    // filters: status and category
    const statusSeg = h(
      'div.seg.ach-filter',
      ...(['all', 'done', 'locked'] as const).map((f) =>
        h('button' + (this.achStatus === f ? '.sel' : ''), { onclick: () => ((this.achStatus = f), this.api.sfx('ui'), rerender()) }, t('ach_' + f) + ` · ${f === 'all' ? all.length : f === 'done' ? doneCount : all.length - doneCount}`),
      ),
    );
    const catSeg = h(
      'div.seg.ach-cats',
      h('button' + (this.achCat === 'all' ? '.sel' : ''), { onclick: () => ((this.achCat = 'all'), this.api.sfx('ui'), rerender()) }, t('ach_all')),
      ...ACHIEVEMENT_CATEGORIES.map((c) => {
        const inCat = all.filter((a) => a.category === c);
        const got = inCat.filter((a) => doneSet.has(a.id)).length;
        return h('button' + (this.achCat === c ? '.sel' : ''), { onclick: () => ((this.achCat = c), this.api.sfx('ui'), rerender()) }, `${t('achcat_' + c)} ${got}/${inCat.length}`);
      }),
    );
    const head = h(
      'div.ach-head',
      h('div.ach-total', h('span', t('ach_total', { n: doneCount, m: all.length })), h('span.ach-pct', pct + '%')),
      h('div.prog.big', h('div', { style: `width:${pct}%` })),
      h('div.ach-sub', t('ach_rewards', { g: goldEarned.toLocaleString('ru-RU') })),
      statusSeg,
      catSeg,
    );
    const list = h('div.ach-list');
    const shown = all
      .filter((a) => (this.achCat === 'all' || a.category === this.achCat) && (this.achStatus === 'all' || (this.achStatus === 'done') === doneSet.has(a.id)))
      // unlocked first, then the closest to completion
      .map((a, i) => ({ a, i, done: doneSet.has(a.id), prog: p.achievementProgress(a) }))
      .sort((x, y) => Number(y.done) - Number(x.done) || (x.done ? 0 : y.prog - x.prog) || x.i - y.i);
    for (const { a, done, prog } of shown) {
      const hidden = a.hidden && !done;
      const val = p.achievementValue(a);
      const rc = RARITY_COLOR[a.rarity];
      list.append(
        h(
          'div.ach' + (done ? '.done' : '') + '.r-' + a.rarity,
          { style: `--rc:${rc}` },
          h('div.ach-icon', iconImg(hidden ? 'crystal' : a.icon, done ? a.color : 0x5a606a, 'icon')),
          h(
            'div.ach-body',
            h('div.ach-top', h('div.ach-name', hidden ? '???' : L(a.name)), h('div.ach-rar', t('rarity_' + a.rarity))),
            h('div.ach-desc', hidden ? t('hidden_ach') : L(a.desc)),
            done
              ? null
              : h('div.ach-progrow', h('div.prog', h('div', { style: `width:${Math.round(prog * 100)}%` })), h('span.ach-num', `${fmtNum(val)} / ${fmtNum(a.cond.value)}`)),
            a.reward || a.gold ? h('div.ach-reward', rewardText(a)) : null,
          ),
        ),
      );
    }
    if (!shown.length) list.append(h('div.ach-empty', t('ach_empty')));
    return this.frame(h('div.mcol.ach-screen', head, list), { extra: h('div.count', `${doneCount}/${all.length}`) });
  }
}

// ------------------------------------------------------------------ shared helpers

export function rewardText(a: AchievementDef): string {
  const parts: string[] = [];
  if (a.reward) {
    const r = a.reward;
    const name =
      r.kind === 'hero' ? L(HERO_BY_ID[r.id]?.name) : r.kind === 'map' ? L(MAPS.find((m) => m.id === r.id)?.name) : '';
    // weapons and passives are gone with the class rework: their rewards show nothing
    if (name) parts.push(t('unlock_' + r.kind, { name }));
  }
  if (a.gold) parts.push(`+${a.gold} ${t('gold')}`);
  return parts.join(' · ');
}

export function confirmBox(parent: HTMLElement, text: string, yes: () => void) {
  const box = h(
    'div.modal-back.confirm',
    h(
      'div.modal',
      h('p', text),
      h(
        'div.row',
        h('button.btn', { onclick: () => box.remove() }, t('btn_no')),
        h('button.btn.danger', {
          onclick: () => {
            box.remove();
            yes();
          },
        }, t('btn_yes')),
      ),
    ),
  );
  (parent.closest('.app') ?? parent).appendChild(box);
}

export { settingsPanel };
export { fmtTime };

/** True while a visible modal is open (hidden screens may keep their modal elements in the DOM). */
function modalOpen(): boolean {
  return [...document.querySelectorAll<HTMLElement>('.modal-back')].some((m) => m.getClientRects().length > 0);
}
