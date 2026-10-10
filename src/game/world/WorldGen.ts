import { WORLD } from '../../config/world';
import { Rng } from '../../core/Rng';
import { ELITE_IDS, ENEMY_BY_ID, type EliteId } from '../../data/enemies';
import type { Loc, MapDef } from '../../data/types';
import { CELL, replaceAll } from '../Terrain';
import type { GenCtx } from '../mapgen/common';
import type { WorldHooks } from '../mapgen/generators';

/**
 * Open-world layout of one location: a safe town in the middle, rings of hunting areas whose
 * monster level rises with the distance from the town, camps of resident monsters, named elites
 * and boss lairs. Everything is deterministic for a seed.
 */

export type CampKind = 'pack' | 'camp' | 'lone' | 'patrol' | 'elite';
export type StationKind = 'forge' | 'shop' | 'stash' | 'teleport';

export interface Area {
  id: number;
  ring: number;
  sector: number;
  name: Loc;
  lo: number;
  hi: number;
  mobs: string[];
}

export interface CampDef {
  x: number;
  z: number;
  kind: CampKind;
  area: number;
  level: number;
  /** One monster id per member. */
  ids: string[];
  aggressive: boolean;
  respawn: [number, number];
  /** Patrol: the far end of its route. */
  wx?: number;
  wz?: number;
  /** Named elite: its affix and name (member 0 is the elite, the rest its escort). */
  elite?: EliteId;
  name?: Loc;
}

export interface Lair {
  x: number;
  z: number;
  boss: string;
  level: number;
  name: Loc;
}

export interface Station {
  kind: StationKind;
  x: number;
  z: number;
}

export interface WorldLayout {
  size: number;
  c: number;
  areas: Area[];
  camps: CampDef[];
  lairs: Lair[];
  stations: Station[];
}

// ------------------------------------------------------------------ names
const AREA_NAMES: Record<string, Loc[]> = {
  blightwood: [
    { ru: 'Северная опушка', en: 'North Verge' }, { ru: 'Мшистый луг', en: 'Mossy Meadow' }, { ru: 'Южная опушка', en: 'South Verge' }, { ru: 'Старая просека', en: 'Old Clearing' },
    { ru: 'Грибные холмы', en: 'Mushroom Hills' }, { ru: 'Волчья тропа', en: 'Wolf Trail' }, { ru: 'Тихий ручей', en: 'Quiet Brook' }, { ru: 'Пни лесорубов', en: "Woodcutters' Stumps" },
    { ru: 'Гнилые топи', en: 'Rotting Fens' }, { ru: 'Споровая лощина', en: 'Spore Hollow' }, { ru: 'Жабье болото', en: 'Toad Mire' }, { ru: 'Кривой бор', en: 'Crooked Pines' },
    { ru: 'Чёрная чаща', en: 'Black Thicket' }, { ru: 'Шаманий круг', en: "Shaman's Ring" }, { ru: 'Терновник', en: 'Thornbrake' }, { ru: 'Мёртвая роща', en: 'Dead Grove' },
    { ru: 'Сердце гнили', en: 'Heart of Blight' }, { ru: 'Корневой провал', en: 'Root Chasm' }, { ru: 'Чумные дебри', en: 'Plague Wilds' }, { ru: 'Пустошь спор', en: 'Spore Waste' },
  ],
};
const ELITE_NAMES: Loc[] = [
  { ru: 'Скарр Гнилозуб', en: 'Skarr Rotfang' }, { ru: 'Мать-Плесень', en: 'Mother Mold' }, { ru: 'Хромой Ворг', en: 'Lame Vorg' }, { ru: 'Старый Терн', en: 'Old Thorn' },
  { ru: 'Бледная Ведьма', en: 'Pale Witch' }, { ru: 'Гриб-Великан', en: 'Giant Toadstool' }, { ru: 'Кривоног', en: 'Crookleg' }, { ru: 'Пожиратель Корней', en: 'Root Eater' },
  { ru: 'Шептун', en: 'The Whisperer' }, { ru: 'Слизнежаб', en: 'Slimetoad' }, { ru: 'Костолом', en: 'Bonebreaker' }, { ru: 'Сумрачный Клык', en: 'Dusk Fang' },
  { ru: 'Гнилобрюх', en: 'Rotbelly' }, { ru: 'Чёрный Жук', en: 'Black Beetle' }, { ru: 'Вдова Спор', en: 'Spore Widow' },
];

