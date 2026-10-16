/**
 * Этап 7: растительность и детали поверх замороженного рельефа. Детерминированно (сид + хеш координат),
 * рельеф не меняется. Источник — блочные атласы (viewer/public/data/atlas), карта регионов, world/generated.json.
 *
 * Результат — компактные списки экземпляров по секторам 256×256 (сектор = тайл), чтобы движок подгружал их потоком:
 *   viewer/public/data/detail.wasm  (двоичный, расширение .wasm — его отдаёт любой статический хостинг)
 *     u32 'CBD1', u32 секторов (1024), u32[1025] смещения (в экземплярах), затем по 4 байта на экземпляр:
 *     x (0..255 в секторе), z, kind (индекс в detail_kinds.json), flags = rot(2 бита) | variant(2) << 2 | scale(4) << 4
 *     масштаб = 0.8 + scale × 0.06.
 *   viewer/public/data/detail_kinds.json — таблица видов (проп библиотеки src/world/props или дерево TreeInst)
 *   viewer/public/data/detail_density_512.png — плотность деревьев (для слоя «растительность» просмотрщика)
 *   docs/continent/detail_stats.json — счётчики, хеш, проверки
 *   npx tsx tools/continent/detail.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePNG, encodePNG } from './png';
import { REGION_POLYS } from './world/regions';

const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, 'viewer', 'public', 'data');
const T = 256, TILES = 32, W = 8000;

// ─── виды экземпляров ───
export interface Kind { id: string; ru: string; type: 'prop' | 'tree'; prop?: string; tree?: { kind: string; leaf: string; trunk: string; h: number }; group: string }
const KINDS: Kind[] = [];
const K = (k: Kind) => { KINDS.push(k); return KINDS.length - 1; };
const P = (prop: string, ru: string, group: string) => K({ id: prop, ru, type: 'prop', prop, group });
const TR = (id: string, ru: string, kind: string, leaf: string, trunk: string, h: number, group = 'tree') => K({ id, ru, type: 'tree', tree: { kind, leaf, trunk, h }, group });
const k = {
  oak: P('tree_oak', 'дуб', 'tree'), oakY: P('tree_oak_yellow', 'дуб (жёлтый)', 'tree'), oakA: P('tree_oak_autumn', 'дуб (осенний)', 'tree'), birch: P('tree_birch', 'берёза', 'tree'),
  pine: P('tree_pine', 'сосна/ель', 'tree'), big: P('tree_big', 'старое дерево', 'tree'), ivy: P('tree_oak_ivy', 'дуб с плющом', 'tree'),
  willow: TR('t_willow', 'ива', 'willow', 'leaves', 'trunk', 5), palm: TR('t_palm', 'пальма', 'palm', 'palm', 'trunk', 6), cactus: TR('t_cactus', 'кактус', 'cactus', 'cactus', 'cactus', 3),
  acacia: TR('t_acacia', 'акация', 'acacia', 'acacia', 'trunk', 4), snowPine: TR('t_snowpine', 'заснеженная ель', 'pine', 'snowpine', 'trunk', 6),
  dead: P('dead_tree', 'сухое дерево', 'tree'), stump: P('stump', 'пень', 'deadwood'), fallen: P('fallen_tree', 'поваленное дерево', 'deadwood'),
  bushL: P('bush_low', 'куст низкий', 'bush'), bushM: P('bush_mid', 'куст', 'bush'), bushT: P('bush_tall', 'куст высокий', 'bush'), bushB: P('bush_berry', 'ягодный куст', 'bush'),
  bushF: P('bush_flower', 'цветущий куст', 'bush'), bushD: P('bush_dry', 'сухой куст', 'bush'), grassD: P('grass_dry', 'сухая трава', 'grass'), palmB: P('palm_bush', 'пальмовый куст', 'bush'),
  fern: P('fern', 'папоротник', 'grass'), under: P('undergrowth', 'подлесок', 'grass'), mush: P('mushrooms_big', 'грибы', 'grass'), glow: P('mushrooms_glow', 'светящиеся грибы', 'grass'),
  flW: P('flowers_white', 'цветы белые', 'flower'), flY: P('flowers_yellow', 'цветы жёлтые', 'flower'), flR: P('flowers_red', 'цветы красные', 'flower'), flB: P('flowers_blue', 'цветы синие', 'flower'), flP: P('flowers_purple', 'цветы лиловые', 'flower'),
  grassT: P('grass_tall', 'высокая трава', 'grass'),
  rockL: P('rock_low', 'камень', 'rock'), rockM: P('rock_mid', 'валун', 'rock'), rockH: P('rock_high', 'скала-останец', 'rock'), rockS: P('rock_sharp', 'острый камень', 'rock'), rockMo: P('rock_mossy', 'замшелый валун', 'rock'),
  slab: P('rock_slab', 'осыпь (плита)', 'scree'), stones: P('shore_stones', 'галька, щебень', 'scree'),
  reeds: P('water_reeds', 'тростник у воды', 'reed'), cattail: P('cattail', 'рогоз', 'reed'), reedsL: P('reeds', 'камыш', 'reed'),
  snow: P('biome_snow', 'снежный сугроб с камнем', 'snow'), crystal: P('crystal_cluster', 'кристаллы', 'rock'),
  // атмосферные пропсы у дорог
  lamp: P('lamp_post', 'фонарь у деревни', 'road'), torch: P('standing_torch', 'факел у дороги', 'road'), banner: P('camp_banner', 'указатель на развилке', 'road'),
  cart: P('cart', 'брошенная телега', 'road'), crateB: P('crate_broken', 'разбитый ящик', 'road'), sack: P('sack', 'мешок', 'road'), stakes: P('camp_stakes', 'следы нападения (колья)', 'road'),
  fire: P('campfire', 'кострище привала', 'road'), tent: P('camp_tent_small', 'палатка привала', 'road'), bench: P('camp_table_chairs', 'стол привала', 'road'),
};
const KIND_CAMP_START = KINDS.length; // дальше — пропсы лагерей из generated.json (по id)
const kindOf = (prop: string) => { const i = KINDS.findIndex(q => q.type === 'prop' && q.prop === prop); return i >= 0 ? i : P(prop, prop, 'camp'); };

// ─── входные данные ───
const G = JSON.parse(readFileSync(join(HERE, 'world', 'generated.json'), 'utf8'));
const vec = JSON.parse(readFileSync(join(HERE, 'out', 'vectors.json'), 'utf8')) as { roads: { route: string; kind: string; pts: number[][] }[]; rivers: { pts: number[][] }[] };
const regionMap = decodePNG(readFileSync(join(HERE, 'out', 'regions_2048.png'))).data as Uint8Array;
const regionAt = (x: number, z: number) => REGION_POLYS[regionMap[Math.min(2047, Math.max(0, Math.floor(z / W * 2048))) * 2048 + Math.min(2047, Math.max(0, Math.floor(x / W * 2048)))]]?.id ?? '';

// детерминированный хеш
const hash = (x: number, z: number, s: number) => { let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const vn = (x: number, z: number, s: number) => { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm = (x: number, z: number, s: number) => vn(x, z, s) * 0.55 + vn(x * 2.03, z * 2.03, s + 1) * 0.3 + vn(x * 4.1, z * 4.1, s + 2) * 0.15;

// ─── маска «держать свободным» ───
// дороги (по векторам, ширина + 2), здания (+2), ядра лагерей (r 7), площадки деревень (r), входы пещер (r 6)
const keep: { x: number; z: number; r: number; soft?: boolean }[] = [];
for (const v of G.villages) keep.push({ x: v.at[0], z: v.at[1], r: v.padR, soft: true });
for (const v of G.villages) for (const b of v.buildings) keep.push({ x: b.at[0], z: b.at[1], r: Math.hypot(b.size[0], b.size[1]) / 2 + 2 });
for (const c of G.camps) keep.push({ x: c.at[0], z: c.at[1], r: 7 });
for (const s of G.sites) { if (s.cave) for (const e of s.cave.entrances) keep.push({ x: e.at[0], z: e.at[1], r: 6 }); else keep.push({ x: s.at[0], z: s.at[1], r: 5 }); }
const KB = 64, KG = Math.ceil(W / KB);
const keepGrid: typeof keep[] = Array.from({ length: KG * KG }, () => []);
for (const q of keep) for (let gz = Math.max(0, Math.floor((q.z - q.r) / KB)); gz <= Math.min(KG - 1, Math.floor((q.z + q.r) / KB)); gz++) for (let gx = Math.max(0, Math.floor((q.x - q.r) / KB)); gx <= Math.min(KG - 1, Math.floor((q.x + q.r) / KB)); gx++) keepGrid[gz * KG + gx].push(q);
/** 0 — свободно, 1 — мягко (площадка деревни: только мелочь у края), 2 — нельзя. */
const keepAt = (x: number, z: number) => { let r = 0; for (const q of keepGrid[Math.min(KG - 1, Math.floor(z / KB)) * KG + Math.min(KG - 1, Math.floor(x / KB))] ?? []) { const d = Math.hypot(x - q.x, z - q.z); if (d < q.r) { if (!q.soft) return 2; r = d < q.r - 12 ? 2 : 1; } } return r; };

