/**
 * Проверка данных этапов 3–5 по замороженному рельефу. Пишет docs/continent/world_validation.json, при ошибках — exit 1.
 *   npx tsx tools/continent/world/validate.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePNG } from '../png';
import { loadMaps } from './maps';
import { CREATURES } from '../../../src/data/bestiary';
import { creatureById } from '../../../src/data/creatureStats';
import { PROP_CATEGORIES, propsOf } from '../../../src/world/props/index';
import type { P } from '../geom';

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
const M = loadMaps();
const G = JSON.parse(readFileSync(join(HERE, 'generated.json'), 'utf8'));
const stats = JSON.parse(readFileSync(join(ROOT, 'docs', 'continent', 'stats.json'), 'utf8'));
const frozen = JSON.parse(readFileSync(join(HERE, '..', 'frozen.json'), 'utf8'));
const errors: string[] = [], warnings: string[] = [];
const err = (s: string) => errors.push(s), warn = (s: string) => warnings.push(s);
const propIds = new Set(PROP_CATEGORIES.flatMap(c => propsOf(c).map(p => p.id)));

// 0. рельеф не менялся
const hp = decodePNG(readFileSync(join(HERE, '..', 'out', 'heightmap_2048.png'))).data as Uint16Array;
const hash = createHash('sha256').update(Buffer.from(new Uint16Array(hp).buffer)).digest('hex');
if (hash !== frozen.overview2048) err(`хеш высот ${hash} не совпадает с замороженным ${frozen.overview2048}`);

// 1. деревни
const LIMITS: Record<string, [number, number]> = { zelenodol: [12, 18], snezhny: [8, 12], peschany: [8, 12] };
for (const v of G.villages) {
  const n = v.buildings.length; const [a, b] = LIMITS[v.id]; if (n < a || n > b) err(`${v.ru}: ${n} зданий, нужно ${a}–${b}`);
  for (const bl of v.buildings) {
    const hw = (bl.rot % 2 ? bl.size[1] : bl.size[0]) / 2, hd = (bl.rot % 2 ? bl.size[0] : bl.size[1]) / 2;
    for (const [ox, oy] of [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) { const x = bl.at[0] + ox, y = bl.at[1] + oy; if (M.isWater(x, y)) err(`${v.ru}/${bl.ru}: угол в воде`); if (M.slope(x, y) > 15) err(`${v.ru}/${bl.ru}: уклон ${M.slope(x, y).toFixed(0)}°`); }
    if (M.roadDist(bl.at[0], bl.at[1]).d < Math.hypot(hw, hd)) err(`${v.ru}/${bl.ru}: стоит на дороге`);
    for (const o of v.buildings) if (o !== bl && Math.abs(o.at[0] - bl.at[0]) < 2 && Math.abs(o.at[1] - bl.at[1]) < 2) err(`${v.ru}: наложение ${bl.id}/${o.id}`);
    for (const p of bl.props) if (!propIds.has(p)) err(`${v.ru}/${bl.ru}: неизвестный проп ${p}`);
  }
  for (const e of v.extras) if (!propIds.has(e.prop)) err(`${v.ru}: неизвестный проп ${e.prop}`);
  if (!stats.reachability.withRoads[v.id]) err(`${v.ru}: недостижима от Зеленодола`);
}
// 2. объекты и пещеры
for (const s of G.sites) {
  for (const p of s.props) if (!propIds.has(p)) err(`${s.ru}: неизвестный проп ${p}`);
  if (s.cave) for (const e of s.cave.entrances) {
    if (M.isWater(e.at[0], e.at[1])) err(`${s.ru}: вход в воде`);
    if (M.slope(e.at[0], e.at[1]) > 26) err(`${s.ru}: площадка у входа слишком крутая (${M.slope(e.at[0], e.at[1]).toFixed(0)}°)`);
    if (e.snapped < 0) warn(`${s.ru}: обрыв не найден, вход оставлен в авторской точке`);
    else if (e.snapped > 0 && e.cliffSlope < 30) err(`${s.ru}: стена за входом пологая (${e.cliffSlope}°)`);
  } else if (M.isWater(s.at[0], s.at[1])) err(`${s.ru}: в воде`);
}
// 3. лагеря
const regLv = new Map<string, [number, number]>(G.regions.map((r: { id: string; lv: [number, number] }) => [r.id, r.lv]));
for (const c of G.camps) {
  const [x, y] = c.at as P;
  if (M.isWater(x, y)) err(`${c.id} ${c.ru}: в воде`);
  const s = M.slope(x, y); if (s > (c.territory === 'cave' ? 26 : 20)) err(`${c.id}: уклон ${s.toFixed(0)}°`);
  const rd = M.roadDist(x, y).d; if (rd < 20) err(`${c.id} ${c.ru}: на дороге (${rd.toFixed(0)} бл.)`);
  for (const pd of M.vec.pads) if (Math.hypot(x - pd.at[0], y - pd.at[1]) < pd.r + 60) err(`${c.id}: в деревне ${pd.id}`);
  const i = M.ci(x, y);
  for (const g of c.groups) {
    const cr = creatureById(g.species); if (!cr) { err(`${c.id}: вида ${g.species} нет в каталоге`); continue; }
    const mj = M.major[i], b = M.biome[i];
    if (cr.category === 'forest' && mj !== 0) err(`${c.id}: лесной вид ${g.species} вне зелёных земель`);
    if (cr.category === 'snow' && mj !== 1) err(`${c.id}: снежный вид ${g.species} вне зимы`);
    if (cr.category === 'desert' && !(mj === 2 || b === 8)) err(`${c.id}: пустынный вид ${g.species} вне пустыни/степи`);
    if ((cr.category === 'dungeons' || cr.category === 'special') && !c.site) warn(`${c.id}: ${g.species} без привязки к пещере/руине`);
  }
  if (c.region !== c.regionAuthored) warn(`${c.id}: стоит в регионе ${c.region}, а задуман в ${c.regionAuthored}`);
  const lv = regLv.get(c.region); if (lv && !c.danger && (c.lvMin < lv[0] - 2 || c.lvMax > lv[1] + 2)) warn(`${c.id}: уровни ${c.lvMin}–${c.lvMax} вне диапазона региона ${lv[0]}–${lv[1]}`);
  for (const p of c.patrol) if (M.isWater(p[0], p[1])) err(`${c.id}: точка патруля в воде`);
  for (const p of c.props) if (!propIds.has(p.id)) err(`${c.id}: неизвестный проп ${p.id}`);
  if (c.unique && c.respawnSec !== null) err(`${c.id}: уникальный, но возрождается`);
}
// 4. каталог и дороги
const missing = CREATURES.filter(c => !G.camps.some((q: { groups: { species: string }[] }) => q.groups.some(g => g.species === c.id)));
if (missing.length) err(`не использованы виды: ${missing.map(c => c.id).join(', ')}`);
if (stats.sideRoadFailures?.length) err(`не проложены дороги: ${stats.sideRoadFailures.join('; ')}`);
if (stats.checks.failed.length) err(`bake: ${stats.checks.failed.join('; ')}`);

for (const z of (G.calmAreas ?? []) as { id: string; at: number[]; r: number }[]) {
  for (const c of G.camps as { id: string; at: number[] }[]) if (Math.hypot(c.at[0] - z.at[0], c.at[1] - z.at[1]) < z.r) err(`${c.id}: лагерь внутри спокойной зоны ${z.id}`);
  for (const s of G.sites as { id: string; at: number[] }[]) if (Math.hypot(s.at[0] - z.at[0], s.at[1] - z.at[1]) < z.r) warn(`${s.id}: объект внутри спокойной зоны ${z.id}`);
}
const report = { ok: errors.length === 0, heightHash: hash, counts: { villages: G.villages.length, buildings: G.villages.reduce((a: number, v: { buildings: unknown[] }) => a + v.buildings.length, 0), sites: G.sites.length, caves: G.sites.filter((s: { cave: unknown }) => s.cave).length, camps: G.camps.length, mobs: G.camps.reduce((a: number, c: { total: number }) => a + c.total, 0), speciesUsed: CREATURES.length - missing.length }, errors, warnings };
writeFileSync(join(ROOT, 'docs', 'continent', 'world_validation.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.counts), `errors ${errors.length}, warnings ${warnings.length}`);
for (const e of errors) console.log('ERR', e); for (const w of warnings) console.log('warn', w);
if (errors.length) process.exit(1);
