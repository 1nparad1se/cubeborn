import type { Profile } from '../meta/Profile';
import type { CharSave } from '../meta/Characters';
import { CHAR_BAG, canLearn, groupOf, learn, pointsEarned, resetSkills } from '../meta/Characters';
import { PROG, STONE_TIERS, TIER_OF } from '../config/progression';
import { classDef } from '../game/action/classes';
import { TRIPOD_LEVELS } from '../game/action/types';
import { tripodsFor } from '../game/action/tripods';
import { EQUIP_POS, baseIcon, gearTotals, itemName, itemStats, reqLevel, score, slotOf, RARITY_COLOR, RARITY_HEX, type EquipPos, type Item } from '../game/arpg/Gear';
import { craftMax, craftStones, dismantle, dismantleValue, enhance, enhanceCost, type Wallet } from '../game/arpg/Forge';
import { RARITIES } from '../data/types';
import { affixText, itemCard } from './InventoryUi';
import { skillImg } from './SkillsScreen';
import { iconImg } from './icons';
import { h, clear, hex } from './dom';
import { t, L, getLang } from '../i18n';
import { tr } from './ClassPreview';
import { fmtNum } from './format';
import './progress.css';

/**
 * Main-menu screens of the active character: Hero (level, stats, skills and tripods),
 * Inventory (equipment, 60-slot bag, dismantling) and Forge (enhancement, stone crafting, drop rates).
 */

type Sfx = (id: string) => void;
const KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];

export const tierName = (tier: number) => t('rar_' + RARITIES[tier]);
export const tierColor = (tier: number) => RARITY_COLOR[RARITIES[tier]];

/** Pixel icon of an enhancement stone of a tier. */
export function stoneImg(tier: number, cls = 'icon'): HTMLImageElement {
  return iconImg('enh_stone', RARITY_HEX[RARITIES[tier]], cls);
}

function stoneChip(tier: number, n: number, have?: number): HTMLElement {
  const short = have !== undefined && have < n;
  return h('span.stone-chip' + (short ? '.no' : ''), { style: `--rc:${tierColor(tier)}`, title: tierName(tier) }, stoneImg(tier), h('b', fmtNum(n)), have !== undefined ? h('small', '/' + fmtNum(have)) : null);
}

function goldChip(n: number, have?: number): HTMLElement {
  return h('span.stone-chip.gold' + (have !== undefined && have < n ? '.no' : ''), h('i.ic-coin'), h('b', fmtNum(n)));
}

function noChar(): HTMLElement {
  return h('div.pg-none', h('div.pg-none-ic', stoneImg(2, 'icon')), h('p', t('ch_none')));
}

/** Small "are you sure?" inline confirm that replaces a button. */
function confirmBtn(label: string, question: string, cls: string, onYes: () => void, rerender: () => void): HTMLElement {
  const wrap = h('span.pg-confirm');
  const ask = () => {
    clear(wrap);
    wrap.append(
      h('span.pg-q', question),
      h('button.btn.small.danger', { onclick: onYes }, tr('Да', 'Yes')),
      h('button.btn.small', { onclick: () => rerender() }, tr('Нет', 'No')),
    );
  };
  wrap.append(h('button.btn.small' + cls, { onclick: ask }, label));
  return wrap;
}

function itemCell(it: Item, o: { sel?: boolean; up?: boolean; heroLv: number; onclick?: () => void; ondbl?: () => void; onctx?: () => void }): HTMLElement {
  return h(
    'div.inv-slot' + (o.sel ? '.sel' : '') + (o.up ? '.up' : ''),
    {
      style: `--rc:${RARITY_COLOR[it.rarity]}`,
      onclick: o.onclick,
      ondblclick: o.ondbl,
      oncontextmenu: (e: Event) => {
        e.preventDefault();
        o.onctx?.();
      },
    },
    iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon'),
    it.enh ? h('i.inv-enh', '+' + it.enh) : null,
    o.up ? h('i.inv-up', '▲') : null,
    reqLevel(it) > o.heroLv ? h('i.inv-req', String(reqLevel(it))) : null,
  );
}