// сегменты дорог по корзинам — для расстояния до дороги
type Seg = { a: number[]; b: number[]; kind: string };
const RB = 128, RG = Math.ceil(W / RB);
const roadGrid: Seg[][] = Array.from({ length: RG * RG }, () => []);
for (const r of vec.roads) for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1];
  for (let gz = Math.max(0, Math.floor((Math.min(a[1], b[1]) - 8) / RB)); gz <= Math.min(RG - 1, Math.floor((Math.max(a[1], b[1]) + 8) / RB)); gz++)
    for (let gx = Math.max(0, Math.floor((Math.min(a[0], b[0]) - 8) / RB)); gx <= Math.min(RG - 1, Math.floor((Math.max(a[0], b[0]) + 8) / RB)); gx++) roadGrid[gz * RG + gx].push({ a, b, kind: r.kind }); }
const roadD = (x: number, z: number) => { let best = 1e9; for (const s of roadGrid[Math.min(RG - 1, Math.floor(z / RB)) * RG + Math.min(RG - 1, Math.floor(x / RB))] ?? []) {
  const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1; const u = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2)); best = Math.min(best, Math.hypot(x - s.a[0] - dx * u, z - s.a[1] - dz * u)); } return best; };

// ─── природные ориентиры (вручную) ───
export const NATURAL_LANDMARKS = [
  { id: 'nl_old_oak', ru: 'Дуб-Прадед', at: [2380, 3600], kind: k.big, scale: 15, note: 'исполинский дуб в глуши Дремучего Леса, виден поверх крон' },
  { id: 'nl_twin_birches', ru: 'Две Сестры', at: [4520, 2960], kind: k.big, scale: 11, note: 'две огромные берёзы у Берёзовой Рощи' },
  { id: 'nl_stone_finger', ru: 'Каменный Перст', at: [5900, 4500], kind: k.rockH, scale: 15, note: 'одинокий останец на Медовых Холмах' },
  { id: 'nl_great_palm', ru: 'Пальма-Хранительница', at: [4560, 6700], kind: k.palm, scale: 15, note: 'самая высокая пальма оазиса' },
  { id: 'nl_frozen_giant', ru: 'Ледяной Великан', at: [3700, 1350], kind: k.snowPine, scale: 15, note: 'огромная заснеженная ель у Родника Светлой' },
  { id: 'nl_dead_grove', ru: 'Мёртвая Роща', at: [6200, 6250], kind: k.dead, scale: 13, note: 'кольцо сухих деревьев в Ржавой Пустоши' },
];

