import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/** Idle stance (also the base the reaper action clips are authored against). */
export const REAPER_STANCE: PoseMap = {
  rootPos: [0, -1.0, 0],
  legL: [-26, -6, 7], shinL: [38, 0, 0], footL: [-12, 6, 0],
  legR: [-2, 8, -7], shinR: [30, 0, 0], footR: [-26, -8, 0],
  spine: [10, 0, 0], chest: [13, 6, 0], head: [-20, -4, 0],
  armL: [-22, 0, 24], foreL: [-42, 0, 0], handL: [0, 0, 0],
  armR: [-30, 0, -22], foreR: [-50, 0, 0], handR: [0, 0, 0],
};

/**
 * Reaper, a hooded harvester of souls built as a detailed block model (many small bevelled blocks,
 * no pixel skins): a deep charcoal-violet hood with a trailing peak over a shadowed face, a cracked
 * white bone mask with glowing violet eye slits, dark wrapped cloth bands, a crossing harness with a
 * violet rune clasp, cloak sleeves over criss-cross wraps and dark gloves, a long tattered cloak with
 * violet runes, and a small soul-scythe in each hand, held reversed.
 */

const CLOAK = 0x3a2f52;
const CLOAK_L = 0x55467a;
const CLOAK_D = 0x221a32;
const WRAP = 0x4a4560;
const WRAP_L = 0x6e6888;
const WRAP_D = 0x3a3650;
const SHADOW = 0x0c0a12;
const MASK = 0xeee8de;
const MASK_D = 0xbfb6aa;
const VIOLET = 0xb86aff;
const VIOLET_L = 0xe6c4ff;
const VIOLET_D = 0x6a32a8;
const STEEL = 0xb8b4cc;
const STEEL_D = 0x6e6a84;
const LEATHER = 0x2e2626;
const LEATHER_L = 0x46383a;

