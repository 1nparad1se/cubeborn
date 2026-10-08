import * as THREE from 'three';
import type { EmitLayer } from '../../config/vfx';
import type { WeaponActor, WeaponScript } from './actor';
import { L, PI, TAU, clamp01, smooth, easeOut, bump, prog, at, flying, qm, emitAt, stream, haloToRoot, resetBody } from './scripts';

/**
 * Motion scripts for the rest of the arsenal (v2.4). Projectiles share one configurable "missile"
 * script (flight, impact, break-up) with per-weapon particles and node motion; bombs, mines,
 * wisps, the spectral melee weapons and the floating prism / halo / heart have their own.
 * Like scripts.ts, every timeline reads `a.modeT` so the game and the viewer play them the same.
 */

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

interface MissileCfg {
  /** Particles left along the flight path (per second at full quality). */
  trail?: EmitLayer;
  trailRate?: number;
  /** Burst on impact and when the object breaks up mid-air. */
  hit: EmitLayer[];
  shatter?: EmitLayer[];
  /** Light colour carried in flight and flashed on impact. */
  light: number;
  lightR?: number;
  /** Extra per-weapon node motion. */
  pose?(a: WeaponActor, dt: number, pulse: number): void;
}

/** Thrown or shot objects: launch pop, flight, impact flash, mid-air break-up. */
function missile(c: MissileCfg): WeaponScript {
  return {
    init(a) {
      haloToRoot(a, 'flash');
    },
    start(a) {
      resetBody(a);
    },
    pose(a, dt, pulse) {
      const m = a.model;
      c.pose?.(a, dt, pulse);
      m.halos.glow?.set(1 + 0.2 * pulse);
      let flash = 0;
      if (a.mode === 'attack') {
        // launch: pops out of nothing with a little overshoot
        const p = prog(a, a.def.attackTime);
        const k = easeOut(p / 0.35);
        m.body.scale.setScalar(k * (1 + bump(p, 0.2, 0.5) * 0.25));
        flash = bump(p, 0, 0.3) * 0.6;
      } else if (a.mode === 'hit') {
        // impact: the object buries itself and flares, then fades
        const p = prog(a, a.def.hitTime);
        m.body.scale.setScalar(Math.max(0, 1 - smooth(p / 0.45)));
        flash = 1 - p;
      } else if (a.mode === 'destroy') {
        // break-up in the air: shudder, then gone in a puff
        const p = prog(a, a.def.destroyTime);
        m.body.rotation.x += Math.sin(a.modeT * 60) * 0.12 * (1 - p);
        m.body.scale.setScalar(p < 0.3 ? 1 : Math.max(0, 1 - smooth((p - 0.3) / 0.25)));
        flash = bump(p, 0.25, 0.6);
      } else m.body.scale.setScalar(1);
      m.halos.flash?.set(0.6 + flash * 0.8, flash * 0.9);
      m.glow.value += flash * 1.5;
    },
    fx(a, dt, fx, pulse) {
      const q = qm(a, fx);
      if (c.trail && (flying(a) || a.mode === 'attack') && a.speed > 0.3) stream(a, fx, 't', c.trail, (c.trailRate ?? a.def.particles) * (0.7 + a.tier * 0.15), dt, a.trailHead());
      if (a.mode === 'hit') {
        if (at(a, dt, 0)) for (const l of c.hit) emitAt(fx, a.pos, l, q, a.dir.x, a.dir.z);
        if (a.modeT < 0.25) fx.light(a.pos.x, a.pos.y, a.pos.z, c.light, 3 * (1 - a.modeT / 0.25), (c.lightR ?? 3) * 1.4);
      } else if (a.mode === 'destroy') {
        if (at(a, dt, a.def.destroyTime * 0.3)) for (const l of c.shatter ?? c.hit) emitAt(fx, a.pos, l, q);
      } else if (a.def.glow > 0.5) fx.light(a.pos.x, a.pos.y, a.pos.z, c.light, 0.5 + 0.3 * pulse, c.lightR ?? 3);
    },
  };
}

// ------------------------------------------------------------------ projectiles
const STEEL_SPARK = L('spark', 1, 0xffffff, 1.5, 0.04, 0.18, 0.4, 0.3, 0xbfe0ff);
const dagger = missile({
  trail: STEEL_SPARK,
  trailRate: 14,
  light: 0xbfe0ff,
  hit: [L('spark', 12, 0xffffff, 7, 0.05, 0.22, 0.9, 1.5, 0xbfe0ff), L('glow', 3, 0xbfe0ff, 2, 0.18, 0.2, PI)],
  shatter: [L('shard', 8, 0xd8e8f8, 4, 0.07, 0.6, PI, 2), L('spark', 8, 0xffffff, 5, 0.04, 0.2, PI)],
  pose(a) {
    const t = a.t;
    // evolution: the spectral blades shadow the dagger a beat behind
    a.model.offset('ghostL', 0, Math.sin(t * 9) * 0.6, Math.sin(t * 7) * 0.8 - 0.5);
    a.model.offset('ghostR', 0, Math.sin(t * 9 + 2) * 0.6, Math.sin(t * 7 + 1.6) * 0.8 - 0.5);
  },
});

