import type { Run } from '../game/Run';
import type { ActionSystem } from '../game/action/ActionSystem';
import { SLOT_SPECIAL, SLOT_ULT } from '../game/action/ActionSystem';
import type { ActionEv, SkillDef, Step, Tripod } from '../game/action/types';
import { SKILL_MAX, TRIPOD_LEVELS } from '../game/action/types';
import { tripodsFor } from '../game/action/tripods';
import { SKILL_BINDS, type BindAction, type Keybinds } from '../meta/Save';
import { keyName } from '../input/Input';
import { h, clear, hex } from './dom';
import { iconImg } from './icons';
import { hasSkillIcon, skillIconUrl } from './skillIcons';
import { t, L } from '../i18n';
import { fmtNum } from './format';

/** HUD slot indices beyond the ActionSystem's 0..9 (they match its flash/denied arrays). */
export const SLOT_DODGE = 10;
export const SLOT_IDENTITY = 11;
export const SLOT_BASIC = 12;

const DEFAULT_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'V', 'X', 'Space', 'Z'];

/** Ability icon by id (`<classId>_q`, `_ult`, ...), falling back to the generic icon set. */
export function skillImg(id: string, color: number, cls = 'icon'): HTMLImageElement {
  const sid = hasSkillIcon(id) ? id : hasSkillIcon('sk_' + id) ? 'sk_' + id : '';
  if (!sid) return iconImg(id, color, cls);
  const img = new Image();
  img.src = skillIconUrl(sid, color);
  img.className = cls;
  img.draggable = false;
  img.alt = '';
  return img;
}

export function bindOf(slot: number): BindAction | null {
  if (slot < 8) return SKILL_BINDS[slot];
  return (['ult', 'special', 'dodge', 'identity', 'attack'] as BindAction[])[slot - 8] ?? null;
}

/** Key label of a slot from the current keybinds (basic attack is the right mouse button). */
export function slotKey(binds: Keybinds | null, slot: number): string {
  if (slot === SLOT_BASIC) return t('ak_mouse');
  const a = bindOf(slot);
  const code = a ? binds?.[a]?.[0] : undefined;
  return code ? keyName(code) : (DEFAULT_KEYS[slot] ?? '—');
}

export interface SlotMeta {
  name: string;
  desc: string;
  icon: string;
  color: number;
  kind: string;
}

/** Name, icon and description of any action slot (0..7 skills, 8 ult, 9 special, 10 dodge, 11 identity, 12 basic). */
export function slotMeta(a: ActionSystem, slot: number): SlotMeta | null {
  const c = a.cls;
  if (slot < 8 || slot === SLOT_ULT) {
    const s = a.skill(slot)!;
    return { name: L(s.name), desc: L(s.desc), icon: s.icon, color: s.color, kind: slot === SLOT_ULT ? t('ak_ult') : '' };
  }
  if (slot === SLOT_SPECIAL) return c.special ? { name: L(c.special.name), desc: L(c.special.desc), icon: c.special.icon, color: c.color, kind: t('ak_special') } : null;
  if (slot === SLOT_DODGE) return { name: L(c.dodge.name), desc: t('arpg_dodge_desc'), icon: c.id + '_dodge', color: 0x8ab8e0, kind: t('ak_dodge') };
  if (slot === SLOT_IDENTITY) return { name: L(c.identity.name), desc: L(c.identity.desc), icon: c.identity.icon, color: c.identity.color, kind: t('ak_identity') };
  return { name: L(c.basic.name), desc: L(c.basic.desc), icon: c.basic.icon, color: c.color, kind: t('ak_basic') };
}

function evSum(ev: ActionEv): [number, number] {
  switch (ev.do) {
    case 'hit':
      return [ev.dmg * (ev.n ?? 1), (ev.stag ?? 0) * (ev.n ?? 1)];
    case 'move':
      return ev.hit ? [ev.hit.dmg, ev.hit.stag ?? 0] : [0, 0];
    case 'proj':
      return [ev.dmg * (ev.n ?? 1), (ev.stag ?? 0) * (ev.n ?? 1)];
    case 'zone': {
      const ticks = ev.dur && ev.every ? Math.max(1, Math.floor(ev.dur / ev.every)) : 1;
      const k = ticks * (ev.n ?? 1);
      return [ev.dmg * k, (ev.stag ?? 0) * k];
    }
    case 'chain':
      return [ev.dmg * ev.n, (ev.stag ?? 0) * ev.n];
    default:
      return [0, 0];
  }
}

