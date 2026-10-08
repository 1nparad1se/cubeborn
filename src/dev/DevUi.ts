import { h, clear } from '../ui/dom';
import { L, t } from '../i18n';
import { WEAPONS, WEAPON_BY_ID } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { BALANCE } from '../config/balance';
import { keyName } from '../input/Input';
import { dev, INF_XP_MUL, type DevToggle } from './DevMode';
import type { PickupKind } from '../game/Pickups';
import type { GearSlot } from '../game/arpg/Gear';
import type { Rarity, StatKey } from '../data/types';
import { RARITIES } from '../data/types';

// selections survive panel rebuilds
const sel = {
  weapon: WEAPONS.find((w) => !w.evolved)?.id ?? '',
  evo: WEAPONS.find((w) => w.evolved)?.id ?? '',
  passive: PASSIVES[0]?.id ?? '',
  enemy: ENEMIES.find((e) => e.behavior !== 'prop')?.id ?? '',
  boss: BOSSES[0]?.id ?? '',
  power: 'fury' as PickupKind,
  count: 1,
  wave: 10,
  time: 300,
  xp: 500,
  gold: 1000,
  coins: 10000,
  slot: 'any' as GearSlot | 'any',
  rarity: 'legendary' as Rarity,
  stat: 'might' as StatKey,
  statV: 0.25,
};
const openSecs = new Set<string>(['player', 'arpg', 'time']);

/**
 * Developer overlays: the DEVELOPER TOOLS panel (F1), the debug info readout (F2) and the
 * TEST MODE / GOD MODE badges. Nothing here is created unless developer mode is switched on.
 */
export class DevUi {
  private panel = h('div.dev-panel.hidden');
  private body = h('div.dev-body');
  private msg = h('div.dev-msg');
  private info = h('div.dev-info.hidden');
  private badge = h('div.dev-badge.hidden');
  private fps = 0;
  private frames = 0;
  private fpsT = 0;
  private infoT = 0;
  private scroll = 0;
  inRun = false;

  constructor(parent: HTMLElement, private keys: () => { panel: string; debug: string; god: string }) {
    put(this.panel, h('div.dev-head', h('b', t('dv_title')), h('span.dev-test', t('dv_test')), h('button.dev-x', { title: t('dv_close'), onclick: () => this.setPanel(false) }, '✕')), this.body, this.msg);
    parent.append(this.panel, this.info, this.badge);
    // keep game keys and wheel zoom away from the panel's inputs
    this.panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    dev.subscribe(() => this.refresh());
    this.refresh();
  }

  setPanel(on: boolean) {
    dev.panelOpen = on && dev.enabled;
    this.refresh();
  }

  setDebug(on: boolean) {
    dev.debugOpen = on && dev.enabled;
    this.refresh();
  }

  setInRun(v: boolean) {
    this.inRun = v;
    this.refresh();
  }

  refresh() {
    const on = dev.enabled;
    this.badge.classList.toggle('hidden', !on);
    this.badge.classList.toggle('in-run', this.inRun);
    if (on) {
      clear(this.badge);
      this.badge.append(h('span.dev-badge-main', { onclick: () => this.setPanel(!dev.panelOpen), title: t('dv_title') }, t('dv_badge')));
      if (dev.toggles.god) this.badge.append(h('span.dev-badge-god', t('dv_god_on')));
      if (dev.paused) this.badge.append(h('span.dev-badge-god', t('dv_paused')));
      else if (dev.timeScale !== 1) this.badge.append(h('span.dev-badge-time', '×' + dev.timeScale));
    }
    this.info.classList.toggle('hidden', !(on && dev.debugOpen));
    this.panel.classList.toggle('hidden', !(on && dev.panelOpen));
    this.msg.textContent = dev.message;
    if (on && dev.panelOpen) this.build();
  }

