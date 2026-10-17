import type { Face, Paint } from './skinAtlas';
import { shade, texNoise } from './skinAtlas';
import { ARMOR_PAL } from './sprites';

/**
 * Our own pixel skins for the cubic figure. Body parts follow the classic 8/12/4 proportions:
 * head 8×8×8, torso 8×12×4, arms and legs 4×12×4.
 *
 * Side faces: on 'left' (+x) pixel x = 0 is the front edge; on 'right' (−x) x = w−1 is the front.
 */
export interface BodySkin {
  head: Paint;
  torso: Paint;
  armR: Paint;
  armL: Paint;
  legR: Paint;
  legL: Paint;
}

const SKIN = ['#c8916a', '#bf8862', '#cf9a72'];
const SKIN_DARK = '#a8744f';
const HAIR = ['#4a3020', '#553826', '#3e281a'];
const SHIRT = ['#d8cfb4', '#cfc6aa', '#e0d8c0'];
const SHIRT_DARK = '#b0a68c';
const PANTS = ['#6a4a2e', '#614329', '#725034'];
const SHOE = ['#3a2a1e', '#33251a'];
const BELT = '#4a321c';

/** Front edge test on side faces. */
function frontEdge(f: Face, x: number, w: number): boolean {
  return (f === 'left' && x === 0) || (f === 'right' && x === w - 1);
}

const head: Paint = (f, x, y, w) => {
  const s = shade(SKIN, x, y, f.length * 7);
  if (f === 'top') return shade(HAIR, x, y, 3);
  if (f === 'bottom') return SKIN_DARK;
  if (f === 'back') return y < 7 ? shade(HAIR, x, y, 5) : s;
  if (f === 'left' || f === 'right') {
    // hair over the top and back, an ear in the middle
    const back = f === 'left' ? x >= 5 : x <= 2;
    if (y < 2 || (back && y < 6)) return shade(HAIR, x, y, 9);
    if (y === 4 && (f === 'left' ? x === 3 : x === 4)) return SKIN_DARK;
    return s;
  }
  // front: fringe, eyes, nose shadow, mouth
  if (y < 2) return shade(HAIR, x, y, 11);
  if (y === 2 && (x === 0 || x === 7)) return HAIR[0];
  if (y === 4) {
    if (x === 1 || x === 6) return '#f4f0ea';
    if (x === 2 || x === 5) return '#3a2a5a';
  }
  if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return '#5a3a24';
  if (y === 5 && (x === 3 || x === 4)) return SKIN_DARK;
  if (y === 6 && x >= 3 && x <= 4) return '#8a4a3a';
  return s;
};

const torso: Paint = (f, x, y, w) => {
  if (f === 'top' || f === 'bottom') return f === 'top' ? SHIRT[0] : PANTS[0];
  if (y >= 10) return y === 10 ? BELT : shade(PANTS, x, y, 13);
  if (f === 'front') {
    // collar opening and lacing
    if (y === 0 && x >= 3 && x <= 4) return SKIN[0];
    if (y === 1 && x >= 3 && x <= 4) return SKIN_DARK;
    if ((y === 2 || y === 4) && x === 4) return SHIRT_DARK;
    if (y === 10 && x === 4) return '#c0a050';
  }
  if (frontEdge(f, x, w) && y > 0) return SHIRT_DARK;
  return shade(SHIRT, x, y, 17);
};

function arm(seed: number): Paint {
  return (f, x, y) => {
    if (f === 'top') return SHIRT[0];
    if (f === 'bottom') return SKIN_DARK;
    if (y < 4) return shade(SHIRT, x, y, seed);
    if (y === 4) return SHIRT_DARK;
    return shade(SKIN, x, y, seed + 3);
  };
}

function leg(seed: number): Paint {
  return (f, x, y) => {
    if (f === 'top') return PANTS[0];
    if (f === 'bottom') return SHOE[1];
    if (y >= 10) return shade(SHOE, x, y, seed);
    if (y === 9) return '#4e3826';
    return shade(PANTS, x, y, seed + 5);
  };
}

