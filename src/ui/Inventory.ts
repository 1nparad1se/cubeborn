import { h, clear } from './dom';
import { itemIcon } from './itemIcons';
import { SLOTS, SLOT_NAME, item, type ItemDef, type Slot } from '../rpg/items';
import { computeStats, equipFromBag, equipToSlot, moveInBag, unequip, type EquipResult, type Gear } from '../rpg/equipment';
import { RACE_BY_ID } from '../rpg/races';

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

/** Stat lines of an item for its tooltip. */
function itemLines(def: ItemDef): string[] {
  const out: string[] = [];
  const w = def.weapon;
  if (w) {
    out.push(`${w.dmgType === 'magic' ? 'Магический' : 'Физический'} урон: ${w.damage}`);
    out.push(`Скорость: удар раз в ${w.interval.toFixed(2)} с (${(1 / w.interval).toFixed(2)}/с)`);
    out.push(`Урон в секунду: ${(w.damage / w.interval).toFixed(1)}`);
    out.push(w.shape === 'projectile' ? `Дальность выстрела: ${w.range}` : `Досягаемость: ${w.range}`);
    if (w.shape === 'sweep') out.push(`Бьёт все цели в полосе шириной ${(w.halfWidth ?? 0.9) * 2}`);
    out.push(def.twoHanded ? 'Двуручное — занимает обе руки' : 'Одноручное — можно взять щит');
  }
  const s = def.stats;
  if (s.physDef) out.push(`Физическая защита: +${s.physDef}`);
  if (s.magicDmg) out.push(`Магический урон: ${pct(s.magicDmg)}`);
  if (s.castSpeed) out.push(`Скорость заклинаний: ${pct(s.castSpeed)}`);
  if (s.atkSpeed) out.push(`Скорость физических атак: ${pct(s.atkSpeed)}`);
  if (s.moveSpeed) out.push(`Скорость передвижения: ${pct(s.moveSpeed)}`);
  return out;
}

/**
 * Inventory and equipment window (I): six equipment slots, the 6 × 4 bag and the character
 * stats. Click a bag item to put it on, click an equipped item to take it off, or drag items
 * between the bag and the slots. Every change goes through the equipment rules (rpg/equipment).
 */
