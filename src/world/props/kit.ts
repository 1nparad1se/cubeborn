import type { Anim, Part, PropEmitter, PropLight, PropModel, TexSpec } from './types';

/**
 * Builder kit shared by all prop categories: a model accumulator with box helpers (all in px,
 * see types.ts) plus ready-made pieces that several sheets reuse (lanterns, flames, posts,
 * crates, stones). Category files compose these; keep category-specific pieces in their file.
 */

type BoxOpts = Partial<Omit<Part, 'x' | 'y' | 'z' | 'w' | 'h' | 'd' | 'tex'>>;

export class Model implements PropModel {
  parts: Part[] = [];
  lights: PropLight[] = [];
  emitters: PropEmitter[] = [];

  /** Box by min corner. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, tex: TexSpec, o: BoxOpts = {}): Part {
    const p: Part = { x, y, z, w, h, d, tex, ...o };
    this.parts.push(p);
    return p;
  }

  /** Box centred on (cx, cz) horizontally, standing on y. */
  cbox(cx: number, y: number, cz: number, w: number, h: number, d: number, tex: TexSpec, o: BoxOpts = {}): Part {
    return this.box(cx - w / 2, y, cz - d / 2, w, h, d, tex, o);
  }

  light(x: number, y: number, z: number, color: number, intensity: number, radius: number, flicker = 0.6, day?: number) {
    this.lights.push({ x, y, z, color, intensity, radius, flicker, day });
  }

  emit(e: PropEmitter) {
    this.emitters.push(e);
  }

  /** Copies another model's content shifted by (dx, dy, dz). */
  add(m: PropModel, dx = 0, dy = 0, dz = 0): this {
    const sh = <T extends { x: number; y: number; z: number }>(o: T): T => ({ ...o, x: o.x + dx, y: o.y + dy, z: o.z + dz });
    for (const p of m.parts) {
      const q = sh(p);
      if (p.anim?.pivot) q.anim = { ...p.anim, pivot: [p.anim.pivot[0] + dx, p.anim.pivot[1] + dy, p.anim.pivot[2] + dz] };
      if (p.rot?.pivot) q.rot = { ...p.rot, pivot: [p.rot.pivot[0] + dx, p.rot.pivot[1] + dy, p.rot.pivot[2] + dz] };
      this.parts.push(q);
    }
    for (const l of m.lights ?? []) this.lights.push(sh(l));
    for (const e of m.emitters ?? []) this.emitters.push(sh(e));
    return this;
  }

  /** Applies an animation to every part added since `from` (an index into parts). */
  animate(from: number, anim: Anim): this {
    for (let i = from; i < this.parts.length; i++) this.parts[i].anim = anim;
    return this;
  }

  get mark(): number {
    return this.parts.length;
  }
}

/** Seeded random helpers on a BuildCtx.rnd. */
export const pick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length) % arr.length];
export const rr = (rnd: () => number, a: number, b: number) => a + (b - a) * rnd();

// ---------------------------------------------------------------- shared pieces

export const WARM = 0xffa040;
export const FIRE_LIGHT = 0xff8a2a;

/**
 * Lantern (wooden/iron frame, glowing glass, roof cap, handle ring). (x, y, z) = bottom centre.
 * Size 's' small (8x12), 'm' (10x14). Returns the model; light at the glass centre.
 */