const ARCANE_MOTE = L('wisp', 1, 0xe0c8ff, 0.8, 0.06, 0.45, PI, 0.2, 0x9a6aff);
const arcane = missile({
  trail: ARCANE_MOTE,
  light: 0xb98cff,
  lightR: 3.5,
  hit: [L('glow', 6, 0xe0c8ff, 3.5, 0.22, 0.35, PI, 0.5, 0x9a6aff), L('spark', 14, 0xf0e0ff, 6, 0.05, 0.3, PI, 1, 0xb98cff), L('wisp', 8, 0xd8b8ff, 2, 0.08, 0.7, PI, 1)],
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.pose('core', t * 2, t * 3, 0);
    m.nodes.core.scale.setScalar(1 + 0.15 * pulse);
    m.pose('ringA', 0, t * 4, 0);
    m.pose('ringB', 0, -t * 3, 0);
    m.pose('runes', Math.sin(t) * 0.4, t * 2.5, 0);
    for (let i = 0; i < 3; i++) m.pose('r' + i, 0, -t * 2.5, 0);
    m.pose('crown', 0, t, 0);
  },
});

const FROST_MIST = L('smoke', 1, 0xe8fbff, 0.4, 0.25, 0.5, PI, 0.2, 0xbfeaff);
const FROST_GLINT = L('spark', 1, 0xffffff, 1, 0.04, 0.3, PI, 0, 0x9af0ff);
const iceshard = missile({
  trail: FROST_MIST,
  trailRate: 12,
  light: 0x8fe9ff,
  hit: [L('shard', 14, 0xdff8ff, 5, 0.08, 0.7, PI, 2.5, 0x9af0ff), L('glow', 4, 0xbff0ff, 2.5, 0.25, 0.3, PI), L('smoke', 3, 0xe8fbff, 0.8, 0.5, 0.8, PI, 0.4)],
  pose(a, dt, pulse) {
    const m = a.model;
    m.pose('frost', 0, 0, a.t * 2);
    m.pose('halo', 0, 0, a.t * 3);
    m.halos.glow?.set(1 + 0.2 * pulse);
    void dt;
  },
});
const iceshardFx = iceshard.fx!;
iceshard.fx = (a, dt, fx, pulse) => {
  iceshardFx(a, dt, fx, pulse);
  if (flying(a) && a.tier >= 3) stream(a, fx, 'g', FROST_GLINT, 10, dt, a.pos);
};

const WIND = L('wisp', 1, 0xffffff, 0.6, 0.05, 0.25, 0.3, 0, 0xe8f0ff);
const arrow = missile({
  trail: WIND,
  trailRate: 18,
  light: 0xffe0a0,
  hit: [L('spark', 10, 0xfff0c0, 6, 0.05, 0.22, 0.8, 1.5), L('debris', 5, 0x8a6a4a, 3, 0.07, 0.6, 0.9, 1.5), L('glow', 2, 0xffe0a0, 1.5, 0.2, 0.2, PI)],
  shatter: [L('debris', 8, 0xb88a5a, 3, 0.07, 0.7, PI, 1.5), L('debris', 4, 0xf0e8d8, 2, 0.07, 0.8, PI, 2)],
  pose(a) {
    a.model.pose('wind', 0, 0, a.t * 8);
  },
});

const SIEGE_DUST = L('smoke', 1, 0x9a8a78, 0.5, 0.3, 0.5, PI, 0.3);
const SIEGE_FIRE = L('ember', 1, 0xffb040, 1, 0.08, 0.4, 0.6, 0.6, 0xff4a10);
const heavybolt = missile({
  trail: SIEGE_DUST,
  trailRate: 8,
  light: 0xffb060,
  hit: [L('debris', 12, 0x6a5a4a, 5, 0.1, 0.8, 0.9, 2.5), L('spark', 16, 0xffe0b0, 8, 0.06, 0.25, 0.9, 2), L('smoke', 5, 0x8a7a68, 1.2, 0.6, 0.9, PI, 0.6), L('glow', 3, 0xffc080, 3, 0.3, 0.25, PI)],
  pose(a) {
    a.model.pose('fins', 0, 0, a.t * 6);
    a.model.halos.fire?.set(1 + Math.random() * 0.3);
  },
});
const heavyFx = heavybolt.fx!;
heavybolt.fx = (a, dt, fx, pulse) => {
  heavyFx(a, dt, fx, pulse);
  if (flying(a) && a.tier >= 4) stream(a, fx, 'f', SIEGE_FIRE, 30, dt, a.trailHead());
};