export function reaperRig(): HeroRigDef {
  const pr = mcProps();
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: shadow, bone mask, glowing eyes
  add(bk('head', -3.6, 0.0, -3.6, 3.6, 7.0, 3.4, SHADOW));
  add(bk('head', -1.6, -1.2, -1.6, 1.6, 0.6, 1.6, SHADOW));
  add(bk('head', -2.9, 1.2, 3.1, 2.9, 6.2, 3.9, MASK, { bv: 0.25 }));
  add(bk('head', -2.4, 0.4, 3.0, 2.4, 1.6, 3.7, MASK_D, { bv: 0.2 })); // jaw
  for (let i = 0; i < 4; i++) add(bk('head', -1.9 + i * 1.0, 0.6, 3.6, -1.3 + i * 1.0, 1.4, 3.85, SHADOW, { bv: 0 })); // teeth gaps
  add(bk('head', -0.5, 2.4, 3.8, 0.5, 3.6, 4.2, MASK_D, { bv: 0.1 })); // nose ridge
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.8, 3.7, 3.75, k * 2.6, 4.7, 4.0, SHADOW, { bv: 0 }));
    add(bk('head', k * 1.0, 3.95, 3.85, k * 2.4, 4.45, 4.1, VIOLET_L, { g: true, bv: 0 }));
    add(bk('head', k * 0.7, 4.8, 3.7, k * 2.7, 5.4, 4.05, MASK_D, { bv: 0.08 }));
  }
  // cracks on the right cheek
  add(bk('head', 1.6, 5.2, 3.85, 2.0, 6.0, 4.0, 0x8a8278, { bv: 0 }));
  add(bk('head', 2.0, 4.8, 3.85, 2.4, 5.4, 4.0, 0x8a8278, { bv: 0 }));
  add(bk('head', 1.4, 2.4, 3.85, 1.8, 3.4, 4.0, 0x8a8278, { bv: 0 }));

  // deep hood: shell, front rim leaving a narrow opening, trailing peak
  add(bk('head', -4.5, 6.6, -4.5, 4.5, 9.0, 4.4, CLOAK));
  add(bk('head', -4.5, -0.6, -4.5, 4.5, 7.0, -2.0, CLOAK));
  for (const k of [-1, 1]) {
    add(bk('head', k * 3.4, -0.6, -4.5, k * 4.55, 7.0, 4.6, CLOAK));
    add(bk('head', k * 2.9, -0.4, 3.8, k * 4.7, 7.4, 4.9, CLOAK_L, { bv: 0.2 })); // rim
    add(bk('head', k * 3.0, -0.4, 4.5, k * 3.3, 6.8, 5.0, CLOAK_D, { bv: 0 }));
    add(bk('head', k * 4.5, 0.4, -3.6, k * 4.7, 6.4, 2.4, CLOAK_D, { bv: 0 })); // folds
  }
  add(bk('head', -4.7, 6.4, 3.8, 4.7, 7.8, 4.9, CLOAK_L, { bv: 0.2 }));
  add(bk('head', -4.0, 6.5, 4.0, 4.0, 6.9, 4.4, CLOAK_D, { bv: 0 }));
  add(bk('head', -3.8, 8.8, -3.8, 3.8, 9.6, 3.2, CLOAK_L, { bv: 0.2 }));
  add(bk('head', -0.5, 9.0, -4.0, 0.5, 9.8, 2.6, CLOAK_D, { bv: 0.1 }));
  add(bk('head', -2.6, 4.2, -6.6, 2.6, 8.4, -4.2, CLOAK, { r: [-12, 0, 0] }));
  add(bk('head', -1.6, 3.0, -7.8, 1.6, 6.0, -6.2, CLOAK_D, { r: [-12, 0, 0], bv: 0.25 }));

  // ---------------------------------------------------------------- chest: wrapped bands, harness, rune clasp, hood mantle
  add(bk('chest', -4.0, 0, -2.1, 4.0, 8.0, 2.1, WRAP));
  for (let i = 0; i < 4; i++) add(bk('chest', -4.1, 0.6 + i * 1.8, -2.2, 4.1, 1.4 + i * 1.8, 2.2, i % 2 ? WRAP_D : WRAP_L, { bv: 0.08, r: [0, 0, i % 2 ? 4 : -4] }));
  add(bk('chest', -4.6, 6.2, -2.8, 4.6, 8.6, 2.8, CLOAK, { bv: 0.3 })); // mantle
  add(bk('chest', -4.2, 5.6, 2.2, 4.2, 6.6, 3.0, CLOAK_D, { bv: 0.15 }));
  for (let i = 0; i < 6; i++) add(bk('chest', -4.5 + i * 1.5, 5.2 - jr(i) * 0.8, 2.3, -3.0 + i * 1.5, 6.4, 3.0, i % 2 ? CLOAK_L : CLOAK, { bv: 0.08 })); // ragged mantle edge
  for (let i = 0; i < 7; i++) {
    const y = 5.8 - i * 0.85;
    const x = 3.2 - i * 1.0;
    add(bk('chest', x - 0.6, y - 0.45, 2.15, x + 0.6, y + 0.45, 2.6, LEATHER, { bv: 0.06 }));
  }
  add(bk('chest', -1.2, 2.4, 2.5, 1.2, 4.6, 2.95, VIOLET_D, { bv: 0.15 }));
  add(bk('chest', -0.6, 3.0, 2.8, 0.6, 4.0, 3.15, VIOLET, { g: true, bv: 0.06 }));
  add(bk('spine', -3.8, 0.9, -2.0, 3.8, 3.9, 2.0, WRAP));
  add(bk('spine', -3.9, 1.6, -2.1, 3.9, 2.4, 2.1, WRAP_D, { bv: 0.06, r: [0, 0, 4] }));

  // ---------------------------------------------------------------- hips: belt with violet buckle, cloth skirt strips
  add(bk('hips', -4.1, -0.6, -2.2, 4.1, 3.0, 2.2, CLOAK_D));
  add(bk('hips', -4.3, 1.8, -2.4, 4.3, 2.8, 2.4, LEATHER));
  add(bk('hips', -0.9, 1.6, 2.3, 0.9, 3.0, 2.75, VIOLET_D, { bv: 0.1 }));
  add(bk('hips', -0.4, 2.0, 2.6, 0.4, 2.6, 2.9, VIOLET, { g: true, bv: 0 }));
  for (let i = 0; i < 8; i++) {
    const x = -4.2 + i * 1.05;
    const len = 1.8 + jr(i + 11) * 1.8;
    add(bk('hips', x, -len, 2.0, x + 1.05, 1.8, 2.5, i % 2 ? CLOAK_D : CLOAK, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- limbs, mirrored
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    // cloak sleeve to the elbow with a ragged cuff and a rune
    add(bk(arm, -2.2, -5.0, -2.2, 2.2, 2.2, 2.2, CLOAK));
    add(bk(arm, -2.4, 0.4, -2.4, 2.4, 2.6, 2.4, CLOAK_L, { bv: 0.3 }));
    for (let i = 0; i < 4; i++) add(bk(arm, -2.3 + i * 1.15, -5.6 - jr(i + k * 3) * 0.9, -2.3, -1.15 + i * 1.15, -4.2, 2.3, i % 2 ? CLOAK_D : CLOAK, { bv: 0.06 }));
    add(bk(arm, k * 2.15, -2.6, -0.5, k * 2.45, -0.8, 0.5, VIOLET_D, { g: true, bv: 0 }));
    // criss-cross wrapped forearm
    add(bk(fore, -1.9, -3.0, -1.9, 1.9, 1.0, 1.9, WRAP));
    for (let i = 0; i < 4; i++) add(bk(fore, -2.0, -2.8 + i * 0.85, -2.0, 2.0, -2.35 + i * 0.85, 2.0, i % 2 ? WRAP_L : WRAP_D, { bv: 0.05, r: [0, 0, (i % 2 ? 1 : -1) * 10 * k] }));
    // dark glove
    add(bk(hand, -1.9, -2.1, -1.9, 1.9, 1.0, 1.9, SHADOW));
    add(bk(hand, -2.0, 0.2, -2.0, 2.0, 1.0, 2.0, LEATHER_L, { bv: 0.1 }));
    add(bk(hand, -1.6, -2.2, 1.3, 1.6, -1.2, 2.05, LEATHER, { bv: 0.12 }));
    // dark leggings, wrapped shins, soft boots
    add(bk(leg, -2.0, -6.0, -2.0, 2.0, 0.2, 2.0, CLOAK_D));
    add(bk(leg, k * 0.5, -5.2, -2.1, k * 2.15, -1.0, 2.1, CLOAK, { bv: 0.15 }));
    add(bk(shin, -1.95, -5.0, -1.95, 1.95, 1.0, 1.95, CLOAK_D));
    for (let i = 0; i < 4; i++) add(bk(shin, -2.05, -3.8 + i * 0.95, -2.05, 2.05, -3.35 + i * 0.95, 2.05, i === 2 ? WRAP_L : WRAP, { bv: 0.05, r: [0, 0, i % 2 ? 6 : -6] }));
    add(bk(shin, -2.1, -5.0, -2.1, 2.1, -4.0, 2.1, LEATHER, { bv: 0.1 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, 0.6, 3.0, LEATHER));
    add(bk(foot, -1.8, -0.6, 2.2, 1.8, 0.3, 3.6, LEATHER_L, { bv: 0.2 }));
    add(bk(foot, -2.2, -1.0, -2.4, 2.2, -0.65, 3.4, SHADOW, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- long tattered cloak with violet runes
  const CW = 10;
  const cut = [3, 1, 4, 2, 0, 3, 1, 4, 2, 2];
  for (let i = 0; i < CW; i++) {
    const x = -CW / 2 + i;
    const c = i % 3 === 1 ? CLOAK_D : i % 2 ? CLOAK : CLOAK_L;
    add(bk('capeA', x, -7.2, -0.5, x + 1, 0.4, 0.3, c, { bv: 0.08 }));
    add(bk('capeB', x, -(8 - cut[i] - jr(i) * 0.6), -0.5, x + 1, 0.2, 0.3, c, { bv: 0.08 }));
  }
  add(bk('capeA', -5.3, -0.8, -0.7, 5.3, 0.8, 0.6, CLOAK_D, { bv: 0.15 }));
  // runes on the back (facing -z)
  const runes: [number, number, number, number][] = [
    [-1, -3.0, 1, -2.4], [-1, -4.0, -0.4, -3.0], [-0.2, -5.0, 0.4, -4.0], // capeA
    [-3, -3.2, -2.4, -1.6], [2, -3.6, 2.6, -2.4], [1.4, -4.2, 2.6, -3.6],
  ];
  runes.forEach(([x0, y0, x1, y1], i) => add(bk(i < 3 ? 'capeA' : 'capeB', x0, y0, -0.75, x1, y1, -0.45, VIOLET, { g: true, bv: 0 })));

  // ---------------------------------------------------------------- soul scythes, reverse grip: shaft toward -z, blade hooks toward +y
  function scythe(b: 'gripL' | 'gripR'): RigPart[] {
    const rows = [
      '..ssss....',
      '.Wmmmmsss.',
      '.W...eemms',
      '.W.....ems',
      '.w......es',
      '.w.......e',
      '.w........',
      '.b........',
      '.b........',
      'PPP.......',
    ];
    return pixelItem(rows, { s: STEEL, m: STEEL_D, e: VIOLET, W: STEEL_D, w: 0x4a3a30, b: LEATHER, P: VIOLET }, { b, at: GRIP, pivot: [1, 7.5], px: 0.95, th: 0.45, u: '+y', v: '-z', glow: 'eP', thick: { W: 1.6, w: 1.6, b: 1.6, P: 1.8 } });
  }
  add(...scythe('gripL'), ...scythe('gripR'));

  return {
    id: 'reaper',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      // 'bob' keeps the long cloak trailing low instead of flying flat at a run
      capeA: { parent: 'chest', at: [0, 7.8, -2.6], kind: 'bob', k: 0.8, rest: -6 },
      capeB: { parent: 'capeA', at: [0, -7, 0], kind: 'bob', k: 0.6, rest: 8 },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1] + 8 * 0.95, GRIP[2] - 2.5 * 0.95] },
    grip: { L: { at: GRIP, rot: [-30, 0, 0] }, R: { at: GRIP, rot: [-30, 0, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.5, stride: 32, knee: 42, armSwing: 8, elbow: 26, bounce: 0.2, lean: 10, sway: 1, twist: 5, heavy: 0, headBob: 0.2, armOut: 12, idle: 0.8 },
      stance: REAPER_STANCE,
      stanceRun: 0.75,
      victory: 'raise',
    },
  };
}
