import type { Run } from '../game/Run';
import type { Enemy } from '../game/Enemy';
import type { BossController } from '../game/bosses/Boss';
import { MOD_BY_ID, SKILL_MAX } from '../game/arpg/kits';
import { PASSIVE_BY_ID } from '../data/passives';
import { keyName } from '../input/Input';
import type { Keybinds } from '../meta/Save';
import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { fmtNum } from './format';

interface Slot {
  root: HTMLElement;
  icon: HTMLElement;
  cd: HTMLElement;
  timer: HTMLElement;
  key: HTMLElement;
  pips: HTMLElement;
  cost: HTMLElement;
}


/** Effects shown on an enemy (hover panel, boss bar). */
export function enemyEffects(e: Enemy): { key: string; color: string; t: number }[] {
  const out: { key: string; color: string; t: number }[] = [];
  if (e.burnT > 0) out.push({ key: 'st_burn', color: '#ff8a3a', t: e.burnT });
  if (e.poisonT > 0) out.push({ key: 'st_poison', color: '#9cff4f', t: e.poisonT });
  if (e.bleedT > 0) out.push({ key: 'st_bleed', color: '#ff5060', t: e.bleedT });
  if (e.freezeT > 0) out.push({ key: 'st_freeze', color: '#8ae8ff', t: e.freezeT });
  if (e.stunT > 0) out.push({ key: 'st_stun', color: '#ffe08a', t: e.stunT });
  if (e.slowT > 0) out.push({ key: 'st_slow', color: '#7ab0ff', t: e.slowT });
  if (e.curseT > 0) out.push({ key: 'st_curse', color: '#b070ff', t: e.curseT });
  if (e.weakenT > 0) out.push({ key: 'st_weaken', color: '#c0c0c0', t: e.weakenT });
  if (e.markT > 0) out.push({ key: 'st_mark', color: '#ffd23d', t: e.markT });
  if (e.shieldT > 0 || e.invuln) out.push({ key: 'st_shield', color: '#a0a0ff', t: e.shieldT });
  return out;
}

/**
 * Action-RPG HUD: health, class resource and experience at the bottom with the Q/W/E/R/Space
 * slots (icon, key, cooldown sweep, timer, availability and level), the build row, and the
 * info panel for the enemy under the cursor.
 */
export class ArpgHud {
  readonly root: HTMLElement;
  readonly hoverBox: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private resFill: HTMLElement;
  private resText: HTMLElement;
  private resName: HTMLElement;
  private xpFill: HTMLElement;
  private xpText: HTMLElement;
  private gold: HTMLElement;
  private slots: Slot[] = [];
  private build: HTMLElement;
  private hName: HTMLElement;
  private hMeta: HTMLElement;
  private hFill: HTMLElement;
  private hHp: HTMLElement;
  private hFx: HTMLElement;
  private last: Record<string, string | number> = {};
  private hover: Enemy | null = null;
  private runRef: Run | null = null;
  binds: Keybinds | null = null;
  onInventory: () => void = () => {};
  private bagKey = h('span.key');

  constructor() {
    this.hpFill = h('div.ah-fill');
    this.hpText = h('div.ah-text');
    this.resFill = h('div.ah-fill');
    this.resText = h('div.ah-text');
    this.resName = h('div.ah-label');
    this.xpFill = h('div.ah-xp-fill');
    this.xpText = h('div.ah-xp-text');
    this.gold = h('span');
    for (let i = 0; i < 5; i++) {
      const s: Slot = {
        root: h('div.sk'),
        icon: h('div.sk-icon'),
        cd: h('div.sk-cd'),
        timer: h('div.sk-timer'),
        key: h('div.sk-key'),
        pips: h('div.sk-pips'),
        cost: h('div.sk-cost'),
      };
      s.root.append(s.icon, s.cd, s.timer, s.key, s.cost, s.pips);
      this.slots.push(s);
    }
    this.build = h('div.ah-build');
    const bars = h(
      'div.ah-bars',
      h('div.ah-bar.hp', h('div.ah-label', t('hud_hp')), h('div.ah-track', this.hpFill), this.hpText),
      h('div.ah-bar.res', this.resName, h('div.ah-track', this.resFill), this.resText),
    );
    this.root = h(
      'div.arpg-hud',
      this.build,
      h('div.ah-main', bars, h('div.ah-slots', ...this.slots.slice(0, 4).map((s) => s.root), h('div.sk-gap'), this.slots[4].root), h('div.ah-side', h('div.ah-gold', h('i.ic-coin'), this.gold), h('button.ah-bag', { title: t('inv_title'), onclick: () => this.onInventory() }, iconImg('chest', 0xffc060, 'icon'), this.bagKey))),
      h('div.ah-xp', h('div.ah-xp-track', this.xpFill), this.xpText),
    );
    this.hName = h('div.hv-name');
    this.hMeta = h('div.hv-meta');
    this.hFill = h('div.hv-fill');
    this.hHp = h('div.hv-hp');
    this.hFx = h('div.hv-fx');
    this.hoverBox = h('div.hover-info.hidden', this.hName, this.hMeta, h('div.hv-track', this.hFill, this.hHp), this.hFx);
  }