const MOON = L('wisp', 1, 0xe8f0ff, 0.5, 0.07, 0.4, PI, 0.2, 0xb8c8ff);
const glaive = missile({
  trail: MOON,
  trailRate: 16,
  light: 0xe8f0ff,
  hit: [L('spark', 12, 0xffffff, 6, 0.05, 0.25, PI, 1), L('glow', 3, 0xe8f0ff, 2, 0.2, 0.25, PI)],
  pose(a, _dt, pulse) {
    a.model.halos.corona?.set(1 + 0.2 * pulse);
    a.model.pose('eclipse', 0, -a.t * 2, 0);
  },
});

const GRIND = L('spark', 1, 0xffe0a0, 4, 0.04, 0.2, 1.2, 1.5, 0xff8a3a);
const saw = missile({
  light: 0xfff0c0,
  hit: [L('spark', 14, 0xffe0a0, 7, 0.05, 0.25, PI, 1.5, 0xff8a3a), L('debris', 4, 0x9aa4b0, 3, 0.07, 0.5, PI, 1.5)],
  pose(a) {
    a.model.pose('saw2', 0, -a.t * 30, 0);
  },
});
const sawFx = saw.fx!;
saw.fx = (a, dt, fx, pulse) => {
  sawFx(a, dt, fx, pulse);
  // sparks fly off the teeth while it grinds
  if (flying(a)) {
    const ang = Math.random() * TAU;
    const r = 0.3 * a.def.scale * a.size;
    v1.set(a.pos.x + Math.cos(ang) * r, a.pos.y, a.pos.z + Math.sin(ang) * r);
    stream(a, fx, 'g', GRIND, 6 + a.tier * 4, dt, v1, false);
  }
};

const SPIRIT = L('wisp', 1, 0xe8fff4, 0.6, 0.06, 0.6, PI, 0.6, 0x9dffd6);
const wispshot = missile({ trail: SPIRIT, trailRate: 20, light: 0x9dffd6, hit: [L('glow', 4, 0xe8fff4, 2.5, 0.18, 0.25, PI), L('spark', 8, 0xffffff, 5, 0.04, 0.2, PI, 1, 0x9dffd6)] });

// ------------------------------------------------------------------ Guardian Wisp: hovers, flickers, shoots
const wisp: WeaponScript = {
  trailNode: 'tail',
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    // flame flickers, tail swishes, motes circle
    m.nodes.flame.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9) * 0.18 + 0.1 * pulse, 1 + Math.cos(t * 11) * 0.08);
    m.pose('flame', Math.sin(t * 5) * 0.12, 0, Math.sin(t * 7) * 0.12);
    m.pose('tail', Math.sin(t * 4) * 0.2, Math.sin(t * 6) * 0.45, 0);
    m.pose('motes', 0, t * 2.4, 0);
    m.pose('halo', 0.15, t * 1.5, 0);
    let flash = 0;
    if (a.mode === 'attack') {
      // casts a shot: rears back, then a bright flare
      const p = prog(a, a.def.attackTime);
      m.body.rotation.x += -bump(p, 0, 0.35) * 0.5;
      m.body.scale.setScalar(1 + bump(p, 0.25, 0.6) * 0.25);
      flash = bump(p, 0.25, 0.7);
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth(p));
      m.body.position.y += p * 0.6;
      flash = bump(p, 0, 0.5);
    } else m.body.scale.setScalar(1);
    m.halos.glow?.set(1 + 0.25 * pulse + flash * 0.5);
    m.halos.flash?.set(0.7 + flash * 0.6, flash * 0.8);
    m.glow.value += flash;
  },
  fx(a, dt, fx, pulse) {
    const q = qm(a, fx);
    stream(a, fx, 's', SPIRIT, a.def.particles * (0.6 + a.tier * 0.15), dt, a.trailHead());
    if (a.mode === 'destroy' && at(a, dt, 0)) emitAt(fx, a.pos, L('wisp', 14, 0xe8fff4, 2, 0.08, 0.9, PI, 1.5, 0x9dffd6), q);
    fx.light(a.pos.x, a.pos.y, a.pos.z, 0x9dffd6, 0.8 + 0.4 * pulse, 3.5);
  },
};

