import * as THREE from 'three';
import type { EmitKind, EmitLayer } from '../../config/vfx';
import type { WeaponActor, FxPort, WeaponScript } from './actor';

/**
 * Motion scripts: one per weapon object. Each poses the model's nodes every frame (idle sway,
 * flight motion, attack/hit/destroy timelines) and spawns its own particles, arcs and lights.
 * Timelines read `a.modeT` (seconds since the animation started) so the game and the viewer play
 * them identically; one-shot animations set `a.finished` when they end.
 */

const PI = Math.PI;
const TAU = PI * 2;
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const e1 = new THREE.Euler();

const L = (kind: EmitKind, count: number, color: number, speed: number, size: number, life: number, spread = PI, up?: number, color2?: number): EmitLayer => ({ kind, count, color, color2, speed, size, life, spread, up });

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
/** 0→1→0 bump over [a, b]. */
const bump = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * PI));
/** Progress of a one-shot animation; marks it finished at the end. */
function prog(a: WeaponActor, len: number): number {
  const p = a.modeT / len;
  if (p >= 1) a.finished = true;
  return clamp01(p);
}
/** True on the frame the timeline passes `t`. */
function at(a: WeaponActor, dt: number, t: number): boolean {
  return a.modeT >= t && a.modeT - dt < t + 1e-9 && (t > 0 || a.modeT - dt < 1e-6);
}
const flying = (a: WeaponActor) => a.mode === 'fly' || a.mode === 'idle' || a.mode === 'chain' || a.mode === 'charge';
/** Particle multiplier: effect quality × upgrade tier. */
const qm = (a: WeaponActor, fx: FxPort) => [0.35, 0.65, 1][fx.quality] * (0.75 + 0.12 * a.tier) * a.def.intensity;

function emitAt(fx: FxPort, p: THREE.Vector3, l: EmitLayer, mul: number, dx = 0, dz = 0) {
  if (mul > 0) fx.emit(p.x, p.y, p.z, l, dx, dz, mul);
}
/** Emits `perSec` single particles of a layer per second (fractional rates accumulate). */
function stream(a: WeaponActor, fx: FxPort, key: string, l: EmitLayer, perSec: number, dt: number, p: THREE.Vector3, back = true) {
  const n = a.rate(key, perSec * qm(a, fx), dt);
  for (let i = 0; i < n; i++) emitAt(fx, p, l, 1, back ? -a.dir.x : 0, back ? -a.dir.z : 0);
}
/** Keeps a halo on the root so hiding the body never hides the flash. */
function haloToRoot(a: WeaponActor, name: string) {
  const h = a.model.halos[name];
  if (h) {
    h.sprite.position.set(0, 0, 0);
    a.model.root.add(h.sprite);
  }
}
function resetBody(a: WeaponActor) {
  a.model.body.visible = true;
  a.model.body.scale.setScalar(1);
}
/** World quaternion of the body (root × body; the world parent has no rotation). */
function bodyWorldQ(a: WeaponActor, out: THREE.Quaternion) {
  return out.copy(a.model.root.quaternion).multiply(a.model.body.quaternion);
}

// ============================================================ Ember Orb
const EMBER_TRAIL = L('ember', 1, 0xffc040, 1.2, 0.09, 0.55, 0.5, 1.2, 0xff4a10);
const EMBER_SMOKE = L('smoke', 1, 0x3a2e2a, 0.4, 0.35, 0.7, 0.6, 0.6);
const EMBER_SPARK = L('spark', 1, 0xfff0b0, 3, 0.05, 0.2, 0.8, 1, 0xff9a3a);
const EMBER_HIT = [
  L('glow', 8, 0xffd060, 4, 0.28, 0.3, PI, 1, 0xff5a10),
  L('spark', 18, 0xfff0b0, 9, 0.06, 0.3, PI, 2.5, 0xff7a20),
  L('ember', 14, 0xffb040, 3.5, 0.1, 1.1, PI, 2.4, 0xff3a00),
  L('smoke', 5, 0x3a302c, 1, 0.6, 1.1, PI, 0.8),
  L('debris', 5, 0x3a2a24, 3, 0.09, 0.7, PI),
];
const EMBER_FIRE = L('ember', 1, 0xffd060, 0.4, 0.14, 0.5, PI, 2.2, 0xff4a10);
const EMBER_ASH = L('smoke', 1, 0x5a524e, 0.5, 0.3, 0.9, PI, 0.6);

const ember: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.pose('core', t * 1.3, t * 0.7, 0);
    m.pose('coreEvo', t * 1.1, -t * 0.9, 0);
    m.pose('chunks', Math.sin(t * 0.7) * 0.4, t * 3.2, t * 0.5);
    for (let i = 0; i < 3; i++) m.pose('c' + i, t * (2 + i), t * 1.5, 0);
    m.pose('band', 0, t * 4, 0);
    m.pose('flare', 0, -t * 2, Math.sin(t * 2) * 0.2);
    const crackPulse = 0.5 + 0.5 * Math.sin(t * 9 + Math.sin(t * 3) * 2);
    m.glow.value += crackPulse * 0.6;
    m.halos.glow?.set(1 + 0.18 * pulse + a.charge * 0.5, 0.75 + 0.2 * crackPulse);
    m.halos.hot?.set(0.85 + 0.3 * crackPulse);
    m.halos.sun?.set(1 + 0.15 * Math.sin(t * 5));
    const fl = m.halos.flash;
    if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      fl?.set(0.6 + 2.4 * easeOut(p * 2), Math.max(0, 1 - p * 1.6));
      m.body.scale.setScalar(Math.max(0, 1 + p * 1.5 - p * p * 6));
      m.body.visible = p < 0.4;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      fl?.set(0.4, 0);
      m.body.scale.setScalar(1 - smooth(p));
      m.glow.value *= 1 - p;
    } else if (a.mode === 'attack') {
      // launch: squash and flare
      const p = prog(a, a.def.attackTime);
      fl?.set(0.5 + p, bump(p, 0, 0.35) * 0.8);
      m.body.scale.setScalar(1 + bump(p, 0, 0.3) * 0.35);
    } else fl?.set(1, 0);
  },
  fx(a, dt, fx, pulse) {
    const q = qm(a, fx);
    const p = a.trailHead();
    if (flying(a) || a.mode === 'attack') {
      const evo = a.tier >= 4;
      stream(a, fx, 'e', evo ? { ...EMBER_TRAIL, color: 0xfff0a0 } : EMBER_TRAIL, a.def.particles * 0.6, dt, p);
      stream(a, fx, 's', EMBER_SMOKE, a.def.particles * 0.18, dt, p);
      stream(a, fx, 'k', EMBER_SPARK, a.def.particles * 0.3, dt, p);
      fx.light(a.pos.x, a.pos.y, a.pos.z, a.def.color, 1.1 + pulse * 0.5 + a.tier * 0.15, 3.2 + a.tier * 0.3);
    }
    if (a.mode === 'hit') {
      if (at(a, dt, 0)) for (const l of EMBER_HIT) emitAt(fx, a.pos, l, q * (a.tier >= 4 ? 1.5 : 1));
      if (a.modeT < 0.25) fx.light(a.pos.x, a.pos.y, a.pos.z, 0xffb050, 4 * (1 - a.modeT * 4), 5);
      // a small fire licking where it landed
      v1.set(a.pos.x, Math.max(0.1, a.pos.y - 0.3), a.pos.z);
      stream(a, fx, 'f', EMBER_FIRE, 18 * (1 - a.modeT / a.def.hitTime), dt, v1, false);
    }
    if (a.mode === 'destroy') {
      stream(a, fx, 'a', EMBER_ASH, 14, dt, a.pos, false);
      stream(a, fx, 'e', EMBER_TRAIL, 20 * (1 - a.modeT), dt, a.pos, false);
    }
  },
};