// ─── генерация по атласам ───
const sectors: number[][] = Array.from({ length: TILES * TILES }, () => []);
const density = new Uint8Array(512 * 512);
const counts: Record<string, number> = {};
const put = (wx: number, wz: number, kind: number, rot: number, variant: number, scale: number) => {
  const tx = Math.floor(wx / T), tz = Math.floor(wz / T); if (tx < 0 || tz < 0 || tx >= TILES || tz >= TILES || wx >= W || wz >= W) return;
  sectors[tz * TILES + tx].push((wx - tx * T) | ((wz - tz * T) << 8) | (kind << 16) | (((rot & 3) | ((variant & 3) << 2) | ((scale & 15) << 4)) << 24));
  const g = KINDS[kind].group; counts[g] = (counts[g] ?? 0) + 1;
  if (g === 'tree') { const di = Math.floor(wz / W * 512) * 512 + Math.floor(wx / W * 512); density[di] = Math.min(255, density[di] + 12); }
};
const violations: string[] = [];
const isWaterMat = (m: number) => m >= 20 && m <= 23;
for (let ay = 0; ay < 8; ay++) for (let ax = 0; ax < 8; ax++) {
  const img = decodePNG(readFileSync(join(VD, 'atlas', `a_${ax}_${ay}.png`)));
  const A = 1024, d = img.data as Uint8Array;
  const Y = (x: number, z: number) => { x = Math.min(A - 1, Math.max(0, x)); z = Math.min(A - 1, Math.max(0, z)); const o = (z * A + x) * 3; return ((d[o] << 8) | d[o + 1]) / 16; };
  const M = (x: number, z: number) => { x = Math.min(A - 1, Math.max(0, x)); z = Math.min(A - 1, Math.max(0, z)); return d[(z * A + x) * 3 + 2]; };
  const slope = (x: number, z: number) => Math.atan(Math.hypot(Y(x + 1, z) - Y(x - 1, z), Y(x, z + 1) - Y(x, z - 1)) / 2) * 180 / Math.PI;
  const nearWater = (x: number, z: number, r: number) => { for (let dz = -r; dz <= r; dz += r) for (let dx = -r; dx <= r; dx += r) if (isWaterMat(M(x + dx, z + dz)) && M(x + dx, z + dz) !== 22) return true; return false; };
  const ox = ax * A, oz = ay * A;
  // деревья: кандидаты на сетке 3×3 со сдвигом
  for (let cz = 0; cz < A; cz += 3) for (let cx = 0; cx < A; cx += 3) {
    const lx = cx + Math.floor(hash(cx + ox, cz + oz, 1) * 3), lz = cz + Math.floor(hash(cx + ox, cz + oz, 2) * 3);
    const wx = ox + lx, wz = oz + lz; if (wx >= W || wz >= W) continue;
    const m = M(lx, lz); if (isWaterMat(m) || m >= 24) continue;
    const sl = slope(lx, lz); const kp = keepAt(wx, wz); if (kp === 2) continue;
    if (roadD(wx, wz) < 4.5) continue;
    const r = hash(wx, wz, 3), r2 = hash(wx, wz, 4), rot = Math.floor(hash(wx, wz, 5) * 4), vari = Math.floor(hash(wx, wz, 6) * 3), sc = Math.floor(hash(wx, wz, 7) * 9) + 2;
    // характер леса: крупный шум «массив / поляна», опушка — у порога
    const f = fbm(wx / 180, wz / 180, 11); const patch = fbm(wx / 45, wz / 45, 12);
    const reg = regionAt(wx, wz); const ancient = reg === 'old_forest';
    const forestK = (lo: number) => Math.max(0, Math.min(1, (f - lo) / 0.12));
    let p = 0, kind = -1;
    const pickDecid = () => (ancient ? (r2 < 0.12 ? k.ivy : r2 < 0.16 ? k.big : r2 < 0.75 ? k.oak : k.oakA) : r2 < 0.45 ? k.oak : r2 < 0.7 ? k.birch : r2 < 0.85 ? k.oakY : k.oakA);
    switch (m) {
      case 4: p = (ancient ? 0.55 : 0.38) * forestK(0.32) * (patch > 0.3 ? 1 : 0.2); kind = pickDecid(); break; // лиственный лес
      case 7: p = 0.42 * forestK(0.3) * (patch > 0.28 ? 1 : 0.15); kind = r2 < 0.6 ? k.pine : pickDecid(); break; // смешанный
      case 9: p = 0.45 * forestK(0.28) * (patch > 0.25 ? 1 : 0.2); kind = r2 < 0.85 ? k.pine : k.birch; break; // тайга
      case 10: p = 0.06 * forestK(0.45); kind = k.snowPine; break; // заснеженные ели
      case 3: p = 0.012 + 0.05 * Math.max(0, f - 0.62); kind = r2 < 0.5 ? k.oak : r2 < 0.8 ? k.birch : k.oakY; break; // луга: одиночные деревья и рощицы
      case 6: p = 0.03; kind = r2 < 0.6 ? k.oak : k.pine; break;
      case 5: p = 0.16 * (patch > 0.35 ? 1 : 0.3); kind = r2 < 0.6 ? k.willow : r2 < 0.85 ? k.dead : k.oakA; break; // болото
      case 8: p = 0.008; kind = k.acacia; break; // сухая степь
      case 13: p = 0.004; kind = k.dead; break;
      case 14: p = 0.006; kind = r2 < 0.7 ? k.cactus : k.dead; break;
      case 16: p = 0.3; kind = k.palm; break; // оазис
      default: p = 0;
    }
    if (kp === 1) p *= 0.15;
    if (sl > 32) p *= 0.1;
    if (kind >= 0 && r < p) { put(wx, wz, kind, rot, vari, kind === k.big ? Math.min(15, sc + 4) : sc); continue; }
    // опушка: кусты, где лес редеет
    const edge = (m === 4 || m === 7 || m === 9) && f > 0.24 && f < 0.36;
    if (edge && r < 0.18 && kp === 0) { put(wx, wz, r2 < 0.4 ? k.bushT : r2 < 0.75 ? k.bushM : k.bushB, rot, vari, sc); continue; }
    // поваленные стволы и пни в лесу
    if ((m === 4 || m === 7 || m === 9) && f > 0.36 && r > 0.985 && kp === 0) put(wx, wz, r2 < 0.5 ? k.fallen : k.stump, rot, vari, 6);
  }
  // мелочь: кандидаты 4×4
  for (let cz = 0; cz < A; cz += 4) for (let cx = 0; cx < A; cx += 4) {
    const lx = cx + Math.floor(hash(cx + ox, cz + oz, 21) * 4), lz = cz + Math.floor(hash(cx + ox, cz + oz, 22) * 4);
    const wx = ox + lx, wz = oz + lz; if (wx >= W || wz >= W) continue;
    const m = M(lx, lz); if (isWaterMat(m) || m >= 24) continue;
    if (keepAt(wx, wz) === 2 || roadD(wx, wz) < 3.5) continue;
    const r = hash(wx, wz, 23), r2 = hash(wx, wz, 24), rot = Math.floor(hash(wx, wz, 25) * 4), vari = Math.floor(hash(wx, wz, 26) * 3), sc = Math.floor(hash(wx, wz, 27) * 9) + 2;
    const sl = slope(lx, lz);
    // осыпь под обрывами: рядом (вверх по склону) крутизна > 45°, здесь положе
    if (sl < 30 && r < 0.5) { let cliff = false; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (slope(lx + dx, lz + dz) > 45 && Y(lx + dx, lz + dz) > Y(lx, lz) + 2) cliff = true; if (cliff) { put(wx, wz, r2 < 0.5 ? k.slab : k.stones, rot, vari, sc); continue; } }
    // камни и валуны на склонах
    if (sl > 22 && sl < 42 && r < 0.12) { put(wx, wz, m === 4 || m === 7 ? k.rockMo : r2 < 0.5 ? k.rockL : r2 < 0.85 ? k.rockM : k.rockS, rot, vari, sc); continue; }
    // тростник у пресной воды
    if (nearWater(lx, lz, 2) && r < 0.45) { put(wx, wz, r2 < 0.5 ? k.reeds : r2 < 0.8 ? k.cattail : k.reedsL, rot, vari, sc); continue; }
    const f = fbm(wx / 180, wz / 180, 11);
    switch (m) {
      case 3: if (r < 0.035) put(wx, wz, [k.flW, k.flY, k.flR, k.flB, k.flP][Math.floor(r2 * 5)], rot, vari, sc); else if (r < 0.05) put(wx, wz, r2 < 0.6 ? k.bushL : k.bushF, rot, vari, sc); else if (r < 0.056) put(wx, wz, k.rockL, rot, vari, sc); break;
      case 4: case 7: if (f > 0.32 && r < 0.05) put(wx, wz, r2 < 0.4 ? k.fern : r2 < 0.7 ? k.under : r2 < 0.9 ? k.mush : k.bushB, rot, vari, sc); else if (regionAt(wx, wz) === 'old_forest' && r < 0.058) put(wx, wz, k.glow, rot, vari, sc); break;
      case 9: if (r < 0.03) put(wx, wz, r2 < 0.5 ? k.fern : k.bushL, rot, vari, sc); break;
      case 6: if (r < 0.03) put(wx, wz, r2 < 0.5 ? k.rockL : k.bushM, rot, vari, sc); break;
      case 5: if (r < 0.06) put(wx, wz, r2 < 0.5 ? k.cattail : k.reedsL, rot, vari, sc); break;
      case 8: if (r < 0.06) put(wx, wz, r2 < 0.6 ? k.grassD : k.bushD, rot, vari, sc); break;
      case 10: if (r < 0.012) put(wx, wz, k.snow, rot, vari, sc); break;
      case 11: case 17: if (r < 0.03) put(wx, wz, r2 < 0.5 ? k.rockM : k.rockH, rot, vari, sc); break;
      case 12: if (r < 0.004) put(wx, wz, k.crystal, rot, vari, sc); break;
      case 13: case 15: if (r < 0.02) put(wx, wz, r2 < 0.4 ? k.rockS : r2 < 0.8 ? k.rockL : k.bushD, rot, vari, sc); break;
      case 14: if (r < 0.01) put(wx, wz, k.bushD, rot, vari, sc); break;
      case 16: if (r < 0.06) put(wx, wz, k.palmB, rot, vari, sc); break;
      case 2: if (r < 0.01) put(wx, wz, k.stones, rot, vari, sc); break;
    }
  }
}

