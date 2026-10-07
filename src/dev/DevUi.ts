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
};
const openSecs = new Set<string>(['player', 'time']);

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
    put(this.panel, h('div.dev-head', h('b', 'DEVELOPER TOOLS'), h('span.dev-test', 'TEST MODE'), h('button.dev-x', { onclick: () => this.setPanel(false) }, '✕')), this.body, this.msg);
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
      this.badge.append(h('span.dev-badge-main', 'DEVELOPER MODE · TEST'));
      if (dev.toggles.god) this.badge.append(h('span.dev-badge-god', 'GOD MODE ON'));
      if (dev.paused) this.badge.append(h('span.dev-badge-god', 'PAUSED'));
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
    const rows: [string, string][] = [['FPS', this.fps.toFixed(0)]];
    if (run) {
      const p = run.player;
      const w = run.waves.wave;
      const tm = run.time;
      let proj = 0;
      for (const x of run.projectiles.list) if (x.active) proj++;
      let picks = 0;
      for (const x of run.pickups.list) if (x.active) picks++;
      rows.push(
        ['Enemies', String(run.enemies.aliveCount)],
        ['Projectiles', String(proj)],
        ['Pickups', String(picks)],
        ['Wave', `${w.n} (${w.type})`],
        ['Game time', `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`],
        ['Player DPS', dev.dps.value.toFixed(0)],
        ['Damage taken', `${Math.round(run.stats.damageTaken)} (${dev.dtps.value.toFixed(1)}/s)`],
        ['Spawn rate', dev.spawnRate.value.toFixed(1) + '/s'],
        ['XP', `Lv ${p.level} · ${Math.floor(p.xp)}/${Math.floor(p.xpNext)}`],
        ['HP', `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}`],
        ['Gold', String(Math.floor(run.stats.gold))],
      );
    }
    rows.push(['Coins', String(dev.profile?.data.gold ?? 0)]);
    clear(this.info);
    this.info.append(h('div.dev-info-head', 'DEBUG INFO'), ...rows.map(([k, v]) => h('div.dev-row', h('span', k), h('b', v))));
  }

  // ---------------------------------------------------------------- panel
  private build() {
    this.scroll = this.body.scrollTop;
    clear(this.body);
    const run = dev.run;
    const k = this.keys();
    const noRun = run ? null : h('div.dev-note', 'Эти инструменты работают во время забега / Available during a run');
    this.body.append(
      h('div.dev-keys', `${keyName(k.panel)} — панель · ${keyName(k.debug)} — debug info · ${keyName(k.god)} — god mode`),
      h('div.dev-row2', btn('MAX PLAYER', () => dev.maxPlayer(), '.gold', !run), btn('RESET TEST STATE', () => dev.resetTestState(), '.red')),
      sec('player', 'Player', [
        tog('God Mode', 'god'),
        tog('Infinite HP', 'infHp'),
        tog(`Infinite XP (×${INF_XP_MUL})`, 'infXp'),
        tog('Infinite Gold', 'infGold'),
        tog('Infinite Coins', 'infCoins'),
        h('div.dev-grid', btn('Max Level', () => dev.maxLevel(), '', !run), btn('Heal', () => dev.heal(), '', !run), btn('Kill Player', () => dev.killPlayer(), '.red', !run)),
        numRow('Add XP', 'xp', () => dev.addXp(sel.xp), !run),
        numRow('Add Gold', 'gold', () => dev.addGold(sel.gold), !run),
        numRow('Add Coins', 'coins', () => dev.addCoins(sel.coins)),
        noRun,
      ]),
      sec('unlock', 'Unlock', [
        h(
          'div.dev-grid',
          btn('Characters', () => dev.unlock('heroes')),
          btn('Weapons', () => dev.unlock('weapons')),
          btn('Maps', () => dev.unlock('maps')),
          btn('Upgrades', () => dev.unlock('upgrades')),
          btn('Achievements', () => dev.unlock('achievements')),
          btn('Evolutions', () => dev.unlock('evolutions')),
        ),
        btn('UNLOCK EVERYTHING', () => dev.unlock('all'), '.gold.wide'),
        h('div.dev-note', 'Только в тестовом состоянии, обычное сохранение не меняется'),
      ]),
      sec('weapons', 'Weapons', run ? this.weaponsSec() : [noRun]),
      sec('enemies', 'Enemies', [
        pick(ENEMIES.filter((e) => e.behavior !== 'prop').map((e) => [e.id, L(e.name)]), () => sel.enemy, (v) => (sel.enemy = v)),
        h('div.dev-grid', ...[1, 10, 50].map((n) => btn(`Spawn ×${n}`, () => dev.spawnEnemy(sel.enemy, false, n), '', !run)), btn('Spawn Elite', () => dev.spawnEnemy(sel.enemy, true), '', !run)),
        pick(BOSSES.map((b) => [b.id, L(b.name)]), () => sel.boss, (v) => (sel.boss = v)),
        h('div.dev-grid', btn('Spawn Boss', () => dev.spawnBoss(sel.boss), '', !run), btn('Kill All', () => dev.killAll(), '.red', !run)),
        tog('Freeze Enemies', 'freeze'),
        mulRow('Enemy HP', () => dev.enemyHp, (v) => dev.setEnemyMul(v, dev.enemyDmg)),
        mulRow('Enemy Damage', () => dev.enemyDmg, (v) => dev.setEnemyMul(dev.enemyHp, v)),
        h('div.dev-note', 'Множители действуют на новых врагов'),
        noRun,
      ]),
      sec('waves', 'Waves', [
        run ? h('div.dev-cur', `Wave ${run.waves.wave.n} / ${run.waves.total === Infinity ? '∞' : run.waves.total} · ${t('wave_' + run.waves.wave.type)}`) : noRun,
        h('div.dev-grid', btn('◀ Prev', () => dev.prevWave(), '', !run), btn('Next ▶', () => dev.nextWave(), '', !run), btn('Skip Wave', () => dev.nextWave(), '', !run), btn('Restart Wave', () => dev.restartWave(), '', !run)),
        numRow('Set Wave', 'wave', () => dev.setWave(sel.wave), !run, 'Go'),
        h('div.dev-grid', btn('Spawn Boss', () => dev.spawnWaveBoss(), '', !run), btn('Elite Wave', () => dev.eliteWave(), '', !run)),
      ]),
      sec('time', 'Time', [
        h('div.dev-grid', btn(dev.paused ? 'Resume' : 'Pause', () => dev.setPaused(!dev.paused), dev.paused ? '.on' : '', !run)),
        h('div.dev-seg', ...[0.5, 1, 2, 5].map((v) => btn('×' + v, () => dev.setTimeScale(v), dev.timeScale === v ? '.on' : ''))),
        numRow('Set Time (sec)', 'time', () => dev.setTime(sel.time), !run, 'Go'),
      ]),
      sec('spawn', 'Spawn', [
        h(
          'div.dev-grid',
          btn('Enemy', () => dev.spawnEnemy(sel.enemy), '', !run),
          btn('Elite', () => dev.spawnEnemy(sel.enemy, true), '', !run),
          btn('Boss', () => dev.spawnBoss(sel.boss), '', !run),
          btn('Chest', () => dev.spawnPickup('chest'), '', !run),
          btn('XP', () => dev.spawnPickup('xp', 200), '', !run),
          btn('Gold', () => dev.spawnPickup('pouch', 25), '', !run),
          btn('Coins', () => dev.spawnPickup('coins'), '', !run),
        ),
        pick((['fury', 'haste', 'aegis', 'frenzy', 'chrono', 'nuke', 'heart', 'magnet', 'star'] as PickupKind[]).map((p) => [p, p]), () => sel.power, (v) => (sel.power = v as PickupKind)),
        btn('Spawn Power-Up', () => dev.spawnPickup(sel.power), '.wide', !run),
      ]),
      sec('clear', 'Clear', [
        h('div.dev-grid', btn('Kill All Enemies', () => dev.killAll(), '.red', !run), btn('Projectiles', () => dev.clearProjectiles(), '', !run), btn('Pickups', () => dev.clearPickups(), '', !run), btn('Effects', () => dev.clearEffects(), '', !run)),
      ]),
      sec('debug', 'Debug', [btn(dev.debugOpen ? 'Hide Debug Info' : 'Show Debug Info', () => this.setDebug(!dev.debugOpen), dev.debugOpen ? '.on.wide' : '.wide')]),
    );
    this.body.scrollTop = this.scroll;
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
          btn('−', () => dev.setWeaponLevel(w.def.id, w.level - 1), '.sq'),
          btn('+', () => dev.setWeaponLevel(w.def.id, w.level + 1), '.sq'),
          btn('MAX', () => dev.setWeaponLevel(w.def.id, w.maxLevel), '.sq'),
          btn('✕', () => dev.removeWeapon(w.def.id), '.sq.red'),
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
          btn('−', () => dev.setPassiveLevel(id, lvl - 1), '.sq'),
          btn('+', () => dev.setPassiveLevel(id, lvl + 1), '.sq'),
          btn('MAX', () => dev.setPassiveLevel(id, def.maxLevel), '.sq'),
          btn('✕', () => dev.setPassiveLevel(id, 0), '.sq.red'),
        ),
      );
    }
    return [
      h('div.dev-sub', `Weapons ${run.weapons.list.length}/${BALANCE.weaponSlots}`),
      list,
      h('div.dev-pickrow', pick(WEAPONS.filter((w) => !w.evolved).map((w) => [w.id, L(w.name)]), () => sel.weapon, (v) => (sel.weapon = v)), btn('Add', () => dev.addWeapon(sel.weapon))),
      h('div.dev-pickrow', pick(WEAPONS.filter((w) => w.evolved).map((w) => [w.id, L(w.name)]), () => sel.evo, (v) => (sel.evo = v)), btn('Evolve', () => dev.addEvolution(sel.evo))),
      h('div.dev-sub', `Passives ${run.passives.count}/${BALANCE.passiveSlots}`),
      plist,
      h('div.dev-pickrow', pick(PASSIVES.map((x) => [x.id, L(x.name)]), () => sel.passive, (v) => (sel.passive = v)), btn('Add', () => dev.addPassive(sel.passive))),
      h('div.dev-note', WEAPON_BY_ID[sel.evo]?.evolved ? 'Evolve: эволюционирует базовое оружие или добавляет эволюцию в свободный слот' : ''),
    ];
  }
}

// ---------------------------------------------------------------- tiny builders
function put(el: HTMLElement, ...kids: (HTMLElement | null)[]) {
  for (const k of kids) if (k) el.append(k);
}

function btn(label: string, fn: () => void, cls = '', disabled = false): HTMLElement {
  const b = h('button.dev-btn' + cls, { onclick: () => !disabled && fn() }, label);
  if (disabled) b.classList.add('off');
  return b;
}

function tog(label: string, key: DevToggle): HTMLElement {
  const on = dev.toggles[key];
  return h('button.dev-tog' + (on ? '.on' : ''), { onclick: () => dev.toggle(key) }, h('span', label), h('b', on ? 'ON' : 'OFF'));
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