  /** Per-frame: FPS counter and the debug readout (updated a few times a second). */
  frame(realDt: number) {
    this.frames++;
    this.fpsT += realDt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    if (!dev.enabled || !dev.debugOpen) return;
    this.infoT -= realDt;
    if (this.infoT > 0) return;
    this.infoT = 0.25;
    const run = dev.run;
    const rows: [string, string][] = [[t('dv_i_fps'), this.fps.toFixed(0)]];
    if (run) {
      const p = run.player;
      const w = run.waves.wave;
      const tm = run.time;
      let proj = 0;
      for (const x of run.projectiles.list) if (x.active) proj++;
      let picks = 0;
      for (const x of run.pickups.list) if (x.active) picks++;
      rows.push(
        [t('dv_i_enemies'), String(run.enemies.aliveCount)],
        [t('dv_i_proj'), String(proj)],
        [t('dv_i_pickups'), String(picks)],
        [t('dv_i_wave'), `${w.n} (${t('wave_' + w.type)})`],
        [t('dv_i_time'), `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`],
        [t('dv_i_dps'), dev.dps.value.toFixed(0)],
        [t('dv_i_taken'), `${Math.round(run.stats.damageTaken)} (${dev.dtps.value.toFixed(1)}${t('dv_per_s')})`],
        [t('dv_i_spawn'), dev.spawnRate.value.toFixed(1) + t('dv_per_s')],
        [t('dv_i_xp'), `${t('dv_lv', { n: p.level })} · ${Math.floor(p.xp)}/${Math.floor(p.xpNext)}`],
        [t('dv_i_hp'), `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}`],
        [t('dv_i_gold'), String(Math.floor(run.stats.gold))],
      );
    }
    rows.push([t('dv_i_coins'), String(dev.profile?.data.gold ?? 0)]);
    clear(this.info);
    this.info.append(h('div.dev-info-head', t('dv_info_head')), ...rows.map(([k, v]) => h('div.dev-row', h('span', k), h('b', v))));
  }

