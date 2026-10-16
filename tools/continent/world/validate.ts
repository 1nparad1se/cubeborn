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
import { MAIN } from './story';
import { QUESTS } from './quests';
import { NPCS } from './npcs';
import { SECRETS } from './secrets';
import { makeResolver, targetOf } from './refs';
import { REGION_POLYS } from './regions';

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
// ─── Этап 6: сюжет, задания, NPC, тайны ───
const F = JSON.parse(readFileSync(join(HERE, '..', 'viewer', 'public', 'data', 'features.json'), 'utf8'));
const res = makeResolver(G, F, SECRETS);
// достижимость пешком: BFS по сетке 2048² от Зеленодола; клетка проходима, если не вода или на ней дорога/мост;
// шаг — перепад ≤ 4,6 блока на 3,9 блока (≈ 50°: блоки + прыжки), по дороге — всегда.
const NN = 2048, CSZ = 8000 / NN;
const roadPx = decodePNG(readFileSync(join(HERE, '..', 'out', 'roads_2048.png'))).data as Uint8Array;
const pass = (i: number) => roadPx[i] !== 0 || (M.water[i] === 0 && M.H[i] >= 40);
const reach = new Uint8Array(NN * NN);
{ const z = G.villages[0].at; const s0 = Math.floor(z[1] / CSZ) * NN + Math.floor(z[0] / CSZ); const q = new Int32Array(NN * NN); let h = 0, t = 0; q[t++] = s0; reach[s0] = 1;
  while (h < t) { const i = q[h++]; const x = i % NN, y = (i / NN) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= NN || ny >= NN) continue; const j = ny * NN + nx;
      if (reach[j] || !pass(j)) continue; if (Math.abs(M.H[j] - M.H[i]) > 4.6 && !(roadPx[i] && roadPx[j])) continue; reach[j] = 1; q[t++] = j; } } }
const reachable = (p: P, rad = 40) => { const cx = Math.floor(p[0] / CSZ), cy = Math.floor(p[1] / CSZ), r = Math.ceil(rad / CSZ);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < NN && y < NN && reach[y * NN + x]) return true; } return false; };
const reachLandPct = Math.round(1000 * reach.reduce((a, v) => a + v, 0) / M.water.reduce((a: number, w: number, i: number) => a + (w === 0 && M.H[i] >= 40 ? 1 : 0), 0)) / 10;
void 0;
const npcIds = new Set(NPCS.map(n => n.id));
const regionLv = (p: P) => REGION_POLYS[M.region[M.ci(p[0], p[1])]]?.lv as [number, number] | undefined;
const villageOf = new Map(G.villages.map((v: { id: string }) => [v.id, v]));
const npcPos = (n: typeof NPCS[number], at: string): P | null => {
  if (at.startsWith('site:')) return G.sites.find((s: { id: string }) => s.id === at.slice(5))?.at ?? null;
  const v = villageOf.get(n.village ?? '') as { buildings: { id: string; at: P }[] } | undefined; return v?.buildings.find(b => b.id === at)?.at ?? null;
};
// NPC
const npcSeen = new Set<string>();
for (const n of NPCS) {
  if (npcSeen.has(n.id)) err(`NPC ${n.id}: дубль id`); npcSeen.add(n.id);
  for (const k of ['ru', 'role', 'home', 'work', 'note'] as const) if (!n[k]) err(`NPC ${n.id}: пустое поле ${k}`);
  const hp2 = npcPos(n, n.home); if (!hp2) err(`NPC ${n.id}: дом ${n.home} не найден`); else if (!reachable(hp2)) err(`NPC ${n.id}: дом недостижим пешком`);
  if (!npcPos(n, n.work)) err(`NPC ${n.id}: место работы ${n.work} не найдено`);
  if (n.schedule[0]?.h !== 0) err(`NPC ${n.id}: распорядок не начинается с 0 ч`);
  for (let k = 0; k < n.schedule.length; k++) { const sl = n.schedule[k]; if (sl.h < 0 || sl.h > 23 || (k && sl.h <= n.schedule[k - 1].h)) err(`NPC ${n.id}: час ${sl.h} вне порядка`); if (!npcPos(n, sl.at)) err(`NPC ${n.id}: место ${sl.at} в распорядке не найдено`); }
}
for (const v of G.villages as { id: string; ru: string; buildings: { id: string; ru: string; type: string }[] }[]) for (const b of v.buildings)
  if (!['pen', 'well', 'watchtower', 'guard_post', 'barn', 'shelter'].includes(b.type) && !NPCS.some(n => n.village === v.id && (n.home === b.id || n.work === b.id)) && b.id !== 'house8') warn(`${v.ru}/${b.ru}: нет жителя или работника`);