function compareTarget(c: CharSave, it: Item): Item | null {
  const ps = EQUIP_POS.filter((p) => slotOf(p) === it.slot);
  if (ps.some((p) => !c.equipped[p])) return null;
  return c.equipped[ps[0]] ?? null;
}

/** Hero stats from class base, level growth and worn gear. */
function heroStats(c: CharSave) {
  const cls = classDef(c.cls);
  const lv = c.level - 1;
  const m = cls.basic.ranged ? 0 : 1;
  const g = PROG.perLevel;
  const gear = gearTotals(Object.values(c.equipped), cls.baseHp).mods as Record<string, number | undefined>;
  const hpPer = cls.baseHp * (g.maxHpPct + m * 0.02);
  const pct = (v: number) => Math.round(v * 1000) / 10 + '%';
  return [
    { k: tr('Здоровье', 'Health'), v: fmtNum(Math.round(cls.baseHp + hpPer * lv + (gear.maxHp ?? 0))), per: '+' + Math.round(hpPer) },
    { k: tr('Сила', 'Might'), v: '+' + pct(lv * g.might + (gear.might ?? 0)), per: '+' + pct(g.might) },
    { k: tr('Броня', 'Armor'), v: String(Math.round(cls.armor + lv * (g.armor + m * 0.15) + (gear.armor ?? 0))), per: '+' + Math.round((g.armor + m * 0.15) * 100) / 100 },
    { k: tr('Регенерация', 'Regen'), v: ((0.3 + lv * g.regen) * (1 + m) + (gear.regen ?? 0)).toFixed(1) + '/' + t('sec'), per: '+' + (g.regen * (1 + m)).toFixed(2) },
    { k: tr('Крит. шанс', 'Crit chance'), v: pct(gear.critChance ?? 0), per: '' },
    { k: tr('Скорость', 'Move speed'), v: '+' + pct(gear.moveSpeed ?? 0), per: '' },
  ];
}

