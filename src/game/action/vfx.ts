import type { HitFx, Shape } from './types';

/**
 * Visual record emitted by the action combat for the renderer (ActionFxRenderer). The simulation
 * never reads these back; the headless sim simply lets them expire.
 */
export type ActFxKind =
  /** A landed attack shape (slash arcs, smashes, spins…); `fx` picks the look. */
  | 'hit'
  /** Ground telegraph that fills up until the effect lands. */
  | 'warn'
  /** Lasting ground zone (`vis`: aura, seal, poison, fire, ice, rain, storm, vines, trap, light). */
  | 'zone'
  /** Sky-fall impact: meteor / star / pillar of light (`vis`). */
  | 'fall'
  /** Lightning from the sky (storm) or chain hop between two points. */
  | 'bolt'
  /** Dash streak from (x, z) to (x2, z2). */
  | 'trail'
  /** Vanish / appear puff at a point. */
  | 'blink'
  /** Expanding ring. */
  | 'ring'
  /** Bright flash (screen-ish, around the hero). */
  | 'flash'
  /** Aura around the hero while a buff lasts (follows the hero). */
  | 'aura'
  /** Gathering energy around the hero during charge / cast (follows the hero). */
  | 'gather'
  /** Stagger break burst over an enemy. */
  | 'break'
  /** Counter / block spark in front of the hero. */
  | 'block';

export interface ActFx {
  k: ActFxKind;
  x: number;
  z: number;
  y: number;
  x2: number;
  z2: number;
  /** Facing angle (atan2(dz, dx)). */
  a: number;
  shape: Shape | null;
  fx: HitFx | '';
  vis: string;
  r: number;
  color: number;
  /** Seconds left / total. */
  life: number;
  max: number;
  seed: number;
  follow: boolean;
}

export class ActFxList {
  readonly list: ActFx[] = [];
  private free: ActFx[] = [];

  add(k: ActFxKind, x: number, z: number, life: number, color: number): ActFx {
    const f = this.free.pop() ?? ({} as ActFx);
    f.k = k;
    f.x = x;
    f.z = z;
    f.y = 0;
    f.x2 = x;
    f.z2 = z;
    f.a = 0;
    f.shape = null;
    f.fx = '';
    f.vis = '';
    f.r = 1;
    f.color = color;
    f.life = f.max = life;
    f.seed = Math.random() * 1000;
    f.follow = false;
    this.list.push(f);
    return f;
  }

  update(dt: number, px: number, pz: number) {
    let w = 0;
    for (const f of this.list) {
      f.life -= dt;
      if (f.life <= 0) {
        this.free.push(f);
        continue;
      }
      if (f.follow) {
        f.x = px;
        f.z = pz;
      }
      this.list[w++] = f;
    }
    this.list.length = w;
  }

  clear() {
    for (const f of this.list) this.free.push(f);
    this.list.length = 0;
  }
}