// ============================================================ Venom Flask
const FLASK_DRIP = L('glow', 1, 0xb8ff6a, 0.3, 0.07, 0.6, 0.6, -2.5, 0x5ab824);
const FLASK_BUBBLE = L('bubble', 1, 0xd8ffa0, 0.5, 0.08, 0.6, PI, 0.6);
const FLASK_SHATTER = [
  L('shard', 10, 0xe8fff0, 6, 0.09, 0.6, PI, 3, 0xb8f0c8),
  L('glow', 8, 0xb8ff6a, 5, 0.16, 0.45, PI, 2.5, 0x5ab824),
  L('bubble', 6, 0xd8ffa0, 2.5, 0.1, 0.9, PI, 1.5),
  L('smoke', 4, 0x7ad83a, 1.4, 0.8, 1.4, PI, 0.6, 0x4a9a24),
  L('debris', 3, 0x9a6a3a, 4, 0.1, 0.7, PI),
];
const FLASK_CLOUD = L('smoke', 1, 0x8ae83a, 0.6, 0.7, 1.2, PI, 0.4, 0x4a9a24);
const FLASK_WISP = L('wisp', 1, 0xb8ff6a, 0.8, 0.07, 0.8, PI, 0.6);

const flask: WeaponScript = {
  trailNode: 'flask',
  init(a) {
    haloToRoot(a, 'flash');
  },
  start(a) {
    resetBody(a);
    a.model.nodes.flask.visible = true;
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    if (a.mode === 'idle') {
      // at rest it stands upright and rocks gently
      m.body.rotation.set(Math.sin(t * 1.3) * 0.12, t * 0.6, Math.sin(t * 1.7) * 0.1);
    }
    // the liquid stays level in the world and sloshes against the tumble
    const liq = m.nodes.liquid;
    bodyWorldQ(a, q1).invert();
    const slosh = 0.22 + Math.min(0.35, a.speed * 0.05);
    e1.set(Math.sin(t * 7.3) * slosh, 0, Math.cos(t * 5.1) * slosh * 0.8);
    q2.setFromEuler(e1);
    // its parent is the body, so local = body⁻¹ · wanted
    liq.quaternion.copy(q1).multiply(q2);
    for (let i = 0; i < 5; i++) {
      const ph = (t * (0.9 + i * 0.17) + i * 0.37) % 1;
      m.offset('bub' + i, Math.sin(t * 3 + i) * 0.6, ph * 6.4, Math.cos(t * 2.3 + i) * 0.5);
      m.nodes['bub' + i].scale.setScalar(ph < 0.85 ? 0.6 + ph * 0.6 : (1 - ph) * 6);
    }
    m.pose('tag', Math.sin(t * 5) * 0.3, 0, Math.sin(t * 6.3) * 0.45);
    m.pose('runes', 0, t * 1.5, 0);
    m.pose('bloom', 0, -t * 0.8, 0);
    m.halos.glow?.set(1 + 0.2 * pulse, 0.25 + 0.15 * pulse);
    const fl = m.halos.flash;
    const breaking = a.mode === 'hit' || a.mode === 'shatter';
    if (breaking) {
      const p = prog(a, a.mode === 'hit' ? a.def.hitTime : a.def.destroyTime);
      fl?.set(0.5 + 2 * easeOut(p * 3), Math.max(0, 1 - p * 2.2));
      m.body.visible = a.modeT < 0.05;
      m.body.scale.setScalar(1 + a.modeT * 4);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      fl?.set(1, 0);
      m.body.scale.setScalar(1 - smooth(p));
      m.glow.value *= 1 - p;
    } else if (a.mode === 'attack') {
      // the throw: wind up, then a hard spin
      const p = prog(a, a.def.attackTime);
      fl?.set(1, 0);
      m.body.rotation.x += -bump(p, 0, 0.35) * 1.2 + smooth((p - 0.35) / 0.65) * TAU * 2;
    } else fl?.set(1, 0);
  },
  spinMul(a) {
    return a.mode === 'idle' ? 0 : 1;
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (flying(a) || a.mode === 'attack') {
      const p = a.trailHead();
      stream(a, fx, 'd', a.tier >= 4 ? { ...FLASK_DRIP, color: 0xe4ff6a } : FLASK_DRIP, a.def.particles * 0.9, dt, p);
      stream(a, fx, 'b', FLASK_BUBBLE, a.def.particles * 0.3, dt, p);
      fx.light(a.pos.x, a.pos.y, a.pos.z, a.def.color, 0.6, 2.4);
    }
    const breaking = a.mode === 'hit' || a.mode === 'shatter';
    if (breaking) {
      if (at(a, dt, 0)) for (const l of FLASK_SHATTER) emitAt(fx, a.pos, l, q * (a.tier >= 4 ? 1.4 : 1));
      if (a.modeT < 0.3) fx.light(a.pos.x, a.pos.y, a.pos.z, 0xb8ff6a, 3 * (1 - a.modeT / 0.3), 4.5);
      // the poison cloud keeps rolling for a moment
      const left = 1 - a.modeT / (a.mode === 'hit' ? a.def.hitTime : a.def.destroyTime);
      v1.set(a.pos.x, Math.max(0.2, a.pos.y - 0.2), a.pos.z);
      stream(a, fx, 'c', FLASK_CLOUD, 10 * left, dt, v1, false);
      stream(a, fx, 'w', FLASK_WISP, 16 * left, dt, v1, false);
    }
    if (a.mode === 'destroy') stream(a, fx, 'b', FLASK_BUBBLE, 24 * (1 - a.modeT), dt, a.pos, false);
  },
};

