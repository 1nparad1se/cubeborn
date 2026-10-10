import type { BossAttack, Loc } from '../../data/types';
import { TAU } from '../../core/math';
import { L } from '../../i18n';
import type { BossController } from './Boss';

/**
 * Boss skills. Every skill is a small state machine run by the controller:
 *   wind-up (telegraph on the ground, wind-up animation, sometimes counterable)
 *   -> act (the strike, a charge run, a leap, a channel...)
 *   -> recover (the boss is open for punishment).
 * Ground telegraphs (BossTele) are drawn by the renderer and also carry the delayed blasts of
 * eruptions / meteors, so they keep going after the cast ends. Stun and knockback land on the hero
 * through ActionSystem.stunHero / knockHero.
 */

export type TeleShape = 'circle' | 'ring' | 'cone' | 'rect';
/** Visual style of a blast. */
export type BlastFx = 'smash' | 'fire' | 'ice' | 'poison' | 'dark' | 'holy' | 'shock';

export interface Blast {
  /** Damage multiplier of the boss damage. */
  m: number;
  stun: number;
  kb: number;
  fx: BlastFx;
  /** Lingering pool (seconds) after the blast. */
  pool: number;
  /** Falling rock visual. */
  rock: boolean;
  /** Ground shock rings after the blast. */
  rings: number;
  ringR: number;
  /** Shockwave-type blasts roll along the ground: a jumping hero is clear. */
  ground: boolean;
  slow: boolean;
}

export interface BossTele {
  shape: TeleShape;
  x: number;
  z: number;
  /** Facing (atan2(dz, dx)) of cones and rects. */
  a: number;
  r: number;
  /** Inner radius of a ring. */
  r0: number;
  /** Cone arc (radians). */
  arc: number;
  len: number;
  w: number;
  /** Seconds left / total. */
  t: number;
  max: number;
  color: number;
  /** Danger style for the renderer: 'hit' red, 'stun' gold, 'knock' blue. */
  style: 'hit' | 'stun' | 'knock';
  blast: Blast | null;
  /** Belongs to the cast in progress (removed when it is interrupted). */
  owned: boolean;
  /** Already resolved (kept a few frames for the flash). */
  done: boolean;
}

/** Animation family a skill plays on the boss model. */
export type BossAnim = 'slam' | 'sweep' | 'charge' | 'leap' | 'roar' | 'cast' | 'channel' | 'breath' | 'enrage' | 'blink';

export interface Cast {
  a: BossAttack;
  impl: SkillImpl;
  /** 0 wind-up, 1 act, 2 recover. */
  stage: 0 | 1 | 2;
  t: number;
  wind: number;
  act: number;
  rec: number;
  /** Aim angle (atan2(dz, dx)) and target point. */
  ang: number;
  tx: number;
  tz: number;
  /** Start point of a move (charge / leap). */
  sx: number;
  sz: number;
  dist: number;
  /** Repeats left (multi-charge, combo sweeps). */
  left: number;
  hit: boolean;
  acc: number;
  wall: boolean;
}

export interface SkillImpl {
  anim: BossAnim;
  /** The wind-up can be interrupted by a stagger skill (counter window). */
  counter?: boolean;
  begin(b: BossController, c: Cast): void;
  strike?(b: BossController, c: Cast): void;
  tick?(b: BossController, c: Cast, dt: number): void;
  /** Called after the act stage; return true to start another round instead of recovering. */
  again?(b: BossController, c: Cast): boolean;
}

export const n = (a: BossAttack, k: string, d: number) => (typeof a[k] === 'number' ? (a[k] as number) : d);
const s = (a: BossAttack, k: string, d: string) => (typeof a[k] === 'string' ? (a[k] as string) : d);

const RED = 0xff3a2a;
const GOLD = 0xffc83a;
const BLUE = 0x7ad0ff;

function styleOf(stun: number, kb: number): BossTele['style'] {
  return stun > 0 ? 'stun' : kb > 0 ? 'knock' : 'hit';
}
function colorOf(style: BossTele['style']): number {
  return style === 'stun' ? GOLD : style === 'knock' ? BLUE : RED;
}

