import type { Run } from '../game/Run';
import type { Enemy } from '../game/Enemy';
import type { BossController } from '../game/bosses/Boss';
import { SLOT_SPECIAL, SLOT_ULT } from '../game/action/ActionSystem';
import { keyName } from '../input/Input';
import type { Keybinds } from '../meta/Save';
import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { fmtNum } from './format';
import { SLOT_BASIC, SLOT_DODGE, SLOT_IDENTITY, costBadge, skillImg, slotDetails, slotKey, slotMeta } from './SkillsScreen';

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
const sweep = (k: number, c = 'rgba(8,10,14,0.78)') => (k > 0 ? `conic-gradient(${c} ${(k * 360).toFixed(1)}deg, transparent 0)` : 'none');

/**
 * Action-combat HUD (Lost-Ark-like): health with shield, the class resource / Identity gauge (Z), eight
 * skill slots on Q W E R / A S D F, basic attack, dodge charges, the class special (X) and the round
 * Awakening gauge (V); a charge / cast bar, active buffs, unspent skill points, slot tooltips, and the
 * info panel for the enemy under the cursor (with its stagger bar).
 */
export class ArpgHud {
  readonly root: HTMLElement;
  readonly hoverBox: HTMLElement;
  private hpFill = h('div.ah-fill');
  private hpShield = h('div.ah-shield');
  private hpText = h('div.ah-text');
  private resBar: HTMLElement;
  private resFill = h('div.ah-fill');
  private resText = h('div.ah-text');
  private resName = h('div.ah-label');
  private orbs = h('div.ah-orbs');
  private xpFill = h('div.ah-xp-fill');
  private xpText = h('div.ah-xp-text');
  private gold = h('span');
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
  onInventory: () => void = () => {};
  onLearn: (slot: number) => void = () => {};
  /** Opens the skills screen (the K button on the bar and the skill-points badge). */
  onSkills: () => void = () => {};
  private pointsBox = h('div.ah-points.hidden');
  private tip = h('div.sk-tip.hidden');
  private tipSlot = -1;
  private tipT = 0;
  private lastRun: Run | null = null;
  private bagKey = h('span.key');
  private skKey = h('span.key');
  private specialWrap: HTMLElement;

  constructor() {
    const mk = (i: number, extra = ''): Slot => {
      const s: Slot = { i, root: h('div.sk' + extra), icon: h('div.sk-icon'), cd: h('div.sk-cd'), timer: h('div.sk-timer'), key: h('div.sk-key'), cost: h('div.sk-cost'), sub: h('div.sk-sub') };
      s.root.append(s.icon, s.cd, s.timer, s.key, s.cost, s.sub);
      if (i < 8) {
        const plus = h('div.sk-plus', '+');
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
    const grid = h('div.ah-grid');
    for (let i = 0; i < 8; i++) grid.append(mk(i).root);
    const ult = mk(SLOT_ULT, '.ult');
    ult.root.prepend(h('div.sk-gauge'));
    const special = mk(SLOT_SPECIAL, '.small');
    const dodge = mk(SLOT_DODGE, '.dodge.small');
    const ident = mk(SLOT_IDENTITY, '.ident');
    const basic = mk(SLOT_BASIC, '.basic.small');
    basic.key.classList.add('mouse');
    this.specialWrap = special.root;
    this.resBar = h('div.ah-bar.res', this.resName, h('div.ah-track', this.resFill, this.orbs), this.resText);
    const bars = h('div.ah-bars', h('div.ah-bar.hp', h('div.ah-label', t('hud_hp')), h('div.ah-track', this.hpFill, this.hpShield), this.hpText), this.resBar);
    this.castBox.append(this.castName, h('div.ah-cast-track', this.castFill));
    this.pointsBox.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.onSkills();
    });
    this.root = h(
      'div.arpg-hud',
      this.castBox,
      h('div.ah-toprow', this.buffRow, this.pointsBox),
      this.tip,
      h(
        'div.ah-main',
        h('div.ah-left', bars, ident.root),
        grid,
        h('div.ah-extra', basic.root, dodge.root, special.root),
        ult.root,
        h(
          'div.ah-side',
          h('div.ah-gold', h('i.ic-coin'), this.gold),
          h(
            'div.ah-btns',
            h('button.ah-bag', { title: t('inv_title'), onclick: () => this.onInventory() }, iconImg('chest', 0xffc060, 'icon'), this.bagKey),
            h('button.ah-bag.ah-skb', { title: t('ak_skills_btn'), onclick: () => this.onSkills() }, iconImg('rune', 0x9ad0ff, 'icon'), this.skKey),
          ),
        ),
      ),
      h('div.ah-xp', h('div.ah-xp-track', this.xpFill), this.xpText),
    );
    this.hStagBox = h('div.hv-stag', this.hStag);
    this.hoverBox = h('div.hover-info.hidden', this.hName, this.hMeta, h('div.hv-track', this.hFill, this.hHp), this.hStagBox, this.hFx);
  }