// =================================================================== hero
export function heroScreen(profile: Profile, sfx: Sfx): HTMLElement {
  const root = h('div.pg-screen.pg-hero');
  let sel = 0;
  const render = () => {
    clear(root);
    const c = profile.char;
    if (!c) return void root.append(noChar());
    const cls = classDef(c.cls);
    const need = PROG.xpForLevel(c.level);
    const maxed = c.level >= PROG.maxLevel;
    const save = () => {
      profile.save();
      render();
    };

    // --- left: identity, level, stats
    const xpPct = maxed ? 100 : Math.min(100, (c.xp / need) * 100);
    const head = h(
      'div.pg-card.pg-ident',
      { style: `--cc:${hex(cls.color)}` },
      h('div.pg-portrait', skillImg(cls.skills[0].icon, cls.color, 'icon')),
      h('div.pg-id', h('div.pg-name', c.name), h('div.pg-cls', `${L(cls.name)} · ${L(groupOf(c.cls).name)}`)),
      h('div.pg-lvl', h('small', tr('Уровень', 'Level')), h('b', String(c.level)), h('small', '/ ' + PROG.maxLevel)),
      h(
        'div.pg-xp',
        h('div.pg-xp-bar', h('i', { style: `width:${xpPct}%` })),
        h('div.pg-xp-t', maxed ? tr('Максимальный уровень', 'Max level') : `${fmtNum(Math.floor(c.xp))} / ${fmtNum(need)} XP`),
      ),
    );
    const stats = h(
      'div.pg-card.pg-stats',
      h('div.pg-h', tr('Характеристики', 'Stats'), h('small', tr('рост за уровень', 'per level'))),
      ...heroStats(c).map((s) => h('div.pg-stat', h('span', s.k), h('b', s.v), h('em', s.per))),
      h('div.pg-note', tr(`Каждый уровень повышает здоровье, силу, броню и регенерацию. После ${PROG.autoSkillLevels}-го уровня каждый уровень даёт очко навыка.`, `Every level raises health, might, armor and regen. After level ${PROG.autoSkillLevels} each level gives a skill point.`)),
    );
    const spent = c.skills.reduce((s, l, i) => s + Math.max(0, l - (c.level >= i + 1 ? 1 : 0)), 0);
    const pts = h(
      'div.pg-card.pg-points' + (c.points > 0 ? '.has' : ''),
      h('div.pg-pt-n', String(c.points)),
      h('div', h('b', tr('Очки навыков', 'Skill points')), h('small', tr(`получено ${pointsEarned(c.level)} · вложено ${spent}`, `earned ${pointsEarned(c.level)} · spent ${spent}`))),
      confirmBtn(tr('Сбросить навыки', 'Reset skills'), tr('Вернуть все очки и трипод-выборы?', 'Refund all points and tripods?'), '', () => {
        resetSkills(c);
        sfx('ui');
        save();
      }, render),
    );
    const left = h('div.pg-left', head, pts, stats);

    // --- skill list
    const list = h('div.pg-card.pg-skills', h('div.pg-h', tr('Навыки', 'Skills'), h('small', tr(`макс. уровень ${PROG.skillMax} · триподы на ${TRIPOD_LEVELS.join(' и ')}`, `max level ${PROG.skillMax} · tripods at ${TRIPOD_LEVELS.join(' and ')}`))));
    cls.skills.slice(0, 8).forEach((s, i) => {
      const lv = c.skills[i];
      const pips = h('div.pg-pips');
      for (let k = 0; k < PROG.skillMax; k++) pips.append(h('i' + (k < lv ? '.on' : '') + (TRIPOD_LEVELS.includes(k + 1) ? '.tp' : '')));
      const triOpen = TRIPOD_LEVELS.filter((n) => lv >= n).length;
      const triPicked = c.tri[i].filter((x, tier) => x >= 0 && lv >= TRIPOD_LEVELS[tier]).length;
      list.append(
        h(
          'div.pg-sk' + (lv === 0 ? '.locked' : '') + (sel === i ? '.sel' : ''),
          { style: `--sc:${hex(s.color)}`, onclick: () => ((sel = i), sfx('ui'), render()) },
          h('span.pg-key', KEYS[i]),
          h('div.pg-sk-ic', skillImg(s.icon, lv ? s.color : 0x556070, 'icon')),
          h('div.pg-sk-n', h('b', L(s.name)), lv ? pips : h('small.pg-lock', tr(`Открывается на ${i + 1} ур.`, `Unlocks at level ${i + 1}`))),
          h('span.pg-sk-lv', lv ? `${lv}/${PROG.skillMax}` : '🔒'),
          triOpen > triPicked ? h('span.pg-tri-dot', { title: tr('Можно выбрать трипод', 'Tripod available') }, '◆') : null,
          h(
            'button.pg-plus',
            {
              disabled: !canLearn(c, i),
              title: tr('Вложить очко', 'Spend a point'),
              onclick: (e: Event) => {
                e.stopPropagation();
                if (learn(c, i)) {
                  sfx('select');
                  sel = i;
                  save();
                }
              },
            },
            '+',
          ),
        ),
      );
    });

    // --- detail of the selected skill with tripods
    const s = cls.skills[sel];
    const lv = c.skills[sel];
    const detail = h(
      'div.pg-card.pg-skd',
      { style: `--sc:${hex(s.color)}` },
      h('div.pg-skd-h', h('div.pg-sk-ic.big', skillImg(s.icon, s.color, 'icon')), h('div', h('div.pg-name', L(s.name)), h('div.pg-cls', `${KEYS[sel]} · ${lv ? tr(`уровень ${lv}/${PROG.skillMax}`, `level ${lv}/${PROG.skillMax}`) : tr(`открывается на ${sel + 1} ур.`, `unlocks at level ${sel + 1}`)}`))),
      h('div.pg-desc', L(s.desc)),
      lv > 0 && lv < PROG.skillMax ? h('div.pg-note', tr('Каждый уровень навыка: урон +12%.', 'Each skill level: damage +12%.')) : null,
    );
    tripodsFor(s).forEach((opts, tier) => {
      const need = TRIPOD_LEVELS[tier];
      const open = lv >= need;
      const col = h('div.pg-tier' + (open ? '' : '.locked'), h('div.pg-tier-h', tr(`Трипод ${tier + 1}`, `Tripod ${tier + 1}`), h('small', open ? tr('выберите один', 'pick one') : tr(`нужен ${need} ур. навыка`, `needs skill level ${need}`))));
      opts.forEach((tp, k) => {
        const on = open && c.tri[sel][tier] === k;
        col.append(
          h(
            'button.pg-tri' + (on ? '.on' : ''),
            {
              disabled: !open,
              onclick: () => {
                c.tri[sel][tier] = k;
                sfx('select');
                save();
              },
            },
            h('b', L(tp.name)),
            h('small', L(tp.desc)),
          ),
        );
      });
      detail.append(col);
    });
    root.append(left, list, detail);
  };
  render();
  return root;
}