// ─── дороги: атмосферные пропсы ───
const roadNotes: { kind: string; at: number[] }[] = [];
const side = (pts: number[][], i: number, off: number): [number, number] => { const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [Math.round(a[0] - dz / l * off), Math.round(a[1] + dx / l * off)]; };
let roadI = 0;
for (const r of vec.roads) {
  let acc = 0;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    acc += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
    const [x, z] = r.pts[i];
    // фонари у деревень
    const nearV = G.villages.some((v: { at: number[]; padR: number }) => { const d = Math.hypot(x - v.at[0], z - v.at[1]); return d > v.padR - 10 && d < v.padR + 60; });
    if (nearV && acc > 18) { const [sx, sz] = side(r.pts, i, 4); if (keepAt(sx, sz) < 2) { put(sx, sz, k.lamp, 0, 0, 4); acc = 0; } continue; }
    if (acc < 260) continue;
    acc = 0; roadI++;
    const h = hash(Math.round(x), Math.round(z), 77); const [sx, sz] = side(r.pts, i, 6);
    if (keepAt(sx, sz) === 2) continue;
    if (h < 0.25) { put(sx, sz, k.cart, Math.floor(h * 16), 0, 4); put(sx + 3, sz + 2, k.crateB, 1, 0, 4); roadNotes.push({ kind: 'брошенная телега', at: [sx, sz] }); }
    else if (h < 0.42) { put(sx, sz, k.stakes, 1, 0, 4); put(sx + 2, sz - 2, k.sack, 0, 0, 4); put(sx - 2, sz + 1, k.crateB, 2, 0, 4); roadNotes.push({ kind: 'следы нападения', at: [sx, sz] }); }
    else if (h < 0.62) { put(sx, sz, k.fire, 0, 0, 4); put(sx + 4, sz, k.tent, 3, 1, 4); put(sx - 4, sz + 1, k.bench, 0, 0, 4); roadNotes.push({ kind: 'привал', at: [sx, sz] }); }
    else if (h < 0.8) { put(sx, sz, k.torch, 0, 0, 4); roadNotes.push({ kind: 'факел у дороги', at: [sx, sz] }); }
  }
}
// развилки: начало каждой второстепенной дороги
for (const r of vec.roads) if (r.kind !== 'main' && r.pts.length > 2) { const [sx, sz] = side(r.pts, 1, 4); if (keepAt(sx, sz) < 2) { put(sx, sz, k.banner, 0, Math.floor(hash(sx, sz, 9) * 4), 4); roadNotes.push({ kind: 'указатель на развилке', at: [sx, sz] }); } }