export const HUMAN_SKIN: BodySkin = { head, torso, armR: arm(21), armL: arm(23), legR: leg(31), legL: leg(37) };

export const SKINS: Record<string, BodySkin> = { human: HUMAN_SKIN };

// ---------------------------------------------------------------- armor layers

export interface ArmorPaints {
  helmet: Paint;
  torso: Paint;
  /** Upper arm (shoulder) pieces of the body armor. */
  shoulder: Paint;
  glove: Paint;
  boot: Paint;
}

function rivet(x: number, y: number): boolean {
  return texNoise(x, y, 99) > 0.93;
}

/** Armor paints of a set (apprentice cloth, scout leather, guard iron). */
export function armorPaints(set: string): ArmorPaints {
  const P = ARMOR_PAL[set] ?? ARMOR_PAL.guard;
  const A = [P.a, P.b, P.c];
  const main = (x: number, y: number, s: number) => (texNoise(x, y, s) < 0.82 ? P.a : texNoise(x, y, s + 1) < 0.6 ? P.b : P.c);
  const iron = set === 'guard';
  const cloth = set === 'apprentice';

  const helmet: Paint = (f, x, y, w, h) => {
    if (f === 'bottom') return '';
    if (f === 'top') return main(x, y, 1);
    if (f === 'front') {
      // open face: a brow band; iron has a nose guard, cloth a hood rim, leather side flaps
      if (y === 0) return P.c;
      if (y === 1) return P.d;
      if (cloth && (x === 0 || x === w - 1) && y < h) return P.c;
      if (iron && (x === 0 || x === w - 1) && y < 7) return P.a;
      if (iron && y >= 2 && y <= 5 && (x === 3 || x === 4)) return y === 2 ? P.b : P.a;
      if (!iron && !cloth && (x === 0 || x === w - 1) && y < 6) return P.c;
      return '';
    }
    if (f === 'back') return y < (cloth ? h : 7) ? (y === 1 ? P.d : main(x, y, 3)) : '';
    // sides
    const front = frontEdge(f, x, w);
    if (y === 1) return P.d;
    if (cloth) return front ? P.c : main(x, y, 5);
    if (iron) return y < 7 ? (rivet(x, y) ? P.b : main(x, y, 5)) : '';
    return y < 6 ? main(x, y, 5) : '';
  };

  const torso: Paint = (f, x, y, w) => {
    if (f === 'top') return main(x, y, 7);
    if (f === 'bottom') return P.c;
    if (y === 9) return cloth ? P.d : iron ? P.c : P.d;
    if (f === 'front' || f === 'back') {
      if (cloth && (x === 3 || x === 4) && f === 'front') return P.d;
      if (iron && y === 0) return P.b;
      if (iron && (x === 0 || x === w - 1)) return P.c;
      if (!iron && !cloth && f === 'front' && (x + y) % 5 === 0 && y < 9) return P.c;
      if (iron && rivet(x, y)) return P.b;
      return main(x, y, f === 'front' ? 9 : 10);
    }
    return main(x, y, 11);
  };

  const shoulder: Paint = (f, x, y) => {
    if (f === 'top') return iron ? P.b : main(x, y, 13);
    if (f === 'bottom') return '';
    if (y === 0) return iron ? P.b : P.d;
    if (y === 5) return cloth ? P.d : P.c;
    return main(x, y, 15);
  };

  const glove: Paint = (f, x, y) => {
    if (f === 'top') return '';
    if (f === 'bottom') return P.c;
    if (y === 0) return P.d;
    if (y === 1) return cloth ? P.d : P.c;
    return iron && rivet(x, y) ? P.b : main(x, y, 17);
  };

  const boot: Paint = (f, x, y, _w, h) => {
    if (f === 'top') return '';
    if (f === 'bottom') return P.c;
    if (y === 0) return P.d;
    if (y === h - 1) return P.c;
    if (iron && y === 2) return P.b;
    return main(x, y, 19);
  };
  void A;
  return { helmet, torso, shoulder, glove, boot };
}