export function blastOf(a: BossAttack, defFx: BlastFx = 'smash', m = 1): Blast {
  return {
    m: n(a, 'm', m),
    stun: n(a, 'stun', 0),
    kb: n(a, 'kb', 0),
    fx: s(a, 'fx', defFx) as BlastFx,
    pool: n(a, 'pool', 0),
    rock: !!a.rock,
    rings: n(a, 'rings', 0),
    ringR: n(a, 'ringR', 12),
    ground: !!a.ground,
    slow: !!a.slow,
  };
}

/** Adds a ground telegraph. */
export function tele(b: BossController, shape: TeleShape, x: number, z: number, t: number, o: Partial<BossTele> = {}): BossTele {
  const style = o.style ?? (o.blast ? styleOf(o.blast.stun, o.blast.kb) : 'hit');
  const tl: BossTele = {
    shape,
    x,
    z,
    a: 0,
    r: 2,
    r0: 0,
    arc: Math.PI / 2,
    len: 8,
    w: 2,
    t,
    max: t,
    color: colorOf(style),
    style,
    blast: null,
    owned: true,
    done: false,
    ...o,
  };
  b.teles.push(tl);
  return tl;
}

/** Is the point (with a pad) inside a telegraph shape? */
export function inside(tl: BossTele, x: number, z: number, pad = 0): boolean {
  const dx = x - tl.x;
  const dz = z - tl.z;
  const d = Math.hypot(dx, dz);
  switch (tl.shape) {
    case 'circle':
      return d <= tl.r + pad;
    case 'ring':
      return d <= tl.r + pad && d >= tl.r0 - pad;
    case 'cone': {
      if (d > tl.r + pad) return false;
      if (d < 1) return true;
      let da = Math.atan2(dz, dx) - tl.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) <= tl.arc / 2 + pad / Math.max(1, d);
    }
    case 'rect': {
      const ux = Math.cos(tl.a);
      const uz = Math.sin(tl.a);
      const along = dx * ux + dz * uz;
      const side = -dx * uz + dz * ux;
      return along >= -pad && along <= tl.len + pad && Math.abs(side) <= tl.w / 2 + pad;
    }
  }
}

/** Damage + crowd control on the hero. Returns true when it landed. */
export function hitHero(b: BossController, m: number, o: { stun?: number; kb?: number; fromX?: number; fromZ?: number; ground?: boolean; slow?: boolean } = {}): boolean {
  const run = b.run;
  const p = run.player;
  if (p.dead) return false;
  if (o.ground && p.clearsGround) return false;
  const dealt = p.hurt(b.e.damage * m, b.e);
  if (dealt <= 0) return false;
  if (o.kb) run.action.knockHero(o.fromX ?? b.e.x, o.fromZ ?? b.e.z, o.kb);
  if (o.stun) {
    run.action.stunHero(o.stun);
    run.fx.text(p.x, p.z, run.tr('boss_stunned'), 0xffd040);
  }
  if (o.slow) p.slowT = Math.max(p.slowT, 2);
  return true;
}

const FX_COLOR: Record<BlastFx, number> = { smash: 0xd8b070, fire: 0xff7a1a, ice: 0x9adfff, poison: 0x9aff4a, dark: 0xb070ff, holy: 0xffe080, shock: 0xffe080 };

