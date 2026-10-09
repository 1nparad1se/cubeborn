import type { Run } from '../game/Run';
import { BAG_SIZE } from '../game/arpg/Loot';
import { EQUIP_POS, baseIcon, reqLevel, isPct, itemName, itemStats, RARITY_COLOR, RARITY_HEX, score, sellPrice, slotOf, type Affix, type AffixStat, type EquipPos, type Item } from '../game/arpg/Gear';
import { POWER_BY_ID } from '../game/action/powers';
import { h, clear } from './dom';
import { iconImg } from './icons';
import { t, L, getLang } from '../i18n';

/** "+12%" / "+8" for an affix value. */
export function affixText(a: Affix): string {
  const v = isPct(a.stat) ? `${Math.round(a.v * 1000) / 10}%` : `${Math.round(a.v * 10) / 10}`;
  return t('af_' + a.stat, { v });
}

function fmtDiff(stat: AffixStat, d: number): string {
  const v = isPct(stat) ? `${Math.round(Math.abs(d) * 1000) / 10}%` : `${Math.round(Math.abs(d) * 10) / 10}`;
  return (d > 0 ? '▲ +' : '▼ −') + v;
}

/** Tooltip body for an item, with comparison lines against `cmp` when given. */
export function itemCard(it: Item, cmp: Item | null, title?: string, heroLevel?: number): HTMLElement {
  const lang = getLang();
  const col = RARITY_COLOR[it.rarity];
  const lines: HTMLElement[] = [];
  const cmpMap = new Map<AffixStat, number>();
  if (cmp) for (const a of itemStats(cmp)) cmpMap.set(a.stat, (cmpMap.get(a.stat) ?? 0) + a.v);
  const seen = new Set<AffixStat>();
  itemStats(it).forEach((a, i) => {
    seen.add(a.stat);
    const d = cmp ? a.v - (cmpMap.get(a.stat) ?? 0) : 0;
    lines.push(
      h('div.it-line' + (i === 0 ? '.implicit' : ''), h('span', affixText(a)), cmp && Math.abs(d) > 1e-6 ? h('span.diff' + (d > 0 ? '.up' : '.down'), fmtDiff(a.stat, d)) : null),
    );
  });
  if (cmp) for (const [stat, v] of cmpMap) if (!seen.has(stat)) lines.push(h('div.it-line.lost', h('span', affixText({ stat, v }) + ' ' + t('inv_lost')), h('span.diff.down', fmtDiff(stat, -v))));
  const power = it.power ? POWER_BY_ID[it.power] : null;
  const verdict = cmp !== undefined && cmp !== null ? (score(it) > score(cmp) + 0.05 ? 'better' : score(it) < score(cmp) - 0.05 ? 'worse' : 'same') : null;
  return h(
    'div.it-card',
    { style: `--rc:${col}` },
    title ? h('div.it-title', title) : null,
    h(
      'div.it-head',
      h('div.it-icon', iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon lg'), it.enh ? h('i.it-enh', '+' + it.enh) : null),
      h(
        'div',
        h('div.it-name', (it.enh ? `+${it.enh} ` : '') + itemName(it, lang)),
        h('div.it-sub', h('b', { style: `color:${col}` }, t('rar_' + it.rarity)), ` · ${t('slot_' + it.slot)} · ${t('inv_ilvl', { n: it.ilvl })}`),
        h('div.it-req' + (heroLevel !== undefined && reqLevel(it) > heroLevel ? '.no' : ''), t('inv_req_level', { n: reqLevel(it) })),
      ),
    ),
    ...lines,
    power ? h('div.it-power', h('b', L(power.name) + ': '), L(power.desc)) : null,
    verdict ? h('div.it-verdict.' + verdict, t('inv_' + verdict)) : null,
    h('div.it-price', t('inv_price', { n: sellPrice(it) })),
  );
}

/**
 * Inventory screen: equipped set (paper doll), the bag, item details with a comparison
 * against what is worn, and actions (equip, unequip, drop, sell). Also lists hero stats.
 */
export class InventoryUi {
  readonly root: HTMLElement;
  private doll = h('div.inv-doll');
  private bag = h('div.inv-bag');
  private detail = h('div.inv-detail');
  private stats = h('div.inv-stats');
  private gold = h('span');
  private sel: { kind: 'bag' | 'eq'; item: Item; pos?: EquipPos } | null = null;

  constructor(private run: Run, onClose: () => void) {
    this.root = h(
      'div.modal-back',
      h(
        'div.modal.inventory',
        h('div.inv-top', h('h2.glow', t('inv_title')), h('div.inv-gold', h('i.ic-coin'), this.gold), h('button.btn.small', { onclick: onClose }, t('inv_close'))),
        h('div.inv-body', h('div.inv-left', this.doll, this.stats), h('div.inv-mid', h('div.inv-label', t('inv_bag')), this.bag), this.detail),
        h('div.inv-hint', t('inv_hint')),
      ),
    );
    this.render();
  }

  private render() {
    const run = this.run;
    const loot = run.loot;
    this.gold.textContent = String(Math.round(run.stats.gold));
    clear(this.doll);
    for (const pos of EQUIP_POS) {
      const it = loot.equipped[pos];
      const cell = h(
        'div.inv-slot.eq.' + pos + (it ? '' : '.empty') + (this.sel?.kind === 'eq' && this.sel.pos === pos ? '.sel' : ''),
        {
          style: it ? `--rc:${RARITY_COLOR[it.rarity]}` : '',
          title: t('slot_' + slotOf(pos)),
          onclick: () => {
            if (it) this.select({ kind: 'eq', item: it, pos });
          },
          oncontextmenu: (e: Event) => {
            e.preventDefault();
            if (it && loot.unequip(pos)) this.after();
          },
          onmouseenter: () => it && this.show(it, null, t('inv_worn')),
        },
        it ? iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon') : h('span.inv-ph', t('slot_' + slotOf(pos))),
        it?.enh ? h('i.inv-enh', '+' + it.enh) : null,
      );
      this.doll.append(cell);
    }
    clear(this.bag);
    for (let i = 0; i < BAG_SIZE; i++) {
      const it = loot.bag[i];
      if (!it) {
        this.bag.append(h('div.inv-slot.empty'));
        continue;
      }
      const cmp = loot.compareTarget(it);
      const up = score(it) > score(cmp) + 0.05;
      this.bag.append(
        h(
          'div.inv-slot' + (this.sel?.item === it ? '.sel' : '') + (up ? '.up' : ''),
          {
            style: `--rc:${RARITY_COLOR[it.rarity]}`,
            onclick: () => this.select({ kind: 'bag', item: it }),
            ondblclick: () => {
              if (loot.equip(it)) this.after();
            },
            oncontextmenu: (e: Event) => {
              e.preventDefault();
              if (loot.equip(it)) this.after();
            },
            onmouseenter: () => this.show(it, cmp),
          },
          iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon'),
          up ? h('i.inv-up', '▲') : null,
          it.enh ? h('i.inv-enh', '+' + it.enh) : null,
          reqLevel(it) > run.player.level ? h('i.inv-req', String(reqLevel(it))) : null,
        ),
      );
    }
    this.renderStats();
    if (this.sel && (this.sel.kind === 'bag' ? loot.bag.includes(this.sel.item) : loot.equipped[this.sel.pos!] === this.sel.item)) {
      const it = this.sel.item;
      this.show(it, this.sel.kind === 'bag' ? loot.compareTarget(it) : null, this.sel.kind === 'eq' ? t('inv_worn') : undefined);
    } else {
      this.sel = null;
      clear(this.detail);
      this.detail.append(h('div.inv-empty', t('inv_pick')));
    }
  }

  private renderStats() {
    const run = this.run;
    const st = run.player.stats;
    const sk = run.action;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const rows: [string, string][] = [
      [t('ist_hp'), `${Math.round(st.maxHp)}`],
      [t('ist_dmg'), pct(st.might)],
      [t('ist_armor'), `${Math.round(st.armor + sk.armorBonus)}`],
      [t('ist_crit'), pct(st.critChance)],
      [t('ist_critd'), '+' + pct(0.6 + st.critDamage)],
      [t('ist_cd'), '−' + pct(1 - st.cooldown)],
      [t('ist_speed'), pct(st.moveSpeed)],
      [t('ist_aspd'), '+' + pct(sk.buff.atkSpeed + (run.loot.totals.atkSpeed ?? 0))],
      [t('ist_regen'), `${st.regen.toFixed(1)}/${t('sec')}`],
      [L(sk.cls.res.name), `${Math.round(sk.resMax)}`],
    ];
    clear(this.stats);
    this.stats.append(h('div.inv-label', t('inv_stats')), ...rows.map(([a, b]) => h('div.ist', h('span', a), h('b', b))));
  }

  private select(s: { kind: 'bag' | 'eq'; item: Item; pos?: EquipPos }) {
    this.sel = s;
    this.render();
  }

  private show(it: Item, cmp: Item | null, title?: string) {
    const loot = this.run.loot;
    clear(this.detail);
    this.detail.append(itemCard(it, cmp, title, this.run.player.level));
    if (cmp) this.detail.append(itemCard(cmp, null, t('inv_worn'), this.run.player.level));
    const sel = this.sel?.item === it ? this.sel : null;
    if (!sel) return;
    const acts = h('div.inv-acts');
    if (sel.kind === 'bag') {
      acts.append(
        h('button.btn.small.primary', { onclick: () => loot.equip(it) && this.after() }, t('inv_equip')),
        h('button.btn.small', { onclick: () => (loot.dropFromBag(it), this.after()) }, t('inv_drop')),
        h('button.btn.small.danger', { onclick: () => (loot.sell(it), this.after()) }, t('inv_sell', { n: sellPrice(it) })),
      );
    } else {
      acts.append(h('button.btn.small', { onclick: () => loot.unequip(sel.pos!) && this.after() }, t('inv_unequip')));
    }
    this.detail.append(acts);
  }

  private after() {
    this.sel = null;
    this.render();
  }
}
