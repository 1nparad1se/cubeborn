import type * as THREE from 'three';
import { ArticulatedModel } from './ArticulatedModel';

/** What the boss is doing, as read from BossController.animState plus the renderer's own timers. */
export interface BossPoseInput {
  dt: number;
  time: number;
  walk: number;
  moving: number;
  flash: number;
  /** Skill family or state: slam, sweep, charge, leap, roar, cast, channel, breath, enrage, blink, stun, intro, check, idle. */
  kind: string;
  /** -1 idle, 0 wind-up, 1 act, 2 recover. */
  stage: number;
  /** Progress 0..1 in the stage. */
  k: number;
  /** Enrage glow 0..1. */
  enrage: number;
  /** Death 0..1 (topple). */
  death: number;
  /** Floating body (flying bosses): legs dangle, the body bobs. */
  float: boolean;
}

interface JointPose {
  x: number;
  y: number;
  z: number;
}

const TAGS = ['legL', 'legR', 'armL', 'armR', 'head', 'wingL', 'wingR', 'tail', 'jaw', 'lid'] as const;
type Tag = (typeof TAGS)[number];

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

/**
 * Big articulated boss: idle / walk plus a pose per skill family with wind-up, strike and
 * recovery, a stun slump, an enrage flex, an intro roar and a death topple. Targets are eased so
 * the heavy body never snaps, except for the strike frames which hit fast.
 */
export class BossModel extends ArticulatedModel {
  private cur: Record<Tag, JointPose> = Object.fromEntries(TAGS.map((t) => [t, { x: 0, y: 0, z: 0 }])) as Record<Tag, JointPose>;
  private body0 = { rx: 0, ry: 0, rz: 0, py: 0, sy: 1, sx: 1 };