  // ---------------------------------------------------------------- panel
  private build() {
    this.scroll = this.body.scrollTop;
    clear(this.body);
    const run = dev.run;
    const k = this.keys();
    const noRun = run ? null : h('div.dev-note', t('dv_need_run'));
    this.body.append(
      h('div.dev-keys', t('dv_keys', { panel: keyName(k.panel), debug: keyName(k.debug), god: keyName(k.god) })),
      h('div.dev-row2', btn(t('dv_max_player'), () => dev.maxPlayer(), '.gold', !run), btn(t('dv_reset_state'), () => dev.resetTestState(), '.red')),
      sec('player', t('dv_sec_player'), [
        tog(t('dv_god'), 'god'),
        tog(t('dv_infHp'), 'infHp'),
        tog(t('dv_infXp', { n: INF_XP_MUL }), 'infXp'),
        tog(t('dv_infGold'), 'infGold'),
        tog(t('dv_infCoins'), 'infCoins'),
        h('div.dev-grid', btn(t('dv_max_level'), () => dev.maxLevel(), '', !run), btn(t('dv_heal'), () => dev.heal(), '', !run), btn(t('dv_kill_player'), () => dev.killPlayer(), '.red', !run)),
        numRow(t('dv_add_xp'), 'xp', () => dev.addXp(sel.xp), !run),
        numRow(t('dv_add_gold'), 'gold', () => dev.addGold(sel.gold), !run),
        numRow(t('dv_add_coins'), 'coins', () => dev.addCoins(sel.coins)),
        noRun,
      ]),
      sec('arpg', t('dv_sec_arpg'), run ? this.arpgSec() : [noRun]),
      sec('gear', t('dv_sec_gear'), run ? this.gearSec() : [noRun]),
      sec('unlock', t('dv_sec_unlock'), [
        h(
          'div.dev-grid',
          btn(t('dv_unlock_heroes'), () => dev.unlock('heroes')),
          btn(t('dv_unlock_weapons'), () => dev.unlock('weapons')),
          btn(t('dv_unlock_maps'), () => dev.unlock('maps')),
          btn(t('dv_unlock_upgrades'), () => dev.unlock('upgrades')),
          btn(t('dv_unlock_achievements'), () => dev.unlock('achievements')),
          btn(t('dv_unlock_evolutions'), () => dev.unlock('evolutions')),
        ),
        btn(t('dv_unlock_all'), () => dev.unlock('all'), '.gold.wide'),
        h('div.dev-note', t('dv_unlock_note')),
      ]),
      sec('weapons', t('dv_sec_weapons'), run ? this.weaponsSec() : [noRun]),
      sec('enemies', t('dv_sec_enemies'), [
        pick(ENEMIES.filter((e) => e.behavior !== 'prop').map((e) => [e.id, L(e.name)]), () => sel.enemy, (v) => (sel.enemy = v)),
        h('div.dev-grid', ...[1, 10, 50].map((n) => btn(t('dv_spawn_n', { n }), () => dev.spawnEnemy(sel.enemy, false, n), '', !run)), btn(t('dv_spawn_elite'), () => dev.spawnEnemy(sel.enemy, true), '', !run)),
        pick(BOSSES.map((b) => [b.id, L(b.name)]), () => sel.boss, (v) => (sel.boss = v)),
        h('div.dev-grid', btn(t('dv_spawn_boss'), () => dev.spawnBoss(sel.boss), '', !run), btn(t('dv_kill_all'), () => dev.killAll(), '.red', !run)),
        tog(t('dv_freeze'), 'freeze'),
        mulRow(t('dv_enemy_hp'), () => dev.enemyHp, (v) => dev.setEnemyMul(v, dev.enemyDmg)),
        mulRow(t('dv_enemy_dmg'), () => dev.enemyDmg, (v) => dev.setEnemyMul(dev.enemyHp, v)),
        h('div.dev-note', t('dv_mul_note')),
        noRun,
      ]),
      sec('waves', t('dv_sec_waves'), [
        run ? h('div.dev-cur', t('dv_wave_cur', { n: run.waves.wave.n, total: run.waves.total === Infinity ? '∞' : run.waves.total, type: t('wave_' + run.waves.wave.type) })) : noRun,
        h('div.dev-grid', btn('◀ ' + t('dv_prev_wave'), () => dev.prevWave(), '', !run), btn(t('dv_next_wave') + ' ▶', () => dev.nextWave(), '', !run), btn(t('dv_skip_wave'), () => dev.nextWave(), '', !run), btn(t('dv_restart_wave'), () => dev.restartWave(), '', !run)),
        numRow(t('dv_set_wave'), 'wave', () => dev.setWave(sel.wave), !run, t('dv_go')),
        h('div.dev-grid', btn(t('dv_boss_wave'), () => dev.spawnWaveBoss(), '', !run), btn(t('dv_elite_wave'), () => dev.eliteWave(), '', !run)),
      ]),
      sec('daynight', t('dv_sec_daynight'), [
        run ? h('div.dev-cur', run.dayNight.enabled ? t('dv_dn_cur', { period: t('period_' + run.dayNight.period), blood: run.dayNight.bloodMoon ? t('dv_dn_blood') : '', n: run.dayNight.nights, s: Math.ceil(run.dayNight.timeToNext) }) : t('dv_dn_off')) : noRun,
        h('div.dev-grid', ...(['dawn', 'day', 'dusk', 'night'] as const).map((p) => btn(t('period_' + p), () => dev.setDayPeriod(p), run?.dayNight.period === p ? '.on' : '', !run))),
        h('div.dev-grid', btn(t('dv_blood_moon'), () => dev.bloodMoon(), '.red', !run), btn(t('dv_night_pack'), () => dev.nightPack(), '', !run), btn(t('dv_night_boss'), () => dev.nightBoss(), '', !run)),
      ]),
      sec('time', t('dv_sec_time'), [
        h('div.dev-grid', btn(dev.paused ? t('dv_resume') : t('dv_pause'), () => dev.setPaused(!dev.paused), dev.paused ? '.on' : '', !run)),
        h('div.dev-numrow', h('span', t('dv_speed')), h('div.dev-seg', ...[0.5, 1, 2, 5].map((v) => btn('×' + v, () => dev.setTimeScale(v), dev.timeScale === v ? '.on' : '')))),
        numRow(t('dv_set_time'), 'time', () => dev.setTime(sel.time), !run, t('dv_go')),
      ]),
      sec('spawn', t('dv_sec_spawn'), [
        h(
          'div.dev-grid',
          btn(t('dv_sp_enemy'), () => dev.spawnEnemy(sel.enemy), '', !run),
          btn(t('dv_sp_elite'), () => dev.spawnEnemy(sel.enemy, true), '', !run),
          btn(t('dv_sp_boss'), () => dev.spawnBoss(sel.boss), '', !run),
          btn(t('dv_sp_chest'), () => dev.spawnPickup('chest'), '', !run),
          btn(t('dv_sp_xp'), () => dev.spawnPickup('xp', 200), '', !run),
          btn(t('dv_sp_gold'), () => dev.spawnPickup('pouch', 25), '', !run),
          btn(t('dv_sp_coins'), () => dev.spawnPickup('coins'), '', !run),
        ),
        pick((['fury', 'haste', 'aegis', 'frenzy', 'chrono', 'nuke', 'heart', 'magnet', 'star'] as PickupKind[]).map((p) => [p, t('dv_pu_' + p)]), () => sel.power, (v) => (sel.power = v as PickupKind)),
        btn(t('dv_sp_power'), () => dev.spawnPickup(sel.power), '.wide', !run),
      ]),
      sec('clear', t('dv_sec_clear'), [
        h('div.dev-grid', btn(t('dv_clear_enemies'), () => dev.killAll(), '.red', !run), btn(t('dv_clear_proj'), () => dev.clearProjectiles(), '', !run), btn(t('dv_clear_pickups'), () => dev.clearPickups(), '', !run), btn(t('dv_clear_fx'), () => dev.clearEffects(), '', !run)),
      ]),
      sec('debug', t('dv_sec_debug'), [btn(dev.debugOpen ? t('dv_hide_debug') : t('dv_show_debug'), () => this.setDebug(!dev.debugOpen), dev.debugOpen ? '.on.wide' : '.wide')]),
    );
    this.body.scrollTop = this.scroll;
  }