function stepsSum(steps: Step[]): [number, number] {
  let d = 0;
  let s = 0;
  for (const st of steps)
    for (const ev of st.ev) {
      const [a, b] = evSum(ev);
      d += a;
      s += b;
    }
  return [d, s];
}

/** Rough total damage and stagger of one use of the slot at a skill level (for tooltips, not exact). */
export function slotPower(run: Run, slot: number, lv?: number): { dmg: number; stag: number } {
  const a = run.action;
  const c = a.cls;
  let steps: Step[] = [];
  if (slot < 8 || slot === SLOT_ULT) steps = a.skill(slot)!.steps;
  else if (slot === SLOT_SPECIAL) steps = c.special ? [c.special.step] : [];
  else if (slot === SLOT_DODGE) steps = [c.dodge.step];
  else if (slot === SLOT_IDENTITY) steps = c.identity.step ? [c.identity.step] : [];
  else steps = c.basic.steps;
  const [d, s] = stepsSum(steps);
  const p = run.player;
  let mul = c.power * (1 + (p.level - 1) * 0.07);
  let sm = 1 + (p.level - 1) * 0.03;
  if (slot < 8) {
    const l = Math.max(1, lv ?? a.levels[slot]);
    mul *= 1 + (l - 1) * 0.12;
    const t2 = a.tripod(slot, 1);
    if (t2?.kind === 'dmg') mul *= 1 + t2.v;
    if (t2?.kind === 'stag') sm *= 1 + t2.v;
  }
  if (slot !== SLOT_BASIC) mul *= 1 + (run.loot.totals.skillDmg ?? 0);
  return { dmg: d * mul, stag: s * sm };
}

function costText(a: ActionSystem, def: SkillDef, slot: number): string {
  const r = a.cls.res;
  if (!def.cost) return '';
  const raw = def.cost > 0 ? (slot < 8 || slot === SLOT_ULT ? a.costOf(slot) : def.cost) : -def.cost;
  const v = r.orbs ? Math.round((raw / (r.max / r.orbs)) * 10) / 10 + ' ●' : String(Math.round(raw));
  return v + ' ' + L(r.name);
}

/** Short cost label for a HUD slot ("15", "+30", "1●"). */
export function costBadge(a: ActionSystem, slot: number): string {
  const def = a.skill(slot);
  if (!def || !def.cost || a.levels[slot] === 0) return '';
  const r = a.cls.res;
  const raw = def.cost > 0 ? a.costOf(slot) : -def.cost;
  const v = r.orbs ? String(Math.round((raw / (r.max / r.orbs)) * 10) / 10) + '●' : String(Math.round(raw));
  return (def.cost < 0 ? '+' : '') + v;
}

const sec = (n: number) => t('ak_sec', { n: n < 10 ? (Math.round(n * 10) / 10).toString() : String(Math.round(n)) });

function kv(k: string, v: string): HTMLElement {
  return h('div.tip-kv', h('span', k), h('b', v));
}