// =================================================================== inventory
export function inventoryScreen(profile: Profile, sfx: Sfx): HTMLElement {
  const root = h('div.pg-screen.pg-inv');
  let sel: { item: Item; pos?: EquipPos } | null = null;
  let flash = '';
  const render = () => {
    clear(root);
    const c = profile.char;
    if (!c) return void root.append(noChar());
    const save = () => {
      profile.save();
      render();
    };
    const w: Wallet = { stones: c.stones, gold: profile.data.gold };
    const equip = (it: Item) => {
      const i = c.bag.indexOf(it);
      if (i < 0) return;
      if (reqLevel(it) > c.level) return sfx('uiBack');
      const ps = EQUIP_POS.filter((p) => slotOf(p) === it.slot);
      const pos = ps.find((p) => !c.equipped[p]) ?? ps[0];
      const old = c.equipped[pos];
      c.bag.splice(i, 1);
      c.equipped[pos] = it;
      if (old) c.bag.splice(i, 0, old);
      sel = { item: it, pos };
      sfx('select');
      save();
    };
    const unequip = (pos: EquipPos) => {
      const it = c.equipped[pos];
      if (!it) return;
      if (c.bag.length >= CHAR_BAG) {
        flash = t('inv_full');
        return void (sfx('uiBack'), render());
      }
      delete c.equipped[pos];
      c.bag.unshift(it);
      sel = { item: it };
      sfx('ui');
      save();
    };
    const scrap = (items: Item[]) => {
      const got = new Array(STONE_TIERS).fill(0);
      for (const it of items) {
        const i = c.bag.indexOf(it);
        if (i < 0) continue;
        c.bag.splice(i, 1);
        const v = dismantle(it, w);
        got[v.tier] += v.stones;
      }
      flash = tr('Получено: ', 'Gained: ') + got.map((n, tier) => (n ? `${n} × ${tierName(tier)}` : '')).filter(Boolean).join(', ');
      sel = null;
      sfx('coin');
      save();
    };

    // paper doll
    const doll = h('div.inv-doll');
    for (const pos of EQUIP_POS) {
      const it = c.equipped[pos];
      doll.append(
        it
          ? itemCell(it, { sel: sel?.item === it, heroLv: c.level, onclick: () => ((sel = { item: it, pos }), render()), ondbl: () => unequip(pos), onctx: () => unequip(pos) })
          : h('div.inv-slot.eq.empty', { title: t('slot_' + slotOf(pos)) }, h('span.inv-ph', t('slot_' + slotOf(pos)))),
      );
    }
    const left = h('div.pg-left', h('div.pg-card', h('div.pg-h', c.name, h('small', t('ch_lv', { n: c.level }))), doll), h('div.pg-card.pg-stats', h('div.pg-h', tr('Характеристики', 'Stats')), ...heroStats(c).map((s) => h('div.pg-stat', h('span', s.k), h('b', s.v)))));

    // bag
    const bag = h('div.inv-bag.pg-bag');
    const order = [...c.bag].sort((a, b) => TIER_OF[b.rarity] - TIER_OF[a.rarity] || b.ilvl - a.ilvl);
    for (let i = 0; i < CHAR_BAG; i++) {
      const it = order[i];
      if (!it) {
        bag.append(h('div.inv-slot.empty'));
        continue;
      }
      const up = reqLevel(it) <= c.level && score(it) > score(compareTarget(c, it)) + 0.05;
      bag.append(itemCell(it, { sel: sel?.item === it, up, heroLv: c.level, onclick: () => ((sel = { item: it }), render()), ondbl: () => equip(it), onctx: () => equip(it) }));
    }
    // bulk dismantle by tier
    const bulk = h('div.pg-bulk', h('div.pg-h', tr('Разобрать всё', 'Dismantle all'), h('small', tr('кроме усиленных', 'except enhanced'))));
    for (let tier = 0; tier < STONE_TIERS; tier++) {
      const items = c.bag.filter((it) => TIER_OF[it.rarity] === tier && !(it.enh ?? 0));
      if (!items.length) continue;
      const gain = items.reduce((s, it) => s + dismantleValue(it).stones, 0);
      bulk.append(
        h(
          'div.pg-bulk-row',
          { style: `--rc:${tierColor(tier)}` },
          h('span.pg-tn', `${tierName(tier)} × ${items.length}`),
          h('span.pg-arrow', '→'),
          stoneChip(tier, gain),
          confirmBtn(tr('Разобрать', 'Dismantle'), tr(`Разобрать ${items.length} шт.?`, `Dismantle ${items.length}?`), '', () => scrap(items), render),
        ),
      );
    }
    if (bulk.childElementCount === 1) bulk.append(h('div.pg-note', tr('Нечего разбирать.', 'Nothing to dismantle.')));
    const wallet = h('div.pg-wallet', ...c.stones.map((n, tier) => stoneChip(tier, n)));
    const mid = h(
      'div.pg-mid',
      h('div.pg-card', h('div.pg-h', t('inv_bag'), h('small', `${c.bag.length} / ${CHAR_BAG}`)), bag, flash ? h('div.pg-flash', flash) : null, h('div.inv-hint', tr('ПКМ / двойной клик — надеть или снять', 'Right click / double click — equip or unequip'))),
      h('div.pg-card', h('div.pg-h', tr('Камни усиления', 'Enhancement stones')), wallet, bulk),
    );
    flash = '';

    // detail
    const detail = h('div.pg-card.pg-detail');
    const it = sel?.item;
    const worn = it ? EQUIP_POS.find((p) => c.equipped[p] === it) : undefined;
    if (it && (worn || c.bag.includes(it))) {
      const cmp = worn ? null : compareTarget(c, it);
      detail.append(itemCard(it, cmp, worn ? t('inv_worn') : undefined, c.level));
      if (cmp) detail.append(itemCard(cmp, null, t('inv_worn'), c.level));
      const acts = h('div.inv-acts');
      if (worn) acts.append(h('button.btn.small', { onclick: () => unequip(worn) }, t('inv_unequip')));
      else {
        const v = dismantleValue(it);
        acts.append(
          h('button.btn.small.primary', { disabled: reqLevel(it) > c.level, onclick: () => equip(it) }, reqLevel(it) > c.level ? t('inv_req_level', { n: reqLevel(it) }) : t('inv_equip')),
          (it.enh ?? 0) > 0 || TIER_OF[it.rarity] >= 3
            ? confirmBtn(tr('Разобрать', 'Dismantle'), tr('Точно разобрать?', 'Really dismantle?'), '.danger', () => scrap([it]), render)
            : h('button.btn.small.danger', { onclick: () => scrap([it]) }, tr('Разобрать', 'Dismantle')),
        );
        acts.append(h('div.pg-gain', tr('Даст: ', 'Gives: '), stoneChip(v.tier, v.stones)));
      }
      detail.append(acts);
    } else {
      sel = null;
      detail.append(h('div.inv-empty', t('inv_pick')));
    }
    root.append(left, mid, detail);
  };
  render();
  return root;
}