/** Resolves a telegraph's blast: damage, crowd control, visuals. */
export function detonate(b: BossController, tl: BossTele) {
  const run = b.run;
  const p = run.player;
  const bl = tl.blast;
  tl.done = true;
  if (!bl) return;
  const col = bl.fx === 'smash' ? b.def.color : FX_COLOR[bl.fx];
  if (inside(tl, p.x, p.z, p.radius * 0.6)) {
    const from = tl.shape === 'circle' || tl.shape === 'ring' ? [tl.x, tl.z] : [b.e.x, b.e.z];
    hitHero(b, bl.m, { stun: bl.stun, kb: bl.kb, fromX: from[0], fromZ: from[1], ground: bl.ground, slow: bl.slow });
  }
  // the look: a landed shape through the action-fx renderer plus particles
  const f = run.action.fx.add('hit', tl.x, tl.z, 0.5, col);
  f.a = tl.a;
  f.fx = bl.fx === 'smash' ? 'smash' : bl.fx;
  if (tl.shape === 'cone') f.shape = { k: 'circle', r: Math.min(tl.r, 6) };
  else if (tl.shape === 'rect') f.shape = { k: 'rect', len: tl.len, w: tl.w };
  else f.shape = { k: 'circle', r: tl.r };
  if (tl.shape === 'rect') {
    f.a = tl.a;
  }
  const big = tl.r >= 3.5 || tl.shape === 'rect';
  run.fx.burst(tl.x, 0.4, tl.z, col, big ? 26 : 14, big ? 7 : 5, 0.22, 0.6, bl.fx === 'smash' ? 'debris' : 'glow');
  run.fx.light(tl.x, tl.z, col, big ? 4 : 2.5, tl.r * 2.5, 0.3);
  if (big) run.fx.shake(0.32);
  run.fx.sound(bl.fx === 'fire' ? 'explosion' : 'slam', big ? 0.8 : 0.45);
  if (bl.rings > 0) {
    for (let i = 0; i < bl.rings; i++) {
      run.later(i * 0.32, () => {
        if (!b.e.alive) return;
        run.hazards.shock(tl.x, tl.z, bl.ringR, 9, 1.1, b.e.damage * 0.3, col);
      });
    }
  }
  if (bl.pool > 0) {
    const z = run.hazards.zone(tl.x, tl.z, tl.r * 0.85, 0.02, b.e.damage * 0.25, { pool: bl.pool, color: col, freeze: bl.fx === 'ice' });
    z.dmg = b.e.damage * 0.25;
  }
}

/** Throws a bullet from the boss body edge. */
function shoot(b: BossController, ang: number, speed: number, m: number, size: number, slow: boolean, color: number) {
  const e = b.e;
  const off = e.radius * 0.7;
  b.run.hazards.bullet(e.x + Math.cos(ang) * off, e.z + Math.sin(ang) * off, Math.cos(ang) * speed, Math.sin(ang) * speed, e.damage * m * 0.85, size, 4.5, color, slow);
}

function aimAt(b: BossController, c: Cast, lead = 0) {
  const p = b.run.player;
  const tx = p.x + p.vx * lead;
  const tz = p.z + p.vz * lead;
  c.tx = tx;
  c.tz = tz;
  c.ang = Math.atan2(tz - b.e.z, tx - b.e.x);
  c.dist = Math.hypot(tx - b.e.x, tz - b.e.z);
}

// ================================================================ skill implementations

/** Ground slam: a disc in front of the boss (or around it) with optional shock rings. */
const smash: SkillImpl = {
  anim: 'slam',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    const e = b.e;
    const r = n(a, 'r', 4);
    const at = s(a, 'at', 'front');
    let x = e.x;
    let z = e.z;
    if (at === 'front') {
      const d = Math.min(e.radius + r * 0.55, Math.max(e.radius * 0.5, c.dist));
      x += Math.cos(c.ang) * d;
      z += Math.sin(c.ang) * d;
    } else if (at === 'hero') {
      x = c.tx;
      z = c.tz;
    }
    c.wind = n(a, 'wind', 1.1) * b.windMul;
    c.act = 0.12;
    c.rec = n(a, 'rec', 0.9);
    tele(b, 'circle', x, z, c.wind, { r, blast: blastOf(a, 'smash', 1.4), a: c.ang });
  },
};

/** Wide sweep in a cone; `hits` alternating swings. */
const sweep: SkillImpl = {
  anim: 'sweep',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.left = c.left || n(a, 'hits', 1);
    const first = c.left === n(a, 'hits', 1);
    c.wind = (first ? n(a, 'wind', 0.95) : n(a, 'wind2', 0.55)) * b.windMul;
    c.act = 0.15;
    c.rec = n(a, 'rec', 0.8);
    tele(b, 'cone', b.e.x, b.e.z, c.wind, { r: n(a, 'r', 6), arc: (n(a, 'arc', 160) * Math.PI) / 180, a: c.ang, blast: blastOf(a, 'smash', 1.2) });
  },
  again(b, c) {
    c.left--;
    if (c.left <= 0) return false;
    this.begin(b, c);
    return true;
  },
};