// общая проверка задания/шага
const checkLoc = (id: string, giver: string, loc: string[], lv: number) => {
  if (!npcIds.has(giver)) err(`${id}: квестодатель ${giver} не найден`);
  else { const n = NPCS.find(q => q.id === giver)!; const gp = npcPos(n, n.home); if (gp && !reachable(gp)) err(`${id}: квестодатель недостижим`); }
  if (!loc.length) err(`${id}: нет места`);
  for (const r of loc) { const q = res(r); if (!q) { err(`${id}: место ${r} не найдено`); continue; }
    if (q.line) { if (!q.pts!.some(p => reachable(p))) err(`${id}: маршрут ${r} недостижим`); } else if (q.at && !reachable(q.at, q.kind === 'lake' ? 600 : 40)) err(`${id}: ${r} недостижим пешком`); }
  if (lv < 1 || lv > 50) err(`${id}: уровень ${lv} вне 1–50`);
  const t = targetOf(loc); if (!t) return; const q = res(t); if (!q || !q.at) return;
  const range = q.lv ?? regionLv(q.at); if (!range) { warn(`${id}: цель вне регионов`); return; }
  if (lv < range[0] - 3 || lv > range[1] + 3) err(`${id}: уровень ${lv} не совпадает с целью ${t} (${range[0]}–${range[1]} ±3)`);
  if (q.lv && /^(camp|site):/.test(t)) { const rl = regionLv(q.at); if (rl && (lv < rl[0] - 3 || lv > rl[1] + 3)) warn(`${id}: уровень ${lv} выше/ниже региона ${rl[0]}–${rl[1]} (цель — опасное место ${t}, ${q.lv[0]}–${q.lv[1]})`); }
};
const mainIds = new Set(MAIN.map(m => m.id));
for (const m of MAIN) {
  for (const k of ['ru', 'rewards', 'consequences'] as const) if (!m[k]) err(`${m.id}: пустое поле ${k}`);
  if (!m.objectives.length) err(`${m.id}: нет целей`);
  for (const r of m.requires) if (!mainIds.has(r)) err(`${m.id}: требует неизвестный шаг ${r}`);
  checkLoc(m.id, m.giver, m.loc, m.lv);
}
// порядок актов без циклов
{ const done = new Set<string>(); let prog = true; while (prog) { prog = false; for (const m of MAIN) if (!done.has(m.id) && m.requires.every(r => done.has(r))) { done.add(m.id); prog = true; } }
  for (const m of MAIN) if (!done.has(m.id)) err(`${m.id}: недостижим по цепочке requires (цикл)`); }
const qIds = new Set<string>();
for (const q of QUESTS) {
  if (qIds.has(q.id) || mainIds.has(q.id)) err(`${q.id}: дубль id`); qIds.add(q.id);
  for (const k of ['ru', 'giver', 'backstory', 'goal', 'reward', 'consequences'] as const) if (!q[k] || String(q[k]).length < 3) err(`${q.id}: пустое поле ${k}`);
  if (q.steps.length < 2) err(`${q.id}: этапов < 2`); if (q.solutions.length < 2) err(`${q.id}: вариантов решения < 2`);
  checkLoc(q.id, q.giver, q.loc, q.lv);
}
if (QUESTS.length < 60) err(`побочных заданий ${QUESTS.length} < 60`);
for (const c of G.camps as { id: string; quest: string }[]) if (!qIds.has(c.quest) && !mainIds.has(c.quest)) err(`${c.id}: quest ${c.quest} без задания`);
const typesUsed = new Set(QUESTS.map(q => q.type)); if (typesUsed.size < 12) warn(`механик заданий только ${typesUsed.size}`);
// тайны
for (const s of SECRETS) {
  if (!reachable(s.at)) err(`тайна ${s.id}: недостижима`); if (s.to && !reachable(s.to)) err(`тайна ${s.id}: конец прохода недостижим`);
  for (const o of SECRETS) if (o !== s && Math.hypot(o.at[0] - s.at[0], o.at[1] - s.at[1]) < 250) err(`тайны ${s.id}/${o.id} ближе 250 блоков`);
  for (const p of s.props) if (!propIds.has(p)) err(`тайна ${s.id}: неизвестный проп ${p}`);
  const rl = regionLv(s.at); if (rl && (s.lv < rl[0] - 3 || s.lv > rl[1] + 3) && s.kind !== 'mini_boss') warn(`тайна ${s.id}: уровень ${s.lv} vs регион ${rl[0]}–${rl[1]}`);
  if (s.boss) { const cr = creatureById(s.boss.species); if (!cr) { err(`тайна ${s.id}: вид ${s.boss.species} не в каталоге`); continue; }
    const i = M.ci(s.at[0], s.at[1]), mj = M.major[i], b = M.biome[i];
    if ((cr.category === 'forest' && mj !== 0) || (cr.category === 'snow' && mj !== 1) || (cr.category === 'desert' && !(mj === 2 || b === 8))) err(`тайна ${s.id}: ${s.boss.species} вне своего биома`); }
}
const story = { mainSteps: MAIN.length, quests: QUESTS.length, questTypes: typesUsed.size, reachableLandPct: reachLandPct, peaksReachable: [[4300, 1000], [2600, 1060]].map(p => reachable(p as P, 8)), npcs: NPCS.length, secrets: SECRETS.length,
  questsByBiome: Object.fromEntries(['green', 'winter', 'desert'].map(bm => [bm, QUESTS.filter(q => { const t = targetOf(q.loc); const r = t ? res(t) : null; return r?.at && REGION_POLYS[M.region[M.ci(r.at[0], r.at[1])]]?.biome === bm; }).length])),
  questLevels: [Math.min(...QUESTS.map(q => q.lv)), Math.max(...QUESTS.map(q => q.lv))] };
const report = { ok: errors.length === 0, heightHash: hash, counts: { villages: G.villages.length, buildings: G.villages.reduce((a: number, v: { buildings: unknown[] }) => a + v.buildings.length, 0), sites: G.sites.length, caves: G.sites.filter((s: { cave: unknown }) => s.cave).length, camps: G.camps.length, mobs: G.camps.reduce((a: number, c: { total: number }) => a + c.total, 0), speciesUsed: CREATURES.length - missing.length }, story, errors, warnings };
writeFileSync(join(ROOT, 'docs', 'continent', 'world_validation.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.counts), JSON.stringify(story), `errors ${errors.length}, warnings ${warnings.length}`);
for (const e of errors) console.log('ERR', e); for (const w of warnings) console.log('warn', w);
if (errors.length) process.exit(1);