  reset(run: Run | null) {
    this.last = {};
    this.hover = null;
    this.runRef = run;
    this.hoverBox.classList.add('hidden');
    if (!run) return;
    const sk = run.skills;
    const kit = sk.kit;
    this.resName.textContent = L(kit.res.name);
    this.root.style.setProperty('--res', kit.res.color);
    for (let i = 0; i < 5; i++) {
      const s = this.slots[i];
      clear(s.icon);
      if (i < 4) {
        const def = sk.skill(i);
        s.icon.append(iconImg(def.icon, def.color, 'icon'));
        s.root.title = `${L(def.name)}\n${L(def.desc)}`;
      } else {
        s.icon.append(iconImg('boots', 0xd8f0ff, 'icon'));
        s.root.title = t('arpg_dodge_desc');
      }
      s.root.classList.toggle('ult', i === 3);
      s.root.classList.toggle('dodge', i === 4);
    }
  }

  setHover(e: Enemy | null) {
    this.hover = e;
  }

  private keyFor(i: number): string {
    const b = this.binds;
    const a = (['skillQ', 'skillW', 'skillE', 'skillR', 'dodge'] as const)[i];
    return keyName(b?.[a]?.[0] ?? '');
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  update(run: Run) {
    if (run !== this.runRef) this.reset(run);
    const p = run.player;
    const sk = run.skills;
    const hpk = Math.max(0, p.hp / p.stats.maxHp);
    this.set('hp', Math.round(hpk * 400), () => (this.hpFill.style.transform = `scaleX(${hpk})`));
    this.set('hpt', `${Math.ceil(Math.max(0, p.hp))}/${Math.round(p.stats.maxHp)}`, () => (this.hpText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.stats.maxHp)}`));
    const rk = sk.res / sk.resMax;
    this.set('res', Math.round(rk * 400), () => (this.resFill.style.transform = `scaleX(${rk})`));
    this.set('rest', Math.floor(sk.res), () => (this.resText.textContent = `${Math.floor(sk.res)} / ${sk.resMax}`));
    const capped = p.level >= sk.maxLevel;
    const xpk = p.xpNext > 0 ? Math.min(1, p.xp / p.xpNext) : 0;
    this.set('xp', Math.round(xpk * 500), () => (this.xpFill.style.transform = `scaleX(${xpk})`));
    this.set('xpt', `${p.level}|${capped}|${Math.floor(p.xp)}`, () => {
      this.xpText.textContent = capped ? t('arpg_lv_max', { n: p.level }) : t('arpg_lv', { n: p.level, max: sk.maxLevel }) + ` · ${Math.floor(p.xp)} / ${p.xpNext}`;
    });
    this.set('bagk', this.binds?.inventory?.[0] ?? '', () => (this.bagKey.textContent = keyName(this.binds?.inventory?.[0] ?? '')));
    this.set('bagn', run.loot.bag.length, () => this.root.style.setProperty('--bagn', `'${run.loot.bag.length}'`));
    this.set('gold', Math.round(run.stats.gold), () => (this.gold.textContent = fmtNum(run.stats.gold)));
    // skill slots
    for (let i = 0; i < 5; i++) {
      const s = this.slots[i];
      let cd = 0;
      let max = 1;
      let lv = 0;
      let can = true;
      let learned = true;
      let cost = 0;
      if (i < 4) {
        cd = sk.cds[i];
        max = sk.cdMax[i] || 1;
        lv = sk.level(i);
        learned = lv > 0;
        can = sk.affordable(i);
        cost = Math.round(sk.costOf(i));
      } else {
        cd = Math.max(0, sk.dodgeCd);
        max = sk.dodgeMax || 1;
        lv = sk.dodgeLevel + 1;
      }
      const k = cd > 0 ? Math.min(1, cd / max) : 0;
      this.set('cd' + i, Math.round(k * 120), () => (s.cd.style.background = k > 0 ? `conic-gradient(rgba(10,12,16,0.78) ${k * 360}deg, transparent 0)` : 'none'));
      this.set('tm' + i, cd > 0 ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : '', () => (s.timer.textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : ''));
      const state = !learned ? 'locked' : cd > 0 ? 'cd' : !can ? 'nores' : 'ready';
      this.set('st' + i, state, () => {
        s.root.classList.toggle('locked', state === 'locked');
        s.root.classList.toggle('nores', state === 'nores');
        s.root.classList.toggle('ready', state === 'ready');
      });
      this.set('fl' + i, (sk.flash[i] > 0 ? 1 : 0) + (sk.denied[i] > 0 ? 2 : 0), () => {
        s.root.classList.toggle('flash', sk.flash[i] > 0);
        s.root.classList.toggle('denied', sk.denied[i] > 0);
      });
      this.set('key' + i, this.keyFor(i), () => (s.key.textContent = this.keyFor(i)));
      const costTxt = i < 4 && learned && cost !== 0 ? (sk.kit.res.id === 'heat' ? (cost > 0 ? '+' : '') + cost : String(cost)) : '';
      this.set('cost' + i, costTxt, () => (s.cost.textContent = costTxt));
      const maxLv = i === 3 ? 4 : i === 4 ? 5 : SKILL_MAX;
      this.set('lv' + i, lv, () => {
        clear(s.pips);
        if (i === 3 && lv === 0) {
          s.pips.append(h('span.sk-lock', p.level >= 6 ? t('arpg_ult_ready') : t('arpg_ult_at', { n: 6 })));
          return;
        }
        for (let j = 0; j < maxLv; j++) s.pips.append(h('i' + (j < lv ? '.on' : '')));
      });
    }
    // build row: modifiers and passives
    const bk = [...sk.mods].join() + '|' + [...run.passives.levels].map(([id, l]) => id + l).join();
    this.set('build', bk, () => {
      clear(this.build);
      for (const id of sk.mods) {
        const m = MOD_BY_ID[id];
        if (m) this.build.append(h('div.ah-chip', { title: `${L(m.name)}\n${L(m.desc)}` }, iconImg(m.icon, m.color, 'icon sm')));
      }
      for (const [id, l] of run.passives.levels) {
        const d = PASSIVE_BY_ID[id];
        if (d) this.build.append(h('div.ah-chip.pas', { title: L(d.name) }, iconImg(d.icon, d.color, 'icon sm'), h('b', String(l))));
      }
    });
    this.updateHover(run);
  }

  private updateHover(run: Run) {
    const e = this.hover;
    const show = !!e && e.alive && !e.boss;
    this.set('hv', show ? e!.uid : 0, () => this.hoverBox.classList.toggle('hidden', !show));
    if (!show || !e) return;
    const name = L(e.def.name) + (e.elite ? ' ★' : '');
    this.set('hvn', name, () => {
      this.hName.textContent = name;
      this.hName.style.color = e.elite ? '#ffd23d' : '#f1f2f4';
    });
    const lvl = Math.max(1, run.waves.wave.n + (e.elite ? 2 : 0));
    const role = (e.elite ? t('role_elite') + ' · ' : '') + t('role_' + e.role);
    this.set('hvm', role + lvl, () => (this.hMeta.textContent = `${t('arpg_lv_short', { n: lvl })} · ${role}`));
    const k = Math.max(0, e.hp / e.maxHp);
    this.set('hvk', Math.round(k * 300), () => (this.hFill.style.transform = `scaleX(${k})`));
    this.set('hvh', Math.ceil(e.hp), () => (this.hHp.textContent = `${fmtNum(Math.ceil(Math.max(0, e.hp)))} / ${fmtNum(Math.round(e.maxHp))}`));
    const fx = enemyEffects(e);
    this.set('hvf', fx.map((f) => f.key).join(), () => {
      clear(this.hFx);
      for (const f of fx) this.hFx.append(h('span.fx-chip', { style: `--fc:${f.color}` }, t(f.key)));
    });
  }

  /** Boss bar extras: phase label and effects. */
  bossExtras(boss: BossController, phaseEl: HTMLElement, fxEl: HTMLElement) {
    const n = boss.def.phases.length;
    this.set('bph', boss.phase, () => {
      clear(phaseEl);
      phaseEl.append(h('span.boss-phase-t', t('arpg_phase', { n: boss.phase + 1, total: n })));
      for (let i = 0; i < n; i++) phaseEl.append(h('i' + (i <= boss.phase ? '.on' : '')));
    });
    const fx = enemyEffects(boss.e);
    this.set('bfx', fx.map((f) => f.key).join(), () => {
      clear(fxEl);
      for (const f of fx) fxEl.append(h('span.fx-chip', { style: `--fc:${f.color}` }, t(f.key)));
    });
  }

  colorOf(c: number) {
    return hex(c);
  }
}