/** Detailed description of a slot (HUD tooltip and the skills screen side panel). */
export function slotDetails(run: Run, slot: number, binds: Keybinds | null): HTMLElement[] {
  const a = run.action;
  const c = a.cls;
  const m = slotMeta(a, slot);
  if (!m) return [];
  const p = run.player;
  const rows: HTMLElement[] = [];
  const key = slotKey(binds, slot);
  let lvTxt = m.kind;
  if (slot < 8) lvTxt = a.levels[slot] > 0 ? t('ak_lv', { n: a.levels[slot], m: SKILL_MAX }) : t('ak_unlock_short', { n: slot + 1 });
  rows.push(h('div.tip-head', h('b', { style: `color:${hex(m.color)}` }, m.name), h('span.tip-key', key), h('span.tip-lv', lvTxt)));
  const def = slot < 8 || slot === SLOT_ULT ? a.skill(slot) : null;
  const grid: HTMLElement[] = [];
  if (def) {
    rows.push(h('div.tip-meta', t('ak_cast_' + def.type) + ' · ' + t('ak_el_' + def.el)));
    if (def.tags.length) rows.push(h('div.tip-tags', ...def.tags.map((g) => h('span', t('ak_tag_' + g)))));
    rows.push(h('div.tip-desc', L(def.desc)));
    if (slot === SLOT_ULT) grid.push(kv(t('ak_ult_gauge'), Math.floor(a.ult) + '%'));
    else grid.push(kv(t('ak_cd'), sec(a.cooldownOf(slot))));
    const ct = costText(a, def, slot);
    if (ct) grid.push(kv(def.cost! > 0 ? t('ak_cost') : t('ak_gain'), ct));
    if (def.range > 0) grid.push(kv(t('ak_range'), String(def.range)));
    if (def.radius > 0) grid.push(kv(t('ak_radius'), String(def.radius)));
    const pw = slotPower(run, slot);
    if (pw.dmg > 0) grid.push(kv(t('ak_dmg'), fmtNum(Math.round(pw.dmg))));
    if (pw.stag > 0) grid.push(kv(t('ak_stag'), fmtNum(Math.round(pw.stag))));
    rows.push(h('div.tip-grid', ...grid));
    const extra: string[] = [];
    if (def.type === 'combo') extra.push(t('ak_combo_steps', { n: def.steps.length }));
    if (def.type === 'hold' && def.holdMax) extra.push(t('ak_hold_max', { n: def.holdMax }));
    if (def.type === 'charge' && def.chargeMax) extra.push(t('ak_charge_max', { n: def.chargeMax, m: def.chargeMul ?? 1 }));
    if (def.type === 'cast' && def.castTime) extra.push(t('ak_cast_time', { n: def.castTime }));
    if (extra.length) rows.push(h('div.tip-stat', extra.join(' · ')));
    if (def.note) rows.push(h('div.tip-note', L(def.note)));
    if (slot < 8) {
      for (let tier = 0; tier < 2; tier++) {
        const lvNeed = TRIPOD_LEVELS[tier];
        const on = a.tripod(slot, tier);
        const label = t('ak_tier', { n: tier + 1 }) + ': ';
        if (a.levels[slot] < lvNeed) rows.push(h('div.tip-tri.locked', label, t('ak_tri_locked', { n: lvNeed })));
        else rows.push(h('div.tip-tri' + (on ? '.on' : ''), label, on ? h('b', L(on.name)) : t('ak_tri_none'), on ? ' — ' + L(on.desc) : ''));
      }
      if (a.levels[slot] === 0) rows.push(h('div.tip-next', t('ak_unlock', { n: slot + 1 })));
      else if (a.levels[slot] < SKILL_MAX) rows.push(h('div.tip-next', t('ak_next')));
      else rows.push(h('div.tip-next', t('ak_maxed')));
      if (a.canLearn(slot)) rows.push(h('div.tip-learn', t('ak_learn_hint')));
    } else {
      if (p.level < def.unlock) rows.push(h('div.tip-next', t('ak_unlock', { n: def.unlock })));
      rows.push(h('div.tip-note', t('ak_ult_note')));
    }
    return rows;
  }
  rows.push(h('div.tip-desc', m.desc));
  if (slot === SLOT_IDENTITY) {
    const r = c.res;
    grid.push(kv(t('ak_res'), L(r.name)));
    grid.push(kv(t('ak_need'), r.orbs ? `${r.orbs} ●` : String(c.identity.need)));
    if (c.identity.dur > 0) grid.push(kv(t('ak_dur'), sec(c.identity.dur)));
    rows.push(h('div.tip-grid', ...grid));
    rows.push(h('div.tip-note', L(r.desc)));
    if (a.identityT > 0) rows.push(h('div.tip-learn', t('ak_active', { n: Math.ceil(a.identityT) })));
    else if (a.identityReady) rows.push(h('div.tip-learn', t('ak_ready')));
  } else if (slot === SLOT_DODGE) {
    grid.push(kv(t('ak_cd'), sec(c.dodge.cd)));
    grid.push(kv(t('ak_charges'), `${a.dodgeCharges} / ${c.dodge.charges}`));
    rows.push(h('div.tip-grid', ...grid));
  } else if (slot === SLOT_SPECIAL && c.special) {
    grid.push(kv(t('ak_cd'), sec(c.special.cd)));
    rows.push(h('div.tip-grid', ...grid));
  } else if (slot === SLOT_BASIC) {
    rows.push(h('div.tip-meta', t('ak_cast_combo') + ' · ' + t('ak_el_' + c.basic.el) + ' · ' + t(c.basic.ranged ? 'ak_tag_ranged' : 'ak_tag_melee')));
    grid.push(kv(t('ak_combo_steps', { n: c.basic.steps.length }).split(':')[0], String(c.basic.steps.length)));
    const pw = slotPower(run, slot);
    if (pw.dmg > 0) grid.push(kv(t('ak_dmg'), fmtNum(Math.round(pw.dmg))));
    if (pw.stag > 0) grid.push(kv(t('ak_stag'), fmtNum(Math.round(pw.stag))));
    rows.push(h('div.tip-grid', ...grid));
  }
  return rows;
}

