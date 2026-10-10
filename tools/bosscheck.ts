/** Prints hero health/armor vs boss hit size per level (boss tuning helper). Usage: npx tsx tools/bosscheck.ts [heroId] */
import { newChar, addCharXp, learn } from '../src/meta/Characters';
import { PROG } from '../src/config/progression';
import { Run } from '../src/game/Run';
import { NullFx } from '../src/game/types';
import { MAP_BY_ID } from '../src/data/maps';
import { HERO_BY_ID } from '../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../src/data/difficulty';
import { bossLevelScale } from '../src/config/bossTuning';
import { BALANCE } from '../src/config/balance';
import { makeItem, EQUIP_POS, slotOf } from '../src/game/arpg/Gear';
import type { Rarity } from '../src/data/types';

const heroId = process.argv[2] ?? 'berserker';
const hero = HERO_BY_ID[heroId];
for (const L of [4, 10, 14, 20, 24, 30, 34, 40, 44, 50]) {
  const map = MAP_BY_ID[L <= 10 ? 'blightwood' : L <= 20 ? 'gloamhaven' : L <= 30 ? 'ossuary' : L <= 40 ? 'emberwaste' : 'frostveil'];
  const c = newChar('x', hero.id);
  addCharXp(c, PROG.xpTotal(L));
  for (let k = 0; c.points > 0 && k < 400; k++) learn(c, k % 8);
  let x = 7;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const rar: Rarity = L >= 31 ? 'rare' : L >= 11 ? 'uncommon' : 'common';
  const base: Record<string, string> = { weapon: 'blade', helm: 'helm', armor: 'plate', gloves: 'gloves', boots: 'boots', amulet: 'amulet', ring: 'ring', trinket: 'idol' };
  const equipped: Record<string, ReturnType<typeof makeItem>> = {};
  for (const pos of EQUIP_POS) equipped[pos] = makeItem(rand, L, rar, base[slotOf(pos)]);
  const run = new Run({ map, diff: DIFFICULTY_BY_ID.normal, hero, permanent: {}, mode: 'campaign', fx: NullFx, settings: { damageNumbers: false }, tr: (k) => k, seed: 1, char: c, gear: { equipped, bag: [] } });
  const p = run.player;
  const armor = p.stats.armor + run.action.armorBonus;
  const raw = bossLevelScale(L).dmg;
  const hit = (m: number) => Math.max(BALANCE.armorMin, raw * m * (1 - Math.min(0.6, armor * 0.015)) - armor * 0.5);
  console.log(`L${L} hp=${p.stats.maxHp.toFixed(0)} armor=${armor.toFixed(1)} regen=${p.stats.regen.toFixed(1)} bossDmg=${raw.toFixed(0)} heavy(1.5)=${hit(1.5).toFixed(0)} (${((hit(1.5) / p.stats.maxHp) * 100).toFixed(0)}%) bolt(0.4)=${hit(0.4).toFixed(0)} (${((hit(0.4) / p.stats.maxHp) * 100).toFixed(0)}%)`);
}