  bossPose(p: BossPoseInput) {
    const H = this.top;
    const tgt: Record<Tag, JointPose> = Object.fromEntries(TAGS.map((t) => [t, { x: 0, y: 0, z: 0 }])) as Record<Tag, JointPose>;
    const body = { rx: 0, ry: 0, rz: 0, py: 0, sy: 1, sx: 1 };
    const t = p.time;
    // ---------------------------------------------------------------- base: idle / walk
    const amp = 0.5 - this.heavy * 0.12;
    const sw = Math.sin(p.walk) * amp * p.moving;
    if (p.float) {
      tgt.legL.x = 0.25 + Math.sin(t * 1.7) * 0.12;
      tgt.legR.x = 0.25 + Math.sin(t * 1.7 + 1) * 0.12;
      body.py = Math.sin(t * 1.6) * H * 0.025 + H * 0.04;
    } else {
      tgt.legL.x = sw;
      tgt.legR.x = -sw;
      body.py = Math.abs(Math.sin(p.walk)) * H * 0.018 * p.moving;
      body.rz = Math.sin(p.walk) * 0.04 * p.moving;
    }
    tgt.armL.x = -sw * 0.7 + Math.sin(t * 1.3) * 0.05;
    tgt.armR.x = sw * 0.7 + Math.sin(t * 1.3 + 1) * 0.05;
    tgt.armL.z = 0.06;
    tgt.armR.z = -0.06;
    const flap = Math.sin(t * (p.float ? 3.2 : 2)) * (p.float ? 0.45 : 0.15);
    tgt.wingL.z = flap + 0.15;
    tgt.wingR.z = -flap - 0.15;
    tgt.head.x = Math.sin(t * 1.1) * 0.05;
    tgt.head.y = Math.sin(t * 0.6) * 0.12 * (1 - p.moving);
    tgt.tail.y = Math.sin(t * 2.2) * 0.35;
    tgt.jaw.x = Math.max(0, Math.sin(t * 1.5)) * 0.12;
    body.sy = 1 + Math.sin(t * 1.9) * 0.015 * (1 - p.moving);
    body.rx = 0.04 * p.moving;

    // ---------------------------------------------------------------- skills
    const st = p.stage;
    const k = p.k;
    const W = st === 0 ? easeOut(k) : 0;
    const S = st === 1 ? 1 : st === 2 ? 1 - easeIn(k) : 0;
    let fast = st === 1;
    const arms = (x: number, z: number, w = 1) => {
      tgt.armL.x = tgt.armL.x * (1 - w) + x * w;
      tgt.armR.x = tgt.armR.x * (1 - w) + x * w;
      // armL sits at +x: a positive z swings it outward (armR mirrored)
      tgt.armL.z = tgt.armL.z * (1 - w) + z * w;
      tgt.armR.z = tgt.armR.z * (1 - w) - z * w;
    };
    const jitter = (a: number) => (Math.sin(t * 43) * 0.6 + Math.sin(t * 71) * 0.4) * a;
    switch (p.kind) {
      case 'slam':
        if (st === 0) {
          arms(-2.75 * W, 0.25 * W, W);
          body.rx += -0.24 * W;
          body.py += H * 0.03 * W;
          tgt.head.x += -0.3 * W;
          tgt.jaw.x += 0.4 * W;
          tgt.wingL.z += 0.5 * W;
          tgt.wingR.z -= 0.5 * W;
        } else if (S > 0) {
          arms(-0.75, 0.15, S);
          body.rx += 0.36 * S;
          body.py -= H * 0.05 * S;
          body.sy -= 0.06 * S;
          tgt.head.x += 0.25 * S;
          tgt.jaw.x += 0.6 * S;
          tgt.legL.x += -0.25 * S;
          tgt.legR.x += 0.25 * S;
        }
        break;
      case 'sweep':
        if (st === 0) {
          body.ry += 0.85 * W;
          tgt.armR.x = -1.1 * W;
          tgt.armR.z = -1.3 * W;
          tgt.armL.x = -0.5 * W;
          tgt.tail.y += 0.8 * W;
          body.rx -= 0.08 * W;
        } else if (S > 0) {
          body.ry += -0.95 * S;
          tgt.armR.x = -1.5 * S;
          tgt.armR.z = 0.5 * S;
          tgt.armL.x = -1.2 * S;
          tgt.armL.z = 0.9 * S;
          tgt.tail.y += -1.2 * S;
          body.rx += 0.12 * S;
        }
        break;
      case 'charge':
        if (st === 0) {
          body.rx += 0.32 * W;
          body.py -= H * 0.03 * W;
          tgt.head.x += 0.35 * W;
          arms(0.7 * W, 0.2 * W, W);
          // pawing the ground
          tgt.legL.x += Math.sin(t * 14) * 0.45 * W;
          tgt.jaw.x += 0.3 * W;
        } else if (st === 1) {
          const r = Math.sin(t * 16);
          body.rx += 0.42;
          tgt.legL.x = p.float ? 0.6 : r * 0.9;
          tgt.legR.x = p.float ? 0.6 : -r * 0.9;
          arms(0.9, 0.3, 1);
          tgt.head.x += 0.3;
          tgt.jaw.x += 0.5;
          body.py += Math.abs(r) * H * 0.03;
        } else if (S > 0) {
          body.rx += 0.2 * S;
        }
        break;
      case 'leap':
        if (st === 0) {
          body.py -= H * 0.07 * W;
          body.sy -= 0.12 * W;
          body.sx += 0.06 * W;
          body.rx += 0.2 * W;
          arms(0.9 * W, 0.3 * W, W);
          tgt.head.x += -0.2 * W;
        } else if (st === 1) {
          const up = Math.sin(k * Math.PI);
          body.sy += 0.08 * up;
          arms(-2.6, 0.35, 1);
          tgt.legL.x = 0.7;
          tgt.legR.x = -0.4;
          body.rx += -0.15 + k * 0.45;
          tgt.jaw.x += 0.6;
        } else if (S > 0) {
          arms(-0.6, 0.6, S);
          body.py -= H * 0.08 * S;
          body.sy -= 0.1 * S;
          body.rx += 0.3 * S;
          tgt.head.x += 0.2 * S;
        }
        break;
      case 'roar':
      case 'enrage':
        if (st === 0) {
          tgt.head.x += -0.6 * W;
          tgt.jaw.x += 0.9 * W;
          arms(-0.7 * W, 1.05 * W, W);
          body.rx += -0.25 * W;
          body.sy += 0.04 * W;
          tgt.wingL.z += 0.9 * W;
          tgt.wingR.z -= 0.9 * W;
          if (p.kind === 'enrage') {
            body.rz += jitter(0.035 * W);
            body.sx += 0.05 * W;
          }
        } else if (S > 0) {
          fast = true;
          tgt.head.x += -0.25 * S + jitter(0.06 * S);
          tgt.jaw.x += 1.1 * S;
          arms(-1.1 * S, 1.3 * S, S);
          body.rx += -0.12 * S;
          body.rz += jitter(0.04 * S);
          body.sy += 0.06 * S;
          tgt.wingL.z += 1.1 * S;
          tgt.wingR.z -= 1.1 * S;
        }
        break;
      case 'cast':
        if (st === 0) {
          arms(-1.9 * W, 0.35 * W, W);
          body.rx += -0.12 * W;
          tgt.head.x += -0.15 * W;
          tgt.wingL.z += 0.6 * W;
          tgt.wingR.z -= 0.6 * W;
        } else if (S > 0) {
          arms(-1.35, 0.1 + Math.sin(t * 22) * 0.05, S);
          body.rx += 0.14 * S;
          tgt.jaw.x += 0.6 * S;
          tgt.head.x += 0.1 * S;
        }
        break;
      case 'channel':
      case 'check': {
        const a = st === 0 ? W : p.kind === 'check' ? 1 : S;
        arms(-2.6 * a, 0.7 * a + Math.sin(t * 9) * 0.08 * a, a);
        tgt.head.x += -0.35 * a;
        tgt.jaw.x += 0.7 * a;
        body.py += (H * 0.04 + Math.sin(t * 5) * H * 0.012) * a;
        body.rz += jitter(0.025 * a);
        tgt.wingL.z += 1.0 * a;
        tgt.wingR.z -= 1.0 * a;
        break;
      }
      case 'breath': {
        const a = st === 0 ? W : S > 0 ? Math.max(S, st === 1 ? 1 : 0) : 0;
        tgt.head.x += 0.38 * a;
        tgt.jaw.x += 1.1 * a;
        body.rx += 0.22 * a;
        arms(-0.5 * a, 0.5 * a, a);
        body.rz += jitter(0.012 * a);
        break;
      }
      case 'blink': {
        const a = st === 0 ? W : 1;
        arms(-0.3 * a, -0.5 * a, a);
        body.sy -= 0.15 * a;
        body.sx -= 0.1 * a;
        body.rx += 0.3 * a;
        break;
      }
      case 'stun':
        body.rx += 0.3;
        body.rz += Math.sin(t * 2.1) * 0.12;
        body.py -= H * 0.04;
        tgt.head.x += 0.45;
        tgt.head.z = Math.sin(t * 2.6) * 0.3;
        arms(0.25, -0.1 + Math.sin(t * 1.7) * 0.1, 0.9);
        tgt.jaw.x += 0.45;
        tgt.legL.x = p.float ? 0.4 : 0.15;
        tgt.legR.x = p.float ? 0.4 : -0.1;
        tgt.wingL.z = -0.3;
        tgt.wingR.z = 0.3;
        break;
      case 'intro': {
        // curled up while rising, then a roar
        if (k < 0.35) {
          const a = 1 - k / 0.35;
          body.rx += 0.45 * a;
          body.sy -= 0.08 * a;
          arms(0.5 * a, -0.2 * a, a);
          tgt.head.x += 0.5 * a;
        } else if (k < 0.8) {
          const a = Math.min(1, (k - 0.35) / 0.12);
          tgt.head.x += -0.6 * a + jitter(0.05 * a);
          tgt.jaw.x += 1.1 * a;
          arms(-1.0 * a, 1.2 * a, a);
          body.rx += -0.22 * a;
          body.rz += jitter(0.03 * a);
          tgt.wingL.z += 1.0 * a;
          tgt.wingR.z -= 1.0 * a;
          fast = true;
        }
        break;
      }
    }
    // ---------------------------------------------------------------- death: topple aside
    if (p.death > 0) {
      const d = easeIn(Math.min(1, p.death * 1.4));
      body.rz += 1.45 * d;
      body.rx += 0.2 * d;
      body.py -= H * 0.12 * d;
      arms(0.3, 0.9, d);
      tgt.head.x += 0.5 * d;
      tgt.jaw.x += 0.8 * d;
      tgt.legL.x = 0.4 * d;
      tgt.legR.x = -0.2 * d;
      fast = false;
    }
    // ---------------------------------------------------------------- ease toward the targets
    const rate = fast ? 26 : 9;
    const f = 1 - Math.exp(-rate * Math.min(0.1, p.dt));
    for (const tag of TAGS) {
      const c = this.cur[tag];
      const g = tgt[tag];
      c.x += (g.x - c.x) * f;
      c.y += (g.y - c.y) * f;
      c.z += (g.z - c.z) * f;
      const l = this.joints[tag];
      if (!l) continue;
      for (const o of l) this.apply(o, tag, c);
    }
    const b0 = this.body0;
    for (const key of ['rx', 'ry', 'rz', 'py', 'sy', 'sx'] as const) b0[key] += (body[key] - b0[key]) * f;
    this.body.rotation.set(b0.rx, b0.ry, b0.rz);
    this.body.position.y = b0.py;
    this.body.scale.set(b0.sx, b0.sy, b0.sx);
    this.flash.value = p.flash + p.enrage * (0.08 + Math.sin(t * 6) * 0.06);
  }

  private apply(o: THREE.Object3D, tag: Tag, c: JointPose) {
    switch (tag) {
      case 'wingL':
      case 'wingR':
        o.rotation.set(c.x * 0.3, 0, c.z);
        break;
      case 'tail':
        o.rotation.set(c.x, c.y, 0);
        break;
      default:
        o.rotation.set(c.x, c.y, c.z);
    }
  }
}
