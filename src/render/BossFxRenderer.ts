import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { BossTele } from '../game/bosses/BossAttacks';
import { InstancedBatch } from './InstancedBatch';
import { makeGlowMaterial } from './Materials';

const TAU = Math.PI * 2;
/** Angle of one cone wedge. */
const WEDGE = (3 * Math.PI) / 180;

/** Flat fan sector from angle 0 to `arc` (world convention: angle = atan2(z, x)), inner..1 radius. */
function sector(arc: number, inner: number, seg: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * arc;
    const a1 = ((i + 1) / seg) * arc;
    const p = (a: number, r: number) => [Math.cos(a) * r, 0, Math.sin(a) * r];
    if (inner <= 0) pos.push(0, 0, 0, ...p(a1, 1), ...p(a0, 1));
    else pos.push(...p(a0, inner), ...p(a1, 1), ...p(a0, 1), ...p(a0, inner), ...p(a1, inner), ...p(a1, 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function flatPlane(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Boss fight visuals: the arena (pillar ring with glowing runes and a ground boundary), the boss
 * skill telegraphs (filled discs, rings, cones and lanes that fill up until the strike lands, red =
 * damage, gold = stun, blue = knockback) and the dizzy stars over a stunned hero.
 */
export class BossFxRenderer {
  private group = new THREE.Group();
  private fill: InstancedBatch;
  private core: InstancedBatch;
  private edge: InstancedBatch;
  private wedgeFill: InstancedBatch;
  private wedgeCore: InstancedBatch;
  private arcEdge: InstancedBatch;
  private rectFill: InstancedBatch;
  private rectCore: InstancedBatch;
  private stone: InstancedBatch;
  private glowBox: InstancedBatch;
  private glowRing: InstancedBatch;
  private all: InstancedBatch[];
  private time = 0;

  constructor(
    scene: THREE.Scene,
    private run: Run,
  ) {
    scene.add(this.group);
    const mk = (opacity: number) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const fillMat = mk(0.2);
    const coreMat = mk(0.34);
    const edgeMat = mk(0.85);
    const disc = sector(TAU, 0, 48);
    const ring = sector(TAU, 0.93, 64);
    this.fill = new InstancedBatch(disc, fillMat, this.group, 64);
    this.core = new InstancedBatch(disc, coreMat, this.group, 64);
    this.edge = new InstancedBatch(ring, edgeMat, this.group, 96);
    this.wedgeFill = new InstancedBatch(sector(WEDGE, 0, 2), fillMat, this.group, 256);
    this.wedgeCore = new InstancedBatch(sector(WEDGE, 0, 2), coreMat, this.group, 256);
    this.arcEdge = new InstancedBatch(sector(WEDGE, 0.95, 2), edgeMat, this.group, 256);
    this.rectFill = new InstancedBatch(flatPlane(), fillMat, this.group, 32);
    this.rectCore = new InstancedBatch(flatPlane(), coreMat, this.group, 32);
    for (const b of [this.fill, this.wedgeFill, this.rectFill]) b.mesh.renderOrder = 3;
    for (const b of [this.core, this.wedgeCore, this.rectCore]) b.mesh.renderOrder = 4;
    for (const b of [this.edge, this.arcEdge]) b.mesh.renderOrder = 4;
    // arena pillars: lit stone blocks + additive rune glow
    this.stone = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), this.group, 256, false, false);
    this.glowBox = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), makeGlowMaterial(), this.group, 256);
    this.glowBox.mesh.renderOrder = 5;
    this.glowRing = new InstancedBatch(sector(TAU, 0.9, 96), makeGlowMaterial(), this.group, 8);
    this.glowRing.mesh.renderOrder = 5;
    this.all = [this.fill, this.core, this.edge, this.wedgeFill, this.wedgeCore, this.arcEdge, this.rectFill, this.rectCore, this.stone, this.glowBox, this.glowRing];
  }

  update(dt: number) {
    this.time += dt;
    for (const b of this.all) b.begin();
    const run = this.run;
    this.arena();
    for (const b of run.bosses) for (const tl of b.teles) this.tele(tl);
    this.heroStun();
    for (const b of this.all) b.end();
  }

  private tele(tl: BossTele) {
    const k = tl.max > 0 ? Math.min(1, Math.max(0, 1 - tl.t / tl.max)) : 1;
    const c = tl.color;
    // a resolved telegraph flashes white for a moment
    const done = tl.done;
    const col = done ? 0xffffff : c;
    const y = 0.07;
    const pulse = 0.85 + Math.sin(this.time * (k > 0.7 ? 26 : 12)) * 0.15;
    const cr = ((c >> 16) & 255) / 255;
    const cg = ((c >> 8) & 255) / 255;
    const cb = (c & 255) / 255;
    switch (tl.shape) {
      case 'circle': {
        if (!done) this.fill.pushFast(tl.x, y, tl.z, 0, tl.r, 1, cr, cg, cb);
        const rk = done ? tl.r : tl.r * k;
        this.core.pushFast(tl.x, y + 0.005, tl.z, 0, rk, 1, done ? 1 : cr, done ? 1 : cg, done ? 1 : cb);
        this.edge.push(tl.x, y + 0.01, tl.z, 0, tl.r, 1, tl.r, col, 0, 0, 0, pulse);
        break;
      }
      case 'ring': {
        if (!done) this.edge.push(tl.x, y + 0.01, tl.z, 0, tl.r0, 1, tl.r0, col, 0, 0, 0, pulse);
        this.edge.push(tl.x, y + 0.01, tl.z, 0, tl.r, 1, tl.r, col, 0, 0, 0, pulse);
        const rr = tl.r0 + (tl.r - tl.r0) * k;
        this.edge.push(tl.x, y + 0.012, tl.z, 0, rr, 1, rr, col, 0, 0, 0, 0.6);
        break;
      }
      case 'cone': {
        const n = Math.max(1, Math.round(tl.arc / WEDGE));
        const step = tl.arc / n;
        const a0 = tl.a - tl.arc / 2;
        for (let i = 0; i < n; i++) {
          const a = a0 + i * step;
          // the wedge geometry spans [0, WEDGE]; stretch it a little to cover `step`
          if (!done) this.wedgeFill.push(tl.x, y, tl.z, -a, tl.r, 1, tl.r, c, 0, 0, 0, 1);
          this.wedgeCore.push(tl.x, y + 0.005, tl.z, -a, tl.r * (done ? 1 : k), 1, tl.r * (done ? 1 : k), col, 0, 0, 0, 1);
          this.arcEdge.push(tl.x, y + 0.01, tl.z, -a, tl.r, 1, tl.r, col, 0, 0, 0, pulse);
        }
        // side edges
        for (const a of [a0, a0 + tl.arc]) {
          const len = tl.r;
          this.rectCore.push(tl.x + Math.cos(a) * len * 0.5, y + 0.01, tl.z + Math.sin(a) * len * 0.5, -a, len, 1, 0.12, col, 0, 0, 0, 1);
        }
        break;
      }
      case 'rect': {
        const ux = Math.cos(tl.a);
        const uz = Math.sin(tl.a);
        if (!done) this.rectFill.push(tl.x + ux * tl.len * 0.5, y, tl.z + uz * tl.len * 0.5, -tl.a, tl.len, 1, tl.w, c, 0, 0, 0, 1);
        const l = done ? tl.len : tl.len * k;
        this.rectCore.push(tl.x + ux * l * 0.5, y + 0.005, tl.z + uz * l * 0.5, -tl.a, l, 1, tl.w * 0.92, col, 0, 0, 0, 1);
        // side rails and the end bar
        const px = -uz;
        const pz = ux;
        for (const s of [-1, 1]) this.rectCore.push(tl.x + ux * tl.len * 0.5 + px * s * tl.w * 0.5, y + 0.01, tl.z + uz * tl.len * 0.5 + pz * s * tl.w * 0.5, -tl.a, tl.len, 1, 0.14, col, 0, 0, 0, pulse);
        this.rectCore.push(tl.x + ux * tl.len, y + 0.01, tl.z + uz * tl.len, -tl.a, 0.2, 1, tl.w, col, 0, 0, 0, pulse);
        break;
      }
    }
  }

  private arena() {
    const ar = this.run.arena;
    if (!ar.active || ar.rise <= 0) return;
    const boss = ar.boss;
    const color = boss?.def.color ?? ar.corpse?.color ?? 0xff4a5a;
    const rise = ar.rise;
    const sink = (1 - rise) * 4.2;
    const t = this.time;
    // the boundary line on the ground
    this.glowRing.push(ar.x, 0.06, ar.z, 0, ar.r, 1, ar.r, color, 0, 0, 0, 0.55 * rise);
    this.glowRing.push(ar.x, 0.05, ar.z, t * 0.2, ar.r + 0.6, 1, ar.r + 0.6, color, 0, 0, 0, 0.25 * rise);
    for (const p of ar.pillars()) {
      const y0 = -sink;
      const yaw = -p.a;
      // base, column (two tones), cap
      this.stone.push(p.x, y0 + 0.3, p.z, yaw, 1.5, 0.6, 1.5, 0x4a4650);
      this.stone.push(p.x, y0 + 1.0, p.z, yaw, 1.05, 0.9, 1.05, 0x6a6470);
      this.stone.push(p.x, y0 + 1.9, p.z, yaw, 0.95, 0.9, 0.95, 0x5a5560);
      this.stone.push(p.x, y0 + 2.8, p.z, yaw, 1.05, 0.9, 1.05, 0x6a6470);
      this.stone.push(p.x, y0 + 3.45, p.z, yaw, 1.4, 0.45, 1.4, 0x3e3a44);
      // rune bands and the floating crystal
      const glow = 0.7 + Math.sin(t * 3 + p.a * 5) * 0.3;
      this.glowBox.push(p.x, y0 + 1.45, p.z, yaw, 1.0, 0.12, 1.0, color, 0, 0, 0, glow * rise);
      this.glowBox.push(p.x, y0 + 2.35, p.z, yaw, 1.0, 0.12, 1.0, color, 0, 0, 0, glow * 0.8 * rise);
      this.glowBox.push(p.x, y0 + 4.2 + Math.sin(t * 2 + p.a * 3) * 0.15, p.z, t + p.a, 0.45, 0.45, 0.45, color, 0, 0, Math.PI / 4, glow * rise);
    }
  }

  private heroStun() {
    const run = this.run;
    const a = run.action;
    if (a.hardStunT <= 0 || run.player.dead) return;
    const p = run.player;
    const t = this.time;
    for (let i = 0; i < 5; i++) {
      const ang = t * 5 + (i * TAU) / 5;
      const r = 0.55;
      this.glowBox.push(p.x + Math.cos(ang) * r, 2.25 + Math.sin(ang * 2) * 0.08 + p.jumpY, p.z + Math.sin(ang) * r, ang * 2, 0.2, 0.2, 0.2, i % 2 ? 0xffe060 : 0xffffff, 0, 0, Math.PI / 4, 1);
    }
  }

  dispose() {
    for (const b of this.all) {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.group.removeFromParent();
  }
}