// ============================================================ Poison puddle
const PUDDLE_POP = L('bubble', 1, 0xd8ffa0, 0.4, 0.09, 0.5, PI, 0.8);
const puddle: WeaponScript = {
  init(a) {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU + Math.random() * 0.8;
      const r = 2 + Math.random() * 5.5;
      a.s['bx' + i] = Math.cos(ang) * r;
      a.s['bz' + i] = Math.sin(ang) * r;
      a.s['bp' + i] = Math.random();
    }
  },
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.pose('pool', 0, t * 0.15, 0);
    m.nodes.pool.scale.set(1 + Math.sin(t * 2) * 0.03, 1, 1 + Math.cos(t * 1.7) * 0.03);
    for (let i = 0; i < 6; i++) {
      const ph = (t * (0.5 + i * 0.07) + a.s['bp' + i]) % 1;
      m.offset('pb' + i, a.s['bx' + i], ph * 1.2, a.s['bz' + i]);
      m.nodes['pb' + i].scale.setScalar(ph < 0.85 ? 0.3 + ph : (1 - ph) * 7.6);
    }
    m.halos.glow?.set(1 + 0.12 * pulse, 0.14 + 0.08 * pulse);
    if (a.mode === 'attack') {
      // spreading out of the splash
      const p = prog(a, 0.45);
      m.body.scale.set(easeOut(p), 1, easeOut(p));
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.set(1 - p * 0.3, 1 - p, 1 - p * 0.3);
      m.halos.glow?.set(1, 0.3 * (1 - p));
      if (p >= 1) m.body.visible = false;
    }
  },
  fx(a, dt, fx) {
    if (a.mode === 'destroy') return;
    const r = a.size * 0.8;
    const ang = Math.random() * TAU;
    v1.set(a.pos.x + Math.cos(ang) * r * Math.random(), a.pos.y + 0.1, a.pos.z + Math.sin(ang) * r * Math.random());
    stream(a, fx, 'p', PUDDLE_POP, 2 + a.size, dt, v1, false);
    stream(a, fx, 'c', FLASK_CLOUD, 0.6 + a.size * 0.4, dt, v1, false);
  },
};

// ============================================================ Cyclone (Cyclone Fan's tornado)
const CY_DUST = L('smoke', 1, 0xd8c8a8, 1.6, 0.5, 0.8, PI, 0.3, 0xb8a888);
const CY_LEAF = L('debris', 1, 0x6aa040, 2.4, 0.08, 0.9, PI, 2.4, 0xa8c050);
const CY_WISP = L('wisp', 1, 0xffffff, 2.2, 0.06, 0.6, PI, 1.6, 0xc8f5ff);

const cyclone: WeaponScript = {
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    for (let i = 0; i < 6; i++) {
      m.pose('r' + i, Math.sin(t * 1.3 + i) * 0.06, t * (2 + i * 0.9) * (i % 2 ? 1 : 1.3), Math.cos(t * 1.1 + i * 0.7) * 0.06);
      // the funnel snakes: higher rings swing further
      m.offset('r' + i, Math.sin(t * 2.1 + i * 0.8) * i * 0.4, 0, Math.cos(t * 1.7 + i * 0.9) * i * 0.4);
      m.nodes['r' + i].scale.setScalar(1 + Math.sin(t * 3 + i) * 0.06);
    }
    for (let i = 0; i < 9; i++) {
      const h = (t * (0.35 + (i % 3) * 0.08) + i * 0.13) % 1;
      const ang = t * (5 + (i % 3)) + i * 0.7;
      const r = 3 + h * 17;
      m.offset('lf' + i, Math.cos(ang) * r, 1 + h * 34, Math.sin(ang) * r);
      m.pose('lf' + i, t * 7 + i, t * 5, t * 3);
    }
    m.pose('core', 0, -t * 3, 0);
    m.pose('runes', 0, -t * 2.5, 0);
    m.pose('eye', 0, t * 2, 0);
    m.offset('eye', Math.sin(t * 2.1 + 4) * 2, Math.sin(t * 3) * 0.6, Math.cos(t * 1.7 + 4.5) * 2);
    // lean into the travel direction
    m.body.rotation.x += Math.min(0.3, a.speed * 0.05);
    m.halos.dust?.set(1 + 0.15 * pulse, 0.18 + 0.08 * pulse);
    m.halos.inner?.set(1 + 0.1 * pulse, 0.12 + 0.08 * pulse);
    m.halos.eye?.set(0.9 + 0.3 * pulse);
    if (a.mode === 'attack' || a.mode === 'fanOpen') {
      // spin up out of the fan's gust
      const p = prog(a, a.def.attackTime * 0.6);
      const k = easeOut(p);
      m.body.scale.set(0.25 + 0.75 * k, 0.1 + 0.9 * k, 0.25 + 0.75 * k);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.set(1 + p * 0.8, 1 - smooth(p), 1 + p * 0.8);
      if (p >= 1) m.body.visible = false;
    } else m.body.scale.setScalar(1);
  },
  spinMul(a) {
    return a.mode === 'destroy' ? 1 + a.modeT * 2 : a.mode === 'attack' ? 1.4 : 1;
  },
  fx(a, dt, fx) {
    if (a.mode === 'destroy' && a.modeT > 0.6) return;
    const sc = a.def.scale * a.size;
    const ang = Math.random() * TAU;
    v1.set(a.pos.x + Math.cos(ang) * 0.5 * sc, a.pos.y + 0.15, a.pos.z + Math.sin(ang) * 0.5 * sc);
    stream(a, fx, 'd', CY_DUST, a.def.particles * 0.5, dt, v1, false);
    stream(a, fx, 'l', CY_LEAF, a.def.particles * 0.25, dt, v1, false);
    const h = Math.random() * 2 * sc;
    const r = (0.3 + h * 0.35) * 1;
    v2.set(a.pos.x + Math.cos(ang + 1) * r, a.pos.y + h, a.pos.z + Math.sin(ang + 1) * r);
    stream(a, fx, 'w', CY_WISP, a.def.particles * 0.5, dt, v2, false);
  },
};