// =================================================================== forge
type ForgeTab = 'enhance' | 'stones' | 'rates';

export function forgeScreen(profile: Profile, sfx: Sfx, onGold: () => void, start: ForgeTab = 'enhance'): HTMLElement {
  const root = h('div.pg-screen.pg-forge');
  let tab: ForgeTab = start;
  let sel: Item | null = null;
  let result: { kind: string; text: string; n: number } | null = null;
  let resN = 0;
  const render = () => {
    clear(root);
    const c = profile.char;
    const tabs = h(
      'div.pg-tabs',
      ...(
        [
          ['enhance', tr('Усиление', 'Enhance')],
          ['stones', tr('Камни', 'Stones')],
          ['rates', tr('Шансы выпадения', 'Drop rates')],
        ] as [ForgeTab, string][]
      ).map(([id, label]) => h('button.btn.small' + (tab === id ? '.primary' : ''), { onclick: () => ((tab = id), (result = null), sfx('ui'), render()) }, label)),
    );
    root.append(tabs);
    if (tab === 'rates') return void root.append(ratesPanel());
    if (!c) return void root.append(noChar());
    const w: Wallet = { stones: c.stones, gold: profile.data.gold };
    const commit = () => {
      profile.data.gold = w.gold;
      profile.save();
      onGold();
      render();
    };
    const wallet = h('div.pg-wallet', ...c.stones.map((n, tier) => stoneChip(tier, n)), goldChip(profile.data.gold));
    if (tab === 'stones') return void root.append(stonesPanel(c, w, sfx, commit), h('div.pg-card', h('div.pg-h', tr('Кошелёк', 'Wallet')), wallet));

    // ---- enhance
    const all: { it: Item; worn: boolean }[] = [
      ...EQUIP_POS.map((p) => c.equipped[p]).filter((x): x is Item => !!x).map((it) => ({ it, worn: true })),
      ...[...c.bag].sort((a, b) => TIER_OF[b.rarity] - TIER_OF[a.rarity] || (b.enh ?? 0) - (a.enh ?? 0) || b.ilvl - a.ilvl).map((it) => ({ it, worn: false })),
    ];
    if (!sel || !all.some((x) => x.it === sel)) sel = all[0]?.it ?? null;
    const list = h('div.pg-card.pg-elist', h('div.pg-h', tr('Предметы', 'Items'), h('small', tr('надетые сверху', 'worn first'))));
    const grid = h('div.pg-egrid');
    for (const { it, worn } of all) {
      const cell = itemCell(it, { sel: it === sel, heroLv: 99, onclick: () => ((sel = it), (result = null), sfx('ui'), render()) });
      if (worn) cell.classList.add('worn');
      grid.append(cell);
    }
    if (!all.length) grid.append(h('div.inv-empty', tr('Нет предметов', 'No items')));
    list.append(grid);

    const main = h('div.pg-card.pg-anvil');
    if (sel) {
      const it = sel;
      const cost = enhanceCost(it);
      const k = it.enh ?? 0;
      const col = RARITY_COLOR[it.rarity];
      main.append(
        h(
          'div.pg-anvil-top',
          { style: `--rc:${col}` },
          h('div.pg-big-ic' + (result ? '.res-' + result.kind : ''), { 'data-n': String(resN) }, iconImg(baseIcon(it), RARITY_HEX[it.rarity], 'icon'), h('i.pg-big-enh', '+' + k)),
          h('div.pg-anvil-name', h('b', { style: `color:${col}` }, (k ? `+${k} ` : '') + itemName(it, getLang())), h('small', `${t('rar_' + it.rarity)} · ${t('inv_ilvl', { n: it.ilvl })} · +${k} / +${PROG.enhMax}`)),
        ),
      );
      const enhBar = h('div.pg-enh-bar');
      for (let i = 0; i < PROG.enhMax; i++) enhBar.append(h('i' + (i < k ? '.on' : '') + (i === k ? '.next' : '')));
      main.append(enhBar);
      if (result) main.append(h('div.pg-result.' + result.kind, { 'data-n': String(resN) }, result.text));
      if (cost) {
        // stat preview before → after
        const next: Item = { ...it, enh: k + 1 };
        const a = itemStats(it);
        const b = itemStats(next);
        main.append(
          h(
            'div.pg-preview',
            h('div.pg-h', tr('Характеристики', 'Stats'), h('small', `+${k} → +${k + 1}`)),
            ...a.map((s, i) => h('div.pg-pv', h('span', affixText(s)), h('em', '→'), h('b', affixText(b[i])))),
          ),
        );
        const base = PROG.enhChance(k);
        main.append(
          h(
            'div.pg-cost',
            h('div.pg-row', h('span', tr('Стоимость', 'Cost')), stoneChip(cost.tier, cost.stones, c.stones[cost.tier]), goldChip(cost.gold, profile.data.gold)),
            h(
              'div.pg-row',
              h('span', tr('Шанс успеха', 'Success chance')),
              h('b.pg-chance', Math.round(cost.chance * 1000) / 10 + '%'),
              (it.pity ?? 0) > 0 ? h('small.pg-pity', tr(`база ${Math.round(base * 100)}% + опыт мастера ×${it.pity} (+${Math.round((cost.chance - base) * 1000) / 10}%)`, `base ${Math.round(base * 100)}% + artisan's pity ×${it.pity} (+${Math.round((cost.chance - base) * 1000) / 10}%)`)) : null,
            ),
            h('div.pg-note', tr(`Усиление предмета тратит камни его ранга («${t('rar_' + it.rarity)}»). Неудача сохраняет уровень и повышает шанс следующей попытки.`, `Enhancing uses stones of the item's tier (“${t('rar_' + it.rarity)}”). A failure keeps the level and raises the next chance.`)),
          ),
        );
        const can = c.stones[cost.tier] >= cost.stones && profile.data.gold >= cost.gold;
        main.append(
          h(
            'button.btn.primary.big.pg-go',
            {
              disabled: !can,
              onclick: () => {
                const r = enhance(it, w);
                resN++;
                if (r === 'ok') {
                  result = { kind: 'ok', text: tr(`Успех! +${it.enh}`, `Success! +${it.enh}`), n: resN };
                  sfx('levelup');
                } else if (r === 'fail') {
                  result = { kind: 'fail', text: tr('Неудача… шанс следующей попытки вырос', 'Failed… the next chance is higher'), n: resN };
                  sfx('denied');
                } else {
                  result = { kind: 'fail', text: r === 'stones' ? tr('Не хватает камней', 'Not enough stones') : tr('Не хватает золота', 'Not enough gold'), n: resN };
                  sfx('uiBack');
                }
                commit();
              },
            },
            can ? tr('Усилить', 'Enhance') : c.stones[cost.tier] < cost.stones ? tr('Не хватает камней', 'Not enough stones') : tr('Не хватает золота', 'Not enough gold'),
          ),
        );
      } else main.append(h('div.pg-result.ok', tr('Максимальное усиление', 'Fully enhanced')));
    } else main.append(h('div.inv-empty', tr('Нет предметов для усиления', 'Nothing to enhance')));
    root.append(h('div.pg-forge-body', list, main, h('div.pg-card.pg-fwallet', h('div.pg-h', tr('Кошелёк', 'Wallet')), wallet)));
  };
  render();
  return root;
}