/** Charge: a lane telegraph, then a heavy run. Ramming the arena wall leaves the boss dazed. */
const charge: SkillImpl = {
  anim: 'charge',
  counter: true,
  begin(b, c) {
    const a = c.a;
    const e = b.e;
    aimAt(b, c);
    c.left = c.left || n(a, 'count', 1);
    const first = c.left === n(a, 'count', 1);
    c.dist = Math.min(n(a, 'len', 18), c.dist + 5);
    c.sx = e.x;
    c.sz = e.z;
    c.hit = false;
    c.wall = false;
    c.wind = (first ? n(a, 'wind', 1.0) : n(a, 'wind2', 0.6)) * b.windMul;
    const sp = n(a, 'speed', 16);
    c.act = c.dist / sp;
    c.rec = n(a, 'rec', 0.9);
    const bl = blastOf(a, 'smash', 1.5);
    tele(b, 'rect', e.x, e.z, c.wind, { a: c.ang, len: c.dist + e.radius, w: e.radius * 1.7, style: styleOf(bl.stun, bl.kb) });
  },
  strike(b) {
    b.run.fx.sound('dash');
    b.run.fx.shake(0.2);
  },
  tick(b, c, dt) {
    const e = b.e;
    const a = c.a;
    const sp = n(a, 'speed', 16);
    const ux = Math.cos(c.ang);
    const uz = Math.sin(c.ang);
    e.vx = ux * sp;
    e.vz = uz * sp;
    b.faceDir(ux, uz, 1);
    // dust trail
    if (Math.random() < dt * 20) b.run.fx.burst(e.x - ux * e.radius, 0.3, e.z - uz * e.radius, 0x9a8a70, 2, 2, 0.25, 0.6, 'smoke');
    const p = b.run.player;
    if (!c.hit && Math.hypot(p.x - e.x, p.z - e.z) < e.radius + p.radius + 0.4) {
      c.hit = true;
      // thrown aside and forward
      const side = (p.x - e.x) * -uz + (p.z - e.z) * ux >= 0 ? 1 : -1;
      const fx = e.x - (-uz * side) * 2 - ux * 1.5;
      const fz = e.z - (ux * side) * 2 - uz * 1.5;
      hitHero(b, n(a, 'm', 1.5), { stun: n(a, 'stun', 0), kb: n(a, 'kb', 12), fromX: fx, fromZ: fz });
    }
    // rams the arena wall or a cliff: stops dazed
    const ar = b.run.arena;
    const nx = e.x + ux * (e.radius + 0.6);
    const nz = e.z + uz * (e.radius + 0.6);
    const outside = ar.active && Math.hypot(nx - ar.x, nz - ar.z) > ar.r - 0.4;
    if (outside || (!b.def.flying && b.run.terrain.blocksWalker(Math.floor(nx), Math.floor(nz)))) {
      c.wall = true;
      c.t = c.act;
    }
  },
  again(b, c) {
    const e = b.e;
    e.vx = e.vz = 0;
    if (c.wall) {
      // crash: a shock ring and an opening for the hero
      const run = b.run;
      run.fx.shake(0.45);
      run.fx.sound('slam', 0.9);
      run.fx.burst(e.x, 1, e.z, 0xc8b090, 30, 6, 0.3, 0.8, 'debris');
      const tl = tele(b, 'circle', e.x, e.z, 0.01, { r: e.radius + 2.2, blast: { ...blastOf(c.a, 'smash', 0.8), stun: 0, kb: 8 } });
      tl.owned = false;
      b.daze(n(c.a, 'daze', 1.6));
      c.left = 0;
      return false;
    }
    c.left--;
    if (c.left <= 0) return false;
    this.begin(b, c);
    return true;
  },
};