// ============================================================ Cyclone Fan (held, opens and sweeps)
const SLATS = 7;
const FAN_GUST = L('wisp', 1, 0xffffff, 5, 0.07, 0.5, 0.5, 0.4, 0xc8f5ff);
const FAN_LEAF = L('debris', 1, 0x8ab84a, 4, 0.08, 0.7, 0.6, 1.2, 0xc8a040);

const fan: WeaponScript = {
  start(a) {
    resetBody(a);
  },
  pose(a, dt) {
    const m = a.model;
    const t = a.t;
    let target = 0.42 + 0.08 * Math.sin(t * 1.3);
    let swing = Math.sin(t * 1.4) * 0.12;
    if (a.mode === 'attack' || a.mode === 'fanOpen') {
      const p = prog(a, a.def.attackTime);
      target = p < 0.75 ? 1 : 0.1;
      // two quick sweeps while open
      swing = p < 0.22 ? 0 : p < 0.75 ? Math.sin(((p - 0.22) / 0.53) * TAU) * 0.9 : 0;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      target = 0;
      m.body.scale.setScalar(1 - smooth(p));
    }
    const o = (a.s.o ?? 0) + (target - (a.s.o ?? 0)) * Math.min(1, dt * (target > (a.s.o ?? 0) ? 16 : 8));
    a.s.o = o;
    for (let i = 0; i < SLATS; i++) {
      const th = (-75 + i * 25) * o;
      m.pose('s' + i, 0, 0, (-th * PI) / 180);
    }
    a.s.swing = swing;
    m.pose('fan', -0.15, swing, Math.sin(t * 2) * 0.05);
    m.pose('tassel', Math.sin(t * 4) * 0.3 - swing * 0.3, 0, Math.sin(t * 3.1) * 0.35 + swing * 0.4);
    m.pose('eye', 0, 0, t * 3);
    m.halos.pivot?.set(1 + o * 0.8, 0.4 + o * 0.5);
    m.glow.value += o * 0.6;
  },
  fx(a, dt, fx) {
    if (a.mode !== 'attack' && a.mode !== 'fanOpen') return;
    const p = a.modeT / a.def.attackTime;
    if (p < 0.2 || p > 0.8) return;
    // the gust leaves along the fan's facing, swung by the sweep
    const yaw = Math.atan2(a.aim.x, a.aim.z) + (a.s.swing ?? 0);
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    v1.set(a.pos.x + dx * 0.4, a.pos.y + 0.3, a.pos.z + dz * 0.4);
    const n = a.rate('g', 60 * qm(a, fx), dt);
    for (let i = 0; i < n; i++) fx.emit(v1.x, v1.y, v1.z, FAN_GUST, dx, dz, 1);
    const n2 = a.rate('l', 12 * qm(a, fx), dt);
    for (let i = 0; i < n2; i++) fx.emit(v1.x, v1.y, v1.z, FAN_LEAF, dx, dz, 1);
  },
};

// ============================================================ Storm Rod
const ROD_TIPS = [45, 135, 225, 315].map((d) => [Math.sin((d * PI) / 180) * 1.6, Math.cos((d * PI) / 180) * 1.6]);
const ROD_SPARK = L('spark', 1, 0xe8f8ff, 2.2, 0.05, 0.22, PI, 0.5, 0x8ad0ff);
const ROD_GATHER = L('gather', 1, 0xd8f0ff, 1.2, 0.07, 0.3, PI, 0, 0x8ad0ff);
const ROD_FLASH = [L('spark', 16, 0xffffff, 8, 0.06, 0.25, PI, 3, 0xfff27a), L('glow', 6, 0xd8f0ff, 3, 0.25, 0.25, PI)];
const ROD_HIT = [
  L('spark', 22, 0xffffff, 10, 0.07, 0.3, PI, 3, 0xfff27a),
  L('glow', 8, 0xb3f0ff, 4, 0.3, 0.3, PI, 1),
  L('debris', 5, 0x6a6458, 3.5, 0.09, 0.6, PI),
  L('smoke', 3, 0x8a90a8, 0.8, 0.5, 0.7, PI, 0.5),
];
const ROD_SHARDS = [L('shard', 18, 0xbfeaff, 5, 0.09, 0.8, PI, 2.5, 0xffffff), L('spark', 12, 0xffffff, 6, 0.05, 0.3, PI, 1)];

