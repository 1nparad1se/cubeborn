import { h, clear, hex, put } from './dom';
import { iconImg } from './icons';
import { thumbImg } from '../render/Thumbnails';
import { t, L } from '../i18n';
import type { RunMode } from '../game/Waves';
import { statModLines, weaponDeltaLines, fmtNum, fmtTime } from './format';
import type { Profile } from '../meta/Profile';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { WEAPONS, WEAPON_BY_ID, WEAPON_MAX_LEVEL } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { ENEMIES, ENEMY_BY_ID } from '../data/enemies';
import { MAP_LORE } from '../data/mapLore';
import { WAVE_TYPE_COLOR, WaveDirector } from '../game/Waves';
import { BOSSES, RELICS, BOSS_BY_ID } from '../data/bosses';
import { MAPS } from '../data/maps';
import { DIFFICULTIES } from '../data/difficulty';
import { PERM_UPGRADES } from '../data/upgrades';
import { ACHIEVEMENTS } from '../data/achievements';
import type { AchievementDef, UnlockRef, WeaponDef } from '../data/types';
import { settingsPanel } from './Settings';

export interface MenuApi {
  profile: Profile;
  sfx(id: string): void;
  startRun(hero: string, map: string, diff: string, mode?: RunMode): void;
  /** Captures the next key press for rebinding. */
  captureKey(cb: (code: string) => void): void;
  /** True when a setting changed that only applies after a restart. */
  needsRestart(): boolean;
  setShowcase(modelId: string): void;
  applySettings(): void;
  resetProgress(): void;
  version: string;
}

type ScreenId = 'main' | 'heroes' | 'maps' | 'weapons' | 'collection' | 'upgrades' | 'achievements' | 'settings';

const RARITY_COLOR: Record<string, string> = { common: '#c8ccd8', uncommon: '#6aff8a', rare: '#5ab4ff', epic: '#c77dff', legendary: '#ffb02e' };

/** Builds the out-of-run menu screens inside a single container. */
export class Menus {
  readonly root: HTMLElement;
  private stack: ScreenId[] = [];
  private selectMode = false;
  private selHero = 'bram';
  private selMap = 'blightwood';
  private selDiff = 'normal';

  constructor(parent: HTMLElement, private api: MenuApi) {
    this.root = h('div.menus');
    parent.appendChild(this.root);
    const last = api.profile.data.last;
    this.selHero = last.hero;
    this.selMap = last.map;
    this.selDiff = last.diff;
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
    if (this.stack[this.stack.length - 1] === 'main') this.selectMode = false;
    this.render();
  }

  home() {
    this.stack = ['main'];
    this.selectMode = false;
    this.render();
  }

  render() {
    const id = this.stack[this.stack.length - 1] ?? 'main';
    clear(this.root);
    const el = this.build(id);
    el.classList.add('screen', 'screen-' + id);
    this.root.appendChild(el);
    this.root.scrollTop = 0;
  }

  private build(id: ScreenId): HTMLElement {
    switch (id) {
      case 'main':
        return this.mainScreen();
      case 'heroes':
        return this.heroScreen();
      case 'maps':
        return this.mapScreen();
      case 'weapons':
        return this.weaponScreen();
      case 'collection':
        return this.collectionScreen();
      case 'upgrades':
        return this.upgradeScreen();
      case 'achievements':
        return this.achievementScreen();
      case 'settings':
        return h('div', this.header(t('menu_settings')), settingsPanel(this.api, () => this.render()));
    }
  }

  private header(title: string, extra?: HTMLElement): HTMLElement {
    return h('div.screen-head', h('button.btn.back', { onclick: () => this.back() }, '‹'), h('h2', title), extra ?? h('div.gold-chip', h('i.ic-coin'), fmtNum(this.api.profile.data.gold)));
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
    this.api.setShowcase(HERO_BY_ID[this.selHero]?.model ?? 'bram');
    const newAch = ACHIEVEMENTS.length;
    return h(
      'div.main-menu',
      h('div.logo', h('div.logo-title', 'CUBEBORN'), h('div.logo-sub', t('game_subtitle'))),
      h(
        'div.main-buttons',
        this.btn(t('menu_play'), () => {
          if (!p.data.seenIntro) {
            this.api.startRun('bram', 'blightwood', 'normal');
            return;
          }
          this.selectMode = true;
          this.open('heroes');
        }, '.primary.big'),
        h(
          'div.main-grid',
          this.btn(t('menu_heroes'), () => {
            this.selectMode = false;
            this.open('heroes');
          }),
          this.btn(t('menu_weapons'), () => this.open('weapons')),
          this.btn(t('menu_collection'), () => this.open('collection')),
          this.btn(t('menu_upgrades'), () => this.open('upgrades')),
          this.btn(`${t('menu_achievements')} ${p.data.achievements.length}/${newAch}`, () => this.open('achievements')),
          this.btn(t('menu_settings'), () => this.open('settings')),
        ),
      ),
      h('div.main-foot', h('div.gold-chip', h('i.ic-coin'), fmtNum(p.data.gold)), h('div.power', t('power_level', { n: p.powerLevel() })), h('div.version', this.api.version)),
    );
  }