/** Leaping smash: crouch, jump onto the marked spot, land with a stun core and a knockback rim. */
const leap: SkillImpl = {
  anim: 'leap',
  counter: true,
  begin(b, c) {
    const a = c.a;
    const e = b.e;
    aimAt(b, c, 0.3);
    // never leave the arena
    const ar = b.run.arena;
    if (ar.active) {
      const d = Math.hypot(c.tx - ar.x, c.tz - ar.z);
      const lim = ar.r - e.radius - 0.5;
      if (d > lim) {
        c.tx = ar.x + ((c.tx - ar.x) / d) * lim;
        c.tz = ar.z + ((c.tz - ar.z) / d) * lim;
      }
    }
    c.sx = e.x;
    c.sz = e.z;
    c.wind = n(a, 'wind', 1.0) * b.windMul;
    c.act = n(a, 'air', 0.8);
    c.rec = n(a, 'rec', 1.0);
    const r = n(a, 'r', 4);
    const tl = tele(b, 'circle', c.tx, c.tz, c.wind + c.act, { r, blast: blastOf(a, 'smash', 1.6) });
    tl.owned = true;
    const outer = n(a, 'outer', 2);
    if (outer > 1) tele(b, 'ring', c.tx, c.tz, c.wind + c.act, { r: r * outer, r0: r, style: 'knock', blast: { ...blastOf(a, 'smash', 0.5), stun: 0, kb: n(a, 'kb', 10), m: 0.5 } });
  },
  strike(b) {
    b.run.fx.sound('dash', 0.8);
    b.e.invuln = false;
  },
  tick(b, c) {
    const e = b.e;
    const k = Math.min(1, c.t / c.act);
    e.x = c.sx + (c.tx - c.sx) * k;
    e.z = c.sz + (c.tz - c.sz) * k;
    e.vx = e.vz = 0;
    b.airY = Math.sin(k * Math.PI) * (2.5 + c.dist * 0.15);
    b.faceDir(c.tx - c.sx, c.tz - c.sz, 1);
  },
  again(b) {
    b.airY = 0;
    b.run.fx.shake(0.6);
    b.run.fx.burst(b.e.x, 0.5, b.e.z, 0x9a8a70, 40, 8, 0.35, 1, 'debris');
    return false;
  },
};

/** Roar: a gold disc around the boss; inside when it ends = stunned (dodge out or roll through it). */
const roar: SkillImpl = {
  anim: 'roar',
  counter: true,
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = n(a, 'wind', 1.25) * b.windMul;
    c.act = 0.6;
    c.rec = n(a, 'rec', 0.8);
    const bl = blastOf(a, 'holy', 0.3);
    bl.stun = n(a, 'stun', 1.6);
    tele(b, 'circle', b.e.x, b.e.z, c.wind, { r: n(a, 'r', 8), blast: bl, style: 'stun' });
  },
  strike(b, c) {
    const run = b.run;
    run.fx.sound('bossRoar', 1);
    run.fx.shake(0.55);
    const f = run.action.fx.add('ring', b.e.x, b.e.z, 0.7, b.def.color);
    f.r = n(c.a, 'r', 8) + 2;
  },
};

/** Fans of aimed bolts. */
const volley: SkillImpl = {
  anim: 'cast',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = n(a, 'wind', 0.6) * b.windMul;
    const bursts = n(a, 'bursts', 2);
    c.act = bursts * n(a, 'delay', 0.3) + 0.05;
    c.rec = n(a, 'rec', 0.6);
    c.left = bursts;
    c.acc = 0;
    tele(b, 'cone', b.e.x, b.e.z, c.wind, { r: 9, arc: Math.max(0.25, (n(a, 'spread', 40) * Math.PI) / 180), a: c.ang, style: 'hit' });
  },
  tick(b, c, dt) {
    const a = c.a;
    c.acc -= dt;
    if (c.acc > 0 || c.left <= 0) return;
    c.acc = n(a, 'delay', 0.3);
    c.left--;
    aimAt(b, c, 0.25);
    b.faceDir(Math.cos(c.ang), Math.sin(c.ang), 0.5);
    const count = n(a, 'count', 5);
    const spread = (n(a, 'spread', 40) * Math.PI) / 180;
    const col = n(a, 'color', a.slow ? 0x8ae8ff : b.def.color);
    for (let i = 0; i < count; i++) {
      const ang = count === 1 ? c.ang : c.ang - spread / 2 + (spread * i) / (count - 1);
      shoot(b, ang, n(a, 'speed', 9), n(a, 'm', 0.4), n(a, 'size', 0.4), !!a.slow, col);
    }
    b.run.fx.sound('bossShoot', 0.6);
  },
};