// ------------------------------------------------------------------ Powder Keg bomb: fuse, tumble, blast
const FUSE = L('spark', 1, 0xffe070, 2.5, 0.04, 0.25, 0.8, 1.5, 0xff8a2a);
const FUSE_SMOKE = L('smoke', 1, 0x6a6460, 0.4, 0.2, 0.6, 0.5, 0.8);
const BLAST = [
  L('glow', 10, 0xffe0a0, 6, 0.4, 0.35, PI, 1, 0xff7a20),
  L('ember', 22, 0xffb040, 7, 0.1, 0.9, PI, 3, 0xff3a00),
  L('spark', 24, 0xfff0c0, 11, 0.06, 0.3, PI, 3, 0xff9a3a),
  L('smoke', 10, 0x3a3430, 2.2, 0.9, 1.4, PI, 1.2),
  L('debris', 10, 0x2e3038, 6, 0.1, 0.9, PI, 3),
];
const bomb: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    a.addWave(0xffb060);
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    // the spark on the fuse sputters
    m.nodes.spark.scale.setScalar(0.7 + Math.random() * 0.6);
    m.halos.spark?.set(0.8 + Math.random() * 0.5);
    m.pose('fuse', Math.sin(t * 7) * 0.15, 0, Math.cos(t * 6) * 0.15);
    let flash = 0;
    if (a.mode === 'attack') {
      // lit: it swells and blinks faster and faster before it blows
      const p = prog(a, a.def.attackTime);
      const blink = Math.sin(p * p * 60) > 0 ? 1 : 0;
      m.body.scale.setScalar(1 + p * 0.25 + blink * 0.05);
      m.glow.value += blink * p;
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      m.body.scale.setScalar(p < 0.05 ? 1.3 : 0);
      flash = 1 - smooth(p / 0.6);
    } else if (a.mode === 'destroy') {
      // a dud: the fuse fizzles out and the bomb sinks
      const p = prog(a, a.def.destroyTime);
      m.nodes.spark.visible = p < 0.3;
      m.body.scale.setScalar(1 - smooth((p - 0.5) / 0.5));
    } else {
      m.body.scale.setScalar(1);
      m.nodes.spark.visible = true;
    }
    m.halos.flash?.set(0.5 + (1 - flash) * 0.8, flash * 0.9);
    void pulse;
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    const tip = a.model.nodes.spark.getWorldPosition(v1);
    if (a.mode !== 'hit' && a.mode !== 'destroy') {
      stream(a, fx, 'f', FUSE, 18 + (a.mode === 'attack' ? 30 : 0), dt, tip, false);
      stream(a, fx, 's', FUSE_SMOKE, 5, dt, tip, false);
      fx.light(tip.x, tip.y, tip.z, 0xffa040, 0.6 + Math.random() * 0.4, 2.5);
    }
    const w = a.waves[0];
    if (a.mode === 'hit') {
      if (at(a, dt, 0)) for (const l of BLAST) emitAt(fx, a.pos, l, q * (a.tier >= 4 ? 1.3 : 1));
      const p = a.modeT / a.def.hitTime;
      if (p < 0.35) fx.light(a.pos.x, a.pos.y + 0.5, a.pos.z, 0xffb060, 6 * (1 - p / 0.35), 7);
      const r = (0.4 + easeOut(p / 0.5) * 2.4) * a.size;
      w?.set(a.pos.x, 0.06, a.pos.z, r, (1 - smooth(p / 0.7)) * 0.9);
    } else w?.set(0, 0, 0, 0, 0);
  },
};

// ------------------------------------------------------------------ Rune Trap mine: armed blink, blast
const RUNE_MOTE = L('gather', 1, 0xff8a9a, 0.6, 0.05, 0.5, PI, 0.6, 0xff5470);
const MINE_BLAST = [
  L('glow', 8, 0xffb0b8, 5, 0.38, 0.32, PI, 1.5, 0xff5470),
  L('spark', 20, 0xffe0e8, 10, 0.06, 0.3, PI, 3.5, 0xff5470),
  L('shard', 10, 0xff8a9a, 6, 0.08, 0.7, PI, 3.5),
  L('debris', 8, 0x5a5868, 5, 0.1, 0.8, PI, 3),
  L('smoke', 6, 0x4a3a44, 1.6, 0.7, 1.1, PI, 0.9),
];
const mine: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    a.addWave(0xff5470);
    a.facing = 'fixed';
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    const armed = a.s.armed ?? 1;
    // the rune turns slowly and blinks when armed
    m.pose('rune', 0, t * 0.8, 0);
    m.pose('ring', 0, -t * 0.6, 0);
    const blink = armed ? (Math.sin(t * 6) > 0.3 ? 1 : 0.25) : 0.15;
    m.halos.glow?.set(1 + 0.2 * pulse, 0.25 + 0.5 * blink);
    m.glow.value += blink * 0.6;
    let flash = 0;
    if (a.mode === 'attack') {
      // planted: drops in, the spikes spring up, the rune lights
      const p = prog(a, a.def.attackTime);
      m.body.position.y += (1 - easeOut(p / 0.4)) * 0.6;
      m.nodes.spikes.scale.set(1, easeOut((p - 0.3) / 0.4), 1);
      m.nodes.rune.scale.setScalar(easeOut((p - 0.5) / 0.4));
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      m.body.scale.setScalar(p < 0.06 ? 1.2 : 0);
      flash = 1 - smooth(p / 0.6);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.set(1, 1 - smooth(p), 1);
      m.halos.glow?.set(1, 0.3 * (1 - p));
    } else {
      m.body.scale.setScalar(1);
      m.nodes.spikes.scale.setScalar(1);
      m.nodes.rune.scale.setScalar(1);
    }
    m.halos.flash?.set(0.5 + (1 - flash) * 0.8, flash * 0.9);
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (a.mode !== 'hit' && a.mode !== 'destroy' && (a.s.armed ?? 1)) {
      v1.set(a.pos.x, a.pos.y + 0.1, a.pos.z);
      stream(a, fx, 'r', RUNE_MOTE, 4 + a.tier * 2, dt, v1, false);
    }
    const w = a.waves[0];
    if (a.mode === 'hit') {
      if (at(a, dt, 0)) for (const l of MINE_BLAST) emitAt(fx, a.pos, l, q * (a.tier >= 4 ? 1.3 : 1));
      const p = a.modeT / a.def.hitTime;
      if (p < 0.35) fx.light(a.pos.x, a.pos.y + 0.6, a.pos.z, 0xff5470, 6 * (1 - p / 0.35), 7);
      w?.set(a.pos.x, 0.06, a.pos.z, (0.4 + easeOut(p / 0.5) * 2.2) * a.size, (1 - smooth(p / 0.7)) * 0.9);
    } else w?.set(0, 0, 0, 0, 0);
  },
};

