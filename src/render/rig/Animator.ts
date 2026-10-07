import * as THREE from 'three';
import { BONES, type BoneId, type HeroRig, type SpringDef } from './HeroRig';
import type { AnimStyle, Gait, PoseMap } from './animTypes';
import { clipsFor, ease, type Clip } from './clips';

const D2R = Math.PI / 180;
type ActionName = 'attack' | 'death' | 'levelup' | 'ability' | 'victory';
export type AnimName = 'idle' | 'walk' | 'run' | ActionName | 'hit';

const LEG_BONES = new Set<string>(['legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'root', 'rootPos']);
const DEFAULT_SPRINGS: Partial<Record<BoneId, SpringDef['kind']>> = { capeA: 'cape', capeB: 'cape', skirtF: 'flap', skirtB: 'flap', accA: 'bob', accB: 'bob', accC: 'bob' };

interface Playing {
  clip: Clip;
  t: number;
  /** Fades out once the clip is over (or when replaced). */
  out: number;
  firedEvents: number;
  firedShow: number;
  lastLocal: number;
}

interface Spring {
  bone: BoneId;
  def: SpringDef;
  ax: number;
  az: number;
  vx: number;
  vz: number;
  spin: number;
}

function smooth(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * Layered procedural + keyframed animation for hero rigs:
 *  1. stance (how the hero stands and holds the weapon),
 *  2. locomotion: idle breathing/look-around blended into a walk and a run cycle shaped by the
 *     hero's gait (heavy stomp, light jog, floaty glide...),
 *  3. one action clip at a time (attack, level up, ability, victory, death) with anticipation,
 *     strike, follow-through and recovery keys; upper-body clips leave the legs running,
 *  4. an additive hit reaction spring (direction aware, never blocks control),
 *  5. secondary motion: capes, robe panels, hair, plumes and packs on damped springs.
 */
export class HeroAnimator {
  readonly style: AnimStyle;
  private clips: Record<ActionName, Clip>;
  private pose = new Map<string, [number, number, number]>();
  private stance: PoseMap;
  private action: Playing | null = null;
  private fading: Playing | null = null;
  private phase = 0;
  private time = 0;
  private walkW = 0;
  private runW = 0;
  private springs: Spring[] = [];
  private hitAmt = 0;
  private hitVel = 0;
  private hitDir = new THREE.Vector2(0, 1);
  private prevFwd = 0;
  private accelF = 0;
  private prevBob = 0;
  private bobVel = 0;
  /** Speed in world units/s (set by the host each frame). */
  speed = 0;
  /** Velocity in the model's local frame: forward / lateral (units/s). */
  fwd = 0;
  side = 0;
  /** Yaw rate (rad/s) for cape and hair sway. */
  turn = 0;
  /** Viewer override: pretend to walk or run in place. */
  forceGait: 'walk' | 'run' | null = null;
  /** Fired at named moments of clips: 'impulse', 'charge', 'death', 'levelup', 'ability'. */
  onEvent: ((ev: string) => void) | null = null;
  readonly dead = { value: false };

  constructor(readonly rig: HeroRig) {
    this.style = rig.def.anim;
    this.stance = this.style.stance;
    this.clips = clipsFor(this.style, rig.def.id);
    for (const id of BONES) this.pose.set(id, [0, 0, 0]);
    this.pose.set('rootPos', [0, 0, 0]);
    this.pose.set('hipsPos', [0, 0, 0]);
    for (const id of BONES) {
      const def = rig.def.springs?.[id];
      const kind = def?.kind ?? DEFAULT_SPRINGS[id];
      if (!kind) continue;
      this.springs.push({ bone: id, def: { parent: 'root', at: [0, 0, 0], ...def, kind }, ax: 0, az: 0, vx: 0, vz: 0, spin: 0 });
    }
  }

  get current(): string {
    return this.action?.clip.name ?? (this.walkW > 0.5 ? (this.runW > 0.5 ? 'run' : 'walk') : 'idle');
  }

  /** Starts an action clip. Attacks restart only once the previous one is mostly done. */
  play(name: ActionName | 'hit', opts: { force?: boolean } = {}) {
    if (name === 'hit') {
      this.hit(0, 1);
      return;
    }
    if (this.dead.value && name !== 'death') return;
    const clip = this.clips[name];
    const cur = this.action;
    if (cur && !opts.force) {
      if (cur.clip.name === 'death') return;
      if (name === 'attack' && cur.clip.name === 'attack' && cur.t < cur.clip.dur * 0.6) return;
      if (name === 'attack' && (cur.clip.name === 'levelup' || cur.clip.name === 'ability' || cur.clip.name === 'victory') && cur.t < cur.clip.dur * 0.8) return;
    }
    if (cur) {
      cur.out = Math.max(cur.out, 0.0001);
      this.fading = cur;
    }
    this.restoreGroups();
    this.action = { clip, t: 0, out: 0, firedEvents: 0, firedShow: 0, lastLocal: 0 };
    if (name === 'death') this.dead.value = true;
  }

  /** Back to plain locomotion (viewer reset, revive). */
  reset() {
    this.action = null;
    this.fading = null;
    this.dead.value = false;
    this.restoreGroups();
  }

  /** Hit reaction from a world-space direction (pointing from the attacker to the hero) in model space. */
  hit(dx: number, dz: number) {
    this.hitDir.set(dx, dz);
    if (this.hitDir.lengthSq() < 1e-6) this.hitDir.set(0, -1);
    this.hitDir.normalize();
    this.hitVel += 14;
  }

  private restoreGroups() {
    for (const g of this.rig.def.hidden ?? []) this.rig.show(g, false);
    for (const g of this.rig.groups.keys()) if (!(this.rig.def.hidden ?? []).includes(g)) this.rig.show(g, true);
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    const g = this.style.gait;
    let sp = this.speed;
    if (this.forceGait === 'walk') sp = 1.7;
    else if (this.forceGait === 'run') sp = 4.6;
    const fwd = this.forceGait ? sp : this.fwd;
    // locomotion weights (smoothed so starts and stops ease in)
    const wantWalk = smooth(0.15, 1.1, sp);
    const wantRun = smooth(2.0, 3.6, sp);
    const k = 1 - Math.exp(-10 * dt);
    this.walkW += (wantWalk - this.walkW) * k;
    this.runW += (wantRun - this.runW) * k;
    this.phase += dt * Math.max(sp, this.walkW * 1.2) * g.cadence * Math.PI * 2 * (1 - this.runW * 0.12);
    const accel = (fwd - this.prevFwd) / Math.max(dt, 1e-4);
    this.prevFwd = fwd;
    this.accelF += (accel - this.accelF) * (1 - Math.exp(-8 * dt));

    for (const v of this.pose.values()) v[0] = v[1] = v[2] = 0;
    const moveW = this.walkW;
    // 1. stance
    const sw = 1 - moveW * (1 - (this.style.stanceRun ?? 0.7));
    for (const key in this.stance) {
      const s = this.stance[key as BoneId]!;
      this.add(key, s[0] * sw, s[1] * sw, s[2] * sw);
    }
    // 2. idle + locomotion
    this.idleLayer(t, g, 1 - moveW);
    if (moveW > 0.001) this.locoLayer(g, moveW, this.runW);
    // 3. action clips
    if (this.fading) {
      this.fading.out += dt;
      const fo = this.fading.clip.fadeOut ?? 0.14;
      const w = 1 - this.fading.out / fo;
      if (w <= 0) this.fading = null;
      else this.applyClip(this.fading, w, moveW);
    }
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const c = a.clip;
      let local = a.t;
      if (c.loopFrom !== undefined && a.t > c.dur) local = c.loopFrom + ((a.t - c.loopFrom) % (c.dur - c.loopFrom));
      this.fireMoments(a, local);
      const fi = c.fadeIn ?? 0.08;
      let w = Math.min(1, a.t / fi);
      if (!c.hold && c.loopFrom === undefined && a.t > c.dur) {
        a.out += dt;
        w *= Math.max(0, 1 - a.out / (c.fadeOut ?? 0.14));
        if (w <= 0) {
          this.action = null;
          this.restoreGroups();
        }
      }
      if (this.action) this.applyClipAt(c, Math.min(local, c.dur), w, moveW);
    }
    // 4. hit reaction (critically damped spring with a little overshoot)
    this.hitVel += (-90 * this.hitAmt - 13 * this.hitVel) * dt;
    this.hitAmt += this.hitVel * dt;
    if (Math.abs(this.hitAmt) > 0.001) {
      const h = this.hitAmt;
      const f = -this.hitDir.y;
      const s = this.hitDir.x;
      this.add('chest', -16 * h * f, 0, 12 * h * s);
      this.add('spine', -8 * h * f, 0, 6 * h * s);
      this.add('head', -14 * h * f, 10 * h * s, 8 * h * s);
      this.add('armL', 10 * h, 0, 14 * h);
      this.add('armR', 10 * h, 0, -14 * h);
      this.add('foreL', -16 * h, 0, 0);
      this.add('foreR', -16 * h, 0, 0);
      this.add('rootPos', -0.6 * h * s, -0.3 * Math.abs(h), -0.8 * h * f);
    }
    // 5. secondary motion
    const bob = this.pose.get('hipsPos')![1] + this.pose.get('rootPos')![1];
    const bv = (bob - this.prevBob) / Math.max(dt, 1e-4);
    this.prevBob = bob;
    this.bobVel += (bv - this.bobVel) * (1 - Math.exp(-20 * dt));
    this.springLayer(dt, t, fwd);
    this.write();
  }

  private add(key: string, x: number, y: number, z: number) {
    const v = this.pose.get(key);
    if (!v) return;
    v[0] += x;
    v[1] += y;
    v[2] += z;
  }

  /** Breathing, weight shifts and looking around while standing. */
  private idleLayer(t: number, g: Gait, w: number) {
    const k = g.idle;
    const breath = Math.sin((t * Math.PI * 2) / 3.4);
    const breath2 = Math.sin((t * Math.PI * 2) / 3.4 - 0.6);
    this.add('chest', -2.2 * breath * k * w - 1.2 * breath * k * (1 - w), 0, 0);
    this.add('spine', -0.8 * breath * k, 0, 0);
    this.add('armL', 1.5 * breath2 * k, 0, (1.8 + 1.4 * breath2) * k * w);
    this.add('armR', 1.5 * breath2 * k, 0, -(1.8 + 1.4 * breath2) * k * w);
    this.add('foreL', -2 * breath2 * k * w, 0, 0);
    this.add('foreR', -2 * breath2 * k * w, 0, 0);
    this.add('head', 1.2 * breath2 * k, 0, 0);
    if (w <= 0.001) return;
    // weight shift from foot to foot
    const shift = Math.sin(t * 0.55) * k;
    this.add('hips', 0, shift * 2, shift * 2.2 * w);
    this.add('legL', 0, 0, -shift * 2.2 * w);
    this.add('legR', 0, 0, -shift * 2.2 * w);
    this.add('spine', 0, 0, -shift * 1.4 * w);
    this.add('hipsPos', shift * 0.2 * w, (-0.12 + 0.07 * breath) * w, 0);
    // slow glances around
    const look = Math.sin(t * 0.31) * Math.sin(t * 0.13 + 1.3);
    this.add('head', Math.sin(t * 0.23) * 3 * k * w, look * 22 * k * w, Math.sin(t * 0.41) * 3 * k * w);
    this.add('chest', 0, look * 5 * k * w, 0);
  }

  /** Walk and run cycles; run adds lean, higher knees, bent elbows and a flight bounce. */
  private locoLayer(g: Gait, w: number, runW: number) {
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const r = runW;
    const lerp = (a: number, b: number) => a + (b - a) * r;
    const stride = lerp(g.stride * 0.62, g.stride) * w;
    const knee = lerp(g.knee * 0.55, g.knee) * w;
    const armSwing = lerp(g.armSwing * 0.55, g.armSwing) * w;
    const elbow = lerp(g.elbow * 0.4, g.elbow + 25) * w;
    const bounce = lerp(g.bounce * 0.45, g.bounce) * w;
    const lean = lerp(g.lean * 0.25, g.lean) * w;
    // legs: swing thighs, bend the knee through the swing, keep the foot flat at contact
    const thL = -s * stride;
    const thR = s * stride;
    const swingL = Math.max(0, c);
    const swingR = Math.max(0, -c);
    const knL = knee * (Math.pow(swingL, 0.8) + 0.12 * r);
    const knR = knee * (Math.pow(swingR, 0.8) + 0.12 * r);
    this.add('legL', thL, 0, 0);
    this.add('legR', thR, 0, 0);
    this.add('shinL', knL, 0, 0);
    this.add('shinR', knR, 0, 0);
    this.add('footL', -(thL + knL) * 0.75 + 14 * Math.max(0, s) * w, 0, 0);
    this.add('footR', -(thR + knR) * 0.75 + 14 * Math.max(0, -s) * w, 0, 0);
    // body bob: walking peaks as the legs pass, running peaks in the flight phase
    const walkBob = Math.pow(Math.abs(c), 1 - g.heavy * 0.5) - 0.55;
    const runBob = Math.abs(s) - 0.55;
    const heavyDip = g.heavy * Math.exp(-Math.pow((Math.abs(s) - 1) * 6, 2)) * 0.6;
    this.add('hipsPos', 0, (lerp(walkBob, runBob) - heavyDip) * bounce, 0);
    this.add('hips', 0, g.twist * s * w, g.sway * s * w);
    this.add('spine', lean * 0.4, -g.twist * 0.5 * s * w, -g.sway * 0.5 * s * w);
    this.add('chest', lean * 0.6 - g.heavy * 2 * Math.abs(s) * w, -g.twist * 1.3 * s * w, 0);
    this.add('head', -lean * 0.8 + g.headBob * Math.sin(this.phase * 2) * w, g.twist * 0.6 * s * w, 0);
    // arms counter-swing; elbows bend more as the arm comes forward and when running
    this.add('armL', s * armSwing, 0, g.armOut * w);
    this.add('armR', -s * armSwing, 0, -g.armOut * w);
    this.add('foreL', -elbow * (0.55 + 0.45 * Math.max(0, -s)), 0, 0);
    this.add('foreR', -elbow * (0.55 + 0.45 * Math.max(0, s)), 0, 0);
  }

  private fireMoments(a: Playing, local: number) {
    const c = a.clip;
    const evs = c.events ?? [];
    const shows = c.show ?? [];
    // loops re-arm their events each cycle
    if (c.loopFrom !== undefined && local < a.lastLocal) {
      a.firedEvents = evs.findIndex((e) => e.t >= c.loopFrom!);
      if (a.firedEvents < 0) a.firedEvents = evs.length;
    }
    a.lastLocal = local;
    while (a.firedEvents < evs.length && evs[a.firedEvents].t <= local) {
      const ev = evs[a.firedEvents++].ev;
      this.onEvent?.(ev);
    }
    while (a.firedShow < shows.length && shows[a.firedShow].t <= local) {
      const s = shows[a.firedShow++];
      this.rig.show(s.grp, s.on);
    }
  }

  private applyClip(p: Playing, w: number, moveW: number) {
    this.applyClipAt(p.clip, Math.min(p.t, p.clip.dur), w, moveW);
  }

  /** Blends a clip sample over the current pose for the bones the clip keys. */
  private applyClipAt(c: Clip, t: number, w: number, moveW: number) {
    const keys = c.keys;
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = b.t - a.t;
    const u = span > 0 ? ease(b.e, Math.min(1, Math.max(0, (t - a.t) / span))) : 1;
    const legW = c.name === 'death' || c.name === 'victory' ? 1 : 1 - moveW;
    for (const key in b.p) {
      const vb = b.p[key as BoneId]!;
      const va = a.p[key as BoneId] ?? vb;
      let bw = w;
      if (LEG_BONES.has(key) || key === 'hips') bw *= legW;
      if (bw <= 0) continue;
      const cur = this.pose.get(key);
      if (!cur) continue;
      const st = c.abs || key === 'rootPos' || key === 'root' ? null : this.stance[key as BoneId];
      for (let ax = 0; ax < 3; ax++) {
        let v = va[ax] + (vb[ax] - va[ax]) * u;
        if (key === 'rootPos') {
          cur[ax] += v * bw;
          continue;
        }
        if (st) v += st[ax];
        cur[ax] += (v - cur[ax]) * bw;
      }
    }
  }

  /** Capes trail and flutter, robe panels follow the legs, hair and packs bounce. */
  private springLayer(dt: number, t: number, fwd: number) {
    const legL = this.pose.get('legL')![0];
    const legR = this.pose.get('legR')![0];
    const steps = dt > 1 / 50 ? 2 : 1;
    const h = dt / steps;
    for (const s of this.springs) {
      const d = s.def;
      if (d.kind === 'spin') {
        s.spin += (d.speed ?? 1) * dt;
        continue;
      }
      const km = d.k ?? 1;
      let tx = d.rest ?? 0;
      let tz = 0;
      if (d.kind === 'cape') {
        const lower = s.bone === 'capeB';
        tx += Math.min(75, Math.max(0, fwd) * (lower ? 6 : 10)) + Math.max(0, -this.accelF) * 0.6;
        tx += Math.sin(t * 9 + (lower ? 1.4 : 0)) * Math.min(1, fwd / 4) * (lower ? 7 : 3);
        tx += this.bobVel * 2.2 + 3 + Math.sin(t * 1.3) * 1.5;
        tz = -this.turn * 10 + this.side * 5;
      } else if (d.kind === 'flap') {
        if (s.bone === 'skirtF') tx = Math.min(legL, legR, 0) * 0.85 - Math.max(0, fwd) * 0.8;
        else tx = Math.max(legL, legR, 0) * 0.8 + Math.max(0, fwd) * 2.5;
        tz = -this.turn * 4;
      } else {
        tx += -this.accelF * 0.35 + Math.max(0, fwd) * 2.5 + this.bobVel * 4 + Math.sin(t * 2.1) * 1.2;
        tz = -this.turn * 7 + Math.sin(t * 1.7) * 1.2;
      }
      const stiff = 140 * km;
      const damp = 9 * Math.sqrt(km);
      for (let i = 0; i < steps; i++) {
        s.vx += (stiff * (tx - s.ax) - damp * s.vx) * h;
        s.vz += (stiff * (tz - s.az) - damp * s.vz) * h;
        s.ax += s.vx * h;
        s.az += s.vz * h;
      }
      if (!isFinite(s.ax)) s.ax = s.vx = 0;
      if (!isFinite(s.az)) s.az = s.vz = 0;
    }
  }

  /** Writes the pose into the bone transforms. */
  private write() {
    const rig = this.rig;
    const sc = rig.def.scale;
    for (const id of BONES) {
      const v = this.pose.get(id)!;
      rig.bones[id].rotation.set(v[0] * D2R, v[1] * D2R, v[2] * D2R);
    }
    for (const s of this.springs) {
      const b = rig.bones[s.bone];
      if (s.def.kind === 'spin') {
        if (s.def.axis === 'z') b.rotation.z = s.spin;
        else b.rotation.y = s.spin;
        continue;
      }
      b.rotation.x += s.ax * D2R;
      b.rotation.z += s.az * D2R;
    }
    const hp = this.pose.get('hipsPos')!;
    const hr = rig.rest.hips;
    rig.bones.hips.position.set(hr.x + hp[0] * sc, hr.y + hp[1] * sc, hr.z + hp[2] * sc);
    const rp = this.pose.get('rootPos')!;
    rig.bones.root.position.set(rp[0] * sc, rp[1] * sc, rp[2] * sc);
  }
}
