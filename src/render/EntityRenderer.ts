import { ELEMENT_FX, VFX } from '../config/vfx';
import { DAY_NIGHT } from '../config/dayNight';
import { BALANCE } from '../config/balance';
import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { VoxelModel } from '../data/types';
import { getModel, PROJECTILE_MODELS, PICKUP_MODELS, BOSS_MODELS } from '../models';
import { ELITE_MODS } from '../data/enemies';
import { InstancedBatch } from './InstancedBatch';
import { buildVoxelGeometry } from './VoxelGeometry';
import { makeVoxelMaterial, makeGlowMaterial } from './Materials';
import { ArticulatedModel } from './ArticulatedModel';
import type { LightPool } from './LightPool';
import { heroRig } from '../models/heroRigs';
import { HeroRig } from './rig/HeroRig';
import { HeroAnimator } from './rig/Animator';
import { makeHeroTexture } from './Textures';

const TAU = Math.PI * 2;

/** Pair of walk-frame batches for one voxel model. */
interface ModelBatches {
  frames: InstancedBatch[];
}

function flatPlane(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}
function flatRing(inner: number, seg = 40): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(inner, 1, seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Draws every dynamic gameplay object: the hero, enemies (instanced per model with two walk
 * frames), bosses (articulated), allies, projectiles, pickups, enemy hazards and weapon effects.
 */
export class EntityRenderer {
  private group = new THREE.Group();
  private voxMat: THREE.MeshLambertMaterial;
  private models = new Map<string, ModelBatches>();
  private hero: ArticulatedModel | null = null;
  private rig: HeroRig | null = null;
  private anim: HeroAnimator | null = null;
  private heroTex: THREE.Texture | null = null;
  private cues = { attack: 0, hit: 0, ability: 0, level: 1, revive: 0 };
  private lastAttack = -9;
  private heroYaw = 0;
  /** While > 0 the hero faces its attack direction instead of its travel direction. */
  private aimHold = 0;
  private aimYaw = 0;
  private victoryPlayed = false;
  private bossModels = new Map<string, ArticulatedModel>();
  private shadows: InstancedBatch;
  private glowBox: InstancedBatch;
  private glowBoxTop: InstancedBatch;
  private glowDisc: InstancedBatch;
  private glowRing: InstancedBatch;
  private glowRingThin: InstancedBatch;
  private glowPlane: InstancedBatch;
  private darkDisc: InstancedBatch;
  private heroWalk = 0;
  private time = 0;
  private enemyShadows: boolean;

  constructor(
    scene: THREE.Scene,
    private run: Run,
    private blockTex: THREE.Texture,
    blobTex: THREE.Texture,
    private quality: string,
    private lights: LightPool,
  ) {
    scene.add(this.group);
    this.voxMat = makeVoxelMaterial({ map: blockTex, instanced: true });
    this.enemyShadows = quality === 'high';
    const rigDef = heroRig(run.hero.model) ?? heroRig(run.hero.id);
    if (rigDef) {
      this.heroTex = makeHeroTexture();
      this.rig = new HeroRig(rigDef, this.heroTex, { shadows: quality !== 'low', rim: 0.28 });
      this.anim = new HeroAnimator(this.rig);
      this.anim.onEvent = (ev) => this.onHeroEvent(ev);
      this.group.add(this.rig.root);
      const c = run.player.cues;
      this.cues = { attack: c.attack, hit: c.hit, ability: c.ability, level: run.player.level, revive: 0 };
    } else {
      const heroModel = getModel(run.hero.model) ?? getModel(run.hero.id)!;
      this.hero = new ArticulatedModel(heroModel, blockTex, quality !== 'low');
      this.group.add(this.hero.root);
    }

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: blobTex, transparent: true, opacity: 0.45, depthWrite: false });
    this.shadows = new InstancedBatch(flatPlane(), shadowMat, this.group, 512);
    this.shadows.mesh.renderOrder = 1;
    const glowMat = makeGlowMaterial();
    const glowTopMat = makeGlowMaterial(undefined, false);
    const softMat = makeGlowMaterial(blobTex);
    this.glowBox = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), glowMat, this.group, 512);
    this.glowBoxTop = new InstancedBatch(new THREE.BoxGeometry(1, 1, 1), glowTopMat, this.group, 64);
    this.glowDisc = new InstancedBatch(flatPlane(), softMat, this.group, 128);
    this.glowRing = new InstancedBatch(flatRing(0.84), glowMat, this.group, 128);
    this.glowRingThin = new InstancedBatch(flatRing(0.93), glowMat, this.group, 64);
    this.glowPlane = new InstancedBatch(flatPlane(), glowMat, this.group, 256);
    const darkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: blobTex, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true });
    this.darkDisc = new InstancedBatch(flatPlane(), darkMat, this.group, 16);
    for (const b of [this.glowBox, this.glowDisc, this.glowRing, this.glowRingThin, this.glowPlane]) b.mesh.renderOrder = 5;
    this.glowBoxTop.mesh.renderOrder = 6;
  }

  private batchesFor(id: string, model: VoxelModel | undefined, frames: number): ModelBatches | null {
    let b = this.models.get(id);
    if (b) return b;
    if (!model) return null;
    const list: InstancedBatch[] = [];
    for (let f = 0; f < frames; f++) {
      const g = buildVoxelGeometry(model, { frame: frames > 1 ? f : -1 });
      list.push(new InstancedBatch(g, this.voxMat, this.group, 32, true, this.enemyShadows));
    }
    b = { frames: list };
    this.models.set(id, b);
    return b;
  }

  private bossModel(id: string): ArticulatedModel | null {
    let m = this.bossModels.get(id);
    if (m) return m;
    const def = BOSS_MODELS[id];
    if (!def) return null;
    m = new ArticulatedModel(def, this.blockTex, this.quality !== 'low');
    this.bossModels.set(id, m);
    this.group.add(m.root);
    return m;
  }

  update(dt: number, camX: number, camZ: number) {
    this.time += dt;
    const time = this.time;
    for (const b of this.models.values()) for (const f of b.frames) f.begin();
    const all = [this.shadows, this.glowBox, this.glowBoxTop, this.glowDisc, this.glowRing, this.glowRingThin, this.glowPlane, this.darkDisc];
    for (const b of all) b.begin();

    const viewR2 = 30 * 30;
    const visible = (x: number, z: number) => (x - camX) ** 2 + (z - camZ - 2) ** 2 < viewR2;

    this.drawHero(dt, time);
    this.drawEnemies(time, visible);
    this.drawAllies(visible);
    this.drawProjectiles(time, visible);
    this.drawPickups(time, visible);
    this.drawHazards(time);
    this.drawEffects(time);

    for (const b of this.models.values()) for (const f of b.frames) f.end();
    for (const b of all) b.end();
  }

  // ---------------------------------------------------------------- hero
  private drawHero(dt: number, time: number) {
    const p = this.run.player;
    if (this.rig && this.anim) this.drawHeroRig(dt, time);
    else if (this.hero) {
      const h = this.hero;
      const sp = Math.hypot(p.vx, p.vz);
      this.heroWalk += dt * (4 + sp * 2.2);
      h.root.position.set(p.x, p.jumpY, p.z);
      const yaw = Math.atan2(p.fx, p.fz);
      h.root.rotation.y += angleDelta(h.root.rotation.y, yaw) * Math.min(1, dt * 14);
      const blink = p.invulnT > 0 && Math.floor(time * 20) % 2 === 0;
      h.pose({ walk: this.heroWalk, moving: Math.min(1, sp / 2), attack: Math.max(0, p.attackPulse) / 0.12, cast: 0, time, flash: p.hurtT > 0 ? p.hurtT * 3 : blink ? 0.35 : 0 });
      if (p.dead) h.root.rotation.z = Math.min(Math.PI / 2, h.root.rotation.z + dt * 5);
      else h.root.rotation.z = 0;
    }
    // hero-coloured ring keeps the hero easy to find in a crowd
    if (!p.dead) this.glowRingThin.push(p.x, 0.04, p.z, 0, 0.78, 1, 0.78, this.run.hero.color, 0, 0, 0, 0.55);
    // the blob shadow stays on the ground and shrinks as the hero rises
    const shS = 1.3 * (1 - Math.min(0.45, (this.heroY / BALANCE.jump.height) * 0.4));
    this.shadows.push(p.x, 0.03, p.z, 0, shS, 1, shS);
    // buffs
    if (p.buffs.aegis > 0) this.glowRing.push(p.x, 0.9, p.z, time * 2, 1.2, 1, 1.2, 0xffe080, 0, 0, 0, 0.6);
    if (p.shield) this.glowRingThin.push(p.x, 0.06, p.z, 0, 1.0, 1, 1.0, 0x8ad0ff, 0, 0, 0, 0.8);
    if (p.buffs.fury > 0) this.glowDisc.push(p.x, 0.05, p.z, 0, 2.4, 1, 2.4, 0xff4040, 0, 0, 0, 0.5);
    if (p.buffs.haste > 0) this.glowDisc.push(p.x, 0.05, p.z, 0, 2.2, 1, 2.2, 0x40ffc0, 0, 0, 0, 0.45);
    if (p.buffs.frenzy > 0) this.glowDisc.push(p.x, 0.05, p.z, 0, 2.2, 1, 2.2, 0xff9a3a, 0, 0, 0, 0.45);
    // hero always carries a soft light so darkness stays readable
    this.lights.request(p.x, 2.2, p.z, 0xffe6c0, this.run.weather.darkness > 0 ? 1.4 : 0.55, 9, p.x, p.z);
  }

  /** Drives the articulated hero: locomotion from velocity, actions from gameplay cues. */
  private drawHeroRig(dt: number, time: number) {
    const run = this.run;
    const p = run.player;
    const rig = this.rig!;
    const a = this.anim!;
    // animation runs on real time slowed a touch when the game is slowed, never frozen by hit-stop
    // the hero keeps near real-time pace through the slow-motion ending so death and victory read
    const adt = run.ending ? (dt / Math.max(0.2, run.timeScale)) * 0.8 : dt;
    // jump height; a hero who dies mid-air falls to the ground
    this.heroY = p.dead ? Math.max(0, this.heroY - 14 * adt) : p.jumpY;
    rig.root.position.set(p.x, this.heroY, p.z);
    const J = BALANCE.jump;
    a.air = p.jumpPhase === 'air' && !p.dead;
    a.airV = Math.max(-1, Math.min(1, p.jumpV / ((4 * J.height) / J.airTime)));
    a.crouch = p.dead ? 0 : p.jumpPhase === 'windup' ? Math.min(1, p.jumpT / J.windup) : p.jumpPhase === 'land' ? Math.max(0, 1 - p.jumpT / (J.landLag * 1.6)) : 0;
    // facing: toward the attack while it plays (plus a short hold), else toward travel
    const c = p.cues;
    if (c.attack !== this.cues.attack && c.aim && !p.dead) {
      this.aimYaw = Math.atan2(c.aimX, c.aimZ);
      this.aimHold = 0.8;
    }
    this.aimHold = Math.max(0, this.aimHold - adt);
    const yaw = this.aimHold > 0 ? this.aimYaw : Math.atan2(p.fx, p.fz);
    // eased, rate-limited turn so auto-targeting never snaps the model around
    const maxTurn = 11 * adt;
    const dy = Math.max(-maxTurn, Math.min(maxTurn, angleDelta(this.heroYaw, yaw) * Math.min(1, adt * 16)));
    this.heroYaw += dy;
    rig.root.rotation.y = this.heroYaw;
    const sp = p.dead ? 0 : Math.hypot(p.vx, p.vz);
    const cs = Math.cos(this.heroYaw);
    const sn = Math.sin(this.heroYaw);
    a.speed = sp;
    a.fwd = p.vx * sn + p.vz * cs;
    a.side = p.vx * cs - p.vz * sn;
    a.turn = adt > 0 ? Math.max(-3, Math.min(3, dy / adt / 4)) : 0;
    // gameplay cues
    if (p.dead) {
      if (!a.dead.value) a.play('death');
    } else {
      if (a.dead.value) {
        a.reset();
        this.cues.revive++;
      }
      if ((run.state === 'victory' || run.ending) && !this.victoryPlayed) {
        this.victoryPlayed = true;
        a.play('victory', { force: true });
      }
      if (c.hit !== this.cues.hit) {
        // hit direction in model space (pointing from the attacker to the hero)
        const hx = c.hitX * cs - c.hitZ * sn;
        const hz = c.hitX * sn + c.hitZ * cs;
        a.hit(hx, hz);
      }
      if (p.level > this.cues.level && run.state === 'playing') {
        this.cues.level = p.level;
        a.play('levelup');
      } else if (c.ability !== this.cues.ability) a.play('ability');
      else if (c.attack !== this.cues.attack && time - this.lastAttack > 0.55) {
        this.lastAttack = time;
        a.play('attack');
      }
    }
    this.cues.attack = c.attack;
    this.cues.hit = c.hit;
    this.cues.ability = c.ability;
    a.update(adt);
    const blink = p.invulnT > 0 && !p.dead && Math.floor(time * 20) % 2 === 0;
    rig.flash.value = p.hurtT > 0 ? p.hurtT * 3 : blink ? 0.3 : 0;
  }

  private heroY = 0;
  private tipPos = new THREE.Vector3();
  private onHeroEvent(ev: string) {
    const run = this.run;
    const p = run.player;
    const col = run.hero.color;
    this.rig!.tip.getWorldPosition(this.tipPos);
    const t = this.tipPos;
    if (ev === 'impulse') run.fx.burst(t.x, t.y, t.z, col, 6, 2.5, 0.1, 0.25, 'glow');
    else if (ev === 'charge') run.fx.burst(t.x, t.y, t.z, col, 3, 0.8, 0.08, 0.3, 'glow');
    else if (ev === 'levelup') {
      run.fx.burst(p.x, 0.3, p.z, 0xffe080, 26, 5, 0.14, 0.7, 'glow');
      run.fx.light(p.x, p.z, 0xffe080, 3, 6, 0.5);
    } else if (ev === 'ability') run.fx.burst(p.x, 1.0, p.z, col, 18, 4, 0.13, 0.5, 'glow');
    else if (ev === 'death') run.fx.burst(p.x, 0.4, p.z, col, 30, 4, 0.16, 0.9, 'debris');
  }

  // ---------------------------------------------------------------- enemies
  private drawEnemies(time: number, visible: (x: number, z: number) => boolean) {
    const run = this.run;
    const usedBoss = new Set<string>();
    for (const e of run.enemies.list) {
      if (!e.active) continue;
      if (e.boss) {
        this.drawBoss(e, time);
        usedBoss.add(e.def.id);
        continue;
      }
      if (!visible(e.x, e.z)) continue;
      const def = e.def;
      const frames = def.behavior === 'prop' ? 1 : 2;
      const mb = this.batchesFor(def.model, getModel(def.model), frames);
      let s = e.scale;
      let sy = s;
      let y = e.y;
      let flash = Math.min(1, e.flash * 6);
      let ex = e.x;
      let ez = e.z;
      if (e.hitT > 0 && e.dying === 0) {
        // hit reaction: squash and a small recoil along the blow
        const k = e.hitT / 0.16;
        s *= 1 + VFX.hitSquash * 0.6 * k;
        sy *= 1 - VFX.hitSquash * k;
        const rk = Math.sin(k * Math.PI) * VFX.hitRecoil * Math.min(1, 1.2 - e.kbResist);
        ex += e.hitDx * rk;
        ez += e.hitDz * rk;
      }
      if (e.dying > 0) {
        const k = e.dying / 0.28;
        sy = s * k;
        s = s * (1 + (1 - k) * 0.5);
        flash = 1;
        y -= (1 - k) * 0.2;
      }
      let r = 1;
      let g = 1;
      let bl = 1;
      if (e.freezeT > 0) {
        r = 0.6;
        g = 0.85;
        bl = 1.5;
      } else if (e.burnT > 0 && Math.floor(time * 8 + e.index) % 2 === 0) {
        r = 1.4;
        g = 0.8;
        bl = 0.55;
      } else if (e.poisonT > 0) {
        r = 0.7;
        g = 1.25;
        bl = 0.55;
      } else if (e.slowT > 0) {
        r = 0.8;
        g = 0.9;
        bl = 1.2;
      }
      if (e.invuln) {
        r *= 0.7;
        g *= 0.7;
        bl *= 1.3;
      }
      // day/night looks: petrified sleepers, dire night forms, night hunters with a faint aura
      if (e.asleep) {
        const gy = (r + g + bl) / 3;
        r = gy * 0.66;
        g = gy * 0.66;
        bl = gy * 0.74;
        sy *= 0.92;
        if (Math.random() < 0.004) run.fx.burst(e.x, 1.2 * s, e.z, 0xc8d8ff, 1, 0.6, 0.12, 1.2, 'glow');
      } else if (e.dire > 0.01) {
        const k = e.dire;
        const T = DAY_NIGHT.shifterTint;
        r *= 1 + (T[0] - 1) * k;
        g *= 1 + (T[1] - 1) * k;
        bl *= 1 + (T[2] - 1) * k;
        const sc = 1 + (DAY_NIGHT.shifterScale - 1) * k;
        s *= sc;
        sy *= sc;
        if (k > 0.5 && e.dying === 0) this.glowDisc.push(e.x, 0.05, e.z, 0, e.radius * 3, 1, e.radius * 3, 0xff3a3a, 0, 0, 0, 0.3 * k);
      } else if (run.dayNight.night > 0.5 && (e.dayKind === 'nocturnal' || e.dayKind === 'sleeper') && e.dying === 0) {
        this.glowDisc.push(e.x, 0.05, e.z, 0, e.radius * 2.8, 1, e.radius * 2.8, run.dayNight.bloodMoon ? 0xff3a4a : 0x7a6aff, 0, 0, 0, 0.28 * run.dayNight.night);
      }
      if (mb) {
        const fi = frames > 1 && e.freezeT <= 0 ? Math.floor(e.anim * 1.2) & 1 : 0;
        mb.frames[fi].pushFast(ex, y, ez, e.yaw, s, sy, r, g, bl, flash);
      } else {
        this.glowBox.push(e.x, 0.6, e.z, 0, 0.8 * s, 1.2 * s, 0.8 * s, 0xff00ff);
      }
      const shadowS = Math.max(0.7, e.radius * 2.6);
      this.shadows.push(e.x, 0.02, e.z, 0, shadowS, 1, shadowS);
      if (e.elite && e.dying === 0) {
        const c = ELITE_MODS[e.elite].color;
        const pr = e.radius * 2.4 + Math.sin(time * 5 + e.index) * 0.08;
        this.glowRing.push(e.x, 0.05, e.z, time, pr, 1, pr, c, 0, 0, 0, 0.9);
        if (e.elite2) this.glowRingThin.push(e.x, 0.07, e.z, -time, pr * 0.75, 1, pr * 0.75, ELITE_MODS[e.elite2].color, 0, 0, 0, 0.9);
        this.glowDisc.push(e.x, 0.04, e.z, 0, pr * 2.2, 1, pr * 2.2, c, 0, 0, 0, 0.35);
      }
      if (def.id === 'treasure_sprite') {
        this.glowDisc.push(e.x, 0.05, e.z, 0, 2.6, 1, 2.6, 0xffd23d, 0, 0, 0, 0.6 + Math.sin(time * 6) * 0.2);
        this.lights.request(e.x, 1.5, e.z, 0xffd23d, 1, 6, run.player.x, run.player.z);
      }
      if (def.behavior === 'exploder' && e.state === 1) {
        this.glowDisc.push(e.x, 0.06, e.z, 0, 2, 1, 2, 0xff5020, 0, 0, 0, 0.5 + Math.sin(time * 30) * 0.5);
      }
      if (e.shieldT > 0) this.glowRing.push(e.x, 0.6 * s, e.z, time * 3, e.radius * 2.6, 1, e.radius * 2.6, 0x9a7aff, 0, 0, 0, 0.7);
    }
    for (const [id, m] of this.bossModels) if (!usedBoss.has(id)) m.root.visible = false;
  }

  private drawBoss(e: Run['enemies']['list'][number], time: number) {
    const b = e.boss!;
    const m = this.bossModel(b.def.model);
    if (!m) return;
    const hidden = b.hidden > 0;
    m.root.visible = !hidden;
    const dying = e.dying > 0 ? e.dying / 0.28 : 1;
    m.root.position.set(e.x, e.y + (hidden ? -2 : 0), e.z);
    m.root.rotation.y += angleDelta(m.root.rotation.y, e.yaw) * 0.15;
    m.root.scale.setScalar(e.scale * (b.isClone ? 0.6 : 1) * (0.5 + dying * 0.5));
    const sp = Math.hypot(e.vx, e.vz);
    m.pose({ walk: time * (3 + sp * 1.5), moving: Math.min(1, sp / 1.5), attack: 0, cast: b.cast, time, flash: Math.min(1, e.flash * 6) + (b.dashPhase === 1 ? 0.3 + Math.sin(time * 30) * 0.3 : 0) });
    const sh = e.radius * 3;
    this.shadows.push(e.x, 0.03, e.z, 0, sh, 1, sh);
    if (hidden) {
      // burrow mound
      this.glowDisc.push(e.x, 0.05, e.z, time, 3, 1, 3, b.def.color, 0, 0, 0, 0.5);
    }
    if (e.invuln) this.glowRing.push(e.x, 1.2, e.z, time, e.radius * 2, 1, e.radius * 2, 0x9adfff, 0, 0, 0, 0.8);
    this.glowRing.push(e.x, 0.05, e.z, -time * 0.5, e.radius * 1.8, 1, e.radius * 1.8, b.def.color, 0, 0, 0, 0.6);
    this.lights.request(e.x, 3, e.z, b.def.color, 1.4, 10, this.run.player.x, this.run.player.z);
  }

  // ---------------------------------------------------------------- allies
  private drawAllies(visible: (x: number, z: number) => boolean) {
    for (const a of this.run.allies.list) {
      if (!a.active || !visible(a.x, a.z)) continue;
      const mb = this.batchesFor(a.model, getModel(a.model), 2);
      if (!mb) continue;
      const fi = Math.floor(a.anim * 1.2) & 1;
      const fade = Math.min(1, a.life * 2);
      mb.frames[fi].pushFast(a.x, 0, a.z, a.yaw, a.scale * fade, a.scale * fade, 1, 1.05, 1.15, a.attack > 0 ? 0.25 : 0);
      this.shadows.push(a.x, 0.02, a.z, 0, 0.9, 1, 0.9);
    }
  }

  // ---------------------------------------------------------------- projectiles
  private drawProjectiles(time: number, visible: (x: number, z: number) => boolean) {
    const run = this.run;
    const px = run.player.x;
    const pz = run.player.z;
    let lights = 0;
    const trailLv = run.fx.level();
    for (const p of run.projectiles.list) {
      if (!p.active || !visible(p.x, p.z)) continue;
      const model = PROJECTILE_MODELS[p.vis];
      const fadeIn = Math.min(1, p.age * 12);
      const s = p.scale * (0.4 + fadeIn * 0.6);
      if (model) {
        const mb = this.batchesFor('p:' + p.vis, model, 1)!;
        const ground = p.vis === 'pool' || p.vis === 'firepool' || p.vis === 'firepatch' || p.vis === 'mine';
        const fade = ground ? Math.min(1, p.life * 2) : 1;
        let yaw = p.yaw;
        if (p.vis === 'saw' || p.vis === 'glaive' || p.vis === 'tornado' || p.vis === 'wisp') yaw = time * 10 + p.a;
        if (p.vis === 'pool' || p.vis === 'firepool' || p.vis === 'firepatch') yaw = p.a * 3;
        const y = ground ? 0.02 : p.y - 0.15;
        mb.frames[0].pushFast(p.x, y, p.z, yaw, s * fade, s * (ground ? 1 : fade), 1, 1, 1, 0);
        if (!ground) this.shadows.push(p.x, 0.02, p.z, 0, 0.5 * s, 1, 0.5 * s);
        if (p.vis === 'pool' || p.vis === 'firepool' || p.vis === 'firepatch') {
          this.glowDisc.push(p.x, 0.06, p.z, 0, 2.6 * s, 1, 2.6 * s, p.vis === 'pool' ? 0x9cff4f : 0xff6a1a, 0, 0, 0, 0.35 * fade);
        }
        if (p.vis === 'mine' && p.a > 0) this.glowDisc.push(p.x, 0.08, p.z, 0, 2.5, 1, 2.5, 0xff5470, 0, 0, 0, 0.8);
        if (p.vis === 'cloud') this.shadows.push(p.x, 0.03, p.z, 0, 2.2 * s, 1, 2.2 * s);
        if (p.vis === 'meteor') this.glowBox.push(p.x, p.y + 0.3, p.z, time * 3, 0.9 * s, 0.9 * s, 0.9 * s, 0xff8a2a, 0, 0, 0, 0.8);
      } else {
        const c = p.color;
        this.glowBox.push(p.x, p.y, p.z, time * 5, 0.32 * s, 0.32 * s, 0.32 * s, c);
      }
      // trail glow for bright projectiles
      if (p.glow > 0 || p.vis === 'fireball' || p.vis === 'bolt' || p.vis === 'wisp' || p.vis === 'shard') {
        this.glowDisc.push(p.x, 0.05, p.z, 0, 1.4 * s, 1, 1.4 * s, p.color, 0, 0, 0, 0.45);
        if (lights < 6 && (p.vis === 'fireball' || p.glow > 0)) {
          lights++;
          this.lights.request(p.x, 1, p.z, p.color, 0.8, 5, px, pz);
        }
      }
      // element trail (follow-through of the release): embers, frost, sparks, bubbles, wisps
      if (trailLv >= 1 && p.owner && p.y > 0.2 && Math.random() < 0.3 * trailLv) {
        const L = ELEMENT_FX[this.run.vfx.elementOf(p.owner.def.id)].residue[0];
        this.run.fx.emit(p.x, p.y, p.z, L, 0, 0, 0.35);
      }
    }
  }

  // ---------------------------------------------------------------- pickups
  private drawPickups(time: number, visible: (x: number, z: number) => boolean) {
    for (const k of this.run.pickups.list) {
      if (!k.active || !visible(k.x, k.z)) continue;
      const model = PICKUP_MODELS[k.kind];
      const bob = Math.sin(time * 3 + k.x * 1.7) * 0.08;
      if (k.kind === 'xp') {
        const v = k.value;
        const c = v <= 2 ? [0.55, 0.85, 1.25] : v <= 10 ? [0.5, 1.4, 0.6] : v <= 40 ? [1.5, 0.45, 0.45] : [1.25, 0.6, 1.5];
        const s = v <= 2 ? 0.9 : v <= 10 ? 1.05 : v <= 40 ? 1.25 : 1.5;
        const mb = this.batchesFor('k:xp', model, 1)!;
        mb.frames[0].pushFast(k.x, 0.2 + k.y + bob, k.z, time * 1.5 + k.x, s, s, c[0], c[1], c[2], 0.15);
        continue;
      }
      if (!model) continue;
      const mb = this.batchesFor('k:' + k.kind, model, 1)!;
      const spin = k.kind === 'chest' ? 0 : time * 1.8;
      const s = k.kind === 'chest' && k.tier > 0 ? 1.25 : 1;
      mb.frames[0].pushFast(k.x, 0.15 + k.y + (k.kind === 'chest' ? 0 : bob + 0.2), k.z, spin, s, s, 1, 1, 1, 0);
      this.shadows.push(k.x, 0.02, k.z, 0, k.kind === 'chest' ? 1.6 : 0.8, 1, k.kind === 'chest' ? 1.6 : 0.8);
      if (k.kind === 'chest') {
        const c = k.tier > 0 ? 0xffd23d : 0xffb060;
        this.glowDisc.push(k.x, 0.05, k.z, 0, 3.2, 1, 3.2, c, 0, 0, 0, 0.55 + Math.sin(time * 4) * 0.2);
        // light beam
        this.glowBox.push(k.x, 3, k.z, time, 0.25, 6, 0.25, c, 0, 0, 0, 0.35);
        this.lights.request(k.x, 1.5, k.z, c, 0.9, 6, this.run.player.x, this.run.player.z);
      } else if (k.kind !== 'gold') {
        this.glowDisc.push(k.x, 0.05, k.z, 0, 1.6, 1, 1.6, modelColor(model), 0, 0, 0, 0.5);
      }
    }
  }

  // ---------------------------------------------------------------- hazards
  private drawHazards(time: number) {
    const hz = this.run.hazards;
    const blink = 0.75 + Math.sin(time * 18) * 0.25;
    for (const b of hz.bullets) {
      if (!b.active) continue;
      const s = b.r * 1.7;
      this.glowBoxTop.push(b.x, 0.8, b.z, time * 6, s, s, s, b.color, 0, 0, 0, 1);
      this.glowBox.push(b.x, 0.8, b.z, -time * 4, s * 0.55, s * 0.55, s * 0.55, 0xffffff, 0, 0, 0, 1);
      this.glowDisc.push(b.x, 0.05, b.z, 0, s * 2.2, 1, s * 2.2, b.color, 0, 0, 0, 0.6);
    }
    for (const z of hz.zones) {
      if (!z.active) continue;
      const c = z.freeze ? 0x6ad8ff : z.color;
      if (z.t > 0) {
        const k = 1 - z.t / Math.max(0.01, z.tele);
        this.glowRing.push(z.x, 0.07, z.z, 0, z.r, 1, z.r, c, 0, 0, 0, 0.85 * blink);
        this.glowDisc.push(z.x, 0.06, z.z, 0, z.r * 2.2 * k, 1, z.r * 2.2 * k, c, 0, 0, 0, 0.6);
      } else if (z.poolT > 0) {
        const f = Math.min(1, z.poolT * 2);
        this.glowDisc.push(z.x, 0.06, z.z, time * 0.3, z.r * 2.4, 1, z.r * 2.4, c, 0, 0, 0, 0.55 * f);
        this.glowRingThin.push(z.x, 0.07, z.z, 0, z.r, 1, z.r, c, 0, 0, 0, 0.5 * f);
      }
    }
    for (const l of hz.lasers) {
      if (!l.active) continue;
      const yaw = Math.PI / 2 - l.angle;
      const cx = l.x + Math.cos(l.angle) * l.reach * 0.5;
      const cz = l.z + Math.sin(l.angle) * l.reach * 0.5;
      if (l.t < l.tele) {
        const k = l.t / l.tele;
        this.glowPlane.push(cx, 0.08, cz, yaw, l.width * (0.2 + k * 0.3), 1, l.reach, l.color, 0, 0, 0, 0.4 + k * 0.5 * blink);
      } else {
        const fade = Math.min(1, (l.tele + l.dur - l.t) * 4);
        this.glowBoxTop.push(cx, 0.9, cz, yaw, l.width * fade, l.width * 0.8 * fade, l.reach, l.color, 0, 0, 0, 1);
        this.glowBox.push(cx, 0.9, cz, yaw, l.width * 0.35 * fade, l.width * 0.35, l.reach, 0xffffff, 0, 0, 0, 1);
        this.glowPlane.push(cx, 0.06, cz, yaw, l.width * 2.4, 1, l.reach, l.color, 0, 0, 0, 0.5);
        this.lights.request(cx, 1.2, cz, l.color, 1.6, l.reach * 0.8, this.run.player.x, this.run.player.z);
      }
    }
    for (const s of hz.shocks) {
      if (!s.active) continue;
      const fade = 1 - s.r / s.maxR;
      this.glowRing.push(s.x, 0.12, s.z, 0, s.r, 1, s.r, s.color, 0, 0, 0, 0.6 + fade * 0.4);
      this.glowRingThin.push(s.x, 0.5, s.z, 0, s.r, 1, s.r, s.color, 0, 0, 0, 0.6 * fade);
    }
    for (const w of hz.warns) {
      if (!w.active) continue;
      const k = 1 - w.t / Math.max(0.01, w.total);
      const yaw = Math.atan2(w.dx, w.dz);
      const cx = w.x + w.dx * w.len * 0.5;
      const cz = w.z + w.dz * w.len * 0.5;
      this.glowPlane.push(cx, 0.08, cz, yaw, w.width, 1, w.len, 0xff3030, 0, 0, 0, 0.25 + k * 0.4 * blink);
      this.glowPlane.push(cx, 0.09, cz, yaw, w.width * k, 1, w.len, 0xff6040, 0, 0, 0, 0.5);
    }
  }

  // ---------------------------------------------------------------- weapon effects
  private drawEffects(time: number) {
    for (const e of this.run.effects.list) {
      if (!e.active) continue;
      const k = e.life / e.maxLife; // 1 -> 0
      const c = e.color;
      switch (e.kind) {
        case 'slash': {
          const n = Math.max(4, Math.ceil(e.arc / 0.22));
          const sweep = Math.min(1, (1 - k) * 2.2);
          const shown = Math.max(1, Math.floor(n * sweep));
          for (let i = 0; i < shown; i++) {
            const a = e.angle - e.arc / 2 + ((i + 0.5) / n) * e.arc;
            const rr = e.r * 0.78;
            const x = e.x + Math.cos(a) * rr;
            const z = e.z + Math.sin(a) * rr;
            const seg = (e.arc / n) * rr * 1.25;
            const tip = 1 - Math.abs(i / n - 0.5) * 1.4;
            this.glowPlane.push(x, 0.7, z, Math.PI / 2 - a, e.r * 0.42 * tip, 1, seg, c, 0, 0, 0, k * 0.95);
            this.glowPlane.push(x, 0.72, z, Math.PI / 2 - a, e.r * 0.12 * tip, 1, seg, 0xffffff, 0, 0, 0, k);
          }
          break;
        }
        case 'ring': {
          const r = e.r * (0.35 + (1 - k) * 0.65);
          this.glowRing.push(e.x, 0.15, e.z, 0, r, 1, r, c, 0, 0, 0, k);
          this.glowDisc.push(e.x, 0.1, e.z, 0, r * 2.2, 1, r * 2.2, c, 0, 0, 0, k * 0.4);
          break;
        }
        case 'beam': {
          const dx = e.x2 - e.x;
          const dz = e.z2 - e.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.01) break;
          const yaw = Math.atan2(dx, dz);
          const w = e.w * (0.5 + k * 0.5);
          this.glowBoxTop.push(e.x + dx / 2, e.y, e.z + dz / 2, yaw, w, w, len, c, 0, 0, 0, Math.min(1, k * 2));
          this.glowBox.push(e.x + dx / 2, e.y, e.z + dz / 2, yaw, w * 0.35, w * 0.35, len, 0xffffff, 0, 0, 0, Math.min(1, k * 2));
          this.glowPlane.push(e.x + dx / 2, 0.06, e.z + dz / 2, yaw, w * 2.5, 1, len, c, 0, 0, 0, k * 0.4);
          break;
        }
        case 'bolt': {
          // jagged lightning from (x, y, z) high/low to (x2, 0.6, z2)
          const segs = e.y > 3 ? 7 : 5;
          let px = e.x;
          let py = e.y;
          let pz = e.z;
          const seed = Math.floor(time * 30) + e.seed;
          for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const j = i === segs ? 0 : 0.5;
            const nx = e.x + (e.x2 - e.x) * t + (rnd(seed + i) - 0.5) * j;
            const nz = e.z + (e.z2 - e.z) * t + (rnd(seed + i * 7) - 0.5) * j;
            const ny = e.y + (0.6 - e.y) * t;
            this.segment(px, py, pz, nx, ny, nz, e.w * 1.6, c, k);
            this.segment(px, py, pz, nx, ny, nz, e.w * 0.6, 0xffffff, k);
            px = nx;
            py = ny;
            pz = nz;
          }
          this.glowDisc.push(e.x2, 0.06, e.z2, 0, 2.2, 1, 2.2, c, 0, 0, 0, k * 0.7);
          break;
        }
        case 'lance': {
          const yaw = Math.PI / 2 - e.angle;
          const ext = Math.min(1, (1 - k) * 4);
          const len = e.r * ext;
          const cx = e.x + Math.cos(e.angle) * len * 0.5;
          const cz = e.z + Math.sin(e.angle) * len * 0.5;
          this.glowBoxTop.push(cx, 0.8, cz, yaw, e.w * 0.6, e.w * 0.4, len, c, 0, 0, 0, k);
          this.glowPlane.push(cx, 0.07, cz, yaw, e.w * 1.8, 1, len, c, 0, 0, 0, k * 0.5);
          break;
        }
        case 'aura': {
          const r = e.r;
          this.glowRing.push(e.x, 0.08, e.z, time * 0.8, r, 1, r, c, 0, 0, 0, 0.55);
          this.glowRingThin.push(e.x, 0.1, e.z, -time * 1.4, r * 0.8, 1, r * 0.8, c, 0, 0, 0, 0.35);
          this.glowDisc.push(e.x, 0.05, e.z, 0, r * 2.1, 1, r * 2.1, c, 0, 0, 0, 0.18 + Math.sin(time * 3) * 0.05);
          break;
        }
        case 'flash': {
          const r = e.r * (0.5 + (1 - k) * 0.7);
          this.glowDisc.push(e.x, 0.1, e.z, 0, r * 2.6, 1, r * 2.6, c, 0, 0, 0, k);
          this.glowDisc.push(e.x, 0.12, e.z, 0, r * 1.3, 1, r * 1.3, 0xffffff, 0, 0, 0, k * k);
          this.glowRing.push(e.x, 0.14, e.z, 0, r, 1, r, c, 0, 0, 0, k * 0.8);
          break;
        }
        case 'warn': {
          const kk = 1 - k;
          this.glowRing.push(e.x, 0.07, e.z, 0, e.r, 1, e.r, c, 0, 0, 0, 0.7);
          this.glowDisc.push(e.x, 0.06, e.z, 0, e.r * 2.2 * kk, 1, e.r * 2.2 * kk, c, 0, 0, 0, 0.5);
          break;
        }
        case 'punch': {
          const r = e.r * (0.6 + (1 - k) * 0.8);
          this.glowPlane.push(e.x, 0.8, e.z, Math.PI / 2 - e.angle, r, 1, r * 0.5, c, 0, 0, 0, k);
          this.glowRing.push(e.x, 0.75, e.z, 0, r * 0.6, 1, r * 0.6, 0xffffff, 0, 0, 0, k);
          break;
        }
        case 'cloud': {
          this.darkDisc.push(e.x, 0.05, e.z, 0, e.r * 2, 1, e.r * 2, 0x808080);
          break;
        }
        case 'fall': {
          // falling block telegraph + block
          this.glowRing.push(e.x, 0.07, e.z, 0, 1.1, 1, 1.1, 0xff4030, 0, 0, 0, 0.8);
          this.glowDisc.push(e.x, 0.06, e.z, 0, 2.2 * (1 - k), 1, 2.2 * (1 - k), 0xff4030, 0, 0, 0, 0.5);
          const mb = this.batchesFor('fallrock', ROCK, 1)!;
          mb.frames[0].pushFast(e.x, k * 12, e.z, time * 3 + e.seed, 1, 1, ((c >> 16) & 255) / 160, ((c >> 8) & 255) / 160, (c & 255) / 160, 0);
          break;
        }
      }
    }
  }

  private segment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, w: number, c: number, a: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    this.glowBoxTop.push((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, yaw, w, w, len, c, 0, 0, pitch, a);
  }

  dispose() {
    for (const b of this.models.values()) for (const f of b.frames) f.dispose();
    for (const m of this.bossModels.values()) m.dispose();
    this.hero?.dispose();
    this.rig?.dispose();
    this.heroTex?.dispose();
    this.group.parent?.remove(this.group);
  }
}

const ROCK: VoxelModel = {
  boxes: [
    [0, 0, 0, 10, 10, 10, 0x8a8a8a],
    [2, 2, 2, 6, 10, 6, 0x9a9a9a],
  ],
  scale: 0.1,
};

function rnd(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function modelColor(m: VoxelModel): number {
  return m.boxes[0][6];
}
