import * as THREE from 'three';
import type { Run } from '../game/Run';
import type { WNpc } from '../game/continent/data';
import { nearestWalkable } from '../game/arpg/Path';
import { hash2 } from '../core/Rng';

/**
 * Village folk of the continent as static placeholders: a small voxel figure with a name tag,
 * standing where their daily schedule (world.json) puts them at the current hour (at the door
 * when the spot is inside a building). No dialogue or walking yet.
 */
export class NpcRenderer {
  readonly group = new THREE.Group();
  private figs = new Map<string, { obj: THREE.Group; npc: WNpc; key: string }>();
  private disposables: { dispose(): void }[] = [];
  private acc = 1;
  private readonly body = new THREE.BoxGeometry(0.5, 0.75, 0.32);
  private readonly head = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  private readonly legs = new THREE.BoxGeometry(0.42, 0.45, 0.26);
  private readonly skin = new THREE.MeshLambertMaterial({ color: 0xe8b890 });
  private readonly pants = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });

  constructor(private run: Run) {
    this.disposables.push(this.body, this.head, this.legs, this.skin, this.pants);
  }

  /** Spot of an NPC at an hour: the last schedule entry at or before it. */
  static spotAt(n: WNpc, hour: number): { pos: [number, number]; doing: string } {
    const s = n.schedule;
    let cur = s[s.length - 1];
    for (const e of s) if (e.h <= hour) cur = e;
    return { pos: cur.pos, doing: cur.doing };
  }

  private make(n: WNpc): THREE.Group {
    const g = new THREE.Group();
    const col = new THREE.Color().setHSL(hash2(n.id.length, n.id.charCodeAt(0), 3), 0.45, 0.45);
    const shirt = new THREE.MeshLambertMaterial({ color: col });
    this.disposables.push(shirt);
    const legs = new THREE.Mesh(this.legs, this.pants);
    legs.position.y = 0.22;
    const body = new THREE.Mesh(this.body, shirt);
    body.position.y = 0.82;
    const head = new THREE.Mesh(this.head, this.skin);
    head.position.y = 1.38;
    for (const m of [legs, body, head]) {
      m.castShadow = true;
      g.add(m);
    }
    // name tag
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.font = '600 22px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = n.ru.length > 22 ? n.ru.slice(0, 21) + '…' : n.ru;
    const w = Math.min(250, ctx.measureText(label).width + 16);
    ctx.fillRect(128 - w / 2, 6, w, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(label, 128, 31);
    const tex = new THREE.CanvasTexture(c);
    const sm = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const spr = new THREE.Sprite(sm);
    spr.scale.set(2.6, 0.49, 1);
    spr.position.y = 2.05;
    spr.renderOrder = 10;
    g.add(spr);
    this.disposables.push(tex, sm);
    return g;
  }

  update(dt: number, hour: number) {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    const run = this.run;
    const d = run.stream?.data;
    if (!d) return;
    const t = run.terrain;
    const p = run.player;
    const h = Math.floor(hour);
    for (const n of d.world.npcs) {
      const { pos } = NpcRenderer.spotAt(n, h);
      const near = (pos[0] - p.x) ** 2 + (pos[1] - p.z) ** 2 < 70 * 70 && pos[0] > t.ox && pos[1] > t.oz && pos[0] < t.ox + t.size && pos[1] < t.oz + t.size;
      let f = this.figs.get(n.id);
      if (!near) {
        if (f) f.obj.visible = false;
        continue;
      }
      if (!f) {
        f = { obj: this.make(n), npc: n, key: '' };
        this.figs.set(n.id, f);
        this.group.add(f.obj);
      }
      const key = `${h}|${t.ox},${t.oz}`;
      if (f.key !== key) {
        f.key = key;
        let [x, z] = pos;
        if (!t.walkableAt(x, z)) {
          const q = nearestWalkable(t, x, z, 9);
          if (q) [x, z] = q;
        }
        // a little apart when several meet at one spot
        x += (hash2(n.id.length, n.id.charCodeAt(1) || 0, 9) - 0.5) * 1.6;
        z += (hash2(n.id.charCodeAt(0), n.id.length, 11) - 0.5) * 1.6;
        f.obj.position.set(x, t.groundY(x, z), z);
        f.obj.rotation.y = hash2(x | 0, z | 0, 5) * Math.PI * 2;
      }
      f.obj.visible = true;
    }
  }

  dispose() {
    this.group.clear();
    for (const d of this.disposables) d.dispose();
  }
}