/**
 * Skills window (K): basic attack, the eight skills, Awakening, Identity, dodge and the class special,
 * with levels (spend skill points), numbers and the two tripod tiers to pick from. Pauses nothing itself.
 */
export class SkillsScreen {
  readonly root: HTMLElement;
  private run: Run | null = null;
  private list = h('div.sks-list');
  private detail = h('div.sks-detail');
  private head = h('div.sks-head');
  private hint = h('div.sks-hint');
  private detSlot = -1;
  private sig = '';
  private timer = 0;
  binds: Keybinds | null = null;
  onClose: () => void = () => {};
  /** Optional sound hook (App can pass its sfx). */
  onSfx: (id: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = h(
      'div.skills-screen.hidden',
      h(
        'div.modal-back',
        {
          onmousedown: (e: MouseEvent) => {
            if (e.target === e.currentTarget) this.close();
          },
        },
        h('div.modal.sks', this.head, h('div.sks-body', this.list, this.detail), this.hint),
      ),
    );
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(run: Run) {
    this.run = run;
    this.sig = '';
    this.detSlot = -1;
    this.root.classList.remove('hidden');
    this.render();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.refresh(), 250);
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.add('hidden');
    clearInterval(this.timer);
    this.timer = 0;
    this.run = null;
    this.onClose();
  }

  toggle(run: Run) {
    if (this.isOpen) this.close();
    else this.open(run);
  }

  private signature(): string {
    const r = this.run;
    if (!r) return '';
    const a = r.action;
    return [a.points, a.levels.join(), a.tri.map((x) => x.join(':')).join(), r.player.level, a.dodgeCharges, Math.floor(a.ult / 5), a.identityReady ? 1 : 0].join('|');
  }

  /** Re-render when levels, points or tripods change (also called by App after Ctrl+key learning). */
  refresh() {
    if (!this.run || !this.isOpen) return;
    if (this.signature() !== this.sig) this.render();
  }

  private render() {
    const run = this.run;
    if (!run) return;
    const a = run.action;
    const c = a.cls;
    this.sig = this.signature();
    const scroll = this.list.scrollTop;
    clear(this.head);
    this.head.append(
      h('h2', t('ak_title')),
      h('div.sks-cls', { style: `color:${hex(c.color)}` }, L(c.name), h('span', ' · ' + t('ak_level_hero', { n: run.player.level }))),
      h('div.sks-points' + (a.points > 0 ? '.has' : ''), t('ak_points', { n: a.points })),
      h('button.btn.small.sks-close', { onclick: () => this.close() }, '✕'),
    );
    clear(this.list);
    const order = [SLOT_BASIC, 0, 1, 2, 3, 4, 5, 6, 7, SLOT_ULT, SLOT_IDENTITY, SLOT_DODGE];
    if (c.special) order.push(SLOT_SPECIAL);
    for (const s of order) this.list.append(this.row(run, s));
    this.list.scrollTop = scroll;
    this.renderDetail();
    this.hint.textContent = t('ak_hint', { k: keyName(this.binds?.skills?.[0] ?? 'KeyK') });
  }

  private renderDetail() {
    clear(this.detail);
    const run = this.run;
    if (!run) return;
    const s = this.detSlot >= 0 ? this.detSlot : 0;
    const m = slotMeta(run.action, s);
    if (!m) return;
    this.detail.append(h('div.sks-dicon', skillImg(m.icon, m.color, 'icon')), ...slotDetails(run, s, this.binds));
  }