// ─── убранство лагерей: пропсы лагерей из данных мира ───
let campProps = 0;
const campAt = new Set<string>();
for (const c of G.camps) for (const p of c.props) { campAt.add(`${Math.round(p.at[0])},${Math.round(p.at[1])}`); put(Math.round(p.at[0]), Math.round(p.at[1]), kindOf(p.id), Math.floor(hash(Math.round(p.at[0]), Math.round(p.at[1]), 31) * 4), 0, 4); campProps++; }
// природные ориентиры
for (const l of NATURAL_LANDMARKS) put(l.at[0], l.at[1], l.kind, 0, 0, l.scale);

// ─── проверки ───
const insts = sectors.reduce((a, s) => a + s.length, 0);
for (let si = 0; si < sectors.length; si++) for (const v of sectors[si]) {
  const kind = (v >>> 16) & 255; const g = KINDS[kind].group; if (g === 'camp' || g === 'road') continue;
  const wx = (si % TILES) * T + (v & 255), wz = Math.floor(si / TILES) * T + ((v >>> 8) & 255);
  if (keepAt(wx, wz) === 2 && !campAt.has(`${wx},${wz}`) && !NATURAL_LANDMARKS.some(l => l.at[0] === wx && l.at[1] === wz)) violations.push(`${KINDS[kind].id} @ ${wx},${wz} в запретной зоне`);
  if (g === 'tree' && roadD(wx, wz) < 4 && !campAt.has(`${wx},${wz}`)) violations.push(`${KINDS[kind].id} @ ${wx},${wz} на дороге`);
  if (violations.length > 20) break;
}
// упаковка
const buf = Buffer.alloc(8 + 4 * 1025 + insts * 4); buf.write('CBD1', 0, 'ascii'); buf.writeUInt32LE(sectors.length, 4);
let o = 0; for (let i = 0; i < sectors.length; i++) { buf.writeUInt32LE(o, 8 + i * 4); for (const v of sectors[i]) { buf.writeUInt32LE(v >>> 0, 8 + 4 * 1025 + o * 4); o++; } } buf.writeUInt32LE(o, 8 + 1024 * 4);
mkdirSync(VD, { recursive: true });
writeFileSync(join(VD, 'detail.wasm'), buf);
writeFileSync(join(VD, 'detail_kinds.json'), JSON.stringify({ format: 'CBD1', sector: T, sectors: TILES, scale: '0.8 + s*0.06', kinds: KINDS, campKindsFrom: KIND_CAMP_START }));
const dens = new Uint8Array(512 * 512); for (let i = 0; i < dens.length; i++) dens[i] = density[i];
writeFileSync(join(VD, 'detail_density_512.png'), encodePNG(512, 512, dens, 1, 8));
const hashHex = createHash('sha256').update(buf).digest('hex');
const perSector = sectors.map(s => s.length);
const stats = { generatedBy: 'tools/continent/detail.ts', instances: insts, bytes: buf.length, hash: hashHex, kinds: KINDS.length, byGroup: counts, campProps, roadDressing: roadNotes.length, roadDressingByKind: roadNotes.reduce((a: Record<string, number>, n) => (a[n.kind] = (a[n.kind] ?? 0) + 1, a), {}),
  naturalLandmarks: NATURAL_LANDMARKS.map(l => ({ id: l.id, ru: l.ru, at: l.at, prop: KINDS[l.kind].id, scale: +(0.8 + l.scale * 0.06).toFixed(2), note: l.note })),
  maxPerSector: Math.max(...perSector), meanPerSector: Math.round(insts / sectors.length), violations };
writeFileSync(join(HERE, '..', '..', 'docs', 'continent', 'detail_stats.json'), JSON.stringify(stats, null, 1));
console.log(JSON.stringify({ instances: insts, MB: (buf.length / 1e6).toFixed(2), byGroup: counts, maxPerSector: stats.maxPerSector, violations: violations.length, hash: hashHex.slice(0, 16) }));
if (violations.length) { console.error(violations.slice(0, 10).join('\n')); process.exit(1); }
