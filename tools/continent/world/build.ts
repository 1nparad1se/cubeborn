/**
 * Этапы 3–5: из авторских данных (regions.ts, sites.ts, roads.ts, villages.ts, mobs.ts) и замороженного рельефа
 * получает итоговые координаты: здания деревень, входы пещер в обрывах, площадки лагерей, места отдыха,
 * позиции стрелков/бойцов, патрули. Пишет world/generated.json и копию для просмотрщика. Рельеф не меняет.
 *   npx tsx tools/continent/world/build.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../design';
import { clamp, type P } from '../geom';
import { loadMaps } from './maps';
import { SITES, CAVE_TYPE_RU, CALM_AREAS } from './sites';
import { SIDE_ROADS } from './roads';
import { VILLAGE_SPECS } from './villages';
import { CAMPS } from './mobs';
import { REGION_POLYS } from './regions';
import { CREATURES } from '../../../src/data/bestiary';
import { creatureStats, creatureById } from '../../../src/data/creatureStats';
import { LORE, MAIN, ENDINGS } from './story';
import { QUESTS, QUEST_TYPE_RU } from './quests';
import { NPCS } from './npcs';
import { SECRETS, SECRET_KIND_RU } from './secrets';
import { makeResolver, targetOf } from './refs';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = loadMaps();
const SEA = D.SEA_LEVEL;
const R2 = (p: P): P => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const walkable = (x: number, y: number, maxSlope = 22) => !M.isWater(x, y) && M.slope(x, y) <= maxSlope && x > 0 && y > 0 && x < D.WORLD && y < D.WORLD;

// ─── Пещеры: вход в обрыве ───
interface Entrance { at: P; face: number; cliffAt: P; cliffSlope: number; snapped: number }
function snapEntrance(anchor: P, noCliff = false): Entrance {
  for (const [rad, minS] of [[240, 38], [400, 34], [600, 30]] as const) { const e = snapTry(anchor, rad, minS); if (e) return e; }
  if (!noCliff) console.warn(`нет обрыва рядом с ${anchor}`);
  return { at: anchor, face: 0, cliffAt: anchor, cliffSlope: Math.round(M.slope(anchor[0], anchor[1])), snapped: -1 };
}
function snapTry(anchor: P, RAD: number, MINS: number, noCliff = false): Entrance | null {
  if (noCliff) return { at: anchor, face: 0, cliffAt: anchor, cliffSlope: M.slope(anchor[0], anchor[1]), snapped: 0 };
  let best: Entrance | null = null, bestScore = Infinity;
  for (let dy = -RAD; dy <= RAD; dy += 4) for (let dx = -RAD; dx <= RAD; dx += 4) {
    const cx = anchor[0] + dx, cy = anchor[1] + dy; const d = Math.hypot(dx, dy); if (d > RAD) continue;
    const s = M.slope(cx, cy); if (s < MINS || M.isWater(cx, cy)) continue;
    // направление вниз по склону
    const e = 4, gx = M.h(cx + e, cy) - M.h(cx - e, cy), gy = M.h(cx, cy + e) - M.h(cx, cy - e); const gl = Math.hypot(gx, gy) || 1;
    const fx = cx - gx / gl * 12, fy = cy - gy / gl * 12;
    if (!walkable(fx, fy, 22) || M.h(fx, fy) > M.h(cx, cy) - 2) continue;
    const score = d - s * 0.8;
    if (score < bestScore) { bestScore = score; best = { at: R2([fx, fy]), face: Math.round(Math.atan2(-gy, -gx) * 180 / Math.PI), cliffAt: R2([cx, cy]), cliffSlope: Math.round(s), snapped: Math.round(d) }; }
  }
  return best;
}
const sitesOut = SITES.map(s => {
  const entrances = s.cave ? s.cave.entrances.map(a => s.cave!.noCliff ? { at: a, face: 0, cliffAt: a, cliffSlope: Math.round(M.slope(a[0], a[1])), snapped: 0 } : snapEntrance(a)) : [];
  const at = entrances.length ? entrances[0].at : s.anchor;
  return { id: s.id, ru: s.ru, kind: s.kind, at, purpose: s.purpose, props: s.props, region: REGION_POLYS[M.region[M.ci(at[0], at[1])]]?.id ?? null,
    cave: s.cave ? { type: s.cave.type, typeRu: CAVE_TYPE_RU[s.cave.type], lv: s.cave.lv, lore: s.cave.lore, entrances } : null };
});
const siteById = new Map(sitesOut.map(s => [s.id, s]));

// ─── Деревни ───
interface Bld { id: string; ru: string; type: string; purpose: string; at: P; size: [number, number]; rot: number; props: string[] }
const villagesOut = VILLAGE_SPECS.map(spec => {
  const v = D.VILLAGES.find(q => q.id === spec.village)!; const pad = M.vec.pads.find(p => p.id === v.id)!;
  const placed: Bld[] = [];
  const fits = (x: number, y: number, w: number, d: number, rot: number, place: string) => {
    const hw = (rot % 2 ? d : w) / 2 + 1, hd = (rot % 2 ? w : d) / 2 + 1; const diag = Math.hypot(hw, hd);
    const dc = Math.hypot(x - v.at[0], y - v.at[1]);
    if (place !== 'river' && place !== 'gate' && dc + diag > pad.r * 1.08) return false;
    if (M.roadDist(x, y).d < diag + 1.5) return false;
    const rv = M.riverDist(x, y).d;
    if (place === 'river' ? rv < hw + 2 || rv > hw + 14 : rv < diag + 5) return false;
    for (const [ox, oy] of [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) { const px = x + ox, py = y + oy; if (M.isWater(px, py) || M.slope(px, py) > 14) return false; }
    for (const b of placed) { const bw = (b.rot % 2 ? b.size[1] : b.size[0]) / 2 + 1, bd = (b.rot % 2 ? b.size[0] : b.size[1]) / 2 + 1; if (Math.abs(b.at[0] - x) < bw + hw + 2 && Math.abs(b.at[1] - y) < bd + hd + 2) return false; }
    return true;
  };
  const order = [...spec.buildings].sort((a, b) => ['center', 'river', 'gate', 'ring', 'edge'].indexOf(a.place) - ['center', 'river', 'gate', 'ring', 'edge'].indexOf(b.place));
  for (const b of order) {
    const rings = b.place === 'center' ? [0, 10, 16, 22, 28] : b.place === 'edge' ? [pad.r * 0.7, pad.r * 0.8, pad.r * 0.6, pad.r * 0.9, pad.r * 0.5] : b.place === 'gate' ? [pad.r * 0.95, pad.r * 1.05, pad.r * 0.85] : b.place === 'river' ? [] : [24, 32, 40, 48, 56, 64, 72, 80];
    let done = false;
    const tryAt = (x: number, y: number) => {
      const near = M.roadDist(x, y); const ang = Math.atan2(near.at[1] - y, near.at[0] - x);
      const rot = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
      if (fits(x, y, b.size[0], b.size[1], rot, b.place)) { placed.push({ id: b.id, ru: b.ru, type: b.type, purpose: b.purpose, at: R2([x, y]), size: b.size, rot, props: b.props }); return true; }
      return false;
    };
    if (b.place === 'river') {
      for (let r = 20; r < pad.r * 1.6 && !done; r += 3) for (let a = 0; a < 360 && !done; a += 6) { const x = v.at[0] + Math.cos(a * Math.PI / 180) * r, y = v.at[1] + Math.sin(a * Math.PI / 180) * r; done = tryAt(x, y); }
    } else if (b.place === 'gate') {
      // пост у дороги на выезде: на расстоянии ~площадки по ходу ближайших дорог
      for (let a = (placed.filter(p => p.type === 'guard_post').length ? 90 : 270); a < 720 && !done; a += 5) for (const r of rings) { const x = v.at[0] + Math.cos(a * Math.PI / 180) * r, y = v.at[1] + Math.sin(a * Math.PI / 180) * r; if (M.roadDist(x, y).d < 14 && tryAt(x, y)) { done = true; break; } }
    }
    for (const r of rings) { if (done) break; for (let a = 0; a < 360; a += r > 0 ? Math.max(4, 300 / Math.max(r, 1)) : 360) { const x = v.at[0] + Math.cos(a * Math.PI / 180) * r, y = v.at[1] + Math.sin(a * Math.PI / 180) * r; if (tryAt(x, y)) { done = true; break; } } }
    for (let r = 10; r < pad.r * 1.05 && !done; r += 4) for (let a = 0; a < 360 && !done; a += 7) done = tryAt(v.at[0] + Math.cos(a * Math.PI / 180) * r, v.at[1] + Math.sin(a * Math.PI / 180) * r);
    if (!done) console.warn(`не удалось разместить ${spec.village}/${b.id}`);
  }
  return { id: v.id, ru: v.ru, at: v.at, padR: pad.r, padY: pad.y, style: spec.style, buildings: placed, extras: spec.extras };
});

// ─── Лагеря мобов ───
const villagePads = M.vec.pads;
const catOf = (sp: string) => creatureById(sp)!.category;
function biomeOk(sp: string, x: number, y: number) {
  const i = M.ci(x, y), mj = M.major[i], b = M.biome[i]; const cat = catOf(sp);
  if (cat === 'forest') return mj === 0;
  if (cat === 'snow') return mj === 1;
  if (cat === 'desert') return mj === 2 || b === 8;
  return true;
}
const campsOut: ReturnType<typeof makeCamp>[] = [];
function makeCamp(c: typeof CAMPS[number]) {
  const site = c.site ? siteById.get(c.site) : undefined;
  // для пещерных лагерей — площадка перед входом
  let anchor: P = c.at;
  if (site && site.cave && c.territory === 'cave') {
    const ents = site.cave.entrances; let e = ents[0]; for (const q of ents) if (Math.hypot(q.at[0] - c.at[0], q.at[1] - c.at[1]) < Math.hypot(e.at[0] - c.at[0], e.at[1] - c.at[1])) e = q;
    anchor = [e.at[0] + Math.cos(e.face * Math.PI / 180) * 14, e.at[1] + Math.sin(e.face * Math.PI / 180) * 14];
  }
  const ok = (x: number, y: number) => {
    if (!walkable(x, y, c.territory === 'cave' ? 26 : 20)) return false;
    for (const [ox, oy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) if (M.isWater(x + ox, y + oy)) return false;
    if (M.roadDist(x, y).d < (c.territory === 'road_camp' ? 22 : 30)) return false;
    for (const [ox, oy] of [[0, 0], [6, 6], [-6, 6], [6, -6], [-6, -6]]) if (!c.groups.every(gr => biomeOk(gr.species, x + ox, y + oy))) return false;
    for (const p of villagePads) if (Math.hypot(x - p.at[0], y - p.at[1]) < p.r + 80) return false;
    for (const o of campsOut) if (Math.hypot(x - o.at[0], y - o.at[1]) < 55) return false;
    return true;
  };
  let at: P | null = null;
  const inReg = (x: number, y: number) => REGION_POLYS[M.region[M.ci(x, y)]]?.id === c.region;
  for (const [rmax, needReg] of [[600, true], [320, false]] as const) {
    for (let r = 0; r <= rmax && !at; r += 4) for (let a = 0; a < 360; a += r ? Math.max(3, 360 / (r / 2)) : 360) { const x = anchor[0] + Math.cos(a * Math.PI / 180) * r, y = anchor[1] + Math.sin(a * Math.PI / 180) * r; if ((!needReg || inReg(x, y)) && ok(x, y)) { at = [x, y]; break; } }
    if (at) break;
    console.warn(`лагерь ${c.id}: нет места внутри региона ${c.region}, ищу без ограничения`);
  }
  if (!at) throw new Error(`лагерь ${c.id}: не найдено место у ${anchor}`);
  const stats = c.groups.map(gr => creatureStats(creatureById(gr.species)!));
  const aggro = Math.round(Math.max(...stats.map(s => s.aggro)) * 1.5);
  const ranged = c.groups.some(gr => creatureStats(creatureById(gr.species)!).attack === 'ranged');
  // места отдыха, позиции, патруль
  const ring = (r: number, n: number, off = 0) => Array.from({ length: n }, (_, k) => { const a = off + k / n * Math.PI * 2; let rr = r; for (; rr > 3; rr -= 2) { const x = at![0] + Math.cos(a) * rr, y = at![1] + Math.sin(a) * rr; if (walkable(x, y, 30)) return R2([x, y]); } return R2(at!); });
  const road = M.roadDist(at[0], at[1]); const toRoad = Math.atan2(road.at[1] - at[1], road.at[0] - at[0]);
  const rangedPos: P[] = [];
  if (ranged) { let cand: [number, P][] = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r = 12 + (k % 3) * 5; const x = at[0] + Math.cos(a) * r, y = at[1] + Math.sin(a) * r; if (walkable(x, y, 30)) cand.push([M.h(x, y), R2([x, y])]); } cand = cand.sort((p, q) => q[0] - p[0]); rangedPos.push(...cand.slice(0, 2).map(q => q[1])); }
  const meleePos: P[] = [-0.4, 0.4].map(o => { const x = at![0] + Math.cos(toRoad + o) * 10, y = at![1] + Math.sin(toRoad + o) * 10; return R2(walkable(x, y, 30) ? [x, y] : at!); });
  const unique = !!c.unique;
  const respawnSec = unique ? null : Math.round(Math.max(...stats.map(s => s.respawn)) * (c.territory === 'fort' ? 1.5 : 1));
  const region = REGION_POLYS[M.region[M.ci(at[0], at[1])]]?.id ?? null;
  return {
    id: c.id, ru: c.ru, region, regionAuthored: c.region, at: R2(at), anchor: c.at, territory: c.territory, site: c.site ?? null,
    groups: c.groups.map(gr => ({ ...gr, ru: creatureById(gr.species)!.name.ru, attack: creatureStats(creatureById(gr.species)!).attack })),
    total: c.groups.reduce((a, gr) => a + gr.count, 0), lvMin: Math.min(...c.groups.map(gr => gr.lv[0])), lvMax: Math.max(...c.groups.map(gr => gr.lv[1])),
    patrolR: c.patrol, patrol: ring(c.patrol, 6, 0.3), rest: ring(8, 3, 1.1), rangedPos, meleePos, aggro, leash: c.patrol + aggro * 2 + 10,
    respawn: unique ? 'никогда (уникальный)' : `${respawnSec} с на особь, лагерь полностью — через ${respawnSec! * 6} с`, respawnSec, unique,
    danger: c.danger ?? null, props: c.props.map((p, k) => ({ id: p, at: ring(5 + (k % 3) * 5, 1, k * 1.3)[0] })), quest: c.quest, note: c.note,
  };
}
for (const c of CAMPS) campsOut.push(makeCamp(c));

const used = new Set(campsOut.flatMap(c => c.groups.map(g => g.species)));
const out = {
  frozenHeightHash: JSON.parse(readFileSync(join(HERE, '..', 'frozen.json'), 'utf8')),
  regions: REGION_POLYS.map(r => ({ ...r, sites: sitesOut.filter(s => s.region === r.id).map(s => s.id), camps: campsOut.filter(c => c.region === r.id).map(c => c.id), enemies: [...new Set(campsOut.filter(c => c.region === r.id).flatMap(c => c.groups.map(g => g.ru)))] })),
  villages: villagesOut, sites: sitesOut, sideRoads: SIDE_ROADS, camps: campsOut, calmAreas: CALM_AREAS,
  species: CREATURES.map(c => ({ id: c.id, ru: c.name.ru, category: c.category, camps: campsOut.filter(q => q.groups.some(g => g.species === c.id)).length, used: used.has(c.id) })),
};
// ─── Этап 6: сюжет, задания, NPC, тайны — с координатами из данных мира ───
const F = JSON.parse(readFileSync(join(HERE, '..', 'viewer', 'public', 'data', 'features.json'), 'utf8'));
const res = makeResolver(out, F, SECRETS);
const placeOf = (village: string | null, at: string): P | null => {
  if (at.startsWith('site:')) { const s = sitesOut.find(q => q.id === at.slice(5)); return s ? s.at : null; }
  const v = villagesOut.find(q => q.id === village); const b = v?.buildings.find(q => q.id === at); return b ? b.at : null;
};
const npcsOut = NPCS.map(n => ({ ...n, at: placeOf(n.village, n.home), schedule: n.schedule.map(sl => ({ ...sl, pos: placeOf(n.village, sl.at) })) }));
const npcAt = (id: string) => npcsOut.find(n => n.id === id)?.at ?? null;
const locs = (loc: string[]) => loc.map(r => { const q = res(r); return q ? { ref: r, ru: q.ru, at: q.at ? R2(q.at) : null, line: q.line } : { ref: r, ru: '?', at: null, line: false }; });
const regionAt = (p: P | null) => p ? REGION_POLYS[M.region[M.ci(p[0], p[1])]]?.id ?? null : null;
const storyOut = {
  lore: LORE, endings: ENDINGS,
  main: MAIN.map(m => { const t = targetOf(m.loc); const tp = t ? res(t)?.at ?? null : null; return { ...m, locs: locs(m.loc), target: t, at: tp ? R2(tp) : null, region: regionAt(tp), giverAt: npcAt(m.giver) }; }),
};
const questsOut = QUESTS.map(q => { const t = targetOf(q.loc); const tp = t ? res(t)?.at ?? null : null; return { ...q, typeRu: QUEST_TYPE_RU[q.type], locs: locs(q.loc), target: t, at: tp ? R2(tp) : null, region: regionAt(tp), giverAt: npcAt(q.giver) }; });
const secretsOut = SECRETS.map(s => ({ ...s, kindRu: SECRET_KIND_RU[s.kind], region: regionAt(s.at) }));
Object.assign(out, { story: storyOut, quests: questsOut, npcs: npcsOut, secrets: secretsOut });
writeFileSync(join(HERE, 'generated.json'), JSON.stringify(out, null, 1));
const vd = join(HERE, '..', 'viewer', 'public', 'data'); mkdirSync(vd, { recursive: true });
writeFileSync(join(vd, 'world.json'), JSON.stringify(out));
console.log(`story ${MAIN.length} steps, quests ${QUESTS.length}, npcs ${NPCS.length}, secrets ${SECRETS.length}`);
console.log(`villages: ${villagesOut.map(v => `${v.ru} ${v.buildings.length}`).join(', ')}; sites ${sitesOut.length}; camps ${campsOut.length}; species ${used.size}/${CREATURES.length}`);
void clamp; void SEA;
