import { h, clear } from '../ui/dom';
import { L, t } from '../i18n';
import { ENEMIES, ELITE_IDS, ELITE_MODS } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { keyName } from '../input/Input';
import { dev, INF_XP_MUL, type DevPlace, type DevToggle } from './DevMode';
import type { PickupKind } from '../game/Pickups';
import type { GearSlot } from '../game/arpg/Gear';
import type { Rarity, StatKey } from '../data/types';
import { RARITIES } from '../data/types';
import { CLASSES } from '../game/action/classes';
import { MAX_LEVEL, SKILL_MAX, SLOT_KEYS, TRIPOD_LEVELS, type ClassId } from '../game/action/types';
import { tripodsFor } from '../game/action/tripods';
import type { ActionSystem } from '../game/action/ActionSystem';
import type { Enemy } from '../game/Enemy';
import type { Run } from '../game/Run';

// selections survive panel rebuilds
const sel = {
  cls: (CLASSES[0]?.id ?? 'berserker') as ClassId,
  enemy: ENEMIES.find((e) => e.behavior !== 'prop')?.id ?? '',
  elite: 'random',
  boss: BOSSES[0]?.id ?? '',
  place: 'cursor' as DevPlace,
  point: 'centre',
  power: 'fury' as PickupKind,
  wave: 10,
  time: 300,
  xp: 500,
  gold: 1000,
  coins: 10000,
  level: MAX_LEVEL,
  slot: 'any' as GearSlot | 'any',
  rarity: 'legendary' as Rarity,
  stat: 'might' as StatKey,
  statV: 0.25,
};
const openSecs = new Set<string>(['player', 'combat', 'skills']);

/** Action-system internals the debug readout shows (private in ActionSystem, read-only here). */
interface ActionPeek {
  combo: { slot: number; idx: number; t: number };
  basicIdx: number;
  basicT: number;
}

/** Key label of an action slot: Q..F skills, V Ultimate, X special. */
const slotKey = (slot: number) => (slot < 8 ? SLOT_KEYS[slot] : slot === 8 ? 'V' : 'X');