  /** Hero level, skill levels, cooldowns, resource, per-skill tests and teleport. */
  private arpgSec(): (HTMLElement | null)[] {
    const run = dev.run!;
    const sk = run.skills;
    const rows = h('div.dev-list');
    for (let i = 0; i < 4; i++) {
      const def = sk.skill(i);
      const lv = sk.level(i);
      const max = i === 3 ? 4 : 6;
      rows.append(
        h(
          'div.dev-item',
          h('span.dev-item-name', `${['Q', 'W', 'E', 'R'][i]} · ${L(def.name)}`),
          h('span.dev-lv', `${lv}/${max}`),
          btn('−', () => dev.setSkillLevel(i, lv - 1), '.sq', false, t('dv_level_down')),
          btn('+', () => dev.setSkillLevel(i, lv + 1), '.sq', false, t('dv_level_up')),
          btn(t('dv_max_short'), () => dev.setSkillLevel(i, max), '.sq', false, t('dv_level_up')),
          btn('▶', () => dev.testSkill(i), '.sq', false, t('dv_test_skill')),
        ),
      );
    }
    return [
      h('div.dev-cur', t('dv_arpg_cur', { cls: L(sk.kit.role), res: L(sk.kit.res.name), lv: run.player.level })),
      h('div.dev-grid', btn(t('dv_arpg_max'), () => dev.arpgMax(), '.gold'), btn(t('dv_max_level'), () => dev.maxLevel()), btn(t('dv_cd_reset'), () => dev.resetCooldowns()), btn(t('dv_heal'), () => dev.heal())),
      tog(t('dv_infRes'), 'infRes'),
      tog(t('dv_noCd'), 'noCd'),
      tog(t('dv_god'), 'god'),
      rows,
      h('div.dev-grid', btn(t('dv_tp'), () => dev.teleportToCursor())),
      h('div.dev-note', t('dv_tp_note')),
    ];
  }

