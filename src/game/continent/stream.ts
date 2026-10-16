import type { Terrain } from '../Terrain';
import { nearestWalkable } from '../arpg/Path';
import { WORLD, type ContinentData } from './data';
import { WIN, buildWindow, type WindowStats } from './window';

/** The hero stays within this band of the window (local cells); leaving it moves the window. */
const BAND = 128;
/** Window origins snap to this grid (fewer distinct windows, cache-friendly). */
const SNAP = 64;

/**
 * Streams the continent around the hero: one WIN² window terrain at a time. When the hero leaves
 * the central band the atlases for the next window load in the background, then the window is
 * rebuilt around the hero (the old one is dropped, so memory stays bounded: one window plus at
 * most AtlasCache.max decoded atlases).
 */
export class ContinentStream {
  terrain: Terrain;
  lastStats: WindowStats;
  /** Origin being loaded, and whether its atlases are ready. */
  private want: { ox: number; oz: number; ready: boolean; p: Promise<void> } | null = null;
  shifts = 0;

  private constructor(readonly data: ContinentData, t: Terrain, s: WindowStats) {
    this.terrain = t;
    this.lastStats = s;
  }

  static originFor(x: number, z: number): [number, number] {
    const c = (v: number) => Math.max(0, Math.min(WORLD - WIN, Math.round((v - WIN / 2) / SNAP) * SNAP));
    return [c(x), c(z)];
  }

  /** Loads the atlases around (x, z) and builds the first window. */
  static async open(data: ContinentData, x: number, z: number): Promise<ContinentStream> {
    const [ox, oz] = ContinentStream.originFor(x, z);
    await data.atlases.ensure(ox, oz, ox + WIN, oz + WIN);
    const { t, stats } = buildWindow(data, ox, oz);
    return new ContinentStream(data, t, stats);
  }

  /** Whether world point (x, z) lies inside the window, at least `pad` cells from its edge. */
  covers(x: number, z: number, pad = 8): boolean {
    const t = this.terrain;
    return x >= t.ox + pad && z >= t.oz + pad && x < t.ox + WIN - pad && z < t.oz + WIN - pad;
  }

  /** Starts loading the window around (x, z) (no-op when it is already wanted). */
  request(x: number, z: number) {
    const [ox, oz] = ContinentStream.originFor(x, z);
    if (ox === this.terrain.ox && oz === this.terrain.oz) return;
    if (this.want && this.want.ox === ox && this.want.oz === oz) return;
    const w = { ox, oz, ready: false, p: Promise.resolve() };
    w.p = this.data.atlases.ensure(ox, oz, ox + WIN, oz + WIN).then(() => {
      w.ready = true;
    });
    this.want = w;
  }

  /**
   * Per frame: keeps the window around the hero. Returns the new terrain when the window moved
   * (the caller swaps it in), else null.
   */
  update(x: number, z: number): Terrain | null {
    const t = this.terrain;
    const lx = x - t.ox;
    const lz = z - t.oz;
    const edgeX = (t.ox > 0 && lx < BAND) || (t.ox < WORLD - WIN && lx > WIN - BAND);
    const edgeZ = (t.oz > 0 && lz < BAND) || (t.oz < WORLD - WIN && lz > WIN - BAND);
    if (edgeX || edgeZ) this.request(x, z);
    const w = this.want;
    if (!w || !w.ready) return null;
    this.want = null;
    // still worth it? (the hero may have turned back)
    const [ox, oz] = ContinentStream.originFor(x, z);
    if (Math.abs(ox - w.ox) > SNAP * 2 || Math.abs(oz - w.oz) > SNAP * 2) {
      this.request(x, z);
      return null;
    }
    if (!this.data.atlases.has(w.ox, w.oz, w.ox + WIN, w.oz + WIN)) {
      this.request(x, z);
      return null;
    }
    const { t: nt, stats } = buildWindow(this.data, w.ox, w.oz);
    this.terrain = nt;
    this.lastStats = stats;
    this.shifts++;
    return nt;
  }

  /** Resolves when the requested window's atlases are loaded (tests, teleports). */
  async settle(): Promise<void> {
    if (this.want) await this.want.p;
  }

  /** The window around (x, z) right now (teleport): loads and builds, then returns it. */
  async jump(x: number, z: number): Promise<Terrain> {
    const [ox, oz] = ContinentStream.originFor(x, z);
    if (ox !== this.terrain.ox || oz !== this.terrain.oz) {
      await this.data.atlases.ensure(ox, oz, ox + WIN, oz + WIN);
      const { t, stats } = buildWindow(this.data, ox, oz);
      this.terrain = t;
      this.lastStats = stats;
      this.shifts++;
      this.want = null;
    }
    return this.terrain;
  }

  /** A walkable point near (x, z) in the current window. */
  walkableNear(x: number, z: number): { x: number; z: number } {
    const p = nearestWalkable(this.terrain, x, z, 12);
    return p ? { x: p[0], z: p[1] } : { x, z };
  }
}

/** The hero's start: the square of Зеленодол, south of the well. */
export const CONTINENT_SPAWN = { x: 3784.5, z: 3941.5 };

/** The continent opened for the next run (App loads it before entering the world). */
let current: ContinentStream | null = null;
export function setContinent(s: ContinentStream | null) {
  current = s;
}
export function continent(): ContinentStream | null {
  return current;
}