export class Inventory {
  readonly root: HTMLElement;
  private slots = h('div.inv-slots');
  private bag = h('div.inv-bag');
  private stats = h('div.inv-stats');
  private msg = h('div.inv-msg');
  private tip = h('div.inv-tip.hidden');
  private gear: Gear | null = null;
  private race = 'human';
  private name = '';
  onChange: ((g: Gear) => void) | null = null;
  onSfx: ((id: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = h(
      'div.inv.hidden',
      h(
        'div.inv-win',
        h('div.inv-head', h('h2', 'Инвентарь и снаряжение'), h('button.inv-x', { title: 'Закрыть (I / Esc)', onclick: () => this.onClose?.() }, '×')),
        h(
          'div.inv-body',
          h('div.inv-col', h('h3', 'Снаряжение'), this.slots),
          h('div.inv-col', h('h3', 'Сумка'), this.bag, h('p.inv-help', 'Щелчок — надеть / снять. Можно перетаскивать предметы между сумкой и слотами.'), this.msg),
          h('div.inv-col', h('h3', 'Характеристики'), this.stats),
        ),
      ),
      this.tip,
    );
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(gear: Gear, race: string, name: string) {
    this.gear = gear;
    this.race = race;
    this.name = name;
    this.msg.textContent = '';
    this.root.classList.remove('hidden');
    this.render();
  }

  close() {
    this.root.classList.add('hidden');
    this.tip.classList.add('hidden');
  }

  /** Applies a rule result: new gear on success, the reason on failure. */
  private apply(r: EquipResult) {
    if (!r.ok) {
      this.msg.textContent = r.error;
      this.onSfx?.('denied');
      return;
    }
    this.gear = r.gear;
    this.msg.textContent = '';
    this.onSfx?.('select');
    this.onChange?.(r.gear);
    this.render();
  }

  private showTip(def: ItemDef, el: HTMLElement) {
    clear(this.tip);
    this.tip.append(h('b', def.name), h('div.inv-tip-type', def.armorClass ? `${def.type} · ${def.armorClass} броня` : def.type), ...itemLines(def).map((l) => h('div', l)), h('p', def.desc));
    this.tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const host = this.root.getBoundingClientRect();
    this.tip.style.left = `${Math.round(r.right - host.left + 8)}px`;
    this.tip.style.top = `${Math.round(r.top - host.top)}px`;
  }

  private cell(id: string | null, cls: string, label: string, data: Record<string, string>, onClick: () => void): HTMLElement {
    const def = item(id);
    const el = h('div.inv-cell' + cls + (def ? '.full' : ''), { ...data, title: '' }, def ? itemIcon(def.id, 3, 40) : h('span.inv-ph', label));
    el.addEventListener('click', onClick);
    if (def) {
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', JSON.stringify(data));
        this.tip.classList.add('hidden');
      });
      el.addEventListener('mouseenter', () => this.showTip(def, el));
      el.addEventListener('mouseleave', () => this.tip.classList.add('hidden'));
    }
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer?.getData('text/plain');
      if (!raw) return;
      this.drop(JSON.parse(raw), data);
    });
    return el;
  }

  private drop(from: Record<string, string>, to: Record<string, string>) {
    const g = this.gear!;
    if (from['data-bag'] !== undefined && to['data-slot'] !== undefined) this.apply(equipToSlot(g, +from['data-bag'], to['data-slot'] as Slot));
    else if (from['data-bag'] !== undefined && to['data-bag'] !== undefined) this.apply({ ok: true, gear: moveInBag(g, +from['data-bag'], +to['data-bag']) });
    else if (from['data-slot'] !== undefined && to['data-bag'] !== undefined) this.apply(unequip(g, from['data-slot'] as Slot, +to['data-bag']));
  }

  render() {
    const g = this.gear;
    if (!g) return;
    clear(this.slots);
    for (const s of SLOTS) {
      const id = g.equip[s];
      const twoH = s === 'off' && !!item(g.equip.main)?.twoHanded;
      const c = this.cell(id, '.slot' + (twoH ? '.blocked' : ''), twoH ? '2H' : '', { 'data-slot': s }, () => {
        if (id) this.apply(unequip(g, s));
      });
      this.slots.append(h('div.inv-slot', h('label', SLOT_NAME[s]), c, h('span.inv-slot-name', id ? item(id)!.name : twoH ? 'Занята двуручным оружием' : 'Пусто')));
    }
    clear(this.bag);
    g.bag.forEach((id, i) => {
      this.bag.append(
        this.cell(id, '', '', { 'data-bag': String(i) }, () => {
          if (id) this.apply(equipFromBag(g, i));
        }),
      );
    });
    this.renderStats();
  }

  private renderStats() {
    const st = computeStats(this.race, this.gear!);
    const row = (k: string, v: string) => h('div.inv-stat', h('span', k), h('b', v));
    clear(this.stats);
    this.stats.append(
      h('div.inv-who', h('b', this.name), h('span', `${RACE_BY_ID[this.race]?.name ?? ''} · Уровень 1`)),
      row('Здоровье', String(st.maxHp)),
      row('Физическая защита', `${st.physDef} (−${Math.round(st.physReduce * 100)}% урона)`),
      row('Оружие', st.weaponName),
      row('Урон за удар', `${st.hitDamage.toFixed(1)} ${st.weapon?.dmgType === 'magic' ? 'маг.' : 'физ.'}`),
      row('Атак в секунду', st.attacksPerSec.toFixed(2)),
      row('Урон в секунду', st.dps.toFixed(1)),
      row('Дальность', String(st.range)),
      row('Магический урон', pct(st.magicDmg)),
      row('Скорость заклинаний', pct(st.castSpeed)),
      row('Скорость атаки', pct(st.atkSpeed)),
      row('Скорость передвижения', `${st.moveSpeed.toFixed(2)} бл/с (${pct(st.moveBonus)})`),
    );
  }
}