// ------------------------------------------------------------------ spectral melee: sword swing, punch, thrust
/** Fade in/out of a spectral weapon over a one-shot strike (0 → 1 → 0). */
const appear = (p: number) => easeOut(p / 0.15) * (1 - smooth((p - 0.78) / 0.22));
const SWORD_SPARK = L('spark', 1, 0xffffff, 2, 0.05, 0.25, PI, 0.5, 0x9fd8ff);

const runeblade: WeaponScript = {
  trailNode: 'tip',
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.halos.glow?.set(1 + 0.2 * pulse);
    let flash = 0;
    if (a.mode === 'attack') {
      // wind up over the shoulder, then one wide horizontal cut from right to left
      const p = prog(a, a.def.attackTime);
      const wind = smooth(p / 0.25);
      const cut = easeOut((p - 0.25) / 0.3);
      const arc = (a.s.arc ?? 140) * (PI / 180);
      m.body.rotation.y += -arc / 2 - 0.35 * wind + (arc + 0.35) * cut;
      m.body.rotation.z += -0.5 * wind * (1 - cut) - 0.25;
      m.body.scale.setScalar(appear(p));
      flash = bump(p, 0.3, 0.6);
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
      m.body.rotation.x += Math.sin(a.modeT * 50) * 0.05 * (1 - p);
    } else if (a.mode === 'destroy') {
      // shatters into light
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth((p - 0.2) / 0.5));
      flash = bump(p, 0.1, 0.5);
    } else {
      // idle: hangs point down and sways
      m.body.scale.setScalar(1);
      m.body.rotation.x += a.mode === 'idle' ? -1.35 + Math.sin(t * 1.1) * 0.05 : 0;
    }
    m.pose('soul', 0, 0, Math.sin(t * 3) * 0.05);
    m.halos.flash?.set(0.6 + flash * 0.8, flash * 0.8);
    m.glow.value += flash * 1.4;
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (a.mode === 'attack') {
      const p = a.modeT / a.def.attackTime;
      if (p > 0.25 && p < 0.6) stream(a, fx, 's', SWORD_SPARK, 50, dt, a.trailHead(), false);
    }
    if (a.mode === 'hit' && at(a, dt, 0)) emitAt(fx, a.target, L('spark', 14, 0xffffff, 6, 0.05, 0.25, PI, 1.5, 0x9fd8ff), q);
    if (a.mode === 'destroy' && at(a, dt, a.def.destroyTime * 0.2)) emitAt(fx, a.pos, L('shard', 14, 0xbfe0ff, 4, 0.07, 0.7, PI, 1.5), q);
  },
};

