import type { Profile } from '../meta/Profile';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { EQUIP_POS, baseIcon, itemStats, makeItem, rollRarity, sellPrice, score, slotOf, RARITY_COLOR, RARITY_HEX, type AffixStat, type EquipPos, type Item } from '../game/arpg/Gear';
import { RARITIES as RARITIES_ORDER } from '../data/types';
import { affixText, itemCard } from './InventoryUi';
import { h, clear } from './dom';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import { fmtNum } from './format';

const SHOP_SIZE = 8;
const REFRESH_COST = 25;

/** Price of an item in the shop. */
export function buyPrice(it: Item): number {
  return sellPrice(it) * 5;
}

/** Item level the shop sells at: follows the best gear the player has found. */
function shopIlvl(p: Profile): number {
  let best = 3;
  for (const it of p.data.gear.bag) best = Math.max(best, it.ilvl);
  for (const set of Object.values(p.data.gear.equipped)) for (const it of Object.values(set)) if (it) best = Math.max(best, it.ilvl);
  return best;
}

/** Fresh shop stock (common to epic, a legendary now and then). */
export function rollShop(p: Profile): Item[] {
  const ilvl = shopIlvl(p);
  const out: Item[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) out.push(makeItem(Math.random, Math.max(1, ilvl - 1 + Math.floor(Math.random() * 3)), rollRarity(Math.random, 0.9)));
  return out;
}

type Sel = { kind: 'stash' | 'eq' | 'shop'; item: Item; pos?: EquipPos };

/**
 * Main-menu screen for equipment: pick a hero, dress them from the stash of every item
 * found, sell what is not needed, and buy new pieces in the shop for gold.
 */