function stonesPanel(c: CharSave, w: Wallet, sfx: Sfx, commit: () => void): HTMLElement {
  const row = h('div.pg-card.pg-stones', h('div.pg-h', tr('Камни усиления', 'Enhancement stones'), h('small', tr(`${PROG.craftRatio} камней ранга → 1 камень следующего`, `${PROG.craftRatio} stones of a tier → 1 of the next`))));
  const line = h('div.pg-sline');
  for (let tier = 0; tier < STONE_TIERS; tier++) {
    if (tier > 0) {
      const n = craftMax(w, tier);
      const g = PROG.craftGold[tier - 1];
      const craft = (k: number) => {
        const made = craftStones(w, tier, k);
        sfx(made ? 'coin' : 'uiBack');
        commit();
      };
      line.append(
        h(
          'div.pg-craft',
          h('div.pg-craft-r', `${PROG.craftRatio} → 1`),
          h('div.pg-craft-g', h('i.ic-coin'), fmtNum(g)),
          h('button.btn.small', { disabled: n < 1, onclick: () => craft(1) }, tr('Создать 1', 'Craft 1')),
          h('button.btn.small', { disabled: n < 1, onclick: () => craft(n) }, tr(`Всё (${n})`, `Max (${n})`)),
          h('div.pg-craft-arrow', '➜'),
        ),
      );
    }
    line.append(
      h(
        'div.pg-stone',
        { style: `--rc:${tierColor(tier)}` },
        stoneImg(tier, 'icon'),
        h('b', fmtNum(c.stones[tier])),
        h('span', tierName(tier)),
      ),
    );
  }
  row.append(line, h('div.pg-note', tr('Камни выпадают при разборе предметов того же ранга. Камни у каждого героя свои, золото — общее.', 'Stones come from dismantling items of the same tier. Each hero has own stones; gold is shared.')));
  return row;
}

