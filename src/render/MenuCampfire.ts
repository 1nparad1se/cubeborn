import * as THREE from 'three';
import { heroRig } from '../models/rigs';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator } from './rig/Animator';
import { hash2 } from '../core/Rng';

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
  private texs: THREE.Texture[] = [];
  private mats: THREE.Material[] = [];
  private time = 0;
  private v = new THREE.Vector3();

  constructor(private heroTex: THREE.Texture) {
    const lam = (c: number) => this.mat(new THREE.MeshLambertMaterial({ color: c }));
    const glow = (c: number) => this.mat(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    const fire = new THREE.Group();
    fire.scale.setScalar(0.95);
    this.group.add(fire);
    this.buildSet(lam);
    // ash bed and two crossed block logs (bark sides, ringed cut ends)
    const ash = new THREE.Mesh(this.geo(box(1.5, 0.06, 1.5)), this.texMat('ash'));
    ash.position.y = 0.03;
    ash.receiveShadow = true;
    fire.add(ash);
    const bed = new THREE.Mesh(this.geo(box(0.7, 0.07, 0.7)), glow(0xb2380e));
    bed.position.y = 0.05;
    fire.add(bed);
    const logG = this.geo(box(1.7, 0.36, 0.36));
    const logMats = [this.texMat('logEnd'), this.texMat('logEnd'), this.texMat('bark'), this.texMat('bark'), this.texMat('bark'), this.texMat('bark')];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(logG, logMats);
      m.rotation.y = i ? 0.35 : -0.35;
      m.position.set(0, 0.2 + i * 0.3, i ? -0.1 : 0.12);
      m.castShadow = m.receiveShadow = true;
      fire.add(m);
    }
    // flame: a tall flickering column of glowing cubes, hot core, red edges
    const fG = this.geo(box(1, 1, 1));
    const cols = [0xff4a12, 0xff7a1a, 0xffb02e, 0xffe27a];
    const spots: [number, number, number, number, number][] = [
      [0, 0.62, 0, 0.5, 2],
      [0.2, 0.55, 0.1, 0.34, 1],
      [-0.2, 0.58, -0.08, 0.34, 1],
      [0.04, 0.6, -0.2, 0.3, 0],
      [-0.05, 0.6, 0.2, 0.3, 0],
      [0, 0.75, 0.05, 0.3, 3],
      [0.05, 1.0, 0, 0.36, 2],
      [-0.1, 1.25, 0.04, 0.28, 1],
      [0.08, 1.45, -0.03, 0.24, 2],
      [-0.04, 1.68, 0.02, 0.2, 1],
      [0.06, 1.9, 0, 0.16, 0],
      [0, 1.15, 0, 0.18, 3],
    ];
    spots.forEach(([x, y, z, s, c], i) => {
      const m = new THREE.Mesh(fG, glow(cols[c]));
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      this.flames.push({ m, base: m.position.clone(), ph: i * 1.7, s });
      fire.add(m);
    });
    // sparks drifting up
    const eG = this.geo(box(0.08, 0.08, 0.08));
    const eM = glow(0xffa23a);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(eG, eM);
      const e = { m, v: new THREE.Vector3(), life: 1, t: 1 + Math.random() * 2 };
      this.embers.push(e);
      fire.add(m);
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

  private texCache = new Map<string, THREE.Material>();

  /** Pixel-art block material (16px, nearest filtered) in the game's voxel style. */
  private texMat(kind: string): THREE.Material {
    let m = this.texCache.get(kind);
    if (m) return m;
    const px = 16;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    const rgb = (h: number, k: number) => `rgb(${Math.min(255, ((h >> 16) & 255) * k) | 0},${Math.min(255, ((h >> 8) & 255) * k) | 0},${Math.min(255, (h & 255) * k) | 0})`;
    const seed = kind.length * 13;
    for (let y = 0; y < px; y++)
      for (let x = 0; x < px; x++) {
        const n = hash2(x >> 1, y >> 1, seed);
        const r = hash2(x, y, seed + 1);
        let col = 0x7a5233;
        let k = 0.85 + n * 0.2;
        if (kind === 'grassTop') {
          col = r > 0.85 ? 0x5f9a3a : 0x4e8a2e;
          k = 0.82 + n * 0.25;
        } else if (kind === 'grassSide') {
          const edge = 3 + Math.floor(hash2(x, 0, seed + 2) * 3) + (x % 3 === 0 ? 1 : 0);
          col = y < edge ? 0x4e8a2e : 0x86593a;
          if (y >= edge && r > 0.9) col = 0x6b4630;
        } else if (kind === 'dirt') {
          col = r > 0.88 ? 0x7a6048 : r < 0.1 ? 0x463224 : 0x5e4632;
          if (hash2(x >> 2, y >> 2, seed + 3) > 0.8) col = 0x5f7d3a;
        } else if (kind === 'bark') {
          col = 0x5a3a22;
          k = hash2(x, 0, seed + 4) < 0.3 ? 0.65 : 0.85 + hash2(x, y >> 2, seed + 5) * 0.25;
        } else if (kind === 'logEnd') {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          col = d > 6.5 ? 0x5a3a22 : 0xb0844f;
          k = d > 6.5 ? 0.8 : 0.85 + (Math.floor(d) & 1) * 0.12;
        } else if (kind === 'bench') {
          col = 0x8a5532;
          k = (y & 3) === 3 ? 0.7 : 0.88 + hash2(x >> 2, y, seed + 6) * 0.18;
        } else if (kind === 'ash') {
          col = r > 0.8 ? 0x6a5a50 : 0x3a3230;
        }
        g.fillStyle = rgb(col, k);
        g.fillRect(x, y, 1, 1);
      }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.texs.push(t);
    m = this.mat(new THREE.MeshLambertMaterial({ map: t }));
    this.texCache.set(kind, m);
    return m;
  }

  /** Clearing of dirt path blocks, grass blocks around it, a log bench and stepped grass terraces. */
  private buildSet(lam: (c: number) => THREE.Material) {
    const unit = this.geo(box(1, 1, 1));
    const grass = [this.texMat('grassSide'), this.texMat('grassSide'), this.texMat('grassTop'), this.texMat('dirt'), this.texMat('grassSide'), this.texMat('grassSide')];
    const dirt = this.texMat('dirt');
    const cells: { grass: number[][]; dirt: number[][] } = { grass: [], dirt: [] };
    const put = (x: number, y: number, z: number, kind: 'grass' | 'dirt') => cells[kind].push([x, y, z]);
    // ground: one block layer whose top sits at y=0 (dirt clearing inside, grass outside)
    for (let x = -16; x <= 16; x++)
      for (let z = -16; z <= 7; z++) {
        const d = Math.hypot(x * 0.8, (z + 0.5) * 1.05) + (hash2(x, z, 91) - 0.5) * 1.6;
        put(x, -0.5, z, d < 4.4 ? 'dirt' : 'grass');
      }
    // stepped grass terraces on the right, rising to the back
    const steps: [number, number, number, number, number][] = [
      // x0, x1, z0, z1, height
      [3, 16, -7, -2, 1],
      [4, 16, -7, -3, 2],
      [6, 16, -7, -4, 3],
      [-12, -7, -9, -5, 1],
      [-16, 16, -16, -8, 2],
      [-16, -10, -16, -10, 3],
      [7, 16, -16, -9, 4],
      [10, 16, -16, -2, 2],
    ];
    for (const [x0, x1, z0, z1, h] of steps)
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) for (let y = 0; y < h; y++) put(x, y + 0.5, z, y === h - 1 ? 'grass' : 'dirt');
    const mtx = new THREE.Matrix4();
    for (const k of ['grass', 'dirt'] as const) {
      const im = new THREE.InstancedMesh(unit, k === 'grass' ? grass : dirt, cells[k].length);
      cells[k].forEach(([x, y, z], i) => im.setMatrixAt(i, mtx.makeTranslation(x, y, z)));
      im.castShadow = im.receiveShadow = true;
      this.group.add(im);
    }
    // log bench to the left of the fire
    const bench = new THREE.Mesh(this.geo(box(3.6, 0.7, 0.8)), [this.texMat('logEnd'), this.texMat('logEnd'), this.texMat('bench'), this.texMat('bench'), this.texMat('bench'), this.texMat('bench')]);
    bench.position.set(-2.3, 0.35, -2.9);
    bench.rotation.y = 0.18;
    bench.castShadow = bench.receiveShadow = true;
    this.group.add(bench);
    // flowers and bushes
    const leaf = lam(0x2f6a2a);
    const bushG = this.geo(box(0.9, 0.7, 0.9));
    for (const [x, y, z] of [[-6.5, 0.35, -3], [6.8, 0.35, 1.2], [-7.5, 1.35, -6], [8, 3.35, -5.5], [5.4, 2.35, -4]] as const) {
      const m = new THREE.Mesh(bushG, leaf);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
    }
    const petal = [lam(0x7a5ad8), lam(0xd04fc4), lam(0x5a7ae0), lam(0xe8d24a)];
    const stemG = this.geo(box(0.05, 0.3, 0.05));
    const headG = this.geo(box(0.16, 0.12, 0.16));
    const stem = lam(0x3e7a2a);
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, 1, 92) * Math.PI * 2;
      const r = 4.6 + hash2(i, 2, 93) * 4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.8 - 0.5;
      if (z < -7 || z > 5) continue;
      let y = 0;
      for (const [x0, x1, z0, z1, h] of steps) if (Math.round(x) >= x0 && Math.round(x) <= x1 && Math.round(z) >= z0 && Math.round(z) <= z1) y = Math.max(y, h);
      const s = new THREE.Mesh(stemG, stem);
      s.position.set(x, y + 0.15, z);
      const h = new THREE.Mesh(headG, petal[i % 4]);
      h.position.set(x, y + 0.33, z);
      this.group.add(s, h);
    }
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

  /** Target place of a character: the active one in front of the fire, the rest by the bench and behind the fire. */
  private spot(id: string, members: CampMember[] = this.seats, activeId = this.active): [number, number, number] {
    // everyone stands behind the fire facing the camera (faces visible), turned a little toward the flames
    const face = (x: number) => Math.atan2(-x, 7) * 0.6;
    if (id === activeId) return [1.35, -1.45, face(1.35)];
    const rest = members.filter((m) => m.id !== activeId);
    const i = rest.findIndex((m) => m.id === id);
    if (i < 3) {
      // in front of the bench (left, behind the fire)
      const x = -0.9 - i * 1.2;
      const z = -2.05 - i * 0.15;
      return [x, z, face(x)];
    }
    // the rest on an arc further back on the right
    const j = i - 3;
    const x = 1.2 + (j % 3) * 1.15;
    const z = -2.7 - Math.floor(j / 3) * 1.0;
    return [x, z, face(x)];
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
        e.m.position.set((Math.random() - 0.5) * 0.4, 1.0 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
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
    for (const t of this.texs) t.dispose();
  }
}
