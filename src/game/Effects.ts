/** Purely visual effects created by gameplay and drawn by the renderer. */
export type EffectKind = 'slash' | 'ring' | 'beam' | 'bolt' | 'lance' | 'aura' | 'flash' | 'warn' | 'punch' | 'cloud' | 'fall' | 'spark';
/* 'spark': one hop of a travelling Chain Spark from (x, z) to (x2, z2) over `w` seconds; `r` = chain id, `r2` = hop index. */

export class Effect {
  active = false;
  kind: EffectKind = 'ring';
  x = 0;
  y = 0.5;
  z = 0;
  x2 = 0;
  z2 = 0;
  angle = 0;
  arc = 0;
  r = 1;
  r2 = 1;
  w = 0.5;
  life = 0.3;
  maxLife = 0.3;
  color = 0xffffff;
  seed = 0;
  /** Follows the player position. */
  follow = false;
}

export class Effects {
  readonly list: Effect[] = [];

  add(kind: EffectKind, x: number, z: number, life: number, color: number): Effect {
    let e: Effect | undefined;
    for (const o of this.list)
      if (!o.active) {
        e = o;
        break;
      }
    if (!e) {
      e = new Effect();
      this.list.push(e);
    }
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.z = z;
    e.y = 0.5;
    e.life = e.maxLife = life;
    e.color = color;
    e.angle = 0;
    e.arc = 0;
    e.r = 1;
    e.r2 = 1;
    e.w = 0.5;
    e.x2 = x;
    e.z2 = z;
    e.seed = Math.random() * 1000;
    e.follow = false;
    return e;
  }

  update(dt: number, px: number, pz: number) {
    for (const e of this.list) {
      if (!e.active) continue;
      e.life -= dt;
      if (e.follow) {
        e.x = px;
        e.z = pz;
      }
      if (e.life <= 0) e.active = false;
    }
  }

  clear() {
    for (const e of this.list) e.active = false;
  }
}