function ratesPanel(): HTMLElement {
  const kinds: [string, string, keyof typeof PROG.rarityBonus][] = [
    ['normal', tr('Обычный враг', 'Normal enemy'), 'normal'],
    ['fast', tr('Быстрый', 'Fast'), 'normal'],
    ['ranged', tr('Стрелок', 'Ranged'), 'normal'],
    ['tank', tr('Танк', 'Tank'), 'normal'],
    ['elite', tr('Элита', 'Elite'), 'elite'],
    ['miniboss', tr('Мини-босс', 'Miniboss'), 'miniboss'],
    ['boss', tr('Босс', 'Boss'), 'boss'],
  ];
  const dist = (cat: keyof typeof PROG.rarityBonus) => {
    const b = PROG.rarityBonus[cat];
    const wts = PROG.rarityWeights.map((x, i) => (i === 4 && !PROG.mythicFrom.includes(cat) ? 0 : x * (1 + b * i)));
    const sum = wts.reduce((a, x) => a + x, 0);
    return wts.map((x) => x / sum);
  };
  const pct = (v: number) => (v === 0 ? '—' : v >= 0.1 ? Math.round(v * 1000) / 10 + '%' : Math.round(v * 10000) / 100 + '%');
  const table = h(
    'table.pg-rates',
    h('tr', h('th', tr('Враг', 'Enemy')), h('th', tr('Шанс предмета', 'Item chance')), ...RARITIES.map((_, i) => h('th', { style: `color:${tierColor(i)}` }, tierName(i)))),
    ...kinds.map(([k, name, cat]) => {
      const rolls = k === 'miniboss' ? PROG.bossRolls.miniboss : k === 'boss' ? PROG.bossRolls.boss : 1;
      return h('tr', h('td', name), h('td', pct(PROG.dropChance[k]) + (rolls > 1 ? ` ×${rolls}` : '')), ...dist(cat).map((v, i) => h('td', { style: `color:${tierColor(i)}` }, pct(v))));
    }),
  );
  return h(
    'div.pg-card.pg-ratebox',
    h('div.pg-h', tr('Шансы выпадения', 'Drop rates'), h('small', tr('ранг предмета при выпадении', 'tier of a dropped item'))),
    table,
    h('div.pg-note', tr('Мифические предметы выпадают только с элиты и боссов. Уровень предмета равен уровню зоны.', 'Mythic items only drop from elites and bosses. Item level equals the zone level.')),
  );
}