export function armoryScreen(profile: Profile, sfx: (id: string) => void, heroId: string, onHero: (id: string) => void, onGold: () => void): HTMLElement {
  let hero = profile.isHeroUnlocked(heroId) ? heroId : (HEROES.find((x) => profile.isHeroUnlocked(x.id))?.id ?? HEROES[0].id);
  let tab: 'gear' | 'shop' = 'gear';
  let sel: Sel | null = null;
  let filter: 'all' | EquipPos = 'all';
  const g = profile.data.gear;
  if (!g.shop || !g.shop.length) {
    g.shop = rollShop(profile);
    profile.save();
  }
  const root = h('div.armory');

  const worn = () => (g.equipped[hero] ??= {});
  const compareTarget = (it: Item): Item | null => {
    const ps = EQUIP_POS.filter((p) => slotOf(p) === it.slot);
    const w = worn();
    if (ps.some((p) => !w[p])) return null;
    return w[ps[0]] ?? null;
  };
  const save = () => {
    profile.save();
    onGold();
    render();
  };
  const equip = (it: Item) => {
    const i = g.bag.indexOf(it);
    if (i < 0) return;
    const ps = EQUIP_POS.filter((p) => slotOf(p) === it.slot);
    const w = worn();
    const pos = ps.find((p) => !w[p]) ?? ps[0];
    const old = w[pos];
    g.bag.splice(i, 1);
    w[pos] = it;
    if (old) g.bag.splice(i, 0, old);
    sfx('select');
    sel = null;
    save();
  };
  const unequip = (pos: EquipPos) => {
    const w = worn();
    const it = w[pos];
    if (!it) return;
    delete w[pos];
    g.bag.unshift(it);
    sfx('ui');
    sel = null;
    save();
  };
  const sell = (it: Item) => {
    const i = g.bag.indexOf(it);
    if (i < 0) return;
    g.bag.splice(i, 1);
    profile.data.gold += sellPrice(it);
    sfx('coin');
    sel = null;
    save();
  };
  const buy = (it: Item) => {
    const price = buyPrice(it);
    if (profile.data.gold < price) {
      sfx('uiBack');
      return;
    }
    profile.data.gold -= price;
    g.shop!.splice(g.shop!.indexOf(it), 1);
    g.bag.unshift(it);
    sfx('coin');
    sel = null;
    save();
  };
  const refresh = () => {
    if (profile.data.gold < REFRESH_COST) return;
    profile.data.gold -= REFRESH_COST;
    g.shop = rollShop(profile);
    sel = null;
    sfx('ui');
    save();
  };

  const cell = (it: Item, s: Sel, extra?: HTMLElement | null) =>
    h(
      'div.inv-slot' + (sel?.item === it ? '.sel' : '') + (s.kind === 'stash' && score(it) > score(compareTarget(it)) + 0.05 ? '.up' : ''),
      {
        style: `--rc:${RARITY_COLOR[it.rarity]}`,
        onclick: () => {
          sel = s;
          render();
        },
        ondblclick: () => (s.kind === 'stash' ? equip(it) : s.kind === 'eq' ? unequip(s.pos!) : buy(it)),
        oncontextmenu: (e: Event) => {
          e.preventDefault();
          if (s.kind === 'stash') equip(it);
          else if (s.kind === 'eq') unequip(s.pos!);
        },
      },
      iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon'),
      s.kind === 'stash' && score(it) > score(compareTarget(it)) + 0.05 ? h('i.inv-up', '▲') : null,
      extra ?? null,
    );

  function render() {
    clear(root);
    // hero picker
    const heroes = h('div.arm-heroes');
    for (const def of HEROES) {
      const ok = profile.isHeroUnlocked(def.id);
      const n = Object.values(g.equipped[def.id] ?? {}).filter(Boolean).length;
      heroes.append(
        h(
          'button.arm-hero' + (def.id === hero ? '.sel' : '') + (ok ? '' : '.locked'),
          {
            disabled: !ok,
            onclick: () => {
              hero = def.id;
              onHero(def.id);
              sel = null;
              sfx('ui');
              render();
            },
          },
          h('span', L(def.name)),
          n ? h('small', `${n}/9`) : null,
        ),
      );
    }
    const tabs = h(
      'div.arm-tabs',
      h('button.btn.small' + (tab === 'gear' ? '.primary' : ''), { onclick: () => ((tab = 'gear'), (sel = null), render()) }, t('arm_gear')),
      h('button.btn.small' + (tab === 'shop' ? '.primary' : ''), { onclick: () => ((tab = 'shop'), (sel = null), render()) }, t('arm_shop')),
    );
    // paper doll + totals
    const w = worn();
    const doll = h('div.inv-doll');
    for (const pos of EQUIP_POS) {
      const it = w[pos];
      doll.append(
        it
          ? cell(it, { kind: 'eq', item: it, pos })
          : h('div.inv-slot.eq.empty', { title: t('slot_' + slotOf(pos)) }, h('span.inv-ph', t('slot_' + slotOf(pos)))),
      );
    }
    const sums = new Map<AffixStat, number>();
    for (const pos of EQUIP_POS) if (w[pos]) for (const a of itemStats(w[pos]!)) sums.set(a.stat, (sums.get(a.stat) ?? 0) + a.v);
    const totals = h('div.inv-stats', h('div.inv-label', t('arm_totals')), ...(sums.size ? [...sums].map(([stat, v]) => h('div.ist', h('span', affixText({ stat, v })))) : [h('div.ist.dim', t('arm_none'))]));
    const left = h('div.inv-left', h('div.inv-label', L(HERO_BY_ID[hero].name)), doll, totals);

    // middle: stash or shop
    let mid: HTMLElement;
    if (tab === 'gear') {
      const filters = h('div.arm-filter', ...(['all', 'weapon', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'ring1', 'trinket'] as const).map((f) => h('button.chip' + (filter === f ? '.sel' : ''), { onclick: () => ((filter = f), render()) }, f === 'all' ? t('arm_all') : t('slot_' + slotOf(f)))));
      const items = g.bag
        .filter((it) => filter === 'all' || it.slot === slotOf(filter))
        .sort((a, b) => RARITIES_ORDER.indexOf(b.rarity) - RARITIES_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl);
      const grid = h('div.inv-bag.arm-stash');
      for (const it of items) grid.append(cell(it, { kind: 'stash', item: it }));
      if (!items.length) grid.append(h('div.inv-empty', t('arm_empty')));
      mid = h('div.inv-mid', h('div.inv-label', t('arm_stash', { n: g.bag.length })), filters, grid);
    } else {
      const grid = h('div.inv-bag.arm-shop');
      for (const it of g.shop!) {
        const price = buyPrice(it);
        grid.append(cell(it, { kind: 'shop', item: it }, h('div.arm-price' + (profile.data.gold < price ? '.no' : ''), fmtNum(price))));
      }
      mid = h(
        'div.inv-mid',
        h('div.inv-label', t('arm_shop_title')),
        grid,
        h('button.btn.small', { disabled: profile.data.gold < REFRESH_COST, onclick: refresh }, t('arm_refresh', { n: REFRESH_COST })),
        h('div.inv-hint', t('arm_shop_hint')),
      );
    }

    // detail with comparison and actions
    const detail = h('div.inv-detail');
    if (sel && (sel.kind === 'eq' ? w[sel.pos!] === sel.item : sel.kind === 'stash' ? g.bag.includes(sel.item) : g.shop!.includes(sel.item))) {
      const it = sel.item;
      const cmp = sel.kind === 'eq' ? null : compareTarget(it);
      detail.append(itemCard(it, cmp, sel.kind === 'eq' ? t('inv_worn') : undefined));
      if (cmp) detail.append(itemCard(cmp, null, t('inv_worn')));
      const acts = h('div.inv-acts');
      const s = sel;
      if (s.kind === 'stash') acts.append(h('button.btn.small.primary', { onclick: () => equip(it) }, t('inv_equip')), h('button.btn.small.danger', { onclick: () => sell(it) }, t('inv_sell', { n: sellPrice(it) })));
      else if (s.kind === 'eq') acts.append(h('button.btn.small', { onclick: () => unequip(s.pos!) }, t('inv_unequip')));
      else acts.append(h('button.btn.small.primary', { disabled: profile.data.gold < buyPrice(it), onclick: () => buy(it) }, t('arm_buy', { n: buyPrice(it) })));
      detail.append(acts);
    } else {
      sel = null;
      detail.append(h('div.inv-empty', t('inv_pick')));
    }

    root.append(heroes, tabs, h('div.inv-body', left, mid, detail));
  }
  render();
  return root;
}