  /** Items, gear sets and stat overrides. */
  private gearSec(): (HTMLElement | null)[] {
    const slots: (GearSlot | 'any')[] = ['any', 'weapon', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'ring', 'trinket'];
    const stats: StatKey[] = ['might', 'maxHp', 'armor', 'moveSpeed', 'critChance', 'critDamage', 'cooldown', 'regen', 'area', 'lifesteal', 'duration'];
    const v = h('input.dev-num', { type: 'number', step: '0.05', value: String(sel.statV) }) as HTMLInputElement;
    v.addEventListener('change', () => (sel.statV = Number(v.value) || 0));
    return [
      h('div.dev-pickrow', pick(slots.map((x) => [x, x === 'any' ? t('dv_any_slot') : t('slot_' + x)]), () => sel.slot, (x) => (sel.slot = x as GearSlot | 'any')), pick(RARITIES.map((r) => [r, t('rar_' + r)]), () => sel.rarity, (x) => (sel.rarity = x as Rarity))),
      h('div.dev-grid', btn(t('dv_create_item'), () => dev.createItem(sel.slot, sel.rarity)), btn(t('dv_gear_set'), () => dev.giveGearSet(sel.rarity), '.gold')),
      h('div.dev-sub', t('dv_set_stats')),
      h('div.dev-pickrow', pick(stats.map((x) => [x, t('stat_' + x)]), () => sel.stat, (x) => (sel.stat = x as StatKey)), v, btn('+', () => dev.addStat(sel.stat, sel.statV))),
      btn(t('dv_stats_clear'), () => dev.clearStats(), '.wide'),
      h('div.dev-note', t('dv_stats_note')),
    ];
  }

  private weaponsSec(): (HTMLElement | null)[] {
    const run = dev.run!;
    const list = h('div.dev-list');
    for (const w of run.weapons.list) {
      list.append(
        h(
          'div.dev-item',
          h('span.dev-item-name', { style: `color:#${w.def.color.toString(16).padStart(6, '0')}` }, L(w.def.name)),
          h('span.dev-lv', `${w.level}/${w.maxLevel}`),
          btn('−', () => dev.setWeaponLevel(w.def.id, w.level - 1), '.sq', false, t('dv_level_down')),
          btn('+', () => dev.setWeaponLevel(w.def.id, w.level + 1), '.sq', false, t('dv_level_up')),
          btn(t('dv_max_short'), () => dev.setWeaponLevel(w.def.id, w.maxLevel), '.sq', false, t('dv_max_weapon')),
          btn('✕', () => dev.removeWeapon(w.def.id), '.sq.red', false, t('dv_remove_weapon')),
        ),
      );
    }
    const plist = h('div.dev-list');
    for (const [id, lvl] of run.passives.levels) {
      const def = PASSIVE_BY_ID[id];
      plist.append(
        h(
          'div.dev-item',
          h('span.dev-item-name', L(def.name)),
          h('span.dev-lv', `${lvl}/${def.maxLevel}`),
          btn('−', () => dev.setPassiveLevel(id, lvl - 1), '.sq', false, t('dv_passive_down')),
          btn('+', () => dev.setPassiveLevel(id, lvl + 1), '.sq', false, t('dv_passive_up')),
          btn(t('dv_max_short'), () => dev.setPassiveLevel(id, def.maxLevel), '.sq', false, t('dv_passive_max')),
          btn('✕', () => dev.setPassiveLevel(id, 0), '.sq.red', false, t('dv_passive_remove')),
        ),
      );
    }
    return [
      h('div.dev-sub', t('dv_weapons_n', { n: run.weapons.list.length, max: BALANCE.weaponSlots })),
      list,
      h('div.dev-pickrow', pick(WEAPONS.filter((w) => !w.evolved).map((w) => [w.id, L(w.name)]), () => sel.weapon, (v) => (sel.weapon = v)), btn(t('dv_add_weapon'), () => dev.addWeapon(sel.weapon))),
      h('div.dev-pickrow', pick(WEAPONS.filter((w) => w.evolved).map((w) => [w.id, L(w.name)]), () => sel.evo, (v) => (sel.evo = v)), btn(t('dv_evolve'), () => dev.addEvolution(sel.evo))),
      h('div.dev-sub', t('dv_passives_n', { n: run.passives.count, max: BALANCE.passiveSlots })),
      plist,
      h('div.dev-pickrow', pick(PASSIVES.map((x) => [x.id, L(x.name)]), () => sel.passive, (v) => (sel.passive = v)), btn(t('dv_add_passive'), () => dev.addPassive(sel.passive))),
      h('div.dev-note', WEAPON_BY_ID[sel.evo]?.evolved ? t('dv_evolve_note') : ''),
    ];
  }
}