const PUNCH = [L('glow', 4, 0xfff0c0, 3, 0.25, 0.22, 0.8, 0.5, 0xffc66b), L('spark', 10, 0xffffff, 7, 0.05, 0.2, 0.9, 1, 0xffc66b), L('wisp', 6, 0xffe0a0, 3, 0.08, 0.4, 0.6, 0.4)];
const fist: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.halos.glow?.set(1 + 0.2 * pulse);
    m.pose('aura', 0, 0, t * 4);
    let flash = 0;
    if (a.mode === 'attack') {
      // pull back, then a straight jab that snaps forward and recoils
      const p = prog(a, a.def.attackTime);
      const back = smooth(p / 0.3);
      const jab = easeOut((p - 0.3) / 0.15);
      const ret = smooth((p - 0.55) / 0.3);
      m.body.position.z += (-0.25 * back + 0.8 * jab - 0.55 * ret) * a.size;
      m.body.rotation.z += (jab - ret) * 0.6;
      m.body.scale.setScalar(appear(p) * (1 + bump(p, 0.35, 0.55) * 0.25));
      flash = bump(p, 0.35, 0.6);
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
      m.body.scale.setScalar(1 + (1 - p) * 0.15);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth(p));
      m.body.position.y += p * 0.5;
    } else {
      m.body.scale.setScalar(1);
      // idle: clenches and loosens
      m.body.rotation.z += Math.sin(t * 1.6) * 0.1;
    }
    m.halos.flash?.set(0.6 + flash * 0.7, flash * 0.9);
    m.glow.value += flash * 1.4;
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (a.mode === 'attack' && at(a, dt, a.def.attackTime * 0.42)) {
      const tip = a.model.nodes.fist.getWorldPosition(v1);
      for (const l of PUNCH) emitAt(fx, tip, l, q, a.aim.x, a.aim.z);
      fx.light(tip.x, tip.y, tip.z, 0xffc66b, 3, 4);
    }
    if (a.mode === 'hit' && at(a, dt, 0)) for (const l of PUNCH) emitAt(fx, a.target, l, q);
  },
};

const lance: WeaponScript = {
  trailNode: 'tip',
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.halos.glow?.set(1 + 0.2 * pulse);
    m.pose('tassel', Math.sin(t * 5) * 0.25, 0, Math.sin(t * 3.4) * 0.3);
    let flash = 0;
    if (a.mode === 'attack') {
      // draw back, a long lunge along the line, a twist at full reach, withdraw
      const p = prog(a, a.def.attackTime);
      const back = smooth(p / 0.3);
      const lunge = easeOut((p - 0.3) / 0.14);
      const ret = smooth((p - 0.6) / 0.3);
      m.body.position.z += (-0.35 * back + 1.9 * lunge - 1.55 * ret) * a.size;
      m.body.rotation.z += lunge * (1 - ret) * PI * 0.5;
      m.body.scale.setScalar(appear(p));
      flash = bump(p, 0.32, 0.6);
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
      m.body.position.z += Math.sin(a.modeT * 40) * 0.03 * (1 - p);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth((p - 0.2) / 0.6));
      flash = bump(p, 0, 0.4);
    } else {
      m.body.scale.setScalar(1);
      m.body.rotation.x += a.mode === 'idle' ? -0.25 + Math.sin(t * 1.2) * 0.05 : 0;
    }
    m.halos.flash?.set(0.6 + flash * 0.8, flash * 0.8);
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (a.mode === 'attack') {
      const p = a.modeT / a.def.attackTime;
      if (p > 0.3 && p < 0.5) stream(a, fx, 'w', WIND, 60, dt, a.trailHead(), false);
      if (at(a, dt, a.def.attackTime * 0.44)) {
        const tip = a.trailHead();
        emitAt(fx, tip, L('spark', 12, 0xffffff, 8, 0.05, 0.25, 0.5, 0.5, 0xd9e6ff), q, a.aim.x, a.aim.z);
        fx.light(tip.x, tip.y, tip.z, 0xd9e6ff, 3, 4);
        if (a.tier >= 4) emitAt(fx, tip, L('ember', 14, 0xffb040, 6, 0.09, 0.6, 0.5, 1, 0xff4a10), q, a.aim.x, a.aim.z);
      }
    }
    if (a.mode === 'hit' && at(a, dt, 0)) emitAt(fx, a.target, L('spark', 14, 0xffffff, 7, 0.05, 0.25, PI, 1.5, 0xd9e6ff), q);
  },
};