  // ------------------------------------------------------------------ heroes
  private heroScreen(): HTMLElement {
    const p = this.api.profile;
    if (!p.isHeroUnlocked(this.selHero)) this.selHero = 'bram';
    const detail = h('div.detail');
    const grid = h('div.hero-grid');
    const show = (id: string) => {
      const hero = HERO_BY_ID[id];
      const unlocked = p.isHeroUnlocked(id);
      if (unlocked) {
        this.selHero = id;
        this.api.setShowcase(hero.model);
      }
      for (const c of grid.children) c.classList.toggle('sel', (c as HTMLElement).dataset.id === id);
      clear(detail);
      const w = WEAPON_BY_ID[hero.startWeapon];
      const ach = ACHIEVEMENTS.find((a) => a.reward?.kind === 'hero' && a.reward.id === id);
      put(detail, 
        h('div.detail-title', h('h3', { style: `color:${hex(hero.color)}` }, L(hero.name)), h('div.sub', L(hero.title))),
        h('p', L(hero.desc)),
        h('div.perk', h('b', L(hero.perkName)), h('span', L(hero.perkDesc))),
        h('div.kv', h('span', t('start_weapon')), h('span.inline', iconImg(w.icon, w.color, 'icon sm'), L(w.name))),
        h('div.kv', h('span', t('stat_maxHp')), h('span', String(hero.baseHp))),
        h('div.kv', h('span', t('stat_moveSpeed')), h('span', String(hero.baseSpeed))),
        ...statModLines(hero.stats).map((s) => h('div.mod', s)),
        unlocked ? null : h('div.locked-note', '🔒 ' + (ach ? t('unlock_by', { name: L(ach.name), desc: L(ach.desc) }) : t('locked'))),
      );
      if (this.selectMode && unlocked) put(detail, this.btn(t('btn_next'), () => this.open('maps'), '.primary'));
    };
    for (const hero of HEROES) {
      const unlocked = p.isHeroUnlocked(hero.id);
      const wins = p.stat('herowin_' + hero.id);
      grid.append(
        h(
          'button.hero-card' + (unlocked ? '' : '.locked'),
          {
            'data-id': hero.id,
            onclick: () => {
              this.api.sfx('select');
              show(hero.id);
            },
          },
          thumbImg(hero.model, 'thumb', !unlocked),
          h('div.name', unlocked ? L(hero.name) : '???'),
          wins ? h('div.badge', '★') : null,
        ),
      );
    }
    setTimeout(() => show(this.selHero));
    return h('div', this.header(this.selectMode ? t('choose_hero') : t('menu_heroes')), h('div.split', grid, detail));
  }

  // ------------------------------------------------------------------ maps
  private selMode: RunMode = 'campaign';

  private mapScreen(): HTMLElement {
    const p = this.api.profile;
    if (!p.isMapUnlocked(this.selMap)) this.selMap = MAPS[0].id;
    this.selMode = p.data.last.mode ?? 'campaign';
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
    return h('div', this.header(t('choose_map')), h('div.split', list, detail));
  }

  // ------------------------------------------------------------------ weapons
  private weaponScreen(): HTMLElement {
    const p = this.api.profile;
    const grid = h('div.icon-grid');
    const detail = h('div.detail');
    const show = (w: WeaponDef) => {
      clear(detail);
      const known = !w.evolved || p.data.discovered.weapons.includes(w.id);
      const unlocked = p.isWeaponUnlocked(w.id);
      if (!known) {
        const base = WEAPONS.find((x) => x.evolution?.into === w.id);
        put(detail, h('h3', '???'), h('p', t('evo_unknown')), base ? h('div.recipe', recipe(base, w)) : null);
        return;
      }
      put(detail, 
        h('div.detail-title', iconImg(w.icon, w.color, 'icon lg'), h('div', h('h3', L(w.name)), h('div.sub', { style: `color:${RARITY_COLOR[w.rarity]}` }, t('rarity_' + w.rarity) + (w.evolved ? ' · ' + t('evolution') : '')))),
        h('p', L(w.desc)),
        !unlocked ? h('div.locked-note', '🔒 ' + lockText(w.id, 'weapon')) : null,
        h('div.stats-table', ...baseStatRows(w)),
        w.levels.length
          ? h('div.levels', ...w.levels.map((d, i) => h('div.lv', h('b', i + 2 === WEAPON_MAX_LEVEL ? 'MAX' : t('lvl_short', { n: i + 2 })), h('span', weaponDeltaLines(d).join(', ')))))
          : null,
        w.evolution ? h('div.recipe', recipe(w, WEAPON_BY_ID[w.evolution.into])) : null,
      );
    };
    const all = WEAPONS.filter((w) => !w.evolved);
    for (const w of all) {
      const evo = w.evolution ? WEAPON_BY_ID[w.evolution.into] : null;
      for (const def of evo ? [w, evo] : [w]) {
        const known = !def.evolved || p.data.discovered.weapons.includes(def.id);
        const unlocked = p.isWeaponUnlocked(def.id);
        grid.append(
          h(
            'button.icon-cell' + (def.evolved ? '.evo' : '') + (unlocked ? '' : '.locked'),
            {
              onclick: () => {
                this.api.sfx('select');
                show(def);
              },
            },
            known ? iconImg(def.icon, def.color) : h('span.q', '?'),
          ),
        );
      }
    }
    setTimeout(() => show(all[0]));
    const found = WEAPONS.filter((w) => !w.evolved || p.data.discovered.weapons.includes(w.id)).length;
    return h('div', this.header(t('menu_weapons'), h('div.count', `${found}/${WEAPONS.length}`)), h('div.split', grid, detail));
  }