/** Rings of bolts out of the body. */
const nova: SkillImpl = {
  anim: 'cast',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = n(a, 'wind', 0.75) * b.windMul;
    c.left = n(a, 'waves', 2);
    c.act = c.left * n(a, 'delay', 0.4) + 0.05;
    c.rec = n(a, 'rec', 0.6);
    c.acc = 0;
    tele(b, 'ring', b.e.x, b.e.z, c.wind, { r: b.e.radius + 2, r0: b.e.radius, style: 'hit' });
  },
  tick(b, c, dt) {
    const a = c.a;
    c.acc -= dt;
    if (c.acc > 0 || c.left <= 0) return;
    c.acc = n(a, 'delay', 0.4);
    const w = n(a, 'waves', 2) - c.left;
    c.left--;
    const count = n(a, 'count', 16);
    const rot = (w * n(a, 'rotate', 8) * Math.PI) / 180 + c.ang;
    const col = n(a, 'color', a.slow ? 0x8ae8ff : b.def.color);
    for (let i = 0; i < count; i++) shoot(b, rot + (i / count) * TAU, n(a, 'speed', 6), n(a, 'm', 0.4), n(a, 'size', 0.38), !!a.slow, col);
    b.run.fx.sound('bossShoot', 0.6);
  },
};

/** Rotating arms of bolts while channelling. */
const spiral: SkillImpl = {
  anim: 'channel',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = n(a, 'wind', 0.7) * b.windMul;
    c.act = n(a, 'duration', 3);
    c.rec = n(a, 'rec', 0.6);
    c.acc = 0;
    tele(b, 'ring', b.e.x, b.e.z, c.wind, { r: b.e.radius + 3, r0: b.e.radius, style: 'hit' });
  },
  tick(b, c, dt) {
    const a = c.a;
    c.acc += dt * n(a, 'rate', 8);
    c.ang += ((n(a, 'turn', 60) * Math.PI) / 180) * dt;
    const arms = n(a, 'arms', 4);
    const col = n(a, 'color', a.slow ? 0x8ae8ff : b.def.color);
    while (c.acc >= 1) {
      c.acc--;
      for (let k = 0; k < arms; k++) shoot(b, c.ang + (k / arms) * TAU, n(a, 'speed', 5.5), n(a, 'm', 0.35), 0.34, !!a.slow, col);
    }
  },
};