// ------------------------------------------------------------------ Prism: hovers, charges, fires a beam
const PRISM_MOTE = L('gather', 1, 0xffd8f0, 1, 0.05, 0.4, PI, 0, 0xff6bd6);
const RAINBOW = [0xff6b6b, 0xffb34d, 0xfff06b, 0x6bff9a, 0x6bb4ff, 0xb98cff];
const prism: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    // the beam itself (the viewer turns it on; in a run the game draws the beam)
    a.addArc(0xff6bd6, 0.16, 0, 2).intensity = 0;
    a.addArc(0xffffff, 0.05, 0.02, 4).intensity = 0;
    a.facing = 'fixed';
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    // the crystal turns slowly on itself; satellites circle it
    m.pose('prism', 0, t * 0.6, Math.sin(t * 0.9) * 0.15);
    m.pose('sats', 0, t * 1.4, 0);
    for (let i = 0; i < 3; i++) m.pose('s' + i, 0, -t * 2, 0);
    let flash = 0;
    let charge = 0;
    if (a.mode === 'attack') {
      const p = prog(a, a.def.attackTime);
      charge = smooth(p / 0.3) * (1 - smooth((p - 0.85) / 0.15));
      flash = bump(p, 0.25, 0.45);
      m.pose('prism', 0, t * (0.6 + charge * 6), 0);
    } else if (a.mode === 'hit') {
      flash = 1 - prog(a, a.def.hitTime);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth((p - 0.2) / 0.5));
      flash = bump(p, 0.1, 0.4);
    } else m.body.scale.setScalar(1);
    a.charge = charge;
    m.halos.glow?.set(1 + 0.25 * pulse + charge * 0.6, 0.5 + charge * 0.4);
    m.halos.flash?.set(0.6 + flash * 0.6, flash * 0.8);
    m.glow.value += flash + charge;
  },
  fx(a, dt, fx, pulse) {
    const q = qm(a, fx);
    const core = a.model.nodes.prism.getWorldPosition(v1);
    const beamOn = a.mode === 'attack' && a.s.beam === 1 && a.modeT > a.def.attackTime * 0.28 && a.modeT < a.def.attackTime * 0.9;
    const k = beamOn ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const arc = a.arcs[i];
      arc.intensity = k * (i === 0 ? 1.1 : 1.5) * (0.85 + Math.random() * 0.3);
      arc.width = (i === 0 ? 0.14 + a.tier * 0.03 : 0.05) * (0.9 + Math.random() * 0.2);
      arc.a.copy(core);
      arc.b.copy(a.target);
      // the beam colour cycles through the spectrum at the evolution
      if (i === 0) arc.color.setHex(a.tier >= 4 ? RAINBOW[Math.floor(a.t * 8) % RAINBOW.length] : 0xff6bd6);
    }
    if (beamOn) {
      fx.light(a.target.x, a.target.y, a.target.z, 0xff6bd6, 3, 4);
      stream(a, fx, 'b', L('spark', 1, 0xffffff, 3, 0.05, 0.25, PI, 1, 0xff6bd6), 40, dt, a.target, false);
    }
    if (a.charge > 0.05) stream(a, fx, 'g', PRISM_MOTE, 40 * a.charge, dt, core, false);
    if (a.mode === 'destroy' && at(a, dt, a.def.destroyTime * 0.2)) emitAt(fx, core, L('shard', 16, 0xffd8f0, 4, 0.08, 0.7, PI, 1.5, 0xff6bd6), q);
    fx.light(core.x, core.y, core.z, 0xff6bd6, 0.6 + 0.3 * pulse + a.charge * 2, 3);
  },
};

// ------------------------------------------------------------------ Halo and Heart: auras that pulse
const HOLY = L('gather', 1, 0xfff4c0, 0.8, 0.06, 0.6, PI, 0.4, 0xffd860);
const halo: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    a.addWave(0xfff1a8);
    a.facing = 'fixed';
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    // the ring hangs level and breathes; the rays twinkle (no spinning)
    m.pose('halo', Math.sin(t * 0.9) * 0.05, 0, Math.cos(t * 0.8) * 0.05);
    m.nodes.rays.scale.setScalar(1 + 0.06 * Math.sin(t * 3));
    m.pose('wings', 0, 0, 0);
    m.nodes.wings.scale.set(1, 1 + Math.sin(t * 2.2) * 0.12, 1);
    let flash = 0;
    if (a.mode === 'attack') {
      const p = prog(a, a.def.attackTime);
      flash = bump(p, 0, 0.5);
      m.body.scale.setScalar(1 + flash * 0.2);
    } else if (a.mode === 'hit') {
      flash = (1 - prog(a, a.def.hitTime)) * 0.6;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 + p * 0.6);
      m.halos.glow?.set(1, 0.45 * (1 - p));
      m.body.visible = p < 0.95;
    } else m.body.scale.setScalar(1);
    if (a.mode !== 'destroy') m.halos.glow?.set(1 + 0.2 * pulse + flash * 0.4, 0.35 + flash * 0.3);
    m.halos.flash?.set(0.6 + flash, flash * 0.6);
    m.glow.value += flash;
  },
  fx(a, dt, fx, pulse) {
    const w = a.waves[0];
    if (a.mode === 'attack') {
      const p = a.modeT / a.def.attackTime;
      const r = (0.5 + easeOut(p) * (a.s.radius ?? 2.2)) * 1;
      w?.set(a.pos.x, 0.07, a.pos.z, r, (1 - smooth(p)) * 0.8 * (a.s.waveK ?? 1));
      if (at(a, dt, 0)) emitAt(fx, a.pos, L('glow', 8, 0xfff4c0, 3, 0.2, 0.4, PI, 0.5), qm(a, fx));
    } else w?.set(0, 0, 0, 0, 0);
    if (a.mode === 'destroy') return;
    v1.set(a.pos.x + (Math.random() - 0.5) * 0.8, a.pos.y, a.pos.z + (Math.random() - 0.5) * 0.8);
    stream(a, fx, 'h', HOLY, a.def.particles * (0.6 + a.tier * 0.15), dt, v1, false);
    fx.light(a.pos.x, a.pos.y, a.pos.z, 0xfff1a8, 0.8 + 0.3 * pulse, 3.5);
  },
};