const rod: WeaponScript = {
  trailNode: 'core',
  init(a) {
    for (let i = 0; i < 4; i++) a.addArc(0xbfe8ff, 0.035, 0.12, 5);
    // the bolt that leaves the rod / strikes the target
    a.addArc(0xfff6c0, 0.12, 0.5, 10).intensity = 0;
    a.facing = 'fixed';
  },
  start(a) {
    resetBody(a);
    a.model.nodes.core.visible = true;
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    if (a.mode === 'charge') a.charge = Math.min(1, a.modeT / 1.2);
    const c = a.charge;
    m.pose('core', Math.sin(t * 1.7) * 0.3, t * (2 + c * 6), 0);
    m.nodes.core.scale.setScalar(1 + 0.08 * pulse + c * 0.25 + (Math.random() - 0.5) * 0.06 * c);
    m.pose('orbit', Math.sin(t * 0.9) * 0.5, t * (3 + c * 5), 0);
    for (let i = 0; i < 3; i++) m.pose('sh' + i, t * 2, t * 3 + i, 0);
    m.pose('ring', Math.sin(t) * 0.35, t * 1.5, 0.4);
    m.pose('crown', 0, -t * 0.8, 0);
    m.halos.core?.set(1 + 0.25 * pulse + c * 1.2, 0.7 + 0.3 * c);
    let lift = 0;
    let tilt = 0;
    let flash = 0;
    if (a.mode === 'attack') {
      const p = prog(a, a.def.attackTime);
      lift = easeOut(p / 0.2) * (1 - smooth((p - 0.5) / 0.5));
      tilt = -bump(p, 0, 0.3) * 0.35 + bump(p, 0.2, 0.5) * 0.2;
      flash = bump(p, 0.15, 0.45);
      a.charge = Math.max(0, 1 - p * 3);
    } else if (a.mode === 'charge') {
      if (a.modeT >= 1.2) a.finished = true;
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.nodes.core.visible = a.modeT < 0.06;
      m.body.scale.setScalar(1 - smooth((p - 0.4) / 0.6));
      tilt = p * 1.2;
      lift = -p * 0.5;
    }
    m.offset('rod', 0, lift * 3, 0);
    m.pose('rod', tilt, 0, Math.sin(t * 1.3) * 0.08);
    m.halos.flash?.set(0.6 + flash * 1.2, flash * 0.9);
    m.glow.value += flash * 2;
  },
  fx(a, dt, fx, pulse) {
    const c = a.charge;
    const q = qm(a, fx);
    const core = a.nodePoint('core', 0, 0, 0, v1);
    const live = a.mode !== 'destroy';
    // little arcs jumping from the crystal to the prongs; more and brighter with charge
    for (let i = 0; i < 4; i++) {
      const arc = a.arcs[i];
      const key = 'ak' + i;
      a.s[key] = (a.s[key] ?? 0) - dt;
      if (a.s[key] <= 0) {
        a.s[key] = 0.05 + Math.random() * 0.25;
        a.s['ao' + i] = live && Math.random() < 0.35 + c * 0.6 + (a.tier - 1) * 0.08 ? 1 : 0;
      }
      arc.intensity = (a.s['ao' + i] ?? 0) * (0.6 + c * 0.8);
      arc.a.copy(core);
      a.nodePoint('head', ROD_TIPS[i][0], 7.3, ROD_TIPS[i][1], arc.b);
    }
    const bolt = a.arcs[4];
    if (a.mode === 'attack') {
      const p = a.modeT / a.def.attackTime;
      bolt.intensity = bump(p, 0.15, 0.55) * 1.6;
      bolt.a.copy(core);
      bolt.b.set(core.x + Math.sin(a.t * 30) * 0.2, core.y + 9, core.z);
      if (at(a, dt, a.def.attackTime * 0.17)) for (const l of ROD_FLASH) emitAt(fx, core, l, q);
      if (p < 0.5) fx.light(core.x, core.y, core.z, 0xd8f0ff, 3.5 * (1 - p * 2), 5);
    } else if (a.mode === 'hit') {
      // the strike lands on the target
      const p = a.modeT / a.def.hitTime;
      bolt.intensity = (1 - p) * 1.8;
      bolt.a.set(a.target.x, a.target.y + 9, a.target.z);
      bolt.b.copy(a.target);
      if (at(a, dt, 0)) for (const l of ROD_HIT) emitAt(fx, a.target, l, q);
      fx.light(a.target.x, a.target.y + 0.5, a.target.z, 0xfff6c0, 4 * (1 - p), 5);
    } else bolt.intensity = 0;
    if (a.mode === 'destroy' && at(a, dt, 0)) for (const l of ROD_SHARDS) emitAt(fx, core, l, q);
    if (!live) return;
    stream(a, fx, 's', ROD_SPARK, a.def.particles * (0.6 + c * 2), dt, core, false);
    if (c > 0.05) stream(a, fx, 'g', ROD_GATHER, 30 * c, dt, core, false);
    fx.light(core.x, core.y, core.z, 0x8ad0ff, 0.7 + 0.3 * pulse + c * 1.6, 3 + c * 1.5);
  },
};

// ============================================================ Tempest Crown storm cloud
const CLOUD_RAIN = L('glow', 1, 0x9ad0ff, 0.2, 0.04, 0.5, PI, -6);
const stormcloud: WeaponScript = {
  init(a) {
    a.addArc(0xfff6c0, 0.06, 0.3, 7).intensity = 0;
  },
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.pose('puffs', Math.sin(t * 0.7) * 0.06, Math.sin(t * 0.4) * 0.2, Math.cos(t * 0.6) * 0.06);
    m.nodes.puffs.scale.set(1 + Math.sin(t * 1.3) * 0.05, 1 + Math.sin(t * 1.7) * 0.06, 1 + Math.cos(t * 1.1) * 0.05);
    a.s.flick = (a.s.flick ?? 0) - dt;
    if (a.s.flick <= 0) {
      a.s.flick = 0.15 + Math.random() * 0.6;
      a.s.on = Math.random() < 0.4 ? 1 : 0;
    }
    m.nodes.bolt.visible = a.s.on > 0;
    m.halos.inner?.set(1 + 0.1 * pulse, 0.25 + 0.4 * a.s.on);
    if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth(p));
    }
  },
  fx(a, dt, fx) {
    const arc = a.arcs[0];
    arc.intensity = a.s.on > 0 && a.mode !== 'destroy' ? 1 : 0;
    a.nodePoint('cloud', 1, -3, 0.5, arc.a);
    arc.b.set(arc.a.x + Math.sin(a.t * 7) * 0.5, arc.a.y - 1.4, arc.a.z + Math.cos(a.t * 5) * 0.5);
    v1.set(a.pos.x + (Math.random() - 0.5) * 0.8, a.pos.y - 0.2, a.pos.z + (Math.random() - 0.5) * 0.6);
    stream(a, fx, 'r', CLOUD_RAIN, 14, dt, v1, false);
    if (a.s.on > 0) fx.light(a.pos.x, a.pos.y - 0.4, a.pos.z, 0xb3f0ff, 1.4, 4);
  },
};

// ============================================================ Starfall Tome
const TOME_GLINT = L('spark', 1, 0xfff0a0, 0.8, 0.05, 0.4, PI, 0.6, 0xffd060);
const TOME_GATHER = L('gather', 1, 0xffe890, 1.4, 0.07, 0.35, PI, 0, 0xb070ff);
const TOME_CAST = [L('spark', 20, 0xfff0a0, 6, 0.07, 0.5, PI, 6, 0xffb35c), L('glow', 8, 0xffd860, 2.5, 0.26, 0.4, PI, 3)];
const TOME_PAGES = L('debris', 1, 0xf0e6c8, 3, 0.1, 1, PI, 2.5, 0xfaf2dc);