  // ------------------------------------------------------------------ collection
  private tab = 'passives';
  private collectionScreen(): HTMLElement {
    const p = this.api.profile;
    const tabs = h('div.tabs');
    const body = h('div.split');
    const grid = h('div.icon-grid');
    const detail = h('div.detail');
    body.append(grid, detail);
    const render = () => {
      clear(tabs);
      for (const id of ['passives', 'enemies', 'bosses', 'relics']) {
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
      if (this.tab === 'passives') {
        for (const ps of PASSIVES) {
          const ok = p.isPassiveUnlocked(ps.id);
          grid.append(
            h('button.icon-cell' + (ok ? '' : '.locked'), {
              onclick: () => {
                clear(detail);
                const evo = WEAPONS.filter((w) => w.evolution?.passive === ps.id);
                put(detail, 
                  h('div.detail-title', iconImg(ps.icon, ps.color, 'icon lg'), h('div', h('h3', L(ps.name)), h('div.sub', t('max_level', { n: ps.maxLevel })))),
                  h('p', L(ps.desc)),
                  h('div.mods', ...statModLines(ps.perLevel).map((s) => h('div.mod', s + ' ' + t('per_level')))),
                  ...evo.map((w) => h('div.recipe', recipe(w, WEAPON_BY_ID[w.evolution!.into]))),
                  ok ? null : h('div.locked-note', '🔒 ' + lockText(ps.id, 'passive')),
                );
              },
            }, iconImg(ps.icon, ps.color)),
          );
        }
      } else if (this.tab === 'enemies') {
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
                put(detail, 
                  h('div.detail-title', h('h3', L(e.name)), h('div.sub', t('cat_' + e.category))),
                  thumbImg(e.model, 'thumb big'),
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
              onclick: () => {
                clear(detail);
                if (!seen) {
                  put(detail, h('h3', '???'), h('p', t('not_seen')));
                  return;
                }
                const relic = RELICS.find((r) => r.id === b.relic);
                put(detail, 
                  h('div.detail-title', h('h3', { style: `color:${hex(b.color)}` }, L(b.name)), h('div.sub', L(b.title))),
                  thumbImg(b.model, 'thumb big'),
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
              onclick: () => {
                clear(detail);
                const boss = BOSSES.find((b) => b.relic === r.id);
                put(detail, 
                  h('div.detail-title', iconImg('crystal', r.color, 'icon lg'), h('h3', got ? L(r.name) : '???')),
                  h('p', got ? L(r.desc) : t('relic_hint', { boss: boss ? L(boss.name) : '?' })),
                  got ? h('div.mods', ...statModLines(r.stats).map((s) => h('div.mod', s))) : null,
                );
              },
            }, iconImg(got ? 'crystal' : 'crystal', got ? r.color : 0x3a3a48)),
          );
        }
      }
      if (this.tab !== 'enemies' && this.tab !== 'bosses') grid.classList.remove('thumbs');
      (grid.firstChild as HTMLElement | null)?.click();
    };
    render();
    return h('div', this.header(t('menu_collection')), tabs, body);
  }