const BEAT = L('glow', 1, 0xd8fff0, 1.5, 0.15, 0.35, PI, 0.2, 0x7affc3);
/** Double heartbeat: lub-dub, then rest (0..1 swell). */
const heartbeat = (t: number) => {
  const c = t % 1.1;
  return Math.max(bump(c, 0, 0.16), bump(c, 0.2, 0.36) * 0.7);
};
const heart: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    a.addWave(0x7affc3);
    a.addWave(0xd8fff0);
    a.facing = 'fixed';
  },
  start(a) {
    resetBody(a);
  },
  pose(a, _dt, pulse) {
    const m = a.model;
    const t = a.t;
    const beat = heartbeat(t);
    m.nodes.heart.scale.setScalar(1 + beat * 0.12);
    m.nodes.core.scale.setScalar(1 + beat * 0.3);
    m.pose('heart', 0, Math.sin(t * 0.7) * 0.4, Math.sin(t * 1.1) * 0.06);
    m.pose('rings', t * 0.9, t * 1.3, 0);
    let flash = beat * 0.3;
    if (a.mode === 'attack') {
      // one huge beat that releases the wave
      const p = prog(a, a.def.attackTime);
      const big = bump(p, 0.1, 0.35);
      m.nodes.heart.scale.setScalar(1 - bump(p, 0, 0.12) * 0.15 + big * 0.4);
      flash = big;
    } else if (a.mode === 'hit') {
      flash = (1 - prog(a, a.def.hitTime)) * 0.6;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth((p - 0.3) / 0.6));
      flash = bump(p, 0, 0.4);
    } else m.body.scale.setScalar(1);
    m.halos.glow?.set(1 + 0.15 * pulse + flash * 0.6, 0.45 + flash * 0.4);
    m.halos.flash?.set(0.5 + flash, flash * 0.7);
    m.glow.value += flash * 1.4;
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    const r = a.s.radius ?? 5;
    if (a.mode === 'attack') {
      const p = a.modeT / a.def.attackTime;
      const k = clamp01((p - 0.2) / 0.7);
      a.waves[0]?.set(a.pos.x, 0.06, a.pos.z, 0.3 + easeOut(k) * r, (1 - smooth(k)) * 0.9 * (a.s.waveK ?? 1));
      a.waves[1]?.set(a.pos.x, 0.08, a.pos.z, 0.2 + easeOut(clamp01(k * 1.25 - 0.1)) * r * 0.85, (1 - smooth(k)) * 0.6 * (a.s.waveK ?? 1));
      if (at(a, dt, a.def.attackTime * 0.22)) {
        emitAt(fx, a.pos, L('glow', 10, 0xd8fff0, 4, 0.25, 0.4, PI, 0.3, 0x7affc3), q);
        emitAt(fx, a.pos, L('spark', 18, 0xffffff, 8, 0.05, 0.3, PI, 0.6, 0x7affc3), q);
      }
      if (p < 0.5) fx.light(a.pos.x, a.pos.y, a.pos.z, 0x7affc3, 4 * (1 - p * 2), 6);
    } else {
      a.waves[0]?.set(0, 0, 0, 0, 0);
      a.waves[1]?.set(0, 0, 0, 0, 0);
    }
    if (a.mode === 'destroy') {
      if (at(a, dt, a.def.destroyTime * 0.3)) emitAt(fx, a.pos, L('shard', 16, 0xb8ffe0, 4, 0.08, 0.7, PI, 1.5), q);
      return;
    }
    if (heartbeat(a.t) > 0.9 && (a.s.lastBeat ?? -1) !== Math.floor(a.t / 1.1)) {
      a.s.lastBeat = Math.floor(a.t / 1.1);
      emitAt(fx, a.pos, BEAT, q * 3);
    }
    fx.light(a.pos.x, a.pos.y, a.pos.z, 0x7affc3, 0.6 + heartbeat(a.t), 3.5);
  },
};

export const SCRIPTS2: Record<string, WeaponScript> = { dagger, arcane, iceshard, arrow, heavybolt, glaive, saw, wispshot, wisp, bomb, mine, runeblade, fist, lance, prism, halo, heart };
void v2;