export function lantern(x: number, y: number, z: number, size: 's' | 'm' = 'm', frame = 'beam_dark', light = true): Model {
  const m = new Model();
  const w = size === 's' ? 8 : 10;
  const gh = size === 's' ? 7 : 9;
  // base plate
  m.cbox(x, y, z, w, 2, w, frame);
  // glass core and four corner bars
  m.cbox(x, y + 2, z, w - 2, gh, w - 2, 'lantern_glass', { glow: 1.5, flicker: 0.35, bevel: 0, noAO: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    m.box(x + (sx < 0 ? -w / 2 : w / 2 - 2), y + 2, z + (sz < 0 ? -w / 2 : w / 2 - 2), 2, gh, 2, frame, { noAO: true });
  // mid bars across the glass (the frame cross of the sheet)
  m.cbox(x, y + 2 + Math.floor(gh / 2), z, w - 1, 1, w - 1, frame, { bevel: 0, noAO: true });
  // roof: two stepped caps and a ring
  m.cbox(x, y + 2 + gh, z, w + 2, 2, w + 2, frame, { noAO: true });
  m.cbox(x, y + 4 + gh, z, w - 2, 2, w - 2, frame, { noAO: true });
  m.cbox(x, y + 6 + gh, z, 2, 2, 2, 'metal', { noAO: true });
  if (light) m.light(x, y + 2 + gh / 2, z, 0xffb050, 1.1, 7, 0.35);
  return m;
}

/** Height in px of a lantern of the given size (base to ring top). */
export const lanternH = (size: 's' | 'm') => (size === 's' ? 15 : 17);

/**
 * Pixel flame: stacked glowing cores that flicker, plus rising fire, embers and a little smoke.
 * (x, y, z) = base centre; `r` = radius in px (2 torch .. 12 bonfire).
 */
export function flame(x: number, y: number, z: number, r: number, opts: { smoke?: boolean; embers?: boolean; color?: number; lightK?: number; light?: boolean } = {}): Model {
  const m = new Model();
  const fl = (dx: number, dz: number, w: number, h: number, tex: string, glow: number, ph: number) =>
    m.box(x + dx - w / 2, y, z + dz - w / 2, w, h, w, tex, { glow, flicker: 0.5, bevel: 0, noAO: true, anim: { kind: 'flicker', pivot: [x + dx, y, z + dz], amp: 0.28, speed: 9, phase: ph } });
  if (r <= 3) {
    fl(0, 0, r * 2, r * 3, 'flame', 1.5, 0);
    fl(0, 0, Math.max(1, r), r * 2, 'lantern_glass', 1.6, 1.3);
  } else {
    fl(0, 0, r * 1.3, r * 2.2, 'flame', 1.3, 0);
    fl(-r * 0.35, r * 0.25, r * 0.8, r * 1.5, 'flame', 1.3, 2.1);
    fl(r * 0.35, -r * 0.2, r * 0.8, r * 1.3, 'flame', 1.3, 4.2);
    fl(0, 0, r * 0.6, r * 1.6, 'lantern_glass', 1.6, 1.0);
  }
  m.emit({ kind: 'fire', x, y: y + r * 0.6, z, count: Math.round(4 + r * 1.4), spread: r * 0.7, height: r * 3 + 6, size: Math.max(1.6, r * 0.45) });
  if (opts.embers !== false) m.emit({ kind: 'embers', x, y: y + r, z, count: Math.round(2 + r * 0.6), spread: r * 0.6, height: r * 5 + 24, size: 1.2 });
  if (opts.smoke) m.emit({ kind: 'smoke', x, y: y + r * 3, z, count: Math.round(3 + r * 0.4), spread: r * 0.4, height: 40 + r * 3, size: 4 + r * 0.5 });
  if (opts.light !== false) m.light(x, y + r * 1.5 + 2, z, opts.color ?? FIRE_LIGHT, (opts.lightK ?? 1) * (0.6 + r * 0.08), 5 + r * 0.45, 0.9);
  return m;
}

/** Torch: a wooden handle with a cloth-wrapped head and a small flame. (x, y, z) = handle bottom. */
export function torch(x: number, y: number, z: number, len = 12, lean = 0): Model {
  const m = new Model();
  const rot = lean ? { x: lean, pivot: [x, y, z] as [number, number, number] } : undefined;
  m.cbox(x, y, z, 2, len, 2, 'beam', { rot });
  m.cbox(x, y + len, z, 3, 3, 3, 'cloth_brown', { rot, noAO: true });
  // the flame sits straight above the head (flames do not lean)
  const top = y + len + 3;
  const dz = lean ? Math.sin(lean) * (len + 3) : 0;
  const dy = lean ? Math.cos(lean) * (len + 3) - (len + 3) : 0;
  m.add(flame(x, top + dy - 0.5, z + dz, 2.2, { smoke: false }));
  return m;
}

/** A square wooden post with a capped top. (x, z) = centre, from y up `h` px. */
export function post(m: Model, x: number, y: number, z: number, h: number, w = 4, tex = 'beam_dark', cap = true) {
  m.cbox(x, y, z, w, h, w, { side: tex === 'beam_dark' ? 'plank_v_dark' : 'plank_v', end: 'wood_end' });
  if (cap) m.cbox(x, y + h, z, w + 2, 2, w + 2, { side: tex, end: 'wood_end' });
}

/** Irregular stone lump (campfire rings, rubble). */
export function stone(m: Model, x: number, y: number, z: number, s: number, rnd: () => number, tex = 'stone_smooth') {
  const w = s * (0.8 + rnd() * 0.4);
  const d = s * (0.8 + rnd() * 0.4);
  const h = s * (0.55 + rnd() * 0.35);
  const tint = [0x8a8a8a, 0x6e6e6e, 0xa0a0a0, 0x5a5a5a][Math.floor(rnd() * 4)];
  m.cbox(x, y, z, w, h, d, tex, { tint: tint | 0x404040, rot: { y: (rnd() - 0.5) * 0.6 } });
}

/** Ivy / leaves clumps hanging on a vertical face: small leaf boxes scattered up a column. */
export function ivy(m: Model, x: number, y0: number, y1: number, z: number, rnd: () => number, face: 'px' | 'pz' | 'nx' | 'nz' = 'pz', n = 6) {
  for (let i = 0; i < n; i++) {
    const yy = y0 + rnd() * (y1 - y0);
    const off = (rnd() - 0.5) * 4;
    const s = 2 + Math.floor(rnd() * 3);
    const dx = face === 'px' ? 0.5 : face === 'nx' ? -s + 0.5 : off;
    const dz = face === 'pz' ? 0.5 : face === 'nz' ? -s + 0.5 : off;
    m.box(x + dx, yy, z + dz, s, s, s, 'leaves', { bevel: 0, anim: { kind: 'sway', amp: 0.006, speed: 1.6 } });
  }
}