  private row(run: Run, slot: number): HTMLElement {
    const a = run.action;
    const c = a.cls;
    const m = slotMeta(a, slot)!;
    const def = slot < 8 || slot === SLOT_ULT ? a.skill(slot) : null;
    const lv = slot < 8 ? a.levels[slot] : 0;
    const locked = slot < 8 ? lv === 0 : slot === SLOT_ULT ? run.player.level < c.ult.unlock : false;
    const icon = h('div.sks-icon' + (slot === SLOT_ULT ? '.ult' : ''), skillImg(m.icon, m.color, 'icon'), h('span.sks-key', slotKey(this.binds, slot)));
    const meta: string[] = [];
    if (def) meta.push(t('ak_cast_' + def.type), t('ak_el_' + def.el));
    else meta.push(m.kind);
    const stats: string[] = [];
    if (def) {
      if (slot !== SLOT_ULT) stats.push(t('ak_cd') + ' ' + sec(a.cooldownOf(slot)));
      const ct = costText(a, def, slot);
      if (ct) stats.push((def.cost! > 0 ? t('ak_cost') : t('ak_gain')) + ' ' + ct);
      if (def.range > 0) stats.push(t('ak_range') + ' ' + def.range);
      if (def.radius > 0) stats.push(t('ak_radius') + ' ' + def.radius);
      const pw = slotPower(run, slot);
      if (pw.dmg > 0) stats.push(t('ak_dmg') + fmtNum(Math.round(pw.dmg)));
    } else if (slot === SLOT_DODGE) stats.push(t('ak_cd') + ' ' + sec(c.dodge.cd), t('ak_charges') + ' ' + c.dodge.charges);
    else if (slot === SLOT_SPECIAL && c.special) stats.push(t('ak_cd') + ' ' + sec(c.special.cd));
    else if (slot === SLOT_IDENTITY) stats.push(L(c.res.name) + (c.identity.dur > 0 ? ' · ' + t('ak_dur') + ' ' + sec(c.identity.dur) : ''));
    else if (slot === SLOT_BASIC) {
      const pw = slotPower(run, slot);
      stats.push(t('ak_combo_steps', { n: c.basic.steps.length }), t('ak_dmg') + fmtNum(Math.round(pw.dmg)));
    }
    const info = h(
      'div.sks-info',
      h('div.sks-name', { style: `color:${hex(m.color)}` }, m.name),
      h('div.sks-meta', meta.join(' · '), def ? h('span.sks-tags', ...def.tags.map((g) => h('span', t('ak_tag_' + g)))) : null),
      h('div.sks-stats', stats.join(' · ')),
    );
    // level column
    const lvBox = h('div.sks-lv');
    if (slot < 8) {
      if (lv === 0) lvBox.append(h('div.sks-lock', t('ak_unlock_short', { n: slot + 1 })));
      else {
        const pips = h('div.sks-pips');
        for (let i = 0; i < SKILL_MAX; i++) pips.append(h('i' + (i < lv ? '.on' : '') + (TRIPOD_LEVELS.includes(i + 1) ? '.tp' : '')));
        lvBox.append(h('div.sks-lvn', t('ak_lv', { n: lv, m: SKILL_MAX })), pips);
      }
      const can = a.canLearn(slot);
      lvBox.append(
        h('button.sks-plus' + (can ? '' : '.off'), {
          title: t('ak_learn_hint'),
          onclick: (e: MouseEvent) => {
            e.stopPropagation();
            if (a.learn(slot)) this.onSfx('select');
            else this.onSfx('denied');
            this.render();
          },
        }, '+'),
      );
    } else if (slot === SLOT_ULT) {
      lvBox.append(h('div.sks-lock' + (locked ? '' : '.ok'), locked ? t('ak_unlock_short', { n: c.ult.unlock }) : Math.floor(a.ult) + '%'));
    }
    const row = h('div.sks-row' + (locked ? '.locked' : '') + (this.detSlot === slot ? '.sel' : ''), icon, info, lvBox);
    row.addEventListener('mouseenter', () => {
      if (this.detSlot === slot) return;
      this.detSlot = slot;
      this.list.querySelectorAll('.sks-row.sel').forEach((el) => el.classList.remove('sel'));
      row.classList.add('sel');
      this.renderDetail();
    });
    if (slot < 8 && def) row.append(this.tripodBox(run, slot, def));
    return row;
  }

  private tripodBox(run: Run, slot: number, def: SkillDef): HTMLElement {
    const a = run.action;
    const tiers = tripodsFor(def);
    const box = h('div.sks-tri');
    tiers.forEach((opts: Tripod[], tier) => {
      const need = TRIPOD_LEVELS[tier];
      const open = a.levels[slot] >= need;
      const col = h('div.sks-tier' + (open ? '' : '.locked'), h('div.sks-tier-h', t('ak_tier', { n: tier + 1 }), h('small', open ? '' : ' · ' + t('ak_tier_lv', { n: need }))));
      const cards = h('div.sks-cards');
      opts.forEach((tp, i) => {
        const on = a.tri[slot][tier] === i && open;
        cards.append(
          h(
            'button.sks-card' + (on ? '.on' : '') + (open ? '' : '.locked'),
            {
              title: L(tp.desc) + (open ? '' : '\n' + t('ak_tri_locked', { n: need })),
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                if (a.setTripod(slot, tier, i)) {
                  this.onSfx('select');
                  this.render();
                } else this.onSfx('denied');
              },
            },
            h('b', L(tp.name)),
            h('small', L(tp.desc)),
          ),
        );
      });
      col.append(cards);
      box.append(col);
    });
    return box;
  }
}
