import type { Run } from '../game/Run';
import type { Enemy } from '../game/Enemy';
import { SLOT_SPECIAL, SLOT_ULT } from '../game/action/ActionSystem';
import { keyName } from '../input/Input';
import type { Keybinds } from '../meta/Save';
import { h, clear, hex } from './dom';
import { t, L } from '../i18n';
import { fmtNum } from './format';
import { SLOT_BASIC, SLOT_DODGE, SLOT_IDENTITY, costBadge, skillImg, slotDetails, slotKey, slotMeta } from './SkillsScreen';
import { tr } from './ClassPreview';

interface Slot {
  i: number;
  root: HTMLElement;
  icon: HTMLElement;
  cd: HTMLElement;
  timer: HTMLElement;
  key: HTMLElement;
  cost: HTMLElement;
  sub: HTMLElement;
}

/** Bottom bar scale from the window size (the layout is drawn for a 1350×900 reference box). */
function barScale(): number {
  const w = window.innerWidth || 1280;
  const hh = window.innerHeight || 720;
  return Math.max(0.6, Math.min(1.5, Math.min(w / 1350, hh / 900)));
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

const cdText = (cd: number) => (cd > 0 ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : '');
/** Cooldown overlay: a dark clockwise sweep over the remaining part `k` of the cooldown. */
const sweep = (k: number, c = 'rgba(6,8,12,0.74)') => {
  if (k <= 0) return 'none';
  const d = (k * 360).toFixed(1);
  return `conic-gradient(${c} 0 ${d}deg, rgba(255,240,220,0.5) ${d}deg calc(${d}deg + 1.5deg), transparent 0)`;
};

/**
 * Bottom action bar (reference layout): Identity (Z) far left, skills Q W E R over a red HP bar,
 * a centre cluster of diamonds (basic attack, dodge, and the level below them), skills A S D F
 * over the class-resource (MP) bar, the Ultimate (V) far right; a thin full-width XP bar under
 * everything. Also the charge / cast bar, active buffs, unspent skill points, slot tooltips and the
 * info panel for the enemy under the cursor (with its stagger bar).
 */
export class ArpgHud {
  readonly root: HTMLElement;
  readonly hoverBox: HTMLElement;
  private wrap: HTMLElement;
  private hpBar: HTMLElement;
  private hpFill = h('div.bh-fill');
  private hpShield = h('div.bh-shield');
  private hpNum = h('span.bh-num');
  private resBar: HTMLElement;
  private resFill = h('div.bh-fill');
  private resSegs = h('div.bh-segs');
  private resNum = h('span.bh-num');
  private lvNum = h('div.bh-lv-n');
  private xpFill = h('div.bh-xp-fill');
  private xpText = h('div.bh-xp-text');
  private xpShown = -1;
  private xpLevel = -1;
  private lastT = 0;
  private slots: Slot[] = [];
  private castBox = h('div.ah-cast.hidden');
  private castName = h('div.ah-cast-name');
  private castFill = h('div.ah-cast-fill');
  private buffRow = h('div.ah-buffs');
  private hName = h('div.hv-name');
  private hMeta = h('div.hv-meta');
  private hFill = h('div.hv-fill');
  private hHp = h('div.hv-hp');
  private hStag = h('div.hv-stag-fill');
  private hStagBox: HTMLElement;
  private hFx = h('div.hv-fx');
  private last: Record<string, string | number> = {};
  private hover: Enemy | null = null;
  private runRef: Run | null = null;
  binds: Keybinds | null = null;
  onLearn: (slot: number) => void = () => {};
  /** Opens the skills screen (the skill-points badge). */
  onSkills: () => void = () => {};
  private pointsBox = h('div.ah-points.hidden');
  private tip = h('div.sk-tip.hidden');
  private tipSlot = -1;
  private tipT = 0;
  private lastRun: Run | null = null;
  private specialWrap: HTMLElement;
  private scale = 1;

  constructor() {
    const mk = (i: number, extra = ''): Slot => {
      const s: Slot = { i, root: h('div.bs' + extra), icon: h('div.bs-icon'), cd: h('div.bs-cd'), timer: h('div.bs-timer'), key: h('div.bs-key'), cost: h('div.bs-cost'), sub: h('div.bs-sub') };
      s.root.append(s.icon, s.cd, s.timer, s.key, s.cost, s.sub);
      if (i < 8) {
        const plus = h('div.bs-plus', '+');
        plus.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.onLearn(i);
          setTimeout(() => this.renderTip(), 0);
        });
        s.root.append(plus);
        s.root.addEventListener('mousedown', (e) => {
          if (!s.root.classList.contains('learn')) return;
          e.stopPropagation();
          e.preventDefault();
          this.onLearn(i);
          setTimeout(() => this.renderTip(), 0);
        });
      }
      s.root.addEventListener('mouseenter', () => {
        this.tipSlot = i;
        this.renderTip();
      });
      s.root.addEventListener('mouseleave', () => {
        if (this.tipSlot === i) this.tipSlot = -1;
        this.tip.classList.add('hidden');
      });
      this.slots[i] = s;
      return s;
    };
    const left = h('div.bh-slots');
    const right = h('div.bh-slots');
    for (let i = 0; i < 8; i++) (i < 4 ? left : right).append(mk(i).root);
    const ident = mk(SLOT_IDENTITY, '.side.ident');
    const ult = mk(SLOT_ULT, '.side.ult');
    ult.root.prepend(h('div.bs-gauge'));
    const special = mk(SLOT_SPECIAL, '.mini');
    const basic = mk(SLOT_BASIC, '.dia.basic');
    const dodge = mk(SLOT_DODGE, '.dia.dodge');
    basic.icon.append(h('span.bs-dia-t', tr('Атк', 'Atk')));
    dodge.icon.append(h('span.bs-dia-t', tr('Рывок', 'Dash')));
    this.specialWrap = special.root;
    this.hpBar = h('div.bh-bar.hp', h('div.bh-track', this.hpShield, this.hpFill, h('div.bh-gloss')), h('div.bh-label', h('span.bh-name', 'HP'), this.hpNum));
    this.resBar = h('div.bh-bar.mp', h('div.bh-track', this.resFill, this.resSegs, h('div.bh-gloss')), h('div.bh-label', h('span.bh-name', 'MP'), this.resNum));
    this.castBox.append(this.castName, h('div.ah-cast-track', this.castFill));
    this.pointsBox.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.onSkills();
    });
    this.wrap = h(
      'div.bh-wrap',
      h('div.bh-above', this.castBox, h('div.ah-toprow', this.buffRow, this.pointsBox)),
      this.tip,
      h('div.bh-plate'),
      h(
        'div.bh-row',
        h('div.bh-side', ident.root),
        h('div.bh-group.l', left, this.hpBar),
        h('div.bh-center', basic.root, dodge.root, h('div.bh-lv', h('div.bh-lv-in', h('div.bh-lv-t', 'LVL'), this.lvNum))),
        h('div.bh-group.r', right, this.resBar),
        h('div.bh-side', ult.root, special.root),
      ),
    );
    this.root = h('div.arpg-hud', this.wrap, h('div.bh-xp', h('div.bh-xp-track', this.xpFill), this.xpText));
    this.hStagBox = h('div.hv-stag', this.hStag);
    this.hoverBox = h('div.hover-info.hidden', this.hName, this.hMeta, h('div.hv-track', this.hFill, this.hHp), this.hStagBox, this.hFx);
    const fit = () => {
      this.scale = barScale();
      this.root.style.setProperty('--hs', this.scale.toFixed(4));
    };
    fit();
    window.addEventListener('resize', fit);
  }

  reset(run: Run | null) {
    this.last = {};
    this.hover = null;
    this.runRef = run;
    this.xpShown = -1;
    this.xpLevel = -1;
    this.hoverBox.classList.add('hidden');
    this.tip.classList.add('hidden');
    this.tipSlot = -1;
    if (!run) return;
    const a = run.action;
    const c = a.cls;
    this.resBar.title = L(c.res.name);
    this.root.style.setProperty('--res', c.res.color);
    this.root.style.setProperty('--cls', hex(c.color));
    clear(this.resSegs);
    for (let i = 1; i < (c.res.orbs ?? 0); i++) this.resSegs.append(h('i', { style: `left:${((i / c.res.orbs!) * 100).toFixed(2)}%` }));
    this.specialWrap.classList.toggle('hidden', !c.special);
    for (const s of this.slots) {
      if (!s) continue;
      if (s.i === SLOT_BASIC || s.i === SLOT_DODGE) continue;
      clear(s.icon);
      const m = slotMeta(a, s.i);
      if (m) s.icon.append(skillImg(m.icon, m.color, 'icon'));
      // press-and-hold skills (hold channels and charge-ups) carry a badge
      const def = a.skill(s.i);
      const hold = !!def && (def.type === 'hold' || def.type === 'charge');
      s.root.classList.toggle('hold', hold);
      s.root.querySelector('.bs-hold')?.remove();
      if (hold) s.root.append(h('div.bs-hold', { title: L({ ru: 'Зажмите клавишу', en: 'Hold the key' }) }, def!.type === 'charge' ? L({ ru: 'ЗАР', en: 'CHG' }) : L({ ru: 'ЗАЖ', en: 'HOLD' })));
    }
  }

  setHover(e: Enemy | null) {
    this.hover = e;
  }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  private state(s: Slot, st: string) {
    this.set('st' + s.i, st, () => {
      for (const c of ['locked', 'nores', 'ready', 'cd', 'active']) s.root.classList.toggle(c, st === c);
    });
  }

  private cool(s: Slot, cd: number, max: number) {
    const k = cd > 0 ? Math.min(1, cd / Math.max(0.01, max)) : 0;
    this.set('cd' + s.i, Math.round(k * 240), () => (s.cd.style.background = sweep(k)));
    const tx = cdText(cd);
    this.set('tm' + s.i, tx, () => (s.timer.textContent = tx));
  }

  private fb(s: Slot, a: Run['action']) {
    const f = a.flash[s.i] > 0 ? 1 : 0;
    const d = a.denied[s.i] > 0 ? 2 : 0;
    this.set('fl' + s.i, f + d, () => {
      s.root.classList.toggle('flash', !!f);
      s.root.classList.toggle('denied', !!d);
    });
  }

  update(run: Run) {
    this.lastRun = run;
    if (run !== this.runRef) this.reset(run);
    const now = performance.now();
    const dt = this.lastT ? Math.min(0.25, (now - this.lastT) / 1000) : 0;
    this.lastT = now;
    const p = run.player;
    const a = run.action;
    const c = a.cls;
    // health + shield
    const maxHp = Math.max(1, p.stats.maxHp);
    const hpk = Math.max(0, Math.min(1, p.hp / maxHp));
    this.set('hp', Math.round(hpk * 600), () => {
      this.hpFill.style.transform = `scaleX(${hpk})`;
      this.hpBar.classList.toggle('low', hpk < 0.3);
    });
    const shk = Math.min(1, a.shield / maxHp);
    const shTop = Math.min(1, hpk + shk);
    this.set('sh', Math.round(shTop * 600) + (shk > 0 ? 1000 : 0), () => {
      this.hpShield.style.transform = `scaleX(${shk > 0 ? shTop : 0})`;
      this.hpBar.classList.toggle('shielded', shk > 0);
    });
    const hpTxt = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(maxHp)}` + (a.shield > 0 ? ` (+${Math.ceil(a.shield)})` : '');
    this.set('hpt', hpTxt, () => (this.hpNum.textContent = hpTxt));
    // class resource (MP bar) and the identity state
    const resMax = Math.max(1, a.resMax);
    const rk = Math.min(1, a.res / resMax);
    this.set('res', Math.round(rk * 600), () => (this.resFill.style.transform = `scaleX(${rk})`));
    const resTxt = c.res.orbs ? `${a.orbs} / ${c.res.orbs}` : `${Math.floor(a.res)} / ${Math.round(resMax)}`;
    this.set('rest', resTxt, () => (this.resNum.textContent = resTxt));
    const idReady = a.identityReady;
    this.set('idr', (idReady ? 1 : 0) + (a.identityT > 0 ? 2 : 0), () => {
      this.resBar.classList.toggle('ready', idReady);
      this.resBar.classList.toggle('active', a.identityT > 0);
    });
    // level (no cap shown) and experience: the bar and its percentage glide toward the real value
    this.set('lv', p.level, () => (this.lvNum.textContent = String(p.level)));
    const xpk = p.xpNext > 0 ? Math.max(0, Math.min(1, p.xp / p.xpNext)) : 0;
    if (this.xpShown < 0 || p.level !== this.xpLevel) {
      // first frame or a new level: start from the real value without sweeping backwards
      this.xpShown = this.xpLevel >= 0 && p.level > this.xpLevel ? 0 : xpk;
      this.xpLevel = p.level;
    } else this.xpShown += (xpk - this.xpShown) * (1 - Math.exp(-6 * dt));
    if (Math.abs(this.xpShown - xpk) < 0.00002) this.xpShown = xpk;
    const xs = this.xpShown;
    this.set('xp', Math.round(xs * 4000), () => (this.xpFill.style.transform = `scaleX(${xs})`));
    const pct = (Math.floor(xs * 10000) / 100).toFixed(2) + '%';
    this.set('xpt', pct, () => (this.xpText.textContent = pct));
    const kk = this.binds?.skills?.[0] ?? 'KeyK';
    this.set('pts', a.points + kk, () => {
      this.pointsBox.classList.toggle('hidden', a.points <= 0);
      this.pointsBox.textContent = t('ak_points_hud', { n: a.points, k: keyName(kk) });
    });

    // skills Q..F
    for (let i = 0; i < 8; i++) {
      const s = this.slots[i];
      const lv = a.levels[i];
      const cd = a.cds[i];
      this.cool(s, cd, a.cdMax[i] || 1);
      const ready = lv > 0 && a.ready(i);
      const st = lv === 0 ? 'locked' : ready ? 'ready' : cd > 0 ? 'cd' : 'nores';
      this.state(s, st);
      this.fb(s, a);
      const can = a.canLearn(i);
      this.set('ln' + i, can ? 1 : 0, () => s.root.classList.toggle('learn', can));
      const sub = lv === 0 ? t('ak_unlock_short', { n: i + 1 }) : String(lv);
      this.set('sub' + i, sub, () => {
        s.sub.textContent = sub;
        s.sub.classList.toggle('lock', lv === 0);
      });
      const cost = costBadge(a, i);
      this.set('cost' + i, cost, () => (s.cost.textContent = cost));
    }
    // ultimate (Awakening): the gauge rises inside the slot
    {
      const s = this.slots[SLOT_ULT];
      const locked = p.level < c.ult.unlock;
      const g = Math.max(0, Math.min(100, a.ult));
      this.set('ultg', Math.floor(g), () => s.root.style.setProperty('--gk', (g / 100).toFixed(3)));
      const cd = a.cds[SLOT_ULT];
      this.cool(s, cd, a.cdMax[SLOT_ULT] || 1);
      this.state(s, locked ? 'locked' : a.ready(SLOT_ULT) ? 'ready' : 'cd');
      this.fb(s, a);
      const sub = locked ? t('ak_unlock_short', { n: c.ult.unlock }) : cd > 0 ? '' : Math.floor(g) + '%';
      this.set('sub8', sub, () => {
        s.sub.textContent = sub;
        s.sub.classList.toggle('lock', locked);
      });
    }
    // special (summoner X)
    if (c.special) {
      const s = this.slots[SLOT_SPECIAL];
      const cd = a.cds[SLOT_SPECIAL];
      this.cool(s, cd, a.cdMax[SLOT_SPECIAL] || c.special.cd);
      this.state(s, cd > 0 ? 'cd' : 'ready');
      this.fb(s, a);
    }
    // dodge: charges + recharge sweep
    {
      const s = this.slots[SLOT_DODGE];
      const max = c.dodge.charges;
      const n = a.dodgeCharges;
      const rech = n < max ? Math.max(0, c.dodge.cd - a.dodgeT) : 0;
      const k = n < max ? Math.min(1, rech / c.dodge.cd) : 0;
      this.set('cd10', Math.round(k * 240) + (n > 0 ? 1000 : 0), () => (s.cd.style.background = sweep(k, n > 0 ? 'rgba(6,8,12,0.35)' : 'rgba(6,8,12,0.74)')));
      const tx = n === 0 ? cdText(rech) : '';
      this.set('tm10', tx, () => (s.timer.textContent = tx));
      this.state(s, n > 0 ? 'ready' : 'cd');
      this.fb(s, a);
      this.set('dpips', n * 10 + max, () => {
        clear(s.sub);
        s.sub.className = 'bs-sub pips';
        if (max > 1) for (let j = 0; j < max; j++) s.sub.append(h('i' + (j < n ? '.on' : '')));
      });
    }
    // identity (Z)
    {
      const s = this.slots[SLOT_IDENTITY];
      const id = c.identity;
      const active = a.identityT > 0;
      const k = active ? Math.min(1, a.identityT / Math.max(0.1, id.dur || 1)) : 1 - rk;
      this.set('cd11', Math.round(k * 240) + (active ? 1000 : 0), () => (s.cd.style.background = active ? sweep(1 - k, 'rgba(6,8,12,0.55)') : sweep(idReady ? 0 : k, 'rgba(6,8,12,0.6)')));
      const tx = active ? String(Math.ceil(a.identityT)) : '';
      this.set('tm11', tx, () => (s.timer.textContent = tx));
      this.state(s, active ? 'active' : idReady ? 'ready' : 'nores');
      this.fb(s, a);
    }
    // basic attack
    {
      const s = this.slots[SLOT_BASIC];
      this.state(s, 'ready');
      this.fb(s, a);
    }
    // keys (from the player's bindings)
    const kb = this.binds;
    const ks = this.slots.map((s) => (s ? slotKey(kb, s.i) : '')).join('|') + '|' + (kb?.attack?.[0] ?? '');
    this.set('keys', ks, () => {
      for (const s of this.slots) if (s) s.key.textContent = slotKey(kb, s.i);
      const atk = kb?.attack?.[0];
      // basic attack: the mouse button and the keyboard key bound to it
      if (atk) this.slots[SLOT_BASIC].key.textContent = `${slotKey(kb, SLOT_BASIC)}/${keyName(atk)}`;
    });

    // charge / cast bar
    const ch = a.charge;
    const cs = a.casting;
    const prog = ch >= 0 ? ch : cs;
    this.set('cast', prog < 0 ? -1 : Math.round(prog * 100), () => {
      this.castBox.classList.toggle('hidden', prog < 0);
      if (prog < 0) return;
      this.castFill.style.transform = `scaleX(${Math.max(0, Math.min(1, prog))})`;
      this.castBox.classList.toggle('full', ch >= 0.999);
      const def = a.cur?.def;
      this.castName.textContent = (ch >= 0 ? t('ak_charging') : t('ak_casting')) + (def ? ' · ' + L(def.name) : '');
    });

    // active buffs
    const b = a.buff;
    const chips: [string, string][] = [];
    if (a.identityT > 0) chips.push(['id', `${L(c.identity.name)} ${Math.ceil(a.identityT)}`]);
    if (b.dmg > 0.001) chips.push(['dmg', t('ak_buff_dmg', { n: Math.round(b.dmg * 100) })]);
    if (b.speed > 0.001) chips.push(['spd', t('ak_buff_speed', { n: Math.round(b.speed * 100) })]);
    if (b.atkSpeed > 0.001) chips.push(['atk', t('ak_buff_atk', { n: Math.round(b.atkSpeed * 100) })]);
    if (b.armor > 0.001) chips.push(['arm', t('ak_buff_armor', { n: Math.round(b.armor) })]);
    if (b.dr > 0.001) chips.push(['dr', t('ak_buff_dr', { n: Math.round(b.dr * 100) })]);
    const baseCrit = c.id === 'reaper' || c.id === 'deathblade' ? 0.05 : 0;
    if (b.crit - baseCrit > 0.001) chips.push(['crit', t('ak_buff_crit', { n: Math.round((b.crit - baseCrit) * 100) })]);
    if (a.stealthT > 0) chips.push(['stl', t('ak_buff_stealth')]);
    if (a.shield > 0) chips.push(['sh', t('ak_buff_shield', { n: Math.ceil(a.shield) })]);
    const sc = a.summons.count();
    if (sc > 0) chips.push(['sum', t('ak_buff_summons', { n: sc })]);
    if (c.identity.kind === 'axis' && a.seals > 0) chips.push(['seal', t('ak_buff_seals', { n: a.seals })]);
    const bk = chips.map((x) => x[1]).join('|');
    this.set('abuffs', bk, () => {
      clear(this.buffRow);
      for (const [k, txt] of chips) this.buffRow.append(h('span.ah-buff.' + k, txt));
    });

    // tooltip refresh (cooldowns, gauge) a few times a second
    if (this.tipSlot >= 0) {
      this.tipT -= dt || 1 / 60;
      if (this.tipT <= 0) this.renderTip();
    }
    this.updateHover(run);
  }

  private updateHover(run: Run) {
    const e = this.hover;
    const show = !!e && e.alive && e.active;
    this.set('hv', show ? e!.uid : 0, () => this.hoverBox.classList.toggle('hidden', !show));
    if (!show || !e) return;
    const name = e.name || L(e.def.name);
    this.set('hvn', name, () => (this.hName.textContent = name));
    const lvl = Math.max(1, e.level);
    // level colour by the gap to the hero (grey far below, green below, white even, yellow above, red far above)
    const gap = lvl - run.player.level;
    const lc = gap <= -6 ? '#9a9a9a' : gap <= -3 ? '#6bd46b' : gap < 3 ? '#f1f2f4' : gap < 6 ? '#ffd23d' : '#ff5a4a';
    this.set('hvm', lvl + lc, () => {
      clear(this.hMeta);
      this.hMeta.append(h('b', { style: `color:${lc}` }, t('arpg_lv_short', { n: lvl })));
    });
    const k = Math.max(0, e.hp / e.maxHp);
    this.set('hvk', Math.round(k * 300), () => (this.hFill.style.transform = `scaleX(${k})`));
    this.set('hvh', Math.ceil(e.hp), () => (this.hHp.textContent = `${fmtNum(Math.ceil(Math.max(0, e.hp)))} / ${fmtNum(Math.round(e.maxHp))}`));
    // stagger bar
    const broken = e.brokenT > 0;
    const sk = e.stagMax > 0 ? Math.min(1, e.stag / e.stagMax) : 0;
    this.set('hvs', (e.stagMax > 0 ? 1 : 0) + Math.round(sk * 200) * 2 + (broken ? 1000 : 0), () => {
      this.hStagBox.classList.toggle('hidden', e.stagMax <= 0 && !broken);
      this.hStagBox.classList.toggle('broken', broken);
      this.hStag.style.transform = `scaleX(${broken ? 1 : sk})`;
    });
    const fx = enemyEffects(e);
    const fk = fx.map((f) => f.key).join() + (broken ? '|b' : '');
    this.set('hvf', fk, () => {
      clear(this.hFx);
      if (broken) this.hFx.append(h('span.fx-chip', { style: '--fc:#ffc030' }, t('ak_broken')));
      for (const f of fx) this.hFx.append(h('span.fx-chip', { style: `--fc:${f.color}` }, t(f.key)));
    });
  }

  /** Tooltip over a slot: name, key, level, numbers, description and tripods. */
  private renderTip() {
    const run = this.lastRun;
    const i = this.tipSlot;
    if (!run || i < 0) return;
    this.tipT = 0.25;
    const rows = slotDetails(run, i, this.binds);
    clear(this.tip);
    const ty = run.action.skill(i)?.type;
    if (ty === 'hold' || ty === 'charge')
      rows.splice(1, 0, h('div.sk-hold-note', ty === 'hold' ? L({ ru: '⚠ Зажмите клавишу: умение действует, пока она нажата', en: '⚠ Hold the key: the skill lasts while it is held' }) : L({ ru: '⚠ Зажмите клавишу, чтобы зарядить; отпустите для удара', en: '⚠ Hold the key to charge; release to strike' })));
    this.tip.append(...rows);
    // the tooltip lives in the scaled bar: convert screen pixels to bar pixels
    const r = this.slots[i].root.getBoundingClientRect();
    const host = this.wrap.getBoundingClientRect();
    const sc = host.width / Math.max(1, this.wrap.offsetWidth) || 1;
    const half = 150;
    const x = (r.left - host.left + r.width / 2) / sc;
    const w = host.width / sc;
    this.tip.style.left = `${Math.min(w + 40 - half, Math.max(half - 40, x))}px`;
    this.tip.classList.remove('hidden');
  }
}