/** Ground eruptions: lines, scatters, rings and crosses of delayed blasts. */
const erupt: SkillImpl = {
  anim: 'slam',
  begin(b, c) {
    const a = c.a;
    const e = b.e;
    const run = b.run;
    aimAt(b, c, 0.4);
    c.wind = n(a, 'wind', 0.8) * b.windMul;
    c.act = 0.12;
    c.rec = n(a, 'rec', 0.7);
    const count = n(a, 'count', 6);
    const r = n(a, 'r', 1.8);
    const step = n(a, 'step', 0.12);
    const delay = n(a, 'delay', 0.9);
    const pat = s(a, 'pattern', 'scatter');
    const bl = blastOf(a, 'smash', 0.9);
    const pts: [number, number][] = [];
    if (pat === 'line') {
      for (let i = 0; i < count; i++) {
        const d = e.radius + r * 0.8 + i * r * 1.7;
        pts.push([e.x + Math.cos(c.ang) * d, e.z + Math.sin(c.ang) * d]);
      }
    } else if (pat === 'fan') {
      const lines = n(a, 'lines', 3);
      const spread = (n(a, 'spread', 50) * Math.PI) / 180;
      for (let l = 0; l < lines; l++) {
        const ang = c.ang - spread / 2 + (spread * l) / Math.max(1, lines - 1);
        for (let i = 0; i < count; i++) {
          const d = e.radius + r * 0.8 + i * r * 1.7;
          pts.push([e.x + Math.cos(ang) * d, e.z + Math.sin(ang) * d]);
        }
      }
    } else if (pat === 'ring') {
      const rings = n(a, 'rings2', 1);
      for (let k = 0; k < rings; k++) {
        const dist = n(a, 'dist', 6) + k * r * 2.2;
        const cnt = Math.round(count * (1 + k * 0.5));
        for (let i = 0; i < cnt; i++) {
          const ang = (i / cnt) * TAU + k * 0.3;
          pts.push([e.x + Math.cos(ang) * dist, e.z + Math.sin(ang) * dist]);
        }
      }
    } else if (pat === 'cross') {
      for (let arm = 0; arm < 4; arm++) {
        const ang = c.ang + (arm * Math.PI) / 2 + Math.PI / 4;
        for (let i = 0; i < count; i++) {
          const d = e.radius + r + i * r * 1.8;
          pts.push([e.x + Math.cos(ang) * d, e.z + Math.sin(ang) * d]);
        }
      }
    } else {
      // scatter around the hero; the first one right on them
      const spread = n(a, 'spread', 6);
      for (let i = 0; i < count; i++) {
        if (i === 0) pts.push([c.tx, c.tz]);
        else {
          const ang = Math.random() * TAU;
          const rr = Math.sqrt(Math.random()) * spread;
          pts.push([c.tx + Math.cos(ang) * rr, c.tz + Math.sin(ang) * rr]);
        }
      }
    }
    const ar = run.arena;
    pts.forEach(([x, z], i) => {
      if (ar.active && Math.hypot(x - ar.x, z - ar.z) > ar.r + r) return;
      const t = c.wind + delay * (pat === 'scatter' ? 0.4 : 0) + i * step * (pat === 'fan' ? 1 / Math.max(1, n(a, 'lines', 3)) : 1) - (pat === 'scatter' ? 0 : 0);
      const tl = tele(b, 'circle', x, z, Math.max(0.35, t), { r, blast: bl });
      tl.owned = false;
      if (bl.rock) run.spawnFallingRock(x, z, tl.max, FX_COLOR[bl.fx]);
    });
    run.fx.sound('bossCharge', 0.5);
  },
};

/** Sweeping beams from the body (Hazards lasers have their own telegraph). */
const beam: SkillImpl = {
  anim: 'breath',
  begin(b, c) {
    const a = c.a;
    const e = b.e;
    aimAt(b, c);
    const tl = n(a, 'wind', 1.0) * b.windMul;
    c.wind = 0.15;
    c.act = tl + n(a, 'dur', 2.4);
    c.rec = n(a, 'rec', 0.6);
    const count = n(a, 'count', 1);
    const sweep = (n(a, 'sweep', 60) * Math.PI) / 180;
    const base = a.aim ? c.ang - sweep / 2 : c.ang + Math.random() * 0.5;
    for (let i = 0; i < count; i++) {
      b.run.hazards.laser(e, e.x, e.z, base + (i / count) * TAU * (a.aim ? 0.0 : 1), {
        sweep: count > 1 || !a.aim ? sweep : sweep,
        len: n(a, 'length', 15),
        width: n(a, 'width', 1.2),
        tele: tl,
        dur: n(a, 'dur', 2.4),
        dmg: e.damage * n(a, 'm', 0.3),
        color: n(a, 'color', b.def.color),
      });
    }
    b.run.fx.sound('bossCharge', 0.8);
  },
  tick(b, c) {
    // face the first beam
    for (const l of b.run.hazards.lasers) {
      if (l.active && l.owner === b.e) {
        b.faceDir(Math.cos(l.angle), Math.sin(l.angle), 0.4);
        break;
      }
    }
    void c;
  },
};