const tome: WeaponScript = {
  trailNode: 'book',
  init(a) {
    a.facing = 'fixed';
    a.addCircle(0xffd860, 2.6);
  },
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    const cycle = a.mode === 'attack' || a.mode === 'open';
    let target = 0;
    let flips = 0;
    let flipSpeed = 0;
    let core = 0;
    let circle = 0;
    if (cycle) {
      const len = a.def.attackTime;
      const p = prog(a, len);
      const s = p * len;
      target = s < 1.75 ? 1 : 0;
      flips = s > 0.3 && s < 1.15 ? 1 : 0;
      flipSpeed = 3.5;
      core = smooth((s - 0.3) / 0.8) * (1 - smooth((s - 1.5) / 0.4));
      circle = a.mode === 'attack' ? core : core * 0.5;
      if (a.mode === 'attack') core += bump(s, 1.1, 1.5) * 1.5;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      target = 0.5;
      flips = 1;
      flipSpeed = 6;
      m.body.scale.setScalar(1 - smooth((p - 0.3) / 0.7));
    } else if (a.mode === 'hit') {
      prog(a, a.def.hitTime);
      core = 1 - a.modeT / a.def.hitTime;
    } else {
      // every few seconds the book peeks open and turns a page
      const ph = (t % 5) / 5;
      target = bump(ph, 0.55, 0.85) > 0 ? 0.42 : 0;
      flips = ph > 0.62 && ph < 0.78 ? 1 : 0;
      flipSpeed = 1.2;
    }
    const cur = a.s.o ?? 0;
    const o = cur + (target - cur) * Math.min(1, dt * (target > cur ? 7 : 5));
    a.s.o = o;
    m.pose('book', 0.35 - o * 0.15, 0, Math.sin(t * 1.1) * 0.06);
    m.pose('L', 0, 0, o * (PI - 0.22));
    m.pose('R', 0, 0, 0.22 * o);
    for (let i = 0; i < 3; i++) {
      const key = 'f' + i;
      // page i turns from the right half to the left half; when not flipping it eases back
      let f = a.s[key] ?? 0;
      if (flips) f = (f + dt * flipSpeed * (0.8 + i * 0.25)) % 1;
      else f = f > 0.5 ? Math.min(1, f + dt * 3) : Math.max(0, f - dt * 3);
      if (!flips && f >= 1) f = 0;
      a.s[key] = f;
      const lo = 0.22 * o;
      const hi = PI - 0.22 * o;
      const ang = o < 0.05 ? 0 : lo + smooth(f) * (hi - lo) * Math.min(1, o * 1.5);
      m.pose('pg' + i, 0, 0, ang);
      m.nodes['pg' + i].visible = o > 0.05 || f === 0;
    }
    m.pose('ribbon', Math.sin(t * 2.3) * 0.3, 0, Math.sin(t * 1.7) * 0.25 + o * 0.6);
    for (let i = 0; i < 7; i++) {
      const ang = t * (1.2 + (i % 3) * 0.3) + (i * TAU) / 7;
      const r = 10 + (i % 2) * 2.5 + core * 3;
      m.offset('st' + i, Math.cos(ang) * r, 6 + Math.sin(t * 2 + i) * 1.6 + core * 3, Math.sin(ang) * r);
      m.pose('st' + i, t * 3, t * 2, 0);
      m.nodes['st' + i].scale.setScalar(0.8 + 0.3 * Math.sin(t * 6 + i * 2) + core * 0.4);
    }
    m.halos.core?.set(0.8 + core * 1.4, Math.min(1, core * 0.9 + o * 0.25));
    m.halos.emblem?.set(1 + 0.15 * pulse, 0.25 + 0.2 * pulse + o * 0.3);
    m.glow.value += core * 1.5 + o * 0.4;
    a.s.core = core;
    if (a.circle) {
      a.circle.mat.opacity = Math.min(1, circle) * 0.9;
      a.circle.mesh.position.set(a.pos.x, a.pos.y - 0.45, a.pos.z);
      a.circle.mesh.rotation.z = t * 1.5;
      a.circle.mesh.scale.setScalar(0.6 + circle * 0.5);
    }
  },
  fx(a, dt, fx, pulse) {
    const q = qm(a, fx);
    const c = a.s.core ?? 0;
    const p = a.nodePoint('book', 0, 5, 0, v1);
    if (a.mode !== 'destroy') stream(a, fx, 'g', TOME_GLINT, a.def.particles * (0.5 + c), dt, p, false);
    if (c > 0.05) {
      stream(a, fx, 'a', TOME_GATHER, 40 * c, dt, p, false);
      fx.light(p.x, p.y, p.z, a.def.color, 1 + c * 2.5, 4);
    } else fx.light(p.x, p.y, p.z, 0xffd870, 0.4 + 0.2 * pulse, 2.4);
    if (a.mode === 'attack' && at(a, dt, 1.15)) for (const l of TOME_CAST) emitAt(fx, p, l, q * (a.tier >= 4 ? 1.4 : 1));
    if (a.mode === 'destroy') stream(a, fx, 'p', TOME_PAGES, 22 * (1 - a.modeT / a.def.destroyTime), dt, p, false);
  },
};

// ============================================================ Falling star (Starfall Tome meteor)
const STAR_TRAIL = L('spark', 1, 0xfff0a0, 1.5, 0.07, 0.35, 0.5, 0.2, 0xffb35c);
const STAR_DUST = L('glow', 1, 0xffd860, 0.6, 0.12, 0.4, 0.6, 0, 0xffffff);
const ROCK_TRAIL = L('ember', 1, 0xffb040, 1.5, 0.12, 0.5, 0.5, 0.6, 0xff3a00);
const ROCK_SMOKE = L('smoke', 1, 0x3a2e2a, 0.4, 0.45, 0.8, 0.6, 0.5);
const STAR_HIT = [
  L('glow', 10, 0xfff0a0, 5, 0.3, 0.35, PI, 1.5, 0xffb35c),
  L('spark', 24, 0xffffff, 10, 0.07, 0.35, PI, 3, 0xffd860),
  L('smoke', 4, 0xb8a888, 1.2, 0.6, 0.8, PI, 0.6),
];
const ROCK_HIT = [L('debris', 10, 0x4a2a1a, 5, 0.12, 0.8, PI), L('ember', 16, 0xffb040, 5, 0.12, 1, PI, 3, 0xff3a00), L('smoke', 6, 0x3a302c, 1.2, 0.8, 1.2, PI, 0.6)];

