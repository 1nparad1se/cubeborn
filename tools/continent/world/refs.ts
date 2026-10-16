// Разбор ссылок на места мира (этап 6): village:, bld:, site:, camp:, landmark:, route:, road:, lake:, secret:.
import type { P } from '../geom';

export interface Resolved { ref: string; kind: string; id: string; ru: string; at: P | null; pts?: P[]; lv?: [number, number]; line: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function makeResolver(G: Any, F: Any, secrets: Any[]) {
  const by = <T extends { id: string }>(arr: T[]) => new Map(arr.map(x => [x.id, x]));
  const villages = by(G.villages as Any[]), sites = by(G.sites as Any[]), camps = by(G.camps as Any[]);
  const landmarks = by(F.landmarks as Any[]), lakes = by(F.lakes as Any[]), routes = by(F.routes as Any[]), roads = by(G.sideRoads as Any[]), sec = by(secrets);
  return (ref: string): Resolved | null => {
    const i = ref.indexOf(':'); const kind = ref.slice(0, i), id = ref.slice(i + 1);
    const R = (ru: string, at: P | null, extra: Partial<Resolved> = {}): Resolved => ({ ref, kind, id, ru, at, line: false, ...extra });
    switch (kind) {
      case 'village': { const v = villages.get(id); return v ? R(v.ru, v.at) : null; }
      case 'bld': { const [vi, bi] = id.split('.'); const v = villages.get(vi); const b = v?.buildings.find((x: Any) => x.id === bi); return b ? R(`${v.ru}: ${b.ru}`, b.at) : null; }
      case 'site': { const s = sites.get(id); return s ? R(s.ru, s.cave ? s.cave.entrances[0].at : s.at, s.cave ? { lv: s.cave.lv } : {}) : null; }
      case 'camp': { const c = camps.get(id); return c ? R(c.ru, c.at, { lv: [c.lvMin, c.lvMax] }) : null; }
      case 'landmark': { const l = landmarks.get(id); return l ? R(l.ru, l.at) : null; }
      case 'lake': { const l = lakes.get(id); return l ? R(l.ru, l.at) : null; }
      case 'secret': { const s = sec.get(id); return s ? R(s.ru, s.at, { lv: [s.lv, s.lv] }) : null; }
      case 'route': { const r = routes.get(id); if (!r) return null; const pts = r.legs.flatMap((l: Any) => l.pts) as P[]; return R(r.ru, pts[Math.floor(pts.length / 2)], { pts, line: true }); }
      case 'road': { const r = roads.get(id); return r ? R(r.ru, r.pts[r.pts.length - 1], { pts: r.pts, line: true }) : null; }
    }
    return null;
  };
}
/** Цель задания: первая ссылка, которая не деревня/здание/маршрут. */
export const targetOf = (loc: string[]) => loc.find(r => !/^(village|bld|route|road):/.test(r)) ?? null;