  reset(run: Run | null) {
    this.last = {};
    this.hover = null;
    this.runRef = run;
    this.hoverBox.classList.add('hidden');
    this.tip.classList.add('hidden');
    this.tipSlot = -1;
    if (!run) return;
    const a = run.action;
    const c = a.cls;
    this.resName.textContent = L(c.res.name);
    this.root.style.setProperty('--res', c.res.color);
    this.root.style.setProperty('--cls', hex(c.color));
    this.resBar.classList.toggle('orb', !!c.res.orbs);
    clear(this.orbs);
    for (let i = 0; i < (c.res.orbs ?? 0); i++) this.orbs.append(h('i', h('b')));
    this.specialWrap.classList.toggle('hidden', !c.special);
    for (const s of this.slots) {
      if (!s) continue;
      clear(s.icon);
      const m = slotMeta(a, s.i);
      if (m) s.icon.append(skillImg(m.icon, m.color, 'icon'));
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
    this.set('cd' + s.i, Math.round(k * 120), () => (s.cd.style.background = sweep(k)));
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
    const p = run.player;
    const a = run.action;
    const c = a.cls;
    // health + shield
    const maxHp = Math.max(1, p.stats.maxHp);
    const hpk = Math.max(0, p.hp / maxHp);
    this.set('hp', Math.round(hpk * 400), () => (this.hpFill.style.transform = `scaleX(${hpk})`));
    const shk = Math.min(1, a.shield / maxHp);
    this.set('sh', Math.round(shk * 400), () => (this.hpShield.style.transform = `scaleX(${shk})`));
    const hpTxt = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(maxHp)}` + (a.shield > 0 ? ` (+${Math.ceil(a.shield)})` : '');
    this.set('hpt', hpTxt, () => (this.hpText.textContent = hpTxt));
    // class resource / identity gauge
    const resMax = Math.max(1, a.resMax);
    const rk = Math.min(1, a.res / resMax);
    if (c.res.orbs) {
      const per = c.res.max / c.res.orbs;
      const ok = Math.round((a.res / per) * 20);
      this.set('orbs', ok, () => {
        const kids = this.orbs.children;
        for (let i = 0; i < kids.length; i++) {
          const f = Math.max(0, Math.min(1, a.res / per - i));
          kids[i].classList.toggle('on', f >= 0.999);
          (kids[i].firstChild as HTMLElement).style.transform = `scaleY(${f})`;
        }
      });
      this.set('rest', a.orbs, () => (this.resText.textContent = `${a.orbs} / ${c.res.orbs}`));
    } else {
      this.set('res', Math.round(rk * 400), () => (this.resFill.style.transform = `scaleX(${rk})`));
      this.set('rest', Math.floor(a.res) + '/' + resMax, () => (this.resText.textContent = `${Math.floor(a.res)} / ${Math.round(resMax)}`));
    }
    const idReady = a.identityReady;
    this.set('idr', (idReady ? 1 : 0) + (a.identityT > 0 ? 2 : 0), () => {
      this.resBar.classList.toggle('ready', idReady);
      this.resBar.classList.toggle('active', a.identityT > 0);
    });
    // xp
    const capped = p.level >= a.maxLevel;
    const xpk = p.xpNext > 0 ? Math.min(1, p.xp / p.xpNext) : 0;
    this.set('xp', Math.round(xpk * 500), () => (this.xpFill.style.transform = `scaleX(${xpk})`));
    this.set('xpt', `${p.level}|${capped}|${Math.floor(p.xp)}`, () => {
      this.xpText.textContent = capped ? t('arpg_lv_max', { n: p.level }) : t('arpg_lv', { n: p.level, max: a.maxLevel }) + ` · ${Math.floor(p.xp)} / ${p.xpNext}`;
    });
    const ik = this.binds?.inventory?.[0] ?? '';
    const kk = this.binds?.skills?.[0] ?? 'KeyK';
    this.set('bagk', ik + kk, () => {
      this.bagKey.textContent = keyName(ik);
      this.skKey.textContent = keyName(kk);
    });
    this.set('bagn', run.loot.bag.length, () => this.root.style.setProperty('--bagn', `'${run.loot.bag.length}'`));
    this.set('gold', Math.round(run.stats.gold), () => (this.gold.textContent = fmtNum(run.stats.gold)));
    this.set('pts', a.points + kk, () => {
      this.pointsBox.classList.toggle('hidden', a.points <= 0);
      this.pointsBox.textContent = t('ak_points_hud', { n: a.points, k: keyName(kk) });
    });

    // skills Q..F
    for (let i = 0; i < 8; i++) {
      const s = this.slots[i];
      const lv = a.levels[i];
      const def = c.skills[i];
      const cd = a.cds[i];
      this.cool(s, cd, a.cdMax[i] || 1);
      const ready = lv > 0 && a.ready(i);
      const st = lv === 0 ? 'locked' : ready ? 'ready' : cd > 0 ? 'cd' : 'nores';
      this.state(s, st);
      this.fb(s, a);
      const can = a.canLearn(i);
      this.set('ln' + i, can ? 1 : 0, () => s.root.classList.toggle('learn', can));
      const sub = lv === 0 ? t('ak_unlock_short', { n: def.unlock }) : String(lv);
      this.set('sub' + i, sub, () => {
        s.sub.textContent = sub;
        s.sub.classList.toggle('lock', lv === 0);
      });
      const cost = costBadge(a, i);
      this.set('cost' + i, cost, () => (s.cost.textContent = cost));
    }
    // ultimate (Awakening): round gauge
    {
      const s = this.slots[SLOT_ULT];
      const locked = p.level < c.ult.unlock;
      const g = Math.max(0, Math.min(100, a.ult));
      this.set('ultg', Math.floor(g), () => s.root.style.setProperty('--g', `${(g * 3.6).toFixed(1)}deg`));
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
      this.set('cd10', Math.round(k * 120) + (n > 0 ? 1000 : 0), () => (s.cd.style.background = sweep(k, n > 0 ? 'rgba(8,10,14,0.35)' : 'rgba(8,10,14,0.78)')));
      const tx = n === 0 ? cdText(rech) : '';
      this.set('tm10', tx, () => (s.timer.textContent = tx));
      this.state(s, n > 0 ? 'ready' : 'cd');
      this.fb(s, a);
      this.set('dpips', n * 10 + max, () => {
        clear(s.sub);
        s.sub.className = 'sk-sub pips';
        for (let j = 0; j < max; j++) s.sub.append(h('i' + (j < n ? '.on' : '')));
      });
    }
    // identity (Z)
    {
      const s = this.slots[SLOT_IDENTITY];
      const id = c.identity;
      const active = a.identityT > 0;
      const k = active ? Math.min(1, a.identityT / Math.max(0.1, id.dur || 1)) : 1 - rk;
      this.set('cd11', Math.round(k * 120) + (active ? 1000 : 0), () => (s.cd.style.background = active ? sweep(1 - k, 'rgba(8,10,14,0.55)') : sweep(idReady ? 0 : k, 'rgba(8,10,14,0.6)')));
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
    // keys
    const kb = this.binds;
    const ks = this.slots.map((s) => (s ? slotKey(kb, s.i) : '')).join('|');
    this.set('keys', ks, () => {
      for (const s of this.slots) if (s) s.key.textContent = slotKey(kb, s.i);
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
      this.tipT -= 1 / 60;
      if (this.tipT <= 0) this.renderTip();
    }
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

  /** Tooltip over a slot: name, key, level, numbers, description and tripods. */
  private renderTip() {
    const run = this.lastRun;
    const i = this.tipSlot;
    if (!run || i < 0) return;
    this.tipT = 0.25;
    const rows = slotDetails(run, i, this.binds);
    clear(this.tip);
    this.tip.append(...rows);
    const r = this.slots[i].root.getBoundingClientRect();
    const host = this.root.getBoundingClientRect();
    const half = 150;
    const x = r.left - host.left + r.width / 2;
    this.tip.style.left = `${Math.min(host.width + 40 - half, Math.max(half - 40, x))}px`;
    this.tip.classList.remove('hidden');
  }
}