const star: WeaponScript = {
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    m.pose('rock', t * 4, t * 2.4, 0);
    const tw = 0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7);
    m.halos.glow?.set(1 + 0.3 * tw, 0.7 + 0.3 * tw);
    m.halos.fire?.set(1 + 0.2 * pulse);
    m.glow.value += tw * 0.6;
    if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      m.body.scale.setScalar(Math.max(0, 1 + p * 2 - p * p * 8));
      m.body.visible = p < 0.35;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth(p));
    }
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    const evo = a.tier >= 4;
    if (flying(a) || a.mode === 'attack') {
      stream(a, fx, 't', evo ? ROCK_TRAIL : STAR_TRAIL, a.def.particles, dt, a.pos);
      stream(a, fx, 'd', evo ? ROCK_SMOKE : STAR_DUST, a.def.particles * 0.35, dt, a.pos);
      fx.light(a.pos.x, a.pos.y, a.pos.z, evo ? 0xff7a2a : 0xffd860, 1.4, 3.5);
    }
    if (a.mode === 'hit') {
      if (at(a, dt, 0)) {
        v1.set(a.pos.x, Math.max(0.1, a.pos.y), a.pos.z);
        for (const l of STAR_HIT) emitAt(fx, v1, l, q);
        if (evo) for (const l of ROCK_HIT) emitAt(fx, v1, l, q);
      }
      if (a.modeT < 0.3) fx.light(a.pos.x, a.pos.y + 0.4, a.pos.z, evo ? 0xff7a2a : 0xfff0a0, 4 * (1 - a.modeT / 0.3), 5);
    }
  },
};

// ============================================================ Chain Spark
const SPARK_TRAIL = L('spark', 1, 0xffffff, 2.2, 0.05, 0.22, PI, 0.3, 0x7ad8ff);
const SPARK_GLOW = L('glow', 1, 0x7ad8ff, 0.5, 0.1, 0.25, PI, 0, 0xd8f4ff);
const SPARK_HIT = [L('glow', 6, 0xe8f8ff, 4, 0.26, 0.22, PI, 1, 0x7ad8ff), L('spark', 16, 0xffffff, 9, 0.06, 0.25, PI, 2, 0x7ad8ff)];
const SPARK_POP = [L('spark', 20, 0xffffff, 6, 0.05, 0.35, PI, 1, 0x7ad8ff), L('glow', 6, 0x7ad8ff, 2, 0.2, 0.4, PI)];

const spark: WeaponScript = {
  init(a) {
    haloToRoot(a, 'flash');
    for (let i = 0; i < 3; i++) a.addArc(0xd8f4ff, 0.03, 0.15, 4);
    // the bright chain link back to the previous hop
    a.addArc(0xbfeaff, 0.09, 0.35, 12).intensity = 0;
  },
  start(a, mode) {
    resetBody(a);
    if (mode === 'hit') a.s.link = 1;
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    for (let i = 0; i < 4; i++) m.pose('ring' + i, 0, t * (6 + i * 2.5) * (i % 2 ? -1 : 1), 0);
    m.nodes.core.scale.setScalar(0.85 + Math.random() * 0.3);
    m.nodes.shell.scale.setScalar(1 + 0.08 * Math.sin(t * 11) + (Math.random() - 0.5) * 0.06);
    m.halos.glow?.set(0.9 + 0.3 * pulse + Math.random() * 0.15, 0.75 + 0.25 * pulse);
    let flash = 0;
    if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      flash = 1 - p;
      m.body.scale.setScalar(1 + bump(p, 0, 0.4) * 0.5);
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      flash = bump(p, 0, 0.5) * 0.6;
      m.body.scale.setScalar(1 + p * 0.8);
      m.body.visible = p < 0.45;
    } else m.body.scale.setScalar(1 + (a.s.flash ?? 0) * 0.4);
    // hop arrivals while chaining (the game sets a.s.hop)
    a.s.flash = Math.max(0, (a.s.flash ?? 0) - dt * 5);
    flash = Math.max(flash, a.s.flash);
    m.halos.flash?.set(0.5 + flash, flash * 0.9);
    m.glow.value += flash * 2;
  },
  fx(a, dt, fx, pulse) {
    const q = qm(a, fx);
    if (a.s.hop) {
      a.s.hop = 0;
      a.s.flash = 1;
      a.s.link = 1;
      for (const l of SPARK_HIT) emitAt(fx, a.pos, l, q * 0.7);
      fx.light(a.pos.x, a.pos.y, a.pos.z, 0xe8f8ff, 3, 4);
    }
    const live = a.mode !== 'destroy' || a.modeT < 0.25;
    for (let i = 0; i < 3; i++) {
      const arc = a.arcs[i];
      a.s['k' + i] = (a.s['k' + i] ?? 0) - dt;
      if (a.s['k' + i] <= 0) {
        a.s['k' + i] = 0.04 + Math.random() * 0.08;
        const th = Math.random() * TAU;
        const ph = Math.acos(Math.random() * 2 - 1);
        const r = 4.8 + (a.mode === 'hit' ? 6 : 0);
        a.s['x' + i] = Math.sin(ph) * Math.cos(th) * r;
        a.s['y' + i] = Math.cos(ph) * r;
        a.s['z' + i] = Math.sin(ph) * Math.sin(th) * r;
      }
      arc.intensity = live ? 0.9 : 0;
      a.nodePoint('core', 0, 0, 0, arc.a);
      a.nodePoint('core', a.s['x' + i], a.s['y' + i], a.s['z' + i], arc.b);
    }
    // chain link: bright right after a hop, then fades
    const link = a.arcs[3];
    a.s.link = Math.max(0, (a.s.link ?? 0) - dt * 2.2);
    link.intensity = a.s.link * 1.6;
    link.width = 0.035 + a.s.link * 0.035;
    link.a.copy(a.target);
    link.b.copy(a.pos);
    if (flying(a)) {
      stream(a, fx, 't', SPARK_TRAIL, a.def.particles, dt, a.pos);
      stream(a, fx, 'g', SPARK_GLOW, a.def.particles * 0.3, dt, a.pos);
      fx.light(a.pos.x, a.pos.y, a.pos.z, a.def.color, 1.1 + pulse * 0.6, 3.2);
    }
    if (a.mode === 'hit') {
      if (at(a, dt, 0)) for (const l of SPARK_HIT) emitAt(fx, a.pos, l, q);
      fx.light(a.pos.x, a.pos.y, a.pos.z, 0xe8f8ff, 3.5 * (1 - a.modeT / a.def.hitTime), 4.5);
    }
    if (a.mode === 'destroy' && at(a, dt, 0)) for (const l of SPARK_POP) emitAt(fx, a.pos, l, q);
  },
};

