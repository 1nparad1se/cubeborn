import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { Enemy } from '../game/Enemy';
import { MobWorld } from '../game/MobWorld';
import { MOB_DEFS } from '../models/mobs';
import { MobRig } from './rig/MobRig';
import { makeHeroTexture } from './Textures';
import type { InstancedBatch } from './InstancedBatch';

/** Creatures are drawn only this close to the camera focus (rigs are pooled and reused). */
const VIEW_R = 34;

interface Slot {
  rig: MobRig;
  uid: number;
  walk: number;
  used: boolean;
}

/**
 * Draws the world creatures with their bestiary rigs (MobRig): one pooled rig per visible mob,
 * posed every frame from its movement, attack and hit state. Creatures far from the camera
 * are not drawn at all; their rigs return to the pool.
 */
export class MobRenderer {
  private group = new THREE.Group();
  private tex = makeHeroTexture();
  /** Rigs by model id; each is either bound to a mob uid or free. */
  private pools = new Map<string, Slot[]>();
  private byUid = new Map<number, Slot>();

  constructor(
    parent: THREE.Object3D,
    private run: Run,
    private shadows: InstancedBatch,
    private glow: InstancedBatch,
    private castShadows: boolean,
  ) {
    parent.add(this.group);
  }

  private take(e: Enemy): Slot | null {
    let s = this.byUid.get(e.uid);
    if (s) return s;
    const def = MOB_DEFS[e.def.model];
    if (!def) return null;
    let pool = this.pools.get(def.id);
    if (!pool) this.pools.set(def.id, (pool = []));
    s = pool.find((x) => x.uid === 0);
    if (!s) {
      s = { rig: new MobRig(def, this.tex, { shadows: this.castShadows, rim: 0.3 }), uid: 0, walk: 0, used: false };
      pool.push(s);
      this.group.add(s.rig.root);
    }
    s.uid = e.uid;
    s.walk = Math.random() * 6;
    s.rig.root.visible = true;
    this.byUid.set(e.uid, s);
    return s;
  }

  update(dt: number, time: number, camX: number, camZ: number) {
    for (const s of this.byUid.values()) s.used = false;
    const world = this.run.mobs;
    for (const e of this.run.enemies.list) {
      if (!e.active || !MobWorld.isMob(e)) continue;
      if ((e.x - camX) ** 2 + (e.z - camZ - 2) ** 2 > VIEW_R * VIEW_R) continue;
      const s = this.take(e);
      if (!s) continue;
      s.used = true;
      const m = world.mobOf(e);
      const sp = e.freezeT > 0 ? 0 : Math.hypot(e.vx, e.vz);
      s.walk += dt * (3 + sp * 3.2);
      // attack: rises through the windup, snaps back after the blow
      let atk = 0;
      if (m && m.atkT > 0) {
        const total = 0.38 + m.s.attackCd * 0.5;
        const k = 1 - m.atkT / total; // 0 → 1 over the attack
        const hit = 0.38 / total;
        atk = k < hit ? k / hit : Math.max(0, 1 - (k - hit) / (1 - hit) * 2.5);
      }
      const hitK = e.hitT > 0 ? e.hitT / 0.16 : 0;
      const rig = s.rig;
      rig.pose(time + e.index * 0.37, { walk: s.walk, move: Math.min(1, sp / 1.5), attack: atk, hit: hitK, flash: Math.min(0.8, e.flash * 6 + (e.dying > 0 ? 0.6 : 0)), flap: e.flying });
      let x = e.x;
      let z = e.z;
      let y = e.y;
      if (e.launchT > 0) y += Math.sin((1 - e.launchT / 0.6) * Math.PI) * 1.4;
      // lunge toward the target at the strike
      const lunge = atk * atk * 0.35;
      x += Math.sin(e.yaw) * lunge + e.hitDx * hitK * 0.15;
      z += Math.cos(e.yaw) * lunge + e.hitDz * hitK * 0.15;
      rig.root.position.set(x, y, z);
      rig.root.rotation.y = e.yaw;
      let sc = e.scale;
      let sy = sc;
      if (e.dying > 0) {
        const k = e.dying / 0.28;
        sy = sc * k;
        sc *= 1 + (1 - k) * 0.4;
      }
      rig.root.scale.set(sc, sy, sc);
      // tint: frozen blue, invulnerable (walking home) faded
      const col = rig.material.color;
      if (e.freezeT > 0) col.setRGB(0.65, 0.85, 1.4);
      else if (e.poisonT > 0) col.setRGB(0.75, 1.2, 0.6);
      else if (e.invuln) col.setRGB(0.7, 0.7, 0.85);
      else col.setRGB(1, 1, 1);
      const sh = Math.max(0.8, e.radius * 2.6) * (e.flying ? 0.7 : 1);
      this.shadows.push(e.x, 0.02, e.z, 0, sh, 1, sh);
    }
    for (const [uid, s] of this.byUid) {
      if (s.used) continue;
      s.uid = 0;
      s.rig.root.visible = false;
      this.byUid.delete(uid);
    }
    // creature shots: small glowing bolts
    for (const sh of world.shots) {
      const yaw = Math.atan2(sh.vx, sh.vz);
      this.glow.push(sh.x, 0.9, sh.z, yaw + time * 6, 0.22, 0.22, 0.42, sh.color, 0, 0, 0, 0.95);
    }
  }

  dispose() {
    for (const pool of this.pools.values()) for (const s of pool) s.rig.dispose();
    this.tex.dispose();
    this.group.parent?.remove(this.group);
  }
}