// ---------------------------------------------------------------- tiny builders
function put(el: HTMLElement, ...kids: (HTMLElement | null)[]) {
  for (const k of kids) if (k) el.append(k);
}

function btn(label: string, fn: () => void, cls = '', disabled = false, title?: string): HTMLElement {
  const b = h('button.dev-btn' + cls, { onclick: () => !disabled && fn(), title: title ?? (disabled ? t('dv_need_run') : label) }, label);
  if (disabled) b.classList.add('off');
  return b;
}

function tog(label: string, key: DevToggle): HTMLElement {
  const on = dev.toggles[key];
  return h('button.dev-tog' + (on ? '.on' : ''), { onclick: () => dev.toggle(key) }, h('span', label), h('b', on ? t('dv_on') : t('dv_off')));
}

function sec(id: string, title: string, kids: (HTMLElement | null)[]): HTMLElement {
  const d = h('details.dev-sec', h('summary', title)) as HTMLDetailsElement;
  d.open = openSecs.has(id);
  d.addEventListener('toggle', () => (d.open ? openSecs.add(id) : openSecs.delete(id)));
  put(d, ...kids);
  return d;
}

function pick(opts: [string, string][], get: () => string, set: (v: string) => void): HTMLElement {
  const s = h('select.dev-select') as HTMLSelectElement;
  for (const [id, name] of opts) s.append(h('option', { value: id }, name));
  s.value = get();
  s.addEventListener('change', () => set(s.value));
  return s;
}

function numRow(label: string, key: 'xp' | 'gold' | 'coins' | 'wave' | 'time', fn: () => void, disabled = false, go = '+'): HTMLElement {
  const inp = h('input.dev-num', { type: 'number', value: String(sel[key]), min: '0' }) as HTMLInputElement;
  inp.addEventListener('change', () => (sel[key] = Math.max(0, Number(inp.value) || 0)));
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sel[key] = Math.max(0, Number(inp.value) || 0);
      if (!disabled) fn();
    }
  });
  return h('div.dev-numrow', h('span', label), inp, btn(go, () => {
    sel[key] = Math.max(0, Number(inp.value) || 0);
    fn();
  }, '', disabled));
}

function mulRow(label: string, get: () => number, set: (v: number) => void): HTMLElement {
  const steps = [0.25, 0.5, 1, 2, 5, 10];
  return h('div.dev-numrow', h('span', `${label} ×${get()}`), h('div.dev-seg', ...steps.map((v) => btn('×' + v, () => set(v), get() === v ? '.on' : ''))));
}