  // ------------------------------------------------------------------ upgrades
  private upgradeScreen(): HTMLElement {
    const p = this.api.profile;
    const list = h('div.upgrade-list');
    const gold = h('div.gold-chip');
    const render = () => {
      clear(gold);
      gold.append(h('i.ic-coin'), fmtNum(p.data.gold));
      clear(list);
      for (const u of PERM_UPGRADES) {
        const lvl = p.permLevel(u.id);
        const max = lvl >= u.maxLevel;
        const cost = p.permNextCost(u.id);
        const can = !max && p.data.gold >= cost;
        list.append(
          h(
            'div.upgrade' + (max ? '.max' : ''),
            iconImg(u.icon, 0xffd23d, 'icon'),
            h('div.up-body', h('div.up-name', L(u.name)), h('div.up-desc', statModLines(u.perLevel).join(', ') + ' ' + t('per_level')), h('div.pips', ...Array.from({ length: u.maxLevel }, (_, i) => h('i' + (i < lvl ? '.on' : ''))))),
            h(
              'button.btn.buy' + (can ? '.primary' : '.disabled'),
              {
                onclick: () => {
                  if (p.buyPerm(u.id)) {
                    this.api.sfx('buy');
                    render();
                  } else this.api.sfx('denied');
                },
              },
              max ? 'MAX' : h('span', h('i.ic-coin'), fmtNum(cost)),
            ),
          ),
        );
      }
    };
    render();
    const refund = this.btn(t('btn_refund'), () => {
      confirmBox(this.root, t('refund_confirm'), () => {
        p.refundPerms();
        render();
      });
    }, '.small');
    return h('div', this.header(t('menu_upgrades'), gold), list, h('div.center', refund));
  }

  // ------------------------------------------------------------------ achievements
  private achievementScreen(): HTMLElement {
    const p = this.api.profile;
    const list = h('div.ach-list');
    for (const a of ACHIEVEMENTS) {
      const done = p.data.achievements.includes(a.id);
      const prog = p.achievementProgress(a);
      const hidden = a.hidden && !done;
      list.append(
        h(
          'div.ach' + (done ? '.done' : ''),
          h('div.ach-icon', done ? '★' : '☆'),
          h(
            'div.ach-body',
            h('div.ach-name', hidden ? '???' : L(a.name)),
            h('div.ach-desc', hidden ? t('hidden_ach') : L(a.desc)),
            done ? null : h('div.prog', h('div', { style: `width:${Math.round(prog * 100)}%` })),
            a.reward || a.gold ? h('div.ach-reward', rewardText(a)) : null,
          ),
        ),
      );
    }
    return h('div', this.header(t('menu_achievements'), h('div.count', `${p.data.achievements.length}/${ACHIEVEMENTS.length}`)), list);
  }
}

// ------------------------------------------------------------------ shared helpers

function recipe(base: WeaponDef, evo: WeaponDef): HTMLElement {
  const ps = PASSIVE_BY_ID[base.evolution!.passive];
  return h('div.recipe-row', iconImg(base.icon, base.color, 'icon sm'), h('span', 'MAX'), h('span.plus', '+'), iconImg(ps.icon, ps.color, 'icon sm'), h('span.arrow', '→'), iconImg(evo.icon, evo.color, 'icon sm'), h('span.recipe-text', `${L(base.name)} + ${L(ps.name)}`));
}

function baseStatRows(w: WeaponDef): HTMLElement[] {
  const b = w.base;
  const rows: [string, string][] = [
    [t('ws_damage'), String(b.damage)],
    [t('wd_cooldown_s'), b.cooldown + t('u_s')],
    [t('stat_amount'), String(b.amount)],
    [t('stat_area'), Math.round(b.area * 100) + '%'],
    [t('stat_projSpeed'), String(b.projSpeed)],
    [t('stat_duration'), b.duration + t('u_s')],
    [t('stat_knockback'), String(b.knockback)],
    [t('stat_pierce'), b.pierce < 0 ? '∞' : String(b.pierce)],
    [t('stat_critChance'), Math.round(b.critChance * 100) + '%'],
    [t('wd_critDamage'), '×' + b.critDamage],
    [t('wd_attackSpeed'), Math.round(b.attackSpeed * 100) + '%'],
    [t('wd_maxLevel'), String(WEAPON_MAX_LEVEL)],
  ];
  return rows.map(([k, v]) => h('div.kv', h('span', k), h('span', v)));
}

function unlockSource(id: string, kind: UnlockRef['kind']): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.reward?.kind === kind && a.reward.id === id);
}

function lockText(id: string, kind: UnlockRef['kind']): string {
  const a = unlockSource(id, kind);
  return a ? t('unlock_by', { name: L(a.name), desc: L(a.desc) }) : t('locked');
}

export function rewardText(a: AchievementDef): string {
  const parts: string[] = [];
  if (a.reward) {
    const r = a.reward;
    const name =
      r.kind === 'hero' ? L(HERO_BY_ID[r.id]?.name) : r.kind === 'weapon' ? L(WEAPON_BY_ID[r.id]?.name) : r.kind === 'passive' ? L(PASSIVE_BY_ID[r.id]?.name) : L(MAPS.find((m) => m.id === r.id)?.name);
    parts.push(t('unlock_' + r.kind, { name }));
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
