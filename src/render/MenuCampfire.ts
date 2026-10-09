import * as THREE from 'three';
import { heroRig } from '../models/rigs';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator } from './rig/Animator';

export interface CampMember {
  id: string;
  cls: string;
}

interface Seat {
  id: string;
  cls: string;
  rig: HeroRig;
  anim: HeroAnimator;
  /** Smoothed position / facing (the active character walks to the front). */
  x: number;
  z: number;
  yaw: number;
  emoteT: number;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/**
 * Menu campfire: a voxel fire (stone ring, crossed logs, flickering flame cubes, rising embers)
 * with the player's characters idling around it. The active character stands in front of the
 * fire with a glowing ring under its feet; the others face the fire on the far side.
 */
export class MenuCampfire {
  readonly group = new THREE.Group();
  private seats: Seat[] = [];
  private active: string | null = null;
  private flames: { m: THREE.Mesh; base: THREE.Vector3; ph: number; s: number }[] = [];
  private embers: { m: THREE.Mesh; v: THREE.Vector3; life: number; t: number }[] = [];
  private ring: THREE.Mesh;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private time = 0;
  private v = new THREE.Vector3();

  constructor(private heroTex: THREE.Texture) {
    const lam = (c: number) => this.mat(new THREE.MeshLambertMaterial({ color: c }));
    const glow = (c: number) => this.mat(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    const fire = new THREE.Group();
    fire.scale.setScalar(1.35);
    this.group.add(fire);
    // stone ring
    const stoneG = this.geo(box(0.42, 0.3, 0.42));
    const stoneA = lam(0x77736c);
    const stoneB = lam(0x5d5a55);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = new THREE.Mesh(stoneG, i % 2 ? stoneA : stoneB);
      m.position.set(Math.cos(a) * 0.95, 0.13, Math.sin(a) * 0.95);
      m.rotation.y = a + (i % 3) * 0.2;
      m.scale.y = 0.8 + (i % 3) * 0.2;
      m.castShadow = m.receiveShadow = true;
      fire.add(m);
    }
    // embers bed and crossed logs (bark sides, pale cut ends)
    const bed = new THREE.Mesh(this.geo(box(1.25, 0.08, 1.25)), glow(0xb2380e));
    bed.position.y = 0.04;
    fire.add(bed);
    const logG = this.geo(box(1.5, 0.24, 0.24));
    const bark = lam(0x5a3a20);
    const cut = lam(0xc89a62);
    const endG = this.geo(box(0.04, 0.2, 0.2));
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Group();
      const m = new THREE.Mesh(logG, bark);
      m.castShadow = true;
      log.add(m);
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(endG, cut);
        e.position.x = s * 0.76;
        log.add(e);
      }
      log.rotation.y = (i * Math.PI) / 4 + 0.3;
      log.rotation.z = i % 2 ? 0.28 : -0.28;
      log.position.y = 0.26 + i * 0.05;
      fire.add(log);
    }
    // flame: stacked glowing cubes, hot at the core
    const fG = this.geo(box(1, 1, 1));
    const cols = [0xff4a12, 0xff7a1a, 0xffb02e, 0xffe27a];
    const spots: [number, number, number, number, number][] = [
      [0, 0.45, 0, 0.62, 0],
      [0.18, 0.4, 0.12, 0.42, 1],
      [-0.2, 0.42, -0.08, 0.44, 1],
      [0.05, 0.42, -0.22, 0.4, 0],
      [-0.06, 0.4, 0.22, 0.38, 0],
      [0, 0.8, 0, 0.44, 2],
      [0.12, 0.95, -0.05, 0.28, 1],
      [-0.1, 1.05, 0.06, 0.26, 2],
      [0, 1.2, 0, 0.2, 3],
      [0, 0.62, 0, 0.3, 3],
    ];
    spots.forEach(([x, y, z, s, c], i) => {
      const m = new THREE.Mesh(fG, glow(cols[c]));
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      this.flames.push({ m, base: m.position.clone(), ph: i * 1.7, s });
      fire.add(m);
    });
    // embers drifting up
    const eG = this.geo(box(0.07, 0.07, 0.07));
    const eM = glow(0xffa23a);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(eG, eM);
      const e = { m, v: new THREE.Vector3(), life: 1, t: 1 + Math.random() };
      this.embers.push(e);
      fire.add(m);
    }
    // seat logs behind the fire
    const seatG = this.geo(box(1.6, 0.34, 0.4));
    for (const a of [-0.9, 0, 0.9]) {
      const m = new THREE.Mesh(seatG, bark);
      m.position.set(Math.sin(a) * 4.1, 0.17, -Math.cos(a) * 4.1);
      m.rotation.y = -a;
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    }
    // highlight ring under the active character
    this.ring = new THREE.Mesh(this.geo(new THREE.RingGeometry(0.55, 0.75, 24)), this.mat(new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide })));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.group.add(this.ring);
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  get empty(): boolean {
    return this.seats.length === 0;
  }

  /** Replaces the party (rigs are reused for characters that stay). */
  setParty(members: CampMember[], activeId: string | null) {
    const keep = new Set(members.map((m) => m.id + '|' + m.cls));
    for (const s of this.seats.filter((s) => !keep.has(s.id + '|' + s.cls))) {
      this.group.remove(s.rig.root);
      s.rig.dispose();
    }
    const old = new Map(this.seats.filter((s) => keep.has(s.id + '|' + s.cls)).map((s) => [s.id, s]));
    this.seats = [];
    for (const m of members) {
      let s = old.get(m.id);
      if (!s) {
        const rd = heroRig(m.cls);
        if (!rd) continue;
        const rig = new HeroRig(rd, this.heroTex, { shadows: true, rim: 0.4 });
        const anim = new HeroAnimator(rig);
        s = { id: m.id, cls: m.cls, rig, anim, x: 0, z: 0, yaw: 0, emoteT: 4 + Math.random() * 8 };
        this.group.add(rig.root);
        const [x, z, yaw] = this.spot(m.id, members, activeId);
        s.x = x;
        s.z = z;
        s.yaw = yaw;
      }
      this.seats.push(s);
    }
    if (this.active !== activeId) {
      const a = this.seats.find((s) => s.id === activeId);
      a?.anim.play('victory', { force: true });
    }
    this.active = activeId;
  }

  /** Target place of a character: the active one in front of the fire, the rest on an arc behind it. */
  private spot(id: string, members: CampMember[] = this.seats, activeId = this.active): [number, number, number] {
    if (id === activeId) return [1.7, 1.9, -0.35];
    const rest = members.filter((m) => m.id !== activeId);
    const i = rest.findIndex((m) => m.id === id);
    const n = rest.length;
    const span = Math.min(2.6, 0.55 * Math.max(1, n - 1) + 0.6);
    const a = n <= 1 ? 0.5 : -span / 2 + (span * i) / (n - 1);
    const r = 3.1;
    const x = Math.sin(a) * r;
    const z = -Math.cos(a) * r;
    // face the fire, turned a little toward the viewer
    return [x, z, Math.atan2(-x, -z) * 0.75];
  }

  /** Character id under a screen point (NDC), or null. */
  pick(ndcX: number, ndcY: number, cam: THREE.Camera): string | null {
    let best: string | null = null;
    let bd = 0.16;
    for (const s of this.seats) {
      for (const y of [0.5, 1.1, 1.7]) {
        this.v.set(s.x, y, s.z).applyMatrix4(this.group.matrixWorld).project(cam);
        const d = Math.hypot((this.v.x - ndcX) * 0.6, this.v.y - ndcY);
        if (d < bd) {
          bd = d;
          best = s.id;
        }
      }
    }
    return best;
  }

  /** Flickering light intensity this frame (the renderer feeds it into its light pool). */
  flicker = 1;

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    this.flicker = 0.85 + Math.sin(t * 9.3) * 0.08 + Math.sin(t * 23.1) * 0.06 + Math.sin(t * 3.7) * 0.05;
    for (const f of this.flames) {
      const k = 0.82 + Math.sin(t * 7 + f.ph) * 0.12 + Math.sin(t * 17 + f.ph * 2) * 0.08;
      f.m.scale.set(f.s * k, f.s * (k + 0.15 + Math.sin(t * 5 + f.ph) * 0.12), f.s * k);
      f.m.position.set(f.base.x + Math.sin(t * 4 + f.ph) * 0.03, f.base.y + Math.sin(t * 6 + f.ph) * 0.05, f.base.z + Math.cos(t * 5 + f.ph) * 0.03);
      f.m.rotation.y = Math.sin(t * 2 + f.ph) * 0.4;
    }
    for (const e of this.embers) {
      e.t += dt;
      if (e.t >= e.life) {
        e.t = 0;
        e.life = 1.2 + Math.random() * 1.6;
        e.m.position.set((Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
        e.v.set((Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4);
      }
      e.m.position.addScaledVector(e.v, dt);
      e.m.position.x += Math.sin(t * 3 + e.life * 9) * dt * 0.3;
      e.m.scale.setScalar(Math.max(0.05, 1 - e.t / e.life));
    }
    for (const s of this.seats) {
      const [tx, tz, ty] = this.spot(s.id);
      const k = 1 - Math.exp(-3 * dt);
      const dx = tx - s.x;
      const dz = tz - s.z;
      const dist = Math.hypot(dx, dz);
      s.x += dx * k;
      s.z += dz * k;
      let dy = ty - s.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      s.yaw += dy * k;
      s.anim.speed = dist > 0.2 ? Math.min(4, dist * 3) : 0;
      s.anim.fwd = s.anim.speed;
      s.rig.root.position.set(s.x, 0, s.z);
      s.rig.root.rotation.y = s.yaw;
      // now and then someone shows off
      s.emoteT -= dt;
      if (s.emoteT <= 0) {
        s.emoteT = 8 + Math.random() * 10;
        s.anim.play(s.id === this.active ? (Math.random() < 0.6 ? 'attack' : 'ability') : 'victory');
      }
      s.anim.update(Math.min(dt, 0.05));
      if (s.id === this.active) {
        this.ring.position.set(s.x, 0.03, s.z);
        const p = 1 + Math.sin(t * 3) * 0.06;
        this.ring.scale.set(p, p, 1);
      }
    }
    this.ring.visible = this.seats.some((s) => s.id === this.active);
  }

  dispose() {
    for (const s of this.seats) s.rig.dispose();
    this.seats = [];
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