// ============================================================ Bone Familiar
const FAM_WISP = L('wisp', 1, 0xb070ff, 0.6, 0.07, 0.6, 0.5, 0.3, 0x5a2a9a);
const FAM_SMOKE = L('smoke', 1, 0x2a1a3a, 0.3, 0.3, 0.6, 0.5, 0.2);
const FAM_BITE = [L('spark', 12, 0xd8b0ff, 6, 0.06, 0.25, 0.9, 1.5, 0xffffff), L('glow', 5, 0xb070ff, 2.5, 0.22, 0.3, PI), L('wisp', 6, 0x9dff6a, 1.5, 0.07, 0.6, PI, 1)];
const FAM_BONES = [L('debris', 14, 0xe8e2cc, 4.5, 0.11, 0.9, PI, 1, 0xc8bfa2), L('smoke', 5, 0x3a2a4a, 1, 0.55, 0.9, PI, 0.5), L('wisp', 10, 0xb070ff, 2, 0.07, 0.8, PI, 1)];

const familiar: WeaponScript = {
  trailNode: 'v3',
  start(a) {
    resetBody(a);
  },
  pose(a, dt, pulse) {
    const m = a.model;
    const t = a.t;
    // how hard it is turning: the spine lags behind
    const yaw = Math.atan2(a.dir.x, a.dir.z);
    let dy = yaw - (a.s.yaw ?? yaw);
    if (dy > PI) dy -= TAU;
    if (dy < -PI) dy += TAU;
    a.s.yaw = yaw;
    a.s.turn = (a.s.turn ?? 0) * Math.exp(-dt * 6) + (dt > 0 ? dy / dt : 0) * 0.02;
    const turn = Math.max(-0.6, Math.min(0.6, a.s.turn));
    let jaw = Math.max(0, Math.sin(t * 9)) * 0.18;
    let lunge = 0;
    let roll = -turn * 0.6;
    let eye = 1;
    if (a.mode === 'attack') {
      const p = prog(a, a.def.attackTime);
      const s = p * a.def.attackTime;
      jaw = s < 0.45 ? smooth(s / 0.4) * 0.75 : s < 0.55 ? 0.75 * (1 - (s - 0.45) / 0.1) : 0.05;
      lunge = bump(s, 0.35, 0.7) * 2.5;
      eye = 1 + smooth(s / 0.45) * 0.8;
    } else if (a.mode === 'hit') {
      const p = prog(a, a.def.hitTime);
      jaw = p < 0.15 ? 0 : bump(p, 0.15, 0.6) * 0.3;
      eye = 1.6 - p * 0.6;
    } else if (a.mode === 'return') {
      const p = prog(a, 0.9);
      roll += smooth(p) * TAU;
      jaw = 0.1;
    } else if (a.mode === 'destroy') {
      const p = prog(a, a.def.destroyTime);
      m.body.scale.setScalar(1 - smooth((p - 0.15) / 0.5));
      eye = Math.max(0, 1 - p * 2);
      jaw = 0.6 * (1 - p);
    }
    m.body.rotation.z += roll;
    m.pose('skull', -Math.min(0.4, a.speed * 0.03), 0, 0);
    m.offset('skull', 0, 0, lunge);
    m.pose('jaw', jaw, 0, 0);
    for (let i = 0; i < 4; i++) m.pose('v' + i, Math.sin(t * 4 - i * 0.8) * 0.22, Math.sin(t * 3 - i * 0.7) * 0.25 - turn * (0.4 + i * 0.15), 0);
    const flap = Math.sin(t * (a.mode === 'attack' ? 14 : 8));
    m.pose('wingL', 0, flap * 0.15, flap * 0.55);
    m.pose('wingR', 0, -flap * 0.15, -flap * 0.55);
    m.pose('horns', 0, 0, 0);
    m.pose('crown', 0, t * 0.6, 0);
    const fl = 0.85 + Math.random() * 0.3;
    m.halos.eyeL?.set(fl * eye, Math.min(1, 0.8 * eye));
    m.halos.eyeR?.set((1.9 - fl) * eye, Math.min(1, 0.8 * eye));
    m.halos.aura?.set(1 + 0.2 * pulse, 0.3 + 0.15 * pulse);
  },
  fx(a, dt, fx) {
    const q = qm(a, fx);
    if (a.mode !== 'destroy') {
      const p = a.trailHead();
      stream(a, fx, 'w', a.def.model === 'familiar_lord' ? { ...FAM_WISP, color: 0x9a8aff } : FAM_WISP, a.def.particles, dt, p);
      stream(a, fx, 's', FAM_SMOKE, a.def.particles * 0.3, dt, p);
    }
    if (a.mode === 'hit' && at(a, dt, 0)) {
      a.nodePoint('jaw', 0, 0, 5, v3);
      for (const l of FAM_BITE) emitAt(fx, v3, l, q, a.dir.x, a.dir.z);
      fx.light(v3.x, v3.y, v3.z, 0xb070ff, 2.4, 3.5);
    }
    if (a.mode === 'attack' && at(a, dt, a.def.attackTime * 0.4)) {
      a.nodePoint('jaw', 0, 0, 5, v3);
      for (const l of FAM_BITE) emitAt(fx, v3, l, q * 0.6, a.dir.x, a.dir.z);
    }
    if (a.mode === 'destroy' && at(a, dt, 0.15)) for (const l of FAM_BONES) emitAt(fx, a.pos, l, q);
  },
};

export const SCRIPTS: Record<string, WeaponScript> = { ember, flask, puddle, cyclone, fan, rod, stormcloud, tome, star, spark, familiar };