/**
 * Developer overlays: the developer tools panel (F1), the debug info readout (F2) and the
 * test mode / god mode badges. Nothing here is created unless developer mode is switched on.
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
    if (v && dev.run) sel.cls = dev.run.action.cls.id;
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

  /** Per-frame: FPS counter and the debug readout (updated several times a second). */
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
    this.infoT = 0.1;
    const run = dev.run;
    const rows: [string, string][] = [[t('dv_i_fps'), this.fps.toFixed(0)]];
    if (run) {
      const p = run.player;
      const tm = run.time;
      let proj = 0;
      for (const x of run.projectiles.list) if (x.active) proj++;
      rows.push(
        [t('dv_i_time'), `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')} · ${t('dv_i_wave_n', { n: run.waves.wave.n })}`],
        [t('dv_i_enemies'), `${run.enemies.aliveCount} · ${t('dv_i_proj_n', { n: proj })}`],
        [t('dv_i_dps'), dev.dps.value.toFixed(0)],
        [t('dv_i_taken'), `${Math.round(run.stats.damageTaken)} (${dev.dtps.value.toFixed(1)}${t('dv_per_s')})`],
        [t('dv_i_hp'), `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}`],
        [t('dv_i_xp'), `${t('dv_lv', { n: p.level })} · ${Math.floor(p.xp)}/${Math.floor(p.xpNext)}`],
        ...this.actionRows(run),
      );
    }
    clear(this.info);
    this.info.append(h('div.dev-info-head', t('dv_info_head')), ...rows.map(([k, v]) => h('div.dev-row', h('span', k), h('b', v))));
  }

  /** Action combat state: current step and animation, combo window, resource, gauge, cooldowns, stagger. */
  private actionRows(run: Run): [string, string][] {
    const a = run.action;
    const pk = a as unknown as ActionPeek;
    const rows: [string, string][] = [];
    const c = a.cur;
    let act = t('dv_i_free');
    if (c) {
      const who = c.src === 'skill' ? `${slotKey(c.slot)} ${L(c.def?.name)}` : t('dv_src_' + c.src);
      act = `${who} · ${t('dv_i_step', { n: c.idx + 1 })} · ${t('dv_ph_' + c.phase)} ${c.t.toFixed(2)}/${c.step.dur.toFixed(2)}`;
    } else if (a.mover) act = t('dv_i_moving');
    else if (a.stunT > 0) act = t('dv_i_stunned', { s: a.stunT.toFixed(1) });
    rows.push([t('dv_i_action'), act]);
    rows.push([t('dv_i_anim'), a.anim.name ? `${a.anim.name} ×${a.anim.rate.toFixed(2)}${a.anim.loop ? ' ↻' : ''}` : '—']);
    let combo = '—';
    if (pk.combo && pk.combo.t > 0 && pk.combo.slot >= 0) combo = `${slotKey(pk.combo.slot)} → ${t('dv_i_step', { n: pk.combo.idx + 1 })} · ${pk.combo.t.toFixed(2)} ${t('dv_sec_s')}`;
    else if (pk.basicT > 0) combo = `${t('dv_src_basic')} → ${t('dv_i_step', { n: pk.basicIdx + 1 })} · ${pk.basicT.toFixed(2)} ${t('dv_sec_s')}`;
    rows.push([t('dv_i_combo'), combo]);
    const orbs = a.cls.res.orbs ? ` (${t('dv_i_orbs', { n: a.orbs, max: a.cls.res.orbs })})` : '';
    rows.push([L(a.cls.res.name) || t('dv_i_res'), `${Math.floor(a.res)}/${Math.round(a.resMax)}${orbs}`]);
    const ultOpen = run.player.level >= a.cls.ult.unlock;
    rows.push([t('dv_i_ult'), ultOpen ? `${Math.floor(a.ult)}%${a.ult >= 100 ? ' · ' + t('dv_i_ready') : ''}` : t('dv_i_ult_lock', { n: a.cls.ult.unlock })]);
    rows.push([t('dv_i_identity'), a.identityT > 0 ? t('dv_i_active', { s: a.identityT.toFixed(1) }) : a.identityReady ? t('dv_i_ready') : t('dv_i_not_ready')]);
    const cds: string[] = [];
    for (let i = 0; i < 10; i++) if (a.cds[i] > 0.05) cds.push(`${slotKey(i)} ${a.cds[i].toFixed(1)}`);
    rows.push([t('dv_i_cds'), cds.length ? cds.join(' · ') : t('dv_i_all_ready')]);
    rows.push([t('dv_i_dodge'), `${a.dodgeCharges}/${a.cls.dodge.charges}${a.dodgeCharges < a.cls.dodge.charges ? ` · ${(a.cls.dodge.cd - a.dodgeT).toFixed(1)} ${t('dv_sec_s')}` : ''}`]);
    if (a.shield > 0) rows.push([t('dv_i_shield'), `${Math.round(a.shield)}/${Math.round(a.shieldMax)}`]);
    rows.push([t('dv_i_points'), String(a.points)]);
    const e = nearestFoe(run);
    if (e) {
      const name = e.boss ? L(e.boss.def.name) : L(e.def.name);
      const st = e.brokenT > 0 ? t('dv_i_broken', { s: e.brokenT.toFixed(1) }) : e.stagMax > 0 ? `${Math.floor(e.stag)}/${Math.round(e.stagMax)} (${Math.round((e.stag / e.stagMax) * 100)}%)` : '—';
      rows.push([t('dv_i_target'), `${name} · ${Math.round((e.hp / e.maxHp) * 100)}%`], [t('dv_i_stagger'), st]);
    } else rows.push([t('dv_i_target'), '—']);
    return rows;
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
      sec('class', t('dv_sec_class'), [
        run ? h('div.dev-cur', t('dv_class_cur', { name: L(run.action.cls.name), role: L(run.action.cls.role) })) : null,
        h('div.dev-pickrow', pick(CLASSES.map((c) => [c.id, `${L(c.name)} · ${L(c.role)}`]), () => sel.cls, (v) => (sel.cls = v as ClassId)), btn(t('dv_class_start'), () => dev.startClass(sel.cls), '.gold', !dev.onStartClass, dev.onStartClass ? t('dv_class_note') : t('dvm_no_start'))),
        h('div.dev-note', t('dv_class_note')),
      ]),
      sec('player', t('dv_sec_player'), [
        tog(t('dv_god'), 'god'),
        tog(t('dv_infHp'), 'infHp'),
        tog(t('dv_infXp', { n: INF_XP_MUL }), 'infXp'),
        tog(t('dv_infGold'), 'infGold'),
        tog(t('dv_infCoins'), 'infCoins'),
        run ? h('div.dev-cur', t('dv_level_cur', { n: run.player.level, max: MAX_LEVEL, pts: run.action.points })) : noRun,
        h('div.dev-grid', btn(t('dv_max_level'), () => dev.maxLevel(), '.gold', !run), btn(t('dv_heal'), () => dev.heal(), '', !run), btn('−1 ' + t('dv_lv_short'), () => run && dev.setLevel(run.player.level - 1), '', !run), btn('+1 ' + t('dv_lv_short'), () => run && dev.setLevel(run.player.level + 1), '', !run)),
        numRow(t('dv_set_level'), 'level', () => dev.setLevel(sel.level), !run, t('dv_go')),
        h('div.dev-grid', btn(t('dv_points', { n: 1 }), () => dev.addPoints(1), '', !run), btn(t('dv_points', { n: 10 }), () => dev.addPoints(10), '', !run)),
        numRow(t('dv_add_xp'), 'xp', () => dev.addXp(sel.xp), !run),
        numRow(t('dv_add_gold'), 'gold', () => dev.addGold(sel.gold), !run),
        numRow(t('dv_add_coins'), 'coins', () => dev.addCoins(sel.coins)),
        btn(t('dv_kill_player'), () => dev.killPlayer(), '.red.wide', !run),
      ]),
      sec('combat', t('dv_sec_combat'), [
        tog(t('dv_infRes'), 'infRes'),
        tog(t('dv_noCd'), 'noCd'),
        h(
          'div.dev-grid',
          btn(t('dv_cd_reset'), () => dev.resetCooldowns(), '', !run),
          btn(t('dv_res_fill'), () => dev.fillResource(), '', !run),
          btn(t('dv_identity'), () => dev.readyIdentity(), '', !run),
          btn(t('dv_ult_fill'), () => dev.fillUlt(), '.gold', !run),
        ),
        run ? h('div.dev-note', t('dv_combat_cur', { res: L(run.action.cls.res.name), id: L(run.action.cls.identity.name), ult: L(run.action.cls.ult.name), n: run.action.cls.ult.unlock })) : noRun,
        btn(t('dv_test_ult'), () => dev.testSkill(8), '.wide', !run),
      ]),
      sec('skills', t('dv_sec_skills'), run ? this.skillsSec(run.action) : [noRun]),
      sec('gear', t('dv_sec_gear'), run ? this.gearSec() : [noRun]),
      sec('tp', t('dv_sec_tp'), [
        btn(t('dv_tp'), () => dev.teleportToCursor(), '.wide', !run),
        h('div.dev-note', t('dv_tp_note')),
        run ? h('div.dev-pickrow', pick(dev.points().map((p) => [p.id, p.label]), () => sel.point, (v) => (sel.point = v)), btn(t('dv_go'), () => dev.teleportTo(sel.point))) : noRun,
      ]),
      sec('enemies', t('dv_sec_enemies'), [
        h('div.dev-numrow', h('span', t('dv_place')), h('div.dev-seg', ...(['cursor', 'hero'] as DevPlace[]).map((p) => btn(t('dv_place_' + p), () => ((sel.place = p), this.refresh()), sel.place === p ? '.on' : '')))),
        pick(ENEMIES.filter((e) => e.behavior !== 'prop').map((e) => [e.id, L(e.name)]), () => sel.enemy, (v) => (sel.enemy = v)),
        h('div.dev-grid', ...[1, 5, 20].map((n) => btn(t('dv_spawn_n', { n }), () => dev.spawnEnemy(sel.enemy, false, n, sel.place), '', !run)), btn(t('dv_spawn_elite'), () => dev.spawnEnemy(sel.enemy, sel.elite === 'random' ? true : (sel.elite as (typeof ELITE_IDS)[number]), 1, sel.place), '', !run)),
        h('div.dev-pickrow', pick([['random', t('dv_elite_random')], ...ELITE_IDS.map((id) => [id, L(ELITE_MODS[id].name)] as [string, string])], () => sel.elite, (v) => (sel.elite = v)), h('span.dev-lv', t('dv_elite_kind'))),
        pick(BOSSES.map((b) => [b.id, `${L(b.name)} · ${L(b.title)}`]), () => sel.boss, (v) => (sel.boss = v)),
        h('div.dev-grid', btn(t('dv_spawn_boss'), () => dev.spawnBoss(sel.boss, sel.place), '.gold', !run), btn(t('dv_kill_all'), () => dev.killAll(), '.red', !run)),
        h('div.dev-sub', t('dv_stagger_head')),
        h('div.dev-grid', btn(t('dv_stagger'), () => dev.breakStagger(), '.gold', !run), btn(t('dv_stagger_all'), () => dev.breakAll(), '', !run), btn(t('dv_low_target'), () => dev.lowTarget(), '', !run)),
        h('div.dev-note', t('dv_stagger_note')),
        tog(t('dv_freeze'), 'freeze'),
        mulRow(t('dv_enemy_hp'), () => dev.enemyHp, (v) => dev.setEnemyMul(v, dev.enemyDmg)),
        mulRow(t('dv_enemy_dmg'), () => dev.enemyDmg, (v) => dev.setEnemyMul(dev.enemyHp, v)),
        h('div.dev-note', t('dv_mul_note')),
        noRun,
      ]),
      sec('unlock', t('dv_sec_unlock'), [
        h('div.dev-grid', btn(t('dv_unlock_heroes'), () => dev.unlock('heroes')), btn(t('dv_unlock_maps'), () => dev.unlock('maps')), btn(t('dv_unlock_achievements'), () => dev.unlock('achievements')), btn(t('dv_unlock_all'), () => dev.unlock('all'), '.gold')),
        h('div.dev-note', t('dv_unlock_note')),
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
        h('div.dev-numrow', h('span', t('dv_speed')), h('div.dev-seg', ...[0.25, 0.5, 1, 2, 5].map((v) => btn('×' + v, () => dev.setTimeScale(v), dev.timeScale === v ? '.on' : '')))),
        numRow(t('dv_set_time'), 'time', () => dev.setTime(sel.time), !run, t('dv_go')),
      ]),
      sec('spawn', t('dv_sec_spawn'), [
        h(
          'div.dev-grid',
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

  /** The class's eight skills: level controls, a test cast and both tripod choices per skill. */
  private skillsSec(a: ActionSystem): (HTMLElement | null)[] {
    const list = h('div.dev-list');
    for (let i = 0; i < 8; i++) {
      const s = a.cls.skills[i];
      const lv = a.levels[i];
      const [t1, t2] = tripodsFor(s);
      const triPick = (tier: number, opts: typeof t1) => {
        const s2 = h('select.dev-select', { title: t('dv_tri_tier', { n: tier + 1, lv: TRIPOD_LEVELS[tier] }) }) as HTMLSelectElement;
        s2.append(h('option', { value: '-1' }, t('dv_tri_none', { n: tier + 1 })));
        opts.forEach((tp, j) => s2.append(h('option', { value: String(j) }, `${tier + 1}: ${L(tp.name)}`)));
        s2.value = String(a.tri[i][tier]);
        s2.addEventListener('change', () => dev.setTripod(i, tier, Number(s2.value)));
        return s2;
      };
      list.append(
        h(
          'div.dev-skill',
          h(
            'div.dev-item',
            h('span.dev-item-name', { title: L(s.desc), style: lv > 0 ? '' : 'opacity:.5' }, `${SLOT_KEYS[i]} · ${L(s.name)}`),
            h('span.dev-lv', lv > 0 ? `${lv}/${SKILL_MAX}` : t('dv_locked')),
            btn('−', () => dev.setSkillLevel(i, lv - 1), '.sq', false, t('dv_level_down')),
            btn('+', () => dev.setSkillLevel(i, lv + 1), '.sq', false, t('dv_level_up')),
            btn(t('dv_max_short'), () => dev.setSkillLevel(i, SKILL_MAX), '.sq', false, t('dv_level_max')),
            btn('▶', () => dev.testSkill(i), '.sq', false, t('dv_test_skill')),
          ),
          h('div.dev-tri', triPick(0, t1), triPick(1, t2)),
        ),
      );
    }
    return [
      h('div.dev-grid', btn(t('dv_skills_open'), () => dev.unlockSkills()), btn(t('dv_skills_max'), () => dev.maxSkills(), '.gold')),
      list,
      h('div.dev-note', t('dv_skills_note', { a: TRIPOD_LEVELS[0], b: TRIPOD_LEVELS[1] })),
    ];
  }

  /** Items into the bag, gear sets and stat overrides. */
  private gearSec(): (HTMLElement | null)[] {
    const slots: (GearSlot | 'any')[] = ['any', 'weapon', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'ring', 'trinket'];
    const stats: StatKey[] = ['might', 'maxHp', 'armor', 'moveSpeed', 'critChance', 'critDamage', 'cooldown', 'regen', 'area', 'lifesteal', 'duration'];
    const v = h('input.dev-num', { type: 'number', step: '0.05', value: String(sel.statV) }) as HTMLInputElement;
    v.addEventListener('change', () => (sel.statV = Number(v.value) || 0));
    const bag = dev.run?.loot.bag.length ?? 0;
    return [
      h('div.dev-tri', pick(slots.map((x) => [x, x === 'any' ? t('dv_any_slot') : t('slot_' + x)]), () => sel.slot, (x) => (sel.slot = x as GearSlot | 'any')), pick(RARITIES.map((r) => [r, t('rar_' + r)]), () => sel.rarity, (x) => (sel.rarity = x as Rarity))),
      h('div.dev-grid', btn(t('dv_give_item'), () => dev.giveItem(sel.slot, sel.rarity)), btn(t('dv_give_items', { n: 5 }), () => dev.giveItem(sel.slot, sel.rarity, 5)), btn(t('dv_drop_item'), () => dev.dropItem(sel.slot, sel.rarity)), btn(t('dv_gear_set'), () => dev.giveGearSet(sel.rarity), '.gold')),
      h('div.dev-pickrow', h('span.dev-note', t('dv_bag', { n: bag })), btn(t('dv_bag_clear'), () => dev.clearBag(), '.red')),
      h('div.dev-sub', t('dv_set_stats')),
      h('div.dev-pickrow3', pick(stats.map((x) => [x, t('stat_' + x)]), () => sel.stat, (x) => (sel.stat = x as StatKey)), v, btn('+', () => dev.addStat(sel.stat, sel.statV))),
      btn(t('dv_stats_clear'), () => dev.clearStats(), '.wide'),
      h('div.dev-note', t('dv_stats_note')),
    ];
  }
}

/** The living boss, or else the enemy nearest the hero. */
function nearestFoe(run: Run): Enemy | null {
  const b = run.bosses.find((x) => x.e.alive);
  if (b) return b.e;
  return run.enemies.nearest(run.player.x, run.player.z, 30);
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

function numRow(label: string, key: 'xp' | 'gold' | 'coins' | 'wave' | 'time' | 'level', fn: () => void, disabled = false, go = '+'): HTMLElement {
  const inp = h('input.dev-num', { type: 'number', value: String(sel[key]), min: '0' }) as HTMLInputElement;
  inp.addEventListener('change', () => (sel[key] = Math.max(0, Number(inp.value) || 0)));
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
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
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  return h('div.dev-numrow', h('span', `${label} ×${get()}`), h('div.dev-seg', ...steps.map((v) => btn('×' + v, () => set(v), get() === v ? '.on' : ''))));
}