/** Gravity well: the hero is dragged in, then the core detonates. */
const vortex: SkillImpl = {
  anim: 'channel',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = 0.3;
    c.act = n(a, 'dur', 2.2) * b.windMul;
    c.rec = n(a, 'rec', 0.8);
    tele(b, 'circle', b.e.x, b.e.z, c.wind + c.act, { r: n(a, 'r', 5), blast: blastOf(a, 'dark', 1.3) });
    b.run.fx.sound('bossCharge', 0.9);
  },
  tick(b, c, dt) {
    const p = b.run.player;
    const e = b.e;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const st = n(c.a, 'strength', 3);
    if (d > e.radius + 0.8) {
      p.pullX = (dx / d) * st;
      p.pullZ = (dz / d) * st;
    }
    if (Math.random() < dt * 30) {
      const ang = Math.random() * TAU;
      const r = 4 + Math.random() * 6;
      b.run.fx.burst(e.x + Math.cos(ang) * r, 0.5, e.z + Math.sin(ang) * r, b.def.color, 1, 1, 0.15, 0.4, 'glow');
    }
  },
};

/** Vanishes and reappears next to the hero, slamming down at once. */
const blink: SkillImpl = {
  anim: 'blink',
  begin(b, c) {
    const a = c.a;
    aimAt(b, c);
    c.wind = n(a, 'wind', 0.55) * b.windMul;
    c.act = n(a, 'hide', 0.6);
    c.rec = 0.05;
    b.run.fx.burst(b.e.x, 1.5, b.e.z, b.def.color, 30, 6, 0.25, 0.7, 'glow');
  },
  strike(b, c) {
    const run = b.run;
    const e = b.e;
    const p = run.player;
    b.hidden = c.act;
    e.invuln = true;
    run.fx.sound('teleport');
    // the landing spot: near the hero, inside the arena, on walkable ground
    const ar = run.arena;
    let best: [number, number] = [p.x, p.z];
    for (let k = 0; k < 10; k++) {
      const ang = Math.random() * TAU;
      const r = e.radius + 1.5 + Math.random() * 1.5;
      const x = p.x + Math.cos(ang) * r;
      const z = p.z + Math.sin(ang) * r;
      if (ar.active && Math.hypot(x - ar.x, z - ar.z) > ar.r - e.radius - 0.5) continue;
      if (!b.def.flying && !run.terrain.walkableAt(x, z)) continue;
      best = [x, z];
      break;
    }
    c.tx = best[0];
    c.tz = best[1];
    const bl = blastOf(c.a, c.a.burrow ? 'fire' : 'dark', 1.3);
    tele(b, 'circle', c.tx, c.tz, c.act, { r: n(c.a, 'r', 4), blast: bl });
    if (c.a.burrow) run.fx.burst(e.x, 0.3, e.z, 0x6a4a30, 30, 5, 0.3, 0.8, 'debris');
  },
  again(b, c) {
    const e = b.e;
    e.x = c.tx;
    e.z = c.tz;
    e.invuln = false;
    b.hidden = 0;
    b.faceDir(b.run.player.x - e.x, b.run.player.z - e.z, 1);
    b.run.fx.burst(e.x, 1.2, e.z, b.def.color, 36, 7, 0.25, 0.8, c.a.burrow ? 'debris' : 'glow');
    // a short recovery: the punish window
    c.rec = n(c.a, 'rec', 1.0);
    return false;
  },
};

/** Phase change: the boss flares up, throwing the hero back. */
const enrage: SkillImpl = {
  anim: 'enrage',
  begin(b, c) {
    c.wind = 1.2;
    c.act = 0.5;
    c.rec = 0.6;
    tele(b, 'circle', b.e.x, b.e.z, c.wind, { r: b.e.radius + 4.5, blast: { ...blastOf(c.a, 'shock', 0.35), kb: 13, stun: 0 }, style: 'knock' });
    b.e.invuln = true;
  },
  strike(b) {
    const run = b.run;
    b.e.invuln = false;
    run.fx.sound('bossRoar', 1);
    run.fx.shake(0.7);
    run.fx.burst(b.e.x, 2, b.e.z, b.def.color, 60, 9, 0.3, 1.1, 'glow');
    const f = run.action.fx.add('ring', b.e.x, b.e.z, 0.9, b.def.color);
    f.r = b.e.radius + 8;
  },
};

export const SKILLS: Record<string, SkillImpl> = { smash, sweep, charge, leap, roar, volley, nova, spiral, erupt, beam, vortex, blink, enrage };

/** Short name shown when the boss starts a skill. */
export function skillName(a: BossAttack): string {
  return a.name ? L(a.name as Loc) : '';
}