/** Monster level at a distance from the town: 1 at the gates, +1 every half ring, 10 at the far edge. */
export function levelAtDist(d: number, lo = 1, hi = 10): number {
  const k = Math.floor((d - WORLD.ringStart) / (WORLD.ringW / 2));
  return Math.max(lo, Math.min(hi, lo + k));
}

export function ringOf(d: number): number {
  return Math.max(0, Math.min(WORLD.rings - 1, Math.floor((d - WORLD.ringStart) / WORLD.ringW)));
}

export function sectorOf(dx: number, dz: number): number {
  const a = Math.atan2(dz, dx) + Math.PI + Math.PI / WORLD.sectors;
  return Math.floor((a / (Math.PI * 2)) * WORLD.sectors) % WORLD.sectors;
}

/** Builds the world layout and the generation hooks that carve it into the terrain. */
export function worldPlan(map: MapDef, seed: number, levels: [number, number]): { layout: WorldLayout; hooks: WorldHooks } {
  const size = WORLD.size;
  const c = Math.floor(size / 2);
  const rng = new Rng(seed ^ 0x5eed);
  const [lo, hi] = levels;
  const lvlSpan = hi - lo + 1;
  // ---- areas
  const areas: Area[] = [];
  const segs = map.segments;
  const segIdx = [0, 2, 3, 4, 5];
  const names = AREA_NAMES[map.id] ?? AREA_NAMES.blightwood;
  for (let r = 0; r < WORLD.rings; r++)
    for (let s = 0; s < WORLD.sectors; s++) {
      const seg = segs[Math.min(segs.length - 1, segIdx[r] ?? r)];
      const pool = [...seg.pool].sort((a, b) => b[1] - a[1]).map((p) => p[0]).filter((id) => ENEMY_BY_ID[id]);
      const mobs: string[] = [];
      for (let k = 0; k < Math.min(3, pool.length); k++) mobs.push(pool[(s + k) % pool.length]);
      // the inner ring borrows a flyer from the next segment so it is not only zombies
      if (r === 0 && s >= 2 && segs[1]) {
        const extra = segs[1].pool.map((p) => p[0]).find((id) => !mobs.includes(id) && ENEMY_BY_ID[id]);
        if (extra) mobs.push(extra);
      }
      const a0 = lo + Math.round((r * 2 * lvlSpan) / (WORLD.rings * 2));
      areas.push({ id: r * WORLD.sectors + s, ring: r, sector: s, name: names[r * WORLD.sectors + s] ?? { ru: 'Дикие земли', en: 'Wilds' }, lo: Math.min(hi, a0), hi: Math.min(hi, a0 + 1), mobs });
    }
  const areaOf = (x: number, z: number) => {
    const d = Math.hypot(x - c, z - c);
    return areas[ringOf(d) * WORLD.sectors + sectorOf(x - c, z - c)];
  };
  const lvAt = (x: number, z: number) => levelAtDist(Math.hypot(x - c, z - c), lo, hi);
  const hp = (id: string) => ENEMY_BY_ID[id]?.hp ?? 0;

  // ---- lairs (the location boss at the far edge, the field boss half way)
  const la = rng.next() * Math.PI * 2;
  const lairs: Lair[] = [
    { x: Math.round(c + Math.cos(la) * 452), z: Math.round(c + Math.sin(la) * 452), boss: map.boss, level: hi, name: { ru: 'Логово хозяина леса', en: "Forest Lord's Lair" } },
    { x: Math.round(c + Math.cos(la + Math.PI) * 262), z: Math.round(c + Math.sin(la + Math.PI) * 262), boss: map.midBoss, level: levelAtDist(262, lo, hi), name: { ru: 'Гнездо матки', en: "Brood Mother's Nest" } },
  ];

  // ---- camps on a jittered grid
  const camps: CampDef[] = [];
  const step = WORLD.campStep;
  const near = (x: number, z: number, r: number) => lairs.some((l) => Math.hypot(l.x - x, l.z - z) < r);
  for (let gz = step / 2; gz < size; gz += step)
    for (let gx = step / 2; gx < size; gx += step) {
      const x = Math.round(gx + rng.range(-WORLD.campJitter, WORLD.campJitter));
      const z = Math.round(gz + rng.range(-WORLD.campJitter, WORLD.campJitter));
      if (Math.min(x, z, size - 1 - x, size - 1 - z) < 16) continue;
      const d = Math.hypot(x - c, z - c);
      if (d < WORLD.campMinD || near(x, z, 30)) continue;
      const area = areaOf(x, z);
      const level = lvAt(x, z);
      const passive = rng.chance(WORLD.passiveShare[area.ring] ?? 0);
      const roll = rng.next();
      const kind: CampKind = roll < 0.48 ? 'pack' : roll < 0.72 ? 'camp' : roll < 0.88 ? 'lone' : 'patrol';
      const ids: string[] = [];
      const mobs = area.mobs;
      if (kind === 'pack') {
        const id = rng.pick(mobs);
        for (let i = rng.int(3, 4); i > 0; i--) ids.push(id);
      } else if (kind === 'camp') {
        const a = rng.pick(mobs);
        const b = rng.pick(mobs);
        for (let i = rng.int(4, 5); i > 0; i--) ids.push(i % 2 ? a : b);
      } else if (kind === 'lone') {
        const tough = [...mobs].sort((p, q) => hp(q) - hp(p))[0];
        for (let i = rng.int(1, 2); i > 0; i--) ids.push(tough);
      } else {
        const id = rng.pick(mobs);
        for (let i = 3; i > 0; i--) ids.push(id);
      }
      const camp: CampDef = { x, z, kind, area: area.id, level: Math.min(hi, level + (kind === 'lone' ? 1 : 0)), ids, aggressive: kind === 'camp' || kind === 'patrol' ? area.ring > 0 || !passive : !passive, respawn: WORLD.respawn.normal };
      if (kind === 'patrol') {
        const a = rng.next() * Math.PI * 2;
        camp.wx = x + Math.cos(a) * 22;
        camp.wz = z + Math.sin(a) * 22;
      }
      camps.push(camp);
    }
  // ---- named elites (replace a camp of the right ring)
  let nameI = Math.floor(rng.next() * ELITE_NAMES.length);
  for (let r = 0; r < WORLD.rings; r++) {
    const cands = camps.filter((k) => k.kind !== 'elite' && areas[k.area].ring === r && Math.hypot(k.x - c, k.z - c) > WORLD.ringStart + r * WORLD.ringW + 12);
    for (let i = 0; i < (WORLD.elitesPerRing[r] ?? 0) && cands.length; i++) {
      const k = cands.splice(Math.floor(rng.next() * cands.length), 1)[0];
      const mobs = areas[k.area].mobs;
      const boss = [...mobs].sort((p, q) => hp(q) - hp(p))[0];
      k.kind = 'elite';
      k.ids = [boss, rng.pick(mobs), rng.pick(mobs)];
      k.level = Math.min(hi, k.level + 2);
      k.aggressive = true;
      k.elite = rng.pick(ELITE_IDS);
      k.name = ELITE_NAMES[nameI++ % ELITE_NAMES.length];
      k.respawn = WORLD.respawn.elite;
      delete k.wx;
      delete k.wz;
    }
  }

  const stations: Station[] = [
    { kind: 'forge', x: c - 11, z: c - 7 },
    { kind: 'shop', x: c + 11, z: c - 7 },
    { kind: 'stash', x: c - 11, z: c + 8 },
    { kind: 'teleport', x: c + 11, z: c + 8 },
  ];
  const layout: WorldLayout = { size, c, areas, camps, lairs, stations };

  // ---- carving
  const campR = (k: CampDef) => (k.kind === 'camp' ? 5 : k.kind === 'elite' ? 7 : 3);
  const hooks: WorldHooks = {
    pre(g: GenCtx) {
      const t = g.t;
      const n = t.size;
      const mask = new Uint8Array(n * n);
      const disk = (cx: number, cz: number, r: number, tile: string | null) => {
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            if (!t.inBounds(x, z) || (x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
            const i = z * n + x;
            if (t.cell[i] === CELL.wall) continue;
            mask[i] = 1;
            t.cell[i] = CELL.floor;
            t.height[i] = 0;
            if (tile) t.setTile(x, z, tile);
            else if (/bog|water/.test(t.tileNames[t.tile[i]] ?? '')) t.setTile(x, z, 'dirt');
          }
      };
      /** A wobbling road that clears everything in its way. */
      const road = (x0: number, z0: number, x1: number, z1: number, w: number) => {
        let x = x0;
        let z = z0;
        let guard = 0;
        while (Math.hypot(x1 - x, z1 - z) > 1.5 && guard++ < 3000) {
          const a = Math.atan2(z1 - z, x1 - x) + (rng.next() - 0.5) * 0.7;
          x += Math.cos(a);
          z += Math.sin(a);
          disk(x, z, w / 2, 'path');
        }
      };
      disk(c, c, WORLD.safeR, 'grass');
      for (const l of lairs) disk(l.x, l.z, 21, 'dirt');
      for (const k of camps) disk(k.x, k.z, campR(k), k.kind === 'camp' || k.kind === 'elite' ? 'dirt' : null);
      // roads: from the four gates outwards, and to every lair and elite
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        road(c + Math.cos(a) * (WORLD.townR - 2), c + Math.sin(a) * (WORLD.townR - 2), c + Math.cos(a) * 150, c + Math.sin(a) * 150, 3);
      }
      for (const tg of [...lairs, ...camps.filter((k) => k.kind === 'elite')]) {
        const a = Math.atan2(tg.z - c, tg.x - c);
        road(c + Math.cos(a) * (WORLD.townR + 2), c + Math.sin(a) * (WORLD.townR + 2), tg.x, tg.z, 3);
      }
      // remove whatever stood on the cleared ground
      const masked = (x: number, z: number) => {
        const cx = Math.floor(x);
        const cz = Math.floor(z);
        return t.inBounds(cx, cz) && mask[cz * n + cx] === 1;
      };
      replaceAll(t.trees, t.trees.filter((tr) => !masked(tr.x, tr.z)));
      replaceAll(t.blocks, t.blocks.filter((b) => b.y > 6 || !masked(b.x, b.z)));
      replaceAll(t.decor, t.decor.filter((d) => !masked(d.x, d.z)));
      replaceAll(t.spots, t.spots.filter((s) => !masked(s.x, s.z)));
      replaceAll(t.roofs, t.roofs.filter((r) => !masked(r.x + r.w / 2, r.z + r.d / 2)));
      return mask;
    },
    post(g: GenCtx) {
      const t = g.t;
      const n = t.size;
      // points of interest of the generic map zones may have landed in the town or a lair: clear again
      const clear = (cx: number, cz: number, r: number) => {
        for (let z = cz - r; z <= cz + r; z++)
          for (let x = cx - r; x <= cx + r; x++) {
            if (!t.inBounds(x, z) || (x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
            const i = z * n + x;
            if (t.cell[i] === CELL.wall) continue;
            t.cell[i] = CELL.floor;
            t.height[i] = 0;
            t.elev[i] = 0;
          }
        const out = (x: number, z: number) => (x - cx) ** 2 + (z - cz) ** 2 > (r + 0.5) ** 2;
        replaceAll(t.blocks, t.blocks.filter((b) => out(b.x, b.z)));
        replaceAll(t.trees, t.trees.filter((b) => out(b.x, b.z)));
        replaceAll(t.roofs, t.roofs.filter((b) => out(b.x + b.w / 2, b.z + b.d / 2)));
        replaceAll(t.decor, t.decor.filter((b) => out(b.x, b.z)));
        replaceAll(t.lights, t.lights.filter((b) => out(b.x, b.z)));
        replaceAll(t.markers, t.markers.filter((b) => out(b.x, b.z)));
      };
      clear(c, c, WORLD.safeR);
      for (const l of lairs) clear(l.x, l.z, 19);
      // ---- town: plaza, palisade with four gates, stations
      for (let z = c - WORLD.safeR; z <= c + WORLD.safeR; z++)
        for (let x = c - WORLD.safeR; x <= c + WORLD.safeR; x++) {
          const d = Math.hypot(x - c, z - c);
          if (d < WORLD.townR - 3) t.setTile(x, z, d < 9 ? 'dirt' : 'path');
        }
      for (let k = 0; k < 360; k++) {
        const a = (k / 360) * Math.PI * 2;
        const gate = [0, 1, 2, 3].some((i) => Math.abs(Math.atan2(Math.sin(a - (i * Math.PI) / 2), Math.cos(a - (i * Math.PI) / 2))) < 0.13);
        if (gate) continue;
        const x = Math.round(c + Math.cos(a) * WORLD.townR);
        const z = Math.round(c + Math.sin(a) * WORLD.townR);
        if (t.cell[t.idx(x, z)] !== CELL.solid) t.column(x, z, 2, 'plank');
      }
      // gate torches
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        for (const s of [-1, 1]) {
          const x = Math.round(c + Math.cos(a) * WORLD.townR - Math.sin(a) * 4.5 * s);
          const z = Math.round(c + Math.sin(a) * WORLD.townR + Math.cos(a) * 4.5 * s);
          t.column(x, z, 3, 'trunk');
          t.addBlock(x, 3, z, 'mushroom', 0, true, 0.5);
          t.lights.push({ x: x + 0.5, z: z + 0.5, y: 3.4, color: 0xffa040, intensity: 1.4 });
        }
      }
      // beacon at the respawn point
      t.column(c, c - 3, 3, 'stone');
      t.addBlock(c, 3, c - 3, 'mushroom', 1, true, 0.7);
      t.lights.push({ x: c + 0.5, z: c - 2.5, y: 3.5, color: 0xfff0c0, intensity: 1.6 });
      for (const st of stations) {
        const { x, z } = st;
        if (st.kind === 'forge') {
          t.column(x - 1, z - 1, 2, 'stone');
          t.column(x, z - 1, 2, 'stone');
          t.column(x + 1, z - 1, 2, 'stone');
          t.addBlock(x, 2, z - 1, 'mushroom', 0, true, 0.8);
          t.column(x + 2, z, 1, 'stone', 1);
          t.lights.push({ x: x + 0.5, z: z, y: 2, color: 0xff6a20, intensity: 2 });
        } else if (st.kind === 'shop') {
          for (let dx = -1; dx <= 1; dx++) t.column(x + dx, z - 1, 1, 'plank');
          t.column(x - 2, z - 1, 3, 'trunk');
          t.column(x + 2, z - 1, 3, 'trunk');
          t.roofs.push({ x: x - 2, z: z - 2, w: 5, d: 2, y: 3, mat: 'leaves' });
          t.lights.push({ x: x + 0.5, z: z, y: 2.5, color: 0xffd080, intensity: 1.2 });
        } else if (st.kind === 'stash') {
          t.column(x - 1, z - 1, 1, 'plank', 1);
          t.column(x + 1, z - 1, 1, 'plank', 1);
          t.column(x, z - 2, 2, 'plank');
          t.addBlock(x, 0, z - 1, 'stone', 0, false, 0.6);
          t.lights.push({ x: x + 0.5, z: z, y: 2.2, color: 0xffd080, intensity: 1 });
        } else {
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const px = Math.round(x + Math.cos(a) * 2.6);
            const pz = Math.round(z + Math.sin(a) * 2.6);
            t.column(px, pz, 2, 'stone');
            t.addBlock(px, 2, pz, 'leaves', 3, true, 0.4);
          }
          t.lights.push({ x: x + 0.5, z: z + 0.5, y: 1.5, color: 0x8ab8ff, intensity: 2 });
        }
      }
      // ---- lairs: a ring of standing stones
      for (const l of lairs) {
        for (let k = 0; k < 14; k++) {
          if (k % 7 === 0) continue;
          const a = (k / 14) * Math.PI * 2;
          const x = Math.round(l.x + Math.cos(a) * 19);
          const z = Math.round(l.z + Math.sin(a) * 19);
          t.column(x, z, 3 + (k % 2), 'stone');
          if (k % 2) t.addBlock(x, 4, z, 'mushroom', 0, true, 0.45);
        }
        t.lights.push({ x: l.x, z: l.z, y: 3, color: 0xa04aff, intensity: 2.2 });
      }
      // ---- camps: walkable centres (drop the ones sealed in), campfires
      const ok = (x: number, z: number) => t.walkableAt(x + 0.5, z + 0.5);
      const keep: CampDef[] = [];
      for (const k of camps) {
        let fx = -1;
        let fz = -1;
        for (let r = 0; r <= 6 && fx < 0; r++)
          for (let a = 0; a < 8 && fx < 0; a++) {
            const x = Math.round(k.x + Math.cos((a / 8) * Math.PI * 2) * r);
            const z = Math.round(k.z + Math.sin((a / 8) * Math.PI * 2) * r);
            if (ok(x, z) && Math.hypot(x - c, z - c) > WORLD.safeR + 6) {
              fx = x;
              fz = z;
            }
          }
        if (fx < 0) continue;
        k.x = fx + 0.5;
        k.z = fz + 0.5;
        if (k.kind === 'camp' || k.kind === 'elite') {
          const ex = fx + 2;
          const ez = fz;
          if (ok(ex, ez)) {
            t.addBlock(ex, 0, ez, 'mushroom', 0, true, 0.35);
            t.addBlock(ex, 0, ez, 'trunk', 0, false, 0.55);
            t.lights.push({ x: ex + 0.5, z: ez + 0.5, y: 1.2, color: k.kind === 'elite' ? 0xff4a3a : 0xff9a40, intensity: 1.1 });
          }
        }
        keep.push(k);
      }
      replaceAll(camps, keep);
    },
  };
  return { layout, hooks };
}
